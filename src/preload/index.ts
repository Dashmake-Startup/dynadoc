import { contextBridge, ipcRenderer, webUtils, clipboard, nativeImage } from 'electron'
// import { electronAPI } from '@electron-toolkit/preload'
// import fontManager from 'fontmanager-redux'
import type { IFontInfo } from 'font-list'
// import esbuild from 'esbuild';
import fs from 'fs'
import path, { relative } from 'path'
import os from 'os'
import * as electronProcess from 'process'
import {
  IPC_PRESENTATION_DATA,
  IPC_PRESENTATION_NAVIGATE,
  IPC_PRESENTATION_START,
  IPC_PRESENTATION_UPDATE,
  IPC_PRESENTATION_WINDOW_FOCUS,
  IPC_PRESENTATION_STOP,
  IPC_MEETING_START,
  PresentationPayload
} from '../renderer/src/shared/ipc'

// require('../renderer/src/assets/js/ui/i18n') // Import translation

const normalizeClipboardFileUrl = (raw: string): string | null => {
  const cleaned = (raw || '').trim()
  if (!cleaned) return null
  if (cleaned.startsWith('file://')) {
    try {
      const url = new URL(cleaned)
      let filePath = decodeURIComponent(url.pathname || '')
      if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(filePath)) {
        filePath = filePath.slice(1)
      }
      return path.normalize(filePath)
    } catch {
      const fallback = cleaned.replace(/^file:\/\//, '')
      return fallback ? path.normalize(fallback) : null
    }
  }

  if (process.platform === 'win32' && /^[A-Za-z]:[\\/]/.test(cleaned)) {
    return path.normalize(cleaned)
  }

  if (cleaned.startsWith('/')) {
    return path.normalize(cleaned)
  }

  return null
}

const parseUriList = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => normalizeClipboardFileUrl(line))
    .filter((line): line is string => Boolean(line))

const parseNullSeparated = (text: string): string[] =>
  text
    .split('\u0000')
    .map((line) => line.trim())
    .filter((line) => Boolean(line))

const readClipboardFilePaths = (): string[] => {
  const formats = clipboard.availableFormats()
  const readBufferAsString = (format: string, encoding: BufferEncoding): string => {
    try {
      const buffer = clipboard.readBuffer(format)
      if (!buffer || buffer.length === 0) return ''
      return buffer.toString(encoding)
    } catch {
      return ''
    }
  }

  if (formats.includes('public.file-url')) {
    const text = readBufferAsString('public.file-url', 'utf8')
    const paths = parseUriList(text)
    if (paths.length) return paths
  }

  if (formats.includes('public.file-urls')) {
    const text = readBufferAsString('public.file-urls', 'utf8')
    const paths = parseUriList(text)
    if (paths.length) return paths
  }

  if (formats.includes('text/uri-list')) {
    const text = readBufferAsString('text/uri-list', 'utf8')
    const paths = parseUriList(text)
    if (paths.length) return paths
  }

  if (formats.includes('x-special/gnome-copied-files')) {
    const text = readBufferAsString('x-special/gnome-copied-files', 'utf8')
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => Boolean(line))
    if (lines.length > 1) {
      const paths = lines
        .slice(1)
        .map((line) => normalizeClipboardFileUrl(line))
        .filter((line): line is string => Boolean(line))
      if (paths.length) return paths
    }
  }

  if (formats.includes('FileNameW')) {
    const text = readBufferAsString('FileNameW', 'utf16le')
    const paths = parseNullSeparated(text).map((item) => path.normalize(item))
    if (paths.length) return paths
  }

  if (formats.includes('FileName')) {
    const text = readBufferAsString('FileName', 'ascii')
    const paths = parseNullSeparated(text).map((item) => path.normalize(item))
    if (paths.length) return paths
  }

  return []
}

// Custom APIs for renderer
/**
 * Re-throws the error a synchronous filesystem channel reported.
 *
 * The tagged union exists because event.returnValue cannot reject; turning it
 * back into an exception at the boundary is what keeps "a refusal is never a
 * value" true for the renderer.
 */
function unwrapSync<T>(
  result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }
): T {
  if (result && result.ok) return result.value
  const error = result?.error
  throw new Error(error ? `${error.code}: ${error.message}` : 'Filesystem call failed')
}

const api = {
  getFonts: (): Promise<IFontInfo[]> => ipcRenderer.invoke('get-fonts'),
  // getFonts: (): Promise<{}> => ipcRenderer.invoke('get-fonts'),
  // getFonts: (): Promise<fontManager.FontDescriptor[]> => ipcRenderer.invoke('get-fonts'),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('read-file', filePath),
  readFileContent: (filePath: string, encoding: string): Promise<string> =>
    ipcRenderer.invoke('read-file-content', filePath, encoding),
  syncAssets: (payload: { paths: string[]; cachePath?: string } | string[]) =>
    ipcRenderer.invoke('sync-assets', payload),

  // getCacheDir: (): string => ipcRenderer.invoke('get-cache-dir'),
  getCacheDir: (): Promise<string> => ipcRenderer.invoke('get-cache-dir'),
  getTempDir: (): Promise<string> => ipcRenderer.invoke('get-temp-dir'),
  getStorageDir: (): Promise<string> => ipcRenderer.invoke('get-storage-dir'),
  getPreloadPath: (name: string): Promise<string | null> =>
    ipcRenderer.invoke('preload:get-path', name),
  // ipcMain.handle('get-config', async () => await readConfigFile())
  // getStorageDir: ():string => ipcRenderer.invoke('get-storage-dir'),
  ddocify: (
    folderPath: string,
    outputFile: string,
    shouldSecured?: boolean,
    require2fa?: boolean
  ): Promise<string> =>
    ipcRenderer.invoke('ddocify', folderPath, outputFile, shouldSecured, require2fa),
  unddocify: (
    zipFilePath: string,
    outputDir: string,
    isSecured?: boolean,
    stepupToken?: string
  ): Promise<string> =>
    ipcRenderer.invoke('unddocify', zipFilePath, outputDir, isSecured, stepupToken),
  decryptFileToMemory: (encPath: string, password: string | Buffer): Promise<Buffer> =>
    ipcRenderer.invoke('decrypt-file-to-memory', encPath, password),
  // esbuildBundle: (sourceCode: string): Promise<esbuild.BuildResult> =>
  // ipcRenderer.invoke('esbuild-bundle', sourceCode),
  rollupBundle: (sourceCode: string) => ipcRenderer.invoke('rollup-bundle', sourceCode),

  watchFile: (filePath: string, callerId: string) =>
    ipcRenderer.invoke('watch-file', filePath, callerId),
  unwatchFile: (filePath: string, callerId: string) =>
    ipcRenderer.invoke('unwatch-file', filePath, callerId),
  onFileChange: (callback: (content: string, callerId: string) => void) => {
    ipcRenderer.on('file-changed', (_event, content, callerId) => callback(content, callerId))
  },

  // readDir: (dirPath) => ipcRenderer.invoke('read-dir', dirPath),
  readDir: async (
    dirPath: string,
    options?: { sort?: boolean; showHidden?: boolean; showSystemHidden?: boolean }
  ) => {
    return ipcRenderer.invoke('read-dir', dirPath, options)
  },
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  renameFile: (oldPath, newName) => ipcRenderer.invoke('rename-file', oldPath, newName),
  moveFile: (srcPath, destPath) => ipcRenderer.invoke('move-file', srcPath, destPath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  searchFiles: (payload: {
    rootPath: string
    query: string
    isRegex?: boolean
    caseSensitive?: boolean
    wholeWord?: boolean
    includePattern?: string
    excludePattern?: string
    maxResults?: number
    maxMatchesPerFile?: number
    restrictToPaths?: string[]
  }) => ipcRenderer.invoke('search:files', payload),
  replaceInFiles: (payload: {
    rootPath: string
    query: string
    replaceText: string
    isRegex?: boolean
    caseSensitive?: boolean
    wholeWord?: boolean
    includePattern?: string
    excludePattern?: string
    restrictToPaths?: string[]
  }) => ipcRenderer.invoke('search:replace-in-files', payload),
  searchFileNames: (payload: {
    rootPath: string
    query: string
    includePattern?: string
    excludePattern?: string
    maxResults?: number
  }) => ipcRenderer.invoke('search:file-names', payload),
  translateText: (payload: { text: string; sourceLang?: string; targetLang?: string }) =>
    ipcRenderer.invoke('translate:text', payload),

  setUnsavedBadge: (count: number) => ipcRenderer.invoke('app:set-unsaved-badge', { count }),
  onAppOpenFile: (callback: (filePath: string) => void) => {
    const subscription = (_event: any, filePath: string) => callback(filePath)
    ipcRenderer.on('app:open-file', subscription)
    return () => ipcRenderer.removeListener('app:open-file', subscription)
  },
  onAppCloseRequested: (callback: (payload: { reason: 'window-close' | 'app-quit' }) => void) => {
    const listener = (_event: any, payload: { reason: 'window-close' | 'app-quit' }) =>
      callback(payload)
    ipcRenderer.on('app:close-requested', listener)
    return () => ipcRenderer.removeListener('app:close-requested', listener)
  },
  respondToAppClose: (payload: { action: 'cancel' | 'quit' }) =>
    ipcRenderer.invoke('app:close-response', payload),

  // showContextMenu: (template: Electron.MenuItemConstructorOptions[]) =>
  //   ipcRenderer.invoke('show-context-menu', template)

  showContextMenu: (
    template: {
      label: string
      iconPath?: string
      accelerator?: string
      clickId: string
    }[]
  ) => ipcRenderer.invoke('show-context-menu', template),

  registerMenuAction: (id: string, _fn: () => void) =>
    ipcRenderer.invoke('register-menu-action', id),

  // Returns its own unsubscribe, like every other on* here. Handing the
  // renderer's callback back through an off* cannot work under
  // contextIsolation: a function crossing contextBridge arrives as a fresh
  // proxy each time, so removeListener never matches the listener that was
  // registered and it stays for the lifetime of the window -- firing menu
  // actions into components that are already gone.
  onInvokeMenuAction: (callback: (event: any, id: string) => void) => {
    const handler = (event: any, id: string) => callback(event, id)
    ipcRenderer.on('invoke-menu-action', handler)
    return () => ipcRenderer.removeListener('invoke-menu-action', handler)
  },
  updateRecentMenu: (items: { label: string; path: string; parentPath?: string | null }[]) =>
    ipcRenderer.send('menu:update-recent', items),
  /* onFileDrop: (callback) => {
    console.log('File dropped event received in preload:')

    ipcRenderer.on('file-drop', (_, filePath) => {
      console.log('Files dropped event received in preload:', filePath)

      callback(filePath)
    })
  },

  onFilesDrop: (callback: (files: string[]) => void) => {
    console.log('Setting up onFileDrop listener in preload')
    ipcRenderer.on('files-dropped', (_, files) => {
      console.log('Files dropped event received in preload:', files)
      callback(files)
    })
  }, */
  /*   sendDroppedFiles: async (files, callback) => {
      // Send files to main and wait for main to confirm
      const processedFiles = await ipcRenderer.invoke('files-dropped', files)
      // Call the renderer callback once
      callback(processedFiles)
    }
   */
  /* sendDroppedFiles: async (items) => {
    // Send dropped items to main process for full paths
    const files = await ipcRenderer.invoke('resolve-dropped-files', items)
    return files // array of { path, name }
  }, */

  /**
   * Securely get the absolute file path from a File object.
   * This function must be called from the preload script.
   * @param {File} file - The File object from the drop event.
   * @returns {string | null} The absolute file path.
   */
  /**
   * The validated filesystem surface, the replacement for window.node.fs.
   *
   * Exposed under `api` rather than as a ninth top-level name so that the
   * existing bridge surface -- and the smoke test that guards its eight names
   * -- does not change shape. The nodeApi shim is routed here.
   *
   * Synchronous calls come back as { ok, value } | { ok, error } because
   * event.returnValue cannot carry a rejection. They are re-thrown here, so a
   * caller sees one behaviour: every failure is an exception, whichever
   * transport it travelled over, and no failure is ever a plausible value.
   */
  fs: {
    existsSync: (filePath: string): boolean =>
      unwrapSync(ipcRenderer.sendSync('fs:exists.sync', filePath)),
    statSync: (filePath: string): unknown =>
      unwrapSync(ipcRenderer.sendSync('fs:stat.sync', filePath)),
    readFile: (filePath: string, encoding?: 'utf-8'): Promise<string | Uint8Array> =>
      ipcRenderer.invoke('fs:readFile', filePath, encoding),
    writeFile: (filePath: string, data: string | Uint8Array, encoding?: 'utf-8'): Promise<void> =>
      ipcRenderer.invoke('fs:writeFile', filePath, data, encoding),
    readDir: (dirPath: string): Promise<unknown[]> => ipcRenderer.invoke('fs:readDir', dirPath),
    mkdir: (dirPath: string, options?: { recursive?: boolean }): Promise<void> =>
      ipcRenderer.invoke('fs:mkdir', dirPath, options),
    remove: (targetPath: string, options?: { recursive?: boolean }): Promise<void> =>
      ipcRenderer.invoke('fs:remove', targetPath, options),
    rename: (fromPath: string, toPath: string): Promise<void> =>
      ipcRenderer.invoke('fs:rename', fromPath, toPath),
    copyFile: (fromPath: string, toPath: string): Promise<void> =>
      ipcRenderer.invoke('fs:copyFile', fromPath, toPath)
  },
  getFilePath: (file) => {
    // webUtils.getPathForFile is the secure way to get the path
    return webUtils.getPathForFile(file)
  },
  /**
   * Grants the application access to a file the user dropped on the window.
   *
   * Takes the File object, not a path, and that is the whole point. The path is
   * derived from webUtils.getPathForFile and sent to main inside this one
   * function, so a bare string never crosses as a grant request. A channel
   * shaped `grant(path: string)` would let any renderer code -- including a
   * script a forged document managed to run -- grant itself anything, which
   * would make the main-process path policy decorative.
   *
   * Returns whether the grant was accepted, so the caller can tell a refusal
   * from a success instead of finding out at the first read.
   */
  grantDroppedFile: (file: File): Promise<boolean> =>
    ipcRenderer.invoke('fs:grant-dropped-file', webUtils.getPathForFile(file)),
  /* handleFileDrop: (callback) => {
    window.addEventListener('drop', (e) => {
      e.preventDefault()
      const files = Array.from(e.dataTransfer.files).map(f => ({
        path: f.path, // this works in preload context
        name: f.name
      }))
      callback(files)
    })

    window.addEventListener('dragover', (e) => e.preventDefault())
  }, */

  /* dropFiles: async (callbackName) => {
    // Listen for files from renderer drop
    ipcRenderer.on('files-dropped', async (_event, files) => {
      // Call the callback from renderer
      window[callbackName]?.(files)
    })
  },
  sendDroppedFiles: (files) => {
    ipcRenderer.send('files-dropped', files)
  } */

  convertHtmlToDocx: (inputPath, outputPath) =>
    ipcRenderer.invoke('convert-docx', inputPath, outputPath),
  // ipcRenderer.invoke('convert-html-to-docx', inputPath, outputPath),

  convertDocxToHtml: (inputPath, outputPath) =>
    ipcRenderer.invoke('convert-docx', inputPath, outputPath),
  // ipcRenderer.invoke('convert-docx-to-html', inputPath, outputPath),

  convertPptxToPresentation: (inputPath, outputPath) =>
    ipcRenderer.invoke('convert-pptx', inputPath, outputPath),

  latexCompile: async (inputPath: string) => ipcRenderer.invoke('latex:compile', inputPath),

  latexSaveTempTex: (content: string) => ipcRenderer.invoke('latex:save-temp-tex', content),

  latexProjectInit: (payload: { projectDir: string; title?: string }) =>
    ipcRenderer.invoke('latex:project:init', payload),
  latexProjectList: (projectDir: string) => ipcRenderer.invoke('latex:project:list', projectDir),
  latexProjectRead: (filePath: string) => ipcRenderer.invoke('latex:project:read', filePath),
  latexProjectWrite: (filePath: string, content: string) =>
    ipcRenderer.invoke('latex:project:write', filePath, content),
  latexProjectWatch: (payload: { projectId: string; projectDir: string }) =>
    ipcRenderer.invoke('latex:project:watch', payload),
  latexProjectUnwatch: (projectId: string) =>
    ipcRenderer.invoke('latex:project:unwatch', projectId),
  latexProjectCompile: (payload: { projectId: string; texFilePath: string }) =>
    ipcRenderer.invoke('latex:project:compile', payload),
  spreadsheetGetCell: (payload: { path: string; cellRef: string }) =>
    ipcRenderer.invoke('spreadsheet:get-cell', payload),
  spreadsheetGetCells: (payload: { requests: Array<{ path: string; cellRef: string }> }) =>
    ipcRenderer.invoke('spreadsheet:get-cells', payload),
  spreadsheetWatch: (payload: { path: string }) => ipcRenderer.invoke('spreadsheet:watch', payload),
  spreadsheetUnwatch: (payload: { path: string }) =>
    ipcRenderer.invoke('spreadsheet:unwatch', payload),
  spreadsheetAtomicWrite: (payload: { path: string; data: string | Buffer }) =>
    ipcRenderer.invoke('spreadsheet:atomic-write', payload),
  onSpreadsheetFileChanged: (callback: (payload: { path: string }) => void) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('spreadsheet:file-changed', handler)
    return () => ipcRenderer.removeListener('spreadsheet:file-changed', handler)
  },
  onLatexProjectChanged: (callback: (payload: any) => void) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('latex:project:changed', handler)
    return () => ipcRenderer.removeListener('latex:project:changed', handler)
  },
  onLatexCompileLog: (callback: (payload: any) => void) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('latex:compile:log', handler)
    return () => ipcRenderer.removeListener('latex:compile:log', handler)
  },
  onLatexCompileDone: (callback: (payload: any) => void) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('latex:compile:done', handler)
    return () => ipcRenderer.removeListener('latex:compile:done', handler)
  },
  onLatexCompileError: (callback: (payload: any) => void) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('latex:compile:error', handler)
    return () => ipcRenderer.removeListener('latex:compile:error', handler)
  },

  exportToPDF: (content: any, outputPath?: string) =>
    ipcRenderer.invoke('export-to-pdf', content, outputPath),
  clipboard: {
    readText: () => clipboard.readText(),
    readHTML: () => clipboard.readHTML(),
    readImageDataUrl: () => {
      const image = clipboard.readImage()
      return image.isEmpty() ? null : image.toDataURL()
    },
    readFilePaths: () => readClipboardFilePaths(),
    write: (payload: { text?: string; html?: string; imageDataUrl?: string }) => {
      const data: { text?: string; html?: string; image?: Electron.NativeImage } = {}
      if (payload.text) data.text = payload.text
      if (payload.html) data.html = payload.html
      if (payload.imageDataUrl) {
        data.image = nativeImage.createFromDataURL(payload.imageDataUrl)
      }
      clipboard.write(data)
      return true
    }
  },

  browser: {
    createTab: (url?: string) => ipcRenderer.invoke('browser:create-tab', url),
    closeTab: (id: string) => ipcRenderer.invoke('browser:close-tab', id),
    activateTab: (id: string) => ipcRenderer.invoke('browser:activate-tab', id),
    navigate: (id: string, url: string) => ipcRenderer.invoke('browser:navigate', { id, url }),
    reload: (id: string) => ipcRenderer.invoke('browser:reload', id),
    goBack: (id: string) => ipcRenderer.invoke('browser:back', id),
    goForward: (id: string) => ipcRenderer.invoke('browser:forward', id),
    setBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke('browser:set-bounds', bounds),
    setVisible: (visible: boolean) => ipcRenderer.invoke('browser:set-visible', visible),
    listTabs: () => ipcRenderer.invoke('browser:list-tabs'),
    queryHistory: (query: string) => ipcRenderer.invoke('browser:history-query', query),
    respondPermission: (requestId: string, allow: boolean) =>
      ipcRenderer.invoke('browser:permission-response', { requestId, allow }),
    onTabsChanged: (callback: (tabs: any[]) => void) =>
      ipcRenderer.on('browser:tabs-changed', (_event, tabs) => callback(tabs)),
    onTabUpdated: (callback: (tab: any) => void) =>
      ipcRenderer.on('browser:tab-updated', (_event, tab) => callback(tab)),
    onTabRemoved: (callback: (tabId: string) => void) =>
      ipcRenderer.on('browser:tab-removed', (_event, tabId) => callback(tabId)),
    onDownloadUpdate: (callback: (payload: any) => void) =>
      ipcRenderer.on('browser:download-updated', (_event, payload) => callback(payload)),
    onPermissionRequest: (callback: (payload: any) => void) =>
      ipcRenderer.on('browser:permission-request', (_event, payload) => callback(payload)),
    onInsertText: (callback: (payload: { text: string }) => void) =>
      ipcRenderer.on('browser:insert-text', (_event, payload) => callback(payload)),
    onVarInput: (callback: (payload: any) => void) =>
      ipcRenderer.on('browser:var-input', (_event, payload) => callback(payload)),
    onVarInputKey: (callback: (payload: { key: string; tabId: string }) => void) =>
      ipcRenderer.on('browser:var-input-key', (_event, payload) => callback(payload)),
    insertVarText: (payload: { tabId: string; text: string }) =>
      ipcRenderer.send('browser:var-insert', payload)
  },
  embedded: {
    create: (payload: {
      id: string
      url: string
      preloadPath?: string
      partition?: string
      userAgent?: string
      permissions?: string[]
    }) => ipcRenderer.invoke('embedded:create', payload),
    setBounds: (payload: {
      id: string
      bounds: { x: number; y: number; width: number; height: number }
    }) => ipcRenderer.invoke('embedded:set-bounds', payload),
    setVisible: (payload: { id: string; visible: boolean }) =>
      ipcRenderer.invoke('embedded:set-visible', payload),
    destroy: (id: string) => ipcRenderer.invoke('embedded:destroy', id),
    navigate: (payload: { id: string; url: string }) =>
      ipcRenderer.invoke('embedded:navigate', payload),
    executeJavaScript: (payload: { id: string; script: string }) =>
      ipcRenderer.invoke('embedded:execute-js', payload),
    insertCSS: (payload: { id: string; css: string }) =>
      ipcRenderer.invoke('embedded:insert-css', payload),
    openDevTools: (id: string) => ipcRenderer.invoke('embedded:open-devtools', id),
    focus: (id: string) => ipcRenderer.invoke('embedded:focus', id),
    setZ: (payload: { id: string; zIndex: number }) =>
      ipcRenderer.invoke('embedded:set-z', payload),
    onEvent: (callback: (payload: any) => void) => {
      const handler = (_event: any, payload: any) => callback(payload)
      ipcRenderer.on('embedded:event', handler)
      return () => ipcRenderer.removeListener('embedded:event', handler)
    },
    onVarInput: (callback: (payload: any) => void) =>
      ipcRenderer.on('embedded:var-input', (_event, payload) => callback(payload)),
    onVarInputKey: (callback: (payload: { key: string; id: string }) => void) =>
      ipcRenderer.on('embedded:var-input-key', (_event, payload) => callback(payload)),
    insertVarText: (payload: { id: string; text: string }) =>
      ipcRenderer.send('embedded:var-insert', payload)
  },
  overlay: {
    setVisible: (payload: { visible: boolean }) =>
      ipcRenderer.invoke('overlay:set-visible', payload)
  },

  openDialogFile: (filters) => ipcRenderer.invoke('dialog:openFile', filters),
  openDialogFiles: (filters) => ipcRenderer.invoke('dialog:openFiles', filters),

  saveDialogFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  openDialogDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  printFile: (filePath: string, options?: any) =>
    ipcRenderer.invoke('print-file', { filePath, options }),
  loadSystemFont: () => ipcRenderer.invoke('load-system-font')
}

const server = {
  ai: {
    generate(payloadOrPrompt, requestId) {
      return ipcRenderer.invoke('ai:generate', payloadOrPrompt, requestId)
    },
    onChunk(callback) {
      const listener = (_event, data) => callback(data)
      ipcRenderer.on('ai:chunk', listener)
      return () => ipcRenderer.removeListener('ai:chunk', listener)
    },
    onDone(callback) {
      const listener = (_event, data) => callback(data)
      ipcRenderer.on('ai:done', listener)
      return () => ipcRenderer.removeListener('ai:done', listener)
    },
    abort() {
      ipcRenderer.send('ai:abort')
    }
  },
  chat: {
    listSessions() {
      return ipcRenderer.invoke('chat:sessions:list')
    },
    getSession(payload: { sessionId: string }) {
      return ipcRenderer.invoke('chat:sessions:get', payload)
    },
    upsertSession(payload: Record<string, any>) {
      return ipcRenderer.invoke('chat:sessions:upsert', payload)
    },
    deleteSession(payload: { sessionId: string }) {
      return ipcRenderer.invoke('chat:sessions:delete', payload)
    }
  },
  drive: {
    getRoot() {
      return ipcRenderer.invoke('drive:get-root')
    },
    listDir(payload: { rootPath?: string; path?: string; query?: string; sort?: boolean }) {
      return ipcRenderer.invoke('drive:list', payload)
    },
    openItem(payload: { rootPath?: string; path: string }) {
      return ipcRenderer.invoke('drive:open-item', payload)
    },
    mkdir(payload: { path: string }) {
      return ipcRenderer.invoke('drive:mkdir', payload)
    },
    uploadFiles(payload: { path?: string; localPaths: string[] }) {
      return ipcRenderer.invoke('drive:upload', payload)
    },
    downloadItem(payload: { path: string; saveTo?: string }) {
      return ipcRenderer.invoke('drive:download', payload)
    },
    deleteItem(payload: { path: string }) {
      return ipcRenderer.invoke('drive:delete-item', payload)
    },
    moveItem(payload: { from: string; to: string }) {
      return ipcRenderer.invoke('drive:move-item', payload)
    },
    copyItem(payload: { from: string; to: string }) {
      return ipcRenderer.invoke('drive:copy-item', payload)
    },
    shareItem(payload: {
      path: string
      source?: 'drive' | 'disk'
      docUuid?: string
      name?: string
      targetType?: 'document' | 'file' | 'folder'
      public?: boolean
      publicRole?: 'viewer' | 'commenter' | 'editor'
      password?: string
      expiresAt?: string
      permissions?: Array<{
        subjectType: 'user' | 'email' | 'org' | 'team'
        subjectId: string
        role: 'viewer' | 'commenter' | 'editor' | 'owner'
        email?: string
      }>
    }) {
      return ipcRenderer.invoke('drive:share', payload)
    },
    listShares() {
      return ipcRenderer.invoke('drive:shares')
    },
    getShare(payload: { path: string }) {
      return ipcRenderer.invoke('drive:get-share', payload)
    },
    revokeShare(payload: { shareId: string }) {
      return ipcRenderer.invoke('drive:revoke-share', payload)
    },
    syncDoc(payload: { cachePath: string }) {
      return ipcRenderer.invoke('drive:sync-doc', payload)
    }
  },
  share: {
    resolve(payload: { shareId?: string; docUuid?: string; name?: string; password?: string }) {
      return ipcRenderer.invoke('share:resolve', payload)
    },
    download(payload: {
      shareId?: string
      docUuid?: string
      name?: string
      password?: string
      path?: string
      saveTo?: string
    }) {
      return ipcRenderer.invoke('share:download', payload)
    },
    audit(payload: { shareId: string; action?: string }) {
      return ipcRenderer.invoke('share:audit', payload)
    },
    auditList(payload: { shareId: string; limit?: number }) {
      return ipcRenderer.invoke('share:audit-list', payload)
    },
    rotate(payload: { shareId: string }) {
      return ipcRenderer.invoke('share:rotate', payload)
    },
    editLock(payload: {
      shareId: string
      enabled?: boolean
      lockMinutes?: number
      lockUntil?: string
      reason?: string
    }) {
      return ipcRenderer.invoke('share:edit-lock', payload)
    },
    principals(payload: { q?: string; query?: string }) {
      return ipcRenderer.invoke('share:principals', payload)
    }
  },
  sync: {
    start(payload: { cachePath: string }) {
      return ipcRenderer.invoke('sync:start', payload)
    },
    stop(payload: { cachePath: string }) {
      return ipcRenderer.invoke('sync:stop', payload)
    },
    open(payload: { cachePath: string }) {
      return ipcRenderer.invoke('sync:open', payload)
    },
    commit(payload: { cachePath: string }) {
      return ipcRenderer.invoke('sync:commit', payload)
    },
    history(payload: { uuid: string }) {
      return ipcRenderer.invoke('sync:history', payload)
    },
    rollback(payload: { uuid: string; path: string; timestamp: string }) {
      return ipcRenderer.invoke('sync:rollback', payload)
    },
    rename(payload: { from: string; to: string }) {
      return ipcRenderer.invoke('sync:rename', payload)
    }
  },
  auth: {
    signIn(payload?: { org?: string }) {
      return ipcRenderer.invoke('auth:signin', payload)
    },
    signUp(payload?: { org?: string }) {
      return ipcRenderer.invoke('auth:signup', payload)
    },
    register(payload?: { org?: string }) {
      return ipcRenderer.invoke('auth:register', payload)
    },
    joinInvite(payload: { code: string }) {
      return ipcRenderer.invoke('auth:join-invite', payload)
    },
    getSession(payload?: { org?: string }) {
      return ipcRenderer.invoke('auth:get-session', payload)
    },
    forceRefresh(payload?: { org?: string }) {
      return ipcRenderer.invoke('auth:force-refresh', payload)
    },
    getDeviceId() {
      return ipcRenderer.invoke('auth:device-id')
    },
    listSessions() {
      return ipcRenderer.invoke('auth:list-sessions')
    },
    setActiveOrg(payload: { org: string }) {
      return ipcRenderer.invoke('auth:set-active-org', payload)
    },
    logout(payload?: { org?: string }) {
      return ipcRenderer.invoke('auth:logout', payload)
    },
    onSessionChanged(callback) {
      const listener = (_event, session) => callback(session)
      ipcRenderer.on('auth:session-changed', listener)
      return () => ipcRenderer.removeListener('auth:session-changed', listener)
    }
  },
  forms: {
    submit(payload: any) {
      return ipcRenderer.invoke('forms:submit', payload)
    },
    list(payload: { docUuid: string }) {
      return ipcRenderer.invoke('forms:list', payload)
    },
    get(payload: { docUuid: string; submissionId: string }) {
      return ipcRenderer.invoke('forms:get', payload)
    },
    history(payload: { docUuid: string; responderId: string }) {
      return ipcRenderer.invoke('forms:history', payload)
    }
  },
  fonts: {
    resolve(payload: { fonts: string[]; platform?: string; locale?: string }) {
      return ipcRenderer.invoke('fonts:resolve', payload)
    }
  },
  mattermost: {
    prepareSession() {
      return ipcRenderer.invoke('mattermost:prepare')
    }
  },
  jitsi: {
    getJoinUrl(payload: { room: string }) {
      return ipcRenderer.invoke('jitsi:get-join-url', payload)
    }
  },
  dify: {
    uploadDocuments(payload: {
      localPaths: string[]
      datasetId?: string
      indexingTechnique?: string
      processRule?: any
      data?: any
    }) {
      return ipcRenderer.invoke('dify:upload-documents', payload)
    },
    listDatasets(payload?: { page?: number; limit?: number; scope?: string }) {
      return ipcRenderer.invoke('dify:list-datasets', payload)
    },
    onUploadProgress(
      callback: (payload: {
        file: string
        index: number
        total: number
        percent: number
        status: string
      }) => void
    ) {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('dify:upload-progress', listener)
      return () => ipcRenderer.removeListener('dify:upload-progress', listener)
    }
  }
}

const terminal = {
  // Send user input from renderer -> main (to write to pty)
  /* sendInput: (data) => ipcRenderer.send('terminal-input', data),

  // Listen for PTY output from main -> renderer
  onOutput: (callback) => {
    ipcRenderer.removeAllListeners('terminal-output')
    ipcRenderer.on('terminal-output', (_, data) => callback(data))
  } */

  open: (folderPath) => ipcRenderer.invoke('terminal-open', folderPath),
  // Send user input from renderer -> main (to write to pty)
  sendInput: (payload) => ipcRenderer.send('terminal-input', payload),
  // Listen for PTY output from main -> renderer
  onOutput: (callback) => {
    ipcRenderer.removeAllListeners('terminal-output')
    ipcRenderer.on('terminal-output', (_, msg) => callback(msg))
  },
  onClosed: (callback) => {
    ipcRenderer.on('terminal-closed', (_, msg) => callback(msg))
  },
  kill: (id) => ipcRenderer.send('terminal-kill', id)
}

const presentationAPI = {
  getInitialData: () => {
    return ipcRenderer.invoke('presentation:get-initial-data')
  },
  sendData: (ipcKey: string, payload: string, cb?: (payload: PresentationPayload) => void) => {
    ipcRenderer.send(ipcKey, payload)
    // => cb(payload);
  },
  onData: (cb: (payload: PresentationPayload) => void) => {
    ipcRenderer.on(IPC_PRESENTATION_DATA, (_, payload) => cb(payload))
  },

  /** listen for updates from main */
  onUpdate: (cb: (payload: PresentationPayload) => void) => {
    ipcRenderer.on(IPC_PRESENTATION_UPDATE, (_, payload) => cb(payload))
  },

  navigate: (index: number) => {
    ipcRenderer.send(IPC_PRESENTATION_NAVIGATE, index)
  },

  focusOnPresentationWindow: () => {
    ipcRenderer.send(IPC_PRESENTATION_WINDOW_FOCUS)
  },

  stop: (scope: 'presenter' | 'all' = 'presenter') => {
    ipcRenderer.send(IPC_PRESENTATION_STOP, scope)
  }
}

const meetingAPI = {
  /* openMeeting: (url: string) =>
   ipcRenderer.invoke('meeting:open', url),
   onShowScreenPicker(callback) {
     ipcRenderer.on('meeting:show-screen-picker', (_, data) => callback(data))
   }, */

  // Open a meeting window
  openMeeting: (url) => ipcRenderer.invoke('meeting:open', url),

  // Renderer receives list of screen sources to show picker modal
  onShowScreenPicker(callback) {
    ipcRenderer.on('meeting:show-screen-picker', (_, sources) => callback(sources))
  },

  // Renderer sends selected screen ID back to main
  selectScreenSource: (sourceId) => ipcRenderer.send('meeting:screen-source-selected', sourceId),

  // Toolbar events
  onToolbarEvent(callback) {
    ipcRenderer.on('meeting:toolbar-event', (_, data) => callback(data))
  },

  onStart: (callback) => {
    ipcRenderer.on(IPC_MEETING_START, (_, url) => callback(url))
  },
  getInitialUrl: () => ipcRenderer.invoke('meeting:get-initial-url'),

  // Laser pointer: start
  startLaser: () => ipcRenderer.send('meeting:laser-start'),

  // Laser pointer: stop
  stopLaser: () => ipcRenderer.send('meeting:laser-stop'),

  // Renderer receives cursor updates from main
  onLaserCursorUpdate(callback) {
    ipcRenderer.on('meeting:update-cursor', (_, point) => callback(point))
  },

  // Laser Control (Sent from Toolbar)
  toggleLaser: (isActive) => ipcRenderer.send('meeting:toggle-laser', isActive),
  toggleSpotlight: (isActive) => ipcRenderer.send('meeting:toggle-spotlight', isActive),

  // Laser Updates (Received by the Overlay Window)
  onLaserToggle: (callback) => {
    console.log('meetingAPI.toggleLaser send', { callback })

    ipcRenderer.on('meeting:set-laser-active', (_, active) => callback(active))
  },
  onSpotlightToggle: (callback) => {
    ipcRenderer.on('meeting:set-spotlight-active', (_, active) => callback(active))
  },

  // Call this from the Floating Toolbar button
  stopSharing: () => ipcRenderer.send('meeting:stop-sharing'),

  // Call this from the Meeting Shell to tell the webview to stop
  onStopStream: (callback) => {
    ipcRenderer.on('meeting:stream-stop-request', () => callback())
  },

  // Precise Cursor Tracking
  // onLaserCursorUpdate: (callback) => {
  //   ipcRenderer.on('meeting:update-cursor', (_, point) => callback(point));
  // },

  // Cleanup listeners to prevent memory leaks in Svelte
  removeMeetingListeners: () => {
    ipcRenderer.removeAllListeners('meeting:update-cursor')
    ipcRenderer.removeAllListeners('meeting:set-laser-active')
    ipcRenderer.removeAllListeners('meeting:set-spotlight-active')
  },

  toggleMic: (isMuted) => ipcRenderer.send('meeting:toggle-mic', isMuted),

  toggleAnnotations: (active) => ipcRenderer.send('meeting:toggle-annotations', active),

  // Innovative: On-screen Zoom/Magnifier
  toggleMagnifier: (active) => ipcRenderer.send('meeting:toggle-magnifier', active),

  // Listener for the Meeting Shell to handle MiroTalk internal mute
  onMicAction: (callback) => {
    ipcRenderer.on('meeting:mic-action', (_, isMuted) => callback(isMuted))
  }
}

const processInfo = {
  processInfo: electronProcess.platform
}

const existsAsync = async (targetPath: string) => {
  try {
    await fs.promises.access(targetPath)
    return true
  } catch {
    return false
  }
}

const node = {
  fs: {
    readFile: fs.readFile,
    readFileSync: fs.readFileSync,
    existsSync: fs.existsSync,
    exists: fs.existsSync,
    writeFile: fs.writeFile,
    writeFileSync: fs.writeFileSync,
    mkdirSync: fs.mkdirSync,
    readdirSync: fs.readdirSync,
    readdir: fs.readdir,
    lstatSync: fs.lstatSync,
    statSync: fs.statSync,
    rmSync: fs.rmSync,
    unlinkSync: fs.unlinkSync,
    rmdirSync: fs.rmdirSync
    // Add only what you need
  },
  fsPromises: {
    readFile: fs.promises.readFile,
    writeFile: fs.promises.writeFile,
    readdir: fs.promises.readdir,
    mkdir: fs.promises.mkdir,
    stat: fs.promises.stat,
    lstat: fs.promises.lstat,
    copyFile: fs.promises.copyFile,
    rename: fs.promises.rename,
    open: fs.promises.open,
    rm: fs.promises.rm,
    unlink: fs.promises.unlink,
    rmdir: fs.promises.rmdir,
    exists: existsAsync
    // Add only what you need
  },
  path: {
    join: path.join,
    basename: path.basename,
    extname: path.extname,
    dirname: path.dirname,
    resolve: path.resolve,
    relative: path.relative,
    sep: path.sep,
    parse: path.parse,
    isAbsolute: path.isAbsolute,
    normalize: path.normalize
    // Be selective here too
  },
  os: {
    homedir: os.homedir,
    tmpdir: os.tmpdir
  }
}
const electronAPI = {
  sendToMain: (channel, data) => ipcRenderer.send(channel, data),
  onFromMain: (channel, callback) => ipcRenderer.on(channel, (_, data) => callback(data))
}

// Expose the preload surface over `contextBridge` when context isolation is
// enabled, otherwise assign it to the DOM global.
//
// Both branches must carry the same names under the same keys. The renderer
// reads these as bare identifiers declared in index.d.ts, which resolve to
// `window.*`, so a name present in only one branch silently becomes
// undefined the moment the windows turn context isolation on. The condition
// used to be `if (false)`, which meant the bridge branch was never taken and
// drifted out of step with the branch that was: it was missing `server` and
// `__platform`, and carried an `electronAPI` the other did not.
//
// `node` is still exposed here. Removing it is Block A of SPEC-001 and needs
// an IPC filesystem surface to exist first: the renderer reaches it through
// the `nodeApi` Proxy in src/renderer/src/utils/shims/node.ts, which on
// Electron resolves to `window.node` and has no IPC-backed equivalent yet.
// Read `contextIsolated` off the global `process`, which Electron augments in
// the preload, and not off the `process` namespace import: referencing that
// namespace at runtime keeps it in the bundle, and the interop helper the
// bundler emits for it throws on Node's `process` module, which aborts the
// whole preload and leaves the renderer with no bridge at all.
if (process.contextIsolated) {
  // One try per name, and `node` first.
  //
  // A single try around all eight means an exception on any one of them drops
  // every name after it, and the renderer has no way to tell that from a name
  // that was never meant to be there. Losing `node` is the worst of those: the
  // renderer's nodeApi shim then falls back to a set of no-op `fs` methods, so
  // file writes quietly do nothing instead of failing. It goes first, and each
  // name stands on its own.
  //
  // Deliberately not rethrown: throwing here aborts the preload and leaves the
  // renderer with no bridge at all, which is worse than a named gap. The names
  // are asserted by tests/smoke/preload-bridge.test.mjs, which is what turns a
  // gap into a red build rather than a silent one.
  for (const [name, value] of [
    ['node', node],
    ['__platform', 'desktop'],
    ['api', api],
    ['electronAPI', electronAPI],
    ['terminal', terminal],
    ['server', server],
    ['presentationAPI', presentationAPI],
    ['meetingAPI', meetingAPI]
  ] as [string, unknown][]) {
    try {
      contextBridge.exposeInMainWorld(name, value)
    } catch (error) {
      console.error(`[preload] failed to expose "${name}" through contextBridge:`, error)
    }
  }
} else {
  // @ts-ignore (define in dts)
  window.__platform = 'desktop'
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.electronAPI = electronAPI
  // @ts-ignore (define in dts)
  window.terminal = terminal
  // @ts-ignore (define in dts)
  window.server = server
  // @ts-ignore (define in dts)
  window.presentationAPI = presentationAPI
  // @ts-ignore (define in dts)
  window.meetingAPI = meetingAPI
  // @ts-ignore (define in dts)
  window.node = node
}
