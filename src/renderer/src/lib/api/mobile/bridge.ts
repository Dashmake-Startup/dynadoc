import { Preferences } from '@capacitor/preferences'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Network } from '@capacitor/network'
import { invoke as webInvoke, send as webSend, on as webOn, emit as webEmit } from '../web/rpc'
import { resolveApiBaseUrl } from '../shared/baseUrl'
import { syncManager } from './syncManager'

const apiBaseUrl = () => resolveApiBaseUrl().replace(/\/$/, '')
const CACHE_PREFIX = 'rpc-cache:'
const RESOURCE_MAP_KEY = 'mobile-resource-map-v1'
const LOCAL_WRITE_DIR = Directory.Data
const ACCESS_TOKEN_KEY = 'ddoc.access_token'

function getAccessToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

type CacheEntry<T = any> = { value: T; expiresAt: number }

const memoryCache = new Map<string, CacheEntry>()
const cacheTTL: Record<string, number> = {
  'get-fonts': 1000 * 60 * 60 * 6,
  'get-storage-dir': 1000 * 60 * 60,
  'get-cache-dir': 1000 * 60 * 60,
  'get-temp-dir': 1000 * 60 * 60
}

let resourceMap: Record<string, string> | null = null

async function loadResourceMap() {
  if (resourceMap) return resourceMap
  const existing = await Preferences.get({ key: RESOURCE_MAP_KEY })
  resourceMap = existing.value ? JSON.parse(existing.value) : {}
  return resourceMap
}

async function saveResourceMap() {
  if (!resourceMap) return
  await Preferences.set({ key: RESOURCE_MAP_KEY, value: JSON.stringify(resourceMap) })
}

function hashString(input: string) {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/').trim()
}

async function getResourceIdForPath(path: string) {
  const normalized = normalizePath(path)
  const map = await loadResourceMap()
  if (map[normalized]) return map[normalized]
  const id = `res_${hashString(normalized)}`
  map[normalized] = id
  await saveResourceMap()
  return id
}

async function updateResourcePath(oldPath: string, newPath: string) {
  const map = await loadResourceMap()
  const normalizedOld = normalizePath(oldPath)
  const normalizedNew = normalizePath(newPath)
  const id = map[normalizedOld]
  if (id) {
    delete map[normalizedOld]
    map[normalizedNew] = id
    await saveResourceMap()
  }
}

function resourcePathForId(resourceId: string) {
  return `${resourceId}.bin`
}

function isCapFilePath(path: string) {
  return (
    path.startsWith('_cap_file_') || path.startsWith('file://') || path.startsWith('content://')
  )
}

async function getNetworkStatus() {
  try {
    return await Network.getStatus()
  } catch {
    return { connected: navigator.onLine }
  }
}

async function cacheGet<T>(key: string): Promise<T | null> {
  const entry = memoryCache.get(key)
  if (entry && entry.expiresAt > Date.now()) return entry.value as T
  const stored = await Preferences.get({ key: CACHE_PREFIX + key })
  if (!stored.value) return null
  try {
    const parsed = JSON.parse(stored.value) as CacheEntry<T>
    if (parsed.expiresAt > Date.now()) {
      memoryCache.set(key, parsed)
      return parsed.value
    }
  } catch {
    return null
  }
  return null
}

async function cacheSet<T>(key: string, value: T, ttl: number) {
  const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttl }
  memoryCache.set(key, entry)
  await Preferences.set({ key: CACHE_PREFIX + key, value: JSON.stringify(entry) })
}

function cacheKeyFor(channel: string, args: any[]) {
  return `${channel}:${JSON.stringify(args || [])}`
}

async function readFileLocal(path: string, encoding?: string): Promise<string> {
  if (isCapFilePath(path)) {
    const data = await Filesystem.readFile({ path, encoding: encoding as Encoding })
    return data.data as string
  }
  const resourceId = await getResourceIdForPath(path)
  const data = await Filesystem.readFile({
    path: resourcePathForId(resourceId),
    directory: LOCAL_WRITE_DIR,
    encoding: (encoding || Encoding.UTF8) as Encoding
  })
  return data.data as string
}

async function readFileBinaryLocal(path: string): Promise<ArrayBuffer> {
  if (isCapFilePath(path)) {
    const data = await Filesystem.readFile({ path })
    return base64ToArrayBuffer(data.data as string)
  }
  const resourceId = await getResourceIdForPath(path)
  const data = await Filesystem.readFile({
    path: resourcePathForId(resourceId),
    directory: LOCAL_WRITE_DIR
  })
  return base64ToArrayBuffer(data.data as string)
}

async function writeFileLocal(path: string, data: any, encoding?: string) {
  const resourceId = await getResourceIdForPath(path)
  const payload = normalizeWritePayload(data, encoding)
  await Filesystem.writeFile({
    path: resourcePathForId(resourceId),
    directory: LOCAL_WRITE_DIR,
    data: payload.data,
    encoding: payload.encoding
  })
  return true
}

async function deleteFileLocal(path: string) {
  const resourceId = await getResourceIdForPath(path)
  await Filesystem.deleteFile({
    path: resourcePathForId(resourceId),
    directory: LOCAL_WRITE_DIR
  })
  return true
}

async function moveFileLocal(oldPath: string, newPath: string) {
  const oldId = await getResourceIdForPath(oldPath)
  const newId = await getResourceIdForPath(newPath)
  const oldFile = resourcePathForId(oldId)
  const newFile = resourcePathForId(newId)
  await Filesystem.rename({
    from: oldFile,
    to: newFile,
    directory: LOCAL_WRITE_DIR
  })
  await updateResourcePath(oldPath, newPath)
  return true
}

async function invokeRemote<T = any>(channel: string, ...args: any[]): Promise<T> {
  return webInvoke<T>(channel, { asResponse: false }, ...args)
}

export async function invoke<T = any>(channel: string, ...args: any[]): Promise<T> {
  const status = await getNetworkStatus()
  const offline = !status.connected

  if (channel === 'settings:get') {
    const key = String(args[0] ?? '')
    const pref = await Preferences.get({ key })
    const localValue = pref.value == null ? null : pref.value
    if (localValue == null) {
      if (!(await getNetworkStatus()).connected) return null as T
    }
    if (!(await getNetworkStatus()).connected) {
      if (localValue == null) return null as T
      try {
        return JSON.parse(localValue) as T
      } catch {
        return localValue as T
      }
    }
    try {
      const remoteValue = await invokeRemote<any>('settings:get', key)
      if (remoteValue != null) {
        await Preferences.set({ key, value: JSON.stringify(remoteValue) })
        return remoteValue as T
      }
    } catch {
      // fallback to local
    }
    try {
      return JSON.parse(localValue ?? '') as T
    } catch {
      return localValue as T
    }
  }
  if (channel === 'settings:set') {
    const key = String(args[0] ?? '')
    const value = args[1]
    await Preferences.set({ key, value: JSON.stringify(value) })
    const status = await getNetworkStatus()
    if (status.connected) {
      try {
        await invokeRemote('settings:set', key, value)
      } catch {
        await syncManager.enqueue({ channel, args })
      }
    } else {
      await syncManager.enqueue({ channel, args })
    }
    return true as T
  }

  if (channel === 'read-file' || channel === 'read-file-content') {
    const [filePath, encoding] = args
    if (offline) return (await readFileLocal(filePath, encoding)) as T
  }

  if (channel === 'fs:readFile' || channel === 'fs:readFileSync') {
    const [filePath, encoding] = args
    if (offline) return (await readFileLocal(filePath, encoding)) as T
  }

  if (
    channel === 'fs:writeFile' ||
    channel === 'fs:writeFileSync' ||
    channel === 'write-file' ||
    channel === 'save-file'
  ) {
    if (offline) {
      await writeFileLocal(args[0], args[1], args[2])
      await syncManager.enqueue({ channel, args })
      return true as T
    }
  }

  if (channel === 'delete-file' && offline) {
    await deleteFileLocal(args[0])
    await syncManager.enqueue({ channel, args })
    return true as T
  }

  if (channel === 'move-file' && offline) {
    await moveFileLocal(args[0], args[1])
    await syncManager.enqueue({ channel, args })
    return true as T
  }

  if (channel === 'rename-file' && offline) {
    const oldPath = args[0]
    const newName = args[1]
    const newPath = `${oldPath.replace(/\\/g, '/').replace(/\/[^/]+$/, '')}/${newName}`
    await moveFileLocal(oldPath, newPath)
    await syncManager.enqueue({ channel, args })
    return true as T
  }

  const ttl = cacheTTL[channel]
  if (ttl) {
    const key = cacheKeyFor(channel, args)
    const cached = await cacheGet<T>(key)
    if (cached !== null) return cached
    const data = await invokeRemote<T>(channel, ...args)
    await cacheSet(key, data, ttl)
    return data
  }

  try {
    return await invokeRemote<T>(channel, ...args)
  } catch (error) {
    if (offline) {
      const key = cacheKeyFor(channel, args)
      const cached = await cacheGet<T>(key)
      if (cached !== null) return cached
    }
    throw error
  }
}

export async function invokeBinary(channel: string, ...args: any[]): Promise<ArrayBuffer> {
  const payload = { channel, args }
  const token = getAccessToken()
  const response = await fetch(`${apiBaseUrl()}/api/ipc/invoke-binary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/octet-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`[RPC] ${response.status} ${response.statusText} ${text}`)
  }
  return await response.arrayBuffer()
}

export async function readFileBinary(path: string) {
  const status = await getNetworkStatus()
  if (!status.connected) return readFileBinaryLocal(path)
  return invokeBinary('read-file-content', path, null)
}

export const send = webSend
export const on = webOn
export const emit = webEmit

export const mobileBridge = {
  invoke,
  send,
  on,
  readFileBinary
}

function normalizeWritePayload(data: any, encoding?: string) {
  if (data instanceof ArrayBuffer) {
    return { data: arrayBufferToBase64(data) }
  }
  if (ArrayBuffer.isView(data)) {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    const copy = new Uint8Array(bytes)
    return { data: arrayBufferToBase64(copy.buffer) }
  }
  if (typeof data === 'string') {
    return { data, encoding: (encoding || Encoding.UTF8) as Encoding }
  }
  return { data: JSON.stringify(data), encoding: Encoding.UTF8 }
}

function base64ToArrayBuffer(base64: string) {
  const cleaned = base64.includes(',') ? base64.split(',')[1] : base64
  const binary = atob(cleaned)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

syncManager.init({
  getNetworkStatus,
  invokeRemote
})
