import { derived, writable } from 'svelte/store'
import { createUiPersistedStore, getUiMirrorKey } from './uiPersistence'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'ui:themeMode'
export const THEME_MIRROR_KEY = getUiMirrorKey(THEME_STORAGE_KEY)

const canUseDom = typeof window !== 'undefined' && typeof document !== 'undefined'

const detectSystemTheme = (): ResolvedTheme => {
  if (!canUseDom || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const systemThemeStore = writable<ResolvedTheme>(detectSystemTheme())

// The default is 'system'. Setting it back to 'light' reintroduces a bug.
//
// It used to default to 'light', a WPS-style light canvas chosen on purpose,
// while the inline script in index.html, which paints before this bundle
// arrives, defaulted to 'system'. The two decided differently, so on a machine
// set to dark the page painted dark and flipped to light a moment later: a
// visible flash, and an application ignoring the system setting it had just
// read. With no stored value the store never followed the system at all.
//
// One rule now, in both places: an explicit choice wins, and without one the
// system decides. A stored 'light' or 'dark' still takes precedence, so nobody
// loses a setting they made.
export const _$_themeMode = createUiPersistedStore<ThemeMode>(THEME_STORAGE_KEY, 'system')

export const _$_resolvedTheme = derived(
  [_$_themeMode, systemThemeStore],
  ([$mode, $systemTheme]) => ($mode === 'system' ? $systemTheme : $mode)
)

let themeWatcherCleanup: (() => void) | null = null

function applyTheme(theme: ResolvedTheme, mode: ThemeMode) {
  if (!canUseDom) return
  const root = document.documentElement
  root.dataset.theme = theme
  root.dataset.themeMode = mode
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  root.style.colorScheme = theme

  const themeColor = theme === 'dark' ? '#1e1e1e' : '#f7f9fc'
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = themeColor
}

export function initializeThemeStore() {
  if (!canUseDom) return () => {}
  if (themeWatcherCleanup) return themeWatcherCleanup

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const handleSystemThemeChange = () => {
    systemThemeStore.set(media.matches ? 'dark' : 'light')
  }
  handleSystemThemeChange()

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handleSystemThemeChange)
    themeWatcherCleanup = () => media.removeEventListener('change', handleSystemThemeChange)
  } else {
    media.addListener(handleSystemThemeChange)
    themeWatcherCleanup = () => media.removeListener(handleSystemThemeChange)
  }

  const unsubscribe = derived([_$_themeMode, _$_resolvedTheme], ([$mode, $resolvedTheme]) => ({
    mode: $mode,
    resolvedTheme: $resolvedTheme
  })).subscribe(({ mode, resolvedTheme }) => {
    applyTheme(resolvedTheme, mode)
  })

  const handleStorageChange = (event: StorageEvent) => {
    if (event.key !== THEME_MIRROR_KEY || !event.newValue) return
    try {
      const nextMode = JSON.parse(event.newValue) as ThemeMode
      if (nextMode === 'system' || nextMode === 'light' || nextMode === 'dark') {
        _$_themeMode.set(nextMode)
      }
    } catch {
      // ignore malformed mirrored values
    }
  }
  window.addEventListener('storage', handleStorageChange)

  const baseCleanup = themeWatcherCleanup
  themeWatcherCleanup = () => {
    unsubscribe()
    window.removeEventListener('storage', handleStorageChange)
    baseCleanup?.()
    themeWatcherCleanup = null
  }

  return themeWatcherCleanup
}

export const themeOptions: Array<{
  mode: ThemeMode
  label: string
  icon: string
  description: string
}> = [
  {
    mode: 'system',
    label: 'Automatic',
    icon: 'ph-desktop',
    description: 'Follow your device appearance in real time.'
  },
  {
    mode: 'light',
    label: 'Light',
    icon: 'ph-sun-dim',
    description: 'Bright canvas for daylight work.'
  },
  {
    mode: 'dark',
    label: 'Dark',
    icon: 'ph-moon-stars',
    description: 'Focused low-glare workspace.'
  }
]
