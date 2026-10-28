<script lang="ts">
  import TreeItem from './TreeItem.svelte'
  import { onMount, untrack } from 'svelte'
  import EditorCommonUtils from '../../../../utils/common.utils.js'
  import ContextMenuWidget from '../../contextMenu/components/ContextMenuWidget.svelte'
  import { computePosition, flip, offset, shift } from '@floating-ui/dom'
  import type { ContextMenuItem } from '../../contextMenu/utils/utils.js'
  import { openPrimarySearchPane } from '../../../../../src/stores/search.store'
  import {
    _$_documentEditorsList,
    _$_wysiwygEditorsList
  } from '../../../../../src/stores/editor.store'
  import { DocumentEditorModel, DocumentModel } from '../../../../models/Document'
  import { defineVariable } from '../../../../extensions/tiptap/CustomVarExtension/stores/variableManipulator'
  import { get } from 'svelte/store'
  import { _ } from 'svelte-i18n'
  import Utils from '../../../../utils/Utils'
  import { openAlertModal } from '../../../../stores/alertModal.store'
  import { openConfirmModal } from '../../../../stores/confirmModal.store'
  import { openShareModal } from '../../../../stores/shareModal.store'
  import { openShareManagerModal } from '../../../../stores/shareManagerModal.store'
  import { _$_recentDocuments } from '../../../../stores/common.store'
  import { DriveActions } from '../../../../utils/driveActions'
  import {
    TreeActions,
    type TreeSourceType,
    type FileNode as BaseFileNode
  } from '../../../../utils/treeActions'
  import { ShareActions, ShareUtils, type ShareInfo } from '../../../../utils/shareUtils'
  import {
    enqueueDownloadJobs,
    openDownloadManager
  } from '../../../../stores/downloadManager.store'
  import { nodeApi } from '../../../../utils/shims/node'
  import { shareCacheListDir, shareCacheStat } from '../../../../utils/shareCache'
  const t = get(_)

  // const isBrowserUpload = typeof window !== 'undefined' && !nodeApi?.fs
  const isBrowserUpload = true

  async function pickBrowserFiles(
    filters?: Array<{ name: string; extensions: string[] }>
  ): Promise<File[]> {
    if (typeof window === 'undefined') return []
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
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
    const promise = new Promise<File[]>((resolve) => {
      input.onchange = () => {
        resolve(Array.from(input.files || []))
      }
    })
    document.body.appendChild(input)
    input.click()
    document.body.removeChild(input)
    return promise
  }

  // const nodeApi =
  //   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
  // const fs = nodeApi?.fs
  // const path = nodeApi?.path

  type InlineInputMode = 'rename' | 'create-file' | 'create-folder' | 'add-locale' | 'define-var'
  type InlineInputState = {
    mode: InlineInputMode
    parentPath: string
    targetPath?: string
    value: string
    placeholder?: string
  }
  type FileNode = {
    name: string
    path: string
    isFolder: boolean
    displayName?: string
    isMainFile?: boolean
    isAssetFile?: boolean
    isDocumentContent?: boolean
    isLocked?: boolean
    ephemeralMeta?: {
      deadlineAt: string
      readsLeft?: number | null
      writesLeft?: number | null
    } | null
    shareMeta?: {
      shareId?: string
      link?: string
      role?: string
      publicRole?: string
      checked?: boolean
    }
  }
  // type TreeSourceType = 'local' | 'drive'
  type TreeReadDirHandler = (
    dirPath: string,
    options?: { sort?: boolean; showHidden?: boolean; showSystemHidden?: boolean; query?: string }
  ) => Promise<FileNode[]>
  type TreeCapabilities = {
    canCreate: boolean
    canRename: boolean
    canCopyCutPaste: boolean
    canDuplicate: boolean
    canDelete: boolean
    canDragDrop: boolean
    canOpenInTerminal: boolean
    canRevealInOS: boolean
    canVersioning: boolean
    canSecurity: boolean
    canTranslation: boolean
    canVariables: boolean
  }

  let {
    __rootPath,
    __rootParentPath = '',
    __sourceType = 'local',
    __readDirHandler = null,
    __accountOrg = '',
    __capabilities = null,
    __searchQuery = '',
    __requestCreateFolderKey = 0,
    __requestCreateFolderParentPath = '',
    __requestCreateFileKey = 0,
    __requestCreateFileParentPath = '',
    __defaultNewFileName = '',
    __defaultFileExtension = '',
    __defaultFileContent = '',
    __enforceDocumentExtension = true,
    __excludeExtensions = null,
    __contextMenuMode = 'default',
    __openOnSelect = true,
    __selectionMode = 'single',
    __onSelect = null,
    __onSelectionChange = null,
    __contextMenuItems = null
  } = $props<{
    __rootPath: string
    __rootParentPath?: string
    __sourceType?: TreeSourceType
    __readDirHandler?: TreeReadDirHandler | null
    __accountOrg?: string
    __capabilities?: Partial<TreeCapabilities> | null
    __searchQuery?: string
    __requestCreateFolderKey?: number
    __requestCreateFolderParentPath?: string
    __requestCreateFileKey?: number
    __requestCreateFileParentPath?: string
    __defaultNewFileName?: string
    __defaultFileExtension?: string
    __defaultFileContent?: string
    __enforceDocumentExtension?: boolean
    __excludeExtensions?: string[] | null
    __contextMenuMode?: 'default' | 'latex'
    __openOnSelect?: boolean
    /**
     * 'single' (default) – standard single-path highlight; file click opens the file.
     * 'multi' – files show a checkbox; clicking a file toggles it in the selection
     *           without opening it. Pairs with __openOnSelect={false} and
     *           __onSelectionChange to receive the selected file list.
     */
    __selectionMode?: 'single' | 'multi'
    __onSelect?: ((item: FileNode) => void) | null
    __onSelectionChange?: ((items: FileNode[]) => void) | null
    __contextMenuItems?: (ctx: {
      item: FileNode
      selection: FileNode[]
      selectionCount: number
      isDriveSource: boolean
      isFolder: boolean
      isMainFile: boolean
    }) => ContextMenuItem[] | null
  }>()
  //   const  fs = nodeApi.fs
  //   const  path = nodeApi.path

  // Reactive State
  let expandedPaths = $state(new Set([__rootPath]))
  let selectedPath = $state('')
  let selectedPaths = $state<Set<string>>(new Set())
  let lastFocusedPath = $state<string | null>(null)
  let treeRootEl = $state<HTMLElement | null>(null)
  let knownNodes = $state(new Map<string, FileNode>())
  let excludeExtensions = $state(['.tmp', '.DS_Store'])
  // let excludeExtensions = $state(['.json', '.tmp', '.DS_Store'])
  let refreshTick = $state(0)
  let docLockPath = $state('')
  let cacheRoot = $state('')
  let syncCommitTimer: ReturnType<typeof setTimeout> | null = null

  onMount(async () => {
    try {
      cacheRoot = (await window.api?.getCacheDir?.()) || ''
    } catch {
      cacheRoot = ''
    }
  })
  let isDocLocked = $state(false)
  let nowTick = $state(Date.now())
  let shareCache = $state(
    new Map<
      string,
      { shareId?: string; link?: string; role?: string; publicRole?: string; checked?: boolean }
    >()
  )
  let pendingSharePaths = $state(new Set<string>())
  let shareFetchTimer: ReturnType<typeof setTimeout> | null = null

  // --- Context Menu State ---
  let menuShow = $state(false)
  let menuX = $state(0)
  let menuY = $state(0)
  let menuItems = $state<ContextMenuItem[]>([])
  let menuRef = $state<HTMLElement | null>(null)
  let lastMenuAnchor = $state<{ x: number; y: number } | null>(null)

  type ClipboardItem = {
    items: FileNode[]
    mode: 'copy' | 'cut'
    sourceType: TreeSourceType
    accountOrg?: string
  }
  type DragMeta = {
    path: string
    sourceType: TreeSourceType
    accountOrg?: string
    isFolder?: boolean
  }

  let clipboardItem = $state<ClipboardItem | null>(null)
  let lastActionLabel = $state('')
  let lastAction: (() => Promise<void>) | null = null
  let actionQueue = Promise.resolve()
  let actionQueueBusy = $state(false)
  let driveProgress = $state<{
    active: boolean
    label: string
    total: number
    done: number
  } | null>(null)
  let diskShareSyncing = $state(false)
  let diskShareSyncLabel = $state('Syncing to drive...')
  let lastShareSyncByCache = $state(new Map<string, number>())
  let draggingInternalPath = $state<string | null>(null)
  let dragOverPath = $state<string | null>(null)
  let dragOverPlacement = $state<'before' | 'after'>('before')
  let dragOverBlocked = $state(false)
  let inlineInput = $state<InlineInputState | null>(null)
  let lastExternalCreateFolderKey = $state(__requestCreateFolderKey)
  let lastExternalCreateFileKey = $state(__requestCreateFileKey)
  let lastSelectionSignature = $state('')

  const isDriveSource = $derived(__sourceType === 'drive')
  const driveAccountOrg = $derived(__accountOrg || '')

  function withDriveAccount(payload: Record<string, any> = {}) {
    return driveAccountOrg ? { ...payload, accountOrg: driveAccountOrg } : payload
  }

  function withSpecificDriveAccount(payload: Record<string, any> = {}, accountOrg?: string) {
    return accountOrg ? { ...payload, accountOrg } : payload
  }
  const effectiveCapabilities = $derived({
    canCreate: !isDriveSource,
    canRename: !isDriveSource,
    canCopyCutPaste: !isDriveSource,
    canDuplicate: !isDriveSource,
    canDelete: !isDriveSource,
    canDragDrop: !isDriveSource,
    canOpenInTerminal: !isDriveSource,
    canRevealInOS: !isDriveSource,
    canVersioning: !isDriveSource,
    canSecurity: !isDriveSource,
    canTranslation: !isDriveSource,
    canVariables: !isDriveSource,
    ...(__capabilities || {})
  })

  function notify(message: string) {
    console.info(`[TreeView] ${message}`)
  }

  function beginDriveProgress(label: string, total = 1) {
    driveProgress = {
      active: true,
      label,
      total: Math.max(1, total),
      done: 0
    }
  }

  function bumpDriveProgress(delta = 1) {
    if (!driveProgress) return
    const nextDone = Math.min(driveProgress.total, driveProgress.done + delta)
    driveProgress = { ...driveProgress, done: nextDone }
  }

  function finishDriveProgress() {
    if (!driveProgress) return
    driveProgress = { ...driveProgress, done: driveProgress.total }
    const current = driveProgress
    setTimeout(() => {
      if (driveProgress === current) driveProgress = null
    }, 450)
  }

  async function withDriveProgress<T>(label: string, total: number, fn: () => Promise<T>) {
    beginDriveProgress(label, total)
    try {
      return await fn()
    } finally {
      finishDriveProgress()
    }
  }

  const extractDocUuid = ShareUtils.extractDocUuid.bind(ShareUtils)

  const buildSidecarPaths = (item: FileNode) => TreeActions.buildSidecarPaths(item, isDriveSource)

  const hasChangesSince = TreeActions.hasChangesSince.bind(TreeActions)

  async function ensureDriveShareForDisk(item: FileNode, ensureSync: boolean) {
    return ShareUtils.ensureDriveShareForDisk(item, {
      accountOrg: driveAccountOrg,
      ensureSync,
      onSyncStart: () => {
        diskShareSyncLabel = t('Syncing to drive...')
        diskShareSyncing = true
      },
      onSyncEnd: () => {
        diskShareSyncing = false
      },
      resolveRootDocument: () => resolveRootDocument()
    })
  }

  async function fetchShareForPath(pathValue: string) {
    return ShareUtils.fetchShareForPath(pathValue, isDriveSource, driveAccountOrg)
  }

  const openShareLink = ShareUtils.openShareLink.bind(ShareUtils)

  function showAlert(message: string, title = 'Notice') {
    return openAlertModal({ title, message })
  }

  function updateLastAction(label: string, action: () => Promise<void>) {
    lastActionLabel = label
    lastAction = action
  }

  async function enqueueAction(label: string, action: () => Promise<void>) {
    const run = async () => {
      actionQueueBusy = true
      try {
        await action()
      } finally {
        actionQueueBusy = false
      }
    }
    actionQueue = actionQueue.then(run, run)
    return actionQueue
  }

  async function runSafe(action: () => Promise<void>, label?: string) {
    try {
      if (label) updateLastAction(label, action)
      await action()
    } catch (error) {
      console.error('Tree action failed', error)
      await showAlert(`Action failed: ${label || 'Unknown action'}`, 'Action failed')
    }
  }

  const defaultReadDirHandler: TreeReadDirHandler = async (dirPath, options = {}) => {
    if (isDriveSource) {
      const driveList = DriveActions.listDir
      if (!driveList) return []
      const items = await driveList(
        withDriveAccount({
          rootPath: __rootPath,
          path: dirPath,
          query: options.query || __searchQuery || '',
          sort: options.sort ?? true
        })
      )
      return Array.isArray(items) ? items : []
    }

    // Public-share (guest) mode: the shared document is mounted into the in-memory share-cache.
    // We must NOT call backend/Node FS readDir here, otherwise unauthenticated users will hit 401/404.
    if (typeof dirPath === 'string' && dirPath.startsWith('share-cache/')) {
      const children = shareCacheListDir(dirPath)
      const nodes: FileNode[] = children.map((name) => {
        const fullPath = `${dirPath}/${name}`.replace(/\/{2,}/g, '/')
        const st: any = shareCacheStat(fullPath)
        return {
          name,
          path: fullPath,
          isFolder: Boolean(st?.isDirectory?.()),
          displayName: name
        }
      })
      if (options.sort !== false) {
        nodes.sort((a, b) => {
          if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
          return String(a.name).localeCompare(String(b.name))
        })
      }
      return nodes
    }

    return window.api.readDir(dirPath, options)
  }

  onMount(() => {
    if (isDriveSource) return
    const id = window.setInterval(() => {
      nowTick = Date.now()
    }, 60_000)
    return () => window.clearInterval(id)
  })

  async function readDirHandler(
    dirPath: string,
    options: {
      sort?: boolean
      showHidden?: boolean
      showSystemHidden?: boolean
      query?: string
    } = {}
  ) {
    const reader = __readDirHandler || defaultReadDirHandler
    const items = await reader(dirPath, options)
    if (!Array.isArray(items)) return []
    // Promise.all rather than a sequential loop: one lstat per entry, and a
    // directory listing is the one place where doing them one after another
    // would be felt. The calls are independent, so the order of completion
    // does not matter -- map preserves the order of results regardless.
    const normalized = await Promise.all(
      items.map(async (item: any) => {
        if (typeof item === 'string') {
          const fullPath = isDriveSource
            ? normalizeDrivePath(item)
            : nodeApi.path.join(dirPath, item)
          let isFolder = false
          try {
            const stat = await nodeApi.fsPromises.lstat(fullPath)
            isFolder =
              typeof stat?.isDirectory === 'function'
                ? stat.isDirectory()
                : Boolean(stat?.isDirectory || stat?.isDir)
          } catch {
            isFolder = false
          }
          return { name: item, path: fullPath, isFolder }
        }
        return {
          ...item,
          isFolder: Boolean(
            item?.isFolder ??
            item?.folder ??
            item?.isDir ??
            item?.is_dir ??
            item?.isDirectory ??
            false
          )
        }
      })
    )
    queueShareHydration(normalized)
    return normalized.map(decorateNode)
  }

  $effect(() => {
    if (Array.isArray(__excludeExtensions)) {
      excludeExtensions = [...__excludeExtensions]
    }
  })

  $effect(() => {
    if (isDriveSource) {
      isDocLocked = false
      docLockPath = ''
      return
    }
    if (!__rootParentPath) {
      isDocLocked = false
      docLockPath = ''
      return
    }
    docLockPath = `${__rootParentPath}.lock`
    try {
      isDocLocked = nodeApi.fs.existsSync(docLockPath)
    } catch {
      isDocLocked = false
    }
  })

  function normalizeDrivePath(value: string) {
    const raw = String(value || '').trim()
    if (!raw || raw === '/' || raw === '.') return ''
    return raw
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/{2,}/g, '/')
  }

  function driveJoin(...parts: string[]) {
    return normalizeDrivePath(parts.filter(Boolean).join('/'))
  }

  function driveBasename(targetPath: string) {
    const normalized = normalizeDrivePath(targetPath)
    if (!normalized) return ''
    const split = normalized.split('/').filter(Boolean)
    return split[split.length - 1] || ''
  }

  function driveDirname(targetPath: string) {
    const normalized = normalizeDrivePath(targetPath)
    if (!normalized) return ''
    const idx = normalized.lastIndexOf('/')
    if (idx < 0) return ''
    return normalized.slice(0, idx)
  }

  function getParentDir(item: FileNode) {
    if (isDriveSource) {
      const parent = item.isFolder ? item.path || __rootPath : driveDirname(item.path)
      return parent || __rootPath
    }
    return item.isFolder ? item.path : nodeApi.path.dirname(item.path)
  }

  function getRelativePath(item: FileNode) {
    if (isDriveSource) return normalizeDrivePath(item.path)
    try {
      return nodeApi.path.relative(__rootPath, item.path) || item.path
    } catch {
      return item.path
    }
  }

  async function copyTextToClipboard(value: string) {
    if (!value) return
    await EditorCommonUtils.copyToClipboard(value)
  }

  function isMainDocumentFile(item: FileNode) {
    return !item.isFolder && item.name.toLowerCase() === Utils.MAIN_DOCUMENT_FILE.toLowerCase()
  }

  function getDisplayName(item: FileNode) {
    if (item.displayName) return item.displayName
    if (item.isFolder) return item.name
    if (isMainDocumentFile(item)) {
      if (isDriveSource) {
        return driveBasename(driveDirname(item.path)) || item.name
      }
      return nodeApi.path.basename(nodeApi.path.dirname(item.path)) || item.name
    }
    if (item.name.toLowerCase().endsWith(Utils.MAIN_DOCUMENT_FILE_EXTENSION)) {
      return item.name.slice(0, -Utils.MAIN_DOCUMENT_FILE_EXTENSION.length)
    }
    return item.name
  }

  function decorateNode(item: FileNode): FileNode {
    const assetsRoot = __rootPath ? nodeApi.path.join(__rootPath, 'assets') : ''
    const isAssetFile = !item.isFolder && assetsRoot && item.path.startsWith(assetsRoot)
    const isDocumentContent =
      !item.isFolder && __rootPath && item.path.startsWith(__rootPath) && !isAssetFile
    const rootDocument = resolveRootDocument()
    const isMainFile = isMainDocumentFile(item)
    const rootEphemeral = rootDocument?.getEphemeralTimeRemaining?.()
    const ephemeralMeta =
      item.isFolder || !isMainFile || !rootDocument || !rootEphemeral?.deadlineAt
        ? null
        : {
            deadlineAt: rootEphemeral.deadlineAt,
            readsLeft: rootEphemeral.readsLeft,
            writesLeft: rootEphemeral.writesLeft
          }
    const shareMeta = shareCache.get(item.path)
    return {
      ...item,
      isMainFile,
      displayName: getDisplayName(item),
      isAssetFile,
      isDocumentContent,
      isLocked: isDocLocked && isMainDocumentFile(item),
      ephemeralMeta,
      shareMeta
    }
  }

  function queueShareHydration(items: FileNode[]) {
    if (isDriveSource) return
    for (const item of items) {
      if (!item?.path || item.isFolder) continue
      if (shareCache.has(item.path)) continue
      pendingSharePaths.add(item.path)
    }
    if (!pendingSharePaths.size) return
    if (shareFetchTimer) return
    shareFetchTimer = setTimeout(async () => {
      const targets = Array.from(pendingSharePaths)
      pendingSharePaths = new Set()
      shareFetchTimer = null
      if (!targets.length) return
      let updated = false
      for (const pathValue of targets.slice(0, 30)) {
        try {
          const share = await fetchShareForPath(pathValue)
          if (share) {
            shareCache.set(pathValue, {
              shareId: share.shareId || share.id,
              link: share.link,
              role: share.role || share.publicRole,
              publicRole: share.publicRole,
              checked: true
            })
          } else {
            shareCache.set(pathValue, { checked: true })
          }
          updated = true
        } catch {
          shareCache.set(pathValue, { checked: true })
          updated = true
        }
      }
      if (updated) {
        refreshTick = Date.now()
      }
      if (pendingSharePaths.size) {
        queueShareHydration([])
      }
    }, 200)
  }

  function resolveRootDocument() {
    const list = get(_$_documentEditorsList)
    if (!__rootPath) return null
    const normalizedRoot = __rootPath
    const match = list.find((editor) => {
      const doc = editor?.document
      if (!doc) return false
      return (
        doc.cacheDirPath === normalizedRoot ||
        doc.cachePath === normalizedRoot ||
        doc.path === normalizedRoot ||
        doc.parentPath === normalizedRoot ||
        normalizedRoot.startsWith(doc.cacheDirPath || '')
      )
    })
    return match?.document || null
  }

  function isSharedCachePath(pathValue: string) {
    if (!pathValue) return false
    const normalized = nodeApi.path.normalize(pathValue)
    if (cacheRoot) {
      const sharedRoot = nodeApi.path.normalize(nodeApi.path.join(cacheRoot, 'shared'))
      return normalized.startsWith(sharedRoot + nodeApi.path.sep)
    }
    return normalized.includes(`${nodeApi.path.sep}shared${nodeApi.path.sep}`)
  }

  async function scheduleDriveSyncForPath(pathValue: string) {
    if (!pathValue || isDriveSource) return
    const rootDocument = resolveRootDocument()
    if (!rootDocument) return
    const cachePath = rootDocument.cachePath || rootDocument.cacheDirPath || ''
    if (!cachePath) return
    if (!pathValue.startsWith(cachePath)) return
    if (isSharedCachePath(pathValue) || isSharedCachePath(cachePath)) return
    if (!rootDocument.remotePath && !rootDocument.remoteRef) return
    if (syncCommitTimer) return

    syncCommitTimer = setTimeout(async () => {
      syncCommitTimer = null
      try {
        await (window as any).server?.sync?.commit?.({ cachePath })
      } catch {
        // ignore sync failures here; main sync pipeline handles retries
      }
    }, 350)
  }

  function beginInlineInput(state: InlineInputState) {
    inlineInput = state
    selectedPath = state.targetPath || state.parentPath
    expandedPaths.add(state.parentPath)
    expandedPaths = new Set(expandedPaths)
  }

  function startInlineCreate(
    item: FileNode,
    mode: 'create-file' | 'create-folder',
    defaultName: string,
    placeholder: string
  ) {
    const targetDir = getParentDir(item)
    beginInlineInput({
      mode,
      parentPath: targetDir,
      value: defaultName,
      placeholder
    })
  }

  function startInlineRename(item: FileNode) {
    if (item.isMainFile) {
      void showAlert('The main index.html file cannot be renamed.', 'Rename')
      return
    }
    beginInlineInput({
      mode: 'rename',
      parentPath: isDriveSource
        ? driveDirname(item.path) || __rootPath
        : nodeApi.path.dirname(item.path),
      targetPath: item.path,
      value: item.displayName || item.name,
      placeholder: 'Rename'
    })
  }

  function startInlineLocale(item: FileNode) {
    beginInlineInput({
      mode: 'add-locale',
      parentPath: getParentDir(item),
      value: 'en-US',
      placeholder: 'Locale code (e.g. en-US)'
    })
  }

  function startInlineDefineVar(item: FileNode) {
    beginInlineInput({
      mode: 'define-var',
      parentPath: getParentDir(item),
      value: 'KEY=VALUE',
      placeholder: 'KEY=VALUE'
    })
  }

  function withTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-')
  }

  function refreshTree(pathToExpand?: string) {
    if (__rootPath) expandedPaths.add(__rootPath)
    if (pathToExpand) expandedPaths.add(pathToExpand)
    expandedPaths = new Set(expandedPaths)
    refreshTick += 1
  }

  function getTargetFolder() {
    if (!selectedPath) return __rootPath
    const node = knownNodes.get(selectedPath)
    if (node?.isFolder) return selectedPath
    return isDriveSource
      ? driveDirname(selectedPath) || __rootPath
      : nodeApi.path.dirname(selectedPath)
  }

  function pathExists(filePath: string) {
    try {
      return nodeApi.fs.existsSync(filePath)
    } catch {
      return false
    }
  }

  function ensureUniquePath(targetPath: string) {
    if (!pathExists(targetPath)) return targetPath

    const parsed = nodeApi.path.parse(targetPath)
    let index = 2
    let candidate = nodeApi.path.join(parsed.dir, `${parsed.name} ${index}${parsed.ext}`)
    while (pathExists(candidate)) {
      index += 1
      candidate = nodeApi.path.join(parsed.dir, `${parsed.name} ${index}${parsed.ext}`)
    }
    return candidate
  }

  function ensureDocumentExtension(fileName: string) {
    const normalized = fileName.trim()
    if (!normalized) return normalized
    if (!__enforceDocumentExtension) {
      if (__defaultFileExtension && !normalized.includes('.')) {
        return `${normalized}${__defaultFileExtension}`
      }
      return normalized
    }
    if (normalized.toLowerCase().endsWith(Utils.DOCUMENT_FILE_EXTENSION.toLowerCase()))
      return normalized
    return `${normalized}${Utils.DOCUMENT_FILE_EXTENSION}`
  }

  function ensureUniqueCopyPath(sourcePath: string, destinationDir: string) {
    const parsed = nodeApi.path.parse(sourcePath)
    const initial = nodeApi.path.join(destinationDir, `${parsed.name} copy${parsed.ext}`)
    if (!pathExists(initial)) return initial

    let index = 2
    let candidate = nodeApi.path.join(destinationDir, `${parsed.name} copy ${index}${parsed.ext}`)
    while (pathExists(candidate)) {
      index += 1
      candidate = nodeApi.path.join(destinationDir, `${parsed.name} copy ${index}${parsed.ext}`)
    }
    return candidate
  }

  async function openItem(item: FileNode) {
    selectedPath = item.path
    if (item.isFolder) {
      if (!expandedPaths.has(item.path)) {
        expandedPaths.add(item.path)
        expandedPaths = new Set(expandedPaths)
      }
      return
    }

    if (isDriveSource) {
      await EditorCommonUtils.openDriveItem(
        withDriveAccount({
          rootPath: __rootPath,
          path: item.path,
          isFolder: item.isFolder
        })
      )
      return
    }

    await EditorCommonUtils.addNewDocumentEditor(item.path, __rootParentPath)
  }

  async function repositionContextMenu() {
    if (!menuRef || !lastMenuAnchor) return
    const virtualEl = {
      getBoundingClientRect: () => ({
        width: 0,
        height: 0,
        x: lastMenuAnchor!.x,
        y: lastMenuAnchor!.y,
        top: lastMenuAnchor!.y,
        left: lastMenuAnchor!.x,
        right: lastMenuAnchor!.x,
        bottom: lastMenuAnchor!.y
      })
    }
    const { x: finalX, y: finalY } = await computePosition(virtualEl, menuRef, {
      placement: 'bottom-start',
      middleware: [offset(6), flip(), shift({ padding: 12 })]
    })
    menuX = finalX
    menuY = finalY
  }

  async function createFileAt(targetDir: string, fileName: string, initialContent = '') {
    return TreeActions.createFileAt(targetDir, fileName, initialContent, {
      sourceType: __sourceType,
      accountOrg: __accountOrg,
      rootPath: __rootPath,
      rootParentPath: __rootParentPath,
      enforceDocumentExtension: __enforceDocumentExtension,
      defaultFileExtension: __defaultFileExtension,
      onRefresh: (dir) => refreshTree(dir),
      onSelect: (path) => (selectedPath = path),
      onNotify: (msg) => notify(msg),
      onCompleted: (fullPath) => scheduleDriveSyncForPath(fullPath)
    })
  }

  async function createFolderAt(targetDir: string, folderName: string) {
    return TreeActions.createFolderAt(targetDir, folderName, {
      sourceType: __sourceType,
      accountOrg: __accountOrg,
      onRefresh: (dir) => refreshTree(dir),
      onSelect: (path) => (selectedPath = path),
      onNotify: (msg) => notify(msg)
    })
  }

  function rewritePathPrefix(value: string | null | undefined, fromPath: string, toPath: string) {
    if (!value) return value || ''
    if (isDriveSource) {
      const normalizedValue = normalizeDrivePath(value)
      const from = normalizeDrivePath(fromPath)
      const to = normalizeDrivePath(toPath)
      if (normalizedValue === from) return to
      if (normalizedValue.startsWith(`${from}/`))
        return `${to}${normalizedValue.slice(from.length)}`
      return value
    }
    const normalizedValue = nodeApi.path.normalize(value)
    const from = nodeApi.path.normalize(fromPath)
    if (normalizedValue === from) return toPath
    if (normalizedValue.startsWith(`${from}${nodeApi.path.sep}`))
      return `${toPath}${value.slice(from.length)}`
    return value
  }

  function updateEditorsAfterRename(oldPath: string, newPath: string) {
    if (!oldPath || !newPath || oldPath === newPath) return
    const oldMain = isDriveSource
      ? driveJoin(normalizeDrivePath(oldPath), Utils.MAIN_DOCUMENT_FILE)
      : nodeApi.path.join(oldPath, Utils.MAIN_DOCUMENT_FILE)
    const newMain = isDriveSource
      ? driveJoin(normalizeDrivePath(newPath), Utils.MAIN_DOCUMENT_FILE)
      : nodeApi.path.join(newPath, Utils.MAIN_DOCUMENT_FILE)
    const newDocName = isDriveSource ? driveBasename(newPath) : nodeApi.path.basename(newPath)

    _$_documentEditorsList.update((list) => {
      return (Array.isArray(list) ? list : []).map((editor) => {
        const doc = editor?.document
        if (!doc) return editor
        let changed = false

        const nextCachePath = rewritePathPrefix(doc.cachePath, oldPath, newPath)
        if (nextCachePath && nextCachePath !== doc.cachePath) {
          doc.cachePath = nextCachePath
          changed = true
        }

        const nextDirPath = rewritePathPrefix(doc.dirPath, oldPath, newPath)
        if (nextDirPath && nextDirPath !== doc.dirPath) {
          doc.dirPath = nextDirPath
          changed = true
        }

        const nextPath = rewritePathPrefix(doc.path, oldPath, newPath)
        if (nextPath && nextPath !== doc.path) {
          doc.path = nextPath
          changed = true
        }

        const nextParentPath = rewritePathPrefix(doc.parentPath, oldPath, newPath)
        if (nextParentPath && nextParentPath !== doc.parentPath) {
          doc.parentPath = nextParentPath
          changed = true
        }

        const nextVars = rewritePathPrefix((doc as any).vars, oldPath, newPath)
        if (nextVars && nextVars !== (doc as any).vars) {
          ;(doc as any).vars = nextVars
          changed = true
        }

        const nextBg = rewritePathPrefix((doc as any).backgroundDesignFilePath, oldPath, newPath)
        if (nextBg && nextBg !== (doc as any).backgroundDesignFilePath) {
          ;(doc as any).backgroundDesignFilePath = nextBg
          changed = true
        }

        if (
          doc.path === newMain ||
          doc.cachePath === newPath ||
          doc.dirPath === newPath ||
          doc.path === oldMain
        ) {
          if (newDocName && doc.name !== newDocName) {
            doc.name = newDocName
            changed = true
          }
        }

        if (changed) {
          doc.documentMainFileTranslations = doc.getDocumentTranslations(
            doc.getMainFilePath() || doc.cachePath
          )
          doc.vars = doc.getVarsFilePath()
          doc.backgroundDesignFilePath = doc.getBgDesignFilePath()
          return new DocumentEditorModel({ ...editor, document: doc })
        }
        return editor
      })
    })

    _$_recentDocuments.update((list) => {
      const next = Array.isArray(list) ? [...list] : []
      return next.map((entry) => {
        const updatedPath = rewritePathPrefix(entry.path, oldPath, newPath)
        const updatedParent = rewritePathPrefix(entry.parentPath, oldPath, newPath)
        if (updatedPath === entry.path && updatedParent === entry.parentPath) return entry
        return {
          ...entry,
          path: updatedPath || entry.path,
          parentPath: updatedParent || entry.parentPath,
          name: newDocName || entry.name
        }
      })
    })
  }

  async function renameItem(item: FileNode, newName: string) {
    return TreeActions.renameItem(item, newName, {
      sourceType: __sourceType,
      accountOrg: __accountOrg,
      onRefresh: (dir) => refreshTree(dir),
      onSelect: (path) => (selectedPath = path),
      onNotify: (msg) => notify(msg)
    })
  }

  async function applyInlineCommit(payload: {
    mode: InlineInputMode
    value: string
    parentPath: string
    targetPath?: string
    item?: FileNode
  }) {
    const value = payload.value.trim()
    if (!value) {
      inlineInput = null
      return
    }

    const validation = TreeActions.validateFileName(value)
    if (!validation.ok) {
      void showAlert(validation.error || 'Invalid name', 'Validation')
      return
    }

    if (payload.mode === 'rename') {
      if (!payload.targetPath || !payload.item) return
      await renameItem(payload.item, value)
      inlineInput = null
      return
    }

    if (payload.mode === 'create-file') {
      await createFileAt(payload.parentPath, value, __defaultFileContent || '')
      inlineInput = null
      return
    }

    if (payload.mode === 'create-folder') {
      await createFolderAt(payload.parentPath, value)
      inlineInput = null
      return
    }

    if (payload.mode === 'add-locale') {
      const localeCode = value
      const activeEditor = get(_$_documentEditorsList.getActive())
      if (!activeEditor) {
        await showAlert('No active document editor', 'Variables')
        return
      }
      const wysiwygEntry = _$_wysiwygEditorsList.getEntry(activeEditor.id)
      const sourceFilePath =
        wysiwygEntry?.filePath || activeEditor.document.getMainFilePath() || payload.item?.path
      const wysiwygEditor = _$_wysiwygEditorsList.getItem(activeEditor.id)
      const content = wysiwygEditor ? JSON.stringify(wysiwygEditor.getJSON()) : ''

      await _$_documentEditorsList.findOrOpenTranslation(
        activeEditor.id,
        localeCode,
        sourceFilePath,
        content
      )
      refreshTree(payload.parentPath)
      notify(`Locale created/opened: ${localeCode}`)
      inlineInput = null
      return
    }

    if (payload.mode === 'define-var') {
      const [rawKey, ...rest] = value.split('=')
      const key = rawKey?.trim()
      const val = rest.join('=').trim()
      if (!key) {
        await showAlert('Expected KEY=VALUE format', 'Variables')
        return
      }

      const activeEditor = get(_$_documentEditorsList.getActive())
      if (!activeEditor) {
        await showAlert('No active document editor', 'Variables')
        return
      }
      defineVariable(key, { type: 'text', value: val }, true, activeEditor)
      refreshTree(payload.parentPath)
      notify(`Variable "${key}" saved`)
      inlineInput = null
      return
    }
  }

  function isDropIntoSelfOrChild(sourcePath: string, destinationDir: string) {
    if (sourcePath === destinationDir) return true
    if (isDriveSource) {
      const src = normalizeDrivePath(sourcePath)
      const dst = normalizeDrivePath(destinationDir)
      return dst.startsWith(`${src}/`)
    }
    const normalizedSrc = nodeApi.path.resolve(sourcePath)
    const normalizedDst = nodeApi.path.resolve(destinationDir)
    return normalizedDst.startsWith(`${normalizedSrc}${nodeApi.path.sep}`)
  }

  function getDropDestination(item: FileNode) {
    if (isDriveSource) {
      const destination = item.isFolder ? normalizeDrivePath(item.path) : driveDirname(item.path)
      return destination || __rootPath
    }
    return item.isFolder ? item.path : nodeApi.path.dirname(item.path)
  }

  async function importExternalPath(sourcePath: string, destinationDir: string) {
    const result = await TreeActions.importExternalPath(sourcePath, destinationDir, {
      sourceType: __sourceType,
      accountOrg: driveAccountOrg
    })
    if (result) {
      selectedPath = result
      refreshTree(destinationDir)
    }
    return result
  }

  function readDragMeta(
    dt: DataTransfer | null
  ): { path: string; sourceType: TreeSourceType; accountOrg?: string; isFolder: boolean } | null {
    if (!dt) return null
    const raw = dt.getData('application/x-ddoc-tree-item-meta')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object' && parsed.path) {
          return parsed
        }
      } catch {
        // ignore invalid payload
      }
    }
    if (draggingInternalPath) {
      return {
        path: draggingInternalPath,
        sourceType: __sourceType,
        accountOrg: driveAccountOrg,
        isFolder: false
      }
    }
    return null
  }

  async function handleInternalTransfer(
    meta: { path: string; sourceType: TreeSourceType; accountOrg?: string; isFolder: boolean },
    destinationDir: string,
    isCopy: boolean
  ) {
    const result = await TreeActions.handleInternalTransfer(meta, destinationDir, isCopy, {
      sourceType: __sourceType,
      accountOrg: driveAccountOrg
    })
    selectedPath = result || ''
    refreshTree(destinationDir)
    return result
  }

  async function handleDrop(e: CustomEvent<{ event: DragEvent; item: FileNode }>) {
    if (!effectiveCapabilities.canDragDrop) return
    try {
      const { event, item } = e.detail
      const destinationDir = getDropDestination(item)
      const modifierCopy = event.altKey || event.metaKey || event.ctrlKey
      const dt = event.dataTransfer
      if (!dt) return

      const dragMeta = readDragMeta(dt)
      const internalPath =
        dragMeta?.path || dt.getData('application/x-ddoc-tree-item') || draggingInternalPath || ''
      if (internalPath && (dragMeta || isDriveSource || pathExists(internalPath))) {
        if (
          dragMeta?.sourceType === __sourceType &&
          isDropIntoSelfOrChild(internalPath, destinationDir)
        )
          return
        if (
          dragMeta?.sourceType === __sourceType &&
          !modifierCopy &&
          (isDriveSource ? driveDirname(internalPath) : nodeApi.path.dirname(internalPath)) ===
            destinationDir
        ) {
          return
        }

        const meta: DragMeta = dragMeta || {
          path: internalPath,
          sourceType: __sourceType,
          accountOrg: driveAccountOrg,
          isFolder: item.isFolder
        }

        const needsDriveProgress = isDriveSource || meta.sourceType === 'drive'
        if (needsDriveProgress) beginDriveProgress(modifierCopy ? t('Copy') : t('Move'), 1)
        try {
          await handleInternalTransfer(meta, destinationDir, modifierCopy)
        } finally {
          if (needsDriveProgress) finishDriveProgress()
        }

        const sourceParent =
          meta.sourceType === 'drive' ? driveDirname(meta.path) : nodeApi.path.dirname(meta.path)
        const shouldRefreshSource =
          meta.sourceType === __sourceType &&
          (meta.sourceType !== 'drive' || meta.accountOrg === driveAccountOrg)
        if (shouldRefreshSource) refreshTree(sourceParent)
        refreshTree(destinationDir)
        return
      }

      const externalPaths = new Set<string>()
      const externalFiles: File[] = []
      if (dt.files?.length) {
        for (const file of Array.from(dt.files)) {
          const absolutePath = (file as any).path || window.api.getFilePath?.(file)
          if (absolutePath) {
            externalPaths.add(absolutePath)
          } else if (isDriveSource && isBrowserUpload) {
            externalFiles.push(file)
          }
        }
      }
      if (dt.items?.length) {
        for (const itemEntry of Array.from(dt.items)) {
          if (itemEntry.kind !== 'file') continue
          const file = itemEntry.getAsFile?.()
          const absolutePath = file ? (file as any).path || window.api.getFilePath?.(file) : null
          if (absolutePath) {
            externalPaths.add(absolutePath)
          } else if (file && isDriveSource && isBrowserUpload) {
            externalFiles.push(file)
          }
        }
      }

      if (isDriveSource && (externalPaths.size > 0 || externalFiles.length > 0)) {
        beginDriveProgress(t('Upload'), externalPaths.size + externalFiles.length)
      }
      if (externalFiles.length > 0 && isDriveSource && isBrowserUpload) {
        try {
          const upload = await DriveActions.uploadFiles(
            withDriveAccount({
              path: normalizeDrivePath(destinationDir),
              files: externalFiles
            })
          )
          if (!upload?.ok) throw new Error(upload?.message || 'Upload failed')
          for (let i = 0; i < externalFiles.length; i += 1) bumpDriveProgress()
        } catch (error) {
          console.error('Drop upload failed', error)
          await showAlert('Upload failed', 'Drop')
        }
      }
      for (const sourcePath of externalPaths) {
        try {
          await importExternalPath(sourcePath, destinationDir)
        } finally {
          if (isDriveSource && (externalPaths.size > 0 || externalFiles.length > 0))
            bumpDriveProgress()
        }
      }
      if (isDriveSource && (externalPaths.size > 0 || externalFiles.length > 0))
        finishDriveProgress()
      if (externalPaths.size > 0) refreshTree(destinationDir)
    } catch (error) {
      console.error('Drop failed', error)
      await showAlert('Drop operation failed', 'Drop')
    } finally {
      draggingInternalPath = null
      dragOverPath = null
      dragOverBlocked = false
    }
  }

  function handleDragStart(e: CustomEvent<{ event: DragEvent; item: FileNode }>) {
    if (!effectiveCapabilities.canDragDrop) return
    const { event, item } = e.detail
    draggingInternalPath = item.path
    dragOverPath = null
    dragOverBlocked = false
    if (event.dataTransfer) {
      event.dataTransfer.setData('application/x-ddoc-tree-item', item.path)
      event.dataTransfer.setData(
        'application/x-ddoc-tree-item-meta',
        JSON.stringify({
          path: item.path,
          sourceType: __sourceType,
          accountOrg: driveAccountOrg,
          isFolder: item.isFolder
        })
      )
      event.dataTransfer.effectAllowed = 'copyMove'
    }
  }

  function handleDragOver(e: CustomEvent<{ event: DragEvent; item: FileNode }>) {
    if (!effectiveCapabilities.canDragDrop) return
    const { event, item } = e.detail
    const targetEl = event.currentTarget as HTMLElement | null
    const rect = targetEl?.getBoundingClientRect?.()
    if (rect) {
      dragOverPlacement = event.clientY - rect.top > rect.height / 2 ? 'after' : 'before'
    }
    dragOverPath = item.path

    if (draggingInternalPath) {
      const destinationDir = getDropDestination(item)
      dragOverBlocked = isDropIntoSelfOrChild(draggingInternalPath, destinationDir)
      if (event.dataTransfer) event.dataTransfer.dropEffect = dragOverBlocked ? 'none' : 'move'
    } else {
      dragOverBlocked = false
    }
  }

  function handleDragLeave(e: CustomEvent<{ event: DragEvent; item: FileNode }>) {
    const { item } = e.detail
    if (dragOverPath === item.path) {
      dragOverPath = null
      dragOverBlocked = false
    }
  }

  function handleInlineCommit(
    e: CustomEvent<{
      mode: InlineInputMode
      value: string
      parentPath: string
      targetPath?: string
      item?: FileNode
    }>
  ) {
    runSafe(async () => applyInlineCommit(e.detail))
  }

  function handleInlineCancel() {
    inlineInput = null
  }

  function registerNode(e: CustomEvent<FileNode>) {
    const item = e.detail
    if (!item?.path) return
    const next = new Map(knownNodes)
    next.set(item.path, item)
    knownNodes = next
  }

  function getVisiblePaths() {
    if (!treeRootEl) return []
    return Array.from(treeRootEl.querySelectorAll<HTMLElement>('[data-tree-path]'))
      .map((el) => el.getAttribute('data-tree-path') || '')
      .filter(Boolean)
  }

  function selectOnly(pathValue: string) {
    selectedPaths = new Set([pathValue])
    selectedPath = pathValue
    lastFocusedPath = pathValue
  }

  function toggleSelection(pathValue: string) {
    const next = new Set(selectedPaths)
    if (next.has(pathValue)) {
      next.delete(pathValue)
      selectedPaths = next
      const nextFocused = next.size ? Array.from(next).slice(-1)[0] : ''
      selectedPath = nextFocused
      lastFocusedPath = nextFocused || null
      return
    }
    next.add(pathValue)
    selectedPaths = next
    selectedPath = pathValue
    lastFocusedPath = pathValue
  }

  function selectRange(anchorPath: string, focusPath: string) {
    const visible = getVisiblePaths()
    const startIndex = visible.indexOf(anchorPath)
    const endIndex = visible.indexOf(focusPath)
    if (startIndex < 0 || endIndex < 0) {
      selectOnly(focusPath)
      return
    }
    const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
    const slice = visible.slice(from, to + 1)
    selectedPaths = new Set(slice)
    selectedPath = focusPath
    lastFocusedPath = focusPath
  }

  function clearSelection() {
    selectedPaths = new Set()
    selectedPath = ''
    lastFocusedPath = null
  }

  function selectAllVisible() {
    const visible = getVisiblePaths()
    if (!visible.length) return
    selectedPaths = new Set(visible)
    selectedPath = visible[visible.length - 1]
    lastFocusedPath = selectedPath
  }

  function invertSelection() {
    const visible = getVisiblePaths()
    if (!visible.length) return
    const next = new Set<string>()
    for (const pathValue of visible) {
      if (!selectedPaths.has(pathValue)) next.add(pathValue)
    }
    selectedPaths = next
    const last = visible[visible.length - 1] || ''
    selectedPath = next.size ? last : ''
    lastFocusedPath = selectedPath || null
  }

  function getSelectedItems(): FileNode[] {
    const items: FileNode[] = []
    for (const pathValue of selectedPaths) {
      const node = knownNodes.get(pathValue)
      if (node) items.push(node)
    }
    return items
  }

  function getPrimaryItem(): FileNode | null {
    if (!selectedPath) return null
    return knownNodes.get(selectedPath) || null
  }

  const copyEntryRecursive = TreeActions.copyEntryRecursive.bind(TreeActions)

  async function duplicateItem(item: FileNode) {
    await enqueueAction('Duplicate', async () => {
      await TreeActions.duplicateItem(item, {
        sourceType: __sourceType,
        accountOrg: __accountOrg,
        onRefresh: (dir) => refreshTree(dir),
        onSelect: (path) => (selectedPath = path)
      })
    })
  }

  function closeAffectedTabs(deletedPath: string, isFolder: boolean) {
    const editors = _$_documentEditorsList.getList()
    if (!editors.length) return

    const tabsToClose = editors.filter((editor) => {
      const docPath = editor.document?.path
      if (!docPath) return false

      if (isDriveSource) {
        const normDeleted = normalizeDrivePath(deletedPath)
        const normDoc = normalizeDrivePath(docPath)
        if (isFolder) {
          const prefix = normDeleted ? normDeleted + '/' : ''
          return normDoc === normDeleted || normDoc.startsWith(prefix)
        } else {
          return normDoc === normDeleted
        }
      } else {
        // Normalize both paths to ensure comparison works
        const normDeleted = nodeApi.path.normalize(deletedPath)
        const normDoc = nodeApi.path.normalize(docPath)

        if (isFolder) {
          const sep = nodeApi.path.sep || '/'
          const prefix = normDeleted.endsWith(sep) ? normDeleted : normDeleted + sep
          return normDoc === normDeleted || normDoc.startsWith(prefix)
        } else {
          return normDoc === normDeleted
        }
      }
    })

    for (const tab of tabsToClose) {
      _$_documentEditorsList.closeTab(tab.id)
    }
  }

  async function deleteItem(item: FileNode) {
    await enqueueAction('Delete', async () => {
      const ok = await TreeActions.deleteItem(item, {
        sourceType: __sourceType,
        accountOrg: __accountOrg,
        onRefresh: (dir) => refreshTree(dir)
      })
      if (ok) {
        if (selectedPath === item.path) selectedPath = ''
        closeAffectedTabs(item.path, item.isFolder)
      }
    })
  }

  async function deleteSelected() {
    await enqueueAction('Delete selected', async () => {
      const items = getSelectedItems().filter((item) => item.path !== __rootPath)
      if (!items.length) return

      const blocked = items.filter((item) => item.isMainFile)
      const deletable = items.filter((item) => !item.isMainFile)
      let deleteDocumentsConfirmed = false

      const ok = await openConfirmModal({
        title: deletable.length === 1 ? t('Delete item') : t('Delete items'),
        message: deletable.length === 1 ? t('Delete this item?') : t('Delete selected items?'),
        confirmText: t('Delete'),
        destructive: true
      })
      if (!ok) return

      const parents = new Set<string>()
      let failedCount = 0
      if (isDriveSource) beginDriveProgress(t('Delete selected'), deletable.length)
      for (const item of deletable) {
        try {
          if (isDriveSource) {
            const deleted = await DriveActions.deleteItem(
              withDriveAccount({ path: normalizeDrivePath(item.path) })
            )
            if (!deleted?.ok) throw new Error(deleted?.message || 'Delete failed')
          } else {
            const deleted = await window.api.deleteFile(item.path)
            if (!deleted) throw new Error('Delete failed')
          }
          if (item.isDocumentContent) {
            const sidecars = buildSidecarPaths(item)
            for (const sidecar of sidecars) {
              try {
                if (isDriveSource) {
                  await DriveActions.deleteItem(
                    withDriveAccount({ path: normalizeDrivePath(sidecar) })
                  )
                } else {
                  await window.api.deleteFile(sidecar)
                }
              } catch {
                // ignore sidecar cleanup failures
              }
            }
          }
          closeAffectedTabs(item.path, item.isFolder)
          parents.add(isDriveSource ? driveDirname(item.path) : nodeApi.path.dirname(item.path))
        } catch (error) {
          console.error('Bulk delete failed for', item.path, error)
          failedCount += 1
        } finally {
          if (isDriveSource) bumpDriveProgress()
        }
      }
      if (isDriveSource) finishDriveProgress()

      if (failedCount > 0) {
        await showAlert(
          `${failedCount} item${failedCount > 1 ? 's' : ''} failed to delete.`,
          'Delete'
        )
      }
      if (blocked.length > 0) {
        if (!deleteDocumentsConfirmed) {
          deleteDocumentsConfirmed = await openConfirmModal({
            title: t('Delete documents'),
            message: t('Delete {count} document(s)?', { values: { count: blocked.length } }),
            confirmText: t('Delete documents'),
            destructive: true
          })
        }
        if (deleteDocumentsConfirmed) {
          for (const item of blocked) {
            try {
              const docRoot = isDriveSource
                ? driveDirname(item.path)
                : nodeApi.path.dirname(item.path)
              if (isDriveSource) {
                await DriveActions.deleteItem(
                  withDriveAccount({ path: normalizeDrivePath(docRoot) })
                )
              } else {
                await window.api.deleteFile(docRoot)
              }
              closeAffectedTabs(docRoot, true)
              parents.add(isDriveSource ? driveDirname(docRoot) : nodeApi.path.dirname(docRoot))
            } catch (error) {
              console.error('Document delete failed for', item.path, error)
              failedCount += 1
            }
          }
        }
      }

      clearSelection()
      for (const parent of parents) refreshTree(parent)
    })
  }

  function copyItem(item: FileNode) {
    const items =
      selectedPaths.size > 1 && selectedPaths.has(item.path) ? getSelectedItems() : [item]
    clipboardItem = { items, mode: 'copy', sourceType: __sourceType, accountOrg: driveAccountOrg }
    notify(`Copied: ${items.length} item${items.length > 1 ? 's' : ''}`)
  }

  function cutItem(item: FileNode) {
    const items =
      selectedPaths.size > 1 && selectedPaths.has(item.path) ? getSelectedItems() : [item]
    clipboardItem = { items, mode: 'cut', sourceType: __sourceType, accountOrg: driveAccountOrg }
    notify(`Cut: ${items.length} item${items.length > 1 ? 's' : ''}`)
  }

  function copySelection() {
    const items = getSelectedItems()
    if (!items.length) return
    clipboardItem = { items, mode: 'copy', sourceType: __sourceType, accountOrg: driveAccountOrg }
    notify(`Copied: ${items.length} item${items.length > 1 ? 's' : ''}`)
  }

  function cutSelection() {
    const items = getSelectedItems()
    if (!items.length) return
    clipboardItem = { items, mode: 'cut', sourceType: __sourceType, accountOrg: driveAccountOrg }
    notify(`Cut: ${items.length} item${items.length > 1 ? 's' : ''}`)
  }

  async function pasteItem(target: FileNode) {
    await enqueueAction('Paste', async () => {
      if (!clipboardItem) return

      const destinationDir = getParentDir(target)
      const sourceType = clipboardItem.sourceType
      const sourceAccountOrg = clipboardItem.accountOrg
      const items = clipboardItem.items || []
      if (!items.length) return
      const involvesDrive = isDriveSource || sourceType === 'drive'
      if (involvesDrive)
        beginDriveProgress(clipboardItem.mode === 'copy' ? t('Copy') : t('Move'), items.length)

      try {
        const sourceParents = new Set<string>()
        for (const item of items) {
          const sourcePath = item.path
          const destinationPath = isDriveSource
            ? driveJoin(destinationDir, driveBasename(sourcePath))
            : ensureUniquePath(nodeApi.path.join(destinationDir, nodeApi.path.basename(sourcePath)))
          if (destinationPath === sourcePath) continue
          await handleInternalTransfer(
            {
              path: sourcePath,
              sourceType,
              accountOrg: sourceAccountOrg,
              isFolder: item.isFolder
            },
            destinationDir,
            clipboardItem.mode === 'copy'
          )
          const parent =
            sourceType === 'drive' ? driveDirname(sourcePath) : nodeApi.path.dirname(sourcePath)
          sourceParents.add(parent)
          selectedPath = destinationPath
          if (involvesDrive) bumpDriveProgress()
        }

        if (clipboardItem.mode === 'cut') clipboardItem = null
        const shouldRefreshSource =
          sourceType === __sourceType &&
          (sourceType !== 'drive' || sourceAccountOrg === driveAccountOrg)
        if (shouldRefreshSource) {
          for (const parent of sourceParents) refreshTree(parent)
        }
        refreshTree(destinationDir)
      } catch (error) {
        console.error('Paste failed', error)
        await showAlert('Paste failed', 'Paste')
      } finally {
        if (involvesDrive) finishDriveProgress()
      }
    })
  }

  async function openInTerminal(item: FileNode) {
    const cwd = getParentDir(item)
    if (!window.terminal?.open) {
      await showAlert('Terminal API unavailable', 'Terminal')
      return
    }
    await window.terminal.open(cwd)
  }

  async function revealInOS(item: FileNode) {
    if (isDriveSource) {
      const downloaded = await DriveActions.downloadItem(
        withDriveAccount({
          path: normalizeDrivePath(item.path)
        })
      )
      if (!downloaded?.ok || !downloaded?.savePath) {
        await showAlert(downloaded?.message || 'Download failed', 'Download')
        return
      }
      const revealPath = downloaded.savePath
        ? nodeApi.path.dirname(downloaded.savePath)
        : downloaded.savePath
      await window.api.openFile(revealPath)
      return
    }
    const revealPath = item.isFolder ? item.path : nodeApi.path.dirname(item.path)
    await window.api.openFile(revealPath)
  }

  async function findInFiles(item: FileNode) {
    openPrimarySearchPane({
      mode: 'text',
      query: '',
      scopePath: item.isFolder ? item.path : item.path,
      scopeType: item.isFolder ? 'folder' : 'file',
      sourcePath: item.path,
      autoFocus: true
    })
  }

  function getHistoryRoot() {
    return nodeApi.path.join(__rootPath, '.ddoc-history')
  }

  function getHistoryPrefix(item: FileNode) {
    const relative = nodeApi.path.relative(__rootPath, item.path)
    const parsed = nodeApi.path.parse(relative)
    return nodeApi.path.join(getHistoryRoot(), parsed.dir, parsed.name)
  }

  async function saveVersion(item: FileNode) {
    const targetPath = getHistoryPrefix(item)
    const timestamp = withTimestamp()
    const versionPath = `${targetPath}__${timestamp}${nodeApi.path.extname(item.path)}`
    await nodeApi.fsPromises.mkdir(nodeApi.path.dirname(versionPath), { recursive: true })
    await copyEntryRecursive(item.path, versionPath)
    notify(`Version saved: ${nodeApi.path.basename(versionPath)}`)
  }

  // Asynchronous because the directory listing now crosses IPC. Both callers
  // -- compareVersions and restoreVersion -- were already async, so the change
  // stops there rather than reaching the component's markup.
  async function getVersionFiles(item: FileNode): Promise<string[]> {
    const historyPrefix = getHistoryPrefix(item)
    const dir = nodeApi.path.dirname(historyPrefix)
    if (!pathExists(dir)) return []
    const prefix = nodeApi.path.basename(historyPrefix) + '__'
    const ext = nodeApi.path.extname(item.path)
    const names: string[] = await nodeApi.fsPromises.readdir(dir)
    return names
      .filter((name: string) => name.startsWith(prefix) && name.endsWith(ext))
      .sort()
      .map((name: string) => nodeApi.path.join(dir, name))
  }

  function countLineDiff(previousText: string, currentText: string) {
    const previous = new Set(previousText.split('\n'))
    const current = new Set(currentText.split('\n'))
    let added = 0
    let removed = 0

    for (const line of current) if (!previous.has(line)) added += 1
    for (const line of previous) if (!current.has(line)) removed += 1

    return { added, removed }
  }

  async function compareVersions(item: FileNode) {
    if (item.isFolder) {
      await showAlert('Version compare is only available for files.', 'Version compare')
      return
    }

    const versions = await getVersionFiles(item)
    if (versions.length === 0) {
      await showAlert('No saved versions yet.', 'Version compare')
      return
    }

    const latest = versions[versions.length - 1]
    const currentText = await nodeApi.fsPromises.readFile(item.path, 'utf-8')
    const latestText = await nodeApi.fsPromises.readFile(latest, 'utf-8')
    const diff = countLineDiff(latestText, currentText)
    await showAlert(
      t(
        'Current vs latest snapshot:\n\nLatest snapshot: {file}\nAdded unique lines: {added}\nRemoved unique lines: {removed}',
        {
          values: { file: nodeApi.path.basename(latest), added: diff.added, removed: diff.removed }
        }
      ),
      t('Version compare')
    )
  }

  async function restoreVersion(item: FileNode) {
    const versions = await getVersionFiles(item)
    if (versions.length === 0) {
      await showAlert(t('No versions available to restore.'), t('Restore'))
      return
    }

    const latest = versions[versions.length - 1]
    const ok = await openConfirmModal({
      title: t('Restore snapshot'),
      message: t('Restore latest snapshot?\n{file}', {
        values: { file: nodeApi.path.basename(latest) }
      }),
      confirmText: t('Restore')
    })
    if (!ok) return

    await copyEntryRecursive(latest, item.path)
    refreshTree(nodeApi.path.dirname(item.path))
    notify(t('Version restored'))
  }

  async function convertToSddoc(item: FileNode) {
    if (item.isFolder) return
    if (item.path.toLowerCase().endsWith(Utils.DYNADOC_EXTENSIONS.secured)) {
      await showAlert(t('This file is already .sddoc'), t('Security'))
      return
    }

    const parsed = nodeApi.path.parse(item.path)
    const securePath = ensureUniquePath(nodeApi.path.join(parsed.dir, `${parsed.name}.sddoc`))
    await copyEntryRecursive(item.path, securePath)
    refreshTree(parsed.dir)
    selectedPath = securePath
    notify(
      t('Created secure variant: {name}', { values: { name: nodeApi.path.basename(securePath) } })
    )
  }

  async function openSecuritySettings(item: FileNode) {
    const info = [
      t('File: {name}', { values: { name: item.name } }),
      t('Security actions:'),
      t('- Save version snapshots before sharing'),
      t('- Keep secure (.sddoc) copies for sensitive drafts'),
      t('- Restrict locale export for confidential documents')
    ].join('\n')
    await showAlert(info, t('Security settings'))
  }

  async function addLocale(item: FileNode) {
    startInlineLocale(item)
  }

  async function syncTM(item: FileNode) {
    const dir = getParentDir(item)
    const tmPath = nodeApi.path.join(dir, 'locales', 'tm.sync.json')
    await nodeApi.fsPromises.mkdir(nodeApi.path.dirname(tmPath), { recursive: true })
    await nodeApi.fsPromises.writeFile(
      tmPath,
      JSON.stringify(
        {
          updatedAt: new Date().toISOString(),
          source: item.path,
          note: 'Placeholder translation-memory sync manifest.'
        },
        null,
        2
      ),
      'utf-8'
    )
    refreshTree(dir)
    notify(t('Translation manifest updated'))
  }

  async function exportLocales(item: FileNode) {
    const dir = getParentDir(item)
    const localeDir = nodeApi.path.join(dir, 'locales')
    if (!pathExists(localeDir)) {
      await showAlert('No locales folder found.', 'Translation')
      return
    }

    const files = (await nodeApi.fsPromises.readdir(localeDir)).filter((name: string) =>
      name.endsWith('.json')
    )
    const bundle: Record<string, any> = {}
    for (const fileName of files) {
      try {
        const locale = fileName.replace(/\.json$/i, '')
        const raw = await nodeApi.fsPromises.readFile(
          nodeApi.path.join(localeDir, fileName),
          'utf-8'
        )
        bundle[locale] = JSON.parse(raw)
      } catch {
        // skip invalid files
      }
    }

    const exportPath = nodeApi.path.join(localeDir, `locales.export.${withTimestamp()}.json`)
    await nodeApi.fsPromises.writeFile(exportPath, JSON.stringify(bundle, null, 2), 'utf-8')
    refreshTree(dir)
    notify(`Locales exported: ${nodeApi.path.basename(exportPath)}`)
  }

  async function defineVar(item: FileNode) {
    startInlineDefineVar(item)
  }

  async function findVarUsages(item: FileNode) {
    openPrimarySearchPane({
      mode: 'variable',
      query: '',
      scopePath: getParentDir(item),
      scopeType: 'folder',
      sourcePath: item.path,
      autoFocus: true
    })
  }

  async function copyAsInclude(item: FileNode) {
    const relativePath = nodeApi.path.relative(__rootPath, item.path)
    const includeRef = `@include(${relativePath})`
    await EditorCommonUtils.copyToClipboard(includeRef)
    notify(`Include reference copied: ${includeRef}`)
  }

  function canPasteInto(item: FileNode) {
    if (!clipboardItem) return false
    if (isDriveSource) return true
    return getParentDir(item) !== ''
  }

  function handleToggle(e: CustomEvent<string>) {
    const path = e.detail
    if (expandedPaths.has(path)) {
      expandedPaths.delete(path)
    } else {
      expandedPaths.add(path)
    }
    // Trigger Svelte reactivity for the Set
    expandedPaths = new Set(expandedPaths)
  }

  function handleQuickRefresh() {
    refreshTree()
  }

  function handleQuickAddFile() {
    const targetDir = getTargetFolder()
    const fileName = __defaultNewFileName || 'New Document'
    let initialContent = ''
    if (fileName.toLowerCase().endsWith('.md')) {
      initialContent = `# ${fileName.replace(/\.[^/.]+$/, '')}

## Overview

Write your content here.

## Details

- Point 1
- Point 2

## Conclusion

Summary of the document.
`
    }
    beginInlineInput({
      mode: 'create-file',
      parentPath: targetDir,
      value: fileName,
      placeholder: 'File name'
    })
    // Note: initialContent is not used in beginInlineInput, but could be passed to createFileAt
  }

  function handleQuickAddFolder() {
    const targetDir = getTargetFolder()
    beginInlineInput({
      mode: 'create-folder',
      parentPath: targetDir,
      value: 'New Folder',
      placeholder: 'Folder name'
    })
  }

  function handleQuickCollapseAll() {
    expandedPaths = new Set([__rootPath])
  }

  async function handleSelect(e: CustomEvent<{ item: FileNode; event: MouseEvent }>) {
    const { item, event } = e.detail
    const pathValue = item.path
    const isMeta = event?.metaKey || event?.ctrlKey
    const isAlt = event?.altKey
    const isShift = event?.shiftKey

    if (isShift && lastFocusedPath) {
      selectRange(lastFocusedPath, pathValue)
    } else if (isMeta || isAlt) {
      toggleSelection(pathValue)
    } else if (__selectionMode === 'multi' && !item.isFolder) {
      // In multi-select checkbox mode, a plain click on a file toggles it
      toggleSelection(pathValue)
    } else {
      selectOnly(pathValue)
    }

    if (typeof __onSelect === 'function') {
      __onSelect(item)
    }
  }

  async function handleOpen(e: CustomEvent<{ item: FileNode; event: MouseEvent }>) {
    const { item } = e.detail
    await openItem(item)
  }

  async function openSelected() {
    const items = getSelectedItems()
    if (!items.length) return
    for (const item of items) {
      await openItem(item)
    }
  }

  async function copySelectedPaths() {
    const items = getSelectedItems()
    if (!items.length) return
    const joined = items.map((entry) => entry.path).join('\n')
    await EditorCommonUtils.copyToClipboard(joined)
    notify(t('Path copied'))
  }

  async function downloadSelected() {
    const items = getSelectedItems()
    if (!items.length) return
    queueDriveDownloads(items, { archivePreferred: items.length > 1 })
  }

  function queueDriveDownloads(
    items: FileNode[],
    options?: { archivePreferred?: boolean; archiveOnly?: boolean }
  ) {
    if (!items.length) return
    const archivePreferred = Boolean(options?.archivePreferred)
    const archiveOnly = Boolean(options?.archiveOnly)
    const payloads: any[] = []
    const labels: string[] = []

    if (archivePreferred || archiveOnly) {
      const bundleName = `dynadoc-selection-${Date.now()}.zip`
      payloads.push(
        withDriveAccount({
          paths: items.map((entry) => normalizeDrivePath(entry.path)),
          archive: true,
          name: bundleName
        })
      )
      labels.push(`${t('Download')} (${items.length})`)
      if (archiveOnly) {
        enqueueDownloadJobs(payloads, labels)
        openDownloadManager()
        return
      }
    }

    if (!archivePreferred || items.length === 1) {
      for (const item of items) {
        payloads.push(
          withDriveAccount({
            path: normalizeDrivePath(item.path),
            archive: item.isFolder,
            name: item.name
          })
        )
        labels.push(item.name || t('Download'))
      }
    }

    if (payloads.length) {
      enqueueDownloadJobs(payloads, labels)
      openDownloadManager()
    }
  }

  function withAction(label: string, fn: () => Promise<void>) {
    return () => runSafe(fn, label)
  }

  function handleContextMenu(e: CustomEvent<{ event: MouseEvent; item: FileNode }>) {
    const { event, item } = e.detail
    const isFolder = item.isFolder
    const isSecured = item.path.toLowerCase().endsWith(Utils.DYNADOC_EXTENSIONS.secured)
    const isMainFile = Boolean(item.isMainFile)

    if (!selectedPaths.has(item.path)) {
      selectOnly(item.path)
    }

    const createActions: ContextMenuItem[] = []
    const selectionActions: ContextMenuItem[] = []
    const selectionCount = selectedPaths.size
    const selectionItems = getSelectedItems()

    if (selectionCount > 1) {
      selectionActions.push(
        {
          icon: 'ph-bold ph-folder-open',
          label: t('Open selected'),
          group: 0,
          action: withAction(t('Open selected'), async () => openSelected())
        },
        {
          icon: 'ph-bold ph-copy',
          label: t('Copy selected'),
          group: 0,
          action: withAction(t('Copy selected'), async () => copySelection())
        },
        {
          icon: 'ph-bold ph-scissors',
          label: t('Cut selected'),
          group: 0,
          action: withAction(t('Cut selected'), async () => cutSelection())
        },
        {
          icon: 'ph-bold ph-trash',
          label: t('Delete selected'),
          group: 0,
          action: withAction(t('Delete selected'), async () => deleteSelected())
        },
        {
          icon: 'ph-bold ph-clipboard-text',
          label: t('Copy paths'),
          group: 0,
          action: withAction(t('Copy paths'), async () => copySelectedPaths())
        },
        {
          icon: 'ph-bold ph-x',
          label: t('Clear selection'),
          group: 0,
          action: withAction(t('Clear selection'), async () => clearSelection())
        }
      )
      if (isDriveSource) {
        selectionActions.push({
          icon: 'ph-bold ph-download-simple',
          label: t('Download selected'),
          group: 0,
          action: withAction(t('Download selected'), async () =>
            queueDriveDownloads(selectionItems, { archivePreferred: false })
          )
        })
        selectionActions.push({
          icon: 'ph-bold ph-file-zip',
          label: t('Download selected as ZIP'),
          group: 0,
          action: withAction(t('Download selected as ZIP'), async () =>
            queueDriveDownloads(selectionItems, { archiveOnly: true })
          )
        })
      }
    }

    const customMenuItems = __contextMenuItems?.({
      item,
      selection: selectionItems,
      selectionCount,
      isDriveSource,
      isFolder,
      isMainFile
    })

    selectionActions.push(
      {
        icon: 'ph-bold ph-selection-all',
        label: t('Select all'),
        group: 0,
        action: withAction(t('Select all'), async () => selectAllVisible())
      },
      {
        icon: 'ph-bold ph-queue',
        label: t('Invert selection'),
        group: 0,
        action: withAction(t('Invert selection'), async () => invertSelection())
      }
    )
    if (effectiveCapabilities.canCreate && selectionCount <= 1) {
      if (isDriveSource) {
        createActions.push(
          {
            icon: 'ph-bold ph-folder-plus',
            label: t('New Folder...'),
            group: 1,
            action: withAction('Create folder', async () =>
              startInlineCreate(item, 'create-folder', 'new-folder', 'Folder name')
            )
          },
          {
            icon: 'ph-bold ph-file-plus',
            label: t('New File...'),
            group: 1,
            action: withAction('Create file', async () =>
              startInlineCreate(
                item,
                'create-file',
                'untitled',
                `File name (${Utils.DOCUMENT_FILE_EXTENSION})`
              )
            )
          },
          {
            icon: 'ph-bold ph-upload-simple',
            label: t('Upload Files...'),
            group: 1,

            action: withAction('Upload files', async () => {
              if (isDriveSource && isBrowserUpload) {
                const pickedFiles = await pickBrowserFiles([])
                if (!pickedFiles.length) return

                beginDriveProgress(t('Upload'), pickedFiles.length)

                try {
                  // Pass the raw files array and path.
                  // uploadFiles will detect these files and trigger uploadDriveMultipart.
                  const result = await DriveActions.uploadFiles(
                    withDriveAccount({
                      path: getParentDir(item),
                      files: pickedFiles
                    })
                  )

                  if (!result?.ok) {
                    await showAlert(result?.message || 'Upload failed', 'Upload')
                  }
                } finally {
                  finishDriveProgress()
                }

                refreshTree(getParentDir(item))
                notify(`Uploaded ${pickedFiles.length} file(s)`)
                return
              }
            })

            // action: withAction('Upload files', async () => {
            //   if (isDriveSource && isBrowserUpload) {
            //     const pickedFiles = await pickBrowserFiles([])
            //     if (!pickedFiles.length) return

            //     beginDriveProgress(t('Upload'), pickedFiles.length)

            //     try {
            //       // Loop through files to handle them individually
            //       // or update DriveActions.uploadFiles to handle an array of Blobs
            //       for (const file of pickedFiles) {
            //         const formData = new FormData()

            //         // These keys MUST match the Go backend:
            //         // c.FormFile("file") and c.FormValue("path")
            //         formData.append('file', file)
            //         formData.append('path', getParentDir(item))

            //         const result = await DriveActions.uploadFiles(withDriveAccount(formData))

            //         /* const uploaded = await DriveActions.uploadFiles(
            //           withDriveAccount({
            //             path: getParentDir(item),
            //             files: pickedFiles
            //           })
            //         ) */

            //         if (!result?.ok) {
            //           await showAlert(result?.message || `Failed to upload ${file.name}`, 'Upload')
            //           break
            //         }
            //       }
            //     } finally {
            //       finishDriveProgress()
            //     }

            //     refreshTree(getParentDir(item))
            //     notify(`Uploaded ${pickedFiles.length} file(s)`)
            //     return
            //   }
            //   // ... rest of your Electron localPaths logic
            // })

            // action: withAction('Upload files', async () => {
            //   if (isDriveSource && isBrowserUpload) {
            //     const pickedFiles = await pickBrowserFiles([])
            //     if (!pickedFiles.length) return
            //     beginDriveProgress(t('Upload'), pickedFiles.length)
            //     try {
            //       const uploaded = await DriveActions.uploadFiles(
            //         withDriveAccount({
            //           path: getParentDir(item),
            //           files: pickedFiles
            //         })
            //       )
            //       if (!uploaded?.ok) {
            //         await showAlert(uploaded?.message || 'Upload failed', 'Upload')
            //         return
            //       }
            //     } finally {
            //       finishDriveProgress()
            //     }
            //     refreshTree(getParentDir(item))
            //     notify(`Uploaded ${pickedFiles.length} file(s)`)
            //     return
            //   }

            //   /*  const files = await (window as any).api?.openDialogFiles?.([])
            //   const localPaths = Array.isArray(files) ? files.filter(Boolean) : []
            //   if (!localPaths.length) return
            //   beginDriveProgress(t('Upload'), localPaths.length)
            //   try {
            //     const uploaded = await DriveActions.uploadFiles(
            //       withDriveAccount({
            //         path: getParentDir(item),
            //         localPaths
            //       })
            //     )
            //     if (!uploaded?.ok) {
            //       await showAlert(uploaded?.message || 'Upload failed', 'Upload')
            //       return
            //     }
            //   } finally {
            //     finishDriveProgress()
            //   }
            //   refreshTree(getParentDir(item))
            //   notify(`Uploaded ${localPaths.length} file(s)`)
            //  */
            // })
          }
        )
      } else {
        createActions.push(
          {
            icon: 'ph-bold ph-file-plus',
            label: t('New File...'),
            group: 1,
            action: withAction('Create file', async () =>
              startInlineCreate(
                item,
                'create-file',
                'untitled',
                `File name (${Utils.DOCUMENT_FILE_EXTENSION})`
              )
            )
          },
          {
            icon: 'ph-bold ph-folder-plus',
            label: t('New Folder...'),
            group: 1,
            action: withAction('Create folder', async () =>
              startInlineCreate(item, 'create-folder', 'new-folder', 'Folder name')
            )
          },
          {
            icon: 'ph-bold ph-wand-sparkle',
            label: t('Quick Templates'),
            group: 1,
            children: [
              {
                label: t('New xddoc'),
                icon: 'ph-bold ph-file-doc',
                action: withAction('Create xddoc', async () =>
                  startInlineCreate(item, 'create-file', 'untitled', 'New document name')
                )
              },
              {
                label: t('New secure sddoc'),
                icon: 'ph-bold ph-shield-check',
                action: withAction('Create sddoc', async () =>
                  startInlineCreate(
                    item,
                    'create-file',
                    'secure-document',
                    'New secure document name'
                  )
                )
              },
              {
                label: t('Timestamped note'),
                icon: 'ph-bold ph-note-pencil',
                action: withAction('Create timestamp note', async () =>
                  startInlineCreate(
                    item,
                    'create-file',
                    `note-${withTimestamp()}`,
                    'Note file name'
                  )
                )
              }
            ]
          }
        )
      }
    }

    const standardActions: ContextMenuItem[] = []
    if (selectionCount <= 1) {
      standardActions.push({
        icon: isFolder ? 'ph-bold ph-folder-open' : 'ph-bold ph-file-text',
        label: t('Open'),
        shortcut: 'Enter',
        group: 2,
        action: withAction('Open', async () => openItem(item))
      })
    }

    if (!isDriveSource) {
      standardActions.push({
        icon: 'ph-bold ph-magnifying-glass',
        label: isFolder ? 'Find in Folder' : 'Find in Related Files',
        group: 4,
        action: withAction('Find in files', async () => findInFiles(item))
      })
    }

    if (effectiveCapabilities.canRename && !isMainFile) {
      standardActions.push({
        icon: 'ph-bold ph-cursor-text',
        label: t('Rename'),
        shortcut: 'F2',
        group: 2,
        action: withAction('Rename', async () => startInlineRename(item))
      })
    }

    if (effectiveCapabilities.canCopyCutPaste) {
      standardActions.push(
        {
          icon: 'ph-bold ph-copy',
          label: t('Copy'),
          shortcut: 'Ctrl+C',
          group: 3,
          action: async () => copyItem(item)
        },
        {
          icon: 'ph-bold ph-scissors',
          label: t('Cut'),
          shortcut: 'Ctrl+X',
          group: 3,
          action: async () => cutItem(item)
        },
        {
          icon: 'ph-bold ph-clipboard',
          label: clipboardItem
            ? clipboardItem.items.length > 1
              ? `${t('Paste')} (${clipboardItem.items.length})`
              : `${t('Paste')} ${clipboardItem.items[0]?.name || ''}`
            : t('Paste'),
          shortcut: 'Ctrl+V',
          group: 3,
          disabled: !canPasteInto(item),
          action: withAction('Paste', async () => pasteItem(item))
        }
      )
    }

    if (effectiveCapabilities.canDuplicate) {
      standardActions.push({
        icon: 'ph-bold ph-files',
        label: t('Duplicate'),
        group: 3,
        action: withAction('Duplicate', async () => duplicateItem(item))
      })
    }

    if (effectiveCapabilities.canDelete && !isMainFile) {
      standardActions.push({
        icon: 'ph-bold ph-trash text-red-400',
        label: t('Delete'),
        shortcut: 'Del',
        group: 3,
        action: withAction('Delete', async () => deleteItem(item))
      })
    }

    standardActions.push({
      icon: 'ph-bold ph-arrow-clockwise',
      label: lastActionLabel ? `Repeat: ${lastActionLabel}` : 'Repeat Last Action',
      group: 3,
      disabled: !lastAction,
      action: withAction('Repeat last action', async () => {
        if (lastAction) await lastAction()
      })
    })

    if (effectiveCapabilities.canOpenInTerminal) {
      standardActions.push({
        icon: 'ph-bold ph-terminal',
        label: t('Open in Terminal'),
        group: 4,
        action: withAction('Open terminal', async () => openInTerminal(item))
      })
    }

    if (effectiveCapabilities.canRevealInOS) {
      standardActions.push({
        icon: 'ph-bold ph-folder-notch-open',
        label: t('Reveal in Explorer'),
        group: 4,
        action: withAction('Reveal in explorer', async () => revealInOS(item))
      })
    }

    standardActions.push({
      icon: 'ph-bold ph-clipboard-text',
      label: t('Copy Full Path'),
      group: 4,
      action: withAction('Copy full path', async () => {
        await copyTextToClipboard(item.path)
        notify(t('Path copied'))
      })
    })

    standardActions.push({
      icon: 'ph-bold ph-clipboard-text',
      label: t('Copy Relative Path'),
      group: 4,
      action: withAction('Copy relative path', async () => {
        await copyTextToClipboard(getRelativePath(item))
        notify(t('Path copied'))
      })
    })

    if (isDriveSource) {
      standardActions.push({
        icon: 'ph-bold ph-link-simple',
        label: t('Copy Drive Path'),
        group: 4,
        action: withAction('Copy drive path', async () => {
          await EditorCommonUtils.copyToClipboard(item.path)
          notify(t('Drive path copied'))
        })
      })

      standardActions.push({
        icon: 'ph-bold ph-download-simple',
        label: t('Download'),
        group: 4,
        action: withAction(t('Download'), async () => {
          queueDriveDownloads([item], { archivePreferred: false })
        })
      })

      standardActions.push({
        icon: 'ph-bold ph-file-zip',
        label: t('Download as ZIP'),
        group: 4,
        action: withAction(t('Download as ZIP'), async () =>
          queueDriveDownloads([item], { archiveOnly: true })
        )
      })

      standardActions.push({
        icon: 'ph-bold ph-queue',
        label: t('Download manager'),
        group: 4,
        action: withAction(t('Download manager'), async () => openDownloadManager())
      })

      const shareOptions = {
        isDriveSource,
        accountOrg: driveAccountOrg,
        resolveRootDocument: () => resolveRootDocument(),
        onNotify: (msg) => notify(msg),
        onSyncStart: () => {
          diskShareSyncLabel = t('Syncing to drive...')
          diskShareSyncing = true
        },
        onSyncEnd: () => {
          diskShareSyncing = false
        }
      }

      standardActions.push({
        icon: 'ph-bold ph-share-network',
        label: t('Share (Copy link)'),
        group: 4,
        action: withAction(t('Share'), async () => {
          await ShareActions.copyShareLink(item, shareOptions)
        })
      })

      standardActions.push({
        icon: 'ph-bold ph-sliders',
        label: t('Share settings...'),
        group: 4,
        action: withAction(t('Share settings'), async () => {
          await ShareActions.share(item, shareOptions)
        })
      })

      standardActions.push({
        icon: 'ph-bold ph-link-simple',
        label: t('Copy Share Link'),
        group: 4,
        action: withAction(t('Copy share link'), async () =>
          ShareActions.copyShareLink(item, shareOptions)
        )
      })

      standardActions.push({
        icon: 'ph-bold ph-arrow-square-out',
        label: t('Open Share Link'),
        group: 4,
        action: withAction(t('Open share link'), async () =>
          ShareActions.openShareLink(item, shareOptions)
        )
      })

      standardActions.push({
        icon: 'ph-bold ph-trash',
        label: t('Revoke Share'),
        group: 4,
        action: withAction(t('Revoke share'), async () =>
          ShareActions.revokeShare(item, shareOptions)
        )
      })
    }

    if (true) {
      standardActions.push({
        icon: 'ph-bold ph-shuffle',
        label: t('Manage Shares'),
        group: 4,
        action: withAction(t('Manage shares'), async () =>
          ShareActions.manageShares({ accountOrg: driveAccountOrg })
        )
      })
    }

    if (effectiveCapabilities.canVersioning) {
      standardActions.push({
        icon: 'ph-bold ph-clock-counter-clockwise',
        label: t('Version History'),
        group: 4,
        children: [
          {
            label: t('Save New Version'),
            icon: 'ph-bold ph-plus',
            action: withAction(t('Save version'), async () => saveVersion(item))
          },
          {
            label: t('Compare with Snapshot'),
            icon: 'ph-bold ph-scales',
            action: withAction(t('Compare version'), async () => compareVersions(item))
          },
          {
            label: t('Restore Latest Snapshot'),
            icon: 'ph-bold ph-rewind',
            action: withAction(t('Restore version'), async () => restoreVersion(item))
          }
        ]
      })
    }

    const dynadocActions: ContextMenuItem[] = []
    if (effectiveCapabilities.canSecurity) {
      dynadocActions.push({
        icon: 'ph-bold ph-shield-check',
        label: isSecured ? t('Manage Encryption') : t(`Upgrade to `),
        group: 5,
        action: withAction(t('Security action'), async () =>
          isSecured ? openSecuritySettings(item) : convertToSddoc(item)
        )
      })
    }

    if (effectiveCapabilities.canTranslation) {
      dynadocActions.push({
        icon: 'ph-bold ph-translate',
        label: t('Translation Hub'),
        group: 5,
        children: [
          {
            label: t('Add Locale...'),
            icon: 'ph-bold ph-plus',
            action: withAction(t('Add locale'), async () => addLocale(item))
          },
          {
            label: t('Sync Translation Memory'),
            icon: 'ph-bold ph-arrows-clockwise',
            action: withAction(t('Sync TM'), async () => syncTM(item))
          },
          {
            label: t('Export Locales (.json)'),
            icon: 'ph-bold ph-export',
            action: withAction(t('Export locales'), async () => exportLocales(item))
          }
        ]
      })
    }

    if (effectiveCapabilities.canVariables) {
      dynadocActions.push({
        icon: 'ph-bold ph-stack',
        label: t('Variables & Includes'),
        group: 5,
        children: [
          {
            label: t('Define Variable'),
            icon: 'ph-bold ph-brackets-curly',
            action: withAction(t('Define variable'), async () => defineVar(item))
          },
          {
            label: t('Find Variable Usages'),
            icon: 'ph-bold ph-magnifying-glass',
            action: withAction(t('Find variable usages'), async () => findVarUsages(item))
          },
          {
            label: t('Copy as Include-Link'),
            icon: 'ph-bold ph-link-simple',
            action: withAction(t('Copy include link'), async () => copyAsInclude(item))
          }
        ]
      })
    }

    menuItems = [
      ...selectionActions,
      ...(Array.isArray(customMenuItems) ? customMenuItems : []),
      ...createActions,
      ...standardActions,
      ...dynadocActions
    ]
    if (__contextMenuMode === 'latex') {
      const blocked = new Set([
        t('Share...'),
        t('Copy Share Link'),
        t('Open Share Link'),
        t('Revoke Share'),
        t('Manage Shares'),
        t('Version History'),
        t(`Upgrade to `),
        t('Manage Encryption'),
        t('Translation Hub'),
        t('Variables & Includes'),
        t('Add Locale...'),
        t('Sync Translation Memory'),
        t('Export Locales (.json)'),
        t('Define Variable'),
        t('Find Variable Usages'),
        t('Copy as Include-Link'),
        t('Open in Terminal'),
        t('Open in Spreadsheet'),
        t('Open in Browser')
      ])

      const filterItems = (items: ContextMenuItem[]) =>
        items
          .map((item) => ({
            ...item,
            children: item.children ? filterItems(item.children) : undefined
          }))
          .filter((item) => !blocked.has(item.label))
          .filter((item) => !item.children || item.children.length > 0)

      menuItems = filterItems(menuItems)
    }
    menuX = event.clientX
    menuY = event.clientY
    lastMenuAnchor = { x: event.clientX, y: event.clientY }
    menuShow = true
    requestAnimationFrame(() => {
      void repositionContextMenu()
    })
  }

  $effect(() => {
    if (__requestCreateFolderKey === lastExternalCreateFolderKey) return
    lastExternalCreateFolderKey = __requestCreateFolderKey

    if (!effectiveCapabilities.canCreate) return

    const parentPath = __requestCreateFolderParentPath || __rootPath
    beginInlineInput({
      mode: 'create-folder',
      parentPath,
      value: t('new-folder'),
      placeholder: t('Folder name')
    })
  })

  $effect(() => {
    if (__requestCreateFileKey === lastExternalCreateFileKey) return
    lastExternalCreateFileKey = __requestCreateFileKey

    if (!effectiveCapabilities.canCreate) return

    const parentPath = __requestCreateFileParentPath || __rootPath
    beginInlineInput({
      mode: 'create-file',
      parentPath,
      value: __defaultNewFileName || t('new-file'),
      placeholder: t('File name')
    })
  })

  $effect(() => {
    if (!menuShow) return
    const handle = () => {
      void repositionContextMenu()
    }
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  })

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      selectAllVisible()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      if (selectedPaths.size > 1) {
        copySelection()
        e.preventDefault()
        return
      }
      const primary = getPrimaryItem()
      if (primary) {
        copyItem(primary)
        e.preventDefault()
      }
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
      if (selectedPaths.size > 1) {
        cutSelection()
        e.preventDefault()
        return
      }
      const primary = getPrimaryItem()
      if (primary) {
        cutItem(primary)
        e.preventDefault()
      }
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
      e.preventDefault()
      refreshTree()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !e.shiftKey) {
      e.preventDefault()
      handleQuickAddFile()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
      e.preventDefault()
      handleQuickAddFolder()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault()
      handleQuickCollapseAll()
      return
    }
    if (e.key === 'Escape') {
      clearSelection()
      return
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPaths.size > 0) {
      e.preventDefault()
      void deleteSelected()
    }
  }

  function handleContainerClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    if (target && (target === treeRootEl || target.dataset?.treeBlank === '1')) {
      clearSelection()
    }
    treeRootEl?.focus()
  }

  $effect(() => {
    const focusPath = selectedPath
    if (!focusPath) return
    const current = untrack(() => selectedPaths)
    if (current.size === 1 && current.has(focusPath)) return
    if (current.size <= 1) {
      selectedPaths = new Set([focusPath])
      return
    }
    if (!current.has(focusPath)) {
      const next = new Set(current)
      next.add(focusPath)
      selectedPaths = next
    }
  })

  $effect(() => {
    if (!__onSelectionChange) return
    const paths = Array.from(selectedPaths)
    if (!paths.length && selectedPath) paths.push(selectedPath)
    const items = paths.map((entry) => knownNodes.get(entry)).filter(Boolean) as FileNode[]
    const signature = items.map((item) => item.path).join('|')
    if (signature === lastSelectionSignature) return
    lastSelectionSignature = signature
    __onSelectionChange(items)
  })
</script>

<!-- {  __rootParentPath }
    { __rootPath  } -->
<div
  class="tree-container h-full w-full overflow-y-auto overflow-x-hidden bg-base-100 relative"
  bind:this={treeRootEl}
  tabindex="0"
  onkeydown={handleKeyDown}
  onclick={handleContainerClick}
>
  {#if selectedPaths.size > 1}
    <div
      class="sticky top-0 z-10 flex items-center justify-between gap-2 px-2 py-1 bg-black/35 border-b border-white/10"
    >
      <span class="text-[10px] text-base-content/70">
        {selectedPaths.size}
        {$_('Selected')}
      </span>
      <div class="flex items-center gap-1">
        <button class="adobe-tool-btn" title={$_('Copy selected')} onclick={() => copySelection()}>
          <i class="ph-bold ph-copy"></i>
        </button>
        <button class="adobe-tool-btn" title={$_('Cut selected')} onclick={() => cutSelection()}>
          <i class="ph-bold ph-scissors"></i>
        </button>
        <button
          class="adobe-tool-btn text-rose-200"
          title={$_('Delete selected')}
          onclick={() => deleteSelected()}
        >
          <i class="ph-bold ph-trash"></i>
        </button>
        <button
          class="adobe-tool-btn"
          title={$_('Clear selection')}
          onclick={() => clearSelection()}
        >
          <i class="ph-bold ph-x"></i>
        </button>
      </div>
    </div>
  {/if}
  {#if driveProgress?.active}
    <div
      class="sticky z-10 px-2 py-1 bg-black/40 border-b border-white/10"
      style="top: {selectedPaths.size > 1 ? '28px' : '0px'}"
    >
      <div class="flex items-center justify-between text-[10px] text-base-content/70">
        <span>{driveProgress.label}</span>
        <span>{driveProgress.done}/{driveProgress.total}</span>
      </div>
      <div
        class="mt-1 h-1 w-full rounded bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] overflow-hidden"
      >
        <div
          class="h-full bg-primary transition-all"
          style="width: {Math.round((driveProgress.done / driveProgress.total) * 100)}%"
        ></div>
      </div>
    </div>
  {/if}
  {#if diskShareSyncing}
    <div class="tree-sync-overlay">
      <div class="tree-sync-card">
        <div class="tree-sync-spinner"></div>
        <div class="tree-sync-text">
          {diskShareSyncLabel || $_('Syncing to drive...')}
        </div>
      </div>
    </div>
  {/if}
  <div class="tree-blank" data-tree-blank="1"></div>
  <ul class="m-0 p-0">
    <TreeItem
      item={{
        name: isDriveSource ? t('Drive Root') : t('Project Root'),
        path: __rootPath,
        isFolder: true,
        ephemeralMeta: (() => {
          const meta = resolveRootDocument()?.getEphemeralTimeRemaining?.()
          return meta?.deadlineAt
            ? {
                deadlineAt: meta.deadlineAt,
                readsLeft: meta.readsLeft,
                writesLeft: meta.writesLeft
              }
            : null
        })()
      }}
      level={0}
      {expandedPaths}
      {selectedPath}
      {selectedPaths}
      nowTick={isDriveSource ? 0 : nowTick}
      {refreshTick}
      {inlineInput}
      excludeExt={excludeExtensions}
      {readDirHandler}
      allowDragDrop={effectiveCapabilities.canDragDrop}
      {dragOverPath}
      dropPlacement={dragOverPlacement}
      dropBlocked={dragOverBlocked}
      selectionMode={__selectionMode}
      on:toggle={handleToggle}
      on:select={handleSelect}
      on:open={handleOpen}
      on:contextmenu={handleContextMenu}
      on:nodeinfo={registerNode}
      on:inlinecommit={handleInlineCommit}
      on:inlinecancel={handleInlineCancel}
      on:dragstart={handleDragStart}
      on:dragover={handleDragOver}
      on:dragleave={handleDragLeave}
      on:drop={handleDrop}
      on:quickrefresh={handleQuickRefresh}
      on:quickaddfile={handleQuickAddFile}
      on:quickaddfolder={handleQuickAddFolder}
      on:quickcollapseall={handleQuickCollapseAll}
    />
  </ul>
  <div class="tree-blank" data-tree-blank="1"></div>
  <ContextMenuWidget
    bind:__show={menuShow}
    bind:__menuRef={menuRef}
    __x={menuX}
    __y={menuY}
    __menuItems={menuItems}
  />
</div>

<style>
  .tree-container {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
  }
  .tree-container::-webkit-scrollbar {
    width: 4px;
  }
  .tree-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
  }
  .tree-blank {
    height: 16px;
  }
  .tree-sync-overlay {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(2px);
  }
  .tree-sync-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(20, 20, 20, 0.95);
    color: rgba(255, 255, 255, 0.85);
    font-size: 11px;
  }
  .tree-sync-spinner {
    width: 16px;
    height: 16px;
    border-radius: 999px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: var(--color-base-300);
    animation: treeSyncSpin 0.9s linear infinite;
  }
  @keyframes treeSyncSpin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
