/**
 * E2E 测试基建 —— Playwright 驱动系统 Chrome 自测播放器面板。
 * 用法：pnpm exec tsx scripts/e2e.ts [smoke|shot:<名称>]
 * 截图输出到 %TEMP%\dshm-e2e\。
 */

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export const BASE_URL = 'http://127.0.0.1:3080'
export const SHOT_DIR = join(process.env.TEMP ?? '.', 'dshm-e2e')

export interface Session {
  close(): Promise<void>
  page: import('playwright').Page
  consoleErrors(): string[]
  failedRequests(): string[]
  shot(name: string): Promise<string>
}

/** 打开页面并等插件挂载；返回带辅助方法的会话。 */
export async function openPlayer(options: { headless?: boolean } = {}): Promise<Session> {
  mkdirSync(SHOT_DIR, { recursive: true })
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: options.headless ?? true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'zh-CN' })
  const page = await context.newPage()
  const errors: string[] = []
  const failed: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', err => errors.push(String(err)))
  page.on('response', resp => { if (resp.status() >= 400) failed.push(`${resp.status()} ${resp.url()}`) })

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.dshm-fab', { timeout: 20_000 })

  return {
    page,
    consoleErrors: () => [...errors],
    failedRequests: () => [...failed],
    async shot(name: string): Promise<string> {
      const file = join(SHOT_DIR, `${name}.png`)
      await page.screenshot({ path: file, fullPage: false })
      return file
    },
    async close(): Promise<void> {
      await browser.close()
    },
  }
}

/** 展开播放器面板。 */
export async function openPanel(page: import('playwright').Page): Promise<void> {
  const visible = await page.locator('.dshm-panel').isVisible().catch(() => false)
  if (!visible) await page.locator('.dshm-fab').click()
  await page.waitForSelector('.dshm-panel', { timeout: 5000 })
}

const command = process.argv[2] ?? 'smoke'

if (command === 'smoke') {
  const session = await openPlayer()
  try {
    await openPanel(session.page)
    const file = await session.shot('panel')
    console.log('panel opened:', file)
    console.log('console errors:', session.consoleErrors().length ? session.consoleErrors() : '(none)')
    console.log('failed requests:', session.failedRequests().length ? session.failedRequests() : '(none)')
  } finally {
    await session.close()
  }
}

/** 全流程：搜索 → 播放 → 设置页闹钟增删。 */
if (command === 'full') {
  const session = await openPlayer()
  const { page } = session
  try {
    // ---- 1. 搜索 ----
    await openPanel(page)
    await page.fill('.dshm-input', '稻香')
    await page.click('.dshm-go')
    await page.waitForSelector('.dshm-item', { timeout: 20_000 })
    console.log('search results:', await page.locator('.dshm-item').count())
    await session.shot('search')

    // ---- 2. 播放第一首 ----
    await page.locator('.dshm-item-main').first().click()
    await page.waitForSelector('.dshm-now', { timeout: 30_000 })
    await page.waitForTimeout(4000)
    console.log('now playing:', await page.locator('.dshm-now-name').textContent())
    console.log('play state:', {
      btn: await page.locator('.dshm-playbtn').textContent(),
      time: await page.locator('.dshm-times span').first().textContent(),
      lyricBtnOn: await page.locator('.dshm-lyrbtn-on').count(),
    })
    await session.shot('now-playing')

    // ---- 3. 设置页：通知与定时 ----
    await page.click('.dshm-gear, .dshm-x[aria-label="设置"]')
    await page.waitForTimeout(500)
    const alarmForm = page.locator('.dshm-alarm-form').first()
    const alarmVisible = await alarmForm.isVisible()
    console.log('scheduler UI visible:', alarmVisible)
    if (alarmVisible) {
      await page.fill('.dshm-alarm-form .dshm-time', '07:45')
      await page.fill('.dshm-alarm-form .dshm-input-sm', 'e2e测试')
      await alarmForm.locator('.dshm-mini').click()
      await page.waitForTimeout(800)
      console.log('alarm rows:', await page.locator('.dshm-alarm-row').count())
      await session.shot('settings')
      await page.locator('.dshm-alarm-row .dshm-icon').last().click()
      await page.waitForTimeout(800)
      console.log('alarm rows after delete:', await page.locator('.dshm-alarm-row').count())
    }
    console.log('console errors:', session.consoleErrors().length ? session.consoleErrors() : '(none)')
    console.log('failed requests:', session.failedRequests().length ? session.failedRequests() : '(none)')
  } finally {
    await session.close()
  }
}
