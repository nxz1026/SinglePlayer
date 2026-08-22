/**
 * 歌词解析 —— 移植自 Mineradio 00-lyrics-fetch-parse.js（纯函数，浏览器/Node 通用）：
 * LRC 行级（含一行多时间标签、交错文本）、网易 YRC / QQ QRC 词级、翻译对齐。
 */

import type { LyricPayload } from '../providers/types.ts'

export interface LyricWord {
  text: string
  /** 开始时间（秒）。 */
  t: number
  /** 时长（秒）。 */
  d: number
}

export interface LyricLine {
  t: number
  duration: number
  text: string
  words?: LyricWord[]
  translation?: string
}

function lyricTagTimeToSeconds(min: string, sec: string, frac?: string): number {
  return Number(min) * 60 + Number(sec) + Number(`0.${frac ?? '0'}`)
}

/** 补全每行 duration：下一行起点推断，夹在 [0.45, 12] 秒。 */
export function finalizeLyricLineDurations(lines: LyricLine[]): LyricLine[] {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const next = lines[i + 1]
    const inferred = next && next.t > line.t ? next.t - line.t : 4.8
    if (!Number.isFinite(line.duration) || line.duration <= 0) line.duration = inferred
    line.duration = Math.max(0.45, Math.min(12, line.duration))
  }
  return lines.sort((a, b) => a.t - b.t)
}

const LRC_TAG = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g

/** LRC 行级解析（Mineradio parseLyricText 移植；跳过 JSON 元数据行）。 */
export function parseLyricText(text: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    if (rawLine.trimStart().startsWith('{')) continue // 网易新格式 JSON 元数据行
    const tags: Array<{ t: number; index: number; end: number }> = []
    LRC_TAG.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = LRC_TAG.exec(rawLine)) !== null) {
      const min = m[1] ?? '0'
      const sec = m[2] ?? '0'
      tags.push({ t: lyricTagTimeToSeconds(min, sec, m[3]), index: m.index, end: LRC_TAG.lastIndex })
    }
    if (!tags.length) continue

    let hasInterleavedText = false
    for (let i = 0; i < tags.length - 1; i++) {
      const left = tags[i]
      const right = tags[i + 1]
      if (left && right && rawLine.slice(left.end, right.index).trim()) { hasInterleavedText = true; break }
    }
    if (hasInterleavedText) {
      for (let si = 0; si < tags.length; si++) {
        const tag = tags[si]
        if (!tag) continue
        const nextTag = tags[si + 1]
        const segment = rawLine.slice(tag.end, nextTag ? nextTag.index : rawLine.length).trim()
        if (segment) lines.push({ t: tag.t, duration: 0, text: segment })
      }
      continue
    }
    const txt = rawLine.replace(LRC_TAG, '').trim()
    if (!txt) continue
    for (const tag of tags) lines.push({ t: tag.t, duration: 0, text: txt })
  }
  return finalizeLyricLineDurations(lines)
}

/**
 * 网易 YRC / QQ QRC 词级解析（Mineradio parseYrcText 移植）。
 * 格式：`[行起始ms,行时长ms](词起始ms,词时长ms,0)词文本`
 */
export function parseYrcText(text: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = line.match(/^\[(\d+),(\d+)\](.*)$/)
    if (!m) continue
    const lineStartMs = Number.parseInt(m[1] ?? '0', 10) || 0
    const lineDurMs = Number.parseInt(m[2] ?? '0', 10) || 0
    const body = m[3] ?? ''
    const words: LyricWord[] = []
    let fullText = ''
    const reg = /\((\d+),(\d+),\d+\)([^()]*)/g
    let wm: RegExpExecArray | null
    while ((wm = reg.exec(body)) !== null) {
      const txt = (wm[3] ?? '').replace(/\s+/g, ' ')
      if (!txt) continue
      const rawStart = Number.parseInt(wm[1] ?? '0', 10) || 0
      const rawDur = Number.parseInt(wm[2] ?? '0', 10) || 0
      const absStartMs = rawStart >= lineStartMs - 500 ? rawStart : lineStartMs + rawStart
      fullText += txt
      words.push({ text: txt, t: absStartMs / 1000, d: Math.max(0.06, rawDur / 1000) })
    }
    if (!fullText) fullText = body.replace(/\(\d+,\d+,\d+\)/g, '').replace(/\s+/g, ' ')
    fullText = fullText.replace(/\s+/g, ' ').trim()
    if (!fullText) continue
    lines.push({
      t: lineStartMs / 1000,
      duration: lineDurMs / 1000,
      text: fullText,
      words,
    })
  }
  return finalizeLyricLineDurations(lines)
}

/** 翻译对齐：时间容差匹配。 */
export function attachTranslations(primary: LyricLine[], translations: LyricLine[], tolerance = 0.35): LyricLine[] {
  if (!primary.length || !translations.length) return primary
  let cursor = 0
  for (const line of primary) {
    let best: LyricLine | undefined
    let bestDelta = Infinity
    for (let i = cursor; i < translations.length; i++) {
      const candidate = translations[i]
      if (!candidate) continue
      const delta = Math.abs(candidate.t - line.t)
      if (delta < bestDelta) { bestDelta = delta; best = candidate }
      if (candidate.t > line.t + tolerance && delta > 2) break
    }
    if (best && bestDelta <= tolerance) line.translation = best.text
  }
  return primary
}

export type KaraokeSource = 'yrc-word' | 'line'

export interface KaraokePayload {
  lines: LyricLine[]
  source: KaraokeSource
}

/** 组合最终卡拉OK载荷：yrc/qrc 词级优先，退化为 lrc 行级 + 翻译。 */
export function buildKaraokePayload(lyric: LyricPayload): KaraokePayload {
  const wordLines = parseYrcText(lyric.yrc)
  if (wordLines.some(line => (line.words?.length ?? 0) > 0)) {
    const translations = parseLyricText(lyric.tlyric)
    return { source: 'yrc-word', lines: attachTranslations(wordLines, translations) }
  }
  const lines = parseLyricText(lyric.lrc)
  const translations = parseLyricText(lyric.tlyric)
  return { source: 'line', lines: attachTranslations(lines, translations) }
}
