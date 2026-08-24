/**
 * 诊断：解码 ptqrshow 返回的二维码内容（jsQR）。
 * 运行：pnpm exec tsx scripts/diag-qq-qr-img.ts
 */
import jsQR from 'jsqr'
import { PNG } from 'pngjs'

const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const APPID = '716027609'
const DAID = '383'
const THIRD_AID = '100497308'

async function fetchQr(extraQuery = ''): Promise<{ buf: Buffer; qrsig: string }> {
  const qrResp = await fetch(
    `https://ssl.ptlogin2.qq.com/ptqrshow?appid=${APPID}&e=2&l=M&s=3&d=72&v=4&t=${Math.random()}&daid=${DAID}&pt_3rd_aid=${THIRD_AID}${extraQuery}`,
    { headers: { 'User-Agent': WEB_UA } },
  )
  const buf = Buffer.from(await qrResp.arrayBuffer())
  const qrsig = qrResp.headers.getSetCookie().map(h => /qrsig=([^;]+)/.exec(h)?.[1]).find(Boolean) ?? ''
  return { buf, qrsig }
}

function decode(buf: Buffer): string {
  try {
    const png = PNG.sync.read(buf)
    const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
    return result?.data ?? '(未检出)'
  } catch (cause) {
    return `(解码失败: ${cause instanceof Error ? cause.message : String(cause)})`
  }
}

async function main(): Promise<void> {
  for (const label of ['当前参数(e=2)', '官方常用(e=0)']) {
    const extra = label.includes('e=0') ? '&rand=' + Math.random() : ''
    // e 参数直接改 URL：e=0 变体单独拼
    const url = label.includes('e=0')
      ? `https://ssl.ptlogin2.qq.com/ptqrshow?appid=${APPID}&e=0&l=M&s=3&d=72&v=4&t=${Math.random()}&daid=${DAID}&pt_3rd_aid=${THIRD_AID}`
      : `https://ssl.ptlogin2.qq.com/ptqrshow?appid=${APPID}&e=2&l=M&s=3&d=72&v=4&t=${Math.random()}&daid=${DAID}&pt_3rd_aid=${THIRD_AID}`
    const resp = await fetch(url, { headers: { 'User-Agent': WEB_UA } })
    const buf = Buffer.from(await resp.arrayBuffer())
    const qrsig = resp.headers.getSetCookie().map(h => /qrsig=([^;]+)/.exec(h)?.[1]).find(Boolean) ?? ''
    console.log(`== ${label} == bytes: ${buf.length} | qrsig: ${qrsig ? 'ok' : '(空)'}`)
    console.log('   内容:', decode(buf))
    void extra
  }
}

void main().catch(cause => {
  console.error('诊断失败:', cause)
  process.exit(1)
})
