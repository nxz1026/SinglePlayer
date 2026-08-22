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

const FONT = '700 24px "Segoe UI", system-ui, -apple-system, sans-serif'
const BASE_COLOR = 'rgba(154,163,199,0.85)'
const HI_COLOR = '#ffffff'
const TRANS_COLOR = '#8be9fd'

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
        ctx!.shadowColor = 'rgba(124,92,255,0.9)'
        ctx!.shadowBlur = 10
        ctx!.fillText(line.text, x, y)
        ctx!.restore()
      }

      // 翻译行（小字，跟随高亮色）
      if (line.translation) {
        ctx!.font = '500 12px "Segoe UI", system-ui, sans-serif'
        ctx!.fillStyle = karaoke && progress > 0.5 ? TRANS_COLOR : 'rgba(139,233,253,0.55)'
        ctx!.textBaseline = 'top'
        ctx!.fillText(line.translation, Math.max(8, (cssW - ctx!.measureText(line.translation).width) / 2), y + 15)
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
      const centerY = cssH / 2 - 6
      const current = index >= 0 ? lines[index] : undefined
      if (current) drawLine(current, index, now, centerY, 1, payload.source === 'yrc-word')
      const nextLine = lines[index + 1]
      if (nextLine && nextLine.text) drawLine(nextLine, index + 1, now, cssH - 14, 0.45, false)
      const prev = index > 0 ? lines[index - 1] : undefined
      if (prev && prev.text) drawLine(prev, index - 1, now, 12, 0.3, false)
    }

    const tick = (): void => { render(); raf = requestAnimationFrame(tick) }
    tick()
    return () => cancelAnimationFrame(raf)
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
