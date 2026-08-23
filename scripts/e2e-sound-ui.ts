/**
 * 设置页通知配置验证：通知时长输入框 + 提示音上传行。
 */
import { openPlayer, openPanel } from './e2e.ts'

const session = await openPlayer()
const { page } = session
try {
  await openPanel(page)
  await page.click('.dshm-gear, .dshm-x[aria-label="设置"]')
  await page.waitForTimeout(600)
  const duration = page.locator('.dshm-set-row', { hasText: '通知时长' })
  console.log('通知时长行可见:', await duration.isVisible(), '| 值:', await duration.locator('input').inputValue())
  const soundRow = page.locator('.dshm-alarm-form', { hasText: '上传' })
  console.log('提示音行文本:', (await soundRow.textContent())?.trim())
  await session.shot('settings-sound')
} finally {
  await session.close()
}
