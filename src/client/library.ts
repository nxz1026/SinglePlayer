/**
 * 曲库（多列表）客户端 store —— 列表数据 + 本地红心快速判定。
 * 数据源：宿主 /lists（library.json 持久化）。
 */

import { useSyncExternalStore } from 'react'
import { api, FAV_LIST_ID, type LibraryList } from './api.ts'
import type { Track } from '../providers/types.ts'

export interface LibraryState {
  loaded: boolean
  lists: LibraryList[]
  recent: Track[]
}

let state: LibraryState = { loaded: false, lists: [], recent: [] }
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function setLists(lists: LibraryList[], recent?: Track[]): void {
  state = {
    loaded: true,
    lists,
    recent: recent ?? state.recent,
  }
  emit()
}

export async function loadLibrary(): Promise<void> {
  try {
    const data = await api.getLists()
    setLists(data.lists, data.recent)
  } catch {
    state = { ...state, loaded: true }
    emit()
  }
}

/** 首次订阅时自动拉取一次。 */
function subscribe(onChange: () => void): () => void {
  if (!state.loaded) void loadLibrary()
  listeners.add(onChange)
  return () => { listeners.delete(onChange) }
}

export function getLibraryState(): LibraryState {
  return state
}

export function useLibrary(): LibraryState {
  return useSyncExternalStore(subscribe, () => state)
}

export function isFavorite(key: string): boolean {
  const fav = state.lists.find(list => list.id === FAV_LIST_ID)
  return !!fav?.tracks.some(track => `${track.provider}:${track.songId}` === key)
}

/** 切换本地红心；乐观更新，失败回滚。 */
export async function toggleFavorite(track: Track): Promise<boolean> {
  const key = `${track.provider}:${track.songId}`
  const willAdd = !isFavorite(key)
  // 乐观更新
  applyFavLocal(key, track, willAdd)
  try {
    if (willAdd) await api.addToList(FAV_LIST_ID, track)
    else await api.removeFromList(FAV_LIST_ID, key)
    return willAdd
  } catch {
    applyFavLocal(key, track, !willAdd) // 回滚
    return false
  }
}

function applyFavLocal(key: string, track: Track, add: boolean): void {
  const lists = state.lists.map(list => {
    if (list.id !== FAV_LIST_ID) return list
    const tracks = add
      ? [...list.tracks, track]
      : list.tracks.filter(item => `${item.provider}:${item.songId}` !== key)
    return { ...list, tracks }
  })
  setLists(lists)
}

export async function createCustomList(name: string): Promise<void> {
  const { list } = await api.createList(name)
  setLists([...state.lists, list])
}

export async function deleteCustomList(id: string): Promise<void> {
  await api.deleteList(id)
  setLists(state.lists.filter(list => list.id !== id))
}

export async function removeFromList(listId: string, track: Track): Promise<void> {
  const key = `${track.provider}:${track.songId}`
  const before = state.lists
  setLists(before.map(list => list.id === listId
    ? { ...list, tracks: list.tracks.filter(item => `${item.provider}:${item.songId}` !== key) }
    : list))
  try {
    await api.removeFromList(listId, key)
  } catch {
    setLists(before) // 回滚
  }
}
