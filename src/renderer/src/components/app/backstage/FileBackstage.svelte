<!--
 Copyright (C) 2024 Dashmake Inc.

 This file is part of DDoc Office.

 DDoc Office is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 DDoc Office is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
-->
<!-- WPS-style "File" backstage overlay with the richer File menu experience. -->
<script lang="ts">
  import icon from '@resources/img/icon.png'
  import { _ } from 'svelte-i18n'
  import { get } from 'svelte/store'
  import { onDestroy, onMount } from 'svelte'
  import { _$_fileBackstageOpen, closeFileBackstage } from '../../../stores/fileBackstage.store'
  import { openAlertModal } from '../../../stores/alertModal.store'
  import { openSealOptionsModal } from '../../../stores/sealOptionsModal.store'
  import { openConfirmModal } from '../../../stores/confirmModal.store'
  import { openSettingsModal } from '../../../stores/settingsModal.store'
  import { _$_documentEditorsList } from '../../../stores/editor.store'
  import { activeSheet } from '../../../stores/sheetBridge.store'
  import { _$_sessionRecovery } from '../../../stores/sessionRecovery.store'
  import { _$_pinnedRecentDocuments } from '../../../stores/common.store'
  import {
    saveActiveDocument,
    listSnapshots,
    restoreSnapshot,
    getDocumentLockInfo,
    getSaveSessionId
  } from '../../../services/save/savePipeline.service'
  import {
    promptAndExport,
    exportSelectionToFile,
    exportTablesToFile
  } from '../../../services/export/editorExport.service'
  import {
    exportActiveEditorToDocx,
    exportActiveEditorToOdt,
    exportActiveEditorToOdp
  } from '../../../services/export/docxExport.service'
  import { promptAndExportActiveSheet } from '../../../services/export/spreadsheetExchange.service'
  import {
    isSecureLeaseAvailable,
    notifySecureLeaseRequired
  } from '../../../stores/secureLease.store'
  import EditorCommonUtils from '../../../utils/common.utils'
  import Utils from '../../../utils/Utils'
  import Platform from '../../../libs/platform'
  import {
    DocumentModel,
    type DocumentContentType,
    type DocumentEditorModel
  } from '../../../models/Document'
  import { nodeApi } from '../../../utils/shims/node'
  import FileMenuSubmenu from './FileMenuSubmenu.svelte'

  const open = $derived($_$_fileBackstageOpen)
  const t = get(_)

  type FileBackstageEntry = {
    name: string
    isDirectory: () => boolean
  }

  type MenuItem = {
    id: string
    label?: string
    icon?: string
    shortcut?: string
    hasSubmenu?: boolean
    active?: boolean
    type?: 'item' | 'separator'
    disabled?: boolean
    action?: () => void | Promise<void>
    submenu?: MenuItem[]
    badge?: string
    tooltip?: string
  }

  type RecentFile = {
    id: string
    name: string
    path: string
    date: string
    type:
      | 'word'
      | 'excel'
      | typeof Utils.FILE_TYPES.pdf
      | 'slide'
      | `${typeof Utils.DYNADOC_EXTENSIONS_FORMAT.name}`
      | 'unknown'
    documentPath: string
    parentPath?: string | null
    updatedAt?: Date | null
    isPinned?: boolean
    isActive?: boolean
  }

  const ddocExtensions = Object.values(Utils.DYNADOC_EXTENSIONS).map((ext) => ext.replace('.', ''))
  const ddocExtensionsWithDot = Object.values(Utils.DYNADOC_EXTENSIONS)
  const openFolderExtensions = new Set([
    ...ddocExtensionsWithDot,
    Utils.OFFICE_EXTENSIONS.word,
    Utils.OFFICE_EXTENSIONS.powerpoint,
    '.odt',
    '.odp',
    Utils.OFFICE_EXTENSIONS.excel,
    '.xls',
    '.csv',
    Utils.PDF_EXTENSION,
    '.html',
    '.htm',
    '.txt'
  ])

  let editors = $state<DocumentEditorModel[]>([])
  const unsubscribeEditors = _$_documentEditorsList.subscribe((list) => {
    editors = Array.isArray(list) ? list : []
  })

  let pinnedIds = $state<string[]>([])
  const unsubscribePins = _$_pinnedRecentDocuments.subscribe((list) => {
    pinnedIds = Array.isArray(list) ? list : []
  })

  let activeSheetEntry = $state<{ methods?: unknown } | null>(null)
  const unsubscribeSheet = activeSheet.subscribe((entry) => {
    activeSheetEntry = entry
  })

  onDestroy(() => {
    unsubscribeEditors?.()
    unsubscribePins?.()
    unsubscribeSheet?.()
    if (snapshotTimer) {
      window.clearInterval(snapshotTimer)
      snapshotTimer = null
    }
  })

  let searchQuery = $state('')
  let searchOpen = $state(false)
  let viewMode = $state<'list' | 'grid'>('list')
  let nowTick = $state(Date.now())
  let ephemeralStatus = $state<Record<string, { deadlineAt: string; remainingMs: number }>>({})
  let showPinnedOnly = $state(false)
  let submenuId = $state<string | null>(null)
  let submenuTop = $state(0)
  let asideEl: HTMLElement | null = null
  let cacheDir = $state('')
  let snapshots = $state<{ path: string; createdAt: string; size: number; modTime: string }[]>([])
  let snapshotTimer: number | null = null

  const activeDoc = $derived.by(() => editors.find((editor) => editor.isActive))
  const hasActiveDoc = $derived.by(() => Boolean(activeDoc))
  const hasActiveSheet = $derived.by(() => Boolean(activeSheetEntry?.methods))
  const lastSyncLabel = $derived.by(() => formatDate(activeDoc?.document?.info?.updatedAt))
  const isUnsaved = $derived.by(() => {
    const docPath = activeDoc?.document?.path
    if (!docPath) return true
    if (!cacheDir) return false
    return docPath.startsWith(cacheDir)
  })
  const lockInfo = $derived.by(() => {
    return activeDoc ? getDocumentLockInfo(activeDoc) : null
  })
  const isLocked = $derived.by(() => {
    if (!lockInfo?.sessionId) return false
    return lockInfo.sessionId !== getSaveSessionId()
  })
  const recentFiles = $derived.by(() => {
    return buildRecentFiles(editors, pinnedIds, searchQuery, showPinnedOnly)
  })
  const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop

  $effect(() => {
    void refreshEphemeralStatuses()
  })

  onMount(() => {
    const id = window.setInterval(() => {
      nowTick = Date.now()
    }, 60_000)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('keydown', handleKey)
    }
  })

  function formatDate(value?: Date | string | null): string {
    if (!value) return 'Not synced yet'
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return 'Not synced yet'
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  }

  function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes)) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  function formatRemaining(ms: number): string {
    if (!Number.isFinite(ms)) return ''
    if (ms <= 0) return t('Expired')
    const minute = 60_000
    const hour = 60 * minute
    const day = 24 * hour
    if (ms < minute) return '<1m'
    if (ms < hour) return `${Math.max(1, Math.round(ms / minute))}m`
    if (ms < day) {
      const hours = Math.floor(ms / hour)
      const mins = Math.floor((ms % hour) / minute)
      return mins ? `${hours}h ${mins}m` : `${hours}h`
    }
    const days = Math.floor(ms / day)
    const hours = Math.floor((ms % day) / hour)
    return hours ? `${days}d ${hours}h` : `${days}d`
  }

  function badgeTone(remainingMs: number): 'danger' | 'warning' | 'safe' {
    if (remainingMs <= 3_600_000) return 'danger'
    if (remainingMs <= 86_400_000) return 'warning'
    return 'safe'
  }

  function closeFileMenu(): void {
    try {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    } catch {
      // ignore
    }
  }

  async function runMenuAction(action?: () => void | Promise<void>): Promise<void> {
    closeFileBackstage()
    await action?.()
  }

  async function refreshEphemeralStatuses(): Promise<void> {
    const entries = recentFiles
    if (!entries.length) {
      ephemeralStatus = {}
      return
    }
    const updates: Record<string, { deadlineAt: string; remainingMs: number }> = {}
    await Promise.all(
      entries.map(async (entry) => {
        const status = await DocumentModel.getEphemeralStatusForPath(entry.path)
        if (status?.deadlineAt) {
          updates[entry.id] = {
            deadlineAt: status.deadlineAt,
            remainingMs: status.remainingMs
          }
        }
      })
    )
    ephemeralStatus = updates
  }

  const TYPE_ICONS = {
    word: { icon: 'ph-light ph-file-doc', color: 'text-blue-500' },
    excel: { icon: 'ph-light ph-file-xls', color: 'text-green-500' },
    pdf: { icon: 'ph-light ph-file-pdf', color: 'text-red-500' },
    slide: { icon: 'ph-light ph-file-ppt', color: 'text-orange-400' },
    ddoc: { icon: 'ph-light ph-file-text', color: 'text-primary' },
    unknown: { icon: 'ph-light ph-file', color: 'text-base-content/40' }
  }

  const menuItems = $derived.by(() => {
    const canSave = hasActiveDoc && !isLocked
    const canSaveSheet = Boolean(hasActiveSheet)
    const canSaveSecured = canSave
    const secureBadge = isSecureLeaseAvailable() ? '' : t('Secure license required')

    return [
      {
        id: 'new',
        label: t('New'),
        shortcut: 'N',
        icon: 'i-carbon-document-add',
        action: () => handleNewDocument('text')
      },
      {
        id: 'open',
        label: t('Open'),
        shortcut: 'O',
        icon: 'i-carbon-folder-open',
        active: true,
        action: handleOpenDocuments
      },
      isDesktopPlatform
        ? {
            id: 'open-folder',
            label: t('Open Folder'),
            shortcut: 'Shift+O',
            icon: 'i-carbon-folder',
            action: handleOpenFolder
          }
        : null,
      isDesktopPlatform
        ? {
            id: 'save',
            label: isUnsaved ? t('Save As…') : t('Save'),
            shortcut: 'S',
            icon: 'i-carbon-save',
            disabled: !canSave,
            action: handleSaveActive
          }
        : null,
      isDesktopPlatform
        ? {
            id: 'save-to',
            label: t('Save To'),
            shortcut: 'A',
            icon: 'i-carbon-save-series',
            disabled: !canSave,
            hasSubmenu: true,
            submenu: [
              {
                id: 'save-to-ddoc',
                label: t('Dynadoc (.xddoc)'),
                icon: 'i-carbon-document',
                disabled: !canSave,
                action: handleSaveAs
              },
              {
                id: 'save-to-secured',
                label: t('Secured (.sddoc)'),
                icon: 'i-carbon-shield-check',
                disabled: !canSaveSecured,
                badge: secureBadge || undefined,
                tooltip: secureBadge || undefined,
                action: handleSaveAsSecured
              },
              {
                id: 'save-to-word',
                label: t('Word (.docx)'),
                icon: 'i-carbon-logo-microsoft',
                disabled: !canSave,
                action: handleSaveAsWord
              },
              {
                id: 'save-to-excel',
                label: t('Excel (.xlsx)'),
                icon: 'i-carbon-spreadsheet',
                disabled: !canSaveSheet,
                action: handleExportToExcel
              },
              {
                id: 'save-to-powerpoint',
                label: t('PowerPoint (.pptx)'),
                icon: 'i-carbon-presentation-file',
                disabled: true
              }
            ]
          }
        : null,
      isDesktopPlatform ? { id: 'separator-1', type: 'separator' } : null,
      {
        id: 'export-to',
        label: t('Export To'),
        shortcut: 'F',
        icon: 'i-carbon-document-export',
        disabled: !canSave,
        hasSubmenu: true,
        submenu: [
          {
            id: 'export-pdf',
            label: t('PDF (.pdf)'),
            icon: 'i-carbon-pdf',
            disabled: !canSave,
            action: handleExportToPDF
          },
          {
            id: 'export-word',
            label: t('Word (.docx)'),
            icon: 'i-carbon-document-export',
            disabled: !canSave,
            action: handleExportToWord
          },
          {
            id: 'export-odt',
            label: t('OpenDocument Text (.odt)'),
            icon: 'i-carbon-document-export',
            disabled: !canSave,
            action: handleExportToOdt
          },
          {
            id: 'export-powerpoint',
            label: t('PowerPoint (.pptx)'),
            icon: 'i-carbon-presentation-file',
            disabled: true
          },
          {
            id: 'export-odp',
            label: t('OpenDocument Presentation (.odp)'),
            icon: 'i-carbon-presentation-file',
            disabled: !canSave,
            action: handleExportToOdp
          },
          {
            id: 'export-excel',
            label: t('Excel (.xlsx)'),
            icon: 'i-carbon-spreadsheet',
            disabled: !canSaveSheet,
            action: handleExportToExcel
          },
          {
            id: 'export-picture',
            label: t('Picture'),
            icon: 'i-carbon-image',
            disabled: !canSave,
            action: handleExportToPicture
          },
          {
            id: 'export-selection',
            label: t('Selection'),
            icon: 'i-carbon-selection',
            disabled: !canSave,
            hasSubmenu: true,
            submenu: [
              {
                id: 'export-selection-txt',
                label: t('Plain Text'),
                action: () => handleExportSelection('txt')
              },
              {
                id: 'export-selection-md',
                label: t('Markdown'),
                action: () => handleExportSelection('markdown')
              }
            ]
          },
          {
            id: 'export-selection-html',
            label: t('HTML'),
            action: () => handleExportSelection('html')
          }
        ]
      },
      {
        id: 'export-tables',
        label: t('Tables'),
        icon: 'i-carbon-table',
        disabled: !canSave,
        hasSubmenu: true,
        submenu: [
          {
            id: 'export-tables-selected',
            label: t('Selected Table'),
            hasSubmenu: true,
            submenu: [
              {
                id: 'export-tables-selected-csv',
                label: t('Excel (.csv)'),
                action: () => handleExportTables('csv', 'selected')
              },
              {
                id: 'export-tables-selected-html',
                label: t('HTML'),
                action: () => handleExportTables('html', 'selected')
              },
              {
                id: 'export-tables-selected-md',
                label: t('Markdown'),
                action: () => handleExportTables('markdown', 'selected')
              }
            ]
          },
          {
            id: 'export-tables-all',
            label: t('All Tables'),
            hasSubmenu: true,
            submenu: [
              {
                id: 'export-tables-all-csv',
                label: t('Excel (.csv)'),
                action: () => handleExportTables('csv', 'all')
              },
              {
                id: 'export-tables-all-html',
                label: t('HTML'),
                action: () => handleExportTables('html', 'all')
              },
              {
                id: 'export-tables-all-md',
                label: t('Markdown'),
                action: () => handleExportTables('markdown', 'all')
              }
            ]
          }
        ]
      },
      { id: 'separator-2', type: 'separator' },
      {
        id: 'print',
        label: t('Print'),
        shortcut: 'P',
        icon: 'i-carbon-printer',
        disabled: !canSave,
        action: handlePrint
      },
      { id: 'separator-3', type: 'separator' },
      {
        id: 'email',
        label: t('Send E-mail'),
        shortcut: 'M',
        icon: 'i-carbon-email',
        disabled: !canSave,
        action: handleSendEmail
      },
      {
        id: 'encrypt',
        label: t('Document Encryption'),
        shortcut: 'E',
        icon: 'i-carbon-locked',
        disabled: !canSave,
        action: handleDocumentEncryption
      },
      {
        id: 'backup',
        label: t('Backup and Restore'),
        shortcut: 'K',
        icon: 'i-carbon-cloud-backup',
        action: handleBackupRestore
      },
      {
        id: 'restore-session',
        label: t('Restore Previous Session'),
        shortcut: 'J',
        icon: 'i-carbon-time',
        action: () => _$_sessionRecovery.open(true)
      },
      { id: 'separator-4', type: 'separator' },
      {
        id: 'restore',
        label: t('Restore Previous Version'),
        shortcut: 'R',
        icon: 'i-carbon-restart',
        disabled: !canSave || snapshots.length === 0,
        hasSubmenu: true,
        submenu: snapshots.map((snapshot) => ({
          id: snapshot.path,
          label: `${formatDate(snapshot.createdAt)} · ${formatBytes(snapshot.size)} · ${formatDate(snapshot.modTime)}`,
          icon: 'i-carbon-time',
          action: () => handleRestoreSnapshot(snapshot.path)
        }))
      },
      { id: 'help', label: t('Help'), shortcut: 'H', icon: 'i-carbon-help', action: handleHelp },
      {
        id: 'options',
        label: t('Options'),
        shortcut: 'L',
        icon: 'i-carbon-settings',
        action: handleOptions
      }
    ].filter((item): item is MenuItem => Boolean(item))
  })

  function resolveFileTypeFromPath(filePath?: string | null): RecentFile['type'] {
    if (!filePath) return 'unknown'
    const ext = nodeApi.path.extname(filePath).toLowerCase()
    if (['.ppt', Utils.OFFICE_EXTENSIONS.powerpoint, '.slide'].includes(ext)) return 'slide'
    if (['.xls', Utils.OFFICE_EXTENSIONS.excel, '.csv', '.sheet'].includes(ext)) return 'excel'
    if ([Utils.PDF_EXTENSION].includes(ext)) return Utils.FILE_TYPES.pdf
    if (ddocExtensionsWithDot.includes(ext)) return Utils.DYNADOC_EXTENSIONS_FORMAT.name
    return 'word'
  }

  function buildRecentFiles(
    list: DocumentEditorModel[],
    pinned: string[],
    query: string,
    pinnedOnly: boolean
  ): RecentFile[] {
    const normalizedQuery = query.trim().toLowerCase()
    const pinnedSet = new Set(pinned)

    const files = list
      .filter((editor) => editor?.document?.path)
      .map((editor) => {
        const doc = editor.document
        const fullPath = doc?.path || doc?.getMainFilePath?.() || ''
        return {
          id: editor.uuid || doc?.uuid || editor.id,
          name: `${doc?.name || 'Untitled'}${doc?.extension || ''}`,
          path: doc?.dirPath || nodeApi.path.dirname(fullPath),
          date: formatDate(doc?.info?.updatedAt),
          type: resolveFileTypeFromPath(fullPath),
          documentPath: fullPath,
          parentPath: doc?.parentPath,
          updatedAt: doc?.info?.updatedAt || null,
          isPinned: pinnedSet.has(editor.uuid || doc?.uuid || editor.id),
          isActive: Boolean(editor.isActive)
        } satisfies RecentFile
      })

    const filtered = normalizedQuery
      ? files.filter(
          (file) =>
            file.name.toLowerCase().includes(normalizedQuery) ||
            file.path.toLowerCase().includes(normalizedQuery)
        )
      : files

    const sorted = filtered.sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return timeB - timeA
    })

    const pinnedItems = sorted.filter((file) => file.isPinned)
    const regularItems = sorted.filter((file) => !file.isPinned)

    return pinnedOnly ? pinnedItems : [...pinnedItems, ...regularItems]
  }

  async function handleNewDocument(type: DocumentContentType): Promise<void> {
    closeFileMenu()
    await EditorCommonUtils.addNewDocumentEditor(null, null, undefined, type, 'default')
  }

  async function handleOpenDocuments(): Promise<void> {
    closeFileMenu()
    const paths = await window.api.openDialogFiles([
      { name: 'All Files', extensions: ['*'] },
      { name: 'Dynadoc', extensions: ddocExtensions },
      {
        name: 'Documents',
        extensions: [
          'docx',
          Utils.FILE_TYPES.pdf,
          'pptx',
          'xlsx',
          'xls',
          'csv',
          'html',
          'htm',
          'txt'
        ]
      }
    ])

    const list = Array.isArray(paths) ? paths : paths ? [paths] : []
    if (!list.length) return
    for (const filePath of list) {
      await EditorCommonUtils.openDocumentFromInput(filePath, { parentPath: null })
    }
  }

  function collectSupportedFilesInFolder(root: string, limit = 200): string[] {
    const results: FileBackstageEntry[] = []
    const stack = [root]
    while (stack.length) {
      const current = stack.pop()
      if (!current) continue
      let entries: Array<{ name: string; isDirectory: () => boolean }> = []
      try {
        entries = nodeApi.fs.readdirSync(current, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        const fullPath = nodeApi.path.join(current, entry.name)
        if (entry.isDirectory()) {
          stack.push(fullPath)
          continue
        }
        const ext = nodeApi.path.extname(entry.name).toLowerCase()
        if (openFolderExtensions.has(ext)) {
          results.push(fullPath)
          if (results.length >= limit) return results
        }
      }
    }
    return results
  }

  async function handleOpenFolder(): Promise<void> {
    closeFileMenu()
    const folderPath = await window.api.openDialogDirectory()
    if (!folderPath) return
    const files = collectSupportedFilesInFolder(folderPath)
    if (!files.length) {
      await openAlertModal({
        title: t('Open Folder'),
        message: t('No supported files found in this folder.')
      })
      return
    }
    const shouldOpen = await openConfirmModal({
      title: t('Open Folder'),
      message: t('Open {count} files in new tabs?', { values: { count: files.length } })
    })
    if (!shouldOpen) return
    for (const filePath of files) {
      await EditorCommonUtils.addNewDocumentEditor(filePath, null)
    }
  }

  async function handleOpenRecent(file: RecentFile): Promise<void> {
    closeFileMenu()
    if (!file?.documentPath) return
    await EditorCommonUtils.addNewDocumentEditor(file.documentPath, file.parentPath || null)
  }

  async function handleSaveActive(): Promise<void> {
    closeFileMenu()
    const active = _$_documentEditorsList.getActiveSync?.()
    if (!active) {
      await openAlertModal({ title: t('Nothing to save'), message: t('No active document found.') })
      return
    }
    await saveActiveDocument()
  }

  async function handleSaveAs(): Promise<void> {
    closeFileMenu()
    const active = _$_documentEditorsList.getActiveSync?.()
    if (!active) {
      await openAlertModal({ title: t('Nothing to save'), message: t('No active document found.') })
      return
    }
    await saveActiveDocument({ saveAs: true })
  }

  async function handleSaveAsWord(): Promise<void> {
    closeFileMenu()
    await exportActiveEditorToDocx({
      reasonLabel: 'Saved as Word document',
      promptSelection: true
    })
  }

  async function handleSaveAsSecured(): Promise<void> {
    closeFileMenu()
    if (!isSecureLeaseAvailable()) {
      await notifySecureLeaseRequired(
        'Secure saving is currently unavailable. Please renew your secure writing license.'
      )
      return
    }
    const active = _$_documentEditorsList.getActiveSync?.()
    if (!active) {
      await openAlertModal({ title: t('Nothing to save'), message: t('No active document found.') })
      return
    }
    const sealOptions = await openSealOptionsModal(active.document?.name || '')
    if (!sealOptions) return
    await saveActiveDocument({
      saveAs: true,
      saveAsSecured: true,
      require2fa: sealOptions.require2fa
    })
  }

  async function handleExportToPDF(): Promise<void> {
    closeFileMenu()
    await promptAndExport(Utils.FILE_TYPES.pdf)
  }

  async function handleExportToWord(): Promise<void> {
    closeFileMenu()
    await exportActiveEditorToDocx({
      reasonLabel: 'Word export ready',
      promptSelection: true
    })
  }

  async function handleExportToOdt(): Promise<void> {
    closeFileMenu()
    await exportActiveEditorToOdt({
      reasonLabel: 'ODT export ready',
      promptSelection: true
    })
  }

  async function handleExportToOdp(): Promise<void> {
    closeFileMenu()
    await exportActiveEditorToOdp({
      reasonLabel: 'ODP export ready',
      promptSelection: true
    })
  }

  async function handleExportToPicture(): Promise<void> {
    closeFileMenu()
    await promptAndExport('picture')
  }

  async function handleExportToExcel(): Promise<void> {
    closeFileMenu()
    await promptAndExportActiveSheet()
  }

  async function handleExportSelection(format: 'html' | 'markdown' | 'txt'): Promise<void> {
    closeFileMenu()
    await exportSelectionToFile({ format })
  }

  async function handleExportTables(
    format: 'csv' | 'markdown' | 'html',
    scope: 'all' | 'selected' = 'all'
  ): Promise<void> {
    closeFileMenu()
    await exportTablesToFile({ format, scope })
  }

  async function handlePrint(): Promise<void> {
    closeFileMenu()
    await promptAndExport('print')
  }

  async function handleSendEmail(): Promise<void> {
    closeFileMenu()
    await openAlertModal({
      title: t('Send E-mail'),
      message: t('Attach the exported PDF to email. Built-in email integration is coming soon.')
    })
  }

  async function handleDocumentEncryption(): Promise<void> {
    closeFileMenu()
    if (!isSecureLeaseAvailable()) {
      await notifySecureLeaseRequired(
        'Secure saving is currently unavailable. Please renew your secure writing license.'
      )
      return
    }
    const active = _$_documentEditorsList.getActiveSync?.()
    if (!active) {
      await openAlertModal({
        title: t('Document Encryption'),
        message: t('No active document found.')
      })
      return
    }
    const sealOptions = await openSealOptionsModal(active.document?.name || '')
    if (!sealOptions) return
    await saveActiveDocument({
      saveAs: true,
      saveAsSecured: true,
      require2fa: sealOptions.require2fa
    })
  }

  async function handleBackupRestore(): Promise<void> {
    closeFileMenu()
    await openAlertModal({
      title: t('Backup & Restore'),
      message: t('Versioned backups are in progress. We will enable restore flows here.')
    })
  }

  async function handleHelp(): Promise<void> {
    closeFileMenu()
    await openAlertModal({
      title: t('Help'),
      message: t('Documentation is coming soon. Use the in-app help command palette for now.')
    })
  }

  async function handleOptions(): Promise<void> {
    closeFileMenu()
    await openSettingsModal('general')
  }

  async function handleDocumentProperties(): Promise<void> {
    closeFileMenu()
    const active = _$_documentEditorsList.getActiveSync?.()
    if (!active?.document) {
      await openAlertModal({
        title: t('Document Properties'),
        message: t('No active document found.')
      })
      return
    }
    const doc = active.document
    await openAlertModal({
      title: doc.name || t('Document Properties'),
      message: t('Path: {path}\nType: {type}\nUpdated: {updated}', {
        values: {
          path: doc.path,
          type: doc.extension,
          updated: formatDate(doc.info?.updatedAt)
        }
      })
    })
  }

  function togglePin(file: RecentFile): void {
    if (!file?.id) return
    _$_pinnedRecentDocuments.update((list) => {
      const next = Array.isArray(list) ? [...list] : []
      const idx = next.indexOf(file.id)
      if (idx >= 0) {
        next.splice(idx, 1)
      } else {
        next.unshift(file.id)
      }
      return next
    })
  }

  async function removeRecent(file: RecentFile): Promise<void> {
    const confirmed = await openConfirmModal({
      title: t('Remove from recent'),
      message: t('Remove "{name}" from recent list? This will close the tab if it is open.', {
        values: { name: file.name }
      }),
      confirmText: t('Remove'),
      cancelText: t('Cancel'),
      destructive: true
    })
    if (!confirmed) return
    _$_pinnedRecentDocuments.update((list) =>
      Array.isArray(list) ? list.filter((id) => id !== file.id) : []
    )
    _$_documentEditorsList.closeTab(file.id)
  }

  async function revealInFolder(file: RecentFile): Promise<void> {
    closeFileMenu()
    if (!file?.documentPath) return
    const directory = file.path || nodeApi.path.dirname(file.documentPath)
    await window.api.openFile(directory)
  }

  function openSubmenu(item: MenuItem, event: MouseEvent): void {
    if (!item.submenu?.length) return
    submenuId = submenuId === item.id ? null : item.id
    if (!submenuId) return
    const target = event.currentTarget as HTMLElement | null
    const asideRect = asideEl?.getBoundingClientRect()
    const rect = target?.getBoundingClientRect()
    if (asideRect && rect) {
      submenuTop = rect.top - asideRect.top
    }
  }

  function closeSubmenu(): void {
    submenuId = null
  }

  async function refreshSnapshots(editor?: DocumentEditorModel | null): Promise<void> {
    if (!editor) {
      snapshots = []
      return
    }
    snapshots = await listSnapshots(editor)
  }

  async function handleRestoreSnapshot(snapshotPath: string): Promise<void> {
    closeFileMenu()
    const active = _$_documentEditorsList.getActiveSync?.()
    if (!active) return
    await restoreSnapshot(active, snapshotPath)
  }

  $effect(() => {
    if (!activeDoc) return
    void refreshSnapshots(activeDoc)
    if (!snapshotTimer) {
      snapshotTimer = window.setInterval(() => {
        if (activeDoc) {
          void refreshSnapshots(activeDoc)
        }
      }, 30_000)
    }
  })

  $effect(() => {
    if (!cacheDir && window.api) {
      // 1. Define an async function inside the effect
      async function loadCacheDir() {
        cacheDir = await window.api.getCacheDir()
        // cacheDir = isDesktopPlatform
        //   ? await window.api.getCacheDir()
        //   : await window.api.getStorageDir();
      }

      // 2. Call it
      loadCacheDir()
    }

    // Optional: return a cleanup function if needed
    return () => {
      // perform any teardown here
    }
  })

  function handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && $_$_fileBackstageOpen) {
      closeFileBackstage()
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-[999] bg-black/20 flex"
    onclick={closeFileBackstage}
    role="presentation"
  >
    <div
      class="ml-3 mt-[86px] w-[min(94vw,900px)] h-[calc(100%-120px)] max-h-[760px] bg-base-100 rounded-xl border border-base-200 shadow-2xl overflow-hidden flex"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <aside
        class="w-64 bg-base-200 border-r border-base-200 flex flex-col py-4 relative"
        bind:this={asideEl}
        onmouseleave={closeSubmenu}
      >
        <div class="px-6 mb-6">
          <div class="flex items-center gap-2">
            <img src={icon} alt="" class="w-10 h-10" />
            <span class="font-black text-sm uppercase tracking-widest">{t('ddoc-office')}</span>
          </div>
        </div>

        <nav class="flex-grow overflow-y-auto px-2 space-y-0.5">
          {#each menuItems as item (item.id)}
            {#if item.type === 'separator'}
              <div class="h-px bg-base-100 my-3 mx-4"></div>
            {:else}
              <button
                disabled={item.disabled}
                onclick={(event) =>
                  item.submenu?.length ? openSubmenu(item, event) : runMenuAction(item.action)}
                class="w-full flex items-center px-4 py-2.5 rounded-md text-[13px] font-medium transition-all group
                  {item.active
                  ? 'bg-primary text-primary-content shadow-md'
                  : item.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-base-300 text-base-content/70 hover:text-base-content'}"
              >
                <i
                  class="{item.icon?.replace('i-carbon-', 'ph-light ph-')} text-lg mr-4 {item.active
                    ? 'text-base-content'
                    : item.disabled
                      ? 'opacity-30'
                      : 'opacity-50 group-hover:opacity-100'}"
                ></i>

                <span class="flex-grow text-left">{item.label}</span>

                {#if item.shortcut}
                  <span
                    class="text-[10px] opacity-40 font-mono ml-2 group-hover:opacity-60 transition-opacity"
                  >
                    CMD+{item.shortcut}
                  </span>
                {/if}

                {#if item.hasSubmenu}
                  <i class="ph-light ph-caret-right text-[10px] ml-2"></i>
                {/if}
              </button>
            {/if}
          {/each}
        </nav>

        {#if submenuId}
          {#each menuItems as item (item.id)}
            {#if item.id === submenuId && item.submenu?.length}
              <div class="absolute left-[250px] z-3" style={`top: ${submenuTop}px`}>
                <FileMenuSubmenu items={item.submenu} __onAction={runMenuAction} />
              </div>
            {/if}
          {/each}
        {/if}

        <div class="px-4 mt-4 pt-4 border-t border-base-200">
          <button
            class="w-full flex items-center px-4 py-2 text-[12px] opacity-50 hover:opacity-100 transition-opacity"
            onclick={handleDocumentProperties}
          >
            <i class="ph-light ph-info mr-3"></i>
            {t('Document Properties')}
          </button>
        </div>
      </aside>

      <main class="flex-1 flex flex-col min-w-0 bg-base-100">
        <header class="flex items-center justify-between px-8 py-6 border-b border-base-200">
          <div>
            <h2 class="text-xl font-black tracking-tight">{t('Recent Documents')}</h2>
            <p class="text-[11px] opacity-50 uppercase tracking-wider font-bold mt-1">
              {t('Last synced:')}
              {lastSyncLabel}
            </p>
            <p class="text-[11px] opacity-60 mt-2">
              {activeDoc?.document?.path || t('Unsaved document')}
              {#if isUnsaved}
                <span class="ml-2 text-warning font-semibold uppercase tracking-wide"
                  >{t('Unsaved')}</span
                >
              {/if}
              {#if isLocked}
                <span class="ml-2 text-error font-semibold uppercase tracking-wide"
                  >{t('Locked')}</span
                >
              {/if}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <div class="join border border-base-200 bg-base-200 p-0.5 rounded-md">
              <button
                class="join-item btn btn-xs btn-ghost"
                class:active={viewMode === 'list'}
                onclick={() => (viewMode = 'list')}
              >
                <i class="ph-light ph-list"></i>
              </button>
              <button
                class="join-item btn btn-xs btn-ghost"
                class:active={viewMode === 'grid'}
                onclick={() => (viewMode = 'grid')}
              >
                <i class="ph-light ph-squares-four"></i>
              </button>
            </div>
            <button
              class="btn btn-sm btn-circle btn-ghost"
              onclick={() => (searchOpen = !searchOpen)}
            >
              <i class="ph-light ph-magnifying-glass text-lg"></i>
            </button>
            <button
              class="btn btn-sm btn-ghost text-[11px] uppercase tracking-widest font-bold"
              class:opacity-50={!showPinnedOnly}
              onclick={() => (showPinnedOnly = !showPinnedOnly)}
            >
              {t('Pinned')}
            </button>
          </div>
        </header>

        <div class="px-8 py-4 border-b border-base-200 flex flex-wrap gap-2 items-center">
          <span class="text-[11px] uppercase tracking-widest font-bold opacity-50"
            >{t('Quick Create')}</span
          >
          <button class="btn btn-xs btn-ghost" onclick={() => handleNewDocument('text')}>
            <i class="ph-light ph-file-text mr-1"></i>
            {t('Text')}
          </button>
          <button class="btn btn-xs btn-ghost" onclick={() => handleNewDocument('slide')}>
            <i class="ph-light ph-file-ppt mr-1"></i>
            {t('Slide')}
          </button>
          <button class="btn btn-xs btn-ghost" onclick={() => handleNewDocument('sheet')}>
            <i class="ph-light ph-file-xls mr-1"></i>
            {t('Sheet')}
          </button>
          <button class="btn btn-xs btn-ghost" onclick={() => handleNewDocument('design')}>
            <i class="ph-light ph-paint-brush mr-1"></i>
            {t('Design')}
          </button>
          <button class="btn btn-xs btn-ghost" onclick={() => handleNewDocument('meeting')}>
            <i class="ph-light ph-video-camera mr-1"></i>
            {t('Meeting')}
          </button>

          {#if searchOpen}
            <div class="ml-auto flex items-center bg-base-200 rounded-md px-3">
              <i class="ph-light ph-magnifying-glass opacity-40 text-base"></i>
              <input
                type="text"
                placeholder={t('Search recent documents...')}
                class="bg-transparent border-none py-1.5 pl-2 pr-1 text-xs w-60 focus:outline-none outline-none"
                bind:value={searchQuery}
              />
            </div>
          {/if}
        </div>

        <div class="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin">
          {#if recentFiles.length === 0}
            <div
              class="h-full flex flex-col items-center justify-center text-center gap-2 opacity-70"
            >
              <i class="ph-light ph-folder-dashed text-4xl"></i>
              <div class="text-sm font-semibold">{t('No recent documents')}</div>
              <div class="text-[11px] opacity-60">
                {t('Create a new file or open an existing one to get started.')}
              </div>
            </div>
          {:else if viewMode === 'grid'}
            <div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {#each recentFiles as file (file.id || file.documentPath)}
                {@const status = ephemeralStatus[file.id]}
                <div
                  class="p-4 rounded-md border border-base-200 bg-base-100 hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer"
                  onclick={() => handleOpenRecent(file)}
                >
                  <div class="flex items-center justify-between">
                    <i
                      class="{TYPE_ICONS[file.type]?.icon || 'ph-light ph-file'} {TYPE_ICONS[
                        file.type
                      ]?.color || 'text-base-content/40'} text-2xl"
                    ></i>
                    {#if file.isActive}
                      <span class="text-[9px] uppercase tracking-widest text-primary font-bold"
                        >{t('Active')}</span
                      >
                    {/if}
                  </div>
                  <div class="mt-3 text-[12px] font-semibold truncate flex items-center gap-2">
                    {file.name}

                    {#if status}
                      {@const remainingMs = status.remainingMs - (Date.now() - nowTick)}
                      <span
                        class="text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded
                          {badgeTone(remainingMs) === 'danger'
                          ? 'bg-rose-500/25 text-rose-200'
                          : badgeTone(remainingMs) === 'warning'
                            ? 'bg-amber-500/20 text-amber-200'
                            : 'bg-emerald-500/20 text-emerald-200'}"
                        title={`${t('Expires at')}: ${new Date(status.deadlineAt).toLocaleString()}`}
                      >
                        {remainingMs <= 0
                          ? t('Expired')
                          : `${formatRemaining(remainingMs)} ${t('...left')}`}
                      </span>
                    {/if}
                  </div>
                  <div class="text-[10px] opacity-50 truncate mt-1">{file.path}</div>
                  <div class="flex items-center justify-between mt-4 text-[10px] opacity-50">
                    <span>{file.date}</span>
                    <div class="flex gap-1">
                      <button
                        class="btn btn-xs btn-ghost btn-square hover:text-primary"
                        onclick={(e) => {
                          e.stopPropagation()
                          togglePin(file)
                        }}
                      >
                        <i class="ph-light {file.isPinned ? 'ph-star-fill' : 'ph-star'}"></i>
                      </button>
                      <button
                        class="btn btn-xs btn-ghost btn-square hover:text-error"
                        onclick={(e) => {
                          e.stopPropagation()
                          removeRecent(file)
                        }}
                      >
                        <i class="ph-light ph-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            {#each recentFiles as file (file.id || file.documentPath)}
              {@const status = ephemeralStatus[file.id]}
              <div
                class="flex items-center p-3 rounded-md hover:bg-base-200 cursor-pointer group transition-all border border-transparent hover:border-base-200"
                onclick={() => handleOpenRecent(file)}
              >
                <div
                  class="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-base-200 rounded-sm group-hover:bg-base-100 transition-colors"
                >
                  <i
                    class="{TYPE_ICONS[file.type]?.icon || 'ph-light ph-file'} {TYPE_ICONS[
                      file.type
                    ]?.color || 'text-base-content/40'} text-2xl"
                  ></i>
                </div>

                <div class="ml-4 flex-grow flex flex-col overflow-hidden">
                  <span
                    class="text-[13px] font-bold text-base-content truncate group-hover:text-primary transition-colors"
                  >
                    {file.name}
                    {#if status}
                      {@const remainingMs = status.remainingMs - (Date.now() - nowTick)}
                      <span
                        class="ml-2 text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded
                          {badgeTone(remainingMs) === 'danger'
                          ? 'bg-rose-500/25 text-rose-200'
                          : badgeTone(remainingMs) === 'warning'
                            ? 'bg-amber-500/20 text-amber-200'
                            : 'bg-emerald-500/20 text-emerald-200'}"
                        title={`${t('Expires at')}: ${new Date(status.deadlineAt).toLocaleString()}`}
                      >
                        {remainingMs <= 0
                          ? t('Expired')
                          : `${formatRemaining(remainingMs)} ${t('...left')}`}
                      </span>
                    {/if}
                  </span>
                  <div
                    class="flex items-center gap-2 text-[11px] opacity-50 truncate mt-0.5 font-medium"
                  >
                    <i class="ph-light ph-folder text-[12px]"></i>
                    {file.path}
                  </div>
                </div>

                <div class="flex items-center gap-4 ml-4">
                  <span class="text-[11px] opacity-40 whitespace-nowrap font-mono tabular-nums">
                    {file.date}
                  </span>
                  {#if file.isActive}
                    <span class="text-[10px] uppercase tracking-widest text-primary font-bold"
                      >{t('Active')}</span
                    >
                  {/if}
                  <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      class="btn btn-xs btn-ghost btn-square hover:text-primary"
                      onclick={(e) => {
                        e.stopPropagation()
                        togglePin(file)
                      }}
                    >
                      <i class="ph-light {file.isPinned ? 'ph-star-fill' : 'ph-star'}"></i>
                    </button>
                    <button
                      class="btn btn-xs btn-ghost btn-square hover:text-base-content"
                      onclick={(e) => {
                        e.stopPropagation()
                        revealInFolder(file)
                      }}
                    >
                      <i class="ph-light ph-folder-open"></i>
                    </button>
                    <button
                      class="btn btn-xs btn-ghost btn-square hover:text-error"
                      onclick={(e) => {
                        e.stopPropagation()
                        removeRecent(file)
                      }}
                    >
                      <i class="ph-light ph-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        </div>

        <footer class="p-4 bg-base-200 border-t border-base-200 flex justify-end">
          <button
            class="btn btn-sm btn-primary px-6 rounded-full font-bold text-[11px] uppercase tracking-widest shadow-lg"
            onclick={handleOpenDocuments}
          >
            {t('Explore Files')}
          </button>
        </footer>
      </main>
    </div>
  </div>
{/if}

<style>
  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
  }
  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    @apply bg-[var(--color-base-300)] rounded-full;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    @apply bg-neutral/20;
  }

  :global(.ph-light) {
    vertical-align: middle;
  }
</style>
