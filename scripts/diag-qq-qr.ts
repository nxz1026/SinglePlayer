/**
 * 诊断：QQ 二维码生命周期 —— 生成后立即轮询，观察是否「生下来就过期」。
 * 运行：pnpm exec tsx scripts/diag-qq-qr.ts [variant]
 * variant: bare（现状：不带 Cookie）| bound（带 pt_login_sig Cookie）
 */
import { createRequire } from 'node:module'

const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const APPID = '716027609'
const DAID = '383'
const THIRD_AID = '100497308'
const JUMP = 'https://graph.qq.com/oauth2.0/login_jump'

function hash33(s: string): number {
  let e = 0
  for (let i = 0; i < s.length; i++) e = (e + ((e << 5) + s.charCodeAt(i))) | 0
  return 2147483647 & e
}

function setCookies(resp: Response): string[] {
  const raw = (resp.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.()
  return Array.isArray(raw) ? raw : resp.headers.get('set-cookie') ? [resp.headers.get('set-cookie') as string] : []
}

async function main(): Promise<void> {
  const variant = process.argv[2] ?? 'bare'
  console.log(`== 变体: ${variant} ==`)

  const xloginResp = await fetch(
    `https://xui.ptlogin2.qq.com/cgi-bin/xlogin?appid=${APPID}&daid=${DAID}&style=33&login_text=授权并登录`
    + `&hide_title_bar=1&hide_border=1&target=self&s_url=${encodeURIComponent(JUMP)}&pt_3rd_aid=${THIRD_AID}`,
    { headers: { 'User-Agent': WEB_UA } },
  )
  const ptLoginSig = setCookies(xloginResp).map(h => /pt_login_sig=([^;]+)/.exec(h)?.[1]).find(Boolean) ?? ''
  await xloginResp.arrayBuffer().catch(() => Buffer.alloc(0))
  console.log('pt_login_sig:', ptLoginSig ? `ok(${ptLoginSig.length})` : '(空!)')

  const qrHeaders: Record<string, string> = {
    'User-Agent': WEB_UA,
    Referer: 'https://xui.ptlogin2.qq.com/',
  }
  if (variant === 'bound' && ptLoginSig) qrHeaders.Cookie = `pt_login_sig=${ptLoginSig}`
  const qrResp = await fetch(
    `https://ssl.ptlogin2.qq.com/ptqrshow?appid=${APPID}&e=2&l=M&s=3&d=72&v=4&t=${Math.random()}&daid=${DAID}&pt_3rd_aid=${THIRD_AID}`,
    { headers: qrHeaders },
  )
  const qrsig = setCookies(qrResp).map(h => /qrsig=([^;]+)/.exec(h)?.[1]).find(Boolean) ?? ''
  const img = Buffer.from(await qrResp.arrayBuffer())
  console.log('qrsig:', qrsig ? `ok(${qrsig.length})` : '(空!)', '| 图片字节:', img.length, '| content-type:', qrResp.headers.get('content-type'))

  if (!qrsig) {
    console.log('无 qrsig，终止')
    return
  }

  // 立即开始轮询：正常应先回 66（未扫描），约 90~120 秒后才 65（过期）。
  const pollHeaders: Record<string, string> = {
    Referer: 'https://xui.ptlogin2.qq.com/',
    'User-Agent': WEB_UA,
    Cookie: variant === 'bound' ? `qrsig=${qrsig}; pt_login_sig=${ptLoginSig}` : `qrsig=${qrsig}`,
  }
  const started = Date.now()
  for (let i = 0; i < 12; i++) {
    const url = `https://ssl.ptlogin2.qq.com/ptqrlogin?u1=${encodeURIComponent(JUMP)}&ptqrtoken=${hash33(qrsig)}`
      + `&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052&action=0-0-${Date.now()}`
      + `&js_ver=20052116&js_type=1&login_sig=${encodeURIComponent(ptLoginSig)}&pt_uistyle=40`
      + `&aid=${APPID}&daid=${DAID}&pt_3rd_aid=${THIRD_AID}&has_onekey=1`
    const resp = await fetch(url, { headers: pollHeaders })
    const text = await resp.text()
    const code = /ptuiCB\(\s*'?(\d+)'?/.exec(text)?.[1] ?? '?'
    console.log(`t+${String(((Date.now() - started) / 1000).toFixed(0)).padStart(3)}s poll#${i}: code=${code} | ${text.slice(0, 110).replace(/\s+/g, ' ')}`)
    if (code === '0' || code === '65') break
    await new Promise(r => setTimeout(r, 5000))
  }
}

void main().catch(cause => {
  console.error('诊断失败:', cause)
  process.exit(1)
})
