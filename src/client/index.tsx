/**
 * 单身汉（DSH）播放器 —— 浏览器半。
 * 挂载全局悬浮播放器（宿主全局，跨会话存活，与 dsh-pet 同款挂载策略）。
 * @module dsh-music-huazai/client
 */

import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { Fab, readFabPos } from './Fab.tsx'
import type { FabPos } from './Fab.tsx'
import { Surface } from './PlayerPanel.tsx'
import { startAiBridge } from './player.ts'

/** 浏览器半依赖的服务。 */
export const inject = [] as const

function App(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [fabPos, setFabPos] = useState<FabPos>(readFabPos)
  return (
    <>
      <Fab open={open} onClick={() => setOpen(value => !value)} onMove={setFabPos} />
      <Surface open={open} onClose={() => setOpen(false)} anchor={fabPos} />
    </>
  )
}

/** 页面级单例守卫（HMR / 重复激活时防重复挂载）。 */
const MOUNT_FLAG = '__dshMusicHuazaiMounted'

export function apply(ctx: ClientContext): void {
  const globalFlags = globalThis as Record<string, unknown>
  if (globalFlags[MOUNT_FLAG] === true) return
  globalFlags[MOUNT_FLAG] = true

  const container = document.createElement('div')
  container.dataset.dshPlugin = 'dsh-music-huazai'
  document.body.appendChild(container)
  startAiBridge()
  const root = createRoot(container)
  root.render(<App />)
  ctx.effect(() => () => {
    root.unmount()
    container.remove()
    globalFlags[MOUNT_FLAG] = false
  }, 'music: surface')
}
