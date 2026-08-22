/** 宿主半 HTTP 路由 —— 平台 BFF、音频代理、登录态管理。 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { logError, logInfo, logWarn } from './log.ts'
import { proxyAudio } from './proxy/audio.ts'
import * as netease from './providers/netease.ts'
import * as qq from './providers/qq.ts'
import { aggregateSearch } from './providers/merge.ts'
import { drainCommands, nowPlayingSnapshot, pushCommand, reportNowPlaying } from './bridge.ts'
import { getHaloSync } from './halo/sync.ts'
import type { BridgeCommand, NowPlayingReport } from './bridge.ts'
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
        error => {
          logError(`GET ${path}`, error)
          json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
        },
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
          error => {
            logError(`POST ${path}`, error)
            json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          },
        ))
    },
  })

  return [
    get(`${API_PREFIX}/health`, async () => ({ plugin: 'dsh-music-huazai', version: '0.1.0', milestone: 'M6' })),
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
      let result
      if (parsed.provider === 'netease') {
        result = await netease.songUrl(parsed.songId, normalizeQuality(quality))
      } else {
        const mediaMid = query.get('mediaMid') ?? ''
        result = await qq.songUrl(parsed.songId, quality, mediaMid)
      }
      if (result.url) {
        logInfo(`url ok ${parsed.provider}:${parsed.songId} level=${result.quality ?? '?'}`)
      } else {
        logWarn(`url miss ${parsed.provider}:${parsed.songId} q=${quality}: ${result.reason ?? 'unknown'}`)
      }
      return { result }
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

    // ---- 网易红心收藏 ----
    post(`${API_PREFIX}/like/set`, async body => {
      const parsed = parseTrackId(String(body.id ?? ''))
      if (!parsed || parsed.provider !== 'netease') throw new Error('仅支持 netease:<id>')
      return netease.like(parsed.songId, body.liked === true)
    }),
    get(`${API_PREFIX}/like/check`, async query => {
      const parsed = parseTrackId(query.get('id') ?? '')
      if (!parsed || parsed.provider !== 'netease') return { liked: false }
      return netease.likeCheck(parsed.songId)
    }),

    // ---- 浏览器↔宿主桥（AI 工具的执行通道） ----
    post(`${API_PREFIX}/bridge/report`, async body => {
      const raw = body.nowPlaying as Partial<NowPlayingReport> | undefined
      if (raw && typeof raw.trackId === 'string') {
        reportNowPlaying({
          trackId: raw.trackId,
          name: String(raw.name ?? ''),
          artists: Array.isArray(raw.artists) ? raw.artists.map(String) : [],
          album: String(raw.album ?? ''),
          provider: String(raw.provider ?? ''),
          positionSec: Number(raw.positionSec) || 0,
          durationSec: Number(raw.durationSec) || 0,
          playing: raw.playing === true,
        })
      }
      return {}
    }),
    get(`${API_PREFIX}/bridge/poll`, async () => ({ commands: drainCommands() })),
    post(`${API_PREFIX}/bridge/command`, async body => {
      const command = normalizeCommand(body)
      if (!command) throw new Error('bad command')
      return { queued: pushCommand(command) }
    }),

    // ---- 花再（HALO PIXELBAR）同步 ----
    get(`${API_PREFIX}/halo/status`, async () => ({ halo: getHaloSync().status() })),
    post(`${API_PREFIX}/halo/config`, async body => {
      const patch = (body.config ?? {}) as Record<string, unknown>
      return { config: getHaloSync().setConfig(patch) }
    }),
    post(`${API_PREFIX}/halo/lyric`, async body => {
      getHaloSync().onLyric(String(body.text ?? ''))
      return {}
    }),
    post(`${API_PREFIX}/halo/song`, async body => {
      getHaloSync().onSong(String(body.name ?? ''), String(body.artist ?? ''))
      return {}
    }),
    post(`${API_PREFIX}/halo/state`, async body => {
      getHaloSync().onPlayState(body.playing === true)
      return {}
    }),
    post(`${API_PREFIX}/halo/command`, async body => {
      const halo = getHaloSync()
      const kind = String(body.kind ?? '')
      if (kind === 'scene') return { ok: halo.sendScene(String(body.value ?? '')) }
      if (kind === 'spectrum') return { ok: halo.sendSpectrum(Number(body.value) || 0) }
      if (kind === 'clock') return { ok: halo.sendClock(Number(body.value) || 1) }
      throw new Error(`bad kind: ${kind}`)
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

/** 宽松校验桥命令（工具侧也可直接调 pushCommand，此入口供调试）。 */
function normalizeCommand(body: Record<string, unknown>): BridgeCommand | undefined {
  const type = String(body.type ?? '')
  if (type === 'pause' || type === 'resume' || type === 'next' || type === 'prev') return { type }
  return undefined
}

/** 工具层读取正在播放快照。 */
export function getNowPlaying(): NowPlayingReport | null {
  return nowPlayingSnapshot().report
}

/** 注册全部路由并返回注销函数（供 ctx.effect 使用）。 */
export function registerRoutes(ctx: Context): () => void {
  const routes = makeRoutes(ctx)
  logInfo(`routes registered: ${routes.length}`)
  const disposers = routes.map(route => ctx.webServer.register(route))
  return () => {
    for (const dispose of disposers) dispose()
  }
}
