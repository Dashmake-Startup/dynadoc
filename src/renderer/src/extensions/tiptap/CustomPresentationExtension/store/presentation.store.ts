import { writable, derived, get } from 'svelte/store';
import type { PresentationPayload } from '../../../utils/shared.type';
// import { playAnimation } from '../../CustomAnimationExtension/utils/utils';

// export type Presentation = {
//   active: false,
//   index: 0,
//   pageCount: 0,
//   html: '',
// }

export const presentation = writable<Presentation>({
  active: false,
  index: 0,
  pageCount: 0,
  html: '',
})


export type Presentation = {
  active: boolean
  index: number
  pageCount: number
  html: string
}

// export const presentation = writable<Presentation>({
//   active: false,
//   index: 0,
//   pageCount: 0,
//   html: '',
// })

export const pageHeight = 450;
export const pageWidth = 794;
// export const pageHeight = 1123;
// export const pageWidth = 794;
export const animationStep = writable(0)
export const animationCount = writable(0)
// export const animations = writable<Element>([])



// Total pages in the document (includes hidden pages)
export const totalPages = writable(0);
// Total visible slides (excludes hidden pages)
export const totalSlides = writable(0);
export const currentSlide = writable(0);
export const hiddenPages = writable<number[]>([]);

export const visibleSlideIndexes = derived(
  [hiddenPages, totalPages],
  ([$hidden, $total]) => {
    const hiddenSet = new Set($hidden ?? []);
    const total = Math.max(0, $total);
    const visible: number[] = [];
    for (let i = 0; i < total; i += 1) {
      if (!hiddenSet.has(i + 1)) {
        visible.push(i);
      }
    }
    return visible.length ? visible : Array.from({ length: total }, (_, i) => i);
  }
);

const SLIDE_BUFFER = 0
export const bufferedSlides = derived(
  [currentSlide, totalSlides],
  ([$current, $total]) => {
    const max = Math.max(0, $total - 1)
    const start = Math.max(0, $current - SLIDE_BUFFER)
    const end = Math.min(max, $current + SLIDE_BUFFER)
    const slides: number[] = []
    for (let i = start; i <= end; i += 1) slides.push(i)
    return slides
  }
);

export function nextSlide() {
    console.log("navigatenavigatenavigate nextSlide enter")

  const slide = get(currentSlide);
  const visible = get(visibleSlideIndexes);
  const actualIndex = visible[slide] ?? slide;

  window.presentationAPI.navigate(actualIndex + 1)
  console.log("navigatenavigatenavigate nextSlide",
    { slide }
  )
  // currentSlide.update(i => i + 1);
}
export function previousSlide() {
  const slide = get(currentSlide);
  const visible = get(visibleSlideIndexes);
  const actualIndex = visible[slide] ?? slide;

  // currentSlide.update(i => i - 1);
  window.presentationAPI.navigate(actualIndex - 1)
  console.log("navigatenavigatenavigate previousSlide",
    { slide }
  )

}

export function next() {
  const step = get(animationStep);
  const count = get(animationCount);
  const slide = get(currentSlide);
  const total = get(totalSlides);

  // 1️⃣ Play animation if available
  if (count > 0 && step < count) {
    animationStep.set(step + 1);
    console.log('▶ animation', { step: step + 1, count });
    return;
  }

  // 2️⃣ Go to next slide
  if (slide < total - 1) {
    currentSlide.set(slide + 1);
    animationStep.set(0);
    console.log('➡ slide', slide + 1);
  }

  // window.presentationAPI.sendData(IPC_PRESENTATION_UPDATE,
  //                             payload)
}


export function next2() {
  const step = get(animationStep)
  const count = get(animationCount)
  const slide = get(currentSlide)
  const total = get(totalSlides)

  // 1️⃣ Play next animation
  if (step < count) {
    animationStep.update(s => s + 1)
    // playAnimation(animations[currentStep])
    const step2 = get(animationStep)

    console.log('next , ', { step, step2, count, slide, total })
    return
  }

  // 2️⃣ Go to next slide
  if (slide < total - 1) {

    currentSlide.set(slide + 1)
    animationStep.set(0)
    const slide2 = get(currentSlide)

    console.log('next , ', { step, slide2, count, slide, total })

  }
}
export function prev() {
  const step = get(animationStep);
  const slide = get(currentSlide);

  // 1️⃣ Reverse animation
  if (step > 0) {
    animationStep.set(step - 1);
    console.log('◀ animation', step - 1);
    return;
  }

  // 2️⃣ Go to previous slide
  if (slide > 0) {
    currentSlide.set(slide - 1);
    animationStep.set(0);
    console.log('⬅ slide', slide - 1);
  }
}

export function prev1() {
  const step = get(animationStep)
  const slide = get(currentSlide)

  // 1️⃣ Reverse animation
  if (step > 0) {
    animationStep.set(step - 1)
    return
  }

  // 2️⃣ Go to previous slide
  if (slide > 0) {
    currentSlide.set(slide - 1)
    // ⚠️ DO NOT set animationStep here
    // SlideViewport will set it to animationCount
  }
}


export function prev2() {
  const step = get(animationStep)
  const slide = get(currentSlide)

  // 1️⃣ Reverse animation
  if (step > 0) {
    animationStep.update(s => s - 1)
    const step2 = get(animationStep)

    console.log('prev , ', { step, step2, slide })

    return
  }


  // 2️⃣ Go to previous slide
  if (slide > 0) {
    currentSlide.set(slide - 1)
    animationStep.set(0)
    const slide2 = get(currentSlide)
    console.log('prev , ', { step, slide, slide2 })
  }
}


// export function prevSlide() {
//   currentSlide.update(i => Math.max(0, i - 1));
// }

// export function goToSlide(i: number) {
//   currentSlide.set(i);
// }

export function goToSlide(i: number) {
  const total = get(totalSlides)
  const safeTotal = total > 0 ? total : 1
  const next = Math.max(0, Math.min(i, safeTotal - 1))
  currentSlide.set(next)
  animationStep.set(0)
}

export function syncFromPayload(payload: PresentationPayload) {
  if (!payload) return
  const hidden = payload.editorPaginationOptions?.hiddenPages ?? []
  hiddenPages.set(hidden)
  const total = payload.pageCount || 0
  totalPages.set(total)
  const hiddenSet = new Set(hidden)
  const visibleIndexes: number[] = []
  for (let i = 0; i < total; i += 1) {
    if (!hiddenSet.has(i + 1)) {
      visibleIndexes.push(i)
    }
  }
  totalSlides.set(visibleIndexes.length || total)
  presentation.update((p) => ({
    ...p,
    active: true,
    pageCount: payload.pageCount || p.pageCount,
    html: payload.html || p.html,
    index: payload.currentIndex ?? p.index
  }))
  const actualIndex = payload.currentIndex ?? 0
  const visibleIndex = visibleIndexes.length
    ? Math.max(0, visibleIndexes.indexOf(actualIndex))
    : actualIndex
  goToSlide(visibleIndex)
}
