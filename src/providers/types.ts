/** 平台统一模型与 Provider 契约。 */

export type ProviderId = 'netease' | 'qq'

/** 统一曲目（跨平台聚合的最小公共面）。 */
export interface Track {
  /** 平台限定 id：`netease:123456` / `qq:003aZ8...` */
  id: string
  provider: ProviderId
  /** 平台原生 id（网易数字 id / QQ mid） */
  songId: string
  name: string
  artists: string[]
  album: string
  durationMs: number
  cover: string
  /** VIP/付费提示。 */
  vip?: boolean
  /** QQ media_mid（取流候选文件名用）。 */
  mediaMid?: string
}

/** 音质偏好（对齐 Mineradio 的 level 词表）。 */
export type Quality = 'standard' | 'exhigh' | 'lossless' | 'hires' | 'jymaster'

/** 取流结果。url 为空表示不可播，reason 说明原因。 */
export interface SongUrlResult {
  url: string
  quality?: string
  trial?: boolean
  vipRequired?: boolean
  reason?: string
}

/** 歌词载荷（原始文本，解析在 lyric/parse.ts）。 */
export interface LyricPayload {
  lrc: string
  tlyric: string
  /** 网易逐字 / QQ 逐字原始文本。 */
  yrc: string
  roma: string
}

export interface AuthStatusItem {
  provider: ProviderId
  loggedIn: boolean
  nickname?: string
  avatar?: string
  vipLabel?: string
}

// ---------------------------------------------------------------- 桥类型

export interface NowPlayingReport {
  trackId: string
  name: string
  artists: string[]
  album: string
  provider: string
  positionSec: number
  durationSec: number
  playing: boolean
}

export type BridgeCommand =
  | { type: 'play'; track: Track }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'next' }
  | { type: 'prev' }
  /** 把曲目追加进队列（不改变当前播放）。 */
  | { type: 'queue_add'; tracks: Track[] }
  | { type: 'queue_clear' }
  /** 音量 0-1。 */
  | { type: 'volume'; value: number }
  /** 跳转进度（秒）。 */
  | { type: 'seek'; position: number }
  /** 播放模式。 */
  | { type: 'mode'; mode: PlayModeId }
  /** 提醒：浏览器半播放提示音（独立于音箱文字提醒）。 */
  | { type: 'notify'; title: string; text: string }

/** 播放模式词表（宿主工具与浏览器半共用）。 */
export type PlayModeId = 'order' | 'repeat' | 'one' | 'random'

/** 曲目唯一键 `${provider}:${songId}`。 */
export function trackKey(track: Pick<Track, 'provider' | 'songId'>): string {
  return `${track.provider}:${track.songId}`
}
