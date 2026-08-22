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

export async function songUrl(songId: string, quality: Quality = 'hires'): Promise<SongUrlResult> {
  const id = songId.replace(/\D/g, '')
  if (!id) return { url: '', reason: 'MISSING_ID' }
  const result = await invoke<NcmResult>(lib.song_url_v1, {
    id,
    level: LEVELS[quality] ?? 'exhigh',
    cookie: loadAuth().neteaseCookie || undefined,
  })
  const data: AnyRecord | undefined = result.body?.data?.[0]
  const url = String(data?.url ?? '')
  if (!url) {
    return { url: '', vipRequired: true, reason: `NETEASE_URL_UNAVAILABLE(code=${String(result.body?.code ?? '?')})` }
  }
  const trial = data?.freeTrialInfo != null
  const level = String(data?.level ?? quality)
  return { url, quality: level, trial, vipRequired: trial }
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
 * 803 时持久化 Cookie 并回带昵称。
 */
export async function qrCheck(key: string): Promise<
  { code: 800 | 801 | 802 | 803; message: string; nickname?: string; avatar?: string }
> {
  let r = await invoke<NcmResult>(lib.login_qr_check, { key, noCookie: true, timestamp: Date.now() })
  let code = Number(r.body?.code ?? 0)
  if (code === 803) {
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
