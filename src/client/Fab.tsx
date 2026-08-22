/**
 * 悬浮球 —— 可拖动的播放器开关（Pointer Events，位置持久化到 localStorage）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface FabPos {
  x: number
  y: number
}

export const FAB_SIZE = 44

const VIEW_PAD = 8
const POS_KEY = 'dshm-fab-pos'
const DRAG_THRESHOLD = 4

interface DragState {
  pointerX: number
  pointerY: number
  baseX: number
  baseY: number
  moved: boolean
}

/** 把坐标限制在视口内。 */
export function clampFabPos(x: number, y: number): FabPos {
  const maxX = Math.max(VIEW_PAD, window.innerWidth - FAB_SIZE - VIEW_PAD)
  const maxY = Math.max(VIEW_PAD, window.innerHeight - FAB_SIZE - VIEW_PAD)
  return {
    x: Math.min(Math.max(VIEW_PAD, x), maxX),
    y: Math.min(Math.max(VIEW_PAD, y), maxY),
  }
}

function defaultFabPos(): FabPos {
  return clampFabPos(window.innerWidth - FAB_SIZE - 18, window.innerHeight - FAB_SIZE - 18)
}

export function readFabPos(): FabPos {
  try {
    const raw = JSON.parse(localStorage.getItem(POS_KEY) ?? '') as Partial<FabPos> | null
    if (raw && typeof raw.x === 'number' && typeof raw.y === 'number') return clampFabPos(raw.x, raw.y)
  } catch {
    // 无存档或数据损坏：用默认位置。
  }
  return defaultFabPos()
}

const FAB_CSS = `
.dshm-fab {
  position: fixed; z-index: 2147483000;
  width: 44px; height: 44px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,.16);
  background: linear-gradient(135deg, rgba(124,92,255,.85), rgba(56,189,248,.75));
  color: #fff; font-size: 20px; line-height: 1; cursor: grab;
  box-shadow: 0 6px 24px rgba(0,0,0,.35);
  touch-action: none; user-select: none; -webkit-user-select: none;
}
.dshm-fab:active { cursor: grabbing; }
.dshm-fab:hover { filter: brightness(1.12); }
.dshm-fab-open { background: linear-gradient(135deg, rgba(56,189,248,.8), rgba(124,92,255,.7)); }
`

export function Fab({ open, onClick, onMove }: {
  open: boolean
  onClick: () => void
  onMove: (pos: FabPos) => void
}): React.ReactElement {
  const [pos, setPos] = useState<FabPos>(readFabPos)
  const posRef = useRef(pos)
  const dragRef = useRef<DragState | null>(null)

  const commit = useCallback((next: FabPos): void => {
    posRef.current = next
    setPos(next)
    onMove(next)
  }, [onMove])

  useEffect(() => {
    const onResize = (): void => commit(clampFabPos(posRef.current.x, posRef.current.y))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [commit])

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      baseX: posRef.current.x,
      baseY: posRef.current.y,
      moved: false,
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current
    if (!drag) return
    const dx = event.clientX - drag.pointerX
    const dy = event.clientY - drag.pointerY
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    drag.moved = true
    commit(clampFabPos(drag.baseX + dx, drag.baseY + dy))
  }

  const handlePointerUp = (): void => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.moved) {
      try { localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)) } catch { /* 尽力而为 */ }
      return
    }
    onClick()
  }

  return (
    <>
      <style>{FAB_CSS}</style>
      <button
        type="button"
        className={open ? 'dshm-fab dshm-fab-open' : 'dshm-fab'}
        title="单身汉播放器（可拖动）"
        aria-label="单身汉播放器"
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { dragRef.current = null }}
      >
        {open ? '×' : '♪'}
      </button>
    </>
  )
}
