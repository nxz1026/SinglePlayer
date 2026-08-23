/**
 * 通知链路验证：POST /notify → 浏览器半轮询取命令 → 面板出现 🔔 提示条。
 * （实际声音需真人耳朵；此处只验管线。）
 */
import { openPlayer, openPanel } from './e2e.ts'

const title = process.argv[2] ?? '测试提醒'
const text = process.argv[3] ?? '声音+音箱双通道'

const session = await openPlayer()
const { page } = session
try {
  await openPanel(page)
  // 先播一首，保证 NowPlaying 栏渲染（提示条挂在其下）
  await page.fill('.dshm-input', '稻香')
  await page.click('.dshm-go')
  await page.waitForSelector('.dshm-item', { timeout: 20_000 })
  await page.locator('.dshm-item-main').first().click()
  await page.waitForSelector('.dshm-now', { timeout: 30_000 })
  // 触发通知（走宿主路由）
  const resp = await page.evaluate(async ({ title, text }) => {
    const r = await fetch('/api/dsh-music/notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, text }),
    })
    return r.json()
  }, { title, text })
  console.log('notify resp:', resp)
  // 等浏览器半 2s 轮询取走命令并渲染提示条
  await page.waitForSelector('.dshm-note', { timeout: 8000 })
  const note = await page.locator('.dshm-note').textContent()
  console.log('panel note:', note?.trim())
  await session.shot('notify')
} finally {
  await session.close()
}
