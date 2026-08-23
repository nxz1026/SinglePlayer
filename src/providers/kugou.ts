/**
 * 酷狗音乐 Provider —— 轻量直连（移动端公开接口 + md5 签名取流），
 * 零外部依赖，复用 node:crypto / fetch。仅匿名可用，不支持登录态。
 */

import { createHash } from 'node:crypto'
import type { AuthStatusItem, LyricPayload, MusicProvider, Quality, SongUrlResult, Track } from './types.ts'

type AnyRecord = Record<string, any>

const UA = 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'
const HEADERS: Record<string, string> = { 'User-Agent': UA, Referer: 'https://www.kugou.com/' }

function reqText(url: string, timeoutMs = 10_000): Promise<string> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), timeoutMs)
  return fetch(url, { headers: HEADERS, signal: c.signal })
    .then(r => r.text())
    .finally(() => clearTimeout(t))
}

function reqJson<T = AnyRecord>(url: string, timeoutMs = 10_000): Promise<T> {
  return reqText(url, timeoutMs).then(t => JSON.parse(t) as T)
}

function md5(text: string): string {
  return createHash('md5').update(text).digest('hex')
}

function cover(url: string): string {
  if (!url) return ''
  return url.startsWith('//') ? `https:${url}` : url
}

function mapTrack(s: AnyRecord): Track | undefined {
  const hash = String(s.hash ?? '')
  if (!hash || !s.songname) return undefined
  const artists = String(s.singername ?? s.singer ?? '')
    .split(/[/、,，]/)
    .map(a => a.trim())
    .filter(Boolean)
  const dur = Number(s.duration) || 0
  const durationMs = dur > 10000 ? dur : dur * 1000
  const albumId = String(s.album_id ?? '')
  return {
    id: `kugou:${hash}`,
    provider: 'kugou',
    songId: hash,
    name: String(s.songname),
    artists,
    album: String(s.album_name ?? s.album ?? ''),
    durationMs,
    cover: albumId ? `https://img2.kugou.com/albumimg/150/${albumId}.jpg` : '',
  }
}

export async function search(keyword: string, limit = 20, offset = 0): Promise<Track[]> {
  const kw = keyword.trim()
  if (!kw) return []
  const page = Math.floor(offset / limit) + 1
  const url = `https://mobiles.kugou.com/api/v3/search/song?keyword=${encodeURIComponent(kw)}&page=${page}&pagesize=${limit}&format=json&plat=2&version=7910&area_code=1`
  try {
    const json = await reqJson<AnyRecord>(url)
    const list: AnyRecord[] = json?.data?.info ?? []
    return list.map(mapTrack).filter((t): t is Track => !!t)
  } catch {
    return []
  }
}

const KG_APPKEY = 'NVPhm6kzbTO1j6MmQvJsmxoNbQuW9pC9bc08tTTxwYB8wGaEwPzZxZyUW8WiBlMBaY1VZ1ZeBzpNYDZzf7Z0z0'
function kgSign(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .sort()
    .map(k => k + params[k])
    .join('')
  return md5(KG_APPKEY + sorted)
}

export async function songUrl(hash: string, _quality: Quality = 'standard'): Promise<SongUrlResult> {
  const clean = hash.trim()
  if (!clean) return { url: '', reason: 'MISSING_HASH' }
  // 移动端播放信息接口（免签名）。
  const mobileUrl = `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${clean}&from=web`
  try {
    const json = await reqJson<AnyRecord>(mobileUrl)
    const url = String(json?.url ?? '').trim()
    if (url) return { url: url.startsWith('//') ? `https:${url}` : url, quality: 'standard' }
  } catch { /* fallthrough */ }
  // 桌面端 getdata（带签名）。
  const params: Record<string, string> = {
    r: 'play/getdata',
    hash: clean,
    appid: '1014',
    mid: '000000000000',
    platid: '4',
    dfid: '-',
    _: String(Date.now()),
  }
  const sig = kgSign(params)
  const desktopUrl = `https://www.kugou.com/yy/index.php?${new URLSearchParams({ ...params, signature: sig }).toString()}`
  try {
    const json = await reqJson<AnyRecord>(desktopUrl)
    const url = String(json?.data?.play_url ?? '').trim()
    if (url) return { url: url.startsWith('//') ? `https:${url}` : url, quality: 'standard' }
  } catch { /* ignore */ }
  return { url: '', reason: 'KUGOU_URL_UNAVAILABLE' }
}

export async function lyric(hash: string): Promise<LyricPayload> {
  const empty: LyricPayload = { lrc: '', tlyric: '', yrc: '', roma: '' }
  const clean = hash.trim()
  if (!clean) return empty
  try {
    const json = await reqJson<AnyRecord>(`https://www.kugou.com/yy/index.php?r=play/getdata&hash=${clean}&appid=1014&platid=4`)
    return { ...empty, lrc: String(json?.data?.lyrics ?? '') }
  } catch {
    return empty
  }
}

export async function authStatus(): Promise<AuthStatusItem> {
  return { provider: 'kugou', loggedIn: false }
}

export const kugouProvider: MusicProvider = {
  id: 'kugou',
  label: '酷狗音乐',
  description: '移动端公开接口直连（匿名）',
  search,
  songUrl,
  lyric,
  authStatus,
}
