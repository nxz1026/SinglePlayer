/**
 * 定时任务 —— 音乐闹钟（每日 HH:mm 搜歌开播）+ 睡眠定时器（到点暂停）。
 * 受 settings.schedulerEnabled 总开关控制；触发走桥下发浏览器执行，
 * 并按通知开关做声音/音箱提醒。闹钟持久化于 $DSH_HOME/dsh-music-huazai/schedule.json。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dataDir } from './store/auth.ts'
import { getSettings } from './store/settings.ts'
import { pushCommand } from './bridge.ts'
import { dispatchNotify } from './notify.ts'
import { aggregateSearch } from './providers/merge.ts'
import type { Track } from './providers/types.ts'

export interface Alarm {
  id: string
  /** HH:mm，24 小时制本地时间。 */
  time: string
  /** 到点搜索并播放第一首的关键词。 */
  keyword: string
  label?: string
}

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

let cache: Alarm[] | null = null
const firedToday = new Set<string>()
let sleepTimer: ReturnType<typeof setTimeout> | null = null
let sleepEndsAt = 0

function file(): string {
  return join(dataDir(), 'schedule.json')
}

function loadAlarms(): Alarm[] {
  if (cache) return cache
  try {
    if (existsSync(file())) {
      const raw = JSON.parse(readFileSync(file(), 'utf8')) as unknown
      if (Array.isArray(raw)) {
        cache = raw.filter(item =>
          item && typeof (item as Alarm).id === 'string' && TIME_RE.test(String((item as Alarm).time ?? '')),
        ).map(item => ({
          id: String((item as Alarm).id),
          time: String((item as Alarm).time),
          keyword: String((item as Alarm).keyword ?? ''),
          label: typeof (item as Alarm).label === 'string' ? (item as Alarm).label : undefined,
        }))
        return cache
      }
    }
  } catch { /* 损坏重建 */ }
  cache = []
  return cache
}

function saveAlarms(): void {
  if (!cache) return
  try {
    writeFileSync(file(), JSON.stringify(cache, null, 2), 'utf8')
  } catch { /* 尽力而为 */ }
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

async function fireAlarm(alarm: Alarm): Promise<void> {
  let played = ''
  try {
    const tracks = await aggregateSearch({ keyword: alarm.keyword, limit: 1 })
    const track: Track | undefined = tracks[0]
    if (track) {
      pushCommand({ type: 'play', track })
      played = `${track.name} - ${track.artists.join(' / ')}`
    }
  } catch { /* 搜索失败也照样提醒 */ }
  pushCommand({ type: 'resume' })
  dispatchNotify(alarm.label || '音乐闹钟', played || `没找到「${alarm.keyword}」，请手动播放`)
}

function tick(): void {
  if (!getSettings().schedulerEnabled) return
  const d = new Date()
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const dayKey = todayKey()
  for (const alarm of loadAlarms()) {
    if (alarm.time !== hhmm) continue
    const key = `${alarm.id}:${dayKey}`
    if (firedToday.has(key)) continue
    firedToday.add(key)
    void fireAlarm(alarm)
  }
  if (firedToday.size > 200) {
    for (const key of firedToday) {
      if (!key.endsWith(`:${dayKey}`)) firedToday.delete(key)
    }
  }
}

// ---------------------------------------------------------------- 对外 API

export function listAlarms(): Alarm[] {
  return [...loadAlarms()]
}

export function addAlarm(time: string, keyword: string, label?: string): Alarm {
  const normalized = String(time ?? '').trim()
  if (!TIME_RE.test(normalized)) throw new Error('时间格式应为 HH:mm（24 小时制），如 07:30')
  const kw = String(keyword ?? '').trim()
  if (!kw) throw new Error('需要提供要播放的歌（keyword）')
  const alarm: Alarm = {
    id: `a${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`,
    time: normalized,
    keyword: kw,
    label: label?.trim() || undefined,
  }
  loadAlarms().push(alarm)
  saveAlarms()
  return alarm
}

export function removeAlarm(id: string): boolean {
  const list = loadAlarms()
  const before = list.length
  cache = list.filter(item => item.id !== id)
  saveAlarms()
  return cache.length !== before
}

/** 设置睡眠定时器；minutes<=0 视为取消。返回结束时间戳。 */
export function startSleepTimer(minutes: number): number {
  cancelSleepTimer()
  if (!(minutes > 0)) return 0
  sleepEndsAt = Date.now() + minutes * 60_000
  sleepTimer = setTimeout(() => {
    sleepTimer = null
    sleepEndsAt = 0
    pushCommand({ type: 'pause' })
    dispatchNotify('睡眠定时', '时间到，已暂停播放')
  }, minutes * 60_000)
  return sleepEndsAt
}

export function cancelSleepTimer(): boolean {
  if (sleepTimer) clearTimeout(sleepTimer)
  const had = sleepTimer != null
  sleepTimer = null
  sleepEndsAt = 0
  return had
}

export function sleepRemainingSec(): number {
  return sleepEndsAt > 0 ? Math.max(0, Math.round((sleepEndsAt - Date.now()) / 1000)) : 0
}

export function scheduleSnapshot(): {
  alarms: Alarm[]
  sleepRemainingSec: number
  schedulerEnabled: boolean
} {
  return {
    alarms: listAlarms(),
    sleepRemainingSec: sleepRemainingSec(),
    schedulerEnabled: getSettings().schedulerEnabled,
  }
}

const TICK_MS = 20_000

/** 启动调度循环（幂等）。 */
export function startScheduler(): () => void {
  const handle = setInterval(tick, TICK_MS)
  return () => clearInterval(handle)
}
