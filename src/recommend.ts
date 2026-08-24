/**
 * 推荐与「随便听听」逻辑 —— 从 routes.ts 拆分。
 * - buildRecommendSections：每日推荐（登录）+ 热歌榜兜底
 * - buildShuffleMix：曲库随机打乱开播
 */

import * as netease from './providers/netease.ts'
import { trackKey, type Track } from './providers/types.ts'
import { getLists } from './store/library.ts'

/**
 * 推荐分组：每日推荐（登录）+ 热歌榜兜底
 * - 登录用户：每日个性化推荐 + 按日期种子从所有榜单中随机轮换 ×2（当天稳定、跨天变化）
 * - 未登录用户：按日期种子从所有榜单中随机轮换 ×2
 */
export async function buildRecommendSections(): Promise<Array<{ source: string; title: string; tracks: Track[] }>> {
  const sections: Array<{ source: string; title: string; tracks: Track[] }> = []

  try {
    const daily = await netease.dailyRecommend()
    if (daily.length) sections.push({ source: 'netease-daily', title: '每日推荐', tracks: daily.slice(0, 30) })
  } catch { /* 尽力而为 */ }

  // 获取所有榜单，按日期种子随机选 2 个（当天固定、跨天变化）
  try {
    const toplist = await netease.toplist()
    if (toplist.length) {
      // 日期种子：YYYYMMDD → 数字
      const dateSeed = new Date()
      const seed = dateSeed.getFullYear() * 10000 + (dateSeed.getMonth() + 1) * 100 + dateSeed.getDate()
      // Fisher-Yates 洗牌（确定性种子版本）
      const shuffled = [...toplist]
      let randState = seed
      const rand = () => {
        randState = (randState * 1664525 + 1013904223) >>> 0
        return randState / 0x100000000
      }
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j] as { id: string; name: string }, shuffled[i] as { id: string; name: string }]
      }
      // 取前 2 个
      const picked = shuffled.slice(0, 2)
      for (const chart of picked) {
        const tracks = await netease.chartTracksById(chart.id, 30).catch(() => [] as Track[])
        if (tracks.length) {
          sections.push({ source: `chart-${chart.id}`, title: chart.name, tracks })
        }
      }
    }
  } catch { /* 尽力而为 */ }

  // 兜底：如果以上都没拿到，用固定热歌榜
  if (!sections.length) {
    const tracks = await netease.chartTracksById('3778678', 30).catch(() => [] as Track[])
    if (tracks.length) sections.push({ source: 'chart-3778678', title: '热歌榜', tracks })
  }
  return sections
}

/**
 * 随便听听：本地曲库 + 平台红心 混合后随机打乱开播。
 * 未登录或曲库为空时，从公开榜单（热歌/飙升/新歌等）匿名补歌，保证开播即有曲。
 */
const SHUFFLE_SIZE = 36
const FALLBACK_CHARTS = ['3778678', '19723756', '3779629', '2884035']

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

  // 池子不足时，从公开榜单匿名补歌（无需登录）。
  if (pool.length < SHUFFLE_SIZE) {
    for (const chartId of FALLBACK_CHARTS) {
      if (pool.length >= SHUFFLE_SIZE) break
      try {
        const tracks = await netease.chartTracksById(chartId, 30)
        for (const track of tracks) pushUnique(track)
      } catch { /* 榜单失败时试下一个 */ }
    }
  }

  // Fisher–Yates 洗牌取前 SHUFFLE_SIZE
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j] as Track, pool[i] as Track]
  }
  return pool.slice(0, SHUFFLE_SIZE)
}