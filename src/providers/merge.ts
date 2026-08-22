/** 聚合搜索：并发多平台 → 合并去重（M2 简单交错，后续可升级 Mineradio 打分算法）。 */

import { search as neteaseSearch } from './netease.ts'
import { search as qqSearch } from './qq.ts'
import type { ProviderId, Track } from './types.ts'

export interface SearchOptions {
  keyword: string
  limit?: number
  offset?: number
  providers?: ProviderId[]
}

export async function aggregateSearch(options: SearchOptions): Promise<Track[]> {
  const keyword = options.keyword.trim()
  const limit = Math.min(Math.max(options.limit ?? 12, 1), 30)
  const offset = Math.max(options.offset ?? 0, 0)
  if (!keyword) return []
  const wanted = options.providers ?? ['netease', 'qq']

  const tasks: Array<Promise<Track[]>> = []
  if (wanted.includes('netease')) tasks.push(neteaseSearch(keyword, limit, offset).catch(() => []))
  if (wanted.includes('qq')) tasks.push(qqSearch(keyword, limit, offset).catch(() => []))

  const results = await Promise.all(tasks)
  // 简单合并：按平台顺序拼接 + 平台内去重（跨平台同名去重交给 UI 展示层）。
  const seen = new Set<string>()
  const merged: Track[] = []
  for (const list of results) {
    for (const track of list) {
      const key = `${track.provider}:${track.songId}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(track)
    }
  }
  return merged
}
