/**
 * 本地曲库 —— 多列表 + 播放统计，持久化于 $DSH_HOME/dsh-music-huazai/library.json。
 * 列表内嵌曲目完整元数据（离线可见）；网易红心为虚拟列表由路由实时拉取。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dataDir } from './auth.ts'
import { trackKey, type Track } from '../providers/types.ts'

export interface LibraryList {
  id: string
  name: string
  /** favorites=本地红心 custom=自定义 */
  kind: 'favorites' | 'custom'
  tracks: Track[]
}

export interface PlayStat {
  count: number
  lastAt: number
}

export interface LibraryData {
  lists: LibraryList[]
  /** 按 `${provider}:${songId}` 统计。 */
  plays: Record<string, PlayStat>
  /** 最近播放（新在前，截断保留 100 条）。 */
  recent: Track[]
}

const FAV_ID = 'fav'

function emptyLibrary(): LibraryData {
  return {
    lists: [{ id: FAV_ID, name: '本地红心', kind: 'favorites', tracks: [] }],
    plays: {},
    recent: [],
  }
}

let cache: LibraryData | null = null

function file(): string {
  return join(dataDir(), 'library.json')
}

function load(): LibraryData {
  if (cache) return cache
  try {
    if (existsSync(file())) {
      const raw = JSON.parse(readFileSync(file(), 'utf8')) as Partial<LibraryData>
      const data: LibraryData = {
        lists: Array.isArray(raw.lists) && raw.lists.length ? raw.lists : emptyLibrary().lists,
        plays: raw.plays ?? {},
        recent: Array.isArray(raw.recent) ? raw.recent : [],
      }
      if (!data.lists.some(list => list.id === FAV_ID)) {
        data.lists.unshift({ id: FAV_ID, name: '本地红心', kind: 'favorites', tracks: [] })
      }
      cache = data
      return data
    }
  } catch { /* 损坏则重建 */ }
  cache = emptyLibrary()
  return cache
}

function save(): void {
  if (!cache) return
  try {
    writeFileSync(file(), JSON.stringify(cache, null, 2), 'utf8')
  } catch { /* 尽力而为 */ }
}

export function getLists(): LibraryList[] {
  return load().lists
}

/** 创建自定义列表；重名允许（id 区分）。 */
export function createList(name: string): LibraryList {
  const data = load()
  const list: LibraryList = {
    id: `l${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`,
    name: name.trim() || '新列表',
    kind: 'custom',
    tracks: [],
  }
  data.lists.push(list)
  save()
  return list
}

export function deleteList(id: string): boolean {
  const data = load()
  const index = data.lists.findIndex(list => list.id === id)
  if (index < 0 || data.lists[index]?.kind === 'favorites') return false
  data.lists.splice(index, 1)
  save()
  return true
}

export type AddResult = 'added' | 'exists'

export function addTrack(listId: string, track: Track): AddResult | undefined {
  const list = load().lists.find(item => item.id === listId)
  if (!list) return undefined
  const key = trackKey(track)
  if (list.tracks.some(item => trackKey(item) === key)) return 'exists'
  // 入库时补齐缺省字段，保证列表自包含。
  list.tracks.push({ ...track })
  save()
  return 'added'
}

export function removeTrack(listId: string, trackId: string): boolean {
  const list = load().lists.find(item => item.id === listId)
  if (!list) return false
  const before = list.tracks.length
  list.tracks = list.tracks.filter(item => trackKey(item) !== trackId)
  const changed = list.tracks.length !== before
  if (changed) save()
  return changed
}

/** 记录一次播放：计数 +1 并更新最近播放。 */
export function recordPlay(track: Track): void {
  const data = load()
  const key = trackKey(track)
  const stat = data.plays[key]
  if (stat) {
    stat.count += 1
    stat.lastAt = Date.now()
  } else {
    data.plays[key] = { count: 1, lastAt: Date.now() }
  }
  data.recent = [track, ...data.recent.filter(item => trackKey(item) !== key)].slice(0, 100)
  save()
}

export function getStats(): { plays: Record<string, PlayStat>; recent: Track[] } {
  const data = load()
  return { plays: data.plays, recent: data.recent }
}
