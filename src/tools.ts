/**
 * AI 工具集 —— DeepSeek 可对话点歌/控制播放/查询状态。
 * 播放执行经 bridge 下发给浏览器半（≤2s 轮询延迟）。
 */

import { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { pushCommand } from './bridge.ts'
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
import { getNowPlaying } from './routes.ts'
import type { BridgeCommand, NowPlayingReport } from './providers/types.ts'
import { aggregateSearch } from './providers/merge.ts'
import { getProvider } from './providers/registry.ts'
import type { ProviderId, Track } from './providers/types.ts'
import { getHaloSync } from './halo/sync.ts'
import { getSettings } from './store/settings.ts'
import type { PlayModeId } from './providers/types.ts'
import { addAlarm, cancelSleepTimer, listAlarms, removeAlarm, startSleepTimer } from './scheduler.ts'
import { dispatchNotify } from './notify.ts'
import { addTrack, getLists, removeTrack } from './store/library.ts'

interface SearchHit {
  id: string
  name: string
  artists: string
  album: string
  vip: boolean
}

async function searchHits(query: string, platform: string | undefined, limit: number): Promise<SearchHit[]> {
  const providers: ProviderId[] | undefined = platform ? [platform] : undefined
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

export function registerTools(ctx: Context): () => void {
  const disposes: Array<() => void> = []
  const reg = (tool: Parameters<typeof ctx.tools.register>[0]) => {
    const dispose: unknown = ctx.tools.register(tool)
    if (typeof dispose === 'function') disposes.push(dispose as () => void)
  }
  reg(defineTool({
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

  reg(defineTool({
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

  reg(defineTool({
    name: 'music_control',
    description: '控制播放器：pause(暂停)/resume(继续)/next(下一首)/prev(上一首)/seek(跳转进度，需 position_sec)。',
    parameters: {
      action: { type: 'string', required: true, description: 'pause | resume | next | prev | seek' },
      position_sec: { type: 'number', description: 'action=seek 时目标位置（秒）' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: String((value as Record<string, unknown>).message ?? '') }],
    },
    isConcurrencySafe: () => false,
    async execute(args) {
      const action = args.action.toLowerCase().trim()
      if (action === 'seek') {
        const position = Number(args.position_sec)
        if (!(position >= 0)) throw new Error('需要 position_sec（秒）')
        queueOrThrow({ type: 'seek', position })
        return { message: `已跳转到 ${formatTime(position)}` }
      }
      if (action !== 'pause' && action !== 'resume' && action !== 'next' && action !== 'prev') {
        throw new Error(`bad action: ${args.action}`)
      }
      queueOrThrow({ type: action } as BridgeCommand)
      return { message: `已下发：${action}` }
    },
  }))

  reg(defineTool({
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

  reg(defineTool({
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
      let providerId: string
      let songId: string
      if (args.track_id) {
        const parsed = parseIdLoose(args.track_id)
        if (!parsed) throw new Error(`bad track_id: ${args.track_id}`)
        providerId = parsed.provider
        songId = parsed.songId
      } else {
        const current = getNowPlaying()
        if (!current) throw new Error('当前没有播放中的歌曲，请提供 track_id')
        providerId = current.provider
        songId = current.trackId.split(':')[1] ?? ''
      }
      const provider = getProvider(providerId)
      if (!provider) throw new Error(`未知音源: ${providerId}`)
      const payload = await provider.lyric(songId, { numericId: '' })
      const lyric = payload.lrc.slice(0, maxChars) || '(无歌词)'
      return { lyric }
    },
  }))

  // ---- 扩展工具：音箱控制 / 队列 / 音量 / 收藏 / 定时任务 / 通知 ----

  reg(defineTool({
    name: 'music_halo',
    description: '控制花再(HALO PixelBar)音箱屏幕：scene 内置场景 / spectrum 频谱样式 / clock 时钟样式 / color 屏幕颜色。需已在插件设置开启「启用歌词同步」。',
    parameters: {
      action: { type: 'string', required: true, description: 'scene | spectrum | clock | color' },
      value: { type: 'string', description: 'scene: clock/game/work/reading/cats/dogs/memes/cyber/waves；spectrum: 1-4；clock: 1-11；color: #rrggbb 或 r,g,b' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: String((value as Record<string, unknown>).message ?? '') }],
    },
    async execute(args) {
      const halo = getHaloSync()
      if ((halo.status() as { connected?: boolean }).connected !== true) {
        throw new Error('花再音箱未连接：请先在插件设置中启用歌词同步')
      }
      const action = String(args.action ?? '').toLowerCase().trim()
      const raw = String(args.value ?? '').trim()
      let ok = false
      let detail = ''
      if (action === 'scene') {
        ok = halo.sendScene(raw.toLowerCase())
        detail = `场景 ${raw}`
      } else if (action === 'spectrum') {
        ok = halo.sendSpectrum(Number(raw) || 0)
        detail = `频谱样式 ${raw}`
      } else if (action === 'clock') {
        ok = halo.sendClock(Number(raw) || 1)
        detail = `时钟样式 ${raw}`
      } else if (action === 'color') {
        const rgb = parseRgb(raw)
        if (!rgb) throw new Error('颜色格式应为 #rrggbb 或 r,g,b，如 #3366ff 或 51,102,255')
        ok = halo.sendScreenColor(rgb.r, rgb.g, rgb.b)
        detail = `屏色 rgb(${rgb.r},${rgb.g},${rgb.b})`
      } else {
        throw new Error(`bad action: ${args.action}`)
      }
      return { message: ok ? `已下发：${detail}` : `${detail} 下发失败（设备可能离线）` }
    },
  }))

  reg(defineTool({
    name: 'music_queue',
    description: '管理播放队列：add(搜索并加入队列尾部，不打断当前播放)/clear(清空队列)/mode(切换播放模式)。',
    parameters: {
      action: { type: 'string', required: true, description: 'add | clear | mode' },
      query: { type: 'string', description: 'action=add 时搜索关键词' },
      mode: { type: 'string', description: 'action=mode 时：order(顺序)/repeat(列表循环)/one(单曲循环)/random(随机)' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: String((value as Record<string, unknown>).message ?? '') }],
    },
    async execute(args) {
      const action = String(args.action ?? '').toLowerCase().trim()
      if (action === 'clear') {
        queueOrThrow({ type: 'queue_clear' })
        return { message: '已清空播放队列' }
      }
      if (action === 'mode') {
        const mode = String(args.mode ?? '').toLowerCase().trim() as PlayModeId
        if (mode !== 'order' && mode !== 'repeat' && mode !== 'one' && mode !== 'random') {
          throw new Error('mode 应为 order/repeat/one/random')
        }
        queueOrThrow({ type: 'mode', mode })
        return { message: `播放模式已切换：${PLAY_MODE_LABEL[mode]}` }
      }
      if (action === 'add') {
        const query = (args.query ?? '').trim()
        if (!query) throw new Error('需要 query 关键词')
        const tracks = await aggregateSearch({ keyword: query, limit: 5 })
        if (!tracks.length) throw new Error(`没找到「${query}」`)
        queueOrThrow({ type: 'queue_add', tracks })
        return { message: `已加入队列：${trackSummary(tracks[0]!)}${tracks.length > 1 ? ` 等 ${tracks.length} 首` : ''}` }
      }
      throw new Error(`bad action: ${args.action}`)
    },
  }))

  reg(defineTool({
    name: 'music_volume',
    description: '调节播放器音量（0-100）。',
    parameters: {
      level: { type: 'number', required: true, description: '音量 0-100' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: String((value as Record<string, unknown>).message ?? '') }],
    },
    async execute(args) {
      const level = Number(args.level)
      if (!(level >= 0 && level <= 100)) throw new Error('level 应在 0-100')
      queueOrThrow({ type: 'volume', value: Math.round(level) / 100 })
      return { message: `音量已设为 ${Math.round(level)}%` }
    },
  }))

  reg(defineTool({
    name: 'music_favorite',
    description: '把当前正在播放的歌曲收藏到「本地红心」列表，或取消收藏。不传 liked 则自动切换。',
    parameters: {
      liked: { type: 'boolean', description: 'true=收藏 false=取消收藏；缺省为切换' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: String((value as Record<string, unknown>).message ?? '') }],
    },
    async execute(args) {
      const current = getNowPlaying()
      if (!current) throw new Error('当前没有播放中的歌曲')
      const query = `${current.name} ${current.artists[0] ?? ''}`.trim()
      const hits = await aggregateSearch({ keyword: query, limit: 10 })
      const track = hits.find(item => item.id === current.trackId)
      if (!track) throw new Error('未能定位当前曲目的完整信息，无法收藏')
      const fav = getLists().find(list => list.id === 'fav')
      const exists = !!fav?.tracks.some(item => item.provider === track.provider && item.songId === track.songId)
      const want = typeof args.liked === 'boolean' ? args.liked : !exists
      if (want && !exists) {
        addTrack('fav', track)
        return { message: `已收藏到本地红心：${trackSummary(track)}` }
      }
      if (!want && exists) {
        removeTrack('fav', `${track.provider}:${track.songId}`)
        return { message: `已取消收藏：${trackSummary(track)}` }
      }
      return { message: `${want ? '已' : '未'}在红心列表：${trackSummary(track)}` }
    },
  }))

  reg(defineTool({
    name: 'music_sleep_timer',
    description: '睡眠定时器：N 分钟后自动暂停播放并提醒。minutes 传 0 或负数取消。',
    parameters: {
      minutes: { type: 'number', required: true, description: '分钟数；0 表示取消' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: String((value as Record<string, unknown>).message ?? '') }],
    },
    async execute(args) {
      requireScheduler()
      const minutes = Number(args.minutes)
      if (!(minutes > 0)) {
        cancelSleepTimer()
        return { message: '睡眠定时器已取消' }
      }
      const capped = Math.min(minutes, 720)
      startSleepTimer(capped)
      return { message: `将在 ${capped} 分钟后暂停播放` }
    },
  }))

  reg(defineTool({
    name: 'music_alarm',
    description: '音乐闹钟：每天到点自动搜索并播放指定歌曲，同时按设置做声音/音箱提醒。',
    parameters: {
      action: { type: 'string', required: true, description: 'create | list | delete' },
      time: { type: 'string', description: 'HH:mm（24 小时制），action=create 必填' },
      keyword: { type: 'string', description: '到点播放的歌（歌名/歌手），action=create 必填' },
      label: { type: 'string', description: '备注名，如「起床闹钟」' },
      id: { type: 'string', description: 'action=delete 时必填' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: String((value as Record<string, unknown>).message ?? '') }],
    },
    async execute(args) {
      requireScheduler()
      const action = String(args.action ?? '').toLowerCase().trim()
      if (action === 'list') {
        const alarms = listAlarms()
        if (!alarms.length) return { message: '还没有闹钟' }
        return { message: alarms.map(a => `${a.id} | ${a.time} | ${a.keyword}${a.label ? ` | ${a.label}` : ''}`).join('\n') }
      }
      if (action === 'create') {
        const alarm = addAlarm(String(args.time ?? ''), String(args.keyword ?? ''), args.label == null ? undefined : String(args.label))
        return { message: `闹钟已创建：${alarm.time} 播放「${alarm.keyword}」${alarm.label ? `（${alarm.label}）` : ''}` }
      }
      if (action === 'delete') {
        const removed = removeAlarm(String(args.id ?? ''))
        return { message: removed ? '闹钟已删除' : `没找到 id=${args.id}` }
      }
      throw new Error(`bad action: ${args.action}`)
    },
  }))
  return () => { for (const dispose of disposes) dispose() }
}

const PLAY_MODE_LABEL: Record<PlayModeId, string> = {
  order: '顺序播放',
  repeat: '列表循环',
  one: '单曲循环',
  random: '随机播放',
}

/** 解析 #rrggbb 或 r,g,b 颜色。 */
function parseRgb(text: string): { r: number; g: number; b: number } | undefined {
  const hex = /^#?([0-9a-f]{6})$/i.exec(text.trim())
  if (hex?.[1]) {
    const n = parseInt(hex[1], 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
  }
  const parts = text.split(',').map(part => Number(part.trim()))
  if (parts.length === 3 && parts.every(v => Number.isFinite(v))) {
    return { r: parts[0]!, g: parts[1]!, b: parts[2]! }
  }
  return undefined
}

/** 定时任务类工具的开关门卫。 */
function requireScheduler(): void {
  if (!getSettings().schedulerEnabled) {
    throw new Error('定时任务已在插件设置中关闭')
  }
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

function parseIdLoose(id: string): Partial<Track> & { provider: string; songId: string; id: string } | undefined {
  const index = id.indexOf(':')
  if (index <= 0) return undefined
  const provider = id.slice(0, index)
  const songId = id.slice(index + 1)
  if (!songId) return undefined
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
