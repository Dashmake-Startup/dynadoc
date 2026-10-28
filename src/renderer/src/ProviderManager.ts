import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { IndexeddbPersistence } from 'y-indexeddb'
import { resolveApiBaseUrl } from './lib/api/shared/baseUrl'

export interface CollabShareInfo {
  shareId?: string
  docUuid?: string
  name?: string
  path?: string
  password?: string
  role?: string
}

export interface CollabConfig {
  docId: string
  username: string
  color: string
  role?: string
  apiBaseUrl?: string
  token?: string
  wsUrl?: string
  share?: CollabShareInfo
}

type CollabTokenResponse = {
  token: string
  wsUrl?: string
  role?: string
  user?: { id?: string; name?: string; color?: string }
  expiresAt?: string
}

export class ProviderManager {
  public ydoc: Y.Doc
  public provider: HocuspocusProvider | null = null
  public persistence: IndexeddbPersistence
  public status: 'offline' | 'connecting' | 'connected' | 'error' = 'offline'
  private config: CollabConfig
  private lastAuthResetAt = 0

  constructor(config: CollabConfig) {
    this.config = config
    this.ydoc = new Y.Doc()

    // Local-First Persistence (IndexedDB)
    this.persistence = new IndexeddbPersistence(config.docId, this.ydoc)
  }

  async connect() {
    console.log('[collab provider] Connecting to collab provider with config:', this.config)
    if (this.provider) return
    this.status = 'connecting'
    console.log('[collab provider]2:', this.provider)

    const tokenPayload = await this.fetchToken()
    const token = tokenPayload?.token || ''
    const wsUrl = tokenPayload?.wsUrl || this.config.wsUrl || ''

    if (!token || !wsUrl) {
      this.status = 'offline'
      return
    }
    console.log('[collab provider]3:', this.status)

    this.provider = new HocuspocusProvider({
      url: wsUrl,
      name: this.config.docId,
      document: this.ydoc,
      token,
      connect: true
    })

    this.provider.on('status', ({ status }) => {
      console.log('[collab provider] status changed:', this.status)

      this.status = status === 'connected' ? 'connected' : 'offline'
    })

    this.provider.on('authenticationFailed', async () => {
      console.warn('[collab provider] authentication failed; refreshing token')
      await this.resetAuthAndReconnect()
    })

    this.provider.awareness.setLocalStateField('user', {
      name: this.config.username,
      color: this.config.color
    })
  }

  private async fetchToken(): Promise<CollabTokenResponse | null> {
    const apiBase = this.config.apiBaseUrl || resolveApiBaseUrl()
    const accessToken = await resolveAccessToken()
    const { tokenKey, wsKey } = this.getTokenKeys()
    const cachedToken =
      this.config.token ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem(tokenKey) : '')
    const cachedWs =
      this.config.wsUrl || (typeof localStorage !== 'undefined' ? localStorage.getItem(wsKey) : '')
    if (cachedToken && cachedWs && !isJwtExpired(cachedToken)) {
      return { token: cachedToken, wsUrl: cachedWs }
    }
    if (cachedToken) {
      this.clearCachedToken()
    }
    const payload = {
      docId: this.config.docId,
      role: this.config.role,
      user: {
        name: this.config.username,
        color: this.config.color
      },
      ...this.config.share
    }
    console.log('[collab provider] fetchToken', { payload, "conf": this.config })


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
        console.error(`${apiBase}/api/collab/token`, '[collab provider] token failed; error', { res })

        return null
      }
      const data = (await res.json()) as CollabTokenResponse
      if (data?.token) {
        window.localStorage?.setItem(tokenKey, data.token)
      }
      if (data?.wsUrl) {
        window.localStorage?.setItem(wsKey, data.wsUrl)
      }
      return data
    } catch (e) {
      console.error('[collab provider] token failed; error', e)

      return null
    }
  }

  private getTokenKeys() {
    const shareKey = this.config.share?.shareId || 'none'
    return {
      tokenKey: `ddoc.collab_token:${this.config.docId}:${shareKey}`,
      wsKey: `ddoc.collab_ws:${this.config.docId}:${shareKey}`
    }
  }

  private clearCachedToken() {
    if (typeof localStorage === 'undefined') return
    try {
      const { tokenKey, wsKey } = this.getTokenKeys()
      localStorage.removeItem(tokenKey)
      localStorage.removeItem(wsKey)
    } catch {
      // ignore
    }
  }

  private async resetAuthAndReconnect() {
    const now = Date.now()
    if (now - this.lastAuthResetAt < 10_000) return
    this.lastAuthResetAt = now
    this.clearCachedToken()
    try {
      this.provider?.destroy()
    } catch {
      // ignore
    }
    this.provider = null
    this.status = 'offline'
    setTimeout(() => {
      void this.connect()
    }, 300)
  }

  public destroy() {
    this.provider?.destroy()
    this.persistence.destroy()
    this.ydoc.destroy()
  }
}

function getAccessToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem('ddoc.access_token')
  } catch {
    return null
  }
}

function isJwtExpired(token: string, skewSeconds = 30): boolean {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return true
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    const exp = typeof payload?.exp === 'number' ? payload.exp : 0
    if (!exp) return true
    const now = Math.floor(Date.now() / 1000)
    return exp <= now + skewSeconds
  } catch {
    return true
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
