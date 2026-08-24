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
/** 主动刷新兜底阈值（正常过期由后端 expired 驱动；阈值过高会在死码上干等）。 */
const QR_TTL_MS = 180_000

let seq = 0
let timer: number | undefined
let qrsig = ''
let ptLoginSig = ''
let renewals = 0
let qqStartAt = 0
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
  renewing = true
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
  } finally {
    renewing = false
  }
}

async function poll(): Promise<void> {
  if (renewing) return
  const mySeq = seq
  if (!qrsig || !ptLoginSig) return
  try {
    const { qr } = await api.qqQrCheck(qrsig, ptLoginSig)
    if (mySeq !== seq) return
    if (qr.phase === 'waiting') {
      // 超时未扫：主动刷新（兜底，避免后端过期判定遗漏导致卡死）。
      if (Date.now() - qqStartAt > QR_TTL_MS) triggerRenewal()
      else set({ phase: 'waiting' })
    } else if (qr.phase === 'scanned') {
      set({ phase: 'scanned' })
    } else if (qr.phase === 'success') {
      clearTimer()
      set({ phase: 'success', note: qr.note })
    } else if (qr.phase === 'expired') {
      triggerRenewal()
    } else {
      // 瞬时错误不清定时器：继续轮询，等待下个周期自愈或过期换码。
      set({ note: qr.note ?? '扫码出错，将继续重试' })
    }
  } catch {
    // 单次失败静默，下个周期重试。
  }
}
