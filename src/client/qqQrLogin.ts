/**
 * QQ 扫码登录生命周期（模块级单例）——
 * 复用网易云扫码的状态机思路，但走腾讯 ptlogin 二维码轮询。
 * 二维码过期自动换新码（最佳努力）。
 */

import { useSyncExternalStore } from 'react'
import { api } from './api.ts'

export type QqQrPhase = 'idle' | 'starting' | 'waiting' | 'scanned' | 'success' | 'error' | 'given-up'

export interface QqQrState {
  phase: QqQrPhase
  img?: string
  note?: string
}

let state: QqQrState = { phase: 'idle' }
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function set(patch: Partial<QqQrState>): void {
  state = { ...state, ...patch }
  emit()
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => { listeners.delete(onChange) }
}

export function getQqQrState(): QqQrState {
  return state
}

export function useQqQrLogin(): QqQrState {
  return useSyncExternalStore(subscribe, () => state)
}

const MAX_RENEWALS = 3
const QR_TTL_MS = 110_000

let seq = 0
let timer: number | undefined
let qrsig = ''
let ptLoginSig = ''
let renewals = 0
let qqStartAt = 0

function clearTimer(): void {
  if (timer !== undefined) {
    window.clearInterval(timer)
    timer = undefined
  }
}

/** 用户点击「扫码登录」时调用。幂等：重置一切并重新开始。 */
export function startQqQrLogin(): void {
  stopQqQrLogin()
  seq += 1
  renewals = 0
  set({ phase: 'starting', img: undefined, note: undefined })
  void begin()
}

/** 离开登录界面时可调用（可选）。 */
export function stopQqQrLogin(): void {
  clearTimer()
  qrsig = ''
  ptLoginSig = ''
}

async function begin(): Promise<void> {
  const mySeq = seq
  try {
    const { qrsig: qs, ptLoginSig: ps, img } = await api.qqQrStart()
    if (mySeq !== seq) return
    qrsig = qs
    ptLoginSig = ps
    qqStartAt = Date.now()
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
  if (!qrsig || !ptLoginSig) return
  try {
    const { qr } = await api.qqQrCheck(qrsig, ptLoginSig)
    if (mySeq !== seq) return
    if (qr.phase === 'waiting') {
      // 超时未扫：主动刷新（兜底，避免后端过期判定遗漏导致卡死）。
      if (Date.now() - qqStartAt > QR_TTL_MS) {
        renewals += 1
        if (renewals <= MAX_RENEWALS) { void begin(); return }
        clearTimer()
        set({ phase: 'given-up', note: '二维码多次过期，请点击重新获取' })
        return
      }
      set({ phase: 'waiting' })
    } else if (qr.phase === 'scanned') {
      set({ phase: 'scanned' })
    } else if (qr.phase === 'success') {
      clearTimer()
      set({ phase: 'success', note: qr.note })
    } else if (qr.phase === 'expired') {
      renewals += 1
      if (renewals <= MAX_RENEWALS) void begin()
      else {
        clearTimer()
        set({ phase: 'given-up', note: '二维码多次过期，请点击重新获取' })
      }
    } else {
      clearTimer()
      set({ phase: 'error', note: qr.note ?? '扫码出错' })
    }
  } catch {
    // 单次失败静默，下个周期重试。
  }
}
