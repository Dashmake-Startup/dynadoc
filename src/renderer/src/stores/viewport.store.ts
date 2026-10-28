import { readable } from 'svelte/store'

export type ViewportBreakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'tv'

export type ViewportState = {
  width: number
  height: number
  breakpoint: ViewportBreakpoint
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isTV: boolean
  isPortrait: boolean
  isLandscape: boolean
}

const getBreakpoint = (width: number): ViewportBreakpoint => {
  if (width < 480) return 'xs'
  if (width < 768) return 'sm'
  if (width < 1024) return 'md'
  if (width < 1440) return 'lg'
  if (width < 1920) return 'xl'
  return 'tv'
}

const computeState = (): ViewportState => {
  const width = typeof window !== 'undefined' ? window.innerWidth : 0
  const height = typeof window !== 'undefined' ? window.innerHeight : 0
  const breakpoint = getBreakpoint(width)
  const isMobile = breakpoint === 'xs' || breakpoint === 'sm'
  const isTablet = breakpoint === 'md'
  const isDesktop = breakpoint === 'lg' || breakpoint === 'xl'
  const isTV = breakpoint === 'tv'
  const isPortrait = height >= width
  const isLandscape = width > height
  return { width, height, breakpoint, isMobile, isTablet, isDesktop, isTV, isPortrait, isLandscape }
}

export const viewport = readable<ViewportState>(computeState(), (set) => {
  if (typeof window === 'undefined') return () => {}

  let raf = 0
  const update = () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const state = computeState()
      set(state)
      document.documentElement.dataset.viewport = state.breakpoint
      document.documentElement.style.setProperty('--viewport-height', `${state.height}px`)
      document.documentElement.style.setProperty('--viewport-width', `${state.width}px`)
      document.documentElement.style.setProperty('--safe-area-bottom', 'env(safe-area-inset-bottom, 0px)')
    })
  }

  update()
  window.addEventListener('resize', update, { passive: true })
  window.addEventListener('orientationchange', update, { passive: true })

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', update)
    window.removeEventListener('orientationchange', update)
  }
})
