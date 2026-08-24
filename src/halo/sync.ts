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

const hexId = (n: unknown): string => '0x' + (Number(n) || 0).toString(16).toUpperCase().padStart(4, '0')

interface HaloConfig {
  enabled: boolean
  align: keyof typeof ALIGN
  dynamicScroll: boolean
  idleClockWhenPaused: boolean
  maxCharsPerLine: number
  /** 通知文字停留秒数；<=0 表示置顶直到消除或切歌。 */
  notifyDurationSec: number
  screenColor: { r: number; g: number; b: number }
}

const DEFAULT_CONFIG: HaloConfig = {
  enabled: false,
  align: 'center',
  dynamicScroll: false,
  idleClockWhenPaused: true,
  maxCharsPerLine: 32,
  notifyDurationSec: 0,
  screenColor: { r: 102, g: 175, b: 255 },
}

function configPath(): string {
  return join(dataDir(), 'halo.json')
}

/**
 * 惰性加载 node-hid（原生模块）。缺失/加载失败时返回错误信息，
 * 并实测一次枚举——旧版包装器能 require 成功但调用即抛「Could not locate the bindings file」，
 * 不实测会把「假可用」误判为正常，导致永远找不到设备。
 */
function loadHid(): { hid: AnyRecord | null; error: string } {
  try {
    const require_ = createRequire(import.meta.url)
    const hid = require_('node-hid') as AnyRecord
    if (!hid || typeof hid.devices !== 'function' && typeof hid.enumerate !== 'function') {
      return { hid: null, error: 'node-hid 版本异常（缺少枚举接口）' }
    }
    if (typeof hid.setDriverType === 'function') {
      // Windows 上切原生 HID 驱动，64 字节整包直写（首字节即报告 ID）。
      try { if (process.platform === 'win32') hid.setDriverType('windows') } catch { /* 忽略 */ }
    }
    try {
      const fn = (hid.enumerate ?? hid.devices) as () => unknown[]
      fn.call(hid)
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause)
      return { hid: null, error: `HID 原生模块不可用：${msg}（请重装依赖或升级 node-hid ≥3）` }
    }
    return { hid, error: '' }
  } catch (cause) {
    return { hid: null, error: `node-hid 加载失败：${cause instanceof Error ? cause.message : String(cause)}（未安装可选依赖）` }
  }
}

export class HaloSync {
  private config: HaloConfig
  private hid: AnyRecord | null = null
  private device: AnyRecord | null = null
  private connected = false
  private simulated = false
  /** node-hid 加载/枚举层面的错误（模拟模式或枚举异常时给 UI 展示）。 */
  private hidError = ''
  /** 最近一次连接失败原因（设备未找到/打开失败），成功后清空。 */
  private connectError = ''
  private playing = false
  private lastLine: string | null = null
  private notifyPinned = false
  private songTextUntil = 0
  private featureFails: Record<string, number> = {}
  private featureDisabled: Record<string, boolean> = {}
  private featureDisabledAt: Record<string, number> = {}
  private devicesCacheAt = 0
  private devicesCacheCount = 0

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
    const prev = this.config
    this.config = { ...this.config, ...patch }
    if (patch.enabled === true) void this.connect()
    if (patch.enabled === false) {
      // 取消勾选：先把音响恢复到时钟界面，再断开设备（与 dispose 同款双保险）。
      try { this.restoreClock() } catch { /* 尽力而为 */ }
      this.disconnect()
    }

    // 已连接时让配置改动即时生效（此前只在 connect 时下发，改了没反应）。
    const screenModeChanged =
      (patch.dynamicScroll !== undefined && patch.dynamicScroll !== prev.dynamicScroll)
      || (patch.align !== undefined && patch.align !== prev.align)
      || (!!patch.screenColor
        && (patch.screenColor.r !== prev.screenColor.r
          || patch.screenColor.g !== prev.screenColor.g
          || patch.screenColor.b !== prev.screenColor.b))
    if (screenModeChanged && this.connected) this.applyScreenMode()
    // 每行字数变化：清掉去重哨兵，当前行会按新宽度重发。
    if (patch.maxCharsPerLine !== undefined && patch.maxCharsPerLine !== prev.maxCharsPerLine) {
      this.lastLine = null
    }
    // 暂停状态下开启「暂停时显示时钟」：立即下发时钟，不用等下一次暂停事件。
    if (patch.idleClockWhenPaused === true && !prev.idleClockWhenPaused && !this.playing && this.connected) {
      this.sendFeature('clock', buildClockPacket(1))
    }

    try {
      writeFileSync(configPath(), JSON.stringify(this.config, null, 2), 'utf8')
    } catch { /* 尽力而为 */ }
    return this.getConfig()
  }

  listDevices(): Array<Record<string, unknown>> {
    if (!this.hid) {
      const loaded = loadHid()
      if (loaded.hid) this.hid = loaded.hid
      else this.hidError = loaded.error
    }
    if (!this.hid) return []
    try {
      const fn = this.hid.enumerate ?? this.hid.devices
      const list = typeof fn === 'function' ? fn.call(this.hid) : []
      const arr = Array.isArray(list) ? list : []
      this.devicesCacheAt = Date.now()
      this.devicesCacheCount = arr.length
      return arr as Array<Record<string, unknown>>
    } catch (cause) {
      this.hidError = `枚举 HID 失败：${cause instanceof Error ? cause.message : String(cause)}`
      return []
    }
  }

  status(): Record<string, unknown> {
    // 浏览器端会低频轮询 status：设备数走 15s 缓存，避免高频枚举 HID。
    if (Date.now() - this.devicesCacheAt > 15_000) this.listDevices()
    // 已启用但未连上：借 status 轮询节流重连（插上 USB 后自动连上）。
    if (this.config.enabled && !this.connected) this.ensureConnected()
    return {
      enabled: this.config.enabled,
      connected: this.connected,
      simulated: this.simulated,
      playing: this.playing,
      devices: this.devicesCacheCount,
      hidError: this.hidError,
      connectError: this.connectError,
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
    const exact = devices.filter(
      d => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID && d.usagePage === USAGE_PAGE && d.usage === USAGE,
    )
    if (exact[0]) return exact[0]
    // 退而求其次：同 VID+PID 的任意 HID 接口（有的设备把屏幕控制放在别的 usage）。
    const byVidPid = devices.filter(d => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID)
    if (byVidPid[0]) return byVidPid[0]
    // 再退：仅 VID 匹配（不同型号/PID 变体兜底）。
    const byVendor = devices.filter(d => d.vendorId === VENDOR_ID)
    if (byVendor[0]) {
      logWarn(`[halo] 未精确匹配 ${hexId(VENDOR_ID)}:${hexId(PRODUCT_ID)}，改用同厂商设备（PID ${hexId(byVendor[0].productId)}）`)
      return byVendor[0]
    }
    return null
  }

  async connect(): Promise<boolean> {
    if (!this.config.enabled) return false
    if (this.connected) return true
    this.connectError = ''
    if (!this.hid) {
      const loaded = loadHid()
      if (loaded.hid) this.hid = loaded.hid
      else this.hidError = loaded.error
    }
    if (!this.hid) {
      // 无可用 node-hid：进入模拟模式（写操作空转），UI 会展示 hidError 原因。
      this.connected = true
      this.simulated = true
      return true
    }
    const info = this.findDevice()
    if (!info?.path) {
      const dump = this.listDevices()
        .map(d => `${hexId(d.vendorId)}:${hexId(d.productId)} up=${d.usagePage} u=${d.usage}`)
        .join(' | ') || '(无 HID 设备)'
      const count = this.devicesCacheCount
      this.connectError = count > 0
        ? `未找到花再设备（检测到 ${count} 台 HID，但无 ${hexId(VENDOR_ID)}:${hexId(PRODUCT_ID)}）`
        : '未找到花再设备（未枚举到任何 HID 设备）'
      logWarn(`[halo] USB 未连接或驱动未就绪。已枚举 HID: ${dump}`)
      return false
    }
    try {
      const dev = new this.hid.HID(info.path)
      dev.setNonBlocking(1)
      this.device = dev
      this.connected = true
      this.simulated = false
      this.hidError = ''
      logInfo(`[halo] 已连接花再音箱（${hexId(VENDOR_ID)}:${hexId(PRODUCT_ID)}）`)
      this.applyScreenMode()
      return true
    } catch (cause) {
      this.connectError = `打开花再设备失败：${cause instanceof Error ? cause.message : String(cause)}`
      logWarn(`[halo] 打开花再设备失败: ${cause instanceof Error ? cause.message : String(cause)}`)
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

  /** 退出时把音响恢复到时钟界面（移植 Mineradio restoreInitialState：时钟包 + 时钟场景包双保险）。 */
  restoreClock(): void {
    if (!this.connected) return
    try {
      this.sendRaw(buildClockPacket(1))
      this.sendRaw(buildScenePacket(SCENE_CATEGORY.clock))
    } catch { /* 尽力而为 */ }
  }

  /** 卸载/退出清理：先恢复时钟再断开设备。 */
  dispose(): void {
    try { this.restoreClock() } catch { /* ignore */ }
    try { this.disconnect() } catch { /* ignore */ }
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

  /** 惰性连接：未连接时限流尝试（5s），插拔后尽快自动恢复。 */
  private ensureConnected(): void {
    if (!this.config.enabled || this.connected) return
    const now = Date.now()
    if (now - this.lastConnectAttempt < 5_000) return
    this.lastConnectAttempt = now
    void this.connect()
  }

  onLyric(text: string): void {
    if (!this.config.enabled || !this.playing) return
    this.ensureConnected()
    const line = String(text ?? '').trim()
    if (!line || line === this.lastLine) return
    // 通知/切歌信息展示期间：只记住最新行不上屏，供消除通知后立即恢复。
    this.lastLine = line
    if (Date.now() < this.songTextUntil || this.notifyPinned) return
    this.sendFeature('text', buildTextPacket(line, 0, this.config.maxCharsPerLine))
  }

  onSong(name: string, artist: string): void {
    if (!this.config.enabled) return
    this.ensureConnected()
    // 注意：不要用 emoji 前缀（固件不支持 4 字节 UTF-8，会打乱整行解码）。
    const info = `${name || '未知'} - ${artist}`.trimEnd()
    this.notifyPinned = false // 切歌自动消除置顶通知
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

  /**
   * 文字提醒（通知通道）：不要求正在播放，直接上屏并压制歌词。
   * 时长取 config.notifyDurationSec（默认 8s；<=0 表示置顶，直到 dismissNotify 或切歌）。
   * 设备未连接时先走一次显式重连并短暂等待，避免静默丢通知。
   */
  async onNotify(text: string): Promise<boolean> {
    if (!this.config.enabled) return false
    const line = String(text ?? '').trim()
    if (!line) return false
    if (!this.connected) {
      await this.connect().catch(() => false)
      for (let i = 0; i < 10 && !this.connected; i++) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    if (!this.connected) {
      logWarn('[halo] notify 发送失败：设备未连接（USB 未插或驱动未就绪）')
      return false
    }
    const seconds = Math.trunc(Number(this.config.notifyDurationSec ?? 8))
    this.notifyPinned = !(seconds > 0)
    this.songTextUntil = Date.now() + Math.max(seconds, 1) * 1000
    this.lastLine = null
    const ok = this.sendFeature('text', buildTextPacket(line, 0, this.config.maxCharsPerLine))
    // 暂停状态下的限时通知：到点后回时钟，避免文字一直挂着。
    if (ok && !this.notifyPinned) {
      const until = this.songTextUntil
      setTimeout(() => {
        if (this.notifyPinned || this.playing || Date.now() < this.songTextUntil) return
        if (until !== this.songTextUntil) return
        if (this.config.idleClockWhenPaused) this.sendFeature('clock', buildClockPacket(1))
      }, Math.max(seconds, 1) * 1000 + 300)
    }
    return ok
  }

  /** 消除置顶/展示中的通知：立即恢复上一句歌词；暂停中则回时钟。 */
  dismissNotify(): boolean {
    this.notifyPinned = false
    this.songTextUntil = 0
    if (!this.config.enabled || !this.connected) return false
    if (this.playing && this.lastLine) {
      this.sendFeature('text', buildTextPacket(this.lastLine, 0, this.config.maxCharsPerLine))
    } else if (!this.playing && this.config.idleClockWhenPaused) {
      this.lastLine = null
      this.sendFeature('clock', buildClockPacket(1))
    }
    return true
  }

  /** 屏色设置：走 setConfig 以持久化并即时重发屏幕模式。 */
  sendScreenColor(r: number, g: number, b: number): boolean {
    if (!this.connected) return false
    const clamp = (v: number): number => Math.min(255, Math.max(0, Math.round(v)))
    this.setConfig({ screenColor: { r: clamp(r), g: clamp(g), b: clamp(b) } })
    return true
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
