/**
 * 单身汉（DSH）播放器 —— 浏览器半。
 * 挂载全局悬浮播放器面板（宿主全局，跨会话存活，与 dsh-pet 同款挂载策略）。
 * M1 先落骨架：悬浮按钮 + 玻璃拟态小面板 + 宿主健康检查回显。
 * @module dsh-music-huazai/client
 */

import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

/** 浏览器半依赖的服务。 */
export const inject = [] as const

interface Health {
  ok: boolean
  plugin?: string
  version?: string
  milestone?: string
}

async function fetchHealth(): Promise<Health> {
  const res = await fetch('/api/dsh-music/health')
  if (!res.ok) throw new Error(`health ${res.status}`)
  return (await res.json()) as Health
}

function Panel({ open }: { open: boolean }) {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    fetchHealth().then(
      value => { if (alive) { setHealth(value); setError(null) } },
      cause => { if (alive) setError(cause instanceof Error ? cause.message : String(cause)) },
    )
    return () => { alive = false }
  }, [open])

  if (!open) return null
  return (
    <div className="dshm-panel">
      <div className="dshm-panel-title">单身汉播放器</div>
      <div className="dshm-panel-sub">DSH 插件化音乐播放器</div>
      <div className="dshm-panel-status">
        {error !== null
          ? <span className="dshm-bad">宿主未连接（{error}）</span>
          : health === null
            ? <span className="dshm-dim">连接中…</span>
            : (
                <span className="dshm-good">
                  宿主已连接 · v{health.version ?? '?'} · {health.milestone ?? ''}
                </span>
              )}
      </div>
    </div>
  )
}

function Surface() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <style>{CSS}</style>
      <Panel open={open} />
      <button
        type="button"
        className={open ? 'dshm-fab dshm-fab-open' : 'dshm-fab'}
        title="单身汉播放器"
        aria-label="单身汉播放器"
        onClick={() => setOpen(value => !value)}
      >
        {open ? '×' : '♪'}
      </button>
    </>
  )
}

const CSS = `
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
.dshm-panel {
  position: fixed; right: 18px; bottom: 70px; z-index: 2147483000;
  width: 240px; padding: 14px 16px; border-radius: 14px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(18,20,30,.82);
  backdrop-filter: blur(14px) saturate(1.3);
  color: #eef1ff; font-size: 13px;
  box-shadow: 0 12px 40px rgba(0,0,0,.45);
}
.dshm-panel-title { font-size: 15px; font-weight: 700; letter-spacing: .5px; }
.dshm-panel-sub { margin-top: 2px; opacity: .65; font-size: 11px; }
.dshm-panel-status { margin-top: 10px; font-size: 12px; }
.dshm-good { color: #6ee7a8; }
.dshm-bad { color: #ff8f8f; }
.dshm-dim { opacity: .55; }
`

/** 页面级单例守卫（HMR / 重复激活时防重复挂载）。 */
const MOUNT_FLAG = '__dshMusicHuazaiMounted'

export function apply(ctx: ClientContext): void {
  const globalFlags = globalThis as Record<string, unknown>
  if (globalFlags[MOUNT_FLAG] === true) return
  globalFlags[MOUNT_FLAG] = true

  const container = document.createElement('div')
  container.dataset.dshPlugin = 'dsh-music-huazai'
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(<Surface />)
  ctx.effect(() => () => {
    root.unmount()
    container.remove()
    globalFlags[MOUNT_FLAG] = false
  }, 'music: surface')
}
