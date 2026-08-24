/** 宿主 BFF 的类型化 fetch 封装（同源 /api/dsh-music/*）。 */

import type { AuthStatusItem, BridgeCommand, LyricPayload, NowPlayingReport, SongUrlResult, Track } from '../providers/types.ts'

const BASE = '/api/dsh-music'

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(BASE + path, init)
  const payload = (await resp.json().catch(() => ({}))) as Record<string, unknown>
  if (!resp.ok || payload.ok !== true) {
    throw new Error(typeof payload.error === 'string' ? payload.error : `HTTP ${resp.status}`)
  }
  return payload as T
}

function get<T>(path: string): Promise<T> {
  return requestJson<T>(path)
}

function post<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export interface SearchResponse {
  tracks: Track[]
}

export const api = {
  search(keyword: string, limit = 20, offset = 0): Promise<SearchResponse> {
    return get(`/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}&offset=${offset}`)
  },
  async songUrl(id: string, quality = 'exhigh', mediaMid?: string): Promise<SongUrlResult> {
    const media = mediaMid ? `&mediaMid=${encodeURIComponent(mediaMid)}` : ''
    // 路由包装为 { ok, result }，必须解包 result。
    const payload = await get<{ result?: SongUrlResult }>(`/url?id=${encodeURIComponent(id)}&quality=${quality}${media}`)
    return payload.result ?? { url: '', reason: '空响应' }
  },
  lyric(id: string): Promise<{ lyric: LyricPayload }> {
    return get(`/lyric?id=${encodeURIComponent(id)}`)
  },
  authStatus(): Promise<{ providers: AuthStatusItem[] }> {
    return get('/auth/status')
  },
  neteaseQrStart(): Promise<{ key: string }> {
    return post('/auth/netease/qr', {})
  },
  neteaseQrCreate(key: string): Promise<{ img: string; url: string }> {
    return get(`/auth/netease/qr/create?key=${encodeURIComponent(key)}`)
  },
  neteaseQrCheck(key: string): Promise<{
    qr: { code: number; message: string; nickname?: string; avatar?: string }
  }> {
    return get(`/auth/netease/qr/check?key=${encodeURIComponent(key)}`)
  },
  qqCookieSave(cookie: string): Promise<{ saved: boolean }> {
    return post('/auth/qq', { cookie })
  },
  qqQrStart(): Promise<{ qrsig: string; ptLoginSig: string; img: string }> {
    return post('/auth/qq/qr', {})
  },
  qqQrCheck(qrsig: string, ptLoginSig: string): Promise<{ qr: { phase: string; note?: string } }> {
    return get(`/auth/qq/qr/check?qrsig=${encodeURIComponent(qrsig)}&ptLoginSig=${encodeURIComponent(ptLoginSig)}`)
  },
  neteaseLike(songId: string, like: boolean): Promise<{ liked: boolean }> {
    return post('/like/set', { id: `netease:${songId}`, liked: like })
  },
  neteaseLikeCheck(songId: string): Promise<{ liked: boolean }> {
    return get(`/like/check?id=${encodeURIComponent(`netease:${songId}`)}`)
  },
  haloStatus(): Promise<{ halo: HaloStatus }> {
    return get('/halo/status')
  },
  haloSetConfig(config: Record<string, unknown>): Promise<{ config: Record<string, unknown> }> {
    return post('/halo/config', { config })
  },
  getPluginSettings(): Promise<{ settings: PluginSettings }> {
    return get('/settings')
  },
  savePluginSettings(patch: Partial<PluginSettings>): Promise<{ settings: PluginSettings }> {
    return post('/settings/save', { settings: patch })
  },
  scheduleStatus(): Promise<ScheduleStatus> {
    return get('/schedule')
  },
  alarmAdd(time: string, keyword: string, label?: string): Promise<{ alarm: AlarmItem }> {
    return post('/alarm/add', { time, keyword, label })
  },
  alarmRemove(id: string): Promise<{ removed: boolean }> {
    return post('/alarm/remove', { id })
  },
  sleepSet(minutes: number): Promise<{ remainingSec?: number; endsAt?: number }> {
    return post('/sleep/set', { minutes })
  },
  sleepClear(): Promise<{ cleared: boolean }> {
    return post('/sleep/clear', {})
  },
  async notifySoundInfo(): Promise<{ exists: boolean; ext?: string; bytes?: number }> {
    return get('/notify/sound/info')
  },
  /** 上传自定义提示音：原始二进制，服务端按魔数校验格式。 */
  async uploadNotifySound(file: File): Promise<{ exists: boolean; ext: string; bytes: number }> {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase()
    const resp = await fetch(`${BASE}/notify/sound/upload?ext=${encodeURIComponent(ext)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: file,
    })
    const payload = (await resp.json().catch(() => ({}))) as Record<string, unknown>
    if (!resp.ok || payload.ok !== true) {
      throw new Error(typeof payload.error === 'string' ? payload.error : `HTTP ${resp.status}`)
    }
    return payload as { exists: boolean; ext: string; bytes: number }
  },
  async resetNotifySound(): Promise<void> {
    await fetch(`${BASE}/notify/sound/reset`, { method: 'POST' })
  },
  shuffleMix(): Promise<{ tracks: Track[] }> {
    return get('/shuffle-mix')
  },
  recommend(): Promise<{ sections: Array<{ source: string; title: string; tracks: Track[] }> }> {
    return get('/recommend')
  },
  chartTracks(id = '3778678', limit = 50): Promise<{ tracks: Track[] }> {
    return get(`/chart?id=${encodeURIComponent(id)}&limit=${limit}`)
  },
  getLists(): Promise<{ lists: LibraryList[]; recent: Track[]; plays: Record<string, { count: number; lastAt: number }> }> {
    return get('/lists')
  },
  createList(name: string): Promise<{ list: LibraryList }> {
    return post('/list/create', { name })
  },
  deleteList(id: string): Promise<{ deleted: boolean }> {
    return post('/list/delete', { id })
  },
  addToList(id: string, track: Track): Promise<{ added: boolean }> {
    return post('/list/add', { id, track })
  },
  removeFromList(id: string, trackId: string): Promise<{ removed: boolean }> {
    return post('/list/remove', { id, trackId })
  },
  recordPlay(track: Track): void {
    void fetch(`${BASE}/stats/play`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ track }),
    }).catch(() => {})
  },
  listProviders(): Promise<{ providers: ProviderInfo[] }> {
    return get('/providers')
  },
  toggleProvider(id: string, enabled: boolean): Promise<{ id: string; enabled: boolean }> {
    return post('/providers/toggle', { id, enabled })
  },
}

/** 音乐源管理项（运行时启停）。 */
export interface ProviderInfo {
  id: string
  label: string
  description: string
  enabled: boolean
}

export interface HaloStatus {
  enabled: boolean
  connected: boolean
  simulated: boolean
  playing: boolean
  devices: number
  config?: {
    align?: string
    dynamicScroll?: boolean
    idleClockWhenPaused?: boolean
    maxCharsPerLine?: number
    notifyDurationSec?: number
    screenColor?: { r: number; g: number; b: number }
  }
}

/** 插件设置（通知 / 定时 / 反向推送开关）。 */
export interface PluginSettings {
  notifySound: boolean
  notifyHaloText: boolean
  schedulerEnabled: boolean
  reversePushEnabled: boolean
  enabledProviders?: string[]
}

/** 音乐闹钟。 */
export interface AlarmItem {
  id: string
  time: string
  keyword: string
  label?: string
}

export interface ScheduleStatus {
  alarms: AlarmItem[]
  sleepRemainingSec: number
  schedulerEnabled: boolean
}

export interface LibraryList {
  id: string
  name: string
  kind: 'favorites' | 'custom'
  tracks: Track[]
}

/** 本地红心列表的固定 id（与宿主 library.json 对应）。 */
export const FAV_LIST_ID = 'fav'

/** 经宿主代理的音频地址。 */
export function audioProxyUrl(url: string): string {
  return `${BASE}/audio?url=${encodeURIComponent(url)}`
}

// ---------------------------------------------------------------- 桥

export async function bridgeReport(report: NowPlayingReport): Promise<void> {
  await fetch(`${BASE}/bridge/report`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nowPlaying: report }),
  }).catch(() => {})
}

export async function bridgePoll(): Promise<BridgeCommand[]> {
  try {
    const resp = await fetch(`${BASE}/bridge/poll`)
    const payload = (await resp.json()) as { commands?: BridgeCommand[] }
    return payload.commands ?? []
  } catch {
    return []
  }
}
