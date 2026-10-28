import { resolveApiBaseUrl } from '../../lib/api/shared/baseUrl'
import { RpcError } from '../../lib/api/web/rpc'

// File-level step-up 2FA client (sealed .sddoc that requires a fresh
// verification before opening). The short-lived step-up token lives in
// memory only — never persisted (5-minute server-side TTL).

interface StepUpTokenCache {
  token: string
  expiresAt: number
}

let cachedToken: StepUpTokenCache | null = null

function getLocalToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem('ddoc.access_token')
  } catch {
    return null
  }
}

async function stepUpFetch(path: string, body?: Record<string, unknown>) {
  const token = getLocalToken()
  const headers = new Headers({ Accept: 'application/json' })
  if (body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${resolveApiBaseUrl().replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const err = new Error(payload?.error || payload?.message || response.statusText)
    ;(err as any).status = response.status
    throw err
  }
  return payload
}

/** Emails a verification code to the account address (server-side, from JWT claims). */
export async function stepupSend(): Promise<void> {
  await stepUpFetch('/auth/stepup/send')
}

/** Verifies the code and caches the returned short-lived token in memory. */
export async function stepupVerify(code: string): Promise<string> {
  const payload = await stepUpFetch('/auth/stepup/verify', { code })
  const token = String(payload?.stepup_token || '')
  if (!token) throw new Error('invalid_code')
  const expiresAt = payload?.expires_at
    ? new Date(payload.expires_at).getTime()
    : Date.now() + 4 * 60 * 1000
  cachedToken = { token, expiresAt }
  return token
}

/** Returns a still-valid token (>10s left) or null. Reused across files. */
export function getValidStepUpToken(): string | null {
  if (!cachedToken) return null
  if (cachedToken.expiresAt - Date.now() < 10_000) {
    cachedToken = null
    return null
  }
  return cachedToken.token
}

export function clearStepUpToken(): void {
  cachedToken = null
}

/** The server refused to unseal without a fresh verification (HTTP 428). */
export function isStepUpRequiredError(err: unknown): boolean {
  if (err instanceof RpcError && err.status === 428) return true
  const message = err instanceof Error ? err.message : String(err ?? '')
  return message.includes('stepup_required') || (err as any)?.status === 428
}

/** The server cannot verify (step-up disabled) — never seal anyway (HTTP 409/503). */
export function isStepUpDisabledError(err: unknown): boolean {
  if (err instanceof RpcError && (err.status === 409 || err.status === 503)) {
    return err.message.includes('stepup') || err.body?.includes('stepup_disabled') === true
  }
  const message = err instanceof Error ? err.message : String(err ?? '')
  return message.includes('stepup_disabled')
}
