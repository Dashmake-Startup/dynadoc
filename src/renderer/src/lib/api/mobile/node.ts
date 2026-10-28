import pathBrowserify from 'path-browserify'
import { invoke } from './bridge'

const syncCache = new Map<string, any>()

function normalizeRemotePath(input: string): string {
  if (!input) return input
  let value = String(input).replace(/\\/g, '/').replace(/^file:\/\//i, '')
  if (value === 'drive') return ''
  if (value.startsWith('drive/')) value = value.slice('drive/'.length)
  if (/^[A-Za-z]:/.test(value)) {
    value = value.replace(/^[A-Za-z]:/, '')
  }
  value = value.replace(/^\/+/, '')
  return value
}

function cacheKey(prefix: string, args: any[]) {
  return `${prefix}:${JSON.stringify(args || [])}`
}

function remember<T>(key: string, value: T) {
  syncCache.set(key, value)
  return value
}

function cached<T>(key: string, fallback: T): T {
  if (syncCache.has(key)) return syncCache.get(key) as T
  return fallback
}

export const mobileNode = {
  fs: {
    readFileSync: (filePath: string, encoding?: string) => {
      const normalized = normalizeRemotePath(filePath)
      const key = cacheKey('fs:readFile', [normalized, encoding])
      if (!syncCache.has(key)) {
        void invoke<string>('fs:readFile', normalized, encoding)
          .then((value) => remember(key, value))
          .catch(() => {})
      }
      return cached<string>(key, '')
    },
    readFile: async (filePath: string, encoding?: string) =>
      remember(
        cacheKey('fs:readFile', [normalizeRemotePath(filePath), encoding]),
        await invoke<string>('fs:readFile', normalizeRemotePath(filePath), encoding)
      ),
    existsSync: (filePath: string) => {
      const normalized = normalizeRemotePath(filePath)
      if (!normalized) return false
      const key = cacheKey('fs:existsSync', [normalized])
      if (!syncCache.has(key)) {
        void invoke<boolean>('fs:existsSync', normalized)
          .then((value) => remember(key, value))
          .catch(() => {})
      }
      return cached<boolean>(key, false)
    },
    writeFileSync: (filePath: string, data: any, encoding?: string) => {
      const normalized = normalizeRemotePath(filePath)
      if (!normalized) return false
      void invoke<boolean>('fs:writeFileSync', normalized, data, encoding)
      return true
    },
    writeFile: async (filePath: string, data: any, encoding?: string) =>
      normalizeRemotePath(filePath)
        ? invoke<boolean>('fs:writeFile', normalizeRemotePath(filePath), data, encoding)
        : false,
    mkdirSync: (dirPath: string, options?: any) => {
      const normalized = normalizeRemotePath(dirPath)
      if (!normalized || normalized === '.') return true
      void invoke<boolean>('fs:mkdirSync', normalized, options)
      return true
    },
    readdirSync: (dirPath: string) => {
      const normalized = normalizeRemotePath(dirPath)
      const key = cacheKey('fs:readdirSync', [normalized])
      if (!syncCache.has(key)) {
        void invoke<string[]>('fs:readdir', normalized)
          .then((value) => remember(key, value))
          .catch(() => {})
      }
      return cached<string[]>(key, [])
    },
    readdir: async (dirPath: string) =>
      remember(
        cacheKey('fs:readdirSync', [normalizeRemotePath(dirPath)]),
        await invoke<string[]>('fs:readdir', normalizeRemotePath(dirPath))
      ),
    lstatSync: (filePath: string) => {
      const normalized = normalizeRemotePath(filePath)
      const key = cacheKey('fs:lstatSync', [normalized])
      if (!syncCache.has(key)) {
        void invoke<any>('fs:lstatSync', normalized)
          .then((value) => remember(key, value))
          .catch(() => {})
      }
      return cached<any>(key, null)
    },
    statSync: (filePath: string) => {
      const normalized = normalizeRemotePath(filePath)
      const key = cacheKey('fs:statSync', [normalized])
      if (!syncCache.has(key)) {
        void invoke<any>('fs:statSync', normalized)
          .then((value) => remember(key, value))
          .catch(() => {})
      }
      return cached<any>(key, null)
    },
    unlinkSync: (filePath: string) => {
      void invoke<boolean>('fs:unlinkSync', normalizeRemotePath(filePath))
      return true
    }
  },
  fsPromises: {
    readFile: (filePath: string, encoding?: string) =>
      invoke<string>('fs:readFile', normalizeRemotePath(filePath), encoding),
    writeFile: (filePath: string, data: any, encoding?: string) =>
      invoke<boolean>('fs:writeFile', normalizeRemotePath(filePath), data, encoding),
    readdir: (dirPath: string) => invoke<string[]>('fs:readdir', normalizeRemotePath(dirPath)),
    mkdir: (dirPath: string, options?: any) =>
      invoke<boolean>('fs:mkdirSync', normalizeRemotePath(dirPath), options),
    exists: (filePath: string) => invoke<boolean>('fs:existsSync', normalizeRemotePath(filePath)),
    stat: (filePath: string) => invoke<any>('fs:statSync', normalizeRemotePath(filePath)),
    lstat: (filePath: string) => invoke<any>('fs:lstatSync', normalizeRemotePath(filePath)),
    copyFile: async (sourcePath: string, destinationPath: string) => {
      const data = await invoke<any>('fs:readFile', normalizeRemotePath(sourcePath))
      return invoke<boolean>('fs:writeFile', normalizeRemotePath(destinationPath), data)
    },
    rename: (oldPath: string, newPath: string) =>
      invoke<boolean>('fs:renameSync', normalizeRemotePath(oldPath), normalizeRemotePath(newPath)),
    open: (filePath: string, flags?: string) => invoke<any>('fs:open', normalizeRemotePath(filePath), flags),
    unlink: (filePath: string) => invoke<boolean>('fs:unlinkSync', normalizeRemotePath(filePath)),
    rm: (filePath: string, options?: any) =>
      invoke<boolean>('fs:rmSync', normalizeRemotePath(filePath), options)
  },
  path: {
    join: (...args: string[]) => pathBrowserify.join(...args),
    basename: (p: string, ext?: string) => pathBrowserify.basename(p, ext),
    extname: (p: string) => pathBrowserify.extname(p),
    dirname: (p: string) => pathBrowserify.dirname(p),
    resolve: (...args: string[]) => pathBrowserify.resolve(...args),
    relative: (from: string, to: string) => pathBrowserify.relative(from, to),
    sep: pathBrowserify.sep,
    parse: (p: string) => pathBrowserify.parse(p),
    isAbsolute: (p: string) => pathBrowserify.isAbsolute(p),
    normalize: (p: string) => pathBrowserify.normalize(p)
  },
  os: {
    homedir: () => {
      const key = cacheKey('os:homedir', [])
      if (!syncCache.has(key)) {
        void invoke<string>('os:homedir')
          .then((value) => remember(key, value))
          .catch(() => {})
      }
      return cached<string>(key, '')
    },
    tmpdir: () => {
      const key = cacheKey('os:tmpdir', [])
      if (!syncCache.has(key)) {
        void invoke<string>('os:tmpdir')
          .then((value) => remember(key, value))
          .catch(() => {})
      }
      return cached<string>(key, '')
    }
  }
}
