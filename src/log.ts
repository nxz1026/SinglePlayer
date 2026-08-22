/**
 * 宿主半统一日志 —— 带 [music] 前缀输出到 dsh 进程 stdout/stderr。
 * 日志级别：INFO / WARN / ERROR。通过 LOG_LEVEL 环境变量控制（默认 INFO）。
 */

const PREFIX = '[music]'
const LEVEL = (process.env.LOG_LEVEL ?? 'INFO').toUpperCase()

function shouldLog(minLevel: string): boolean {
  const order = ['ERROR', 'WARN', 'INFO']
  return order.indexOf(LEVEL) >= order.indexOf(minLevel)
}

export function logInfo(...args: unknown[]): void {
  if (shouldLog('INFO')) console.log(PREFIX, ...args)
}

export function logWarn(...args: unknown[]): void {
  if (shouldLog('WARN')) console.warn(PREFIX, ...args)
}

export function logError(context: string, error: unknown): void {
  if (shouldLog('ERROR')) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`${PREFIX} ${context}:`, message)
  }
}
