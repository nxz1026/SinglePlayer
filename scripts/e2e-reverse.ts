/**
 * 反向推送专项验证：播放 → 切歌 → 截对话区，看「正在播放」通知行是否出现。
 */
import { openPlayer, openPanel } from './e2e.ts'

const session = await openPlayer()
const { page } = session
try {
  await openPanel(page)
  await page.fill('.dshm-input', '晴天')
  await page.click('.dshm-go')
  await page.waitForSelector('.dshm-item', { timeout: 20_000 })
  await page.locator('.dshm-item-main').first().click()
  await page.waitForSelector('.dshm-now', { timeout: 30_000 })
  await page.waitForTimeout(5000)
  console.log('track1:', await page.locator('.dshm-now-name').textContent())
  await session.shot('reverse-t1')

  await page.locator('.dshm-item-main').nth(1).click()
  await page.waitForTimeout(6000)
  console.log('track2:', await page.locator('.dshm-now-name').textContent())
  await session.shot('reverse-t2')
  console.log('console errors:', session.consoleErrors().length ? session.consoleErrors() : '(none)')
} finally {
  await session.close()
}
