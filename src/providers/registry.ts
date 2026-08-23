/**
 * Provider 注册表 —— 音源的可插拔中枢（对标 HaloLyricSync 的 factory.py）。
 *
 * 消费方（routes/tools/merge）只通过本表取用 Provider，新增平台无需改动它们。
 * 新增源流程：
 *   1. 在 providers/<x>.ts 实现 MusicProvider 接口并 export 一个对象；
 *   2. 在 installBuiltinProviders() 里 registerProvider(...) 一次（或在运行时动态注册）。
 */

import type { AuthStatusItem, LyricPayload, MusicProvider, ProviderId, Quality, SongUrlResult, Track } from './types.ts'
import { neteaseProvider } from './netease.ts'
import { qqProvider } from './qq.ts'
import { loadEnabledProviderIds, saveEnabledProviderIds } from '../store/settings.ts'

const registry = new Map<ProviderId, MusicProvider>()
const enabled = new Set<ProviderId>()

/** 注册一个音源（默认启用）。重复注册会覆盖。 */
export function registerProvider(provider: MusicProvider): void {
  registry.set(provider.id, provider)
  enabled.add(provider.id)
}

/** 注销一个音源。 */
export function unregisterProvider(id: ProviderId): void {
  registry.delete(id)
  enabled.delete(id)
}

/** 按 id 取用（不存在返回 undefined）。 */
export function getProvider(id: ProviderId): MusicProvider | undefined {
  return registry.get(id)
}

/** 是否存在某音源。 */
export function hasProvider(id: ProviderId): boolean {
  return registry.has(id)
}

/** 全部已注册音源（按插入顺序）。 */
export function listProviders(): MusicProvider[] {
  return [...registry.values()]
}

/** 所有已注册音源 id。 */
export function allProviderIds(): ProviderId[] {
  return [...registry.keys()]
}

/** 设置启用/停用（未注册者忽略）。 */
export function setEnabled(id: ProviderId, on: boolean): void {
  if (!registry.has(id)) return
  if (on) enabled.add(id)
  else enabled.delete(id)
  persistEnabled()
}

/** 是否启用。 */
export function isEnabled(id: ProviderId): boolean {
  return enabled.has(id)
}

/** 当前启用中的音源。 */
export function enabledProviders(): MusicProvider[] {
  return [...enabled].map(id => registry.get(id)).filter((p): p is MusicProvider => !!p)
}

/** 当前启用中的音源 id。 */
export function enabledProviderIds(): ProviderId[] {
  return [...enabled]
}

function persistEnabled(): void {
  saveEnabledProviderIds([...enabled])
}

/**
 * 注册内置音源（netease / qq）并应用设置里的启用集。
 * 应在插件启动时调用一次（幂等）。
 */
export function installBuiltinProviders(): void {
  registerProvider(neteaseProvider)
  registerProvider(qqProvider)
  // 若设置里已有启用集，则按设置覆盖默认全开。
  const saved = loadEnabledProviderIds()
  if (saved.length) {
    for (const id of allProviderIds()) setEnabled(id, saved.includes(id))
  }
  // 修复：把当前启用集同步写回设置，使 settings.enabledProviders 与运行时
  // （默认全开）保持一致，避免「空数组被误读为全禁用」的语义歧义。
  persistEnabled()
}
