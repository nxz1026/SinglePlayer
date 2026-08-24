/**
 * 网易云音乐原生实现 —— 零运行时依赖（仅 node:crypto + fetch）。
 * 复刻 NeteaseCloudMusicApi 的 weapi / eapi 加密与请求约定，
 * 供 netease.ts 以一致的 { status, body, cookie } 形态调用。
 */

import {
  createHash,
  createCipheriv,
  publicEncrypt,
  randomBytes,
  constants,
} from 'node:crypto'
import QRCode from 'qrcode'

// ---------------------------------------------------------------- 常量

const IV = '0102030405060708'
const PRESET_KEY = '0CoJUm6Qyw8W8jud'
const EAPI_KEY = 'e82ckenh8dichen8'
const BASE62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const ID_XOR_KEY_1 = '3go8&$8*3*3h0k(2)2'
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`

const DOMAIN = 'https://music.163.com'
const API_DOMAIN = 'https://interface.music.163.com'
const ENCRYPT_RESPONSE = false

const WEAPI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0'
const API_UA = 'NeteaseMusic 9.0.90/5038 (iPhone; iOS 16.2; zh_CN)'

const osMap: Record<string, any> = {
  pc: {
    os: 'pc',
    appver: '3.1.17.204416',
    osver: 'Microsoft-Windows-10-Professional-build-19045-64bit',
    channel: 'netease',
  },
}

// ---------------------------------------------------------------- 匿名 token（eapi 头部需要）

let anonToken = ''
let anonFetching = false

function cloudmusicDllEncodeId(someId: string): string {
  let xored = ''
  for (let i = 0; i < someId.length; i++) {
    const cc = someId.charCodeAt(i) ^ ID_XOR_KEY_1.charCodeAt(i % ID_XOR_KEY_1.length)
    xored += String.fromCharCode(cc)
  }
  return createHash('md5').update(Buffer.from(xored, 'utf8')).digest('base64')
}

async function registerAnonimous(): Promise<string> {
  const deviceId = randomBytes(26).toString('hex')
  const encodedId = Buffer.from(`${deviceId} ${cloudmusicDllEncodeId(deviceId)}`).toString('base64')
  const res = await createRequest('/api/register/anonimous', { username: encodedId }, { crypto: 'weapi', cookie: {} })
  const joined = (res.cookie || []).join('; ')
  const m = joined.match(/MUSIC_A=([^;]+)/)
  return m ? (m[1] ?? '') : ''
}

async function ensureAnon(): Promise<void> {
  if (anonToken || anonFetching) return
  anonFetching = true
  try {
    anonToken = await registerAnonimous()
  } catch {
    anonToken = ''
  } finally {
    anonFetching = false
  }
}

// ---------------------------------------------------------------- 加密原语

function md5(s: string): string {
  return createHash('md5').update(Buffer.from(s, 'utf8')).digest('hex')
}

function aesEncrypt(
  text: string,
  mode: 'cbc' | 'ecb',
  key: string,
  iv: string,
  format: 'base64' | 'hex' = 'base64',
): string {
  const cipher = createCipheriv(
    mode === 'ecb' ? 'aes-128-ecb' : 'aes-128-cbc',
    Buffer.from(key, 'utf8'),
    mode === 'ecb' ? null : Buffer.from(iv, 'utf8'),
  )
  cipher.setAutoPadding(true)
  const enc = Buffer.concat([cipher.update(Buffer.from(text, 'utf8')), cipher.final()])
  return format === 'base64' ? enc.toString('base64') : enc.toString('hex').toUpperCase()
}

function rsaEncrypt(str: string): string {
  const buf = Buffer.from(str, 'utf8')
  // RSA_NO_PADDING 要求输入恰为模长（1024bit → 128 字节）：
  // 必须分配完整 128 字节缓冲、再从尾部写入数据（左补零）。
  // 此前误写成 alloc(128 - buf.length)，偏移越界静默截断，所有 weapi 请求全部失败。
  const padded = Buffer.alloc(128)
  buf.copy(padded, 128 - buf.length)
  const enc = publicEncrypt({ key: PUBLIC_KEY, padding: constants.RSA_NO_PADDING }, padded)
  return enc.toString('hex')
}

function weapi(object: any): { params: string; encSecKey: string } {
  const text = JSON.stringify(object)
  let secretKey = ''
  for (let i = 0; i < 16; i++) secretKey += BASE62.charAt(Math.floor(Math.random() * 62))
  return {
    params: aesEncrypt(aesEncrypt(text, 'cbc', PRESET_KEY, IV), 'cbc', secretKey, IV),
    encSecKey: rsaEncrypt(secretKey.split('').reverse().join('')),
  }
}

function eapi(url: string, object: any): { params: string } {
  const text = JSON.stringify(object)
  const message = `nobody${url}use${text}md5forencrypt`
  const digest = md5(message)
  const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`
  return { params: aesEncrypt(data, 'ecb', EAPI_KEY, '', 'hex') }
}

// ---------------------------------------------------------------- Cookie / 头部

function cookieToJson(cookie: string): any {
  const obj: any = {}
  for (const item of cookie.split(';')) {
    const idx = item.indexOf('=')
    if (idx > 0) {
      const k = item.slice(0, idx).trim()
      const v = item.slice(idx + 1).trim()
      if (k) obj[k] = v
    }
  }
  return obj
}

function cookieObjToString(cookie: any): string {
  return Object.keys(cookie)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(String(cookie[k]))}`)
    .join('; ')
}

const globalDeviceId = randomBytes(26).toString('hex')
const WNMCID = `${randomStr(6)}.${Date.now()}.01.0`

function randomStr(n: number): string {
  const c = 'abcdefghijklmnopqrstuvwxyz'
  let s = ''
  for (let i = 0; i < n; i++) s += c.charAt(Math.floor(Math.random() * c.length))
  return s
}

function processCookieObject(cookie: any, uri: string): any {
  const _ntes_nuid = randomBytes(16).toString('hex')
  const os = osMap[cookie.os] || osMap['pc']
  const processed: any = {
    ...cookie,
    __remember_me: 'true',
    ntes_kaola_ad: '1',
    _ntes_nuid: cookie._ntes_nuid || _ntes_nuid,
    _ntes_nnid: cookie._ntes_nnid || `${_ntes_nuid},${Date.now()}`,
    WNMCID: cookie.WNMCID || WNMCID,
    WEVNSM: cookie.WEVNSM || '1.0.0',
    osver: cookie.osver || os.osver,
    deviceId: cookie.deviceId || globalDeviceId,
    os: cookie.os || os.os,
    channel: cookie.channel || os.channel,
    appver: cookie.appver || os.appver,
  }
  if (uri.indexOf('login') === -1) processed['NMTID'] = randomBytes(8).toString('hex')
  if (!processed.MUSIC_U) processed.MUSIC_A = processed.MUSIC_A || anonToken
  return processed
}

function createHeaderCookie(header: any): string {
  return Object.keys(header)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(String(header[k]))}`)
    .join('; ')
}

function generateRequestId(): string {
  return `${Date.now()}_${String(Math.floor(Math.random() * 1000)).padStart(4, '0')}`
}

// ---------------------------------------------------------------- 请求

interface NcmResult {
  status: number
  body: any
  cookie: string[]
}

async function createRequest(uri: string, data: any, options: any): Promise<NcmResult> {
  let cryptoType: string = options.crypto || ''
  if (cryptoType === '') cryptoType = ENCRYPT_RESPONSE ? 'eapi' : 'api'
  if (cryptoType === 'eapi') await ensureAnon()

  const headers: any = { ...(options.headers || {}) }

  let cookie: any = options.cookie || {}
  if (typeof cookie === 'string') cookie = cookieToJson(cookie)
  if (typeof cookie === 'object') {
    cookie = processCookieObject(cookie, uri)
    headers['Cookie'] = cookieObjToString(cookie)
  }

  const csrfToken = (cookie && cookie['__csrf']) || ''
  let url = ''
  let encryptData: any

  if (cryptoType === 'weapi') {
    headers['Referer'] = options.domain || DOMAIN
    headers['User-Agent'] = options.ua || WEAPI_UA
    data.csrf_token = csrfToken
    encryptData = weapi(data)
    url = (options.domain || DOMAIN) + '/weapi/' + uri.substring(5)
  } else {
    const header: any = {
      osver: cookie.osver,
      deviceId: cookie.deviceId,
      os: cookie.os,
      appver: cookie.appver,
      versioncode: cookie.versioncode || '140',
      mobilename: cookie.mobilename || '',
      buildver: cookie.buildver || String(Date.now()).slice(0, 10),
      resolution: cookie.resolution || '1920x1080',
      __csrf: csrfToken,
      channel: cookie.channel,
      requestId: generateRequestId(),
    }
    if (cookie.MUSIC_U) header['MUSIC_U'] = cookie.MUSIC_U
    if (cookie.MUSIC_A) header['MUSIC_A'] = cookie.MUSIC_A
    headers['Cookie'] = createHeaderCookie(header)
    headers['User-Agent'] = options.ua || API_UA
    data.header = header
    encryptData = eapi(uri, data)
    url = (options.domain || API_DOMAIN) + '/eapi/' + uri.substring(5)
  }

  const bodyStr = new URLSearchParams(encryptData).toString()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  let resp: Response
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyStr,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }

  const setCookie: string[] = (
    typeof (resp.headers as any).getSetCookie === 'function'
      ? (resp.headers as any).getSetCookie()
      : (resp.headers.get('set-cookie')?.split(',') ?? [])
  ).map((x: string) => x.replace(/\s*Domain=[^(;|$)]+;*/g, ''))

  const text = await resp.text()
  let body: any
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }

  const answer: NcmResult = { status: 500, body: {}, cookie: setCookie }
  if (body && body.code) body.code = Number(body.code)
  answer.body = body
  answer.status = Number((body && body.code) || resp.status)

  const SPECIAL = new Set([201, 302, 400, 502, 800, 801, 802, 803])
  if (SPECIAL.has(answer.body.code)) answer.status = 200
  answer.status = answer.status > 100 && answer.status < 600 ? answer.status : 400

  if (answer.status === 200) return answer
  throw answer
}

function createOption(query: any, crypto = ''): any {
  return {
    crypto: query.crypto || crypto || '',
    cookie: query.cookie,
    ua: query.ua || '',
    proxy: query.proxy,
    realIP: query.realIP,
    e_r: query.e_r ?? undefined,
    domain: query.domain || '',
    checkToken: query.checkToken || false,
  }
}

// ---------------------------------------------------------------- 端点（对齐 NeteaseCloudMusicApi module/*）

export const cloudsearch = (query: any) =>
  createRequest(
    '/api/cloudsearch/pc',
    {
      s: query.keywords,
      type: query.type || 1,
      limit: query.limit || 30,
      offset: query.offset || 0,
      total: true,
    },
    createOption(query),
  )

export const song_url_v1 = (query: any) => {
  const data: any = { ids: '[' + query.id + ']', level: query.level, encodeType: 'flac' }
  if (data.level === 'sky') data.immerseType = 'c51'
  return createRequest('/api/song/enhance/player/url/v1', data, createOption(query))
}

export const lyric_new = (query: any) =>
  createRequest(
    '/api/song/lyric/v1',
    { id: query.id, cp: false, tv: 0, lv: 0, rv: 0, kv: 0, yv: 0, ytv: 0, yrv: 0 },
    createOption(query),
  )

export const login_qr_key = async (query: any) => {
  const result = await createRequest('/api/login/qrcode/unikey', { type: 3 }, createOption(query))
  return { status: 200, body: { data: result.body, code: 200 }, cookie: result.cookie }
}

export const login_qr_create = async (query: any) => {
  const platform = query.platform || 'pc'
  let url = `https://music.163.com/login?codekey=${query.key}`
  if (platform === 'web') {
    const chainId = `v1_unknown_${Math.floor(Math.random() * 1e6)}_web_login_${Date.now()}`
    url += `&chainId=${chainId}`
  }
  const qrimg = query.qrimg
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await QRCode.toString(url, { type: 'svg', margin: 1 }))}`
    : ''
  return { code: 200, status: 200, body: { code: 200, data: { qrurl: url, qrimg } } }
}

export const login_qr_check = async (query: any) => {
  const data = { key: query.key, type: 3 }
  try {
    let result = await createRequest('/api/login/qrcode/client/login', data, createOption(query))
    result = {
      status: 200,
      body: { ...result.body, cookie: result.cookie.join(';') },
      cookie: result.cookie,
    }
    return result
  } catch (error: any) {
    return { status: 200, body: {}, cookie: error?.cookie || [] }
  }
}

export const user_account = (query: any) =>
  createRequest('/api/nuser/account/get', {}, createOption(query, 'weapi'))

export const likelist = (query: any) =>
  createRequest('/api/song/like/get', { uid: query.uid }, createOption(query))

export const song_detail = (query: any) => {
  const ids = String(query.ids).split(/\s*,\s*/)
  const data = { c: '[' + ids.map(id => `{"id":${id}}`).join(',') + ']' }
  return createRequest('/api/v3/song/detail', data, createOption(query, 'weapi'))
}

export const playlist_track_all = async (query: any) => {
  const data = { id: query.id, n: 100000, s: query.s || 8 }
  const limit = parseInt(query.limit) || 1000
  const offset = parseInt(query.offset) || 0
  const res = await createRequest('/api/v6/playlist/detail', data, createOption(query))
  const trackIds = res.body?.playlist?.trackIds || []
  const idsData = {
    c: '[' + trackIds.slice(offset, offset + limit).map((item: any) => `{"id":${item.id}}`).join(',') + ']',
  }
  return createRequest('/api/v3/song/detail', idsData, createOption(query))
}

export const toplist = (query: any) => createRequest('/api/toplist', {}, createOption(query))

export const recommend_songs = (query: any) =>
  createRequest('/api/v3/discovery/recommend/songs', {}, createOption(query, 'weapi'))

export const like = (query: any) => {
  const liked = query.like === false ? false : true
  const data = { alg: 'itembased', trackId: query.id, like: liked, time: '3' }
  return createRequest('/api/radio/like', data, createOption(query, 'weapi'))
}

export const song_like_check = (query: any) => {
  const raw = query.ids ?? (query.id != null ? [query.id] : [])
  const ids = Array.isArray(raw) ? raw : [raw]
  return createRequest('/api/song/like/check', { trackIds: ids }, createOption(query))
}

export const ncm = {
  cloudsearch,
  song_url_v1,
  lyric_new,
  login_qr_key,
  login_qr_create,
  login_qr_check,
  user_account,
  likelist,
  song_detail,
  playlist_track_all,
  toplist,
  recommend_songs,
  like,
  song_like_check,
}
