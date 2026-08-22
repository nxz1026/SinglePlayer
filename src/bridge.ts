/**
 * 浏览器↔宿主桥 —— 播放发生在浏览器半（HTMLAudio），AI 工具跑在宿主半。
 * 桥用"上报 + 命令队列"解耦：浏览器定期上报正在播放状态并取走待执行命令。
 */

import type { Track } from './providers/types.ts'

export interface NowPlayingReport {
  trackId: string
  name: string
  artists: string[]
  album: string
  provider: string
  positionSec: number
  durationSec: number
  playing: boolean
}

export type BridgeCommand =
  | { type: 'play'; track: Track }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'next' }
  | { type: 'prev' }

const MAX_COMMANDS = 32

let nowPlaying: NowPlayingReport | null = null
let lastReportAt = 0
const pendingCommands: BridgeCommand[] = []

export function reportNowPlaying(report: NowPlayingReport): void {
  nowPlaying = report
  lastReportAt = Date.now()
}

export function nowPlayingSnapshot(): { report: NowPlayingReport | null; stale: boolean } {
  return {
    report: nowPlaying,
    // 超过 30 秒无上报视为浏览器端不在线。
    stale: nowPlaying !== null && Date.now() - lastReportAt > 30_000,
  }
}

export function pushCommand(command: BridgeCommand): boolean {
  if (pendingCommands.length >= MAX_COMMANDS) return false
  pendingCommands.push(command)
  return true
}

/** 浏览器轮询：取走全部待执行命令。 */
export function drainCommands(): BridgeCommand[] {
  return pendingCommands.splice(0, pendingCommands.length)
}
