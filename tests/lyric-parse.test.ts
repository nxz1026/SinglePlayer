/**
 * 歌词解析纯函数单元测试 —— 使用 tsx + assert 运行：
 * pnpm exec tsx tests/lyric-parse.test.ts
 */

import { ok, deepEqual, strictEqual } from 'node:assert/strict'
import {
  parseLyricText,
  parseYrcText,
  attachTranslations,
  buildKaraokePayload,
  finalizeLyricLineDurations,
} from '../src/lyric/parse.ts'
import type { LyricPayload } from '../src/providers/types.ts'

let passed = 0
let failed = 0
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`  ✅ ${name}`) }
  catch (e) { failed++; console.error(`  ❌ ${name}: ${e}`) }
}

// ---------------------------------------------------------------- LRC

test('parseLyricText: basic timestamps', () => {
  const lrc = '[00:01.00]line1\n[00:02.50]line2\n[00:04.00]line3'
  const lines = parseLyricText(lrc)
  strictEqual(lines.length, 3)
  strictEqual(lines[0]!.text, 'line1')
  strictEqual(lines[0]!.t, 1)
  strictEqual(lines[1]!.text, 'line2')
  strictEqual(lines[1]!.t, 2.5)
  strictEqual(lines[2]!.text, 'line3')
  strictEqual(lines[2]!.t, 4)
})

test('parseLyricText: empty input', () => {
  strictEqual(parseLyricText('').length, 0)
})

test('parseLyricText: skip JSON metadata lines', () => {
  const lrc = '{"t":123}\n[00:01.00]hello'
  const lines = parseLyricText(lrc)
  strictEqual(lines.length, 1)
  strictEqual(lines[0]!.text, 'hello')
})

test('parseLyricText: multiple timestamps per line', () => {
  const lrc = '[00:01.00][00:02.00]repeat'
  const lines = parseLyricText(lrc)
  strictEqual(lines.length, 2)
  strictEqual(lines[0]!.t, 1)
  strictEqual(lines[1]!.t, 2)
})

test('parseLyricText: interleaved text between tags', () => {
  const lrc = '[00:01.00]part1[00:02.50]part2'
  const lines = parseLyricText(lrc)
  // interleaved: each tag segment becomes a separate line
  ok(lines.length >= 2)
  strictEqual(lines[0]!.text, 'part1')
  strictEqual(lines[1]!.text, 'part2')
})

test('parseLyricText: duration inference', () => {
  const lrc = '[00:01.00]a\n[00:05.00]b'
  const lines = parseLyricText(lrc)
  // inferred from next line: 5-1=4s
  ok(lines.length >= 2)
  ok(lines[0]!.duration >= 3.5 && lines[0]!.duration <= 4.5)
})

// ---------------------------------------------------------------- YRC

test('parseYrcText: basic word-level', () => {
  const yrc = '[1000,3000](0,500,0)word1(500,500,0)word2'
  const lines = parseYrcText(yrc)
  strictEqual(lines.length, 1)
  strictEqual(lines[0]!.t, 1)
  strictEqual(lines[0]!.duration, 3)
  strictEqual(lines[0]!.text, 'word1word2')
  ok(lines[0]!.words)
  strictEqual(lines[0]!.words!.length, 2)
  strictEqual(lines[0]!.words![0]!.text, 'word1')
  strictEqual(lines[0]!.words![1]!.text, 'word2')
})

test('parseYrcText: empty input', () => {
  strictEqual(parseYrcText('').length, 0)
})

test('parseYrcText: malformed line skipped', () => {
  strictEqual(parseYrcText('just some text').length, 0)
})

// ---------------------------------------------------------------- translation alignment

test('attachTranslations: basic matching', () => {
  const primary = [{ t: 1, duration: 2, text: 'hello' }]
  const translations = [{ t: 1.1, duration: 0, text: '你好' }]
  const result = attachTranslations(primary, translations)
  strictEqual(result[0]!.translation, '你好')
})

test('attachTranslations: no match beyond tolerance', () => {
  const primary = [{ t: 1, duration: 2, text: 'hello' }]
  const translations = [{ t: 10, duration: 0, text: '你好' }]
  const result = attachTranslations(primary, translations)
  strictEqual(result[0]!.translation, undefined)
})

// ---------------------------------------------------------------- Karaoke payload

test('buildKaraokePayload: yrc-word source when yrc available', () => {
  const payload: LyricPayload = {
    lrc: '[00:01.00]test',
    tlyric: '',
    yrc: '[1000,2000](0,500,0)hello',
    roma: '',
  }
  const karaoke = buildKaraokePayload(payload)
  strictEqual(karaoke.source, 'yrc-word')
  ok(karaoke.lines.length > 0)
  ok((karaoke.lines[0]?.words?.length ?? 0) > 0)
})

test('buildKaraokePayload: line source fallback when no yrc words', () => {
  const payload: LyricPayload = {
    lrc: '[00:01.00]test',
    tlyric: '',
    yrc: '',
    roma: '',
  }
  const karaoke = buildKaraokePayload(payload)
  strictEqual(karaoke.source, 'line')
})

// ---------------------------------------------------------------- duration finalization

test('finalizeLyricLineDurations: clamps extreme values', () => {
  const lines = [{ t: 0, duration: 0, text: 'a' }]
  const result = finalizeLyricLineDurations(lines)
  ok(result[0]!.duration >= 0.45)
  ok(result[0]!.duration <= 12)
})

test('finalizeLyricLineDurations: sorts by t', () => {
  const lines = [{ t: 3, duration: 0, text: 'b' }, { t: 1, duration: 0, text: 'a' }]
  const result = finalizeLyricLineDurations(lines)
  strictEqual(result[0]!.text, 'a')
  strictEqual(result[1]!.text, 'b')
})

// ---------------------------------------------------------------- summary

console.log(`\n📊 ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)