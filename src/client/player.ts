/**
 * 播放引擎 —— 页面级单例 <audio> + 轻量发布订阅 store。
 * 音频元素独立于 React 生命周期，面板开关不影响播放。
 */

import { useSyncExternalStore } from 'react'
import { api, audioProxyUrl, bridgePoll, bridgeReport } from './api.ts'
import type { NowPlayingReport } from '../providers/types.ts'
import type { BridgeCommand, LyricPayload, PlayModeId, Track } from '../providers/types.ts'
import { parseLyricText } from '../lyric/parse.ts'

export type PlayMode = PlayModeId

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
  showLyric: boolean
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
  showLyric: localStorage.getItem('dshm-showlyric') !== '0',
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

let cachedLrcText = ''
let cachedLines: { t: number; text: string }[] = []

export function currentLyricLines(): { t: number; text: string }[] {
  const source = state.lyric.lrc || ''
  if (source !== cachedLrcText) {
    cachedLrcText = source
    cachedLines = parseLyricText(source)
  }
  return cachedLines
}

// ---------------------- 播放解析（音源回退，骨架移植自 Mineradio provider-fallback）----------------------

/** 归一化匹配文本：去括号内容与全部标点空白（Mineradio normalizeMatchText）。 */
function normalizeMatchText(text: string): string {
  return String(text ?? '').toLowerCase()
    .replace(/[（(【[].*?[）)】\]]/g, '')
    .replace(/[\s·・\-—_.,，。:：'"“”‘’/\\|]+/g, '')
}

function artistNamePartsOf(artists: string[]): string[] {
  return artists.map(name => normalizeMatchText(name)).filter(Boolean)
}

/** 同名同歌手判定（Mineradio isSameTitleArtist 移植）：标题归一化相等 + 歌手交集。 */
function isSameTitleArtist(source: Track, candidate: Track): boolean {
  const titleA = normalizeMatchText(source.name)
  const titleB = normalizeMatchText(candidate.name)
  if (!titleA || !titleB || titleA !== titleB) return false
  const a = artistNamePartsOf(source.artists)
  const b = artistNamePartsOf(candidate.artists)
  if (!a.length || !b.length) return false
  return a.some(name => b.includes(name))
}

const PROVIDER_LABEL: Record<string, string> = { qq: 'QQ 音乐', netease: '网易云' }

const FALLBACK_BUDGET_MS = 20_000
const MAX_QUEUE_ADVANCES = 2
const MAX_PROVIDER_ATTEMPTS = 4

interface FallbackRecovery {
  deadlineAt: number
  visited: Set<string>
  advances: number
  attempts: number
}

let activeRecovery: FallbackRecovery | undefined
let playSerial = 0

function keyOf(track: Track): string {
  return `${track.provider}:${normalizeMatchText(track.name)}|${artistNamePartsOf(track.artists).sort().join(',')}`
}

function ensureRecovery(seedTrack: Track): FallbackRecovery {
  if (!activeRecovery || Date.now() > activeRecovery.deadlineAt) {
    activeRecovery = {
      deadlineAt: Date.now() + FALLBACK_BUDGET_MS,
      visited: new Set([keyOf(seedTrack)]),
      advances: 0,
      attempts: 0,
    }
  }
  return activeRecovery
}

function completeRecovery(): void {
  activeRecovery = undefined
}

// 平台登录态缓存（决定换源优先顺序：已登录平台优先）。
let platformsAt = 0
const platformLoggedInMap: Record<string, boolean> = {}

async function refreshPlatforms(): Promise<void> {
  try {
    const { providers } = await api.authStatus()
    for (const item of providers) platformLoggedInMap[item.provider] = item.loggedIn
    platformsAt = Date.now()
  } catch { /* 尽力而为 */ }
}

async function orderedAlternates(currentProvider: string): Promise<string[]> {
  if (Date.now() - platformsAt > 60_000) await refreshPlatforms()
  const others = currentProvider === 'qq' ? ['netease'] : ['qq']
  // 已登录平台排前面（取流成功率更高）；匿名平台仍可作为兜底。
  return others.sort((a, b) => Number(platformLoggedInMap[b] ?? false) - Number(platformLoggedInMap[a] ?? false))
}

interface PlayOpts {
  /** 回退链深度：>0 表示当前曲目已是换源结果，不再二次回退。 */
  depth?: number
  /** 队列跳歌推进次数（跨整条回退链共享）。 */
  advances?: number
}

async function resolveAndPlay(track: Track): Promise<void> {
  playSerial += 1
  activeRecovery = undefined // 用户主动点播：全新预算
  await fetchAndCommit(track, { depth: 0 }, playSerial)
}

async function fetchAndCommit(track: Track, opts: PlayOpts, myToken: number): Promise<boolean> {
  const depth = opts.depth ?? 0
  set({ loadingUrl: true, error: '', currentTime: 0, duration: track.durationMs / 1000 })
  try {
    const quality = getQualityPref()
    let result = await api.songUrl(track.id, quality, track.mediaMid)
    // 同平台音质自动降级：偏好档拿不到就降到标准档再试。
    if (!result.url && quality !== 'standard') {
      result = await api.songUrl(track.id, 'standard', track.mediaMid)
    }
    if (myToken !== playSerial) return false // 用户点了别的歌，本次作废
    if (result.url) {
      commitPlay(track, result.url)
      completeRecovery()
      return true
    }
    if (depth > 0) return false // 换源曲目再失败：不递归，交由上层终局
    return await handleUnplayable(track, myToken, result.reason ?? '', opts)
  } catch (error) {
    if (myToken !== playSerial) return false
    set({ loadingUrl: false, error: error instanceof Error ? error.message : String(error) })
    return false
  }
}

function commitPlay(track: Track, url: string): void {
  currentTrackId = track.id
  audio.src = audioProxyUrl(url)
  audio.play().catch(() => set({ error: '浏览器阻止了自动播放，请再点一次' }))
  set({ loadingUrl: false })
  api.recordPlay(track)
  void loadLyric(track.id)
}

/** 随便听听：服务端合成曲库+红心 Top30 与 6 首随机的混合列表，一键替换队列并开播。 */
export async function startRandomMix(): Promise<number> {
  set({ note: '正在生成随机歌单…', error: '' })
  try {
    const { tracks } = await api.shuffleMix()
    if (!tracks.length) {
      set({ note: '' })
      return 0
    }
    set({ queue: [...tracks], index: -1 })
    jumpTo(0)
    return tracks.length
  } catch (error) {
    set({ note: '', error: error instanceof Error ? error.message : String(error) })
    return 0
  }
}

function friendlyReason(reason: string, track: Track): string {
  if (/VIP|未登录/.test(reason)) {
    return `${PROVIDER_LABEL[track.provider] ?? track.provider} 曲目为 VIP/需登录：请在「账号」页登录后播放`
  }
  if (/NETEASE_URL/.test(reason)) return '网易云无可用音源（版权限制或已下架）'
  return reason || '无法获取播放地址'
}

async function handleUnplayable(
  failedTrack: Track,
  myToken: number,
  reason: string,
  opts: PlayOpts,
): Promise<boolean> {
  const recovery = ensureRecovery(failedTrack)
  const advances = opts.advances ?? 0

  // 1) 跨平台同名同歌手换源。
  const alternates = await orderedAlternates(failedTrack.provider)
  if (myToken !== playSerial) return false
  for (const provider of alternates) {
    if (Date.now() > recovery.deadlineAt || recovery.attempts >= MAX_PROVIDER_ATTEMPTS) break
    recovery.attempts += 1
    let candidate: Track | undefined
    try {
      const query = `${failedTrack.name} ${failedTrack.artists[0] ?? ''}`.trim()
      const { tracks } = await api.search(query, 12)
      candidate = tracks.find(item => item.provider === provider && isSameTitleArtist(failedTrack, item))
    } catch { continue }
    if (myToken !== playSerial) return false
    if (!candidate || recovery.visited.has(keyOf(candidate))) continue
    recovery.visited.add(keyOf(candidate))
    let probe = await api.songUrl(candidate.id, getQualityPref(), candidate.mediaMid)
    if (!probe.url) probe = await api.songUrl(candidate.id, 'standard', candidate.mediaMid)
    if (myToken !== playSerial) return false
    if (!probe.url) continue
    // 命中：把队列中的当前项替换为可播的跨平台版本并接续播放（depth=1 防递归）。
    const queue = [...state.queue]
    queue[state.index] = candidate
    set({ queue, note: `已自动切换音源（${PROVIDER_LABEL[provider] ?? provider}）` })
    return await fetchAndCommit(candidate, { depth: 1, advances }, myToken)
  }

  // 2) 换源无果：队列里还有别的歌就跳下一首（限次，防循环扫描）。
  recovery.visited.add(keyOf(failedTrack))
  if (state.queue.length > 1 && advances < MAX_QUEUE_ADVANCES && Date.now() <= recovery.deadlineAt) {
    for (let step = 1; step < state.queue.length; step++) {
      const index = (state.index + step) % state.queue.length
      const nextTrack = state.queue[index]
      if (!nextTrack || recovery.visited.has(keyOf(nextTrack))) continue
      recovery.advances = advances + 1
      recovery.visited.add(keyOf(nextTrack))
      set({ note: '已跳过不可播放歌曲', index })
      return await fetchAndCommit(nextTrack, { depth: 0, advances: advances + 1 }, myToken)
    }
  }

  // 3) 终局：明确的失败原因。
  activeRecovery = undefined
  set({ loadingUrl: false, error: friendlyReason(reason, failedTrack) })
  return false
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
  setMode(mode)
}

/** 直接设置播放模式（AI 命令通道用）。 */
export function setMode(mode: PlayMode): void {
  localStorage.setItem('dshm-mode', mode)
  set({ mode })
}

/** 提示音：优先用户上传的自定义音频；失败回退 Web Audio 内置双音。 */
let chimeCtx: AudioContext | null = null

async function playCustomSound(): Promise<boolean> {
  try {
    const resp = await fetch('/api/dsh-music/notify/sound/info')
    const info = (await resp.json()) as { exists?: boolean }
    if (!info?.exists) return false
    const audio = new Audio(`/api/dsh-music/notify/sound/file?v=${Date.now()}`)
    audio.volume = Math.min(1, Math.max(state.volume, 0.6))
    await audio.play()
    return true
  } catch {
    return false
  }
}

function playBuiltInChime(): void {
  try {
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    chimeCtx = chimeCtx ?? new Ctor()
    const ctx = chimeCtx
    if (ctx.state === 'suspended') void ctx.resume()
    const t0 = ctx.currentTime + 0.02
    for (const [index, freq] of [880, 1174.66].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const start = t0 + index * 0.16
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.38)
    }
  } catch { /* 尽力而为 */ }
}

function playChime(): void {
  void playCustomSound().then(ok => { if (!ok) playBuiltInChime() })
}

/** 音质偏好（设置面板可调，默认 exhigh）。 */
export function getQualityPref(): string {
  return localStorage.getItem('dshm-quality') ?? 'exhigh'
}

export function setQualityPref(quality: string): void {
  localStorage.setItem('dshm-quality', quality)
}

/** 歌词显示开关（仅控制界面；不影响花再音箱同步）。 */
export function toggleShowLyric(): void {
  const next = !state.showLyric
  localStorage.setItem('dshm-showlyric', next ? '1' : '0')
  set({ showLyric: next })
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

  // 平台登录态预取（换源排序用）。
  void refreshPlatforms()

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

function executeCommand(command: BridgeCommand): void {
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
    case 'queue_add': {
      let added = 0
      for (const track of command.tracks) {
        if (!state.queue.some(item => item.id === track.id)) added += 1
        addToQueue(track)
      }
      set({ note: `已加入队列 ${added} 首` })
      window.setTimeout(() => { if (state.note.startsWith('已加入队列')) set({ note: '' }) }, 3000)
      break
    }
    case 'queue_clear':
      clearQueue()
      break
    case 'volume': {
      const value = Math.min(1, Math.max(0, command.value))
      setVolume(value)
      set({ note: `音量 ${Math.round(value * 100)}%` })
      window.setTimeout(() => { if (state.note.startsWith('音量')) set({ note: '' }) }, 2500)
      break
    }
    case 'seek':
      if (Number.isFinite(command.position)) seek(Math.max(0, command.position))
      break
    case 'mode':
      setMode(command.mode)
      set({ note: `播放模式：${command.mode}` })
      window.setTimeout(() => { if (state.note.startsWith('播放模式')) set({ note: '' }) }, 2500)
      break
    case 'notify': {
      playChime()
      const text = `🔔 ${command.title}${command.text ? `：${command.text}` : ''}`
      set({ note: text })
      window.setTimeout(() => { if (state.note === text) set({ note: '' }) }, 6000)
      break
    }
  }
}
