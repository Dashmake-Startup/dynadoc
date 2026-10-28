const REGIONAL_API_URL_KEY = 'ddoc.api_url'
const REGIONAL_COLLAB_WS_KEY = 'ddoc.collab_ws_url'

// Deployed spoke subdomains (api.<region>.dynadoc.dashmake.com). The backend
// builds regional URLs from the raw region name, so a placeholder region like
// "default" yields api.default.dynadoc.dashmake.com — a domain that does not
// exist and gets blocked by CSP, breaking every RPC call.
const KNOWN_REGION_SUBDOMAINS = new Set(['ch', 'us', 'ap'])

function isUsableRegionalUrl(value: string): boolean {
  try {
    const parts = new URL(value).hostname.split('.')
    // api.<region>.dynadoc.dashmake.com / collab.<region>....
    if (parts.length >= 5 && parts.slice(-3).join('.') === 'dynadoc.dashmake.com') {
      return KNOWN_REGION_SUBDOMAINS.has(parts[1])
    }
    return true
  } catch {
    return false
  }
}

function safeStorageGet(key: string): string {
  try {
    if (typeof localStorage === 'undefined') return ''
    return String(localStorage.getItem(key) || '').trim()
  } catch {
    return ''
  }
}

function safeWindowValue(...keys: string[]): string {
  try {
    if (typeof window === 'undefined') return ''
    for (const key of keys) {
      const value = String((window as any)?.[key] || '').trim()
      if (value) return value
    }
  } catch {
    // ignore runtime access failures
  }
  return ''
}

export function persistRegionalEndpoints(session: any) {
  const source = session?.session && typeof session.session === 'object' ? session.session : session
  const apiUrl = String(source?.api_url || source?.apiUrl || source?.APIURL || '').trim()
  const collabWsUrl = String(
    source?.collab_ws_url || source?.collabWsUrl || source?.CollabWSURL || ''
  ).trim()
  try {
    if (typeof localStorage === 'undefined') return
    if (apiUrl && isUsableRegionalUrl(apiUrl)) localStorage.setItem(REGIONAL_API_URL_KEY, apiUrl)
    if (collabWsUrl && isUsableRegionalUrl(collabWsUrl)) {
      localStorage.setItem(REGIONAL_COLLAB_WS_KEY, collabWsUrl)
    }
    if (source?.authenticated === false) {
      localStorage.removeItem(REGIONAL_API_URL_KEY)
      localStorage.removeItem(REGIONAL_COLLAB_WS_KEY)
    }
  } catch {
    // ignore storage failures
  }
}

export function resolveApiBaseUrl(): string {
  const runtimeUrl = safeWindowValue('__DYNADOC_API_BASE__', 'DYNADOC_API_BASE')
  if (runtimeUrl) return runtimeUrl

  const storedRegionalUrl = safeStorageGet(REGIONAL_API_URL_KEY)
  if (storedRegionalUrl) {
    // Self-heal storages poisoned by a placeholder region before the guard.
    if (isUsableRegionalUrl(storedRegionalUrl)) return storedRegionalUrl
    try {
      localStorage.removeItem(REGIONAL_API_URL_KEY)
    } catch {}
  }

  const envUrl = (import.meta as any).env?.VITE_API_URL
  if (envUrl && envUrl.trim()) return envUrl.trim()

  if (typeof window !== 'undefined' && window.location?.origin) {
    const protocol = String(window.location.protocol || '')
    if (protocol.startsWith('http')) {
      const host = String(window.location.host || '')
      if (
        host &&
        !host.includes('localhost') &&
        !host.startsWith('127.0.0.1') && // accessed from a local development environment
        !host.startsWith('192.168') // accessed from a local network, e.g. via another device in a local environment
      ) {
        if (host.startsWith('app.')) {
          return `${window.location.protocol}//${host.replace(/^app\./, 'api.')}`
        }
        return window.location.origin
      }
    }
  }

  return 'https://api.dynadoc.dashmake.com'
}

export function resolveCollabWsBaseUrl(): string {
  const runtimeUrl = safeWindowValue('__DYNADOC_COLLAB_WS__', 'DYNADOC_COLLAB_WS')
  if (runtimeUrl) return runtimeUrl

  const storedRegionalUrl = safeStorageGet(REGIONAL_COLLAB_WS_KEY)
  if (storedRegionalUrl) {
    if (isUsableRegionalUrl(storedRegionalUrl)) return storedRegionalUrl
    try {
      localStorage.removeItem(REGIONAL_COLLAB_WS_KEY)
    } catch {}
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    const host = String(window.location.host || '')
    if (
      host &&
      !host.includes('localhost') &&
      !host.startsWith('127.0.0.1') && // accessed from a local development environment
      !host.startsWith('192.168') // accessed from a local network, e.g. via another device in a local production environment
    ) {
      if (host.startsWith('app.')) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        return `${protocol}//${host.replace(/^app\./, 'collab.')}`
      }
    }
  }

  return 'wss://collab.dynadoc.dashmake.com'
}
