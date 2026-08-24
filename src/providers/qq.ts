/**
 * QQ 音乐 Provider —— 移植自 Mineradio server.js 的 fcg 直连实现：
 * sha1 签名（qqSearchSign）、移动端搜索、vkey 取流、逐字歌词（qrc）。
 */

import { createHash } from 'node:crypto'
import { loadAuth, saveAuth } from '../store/auth.ts'
import { logInfo, logWarn } from '../log.ts'
import type { LyricPayload, Quality, SongUrlResult, Track } from './types.ts'

type AnyRecord = Record<string, any>

const MUSICU_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg'
const SMARTBOX_URL = 'https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg'
const UA = 'QQMusic 14090508(android 12)'
const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const HEADERS: Record<string, string> = { Referer: 'https://y.qq.com/', 'User-Agent': UA }
const WEB_HEADERS: Record<string, string> = { Referer: 'https://y.qq.com/', 'User-Agent': WEB_UA }

/** 音质候选模板：从目标档位向下回退（对齐 Mineradio QQ_QUALITY_CANDIDATE_TEMPLATES）。 */
const QUALITY_TEMPLATES = [
  { prefix: 'RS01', ext: '.flac', level: 'hires', label: 'Hi-Res FLAC' },
  { prefix: 'F000', ext: '.flac', level: 'lossless', label: '无损 FLAC' },
  { prefix: 'M800', ext: '.mp3', level: 'exhigh', label: '320k MP3' },
  { prefix: 'M500', ext: '.mp3', level: 'standard', label: '128k MP3' },
  { prefix: 'C400', ext: '.m4a', level: 'aac', label: 'AAC/M4A' },
] as const

function normalizeQuality(value: string): string {
  const raw = value.toLowerCase().trim()
  if (['jymaster', 'master', 'studio', 'svip'].includes(raw)) return 'jymaster'
  if (['hires', 'hi-res', 'highres'].includes(raw)) return 'hires'
  if (['lossless', 'flac', 'sq'].includes(raw)) return 'lossless'
  if (['exhigh', 'high', '320', '320k', 'hq'].includes(raw)) return 'exhigh'
  if (['standard', 'normal', '128', '128k', 'std'].includes(raw)) return 'standard'
  return 'hires'
}

function qualityCandidates(target: Quality | string) {
  const normalized = normalizeQuality(target)
  const index = QUALITY_TEMPLATES.findIndex(item => item.level === normalized)
  // jymaster 无对应模板文件名前缀，从 hires 起步。
  return QUALITY_TEMPLATES.slice(index >= 0 ? index : 0)
}

// ---------------------------------------------------------------- cookie

function parseCookieString(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of String(text ?? '').split(';')) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const key = part.slice(0, eq).trim()
    if (!key) continue
    try {
      out[key] = decodeURIComponent(part.slice(eq + 1).trim())
    } catch {
      out[key] = part.slice(eq + 1).trim()
    }
  }
  return out
}

function authCookie(): { text: string; cookie: Record<string, string>; uin: string; key: string } {
  const text = loadAuth().qqCookie
  const cookie = parseCookieString(text)
  const isWechat = !!cookie.wxopenid || Number(cookie.login_type) === 2
  const rawUin = isWechat
    ? (cookie.wxuin ?? cookie.uin ?? cookie.p_uin)
    : (cookie.uin ?? cookie.qqmusic_uin ?? cookie.wxuin ?? cookie.p_uin)
  const digits = String(rawUin ?? '').replace(/\D/g, '')
  const uin = digits.replace(/^0+/, '') || digits || '0'
  const key = cookie.qm_keyst ?? cookie.qqmusic_key ?? cookie.music_key ?? cookie.wxskey ?? cookie.p_skey ?? ''
  return { text, cookie, uin, key }
}

// ---------------------------------------------------------------- http

async function requestText(url: string, init: { method?: string; headers?: Record<string, string>; timeoutMs?: number; body?: string }): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 10_000)
  try {
    const resp = await fetch(url, {
      method: init.method ?? 'GET',
      headers: init.headers,
      body: init.body,
      signal: controller.signal,
    })
    const text = await resp.text()
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text.slice(0, 120)}`)
    return text
  } finally {
    clearTimeout(timer)
  }
}

async function requestJson<T = AnyRecord>(url: string, init: Parameters<typeof requestText>[1]): Promise<T> {
  return JSON.parse(await requestText(url, init)) as T
}

async function webGet(url: string, params: Record<string, string>, referer: string): Promise<AnyRecord> {
  const query = new URLSearchParams(params).toString()
  return requestJson(`${url}${url.includes('?') ? '&' : '?'}${query}`, { headers: { ...WEB_HEADERS, Referer: referer } })
}

/** musicu.fcg 统一入口（带 Cookie）。 */
async function musicu(payload: AnyRecord, useCookie = true): Promise<AnyRecord> {
  const body = JSON.stringify(payload)
  const headers: Record<string, string> = {
    ...HEADERS,
    'Content-Type': 'application/json;charset=UTF-8',
  }
  const { text } = authCookie()
  if (useCookie && text) headers.Cookie = text
  return requestJson(MUSICU_URL, { method: 'POST', headers, body })
}

// ---------------------------------------------------------------- sign

/** Mineradio qqSearchSign 原样移植。 */
function searchSign(text: string): string {
  const hash = createHash('sha1').update(text).digest('hex')
  const part1 = [23, 14, 6, 36, 16, 40, 7, 19].map(index => hash[index]).join('')
  const part2 = [16, 1, 32, 12, 19, 27, 8, 5].map(index => hash[index]).join('')
  const scramble = [89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179]
  const bytes = scramble.map((value, index) => value ^ Number.parseInt(hash.slice(index * 2, index * 2 + 2), 16))
  const middle = Buffer.from(bytes).toString('base64').replace(/[\\/+=]/g, '')
  return `zzc${part1}${middle}${part2}`.toLowerCase()
}

// ---------------------------------------------------------------- mapping

export function albumCover(albumMid: string, size = 300): string {
  if (!albumMid) return ''
  return `https://y.qq.com/music/photo_new/T002R${size}x${size}M000${albumMid}.jpg?max_age=2592000`
}

function mapTrack(raw: AnyRecord): Track | undefined {
  const track = raw ?? {}
  const album: AnyRecord = track.album ?? {}
  const artists = ((track.singer ?? []) as AnyRecord[])
    .map(a => String(a?.name ?? ''))
    .filter(Boolean)
  const mid = String(track.mid ?? '')
  const albumMid = String(album.mid ?? album.pmid ?? '')
  if (!track.name || !mid) return undefined
  return {
    id: `qq:${mid}`,
    provider: 'qq',
    songId: mid,
    name: String(track.name ?? ''),
    artists,
    album: String(album.name ?? ''),
    durationMs: (Number(track.interval) || 0) * 1000,
    cover: albumCover(albumMid),
    vip: Number(track.pay?.pay_play ?? 0) > 0 || Number(track.privilege ?? 0) >= 9,
    mediaMid: String(track.file?.media_mid ?? ''),
  }
}

// ---------------------------------------------------------------- search

interface RawSongItem {
  mid?: string
  songmid?: string
  id?: number | string
  docid?: string
  name?: string
  title?: string
  singer?: string
}

async function smartboxSearch(keyword: string, limit: number): Promise<Track[]> {
  const json = await webGet(SMARTBOX_URL, {
    format: 'json',
    key: keyword,
    g_tk: '5381',
    loginUin: '0',
    hostUin: '0',
    inCharset: 'utf8',
    outCharset: 'utf-8',
    notice: '0',
    platform: 'yqq.json',
    needNewCode: '0',
  }, 'https://y.qq.com/')
  const items: RawSongItem[] = json?.data?.song?.itemlist ?? []
  return items.slice(0, Math.min(limit, 10)).map(item => mapTrack({
    mid: item.mid ?? item.songmid ?? '',
    id: item.id ?? '',
    name: item.name ?? item.title ?? '',
    singer: [{ name: item.singer ?? '' }],
  })).filter((t): t is Track => !!t)
}

async function fullSongSearch(keyword: string, limit: number, offset: number): Promise<Track[]> {
  const pageNumber = Math.floor(offset / limit) + 1
  const payload: AnyRecord = {
    comm: {
      ct: '11', cv: '14090508', v: '14090508', tmeAppID: 'qqmusic',
      phonetype: 'EBG-AN10', os_ver: '12', OpenUDID: '0', QIMEI36: '0',
      udid: '0', chid: '0', aid: '0', oaid: '0', taid: '0', tid: '0',
      wid: '0', uid: '0', sid: '0', modeSwitch: '6', teenMode: '0',
      ui_mode: '2', nettype: '1020',
    },
    req: {
      module: 'music.search.SearchCgiService',
      method: 'DoSearchForQQMusicMobile',
      param: {
        search_type: 0,
        searchid: `${Date.now()}${Math.random()}`.replace('.', '').slice(0, 18),
        query: keyword,
        page_num: pageNumber,
        num_per_page: limit,
        highlight: 0,
        nqc_flag: 0,
        multi_zhida: 0,
        cat: 2,
        grp: 1,
        sin: offset,
        sem: 0,
      },
    },
  }
  const bodyText = JSON.stringify(payload)
  const json = await requestJson<AnyRecord>(
    `https://u.y.qq.com/cgi-bin/musics.fcg?sign=${searchSign(bodyText)}`,
    { method: 'POST', timeoutMs: 10_000, headers: { 'User-Agent': UA, 'Content-Type': 'application/json' }, body: bodyText },
  )
  const data = json?.req?.data
  const body = data?.body ?? data
  const items: AnyRecord[] = Array.isArray(body?.item_song)
    ? body.item_song
    : (Array.isArray(body?.song?.list) ? body.song.list : [])
  return items
    .map(item => mapTrack(item?.track_info ?? item))
    .filter((t): t is Track => !!t)
}

export async function search(keyword: string, limit = 12, offset = 0): Promise<Track[]> {
  const kw = keyword.trim()
  if (!kw) return []
  let base: Track[] = []
  try {
    base = await fullSongSearch(kw, limit, offset)
  } catch {
    // 全量搜索失败时退到联想接口。
  }
  if (!base.length && offset === 0) base = await smartboxSearch(kw, limit)
  const seen = new Set<string>()
  return base.filter(song => {
    if (!song.songId || seen.has(song.songId)) return false
    seen.add(song.songId)
    return true
  })
}

// ---------------------------------------------------------------- song url

/** 轻量探测：Range 取头确认可播（对齐 Mineradio probe 思路的简化版）。 */
async function probePlayable(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)
  try {
    const resp = await fetch(url, { headers: { Range: 'bytes=0-8191' }, signal: controller.signal })
    if (!(resp.status === 200 || resp.status === 206)) return false
    const type = String(resp.headers.get('content-type') ?? '').toLowerCase()
    if (/text\/html|application\/(json|xml)/.test(type)) return false
    const buffer = Buffer.from(await resp.arrayBuffer())
    return buffer.length >= 512 && audioMagic(buffer) !== ''
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function audioMagic(buffer: Buffer): string {
  if (buffer.subarray(0, 3).toString('ascii') === 'ID3') return 'mp3-id3'
  if (buffer.subarray(0, 4).toString('ascii') === 'fLaC') return 'flac'
  if (buffer.subarray(0, 4).toString('ascii') === 'OggS') return 'ogg'
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'mp4'
  const scan = Math.min(buffer.length - 1, 2048)
  for (let i = 0; i < scan; i++) {
    if (buffer[i] === 0xff && (buffer[i + 1]! & 0xe0) === 0xe0) return 'mpeg-frame'
  }
  return ''
}

export async function songUrl(mid: string, quality: Quality | string = 'hires', mediaMidHint = ''): Promise<SongUrlResult> {
  const songmid = mid.trim()
  if (!songmid) return { url: '', reason: 'MISSING_MID' }
  const { uin, key } = authCookie()
  const mediaIds = [...new Set([mediaMidHint.trim(), songmid].filter(Boolean))]
  const candidates = mediaIds.flatMap(mediaId =>
    qualityCandidates(quality).map(item => ({ ...item, mediaId, filename: item.prefix + mediaId + item.ext })),
  )
  const filenames = candidates.map(item => item.filename)
  const param: AnyRecord = {
    guid: String(10000000 + Math.floor(Math.random() * 90000000)),
    songmid: filenames.map(() => songmid),
    songtype: filenames.map(() => 0),
    filename: filenames,
    uin,
    loginflag: 1,
    platform: '20',
  }
  const comm: AnyRecord = { uin, format: 'json', ct: key ? 19 : 24, cv: 0 }
  if (key) comm.authst = key
  const json = await musicu({
    comm,
    req_0: { module: 'vkey.GetVkeyServer', method: 'CgiGetVkey', param },
  })
  const data = json?.req_0?.data
  const infos: AnyRecord[] = Array.isArray(data?.midurlinfo) ? data.midurlinfo : []
  const purls = infos.filter(item => item?.purl)
  const sips: string[] = Array.isArray(data?.sip) && data.sip.length ? data.sip : ['https://ws.stream.qqmusic.qq.com/']
  // 并行探测：每个 purl 的多个 sip 并发，取最快通过者；最多试 2 个 purl，避免 25s 串行阻塞。
  const MAX_PROBE_PURLS = 2
  let probed = 0
  for (const info of purls) {
    if (probed >= MAX_PROBE_PURLS) break
    probed++
    try {
      const url = await Promise.any(sips.map(sip => {
        const candidate = sip + String(info.purl)
        return probePlayable(candidate).then(ok => ok ? candidate : Promise.reject(new Error('unplayable')))
      }))
      const meta = candidates.find(item => item.filename === info.filename)
      return { url, quality: meta?.label ?? info.filename, vipRequired: false }
    } catch {
      continue
    }
  }
  const first = purls[0]
  return {
    url: '',
    reason: first
      ? `QQ_URL_UNAVAILABLE(code=${String(first.result ?? first.code ?? '?')} ${String(first.msg ?? first.tips ?? '')})`
      : 'QQ_URL_EMPTY（未登录或非VIP曲目可能受限）',
    vipRequired: true,
  }
}

// ---------------------------------------------------------------- lyric

function decodeEntities(text: string): string {
  return String(text ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
}

function decodeLyricText(text: unknown): string {
  if (typeof text !== 'string' || !text) return ''
  let raw = decodeEntities(text.trim())
  if (!raw) return ''
  const compact = raw.replace(/\s+/g, '')
  const looksBase64 = compact.length >= 8 && compact.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact)
  if (looksBase64 && !/^\s*\[/.test(raw)) {
    try {
      const decoded = Buffer.from(compact, 'base64').toString('utf8').replace(/^\uFEFF/, '')
      if (decoded && (decoded.includes('[') || /[\u4e00-\u9fa5]/.test(decoded))) raw = decoded
    } catch {
      // 保持原文。
    }
  }
  return decodeEntities(raw).replace(/\r\n/g, '\n').trim()
}

export async function lyric(mid: string, numericId = ''): Promise<LyricPayload> {
  const empty: LyricPayload = { lrc: '', tlyric: '', yrc: '', roma: '' }
  if (!mid) return empty
  try {
    const param: AnyRecord = { songMID: mid }
    const digits = numericId.replace(/\D/g, '')
    if (digits) param.songID = Number(digits)
    const json = await musicu({
      comm: { ct: 24, cv: 0 },
      lyric: { module: 'music.musichallSong.PlayLyricInfo', method: 'GetPlayLyricInfo', param },
    })
    const data = json?.lyric?.data
    return {
      lrc: decodeLyricText(data?.lyric),
      tlyric: decodeLyricText(data?.trans),
      // qrc（逐字）通常仅登录/VIP 可得；无权限时上游返回数字 0。
      yrc: decodeLyricText(data?.qrc),
      roma: decodeLyricText(data?.roma),
    }
  } catch {
    return empty
  }
}

// ---------------------------------------------------------------- cookie / 登录态

/** 从 QQ Cookie 串中提取 uin（用于登录态判断）。 */
export function extractQQUin(cookieText: string): string {
  for (const part of cookieText.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if ((key === 'uin' || key === 'wxuin' || key === 'p_uin') && rest.join('=')) return rest.join('=')
  }
  return ''
}

// ---------------------------------------------------------------- 扫码登录（腾讯 ptlogin，最佳努力）

const QQ_XLOGIN = 'https://xui.ptlogin2.qq.com/cgi-bin/xlogin'
const QQ_QRSHOW = 'https://ssl.ptlogin2.qq.com/ptqrshow'
const QQ_QRLOGIN = 'https://ssl.ptlogin2.qq.com/ptqrlogin'
const QQ_APPID = '716027609'
const QQ_DAID = '383'
const QQ_3RD_AID = '100497308'
const QQ_JUMP = 'https://graph.qq.com/oauth2.0/login_jump'

/** qrsig → ptqrtoken（腾讯 hash33）。 */
function hash33(qrsig: string): number {
  let e = 0
  for (let i = 0; i < qrsig.length; i++) e = (e + ((e << 5) + qrsig.charCodeAt(i))) | 0
  return 2147483647 & e
}

function getSetCookie(resp: Response): string[] {
  const raw = (resp.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.()
  if (Array.isArray(raw)) return raw
  const single = resp.headers.get('set-cookie')
  return single ? single.split(/,(?=[^ ]+?=)/).map(s => s.trim()) : []
}

function mergeSetCookies(merged: Map<string, string>, headers: string[]): void {
  for (const sc of headers) {
    const [kv] = sc.split(';')
    if (!kv) continue
    const idx = kv.indexOf('=')
    if (idx <= 0) continue
    const key = kv.slice(0, idx).trim()
    if (!key) continue
    let value = kv.slice(idx + 1).trim()
    try { value = decodeURIComponent(value) } catch { /* 保持原文 */ }
    merged.set(key, value)
  }
}

/** 手动跟随重定向，收集整条链路上所有 set-cookie（undici 默认只给最后一跳）。 */
async function collectCookies(startUrl: string, seedCookie: string): Promise<Map<string, string>> {
  const merged = new Map<string, string>()
  for (const [k, v] of Object.entries(parseCookieString(seedCookie))) merged.set(k, v)
  const cookieHeader = (): string => [...merged].map(([k, v]) => `${k}=${v}`).join('; ')
  let url = startUrl
  for (let i = 0; i < 6; i++) {
    const resp = await fetch(url, {
      headers: { Cookie: cookieHeader(), 'User-Agent': WEB_UA, Referer: 'https://y.qq.com/' },
      redirect: 'manual',
    })
    mergeSetCookies(merged, getSetCookie(resp))
    const loc = resp.headers.get('location')
    if (!loc || resp.status < 300 || resp.status >= 400) break
    url = new URL(loc, url).href
  }
  return merged
}

export interface QqQrStartResult {
  qrsig: string
  ptLoginSig: string
  img: string
}

/** 获取 QQ 扫码二维码（返回 base64 图 + 轮询所需签名）。 */
export async function qqQrStart(): Promise<QqQrStartResult> {
  const xloginReferer = 'https://xui.ptlogin2.qq.com/'
  const xlogin = await fetch(
    `${QQ_XLOGIN}?appid=${QQ_APPID}&daid=${QQ_DAID}&style=33&login_text=授权并登录`
    + `&hide_title_bar=1&hide_border=1&target=self&s_url=${encodeURIComponent(QQ_JUMP)}&pt_3rd_aid=${QQ_3RD_AID}`,
    { headers: { 'User-Agent': WEB_UA } },
  )
  const ptLoginSig = getSetCookie(xlogin).map(h => /pt_login_sig=([^;]+)/.exec(h)?.[1]).find(Boolean) ?? ''
  // 官方浏览器流程：ptqrshow 携带 xlogin 下发的 pt_login_sig Cookie 与 Referer。
  // 缺失时二维码在 ptlogin 轮询侧仍显示「未失效」，
  // 但手机端扫码校验走更严格的登记表，会把这种「孤儿码」判为已过期。
  const qrCookie = ptLoginSig ? `pt_login_sig=${ptLoginSig}` : ''
  const qr = await fetch(
    `${QQ_QRSHOW}?appid=${QQ_APPID}&e=2&l=M&s=3&d=72&v=4&t=${Math.random()}&daid=${QQ_DAID}&pt_3rd_aid=${QQ_3RD_AID}`,
    {
      headers: {
        'User-Agent': WEB_UA,
        Referer: xloginReferer,
        ...(qrCookie ? { Cookie: qrCookie } : {}),
      },
    },
  )
  const buf = Buffer.from(await qr.arrayBuffer())
  const qrsig = getSetCookie(qr).map(h => /qrsig=([^;]+)/.exec(h)?.[1]).find(Boolean) ?? ''
  return { qrsig, ptLoginSig, img: `data:image/png;base64,${buf.toString('base64')}` }
}

export interface QqQrCheckResult {
  phase: 'waiting' | 'scanned' | 'expired' | 'success' | 'error'
  note?: string
}

/** 轮询扫码状态；成功则换取 QQ 音乐凭证并落库。 */
export async function qqQrCheck(qrsig: string, ptLoginSig: string): Promise<QqQrCheckResult> {
  if (!qrsig || !ptLoginSig) return { phase: 'error', note: '缺少二维码参数，请重新获取' }
  const ptqrtoken = hash33(qrsig)
  const url = `${QQ_QRLOGIN}?u1=${encodeURIComponent(QQ_JUMP)}&ptqrtoken=${ptqrtoken}`
    + `&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052&action=0-0-${Date.now()}`
    + `&js_ver=20052116&js_type=1&login_sig=${encodeURIComponent(ptLoginSig)}&pt_uistyle=40`
    + `&aid=${QQ_APPID}&daid=${QQ_DAID}&pt_3rd_aid=${QQ_3RD_AID}&has_onekey=1`
  // 轮询必须携带 qrsig Cookie（oicq/官方流程同款）；缺了部分网关会直接判失效。
  const resp = await fetch(url, {
    headers: {
      Referer: 'https://xui.ptlogin2.qq.com/',
      'User-Agent': WEB_UA,
      Cookie: `qrsig=${qrsig}; pt_login_sig=${ptLoginSig}`,
    },
  })
  const text = await resp.text()
  logInfo(`[qq] qr check raw: ${text.slice(0, 240)}`)
  // 解析 ptuiCB 状态码（0=成功，65=过期，67=已扫待确认；最可靠）。
  // 首参可能带或不带引号（ptuiCB('65',…) / ptuiCB(66,…)!），正则须两者兼容。
  const codeMatch = text.match(/ptuiCB\(\s*'?(\d+)'?/)
  const code = codeMatch ? codeMatch[1] : ''
  if (code === '65' || /二维码已经失效|已失效/.test(text)) return { phase: 'expired' }
  if (code === '67' || /二维码认证中|等待.*确认/.test(text)) return { phase: 'scanned' }
  // 成功回调一定带跳转 URL；用 URL 兜底判定成功，文案/状态码随时会变。
  const jumpUrl = (text.match(/https?:\/\/[^\s'")]+/) ?? [])[0] ?? ''
  const uin = (text.match(/[?&]uin=([^&'")]+)/) ?? [])[1] ?? ''
  if (code === '0' || /登录成功/.test(text) || jumpUrl) {
    try {
      const merged = await collectCookies(jumpUrl || 'https://y.qq.com/', uin ? `uin=${uin}` : '')
      const keys = ['uin', 'p_uin', 'p_skey', 'p_luin', 'p_lskey', 'qm_keyst', 'qqmusic_key', 'music_key', 'wxskey', 'skey', 'luin', 'lskey']
      const cookie = keys.filter(k => merged.has(k)).map(k => `${k}=${merged.get(k)}`).join('; ')
      const hasMusicKey = merged.has('qm_keyst') || merged.has('music_key') || merged.has('qqmusic_key')
      // 已有更完整的 Cookie（含音乐凭证）时不覆盖，避免扫码基础态把会员权益冲掉。
      const existing = loadAuth().qqCookie
      const existingHasKey = /(?:qm_keyst|music_key|qqmusic_key)=/.test(existing)
      if (hasMusicKey || !existingHasKey) {
        saveAuth({ qqCookie: cookie })
        return {
          phase: 'success',
          note: hasMusicKey
            ? '已获取 QQ 音乐登录凭证'
            : '已扫码登录（基础态）；VIP 曲目若无法播放，请在账号页粘贴完整 Cookie',
        }
      }
      return { phase: 'success', note: '扫码仅获基础登录态，已保留原有完整 Cookie（会员权益不受影响）' }
    } catch (cause) {
      logWarn(`[qq] 扫码成功但换取凭证异常：${cause instanceof Error ? cause.message : String(cause)}`)
      // 手机已确认登录：即便凭证换取失败也不要卡死，提示用户用粘贴 Cookie 补全。
      return { phase: 'success', note: '扫码已确认，但换取 QQ 音乐凭证失败，请在账号页粘贴完整 Cookie' }
    }
  }
  return { phase: 'waiting' }
}

// ---------------------------------------------------------------- Provider 契约

import type { MusicProvider } from './types.ts'

/** QQ 音乐 MusicProvider 实现（向 registry 注册）。 */
export const qqProvider: MusicProvider = {
  id: 'qq',
  label: 'QQ 音乐',
  description: '移植自 Mineradio fcg 直连 + sha1 签名',
  search,
  songUrl: (id, quality, extra) => songUrl(id, quality, extra?.mediaMid ?? ''),
  lyric: (id, extra) => lyric(id, extra?.numericId ?? ''),
  authStatus: async () => {
    const cookie = loadAuth().qqCookie
    const uin = cookie ? extractQQUin(cookie) : ''
    return { provider: 'qq', loggedIn: !!uin }
  },
}
