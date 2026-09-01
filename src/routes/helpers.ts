/** 通用路由辅助函数 —— 供 routes.ts 共用。 */

import type { IncomingMessage, ServerResponse } from 'node:http'

export function json(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

export function requireMethod(req: IncomingMessage, res: ServerResponse, method: string): boolean {
  if (req.method === method) return true
  json(res, 405, { ok: false, error: `method ${req.method} not allowed` })
  return false
}

export async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
    total += (chunk as Buffer).length
    if (total > 1_048_576) throw new Error('body too large（上限 1MB）')
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export function makeGet(
  path: string,
  run: (query: URLSearchParams) => Promise<unknown>,
): { kind: 'exact'; path: string; handler: (req: IncomingMessage, res: ServerResponse) => void } {
  return {
    kind: 'exact',
    path,
    handler(req, res) {
      if (!requireMethod(req, res, 'GET')) return
      const query = new URL(req.url ?? '/', 'http://localhost').searchParams
      run(query).then(
        value => json(res, 200, { ok: true, ...(value as object) }),
        error => {
          json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
        },
      )
    },
  }
}

export function makePost(
  path: string,
  run: (body: Record<string, unknown>) => Promise<unknown>,
): { kind: 'exact'; path: string; handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> } {
  return {
    kind: 'exact',
    path,
    handler(req, res) {
      if (!requireMethod(req, res, 'POST')) return Promise.resolve()
      return readJsonBody(req).then(body =>
        run(body).then(
          value => json(res, 200, { ok: true, ...(value as object) }),
          error => {
            json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          },
        ))
    },
  }
}