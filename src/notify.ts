/**
 * 通知分发 —— 把提醒送到两条相互独立的通道：
 * - 声音：经桥下发浏览器半播放提示音（受 settings.notifySound 控制）
 * - 音箱文字：直写花再屏幕（受 settings.notifyHaloText 控制，依赖设备连接）
 */

import { pushCommand } from './bridge.ts'
import { getSettings } from './store/settings.ts'
import { getHaloSync } from './halo/sync.ts'
import { logWarn } from './log.ts'

export interface NotifyResult {
  soundQueued: boolean
  haloTextSent: boolean
}

export function dispatchNotify(title: string, text = ''): NotifyResult {
  const settings = getSettings()
  const result: NotifyResult = { soundQueued: false, haloTextSent: false }
  const body = `${title}${text ? `：${text}` : ''}`.trim()

  if (settings.notifySound) {
    result.soundQueued = pushCommand({ type: 'notify', title, text })
  }
  if (settings.notifyHaloText) {
    try {
      getHaloSync().onNotify(body)
      result.haloTextSent = true
    } catch (cause) {
      logWarn(`[notify] 音箱提醒失败: ${cause instanceof Error ? cause.message : String(cause)}`)
    }
  }
  return result
}
