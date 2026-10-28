import './utils/shims/node'
import './lib/api' // <-- optimized for lazy loading
import './utils/shims/process'
import { _ as t, i18nReady } from './libs/i18n'
import { get } from 'svelte/store'
import { mount } from 'svelte'
import 'virtual:uno.css'
import 'shepherd.js/dist/css/shepherd.css'
import 'highlight.js/styles/atom-one-light.css'

// The following are now loaded dynamically to improve performance
import { ensureDriveReadySoon } from './utils/driveReady'

const bootIndexStart =
  typeof window !== 'undefined' && typeof (window as any).__bootIndexStart === 'number'
    ? (window as any).__bootIndexStart
    : undefined
const BOOT_START = bootIndexStart ?? (typeof performance !== 'undefined' ? performance.now() : Date.now())
const logBoot = (label: string) => {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const delta = (now - BOOT_START).toFixed(1)
  console.log(`[boot] ${label} +${delta}ms`)
}
logBoot('start main.ts')

ensureDriveReadySoon()

const shouldAuthDebug = () => {
  try {
    if (typeof window !== 'undefined' && (window as any).__DDOC_AUTH_DEBUG__ === true) return true
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('ddoc.auth.debug') === 'true'
    }
  } catch {
    // ignore
  }
  return false
}

const withAuthDebugPayload = <T extends Record<string, any>>(payload: T): T => {
  if (!shouldAuthDebug()) return payload
  return { ...payload, debug: true }
}

async function handleWebAuthCallback() {
  logBoot('auth:callback:start')
  if (typeof window === 'undefined') return
  try {
    const initialUrl = window.location?.href || ''
    if (initialUrl) {
      window.sessionStorage?.setItem?.('ddoc.initial_url', initialUrl)
    }
  } catch {
    // ignore storage errors
  }
  const url = window.location.href
  if (!url) return
  try {
    const parsed = new URL(url)
    const hasToken = parsed.searchParams.has('token') || parsed.searchParams.has('access_token')
    const hasRefresh = parsed.searchParams.has('refresh_token') || parsed.searchParams.has('refreshToken')
    const hasCode = parsed.searchParams.has('code')
    const hasSession = parsed.searchParams.has('session')
    if (!hasToken && !hasRefresh && !hasCode && !hasSession) return

    // Capture collaboration token for Hocuspocus
    const collabToken = parsed.searchParams.get('collab_token')
    if (collabToken) window.localStorage.setItem('ddoc.collab_token', collabToken)

    const server = (window as any)?.server
    if (server?.auth?.callback) {
      await server.auth.callback(withAuthDebugPayload({ url }))
      const { default: EditorCommonUtils } = await import('./utils/common.utils')
      await EditorCommonUtils.runPendingAuthAction()
      const cleanUrl = new URL(url)
      cleanUrl.searchParams.delete('token')
      cleanUrl.searchParams.delete('access_token')
      cleanUrl.searchParams.delete('refresh_token')
      cleanUrl.searchParams.delete('refreshToken')
      cleanUrl.searchParams.delete('code')
      cleanUrl.searchParams.delete('state')
      cleanUrl.searchParams.delete('session')
      cleanUrl.searchParams.delete('collab_token')
      cleanUrl.searchParams.delete('error')
      window.history.replaceState({}, document.title, cleanUrl.toString())
    }
  } catch {
    // ignore
  }
  logBoot('auth:callback:done')
}

async function setupMobileAuthDeepLinks() {
  const isNative = (window as any)?.Capacitor?.isNativePlatform?.()
  if (!isNative) return

  const { App } = await import('@capacitor/app')

  const handleUrl = async (rawUrl?: string | null) => {
    const url = String(rawUrl || '').trim()
    if (!url) return
    try {
      let hasAuthParams = false
      try {
        const parsed = new URL(url)
        hasAuthParams =
          parsed.searchParams.has('session') ||
          parsed.searchParams.has('token') ||
          parsed.searchParams.has('access_token') ||
          parsed.searchParams.has('refresh_token') ||
          parsed.searchParams.has('refreshToken') ||
          parsed.searchParams.has('code')
      } catch {
        // ignore parse errors for custom schemes
      }
      if (!hasAuthParams) return

      const server = (window as any)?.server
      if (server?.auth?.callback) {
        await server.auth.callback(withAuthDebugPayload({ url }))
        return
      }
      const { invoke } = await import('./lib/api/web/rpc')
      await invoke('auth:callback', { asResponse: false }, withAuthDebugPayload({ url }))
    } catch (error) {
      console.warn('Auth deep link failed', error)
    }
  }

  App.addListener('appUrlOpen', (event) => {
    handleUrl(event?.url)
  })

  const launch = await App.getLaunchUrl()
  if (launch?.url) {
    await handleUrl(launch.url)
  }
}

const updateSplash = (payload: { title?: string; subtitle?: string; status?: string; recentDocs?: string[]; localeLabel?: string; recentTitle?: string }) => {
  const title = document.getElementById('app-splash-title')
  const subtitle = document.getElementById('app-splash-subtitle')
  const status = document.getElementById('app-splash-status')
  const recentList = document.getElementById('app-splash-recent-list')
  const recentTitle = document.getElementById('app-splash-recent-title')
  const localeLabel = document.getElementById('app-splash-locale')
  if (title && payload.title) title.textContent = payload.title
  if (subtitle && payload.subtitle) subtitle.textContent = payload.subtitle
  if (status && payload.status) status.textContent = payload.status
  if (recentTitle && payload.recentTitle) recentTitle.textContent = payload.recentTitle
  if (recentList && payload.recentDocs) {
    recentList.innerHTML = payload.recentDocs
      .slice(0, 5)
      .map(
        (name) =>
          `<li class="splash-recent-item"><span class="splash-recent-dot"></span>${name}</li>`
      )
      .join('')
  }
  if (localeLabel && payload.localeLabel) {
    localeLabel.textContent = payload.localeLabel
  }
}

const updateSplashProgress = (progress: number) => {
  const progressRoot = document.getElementById('app-splash-progress')
  if (!progressRoot) return
  const safe = Math.max(0.04, Math.min(progress, 1))
  progressRoot.classList.add('determinate')
  progressRoot.style.setProperty('--splash-progress', `${safe * 100}%`)
}

const resolveSplashLocale = () => {
  try {
    const stored = window.localStorage.getItem('ddoc.locale')
    if (stored) return stored
  } catch {
    // ignore storage errors
  }
  const navLocale = navigator.language || (navigator.languages && navigator.languages[0])
  return navLocale || 'en'
}

const setSplashTips = (tips: string[]) => {
  const setter = (window as any).__dynadocSplashSetTips
  if (typeof setter === 'function') setter(tips)
  else (window as any).__dynadocSplashTips = tips
}

const path = window.location.pathname
const hash = window.location.hash
const isPresentation = path === '/presentation' || hash === '#/presentation' || hash === '#presentation'
const isPresenterView = path === '/presenter' || hash === '#/presenter' || hash === '#presenter'
const isMeetingView = path === '/meeting' || hash === '#/meeting' || hash === '#meeting'
const isMeetingLaserPointer = path === '/meeting-laser-pointer' || hash === '#/meeting-laser-pointer' || hash === '#meeting-laser-pointer'
const isMeetingSharingToolbar =
  path === '/meeting-sharing-toolbar' || hash === '#/meeting-sharing-toolbar' || hash === '#meeting-sharing-toolbar'
const isOverlay = new URLSearchParams(window.location.search).get('overlay') === '1'
const urlParams = new URLSearchParams(window.location.search)
const isPublishedSurveyLanding =
  Boolean(urlParams.get('sharedNode')) &&
  (Boolean(urlParams.get('shareId')) ||
    Boolean(urlParams.get('docUuid')) ||
    /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-5][a-fA-F0-9]{3}-[89abAB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}/.test(
      path
    )) &&
  !isOverlay &&
  !isPresentation &&
  !isPresenterView &&
  !isMeetingView &&
  !isMeetingLaserPointer &&
  !isMeetingSharingToolbar

/**
 * STRATEGY: Mount the component lazily but await it before mounting.
 */
async function mountApp() {
  logBoot('resolveComponent:start')
  let ComponentModule
  let targetId
  
  if (isPresentation) {
    ComponentModule = await import('./extensions/tiptap/CustomPresentationExtension/components/PresentationWindow.svelte')
    targetId = 'presentation-body-wrapper'
  } else if (isPresenterView) {
    ComponentModule = await import('./extensions/tiptap/CustomPresentationExtension/components/PresenterWindow.svelte')
    targetId = 'presenter-view-body-wrapper'
  } else if (isMeetingView) {
    ComponentModule = await import('./components/app/editor/meeting/MeetingWindow.svelte')
    targetId = 'meeting-view-body-wrapper'
  } else if (isMeetingLaserPointer) {
    ComponentModule = await import('./components/app/editor/meeting/MeetingLaserPointer.svelte')
    targetId = 'meeting-laser-pointer-view-body-wrapper'
  } else if (isMeetingSharingToolbar) {
    ComponentModule = await import('./components/app/editor/meeting/MeetingFloatingToolbar.svelte')
    targetId = 'meeting-sharing-toolbar-view-body-wrapper'
  } else if (isPublishedSurveyLanding) {
    ComponentModule = await import('./extensions/tiptap/components/common/PublishedNodeLanding.svelte')
    targetId = 'app-body-wrapper'
  } else if (isOverlay) {
    ComponentModule = await import('./OverlayRoot.svelte')
    targetId = 'app-body-wrapper'
  } else {
    ComponentModule = await import('./Main.svelte')
    targetId = 'app-body-wrapper'
  }
  
  logBoot('resolveComponent:done')
  logBoot('mount:start ' + (ComponentModule?.default?.name || 'UnknownComponent') + ' to #' + targetId)
  const app = mount(ComponentModule.default, {
    target: document.getElementById(targetId)!
  })
  logBoot('mount:done')
  return app
}

/**
 * Deferred UI assets to prevent blocking the initial mount
 */
const loadNonCriticalAssets = async () => {
  if (isMeetingLaserPointer || isMeetingSharingToolbar) return
  logBoot('nonCriticalAssets:start')
  try {
    await Promise.allSettled([
      import('./assets/main.css'),
      import('./assets/css/editor.css'),
      import('simplebar'),
      import('simplebar/dist/simplebar.css'),
      import('@phosphor-icons/web/light'),
      import('@phosphor-icons/web/bold')
    ])
  } catch (e) {
    console.warn('Non-critical assets load failed', e)
  }
  logBoot('nonCriticalAssets:done')
}

/**
 * Handle Asynchronous Initialization AFTER Mount
 */
async function bootstrap() {
  logBoot('bootstrap:started')

  // 1. Kick off i18n immediately
  const i18nPromise = i18nReady

  // 2. Start setup in parallel
  const deepLinksPromise = setupMobileAuthDeepLinks()
  const authCallbackPromise = handleWebAuthCallback()

  // 3. Mount App ASAP (The most important step for perceived speed)
  const appPromise = mountApp()

  if (
    !isMeetingLaserPointer &&
    !isMeetingSharingToolbar &&
    !isPresentation &&
    !isPresenterView &&
    !isMeetingView &&
    !isOverlay
  ) {
    // Wait for i18n before showing splash text
    await i18nPromise
    logBoot('i18n:ready')

    const currentLocale = resolveSplashLocale()
    updateSplash({
      localeLabel: `${t('splash.systemLanguage')}: ${currentLocale}`
    })
    updateSplash({ recentTitle: t('splash.recentTitle') })
    updateSplash({ recentDocs: [t('splash.recentLoading')] })
    setSplashTips([
      t('splash.tipsCommand'),
      t('splash.tipsTabs'),
      t('splash.tipsSlash'),
      t('splash.tipsSlides')
    ])
    updateSplash({
      title: t('splash.preparing'),
      subtitle: t('splash.loadingUI'),
      status: t('splash.statusLoading')
    })
    updateSplashProgress(0.18)
    
    // Lazy initialize stores
    const { initializeCommonStore } = await import('./stores/common.store')
    await initializeCommonStore()
    logBoot('commonStoreReady')
    
    updateSplash({
      subtitle: t('splash.restoring'),
      status: t('splash.statusRestoring')
    })
    updateSplashProgress(0.46)
    
    const { initializeStore } = await import('./stores/editor.store')
    await initializeStore()
    logBoot('editorStoreReady')
    
    updateSplashProgress(0.72)
    try {
      const { _$_documentEditorsList } = await import('./stores/editor.store')
      const list = get(_$_documentEditorsList) || []
      const recent = list
        .filter((item) => item?.document?.name || item?.document?.path)
        .sort((a, b) => {
          const aTime = new Date(a?.document?.info?.updatedAt || 0).getTime()
          const bTime = new Date(b?.document?.info?.updatedAt || 0).getTime()
          return bTime - aTime
        })
        .map((item) => item?.document?.name || item?.document?.path)
        .filter(Boolean)
      if (recent.length) {
        updateSplash({ recentDocs: recent })
      } else {
        updateSplash({ recentDocs: [t('splash.noRecent')] })
      }
    } catch {
      // ignore
    }
    updateSplash({
      subtitle: t('splash.connecting'),
      status: t('splash.statusAlmost')
    })
    updateSplashProgress(0.9)
    
    const { initializeBrowserStore } = await import('./stores/browser.store')
    initializeBrowserStore()
    logBoot('browserStoreReady')
  }

  await Promise.all([deepLinksPromise, authCallbackPromise, appPromise])
  
  // Final UI Polish
  loadNonCriticalAssets() // Background
  
  updateSplash({
    status: t('splash.statusReady'),
    subtitle: t('splash.readySubtitle')
  })
  updateSplashProgress(1)
  hideAppSplash()

  logBoot('bootstrap:completed')
  return await appPromise
}

const hideAppSplash = () => {
  const splash = document.getElementById('app-splash')
  if (!splash) return
  splash.classList.add('hidden')
  window.setTimeout(() => {
    splash.remove()
  }, 240)
  document.body.classList.remove('is-app-loading')
  const interval = (window as any).__dynadocSplashInterval
  if (interval) {
    clearInterval(interval)
    delete (window as any).__dynadocSplashInterval
  }
}

const appPromise = bootstrap()
export default appPromise
