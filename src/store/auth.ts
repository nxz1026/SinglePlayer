/** 登录态持久化：$DSH_HOME/dsh-music-huazai/auth.json。 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface AuthState {
  /** 网易云完整 Cookie 串。 */
  neteaseCookie: string
  /** QQ 音乐完整 Cookie 串（需含 uin/qm_keyst）。 */
  qqCookie: string
}

const EMPTY: AuthState = { neteaseCookie: '', qqCookie: '' }

export function dataDir(): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'dsh-music-huazai')
}

function authFile(): string {
  return join(dataDir(), 'auth.json')
}

export function loadAuth(): AuthState {
  try {
    if (!existsSync(authFile())) return { ...EMPTY }
    const parsed = JSON.parse(readFileSync(authFile(), 'utf8')) as Partial<AuthState>
    return {
      neteaseCookie: typeof parsed.neteaseCookie === 'string' ? parsed.neteaseCookie : '',
      qqCookie: typeof parsed.qqCookie === 'string' ? parsed.qqCookie : '',
    }
  } catch {
    return { ...EMPTY }
  }
}

export function saveAuth(patch: Partial<AuthState>): AuthState {
  const next = { ...loadAuth(), ...patch }
  mkdirSync(dataDir(), { recursive: true })
  writeFileSync(authFile(), JSON.stringify(next, null, 2), 'utf8')
  return next
}
