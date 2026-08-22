/**
 * 播放引擎 —— 页面级单例 <audio> + 轻量发布订阅 store。
 * 音频元素独立于 React 生命周期，面板开关不影响播放。
 */

import { useSyncExternalStore } from 'react'
import { api, audioProxyUrl, bridgePoll, bridgeReport } from './api.ts'
import type { NowPlayingReport } from './api.ts'
import type { LyricPayload, Track } from '../providers/types.ts'

export type PlayMode = 'order' | 'repeat' | 'one' | 'random'

export interface LyricLine {
  t: number
  text: string
}

export interface PlayerState {
  queue: Track[]
  index: number
  playing: boolean
  currentTime: number
  duration: number
  loadingUrl: boolean
  error: string
  note: string
  volume: number
  mode: PlayMode
  lyric: LyricPayload
}

const initial: PlayerState = {
  queue: [],
  index: -1,
  playing: false,
  currentTime: 0,
  duration: 0,
  loadingUrl: false,
  error: '',
  note: '',
  volume: readVolume(),
  mode: readMode(),
  lyric: { lrc: '', tlyric: '', yrc: '', roma: '' },
}

let state: PlayerState = initial
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function set(patch: Partial<PlayerState>): void {
  state = { ...state, ...patch }
  emit()
}

export function getPlayerState(): PlayerState {
  return state
}

export function usePlayer<T>(selector: (s: PlayerState) => T): T {
  return useSyncExternalStore(
    onChange => { listeners.add(onChange); return () => { listeners.delete(onChange) } },
    () => selector(state),
  )
}

// ---------------------------------------------------------------- persist

function readVolume(): number {
  const raw = Number(localStorage.getItem('dshm-volume'))
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 1) : 0.9
}

function readMode(): PlayMode {
  const raw = localStorage.getItem('dshm-mode')
  return raw === 'repeat' || raw === 'one' || raw === 'random' ? raw : 'order'
}

// ---------------------------------------------------------------- audio

const audio: HTMLAudioElement = document.createElement('audio')
audio.preload = 'auto'
audio.volume = state.volume

let currentTrackId = ''

audio.addEventListener('timeupdate', () => set({ currentTime: audio.currentTime }))
audio.addEventListener('durationchange', () => set({ duration: audio.duration || 0 }))
audio.addEventListener('play', () => set({ playing: true }))
audio.addEventListener('pause', () => set({ playing: false }))
audio.addEventListener('ended', () => onEnded())

function onEnded(): void {
  if (state.mode === 'one') {
    audio.currentTime = 0
    void audio.play().catch(() => {})
    return
  }
  jumpToNext()
}

/** 随机模式取一个不同于当前的索引；其余模式顺序推进。 */
export function jumpToNext(): void {
  const queue = state.queue
  if (queue.length === 0) return
  if (state.mode === 'random' && queue.length > 1) {
    let index = state.index
    while (index === state.index) {
      index = Math.floor(Math.random() * queue.length)
    }
    jumpTo(index)
    return
  }
  const nextIndex = state.index + 1
  if (nextIndex >= queue.length) {
    if (state.mode === 'repeat') jumpTo(0)
    else set({ playing: false })
    return
  }
  jumpTo(nextIndex)
}

/** 简易 LRC 行解析（完整逐字解析在 M4）。 */
function parseLrcLines(text: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const line of text.split('\n')) {
    let match: RegExpExecArray | null
    const tag = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g
    const stamps: number[] = []
    while ((match = tag.exec(line)) !== null) {
      stamps.push(Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] ?? '0'}`))
    }
    const textPart = line.replace(/\[[^\]]*\]/g, '').trim()
    if (textPart) {
      for (const t of stamps) lines.push({ t, text: textPart })
    }
  }
  return lines.sort((a, b) => a.t - b.t)
}

export function currentLyricLines(): LyricLine[] {
  const source = state.lyric.lrc || ''
  return parseLrcLines(source)
}

async function resolveAndPlay(track: Track): Promise<void> {
  set({ loadingUrl: true, error: '', note: '', currentTime: 0, duration: track.durationMs / 1000 })
  try {
    const quality = getQualityPref()
    let result = await api.songUrl(track.id, quality, track.mediaMid)
    // 同平台音质自动降级：偏好档拿不到就降到标准档再试。
    if (!result.url && quality !== 'standard') {
      result = await api.songUrl(track.id, 'standard', track.mediaMid)
      if (result.url) set({ note: '已降级为标准音质' })
    }
    if (!result.url) {
      // 跨平台音源回退：当前平台取流失败时，尝试另一平台的同名曲目。
      const fallback = await findFallback(track, quality)
      if (fallback) {
        replaceCurrent(fallback)
        return
      }
      const friendly = /VIP|未登录/.test(result.reason ?? '')
        ? `VIP 曲目：请在「账号」页登录${track.provider === 'qq' ? ' QQ' : ''}后播放`
        : result.reason ?? '无法获取播放地址'
      set({ loadingUrl: false, error: friendly })
      return
    }
    currentTrackId = track.id
    audio.src = audioProxyUrl(result.url)
    audio.play().catch(() => set({ error: '浏览器阻止了自动播放，请再点一次' }))
    set({ loadingUrl: false })
    void loadLyric(track.id)
  } catch (error) {
    set({ loadingUrl: false, error: error instanceof Error ? error.message : String(error) })
  }
}

/** 在另一平台搜索同名歌曲并验证可播，返回第一个可用的候选。 */
async function findFallback(track: Track, quality: string): Promise<Track | undefined> {
  const other = track.provider === 'qq' ? 'netease' : 'qq'
  try {
    const { tracks } = await api.search(`${track.name} ${track.artists[0] ?? ''}`.trim(), 8)
    const wanted = normalizeName(track.name)
    const candidates = tracks.filter(item => {
      if (item.provider !== other) return false
      const name = normalizeName(item.name)
      return name.includes(wanted) || wanted.includes(name)
    })
    for (const candidate of candidates.slice(0, 3)) {
      let probe = await api.songUrl(candidate.id, quality, candidate.mediaMid)
      if (!probe.url && quality !== 'standard') {
        probe = await api.songUrl(candidate.id, 'standard', candidate.mediaMid)
      }
      if (probe.url) {
        set({ note: `已切换音源（${candidate.provider}）` })
        return candidate
      }
    }
  } catch { /* 回退尽力而为 */ }
  return undefined
}

function normalizeName(name: string): string {
  return name.replace(/[\s（）()【】\[\]-—_·.,，。!！?？'’"]+/g, '').toLowerCase()
}

/** 用回退曲目替换队列中的当前曲目并立即播放。 */
function replaceCurrent(track: Track): void {
  const queue = [...state.queue]
  queue[state.index] = track
  set({ queue })
  jumpTo(state.index)
}

async function loadLyric(trackId: string): Promise<void> {
  try {
    const { lyric } = await api.lyric(trackId)
    if (currentTrackId === trackId) set({ lyric })
  } catch {
    // 歌词尽力而为。
  }
}

// ---------------------------------------------------------------- actions

export function playTrack(track: Track): void {
  const existing = state.queue.findIndex(item => item.id === track.id)
  if (existing >= 0) {
    jumpTo(existing)
    return
  }
  const queue = [...state.queue, track]
  set({ queue })
  jumpTo(queue.length - 1)
}

export function addToQueue(track: Track): void {
  if (state.queue.some(item => item.id === track.id)) return
  set({ queue: [...state.queue, track] })
}

export function removeFromQueue(index: number): void {
  const wasCurrent = index === state.index
  const queue = state.queue.filter((_, i) => i !== index)
  if (wasCurrent) {
    stop()
    set({ queue, index: -1 })
    if (index < queue.length && queue.length > 0) jumpTo(Math.min(index, queue.length - 1))
    else set({ queue, index: -1 })
    return
  }
  set({
    queue,
    index: index < state.index ? state.index - 1 : state.index,
  })
}

export function clearQueue(): void {
  stop()
  set({ queue: [], index: -1 })
}

export function playAll(tracks: Track[]): void {
  if (!tracks.length) return
  set({ queue: [...tracks] })
  jumpTo(0)
}

export function jumpTo(index: number): void {
  const track = state.queue[index]
  if (!track) return
  set({ index })
  void resolveAndPlay(track)
}

export function next(): void {
  if (state.queue.length === 0) return
  jumpToNext()
}

export function prev(): void {
  if (state.queue.length === 0) return
  // 随机模式下上一首也随机（简单实现，不做历史栈）。
  if (state.mode === 'random' && state.queue.length > 1) {
    let index = state.index
    while (index === state.index) {
      index = Math.floor(Math.random() * state.queue.length)
    }
    jumpTo(index)
    return
  }
  jumpTo((state.index - 1 + state.queue.length) % state.queue.length)
}

export function stop(): void {
  audio.pause()
  audio.removeAttribute('src')
  currentTrackId = ''
  set({ playing: false, currentTime: 0, duration: 0, lyric: { lrc: '', tlyric: '', yrc: '', roma: '' } })
}

export function toggle(): void {
  if (state.index < 0) {
    if (state.queue.length > 0) jumpTo(Math.max(state.index, 0))
    return
  }
  if (audio.paused) void audio.play().catch(() => {})
  else audio.pause()
}

export function seek(time: number): void {
  audio.currentTime = time
  set({ currentTime: time })
}

export function setVolume(volume: number): void {
  audio.volume = volume
  localStorage.setItem('dshm-volume', String(volume))
  set({ volume })
}

export function cycleMode(): void {
  const order: PlayMode[] = ['order', 'repeat', 'one', 'random']
  const mode = order[(order.indexOf(state.mode) + 1) % order.length] ?? 'order'
  localStorage.setItem('dshm-mode', mode)
  set({ mode })
}

/** 音质偏好（设置面板可调，默认 exhigh）。 */
export function getQualityPref(): string {
  return localStorage.getItem('dshm-quality') ?? 'exhigh'
}

export function setQualityPref(quality: string): void {
  localStorage.setItem('dshm-quality', quality)
}

export function currentTrack(): Track | undefined {
  return state.queue[state.index]
}

/** 卡拉OK逐帧渲染用的精确时间源（绕过 React 状态的 ~4Hz 节流）。 */
export function audioCurrentTime(): number {
  return audio.currentTime
}

export function isPlaying(): boolean {
  return !audio.paused && !audio.ended
}

// ---------------------------------------------------------------- AI 桥

const BRIDGE_FLAG = '__dshMusicBridgeStarted'
const POLL_MS = 2000

/**
 * 启动浏览器↔宿主桥：每 2s 上报播放状态并取走 AI 下发的命令。
 * 幂等；面板是否展开不影响。
 */
export function startAiBridge(): void {
  const flags = globalThis as Record<string, unknown>
  if (flags[BRIDGE_FLAG] === true) return
  flags[BRIDGE_FLAG] = true

  window.setInterval(() => {
    void bridgePoll().then(commands => {
      for (const command of commands) executeCommand(command)
    })
    if (state.index >= 0) {
      const track = state.queue[state.index]
      if (track) {
        const report: NowPlayingReport = {
          trackId: track.id,
          name: track.name,
          artists: track.artists,
          album: track.album,
          provider: track.provider,
          positionSec: audio.currentTime,
          durationSec: audio.duration || track.durationMs / 1000,
          playing: !audio.paused,
        }
        void bridgeReport(report)
      }
    }
  }, POLL_MS)
}

function executeCommand(command: { type: 'play' | 'pause' | 'resume' | 'next' | 'prev'; track?: Track }): void {
  switch (command.type) {
    case 'play':
      if (command.track) playTrack(command.track)
      else toggle()
      break
    case 'pause':
      audio.pause()
      break
    case 'resume':
      void audio.play().catch(() => {})
      break
    case 'next':
      next()
      break
    case 'prev':
      prev()
      break
  }
}
