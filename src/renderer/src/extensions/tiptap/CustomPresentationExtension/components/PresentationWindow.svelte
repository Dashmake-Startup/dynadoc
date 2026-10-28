<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onDestroy, onMount } from 'svelte'
  import SlideViewport from './SlideViewport.svelte'
  import {
    bufferedSlides,
    nextSlide,
    previousSlide,
    presentation,
    syncFromPayload
  } from '../store/presentation.store'
  import type { PresentationPayload } from '../../../../utils/shared.type'

  // export let editorRoot: HTMLElement
  // let { payload } = $props();

  // let payload: PresentationPayload | null = $state(null)
  let payload = $state<PresentationPayload>(null)

  /* onMount(() => {
    console.log('resentationAPI.onMount', { })
    // snapshotKonva(editorRoot);
    window.presentationAPI.onData((data) => {
      console.log('resentationAPI.onData', { data })
      payload = data
      // currentIndex = data.currentIndex
      totalSlides.set(payload.pageCount)

      presentation.update((p) => ({
        ...p,
        active: true
      }))
    })
    window.presentationAPI.onUpdate((data) => {
      console.log('resentationAPI.onUpdate', { data })

      payload = data
      // currentIndex = data.currentIndex
      totalSlides.set(payload.pageCount)

      presentation.update((p) => ({
        ...p,
        active: true
      }))
    })

    // const breaks = editorRoot.querySelectorAll('.rm-page-break')
    // totalSlides.set(breaks.length + 1)

    // editorHTML = editorRoot.innerHTML

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') next()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'Escape') exit()
      console.log('keydown , ', { e, payload, currentIndex })
    })
  }) */

  onMount(() => {
    console.log('resentationAPI.onMount', {})
    // snapshotKonva(editorRoot);

    if (typeof window.presentationAPI.getInitialData === 'function') {
      window.presentationAPI
        .getInitialData()
        .then((data) => {
          if (data) {
            console.log('presentationAPI.getInitialData success', { data })
            payload = data
            syncFromPayload(payload)
          }
        })
        .catch((err) => {
          console.error('Failed to get initial presentation data:', err)
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
      if (!payload) return

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
  <div class="fixed inset-0 bg-black flex justify-center items-center">
    <div
      class="relative w-[{payload.pageWidth}px] h-[{payload.pageHeight}px] overflow-hidden bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] shadow-2xl"
    >
      {#each $bufferedSlides as i (i)}
        <SlideViewport {payload} index={i} />
      {/each}
    </div>
  </div>
{/if}

<style>
  .presentation-root {
    position: fixed;
    inset: 0;
    background: #1d232a;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 80px;
  }
</style>
