// Important: For performance reasons, it's better to use a native JS approach
// rather than a Svelte component-based node view.

import { Node, mergeAttributes, type RawCommands } from '@tiptap/core'
// import { Node as pmNode } from '@tiptap/core';
// import { Schema, Node as pmNode } from 'prosemirror-model';

import { EditorState, Plugin, PluginKey } from '@tiptap/pm/state'
import { DynamicReferenceView } from './components/DynamicReferenceView'
import { DOMSerializer, Schema, Node as pmNode } from '@tiptap/pm/model'

import Suggestion, { exitSuggestion } from '@tiptap/suggestion'
import { computePosition, shift, flip, offset } from '@floating-ui/dom'
import { CustomDynamicReferenceNodeExtensionProps } from './utils/common.utils'
import { v4 as uuidv4 } from 'uuid'
import { mount, unmount } from 'svelte'
import { get } from 'svelte/store'
import DynamicReferenceDropdown from './components/DynamicReferenceDropdown.svelte'
import { GenericCustomExtensionProps } from '../utils/common.utils'
// import { ySyncPluginKey } from 'y-prosemirror';
import type { SuggestionItemsType } from './utils/utils'
// import type { StringMappingType } from 'typescript';
import { _$_wysiwygEditorDynamicReferenceIndexes } from './stores/common.store'
import { CustomVarExtensionProps } from '../CustomVarExtension/utils/common.utils'
import {
  CustomFileExtensionProps,
  CustomFolderExtensionProps
} from '../CustomFileFolderExtension/utils/common.utils'
import {
  getVariable,
  deleteVariable,
  cleanupSpreadsheetVariablesForPath,
  cleanupTableCellVariablesForSheet
} from '../CustomVarExtension/stores/variableManipulator'
import { getVariableDisplayValue } from '../CustomVarExtension/utils/variableDisplay.utils'
import { _$_wysiwygEditorsList } from '../../../stores/editor.store'

function posToDOMRect(view: any, from: number, to: number) {
  const start = view.coordsAtPos(from)
  const end = view.coordsAtPos(to)
  return {
    top: start.top,
    bottom: end.bottom,
    left: start.left,
    right: end.right,
    width: end.right - start.left,
    height: end.bottom - start.top
  }
}

async function getMenuPosition(editor, container, range) {
  if (!container || !range) return { x: 0, y: 0 }

  // Use the suggestion range (the '@' char) for the coordinates
  // This is more stable than editor.state.selection
  const virtualEl = {
    getBoundingClientRect: () => {
      const start = editor.view.coordsAtPos(range.from)
      const end = editor.view.coordsAtPos(range.to)
      return {
        top: start.top,
        bottom: end.bottom,
        left: start.left,
        right: end.right,
        width: end.right - start.left,
        height: end.bottom - start.top,
        x: start.left,
        y: start.top
      }
    }
  }

  const { x, y } = await computePosition(virtualEl, container, {
    placement: 'bottom-start',
    strategy: 'fixed', // Better for Electron and modals
    middleware: [
      offset(10), // Gap between cursor and menu
      flip({
        padding: 10,
        fallbackPlacements: ['top-start', 'bottom-end', 'top-end']
      }),
      shift({ padding: 15 })
    ]
  })

  return { x, y }
}

export const uuidIndexerKey = new PluginKey('uuidIndexer')
export const selectionChangeKey = new PluginKey('selectionChange')
export const nodeDeleteKey = new PluginKey('nodeDelete')
const worker = new Worker(new URL('./workers/search-worker.ts', import.meta.url))

// function isNodeFineForDynamicReference1(node: pmNode): boolean {
function isNodeFineForDynamicReference(
  node: pmNode,
  pos: number,
  selectionPos: number | null
): boolean {
  const typeName = node.type.name
  // 1. Check if it's a paragraph
  // const isParagraph = typeName === 'paragraph';
  const isRefNode = typeName === CustomDynamicReferenceNodeExtensionProps.name
  const isVarNode = typeName === CustomVarExtensionProps.name

  // If the selection (cursor) is currently inside this node, skip it.
  if (selectionPos !== null && pos <= selectionPos && pos + node.nodeSize >= selectionPos) {
    return false
  }

  // 2. Determine if it's empty
  // A node is empty if it has no children and no text content
  // const isEmpty = node.content.size === 0;
  // 2. Identify Paragraphs that contain ONLY a reference
  // We check if the paragraph has exactly one child and that child is a ref
  let containsOnlyRef = false
  if (typeName === 'paragraph') {
    let hasRef = false
    let hasRealContent = false
    node.forEach((child) => {
      if (child.type.name === CustomDynamicReferenceNodeExtensionProps.name) {
        hasRef = true
        return
      }
      if (child.isText) {
        if ((child.text || '').trim().length > 0) hasRealContent = true
        return
      }
      // Any non-text, non-ref child counts as real content
      hasRealContent = true
    })
    if (hasRef && !hasRealContent) {
      containsOnlyRef = true
    }
  }

  // 3. Skip Logic
  // - Don't index the <ref> itself
  // - Don't index a paragraph that just holds a <ref>
  // - Don't index empty paragraphs
  const isEmptyParagraph = typeName === 'paragraph' && node.content.size === 0

  // 3. Filtering Logic:
  // We skip if it's a paragraph AND it's empty.
  // We KEEP it if it's a custom tag (like 'design' or 'slide') even if content.size is 0.
  if (isRefNode || isVarNode || containsOnlyRef || isEmptyParagraph) {
    return false // Skip this node
  }
  return true
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function replaceVariableTokens(
  rawHtml: string,
  editorId: string
): { html: string; text: string; tokens: string[] } {
  const tokens = new Set<string>()
  if (!rawHtml || rawHtml.indexOf('{') === -1) {
    const div = document.createElement('div')
    div.innerHTML = rawHtml || ''
    return { html: rawHtml || '', text: div.textContent || '', tokens: [] }
  }

  const replacedHtml = rawHtml.replace(/\{([^}]+)\}/g, (full, id) => {
    const varId = String(id || '').trim()
    if (!varId) return full
    tokens.add(varId)
    const raw = getVariable(varId, editorId, false)
    const value = getVariable(varId, editorId, true)
    const display = getVariableDisplayValue({ value, rawValue: raw }, { plainText: true }) || varId
    return `<span class=\"variable-reference\" data-var-id=\"${escapeHtml(varId)}\">${escapeHtml(display)}</span>`
  })

  const div = document.createElement('div')
  div.innerHTML = replacedHtml
  return { html: replacedHtml, text: div.textContent || '', tokens: Array.from(tokens) }
}

function resolveReferenceId(node: pmNode, editorId: string): string | null {
  const attrs: any = node.attrs || {}
  const directId = attrs.uuid || attrs.id || attrs['data-uuid']
  if (directId) return String(directId)

  if (node.type.name === CustomVarExtensionProps.name) {
    const varId = attrs[CustomVarExtensionProps.tagAttributeName]
    if (varId) return String(varId)
  }

  if (
    node.type.name === CustomFileExtensionProps.name ||
    node.type.name === CustomFolderExtensionProps.name
  ) {
    const src = attrs[CustomFileExtensionProps.attributeSrc] || attrs.src
    if (src) return String(src)
  }

  if (attrs.nodeId) return String(attrs.nodeId)

  return null
}
function isNodeFineForDynamicReference1(
  node: pmNode,
  pos: number,
  selectionPos: number | null
): boolean {
  const typeName = node.type.name

  // --- NEW: SELF-REFERENCE PREVENTION ---
  // If the selection (cursor) is currently inside this node, skip it.
  if (selectionPos !== null && pos <= selectionPos && pos + node.nodeSize >= selectionPos) {
    return false
  }

  const isRefNode = typeName === CustomDynamicReferenceNodeExtensionProps.name

  // Identify Paragraphs that contain ONLY a reference
  let containsOnlyRef = false
  if (typeName === 'paragraph' && node.childCount === 1) {
    const firstChild = node.firstChild
    if (firstChild && firstChild.type.name === CustomDynamicReferenceNodeExtensionProps.name) {
      containsOnlyRef = true
    }
  }

  const isEmptyParagraph = typeName === 'paragraph' && node.content.size === 0

  // Filter out the node if it's a ref, a paragraph with only a ref, or empty
  if (isRefNode || containsOnlyRef || isEmptyParagraph) {
    return false
  }

  return true
}

/* function indexDocLastWorking(doc: pmNode, schema: Schema) {
  const index = new Map<string, string>();
  console.log("applyapply indexDoc node toJSON", { doc, schema }, doc.toJSON())
  // console.log("Full Doc Structure:", doc.toJSON());
  doc.descendants((node) => {
    // console.log("applyapply indexDoc node", { node }, node.type.name)

    if (!isNodeFineForDynamicReference(node)) return true
    const id = node.attrs.uuid || node.attrs.id || node.attrs['data-uuid'];


    if (id) index.set(id, serializeToHtml(node, schema));
    // 3. Return true to continue descending into children
    return true;
  });
  return index;
} */

function getItemData(id, node, schema, editorId: string): SuggestionItemsType {
  const typeName = node.type.name
  let html = serializeToHtml(node, schema)
  const rawHtml = html
  let plainText = node.textContent || ''
  let varTokens: string[] | undefined

  if (typeName === 'paragraph') {
    const resolved = replaceVariableTokens(html, editorId)
    html = resolved.html
    plainText = resolved.text || plainText
    if (resolved.tokens.length) varTokens = resolved.tokens
  }

  if (typeName === CustomVarExtensionProps.name) {
    const varId = node.attrs?.[CustomVarExtensionProps.tagAttributeName] || id
    const raw = getVariable(varId, editorId, false)
    const value = getVariable(varId, editorId, true)
    const display = getVariableDisplayValue({ value, rawValue: raw }, { plainText: true }) || varId
    html = `<span class=\"variable-reference\" data-var-id=\"${escapeHtml(String(varId))}\">${escapeHtml(display)}</span>`
    plainText = display
    varTokens = [String(varId)]
  }

  let src: string | undefined = undefined
  if (typeName === CustomFileExtensionProps.name || typeName === CustomFolderExtensionProps.name) {
    src = node.attrs?.[CustomFileExtensionProps.attributeSrc] || node.attrs?.src || id
    const label =
      (window as any)?.node?.path?.basename?.(src) ||
      String(src || '')
        .split(/[\\/]/)
        .pop() ||
      String(src || '')
    html = `<span class=\"file-reference\">${escapeHtml(label || String(src || ''))}</span>`
    plainText = label || String(src || '')
  }

  const searchSurface = `${typeName} ${plainText} ${id}`.toLowerCase()

  return {
    id,
    text: searchSurface,
    html,
    rawHtml,
    display: plainText.substring(0, 50),
    type: typeName,
    src,
    editorId,
    varTokens
  }
}

// function indexDoc(doc, schema, editorId: string): Map<any, SuggestionItemsType> {
function indexDoc(
  doc,
  schema,
  editorId: string,
  selectionPos: number | null
): Map<any, SuggestionItemsType> {
  const index = new Map<any, SuggestionItemsType>()
  const workerData: SuggestionItemsType[] = []

  // doc.descendants((node) => {
  doc.descendants((node, pos) => {
    // if (!isNodeFineForDynamicReference(node)) return true;
    if (!isNodeFineForDynamicReference(node, pos, selectionPos)) return true
    const id = resolveReferenceId(node, editorId)

    if (id) {
      const data = getItemData(id, node, schema, editorId)
      index.set(id, data)
      workerData.push(data)
    }
  })

  // Post with editorId so worker knows what is being updated
  worker.postMessage({
    type: 'UPDATE_INDEX',
    payload: workerData,
    editorId
  })

  return index
}

// Simple Event Hub for targeted updates
export const refEvents = new EventTarget()

const serializationCache = new WeakMap<any, string>()

const serializeToHtml = (node: any, schema: any) => {
  if (serializationCache.has(node)) return serializationCache.get(node)!

  const serializer = DOMSerializer.fromSchema(schema)
  const container = document.createElement('span')

  try {
    container.appendChild(serializer.serializeNode(node))
  } catch (err) {
    // Walk the children to find exactly which one is malformed
    node.forEach((child: pmNode, offset: number) => {
      try {
        serializer.serializeNode(child)
      } catch (childErr) {
        console.error(
          `[serializeToHtml] BAD NODE: type="${child.type.name}" attrs=`,
          child.attrs,
          'toDOM spec:',
          child.type.spec.toDOM?.(child)
        )
      }
    })
    return node.textContent || ''
  }

  const html = container.innerHTML
  serializationCache.set(node, html)
  return html
}

const serializeToHtmlOld = (node: any, schema: any) => {
  // If we've already serialized this EXACT node object, return the cached string.
  // ProseMirror is "Persistent" - unchanged nodes keep the same object reference!
  if (serializationCache.has(node)) {
    return serializationCache.get(node)!
  }

  const serializer = DOMSerializer.fromSchema(schema)
  const container = document.createElement('span')
  container.appendChild(serializer.serializeNode(node))

  const html = container.innerHTML
  serializationCache.set(node, html)
  return html
}

let idleId: any = null

// Extend the global Commands interface for TypeScript support
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dynamicReference: {
      /**
       * Finds a node by UUID, scrolls it into view, and gives it a visual pulse.
       */
      scrollToNode: (uuid: string) => ReturnType
      reindexUUIDs: () => ReturnType
    }
  }
}

const extensionName = CustomDynamicReferenceNodeExtensionProps.name
const extensionTagName = CustomDynamicReferenceNodeExtensionProps.tagName
const defaultOptions = {
  editorId: null
}
export const CustomDynamicReferenceNodeExtension = Node.create({
  name: extensionName,
  // name: 'dynamicReference',
  group: 'inline',
  // group: 'block',
  atom: true,
  inline: true,

  addAttributes() {
    return {
      [GenericCustomExtensionProps.tagAttributeId]: { default: '' },
      [CustomDynamicReferenceNodeExtensionProps.tagAttributeSrc]: {
        default: null,
        parseHTML: (el) =>
          el.getAttribute(CustomDynamicReferenceNodeExtensionProps.tagAttributeSrc),
        renderHTML: (attrs) => ({
          [CustomDynamicReferenceNodeExtensionProps.tagAttributeSrc]:
            attrs[CustomDynamicReferenceNodeExtensionProps.tagAttributeSrc]
        })
      }
    }
  },

  addOptions() {
    return defaultOptions
  },

  addProseMirrorPlugins() {
    const _editor = this.editor
    const _this = this
    let searchTimeout: any
    let lastRequestId = 0

    const suggestionCommand = ({ editor, range, props }) => {
      if (!props) return
      // editor
      //   .chain()
      //   .focus()
      //   .insertContentAt(range, { type: extensionName, attrs: { id: uuidv4(), prompt: props.value } })
      //   .run();
      console.log('sugges render suggestionCommand ', { editor, range, props })
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: this.name,
            attrs: {
              id: uuidv4(),
              [CustomDynamicReferenceNodeExtensionProps.tagAttributeSrc]: `#${props.id}`
            }
            // attrs: { src: `#${props.id}` },
          },
          { type: 'text', text: ' ' } // Add space after for better UX
        ])
        .run()
    }

    const UUIDIndexerPlugin = new Plugin({
      key: uuidIndexerKey,
      state: {
        init(_, { doc }) {
          return new Map<any, SuggestionItemsType>()
          // indexDoc(doc, doc.type.schema);
        },

        apply(tr, value, oldState, newState) {
          // Get the current cursor position
          const selectionPos = newState.selection.from
          // 1. Detection Logic
          const forceReindex = tr.getMeta('forceReindex')
          const isRemote = tr.getMeta('addToHistory') === false && !tr.getMeta('uiEvent')
          const isReset = tr.getMeta('rebase') || tr.steps.length > 50 || forceReindex

          // 2. Short-circuit if nothing happened
          if (!tr.docChanged && !forceReindex && !isRemote) return value

          let nextIndex: Map<any, SuggestionItemsType>

          // 3. FULL REINDEX PATH (Sync/Heavy Updates)
          if (isReset || isRemote) {
            // nextIndex = indexDoc(newState.doc, newState.schema, _this.options.editorId);
            nextIndex = indexDoc(
              newState.doc,
              newState.schema,
              _this.options.editorId,
              selectionPos
            )

            // Sync Global Store immediately for full resets
            _$_wysiwygEditorDynamicReferenceIndexes.update((currentMap) => {
              currentMap.set(_this.options.editorId, nextIndex)
              return currentMap
            })

            // Broadcast full changes
            nextIndex.forEach((data, id) => {
              if (value.get(id) !== data) {
                refEvents.dispatchEvent(new CustomEvent('update', { detail: data }))
              }
            })

            return nextIndex
          }

          // 4. INCREMENTAL PATH (Local Typing)
          // We use a clone of the old Map to modify it
          nextIndex = new Map(value)
          const affectedIds = new Set<string>()

          const currentIdsInDoc = new Set()
          newState.doc.descendants((node) => {
            const id = resolveReferenceId(node, _this.options.editorId)
            if (id) currentIdsInDoc.add(id)
          })

          // Check if any IDs in our index no longer exist in the doc
          nextIndex.forEach((_, id) => {
            if (!currentIdsInDoc.has(id)) {
              nextIndex.delete(id)
              affectedIds.add(id) // Trigger a refresh because something vanished
            }
          })

          // Cancel any pending deferred updates
          if (idleId) cancelIdleCallback(idleId)

          // We perform the scan logic but defer the "Heavy" Svelte Store & Broadcast sync
          /* tr.mapping.maps.forEach((stepMap) => {
            stepMap.forEach((os, oe, ns, ne) => {
              newState.doc.nodesBetween(
                Math.max(0, ns - 1),
                Math.min(newState.doc.content.size, ne + 1),
                (node) => {
                  if (!isNodeFineForDynamicReference(node)) return true;
                  const id = node.attrs.uuid || node.attrs.id || node.attrs['data-uuid'];

                  if (id) {
                    const data = getItemData(id, node, newState.schema);
                    if (JSON.stringify(nextIndex.get(id)) !== JSON.stringify(data)) {
                      nextIndex.set(id, data);
                      affectedIds.add(id);
                    }
                  }
                }
              );
            });
          }); */

          // Track IDs currently in doc to handle "Ghost" deletions
          const idsInDoc = new Set<string>()

          // Get the current cursor position
          // const selectionPos = newState.selection.from;

          // Process mapping to find what changed
          tr.mapping.maps.forEach((stepMap) => {
            stepMap.forEach((os, oe, ns, ne) => {
              newState.doc.nodesBetween(
                Math.max(0, ns - 1),
                Math.min(newState.doc.content.size, ne + 1),
                (node, pos) => {
                  const id = resolveReferenceId(node, _this.options.editorId)
                  if (!id) return true

                  idsInDoc.add(id)

                  // Check if node is still valid (e.g. not empty)
                  // if (isNodeFineForDynamicReference(node)) {
                  if (isNodeFineForDynamicReference(node, pos, selectionPos)) {
                    const data = getItemData(id, node, newState.schema, _this.options.editorId)

                    // Compare text or content directly to avoid JSON overhead where possible
                    const existing = nextIndex.get(id)
                    if (
                      !existing ||
                      existing.text !== data.text ||
                      JSON.stringify(existing) !== JSON.stringify(data)
                    ) {
                      nextIndex.set(id, data)
                      affectedIds.add(id)
                    }
                  } else {
                    // Node exists but is no longer "fine" (e.g. paragraph was emptied)
                    if (nextIndex.has(id)) {
                      nextIndex.delete(id)
                      affectedIds.add(id)
                    }
                  }
                  return true
                }
              )
            })
          })

          // Final Cleanup: Handle nodes completely deleted from the document
          // We only do this if we suspect a deletion happened
          if (tr.steps.some((step) => step.toJSON().stepType === 'replace')) {
            nextIndex.forEach((_, id) => {
              // Note: This is an optimization. For small docs, scanning is fine.
              // For large docs, you might rely solely on the nodesBetween logic above.
              if (!idsInDoc.has(id)) {
                // Perform a quick specific check if node still exists globally
                // if we didn't see it in nodesBetween
                let exists = false
                newState.doc.descendants((n) => {
                  const candidateId = resolveReferenceId(n, _this.options.editorId)
                  if (candidateId === id) {
                    exists = true
                    return false
                  }
                })
                if (!exists) {
                  nextIndex.delete(id)
                  affectedIds.add(id)
                }
              }
            })
          }

          // Schedule the broadcast and global sync so the main thread (typing) is instant
          /* idleId = requestIdleCallback(() => {
            if (affectedIds.size > 0) {
              // Update Global Svelte Store
              _$_wysiwygEditorDynamicReferenceIndexes.update(currentMap => {
                currentMap.set(this.op, nextIndex);
                return currentMap;
              });
          
              // Update Individual Mirrors
              affectedIds.forEach(id => {
                refEvents.dispatchEvent(new CustomEvent('update', {
                  detail: nextIndex.get(id)
                }));
              });
            }
          }, { timeout: 100 }); */

          if (affectedIds.size > 0) {
            // CRITICAL: Update the Global Svelte Store SYNCLY so the Worker gets the update
            _$_wysiwygEditorDynamicReferenceIndexes.update((currentMap) => {
              currentMap.set(_this.options.editorId, nextIndex)
              return currentMap
            })

            // CRITICAL: Manually trigger the worker update here too
            worker.postMessage({
              type: 'UPDATE_INDEX',
              payload: Array.from(nextIndex.values()),
              editorId: _this.options.editorId
            })

            // Broadcast to mirrors can stay deferred
            if (idleId) cancelIdleCallback(idleId)
            idleId = requestIdleCallback(() => {
              affectedIds.forEach((id) => {
                refEvents.dispatchEvent(new CustomEvent('update', { detail: nextIndex.get(id) }))
              })
            })
          }

          return nextIndex
        }
      }
    })

    let userTriggered = false
    const suggestionPluginKey = new PluginKey('dynamic-ref-suggestion')

    return [
      UUIDIndexerPlugin,

      Suggestion({
        editor: this.editor,
        // char: '#',
        char: CustomDynamicReferenceNodeExtensionProps.suggestion.char,
        allowSpaces: true,
        pluginKey: suggestionPluginKey,

        items: async ({ query }) => {
          // if (!query || query.length === 0) return []
          return new Promise((resolve) => {
            // Search the worker (which now searches globally across all editorIds)
            worker.postMessage({
              type: 'SEARCH',
              payload: { query, limit: 30, editorId: _this.options.editorId },
              requestId: ++lastRequestId
              // editorId: _this.options.editorId // PASS the current editorId to the worker
            })

            const handleMessage = (e) => {
              if (e.data.type === 'RESULTS') {
                worker.removeEventListener('message', handleMessage)
                resolve(e.data.results)
              }
            }
            worker.addEventListener('message', handleMessage)
          })
        },
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: this.name,
                attrs: {
                  [CustomDynamicReferenceNodeExtensionProps.tagAttributeSrc]: `#${props.id}`
                }
                // attrs: { src: `#${props.id}` },
              },
              { type: 'text', text: ' ' } // Add space after for better UX
            ])
            .run()
        },

        render: () => {
          let component: any
          let unsubscribe: () => void // To store the cleanup function
          // let svelteProps = $state({})
          // reactive state holder
          let svelteProps = $state({
            items: [],
            activeIndex: 0,
            query: '',
            position: null,
            selectItem: (item) => {}
          })
          let container: HTMLElement
          let items: any[] = []
          let activeIndex = 0
          let cleanupOutsideHandlers: (() => void) | null = null
          const editor = this.editor

          return {
            onStart: async (props) => {
              userTriggered = true
              console.log('sugges render onStart ', props)
              items = props.items
              activeIndex = 0

              container = document.createElement('span')
              // container = document.createElement('div')
              document.body.appendChild(container)
              const handlePointerDown = (event: Event) => {
                const target = event.target as Node | null
                if (!target) return
                if (container?.contains(target)) return
                if (editor?.view?.dom?.contains(target)) return
                exitSuggestion(editor.view, suggestionPluginKey)
              }
              const handleWindowBlur = () => exitSuggestion(editor.view, suggestionPluginKey)
              const handleVisibility = () => {
                if (document.visibilityState !== 'visible') {
                  exitSuggestion(editor.view, suggestionPluginKey)
                }
              }
              document.addEventListener('pointerdown', handlePointerDown, true)
              window.addEventListener('blur', handleWindowBlur)
              document.addEventListener('visibilitychange', handleVisibility)
              cleanupOutsideHandlers = () => {
                document.removeEventListener('pointerdown', handlePointerDown, true)
                window.removeEventListener('blur', handleWindowBlur)
                document.removeEventListener('visibilitychange', handleVisibility)
              }

              // 1. Subscribe to the global index store
              // This will trigger whenever ANY editor content changes
              unsubscribe = _$_wysiwygEditorDynamicReferenceIndexes.subscribe(() => {
                // When the index changes, re-trigger the search for the current query
                if (svelteProps.query !== undefined) {
                  worker.postMessage({
                    type: 'SEARCH',
                    payload: {
                      query: svelteProps.query,
                      limit: 30,
                      editorId: _this.options.editorId
                    },
                    requestId: ++lastRequestId
                  })
                }
              })
              // update reactive props
              svelteProps.items = items
              svelteProps.activeIndex = activeIndex
              svelteProps.query = props.query
              // svelteProps.position = await getMenuPosition(editor, container)
              // svelteProps.position = await getMenuPosition(editor, container)
              svelteProps.selectItem = (item) => {
                // console.log("sugges render suggestionCommand onstart  svelteProps.selectItem", { editor, range, props })

                suggestionCommand({ editor, range: props.range, props: item })
              }

              component = mount(DynamicReferenceDropdown, {
                target: container,
                props: svelteProps
              })

              // WAIT for Svelte to paint, then calculate position
              requestAnimationFrame(async () => {
                const pos = await getMenuPosition(editor, container.firstElementChild, props.range)
                svelteProps.position = pos
              })
            },

            onUpdate: async (props) => {
              console.log('sugges render onUpdate ', props)

              items = props.items
              activeIndex = Math.min(activeIndex, items.length - 1)
              // component.$set({

              // Update component props reactively
              // update reactive props
              svelteProps.items = items
              svelteProps.activeIndex = activeIndex
              svelteProps.query = props.query
              // svelteProps.position = await getMenuPosition(editor, container)
              svelteProps.selectItem = (item) => {
                // console.log("sugges render onKeyDown ", props)
                // console.log("sugges render suggestionCommand update  svelteProps.selectItem", { editor, range, props })

                suggestionCommand({ editor, range: props.range, props: item })
              }
              // component.$set(svelteProps)
              // )
              // Recalculate on every keystroke/update
              const pos = await getMenuPosition(editor, container.firstElementChild, props.range)
              svelteProps.position = pos
            },

            onKeyDown: (props) => {
              console.log('sugges render onKeyDown ', props)

              if (props.event.key === 'ArrowDown') {
                activeIndex = (activeIndex + 1) % items.length
                // component.$set({ activeIndex })
                svelteProps.activeIndex = activeIndex
                return true
              }
              if (props.event.key === 'ArrowUp') {
                activeIndex = (activeIndex - 1 + items.length) % items.length
                // component.$set({ activeIndex })
                svelteProps.activeIndex = activeIndex
                return true
              }
              if (props.event.key === 'Enter') {
                const item = items[activeIndex]
                suggestionCommand({ editor, range: props.range, props: item })
                return true
              }
              return false
            },

            onExit: () => {
              // 2. CRITICAL: Cleanup the store subscription
              if (unsubscribe) unsubscribe()
              // component?.$destroy()
              if (component) unmount(component)
              container?.remove()
              cleanupOutsideHandlers?.()
              cleanupOutsideHandlers = null
              userTriggered = false
            }
          }
        }
        /* shouldShow: ({ query, transaction }) => {
          if (!query || query.length === 0) return false
          if (userTriggered) return true
          return transaction?.docChanged === true
        }, */
      }),

      // ENHANCED: Selection Change Plugin with Document Re-indexing
      // Detects when user clicks away and triggers full reindex to capture newly created nodes
      new Plugin({
        key: selectionChangeKey,
        state: {
          init() {
            return { prevSelection: null, lastValidationTime: 0, lastIndexTime: 0 }
          },
          apply(tr, value) {
            const newSelection = tr.selection
            const now = performance.now()
            const shouldValidate =
              !value.prevSelection ||
              value.prevSelection.from !== newSelection.from ||
              value.prevSelection.to !== newSelection.to

            if (shouldValidate && now - value.lastValidationTime > 50) {
              // ENHANCED: Force re-index to capture newly created nodes
              // This is crucial for Task 1 fix - ensures new paragraphs/tables are indexed
              if (tr.docChanged || now - value.lastIndexTime > 200) {
                // Perform full reindex
                const newIndex = indexDoc(
                  tr.doc,
                  tr.getMeta('schema') || _this.editor.state.schema,
                  _this.options.editorId,
                  newSelection.from
                )

                // Sync to global store
                _$_wysiwygEditorDynamicReferenceIndexes.update((currentMap) => {
                  currentMap.set(_this.options.editorId, newIndex)
                  return currentMap
                })

                // Broadcast changes
                newIndex.forEach((data, id) => {
                  refEvents.dispatchEvent(new CustomEvent('update', { detail: data }))
                })
              }

              // Dispatch selection change event
              refEvents.dispatchEvent(
                new CustomEvent('selection-change', {
                  detail: {
                    editor: _editor,
                    from: newSelection.from,
                    to: newSelection.to
                  }
                })
              )
            }

            return {
              prevSelection: newSelection,
              lastValidationTime:
                shouldValidate && now - value.lastValidationTime > 50
                  ? now
                  : value.lastValidationTime,
              lastIndexTime:
                tr.docChanged || now - value.lastIndexTime > 200 ? now : value.lastIndexTime
            }
          }
        },
        props: {
          handleDOMEvents: {
            mouseup: (view) => {
              const selection = view.state.selection
              const editedNodePos = selection.from - 1

              // Re-validate nodes in edited range
              view.state.doc.nodesBetween(
                Math.max(0, editedNodePos - 50),
                Math.min(view.state.doc.content.size, editedNodePos + 50),
                (node, pos) => {
                  const id = resolveReferenceId(node, _this.options.editorId)
                  if (id && isNodeFineForDynamicReference(node, pos, null)) {
                    const data = getItemData(id, node, view.state.schema, _this.options.editorId)
                    refEvents.dispatchEvent(new CustomEvent('update', { detail: data }))
                  }
                }
              )
              return false
            }
          }
        }
      })
    ]
  },

  addNodeView() {
    return ({ node, view, editor }) => new DynamicReferenceView(node, editor)
  },

  parseHTML() {
    return [{ tag: 'ref' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['ref', mergeAttributes(HTMLAttributes)]
  },

  addCommands() {
    return {
      reindexUUIDs:
        () =>
        ({ tr, dispatch }) => {
          console.log('applyapply docChanged reindexUUIDs')

          if (dispatch) {
            console.log('applyapply docChanged reindexUUIDs dispatch')

            // We set a custom meta tag that our Plugin's 'apply' hook will look for
            tr.setMeta('forceReindex', true)
            dispatch(tr)
          }
          return true
        },
      scrollToNode:
        (uuid: string) =>
        ({ state, view, commands }) => {
          let foundPos = -1
          state.doc.descendants((node, pos) => {
            const resolved = resolveReferenceId(node, this.options.editorId)
            if (resolved === uuid) {
              foundPos = pos
              return false
            }
          })

          if (foundPos > -1) {
            commands.setNodeSelection(foundPos)
            const dom = view.nodeDOM(foundPos) as HTMLElement
            if (dom) {
              dom.scrollIntoView({ behavior: 'smooth', block: 'center' })
              dom.classList.add('reference-pulse-highlight')
              setTimeout(() => dom.classList.remove('reference-pulse-highlight'), 2000)
            }
            return true
          }
          return false
        }
    }
  }
})

// ============================================================================
// INNOVATIVE: Global Node Deletion Cleanup Handler
// ============================================================================
// This handler listens for 'node-deleted' events and cleans up orphaned
// variables from vars.json when asset nodes (spreadsheet, table, slide) are deleted
function setupNodeDeletionCleanup() {
  const handleNodeDeleted = async (event: CustomEvent<any>) => {
    try {
      const { uuid, nodeType, editorId } = event.detail
      if (!uuid || !editorId) return

      // Get the editor instance
      const editorsList = get(_$_wysiwygEditorsList)
      const editor = editorsList?.get(editorId)
      if (!editor) return

      // Get the document for variable cleanup
      const documentEditor = (editor as any)?.documentEditor
      if (!documentEditor) return

      // Handle cleanup based on node type
      if (nodeType === 'spreadsheet' || nodeType === 'sheet') {
        // For spreadsheet nodes, cleanup all variables associated with that spreadsheet
        // The uuid in the node corresponds to the file path or workbookId
        try {
          // Try to cleanup spreadsheet variables by path/UUID
          cleanupSpreadsheetVariablesForPath(uuid, documentEditor, uuid)
          console.log(`✓ Cleaned up spreadsheet variables for deleted node: ${uuid}`)
        } catch (err) {
          console.warn(`Error cleaning up spreadsheet variables for ${uuid}:`, err)
        }
      } else if (nodeType === 'table' || nodeType === 'customTableNode') {
        // For table nodes, cleanup table cell variables
        try {
          // The uuid might be the nodeId or sheet name
          cleanupTableCellVariablesForSheet(uuid, documentEditor)
          console.log(`✓ Cleaned up table variables for deleted node: ${uuid}`)
        } catch (err) {
          console.warn(`Error cleaning up table variables for ${uuid}:`, err)
        }
      } else if (nodeType === 'slide' || nodeType === 'customSlideExtension') {
        // For slide nodes, we might need to cleanup slide-specific variables
        // For now, we can extend this with slide cleanup logic if needed
        try {
          deleteVariable(uuid, documentEditor)
          console.log(`✓ Deleted variable for deleted slide node: ${uuid}`)
        } catch (err) {
          // Ignore if variable doesn't exist
          console.debug(`No variable to cleanup for slide node: ${uuid}`)
        }
      }
    } catch (error) {
      console.error('Error in node deletion cleanup handler:', error)
    }
  }

  // Register the global handler
  refEvents.addEventListener('node-deleted', handleNodeDeleted)

  // Return cleanup function if needed
  return () => {
    refEvents.removeEventListener('node-deleted', handleNodeDeleted)
  }
}

// Initialize the cleanup handler immediately when extension loads
setupNodeDeletionCleanup()
