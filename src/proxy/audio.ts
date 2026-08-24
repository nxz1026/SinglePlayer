/**
 * 统一音频代理 —— /api/dsh-music/audio?url=<encoded>
 * 转发 Range、按上游 host 注入 Referer，流式回传。
 * 仅允许播放源域名（网易云、QQ），防 SSRF/开放代理。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

/** 允许代理的音频源 host 后缀白名单（仅播放源：网易云、QQ）。 */
export const ALLOWED_AUDIO_HOSTS = [
  'music.126.net',
  'qq.com',
] as const

/** 判断 host 是否在允许白名单内。 */
export function isAllowedAudioHost(host: string): boolean {
  return ALLOWED_AUDIO_HOSTS.some(allowed => host.endsWith(allowed))
}

/** 上游音频请求头（对齐 Mineradio audioProxyHeadersFor 的关键面）。 */
export function upstreamHeadersFor(url: string, range: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  }
  if (range) headers.Range = range
  let referer = ''
  try {
    const { host } = new URL(url)
    if (host.endsWith('qq.com')) referer = 'https://y.qq.com/'
    else if (host.endsWith('music.126.net')) referer = 'https://music.163.com/'
  } catch {
    return headers
  }
  if (referer) headers.Referer = referer
  return headers
}

const PASSTHROUGH_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
] as const

export async function proxyAudio(req: IncomingMessage, res: ServerResponse, rawUrl: string): Promise<void> {
  let target: URL
  try {
    target = new URL(rawUrl)
  } catch {
    res.writeHead(400).end('bad url')
    return
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    res.writeHead(400).end('bad protocol')
    return
  }
  // 仅允许播放源域名，防 SSRF/开放代理
  if (!isAllowedAudioHost(target.host)) {
    res.writeHead(403).end('forbidden: host not allowed')
    return
  }
  try {
    const upstream = await fetch(target, {
      headers: upstreamHeadersFor(target.toString(), req.headers.range),
      redirect: 'follow',
    })
    const headers: Record<string, string> = { 'cache-control': 'no-store' }
    for (const name of PASSTHROUGH_HEADERS) {
      const value = upstream.headers.get(name)
      if (value) headers[name] = value
    }
    res.writeHead(upstream.status, headers)
    if (!upstream.body || req.method === 'HEAD') {
      res.end()
      return
    }
    await pipelineBody(upstream.body, res)
  } catch (error) {
    if (!res.headersSent) res.writeHead(502)
    res.end(`proxy error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** ReadableStream(Web) → Node 响应。 */
async function pipelineBody(body: ReadableStream<Uint8Array>, res: ServerResponse): Promise<void> {
  const reader = body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!res.write(value)) {
        await new Promise<void>(resolve => { res.once('drain', resolve) })
      }
    }
    res.end()
  } catch (error) {
    res.destroy(error instanceof Error ? error : new Error(String(error)))
  } finally {
    reader.releaseLock()
  }
}
