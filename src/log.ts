/** 宿主半统一日志 —— 带 [music] 前缀输出到 dsh 进程 stdout/stderr。 */

const PREFIX = '[music]'

export function logInfo(...args: unknown[]): void {
  console.log(PREFIX, ...args)
}

export function logWarn(...args: unknown[]): void {
  console.warn(PREFIX, ...args)
}

export function logError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`${PREFIX} ${context}:`, message)
}
