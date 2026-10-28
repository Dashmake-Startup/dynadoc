import { resolveApiBaseUrl } from '../../lib/api/shared/baseUrl'
import { nodeApi } from '../../utils/shims/node'

export type CollabTokenResponse = {
  token: string
  wsUrl?: string
  role?: string
  user?: { id?: string; name?: string; color?: string }
  expiresAt?: string
}

function getAccessToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem('ddoc.access_token')
  } catch {
    return null
  }
}

async function resolveAccessToken(): Promise<string | null> {
  const existing = getAccessToken()
  if (existing) return existing
  try {
    const authApi = (window as any)?.server?.auth
    if (authApi?.getSession) {
      const session = await authApi.getSession()
      const token = session?.accessToken || session?.session?.accessToken
      if (token) return token
    }
  } catch {
    // ignore
  }
  return getAccessToken()
}

export async function fetchCollabToken(params: {
  docId: string
  username: string
  color: string
  role?: string
  share?: any
}): Promise<CollabTokenResponse | null> {
  const apiBase = resolveApiBaseUrl()
  const accessToken = await resolveAccessToken()
  
  const payload = {
    docId: params.docId,
    role: params.role || 'editor',
    user: {
      name: params.username,
      color: params.color
    },
    ...params.share
  }

  try {
    const res = await fetch(`${apiBase}/api/collab/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      return null
    }
    return (await res.json()) as CollabTokenResponse
  } catch (e) {
    console.error('[collab util] token failed:', e)
    return null
  }
}
