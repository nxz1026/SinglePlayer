/**
 * 推荐与「随便听听」逻辑 —— 从 routes.ts 拆分。
 * - buildRecommendSections：每日推荐（登录）+ 热歌榜兜底
 * - buildShuffleMix：曲库随机打乱开播
 */

import * as netease from './providers/netease.ts'
import { trackKey, type Track } from './providers/types.ts'
import { getLists } from './store/library.ts'

/** 推荐分组：每日推荐（登录）+ 热歌榜兜底。 */
export async function buildRecommendSections(): Promise<Array<{ source: string; title: string; tracks: Track[] }>> {
  const sections: Array<{ source: string; title: string; tracks: Track[] }> = []

  try {
    const daily = await netease.dailyRecommend()
    if (daily.length) sections.push({ source: 'netease-daily', title: '每日推荐', tracks: daily.slice(0, 30) })
  } catch { /* 尽力而为 */ }

  if (!sections.length) {
    const tracks = await netease.chartTracksById('3778678', 30).catch(() => [] as Track[])
    if (tracks.length) sections.push({ source: 'chart-3778678', title: '热歌榜', tracks })
  }
  return sections
}

/**
 * 随便听听：曲库+红心曲目随机打乱，取前 36 首开播。
 */
export async function buildShuffleMix(): Promise<Track[]> {
  const seen = new Set<string>()
  const pool: Track[] = []
  const pushUnique = (track?: Track): void => {
    if (!track) return
    const key = trackKey(track)
    if (!key || seen.has(key)) return
    seen.add(key)
    pool.push(track)
  }

  for (const list of getLists()) for (const track of list.tracks) pushUnique(track)
  try {
    for (const track of await netease.likedTracks(300)) pushUnique(track)
  } catch { /* 未登录/网络失败则跳过 */ }

  // Fisher–Yates 洗牌取前 36
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j] as Track, pool[i] as Track]
  }
  return pool.slice(0, 36)
}