

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import {
    animationCount,
    animationStep,
    currentSlide,
    pageHeight,
    pageWidth,
    presentation,
    totalSlides,
    visibleSlideIndexes
  } from '../store/presentation.store'
  import { animateSlideIn } from '../utils/utils'
  import type { PresentationPayload } from '../../../../utils/shared.type'
  import ZoomWrapper from '../../../../components/app/editor/components/display/ZoomWrapper.svelte'
  import gsap from 'gsap'
  import { get } from 'svelte/store'
  import { playAnimation } from '../../CustomAnimationExtension/utils/utils'

  // export let payload: PresentationPayload | null = null
  // export let index: number
  let { payload, index } = $props()
  //   let { items = [], width = 'w-72', header = '' }: Props = $props();

  // --- Presenter View Features ---
  let timer = $state(0)
  let timerInterval: any
  let showNotes = $state(true)
  let startTime = Date.now()
  let clock = $state(new Date().toLocaleTimeString())

  // --- Animation Logic ---
  let timelines: gsap.core.Timeline[] = []
  let lastStep = 0
  let viewportEl: HTMLElement
  let nextViewportEl: HTMLElement
  let currentScale = $state(1)
  let nextScale = $state(1)

  // Timer logic
  onMount(() => {
    timerInterval = setInterval(() => {
      timer = Math.floor((Date.now() - startTime) / 1000)
      clock = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }, 1000)
  })

  onDestroy(() => clearInterval(timerInterval))

  function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Sync animations
  // $: if ($presentation.active && timelines.length) {
  //   syncAnimations($animationStep)
  // }

  $effect(() => {
    if ($presentation.active && timelines.length) {
      syncAnimations($animationStep)
    }
  })
  function syncAnimations(step: number) {
    if (step > lastStep) {
      for (let i = lastStep; i < step; i++) timelines[i]?.play()
    } else if (step < lastStep) {
      for (let i = lastStep - 1; i >= step; i--) timelines[i]?.reverse()
    }
    lastStep = step
  }

  // let viewportEl: HTMLElement
  let payloadEl: HTMLElement
  let activeIndex = 0
  let actualIndex = $derived.by(() => {
    return $visibleSlideIndexes?.[index] ?? index
  })

  let nextVisibleIndex = $derived.by(() => {
    const max = Math.max(0, $totalSlides - 1)
    return Math.min(index + 1, max)
  })

  let nextActualIndex = $derived.by(() => {
    return $visibleSlideIndexes?.[nextVisibleIndex] ?? nextVisibleIndex
  })

  function computeScale(target: HTMLElement | null) {
    if (!payload || !target) return 1
    const sourceHeight = payload.pageHeight || pageHeight || 1
    const targetHeight = target.clientHeight || 1
    return targetHeight / sourceHeight
  }

  function updateScales() {
    currentScale = computeScale(viewportEl)
    nextScale = computeScale(nextViewportEl)
  }

  function zoomToSlide(index: number) {
    const slides = payloadEl.querySelectorAll<HTMLElement>('.slide-absolute')
    const slide = slides[index]
    if (!slide) return

    const vpRect = viewportEl.getBoundingClientRect()
    const sRect = slide.getBoundingClientRect()
    const pRect = payloadEl.getBoundingClientRect()

    // slide position relative to payload
    const slideX = sRect.left - pRect.left
    const slideY = sRect.top - pRect.top

    const scale = Math.min(vpRect.width / sRect.width, vpRect.height / sRect.height)

    const translateX = vpRect.width / 2 - (slideX + sRect.width / 2) * scale

    const translateY = vpRect.height / 2 - (slideY + sRect.height / 2) * scale

    payloadEl.style.transform = `
    translate(${translateX}px, ${translateY}px)
    scale(${scale})
  `
  }

  onMount(() => {
    const targets = Array.from(
      viewportEl.querySelectorAll<HTMLElement>('[data-animation]') ?? []
    ).sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order))
    animationCount.set(targets.length)
    animationStep.set(0)
    timelines = targets.map((el) => {
      let gsapTimeline = gsap.timeline({ paused: true })
      playAnimation(el, gsapTimeline, el.dataset.type ?? 'fade-in')
      return gsapTimeline
    })

    const observer = new ResizeObserver(() => updateScales())
    if (viewportEl) observer.observe(viewportEl)
    if (nextViewportEl) observer.observe(nextViewportEl)
    updateScales()

    return () => observer.disconnect()
  })

  $effect(() => {
    if (payload) {
      updateScales()
    }
  })
</script>

<div
  class="relativee w-full h-full inset-0 bg-base-100 flex flex-col font-sans select-none overflow-hidden text-[#ccc]"
>
  <header
    class="h-12 bg-base-200 border-b bg-base-400 flex items-center justify-between px-4"
  >
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-2">
        <div class="i-theme-workflow:play w-4 h-4 text-primary"></div>
        <span class="text-[10px] font-bold uppercase tracking-widest text-base-content"
          >{$_('Presenter Mode')}</span
        >
      </div>
      <div class="flex items-center gap-4 border-l border-[#3e3e3e] pl-6">
        <div class="flex flex-col">
          <span class="text-[9px] uppercase text-[#888] font-bold">{$_('Elapsed')}</span>
          <span class="text-sm font-mono text-primary leading-tight">{formatTime(timer)}</span>
        </div>
        <div class="flex flex-col">
          <span class="text-[9px] uppercase text-[#888] font-bold">{$_('Local Time')}</span>
          <span class="text-sm font-mono text-base-content leading-tight">{clock}</span>
        </div>
      </div>
    </div>

    <div class="flex gap-2">
      <button class="theme-top-btn" onclick={() => (startTime = Date.now())}>Reset Timer</button>
      <button class="theme-top-btn text-base-content bg-primary border-transparent hover:bg-[#1473e6]"
        >{$_('End Show')}</button
      >
    </div>
  </header>

  <main class="flex-grow grid grid-cols-[1fr_400px] gap-px bg-base-100 overflow-auto">
    <section class="flex flex-col p-6 bg-base-100 overflow-hidden">
      <div class="flex justify-between items-end mb-2">
        <span class="text-[10px] font-bold uppercase text-[#888]"
          >Current Slide: {$currentSlide + 1}</span
        >
      </div>
      <div
        class="relative flex-grow flex items-center justify-center bg-base-200 border border-[#3e3e3e] shadow-2xl rounded-sm overflow-hidden"
        style="max-width:{pageWidth}px;max-height:{pageHeight}px"
      >
        <ZoomWrapper>
          <!-- <div
            bind:this={el}
            class="slide-viewport editor-content m-auto bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] relative shadow-lg"
            style="width:{pageWidth}px;height:{pageHeight}px"
          >
          
            <div
              class="absolute top-0 left-0 w-full will-change-transform"
              style="transform: translateY(-{index * payload.pageHeight}px);"
            >
              {@html payload.html}
            </div>
          </div> -->

          <div
            bind:this={viewportEl}
            class="slide-viewport editor-content relative overflow-hidden bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] shadow-lg"
            style="width:100%;height:100%;max-width:{pageWidth}px;max-height:{pageHeight}px"
          >
            <div
              class="absolute top-0 left-0 w-full h-full flex items-start justify-center will-change-transform"
            >
              <div
                class="slide-scale"
                style="transform: translateY(-{actualIndex * payload.pageHeight}px) scale({currentScale}); transform-origin: top;"
              >
                {@html payload.html}
              </div>
            </div>
          </div>
        </ZoomWrapper>
      </div>

      <div class="mt-4 flex justify-center gap-4">
        <button class="theme-nav-btn"
          ><div class="i-theme-workflow:chevron-left w-6 h-6"></div></button
        >
        <div class="px-6 py-2 bg-base-200 border border-[#3e3e3e] rounded-full text-xs font-bold">
          Slide {$currentSlide + 1} of {$totalSlides || '??'}
        </div>
        <button class="theme-nav-btn"
          ><div class="i-theme-workflow:chevron-right w-6 h-6"></div></button
        >
      </div>
    </section>

    <aside class="flex flex-col bg-base-100 border-l bg-base-400">
      <div class="p-4 border-b bg-base-400">
        <span class="text-[10px] font-bold uppercase text-[#888] mb-2 block">{$_('Next Slide')}</span>
        <div
          class="aspect-video bg-black border border-[#3e3e3e] overflow-hidden rounded-sm relative opacity-80 scale-95 origin-top"
        >
          <!-- <div
            class="absolute inset-0 pointer-events-none origin-top-left"
            style="transform: scale(0.35);"
          > -->
          <div
            bind:this={nextViewportEl}
            class="absolute inset-0 pointer-events-none origin-top flex items-start justify-center"
          >
            <div
              class="bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] slide-scale"
              style="transform: translateY(-{nextActualIndex * payload.pageHeight}px) scale({nextScale}); transform-origin: top;"
            >
              {@html payload.html}
            </div>
          </div>
        </div>
      </div>

      <div class="flex-grow flex flex-col overflow-hidden">
        <div
          class="px-4 py-2 bg-base-200 border-b bg-base-400 flex justify-between items-center"
        >
          <span class="text-[10px] font-bold uppercase tracking-widest">{$_('Presenter Notes')}</span>
          <div class="flex gap-2">
            <button class="i-theme-workflow:text-size-increase w-3 h-3 opacity-50 hover:opacity-100"
            ></button>
            <button class="i-theme-workflow:text-size-decrease w-3 h-3 opacity-50 hover:opacity-100"
            ></button>
          </div>
        </div>
        <div
          class="p-4 flex-grow overflow-y-auto custom-scrollbar text-sm leading-relaxed text-[#aaa]"
        >
          {#if payload.notes}
            {@html payload.notes}
          {:else}
            <span class="italic opacity-30">{$_('No notes for this slide.')}</span>
          {/if}
        </div>
      </div>
    </aside>
  </main>
</div>

<style lang="postcss">
  .theme-top-btn {
    @apply px-3 py-1 bg-[var(--color-base-200)] border bg-[var(--color-base-400)] rounded-sm text-[11px] font-medium hover:bg-[#454545] transition-colors;
  }
  .theme-nav-btn {
    @apply p-2 rounded-full hover:bg-[var(--color-base-200)] text-[#959595] hover:text-[var(--color-base-content)] transition-all active:scale-90;
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 2px;
  }

  .slide-viewport {
    overflow: hidden;
    background: white;
    position: relative;
  }

  .slide-content {
    position: absolute;
    top: 0;
    left: 0;
    will-change: transform;
  }
  .slide-scale {
    display: inline-block;
  }
</style>
