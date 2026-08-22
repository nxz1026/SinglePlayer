/**
 * 插件设置 —— 通知 / 定时任务 / 反向推送开关。
 * 声音通知与音箱文字提醒是两条独立通道：
 * - notifySound：浏览器半播放提示音（Web Audio，无需任何硬件）
 * - notifyHaloText：花再音箱屏幕文字（依赖设备连接）
 * 持久化于 $DSH_HOME/dsh-music-huazai/settings.json。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dataDir } from './auth.ts'

export interface PluginSettings {
  /** 声音通知（浏览器提示音）。 */
  notifySound: boolean
  /** 音箱文字提醒（依赖花再音箱）。 */
  notifyHaloText: boolean
  /** 定时任务总开关（闹钟 / 睡眠定时器）。 */
  schedulerEnabled: boolean
  /** 反向推送（切歌等事件写入会话动态）。 */
  reversePushEnabled: boolean
}

const DEFAULTS: PluginSettings = {
  notifySound: true,
  notifyHaloText: true,
  schedulerEnabled: true,
  reversePushEnabled: false,
}

let cache: PluginSettings | null = null

function file(): string {
  return join(dataDir(), 'settings.json')
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function load(): PluginSettings {
  if (cache) return cache
  try {
    if (existsSync(file())) {
      const raw = JSON.parse(readFileSync(file(), 'utf8')) as Partial<PluginSettings>
      cache = {
        notifySound: bool(raw.notifySound, DEFAULTS.notifySound),
        notifyHaloText: bool(raw.notifyHaloText, DEFAULTS.notifyHaloText),
        schedulerEnabled: bool(raw.schedulerEnabled, DEFAULTS.schedulerEnabled),
        reversePushEnabled: bool(raw.reversePushEnabled, DEFAULTS.reversePushEnabled),
      }
      return cache
    }
  } catch { /* 损坏则用默认 */ }
  cache = { ...DEFAULTS }
  return cache
}

export function getSettings(): PluginSettings {
  return { ...load() }
}

export function patchSettings(patch: Partial<PluginSettings>): PluginSettings {
  const current = load()
  const next: PluginSettings = {
    notifySound: bool(patch.notifySound, current.notifySound),
    notifyHaloText: bool(patch.notifyHaloText, current.notifyHaloText),
    schedulerEnabled: bool(patch.schedulerEnabled, current.schedulerEnabled),
    reversePushEnabled: bool(patch.reversePushEnabled, current.reversePushEnabled),
  }
  cache = next
  try {
    writeFileSync(file(), JSON.stringify(next, null, 2), 'utf8')
  } catch { /* 尽力而为 */ }
  return { ...next }
}
