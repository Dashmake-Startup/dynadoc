import { get } from 'svelte/store'
import { _ as base_, locale as svelteLocale } from 'svelte-i18n'
import type { Editor } from '@tiptap/core'
import { DOMSerializer } from 'prosemirror-model'
import { CustomVarExtensionProps } from '../../../../../extensions/tiptap/CustomVarExtension/utils/common.utils'
import { getVariable } from '../../../../../extensions/tiptap/CustomVarExtension/stores/variableManipulator'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import { listMarkerSelectionKey } from '../../../../../extensions/tiptap/CustomListStyleExtension/CustomListStyleExtension'
import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../../../stores/editor.store'
import { _$_canvasCommands } from '../../../../../stores/canvas.store'
import { CustomSlideExtensionProps } from '../../../../../extensions/tiptap/CustomSlideExtension/utils/common.utils'
import { CustomDesignExtensionProps } from '../../../../../extensions/tiptap/CustomDesignExtension/utils/common.utils'
import { CustomSpreadsheetExtensionProps } from '../../../../../extensions/tiptap/CustomSpreadsheetExtension/utils/common.utils'
import type { ChartType } from '../../../../../extensions/tiptap/CustomChartExtension/utils/chartDataBridge'
import { getTableSelectionRange } from '../../../../../extensions/tiptap/CustomExcelTableExtension/utils/chartTableBridge'
import { extensionAttributeNames } from '../../../../../extensions/tiptap/CustomExcelTableExtension/utils/utils'
import { findParentNodeOfType } from '../../../../../extensions/tiptap/tiptap-table-plus/src/utilities/utils'
import type { InsertImageOptions } from '../../../../../extensions/tiptap/CustomImageExtension/CustomImageExtension'
import EditorHelpers from '../../../../../utils/EditorHelpers'
import EditorCommonUtils, { cryptoRandomUUID } from '../../../../../utils/common.utils'
import { DocumentModel } from '../../../../../models/Document'
import { ShapeType } from '../../../../../utils/canvas.utils'
import { openPrimarySearchPane } from '../../../../../stores/search.store'
import { openTextInputModal } from '../../../../../stores/textInputModal.store'
import { openTranslationPickerModal } from '../../../../../stores/translationPickerModal.store'
import { openAlertModal } from '../../../../../stores/alertModal.store'
import { openConfirmModal } from '../../../../../stores/confirmModal.store'
import { openIncludeFromDocumentModal } from '../../../../../stores/includeFromDocumentModal.store'

import { nodeApi } from '../../../../../utils/shims/node'
import { importFileIntoDocumentAssets } from '../../../../../utils/documentAssetImport'
import {
  openConditionalFormattingModal,
  type ConditionalFormattingRule
} from '../../../../../stores/conditionalFormattingModal.store'
import {
  _$_ribbonContext,
  _$_ribbonAutoHidden,
  _$_ribbonUserVisible
} from '../../../../../stores/ribbon.store'
import { _$_wysiwygEditorDynamicReferenceIndexes } from '../../../../../extensions/tiptap/CustomDynamicReferenceNodeExtension/stores/common.store'
import { activeSheet } from '../../../../../stores/sheetBridge.store'
import {
  _$_activeSecondarySidebarItem,
  _$_secondarySidebarVisible
} from '../../../../../stores/common.store'
import { authStore } from '../../../../../stores/auth.store'
import {
  promptAndExportActiveSheet,
  promptAndImportSpreadsheetToActiveSheet,
  openSpreadsheetFileDialog,
  importSpreadsheetFileToActiveSheet,
  waitForSheetReady
} from '../../../../../services/export/spreadsheetExchange.service'
import { openSpreadsheetImportModal } from '../../../../../stores/spreadsheetImportModal.store'
import { CustomAnimationExtensionProps } from '../../../../../extensions/tiptap/CustomAnimationExtension/utils/utils'
import MarkdownIt from 'markdown-it'
import { DOMParser } from 'prosemirror-model'
import { runAIWithResult } from '../../../../../extensions/tiptap/CustomAIExtension/utils/utils'
import { aiGenerationStore } from '../../../../../extensions/tiptap/CustomAIExtension/stores/aiGeneration.store'
import toast from 'svelte-hot-french-toast'
import {
  AI_TRACKING_PLUGIN_KEY,
  getTrackedSelection
} from '../../../../../extensions/tiptap/CustomAIExtension/utils/aiTracking'
import {
  runAIGeneration,
  applyAIGenerationResult,
  type AIGenerationMode
} from '../../../../../extensions/tiptap/CustomAIExtension/utils/aiGeneration'
import {
  deleteVariable,
  setVariable,
  VariableManipulatorUtils,
  listVariables
} from '../../../../../extensions/tiptap/CustomVarExtension/stores/variableManipulator'
import ISO6391 from 'iso-639-1'
import {
  defaultPaginationOptions,
  type PaginationPlusOptions
} from '../../../../../extensions/tiptap/utils/common.utils'
import { v4 as uuidv4 } from 'uuid'

// import {  defaultPaginationOptions } from '../../../../../extensions/tiptap/utils/common.utils'
import { PAGE_SIZES } from 'tiptap-pagination-plus'
import { notifyAiFreePlanNotice } from '../../../../../utils/ai/aiFreePlanNotice'
import { GenericFormattingComponentMap } from '../GenericFormatingComponentMap'
import { startEditorTour, startHomeTour } from '../../../../../lib/tourManager'
import { toAssetUrl, toLocalPath } from '../../../../../utils/assetUrl'
import {
  CustomInternalLinkExtensionProps,
  internalLinkStore
} from '../../../../../extensions/tiptap/CustomInternalLinkExtension'

const t = (key: string) => get(base_)(key)

let lastAnimationType = 'fade-in'

/**
 * FIX: Access active document lazily to avoid circular dependency/initialization errors
 * Resolves the TDZ reference error for _$_documentEditorsList
 */
/* function getActiveDocumentEditor() {
  try {
    // Read the active editor out of the document editors list store dynamically
    const store = get(_$_documentEditorsList);
    return store?.getActive?.() || store?.active || null;
  } catch (error) {
    console.error('[GenericFormattingCommands] Failed to lazily get active document editor:', error);
    return null;
  }
} */

export type CommandEntry = {
  id: string
  title: string
  subtitle?: string
  tags: string[]
  hotkey?: string
  action: () => void | Promise<void>
}

function getActiveRootPath() {
  const activeDoc = getActiveDocumentEditor()?.document
  if (!activeDoc) return ''

  if (activeDoc.cachePath) return activeDoc.cachePath
  if (activeDoc.path) return nodeApi.path.dirname(activeDoc.path)
  return ''
}
function getActiveMainPath() {
  const activeDoc = getActiveDocumentEditor()?.document
  if (!activeDoc) return null
  try {
    return activeDoc.getMainFilePath?.() || activeDoc.path || null
  } catch {
    return activeDoc.path || null
  }
}

export function baseCommands(): CommandEntry[] {
  const activeRoot = getActiveRootPath()

  return [
    {
      id: 'cmd:tour-home',
      title: 'Help: Home Onboarding Tour',
      subtitle: 'Highlights theme and creating a document',
      tags: ['help', 'tour', 'onboarding', 'home'],
      action: () => {
        startHomeTour()
      }
    },
    {
      id: 'cmd:tour-editor',
      title: 'Help: Editor Onboarding Tour',
      subtitle: 'Highlights ribbon, styles, and dev tools',
      tags: ['help', 'tour', 'onboarding', 'editor'],
      action: () => {
        startEditorTour()
      }
    },
    {
      id: 'cmd:reload-window',
      title: 'Developer: Reload Window',
      subtitle: 'Reload the Electron renderer window',
      tags: ['reload', 'window', 'developer'],
      hotkey: 'CmdOrCtrl+R',
      action: () => window.location.reload()
    },
    {
      id: 'cmd:new-document',
      title: 'File: New Document',
      subtitle: 'Create a new document tab',
      tags: ['file', 'new', 'document'],
      hotkey: 'CmdOrCtrl+N',
      action: async () => {
        await EditorCommonUtils.addNewDocumentEditor(null, getActiveMainPath())
      }
    },
    {
      id: 'cmd:open-file-dialog',
      title: 'File: Open File...',
      subtitle: 'Open a file from disk or upload on web/mobile',
      tags: ['file', 'open', 'dialog'],
      hotkey: 'CmdOrCtrl+O',
      action: async () => {
        const filePath = await window.api.openDialogFile()
        if (!filePath) return
        await EditorCommonUtils.openDocumentFromInput(filePath, {
          parentPath: getActiveMainPath()
        })
      }
    },
    {
      id: 'cmd:open-storage-dir',
      title: 'System: Open App Storage Folder',
      subtitle: 'Reveal the app storage directory',
      tags: ['system', 'storage', 'folder'],
      action: async () => {
        const storagePath = await window.api.getStorageDir()
        if (!storagePath) return
        await window.api.openFile(storagePath)
      }
    },
    {
      id: 'cmd:search-current-workspace',
      title: 'Search: Find in Active Document Workspace',
      subtitle: 'Open the Search sidebar scoped to active document',
      tags: ['search', 'find', 'replace', 'workspace'],
      hotkey: 'CmdOrCtrl+Shift+F',
      action: () => {
        const scopePath = activeRoot || null
        openPrimarySearchPane({
          mode: 'text',
          scopePath,
          scopeType: 'workspace',
          sourcePath: getActiveMainPath(),
          autoFocus: true
        })
      }
    },
    {
      id: 'cmd:insert-code-block',
      title: 'Insert: Code Block (Monaco)',
      subtitle: 'Insert a Monaco code editor block',
      tags: ['insert', 'code', 'monaco', 'editor', 'block'],
      action: () => GenericFormatingEditorCommands.insertMonacoCodeBlock()
    },
    {
      id: 'cmd:include-file',
      title: 'Insert: Include File (Sync)',
      subtitle: 'Insert a live include that auto-syncs with the source file',
      tags: ['insert', 'include', 'sync', 'file'],
      action: () => GenericFormatingEditorCommands.includeFile()
    },
    {
      id: 'cmd:append-file',
      title: 'Insert: Append File (Static)',
      subtitle: 'Append file content as static text',
      tags: ['insert', 'append', 'static', 'file'],
      action: () => GenericFormatingEditorCommands.appendFile()
    },
    {
      id: 'cmd:include-file-clipboard',
      title: 'Insert: Include From Clipboard',
      subtitle: 'Include file from clipboard path',
      tags: ['insert', 'include', 'clipboard', 'file'],
      action: () => GenericFormatingEditorCommands.includeFileFromClipboard()
    },
    {
      id: 'cmd:append-file-clipboard',
      title: 'Insert: Append From Clipboard',
      subtitle: 'Append file from clipboard path',
      tags: ['insert', 'append', 'clipboard', 'file'],
      action: () => GenericFormatingEditorCommands.appendFileFromClipboard()
    }
  ]
}

export function formattingCommandsFromMap(): CommandEntry[] {
  const sink: CommandEntry[] = []
  const seen = new Set<string>()

  for (const [mapKey, entry] of Object.entries(GenericFormattingComponentMap)) {
    let props: any = null
    try {
      props = typeof entry.props === 'function' ? entry.props({}) : entry.props
    } catch {
      props = null
    }
    if (!props) continue

    const label = normalizeCommandLabel(toSafeLabel(props.__label))
    if (!shouldSkipLabel(label) && typeof props.__onClick === 'function') {
      const key = `${mapKey}:${label.toLowerCase()}`
      if (!seen.has(key)) {
        seen.add(key)
        sink.push({
          id: `fmt:${mapKey}`,
          title: `Format: ${label}`,
          subtitle: `Formatting command (${mapKey})`,
          tags: ['formatting', 'tiptap', mapKey.toLowerCase(), label.toLowerCase()],
          hotkey: props.__keybinding,
          action: () => props.__onClick?.()
        })
      }
    }

    if (Array.isArray(props.__selectData)) {
      walkSelectData(props.__selectData, label || mapKey, mapKey, sink)
    }

    const nestedItems = props.__selectDataProps?.__items
    if (Array.isArray(nestedItems)) {
      walkSelectData(nestedItems, label || mapKey, mapKey, sink)
    }
  }

  return sink
}

export function getCommandPaletteItems(): CommandEntry[] {
  return [...baseCommands(), ...formattingCommandsFromMap()]
}

function toSafeLabel(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeCommandLabel(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function shouldSkipLabel(label: string) {
  if (!label) return true
  if (/^[-\s]{2,}$/.test(label)) return true
  return false
}
function walkSelectData(
  source: any[],
  parentTitle: string,
  commandBaseId: string,
  sink: CommandEntry[]
) {
  for (let index = 0; index < source.length; index += 1) {
    const item = source[index]
    if (!item || item.__separator) continue

    const label = normalizeCommandLabel(toSafeLabel(item.__label))
    if (!shouldSkipLabel(label) && typeof item.__onClick === 'function') {
      sink.push({
        id: `fmt:${commandBaseId}:select:${index}:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title: `${parentTitle}: ${label}`,
        subtitle: 'Formatting command',
        tags: ['formatting', parentTitle.toLowerCase(), label.toLowerCase()],
        hotkey: item.__keybinding,
        action: () => item.__onClick?.()
      })
    }

    if (Array.isArray(item.__items)) {
      walkSelectData(item.__items, parentTitle, `${commandBaseId}-nested-${index}`, sink)
    }
  }
}

/**
 * Execute a TipTap command on the currently active editor.
 */
export function executeEditorCommand(commandName: string, ...args: any): boolean {
  // getActiveEntry() resolves via document store, no editor focus required
  let activeWysiwyg =
    _$_wysiwygEditorsList.getActiveEntry() ??
    (get(_$_wysiwygEditorsList.getActive()) as typeof activeWysiwyg)
  console.log('[executeEditorCommand]', commandName, '| activeWysiwyg:', activeWysiwyg)
  if (!activeWysiwyg) {
    console.warn('[executeEditorCommand] No active WYSIWYG editor found')
    return false
  }
  const editor: Editor = activeWysiwyg.editor
  if (!editor) {
    console.warn('[executeEditorCommand] activeWysiwyg has no editor instance')
    return false
  }

  const activeNodeview = _$_wysiwygEditorsList.getActiveNodeview(activeWysiwyg.id)
  if (activeNodeview) {
    switch (activeNodeview.type) {
      case CustomSlideExtensionProps.name:
      case CustomDesignExtensionProps.name:
        if (applyCommandToSelectedShapes(activeNodeview.id, commandName, args)) {
          return true
        }
        _$_canvasCommands.executeCommand(activeNodeview.id, commandName, ...args)
        return true
      default:
        // Inline document text may be inside another nodeview. Let its TipTap
        // mark command continue to the active editor rather than swallowing it.
        break
    }
  }

  const chain = editor.chain().focus()

  if (typeof chain[commandName] === 'function') {
    console.log(`executing command : ${commandName}`, { commandName, args })

    const success = chain[commandName](...args).run()
    if (!success) {
      console.warn(`executing command Command ${commandName} was recognized but failed to execute.`)
    }
    return success
  }

  console.warn(`executing command Unknown or unsupported command: ${commandName}`)
  return false
}

const slideBatchCommands = new Set([
  'toggleBold',
  'toggleItalic',
  'toggleUnderline',
  'toggleStrike',
  'toggleCode',
  'toggleSuperscript',
  'toggleSubscript',
  'setColor',
  'setHighlight',
  'unsetHighlight',
  'setFontSize',
  'increaseFontSize',
  'decreaseFontSize',
  'setFontFamily',
  'unsetFontFamily',
  'setTextAlign',
  'setLineSpacing',
  'indent',
  'outdent'
])

function applyCommandToSelectedShapes(
  nodeviewId: string,
  commandName: string,
  args: any[]
): boolean {
  if (!slideBatchCommands.has(commandName)) return false
  const canvas = _$_canvasCommands.get(nodeviewId)
  const selectedIds = canvas?.getSelectedIds?.() ?? []
  if (selectedIds.length === 0) return false

  selectedIds.forEach((id) => {
    const shapeEditor = _$_wysiwygEditorsList.getItem(id)
    if (!shapeEditor) return
    const chain = shapeEditor.chain().focus()
    if (!shapeEditor.isFocused) {
      chain.selectAll()
    }
    const command = (chain as any)[commandName]
    if (typeof command === 'function') {
      command(...args).run()
    }
  })
  return true
}

function getActiveEditorInstance(): Editor | undefined {
  const activeEntry = _$_wysiwygEditorsList.getActiveEntry?.()
  if (activeEntry?.editor) return activeEntry.editor

  const activeWysiwyg = get(_$_wysiwygEditorsList.getActive())
  if (activeWysiwyg?.editor) return activeWysiwyg.editor

  const fallback = _$_wysiwygEditorsList.getActive2?.()
  if (fallback) return fallback

  const activeDoc = _$_documentEditorsList.getActiveSync()
  if (!activeDoc?.id) return undefined
  return _$_wysiwygEditorsList.getItem(activeDoc.id)
}

function moveSelectionAfterNode(editor: Editor | undefined, nodeTypeName: string): boolean {
  if (!editor) return false
  const type = editor.schema.nodes?.[nodeTypeName]
  if (!type) return false
  const state = editor.state
  const from = state.selection.from
  const to = state.selection.to
  const found = findParentNodeOfType(state, from, type) || findParentNodeOfType(state, to, type)
  if (!found?.node) return false
  const afterPos = Math.min(state.doc.content.size, found.pos + found.node.nodeSize)
  const tr = state.tr.setSelection(TextSelection.create(state.doc, afterPos))
  editor.view.dispatch(tr)
  return true
}

function moveSelectionBeforeNode(editor: Editor | undefined, nodeTypeName: string): boolean {
  if (!editor) return false
  const type = editor.schema.nodes?.[nodeTypeName]
  if (!type) return false
  const state = editor.state
  const from = state.selection.from
  const to = state.selection.to
  const found = findParentNodeOfType(state, from, type) || findParentNodeOfType(state, to, type)
  if (!found?.node) return false
  const beforePos = Math.max(0, found.pos)
  const tr = state.tr.setSelection(TextSelection.create(state.doc, beforePos))
  editor.view.dispatch(tr)
  return true
}

function insertBlankParagraph(editor: Editor | undefined): boolean {
  if (!editor) return false
  if (!editor.schema.nodes?.paragraph) return false
  editor.chain().focus().insertContent({ type: 'paragraph' }).run()
  return true
}

function insertChartAt(
  editor: Editor,
  pos: number,
  attrs: Record<string, any>,
  placement: 'above' | 'below' | 'after'
): boolean {
  const chartNode = { type: 'chart', attrs }
  if (placement === 'above') {
    return editor
      .chain()
      .focus()
      .insertContentAt(pos, [chartNode, { type: 'paragraph' }])
      .run()
  }
  if (placement === 'below') {
    return editor
      .chain()
      .focus()
      .insertContentAt(pos, [{ type: 'paragraph' }, chartNode])
      .run()
  }
  return editor.chain().focus().insertContentAt(pos, chartNode).run()
}

function findSheetNodeBySourcePath(editor: Editor, sourcePath: string) {
  let found: { pos: number; node: any } | null = null
  editor.state.doc.descendants((node, pos) => {
    if (found) return false
    if (node.type?.name !== CustomSpreadsheetExtensionProps.name) return true
    const nodeSrc = node.attrs?.src || node.attrs?.[CustomSpreadsheetExtensionProps.tagAttributeSrc]
    if (nodeSrc && sourcePath && nodeSrc === sourcePath) {
      found = { pos, node }
      return false
    }
    return true
  })
  return found
}

function findSheetNodeById(editor: Editor, id: string) {
  let found: { pos: number; node: any } | null = null
  editor.state.doc.descendants((node, pos) => {
    if (found) return false
    if (node.type?.name !== CustomSpreadsheetExtensionProps.name) return true
    if (node.attrs?.id && node.attrs.id === id) {
      found = { pos, node }
      return false
    }
    return true
  })
  return found
}

async function waitForSheetNode(editor: Editor, id: string, timeoutMs = 10000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const found = findSheetNodeById(editor, id)
    if (found?.node) return found
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  return null
}

function buildSampleTableNode(tableId: string, sheetName: string) {
  const cell = (text: string, isHeader = false) => ({
    type: isHeader ? 'tableHeader' : 'tableCell',
    content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }]
  })
  return {
    type: 'table',
    attrs: {
      [EditorHelpers.uuidAttributeName]: tableId,
      [extensionAttributeNames.sheet]: sheetName
    },
    content: [
      {
        type: 'tableRow',
        content: [cell('Month', true), cell('North', true), cell('South', true)]
      },
      { type: 'tableRow', content: [cell('Jan'), cell('120'), cell('95')] },
      { type: 'tableRow', content: [cell('Feb'), cell('140'), cell('110')] },
      { type: 'tableRow', content: [cell('Mar'), cell('160'), cell('130')] }
    ]
  }
}

function getActiveDocumentEditor() {
  return _$_documentEditorsList.getActiveSync?.() ?? get(_$_documentEditorsList.getActive())
}

function getActivePaginationOptions() {
  return _$_wysiwygEditorsList.getActiveEditorPaginationOptions?.() ?? null
}

const PX_PER_INCH = 96

const PAGE_SIZE_LOOKUP = {
  A4: PAGE_SIZES.A4,
  A3: PAGE_SIZES.A3,
  A5: PAGE_SIZES.A5,
  LETTER: PAGE_SIZES.LETTER,
  LEGAL: PAGE_SIZES.LEGAL,
  TABLOID: PAGE_SIZES.TABLOID
}

const PAGE_MARGIN_PRESETS = {
  normal: {
    top: 1 * PX_PER_INCH,
    bottom: 1 * PX_PER_INCH,
    left: 1 * PX_PER_INCH,
    right: 1 * PX_PER_INCH
  },
  narrow: {
    top: 0.5 * PX_PER_INCH,
    bottom: 0.5 * PX_PER_INCH,
    left: 0.5 * PX_PER_INCH,
    right: 0.5 * PX_PER_INCH
  },
  wide: {
    top: 1 * PX_PER_INCH,
    bottom: 1 * PX_PER_INCH,
    left: 2 * PX_PER_INCH,
    right: 2 * PX_PER_INCH
  }
}

const getActiveEditorId = () => {
  const activeEntry = _$_wysiwygEditorsList.getActiveEntry?.()
  if (activeEntry?.id) return activeEntry.id.toString()
  const activeStore = _$_wysiwygEditorsList.getActive?.()
  const active = activeStore ? get(activeStore) : null
  if (active?.id) return active.id.toString()
  const activeDoc =
    _$_documentEditorsList.getActiveSync?.() ?? get(_$_documentEditorsList.getActive())
  return activeDoc?.id?.toString() ?? null
}

const updatePaginationOptionsInStores = (patch: Partial<PaginationPlusOptions>) => {
  const editorId = getActiveEditorId()
  if (!editorId) return
  // _$_ribbonAutoHidden.set(false)
  // _$_ribbonUserVisible.set(true)
  const current =
    _$_wysiwygEditorsList.getPaginationOptions?.(editorId) ??
    getActivePaginationOptions() ??
    ({ ...defaultPaginationOptions } as PaginationPlusOptions)
  const next = { ...current, ...patch }
  _$_wysiwygEditorsList.setPaginationOptions(editorId, next)
  _$_documentEditorsList.updateDocumentConfig(editorId, (doc) => {
    doc.config.pagination = {
      ...(doc.config.pagination || {}),
      ...patch
    }
  })

  /* const activeEditor = getActiveEditorInstance()
  if (activeEditor?.storage?.PaginationPlus) {
    ;(activeEditor.storage.PaginationPlus as any)._forceRecalc =
      ((activeEditor.storage.PaginationPlus as any)._forceRecalc ?? 0) + 1
    activeEditor.commands?.updatePagination?.(
      activeEditor.storage.PaginationPlus.enabled ?? true
    )
  } else if (activeEditor?.view) {
    activeEditor.view.dispatch(activeEditor.state.tr)
  } */
}

function emitEditorUiEvent(name: string, detail: Record<string, any> = {}) {
  if (typeof window === 'undefined') return false
  window.dispatchEvent(new CustomEvent(name, { detail }))
  return true
}

async function insertImageFromDeviceInternal(options: InsertImageOptions = { src: '' }) {
  if (getActiveSheetMethods()) return false
  const result = await window.api.openDialogFile()
  if (!result) return false
  const imported = await importFileIntoDocumentAssets(result, {
    preferredAssetType: DocumentModel.AssetType.IMG
  })
  options.src = EditorHelpers.toFileUrl(imported)
  executeEditorCommand('insertFile', imported)
  return true
}

const POSITIONABLE_NODE_TYPES = new Set([
  CustomSlideExtensionProps.name,
  CustomDesignExtensionProps.name,
  CustomSpreadsheetExtensionProps.name
])

type PositionableNodeTarget = {
  editor: Editor
  node: any
  pos: number
  type: string
}

function resolvePositionableNodeTarget(editor?: Editor): PositionableNodeTarget | null {
  const activeEditor = editor ?? getActiveEditorInstance()
  if (!activeEditor) return null

  const { selection } = activeEditor.state
  if (selection instanceof NodeSelection) {
    const nodeType = selection.node?.type?.name
    if (nodeType && POSITIONABLE_NODE_TYPES.has(nodeType)) {
      return { editor: activeEditor, node: selection.node, pos: selection.from, type: nodeType }
    }
  }

  const activeNodeview = _$_wysiwygEditorsList.getActiveNodeviewOfActiveEditor?.()
  if (
    activeNodeview?.id &&
    activeNodeview?.type &&
    POSITIONABLE_NODE_TYPES.has(activeNodeview.type)
  ) {
    let found: PositionableNodeTarget | null = null
    activeEditor.state.doc.descendants((node, pos) => {
      if (node?.type?.name !== activeNodeview.type) return true
      if (node?.attrs?.id !== activeNodeview.id) return true
      found = { editor: activeEditor, node, pos, type: node.type.name }
      return false
    })
    if (found) return found
  }

  return null
}

function updateActiveNodeviewAttrs(attrs: Record<string, any>): boolean {
  const target = resolvePositionableNodeTarget()
  if (!target) return false
  const nextAttrs = { ...(target.node?.attrs || {}), ...(attrs || {}) }
  const tr = target.editor.state.tr.setNodeMarkup(target.pos, undefined, nextAttrs)
  if (!tr.docChanged) return false
  target.editor.view.dispatch(tr)
  return true
}

function getActiveNodeviewLayout(): string | null {
  const target = resolvePositionableNodeTarget()
  if (!target) return null
  return target.node?.attrs?.layout ?? 'inline'
}

function getActivePositionableType(): string | null {
  const target = resolvePositionableNodeTarget()
  if (!target) return null
  return target.type ?? null
}

function runAnimationPreview() {
  const editor = getActiveEditorInstance()
  if (!editor) return false
  const targets = editor.view.dom.querySelectorAll<HTMLElement>('.animate-target')
  if (!targets.length) return false
  targets.forEach((target) => target.classList.add('animate-preview'))
  window.setTimeout(() => {
    targets.forEach((target) => target.classList.remove('animate-preview'))
  }, 700)
  return true
}

function updateActiveDocumentConfig(updateFn: (doc: any) => void) {
  const active = _$_documentEditorsList.getActiveSync?.()
  if (!active?.id) return
  _$_documentEditorsList.updateDocumentConfig(active.id, updateFn)
}

function getActiveReviewFilters(): { authors?: string[] | null; modes?: string[] | null } {
  const doc = getActiveDocumentEditor()?.document
  const settings = doc?.config?.reviewSettings || {}
  return {
    authors: settings.filterAuthors ?? null,
    modes: settings.filterModes ?? null
  }
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true
})

function replaceSelectionWithHtml(editor: Editor, html: string) {
  const { from, to } = editor.state.selection
  const element = document.createElement('div')
  element.innerHTML = html
  const content = DOMParser.fromSchema(editor.state.schema).parse(element).content
  const tr = editor.state.tr.replaceWith(from, to, content)
  editor.view.dispatch(tr)
}

function getSelectionText(editor: Editor) {
  const { from, to } = editor.state.selection
  if (from === to) return ''
  return editor.state.doc.textBetween(from, to, '\n').trim()
}

function moveCursorOutsideSelection(editor: Editor) {
  const { from, to } = editor.state.selection
  if (from === to) return
  const docSize = editor.state.doc.content.size
  let pos = to + 1
  if (pos > docSize) pos = from - 1
  if (pos < 1) pos = docSize
  if (pos < 1) return
  editor.commands.setTextSelection(pos)
}

function findTableAtSelection(editor: Editor): { node: any; pos: number } | null {
  const from = editor.state.selection.$from
  for (let depth = from.depth; depth > 0; depth--) {
    const node = from.node(depth)
    if (node?.type?.name === 'table') {
      const pos = from.before(depth)
      return { node, pos }
    }
  }
  return null
}

function findImageAtSelection(editor: Editor): { node: any; pos: number } | null {
  const from = editor.state.selection.$from
  for (let depth = from.depth; depth > 0; depth--) {
    const node = from.node(depth)
    if (node?.type?.name === 'img') {
      const pos = from.before(depth)
      return { node, pos }
    }
  }
  if (editor.state.selection instanceof NodeSelection) {
    const node = editor.state.selection.node
    if (node?.type?.name === 'img') {
      return { node, pos: editor.state.selection.from }
    }
  }
  return null
}

function updateTableAttrs(attrs: Record<string, any>): boolean {
  const editor = getActiveEditorInstance()
  if (!editor) return false
  const target = findTableAtSelection(editor)
  if (!target) {
    toast.error(t('Please place the cursor inside a table.'))
    return false
  }
  const nextAttrs = { ...(target.node?.attrs || {}), ...attrs }
  const tr = editor.state.tr.setNodeMarkup(target.pos, undefined, nextAttrs)
  if (!tr.docChanged) return false
  editor.view.dispatch(tr)
  return true
}

function updateImageAttrs(attrs: Record<string, any>): boolean {
  const editor = getActiveEditorInstance()
  if (!editor) return false
  const target = findImageAtSelection(editor)
  if (!target) {
    toast.error(t('Please select an image.'))
    return false
  }
  const nextAttrs = { ...(target.node?.attrs || {}), ...attrs }
  const tr = editor.state.tr.setNodeMarkup(target.pos, undefined, nextAttrs)
  if (!tr.docChanged) return false
  editor.view.dispatch(tr)
  return true
}

function getActiveCanvasCommands() {
  const activeNodeview = _$_wysiwygEditorsList.getActiveNodeviewOfActiveEditor?.()
  if (!activeNodeview?.id) return null
  return _$_canvasCommands.get(activeNodeview.id)
}

function updateSelectedShapes(props: Record<string, any>): boolean {
  const canvas = getActiveCanvasCommands()
  if (!canvas) return false
  const ids = canvas.getSelectedIds?.() ?? []
  if (!ids.length) return false
  ids.forEach((id) => canvas.updateShape?.(id, props))
  return true
}

function updateSelectedShapeAnimation(
  patch: Record<string, any> | null,
  options?: { clear?: boolean }
): boolean {
  const canvas = getActiveCanvasCommands()
  if (!canvas) return false
  const ids = canvas.getSelectedIds?.() ?? []
  if (!ids.length) return false
  ids.forEach((id) => {
    const shape = canvas.getShape?.(id)
    const current = shape?.animation && typeof shape.animation === 'object' ? shape.animation : {}
    const next = options?.clear ? null : { ...current, ...(patch || {}) }
    canvas.updateShape?.(id, { animation: next })
  })
  return true
}

function updateSlideAttrs(attrs: Record<string, any>): boolean {
  const editor = getActiveEditorInstance()
  if (!editor) return false
  const target = resolvePositionableNodeTarget(editor)
  if (!target || target.type !== CustomSlideExtensionProps.name) {
    toast.error(t('Please select a slide.'))
    return false
  }
  const nextAttrs = { ...(target.node?.attrs || {}), ...attrs }
  const tr = editor.state.tr.setNodeMarkup(target.pos, undefined, nextAttrs)
  if (!tr.docChanged) return false
  editor.view.dispatch(tr)
  return true
}

function resolveTargetLanguage() {
  const activeTranslation = _$_documentEditorsList.getActiveTranslationSync?.()
  const locale = activeTranslation?.language || get(svelteLocale) || 'en'
  const base = locale.split(/[-_]/)[0]
  const name = ISO6391.getName(base) || ISO6391.getNativeName(base)
  return name ? `${name}` : locale
}

function hasActiveSelection(): boolean {
  const editor = getActiveEditorInstance()
  if (!editor) return false
  const { from, to } = editor.state.selection
  return from !== to
}

function resolvePaginationPageHeight(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((item) => item.name === 'PaginationPlus')
  const extPageHeight = (ext as any)?.options?.pageHeight
  if (typeof extPageHeight === 'number' && Number.isFinite(extPageHeight)) return extPageHeight
  const activeDoc = getActiveDocumentEditor()
  const docHeight = activeDoc?.document?.config?.pagination?.pageHeight
  if (typeof docHeight === 'number' && Number.isFinite(docHeight)) return docHeight
  return 1000
}

function getPaginationRemainingSpace(editor: Editor) {
  const editorEl = editor.view?.dom as HTMLElement | null
  if (!editorEl) return { remaining: 0, pageHeight: resolvePaginationPageHeight(editor) }

  const pageHeight = resolvePaginationPageHeight(editor)
  const pageEls = Array.from(editorEl.querySelectorAll<HTMLElement>('.rm-page-break .page'))
  if (!pageEls.length) return { remaining: pageHeight, pageHeight }

  const pageBreaks = pageEls.map((el) => el.offsetTop)
  const coords = editor.view.coordsAtPos(editor.state.selection.from)
  const editorRect = editorEl.getBoundingClientRect()
  const cursorTop = coords.top - editorRect.top + editorEl.scrollTop

  let pageIndex = pageBreaks.findIndex((top) => cursorTop < top)
  if (pageIndex === -1) pageIndex = pageBreaks.length

  const pageStart = pageIndex === 0 ? 0 : pageBreaks[pageIndex - 1]
  const pageEnd = pageIndex < pageBreaks.length ? pageBreaks[pageIndex] : pageStart + pageHeight
  const remaining = Math.max(0, pageEnd - cursorTop)
  return { remaining, pageHeight }
}

function getSelectedVariableNode(editor: Editor) {
  const { selection } = editor.state
  if (
    selection instanceof NodeSelection &&
    selection.node?.type?.name === CustomVarExtensionProps.name
  ) {
    return { node: selection.node, pos: selection.from }
  }

  const _pos = editor.state.doc.resolve(selection.from)
  const after = _pos.nodeAfter
  if (after?.type?.name === CustomVarExtensionProps.name) {
    return { node: after, pos: _pos.pos }
  }

  const before = _pos.nodeBefore
  if (before?.type?.name === CustomVarExtensionProps.name) {
    return { node: before, pos: _pos.pos - before.nodeSize }
  }

  return null
}

function hasVariableSelection(): boolean {
  const editor = getActiveEditorInstance()
  if (!editor) return false
  return !!getSelectedVariableNode(editor)
}

function normalizeVariableName(
  rawName: string | null | undefined,
  fallback: string,
  selectedText: string
) {
  let name = (rawName ?? '').trim()
  if (!name) name = fallback
  name = name.trim().replace(/\s+/g, '_')
  if (!name) return null
  if (name === selectedText) {
    const suffix = Math.random().toString(36).slice(2, 6)
    name = `${name}_${suffix}`
  }
  return name
}

function replaceVariableNodesByName(
  editor: Editor,
  variableName: string,
  replaceWith: (node: any) => string
) {
  const matches: { pos: number; node: any }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type?.name !== CustomVarExtensionProps.name) return true
    if (node.attrs?.[CustomVarExtensionProps.tagAttributeName] !== variableName) return true
    matches.push({ node, pos })
    return true
  })

  if (!matches.length) return false
  const tr = editor.state.tr
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const { node, pos } = matches[i]
    const text = replaceWith(node)
    if (!text) {
      tr.delete(pos, pos + node.nodeSize)
    } else {
      tr.replaceWith(pos, pos + node.nodeSize, editor.state.schema.text(text))
    }
  }

  if (tr.docChanged) {
    editor.view.dispatch(tr.scrollIntoView())
  }
  return tr.docChanged
}

function replaceAllOccurrencesWithVariable(
  editor: Editor,
  targetText: string,
  variableName: string
) {
  const nodeType = editor.state.schema.nodes[CustomVarExtensionProps.name]
  if (!nodeType) return false

  const matches: { from: number; to: number }[] = []
  editor.state.doc.descendants((node, pos, parent) => {
    if (!node.isText || !node.text) return true
    if (parent?.type?.name === CustomVarExtensionProps.name) return false
    if (parent?.type?.name === 'codeBlock' || parent?.type?.name === 'code') return false

    let idx = node.text.indexOf(targetText)
    while (idx !== -1) {
      matches.push({ from: pos + idx, to: pos + idx + targetText.length })
      idx = node.text.indexOf(targetText, idx + targetText.length)
    }
    return true
  })

  if (!matches.length) return false
  const tr = editor.state.tr
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const { from, to } = matches[i]
    const varNode = nodeType.create({
      [CustomVarExtensionProps.tagAttributeName]: variableName,
      [CustomVarExtensionProps.tagAttributeValue]: targetText
    })
    tr.replaceRangeWith(from, to, varNode)
  }
  if (tr.docChanged) {
    editor.view.dispatch(tr.scrollIntoView())
  }
  return tr.docChanged
}

const VAR_INLINE_REGEX = /\{\{var:([^|}]+)\|([^|}]*)?(?:\|([^}]*))?\}\}/g
const VAR_REF_REGEX = /\{var:([^}]+)\}/g

const inferVarFormat = (value: string) => {
  const raw = String(value || '').trim()
  if (!raw) return undefined
  if (/[%]$/.test(raw)) return VariableManipulatorUtils.EXCEL_FORMATS.PERCENT_DEC
  if (/^\$[\d,]+(\.\d+)?$/.test(raw)) return VariableManipulatorUtils.EXCEL_FORMATS.CURRENCY_USD
  if (/^[€£¥][\d,]+(\.\d+)?$/.test(raw)) return VariableManipulatorUtils.EXCEL_FORMATS.CURRENCY_EUR
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return VariableManipulatorUtils.EXCEL_FORMATS.DATE_ISO
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw))
    return VariableManipulatorUtils.EXCEL_FORMATS.DATE_SHORT
  if (/^\d{1,2}:\d{2}(:\d{2})?\s?(AM|PM)?$/i.test(raw))
    return VariableManipulatorUtils.EXCEL_FORMATS.TIME_12H
  return undefined
}

const normalizeVarKey = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const findCloseMatch = (desired: string, existing: Map<string, string>) => {
  const desiredKey = normalizeVarKey(desired)
  if (!desiredKey) return undefined
  for (const [key, name] of existing.entries()) {
    const existingKey = normalizeVarKey(key)
    if (!existingKey) continue
    if (existingKey === desiredKey) return name
    if (existingKey.startsWith(desiredKey) || desiredKey.startsWith(existingKey)) return name
  }
  return undefined
}

function normalizeVariableToken(text: string) {
  if (!text) return ''
  return text
    .replace(VAR_INLINE_REGEX, (_match, rawName) => `{${String(rawName || '').trim()}}`)
    .replace(VAR_REF_REGEX, (_match, rawName) => `{${String(rawName || '').trim()}}`)
}

const extractVarUsages = (text: string) => {
  const usage = new Set<string>()
  const regex = /\{([^}]+)\}/g
  let match = regex.exec(text || '')
  while (match) {
    const name = String(match[1] || '').trim()
    if (name) usage.add(name)
    match = regex.exec(text || '')
  }
  return usage
}

const hasVarRef = (text: string) => /\{var:[^}]+\}/.test(text || '')

const getVarsNamesFromBlock = (vars: any[] | null) => {
  const names = new Set<string>()
  if (!Array.isArray(vars)) return names
  vars.forEach((spec) => {
    const name = String(spec?.name || '').trim()
    if (name) names.add(name)
  })
  return names
}

const shouldRequestVarsBlock = (text: string, vars: any[] | null) => {
  if (!hasVarRef(text)) return false
  if (!vars) return true
  const usageSet = extractVarUsages(normalizeVariableToken(text || ''))
  const varNames = getVarsNamesFromBlock(vars)
  for (const name of usageSet) {
    if (!varNames.has(name)) return true
  }
  return false
}

const buildVarsCorrectionPrompt = (rawText: string) =>
  `
TASK: Fix missing vars block.
RULES:
1) Return ONLY the text below, unchanged, plus a single JSON vars line appended at the END.
2) Do NOT add explanations, labels, or code fences.
3) Do NOT use @var or @vars syntax. Use {var:Name} only.
4) JSON line format: {"vars":[{"name":"Name","value":"Value","format":""}]}

USER_TEXT:
${rawText}
`.trim()

const normalizeAiVarSyntax = (text: string) => {
  if (!text) return ''
  let next = text
    .replace(/@vars?:/gi, '{var:')
    .replace(/@\s*\"vars\"\s*:/gi, '{"vars":')
    .replace(/@\s*vars\s*:/gi, '{"vars":')
    .replace(/@\s*\{/g, '{')
    .replace(/\bvars\s*\[/gi, '{"vars":[')
    .replace(/\bvars\s*:\s*\[/gi, '{"vars":[')
    .replace(/```json|```/gi, '')
    // Fix missing closing brace in inline var usage: "{var:Name" -> "{var:Name}"
    .replace(/\{var:([^}\s"']+)(?=$|\s|["'.,;:!?])/g, '{var:$1}')
    // Fix broken var markers like "{var:Name" inside vars JSON names
    .replace(/"name"\s*:\s*"\{var:([^"}]+)"/gi, '"name":"$1"')
    .replace(/"name"\s*:\s*"@var:([^"}]+)"/gi, '"name":"$1"')
    // Remove stray "{var:" from name values without closing brace
    .replace(/"name"\s*:\s*"\{var:([^"}]+)"/gi, '"name":"$1"')
    // Normalize any "@var:Name" mentions to "{var:Name}"
    .replace(/@var:([A-Za-z0-9_-]+)/gi, '{var:$1}')
    // Ensure JSON blocks start cleanly
    .replace(/@\s*\{/g, '{')
  return next
}

function applyVariablesFromText(text: string, documentEditor: any) {
  if (!text || !documentEditor) return { text, created: 0, createdNames: [] as string[] }
  const existingVars = listVariables([], documentEditor)
  const nameMap = new Map<string, string>()
  const valueMap = new Map<string, string>()
  existingVars.forEach((v) => {
    const name = String(v?.rawValue?.name || v?.name || '').trim()
    if (name) nameMap.set(name.toLowerCase(), name)
    const value = String(v?.rawValue?.value ?? v?.value ?? '').trim()
    if (value) valueMap.set(value.toLowerCase(), name)
  })
  let created = 0
  const createdNames: string[] = []
  let updatedText = text
  updatedText = updatedText.replace(VAR_INLINE_REGEX, (_match, rawName, rawValue, rawFormat) => {
    const desiredName = normalizeVariableName(
      String(rawName || ''),
      String(rawName || '').trim(),
      String(rawValue || '').trim()
    )
    if (!desiredName) return ''
    const value = String(rawValue || '').trim()
    const format = String(rawFormat || '').trim()
    const existingByName = nameMap.get(desiredName.toLowerCase())
    if (existingByName) return `{${existingByName}}`
    const closeByName = findCloseMatch(desiredName, nameMap)
    if (closeByName) return `{${closeByName}}`
    const existingByValue = value ? valueMap.get(value.toLowerCase()) : undefined
    if (existingByValue) return `{${existingByValue}}`
    const payload = {
      type: VariableManipulatorUtils.VAR_TYPE.text,
      value: value || desiredName,
      format: format || inferVarFormat(value),
      source: 'ai',
      generatedAt: new Date().toISOString()
    }
    setVariable(desiredName, payload, documentEditor)
    created += 1
    createdNames.push(desiredName)
    nameMap.set(desiredName.toLowerCase(), desiredName)
    if (value) valueMap.set(value.toLowerCase(), desiredName)
    return `{${desiredName}}`
  })
  updatedText = normalizeVariableToken(updatedText)
  return { text: updatedText, created, createdNames }
}

const extractVarsBlock = (text: string) => {
  if (!text) return { text, vars: null }
  const marker = '"vars"'
  const idx = text.lastIndexOf(marker)
  if (idx === -1) return { text, vars: null }

  // Find the nearest opening brace before the marker
  let start = text.lastIndexOf('{', idx)
  if (start === -1) return { text, vars: null }

  // Walk forward to find the matching closing brace
  let depth = 0
  let end = -1
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '{') depth += 1
    if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) return { text, vars: null }

  const block = text.slice(start, end + 1)
  try {
    const parsed = JSON.parse(block)
    if (!parsed?.vars) return { text, vars: null }
    const cleaned = (text.slice(0, start) + text.slice(end + 1)).trim()
    return { text: cleaned, vars: parsed.vars }
  } catch {
    return { text, vars: null }
  }
}

const applyVarsBlock = (vars: any[] | null, documentEditor: any, usageSet?: Set<string>) => {
  if (!vars?.length || !documentEditor) return []
  const existingVars = listVariables([], documentEditor)
  const nameMap = new Map<string, string>()
  const valueMap = new Map<string, string>()
  existingVars.forEach((v) => {
    const name = String(v?.rawValue?.name || v?.name || '').trim()
    if (name) nameMap.set(name.toLowerCase(), name)
    const value = String(v?.rawValue?.value ?? v?.value ?? '').trim()
    if (value) valueMap.set(value.toLowerCase(), name)
  })
  const created: string[] = []
  vars.forEach((spec) => {
    const desiredName = String(spec?.name || '').trim()
    if (!desiredName) return
    const byName = nameMap.get(desiredName.toLowerCase())
    if (byName) return
    const closeByName = findCloseMatch(desiredName, nameMap)
    const isUsed = usageSet?.has(desiredName)
    if (closeByName && !isUsed) return
    const value = spec?.value != null ? String(spec.value) : desiredName
    const byValue = value ? valueMap.get(value.toLowerCase()) : undefined
    if (byValue && !isUsed) return
    const payload = {
      type: spec?.type || VariableManipulatorUtils.VAR_TYPE.text,
      value,
      format: spec?.format || inferVarFormat(value),
      description: spec?.description,
      source: 'ai',
      generatedAt: new Date().toISOString()
    }
    setVariable(desiredName, payload, documentEditor)
    created.push(desiredName)
    nameMap.set(desiredName.toLowerCase(), desiredName)
    if (value) valueMap.set(value.toLowerCase(), desiredName)
  })
  return created
}

async function setSelectionAsVariable(applyToAll: boolean) {
  const editor = getActiveEditorInstance()
  if (!editor) return false
  const activeDocument = getActiveDocumentEditor()
  if (!activeDocument) return false

  const { from, to } = editor.state.selection
  const selectedText = editor.state.doc.textBetween(from, to, ' ').trim()
  if (!selectedText || from === to) {
    toast.error(t('Please select some text to use this action.'))
    return false
  }

  const suggestedName = selectedText.replace(/\s+/g, '_')
  const variableName = normalizeVariableName(suggestedName, suggestedName, selectedText)
  if (!variableName) return false

  setVariable(
    variableName,
    {
      type: VariableManipulatorUtils.VAR_TYPE.text,
      value: selectedText,
      source: 'user'
    },
    activeDocument
  )

  if (applyToAll) {
    const replaced = replaceAllOccurrencesWithVariable(editor, selectedText, variableName)
    if (replaced) return true
  }

  const nodeType = editor.state.schema.nodes[CustomVarExtensionProps.name]
  if (!nodeType) return false
  const varNode = nodeType.create({
    [CustomVarExtensionProps.tagAttributeName]: variableName,
    [CustomVarExtensionProps.tagAttributeValue]: selectedText
  })
  const tr = editor.state.tr.replaceRangeWith(from, to, varNode)
  editor.view.dispatch(tr.scrollIntoView())
  return true
}

function unsetVariableAtSelection(applyToAll: boolean) {
  const editor = getActiveEditorInstance()
  if (!editor) return false

  const selected = getSelectedVariableNode(editor)
  if (!selected) {
    toast.error(t('Please select a variable to use this action.'))
    return false
  }

  const variableName = selected.node.attrs?.[CustomVarExtensionProps.tagAttributeName]
  const variableValue = selected.node.attrs?.[CustomVarExtensionProps.tagAttributeValue] ?? ''
  if (!variableName) return false

  if (applyToAll) {
    return replaceVariableNodesByName(
      editor,
      variableName,
      (node) => node.attrs?.[CustomVarExtensionProps.tagAttributeValue] ?? ''
    )
  }

  const tr = editor.state.tr
  if (!variableValue) {
    tr.delete(selected.pos, selected.pos + selected.node.nodeSize)
  } else {
    tr.replaceWith(
      selected.pos,
      selected.pos + selected.node.nodeSize,
      editor.state.schema.text(variableValue)
    )
  }
  editor.view.dispatch(tr.scrollIntoView())
  return true
}

async function deleteVariableAtSelection() {
  const editor = getActiveEditorInstance()
  if (!editor) return false
  const activeDocument = getActiveDocumentEditor()
  if (!activeDocument) return false

  const selected = getSelectedVariableNode(editor)
  if (!selected) {
    toast.error(t('Please select a variable to use this action.'))
    return false
  }

  const variableName = selected.node.attrs?.[CustomVarExtensionProps.tagAttributeName]
  if (!variableName) return false

  const confirmed = await openConfirmModal({
    title: t('Delete Variable'),
    message: t(
      'Delete this variable everywhere? This removes it from vars.json and clears all usages.'
    ),
    confirmText: t('Delete'),
    cancelText: t('Cancel'),
    destructive: true
  })

  if (!confirmed) return false

  deleteVariable(variableName, activeDocument)
  replaceVariableNodesByName(editor, variableName, () => '')
  return true
}

async function runAIOnSelection(
  action: string,
  options: { targetLanguage?: string; requireSelection?: boolean } = {}
) {
  const editor = getActiveEditorInstance()
  if (!editor) return false
  const selectionText = getSelectionText(editor)
  const requireSelection = options.requireSelection ?? true
  if (!selectionText) {
    if (requireSelection || (!requireSelection && action === 'generate')) {
      toast.error(t('Please select some text to use this AI action.'))
      return false
    }
    executeEditorCommand('insertAI')
    return false
  }

  const noPreamble =
    'Respond ONLY with the transformed text. Do not include instructions, explanations, labels, examples, or code fences.'
  const preferVars = get(aiGenerationStore).preferVariables
  const varHint = preferVars
    ? '- If reusable values appear, add them to "vars" and reference them in the text using {var:Name}.'
    : ''
  const varsBlockHint = preferVars
    ? 'If you introduce new vars, append a JSON object on its own line exactly like: {"vars":[{"name":"Name","value":"Value","format":""}]}.'
    : ''

  let prompt = selectionText
  switch (action) {
    case 'summarize':
      prompt = `TASK: Summarize the USER_TEXT clearly and concisely.\\nRULES:\\n1) ${noPreamble}\\n2) Do NOT echo these rules or explain anything.\\n3) Do NOT use @var or @vars syntax. Use {var:Name} only.\\n4) If you add vars, append a single JSON line at the END.\\n${varHint ? `${varHint}\\n` : ''}${varsBlockHint ? `${varsBlockHint}\\n` : ''}\\nUSER_TEXT:\\n${selectionText}`
      break
    case 'translate':
      prompt = `TASK: Translate the USER_TEXT into ${options.targetLanguage || 'English'}.\\nRULES:\\n1) ${noPreamble}\\n2) Do NOT echo these rules or explain anything.\\n3) Do NOT use @var or @vars syntax. Use {var:Name} only.\\n4) If you add vars, append a single JSON line at the END.\\n${varHint ? `${varHint}\\n` : ''}${varsBlockHint ? `${varsBlockHint}\\n` : ''}\\nUSER_TEXT:\\n${selectionText}`
      break
    case 'rewrite':
      prompt = `TASK: Rewrite the USER_TEXT to improve clarity and flow without changing meaning.\\nRULES:\\n1) ${noPreamble}\\n2) Do NOT echo these rules or explain anything.\\n3) Do NOT use @var or @vars syntax. Use {var:Name} only.\\n4) If you add vars, append a single JSON line at the END.\\n${varHint ? `${varHint}\\n` : ''}${varsBlockHint ? `${varsBlockHint}\\n` : ''}\\nUSER_TEXT:\\n${selectionText}`
      break
    case 'executive_summary':
      prompt = `TASK: Produce an executive summary (3-5 concise bullets) of the USER_TEXT.\\nRULES:\\n1) ${noPreamble}\\n2) Do NOT echo these rules or explain anything.\\n3) Do NOT use @var or @vars syntax. Use {var:Name} only.\\n4) If you add vars, append a single JSON line at the END.\\n${varHint ? `${varHint}\\n` : ''}${varsBlockHint ? `${varsBlockHint}\\n` : ''}\\nUSER_TEXT:\\n${selectionText}`
      break
    case 'investor_tone':
      prompt = `TASK: Rewrite the USER_TEXT in a confident investor-ready tone, emphasizing traction, clarity, and outcomes.\\nRULES:\\n1) ${noPreamble}\\n2) Do NOT echo these rules or explain anything.\\n3) Do NOT use @var or @vars syntax. Use {var:Name} only.\\n4) If you add vars, append a single JSON line at the END.\\n${varHint ? `${varHint}\\n` : ''}${varsBlockHint ? `${varsBlockHint}\\n` : ''}\\nUSER_TEXT:\\n${selectionText}`
      break
    case 'technical_rewrite':
      prompt = `TASK: Rewrite the USER_TEXT with precise technical language, preserving meaning and removing ambiguity.\\nRULES:\\n1) ${noPreamble}\\n2) Do NOT echo these rules or explain anything.\\n3) Do NOT use @var or @vars syntax. Use {var:Name} only.\\n4) If you add vars, append a single JSON line at the END.\\n${varHint ? `${varHint}\\n` : ''}${varsBlockHint ? `${varsBlockHint}\\n` : ''}\\nUSER_TEXT:\\n${selectionText}`
      break
    case 'expand':
      prompt = `TASK: Expand the USER_TEXT with more detail and examples.\\nRULES:\\n1) ${noPreamble}\\n2) Do NOT echo these rules or explain anything.\\n3) Do NOT use @var or @vars syntax. Use {var:Name} only.\\n4) If you add vars, append a single JSON line at the END.\\n${varHint ? `${varHint}\\n` : ''}${varsBlockHint ? `${varsBlockHint}\\n` : ''}\\nUSER_TEXT:\\n${selectionText}`
      break
    case 'shorten':
      prompt = `TASK: Shorten the USER_TEXT while preserving meaning.\\nRULES:\\n1) ${noPreamble}\\n2) Do NOT echo these rules or explain anything.\\n3) Do NOT use @var or @vars syntax. Use {var:Name} only.\\n4) If you add vars, append a single JSON line at the END.\\n${varHint ? `${varHint}\\n` : ''}${varsBlockHint ? `${varsBlockHint}\\n` : ''}\\nUSER_TEXT:\\n${selectionText}`
      break
    case 'fix':
      prompt = `TASK: Fix grammar and spelling in the USER_TEXT.\\nRULES:\\n1) ${noPreamble}\\n2) Do NOT echo these rules or explain anything.\\n3) Do NOT use @var or @vars syntax. Use {var:Name} only.\\n4) If you add vars, append a single JSON line at the END.\\n${varHint ? `${varHint}\\n` : ''}${varsBlockHint ? `${varsBlockHint}\\n` : ''}\\nUSER_TEXT:\\n${selectionText}`
      break
    case 'bulletize':
      prompt = `TASK: Convert the USER_TEXT into a bullet list.\\nRULES:\\n1) ${noPreamble}\\n2) Do NOT echo these rules or explain anything.\\n3) Do NOT use @var or @vars syntax. Use {var:Name} only.\\n4) If you add vars, append a single JSON line at the END.\\n${varHint ? `${varHint}\\n` : ''}${varsBlockHint ? `${varsBlockHint}\\n` : ''}\\nUSER_TEXT:\\n${selectionText}`
      break
    case 'outline':
      prompt = `TASK: Create an outline from the USER_TEXT.\\nRULES:\\n1) ${noPreamble}\\n2) Do NOT echo these rules or explain anything.\\n3) Do NOT use @var or @vars syntax. Use {var:Name} only.\\n4) If you add vars, append a single JSON line at the END.\\n${varHint ? `${varHint}\\n` : ''}${varsBlockHint ? `${varsBlockHint}\\n` : ''}\\nUSER_TEXT:\\n${selectionText}`
      break
    case 'action_items':
      prompt = `TASK: Extract action items from the USER_TEXT.\\nRULES:\\n1) ${noPreamble}\\n2) Do NOT echo these rules or explain anything.\\n3) Do NOT use @var or @vars syntax. Use {var:Name} only.\\n4) If you add vars, append a single JSON line at the END.\\n${varHint ? `${varHint}\\n` : ''}${varsBlockHint ? `${varsBlockHint}\\n` : ''}\\nUSER_TEXT:\\n${selectionText}`
      break
    case 'simplify':
      prompt = `TASK: Simplify the USER_TEXT for a broad audience.\\nRULES:\\n1) ${noPreamble}\\n2) Do NOT echo these rules or explain anything.\\n3) Do NOT use @var or @vars syntax. Use {var:Name} only.\\n4) If you add vars, append a single JSON line at the END.\\n${varHint ? `${varHint}\\n` : ''}${varsBlockHint ? `${varsBlockHint}\\n` : ''}\\nUSER_TEXT:\\n${selectionText}`
      break
    default:
      prompt = selectionText
      break
  }

  const requestId = cryptoRandomUUID()
  const originalSelection = {
    from: editor.state.selection.from,
    to: editor.state.selection.to
  }
  editor.view.dispatch(
    editor.state.tr.setMeta(AI_TRACKING_PLUGIN_KEY, {
      action: 'add',
      requestId,
      selection: editor.state.selection
    })
  )
  moveCursorOutsideSelection(editor)

  notifyAiFreePlanNotice({ source: 'Editor AI' })
  aiGenerationStore.start(`text-${action}`, prompt)
  console.log(`aiGenerationStore ${action} log:`, { prompt })
  try {
    let draftText = ''
    let draftFrom = originalSelection.from
    let draftTo = originalSelection.to
    const updateDraft = (text: string) => {
      const tr = editor.state.tr
        .replaceWith(draftFrom, draftTo, editor.state.schema.text(text || ''))
        .setMeta(AI_TRACKING_PLUGIN_KEY, { action: 'apply', requestId })
        .setMeta('addToHistory', false)
      editor.view.dispatch(tr)
      draftTo = draftFrom + (text?.length || 0)
    }

    let raw = await runAIWithResult(
      prompt,
      get(_$_documentEditorsList.getActive()),
      {
        mode: `text-${action}`,
        format: 'markdown'
      },
      (chunk) => {
        draftText += chunk || ''
        updateDraft(draftText)
      }
    )

    /* let raw = `After {var:Germany}'s defeat in {var:WorldWarI}, the former German colony of {var:Togo} was removed from German control and placed under an international mandate system created by the {var:LeagueOfNations}. Under Article 22 of the Covenant, territories that had been controlled by the defeated powers were entrusted to victorious nations with the stated goal of preparing them for eventual self-government. In practice, however, the territory was divided between two colonial administrations. The eastern and larger portion of the territory was administered by {var:France} and became known as {var:FrenchTogo}, while the western portion was administered by {var:UnitedKingdom} as {var:BritishTogoland}.

In the area administered by {var:France}, colonial authorities introduced policies aimed at deeper economic integration into the French colonial system. Plantations producing crops such as coffee, cocoa, and cotton were expanded, and local farmers were often required to grow specific export crops instead of subsistence crops. Colonial administrators imposed taxes that had to be paid in cash, which forced many Togolese people to participate in the colonial economy by working on plantations, in mines, or in infrastructure projects. Roads, railways, and administrative buildings were constructed to facilitate the movement of goods to coastal ports where they could be shipped to European markets.

French rule was also characterized by a policy of cultural assimilation. The colonial administration promoted the {var:FrenchLanguage} as the primary language of government, education, and commerce. Schools established during this period often followed the French curriculum and emphasized French history, culture, and political values. Students were encouraged to adopt French customs, clothing styles, and administrative practices. While this education system created a small educated elite that later played important roles in politics and administration, many rural communities remained marginalized and had limited access to formal education.

During {var:WorldWarII}, the territory became strategically important due to its coastal location along the Gulf of Guinea and its transportation infrastructure inherited from the German colonial period. Allied forces sought to secure West African territories to prevent Axis influence and to maintain supply routes across the Atlantic. Military facilities, airfields, and supply depots in the region supported broader Allied operations in Africa. At the same time, political awareness among the local population began to grow as returning soldiers and educated elites became more vocal about political representation and the future of colonial rule.

Following the end of {var:WorldWarII} in {var:Year1945}, international pressure for decolonization increased. The mandate system was replaced by the {var:UnitedNationsTrusteeshipSystem}, which aimed to guide territories toward self-government and independence. In {var:FrenchTogo}, political parties began to form and local leaders started advocating for greater autonomy. Public debates about political reform, economic development, and national identity became increasingly common.

In {var:Year1956}, a new constitution was introduced that granted the territory limited internal self-government while it remained under French supervision. This reform allowed the creation of local political institutions, including an elected legislative assembly and a government led by African political leaders. Elections held during this period allowed several prominent political figures to emerge on the national stage.

One of these leaders was {var:NicolasGrunitzky}, who became the first African prime minister of the territory in {var:Year1958}. His government attempted to balance demands for independence with the practical realities of maintaining economic ties with {var:France}. Political debate during this period was intense, with some groups advocating gradual autonomy within the French community while others pushed for immediate and full independence.

The growing independence movement ultimately led to the declaration of national sovereignty on {var:IndependenceDate}. On that day, {var:Togo} officially became an independent nation, ending decades of colonial administration. {var:SylvanusOlympio}, a prominent nationalist leader and founder of one of the country's major political movements, became the first president of the newly independent republic. His government sought to establish a strong national economy, reduce dependence on former colonial powers, and build national institutions capable of managing the country’s development.

However, the early years of independence were politically fragile. Economic challenges, tensions within the military, and disagreements among political factions created instability. On {var:OlympioAssassinationDate}, {var:SylvanusOlympio} was assassinated during a military uprising, making it one of the first post-independence coups in West Africa. The event shocked the country and marked the beginning of a period of political uncertainty.

In the years that followed, the military became an increasingly powerful political force. A subsequent coup eventually brought {var:GnassingbeEyadema} to prominence. His rise to power marked the beginning of a long period of centralized and authoritarian rule. Under his leadership, the government maintained tight control over political life, limited opposition activity, and consolidated authority within the ruling party. Despite political restrictions, the period also saw efforts to modernize infrastructure, expand state institutions, and strengthen national identity.

These developments shaped the political trajectory of {var:Togo} for decades, influencing its governance structures, political culture, and relations with neighboring countries and international organizations.

{"vars":[{"name":"Germany","value":"Germany","format":""},{"name":"WorldWarI","value":"World War I","format":""},{"name":"Togo","value":"Togo","format":""},{"name":"LeagueOfNations","value":"League of Nations","format":""},{"name":"France","value":"France","format":""},{"name":"FrenchTogo","value":"French Togo","format":""},{"name":"UnitedKingdom","value":"the United Kingdom","format":""},{"name":"BritishTogoland","value":"British Togoland","format":""},{"name":"FrenchLanguage","value":"French language","format":""},{"name":"WorldWarII","value":"World War II","format":""},{"name":"Year1945","value":"1945","format":""},{"name":"UnitedNationsTrusteeshipSystem","value":"United Nations Trusteeship System","format":""},{"name":"Year1956","value":"1956","format":""},{"name":"NicolasGrunitzky","value":"Nicolas Grunitzky","format":""},{"name":"Year1958","value":"1958","format":""},{"name":"IndependenceDate","value":"April 27, 1960","format":""},{"name":"SylvanusOlympio","value":"Sylvanus Olympio","format":""},{"name":"OlympioAssassinationDate","value":"January 13, 1963","format":""},{"name":"GnassingbeEyadema","value":"Gnassingbé Eyadéma","format":""}]}
` */

    raw = normalizeAiVarSyntax(raw || '')

    if (preferVars) {
      const parsed = extractVarsBlock(raw || '')
      if (shouldRequestVarsBlock(raw || '', parsed.vars)) {
        raw = await runAIWithResult(
          buildVarsCorrectionPrompt(raw || ''),
          get(_$_documentEditorsList.getActive()),
          {
            mode: `text-${action}-vars`,
            format: 'markdown'
          }
        )
        raw = normalizeAiVarSyntax(raw || '')
      }
    }

    console.log(`AI ${action} raw result:`, raw)
    const activeDoc = get(_$_documentEditorsList.getActive())
    const { text: strippedText, vars } = extractVarsBlock(raw || '')
    const usageSet = extractVarUsages(normalizeVariableToken(strippedText || ''))
    const createdFromBlock = applyVarsBlock(vars, activeDoc, usageSet)
    const { text: varReadyText, createdNames } = applyVariablesFromText(
      strippedText || '',
      activeDoc
    )
    const createdAll = [...createdFromBlock, ...createdNames]
    const html = md.render(varReadyText || '')
    const tracked = getTrackedSelection(editor.state, requestId)
    if (tracked && !tracked.empty) {
      const element = document.createElement('div')
      element.innerHTML = html
      const content = DOMParser.fromSchema(editor.state.schema).parse(element).content
      const tr = editor.state.tr
        .replaceWith(tracked.from, tracked.to, content)
        .setMeta(AI_TRACKING_PLUGIN_KEY, { action: 'apply', requestId })
        .setMeta('forceVarTransform', true)
      editor.view.dispatch(tr)
    } else {
      replaceSelectionWithHtml(editor, html)
    }
    editor.view.dispatch(
      editor.state.tr.setMeta('forceVarTransform', true).setMeta('addToHistory', false)
    )
    editor.view.dispatch(
      editor.state.tr.setMeta(AI_TRACKING_PLUGIN_KEY, { action: 'remove', requestId })
    )
    if (createdAll.length && activeDoc) {
      const usage = extractVarUsages(varReadyText || '')
      createdAll.forEach((name) => {
        if (!usage.has(name)) deleteVariable(name, activeDoc)
      })
    }
    aiGenerationStore.finish()
    return true
  } catch (err: any) {
    console.error(`AI ${action} error:`, err)
    aiGenerationStore.error(err?.message || 'AI action failed')
    editor.view.dispatch(
      editor.state.tr.setMeta(AI_TRACKING_PLUGIN_KEY, { action: 'remove', requestId })
    )
    aiGenerationStore.finish()
    return false
  }
}

async function runAIGenerationByMode(mode: AIGenerationMode) {
  const editor = getActiveEditorInstance()
  if (!editor) return false

  let prompt = getSelectionText(editor)
  const selection = editor.state.selection
  const hasSelection = selection.from !== selection.to
  const requestId = hasSelection ? cryptoRandomUUID() : null
  if (!prompt) {
    const input = await openTextInputModal({
      title: t('Generate with AI'),
      message: t('Describe what you want to generate.'),
      placeholder: t('e.g., 5-slide deck about Q2 results'),
      confirmText: t('Generate'),
      cancelText: t('Cancel')
    })
    if (!input?.trim()) return false
    prompt = input.trim()
  }

  if (hasSelection && requestId) {
    editor.view.dispatch(
      editor.state.tr.setMeta(AI_TRACKING_PLUGIN_KEY, {
        action: 'add',
        requestId,
        selection
      })
    )
    moveCursorOutsideSelection(editor)
  }

  const range = {
    from: editor.state.selection.from,
    to: editor.state.selection.to
  }

  try {
    notifyAiFreePlanNotice({ source: 'AI Generator' })
    const result = await runAIGeneration(editor, mode, prompt, range)
    await applyAIGenerationResult(editor, result.mode, result.raw)
    return true
  } finally {
    if (hasSelection && requestId) {
      editor.view.dispatch(
        editor.state.tr.setMeta(AI_TRACKING_PLUGIN_KEY, { action: 'remove', requestId })
      )
    }
  }
}

export async function exportSpreadsheet() {
  await promptAndExportActiveSheet()
}

export async function importSpreadsheet() {
  await promptAndImportSpreadsheetToActiveSheet()
}

function getEditorContainerRoot(editor?: Editor | null): HTMLElement | null {
  const dom = editor?.view?.dom as HTMLElement | undefined
  if (!dom) return null
  return (dom.closest('[id^="editor-"]') ||
    dom.closest('.editor-container') ||
    dom.parentElement ||
    null) as HTMLElement | null
}

function applyReviewFilters(
  editor: Editor,
  filters: { authors?: string[] | null; modes?: string[] | null }
) {
  const root = getEditorContainerRoot(editor)
  if (!root) return false
  const authorSet =
    filters.authors && filters.authors.length
      ? new Set(filters.authors.map((value) => value.trim()).filter(Boolean))
      : null
  const modeSet =
    filters.modes && filters.modes.length
      ? new Set(filters.modes.map((value) => value.trim()).filter(Boolean))
      : null

  const nodes = root.querySelectorAll<HTMLElement>(
    '.review-insert, .review-delete, .review-suggestion-badge'
  )
  nodes.forEach((node) => {
    const author =
      node.getAttribute('data-author') ||
      node.getAttribute('data-review-author') ||
      node.getAttribute('author') ||
      ''
    const mode =
      node.getAttribute('data-mode') ||
      node.getAttribute('data-review-mode') ||
      node.getAttribute('mode') ||
      ''
    let visible = true
    if (authorSet) visible = authorSet.has(author)
    if (modeSet) visible = visible && modeSet.has(mode)
    node.style.display = visible ? '' : 'none'
  })

  if (authorSet && authorSet.size) {
    root.dataset.reviewFilterAuthors = Array.from(authorSet).join(', ')
  } else {
    delete root.dataset.reviewFilterAuthors
  }

  if (modeSet && modeSet.size) {
    root.dataset.reviewFilterModes = Array.from(modeSet).join(', ')
  } else {
    delete root.dataset.reviewFilterModes
  }

  return true
}

function toggleRootClass(editor: Editor | undefined, className: string, enabled?: boolean) {
  const root = getEditorContainerRoot(editor)
  if (!root) return false
  if (enabled === undefined) {
    root.classList.toggle(className)
    return root.classList.contains(className)
  }
  root.classList.toggle(className, enabled)
  return enabled
}

type ReviewNodeEntry = { pos: number; node: any }
type WordCommentEntry = {
  id: string
  from: number
  to: number
  attrs: any
  text: string
}

function getReviewNodes(editor: Editor): ReviewNodeEntry[] {
  const nodes: ReviewNodeEntry[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type?.name === 'review') nodes.push({ pos, node })
  })
  return nodes
}

function getWordCommentEntries(editor: Editor): WordCommentEntry[] {
  const entries = new Map<string, WordCommentEntry>()
  editor.state.doc.descendants((node, pos) => {
    if (!node.marks?.length) return
    node.marks.forEach((mark) => {
      if (mark.type?.name !== 'wordComment') return
      const id = mark.attrs?.id || `${pos}`
      const existing = entries.get(id)
      const from = pos
      const to = pos + node.nodeSize
      if (!existing) {
        entries.set(id, {
          id,
          from,
          to,
          attrs: mark.attrs,
          text: node.textContent || ''
        })
      } else {
        existing.from = Math.min(existing.from, from)
        existing.to = Math.max(existing.to, to)
      }
    })
  })
  return Array.from(entries.values()).sort((a, b) => a.from - b.from)
}

function getWordCommentAtSelection(editor: Editor): WordCommentEntry | null {
  const { from } = editor.state.selection
  const node = editor.state.doc.nodeAt(from)
  if (!node?.marks?.length) return null
  const mark = node.marks.find((m) => m.type?.name === 'wordComment')
  if (!mark) return null
  const id = mark.attrs?.id || `${from}`
  const entries = getWordCommentEntries(editor)
  return entries.find((entry) => entry.id === id) || null
}

function getReviewNodesInRange(editor: Editor, from: number, to: number): ReviewNodeEntry[] {
  const nodes: ReviewNodeEntry[] = []
  const end = Math.max(from, to)
  const start = Math.min(from, to)
  editor.state.doc.nodesBetween(start, end, (node, pos) => {
    if (node.type?.name === 'review') nodes.push({ pos, node })
  })
  return nodes
}

function applyReviewDecision(editor: Editor, nodes: ReviewNodeEntry[], mode: 'accept' | 'reject') {
  if (!nodes.length) return false
  const { state } = editor
  const tr = state.tr
  const sorted = [...nodes].sort((a, b) => b.pos - a.pos)

  sorted.forEach(({ node, pos }) => {
    const from = pos
    const to = pos + node.nodeSize
    const reviewMode = node.attrs?.mode

    if (mode === 'accept') {
      if (reviewMode === 'insert') {
        tr.replaceWith(from, to, node.content)
      } else if (reviewMode === 'delete') {
        tr.delete(from, to)
      }
    } else {
      if (reviewMode === 'insert') {
        tr.delete(from, to)
      } else if (reviewMode === 'delete') {
        tr.replaceWith(from, to, node.content)
      }
    }
  })

  if (tr.steps.length) {
    editor.view.dispatch(tr)
    return true
  }
  return false
}

function selectNode(editor: Editor, entry?: ReviewNodeEntry | null) {
  if (!entry) return false
  const { pos, node } = entry
  const from = pos
  const to = pos + node.nodeSize
  editor.commands.setTextSelection({ from, to })
  editor.commands.scrollIntoView()
  return true
}

function findNextEntry(entries: ReviewNodeEntry[], fromPos: number) {
  return entries.find((entry) => entry.pos > fromPos) ?? entries[0]
}

function findPreviousEntry(entries: ReviewNodeEntry[], fromPos: number) {
  const prev = [...entries].reverse().find((entry) => entry.pos < fromPos)
  return prev ?? entries[entries.length - 1]
}

function getActiveSlideNodeviewId(): string | null {
  const activeWysiwyg = get(_$_wysiwygEditorsList.getActive())
  if (!activeWysiwyg) return null
  const activeNodeview = _$_wysiwygEditorsList.getActiveNodeview(activeWysiwyg.id)
  if (activeNodeview?.type !== CustomSlideExtensionProps.name) return null
  return activeNodeview.id
}

function captureEditorStyle(editor: Editor) {
  const textStyle = editor.getAttributes('textStyle') || {}
  const isBoldValue = (value?: string | null) => {
    if (!value) return false
    if (value === 'bold' || value === 'bolder') return true
    const numeric = Number.parseInt(value, 10)
    return Number.isFinite(numeric) && numeric >= 600
  }
  const isItalicValue = (value?: string | null) => {
    if (!value) return false
    return value === 'italic' || value === 'oblique'
  }
  const hasDecoration = (value: string | null | undefined, token: string) => {
    if (!value) return false
    return value.split(/\s+/).some((entry) => entry === token)
  }
  const marks = {
    bold: isBoldValue(textStyle.fontWeight),
    italic: isItalicValue(textStyle.fontStyle),
    underline: hasDecoration(textStyle.textDecoration, 'underline'),
    strike: hasDecoration(textStyle.textDecoration, 'line-through')
  }
  const highlight = editor.getAttributes('highlight') || {}
  const paragraph = editor.getAttributes('paragraph') || {}
  const heading = editor.getAttributes('heading') || {}
  const attrs = {
    color: textStyle.color ?? null,
    highlight: highlight.color ?? null,
    fontFamily: textStyle.fontFamily ?? null,
    fontSize: textStyle.fontSize ?? null,
    letterSpacing: textStyle.letterSpacing ?? null,
    textAlign: paragraph.textAlign ?? heading.textAlign ?? null
  }
  return { marks, attrs }
}

function applyMarkState(editor: Editor, mark: string, desired: boolean) {
  const textStyle = editor.getAttributes('textStyle') || {}
  const isBoldValue = (value?: string | null) => {
    if (!value) return false
    if (value === 'bold' || value === 'bolder') return true
    const numeric = Number.parseInt(value, 10)
    return Number.isFinite(numeric) && numeric >= 600
  }
  const isItalicValue = (value?: string | null) => {
    if (!value) return false
    return value === 'italic' || value === 'oblique'
  }
  const hasDecoration = (value: string | null | undefined, token: string) => {
    if (!value) return false
    return value.split(/\s+/).some((entry) => entry === token)
  }

  const isActive =
    mark === 'bold'
      ? isBoldValue(textStyle.fontWeight)
      : mark === 'italic'
        ? isItalicValue(textStyle.fontStyle)
        : mark === 'underline'
          ? hasDecoration(textStyle.textDecoration, 'underline')
          : mark === 'strike'
            ? hasDecoration(textStyle.textDecoration, 'line-through')
            : editor.isActive(mark)

  if (desired === isActive) return
  const commandName = `toggle${mark[0].toUpperCase()}${mark.slice(1)}`
  const chain = editor.chain().focus()
  if (typeof (chain as any)[commandName] === 'function') {
    ;(chain as any)[commandName]().run()
  }
}

function applyStyleToEditor(
  editor: Editor,
  style: typeof slideFormatPainterCache,
  applyAll: boolean = false
) {
  if (!style) return
  const chain = editor.chain().focus()
  if (applyAll && !editor.isFocused) {
    chain.selectAll()
  }

  applyMarkState(editor, 'bold', style.marks.bold)
  applyMarkState(editor, 'italic', style.marks.italic)
  applyMarkState(editor, 'underline', style.marks.underline)
  applyMarkState(editor, 'strike', style.marks.strike)

  if (style.attrs.color && typeof (chain as any).setColor === 'function') {
    ;(chain as any).setColor(style.attrs.color).run()
  }
  if (style.attrs.highlight && typeof (chain as any).setHighlight === 'function') {
    ;(chain as any).setHighlight({ color: style.attrs.highlight }).run()
  }
  if (style.attrs.fontFamily && typeof (chain as any).setFontFamily === 'function') {
    ;(chain as any).setFontFamily(style.attrs.fontFamily).run()
  }
  if (style.attrs.fontSize && typeof (chain as any).setFontSize === 'function') {
    ;(chain as any).setFontSize(style.attrs.fontSize).run()
  }
  if (style.attrs.letterSpacing && typeof (chain as any).setLetterSpacing === 'function') {
    ;(chain as any).setLetterSpacing(style.attrs.letterSpacing).run()
  }
  if (style.attrs.textAlign && typeof (chain as any).setTextAlign === 'function') {
    ;(chain as any).setTextAlign(style.attrs.textAlign).run()
  }
}

function applyStyleToSelectedSlideShapes(style: typeof slideFormatPainterCache) {
  const nodeviewId = getActiveSlideNodeviewId()
  if (!nodeviewId || !style) return false
  const canvas = _$_canvasCommands.get(nodeviewId)
  const selectedIds = canvas?.getSelectedIds?.() ?? []
  if (selectedIds.length === 0) return false

  selectedIds.forEach((id) => {
    const editor = _$_wysiwygEditorsList.getItem(id)
    if (!editor) return
    applyStyleToEditor(editor, style, true)
  })
  return true
}

function applySlideFormatPainterIfArmed(): boolean {
  if (!slideFormatPainterCache) return false
  const applied = applyStyleToSelectedSlideShapes(slideFormatPainterCache)
  if (applied) {
    slideFormatPainterCache = null
  }
  return applied
}

function applyPresetToSelectedShapes(preset: 'title' | 'subtitle' | 'body') {
  const nodeviewId = getActiveSlideNodeviewId()
  if (!nodeviewId) return false
  const canvas = _$_canvasCommands.get(nodeviewId)
  const selectedIds = canvas?.getSelectedIds?.() ?? []
  if (selectedIds.length === 0) return false

  selectedIds.forEach((id) => {
    const editor = _$_wysiwygEditorsList.getItem(id)
    if (!editor) return
    const chain = editor.chain().focus()
    if (!editor.isFocused) chain.selectAll()

    if (preset === 'title') {
      if (typeof (chain as any).toggleHeading === 'function') {
        ;(chain as any).toggleHeading({ level: 1 }).run()
      }
      applyMarkState(editor, 'bold', true)
      if (typeof (chain as any).setTextAlign === 'function') {
        ;(chain as any).setTextAlign('center').run()
      }
      if (typeof (chain as any).setFontSize === 'function') {
        ;(chain as any).setFontSize(48).run()
      }
    } else if (preset === 'subtitle') {
      if (typeof (chain as any).toggleHeading === 'function') {
        ;(chain as any).toggleHeading({ level: 2 }).run()
      }
      applyMarkState(editor, 'bold', false)
      if (typeof (chain as any).setTextAlign === 'function') {
        ;(chain as any).setTextAlign('center').run()
      }
      if (typeof (chain as any).setFontSize === 'function') {
        ;(chain as any).setFontSize(32).run()
      }
    } else {
      if (typeof (chain as any).setParagraph === 'function') {
        ;(chain as any).setParagraph().run()
      }
      if (typeof (chain as any).toggleBulletList === 'function' && !editor.isActive('bulletList')) {
        ;(chain as any).toggleBulletList().run()
      }
      applyMarkState(editor, 'bold', false)
      if (typeof (chain as any).setTextAlign === 'function') {
        ;(chain as any).setTextAlign('left').run()
      }
      if (typeof (chain as any).setFontSize === 'function') {
        ;(chain as any).setFontSize(24).run()
      }
    }
  })
  return true
}

function getActiveSheetMethods() {
  const context = _$_ribbonContext.getSnapshot()
  if (!context?.inSheet) return null
  return get(activeSheet)?.methods ?? null
}

function getActiveSheetSourcePath() {
  return get(activeSheet)?.rootPath || ''
}

function getSheetSelectionRange(methods: ReturnType<typeof getActiveSheetMethods>) {
  const selection = methods?.getSelection?.()
  if (Array.isArray(selection) && selection.length > 0) {
    return selection[0]
  }
  return null
}

function getSheetRangeIndices(methods: ReturnType<typeof getActiveSheetMethods>) {
  const range = getSheetSelectionRange(methods)
  if (!range) return null
  const row = range.row ?? []
  const column = range.column ?? []
  return {
    rowStart: row[0] ?? 0,
    rowEnd: row[1] ?? row[0] ?? 0,
    columnStart: column[0] ?? 0,
    columnEnd: column[1] ?? column[0] ?? 0,
    range
  }
}

let sheetFormatPainterCache: Partial<Record<string, any>> | null = null
let slideFormatPainterCache: {
  marks: {
    bold: boolean
    italic: boolean
    underline: boolean
    strike: boolean
  }
  attrs: {
    color?: string | null
    highlight?: string | null
    fontFamily?: string | null
    fontSize?: string | number | null
    letterSpacing?: string | number | null
    textAlign?: string | null
  }
} | null = null

function columnIndexToLabel(index: number): string {
  let result = ''
  let current = index + 1
  while (current > 0) {
    const mod = (current - 1) % 26
    result = String.fromCharCode(65 + mod) + result
    current = Math.floor((current - 1) / 26)
  }
  return result
}

function buildA1Reference(row: number, column: number): string {
  return `${columnIndexToLabel(column)}${row + 1}`
}

function buildA1Range(startRow: number, startCol: number, endRow: number, endCol: number): string {
  return `${buildA1Reference(startRow, startCol)}:${buildA1Reference(endRow, endCol)}`
}

function getPrimarySheetCell(methods: ReturnType<typeof getActiveSheetMethods>) {
  const range = getSheetSelectionRange(methods)
  if (!range || !methods?.getCellsByRange) return null
  const cells = methods.getCellsByRange(range)
  if (!cells || !cells.length) return null
  return cells[0]?.[0] ?? null
}

function applySheetStyleToRange(
  methods: NonNullable<ReturnType<typeof getActiveSheetMethods>>,
  style: Record<string, any>
) {
  const range = getSheetSelectionRange(methods)
  if (!range || !methods.setCellFormatByRange) return false
  Object.entries(style).forEach(([attr, value]) => {
    if (value === undefined) return
    methods.setCellFormatByRange(attr, value, range)
  })
  return true
}

function clearSheetFormatting(): boolean {
  return (
    withSheetMethods((methods) => {
      const range = getSheetSelectionRange(methods)
      if (!range || !methods.setCellFormatByRange) return false

      const clearMap: Record<string, any> = {
        bl: 0,
        it: 0,
        un: 0,
        cl: 0,
        fs: null,
        ff: null,
        fc: null,
        bg: null,
        ht: null,
        vt: null,
        tb: null,
        rt: null,
        ct: null
      }

      Object.entries(clearMap).forEach(([attr, value]) => {
        methods.setCellFormatByRange?.(attr, value, range)
      })

      return true
    }) ?? false
  )
}

function setDocumentTheme(themeId: string, options: { persist?: boolean } = {}) {
  const editor = getActiveEditorInstance()
  if (!editor) return false
  const root = getEditorContainerRoot(editor)
  if (!root) return false
  root.dataset.docTheme = themeId

  const presets: Record<string, { accent: string; link: string }> = {
    neutral: { accent: '#2f2f2f', link: '#0563c1' },
    blue: { accent: '#1f4e79', link: '#1f5fbf' },
    emerald: { accent: '#1b5e20', link: '#1b5e20' },
    rose: { accent: '#7a1e3a', link: '#7a1e3a' }
  }
  const preset = presets[themeId] || presets.neutral
  root.style.setProperty('--doc-theme-accent', preset.accent)
  root.style.setProperty('--doc-theme-link', preset.link)

  if (options.persist !== false) {
    updateActiveDocumentConfig((doc) => {
      doc.config.designSettings = {
        ...(doc.config.designSettings || {}),
        theme: themeId
      }
    })
  }
  return true
}

function setDocumentEffect(effectId: string) {
  const editor = getActiveEditorInstance()
  if (!editor) return false
  const root = getEditorContainerRoot(editor)
  if (!root) return false
  root.dataset.docEffects = effectId
  updateActiveDocumentConfig((doc) => {
    doc.config.designSettings = {
      ...(doc.config.designSettings || {}),
      effects: effectId
    }
  })
  return true
}

function previewDocumentTheme(themeId?: string) {
  const current = getActiveDocumentEditor()?.document?.config?.designSettings?.theme || 'neutral'
  const id = themeId || current
  return setDocumentTheme(id, { persist: false })
}

function applySheetStylePreset(preset: string): boolean {
  const presetStyles: Record<string, Record<string, any>> = {
    good: { bg: '#c6efce', fc: '#006100', bl: 1 },
    bad: { bg: '#ffc7ce', fc: '#9c0006', bl: 1 },
    neutral: { bg: '#ffeb9c', fc: '#9c6500', bl: 1 },
    heading: { bg: '#d9e1f2', fc: '#1f4e79', bl: 1, it: 1 },
    total: { bg: '#e2efda', fc: '#385723', bl: 1, it: 1 }
  }
  return (
    withSheetMethods((methods) => applySheetStyleToRange(methods, presetStyles[preset] || {})) ||
    false
  )
}

function applyConditionalFormattingRule(
  type: string,
  options: {
    threshold?: number
    color?: string
    rangeOverride?: { sr: number; sc: number; er: number; ec: number }
  } = {}
): boolean {
  return (
    withSheetMethods((methods) => {
      const range = options.rangeOverride || getSheetSelectionRange(methods)
      if (!range) return null
      const coords = methods.getFlattenRange?.(range) || []
      if (!coords.length) return null

      const values = coords.map(({ r, c }) => ({
        r,
        c,
        value: methods.getCellValue?.(r, c)
      }))

      const normalize = (value: any) => {
        const raw = typeof value === 'object' ? (value?.v ?? value?.m ?? value?.value) : value
        const numeric = Number.parseFloat(raw)
        return Number.isFinite(numeric) ? numeric : raw
      }

      const highlightColor = options.color || (type === 'duplicates' ? '#fff2cc' : '#dbeeff')
      const highlightText = type === 'duplicates' ? '#7f6000' : '#1f4e79'

      if (type === 'duplicates') {
        const map = new Map<string, number>()
        values.forEach((entry) => {
          const key = String(normalize(entry.value) ?? '')
          map.set(key, (map.get(key) || 0) + 1)
        })
        values.forEach((entry) => {
          const key = String(normalize(entry.value) ?? '')
          if (map.get(key) && map.get(key)! > 1) {
            methods.setCellFormat?.(entry.r, entry.c, 'bg', highlightColor)
            methods.setCellFormat?.(entry.r, entry.c, 'fc', highlightText)
          }
        })
        return true
      }

      const threshold = Number.parseFloat(String(options.threshold ?? ''))
      if (!Number.isFinite(threshold)) return null

      values.forEach((entry) => {
        const numeric = Number.parseFloat(String(normalize(entry.value)))
        if (!Number.isFinite(numeric)) return
        const match = type === 'greater' ? numeric > threshold : numeric < threshold
        if (match) {
          methods.setCellFormat?.(entry.r, entry.c, 'bg', highlightColor)
          methods.setCellFormat?.(entry.r, entry.c, 'fc', highlightText)
        }
      })
      return true
    }) || false
  )
}

function getConditionalFormattingRules(): ConditionalFormattingRule[] {
  const doc = getActiveDocumentEditor()?.document
  return doc?.config?.sheetSettings?.conditionalFormattingRules ?? []
}

function setConditionalFormattingRules(rules: ConditionalFormattingRule[]) {
  updateActiveDocumentConfig((doc) => {
    doc.config.sheetSettings = {
      ...(doc.config.sheetSettings || {}),
      conditionalFormattingRules: rules
    }
  })
}

function parseDecimalPlaces(format?: string): number {
  if (!format) return 0
  const match = format.match(/\.(\d+)/)
  return match ? match[1].length : 0
}

function buildNumberFormat(
  style: 'number' | 'currency' | 'percent' | 'comma',
  decimals: number
): string {
  const decimalPart = decimals > 0 ? `.${'0'.repeat(decimals)}` : ''
  switch (style) {
    case 'currency':
      return `$#,##0${decimalPart}`
    case 'percent':
      return `0${decimalPart}%`
    case 'comma':
      return `#,##0${decimalPart}`
    default:
      return `0${decimalPart}`
  }
}

function applySheetNumberFormat(
  style: 'number' | 'currency' | 'percent' | 'comma',
  decimals?: number
): boolean {
  return (
    withSheetMethods((methods) => {
      const range = getSheetSelectionRange(methods)
      if (!range || !methods.setCellFormatByRange) return false

      let targetDecimals = decimals
      if (targetDecimals == null) {
        const cell = getPrimarySheetCell(methods)
        targetDecimals = parseDecimalPlaces(cell?.ct?.fa)
      }
      const format = buildNumberFormat(style, Math.max(0, Math.min(9, targetDecimals ?? 0)))
      methods.setCellFormatByRange('ct', { fa: format, t: 'n' }, range)
      return true
    }) ?? false
  )
}

function adjustSheetDecimal(delta: number): boolean {
  return (
    withSheetMethods((methods) => {
      const range = getSheetSelectionRange(methods)
      if (!range || !methods.setCellFormatByRange) return false
      const cell = getPrimarySheetCell(methods)
      const currentFormat = cell?.ct?.fa
      const currentDecimals = parseDecimalPlaces(currentFormat)
      const nextDecimals = Math.max(0, Math.min(9, currentDecimals + delta))
      let style: 'number' | 'currency' | 'percent' | 'comma' = 'number'
      if (currentFormat?.includes('%')) style = 'percent'
      else if (currentFormat?.includes('$')) style = 'currency'
      else if (currentFormat?.includes(',')) style = 'comma'
      const nextFormat = buildNumberFormat(style, nextDecimals)
      methods.setCellFormatByRange('ct', { fa: nextFormat, t: 'n' }, range)
      return true
    }) ?? false
  )
}

function adjustSheetFontSize(delta: number): boolean {
  return (
    withSheetMethods((methods) => {
      const range = getSheetSelectionRange(methods)
      if (!range) return false
      const cell = getPrimarySheetCell(methods)
      const current = typeof cell?.fs === 'number' ? cell.fs : 11
      const next = Math.max(6, Math.min(72, current + delta))
      return applySheetFormat('fs', next)
    }) ?? false
  )
}

function setSheetWrap(mode: 'overflow' | 'wrap' | 'clip'): boolean {
  const valueMap: Record<typeof mode, number> = { overflow: 0, wrap: 1, clip: 2 }
  return applySheetFormat('tb', valueMap[mode])
}

function setSheetRotation(deg: number): boolean {
  return applySheetFormat('rt', deg)
}

function setSheetVerticalAlign(value: 'top' | 'middle' | 'bottom'): boolean {
  const map: Record<typeof value, number> = { middle: 0, top: 1, bottom: 2 }
  return applySheetFormat('vt', map[value])
}

function runSheetSort(isAsc: boolean): boolean {
  return (
    withSheetMethods((methods) => {
      const range = getSheetRangeIndices(methods)
      if (!range || !methods.getSheet || !methods.getAllSheets || !methods.updateSheet) return false
      const sheet = methods.getSheet()
      const sheetId = sheet?.id
      if (!sheetId) return false

      let data = sheet.data as any[][] | undefined
      if (!data && Array.isArray(sheet.celldata)) {
        const maxRow = Math.max(0, ...sheet.celldata.map((c: any) => c.r))
        const maxCol = Math.max(0, ...sheet.celldata.map((c: any) => c.c))
        data = Array.from({ length: maxRow + 1 }, () =>
          Array.from({ length: maxCol + 1 }, () => null)
        )
        sheet.celldata.forEach((cell: any) => {
          if (data) data[cell.r][cell.c] = cell.v
        })
      }
      if (!data) return false

      const { rowStart, rowEnd, columnStart, columnEnd } = range
      const rowsSlice = data.slice(rowStart, rowEnd + 1)
      const sorted = rowsSlice
        .map((row, index) => ({ row, index }))
        .sort((a, b) => {
          const av = a.row?.[columnStart]?.v ?? a.row?.[columnStart]?.m ?? a.row?.[columnStart]
          const bv = b.row?.[columnStart]?.v ?? b.row?.[columnStart]?.m ?? b.row?.[columnStart]
          if (av == null && bv == null) return a.index - b.index
          if (av == null) return 1
          if (bv == null) return -1
          if (av === bv) return a.index - b.index
          return (av > bv ? 1 : -1) * (isAsc ? 1 : -1)
        })
        .map((entry) => entry.row)

      for (let i = 0; i < sorted.length; i++) {
        for (let c = columnStart; c <= columnEnd; c++) {
          data[rowStart + i][c] = sorted[i]?.[c] ?? null
        }
      }

      const allSheets = methods.getAllSheets() || []
      const updatedSheets = allSheets.map((s: any) => (s.id === sheetId ? { ...s, data } : s))
      methods.updateSheet(updatedSheets)
      return true
    }) ?? false
  )
}

function runSheetAutoSum(): boolean {
  return (
    withSheetMethods((methods) => {
      const range = getSheetRangeIndices(methods)
      if (!range || !methods.setCellValue) return false

      const { rowStart, rowEnd, columnStart, columnEnd } = range
      const targetRow = rowEnd + 1
      for (let col = columnStart; col <= columnEnd; col++) {
        const formula = `=SUM(${buildA1Range(rowStart, col, rowEnd, col)})`
        methods.setCellValue(targetRow, col, formula)
      }
      return true
    }) ?? false
  )
}

function readSheetSelectionMatrix(methods: NonNullable<ReturnType<typeof getActiveSheetMethods>>) {
  const indices = getSheetRangeIndices(methods)
  if (!indices || !methods.getCellsByRange) return null
  const rows = methods.getCellsByRange(indices.range)
  if (!rows?.length) return null
  return { indices, rows: JSON.parse(JSON.stringify(rows)) as any[][] }
}

function sheetCellPlainValue(cell: any) {
  if (cell == null) return null
  if (typeof cell === 'object') return cell.v ?? cell.m ?? null
  return cell
}

function compareSheetRowsByFirstColumn(a: any[], b: any[], ascending: boolean): number {
  const av = sheetCellPlainValue(a?.[0])
  const bv = sheetCellPlainValue(b?.[0])
  const aEmpty = av == null || av === ''
  const bEmpty = bv == null || bv === ''
  // Empty rows always sink to the bottom, regardless of direction
  if (aEmpty || bEmpty) return aEmpty && bEmpty ? 0 : aEmpty ? 1 : -1
  const an = Number(av)
  const bn = Number(bv)
  const cmp =
    Number.isFinite(an) && Number.isFinite(bn)
      ? an - bn
      : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
  return ascending ? cmp : -cmp
}

function sortSheetSelectionRows(ascending: boolean): boolean {
  return (
    withSheetMethods((methods) => {
      const data = readSheetSelectionMatrix(methods)
      if (!data || !methods.setCellValuesByRange) return false
      const sorted = [...data.rows].sort((a, b) => compareSheetRowsByFirstColumn(a, b, ascending))
      methods.setCellValuesByRange(sorted, data.indices.range as any)
      methods.calculateFormula?.()
      return true
    }) ?? false
  )
}

function sheetRowSignature(row: any[]): string {
  return JSON.stringify((row || []).map(sheetCellPlainValue))
}

function removeSheetDuplicateRows(): boolean {
  return (
    withSheetMethods((methods) => {
      const data = readSheetSelectionMatrix(methods)
      if (!data || !methods.setCellValuesByRange) return false
      const width = data.rows.reduce((max, row) => Math.max(max, row?.length || 0), 0)
      const seen = new Set<string>()
      const kept: any[][] = []
      for (const row of data.rows) {
        const signature = sheetRowSignature(row)
        if (seen.has(signature)) continue
        seen.add(signature)
        kept.push(row)
      }
      if (kept.length === data.rows.length) return true
      while (kept.length < data.rows.length) kept.push(new Array(width).fill(null))
      methods.setCellValuesByRange(kept, data.indices.range as any)
      methods.calculateFormula?.()
      return true
    }) ?? false
  )
}

function highlightSheetDuplicateRows(color = '#FFC7CE'): boolean {
  return (
    withSheetMethods((methods) => {
      const data = readSheetSelectionMatrix(methods)
      if (!data || !methods.setCellFormatByRange) return false
      const counts = new Map<string, number>()
      for (const row of data.rows) {
        const signature = sheetRowSignature(row)
        counts.set(signature, (counts.get(signature) || 0) + 1)
      }
      const { rowStart, columnStart, columnEnd } = data.indices
      data.rows.forEach((row, offset) => {
        if ((counts.get(sheetRowSignature(row)) || 0) < 2) return
        const absoluteRow = rowStart + offset
        methods.setCellFormatByRange?.('bg', color, {
          row: [absoluteRow, absoluteRow],
          column: [columnStart, columnEnd]
        } as any)
      })
      return true
    }) ?? false
  )
}

async function splitSheetTextToColumns(): Promise<boolean> {
  const methods = getActiveSheetMethods()
  if (!methods?.setCellValue) return false
  const indices = getSheetRangeIndices(methods)
  if (!indices) return false
  const delimiter = await openTextInputModal({
    title: t('Text to Columns'),
    message: t(
      'Values in the first selected column will be split into the columns on their right.'
    ),
    placeholder: ',',
    defaultValue: ',',
    confirmText: t('Split'),
    cancelText: t('Cancel')
  })
  if (delimiter == null || delimiter === '') return false
  const { rowStart, rowEnd, columnStart } = indices
  for (let row = rowStart; row <= rowEnd; row++) {
    const cell = methods.getCellValue?.(row, columnStart)
    const raw = sheetCellPlainValue(cell)
    if (raw == null || raw === '') continue
    const parts = String(raw).split(delimiter)
    if (parts.length < 2) continue
    parts.forEach((part, offset) => {
      methods.setCellValue?.(row, columnStart + offset, part.trim())
    })
  }
  methods.calculateFormula?.()
  return true
}

function fillSheetSelection(mode: 'down' | 'right' | 'series'): boolean {
  return (
    withSheetMethods((methods) => {
      const indices = getSheetRangeIndices(methods)
      if (!indices) return false
      const { rowStart, rowEnd, columnStart, columnEnd } = indices

      if (mode === 'right') {
        if (columnEnd <= columnStart) return false
        const copyRange = { row: [rowStart, rowEnd], column: [columnStart, columnStart] }
        const applyRange = { row: [rowStart, rowEnd], column: [columnStart + 1, columnEnd] }
        methods.autoFillCell?.(copyRange, applyRange, 'right')
      } else {
        if (rowEnd <= rowStart) return false
        // 'series' seeds the autofill with the first two rows so FortuneSheet
        // extends the progression instead of copying a single value
        const seedEnd = mode === 'series' && rowEnd > rowStart + 1 ? rowStart + 1 : rowStart
        const copyRange = { row: [rowStart, seedEnd], column: [columnStart, columnEnd] }
        const applyRange = { row: [seedEnd + 1, rowEnd], column: [columnStart, columnEnd] }
        methods.autoFillCell?.(copyRange, applyRange, 'down')
      }
      methods.calculateFormula?.()
      return true
    }) ?? false
  )
}

function formatSheetSelectionAsTable(): boolean {
  return (
    withSheetMethods((methods) => {
      const indices = getSheetRangeIndices(methods)
      if (!indices || !methods.setCellFormatByRange) return false
      const { rowStart, rowEnd, columnStart, columnEnd } = indices
      const headerRange = { row: [rowStart, rowStart], column: [columnStart, columnEnd] } as any
      methods.setCellFormatByRange('bg', '#4472C4', headerRange)
      methods.setCellFormatByRange('fc', '#FFFFFF', headerRange)
      methods.setCellFormatByRange('bl', 1, headerRange)
      for (let row = rowStart + 1; row <= rowEnd; row++) {
        const banded = (row - rowStart) % 2 === 0
        methods.setCellFormatByRange('bg', banded ? '#D9E1F2' : null, {
          row: [row, row],
          column: [columnStart, columnEnd]
        } as any)
      }
      return true
    }) ?? false
  )
}

const RECENT_SHEET_FUNCTIONS_KEY = 'dynadoc.sheet.recentFunctions'

function getRecentSheetFunctions(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SHEET_FUNCTIONS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}

function pushRecentSheetFunction(name: string) {
  if (!name) return
  try {
    const next = [name, ...getRecentSheetFunctions().filter((fn) => fn !== name)].slice(0, 8)
    localStorage.setItem(RECENT_SHEET_FUNCTIONS_KEY, JSON.stringify(next))
  } catch {
    // localStorage unavailable — recent list is a convenience only
  }
}

async function promptInsertSheetFunction(fnName?: string): Promise<boolean> {
  const methods = getActiveSheetMethods()
  if (!methods?.setCellValue) return false
  const indices = getSheetRangeIndices(methods)
  const hasMultiCellSelection =
    !!indices && (indices.rowEnd > indices.rowStart || indices.columnEnd > indices.columnStart)
  const rangeArg = hasMultiCellSelection
    ? buildA1Range(indices!.rowStart, indices!.columnStart, indices!.rowEnd, indices!.columnEnd)
    : ''
  const defaultFormula = fnName ? `=${fnName}(${rangeArg})` : `=SUM(${rangeArg})`
  const value = await openTextInputModal({
    title: t('Insert Function'),
    message: t('Edit the formula, then apply it to the active cell.'),
    placeholder: '=SUM(A1:A5)',
    defaultValue: defaultFormula,
    confirmText: t('Insert'),
    cancelText: t('Cancel')
  })
  if (!value) return false
  const trimmed = value.trim()
  const formula = trimmed.startsWith('=') ? trimmed : `=${trimmed}`
  // When the formula consumes the selected range, write the result just
  // below it so the formula does not reference its own cell
  const targetRow = hasMultiCellSelection ? indices!.rowEnd + 1 : (indices?.rowStart ?? 0)
  const targetColumn = indices?.columnStart ?? 0
  methods.setCellValue(targetRow, targetColumn, formula)
  methods.calculateFormula?.()
  const match = /^=\s*([A-Z][A-Z0-9.]*)\s*\(/i.exec(formula)
  if (match) pushRecentSheetFunction(match[1].toUpperCase())
  return true
}

function recalcActiveSheet(): boolean {
  return (
    withSheetMethods((methods) => {
      if (!methods.calculateFormula) return false
      methods.calculateFormula()
      return true
    }) ?? false
  )
}

function promptNumberInput(
  title: string,
  message: string,
  placeholder: string,
  defaultValue: string
): Promise<number | null> {
  return openTextInputModal({
    title,
    message,
    placeholder,
    defaultValue,
    confirmText: t('Apply'),
    cancelText: t('Cancel')
  }).then((value) => {
    if (value == null) return null
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  })
}

function applySheetFormat(attr: string, value: any): boolean {
  const methods = getActiveSheetMethods()
  if (!methods) return false

  const range = getSheetSelectionRange(methods)
  if (range && methods.setCellFormatByRange) {
    methods.setCellFormatByRange(attr, value, range)
    return true
  }

  if (methods.setCellFormat) {
    const row = range?.row?.[0] ?? 0
    const column = range?.column?.[0] ?? 0
    methods.setCellFormat(row, column, attr, value)
    return true
  }

  return false
}

function withSheetMethods<T>(
  callback: (methods: NonNullable<ReturnType<typeof getActiveSheetMethods>>) => T
) {
  const methods = getActiveSheetMethods()
  if (!methods) return null
  return callback(methods)
}

function applyListStyle1(
  type: 'bulletList' | 'orderedList' | 'taskList',
  styleType?: string,
  preset?: string,
  position: 'inside' | 'outside' = 'outside'
): boolean {
  const editor = getActiveEditorInstance()
  if (!editor) return false

  if (!editor.isActive(type)) {
    switch (type) {
      case 'bulletList':
        editor.chain().focus().toggleBulletList().run()
        break
      case 'orderedList':
        editor.chain().focus().toggleOrderedList().run()
        break
      case 'taskList':
        editor.chain().focus().toggleTaskList().run()
        break
    }
  }

  return editor.commands.updateAttributes(type, {
    listStyleType: styleType || null,
    listStylePosition: position,
    listPreset: preset || null
  })
}

function applyListStyle(
  type: 'bulletList' | 'orderedList' | 'taskList',
  styleType?: string,
  preset?: string,
  position: 'inside' | 'outside' = 'outside'
): boolean {
  const editor = getActiveEditorInstance()
  if (!editor) return false

  const chain = editor.chain().focus()

  // 1. If the current list type is not active, toggle it on.
  // This ensures we are inside the correct <ul>, <ol>, or task list.
  if (!editor.isActive(type)) {
    switch (type) {
      case 'bulletList':
        chain.toggleBulletList()
        break
      case 'orderedList':
        chain.toggleOrderedList()
        break
      case 'taskList':
        chain.toggleTaskList()
        break
    }
  }

  /**
   * 2. Apply the attributes.
   * Note: We map your arguments to the schema keys:
   * 'styleType' -> Controls CSS list-style-type
   * 'preset'    -> Controls data-list-preset for Legal/Outline/Tree
   * 'position'  -> Controls CSS list-style-position
   */
  return chain
    .updateAttributes(type, {
      styleType: styleType || null,
      preset: preset || null,
      stylePosition: position // Mapping 'position' to 'stylePosition'
    })
    .run()
}

function updateOrderedListStart(
  start: number | null,
  continueAuto: boolean | null = null
): boolean {
  const editor = getActiveEditorInstance()
  if (!editor) return false
  const chain = editor.chain().focus()
  if (!editor.isActive('orderedList')) {
    chain.toggleOrderedList()
  }
  const attrs: Record<string, any> = {
    start: start === null ? null : start
  }
  if (continueAuto !== null) {
    attrs.continueAuto = continueAuto
  }
  return chain.updateAttributes('orderedList', attrs).run()
}

function isMarkerSelected(editor: Editor): boolean {
  console.log('isMarkerSelected')
  const { selection } = editor.state
  if (selection instanceof NodeSelection && selection.node.type?.name === 'listItem') return true
  const markerState = listMarkerSelectionKey.getState(editor.state)
  console.log('isMarkerSelected', { markerState, selection }, editor.isActive('orderedList'))

  if (markerState?.listPos != null) return true
  if (!selection.empty && (editor.isActive('orderedList') || editor.isActive('bulletList')))
    return true
  return false
}

function updateListItemsInSelection(editor: Editor, attrs: Record<string, any>): boolean {
  const { selection } = editor.state
  const tr = editor.state.tr
  let updated = false

  if (selection instanceof NodeSelection && selection.node.type?.name === 'listItem') {
    tr.setNodeMarkup(selection.from, undefined, { ...selection.node.attrs, ...attrs })
    updated = true
  } else {
    editor.state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.type?.name === 'listItem') {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs })
        updated = true
      }
    })
  }

  if (!updated) return false
  editor.view.dispatch(tr)
  editor.commands.focus()
  return true
}

function executeFormatting(editor: Editor, commandName: string, value?: any): boolean {
  if (!isMarkerSelected(editor)) return false

  let firstNodeAttrs: Record<string, any> | null = null
  const { selection } = editor.state
  if (selection instanceof NodeSelection && selection.node.type?.name === 'listItem') {
    firstNodeAttrs = selection.node.attrs || {}
  } else {
    editor.state.doc.nodesBetween(selection.from, selection.to, (node) => {
      if (!firstNodeAttrs && node.type?.name === 'listItem') {
        firstNodeAttrs = node.attrs || {}
      }
    })
  }

  const attrs: Record<string, any> = {}

  switch (commandName) {
    case 'bold': {
      const current = (firstNodeAttrs?.markerWeight || '').toString()
      const isBold = current === 'bold' || current === '700'
      attrs.markerWeight = isBold ? 'normal' : 'bold'
      break
    }
    case 'italic': {
      const current = (firstNodeAttrs?.markerStyle || '').toString()
      attrs.markerStyle = current === 'italic' ? 'normal' : 'italic'
      break
    }
    case 'underline': {
      const current = (firstNodeAttrs?.markerDecoration || '').toString()
      const parts = current ? current.split(' ') : []
      const has = parts.includes('underline')
      const next = has ? parts.filter((p) => p !== 'underline') : [...parts, 'underline']
      attrs.markerDecoration = next.length ? next.join(' ') : 'none'
      break
    }
    case 'strike': {
      const current = (firstNodeAttrs?.markerDecoration || '').toString()
      const parts = current ? current.split(' ') : []
      const has = parts.includes('line-through')
      const next = has ? parts.filter((p) => p !== 'line-through') : [...parts, 'line-through']
      attrs.markerDecoration = next.length ? next.join(' ') : 'none'
      break
    }
    case 'color':
      attrs.markerColor = value
      break
    case 'highlight':
      attrs.markerBg = value
      break
    case 'fontSize':
      attrs.markerSize = value
      break
    case 'fontFamily':
      attrs.markerFont = value
      break
    case 'resetMarker':
      attrs.markerWeight = null
      attrs.markerStyle = null
      attrs.markerDecoration = null
      attrs.markerColor = null
      attrs.markerBg = null
      attrs.markerFont = null
      attrs.markerShadow = null
      attrs.markerTransform = null
      attrs.matchContent = true
      break
    default:
      break
  }

  if (Object.keys(attrs).length) {
    if (commandName !== 'resetMarker') attrs.matchContent = false
    return updateListItemsInSelection(editor, attrs)
  }
  return false
}

function updateListMarkerStyle(attrs: {
  markerColor?: string | null
  markerSize?: string | null
  markerWeight?: string | null
  markerFont?: string | null
  markerStyle?: string | null
  markerDecoration?: string | null
  markerBg?: string | null
  markerShadow?: string | null
  markerTransform?: string | null
  matchContent?: boolean
}): boolean {
  const editor = getActiveEditorInstance()
  if (!editor) return false
  const inAnyList =
    editor.isActive('orderedList') || editor.isActive('bulletList') || editor.isActive('taskList')
  if (!inAnyList) return false
  if (isMarkerSelected(editor)) {
    return updateListItemsInSelection(editor, attrs)
  }
  return editor.chain().focus().updateAttributes('listItem', attrs).run()
}

function getPreviousOrderedListContinuation(editor: Editor): number | null {
  const { doc, selection } = editor.state
  let lastListNode: { node: any; pos: number } | null = null

  doc.nodesBetween(0, selection.from, (node, pos) => {
    if (node.type.name === 'orderedList') {
      lastListNode = { node, pos }
    }
  })

  if (!lastListNode) return null
  const listNode = lastListNode.node
  const start = Number.isFinite(listNode.attrs?.start) ? listNode.attrs.start : 1
  let count = 0
  listNode.forEach((child: any) => {
    if (child.type?.name === 'listItem') count += 1
  })
  if (!count) return null
  return start + count
}

function runClipboardCommand(command: 'copy' | 'cut' | 'paste'): boolean {
  try {
    return Boolean(document.execCommand(command))
  } catch {
    return false
  }
}

async function readClipboardFilePath(): Promise<string | null> {
  let text = ''
  try {
    const payload = await EditorCommonUtils.readFromClipboard()
    text = payload.text || ''
  } catch {
    text = ''
  }

  let cleaned = (text || '').trim()
  if (!cleaned) return null

  cleaned = cleaned.replace(/^['"]+|['"]+$/g, '')
  cleaned = toLocalPath(cleaned)

  if (/^\/[A-Za-z]:[\\/]/.test(cleaned)) {
    cleaned = cleaned.slice(1)
  }

  const pathApi = nodeApi?.path
  if (pathApi?.normalize) {
    cleaned = pathApi.normalize(cleaned)
  }

  const fsApi = nodeApi?.fs
  if (fsApi?.existsSync && !fsApi.existsSync(cleaned)) return null

  return cleaned || null
}

function normalizeFilePathForCompare(rawPath: string): string {
  const cleaned = (rawPath || '').trim()
  if (!cleaned) return ''
  const pathApi = nodeApi?.path
  if (pathApi?.resolve && pathApi?.normalize) {
    return pathApi.normalize(pathApi.resolve(cleaned))
  }
  return cleaned
}

type DownloadAssetType = (typeof DocumentModel.AssetType)[keyof typeof DocumentModel.AssetType]

function sanitizeFileName(input: string): string {
  const cleaned = (input || '').trim().replace(/[\\/:*?"<>|]+/g, '_')
  return cleaned || `download-${Date.now()}`
}

function getExtensionFromContentType(contentType: string | null): string {
  if (!contentType) return ''
  const type = contentType.split(';')[0]?.trim().toLowerCase() || ''
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'application/pdf': Utils.PDF_EXTENSION,
    'text/plain': '.txt',
    'text/html': '.html',
    'text/markdown': '.md',
    'application/json': '.json',
    'text/csv': '.csv'
  }
  return map[type] || ''
}

async function resolveDownloadDir(assetType: DownloadAssetType): Promise<string> {
  const fsApi = nodeApi?.fs
  const pathApi = nodeApi?.path
  if (!fsApi || !pathApi) return ''

  const doc = DocumentModel.getActiveDocument()
  let dir = ''
  if (doc?.cachePath) {
    dir = doc.getAsset(assetType)
  } else if (window.api?.getCacheDir) {
    const cacheDir = await window.api.getCacheDir()
    dir = pathApi.join(cacheDir, 'external-assets', assetType)
  } else {
    const osTmp = nodeApi?.os?.tmpdir?.() || ''
    dir = pathApi.join(osTmp || '.', 'dynadoc-external-assets', assetType)
  }

  if (!dir) return ''
  // fsApi is nodeApi.fs, which has no async members: the write goes through
  // fsPromises, while existsSync stays as it is -- it keeps its signature on
  // the IPC surface.
  if (!fsApi.existsSync(dir)) await nodeApi.fsPromises.mkdir(dir, { recursive: true })
  return dir
}

function uniqueFilePath(dir: string, fileName: string): string {
  const fsApi = nodeApi?.fs
  const pathApi = nodeApi?.path
  if (!fsApi || !pathApi) return ''
  const base = sanitizeFileName(fileName)
  const ext = pathApi.extname(base)
  const name = ext ? base.slice(0, -ext.length) : base
  let candidate = pathApi.join(dir, base)
  let index = 1
  while (fsApi.existsSync(candidate)) {
    candidate = pathApi.join(dir, `${name}-${index}${ext}`)
    index += 1
  }
  return candidate
}

async function promptForUrl(title: string, message: string): Promise<string | null> {
  const input = await openTextInputModal({
    title,
    message,
    placeholder: 'https://',
    defaultValue: 'https://',
    confirmText: t('Insert'),
    cancelText: t('Cancel')
  })
  const raw = (input || '').trim()
  if (!raw) return null
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

async function downloadUrlToAsset(
  url: string,
  assetType: DownloadAssetType
): Promise<string | null> {
  const fsApi = nodeApi?.fs
  const pathApi = nodeApi?.path
  if (!fsApi || !pathApi) return null
  const dir = await resolveDownloadDir(assetType)
  if (!dir) return null

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download (${response.status})`)
  }

  const contentType = response.headers.get('content-type')
  const urlName = (() => {
    try {
      return pathApi.basename(new URL(url).pathname)
    } catch {
      return ''
    }
  })()
  const extFromUrl = pathApi.extname(urlName)
  const extFromType = getExtensionFromContentType(contentType)
  const ext = extFromUrl || extFromType
  const baseName = urlName ? sanitizeFileName(urlName) : `download-${Date.now()}${ext || ''}`
  const finalName = ext && !baseName.endsWith(ext) ? `${baseName}${ext}` : baseName
  const targetPath = uniqueFilePath(dir, finalName)

  const buffer = Buffer.from(await response.arrayBuffer())
  await nodeApi.fsPromises.writeFile(targetPath, buffer)
  return targetPath
}

function hasIncludedFile(path: string): boolean {
  const editor = getActiveEditorInstance()
  if (!editor) return false
  const target = normalizeFilePathForCompare(path)
  if (!target) return false

  let exists = false
  editor.state.doc.descendants((node) => {
    if (node.type?.name !== 'fileInclude') return true
    const nodePath = normalizeFilePathForCompare(node.attrs?.sourcePath || '')
    if (nodePath && nodePath === target) {
      exists = true
      return false
    }
    return true
  })

  return exists
}

function getDynamicReferenceEditorId(editor: Editor | undefined): string {
  const ext = editor?.extensionManager?.extensions?.find?.((item: any) => item?.name === 'ref')
  return ext?.options?.editorId || 'external'
}

function registerExternalReference(editor: Editor | undefined, filePath: string) {
  if (!editor) return
  const editorId = getDynamicReferenceEditorId(editor)
  const displayName = nodeApi?.path?.basename?.(filePath) || filePath
  const html = `<span>${displayName}</span>`

  _$_wysiwygEditorDynamicReferenceIndexes.update((currentMap) => {
    const next = new Map(currentMap)
    const editorMap = new Map(next.get(editorId) || new Map())
    editorMap.set(filePath, {
      id: filePath,
      text: displayName,
      html,
      display: displayName,
      type: 'external'
    })
    next.set(editorId, editorMap)
    return next
  })
}

function getActiveEditorContext() {
  let activeWysiwyg = get(_$_wysiwygEditorsList.getActive())
  let editor: Editor | undefined

  if (activeWysiwyg?.editor) {
    editor = activeWysiwyg.editor
  } else {
    const activeDoc = get(_$_documentEditorsList.getActive())
    if (!activeDoc) return null
    editor = _$_wysiwygEditorsList.getItem(activeDoc.id)
    activeWysiwyg = _$_wysiwygEditorsList.getEntry(activeDoc.id)
  }

  if (!editor || !activeWysiwyg) return null
  const activeNodeview = _$_wysiwygEditorsList.getActiveNodeview(activeWysiwyg.id)
  return { editor, activeWysiwyg, activeNodeview }
}

function serializeSelection(editor: Editor) {
  const { selection } = editor.state
  if (selection.empty) return null
  const slice = editor.state.doc.slice(selection.from, selection.to)
  const serializer = DOMSerializer.fromSchema(editor.schema)
  const fragment = serializer.serializeFragment(slice.content)
  const wrapper = document.createElement('div')
  wrapper.appendChild(fragment)
  const html = wrapper.innerHTML
  const text = slice.content.textBetween(0, slice.content.size, '\n\n')
  return { html, text }
}

function resolveVariableText(node: any, documentEditor: any) {
  const name =
    node?.attrs?.[CustomVarExtensionProps.tagAttributeName] ||
    node?.attrs?.name ||
    node?.attrs?.variable
  if (!name) return ''
  const resolved = getVariable(name, documentEditor)
  if (resolved === null || resolved === undefined) return ''
  if (
    typeof resolved === 'string' ||
    typeof resolved === 'number' ||
    typeof resolved === 'boolean'
  ) {
    return String(resolved)
  }
  if (typeof resolved === 'object') {
    if ('url' in resolved && resolved.url) return String(resolved.url)
    if ('path' in resolved && resolved.path) return String(resolved.path)
    if ('value' in resolved && resolved.value) return String(resolved.value)
    return JSON.stringify(resolved)
  }
  return ''
}

function serializeSelectionAsText(editor: Editor, documentEditor: any) {
  const { selection } = editor.state
  if (selection.empty) return null
  const slice = editor.state.doc.slice(selection.from, selection.to)
  const text = slice.content.textBetween(0, slice.content.size, '\n\n', (node) => {
    if (node?.type?.name === CustomVarExtensionProps.name) {
      return resolveVariableText(node, documentEditor)
    }
    if (node?.isAtom && node?.type?.name !== 'text') {
      if (node?.attrs?.url) return String(node.attrs.url)
      if (node?.attrs?.src) return String(node.attrs.src)
      if (node?.attrs?.href) return String(node.attrs.href)
      if (node?.attrs?.path) return String(node.attrs.path)
      if (node?.textContent) return node.textContent
      return `[${node.type?.name ?? 'node'}]`
    }
    return undefined
  })
  return { text }
}

async function copyToClipboard(): Promise<boolean> {
  const context = getActiveEditorContext()
  if (!context) return false
  if (context.activeNodeview) {
    _$_canvasCommands.executeCommand(context.activeNodeview.id, 'copy')
    return true
  }

  context.editor.commands.focus()
  const serialized = serializeSelection(context.editor)
  if (!serialized) return runClipboardCommand('copy')

  try {
    await EditorCommonUtils.copyToClipboard({
      text: serialized.text || '',
      html: serialized.html || undefined
    })
    return true
  } catch {
    // fall through
  }

  return runClipboardCommand('copy')
}

async function copySelectionAsText(): Promise<boolean> {
  const context = getActiveEditorContext()
  if (!context) return false
  if (context.activeNodeview) {
    _$_canvasCommands.executeCommand(context.activeNodeview.id, 'copy')
    return true
  }

  context.editor.commands.focus()
  const serialized = serializeSelectionAsText(
    context.editor,
    context.activeDoc?.document || context.activeDoc
  )
  if (!serialized) return runClipboardCommand('copy')

  try {
    await EditorCommonUtils.copyToClipboard(serialized.text || '')
    return true
  } catch {
    // fall through
  }

  return runClipboardCommand('copy')
}

async function cutToClipboard(): Promise<boolean> {
  const context = getActiveEditorContext()
  if (!context) return false
  if (context.activeNodeview) {
    _$_canvasCommands.executeCommand(context.activeNodeview.id, 'cut')
    return true
  }

  const copied = await copyToClipboard()
  if (!copied) return false
  return context.editor.chain().focus().deleteSelection().run()
}

async function pasteFromClipboard(): Promise<boolean> {
  const context = getActiveEditorContext()
  if (!context) return false
  if (context.activeNodeview) {
    _$_canvasCommands.executeCommand(context.activeNodeview.id, 'paste')
    return true
  }

  const editor = context.editor
  editor.commands.focus()
  try {
    const payload = await EditorCommonUtils.readFromClipboard({ mode: 'rich' })
    if (payload.imageDataUrl) {
      const inserted =
        typeof (editor.commands as any).insertImage === 'function'
          ? (editor.commands as any).insertImage({ src: payload.imageDataUrl })
          : editor.chain().focus().insertContent(`<img src="${payload.imageDataUrl}" />`).run()
      if (inserted) return true
    }
    if (payload.html) {
      editor.chain().focus().insertContent(payload.html).run()
      return true
    }
    if (payload.text) {
      return editor.chain().focus().insertContent(payload.text).run()
    }
  } catch {
    // fall through
  }

  return runClipboardCommand('paste')
}

async function pasteFromClipboardAsText(): Promise<boolean> {
  try {
    const { text } = await EditorCommonUtils.readFromClipboard()
    if (!text) return false
    const editor = getActiveEditorInstance()
    if (!editor) return false
    return editor.chain().focus().insertContent(text).run()
  } catch {
    return false
  }
}

export const EditorTableCommands = {
  insertTable: (rows = 3, cols = 3) =>
    executeEditorCommand('insertTable', { rows, cols, withHeaderRow: true }),

  addColumnBefore: () =>
    withSheetMethods((methods) => {
      const range = getSheetRangeIndices(methods)
      if (!range || !methods.insertRowOrColumn) return null
      methods.insertRowOrColumn('column', range.columnStart, 1, 'lefttop')
      return true
    }) || executeEditorCommand('addColumnBefore'),
  addColumnAfter: () =>
    withSheetMethods((methods) => {
      const range = getSheetRangeIndices(methods)
      if (!range || !methods.insertRowOrColumn) return null
      methods.insertRowOrColumn('column', range.columnEnd, 1, 'rightbottom')
      return true
    }) || executeEditorCommand('addColumnAfter'),
  deleteColumn: () =>
    withSheetMethods((methods) => {
      const range = getSheetRangeIndices(methods)
      if (!range || !methods.deleteRowOrColumn) return null
      methods.deleteRowOrColumn('column', range.columnStart, range.columnEnd)
      return true
    }) || executeEditorCommand('deleteColumn'),

  addRowBefore: () =>
    withSheetMethods((methods) => {
      const range = getSheetRangeIndices(methods)
      if (!range || !methods.insertRowOrColumn) return null
      methods.insertRowOrColumn('row', range.rowStart, 1, 'lefttop')
      return true
    }) || executeEditorCommand('addRowBefore'),
  addRowAfter: () =>
    withSheetMethods((methods) => {
      const range = getSheetRangeIndices(methods)
      if (!range || !methods.insertRowOrColumn) return null
      methods.insertRowOrColumn('row', range.rowEnd, 1, 'rightbottom')
      return true
    }) || executeEditorCommand('addRowAfter'),
  deleteRow: () =>
    withSheetMethods((methods) => {
      const range = getSheetRangeIndices(methods)
      if (!range || !methods.deleteRowOrColumn) return null
      methods.deleteRowOrColumn('row', range.rowStart, range.rowEnd)
      return true
    }) || executeEditorCommand('deleteRow'),

  deleteTable: () => executeEditorCommand('deleteTable'),

  mergeCells: () =>
    withSheetMethods((methods) => {
      const range = getSheetRangeIndices(methods)
      if (!range || !methods.mergeCells) return null
      methods.mergeCells([range.range], 'mergeAll')
      return true
    }) || executeEditorCommand('mergeCells'),
  mergeCellsHorizontal: () =>
    withSheetMethods((methods) => {
      const range = getSheetRangeIndices(methods)
      if (!range || !methods.mergeCells) return null
      methods.mergeCells([range.range], 'mergeH')
      return true
    }) || executeEditorCommand('mergeCells'),
  mergeCellsVertical: () =>
    withSheetMethods((methods) => {
      const range = getSheetRangeIndices(methods)
      if (!range || !methods.mergeCells) return null
      methods.mergeCells([range.range], 'mergeV')
      return true
    }) || executeEditorCommand('mergeCells'),
  splitCell: () =>
    withSheetMethods((methods) => {
      const range = getSheetRangeIndices(methods)
      if (!range || !methods.cancelMerge) return null
      methods.cancelMerge([range.range])
      return true
    }) || executeEditorCommand('splitCell'),
  mergeOrSplit: () => executeEditorCommand('mergeOrSplit'),

  toggleHeaderColumn: () => executeEditorCommand('toggleHeaderColumn'),
  toggleHeaderRow: () => executeEditorCommand('toggleHeaderRow'),
  toggleHeaderCell: () => executeEditorCommand('toggleHeaderCell'),

  setCellAttribute: (attribute: string, value: any) =>
    executeEditorCommand('setCellAttribute', attribute, value),

  setCellBackground: (color: string) =>
    executeEditorCommand('setCellAttribute', 'backgroundColor', color),

  goToNextCell: () => executeEditorCommand('goToNextCell'),
  goToPreviousCell: () => executeEditorCommand('goToPreviousCell'),
  fixTables: () => executeEditorCommand('fixTables'),
  openTableProperties: async () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const target = findTableAtSelection(editor)
    if (!target) {
      toast.error(t('Please place the cursor inside a table.'))
      return false
    }
    await openAlertModal({
      title: t('Table Properties'),
      message: t('Table properties dialog is coming soon.')
    })
    return true
  },
  toggleTableGridlines: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const root = editor.view?.dom
    if (!root) return false
    root.classList.toggle('table-gridlines')
    return true
  },
  drawTableMode: async () => {
    await openAlertModal({
      title: t('Draw Table'),
      message: t('Draw table mode is not available yet.')
    })
    return true
  },
  tableEraserMode: async () => {
    await openAlertModal({
      title: t('Table Eraser'),
      message: t('Table eraser mode is not available yet.')
    })
    return true
  },
  splitTable: async () => {
    await openAlertModal({
      title: t('Split Table'),
      message: t('Split table will be supported in a later update.')
    })
    return true
  },
  setTableRowHeight: async (value: number) => {
    await openAlertModal({
      title: t('Row Height'),
      message: `${t('Set row height to')} ${value}`
    })
    return true
  },
  setTableColumnWidth: async (value: number) => {
    await openAlertModal({
      title: t('Column Width'),
      message: `${t('Set column width to')} ${value}`
    })
    return true
  },
  setTableStylePreset: (preset: string) => updateTableAttrs({ stylePreset: preset }),
  toggleTableStyleOption: (option: string) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const target = findTableAtSelection(editor)
    if (!target) {
      toast.error(t('Please place the cursor inside a table.'))
      return false
    }
    const current = Boolean((target.node?.attrs || {})[option])
    return updateTableAttrs({ [option]: !current })
  },
  setTableStyleOption: (option: string, value: boolean) => updateTableAttrs({ [option]: value }),
  setTableBorderColor: (color: string) => updateTableAttrs({ borderColor: color }),
  setTableBorderWeight: (weight: number) => updateTableAttrs({ borderWidth: weight }),
  setTableShadingColor: (color: string) => updateTableAttrs({ shadingColor: color }),
  clearTableStyle: () =>
    updateTableAttrs({
      stylePreset: 'plain',
      headerRow: false,
      totalRow: false,
      firstColumn: false,
      lastColumn: false,
      bandedRows: false,
      bandedColumns: false,
      borderColor: null,
      shadingColor: null
    }),
  repeatHeaderRows: () => executeEditorCommand('toggleHeaderRow'),
  convertTableToText: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const target = findTableAtSelection(editor)
    if (!target) {
      toast.error(t('Please place the cursor inside a table.'))
      return false
    }
    const rows: string[] = []
    target.node.forEach((row) => {
      const cells: string[] = []
      row.forEach((cell) => {
        const text = cell.textBetween(0, cell.content.size, ' ')
        cells.push(text)
      })
      rows.push(cells.join('\t'))
    })
    const text = rows.join('\n')
    const tr = editor.state.tr.delete(target.pos, target.pos + target.node.nodeSize)
    const nextPos = Math.min(target.pos, tr.doc.content.size)
    tr.setSelection(TextSelection.create(tr.doc, nextPos))
    editor.view.dispatch(tr)
    return editor.chain().focus().insertContent(text).run()
  },
  fastCalculation: async () => {
    await openAlertModal({
      title: t('Fast Calculation'),
      message: t('Fast calculation tools will be available soon.')
    })
    return true
  },
  selectTable: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const target = findTableAtSelection(editor)
    if (!target) {
      toast.error(t('Please place the cursor inside a table.'))
      return false
    }
    const tr = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, target.pos))
    editor.view.dispatch(tr)
    return editor.commands.scrollIntoView()
  },
  selectTableRow: async () => {
    await openAlertModal({
      title: t('Select Row'),
      message: t('Row selection is coming soon.')
    })
    return true
  },
  selectTableColumn: async () => {
    await openAlertModal({
      title: t('Select Column'),
      message: t('Column selection is coming soon.')
    })
    return true
  },
  selectTableCell: async () => {
    await openAlertModal({
      title: t('Select Cell'),
      message: t('Cell selection helpers are coming soon.')
    })
    return true
  },
  setImageAlign: (align: 'left' | 'center' | 'right') => updateImageAttrs({ align }),
  setImageWrap: (wrap: 'inline' | 'square' | 'tight' | 'behind' | 'infront') =>
    updateImageAttrs({ wrap }),
  setImageBorder: (color: string, width = 1) =>
    updateImageAttrs({ borderColor: color, borderWidth: width }),
  setImageShadow: (shadow: string) => updateImageAttrs({ shadow }),
  setImageFilter: (filter: string) => updateImageAttrs({ filter }),
  setImageRotate: (rotate: number) => updateImageAttrs({ rotate }),
  setImageRadius: (radius: string) => updateImageAttrs({ radius }),
  setImageOpacity: (opacity: number) => updateImageAttrs({ opacity }),
  setImageSize: (width?: number, height?: number) =>
    updateImageAttrs({
      ...(typeof width === 'number' ? { width } : {}),
      ...(typeof height === 'number' ? { height } : {})
    }),
  resetImageStyles: () =>
    updateImageAttrs({
      align: null,
      wrap: null,
      borderColor: null,
      borderWidth: null,
      shadow: null,
      filter: null,
      rotate: null,
      radius: null,
      opacity: null,
      lockAspectRatio: null
    }),
  setImageLockAspectRatio: (locked: boolean) => updateImageAttrs({ lockAspectRatio: locked }),
  resetImageSize: () => updateImageAttrs({ width: null, height: null }),
  openImageCrop: async () => {
    await openAlertModal({
      title: t('Crop Picture'),
      message: t('Crop tool is coming soon.')
    })
    return true
  },
  previewPicture: async () => {
    await openAlertModal({
      title: t('Picture Preview'),
      message: t('Picture preview will open in a new viewer soon.')
    })
    return true
  },
  setImageTransparentColor: async () => {
    await openAlertModal({
      title: t('Set Transparent Color'),
      message: t('Transparent color picker is coming soon.')
    })
    return true
  },
  openSelectionPane: () => {
    _$_secondarySidebarVisible.set(true)
    _$_activeSecondarySidebarItem.set('layers')
    return true
  },
  openPictureSettings: async () => {
    await openAlertModal({
      title: t('Picture Settings'),
      message: t('Picture settings panel is coming soon.')
    })
    return true
  },
  compressPictures: async () => {
    await openAlertModal({
      title: t('Compress Pictures'),
      message: t('Picture compression will be available soon.')
    })
    return true
  },
  groupSelection: async () => {
    await openAlertModal({
      title: t('Group'),
      message: t('Grouping will be available soon.')
    })
    return true
  },
  ungroupSelection: async () => {
    await openAlertModal({
      title: t('Ungroup'),
      message: t('Ungrouping will be available soon.')
    })
    return true
  },
  bringForward: async () => {
    await openAlertModal({
      title: t('Bring Forward'),
      message: t('Layer ordering will be available soon.')
    })
    return true
  },
  sendBackward: async () => {
    await openAlertModal({
      title: t('Send Backward'),
      message: t('Layer ordering will be available soon.')
    })
    return true
  },
  bringToFront: async () => {
    await openAlertModal({
      title: t('Bring to Front'),
      message: t('Layer ordering will be available soon.')
    })
    return true
  },
  sendToBack: async () => {
    await openAlertModal({
      title: t('Send to Back'),
      message: t('Layer ordering will be available soon.')
    })
    return true
  },
  setSlideTransition: (transition: string | null) => updateSlideAttrs({ transition }),
  setSlideTransitionDuration: (duration: number) =>
    updateSlideAttrs({ transitionDuration: duration }),
  setSlideTransitionSound: (sound: string | null) => updateSlideAttrs({ transitionSound: sound }),
  setSlideAdvance: (mode: 'click' | 'after') => updateSlideAttrs({ transitionAdvance: mode }),
  setSlideAdvanceAfter: (seconds: number | null) =>
    updateSlideAttrs({ transitionAdvanceAfter: seconds }),
  applySlideTransitionToAll: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const target = resolvePositionableNodeTarget(editor)
    if (!target || target.type !== CustomSlideExtensionProps.name) {
      toast.error(t('Please select a slide.'))
      return false
    }
    const attrs = target.node?.attrs || {}
    const tr = editor.state.tr
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== CustomSlideExtensionProps.name) return true
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        transition: attrs.transition,
        transitionDuration: attrs.transitionDuration,
        transitionSound: attrs.transitionSound,
        transitionAdvance: attrs.transitionAdvance,
        transitionAdvanceAfter: attrs.transitionAdvanceAfter
      })
      return true
    })
    if (!tr.docChanged) return false
    editor.view.dispatch(tr)
    return true
  },
  previewSlideTransition: async () => {
    await openAlertModal({
      title: t('Preview Transition'),
      message: t('Transition preview will be available soon.')
    })
    return true
  },
  setAnimationStart: (start: 'on-click' | 'with-previous' | 'after-previous') =>
    updateSelectedShapeAnimation({ start }) || executeEditorCommand('updateAnimation', { start }),
  setAnimationDuration: (duration: number) =>
    updateSelectedShapeAnimation({ duration }) ||
    executeEditorCommand('updateAnimation', { duration }),
  setAnimationDelay: (delay: number) =>
    updateSelectedShapeAnimation({ delay }) || executeEditorCommand('updateAnimation', { delay }),
  setAnimationTextMode: (text: string) =>
    updateSelectedShapeAnimation({ text }) || executeEditorCommand('updateAnimation', { text }),
  setAnimationEffectOptions: (type: string) =>
    updateSelectedShapeAnimation({ type }) || executeEditorCommand('updateAnimation', { type }),
  setShapeFill: (color: string) => updateSelectedShapes({ fill: color }) || false,
  setShapeOutline: (color: string) =>
    updateSelectedShapes({ stroke: color, strokeWidth: 1 }) || false,
  setShapeEffects: (effect: string) =>
    updateSelectedShapes({
      shadowColor: effect === 'shadow' ? 'rgba(0,0,0,0.35)' : null,
      shadowBlur: effect === 'shadow' ? 12 : 0
    }) || false,
  setShapeSize: (w?: number, h?: number) => {
    const props: Record<string, any> = {}
    if (typeof w === 'number') props.w = w
    if (typeof h === 'number') props.h = h
    if (!Object.keys(props).length) return false
    return updateSelectedShapes(props)
  },
  rotateSelectedShape: (delta: number) => {
    const canvas = getActiveCanvasCommands()
    if (!canvas) return false
    canvas.rotateSelected?.(delta)
    return true
  },
  alignSelectedShape: (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const canvas = getActiveCanvasCommands()
    if (!canvas) return false
    canvas.alignSelected?.(mode)
    return true
  },
  bringForwardSelected: () => {
    const canvas = getActiveCanvasCommands()
    if (!canvas) return false
    canvas.bringForward?.()
    return true
  },
  sendBackwardSelected: () => {
    const canvas = getActiveCanvasCommands()
    if (!canvas) return false
    canvas.sendBackward?.()
    return true
  },
  editShape: async () => {
    await openAlertModal({
      title: t('Edit Shape'),
      message: t('Edit shape options are coming soon.')
    })
    return true
  },
  mergeShapes: async () => {
    await openAlertModal({ title: t('Merge Shapes'), message: t('Merge shapes is coming soon.') })
    return true
  },
  openShapeSettings: async () => {
    await openAlertModal({
      title: t('Settings'),
      message: t('Shape settings panel is coming soon.')
    })
    return true
  }
}

const EditorClipboardCommands = {
  copy: () => {
    void copyToClipboard()
    return true
  },
  copyAsText: () => {
    void copySelectionAsText()
    return true
  },
  cut: () => {
    void cutToClipboard()
    return true
  },
  paste: () => {
    void pasteFromClipboard()
    return true
  },
  pasteAsText: () => {
    void pasteFromClipboardAsText()
    return true
  }
}

const EditorNavigationCommands = {
  search: () => {
    if (getActiveSheetMethods()) return false
    const activeDoc = _$_documentEditorsList.getActiveSync()
    openPrimarySearchPane({
      mode: 'text',
      sourcePath: activeDoc?.document?.path || null,
      autoFocus: true
    })
    return true
  },
  replace: () => {
    if (getActiveSheetMethods()) return false
    const activeDoc = _$_documentEditorsList.getActiveSync()
    openPrimarySearchPane({
      mode: 'text',
      sourcePath: activeDoc?.document?.path || null,
      autoFocus: true
    })
    return true
  },
  selectCursorRange: () => executeEditorCommand('selectAll'),
  setDirectionLTR: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    editor.view.dom.setAttribute('dir', 'ltr')
    return editor.commands.focus()
  },
  setDirectionRTL: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    editor.view.dom.setAttribute('dir', 'rtl')
    return editor.commands.focus()
  },
  toggleDirection: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const current = editor.view.dom.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr'
    editor.view.dom.setAttribute('dir', current === 'rtl' ? 'ltr' : 'rtl')
    return editor.commands.focus()
  }
}

const EditorFormattingCommands = {
  specialLineIndent: () => executeEditorCommand('indent'),
  setBordersAll: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    return editor.commands.focus()
  },
  insertHeading: (level = 1) => executeEditorCommand('toggleHeading', { level }),
  insertContent: (content: string) => executeEditorCommand('insertContent', content),
  setPageMargins: (preset: string) => {
    const key = preset?.toString().toLowerCase() as keyof typeof PAGE_MARGIN_PRESETS
    const margins = PAGE_MARGIN_PRESETS[key] ?? PAGE_MARGIN_PRESETS.normal
    executeEditorCommand('updateMargins', margins)
    updatePaginationOptionsInStores({
      marginTop: margins.top,
      marginBottom: margins.bottom,
      marginLeft: margins.left,
      marginRight: margins.right
    })
    return true
  },
  updatePageMargins: (margins: { top: number; bottom: number; left: number; right: number }) => {
    executeEditorCommand('updateMargins', margins)
    updatePaginationOptionsInStores({
      marginTop: margins.top,
      marginBottom: margins.bottom,
      marginLeft: margins.left,
      marginRight: margins.right
    })
    return true
  },
  setViewMode: (mode: 'print' | 'outline' | 'web') => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const root = getEditorContainerRoot(editor)
    if (!root) return false
    root.classList.remove('view-print', 'view-outline', 'view-web')
    root.classList.add(`view-${mode}`)
    return true
  },
  toggleRuler: (enabled?: boolean) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    return toggleRootClass(editor, 'view-ruler', enabled) !== false
  },
  toggleMarkup: (enabled?: boolean) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    return toggleRootClass(editor, 'view-markup', enabled) !== false
  },
  toggleGridlines: (enabled?: boolean) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    return toggleRootClass(editor, 'view-gridlines', enabled) !== false
  },
  toggleTaskWindow: async () => {
    await openAlertModal({
      title: t('Task Window'),
      message: t('Task window is not available yet.')
    })
    return true
  },
  openFullScreen: async () => {
    if (typeof document === 'undefined') return false
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
      return true
    } catch {
      return false
    }
  },
  openNavigationPane: async () => {
    await openAlertModal({
      title: t('Navigation Pane'),
      message: t('Navigation pane will be available soon.')
    })
    return true
  },
  openZoomDialog: async () => {
    await openAlertModal({
      title: t('Zoom'),
      message: t('Zoom settings will be available soon.')
    })
    return true
  },
  setZoomPercent: (percent: number) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const root = getEditorContainerRoot(editor)
    if (!root) return false
    root.style.zoom = `${percent}%`
    root.dataset.zoomMode = 'percent'
    return true
  },
  setZoomPageWidth: async () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const root = getEditorContainerRoot(editor)
    if (!root) return false
    root.dataset.zoomMode = 'page-width'
    await openAlertModal({
      title: t('Page Width'),
      message: t('Page width zoom will be available soon.')
    })
    return true
  },
  setZoomOnePage: async () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const root = getEditorContainerRoot(editor)
    if (!root) return false
    root.dataset.zoomMode = 'one-page'
    await openAlertModal({
      title: t('One Page'),
      message: t('One page zoom will be available soon.')
    })
    return true
  },
  setZoomMultiplePages: async () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const root = getEditorContainerRoot(editor)
    if (!root) return false
    root.dataset.zoomMode = 'multiple-pages'
    await openAlertModal({
      title: t('Multiple Pages'),
      message: t('Multiple pages zoom will be available soon.')
    })
    return true
  },
  toggleEyeProtection: () => {
    if (typeof document === 'undefined') return false
    document.body.classList.toggle('eye-protection-mode')
    return true
  },
  rearrangePanes: async () => {
    await openAlertModal({
      title: t('Rearrange Panes'),
      message: t('Rearrange panes is not available yet.')
    })
    return true
  },
  newWindow: async () => {
    await openAlertModal({
      title: t('New Window'),
      message: t('New window is not available yet.')
    })
    return true
  },
  splitWindow: async () => {
    await openAlertModal({
      title: t('Split Window'),
      message: t('Split window is not available yet.')
    })
    return true
  },
  viewSideBySide: async () => {
    await openAlertModal({
      title: t('View Side by Side'),
      message: t('Side by side view is not available yet.')
    })
    return true
  },
  synchronousScrolling: async () => {
    await openAlertModal({
      title: t('Synchronous Scrolling'),
      message: t('Synchronous scrolling is not available yet.')
    })
    return true
  },
  resetWindowPosition: async () => {
    await openAlertModal({
      title: t('Reset Window Position'),
      message: t('Reset window position is not available yet.')
    })
    return true
  },
  openWatermark: async () => {
    await openAlertModal({
      title: t('Watermark'),
      message: t('Watermark tools will be available soon.')
    })
    return true
  },
  openSectionPane: async () => {
    await openAlertModal({
      title: t('Section Pane'),
      message: t('Section pane will be available soon.')
    })
    return true
  },
  deleteSection: async () => {
    await openAlertModal({
      title: t('Delete Section'),
      message: t('Delete section will be available soon.')
    })
    return true
  },
  setPageOrientation: (orientation: 'portrait' | 'landscape') => {
    const current = getActivePaginationOptions() ?? defaultPaginationOptions
    const isLandscape = current.pageWidth > current.pageHeight
    const targetLandscape = orientation === 'landscape'
    if (isLandscape === targetLandscape) return true
    const next = {
      pageWidth: current.pageHeight,
      pageHeight: current.pageWidth
    }
    executeEditorCommand('updatePageWidth', next.pageWidth)
    executeEditorCommand('updatePageHeight', next.pageHeight)
    updatePaginationOptionsInStores(next)
    return true
  },
  setPageSize: (size: string) => {
    const key = size?.toString().toUpperCase()
    const pageSize = PAGE_SIZE_LOOKUP[key]
    if (!pageSize) return false
    executeEditorCommand('updatePageSize', pageSize)
    updatePaginationOptionsInStores({
      pageHeight: pageSize.pageHeight,
      pageWidth: pageSize.pageWidth,
      marginTop: pageSize.marginTop,
      marginBottom: pageSize.marginBottom,
      marginLeft: pageSize.marginLeft,
      marginRight: pageSize.marginRight
    })
    return true
  },
  setPageColumns: (count: number) => executeEditorCommand('setPageColumns', count),
  setLineNumberMode: (mode: string) => executeEditorCommand('setLineNumberMode', mode),
  insertPageBreak: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const { remaining } = getPaginationRemainingSpace(editor)
    const height = Math.max(0, Math.round(remaining))
    return editor
      .chain()
      .focus()
      .insertContent({ type: 'pageBreak', attrs: { height, kind: 'page' } })
      .run()
  },
  insertSectionBreak: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const { remaining } = getPaginationRemainingSpace(editor)
    const height = Math.max(0, Math.round(remaining))
    return editor
      .chain()
      .focus()
      .insertContent({ type: 'pageBreak', attrs: { height, kind: 'section' } })
      .run()
  },
  insertBlankPage: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const { remaining, pageHeight } = getPaginationRemainingSpace(editor)
    const height = Math.max(0, Math.round(remaining + pageHeight))
    // const height = Math.max(0, Math.round(remaining))
    return (
      editor
        .chain()
        .focus()
        .insertContent({ type: 'pageBreak', attrs: { height, kind: 'blank' } })

        // .insertContent([
        //   { type: 'pageBreak', attrs: { height, kind: 'blank' } },
        //   { type: 'pageSpacer', attrs: { height: Math.max(0, Math.round(pageHeight)) } }
        // ])
        .run()
    )
  },
  insertCoverPage: async (preset: 'simple' | 'confidential' | 'photo' = 'simple') => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const title = await openTextInputModal({
      title: t('Cover Page Title'),
      message: t('Enter the title for the cover page.'),
      placeholder: t('Document title'),
      defaultValue: t('Document Title')
    })
    const subtitle = await openTextInputModal({
      title: t('Cover Page Subtitle'),
      message: t('Optional subtitle or tagline.'),
      placeholder: t('Subtitle'),
      defaultValue: ''
    })
    const author = await openTextInputModal({
      title: t('Author'),
      message: t('Optional author name.'),
      placeholder: t('Author name'),
      defaultValue: ''
    })
    const templateClass =
      preset === 'confidential'
        ? 'background: #111827; color: #f9fafb; padding: 40px; border-radius: 12px;'
        : preset === 'photo'
          ? 'background: linear-gradient(120deg, #e0f2fe, #fef3c7); padding: 40px; border-radius: 12px;'
          : 'background: #f8fafc; padding: 40px; border-radius: 12px;'
    const coverHtml = `
      <div style="${templateClass}">
        <h1 style="font-size: 42px; margin: 0 0 12px 0;">${title || t('Document Title')}</h1>
        ${subtitle ? `<p style="font-size: 18px; margin: 0 0 24px 0;">${subtitle}</p>` : ''}
        ${author ? `<p style="font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase;">${author}</p>` : ''}
        <p style="font-size: 12px; opacity: 0.7;">${new Date().toLocaleDateString()}</p>
      </div>
    `
    return editor.chain().focus().insertContent(coverHtml).run()
  },
  insertPageNumberAtCursor: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    return editor.chain().focus().insertContent(`Page {page}`).run()
  },
  insertPageNumberHeader: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const pagination = getActivePaginationOptions() ?? defaultPaginationOptions
    const left = pagination?.headerLeft || ''
    const right = 'Page {page}'
    const success = editor.chain().focus().updateHeaderContent(left, right).run()
    if (success) {
      updatePaginationOptionsInStores({ headerLeft: left, headerRight: right })
    }
    return success
  },
  insertPageNumberFooter: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const pagination = getActivePaginationOptions() ?? defaultPaginationOptions
    const left = pagination?.footerLeft || ''
    const right = 'Page {page}'
    const success = editor.chain().focus().updateFooterContent(left, right).run()
    if (success) {
      updatePaginationOptionsInStores({ footerLeft: left, footerRight: right })
    }
    return success
  },
  openHeaderOverlay: () => emitEditorUiEvent('ddoc-open-header'),
  openFooterOverlay: () => emitEditorUiEvent('ddoc-open-footer'),
  openHeaderFooterOverlay: () => emitEditorUiEvent('ddoc-open-header-footer'),
  clearHeaderContent: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const pagination = getActivePaginationOptions() ?? defaultPaginationOptions
    const right = pagination?.headerRight || ''
    const success = editor.chain().focus().updateHeaderContent('', right).run()
    if (success) {
      updatePaginationOptionsInStores({ headerLeft: '' })
    }
    return success
  },
  clearFooterContent: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const pagination = getActivePaginationOptions() ?? defaultPaginationOptions
    const right = pagination?.footerRight || ''
    const success = editor.chain().focus().updateFooterContent('', right).run()
    if (success) {
      updatePaginationOptionsInStores({ footerLeft: '' })
    }
    return success
  },
  insertScreenshot: async () => insertImageFromDeviceInternal(),
  insertTextBox: () =>
    executeEditorCommand('insertTable', { rows: 1, cols: 1, withHeaderRow: false }),
  insertWordArt: async () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const text = await openTextInputModal({
      title: t('WordArt Text'),
      message: t('Enter the text for WordArt.'),
      placeholder: t('WordArt')
    })
    if (!text) return false
    const html = `<span style="font-size: 40px; font-weight: 700; letter-spacing: 0.08em; color: #2563eb;">${text}</span>`
    return editor.chain().focus().insertContent(html).run()
  },
  insertSmartArt: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const html = `
      <p><strong>${t('SmartArt')}</strong></p>
      <ul>
        <li>${t('Step 1')}</li>
        <li>${t('Step 2')}</li>
        <li>${t('Step 3')}</li>
      </ul>
    `
    return editor.chain().focus().insertContent(html).run()
  },
  /* insertChart: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const html = `
      <p><strong>${t('Chart')}</strong></p>
      <table>
        <tbody>
          <tr>
            <th>${t('Series')}</th>
            <th>${t('Q1')}</th>
            <th>${t('Q2')}</th>
            <th>${t('Q3')}</th>
          </tr>
          <tr>
            <td>${t('Sales')}</td>
            <td>24</td>
            <td>36</td>
            <td>18</td>
          </tr>
          <tr>
            <td>${t('Marketing')}</td>
            <td>12</td>
            <td>22</td>
            <td>30</td>
          </tr>
        </tbody>
      </table>
    `
    return editor.chain().focus().insertContent(html).run()
  }, */
  openSlideMaster: async () => {
    await openAlertModal({
      title: t('Edit Slide Master'),
      message: t('Slide master editor is coming soon.')
    })
    return true
  },
  setSlideLayout: (layout: string) => {
    switch (layout) {
      case 'title':
        return GenericFormatingEditorCommands.slidePresetTitle()
      case 'subtitle':
        return GenericFormatingEditorCommands.slidePresetSubtitle()
      case 'body':
        return GenericFormatingEditorCommands.slidePresetBody()
      default:
        return GenericFormatingEditorCommands.slidePresetBody()
    }
  },
  setSlideSize: (size: string) => executeEditorCommand('setPageSize', size),
  insertEnvelope: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const html = `
      <p><strong>${t('Envelope')}</strong></p>
      <p>${t('Recipient Name')}</p>
      <p>${t('Address Line 1')}</p>
      <p>${t('City, State, Zip')}</p>
    `
    return editor.chain().focus().insertContent(html).run()
  },
  insertBookmark: async () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const name = await openTextInputModal({
      title: t('Bookmark Name'),
      message: t('Choose a name for this bookmark.'),
      placeholder: t('Bookmark')
    })
    if (!name) return false
    return editor
      .chain()
      .focus()
      .insertContent(`〔${t('Bookmark')}: ${name}〕`)
      .run()
  },
  insertQuickPart: (value?: string) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const token = value || 'Document Title'
    return editor.chain().focus().insertContent(`{{${token}}}`).run()
  },
  insertDropCap: async () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const letter = await openTextInputModal({
      title: t('Drop Cap Letter'),
      message: t('Choose the first letter.'),
      placeholder: 'A'
    })
    const content = (letter || 'A').trim().charAt(0) || 'A'
    const html = `<span style="font-size: 48px; font-weight: 700; line-height: 1; padding-right: 8px;">${content}</span>`
    return editor.chain().focus().insertContent(html).run()
  },
  insertObject: () => GenericFormatingEditorCommands.insertFile(),
  insertHyperlink: (href?: string) => {
    if (getActiveSheetMethods()) return false
    const editor = getActiveEditorInstance()
    if (!editor) return false
    if (editor.state.selection.empty) {
      toast.error(t('Please select some text before inserting a link.'))
      return false
    }
    const input = href
      ? Promise.resolve(href)
      : openTextInputModal({
          title: t('Insert Link'),
          message: t('Enter the destination URL.'),
          placeholder: 'https://',
          defaultValue: 'https://',
          confirmText: t('Insert'),
          cancelText: t('Cancel')
        })
    return input.then((value) => {
      const raw = (value || '').trim()
      if (!raw) return false
      const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
      return editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run()
    })
  },
  addHyperlinkWithText: async () => {
    if (getActiveSheetMethods()) return false
    const editor = getActiveEditorInstance()
    if (!editor) return false
    if (!editor.state.selection.empty) {
      toast.error(t('Please clear your selection to insert a new link.'))
      return false
    }
    const linkText = await openTextInputModal({
      title: t('Link Text'),
      message: t('Enter the text to display.'),
      placeholder: t('Link text'),
      confirmText: t('Next'),
      cancelText: t('Cancel')
    })
    if (!linkText) return false
    const href = await openTextInputModal({
      title: t('Insert Link'),
      message: t('Enter the destination URL.'),
      placeholder: 'https://',
      defaultValue: 'https://',
      confirmText: t('Insert'),
      cancelText: t('Cancel')
    })
    const raw = (href || '').trim()
    if (!raw) return false
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return editor
      .chain()
      .focus()
      .insertContent([
        {
          type: 'text',
          text: linkText,
          marks: [{ type: 'link', attrs: { href: normalized } }]
        }
      ])
      .run()
  },
  removeHyperlink: () => {
    if (getActiveSheetMethods()) return false
    const editor = getActiveEditorInstance()
    if (!editor) return false
    if (editor.state.selection.empty) {
      toast.error(t('Please select some text before removing a link.'))
      return false
    }
    return editor.chain().focus().unsetLink().run()
  },

  // ─── Internal Link Core Ribbon Commands ──────────────────────────────────────

  insertInternalLink: () => {
    if (getActiveSheetMethods()) return false
    const editor = getActiveEditorInstance()
    if (!editor) return false

    if (editor.state.selection.empty) {
      toast.error(t('Please select some text before inserting an internal link.'))
      return false
    }

    // Capture the selected text as a contextual search seed for your selector modal
    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, ' ').trim()

    // Invokes the extension picker store loop directly
    internalLinkStore.openPicker(selectedText, (fileId: string, label: string) => {
      editor
        .chain()
        .focus()
        .extendMarkRange(CustomInternalLinkExtensionProps.name) // Dynamically expands selection over an existing target mark
        .setInternalLink({ fileId, label })
        .run()
    })
    return true
  },

  addInternalLinkWithText: async () => {
    if (getActiveSheetMethods()) return false
    const editor = getActiveEditorInstance()
    if (!editor) return false

    if (!editor.state.selection.empty) {
      toast.error(t('Please clear your selection to insert a new link block.'))
      return false
    }

    // Step 1: Prompt user for the text they want to display in the document
    const linkText = await openTextInputModal({
      title: t('Internal Link Text'),
      message: t('Enter the text to display for this document reference.'),
      placeholder: t('e.g., Project Specification'),
      confirmText: t('Next'),
      cancelText: t('Cancel')
    })
    if (!linkText || !linkText.trim()) return false

    // Step 2: Fire the picker modal immediately to select the backing File UUID
    internalLinkStore.openPicker(linkText.trim(), (fileId: string, label: string) => {
      editor
        .chain()
        .focus()
        .insertContent([
          {
            type: 'text',
            text: linkText,
            marks: [
              {
                type: CustomInternalLinkExtensionProps.name, // Matches your extension registration name field
                attrs: { fileId, label }
              }
            ]
          }
        ])
        .run()
    })
    return true
  },

  removeInternalLink: () => {
    if (getActiveSheetMethods()) return false
    const editor = getActiveEditorInstance()
    if (!editor) return false

    if (editor.state.selection.empty) {
      toast.error(t('Please select some text before removing an internal link.'))
      return false
    }

    // Removes the specific mark token cleanly without touching structural paragraphs
    return editor.chain().focus().unsetInternalLink().run()
  },

  // bold: () => applySheetFormat('bl', 1) || executeEditorCommand('toggleBold'),
  // italic: () => applySheetFormat('it', 1) || executeEditorCommand('toggleItalic'),
  // underline: () => applySheetFormat('un', 1) || executeEditorCommand('toggleUnderline'),
  // strike: () => applySheetFormat('cl', 1) || executeEditorCommand('toggleStrike'),
  bold: () => {
    if (applySheetFormat('bl', 1)) return true
    const editor = getActiveEditorInstance()
    if (editor && executeFormatting(editor, 'bold')) return true
    return executeEditorCommand('toggleBold')
  },
  italic: () => {
    if (applySheetFormat('it', 1)) return true
    const editor = getActiveEditorInstance()
    if (editor && executeFormatting(editor, 'italic')) return true
    return executeEditorCommand('toggleItalic')
  },
  underline: () => {
    if (applySheetFormat('un', 1)) return true
    const editor = getActiveEditorInstance()
    if (editor && executeFormatting(editor, 'underline')) return true
    return executeEditorCommand('toggleUnderline')
  },
  _setUnderline: (
    style: 'solid' | 'double' | 'dotted' | 'dashed' | 'wavy' | 'thick',
    color?: string | null
  ) => {
    console.log('top _setUnderline 11', { style, color })

    // Spreadsheets and list markers only support the conventional underline.
    if (applySheetFormat('un', 1)) return true
    const editor = getActiveEditorInstance()
    if (editor && isMarkerSelected(editor)) return executeFormatting(editor, 'underline')
    // Do not route this mark command through canvas/nodeview dispatch. The
    // active document editor owns the CustomTextStyleExtension command.
    // const chain = editor?.chain().focus() as any
    console.log('top _setUnderline 2', { style, color })

    // if (typeof chain?._setUnderline === 'function') {
    //   return chain._setUnderline({ style, color }).run()
    // }
    console.log('top _setUnderline 3', { style, color })

    return executeEditorCommand('_setUnderline', { style, color })
    // return executeEditorCommand('setUnderliness', { style, color })
  },
  setUnderlineColor: (color: string | null) => {
    if (applySheetFormat('un', 1)) return true
    const editor = getActiveEditorInstance()
    if (editor && isMarkerSelected(editor)) return executeFormatting(editor, 'underline')
    // const chain = editor?.chain().focus() as any
    // if (typeof chain?._setUnderline === 'function') {
    //   return chain._setUnderline({ color }).run()
    // }
    return executeEditorCommand('_setUnderline', { color })
  },
  strike: () => {
    if (applySheetFormat('cl', 1)) return true
    const editor = getActiveEditorInstance()
    if (editor && executeFormatting(editor, 'strike')) return true
    return executeEditorCommand('toggleStrike')
  },
  // heading: (level = 1) => executeEditorCommand('toggleHeading', { level }),
  code: () => executeEditorCommand('toggleCode'),
  paragraph: () => executeEditorCommand('setParagraph'),
  heading: (level = 1) => executeEditorCommand('toggleHeading', { level }),
  bulletList: () => executeEditorCommand('toggleBulletList'),
  orderedList: () => executeEditorCommand('toggleOrderedList'),
  taskList: () => executeEditorCommand('toggleTaskList'),
  /* 
  setBulletListStyle: (styleType?: string, preset?: string, position: 'inside' | 'outside' = 'outside') =>
    applyListStyle('bulletList', styleType, preset, position),
  setOrderedListStyle: (styleType?: string, preset?: string, position: 'inside' | 'outside' = 'outside') =>
    applyListStyle('orderedList', styleType, preset, position),
  setTaskListStyle: (styleType?: string, preset?: string, position: 'inside' | 'outside' = 'outside') =>
    applyListStyle('taskList', styleType, preset, position), 
  */
  setBulletListStyle: (
    styleType?: string,
    preset?: string,
    position: 'inside' | 'outside' = 'outside'
  ) => applyListStyle('bulletList', styleType, preset, position),

  setOrderedListStyle: (
    styleType?: string,
    preset?: string,
    position: 'inside' | 'outside' = 'outside'
  ) => applyListStyle('orderedList', styleType, preset, position),

  setTaskListStyle: (
    styleType?: string,
    preset?: string,
    position: 'inside' | 'outside' = 'outside'
  ) => applyListStyle('taskList', styleType, preset, position),
  restartOrderedList: () => updateOrderedListStart(1, false),
  continueOrderedList: () => updateOrderedListStart(null, true),
  continueOrderedListFromPrevious: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const start = getPreviousOrderedListContinuation(editor)
    if (!start) return false
    return updateOrderedListStart(start, false)
  },
  setOrderedListStart: (value: number) => updateOrderedListStart(value, false),
  setListMarkerColor: (color: string) =>
    updateListMarkerStyle({ markerColor: color, matchContent: false }),
  setListMarkerSize: (size: string) =>
    updateListMarkerStyle({ markerSize: size, matchContent: false }),
  setListMarkerWeight: (weight: string) =>
    updateListMarkerStyle({ markerWeight: weight, matchContent: false }),
  setListMarkerFont: (font: string) =>
    updateListMarkerStyle({ markerFont: font, matchContent: false }),
  setListMarkerStyle: (color: string, size?: string, weight?: string) =>
    updateListMarkerStyle({
      markerColor: color,
      markerSize: size || null,
      markerWeight: weight || null,
      matchContent: false
    }),
  setListMarkerMatchContent: (match: boolean) =>
    updateListMarkerStyle({
      matchContent: match,
      markerColor: null,
      markerSize: null,
      markerWeight: null,
      markerFont: null,
      markerStyle: null,
      markerDecoration: null,
      markerBg: null,
      markerShadow: null,
      markerTransform: null
    }),
  clearListMarkerStyle: () =>
    updateListMarkerStyle({
      markerColor: null,
      markerSize: null,
      markerWeight: null,
      markerFont: null,
      markerStyle: null,
      markerDecoration: null,
      markerBg: null,
      markerShadow: null,
      markerTransform: null,
      matchContent: true
    }),
  alignLeft: () => applySheetFormat('ht', 1) || executeEditorCommand('setTextAlign', 'left'),
  alignCenter: () => applySheetFormat('ht', 0) || executeEditorCommand('setTextAlign', 'center'),
  alignRight: () => applySheetFormat('ht', 2) || executeEditorCommand('setTextAlign', 'right'),
  alignJustify: () => executeEditorCommand('setTextAlign', 'justify'),
  alignTop: () => setSheetVerticalAlign('top') || false,
  alignMiddle: () => setSheetVerticalAlign('middle') || false,
  alignBottom: () => setSheetVerticalAlign('bottom') || false,
  highlight2: (color: string = '#FFFF00') => executeEditorCommand('toggleHighlight', { color }),
  highlight3: (color: string = '#FFFF00') => {
    if (!color || color === 'transparent') {
      executeEditorCommand('unsetHighlight')
    } else {
      executeEditorCommand('toggleHighlight', { color })
    }
  },
  highlight: (color) => {
    if (applySheetFormat('bg', color)) return true
    const editor = getActiveEditorInstance()
    if (editor && executeFormatting(editor, 'highlight', color)) return true
    return executeEditorCommand('setHighlight', { color })
  },
  selectAll: () => executeEditorCommand('selectAll'),
  insertDummyContent: (options = {}) => executeEditorCommand('insertDummyContent', options),
  textColor: (color) => {
    if (applySheetFormat('fc', color)) return true
    const editor = getActiveEditorInstance()
    if (editor && executeFormatting(editor, 'color', color)) return true
    return executeEditorCommand('setColor', color)
  },
  backgroundColor: (color) =>
    applySheetFormat('bg', color) || executeEditorCommand('setHighlight', { color }),
  clearTextBackground: () => executeEditorCommand('unsetHighlight'),
  superscript: () => executeEditorCommand('toggleSuperscript'),
  subscript: () => executeEditorCommand('toggleSubscript'),
  setFontSize: (sizePx) => {
    const parsed = typeof sizePx === 'string' ? parseFloat(sizePx) : sizePx
    if (applySheetFormat('fs', Number.isFinite(parsed) ? parsed : sizePx)) return true
    const editor = getActiveEditorInstance()
    if (editor && executeFormatting(editor, 'fontSize', sizePx)) return true
    return executeEditorCommand('setFontSize', sizePx)
  },
  increaseFontSize: (step = null) =>
    adjustSheetFontSize(step ?? 1) || executeEditorCommand('increaseFontSize', step),
  decreaseFontSize: (step = null) =>
    adjustSheetFontSize(-(step ?? 1)) || executeEditorCommand('decreaseFontSize', step),
  setFontFamily: (fontFamily: string) => {
    if (applySheetFormat('ff', fontFamily)) return true
    const editor = getActiveEditorInstance()
    if (editor && executeFormatting(editor, 'fontFamily', fontFamily)) return true
    return executeEditorCommand('setFontFamily', fontFamily)
  },
  unsetFontFamily: () => executeEditorCommand('unsetFontFamily'),
  letterSpacing: (value) => executeEditorCommand('setLetterSpacing', value),
  upper: () => executeEditorCommand('applyTextTransform', 'uppercase'),
  lower: () => executeEditorCommand('applyTextTransform', 'lowercase'),
  capitalize: () => executeEditorCommand('applyTextTransform', 'capitalize'),
  clearFormatting: () =>
    clearSheetFormatting() ||
    (getActiveEditorInstance()
      ? updateListMarkerStyle({
          markerColor: null,
          markerSize: null,
          markerWeight: null,
          markerFont: null,
          markerStyle: null,
          markerDecoration: null,
          matchContent: true
        })
      : false) ||
    executeEditorCommand('unsetAllMarks'),
  clearAllFormatting: () => clearSheetFormatting() || executeEditorCommand('clearAllFormatting'),
  indent: () => executeEditorCommand('indent'),
  outdent: () => executeEditorCommand('outdent'),
  toggleInvisibleCharacters: () => executeEditorCommand('toggleInvisibleCharacters'),
  showInvisibleCharacters: () => executeEditorCommand('showInvisibleCharacters'),
  hideInvisibleCharacters: () => executeEditorCommand('hideInvisibleCharacters'),
  blockquote: () => executeEditorCommand('toggleBlockquote'),
  horizontalRule: () => executeEditorCommand('setHorizontalRule'),
  insertTable: (rows, cols, withHeader) =>
    executeEditorCommand('insertTable', { rows, cols, withHeader }),
  setLineSpacing: (value: number) => executeEditorCommand('setLineSpacing', value),
  addSpaceBefore: (px = 16) => executeEditorCommand('setSpaceBefore', px),
  removeSpaceAfter: () => executeEditorCommand('setSpaceAfter', 0),
  changeCase: () => executeEditorCommand('changeCaseSentence'),
  changeCaseLower: () => executeEditorCommand('changeCaseLower'),
  changeCaseUpper: () => executeEditorCommand('changeCaseUpper'),
  changeCaseToggle: () => executeEditorCommand('changeCaseToggle'),
  changeCaseCapitalize: () => executeEditorCommand('changeCaseCapitalize'),
  setVariable: () => executeEditorCommand('setVariable'),
  unsetVariable: () => executeEditorCommand('unsetVariable'),
  toggleVariable: () => executeEditorCommand('toggleVariable'),
  insertVariable: () => executeEditorCommand('addVariableAt'),
  editVariable: () => executeEditorCommand('editVariable'),
  convertSelectionToVariable: (name?: string) =>
    executeEditorCommand('convertSelectionToVariable', name),
  setVariableCurrent: () => setSelectionAsVariable(false),
  setVariableAllOccurrences: () => setSelectionAsVariable(true),
  unsetVariableCurrent: () => unsetVariableAtSelection(false),
  unsetVariableAllOccurrences: () => unsetVariableAtSelection(true),
  deleteVariableCurrent: () => deleteVariableAtSelection(),
  hasVariableSelection: () => hasVariableSelection(),
  setProgrammingStyleComment: () => executeEditorCommand('setProgrammingStyleComment'),
  unsetProgrammingStyleComment: () => executeEditorCommand('unsetProgrammingStyleComment'),
  toggleProgrammingStyleComment: () => executeEditorCommand('toggleProgrammingStyleComment'),
  setSecuredContent: () => executeEditorCommand('setSecuredContent'),
  unsetSecuredContent: () => executeEditorCommand('unsetSecuredContent'),
  toggleSecuredContent: () => executeEditorCommand('toggleSecuredContent'),
  insertAI: () => executeEditorCommand('insertAI'),
  generateWithAI: () => runAIOnSelection('generate', { requireSelection: false }),
  hasSelection: () => hasActiveSelection(),
  generateTextWithAI: () => runAIGenerationByMode('text'),
  generateSlidesWithAI: () => runAIGenerationByMode('slides'),
  generateSpreadsheetWithAI: () => runAIGenerationByMode('spreadsheet'),
  generateDesignWithAI: () => runAIGenerationByMode('design'),
  generateLatexWithAI: () => runAIGenerationByMode('latex'),
  summarizeWithAI: () => runAIOnSelection('summarize'),
  translateWithAI: () =>
    runAIOnSelection('translate', {
      targetLanguage: resolveTargetLanguage(),
      requireSelection: true
    }),
  translateToWithAI: async () => {
    if (!hasActiveSelection()) {
      toast.error(t('Please select some text to use this AI action.'))
      return false
    }
    const selection = await openTranslationPickerModal({
      title: t('Translate to'),
      message: t('Choose a language for translation.')
    })
    if (!selection?.code) return false
    return runAIOnSelection('translate', {
      targetLanguage: selection.name ? `${selection.name}` : selection.code
    })
  },
  rewriteWithAI: () => runAIOnSelection('rewrite'),
  executiveSummaryWithAI: () => runAIOnSelection('executive_summary'),
  investorToneWithAI: () => runAIOnSelection('investor_tone'),
  technicalRewriteWithAI: () => runAIOnSelection('technical_rewrite'),
  expandWithAI: () => runAIOnSelection('expand'),
  shortenWithAI: () => runAIOnSelection('shorten'),
  fixGrammarWithAI: () => runAIOnSelection('fix'),
  bulletizeWithAI: () => runAIOnSelection('bulletize'),
  outlineWithAI: () => runAIOnSelection('outline'),
  extractActionItemsWithAI: () => runAIOnSelection('action_items'),
  simplifyWithAI: () => runAIOnSelection('simplify'),
  editAIPrompt: () => executeEditorCommand('editAIPrompt'),
  insertFile: () => executeEditorCommand('insertFile'),
  insertFolder: () => executeEditorCommand('insertFolder'),
  insertFileFromDevice: async () => {
    if (getActiveSheetMethods()) return false
    const result = await window.api.openDialogFile()
    if (!result) return false
    const imported = await importFileIntoDocumentAssets(result)
    return executeEditorCommand('insertFile', imported)
  },
  insertFolderFromDevice: async () => {
    if (getActiveSheetMethods()) return false
    const result = await window.api.openDialogDirectory()
    if (!result) return false
    return executeEditorCommand('insertFolder', result)
  },
  insertFileFromClipboard: async () => {
    if (getActiveSheetMethods()) return false
    const pathFromClipboard = await readClipboardFilePath()
    if (!pathFromClipboard) {
      openAlertModal({
        title: t('Insert File'),
        message: t('Clipboard does not contain a valid file nodeApi.path.')
      })
      return false
    }
    const imported = await importFileIntoDocumentAssets(pathFromClipboard)
    return executeEditorCommand('insertFile', imported)
  },
  insertFileFromUrl: async () => {
    if (getActiveSheetMethods()) return false
    const url = await promptForUrl(
      t('Add File from URL'),
      t('Paste a file URL to download and embed.')
    )
    if (!url) return false
    try {
      const downloaded = await downloadUrlToAsset(url, DocumentModel.AssetType.OTHER)
      if (!downloaded) return false
      return executeEditorCommand('insertFile', downloaded)
    } catch (error) {
      openAlertModal({
        title: t('Add File from URL'),
        message: t(
          `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      })
      return false
    }
  },
  insertImageFromUrl: async () => {
    if (getActiveSheetMethods()) return false
    const url = await promptForUrl(
      t('Add Picture from URL'),
      t('Paste an image URL to download and embed.')
    )
    if (!url) return false
    try {
      const downloaded = await downloadUrlToAsset(url, DocumentModel.AssetType.IMG)
      if (!downloaded) return false
      return executeEditorCommand('insertFile', downloaded)
    } catch (error) {
      openAlertModal({
        title: t('Add Picture from URL'),
        message: t(
          `Failed to download image: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      })
      return false
    }
  },
  insertImageFromClipboard: async () => {
    if (getActiveSheetMethods()) return false
    const pathFromClipboard = await readClipboardFilePath()
    if (!pathFromClipboard) {
      openAlertModal({
        title: t('Add Picture'),
        message: t('Clipboard does not contain a valid image path.')
      })
      return false
    }
    const imported = await importFileIntoDocumentAssets(pathFromClipboard, {
      preferredAssetType: DocumentModel.AssetType.IMG
    })
    return executeEditorCommand('insertFile', imported)
  },
  insertWebviewFromUrl: async () => {
    if (getActiveSheetMethods()) return false
    const url = await promptForUrl(
      t('Insert Web Preview'),
      t('Paste a URL to embed as a live preview.')
    )
    if (!url) return false
    return executeEditorCommand('insertWebview', url)
  },
  includeFile: async () => {
    if (getActiveSheetMethods()) return false
    const result = await window.api.openDialogFile()
    if (!result) return false
    if (hasIncludedFile(result)) {
      const confirmed = await openConfirmModal({
        title: t('Include File'),
        message: t('This file is already included. Include it again?'),
        confirmText: t('Include Again')
      })
      if (!confirmed) return false
    }
    const inserted = executeEditorCommand('insertFileInclude', result)
    if (!inserted) {
      openAlertModal({
        title: t('Include File'),
        message: t('This file is already included or could not be inserted.')
      })
    }
    return inserted
  },
  includeFileFromClipboard: async () => {
    if (getActiveSheetMethods()) return false
    const pathFromClipboard = await readClipboardFilePath()
    if (!pathFromClipboard) {
      openAlertModal({
        title: t('Include File'),
        message: t('Clipboard does not contain a valid file path.')
      })
      return false
    }
    if (hasIncludedFile(pathFromClipboard)) {
      const confirmed = await openConfirmModal({
        title: t('Include File'),
        message: t('This file is already included. Include it again?'),
        confirmText: t('Include Again')
      })
      if (!confirmed) return false
    }
    const inserted = executeEditorCommand('insertFileInclude', pathFromClipboard)
    if (!inserted) {
      openAlertModal({
        title: t('Include File'),
        message: t('This file is already included or could not be inserted.')
      })
    }
    return inserted
  },
  appendFile: async () => {
    if (getActiveSheetMethods()) return false
    const result = await window.api.openDialogFile()
    if (!result) return false
    const content = await window.api.readFile(result)
    if (typeof content === 'string' && content.startsWith('Error reading file:')) {
      openAlertModal({
        title: t('Append File'),
        message: content
      })
      return false
    }
    return executeEditorCommand('insertContent', content)
  },
  appendFileFromClipboard: async () => {
    if (getActiveSheetMethods()) return false
    const pathFromClipboard = await readClipboardFilePath()
    if (!pathFromClipboard) {
      openAlertModal({
        title: t('Append File'),
        message: t('Clipboard does not contain a valid file path.')
      })
      return false
    }
    const content = await window.api.readFile(pathFromClipboard)
    if (typeof content === 'string' && content.startsWith('Error reading file:')) {
      openAlertModal({
        title: t('Append File'),
        message: content
      })
      return false
    }
    return executeEditorCommand('insertContent', content)
  },
  includeFileFromPath: async (filePath: string) => {
    if (getActiveSheetMethods()) return false
    if (!filePath) return false
    if (hasIncludedFile(filePath)) {
      const confirmed = await openConfirmModal({
        title: t('Include File'),
        message: t('This file is already included. Include it again?'),
        confirmText: t('Include Again')
      })
      if (!confirmed) return false
    }
    const inserted = executeEditorCommand('insertFileInclude', filePath)
    if (!inserted) {
      openAlertModal({
        title: t('Include File'),
        message: t('This file is already included or could not be inserted.')
      })
    }
    return inserted
  },
  appendFileFromPath: async (filePath: string) => {
    if (getActiveSheetMethods()) return false
    if (!filePath) return false
    const content = await window.api.readFile(filePath)
    if (typeof content === 'string' && content.startsWith('Error reading file:')) {
      openAlertModal({
        title: t('Append File'),
        message: content
      })
      return false
    }
    return executeEditorCommand('insertContent', content)
  },
  includeFileFromDocument: async () => {
    console.log('includeFileFromDocument')
    if (getActiveSheetMethods()) return false
    console.log('includeFileFromDocument yeeas')
    // await openIncludeFromDocumentModal()
    const selection = await openIncludeFromDocumentModal()
    if (!selection) return false
    if (selection.mode === 'include') {
      return GenericFormatingEditorCommands.includeFileFromPath(selection.path)
    }
    return GenericFormatingEditorCommands.appendFileFromPath(selection.path)
  },
  pasteAsReference: async () => {
    if (getActiveSheetMethods()) return false
    const pathFromClipboard = await readClipboardFilePath()
    if (!pathFromClipboard) {
      openAlertModal({
        title: t('Paste as Reference'),
        message: t('Clipboard does not contain a valid file path.')
      })
      return false
    }
    const editor = getActiveEditorInstance()
    if (!editor) return false
    registerExternalReference(editor, pathFromClipboard)
    return editor
      .chain()
      .focus()
      .insertContent({
        type: 'ref',
        attrs: { src: pathFromClipboard }
      })
      .run()
  },
  insertFormField: () => executeEditorCommand('insertFormField'),
  insertMonacoCodeBlock: () => executeEditorCommand('insertMonacoCodeBlock', {}),
  insertSlide: (attrs?) => executeEditorCommand('insertSlide', attrs),
  insertLatexProject: () => executeEditorCommand('insertLatexProject'),
  insertMermaid: () => executeEditorCommand('insertMermaid'),
  insertMermaidFromFile: async () => {
    if (getActiveSheetMethods()) return false
    const result = await window.api.openDialogFile()
    if (!result) return false
    return executeEditorCommand('insertMermaid', { src: result, title: 'Mermaid Diagram' })
  },
  insertGallery: async (options: InsertImageOptions = { src: '' }) => {
    if (getActiveSheetMethods()) return false
    const result = await window.api.openDialogDirectory()
    if (result) {
      options.src = result
      executeEditorCommand('insertGallery', result)
    }
  },
  insertDesign: () => executeEditorCommand('insertDesign'),
  drawDesignItemShape: (shape: ShapeType) =>
    executeEditorCommand('drawShape', shape) || executeEditorCommand('insertInlineShape', shape),
  drawDesignItemRectangle: () =>
    executeEditorCommand('drawShape', ShapeType.Rect) ||
    executeEditorCommand('insertInlineShape', ShapeType.Rect),
  insertDesignItemText: () => executeEditorCommand('addText'),
  insertDesignItemImage: async (options: InsertImageOptions = { src: '' }) => {
    const result = await window.api.openDialogFile()
    if (result) {
      options.src = EditorHelpers.toFileUrl(result)
      executeEditorCommand('addFile', result)
    }
  },
  insertSpreadsheet: () => executeEditorCommand('insertSpreadsheet'),
  insertChart: (
    options: {
      chartType?: ChartType
      range?: string
      sourcePath?: string
      title?: string
      placement?: 'above' | 'below' | 'after'
    } = {}
  ) => {
    const methods = getActiveSheetMethods()
    const sourcePath = options.sourcePath || getActiveSheetSourcePath()
    const placement = options.placement || 'after'
    const editor = getActiveEditorInstance()
    if (!editor) return false
    if (!methods || !sourcePath) {
      const tableSelection = getTableSelectionRange(editor)
      if (!tableSelection?.sheetName) {
        const sampleTableId = uuidv4()
        const sampleSheetName = 'Sample Data'
        const sampleRange = 'A1:C4'
        const sampleChartId = uuidv4()
        const payload = {
          id: sampleChartId,
          chartType: options.chartType || 'bar',
          sourceType: 'table',
          sourcePath: sampleSheetName,
          sourceTableId: sampleTableId,
          range: sampleRange,
          title: options.title || 'Sample Chart',
          height: 360,
          sampleData: true
        }
        const tableNode = buildSampleTableNode(sampleTableId, sampleSheetName)
        return editor
          .chain()
          .focus()
          .insertContent([tableNode, { type: 'paragraph' }, { type: 'chart', attrs: payload }])
          .run()
      }
      const range = options.range || tableSelection.range
      if (!range) {
        openAlertModal({
          title: t('Insert Chart'),
          message: t('Select a table range first.')
        })
        return false
      }
      const type = editor.schema.nodes?.table
      if (!type) return false
      const state = editor.state
      const from = state.selection.from
      const to = state.selection.to
      const found = findParentNodeOfType(state, from, type) || findParentNodeOfType(state, to, type)
      if (!found?.node) return false
      const insertPos = placement === 'above' ? found.pos : found.pos + found.node.nodeSize
      const payload = {
        id: uuidv4(),
        chartType: options.chartType || 'bar',
        sourceType: 'table',
        sourcePath: tableSelection.sheetName,
        sourceTableId: tableSelection.tableNode?.attrs?.[EditorHelpers.uuidAttributeName] || '',
        range,
        title: options.title || '',
        height: 360
      }
      return insertChartAt(editor, insertPos, payload, placement)
    }
    let range = options.range || ''
    if (!range) {
      const indices = getSheetRangeIndices(methods)
      if (indices) {
        range = buildA1Range(
          indices.rowStart,
          indices.columnStart,
          indices.rowEnd,
          indices.columnEnd
        )
      }
    }
    if (!range) {
      openAlertModal({
        title: t('Insert Chart'),
        message: t('Select a spreadsheet range first.')
      })
      return false
    }
    const sheetType = editor.schema.nodes?.[CustomSpreadsheetExtensionProps.name]
    if (!sheetType) return false
    const state = editor.state
    const from = state.selection.from
    const to = state.selection.to
    const found =
      findParentNodeOfType(state, from, sheetType) || findParentNodeOfType(state, to, sheetType)
    if (!found?.node) return false
    const insertPos = placement === 'above' ? found.pos : found.pos + found.node.nodeSize
    const payload = {
      id: uuidv4(),
      chartType: options.chartType || 'bar',
      sourceType: 'sheet',
      sourcePath,
      range,
      title: options.title || '',
      height: 360
    }
    return insertChartAt(editor, insertPos, payload, placement)
  },
  insertChartFromSelection: (chartType: ChartType = 'bar') => {
    return GenericFormatingEditorCommands.insertChart({ chartType })
  },
  insertChartFromSheetSource: (
    sourcePath: string,
    range: string,
    chartType: ChartType = 'bar',
    placement: 'above' | 'below' | 'after' = 'below'
  ) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    if (!range) {
      openAlertModal({
        title: t('Insert Chart'),
        message: t('Select a spreadsheet range first.')
      })
      return false
    }
    const found = findSheetNodeBySourcePath(editor, sourcePath)
    if (!found?.node) {
      openAlertModal({
        title: t('Insert Chart'),
        message: t('Could not locate the spreadsheet block in this document.')
      })
      return false
    }
    const insertPos = placement === 'above' ? found.pos : found.pos + found.node.nodeSize
    const payload = {
      id: uuidv4(),
      chartType,
      sourceType: 'sheet',
      sourcePath,
      range,
      title: '',
      height: 360
    }
    return insertChartAt(editor, insertPos, payload, placement)
  },
  insertSpreadsheetFromImported: async () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false

    const filePath = await openSpreadsheetFileDialog()
    if (!filePath) return false

    const result = await openSpreadsheetImportModal({
      fileName: nodeApi.path?.basename?.(filePath) || 'Spreadsheet'
    })
    if (!result) return false

    const sheetId = uuidv4()
    if (typeof editor.commands.insertSpreadsheet !== 'function') return false

    editor.commands.insertSpreadsheet({ id: sheetId })

    const inserted = await waitForSheetNode(editor, sheetId)
    const src =
      inserted?.node?.attrs?.src ||
      inserted?.node?.attrs?.[CustomSpreadsheetExtensionProps.tagAttributeSrc]

    if (!src) {
      openAlertModal({
        title: t('Import Spreadsheet'),
        message: t('Unable to locate the new worksheet block.')
      })
      return false
    }

    const entry = await waitForSheetReady(src)
    if (!entry?.methods) {
      openAlertModal({
        title: t('Import Spreadsheet'),
        message: t('Spreadsheet editor is not ready yet. Please try again.')
      })
      return false
    }

    try {
      await importSpreadsheetFileToActiveSheet(filePath, result, entry)
      return true
    } catch (error) {
      console.error('Import spreadsheet failed', error)
      openAlertModal({
        title: t('Import Spreadsheet'),
        message: t('Unable to read the selected file. Please try again.')
      })
      return false
    }
  },
  insertChartBelowSelection: (chartType: ChartType = 'bar') => {
    return GenericFormatingEditorCommands.insertChart({ chartType, placement: 'below' })
  },
  insertChartAboveSelection: (chartType: ChartType = 'bar') => {
    return GenericFormatingEditorCommands.insertChart({ chartType, placement: 'above' })
  },
  setActiveNodeviewLayout: (layout: string) => updateActiveNodeviewAttrs({ layout }) || false,
  nudgeActiveNodeview: (dx = 0, dy = 0) => {
    const target = resolvePositionableNodeTarget()
    if (!target) return false
    const offsetX = Number(target.node?.attrs?.offsetX ?? 0) + dx
    const offsetY = Number(target.node?.attrs?.offsetY ?? 0) + dy
    return updateActiveNodeviewAttrs({ offsetX, offsetY }) || false
  },
  resetActiveNodeviewPosition: () => updateActiveNodeviewAttrs({ offsetX: 0, offsetY: 0 }) || false,
  getActiveNodeviewLayout,
  getActivePositionableType,
  setRowHeight: (height?: number) =>
    withSheetMethods((methods) => {
      const range = getSheetRangeIndices(methods)
      if (!range || !methods.setRowHeight) return null
      const apply = (value: number) => {
        const rowInfo: Record<string, number> = {}
        for (let r = range.rowStart; r <= range.rowEnd; r++) {
          rowInfo[r] = value
        }
        methods.setRowHeight?.(rowInfo)
        return true
      }
      if (typeof height === 'number' && Number.isFinite(height)) return apply(height)
      promptNumberInput(t('Row Height'), t('Enter row height in pixels.'), '24', '24').then(
        (value) => {
          if (value != null) apply(value)
        }
      )
      return true
    }) || false,
  setColumnWidth: (width?: number) =>
    withSheetMethods((methods) => {
      const range = getSheetRangeIndices(methods)
      if (!range || !methods.setColumnWidth) return null
      const apply = (value: number) => {
        const columnInfo: Record<string, number> = {}
        for (let c = range.columnStart; c <= range.columnEnd; c++) {
          columnInfo[c] = value
        }
        methods.setColumnWidth?.(columnInfo)
        return true
      }
      if (typeof width === 'number' && Number.isFinite(width)) return apply(width)
      promptNumberInput(t('Column Width'), t('Enter column width in pixels.'), '80', '80').then(
        (value) => {
          if (value != null) apply(value)
        }
      )
      return true
    }) || false,
  toggleFilter: () => false,
  sortSheetAscending: () => sortSheetSelectionRows(true),
  sortSheetDescending: () => sortSheetSelectionRows(false),
  removeSheetDuplicates: () => removeSheetDuplicateRows(),
  highlightSheetDuplicates: () => highlightSheetDuplicateRows(),
  sheetTextToColumns: () => splitSheetTextToColumns(),
  fillSheetDown: () => fillSheetSelection('down'),
  fillSheetRight: () => fillSheetSelection('right'),
  fillSheetSeries: () => fillSheetSelection('series'),
  formatSheetAsTable: () => formatSheetSelectionAsTable(),
  insertSheetFunction: (fnName?: string) => promptInsertSheetFunction(fnName),
  insertRecentSheetFunction: () => promptInsertSheetFunction(getRecentSheetFunctions()[0]),
  recalculateSheet: () => recalcActiveSheet(),
  openConditionalFormatting: async () => {
    const existing = getConditionalFormattingRules()
    const selection = withSheetMethods((methods) => getSheetSelectionRange(methods)) || null
    const result = await openConditionalFormattingModal({
      title: t('Conditional Formatting'),
      rules: existing,
      selectionRange: selection
    })
    if (!result) return false

    if (result.action === 'clear') {
      setConditionalFormattingRules([])
      return GenericFormatingEditorCommands.clearAllFormatting()
    }

    if (result.rules) {
      setConditionalFormattingRules(result.rules)
    }

    if (result.applyRule) {
      return applyConditionalFormattingRule(result.applyRule.type, {
        threshold: result.applyRule.threshold,
        color: result.applyRule.color,
        rangeOverride: result.applyRule.range
      })
    }
    return true
  },
  openDataValidation: () => false,
  openSplitColumn: () => false,
  formatPainter: () => {
    const slideNodeviewId = getActiveSlideNodeviewId()
    if (slideNodeviewId) {
      if (slideFormatPainterCache) {
        const applied = applyStyleToSelectedSlideShapes(slideFormatPainterCache)
        slideFormatPainterCache = null
        return applied
      }
      const editor = getActiveEditorInstance()
      if (editor) {
        slideFormatPainterCache = captureEditorStyle(editor)
        return true
      }
    }

    return (
      withSheetMethods((methods) => {
        const cell = getPrimarySheetCell(methods)
        if (!cell) return null
        sheetFormatPainterCache = {
          bl: cell.bl,
          it: cell.it,
          un: cell.un,
          cl: cell.cl,
          ff: cell.ff,
          fs: cell.fs,
          fc: cell.fc,
          bg: cell.bg,
          ht: cell.ht,
          vt: cell.vt,
          tb: cell.tb,
          rt: cell.rt,
          ct: cell.ct
        }
        if (sheetFormatPainterCache) {
          return applySheetStyleToRange(methods, sheetFormatPainterCache)
        }
        return null
      }) || (void copyToClipboard(), true)
    )
  },
  setNumberFormat: () => applySheetNumberFormat('number') || false,
  setCurrencyFormat: () => applySheetNumberFormat('currency') || false,
  setPercentFormat: () => applySheetNumberFormat('percent') || false,
  setCommaFormat: () => applySheetNumberFormat('comma') || false,
  increaseDecimal: () => adjustSheetDecimal(1) || false,
  decreaseDecimal: () => adjustSheetDecimal(-1) || false,
  wrapText: () => setSheetWrap('wrap') || false,
  unwrapText: () => setSheetWrap('overflow') || false,
  clipText: () => setSheetWrap('clip') || false,
  rotateTextUp: () => setSheetRotation(90) || false,
  rotateTextDown: () => setSheetRotation(-90) || false,
  rotateTextNone: () => setSheetRotation(0) || false,
  freezeFirstRow: () =>
    withSheetMethods((methods) => methods.freeze?.('row', { row: 1, column: 0 })) || false,
  freezeFirstColumn: () =>
    withSheetMethods((methods) => methods.freeze?.('column', { row: 0, column: 1 })) || false,
  freezePanes: () =>
    withSheetMethods((methods) => {
      const range = getSheetRangeIndices(methods)
      if (!range) return null
      const row = range.rowStart + 1
      const column = range.columnStart + 1
      return methods.freeze?.('both', { row, column })
    }) || false,
  unfreezePanes: () =>
    withSheetMethods((methods) => methods.freeze?.('both', { row: 0, column: 0 })) || false,
  sortAscending: () => runSheetSort(true) || false,
  sortDescending: () => runSheetSort(false) || false,
  autoSum: () => runSheetAutoSum() || false,
  wrapWithAnimation: (type?: string, order?: number) => {
    const nextType = type ?? lastAnimationType
    if (nextType) lastAnimationType = nextType
    if (updateSelectedShapeAnimation({ type: nextType, order })) return true
    return executeEditorCommand('wrapWithAnimation', nextType, order)
  },
  updateAnimation: (attrs: { type?: string; order?: number }) => {
    if (attrs?.type) lastAnimationType = attrs.type
    if (updateSelectedShapeAnimation(attrs)) return true
    return executeEditorCommand('updateAnimation', attrs)
  },
  unwrapAnimation: () =>
    updateSelectedShapeAnimation(null, { clear: true }) || executeEditorCommand('unwrapAnimation'),
  clearAllAnimation: (idList?: string[]) => executeEditorCommand('clearAllAnimation', idList),
  applyAnimationPainter: () => executeEditorCommand('wrapWithAnimation', lastAnimationType, 1),
  previewAnimations: () => runAnimationPreview(),
  openAnimationPane: async () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    let count = 0
    editor.state.doc.descendants((node) => {
      if (node.type.name === CustomAnimationExtensionProps.name) count += 1
    })
    const confirmed = await openConfirmModal({
      title: t('Animation Pane'),
      message: `${t('Animations found')}: ${count}`,
      confirmText: t('Clear All'),
      cancelText: t('Close'),
      extraActionText: t('Preview'),
      extraAction: async () => {
        const ran = runAnimationPreview()
        if (!ran) {
          await openAlertModal({
            title: t('Animation Preview'),
            message: t('No animations found.')
          })
        }
      }
    })
    if (confirmed) {
      return executeEditorCommand('clearAllAnimation')
    }
    return true
  },
  insertWebview: (url?: string) => executeEditorCommand('insertWebview', url),
  insertSurvey: () => executeEditorCommand('insertSurvey'),
  insertImage: (options: InsertImageOptions) =>
    getActiveSheetMethods() ? false : executeEditorCommand('insertImage', { ...options }),
  insertImageFromDevice: async (options: InsertImageOptions = { src: '' }) =>
    insertImageFromDeviceInternal(options),
  applySlideFormatPainterIfArmed,
  slidePresetTitle: () => applyPresetToSelectedShapes('title'),
  slidePresetSubtitle: () => applyPresetToSelectedShapes('subtitle'),
  slidePresetBody: () => applyPresetToSelectedShapes('body')
}

const EditorReviewCommands = {
  toggleTrackChanges: (enabled?: boolean) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const current = !!editor.storage?.review?.enabled
    const next = enabled ?? !current
    const author = editor.storage?.review?.author
    const result = executeEditorCommand('setReviewMode', next, author)
    updateActiveDocumentConfig((doc) => {
      doc.config.reviewSettings = {
        ...(doc.config.reviewSettings || {}),
        trackChangesEnabled: next,
        reviewerName: author || doc.config.reviewSettings?.reviewerName || 'Editor'
      }
    })
    return result
  },
  setReviewAuthor: async (author?: string) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    let next = author
    if (!next) {
      next = await openTextInputModal({
        title: t('Reviewer Name'),
        message: t('Set the display name used in tracked changes.'),
        placeholder: t('Reviewer name'),
        defaultValue: editor.storage?.review?.author ?? ''
      })
    }
    if (!next) return false
    editor.storage.review = editor.storage.review || { enabled: false, author: next }
    editor.storage.review.author = next
    const result = executeEditorCommand('setReviewMode', editor.storage.review.enabled, next)
    updateActiveDocumentConfig((doc) => {
      doc.config.reviewSettings = {
        ...(doc.config.reviewSettings || {}),
        reviewerName: next
      }
    })
    return result
  },
  insertSuggestion: async () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const value = await openTextInputModal({
      title: t('Insert Suggestion'),
      message: t('Insert a suggested text snippet.'),
      placeholder: t('Suggested text')
    })
    if (!value) return false
    return executeEditorCommand('insertSuggestion', value)
  },
  deleteSuggestion: () => executeEditorCommand('deleteSuggestion'),
  acceptSelection: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const { from, to } = editor.state.selection
    const nodes = getReviewNodesInRange(editor, from, to + 1)
    return applyReviewDecision(editor, nodes, 'accept')
  },
  rejectSelection: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const { from, to } = editor.state.selection
    const nodes = getReviewNodesInRange(editor, from, to + 1)
    return applyReviewDecision(editor, nodes, 'reject')
  },
  acceptAll: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    return applyReviewDecision(editor, getReviewNodes(editor), 'accept')
  },
  rejectAll: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    return applyReviewDecision(editor, getReviewNodes(editor), 'reject')
  },
  acceptAndNext: () => {
    if (!EditorReviewCommands.acceptSelection()) return false
    return EditorReviewCommands.nextChange()
  },
  rejectAndNext: () => {
    if (!EditorReviewCommands.rejectSelection()) return false
    return EditorReviewCommands.nextChange()
  },
  nextChange: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const entries = getReviewNodes(editor)
    if (!entries.length) return false
    return selectNode(editor, findNextEntry(entries, editor.state.selection.from))
  },
  previousChange: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const entries = getReviewNodes(editor)
    if (!entries.length) return false
    return selectNode(editor, findPreviousEntry(entries, editor.state.selection.from))
  },
  setMarkupMode: (mode: 'all' | 'simple' | 'none' | 'original') => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const root = getEditorContainerRoot(editor)
    if (!root) return false
    root.classList.remove(
      'review-markup-all',
      'review-markup-simple',
      'review-markup-none',
      'review-markup-original'
    )
    root.classList.add(`review-markup-${mode}`)
    updateActiveDocumentConfig((doc) => {
      doc.config.reviewSettings = {
        ...(doc.config.reviewSettings || {}),
        markupMode: mode
      }
    })
    return true
  },
  toggleMarkup: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const root = getEditorContainerRoot(editor)
    if (!root) return false
    if (root.classList.contains('review-markup-none')) {
      root.classList.remove('review-markup-none')
      root.classList.add('review-markup-all')
      updateActiveDocumentConfig((doc) => {
        doc.config.reviewSettings = {
          ...(doc.config.reviewSettings || {}),
          markupMode: 'all'
        }
      })
      return true
    }
    if (root.classList.contains('review-markup-simple')) {
      root.classList.remove('review-markup-simple')
      root.classList.add('review-markup-none')
      updateActiveDocumentConfig((doc) => {
        doc.config.reviewSettings = {
          ...(doc.config.reviewSettings || {}),
          markupMode: 'none'
        }
      })
      return true
    }
    if (root.classList.contains('review-markup-original')) {
      root.classList.remove('review-markup-original')
      root.classList.add('review-markup-all')
      updateActiveDocumentConfig((doc) => {
        doc.config.reviewSettings = {
          ...(doc.config.reviewSettings || {}),
          markupMode: 'all'
        }
      })
      return true
    }
    root.classList.remove('review-markup-all')
    root.classList.add('review-markup-simple')
    updateActiveDocumentConfig((doc) => {
      doc.config.reviewSettings = {
        ...(doc.config.reviewSettings || {}),
        markupMode: 'simple'
      }
    })
    return true
  },
  setReviewFilterAuthors: (authors?: string[]) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    updateActiveDocumentConfig((doc) => {
      doc.config.reviewSettings = {
        ...(doc.config.reviewSettings || {}),
        filterAuthors: authors?.length ? authors : null
      }
    })
    return applyReviewFilters(editor, { authors, modes: getActiveReviewFilters().modes })
  },
  setReviewFilterModes: (modes?: string[]) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    updateActiveDocumentConfig((doc) => {
      doc.config.reviewSettings = {
        ...(doc.config.reviewSettings || {}),
        filterModes: modes?.length ? modes : null
      }
    })
    return applyReviewFilters(editor, { modes, authors: getActiveReviewFilters().authors })
  },
  clearReviewFilters: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    updateActiveDocumentConfig((doc) => {
      doc.config.reviewSettings = {
        ...(doc.config.reviewSettings || {}),
        filterAuthors: null,
        filterModes: null
      }
    })
    return applyReviewFilters(editor, { authors: null, modes: null })
  },
  applyReviewFiltersFromConfig: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const filters = getActiveReviewFilters()
    return applyReviewFilters(editor, filters)
  },
  listReviewAuthors: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return []
    const authors = new Set<string>()
    editor.state.doc.descendants((node) => {
      if (node.type.name !== 'review') return
      if (node.attrs?.author) authors.add(String(node.attrs.author))
    })
    return Array.from(authors).filter(Boolean)
  },
  promptReviewAuthorFilter: async () => {
    const authors = GenericFormatingEditorCommands.listReviewAuthors()
    const value = await openTextInputModal({
      title: t('Filter by Reviewer'),
      message: t('Enter reviewer names separated by commas.'),
      placeholder: authors.length ? authors.join(', ') : t('Reviewer')
    })
    if (value === null) return false
    const list = value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    return GenericFormatingEditorCommands.setReviewFilterAuthors(list)
  },
  setReviewFilterToMe: () => {
    const reviewerName =
      getActiveEditorInstance()?.storage?.review?.author ||
      getActiveDocumentEditor()?.document?.config?.reviewSettings?.reviewerName ||
      'Editor'
    return GenericFormatingEditorCommands.setReviewFilterAuthors([reviewerName])
  },
  setReviewFilterInsertions: () => GenericFormatingEditorCommands.setReviewFilterModes(['insert']),
  setReviewFilterDeletions: () => GenericFormatingEditorCommands.setReviewFilterModes(['delete']),
  clearReviewFilterAuthors: () => GenericFormatingEditorCommands.setReviewFilterAuthors([]),
  clearReviewFilterModes: () => GenericFormatingEditorCommands.setReviewFilterModes([]),
  compareDocument: async () => {
    const path = await window.api.openDialogFile()
    if (!path) return false
    updateActiveDocumentConfig((doc) => {
      doc.config.reviewSettings = {
        ...(doc.config.reviewSettings || {}),
        comparePath: path
      }
    })
    await openAlertModal({
      title: t('Compare Documents'),
      message: t('Comparison target has been set. Open the Review pane to inspect changes.')
    })
    return true
  },
  combineDocument: async () => {
    const path = await window.api.openDialogFile()
    if (!path) return false
    updateActiveDocumentConfig((doc) => {
      doc.config.reviewSettings = {
        ...(doc.config.reviewSettings || {}),
        combinePath: path
      }
    })
    await openAlertModal({
      title: t('Combine Documents'),
      message: t('Combine target has been set. Open the Review pane to merge changes.')
    })
    return true
  },
  clearCompareTargets: () => {
    updateActiveDocumentConfig((doc) => {
      doc.config.reviewSettings = {
        ...(doc.config.reviewSettings || {}),
        comparePath: null,
        combinePath: null
      }
    })
    return true
  },
  setDocumentTheme: (themeId: string) => setDocumentTheme(themeId),
  previewDocumentTheme: (themeId?: string) => previewDocumentTheme(themeId),
  setDocumentEffect: (effectId: string) => setDocumentEffect(effectId),
  applySheetStylePreset: (preset: string) => applySheetStylePreset(preset),
  applyConditionalFormatting: (type: string, options?: { threshold?: number; color?: string }) =>
    applyConditionalFormattingRule(type, options),
  addComment: async () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    if (!editor.schema.marks.wordComment) {
      openAlertModal({
        title: t('Comments'),
        message: t('Word comment extension is not available in this editor.')
      })
      return false
    }
    const value = await openTextInputModal({
      title: t('New Comment'),
      message: t('Add a comment for the current selection.'),
      placeholder: t('Type your comment')
    })
    if (!value) return false
    const authUser = get(authStore)?.user
    const authName = authUser
      ? authUser.displayName ||
        authUser.name ||
        `${authUser.firstName || ''} ${authUser.lastName || ''}`.trim() ||
        authUser.username ||
        authUser.email
      : ''
    const author = authName || editor.storage?.review?.author || 'Editor'
    return editor.commands.addWordComment(value, author)
  },
  deleteComment: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    if (!editor.schema.marks.wordComment) return false
    const entry = getWordCommentAtSelection(editor)
    if (!entry) return false
    return editor.commands.deleteWordComment(entry.id)
  },
  nextComment: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    if (!editor.schema.marks.wordComment) return false
    const entries = getWordCommentEntries(editor)
    if (!entries.length) return false
    const next = entries.find((entry) => entry.from > editor.state.selection.from) || entries[0]
    return (
      editor.commands.setTextSelection({ from: next.from, to: next.to }) &&
      editor.commands.scrollIntoView()
    )
  },
  previousComment: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    if (!editor.schema.marks.wordComment) return false
    const entries = getWordCommentEntries(editor)
    if (!entries.length) return false
    const prev =
      [...entries].reverse().find((entry) => entry.from < editor.state.selection.from) ||
      entries[entries.length - 1]
    return (
      editor.commands.setTextSelection({ from: prev.from, to: prev.to }) &&
      editor.commands.scrollIntoView()
    )
  },
  replyWordComment: async (id?: string) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    if (!editor.schema.marks.wordComment) return false
    let targetId = id
    if (!targetId) {
      const entry = getWordCommentAtSelection(editor)
      targetId = entry?.id
    }
    if (!targetId) return false
    const value = await openTextInputModal({
      title: t('Reply to Comment'),
      message: t('Add a reply to the selected comment thread.'),
      placeholder: t('Reply text')
    })
    if (!value) return false
    const author = editor.storage?.review?.author ?? 'Editor'
    return editor.commands.replyWordComment(targetId, value, author)
  },
  resolveWordComment: (id?: string, resolved = true) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    if (!editor.schema.marks.wordComment) return false
    let targetId = id
    if (!targetId) {
      const entry = getWordCommentAtSelection(editor)
      targetId = entry?.id
    }
    if (!targetId) return false
    return editor.commands.resolveWordComment(targetId, resolved)
  },
  deleteWordComment: (id: string) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    if (!editor.schema.marks.wordComment) return false
    return editor.commands.deleteWordComment(id)
  },
  toggleCommentsVisibility: (enabled?: boolean) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const hidden = toggleRootClass(editor, 'review-comments-hidden', enabled) !== false
    updateActiveDocumentConfig((doc) => {
      doc.config.reviewSettings = {
        ...(doc.config.reviewSettings || {}),
        commentsVisible: !hidden
      }
    })
    return hidden
  },
  toggleHideResolvedComments: (enabled?: boolean) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const current = !!editor.storage?.review?.hideResolvedComments
    const next = enabled ?? !current
    editor.storage.review = editor.storage.review || { enabled: false }
    editor.storage.review.hideResolvedComments = next
    updateActiveDocumentConfig((doc) => {
      doc.config.reviewSettings = {
        ...(doc.config.reviewSettings || {}),
        hideResolvedComments: next
      }
    })
    return next
  },
  toggleCommentsMarginOnly: (enabled?: boolean) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const current = !!editor.storage?.review?.commentsMarginOnly
    const next = enabled ?? !current
    editor.storage.review = editor.storage.review || { enabled: false }
    editor.storage.review.commentsMarginOnly = next
    const root = getEditorContainerRoot(editor)
    if (root) {
      if (next) {
        root.classList.add('review-comments-margin-only')
      } else {
        root.classList.remove('review-comments-margin-only')
      }
    }
    updateActiveDocumentConfig((doc) => {
      doc.config.reviewSettings = {
        ...(doc.config.reviewSettings || {}),
        commentsMarginOnly: next
      }
    })
    return next
  },
  toggleOnlyMine: (enabled?: boolean) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const current = !!editor.storage?.review?.onlyShowMine
    const next = enabled ?? !current
    editor.storage.review = editor.storage.review || { enabled: false }
    editor.storage.review.onlyShowMine = next
    updateActiveDocumentConfig((doc) => {
      doc.config.reviewSettings = {
        ...(doc.config.reviewSettings || {}),
        onlyShowMine: next
      }
    })
    return next
  },
  reviewWordCount: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const text = editor.getText({ blockSeparator: ' ' })
    const words = text.trim().split(/\s+/).filter(Boolean)
    const chars = text.length
    openAlertModal({
      title: t('Document Statistics'),
      message: `${t('Words')}: ${words.length}\n${t('Characters')}: ${chars}`
    })
    return true
  },
  runGrammarCheck: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    editor.view.dispatch(editor.state.tr.setMeta('ltUpdate', true))
    return true
  },
  toggleGrammarSuggestions: (enabled?: boolean) => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const hidden = toggleRootClass(editor, 'grammar-suggestions-hidden', enabled) !== false
    updateActiveDocumentConfig((doc) => {
      doc.config.reviewSettings = {
        ...(doc.config.reviewSettings || {}),
        grammarVisible: !hidden
      }
    })
    return hidden
  },
  readAloud: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const text =
      editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ') ||
      editor.getText({ blockSeparator: ' ' })
    if (!text.trim()) return false
    const utterance = new SpeechSynthesisUtterance(text)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    return true
  },
  openThesaurus: async () => {
    await openAlertModal({
      title: t('Thesaurus'),
      message: t('Thesaurus will be available soon.')
    })
    return true
  },
  openTextSpeech: () => GenericFormatingEditorCommands.readAloud(),
  openReviewDraw: async () => {
    await openAlertModal({
      title: t('Draw'),
      message: t('Drawing tools from Review will be available soon.')
    })
    return true
  },
  setTraditionalChinese: async () => {
    await openAlertModal({
      title: t('Traditional'),
      message: t('Traditional conversion will be available soon.')
    })
    return true
  },
  setSimplifiedChinese: async () => {
    await openAlertModal({
      title: t('Simplified'),
      message: t('Simplified conversion will be available soon.')
    })
    return true
  },
  openConversionTools: async () => {
    await openAlertModal({
      title: t('Conversion'),
      message: t('Conversion tools will be available soon.')
    })
    return true
  },
  openRestrictEditing: async () => {
    await openAlertModal({
      title: t('Restrict Editing'),
      message: t('Restrict editing options will be available soon.')
    })
    return true
  },
  startParallelTranslate: async () => {
    await openAlertModal({
      title: t('Parallel Translate'),
      message: t('Parallel translation will be available soon.')
    })
    return true
  },
  openReviewSettings: async () => {
    await openAlertModal({
      title: t('Settings'),
      message: t('Review settings panel will be available soon.')
    })
    return true
  },
  accessibilityCheck: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const json = editor.getJSON()
    let images = 0
    let missingAlt = 0
    let tables = 0
    let tablesMissingHeaders = 0
    let headingOrderIssues = 0
    let lastHeadingLevel = 0
    let lowContrastSamples: string[] = []

    function parseCssColor(color?: string | null) {
      if (!color) return null
      const value = color.trim().toLowerCase()
      if (value.startsWith('rgba')) {
        const parts = value
          .replace(/rgba\\(|\\)/g, '')
          .split(',')
          .map((v) => v.trim())
        const [r, g, b, a] = parts.map((v) => parseFloat(v))
        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
        if (a === 0) return null
        return { r, g, b }
      }
      if (value.startsWith('rgb')) {
        const parts = value
          .replace(/rgb\\(|\\)/g, '')
          .split(',')
          .map((v) => v.trim())
        const [r, g, b] = parts.map((v) => parseFloat(v))
        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
        return { r, g, b }
      }
      if (value.startsWith('#') && (value.length === 7 || value.length === 4)) {
        const raw =
          value.length === 4
            ? value
                .slice(1)
                .split('')
                .map((c) => c + c)
                .join('')
            : value.slice(1)
        const num = parseInt(raw, 16)
        return {
          r: (num >> 16) & 255,
          g: (num >> 8) & 255,
          b: num & 255
        }
      }
      return null
    }

    function luminance(c: { r: number; g: number; b: number }) {
      const a = [c.r, c.g, c.b].map((v) => {
        const srgb = v / 255
        return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
    }

    function contrastRatio(
      fg: { r: number; g: number; b: number },
      bg: { r: number; g: number; b: number }
    ) {
      const L1 = luminance(fg)
      const L2 = luminance(bg)
      const lighter = Math.max(L1, L2)
      const darker = Math.min(L1, L2)
      return (lighter + 0.05) / (darker + 0.05)
    }

    const defaultBg = { r: 255, g: 255, b: 255 }

    function resolveBackgroundColor(el: Element | null) {
      let current: Element | null = el
      while (current) {
        const style = window.getComputedStyle(current)
        const parsed = parseCssColor(style.backgroundColor)
        if (parsed) return parsed
        current = current.parentElement
      }
      return defaultBg
    }

    function scanComputedContrast() {
      if (!editor.view?.dom) return
      const root = editor.view.dom
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let sampled = 0
      while (walker.nextNode()) {
        if (sampled > 300) break
        const textNode = walker.currentNode as Text
        const text = textNode.textContent?.trim()
        if (!text) continue
        const parent = textNode.parentElement
        if (!parent) continue
        const style = window.getComputedStyle(parent)
        const fg = parseCssColor(style.color)
        const bg = resolveBackgroundColor(parent)
        if (!fg) continue
        const ratio = contrastRatio(fg, bg)
        sampled += 1
        if (ratio < 4.5 && lowContrastSamples.length < 5) {
          lowContrastSamples.push(`"${text.slice(0, 28)}…" (${ratio.toFixed(2)}:1)`)
        }
      }
    }

    const walk = (node: any) => {
      if (node.type === 'image') {
        images += 1
        if (!node.attrs?.alt) missingAlt += 1
      }

      if (node.type === 'table') {
        tables += 1
        const hasHeader =
          node.content?.[0]?.type === 'tableHeader' ||
          node.content?.some((row) => row.content?.some((cell) => cell.type === 'tableHeader'))
        if (!hasHeader) tablesMissingHeaders += 1
      }

      if (node.type === 'heading') {
        const level = node.attrs?.level ?? 0
        if (lastHeadingLevel && level > lastHeadingLevel + 1) headingOrderIssues += 1
        lastHeadingLevel = level
      }

      if (Array.isArray(node.content)) node.content.forEach(walk)
    }
    walk(json)
    if (!lowContrastSamples.length) scanComputedContrast()

    const lines = [
      `${t('Images')}: ${images}`,
      `${t('Missing alt text')}: ${missingAlt}`,
      `${t('Tables')}: ${tables}`,
      `${t('Tables without headers')}: ${tablesMissingHeaders}`,
      `${t('Heading order issues')}: ${headingOrderIssues}`
    ]
    if (lowContrastSamples.length) {
      lines.push(`${t('Low contrast samples')}:`)
      lowContrastSamples.forEach((s) => lines.push(`- ${s}`))
    }

    openAlertModal({
      title: t('Accessibility Scan'),
      message: lines.join('\n')
    })
    return true
  },
  openTranslatePane: () => {
    _$_secondarySidebarVisible.set(true)
    _$_activeSecondarySidebarItem.set('translate')
    return true
  },
  markAllHighlightsAsRead: () => {
    const editor = getActiveEditorInstance()
    if (!editor) return false
    const { state } = editor
    const mark = state.schema.marks.highlight
    if (!mark) return false
    const tr = state.tr
    state.doc.descendants((node, pos) => {
      if (node.isText && mark.isInSet(node.marks)) {
        tr.removeMark(pos, pos + node.nodeSize, mark)
      }
    })
    if (tr.steps.length) {
      editor.view.dispatch(tr)
      return true
    }
    return false
  }
}

export const GenericFormatingEditorCommands = {
  ...EditorTableCommands,
  ...EditorClipboardCommands,
  ...EditorNavigationCommands,
  ...EditorFormattingCommands,
  ...EditorReviewCommands,
  // Ribbon buttons call these through the command map; the standalone
  // exports alone would leave the Import/Export buttons throwing.
  importSpreadsheet,
  exportSpreadsheet,
  getCommandPaletteItems
}

export const EditorCommandGroups = {
  clipboard: EditorClipboardCommands,
  navigation: EditorNavigationCommands,
  formatting: EditorFormattingCommands,
  table: EditorTableCommands,
  review: EditorReviewCommands
}
