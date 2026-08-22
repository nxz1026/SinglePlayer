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

/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
export const name = 'music'

/** 宿主半依赖的服务。 */
export const inject = ['webServer', 'tools'] as const

/** 插件配置。 */
export interface Config {}

/** Cordis 插件体。 */
export function apply(ctx: Context, _config: Config = {}): void {
  ctx.effect(() => registerRoutes(ctx), 'music: routes')
  ctx.effect(() => registerTools(ctx), 'music: tools')
}
