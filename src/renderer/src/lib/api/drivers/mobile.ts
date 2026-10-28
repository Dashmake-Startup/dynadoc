import type { AppPlatformAPI } from '../../types/api'
import { invoke, send, on, emit, readFileBinary } from '../mobile/bridge'
import { resolveApiBaseUrl } from '../shared/baseUrl'
import { mobileNode } from '../mobile/node'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import EditorCommonUtils, { cryptoRandomUUID } from '../../../utils/common.utils'
import { storeUploadedFile } from '../../../utils/uploadCache'
import Utils from '../../../utils/Utils'
// import { webNode } from '../web/node'

const BASE_URL = resolveApiBaseUrl()
const ACCESS_TOKEN_KEY = 'ddoc.access_token'
const AUTH_DEBUG_KEY = 'ddoc.auth.debug'

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

const splitDirAndBase = (inputPath: string) => {
  const normalized = String(inputPath || '').replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  const base = parts.pop() || ''
  const dir = parts.join('/')
  return { dir, base }
}

const normalizeStorageDir = (dir: string): string => {
  const raw = (dir || '').replace(/\\/g, '/')
  if (!raw) return 'drive/home'
  if (raw.endsWith('/home') || raw.includes('/home/')) return raw
  if (raw === 'drive' || raw.endsWith('/drive')) return `${raw}/home`
  return raw
}

const fetchJson = async (path: string, options: RequestInit = {}) => {
  const token = getAccessToken()
  const url = `${BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`
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
  if (!token) throw new Error('missing token')
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
      const blob = new Blob(chunks)
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
  } catch (err) {
    throw err
  }
}

const api: AppPlatformAPI & Record<string, any> = {
  readFile: (path: string, encoding?: string) => invoke('read-file', path, encoding),
  readFileBinary: (path: string) => readFileBinary(path),
  readDir: (path: string) => invoke('read-dir', path),
  node: mobileNode,
  getFonts: () => invoke('get-fonts'),
  getStorageDir: async () => {
    try {
      const resolved = await invoke('get-storage-dir')
      return normalizeStorageDir(resolved || '')
    } catch {
      return 'drive/home'
    }
  },
  openExternal: async (url: string) => {
    await Browser.open({ url })
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
    invoke('read-file-content', filePath, encoding),
  getCacheDir: async () => {
    try {
      return await invoke('get-cache-dir')
    } catch {
      return 'cache'
    }
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
  ) => invoke('ddocify', folderPath, outputFile, shouldSecured, require2fa),
  unddocify: (zipFilePath: string, outputDir: string, isSecured?: boolean, stepupToken?: string) =>
    invoke('unddocify', zipFilePath, outputDir, isSecured, stepupToken),
  decryptFileToMemory: async (encPath: string, password: string | ArrayBuffer) => {
    const base64 = await invoke<string>('decrypt-file-to-memory', encPath, password)
    const binary = atob(base64 || '')
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  },
  rollupBundle: (sourceCode: string) => invoke('rollup-bundle', sourceCode),

  watchFile: (filePath: string, callerId: string) => invoke('watch-file', filePath, callerId),
  onFileChange: (callback: (content: string, callerId: string) => void) =>
    on('file-changed', ({ content, callerId }) => callback(content, callerId)),

  openFile: (filePath: string) => invoke('open-file', filePath),
  renameFile: (oldPath: string, newName: string) => invoke('rename-file', oldPath, newName),
  moveFile: (srcPath: string, destPath: string) => invoke('move-file', srcPath, destPath),
  deleteFile: (filePath: string) => invoke('delete-file', filePath),

  searchFiles: (payload: any) => invoke('search:files', payload),
  replaceInFiles: (payload: any) => invoke('search:replace-in-files', payload),
  searchFileNames: (payload: any) => invoke('search:file-names', payload),
  translateText: (payload: any) => invoke('translate:text', payload),

  showContextMenuLegacy: (template: any[]) => invoke('show-context-menu', template),
  registerMenuAction: (id: string) => invoke('register-menu-action', id),
  onInvokeMenuAction: (callback: (event: any, id: string) => void) =>
    on('invoke-menu-action', (payload) => callback(payload?.event, payload?.id)),

  getFilePath: (file: File) => (file as any).path || null,

  convertHtmlToDocx: (inputPath: string, outputPath: string) =>
    invoke('convert-docx', inputPath, outputPath),
  convertDocxToHtml: (inputPath: string, outputPath: string) =>
    invoke('convert-docx', inputPath, outputPath),
  // exportDdocToHtml: (cacheDir: string, outputPath: string) =>
  //   invoke('export-ddoc-to-html', cacheDir, outputPath),
  convertPptxToPresentation: (inputPath: string, outputPath: string) =>
    invoke('convert-pptx', inputPath, outputPath),
  latexCompile: (inputPath: string) => invoke('latex:compile', inputPath),
  latexSaveTempTex: (content: string) => invoke('latex:save-temp-tex', content),
  latexProjectInit: (payload: { projectDir: string; title?: string }) =>
    invoke('latex:project:init', payload),
  latexProjectList: (projectDir: string) => invoke('latex:project:list', projectDir),
  latexProjectRead: (filePath: string) => invoke('latex:project:read', filePath),
  latexProjectWrite: (filePath: string, content: string) =>
    invoke('latex:project:write', filePath, content),
  latexProjectWatch: (payload: { projectId: string; projectDir: string }) =>
    invoke('latex:project:watch', payload),
  latexProjectUnwatch: (projectId: string) => invoke('latex:project:unwatch', projectId),
  latexProjectCompile: (payload: { projectId: string; texFilePath: string }) =>
    invoke('latex:project:compile', payload),
  onLatexProjectChanged: (callback: (payload: any) => void) =>
    on('latex:project:changed', callback),
  onLatexCompileLog: (callback: (payload: any) => void) => on('latex:compile:log', callback),
  onLatexCompileDone: (callback: (payload: any) => void) => on('latex:compile:done', callback),
  onLatexCompileError: (callback: (payload: any) => void) => on('latex:compile:error', callback),
  exportToPDF: async (content: any, outputPath?: string) => {
    if (outputPath) return invoke('export-to-pdf', content, outputPath)
    const result: any = await invoke('export-to-pdf', content, null)
    if (result?.base64) {
      downloadBase64File({
        base64: result.base64,
        fileName: result.fileName || content?.fileName || 'export.pdf'
      })
      return true
    }
    return result
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
    invoke('dialog:saveFile', options),
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
    queryHistory: async (query: string) => invoke('browser:history-query', query),
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
  const packedExtensions = new Set([
    Utils.DYNADOC_EXTENSIONS.default,
    Utils.DYNADOC_EXTENSIONS.secured
  ])
  const isPackedDoc = (name: string) => {
    const ext = name ? `.${name.split('.').pop() || ''}`.toLowerCase() : ''
    return packedExtensions.has(ext)
  }

  if (Capacitor.isNativePlatform?.()) {
    const native = await pickFilesNative(allowMultiple, filters)
    if (native) return native
  }
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
            const res = await fetch(`${BASE_URL}/drive/upload`, {
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

        // Fallback to legacy FS upload if drive multipart isn't available / fails.
        if (!remotePath) {
          const uploadUrl = authenticated
            ? `${BASE_URL}/fs/upload?path=${encodeURIComponent(uploadPath)}`
            : `${BASE_URL}/fs/public/upload?path=${encodeURIComponent(uploadPath)}`
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

async function pickFilesNative(
  allowMultiple: boolean,
  filters?: Array<{ name: string; extensions: string[] }>
): Promise<string[] | string | null> {
  try {
    const mod = await import('@capawesome/capacitor-file-picker')
    const picker = mod?.FilePicker
    if (!picker?.pickFiles) return null

    const extensions = (filters || [])
      .flatMap((filter) => filter.extensions || [])
      .map((ext) => ext.replace(/^\./, '').trim())
      .filter(Boolean)

    const result = await picker.pickFiles({
      multiple: allowMultiple,
      readData: true,
      types: extensions.length ? extensions.map((ext) => `.${ext}`) : undefined
    })

    const files = Array.isArray(result?.files) ? result.files : []
    if (!files.length) return allowMultiple ? [] : null

    const packedExtensions = new Set([
      Utils.DYNADOC_EXTENSIONS.default,
      Utils.DYNADOC_EXTENSIONS.secured
    ])
    const isPackedDoc = (name: string) => {
      const ext = name ? `.${name.split('.').pop() || ''}`.toLowerCase() : ''
      return packedExtensions.has(ext)
    }

    const uploaded: string[] = []
    for (const file of files) {
      const name = file.name || `upload-${Date.now()}`
      const data = typeof file.data === 'string' ? file.data : ''
      if (!data) continue
      const blob = base64ToBlob(data, file.mimeType || 'application/octet-stream')
      const token = getAccessToken()
      const authenticated = Boolean(token)
      if (isPackedDoc(name)) {
        if (authenticated) {
          const form = new FormData()
          form.append('file', blob, name)
          form.append('unpack', '1')
          const res = await fetch(`${BASE_URL}/drive/upload`, {
            method: 'POST',
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: form
          })
          if (!res.ok) continue
          const payload = await res.json().catch(() => ({}))
          const remotePath =
            payload?.path || payload?.data?.path || payload?.data?.remotePath || name
          uploaded.push(remotePath)
          storeUploadedFile(
            remotePath,
            new File([blob], name, { type: file.mimeType || 'application/octet-stream' })
          )
          continue
        }
      }

      const uploadPath = buildTempUploadPath(name, authenticated)
      const { dir, base } = splitDirAndBase(uploadPath)
      let remotePath = ''

      try {
        const fileToUpload = new File([blob], base || name, {
          type: file.mimeType || 'application/octet-stream'
        })
        const multipart = await uploadDriveMultipart({ file: fileToUpload, path: dir })
        remotePath = multipart?.ok ? multipart?.data?.path || multipart?.data?.paths?.[0] || '' : ''
      } catch {
        // ignore
      }

      if (!remotePath) {
        const uploadUrl = authenticated
          ? `${BASE_URL}/fs/upload?path=${encodeURIComponent(uploadPath)}`
          : `${BASE_URL}/fs/public/upload?path=${encodeURIComponent(uploadPath)}`
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': file.mimeType || 'application/octet-stream',
            'X-File-Name': name,
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: blob
        })
        if (!res.ok) continue
        const payload = await res.json().catch(() => ({}))
        remotePath = payload?.path || uploadPath
      }

      uploaded.push(remotePath)
      storeUploadedFile(
        remotePath,
        new File([blob], name, { type: file.mimeType || 'application/octet-stream' }),
        [uploadPath]
      )
    }

    if (!uploaded.length) {
      return allowMultiple ? [] : null
    }
    return allowMultiple ? uploaded : uploaded[0] || null
  } catch (error) {
    console.warn('Native file picker failed, falling back to web picker.', error)
    return null
  }
}

function base64ToBlob(base64: string, mimeType: string) {
  const cleaned = base64.includes(',') ? base64.split(',')[1] : base64
  const binary = atob(cleaned)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

function isFileLike(value: any) {
  if (!value) return false
  if (typeof File !== 'undefined' && value instanceof File) return true
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true
  return typeof value === 'object' && typeof value.arrayBuffer === 'function'
}

async function uploadDriveMultipart(payload: any) {
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

    const res = await fetch(`${BASE_URL}/api/ipc/invoke`, {
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

export const MobileDriver = {
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
        const url = `${BASE_URL.replace(/\/$/, '')}/api/ipc/invoke`
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
      getSession: (payload: { sessionId: string }) => invoke('ai:get-session', payload),
      upsertSession: (payload: Record<string, any>) => invoke('ai:save-session', payload),
      deleteSession: (payload: { sessionId: string }) => invoke('ai:delete-session', payload)
    },
    drive: {
      getRoot: (payload?: any) => invoke('drive:get-root', payload),
      listDir: (payload: any) => invoke('drive:list', payload),
      openItem: async (payload: any) => EditorCommonUtils.openDriveItem(payload),
      mkdir: (payload: any) => invoke('drive:mkdir', payload),
      uploadFiles: async (payload: any) => {
        const multipartResult = await uploadDriveMultipart(payload)
        if (multipartResult) return multipartResult
        return invoke('drive:upload', payload)
      },
      downloadItem: async (
        payload: any,
        options?: { onProgress?: (info: { received: number; total?: number }) => void }
      ) => {
        const result = await invoke('drive:download', payload)
        if (!result?.ok) return result
        const url = result?.data?.url || result?.url || ''
        if (url) {
          const name = payload?.name || payload?.fileName || ''
          await downloadUrlWithAuth(url, name, options)
          return { ok: true, url, savePath: url }
        }
        return result
      },
      deleteItem: (payload: any) => invoke('drive:delete-item', payload),
      moveItem: (payload: any) => invoke('drive:move-item', payload),
      copyItem: (payload: any) => invoke('drive:copy-item', payload),
      resolvePath: (payload: any) => invoke('drive:resolve-path', payload),
      shareItem: (payload: any) =>
        fetchJson('/drive/share', {
          method: 'POST',
          body: JSON.stringify(payload || {})
        }),
      getShare: (payload: any) => {
        const pathValue = payload?.path ? encodeURIComponent(payload.path) : ''
        return fetchJson(`/drive/share?path=${pathValue}`, { method: 'GET' })
      },
      syncDoc: (payload: any) => invoke('drive:sync-doc', payload)
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
      start: (payload: any) => invoke('sync:start', payload),
      stop: (payload: any) => invoke('sync:stop', payload),
      open: (payload: any) => invoke('sync:open', payload),
      commit: (payload: any) => invoke('sync:commit', payload),
      history: (payload: any) => invoke('sync:history', payload),
      rollback: (payload: any) => invoke('sync:rollback', payload),
      rename: (payload: any) => invoke('sync:rename', payload)
    },
    auth: {
      signIn: async (payload?: any) =>
        openAuthUrl(await invoke('auth:signin', withAuthContext(withAuthDebug(payload)))),
      signUp: async (payload?: any) =>
        openAuthUrl(await invoke('auth:signup', withAuthContext(withAuthDebug(payload)))),
      register: async (payload?: any) =>
        openAuthUrl(await invoke('auth:register', withAuthContext(withAuthDebug(payload)))),
      joinInvite: async (payload: any) =>
        openAuthUrl(await invoke('auth:join-invite', withAuthContext(withAuthDebug(payload)))),
      callback: async (payload: any) => {
        const result = await invoke('auth:callback', withAuthDebug(payload))
        emit('auth:session-changed', result)
        return result
      },
      getSession: async (payload?: any) => {
        const result = await invoke('auth:get-session', withAuthDebug(payload))
        emit('auth:session-changed', result)
        return result
      },
      listSessions: () => invoke('auth:list-sessions'),
      setActiveOrg: (payload: any) => invoke('auth:set-active-org', withAuthDebug(payload)),
      getDeviceId: async () => {
        if (typeof localStorage === 'undefined') return { ok: false }
        const key = 'ddoc.device_id'
        let deviceId = localStorage.getItem(key)
        if (!deviceId) {
          deviceId =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? cryptoRandomUUID()
              : `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
          localStorage.setItem(key, deviceId)
        }
        return { ok: true, deviceId }
      },
      logout: async (payload?: { org?: string }) => {
        const result = await invoke('auth:logout', withAuthDebug(payload))
        emit('auth:session-changed', result)
        return result
      },
      onSessionChanged: (callback: (session: any) => void) => on('auth:session-changed', callback)
    },
    forms: {
      submit: (payload: any) => invoke('forms:submit', payload),
      list: (payload: any) => invoke('forms:list', payload),
      get: (payload: any) => invoke('forms:get', payload),
      history: (payload: any) => invoke('forms:history', payload)
    },
    mattermost: {
      prepareSession: () => invoke('mattermost:prepare')
    },
    jitsi: {
      getJoinUrl: (payload: any) => invoke('jitsi:get-join-url', payload)
    },
    dify: {
      uploadDocuments: async (payload: any) => {
        const result = await invoke('dify:upload-documents', payload)
        emit('dify:upload-progress', { status: 'done', result })
        return result
      },
      listDatasets: (payload?: any) => invoke('dify:list-datasets', payload),
      onUploadProgress: (callback: (payload: any) => void) => on('dify:upload-progress', callback)
    }
  },
  terminal: {
    open: async (_folderPath: string) => {
      throw new Error('Terminal is not available on mobile.')
    },
    sendInput: (_payload: any) => {},
    onOutput: (_callback: (msg: any) => void) => () => {},
    onClosed: (_callback: (msg: any) => void) => () => {},
    kill: (_id: string) => {}
  },
  presentationAPI: createPresentationApi(),
  meetingAPI: createMeetingApi(),
  node: mobileNode,
  process: { platform: Capacitor.getPlatform() }
}

function openAuthUrl(result: any) {
  if (result?.ok && result?.url) {
    Browser.open({ url: result.url })
  }
  return result
}

function withAuthContext(payload?: any) {
  const base = payload && typeof payload === 'object' ? { ...payload } : {}
  if (!base.returnTo) base.returnTo = getMobileReturnTo()
  if (!base.client) base.client = 'mobile'
  return base
}

function getMobileReturnTo() {
  const env = (import.meta as any).env || {}
  const scheme = String(env.VITE_MOBILE_URL_SCHEME || 'com.ddocoffice.com').trim()
  if (!scheme) return ''
  return `${scheme}://auth/callback`
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
    const url = `${window.location.origin}${window.location.pathname}#/presentation`
    try {
      presentationWindow = window.open(
        url,
        'dynadoc-presentation',
        'popup,width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,noopener,noreferrer'
      )
    } catch {
      presentationWindow = null
    }
    if (!presentationWindow) {
      try {
        presentationWindow = window.open(url, '_blank', 'noopener,noreferrer')
      } catch {
        presentationWindow = null
      }
      if (!presentationWindow) {
        try {
          sessionStorage.setItem(popupBlockedKey, '1')
        } catch {}
        return
      }
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
    openMeeting: (url: string) => invoke('meeting:open', url),
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

export const MobileBaseUrl = BASE_URL
export default MobileDriver
