/**
 * 单身汉（DSH）播放器 —— 宿主半。
 * 跑在 dsh 进程内的 Cordis 插件：注册同源 HTTP 路由（平台 BFF、音频代理、
 * 花再 HID 桥）与 AI 工具集。M1 先落骨架与健康检查路由。
 * @module dsh-music-huazai
 */

import { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { IncomingMessage, ServerResponse } from 'node:http'

/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
export const name = 'music'

/** 宿主半依赖的服务。 */
export const inject = ['webServer'] as const

/** 插件配置。 */
export interface Config {
  /** 预留：花再同步默认开关（M6 启用）。 */
  haloEnabled?: boolean
}

/** 写一个 JSON 响应。 */
function json(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

/** 注册宿主半全部 HTTP 路由，返回注销函数。 */
function registerRoutes(ctx: Context): () => void {
  const routes = [
    {
      kind: 'exact' as const,
      path: '/api/dsh-music/health',
      handler(_req: IncomingMessage, res: ServerResponse): void {
        json(res, 200, { ok: true, plugin: name, version: '0.1.0', milestone: 'M1' })
      },
    },
  ]
  const disposers = routes.map(route => ctx.webServer.register(route))
  return () => {
    for (const dispose of disposers) dispose()
  }
}

/** Cordis 插件体。 */
export function apply(ctx: Context, _config: Config = {}): void {
  ctx.effect(() => registerRoutes(ctx), 'music: routes')
}
