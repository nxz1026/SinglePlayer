/**
 * 花再同步服务 —— HID 设备管理 + 歌词/切歌/播放状态事件入口。
 * 逻辑移植自 Mineradio HaloSync：换行去重、切歌信息 3 秒过渡、暂停时钟、特性降级。
 * 所有调用尽力而为：设备不在线/未启用时空转，不影响播放器本体。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import {
  ALIGN, PRODUCT_ID, SCENE_CATEGORY, USAGE, USAGE_PAGE, VENDOR_ID,
  buildAlignPacket, buildClockPacket, buildDynamicTextPacket, buildScenePacket,
  buildScreenColorPacket, buildSpectrumPacket, buildTextPacket,
} from './protocol.ts'
import { dataDir } from '../store/auth.ts'
import { logInfo, logWarn } from '../log.ts'

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecord = Record<string, any>

interface HaloConfig {
  enabled: boolean
  align: keyof typeof ALIGN
  dynamicScroll: boolean
  idleClockWhenPaused: boolean
  maxCharsPerLine: number
  screenColor: { r: number; g: number; b: number }
}

const DEFAULT_CONFIG: HaloConfig = {
  enabled: false,
  align: 'center',
  dynamicScroll: false,
  idleClockWhenPaused: true,
  maxCharsPerLine: 32,
  screenColor: { r: 102, g: 175, b: 255 },
}

function configPath(): string {
  return join(dataDir(), 'halo.json')
}

/** 惰性加载 node-hid（原生模块，缺失/加载失败时进入模拟模式）。 */
function loadHid(): AnyRecord | null {
  try {
    const require_ = createRequire(import.meta.url)
    const hid = require_('node-hid')
    if (hid && typeof hid.setDriverType === 'function') {
      // Windows 上切原生 HID 驱动，64 字节整包直写（首字节即报告 ID）。
      try { if (process.platform === 'win32') hid.setDriverType('windows') } catch { /* 忽略 */ }
    }
    return hid
  } catch {
    return null
  }
}

export class HaloSync {
  private config: HaloConfig
  private hid: AnyRecord | null = null
  private device: AnyRecord | null = null
  private connected = false
  private simulated = false
  private playing = false
  private lastLine: string | null = null
  private songTextUntil = 0
  private featureFails: Record<string, number> = {}
  private featureDisabled: Record<string, boolean> = {}
  private featureDisabledAt: Record<string, number> = {}

  constructor() {
    this.config = this.loadConfig()
  }

  private loadConfig(): HaloConfig {
    try {
      const file = configPath()
      if (existsSync(file)) {
        const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<HaloConfig>
        return { ...DEFAULT_CONFIG, ...raw }
      }
    } catch { /* 用默认 */ }
    return { ...DEFAULT_CONFIG }
  }

  getConfig(): HaloConfig {
    return { ...this.config }
  }

  setConfig(patch: Partial<HaloConfig>): HaloConfig {
    this.config = { ...this.config, ...patch }
    if (patch.enabled === true) void this.connect()
    if (patch.enabled === false) this.disconnect()
    try {
      writeFileSync(configPath(), JSON.stringify(this.config, null, 2), 'utf8')
    } catch { /* 尽力而为 */ }
    return this.getConfig()
  }

  listDevices(): Array<Record<string, unknown>> {
    const hid = this.hid ?? loadHid()
    if (!hid) return []
    try {
      const fn = hid.enumerate ?? hid.devices
      const list = typeof fn === 'function' ? fn.call(hid) : []
      return Array.isArray(list) ? list : []
    } catch {
      return []
    }
  }

  status(): Record<string, unknown> {
    return {
      enabled: this.config.enabled,
      connected: this.connected,
      simulated: this.simulated,
      playing: this.playing,
      devices: this.listDevices().length,
      config: this.getConfig(),
    }
  }

  findDevice(): AnyRecord | null {
    if (!this.hid) return null
    let devices: AnyRecord[] = []
    try {
      const fn = this.hid.enumerate ?? this.hid.devices
      devices = typeof fn === 'function' ? fn.call(this.hid) : []
    } catch {
      return null
    }
    for (const d of devices) {
      if (d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID && d.usagePage === USAGE_PAGE && d.usage === USAGE) return d
    }
    for (const d of devices) {
      if (d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID) return d
    }
    return null
  }

  async connect(): Promise<boolean> {
    if (!this.config.enabled) return false
    if (this.connected) return true
    this.hid = this.hid ?? loadHid()
    if (!this.hid) {
      this.connected = true
      this.simulated = true
      return true
    }
    const info = this.findDevice()
    if (!info?.path) {
      logWarn('[halo] 未找到花再设备（USB 未连接或驱动未就绪）')
      return false
    }
    try {
      const dev = new this.hid.HID(info.path)
      dev.setNonBlocking(1)
      this.device = dev
      this.connected = true
      this.simulated = false
      logInfo(`[halo] 已连接花再音箱`)
      this.applyScreenMode()
      return true
    } catch {
      return false
    }
  }

  disconnect(): void {
    if (this.device) {
      try { (this.device as any).close() } catch { /* ignore */ }
    }
    this.device = null
    this.connected = false
  }

  /** 屏色 + 对齐/滚动模式（连接后初始化用）。 */
  private applyScreenMode(): void {
    const { r, g, b } = this.config.screenColor
    this.sendRaw(buildScreenColorPacket(r, g, b))
    if (this.config.dynamicScroll) this.sendRaw(buildDynamicTextPacket(r, g, b))
    else this.sendRaw(buildAlignPacket(ALIGN[this.config.align] ?? ALIGN.center, r, g, b))
  }

  private sendRaw(packet: Buffer): boolean {
    if (!this.connected || !packet) return false
    if (this.simulated || !this.device) return true
    try {
      const res = (this.device as any).write(packet)
      if (res < 0) throw new Error(`write ${res}`)
      return true
    } catch {
      // 写入失败：重开一次；仍失败则断开等待下次重连。
      if (!this.reopen()) this.connected = false
      return false
    }
  }

  /** 特性安全降级：非文字包连续 3 次失败则临时禁用该特性，保住歌词通道。 */
  private sendFeature(feature: string, packet: Buffer): boolean {
    // 已禁用特性：满 5 分钟后自动解禁重试一次，避免永久失效。
    if (feature !== 'text' && this.featureDisabled[feature] === true) {
      if (Date.now() - (this.featureDisabledAt[feature] ?? 0) > 300_000) {
        this.featureDisabled[feature] = false
        this.featureFails[feature] = 0
      } else return false
    }
    const ok = this.sendRaw(packet)
    if (ok) {
      const fails = this.featureFails[feature]
      if (fails != null && fails > 0) this.featureFails[feature] = fails - 1
    } else if (feature !== 'text') {
      this.featureFails[feature] = (this.featureFails[feature] ?? 0) + 1
      if (this.featureFails[feature] >= 3) {
        this.featureDisabled[feature] = true
        this.featureDisabledAt[feature] = Date.now()
        logWarn(`[halo] 特性 ` + feature + ` 连续失败，已临时禁用（5 分钟后自动重试）`)
      }
    }
    return ok
  }

  private reopen(): boolean {
    try { (this.device as any)?.close() } catch { /* ignore */ }
    this.device = null
    const info = this.findDevice()
    if (!info?.path) return false
    try {
      const hidCtor = this.hid?.HID
      if (typeof hidCtor !== 'function') return false
      const dev = new hidCtor(info.path)
      dev.setNonBlocking(1)
      this.device = dev
      return true
    } catch {
      return false
    }
  }

  // ---- 事件入口 ----

  private lastConnectAttempt = 0

  /** 惰性连接：未连接时限流尝试（15s），避免频繁枚举。 */
  private ensureConnected(): void {
    if (!this.config.enabled || this.connected) return
    const now = Date.now()
    if (now - this.lastConnectAttempt < 15_000) return
    this.lastConnectAttempt = now
    void this.connect()
  }

  onLyric(text: string): void {
    if (!this.config.enabled || !this.playing) return
    this.ensureConnected()
    if (Date.now() < this.songTextUntil) return // 切歌信息展示中
    const line = String(text ?? '').trim()
    if (!line || line === this.lastLine) return
    this.lastLine = line
    this.sendFeature('text', buildTextPacket(line, 0, this.config.maxCharsPerLine))
  }

  onSong(name: string, artist: string): void {
    if (!this.config.enabled) return
    this.ensureConnected()
    // 注意：不要用 emoji 前缀（固件不支持 4 字节 UTF-8，会打乱整行解码）。
    const info = `${name || '未知'} - ${artist}`.trimEnd()
    this.songTextUntil = Date.now() + 3000
    this.lastLine = null
    this.sendFeature('text', buildTextPacket(info, 0, this.config.maxCharsPerLine))
  }

  onPlayState(playing: boolean): void {
    if (!this.config.enabled) return
    this.playing = !!playing
    if (!playing) {
      this.lastLine = null
      if (this.config.idleClockWhenPaused) this.sendFeature('clock', buildClockPacket(1))
    }
  }

  sendScene(name: string): boolean {
    const category = (SCENE_CATEGORY as Record<string, number>)[name]
    if (category == null) return false
    return this.sendFeature('scene', buildScenePacket(category))
  }

  sendSpectrum(style: number): boolean {
    if (!(style >= 1 && style <= 4)) return false
    return this.sendFeature('spectrum', buildSpectrumPacket(style))
  }

  sendClock(style: number): boolean {
    if (!(style >= 1 && style <= 11)) return false
    return this.sendFeature('clock', buildClockPacket(style))
  }
}

/** 页面级单例（宿主进程内）。 */
let instance: HaloSync | undefined

export function getHaloSync(): HaloSync {
  instance = instance ?? new HaloSync()
  return instance
}
