/**
 * 卡拉OK歌词视图 —— Canvas2D 逐字染色（移植 Mineradio 同步算法：
 * 二分定位当前行 → 行内词级插值 → 离屏实测词宽占比 → 双色填充）。
 */

import { useEffect, useMemo, useRef } from 'react'
import { audioCurrentTime, isPlaying, usePlayer } from './player.ts'
import { buildKaraokePayload } from '../lyric/parse.ts'
import type { LyricLine } from '../lyric/parse.ts'

/** 词在整行中的像素占比区间（对齐 Mineradio lyricKaraokeWordRanges）。 */
function measureWordRanges(line: LyricLine, font: string): Array<{ p0: number; p1: number }> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx || !line.words?.length) return []
  ctx.font = font
  const widths = line.words.map(word => Math.max(ctx.measureText(word.text).width, 1))
  const total = widths.reduce((sum, width) => sum + width, 0)
  let cursor = 0
  return widths.map(width => {
    const p0 = cursor / total
    cursor += width
    return { p0, p1: cursor / total }
  })
}

/** smoothstep 整行进度（无逐字数据时的退化曲线，Mineradio 同款）。 */
function lineProgress(now: number, line: LyricLine): number {
  const raw = (now - line.t) / Math.max(line.duration || 0.001, 0.001)
  const clamped = Math.max(0, Math.min(1, raw))
  return clamped * clamped * (3 - 2 * clamped)
}

/** 二分定位当前行索引。 */
function findLineIndex(lines: LyricLine[], now: number): number {
  let lo = 0
  let hi = lines.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const candidate = lines[mid]
    if (candidate && candidate.t <= now) { found = mid; lo = mid + 1 }
    else hi = mid - 1
  }
  return found
}

const FONT = '700 20px "Segoe UI", system-ui, -apple-system, sans-serif'
const BASE_COLOR = 'rgba(154,163,199,0.75)'
const HI_COLOR = '#ffffff'

export function Karaoke(): React.ReactElement | null {
  const lyric = usePlayer(s => s.lyric)
  const playing = usePlayer(s => s.playing)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const payload = useMemo(
    () => buildKaraokePayload(lyric),
    [lyric.lrc, lyric.yrc, lyric.tlyric],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.scale(dpr, dpr)

    let raf = 0
    const rangesCache = new Map<number, ReturnType<typeof measureWordRanges>>()

    function wordRanges(index: number, line: LyricLine): ReturnType<typeof measureWordRanges> {
      let ranges = rangesCache.get(index)
      if (!ranges) {
        ranges = measureWordRanges(line, FONT)
        rangesCache.set(index, ranges)
      }
      return ranges ?? []
    }

    /** 单行卡拉OK绘制：返回实际文本宽度。 */
    function drawLine(line: LyricLine, index: number, now: number, y: number, alpha: number, karaoke: boolean): void {
      const words = line.words ?? []
      const hasWords = karaoke && words.length > 0
      const metrics = ctx!.measureText(line.text)
      const x = Math.max(8, (cssW - metrics.width) / 2)
      ctx!.save()
      ctx!.globalAlpha = alpha

      // 基底（暗色整行）
      ctx!.font = FONT
      ctx!.fillStyle = BASE_COLOR
      ctx!.textBaseline = 'middle'
      ctx!.fillText(line.text, x, y)

      // 高亮填充
      let progress: number
      if (!hasWords) progress = lineProgress(now, line)
      else {
        const ranges = wordRanges(index, line)
        progress = 0
        for (let i = 0; i < words.length; i++) {
          const word = words[i]
          const range = ranges[i]
          if (!word || !range) continue
          const wordEnd = word.t + word.d
          if (now >= wordEnd) progress = range.p1
          else if (now >= word.t) {
            const local = (now - word.t) / word.d
            progress = range.p0 + local * (range.p1 - range.p0)
            break
          }
        }
      }
      if (progress > 0.002) {
        const clipWidth = metrics.width * Math.min(progress, 1)
        ctx!.save()
        ctx!.beginPath()
        ctx!.rect(x - 1, y - cssH, clipWidth + 2, cssH * 2)
        ctx!.clip()
        ctx!.fillStyle = HI_COLOR
        ctx!.fillText(line.text, x, y)
        ctx!.restore()
      }
      ctx!.restore()
    }

    function render(): void {
      const now = audioCurrentTime()
      ctx!.clearRect(0, 0, cssW, cssH)
      const lines = payload.lines
      if (!lines.length) {
        ctx!.font = '500 12px system-ui'
        ctx!.fillStyle = 'rgba(154,163,199,0.6)'
        ctx!.textAlign = 'center'
        ctx!.fillText(isPlaying() ? '♪ 无歌词' : '♪ 暂停中', cssW / 2, cssH / 2)
        ctx!.textAlign = 'left'
        return
      }
      const index = findLineIndex(lines, now)
      // 单行模式：只画当前行，垂直居中（界面窄，一行更清爽）。
      const current = index >= 0 ? lines[index] : undefined
      if (current && current.text) drawLine(current, index, now, cssH / 2, 1, payload.source === 'yrc-word')
    }

    let tick: (() => void) | null = null

    function startTick(): void {
      if (tick) return
      tick = (): void => { render(); raf = requestAnimationFrame(tick!) }
      tick()
    }

    function stopTick(): void {
      if (!tick) return
      cancelAnimationFrame(raf)
      tick = null
    }

    // 仅在播放中且有歌词行时运行 rAF
    if (playing && payload.lines.length > 0) {
      startTick()
    }

    // 依赖变化时重新评估是否需要运行
    const handlePlayingChange = () => {
      if (playing && payload.lines.length > 0) startTick()
      else stopTick()
    }

    // 监听 playing 状态变化（通过依赖数组中的 playing 触发重新运行 effect）
    // 但我们也需要在 payload.lines 变化时处理

    return () => {
      stopTick()
    }
  }, [payload, playing])

  if (!lyric.lrc && !lyric.yrc) return null
  return (
    <canvas
      ref={canvasRef}
      className="dshm-karaoke"
      title={payload.source === 'yrc-word' ? '逐字卡拉OK' : '逐行歌词'}
    />
  )
}
