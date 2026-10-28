import gsap from 'gsap'

export const CustomAnimationExtensionProps = {
  name: 'animation'
}

export function playAnimation2(el: HTMLElement, gsapTimeline: gsap.core.Timeline, type: string): gsap.core.Timeline {
  type = el.dataset.type ?? type ?? 'fade-in'
  // gsapTimeline = gsapTimeline
  // gsapTimeline = gsapTimeline || gsap

  switch (type) {
    case 'fade-in':
      gsapTimeline.to(el, { autoAlpha: 1, duration: 0.6 })
      break

    case 'fly-in':
      gsapTimeline.fromTo(
        el,
        { x: -50, autoAlpha: 0 },
        { x: 0, autoAlpha: 1, duration: 0.6 }
      )
      break

    case 'zoom-in':
      gsapTimeline.fromTo(
        el,
        { scale: 0.8, autoAlpha: 0 },
        { scale: 1, autoAlpha: 1, duration: 0.6 }
      )
      break
    // all ms powerpoint entrance animations... al the 68 and moree entrance animations
    // entrance: appear.blinds,box,checkerboard,circle,crawl in,...
    // EEmphasis:
    // Exit: blinds,box,checkerboard,circle,crawl out,diamond,diseapper
  }
  return gsapTimeline
}


export function playAnimation(
  el: HTMLElement,
  tl: gsap.core.Timeline,
  type?: string,
  direction?: string,
  duration?: number
): gsap.core.Timeline {

  const anim = 'box'
  // const anim = el.dataset.type ?? type ?? 'fade'
  const dir = direction ?? el.dataset.direction ?? 'left'
  const d = duration || 0.6

  gsap.set(el, { autoAlpha: 1 })

  switch (anim) {

    // =========================
    // SUBTLE
    // =========================

    case 'appear':
      tl.set(el, { autoAlpha: 1 })
      break

    case 'fade':
      tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: d })
      break

    case 'fly-in': {
      const map = {
        left: { x: -80 },
        right: { x: 80 },
        top: { y: -80 },
        bottom: { y: 80 },
        "top-left": { x: -80, y: -80 },
        "top-right": { x: 80, y: -80 },
        "bottom-left": { x: -80, y: 80 },
        "bottom-right": { x: 80, y: 80 }
      }
      tl.fromTo(el, { ...map[dir], autoAlpha: 0 }, { x: 0, y: 0, autoAlpha: 1, duration: d })
      break
    }

    case 'float-in': {
      const map = {
        left: { x: -40 },
        right: { x: 40 },
        top: { y: -40 },
        bottom: { y: 40 }
      }
      tl.fromTo(el, { ...map[dir], autoAlpha: 0 }, { x: 0, y: 0, autoAlpha: 1, duration: d })
      break
    }

    case 'zoom-in':
      tl.fromTo(el, { scale: 0.7, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: d })
      break

    case 'split-horizontal':
      tl.fromTo(el, { scaleX: 0, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 1, duration: d })
      break

    case 'split-vertical':
      tl.fromTo(el, { scaleY: 0, autoAlpha: 0 }, { scaleY: 1, autoAlpha: 1, duration: d })
      break

    case 'wipe': {
      const map = {
        left: 'inset(0 100% 0 0)',
        right: 'inset(0 0 0 100%)',
        top: 'inset(100% 0 0 0)',
        bottom: 'inset(0 0 100% 0)'
      }
      tl.fromTo(el,
        { clipPath: map[dir], autoAlpha: 1 },
        { clipPath: 'inset(0 0 0 0)', duration: d }
      )
      break
    }

    case 'wheel':
      tl.fromTo(el,
        { rotate: -180, scale: 0.3, autoAlpha: 0 },
        { rotate: 0, scale: 1, autoAlpha: 1, duration: d }
      )
      break

    // =========================
    // MODERATE
    // =========================

    case 'blinds-horizontal':
      tl.fromTo(el, { scaleY: 0, autoAlpha: 0 }, { scaleY: 1, autoAlpha: 1, duration: d })
      break

    case 'blinds-vertical':
      tl.fromTo(el, { scaleX: 0, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 1, duration: d })
      break

    case 'box':
      tl.fromTo(el, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: d })
      break

    case 'checkerboard':
      tl.fromTo(el, { scale: 0.8, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: d })
      break

    case 'circle':
      tl.fromTo(el, { clipPath: 'circle(0%)' }, { clipPath: 'circle(150%)', duration: d })
      break

    case 'crawl-in':
      tl.fromTo(el, { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: d })
      break

    case 'diamond':
      tl.fromTo(el, { rotate: 45, scale: 0, autoAlpha: 0 }, { rotate: 0, scale: 1, autoAlpha: 1, duration: d })
      break

    case 'dissolve':
      tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: d, ease: 'steps(12)' })
      break

    case 'peek-in':
      tl.fromTo(el, { x: -20, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: d })
      break

    case 'random-bars':
      tl.fromTo(el, { scaleY: 0, autoAlpha: 0 }, { scaleY: 1, autoAlpha: 1, duration: d })
      break

    case 'spiral':
      tl.fromTo(el, { rotate: -720, scale: 0, autoAlpha: 0 }, { rotate: 0, scale: 1, autoAlpha: 1, duration: d })
      break

    case 'stretch':
      tl.fromTo(el, { scaleX: 0.2 }, { scaleX: 1, duration: d })
      break

    case 'swivel':
      tl.fromTo(el, { rotateY: 90, autoAlpha: 0 }, { rotateY: 0, autoAlpha: 1, duration: d })
      break

    // =========================
    // EXCITING
    // =========================

    case 'bounce':
      tl.fromTo(el, { y: -100, autoAlpha: 0 }, { y: 0, autoAlpha: 1, ease: 'bounce.out', duration: d })
      break

    case 'flip':
      tl.fromTo(el, { rotateX: 90, autoAlpha: 0 }, { rotateX: 0, autoAlpha: 1, duration: d })
      break

    case 'grow-turn':
      tl.fromTo(el, { scale: 0, rotate: -180 }, { scale: 1, rotate: 0, duration: d })
      break

    case 'light-speed':
      tl.fromTo(el, { x: 200, skewX: -30, autoAlpha: 0 }, { x: 0, skewX: 0, autoAlpha: 1, duration: d })
      break

    case 'magnify':
      tl.fromTo(el, { scale: 3, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: d })
      break

    case 'pinwheel':
      tl.fromTo(el, { rotate: 720, scale: 0 }, { rotate: 0, scale: 1, duration: d })
      break

    case 'roll':
      tl.fromTo(el, { x: -100, rotate: -360 }, { x: 0, rotate: 0, duration: d })
      break

    case 'flash-once':
      tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 })
      break

    case 'elastic':
      tl.fromTo(el, { scale: 0 }, { scale: 1, ease: 'elastic.out(1,0.4)', duration: d })
      break

    default:
      tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: d })
  }

  return tl
}



export function playAnimations(container: HTMLElement) {
  /* const elements = Array.from(
    container.querySelectorAll('.animate-target'),
  ) as HTMLElement[]
 
  const ordered = elements
    .map(el => ({
      el,
      order: Number(el.dataset.animationOrder),
      type: el.dataset.animationType,
    }))
    .sort((a, b) => a.order - b.order)
 
  const tl = gsap.timeline()
 
  ordered.forEach(({ el, type }) => {
    switch (type) {
      case 'fade-in':
        tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.6 })
        break
      case 'fly-in':
        tl.from(el, { x: -50, opacity: 0, duration: 0.6 })
        break
      case 'zoom-in':
        tl.from(el, { scale: 0.8, opacity: 0, duration: 0.6 })
        break
    }
  })
 
  return tl */


  const items = container.querySelectorAll('[data-animation]')

  const timeline = gsap.timeline()

    ;[...items]
      .map(el => ({
        el,
        order: Number(el.dataset.order),
        type: el.dataset.type,
      }))
      .sort((a, b) => a.order - b.order)
      .forEach(({ el, type }) => {
        switch (type) {
          case 'fade-in':
            timeline.fromTo(el, { opacity: 0 }, { opacity: 1 })
            break
          case 'fly-in':
            timeline.from(el, { x: -40, opacity: 0 })
            break
        }
      })

}
