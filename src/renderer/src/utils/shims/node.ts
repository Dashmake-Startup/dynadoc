import Platform from '../../libs/platform';

/**
 * NODE.JS API SHIM - PERFORMANCE OPTIMIZED
 * 
 * This shim provides a compatibility layer for Node.js-style APIs (fs, path, os)
 * in browser environments. 
 * 
 * Root Cause of Slowness: Redundant dynamic imports during early boot.
 * 
 * Solution:
 * 1. Lightweight synchronous path/fs shims for early access.
 * 2. Proxy-based nodeApi that delegates to the lazy lib/api proxy.
 * 3. Zero eager imports of heavy driver modules.
 */

const isBrowser = typeof window !== 'undefined'

// Empty paths used to be guarded by writing over window.node.fs from
// lib/api/index.ts. Under contextIsolation that object arrives through
// contextBridge, frozen, so patching it throws and takes the API bootstrapper
// down with it. The guard belongs here: every filesystem call the renderer
// makes comes through this Proxy, and this Proxy is ours.
//
// Derived by prototype rather than copied or proxied. A spread would silently
// drop non-enumerable members, and a Proxy cannot do this job at all:
// contextBridge exposes its members as read-only, non-configurable data
// properties, and for those a `get` trap that returns anything but the real
// value violates a Proxy invariant and throws. That is what happened on the
// first file write, once the renderer got far enough under contextIsolation to
// attempt one. Own properties defined on a derived object carry no such
// restriction. Memoised per underlying object, because `nodeApi.fs` is read on
// every call site.
//
// `fs` only, and never `fsPromises`: these guards answer with the booleans the
// synchronous API returns, which are not a promise. On `fsPromises.writeFile`
// an empty path would hand back `false` where every caller expects a thenable,
// and Utils.saveToFile chains `.catch` straight onto it.
/**
 * Routes the filesystem calls the renderer makes at the validated IPC surface
 * the preload exposes as `window.api.fs`.
 *
 * WHY THE RESULT IS A MIXED OBJECT, because the next reader will think it is a
 * mistake otherwise:
 *
 *   Only the members the validated surface can serve are routed. The eight
 *   synchronous calls it deliberately does not offer -- readFileSync,
 *   writeFileSync, mkdirSync, readdirSync, unlinkSync, rmdirSync, copyFileSync,
 *   lstatSync -- keep going straight to the underlying object, because routing
 *   them would mean converting their call sites to async, and that is a
 *   separate change with a separate risk. Streams stay for good: they cannot
 *   cross contextBridge. So the object handed back is part IPC, part direct,
 *   on purpose, until those call sites move.
 *
 *   Nothing is ever added that the underlying object does not already have.
 *   Inventing a method defeats the `fs?.writeFile` style checks the renderer
 *   makes before choosing a write path, turning a graceful "no filesystem
 *   here" into a TypeError on something that was never there. That is the trap
 *   that bit twice already.
 *
 * WHY SHAPES ARE TRANSLATED RATHER THAN FORWARDED:
 *
 *   The IPC surface answers in plain data, because that is all that survives
 *   structured cloning. Node's answers are objects with behaviour. Forwarding
 *   them unchanged would be the quiet kind of wrong:
 *
 *     stat/lstat   callers invoke stats.isDirectory() -- 30 call sites do, and
 *                  5 call isFile(). The surface sends booleans, so they are
 *                  wrapped back into methods. A boolean is truthy, so a
 *                  forwarded `isDirectory` would have been *called* and thrown,
 *                  or worse, tested without calling and always been true.
 *     readdir      Node returns names by default and Dirent objects under
 *                  withFileTypes, which 8 call sites use. The surface always
 *                  sends { name, isFile, isDirectory }, so both shapes are
 *                  rebuilt from it.
 *     rm / unlink  one channel, with recursive opt-in: rm passes it through,
 *                  unlink never sets it.
 *     exists       not a real fs/promises method at all, but 128 call sites use
 *                  it, so it answers from the synchronous existence channel.
 */
const routedFsCache = new WeakMap<object, any>()

type ValidatedFs = {
  existsSync: (p: string) => boolean
  statSync: (p: string) => { size: number; modifiedMs: number; isFile: boolean; isDirectory: boolean }
  readFile: (p: string, encoding?: 'utf-8') => Promise<string | Uint8Array>
  writeFile: (p: string, data: string | Uint8Array, encoding?: 'utf-8') => Promise<void>
  readDir: (p: string) => Promise<{ name: string; isFile: boolean; isDirectory: boolean }[]>
  mkdir: (p: string, options?: { recursive?: boolean }) => Promise<void>
  remove: (p: string, options?: { recursive?: boolean }) => Promise<void>
  rename: (from: string, to: string) => Promise<void>
  copyFile: (from: string, to: string) => Promise<void>
}

/** The validated surface, or null when it is not there (web, mobile, pre-boot). */
const validatedFs = (): ValidatedFs | null => {
  if (!isBrowser) return null
  const candidate = (window as any).api?.fs
  return candidate && typeof candidate.readFile === 'function' ? candidate : null
}

const asStats = (flat: { size: number; modifiedMs: number; isFile: boolean; isDirectory: boolean }): any => ({
  size: flat.size,
  mtimeMs: flat.modifiedMs,
  mtime: new Date(flat.modifiedMs),
  isFile: () => flat.isFile,
  isDirectory: () => flat.isDirectory,
  isSymbolicLink: () => false
})

const routeFs = (underlying: any, validated: ValidatedFs): any => {
  const cached = routedFsCache.get(underlying)
  if (cached) return cached

  const routed = Object.create(underlying)
  const define = (name: string, value: unknown): void => {
    // Never add what the underlying object does not have.
    if (typeof underlying[name] !== 'function') return
    Object.defineProperty(routed, name, {
      value,
      writable: true,
      configurable: true,
      enumerable: true
    })
  }

  // Synchronous metadata keeps its signature, so its callers do not change.
  define('existsSync', (p: string) => validated.existsSync(p))
  define('statSync', (p: string) => asStats(validated.statSync(p)))

  // Asynchronous, already awaited by their callers.
  define('exists', async (p: string) => validated.existsSync(p))
  define('readFile', (p: string, encoding?: any) =>
    validated.readFile(p, typeof encoding === 'string' ? encoding : encoding?.encoding)
  )
  define('writeFile', (p: string, data: any, encoding?: any) =>
    validated.writeFile(p, data, typeof encoding === 'string' ? encoding : encoding?.encoding)
  )
  define('mkdir', (p: string, options?: any) => validated.mkdir(p, options))
  define('readdir', async (p: string, options?: any) => {
    const entries = await validated.readDir(p)
    if (options?.withFileTypes !== true) return entries.map((entry) => entry.name)
    return entries.map((entry) => ({
      name: entry.name,
      isFile: () => entry.isFile,
      isDirectory: () => entry.isDirectory,
      isSymbolicLink: () => false
    }))
  })
  define('stat', async (p: string) => asStats(await Promise.resolve(validated.statSync(p))))
  define('lstat', async (p: string) => asStats(await Promise.resolve(validated.statSync(p))))
  define('rm', (p: string, options?: any) => validated.remove(p, { recursive: options?.recursive === true }))
  define('unlink', (p: string) => validated.remove(p))
  define('rename', (from: string, to: string) => validated.rename(from, to))
  define('copyFile', (from: string, to: string) => validated.copyFile(from, to))

  routedFsCache.set(underlying, routed)
  return routed
}

const guardedFsCache = new WeakMap<object, any>()

const guardFs = (fs: any): any => {
  if (!fs || typeof fs !== 'object') return fs
  const cached = guardedFsCache.get(fs)
  if (cached) return cached

  const guarded = Object.create(fs)
  const override = (name: string, value: unknown): void => {
    if (typeof fs[name] !== 'function') return
    Object.defineProperty(guarded, name, {
      value,
      writable: true,
      configurable: true,
      enumerable: true
    })
  }

  override('writeFileSync', (filePath: string, data: any, encoding?: string) =>
    filePath ? fs.writeFileSync(filePath, data, encoding) : false
  )
  override('writeFile', (filePath: string, data: any, encoding?: string, cb?: any) =>
    filePath ? fs.writeFile(filePath, data, encoding, cb) : false
  )
  override('mkdirSync', (dirPath: string, options?: any) =>
    !dirPath || dirPath === '.' ? true : fs.mkdirSync(dirPath, options)
  )

  guardedFsCache.set(fs, guarded)
  return guarded
}

export const nodeApi = new Proxy({} as any, {
  get(_, prop) {
    if (!isBrowser) return undefined
    const anyWindow = window as any
    
    // Resolution logic: Prefer REAL lib/api 'node' if available (it has invoke calls),
    // otherwise fallback to Electron native 'node'.
    // The shimmed anyWindow.node should ONLY be used if no real API is available yet.
    
    // Same helper as everywhere else. This used to read
    // `window.process.versions.electron`, which the preload does not expose:
    // under contextIsolation it said "not Electron" on the desktop and this
    // shim then preferred `window.api.node` over the real `window.node`.
    // `Platform` was already imported here and unused.
    const isElectron = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop;
    const apiNode = anyWindow.api?.node;
    const nativeNode = anyWindow.node;
    
    // If we have apiNode and it's not a shim, prefer it for web/mobile
    // If we are in Electron, prefer nativeNode if it exists.
    let actualApi = isElectron ? (nativeNode || apiNode) : (apiNode || nativeNode);
    
    // Double check that we don't accidentally return a shim if a real API exists
    if (!isElectron && actualApi && (actualApi as any).__isShim && apiNode && !(apiNode as any).__isShim) {
      actualApi = apiNode;
    }

    if (!actualApi || (!actualApi.fs && !actualApi.fsPromises)) {
      // Background trigger to start loading lib/api if not already doing so
      if (anyWindow.api) { /* Accessing triggers Proxy load */ }
      return undefined
    }

    // Route through the validated surface when the preload offers it, then
    // keep the empty-path guards on top. Both layers derive from the object
    // below rather than replacing it, so anything neither layer knows about
    // still reaches the real implementation.
    const validated = validatedFs()
    if (prop === 'fs') {
      const base = actualApi.fs
      return guardFs(validated && base ? routeFs(base, validated) : base)
    }
    if (prop === 'fsPromises') {
      const base = actualApi.fsPromises
      return validated && base ? routeFs(base, validated) : base
    }

    return actualApi[prop]
  }
})

if (isBrowser) {
  const anyWindow = window as any
  
  // Only establish shims if native Node.js isn't already present (Electron)
  if (!anyWindow.node) {
    const normalize = (input: string) => {
      const parts = String(input || '')
        .replace(/\\/g, '/')
        .split('/')
        .filter((part) => part.length > 0 && part !== '.')
      const stack: string[] = []
      for (const part of parts) {
        if (part === '..') {
          stack.pop()
          continue
        }
        stack.push(part)
      }
      return '/' + stack.join('/')
    }

    const dirname = (input: string) => {
      const normalized = normalize(input)
      const idx = normalized.lastIndexOf('/')
      if (idx <= 0) return '/'
      return normalized.slice(0, idx)
    }

    const basename = (input: string, ext = '') => {
      const normalized = normalize(input)
      const idx = normalized.lastIndexOf('/')
      let base = idx >= 0 ? normalized.slice(idx + 1) : normalized
      if (ext && base.endsWith(ext)) base = base.slice(0, -ext.length)
      return base
    }

    const pathShim = {
      sep: '/',
      join: (...parts: string[]) => normalize(parts.filter(Boolean).join('/')),
      dirname,
      basename,
      extname: (input: string) => {
        const base = basename(input)
        const dot = base.lastIndexOf('.')
        return dot > 0 ? base.slice(dot) : ''
      },
      normalize,
      parse: (input: string) => {
        const dir = dirname(input)
        const base = basename(input)
        return { root: '/', dir, base, ext: '', name: base }
      },
      resolve: (...parts: string[]) => normalize(parts.filter(Boolean).join('/')),
      isAbsolute: (input: string) => String(input || '').startsWith('/'),
      relative: () => '.'
    }

    // This stand-in covers the window between the page loading and the platform
    // driver resolving, when window.api.node is not there yet. Every method
    // used to answer with a plausible value -- existsSync false, readFileSync
    // '', writeFileSync nothing at all -- so a call landing in that window read
    // an empty file or wrote to nowhere, and nothing said so. A document could
    // look saved and not be.
    //
    // It refuses now. A filesystem call this early is a bug in the caller: it
    // should await window.__ddocDriverReady, or run after mount. A thrown error
    // with the method name is the only thing that finds these.
    //
    // Two exceptions, named because the rule is to name them: existsSync and
    // fsPromises.exists still answer false. They ask whether anything is there,
    // so a negative answer is meaningful rather than fabricated, and several
    // places on the boot path ask before the driver is up.
    const tooEarly = (method: string): never => {
      throw new Error(
        `nodeApi.fs.${method} was called before the platform driver was ready. ` +
          'There is no filesystem yet, and answering with an empty value would ' +
          'silently lose data. Await window.__ddocDriverReady first.'
      )
    }

    const fsShim = {
      existsSync: () => false,
      statSync: () => tooEarly('statSync'),
      lstatSync: () => tooEarly('lstatSync'),
      readdirSync: () => tooEarly('readdirSync'),
      readFileSync: () => tooEarly('readFileSync'),
      writeFileSync: () => tooEarly('writeFileSync'),
      mkdirSync: () => tooEarly('mkdirSync'),
      unlinkSync: () => tooEarly('unlinkSync'),
      rmSync: () => tooEarly('rmSync')
    }

    anyWindow.node = {
      __isShim: true,
      fs: fsShim,
      fsPromises: {
        readFile: async () => tooEarly('fsPromises.readFile'),
        writeFile: async () => tooEarly('fsPromises.writeFile'),
        exists: async () => false,
        stat: async () => tooEarly('fsPromises.stat')
      },
      path: pathShim,
      os: {
        tmpdir: () => '/tmp',
        homedir: () => '/'
      }
    }
  }
}
