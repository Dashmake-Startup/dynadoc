import Utils from '../utils/Utils'

/**
 * Copyright (C) 2025 Dashmake Inc.
 *
 * This file is part of DDoc Office.
 *
 * DDoc Office is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DDoc Office is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
 */
/* import { writable } from 'svelte/store'
import type { Editor } from '@tiptap/core'
import type { Editor } from '@tiptap/core'

// export const _$_wysiwygEditor = writable<Editor | null>(null)

export type EditorEntry = {
  id: string // could be UUID, section ID, etc.
  editor: Editor
}

const { subscribe, set, update } = writable<EditorEntry[]>([])

export const _$_wysiwygEditorsList = {
  subscribe,
  set,
  update,
  register(id: string, editor: Editor): void {
    // console.log('Registering editor with ID:', id, editor)
    update((list) => {
      // console.log('Register editor :', id, list)
      // replace if ID already exists, else add
      const existing = list.find((e) => e.id === id)
      if (existing) {
        return list.map((e) => (e.id === id ? { id, editor } : e))
      }
      return [...list, { id, editor }]
    })
  },
  unregister(id: string): void {
    update((list) => list.filter((e) => e.id !== id))
  },
  get(id: string): Editor | undefined {
    let editor: Editor | undefined
    const unsubscribe = subscribe((list) => {
      editor = list.find((e) => e.id === id)?.editor
    })
    unsubscribe() // just a one-time read
    return editor
  }
} */

import { derived, writable, get, type Readable } from 'svelte/store'
import type { Editor as TiptapEditor } from '@tiptap/core'
import type * as monaco from 'monaco-editor'
import { DocumentModel } from '../models/Document'
import { DocumentEditorModel, DocumentTranslation } from '../models/Document'
import { attachEditorPersistence } from './editor.persistence'
import { CustomSlideExtensionProps } from '../extensions/tiptap/CustomSlideExtension/utils/common.utils'
import type { CustomSpreadsheetExtensionProps } from '../extensions/tiptap/CustomSpreadsheetExtension/utils/common.utils'
import type { CustomChartExtensionProps } from '../extensions/tiptap/CustomChartExtension/utils/common.utils'
import type { CustomDesignExtensionProps } from '../extensions/tiptap/CustomDesignExtension/utils/common.utils'
import type { CollaborativeCanvas } from '../utils/canvas.types'
import type { PaginationPlusOptions } from '../extensions/tiptap/utils/common.utils'

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

type DebouncedFn<T extends (...args: any[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel?: () => void
}

const debounce = <T extends (...args: any[]) => void>(fn: T, wait = 0): DebouncedFn<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  const debounced = ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }) as DebouncedFn<T>
  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  return debounced
}
import { _$_currentView, _$_lastActiveEditorId, _$_lastActiveTranslationPath } from './common.store'
import { registerNodeviewHistory, unregisterNodeviewHistory } from './history.store'
import { getStorageDirCached } from '../utils/storageDir'
import { clearAllShareCaches, clearShareCache, shareCacheIdFromPath } from '../utils/shareCache'
import { nodeApi } from '../utils/shims/node'

const normalizeEditorId = (value?: string | number | null): string =>
  value === null || value === undefined ? '' : value.toString()

const resolveEditorIdentity = (editor?: DocumentEditorModel | null): string =>
  normalizeEditorId(editor?.uuid || editor?.document?.uuid || editor?.id)

const matchesEditorIdentity = (
  editor: DocumentEditorModel | null | undefined,
  idOrUuid?: string | number | null
): boolean => {
  const target = normalizeEditorId(idOrUuid)
  if (!target || !editor) return false
  const looksLikePath =
    /[\\/]/.test(target) ||
    target.endsWith('.html') ||
    target.endsWith(Utils.DYNADOC_EXTENSIONS.default) ||
    target.endsWith(Utils.DYNADOC_EXTENSIONS.secured)
  if (looksLikePath) {
    return (
      normalizeEditorId(editor.document?.path) === target ||
      normalizeEditorId(editor.document?.getMainFilePath?.()) === target ||
      normalizeEditorId(editor.id) === target ||
      normalizeEditorId(editor.uuid) === target
    )
  }
  return (
    normalizeEditorId(editor.uuid) === target ||
    normalizeEditorId(editor.document?.uuid) === target ||
    normalizeEditorId(editor.id) === target ||
    normalizeEditorId(editor.document?.path) === target ||
    normalizeEditorId(editor.document?.getMainFilePath?.()) === target
  )
}

const recentEditorHistory: string[] = []
const MAX_EDITOR_HISTORY = 50

function collectShareCacheIds(editors: Array<DocumentEditorModel | null | undefined>): string[] {
  const ids = new Set<string>()
  for (const editor of editors) {
    const path =
      editor?.document?.path || editor?.document?.cachePath || editor?.document?.getMainFilePath?.()
    const id = path ? shareCacheIdFromPath(path) : ''
    if (id) ids.add(id)
  }
  return Array.from(ids)
}

function recordEditorVisit(editorId?: string | null) {
  const normalized = normalizeEditorId(editorId)
  if (!normalized) return
  const existingIndex = recentEditorHistory.indexOf(normalized)
  if (existingIndex >= 0) {
    recentEditorHistory.splice(existingIndex, 1)
  }
  recentEditorHistory.push(normalized)
  if (recentEditorHistory.length > MAX_EDITOR_HISTORY) {
    recentEditorHistory.splice(0, recentEditorHistory.length - MAX_EDITOR_HISTORY)
  }
}

function removeEditorFromHistory(editorId?: string | null) {
  const normalized = normalizeEditorId(editorId)
  if (!normalized) return
  const existingIndex = recentEditorHistory.indexOf(normalized)
  if (existingIndex >= 0) {
    recentEditorHistory.splice(existingIndex, 1)
  }
}

function clearEditorHistory() {
  recentEditorHistory.splice(0, recentEditorHistory.length)
}

function findPreviousVisitedEditor(availableEditors: DocumentEditorModel[]) {
  for (let i = recentEditorHistory.length - 1; i >= 0; i -= 1) {
    const candidateId = recentEditorHistory[i]
    const candidate = availableEditors.find((editor) => matchesEditorIdentity(editor, candidateId))
    if (candidate) {
      return candidate
    }
  }
  return null
}
// ----------------------
// WYSIWYG (Tiptap) Store
// ----------------------

export type WysiwygEditorEntry = {
  id: string
  filePath: string
  editor: TiptapEditor
  editorHTMLElement: HTMLElement
  editorHTMLContainer: HTMLElement
  editorHTMLContainerRoot: HTMLElement
  isActive: boolean
  nodeViews?: WysiwygEditorNodeviewEntry[]
  paginationOptions?: PaginationPlusOptions
}

export type WysiwygEditorNodeviewType =
  | typeof CustomSlideExtensionProps.name
  | typeof CustomSpreadsheetExtensionProps.name
  | typeof CustomChartExtensionProps.name
  | typeof CustomDesignExtensionProps.name

export type WysiwygEditorNodeviewEntry = {
  id: string
  type: WysiwygEditorNodeviewType
  collaborativeCanvas: CollaborativeCanvas
  isActive: boolean
}

// export type WysiwygEditorPaginationOptions  = {
//   width: number,
//   hei
// }

const wysiwygStore = writable<WysiwygEditorEntry[]>([])

export const _$_wysiwygEditorsList = {
  subscribe: wysiwygStore.subscribe,
  set: wysiwygStore.set,
  update: wysiwygStore.update,
  register(
    id: string,
    editor: TiptapEditor,
    filePath: string = '',
    editorHTMLElement: HTMLElement = null,
    editorHTMLContainer: HTMLElement = null,
    editorHTMLContainerRoot: HTMLElement = null,
    isActive: boolean = false,
    nodeViews: WysiwygEditorNodeviewEntry[] = [],
    paginationOptions: PaginationPlusOptions = null
  ): void {
    id = id?.toString()
    wysiwygStore.update((list) => {
      const existing = list.find((e) => e?.id?.toString() === id?.toString())
      // replace if ID already exists, else add
      if (existing) {
        // return list.map((e) => (e.id === id ? { id, editor } : e))
        return list.map((e) =>
          e?.id?.toString() === id?.toString()
            ? {
                id,
                editor,
                filePath,
                editorHTMLElement,
                editorHTMLContainer,
                editorHTMLContainerRoot,
                isActive,
                nodeViews,
                paginationOptions
              }
            : e
        )
      }
      return [
        ...list,
        {
          id,
          editor,
          filePath,
          editorHTMLElement,
          editorHTMLContainer,
          editorHTMLContainerRoot,
          isActive,
          nodeViews,
          paginationOptions
        }
      ]
    })
  },
  // registerNodeview
  unregister(id: string): void {
    // wysiwygStore.update((list) => list.filter((e) => e.id !== id))
    wysiwygStore.update((list) => list.filter((e) => e?.id?.toString() !== id?.toString()))
  },
  // unregisterNodeview

  getList(): WysiwygEditorEntry[] {
    return get(wysiwygStore)
  },
  // getListNodeview

  get2(id: string): TiptapEditor | undefined {
    let editor: TiptapEditor | undefined
    const unsubscribe = wysiwygStore.subscribe((list) => {
      // editor = list.find((e) => e.id === id)?.editor
      editor = list.find((e) => e?.id?.toString() === id?.toString())?.editor
    })
    // unsubscribe() // just a one-time read
    return editor
  },
  get(id: string): Readable<TiptapEditor | undefined> {
    // get2(id: string): TiptapEditor | undefined {
    // const list = get(wysiwygStore)
    // return list.find((e) => e?.id?.toString() === id?.toString())?.editor

    return derived(
      wysiwygStore,
      (list) => list.find((e) => e?.id?.toString() === id?.toString())?.editor
    )
  },
  //     getNodeview

  getItem(id: string): TiptapEditor | undefined {
    // get2(id: string): TiptapEditor | undefined {
    const list = get(wysiwygStore)
    return list.find((e) => e?.id?.toString() === id?.toString())?.editor
  },
  // getItemNodeview

  getEntry(id: string): WysiwygEditorEntry | undefined {
    let entry: WysiwygEditorEntry | undefined
    const unsubscribe = wysiwygStore.subscribe((list) => {
      // editor = list.find((e) => e.id === id)?.editor
      entry = list.find((e) => e?.id?.toString() === id?.toString())
    })
    // unsubscribe() // just a one-time read
    return entry
  },

  getEntryStore(id: string): Readable<WysiwygEditorEntry | undefined> {
    return derived(wysiwygStore, (list) => list.find((e) => e?.id?.toString() === id?.toString()))
  },
  /** 🔍 Get the currently active WYSIWYG editor based on the active document editor */
  getActive2(): TiptapEditor | undefined {
    const activeDoc = _$_documentEditorsList.getActiveSync()
    // console.log('activeDoc ', activeDoc)
    if (!activeDoc) return undefined
    return _$_wysiwygEditorsList.getItem(resolveEditorIdentity(activeDoc))
    // return _$_wysiwygEditorsList.get(activeDoc.id || activeDoc.index.toString())
  },
  getActive: () => derived(wysiwygStore, (list) => list.find((e) => e.isActive)),
  // getActive: () => derived(documentEditorStore, (list) => list.find((e) => e.isActive)),

  //     // getActiveNodeview

  /** 🔍 Get the currently active WYSIWYG editor based on the active document editor */
  getActiveEntry(): WysiwygEditorEntry | undefined {
    // const activeDoc = get(_$_documentEditorsList.getActive())
    const activeDoc = _$_documentEditorsList.getActiveSync()
    // console.log('activeDoc ', activeDoc)
    if (!activeDoc) return undefined
    return _$_wysiwygEditorsList.getEntry(resolveEditorIdentity(activeDoc))
    // return _$_wysiwygEditorsList.getEntry(activeDoc.id || activeDoc.index.toString())
  },

  /** 🪄 Set active WYSIWYG editor by ID or index (propagates to document store too) */
  setActive(
    indexOrId: string | number,
    setParentDocumentToo: boolean = false,
    childNodeIdToSetToActive?: string
  ): void {
    // console.log("focusfocus setActive")

    wysiwygStore.update((list) =>
      list.map((e, idx) => {
        const shouldActivate =
          typeof indexOrId === 'number'
            ? idx === indexOrId
            : e?.id?.toString() === indexOrId.toString()
        // console.log("focusfocus shouldActivate", { shouldActivate })

        if (shouldActivate) {
          // 1. Trigger the Tiptap focus command
          // We use requestAnimationFrame or a 0ms timeout to ensure
          // the browser handles the focus after Svelte updates the DOM.
          if (!e.editor.isFocused) {
            requestAnimationFrame(() => {
              // console.log("focusfocus", e.editor.commands.focus())
              // e.editor.commands.focus();
            })
          }
        }
        // create a new instance to keep type consistency
        return {
          ...e,
          isActive: shouldActivate,
          nodeViews: e.nodeViews?.map((nv) => ({
            ...nv,
            isActive: Boolean(
              shouldActivate && childNodeIdToSetToActive && nv.id === childNodeIdToSetToActive
            )
          }))
        }
      })
    )

    // if childNodeIdToSetToActive, deactivatee all and set the one with the id to active, else desactivee all

    if (setParentDocumentToo) {
      _$_documentEditorsList.setActive(indexOrId)
    }
  },
  //setActiveNodeview

  unsetActive(indexOrId?: string | number, setParentDocumentToo: boolean = false): void {
    // Update WYSIWYG store
    wysiwygStore.update((list) =>
      list.map((item, idx) => {
        // If indexOrId is provided, only unset that one; otherwise unset all
        const shouldUnset =
          indexOrId === undefined
            ? item.isActive
            : typeof indexOrId === 'number'
              ? idx === indexOrId
              : item.id?.toString() === indexOrId.toString()

        return shouldUnset ? { ...item, isActive: false } : item
      })
    )

    // Optionally update the parent document editor
    if (setParentDocumentToo) {
      if (indexOrId !== undefined) {
        _$_documentEditorsList.unsetActive(indexOrId)
      } else {
        // _$_documentEditorsList.unsetAll(); // you might want a method to unset all
      }
    }
  },

  //unsetActiveNodeview

  // ======================
  // NodeView lifecycle
  // ======================

  registerNodeview(editorId: string, nodeview: WysiwygEditorNodeviewEntry): void {
    editorId = editorId?.toString()
    /* console.log(
        'yes focus registerNodeview yes',
        // __wysiwygEditorIdToUpdate,
        _$_wysiwygEditorsList.getList(),
        // _$_wysiwygEditorsList.getEntry(__wysiwygEditorIdToUpdate)
      ) */

    const tryRegister = (): boolean => {
      let didRegister = false

      wysiwygStore.update((list) => {
        return list.map((e) => {
          if (e.id !== editorId) return e

          const exists = e.nodeViews?.some((nv) => nv.id === nodeview.id)

          didRegister = true

          return {
            ...e,
            nodeViews: exists
              ? e.nodeViews.map((nv) => (nv.id === nodeview.id ? nodeview : nv))
              : [...(e.nodeViews ?? []), nodeview]
          }
        })
      })

      return didRegister
    }

    // ✅ 1️⃣ Try immediately (fast path)
    if (tryRegister()) {
      if (nodeview?.collaborativeCanvas) {
        registerNodeviewHistory(editorId, nodeview.id, nodeview.collaborativeCanvas, nodeview.type)
      }
      return
    }

    // ⏳ 2️⃣ Editor not ready → wait once
    const unsubscribe = wysiwygStore.subscribe((list) => {
      /* console.log(
        'yes focus registerNodeview update',
        // __wysiwygEditorIdToUpdate,
        _$_wysiwygEditorsList.getList(),
        // _$_wysiwygEditorsList.getEntry(__wysiwygEditorIdToUpdate)
      ) */

      const exists = list.some((e) => e.id === editorId)
      if (!exists) return

      /* console.log(
        'yes focus registerNodeview update',
        // __wysiwygEditorIdToUpdate,
        _$_wysiwygEditorsList.getList(),
        // _$_wysiwygEditorsList.getEntry(__wysiwygEditorIdToUpdate)
      ) */

      tryRegister()
      if (nodeview?.collaborativeCanvas) {
        registerNodeviewHistory(editorId, nodeview.id, nodeview.collaborativeCanvas, nodeview.type)
      }
      unsubscribe() // ✅ IMPORTANT: one-shot
    })
  },

  registerNodeview2(editorId: string, nodeview: WysiwygEditorNodeviewEntry): void {
    wysiwygStore.update((list) => {
      console.log(
        'yes focus registerNodeview update',
        // __wysiwygEditorIdToUpdate,
        _$_wysiwygEditorsList.getList()
        // _$_wysiwygEditorsList.getEntry(__wysiwygEditorIdToUpdate)
      )

      return list.map((e) => {
        if (e.id !== editorId?.toString()) return e

        const exists = e.nodeViews.find((nv) => nv.id === nodeview.id)

        return {
          ...e,
          nodeViews: exists
            ? e.nodeViews.map((nv) => (nv.id === nodeview.id ? nodeview : nv))
            : [...e.nodeViews, nodeview]
        }
      })
    })
  },

  unregisterNodeview(editorId: string, nodeviewId: string): void {
    wysiwygStore.update((list) =>
      list.map((e) =>
        e.id === editorId?.toString()
          ? {
              ...e,
              nodeViews: e.nodeViews.filter((nv) => nv.id !== nodeviewId?.toString())
            }
          : e
      )
    )
    unregisterNodeviewHistory(editorId, nodeviewId)
  },

  /*  getPaginationOptions(editorId: string): PaginationPlusOptions | null {
     return (
       get(wysiwygStore)
         .find(e => e.id === editorId?.toString())
         ?.paginationOptions ?? null
     )
   },
 
   setPaginationOptions(
     editorId: string,
     paginationOptions: PaginationPlusOptions
   ): void {
     wysiwygStore.update(list =>
       list.map(e =>
         e.id === editorId?.toString()
           ? {
             ...e,
             paginationOptions
           }
           : e
       )
     )
   }, */

  // ======================
  // Pagination Options
  // ======================
  /**
   * 🔗 Reactive bridge for Svelte 5 Runes
   * Returns a derived store for a specific editor's pagination options.
   */
  getPaginationOptionsStore(editorId: string): Readable<PaginationPlusOptions | null> {
    if (!editorId) return null
    const stringId = editorId?.toString()
    return derived(wysiwygStore, ($list) => {
      const entry = $list.find((e) => e.id === stringId)
      return entry?.paginationOptions ?? null
    })
  },

  getPaginationOptions(editorId: string): PaginationPlusOptions | null {
    return get(wysiwygStore).find((e) => e.id === editorId?.toString())?.paginationOptions ?? null
  },

  /* setPaginationOptions(editorId: string, paginationOptions: PaginationPlusOptions): void {
    const stringId = editorId?.toString();
    wysiwygStore.update(list =>
      list.map(e => (e.id === stringId ? { ...e, paginationOptions } : e))
    );
  }, */
  setPaginationOptions(editorId: string, paginationOptions: PaginationPlusOptions): void {
    const stringId = editorId?.toString()
    wysiwygStore.update((list) =>
      list.map((e) =>
        e.id === stringId
          ? { ...e, paginationOptions: { ...paginationOptions } } // Force new references
          : e
      )
    )
  },

  /** 📄 Get pagination options for the currently active editor */
  getActiveEditorPaginationOptions(): PaginationPlusOptions | null {
    const active = this.getActiveEntrySync()
    return active?.paginationOptions ?? null
  },

  /** 📄 Update pagination options for the currently active editor */
  setActiveEditorPaginationOptions(paginationOptions: PaginationPlusOptions): void {
    wysiwygStore.update((list) => list.map((e) => (e.isActive ? { ...e, paginationOptions } : e)))
  },

  getNodeviews(editorId: string): WysiwygEditorNodeviewEntry[] {
    return get(wysiwygStore).find((e) => e.id === editorId?.toString())?.nodeViews ?? []
  },

  getNodeview(editorId: string, nodeviewId: string): WysiwygEditorNodeviewEntry | undefined {
    return this.getNodeviews(editorId).find((nv) => nv.id === nodeviewId?.toString())
  },

  setActiveNodeview(editorId: string, nodeviewId: string): void {
    wysiwygStore.update((list) =>
      list.map((e) =>
        e.id === editorId?.toString()
          ? {
              ...e,
              nodeViews: e.nodeViews.map((nv) => ({
                ...nv,
                isActive: nv.id === nodeviewId?.toString()
              }))
            }
          : e
      )
    )
  },

  unsetActiveNodeview(editorId: string, nodeviewId?: string): void {
    wysiwygStore.update((list) =>
      list.map((e) =>
        e.id === editorId?.toString()
          ? {
              ...e,
              nodeViews: e.nodeViews.map((nv) => ({
                ...nv,
                isActive:
                  nodeviewId === undefined
                    ? false
                    : nv.id === nodeviewId?.toString()
                      ? false
                      : nv.isActive
              }))
            }
          : e
      )
    )
  },

  getActiveNodeviewStore(editorId: string) {
    return derived(_$_wysiwygEditorsList, ($list) => {
      // 1. Find the specific editor by ID
      const editor = $list.find((e) => e.id === editorId?.toString())

      // 2. Return the active NodeView within THAT editor
      return editor?.nodeViews?.find((nv) => nv.isActive)
    })
  },

  getActiveNodeview(editorId: string): WysiwygEditorNodeviewEntry | undefined {
    return this.getNodeviews(editorId).find((nv) => nv.isActive)
  },

  getActiveNodeviewOfActiveEditor(): WysiwygEditorNodeviewEntry | undefined {
    const activeEditor = this.getActiveEntry()
    return activeEditor?.nodeViews.find((nv) => nv.isActive)
  },

  getActiveNodeviewOfActiveEditorStore: () =>
    derived(_$_wysiwygEditorsList, (list) => {
      const activeEditor = list.find((e) => e.isActive)
      return activeEditor?.nodeViews?.find((nv) => nv.isActive)
    })
}

// ----------------------
// Monaco Editor Store
// ----------------------

export type CodeEditorEntry = {
  id: string
  editor: monaco.editor.IStandaloneCodeEditor
}

const codeStore = writable<CodeEditorEntry[]>([])

export const _$_codeEditorsList = {
  subscribe: codeStore.subscribe,
  set: codeStore.set,
  update: codeStore.update,
  updateLayout(): void {
    codeStore.update((editors) => {
      editors.forEach((editor) => {
        // console.log('Resizing editor:', editor)
        // if (editor.editor && editor.editor.view) {
        //   editor.editor.view.updateState(editor.editor.state)
        // }
        editor.editor.layout()
      })
      return editors
    })
  },
  register(id: string, editor: monaco.editor.IStandaloneCodeEditor): void {
    id = id?.toString()
    codeStore.update((list) => {
      const existing = list.find((e) => e?.id?.toString() === id?.toString())
      if (existing) {
        return list.map((e) => (e?.id?.toString() === id?.toString() ? { id, editor } : e))
      }
      return [...list, { id, editor }]
    })
  },
  unregister(id: string): void {
    codeStore.update((list) => list.filter((e) => e?.id?.toString() !== id?.toString()))
  },

  getList(): CodeEditorEntry[] {
    return get(codeStore)
  },
  get2(id: string): monaco.editor.IStandaloneCodeEditor | undefined {
    let editor: monaco.editor.IStandaloneCodeEditor | undefined
    const unsubscribe = codeStore.subscribe((list) => {
      editor = list.find((e) => e?.id?.toString() === id?.toString())?.editor
    })
    // unsubscribe() // just a one-time read
    return editor
  },
  get(id: string): Readable<monaco.editor.IStandaloneCodeEditor | undefined> {
    return derived(
      codeStore,
      (list) => list.find((e) => e?.id?.toString() === id?.toString())?.editor
    )
  },

  getItem(id: string): monaco.editor.IStandaloneCodeEditor | undefined {
    const list = get(codeStore)
    return list.find((e) => e?.id?.toString() === id?.toString())?.editor
  },
  /** 🔍 Get the currently active Code editor based on the active document editor */
  getActive(): monaco.editor.IStandaloneCodeEditor | undefined {
    const activeDoc = _$_documentEditorsList.getActiveSync?.()
    if (!activeDoc) return undefined
    return _$_codeEditorsList.getItem(resolveEditorIdentity(activeDoc))
  },

  /** 🪄 Set active Code editor by ID or index (propagates to document store too) */
  setActive(indexOrId: string | number): void {
    _$_documentEditorsList.setActive(indexOrId)
  }
}

// ----------------------
// Document Editors Store
// ----------------------

// const documentEditorStore = writable<DocumentEditorModel[]> = writable([])
const baseDocumentEditorStore = writable<DocumentEditorModel[]>([])
// export const _$_documentEditorStorePath = nodeApi.path.join('x', 'documentEditors.store.json')
// export const _$_documentEditorStorePath = nodeApi.path.join(await window.api.getStorageDir(), 'documentEditors.store.json')
export let _$_documentEditorStorePath = ''

function normalizeActiveDocumentEditors(editors: DocumentEditorModel[]): DocumentEditorModel[] {
  if (!Array.isArray(editors)) return []

  const activeEntries = editors
    .map((editor) => ({ editor, id: resolveEditorIdentity(editor) }))
    .filter(({ editor, id }) => Boolean(editor?.isActive) && Boolean(id))

  if (activeEntries.length <= 1) return editors

  const preferredActiveId =
    get(_$_lastActiveEditorId) || activeEntries[activeEntries.length - 1].id || activeEntries[0].id

  return editors.map((editor) => {
    const id = resolveEditorIdentity(editor)
    const shouldBeActive = id === preferredActiveId
    if (Boolean(editor?.isActive) !== shouldBeActive) {
      return new DocumentEditorModel({ ...editor, isActive: shouldBeActive })
    }
    return editor
  })
}

const documentEditorStore = {
  subscribe: baseDocumentEditorStore.subscribe,
  set(editors: DocumentEditorModel[]) {
    baseDocumentEditorStore.set(normalizeActiveDocumentEditors(editors))
  },
  update(updater: (list: DocumentEditorModel[]) => DocumentEditorModel[]) {
    baseDocumentEditorStore.update((list) => normalizeActiveDocumentEditors(updater(list)))
  }
}

function setDocumentEditors(editors: DocumentEditorModel[]): void {
  documentEditorStore.set(editors)
}

function updateDocumentEditors(
  updater: (list: DocumentEditorModel[]) => DocumentEditorModel[]
): void {
  documentEditorStore.update(updater)
}

// 2. Initialize asynchronously
export async function initializeStore() {
  try {
    const storageDir = await getStorageDirCached()
    _$_documentEditorStorePath = nodeApi.path.join(storageDir, 'documentEditors.store.json')

    // Now that we have the path, call persist/load logic
    persistDocumentEditor()
    restoreLastWorkspaceState()
  } catch (err) {
    console.error('Failed to initialize store path:', err)
  }
}

// initializeStore();

// persistDocumentEditor()
const debouncedDiskWriteConfigFile = debounce((document: DocumentModel) => {
  document.writeConfigurationFileContent()
}, 400)

export const _$_documentEditorsList = {
  subscribe: documentEditorStore.subscribe,
  set: setDocumentEditors,
  update: updateDocumentEditors,
  /* register(id: string, documentEditor: DocumentEditorModel): void {
    updateDocumentEditors((list) => {
      const existing = list.find((e) => e.id === id)
      if (existing) {
        return list.map((e) => (e.id === id ? { id, documentEditor } : e))
      }
      return [...list, { id, documentEditor }]
    })
  }, */
  add(document: DocumentModel, openMode: any = DocumentModel.OpenMode.WRITE): void {
    const editor = new DocumentEditorModel({
      document,
      isActive: true
    })
    this.register(editor.uuid, editor)
  },

  register(id: string, documentEditor: DocumentEditorModel): void {
    const targetId = resolveEditorIdentity(documentEditor) || normalizeEditorId(id)
    const normalizedEditor = new DocumentEditorModel({
      ...documentEditor,
      id: targetId || documentEditor.id,
      uuid: documentEditor.uuid || documentEditor.document?.uuid || targetId
    })
    const normalizedDocument = normalizedEditor.document
      ? new DocumentModel({
          ...normalizedEditor.document,
          config: normalizedEditor.document.config
        })
      : null
    const hydratedEditor = normalizedDocument
      ? new DocumentEditorModel({
          ...normalizedEditor,
          document: normalizedDocument
        })
      : normalizedEditor

    updateDocumentEditors((list) => {
      const insertOrReplace = (items: DocumentEditorModel[]) => {
        return items.map((e) => {
          if (
            matchesEditorIdentity(e, hydratedEditor.uuid) ||
            matchesEditorIdentity(e, hydratedEditor.id)
          ) {
            return hydratedEditor
          }
          return e
        })
      }

      let updatedList: DocumentEditorModel[] = []

      // Try matching by internal UID first
      const existingByUid = list.find((e) => matchesEditorIdentity(e, hydratedEditor.uuid))
      if (existingByUid) {
        updatedList = insertOrReplace(list)
      } else if (
        hydratedEditor.id &&
        list.find((e) => matchesEditorIdentity(e, hydratedEditor.id))
      ) {
        // Otherwise try matching by ID (legacy behavior)
        updatedList = insertOrReplace(list)
      } else {
        updatedList = [...list, hydratedEditor]
      }

      // ── STRICT MUTUAL EXCLUSIVITY GUARD ──
      // Enforce that only one document editor is active across the entire collection.
      let hasSeenActive = false

      return updatedList.map((e) => {
        const isTarget =
          matchesEditorIdentity(e, hydratedEditor.uuid) ||
          (hydratedEditor.id && matchesEditorIdentity(e, hydratedEditor.id))

        if (hydratedEditor.isActive === true) {
          // If the incoming/modified editor is explicitly active, turn off every other editor
          if (isTarget) {
            hasSeenActive = true
            return e
          }
          return e.isActive ? new DocumentEditorModel({ ...e, isActive: false }) : e
        } else {
          // If the incoming editor is inactive, ensure we only preserve the first active tab we find
          if (e.isActive) {
            if (!hasSeenActive) {
              hasSeenActive = true
              return e
            }
            return new DocumentEditorModel({ ...e, isActive: false })
          }
          return e
        }
      })
    })
  },

  /* registerOLD(id: string, documentEditor: DocumentEditorModel): void {
    const targetId = resolveEditorIdentity(documentEditor) || normalizeEditorId(id)
    const normalizedEditor = new DocumentEditorModel({
      ...documentEditor,
      id: targetId || documentEditor.id,
      uuid: documentEditor.uuid || documentEditor.document?.uuid || targetId
    })
    const normalizedDocument = normalizedEditor.document
      ? new DocumentModel({
          ...normalizedEditor.document,
          config: normalizedEditor.document.config
        })
      : null
    const hydratedEditor = normalizedDocument
      ? new DocumentEditorModel({
          ...normalizedEditor,
          document: normalizedDocument
        })
      : normalizedEditor
    updateDocumentEditors((list) => {
      const insertOrReplace = (items: DocumentEditorModel[]) => {
        const hasActive = hydratedEditor.isActive === true
        return items.map((e) => {
          if (matchesEditorIdentity(e, hydratedEditor.uuid) || matchesEditorIdentity(e, hydratedEditor.id)) {
            return hydratedEditor
          }
          if (hasActive && e.isActive) {
            return new DocumentEditorModel({ ...e, isActive: false })
          }
          return e
        })
      }

      // Try matching by internal UID first
      const existingByUid = list.find((e) => matchesEditorIdentity(e, hydratedEditor.uuid))
      if (existingByUid) {
        return insertOrReplace(list)
      }

      // Otherwise try matching by ID (legacy behavior)
      if (hydratedEditor.id) {
        const existing = list.find((e) => matchesEditorIdentity(e, hydratedEditor.id))
        if (existing) {
          return insertOrReplace(list)
        }
      }

      const result = [...list, hydratedEditor]
      if (hydratedEditor.isActive === true) {
        return result.map((e) =>
          e === hydratedEditor ? e : e.isActive ? new DocumentEditorModel({ ...e, isActive: false }) : e
        )
      }
      return result
    })
  }, */
  /* unregister(id: string): void {
    updateDocumentEditors((list) => list.filter((e) => e?.id?.toString() !== id?.toString()))
  }, */
  unregister(idOrUid: string): void {
    updateDocumentEditors((list) => list.filter((e) => !matchesEditorIdentity(e, idOrUid)))
    removeEditorFromHistory(idOrUid)
  },
  closeTab(idOrUid: string): void {
    const listSnapshot = get(documentEditorStore)
    const targetIndex = listSnapshot.findIndex((editor) => matchesEditorIdentity(editor, idOrUid))
    if (targetIndex < 0) return

    const targetEditor = listSnapshot[targetIndex]
    const targetIdentity = resolveEditorIdentity(targetEditor)
    const wasActive = Boolean(targetEditor?.isActive)
    const shareIdsToClear = collectShareCacheIds([targetEditor])

    const remaining = listSnapshot.filter((editor) => !matchesEditorIdentity(editor, idOrUid))
    setDocumentEditors(remaining)

    removeEditorFromHistory(targetIdentity)
    for (const shareId of shareIdsToClear) {
      clearShareCache(shareId)
    }

    if (!wasActive) {
      if (remaining.length === 0) {
        _$_currentView.set('home')
        _$_lastActiveEditorId.set(null)
        _$_lastActiveTranslationPath.set(null)
      }
      return
    }

    const previousVisited = findPreviousVisitedEditor(remaining)
    if (previousVisited) {
      this.setActive(resolveEditorIdentity(previousVisited))
      return
    }

    if (remaining.length === 0) {
      _$_currentView.set('home')
      _$_lastActiveEditorId.set(null)
      _$_lastActiveTranslationPath.set(null)
      _$_wysiwygEditorsList.unsetActive()
      return
    }

    const fallbackIndex = Math.min(targetIndex, remaining.length - 1)
    const fallback = remaining[fallbackIndex]
    if (fallback) {
      this.setActive(resolveEditorIdentity(fallback))
    } else {
      _$_currentView.set('home')
      _$_lastActiveEditorId.set(null)
      _$_lastActiveTranslationPath.set(null)
      _$_wysiwygEditorsList.unsetActive()
    }
  },
  closeOthers(idOrUid: string): void {
    const listSnapshot = get(documentEditorStore)
    const target = listSnapshot.find((editor) => matchesEditorIdentity(editor, idOrUid))
    if (!target) return

    const targetIdentity = resolveEditorIdentity(target)
    const shareIdsToClear = collectShareCacheIds(
      listSnapshot.filter((editor) => !matchesEditorIdentity(editor, idOrUid))
    )
    const updated = [
      new DocumentEditorModel({
        ...target,
        isActive: true
      })
    ]

    setDocumentEditors(updated)
    clearEditorHistory()
    recordEditorVisit(targetIdentity)
    _$_lastActiveEditorId.set(targetIdentity)
    _$_lastActiveTranslationPath.set(null)
    _$_currentView.set('editor')
    if (targetIdentity) {
      _$_wysiwygEditorsList.setActive(targetIdentity, false)
    }
    for (const shareId of shareIdsToClear) {
      clearShareCache(shareId)
    }
  },
  closeRight(idOrUid: string): void {
    const listSnapshot = get(documentEditorStore)
    const targetIndex = listSnapshot.findIndex((editor) => matchesEditorIdentity(editor, idOrUid))
    if (targetIndex < 0) return

    const target = listSnapshot[targetIndex]
    const targetIdentity = resolveEditorIdentity(target)
    const activeIndex = listSnapshot.findIndex((editor) => editor.isActive)

    const nextActiveIndex =
      activeIndex === -1 || activeIndex > targetIndex ? targetIndex : activeIndex

    const kept = listSnapshot.slice(0, targetIndex + 1)
    const removed = listSnapshot.slice(targetIndex + 1)
    const shareIdsToClear = collectShareCacheIds(removed)
    const updated = kept.map(
      (editor, index) =>
        new DocumentEditorModel({
          ...editor,
          isActive: index === nextActiveIndex
        })
    )

    setDocumentEditors(updated)

    const keptIds = new Set(kept.map((editor) => resolveEditorIdentity(editor)))
    for (let i = recentEditorHistory.length - 1; i >= 0; i -= 1) {
      if (!keptIds.has(recentEditorHistory[i])) {
        recentEditorHistory.splice(i, 1)
      }
    }

    _$_lastActiveEditorId.set(resolveEditorIdentity(updated[nextActiveIndex] || target))
    recordEditorVisit(resolveEditorIdentity(updated[nextActiveIndex] || target))
    _$_currentView.set('editor')
    const nextIdentity = resolveEditorIdentity(updated[nextActiveIndex] || target)
    if (nextIdentity) {
      _$_wysiwygEditorsList.setActive(nextIdentity, false)
    }
    for (const shareId of shareIdsToClear) {
      clearShareCache(shareId)
    }
  },
  reorderByIds(ids: Array<string | number>): void {
    const normalized = ids.map((id) => normalizeEditorId(id)).filter(Boolean)
    if (!normalized.length) return
    const orderMap = new Map<string, number>()
    normalized.forEach((id, idx) => orderMap.set(id, idx))
    const listSnapshot = get(documentEditorStore)
    const withOrder = listSnapshot.map((editor, idx) => {
      const identity = resolveEditorIdentity(editor)
      const order = identity ? orderMap.get(normalizeEditorId(identity)) : undefined
      return { editor, order: order ?? normalized.length + idx }
    })
    withOrder.sort((a, b) => a.order - b.order)
    setDocumentEditors(withOrder.map((entry) => entry.editor))
  },
  closeAll(): void {
    setDocumentEditors([])
    clearEditorHistory()
    _$_lastActiveEditorId.set(null)
    _$_lastActiveTranslationPath.set(null)
    _$_currentView.set('home')
    _$_wysiwygEditorsList.unsetActive()
    clearAllShareCaches()
  },
  get2(id: string): DocumentEditorModel | undefined {
    let documentEditor: DocumentEditorModel | undefined
    const unsubscribe = documentEditorStore.subscribe((list) => {
      documentEditor = list.find((e) => matchesEditorIdentity(e, id))
    })
    // unsubscribe() // just a one-time read
    return documentEditor
  },

  get(id: string): Readable<DocumentEditorModel | undefined> {
    return derived(documentEditorStore, (list) => list.find((e) => matchesEditorIdentity(e, id)))
  },
  getItem(id: string): DocumentEditorModel | undefined {
    const list = get(documentEditorStore)
    return list.find((e) => matchesEditorIdentity(e, id))
  },
  getList(): DocumentEditorModel[] {
    return get(documentEditorStore)
  },
  getItemsSync(): DocumentEditorModel[] {
    return get(documentEditorStore)
  },
  /* getActive(): DocumentEditorModel | undefined {
    let documentEditor: DocumentEditorModel | undefined
    const unsubscribe = documentEditorStore.subscribe((list) => {
      documentEditor = list.find((e) => e.isActive === true)
    })
    unsubscribe() // just a one-time read
    return documentEditor
  } */

  getActiveSync(): DocumentEditorModel | undefined {
    // return get(documentEditorStore.getActive())
    const list = get(documentEditorStore)
    // console.log('list',list, list.find((e) => e.isActive))
    return list.find((e) => e.isActive)
  },

  // returns a derived store
  getActive: () => derived(documentEditorStore, (list) => list.find((e) => e.isActive)),
  // setActive: (indexOrId: string | number) => allowedGetters.active = false then e of if number index == indexOrId eelse if string id == indexOrId  or  .isActive = true
  /** 🪄 Sets an editor active by index or id, deactivates others */
  /* setActive(indexOrId: string | number): void {
    updateDocumentEditors((list) =>
      list.map((e, idx) => {
        const shouldActivate =
          typeof indexOrId === 'number' ? idx === indexOrId : e.id === indexOrId
        return { ...e, isActive: shouldActivate }
      })
    )
  }, */

  /** 🔄 Clears active editor */
  /* clearActive(): void {
    updateDocumentEditors((list) =>
      list.map((e) => ({ ...e, isActive: false }))
    )
  } */

  /** 🪄 Sets an editor active by index or id, deactivates others */
  setActiveLastWorking(indexOrId: string | number): void {
    updateDocumentEditors((list) =>
      list.map((e, idx) => {
        const shouldActivate =
          typeof indexOrId === 'number' ? idx === indexOrId : matchesEditorIdentity(e, indexOrId)
        // create a new instance to keep type consistency
        return new DocumentEditorModel({ ...e, isActive: shouldActivate })
      })
    )

    const target =
      typeof indexOrId === 'number'
        ? get(documentEditorStore)[indexOrId]
        : get(documentEditorStore).find((editor) => matchesEditorIdentity(editor, indexOrId))
    if (target) {
      const targetIdentity = resolveEditorIdentity(target)
      if (targetIdentity) {
        _$_wysiwygEditorsList.setActive(targetIdentity, false)
      }
      _$_lastActiveEditorId.set(targetIdentity)
      recordEditorVisit(targetIdentity)
      _$_currentView.set('editor')
    }
  },

  // Inside _$_documentEditorsList
  setActive(indexOrId: string | number): void {
    const listSnapshot = get(documentEditorStore)
    const targetEditor =
      typeof indexOrId === 'number'
        ? listSnapshot[indexOrId]
        : listSnapshot.find((editor) => matchesEditorIdentity(editor, indexOrId))
    if (targetEditor) {
      const targetIdentity = resolveEditorIdentity(targetEditor)
      if (targetIdentity) {
        _$_wysiwygEditorsList.setActive(targetIdentity, false)
      }
      _$_lastActiveEditorId.set(targetIdentity)
      recordEditorVisit(targetIdentity)
      _$_currentView.set('editor')
    }

    updateDocumentEditors((list) => {
      // Check if we even need to update (prevents reactive trigger loops)
      const needsUpdate = list.some((e, idx) => {
        const target =
          typeof indexOrId === 'number' ? idx === indexOrId : matchesEditorIdentity(e, indexOrId)
        return e.isActive !== target
      })

      if (!needsUpdate) return list

      return list.map((e, idx) => {
        const shouldActivate =
          typeof indexOrId === 'number' ? idx === indexOrId : matchesEditorIdentity(e, indexOrId)
        // Only create new instance if the state is actually changing
        if (e.isActive === shouldActivate) return e
        return new DocumentEditorModel({ ...e, isActive: shouldActivate })
      })
    })
  },

  /*  unsetActive(
     indexOrId?: string | number,
   ): void {
     // Update WYSIWYG store
     updateDocumentEditors((list) =>
       list.map((item, idx) => {
         // If indexOrId is provided, only unset that one; otherwise unset all
         const shouldUnset =
           indexOrId === undefined
             ? item.isActive
             : typeof indexOrId === 'number'
               ? idx === indexOrId
               : item.id?.toString() === indexOrId.toString();
 
         return shouldUnset ? new DocumentEditorModel({ ...item, isActive: false }) : item;
       })
     );
   },
 
   /** 🔄 Clears active editor +/
   clearActive(): void {
     updateDocumentEditors((list) =>
       list.map((e) => new DocumentEditorModel({ ...e, isActive: false }))
     )
   }, */

  /** 🔄 Clears active editor AND its active translations */
  clearActive(): void {
    _$_wysiwygEditorsList.unsetActive()
    updateDocumentEditors((list) =>
      list.map((e) => {
        // 1. Deactivate all translations inside this editor
        const cleanedTranslations = e.document.documentMainFileTranslations.map(
          (t) => new DocumentTranslation({ ...t, isActive: false })
        )

        // 2. Return new editor instance deactivated
        const newEditor = new DocumentEditorModel({ ...e, isActive: false })
        newEditor.document.documentMainFileTranslations = cleanedTranslations
        return newEditor
      })
    )
  },

  /** 🪄 Unsets a specific editor or translation active state */
  unsetActive(indexOrId?: string | number): void {
    if (indexOrId !== undefined) {
      const listSnapshot = get(documentEditorStore)
      const target =
        typeof indexOrId === 'number'
          ? listSnapshot[indexOrId]
          : listSnapshot.find((editor) => matchesEditorIdentity(editor, indexOrId))
      const targetIdentity = resolveEditorIdentity(target) || normalizeEditorId(indexOrId)
      if (targetIdentity) {
        _$_wysiwygEditorsList.unsetActive(targetIdentity, false)
      }
    } else {
      _$_wysiwygEditorsList.unsetActive()
    }
    updateDocumentEditors((list) =>
      list.map((item, idx) => {
        const shouldUnset =
          indexOrId === undefined
            ? item.isActive
            : typeof indexOrId === 'number'
              ? idx === indexOrId
              : matchesEditorIdentity(item, indexOrId)

        if (shouldUnset) {
          // Deep unset: deactivate editor and all its translations
          const deactivatedTranslations = item.document.documentMainFileTranslations.map(
            (t) => new DocumentTranslation({ ...t, isActive: false })
          )

          const updatedEditor = new DocumentEditorModel({ ...item, isActive: false })
          updatedEditor.document.documentMainFileTranslations = deactivatedTranslations
          return updatedEditor
        }
        return item
      })
    )
  },

  async findOrOpenTranslation(
    editorId: string,
    langCode: string,
    sourceFilePath: string,
    content: string
  ): Promise<void> {
    let createdPath: string | null = null
    const targetEditor = this.getItemsSync().find((editor) =>
      matchesEditorIdentity(editor, editorId)
    )
    if (!targetEditor) return

    const existing = targetEditor.document.documentMainFileTranslations.find(
      (t) => t.language === langCode
    )
    if (existing) {
      createdPath = existing.path
    } else {
      createdPath = await targetEditor.document.createTranslationFile(
        sourceFilePath,
        langCode,
        content
      )
      if (createdPath) {
        this.update((list) =>
          list.map((editor) =>
            matchesEditorIdentity(editor, editorId)
              ? new DocumentEditorModel({ ...editor })
              : editor
          )
        )
      }
    }

    // 4. After the store update, set the new/existing translation as active
    if (createdPath) {
      this.setActiveTranslation(editorId, createdPath)
    }
  },

  async deleteTranslation1(editorId: string, filePath: string): Promise<void> {
    if (!filePath) return
    const targetEditor = this.getItemsSync().find((editor) =>
      matchesEditorIdentity(editor, editorId)
    )
    if (!targetEditor) return
    const success = await targetEditor.document.deleteTranslationFile(filePath)
    if (!success) return

    this.update((list) => {
      return list.map((editor) => {
        if (!matchesEditorIdentity(editor, editorId)) return editor

        // 1. Check if the file being deleted is the currently active one
        const isActive = editor.activeTranslationPath === filePath

        // 2. Perform the physical deletion and internal list update
        // This calls the method we created in the previous step
        // 3. Clear active state if necessary
        if (isActive) {
          editor.activeTranslationPath = null
          editor.activeTranslation = null
          // Optionally clear the editor content here if needed
          // editor.content = '';
        }
        // editor.

        // 4. Return new instance to trigger Svelte $store reactivity
        return new DocumentEditorModel({ ...editor })
      })
    })
  },

  async deleteTranslation(editorId: string, filePath: string): Promise<void> {
    if (!filePath) return
    const targetEditor = this.getItemsSync().find((editor) =>
      matchesEditorIdentity(editor, editorId)
    )
    if (!targetEditor) return
    const success = await targetEditor.document.deleteTranslationFile(filePath)
    if (!success) return

    this.update((list) => {
      return list.map((editor) => {
        if (!matchesEditorIdentity(editor, editorId)) return editor

        const isActive = editor.activeTranslationPath === filePath

        // 2. FORCE RE-REFERENCE (The "Adobe Precision" fix)
        // We create a new DocumentModel so Svelte 5 sees the reference change.
        // We spread the current document and manually pass the updated array.
        const updatedDocument = new DocumentModel({
          ...editor.document,
          // Using [...array] ensures a new memory address for the list
          documentMainFileTranslations: [...editor.document.documentMainFileTranslations]
        })

        // 3. Construct the NEW Editor Model with the NEW Document
        return new DocumentEditorModel({
          ...editor,
          document: updatedDocument,
          activeTranslationPath: isActive ? null : editor.activeTranslationPath,
          activeTranslation: isActive ? null : editor.activeTranslation
        })
      })
    })
  },
  /** 🌐 Returns a derived store of the currently active translation */
  getActiveTranslation: () =>
    derived(documentEditorStore, (list) => {
      // 1. Find the editor that is currently active
      const activeEditor = list.find((e) => e.isActive)
      if (!activeEditor) return undefined

      // 2. Find the active translation within that editor
      return activeEditor.document.documentMainFileTranslations.find((t) => t.isActive)
    }),

  /** ⚡ Synchronous version to get the active translation at a specific moment */
  getActiveTranslationSync(): DocumentTranslation | undefined {
    const activeEditor = this.getActiveSync()
    if (!activeEditor) return undefined

    return activeEditor.document.documentMainFileTranslations.find((t) => t.isActive)
  },

  /** 🌐 Specifically unset only a translation while keeping the editor model */
  unsetTranslation(editorId: string, translationPath: string): void {
    updateDocumentEditors((list) =>
      list.map((editor) => {
        if (!matchesEditorIdentity(editor, editorId)) return editor

        const updatedTranslations = editor.document.documentMainFileTranslations.map((t) => {
          if (t.path === translationPath) {
            return new DocumentTranslation({ ...t, isActive: false })
          }
          return t
        })

        const updatedEditor = new DocumentEditorModel({ ...editor })
        updatedEditor.document.documentMainFileTranslations = updatedTranslations
        return updatedEditor
      })
    )
  },

  /** 🌐 Sets a specific translation active within an editor */
  setActiveTranslation(editorId: string, translationPath: string): void {
    if (translationPath) {
      _$_lastActiveTranslationPath.set(translationPath)
      _$_currentView.set('editor')
    }

    updateDocumentEditors((list) =>
      list.map((editor) => {
        // 1. Only process the targeted editor
        if (!matchesEditorIdentity(editor, editorId)) return editor

        // 2. Clone the editor and update its translations
        const updatedTranslations = editor.document.documentMainFileTranslations.map((t) => {
          // Activate if path matches, otherwise deactivate
          return new DocumentTranslation({
            ...t,
            isActive: t.path === translationPath
          })
        })

        // 3. Return new Model instance with updated translations
        const updatedEditor = new DocumentEditorModel({
          ...editor
          // isActive: true // Usually setting a translation active means the editor is active
        })
        updatedEditor.document.documentMainFileTranslations = updatedTranslations

        return updatedEditor
      })
    )
  },
  /** 🌐 Deactivates all translations for a specific editor */
  clearTranslation(editorId: string | number): void {
    updateDocumentEditors((list) =>
      list.map((editor) => {
        // 1. Only target the specific editor
        if (!matchesEditorIdentity(editor, editorId)) return editor

        // 2. Map through all translations and force isActive to false
        const clearedTranslations = editor.document.documentMainFileTranslations.map(
          (t) => new DocumentTranslation({ ...t, isActive: false })
        )

        // 3. Clone the editor model with the updated translation list
        const updatedEditor = new DocumentEditorModel({
          ...editor
          // Optional: decide if clearing translation should also unset the editor itself
          // isActive: false
        })

        updatedEditor.document.documentMainFileTranslations = clearedTranslations

        return updatedEditor
      })
    )
  },

  /** 🔗 Associates a meeting room ID with a specific editor's document */
  addMeetingLink(editorId: string | number, roomId: string): void {
    updateDocumentEditors((list) =>
      list.map((e) => {
        if (!matchesEditorIdentity(e, editorId)) return e

        // 1. Create the new meeting links array
        const updatedLinks = Array.from(new Set([...e.document.associatedMeetingLinks, roomId]))

        // 2. IMPORTANT: Instantiate a new DocumentModel to keep class methods
        const updatedDocument = new DocumentModel({
          ...e.document,
          associatedMeetingLinks: updatedLinks
        })

        // 3. Instantiate the parent DocumentEditorModel
        return new DocumentEditorModel({
          ...e,
          document: updatedDocument
        })
      })
    )
  },

  /** ⚙️ Updates document config (like restrictionRules) and triggers a deep reactive refresh */
  updateDocumentConfig(editorId: string, updateFn: (doc: DocumentModel) => void): void {
    updateDocumentEditors((list) => {
      return list.map((editor) => {
        if (!matchesEditorIdentity(editor, editorId)) return editor

        // 1. Run the update logic on the existing document
        updateFn(editor.document)

        // 2. Persist to file system (Internal dynadoc logic)
        editor.document.writeConfigurationFileContent()
        // 2. DEBOUNCED DISK PERSISTENCE
        // Lodash handles the timer and ensures only 1 write happens after user stops
        // debouncedDiskWriteConfigFile(editor.document);
        // 3. CLONE EVERYTHING to trigger Svelte 5 / Svelte 4 reactivity
        // We create a new DocumentModel and then a new EditorModel
        const updatedDocument = new DocumentModel({ ...editor.document })

        return new DocumentEditorModel({
          ...editor,
          document: updatedDocument
        })
      })
    })
  }

  /* updateDocumentConfig(documentUuid: string, updateFn: (doc: DocumentModel) => void): void {
    this.update((list) => {
      return list.map((editor) => {
        if (editor.document.uuid !== documentUuid) return editor;
  
        // Run the update logic (e.g., setting the rules)
        updateFn(editor.document);
  
        // Create new instances to trigger Svelte reactivity
        const updatedDocument = new DocumentModel({ ...editor.document });
        return new DocumentEditorModel({
          ...editor,
          document: updatedDocument
        });
      });
    });
  }, */
}

const scheduleActiveDocumentResolver = () => {
  DocumentModel.setActiveDocumentResolver(() => {
    const activeEditor = _$_documentEditorsList.getActiveSync?.()
    if (activeEditor) return activeEditor.document ?? null
    const activeStore = _$_documentEditorsList.getActive?.()
    return activeStore ? (get(activeStore)?.document ?? null) : null
  })
}

if (typeof queueMicrotask === 'function') {
  queueMicrotask(scheduleActiveDocumentResolver)
} else {
  setTimeout(scheduleActiveDocumentResolver, 0)
}

function persistDocumentEditor() {
  return attachEditorPersistence(_$_documentEditorStorePath, documentEditorStore)
}

function restoreLastWorkspaceState() {
  const list = get(documentEditorStore)
  if (!Array.isArray(list) || list.length === 0) {
    _$_currentView.set('home')
    return
  }

  const lastEditorId = get(_$_lastActiveEditorId)
  const lastTranslationPath = get(_$_lastActiveTranslationPath)

  let activeEditor: DocumentEditorModel | undefined

  if (lastEditorId) {
    activeEditor = list.find((editor) => matchesEditorIdentity(editor, lastEditorId))
    if (activeEditor) {
      _$_documentEditorsList.setActive(resolveEditorIdentity(activeEditor))
    }
  }

  if (!activeEditor) {
    activeEditor = list.find((editor) => editor.isActive)
  }

  if (activeEditor) {
    _$_currentView.set('editor')
    if (lastTranslationPath) {
      const translationExists = activeEditor.document?.documentMainFileTranslations?.some(
        (translation) => translation.path === lastTranslationPath
      )
      if (translationExists) {
        _$_documentEditorsList.setActiveTranslation(
          resolveEditorIdentity(activeEditor),
          lastTranslationPath
        )
      }
    }
  } else {
    _$_currentView.set('home')
  }
}

// ----------------------
// WYSIWYG Nodeview (Tiptap) Store
// ----------------------

/* export type WysiwygEditorNodeviewType =
  keyof typeof CustomSlideExtensionProps.name | keyof typeof CustomSpreadsheetExtensionProps.name

export type WysiwygEditorNodeviewEntry = {
  id: string
  type: WysiwygEditorNodeviewType,
  isActive: boolean
}

const wysiwygEditorNodeviewStore = writable<WysiwygEditorEntry[]>([])

export const _$_wysiwygEditorEditorNodeviewsList = {
  subscribe: wysiwygStore.subscribe,
  set: wysiwygStore.set,
  update: wysiwygStore.update,
  register(id: string, editor: TiptapEditor, filePath: string = '',
    editorHTMLElement: HTMLElement = null,
    editorHTMLContainer: HTMLElement = null,
    editorHTMLContainerRoot: HTMLElement = null,
    isActive: boolean = false): void {
    id = id?.toString()
    wysiwygStore.update((list) => {
      const existing = list.find((e) => e?.id?.toString() === id?.toString())
      // replace if ID already exists, else add
      if (existing) {
        // return list.map((e) => (e.id === id ? { id, editor } : e))
        return list.map((e) => (e?.id?.toString() === id?.toString() ? {
          id, editor, filePath, editorHTMLElement,
          editorHTMLContainer,
          editorHTMLContainerRoot, isActive
        } : e))
      }
      return [...list, {
        id, editor, filePath, editorHTMLElement,
        editorHTMLContainer,
        editorHTMLContainerRoot, isActive
      }]
    })
  },
  unregister(id: string): void {
    // wysiwygStore.update((list) => list.filter((e) => e.id !== id))
    wysiwygStore.update((list) => list.filter((e) => e?.id?.toString() !== id?.toString()))
  },
  getList(): WysiwygEditorEntry[] {
    return get(wysiwygStore)
  },
  get2(id: string): TiptapEditor | undefined {
    let editor: TiptapEditor | undefined
    const unsubscribe = wysiwygStore.subscribe((list) => {
      // editor = list.find((e) => e.id === id)?.editor
      editor = list.find((e) => e?.id?.toString() === id?.toString())?.editor
    })
    // unsubscribe() // just a one-time read
    return editor
  },
  get(id: string): Readable<TiptapEditor | undefined> {
    // get2(id: string): TiptapEditor | undefined {
    // const list = get(wysiwygStore)
    // return list.find((e) => e?.id?.toString() === id?.toString())?.editor

    return derived(wysiwygStore, (list) => list.find((e) => e?.id?.toString() === id?.toString())?.editor)

  },
  getItem(id: string): TiptapEditor | undefined {
    // get2(id: string): TiptapEditor | undefined {
    const list = get(wysiwygStore)
    return list.find((e) => e?.id?.toString() === id?.toString())?.editor
  },

  getEntry(id: string): WysiwygEditorEntry | undefined {
    let entry: WysiwygEditorEntry | undefined
    const unsubscribe = wysiwygStore.subscribe((list) => {
      // editor = list.find((e) => e.id === id)?.editor
      entry = list.find((e) => e?.id?.toString() === id?.toString())
    })
    // unsubscribe() // just a one-time read
    return entry
  },
  /** 🔍 Get the currently active WYSIWYG editor based on the active document editor +/
  getActive2(): TiptapEditor | undefined {
    const activeDoc = _$_documentEditorsList.getActiveSync()
    // console.log('activeDoc ', activeDoc)
    if (!activeDoc) return undefined
    return _$_wysiwygEditorsList.getItem(resolveEditorIdentity(activeDoc))
    // return _$_wysiwygEditorsList.get(activeDoc.id || activeDoc.index.toString())
  },
  getActive: () => derived(wysiwygStore, (list) => list.find((e) => e.isActive)),
  // getActive: () => derived(documentEditorStore, (list) => list.find((e) => e.isActive)),

  /** 🔍 Get the currently active WYSIWYG editor based on the active document editor +/
  getActiveEntry(): WysiwygEditorEntry | undefined {
    // const activeDoc = get(_$_documentEditorsList.getActive())
    const activeDoc = _$_documentEditorsList.getActiveSync()
    // console.log('activeDoc ', activeDoc)
    if (!activeDoc) return undefined
    return _$_wysiwygEditorsList.getEntry(resolveEditorIdentity(activeDoc))
    // return _$_wysiwygEditorsList.getEntry(activeDoc.id || activeDoc.index.toString())
  },

  /** 🪄 Set active WYSIWYG editor by ID or index (propagates to document store too) +/
  setActive(indexOrId: string | number, setParentDocumentToo: boolean = false): void {
    wysiwygStore.update((list) =>
      list.map((e, idx) => {
        const shouldActivate =
          typeof indexOrId === 'number' ? idx === indexOrId : e?.id?.toString() === indexOrId.toString()
        // create a new instance to keep type consistency
        return { ...e, isActive: shouldActivate }
      })
    )

    if (setParentDocumentToo) {
      _$_documentEditorsList.setActive(indexOrId)
    }
  },
  unsetActive(
    indexOrId?: string | number,
    setParentDocumentToo: boolean = false
  ): void {
    // Update WYSIWYG store
    wysiwygStore.update((list) =>
      list.map((item, idx) => {
        // If indexOrId is provided, only unset that one; otherwise unset all
        const shouldUnset =
          indexOrId === undefined
            ? item.isActive
            : typeof indexOrId === 'number'
              ? idx === indexOrId
              : item.id?.toString() === indexOrId.toString();

        return shouldUnset ? { ...item, isActive: false } : item;
      })
    );

    // Optionally update the parent document editor
    if (setParentDocumentToo) {
      if (indexOrId !== undefined) {
        _$_documentEditorsList.unsetActive(indexOrId);
      } else {
        // _$_documentEditorsList.unsetAll(); // you might want a method to unset all
      }
    }
  }

} */

// ----------------------
// Document translation Editors Store
// ----------------------

// const documentTranslationEditorStore = writable<DocumentTranslationEditorModel[]> = writable([])
/* const documentTranslationEditorStore = writable<DocumentTranslationEditorModel[]>([])

export const _$_documentTranslationEditorsList = {
  subscribe: documentTranslationEditorStore.subscribe,
  set: documentTranslationEditorStore.set,
  update: documentTranslationEditorStore.update,
  register(id: string, documentTranslationEditor: DocumentTranslationEditorModel): void {
    documentTranslationEditorStore.update((list) => {
      const existing = list.find((e) => e.id === id)
      if (existing) {
        return list.map((e) => (e.id === id ? { id, documentTranslationEditor } : e))
      }
      return [...list, { id, documentTranslationEditor }]
    })
  },
  unregister(id: string): void {
    documentTranslationEditorStore.update((list) => list.filter((e) => e.id !== id))
  },
  get(id: string): DocumentTranslationEditorModel | undefined {
    let documentTranslationEditor: DocumentTranslationEditorModel | undefined
    const unsubscribe = documentTranslationEditorStore.subscribe((list) => {
      documentTranslationEditor = list.find((e) => e.id === id)
    })
    unsubscribe() // just a one-time read
    return documentTranslationEditor
  },
  getList(): DocumentTranslationEditorModel[] {
    return get(documentTranslationEditorStore)
  },
  /* getActive(): DocumentTranslationEditorModel | undefined {
    let documentTranslationEditor: DocumentTranslationEditorModel | undefined
    const unsubscribe = documentTranslationEditorStore.subscribe((list) => {
      documentTranslationEditor = list.find((e) => e.isActive === true)
    })
    unsubscribe() // just a one-time read
    return documentTranslationEditor
  } +/

  // returns a derived store
  getActive: () => derived(documentTranslationEditorStore, (list) => list.find((e) => e.isActive))
} */

// ----------------------
// Document Store
// ----------------------

/* export type DocumentEntry = {
  id: string
  document: DocumentModel | null // Document can be null if not opened
}

const documentStore = writable<DocumentEntry[]>([])

export const _$_documentsList = {
  subscribe: documentStore.subscribe,
  set: documentStore.set,
  update: documentStore.update,
  register(id: string, document: DocumentModel): void {
    documentStore.update((list) => {
      const existing = list.find((e) => e.id === id)
      if (existing) {
        return list.map((e) => (e.id === id ? { id, document } : e))
      }
      return [...list, { id, document }]
    })
  },
  unregister(id: string): void {
    documentStore.update((list) => list.filter((e) => e.id !== id))
  },
  get(id: string): DocumentModel | undefined {
    let document: DocumentModel | undefined
    const unsubscribe = documentStore.subscribe((list) => {
      document = list.find((e) => e.id === id)?.document
    })
    unsubscribe() // just a one-time read
    return document
  }
} */
