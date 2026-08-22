/**
 * 花再（EDIFIER Halo PixelBar）HID 协议 —— 移植自 Mineradio desktop/halo-lyric-sync.js。
 * 设备：USB VID 0x2D99 / PID 0xA106，控制接口 usage page 0xFF14 / usage 1，包长 64 字节。
 *
 * 协议来源：
 * - 文字包 v1：HaloLyricSync / HaloPixelToolBox
 * - 增强指令 v2：Seraph310/halo-pixelbar-mcp PROTOCOL_NOTES
 */

export const VENDOR_ID = 0x2d99
export const PRODUCT_ID = 0xa106
export const USAGE_PAGE = 0xff14
export const USAGE = 1
export const PACKET_LENGTH = 64

/** 对齐字节（v2 0xEF 01 包末字节）。 */
export const ALIGN = { left: 0, center: 1, right: 2, justify: 3 } as const

/** 内置场景分类（UI 模式包）。 */
export const SCENE_CATEGORY = {
  clock: 0, game: 1, work: 2, reading: 3, cats: 4, dogs: 5, memes: 6, cyber: 7, waves: 8,
} as const

/** 氛围灯特效编号。 */
export const AMBIENT_EFFECT = {
  breathing: 1, tide: 2, static: 3, ripple: 4, flow: 5, dynamic: 6,
} as const

/** 文本校验和：acc=128; for b: acc += b+2; acc%256。 */
export function checksumV1(textBytes: Buffer): number {
  let acc = 128
  for (const b of textBytes) acc += b + 2
  return acc % 256
}

/** v2 校验和：从 AA 字节（索引1）起求和 mod 256。 */
export function checksumV2(packetBeforeChecksum: Buffer): number {
  let sum = 0
  for (let i = 1; i < packetBeforeChecksum.length; i++) sum += packetBeforeChecksum[i] ?? 0
  return sum % 256
}

function pad64(buf: Buffer): Buffer {
  if (buf.length >= PACKET_LENGTH) return buf.subarray(0, PACKET_LENGTH)
  const out = Buffer.alloc(PACKET_LENGTH, 0)
  buf.copy(out, 0)
  return out
}

/** CJK 近似显示宽度。 */
export function displayWidth(text: string): number {
  let width = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    width += code > 0x2e80 && code < 0xffa0 ? 2 : 1
  }
  return width
}

/**
 * 清洗设备文本：剔除非 BMP 字符（emoji 等 4 字节 UTF-8 序列）。
 * 固件解码器不支持 4 字节序列，一个 emoji 会打乱后续全部多字节解析，
 * 使中文显示为「？」；控制字符一并剔除。
 */
export function sanitizeDeviceText(text: string): string {
  return Array.from(String(text ?? ''))
    .filter(ch => {
      const code = ch.codePointAt(0) ?? 0
      return code >= 0x20 && code <= 0xffff
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 文字包 v1：`2E AA EC E8 + 颜色(1) + 总长(2 LE) + 文本长(1) + UTF-8 + 校验和(1)`。
 * 颜色必须为 0（白）：非零颜色字节会触发固件复位并掉线。
 */
export function buildTextPacket(text: string, colorByte = 0, maxChars = 32): Buffer {
  let s = sanitizeDeviceText(text)
  while ((displayWidth(s) > maxChars || Buffer.byteLength(s, 'utf-8') > 54) && s.length > 0) {
    s = s.slice(0, -1)
  }
  const textBytes = Buffer.from(s, 'utf-8')
  const totalLen = 1 + textBytes.length + 1
  const pkt = Buffer.alloc(5 + 2 + 1 + textBytes.length + 1)
  pkt[0] = 0x2e; pkt[1] = 0xaa; pkt[2] = 0xec; pkt[3] = 0xe8
  pkt[4] = colorByte & 0xff
  pkt.writeUInt16LE(totalLen, 5)
  pkt[7] = textBytes.length & 0xff
  textBytes.copy(pkt, 8)
  pkt[8 + textBytes.length] = checksumV1(textBytes)
  return pad64(pkt)
}

/** v2 通用帧：`2E AA ED <cmd> <len-hi> <len-lo> <payload> <checksum>`。 */
export function buildFrameV2(cmd: number, payload: Buffer): Buffer {
  const head = Buffer.from([0x2e, 0xaa, 0xed, cmd, (payload.length >> 8) & 0xff, payload.length & 0xff])
  const before = Buffer.concat([head, payload])
  return pad64(Buffer.concat([before, Buffer.from([checksumV2(before)])]))
}

/** 氛围灯：cmd 0x6B。 */
export function buildAmbientPacket(effect: number, r: number, g: number, b: number, brightness: number, speed: number): Buffer {
  return buildFrameV2(0x6b, Buffer.from([0x13, effect & 0xff, r & 0xff, g & 0xff, b & 0xff, brightness & 0xff, speed & 0xff]))
}

/** 音量联动：cmd 0x67，level 0-16。 */
export function buildVolumePacket(level: number): Buffer {
  return buildFrameV2(0x67, Buffer.from([level & 0xff]))
}

/** 屏色：cmd 0xEF payload 03 R G B ... */
export function buildScreenColorPacket(r: number, g: number, b: number): Buffer {
  return buildFrameV2(0xef, Buffer.from([0x03, r & 0xff, g & 0xff, b & 0xff, 0x00, 0x00, 0xff, 0xff, 0xff]))
}

/** 对齐模式：cmd 0xEF payload 01 R G B 00 02 00 <align> FF */
export function buildAlignPacket(alignByte: number, r: number, g: number, b: number): Buffer {
  return buildFrameV2(0xef, Buffer.from([0x01, r & 0xff, g & 0xff, b & 0xff, 0x00, 0x02, 0x00, alignByte & 0xff, 0xff]))
}

/** 动态右到左滚动：cmd 0xEF payload 01 R G B 00 02 01 01 FF */
export function buildDynamicTextPacket(r: number, g: number, b: number): Buffer {
  return buildFrameV2(0xef, Buffer.from([0x01, r & 0xff, g & 0xff, b & 0xff, 0x00, 0x02, 0x01, 0x01, 0xff]))
}

/** UI 场景包：颜色固定 F0 B4 C8（与官方 TempoHub 一致，规避改字体色导致设备复位）。 */
export function buildScenePacket(category: number): Buffer {
  const payload = Buffer.from([0x02, 0xf0, 0xb4, 0xc8, 0x00, 0x01, category & 0xff, 0xff, 0xff])
  const before = Buffer.from([0x2e, 0xaa, 0xec, 0xef, 0x00, 0x09, ...payload])
  return pad64(Buffer.concat([before, Buffer.from([checksumV2(before), 0x00])]))
}

/** 时钟样式包：style 1..11 → index = style-1；校验和 (0xFFFB+index)&0xFFFF 小端。 */
export function buildClockPacket(style: number): Buffer {
  const index = ((Math.trunc(Number(style)) || 1) - 1) & 0xff
  const head = Buffer.from([0x2e, 0xaa, 0xec, 0xef, 0x00, 0x09, 0x01, 0xf0, 0xb4, 0xc8, 0x00, 0x01])
  const pkt = Buffer.alloc(17)
  head.copy(pkt, 0)
  pkt[12] = (index >> 8) & 0xff
  pkt[13] = index & 0xff
  pkt[14] = 0xff
  const checksum = (0xfffb + index) & 0xffff
  pkt[15] = checksum & 0xff
  pkt[16] = (checksum >> 8) & 0xff
  return pad64(pkt)
}

/** 频谱样式包：style 1..4 → styleIndex 0..3；校验和 (0x0040+8+idx)&0xFFFF 小端。 */
export function buildSpectrumPacket(style: number): Buffer {
  const styleIndex = ((Math.trunc(Number(style)) | 0) - 1) & 0xff
  const pkt = Buffer.alloc(17)
  Buffer.from([0x2e, 0xaa, 0xec, 0xef, 0x00, 0x09, 0x01, 0xc0, 0xff, 0xf2, 0x00, 0x01, 0x08]).copy(pkt, 0)
  pkt[13] = styleIndex & 0xff
  pkt[14] = 0xff
  const checksum = (0x0040 + 8 + styleIndex) & 0xffff
  pkt[15] = checksum & 0xff
  pkt[16] = (checksum >> 8) & 0xff
  return pad64(pkt)
}
