/**
 * 网易云音乐 Provider —— 基于 NeteaseCloudMusicApi 包（进程内函数调用），
 * 调用约定对齐 Mineradio server.js：cloudsearch / song_url_v1 / lyric_new / login_qr_*。
 */

import ncmPackage from 'NeteaseCloudMusicApi'
import { loadAuth, saveAuth } from '../store/auth.ts'
import type { AuthStatusItem, LyricPayload, Quality, SongUrlResult, Track } from './types.ts'

type AnyRecord = Record<string, any>

/** 包为 CJS 动态导出，取默认导出后按名解构。 */
const lib = ncmPackage as unknown as Record<string, unknown>

/** 库的 TS 类型偏窄（timestamp/noCookie 运行时合法），统一走宽松调用。 */
function invoke<T = AnyRecord>(fn: unknown, params: AnyRecord): Promise<T> {
  return (fn as (params: AnyRecord) => Promise<T>)(params)
}

/** 库的返回形态：{ status, body, cookie }。 */
interface NcmResult {
  status: number
  body: AnyRecord
  cookie?: string[] | string
}

/** level 词表 → song_url_v1 的 level 参数。 */
const LEVELS: Record<Quality, string> = {
  standard: 'standard',
  exhigh: 'exhigh',
  lossless: 'lossless',
  hires: 'hires',
  jymaster: 'jymaster',
}

/** 统一曲目映射（对齐 Mineradio mapSongRecord）。 */
export function mapTrack(s: AnyRecord): Track | undefined {
  if (!s || !s.id) return undefined
  const artists = (s.ar ?? s.artists ?? [])
    .map((a: AnyRecord) => String(a?.name ?? ''))
    .filter(Boolean)
  const album = s.al ?? s.album ?? {}
  return {
    id: `netease:${s.id}`,
    provider: 'netease',
    songId: String(s.id),
    name: String(s.name ?? ''),
    artists,
    album: String(album.name ?? ''),
    durationMs: Number(s.dt ?? s.duration ?? 0) || 0,
    cover: String(album.picUrl ?? ''),
    vip: Number(s.fee ?? 0) === 1,
  }
}

export async function search(keyword: string, limit = 12, offset = 0): Promise<Track[]> {
  const kw = keyword.trim()
  if (!kw) return []
  const result = await invoke<NcmResult>(lib.cloudsearch, {
    keywords: kw,
    type: 1,
    limit,
    offset,
    cookie: loadAuth().neteaseCookie || undefined,
    timestamp: Date.now(),
  })
  const songs: unknown[] = result.body?.result?.songs ?? []
  return songs.map(song => mapTrack(song as AnyRecord)).filter((t): t is Track => !!t)
}

/** 匿名/非 VIP 账号在高音质档常拿不到直链，逐级降档重试。 */
const LEVEL_FALLBACK: Record<string, string[]> = {
  jymaster: ['hires', 'lossless', 'exhigh', 'standard'],
  hires: ['lossless', 'exhigh', 'standard'],
  lossless: ['exhigh', 'standard'],
  exhigh: ['standard'],
  standard: [],
}

export async function songUrl(songId: string, quality: Quality = 'hires'): Promise<SongUrlResult> {
  const id = songId.replace(/\D/g, '')
  if (!id) return { url: '', reason: 'MISSING_ID' }
  const cookie = loadAuth().neteaseCookie || undefined
  const requested = LEVELS[quality] ?? 'exhigh'
  const levels = [requested, ...LEVEL_FALLBACK[requested] ?? []]
  let lastBodyCode = '?'
  for (const level of levels) {
    const result = await invoke<NcmResult>(lib.song_url_v1, {
      id,
      level,
      cookie,
      timestamp: Date.now(),
    })
    const data: AnyRecord | undefined = result.body?.data?.[0]
    lastBodyCode = String(result.body?.code ?? '?')
    const url = String(data?.url ?? '')
    if (!url) continue
    return {
      url,
      quality: String(data?.level ?? level),
      trial: data?.freeTrialInfo != null,
      vipRequired: data?.freeTrialInfo != null,
    }
  }
  return {
    url: '',
    vipRequired: true,
    reason: `NETEASE_URL_UNAVAILABLE(code=${lastBodyCode}，已尝试 ${levels.join('→')}）`,
  }
}

export async function lyric(songId: string): Promise<LyricPayload> {
  const id = songId.replace(/\D/g, '')
  const empty: LyricPayload = { lrc: '', tlyric: '', yrc: '', roma: '' }
  if (!id) return empty
  try {
    const result = await invoke<NcmResult>(lib.lyric_new, { id, cookie: loadAuth().neteaseCookie || undefined })
    const body = result.body ?? {}
    const pick = (block: unknown): string => {
      const text = (block as AnyRecord | undefined)?.lyric
      return typeof text === 'string' ? text : ''
    }
    return {
      lrc: pick(body.lrc),
      tlyric: pick(body.tlyric),
      yrc: pick(body.yrc),
      roma: pick(body.romalrc),
    }
  } catch {
    return empty
  }
}

/** 发起扫码登录：返回 unikey。 */
export async function qrKeyStart(): Promise<string> {
  const r = await invoke<NcmResult>(lib.login_qr_key, { timestamp: Date.now() })
  return String(r.body?.data?.unikey ?? '')
}

/** 生成二维码（base64 dataURL）。 */
export async function qrImage(key: string): Promise<{ img: string; url: string }> {
  const r = await invoke<NcmResult>(lib.login_qr_create, { key, qrimg: true, timestamp: Date.now() })
  const d = r.body?.data ?? {}
  return { img: String(d.qrimg ?? ''), url: String(d.qrurl ?? '') }
}

/** 从库响应中收集 Set-Cookie 为完整 Cookie 串。 */
function collectCookie(r: NcmResult): string {
  const raw = r.cookie
  if (Array.isArray(raw)) return raw.join('; ')
  return typeof raw === 'string' ? raw : ''
}

/**
 * 轮询扫码状态：800 过期 / 801 等待 / 802 已扫 / 803 成功。
 * 803 且尚未拿到 Cookie 时重试一次以捕获 Set-Cookie。
 */
export async function qrCheck(key: string): Promise<
  { code: 800 | 801 | 802 | 803; message: string; nickname?: string; avatar?: string }
> {
  let r = await invoke<NcmResult>(lib.login_qr_check, { key, noCookie: true, timestamp: Date.now() })
  let code = Number(r.body?.code ?? 0)
  if (code === 803 && !collectCookie(r)) {
    // noCookie 模式下部分部署不回 set-cookie，重试一次拿 Cookie。
    const retry = await invoke<NcmResult>(lib.login_qr_check, { key, timestamp: Date.now() })
    const retryCookie = collectCookie(retry)
    if (retryCookie) r = retry
    code = Number(r.body?.code ?? code)
  }
  const message = String(r.body?.message ?? r.body?.msg ?? '')
  if (code !== 803) return { code: (code || 801) as 800 | 801 | 802 | 803, message }

  const cookie = collectCookie(r)
  if (cookie) saveAuth({ neteaseCookie: cookie })
  const profile = r.body?.profile ?? {}
  return { code: 803, message: message || '登录成功', nickname: profile.nickname, avatar: profile.avatarUrl }
}

export async function authStatus(): Promise<AuthStatusItem> {
  const item: AuthStatusItem = { provider: 'netease', loggedIn: false }
  const cookie = loadAuth().neteaseCookie
  if (!cookie) return item
  try {
    const r = await invoke<NcmResult>(lib.user_account, { cookie })
    const profile = r.body?.profile
    if (profile?.nickname) {
      item.loggedIn = true
      item.nickname = String(profile.nickname)
      item.avatar = String(profile.avatarUrl ?? '')
      const vipType = Number(r.body?.account?.vipType ?? 0)
      item.vipLabel = vipType >= 11 ? 'SVIP' : vipType > 0 ? 'VIP' : '无VIP'
    }
  } catch {
    item.loggedIn = false
  }
  return item
}

/** 红心收藏（需登录）；同时失效红心缓存。 */
export async function like(songId: string, liked: boolean): Promise<{ liked: boolean }> {
  const cookie = loadAuth().neteaseCookie
  if (!cookie) throw new Error('网易云未登录')
  await invoke(lib.like, { id: songId.replace(/\D/g, ''), like: liked, cookie, timestamp: Date.now() })
  invalidateLikesCache()
  return { liked }
}

/** 查询红心状态。 */
export async function likeCheck(songId: string): Promise<{ liked: boolean }> {
  const cookie = loadAuth().neteaseCookie
  if (!cookie) return { liked: false }
  try {
    const r = await invoke<NcmResult>(lib.song_like_check, { id: songId.replace(/\D/g, ''), cookie })
    const songs: AnyRecord[] = Array.isArray(r.body?.songs) ? r.body.songs : []
    return { liked: songs[0]?.liked === true }
  } catch {
    return { liked: false }
  }
}

/** 红心曲目缓存（点赞/取消后失效）。 */
let likesCacheAt = 0
let likesCacheTracks: Track[] = []

function invalidateLikesCache(): void {
  likesCacheAt = 0
  likesCacheTracks = []
}

/** 已登录用户的红心歌曲全量（未登录返回空；5 分钟缓存，并行分块拉取）。 */
export async function likedTracks(max = 300): Promise<Track[]> {
  const cookie = loadAuth().neteaseCookie
  if (!cookie) return []
  if (likesCacheTracks.length && Date.now() - likesCacheAt < 300_000) {
    return likesCacheTracks.slice(0, max)
  }
  try {
    const account = await invoke<NcmResult>(lib.user_account, { cookie })
    const uid = String(account.body?.account?.id ?? '')
    if (!uid) return []
    const likes = await invoke<NcmResult>(lib.likelist, { uid, cookie })
    const rawIds: unknown = likes.body?.ids ?? likes.body?.chunk?.slice?.(-1)?.[0]?.ids
    const ids: string[] = Array.isArray(rawIds) ? rawIds.map(String).slice(0, max) : []
    // song_detail 支持大批量逗号 id；按 200 一块并行请求。
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200))
    const details = await Promise.all(
      chunks.map(chunk =>
        invoke<NcmResult>(lib.song_detail, { ids: chunk.join(','), cookie }).catch(() => null),
      ),
    )
    const out: Track[] = []
    for (const detail of details) {
      if (!detail) continue
      const songs: AnyRecord[] = Array.isArray(detail.body?.songs) ? detail.body.songs : []
      for (const song of songs) {
        const track = mapTrack(song)
        if (track) out.push(track)
      }
    }
    likesCacheAt = Date.now()
    likesCacheTracks = out
    return out
  } catch {
    return []
  }
}

/** 匿名可用的公开榜单曲目。 */
export async function chartTracksById(chartId: string, limit = 60): Promise<Track[]> {
  try {
    const r = await invoke<NcmResult>(lib.playlist_track_all, { id: chartId, limit, timestamp: Date.now() })
    const songs: AnyRecord[] = Array.isArray(r.body?.songs) ? r.body.songs : []
    return songs.map(song => mapTrack(song)).filter((t): t is Track => !!t)
  } catch {
    return []
  }
}

/** 官方榜单目录（匿名可用）—— 推荐区的随机候选池。 */
export async function toplist(): Promise<Array<{ id: string; name: string }>> {
  try {
    const r = await invoke<NcmResult>(lib.toplist, { timestamp: Date.now() })
    const list: AnyRecord[] = Array.isArray(r.body?.list) ? r.body.list : []
    return list
      .map(item => ({ id: String(item?.id ?? ''), name: String(item?.name ?? '') }))
      .filter(item => item.id && item.name)
  } catch {
    return []
  }
}

/** 登录用户的每日个性化推荐（需登录）。 */
export async function dailyRecommend(): Promise<Track[]> {
  const cookie = loadAuth().neteaseCookie
  if (!cookie) return []
  try {
    const r = await invoke<NcmResult>(lib.recommend_songs, { cookie, timestamp: Date.now() })
    const songs: AnyRecord[] = Array.isArray(r.body?.data?.dailySongs) ? r.body.data.dailySongs : []
    return songs.map(song => mapTrack(song)).filter((t): t is Track => !!t)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------- Provider 契约

import type { MusicProvider } from './types.ts'

/** 网易云 MusicProvider 实现（向 registry 注册，供 routes/tools/merge 统一取用）。 */
export const neteaseProvider: MusicProvider = {
  id: 'netease',
  label: '网易云音乐',
  description: '基于 NeteaseCloudMusicApi（进程内直连）',
  search,
  songUrl: (id, quality) => songUrl(id, quality),
  lyric,
  authStatus,
  dailyRecommend,
  chartTracksById,
  likedTracks,
}
