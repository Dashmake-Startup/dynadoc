<!--
 Copyright (C) 2025 Dashmake Inc.

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
<script lang="ts">
  // const nodeApi =
  //   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
  // const fs = nodeApi?.fs
  // const path = nodeApi?.path
  import { _ } from 'svelte-i18n'
  import { Editor, generateHTML } from '@tiptap/core'
  import Collaboration from '@tiptap/extension-collaboration'
  import CollaborationCaret from '@tiptap/extension-collaboration-caret'
  import { prosemirrorToYXmlFragment } from 'y-prosemirror'
  import * as Y from 'yjs'
  import { WebsocketProvider } from 'y-websocket'
  import { onMount } from 'svelte'
  import EditorExtensionHelpers from '../../../../utils/EditorExtensionHelpers'
  import { saveTranslationBatch } from '../utils/utils'
  import { debounce } from 'lodash'
  import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../../stores/editor.store'
  import { registerEditorHistory } from '../../../../stores/history.store'
  import { get } from 'svelte/store'
  import { buildCollabDocId, resolveShareContext } from '../../../../utils/collabUtils'
  import { fetchCollabToken } from '../../../../services/collab/tokenService'
  import { resolveLocalCollabPresence } from '../../../../utils/collabPresence'
  import { authStore } from '../../../../stores/auth.store'
  import { HocuspocusProvider } from '@hocuspocus/provider'
  import { ProviderManager } from '../../../../ProviderManager'

  import { nodeApi } from '../../../../utils/shims/node'
  import {
    defaultPaginationOptions,
    getPaginationImpactedExtensionOptions,
    type PaginationPlusOptions
  } from '../../../../extensions/tiptap/utils/common.utils'

  let { __originalPath, __translatedPath, __wysiwygEditorId } = $props()

  const _worker = new SharedWorker(
    new URL('../workers/translation-worker.ts', import.meta.url),
    { type: 'module' } // Critical for Vite/TypeScript workers
  )

  let _editorEl: HTMLElement
  let _editor: Editor
  let _editorExtensions = []
  // let initialFullJson = $state('')
  let initialFullJson = {}
  let progress = $state(0)
  let translatedCount = $state(0)
  let totalCount = $state(0)
  let isSaving = $state(false)
  let lastSyncLabel = $state('Idle')
  let hoveredOriginal = $state('')
  let popupVisible = $state(false)
  let popupPos = $state({ x: 0, y: 0 })
  let nodePositionIndex = new Map<string, number>()
  const _collaborationExtensionCurrentUser =
    EditorExtensionHelpers.getMainWysiwygCollaborationExtensionCurrentUser()
  const _collaborationExtensionYDocXmlFragmentName = 'prosemirror'
  const _collaborationExtensionYDoc = new Y.Doc()
  const xmlFragment = _collaborationExtensionYDoc.getXmlFragment(
    _collaborationExtensionYDocXmlFragmentName
  )
  let _collaborationExtensionProvider: WebsocketProvider | null = null

  const buildRoomId = (path: string) => {
    const value = path || 'translation'
    let hash = 5381
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 33) ^ value.charCodeAt(i)
    }
    return `translation-${(hash >>> 0).toString(36)}`
  }

  type OriginalWorkerEntry = {
    html?: string
    json?: any
  }

  const getNodeId = (node: any): string | null => node?.attrs?.uid || node?.attrs?.uuid || null

  const ensureIdentityAttrs = (node: any, id: string) => ({
    ...node,
    attrs: {
      ...(node?.attrs || {}),
      uid: node?.attrs?.uid || id,
      uuid: node?.attrs?.uuid || id
    }
  })

  const hasRenderableContent = (node: any): boolean => {
    if (!node || !Array.isArray(node.content) || node.content.length === 0) return false
    const stack = [...node.content]

    while (stack.length > 0) {
      const current = stack.pop()
      if (!current) continue
      if (typeof current.text === 'string' && current.text.trim().length > 0) return true
      if (Array.isArray(current.content)) stack.push(...current.content)
      if (current.type && current.type !== 'text' && current.type !== 'hardBreak') return true
    }

    return false
  }

  const updateProgressFromDoc = (doc: any) => {
    let total = 0
    let translated = 0
    doc?.descendants?.((node) => {
      if (!node?.isBlock) return
      const id = getNodeId(node)
      if (!id) return
      total += 1
      if (!node.attrs?.needsTranslation) translated += 1
    })
    totalCount = total
    translatedCount = translated
    progress = total ? Math.round((translated / total) * 100) : 0
  }

  let markSavingTimeout: any
  const markSaving = () => {
    isSaving = true
    lastSyncLabel = 'Saving…'
    if (markSavingTimeout) clearTimeout(markSavingTimeout)
    markSavingTimeout = setTimeout(() => {
      isSaving = false
      lastSyncLabel = 'Up to date'
    }, 800)
  }

  const getOriginalDocSnapshot = async (): Promise<any> => {
    const editorFromId = _$_wysiwygEditorsList.getItem(__wysiwygEditorId)
    const editorFromPath = _$_wysiwygEditorsList.getItem(__originalPath)
    const liveEditor = editorFromId || editorFromPath
    if (liveEditor?.getJSON) return liveEditor.getJSON()

    try {
      const originalRaw = await nodeApi.fsPromises?.readFile(__originalPath, 'utf-8')
      return JSON.parse(originalRaw)
    } catch {
      return { type: 'doc', content: [] }
    }
  }

  const readTranslatedDoc = async (): Promise<any> => {
    try {
      const translatedRaw = await nodeApi.fsPromises?.readFile(__translatedPath, 'utf-8')
      return JSON.parse(translatedRaw)
    } catch {
      return { type: 'doc', content: [] }
    }
  }

  const getAllOriginalsFromWorker = (): Promise<Record<string, OriginalWorkerEntry>> =>
    new Promise((resolve) => {
      const timeout = setTimeout(() => {
        _worker.port.removeEventListener('message', handleInitialSync)
        resolve({})
      }, 1200)

      const handleInitialSync = (e: MessageEvent) => {
        if (e.data?.type !== 'ALL_ORIGINALS_RESPONSE') return
        clearTimeout(timeout)
        _worker.port.removeEventListener('message', handleInitialSync)
        resolve(e.data.map || {})
      }

      _worker.port.addEventListener('message', handleInitialSync)
      _worker.port.postMessage({ type: 'GET_ALL_ORIGINALS' })
    })

  const emptyDoc = () => ({ type: 'doc', content: [] })

  function buildInitialTranslationDocument(
    originalDoc: any,
    translatedDoc: any,
    originalsMap: Record<string, OriginalWorkerEntry>
  ) {
    const translationLookup = new Map<string, any>()
    const translatedContent = Array.isArray(translatedDoc?.content) ? translatedDoc.content : []
    translatedContent.forEach((node: any) => {
      const id = getNodeId(node)
      if (!id) return
      translationLookup.set(id, ensureIdentityAttrs(node, id))
    })

    let originalSkeleton = Array.isArray(originalDoc?.content) ? originalDoc.content : []
    if (originalSkeleton.length === 0 && originalsMap) {
      originalSkeleton = Object.values(originalsMap)
        .map((entry) => entry?.json)
        .filter(Boolean)
    }
    if (originalSkeleton.length === 0 && translatedContent.length > 0) {
      originalSkeleton = translatedContent.map((node) => {
        const id = getNodeId(node)
        return id ? ensureIdentityAttrs(node, id) : node
      })
    }

    const finalContent = originalSkeleton.map((sourceNode: any) => {
      const id = getNodeId(sourceNode)
      if (!id) return sourceNode

      const normalizedSource = ensureIdentityAttrs(sourceNode, id)
      const translatedNode = translationLookup.get(id)
      const translatedReady = translatedNode && hasRenderableContent(translatedNode)

      if (translatedReady) {
        return {
          ...translatedNode,
          attrs: { ...translatedNode.attrs, needsTranslation: false }
        }
      }

      return {
        ...normalizedSource,
        attrs: { ...normalizedSource.attrs, needsTranslation: true }
      }
    })

    return {
      type: originalDoc?.type || translatedDoc?.type || 'doc',
      content: finalContent
    }
  }

  async function loadFiles() {
    const [originalDoc, translatedDoc, originalsMap] = await Promise.all([
      getOriginalDocSnapshot(),
      readTranslatedDoc(),
      getAllOriginalsFromWorker()
    ])

    initialFullJson =
      buildInitialTranslationDocument(originalDoc, translatedDoc, originalsMap) || emptyDoc()
  }
  async function handleHover(uuid: string, event: MouseEvent) {
    // 1. Check local cache first
    /* if (localOriginalCache.has(uuid)) {
    showPopup(localOriginalCache.get(uuid), event);
    return;
  } */

    // 2. Otherwise, ask the worker for the original content
    _worker.port.postMessage({ type: 'GET_ORIGINAL_CONTENT', id: uuid })

    // The worker will respond via onmessage, which we handle below
  }

  const broadcastUpdate = debounce((id, html, json) => {
    console.log('initialFullJsoninitialFullJson broadcastUpdate', { id, html, json })

    _worker.port.postMessage({
      type: 'FULL_VIEW_UPDATE',
      id,
      html,
      json
    })
  }, 300)
  // Helper to wrap single nodes for Tiptap's generateHTML
  const wrapNode = (n: any) => ({
    type: 'doc',
    content: [n]
  })
  const rebuildNodePositionIndex = () => {
    if (!_editor) return
    const nextIndex = new Map<string, number>()
    _editor.state.doc.descendants((node, pos) => {
      const id = getNodeId(node)
      if (id && node.isBlock) nextIndex.set(id, pos)
    })
    nodePositionIndex = nextIndex
  }
  const scheduleReindex = debounce(rebuildNodePositionIndex, 80)
  const debouncedProgress = debounce((editor) => {
    updateProgressFromDoc(editor.state.doc)
  }, 120)
  const getNodePosition = (id: string): number | null => {
    const indexed = nodePositionIndex.get(id)
    if (typeof indexed === 'number') return indexed

    let found: number | null = null
    _editor.state.doc.descendants((node, pos) => {
      if (getNodeId(node) === id) {
        found = pos
        return false
      }
    })
    if (typeof found === 'number') nodePositionIndex.set(id, found)
    return found
  }
  const resolveSafePos = (pos: number | null) => {
    if (typeof pos !== 'number') return null
    const docSize = _editor?.state?.doc?.content?.size ?? 0
    if (pos < 0 || pos > docSize) return null
    return pos
  }

  const debouncedSave = debounce((editor, changedNodesMap) => {
    markSaving()
    changedNodesMap.forEach(({ node }, uuid) => {
      const nodeJson = ensureIdentityAttrs(node.toJSON(), uuid)

      // Generate HTML using the internal schema for safety
      const nodeHtml = generateHTML(wrapNode(nodeJson), _editorExtensions)

      broadcastUpdate(uuid, nodeHtml, nodeJson)

      _worker.port.postMessage({
        type: 'SAVE_TRANSLATION',
        payload: {
          nodeId: uuid,
          json: nodeJson,
          filePath: __originalPath,
          translatedFilePath: __translatedPath
        }
      })
    })
  }, 300)

  onMount(async () => {
    _worker.port.start()
    await loadFiles()
    console.log('initialFullJsoninitialFullJson onMount', { initialFullJson })

    const documentEditor = get(_$_documentEditorsList.get(__wysiwygEditorId))
    let _paginationOptions: PaginationPlusOptions =
      documentEditor?.document?.config.pagination || defaultPaginationOptions
    const _paginationImpactedExtensionOptions = getPaginationImpactedExtensionOptions(
      _paginationOptions,
      __wysiwygEditorId
    )

    if (xmlFragment.length === 0 && initialFullJson) {
      try {
        const schema = EditorExtensionHelpers.getHeadlessSchema(__translatedPath)
        const pmDoc = schema.nodeFromJSON(initialFullJson)
        _collaborationExtensionYDoc.transact(() => {
          prosemirrorToYXmlFragment(pmDoc, xmlFragment)
        }, 'local-translation-seed')
      } catch (e) {
        console.error('❌ Failed to seed translation Yjs Doc:', e)
      }
    }

    const collabDocId = await buildCollabDocId(documentEditor?.document, __translatedPath)
    const share = resolveShareContext(documentEditor?.document)

    _collaborationExtensionProvider = new HocuspocusProvider({
      url: (window as any).DYNADOC_WS_URL || 'wss://api.dynadoc.dashmake.com/ws',
      name: collabDocId,
      document: _collaborationExtensionYDoc,
      connect: false
    })

    const authState = get(authStore)
    const presence = resolveLocalCollabPresence({
      docId: collabDocId,
      authUser: authState?.authenticated ? authState.user : null,
      forceAnonymous: Boolean(share)
    })

    fetchCollabToken({
      docId: collabDocId,
      username: presence.name,
      color: presence.color,
      share: share || undefined
    }).then((res) => {
      if (res?.token) {
        _collaborationExtensionProvider.setConfiguration({ token: res.token })
        _collaborationExtensionProvider.connect()
      }
    })

    _collaborationExtensionProvider.awareness.setLocalStateField('user', {
      name: presence.name,
      color: presence.color
    })

    _editorExtensions = [
      ...EditorExtensionHelpers.getMainWysiwygExtensions(
        _editorEl!,
        null,
        'Start translating...',
        _paginationOptions,
        _paginationImpactedExtensionOptions,
        // uuidv4()
        __translatedPath,
        _collaborationExtensionProvider
      ),
      Collaboration.configure({
        document: _collaborationExtensionYDoc,
        field: _collaborationExtensionYDocXmlFragmentName
      }),
      CollaborationCaret.configure({
        provider: _collaborationExtensionProvider,
        user: _collaborationExtensionCurrentUser
      })
    ]
    _editor = new Editor({
      element: _editorEl,
      extensions: _editorExtensions,
      content: initialFullJson,
      editorProps: {
        handleDOMEvents: {
          // Inside handleDOMEvents
          /* mouseover: (view, event) => {
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
            if (pos) {
              const node = view.state.doc.nodeAt(pos.inside || pos.pos) || null
              const uuid = node?.attrs?.uid || node?.attrs?.uuid

              if (uuid) {
                // 1. Position the popup
                popupPos = { x: event.clientX, y: event.clientY }

                // 2. Request original content from worker
                _worker.port.postMessage({ type: 'GET_ORIGINAL_CONTENT', id: uuid })

                // onmessage listener will update hoveredOriginal
                popupVisible = true
              }
            }
            return false
          }, */
          /* mouseover: (view, event) => {
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
            if (pos) {
              const node = view.state.doc.nodeAt(pos.inside)
              const uuid = node?.attrs?.uid
              if (uuid) {
                // Find original text from our cached items
                hoveredOriginal = findOriginalById(uuid)
                popupPos = { x: event.clientX, y: event.clientY }
                popupVisible = true
              }
            }
            return false
          }, */
          mouseleave: () => {
            popupVisible = false
            return false
          }
        }
      },
      /* onUpdate: ({ editor }) => {
        // Detect which node changed and notify the Worker
        const transaction = editor.state.tr
        // Broadcast the change so Side-by-Side tab updates its virtual list
        broadcastUpdate(editor)
      }, */

      /* onTransaction: ({ editor, transaction }) => {
        if (!transaction.docChanged) return

        // We find which ranges were modified
        transaction.steps.forEach((step) => {
          // @ts-ignore
          const { from, to } = step

          editor.state.doc.nodesBetween(from, to, (node) => {
            const uuid = node.attrs?.uid || node.attrs?.uuid

            // We only broadcast if the node has a UUID and is a top-level block
            if (uuid && node.isBlock) {
              // Extract JUST this node's HTML/JSON
              const nodeHtml =
                editor.view.dom.querySelector(`[data-uid="${uuid}"]`)?.innerHTML || ''
              const nodeJson = node.toJSON()

              // DEBOUNCED BROADCAST
              debounce(() => {
                _worker.port.postMessage({
                  type: 'FULL_VIEW_UPDATE',
                  id: uuid,
                  html: nodeHtml,
                  json: nodeJson
                })
              }, 300)()
            }
          })
        })
      } */
      onCreate: ({ editor }) => {
        // Register the editor instance in the store
        console.log('Register the editor instance in the store ', editor)
        _$_wysiwygEditorsList.register(
          __translatedPath,
          editor,
          // _editor,
          __translatedPath,
          _editorEl,
          null,
          null,
          null,
          [],
          _paginationOptions
        )
        _$_wysiwygEditorsList.setActive(__translatedPath)
        registerEditorHistory({
          editorId: __translatedPath?.toString(),
          editor,
          ydocTypes: [xmlFragment]
        })
        updateProgressFromDoc(editor.state.doc)
        lastSyncLabel = 'Up to date'
      },
      onFocus: () => {
        _$_wysiwygEditorsList.setActive(__translatedPath)
      },
      /* onTransaction: ({ editor, transaction }) => {
        if (!transaction.docChanged) return

        transaction.steps.forEach((step) => {
          // @ts-ignore - access internal positions
          let { from, to } = step

          // 1. Skip if positions are missing
          if (from === undefined || to === undefined) return

          // 2. Clamp positions to the CURRENT document size
          // When the doc is emptied, doc.content.size is 0 (or 2 for an empty paragraph)
          const docSize = editor.state.doc.content.size
          const safeFrom = Math.max(0, Math.min(from, docSize))
          const safeTo = Math.max(0, Math.min(to, docSize))

          // 3. Only iterate if the range is valid and the doc isn't completely empty
          if (safeFrom <= safeTo) {
            try {
              editor.state.doc.nodesBetween(safeFrom, safeTo, (node, pos) => {
                const uuid = node.attrs?.uid || node.attrs?.uuid || node.attrs?.id
                if (!uuid) return

                if (uuid && node.isBlock) {
                  // 1. If user typed something, remove the red flag
                  if (node.attrs.needsTranslation && node.textContent.length > 0) {
                    editor.commands.updateAttributes(node.type.name, { needsTranslation: false })
                  }
                  const nodeJson = node.toJSON()

                  // 2. Broadcast update to Virtual List
                  const nodeHtml = generateHTML(wrapNode(nodeJson), _editorExtensions)
                  // editor.view.dom.querySelector(`[data-uid="${uuid}"]`)?.innerHTML || ''
                  broadcastUpdate(uuid, nodeHtml, nodeJson)

                  // 3. NEW: Trigger Disk Save via Worker
                  _worker.port.postMessage({
                    type: 'SAVE_TRANSLATION',
                    payload: {
                      nodeId: uuid,
                      json: nodeJson,
                      filePath: __originalPath,
                      translatedFilePath: __translatedPath
                    }
                  })
                  /*  debounce(() => {
                _worker.port.postMessage({
                  type: 'FULL_VIEW_UPDATE',
                  id: uuid,
                  html: nodeHtml,
                  json: node.toJSON()
                })
              }, 300)() +/
                }
              })
            } catch (e) {
              console.warn('NodesBetween failed safely during deletion', e)
            }
          }
        })

        /* transaction.steps.forEach((step) => {
          // @ts-ignore
          const { from, to } = step
          editor?.state?.doc?.nodesBetween(from, to, (node, pos) => {
            const uuid = node.attrs?.uid || node.attrs?.uuid

            if (uuid && node.isBlock) {
              // 1. If user typed something, remove the red flag
              if (node.attrs.needsTranslation && node.textContent.length > 0) {
                editor.commands.updateAttributes(node.type.name, { needsTranslation: false })
              }
              const nodeJson = node.toJSON()

              // 2. Broadcast update to Virtual List
              const nodeHtml = generateHTML(wrapNode(nodeJson), _editorExtensions)
              // editor.view.dom.querySelector(`[data-uid="${uuid}"]`)?.innerHTML || ''
              broadcastUpdate(uuid, nodeHtml, nodeJson)

              // 3. NEW: Trigger Disk Save via Worker
              _worker.port.postMessage({
                type: 'SAVE_TRANSLATION',
                payload: {
                  nodeId: uuid,
                  json: nodeJson,
                  filePath: __originalPath,
                  translatedFilePath: __translatedPath
                }
              })
              /*  debounce(() => {
                _worker.port.postMessage({
                  type: 'FULL_VIEW_UPDATE',
                  id: uuid,
                  html: nodeHtml,
                  json: node.toJSON()
                })
              }, 300)() +/
            }
          })
        }) +/
      } */

      // 2. IMPORTANT: Use method shorthand, NOT an arrow function
      onTransaction({ editor, transaction }) {
        if (!transaction.docChanged || transaction.getMeta('preventLoop')) return

        const changedNodes = new Map()
        const doc = transaction.doc // Use the document from the transaction
        const docSize = doc.content.size

        transaction.steps.forEach((step: any) => {
          // 1. Handle cases where from/to might be undefined or null
          let { from, to } = step

          // If step doesn't have from/to, it might be a different step type
          // We check if they are numbers.
          if (typeof from !== 'number' || typeof to !== 'number') return

          // 2. CLAMP POSITIONS
          // This prevents the "nodeSize of undefined" error by ensuring
          // we never look outside the actual document boundaries.
          const safeFrom = Math.max(0, Math.min(from, docSize))
          const safeTo = Math.max(0, Math.min(to, docSize))

          // 3. Only iterate if the range is valid
          if (safeFrom <= safeTo) {
            try {
              doc.nodesBetween(safeFrom, safeTo, (node, pos) => {
                const uuid = node.attrs?.uid || node.attrs?.uuid || node.attrs?.id
                if (uuid && node.isBlock) {
                  changedNodes.set(uuid, { node, pos })
                }
              })
            } catch (err) {
              // Catch internal ProseMirror indexing errors
              console.warn('Transaction indexing mismatch:', err)
            }
          }
        })

        if (changedNodes.size === 0) return

        // 3. Handle Attribute Updates (Preventing the loop)
        changedNodes.forEach(({ node, pos }) => {
          if (node.attrs.needsTranslation && node.textContent.length > 0) {
            editor.view.dispatch(
              editor.state.tr
                .setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  needsTranslation: false
                })
                .setMeta('preventLoop', true)
            )
          }
        })

        // 4. Trigger the stable debounced function
        debouncedSave(editor, changedNodes)
        debouncedProgress(editor)
        scheduleReindex()
      },

      onDestroy() {
        // 5. Cleanup to prevent memory leaks or background crashes
        debouncedSave?.cancel()
      }
    })
    rebuildNodePositionIndex()

    const handleWorkerMessage = (e: MessageEvent) => {
      const data = e.data || {}
      const { type, id, json, prevId } = data

      if (type === 'NODE_SYNC' && id && json) {
        const currentPos = resolveSafePos(getNodePosition(id))

        if (typeof currentPos === 'number') {
          const currentNode = _editor.state.doc.nodeAt(currentPos)
          const shouldPreserveTranslation =
            currentNode &&
            !currentNode.attrs?.needsTranslation &&
            currentNode.textContent.trim().length > 0

          if (
            !shouldPreserveTranslation &&
            !_editor.isActive({ uid: id }) &&
            !_editor.isActive({ uuid: id })
          ) {
            const incomingNode = ensureIdentityAttrs(json, id)
            const nextNode = {
              ...incomingNode,
              attrs: { ...incomingNode.attrs, needsTranslation: true }
            }
            const transaction = _editor.state.tr.replaceWith(
              currentPos,
              currentPos + currentNode.nodeSize,
              _editor.schema.nodeFromJSON(nextNode)
            )
            _editor.view.dispatch(transaction.setMeta('addToHistory', false))
            debouncedProgress(_editor)
            scheduleReindex()
          }
          return
        }

        let insertPos = _editor.state.doc.content.size
        if (prevId) {
          const prevPos = resolveSafePos(getNodePosition(prevId))
          if (typeof prevPos === 'number') {
            const prevNode = _editor.state.doc.nodeAt(prevPos)
            if (prevNode) insertPos = prevPos + prevNode.nodeSize
          }
        }
        insertPos = Math.min(insertPos, _editor.state.doc.content.size)

        const incomingNode = ensureIdentityAttrs(json, id)
        const newNodeJson = {
          ...incomingNode,
          attrs: { ...incomingNode.attrs, needsTranslation: true }
        }

        const transaction = _editor.state.tr.insert(
          insertPos,
          _editor.schema.nodeFromJSON(newNodeJson)
        )
        _editor.view.dispatch(transaction.setMeta('addToHistory', false))
        debouncedProgress(_editor)
        scheduleReindex()
        return
      }

      if (type === 'NODE_DELETED' && id) {
        const pos = resolveSafePos(getNodePosition(id))
        if (typeof pos === 'number') {
          const node = _editor.state.doc.nodeAt(pos)
          if (node) {
            const docSize = _editor.state.doc.content.size
            const end = Math.min(pos + node.nodeSize, docSize)
            if (end > pos) {
              const transaction = _editor.state.tr.delete(pos, end)
              _editor.view.dispatch(transaction.setMeta('addToHistory', false))
            }
            debouncedProgress(_editor)
            scheduleReindex()
          }
        }
        return
      }

      if (type === 'SYNC_FROM_LIST_VIEW' && id && json) {
        const pos = resolveSafePos(getNodePosition(id))
        if (typeof pos === 'number') {
          const currentNode = _editor.state.doc.nodeAt(pos)
          if (!currentNode) return
          const normalizedNode = ensureIdentityAttrs(json, id)
          const docSize = _editor.state.doc.content.size
          const end = Math.min(pos + currentNode.nodeSize, docSize)
          if (end > pos) {
            const transaction = _editor.state.tr.replaceWith(
              pos,
              end,
              _editor.schema.nodeFromJSON(normalizedNode)
            )
            transaction.setMeta('addToHistory', false)
            _editor.view.dispatch(transaction)
            debouncedProgress(_editor)
            scheduleReindex()
          }
        }
        return
      }

      if (type === 'DISK_WRITE_BATCH') {
        saveTranslationBatch(data.changes)
        markSaving()
      }
    }

    _worker.port.addEventListener('message', handleWorkerMessage)

    return () => {
      _worker.port.removeEventListener('message', handleWorkerMessage)
      _collaborationExtensionProvider?.destroy()
      _collaborationExtensionYDoc.destroy()
      scheduleReindex?.cancel()
      debouncedProgress?.cancel()
      debouncedSave?.cancel()
      broadcastUpdate?.cancel()
      if (markSavingTimeout) clearTimeout(markSavingTimeout)
    }
  })
  const pendingCount = $derived(Math.max(0, totalCount - translatedCount))
</script>

<div class="flex flex-col h-full bg-base-100 text-#f5f5f5 font-sans overflow-hidden">
  <header class="h-10 px-5 flex items-center justify-between bg-#252525 border-b border-white/8">
    <div class="flex items-center gap-3 text-[11px] tracking-[0.05em] uppercase text-#999">
      <div
        class="w-1.5 h-1.5 rounded-full shadow-[0_0_8px] transition-all duration-500"
        class:bg-green-400={!isSaving}
        class:shadow-green-400={!isSaving}
        class:bg-blue-500={isSaving}
        class:shadow-blue-500={isSaving}
        class:animate-pulse={isSaving}
      ></div>
      <span>{lastSyncLabel}</span>
      <span class="text-base-content/20">•</span>
      <span class="text-base-content/40">
        {progress}% {$_('Translated')}
      </span>
      <span class="text-base-content/20">•</span>
      <span class="text-base-content/40">
        {translatedCount}/{totalCount}
        {$_('blocks')}
      </span>
      {#if pendingCount > 0}
        <span class="text-base-content/20">•</span>
        <span class="text-amber-300/80">{pendingCount} {$_('remaining')}</span>
      {/if}
    </div>

    <div
      class="w-40 h-1 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rounded-full overflow-hidden"
    >
      <div class="h-full bg-blue-600 transition-all duration-500" style="width: {progress}%"></div>
    </div>
  </header>

  <main class="flex-1 overflow-y-auto p-10 adobe-editor-container" bind:this={_editorEl}></main>

  {#if popupVisible}
    <div
      class="fixed z-1000 pointer-events-none p-4 w-80 rounded-xl border border-white/10
             bg-[rgba(45,45,45,0.85)] backdrop-blur-20px shadow-2xl transition-transform duration-200"
      style="left: {popupPos.x}px; top: {popupPos.y}px; transform: translate(20px, 20px);"
    >
      <div class="flex justify-between items-center mb-2">
        <span
          class="px-2 py-0.5 text-[9px] font-900 bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] rounded uppercase tracking-wider text-base-content/50"
        >
          {$_('Source Text')}
        </span>
        <span class="text-[10px] text-blue-400">{$_('⌘ Click to Copy')}</span>
      </div>

      <div class="text-[13px] leading-relaxed text-base-content/80 max-h-40 overflow-y-auto">
        {@html hoveredOriginal}
      </div>

      <div
        class="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-[10px] text-base-content/30 italic"
      >
        <div class="i-ph-sparkle-fill w-3 h-3"></div>
        <span>{$_('Contextual AI ghostwriting active')}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Adobe 2025 "Needs Translation" Decoration */
  :global(.ProseMirror [data-needs-translation='true']) {
    @apply relative transition-all duration-400 pl-4 border-l-4 border-#d7373f;
    background: linear-gradient(90deg, rgba(215, 55, 63, 0.08) 0%, transparent 100%) !important;
  }

  :global(.ProseMirror [data-needs-translation='true']::before) {
    content: 'UNTRANSLATED CONTENT';
    @apply absolute -top-5 left-0 text-[8px] font-800 tracking-[0.1em] text-#d7373f opacity-50;
  }

  /* Smooth transition when translation starts */
  :global(.ProseMirror [data-needs-translation='true']:focus-within) {
    @apply border-l-blue-600 bg-transparent!;
    color: inherit;
  }

  /* Custom Scrollbar for Adobe Feel */
  .adobe-editor-container::-webkit-scrollbar {
    width: 12px;
  }
  .adobe-editor-container::-webkit-scrollbar-thumb {
    @apply bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] border-4 border-solid border-#1e1e1e rounded-full hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)];
  }
</style>
