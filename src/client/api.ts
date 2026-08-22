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
  songUrl(id: string, quality = 'exhigh', mediaMid?: string): Promise<SongUrlResult> {
    const media = mediaMid ? `&mediaMid=${encodeURIComponent(mediaMid)}` : ''
    return get(`/url?id=${encodeURIComponent(id)}&quality=${quality}${media}`)
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
}

/** 经宿主代理的音频地址。 */
export function audioProxyUrl(url: string): string {
  return `${BASE}/audio?url=${encodeURIComponent(url)}`
}
