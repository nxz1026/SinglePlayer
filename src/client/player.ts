/**
 * 播放引擎 —— 页面级单例 <audio> + 轻量发布订阅 store。
 * 音频元素独立于 React 生命周期，面板开关不影响播放。
 */

import { useSyncExternalStore } from 'react'
import { api, audioProxyUrl } from './api.ts'
import type { LyricPayload, Track } from '../providers/types.ts'

export type PlayMode = 'order' | 'repeat' | 'one'

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
  return raw === 'repeat' || raw === 'one' ? raw : 'order'
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
  const nextIndex = state.index + 1
  const wrap = state.mode === 'repeat'
  if (nextIndex >= state.queue.length) {
    if (wrap) jumpTo(0)
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
  set({ loadingUrl: true, error: '', currentTime: 0, duration: track.durationMs / 1000 })
  try {
    const result = await api.songUrl(track.id, 'exhigh', track.mediaMid)
    if (!result.url) {
      set({ loadingUrl: false, error: result.reason ?? '无法获取播放地址' })
      return
    }
    if (result.vipRequired) set({ error: '' })
    currentTrackId = track.id
    audio.src = audioProxyUrl(result.url)
    audio.play().catch(() => set({ error: '浏览器阻止了自动播放，请再点一次' }))
    set({ loadingUrl: false })
    void loadLyric(track.id)
  } catch (error) {
    set({ loadingUrl: false, error: error instanceof Error ? error.message : String(error) })
  }
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
  jumpTo((state.index + 1) % state.queue.length)
}

export function prev(): void {
  if (state.queue.length === 0) return
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
  const order: PlayMode[] = ['order', 'repeat', 'one']
  const mode = order[(order.indexOf(state.mode) + 1) % order.length] ?? 'order'
  localStorage.setItem('dshm-mode', mode)
  set({ mode })
}

export function currentTrack(): Track | undefined {
  return state.queue[state.index]
}
