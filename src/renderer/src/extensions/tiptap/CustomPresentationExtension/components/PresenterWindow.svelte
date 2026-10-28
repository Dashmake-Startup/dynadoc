<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onDestroy, onMount } from 'svelte'
  import {
    bufferedSlides,
    nextSlide,
    previousSlide,
    presentation,
    syncFromPayload
  } from '../store/presentation.store'
  import PresenterViewport from './PresenterViewport.svelte'
  import { fade } from 'svelte/transition'

  // let { isMinimized } = $props() // Passed via URL params or props
  let { payload, isMinimized } = $props()
  // export let editorRoot: HTMLElement


  onMount(() => {
    console.log('resentationAPI.onMount', {})
    // snapshotKonva(editorRoot);

    if (typeof window.presentationAPI.getInitialData === 'function') {
      window.presentationAPI.getInitialData().then((data) => {
        if (data) {
          console.log('presentationAPI.getInitialData success', { data })
          payload = data
          syncFromPayload(payload)
        }
      }).catch((err) => {
        console.error('Failed to get initial presenter data:', err)
      })
    }

    window.presentationAPI.onData((data) => {
      console.log('resentationAPI.onData', { data })
      payload = data
      syncFromPayload(payload)
    })
    window.presentationAPI.onUpdate((data) => {
      console.log('resentationAPI.onUpdate', { data })

      payload = data
      syncFromPayload(payload)
    })

    // const breaks = editorRoot.querySelectorAll('.rm-page-break')
    // totalSlides.set(breaks.length + 1)

    // editorHTML = editorRoot.innerHTML

    /* window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        window.presentationAPI.navigate(currentIndex + 1)
      }
      // if (e.key === 'ArrowRight' || e.key === ' ') next()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'Escape') exit()
      console.log('keydown , ', { e, payload, currentIndex })
    }) */

    // let currentIndex = 0

    const onKeyDown = (e: KeyboardEvent) => {
      if (!payload || isMinimized) return // Disable keys if minimized to avoid conflict with editor

      switch (e.key) {
        case ' ':
        case 'ArrowRight':
          e.preventDefault()
          // window.presentationAPI.navigate(currentIndex + 1)
          nextSlide()
          break

        case 'ArrowLeft':
          e.preventDefault()
          // window.presentationAPI.navigate(currentIndex - 1)
          previousSlide()
          break

        case 'Escape':
          exit()
          break
      }
    }

    /* const onKeyDown = (e: KeyboardEvent) => {
      if (!payload || isMinimized) return // Disable keys if minimized to avoid conflict with editor
      if (e.key === 'ArrowRight') window.presentationAPI.navigate(currentIndex + 1)
      if (e.key === 'ArrowLeft') window.presentationAPI.navigate(currentIndex - 1)
    } */

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  })

  onDestroy(() => {
    presentation.update((p) => ({
      ...p,
      active: false
    }))
  })

  function exit() {
    // unmount / close window
  }
</script>

{#if payload}
  <!-- <div class="presentation-root"> -->
  <div class="w-full h-full bg-black flex justify-center items-center overflow-hidden">
    <div class="w-full h-full relative inset-0 bg-black flex justify-center items-center">
    <!-- <div
      class="relative w-[{payload.pageWidth}px] h-[{payload.pageHeight}px] overflow-hidden bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] shadow-2xl"
      style="width: {payload.pageWidth}px; height: {payload.pageHeight}px; 
           transform: scale({isMinimized ? 0.25 : 1});"
    > -->
      {#each $bufferedSlides as i (i)}
        <PresenterViewport {payload} index={i} />
      {/each}
    </div>
  </div>

  {#if isMinimized}
    <div
      transition:fade={{ duration: 200 }}
      class="absolute bottom-3 -translate-x-1/2 flex items-center gap-2 z-1001 bg-black/40 backdrop-blur-md p-1.5 rd-full border border-white/10"
    >
      <!-- <button
        onclick={() => window.presentationAPI.navigate(currentIndex - 1)}
        class="w-8 h-8 rd-full bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-base-content flex items-center justify-center border-none hover:bg-[color-mix(in_srgb,var(--color-base-white)_20%,transparent)] transition-all cursor-pointer"
      > -->
      <button
        onclick={() => previousSlide()}
        class="w-8 h-8 rd-full bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-base-content flex items-center justify-center border-none hover:bg-[color-mix(in_srgb,var(--color-base-white)_20%,transparent)] transition-all cursor-pointer"
      >
        <i class="ph-bold ph-caret-left text-sm"></i>
      </button>
      <!-- <button
        onclick={() => window.presentationAPI.navigate(currentIndex + 1)}
        class="w-8 h-8 rd-full bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-base-content flex items-center justify-center border-none hover:bg-[color-mix(in_srgb,var(--color-base-white)_20%,transparent)] transition-all cursor-pointer"
      > -->
      <button
        onclick={() => nextSlide()}
        class="w-8 h-8 rd-full bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-base-content flex items-center justify-center border-none hover:bg-[color-mix(in_srgb,var(--color-base-white)_20%,transparent)] transition-all cursor-pointer"
      >
        <i class="ph-bold ph-caret-right text-sm"></i>
      </button>
    </div>
  {/if}
{/if}

<style>
  .presentation-root {
    /* position: fixed; */
    inset: 0;
    background: #1d232a;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 80px;
  }
</style>
