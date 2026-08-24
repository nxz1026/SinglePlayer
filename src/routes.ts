/** 宿主半 HTTP 路由 —— 平台 BFF、音频代理、登录态管理。 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { logError, logInfo, logWarn } from './log.ts'
import { proxyAudio } from './proxy/audio.ts'
import * as netease from './providers/netease.ts'
import * as qq from './providers/qq.ts'
import { aggregateSearch } from './providers/merge.ts'
import { allProviderIds, getProvider, hasProvider, isEnabled, listProviders, enabledProviderIds, setEnabled } from './providers/registry.ts'
import { drainCommands, nowPlayingSnapshot, pushCommand, reportNowPlaying } from './bridge.ts'
import { trackKey } from './providers/types.ts'
import { addTrack, createList, deleteList, getLists, getStats, recordPlay, removeTrack } from './store/library.ts'
import type { BridgeCommand, NowPlayingReport } from './providers/types.ts'
import type { ProviderId, Quality } from './providers/types.ts'
import { saveAuth } from './store/auth.ts'
import { buildRecommendSections, buildShuffleMix } from './recommend.ts'
import { makeHaloRoutes } from './halo/routes.ts'
import { getSettings, patchSettings } from './store/settings.ts'
import type { PluginSettings } from './store/settings.ts'
import { addAlarm, cancelSleepTimer, removeAlarm, scheduleSnapshot, startSleepTimer } from './scheduler.ts'
import { dispatchNotify } from './notify.ts'
import { maybeReversePush } from './reverse.ts'

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

/** 解析平台限定 id：`netease:123456` / `qq:<mid>` / 任意已注册音源。 */
export function parseTrackId(id: string): { provider: ProviderId; songId: string } | undefined {
  const index = id.indexOf(':')
  if (index <= 0) return undefined
  const provider = id.slice(0, index)
  const songId = id.slice(index + 1)
  if (!songId) return undefined
  return { provider, songId }
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
      const provider = getProvider(parsed.provider)
      if (!provider) throw new Error(`未知音源: ${parsed.provider}`)
      const mediaMid = query.get('mediaMid') ?? ''
      const result = await provider.songUrl(parsed.songId, normalizeQuality(quality), { mediaMid })
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
      const provider = getProvider(parsed.provider)
      if (!provider) throw new Error(`未知音源: ${parsed.provider}`)
      const payload = await provider.lyric(parsed.songId, { numericId: query.get('numericId') ?? '' })
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

    // ---- QQ 扫码登录（腾讯 ptlogin 二维码，最佳努力）----
    post(`${API_PREFIX}/auth/qq/qr`, async () => {
      const { qrsig, ptLoginSig, img } = await qq.qqQrStart()
      return { qrsig, ptLoginSig, img }
    }),
    get(`${API_PREFIX}/auth/qq/qr/check`, async query => {
      const qrsig = query.get('qrsig') ?? ''
      const ptLoginSig = query.get('ptLoginSig') ?? ''
      return { qr: await qq.qqQrCheck(qrsig, ptLoginSig) }
    }),
    get(`${API_PREFIX}/auth/status`, async () => {
      const providers = await Promise.all(listProviders().map(p => p.authStatus()))
      return { providers }
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
        const report: NowPlayingReport = {
          trackId: raw.trackId,
          name: String(raw.name ?? ''),
          artists: Array.isArray(raw.artists) ? raw.artists.map(String) : [],
          album: String(raw.album ?? ''),
          provider: String(raw.provider ?? ''),
          positionSec: Number(raw.positionSec) || 0,
          durationSec: Number(raw.durationSec) || 0,
          playing: raw.playing === true,
        }
        const isNewTrack = report.trackId !== getNowPlaying()?.trackId
        reportNowPlaying(report)
        // 反向推送：切歌事件写入会话（受设置开关控制）。
        maybeReversePush(ctx, report, isNewTrack)
      }
      return {}
    }),
    get(`${API_PREFIX}/bridge/poll`, async () => ({ commands: drainCommands() })),
    post(`${API_PREFIX}/bridge/command`, async body => {
      const command = normalizeCommand(body)
      if (!command) throw new Error('bad command')
      return { queued: pushCommand(command) }
    }),

    // ---- 推荐：登录→每日个性化；另附 1~2 个按日期随机轮换的官方榜单 ----
    get(`${API_PREFIX}/recommend`, async () => ({ sections: await buildRecommendSections() })),

    get(`${API_PREFIX}/chart`, async query => {
      const id = query.get('id') ?? '3778678'
      const limit = Number(query.get('limit') ?? 50) || 50
      const tracks = await netease.chartTracksById(id, limit)
      return { tracks }
    }),

    // ---- 随便听听：曲库+红心 Top30 混入 6 首随机，打乱返回 ----
    get(`${API_PREFIX}/shuffle-mix`, async () => ({ tracks: await buildShuffleMix() })),

    // ---- 本地曲库（多列表）与播放统计 ----
    get(`${API_PREFIX}/lists`, async () => ({
      lists: getLists(),
      recent: getStats().recent,
      plays: getStats().plays,
    })),
    post(`${API_PREFIX}/list/create`, async body => {
      const list = createList(String(body.name ?? ''))
      return { list }
    }),
    post(`${API_PREFIX}/list/delete`, async body => {
      return { deleted: deleteList(String(body.id ?? '')) }
    }),
    post(`${API_PREFIX}/list/add`, async body => {
      const track = body.track as import('./providers/types.ts').Track | undefined
      const result = track ? addTrack(String(body.id ?? ''), track) : undefined
      if (result === undefined) throw new Error('列表不存在')
      return { added: result === 'added' }
    }),
    post(`${API_PREFIX}/list/remove`, async body => {
      return { removed: removeTrack(String(body.id ?? ''), String(body.trackId ?? '')) }
    }),
    post(`${API_PREFIX}/list/import`, async body => {
      const incoming = Array.isArray(body.lists) ? body.lists as Array<Record<string, unknown>> : []
      let imported = 0
      for (const raw of incoming) {
        const name = String(raw.name ?? '').trim()
        const tracks = Array.isArray(raw.tracks) ? raw.tracks as import('./providers/types.ts').Track[] : []
        if (!name || !tracks.length) continue
        const list = createList(name)
        for (const track of tracks) {
          if (addTrack(list.id, track) === 'added') imported += 1
        }
      }
      return { lists: getLists().length, tracks: imported }
    }),
    post(`${API_PREFIX}/stats/play`, async body => {
      const track = body.track as import('./providers/types.ts').Track | undefined
      if (!track?.provider || !track.songId) throw new Error('bad track')
      recordPlay(track)
      return {}
    }),

    // ---- 插件设置（通知 / 定时 / 反向推送开关） ----
    get(`${API_PREFIX}/settings`, async () => ({ settings: getSettings() })),
    post(`${API_PREFIX}/settings/save`, async body => {
      const patch = (body.settings ?? body) as Partial<PluginSettings>
      return { settings: patchSettings(patch) }
    }),

    // ---- 音乐源管理（运行时启停已注册音源；新增源由开发者放 providers/<x>.ts 注册） ----
    get(`${API_PREFIX}/providers`, async () => {
      return {
        providers: listProviders().map(p => ({
          id: p.id,
          label: p.label,
          description: p.description ?? '',
          enabled: isEnabled(p.id),
        })),
      }
    }),
    post(`${API_PREFIX}/providers/toggle`, async body => {
      const id = String(body.id ?? '')
      const on = body.enabled === true
      if (!hasProvider(id)) throw new Error(`未知音源: ${id}`)
      setEnabled(id, on)
      return { id, enabled: isEnabled(id) }
    }),

    // ---- 定时任务（闹钟 + 睡眠定时器） ----
    get(`${API_PREFIX}/schedule`, async () => scheduleSnapshot()),
    post(`${API_PREFIX}/alarm/add`, async body => ({
      alarm: addAlarm(String(body.time ?? ''), String(body.keyword ?? ''), body.label == null ? undefined : String(body.label)),
    })),
    post(`${API_PREFIX}/alarm/remove`, async body => ({ removed: removeAlarm(String(body.id ?? '')) })),
    post(`${API_PREFIX}/sleep/set`, async body => {
      const minutes = Number(body.minutes) || 0
      if (!(minutes > 0)) {
        cancelSleepTimer()
        return { remainingSec: 0 }
      }
      return { endsAt: startSleepTimer(Math.min(minutes, 720)) }
    }),
    post(`${API_PREFIX}/sleep/clear`, async () => ({ cleared: cancelSleepTimer() })),

    // ---- 通知触发入口（外部/调试用）：按开关分发声音与音箱文字 ----
    post(`${API_PREFIX}/notify`, async body => {
      const title = String(body.title ?? '提醒').slice(0, 40)
      const text = String(body.text ?? '').slice(0, 120)
      return dispatchNotify(title, text)
    }),

    ...makeHaloRoutes(),
  ]
}

function rawProviderList(raw: string): ProviderId[] {
  const valid: ProviderId[] = []
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (allProviderIds().includes(trimmed)) valid.push(trimmed)
  }
  return valid.length ? valid : enabledProviderIds()
}

function normalizeQuality(raw: string): Quality {
  const map: Record<string, Quality> = {
    standard: 'standard', exhigh: 'exhigh', lossless: 'lossless', hires: 'hires', jymaster: 'jymaster',
  }
  return map[raw.toLowerCase()] ?? 'exhigh'
}

/** 宽松校验桥命令（工具侧也可直接调 pushCommand，此入口供调试）。 */
function normalizeCommand(body: Record<string, unknown>): BridgeCommand | undefined {
  const type = String(body.type ?? '')
  if (type === 'pause' || type === 'resume' || type === 'next' || type === 'prev') return { type }
  return undefined
}

/** 工具层读取正在播放快照；浏览器 30s 无上报视为不在线，返回 null。 */
export function getNowPlaying(): NowPlayingReport | null {
  const snap = nowPlayingSnapshot()
  return snap.report && !snap.stale ? snap.report : null
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
