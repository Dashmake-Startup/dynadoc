

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { fade, slide, fly } from 'svelte/transition'
  import { spectrumIcons } from '../../../../../../components/common/icons/Icons'

  import type { WysiwygEditorEntry } from '../../../../../../stores/editor.store'
  import type { WysiwygEditorNodeviewEntry } from '../../../../../../stores/editor.store'
  import {
    _$_documentEditorsList,
    _$_wysiwygEditorsList
  } from '../../../../../../stores/editor.store'
  import type { CanvasLayer } from '../../../utils/utils'
  import * as Y from 'yjs'
  import type { Shape } from '../../../../../../utils/canvas.utils'
  import type { CanvasCommands } from '../../../../../../commands/canvasCommands'
  import { _$_canvasCommands } from '../../../../../../stores/canvas.store'

  // --- 1. Primitive State ---
  let searchQuery = $state('')
  let opacityValue = $state(100)
  let filterActive = $state(false)

  // --- 2. Derived Editor Logic ---
  const activeDocumentEditorStore = _$_documentEditorsList.getActive()
  let _activeEditor = $derived($activeDocumentEditorStore)

  // let _activeWysiwyg = $derived(
  //   _activeEditor ? _$_wysiwygEditorsList.getEntry(_activeEditor.id) : null
  // )
  let _activeWysiwyg = $derived(
    _activeEditor ? _$_wysiwygEditorsList.getEntryStore(_activeEditor?.id.toString()) : null
    // _activeEditor ? _$_wysiwygEditorsList.getEntry(_activeEditor.id.toString()) : null
  )

  let _activeNodeview = $derived(
    _activeWysiwyg ? _$_wysiwygEditorsList.getActiveNodeviewStore($_activeWysiwyg?.id) : null
  )

  function handleOpacityChange(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value)
    opacityValue = isNaN(val) ? 100 : Math.min(100, Math.max(0, val))
    if (!_canvasCommands) return
    const ids = _canvasCommands.getSelectedIds()
    if (!ids.length) return
    const nextOpacity = opacityValue / 100
    ids.forEach((id) => {
      _canvasCommands.updateShape(id, { opacity: nextOpacity })
    })
  }

  // Get the Y.js map reference reactively
  let _shapes = $derived($_activeNodeview?.collaborativeCanvas?.shapes)

  // --- 3. The "Sync" replacement: Reactive Layers ---
  // We use a local state that we update only when Y.js actually emits an event
  let _layers = $state<CanvasLayer[]>([])

  // This function transforms Y.js data to Svelte State
  function updateLayers() {
    console.log('syncPosition updateLayers', { _shapes })

    if (!_shapes) {
      _layers = []
      return
    }
    _layers = Array.from(_shapes.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      thumbnail: data.thumbnail,
      shape: data,
      selected: data.selected,
      visible: data.visible,
      z: data.z
    }))
  }

  // --- 4. Effects for Side Effects ONLY ---

  // Handle Y.js Observation
  // --- 4. Effects for Side Effects ONLY ---

  $effect(() => {
    // 1. Explicitly track the shapes reference
    const currentShapes = _shapes

    // Log to verify the effect is even triggering
    console.log('syncPosition Layer Effect Triggered. Shapes Present:', !!currentShapes)

    if (currentShapes) {
      // 2. Define a stable wrapper for the observer
      // Yjs passes an event object to the callback
      const handleYjsChange = () => {
        console.log('syncPosition Yjs Map Change Detected')
        updateLayers()
      }

      // 3. Initial sync
      updateLayers()

      // 4. Attach observer
      currentShapes.observe(handleYjsChange)

      // 5. Cleanup function
      return () => {
        console.log('syncPosition Cleaning up Yjs observer')
        currentShapes.unobserve(handleYjsChange)
      }
    } else {
      // Reset if shapes are lost (e.g. switching editor)
      _layers = []
    }
  })

  // Handle Command Subscription
  let _canvasCommands = $state<CanvasCommands | null>(null)
  $effect(() => {
    const id = $_activeNodeview?.id
    if (id) {
      const unsubscribe = _$_canvasCommands.subscribeById(id).subscribe((cmds) => {
        _canvasCommands = cmds
      })
      return () => unsubscribe()
    }
  })

  // Final filtered list for the UI
  let groupedLayers = $derived(
    _layers.filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  $effect(() => {
    if (!_canvasCommands) return
    const ids = _canvasCommands.getSelectedIds()
    if (!ids.length) return
    const active = _layers.find((layer) => layer.id === ids[0])
    if (!active) return
    const currentOpacity = active.shape?.opacity
    if (typeof currentOpacity === 'number') {
      opacityValue = Math.round(currentOpacity * 100)
    } else {
      opacityValue = 100
    }
  })
</script>

<aside
  class="adobe-layers-panel flex flex-col h-full bg-base-200 text-base-content select-none font-sans overflow-hidden"
>
  <div class="px-2 py-1.5 border-b border-base-content/10 bg-base-300/55 flex items-center justify-between">
    <div class="flex items-center gap-2 flex-1">
      <i class="ph-bold ph-magnifying-glass text-[10px] text-base-content/30"></i>
      <input
        bind:value={searchQuery}
        placeholder={$_('Filter Layers...')}
        class="bg-transparent border-none outline-none text-[10px] text-base-content/65 placeholder:text-base-content/20 w-full"
      />
    </div>
    <button
      class="size-5 flex items-center justify-center rounded hover:bg-base-content/5 transition-colors"
      class:text-primary={filterActive}
      onclick={() => (filterActive = !filterActive)}
    >
      <i class="ph-light ph-funnel text-[11px]"></i>
    </button>
  </div>

  <div class="p-2 border-b border-base-content/10 flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <div
        class="flex items-center gap-1.5 text-[10px] font-black uppercase text-base-content/40 tracking-tighter"
      >
        <span>{$_('Mode:')}</span>
        <button class="text-base-content/80 hover:text-base-content flex items-center gap-1">
          {$_('Normal')} <i class="ph-bold ph-caret-down text-[8px]"></i>
        </button>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-[9px] font-bold text-base-content/20 mr-1">{$_('LOCK')}</span>
        {#each ['ph-lock-simple', 'ph-paint-brush-broad', 'ph-arrows-out-cardinal', 'ph-frame-corners'] as icon}
          <button
            class="size-4 flex items-center justify-center text-base-content/30 hover:text-base-content transition-colors"
          >
            <i class="ph-bold {icon} text-[11px]"></i>
          </button>
        {/each}
      </div>
    </div>

    <div class="flex items-center gap-2">
      <span class="text-[9px] font-black text-base-content/40 w-12">{$_('OPACITY')}</span>
      <div class="flex-1 h-[2px] bg-base-content/10 relative rounded-full overflow-hidden group">
        <div class="absolute inset-y-0 left-0 bg-primary" style="width: {opacityValue}%"></div>
      </div>
      <input
        type="text"
        value="{opacityValue}%"
        oninput={handleOpacityChange}
        class="w-8 bg-base-content/8 border border-base-content/10 text-[9px] text-center font-mono text-base-content/80 rounded-[2px]"
      />
    </div>
  </div>

  <div class="flex-1 overflow-y-auto no-scrollbar bg-base-100">
    {#each groupedLayers as layer, i (layer.id)}
      <div
        class="adobe-layer-row group transition-all duration-150"
        class:selected={layer.selected}
        onclick={() => _canvasCommands.select(layer.id)}
      >
        <button
          class="w-8 h-full flex items-center justify-center text-base-content/20 hover:text-base-content transition-colors"
          onclick={(e) => {
            e.stopPropagation()
            _canvasCommands.toggleVisibility(layer.id)
          }}
        >
          <span class="size-4">
            {@html layer.visible
              ? spectrumIcons.spectrumIconVisibility
              : spectrumIcons.spectrumIconVisibilityOff}
          </span>
        </button>

        <div class="relative py-1">
          <div
            class="size-9 bg-base-content/8 rounded border border-base-content/10 flex items-center justify-center overflow-hidden"
          >
            {#if layer.thumbnail}
              <span class="{layer.thumbnail} text-base-content/40 text-lg"></span>
            {:else}
              <div class="size-full bg-gradient-to-br from-base-content/10 to-transparent"></div>
            {/if}
          </div>
          {#if i === 0}
            <div
              class="absolute -top-0.5 -right-0.5 size-2 bg-primary rounded-full border border-[#252525] shadow-[0_0_5px_#0265D2]"
            ></div>
          {/if}
        </div>

        <div class="flex flex-col flex-1 pl-3 overflow-hidden">
          <span
            class="text-[12px] font-bold tracking-tight truncate {layer.selected
              ? 'text-base-content'
              : 'text-base-content/80'}"
          >
            {layer.name}
          </span>
          {#if layer.selected}
            <div transition:slide class="flex items-center gap-2 mt-0.5">
              <span class="text-[8px] font-black text-primary uppercase">{$_('Active Element')}</span>
              <span class="text-[8px] font-mono text-base-content/20 truncate">Z-INDEX: {layer.z}</span>
            </div>
          {/if}
        </div>

        <div class="pr-3 text-base-content/10 group-hover:text-base-content/40 transition-colors">
          <i class="ph-bold ph-dots-six-vertical"></i>
        </div>
      </div>
    {/each}
  </div>

  <div class="h-10 bg-base-300/55 border-t border-base-content/10 flex items-center justify-around px-2">
    <button class="footer-icon-btn" title={$_('AI Layer Assist')}>
      <i class="ph-light ph-sparkle text-primary"></i>
    </button>
    <div class="w-px h-4 bg-base-content/10"></div>
    <button class="footer-icon-btn" title={$_('Add Layer Effect')}>{$_('fx')}</button>
    <button class="footer-icon-btn" title={$_('Add Mask')}
      ><i class="ph-bold ph-circle-half-tilt"></i></button
    >
    <button class="footer-icon-btn" title={$_('New Group')}
      ><i class="ph-bold ph-folder-simple-plus"></i></button
    >
    <button class="footer-icon-btn" title={$_('New Layer')}><i class="ph-bold ph-plus"></i></button>
    <button
      class="footer-icon-btn text-red-500/50 hover:text-red-500"
      onclick={() => {
        _canvasCommands.deleteSelected()
      }}><i class="ph-bold ph-trash"></i></button
    >
  </div>
</aside>

<style>
  .adobe-layer-row {
    @apply flex items-center h-12 border-b border-[var(--color-base-content)]/10 cursor-pointer;
    background: linear-gradient(90deg, transparent 0%, transparent 100%);
  }

  .adobe-layer-row.selected {
    @apply bg-primary/10;
    border-left: 2px solid #0265d2;
  }

  .footer-icon-btn {
    @apply text-[var(--color-base-content)]/40 hover:text-[var(--color-base-content)] transition-all text-sm font-bold active:scale-90;
  }

  /* Custom mini scrollbar */
  .no-scrollbar::-webkit-scrollbar {
    width: 3px;
  }
  .no-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(var(--theme-text-rgb), 0.12);
    border-radius: 10px;
  }

  :root {
    --primary: #0265d2;
  }
</style>
