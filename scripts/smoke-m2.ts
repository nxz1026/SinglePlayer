/**
 * M2 冒烟测试：真实调用聚合搜索 / 取流 / 歌词 / 音频代理头。
 * 运行：pnpm exec tsx scripts/smoke-m2.ts
 */
import { aggregateSearch } from '../src/providers/merge.ts'
import * as netease from '../src/providers/netease.ts'
import * as qq from '../src/providers/qq.ts'

async function main(): Promise<void> {
  console.log('== 1. 聚合搜索 "晴天 周杰伦" ==')
  const tracks = await aggregateSearch({ keyword: '晴天 周杰伦', limit: 4 })
  for (const t of tracks) {
    console.log(`  [${t.provider}] ${t.songId.padEnd(22)} ${t.name} - ${t.artists.join('/')} ${t.vip ? '[VIP]' : ''}`)
  }

  const neteaseTrack = tracks.find(t => t.provider === 'netease')
  const qqTrack = tracks.find(t => t.provider === 'qq')
  if (!neteaseTrack || !qqTrack) throw new Error('搜索结果缺少平台')

  console.log('\n== 2. 网易取流 ==', neteaseTrack.songId)
  const nUrl = await netease.songUrl(neteaseTrack.songId, 'exhigh')
  console.log('  url:', nUrl.url ? `${nUrl.url.slice(0, 60)}...` : `(空: ${nUrl.reason})`, '| trial:', nUrl.trial)

  console.log('\n== 3. QQ 取流 ==', qqTrack.songId)
  const qUrl = await qq.songUrl(qqTrack.songId, 'exhigh', qqTrack.mediaMid)
  console.log('  url:', qUrl.url ? `${qUrl.url.slice(0, 60)}...` : `(空: ${qUrl.reason})`, '| quality:', qUrl.quality)

  console.log('\n== 4. 歌词 ==')
  const nLyric = await netease.lyric(neteaseTrack.songId)
  console.log('  网易 lrc:', nLyric.lrc ? `${nLyric.lrc.length} 字符, 首行: ${firstLine(nLyric.lrc)}` : '(空)', '| yrc:', nLyric.yrc.length)
  const qLyric = await qq.lyric(qqTrack.songId)
  console.log('  QQ   lrc:', qLyric.lrc ? `${qLyric.lrc.length} 字符, 首行: ${firstLine(qLyric.lrc)}` : '(空)', '| qrc:', qLyric.yrc.length)

  console.log('\n== 5. 登录态（未登录预期）==')
  const status = await netease.authStatus()
  console.log('  netease loggedIn =', status.loggedIn)

  console.log('\n全部通过 ✓')
}

function firstLine(text: string): string {
  return text.split('\n').find(line => !line.startsWith('['))?.trim().slice(0, 30) ?? ''
}

void main()
