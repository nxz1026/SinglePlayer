/**
 * 诊断：验证取消勾选「启用歌词同步」时音响恢复时钟。
 * 运行：pnpm exec tsx scripts/diag-halo-toggle.ts
 */
import { getHaloSync } from '../src/halo/sync.ts'

async function main(): Promise<void> {
  const halo = getHaloSync()
  halo.setConfig({ enabled: true })
  await new Promise(r => setTimeout(r, 1200))
  const on = halo.status() as Record<string, unknown>
  console.log('开启后 connected:', on.connected)

  const cfg = halo.setConfig({ enabled: false })
  await new Promise(r => setTimeout(r, 300))
  const off = halo.status() as Record<string, unknown>
  console.log('取消勾选后 connected:', off.connected, '| 配置 enabled:', (cfg as { enabled?: boolean }).enabled)
}

void main()
