/**
 * 插件设置 —— 通知 / 定时任务 / 反向推送开关。
 * 声音通知：浏览器半播放提示音（Web Audio，无需任何硬件）。
 * 持久化于 $DSH_HOME/dsh-music-huazai/settings.json。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dataDir } from './auth.ts'

export interface PluginSettings {
  /** 声音通知（浏览器提示音）。 */
  notifySound: boolean
  /** 定时任务总开关（闹钟 / 睡眠定时器）。 */
  schedulerEnabled: boolean
  /** 反向推送（切歌等事件写入会话动态）。 */
  reversePushEnabled: boolean
  /** 启用的音乐源 id 列表（空数组表示未初始化，由 registry 回填）。 */
  enabledProviders: string[]
}

const DEFAULTS: PluginSettings = {
  notifySound: true,
  schedulerEnabled: true,
  reversePushEnabled: false,
  enabledProviders: [],
}

let cache: PluginSettings | null = null

function file(): string {
  return join(dataDir(), 'settings.json')
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function strArray(value: unknown): string[] | undefined {
  if (Array.isArray(value) && value.every(v => typeof v === 'string')) return value as string[]
  return undefined
}

function load(): PluginSettings {
  if (cache) return cache
  try {
    if (existsSync(file())) {
      const raw = JSON.parse(readFileSync(file(), 'utf8')) as Partial<PluginSettings>
      cache = {
        notifySound: bool(raw.notifySound, DEFAULTS.notifySound),
        schedulerEnabled: bool(raw.schedulerEnabled, DEFAULTS.schedulerEnabled),
        reversePushEnabled: bool(raw.reversePushEnabled, DEFAULTS.reversePushEnabled),
        enabledProviders: strArray(raw.enabledProviders) ?? [...DEFAULTS.enabledProviders],
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
    schedulerEnabled: bool(patch.schedulerEnabled, current.schedulerEnabled),
    reversePushEnabled: bool(patch.reversePushEnabled, current.reversePushEnabled),
    enabledProviders: strArray(patch.enabledProviders) ?? current.enabledProviders,
  }
  cache = next
  try {
    writeFileSync(file(), JSON.stringify(next, null, 2), 'utf8')
  } catch { /* 尽力而为 */ }
  return { ...next }
}

/** 读取启用的音源 id（供 registry 使用）。 */
export function loadEnabledProviderIds(): string[] {
  return getSettings().enabledProviders
}

/** 持久化启用的音源 id（供 registry 使用）。 */
export function saveEnabledProviderIds(ids: string[]): void {
  patchSettings({ enabledProviders: ids })
}
