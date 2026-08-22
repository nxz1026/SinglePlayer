/**
 * 花再同步桥（浏览器半）—— 移植 Mineradio halo-sync-bridge 模式：
 * 200ms tick 按播放进度定位当前行，仅在换行时下发；播放状态/切歌信息随事件推送。
 * 所有调用尽力而为：宿主未连接或设备不在线时静默空转。
 */

import { audioCurrentTime, getPlayerState, isPlaying } from './player.ts'
import { buildKaraokePayload, type KaraokePayload } from '../lyric/parse.ts'

const FLAG = '__dshMusicHaloBridge'
const TICK_MS = 200
const CONFIG_POLL_MS = 5000

let enabled = false
let lastLine = '__init__'
let lastPlaying = false
let lastSongSig = ''
let payload: KaraokePayload = { lines: [], source: 'line' }
let lyricSig = ''

function activeLineAt(now: number): string {
  for (let i = 0; i < payload.lines.length; i++) {
    const line = payload.lines[i]
    if (!line || line.t > now) break
    if (line.text) {
      const next = payload.lines[i + 1]
      if (!next || next.t > now) return line.text
    }
  }
  return ''
}

async function post(path: string, body: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`/api/dsh-music/halo/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch { /* 尽力而为 */ }
}

function tick(): void {
  if (!enabled) return
  const state = getPlayerState()
  const track = state.queue[state.index]
  if (!track) return

  // 切歌信息（🎵 歌名 - 歌手，设备侧停留 3 秒）
  const sig = `${track.provider}:${track.songId}`
  if (sig !== lastSongSig) {
    lastSongSig = sig
    lastLine = '__init__'
    void post('song', { name: track.name, artist: track.artists.join(' / ') })
  }

  // 播放状态变化
  const playing = isPlaying()
  if (playing !== lastPlaying) {
    lastPlaying = playing
    void post('state', { playing })
  }

  // 歌词换行推送
  const line = playing ? activeLineAt(audioCurrentTime()) : ''
  if (line && line !== lastLine) {
    lastLine = line
    void post('lyric', { text: line })
  }
}

async function refreshConfig(): Promise<void> {
  try {
    const resp = await fetch('/api/dsh-music/halo/status')
    const data = (await resp.json()) as { halo?: { enabled?: boolean } }
    enabled = data.halo?.enabled === true
  } catch {
    enabled = false
  }
}

/** 启动桥循环。幂等。 */
export function startHaloBridge(): void {
  const flags = globalThis as Record<string, unknown>
  if (flags[FLAG] === true) return
  flags[FLAG] = true

  window.setInterval(() => {
    const lyric = getPlayerState().lyric
    const sig = `${lyric.lrc.length}|${lyric.yrc.length}`
    if (sig !== lyricSig) {
      lyricSig = sig
      payload = buildKaraokePayload(lyric)
    }
  }, TICK_MS)

  void refreshConfig()
  window.setInterval(() => { void refreshConfig() }, CONFIG_POLL_MS)
  window.setInterval(tick, TICK_MS)
}
