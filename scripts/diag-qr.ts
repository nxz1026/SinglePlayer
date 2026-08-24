/**
 * 诊断：网易云扫码登录三步（key → create → check）与 QQ 扫码起始。
 * 运行：pnpm exec tsx scripts/diag-qr.ts
 */
import { ncm } from '../src/providers/ncm.ts'
import { qqQrStart } from '../src/providers/qq.ts'

type AnyRecord = Record<string, any>
const lib = ncm as unknown as Record<string, unknown>
function invoke<T = AnyRecord>(fn: unknown, params: AnyRecord): Promise<T> {
  return (fn as (params: AnyRecord) => Promise<T>)(params)
}

async function main(): Promise<void> {
  console.log('== 网易 QR: unikey ==')
  const keyRes = await invoke<AnyRecord>(lib.login_qr_key, { timestamp: Date.now() })
  console.log('body:', JSON.stringify(keyRes.body).slice(0, 300))
  const key = String(keyRes.body?.data?.unikey ?? '')
  console.log('key:', key)

  if (!key) {
    console.log('!! 未拿到 unikey，终止')
    return
  }

  const img = await invoke<AnyRecord>(lib.login_qr_create, { key, qrimg: true, timestamp: Date.now() })
  console.log('create body keys:', Object.keys(img.body?.data ?? {}), 'qrimg len:', String(img.body?.data?.qrimg ?? '').length)

  for (let i = 0; i < 3; i++) {
    const check = await invoke<AnyRecord>(lib.login_qr_check, { key, timestamp: Date.now() })
    console.log(`check#${i}:`, JSON.stringify(check).slice(0, 400))
    await new Promise(r => setTimeout(r, 1500))
  }

  console.log('\n== QQ QR start ==')
  try {
    const qqStart = await qqQrStart()
    console.log('qrsig len:', qqStart.qrsig.length, '| ptLoginSig len:', qqStart.ptLoginSig.length, '| img bytes:', qqStart.img.length)
  } catch (cause) {
    console.log('QQ qr start 失败:', cause instanceof Error ? cause.message : String(cause))
  }
}

void main().catch(cause => {
  console.error('诊断失败:', cause)
  process.exit(1)
})
