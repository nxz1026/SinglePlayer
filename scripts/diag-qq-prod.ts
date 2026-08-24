/**
 * 诊断：走生产代码验证 QQ 扫码（qqQrStart → qqQrCheck 轮询）。
 * 运行：pnpm exec tsx scripts/diag-qq-prod.ts
 */
import { qqQrCheck, qqQrStart } from '../src/providers/qq.ts'

async function main(): Promise<void> {
  const start = await qqQrStart()
  console.log('qrsig:', start.qrsig ? `ok(${start.qrsig.length})` : '(空!)',
    '| ptLoginSig:', start.ptLoginSig ? `ok(${start.ptLoginSig.length})` : '(空!)',
    '| img bytes:', start.img.length)

  for (let i = 0; i < 4; i++) {
    const qr = await qqQrCheck(start.qrsig, start.ptLoginSig)
    console.log(`poll#${i}:`, JSON.stringify(qr))
    await new Promise(r => setTimeout(r, 4000))
  }
}

void main().catch(cause => {
  console.error('诊断失败:', cause)
  process.exit(1)
})
