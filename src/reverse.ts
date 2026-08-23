/**
 * 反向推送 —— 播放事件反向写入 dsh 会话，让用户在对话流里看到「正在播放」动态。
 * 用 session.append('user/message', ..., form:'notice') 折叠通知行：不打断对话、不唤醒模型、零 token。
 *
 * 目标会话选择：优先 roots() 里最近活跃（末条事件时间最新）的根 Agent；
 * 关键失败路径均写日志（限流），不再静默吞错。
 */

import type { Context } from '@deepseek-ai/cordis'
import { getSettings } from './store/settings.ts'
import { logInfo, logWarn } from './log.ts'
import type { NowPlayingReport } from './providers/types.ts'

const BURST_GAP_MS = 3_000

interface AppendableSession {
  append?: (type: string, data: unknown, opts?: unknown) => unknown
}

interface AgentLike {
  id?: unknown
  session?: AppendableSession
}

let lastAt = 0
/** 已成功写入的曲目：换歌才写（避免 2s 上报重复刷屏）；失败允许重试。 */
let lastWrittenTrackId = ''

/** 取末条事件的时间戳（无事件退化为 createdAt），用于挑最近活跃会话。 */
function activityOf(agent: AgentLike): number {
  try {
    const session = agent.session as {
      events?: Array<{ time?: number }>
      header?: { createdAt?: number }
    } | undefined
    const events = session?.events
    if (Array.isArray(events) && events.length > 0) {
      return Number(events[events.length - 1]?.time ?? 0)
    }
    return Number(session?.header?.createdAt ?? 0)
  } catch {
    return 0
  }
}

function pickTarget(pool: AgentLike[]): AgentLike | undefined {
  const usable = pool.filter(item => typeof item?.session?.append === 'function')
  if (!usable.length) return undefined
  return usable.reduce((best, item) => (activityOf(item) > activityOf(best) ? item : best))
}

export function maybeReversePush(ctx: Context, report: NowPlayingReport, isNewTrack: boolean): void {
  if (!getSettings().reversePushEnabled) return
  if (!isNewTrack || !report.name) return
  if (report.trackId === lastWrittenTrackId) return
  const now = Date.now()
  if (now - lastAt < BURST_GAP_MS) return
  lastAt = now

  void (async (): Promise<void> => {
    try {
      const registry = (ctx as unknown as Record<string, unknown>).agents as
        | { list?: () => unknown[]; roots?: () => unknown[] }
        | undefined
      if (!registry || typeof registry.list !== 'function') {
        logWarn('[reverse] ctx.agents 服务不可用，跳过反向推送')
        return
      }
      const roots = typeof registry.roots === 'function' ? registry.roots() : []
      const all = registry.list()
      const target = pickTarget([...roots, ...all] as AgentLike[])
      if (!target) {
        logWarn(`[reverse] 无可写入会话（roots=${roots.length}, all=${all.length}），跳过`)
        return
      }

      const text = `正在播放：${report.name} - ${report.artists.join(' / ')}`
      // 变量形式动态 import：不做构建期解析，运行时从宿主环境取（缺失则记日志跳过）。
      const pkg = '@deepseek-ai/dsh-llm'
      const mod = (await import(pkg)) as {
        createUserMessage?: (input: Record<string, unknown>) => unknown
      }
      if (typeof mod.createUserMessage !== 'function') {
        logWarn('[reverse] @deepseek-ai/dsh-llm.createUserMessage 不可用，跳过')
        return
      }
      const message = mod.createUserMessage({
        content: [{ type: 'text', text }],
        source: {
          kind: 'plugin',
          plugin: 'dsh-music-huazai',
          form: 'notice',
          summary: text.slice(0, 120),
        },
      })
      target.session!.append!('user/message', message, { surfaceOp: 'append' })
      lastWrittenTrackId = report.trackId
      logInfo(`[reverse] 已写入会话 ${String(target.id ?? '?')}：${text}`)
    } catch (cause) {
      logWarn(`[reverse] 写入失败: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
  })()
}
