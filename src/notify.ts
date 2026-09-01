/**
 * 通知分发 —— 把提醒送到声音通道：
 * - 声音：经桥下发浏览器半播放提示音（受 settings.notifySound 控制）
 */

import { pushCommand } from './bridge.ts'
import { getSettings } from './store/settings.ts'

export interface NotifyResult {
  soundQueued: boolean
}

export async function dispatchNotify(title: string, text = ''): Promise<NotifyResult> {
  const settings = getSettings()
  const result: NotifyResult = { soundQueued: false }

  if (settings.notifySound) {
    result.soundQueued = pushCommand({ type: 'notify', title, text })
  }
  return result
}
