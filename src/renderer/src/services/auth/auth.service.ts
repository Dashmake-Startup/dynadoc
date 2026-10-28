import { resolveApiBaseUrl } from '../../lib/api/shared/baseUrl'
import type { AuthIntent, AuthOpenResult, AuthSession } from '../../types/auth'

// Driver readiness handle set by lib/api (window global to avoid an import
// cycle through the driver modules). Resolves once window.server is patched.
function whenDriverReady(): Promise<any> {
  try {
    const ready = typeof window !== 'undefined' ? (window as any).__ddocDriverReady : null
    if (ready && typeof ready.then === 'function') return ready
  } catch {
    // ignore
  }
  return Promise.resolve()
}

function hasServerAuthApi(): boolean {
  const serverApi = (window as any)?.server
  return Boolean(serverApi && serverApi.auth)
}

function getLocalToken(key: string): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function shouldSkipAuthRequests(org?: string): boolean {
  if (!hasServerAuthApi()) return true
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const access = getLocalToken('ddoc.access_token')
  const refresh = getLocalToken('ddoc.refresh_token')
  const hasOrg = Boolean(String(org || '').trim())
  if (!access && !refresh && !hasOrg) return true
  return false
}

function emptySession(): AuthSession {
  return {
    authenticated: false,
    user: null
  }
}

function shouldAuthDebug(): boolean {
  try {
    if (typeof window !== 'undefined' && (window as any).__DDOC_AUTH_DEBUG__ === true) return true
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('ddoc.auth.debug') === 'true'
    }
  } catch {
    // ignore
  }
  return false
}

function withAuthDebugPayload<T extends Record<string, any> | undefined>(payload: T): T {
  if (!shouldAuthDebug()) return payload
  return { ...(payload || {}), debug: true } as T
}

function normalizeSessionPayload(payload: any): AuthSession {
  if (!payload || typeof payload !== 'object') return emptySession()

  // Main process may return either session directly or wrapped as { session, ok }.
  const candidate =
    payload?.session && typeof payload.session === 'object' ? payload.session : payload

  if (!candidate || typeof candidate !== 'object') return emptySession()
  return candidate as AuthSession
}

export async function openAuth(intent: AuthIntent, org?: string): Promise<AuthOpenResult> {
  await whenDriverReady()
  if (!hasServerAuthApi()) {
    return { ok: false, message: 'Auth API is not available.' }
  }

  const serverApi = (window as any).server
  if (intent === 'signup') return serverApi.auth.signUp(withAuthDebugPayload({ org }))
  if (intent === 'register') return serverApi.auth.register(withAuthDebugPayload({ org }))
  return serverApi.auth.signIn(withAuthDebugPayload({ org }))
}

export async function joinInvite(code: string): Promise<AuthOpenResult> {
  if (!hasServerAuthApi()) {
    return { ok: false, message: 'Auth API is not available.' }
  }
  const inviteCode = String(code || '').trim()
  if (!inviteCode) {
    return { ok: false, message: 'Invite code is required.' }
  }

  const serverApi = (window as any).server
  return serverApi.auth.joinInvite(withAuthDebugPayload({ code: inviteCode }))
}

export async function getSession(org?: string): Promise<AuthSession> {
  console.log('authath getSession', { org })
  // Wait for the platform driver: on web it resolves after the URL auth
  // bootstrap, so a freshly captured token is visible to this call.
  await whenDriverReady()

  if (shouldSkipAuthRequests(org)) {
    // Comment this. User should auth even if his org is undefined/null (for free plans for example)
    // return emptySession()
  }
  console.log('authath getSession 2', { org })

  const serverApi = (window as any).server
  const result = await serverApi.auth.getSession(withAuthDebugPayload(org ? { org } : undefined))
  console.log('authath getSession 3', { org, result })
  return normalizeSessionPayload(result)
}

export async function logout(org?: string): Promise<AuthSession> {
  if (!hasServerAuthApi()) {
    return emptySession()
  }

  const serverApi = (window as any).server
  const result = await serverApi.auth.logout(withAuthDebugPayload(org ? { org } : undefined))
  return normalizeSessionPayload(result)
}

export function onSessionChanged(callback: (session: AuthSession) => void): () => void {
  console.log('authath onSessionChanged')
  // Register lazily: at boot the driver may not be resolved yet, and bailing
  // out here permanently disconnected the auth store from session updates.
  let unsubscribe: (() => void) | null = null
  let cancelled = false
  void whenDriverReady().then(() => {
    if (cancelled || !hasServerAuthApi()) return
    const serverApi = (window as any).server
    unsubscribe = serverApi.auth.onSessionChanged(
      (payload: AuthSession | { session?: AuthSession }) => {
        console.log('authath onSessionChanged erverApi.auth.onSessionCha', { payload })

        callback(normalizeSessionPayload(payload))
      }
    )
  })
  return () => {
    cancelled = true
    unsubscribe?.()
  }
}

export async function listSessions(): Promise<any> {
  await whenDriverReady()
  if (shouldSkipAuthRequests()) {
    return {}
  }
  const serverApi = (window as any).server
  return serverApi.auth.listSessions()
}

export async function setActiveOrg(org: string): Promise<AuthSession> {
  if (!hasServerAuthApi()) {
    return emptySession()
  }
  const serverApi = (window as any).server
  const result = await serverApi.auth.setActiveOrg(withAuthDebugPayload({ org }))
  return normalizeSessionPayload(result)
}

async function authFetch(path: string, options: RequestInit = {}) {
  const token = getLocalToken('ddoc.access_token')
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${resolveApiBaseUrl().replace(/\/$/, '')}${path}`, {
    ...options,
    headers
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || response.statusText)
  }
  return payload
}

export async function getProvisioningStatus(): Promise<any> {
  const token = getLocalToken('ddoc.access_token')
  if (!token) return null
  try {
    return await authFetch('/api/provisioning/status')
  } catch {
    return null
  }
}

export async function completeProvisioning(payload: {
  region: string
  account_type?: 'individual' | 'organization'
  organization_id?: string
  organization?: string
  display_name?: string
  email?: string
}): Promise<any> {
  return authFetch('/api/provisioning/complete', {
    method: 'POST',
    body: JSON.stringify(payload || {})
  })
}

export async function requestRegionMigration(
  destination_region: string,
  tenant_id?: string
): Promise<any> {
  return authFetch('/api/provisioning/migrations', {
    method: 'POST',
    body: JSON.stringify({ destination_region, tenant_id })
  })
}

export async function forceRefresh(org?: string): Promise<AuthSession> {
  if (!hasServerAuthApi()) {
    return emptySession()
  }

  const serverApi = (window as any).server
  const result = await serverApi.auth.forceRefresh(withAuthDebugPayload(org ? { org } : undefined))
  return normalizeSessionPayload(result)
}
