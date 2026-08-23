/**
 * 综合 E2E —— Playwright 无头 Chrome 全面自测播放器面板（含新增音乐源管理）。
 * 重点：捕获 console 错误 / page error / 失败请求（>=400），用于发现回归。
 * 运行：pnpm exec tsx scripts/e2e-all.ts
 */

import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:3080'
const API = `${BASE}/api/dsh-music`

async function getJSON(path: string): Promise<any> {
  const r = await fetch(API + path)
  const j = (await r.json().catch(() => ({}))) as any
  return j
}

async function main(): Promise<void> {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'zh-CN' })
  const page = await context.newPage()

  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const failedRequests: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  page.on('pageerror', err => pageErrors.push(String(err)))
  page.on('response', resp => { if (resp.status() >= 400) failedRequests.push(`${resp.status()} ${resp.url()}`) })

  const step = (m: string) => console.log(`\n[STEP] ${m}`)

  try {
    // ---- 0. 打开主页，等面板挂载 ----
    step('打开主页并挂载悬浮球')
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.dshm-fab', { timeout: 20_000 })
    const fabCount = await page.locator('.dshm-fab').count()
    console.log('fab count =', fabCount)

    // ---- 1. 展开面板 ----
    step('展开面板')
    await page.locator('.dshm-fab').click()
    await page.waitForSelector('.dshm-panel', { timeout: 5000 })
    console.log('panel visible =', await page.locator('.dshm-panel').isVisible())

    // ---- 2. 搜索 -> 播放 ----
    step('搜索「稻香」并播放第一首')
    await page.fill('.dshm-input', '稻香')
    await page.click('.dshm-go')
    try {
      await page.waitForSelector('.dshm-item', { timeout: 25_000 })
      const n = await page.locator('.dshm-item').count()
      console.log('搜索结果数 =', n)
      if (n > 0) {
        await page.locator('.dshm-item-main').first().click()
        await page.waitForSelector('.dshm-now', { timeout: 30_000 })
        await page.waitForTimeout(4000)
        const name = await page.locator('.dshm-now-name').textContent().catch(() => '(none)')
        console.log('正在播放 =', name?.trim())
        const playBtn = await page.locator('.dshm-playbtn').textContent().catch(() => '(?)')
        console.log('播放按钮 =', playBtn?.trim())
        // 歌词开关是否存在（我新增后不应破坏）
        const lyrBtn = await page.locator('.dshm-lyrbtn').count()
        console.log('歌词开关元素数 =', lyrBtn)
      }
    } catch (e) {
      console.log('搜索/播放未成功（可能网络受限）:', (e as Error).message)
    }

    // ---- 3. 进入设置，校验音乐源分组（新增功能） ----
    step('进入设置页，校验「音乐源」分组')
    await page.locator('[aria-label="设置"]').click().catch(async () => {
      await page.locator('.dshm-gear').click()
    })
    await page.waitForTimeout(600)

    const titles = await page.locator('.dshm-set-title').allTextContents()
    console.log('设置分组标题 =', JSON.stringify(titles))
    const hasSourceTitle = titles.some(t => t.includes('音乐源'))
    console.log('「音乐源」分组存在 =', hasSourceTitle)

    // 后端 /providers 当前状态
    const before = await getJSON('/providers')
    console.log('切换前 /providers =', JSON.stringify(before.providers?.map((p: any) => ({ id: p.id, enabled: p.enabled }))))

    if (hasSourceTitle) {
      const qqRow = page.locator('.dshm-check-row', { hasText: 'QQ 音乐' }).first()
      const qqInput = qqRow.locator('input')
      const checkedBefore = await qqInput.isChecked()
      console.log('QQ 开关切换前 =', checkedBefore)
      await qqInput.click()
      await page.waitForTimeout(800)
      const after = await getJSON('/providers')
      const qqAfter = after.providers?.find((p: any) => p.id === 'qq')
      console.log('点击后 /providers qq.enabled =', qqAfter?.enabled)
      // 切回，保证不污染状态
      if (qqAfter?.enabled !== checkedBefore) {
        await qqInput.click()
        await page.waitForTimeout(600)
        const restored = await getJSON('/providers')
        console.log('恢复后 /providers qq.enabled =', restored.providers?.find((p: any) => p.id === 'qq')?.enabled)
      }
    } else {
      console.log('!! 未找到音乐源分组 —— 可能是渲染问题')
    }

    // ---- 4. 闹钟增删（设置页底部） ----
    step('闹钟增删')
    const alarmForm = page.locator('.dshm-alarm-form').first()
    if (await alarmForm.isVisible().catch(() => false)) {
      const before2 = await getJSON('/schedule')
      const rowsBefore = before2?.alarms?.length ?? 0
      await page.fill('.dshm-alarm-form .dshm-time', '07:45')
      await page.fill('.dshm-alarm-form .dshm-input-sm', 'e2e测试')
      await alarmForm.locator('.dshm-mini').click()
      await page.waitForTimeout(800)
      const after2 = await getJSON('/schedule')
      const rowsAfter = after2?.alarms?.length ?? 0
      console.log(`闹钟数 ${rowsBefore} -> ${rowsAfter}`)
      // 删除刚加的
      const del = page.locator('.dshm-alarm-row .dshm-icon').last()
      if (await del.count()) { await del.click(); await page.waitForTimeout(600) }
      const afterDel = await getJSON('/schedule')
      console.log('删除后闹钟数 =', afterDel?.alarms?.length ?? 0)
    } else {
      console.log('未找到闹钟表单（schedulerEnabled 可能关闭）')
    }

    // ---- 5. 推荐 / 随便听听（触发真实 API，捕获报错） ----
    step('推荐 + 随便听听')
    const rec = await getJSON('/recommend')
    console.log('推荐分组数 =', rec?.sections?.length ?? 0)
    const shuf = await getJSON('/shuffle-mix')
    console.log('随便听听曲目数 =', shuf?.tracks?.length ?? 0)

    // ---- 6. 汇总错误 ----
    step('汇总')
    console.log('\n===== 结果汇总 =====')
    console.log('console.error 数 =', consoleErrors.length)
    consoleErrors.slice(0, 30).forEach((e, i) => console.log(`  [console#${i}] ${e}`))
    console.log('pageerror 数 =', pageErrors.length)
    pageErrors.slice(0, 30).forEach((e, i) => console.log(`  [pageerror#${i}] ${e}`))
    console.log('失败请求(>=400) 数 =', failedRequests.length)
    failedRequests.slice(0, 30).forEach((e, i) => console.log(`  [req#${i}] ${e}`))
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error('E2E 异常:', e); process.exit(1) })
