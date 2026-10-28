import Utils from '../../../utils/Utils'
import { persistRegionalEndpoints, resolveApiBaseUrl } from '../shared/baseUrl'
import { isGuestMode, setGuestMode } from '../../../utils/authMode'

const apiBaseUrl = () => resolveApiBaseUrl().replace(/\/$/, '')

const ACCESS_TOKEN_KEY = 'ddoc.access_token'
const REFRESH_TOKEN_KEY = 'ddoc.refresh_token'

// node.ts caches fs:*/fsPromises:* reads for the session and clears that
// cache itself whenever it issues one of those channels directly. But the
// drive is also written through channels that never go through node.ts
// (drive:upload, drive:mkdir, drive:move-item, rename-file, move-file,
// sync-assets, (un)ddocify) — a stale read for a path one of these just
// moved, renamed or recreated would otherwise keep answering as if nothing
// happened. Dispatching this event on every mutating channel's success, and
// having node.ts listen for it, keeps that cache honest without requiring
// every write call site to know the cache exists.
const FS_MUTATING_CHANNELS = new Set([
  'fs:writeFile',
  'fs:writeFileSync',
  'fs:mkdirSync',
  'fs:unlinkSync',
  'fs:rmSync',
  'fs:renameSync',
  'drive:upload',
  'drive:mkdir',
  'drive:move-item',
  'rename-file',
  'move-file',
  'sync-assets',
  'ddocify',
  'unddocify'
])

export function notifyFsMutated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dynadoc-fs-mutated'))
  }
}

function getAccessToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

function getRefreshToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setTokens(accessToken?: string | null, refreshToken?: string | null) {
  if (typeof localStorage === 'undefined') return
  try {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    if (accessToken === '' || accessToken == null) localStorage.removeItem(ACCESS_TOKEN_KEY)
    if (refreshToken === '' || refreshToken == null) localStorage.removeItem(REFRESH_TOKEN_KEY)
    if (accessToken) {
      setGuestMode(false)
    } else if (accessToken === '' || accessToken == null) {
      setGuestMode(true)
    }
  } catch {
    // ignore
  }
}

// Nothing on the web ever renewed an access token: the refresh token was
// stored at sign-in and then never used, so a session simply went stale and
// every authenticated call started coming back 401. The symptom reported from
// production was a shared document that opened empty, because /share/resolve
// answered 401 to a caller the server could no longer identify and the client
// reported it as a missing file.
//
// One refresh at a time: concurrent 401s share the same in-flight attempt
// instead of each spending the refresh token, which the server rotates.
let refreshInFlight: Promise<boolean> | null = null

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${apiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      })
      if (!res.ok) {
        // The refresh token is spent or revoked: drop the session rather than
        // keep a shell that looks signed in and fails every call.
        if (res.status === 401 || res.status === 400) setTokens(null, null)
        return false
      }
      const data = await res.json().catch(() => null)
      const access = data?.access_token || data?.accessToken
      if (!access) return false
      setTokens(access, data?.refresh_token || data?.refreshToken || refreshToken)
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

export type RpcPayload = {
  channel: string
  args?: any[]
}

export class RpcError extends Error {
  status?: number
  code?: string
  body?: string

  constructor(message: string, status?: number, body?: string) {
    super(message)
    this.name = 'RpcError'
    this.status = status
    this.body = body
  }
}

async function requestJson<T>(
  url: string,
  payload: RpcPayload,
  options: InvokeOptions = {}
): Promise<T | Response> {
  const send = () => {
    const token = getAccessToken()
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    })
  }
  let res = await send()
  // An aged-out token looks exactly like no token to the server. Renew once
  // and replay, so a stale session repairs itself instead of turning every
  // call into a failure the caller reports as missing data.
  if (res.status === 401 && getAccessToken()) {
    if (await refreshAccessToken()) res = await send()
  }

  // INNOVATION: If the user wants the raw response (for Blobs/Streams), return it immediately
  /* if (options.asResponse) {
    if (!res.ok) throw new Error(`[RPC Raw] ${res.status}`);
    return res;
  } */
  // 1. RAW RESPONSE MODE (For Blobs/Videos/PDFs)
  // We return immediately. We do NOT check !res.ok here because the
  // caller (invoke) or the consumer (pdf.js) should handle the status.
  if (options.asResponse) {
    return res
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new RpcError(`[RPC] ${res.status} ${res.statusText} ${text}`, res.status, text)
    if (res.status === 402) {
      err.code = 'PAYMENT_REQUIRED'
    }
    throw err
  }
  return (await res.json()) as T
}

async function requestJsonWithToken<T>(
  url: string,
  payload: RpcPayload,
  accessToken?: string
): Promise<T> {
  const token = typeof accessToken === 'string' ? accessToken.trim() : ''
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new RpcError(`[RPC] ${res.status} ${res.statusText} ${text}`, res.status, text)
    if (res.status === 402) {
      err.code = 'PAYMENT_REQUIRED'
    }
    throw err
  }
  return (await res.json()) as T
}

export async function invokeWithToken<T = any>(
  accessToken: string,
  channel: string,
  ...args: any[]
): Promise<T> {
  const payload: RpcPayload = { channel, args }
  const result = await requestJsonWithToken<{ ok: boolean; data?: T; error?: string }>(
    `${apiBaseUrl()}/api/ipc/invoke`,
    payload,
    accessToken
  )
  if (!result?.ok) {
    throw new Error(result?.error || `RPC invoke failed: ${channel}`)
  }
  return result.data as T
}

export async function convertDocumentMultipart<T = any>(payload: {
  file: Blob
  fileName: string
  kind:
    | Utils.OFFICE_EXTENSIONS_FORMAT.word
    | 'html'
    | Utils.OFFICE_EXTENSIONS_FORMAT.powerpoint
    | 'odt'
    | 'odp'
    | string
  outputPath?: string
}): Promise<T> {
  const token = getAccessToken()
  const form = new FormData()
  form.append('file', payload.file, payload.fileName || 'document')
  form.append('kind', payload.kind)
  if (payload.outputPath) form.append('outputPath', payload.outputPath)

  const res = await fetch(`${apiBaseUrl()}/api/document/convert`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: form
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new RpcError(`[CONVERT] ${res.status} ${res.statusText} ${text}`, res.status, text)
  }

  const result = await res.json()
  if (!result?.ok) {
    throw new Error(result?.error || 'Document conversion failed')
  }
  notifyFsMutated()
  return result.data as T
}
// Add a simple interface for the options
interface InvokeOptions {
  asResponse?: boolean
}

/* export async function invokeOld<T = any>(
  channel: string,
  args: any[] = [],
  options: InvokeOptions = {}
): Promise<T | Response> {
  // export async function invoke<T = any>(channel: string, ...args: any[]): Promise<T> {
  console.log('invokeinvoke', { channel, args })

  if (
    args?.length &&
    typeof args[0] === 'string' &&
    (args[0].startsWith('share-cache/') || args[0].startsWith('home/share-cache/'))
  ) {
    if (channel === 'fs:readFile' || channel === 'fs:readFileSync') {
      return '' as T
    }
    if (channel === 'fs:existsSync') {
      return false as T
    }
    if (
      channel === 'fs:mkdirSync' ||
      channel === 'fs:mkdir' ||
      channel === 'fs:writeFile' ||
      channel === 'fs:writeFileSync' ||
      channel === 'fs:unlinkSync' ||
      channel === 'fs:rmSync' ||
      channel === 'fs:renameSync'
    ) {
      return true as T
    }
    if (channel === 'fs:readdir') {
      return [] as T
    }
    if (channel === 'fs:statSync' || channel === 'fs:lstatSync') {
      return null as T
    }
  }
  if (args?.length && (args[0] === '.' || args[0] === '')) {
    if (channel === 'fs:existsSync') {
      return true as T
    }
  }
  if (isGuestMode() && channel.startsWith('fs:') && args?.length && typeof args[0] === 'string') {
    const target = args[0]
    if (target.startsWith('share-cache/') || target.startsWith('home/share-cache/')) {
      // handled above
    } else {
      if (channel === 'fs:readFile' || channel === 'fs:readFileSync') {
        return '' as T
      }
      if (channel === 'fs:existsSync') {
        return false as T
      }
      if (channel === 'fs:readdir') {
        return [] as T
      }
      if (channel === 'fs:statSync' || channel === 'fs:lstatSync') {
        return null as T
      }
      if (
        channel === 'fs:mkdirSync' ||
        channel === 'fs:mkdir' ||
        channel === 'fs:writeFile' ||
        channel === 'fs:writeFileSync' ||
        channel === 'fs:unlinkSync' ||
        channel === 'fs:rmSync' ||
        channel === 'fs:renameSync'
      ) {
        return true as T
      }
    }
  }
  const payload: RpcPayload = { channel, args }
  let result = await requestJson<{ ok: boolean; data?: T; error?: string }>(
    `${apiBaseUrl()}/api/ipc/invoke`,
    payload
  )
  console.log('invokeinvoke result', { channel, args, payload, result })

  // INNOVATION: If the user wants the raw response (for Blobs/Streams), return it immediately
  if (options.asResponse) {
    if (!result.ok) throw new Error(`[RPC Raw] ${result.status}`);
    return result;
  }

  if (!result?.ok) {
    throw new Error(result?.error || `RPC invoke failed: ${channel}`)
  }
  let data: any = result.data
  let dataToReturn = result.data

  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    dataToReturn = {
      ...data,
      ok: result?.ok ?? false // Provide a fallback for safety
    };
  }
  // data.ok = result?.ok
  const session = data?.session && typeof data.session === 'object' ? data.session : data
  if (session?.accessToken || session?.refreshToken) {
    setTokens(session?.accessToken, session?.refreshToken)
    persistRegionalEndpoints(session)
  } else if (session?.authenticated === false) {
    setTokens('', '')
    persistRegionalEndpoints(session)
  }
  console.log('invokeinvoke result', { channel, args, payload, result, dataToReturn })

  return dataToReturn as T
  // return result.data as T
} */

export function invoke<T = any>(
  channel: string,
  options: InvokeOptions & { asResponse: true },
  ...args: any[]
): Promise<Response>
export function invoke<T = any>(
  channel: string,
  options?: InvokeOptions,
  ...args: any[]
): Promise<T>
export async function invoke<T = any>(
  channel: string,
  options: InvokeOptions = {},
  // args: any[] = [],
  ...args: any[]
): Promise<T | Response> {
  const firstArg = args?.length && typeof args[0] === 'string' ? args[0] : null

  // Kept local rather than imported from ./node, which already imports this
  // module — sharing it would close an import cycle.
  const isGuestWritablePath = (value: unknown): boolean => {
    const p = typeof value === 'string' ? value.replace(/^\/+/, '').replace(/^drive\/+/, '') : ''
    return p.startsWith('share-cache/') || p.startsWith('public-temp/')
  }

  // --- Share-cache guard (always, regardless of guest mode) ---
  if (
    firstArg &&
    (firstArg.startsWith('share-cache/') || firstArg.startsWith('home/share-cache/'))
  ) {
    switch (channel) {
      case 'fs:readFile':
      case 'fs:readFileSync':
        return '' as T
      case 'fs:existsSync':
        return false as T
      case 'fs:readdir':
        return [] as T
      case 'fs:statSync':
      case 'fs:lstatSync':
        return null as T
      case 'fs:mkdirSync':
      case 'fs:mkdir':
      case 'fs:writeFile':
      case 'fs:writeFileSync':
      case 'fs:unlinkSync':
      case 'fs:rmSync':
      case 'fs:renameSync':
        return true as T
    }
  }

  // --- Empty/dot path guard ---
  if (firstArg === '.' || firstArg === '') {
    if (channel === 'fs:existsSync') return true as T
  }

  // --- Guest mode guard ---
  if (isGuestMode() && channel.startsWith('fs:') && firstArg) {
    switch (channel) {
      case 'fs:readFile':
      case 'fs:readFileSync':
        return '' as T
      case 'fs:existsSync':
        return false as T
      case 'fs:readdir':
        return [] as T
      case 'fs:statSync':
      case 'fs:lstatSync':
        return null as T
      case 'fs:mkdirSync':
      case 'fs:mkdir':
      case 'fs:writeFile':
      case 'fs:writeFileSync':
      case 'fs:unlinkSync':
      case 'fs:rmSync':
      case 'fs:renameSync':
        // The public-share sandbox is the only thing writable without a
        // session, and those writes fall through to the real call below.
        // Anywhere else this used to answer "true" without sending anything:
        // the editor believed the save had landed while the data was dropped.
        // Refuse loudly instead — a visible error beats silently lost work.
        if (isGuestWritablePath(firstArg)) break
        throw new Error(`Not signed in: refusing to write "${String(firstArg)}"`)
    }
  }

  // --- RPC call ---
  const payload: RpcPayload = { channel, args }
  const result = await requestJson<{ ok: boolean; data?: T; error?: string }>(
    `${apiBaseUrl()}/api/ipc/invoke`,
    payload,
    options
  )

  // Raw response passthrough (for Blob/Stream callers)
  if (options.asResponse) {
    if (!(result as Response).ok) throw new Error(`[RPC Raw] ${(result as Response).status}`)
    return result as Response
  }

  const rpcResult = result as { ok: boolean; data?: T; error?: string }
  if (!rpcResult?.ok) {
    throw new Error(rpcResult?.error || `RPC invoke failed: ${channel}`)
  }

  if (FS_MUTATING_CHANNELS.has(channel)) notifyFsMutated()

  const data: any = rpcResult.data

  // Handle session tokens
  const session = data?.session && typeof data.session === 'object' ? data.session : data
  if (session?.accessToken || session?.refreshToken) {
    // auth:get-session only echoes the access token back: keep the stored
    // refresh token instead of letting setTokens remove it.
    setTokens(session.accessToken, session.refreshToken || getRefreshToken())
    persistRegionalEndpoints(session)
  } else if (session?.authenticated === false && channel.startsWith('auth:')) {
    // Only an auth channel may invalidate the session. Any other response that
    // happened to carry authenticated:false — a drive or fs payload, say —
    // used to wipe the tokens too, dropping the user into guest mode; from
    // there every call went out without an Authorization header, which kept
    // the answer at authenticated:false. The demotion was self-sustaining.
    if (getAccessToken()) {
      console.warn('[auth] RPC response says authenticated:false — wiping tokens', { channel })
    }
    setTokens('', '')
    persistRegionalEndpoints(session)
  }

  // Merge ok into object results
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    return { ...data, ok: rpcResult.ok } as T
  }

  return data as T
}

const activeSSE = new Map<string, EventSource>()

/**
 * Persistent file watcher using SSE (Option 1: Token via Query String)
 */
export function invokeWatcher(
  channel: string,
  filePath: string,
  callerId: string,
  onUpdate: (content: string) => void
): () => void {
  // --- 1. Security Guards (Identical to your invoke function) ---
  const firstArg = filePath
  if (
    firstArg &&
    (firstArg.startsWith('share-cache/') || firstArg.startsWith('home/share-cache/'))
  ) {
    return () => {}
  }
  if (isGuestMode() && channel.startsWith('fs:') && firstArg) {
    return () => {}
  }

  // --- 2. Cleanup Existing ---
  if (activeSSE.has(callerId)) {
    activeSSE.get(callerId)?.close()
  }

  // --- 3. URL Construction with Token ---
  const token = getAccessToken() // Your existing function
  const url = new URL(`${apiBaseUrl()}/api/ipc/watch`)

  url.searchParams.set('channel', channel)
  url.searchParams.set('path', filePath)
  url.searchParams.set('callerId', callerId)

  if (token) {
    // Pass the token as a query param because EventSource cannot send headers
    url.searchParams.set('token', token)
  }

  const sse = new EventSource(url.toString())

  // --- 4. Event Handling ---
  sse.onmessage = async (event) => {
    if (event.data === 'updated') {
      try {
        // Reuse your existing RPC 'readFile' logic to pull fresh data
        const content = await (window as any).api?.readFile?.(filePath)
        if (typeof content === 'string') {
          onUpdate?.(content)
        }
      } catch (err) {
        console.error(`[Watcher] Pull failed for ${filePath}:`, err)
      }
    }
  }

  sse.onerror = (err) => {
    console.error(`[Watcher] Connection lost for ${callerId}. Cleaning up.`)
    sse.close()
    activeSSE.delete(callerId)
  }

  activeSSE.set(callerId, sse)

  // Return the teardown function for Svelte 5 onDestroy / $effect
  return () => {
    sse.close()
    activeSSE.delete(callerId)
  }
}

export async function send(channel: string, ...args: any[]): Promise<void> {
  const payload: RpcPayload = { channel, args }
  await requestJson<{ ok: boolean; error?: string }>(`${apiBaseUrl()}/api/ipc/send`, payload)
}

const localBus = new EventTarget()

export function on(channel: string, callback: (payload: any) => void): () => void {
  const handler = (event: Event) => callback((event as CustomEvent).detail)
  localBus.addEventListener(channel, handler)
  return () => localBus.removeEventListener(channel, handler)
}

export function emit(channel: string, payload: any) {
  console.log('emit', { channel, payload })
  localBus.dispatchEvent(new CustomEvent(channel, { detail: payload }))
}

export function syncInvoke<T = any>(channel: string, ...args: any[]): T {
  const xhr = new XMLHttpRequest()
  xhr.open('POST', `${apiBaseUrl()}/api/ipc/invoke`, false)
  xhr.setRequestHeader('Content-Type', 'application/json')
  const token = getAccessToken()
  if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
  xhr.send(JSON.stringify({ channel, args }))
  if (xhr.status < 200 || xhr.status >= 300) {
    throw new Error(`[RPC] ${xhr.status} ${xhr.statusText}`)
  }
  const result = JSON.parse(xhr.responseText)
  if (!result?.ok) {
    throw new Error(result?.error || `RPC sync invoke failed: ${channel}`)
  }
  return result.data as T
}
