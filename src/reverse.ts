/**
 * 反向推送 —— 播放事件反向写入 dsh 会话，让用户在对话流里看到「正在播放」动态。
 * 用 session.append('user/message', ..., form:'notice') 折叠通知行：不打断对话、不唤醒模型、零 token。
 * 全程防御式：agents 服务缺失 / 接口不符时静默跳过，绝不影响播放器。
 */

import type { Context } from '@deepseek-ai/cordis'
import { getSettings } from './store/settings.ts'
import type { NowPlayingReport } from './providers/types.ts'

const MIN_GAP_MS = 10_000
let lastAt = 0

interface AgentLike {
  session?: { append?: (type: string, data: unknown, opts?: unknown) => unknown }
}

export function maybeReversePush(ctx: Context, report: NowPlayingReport, isNewTrack: boolean): void {
  if (!getSettings().reversePushEnabled) return
  if (!isNewTrack || !report.name) return
  const now = Date.now()
  if (now - lastAt < MIN_GAP_MS) return
  lastAt = now

  void (async (): Promise<void> => {
    try {
      const agents = (ctx as unknown as Record<string, unknown>).agents as
        | { list?: () => unknown[]; roots?: () => unknown[] }
        | undefined
      if (!agents || typeof agents.list !== 'function') return
      const pool = [...(agents.list() ?? []), ...(typeof agents.roots === 'function' ? agents.roots() : [])]
      const target = pool.reverse().find(item =>
        !!(item as AgentLike)?.session?.append,
      ) as AgentLike | undefined
      if (!target?.session?.append) return

      const text = `正在播放：${report.name} - ${report.artists.join(' / ')}`
      // 变量形式动态 import：不做构建期解析，运行时从宿主环境取（缺失则静默跳过）。
      const pkg = '@deepseek-ai/dsh-llm'
      const mod = (await import(pkg)) as {
        createUserMessage?: (input: Record<string, unknown>) => unknown
      }
      if (typeof mod.createUserMessage !== 'function') return
      target.session.append(
        'user/message',
        mod.createUserMessage({
          content: [{ type: 'text', text }],
          source: {
            kind: 'plugin',
            plugin: 'dsh-music-huazai',
            form: 'notice',
            summary: text.slice(0, 120),
          },
        }),
        { surfaceOp: 'append' },
      )
    } catch {
      // 会话结构不匹配等一切异常：静默跳过。
    }
  })()
}
