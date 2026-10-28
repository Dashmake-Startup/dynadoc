import { unzipSync, strFromU8, strToU8 } from 'fflate'

type ShareCacheEntry = {
  files: Map<string, Uint8Array>
  dirs: Set<string>
  children: Map<string, Set<string>>
  sizeBytes: number
  createdAt: number
  lastAccess: number
}

const shareCaches = new Map<string, ShareCacheEntry>()
// Idle window before a mounted archive is dropped. It is a sliding window:
// every read refreshes lastAccess. Five minutes was far too short in practice,
// because a shared document is read from the cache when it opens and then not
// again: someone reading for ten minutes, or switching apps and coming back,
// returned to "We couldn't find this document" with the file still on screen.
// Memory stays bounded by the entry and byte caps below, not by this value.
const SHARE_CACHE_TTL_MS = 2 * 60 * 60 * 1000
const SHARE_CACHE_MAX_ENTRIES = 64
const SHARE_CACHE_MAX_BYTES = 250 * 1024 * 1024
let shareCacheTotalBytes = 0

function normalizePath(value: string): string {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
}

export function shareCacheResolvePath(path: string): string {
  const normalized = normalizePath(path)
  if (!normalized || !normalized.startsWith('share-cache/')) return normalized
  const parts = normalized.split('/')
  const shareId = parts[1]
  if (shareId && shareCaches.has(shareId)) return normalized

  const suffix = parts.slice(1).join('/')
  for (const [id, entry] of shareCaches) {
    if (!id || !entry) continue
    if (!suffix) return normalizePath(`share-cache/${id}`)
    const candidate = normalizePath(`share-cache/${id}/${suffix}`)
    if (entry.files.has(candidate) || entry.dirs.has(candidate)) {
      return candidate
    }
  }
  return normalized
}

export function shareCacheIdFromPath(path: string): string {
  const normalized = normalizePath(path)
  if (!normalized.startsWith('share-cache/')) return ''
  const parts = normalized.split('/')
  return parts[1] || ''
}

export function clearShareCache(shareId: string) {
  const id = String(shareId || '')
  if (!id) return
  evictEntry(id)
}

export function clearAllShareCaches() {
  for (const id of shareCaches.keys()) {
    evictEntry(id)
  }
}

function ensureDir(dirs: Set<string>, children: Map<string, Set<string>>, dirPath: string) {
  const normalized = normalizePath(dirPath)
  if (!normalized) return
  const parts = normalized.split('/')
  let cursor = ''
  for (const part of parts) {
    cursor = cursor ? `${cursor}/${part}` : part
    if (!dirs.has(cursor)) dirs.add(cursor)
    const parent = cursor.split('/').slice(0, -1).join('/')
    const childName = cursor.split('/').slice(-1)[0]
    const parentKey = parent || ''
    const set = children.get(parentKey) || new Set<string>()
    set.add(childName)
    children.set(parentKey, set)
  }
}

function touchEntry(id: string, entry: ShareCacheEntry) {
  entry.lastAccess = Date.now()
  if (shareCaches.get(id) !== entry) return
  shareCaches.delete(id)
  shareCaches.set(id, entry)
}

function evictEntry(id: string) {
  const entry = shareCaches.get(id)
  if (!entry) return
  shareCaches.delete(id)
  shareCacheTotalBytes = Math.max(0, shareCacheTotalBytes - (entry.sizeBytes || 0))
}

function pruneShareCache() {
  const now = Date.now()
  for (const [id, entry] of shareCaches) {
    if (entry.lastAccess && now - entry.lastAccess > SHARE_CACHE_TTL_MS) {
      evictEntry(id)
    }
  }
  while (shareCaches.size > SHARE_CACHE_MAX_ENTRIES) {
    const oldest = shareCaches.keys().next().value
    if (!oldest) break
    evictEntry(oldest)
  }
  while (shareCacheTotalBytes > SHARE_CACHE_MAX_BYTES) {
    const oldest = shareCaches.keys().next().value
    if (!oldest) break
    evictEntry(oldest)
  }
}

export function mountShareZip(
  shareId: string,
  buffer: ArrayBuffer,
  options?: { baseId?: string; preferredRootName?: string }
) {
  // const id = String(shareId || 'share')
  // const id = String(shareId || 'share')
  const baseId = String(options?.baseId)
  // const baseId = String(options?.baseId || id)
  const id = String(baseId || 'share')
  const preferredRootName = String(options?.preferredRootName || '').trim()


  /* let preferredRootName = String(options?.preferredRootName || '').trim()
  if (preferredRootName) {
    preferredRootName = preferredRootName
      .replace(/\/index\.html?$/i, '')
      .replace(/\/index$/i, '')
      .replace(/\/+$/g, '')
  } */

  const entry: ShareCacheEntry = {
    files: new Map(),
    dirs: new Set(),
    children: new Map(),
    sizeBytes: 0,
    createdAt: Date.now(),
    lastAccess: Date.now()
  }
  const files = unzipSync(new Uint8Array(buffer))
  const paths = Object.keys(files || {})

  console.log("mountShareZipmountShareZip mounting", { files, paths, id, baseId, preferredRootName })

  let topLevel = ''
  if (paths.length) {
    const firstSegments = new Set<string>()
    for (const rawPath of paths) {
      const cleaned = normalizePath(rawPath)
      const [first] = cleaned.split('/')
      if (first) firstSegments.add(first)
      if (firstSegments.size > 1) break
    }
    if (firstSegments.size === 1) {
      topLevel = Array.from(firstSegments)[0]
    }
  }

  let rootFolder = topLevel || preferredRootName
  if (preferredRootName) {
    const lowered = String(topLevel || '').toLowerCase()
    if (
      lowered === '' ||
      lowered === 'index' ||
      lowered === 'index.html' ||
      lowered === 'index.htm'
    ) {
      rootFolder = preferredRootName
    }
  }

  /*  const lowered = String(topLevel || '').toLowerCase()
  if (lowered && lowered !== 'index' && lowered !== 'index.html' && lowered !== 'index.htm') {
    // Zip already contains the real root folder (e.g. "New Document/"),
    // so mount directly under share-cache/<baseId>/ to avoid duplication.
    rootFolder = ''
  } else if (preferredRootName) {
    // Zip root is ambiguous (index/), so force the real doc folder.
    rootFolder = preferredRootName
  } */

  const baseRoot = normalizePath(`share-cache/${baseId}`)
  const root = `${baseRoot}${rootFolder ? `/${rootFolder}` : ''}`
  console.log("mountShareZipmountShareZip mounting root", { root, files, paths, id, baseId, preferredRootName })

  for (const rawPath of paths) {
    const data = files[rawPath]
    if (!data) continue
    let cleaned = normalizePath(rawPath)
    if (!cleaned) continue
    if (rootFolder) {
      if (topLevel) {
        if (cleaned === topLevel) {
          cleaned = rootFolder
        } else if (cleaned.startsWith(`${topLevel}/`)) {
          cleaned = `${rootFolder}/${cleaned.slice(topLevel.length + 1)}`
        }
      } else {
        cleaned = `${rootFolder}/${cleaned}`
      }
    }
    if (cleaned.endsWith('/')) {
      ensureDir(entry.dirs, entry.children, `${baseRoot}/${cleaned}`)
      continue
    }
    const fullPath = normalizePath(`${baseRoot}/${cleaned}`)
    entry.files.set(fullPath, data)
    entry.sizeBytes += data.length
    const parentDir = fullPath.split('/').slice(0, -1).join('/')
    ensureDir(entry.dirs, entry.children, parentDir)
    const fileName = fullPath.split('/').slice(-1)[0]
    const set = entry.children.get(parentDir) || new Set<string>()
    set.add(fileName)
    entry.children.set(parentDir, set)
    console.log("mountShareZipmountShareZip ensureDir", { baseRoot, root, fullPath, parentDir, fileName })

  }

  shareCacheTotalBytes += entry.sizeBytes
  shareCaches.set(id, entry)
  pruneShareCache()
  console.log("mountShareZipmountShareZip mounting finally  root", { root, files, paths, id, baseId, shareCaches })

  return { root }
}

export function mountShareFile(
  shareId: string,
  fileName: string,
  data: Uint8Array,
  options?: { baseId?: string }
) {
  // const id = String(shareId || 'share')
  // const baseId = String(options?.baseId || id)
  const baseId = String(options?.baseId)
  const id = String(baseId || 'share')

  const entry: ShareCacheEntry = {
    files: new Map(),
    dirs: new Set(),
    children: new Map(),
    sizeBytes: 0,
    createdAt: Date.now(),
    lastAccess: Date.now()
  }
  const root = normalizePath(`share-cache/${baseId}`)
  const name = normalizePath(fileName || 'shared-file')
  const fullPath = normalizePath(`${root}/${name}`)
  entry.files.set(fullPath, data)
  entry.sizeBytes += data.length
  const parentDir = fullPath.split('/').slice(0, -1).join('/')
  ensureDir(entry.dirs, entry.children, parentDir)
  const fileNameOnly = fullPath.split('/').slice(-1)[0]
  const set = entry.children.get(parentDir) || new Set<string>()
  set.add(fileNameOnly)
  entry.children.set(parentDir, set)
  shareCacheTotalBytes += entry.sizeBytes
  shareCaches.set(id, entry)
  pruneShareCache()
  return { root, filePath: fullPath }
}

export function shareCacheHas(path: string) {
  
  const normalized = normalizePath(path)
  const [, shareId] = normalized.split('/')
          // console.log("existsssssss shareCacheHas",{path,normalized,shareCaches,shareId})

  if (!shareId) return false
  const entry = shareCaches.get(shareId)
            // console.log("existsssssss shareCacheHas entry",{path,normalized,shareCaches,shareId, entry}, entry.files.has(normalized))

  if (!entry) return false
  touchEntry(shareId, entry)
              // console.log("existsssssss shareCacheHas entry",{path,normalized,shareCaches,shareId, entry}, entry.files.has(normalized),entry.dirs.has(normalized))

  return entry.files.has(normalized) || entry.dirs.has(normalized)
}

export function shareCacheReadFile(path: string, encoding?: string) {
  const normalized = normalizePath(path)
  const [, shareId] = normalized.split('/')
  const entry = shareCaches.get(shareId)
  if (!entry) return null
  const data = entry.files.get(normalized)
  if (!data) return null
  touchEntry(shareId, entry)
  if (!encoding || encoding === 'utf8' || encoding === 'utf-8') {
    return strFromU8(data)
  }
  return data
}

export function shareCacheListDir(path: string) {
  const normalized = normalizePath(path)
  const [, shareId] = normalized.split('/')
  const entry = shareCaches.get(shareId)
  if (!entry) return []
  touchEntry(shareId, entry)
  const children = entry.children.get(normalized) || entry.children.get('') || new Set<string>()
  return Array.from(children)
}

export function shareCacheStat(path: string) {
  const normalized = normalizePath(path)
  const [, shareId] = normalized.split('/')
  const entry = shareCaches.get(shareId)
  if (!entry) return null
  if (entry.files.has(normalized)) {
    const data = entry.files.get(normalized)
    touchEntry(shareId, entry)
    return {
      isFile: () => true,
      isDirectory: () => false,
      size: data ? data.length : 0,
      mtime: new Date()
    }
  }
  if (entry.dirs.has(normalized)) {
    touchEntry(shareId, entry)
    return {
      isFile: () => false,
      isDirectory: () => true,
      size: 0,
      mtime: new Date()
    }
  }
  return null
}

export function shareCacheEnsureDir(path: string) {
  const normalized = normalizePath(path)
  if (!normalized.startsWith('share-cache/')) return false
  const [, shareId] = normalized.split('/')
  if (!shareId) return false
  let entry = shareCaches.get(shareId)
  if (!entry) {
    entry = {
      files: new Map(),
      dirs: new Set(),
      children: new Map(),
      sizeBytes: 0,
      createdAt: Date.now(),
      lastAccess: Date.now()
    }
    shareCaches.set(shareId, entry)
  }
  ensureDir(entry.dirs, entry.children, normalized)
  touchEntry(shareId, entry)
  pruneShareCache()
  return true
}

export function shareCacheWriteFile(path: string, data: any, encoding?: string) {
  const normalized = normalizePath(path)
  if (!normalized.startsWith('share-cache/')) return false
  const [, shareId] = normalized.split('/')
  if (!shareId) return false
  let entry = shareCaches.get(shareId)
  if (!entry) {
    entry = {
      files: new Map(),
      dirs: new Set(),
      children: new Map(),
      sizeBytes: 0,
      createdAt: Date.now(),
      lastAccess: Date.now()
    }
    shareCaches.set(shareId, entry)
  }
  const bytes =
    data instanceof Uint8Array
      ? data
      : typeof data === 'string'
        ? strToU8(data)
        : data?.buffer
          ? new Uint8Array(data.buffer)
          : strToU8(String(data ?? ''))
  entry.files.set(normalized, bytes)
  entry.sizeBytes += bytes.length
  const parentDir = normalized.split('/').slice(0, -1).join('/')
  ensureDir(entry.dirs, entry.children, parentDir)
  const name = normalized.split('/').slice(-1)[0]
  const set = entry.children.get(parentDir) || new Set<string>()
  set.add(name)
  entry.children.set(parentDir, set)
  touchEntry(shareId, entry)
  pruneShareCache()
  return true
}
