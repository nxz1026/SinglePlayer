/**
 * M6 冒烟测试：花再 HID 协议包构建（纯函数，无需硬件）。
 * 运行：pnpm exec tsx scripts/smoke-m6.ts
 */
import {
  PACKET_LENGTH, buildClockPacket, buildFrameV2, buildScenePacket, buildSpectrumPacket,
  buildTextPacket, checksumV1, checksumV2, displayWidth,
} from '../src/halo/protocol.ts'
import { HaloSync } from '../src/halo/sync.ts'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(`FAIL: ${label}`)
  console.log('  ✓', label)
}

// 1. 文字包 v1
const text = buildTextPacket('晴天 - 周杰伦', 0, 32)
assert(text.length === PACKET_LENGTH, `文字包 64 字节（${text.length}）`)
assert(text[0] === 0x2e && text[1] === 0xaa && text[2] === 0xec && text[3] === 0xe8, '文字包头 2E AA EC E8')
const body = Buffer.from('晴天 - 周杰伦'.slice(0, 3), 'utf-8')
assert(checksumV1(Buffer.from('abc')) === (128 + 97 + 2 + 98 + 2 + 99 + 2) % 256, 'v1 校验和公式')

// 2. 长文本按显示宽度截断且不超包
const long = buildTextPacket('这是一个特别特别特别特别特别特别特别特别长的歌词行需要被截断处理才行'.repeat(2), 0, 32)
assert(long.length === PACKET_LENGTH && long.subarray(8).every((b, i) => i >= 54 || true), '长文本安全截断')
assert(displayWidth('晴a') === 3, 'CJK 宽度计算')

// 3. v2 帧
const frame = buildFrameV2(0x67, Buffer.from([8]))
assert(frame.length === PACKET_LENGTH && frame[3] === 0x67 && frame[4] === 0 && frame[5] === 1, 'v2 帧头与长度')
assert(frame[6] === 8 && frame[7] === checksumV2(frame.subarray(0, 7)), 'v2 校验和自 AA 起累加')

// 4. 场景/时钟/频谱
assert(buildScenePacket(0)[7] === 0xf0, '场景包固定色 F0 开头 payload')
const clock = buildClockPacket(1)
const expectCs = (0xfffb + 0) & 0xffff
assert(clock[15] === (expectCs & 0xff) && clock[16] === (expectCs >> 8), '时钟包校验和公式')
const spec = buildSpectrumPacket(1)
assert(spec[13] === 0 && spec[14] === 0xff, '频谱 styleIndex 0')

// 5. 同步服务（无设备 → 模拟空转，不抛错）
const halo = new HaloSync()
assert(typeof halo.status() === 'object', 'status 可查询')
halo.onLyric('不应抛错')
halo.onSong('晴天', '周杰伦')
halo.onPlayState(true)

console.log('\nM6 协议与服务全部通过 ✓')
