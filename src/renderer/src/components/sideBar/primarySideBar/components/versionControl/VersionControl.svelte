<script lang="ts">
  import { onMount } from 'svelte'
  import { _$_documentEditorsList } from '../../../../../stores/editor.store'
  import { openAlertModal } from '../../../../../stores/alertModal.store'
  import { openConfirmModal } from '../../../../../stores/confirmModal.store'
  import { openTextInputModal } from '../../../../../stores/textInputModal.store'
  import { _ } from 'svelte-i18n'
  import { get } from 'svelte/store'
  import { authStore } from '../../../../../stores/auth.store'
  import ContextMenu from '../../../../common/contextMenu/ContextMenu.svelte'
  import {
    listSnapshots as listAutosaveSnapshots,
    saveSnapshot as createAutosaveSnapshot,
    restoreSnapshot,
    openSnapshotForCompare,
    getDocumentLockInfo,
    getSaveSessionId
  } from '../../../../../services/save/savePipeline.service'
  import EditorHelpers from '../../../../../utils/EditorHelpers'
  import EditorCommonUtils from '../../../../../utils/common.utils'
import { nodeApi } from '../../../../../utils/shims/node'

  type RemoteEntry = {
    path: string
    name: string
    size: number
    mod_time?: string
    is_dir: boolean
  }

  type LocalEntry = {
    path: string
    relativePath: string
    name: string
    size: number
    modTime: string
    ext: string
    category: string
    uuid?: string
  }

  type FileStatus = 'added' | 'modified' | 'removed' | 'unchanged'

  type FileEntry = LocalEntry & {
    status: FileStatus
    remoteSize?: number
    remoteModTime?: string
    remoteOnly?: boolean
  }

  type HistoryEntry = {
    timestamp: string
    path: string
    checksum: string
    base_checksum: string
    size: number
    conflict?: boolean
  }

  type SnapshotFile = {
    path: string
    size: number
    modTime: string
    category: string
  }

  type SnapshotEntry = {
    id: string
    name: string
    createdAt: string
    author: string
    note?: string
    files: SnapshotFile[]
  }

  const activeEditorStore = _$_documentEditorsList.getActive()
//   const nodeApi =
//     typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
//   const fs = nodeApi?.fs
//   const path = nodeApi?.path
  const t = get(_)

  let isLoading = $state(false)
  let isSyncing = $state(false)
  let errorMessage = $state('')

  let fileEntries = $state<FileEntry[]>([])
  let historyEntries = $state<HistoryEntry[]>([])
  let selectedFilePath = $state<string | null>(null)
  let expandedFiles = $state(new Set<string>())
  let historyByFile = $state(new Map<string, HistoryEntry[]>())
  let historyLoading = $state(new Set<string>())
  let diffCache = $state(new Map<string, any>())

  let snapshots = $state<SnapshotEntry[]>([])
  let selectedSnapshotId = $state<string | null>(null)
  let docStats = $state<{ size: number; modTime: string } | null>(null)
  let activePanel = $state<'versions' | 'files'>('versions')
  let autosaveSnapshots = $state<
    { path: string; createdAt: string; size: number; modTime: string }[]
  >([])
  let autosaveLoading = $state(false)
  let fileManagerError = $state('')
  let fileManagerBusy = $state(false)

  const authState = authStore

  let statusFilter = $state<Record<FileStatus, boolean>>({
    added: true,
    modified: true,
    removed: true,
    unchanged: false
  })

  let categoryFilter = $state('all')
  let lastCachePath = $state('')

  const SNAPSHOT_FILE = '.dynadoc-version.json'

  onMount(() => {
    void refreshAll()
  })

  $effect(() => {
    const nextCachePath = $activeEditorStore?.document?.cachePath || ''
    if (!nextCachePath || nextCachePath === lastCachePath) return
    lastCachePath = nextCachePath
    void refreshAll()
    void refreshAutosaveSnapshots()
  })

  $effect(() => {
    if (!selectedFilePath) {
      historyEntries = []
      return
    }
    void loadHistory(selectedFilePath)
  })

  $effect(() => {
    const docPath = getDocPath()
    if (!docPath) {
      docStats = null
      return
    }
    void (async () => {
      try {
        if (await nodeApi.fsPromises?.exists(docPath)) {
          const stat = await nodeApi.fsPromises?.stat(docPath)
          docStats = {
            size: stat.size,
            modTime: stat.mtime.toISOString()
          }
        } else {
          docStats = null
        }
      } catch {
        docStats = null
      }
    })()
  })

  function getCachePath() {
    return $activeEditorStore?.document?.cachePath || ''
  }

  function getDocLabel() {
    return $activeEditorStore?.document?.name || t('Untitled document')
  }

  function getDocPath() {
    return $activeEditorStore?.document?.path || ''
  }

  function getDocParentPath() {
    return $activeEditorStore?.document?.parentPath || ''
  }

  function getDocDisplayPath() {
    return getDocPath() || t('Unsaved document')
  }

  function getDocLockInfo() {
    const active = $activeEditorStore
    if (!active) return null
    return getDocumentLockInfo(active)
  }

  function isLockedByAnotherSession() {
    const info = getDocLockInfo()
    if (!info?.sessionId) return false
    return info.sessionId !== getSaveSessionId()
  }

  function getRelativePath(filePath: string, root: string) {
    if (!filePath || !root) return filePath
    const rel = nodeApi.path.relative(root, filePath)
    return rel.split(nodeApi.path.sep).join('/')
  }

  function getCategoryByExt(ext: string) {
    const lower = ext.toLowerCase()
    if (['.html', '.htm', '.md', '.txt', '.rtf'].includes(lower)) return 'content'
    if (['.css', '.scss', '.sass', '.less'].includes(lower)) return 'styles'
    if (['.js', '.ts', '.tsx', '.mjs'].includes(lower)) return 'scripts'
    if (['.json', '.csv', '.tsv', '.xml', '.yml', '.yaml'].includes(lower)) return 'data'
    if (
      [
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.svg',
        '.webp',
        '.mp4',
        '.mov',
        '.webm',
        '.mp3',
        '.wav',
        '.woff',
        '.woff2',
        '.ttf'
      ].includes(lower)
    )
      return 'assets'
    return 'other'
  }

  async function scanLocalFiles(root: string): Promise<LocalEntry[]> {
    if (!root) return []
    const result: LocalEntry[] = []

    const walk = async (current: string) => {
      let entries: Array<{ name: string; isDirectory: boolean }> = []
      try {
        const items = await nodeApi.fsPromises?.readdir(current, { withFileTypes: true })
        entries = items.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }))
      } catch {
        return
      }

      const markers = new Map<string, string>()
      for (const entry of entries) {
        if (!entry.name.startsWith('.')) continue
        const trimmed = entry.name.slice(1)
        const dotIndex = trimmed.lastIndexOf('.')
        if (dotIndex <= 0) continue
        const base = trimmed.slice(0, dotIndex)
        const uuid = trimmed.slice(dotIndex + 1)
        if (base && uuid) {
          markers.set(base, uuid)
        }
      }

      for (const entry of entries) {
        if (entry.name === '.dynadoc-shadow') continue
        if (entry.name.startsWith('.')) continue

        const fullPath = nodeApi.path.join(current, entry.name)
        if (entry.isDirectory) {
          await walk(fullPath)
          continue
        }

        let stat
        try {
          stat = await nodeApi.fsPromises?.stat(fullPath)
        } catch {
          continue
        }

        const relPath = getRelativePath(fullPath, root)
        const uuid = markers.get(entry.name)
        const ext = nodeApi.path.extname(entry.name)

        result.push({
          path: fullPath,
          relativePath: relPath,
          name: entry.name,
          size: stat.size,
          modTime: stat.mtime.toISOString(),
          ext,
          category: getCategoryByExt(ext),
          uuid
        })
      }
    }

    await walk(root)
    return result
  }

  function formatDate(value?: string) {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
  }

  function formatShortDate(value?: string) {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes)) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  async function refreshAutosaveSnapshots() {
    const active = $activeEditorStore
    if (!active) {
      autosaveSnapshots = []
      return
    }
    autosaveLoading = true
    autosaveSnapshots = await listAutosaveSnapshots(active)
    autosaveLoading = false
  }

  async function handleCreateAutosaveSnapshot() {
    const active = $activeEditorStore
    if (!active) return
    autosaveLoading = true
    await createAutosaveSnapshot(active)
    await refreshAutosaveSnapshots()
  }

  async function handleRestoreAutosaveSnapshot(snapshotPath: string) {
    const active = $activeEditorStore
    if (!active) return
    await restoreSnapshot(active, snapshotPath)
    await refreshAutosaveSnapshots()
  }

  async function handleCompareAutosaveSnapshot(snapshotPath: string) {
    const parentPath = getDocParentPath()
    await openSnapshotForCompare(snapshotPath, parentPath)
  }

  async function handleMoveOrRenameDocument() {
    const active = $activeEditorStore
    if (!active) return
    fileManagerBusy = true
    try {
      await EditorHelpers.saveDocumentEditor(active, { saveAs: true })
    } catch (err: any) {
      fileManagerError = err?.message || t('Failed to move document.')
    }
    fileManagerBusy = false
  }

  async function handleOpenDocumentFolder() {
    const docPath = getDocPath()
    if (!docPath) return
    const folder = nodeApi.path.dirname(docPath)
    await window.api.openFile(folder)
  }

  async function handleOpenDocument() {
    const docPath = getDocPath()
    if (!docPath) return
    await EditorCommonUtils.addNewDocumentEditor(docPath, getDocParentPath())
  }

  function escapeHtml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function splitLines(value: string) {
    return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  }

  function buildDiffRows(leftText: string, rightText: string) {
    const leftLines = splitLines(leftText)
    const rightLines = splitLines(rightText)
    const maxCells = leftLines.length * rightLines.length
    if (maxCells > 220000) {
      return {
        rows: [],
        stats: { added: 0, removed: 0, changed: 0 },
        truncated: true
      }
    }

    const dp: number[][] = Array.from({ length: leftLines.length + 1 }, () =>
      Array(rightLines.length + 1).fill(0)
    )
    for (let i = leftLines.length - 1; i >= 0; i -= 1) {
      for (let j = rightLines.length - 1; j >= 0; j -= 1) {
        dp[i][j] =
          leftLines[i] === rightLines[j]
            ? dp[i + 1][j + 1] + 1
            : Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }

    const rows: Array<{
      type: 'equal' | 'add' | 'remove'
      left?: string
      right?: string
      leftLine?: number
      rightLine?: number
    }> = []

    let i = 0
    let j = 0
    while (i < leftLines.length && j < rightLines.length) {
      if (leftLines[i] === rightLines[j]) {
        rows.push({
          type: 'equal',
          left: leftLines[i],
          right: rightLines[j],
          leftLine: i + 1,
          rightLine: j + 1
        })
        i += 1
        j += 1
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        rows.push({ type: 'remove', left: leftLines[i], leftLine: i + 1 })
        i += 1
      } else {
        rows.push({ type: 'add', right: rightLines[j], rightLine: j + 1 })
        j += 1
      }
    }

    while (i < leftLines.length) {
      rows.push({ type: 'remove', left: leftLines[i], leftLine: i + 1 })
      i += 1
    }
    while (j < rightLines.length) {
      rows.push({ type: 'add', right: rightLines[j], rightLine: j + 1 })
      j += 1
    }

    let added = 0
    let removed = 0
    let changed = 0
    for (let k = 0; k < rows.length; k += 1) {
      const row = rows[k]
      if (row.type === 'add') added += 1
      if (row.type === 'remove') removed += 1
      if (row.type === 'remove' && rows[k + 1]?.type === 'add') {
        changed += 1
        k += 1
      }
    }

    return { rows, stats: { added, removed, changed }, truncated: false }
  }

  function getShadowPath(cachePath: string, entry: FileEntry) {
    if (!cachePath) return ''
    const rel = entry.relativePath || entry.name
    return nodeApi.path.join(cachePath, '.dynadoc-shadow', rel)
  }

  async function ensureDiff(entry: FileEntry, item: HistoryEntry) {
    const key = `${entry.relativePath}:${item.timestamp}`
    if (diffCache.has(key)) return
    diffCache = new Map(diffCache.set(key, { loading: true }))

    const cachePath = getCachePath()
    const localPath = entry.path || nodeApi.path.join(cachePath, entry.relativePath)
    const shadowPath = getShadowPath(cachePath, entry)

    try {
      if (!isTextFile(entry.ext)) {
        diffCache = new Map(
          diffCache.set(key, {
            loading: false,
            error: 'Binary diff preview not available for this file type.'
          })
        )
        return
      }
      const leftText = (await nodeApi.fsPromises?.exists(shadowPath)) ? await nodeApi.fsPromises?.readFile(shadowPath, 'utf-8') : ''
      const rightText = (await nodeApi.fsPromises?.exists(localPath)) ? await nodeApi.fsPromises?.readFile(localPath, 'utf-8') : ''

      if (!leftText && !rightText) {
        diffCache = new Map(
          diffCache.set(key, { loading: false, error: 'Diff content not available.' })
        )
        return
      }

      const diff = buildDiffRows(leftText, rightText)
      diffCache = new Map(
        diffCache.set(key, {
          loading: false,
          baselineLabel: (await nodeApi.fsPromises?.exists(shadowPath))
            ? 'Last synced baseline'
            : 'Baseline unavailable',
          rows: diff.rows,
          stats: diff.stats,
          truncated: diff.truncated
        })
      )
    } catch (error: any) {
      diffCache = new Map(
        diffCache.set(key, { loading: false, error: error?.message || 'Diff failed.' })
      )
    }
  }

  function compareEntries(local: LocalEntry[], remote: RemoteEntry[]) {
    const remoteMap = new Map<string, RemoteEntry>()
    for (const entry of remote) {
      if (entry.is_dir) continue
      if (entry.name?.startsWith('.')) continue
      remoteMap.set(entry.path, entry)
    }

    const combined: FileEntry[] = []

    for (const localEntry of local) {
      const remoteEntry = remoteMap.get(localEntry.relativePath)
      let status: FileStatus = 'added'
      if (remoteEntry) {
        status = 'unchanged'
        if (remoteEntry.size !== localEntry.size) {
          status = 'modified'
        } else if (remoteEntry.mod_time && localEntry.modTime) {
          const remoteTime = new Date(remoteEntry.mod_time).getTime()
          const localTime = new Date(localEntry.modTime).getTime()
          if (!Number.isNaN(remoteTime) && !Number.isNaN(localTime)) {
            if (Math.abs(remoteTime - localTime) > 1500) status = 'modified'
          }
        }
      }

      combined.push({
        ...localEntry,
        status,
        remoteSize: remoteEntry?.size,
        remoteModTime: remoteEntry?.mod_time
      })

      if (remoteEntry) remoteMap.delete(localEntry.relativePath)
    }

    for (const remoteEntry of remoteMap.values()) {
      combined.push({
        path: '',
        relativePath: remoteEntry.path,
        name: remoteEntry.name,
        size: 0,
        modTime: remoteEntry.mod_time || '',
        ext: nodeApi.path.extname(remoteEntry.name || ''),
        category: getCategoryByExt(nodeApi.path.extname(remoteEntry.name || '')),
        status: 'removed',
        remoteSize: remoteEntry.size,
        remoteModTime: remoteEntry.mod_time,
        remoteOnly: true
      })
    }

    return combined
  }

  function getFilteredFiles() {
    return fileEntries.filter((entry) => {
      if (!statusFilter[entry.status]) return false
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) return false
      return true
    })
  }

  function isExpanded(entry: FileEntry) {
    return expandedFiles.has(entry.relativePath)
  }

  function getHistoryForEntry(entry: FileEntry) {
    return historyByFile.get(entry.relativePath) || []
  }

  function hasHistoryLoaded(entry: FileEntry) {
    return historyByFile.has(entry.relativePath)
  }

  async function toggleEntry(entry: FileEntry) {
    const key = entry.relativePath
    if (expandedFiles.has(key)) {
      expandedFiles = new Set([...expandedFiles].filter((item) => item !== key))
      return
    }
    expandedFiles = new Set([...expandedFiles, key])
    selectedFilePath = key
    if (!hasHistoryLoaded(entry)) {
      await loadHistoryForEntry(entry)
    }
  }

  function getStatusLabel(status: FileStatus) {
    switch (status) {
      case 'added':
        return t('New')
      case 'modified':
        return t('Modified')
      case 'removed':
        return t('Remote only')
      default:
        return t('In sync')
    }
  }

  function getStatusColor(status: FileStatus) {
    switch (status) {
      case 'added':
        return 'text-emerald-300'
      case 'modified':
        return 'text-amber-300'
      case 'removed':
        return 'text-rose-300'
      default:
        return 'text-[#777]'
    }
  }

  function getSelectedFile() {
    if (!selectedFilePath) return null
    return fileEntries.find((entry) => entry.relativePath === selectedFilePath) || null
  }

  async function refreshAll() {
    const cachePath = getCachePath()
    if (!cachePath) {
      fileEntries = []
      historyEntries = []
      snapshots = []
      return
    }

    isLoading = true
    errorMessage = ''

    const local = await scanLocalFiles(cachePath)
    let remote: RemoteEntry[] = []

    try {
      const result = await window.server?.sync?.open?.({ cachePath })
      if (result?.ok) {
        remote = (result?.items || []) as RemoteEntry[]
      } else if (result?.message) {
        errorMessage = result.message
        console.error('Error loading remote state:', { errorMessage })
      }
    } catch (error: any) {
      errorMessage = error?.message || t('Failed to load remote state.')
      console.error('Error loading remote state catch :', { errorMessage, error })
    }

    fileEntries = compareEntries(local, remote)
    await loadSnapshots()
    isLoading = false
  }

  async function loadHistory(filePath: string) {
    const entry = fileEntries.find((item) => item.relativePath === filePath)
    if (!entry?.uuid) {
      historyEntries = []
      return
    }

    try {
      const result = await window.server?.sync?.history?.({ uuid: entry.uuid })
      if (!result?.ok) {
        historyEntries = []
        return
      }
      historyEntries = (result.items || []) as HistoryEntry[]
    } catch {
      historyEntries = []
    }
  }

  async function loadHistoryForEntry(entry: FileEntry) {
    if (!entry?.uuid) {
      historyByFile.set(entry.relativePath, [])
      historyByFile = new Map(historyByFile)
      return
    }
    historyLoading.add(entry.relativePath)
    historyLoading = new Set(historyLoading)

    try {
      const result = await window.server?.sync?.history?.({ uuid: entry.uuid })
      const items = (result?.ok ? result.items : []) as HistoryEntry[]
      historyByFile.set(entry.relativePath, items || [])
    } catch {
      historyByFile.set(entry.relativePath, [])
    } finally {
      historyLoading.delete(entry.relativePath)
      historyLoading = new Set(historyLoading)
      historyByFile = new Map(historyByFile)
    }
  }

  function isTextFile(ext: string) {
    return ['.html', '.htm', '.md', '.txt', '.rtf', '.json', '.css', '.js', '.ts', '.tsx'].includes(
      ext.toLowerCase()
    )
  }

  function getHistoryDelta(entry: FileEntry, item: HistoryEntry) {
    const currentSize = entry.remoteOnly ? 0 : entry.size
    const delta = currentSize - (item?.size || 0)
    const direction = delta === 0 ? 'equal' : delta > 0 ? 'up' : 'down'
    return { delta, direction }
  }

  async function commitWorkspace() {
    const cachePath = getCachePath()
    if (!cachePath) {
      await openAlertModal({
        title: t('Versioning'),
        message: t('No active document workspace found.')
      })
      return
    }

    isSyncing = true
    try {
      const result = await window.server?.sync?.commit?.({ cachePath })
      if (!result?.ok) {
        await openAlertModal({
          title: t('Versioning'),
          message: result?.message || t('Commit failed.')
        })
      } else {
        await openAlertModal({
          title: t('Versioning'),
          message: t('Synced {synced}/{total} files.', {
            values: {
              synced: result?.data?.synced ?? result?.synced ?? 0,
              total: result?.data?.total ?? result?.total ?? 0
            }
          })
        })
      }
    } catch (error: any) {
      await openAlertModal({
        title: t('Versioning'),
        message: error?.message || t('Commit failed.')
      })
    }

    isSyncing = false
    await refreshAll()
  }

  async function createSnapshot() {
    const cachePath = getCachePath()
    if (!cachePath) return

    const name = await openTextInputModal({
      title: t('Save Snapshot'),
      message: t('Name this document snapshot (stored locally).'),
      placeholder: t('Sprint Review - v1')
    })

    if (!name) return

    const files = fileEntries
      .filter((entry) => !entry.remoteOnly)
      .map((entry) => ({
        path: entry.relativePath,
        size: entry.size,
        modTime: entry.modTime,
        category: entry.category
      }))

    const snapshot: SnapshotEntry = {
      id: `snap_${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      author: t('You'),
      files
    }

    snapshots = [snapshot, ...snapshots]
    await saveSnapshots(cachePath)
    selectedSnapshotId = snapshot.id
  }

  async function saveSnapshots(cachePath: string) {
    const payload = { version: 1, snapshots }
    const filePath = nodeApi.path.join(cachePath, SNAPSHOT_FILE)
    try {
      await nodeApi.fsPromises?.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')
    } catch (error: any) {
      await openAlertModal({
        title: t('Snapshot'),
        message: error?.message || t('Failed to save snapshot.')
      })
    }
  }

  async function loadSnapshots() {
    const cachePath = getCachePath()
    if (!cachePath) {
      snapshots = []
      return
    }
    const filePath = nodeApi.path.join(cachePath, SNAPSHOT_FILE)
    if (!(await nodeApi.fsPromises?.exists(filePath))) {
      snapshots = []
      return
    }
    try {
      const raw = await nodeApi.fsPromises?.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw || '{}')
      snapshots = Array.isArray(parsed.snapshots) ? parsed.snapshots : []
    } catch {
      snapshots = []
    }
  }

  function getSnapshotDiff(snapshot: SnapshotEntry | null) {
    if (!snapshot) return null

    const currentMap = new Map(
      fileEntries.filter((entry) => !entry.remoteOnly).map((entry) => [entry.relativePath, entry])
    )
    const snapshotMap = new Map(snapshot.files.map((file) => [file.path, file]))

    let added = 0
    let removed = 0
    let modified = 0

    for (const [pathKey, snapFile] of snapshotMap.entries()) {
      const current = currentMap.get(pathKey)
      if (!current) {
        removed++
        continue
      }
      if (current.size !== snapFile.size || current.modTime !== snapFile.modTime) {
        modified++
      }
    }

    for (const pathKey of currentMap.keys()) {
      if (!snapshotMap.has(pathKey)) added++
    }

    return { added, removed, modified, total: snapshot.files.length }
  }

  async function handleRename(entry: FileEntry) {
    if (!entry.path) {
      await openAlertModal({ title: t('Rename'), message: t('Cannot rename a remote-only file.') })
      return
    }

    const newName = await openTextInputModal({
      title: t('Rename File'),
      message: t('Enter the new filename or relative nodeApi.path.'),
      defaultValue: entry.relativePath
    })

    if (!newName) return

    const cachePath = getCachePath()
    const toPath = nodeApi.path.join(cachePath, newName)
    try {
      const result = await window.server?.sync?.rename?.({ from: entry.path, to: toPath })
      if (!result?.ok) {
        await openAlertModal({
          title: t('Rename'),
          message: result?.message || t('Rename failed.')
        })
      }
    } catch (error: any) {
      await openAlertModal({ title: t('Rename'), message: error?.message || t('Rename failed.') })
    }

    await refreshAll()
  }

  async function handleRollback(entry: FileEntry, item: HistoryEntry) {
    const confirmed = await openConfirmModal({
      title: t('Merge Snapshot'),
      message: t(
        'Apply this snapshot to the current file? This will overwrite the local file state.'
      ),
      confirmText: t('Apply'),
      destructive: true
    })

    if (!confirmed) return

    if (!entry.uuid || !entry.path) {
      await openAlertModal({
        title: t('Merge Snapshot'),
        message: t('Missing file tracking data.')
      })
      return
    }

    try {
      const result = await window.server?.sync?.rollback?.({
        uuid: entry.uuid,
        path: entry.path,
        timestamp: item.timestamp
      })
      if (!result?.ok) {
        await openAlertModal({
          title: t('Merge Snapshot'),
          message: result?.message || t('Merge failed.')
        })
      }
    } catch (error: any) {
      await openAlertModal({
        title: t('Merge Snapshot'),
        message: error?.message || t('Merge failed.')
      })
    }

    await refreshAll()
  }

  async function handleConflictUseRemote(entry: FileEntry, item: HistoryEntry) {
    const confirmed = await openConfirmModal({
      title: t('Resolve Conflict'),
      message: t(
        'Apply the remote snapshot to resolve this conflict? Local changes will be replaced.'
      ),
      confirmText: t('Use Remote'),
      destructive: true
    })
    if (!confirmed) return
    await handleRollback(entry, item)
  }

  async function handleConflictKeepLocal(entry: FileEntry) {
    const confirmed = await openConfirmModal({
      title: t('Resolve Conflict'),
      message: t('Keep local changes and push them to the remote version history?'),
      confirmText: t('Keep Local'),
      destructive: false
    })
    if (!confirmed) return
    await commitWorkspace()
    selectedFilePath = entry.relativePath
  }

  function getHistoryForSelected() {
    return historyEntries || []
  }

  function getSelectedSnapshot() {
    if (!selectedSnapshotId) return null
    return snapshots.find((snap) => snap.id === selectedSnapshotId) || null
  }

  function renameSelected() {
    const entry = getSelectedFile()
    if (!entry) return
    void handleRename(entry)
  }

  function mergeSelectedSnapshot(item: HistoryEntry) {
    const entry = getSelectedFile()
    if (!entry) return
    void handleRollback(entry, item)
  }

  function resolveConflictRemote(item: HistoryEntry) {
    const entry = getSelectedFile()
    if (!entry) return
    void handleConflictUseRemote(entry, item)
  }

  function resolveConflictLocal() {
    const entry = getSelectedFile()
    if (!entry) return
    void handleConflictKeepLocal(entry)
  }
</script>

<div
  class="h-full flex flex-col bg-base-200 text-base-content/80 font-sans select-none overflow-hidden border-l border-base-content/10"
>
  <div class="flex items-center gap-2 px-3 py-2 bg-base-300/55 border-b border-base-content/10">
    <button
      class="px-2 py-1 text-[10px] uppercase tracking-widest rounded-sm border border-transparent {activePanel ===
      'versions'
        ? 'bg-primary text-primary-content'
        : 'text-base-content/70 hover:bg-base-content/10'}"
      onclick={() => (activePanel = 'versions')}
    >
      {$_('Versions')}
    </button>
    <button
      class="px-2 py-1 text-[10px] uppercase tracking-widest rounded-sm border border-transparent {activePanel ===
      'files'
        ? 'bg-primary text-primary-content'
        : 'text-base-content/70 hover:bg-base-content/10'}"
      onclick={() => (activePanel = 'files')}
    >
      {$_('File Manager')}
    </button>
  </div>

  {#if activePanel === 'versions'}
    <section class="flex flex-col h-1/2 border-b border-base-content/10">
      <div
        class="flex items-center justify-between px-3 py-2 bg-base-300/60 border-b border-base-content/10"
      >
        <div class="flex items-center gap-2">
          <i class={'ph-bold i-icon ph-layers text-primary text-[14px]'}></i>
          <div class="flex flex-col">
            <span class="text-[10px] font-bold uppercase tracking-widest text-base-content"
              >{$_('Versions')}</span
            >
            <span class="text-[9px] text-base-content/45">{getDocLabel()}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="p-1 hover:bg-base-content/10 rounded-sm text-base-content/70"
            title={$_('Refresh')}
            onclick={refreshAll}
          >
            <i class={'ph-bold i-icon ph-arrow-clockwise text-[16px]'}></i>
          </button>
          <button
            class="p-1 hover:bg-[#454545] rounded-sm text-primary"
            title={$_('Save Snapshot')}
            onclick={createSnapshot}
          >
            <i class={'ph-bold i-icon ph-plus-circle text-[16px]'}></i>
          </button>
        </div>
      </div>

      <div class="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-1 bg-base-100">
        {#if snapshots.length === 0}
          <div class="p-3 text-[10px] text-base-content/45 border border-dashed border-base-content/15 rounded-sm">
            {$_(
              'No local snapshots yet. Capture a document-level snapshot to track assets, styles, and data changes together.'
            )}
          </div>
        {:else}
          {#each snapshots as snap}
            <button
              onclick={() => (selectedSnapshotId = snap.id)}
              class="w-full text-left group relative p-2 rounded-sm border border-transparent transition-all
              {selectedSnapshotId === snap.id
                ? 'bg-base-content/12 border-base-content/15'
                : 'hover:bg-base-content/5'}"
            >
              <div class="flex justify-between items-start mb-1">
                <span class="text-[11px] font-bold text-base-content">{snap.name}</span>
                <span class="text-[9px] text-base-content/35 font-mono">{snap.id.replace('snap_', 'S')}</span
                >
              </div>
              <div class="flex justify-between items-center opacity-60">
                <div class="flex items-center gap-1.5">
                  <i class={'ph-regular i-icon ph-user text-[10px]'}></i>
                  <span class="text-[9px]">{snap.author}</span>
                </div>
                <span class="text-[9px]">{formatShortDate(snap.createdAt)}</span>
              </div>
            </button>
          {/each}
        {/if}
      </div>

      {#if selectedSnapshotId}
        {@const diff = getSnapshotDiff(getSelectedSnapshot())}
        {#if diff}
          <div class="px-3 py-2 bg-base-300/55 border-t border-base-content/10 text-[9px] text-base-content/50">
            {$_('Snapshot delta: {added} added, {modified} modified, {removed} removed', {
              values: { added: diff.added, modified: diff.modified, removed: diff.removed }
            })}
          </div>
        {/if}
      {/if}
    </section>

    <section class="flex flex-col h-1/2 bg-base-200">
      <div
        class="flex items-center justify-between px-3 py-2 bg-base-300/60 border-b border-base-content/10"
      >
        <div class="flex items-center gap-2">
          <i class={'ph-bold i-icon ph-git-commit text-primary text-[14px]'}></i>
          <span class="text-[10px] font-bold uppercase tracking-widest text-base-content"
            >{$_('Document Changes')}</span
          >
        </div>
        <div class="flex gap-2 text-base-content/45">
          <button
            class="hover:text-base-content transition-colors"
            title={$_('Sync to cloud')}
            disabled={isSyncing || !$authState?.authenticated}
            onclick={commitWorkspace}
          >
            <i class={'ph-bold i-icon ph-cloud-arrow-up text-[12px]'}></i>
          </button>
        </div>
      </div>

      {#if !$authState?.authenticated}
        <div class="flex-1 flex flex-col items-center justify-center text-center px-6 py-6 gap-3 bg-base-content/5">
          <i class="ph-duotone ph-lock text-[28px] text-primary"></i>
          <div class="text-[12px] text-base-content/90 font-semibold">{$_('Sign in to view document changes')}</div>
          <div class="text-[10px] text-base-content/45">
            {$_('Connect to sync, compare history, and manage versions securely.')}
          </div>
          <button
            class="mt-2 px-3 py-1.5 rounded-md bg-primary text-base-content text-[10px] uppercase tracking-widest"
            onclick={() => EditorCommonUtils.ensureAuthenticated()}
          >
            {$_('Sign in')}
          </button>
        </div>
      {:else}
        <div
          class="px-3 py-2 border-b border-base-content/10 bg-base-300/55 text-[9px] text-base-content/45 flex flex-wrap gap-2"
        >
          <span class="text-base-content/70">{$_('Filters:')}</span>
          {#each Object.keys(statusFilter) as status}
            <button
              class="px-2 py-0.5 border border-[#444] rounded-sm uppercase tracking-wider text-[8px] {statusFilter[
                status
              ]
                ? 'bg-base-content/15 text-base-content'
                : 'text-base-content/45'}"
              onclick={() => (statusFilter = { ...statusFilter, [status]: !statusFilter[status] })}
            >
              {$_(status)}
            </button>
          {/each}
          <select
            class="ml-auto bg-base-100 border border-base-content/15 rounded-sm px-1 text-[9px] text-base-content/70"
            bind:value={categoryFilter}
          >
            <option value="all">{$_('All')}</option>
            <option value="content">{$_('Content')}</option>
            <option value="styles">{$_('Styles')}</option>
            <option value="scripts">{$_('Scripts')}</option>
            <option value="data">{$_('Data')}</option>
            <option value="assets">{$_('Assets')}</option>
            <option value="other">{$_('Other')}</option>
          </select>
        </div>

        <div class="flex-grow overflow-y-auto custom-scrollbar p-3 bg-base-100">
          {#if isLoading}
            <div class="text-[10px] text-base-content/45">{$_('Loading workspace state...')}</div>
          {:else if errorMessage}
            <div class="text-[10px] text-rose-300">{errorMessage}</div>
          {:else}
            <div class="space-y-2">
              {#each getFilteredFiles() as entry}
                <div class="rounded-sm border border-base-content/10 bg-base-content/5">
                  <button
                    class="w-full text-left px-2 py-1.5 hover:bg-base-content/7 transition-all
                    {selectedFilePath === entry.relativePath ? 'ring-1 ring-primary' : ''}"
                    onclick={() => toggleEntry(entry)}
                  >
                    <div class="flex justify-between items-start">
                      <div class="flex items-center gap-2 min-w-0">
                        <i
                          class={`ph-bold i-icon text-[11px] ${isExpanded(entry) ? 'ph-caret-down' : 'ph-caret-right'}`}
                        ></i>
                        <span class="text-[10px] text-base-content/90 truncate">{entry.relativePath}</span>
                      </div>
                      <span class={`text-[9px] ${getStatusColor(entry.status)}`}
                        >{getStatusLabel(entry.status)}</span
                      >
                    </div>
                    <div class="flex justify-between items-center text-[9px] text-base-content/35 mt-1">
                      <span>{entry.category}</span>
                      <span>{formatBytes(entry.size || entry.remoteSize || 0)}</span>
                    </div>
                  </button>

                  {#if isExpanded(entry)}
                    <div class="px-3 pb-2 pt-1 border-t border-base-content/10 bg-base-content/4">
                      {#if historyLoading.has(entry.relativePath)}
                        <div class="text-[9px] text-[#666]">{$_('Loading history...')}</div>
                      {:else if getHistoryForEntry(entry).length === 0}
                        <div class="text-[9px] text-[#666]">
                          {$_('No history yet for this file.')}
                        </div>
                      {:else}
                        <div class="space-y-2">
                          <div class="border-t bg-base-400 bg-base-100">
                            <div class="flex items-center justify-between px-3 py-2">
                              <div class="text-[10px] uppercase tracking-widest text-[#aaa]">
                                {$_('History')}
                              </div>
                              {#if getSelectedFile()}
                                <div class="flex gap-2 text-[#777]">
                                  <button
                                    class="hover:text-base-content"
                                    title={$_('Rename')}
                                    onclick={renameSelected}
                                  >
                                    <i class={'ph-bold i-icon ph-pencil-simple text-[12px]'}></i>
                                  </button>
                                </div>
                              {/if}
                            </div>
                            <div class="max-h-[160px] overflow-y-auto custom-scrollbar px-3 pb-3">
                            {#if !getSelectedFile()}
                              <div class="text-[10px] text-[#666]">
                                {$_('Select a file to see its history timeline.')}
                              </div>
                            {:else if historyEntries.length === 0}
                              <div class="text-[10px] text-[#666]">
                                {$_('No history available for this file yet.')}
                              </div>
                            {:else}
                              <div class="relative border-l border-[#333] ml-2 pl-4 space-y-4">
                                <!-- {#each getHistoryForSelected() as step} -->
                                {#each getHistoryForEntry(entry) as item}
                                  {@const delta = getHistoryDelta(entry, item)}

                                  <div class="relative">
                                    <div
                                      class={`absolute -left-[21.5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-[#1e1e1e] ${item.conflict ? 'bg-rose-400' : 'bg-[#555]'}`}
                                    ></div>

                                    <ContextMenu
                                      __placement="right-start"
                                      __offset={[16, 0]}
                                      __interactive={true}
                                    >
                                      <button
                                        class="w-full text-left text-[9px] px-2 py-1 rounded-sm hover:bg-[#2a2a2a]"
                                        onclick={() => ensureDiff(entry, item)}
                                      >
                                        <div class="flex justify-between items-center">
                                          <span class="text-[10px] text-[#ccc]"
                                            >{formatDate(item.timestamp)}</span
                                          >
                                          <span class="text-[9px] text-[#555] font-mono"
                                            >{formatBytes(item.size)}</span
                                          >
                                        </div>
                                        <div class="flex items-center gap-2 mt-1">
                                          {#if item.conflict}
                                            <span
                                              class="text-[8px] px-1 bg-rose-400/20 text-rose-300 rounded-[2px] border border-rose-400/40"
                                              >{$_('Conflict')}</span
                                            >
                                          {/if}
                                          <span class="text-[8px] text-primary font-mono">
                                            {item.checksum?.slice(0, 8)}
                                          </span>
                                        </div>
                                      </button>

                                      <div slot="content" class="version-diff-panel">
                                        <div class="diff-header">
                                          <div>
                                            <div class="text-[11px] font-bold text-base-content">
                                              {entry.name}
                                            </div>
                                            <div class="text-[9px] text-base-content/50">
                                              {entry.relativePath}
                                            </div>
                                          </div>
                                          <div class="text-[9px] text-base-content/40">
                                            {formatDate(item.timestamp)}
                                          </div>
                                        </div>
                                        {@const diffKey = `${entry.relativePath}:${item.timestamp}`}
                                        {@const diffState = diffCache.get(diffKey)}

                                        <div class="diff-meta">
                                          <div class="diff-card">
                                            <span>{$_('Current size')}</span>
                                            <strong>{formatBytes(entry.size || 0)}</strong>
                                          </div>
                                          <div class="diff-card">
                                            <span>{$_('Snapshot size')}</span>
                                            <strong>{formatBytes(item.size || 0)}</strong>
                                          </div>
                                          <div class="diff-card">
                                            <span>{$_('Delta')}</span>
                                            <strong
                                              class={delta.direction === 'up'
                                                ? 'text-emerald-300'
                                                : delta.direction === 'down'
                                                  ? 'text-rose-300'
                                                  : 'text-[#bbb]'}
                                            >
                                              {delta.delta === 0
                                                ? '—'
                                                : `${delta.delta > 0 ? '+' : ''}${formatBytes(Math.abs(delta.delta))}`}
                                            </strong>
                                          </div>
                                        </div>

                                        {#if diffState?.loading}
                                          <div class="diff-note">
                                            {$_('Building diff preview…')}
                                          </div>
                                        {:else if diffState?.error}
                                          <div class="diff-note text-rose-300">
                                            {diffState.error}
                                          </div>
                                        {:else if diffState?.rows?.length > 0}
                                          <div class="diff-badges">
                                            <span class="badge add"
                                              >+{diffState.stats?.added || 0}</span
                                            >
                                            <span class="badge remove"
                                              >-{diffState.stats?.removed || 0}</span
                                            >
                                            <span class="badge change"
                                              >~{diffState.stats?.changed || 0}</span
                                            >
                                            <span class="badge baseline"
                                              >{diffState.baselineLabel}</span
                                            >
                                          </div>
                                          <div class="diff-note">
                                            {$_(
                                              'Baseline uses the last synced snapshot stored locally.'
                                            )}
                                          </div>

                                          <div class="diff-table">
                                            <div class="diff-table-header">
                                              <span>{$_('Baseline')}</span>
                                              <span>{$_('Current')}</span>
                                            </div>
                                            <div class="diff-table-body">
                                              {#each diffState.rows as row}
                                                <div class={`diff-row ${row.type}`}>
                                                  <div class="diff-cell left">
                                                    <span class="line">{row.leftLine || ''}</span>
                                                    <span class="text">
                                                      {#if row.left}
                                                        {@html escapeHtml(row.left)}
                                                      {/if}
                                                    </span>
                                                  </div>
                                                  <div class="diff-cell right">
                                                    <span class="line">{row.rightLine || ''}</span>
                                                    <span class="text">
                                                      {#if row.right}
                                                        {@html escapeHtml(row.right)}
                                                      {/if}
                                                    </span>
                                                  </div>
                                                </div>
                                              {/each}
                                            </div>
                                          </div>
                                        {:else if diffState?.truncated}
                                          <div class="diff-note">
                                            {$_('Diff preview truncated for large files.')}
                                          </div>
                                        {:else}
                                          <div class="diff-note">
                                            {$_('Diff not available yet. Click again to refresh.')}
                                          </div>
                                        {/if}
                                        <div class="diff-actions">
                                          {#if item.conflict}
                                            <button
                                              class="diff-btn ghost"
                                              onclick={() => resolveConflictRemote(item)}
                                            >
                                              {$_('Use remote')}
                                            </button>
                                            <button
                                              class="diff-btn ghost"
                                              onclick={resolveConflictLocal}
                                            >
                                              {$_('Keep local')}
                                            </button>
                                          {/if}
                                          <button
                                            class="diff-btn"
                                            onclick={() => mergeSelectedSnapshot(item)}
                                          >
                                            {$_('Merge snapshot')}
                                          </button>
                                          <button
                                            class="diff-btn ghost"
                                            onclick={() => handleRollback(entry, item)}
                                          >
                                            {$_('Apply now')}
                                          </button>
                                        </div>
                                      </div>
                                    </ContextMenu>
                                  </div>
                                {/each}
                              </div>
                            {/if}
                          </div>
                        </div>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="border-t bg-base-400 bg-base-100">
        <div class="flex items-center justify-between px-3 py-2">
          <div class="text-[10px] uppercase tracking-widest text-[#aaa]">{$_('History')}</div>
          {#if getSelectedFile()}
            <div class="flex gap-2 text-[#777]">
              <button class="hover:text-base-content" title={$_('Rename')} onclick={renameSelected}>
                <i class={'ph-bold i-icon ph-pencil-simple text-[12px]'}></i>
              </button>
            </div>
          {/if}
        </div>
        <div class="max-h-[160px] overflow-y-auto custom-scrollbar px-3 pb-3">
          {#if !getSelectedFile()}
            <div class="text-[10px] text-[#666]">
              {$_('Select a file to see its history timeline.')}
            </div>
          {:else if historyEntries.length === 0}
            <div class="text-[10px] text-[#666]">
              {$_('No history available for this file yet.')}
            </div>
          {:else}
            <div class="relative border-l border-[#333] ml-2 pl-4 space-y-4">
              {#each getHistoryForSelected() as step}
                <div class="relative">
                  <div
                    class={`absolute -left-[21.5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-[#1e1e1e] ${step.conflict ? 'bg-rose-400' : 'bg-[#555]'}`}
                  ></div>
                  <div class="flex flex-col">
                    <div class="flex justify-between items-center">
                      <span class="text-[10px] text-[#ccc]">{formatDate(step.timestamp)}</span>
                      <span class="text-[9px] text-[#555] font-mono">{formatBytes(step.size)}</span>
                    </div>
                    <div class="flex items-center gap-2 mt-1">
                      {#if step.conflict}
                        <span
                          class="text-[8px] px-1 bg-rose-400/20 text-rose-300 rounded-[2px] border border-rose-400/40"
                          >{$_('Conflict')}</span
                        >
                        <button
                          class="text-[9px] text-rose-200 hover:text-base-content"
                          onclick={() => resolveConflictRemote(step)}
                        >
                          {$_('Use remote')}
                        </button>
                        <button
                          class="text-[9px] text-emerald-200 hover:text-base-content"
                          onclick={resolveConflictLocal}
                        >
                          {$_('Keep local')}
                        </button>
                      {/if}
                      {#if !step.conflict}
                        <button
                          class="text-[9px] text-primary hover:text-base-content"
                          onclick={() => mergeSelectedSnapshot(step)}
                        >
                          {$_('Merge snapshot')}
                        </button>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      {/if}
    </section>
  {:else}
    <section class="flex flex-col h-full bg-base-200">
      <div
        class="flex items-center justify-between px-3 py-2 bg-base-200 border-b bg-base-400"
      >
        <div class="flex items-center gap-2">
          <i class={'ph-bold i-icon ph-folder text-primary text-[14px]'}></i>
          <div class="flex flex-col">
            <span class="text-[10px] font-bold uppercase tracking-widest text-base-content"
              >{$_('File Manager')}</span
            >
            <span class="text-[9px] text-[#888]">{getDocLabel()}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="p-1 hover:bg-[#454545] rounded-sm text-[#bbb]"
            title={$_('Refresh')}
            onclick={refreshAutosaveSnapshots}
          >
            <i class={'ph-bold i-icon ph-arrow-clockwise text-[16px]'}></i>
          </button>
          <button
            class="p-1 hover:bg-[#454545] rounded-sm text-primary"
            title={$_('Create Snapshot Now')}
            onclick={handleCreateAutosaveSnapshot}
            disabled={autosaveLoading}
          >
            <i class={'ph-bold i-icon ph-plus-circle text-[16px]'}></i>
          </button>
        </div>
      </div>

      <div
        class="px-3 py-2 border-b bg-base-400 bg-[#2f2f2f] text-[9px] text-[#888] space-y-1"
      >
        <div class="flex items-center gap-2">
          <span class="text-[#aaa]">{$_('Path:')}</span>
          <span class="truncate">{getDocDisplayPath()}</span>
          {#if isLockedByAnotherSession()}
            <span class="ml-2 text-rose-300 uppercase tracking-wide">{$_('Locked')}</span>
          {/if}
        </div>
        <div class="flex items-center gap-3 text-[9px] text-[#666]">
          <span>{$_('Size:')} {formatBytes(docStats?.size || 0)}</span>
          <span>{$_('Modified:')} {formatShortDate(docStats?.modTime)}</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="px-2 py-1 text-[9px] border border-[#444] rounded-sm hover:bg-[#3a3a3a]"
            onclick={handleOpenDocument}
          >
            {$_('Open Document')}
          </button>
          <button
            class="px-2 py-1 text-[9px] border border-[#444] rounded-sm hover:bg-[#3a3a3a]"
            onclick={handleOpenDocumentFolder}
          >
            {$_('Reveal in Folder')}
          </button>
          <button
            class="px-2 py-1 text-[9px] border border-[#444] rounded-sm hover:bg-[#3a3a3a]"
            onclick={handleMoveOrRenameDocument}
            disabled={fileManagerBusy || isLockedByAnotherSession()}
          >
            {$_('Rename / Move')}
          </button>
        </div>
        {#if fileManagerError}
          <div class="text-[9px] text-rose-300">{fileManagerError}</div>
        {/if}
      </div>

      <div class="flex-grow overflow-y-auto custom-scrollbar p-3 bg-base-100 space-y-2">
        <div class="text-[10px] uppercase tracking-widest text-[#888]">{$_('Version History')}</div>
        {#if autosaveLoading}
          <div class="text-[10px] text-[#888]">{$_('Loading history...')}</div>
        {:else if autosaveSnapshots.length === 0}
          <div class="p-3 text-[10px] text-[#777] border border-dashed border-[#3e3e3e] rounded-sm">
            {$_('No snapshots yet. Autosave will capture versions in the background.')}
          </div>
        {:else}
          {#each autosaveSnapshots as snap}
            <div class="rounded-sm border border-[#303030] bg-[#242424] p-2">
              <div class="flex items-center justify-between">
                <div class="flex flex-col">
                  <span class="text-[10px] text-base-content">{formatShortDate(snap.createdAt)}</span>
                  <span class="text-[9px] text-[#666]">
                    {formatBytes(snap.size)} · {formatShortDate(snap.modTime)}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    class="text-[9px] px-2 py-1 border border-[#444] rounded-sm hover:bg-[#3a3a3a]"
                    onclick={() => handleCompareAutosaveSnapshot(snap.path)}
                  >
                    {$_('Compare')}
                  </button>
                  <button
                    class="text-[9px] px-2 py-1 border border-[#444] rounded-sm hover:bg-[#3a3a3a]"
                    onclick={() => handleRestoreAutosaveSnapshot(snap.path)}
                  >
                    {$_('Restore')}
                  </button>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </section>
  {/if}
</div>

<style lang="postcss">
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 2px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  :global(.i-icon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  :global(.version-diff-panel) {
    width: 520px;
    background: rgba(26, 26, 26, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 12px;
    box-shadow:
      0 24px 50px -20px rgba(0, 0, 0, 0.6),
      0 12px 30px -18px rgba(0, 0, 0, 0.6);
  }

  :global(.version-diff-panel .diff-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding-bottom: 8px;
    margin-bottom: 10px;
  }

  :global(.version-diff-panel .diff-meta) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 10px;
  }

  :global(.version-diff-panel .diff-card) {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.6);
  }

  :global(.version-diff-panel .diff-card strong) {
    font-size: 12px;
    color: #fff;
  }

  :global(.version-diff-panel .diff-badges) {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  :global(.version-diff-panel .badge) {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 6px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  :global(.version-diff-panel .badge.add) {
    background: rgba(52, 211, 153, 0.12);
    color: #6ee7b7;
  }

  :global(.version-diff-panel .badge.remove) {
    background: rgba(248, 113, 113, 0.15);
    color: #fca5a5;
  }

  :global(.version-diff-panel .badge.change) {
    background: rgba(251, 191, 36, 0.15);
    color: #fcd34d;
  }

  :global(.version-diff-panel .badge.baseline) {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
  }

  :global(.version-diff-panel .diff-table) {
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    overflow: hidden;
    background: rgba(18, 18, 18, 0.7);
    margin-bottom: 10px;
  }

  :global(.version-diff-panel .diff-table-header) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.5);
  }

  :global(.version-diff-panel .diff-table-body) {
    max-height: 240px;
    overflow: auto;
  }

  :global(.version-diff-panel .diff-row) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    font-family:
      'SFMono-Regular', ui-monospace, SFMono, Menlo, Monaco, Consolas, 'Liberation Mono',
      'Courier New', monospace;
    font-size: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  :global(.version-diff-panel .diff-row.equal) {
    background: rgba(255, 255, 255, 0.02);
  }

  :global(.version-diff-panel .diff-row.add) {
    background: rgba(52, 211, 153, 0.08);
  }

  :global(.version-diff-panel .diff-row.remove) {
    background: rgba(248, 113, 113, 0.08);
  }

  :global(.version-diff-panel .diff-cell) {
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: 8px;
    padding: 4px 8px;
    align-items: start;
  }

  :global(.version-diff-panel .diff-cell.left) {
    border-right: 1px solid rgba(255, 255, 255, 0.04);
  }

  :global(.version-diff-panel .diff-cell .line) {
    color: rgba(255, 255, 255, 0.3);
    text-align: right;
  }

  :global(.version-diff-panel .diff-cell .text) {
    color: rgba(255, 255, 255, 0.85);
    white-space: pre-wrap;
    word-break: break-word;
  }

  :global(.version-diff-panel .diff-note) {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.45);
    line-height: 1.4;
    margin-bottom: 10px;
  }

  :global(.version-diff-panel .diff-actions) {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  :global(.version-diff-panel .diff-btn) {
    flex: 1;
    background: var(--color-base-300);
    color: #111;
    border-radius: 8px;
    padding: 6px 8px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  :global(.version-diff-panel .diff-btn.ghost) {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
  }
</style>
