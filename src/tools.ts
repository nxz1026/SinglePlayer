/**
 * AI 工具集 —— DeepSeek 可对话点歌/控制播放/查询状态。
 * 播放执行经 bridge 下发给浏览器半（≤2s 轮询延迟）。
 */

import { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { pushCommand } from './bridge.ts'
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
import type { BridgeCommand, NowPlayingReport } from './bridge.ts'
import { getNowPlaying } from './routes.ts'
import * as netease from './providers/netease.ts'
import * as qq from './providers/qq.ts'
import { aggregateSearch } from './providers/merge.ts'
import type { ProviderId, Track } from './providers/types.ts'

/** 工具注册需要的服务。 */
export const inject = ['tools'] as const

interface SearchHit {
  id: string
  name: string
  artists: string
  album: string
  vip: boolean
}

async function searchHits(query: string, platform: string | undefined, limit: number): Promise<SearchHit[]> {
  const providers: ProviderId[] | undefined = platform === 'netease' || platform === 'qq' ? [platform] : undefined
  const tracks = await aggregateSearch({ keyword: query, limit, providers })
  return tracks.map(track => ({
    id: track.id,
    name: track.name,
    artists: track.artists.join(' / '),
    album: track.album,
    vip: track.vip === true,
  }))
}

function formatHits(hits: SearchHit[]): string {
  if (!hits.length) return '没有找到相关歌曲'
  return hits
    .map((hit, i) => `${i + 1}. ${hit.id} | ${hit.name} - ${hit.artists}${hit.vip ? ' [VIP]' : ''}`)
    .join('\n')
}

const trackSummary = (track: Track): string => `${track.name} - ${track.artists.join(' / ')}`

export function registerTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'music_search',
    description: '搜索音乐（聚合网易云与QQ音乐）。返回曲目 id 列表，可用 music_play 的 track_id 参数播放。',
    parameters: {
      query: { type: 'string', required: true, description: '歌名/歌手关键词' },
      platform: { type: 'string', description: '限定平台：netease 或 qq，默认全部' },
      limit: { type: 'number', description: '每个平台返回数量上限，默认 6' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: formatHits(value as unknown as SearchHit[]) }],
    },
    async execute(args): Promise<JsonValue> {
      return await searchHits(args.query, args.platform, args.limit ?? 6) as unknown as JsonValue
    },
  }))

  ctx.tools.register(defineTool({
    name: 'music_play',
    description: '播放指定歌曲。优先传 track_id（来自 music_search）；只传 query 时自动选第一首。用户说"放一首XX"用这个。',
    parameters: {
      track_id: { type: 'string', description: '曲目 id，如 netease:347230 或 qq:0039MnYb0qxYhV' },
      query: { type: 'string', description: '无 track_id 时按关键词搜索并播第一首' },
      platform: { type: 'string', description: 'query 搜索时可限定平台' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: String((value as Record<string, unknown>).message ?? '') }],
    },
    async execute(args) {
      if (args.track_id) {
        const parsed = parseIdLoose(args.track_id)
        if (!parsed) throw new Error(`bad track_id: ${args.track_id}`)
        const track: Track = {
          ...parsed,
          name: parsed.name || args.track_id,
          artists: [],
          album: '',
          durationMs: 0,
          cover: '',
        }
        // 补全元数据：从搜索结果中找同名 id；找不到就先搜一轮。
        const hits = await aggregateSearch({ keyword: track.name, limit: 10 })
        const matched = hits.find(item => item.id === args.track_id)
        if (matched) Object.assign(track, matched, { songId: matched.songId })
        queueOrThrow({ type: 'play', track })
        return { message: `已下发播放：${matched ? trackSummary(matched) : track.name}（浏览器将在数秒内响应）` }
      }
      const query = (args.query ?? '').trim()
      if (!query) throw new Error('需要 track_id 或 query')
      const hits = await searchHits(query, args.platform, 1)
      const first = hits[0]
      if (!first) throw new Error(`没找到"${query}"`)
      const tracks = await aggregateSearch({ keyword: query, limit: 8 })
      const match = tracks.find(item => item.id === first.id)
      if (!match) throw new Error('搜索结果异常')
      queueOrThrow({ type: 'play', track: match })
      return { message: `已下发播放：${trackSummary(match)}` }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'music_control',
    description: '控制播放器：pause(暂停)/resume(继续)/next(下一首)/prev(上一首)。',
    parameters: {
      action: { type: 'string', required: true, description: 'pause | resume | next | prev' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: String((value as Record<string, unknown>).message ?? '') }],
    },
    isConcurrencySafe: () => false,
    async execute(args) {
      const action = args.action.toLowerCase().trim()
      if (action !== 'pause' && action !== 'resume' && action !== 'next' && action !== 'prev') {
        throw new Error(`bad action: ${args.action}`)
      }
      queueOrThrow({ type: action } as BridgeCommand)
      return { message: `已下发：${action}` }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'music_now_playing',
    description: '查询当前播放状态：正在播放的曲名、歌手、进度、是否暂停。',
    parameters: {},
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: describeNowPlaying(value as never) }],
    },
    execute(): Promise<JsonValue> {
      return Promise.resolve(nowPlayingText() as unknown as JsonValue)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'music_lyric',
    description: '获取歌词文本（LRC）。不传 track_id 时返回当前播放歌曲的歌词。',
    parameters: {
      track_id: { type: 'string', description: 'netease:<id> 或 qq:<mid>' },
      max_chars: { type: 'number', description: '返回文本长度上限，默认 3000' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: String((value as Record<string, unknown>).lyric ?? '') }],
    },
    async execute(args) {
      const maxChars = Math.min(Math.max(args.max_chars ?? 3000, 200), 8000)
      let provider: 'netease' | 'qq'
      let songId: string
      if (args.track_id) {
        const parsed = parseIdLoose(args.track_id)
        if (!parsed) throw new Error(`bad track_id: ${args.track_id}`)
        provider = parsed.provider
        songId = parsed.songId
      } else {
        const current = getNowPlaying()
        if (!current) throw new Error('当前没有播放中的歌曲，请提供 track_id')
        provider = current.provider === 'qq' ? 'qq' : 'netease'
        songId = current.trackId.split(':')[1] ?? ''
      }
      const payload = provider === 'qq' ? await qq.lyric(songId) : await netease.lyric(songId)
      const lyric = payload.lrc.slice(0, maxChars) || '(无歌词)'
      return { lyric }
    },
  }))
}

function nowPlayingText(): Record<string, unknown> {
  const snapshot = getNowPlaying()
  if (!snapshot) return { playing: false, message: '浏览器端未连接或尚未开始播放' }
  const position = formatTime(snapshot.positionSec)
  const duration = snapshot.durationSec > 0 ? formatTime(snapshot.durationSec) : '?'
  return {
    playing: snapshot.playing,
    track: snapshot.name,
    artists: snapshot.artists.join(' / '),
    position,
    duration,
    message: snapshot.playing ? '正在播放' : '已暂停',
  }
}

function describeNowPlaying(value: Record<string, unknown>): string {
  if (value.playing !== true && !value.track) return String(value.message ?? '未在播放')
  return `${String(value.playing === true ? '▶ 正在播放' : '⏸ 已暂停')}：${String(value.track ?? '?')} - ${String(value.artists ?? '')} (${String(value.position ?? '')}/${String(value.duration ?? '')})`
}

function parseIdLoose(id: string): Partial<Track> & { provider: 'netease' | 'qq'; songId: string; id: string } | undefined {
  const index = id.indexOf(':')
  if (index <= 0) return undefined
  const provider = id.slice(0, index)
  const songId = id.slice(index + 1)
  if ((provider !== 'netease' && provider !== 'qq') || !songId) return undefined
  return { provider, songId, id, name: '' }
}

function queueOrThrow(command: BridgeCommand): void {
  if (!pushCommand(command)) throw new Error('命令队列已满，请稍后重试')
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
