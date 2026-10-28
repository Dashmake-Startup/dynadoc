import EditorHelpers from '../../utils/EditorHelpers'
import Utils from '../../utils/Utils'
import { _$_documentEditorsList } from '../../stores/editor.store'
import { _$_lastSaveDirectory } from '../../stores/common.store'
import type { DocumentEditorModel } from '../../models/Document'
import EditorCommonUtils from '../../utils/common.utils'
import { isSecureLeaseAvailable, notifySecureLeaseRequired } from '../../stores/secureLease.store'
import { nodeApi } from '../../utils/shims/node'

// const nodeApi = typeof window !== 'undefined' ? (window as any).node : undefined
// const fs = nodeApi?.fs
// const path = nodeApi?.path

export type SaveFormat =
  | `${typeof Utils.DYNADOC_EXTENSIONS_FORMAT.default}`
  | `${typeof Utils.DYNADOC_EXTENSIONS_FORMAT.secured}`
  | `${typeof Utils.OFFICE_EXTENSIONS_FORMAT.word}`
  | `${typeof Utils.OFFICE_EXTENSIONS_FORMAT.excel}`
  | `${typeof Utils.OFFICE_EXTENSIONS_FORMAT.powerpoint}`

export const SAVE_FORMATS: { label: string; ext: string; format: SaveFormat }[] = [
  {
    label: 'DDoc',
    ext: Utils.DYNADOC_EXTENSIONS.default,
    format: Utils.DYNADOC_EXTENSIONS_FORMAT.default
  },
  {
    label: 'Secured DDoc',
    ext: Utils.DYNADOC_EXTENSIONS.secured,
    format: Utils.DYNADOC_EXTENSIONS_FORMAT.secured
  }
  // { label: 'Word', ext: Utils.OFFICE_EXTENSIONS.word, format: Utils.OFFICE_EXTENSIONS_FORMAT.word },
  // { label: 'Excel', ext: Utils.OFFICE_EXTENSIONS.excel, format: Utils.OFFICE_EXTENSIONS_FORMAT.excel },
  // { label: 'PowerPoint', ext: Utils.OFFICE_EXTENSIONS.powerpoint, format: Utils.OFFICE_EXTENSIONS_FORMAT.powerpoint }
]

const AUTOSAVE_INTERVAL_MS = 60_000
const AUTOSAVE_MAX_SNAPSHOTS = 15
const SNAPSHOT_IDLE_MS = 20_000
const SNAPSHOT_STATE_FILE = 'snapshot-state.json'
const autosaveTimers = new Map<string, number>()
const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`

export const getSaveSessionId = () => sessionId

export const readStoreValue = <T>(store): T => {
  let value: T = null
  try {
    const unsubscribe = store.subscribe((v) => (value = v))
    unsubscribe?.()
  } catch {
    // ignore
  }
  return value
}

const getSnapshotRoot = async (documentEditor: DocumentEditorModel) => {
  if (!nodeApi.path) return ''
  const cacheDir = (await window.api?.getCacheDir()) || ''
  const docId = documentEditor?.document?.uuid || documentEditor?.uuid || 'unknown'
  return nodeApi.path.join(cacheDir, 'snapshots', docId)
}

const readSnapshotIndex = async (snapshotRoot: string) => {
  if (!nodeApi.fsPromises || !nodeApi.path) return [] as { path: string; createdAt: string }[]
  const indexPath = nodeApi.path.join(snapshotRoot, 'index.json')
  if (!(await nodeApi.fsPromises.exists(indexPath)))
    return [] as { path: string; createdAt: string }[]
  try {
    const raw = await nodeApi.fsPromises.readFile(indexPath, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeSnapshotIndex = async (
  snapshotRoot: string,
  entries: { path: string; createdAt: string }[]
) => {
  if (!nodeApi.fsPromises || !nodeApi.path) return
  const indexPath = nodeApi.path.join(snapshotRoot, 'index.json')
  await nodeApi.fsPromises.mkdir(snapshotRoot, { recursive: true })
  await nodeApi.fsPromises.writeFile(indexPath, JSON.stringify(entries, null, 2))
}

type SnapshotState = {
  lastSnapshotAt?: number
  fileMtimes?: Record<string, number>
}

const readSnapshotState = async (snapshotRoot: string): Promise<SnapshotState> => {
  if (!nodeApi.fsPromises || !nodeApi.path) return {}
  const statePath = nodeApi.path.join(snapshotRoot, SNAPSHOT_STATE_FILE)
  if (!(await nodeApi.fsPromises.exists(statePath))) return {}
  try {
    const raw = await nodeApi.fsPromises.readFile(statePath, 'utf-8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const writeSnapshotState = async (snapshotRoot: string, state: SnapshotState) => {
  if (!nodeApi.fsPromises || !nodeApi.path) return
  const statePath = nodeApi.path.join(snapshotRoot, SNAPSHOT_STATE_FILE)
  await nodeApi.fsPromises.mkdir(snapshotRoot, { recursive: true })
  await nodeApi.fsPromises.writeFile(statePath, JSON.stringify(state, null, 2))
}

const resolveSnapshotSourceRoot = async (doc) => {
  if (!nodeApi.fsPromises || !nodeApi.path) return ''
  const candidates = [doc.cachePath, doc.cacheDirPath, doc.dirPath, doc.path]
  for (const candidate of candidates) {
    if (!candidate || !(await nodeApi.fsPromises.exists(candidate))) continue
    try {
      const stat = await nodeApi.fsPromises.stat(candidate)
      return stat.isDirectory() ? candidate : nodeApi.path.dirname(candidate)
    } catch {
      // ignore
    }
  }
  return ''
}

const scanSnapshotFiles = async (rootDir: string, previous: Record<string, number> = {}) => {
  if (!nodeApi.fsPromises || !nodeApi.path) {
    return { changedFiles: [], fileMtimes: {}, latestMtime: 0 }
  }
  const ignoreDirs = new Set(['.ddoc-history', '.history', '.git', 'snapshots'])
  const fileMtimes: Record<string, number> = {}
  const changedFiles: { fullPath: string; relPath: string; mtimeMs: number }[] = []
  let latestMtime = 0

  const walk = async (dir: string) => {
    const entries = await nodeApi.fsPromises.readdir(dir)
    for (const entry of entries) {
      const name = typeof entry === 'string' ? entry : entry?.name
      if (!name) continue
      const fullPath = nodeApi.path.join(dir, name)
      let stat: any
      try {
        stat = await nodeApi.fsPromises.stat(fullPath)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        if (ignoreDirs.has(name)) continue
        await walk(fullPath)
        continue
      }
      if (!stat.isFile()) continue
      const relPath = nodeApi.path.relative(rootDir, fullPath)
      const mtimeMs = stat.mtimeMs || stat.mtime?.getTime?.() || 0
      fileMtimes[relPath] = mtimeMs
      if (mtimeMs > latestMtime) latestMtime = mtimeMs
      if (!previous[relPath] || mtimeMs > previous[relPath]) {
        changedFiles.push({ fullPath, relPath, mtimeMs })
      }
    }
  }

  await walk(rootDir)
  return { changedFiles, fileMtimes, latestMtime }
}

const packSnapshotFolder = async (folderPath: string, outputFile: string, isSecured: boolean) => {
  if ((window as any)?.api?.ddocify) {
    return (window as any).api.ddocify(folderPath, outputFile, isSecured)
  }
  return Utils.ddocify(null, folderPath, outputFile, isSecured)
}

export async function saveActiveDocument(options?: {
  saveAs?: boolean
  saveAsSecured?: boolean
  outputPath?: string
  require2fa?: boolean
}) {
  const active = _$_documentEditorsList.getActiveSync?.()
  if (!active) return false
  if (options?.saveAsSecured && !isSecureLeaseAvailable()) {
    await notifySecureLeaseRequired(
      'Secure saving is currently unavailable. Please renew your secure writing license.'
    )
    return false
  }
  return EditorHelpers.saveDocumentEditor(active, options || false)
}

export async function saveDocumentWithFormatPicker(documentEditor: DocumentEditorModel) {
  /* if (!documentEditor?.document) return false
  const doc = documentEditor.document

  const lastDir = readStoreValue<string | null>(_$_lastSaveDirectory)
  const baseName = doc.name || 'Untitled'
  const rawExt = doc.extension || Utils.DYNADOC_EXTENSIONS.default
  const defaultExt = rawExt === Utils.MAIN_DOCUMENT_FILE_EXTENSION ? Utils.DYNADOC_EXTENSIONS.default : rawExt
  const defaultDir = lastDir || doc.dirPath || ''
  const defaultPath = defaultDir ? nodeApi.path.join(defaultDir, `${baseName}${defaultExt}`) : `${baseName}${defaultExt}`

  const formats = isSecureLeaseAvailable()
    ? SAVE_FORMATS
    : SAVE_FORMATS.filter((f) => f.format !== Utils.DYNADOC_EXTENSIONS_FORMAT.secured)

  const filters = formats.map((f) => ({
    name: `${f.label} (${f.ext})`,
    extensions: [f.ext.replace('.', '')]
  }))
  filters.push({ name: 'All Files', extensions: ['*'] })

  const outputPath = await window.api.saveDialogFile({
    title: 'Save As',
    defaultPath,
    filters
  }) */
  const outputPath = await EditorHelpers.saveDocumentPathPickerDialog(documentEditor)

  if (!outputPath) return false

  const ext = nodeApi.path.extname(outputPath)
  const saveAsSecured = ext === Utils.DYNADOC_EXTENSIONS.secured
  return EditorHelpers.saveDocumentEditor(documentEditor, {
    saveAs: true,
    saveAsSecured,
    outputPath
  })
}

export async function saveSnapshot(documentEditor: DocumentEditorModel) {
  if (!documentEditor?.document || !nodeApi.fsPromises || !nodeApi.path) return null
  const doc = documentEditor.document
  const snapshotRoot = await getSnapshotRoot(documentEditor)
  await nodeApi.fsPromises.mkdir(snapshotRoot, { recursive: true })
  const sourceRoot = await resolveSnapshotSourceRoot(doc)
  if (!sourceRoot) return null

  const state = await readSnapshotState(snapshotRoot)
  const scan = await scanSnapshotFiles(sourceRoot, state.fileMtimes || {})
  if (scan.latestMtime && Date.now() - scan.latestMtime < SNAPSHOT_IDLE_MS) {
    return null
  }
  if (scan.changedFiles.length === 0) {
    return null
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const ext =
    doc.isSecured || doc.extension === Utils.DYNADOC_EXTENSIONS.secured
      ? Utils.DYNADOC_EXTENSIONS.secured
      : Utils.DYNADOC_EXTENSIONS.default
  const snapshotPath = nodeApi.path.join(
    snapshotRoot,
    `${doc.name || 'Untitled'}-${timestamp}${ext}`
  )

  // Wite to ddoc file
  // await doc.saveTo(doc.isSecured, snapshotPath)
  const tempDir = nodeApi.path.join(snapshotRoot, `tmp-${timestamp}`)
  await nodeApi.fsPromises.mkdir(tempDir, { recursive: true })
  for (const file of scan.changedFiles) {
    const dest = nodeApi.path.join(tempDir, file.relPath)
    await nodeApi.fsPromises.mkdir(nodeApi.path.dirname(dest), { recursive: true })
    await nodeApi.fsPromises.copyFile(file.fullPath, dest)
  }

  await packSnapshotFolder(tempDir, snapshotPath, doc.isSecured)

  try {
    await nodeApi.fsPromises.rm(tempDir, { recursive: true, force: true })
  } catch {
    // ignore
  }

  const entries = await readSnapshotIndex(snapshotRoot)
  entries.unshift({ path: snapshotPath, createdAt: new Date().toISOString() })
  const trimmed = entries.slice(0, AUTOSAVE_MAX_SNAPSHOTS)
  await writeSnapshotIndex(snapshotRoot, trimmed)

  await writeSnapshotState(snapshotRoot, {
    lastSnapshotAt: Date.now(),
    fileMtimes: scan.fileMtimes
  })

  await Promise.all(
    entries.slice(AUTOSAVE_MAX_SNAPSHOTS).map(async (entry) => {
      try {
        if (await nodeApi.fsPromises.exists(entry.path)) await nodeApi.fsPromises.unlink(entry.path)
      } catch {
        // ignore
      }
    })
  )

  return snapshotPath
}

export async function listSnapshots(documentEditor: DocumentEditorModel) {
  if (!documentEditor?.document || !nodeApi.fsPromises || !nodeApi.path) {
    return [] as { path: string; createdAt: string; size: number; modTime: string }[]
  }
  const snapshotRoot = await getSnapshotRoot(documentEditor)
  const entries = await readSnapshotIndex(snapshotRoot)
  return Promise.all(
    entries.map(async (entry) => {
      let size = 0
      let modTime = entry.createdAt
      try {
        const stat = await nodeApi.fsPromises.stat(entry.path)
        size = stat.size
        modTime = stat.mtime.toISOString()
      } catch {
        // ignore
      }
      return { ...entry, size, modTime }
    })
  )
}

export async function restoreSnapshot(documentEditor: DocumentEditorModel, snapshotPath: string) {
  if (!documentEditor?.document || !snapshotPath || !nodeApi.fsPromises || !nodeApi.path)
    return false
  const doc = documentEditor.document
  if (!doc.path || doc.path.startsWith(doc.cachePath)) {
    await EditorCommonUtils.addNewDocumentEditor(snapshotPath, doc.parentPath || null)
    return true
  }

  try {
    await nodeApi.fsPromises.copyFile(snapshotPath, doc.path)
  } catch (err) {
    console.warn('Failed to restore snapshot', err)
    return false
  }

  _$_documentEditorsList.closeTab(documentEditor.uuid || doc.uuid || documentEditor.id)
  await EditorCommonUtils.addNewDocumentEditor(doc.path, doc.parentPath || null)
  return true
}

export async function openSnapshotForCompare(snapshotPath: string, parentPath?: string | null) {
  if (!snapshotPath) return false
  await EditorCommonUtils.addNewDocumentEditor(snapshotPath, parentPath || null)
  return true
}

const getLockRootPath = (documentEditor: DocumentEditorModel) => {
  const doc = documentEditor?.document
  if (!doc) return ''
  const isDdoc =
    doc.extension === Utils.DYNADOC_EXTENSIONS.default ||
    doc.extension === Utils.DYNADOC_EXTENSIONS.secured
  if (!isDdoc) return ''
  const isCacheFile =
    (doc.cacheDirPath && doc.path?.startsWith(doc.cacheDirPath)) ||
    (doc.cachePath && doc.path?.startsWith(doc.cachePath))
  if (isCacheFile) return ''
  return doc.isFilePartOfAParentDocument() ? doc.parentPath : doc.path
}

export async function getDocumentLockInfo(documentEditor: DocumentEditorModel) {
  const docPath = getLockRootPath(documentEditor)
  if (!docPath) return null
  const lockPath = `${docPath}${Utils.LOCK_FILE_EXTENSION}`
  if (!(await nodeApi.fsPromises?.exists?.(lockPath))) return null
  try {
    const raw = await nodeApi.fsPromises.readFile(lockPath, 'utf-8')
    const data = JSON.parse(raw)
    return data
  } catch {
    return { sessionId: 'unknown' }
  }
}

export function startAutosave(
  documentEditor: DocumentEditorModel,
  intervalMs = AUTOSAVE_INTERVAL_MS
) {
  if (!documentEditor?.document || !nodeApi.fsPromises || !nodeApi.path) return
  const key = documentEditor.document.uuid || documentEditor.uuid || documentEditor.id
  if (!key) return
  if (autosaveTimers.has(key)) return
  const docPath = getLockRootPath(documentEditor)
  if (docPath) {
    const lockPath = `${docPath}${Utils.LOCK_FILE_EXTENSION}`
    void nodeApi.fsPromises
      .writeFile(lockPath, JSON.stringify({ sessionId, openedAt: new Date().toISOString() }))
      .catch(() => {
        // ignore lock write failures
      })
  }
  const timer = window.setInterval(() => {
    saveSnapshot(documentEditor).catch((err) => console.warn('Autosave failed', err))
  }, intervalMs)
  autosaveTimers.set(key, timer)
}

export function stopAutosave(documentEditor: DocumentEditorModel) {
  if (!documentEditor?.document || !nodeApi.fsPromises || !nodeApi.path) return
  const key = documentEditor.document.uuid || documentEditor.uuid || documentEditor.id
  if (!key) return
  const timer = autosaveTimers.get(key)
  if (timer) {
    window.clearInterval(timer)
    autosaveTimers.delete(key)
  }
  const docPath = getLockRootPath(documentEditor)
  if (docPath) {
    const lockPath = `${docPath}${Utils.LOCK_FILE_EXTENSION}`
    void (async () => {
      try {
        const info = await getDocumentLockInfo(documentEditor)
        if (info?.sessionId === sessionId && (await nodeApi.fsPromises.exists(lockPath))) {
          await nodeApi.fsPromises.unlink(lockPath)
        }
      } catch {
        // ignore
      }
    })()
  }
}
