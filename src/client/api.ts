/** 宿主 BFF 的类型化 fetch 封装（同源 /api/dsh-music/*）。 */

import type { AuthStatusItem, LyricPayload, SongUrlResult, Track } from '../providers/types.ts'

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
  shuffleMix(): Promise<{ tracks: Track[] }> {
    return get('/shuffle-mix')
  },
  recordPlay(track: Track): void {
    void fetch(`${BASE}/stats/play`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ track }),
    }).catch(() => {})
  },
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
    screenColor?: { r: number; g: number; b: number }
  }
}

/** 经宿主代理的音频地址。 */
export function audioProxyUrl(url: string): string {
  return `${BASE}/audio?url=${encodeURIComponent(url)}`
}

// ---------------------------------------------------------------- 桥

export interface NowPlayingReport {
  trackId: string
  name: string
  artists: string[]
  album: string
  provider: string
  positionSec: number
  durationSec: number
  playing: boolean
}

export interface BridgeCommand {
  type: 'play' | 'pause' | 'resume' | 'next' | 'prev'
  track?: Track
}

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
