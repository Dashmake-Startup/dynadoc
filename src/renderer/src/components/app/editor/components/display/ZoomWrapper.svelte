<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { _ } from 'svelte-i18n'
  import {
    registerZoomControls,
    unregisterZoomControls,
    forceZoomControlsVisibilitySync
  } from './zoomControlsRegistry'
  import { _$_documentEditorsList } from '../../../../../stores/editor.store'
  import type { DocumentEditorModel } from '../../../../../models/Document'

  // Props in Svelte 5
  let { __zoomControlContainer = null, __zoomKey = null, min = 10, max = 400, step = 10 } = $props()
  const activeDocumentEditorStore = _$_documentEditorsList.getActive()
  let _activeEditor = $state<DocumentEditorModel | null>(null)

  $effect(() => {
    _activeEditor = $activeDocumentEditorStore
  })

  const MIN_ZOOM = min
  const MAX_ZOOM = max

  let controlsEl = $state<HTMLElement | null>(null)
  let containerEl = $state<HTMLElement>()
  let contentEl = $state<HTMLElement>()

  let zoom = $state(100)
  let originX = $state(50)
  let originY = $state(50)

  let scale = $derived(zoom / 100)
  let zoomLabel = $derived(Math.round(zoom))
  let presetSteps = [25, 50, 75, 100, 125, 150, 200, 300, 400]

  // Use an effect to attach the listener manually with { passive: false }
  $effect(() => {
    if (containerEl) {
      containerEl.addEventListener('wheel', handleWheel, { passive: false })

      // Return a cleanup function to remove the listener
      return () => {
        containerEl?.removeEventListener('wheel', handleWheel)
      }
    }
    // return false
  })

  function clampZoom(value: number) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
  }

  function setZoom(value: number) {
    zoom = clampZoom(value)
  }

  function zoomIn() {
    setZoom(zoom + step)
  }

  function zoomOut() {
    setZoom(zoom - step)
  }

  function fitToWindow() {
    if (!containerEl) return
    const target = contentEl?.firstElementChild as HTMLElement | null
    const contentWidth = target?.scrollWidth || containerEl.clientWidth
    const contentHeight = target?.scrollHeight || containerEl.clientHeight
    if (!contentWidth || !contentHeight) return
    const scaleFactor = Math.min(
      containerEl.clientWidth / contentWidth,
      containerEl.clientHeight / contentHeight
    )
    originX = 50
    originY = 50
    setZoom(scaleFactor * 100)
  }
  function handleWheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault() // This works now!

    // Your zoom math here...
    const rect = containerEl!.getBoundingClientRect()
    originX = ((event.clientX - rect.left) / rect.width) * 100
    originY = ((event.clientY - rect.top) / rect.height) * 100
    const delta = event.deltaY < 0 ? step : -step
    setZoom(zoom + delta)
  }

  onMount(() => {
    if (__zoomControlContainer && controlsEl) {
      __zoomControlContainer.appendChild(controlsEl)
      registerZoomControls(
        __zoomKey || __zoomControlContainer.id || __zoomControlContainer,
        controlsEl
      )
      forceZoomControlsVisibilitySync()
    }
  })

  onDestroy(() => {
    if (__zoomControlContainer && controlsEl) {
      unregisterZoomControls(
        __zoomKey || __zoomControlContainer.id || __zoomControlContainer,
        controlsEl
      )
      if (__zoomControlContainer.contains(controlsEl)) {
        __zoomControlContainer.removeChild(controlsEl)
      }
    }
  })
</script>

<div class="zoom-container" bind:this={containerEl} style="touch-action: none;">
  <div
    class="zoom-content"
    bind:this={contentEl}
    style="
      transform: scale({scale}); 
      transform-origin: {originX}% {originY}%;
    "
  >
    <slot />
  </div>
</div>

<!-- {#if false} -->
<!-- zk={__zoomKey}&&aid
{_activeEditor?.uuid} ---
{JSON.stringify (_activeEditor)} -->
{#if __zoomControlContainer}
  <!-- {#if  _activeEditor?.uuid === __zoomKey}
true {_activeEditor?.uuid}
{:else}
false
ucao ceremonie, geometre, video demo dynadoc
{/if}
{#if  _activeEditor?.uuid === __zoomKey} -->
  <div bind:this={controlsEl} class="flex items-center h-full px-3 gap-2 hidden">
    <button
      ondblclick={() => setZoom(100)}
      onclick={() => setZoom(100)}
      class="w-10 text-right font-mono text-[10px] hover:text-base-content cursor-pointer"
    >
      {zoomLabel}%
    </button>

    <div class="flex items-center gap-2 group">
      <button onclick={zoomOut} class="opacity-50 hover:opacity-100">
        <i class="ph-bold ph-minus"></i>
      </button>

      <div class="relative w-20 h-0.5 bg-[#333]">
        <div
          class="absolute h-full bg-base-variant"
          style="width: {(zoom / MAX_ZOOM) * 100}%"
        ></div>
        <!-- <div class="absolute h-full bg-orange-500" style="width: {(zoomLevel / MAX_ZOOM) * 100}%"></div> -->
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          bind:value={zoom}
          class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      <button onclick={zoomIn} class="opacity-50 hover:opacity-100">
        <i class="ph-bold ph-plus"></i>
      </button>
    </div>

    <button
      onclick={fitToWindow}
      class="ml-2 flex items-center justify-center w-7 h-full hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] transition-colors"
      title={$_('Fit slide to current window')}
    >
      <i class="ph-bold ph-frame-corners text-[14px]"></i>
    </button>

    <!-- <div class="flex items-center gap-1 ml-2">
      {#each presetSteps as preset}
        <button
          onclick={() => setZoom(preset)}
          class="text-[9px] px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)]"
        >
          {preset}%
        </button>
      {/each}
    </div> -->
  </div>
  <!-- {/if} -->
{/if}

<style>
  .zoom-container {
    width: 100%;
    height: 100%;
    /* overflow: hidden; */
    /* Ensure the container is the relative parent */
    position: relative;
  }

  .zoom-content {
    width: 100%;
    height: 100%;
    /* Using transition: transform can feel laggy for mouse wheel zoom.
       Consider removing it or reducing duration for wheel events specifically.
    */
    transition: transform 0.1s ease-out;
    will-change: transform;
  }

  .zoom-controls-container.hidden {
    display: none !important;
  }

  /* Custom Adobe Slider Styling */
  .theme-range-slider {
    @apply absolute w-full appearance-none bg-transparent cursor-pointer z-10;
  }

  /* The Thumb - Classic Adobe Square Thumb */
  .theme-range-slider::-webkit-slider-thumb {
    @apply appearance-none w-2 h-4 bg-[#bbb] border bg-[var(--color-base-400)] rounded-[1px] hover:bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] active:bg-primary transition-colors shadow-sm;
    margin-top: -1px; /* Center alignment */
  }

  .theme-range-slider::-moz-range-thumb {
    @apply w-2 h-4 bg-[#bbb] border bg-[var(--color-base-400)] rounded-[1px] hover:bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] active:bg-primary transition-colors;
  }

  /* Remove default focuses */
  .theme-range-slider:focus {
    outline: none;
  }

  /* Input range thumb cleanup for Photoshop feel */
  input[type='range']::-webkit-slider-thumb {
    appearance: none;
    height: 12px;
    width: 12px;
  }
</style>
