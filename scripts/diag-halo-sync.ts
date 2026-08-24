/**
 * 诊断：HaloSync 全链路（加载 node-hid → 连接 → 下发文字）。
 * 运行：pnpm exec tsx scripts/diag-halo-sync.ts
 */
import { getHaloSync } from '../src/halo/sync.ts'

async function main(): Promise<void> {
  const halo = getHaloSync()
  halo.setConfig({ enabled: true })
  // 给 connect() 一点时间
  await new Promise(resolve => setTimeout(resolve, 1500))
  const st = halo.status() as Record<string, unknown>
  console.log('connected:', st.connected, '| simulated:', st.simulated, '| devices:', st.devices)
  console.log('hidError:', st.hidError || '(无)')
  console.log('connectError:', st.connectError || '(无)')
  if (st.connected && !st.simulated) {
    const ok = await halo.onNotify('花再修复验证 OK')
    console.log('notify 写入:', ok)
    await new Promise(resolve => setTimeout(resolve, 800))
    halo.onPlayState(true)
    halo.onLyric('测试歌词行：晴天的旋律')
    console.log('lyric 行已下发')
    halo.onPlayState(false)
  }
}

void main()
