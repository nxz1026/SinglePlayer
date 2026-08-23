/** 平台统一模型与 Provider 契约。 */

/** 平台 id（开放：新增源只需实现 MusicProvider 并向 registry 注册，不必改此联合类型）。 */
export type ProviderId = string

/** 内置已知平台（仅用于 UI/默认启用，非白名单）。 */
export const KNOWN_PROVIDERS = ['netease', 'qq', 'kugou'] as const

/**
 * 音乐源契约 —— 所有平台（网易/QQ/新增源）统一实现此接口。
 * 新增一个音源 = 新建一个 providers/<x>.ts 实现本接口 + registerProvider 一处，
 * 无需改动 routes/tools/merge 等消费方（对标 HaloLyricSync 的 base.py + factory.py）。
 */
export interface MusicProvider {
  /** 平台限定 id（如 'netease' / 'qq' / 'lx'）。 */
  readonly id: ProviderId
  /** UI 展示名。 */
  readonly label: string
  /** 可选描述（设置面板用）。 */
  readonly description?: string
  /** 搜索：返回统一 Track 列表。 */
  search(keyword: string, limit: number, offset: number): Promise<Track[]>
  /** 取直链；extra 透传平台特有参数（如 QQ 的 mediaMid）。 */
  songUrl(songId: string, quality: Quality, extra?: Record<string, string>): Promise<SongUrlResult>
  /** 取歌词；extra 透传平台特有参数（如 QQ 的 numericId）。 */
  lyric(songId: string, extra?: Record<string, string>): Promise<LyricPayload>
  /** 登录态。 */
  authStatus(): Promise<AuthStatusItem>
  /** 可选：每日推荐（如网易）。 */
  dailyRecommend?(): Promise<Track[]>
  /** 可选：榜单曲目（如网易）。 */
  chartTracksById?(id: string, limit: number): Promise<Track[]>
  /** 可选：已登录用户的红心曲目（如网易）。 */
  likedTracks?(max?: number): Promise<Track[]>
}

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
