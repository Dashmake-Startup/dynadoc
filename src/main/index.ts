import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  screen,
  Menu,
  nativeImage,
  dialog,
  protocol,
  net,
  desktopCapturer,
  systemPreferences,
  session,
  WebContentsView,
  nativeTheme
} from 'electron'
import { grantDialogResult, grantUserChosenPath, requirePath } from './ipc/filesystemPolicyHost'
import { registerFilesystemIpc } from './ipc/filesystem'
import { handleDocumentAssetProtocol, registerDocumentAssetScheme } from './protocol/documentAssets'
import { bundleUrl } from './protocol/documentAssetRequest'
import { pathToFileURL } from 'url'
import { TabManager } from './browser/TabManager'
import { EmbeddedViewManager } from './browser/EmbeddedViewManager'
import { join } from 'path'
import fs from 'fs'
import os from 'os'
// import fs from 'fs/promises'
import path from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
// import icon from '../../resources/icon.png'
import icon from '../../resources/img/icon.png?asset'

// Before app.whenReady(), and it has to stay there: privileges registered
// afterwards are ignored, and the symptom is not an error but a scheme that
// quietly has no origin and refuses fetch().
registerDocumentAssetScheme()
// Other font manager package https://github.com/oldj/node-font-list

// import fontManager from 'fontmanager-redux'
import { getFonts, getFonts2, type IFontInfo } from 'font-list'

// import { rollup } from 'rollup';
// import svelte from 'rollup-plugin-svelte';
// import resolve from '@rollup/plugin-node-resolve';
// import commonjs from '@rollup/plugin-commonjs';
// import css from 'rollup-plugin-css-only';

import { pipeline } from 'stream'
import { promisify } from 'util'
import { Worker } from 'worker_threads'
import { SpreadsheetManager } from './managers/SpreadsheetManager'

import chokidar from 'chokidar'
import { readFile, stat, readdir } from 'fs/promises'
import { debounce } from 'lodash'
import * as https from 'https'
// import * as unzipper from 'unzipper'
import * as yauzl from 'yauzl'
import * as mkdirp from 'mkdirp'

import Utils from './utils/Utils'
import { spawn as nodePtySpawn } from 'node-pty' // or 'node-pty-prebuilt-multiarch'

import { spawn, execFile, exec } from 'child_process'
// const { spawn, execFile, exec } = require('child_process')

// electron-backend.js (or main process)
import http from 'http'
import WebSocket, { WebSocketServer } from 'ws'
import SecurityHelpers from './utils/SecurityHelpers'
import {
  isAllowedExternalUrl,
  isAppOwnUrl,
  isExecutablePath,
  parseUrl
} from './utils/ExternalOpenPolicy'
import {
  IPC_MEETING_DATA,
  IPC_MEETING_START,
  IPC_PRESENTATION_DATA,
  IPC_PRESENTATION_NAVIGATE,
  IPC_PRESENTATION_START,
  IPC_PRESENTATION_STOP,
  IPC_PRESENTATION_UPDATE,
  IPC_PRESENTATION_WINDOW_FOCUS,
  PresentationPayload
} from '../renderer/src/shared/ipc'
// import setupWSConnection from "y-websocket/bin/utils.js"

// Prevent Chromium from suspending or discarding the renderer when the window is occluded.
// This reduces unexpected reloads after lid-close / display-off events.
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')

// const wysiwygEditorCollaborationServerProcess = null

/* const wysiwygEditorCollaborationServerProcess = spawn(
  'npx',
  ['y-websocket-server', '--port', '1234'], // For collaorative wysiwyg editor
  {
    stdio: 'inherit'
  }
)
const imageEditorCollaborationServerProcess = spawn(
  'npx',
  ['y-websocket-server', '--port', '1235'], // For collaorative image editor
  {
    stdio: 'inherit'
  }
) */

// const startLoading = Date.now();

let _meetingLaserWindow: BrowserWindow | null = null
let _meetingSharingToolbar: BrowserWindow | null = null
let _meetingWindow: BrowserWindow | null = null
const _spreadsheetManager = new SpreadsheetManager()
let _presentationWindow: BrowserWindow | null = null
let _presenterWindow: BrowserWindow | null = null
let _splashWindow: BrowserWindow | null = null
let _cachedPayload: PresentationPayload | null = null
let _recentMenuEntries: { label: string; path: string; parentPath?: string | null }[] = []
let _allowWindowClose = false
let _closeRequestInFlight = false

/**
 * Hands a URL to the OS only when its scheme is one the product uses.
 *
 * The URL may come from document content, so the refusal logs the scheme
 * alone and never the URL itself.
 */
const openExternalIfAllowed = (value: unknown): boolean => {
  const parsed = parseUrl(value)
  if (!parsed) {
    console.warn('[external-open] refused a malformed URL')
    return false
  }
  if (!isAllowedExternalUrl(parsed.href)) {
    console.warn(`[external-open] refused scheme ${parsed.protocol}`)
    return false
  }
  void shell.openExternal(parsed.href)
  return true
}

const sendMenuAction = (id: string) => {
  const target = BrowserWindow.getFocusedWindow() || _mainWindow
  if (!target || target.isDestroyed()) return
  target.webContents.send('invoke-menu-action', id)
}

const requestMainWindowClose = (reason: 'window-close' | 'app-quit' = 'app-quit') => {
  if (!_mainWindow || _mainWindow.isDestroyed()) {
    _allowWindowClose = true
    app.quit()
    return
  }
  if (_mainWindow.webContents.isLoadingMainFrame() || !_mainWindow.webContents.getURL()) {
    _allowWindowClose = true
    app.quit()
    return
  }
  if (_allowWindowClose || _closeRequestInFlight) return
  _closeRequestInFlight = true
  _mainWindow.webContents.send('app:close-requested', { reason })
}

const normalizeExtractedDocumentRoot = async (targetPath: string) => {
  try {
    const stats = await fsp.stat(targetPath)
    if (!stats.isDirectory()) return targetPath
    const entries = await fsp.readdir(targetPath, { withFileTypes: true })
    const dirs = entries.filter((entry) => entry.isDirectory())
    const files = entries.filter((entry) => entry.isFile())
    if (dirs.length === 1 && files.length === 0) {
      return path.join(targetPath, dirs[0].name)
    }
  } catch {
    // keep the original target when normalization is not possible
  }
  return targetPath
}

const buildAppMenu = () => {
  const isMac = process.platform === 'darwin'
  const template: any[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              {
                label: 'Preferences…',
                accelerator: 'CmdOrCtrl+,',
                click: () => sendMenuAction('app:preferences')
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              {
                label: 'Quit',
                accelerator: 'CmdOrCtrl+Q',
                click: () => requestMainWindowClose('app-quit')
              }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('file:new') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('file:open') },
        {
          label: 'Open Recent',
          submenu: [
            ...(_recentMenuEntries.length
              ? _recentMenuEntries.map((entry) => ({
                  label: entry.label,
                  click: () =>
                    sendMenuAction(
                      `file:open-recent|${encodeURIComponent(entry.path)}|${encodeURIComponent(
                        entry.parentPath || ''
                      )}`
                    )
                }))
              : [{ label: 'No Recent Files', enabled: false }]),
            { type: 'separator' },
            {
              label: 'Clear Recent',
              click: () => sendMenuAction('file:open-recent-clear')
            }
          ]
        },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('file:save') },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuAction('file:save-as')
        },
        {
          label: 'Save All',
          accelerator: 'CmdOrCtrl+Alt+S',
          click: () => sendMenuAction('file:save-all')
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            { label: 'PDF', click: () => sendMenuAction('file:export-pdf') },
            { label: 'Word (.docx)', click: () => sendMenuAction('file:export-docx') },
            { label: 'Excel (.xlsx)', click: () => sendMenuAction('file:export-xlsx') },
            { label: 'Picture', click: () => sendMenuAction('file:export-picture') },
            { label: 'Selection', click: () => sendMenuAction('file:export-selection') },
            { label: 'Tables', click: () => sendMenuAction('file:export-tables') }
          ]
        },
        { label: 'Share…', click: () => sendMenuAction('file:share') },
        { label: 'Print…', click: () => sendMenuAction('file:print') },
        { type: 'separator' },
        { label: 'Close', accelerator: 'CmdOrCtrl+W', click: () => sendMenuAction('file:close') },
        ...(isMac
          ? []
          : [
              { type: 'separator' },
              {
                label: 'Quit',
                accelerator: 'Alt+F4',
                click: () => requestMainWindowClose('app-quit')
              }
            ])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find…', accelerator: 'CmdOrCtrl+F', click: () => sendMenuAction('edit:find') },
        {
          label: 'Replace…',
          accelerator: 'CmdOrCtrl+H',
          click: () => sendMenuAction('edit:replace')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        {
          label: 'Toggle Ribbon',
          accelerator: 'CmdOrCtrl+/',
          click: () => sendMenuAction('view:ribbon')
        },
        { label: 'Toggle Sidebar', click: () => sendMenuAction('view:sidebar') },
        { label: 'Focus Mode', click: () => sendMenuAction('view:focus') }
      ]
    },
    {
      label: 'Insert',
      submenu: [
        { label: 'Table', click: () => sendMenuAction('insert:table') },
        { label: 'Image', click: () => sendMenuAction('insert:image') },
        { label: 'Video', click: () => sendMenuAction('insert:video') },
        { label: 'Audio', click: () => sendMenuAction('insert:audio') },
        { label: 'Link', click: () => sendMenuAction('insert:link') },
        { label: 'Code Block', click: () => sendMenuAction('insert:codeblock') },
        { label: 'Equation', click: () => sendMenuAction('insert:equation') },
        { label: 'Slide', click: () => sendMenuAction('insert:slide') },
        { label: 'Spreadsheet', click: () => sendMenuAction('insert:spreadsheet') }
      ]
    },
    {
      label: 'Format',
      submenu: [
        { label: 'Bold', accelerator: 'CmdOrCtrl+B', click: () => sendMenuAction('format:bold') },
        {
          label: 'Italic',
          accelerator: 'CmdOrCtrl+I',
          click: () => sendMenuAction('format:italic')
        },
        {
          label: 'Underline',
          accelerator: 'CmdOrCtrl+U',
          click: () => sendMenuAction('format:underline')
        },
        { label: 'Strikethrough', click: () => sendMenuAction('format:strike') },
        { type: 'separator' },
        { label: 'Heading 1', click: () => sendMenuAction('format:h1') },
        { label: 'Heading 2', click: () => sendMenuAction('format:h2') },
        { label: 'Paragraph', click: () => sendMenuAction('format:paragraph') },
        { type: 'separator' },
        { label: 'Align Left', click: () => sendMenuAction('format:align-left') },
        { label: 'Align Center', click: () => sendMenuAction('format:align-center') },
        { label: 'Align Right', click: () => sendMenuAction('format:align-right') },
        { type: 'separator' },
        { label: 'Bullet List', click: () => sendMenuAction('format:bullet') },
        { label: 'Numbered List', click: () => sendMenuAction('format:ordered') }
      ]
    },
    {
      label: 'Review',
      submenu: [
        { label: 'Suggestion Mode', click: () => sendMenuAction('review:toggle') },
        { label: 'Add Comment', click: () => sendMenuAction('review:comment') },
        { type: 'separator' },
        { label: 'Accept Suggestion', click: () => sendMenuAction('review:accept') },
        { label: 'Reject Suggestion', click: () => sendMenuAction('review:reject') },
        { label: 'Next Suggestion', click: () => sendMenuAction('review:next') },
        { label: 'Previous Suggestion', click: () => sendMenuAction('review:prev') }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Word Count', click: () => sendMenuAction('tools:word-count') },
        { label: 'Translate', click: () => sendMenuAction('tools:translate') },
        { label: 'Spelling & Grammar', click: () => sendMenuAction('tools:spelling') },
        { label: 'Settings', click: () => sendMenuAction('tools:settings') }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? ([{ role: 'front' }] as Electron.MenuItemConstructorOptions[])
          : ([{ role: 'close' }] as Electron.MenuItemConstructorOptions[]))
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Help Center', click: () => sendMenuAction('help:docs') },
        { label: 'Report Issue', click: () => sendMenuAction('help:report') },
        { label: 'About', click: () => sendMenuAction('help:about') }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

ipcMain.handle(
  'app:close-response',
  async (_event, payload: { action?: 'cancel' | 'quit' } = {}) => {
    _closeRequestInFlight = false
    if (payload?.action === 'quit') {
      _allowWindowClose = true
      app.quit()
    }
  }
)

// Utility to start a Yjs WebSocket server
function startYWebsocketServer(port: number, name: string) {
  try {
    const server = http.createServer()
    const wss = new WebSocketServer({ server })

    /*  wss.on("connection", (ws, req) => {
       // The roomName can be dynamic or fixed
       const roomName = req.url?.slice(1) || name
       setupWSConnection(ws, req, { docName: roomName })
     }) */

    server.listen(port, () => {
      console.log(`✅ ${name} running at ws://localhost:${port}`)
    })

    return server
  } catch (error) {
    console.error(`Failed to run ${name} running at ws://localhost:${port}`, error)

    return null
  }
}

// Start servers for your editors
const _wysiwygEditorServer = startYWebsocketServer(1234, 'WYSIWYG Editor')
const _imageEditorServer = startYWebsocketServer(1235, 'Image Editor')

// const { app, BrowserWindow } = require('electron')
// const path = require('path')
// const fs = require('fs')
// const https = require('https')
// const { spawn } = require('child_process')
// const os = require('os')
// const unzipper = require('unzipper')

let _ltProcess

/* function getOSFolder() {
  switch (process.platform) {
    case 'win32':
      return 'win32'
    case 'darwin':
      return 'darwin'
    case 'linux':
      return 'linux'
    default:
      throw new Error(`Unsupported OS: ${process.platform}`)
  }
} */

// Download a file helper
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const file = fs.createWriteStream(dest)
      console.log('downloadFile...', url, dest)
      res.pipe(file)
      file.on('finish', () => {
        console.log('downloaded: finish', url, dest)
        file.close(resolve)
      })
      file.on('error', reject)
    })
  })
}
/* function downloadFile2(url, dest) {
  console.log('downloadFile:', url, dest)

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Handle redirect
          return https.get(res.headers.location, (res2) => {
            const file = fs.createWriteStream(dest)
            console.log('downloadFile...', url, dest)
            res2.pipe(file)

            file.on('finish', () => {
              // res2.pipe(fs.createWriteStream(dest)).on('finish', () => {
              console.log('Downloaded!')
              file.close(resolve)
            })
          })
        }

        res.pipe(fs.createWriteStream(dest)).on('finish', () => console.log('Downloaded!'))
      })
      .on('error', (err) => console.error('Download failed:', err))
  })
} */

// Unzip helper
/* function unzipFile(zipPath, dest) {
  return fs
    .createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: dest }))
    .promise()
} */

/* function unzipFileOld(zipPath, dest) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: dest }))
      .on('close', resolve)
      .on('error', reject)
  })
} */

// Unzip and rename top folder to "jre"
function unzipFile(zipPath, dest, newFolderName = 'jre') {
  return new Promise((resolve, reject) => {
    let topFolder = null // Will store the first folder we encounter

    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err)

      zipfile.readEntry()

      zipfile.on('entry', (entry) => {
        const entryPath = path.join(dest, entry.fileName)

        // Detect top-level folder
        if (!topFolder) {
          const parts = entry.fileName.split('/')
          if (parts.length > 1) topFolder = parts[0]
        }

        if (/\/$/.test(entry.fileName)) {
          // Directory
          mkdirp.sync(entryPath)
          zipfile.readEntry()
        } else {
          // File
          mkdirp.sync(path.dirname(entryPath))
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err)
            const writeStream = fs.createWriteStream(entryPath)
            readStream.pipe(writeStream)
            readStream.on('end', () => zipfile.readEntry())
          })
        }
      })

      zipfile.on('end', () => {
        if (topFolder) {
          const oldPath = path.join(dest, topFolder)
          const newPath = path.join(dest, newFolderName)

          if (fs.existsSync(oldPath)) {
            fs.rename(oldPath, newPath, (err) => {
              if (err) return reject(err)
              resolve(newPath)
            })
          } else {
            resolve(dest) // fallback
          }
        } else {
          resolve(dest) // no top folder detected
        }
      })

      zipfile.on('error', reject)
    })
  })
}

// Example usage
// ;(async () => {
//   const zipPath = '/tmp/jre.zip'
//   const dest =
//     '/path/to/dynadoc/out/main/resources/darwin'

//   try {
//     const extractedFolder = await unzipAndRenameTopFolder(zipPath, dest)
//     console.log('Unzipped and renamed top folder to:', extractedFolder)
//   } catch (err) {
//     console.error('Unzip failed:', err)
//   }
// })()

function getJavaBin(resourcePath) {
  // const binPathFile = path.join(resourcePath, 'jre', 'bin')
  const binPathFile = getBinaryPath(path.join('jre', 'bin'))

  if (!fs.existsSync(binPathFile)) {
    return ''
    // throw new Error(`bin path file does not exist: ${binPathFile}`)
  }

  // Read the relative path from the file
  const relativeBinPath = fs.readFileSync(binPathFile, 'utf-8').trim()

  // Construct full path to java executable
  /* const javaBin = path.join(
    resourcePath,
    'jre',
    relativeBinPath
    // process.platform === 'win32' ? 'java.exe' : 'java'
  ) */

  // const javaBin = binPathFile
  const javaBin = getBinaryPath(path.join('jre', relativeBinPath))

  if (!fs.existsSync(javaBin)) {
    throw new Error(`Java binary not found at ${javaBin}`)
  }

  return javaBin
}

/* function findJavaBinary(baseDir) {
  const target = process.platform === 'win32' ? 'java.exe' : 'java'
  const stack = [baseDir]
  while (stack.length) {
    const dir = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch { continue }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.name === target && full.includes(`${path.sep}bin${path.sep}`)) {
        return full
      }
    }
  }
  return null
} */

async function ensureJREOld(resourcePath) {
  console.log('ensureJRE called with resourcePath:', resourcePath)

  const javaBin = getJavaBin(resourcePath)
  // const javaBin = path.join(
  //   resourcePath,
  //   'jre',
  //   'bin',
  //   process.platform === 'win32' ? 'java.exe' : 'java'
  // )
  console.log('javaBin:', javaBin)
  if (fs.existsSync(javaBin))
    return path.join(javaBin, process.platform === 'win32' ? 'java.exe' : 'java')

  // Example: download lightweight Zulu Embedded OpenJDK
  let jreUrl
  if (process.platform === 'win32')
    // jreUrl = 'https://cdn.azul.com/zulu/bin/zulu17.50.19-ca-jre17.0.8-win_x64.zip'
    jreUrl = 'https://cdn.azul.com/zulu/bin/zulu25.28.85-ca-jre25.0.0-win_x64.zip'
  if (process.platform === 'darwin')
    // jreUrl = 'https://cdn.azul.com/zulu/bin/zulu17.50.19-ca-jre17.0.8-macosx_x64.zip'
    // jreUrl = 'https://cdn.azul.com/zulu/bin/zulu17.60.17-ca-jre17.0.16-macosx_x64.zip'
    jreUrl = 'https://cdn.azul.com/zulu/bin/zulu25.28.85-ca-jre25.0.0-macosx_x64.zip'
  if (process.platform === 'linux')
    // jreUrl = 'https://cdn.azul.com/zulu/bin/zulu17.50.19-ca-jre17.0.8-linux_x64.zip'
    jreUrl = 'https://cdn.azul.com/zulu/bin/zulu25.28.85-ca-jre25.0.0-linux_x64.zip'

  console.log('jreUrl:', jreUrl)
  const zipPath = path.join(os.tmpdir(), 'jre.zip')
  await downloadFile(jreUrl, zipPath)
  console.log('unzipFile finished:', zipPath, resourcePath)
  await unzipFile(zipPath, resourcePath)
  console.log('unzipFile:', zipPath, resourcePath)

  console.log('getJavaBin:', getJavaBin(resourcePath))
  // Assume unzip creates a folder with 'jre' inside
  return path.join(getJavaBin(resourcePath), process.platform === 'win32' ? 'java.exe' : 'java')
  // return path.join(resourcePath, 'jre', 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
}

async function ensureJRE(resourcePath) {
  console.log('ensureJRE called with resourcePath:', resourcePath)

  const javaExe = process.platform === 'win32' ? 'java.exe' : 'java'
  const javaBinDirect = getBinaryPath(path.join('jre', 'bin', javaExe))
  if (fs.existsSync(javaBinDirect)) {
    console.log('JRE already installed at:', javaBinDirect)
    return javaBinDirect
  }

  const javaBin = getJavaBin(resourcePath)
  console.log('javaBin:', javaBin)
  if (javaBin && fs.existsSync(path.join(javaBin, javaExe))) return path.join(javaBin, javaExe)

  // ARM64 macOS: mac-arm64 has no bundled JRE — fall back to mac (x64 via Rosetta 2)
  if (os.platform() === 'darwin' && os.arch() === 'arm64') {
    const macBase = app.isPackaged
      ? path.join(process.resourcesPath, 'bin', 'mac')
      : path.join(__dirname, '../../resources/bin/mac')
    const macManifest = path.join(macBase, 'jre', 'bin')
    if (fs.existsSync(macManifest) && !fs.statSync(macManifest).isDirectory()) {
      const relBinPath = fs.readFileSync(macManifest, 'utf-8').trim()
      const javaCandidate = path.join(macBase, 'jre', relBinPath, javaExe)
      if (fs.existsSync(javaCandidate)) {
        console.log('JRE: arm64 → mac/x64 fallback (Rosetta 2):', javaCandidate)
        return javaCandidate
      }
    }
  }

  // Example: download lightweight Zulu Embedded OpenJDK
  let jreUrl
  if (process.platform === 'win32')
    // jreUrl = 'https://cdn.azul.com/zulu/bin/zulu17.50.19-ca-jre17.0.8-win_x64.zip'
    jreUrl = 'https://cdn.azul.com/zulu/bin/zulu25.28.85-ca-jre25.0.0-win_x64.zip'
  if (process.platform === 'darwin')
    // jreUrl = 'https://cdn.azul.com/zulu/bin/zulu17.50.19-ca-jre17.0.8-macosx_x64.zip'
    // jreUrl = 'https://cdn.azul.com/zulu/bin/zulu17.60.17-ca-jre17.0.16-macosx_x64.zip'
    jreUrl = 'https://cdn.azul.com/zulu/bin/zulu25.28.85-ca-jre25.0.0-macosx_x64.zip'
  if (process.platform === 'linux')
    // jreUrl = 'https://cdn.azul.com/zulu/bin/zulu17.50.19-ca-jre17.0.8-linux_x64.zip'
    jreUrl = 'https://cdn.azul.com/zulu/bin/zulu25.28.85-ca-jre25.0.0-linux_x64.zip'

  console.log('jreUrl:', jreUrl)
  const zipPath = path.join(os.tmpdir(), 'jre.zip')
  await downloadFile(jreUrl, zipPath)
  console.log('unzipFile finished:', zipPath, resourcePath)
  await unzipFile(zipPath, resourcePath)
  console.log('unzipFile:', zipPath, resourcePath)

  console.log('getJavaBin:', getJavaBin(resourcePath))
  // Assume unzip creates a folder with 'jre' inside
  return path.join(getJavaBin(resourcePath), process.platform === 'win32' ? 'java.exe' : 'java')
  // return path.join(resourcePath, 'jre', 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
}

// https://internal1.languagetool.org/snapshots/
// https://languagetool.org/download/LanguageTool-stable.zip
async function ensureLanguageTool(resourcePath) {
  const ltJar = path.join(resourcePath, 'bin', 'languagetool', 'languagetool-server.jar')
  if (fs.existsSync(ltJar)) return ltJar

  // const url =
  //   // 'https://github.com/languagetool-org/languagetool/releases/latest/download/LanguageTool-stable.zip'
  //   'https://github.com/languagetool-org/languagetool/archive/refs/tags/v6.6.zip'
  // const zipPath = path.join(os.tmpdir(), 'languagetool.zip')
  // await downloadFile2(url, zipPath)
  // await unzipFile(zipPath, resourcePath, 'languagetool')

  // Move jar to root of resourcePath
  // const extractedFolder = fs.readdirSync(resourcePath).find((f) => f.startsWith('languagetool'))
  // if (!extractedFolder) {
  //   return null
  // }
  // fs.renameSync(path.join(resourcePath, extractedFolder, 'languagetool-server.jar'), ltJar)
  fs.renameSync(path.join(resourcePath, 'languagetool-server.jar'), ltJar)
  return ltJar
}

async function startLanguageTool() {
  // const resourcePath = path.join(__dirname, 'resources')
  var resourcePath
  if (app.isPackaged) {
    resourcePath = path.join(process.resourcesPath)
    // resourcePath = path.join(process.resourcesPath, 'bin')
  } else {
    // In dev, point to your local folder
    resourcePath = path.join(__dirname, '../../resources')
  }
  // const resourcePath = path.join(__dirname, 'resources')
  // const resourcePath = path.join(__dirname, 'resources', getOSFolder())
  fs.mkdirSync(resourcePath, { recursive: true })

  console.log('Starting LanguageTool from', resourcePath)
  const javaPath = await ensureJRE(resourcePath)
  fs.chmodSync(javaPath, 0o755)
  console.log('javaPath', javaPath)
  const ltJarPath = await ensureLanguageTool(resourcePath)
  fs.chmodSync(ltJarPath, 0o755)
  console.log('ltJarPath', ltJarPath)

  // sudo  "resources/jre/zulu-25.jre/Contents/Home/bin/java" -cp languagetool-server.jar org.languagetool.server.HTTPServer --port 8081
  // java -cp languagetool-server.jar org.languagetool.server.HTTPServer --port 8081
  // GOOD >> java -cp languagetool-server.jar org.languagetool.server.HTTPServer --port 8081 --allow-origin
  // java -cp languagetool-server.jar org.languagetool.server.HTTPServer --config server.properties --port 8081 --allow-origin
  // ltProcess = spawn(javaPath, ['-cp', ltJarPath, '--port', '8081'])

  /*
  const ltProcess = spawn(javaPath, [
    '-cp',
    ltJarPath,
    'org.languagetool.server.HTTPServer', // main class
    '--port',
    '8081',
    '--allow-origin'
  ])

  // ltProcess = spawn(javaPath, ['-jar', ltJarPath, '--port', '8081'])
  ltProcess.stdout.on('data', (data) => console.log(`LT data succ: ${data.toString()}`))
  ltProcess.stderr.on('data', (data) => console.error(`LT ERR err: ${data.toString()}`))
  ltProcess.on('exit', (code) => console.log(`LanguageTool exited with code ${code}`))
   */

  _ltProcess = spawn(javaPath, [
    // '-Xmx2g', // Allocate 2GB RAM
    '-cp',
    ltJarPath,
    'org.languagetool.server.HTTPServer',
    '--port',
    '8081',
    '--allow-origin',
    // '--config', 'server.properties' // Use a config file
    '--config',
    path.join(resourcePath, 'bin', 'languagetool.server.properties') // Point to your file
  ])

  _ltProcess.stdout.on('data', (data) => console.log(`LT data succ: ${data.toString()}`))
  _ltProcess.stderr.on('data', (data) => console.error(`LT ERR err: ${data.toString()}`))
  _ltProcess.on('exit', (code) => console.log(`LanguageTool exited with code ${code}`))

  /* 
ltJarPath /path/to/dynadoc/resources/languagetool/languagetool-server.jar
LT ERR err: ***** WARNING: ****

LT ERR err: Key 'prometheusMetricsEnabled' from configuration file '/path/to/dynadoc/resources/bin/languagetool.server.properties' is unknown. Please check the key's spelling (case is significant).
Known keys: [abTest, abTestClients, abTestRollout, beolingusFile, blockedReferrers, cacheSize, cacheTTLSeconds, dbDriver, dbPassword, dbUrl, dbUsername, disabledRuleIds, fasttextBinary, fasttextModel, grammalectePassword, grammalecteServer, grammalecteUser, ipFingerprintFactor, languageModel, maxCheckThreads, maxTextCheckerThreads, textCheckerQueueSize, maxCheckTimeMillis, maxCheckTimeWithApiKeyMillis, maxErrorsPerWordRate, maxPipelinePoolSize, maxSpellingSuggestions, maxTextHardLength, maxTextLength, maxTextLengthWithApiKey, maxWorkQueueSize, pipelineCaching, pipelineExpireTimeInSeconds, pipelinePrewarming, prometheusMonitoring, prometheusPort, remoteRulesFile, requestLimit, requestLimitInBytes, requestLimitPeriodInSeconds, requestLimitWhitelistUsers, requestLimitWhitelistLimit, rulesFile, serverURL, skipLoggingChecks, skipLoggingRuleMatches, timeoutRequestLimit, trustXForwardForHeader, keystore, password, maxTextLengthPremium, maxTextLengthAnonymous, maxTextLengthLoggedIn, gracefulDatabaseFailure, ngramLangIdentData, dbTimeoutSeconds, dbMaxConnections, dbErrorRateThreshold, dbTimeoutRateThreshold, dbDownIntervalSeconds, redisDatabase, redisUseSSL, redisTimeoutMilliseconds, redisConnectionTimeoutMilliseconds, anonymousAccessAllowed, premiumAlways, trustedSource, redisPassword, redisHost, redisCertificate, redisKey, redisKeyPassword, redisUseSentinel, sentinelHost, sentinelPort, sentinelPassword, sentinelMasterId, dbLogging, premiumOnly, nerUrl, minPort, maxPort, localApiMode, motherTongue, preferredLanguages, dictLimitUser, dictLimitTeam, styleGuideLimitUser, styleGuideLimitTeam, passwortLoginAccessListPath, redisDictTTLSeconds, requestLimitAccessToken, trustedSources, ruleIdToConfidenceFile]

LT data succ: 2026-01-22 21:29:48.464 GMT+09:00 INFO  org.languagetool.server.DatabaseAccessOpenSource Not setting up database access, dbDriver is not configured

LT data succ: 2026-01-22 12:29:48 +0000 Setting up thread pool with 4 threads

[51111:0122/212950.807565:ERROR:CONSOLE:1] "Request Autofill.enable failed. {"code":-32601,"message":"'Autofill.enable' wasn't found"}", source: devtools://devtools/bundled/core/protocol_client/protocol_client.js (1)
[51111:0122/212950.810093:ERROR:CONSOLE:1] "Request Autofill.setAddresses failed. {"code":-32601,"message":"'Autofill.setAddresses' wasn't found"}", source: devtools://devtools/bundled/core/protocol_client/protocol_client.js (1)
9:29:51 PM [vite] (client) Failed to load source map for /path/to/dynadoc/src/renderer/src/assets/js/vendor/tailwindcss.js.
Error: An error occurred while trying to read the map file at /sm/ce6c02e5415af41025f4a3c592eb69f2334420ce8d57f8ac7738e5ae20e3768b.map
Error: ENOENT: no such file or directory, open '/sm/ce6c02e5415af41025f4a3c592eb69f2334420ce8d57f8ac7738e5ae20e3768b.map'
    at async open (node:internal/fs/promises:642:25)
    at async Object.readFile (node:internal/fs/promises:1279:14)
    at async extractSourcemapFromFile (file:///path/to/dynadoc/node_modules/vite/dist/node/chunks/config.js:8075:65)
    at async loadAndTransform (file:///path/to/dynadoc/node_modules/vite/dist/node/chunks/config.js:26028:22)
LT data succ: 2026-01-22 21:29:52.353 GMT+09:00 WARN  org.languagetool.language.identifier.DefaultLanguageIdentifier fastText not configured - language detection performance will be degraded. See https://dev.languagetool.org/http-server#starting-from-command-line for instructions.

LT ERR err: WARNING: A terminally deprecated method in sun.misc.Unsafe has been called
WARNING: sun.misc.Unsafe::objectFieldOffset has been called by com.google.common.cache.Striped64 (file:/path/to/dynadoc/resources/languagetool/libs/guava.jar)
WARNING: Please consider reporting this to the maintainers of class com.google.common.cache.Striped64
WARNING: sun.misc.Unsafe::objectFieldOffset will be removed in a future release

LT data succ: 2026-01-22 21:29:52.859 GMT+09:00 INFO  org.languagetool.server.TextChecker A/B-Test enabled: []

LT data succ: 2026-01-22 12:29:52 +0000 Starting LanguageTool 6.6 (build date: 2025-03-27 20:50:25 +0100, f3e8d91) server on http://localhost:8081...

LT data succ: 2026-01-22 12:29:52 +0000 Server started

  */
  /* 
  server.properties

  maxCheckThreads=4         # Use multiple CPU cores
maxWorkQueueSize=100      # Don't drop requests
cacheSize=5000            # Cache common phrases
pipelineCaching=true      # Critical for performance
  */
}

// app.whenReady().then(async () => {
//   await startLanguageTool()
//   createWindow()
// })
// app.on('will-quit', () => {
//   if (ltProcess) ltProcess.kill()
// })

// import Store from 'electron-store'
// const store = new Store()
// import { spawn } from 'node-pty' // or 'node-pty-prebuilt-multiarch'
// import { spawn as nodePtySpawn } from '@homebridge/node-pty-prebuilt-multiarch'

// let shellNodePtySpawn = process.env[process.platform === 'win32' ? 'COMSPEC' : 'SHELL']
const shellNodePtySpawn = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'

// let ptyProcess

let _mainWindow: BrowserWindow
let _browserTabs: TabManager | null = null
let _embeddedViews: EmbeddedViewManager | null = null
let _overlayView: WebContentsView | null = null
let _overlayVisible = false
const AUTH_PROTOCOL = process.env.DDOC_AUTH_PROTOCOL || 'dynadoc'
// Must match the URI registered in the backend's CASDOOR_REDIRECT_URIS
// ("dynadoc://auth"), otherwise Casdoor rejects the redirect. The deep link
// handler matches on protocol only, so the host part is free to change.
const AUTH_CALLBACK_URI = `${AUTH_PROTOCOL}://auth`
// const DEFAULT_AUTH_SERVER_URL = is.dev ? 'http://localhost:7070' : 'https://api.dynadoc.dashmake.com'
const DEFAULT_AUTH_SERVER_URL = 'https://api.dynadoc.dashmake.com'
const AUTH_SERVER_BASE_URL = (process.env.DDOC_AUTH_SERVER_URL || DEFAULT_AUTH_SERVER_URL).replace(
  /\/+$/,
  ''
)
const MATTERMOST_PARTITION = 'persist:mattermost'
const _pendingDeepLinks: string[] = []
let _fileToOpen: string | null = null
let _deepLinkHandler: ((rawUrl: string) => Promise<void>) | null = null

function getFilePathFromArgv(argv: string[]): string | null {
  return (
    argv.find(
      (arg) =>
        typeof arg === 'string' &&
        (arg.toLowerCase().endsWith('.xddoc') || arg.toLowerCase().endsWith('.sddoc'))
    ) || null
  )
}

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send('app:open-file', filePath)
  } else {
    _fileToOpen = filePath
  }
})

const _syncWatchers = new Map<string, ReturnType<typeof spawn>>()

function parseJsonSafely<T = any>(value: string): T | null {
  if (!value) return null
  const trimmed = value.trim()
  try {
    return JSON.parse(trimmed) as T
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T
      } catch {
        return null
      }
    }
    return null
  }
}

function getDeepLinkFromArgv(argv: string[]): string | null {
  const prefix = `${AUTH_PROTOCOL}://`
  const found = argv.find((arg) => typeof arg === 'string' && arg.startsWith(prefix))
  return found || null
}

function queueDeepLink(rawUrl: string) {
  if (!rawUrl) return
  _pendingDeepLinks.push(rawUrl)
}

app.on('open-url', (event, rawUrl) => {
  event.preventDefault()
  if (_deepLinkHandler) {
    void _deepLinkHandler(rawUrl)
    return
  }
  queueDeepLink(rawUrl)
})

function getOverlayUrl() {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env.ELECTRON_RENDERER_URL}?overlay=1`
  }
  return bundleUrl('?overlay=1')
}

function setOverlayVisible(visible: boolean) {
  if (!_overlayView || !_mainWindow) return
  _overlayVisible = visible
  if (visible) {
    if (!_mainWindow.contentView.children.includes(_overlayView)) {
      try {
        _mainWindow.contentView.addChildView(_overlayView)
      } catch {
        // ignore
      }
    }
    _embeddedViews?.setOverlayVisibility(true)
    _browserTabs?.setOverlayVisibility(true)
    return
  }
  if (_mainWindow.contentView.children.includes(_overlayView)) {
    try {
      _mainWindow.contentView.removeChildView(_overlayView)
    } catch {
      // ignore
    }
  }
  _embeddedViews?.setOverlayVisibility(false)
  _browserTabs?.setOverlayVisibility(false)
}

function createOverlayView() {
  if (_overlayView || !_mainWindow) return
  _overlayView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // On a `file://` page this flag was inert: such a page is exempt from
      // CORS, from canvas tainting and -- measured -- from any restriction on
      // reading other local files. The renderer is served from ddoc://bundle
      // now, which has a real origin, so this means what it says.
      webSecurity: true,
      additionalArguments: ['--disable-features=SecurityByDefaultWithCSP']
    }
  })
  _overlayView.setBackgroundColor?.('#00000000')
  _overlayView.webContents.loadURL(getOverlayUrl())
  const [width, height] = _mainWindow.getSize()
  _overlayView.setBounds({ x: 0, y: 0, width, height })
  _mainWindow.contentView.addChildView(_overlayView)
  _embeddedViews?.setOverlayView(_overlayView)
  _browserTabs?.setOverlayView(_overlayView)
  setOverlayVisible(false)
}

function createSplashWindow() {
  if (_splashWindow) return
  const readSavedThemeMode = (): 'system' | 'light' | 'dark' => {
    try {
      const themeFile = path.join(app.getPath('userData'), 'storage', 'ui', 'ui__themeMode.json')
      if (!fs.existsSync(themeFile)) return 'system'
      const raw = fs.readFileSync(themeFile, 'utf8')
      const parsed = JSON.parse(raw)
      return parsed === 'dark' || parsed === 'light' || parsed === 'system' ? parsed : 'system'
    } catch {
      return 'system'
    }
  }
  const themeMode = readSavedThemeMode()
  const resolvedTheme =
    themeMode === 'system' ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light') : themeMode
  const splashBackground = resolvedTheme === 'dark' ? '#0b0b0e' : '#edf2f8'
  const rootVariables =
    resolvedTheme === 'dark'
      ? `
            --bg: radial-gradient(700px 360px at 20% 20%, #1e1f24 0%, #111115 55%, #0b0b0e 100%);
            --accent: rgba(0, 190, 172, 1);
            --accent-2: rgba(0, 190, 172, 0.7);
            --text: #e6e6f0;
            --muted: #a0a0b3;
            --panel: rgba(255, 255, 255, 0.04);
            --panel-border: rgba(255, 255, 255, 0.08);
            --bar-bg: rgba(255,255,255,0.14);
            --status: rgba(255,255,255,0.55);
          `
      : `
            --bg: radial-gradient(700px 360px at 20% 20%, #eef6ff 0%, #f8fbff 55%, #edf2f8 100%);
            --accent: rgba(0, 190, 172, 1);
            --accent-2: rgba(0, 190, 172, 0.7);
            --text: #112033;
            --muted: #5f738b;
            --panel: rgba(255, 255, 255, 0.72);
            --panel-border: rgba(17, 32, 51, 0.08);
            --bar-bg: rgba(17,32,51,0.1);
            --status: rgba(17,32,51,0.45);
          `
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          :root {
            ${rootVariables}
          }
          html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            /* This window is built by the main process and loads no font
               file, so the system face is what paints; the product face is
               named for consistency, not because it can arrive here. */
            font-family: -apple-system, BlinkMacSystemFont, "Archivo", "Segoe UI", sans-serif;
            background: transparent;
          }
          body {
            display: grid;
            place-items: center;
            background: var(--bg);
            color: var(--text);
          }
          .card {
            width: min(420px, 86vw);
            padding: 20px 22px;
            border-radius: 28px;
            text-align: center;
            display: grid;
            gap: 16px;
            justify-items: center;
            background: var(--panel);
            border: 1px solid var(--panel-border);
            box-shadow: 0 20px 50px rgba(0,0,0,0.12);
            backdrop-filter: blur(18px) saturate(115%);
          }
          .logo {
            width: 80px;
            height: 80px;
            border-radius: 24px;
            display: grid;
            place-items: center;
            font-weight: 700;
            font-size: 30px;
            background: linear-gradient(140deg, var(--accent), var(--accent-2));
            box-shadow: 0 16px 40px rgba(0,0,0,0.35), inset 0 0 18px rgba(255,255,255,0.12);
          }
          .title {
            font-size: 20px;
            font-weight: 700;
          }
          .subtitle {
            font-size: 12px;
            color: var(--muted);
          }
          .bar {
            width: 100%;
            height: 6px;
            border-radius: 999px;
            background: var(--bar-bg);
            overflow: hidden;
          }
          .bar::after {
            content: "";
            display: block;
            height: 100%;
            width: 40%;
            background: linear-gradient(90deg, rgba(255,255,255,0.15), var(--accent), var(--accent-2));
            border-radius: inherit;
            animation: move 1.4s ease-in-out infinite;
          }
          .status {
            font-size: 11px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--status);
          }
          @keyframes move {
            0% { transform: translateX(-30%); }
            50% { transform: translateX(60%); }
            100% { transform: translateX(140%); }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">d</div>
          <div class="title">Warming up</div>
          <div class="subtitle">Preparing your workspace and restoring sessions.</div>
          <div class="bar"></div>
          <div class="status">Launching</div>
        </div>
      </body>
    </html>
  `

  _splashWindow = new BrowserWindow({
    width: 520,
    height: 320,
    show: true,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    backgroundColor: splashBackground,
    webPreferences: {
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  _splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  _splashWindow.on('closed', () => {
    _splashWindow = null
  })
}

function closeSplashWindow() {
  if (!_splashWindow || _splashWindow.isDestroyed()) return
  _splashWindow.close()
  _splashWindow = null
}

function registerDevFileAssociationsOld() {
  if (!is.dev) return

  if (process.platform === 'win32') {
    const electronPath = process.execPath
    const iconPath = path.resolve(__dirname, '../../build/icon.ico')

    // Windows dev associations
    const commands = [
      `assoc .xddoc=Dynadoc.Dev`,
      `ftype Dynadoc.Dev="${electronPath}" "%1"`,
      `reg add HKEY_CLASSES_ROOT\\Dynadoc.Dev\\DefaultIcon /t REG_SZ /d "${iconPath},0" /f`,
      `assoc .sddoc=Dynadoc.Dev.Secured`,
      `ftype Dynadoc.Dev.Secured="${electronPath}" "%1"`,
      `reg add HKEY_CLASSES_ROOT\\Dynadoc.Dev.Secured\\DefaultIcon /t REG_SZ /d "${iconPath},0" /f`
    ]

    commands.forEach((cmd) => {
      exec(cmd, (err) => {
        if (err) console.error(`Failed to register dev association: ${cmd}`, err)
      })
    })
  }
}

function registerDevFileAssociations() {
  if (!is.dev) return

  const electronPath = process.execPath

  // ─── WINDOWS ──────────────────────────────────────────────────────────
  if (process.platform === 'win32') {
    const iconPath = path.resolve(__dirname, '../../build/icon.ico')
    const commands = [
      `assoc .xddoc=Dynadoc.Dev`,
      `ftype Dynadoc.Dev="${electronPath}" "%1"`,
      `reg add HKEY_CLASSES_ROOT\\Dynadoc.Dev\\DefaultIcon /t REG_SZ /d "${iconPath},0" /f`,
      `assoc .sddoc=Dynadoc.Dev.Secured`,
      `ftype Dynadoc.Dev.Secured="${electronPath}" "%1"`,
      `reg add HKEY_CLASSES_ROOT\\Dynadoc.Dev.Secured\\DefaultIcon /t REG_SZ /d "${iconPath},0" /f`
    ]
    commands.forEach((cmd) => {
      exec(cmd, (err) => {
        if (err) console.error(`[Win32 Dev] Registry failed: ${cmd}`, err)
      })
    })
  }

  // ─── LINUX ────────────────────────────────────────────────────────────
  else if (process.platform === 'linux') {
    // Generate a temporary local desktop entry for the Electron runtime
    const homeDir = process.env.HOME
    const mimeAppsPath = path.join(homeDir || '', '.config/mimeapps.list')
    const desktopFilePath = path.join(
      homeDir || '',
      '.local/share/applications/dynadoc-dev.desktop'
    )

    const desktopContent = `[Desktop Entry]
Name=Dynadoc Dev
Exec="${electronPath}" %F
MimeType=application/x-xddoc;application/x-sddoc;
Type=Application
Terminal=false
Icon=${path.resolve(__dirname, '../../build/icon.png')}
`
    try {
      fs.mkdirSync(path.dirname(desktopFilePath), { recursive: true })
      fs.writeFileSync(desktopFilePath, desktopContent)

      // Register custom XML mimetypes so Linux knows what .xddoc is
      const mimeXml = `<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="application/x-xddoc"><comment>XDDOC File</comment><glob pattern="*.xddoc"/></mime-type>
  <mime-type type="application/x-sddoc"><comment>SDDOC File</comment><glob pattern="*.sddoc"/></mime-type>
</mime-info>`

      const mimeXmlPath = path.join(homeDir || '', '.local/share/mime/packages/dynadoc-dev.xml')
      fs.mkdirSync(path.dirname(mimeXmlPath), { recursive: true })
      fs.writeFileSync(mimeXmlPath, mimeXml)

      // Refresh databases
      exec('update-mime-database ~/.local/share/mime')
      exec('update-desktop-database ~/.local/share/applications')

      // Bind the extensions to the newly made .desktop entry
      exec('xdg-mime default dynadoc-dev.desktop application/x-xddoc')
      exec('xdg-mime default dynadoc-dev.desktop application/x-sddoc')
    } catch (err) {
      console.error('[Linux Dev] File association setup failed:', err)
    }
  }

  // ─── MACOS ────────────────────────────────────────────────────────────
  else if (process.platform === 'darwin') {
    // Navigate into the node_modules framework folder where Electron hides its identity
    const plistPath = path.join(electronPath, '../../Info.plist')

    if (fs.existsSync(plistPath)) {
      try {
        let plistContent = fs.readFileSync(plistPath, 'utf8')

        // Check if our file associations are already written to the dev framework plist
        if (!plistContent.includes('xddoc')) {
          const docTypesSnippet = `
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeExtensions</key>
      <array>
        <string>xddoc</string>
        <string>sddoc</string>
      </array>
      <key>CFBundleTypeName</key>
      <string>Dynadoc Document</string>
      <key>CFBundleTypeRole</key>
      <string>Editor</string>
    </dict>
  </array>`

          // Inject snippet right before the closing dictionary tag
          plistContent = plistContent.replace(
            '</dict>\n</plist>',
            `${docTypesSnippet}\n</dict>\n</plist>`
          )
          fs.writeFileSync(plistPath, plistContent)

          // Force macOS Launch Services to re-index the updated Dev Binary
          const appBundlePath = path.join(electronPath, '../../../..')
          exec(
            `/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "${appBundlePath}"`
          )
        }
      } catch (err) {
        console.error('[macOS Dev] Info.plist injection failed:', err)
      }
    }
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (event, argv) => {
    // On Windows/Linux the OS relaunches the app with the deep link in argv
    // instead of firing 'open-url'. This is the normal case (the user signs in
    // from an already-running app), so the auth callback must be handled here
    // too — otherwise it is silently dropped and login never completes.
    const deepLink = getDeepLinkFromArgv(argv)
    if (deepLink) {
      if (_deepLinkHandler) {
        void _deepLinkHandler(deepLink)
      } else {
        queueDeepLink(deepLink)
      }
    }

    if (_mainWindow) {
      if (_mainWindow.isMinimized()) _mainWindow.restore()
      _mainWindow.focus()

      const filePath = getFilePathFromArgv(argv)
      if (filePath) {
        _mainWindow.webContents.send('app:open-file', filePath)
      }
    }
  })
}

function createWindow(): void {
  /* const store = new Store()

store.set('unicorn', '🦄')
console.log(store.get('unicorn')) */

  const iconPath = join(__dirname, '../../resources/img/icon.png')

  if (process.platform === 'darwin') {
    // macOS requires explicit dock icon setting during dev
    app?.dock?.setIcon(nativeImage.createFromPath(iconPath))
  }

  createSplashWindow()

  // Get the primary display
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  // Create the browser window with dynamic dimensions
  _mainWindow = new BrowserWindow({
    // const mainWindow = new BrowserWindow({
    // width: width * 0.8, // Set to 80% of the screen width
    // height: height * 0.8, // Set to 80% of the screen height
    width: width, // Set to 80% of the screen width
    height: height, // Set to 80% of the screen height
    minWidth: 570,
    minHeight: 400,
    show: false,
    autoHideMenuBar: false,
    // frame: false, // Remove window frame to allow custom insertion of elements like Command Center
    titleBarStyle: 'hidden',
    // frame: false, // Disable the default frame to use a custom title bar
    // transparent: true, // Allows the blur effect to show through
    // blur an electron BrowserWindow with transparency
    vibrancy: 'fullscreen-ui', // on MacOS https://stackoverflow.com/a/77835944
    backgroundMaterial: 'acrylic', // on Windows 11 https://stackoverflow.com/a/77835944
    /*  trafficLightPosition: {
      x: 15,
      y: 13 // macOS traffic lights seem to be 14px in diameter. If you want them vertically centered, set this to `titlebar_height / 2 - 7`.
    }, */
    /* titleBarOverlay: {
      color: '#2f3241',
      symbolColor: '#74b1be',
      height: 60
    }, */
    ...(process.platform === 'linux' ? { icon } : {}),
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Verified, not inherited: this window hosts the editor, whose
      // CustomWebviewExtension node view (components/Webview.svelte:258)
      // renders a real <webview> element on desktop. Turning the tag off here
      // would leave an inert unknown element in place of the embedded service.
      webviewTag: true,
      sandbox: false,
      // The two comments that used to sit here said these flags were "very
      // important" the other way round -- to let document scripts require()
      // files, and supposedly to load the preload. Neither was true: a preload
      // loads under contextIsolation, which is how every window in this file
      // has been verified since SPEC-001 started, and letting document content
      // reach require() is the hole this whole spec exists to close.
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      additionalArguments: [`--disable-features=SecurityByDefaultWithCSP`],
      // Disable the core engine
      spellcheck: false,
      // On a `file://` page this flag was inert: such a page is exempt from
      // CORS, from canvas tainting and -- measured -- from any restriction on
      // reading other local files. The renderer is served from ddoc://bundle
      // now, which has a real origin, so this means what it says.
      webSecurity: true

      // For seecurity
      /* nodeIntegration: false,           // essential
      contextIsolation: true,           // essential
      sandbox: true,                    // strongly recommended
      // enableRemoteModule: false,
      webviewTag: false,
      // worldSafeExecuteJavaScript: true, */
    }
  })

  try {
    _mainWindow.setMenuBarVisibility(true)
  } catch {
    // ignore
  }
  buildAppMenu()

  _browserTabs = new TabManager(_mainWindow, {
    preloadPath: join(__dirname, '../preload/browser.js'),
    onHistory: async (payload) => {
      try {
        await runDdocServerJson('browser:history-add', payload)
      } catch {}
    },
    onTabsChanged: (tabs) => {
      if (_mainWindow && !_mainWindow.isDestroyed()) {
        _mainWindow.webContents.send('browser:tabs-changed', tabs)
      }
    },
    onTabUpdated: (tab) => {
      if (_mainWindow && !_mainWindow.isDestroyed()) {
        _mainWindow.webContents.send('browser:tab-updated', tab)
      }
    },
    onTabRemoved: (tabId) => {
      if (_mainWindow && !_mainWindow.isDestroyed()) {
        _mainWindow.webContents.send('browser:tab-removed', tabId)
      }
    },
    onDownloadUpdate: (payload) => {
      if (_mainWindow && !_mainWindow.isDestroyed()) {
        _mainWindow.webContents.send('browser:download-updated', payload)
      }
    },
    onPermissionRequest: (payload) => {
      if (_mainWindow && !_mainWindow.isDestroyed()) {
        _mainWindow.webContents.send('browser:permission-request', payload)
      }
    },
    onInsertText: (payload) => {
      if (_mainWindow && !_mainWindow.isDestroyed()) {
        _mainWindow.webContents.send('browser:insert-text', payload)
      }
    }
  })

  if (_browserTabs.listTabs().length === 0) {
    _browserTabs.createTab('https://www.google.com')
  }

  _mainWindow.webContents.on('did-start-loading', () => {
    _browserTabs?.setVisible(false)
    _browserTabs?.setBounds({ x: 0, y: 0, width: 0, height: 0 })
  })

  // Detect macOS
  // if (process.platform !== 'darwin') {
  //   const trafficLightSpacer = document.getElementById('title-bar-traffic-light-region')
  //   if (trafficLightSpacer) {
  //     trafficLightSpacer.classList.add('hidden')
  //   }
  // }

  // Open the DevTools.
  // if (screen.getPrimaryDisplay().size.width > 1025)
  _mainWindow.webContents.openDevTools()

  // Disable Chromium cache for this session
  // mainWindow.webContents.session.setCacheMode('no-store');
  _mainWindow.webContents.session.clearCache()
  _mainWindow.webContents.session.clearStorageData()

  _embeddedViews = new EmbeddedViewManager(_mainWindow, {
    onEvent: (payload) => {
      if (_mainWindow && !_mainWindow.isDestroyed()) {
        _mainWindow.webContents.send('embedded:event', payload)
      }
    }
  })

  _mainWindow.on('ready-to-show', () => {
    _mainWindow.show()
    setTimeout(() => {
      closeSplashWindow()
    }, 180)
  })

  _mainWindow.on('resize', () => {
    if (!_overlayView) return
    const [width, height] = _mainWindow.getSize()
    _overlayView.setBounds({ x: 0, y: 0, width, height })
  })

  _mainWindow.on('close', (event) => {
    if (_allowWindowClose) return
    event.preventDefault()
    requestMainWindowClose('window-close')
  })

  _mainWindow.on('closed', () => {
    _closeRequestInFlight = false
    _browserTabs?.destroyAllViews()
    _embeddedViews?.destroyAllViews()
    if (_overlayView && !(_overlayView.webContents as any).isDestroyed()) {
      ;(_overlayView.webContents as any).destroy()
    }
    _overlayView = null
    closeSplashWindow()
    app.quit()
  })

  _mainWindow.webContents.setWindowOpenHandler((details) => {
    openExternalIfAllowed(details.url)
    return { action: 'deny' }
  })

  _mainWindow.webContents.once('did-finish-load', () => {
    // console.log("render-complete ",Date.now() - startLoading)
    // mainWindow.webContents.send("render-complete", Date.now() - startLoading);
    /* if (_fileToOpen) {
      _mainWindow.webContents.send('app:open-file', _fileToOpen)
      _fileToOpen = null
    } */

    // Check Windows/Linux boot arguments
    let launchFilePath = getFilePathFromArgv(process.argv)

    // If nothing from Windows arguments, check if macOS caught something on boot
    if (!launchFilePath && _fileToOpen) {
      launchFilePath = _fileToOpen
      _fileToOpen = null // clear cache hook
    }

    if (launchFilePath) {
      _mainWindow.webContents.send('app:open-file', launchFilePath)
    }
  })

  // Handle Screen Share requests specifically for this window's session
  _mainWindow.webContents.session.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 300, height: 200 }
      })

      // Send sources to the SVELTE SHELL inside this window
      _mainWindow?.webContents.send(
        'meeting:show-screen-picker',
        sources.map((s) => ({
          id: s.id,
          name: s.name,
          thumbnail: s.thumbnail.toDataURL()
        }))
      )

      // Listen for the user's choice from the Svelte UI
      ipcMain.once('meeting:screen-source-selected', (event, sourceId) => {
        // ipcMain.once(`meeting:source-selected:${_meetingWindow?.id}`, (event, sourceId) => {
        const selected = sources.find((s) => s.id === sourceId)
        callback({ video: selected })

        // 2. Launch the GLOBAL Presentation Tools
        createSharingToolbar() // New Window
        createLaserPointer() // New Window (Transparent Overlay)

        // 3. Minimize the Meeting Window to get it out of the way
        _mainWindow?.minimize()
      })
    } catch (e) {
      console.error('Capture Error:', e)
      callback({}) // Cancel
    }
  })

  // Prevent default navigation on file drop, and keep the window on its own
  // page: navigating it to a remote origin would run that page with this
  // window's privileges. A link that leaves the app goes to the browser
  // instead, which is where the window-open handler already sends one.
  _mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAppOwnUrl(url, _mainWindow?.webContents.getURL())) return
    event.preventDefault()
    openExternalIfAllowed(url)
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    _mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    _mainWindow.loadURL(bundleUrl())
  }

  createOverlayView()
}

function buildUnsavedOverlayIcon(count: number) {
  const safeCount = Math.max(0, count)
  if (safeCount <= 0) return null
  const label = safeCount > 99 ? '99+' : String(safeCount)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">
    <circle cx="64" cy="64" r="58" fill="#d97706" />
    <text x="64" y="74" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" fill="#ffffff">${label}</text>
  </svg>`
  return nativeImage.createFromDataURL(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`)
}
// Helper to ensure the binary is executable
function ensureExecutable(filePath: string) {
  try {
    // 0o755 gives the owner read/write/execute and everyone else read/execute
    fs.chmodSync(filePath, 0o755)
  } catch (err) {
    console.error('Failed to set execute permissions:', err)
  }
}

/* function getBinaryPath(binaryFileName: string = "", isMultiPlatform: boolean = false) {
  let basePath
  if (app.isPackaged) {
    basePath = path.join(process.resourcesPath, 'bin')
  } else {
    // In dev, point to your local folder
    basePath = path.join(__dirname, '../../resources/bin')
  }

  if (isMultiPlatform) {
    return path.join(basePath, `${binaryFileName}`)
  }

  if (os.platform() === 'win32') return path.join(basePath, `win/${binaryFileName}`)
  if (os.platform() === 'darwin') {
    return os.arch() === 'arm64'
      ? path.join(basePath, `mac-arm64/${binaryFileName}`)
      : path.join(basePath, `mac/${binaryFileName}`)
  }
  return path.join(basePath, `linux/${binaryFileName}`)

  // ensureExecutable(result)
} */

function getBinaryPath(binaryFileName: string = '', isMultiPlatform: boolean = false): string {
  let basePath

  if (app.isPackaged) {
    // In production, resources are usually in the 'resources' folder at the root
    basePath = path.join(process.resourcesPath, 'bin')
  } else {
    // In dev, assuming the structure relative to your output 'out/main'
    basePath = path.join(__dirname, '../../resources/bin')
  }

  // Determine the sub-directory based on platform/arch
  let finalPath: string
  if (isMultiPlatform) {
    finalPath = path.join(basePath, binaryFileName)
  } else {
    if (os.platform() === 'win32') {
      finalPath = path.join(basePath, 'win', binaryFileName)
    } else if (os.platform() === 'darwin') {
      const archDir = os.arch() === 'arm64' ? 'mac-arm64' : 'mac'
      finalPath = path.join(basePath, archDir, binaryFileName)
    } else {
      finalPath = path.join(basePath, 'linux', binaryFileName)
    }
  }

  // Ensure binary is executable (Crucial for macOS/Linux)
  try {
    if (fs.existsSync(finalPath)) {
      fs.chmodSync(finalPath, 0o755)
    }
  } catch (err) {
    console.error(`Failed to set permissions for ${finalPath}:`, err)
  }

  return finalPath
}

async function runDdocServerJson(command: string, payload: Record<string, any> = {}) {
  console.log(`runDdocServerJson Running command: ${command} with payload:`, { command, payload })
  return new Promise<string>((resolve, reject) => {
    // const binaryPath = getBinaryPath('ddoc-server', true)
    const binaryPath = getBinaryPath('dynadoc-middleware')

    const proc = spawn(binaryPath, [command, JSON.stringify(payload)], {
      env: process.env
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    proc.on('close', (code) => {
      if (code !== 0 && stderr) {
        console.error(`dynadoc-middleware ${command} failed:`, stderr)
      }
      resolve(stdout.trim())
    })
    proc.on('error', reject)
  })
}

ipcMain.handle('browser:create-tab', (_event, url?: string) => _browserTabs?.createTab(url))
ipcMain.handle('browser:close-tab', (_event, id: string) => _browserTabs?.closeTab(id))
ipcMain.handle('browser:activate-tab', (_event, id: string) => _browserTabs?.activateTab(id))
ipcMain.handle('browser:navigate', (_event, payload: { id: string; url: string }) =>
  _browserTabs?.navigate(payload.id, payload.url)
)
ipcMain.handle('browser:reload', (_event, id: string) => _browserTabs?.reload(id))
ipcMain.handle('browser:back', (_event, id: string) => _browserTabs?.goBack(id))
ipcMain.handle('browser:forward', (_event, id: string) => _browserTabs?.goForward(id))
ipcMain.handle('browser:set-bounds', (_event, bounds: any) => _browserTabs?.setBounds(bounds))
ipcMain.handle('browser:set-visible', (_event, visible: boolean) =>
  _browserTabs?.setVisible(visible)
)
ipcMain.handle('browser:list-tabs', () => _browserTabs?.listTabs() || [])
ipcMain.handle(
  'browser:permission-response',
  (_event, payload: { requestId: string; allow: boolean }) =>
    _browserTabs?.respondToPermission(payload.requestId, payload.allow)
)
ipcMain.handle('browser:history-query', async (_event, query: string) => {
  try {
    const output = await runDdocServerJson('browser:history-search', { query })
    const parsed = parseJsonSafely(output)
    return parsed?.items || parsed || []
  } catch {
    return []
  }
})

ipcMain.handle(
  'embedded:create',
  (
    _event,
    payload: {
      id: string
      url: string
      preloadPath?: string
      partition?: string
      userAgent?: string
      permissions?: string[]
    }
  ) => _embeddedViews?.createOrUpdate(payload)
)
ipcMain.handle('embedded:set-bounds', (_event, payload: { id: string; bounds: any }) =>
  _embeddedViews?.setBounds(payload.id, payload.bounds)
)
ipcMain.handle('embedded:set-visible', (_event, payload: { id: string; visible: boolean }) =>
  _embeddedViews?.setVisible(payload.id, payload.visible)
)
ipcMain.handle('embedded:destroy', (_event, id: string) => _embeddedViews?.destroy(id))
ipcMain.handle('embedded:navigate', (_event, payload: { id: string; url: string }) =>
  _embeddedViews?.navigate(payload.id, payload.url)
)
ipcMain.handle('embedded:execute-js', (_event, payload: { id: string; script: string }) =>
  _embeddedViews?.executeJavaScript(payload.id, payload.script)
)
ipcMain.handle('embedded:insert-css', (_event, payload: { id: string; css: string }) =>
  _embeddedViews?.insertCSS(payload.id, payload.css)
)
ipcMain.handle('embedded:open-devtools', (_event, id: string) => _embeddedViews?.openDevTools(id))
ipcMain.handle('embedded:focus', (_event, id: string) => _embeddedViews?.focus(id))
ipcMain.handle('embedded:set-z', (_event, payload: { id: string; zIndex: number }) =>
  _embeddedViews?.setZIndex(payload.id, payload.zIndex)
)

ipcMain.handle('overlay:set-visible', (_event, payload: { visible: boolean }) => {
  if (!_overlayView || !_mainWindow) return
  setOverlayVisible(Boolean(payload?.visible))
})

ipcMain.handle('app:set-unsaved-badge', (_event, payload: { count?: number }) => {
  const count = Math.max(0, payload?.count || 0)
  try {
    if (app?.setBadgeCount) {
      app.setBadgeCount(count)
    }
  } catch {
    // ignore
  }
  if (process.platform === 'darwin') {
    try {
      app?.dock?.setBadge(count ? String(count) : '')
    } catch {
      // ignore
    }
  }
  if (_mainWindow && !_mainWindow.isDestroyed() && process.platform === 'win32') {
    try {
      const icon = count ? buildUnsavedOverlayIcon(count) : null
      _mainWindow.setOverlayIcon(icon, count ? `${count} unsaved` : '')
    } catch {
      // ignore
    }
  }
  return true
})

ipcMain.on('embedded:var-input', (event, payload: any) => {
  const id = _embeddedViews?.getViewIdByWebContentsId(event.sender.id)
  if (!id) return
  _mainWindow.webContents.send('embedded:var-input', { ...payload, id })
})

ipcMain.on('embedded:var-input-key', (event, payload: { key: string }) => {
  const id = _embeddedViews?.getViewIdByWebContentsId(event.sender.id)
  if (!id) return
  _mainWindow.webContents.send('embedded:var-input-key', { ...payload, id })
})

ipcMain.on('embedded:var-insert', (_event, payload: { id: string; text: string }) => {
  if (!payload?.id) return
  _embeddedViews?.sendToView(payload.id, 'embedded:var-insert', { text: payload.text })
})

ipcMain.on('browser:selection-changed', (_event, payload: { text: string }) => {
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send('browser:selection-changed', payload)
  }
})

ipcMain.on('browser:var-input', (event, payload: any) => {
  if (!_mainWindow || _mainWindow.isDestroyed()) return
  const tabId = _browserTabs?.getTabIdByWebContentsId(event.sender.id)
  if (!tabId) return
  _mainWindow.webContents.send('browser:var-input', { ...payload, tabId })
})

ipcMain.on('browser:var-input-key', (event, payload: { key: string }) => {
  if (!_mainWindow || _mainWindow.isDestroyed()) return
  const tabId = _browserTabs?.getTabIdByWebContentsId(event.sender.id)
  if (!tabId) return
  _mainWindow.webContents.send('browser:var-input-key', { ...payload, tabId })
})

ipcMain.on('browser:var-insert', (_event, payload: { tabId: string; text: string }) => {
  if (!payload?.tabId || !payload?.text) return
  _browserTabs?.sendToTab(payload.tabId, 'browser:var-insert', { text: payload.text })
})

function getWindowOptions(
  minWidth?: number,
  minHeight?: number
): Electron.BrowserWindowConstructorOptions {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  minWidth = minWidth || width
  minHeight = minHeight || height

  return {
    width,
    height,
    minWidth,
    minHeight,
    autoHideMenuBar: true,
    // frame: false, // Remove window frame to allow custom insertion of elements like Command Center
    titleBarStyle: 'hidden',
    // frame: false, // Disable the default frame to use a custom title bar
    // transparent: true, // Allows the blur effect to show through
    // blur an electron BrowserWindow with transparency
    vibrancy: 'fullscreen-ui', // on MacOS https://stackoverflow.com/a/77835944
    backgroundMaterial: 'acrylic', // on Windows 11 https://stackoverflow.com/a/77835944

    ...(process.platform === 'linux' ? { icon } : {}),
    show: false, // 👈 important for ready-to-show
    // fullscreen: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Used by the presentation window (createPresentationWindow below). Its
      // payload is the editor root's outerHTML, injected with {@html} by
      // CustomPresentationExtension/components/SlideViewport.svelte:128, so a
      // document embedding a service carries the serialized <webview> element
      // into this window. Kept until the presentation payload is sanitized.
      webviewTag: true,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      // On a `file://` page this flag was inert: such a page is exempt from
      // CORS, from canvas tainting and -- measured -- from any restriction on
      // reading other local files. The renderer is served from ddoc://bundle
      // now, which has a real origin, so this means what it says.
      webSecurity: true,
      // Disable the core engine
      spellcheck: false,
      additionalArguments: ['--disable-features=SecurityByDefaultWithCSP']
    }
  }
}

function loadWindow(
  win: BrowserWindow,
  route:
    'presentation' | 'presenter' | 'meeting' | 'meeting-sharing-toolbar' | 'meeting-laser-pointer'
) {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${route}`)
  } else {
    win.loadURL(bundleUrl(`#${route}`))
  }
}

function createPresentationWindow(payload: PresentationPayload) {
  if (_presentationWindow) {
    _presentationWindow.focus()
    _presentationWindow.webContents.send(IPC_PRESENTATION_DATA, _cachedPayload)
    return
  }

  _presentationWindow = new BrowserWindow(getWindowOptions(payload.pageWidth, payload.pageHeight))

  loadWindow(_presentationWindow, 'presentation')

  _presentationWindow.once('ready-to-show', () => {
    _presentationWindow?.show()
    _presentationWindow?.webContents.send(IPC_PRESENTATION_DATA, _cachedPayload)
  })
  _presentationWindow.on('closed', () => {
    _presentationWindow = null
  })
}

function createSharingToolbar() {
  // function createSharingToolbar(meetingWindow) {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  const _meetingSharingToolbarWidth = width * 0.5
  _meetingSharingToolbar = new BrowserWindow({
    // width: 280,
    width: 580,
    // width: _meetingSharingToolbarWidth,
    height: 50,
    type: 'toolbar', // Desktop-level toolbar behavior
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: true,
    skipTaskbar: true, // Doesn't clutter the taskbar
    webPreferences: {
      // preload: path.join(__dirname, 'preload.js')
      // preload: join(__dirname, '../preload/index.js'),
      preload: join(__dirname, '../preload/index.js'),
      // This window loads the renderer with the 'meeting-sharing-toolbar'
      // route (loadWindow below; the loadFile('toolbar.html') line next to it
      // is commented out). renderer/src/main.ts mounts
      // MeetingFloatingToolbar.svelte for that route, never Main.svelte, so no
      // editor and no document HTML reach this window -- and the one <webview>
      // in the product (CustomWebviewExtension/components/Webview.svelte:258)
      // only exists inside an editor node view.
      webviewTag: false,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // On a `file://` page this flag was inert: such a page is exempt from
      // CORS, from canvas tainting and -- measured -- from any restriction on
      // reading other local files. The renderer is served from ddoc://bundle
      // now, which has a real origin, so this means what it says.
      webSecurity: true,
      additionalArguments: ['--disable-features=SecurityByDefaultWithCSP']
    }
  })

  // Position it at the top-center of the screen
  // const { width } = screen.getPrimaryDisplay().workAreaSize;
  // _meetingSharingToolbar.setPosition(Math.floor(width / 2 - (_meetingSharingToolbarWidth / 2)), 20);
  _meetingSharingToolbar.setPosition(Math.floor(width / 2 - 190), 20)
  // _meetingSharingToolbar.setPosition(Math.floor(width / 2 - 140), 20);
  _meetingSharingToolbar.once('ready-to-show', () => {
    _meetingSharingToolbar?.show()
  })

  // _meetingSharingToolbar.loadFile('toolbar.html'); // Small Svelte/HTML file
  loadWindow(_meetingSharingToolbar, 'meeting-sharing-toolbar')
}

// Trigger this inside your setDisplayMediaRequestHandler callback
/* ipcMain.on('meeting:screen-source-selected', (event) => {
  createSharingToolbar(event.sender);
}); */
// main.ts
// let _meetingLaserWindow = null;

function createLaserPointer() {
  const { width, height } = screen.getPrimaryDisplay().bounds

  _meetingLaserWindow = new BrowserWindow({
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    fullscreen: false,
    // fullscreen: true,
    skipTaskbar: true,
    webPreferences: {
      //  preload: path.join(__dirname, 'preload.js')
      // preload: join(__dirname, '../preload/index.js'),
      preload: join(__dirname, '../preload/index.js'),
      // Same reasoning as the sharing toolbar: the 'meeting-laser-pointer'
      // route mounts MeetingLaserPointer.svelte, a transparent dot overlay.
      // No editor, no document HTML, so no <webview> can be created here.
      webviewTag: false,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // On a `file://` page this flag was inert: such a page is exempt from
      // CORS, from canvas tainting and -- measured -- from any restriction on
      // reading other local files. The renderer is served from ddoc://bundle
      // now, which has a real origin, so this means what it says.
      webSecurity: true,
      additionalArguments: ['--disable-features=SecurityByDefaultWithCSP']
    }
  })

  // CRITICAL: This allows mouse clicks to pass through the window
  // _meetingLaserWindow.setIgnoreMouseEvents(true, { forward: true });

  _meetingLaserWindow.once('ready-to-show', () => {
    _meetingLaserWindow?.show()
    // Move this AFTER the window is shown and ready
    _meetingLaserWindow?.setIgnoreMouseEvents(true, { forward: true })

    if (_meetingSharingToolbar && !_meetingSharingToolbar.isDestroyed()) {
      // Bring the meeting sharing toolbar window  to the front
      _meetingSharingToolbar.restore() // In case it was minimized
      _meetingSharingToolbar.focus()
    }
  })

  // _meetingLaserWindow.loadFile('laser.html');
  loadWindow(_meetingLaserWindow, 'meeting-laser-pointer')
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  registerDevFileAssociations()

  // Check for files to open on startup (Windows/Linux)
  if (process.platform !== 'darwin') {
    const filePath = getFilePathFromArgv(process.argv)
    if (filePath) {
      _fileToOpen = filePath
    }
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.ddoc-office.app')

  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(AUTH_PROTOCOL, process.execPath, [
        path.resolve(process.argv[1])
      ])
    }
  } else {
    app.setAsDefaultProtocolClient(AUTH_PROTOCOL)
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // This replaces the sketch that sat here: it intercepted `file` itself and
  // re-fetched whatever was asked for, with no policy. Serving a scheme of our
  // own instead means the renderer can be moved off `file://` later, which is
  // what actually closes the local-read hole -- intercepting `file` from a
  // `file://` page would not have.
  handleDocumentAssetProtocol()

  // IPC test
  // ipcMain.on('ping', () => console.log('pong'))

  // Fetch fonts and send to renderer process
  ipcMain.handle('get-fonts', async () => {
    // Default behavior (with quotes for names containing spaces)
    // const fonts = await getFonts()
    // Result: ['"Adobe Arabic"', 'Arial', ...]

    // Disable quoting
    // const fonts = await getFonts({ disableQuoting: true })
    // Result: ['Adobe Arabic', 'Arial', ...]
    const fonts: IFontInfo[] = await getFonts2()

    /*
    [
  {
    name: 'Adobe Arabic',
    familyName: '"Adobe Arabic"',
    postScriptName: 'AdobeArabic-Regular',
    weight: 'regular',
    style: 'normal',
    width: 'normal',
    monospace: false
  },
  {
    name: 'Arial',
    familyName: 'Arial',
    postScriptName: 'ArialMT',
    weight: 'regular',
    style: 'normal',
    width: 'normal',
    monospace: false
  },
  {
    name: 'Courier New',
    familyName: '"Courier New"',
    postScriptName: 'CourierNewPSMT',
    weight: 'regular',
    style: 'normal',
    width: 'normal',
    monospace: true
  },
  ...
]
   */
    return fonts
  })
  /* ipcMain.handle('get-fonts', async () => {
    const fonts = { family: '' }
    // const fonts = fontManager.getAvailableFontsSync()
    // console.log("FONTS----" , fonts)
    // fonts.sort((a, b) => a.family.localeCompare(b.family)) // Sort fonts by name
    return fonts
  }) */

  // Read file content and send to renderer process
  ipcMain.handle('read-file', async (_event, filePath: string) => {
    // requirePath throws, so a refusal arrives as a rejected invoke. It used to
    // `return \`Error reading file: ...\`` -- an error shaped exactly like file
    // contents, which a caller that forgot to check wrote into a document.
    const absPath = requirePath(filePath)
    return await fs.promises.readFile(absPath, 'utf-8')
  })
  // Read file content and send to renderer process
  ipcMain.handle('read-file-content', async (_event, filePath: string, encoding = 'utf-8') => {
    // Same change as read-file: the error string masquerading as content is
    // gone, and the path is the resolved one rather than what arrived.
    const absPath = requirePath(filePath)
    return await fs.promises.readFile(absPath, encoding)
  })

  ipcMain.handle(
    'sync-assets',
    async (
      _event,
      payload: { paths: string[]; cachePath?: string; includeUnused?: boolean } | string[]
    ) => {
      const data = Array.isArray(payload)
        ? { paths: payload, cachePath: undefined, includeUnused: false }
        : payload || { paths: [] }
      const paths = Array.isArray(data.paths) ? data.paths : []
      const cachePath = data.cachePath || ''
      const includeUnused = Boolean((data as any).includeUnused)

      const results = await Promise.all(
        paths.map(async (rawPath) => {
          const p = (rawPath || '').toString()
          if (!p) return { path: p, status: 'missing', sizeBytes: 0, isDir: false }
          if (/^https?:\/\//i.test(p)) {
            return { path: p, status: 'linked', sizeBytes: 0, isDir: false }
          }
          try {
            const stats = await stat(p)
            const isDir = stats.isDirectory()
            const status = cachePath && p.startsWith(cachePath) ? 'embedded' : 'linked'
            return { path: p, status, sizeBytes: isDir ? 0 : stats.size, isDir }
          } catch {
            return { path: p, status: 'missing', sizeBytes: 0, isDir: false }
          }
        })
      )

      if (!includeUnused || !cachePath) return results

      const usedSet = new Set(paths.map((p) => p.toString()))
      const unused: Array<{ path: string; status: string; sizeBytes: number; isDir: boolean }> = []

      const assetsRoot = path.join(cachePath, 'assets')
      const walk = async (dir: string) => {
        let entries: any[] = []
        try {
          entries = await readdir(dir, { withFileTypes: true })
        } catch {
          return
        }
        await Promise.all(
          entries.map(async (entry) => {
            const fullPath = path.join(dir, entry.name)
            if (entry.isDirectory()) {
              await walk(fullPath)
              return
            }
            if (usedSet.has(fullPath)) return
            try {
              const stats = await stat(fullPath)
              unused.push({
                path: fullPath,
                status: 'embedded',
                sizeBytes: stats.size,
                isDir: false
              })
            } catch {
              return
            }
          })
        )
      }

      await walk(assetsRoot)
      return { items: results, unused }
    }
  )

  function getCacheDirPath(file: string = '') {
    return path.join(app.getPath('userData'), app.getName(), file || '')
  }
  function getTempDirPath(file: string = '') {
    return path.join(app.getPath('temp'), app.getName(), file || '')
  }

  ipcMain.handle('get-cache-dir', () => {
    console.log('getCacheDir enter')
    // const cacheDir = path.join(app.getPath('userData'), app.getName())
    const cacheDir = getCacheDirPath()
    console.log('getCacheDir cacheDir', { cacheDir })

    // const cacheDir = Utils.getCacheDirPath()
    fs.mkdirSync(cacheDir, { recursive: true })
    return cacheDir
  })

  ipcMain.handle('get-temp-dir', () => {
    // const cacheDir = path.join(app.getPath('temp'), app.getName())
    const cacheDir = getTempDirPath()
    // const cacheDir = Utils.getTempDirPath()
    fs.mkdirSync(cacheDir, { recursive: true })
    return cacheDir
  })

  ipcMain.handle('get-storage-dir', () => {
    // const basePath = getCacheDirPath()
    const basePath = app.getPath('userData')
    const dataFolder = path.join(basePath, 'storage')

    if (!fs.existsSync(dataFolder)) {
      fs.mkdirSync(dataFolder, { recursive: true })
    }

    return dataFolder
  })

  ipcMain.handle('preload:get-path', (_event, name: string) => {
    if (!name || typeof name !== 'string') return null
    const fsPath = path.join(__dirname, '../preload', `${name}.js`)
    return pathToFileURL(fsPath).toString()
  })

  ipcMain.handle(
    'ddocify',
    async (
      _event,
      folderPath: string,
      outputFile: string,
      shouldSecured?: boolean,
      require2fa?: boolean
    ) => {
      console.log('ddocifying', folderPath, 'to', outputFile)
      if (shouldSecured) {
        const output = await runDdocServerJson('sddoc:pack', {
          input_dir: folderPath,
          output_file: outputFile,
          require_2fa: Boolean(require2fa)
        })
        const parsed = parseJsonSafely(output) || {}
        if (!parsed?.ok) {
          if (parsed?.code === 402) {
            await dialog.showMessageBox({
              type: 'warning',
              title: 'Renew Required',
              message: 'Connect to Internet to Renew',
              detail:
                'Your secure writing lease has expired. Please connect to the internet and sign in to renew.',
              buttons: ['OK']
            })
          }
          const detail = parsed?.debug ? ` | debug=${JSON.stringify(parsed.debug)}` : ''
          throw new Error((parsed?.message || 'Secure save failed') + detail)
        }
        if (parsed?.debug) {
          console.log('sddoc:pack debug', parsed.debug)
        }
        return parsed?.output_path || outputFile
      }

      const pipelineAsync = promisify(pipeline)
      return await Utils.ddocify(pipelineAsync, folderPath, outputFile, shouldSecured)
      // return '✅ Done'
    }
  )

  ipcMain.handle(
    'unddocify',
    async (
      _event,
      zipFilePath: string,
      outputDir: string,
      isSecured?: boolean,
      stepupToken?: string
    ) => {
      console.log('Unddocifying', zipFilePath, 'to', outputDir)
      if (isSecured) {
        const output = await runDdocServerJson('sddoc:unpack', {
          input_file: zipFilePath,
          output_dir: outputDir,
          stepup_token: stepupToken || ''
        })
        const parsed = parseJsonSafely(output) || {}
        if (!parsed?.ok) {
          const detail = parsed?.debug ? ` | debug=${JSON.stringify(parsed.debug)}` : ''
          throw new Error((parsed?.message || 'Secure open failed') + detail)
        }
        if (parsed?.debug) {
          console.log('sddoc:unpack debug', parsed.debug)
        }
        return await normalizeExtractedDocumentRoot(parsed?.output_path || outputDir)
      }

      const pipelineAsync = promisify(pipeline)
      return await Utils.unddocify(pipelineAsync, zipFilePath, outputDir, isSecured)
      // return '✅ Done'
    }
  )

  ipcMain.handle(
    'decrypt-file-to-memory',
    async (_event, encPath: string, password: string | Buffer) => {
      console.log('decrypt-file-to-memory', encPath, 'to', password)
      // const pipelineAsync = promisify(pipeline)

      return await SecurityHelpers.decryptFileToMemory(encPath, password)
      // return '✅ Done'
    }
  )

  /* ipcMain.handle('esbuild-bundle', async (_event, sourceCode) => {
    // console.log('esbuild-bundle', sourceCode)
    // const pipelineAsync = promisify(pipeline)

    return await Utils.esbuildBundle(sourceCode)
    // return '✅ Done'
  })



  async function  rollupBundle(sourceCode) {
    try {


      console.log("sourceCode ", sourceCode)


      const svelteFile = path.join(process.cwd(), 'test', 'test.svelte'); // adjust if needed
      const appFile = path.join(process.cwd(), 'test', 'app.js'); // adjust if needed

      const bundle = await rollup(

        {
          input: {
            app: appFile,
            // index2:'./src/index2.js',
          },
          preserveEntrySignatures: 'strict',
          external: [
            'svelte',
            'svelte/animate',
            'svelte/easing',
            'svelte/motion',
            'svelte/store',
            'svelte/transition',
            'svelte/internal',
            'svelte/internal/client',
            // 'svelte/internal/client/reactivity',
            // 'svelte/internal/shared/attributes',
            // 'svelte/internal/shared/clone',
            // 'svelte/internal/shared/errors',
            // 'svelte/internal/shared/validate',
            // 'svelte/internal/shared/warnings'
          ],
          output: {
            sourcemap: process.env.NODE_ENV != "production",
            format: 'es',
            name: 'app',
            dir: 'out',
            // dir: 'build',
            manualChunks: undefined
          },
          plugins: [
            svelte({ emitCss: true }),
            css({ minify: true, output: 'index.css' }),
            resolve(),
            // terser()
          ]
        }
        /* {
        input: appFile,
        plugins: [
          svelte({
            compilerOptions: {
              dev: false
            }
          }),
          css({ output: 'bundle.css' }),
          resolve({
            browser: true,
            dedupe: ['svelte']
          }),
          commonjs(),
          // terser()
        ]
      } +/
      );

      await bundle.write({
        dir: 'out',
        // file: 'out/bundle.js',
        format: 'es', // ready for <script type="module">
        sourcemap: true,
      });

      await bundle.close();
      console.log('✅ Build complete! Output in ./out');



    } catch (error) {
      console.error("ESBUILD BUNDLING ERROR:", error.message);
      return null;
    }
  }

  ipcMain.handle('rollup-bundle', async (_event, sourceCode) => {
    // console.log('esbuild-bundle', sourceCode)
    // const pipelineAsync = promisify(pipeline)

    await rollupBundle(sourceCode)
    // return '✅ Done'
  }) */

  // let mainWindow: BrowserWindow // Assume already assigned

  const fileWatchers = new Map<string, ReturnType<typeof chokidar.watch>>()
  const latexProjectWatchers = new Map<string, ReturnType<typeof chokidar.watch>>()
  const getWatchKey = (filePath: string, callerId: string) => `${callerId}::${filePath}`

  ipcMain.handle('watch-file', async (_event, filePath: string, callerId: string) => {
    if (!filePath || !callerId) return false
    const key = getWatchKey(filePath, callerId)
    if (fileWatchers.has(key)) return true
    const watcher = chokidar.watch(filePath, { persistent: true, ignoreInitial: true })
    // Safety check — ensure this is not a whole directory
    // const watcher = chokidar.watch(filePath, {
    //   persistent: true,
    //   ignoreInitial: true,
    //   ignored: [
    //     '**/node_modules/**',
    //     '**/dist/**',
    //     '**/.git/**',
    //     '**/app/**',
    //     '**/assets/**',
    //     '**/*.svg',
    //     '**/*.pdf',
    //     '**/*.ttf',
    //     '**/*.woff',
    //     '**/*.woff2',
    //     '*.svg',
    //     '*.pdf',
    //   ],
    // });

    // const userDir = app.getPath('userData')
    // const cacheDir = path.join(app.getPath('userData'), app.getName())

    // const resolved = path.resolve(cacheDir)
    // // const resolved = path.resolve(filePath)

    // // ✅ 1. Ensure file is inside userData dir
    // if (!resolved.startsWith(userDir)) {
    //   console.warn(`[watch-file] Refused: ${resolved} is outside of ${userDir}`)
    //   return
    // }

    // if (filePath == '.') {
    //   console.warn(`[watch-file] Ignoring: ${filePath}`);
    //   return
    // }

    // const stats = await stat(filePath);
    // if (stats.isDirectory()) {
    //   console.warn(`[watch-file] Ignoring directory watch: ${filePath}`);
    //   return;
    // }
    const sendContent = debounce(async () => {
      try {
        const content = await readFile(filePath, 'utf-8')
        _mainWindow.webContents.send('file-changed', content, callerId)
      } catch (err) {
        console.error('Error reading watched file:', err)
      }

      /* const content = await readFile(filePath, 'utf-8')
      mainWindow.webContents.send('file-changed', content, callerId) */
      // mainWindow.webContents.send('file-changed', content)
    }, 300)

    watcher.on('change', sendContent)
    watcher.on('unlink', sendContent)
    fileWatchers.set(key, watcher)
    return true
  })

  ipcMain.handle('unwatch-file', async (_event, filePath: string, callerId: string) => {
    if (!filePath || !callerId) return false
    const key = getWatchKey(filePath, callerId)
    const watcher = fileWatchers.get(key)
    if (!watcher) return false
    try {
      await watcher.close()
    } catch (err) {
      console.warn('Error closing file watcher', err)
    }
    fileWatchers.delete(key)
    return true
  })
  ipcMain.handle('export-to-pdf', async (event, content: any, outputPath?: string) => {
    try {
      const payload =
        typeof content === 'string'
          ? { html: content, css: '' }
          : {
              html: content?.html || '',
              css: content?.css || '',
              printOptions: content?.printOptions || {},
              pageWidth: content?.pageWidth ?? content?.printOptions?.pageWidth,
              pageHeight: content?.pageHeight ?? content?.printOptions?.pageHeight,
              pageWidthTwips: content?.pageWidthTwips ?? content?.printOptions?.pageWidthTwips,
              pageHeightTwips: content?.pageHeightTwips ?? content?.printOptions?.pageHeightTwips,
              printFromSender: Boolean(content?.printFromSender),
              returnBuffer: Boolean(content?.returnBuffer)
            }

      const printOptions = payload.printOptions || {}

      // High-precision dimension helper (twips vs px vs inches)
      const toInches = (val: number | undefined): number | undefined => {
        if (!val || val <= 0) return undefined
        if (val > 10000) return val / 1440 // twips (1440 per inch)
        if (val > 50) return val / 96 // standard CSS px (96 DPI)
        return val // already in inches
      }

      // Resolve pageSize: honour explicit pageSize object first (passed from new renderer),
      // then fall back to twips or px dimension values.
      let pageSize: any = printOptions.pageSize
      if (!pageSize) {
        const twipsW = payload.pageWidthTwips || printOptions.pageWidthTwips
        const twipsH = payload.pageHeightTwips || printOptions.pageHeightTwips
        const pxW = payload.pageWidth || printOptions.pageWidth
        const pxH = payload.pageHeight || printOptions.pageHeight

        if (twipsW && twipsH) {
          pageSize = { width: twipsW / 1440, height: twipsH / 1440 }
        } else if (pxW && pxH) {
          pageSize = { width: toInches(pxW)!, height: toInches(pxH)! }
        }
      }

      // Configure high-fidelity Chromium printToPDF options
      const pdfOptions: Electron.PrintToPDFOptions = {
        landscape: printOptions.landscape ?? false,
        printBackground: printOptions.printBackground ?? true,
        displayHeaderFooter: printOptions.displayHeaderFooter ?? false,
        preferCSSPageSize: printOptions.preferCSSPageSize ?? false,
        margins: {
          marginType: 'none',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          ...(printOptions.margins || {})
        }
      }

      if (pageSize) {
        pdfOptions.pageSize = pageSize
      }

      // Print the live renderer window directly — the @media print CSS in main.css
      // hides all UI chrome so only the tiptap document content is captured.
      const pdfBuffer = await event.sender.printToPDF(pdfOptions)
      console.log(`✅ High-fidelity PDF printFromSender:`, { outputPath, pdfOptions })

      if (payload.returnBuffer) {
        return { ok: true, base64: pdfBuffer.toString('base64'), path: outputPath }
      }

      outputPath = outputPath || path.join(process.cwd(), 'export.pdf')
      fs.writeFileSync(outputPath, pdfBuffer)
      console.log(`✅ High-fidelity PDF saved to: ${outputPath}`)
      return outputPath
    } catch (err: any) {
      console.error('❌ export-to-pdf failed:', err)
      throw err
    }
  })

  ipcMain.handle(
    'print-pdf-buffer',
    async (event, pageWidthTwips?: number, pageHeightTwips?: number, options?: any) => {
      try {
        let pageSize: any = undefined
        if (pageWidthTwips && pageHeightTwips) {
          const toInches = (v: number) => (v > 10000 ? v / 1440 : v > 50 ? v / 96 : v)
          pageSize = {
            width: toInches(pageWidthTwips),
            height: toInches(pageHeightTwips)
          }
        }
        const pdfOptions: Electron.PrintToPDFOptions = {
          printBackground: true,
          preferCSSPageSize: true,
          displayHeaderFooter: false,
          margins: { marginType: 'none', top: 0, bottom: 0, left: 0, right: 0 },
          ...(options || {})
        }
        if (pageSize) pdfOptions.pageSize = pageSize

        const pdfBuffer = await event.sender.printToPDF(pdfOptions)
        return { ok: true, base64: pdfBuffer.toString('base64') }
      } catch (err: any) {
        return { ok: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    'save-merged-pdf',
    async (_event, defaultName: string, base64Parts: string[], outPath?: string) => {
      const filePath =
        outPath || path.join(process.cwd(), defaultName.replace(/\.docx$/i, '') + '.pdf')
      try {
        let finalBuffer: Buffer
        try {
          // @ts-ignore - pdf-lib optional fallback
          const pdfLib: any = await import('pdf-lib').catch(() => null)
          if (pdfLib?.PDFDocument) {
            const merged = await pdfLib.PDFDocument.create()
            for (const b64 of base64Parts) {
              const part = await pdfLib.PDFDocument.load(Buffer.from(b64, 'base64'))
              const pages = await merged.copyPages(part, part.getPageIndices())
              for (const page of pages) merged.addPage(page)
            }
            finalBuffer = Buffer.from(await merged.save())
          } else {
            finalBuffer = Buffer.from(base64Parts[0] || '', 'base64')
          }
        } catch {
          finalBuffer = Buffer.from(base64Parts[0] || '', 'base64')
        }
        fs.writeFileSync(filePath, finalBuffer)
        return { ok: true, path: filePath }
      } catch (err: any) {
        return { ok: false, error: String(err) }
      }
    }
  )

  ipcMain.handle('print-file', async (_event, payload: { filePath: string; options?: any }) => {
    const filePath = payload?.filePath
    if (!filePath) return false
    const win = new BrowserWindow({ show: true })
    await win.loadFile(filePath)
    await new Promise<void>((resolve) => {
      win.webContents.once('did-finish-load', () => resolve())
    })
    await new Promise<void>((resolve) => {
      win.webContents.print(
        {
          printBackground: true,
          silent: false,
          ...payload?.options
        },
        () => resolve()
      )
    })
    await win.close()
    return true
  })

  // Use fs.promises for async/await
  const fsp = fs.promises

  // Async IPC to read directory
  /* ipcMain.handle('read-dir', async (event, dirPath) => {
    try {
      const dirents = await fsp.readdir(dirPath, { withFileTypes: true })
      // const dirents = await fs.readdir(dirPath, { withFileTypes: true })
      return dirents.map((dirent) => ({
        name: dirent.name,
        isFolder: dirent.isDirectory(),
        path: path.join(dirPath, dirent.name)
      }))
    } catch (err) {
      console.error(err)
      return []
    }
  }) */

  // Async IPC to read directory with optional sorting
  /* ipcMain.handle('read-dir', async (event, dirPath, sort = true) => {
    try {
      const dirents = await fsp.readdir(dirPath, { withFileTypes: true })

      const items = dirents.map((dirent) => ({
        name: dirent.name,
        isFolder: dirent.isDirectory(),
        path: path.join(dirPath, dirent.name)
      }))

      if (sort) {
        // Sort: folders first, then files; each group alphabetically
        items.sort((a, b) => {
          if (a.isFolder && !b.isFolder) return -1
          if (!a.isFolder && b.isFolder) return 1
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        })
      }

      return items
    } catch (err) {
      console.error('read-dir error:', err)
      return []
    }
  }) */

  // List of common system-generated files/folders across OSes
  const SYSTEM_FILES = new Set([
    '.DS_Store',
    '.AppleDouble',
    '.Trashes',
    '.Spotlight-V100',
    'Thumbs.db',
    'Desktop.ini',
    'System Volume Information'
  ])

  // Async IPC to read directory with options
  ipcMain.handle(
    'read-dir',
    async (
      _event,
      dirPath: string,
      options: {
        sort?: boolean
        showHidden?: boolean
        showSystemHidden?: boolean
      } = {}
    ) => {
      const { sort = true, showHidden = false, showSystemHidden = false } = options
      const resolvedDir = requirePath(dirPath)

      try {
        const dirents = await fsp.readdir(resolvedDir, { withFileTypes: true })

        let items = dirents
          .map((dirent) => ({
            name: dirent.name,
            isFolder: dirent.isDirectory(),
            path: path.join(resolvedDir, dirent.name)
          }))
          // Filter hidden files/folders
          .filter((item) => {
            // Skip hidden (dot) files if not showing
            if (!showHidden && item.name.startsWith('.')) return false

            // Skip system-generated files/folders
            if (!showSystemHidden && SYSTEM_FILES.has(item.name)) return false

            return true
          })

        if (sort) {
          items.sort((a, b) => {
            if (a.isFolder && !b.isFolder) return -1
            if (!a.isFolder && b.isFolder) return 1
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          })
        }

        return items
      } catch (err) {
        console.error('read-dir error:', err)
        return []
      }
    }
  )

  ipcMain.handle('open-file', async (_event, filePath) => {
    try {
      await shell.openPath(filePath)
      return true
    } catch {
      return false
    }
  })

  // Rename file
  ipcMain.handle('rename-file', async (_event, oldPath, newName) => {
    // Both ends are checked: the source, and the destination the handler
    // computes. `newName` arrives from the renderer, so a name containing
    // separators or `..` would otherwise aim the rename out of the directory.
    const source = requirePath(oldPath)
    const dir = path.dirname(source)
    const target = requirePath(path.join(dir, path.basename(String(newName))))
    try {
      const newPath = target
      const stats = await fsp.stat(source)

      if (stats.isDirectory()) {
        await fsp.rename(source, newPath)
        console.error('Renamed:', newPath)
        return newPath
      }

      const oldName = path.basename(source)
      const oldBase = path.basename(oldName, path.extname(oldName))
      const newBase = path.basename(newName, path.extname(newName))

      await fsp.rename(source, newPath)

      // Rename all sidecar files that match "{OLD_BASE}.*"
      const entries = await fsp.readdir(dir)
      const sidecarRenames = entries
        .filter((entry) => entry !== oldName && entry.startsWith(`${oldBase}.`))
        .map(async (entry) => {
          const suffix = entry.slice(oldBase.length + 1)
          const targetName = `${newBase}.${suffix}`
          if (targetName === entry) return
          const from = path.join(dir, entry)
          const to = path.join(dir, targetName)
          try {
            await fsp.rename(from, to)
          } catch (err) {
            console.error('Rename sidecar error:', err)
          }
        })

      await Promise.all(sidecarRenames)
      console.error('Renamed:', newPath)
      return newPath
    } catch (err) {
      console.error('Rename error:', err)
      return null
    }
  })

  // Move file
  ipcMain.handle('move-file', async (_event, srcPath, destPath) => {
    // Source, destination directory and the computed target are all checked:
    // a move is two paths, and allowing either end unchecked allows the move.
    const source = requirePath(srcPath)
    const destination = requirePath(destPath)
    const target = requirePath(path.join(destination, path.basename(source)))
    await fsp.rename(source, target)
    return target
  })

  ipcMain.handle('delete-file', async (_event, filePath) => {
    // This handler recursively removed any absolute path the renderer named,
    // with no check at all, and answered `false` when it failed. It is the
    // reason this policy exists.
    const target = requirePath(filePath)
    const stats = await fsp.stat(target)
    if (stats.isDirectory()) {
      await fsp.rm(target, { recursive: true })
    } else {
      await fsp.unlink(target)
    }
    return true
  })

  type SearchFsPayload = {
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
    replaceText?: string
  }

  type SearchFsMatch = {
    line: number
    column: number
    length: number
    preview: string
    before: string
    match: string
    after: string
  }

  type SearchFsFileResult = {
    file: string
    path: string
    relativePath: string
    matches: number
    items: SearchFsMatch[]
  }

  const SEARCH_TEXT_EXTENSIONS = new Set([
    '.txt',
    '.md',
    '.markdown',
    '.json',
    '.yaml',
    '.yml',
    '.toml',
    '.ini',
    '.cfg',
    '.html',
    '.htm',
    '.css',
    '.scss',
    '.sass',
    '.less',
    '.xml',
    '.csv',
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.mjs',
    '.cjs',
    '.svelte',
    '.vue',
    '.go',
    '.rs',
    '.py',
    '.java',
    '.kt',
    '.swift',
    '.c',
    '.cc',
    '.cpp',
    '.h',
    '.hpp',
    '.sql',
    '.graphql',
    '.gql',
    '.sh',
    '.bash',
    '.zsh',
    '.ps1',
    '.xddoc',
    '.sddoc'
  ])

  function normalizeSearchPath(inputPath: string): string {
    return String(inputPath || '')
      .trim()
      .replace(/\\/g, '/')
  }

  function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function parseCsvPatterns(value: string): string[] {
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  function globToRegex(glob: string): RegExp {
    const normalized = normalizeSearchPath(glob)
    let out = '^'
    for (let index = 0; index < normalized.length; index += 1) {
      const char = normalized[index]
      const next = normalized[index + 1]

      if (char === '*') {
        if (next === '*') {
          out += '.*'
          index += 1
        } else {
          out += '[^/]*'
        }
        continue
      }

      if (char === '?') {
        out += '.'
        continue
      }

      out += escapeRegex(char)
    }
    out += '$'
    return new RegExp(out, 'i')
  }

  function compilePatternList(value: string): RegExp[] {
    return parseCsvPatterns(value).map(globToRegex)
  }

  function matchesAnyPatternForFile(
    filePath: string,
    rootPath: string,
    patterns: RegExp[]
  ): boolean {
    if (!patterns.length) return false
    const normalizedFull = normalizeSearchPath(filePath)
    const normalizedRelative = normalizeSearchPath(path.relative(rootPath, filePath))
    const baseName = path.basename(filePath)
    return patterns.some(
      (pattern) =>
        pattern.test(normalizedFull) || pattern.test(normalizedRelative) || pattern.test(baseName)
    )
  }

  function isLikelyTextFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    if (SEARCH_TEXT_EXTENSIONS.has(ext)) return true
    return !ext
  }

  function hasBinaryContent(buffer: Buffer): boolean {
    const threshold = Math.min(buffer.length, 2048)
    for (let index = 0; index < threshold; index += 1) {
      if (buffer[index] === 0) return true
    }
    return false
  }

  function createSearchRegExp(query: string, options: SearchFsPayload): RegExp {
    const source = options.isRegex ? query : escapeRegex(query)
    const wrapped = options.wholeWord ? `\\b(?:${source})\\b` : source
    const flags = options.caseSensitive ? 'g' : 'gi'
    return new RegExp(wrapped, flags)
  }

  async function collectSearchFiles(
    rootPath: string,
    includeMatchers: RegExp[],
    excludeMatchers: RegExp[],
    restrictToPaths: string[] = [],
    maxFiles: number = 6000
  ): Promise<string[]> {
    if (restrictToPaths.length > 0) {
      return restrictToPaths
        .filter((item) => item && fs.existsSync(item))
        .filter(
          (item) =>
            !excludeMatchers.length || !matchesAnyPatternForFile(item, rootPath, excludeMatchers)
        )
        .filter(
          (item) =>
            !includeMatchers.length || matchesAnyPatternForFile(item, rootPath, includeMatchers)
        )
    }

    const output: string[] = []
    const stack: string[] = [rootPath]

    while (stack.length > 0 && output.length < maxFiles) {
      const currentDir = stack.pop() as string
      let entries: fs.Dirent[] = []
      try {
        entries = await fsp.readdir(currentDir, { withFileTypes: true })
      } catch {
        entries = []
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)
        if (excludeMatchers.length && matchesAnyPatternForFile(fullPath, rootPath, excludeMatchers))
          continue

        if (entry.isDirectory()) {
          stack.push(fullPath)
          continue
        }

        if (!entry.isFile()) continue
        if (
          includeMatchers.length &&
          !matchesAnyPatternForFile(fullPath, rootPath, includeMatchers)
        )
          continue

        output.push(fullPath)
      }
    }

    return output
  }

  function stripHtmlForSearch(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/p>|<\/div>|<\/li>|<\/h[1-6]>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x[0-9a-f]+;/gi, ' ')
      .replace(/&[a-z]+;/gi, ' ')
  }

  async function searchInFiles(payload: SearchFsPayload) {
    const rootPath = String(payload?.rootPath || '').trim()
    const query = String(payload?.query || '')
    if (!rootPath || !query) {
      return { ok: true, files: [], totalMatches: 0, scannedFiles: 0, truncated: false }
    }
    if (!fs.existsSync(rootPath)) {
      return {
        ok: false,
        files: [],
        totalMatches: 0,
        scannedFiles: 0,
        truncated: false,
        error: 'Search root does not exist'
      }
    }

    const includeMatchers = compilePatternList(payload.includePattern || '')
    const excludeMatchers = compilePatternList(payload.excludePattern || '')
    const maxResults = Math.max(1, Number(payload.maxResults || 2000))
    const maxMatchesPerFile = Math.max(1, Number(payload.maxMatchesPerFile || 200))
    const restrictToPaths = Array.isArray(payload.restrictToPaths) ? payload.restrictToPaths : []

    let matcher: RegExp
    try {
      matcher = createSearchRegExp(query, payload)
    } catch {
      return {
        ok: false,
        files: [],
        totalMatches: 0,
        scannedFiles: 0,
        truncated: false,
        error: 'Invalid regular expression'
      }
    }

    const files = await collectSearchFiles(
      rootPath,
      includeMatchers,
      excludeMatchers,
      restrictToPaths
    )
    const grouped: SearchFsFileResult[] = []
    let totalMatches = 0
    let truncated = false

    for (const filePath of files) {
      if (!isLikelyTextFile(filePath)) continue

      let buffer: Buffer
      try {
        buffer = await fsp.readFile(filePath)
      } catch (err) {
        console.warn('[searchInFiles] skipping file:', filePath, err)
        continue
      }
      // Skip files > 10 MB to avoid blocking the event loop
      if (buffer.byteLength > 10 * 1024 * 1024) continue
      if (hasBinaryContent(buffer)) continue

      const rawContent = buffer.toString('utf-8')
      const lowerPath = filePath.toLowerCase()
      const isHtml = lowerPath.endsWith('.html') || lowerPath.endsWith('.sddoc')
      const content = isHtml ? stripHtmlForSearch(rawContent) : rawContent
      const lines = content.split(/\r?\n/)
      const items: SearchFsMatch[] = []

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const lineText = lines[lineIndex]
        matcher.lastIndex = 0
        let found: RegExpExecArray | null = null

        while ((found = matcher.exec(lineText)) !== null) {
          const matched = found[0] || ''
          const start = found.index
          const end = start + matched.length

          items.push({
            line: lineIndex + 1,
            column: start + 1,
            length: Math.max(1, matched.length),
            preview: lineText.trim(),
            before: lineText.slice(0, start),
            match: matched || lineText.slice(start, end),
            after: lineText.slice(end)
          })
          totalMatches += 1

          if (matched.length === 0) {
            matcher.lastIndex += 1
          }

          if (items.length >= maxMatchesPerFile || totalMatches >= maxResults) {
            truncated = true
            break
          }
        }

        if (truncated) break
      }

      if (items.length > 0) {
        grouped.push({
          file: path.basename(filePath),
          path: filePath,
          relativePath: path.relative(rootPath, filePath),
          matches: items.length,
          items
        })
      }

      if (truncated) break
    }

    return {
      ok: true,
      files: grouped,
      totalMatches,
      scannedFiles: files.length,
      truncated
    }
  }

  async function replaceInFiles(payload: SearchFsPayload & { replaceText: string }) {
    const rootPath = String(payload?.rootPath || '').trim()
    const query = String(payload?.query || '')
    const replaceText = String(payload?.replaceText ?? '')

    if (!rootPath || !query) {
      return { ok: true, changedFiles: 0, replacements: 0, files: [] as string[] }
    }
    if (!fs.existsSync(rootPath)) {
      return {
        ok: false,
        changedFiles: 0,
        replacements: 0,
        files: [] as string[],
        error: 'Search root does not exist'
      }
    }

    let matcher: RegExp
    try {
      matcher = createSearchRegExp(query, payload)
    } catch {
      return {
        ok: false,
        changedFiles: 0,
        replacements: 0,
        files: [] as string[],
        error: 'Invalid regular expression'
      }
    }

    const includeMatchers = compilePatternList(payload.includePattern || '')
    const excludeMatchers = compilePatternList(payload.excludePattern || '')
    const restrictToPaths = Array.isArray(payload.restrictToPaths) ? payload.restrictToPaths : []
    const files = await collectSearchFiles(
      rootPath,
      includeMatchers,
      excludeMatchers,
      restrictToPaths
    )

    let changedFiles = 0
    let replacements = 0
    const changedPaths: string[] = []

    for (const filePath of files) {
      if (!isLikelyTextFile(filePath)) continue

      let buffer: Buffer
      try {
        buffer = await fsp.readFile(filePath)
      } catch (err) {
        console.warn('[searchInFiles] skipping file:', filePath, err)
        continue
      }
      if (hasBinaryContent(buffer)) continue

      const content = buffer.toString('utf-8')
      matcher.lastIndex = 0

      let localCount = 0
      const updated = content.replace(matcher, () => {
        localCount += 1
        return replaceText
      })

      if (localCount === 0) continue

      try {
        await fsp.writeFile(filePath, updated, 'utf-8')
      } catch {
        continue
      }

      changedFiles += 1
      replacements += localCount
      changedPaths.push(filePath)
    }

    return { ok: true, changedFiles, replacements, files: changedPaths }
  }

  ipcMain.handle('search:files', async (_event, payload: SearchFsPayload) => {
    try {
      return await searchInFiles(payload || ({} as SearchFsPayload))
    } catch (error) {
      console.error('search:files error', error)
      return {
        ok: false,
        files: [],
        totalMatches: 0,
        scannedFiles: 0,
        truncated: false,
        error: 'Search failed'
      }
    }
  })

  ipcMain.handle(
    'search:replace-in-files',
    async (_event, payload: SearchFsPayload & { replaceText: string }) => {
      try {
        return await replaceInFiles(payload || ({} as SearchFsPayload & { replaceText: string }))
      } catch (error) {
        console.error('search:replace-in-files error', error)
        return { ok: false, changedFiles: 0, replacements: 0, files: [], error: 'Replace failed' }
      }
    }
  )

  type SearchFileNamesPayload = {
    rootPath: string
    query: string
    includePattern?: string
    excludePattern?: string
    maxResults?: number
  }

  ipcMain.handle('search:file-names', async (_event, payload: SearchFileNamesPayload) => {
    try {
      const rootPath = String(payload?.rootPath || '').trim()
      const query = String(payload?.query || '')
        .trim()
        .toLowerCase()
      if (!rootPath || !query || !fs.existsSync(rootPath)) {
        return {
          ok: true,
          items: [] as Array<{
            name: string
            path: string
            relativePath: string
            isFolder: boolean
          }>
        }
      }

      const includeMatchers = compilePatternList(payload.includePattern || '')
      const excludeMatchers = compilePatternList(payload.excludePattern || '')
      const maxResults = Math.max(1, Number(payload.maxResults || 200))

      const results: Array<{
        name: string
        path: string
        relativePath: string
        isFolder: boolean
        score: number
      }> = []
      const stack: string[] = [rootPath]

      while (stack.length > 0 && results.length < maxResults * 4) {
        const currentDir = stack.pop() as string
        let entries: fs.Dirent[] = []
        try {
          entries = await fsp.readdir(currentDir, { withFileTypes: true })
        } catch {
          entries = []
        }

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name)
          const relativePath = path.relative(rootPath, fullPath)

          if (
            excludeMatchers.length &&
            matchesAnyPatternForFile(fullPath, rootPath, excludeMatchers)
          )
            continue
          if (
            includeMatchers.length &&
            !matchesAnyPatternForFile(fullPath, rootPath, includeMatchers)
          )
            continue

          if (entry.isDirectory()) {
            stack.push(fullPath)
          }

          const nameLower = entry.name.toLowerCase()
          const relativeLower = normalizeSearchPath(relativePath).toLowerCase()
          if (!nameLower.includes(query) && !relativeLower.includes(query)) continue

          let score = 0
          if (nameLower === query) score += 120
          if (nameLower.startsWith(query)) score += 80
          if (relativeLower.startsWith(query)) score += 60
          if (nameLower.includes(query)) score += 40
          if (entry.isDirectory()) score -= 5

          results.push({
            name: entry.name,
            path: fullPath,
            relativePath,
            isFolder: entry.isDirectory(),
            score
          })
        }
      }

      results.sort((a, b) => b.score - a.score || a.relativePath.localeCompare(b.relativePath))

      return {
        ok: true,
        items: results.slice(0, maxResults).map((item) => ({
          name: item.name,
          path: item.path,
          relativePath: item.relativePath,
          isFolder: item.isFolder
        }))
      }
    } catch (error) {
      console.error('search:file-names error', error)
      return { ok: false, items: [], error: 'File name search failed' }
    }
  })

  // ipcMain.handle('show-context-menu', (event, template) => {
  //   const menu = Menu.buildFromTemplate(template)
  //   menu.popup({ window: event.sender })
  // })

  const clickMap: Record<string, () => void> = {}

  // Handle menu registration
  ipcMain.handle('register-menu-action', (event, id) => {
    // We'll register later in renderer
    clickMap[id] = () => {
      event.sender.send('invoke-menu-action', id)
    }
  })

  // Handle showing menu
  ipcMain.handle('show-context-menu', (event, template) => {
    const menuTemplate = template.map((item) => {
      let icon
      if (item.iconPath && fs.existsSync(item.iconPath)) {
        icon = nativeImage.createFromPath(item.iconPath)
        // Scale down if too large
        icon = icon.resize({ width: 16, height: 16 })
      }
      return {
        label: item.label,
        accelerator: item.accelerator,
        icon: icon,
        // icon: item.iconPath || undefined,
        click: () => {
          const id = item.clickId
          event.sender.send('invoke-menu-action', id)
        }
      }
    })

    const menu = Menu.buildFromTemplate(menuTemplate)
    // menu.popup({ window: event.sender })

    // Get the BrowserWindow from WebContents
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      menu.popup({ window: win })
    } else {
      console.warn('Could not find BrowserWindow for context menu')
    }
  })

  ipcMain.on('menu:update-recent', (_event, items) => {
    if (Array.isArray(items)) {
      _recentMenuEntries = items
    } else {
      _recentMenuEntries = []
    }
    buildAppMenu()
  })

  ipcMain.on('show-grammar-menu', (event, { items, x, y }) => {
    const menuTemplate = items.map((it) => ({
      label: it.label,
      accelerator: it.shortcut,
      icon: it.icon || undefined,
      click: () => event.sender.send('grammar-menu-selection', it.label)
    }))

    const menu = Menu.buildFromTemplate(menuTemplate)
    // menu.popup({ window: BrowserWindow.fromWebContents(event.sender), x, y })

    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      menu.popup({ window: win, x, y })
    } else {
      console.warn('Could not find BrowserWindow for grammar menu')
    }
  })

  /**
   * Spawn Go CLI and stream output
   */
  /* ipcMain.handle('ai:generate', async (event, prompt,requestId) => {
    return new Promise((resolve, reject) => {
      const binaryPath = getBinaryPath('dynadoc-middleware', true)
      // const binaryPath = path.join(process.resourcesPath, 'dynadoc-middleware')
      // For dev:
      // const binaryPath = './ddoc-ai'

      const ai = spawn(binaryPath, [prompt,requestId], {
        env: process.env,
      })

      let full = ''

      ai.stdout.on('data', data => {
        const text = data.toString()

        // Stream to renderer
        event.sender.send('ai:chunk', text)
        // event.sender.send('ai:chunk', text)

        full += text
      })

      ai.stderr.on('data', data => {
        console.error('AI ERROR:', data.toString())
      })

      ai.on('close', code => {
        // Send final to renderer
        event.sender.send('ai:done', full)
        resolve(full)
      })

      ai.on('error', err => {
        reject(err)
      })

      // optional abort support
      // event.sender.once('ai:abort', () => {
      //   ai.kill('SIGTERM')
      //   reject(new Error('aborted'))
      // })

    })
  }) */

  ipcMain.handle('ai:generate', async (event, promptOrPayload, requestId) => {
    const payload =
      typeof promptOrPayload === 'object' && promptOrPayload
        ? promptOrPayload
        : { prompt: promptOrPayload, requestId }

    return new Promise((resolve, reject) => {
      const binaryPath = getBinaryPath('dynadoc-middleware')
      // const binaryPath = getBinaryPath('dynadoc-middleware', true);

      const ai = spawn(binaryPath, ['ai:generate', JSON.stringify(payload)], {
        env: process.env
      })

      let full = ''

      ai.stdout.on('data', (data) => {
        const text = data.toString()

        // 1. CRITICAL: Send an object, not just a string
        event.sender.send('ai:chunk', {
          content: text,
          requestId: payload.requestId
        })

        full += text
      })

      ai.stderr.on('data', (data) => {
        console.error('AI ERROR:', data.toString())
      })

      ai.on('close', (code) => {
        // 2. Send final signal with ID
        event.sender.send('ai:done', {
          fullData: full,
          requestId: payload.requestId
        })
        resolve(full)
      })

      ai.on('error', (err) => reject(err))
    })
  })

  type DriveListPayload = {
    accountOrg?: string
    rootPath?: string
    path?: string
    query?: string
    sort?: boolean
  }

  type DriveListItem = {
    name: string
    path: string
    isFolder: boolean
    size?: number
    modifiedAt?: string
  }

  type DriveWritePayload = {
    accountOrg?: string
    path?: string
    source?: 'drive' | 'disk'
    docUuid?: string
    name?: string
    targetType?: 'document' | 'file' | 'folder'
    public?: boolean
    password?: string
    expiresAt?: string
    permissions?: Array<{
      subjectType: 'user' | 'email' | 'org' | 'team'
      subjectId: string
      role: 'viewer' | 'commenter' | 'editor' | 'owner'
      email?: string
    }>
  }

  type DriveMoveCopyPayload = {
    accountOrg?: string
    from: string
    to: string
  }

  type DriveUploadPayload = {
    accountOrg?: string
    path?: string
    localPaths?: string[]
  }

  type DriveDownloadPayload = {
    accountOrg?: string
    path: string
    saveTo?: string
  }

  type ShareDownloadPayload = {
    shareId?: string
    docUuid?: string
    name?: string
    password?: string
    path?: string
    saveTo?: string
  }

  type DriveSyncPayload = {
    cachePath: string
    includeHidden?: boolean
  }

  type SyncStartPayload = {
    cachePath: string
  }

  type SyncOpenPayload = {
    cachePath: string
  }

  type SyncCommitPayload = {
    cachePath: string
  }

  type SyncHistoryPayload = {
    uuid: string
  }

  type SyncRollbackPayload = {
    uuid: string
    path: string
    timestamp: string
  }

  type SyncRenamePayload = {
    from: string
    to: string
  }

  type TranslatePayload = {
    text: string
    sourceLang?: string
    targetLang?: string
  }

  type AuthUser = {
    id?: string
    name?: string
    displayName?: string
    firstName?: string
    lastName?: string
    username?: string
    email?: string
    phone?: string
    avatar?: string
    organization?: string
    organizations?: string[]
    roles?: string[]
    groups?: string[]
    permissions?: string[]
    isAdmin?: boolean
    lastLoginAt?: string
  }

  type AuthSession = {
    authenticated: boolean
    user: AuthUser | null
    accessToken?: string
    refreshToken?: string
    expiresAt?: string
    issuedAt?: string
    updatedAt?: string
    subscriptionActive?: boolean
    planType?: string
    offlineDeadline?: string
    lastServerCheck?: string
    accessStatus?: string
    region?: string
    apiUrl?: string
    collabWsUrl?: string
    raw?: any
  }

  type AuthIntent = 'signin' | 'signup' | 'register'

  function normalizeStringList(value: any): string[] {
    if (!Array.isArray(value)) return []
    return value
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') return String(item).trim()
        if (item && typeof item === 'object') {
          return String(item?.name || item?.displayName || item?.id || '').trim()
        }
        return ''
      })
      .filter(Boolean)
  }

  function parseJwtPayload(token: string | undefined): Record<string, any> | null {
    if (!token || typeof token !== 'string') return null
    const parts = token.split('.')
    if (parts.length < 2) return null

    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
      const payloadJson = Buffer.from(normalized, 'base64').toString('utf-8')
      const payload = JSON.parse(payloadJson)
      return payload && typeof payload === 'object' ? payload : null
    } catch {
      return null
    }
  }

  function coerceEpochMs(value: any): number | null {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return null
      return value > 1_000_000_000_000 ? value : value * 1000
    }

    const asNumber = Number(value)
    if (!Number.isNaN(asNumber) && Number.isFinite(asNumber)) {
      return asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000
    }

    const parsedDate = Date.parse(String(value))
    if (Number.isNaN(parsedDate)) return null
    return parsedDate
  }

  function normalizeExpiry(value: any): string | undefined {
    const epochMs = coerceEpochMs(value)
    if (!epochMs) return undefined
    return new Date(epochMs).toISOString()
  }

  function isSessionExpired(session: AuthSession | null | undefined): boolean {
    if (!session) return true
    if (!session.expiresAt) return false
    const expiryMs = coerceEpochMs(session.expiresAt)
    if (!expiryMs) return false
    const expired = expiryMs <= Date.now()
    return expired
  }

  function normalizeSession(payload: any): AuthSession {
    const parsed = payload || {}
    const root = parsed?.session && typeof parsed.session === 'object' ? parsed.session : parsed
    const accessToken =
      root?.accessToken || root?.token || parsed?.accessToken || parsed?.token || ''
    const refreshToken = root?.refreshToken || parsed?.refreshToken || ''
    const accessClaims = parseJwtPayload(accessToken)
    const user =
      root?.user ||
      root?.profile ||
      root?.account ||
      root?.data?.user ||
      parsed?.user ||
      parsed?.profile ||
      accessClaims ||
      null
    const authenticated = Boolean(
      root?.authenticated ??
      root?.isAuthenticated ??
      root?.loggedIn ??
      root?.accessToken ??
      root?.token ??
      parsed?.accessToken ??
      parsed?.token
    )

    const roleCandidates = [
      ...normalizeStringList(user?.roles),
      ...normalizeStringList(root?.roles),
      ...normalizeStringList(parsed?.roles),
      ...normalizeStringList(accessClaims?.roles)
    ]
    const groupCandidates = [
      ...normalizeStringList(user?.groups),
      ...normalizeStringList(root?.groups),
      ...normalizeStringList(parsed?.groups),
      ...normalizeStringList(accessClaims?.groups)
    ]
    const permissionCandidates = [
      ...normalizeStringList(user?.permissions),
      ...normalizeStringList(root?.permissions),
      ...normalizeStringList(parsed?.permissions),
      ...normalizeStringList(accessClaims?.permissions)
    ]

    return {
      authenticated,
      user: user
        ? {
            id: user?.id || user?.sub || user?.userId || accessClaims?.sub,
            name: user?.name || user?.displayName || user?.username || user?.email,
            displayName: user?.displayName || user?.name,
            firstName: user?.firstName || user?.givenName || user?.given_name,
            lastName: user?.lastName || user?.familyName || user?.family_name,
            username: user?.username || user?.preferred_username,
            email: user?.email,
            phone: user?.phone || user?.phoneNumber,
            avatar: user?.avatar || user?.avatarUrl || user?.picture,
            organization:
              user?.organization || user?.owner || root?.organization || accessClaims?.owner,
            organizations: normalizeStringList(user?.organizations),
            roles: Array.from(new Set(roleCandidates)),
            groups: Array.from(new Set(groupCandidates)),
            permissions: Array.from(new Set(permissionCandidates)),
            isAdmin: Boolean(user?.isAdmin ?? user?.is_admin ?? false),
            lastLoginAt: normalizeExpiry(
              user?.lastLoginAt || user?.lastSigninTime || user?.updatedTime
            )
          }
        : null,
      accessToken,
      refreshToken,
      expiresAt: normalizeExpiry(
        root?.expiresAt || root?.exp || parsed?.expiresAt || parsed?.exp || accessClaims?.exp
      ),
      issuedAt: normalizeExpiry(
        root?.issuedAt || root?.iat || parsed?.issuedAt || parsed?.iat || accessClaims?.iat
      ),
      updatedAt: new Date().toISOString(),
      subscriptionActive: Boolean(
        root?.subscription_active ??
        root?.subscriptionActive ??
        parsed?.subscription_active ??
        parsed?.subscriptionActive
      ),
      planType: root?.plan_type || root?.planType || parsed?.plan_type || parsed?.planType,
      offlineDeadline: normalizeExpiry(
        root?.offline_deadline ||
          root?.offlineDeadline ||
          parsed?.offline_deadline ||
          parsed?.offlineDeadline
      ),
      lastServerCheck: normalizeExpiry(
        root?.last_server_check ||
          root?.lastServerCheck ||
          parsed?.last_server_check ||
          parsed?.lastServerCheck
      ),
      accessStatus:
        root?.access_status || root?.accessStatus || parsed?.access_status || parsed?.accessStatus,
      region: root?.region || parsed?.region || '',
      apiUrl: root?.api_url || root?.apiUrl || parsed?.api_url || parsed?.apiUrl || '',
      collabWsUrl:
        root?.collab_ws_url ||
        root?.collabWsUrl ||
        parsed?.collab_ws_url ||
        parsed?.collabWsUrl ||
        '',
      raw: parsed
    }
  }

  function compactSessionForMiddleware(session: AuthSession): AuthSession {
    if (!session) return normalizeSession({})
    return {
      authenticated: Boolean(session.authenticated),
      user: session.user
        ? {
            id: session.user.id,
            name: session.user.name,
            displayName: session.user.displayName,
            firstName: session.user.firstName,
            lastName: session.user.lastName,
            username: session.user.username,
            email: session.user.email,
            phone: session.user.phone,
            avatar: session.user.avatar,
            organization: session.user.organization,
            organizations: session.user.organizations,
            roles: session.user.roles,
            groups: session.user.groups,
            permissions: session.user.permissions,
            isAdmin: session.user.isAdmin,
            lastLoginAt: session.user.lastLoginAt
          }
        : null,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      issuedAt: session.issuedAt,
      updatedAt: session.updatedAt,
      subscriptionActive: session.subscriptionActive,
      planType: session.planType,
      offlineDeadline: session.offlineDeadline,
      lastServerCheck: session.lastServerCheck,
      accessStatus: session.accessStatus,
      region: session.region,
      apiUrl: session.apiUrl,
      collabWsUrl: session.collabWsUrl
    }
  }

  async function fetchAuthSessionFromMiddleware(
    org?: string,
    debug?: boolean
  ): Promise<AuthSession> {
    console.log(`fetchAuthSessionFromMiddleware :`, { org, debug })

    const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
      let timer: NodeJS.Timeout | null = null
      const timeoutPromise = new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('auth:get-session timeout')), timeoutMs)
      })
      try {
        return await Promise.race([promise, timeoutPromise])
      } finally {
        if (timer) clearTimeout(timer)
      }
    }

    let output = ''
    try {
      console.log(`fetchAuthSessionFromMiddleware try:`, { org, debug })

      output = await withTimeout(
        runDdocServerJson('auth:get-session', {
          org,
          protocol: AUTH_PROTOCOL,
          redirectUri: AUTH_CALLBACK_URI,
          // debug: debug === true
          debug: true
        }),
        10000
      )
      console.log(`fetchAuthSessionFromMiddleware try end:`, { org, debug })
    } catch (error) {
      console.warn('auth:get-session failed', error)
      return normalizeSession({})
    }

    const parsed = parseJsonSafely(output) || {}
    const sessionPayload = parsed?.session ?? parsed
    let session = normalizeSession(sessionPayload)
    console.log(`fetchAuthSessionFromMiddleware try after:`, { parsed, sessionPayload, session })

    if (session?.authenticated && !session?.accessToken) {
      try {
        console.log(`fetchAuthSessionFromMiddleware session?.authenticat try :`, { session })

        const refreshOutput = await withTimeout(
          runDdocServerJson('auth:refresh', {
            org,
            protocol: AUTH_PROTOCOL,
            redirectUri: AUTH_CALLBACK_URI,
            // debug: debug === true
            debug: true
          }),
          10000
        )
        const refreshParsed = parseJsonSafely(refreshOutput) || {}
        const refreshPayload = refreshParsed?.session ?? refreshParsed
        const refreshed = normalizeSession(refreshPayload)
        if (refreshed?.accessToken) {
          session = refreshed
        }
        console.log(`fetchAuthSessionFromMiddleware session?.authenticat try end :`, { refreshed })
      } catch (error) {
        console.warn('auth:refresh failed', error)
      }
    }

    return session
  }

  async function storeAuthSessionInMiddleware(session: AuthSession): Promise<void> {
    try {
      const output = await runDdocServerJson('auth:store-session', {
        session: compactSessionForMiddleware(session)
      })
    } catch (error) {
      console.error('storeAuthSessionInMiddleware failed', error)
    }
  }

  async function sendSessionChanged(session: AuthSession) {
    const hasIdentity = Boolean(session?.accessToken || session?.user?.id || session?.user?.email)
    const expired = isSessionExpired(session)
    if (session?.authenticated && hasIdentity && !expired) {
      await storeAuthSessionInMiddleware(session)
    } else {
      await storeAuthSessionInMiddleware(normalizeSession({ authenticated: false }))
    }

    if (_mainWindow && !_mainWindow.isDestroyed()) {
      _mainWindow.webContents.send('auth:session-changed', session)
    }
  }

  function getAuthUrl(value: any): string {
    if (!value) return ''
    if (typeof value === 'string') return value
    return (
      value?.url ||
      value?.authUrl ||
      value?.loginUrl ||
      value?.authorizeUrl ||
      value?.redirectUrl ||
      ''
    )
  }

  async function openAuthInBrowser(_intent: AuthIntent, org?: string) {
    const output = await runDdocServerJson('auth:login-url', {
      intent: _intent,
      org,
      protocol: AUTH_PROTOCOL,
      redirectUri: AUTH_CALLBACK_URI,
      // Identify the desktop client so the backend redirects to our custom
      // scheme instead of falling back to the web app URL (which left the
      // desktop app waiting forever for a callback that never came).
      client: 'desktop',
      returnTo: AUTH_CALLBACK_URI
    })
    const parsed = parseJsonSafely(output) || {}
    const authUrl = getAuthUrl(parsed) || parsed?.url || parsed?.authUrl || ''

    console.log(`runDdocServerJson authUrl :`, { authUrl })

    if (!authUrl) {
      return { ok: false, message: `No auth URL returned for ${_intent}.` }
    }

    await shell.openExternal(authUrl)
    return { ok: true, url: authUrl }
  }

  async function openInviteInBrowser(code?: string) {
    const inviteCode = String(code || '').trim()
    if (!inviteCode) {
      return { ok: false, message: 'Invite code is required.' }
    }

    const output = await runDdocServerJson('auth:join-invite', {
      code: inviteCode,
      protocol: AUTH_PROTOCOL,
      redirectUri: AUTH_CALLBACK_URI
    })
    const parsed = parseJsonSafely(output) || {}
    const authUrl = getAuthUrl(parsed) || parsed?.url || parsed?.authUrl || ''

    if (!authUrl) {
      return { ok: false, message: 'No invite auth URL returned.' }
    }

    await shell.openExternal(authUrl)
    return { ok: true, url: authUrl }
  }

  async function completeAuthWithDeepLink(rawUrl: string, debug?: boolean) {
    if (!rawUrl) return false

    let deepLinkUrl: URL
    try {
      deepLinkUrl = new URL(rawUrl)
    } catch {
      return false
    }

    if (deepLinkUrl.protocol !== `${AUTH_PROTOCOL}:`) return false

    const output = await runDdocServerJson('auth:callback', {
      url: rawUrl,
      protocol: AUTH_PROTOCOL,
      redirectUri: AUTH_CALLBACK_URI,
      // debug: debug === true
      debug: true
    })
    const parsed = parseJsonSafely(output) || {}
    const sessionPayload = parsed?.session ?? parsed
    const session = normalizeSession(sessionPayload)

    if (session.authenticated || session.accessToken) {
      await sendSessionChanged(session)
      return true
    }

    return false
  }

  _deepLinkHandler = async (rawUrl: string) => {
    try {
      await completeAuthWithDeepLink(rawUrl, true)
    } catch (error) {
      console.error('Failed to handle auth deep link', rawUrl, error)
    }
  }

  ipcMain.handle('auth:signin', async (_event, payload) =>
    openAuthInBrowser('signin', payload?.org)
  )
  ipcMain.handle('auth:signup', async (_event, payload) =>
    openAuthInBrowser('signup', payload?.org)
  )
  ipcMain.handle('auth:register', async (_event, payload) =>
    openAuthInBrowser('register', payload?.org)
  )
  ipcMain.handle('auth:join-invite', async (_event, payload) => openInviteInBrowser(payload?.code))

  ipcMain.handle('auth:list-sessions', async () => {
    const output = await runDdocServerJson('auth:list-sessions', {})
    return parseJsonSafely(output) || {}
  })

  ipcMain.handle('auth:set-active-org', async (_event, payload) => {
    const output = await runDdocServerJson('auth:set-active-org', {
      org: payload?.org,
      // debug: payload?.debug === true
      // debug: debug === true
      debug: payload?.debug
    })
    return parseJsonSafely(output) || {}
  })

  ipcMain.handle('auth:get-session', async (_event, payload) => {
    const freshSession = await fetchAuthSessionFromMiddleware(payload?.org, payload?.debug)
    console.log('Fetched session from middleware:', { freshSession })
    const hasIdentity = Boolean(
      freshSession?.accessToken || freshSession?.user?.id || freshSession?.user?.email
    )
    if (freshSession.authenticated && hasIdentity && !isSessionExpired(freshSession)) {
      return freshSession
    }

    return normalizeSession({})
  })

  ipcMain.handle('auth:force-refresh', async (_event, payload) => {
    const output = await runDdocServerJson('auth:force-refresh', {
      org: payload?.org,
      protocol: AUTH_PROTOCOL,
      redirectUri: AUTH_CALLBACK_URI,
      debug: payload?.debug === true
    })
    const parsed = parseJsonSafely(output) || {}
    const sessionPayload = parsed?.session ?? parsed
    const session = normalizeSession(sessionPayload)
    if (session.authenticated) {
      await sendSessionChanged(session)
    }
    return session
  })

  ipcMain.handle('auth:logout', async (_event, payload) => {
    const output = await runDdocServerJson('auth:logout', {
      protocol: AUTH_PROTOCOL,
      redirectUri: AUTH_CALLBACK_URI,
      org: payload?.org,
      debug: payload?.debug === true
    })
    const parsed = parseJsonSafely(output) || {}
    const sessionPayload = parsed?.session ?? parsed
    const session = normalizeSession(sessionPayload)

    if (!session.authenticated) {
      await sendSessionChanged(session)
      return { ok: true, session }
    }

    const fallback = normalizeSession({ authenticated: false, user: null })
    await sendSessionChanged(fallback)
    return { ok: true, session: fallback }
  })

  ipcMain.handle('auth:device-id', async () => {
    const output = await runDdocServerJson('auth:device-id', {})
    return parseJsonSafely(output) || {}
  })

  ipcMain.handle('forms:submit', async (_event, payload) => {
    const output = await runDdocServerJson('forms:submit', payload || {})
    return parseJsonSafely(output) || {}
  })
  ipcMain.handle('forms:list', async (_event, payload) => {
    const output = await runDdocServerJson('forms:list', payload || {})
    return parseJsonSafely(output) || {}
  })
  ipcMain.handle('forms:get', async (_event, payload) => {
    const output = await runDdocServerJson('forms:get', payload || {})
    return parseJsonSafely(output) || {}
  })
  ipcMain.handle('forms:history', async (_event, payload) => {
    const output = await runDdocServerJson('forms:history', payload || {})
    return parseJsonSafely(output) || {}
  })
  ipcMain.handle('fonts:resolve', async (_event, payload) => {
    const output = await runDdocServerJson('fonts:resolve', payload || {})
    return parseJsonSafely(output) || {}
  })

  function normalizeDrivePath(value: string | undefined): string {
    const raw = String(value || '').trim()
    if (!raw || raw === '/' || raw === '.') return ''
    return raw
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/{2,}/g, '/')
  }

  function mapAbsolutePathToRemote(localPath: string): string {
    const resolved = path.resolve(String(localPath || ''))
    const cacheRoot = getCacheDirPath()
    if (cacheRoot) {
      const cacheResolved = path.resolve(cacheRoot)
      const normalizedResolved = path.normalize(resolved)
      const normalizedCache = path.normalize(cacheResolved)
      const resolvedLower = normalizedResolved.toLowerCase()
      const cacheLower = normalizedCache.toLowerCase()
      if (resolvedLower === cacheLower || resolvedLower.startsWith(`${cacheLower}${path.sep}`)) {
        const rel = path.relative(cacheResolved, normalizedResolved).replace(/\\+/g, '/')
        const cleaned = rel.replace(/^\/+/, '')
        return cleaned ? `home/${cleaned}` : 'home'
      }
    }

    if (path.win32.isAbsolute(resolved)) {
      const parsed = path.win32.parse(resolved)
      const drive = parsed.root.replace(/[:\\/]+/g, '').toUpperCase()
      const tail = resolved.slice(parsed.root.length)
      const segments = tail.split(/\\+/).filter(Boolean)
      const joined = [drive, ...segments].filter(Boolean).join('/')
      return joined ? `home/${joined}` : 'home'
    }

    if (path.posix.isAbsolute(resolved)) {
      const joined = resolved.replace(/^\/+/, '').split('/').filter(Boolean).join('/')
      return joined ? `home/${joined}` : 'home'
    }

    const joined = resolved.replace(/\\+/g, '/').replace(/^\/+/, '')
    return joined ? `home/${joined}` : 'home'
  }

  async function collectLocalEntries(rootPath: string) {
    const files: string[] = []
    const dirs: string[] = []

    async function walk(current: string) {
      let entries
      try {
        entries = await fsp.readdir(current, { withFileTypes: true })
      } catch {
        return
      }

      dirs.push(current)

      for (const entry of entries) {
        const full = path.join(current, entry.name)
        if (entry.isDirectory()) {
          await walk(full)
          continue
        }
        if (entry.isFile()) {
          files.push(full)
        }
      }
    }

    await walk(rootPath)
    return { files, dirs }
  }

  function drivePathBasename(targetPath: string): string {
    const normalized = normalizeDrivePath(targetPath)
    if (!normalized) return 'download.bin'
    const parts = normalized.split('/').filter(Boolean)
    return parts[parts.length - 1] || 'download.bin'
  }

  function drivePathDirname(targetPath: string): string {
    const normalized = normalizeDrivePath(targetPath)
    if (!normalized) return ''
    const index = normalized.lastIndexOf('/')
    if (index < 0) return ''
    return normalized.slice(0, index)
  }

  async function getDriveAuthToken(accountOrg?: string): Promise<string> {
    const session = await fetchAuthSessionFromMiddleware(accountOrg)
    const token = session?.accessToken || ''
    if (!token) {
      throw new Error('No active authenticated session for Drive API.')
    }
    return token
  }

  function shouldRetryWithHttp(error: unknown, url: URL) {
    if (!url || url.protocol !== 'https:') return false
    const host = String(url.hostname || '').toLowerCase()
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
    if (!isLocal) return false
    const message = error instanceof Error ? error.message : String(error || '')
    return (
      message.includes('ERR_SSL_WRONG_VERSION_NUMBER') || message.includes('WRONG_VERSION_NUMBER')
    )
  }

  async function fetchWithHttpFallback(url: URL, options: RequestInit) {
    try {
      return await fetch(url.toString(), options)
    } catch (error) {
      if (!shouldRetryWithHttp(error, url)) {
        throw error
      }
      const retryUrl = new URL(url.toString())
      retryUrl.protocol = 'http:'
      return await fetch(retryUrl.toString(), options)
    }
  }

  async function fetchDriveJson(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'DELETE'
      query?: Record<string, string | undefined>
      body?: any
      accountOrg?: string
    } = {}
  ) {
    const token = await getDriveAuthToken(options.accountOrg)
    const url = new URL(endpoint, AUTH_SERVER_BASE_URL)

    for (const [key, value] of Object.entries(options.query || {})) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value)
      }
    }

    const response = await fetchWithHttpFallback(url, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    })

    const contentType = response.headers.get('content-type') || ''
    const payload = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : await response.text().catch(() => '')

    if (!response.ok) {
      const message =
        typeof payload === 'object'
          ? payload?.message || payload?.error || `Drive request failed (${response.status})`
          : payload || `Drive request failed (${response.status})`
      throw new Error(String(message))
    }

    return payload
  }

  async function translateWithServer(payload: TranslatePayload) {
    const text = String(payload?.text || '').trim()
    if (!text) return { ok: false, message: 'No text to translate.' }

    const requestPayload = {
      text,
      sourceLang: payload?.sourceLang,
      targetLang: payload?.targetLang
    }

    try {
      const output = await runDdocServerJson('translate', requestPayload)
      const parsed = parseJsonSafely(output)
      const translated =
        parsed?.text ||
        parsed?.translation ||
        parsed?.translatedText ||
        parsed?.output ||
        parsed?.result ||
        parsed?.data

      if (typeof translated === 'string' && translated.trim()) {
        return { ok: true, text: translated, raw: parsed || output }
      }

      if (output && !parsed) {
        return { ok: true, text: output, raw: output }
      }
    } catch (error) {
      console.warn('dynadoc-middleware translate failed:', error)
    }

    try {
      const url = new URL('/translate', AUTH_SERVER_BASE_URL)
      const response = await fetchWithHttpFallback(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      })

      const contentType = response.headers.get('content-type') || ''
      const payloadBody = contentType.includes('application/json')
        ? await response.json().catch(() => ({}))
        : await response.text().catch(() => '')

      if (!response.ok) {
        const message =
          typeof payloadBody === 'object'
            ? payloadBody?.message || payloadBody?.error || `Translate failed (${response.status})`
            : payloadBody || `Translate failed (${response.status})`
        return { ok: false, message: String(message) }
      }

      const translated =
        payloadBody?.text ||
        payloadBody?.translation ||
        payloadBody?.translatedText ||
        (typeof payloadBody === 'string' ? payloadBody : '')

      if (!translated) {
        return { ok: false, message: 'Translation response was empty.' }
      }

      return { ok: true, text: translated, raw: payloadBody }
    } catch (error) {
      return { ok: false, message: (error as any)?.message || 'Translation failed.' }
    }
  }

  function mapDriveListItem(item: any, parentPath = ''): DriveListItem {
    const name = String(item?.name || item?.base || '')
    const rawPath = String(item?.path || item?.fullPath || '')
    const pathValue = normalizeDrivePath(rawPath || [parentPath, name].filter(Boolean).join('/'))
    const isFolder = Boolean(
      item?.isFolder ?? item?.isDir ?? item?.is_dir ?? item?.folder ?? item?.type === 'folder'
    )
    const sizeValue = Number(item?.size)
    const modifiedAt = item?.modifiedAt || item?.modTime || item?.updatedAt || item?.updatedTime

    return {
      name: name || drivePathBasename(pathValue),
      path: pathValue,
      isFolder,
      size: Number.isFinite(sizeValue) ? sizeValue : undefined,
      modifiedAt: modifiedAt ? String(modifiedAt) : undefined
    }
  }

  async function driveDownloadToFile(payload: DriveDownloadPayload) {
    const relativePath = normalizeDrivePath(payload?.path)
    if (!relativePath) {
      throw new Error('Missing drive path for download.')
    }

    const token = await getDriveAuthToken(payload?.accountOrg)
    const downloadUrl = new URL('/drive/download', AUTH_SERVER_BASE_URL)
    downloadUrl.searchParams.set('path', relativePath)

    const response = await fetchWithHttpFallback(downloadUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const fallback = await response.text().catch(() => '')
      throw new Error(fallback || `Download failed (${response.status})`)
    }

    const bytes = Buffer.from(await response.arrayBuffer())
    const defaultSavePath = path.join(app.getPath('downloads'), drivePathBasename(relativePath))
    const finalSavePath = payload?.saveTo || defaultSavePath
    await fsp.mkdir(path.dirname(finalSavePath), { recursive: true })
    await fsp.writeFile(finalSavePath, bytes)
    return finalSavePath
  }

  function sanitizeDownloadName(value: string) {
    const trimmed = String(value || '').trim()
    if (!trimmed) return 'shared-document'
    return trimmed.replace(/[\\/:*?"<>|]+/g, '_')
  }

  function parseContentDispositionFilename(headerValue: string | null) {
    if (!headerValue) return ''
    const match = /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i.exec(headerValue)
    const raw = match?.[1] || match?.[2] || ''
    if (!raw) return ''
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }

  async function shareDownloadToFile(payload: ShareDownloadPayload) {
    const shareId = String(payload?.shareId || '').trim()
    const docUuid = String(payload?.docUuid || '').trim()
    const name = String(payload?.name || '').trim()
    const password = String(payload?.password || '').trim()

    if (!shareId && !docUuid && !name) {
      throw new Error('Missing share identifiers for download.')
    }

    const downloadUrl = new URL('/share/download', AUTH_SERVER_BASE_URL)
    if (shareId) downloadUrl.searchParams.set('shareId', shareId)
    if (docUuid) downloadUrl.searchParams.set('docUuid', docUuid)
    if (name) downloadUrl.searchParams.set('name', name)
    if (password) downloadUrl.searchParams.set('password', password)

    const token = await fetchAuthSessionFromMiddleware()
      .then((s) => s?.accessToken)
      .catch(() => '')
    const response = await fetchWithHttpFallback(downloadUrl, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })

    if (!response.ok) {
      const fallback = await response.text().catch(() => '')
      throw new Error(fallback || `Download failed (${response.status})`)
    }

    const bytes = Buffer.from(await response.arrayBuffer())
    const contentDisposition = response.headers.get('content-disposition')
    const contentType = response.headers.get('content-type') || ''
    let fileName = parseContentDispositionFilename(contentDisposition)
    if (!fileName) fileName = name
    if (!fileName) fileName = shareId ? `shared-${shareId}` : 'shared-document'
    fileName = sanitizeDownloadName(fileName)
    if (!path.extname(fileName) && contentType.includes('zip')) {
      fileName = `${fileName}.zip`
    }

    const cacheRoot = getCacheDirPath()
    const shareFolder = path.join(
      cacheRoot,
      'shared',
      sanitizeDownloadName(shareId || docUuid || 'share')
    )
    const docFolderName = sanitizeDownloadName(
      name?.replace(path.extname(name), '') ||
        fileName.replace(path.extname(fileName), '') ||
        'document'
    )
    const docFolder = path.join(shareFolder, docFolderName)
    await fsp.mkdir(docFolder, { recursive: true })
    const finalSavePath = payload?.saveTo || path.join(docFolder, fileName)
    await fsp.writeFile(finalSavePath, bytes)
    await fsp
      .writeFile(
        path.join(docFolder, 'share.meta.json'),
        JSON.stringify(
          {
            shareId: shareId || null,
            docUuid: docUuid || null,
            name: name || null,
            downloadedAt: new Date().toISOString(),
            contentType
          },
          null,
          2
        )
      )
      .catch(() => {})

    return { filePath: finalSavePath, fileName, contentType }
  }

  ipcMain.handle('mattermost:prepare', async () => {
    try {
      const output = await runDdocServerJson('auth:mattermost-session', {
        protocol: AUTH_PROTOCOL,
        redirectUri: AUTH_CALLBACK_URI
      })
      const parsed = parseJsonSafely(output) || {}
      const payload = parsed?.raw && typeof parsed.raw === 'object' ? parsed.raw : parsed
      if (parsed?.ok == false) {
        return { ok: false, message: parsed?.message || 'Mattermost session not available.' }
      }

      const baseUrl = payload?.base_url || payload?.baseUrl || ''
      const sessionToken = payload?.token || ''
      if (!baseUrl || !sessionToken) {
        return { ok: false, message: 'Mattermost session not available.' }
      }

      const mmSession = session.fromPartition(MATTERMOST_PARTITION)
      const secure = baseUrl.startsWith('https://')
      await mmSession.cookies.set({
        url: baseUrl,
        name: 'MMAUTHTOKEN',
        value: sessionToken,
        httpOnly: true,
        secure
      })
      if (payload?.user_id) {
        await mmSession.cookies.set({
          url: baseUrl,
          name: 'MMUSERID',
          value: String(payload.user_id),
          httpOnly: true,
          secure
        })
      }

      return { ok: true, baseUrl }
    } catch (error: any) {
      return { ok: false, message: error?.message || 'Mattermost auth failed.' }
    }
  })

  ipcMain.handle('jitsi:get-join-url', async (_event, payload) => {
    try {
      const room = String(payload?.room || '').trim()
      if (!room) {
        return { ok: false, message: 'Room is required.' }
      }

      const token = await getDriveAuthToken()
      const url = new URL('/integrations/jitsi/join', AUTH_SERVER_BASE_URL)
      url.searchParams.set('room', room)

      const response = await fetchWithHttpFallback(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      })

      const payloadBody = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message =
          typeof payloadBody === 'object'
            ? payloadBody?.message ||
              payloadBody?.error ||
              `Jitsi request failed (${response.status})`
            : payloadBody || `Jitsi request failed (${response.status})`
        return { ok: false, message: String(message) }
      }

      const joinUrl = payloadBody?.url || ''
      if (!joinUrl) {
        return { ok: false, message: 'No meeting URL returned.' }
      }
      return { ok: true, url: joinUrl, jwt: payloadBody?.jwt }
    } catch (error: any) {
      return { ok: false, message: error?.message || 'Jitsi auth failed.' }
    }
  })

  ipcMain.handle('drive:get-root', async (_event, payload: { accountOrg?: string } = {}) => {
    try {
      await getDriveAuthToken(payload?.accountOrg)
      return '/'
    } catch {
      return ''
    }
  })

  ipcMain.handle('translate:text', async (_event, payload: TranslatePayload) => {
    return translateWithServer(payload)
  })

  ipcMain.handle(
    'dify:upload-documents',
    async (
      _event,
      payload: {
        localPaths?: string[]
        datasetId?: string
        indexingTechnique?: string
        processRule?: any
        data?: any
      } = {}
    ) => {
      const localPaths = Array.isArray(payload?.localPaths)
        ? payload.localPaths.filter(Boolean)
        : []
      if (!localPaths.length) {
        return { ok: false, message: 'No files selected for upload.' }
      }

      try {
        const token = await getDriveAuthToken()
        const FormDataCtor = (globalThis as any).FormData
        const BlobCtor = (globalThis as any).Blob
        if (!FormDataCtor || !BlobCtor) {
          throw new Error('FormData/Blob are not available in this runtime.')
        }

        const uploaded: string[] = []
        const failed: { path: string; error: string }[] = []
        const endpoint = new URL('/dify/documents/upload', AUTH_SERVER_BASE_URL)

        for (const [index, localPath] of localPaths.entries()) {
          _event.sender.send('dify:upload-progress', {
            file: localPath,
            index,
            total: localPaths.length,
            percent: 0,
            status: 'uploading'
          })

          const fileBuffer = await fsp.readFile(localPath)
          const formData = new FormDataCtor()
          formData.append('file', new BlobCtor([fileBuffer]), path.basename(localPath))

          const datasetId = String(payload?.datasetId || '').trim()
          if (datasetId) formData.append('dataset_id', datasetId)

          const dataPayload: Record<string, any> =
            payload?.data && typeof payload.data === 'object' ? { ...payload.data } : {}
          if (payload?.indexingTechnique) {
            dataPayload.indexing_technique = payload.indexingTechnique
          }
          if (payload?.processRule) {
            dataPayload.process_rule = payload.processRule
          }
          if (Object.keys(dataPayload).length) {
            formData.append('data', JSON.stringify(dataPayload))
          }

          const response = await fetchWithHttpFallback(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`
            },
            body: formData
          })

          if (!response.ok) {
            const text = await response.text().catch(() => '')
            failed.push({
              path: localPath,
              error: text || `Upload failed (${response.status})`
            })
            _event.sender.send('dify:upload-progress', {
              file: localPath,
              index,
              total: localPaths.length,
              percent: 100,
              status: 'failed'
            })
            continue
          }

          uploaded.push(localPath)
          _event.sender.send('dify:upload-progress', {
            file: localPath,
            index,
            total: localPaths.length,
            percent: 100,
            status: 'done'
          })
        }

        return {
          ok: failed.length === 0,
          uploaded,
          failed
        }
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle(
    'dify:list-datasets',
    async (_event, payload: { page?: number; limit?: number; scope?: string } = {}) => {
      try {
        const token = await getDriveAuthToken()
        const url = new URL('/dify/datasets', AUTH_SERVER_BASE_URL)
        if (payload?.page) url.searchParams.set('page', String(payload.page))
        if (payload?.limit) url.searchParams.set('limit', String(payload.limit))
        if (payload?.scope) url.searchParams.set('scope', String(payload.scope))

        const response = await fetchWithHttpFallback(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        const payloadBody = await response.json().catch(() => ({}))
        if (!response.ok) {
          const message =
            typeof payloadBody === 'object'
              ? payloadBody?.message ||
                payloadBody?.error ||
                `Dify list failed (${response.status})`
              : payloadBody || `Dify list failed (${response.status})`
          return { ok: false, message: String(message) }
        }
        return { ok: true, data: payloadBody }
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle('drive:list', async (_event, payload: DriveListPayload = {}) => {
    try {
      const queryPath = normalizeDrivePath(payload.path)
      const response = await fetchDriveJson('/drive/list', {
        method: 'GET',
        query: {
          path: queryPath || undefined
        },
        accountOrg: payload?.accountOrg
      })

      const items = Array.isArray(response) ? response : response?.items || []
      if (!Array.isArray(items)) return [] as DriveListItem[]

      let normalized = items.map((item: any) => mapDriveListItem(item, queryPath))
      const searchQuery = String(payload?.query || '')
        .trim()
        .toLowerCase()
      if (searchQuery) {
        normalized = normalized.filter((item) => item.name.toLowerCase().includes(searchQuery))
      }

      normalized.sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1
        if (!a.isFolder && b.isFolder) return 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })

      return normalized
    } catch (error) {
      console.error('drive:list error', error)
      return [] as DriveListItem[]
    }
  })

  ipcMain.handle('drive:mkdir', async (_event, payload: DriveWritePayload = {}) => {
    const targetPath = normalizeDrivePath(payload?.path)
    if (!targetPath) return { ok: false, message: 'Missing path' }
    try {
      const result = await fetchDriveJson('/drive/mkdir', {
        method: 'POST',
        body: { path: targetPath },
        accountOrg: payload?.accountOrg
      })
      return { ok: true, path: targetPath, result }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('drive:delete-item', async (_event, payload: DriveWritePayload = {}) => {
    const targetPath = normalizeDrivePath(payload?.path)
    if (!targetPath) return { ok: false, message: 'Missing path' }
    try {
      await fetchDriveJson('/drive/item', {
        method: 'DELETE',
        query: { path: targetPath },
        accountOrg: payload?.accountOrg
      })
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('drive:move-item', async (_event, payload: DriveMoveCopyPayload) => {
    const from = normalizeDrivePath(payload?.from)
    const to = normalizeDrivePath(payload?.to)
    if (!from || !to) return { ok: false, message: 'Missing move payload.' }
    try {
      const result = await fetchDriveJson('/drive/move', {
        method: 'POST',
        body: { from, to },
        accountOrg: payload?.accountOrg
      })
      return { ok: true, result, path: to }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('drive:copy-item', async (_event, payload: DriveMoveCopyPayload) => {
    const from = normalizeDrivePath(payload?.from)
    const to = normalizeDrivePath(payload?.to)
    if (!from || !to) return { ok: false, message: 'Missing copy payload.' }
    try {
      const result = await fetchDriveJson('/drive/copy', {
        method: 'POST',
        body: { from, to },
        accountOrg: payload?.accountOrg
      })
      return { ok: true, result, path: to }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  /* ipcMain.handle('drive:upload', async (_event, payload: DriveUploadPayload = {}) => {
    const localPaths = Array.isArray(payload?.localPaths) ? payload.localPaths.filter(Boolean) : []
    const targetPath = normalizeDrivePath(payload?.path)
    if (!localPaths.length) {
      return { ok: false, message: 'No files selected for upload.' }
    }

    try {
      const token = await getDriveAuthToken(payload?.accountOrg)
      const FormDataCtor = (globalThis as any).FormData
      const BlobCtor = (globalThis as any).Blob
      if (!FormDataCtor || !BlobCtor) {
        throw new Error('FormData/Blob are not available in this runtime.')
      }
      const uploaded: string[] = []

      for (const localPath of localPaths) {
        const fileBuffer = await fsp.readFile(localPath)
        const formData = new FormDataCtor()
        formData.append(
          'file',
          new BlobCtor([fileBuffer]),
          path.basename(localPath)
        )
        formData.append('path', targetPath ? `${targetPath}/` : '')

        const uploadUrl = new URL('/drive/upload', AUTH_SERVER_BASE_URL)
        const response = await fetchWithHttpFallback(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        })

        if (!response.ok) {
          const text = await response.text().catch(() => '')
          throw new Error(text || `Upload failed (${response.status})`)
        }

        uploaded.push(path.basename(localPath))
      }

      return { ok: true, uploaded }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })
 */

  ipcMain.handle('drive:upload', async (_event, payload: DriveUploadPayload = {}) => {
    const localPaths = Array.isArray(payload?.localPaths) ? payload.localPaths.filter(Boolean) : []
    const targetPath = normalizeDrivePath(payload?.path)

    if (!localPaths.length) {
      return { ok: false, message: 'No files selected for upload.' }
    }

    try {
      const token = await getDriveAuthToken(payload?.accountOrg)

      // In Node.js/Electron Main, we use the global FormData or a polyfill
      const FormDataCtor = (globalThis as any).FormData
      const BlobCtor = (globalThis as any).Blob

      if (!FormDataCtor || !BlobCtor) {
        throw new Error('FormData/Blob are not available in this runtime.')
      }

      const uploaded: string[] = []

      for (const localPath of localPaths) {
        const fileBuffer = await fsp.readFile(localPath)
        const fileName = path.basename(localPath)

        const formData = new FormDataCtor()

        // 'file' key must match c.FormFile("file") in your Go code
        formData.append('file', new BlobCtor([fileBuffer]), fileName)

        // 'path' key must match c.FormValue("path") in your Go code
        // We ensure targetPath is passed as a directory string
        formData.append('path', targetPath || '')

        // const uploadUrl = new URL('/api/ipc/invoke', AUTH_SERVER_BASE_URL);
        const uploadUrl = new URL('/drive/upload', AUTH_SERVER_BASE_URL)

        const response = await fetchWithHttpFallback(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
            // Note: DO NOT set Content-Type header manually when using FormData
            // The fetch API will automatically set it with the correct boundary
          },
          body: formData
        })

        const result = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(result.error || `Upload failed (${response.status})`)
        }

        uploaded.push(fileName)
      }

      return { ok: true, uploaded }
    } catch (error) {
      console.error('IPC drive:upload error:', error)
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('drive:sync-doc', async (_event, payload: DriveSyncPayload) => {
    const cachePath = String(payload?.cachePath || '').trim()
    if (!cachePath) {
      return { ok: false, message: 'Missing document cachePath.' }
    }

    try {
      const token = await getDriveAuthToken()
      const FormDataCtor = (globalThis as any).FormData
      const BlobCtor = (globalThis as any).Blob
      if (!FormDataCtor || !BlobCtor) {
        throw new Error('FormData/Blob are not available in this runtime.')
      }

      const { files, dirs } = await collectLocalEntries(cachePath)

      for (const dir of dirs) {
        const remoteDir = normalizeDrivePath(mapAbsolutePathToRemote(dir))
        if (!remoteDir) continue
        await fetchDriveJson('/drive/mkdir', {
          method: 'POST',
          body: { path: remoteDir }
        })
      }

      const uploaded: string[] = []
      const failed: { path: string; error: string }[] = []

      for (const filePath of files) {
        const remoteFilePath = normalizeDrivePath(mapAbsolutePathToRemote(filePath))
        if (!remoteFilePath) continue
        const remoteParent = remoteFilePath.split('/').slice(0, -1).join('/')

        const fileBuffer = await fsp.readFile(filePath)
        const formData = new FormDataCtor()
        formData.append('file', new BlobCtor([fileBuffer]), path.basename(filePath))
        formData.append('path', remoteParent ? `${remoteParent}/` : '')

        const uploadUrl = new URL('/drive/upload', AUTH_SERVER_BASE_URL)
        const response = await fetchWithHttpFallback(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        })

        if (!response.ok) {
          const text = await response.text().catch(() => '')
          failed.push({
            path: filePath,
            error: text || `Upload failed (${response.status})`
          })
          continue
        }

        console.log('drive:sync-doc ', {
          response,
          ok: failed.length === 0,
          uploadedCount: uploaded.length,
          totalCount: files.length,
          failed
        })

        uploaded.push(filePath)
      }

      return {
        ok: failed.length === 0,
        uploadedCount: uploaded.length,
        totalCount: files.length,
        failed
      }
    } catch (error: any) {
      return { ok: false, message: error?.message || 'Sync failed.' }
    }
  })

  ipcMain.handle('sync:start', async (_event, payload: SyncStartPayload) => {
    const cachePath = String(payload?.cachePath || '').trim()
    if (!cachePath) {
      return { ok: false, message: 'Missing document cachePath.' }
    }

    if (_syncWatchers.has(cachePath)) {
      return { ok: true, running: true }
    }

    try {
      const binaryPath = getBinaryPath('dynadoc-middleware')
      // const binaryPath = getBinaryPath('dynadoc-middleware', true)
      const proc = spawn(binaryPath, ['sync:watch', JSON.stringify({ cachePath })], {
        env: process.env
      })

      _syncWatchers.set(cachePath, proc)

      proc.on('error', (error) => {
        console.error('dynadoc-middleware sync:watch error', error)
      })
      proc.on('close', () => {
        _syncWatchers.delete(cachePath)
      })

      return { ok: true }
    } catch (error: any) {
      return { ok: false, message: error?.message || 'Failed to start sync watcher.' }
    }
  })

  ipcMain.handle('sync:stop', async (_event, payload: SyncStartPayload) => {
    const cachePath = String(payload?.cachePath || '').trim()
    if (!cachePath) {
      return { ok: false, message: 'Missing document cachePath.' }
    }

    const proc = _syncWatchers.get(cachePath)
    if (proc) {
      proc.kill()
      _syncWatchers.delete(cachePath)
    }

    return { ok: true }
  })

  ipcMain.handle('sync:open', async (_event, payload: SyncOpenPayload) => {
    const cachePath = String(payload?.cachePath || '').trim()
    if (!cachePath) {
      return { ok: false, message: 'Missing document cachePath.' }
    }

    try {
      const output = await runDdocServerJson('sync:open', { cachePath })
      const parsed = parseJsonSafely(output) || {}
      if (!parsed?.ok) {
        return { ok: false, message: parsed?.message || 'Sync state failed.' }
      }
      return parsed
    } catch (error: any) {
      return { ok: false, message: error?.message || 'Sync state failed.' }
    }
  })

  ipcMain.handle('sync:commit', async (_event, payload: SyncCommitPayload) => {
    const cachePath = String(payload?.cachePath || '').trim()
    if (!cachePath) {
      return { ok: false, message: 'Missing document cachePath.' }
    }

    try {
      const output = await runDdocServerJson('sync:commit', { cachePath })
      const parsed = parseJsonSafely(output) || {}
      if (!parsed?.ok) {
        return { ok: false, message: parsed?.message || 'Sync failed.' }
      }
      return parsed
    } catch (error: any) {
      return { ok: false, message: error?.message || 'Sync failed.' }
    }
  })

  ipcMain.handle('sync:history', async (_event, payload: SyncHistoryPayload) => {
    const uuid = String(payload?.uuid || '').trim()
    if (!uuid) {
      return { ok: false, message: 'Missing uuid.' }
    }

    try {
      const output = await runDdocServerJson('sync:history', { uuid })
      const parsed = parseJsonSafely(output) || {}
      if (!parsed?.ok) {
        return { ok: false, message: parsed?.message || 'History failed.' }
      }
      return parsed
    } catch (error: any) {
      return { ok: false, message: error?.message || 'History failed.' }
    }
  })

  ipcMain.handle('sync:rollback', async (_event, payload: SyncRollbackPayload) => {
    const uuid = String(payload?.uuid || '').trim()
    const pathValue = String(payload?.path || '').trim()
    const timestamp = String(payload?.timestamp || '').trim()
    if (!uuid || !pathValue || !timestamp) {
      return { ok: false, message: 'Missing rollback parameters.' }
    }

    try {
      const output = await runDdocServerJson('sync:rollback', { uuid, path: pathValue, timestamp })
      const parsed = parseJsonSafely(output) || {}
      if (!parsed?.ok) {
        return { ok: false, message: parsed?.message || 'Rollback failed.' }
      }
      return parsed
    } catch (error: any) {
      return { ok: false, message: error?.message || 'Rollback failed.' }
    }
  })

  ipcMain.handle('sync:rename', async (_event, payload: SyncRenamePayload) => {
    const from = String(payload?.from || '').trim()
    const to = String(payload?.to || '').trim()
    if (!from || !to) {
      return { ok: false, message: 'Missing rename parameters.' }
    }

    try {
      const output = await runDdocServerJson('sync:rename', { from, to })
      const parsed = parseJsonSafely(output) || {}
      if (!parsed?.ok) {
        return { ok: false, message: parsed?.message || 'Rename failed.' }
      }
      return parsed
    } catch (error: any) {
      return { ok: false, message: error?.message || 'Rename failed.' }
    }
  })

  ipcMain.handle('drive:download', async (_event, payload: DriveDownloadPayload) => {
    try {
      const savedPath = await driveDownloadToFile(payload)
      return { ok: true, savePath: savedPath }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('drive:share', async (_event, payload: DriveWritePayload = {}) => {
    try {
      const source = payload?.source || 'drive'
      const pathValue =
        source === 'drive' ? normalizeDrivePath(payload?.path) : String(payload?.path || '').trim()
      const output = await runDdocServerJson('drive:share', {
        ...payload,
        path: pathValue,
        source
      })
      const result = parseJsonSafely(output)
      if (result && typeof result.ok === 'boolean' && !result.ok) {
        throw new Error(result.message || 'Share failed')
      }
      return { ok: true, result: result?.data || result }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
        code: 501
      }
    }
  })

  ipcMain.handle('drive:shares', async (_event, payload: { accountOrg?: string } = {}) => {
    try {
      const output = await runDdocServerJson('drive:shares', payload)
      const result = parseJsonSafely(output)
      if (result && typeof result.ok === 'boolean' && !result.ok) {
        throw new Error(result.message || 'List shares failed')
      }
      const data = result?.data || result
      return { ok: true, items: data?.items || [] }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('drive:get-share', async (_event, payload: DriveWritePayload = {}) => {
    try {
      const pathValue = String(payload?.path || '').trim()
      if (!pathValue) return { ok: false, message: 'Missing share path.' }
      const output = await runDdocServerJson('drive:get-share', { ...payload, path: pathValue })
      const result = parseJsonSafely(output)
      if (result && typeof result.ok === 'boolean' && !result.ok) {
        throw new Error(result.message || 'Get share failed')
      }
      return { ok: true, result: result?.data || result }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle(
    'drive:revoke-share',
    async (_event, payload: { shareId?: string; accountOrg?: string }) => {
      try {
        const shareId = String(payload?.shareId || '').trim()
        if (!shareId) return { ok: false, message: 'Missing shareId.' }
        const output = await runDdocServerJson('drive:revoke-share', payload)
        const result = parseJsonSafely(output)
        if (result && typeof result.ok === 'boolean' && !result.ok) {
          throw new Error(result.message || 'Revoke share failed')
        }
        return { ok: true, result: result?.data || result }
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle(
    'share:resolve',
    async (
      _event,
      payload: { shareId?: string; docUuid?: string; name?: string; password?: string }
    ) => {
      try {
        const output = await runDdocServerJson('share:resolve', payload || {})
        const result = parseJsonSafely(output)
        if (result && typeof result.ok === 'boolean' && !result.ok) {
          return result
        }
        return { ok: true, result: result?.data || result }
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle('share:download', async (_event, payload: ShareDownloadPayload) => {
    try {
      const result = await shareDownloadToFile(payload || {})
      return { ok: true, ...result }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('share:audit', async (_event, payload: { shareId?: string; action?: string }) => {
    try {
      const output = await runDdocServerJson('share:audit', payload || {})
      const result = parseJsonSafely(output)
      if (result && typeof result.ok === 'boolean' && !result.ok) {
        return result
      }
      return { ok: true, result: result?.data || result }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle(
    'share:audit-list',
    async (_event, payload: { shareId?: string; limit?: number }) => {
      try {
        const output = await runDdocServerJson('share:audit-list', payload || {})
        const result = parseJsonSafely(output)
        if (result && typeof result.ok === 'boolean' && !result.ok) {
          return result
        }
        const data = result?.data || result
        return { ok: true, items: data?.items || [] }
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle('share:rotate', async (_event, payload: { shareId?: string }) => {
    try {
      const output = await runDdocServerJson('share:rotate', payload || {})
      const result = parseJsonSafely(output)
      if (result && typeof result.ok === 'boolean' && !result.ok) {
        return result
      }
      return { ok: true, result: result?.data || result }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle(
    'share:edit-lock',
    async (
      _event,
      payload: {
        shareId?: string
        enabled?: boolean
        lockMinutes?: number
        lockUntil?: string
        reason?: string
      }
    ) => {
      try {
        const output = await runDdocServerJson('share:edit-lock', payload || {})
        const result = parseJsonSafely(output)
        if (result && typeof result.ok === 'boolean' && !result.ok) {
          return result
        }
        return { ok: true, result: result?.data || result }
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    }
  )

  ipcMain.handle('share:principals', async (_event, payload: { q?: string; query?: string }) => {
    try {
      const output = await runDdocServerJson('share:principals', payload || {})
      const result = parseJsonSafely(output)
      if (result && typeof result.ok === 'boolean' && !result.ok) {
        return result
      }
      const data = result?.data || result
      return { ok: true, items: data?.items || [] }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('chat:sessions:list', async () => {
    try {
      const output = await runDdocServerJson('chat:sessions:list', {})
      return parseJsonSafely(output) || { ok: false, message: 'Invalid response' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('chat:sessions:get', async (_event, payload: { sessionId: string }) => {
    try {
      const output = await runDdocServerJson('chat:sessions:get', payload || {})
      return parseJsonSafely(output) || { ok: false, message: 'Invalid response' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('chat:sessions:upsert', async (_event, payload: Record<string, any>) => {
    try {
      const output = await runDdocServerJson('chat:sessions:upsert', payload || {})
      return parseJsonSafely(output) || { ok: false, message: 'Invalid response' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('chat:sessions:delete', async (_event, payload: { sessionId: string }) => {
    try {
      const output = await runDdocServerJson('chat:sessions:delete', payload || {})
      return parseJsonSafely(output) || { ok: false, message: 'Invalid response' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle(
    'drive:open-item',
    async (_event, payload: { rootPath?: string; path: string; accountOrg?: string }) => {
      const targetPath = normalizeDrivePath(payload?.path)
      if (!targetPath) return true

      try {
        const tempPath = path.join(
          app.getPath('temp'),
          'dynadoc-drive',
          `${Date.now()}-${drivePathBasename(targetPath)}`
        )
        const savedPath = await driveDownloadToFile({
          path: targetPath,
          saveTo: tempPath,
          accountOrg: payload?.accountOrg
        })
        // The item is named by whoever put it in the drive, and opening it
        // lets the OS pick the handler. Refuse the kinds the OS would run.
        if (isExecutablePath(savedPath)) {
          console.warn('[drive] refused to open an executable drive item')
          return false
        }
        await shell.openPath(savedPath)
        return true
      } catch (error) {
        console.error('drive:open-item error', error)
        return false
      }
    }
  )

  /* ipcMain.on('show-context-menu', (event, { items, x, y }) => {
    const menu = new Menu()
    items.forEach((i) => menu.append(new MenuItem({ label: i.label, click: i.click })))
    menu.popup({ window: event.sender.getOwnerBrowserWindow(), x, y })
  }) */

  /* ipcMain.handle('delete-file', async (event, filePath) => {
    console.log('Deleting', filePath)
    try {
      const stats = await fs.stat(filePath)
      if (stats.isDirectory()) {
        await fs.rmdir(filePath, { recursive: true })
      } else {
        await fs.unlink(filePath)
      }
      return true
    } catch(error) {
    console.log('Deleting error', filePath, error)
      return false
    }
  }) */

  /*  ptyProcess = nodePtySpawn(shellNodePtySpawn || '/bin/bash', [], {
     name: 'xterm-color',
     cols: 80,
     rows: 30,
     cwd: process.env.HOME,
     env: process.env
   })

   ptyProcess.onData(( data) => {
     // console.log('ptyProcess data:', data)

     // const win = BrowserWindow.fromWebContents(event.sender)

     mainWindow.webContents.send('terminal-output', data)
     // mainWindow?.webContents.send('terminal-output', data)
   })

   ipcMain.on('terminal-input', (event, data) => {
     // console.log("terminal input data ", data)
     ptyProcess.write(data)
   }) */

  // import { ipcMain } from 'electron'
  // import { spawn } from 'node-pty'
  // import os from 'os'

  const terminals = new Map<number, any>()
  let nextTerminalId = 1

  ipcMain.handle('terminal-open', async (event, folderPath?: string) => {
    console.log('Opening terminal in folder:', folderPath)
    const shellNodePtySpawn =
      process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash'

    // const shellNodePtySpawn = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'

    const cwd = folderPath || os.homedir()
    const termId = nextTerminalId++

    console.log('Opening terminal in shellNodePtySpawn:', shellNodePtySpawn, { cwd, termId })
    const ptyProcess = nodePtySpawn(shellNodePtySpawn, [], {
      name: 'xterm-color',
      cwd,
      env: process.env

      // cols: 80,
      // rows: 30,
    })

    terminals.set(termId, ptyProcess)

    ptyProcess.onData((data) => {
      // console.log('terminal in shellNodePtySpawn onData:', { data, ptyProcess })
      event.sender.send('terminal-output', { id: termId, data })
    })

    ptyProcess.onExit(() => {
      // console.log('terminal in shellNodePtySpawn onExit:', { ptyProcess })

      terminals.delete(termId)
      event.sender.send('terminal-closed', { id: termId })
    })

    return { id: termId, folderPath: cwd }
  })

  ipcMain.on('terminal-input', (event, { id, data }) => {
    // console.log('terminal-input in shellNodePtySpawn onData:', { id, data })

    const term = terminals.get(id)
    if (term) term.write(data)
    // console.log('terminal-input in shellNodePtySpawn term:', { term })
  })

  ipcMain.on('terminal-kill', (event, id) => {
    // console.log('terminal-kill in shellNodePtySpawn onData:', shellNodePtySpawn, { id })

    const term = terminals.get(id)
    if (term) term.kill()
    terminals.delete(id)
  })

  /* function getBinaryPath() {
    let basePath
    if (app.isPackaged) {
      basePath = path.join(process.resourcesPath, 'bin')
    } else {
      // In dev, point to your local folder
      basePath = path.join(__dirname, '../../resources/bin')
    }

    if (os.platform() === 'win32') return path.join(basePath, 'win/DocxToHtml.exe')
    if (os.platform() === 'darwin') {
      return os.arch() === 'arm64'
        ? path.join(basePath, 'mac-arm64/DocxToHtml')
        : path.join(basePath, 'mac/DocxToHtml')
    }
    return path.join(basePath, 'linux/DocxToHtml')
  } */

  function convertOfficeToHtml(inputPath, outputPath) {
    console.log('convert-office-to-html :', { inputPath, outputPath })
    return new Promise((resolve, reject) => {
      let binaryFolder
      let binaryFile = 'DocxToHtml'
      try {
        console.log('binaryFolder', binaryFolder)

        const exePath = getBinaryPath('DocxToHtml')

        console.log('exePath', exePath)

        execFile(exePath, [inputPath, outputPath], (err, stdout, stderr) => {
          if (err) {
            console.error('Binary execution error:', stderr || err.message)
            // Don't just reject; return a string that the frontend can catch
            resolve(`Error: ${stderr || err.message}`)
            return
          }

          // If stdout is empty, the binary might be writing to the outputPath directly
          // In that case, we should return the outputPath as the resolved path
          const result = stdout.trim() || outputPath
          console.log('execFile result', { result, stdout, outputPath })
          resolve(result)
        })
      } catch (error) {
        console.log('Error determining binary path:', error)
        reject(error)
      }
    })
  }

  ipcMain.handle('convert-docx', async (event, inputPath, outputPath) => {
    // ipcMain.handle('convert-docx-to-html', async (event, inputPath, outputPath) => {
    console.log('convert-docx-to-html :', { inputPath, outputPath })
    return convertOfficeToHtml(inputPath, outputPath)
    // return new Promise((resolve, reject) => {
    //   let binaryFolder
    //   let binaryFile = 'DocxToHtml'
    //   try {
    //     console.log('binaryFolder', binaryFolder)
    //     /*  if (os.platform() === 'win32') {
    //        binaryFolder = 'win/DocxToHtml.exe'
    //      } else if (os.platform() === 'darwin') {
    //        // Handle Intel vs Apple Silicon
    //        binaryFolder = os.arch() === 'arm64' ? 'mac-arm64/DocxToHtml' : 'mac/DocxToHtml'
    //      } else {
    //        binaryFolder = 'linux/DocxToHtml'
    //      }
    //      console.log('binaryFolder got', binaryFolder)

    //      const exePath = getBinaryPath(binaryFile) */

    //     const exePath = getBinaryPath('DocxToHtml')

    //     // const exePath = getBinaryPath()
    //     // const exePath = path.join(getBinaryPath(), 'bin', binaryFolder)
    //     // const exePath = path.join(process.resourcesPath, 'bin', binaryFolder)

    //     console.log('exePath', exePath)
    //     /* execFile(exePath, [inputPath, outputPath], (err, stdout, stderr) => {
    //       if (err) reject(stderr || err.message)
    //       else resolve(stdout.trim())
    //     }) */

    //     execFile(exePath, [inputPath, outputPath], (err, stdout, stderr) => {
    //       if (err) {
    //         console.error('Binary execution error:', stderr || err.message);
    //         // Don't just reject; return a string that the frontend can catch
    //         resolve(`Error: ${stderr || err.message}`);
    //         return;
    //       }

    //       // If stdout is empty, the binary might be writing to the outputPath directly
    //       // In that case, we should return the outputPath as the resolved path
    //       const result = stdout.trim() || outputPath;
    //       console.log('execFile result', { result, stdout, outputPath })
    //       resolve(result);
    //     });

    //   } catch (error) {
    //     console.log('Error determining binary path:', error)
    //   }
    // })
  })

  ipcMain.handle('convert-pptx', async (event, inputPath, outputPath) => {
    console.log('convert-pptx :', event, inputPath, outputPath)

    return convertOfficeToHtml(inputPath, outputPath)

    // return new Promise((resolve, reject) => {
    //   let binaryFolder
    //   let binaryFile = 'DocxToHtml'
    //   try {
    //     /* if (os.platform() === 'win32') {
    //       binaryFolder = 'win/DocxToHtml.exe'
    //     } else if (os.platform() === 'darwin') {
    //       binaryFolder = os.arch() === 'arm64' ? 'mac-arm64/DocxToHtml' : 'mac/DocxToHtml'
    //     } else {
    //       binaryFolder = 'linux/DocxToHtml'
    //     }

    //     const exePath = getBinaryPath(binaryFile)
    //      */
    //     const exePath = getBinaryPath('DocxToHtml')

    //     /* execFile(exePath, [inputPath, outputPath], (err, stdout, stderr) => {
    //       if (err) reject(stderr || err.message)
    //       else resolve(stdout.trim())
    //     }) */

    //     execFile(exePath, [inputPath, outputPath], (err, stdout, stderr) => {
    //       if (err) {
    //         console.error('Binary execution error:', stderr || err.message);
    //         // Don't just reject; return a string that the frontend can catch
    //         resolve(`Error: ${stderr || err.message}`);
    //         return;
    //       }

    //       // If stdout is empty, the binary might be writing to the outputPath directly
    //       // In that case, we should return the outputPath as the resolved path
    //       const result = stdout.trim() || outputPath;
    //       console.log('execFile result', { result, stdout, outputPath })
    //       resolve(result);
    //     });
    //   } catch (error) {
    //     console.log('Error determining binary path:', error)
    //     reject(error)
    //   }
    // })
  })

  async function convertOnlyOffice(inputPath, outputPathDir, outputType = 'pdf') {
    return new Promise((resolve, reject) => {
      const outputPath = outputPathDir
        ? path.join(
            outputPathDir,
            path.basename(inputPath, path.extname(inputPath)) + `.${outputType}`
          )
        : inputPath.replace(/\.[^.]+$/, `.${outputType}`)
      const tmpScript = join(getCacheDirPath(), `convert_${Date.now()}.docbuilder`)
      // const tmpScript = join(Utils.getCacheDirPath(), `convert_${Date.now()}.docbuilder`);
      // const tmpScript = join(os.tmpdir(), `convert_${Date.now()}.docbuilder`);

      // This is the Document Builder script (DSL, not JavaScript)
      /* const scriptContent = `
      var input = "${inputPath.replace(/\\/g, "\\\\")}";
      var output = "${outputPath.replace(/\\/g, "\\\\")}";
      builder.OpenFile("${inputPath.replace(/\\/g, "\\\\")}");
      builder.SaveFile("${outputType}", "${outputPath.replace(/\\/g, "\\\\")}");
      builder.CloseFile();
    `;  */
      const scriptContent = `
      builder.OpenFile("${inputPath.replace(/\\/g, '\\\\')}");
      builder.SaveFile("${outputType}", "${outputPath.replace(/\\/g, '\\\\')}");
      builder.CloseFile();
    `
      console.log('scriptContent :', scriptContent)

      fs.writeFileSync(tmpScript, scriptContent, 'utf8')

      const binary =
        process.platform === 'win32'
          ? 'onlyoffice-docbuilder/docbuilder.exe'
          : 'onlyoffice-docbuilder/docbuilder'
      //   : join(process.resourcesPath, 'documentbuilder', 'documentbuilder');

      const binaryFile = getBinaryPath(binary)

      console.log('scriptContent :', scriptContent, binaryFile, tmpScript)
      execFile(binaryFile, [tmpScript], (error, stdout, stderr) => {
        if (error) {
          console.error('Conversion error:', stderr)
          reject(error)
        } else {
          resolve(outputPath)
        }
      })
    })
  }

  /* async function convertOnlyOffice(inputPath, outputType = 'pdf') {
    return new Promise((resolve, reject) => {
      const outputPath = inputPath.replace(/\.[^.]+$/, `.${outputType}`);
      const scriptPath = join(app.getPath('userData'), 'convert.js');

      // Create a temporary ONLYOFFICE script
      const script = `
      builder.OpenFile("${inputPath}");
      builder.SaveFile("${outputType}", "${outputPath}");
      builder.CloseFile();
    `;
      fs.writeFileSync(scriptPath, script);

      const binary = join(process.resourcesPath, 'documentbuilder'); // or docbuilder.exe on Windows

      execFile(binary, [scriptPath], (error, stdout, stderr) => {
        if (error) {
          console.error(stderr);
          reject(error);
        } else {
          resolve(outputPath);
        }
      });
    });
  } */

  // ipcMain.handle('convert-doc', async (_event, filePath, type) => {
  /* ipcMain.handle('convert-docx-to-html', async (event, inputPath, outputPath) => {
    console.log('convert-docx-to-html :', inputPath, outputPath)
    // return await convertOnlyOffice(inputPath, outputPath, 'odt');
    return await convertOnlyOffice(inputPath, outputPath, 'html');
    // return await convertOnlyOffice(inputPath, outputPath);
  }); */

  /* function getTectonicPath() {
    const base = path.join(__dirname, 'resources', 'bin');
    switch (os.platform()) {
      case 'win32':
        return path.join(base, 'win', 'tectonic.exe');
      case 'darwin':
        return path.join(base, 'mac', 'tectonic');
      case 'linux':
        return path.join(base, 'linux', 'tectonic');
      default:
        throw new Error('Unsupported platform');
    }
  } */

  /* ipcMain.handle('latex:compile', async (_, texFilePath: string) => {
    const outputDir = path.dirname(texFilePath);
    return new Promise((resolve, reject) => {
      exec(`tectonic -o ${outputDir} ${texFilePath}`, (err, stdout, stderr) => {
        if (err) return reject(stderr);
        resolve(path.join(outputDir, path.basename(texFilePath, '.tex') + '.pdf'));
      });
    });
  }); */

  /*
  import { download } from 'electron-dl';

async function downloadTectonic(mainWindow: BrowserWindow) {
  const url = 'https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic-x.y.z/...';
  const file = await download(mainWindow, url, { directory: path.join(app.getPath('userData'), 'tectonic') });
  fs.chmodSync(file.getPath(), 0o755);
  return file.getPath();
}

  */

  ipcMain.handle('latex:compile', async (_, texFilePath: string) => {
    console.log('latex:compile start', texFilePath)
    const tectonic = getBinaryPath('tectonic')
    const outputDir = path.dirname(texFilePath)
    console.log('latex:compile ', tectonic, outputDir)
    return new Promise((resolve, reject) => {
      execFile(tectonic, ['-o', outputDir, texFilePath], (err, stdout, stderr) => {
        console.log('latex:compile ex ', err, stdout, stderr)
        if (err) return reject(stderr)
        resolve(path.join(outputDir, path.basename(texFilePath, '.tex') + '.pdf'))
      })
    })
  })

  ipcMain.handle('latex:save-temp-tex', async (_, content: string) => {
    const tempPath = path.join(__dirname, 'temp.tex')
    fs.writeFileSync(tempPath, content, 'utf-8')
    return tempPath
  })

  const defaultLatexTemplate = (title: string) => `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\title{${title}}
\\author{Dynadoc}
\\date{\\today}
\\begin{document}
\\maketitle

Hello from Dynadoc \\LaTeX!

\\end{document}
`

  async function listFilesRecursive(dirPath: string, rootPath: string): Promise<any[]> {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const results: any[] = []
    for (const entry of entries) {
      const absolute = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        results.push({
          path: absolute,
          relativePath: path.relative(rootPath, absolute),
          isDir: true
        })
        const nested = await listFilesRecursive(absolute, rootPath)
        results.push(...nested)
      } else {
        const info = await stat(absolute).catch(() => null)
        results.push({
          path: absolute,
          relativePath: path.relative(rootPath, absolute),
          isDir: false,
          size: info?.size || 0,
          updatedAt: info?.mtimeMs || 0
        })
      }
    }
    return results
  }

  ipcMain.handle(
    'latex:project:init',
    async (_event, payload: { projectDir: string; title?: string }) => {
      const projectDir = payload?.projectDir
      if (!projectDir) return null
      fs.mkdirSync(projectDir, { recursive: true })
      const mainFilePath = path.join(projectDir, 'main.tex')
      if (!fs.existsSync(mainFilePath)) {
        fs.writeFileSync(
          mainFilePath,
          defaultLatexTemplate(payload?.title || 'Untitled LaTeX'),
          'utf-8'
        )
      }
      return { projectDir, mainFilePath }
    }
  )

  ipcMain.handle('latex:project:list', async (_event, projectDir: string) => {
    if (!projectDir || !fs.existsSync(projectDir)) return []
    return listFilesRecursive(projectDir, projectDir)
  })

  ipcMain.handle('latex:project:read', async (_event, filePath: string) => {
    if (!filePath || !fs.existsSync(filePath)) return ''
    return fs.readFileSync(filePath, 'utf-8')
  })

  ipcMain.handle('latex:project:write', async (_event, filePath: string, content: string) => {
    if (!filePath) return false
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content ?? '', 'utf-8')
    return true
  })

  ipcMain.handle(
    'latex:project:watch',
    async (event, payload: { projectId: string; projectDir: string }) => {
      const { projectId, projectDir } = payload || {}
      if (!projectId || !projectDir) return false
      if (latexProjectWatchers.has(projectId)) return true
      const watcher = chokidar.watch(projectDir, {
        persistent: true,
        ignoreInitial: true,
        ignored: ['**/node_modules/**', '**/.git/**']
      })
      watcher.on('all', (changeType, changedPath) => {
        event.sender.send('latex:project:changed', {
          projectId,
          changeType,
          path: changedPath
        })
      })
      latexProjectWatchers.set(projectId, watcher)
      return true
    }
  )

  ipcMain.handle('latex:project:unwatch', async (_event, projectId: string) => {
    if (!projectId) return false
    const watcher = latexProjectWatchers.get(projectId)
    if (watcher) {
      await watcher.close()
      latexProjectWatchers.delete(projectId)
    }
    return true
  })

  ipcMain.handle(
    'latex:project:compile',
    async (event, payload: { projectId: string; texFilePath: string }) => {
      const projectId = payload?.projectId || ''
      const texFilePath = payload?.texFilePath || ''
      if (!texFilePath) return null
      const tectonic = getBinaryPath('tectonic')
      // ensureExecutable(tectonic);

      return new Promise((resolve, reject) => {
        const workerPath = path.join(__dirname, 'workers', 'latexCompile.worker.js')
        const worker = new Worker(workerPath, { type: 'module' } as any)
        worker.postMessage({ texFilePath, tectonicPath: tectonic })
        worker.on('message', (message) => {
          if (message?.type === 'log') {
            event.sender.send('latex:compile:log', {
              projectId,
              stream: message.stream,
              message: message.message
            })
            return
          }
          if (message?.type === 'done') {
            event.sender.send('latex:compile:done', {
              projectId,
              pdfPath: message.pdfPath
            })
            worker.terminate()
            resolve(message.pdfPath)
            return
          }
          if (message?.type === 'error') {
            event.sender.send('latex:compile:error', {
              projectId,
              message: message.message
            })
            worker.terminate()
            reject(new Error(message.message))
          }
        })
        worker.on('error', (err) => {
          worker.terminate()
          reject(err)
        })
      })
    }
  )

  ipcMain.handle(
    'spreadsheet:get-cell',
    async (_event, payload: { path: string; cellRef: string }) => {
      return _spreadsheetManager.getCellValue(payload)
    }
  )

  ipcMain.handle(
    'spreadsheet:get-cells',
    async (_event, payload: { requests: Array<{ path: string; cellRef: string }> }) => {
      return _spreadsheetManager.getCellsValues(payload.requests)
    }
  )

  ipcMain.handle('spreadsheet:watch', async (event, payload: { path: string }) => {
    _spreadsheetManager.watch(payload.path, event.sender)
    return { ok: true }
  })

  ipcMain.handle('spreadsheet:unwatch', async (event, payload: { path: string }) => {
    _spreadsheetManager.unwatch(payload.path, event.sender)
    return { ok: true }
  })

  ipcMain.handle(
    'spreadsheet:atomic-write',
    async (_event, payload: { path: string; data: string | Buffer }) => {
      return _spreadsheetManager.atomicWrite(payload.path, payload.data)
    }
  )

  // The validated filesystem surface the nodeApi shim is routed at.
  registerFilesystemIpc()

  // Only the preload's grantDroppedFile reaches this, and it sends a path it
  // derived from a File object in the same function. It is not a general
  // "grant this path" channel: see the note on FilesystemPathPolicy.grant.
  ipcMain.handle('fs:grant-dropped-file', (_event, droppedPath: string) =>
    grantUserChosenPath({ path: droppedPath, directory: false })
  )

  ipcMain.handle('dialog:openFile', async (event, filters: any = []) => {
    // 1. Grab the specific BrowserWindow instance that triggered this IPC request
    const webContents = event.sender
    const win = BrowserWindow.fromWebContents(webContents)

    // If for some reason the window instance can't be resolved, fall back to safe instantiation
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: filters || [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
    })
    if (canceled) return null
    console.log('dialog:openFile filePaths', filePaths)
    // The user picking a path is the only way a path outside the application's
    // own folders becomes reachable. Granted here, inside the handler, before
    // the string goes back to the renderer: a grant channel taking a path as an
    // argument would let any renderer code grant itself anything.
    grantDialogResult(filePaths, false)
    return filePaths[0]
  })

  ipcMain.handle('dialog:openFiles', async (event, filters: any = []) => {
    // 1. Grab the specific BrowserWindow instance that triggered this IPC request
    const webContents = event.sender
    const win = BrowserWindow.fromWebContents(webContents)

    // If for some reason the window instance can't be resolved, fall back to safe instantiation
    if (!win) return []
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: filters || []
    })
    if (canceled) return []
    return filePaths || []
  })

  ipcMain.handle('dialog:openDirectory', async (event, options: any = {}) => {
    // 1. Grab the specific BrowserWindow instance that triggered this IPC request
    const webContents = event.sender
    const win = BrowserWindow.fromWebContents(webContents)

    // If for some reason the window instance can't be resolved, fall back to safe instantiation
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
      // filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
    })
    if (canceled) return null
    console.log('dialog:openDirectory filePaths', filePaths)
    // A directory grant covers the subtree: the file tree browses folders.
    grantDialogResult(filePaths, true)
    return filePaths[0]
  })

  /*   ipcMain.handle('dialog:saveFile', async (_event, options: any = {}) => {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: options?.title || 'Save As',
        defaultPath: options?.defaultPath,
        filters: options?.filters || [],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      });
      if (canceled || !filePath) return null;
      return filePath;
    }); */

  ipcMain.handle('dialog:saveFile', async (event, options: any = {}) => {
    // 1. Grab the specific BrowserWindow instance that triggered this IPC request
    const webContents = event.sender
    const win = BrowserWindow.fromWebContents(webContents)

    // If for some reason the window instance can't be resolved, fall back to safe instantiation
    if (!win) return null

    // 2. Pass the 'win' instance as the absolute first parameter to bind it as a modal sheet
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: options?.title || 'Save As',
      defaultPath: options?.defaultPath,
      filters: options?.filters || [],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    })

    if (canceled || !filePath) return null
    // A save target usually does not exist yet; the policy resolves the nearest
    // existing ancestor, so granting the chosen path covers the write that
    // follows.
    grantUserChosenPath({ path: filePath, directory: false })
    return filePath
  })

  ipcMain.handle('load-system-font', async (_, fontFamily = 'Geneva') => {
    //     import fs from 'fs'
    // import path from 'path'

    // async function loadSystemFont(fontFamily = 'Arial') {
    let fontPath: string = ''

    switch (process.platform) {
      case 'darwin': // macOS
        fontPath = `/System/Library/Fonts/${fontFamily}.ttf`
        if (!fs.existsSync(fontPath)) fontPath = `/Library/Fonts/${fontFamily}.ttf`
        break

      case 'win32':
        fontPath = `C:\\Windows\\Fonts\\${fontFamily}.ttf`
        break

      case 'linux':
        fontPath = `/usr/share/fonts/truetype/${fontFamily.toLowerCase()}/${fontFamily}.ttf`
        break
    }

    if (!fontPath || !fs.existsSync(fontPath)) {
      console.error('Font not found:', fontFamily)
      return null
    }

    const buf = fs.readFileSync(fontPath)
    const fontData = new Uint8Array(buf).buffer
    return fontData
    // return CanvasKit.Typeface.MakeFreeTypeFaceFromData(fontData)
    // }
  })

  // Presentation

  ipcMain.on(IPC_PRESENTATION_UPDATE, (_, payload: PresentationPayload) => {
    if (!_presentationWindow) return
    console.log('IPC_PRESENTATION_UPDATE', { payload })
    _presentationWindow?.webContents.send(IPC_PRESENTATION_UPDATE, payload)
    _mainWindow?.webContents.send(IPC_PRESENTATION_UPDATE, payload)
    // _presenterWindow?.webContents.send(IPC_PRESENTATION_UPDATE, payload)
  })

  ipcMain.on(IPC_PRESENTATION_WINDOW_FOCUS, () => {
    console.log('IPC_PRESENTATION_WINDOW_FOCUS')
    _presentationWindow?.focus()
  })

  ipcMain.on(IPC_PRESENTATION_STOP, (_event, scope: 'presenter' | 'all' = 'presenter') => {
    console.log('IPC_PRESENTATION_STOP', scope)
    if (scope === 'all') {
      _presentationWindow?.close()
      _presenterWindow?.close()
      _presentationWindow = null
      _presenterWindow = null
      _cachedPayload = null as any
      return
    }
    _presenterWindow?.close()
    _presenterWindow = null
  })

  ipcMain.on(IPC_PRESENTATION_NAVIGATE, (_, index: number) => {
    console.log('IPC_PRESENTATION_NAVIGATE', index)

    if (!_cachedPayload) return

    // _cachedPayload.currentIndex = index;
    const max = _cachedPayload.pageCount - 1
    const nextIndex = Math.max(0, Math.min(index, max))

    _cachedPayload.currentIndex = nextIndex

    console.log('IPC_PRESENTATION_NAVIGATE final', nextIndex)

    _presentationWindow?.webContents.send(IPC_PRESENTATION_UPDATE, _cachedPayload)
    _mainWindow?.webContents.send(
      // _presenterWindow?.webContents.send(
      IPC_PRESENTATION_UPDATE,
      _cachedPayload
    )
  })
  /* 
  ipcMain.on(IPC_PRESENTATION_START, (_, payload: PresentationPayload) => {
    console.log("IPC_PRESENTATION_START")

    _cachedPayload = payload;

    if (!_presentationWindow) {
      _presentationWindow = new BrowserWindow({
        width: payload.pageWidth,
        height: payload.pageHeight,

        ...(process.platform === 'linux' ? { icon } : {}),
        webPreferences: {
          preload: join(__dirname, '../preload/index.js'),
          webviewTag: true,          // 🔴 REQUIRED
          sandbox: false,
          // Same correction as the main window: a preload loads fine under
          // contextIsolation, and document content reaching require() is the
          // hole this spec closes.
          contextIsolation: true,
          nodeIntegration: false,
          additionalArguments: [`--disable-features=SecurityByDefaultWithCSP`],

          webSecurity: false, // Disables web security


          // For seecurity
          /* nodeIntegration: false,           // essential
          contextIsolation: true,           // essential
          sandbox: true,                    // strongly recommended
          // enableRemoteModule: false,
          webviewTag: false,
          // worldSafeExecuteJavaScript: true, +/
        },
        // fullscreen: true,
        /* webPreferences: {
          // preload: __dirname + '/preload.js',
          // preload: join(__dirname, '../preload/presentation.js'),
          preload: join(__dirname, '../preload/index.js'),

        }, +/
      });

      /* if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        presentationWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
      } else {
        presentationWindow.loadFile(join(__dirname, '../renderer/src/components/presentation/index.html'))
      } +/

      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        // DEV: load Vite dev server route
        _presentationWindow.loadURL(
          `${process.env.ELECTRON_RENDERER_URL}/presentation`
        )
      } else {
        // PROD: load built HTML
        _presentationWindow.loadFile(
          join(__dirname, '../renderer/index.html'),
          { hash: 'presentation' }
        )

        // presentationWindow.loadFile(join(__dirname, '../renderer/src/components/presentation/index.html'))

      }

      // presentationWindow.loadURL(
      //   `file://${__dirname}/presentation/index.html`
      // );

      _presentationWindow.on('closed', () => {
        _presentationWindow = null;
      });

      _presentationWindow.webContents.once('did-finish-load', () => {
        _presentationWindow?.webContents.send(
          IPC_PRESENTATION_DATA,
          _cachedPayload
        );
      });
    } else if (!_presenterWindow) {
      _presenterWindow = new BrowserWindow({
        width: payload.pageWidth,
        height: payload.pageHeight,

        ...(process.platform === 'linux' ? { icon } : {}),
        webPreferences: {
          preload: join(__dirname, '../preload/index.js'),
          webviewTag: true,          // 🔴 REQUIRED
          sandbox: false,
          // Same correction as the main window: a preload loads fine under
          // contextIsolation, and document content reaching require() is the
          // hole this spec closes.
          contextIsolation: true,
          nodeIntegration: false,
          additionalArguments: [`--disable-features=SecurityByDefaultWithCSP`],

          webSecurity: false, // Disables web security


          // For seecurity
          /* nodeIntegration: false,           // essential
          contextIsolation: true,           // essential
          sandbox: true,                    // strongly recommended
          // enableRemoteModule: false,
          webviewTag: false,
          // worldSafeExecuteJavaScript: true, +/
        },
        // fullscreen: true,
        /* webPreferences: {
          // preload: __dirname + '/preload.js',
          // preload: join(__dirname, '../preload/presenter.js'),
          preload: join(__dirname, '../preload/index.js'),

        }, +/
      });

      /* if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        presenterWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
      } else {
        presenterWindow.loadFile(join(__dirname, '../renderer/src/components/presenter/index.html'))
      } +/

      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        // DEV: load Vite dev server route
        _presenterWindow.loadURL(
          `${process.env.ELECTRON_RENDERER_URL}/presenter`
        )
      } else {
        // PROD: load built HTML
        _presenterWindow.loadFile(
          join(__dirname, '../renderer/index.html'),
          { hash: 'presenter' }
        )

        // presenterWindow.loadFile(join(__dirname, '../renderer/src/components/presenter/index.html'))

      }

      // presenterWindow.loadURL(
      //   `file://${__dirname}/presenter/index.html`
      // );

      _presenterWindow.on('closed', () => {
        _presenterWindow = null;
      });

      _presenterWindow.webContents.once('did-finish-load', () => {
        _presenterWindow?.webContents.send(
          IPC_PRESENTATION_DATA,
          _cachedPayload
        );
      });
    } else {
      _presentationWindow.webContents.send(
        IPC_PRESENTATION_DATA,
        _cachedPayload
      );
      _presenterWindow.webContents.send(
        IPC_PRESENTATION_DATA,
        _cachedPayload
      );
    }
  }); */

  ipcMain.on(IPC_PRESENTATION_START, (_, payload: PresentationPayload) => {
    console.log('IPC_PRESENTATION_START', { payload })

    _cachedPayload = payload

    createPresentationWindow(payload)

    _mainWindow?.webContents.send(IPC_PRESENTATION_DATA, _cachedPayload)

    // createPresenterWindow(payload)
  })

  ipcMain.handle('presentation:get-initial-data', () => {
    console.log('presentation:get-initial-data requested, returning:', _cachedPayload)
    return _cachedPayload
  })

  /*  ipcMain.handle('meeting:open', (event, url) => {
     try {
       let meetingWin = new BrowserWindow({
         ...getWindowOptions(),
         webPreferences: {
           ...(getWindowOptions().webPreferences),
           webviewTag: true
         }
       });
 
       meetingWin.loadURL(url);
 
       meetingWin.on('closed', () => {
         meetingWin = null;
       });
 
       return { success: true }; // Optional: return something to the renderer
     } catch (error) {
       console.error("Failed to open meeting window:", error);
       throw error; // This will reject the promise in the renderer
     }
   }); */

  // 1. Keep a Set of windows to prevent garbage collection
  // const meetingWindows1 = new Set();

  /* ipcMain.handle('meeting:open', async (event, url) => {
    console.log("Main received request to open:", url);

    let meetingWin = new BrowserWindow({
      width: 1280,
      height: 720,
      title: "MiroTalk Meeting",
      show: true, // Force it to show immediately for testing
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: true
      }
    });

    // 2. Add to our Set so it stays in memory
    meetingWindows.add(meetingWin);

    meetingWin.loadURL(url);

    meetingWin.on('closed', () => {
      meetingWindows.delete(meetingWin);
      meetingWin = null;
    });

    return { success: true };
  }); */

  // tccutil reset ScreenCapture com.dynadoc.app
  // dev: tccutil reset ScreenCapture com.github.electron

  // /path/to/dynadoc/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron
  function checkPermissions() {
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('screen')
      if (status !== 'granted') {
        console.log('Permission not granted. Opening Privacy Settings...')
        // This opens the exact correct page in macOS settings
        shell.openExternal(
          'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
        )
      }
    }
  }
  // main.ts / main.js
  // import { ipcMain, desktopCapturer, BrowserWindow } from 'electron';

  let pickerWindow // Reference to your main Svelte window

  /* ipcMain.handle('meeting:open', async (event, url) => {
    const win = new BrowserWindow({
      width: 1200, height: 800,
      webPreferences: { webviewTag: true }
    });

    // INTERCEPT SCREEN SHARE REQUEST
    win.webContents.session.setDisplayMediaRequestHandler(async (request, callback) => {
      // 1. Get all available screens and windows
      // const sources = await desktopCapturer.getSources({ 
      //   types: ['screen', 'window'],
      //   thumbnailSize: { width: 300, height: 200 } // For the preview images
      // });
      try {
        // This is the line that triggers the macOS permission prompt
        const sources = await desktopCapturer.getSources({
          types: ['window', 'screen'],
          thumbnailSize: { width: 300, height: 200 } // For the preview images
        });
        // return { success: true, sources };
        console.error('Seending ipc:  meeting:show-screen-picker', {sources});

        // 2. Send sources to your Svelte Renderer to show the Picker Modal
        event.sender.send('meeting:show-screen-picker', sources.map(s => ({
          id: s.id,
          name: s.name,
          thumbnail: s.thumbnail.toDataURL() // Convert to string for IPC
        })));

        // 3. Wait for the user to click a source in Svelte
        ipcMain.once('meeting:screen-source-selected', (event, sourceId) => {
          const selectedSource = sources.find(s => s.id === sourceId);
          callback({ video: selectedSource });
        });
      } catch (e) {
        console.error('Permission Denied or Source Error:', e);
        return { success: false, error: 'SCREEN_PERMISSION_DENIED' };
      }


    });

    win.loadURL(url);
  }); */

  const meetingWindows = new Map()
  let currentMeetingUrl = ''
  ipcMain.handle('meeting:open', async (event, url) => {
    currentMeetingUrl = url // Store it
    // ipcMain.handle('meeting:open', async (event, { roomId, url }) => {
    // Create the "Shell" window
    /* let win = new BrowserWindow({
      width: 1280,
      height: 720,
      title: `Meeting: ${roomId}`,
      backgroundColor: '#1e1e1e', // Adobe Dark
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        webviewTag: true, // Required for the Svelte component
        contextIsolation: true
      }
    }); */
    _meetingWindow = new BrowserWindow(getWindowOptions(1280, 720))

    meetingWindows.set(url, _meetingWindow)

    // Load your Svelte app, passing the meeting URL as a query param or via IPC later
    // If using SvelteKit/Vite dev server:
    // win.loadURL(`http://localhost:5173/meeting-shell?url=${encodeURIComponent(url)}`);

    loadWindow(_meetingWindow, 'meeting')

    _meetingWindow.once('ready-to-show', () => {
      _meetingWindow?.show()
      /* _meetingWindow?.webContents.send(
        IPC_MEETING_START,
        url
      ) */
    })

    /* _meetingWindow.webContents.on('did-finish-load', () => {
      // Even here, Svelte might still be "booting"
      _meetingWindow?.webContents.send(IPC_MEETING_START, url);
    }); */

    // _meetingWindow.once('ready-to-show', () => _meetingWindow?.show());

    // Handle Screen Share requests specifically for this window's session

    _meetingWindow.webContents.session.setDisplayMediaRequestHandler(async (request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 300, height: 200 }
        })

        // Send sources to the SVELTE SHELL inside this window
        _meetingWindow?.webContents.send(
          'meeting:show-screen-picker',
          sources.map((s) => ({
            id: s.id,
            name: s.name,
            thumbnail: s.thumbnail.toDataURL()
          }))
        )

        // Listen for the user's choice from the Svelte UI
        ipcMain.once('meeting:screen-source-selected', (event, sourceId) => {
          // ipcMain.once(`meeting:source-selected:${_meetingWindow?.id}`, (event, sourceId) => {
          const selected = sources.find((s) => s.id === sourceId)
          callback({ video: selected })

          // 2. Launch the GLOBAL Presentation Tools
          createLaserPointer() // New Window (Transparent Overlay)
          createSharingToolbar() // New Window

          // 3. Minimize the Meeting Window to get it out of the way
          _meetingWindow?.minimize()
        })
      } catch (e) {
        console.error('Capture Error:', e)
        callback({}) // Cancel
      }
    })

    _meetingWindow.on('closed', () => meetingWindows.delete(url))
    return { success: true }
  })

  ipcMain.handle('meeting:get-initial-url', () => {
    return currentMeetingUrl
  })

  ipcMain.handle('meeting:show-screen-picker', async (event) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 300, height: 200 }
      })
      return sources
    } catch (error) {
      console.error('Failed to get sources (Check macOS Permissions):', error)
      // Return an empty array so the Svelte UI doesn't break
      return []
    }
  })

  // main.ts
  // let _meetingSharingToolbar = null;

  // Add this to your loadWindow helper routes
  /* function createLaserPointer() {
    _meetingLaserWindow = new BrowserWindow({
      fullscreen: true,
      transparent: true,
      alwaysOnTop: true,
      hasShadow: false,
      frame: false,
      webPreferences: { preload: join(__dirname, '../preload/index.js') }
    });
    
    _meetingLaserWindow.setIgnoreMouseEvents(true, { forward: true });
    loadWindow(_meetingLaserWindow, 'laser-pointer-route'); // Load specific Svelte route
  } */

  // Update the laser position every 16ms (60fps)
  setInterval(() => {
    if (_meetingLaserWindow) {
      const point = screen.getCursorScreenPoint()
      _meetingLaserWindow.webContents.send('meeting:update-cursor', point)
    }
  }, 16)

  ipcMain.on('meeting:stop-sharing', () => {
    console.log('Cleaning up sharing session...')

    // 1. Close the Global Floating Toolbar
    if (_meetingSharingToolbar && !_meetingSharingToolbar.isDestroyed()) {
      _meetingSharingToolbar.close()
      _meetingSharingToolbar = null
    }

    // 2. Close the Laser Pointer Overlay
    if (_meetingLaserWindow && !_meetingLaserWindow.isDestroyed()) {
      _meetingLaserWindow.close()
      _meetingLaserWindow = null
    }

    // 3. Notify the Meeting Window to stop the webview's internal stream
    // This is important so the MiroTalk UI updates correctly
    if (_meetingWindow && !_meetingWindow.isDestroyed()) {
      console.log('Restoring meeting window...')

      _meetingWindow.webContents.send('meeting:stream-stop-request')

      // Bring the meeting window back to the front
      _meetingWindow.restore() // In case it was minimized
      _meetingWindow.focus()

      console.log('Restored meeting window.')
    }
  })

  // main.js
  ipcMain.on('meeting:toggle-laser', (event, active) => {
    if (_meetingLaserWindow) {
      _meetingLaserWindow.webContents.send('meeting:set-laser-active', active)
    }
  })

  ipcMain.on('meeting:toggle-spotlight', (event, active) => {
    if (_meetingLaserWindow) {
      _meetingLaserWindow.webContents.send('meeting:set-spotlight-active', active)
    }
  })

  // main.ts
  ipcMain.on('meeting:toggle-mic', (event, isMuted) => {
    if (_meetingWindow) {
      // This tells the Electron WebContents to stop playing/recording audio
      _meetingWindow.webContents.setAudioMuted(isMuted)

      // Also notify the Svelte Shell to toggle the MiroTalk mic track
      _meetingWindow.webContents.send('meeting:mic-action', isMuted)
    }
  })

  // For the "Annotation" feature (Drawing on screen)
  ipcMain.on('meeting:toggle-annotations', (event, active) => {
    if (_meetingLaserWindow) {
      // When drawing, we might want to capture mouse events
      _meetingLaserWindow.setIgnoreMouseEvents(!active, { forward: true })
      _meetingLaserWindow.webContents.send('meeting:set-annotation-mode', active)
    }
  })

  /*   ipcMain.on('meeting:stop-sharing', () => {
      // 1. Close the toolbar
      if (_meetingSharingToolbar) _meetingSharingToolbar.close();
      // 2. Close the laser/spotlight overlay
      if (_meetingLaserWindow) _meetingLaserWindow.close();
      // 3. Bring the meeting window back to focus
      _meetingWindow?.focus();
    }); */

  /* ipcMain.handle('files-dropped', async (_event, files) => {
    // Optional: process files in main process
    console.log('Main received files:', files.map(f => f.path))

    // Return files back to renderer
    return files
  }) */

  /* ipcMain.handle('resolve-dropped-files', async (_event, items) => {
  // items come from renderer DataTransferItemList
  // In Electron, you can use `item.path` in main process because Node is available
  return items.map(item => {
    return { path: item.path, name: item.name }
  })
}) */

  // await startLanguageTool()
  startLanguageTool().catch((err) => {
    console.error('LanguageTool failed to start, continuing without it:', err)
  })

  const startupDeepLink = getDeepLinkFromArgv(process.argv)
  if (startupDeepLink) {
    queueDeepLink(startupDeepLink)
  }

  createWindow()

  // Handle protocol callback links captured before window creation/ready.
  for (const deepLink of _pendingDeepLinks.splice(0)) {
    try {
      await completeAuthWithDeepLink(deepLink)
    } catch (error) {
      console.error('Failed to handle auth deep link', deepLink, error)
    }
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Modify the Content Security Policy to allow loading scripts from blob URLs
/* app.on('web-contents-created', (event, contents) => {
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    webPreferences.nodeIntegration = true
    webPreferences.webSecurity = false // Disables web security
    webPreferences.allowRunningInsecureContent = true // Allows loading insecure content (HTTP/WS)
    delete webPreferences.sandbox // Disables sandbox mode
  })
}) */

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('before-quit', () => {
  _allowWindowClose = true
})

app.on('window-all-closed', () => {
  app.quit()
})

// Remember to kill it on app exit
app.on('will-quit', () => {
  if (_ltProcess) _ltProcess.kill()
  // if (wysiwygEditorCollaborationServerProcess) wysiwygEditorCollaborationServerProcess.kill()
  // if (imageEditorCollaborationServerProcess) imageEditorCollaborationServerProcess.kill()
  _wysiwygEditorServer?.close()
  _imageEditorServer?.close()
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
