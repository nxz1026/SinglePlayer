/**
 * 花再（HALO PIXELBAR）音箱同步路由 —— 从 routes.ts 拆分。
 * 所有调用尽力而为：设备不在线/开关关闭时空转，不影响播放器。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { getHaloSync } from './sync.ts'
import { API_PREFIX } from '../routes.ts'
import { dataDir } from '../store/auth.ts'

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
    post(`${API_PREFIX}/halo/notify/dismiss`, async () => {
      getHaloSync().dismissNotify()
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

    ...makeNotifySoundRoutes(),
  ]
}

// ---------------------------------------------------------------- 自定义提示音

const SOUND_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'flac'] as const
type SoundExt = (typeof SOUND_EXTS)[number]
const MAX_SOUND_BYTES = 3 * 1024 * 1024
const CONTENT_TYPE: Record<SoundExt, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
}

function soundPath(ext: SoundExt): string {
  return join(dataDir(), `notify-sound.${ext}`)
}

function findSoundFile(): { ext: SoundExt; bytes: Buffer } | null {
  for (const ext of SOUND_EXTS) {
    try {
      const file = soundPath(ext)
      if (existsSync(file)) return { ext, bytes: readFileSync(file) }
    } catch { /* 尽力而为 */ }
  }
  return null
}

/** 魔数校验：防止改扩展名伪装，避免浏览器解码崩溃。 */
function sniffSoundExt(bytes: Buffer): SoundExt | null {
  const ascii = (start: number, len: number): string => bytes.subarray(start, start + len).toString('latin1')
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return 'wav'
  if (bytes.length >= 4 && ascii(0, 3) === 'ID3') return 'mp3'
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) return 'mp3'
  if (bytes.length >= 4 && ascii(0, 4) === 'OggS') return 'ogg'
  if (bytes.length >= 12 && ascii(4, 4) === 'ftyp') return 'm4a'
  if (bytes.length >= 4 && ascii(0, 4) === 'fLaC') return 'flac'
  return null
}

/** 清掉其它扩展名的旧文件，保证全库只有一份自定义提示音。 */
function removeOtherSounds(keep?: SoundExt): void {
  for (const ext of SOUND_EXTS) {
    if (ext === keep) continue
    try {
      const file = soundPath(ext)
      if (existsSync(file)) unlinkSync(file)
    } catch { /* 尽力而为 */ }
  }
}

function makeNotifySoundRoutes(): WebRoute[] {
  return [
    // 上传：原始二进制 body；?ext= 仅作参考，实际以魔数为准。
    {
      kind: 'exact',
      path: `${API_PREFIX}/notify/sound/upload`,
      handler(req, res) {
        if (!requireMethod(req, res, 'POST')) return
        void (async (): Promise<void> => {
          try {
            const chunks: Buffer[] = []
            let total = 0
            for await (const chunk of req) {
              total += (chunk as Buffer).length
              if (total > MAX_SOUND_BYTES) throw new Error(`文件过大（上限 ${MAX_SOUND_BYTES / 1024 / 1024}MB）`)
              chunks.push(chunk as Buffer)
            }
            const bytes = Buffer.concat(chunks)
            if (bytes.length < 32) throw new Error('文件太小，不像有效音频')
            const ext = sniffSoundExt(bytes)
            if (!ext) throw new Error('不支持的音频格式（仅 mp3/wav/ogg/m4a/flac）')
            mkdirSync(dataDir(), { recursive: true })
            removeOtherSounds(ext)
            writeFileSync(soundPath(ext), bytes)
            json(res, 200, { ok: true, exists: true, ext, bytes: bytes.length })
          } catch (error) {
            json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        })()
      },
    },
    // 查询当前自定义提示音状态。
    {
      kind: 'exact',
      path: `${API_PREFIX}/notify/sound/info`,
      handler(req, res) {
        if (!requireMethod(req, res, 'GET')) return
        const found = findSoundFile()
        json(res, 200, found
          ? { ok: true, exists: true, ext: found.ext, bytes: found.bytes.length }
          : { ok: true, exists: false })
      },
    },
    // 取回音频文件本体（浏览器半播放用）；无自定义时 404。
    {
      kind: 'exact',
      path: `${API_PREFIX}/notify/sound/file`,
      handler(req, res) {
        if (!requireMethod(req, res, 'GET')) return
        const found = findSoundFile()
        if (!found) {
          res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: false, error: 'no custom sound' }))
          return
        }
        res.writeHead(200, {
          'content-type': CONTENT_TYPE[found.ext],
          'content-length': found.bytes.length,
          'cache-control': 'no-store',
        })
        res.end(found.bytes)
      },
    },
    // 删除自定义提示音（恢复内置双音）。
    {
      kind: 'exact',
      path: `${API_PREFIX}/notify/sound/reset`,
      handler(req, res) {
        if (!requireMethod(req, res, 'POST')) return
        removeOtherSounds()
        json(res, 200, { ok: true, exists: false })
      },
    },
  ]
}