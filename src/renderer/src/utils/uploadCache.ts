type UploadCacheEntry = {
  file: File
  ts: number
  size: number
}

const MAX_ENTRIES = 20
const MAX_BYTES = 200 * 1024 * 1024

const cache = new Map<string, UploadCacheEntry>()
let lastEntry: UploadCacheEntry | null = null

function normalizeKey(path: string) {
  let raw = String(path || '').replace(/\\/g, '/').trim()
  try {
    raw = decodeURIComponent(raw)
  } catch {
    // ignore
  }
  if (!raw) return ''
  let value = raw.replace(/^\/+/, '')
  if (value.startsWith('drive/')) value = value.slice('drive/'.length)
  if (value.startsWith('home/')) return value
  if (value.startsWith('data/')) return value
  return value
}

function currentBytes() {
  let total = 0
  cache.forEach((entry) => {
    total += entry.size
  })
  return total
}

function pruneIfNeeded() {
  let bytes = currentBytes()
  if (cache.size <= MAX_ENTRIES && bytes <= MAX_BYTES) return
  const entries = Array.from(cache.entries()).sort((a, b) => a[1].ts - b[1].ts)
  for (const [key, entry] of entries) {
    cache.delete(key)
    bytes -= entry.size
    if (cache.size <= MAX_ENTRIES && bytes <= MAX_BYTES) break
  }
}

export function storeUploadedFile(path: string, file: File, aliases: string[] = []) {
  if (!path || !file) return
  const entry = { file, ts: Date.now(), size: file.size || 0 }
  const base = normalizeKey(path)
  const derived = [
    base ? `drive/${base}` : '',
    base ? `/${base}` : '',
    base
  ]
  const keys = [path, normalizeKey(path), ...aliases.map((alias) => normalizeKey(alias)), ...derived]
    .map((key) => String(key || '').trim())
    .filter(Boolean)
  keys.forEach((key) => cache.set(key, entry))
  lastEntry = entry
  pruneIfNeeded()
}

export function getUploadedFile(path: string): File | null {
  if (!path) return null
  const entry = cache.get(path) || cache.get(normalizeKey(path))
  return entry?.file || null
}

export function getLastUploadedFile(): File | null {
  return lastEntry?.file || null
}

export function clearUploadedFile(path: string) {
  if (!path) return
  cache.delete(path)
}
