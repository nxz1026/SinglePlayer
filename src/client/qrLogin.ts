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

let seq = 0
let timer: number | undefined
let currentKey = ''
let renewals = 0

function clearTimer(): void {
  if (timer !== undefined) {
    window.clearInterval(timer)
    timer = undefined
  }
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
  try {
    const { key } = await api.neteaseQrStart()
    if (mySeq !== seq) return
    currentKey = key
    const { img } = await api.neteaseQrCreate(key)
    if (mySeq !== seq) return
    set({ phase: 'waiting', img, note: renewals > 0 ? `二维码已过期，已自动刷新（第 ${renewals} 次）` : undefined })
    clearTimer()
    timer = window.setInterval(() => { void poll() }, 2000)
  } catch (cause) {
    if (mySeq !== seq) return
    set({ phase: 'idle', note: cause instanceof Error ? cause.message : String(cause) })
  }
}

async function poll(): Promise<void> {
  const mySeq = seq
  const key = currentKey
  if (!key) return
  try {
    const { qr } = await api.neteaseQrCheck(key)
    if (mySeq !== seq) return
    if (qr.code === 801) {
      set({ phase: 'waiting' })
    } else if (qr.code === 802) {
      set({ phase: 'scanned' })
    } else if (qr.code === 803) {
      clearTimer()
      set({ phase: 'success', nickname: qr.nickname, note: undefined })
    } else if (qr.code === 800) {
      renewals += 1
      if (renewals <= MAX_RENEWALS) void begin()
      else {
        clearTimer()
        set({ phase: 'given-up', note: '二维码多次过期，请点击重新获取' })
      }
    }
  } catch {
    // 单次失败静默，下个周期重试。
  }
}
