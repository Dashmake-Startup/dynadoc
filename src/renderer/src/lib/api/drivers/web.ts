import type { AppPlatformAPI } from '../../types/api'
import {
  convertDocumentMultipart,
  invoke,
  send,
  on,
  emit,
  invokeWatcher,
  notifyFsMutated
} from '../web/rpc'
import { resolveApiBaseUrl } from '../shared/baseUrl'
import { CALLBACK_NONCE_PARAM, issueCallbackNonce } from '../web/authCallbackNonce'
import { webNode } from '../web/node'
import EditorCommonUtils, { cryptoRandomUUID } from '../../../utils/common.utils'
import { storeUploadedFile } from '../../../utils/uploadCache'
import Utils from '../../../utils/Utils'

const apiBaseUrl = () => resolveApiBaseUrl().replace(/\/$/, '')
const ACCESS_TOKEN_KEY = 'ddoc.access_token'
const DEVICE_ID_KEY = 'ddoc.device_id'
const AUTH_DEBUG_KEY = 'ddoc.auth.debug'

// Track active SSE watcher cleanup functions (Push-Pull Architecture)
const activeSSE = new Map<string, () => void>()

// get-fonts / get-storage-dir / get-cache-dir answer with a fixed value for
// the whole session (the bridge returns a literal, not anything per-document),
// yet loadFrom asks again for every document it opens. Memoize each call once
// per page load instead of once per open.
let cachedFonts: Promise<any> | null = null
let cachedStorageDir: Promise<string> | null = null
let cachedCacheDir: Promise<string> | null = null

const shouldAuthDebug = () => {
  try {
    if (typeof window !== 'undefined' && (window as any).__DDOC_AUTH_DEBUG__ === true) return true
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(AUTH_DEBUG_KEY) === 'true'
    }
  } catch {
    // ignore
  }
  return false
}

const withAuthDebug = (payload?: any) => {
  if (!shouldAuthDebug()) return payload
  return { ...(payload || {}), debug: true }
}

function getAccessToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

async function resolveAccessToken(): Promise<string | null> {
  const token = getAccessToken()
  if (token) return token
  try {
    const session = await (window as any)?.server?.auth?.getSession?.()
    return session?.accessToken || session?.session?.accessToken || null
  } catch {
    // ignore
  }
  return getAccessToken()
}

const buildTempUploadPath = (fileName: string, authenticated: boolean) => {
  const safeName = (fileName || 'upload').replace(/\\/g, '/').split('/').pop() || 'upload'
  const stamp = new Date().toISOString().slice(0, 10)
  if (authenticated) {
    return `home/.tmp/uploads/${stamp}/${safeName}`
  }
  return `public-temp/${stamp}/${safeName}`
}

function downloadBase64File(payload: { base64: string; fileName?: string; mime?: string }) {
  const base64 = payload?.base64 || ''
  const mime = payload?.mime || 'application/pdf'
  const fileName = payload?.fileName || 'export.pdf'
  if (!base64) throw new Error('Empty download payload')

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)

  const blob = new Blob([bytes], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/**
 * Executes a zero-copy client-side download anchor dispatch.
 * Bypasses string decryption loops, saving significant memory heap overhead.
 */
/**
 * Triggers a memory-efficient zero-copy file download directly through the browser.
 * This completely avoids string decryption parsing loops, preventing tab stuttering.
 */
function triggerBlobDownload(blob: Blob, fileName: string) {
  // Use a secure internal pointer addressing reference context map
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'

  // Dispatch click to browser system thread
  anchor.click()

  // Immediately schedule memory garbage collection release cleanup
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1500)
}

const splitDirAndBase = (inputPath: string) => {
  const normalized = String(inputPath || '').replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  const base = parts.pop() || ''
  const dir = parts.join('/')
  return { dir, base }
}

async function blobFromVirtualPath(
  inputPath: string,
  fallbackMime = 'application/octet-stream'
): Promise<{ blob: Blob; fileName: string }> {
  const fileName =
    String(inputPath || '')
      .replace(/\\/g, '/')
      .split('/')
      .pop() || 'document'
  const assetReader = (webNode as any)?.fsPromises?.readAssetBlob
  if (typeof assetReader === 'function') {
    try {
      const result = await assetReader(inputPath)
      if (result?.blob) {
        if (result.url) setTimeout(() => URL.revokeObjectURL(result.url), 1500)
        return { blob: result.blob, fileName }
      }
    } catch {
      // fall back to text read below
    }
  }

  const content = await (webNode as any).fsPromises.readFile(inputPath, 'utf-8')
  return {
    blob: new Blob([content || ''], { type: fallbackMime }),
    fileName
  }
}

const normalizeStorageDir = (dir: string): string => {
  const raw = (dir || '').replace(/\\/g, '/')
  if (!raw) return 'drive/home'
  const trimmed = raw.replace(/^\/+/, '')
  if (trimmed === 'drive') return 'drive/home'
  if (trimmed.startsWith('drive/')) return trimmed
  if (trimmed === 'home' || trimmed.startsWith('home/')) return `drive/${trimmed}`
  if (trimmed.endsWith('/home') || trimmed.includes('/home/')) return `drive/${trimmed}`
  return trimmed
}

const fetchJson = async (path: string, options: RequestInit = {}) => {
  const token = getAccessToken()
  const url = `${apiBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  }
  const res = await fetch(url, { ...options, headers })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, ...(payload || {}), status: res.status }
  }
  return payload
}

const downloadUrlWithAuth = async (
  url: string,
  filename?: string,
  options?: { onProgress?: (info: { received: number; total?: number }) => void }
) => {
  if (typeof window === 'undefined' || !url) return false
  const safeUrl = url.includes(' ') ? encodeURI(url) : url
  const token = await resolveAccessToken()
  if (!token) {
    throw new Error('missing token')
  }

  try {
    const res = await fetch(safeUrl, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
    if (!res.ok) throw new Error(String(res.status))
    const total = Number(res.headers.get('content-length') || 0) || undefined
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader()
      const chunks: Uint8Array[] = []
      let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          received += value.length
          options?.onProgress?.({ received, total })
        }
      }
      const blob = new Blob(chunks as BlobPart[])
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename || ''
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
      return true
    }
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename || ''
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)

    return true
  } catch (e) {
    throw e
  }
}

const api: AppPlatformAPI & Record<string, any> = {
  readFile: (path: string, encoding?: string) =>
    invoke('read-file', { asResponse: false }, path, encoding),
  readDir: (path: string) => invoke('read-dir', { asResponse: false }, path),
  syncAssets: (
    payload: { paths: string[]; cachePath?: string; includeUnused?: boolean } | string[]
  ) => invoke('sync-assets', { asResponse: false }, payload),
  node: webNode,
  /*  fsPromises: {
     writeFile: async (filePath: string, data: any, encoding?: string) => {
       const normalized = (filePath)
       console.log('createNewDocument [webNode.fsPromises.writeFile] invoke', {
         path: normalized,
         encoding
       })
       if (!normalized) return false
       return await invoke<boolean>('fs:writeFile', normalized, data, (encoding))
     },
   }, */
  getFonts: () => {
    if (!cachedFonts) {
      cachedFonts = invoke('get-fonts').catch((err) => {
        cachedFonts = null
        throw err
      })
    }
    return cachedFonts
  },
  getStorageDir: async () => {
    if (!cachedStorageDir) {
      cachedStorageDir = invoke('get-storage-dir')
        .then((resolved) => normalizeStorageDir(resolved || ''))
        .catch(() => {
          cachedStorageDir = null
          return 'drive/home'
        })
    }
    return cachedStorageDir
  },
  openExternal: async (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener')
    }
  },
  showContextMenu: (template: any[]) => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('show-web-menu', { detail: template }))
  },
  showNotification: (title: string, body: string) => {
    if (typeof window === 'undefined') return
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body })
        return
      }
      if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification(title, { body })
          }
        })
      }
      return
    }
    console.log(`[Notification] ${title}: ${body}`)
  },

  readFileContent: (filePath: string, encoding: string) =>
    invoke('read-file-content', { asResponse: false }, filePath, encoding),
  getCacheDir: async () => {
    if (!cachedCacheDir) {
      cachedCacheDir = invoke('get-cache-dir').catch((e) => {
        console.log('getCacheDir web eerroor', { e })
        cachedCacheDir = null
        return 'cache'
      })
    }
    return cachedCacheDir
  },
  getTempDir: async () => {
    try {
      return await invoke('get-temp-dir')
    } catch {
      return 'tmp'
    }
  },
  getPreloadPath: (_name: string) => Promise.resolve(null),
  ddocify: (
    folderPath: string,
    outputFile: string,
    shouldSecured?: boolean,
    require2fa?: boolean
  ) => invoke('ddocify', { asResponse: false }, folderPath, outputFile, shouldSecured, require2fa),
  unddocify: (zipFilePath: string, outputDir: string, isSecured?: boolean, stepupToken?: string) =>
    invoke('unddocify', { asResponse: false }, zipFilePath, outputDir, isSecured, stepupToken),
  decryptFileToMemory: async (encPath: string, password: string | ArrayBuffer) => {
    const base64 = await invoke<string>(
      'decrypt-file-to-memory',
      { asResponse: false },
      encPath,
      password
    )
    const binary = atob(base64 || '')
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  },
  rollupBundle: (sourceCode: string) => invoke('rollup-bundle', { asResponse: false }, sourceCode),

  watchFile: (filePath: string, callerId: string): (() => void) => {
    // Use invokeWatcher which handles SSE connection, pulls content on push notification,
    // and dispatches custom events. Returns cleanup function for onDestroy.
    activeSSE.get(callerId)?.()
    const stop = invokeWatcher('watch-file', filePath, callerId, (content) => {
      // Dispatch custom event to notify FileInclude component
      if (typeof content === 'string') {
        window.dispatchEvent(
          new CustomEvent(`file-update:${callerId}`, {
            detail: content
          })
        )
      }
    })
    activeSSE.set(callerId, stop)
    return () => {
      activeSSE.get(callerId)?.()
      activeSSE.delete(callerId)
    }
  },

  unwatchFile: (filePath: string, callerId: string) => {
    activeSSE.get(callerId)?.()
    activeSSE.delete(callerId)
  },

  onFileChange: (callback: (content: string, callerId: string) => void) =>
    on('file-changed', ({ content, callerId }) => callback(content, callerId)),

  openFile: (filePath: string) => invoke('open-file', { asResponse: false }, filePath),
  renameFile: (oldPath: string, newName: string) =>
    invoke('rename-file', { asResponse: false }, oldPath, newName),
  moveFile: (srcPath: string, destPath: string) =>
    invoke('move-file', { asResponse: false }, srcPath, destPath),
  deleteFile: (filePath: string) => invoke('delete-file', { asResponse: false }, filePath),

  searchFiles: (payload: any) => invoke('search:files', { asResponse: false }, payload),
  replaceInFiles: (payload: any) =>
    invoke('search:replace-in-files', { asResponse: false }, payload),
  searchFileNames: (payload: any) => invoke('search:file-names', { asResponse: false }, payload),
  translateText: (payload: any) => invoke('translate:text', { asResponse: false }, payload),

  showContextMenuLegacy: (template: any[]) =>
    invoke('show-context-menu', { asResponse: false }, template),
  registerMenuAction: (id: string) => invoke('register-menu-action', { asResponse: false }, id),
  onInvokeMenuAction: (callback: (event: any, id: string) => void) =>
    on('invoke-menu-action', (payload) => callback(payload?.event, payload?.id)),

  getFilePath: (file: File) => (file as any).path || null,

  convertHtmlToDocx: async (inputPath: string, outputPath: string) => {
    const { blob, fileName } = await blobFromVirtualPath(inputPath, 'text/html')
    return convertDocumentMultipart<string>({ file: blob, fileName, kind: 'html', outputPath })
  },
  convertDocxToHtml: async (inputPath: string, outputPath: string) => {
    const { blob, fileName } = await blobFromVirtualPath(
      inputPath,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    return convertDocumentMultipart<string>({
      file: blob,
      fileName,
      kind: Utils.OFFICE_EXTENSIONS_FORMAT.word,
      outputPath
    })
  },
  convertHtmlToOdt: async (inputPath: string, outputPath: string) => {
    const { blob, fileName } = await blobFromVirtualPath(inputPath, 'text/html')
    return convertDocumentMultipart<string>({
      file: blob,
      fileName,
      kind: 'html-to-odt',
      outputPath
    })
  },
  convertOdtToHtml: async (inputPath: string, outputPath: string) => {
    const { blob, fileName } = await blobFromVirtualPath(
      inputPath,
      'application/vnd.oasis.opendocument.text'
    )
    return convertDocumentMultipart<string>({ file: blob, fileName, kind: 'odt', outputPath })
  },
  convertHtmlToOdp: async (inputPath: string, outputPath: string) => {
    const { blob, fileName } = await blobFromVirtualPath(inputPath, 'text/html')
    return convertDocumentMultipart<string>({
      file: blob,
      fileName,
      kind: 'html-to-odp',
      outputPath
    })
  },
  convertOdpToHtml: async (inputPath: string, outputPath: string) => {
    const { blob, fileName } = await blobFromVirtualPath(
      inputPath,
      'application/vnd.oasis.opendocument.presentation'
    )
    return convertDocumentMultipart<string>({ file: blob, fileName, kind: 'odp', outputPath })
  },
  // exportDdocToHtml: (cacheDir: string, outputPath: string) =>
  //   invoke('export-ddoc-to-html', cacheDir, outputPath),
  convertPptxToPresentation: async (inputPath: string, outputPath: string) => {
    const { blob, fileName } = await blobFromVirtualPath(
      inputPath,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    )
    return convertDocumentMultipart<string>({
      file: blob,
      fileName,
      kind: Utils.OFFICE_EXTENSIONS_FORMAT.powerpoint,
      outputPath
    })
  },
  latexCompile: (inputPath: string) => invoke('latex:compile', { asResponse: false }, inputPath),
  latexSaveTempTex: (content: string) =>
    invoke('latex:save-temp-tex', { asResponse: false }, content),
  latexProjectInit: (payload: { projectDir: string; title?: string }) =>
    invoke('latex:project:init', { asResponse: false }, payload),
  latexProjectList: (projectDir: string) =>
    invoke('latex:project:list', { asResponse: false }, projectDir),
  latexProjectRead: (filePath: string) =>
    invoke('latex:project:read', { asResponse: false }, filePath),
  latexProjectWrite: (filePath: string, content: string) =>
    invoke('latex:project:write', { asResponse: false }, filePath, content),
  latexProjectWatch: (payload: { projectId: string; projectDir: string }) =>
    invoke('latex:project:watch', { asResponse: false }, payload),
  latexProjectUnwatch: (projectId: string) =>
    invoke('latex:project:unwatch', { asResponse: false }, projectId),
  latexProjectCompile: (payload: { projectId: string; texFilePath: string }) =>
    invoke('latex:project:compile', { asResponse: false }, payload),
  onLatexProjectChanged: (callback: (payload: any) => void) =>
    on('latex:project:changed', callback),
  onLatexCompileLog: (callback: (payload: any) => void) => on('latex:compile:log', callback),
  onLatexCompileDone: (callback: (payload: any) => void) => on('latex:compile:done', callback),
  onLatexCompileError: (callback: (payload: any) => void) => on('latex:compile:error', callback),

  /* exportToPDF: async (content: any, outputPath?: string) => {
    if (outputPath) {
      return invoke('export-to-pdf', { asResponse: false }, content, outputPath)
    }
    const result: any = await invoke('export-to-pdf', { asResponse: false }, content, null)
    if (result?.base64) {
      downloadBase64File({
        base64: result.base64,
        fileName: result.fileName || content?.fileName || 'export.pdf'
      })
      return true
    }
    return result
  }, */

  exportToPDF: async (content: any, outputPath?: string) => {
    // 1. Maintain desktop/local disk write operations intact
    if (outputPath) {
      return invoke('export-to-pdf', { asResponse: false }, content, outputPath)
    }

    try {
      // 2. Leverage your underlying custom RPC passthrough engine natively
      // We send content as the spreading argument payload array match pattern
      const response = await invoke<Response>('export-to-pdf', { asResponse: true }, content)

      // Ensure we are working with a real web Response instance
      if (!(response instanceof Response)) {
        throw new Error('RPC did not return an evaluatable streaming Response context')
      }

      // 3. Directly stream the socket buffer into a zero-copy client-side Blob
      const blob = await response.blob()

      // 4. Safely inspect server attachment headers to resolve the dynamic file name
      const contentDisposition = response.headers.get('Content-Disposition')
      let fileName = content?.fileName || 'export.pdf'

      if (contentDisposition && contentDisposition.includes('filename=')) {
        // Clean quotes and parameters returned from your Echo framework
        fileName = contentDisposition.split('filename=')[1].trim().replace(/["']/g, '')
      }

      // Ensure file formatting extension is correct
      if (!fileName.toLowerCase().endsWith(Utils.PDF_EXTENSION)) {
        fileName += Utils.PDF_EXTENSION
      }

      // 5. Fire off local anchoring block dispatch
      triggerBlobDownload(blob, fileName)
      return true
    } catch (error) {
      console.error('Failed processing binary layout compilation down to PDF:', error)
      return false
    }
  },

  clipboard: {
    readText: () => '',
    readHTML: () => '',
    readImageDataUrl: () => null,
    write: (payload: { text?: string; html?: string; imageDataUrl?: string }) => {
      if (payload.text && navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(payload.text).catch(() => {})
      }
      return true
    }
  },

  browser: createWebBrowserApi(),
  embedded: createWebEmbeddedApi(),
  overlay: {
    setVisible: (_payload: { visible: boolean }) => {}
  },

  openDialogFile: async (filters?: Array<{ name: string; extensions: string[] }>) =>
    uploadViaPicker(false, filters),
  openDialogFiles: async (filters?: Array<{ name: string; extensions: string[] }>) =>
    uploadViaPicker(true, filters),
  saveDialogFile: async (options?: { title?: string; defaultPath?: string }) =>
    invoke('dialog:saveFile', { asResponse: false }, options),
  openDialogDirectory: async () => invoke('dialog:openDirectory'),
  printFile: async (_filePath: string, _options?: any) => {
    if (typeof window !== 'undefined') {
      window.print()
      return true
    }
    return false
  },
  loadSystemFont: () => invoke('load-system-font')
}

function createWebBrowserApi() {
  const tabs: any[] = []
  let activeId: string | null = null
  const listeners = {
    tabsChanged: new Set<(tabs: any[]) => void>(),
    tabUpdated: new Set<(tab: any) => void>(),
    tabRemoved: new Set<(id: string) => void>(),
    downloadUpdated: new Set<(payload: any) => void>(),
    permissionRequest: new Set<(payload: any) => void>(),
    insertText: new Set<(payload: { text: string }) => void>(),
    varInput: new Set<(payload: any) => void>(),
    varInputKey: new Set<(payload: any) => void>()
  }

  const emitTabs = () => listeners.tabsChanged.forEach((cb) => cb([...tabs]))
  const emitUpdate = (tab: any) => listeners.tabUpdated.forEach((cb) => cb({ ...tab }))

  const createTab = (url?: string) => {
    const id = `web-tab-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const tab = {
      id,
      url: url || 'about:blank',
      title: url || 'New Tab',
      isLoading: false,
      isActive: true,
      lastActiveAt: Date.now(),
      hibernated: false
    }
    tabs.forEach((t) => (t.isActive = false))
    tabs.push(tab)
    activeId = id
    emitTabs()
    emitUpdate(tab)
    return tab
  }

  const findTab = (id: string) => tabs.find((t) => t.id === id)

  return {
    createTab: async (url?: string) => createTab(url),
    closeTab: async (id: string) => {
      const index = tabs.findIndex((t) => t.id === id)
      if (index >= 0) {
        tabs.splice(index, 1)
        listeners.tabRemoved.forEach((cb) => cb(id))
        if (activeId === id) {
          activeId = tabs[0]?.id || null
          if (activeId) findTab(activeId)!.isActive = true
        }
        emitTabs()
      }
    },
    activateTab: async (id: string) => {
      tabs.forEach((t) => (t.isActive = t.id === id))
      const tab = findTab(id)
      if (tab) {
        tab.lastActiveAt = Date.now()
        activeId = id
        emitUpdate(tab)
        emitTabs()
      }
    },
    navigate: async (id: string, url: string) => {
      const tab = findTab(id)
      if (tab) {
        tab.url = url
        tab.title = url
        emitUpdate(tab)
        emitTabs()
      }
    },
    reload: async (_id: string) => {},
    goBack: async (_id: string) => {},
    goForward: async (_id: string) => {},
    setBounds: async (_bounds: any) => {},
    setVisible: async (_visible: boolean) => {},
    listTabs: async () => [...tabs],
    queryHistory: async (query: string) =>
      invoke('browser:history-query', { asResponse: false }, query),
    respondPermission: async (_requestId: string, _allow: boolean) => {},
    onTabsChanged: (callback: (tabs: any[]) => void) => listeners.tabsChanged.add(callback),
    onTabUpdated: (callback: (tab: any) => void) => listeners.tabUpdated.add(callback),
    onTabRemoved: (callback: (tabId: string) => void) => listeners.tabRemoved.add(callback),
    onDownloadUpdate: (callback: (payload: any) => void) => listeners.downloadUpdated.add(callback),
    onPermissionRequest: (callback: (payload: any) => void) =>
      listeners.permissionRequest.add(callback),
    onInsertText: (callback: (payload: { text: string }) => void) =>
      listeners.insertText.add(callback),
    onVarInput: (callback: (payload: any) => void) => listeners.varInput.add(callback),
    onVarInputKey: (callback: (payload: any) => void) => listeners.varInputKey.add(callback),
    insertVarText: (_payload: { tabId: string; text: string }) => {}
  }
}

function createWebEmbeddedApi() {
  const listeners = new Set<(payload: any) => void>()
  return {
    create: async (payload: any) => payload,
    setBounds: async (_payload: any) => {},
    setVisible: async (_payload: any) => {},
    destroy: async (_id: string) => {},
    navigate: async (_payload: any) => {},
    executeJavaScript: async (_payload: any) => {},
    insertCSS: async (_payload: any) => {},
    openDevTools: async (_id: string) => {},
    focus: async (_id: string) => {},
    setZ: async (_payload: any) => {},
    onEvent: (callback: (payload: any) => void) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    onVarInput: (_callback: any) => {},
    onVarInputKey: (_callback: any) => {},
    insertVarText: (_payload: any) => {}
  }
}

async function uploadViaPicker(
  allowMultiple: boolean,
  filters?: Array<{ name: string; extensions: string[] }>
): Promise<string[] | string | null> {
  if (typeof window === 'undefined') return allowMultiple ? [] : null
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = allowMultiple
  input.style.display = 'none'
  try {
    const extensions = Array.isArray(filters)
      ? filters.flatMap((filter) => filter.extensions || [])
      : []
    const accept = extensions
      .map((ext) => ext.replace(/^\./, '').trim())
      .filter(Boolean)
      .map((ext) => `.${ext}`)
      .join(',')
    if (accept) input.accept = accept
  } catch {
    // ignore
  }

  const packedExtensions = new Set([
    Utils.DYNADOC_EXTENSIONS.default,
    Utils.DYNADOC_EXTENSIONS.secured
  ])
  const isPackedDoc = (name: string) => {
    const ext = name ? `.${name.split('.').pop() || ''}`.toLowerCase() : ''
    return packedExtensions.has(ext)
  }

  const promise = new Promise<string[] | string | null>((resolve) => {
    input.onchange = async () => {
      const files = Array.from(input.files || [])
      if (!files.length) {
        resolve(allowMultiple ? [] : null)
        return
      }
      const uploaded: string[] = []
      for (const file of files) {
        const token = getAccessToken()
        const authenticated = Boolean(token)
        if (isPackedDoc(file.name)) {
          if (authenticated) {
            const form = new FormData()
            form.append('file', file, file.name)
            form.append('unpack', '1')
            const res = await fetch(`${apiBaseUrl()}/drive/upload`, {
              method: 'POST',
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              },
              body: form
            })
            if (!res.ok) continue
            const payload = await res.json().catch(() => ({}))
            const remotePath =
              payload?.path || payload?.data?.path || payload?.data?.remotePath || file.name
            uploaded.push(remotePath)
            storeUploadedFile(remotePath, file)
            continue
          }
        }

        const uploadPath = buildTempUploadPath(file.name, authenticated)
        const { dir, base } = splitDirAndBase(uploadPath)
        let remotePath = ''

        // Prefer Drive multipart uploads for large files.
        try {
          const fileToUpload =
            base && base !== file.name
              ? new File([file], base, { type: file.type || 'application/octet-stream' })
              : file
          const multipart = await uploadDriveMultipart({ file: fileToUpload, path: dir })
          remotePath = multipart?.ok
            ? multipart?.data?.path || multipart?.data?.paths?.[0] || ''
            : ''
        } catch {
          // ignore
        }

        // Fallback to legacy FS upload if drive multipart isn't available / fails (keeps guest flows working).
        if (!remotePath) {
          const uploadUrl = authenticated
            ? `${apiBaseUrl()}/fs/upload?path=${encodeURIComponent(uploadPath)}`
            : `${apiBaseUrl()}/fs/public/upload?path=${encodeURIComponent(uploadPath)}`
          const res = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
              'X-File-Name': file.name,
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: file
          })
          if (!res.ok) continue
          const payload = await res.json().catch(() => ({}))
          remotePath = payload?.path || uploadPath
        }

        if (!remotePath) continue

        uploaded.push(remotePath)
        storeUploadedFile(remotePath, file, [uploadPath])
      }
      resolve(allowMultiple ? uploaded : uploaded[0] || null)
    }
  })

  document.body.appendChild(input)
  input.click()
  document.body.removeChild(input)
  return promise
}

/* async function uploadViaPicker(
  allowMultiple: boolean,
  filters?: Array<{ name: string; extensions: string[] }>
): Promise<string[] | string | null> {
  if (typeof window === 'undefined') return allowMultiple ? [] : null

  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = allowMultiple
  input.style.display = 'none'

  // Set file filters (accept attribute)
  try {
    const extensions = Array.isArray(filters)
      ? filters.flatMap((filter) => filter.extensions || [])
      : []
    const accept = extensions
      .map((ext) => ext.replace(/^\./, '').trim())
      .filter(Boolean)
      .map((ext) => `.${ext}`)
      .join(',')
    if (accept) input.accept = accept
  } catch {  }

  const promise = new Promise<string[] | string | null>((resolve) => {
    input.onchange = async () => {
      const files = Array.from(input.files || [])
      if (!files.length) {
        resolve(allowMultiple ? [] : null)
        return
      }

      const token = getAccessToken()
      const authenticated = Boolean(token)
      
      // Use the helper to process all files via the new multipart gateway
      const result = await uploadDriveMultipart({
        files: files,
        // Optional: dynamic path based on auth status
        path: authenticated ? 'home/.tmp/uploads' : 'public-temp'
      })

      if (result?.ok && result.data) {
        const paths = result.data.paths || []
        
        // Match the original storeUploadedFile logic for local caching
        files.forEach((file, index) => {
          const remotePath = paths[index]
          if (remotePath) {
            storeUploadedFile(remotePath, file)
          }
        })

        resolve(allowMultiple ? paths : paths[0] || null)
      } else {
        console.error('dynadoc Upload Error:', result?.message)
        resolve(allowMultiple ? [] : null)
      }
    }
  })

  document.body.appendChild(input)
  input.click()
  document.body.removeChild(input)
  return promise
} */

function isFileLike(value: any) {
  if (!value) return false
  if (typeof File !== 'undefined' && value instanceof File) return true
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true
  return typeof value === 'object' && typeof value.arrayBuffer === 'function'
}

async function uploadDriveMultipart11(payload: any) {
  const files: any[] = []
  if (payload?.file && isFileLike(payload.file)) files.push(payload.file)
  if (Array.isArray(payload?.files)) {
    for (const item of payload.files) if (isFileLike(item)) files.push(item)
  }
  if (!files.length) return null

  const pathValue = typeof payload?.path === 'string' ? payload.path : ''
  const token = getAccessToken()
  const uploadedPaths: string[] = []

  for (const file of files) {
    const form = new FormData()
    form.append('channel', 'drive:upload')
    if (pathValue) form.append('path', pathValue)
    const fileName = (file as any)?.name || 'upload'
    form.append('file', file, fileName)

    const res = await fetch(`${apiBaseUrl()}/api/ipc/invoke`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: form
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, message: err?.error || 'Upload failed' }
    }
    const payload = await res.json().catch(() => ({}))
    const remotePath = payload?.data?.path || payload?.path || ''
    if (remotePath) uploadedPaths.push(remotePath)
  }

  if (!uploadedPaths.length) return { ok: false, message: 'Upload failed' }
  return {
    ok: true,
    data: {
      path: uploadedPaths[0],
      paths: uploadedPaths
    }
  }
}

// Uploads every file under a document's cache folder to the server drive so
// that server-side operations (sealing via ddocify, sharing) — which read the
// document FROM the drive — have the files. On web the doc lives only in the
// virtual FS until this runs, which is why a fresh doc could not be sealed or
// shared ("drive sync is required before sharing"). The cache path is already
// drive-relative (home/<uuid>/<name>/...), so each file's path is its drive path.
async function syncDocFolderWeb(cachePath: string) {
  const root = String(cachePath || '').trim()
  if (!root) return { ok: false, message: 'cachePath is required' }

  const collected: string[] = []
  const walk = async (dir: string) => {
    let entries: any[] = []
    try {
      entries = ((await webNode.fsPromises.readdir(dir)) as any) || []
    } catch {
      return
    }
    for (const entry of entries) {
      const isDir = entry?.is_dir === true || entry?.isDirectory === true
      const childPath = entry?.path || `${dir.replace(/\/+$/, '')}/${entry?.name ?? String(entry)}`
      if (isDir) await walk(childPath)
      else collected.push(childPath)
    }
  }
  await walk(root)
  if (!collected.length) return { ok: false, message: 'No files to sync.' }

  let uploaded = 0
  for (const filePath of collected) {
    let content: any
    try {
      content = await webNode.fsPromises.readFile(filePath)
    } catch {
      continue
    }
    const blob =
      content instanceof Uint8Array || content instanceof ArrayBuffer
        ? new Blob([content])
        : new Blob([typeof content === 'string' ? content : String(content ?? '')])
    const name = filePath.split('/').pop() || 'file'
    const res = await uploadDriveMultipart({ files: [new File([blob], name)], path: filePath })
    if (res?.ok) uploaded += 1
  }
  return { ok: uploaded > 0, uploadedCount: uploaded, totalCount: collected.length }
}

async function uploadDriveMultipart(payload: any) {
  const files: any[] = []

  // 1. Collect files from payload
  if (payload?.file instanceof Blob) files.push(payload.file)
  if (Array.isArray(payload?.files)) {
    for (const item of payload.files) {
      if (item instanceof Blob) files.push(item)
    }
  }

  // If no binary files found, return null to fallback to standard 'invoke'
  if (!files.length) return null

  const pathValue = typeof payload?.path === 'string' ? payload.path : ''
  const token = getAccessToken()
  const uploadedPaths: string[] = []

  for (const file of files) {
    const form = new FormData()
    form.append('channel', 'drive:upload')
    // Match your Go Backend: c.FormValue("path")
    if (pathValue) form.append('path', pathValue)

    // Match your Go Backend: c.FormFile("file")
    const fileName = file.name || 'upload'
    form.append('file', file, fileName)

    const res = await fetch(`${apiBaseUrl()}/api/ipc/invoke`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
        // REMINDER: Do not set Content-Type here
      },
      body: form
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, message: err?.error || 'Upload failed' }
    }

    const data = await res.json().catch(() => ({}))
    const remotePath = data?.data?.path || data?.path || ''
    if (remotePath) uploadedPaths.push(remotePath)
  }

  notifyFsMutated()
  return {
    ok: true,
    data: {
      path: uploadedPaths[0],
      paths: uploadedPaths
    }
  }
}

export const WebDriver = {
  api,
  server: {
    ai: {
      generate: async (payloadOrPrompt: any, requestId?: string) => {
        const resolvedRequestId =
          typeof payloadOrPrompt === 'object' && payloadOrPrompt?.requestId
            ? payloadOrPrompt.requestId
            : requestId
        const rid = resolvedRequestId || `chat-${Date.now()}`

        const token = getAccessToken()
        const url = `${apiBaseUrl()}/api/ipc/invoke`
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ channel: 'ai:generate', args: [payloadOrPrompt, rid] })
        })

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(text || `ai:generate failed (${res.status})`)
        }

        const reader = res.body?.getReader?.()
        if (!reader) {
          const text = await res.text().catch(() => '')
          emit('ai:chunk', { requestId: rid, content: text, response: text })
          emit('ai:done', { requestId: rid, fullData: text })
          return text
        }

        const decoder = new TextDecoder()
        let buffer = ''
        let fullData = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value || new Uint8Array(), { stream: true })
          if (!chunk) continue
          buffer += chunk
          fullData += chunk

          while (true) {
            const idx = buffer.indexOf('\n')
            if (idx < 0) break
            let line = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 1)
            if (line.endsWith('\r')) line = line.slice(0, -1)
            if (!line) continue
            const content = `${line}\n`
            emit('ai:chunk', { requestId: rid, content, response: content })
          }
        }

        if (buffer) {
          const content = buffer.endsWith('\n') ? buffer : `${buffer}\n`
          emit('ai:chunk', { requestId: rid, content, response: content })
          fullData += content
        }

        emit('ai:done', { requestId: rid, fullData })
        return fullData
      },
      onChunk: (callback: (payload: any) => void) => on('ai:chunk', callback),
      onDone: (callback: (payload: any) => void) => on('ai:done', callback),
      abort: () => send('ai:abort')
    },
    chat: {
      listSessions: () => invoke('ai:list-sessions'),
      getSession: (payload: { sessionId: string }) =>
        invoke('ai:get-session', { asResponse: false }, payload),
      upsertSession: (payload: Record<string, any>) =>
        invoke('ai:save-session', { asResponse: false }, payload),
      deleteSession: (payload: { sessionId: string }) =>
        invoke('ai:delete-session', { asResponse: false }, payload)
    },
    drive: {
      getRoot: (payload?: any) => invoke('drive:get-root', { asResponse: false }, payload),
      listDir: (payload: any) => invoke('drive:list', { asResponse: false }, payload),
      openItem: async (payload: any) => EditorCommonUtils.openDriveItem(payload),
      mkdir: (payload: any) => invoke('drive:mkdir', { asResponse: false }, payload),
      uploadFiles: async (payload: any) => {
        const multipartResult = await uploadDriveMultipart(payload)
        if (multipartResult) return multipartResult
        return invoke('drive:upload', { asResponse: false }, payload)
      },
      downloadItem: async (
        payload: any,
        options?: { onProgress?: (info: { received: number; total?: number }) => void }
      ) => {
        const result = await invoke('drive:download', { asResponse: false }, payload)
        if (!result?.ok) return result
        const url = result?.data?.url || result?.url || ''
        if (url) {
          const name = payload?.name || payload?.fileName || ''
          await downloadUrlWithAuth(url, name, options)
          return { ok: true, url, savePath: url }
        }
        return result
      },
      deleteItem: (payload: any) => {
        if (!payload?.path) {
          return Promise.resolve({ ok: false, message: 'Path is required.' })
        }
        return invoke('drive:delete-item', { asResponse: false }, payload)
      },
      moveItem: (payload: any) => invoke('drive:move-item', { asResponse: false }, payload),
      copyItem: (payload: any) => invoke('drive:copy-item', { asResponse: false }, payload),
      resolvePath: (payload: any) => invoke('drive:resolve-path', { asResponse: false }, payload),
      shareItem: (payload: any) =>
        fetchJson('/drive/share', {
          method: 'POST',
          body: JSON.stringify(payload || {})
        }),
      getShare: (payload: any) => {
        const pathValue = payload?.path ? encodeURIComponent(payload.path) : ''
        return fetchJson(`/drive/share?path=${pathValue}`, { method: 'GET' })
      },
      syncDoc: async (payload: any) =>
        syncDocFolderWeb(payload?.cachePath || payload?.cacheRoot || '')
    },
    share: {
      resolve: (payload: any) => {
        const params = new URLSearchParams()
        if (payload?.shareId) params.set('shareId', payload.shareId)
        if (payload?.docUuid) params.set('docUuid', payload.docUuid)
        if (payload?.name) params.set('name', payload.name)
        if (payload?.path) params.set('path', payload.path)
        if (payload?.password) params.set('password', payload.password)
        return fetchJson(`/share/resolve?${params.toString()}`, { method: 'GET' })
      },
      principals: (payload: { q?: string; query?: string }) => {
        const q = String(payload?.q || payload?.query || '').trim()
        const params = new URLSearchParams()
        if (q) params.set('q', q)
        return fetchJson(`/share/principals?${params.toString()}`, { method: 'GET' })
      },
      audit: (payload: any) =>
        fetchJson('/share/audit', {
          method: 'POST',
          body: JSON.stringify(payload || {})
        }),
      auditList: (payload: any) => {
        const params = new URLSearchParams()
        if (payload?.shareId) params.set('shareId', payload.shareId)
        if (payload?.limit) params.set('limit', String(payload.limit))
        return fetchJson(`/share/audit?${params.toString()}`, { method: 'GET' })
      },
      rotate: (payload: any) =>
        fetchJson('/share/rotate', {
          method: 'POST',
          body: JSON.stringify(payload || {})
        }),
      editLock: (payload: any) =>
        fetchJson('/share/edit-lock', {
          method: 'POST',
          body: JSON.stringify(payload || {})
        })
    },
    sync: {
      start: async (_payload: any) => ({ ok: false, message: 'Sync is not supported on web.' }),
      stop: async (_payload: any) => ({ ok: false, message: 'Sync is not supported on web.' }),
      open: async (_payload: any) => ({ ok: false, message: 'Sync is not supported on web.' }),
      commit: async (_payload: any) => ({ ok: false, message: 'Sync is not supported on web.' }),
      history: async (_payload: any) => ({ ok: false, message: 'Sync is not supported on web.' }),
      rollback: async (_payload: any) => ({ ok: false, message: 'Sync is not supported on web.' }),
      rename: async (_payload: any) => ({ ok: false, message: 'Sync is not supported on web.' })
    },
    auth: {
      signIn: async (payload?: any) =>
        openAuthUrl(
          await invoke(
            'auth:signin',
            { asResponse: false },
            withAuthContext(withAuthDebug(payload))
          )
        ),
      signUp: async (payload?: any) =>
        openAuthUrl(
          await invoke(
            'auth:signup',
            { asResponse: false },
            withAuthContext(withAuthDebug(payload))
          )
        ),
      register: async (payload?: any) =>
        openAuthUrl(
          await invoke(
            'auth:register',
            { asResponse: false },
            withAuthContext(withAuthDebug(payload))
          )
        ),
      joinInvite: async (payload: any) =>
        openAuthUrl(
          await invoke(
            'auth:join-invite',
            { asResponse: false },
            withAuthContext(withAuthDebug(payload))
          )
        ),
      callback: async (payload: any) => {
        const result = await invoke('auth:callback', { asResponse: false }, withAuthDebug(payload))
        emit('auth:session-changed', result)
        return result
      },
      getSession: async (payload?: any) => {
        const result = await invoke(
          'auth:get-session',
          { asResponse: false },
          withAuthDebug(payload)
        )
        emit('auth:session-changed', result)
        return result
      },
      listSessions: () => invoke('auth:list-sessions'),
      setActiveOrg: (payload: any) =>
        invoke('auth:set-active-org', { asResponse: false }, withAuthDebug(payload)),
      getDeviceId: async () => {
        if (typeof localStorage === 'undefined') return { ok: false }
        let deviceId = localStorage.getItem(DEVICE_ID_KEY)
        if (!deviceId) {
          deviceId =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? cryptoRandomUUID()
              : `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
          localStorage.setItem(DEVICE_ID_KEY, deviceId)
        }
        return { ok: true, deviceId }
      },
      logout: async (payload?: { org?: string }) => {
        const result = await invoke('auth:logout', { asResponse: false }, withAuthDebug(payload))
        emit('auth:session-changed', result)
        return result
      },
      onSessionChanged: (callback: (session: any) => void) => on('auth:session-changed', callback)
    },
    forms: {
      submit: (payload: any) => invoke('forms:submit', { asResponse: false }, payload),
      list: (payload: any) => invoke('forms:list', { asResponse: false }, payload),
      get: (payload: any) => invoke('forms:get', { asResponse: false }, payload),
      history: (payload: any) => invoke('forms:history', { asResponse: false }, payload)
    },
    mattermost: {
      prepareSession: () => invoke('mattermost:prepare')
    },
    jitsi: {
      getJoinUrl: (payload: any) => invoke('jitsi:get-join-url', { asResponse: false }, payload)
    },
    dify: {
      uploadDocuments: async (payload: any) => {
        const result = await invoke('dify:upload-documents', { asResponse: false }, payload)
        emit('dify:upload-progress', { status: 'done', result })
        return result
      },
      listDatasets: (payload?: any) => invoke('dify:list-datasets', { asResponse: false }, payload),
      onUploadProgress: (callback: (payload: any) => void) => on('dify:upload-progress', callback)
    }
  },
  terminal: {
    open: async (_folderPath: string) => {
      throw new Error('Terminal is not available on web.')
    },
    sendInput: (_payload: any) => {},
    onOutput: (_callback: (msg: any) => void) => () => {},
    onClosed: (_callback: (msg: any) => void) => () => {},
    kill: (_id: string) => {}
  },
  presentationAPI: createPresentationApi(),
  meetingAPI: createMeetingApi(),
  // node: webNode,
  process: { platform: 'web' }
}

function openAuthUrl(result: any) {
  if (result?.ok && result?.url && typeof window !== 'undefined') {
    window.location.assign(result.url)
  }
  return result
}

// An authorization code is single use. Carrying one into returnTo makes the
// provider send the browser back to a URL that replays a code the server has
// already spent, and the exchange fails with invalid_grant. Production logs
// showed the same code arriving at /auth/callback three times for this reason.
// The nonce is stripped for the same reason in reverse: the one in the address
// bar belongs to the sign-in that just finished, and a fresh one is minted
// below.
const OAUTH_CALLBACK_PARAMS = [
  'code',
  'state',
  'session_state',
  'error',
  'error_description',
  CALLBACK_NONCE_PARAM
]

/**
 * Where the provider sends the browser back, carrying a nonce this browser can
 * recognise. `captureAuthFromUrl` refuses a callback without it, which is what
 * stops a link someone else crafted from signing you into their account.
 *
 * When no nonce could be stored the parameter is left off rather than sent
 * unmatched, and the callback is refused on return. That browser cannot keep a
 * session anyway: the tokens go to `localStorage`.
 */
function returnToForCurrentLocation(): string {
  try {
    const url = new URL(window.location.href)
    OAUTH_CALLBACK_PARAMS.forEach((param) => url.searchParams.delete(param))
    const nonce = issueCallbackNonce()
    if (nonce) url.searchParams.set(CALLBACK_NONCE_PARAM, nonce)
    return url.toString()
  } catch {
    return window.location.href
  }
}

function withAuthContext(payload?: any) {
  const base = payload && typeof payload === 'object' ? { ...payload } : {}
  if (typeof window !== 'undefined') {
    if (!base.returnTo) base.returnTo = returnToForCurrentLocation()
    if (!base.client) base.client = 'web'
  }
  return base
}

function createPresentationApi() {
  const local = new EventTarget()
  const channel = new BroadcastChannel('dynadoc:presentation')
  const lastPayloadKey = 'dynadoc:presentation:lastPayload'
  const popupBlockedKey = 'dynadoc:presentation:popupBlocked'
  let lastPayload: any = null
  let presentationWindow: Window | null = null

  const isPresentationRoute = () =>
    window.location.pathname === '/presentation' || window.location.hash === '#/presentation'

  const persistPayload = (payload: any | null) => {
    if (!payload) {
      localStorage.removeItem(lastPayloadKey)
      return
    }
    try {
      localStorage.setItem(lastPayloadKey, JSON.stringify(payload))
    } catch {}
  }

  const readPayload = () => {
    if (lastPayload) return lastPayload
    try {
      const raw = localStorage.getItem(lastPayloadKey)
      if (!raw) return null
      lastPayload = JSON.parse(raw)
      return lastPayload
    } catch {
      return null
    }
  }

  const openPresentationWindow = () => {
    if (presentationWindow && !presentationWindow.closed) {
      presentationWindow.focus()
      return
    }
    const url = `${window.location.origin}${window.location.pathname}#/presentation`
    presentationWindow = window.open(
      url,
      'dynadoc-presentation',
      'popup,width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,noopener,noreferrer'
    )
    if (!presentationWindow) {
      // Popup blocked: try a new tab, but keep current view
      presentationWindow = window.open(url, '_blank', 'noopener,noreferrer')
      if (!presentationWindow) {
        try {
          sessionStorage.setItem(popupBlockedKey, '1')
        } catch {}
        return
      }
      return
    }
    presentationWindow.focus()
  }

  channel.addEventListener('message', (event) => {
    const { type, payload } = event.data || {}
    if (!type) return
    if (type === 'presentation:start') {
      lastPayload = payload
      persistPayload(payload)
      local.dispatchEvent(new CustomEvent('presentation:data', { detail: payload }))
      return
    }
    if (type === 'presentation:stop') {
      lastPayload = null
      persistPayload(null)
      local.dispatchEvent(new CustomEvent('presentation:stop', { detail: payload }))
      return
    }
    if (type === 'presentation:update') {
      lastPayload = payload ?? lastPayload
      persistPayload(lastPayload)
    }
    local.dispatchEvent(new CustomEvent(type, { detail: payload }))
  })

  return {
    getInitialData: () => {
      return Promise.resolve(readPayload())
    },
    sendData: (ipcKey: string, payload: any) => {
      if (ipcKey === 'presentation:start') {
        lastPayload = payload
        persistPayload(payload)
        openPresentationWindow()
        channel.postMessage({ type: ipcKey, payload })
        local.dispatchEvent(new CustomEvent('presentation:data', { detail: payload }))
        return
      }
      if (ipcKey === 'presentation:stop') {
        lastPayload = null
        persistPayload(null)
        channel.postMessage({ type: ipcKey, payload })
        local.dispatchEvent(new CustomEvent('presentation:stop', { detail: payload }))
        return
      }
      if (ipcKey === 'presentation:update') {
        lastPayload = payload ?? lastPayload
        persistPayload(lastPayload)
        channel.postMessage({ type: ipcKey, payload: lastPayload })
      }
      local.dispatchEvent(new CustomEvent(ipcKey, { detail: payload }))
    },
    onData: (cb: (payload: any) => void) => {
      const handler = (event: Event) => cb((event as CustomEvent).detail)
      local.addEventListener('presentation:data', handler as EventListener)
      const cached = readPayload()
      if (cached) cb(cached)
    },
    onUpdate: (cb: (payload: any) => void) => {
      const handler = (event: Event) => cb((event as CustomEvent).detail)
      local.addEventListener('presentation:update', handler as EventListener)
      const cached = readPayload()
      if (cached) cb(cached)
    },
    navigate: (index: number) => {
      if (!readPayload()) return
      const max = Math.max(0, (lastPayload.pageCount || 1) - 1)
      const nextIndex = Math.max(0, Math.min(index, max))
      lastPayload = { ...lastPayload, currentIndex: nextIndex }
      persistPayload(lastPayload)
      channel.postMessage({ type: 'presentation:update', payload: lastPayload })
      local.dispatchEvent(new CustomEvent('presentation:update', { detail: lastPayload }))
    },
    focusOnPresentationWindow: () => {
      if (presentationWindow && !presentationWindow.closed) {
        presentationWindow.focus()
        return
      }
      if (!isPresentationRoute()) openPresentationWindow()
    },
    stop: (_scope: 'presenter' | 'all' = 'presenter') => {
      lastPayload = null
      persistPayload(null)
      channel.postMessage({ type: 'presentation:stop' })
      local.dispatchEvent(new CustomEvent('presentation:stop'))
    }
  }
}

function createMeetingApi() {
  return {
    openMeeting: (url: string) => invoke('meeting:open', { asResponse: false }, url),
    onShowScreenPicker: (_callback: any) => {},
    selectScreenSource: (_sourceId: string) => {},
    onToolbarEvent: (_callback: any) => {},
    onStart: (callback: (url: string) => void) => on('meeting:start', callback),
    getInitialUrl: () => invoke('meeting:get-initial-url'),
    startLaser: () => {},
    stopLaser: () => {},
    onLaserCursorUpdate: (_callback: any) => {},
    toggleLaser: (_isActive: boolean) => {},
    toggleSpotlight: (_isActive: boolean) => {},
    onLaserToggle: (_callback: any) => {},
    onSpotlightToggle: (_callback: any) => {},
    stopSharing: () => {},
    onStopStream: (_callback: any) => {},
    removeMeetingListeners: () => {},
    toggleMic: (_isMuted: boolean) => {},
    toggleAnnotations: (_active: boolean) => {},
    toggleMagnifier: (_active: boolean) => {},
    onMicAction: (_callback: any) => {}
  }
}

export const WebBaseUrl = apiBaseUrl()
export default WebDriver
