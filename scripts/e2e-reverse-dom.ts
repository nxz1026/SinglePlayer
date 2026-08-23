/**
 * 反向推送 DOM 验证：切歌后统计对话区「正在播放」通知行数量与内容。
 */
import { openPlayer, openPanel } from './e2e.ts'

const session = await openPlayer()
const { page } = session
try {
  await openPanel(page)
  await page.fill('.dshm-input', '稻香')
  await page.click('.dshm-go')
  await page.waitForSelector('.dshm-item', { timeout: 20_000 })
  await page.locator('.dshm-item-main').first().click()
  await page.waitForSelector('.dshm-now', { timeout: 30_000 })
  await page.waitForTimeout(6000)

  const grab = (): Promise<string[]> => page.evaluate(() => {
    const hits: string[] = []
    for (const el of document.querySelectorAll('body *')) {
      const own = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent ?? '')
        .join('')
      if (own.includes('正在播放')) hits.push(own.trim().slice(0, 80))
    }
    return [...new Set(hits)]
  })

  console.log('after track1:', await grab())
  await page.locator('.dshm-item-main').nth(2).click()
  await page.waitForTimeout(6000)
  console.log('after track2:', await grab())
} finally {
  await session.close()
}
