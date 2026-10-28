import { invoke, on } from './rpc'
import { Buffer } from 'buffer'
import pathBrowserify from 'path-browserify'
import { isGuestMode } from '../../../utils/authMode'
import {
  shareCacheEnsureDir,
  shareCacheHas,
  shareCacheListDir,
  shareCacheReadFile,
  shareCacheResolvePath,
  shareCacheStat,
  shareCacheWriteFile
} from '../../../utils/shareCache'

if (typeof window !== 'undefined' && !(window as any).Buffer) {
  ;(window as any).Buffer = Buffer
}

function normalizeEncoding(encoding?: string): string | undefined {
  if (!encoding) return undefined
  return encoding
}

function normalizeRemotePath(input: string): string {
  if (!input) return input
  let value = String(input)
    .replace(/\\/g, '/')
    .replace(/^file:\/\//i, '')
  if (value.startsWith('share-cache/')) return value.replace(/^\/+/, '')
  if (value.startsWith('home/share-cache/')) return value.replace(/^home\//, '').replace(/^\/+/, '')
  if (value === 'drive') return ''
  if (value.startsWith('drive/')) value = value.slice('drive/'.length)
  if (/^[A-Za-z]:/.test(value)) {
    value = value.replace(/^[A-Za-z]:/, '')
  }
  value = value.replace(/^\/+/, '')
  return value
}

function resolveSharePath(input: string): string {
  const normalized = normalizeRemotePath(input)
  return shareCacheResolvePath(normalized)
}

export function isShareCachePath(value: string): boolean {
  return Boolean(value && value.startsWith('share-cache/'))
}

export function isPublicTempPath(value: string): boolean {
  return Boolean(value && value.startsWith('public-temp/'))
}

const syncCache = new Map<string, any>()
const LOCAL_CACHE_PREFIX = 'ddoc-web-fs-cache:'

function isAllowedInGuestMode(path: string): boolean {
  return isShareCachePath(path) || isPublicTempPath(path)
}

// The synchronous fs shims answer from cache and refresh in the background.
// They only ever recorded successes, so a call that failed left nothing behind
// and the next render fired it again — an unbounded retry loop. Opening a
// protected share (reads legitimately denied until verification) produced
// ~4 requests per second and froze the renderer.
//
// Two guards: never run the same request twice concurrently, and back off
// briefly after a failure so a denied read cannot spin. The window is short so
// the value still appears on its own once access is granted.
const inFlight = new Set<string>()
const retryAfter = new Map<string, number>()
const FAILURE_BACKOFF_MS = 5000

function shouldFetch(key: string): boolean {
  if (syncCache.has(key)) return false
  if (inFlight.has(key)) return false
  const until = retryAfter.get(key)
  if (until !== undefined && Date.now() < until) return false
  inFlight.add(key)
  return true
}

function noteFetchFailed(key: string) {
  inFlight.delete(key)
  retryAfter.set(key, Date.now() + FAILURE_BACKOFF_MS)
}

function noteFetchSucceeded<T>(key: string, value: T): T {
  inFlight.delete(key)
  retryAfter.delete(key)
  return remember(key, value)
}

// Opening one document used to fire the same fs:existsSync/statSync/readFile
// probe several times over (loadFrom, hasConfigFile, the info/config helpers
// and Editor.svelte's re-probe all ask about the same handful of paths).
// asyncReadCache coalesces concurrent identical fsPromises reads into one
// request and caches the resolved value for the rest of the session, keyed
// the same way as the sync shims above so either surface can serve the
// other's cached answer (safe because dynadoc-drive-ready, dispatched
// unconditionally early in boot, already clears any value the sync shims
// pulled from localStorage before this cache can see it). It only ever
// remembers a success — a rejection (e.g. a 404 on a missing file) is
// dropped so the next call retries — and it is cleared on any write,
// in-memory only (never persisted: a stale exists/readFile surviving a
// reload would be a cross-device staleness bug).
//
// Guest-mode answers (`invoke` resolves those locally, with no request) are
// never cached: caching a guest "false"/"" here would survive the sign-in
// that follows and make the first open after login read back stale empty
// answers instead of the real file.
//
// cacheGeneration guards a request that is still in flight when a write
// clears the cache: without it, that older read resolves after the clear
// and writes its now-stale answer straight back into syncCache, undoing the
// invalidation the write was for.
let cacheGeneration = 0
const asyncReadCache = new Map<string, Promise<any>>()

function cachedRead<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (isGuestMode()) return fetcher()
  if (syncCache.has(key)) return Promise.resolve(syncCache.get(key) as T)
  const pending = asyncReadCache.get(key)
  if (pending) return pending as Promise<T>
  const gen = cacheGeneration
  const promise = fetcher()
    .then((value) => {
      if (gen === cacheGeneration) syncCache.set(key, value)
      if (asyncReadCache.get(key) === promise) asyncReadCache.delete(key)
      return value
    })
    .catch((err) => {
      if (asyncReadCache.get(key) === promise) asyncReadCache.delete(key)
      throw err
    })
  asyncReadCache.set(key, promise)
  return promise
}

function clearSyncCache() {
  syncCache.clear()
  inFlight.clear()
  retryAfter.clear()
  asyncReadCache.clear()
  cacheGeneration += 1
  if (typeof window === 'undefined') return
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && key.startsWith(LOCAL_CACHE_PREFIX)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    // ignore
  }
}

function cacheKey(prefix: string, args: any[]) {
  return `${prefix}:${JSON.stringify(args || [])}`
}

function remember<T>(key: string, value: T) {
  syncCache.set(key, value)
  if (typeof value === 'string' && typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_CACHE_PREFIX + key, value)
    } catch {
      // ignore
    }
  }
  return value
}

function cached<T>(key: string, fallback: T): T {
  if (syncCache.has(key)) return syncCache.get(key) as T
  if (typeof window !== 'undefined' && typeof fallback === 'string') {
    try {
      const stored = localStorage.getItem(LOCAL_CACHE_PREFIX + key)
      if (stored != null) {
        syncCache.set(key, stored)
        return stored as T
      }
    } catch {
      // ignore
    }
  }
  return fallback
}

if (typeof window !== 'undefined') {
  window.addEventListener('dynadoc-drive-ready', () => {
    clearSyncCache()
  })
  // Writes that bypass this module entirely — drive:upload, drive:mkdir,
  // drive:move-item, rename-file, move-file, sync-assets, (un)ddocify, the
  // multipart drive upload and document conversion — still invalidate the
  // read cache above via this event (dispatched from rpc.ts on each of
  // those channels' success).
  window.addEventListener('dynadoc-fs-mutated', () => {
    clearSyncCache()
  })
}

// A cached readFile/exists answer must not survive a sign-in or sign-out in
// the same tab: it was resolved for whoever was authenticated at the time,
// and the next session (a different user, or none) must not be served it.
on('auth:session-changed', () => {
  clearSyncCache()
})

export const webNode = {
  fs: {
    readFileSync: (filePath: string, encoding?: string) => {
      const normalized = resolveSharePath(filePath)
      if (shareCacheHas(normalized)) {
        const cached = shareCacheReadFile(normalized, encoding)
        return typeof cached === 'string' ? cached : ''
      }
      if (isShareCachePath(normalized)) {
        console.warn('[share-cache] readFileSync miss', normalized)
        return ''
      }
      const key = cacheKey('fs:readFile', [normalized, encoding])
      if (shouldFetch(key)) {
        void invoke<string>(
          'fs:readFile',
          { asResponse: false },
          normalized,
          normalizeEncoding(encoding)
        )
          .then((value) => noteFetchSucceeded(key, value))
          .catch(() => noteFetchFailed(key))
      }
      return cached<string>(key, '')
    },
    readFile: async (filePath: string, encoding?: string) =>
      shareCacheHas(resolveSharePath(filePath))
        ? (shareCacheReadFile(resolveSharePath(filePath), encoding) as any)
        : isShareCachePath(resolveSharePath(filePath))
          ? // A share-cache path with nothing behind it used to read as an empty
            // file. The editor then opened a blank document and nobody could
            // tell whether the archive was never mounted, mounted elsewhere or
            // evicted. Fail like a missing file does, naming the path.
            Promise.reject(
              Object.assign(
                new Error(`Shared content is not available: ${resolveSharePath(filePath)}`),
                { code: 'ENOENT', path: resolveSharePath(filePath) }
              )
            )
          : remember(
              cacheKey('fs:readFile', [resolveSharePath(filePath), encoding]),
              await invoke<string>(
                'fs:readFile',
                { asResponse: false },
                resolveSharePath(filePath),
                normalizeEncoding(encoding)
              )
            ),
    exists: (filePath: string) => {
      const resolved = resolveSharePath(filePath)
      if (shareCacheHas(resolved)) return Promise.resolve(true)
      if (isShareCachePath(resolved)) return Promise.resolve(false)
      return invoke<boolean>('fs:existsSync', { asResponse: false }, resolved)
    },
    existsSync: (filePath: string) => {
      const normalized = normalizeRemotePath(filePath)
      if (isGuestMode() && !isAllowedInGuestMode(normalized)) return false
      if (isAllowedInGuestMode(normalized) || normalized === '.') {
        return true
      }
      if (!normalized) return false

      if (shareCacheHas(normalized)) return true
      if (isShareCachePath(normalized)) return false
      const key = cacheKey('fs:existsSync', [normalized])

      if (shouldFetch(key)) {
        void invoke<boolean>('fs:existsSync', { asResponse: false }, normalized)
          .then((value) => noteFetchSucceeded(key, value))
          .catch(() => noteFetchFailed(key))
      }
      return cached<boolean>(key, false)
    },
    writeFileSync: (filePath: string, data: any, encoding?: string) => {
      const normalized = normalizeRemotePath(filePath)
      if (isGuestMode() && !isAllowedInGuestMode(normalized)) return false

      if (isShareCachePath(normalized)) {
        return shareCacheWriteFile(normalized, data, encoding)
      }
      if (!normalized) return false

      void invoke<boolean>(
        'fs:writeFileSync',
        { asResponse: false },
        normalized,
        data,
        normalizeEncoding(encoding)
      ).then(() => clearSyncCache())
      return true
    },
    writeFile: async (filePath: string, data: any, encoding?: string) => {
      const normalized = normalizeRemotePath(filePath)
      if (isGuestMode() && !isAllowedInGuestMode(normalized)) return false
      if (isShareCachePath(normalized)) {
        return shareCacheWriteFile(normalized, data, encoding)
      }
      if (!normalized) return false
      const result = await invoke<boolean>(
        'fs:writeFile',
        { asResponse: false },
        normalized,
        data,
        normalizeEncoding(encoding)
      )
      clearSyncCache()
      return result
    },
    mkdirSync: (dirPath: string, options?: any) => {
      const normalized = normalizeRemotePath(dirPath)
      // Report the refusal instead of claiming the directory was created:
      // the sibling write shims already return false here, and pretending
      // otherwise lets a caller keep writing into a directory that does not
      // exist. (writeFileSync/writeFile below do the same.)
      if (isGuestMode() && !isAllowedInGuestMode(normalized)) return false
      if (isShareCachePath(normalized)) {
        return shareCacheEnsureDir(normalized)
      }
      if (!normalized || normalized === '.') return true
      void invoke<boolean>('fs:mkdirSync', { asResponse: false }, normalized, options).then(() =>
        clearSyncCache()
      )
      return true
    },
    readdirSync: (dirPath: string) => {
      const normalized = resolveSharePath(dirPath)
      if (shareCacheHas(normalized)) {
        return shareCacheListDir(normalized)
      }
      if (isShareCachePath(normalized)) {
        return []
      }
      const key = cacheKey('fs:readdirSync', [normalized])
      if (shouldFetch(key)) {
        void invoke<string[]>('fs:readdir', { asResponse: false }, normalized)
          .then((value) => noteFetchSucceeded(key, value))
          .catch(() => noteFetchFailed(key))
      }
      return cached<string[]>(key, [])
    },
    readdir: async (dirPath: string) =>
      shareCacheHas(resolveSharePath(dirPath))
        ? shareCacheListDir(resolveSharePath(dirPath))
        : isShareCachePath(resolveSharePath(dirPath))
          ? []
          : remember(
              cacheKey('fs:readdirSync', [resolveSharePath(dirPath)]),
              await invoke<string[]>('fs:readdir', { asResponse: false }, resolveSharePath(dirPath))
            ),
    lstatSync: (filePath: string) => {
      const normalized = resolveSharePath(filePath)
      if (shareCacheHas(normalized)) {
        return shareCacheStat(normalized)
      }
      if (isShareCachePath(normalized)) {
        return null
      }
      const key = cacheKey('fs:lstatSync', [normalized])
      if (shouldFetch(key)) {
        void invoke<any>('fs:lstatSync', { asResponse: false }, normalized)
          .then((value) => noteFetchSucceeded(key, value))
          .catch(() => noteFetchFailed(key))
      }
      return cached<any>(key, null)
    },
    statSync: (filePath: string) => {
      const normalized = resolveSharePath(filePath)
      console.log('webNode.fs.statSync called with', { filePath, normalized })

      if (shareCacheHas(normalized)) {
        return shareCacheStat(normalized)
      }
      if (isShareCachePath(normalized)) {
        return null
      }
      const key = cacheKey('fs:statSync', [normalized])
      if (shouldFetch(key)) {
        void invoke<any>('fs:statSync', { asResponse: false }, normalized)
          .then((value) => noteFetchSucceeded(key, value))
          .catch(() => noteFetchFailed(key))
      }
      return cached<any>(key, null)
    },
    unlinkSync: (filePath: string) => {
      void invoke<boolean>(
        'fs:unlinkSync',
        { asResponse: false },
        normalizeRemotePath(filePath)
      ).then(() => clearSyncCache())
      return true
    }
  },
  fsPromises: {
    readFile: (filePath: string, encoding?: string) => {
      const resolved = resolveSharePath(filePath)
      if (shareCacheHas(resolved)) {
        return Promise.resolve(shareCacheReadFile(resolved, encoding) as any)
      }
      if (isShareCachePath(resolved)) {
        return Promise.resolve('')
      }
      return cachedRead(cacheKey('fs:readFile', [resolved, encoding]), () =>
        invoke<string>('fs:readFile', { asResponse: false }, resolved, normalizeEncoding(encoding))
      )
    },
    readAssetBlob: async (filePath: string) => {
      const resolved = resolveSharePath(filePath)

      // Consistency check (Matches your readFile pattern)
      if (isShareCachePath(resolved)) return null

      try {
        // We pass [resolved] as the args array and { asResponse: true }
        const response = await invoke<Response>('fs:serveAsset', { asResponse: true }, resolved)

        if (!response.ok) {
          throw new Error(`Asset server returned ${response.status}`)
        }

        // Since we forced the return type to Response, we can call .blob()
        const blob = await (response as Response).blob()

        return {
          blob,
          url: URL.createObjectURL(blob),
          mimeType: blob.type
        }
      } catch (error) {
        console.error('readAssetBlob failed', { filePath, resolved, error })
        throw error
      }
    },
    writeFile: async (filePath: string, data: any, encoding?: string) => {
      const normalized = normalizeRemotePath(filePath)
      console.log('createNewDocument [webNode.fsPromises.writeFile] invoke', {
        path: normalized,
        encoding
      })
      if (!normalized) return false
      const result = await invoke<boolean>(
        'fs:writeFile',
        { asResponse: false },
        normalized,
        data,
        normalizeEncoding(encoding)
      )
      clearSyncCache()
      return result
    },
    readdir: (dirPath: string) => {
      const resolved = resolveSharePath(dirPath)
      if (shareCacheHas(resolved)) {
        return Promise.resolve(shareCacheListDir(resolved) as any)
      }
      if (isShareCachePath(resolved)) {
        return Promise.resolve([])
      }
      return cachedRead(cacheKey('fs:readdirSync', [resolved]), () =>
        invoke<string[]>('fs:readdir', { asResponse: false }, resolved)
      )
    },
    mkdir: async (dirPath: string, options?: any) => {
      const normalized = normalizeRemotePath(dirPath)
      if (isGuestMode() && !isShareCachePath(normalized)) return true
      if (isShareCachePath(normalized)) {
        return shareCacheEnsureDir(normalized)
      }
      if (!normalized || normalized === '.') return true
      const result = await invoke<boolean>('fs:mkdirSync', { asResponse: false }, normalized, options)
      clearSyncCache()
      return result
    },
    exists: (filePath: string) => {
      // return true
      const resolved = resolveSharePath(filePath)
      console.log(
        'existsssssss >>',
        { filePath, resolved },
        shareCacheHas(resolved),
        isShareCachePath(resolved)
      )
      if (shareCacheHas(resolved)) return Promise.resolve(true)
      if (isShareCachePath(resolved)) return Promise.resolve(false)
      return cachedRead(cacheKey('fs:existsSync', [resolved]), () =>
        invoke<boolean>('fs:existsSync', { asResponse: false }, resolved)
      )
    },
    stat: (filePath: string) => {
      const resolved = resolveSharePath(filePath)
      if (shareCacheHas(resolved)) return Promise.resolve(shareCacheStat(resolved))
      if (isShareCachePath(resolved)) return Promise.resolve(null)
      return cachedRead(cacheKey('fs:statSync', [resolved]), () =>
        invoke<any>('fs:statSync', { asResponse: false }, resolved)
      )
    },
    lstat: (filePath: string) => {
      const resolved = resolveSharePath(filePath)
      if (shareCacheHas(resolved)) return Promise.resolve(shareCacheStat(resolved))
      if (isShareCachePath(resolved)) return Promise.resolve(null)
      return cachedRead(cacheKey('fs:lstatSync', [resolved]), () =>
        invoke<any>('fs:lstatSync', { asResponse: false }, resolved)
      )
    },
    copyFile: async (sourcePath: string, destinationPath: string) => {
      const source = normalizeRemotePath(sourcePath)
      const destination = normalizeRemotePath(destinationPath)
      if (!source || !destination) return false
      const data = await invoke<any>('fs:readFile', { asResponse: false }, source)
      const result = await invoke<boolean>('fs:writeFile', { asResponse: false }, destination, data)
      clearSyncCache()
      return result
    },
    rename: async (oldPath: string, newPath: string) => {
      const result = await invoke<boolean>(
        'fs:renameSync',
        { asResponse: false },
        normalizeRemotePath(oldPath),
        normalizeRemotePath(newPath)
      )
      clearSyncCache()
      return result
    },
    open: (filePath: string, flags?: string) => {
      const resolved = resolveSharePath(filePath)
      if (isShareCachePath(resolved)) return Promise.resolve(null)
      return invoke<any>('fs:open', { asResponse: false }, resolved, flags)
    },
    unlink: async (filePath: string) => {
      const result = await invoke<boolean>(
        'fs:unlinkSync',
        { asResponse: false },
        normalizeRemotePath(filePath)
      )
      clearSyncCache()
      return result
    },
    rm: async (filePath: string, options?: any) => {
      const result = await invoke<boolean>(
        'fs:rmSync',
        { asResponse: false },
        normalizeRemotePath(filePath),
        options
      )
      clearSyncCache()
      return result
    }
  },
  /* path: {
    join: (...args: string[]) => pathBrowserify.posix.join(...args.map((p) => String(p || '').replace(/\\/g, '/'))),
    basename: (p: string, ext?: string) => pathBrowserify.basename(p, ext),
    extname: (p: string) => pathBrowserify.extname(p),
    dirname: (p: string) => pathBrowserify.dirname(p),
    resolve: (...args: string[]) => {
      const cleaned = args.map((p) => String(p || '').replace(/\\/g, '/'))
      return pathBrowserify.posix.resolve('/', ...cleaned).replace(/^\/+/, '')
    },
    relative: (from: string, to: string) => {
      const cleanFrom = String(from || '').replace(/\\/g, '/')
      const cleanTo = String(to || '').replace(/\\/g, '/')
      const absFrom = pathBrowserify.posix.resolve('/', cleanFrom)
      const absTo = pathBrowserify.posix.resolve('/', cleanTo)
      return pathBrowserify.posix.relative(absFrom, absTo)
    },
    sep: pathBrowserify.sep,
    parse: (p: string) => pathBrowserify.parse(p),
    isAbsolute: (p: string) => pathBrowserify.isAbsolute(p),
    normalize: (p: string) => pathBrowserify.normalize(p)
  }, */

  path: {
    // Existing functions remain standard
    join: (...args: string[]) => {
      console.log('writeFileSyncwriteFileSync path join', { args })

      return pathBrowserify.posix.join(...args.map((p) => String(p || '').replace(/\\/g, '/')))
    },
    basename: (p: string, ext?: string) => pathBrowserify.basename(p, ext),
    extname: (p: string) => pathBrowserify.extname(p),
    dirname: (p: string) => pathBrowserify.dirname(p),

    // REFINED RESOLVE: Ensures no leaking of system-style absolute roots
    resolve: (...args: string[]) => {
      const cleaned = args.map((p) => {
        let s = String(p || '').replace(/\\/g, '/')
        // Optional: Strip common system roots if they accidentally leak in
        return s.replace(/^([a-zA-Z]:\/|\/home\/|\/Users\/)/, '')
      })

      // Resolve against a virtual root '/' to prevent escaping the sandbox
      const resolved = pathBrowserify.posix.resolve('/', ...cleaned)

      // Return a clean relative path (e.g., "Users/assets/slide")
      return resolved.replace(/^\/+/, '')
    },

    relative: (from: string, to: string) => {
      const absFrom = pathBrowserify.posix.resolve('/', String(from || '').replace(/\\/g, '/'))
      const absTo = pathBrowserify.posix.resolve('/', String(to || '').replace(/\\/g, '/'))
      return pathBrowserify.posix.relative(absFrom, absTo)
    },

    sep: '/', // Force forward slash for Web/Browser consistency
    parse: (p: string) => pathBrowserify.parse(p),
    isAbsolute: (p: string) => pathBrowserify.posix.isAbsolute(p),
    normalize: (p: string) => pathBrowserify.posix.normalize(p)
  },
  os: {
    homedir: () => {
      const key = cacheKey('os:homedir', [])
      if (shouldFetch(key)) {
        void invoke<string>('os:homedir')
          .then((value) => noteFetchSucceeded(key, value))
          .catch(() => noteFetchFailed(key))
      }
      return cached<string>(key, '')
    },
    tmpdir: () => {
      const key = cacheKey('os:tmpdir', [])
      if (shouldFetch(key)) {
        void invoke<string>('os:tmpdir')
          .then((value) => noteFetchSucceeded(key, value))
          .catch(() => noteFetchFailed(key))
      }
      return cached<string>(key, '')
    }
  }
}
