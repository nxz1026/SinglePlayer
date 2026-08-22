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
