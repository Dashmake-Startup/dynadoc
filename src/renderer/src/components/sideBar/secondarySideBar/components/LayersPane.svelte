<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onDestroy, onMount, untrack } from 'svelte'
  import { _$_wysiwygEditorsList } from '../../../../stores/editor.store'
  import { NodeSelection, TextSelection } from '@tiptap/pm/state'
  import type { Editor } from '@tiptap/core'
  import type { Node as PMNode } from '@tiptap/pm/model'

  type LayerItem = {
    id: string
    pos: number
    nodeSize: number
    depth: number
    nodeType: string
    label: string
    parentPos: number | null
    indexInParent: number
  }

  // --- STATE (Svelte 5 Runes) ---
  let query = $state('')
  let selectedLayerId = $state<string | null>(null)
  let draggingLayerId = $state<string | null>(null)
  let dragOverLayerId = $state<string | null>(null)
  let dragOverPlacement = $state<'before' | 'after'>('before')
  let hiddenLayerIds = $state<Set<string>>(new Set())
  let lockedLayerIds = $state<Set<string>>(new Set())
  let isolateLayerId = $state<string | null>(null)
  let layers = $state<LayerItem[]>([])

  // Virtual List state
  let scrollTop = $state(0)
  let containerHeight = $state(0)
  const ITEM_HEIGHT = 32

  // --- DERIVED (Svelte 5 Runes) ---
  const activeEditorEntryStore = _$_wysiwygEditorsList.getActive()
  let activeEditorEntry = $derived($activeEditorEntryStore)
  let editor = $derived(activeEditorEntry?.editor ?? null)



  const filteredLayers = $derived.by(() => {
    const lower = query.trim().toLowerCase()
    return layers.filter((layer) => {
      const isIsolated = isolateLayerId ? layer.id === isolateLayerId : true
      const matches =
        !lower ||
        layer.label.toLowerCase().includes(lower) ||
        layer.nodeType.toLowerCase().includes(lower)
      return isIsolated && matches
    })
  })

  // Virtual List Calculations
  let startIndex = $derived(Math.floor(scrollTop / ITEM_HEIGHT))
  let endIndex = $derived(
    Math.min(filteredLayers.length, startIndex + Math.ceil(containerHeight / ITEM_HEIGHT) + 5)
  )
  let visibleLayers = $derived(filteredLayers.slice(startIndex, endIndex))
  let totalContentHeight = $derived(filteredLayers.length * ITEM_HEIGHT)
  let offsetY = $derived(startIndex * ITEM_HEIGHT)

  const labelCandidates = [
    'name',
    'title',
    'label',
    'filename',
    'fileName',
    'path',
    'src',
    'key',
    'id'
  ]

  // --- LOGIC ---
  const isLayerableNode = (node: PMNode): boolean => {
    if (!node || node.type.name === 'doc' || node.isText || node.isInline) return false
    return node.isBlock || node.isAtom || node.isLeaf
  }

  const getNodeLabel = (node: PMNode, pos: number): string => {
    const attrs = node.attrs ?? {}
    for (const key of labelCandidates) {
      if (typeof attrs[key] === 'string' && attrs[key].trim()) {
        const val = attrs[key].split(/[\\/]/).pop() || attrs[key]
        return val.length > 64 ? `${val.slice(0, 61)}...` : val
      }
    }
    return node.textContent?.trim().slice(0, 64) || `${node.type.name} @${pos}`
  }

  const getLayerIconClass = (type: string): string => {
    const v = type.toLowerCase()
    if (v.includes('slide')) return 'i-theme-workflow:project'
    if (v.includes('table') || v.includes('spreadsheet')) return 'i-theme-workflow:table'
    if (v.includes('image')) return 'i-theme-workflow:image'
    return 'i-theme-workflow:layers'
  }

  // --- SYNC ENGINE (Debounced & Untracked to prevent loops) ---
  let syncTimer: any = null
  const syncLayersFromEditor = () => {
    if (!editor) {
      layers = []
      return
    }

    clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      untrack(() => {
        const nextLayers: LayerItem[] = []
        editor!.state.doc.descendants((node, pos, parent, index) => {
          if (!isLayerableNode(node)) return true
          nextLayers.push({
            id: `${pos}:${node.type.name}`,
            pos,
            nodeSize: node.nodeSize,
            depth: editor!.state.doc.resolve(pos).depth,
            nodeType: node.type.name,
            label: getNodeLabel(node, pos),
            parentPos:
              parent?.type?.name === 'doc'
                ? null
                : editor!.state.doc.resolve(pos).before(editor!.state.doc.resolve(pos).depth),
            indexInParent: index
          })
          return true
        })

        // const reversed = nextLayers.reverse()
        const reversed = nextLayers
        // Only trigger update if count or ID order changed
        if (layers.length !== reversed.length || layers[0]?.id !== reversed[0]?.id) {
          layers = reversed
        }

        const anchor = editor!.state.selection.anchor
        const sel = layers.find((l) => anchor >= l.pos && anchor <= l.pos + l.nodeSize)
        if (selectedLayerId !== sel?.id) selectedLayerId = sel?.id ?? null
      })
    }, 100)
  }

  // --- EFFECTS ---
  $effect(() => {
    const currentEditor = editor
    if (!currentEditor) return

    const onTransaction = () => syncLayersFromEditor()
    currentEditor.on('transaction', onTransaction)
    syncLayersFromEditor()

    return () => {
      currentEditor.off('transaction', onTransaction)
      clearTimeout(syncTimer)
    }
  })

  // --- ACTIONS ---
  const selectLayer = (layer: LayerItem) => {
    if (!editor || hiddenLayerIds.has(layer.id)) return
    const tr = editor.state.tr
    const node = editor.state.doc.nodeAt(layer.pos)
    if (!node) return

    tr.setSelection(NodeSelection.create(editor.state.doc, layer.pos))
    editor.view.dispatch(tr)
    editor.commands.focus()
  }

  const deleteLayer = (layer: LayerItem) => {
    if (!editor || lockedLayerIds.has(layer.id)) return
    editor.view.dispatch(editor.state.tr.delete(layer.pos, layer.pos + layer.nodeSize))
  }

  const handleDragStart = (e: DragEvent, layer: LayerItem) => {
    if (lockedLayerIds.has(layer.id)) return e.preventDefault()
    draggingLayerId = layer.id
    e.dataTransfer?.setData('text/layer-id', layer.id)
  }

  const handleDragOver1 = (e: DragEvent, layer: LayerItem) => {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragOverPlacement = e.clientY - rect.top > rect.height / 2 ? 'after' : 'before'
    dragOverLayerId = layer.id
  }

  const handleDragOver = (e: DragEvent, layer: LayerItem) => {
  if (draggingLayerId === layer.id) return // Don't show drop indicator on self
  e.preventDefault()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  dragOverPlacement = e.clientY - rect.top > rect.height / 2 ? 'after' : 'before'
  dragOverLayerId = layer.id
}

  // --- ACTIONS ---
  const handleDrop = (e: DragEvent, targetLayer: LayerItem) => {
    e.preventDefault()
    const draggedId = e.dataTransfer?.getData('text/layer-id')
    if (!draggedId || draggedId === targetLayer.id) {
      dragOverLayerId = null
      return
    }

    const sourceLayer = layers.find((l) => l.id === draggedId)
    if (!sourceLayer || !editor) return

    moveLayer(sourceLayer, targetLayer, dragOverPlacement)

    // Reset visual indicators
    dragOverLayerId = null
    draggingLayerId = null
  }

  const moveLayer = (source: LayerItem, target: LayerItem, placement: 'before' | 'after') => {
    if (!editor) return

    const { state, view } = editor
    const tr = state.tr

    // 1. Get the node to be moved
    const nodeToMove = state.doc.nodeAt(source.pos)
    if (!nodeToMove) return

    // 2. Calculate the drop position
    // If dropping 'after', position is target start + target size
    let dropPos = placement === 'before' ? target.pos : target.pos + target.nodeSize

    // 3. Perform the move
    // We delete the source and insert at the new position.
    // ProseMirror handles position mapping automatically if we do it in order.
    tr.delete(source.pos, source.pos + source.nodeSize)

    // Map the drop position because deleting the source might have shifted the target
    const mappedDropPos = tr.mapping.map(dropPos)

    tr.insert(mappedDropPos, nodeToMove)

    // 4. Set selection to the newly moved node so the user sees where it went
    tr.setSelection(NodeSelection.create(tr.doc, mappedDropPos))

    view.dispatch(tr)
    editor.commands.focus()
  }
</script>

<div
  class="h-full flex flex-col bg-base-200 text-base-content/80 border-l border-base-content/10 select-none overflow-hidden antialiased"
>
  <div class="flex items-center justify-between px-3 py-2 bg-base-300/60 border-b border-base-content/10">
    <div class="flex items-center gap-2">
      <div class="i-theme-workflow:layers w-3.5 h-3.5 text-primary"></div>
      <span class="text-[10px] font-bold uppercase tracking-widest text-base-content">{$_('Layers')}</span>
    </div>
    <span class="text-[9px] text-base-content/45 tabular-nums">{filteredLayers.length} Items</span>
  </div>

  <div class="p-2 flex flex-col gap-2 bg-base-200 border-b border-base-content/10">
    <div class="relative group">
      <div
        class="absolute left-2 top-1/2 -translate-y-1/2 i-theme-workflow:search w-3 h-3 text-base-content/35"
      ></div>
      <input
        bind:value={query}
        type="text"
        placeholder={$_('Filter layers...')}
        class="w-full bg-base-100 border border-base-content/15 rounded-sm pl-7 pr-2 py-1 text-[11px] outline-none focus:border-primary transition-colors"
      />
    </div>
  </div>

  <div
    class="flex-grow overflow-y-auto bg-base-100 relative scroll-smooth"
    onscroll={(e) => (scrollTop = (e.target as HTMLElement).scrollTop)}
    bind:clientHeight={containerHeight}
  >
    {#if !editor}
      <div class="p-4 text-[11px] text-base-content/40 italic">{$_('Waiting for editor...')}</div>
    {:else}
      <div class="relative w-full" style:height="{totalContentHeight}px">
        <div class="absolute top-0 left-0 w-full" style:transform="translateY({offsetY}px)">
          {#each visibleLayers as layer (layer.id)}
            <div
              draggable={!lockedLayerIds.has(layer.id)}
              ondragstart={(e) => handleDragStart(e, layer)}
              ondragover={(e) => handleDragOver(e, layer)}
              ondragleave={() => {
                if (dragOverLayerId === layer.id) dragOverLayerId = null
              }}
              ondrop={(e) => handleDrop(e, layer)}
              onclick={() => selectLayer(layer)}
              class="group relative flex items-center h-8 border-b border-base-content/10 cursor-pointer transition-colors
         {selectedLayerId === layer.id
                ? 'bg-base-content/12 border-l-2 border-l-primary'
                : 'hover:bg-base-content/6'}
         {draggingLayerId === layer.id ? 'opacity-20' : ''}"
            >
              {#if dragOverLayerId === layer.id}
                <div
                  class="absolute left-0 right-0 h-0.5 bg-primary z-50 pointer-events-none"
                  style:top={dragOverPlacement === 'before' ? '0' : 'auto'}
                  style:bottom={dragOverPlacement === 'after' ? '0' : 'auto'}
                ></div>
              {/if}

              <button
                onclick={(e) => {
                  e.stopPropagation()
                  hiddenLayerIds.has(layer.id)
                    ? hiddenLayerIds.delete(layer.id)
                    : hiddenLayerIds.add(layer.id)
                }}
                class="w-8 h-full flex items-center justify-center border-r border-base-content/10 opacity-40 hover:opacity-100"
              >
                <div
                  class="{hiddenLayerIds.has(layer.id)
                    ? 'i-theme-workflow:visibility-hide text-base-content/40'
                    : 'i-theme-workflow:visibility-show text-base-content/75'} w-3.5 h-3.5"
                ></div>
              </button>

              <div
                class="flex items-center flex-grow gap-2 px-2 overflow-hidden"
                style="padding-left: {Math.max(0, layer.depth - 1) * 12 + 8}px"
              >
                <div
                  class="{getLayerIconClass(layer.nodeType)} w-3.5 h-3.5 flex-shrink-0 text-base-content/55"
                ></div>
                <span
                  class="text-[11px] truncate {selectedLayerId === layer.id
                    ? 'text-base-content'
                    : 'text-base-content/70'} {hiddenLayerIds.has(layer.id) ? 'opacity-40 line-through' : ''}"
                >
                  {layer.label}
                </span>
              </div>

              <div class="hidden group-hover:flex items-center gap-2 pr-2 opacity-60">
                <button
                  onclick={(e) => {
                    e.stopPropagation()
                    deleteLayer(layer)
                  }}
                  class="i-theme-workflow:delete w-3 h-3 hover:text-red-400"
                ></button>
              </div>
            </div>

            <!-- <div
              draggable={!lockedLayerIds.has(layer.id)}
              ondragstart={(e) => handleDragStart(e, layer)}
              ondragover={(e) => handleDragOver(e, layer)}
              ondrop={() => { /* Implement Move Logic */ dragOverLayerId = null }}
              onclick={() => selectLayer(layer)}
              class="group relative flex items-center h-8 border-b border-#252525 cursor-pointer transition-colors
                     {selectedLayerId === layer.id ? 'bg-#373737 border-l-2 border-l-primary' : 'hover:bg-#2a2a2a'}"
            >
              {#if dragOverLayerId === layer.id}
                <div class="absolute w-full h-0.5 bg-primary z-10 {dragOverPlacement === 'before' ? 'top-0' : 'bottom-0'}"></div>
              {/if}

              <button 
                onclick={(e) => { e.stopPropagation(); (hiddenLayerIds.has(layer.id) ? hiddenLayerIds.delete(layer.id) : hiddenLayerIds.add(layer.id)) }}
                class="w-8 h-full flex items-center justify-center border-r border-#252525 opacity-40 hover:opacity-100"
              >
                <div class="{hiddenLayerIds.has(layer.id) ? 'i-theme-workflow:visibility-hide text-#666' : 'i-theme-workflow:visibility-show text-#ccc'} w-3.5 h-3.5"></div>
              </button>

              <div class="flex items-center flex-grow gap-2 px-2 overflow-hidden" style="padding-left: {Math.max(0, layer.depth - 1) * 12 + 8}px">
                <div class="{getLayerIconClass(layer.nodeType)} w-3.5 h-3.5 flex-shrink-0 text-#9ca3af"></div>
                <span class="text-[11px] truncate {selectedLayerId === layer.id ? 'text-base-content' : 'text-#aaa'} {hiddenLayerIds.has(layer.id) ? 'opacity-40 line-through' : ''}">
                  {layer.label}
                </span>
              </div>

              <div class="hidden group-hover:flex items-center gap-2 pr-2 opacity-60">
                <button onclick={(e) => { e.stopPropagation(); deleteLayer(layer) }} class="i-theme-workflow:delete w-3 h-3 hover:text-red-400"></button>
              </div>
            </div> -->
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div
    class="p-1.5 border-t border-base-content/10 bg-base-300/55 flex items-center justify-between px-3 text-[9px] text-base-content/45 uppercase tracking-tighter"
  >
    <span>{isolateLayerId ? 'Isolate Mode' : 'Standard'}</span>
    <span class="flex items-center gap-1">
      <div class="w-1.5 h-1.5 rounded-full {editor ? 'bg-green-500' : 'bg-red-500'}"></div>
      {editor ? 'Live' : 'Offline'}
    </span>
  </div>
</div>

<style>
  :global(.custom-scrollbar::-webkit-scrollbar) {
    width: 4px;
  }
  :global(.custom-scrollbar::-webkit-scrollbar-thumb) {
    background: rgba(var(--theme-text-rgb), 0.24);
    border-radius: 2px;
  }
</style>
