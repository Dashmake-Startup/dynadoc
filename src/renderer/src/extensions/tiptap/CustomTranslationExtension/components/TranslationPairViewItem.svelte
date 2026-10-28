<script lang="ts">
  import { _ } from 'svelte-i18n'
  import SvelteVirtualList from '@humanspeak/svelte-virtual-list'
  import { onMount, tick } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import { saveTranslationBatch, type TranslationUnit } from '../utils/utils'
  import { Editor } from '@tiptap/core'
  import EditorExtensionHelpers from '../../../../utils/EditorExtensionHelpers'
  import { v4 as uuidv4 } from 'uuid'
  import Utils from '../../../../utils/Utils'
  import { _$_wysiwygEditorsList } from '../../../../stores/editor.store'
  import { nodeApi } from '../../../../utils/shims/node'

  /* 
  Would you like me to show you how to implement a "Diff View" so the user can see exactly which words changed in the Source Pane using a green/red text highlight?
  
  Would you like me to show you how to add an "Auto-Sync" button that uses an AI LLM to automatically update all Outdated (Stale) nodes at once?
  */
  //   const nodeApi =
  //     typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
  //   const fs = nodeApi?.fs
  //   const path = nodeApi?.path
  // --- Runes (Svelte 5) ---
  //   interface Props {
  //     __items: TranslationUnit[]
  //     __filePath: string
  //     __translatedFilePath: string
  //   }
  //   let { __items = $bindable([]), __filePath, __translatedFilePath }: Props = $props()

  let _editorId = `pair-${__translatedFilePath}`
  let staleNodeIds = $state(new Set<string>())
  let editingId = $state<string | null>(null)
  let searchTerm = $state('')

  // Single Shared Editor Refs
  let _editor = $state<Editor | null>(null)
  let _editorEl = $state<HTMLDivElement | null>(null)

  // Efficiency: Derived search
  let filteredItems = $derived(
    searchTerm
      ? __items.filter(
          (i) =>
            i.originalHtml.toLowerCase().includes(searchTerm.toLowerCase()) ||
            i.translatedHtml.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : // ? __items.filter((i) => i.originalHtml.toLowerCase().includes(searchTerm.toLowerCase()))
        __items
  )
  // Count items that have no actual content
  let needsTranslationCount = $derived(__items.filter((item) => !hasContent(item)).length)

  // Count items that are outdated (source changed)
  let outdatedCount = $derived(staleNodeIds.size)

  // const worker = new SharedWorker(new URL('../workers/translation-worker.ts', import.meta.url))
  const _worker = new SharedWorker(
    new URL('../workers/translation-worker.ts', import.meta.url),
    { type: 'module' } // Critical for Vite/TypeScript workers
  )
  // --- Intersection Observer for Phantom Sync ---
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('data-node-id')
          const item = __items.find((i) => i.id === id)
          // Only request if not already rendered
          /* if (item && !item.originalHtml) {
            worker.port.postMessage({
              type: 'PRE_RENDER_REQUEST',
              id: item.id,
              content: item.originalHtml
            })
          } */

          if (item && !item.originalHtml) {
            // Check for the preview specifically
            _worker.port.postMessage({
              type: 'PRE_RENDER_REQUEST',
              id: item.id,
              content: item.originalHtml // Pass the RAW source HTML to be rendered
            })
          }
        }
      })
    },
    { rootMargin: '500px' }
  )

  function observeAction(node: HTMLElement) {
    observer.observe(node)
    return { destroy: () => observer.unobserve(node) }
  }

  // --- Editor Teleportation ---
  async function startEditing1(item: TranslationUnit) {
    if (!_editor) return
    editingId = item.id

    // Set content before the teleport finishes to avoid layout flash
    _editor.commands.setContent(item.translatedJson || item.translatedHtml || '')

    // Wait for Svelte to render the _editorEl container in the new row
    await tick()
    _editor.commands.focus()
  }

  async function startEditing11(item: TranslationUnit) {
    if (!_editor) return
    editingId = item.id

    // Determine if it's a new translation
    const isNewTranslation = !item.translatedJson && !item.translatedHtml

    // If new, use original content as the starting point
    const initialContent = isNewTranslation
      ? item.originalJson || item.originalHtml
      : item.translatedJson || item.translatedHtml

    _editor.commands.setContent(initialContent)

    await tick() // Wait for teleport

    if (isNewTranslation) {
      // Select all so the first keystroke replaces everything
      _editor.commands.selectAll()
    } else {
      _editor.commands.focus('end')
    }
  }

  async function startEditing(item: TranslationUnit) {
    if (!_editor) return
    editingId = item.id

    const isActuallyTranslated = hasContent(item)

    // If not translated, we pre-fill with the original so the user has a reference
    const contentToLoad = isActuallyTranslated
      ? item.translatedJson || item.translatedHtml
      : item.originalJson || item.originalHtml

    _editor.commands.setContent(contentToLoad)

    await tick() // Wait for Svelte to teleport the editor element

    if (!isActuallyTranslated) {
      // Select everything so the first keypress deletes the "original" reference
      _editor.commands.selectAll()
    } else {
      // Just put the cursor at the end if they are resuming work
      _editor.commands.focus('end')
    }
  }

  function teleportEditor(node: HTMLElement) {
    if (_editorEl) node.appendChild(_editorEl)
    return {
      destroy() {
        // Move back to hidden storage when row unmounts or editing stops
        const hiddenStore = document.getElementById('editor-hidden-store')
        if (hiddenStore && _editorEl) hiddenStore.appendChild(_editorEl)
      }
    }
  }

  // Inside TranslationManager.svelte

  function updateTranslation(filePath: string, translatedFilePath: string, json: any) {
    console.log('TranslationSyncControllerImpl updateTranslation  ', {
      filePath,
      translatedFilePath,
      json
    })
    // 1. Update the local Rune state for immediate UI feedback
    const currentItem = __items.find((i) => i.id === editingId)
    if (currentItem) {
      // We update the local item so other parts of the UI (metrics) stay in sync
      // currentItem.translatedJson = json; // Already handled in onUpdate logic
    }

    // 2. Offload the heavy Disk I/O to the worker
    _worker.port.postMessage({
      type: 'SAVE_TRANSLATION',
      payload: {
        filePath,
        translatedFilePath,
        nodeId: editingId,
        json,
        timestamp: Date.now()
      }
    })
  }

  function updateTranslation22(
    fileId: string,
    translatedFileId: string,
    // uuid: string,
    json: any
    // isEmpty: boolean
  ) {
    console.log('TranslationSyncControllerImpl updateTranslation  ', {
      fileId,
      translatedFileId,
      json
    })
    // return
    // saveAllTranslationsFor(fileId, translatedFileId)
  }

  function hasContent(item: TranslationUnit): boolean {
    // 1. If no JSON, definitely no content
    if (!item.translatedJson || !item.translatedJson.content) return false

    // 2. Check if there is any text in the nodes
    // We flatten the text of all children to see if it's just whitespace
    const text = item.translatedJson.content
      .map((node: any) => {
        if (node.text) return node.text
        if (node.content) return node.content.map((c: any) => c.text).join('')
        return ''
      })
      .join('')
      .trim()

    return text.length > 0
  }

  onMount(() => {
    // Initialize Single Instance
    _editor = new Editor({
      element: _editorEl!,
      extensions: [
        ...EditorExtensionHelpers.getMainWysiwygExtensions(
          _editorEl!,
          null,
          'Start translating...',
          null,
          null,
          // uuidv4()
          _editorId
        )
      ],
      /* onUpdate: ({ editor }) => {
        const currentItem = __items.find((i) => i.id === editingId)
        console.log("TranslationSyncControllerImpl",{currentItem,__items})
        if (currentItem) {
          currentItem.translatedHtml = editor.getHTML()
          currentItem.translatedJson = editor.getJSON()
          const json = editor.getJSON().content?.[0] ?? null
          const isEmpty = editor.getText().trim() === ''
        console.log("TranslationSyncControllerImpl yea",{currentItem,__items,__filePath, __translatedFilePath, json})

          updateTranslation(__filePath, __translatedFilePath, json)
          // updateTranslation(__filePath, __translatedFilePath, uuid, json, isEmpty)
        }
      } */
      onCreate: ({ editor }) => {
        // Register the editor instance in the store
        console.log('Register the editor instance in the store ', editor)
        _$_wysiwygEditorsList.register(
          _editorId,
          editor,
          // _editor,
          __translatedFilePath,
          _editorEl,
          null,
          null,
          null,
          []
          // _paginationOptions
        )
      },
      onUpdate: ({ editor }) => {
        const currentItem = __items.find((i) => i.id === editingId)

        if (currentItem) {
          // 1. Sync UI State (Runes)
          const newHtml = editor.getHTML()
          const newJson = editor.getJSON()

          currentItem.translatedHtml = newHtml
          currentItem.translatedJson = newJson

          // We also update the previewHtml so the row doesn't show a shimmer when we stop editing
          // currentItem.previewHtml = `<div class="adobe-static-preview">${newHtml}</div>`

          // 2. Prep for Disk
          // Extracting the specific node content (usually the first child of doc)
          // const nodeContent = newJson.content?.[0] ?? null

          // 3. Trigger Save
          // updateTranslation(__filePath, __translatedFilePath, nodeContent)

          // The 'doc' is the top level, its first child is usually the paragraph/node
          const nodeContent = newJson.content?.[0] ?? null

          if (nodeContent) {
            // FORCE the uuid into the attributes to ensure the disk logic finds it
            if (!nodeContent.attrs) nodeContent.attrs = {}
            nodeContent.attrs.uuid = currentItem.id
            // 3. Trigger Save
            updateTranslation(__filePath, __translatedFilePath, nodeContent)

            // 2. NEW: Broadcast to Full Document Editor
            _worker.port.postMessage({
              type: 'SYNC_TO_FULL_VIEW',
              id: currentItem.id,
              json: nodeContent // Send the single node JSON
            })
          }
        }
      }
    })

    _worker.port.start()
    /* worker.port.onmessage = (e) => {
      if (e.data.type === 'SOURCE_CHANGED') {
        staleNodeIds.add(e.data.id)
        staleNodeIds = new Set(staleNodeIds)
      } else if (e.data.type === 'PRE_RENDER_COMPLETE') {
        const item = __items.find((i) => i.id === e.data.id)
        if (item) item.originalHtml = e.data.html
      }
    } */

    const handleWorkerMessage = (e: MessageEvent) => {
      console.log('💾 TranslationSyncControllerImpl Worker :', e.data)

      const data = e.data
      const { type, id, html, changes, json } = data
      // const { type, id, html, changes } = e.data

      /* if (type === 'SOURCE_CHANGED') {
        staleNodeIds.add(id)
        staleNodeIds = new Set(staleNodeIds)
      }  */

      /* if (type === 'SOURCE_CHANGED') {
        // 1. Find the item in our list
        const index = __items.findIndex((item) => item.id === id)

        if (index !== -1) {
          // 2. Update the original HTML in the UI immediately
          __items[index].originalHtml = html

          // 3. Mark as Outdated (Yellow alert)
          staleNodeIds.add(id)
          staleNodeIds = new Set(staleNodeIds) // Trigger Svelte 5 reactivity

          // 4. Mark the unit itself as stale for save logic
          __items[index].isStale = true
        }
      } */
      // Inside TranslationManager.svelte onMount worker.port.onmessage
      if (type === 'NODE_SYNC') {
        // 1. Find the item in our list
        const existingIndex = __items.findIndex((item) => item.id === id)

        if (existingIndex !== -1) {
          console.log(
            '💾 TranslationSyncControllerImpl Worker existingIndex :',
            { existingIndex },
            __items[existingIndex],
            e.data
          )

          // EXISTING NODE: Handle as an update (Outdated)
          __items[existingIndex].originalHtml = html
          // Uncomment later if needed
          /* staleNodeIds.add(id)
          staleNodeIds = new Set(staleNodeIds) */
        } else {
          // NEW NODE: Create a new translation unit in the list
          // Only add if it's a translatable type (p, heading)
          const translatableTypes = ['paragraph', 'heading']
          const hasActualText = data.html.replace(/<[^>]*>/g, '').trim().length > 0

          // if (translatableTypes.includes(data.nodeType) && hasActualText) {
          if (hasActualText) {
            // if (translatableTypes.includes(data.nodeType)) {
            const newUnit: TranslationUnit = {
              id: id,
              originalHtml: html,
              originalJson: data.json,
              translatedHtml: '',
              translatedJson: null,
              isStale: false
            }

            // Add to the list (Svelte 5 Rune update)
            // __items.push(newUnit)
            // const hasActualText = data.html.replace(/<[^>]*>/g, '').trim().length > 0

            /* if (existingIndex === -1 && hasActualText) {
              // Only add brand new nodes if they have text
              __items.push(newUnit)
            } else if (existingIndex !== -1 && !hasActualText) {
              // If a node was emptied in the main editor, remove it from the translation list
              __items.splice(existingIndex, 1)
            } */

            // --- RELATIVE INSERTION LOGIC ---
            /* if (data.prevId) {
              const prevIndex = __items.findIndex((i) => i.id === data.prevId)
              if (prevIndex !== -1) {
                // Insert right after its neighbor
                __items.splice(prevIndex + 1, 0, newUnit)
              } else {
                // Neighbor was filtered out or not found, append to end or find closest
                __items.push(newUnit)
              }
            } else {
              // No prevId means it's likely the very first node
              __items.unshift(newUnit)
            } */

            /* 
            
            Would you like me to add a "Re-sync Order" button that fetches the entire document structure once to fix any ordering mistakes that happened during live editing?
            
            Would you like me to implement a "Scroll to New Node" feature so that when a new row is created, the Translation Manager automatically scrolls to ensure the new row is visible?
            */
            // console.log("NODE_SYNCNODE_SYNC",data)

            if (data.prevId) {
              const prevIndex = __items.findIndex((i) => i.id === data.prevId)
              if (prevIndex !== -1) {
                // Found neighbor! Insert right after.
                __items.splice(prevIndex + 1, 0, newUnit)
              } else {
                // Neighbor exists in Editor but not in Manager (e.g., it was an image or empty)
                // Fallback: Add to the end of the list rather than the top to avoid "jumping"
                __items.push(newUnit)
              }
            } else {
              // If it truly has no prevId, it is the first node in the document
              __items.unshift(newUnit)
            }
          }
        }
      } else if (type === 'NODE_DELETED') {
        // Remove the item from the list
        const index = __items.findIndex((item) => item.id === id)
        if (index !== -1) {
          console.log('❌ Removing deleted node from translation list:', id)
          __items.splice(index, 1)

          // Also clean up stale tracking
          if (staleNodeIds.has(id)) {
            staleNodeIds.delete(id)
            staleNodeIds = new Set(staleNodeIds)
          }
        }
      }
      // Optimization: Check if the update is actually different before triggering Svelte reactivity
      else if (type === 'SYNC_FROM_FULL_VIEW') {
        const item = __items.find((i) => i.id === id)
        if (item && item.translatedHtml !== html) {
          // Direct mutation of Svelte 5 proxy is efficient
          item.translatedHtml = html
          item.translatedJson = json

          // We don't mark as "Outdated" (yellow) because this came from
          // the translator (Full View), not the source (Main Editor).
          item.isStale = false
          staleNodeIds.delete(id)
          staleNodeIds = new Set(staleNodeIds)
        }
      } else if (type === 'PRE_RENDER_COMPLETE') {
        const item = __items.find((i) => i.id === id)
        if (item) item.originalHtml = html
      }
      // This is what actually triggers the disk write
      else if (type === 'DISK_WRITE_BATCH') {
        const { changes } = e.data
        console.log('💾 TranslationSyncControllerImpl Worker sending batch to Electron:', changes)
        saveTranslationBatch(changes)
        // Replace 'window.api.saveBatch' with your actual Electron bridge function
        /* if (window.api && window.api.saveTranslationBatch) {
          window.api
            .saveTranslationBatch(changes)
            .then(() => console.log('✅ Batch saved successfully'))
            .catch((err) => console.error('❌ Save failed:', err))
        } else {
          console.error("Electron Bridge 'saveTranslationBatch' is missing!")
        } */
      }
    }
    _worker.port.onmessage = handleWorkerMessage

    return () => {
      try {
        _worker.port.onmessage = null
      } catch {}
      try {
        observer.disconnect()
      } catch {}
    }
  })

  async function saveTranslationBatchWorking(changes) {
    // changes is: [ [nodeId, { json, translatedFilePath }], ... ]
    if (!changes || changes.length === 0) return null

    const { translatedFilePath } = changes[0][1]

    try {
      let doc = { type: 'doc', content: [] }

      // 1. Read existing Tiptap Doc
      if (await nodeApi.fsPromises.exists(translatedFilePath)) {
        const fileContent = await nodeApi.fsPromises.readFile(translatedFilePath, 'utf-8')
        try {
          doc = JSON.parse(fileContent)
        } catch (e) {
          console.error('Malformed Tiptap file. Initializing new doc structure.')
        }
      }

      // 2. Create a Map of the updates for O(1) lookup during the merge
      const updates = new Map(changes.map(([id, data]) => [id, data.json]))

      // 3. Update existing nodes or Add new ones
      // We map through the existing content and replace if the UUID matches
      let foundIds = new Set()

      doc.content = doc.content.map((node: any) => {
        const nodeUuid = node.attrs?.uuid
        if (updates.has(nodeUuid)) {
          foundIds.add(nodeUuid)
          return updates.get(nodeUuid) // Replace with the new JSON from the worker
        }
        return node // Keep original
      })

      // 4. If any IDs in the batch weren't found in the existing doc, append them
      updates.forEach((newNode, uuid) => {
        if (!foundIds.has(uuid)) {
          doc.content.push(newNode)
        }
      })

      // 5. Write back to disk using your debounced function
      const updatedContent = JSON.stringify(doc, null, 2)

      // Using your specific class method
      Utils.saveToFileDebounced(translatedFilePath, updatedContent, () => {
        console.log(`✅ Patched ${changes.length} nodes in Tiptap doc.`)
      })

      return { success: true }
    } catch (error) {
      console.error('Failed to batch save Tiptap doc:', error)
      return { success: false }
    }
  }
  async function saveTranslationBatch2(changes) {
    // 'changes' is an array of [nodeId, { json, filePath, translatedFilePath }]
    if (!changes || changes.length === 0) return null

    const { translatedFilePath } = changes[0][1]

    try {
      let existingData = {}

      // 1. Read existing file if it exists
      if (await nodeApi.fsPromises.exists(translatedFilePath)) {
        const fileContent = await nodeApi.fsPromises.readFile(translatedFilePath, 'utf-8')
        try {
          existingData = JSON.parse(fileContent)
        } catch (e) {
          console.error('Malformed translation file, starting fresh.')
          existingData = {}
        }
      }

      // 2. Patch only the changed nodes
      changes.forEach(([nodeId, data]) => {
        // We store the Tiptap JSON content under the nodeId key
        existingData[nodeId] = data.json
      })

      // 3. Write back to disk
      // Using stringify with null, 2 for readability, or no spaces for performance/size
      const updatedContent = JSON.stringify(existingData, null, 2)

      // Use your existing debounced utility
      Utils.saveToFileDebounced(translatedFilePath, updatedContent, () => {
        console.log(`✅ Successfully patched ${changes.length} nodes in ${translatedFilePath}`)
      })

      return { success: true }
    } catch (error) {
      console.error('Failed to batch save:', error)
      return { success: false, error: error.message }
    }
  }

  function handleAccept1(id: string) {
    staleNodeIds.delete(id)
    staleNodeIds = new Set(staleNodeIds)
    _worker.port.postMessage({ type: 'RESOLVE_STALE', id })
  }

  function handleAccept(id: string) {
    staleNodeIds.delete(id)
    staleNodeIds = new Set(staleNodeIds)

    // Notify worker that this specific node version is now 'resolved'
    _worker.port.postMessage({ type: 'RESOLVE_STALE', id })

    // Optional: Automatically start editing the node so the user can fix the translation
    const item = __items.find((i) => i.id === id)
    if (item) startEditing(item)
  }
</script>

<div id="editor-hidden-store" style="display: none;">
  <div bind:this={_editorEl} class="tiptap-editor-instance"></div>
</div>

<div class="adobe-shell">
  <header class="adobe-header">
    <div class="search-pill">
      <i class="ph-bold ph-magnifying-glass"></i>
      <input bind:value={searchTerm} placeholder={$_('Search...')} />
      <div class="keyboard-hint">{$_('⌘F')}</div>
    </div>

    <div class="header-metrics">
      <div class="metric">
        <span class="label">{$_('Total')}</span>
        <span class="value">{filteredItems.length.toLocaleString()}</span>
      </div>

      {#if needsTranslationCount > 0}
        <div class="metric" in:fly={{ y: -10 }}>
          <!-- <span class="label text-red-500">Same as original</span> -->
          <span class="label text-red-500">{$_('Needs Translation')}</span>
          <span class="value text-red-500">{needsTranslationCount}</span>
        </div>
      {/if}

      {#if outdatedCount > 0}
        <div class="metric" in:fly={{ y: -10 }}>
          <span class="label text-amber-500">{$_('Outdated')}</span>
          <span class="value text-amber-500">{outdatedCount}</span>
        </div>
      {/if}

      <button class="action-btn primary">
        <i class="ph-light ph-sparkle"></i>
        {$_('Auto-Translate')}
      </button>
    </div>

    <!-- <div class="header-metrics !hidden">
      <div class="metric">
        <span class="label">Total</span>
        <span class="value">{filteredItems.length.toLocaleString()}</span>
      </div>
      {#if staleNodeIds.size > 0}
        <div class="metric alert" in:fly={{ y: -10 }}>
          <span class="label">Outdated</span>
          <span class="value text-red-500">{staleNodeIds.size}</span>
        </div>
      {/if}
      {#if staleNodeIds.size > 0}
        <div class="metric alert" in:fly={{ y: -10 }}>
          <span class="label">Needs Translation</span>
          <span class="value text-red-500">{staleNodeIds.size}</span>
        </div>
      {/if}
      <button class="action-btn primary"><i class="ph-light ph-sparkle"></i> Auto-Translate</button>
    </div> -->
  </header>

  <main class="viewport-content">
    <!-- {JSON.stringify(filteredItems)} -->
    <!-- {JSON.stringify(__items)} -->

    <SvelteVirtualList items={filteredItems}>
      <!-- {#snippet renderItem(item)}
        <div
          class="translation-row"
          class:is-stale={staleNodeIds.has(item.id)}
          data-node-id={item.id}
          use:observeAction
        >
          <div class="col source-pane">
            <div class="pane-meta">
              <span class="node-id">NODE::{item.id.slice(0, 8)}</span>
              {#if staleNodeIds.has(item.id)}
                <button class="adobe-btn danger" onclick={() => handleAccept(item.id)}>
                  Sync Source
                </button>
              {/if}
            </div>
            <div class="prose-content">
              {@html item.originalHtml}
            </div>
          </div>

          <div class="col target-pane" onclick={() => startEditing(item)} role="presentation">
            <div class="pane-meta justify-end">
              <span class="status-badge" class:editing={editingId === item.id}>
                {editingId === item.id ? 'Editing' : 'Translated'}
              </span>
            </div>

            <div class="prose-content">
              {#if editingId === item.id}
                <div class="editor-portal" use:teleportEditor in:fade={{ duration: 100 }}></div>
              {:else}
                <div class="preview-text">
                  {#if item.translatedHtml}
                    {@html item.translatedHtml}
                  {:else}
                    <div class="adobe-shimmer-box">
                      <div class="shimmer-line w-full"></div>
                      <div class="shimmer-line w-2/3"></div>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/snippet} -->

      <!-- {#snippet renderItem(item)}
        {@const isUntranslated = !item.translatedHtml}
        <div
          class="translation-row"
          class:is-stale={staleNodeIds.has(item.id)}
          data-node-id={item.id}
          use:observeAction
        >
          <div class="col source-pane">
            <div class="pane-meta">
              <span class="node-id">ORIGINAL</span>
            </div>
            <div class="prose-content">
              {@html item.originalHtml}
            </div>
          </div>

          <div
            class="col target-pane"
            class:not-translated={isUntranslated}
            onclick={() => startEditing(item)}
            role="presentation"
          >
            <div class="pane-meta justify-end">
              {#if isUntranslated}
                <span class="text-[9px] text-red-500 font-bold uppercase tracking-widest">
                  <i class="ph-bold ph-warning-circle"></i> Untranslated
                </span>
              {/if}
            </div>

            <div class="prose-content">
              {#if editingId === item.id}
                <div class="editor-portal" use:teleportEditor in:fade={{ duration: 100 }}></div>
              {:else}
                <div class="preview-text">
                  {#if !isUntranslated}
                    {@html item.translatedHtml}
                  {:else}
                    <div class="untranslated-placeholder">
                      <span class="untranslated-label">Draft (Using Source)</span>
                      {@html item.originalHtml}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/snippet} -->

      <!-- {#snippet renderItem(item)}
                {@const isStale = staleNodeIds.has(item.id)}
{@const isMissing = !hasContent(item)}

        <div
          class="translation-row"
          class:is-stale={isStale}
          data-node-id={item.id}
          use:observeAction
        >
          <div class="col source-pane">
            <div class="pane-meta">
              <span class="node-id">SOURCE</span>
            </div>
            <div class="prose-content">
              {@html item.originalHtml}
            </div>
          </div>

          <div
            class="col target-pane"
            class:not-translated={isMissing}
            onclick={() => startEditing(item)}
            role="presentation"
          >
            <div class="pane-meta justify-end">
              {#if isMissing}
                <span class="status-badge-alert">
                  <i class="ph-light ph-warning-circle"></i> Needs Translation
                </span>
              {:else}
                <span class="status-badge" class:editing={editingId === item.id}>
                  {editingId === item.id ? 'Editing' : 'Verified'}
                </span>
              {/if}
            </div>

            <div class="prose-content">
              {#if editingId === item.id}
                <div class="editor-portal" use:teleportEditor in:fade={{ duration: 100 }}></div>
              {:else}
                <div class="preview-text" class:opacity-40={isMissing}>
                  {@html isMissing ? item.originalHtml : item.translatedHtml}
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/snippet} -->

      {#snippet renderItem(item)}
        {@const isStale = staleNodeIds.has(item.id)}
        <!-- {@const isMissing = !hasContent(item)} -->
        {@const isMissing = !hasContent(item)}
        <!-- || -->
        <!-- JSON.stringify(item.translatedJson) == JSON.stringify(item.originalJson) -->
        <!-- {@const item2 = __items.find((i) => i.id === item.id)} -->
        <!-- {JSON.stringify(item2)} -->
        <!-- {JSON.stringify(__items[item.id])} -->

        <div
          class="translation-row"
          class:is-stale={isStale}
          data-node-id={item.id}
          use:observeAction
          in:fade={{ duration: 400 }}
        >
          <div class="col source-pane" class:source-updated={isStale}>
            <div class="pane-meta">
              <span class="node-id">SOURCE {isStale ? '• UPDATED' : ''}</span>
            </div>
            <div class="prose-content">
              {@html item.originalHtml}
            </div>
          </div>

          <div
            class="col target-pane"
            class:not-translated={isMissing}
            class:outdated={isStale && !isMissing}
            onclick={() => startEditing(item)}
            role="presentation"
          >
            <!-- Comp  {JSON.stringify( item.translatedJson)} == { JSON.stringify(item.originalJson)} -->
            <div class="pane-meta justify-end">
              {#if editingId === item.id}
                <span class="status-badge editing">{$_('Editing')}</span>
              {:else if isStale && !isMissing}
                <span class="status-badge-outdated">
                  <i class="ph-light ph-clock-counter-clockwise"></i>
                  {$_('Outdated')}
                </span>
              {:else if isMissing}
                <span class="status-badge-alert">
                  <i class="ph-light ph-warning-circle"></i>
                  {$_('Needs Translation')}
                </span>
              {:else if JSON.stringify(item.translatedJson) == JSON.stringify(item.originalJson)}
                <span class="status-badge-alert">
                  <i class="ph-light ph-warning-circle"></i>
                  {$_('Same as original')}
                </span>
              {:else}
                <span class="status-badge">{$_('Verified')}</span>
              {/if}
            </div>

            <div class="prose-content">
              <!-- Comp {item.originalHtml} == {item.translatedHtml} -->

              {#if editingId === item.id}
                <div class="editor-portal" use:teleportEditor in:fade={{ duration: 100 }}></div>
              {:else}
                <div class="preview-text" class:opacity-40={isMissing}>
                  {@html isMissing ? item.originalHtml : item.translatedHtml}
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/snippet}

      <!-- {#snippet renderItem(item)}
        {@const isStale = staleNodeIds.has(item.id)}
        {@const isMissing = !hasContent(item)}

        <div class="translation-row" class:is-stale={isStale} data-node-id={item.id}>
          <div class="col source-pane" class:source-updated={isStale}>
            <div class="pane-meta">
              <span class="node-id">SOURCE {isStale ? '(UPDATED)' : ''}</span>
            </div>
            <div class="prose-content">
              {@html item.originalHtml}
            </div>
          </div>

          <div
            class="col target-pane"
            class:not-translated={isMissing}
            class:outdated={isStale}
            onclick={() => startEditing(item)}
          >
            <div class="pane-meta justify-end">
              {#if isStale}
                <span class="status-badge-outdated">
                  <i class="ph-light ph-clock-counter-clockwise"></i> Outdated
                </span>
              {:else if isMissing}
                <span class="status-badge-alert">Needs Translation</span>
              {/if}
            </div>
          </div>
        </div>
      {/snippet} -->
    </SvelteVirtualList>
  </main>

  <footer class="adobe-footer">
    <div class="zoom-controls">
      <i class="ph-bold ph-minus"></i>
      <span class="text-[10px] font-bold">100%</span>
      <i class="ph-bold ph-plus"></i>
    </div>
  </footer>
</div>

<style>
  .adobe-shell {
    @apply h-full w-full flex flex-col bg-[var(--color-base-100)] text-[var(--color-base-content)] overflow-hidden select-none;
    font-family: var(--brand-font-sans);
  }

  .adobe-header {
    @apply h-14 border-b border-white/5 bg-[#121212] flex items-center px-4 gap-6 flex-shrink-0;
  }

  /* 🟢 LAYOUT CORE: Fill available height */

  .search-pill {
    @apply flex-1 max-w-md bg-[color-mix(in_srgb,var(--color-base-white)_3%,transparent)] border border-white/10 h-9 rounded-full 
           flex items-center px-4 gap-3 focus-within:border-primary/50 transition-all;
  }

  .search-pill input {
    @apply bg-transparent border-none outline-none text-[13px] w-full placeholder:text-[var(--color-base-content)]/20;
  }

  .keyboard-hint {
    @apply text-[9px] font-black opacity-20 border border-white/20 px-1 rounded;
  }

  .header-metrics {
    @apply ml-auto flex items-center gap-6;
  }

  .metric {
    @apply flex flex-col items-end;
  }

  .metric .label {
    @apply text-[8px] font-black uppercase text-[var(--color-base-content)]/20 tracking-widest;
  }
  .metric .value {
    @apply text-[12px] font-mono font-bold leading-tight;
  }

  /* 🟢 SCROLLABLE AREA */
  /* .viewport-content {
    @apply flex-1 overflow-hidden bg-[#0d0d0d];
  }

  .translation-row {
    @apply grid grid-cols-2 border-b border-white/5 hover:bg-[color-mix(in_srgb,var(--color-base-white)_1%,transparent)] transition-colors;
    min-height: 240px;
  } */

  .col {
    @apply p-6 flex flex-col gap-4;
  }
  .source-pane {
    @apply border-r border-white/5 bg-[color-mix(in_srgb,var(--color-base-white)_1%,transparent)];
  }
  .target-pane {
    @apply cursor-text transition-all hover:bg-[color-mix(in_srgb,var(--color-base-white)_2%,transparent)];
  }

  /* Content Styling */
  .pane-meta {
    @apply flex items-center justify-between h-6 mb-2;
  }
  .node-id {
    @apply text-[10px] font-mono text-[var(--color-base-content)]/20 tracking-tighter;
  }

  .prose-content {
    @apply text-[14px] leading-relaxed text-[var(--color-base-content)]/80 antialiased;
  }

  /* Adobe Buttons */
  .action-btn {
    @apply flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold transition-all;
  }
  .action-btn.primary {
    @apply bg-[#0265D2] hover:bg-[#0373f3] text-[var(--color-base-content)];
  }

  .adobe-btn {
    @apply px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all;
  }
  .adobe-btn.danger {
    @apply bg-red-600/20 text-red-500 border border-red-500/30 hover:bg-red-600 hover:text-[var(--color-base-content)];
  }

  /* Stale State */
  .is-stale {
    @apply bg-red-500/[0.02];
  }
  .is-stale .source-pane {
    @apply border-l-2 border-l-red-600;
  }

  .viewport-content {
    @apply flex-1 overflow-hidden bg-[#0d0d0d];
  }

  .translation-row {
    @apply grid grid-cols-2 border-b border-white/5 hover:bg-[color-mix(in_srgb,var(--color-base-white)_1%,transparent)] transition-colors;
    min-height: 200px;
    contain: paint; /* Massive performance boost for virtual lists */
  }

  .col {
    @apply p-6 flex flex-col gap-4;
  }
  .source-pane {
    @apply border-r border-white/5 bg-[color-mix(in_srgb,var(--color-base-white)_1%,transparent)];
  }
  .target-pane {
    @apply cursor-text transition-all hover:bg-[color-mix(in_srgb,var(--color-base-white)_2%,transparent)];
  }

  /* Shimmer Loading State */
  .adobe-shimmer-box {
    @apply flex flex-col gap-2 opacity-20;
  }
  .shimmer-line {
    @apply h-4 rounded bg-gradient-to-r from-white/5 via-white/20 to-white/5;
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite linear;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* Status Badges */
  .status-badge {
    @apply text-[9px] px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-[var(--color-base-content)]/40 border border-white/10 font-bold transition-colors;
  }
  .status-badge.editing {
    @apply bg-primary/20 text-primary border-primary/40;
  }

  /* Teleported Editor Style */
  .editor-portal {
    @apply min-h-[150px] bg-[var(--color-base-100)] rounded border border-primary shadow-[0_0_15px_rgba(2,101,210,0.1)];
  }

  :global(.tiptap-editor-instance) {
    @apply p-4 h-full outline-none text-[14px] leading-relaxed;
  }

  /* @apply search-pill; and other styles from your original code */

  /* target-pane adjustments */
  .target-pane.not-translated {
    @apply bg-red-500/[0.03] border-l-2 border-l-red-500/50;
  }

  .untranslated-placeholder {
    @apply opacity-40 italic flex flex-col gap-2;
  }

  .untranslated-label {
    @apply text-[9px] font-black uppercase text-red-500 tracking-widest mb-1;
  }

  /* Red Alert Background for Untranslated Nodes */
  .target-pane.not-translated {
    @apply bg-red-500/[0.04] border-l-2 border-l-red-500/40;
  }

  .status-badge-alert {
    @apply text-[9px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-black uppercase tracking-widest;
  }

  /* Ensure the selection color in the editor looks like Adobe selection (Blue) */
  :global(.tiptap-editor-instance ::selection) {
    background: rgba(2, 101, 210, 0.4);
  }

  /* Make the placeholder original text look distinct */
  .preview-text.opacity-40 {
    @apply italic;
  }

  /* Source highlight when content just updated */
  .source-pane.source-updated {
    @apply border-l-2 border-l-blue-500 bg-blue-500/[0.02];
  }

  /* Target highlight for Outdated translations */
  .target-pane.outdated {
    @apply bg-amber-500/[0.04] border-l-2 border-l-amber-500/40;
  }

  .status-badge-outdated {
    @apply text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-black uppercase tracking-widest;
  }

  /* Smooth transition when a node becomes stale */
  .translation-row {
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease;
  }
</style>
