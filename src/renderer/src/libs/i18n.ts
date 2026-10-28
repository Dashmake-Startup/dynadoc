import {
  register,
  init,
  getLocaleFromNavigator,
  _ as base_,
  locale as svelteLocale
} from 'svelte-i18n'
import { get } from 'svelte/store'

const LOCALE_STORAGE_KEY = 'ddoc.locale'

function getStoredLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    return null
  }
}

function persistLocale(lang: string) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, lang)
  } catch {
    // ignore
  }
  const win = window as any
  try {
    win.electronAPI?.setLocale?.(lang)
  } catch {
    // ignore
  }
}

function getPreferredLocale(): string {
  const win = window as any
  if (win.electronAPI?.getLocale) return win.electronAPI.getLocale()
  if (win.Capacitor?.isNativePlatform?.()) {
    return win.Capacitor.Plugins?.Device?.getLanguageCode?.() || 'en'
  }
  return getLocaleFromNavigator() || 'en'
}

let _resolveReady: () => void
export const i18nReady = new Promise<void>((resolve) => {
  _resolveReady = resolve
})

export async function setupI18n() {
  const modules = import.meta.glob('../assets/locales/*/*.json', { eager: false })
  const supportedLocales = new Set<string>()

  for (const path in modules) {
    const match = path.match(/..\/assets\/locales\/([^/]+)\/([^/]+)\.json$/)
    if (!match) continue

    const [_, lang] = match
    supportedLocales.add(lang)
    
    register(lang, async () => {
      const mod = await modules[path]() as any
      return mod.default || mod
    })
  }

  const normalizeLocale = (lang: string) => {
    if (supportedLocales.has(lang)) return lang
    const base = lang.split(/[-_]/)[0]
    return supportedLocales.has(base) ? base : 'en'
  }

  const stored = getStoredLocale()
  const initialLocale = normalizeLocale(stored || getPreferredLocale())
  
  if (!stored) persistLocale(initialLocale)

  await init({
    fallbackLocale: 'en',
    initialLocale
  })
  
  _resolveReady()
}

export function setLocale(lang: string) {
  const normalized = lang.split(/[-_]/)[0]
  svelteLocale.set(normalized)
  persistLocale(normalized)
}

// Kick off initialization immediately
setupI18n().catch(console.error)

export function _(key: string) {
  const t = get(base_)
  // If i18n isn't ready, return the key as a fallback to avoid crashing
  if (typeof t !== 'function') return key
  return t(key)
}
