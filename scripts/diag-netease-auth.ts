/**
 * 诊断：验证已保存的网易云 Cookie 是否仍有效。
 * 运行：pnpm exec tsx scripts/diag-netease-auth.ts
 */
import * as netease from '../src/providers/netease.ts'
import { ncm } from '../src/providers/ncm.ts'
import { loadAuth } from '../src/store/auth.ts'

async function main(): Promise<void> {
  const status = await netease.authStatus()
  console.log('authStatus:', JSON.stringify(status))

  const dirty = loadAuth().neteaseCookie
  const lib = ncm as unknown as Record<string, (q: Record<string, unknown>) => Promise<{ body: Record<string, unknown> }>>
  try {
    const res = await lib.user_account({ cookie: dirty })
    const profile = (res.body as Record<string, unknown>)?.profile
    console.log('user_account profile:', profile ? JSON.stringify(profile).slice(0, 200) : JSON.stringify(res.body).slice(0, 200))
  } catch (cause) {
    const body = (cause as { body?: unknown })?.body
    console.log('user_account 异常:', body ? JSON.stringify(body).slice(0, 200) : String(cause))
  }
}

void main()
