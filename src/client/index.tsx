/**
 * 单身汉（DSH）播放器 —— 浏览器半。
 * 挂载全局悬浮播放器（宿主全局，跨会话存活，与 dsh-pet 同款挂载策略）。
 * @module dsh-music-huazai/client
 */

import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { Surface } from './PlayerPanel.tsx'
import { startAiBridge } from './player.ts'

/** 浏览器半依赖的服务。 */
export const inject = [] as const

function Fab({ open, onClick }: { open: boolean; onClick: () => void }): React.ReactElement {
  return (
    <>
      <style>{FAB_CSS}</style>
      <button
        type="button"
        className={open ? 'dshm-fab dshm-fab-open' : 'dshm-fab'}
        title="单身汉播放器"
        aria-label="单身汉播放器"
        onClick={onClick}
      >
        {open ? '×' : '♪'}
      </button>
    </>
  )
}

const FAB_CSS = `
.dshm-fab {
  position: fixed; right: 18px; bottom: 18px; z-index: 2147483000;
  width: 44px; height: 44px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,.16);
  background: linear-gradient(135deg, rgba(124,92,255,.85), rgba(56,189,248,.75));
  color: #fff; font-size: 20px; line-height: 1; cursor: pointer;
  box-shadow: 0 6px 24px rgba(0,0,0,.35);
}
.dshm-fab:hover { filter: brightness(1.12); }
.dshm-fab-open { background: linear-gradient(135deg, rgba(56,189,248,.8), rgba(124,92,255,.7)); }
`

function App(): React.ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Fab open={open} onClick={() => setOpen(value => !value)} />
      <Surface open={open} onClose={() => setOpen(false)} />
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
