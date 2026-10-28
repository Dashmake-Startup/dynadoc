<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import {
    animationCount,
    animationStep,
    currentSlide,
    pageHeight,
    pageWidth,
    presentation,
    visibleSlideIndexes
  } from '../store/presentation.store'
  import { animateSlideIn } from '../utils/utils'
  import type { PresentationPayload } from '../../../../utils/shared.type'
  import ZoomWrapper from '../../../../components/app/editor/components/display/ZoomWrapper.svelte'
  import gsap from 'gsap'
  import { get } from 'svelte/store'
  import { playAnimation } from '../../CustomAnimationExtension/utils/utils'
  let { payload = null, index }: { payload?: PresentationPayload | null; index: number } = $props()

  let timelines: gsap.core.Timeline[] = []
  let lastStep = 0

  // let animations: Element[] = []
  // let animations: HTMLElement[] = []
  let currentStep = 0

  let el: HTMLElement

  // $: playUpTo($animationStep)

  /* onMount(() => {
    // animateSlideIn(el)

    animations = Array.from(el.querySelectorAll('[data-animation]')).sort(
      (a, b) => Number(a.dataset.order) - Number(b.dataset.order)
    )

    // Hide all initially
    animations.forEach((el) => {
      gsap.set(el, { autoAlpha: 0 })
    })

    animationCount.set(animations.length)
    animationStep.set(0)
  }) */
  $effect(() => {
    if ($presentation.active && timelines.length) {
      syncAnimations($animationStep)
    }
  })

  currentSlide.subscribe(() => {
    if (get(presentation).active) {
      animationStep.set(0)
    }
  })

  function syncAnimations(step: number) {
    if (step > lastStep) {
      for (let i = lastStep; i < step; i++) {
        timelines[i]?.play()
      }
    } else if (step < lastStep) {
      for (let i = lastStep - 1; i >= step; i--) {
        timelines[i]?.reverse()
      }
    }
    lastStep = step
  }

  console.log('payloadpayload,', { payload })

  onMount(() => {
    const targets = Array.from(el.querySelectorAll<HTMLElement>('[data-animation]')).sort(
      (a, b) => Number(a.dataset.order) - Number(b.dataset.order)
    )

    animationCount.set(targets.length)
    animationStep.set(0)

    timelines = targets.map((el) => {
      const type = el.dataset.type ?? 'fade-in'
      let gsapTimeline = gsap.timeline({ paused: true })
      // let tl = gsap.timeline({ paused: true })

      // gsapTimeline =
      playAnimation(el, gsapTimeline, type)

      /* switch (type) {
        case 'fly-in':
          tl.fromTo(el, { x: -50, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.6 })
          break
        case 'zoom-in':
          tl.fromTo(el, { scale: 0.8, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5 })
          break
        default:
          tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 })
      } */

      // return tl
      return gsapTimeline
    })
  })
</script>

<ZoomWrapper>
  <div
    class="slide-viewport editor-content m-auto"
    bind:this={el}
    style="width:{payload.pageWidth}px;height:{payload.pageHeight}px"
  >
    <!-- <div
    class="slide-viewport editor-content m-auto"
    bind:this={el}
    style="width:{pageWidth}px;height:{pageHeight}px"
  > -->
    <!-- <div
    class="slide-content"
    style="transform: translateY(-{index * pageHeight}px);"
  > -->
    <div
      class="absolute top-0 left-0 w-full will-change-transform"
      style="transform: translateY(-{($visibleSlideIndexes?.[index] ?? index) *
        payload.pageHeight}px);"
      use:animateSlideIn
    >
      {@html payload.html}
    </div>
  </div>
</ZoomWrapper>

<style>
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
</style>
