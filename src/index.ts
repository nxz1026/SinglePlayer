/**
 * 单身汉（DSH）播放器 —— 宿主半。
 * 跑在 dsh 进程内的 Cordis 插件：注册同源 HTTP 路由（平台 BFF、音频代理、
 * 登录态管理、花再 HID 桥）与 AI 工具集。
 * @module dsh-music-huazai
 */

import { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { registerRoutes } from './routes.ts'
import { registerTools } from './tools.ts'
import { getHaloSync } from './halo/sync.ts'
import { startScheduler } from './scheduler.ts'

/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
export const name = 'music'

/** 宿主半依赖的服务（agents：反向推送写会话通知用）。 */
export const inject = ['webServer', 'tools', 'agents'] as const

/** 插件配置。 */
export interface Config {}

/** 进程级退出钩子只装一次（HMR/重复激活防重）。 */
let exitHooksInstalled = false

function installExitHooks(halo: { dispose(): void }): void {
  if (exitHooksInstalled) return
  exitHooksInstalled = true
  const disposeOnce = (): void => {
    try { halo.dispose() } catch { /* 尽力而为 */ }
  }
  // 正常退出 / process.exit()
  process.on('exit', disposeOnce)
  // Ctrl+C / kill：恢复时钟后把信号交还给默认处理，不吞掉 dsh 自己的收尾逻辑。
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    const handler = (): void => {
      disposeOnce()
      process.removeListener(signal, handler)
      process.kill(process.pid, signal)
    }
    process.on(signal, handler)
  }
}

/** Cordis 插件体。 */
export function apply(ctx: Context, _config: Config = {}): void {
  ctx.effect(() => registerRoutes(ctx), 'music: routes')
  ctx.effect(() => registerTools(ctx), 'music: tools')
  ctx.effect(() => startScheduler(), 'music: scheduler')
  ctx.effect(() => {
    installExitHooks(getHaloSync())
    return () => { try { getHaloSync().dispose() } catch { /* ignore */ } }
  }, 'music: halo-lifecycle')
}
