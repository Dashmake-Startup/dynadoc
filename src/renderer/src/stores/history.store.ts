import { UndoManager, type AbstractType } from 'yjs'
import type { Editor as TiptapEditor } from '@tiptap/core'
import type { CollaborativeCanvas } from '../utils/canvas.types'
import { writable } from 'svelte/store'

export type HistoryController = {
  id: string
  label: string
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

export type HistoryPreviewEntry = {
  label: string
  at: number
}

type EditorHistoryEntry = {
  editorId: string
  editor?: TiptapEditor
  yUndo?: UndoManager
  controller?: HistoryController
  nodeviews: Map<string, HistoryController>
  undoPreview: HistoryPreviewEntry[]
  redoPreview: HistoryPreviewEntry[]
  editorTxnListener?: ((props: { editor: TiptapEditor; transaction: any }) => void) | null
  lastNodeviewId?: string | null
  lastContext?: 'editor' | 'nodeview'
}

const historyRegistry = new Map<string, EditorHistoryEntry>()
const MAX_PREVIEW_ITEMS = 8
const historyRevision = writable(0)

const notifyHistoryChanged = () => historyRevision.update((revision) => revision + 1)

/** Subscribe to history changes so UI controls stay in sync with editor transactions. */
export const subscribeToHistoryChanges = historyRevision.subscribe

const pushUndoPreview = (entry: EditorHistoryEntry, label: string) => {
  entry.undoPreview.unshift({ label, at: Date.now() })
  if (entry.undoPreview.length > MAX_PREVIEW_ITEMS) entry.undoPreview.length = MAX_PREVIEW_ITEMS
  entry.redoPreview = []
  notifyHistoryChanged()
}

const popUndoPreview = (entry: EditorHistoryEntry) => {
  const next = entry.undoPreview.shift()
  if (next) {
    entry.redoPreview.unshift(next)
    if (entry.redoPreview.length > MAX_PREVIEW_ITEMS) entry.redoPreview.length = MAX_PREVIEW_ITEMS
  }
  notifyHistoryChanged()
}

const popRedoPreview = (entry: EditorHistoryEntry) => {
  const next = entry.redoPreview.shift()
  if (next) {
    entry.undoPreview.unshift(next)
    if (entry.undoPreview.length > MAX_PREVIEW_ITEMS) entry.undoPreview.length = MAX_PREVIEW_ITEMS
  }
  notifyHistoryChanged()
}

const buildTiptapController = (editorId: string, editor: TiptapEditor): HistoryController => ({
  id: editorId,
  label: 'tiptap',
  undo: () => editor.commands.undo?.(),
  redo: () => editor.commands.redo?.(),
  canUndo: () => editor.can?.().undo?.() ?? false,
  canRedo: () => editor.can?.().redo?.() ?? false
})

const buildYjsController = (editorId: string, undoManager: UndoManager): HistoryController => ({
  id: editorId,
  label: 'yjs',
  undo: () => undoManager.undo(),
  redo: () => undoManager.redo(),
  canUndo: () => undoManager.undoStack.length > 0,
  canRedo: () => undoManager.redoStack.length > 0
})

export function registerEditorHistory(params: {
  editorId: string
  editor: TiptapEditor
  /**
   * Kept for backwards compatibility. The editor's commands must own document
   * history because Collaboration configures their Yjs undo manager with the
   * correct transaction origin.
   */
  ydocTypes?: AbstractType[]
}): HistoryController | null {
  const { editorId, editor } = params
  if (!editorId || !editor) return null

  const entry: EditorHistoryEntry = historyRegistry.get(editorId) || {
    editorId,
    nodeviews: new Map(),
    undoPreview: [],
    redoPreview: [],
    editorTxnListener: null,
    lastNodeviewId: null,
    lastContext: 'editor'
  }

  if (entry.editor && entry.editor !== editor && entry.editorTxnListener) {
    entry.editor.off('transaction', entry.editorTxnListener)
    entry.editorTxnListener = null
  }
  entry.editor = editor

  // Collaboration installs a y-prosemirror undo manager whose tracked origin
  // is the sync plugin. A separate raw UndoManager misses those transactions,
  // leaving canUndo/canRedo permanently false. Tiptap commands delegate to
  // that collaboration-aware manager and also work for non-collaborative
  // editors with the standard History extension.
  entry.yUndo?.destroy()
  entry.yUndo = undefined
  entry.controller = buildTiptapController(editorId, editor)

  historyRegistry.set(editorId, entry)
  notifyHistoryChanged()

  if (!entry.editorTxnListener) {
    const listener = ({ transaction }: { editor: TiptapEditor; transaction: any }) => {
      if (!transaction?.docChanged) return
      if (transaction.getMeta?.('addToHistory') === false) return
      pushUndoPreview(entry, 'Text edit')
      entry.lastContext = 'editor'
    }
    entry.editorTxnListener = listener
    editor.on('transaction', listener)
  }

  if (entry.yUndo) {
    entry.yUndo.on('stack-item-added', () => {
      pushUndoPreview(entry, 'Text edit')
      entry.lastContext = 'editor'
    })
  }

  return entry.controller
}

export function unregisterEditorHistory(editorId: string) {
  const entry = historyRegistry.get(editorId)
  if (!entry) return
  if (entry.editor && entry.editorTxnListener) {
    entry.editor.off('transaction', entry.editorTxnListener)
    entry.editorTxnListener = null
  }
  entry.yUndo?.destroy()
  historyRegistry.delete(editorId)
  notifyHistoryChanged()
}

export function registerNodeviewHistory(
  editorId: string,
  nodeviewId: string,
  canvas: CollaborativeCanvas | null,
  nodeviewType?: string
) {
  if (!editorId || !nodeviewId || !canvas) return
  const entry: EditorHistoryEntry = historyRegistry.get(editorId) || {
    editorId,
    nodeviews: new Map(),
    undoPreview: [],
    redoPreview: [],
    editorTxnListener: null,
    lastNodeviewId: null,
    lastContext: 'editor'
  }

  const scopes: AbstractType[] = []
  if (canvas.shapes) scopes.push(canvas.shapes)
  if (canvas.texts) scopes.push(canvas.texts)
  if (canvas.meta) scopes.push(canvas.meta)
  if (scopes.length === 0) return

  const undoManager = new UndoManager(scopes, { captureTimeout: 350 })
  const controller: HistoryController = {
    id: nodeviewId,
    label: 'nodeview',
    undo: () => undoManager.undo(),
    redo: () => undoManager.redo(),
    canUndo: () => undoManager.undoStack.length > 0,
    canRedo: () => undoManager.redoStack.length > 0
  }

  const labelBase = nodeviewType ? `${nodeviewType} edit` : 'Canvas edit'
  undoManager.on('stack-item-added', () => {
    pushUndoPreview(entry, labelBase)
    entry.lastNodeviewId = nodeviewId
    entry.lastContext = 'nodeview'
  })

  entry.nodeviews.set(nodeviewId, controller)
  historyRegistry.set(editorId, entry)
  notifyHistoryChanged()
}

export function unregisterNodeviewHistory(editorId: string, nodeviewId: string) {
  const entry = historyRegistry.get(editorId)
  if (!entry) return
  entry.nodeviews.delete(nodeviewId)
  notifyHistoryChanged()
}

export function getHistoryController(
  editorId: string,
  nodeviewId?: string | null
): HistoryController | null {
  const entry = historyRegistry.get(editorId)
  if (!entry) return null
  if (nodeviewId && entry.nodeviews.has(nodeviewId)) {
    return entry.nodeviews.get(nodeviewId) || null
  }
  if (
    entry.lastContext === 'nodeview' &&
    entry.lastNodeviewId &&
    entry.nodeviews.has(entry.lastNodeviewId)
  ) {
    const ctrl = entry.nodeviews.get(entry.lastNodeviewId)
    if (ctrl?.canUndo?.() || ctrl?.canRedo?.()) return ctrl || null
  }
  return entry.controller || null
}

export function undoFor(editorId: string, nodeviewId?: string | null) {
  const ctrl = getHistoryController(editorId, nodeviewId)
  const entry = historyRegistry.get(editorId)
  if (!ctrl?.canUndo()) return
  ctrl.undo()
  if (entry) popUndoPreview(entry)
}

export function redoFor(editorId: string, nodeviewId?: string | null) {
  const ctrl = getHistoryController(editorId, nodeviewId)
  const entry = historyRegistry.get(editorId)
  if (!ctrl?.canRedo()) return
  ctrl.redo()
  if (entry) popRedoPreview(entry)
}

export function canUndoFor(editorId: string, nodeviewId?: string | null): boolean {
  const ctrl = getHistoryController(editorId, nodeviewId)
  return ctrl?.canUndo() ?? false
}

export function canRedoFor(editorId: string, nodeviewId?: string | null): boolean {
  const ctrl = getHistoryController(editorId, nodeviewId)
  return ctrl?.canRedo() ?? false
}

export function getUndoPreview(
  editorId: string,
  nodeviewId?: string | null
): HistoryPreviewEntry[] {
  const entry = historyRegistry.get(editorId)
  if (!entry) return []
  if (nodeviewId && entry.nodeviews.has(nodeviewId)) {
    return entry.undoPreview
  }
  return entry.undoPreview
}

export function getRedoPreview(
  editorId: string,
  nodeviewId?: string | null
): HistoryPreviewEntry[] {
  const entry = historyRegistry.get(editorId)
  if (!entry) return []
  if (nodeviewId && entry.nodeviews.has(nodeviewId)) {
    return entry.redoPreview
  }
  return entry.redoPreview
}
