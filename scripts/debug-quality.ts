/** 匿名音质降级验证：pnpm exec tsx scripts/debug-quality.ts */
import { songUrl } from '../src/providers/netease.ts'

const r = await songUrl('3339230677', 'hires')
console.log('anonymous hires =>', r.url ? `OK quality=${r.quality} trial=${r.trial}` : `FAIL ${r.reason ?? ''}`)
