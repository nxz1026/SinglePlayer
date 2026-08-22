/** 宿主半 HTTP 路由 —— 平台 BFF、音频代理、登录态管理。 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { proxyAudio } from './proxy/audio.ts'
import * as netease from './providers/netease.ts'
import * as qq from './providers/qq.ts'
import { aggregateSearch } from './providers/merge.ts'
import type { ProviderId, Quality } from './providers/types.ts'
import { loadAuth, saveAuth } from './store/auth.ts'

export const API_PREFIX = '/api/dsh-music'

function json(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

function requireMethod(req: IncomingMessage, res: ServerResponse, method: string): boolean {
  if (req.method === method) return true
  json(res, 405, { ok: false, error: `method ${req.method} not allowed` })
  return false
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

/** 解析平台限定 id：`netease:123456` / `qq:<mid>`。 */
export function parseTrackId(id: string): { provider: ProviderId; songId: string } | undefined {
  const index = id.indexOf(':')
  if (index <= 0) return undefined
  const provider = id.slice(0, index)
  const songId = id.slice(index + 1)
  if ((provider !== 'netease' && provider !== 'qq') || !songId) return undefined
  return { provider: provider as ProviderId, songId }
}

export function makeRoutes(ctx: Context): WebRoute[] {
  const get = (path: string, run: (query: URLSearchParams) => Promise<unknown>): WebRoute => ({
    kind: 'exact',
    path,
    handler(req, res) {
      if (!requireMethod(req, res, 'GET')) return
      const query = new URL(req.url ?? '/', 'http://localhost').searchParams
      run(query).then(
        value => json(res, 200, { ok: true, ...(value as object) }),
        error => json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }),
      )
    },
  })
  const post = (path: string, run: (body: Record<string, unknown>) => Promise<unknown>): WebRoute => ({
    kind: 'exact',
    path,
    handler(req, res) {
      if (!requireMethod(req, res, 'POST')) return Promise.resolve()
      return readJsonBody(req).then(body =>
        run(body).then(
          value => json(res, 200, { ok: true, ...(value as object) }),
          error => json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) }),
        ))
    },
  })

  return [
    get(`${API_PREFIX}/search`, async query => {
      const keyword = query.get('keyword') ?? ''
      const limit = Number(query.get('limit') ?? 12) || 12
      const offset = Number(query.get('offset') ?? 0) || 0
      const rawProviders = query.get('providers')
      const providers = rawProviders
        ? rawProviderList(rawProviders)
        : undefined
      const tracks = await aggregateSearch({ keyword, limit, offset, providers })
      return { tracks }
    }),

    get(`${API_PREFIX}/url`, async query => {
      const parsed = parseTrackId(query.get('id') ?? '')
      if (!parsed) throw new Error('bad track id（期望 netease:<id> 或 qq:<mid>）')
      const quality = (query.get('quality') ?? 'exhigh') as Quality | string
      if (parsed.provider === 'netease') {
        return { result: await netease.songUrl(parsed.songId, normalizeQuality(quality)) }
      }
      const mediaMid = query.get('mediaMid') ?? ''
      return { result: await qq.songUrl(parsed.songId, quality, mediaMid) }
    }),

    get(`${API_PREFIX}/lyric`, async query => {
      const parsed = parseTrackId(query.get('id') ?? '')
      if (!parsed) throw new Error('bad track id')
      const payload = parsed.provider === 'netease'
        ? await netease.lyric(parsed.songId)
        : await qq.lyric(parsed.songId, query.get('numericId') ?? '')
      return { lyric: payload }
    }),

    // 音频代理：流式，非 JSON。
    {
      kind: 'exact',
      path: `${API_PREFIX}/audio`,
      handler(req, res) {
        if (!requireMethod(req, res, 'GET')) return
        const query = new URL(req.url ?? '/', 'http://localhost').searchParams
        void proxyAudio(req, res, query.get('url') ?? '')
      },
    },

    // ---- 网易云扫码登录 ----
    post(`${API_PREFIX}/auth/netease/qr`, async () => {
      const key = await netease.qrKeyStart()
      return { key }
    }),
    get(`${API_PREFIX}/auth/netease/qr/create`, async query => {
      const key = query.get('key') ?? ''
      const { img, url } = await netease.qrImage(key)
      return { img, url }
    }),
    get(`${API_PREFIX}/auth/netease/qr/check`, async query => {
      const key = query.get('key') ?? ''
      return { qr: await netease.qrCheck(key) }
    }),

    // ---- QQ Cookie 登录 ----
    post(`${API_PREFIX}/auth/qq`, async body => {
      const cookie = String(body.cookie ?? '').trim()
      if (!cookie.toLowerCase().includes('uin=')) throw new Error('Cookie 需包含 uin=（从 y.qq.com 复制）')
      saveAuth({ qqCookie: cookie })
      return { saved: true }
    }),
    get(`${API_PREFIX}/auth/status`, async () => {
      const [neteaseStatus] = await Promise.all([netease.authStatus()])
      const qqCookie = loadAuth().qqCookie
      const qqUin = qqCookie ? extractQQUin(qqCookie) : ''
      return {
        providers: [
          neteaseStatus,
          { provider: 'qq', loggedIn: !!qqUin },
        ],
      }
    }),
  ]
}

function rawProviderList(raw: string): ProviderId[] {
  const valid: ProviderId[] = []
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (trimmed === 'netease' || trimmed === 'qq') valid.push(trimmed)
  }
  return valid.length ? valid : ['netease', 'qq']
}

function normalizeQuality(raw: string): Quality {
  const map: Record<string, Quality> = {
    standard: 'standard', exhigh: 'exhigh', lossless: 'lossless', hires: 'hires', jymaster: 'jymaster',
  }
  return map[raw.toLowerCase()] ?? 'exhigh'
}

function extractQQUin(cookieText: string): string {
  for (const part of cookieText.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if ((key === 'uin' || key === 'wxuin' || key === 'p_uin') && rest.join('=')) return rest.join('=')
  }
  return ''
}

/** 注册全部路由并返回注销函数（供 ctx.effect 使用）。 */
export function registerRoutes(ctx: Context): () => void {
  const disposers = makeRoutes(ctx).map(route => ctx.webServer.register(route))
  return () => {
    for (const dispose of disposers) dispose()
  }
}
