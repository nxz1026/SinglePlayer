/**
 * 网易扫码登录生命周期（模块级单例）——
 * 不依赖组件挂载：切页签/收起面板不中断轮询；二维码过期自动换新码。
 */

import { useSyncExternalStore } from 'react'
import { api } from './api.ts'

export type QrPhase = 'idle' | 'starting' | 'waiting' | 'scanned' | 'success' | 'given-up'

export interface QrLoginState {
  phase: QrPhase
  img?: string
  nickname?: string
  note?: string
  verified?: boolean
}

let state: QrLoginState = { phase: 'idle' }
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function set(patch: Partial<QrLoginState>): void {
  state = { ...state, ...patch }
  emit()
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => { listeners.delete(onChange) }
}

export function getQrLoginState(): QrLoginState {
  return state
}

export function useQrLogin(): QrLoginState {
  return useSyncExternalStore(subscribe, () => state)
}

const MAX_RENEWALS = 3
/** 主动刷新兜底阈值（正常过期由后端 800 驱动；阈值过高会在死码上干等）。 */
const QR_TTL_MS = 180_000

let seq = 0
let timer: number | undefined
let currentKey = ''
let renewals = 0
let qrStartAt = 0
/** 换新码进行中：阻断轮询重入，防止同一时刻多次触发 begin 竞态烧光重试次数。 */
let renewing = false

function clearTimer(): void {
  if (timer !== undefined) {
    window.clearInterval(timer)
    timer = undefined
  }
}

/** 触发一次换新码（含次数预算）；期间暂停轮询。 */
function triggerRenewal(): void {
  if (renewing) return
  renewals += 1
  clearTimer()
  if (renewals > MAX_RENEWALS) {
    set({ phase: 'given-up', note: '二维码多次过期，请点击重新获取' })
    return
  }
  void begin()
}

/** 用户点击「扫码登录」时调用。幂等：重置一切并重新开始。 */
export function startQrLogin(): void {
  stopQrLogin()
  seq += 1
  renewals = 0
  set({ phase: 'starting', img: undefined, nickname: undefined, note: undefined })
  void begin()
}

/** 离开登录界面时可调用（可选；后台继续轮询也无妨）。 */
export function stopQrLogin(): void {
  clearTimer()
  currentKey = ''
}

async function begin(): Promise<void> {
  const mySeq = seq
  renewing = true
  try {
    const { key } = await api.neteaseQrStart()
    if (mySeq !== seq) return
    currentKey = key
    const { img } = await api.neteaseQrCreate(key)
    if (mySeq !== seq) return
    qrStartAt = Date.now()
    set({ phase: 'waiting', img, note: renewals > 0 ? `二维码已过期，已自动刷新（第 ${renewals} 次）` : undefined })
    clearTimer()
    timer = window.setInterval(() => { void poll() }, 2000)
  } catch (cause) {
    if (mySeq !== seq) return
    set({ phase: 'idle', note: cause instanceof Error ? cause.message : String(cause) })
  } finally {
    renewing = false
  }
}

async function poll(): Promise<void> {
  if (renewing) return
  const mySeq = seq
  const key = currentKey
  if (!key) return
  try {
    const { qr } = await api.neteaseQrCheck(key)
    if (mySeq !== seq) return
    if (qr.code === 801) {
      // 超时未扫：主动刷新（兜底，避免后端过期判定遗漏导致卡死）。
      if (Date.now() - qrStartAt > QR_TTL_MS) triggerRenewal()
      else set({ phase: 'waiting' })
    } else if (qr.code === 802) {
      set({ phase: 'scanned' })
    } else if (qr.code === 803) {
      clearTimer()
      // 服务端 guidance（如「未能自动获取 Cookie，请用 Cookie 粘贴」）经 note 透出。
      set({
        phase: 'success',
        nickname: qr.nickname,
        note: qr.verified === false ? qr.message : undefined,
        verified: qr.verified,
      })
    } else if (qr.code === 800) {
      triggerRenewal()
    }
  } catch {
    // 单次失败静默，下个周期重试。
  }
}
