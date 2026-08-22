/**
 * M4 歌词解析冒烟测试：LRC / YRC / 翻译对齐 / 卡拉OK载荷选择。
 * 运行：pnpm exec tsx scripts/smoke-m4.ts
 */
import { buildKaraokePayload, parseLyricText, parseYrcText } from '../src/lyric/parse.ts'
import type { LyricPayload } from '../src/providers/types.ts'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(`FAIL: ${label}`)
  console.log('  ✓', label)
}

// 1. LRC 基础
const lrc = parseLyricText('[00:01.50]晴天\n[00:05.00]故事的小黄花\n[00:09.20][01:10.00]重复行')
assert(lrc.length === 4, `LRC 多时间标签展开为多行（${lrc.length}）`)
assert(Math.abs((lrc[0]?.t ?? -1) - 1.5) < 0.001, '时间解析正确')
assert(lrc.every(line => line.duration > 0), 'duration 已补全')

// 2. LRC 一行多标签交错文本
const inter = parseLyricText('[00:01.00]左[00:02.00]右')
assert(inter.length === 2, '交错文本拆分')

// 3. YRC 词级
const yrc = parseYrcText('[1770,3980](1770,500,0)故(2270,560,0)事(2830,1150,0)的(4100,600,0)小')
assert(yrc.length === 1 && yrc[0]?.words?.length === 4, `YRC 解析出词级时间轴（${yrc[0]?.words?.length ?? 0} 词）`)
assert(yrc[0]?.words?.[1]?.t === 2.27, '词起始毫秒→秒')
assert(yrc[0]?.text === '故事的小', `行文本重组（"${yrc[0]?.text}"）`)

// 4. 载荷优先级：yrc 有词 → yrc-word；否则 lrc
const withWords: LyricPayload = { lrc: '', tlyric: '[00:02.30]story', yrc: yrcText(), roma: '' }
function yrcText(): string {
  return '[2000,2000](2000,1000,0)hello(3000,900,0)world'
}
const payloadWord = buildKaraokePayload(withWords)
assert(payloadWord.source === 'yrc-word', '词级载荷优先')
assert(payloadWord.lines[0]?.translation === 'story', '翻译按时间对齐到词级行')

const onlyLrc: LyricPayload = { lrc: '[00:03.00]line a\n[00:07.00]line b', tlyric: '', yrc: '', roma: '' }
const payloadLine = buildKaraokePayload(onlyLrc)
assert(payloadLine.source === 'line' && payloadLine.lines.length === 2, '退化为行级')

// 5. 网易 JSON 元数据行被跳过
const jsonJunk = parseLyricText('{"c":[{"tx":"作词"}]}\n[00:04.00]正常行')
assert(jsonJunk.length === 1 && jsonJunk[0]?.text === '正常行', 'JSON 元数据行过滤')

console.log('\nM4 解析器全部通过 ✓')
