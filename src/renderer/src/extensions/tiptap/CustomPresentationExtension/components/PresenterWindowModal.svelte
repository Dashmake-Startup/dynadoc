<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { fade } from 'svelte/transition'
  import PresenterWindow from './PresenterWindow.svelte'
  import { dragMinimizedWindow } from '../../utils/utils'
  import { onMount } from 'svelte'
  import MinimizedPresenterViewport from './MinimizedPresenterViewport.svelte'
  import {
    currentSlide,
    nextSlide,
    presentation,
    previousSlide,
    syncFromPayload
  } from '../store/presentation.store'
  import type { PresentationPayload } from '../../../../utils/shared.type'

  let payload = $state<PresentationPayload>(null)
  let isMinimized = $state(false)
  let hasBeenDragged = $state(false)
  let showConfirmExit = $state(false)
  let popupBlocked = $state(false)

  // Constants for initial PiP placement
  // const PIP_W = 320
  const PIP_W = 500
  const PIP_H = 320
  // const PIP_H = 180
  const PADDING = 24

  let initialX = $derived(typeof window !== 'undefined' ? window.innerWidth - PIP_W - PADDING : 0)
  let initialY = $derived(typeof window !== 'undefined' ? window.innerHeight - PIP_H - PADDING : 0)

  function handleClose() {
    showConfirmExit = true
  }
  onMount(() => {
    console.log('resentationAPI.onMount', {})
    try {
      popupBlocked = sessionStorage.getItem('dynadoc:presentation:popupBlocked') === '1'
    } catch {
      popupBlocked = false
    }
    // snapshotKonva(editorRoot);

    // Web builds have no presenter API (window.presentationAPI stays
    // undefined): bail out instead of throwing inside onMount — an uncaught
    // error here breaks Svelte's effect flush and freezes unrelated UI.
    const presentationAPI = (window as any).presentationAPI
    if (!presentationAPI) return

    if (typeof presentationAPI.getInitialData === 'function') {
      presentationAPI
        .getInitialData()
        .then((data) => {
          if (data) {
            console.log('presentationAPI.getInitialData success', { data })
            payload = data
            syncFromPayload(payload)
          }
        })
        .catch((err) => {
          console.error('Failed to get initial presenter modal data:', err)
        })
    }

    presentationAPI.onData((data) => {
      console.log('resentationAPI.onData', { data })
      if (!data) return
      payload = data
      syncFromPayload(payload)
    })
    presentationAPI.onUpdate((data) => {
      console.log('resentationAPI.onUpdate', { data })
      if (!data) return
      if (!$presentation?.active && !payload) return
      payload = data
      syncFromPayload(payload)
    })

    /* window.presentationAPI.onUpdate((data) => {
      console.log('resentationAPI.onUpdate', { data })

      payload = data
      const currentIndex = data.currentIndex
      totalSlides.set(payload.pageCount)
      // currentSlide.set(currentIndex)

      presentation.update((p) => ({
        ...p,
        active: true
      }))
      goToSlide(currentIndex)
    }) */
  })
</script>

{#if payload && $presentation?.active}
  <div
    use:dragMinimizedWindow={{
      isMinimized,
      onDragStart: () => (hasBeenDragged = true)
    }}
    class={`fixed z-[999] bg-black/70 overflow-hidden flex items-center justify-center
    transition-all duration-400 ease-[cubic-bezier(0.2,1,0.2,1)]
    ${
      isMinimized
        ? `top-0 left-0 w-[${PIP_W}px] h-[${PIP_H}px] rounded-[4px] shadow-2xl border-2 border-white/10`
        : 'inset-0 w-full h-full backdrop-blur-md shadow-[0_0_0_100vmax_rgba(0,0,0,0.7)]'
    }`}
    style={isMinimized && !hasBeenDragged
      ? `transform: translate3d(${initialX}px, ${initialY}px, 0)`
      : ''}
  >
    <div
      class="drag-handle absolute top-0 left-0 right-0 h-10 z-1000 flex items-center justify-end px-4 cursor-grab bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 {isMinimized
        ? 'opacity-100'
        : 'opacity-0 hover:opacity-100'}"
    >
      <div class="flex items-center gap-2">
        <button
          onclick={() => (isMinimized = !isMinimized)}
          class="text-base-content/80 hover:text-blue-400 bg-transparent border-none cursor-pointer p-1"
        >
          <i class="text-lg ph-bold {isMinimized ? 'ph-corners-out' : 'ph-corners-in'}"></i>
        </button>
        <button
          onclick={() => {
            window.presentationAPI.focusOnPresentationWindow()
          }}
          class="text-base-content/80 hover:text-blue-400 bg-transparent border-none cursor-pointer p-1"
        >
          <i class="text-lg ph-bold {isMinimized ? 'ph-slideshow' : 'ph-slideshow'}"></i>
        </button>
        <div
          class="w-[1px] h-4 bg-[color-mix(in_srgb,var(--color-base-white)_50%,transparent)] mx-1"
        ></div>
        <button
          onclick={handleClose}
          class="text-base-content/70 hover:text-red-500 bg-transparent border-none cursor-pointer p-1 flex items-center"
        >
          <i class="ph-bold ph-x text-lg"></i>
        </button>
      </div>
    </div>

    {#if popupBlocked && !isMinimized}
      <div
        class="absolute top-12 right-4 z-1001 bg-black/70 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-base-content/80 flex items-center gap-2 shadow-lg"
      >
        <i class="ph-bold ph-warning text-yellow-400"></i>
        <span>{$_('Popup blocked. Open presentation tab?')}</span>
        <button
          class="btn btn-xs btn-primary"
          onclick={() => {
            window.presentationAPI.focusOnPresentationWindow()
          }}
        >
          Open
        </button>
        <button
          class="btn btn-xs btn-ghost"
          onclick={() => {
            popupBlocked = false
            try {
              sessionStorage.removeItem('dynadoc:presentation:popupBlocked')
            } catch {}
          }}
        >
          Dismiss
        </button>
      </div>
    {/if}

    {#if showConfirmExit}
      <div
        transition:fade={{ duration: 150 }}
        class="absolute inset-0 z-2000 flex items-center justify-center bg-black/80 backdrop-blur-sm rd-6"
      >
        <div class="bg-base-100 p-6 rd-4 border border-white/10 shadow-2xl max-w-sm text-center">
          <h3 class="text-base-content text-lg font-600 mb-2">{$_('End Presentation?')}</h3>
          <p class="text-base-content/60 text-sm mb-6">{$_('Choose how you want to exit.')}</p>
          <div class="flex gap-3 justify-center">
            <button
              onclick={() => {
                showConfirmExit = false
              }}
              class="px-4 py-2 rd-2 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-base-content hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] border-none cursor-pointer"
              >Stay</button
            >
            <button
              onclick={() => {
                payload = null
                presentation.update((p) => ({ ...p, active: false }))
                showConfirmExit = false
              }}
              class="px-4 py-2 rd-2 bg-red-600 text-base-content hover:bg-red-700 border-none cursor-pointer font-600"
              >Close Presenter</button
            >
            <button
              onclick={() => {
                window.presentationAPI.stop('all')
                payload = null
                presentation.update((p) => ({ ...p, active: false }))
                showConfirmExit = false
              }}
              class="px-4 py-2 rd-2 bg-red-700 text-base-content hover:bg-red-800 border-none cursor-pointer font-600"
              >Stop All</button
            >
          </div>
        </div>
      </div>
    {/if}

    <!-- <div
    class="transition-all duration-300 {isMinimized
      ? 'w-full h-full'
      : 'w-[95%] h-[90%] rd-4 overflow-hidden shadow-2xl'}"
    class:pointer-events-none={isMinimized}
  >
    <PresenterWindow {isMinimized} {payload} />
  </div> -->

    <div
      class="transition-all duration-500 {isMinimized
        ? 'w-full h-full'
        : 'w-[95%] h-[92%] rd-3 overflow-hidden shadow-2xl'}"
      class:pointer-events-none={isMinimized}
    >
      {#if isMinimized}
        <div transition:fade={{ duration: 180 }} class="w-full h-full">
          <MinimizedPresenterViewport {payload} index={$currentSlide} />
        </div>
      {:else}
        <div transition:fade={{ duration: 180 }} class="w-full h-full bg-[#1d232a]">
          <PresenterWindow {isMinimized} {payload} />
        </div>
      {/if}
    </div>

    {#if isMinimized}
      <div
        transition:fade={{ duration: 200 }}
        class="absolute bottom-3 -translate-x-1/2 flex items-center gap-2 z-1001 bg-black/40 backdrop-blur-md p-1.5 rd-full border border-white/10"
      >
        <button
          onclick={() => {
            console.log('navigatenavigatenavigate previousSlide click')
            previousSlide()
            // nextSlide()
          }}
          class="w-8 h-8 rd-full bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-base-content flex items-center justify-center border-none hover:bg-[color-mix(in_srgb,var(--color-base-white)_20%,transparent)] transition-all cursor-pointer"
        >
          <i class="ph-bold ph-caret-left text-sm"></i>
        </button>
        <!-- <button
        onclick={() => window.presentationAPI.navigate(currentIndex + 1)}
        class="w-8 h-8 rd-full bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-base-content flex items-center justify-center border-none hover:bg-[color-mix(in_srgb,var(--color-base-white)_20%,transparent)] transition-all cursor-pointer"
      > -->
        <button
          onclick={() => {
            console.log('navigatenavigatenavigate nextSlide click')

            nextSlide()
          }}
          class="w-8 h-8 rd-full bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-base-content flex items-center justify-center border-none hover:bg-[color-mix(in_srgb,var(--color-base-white)_20%,transparent)] transition-all cursor-pointer"
        >
          <i class="ph-bold ph-caret-right text-sm"></i>
        </button>
      </div>
    {/if}
  </div>
{/if}
