/**
 * 花再（HALO PIXELBAR）音箱同步路由 —— 从 routes.ts 拆分。
 * 所有调用尽力而为：设备不在线/开关关闭时空转，不影响播放器。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { getHaloSync } from './sync.ts'
import { API_PREFIX } from '../routes.ts'

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
  let total = 0
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
    total += (chunk as Buffer).length
    if (total > 1_048_576) throw new Error('body too large（上限 1MB）')
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export function makeHaloRoutes(): WebRoute[] {
  const get = (path: string, run: (query: URLSearchParams) => Promise<unknown>): WebRoute => ({
    kind: 'exact',
    path,
    handler(req, res) {
      if (!requireMethod(req, res, 'GET')) return
      const query = new URL(req.url ?? '/', 'http://localhost').searchParams
      run(query).then(
        value => json(res, 200, { ok: true, ...(value as object) }),
        error => {
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
            json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          },
        ))
    },
  })

  return [
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