import type { AppPlatformAPI } from '../types/api'
import Platform from '../../libs/platform'

/**
 * PRODUCTION-GRADE API BOOTSTRAPPER
 *
 * Root Cause: Eagerly importing all platform drivers (Electron, Web, Mobile)
 * pulls in heavy dependency chains (Buffer, Capacitor, RPC logic) into the
 * critical path of main.ts, causing slow TTI (Time To Interactive).
 *
 * Solution:
 * 1. Platform-agnostic detection at top-level (Fast).
 * 2. Proxy-based API export for zero-latency imports.
 * 3. Dynamic import() for heavy driver modules on-demand.
 * 4. Lazy window patching for legacy compatibility.
 */

const anyWindow = typeof window !== 'undefined' ? (window as any) : null

// Platform detection goes through the same helper as the rest of the renderer,
// which already reads the `__platform` the preload declares and falls back to
// the Electron user agent and to `window.electronAPI`. All three survive
// contextIsolation.
//
// What used to be here was a local probe ending in
// `window.process.versions.electron`. The preload does not expose `process`, so
// under contextIsolation that resolved to false on the desktop and this
// bootstrapper loaded the *web* driver into a desktop window: the window
// started, then talked HTTP to the server for work the IPC bridge was sitting
// right there to do.
//
// `libs/platform` imports nothing, so routing through it costs no startup
// weight -- which is what the "fast detection" note here was protecting.
//
// The probe also required `window.node.fs` and `window.node.path` before it
// would admit to being on the desktop. That is deliberately gone: which driver
// to load is a question about the platform, and folding "is the bridge intact"
// into it is what turned a broken preload into a silent downgrade to HTTP
// instead of a visible failure. The preload's names are a hard CI gate since
// #96, so a missing one is a red build rather than a runtime surprise.
const platform = Platform.getPlatform()
const isElectron = platform === Platform.SUPPORTED_PLATFORMS.desktop
const isMobile = platform === Platform.SUPPORTED_PLATFORMS.mobile

let resolvedDriver: any = null
let resolvePromise: Promise<any> | null = null

/**
 * Resolves the correct driver for the current platform lazily.
 */
async function getDriver() {
  if (resolvedDriver) return resolvedDriver.api || resolvedDriver
  if (resolvePromise) return resolvePromise

  resolvePromise = (async () => {
    let driver: any
    if (isElectron) {
      const mod = await import('./drivers/electron')
      driver = mod.ElectronDriver
    } else if (isMobile) {
      const mod = await import('./drivers/mobile')
      driver = mod.MobileDriver
    } else {
      const mod = await import('./drivers/web')
      driver = mod.WebDriver
      // Web only: consume ?session=/?token= left by the OAuth callback redirect
      // BEFORE window.server is exposed, so the first auth:get-session call
      // already carries the captured token (invoke() wipes tokens otherwise).
      try {
        const { captureAuthFromUrl } = await import('./web/authBootstrap')
        await captureAuthFromUrl()
      } catch {
        // non-fatal: the app simply continues unauthenticated
      }
    }

    resolvedDriver = driver
    const apiDriver = (driver as any).api || driver

    if (anyWindow) {
      // Apply backwards compatibility patches once resolved
      applyLegacyPatches(driver, apiDriver)
    }

    return apiDriver
  })()

  return resolvePromise
}

function applyLegacyPatches(driver: any, apiDriver: any) {
  const anyWindow = window as any
  if (!anyWindow.api) anyWindow.api = apiDriver
  if (
    !anyWindow.node ||
    (anyWindow.node as any)?.__isShim ||
    !(anyWindow.node as any)?.fs ||
    !(anyWindow.node as any)?.path
  ) {
    anyWindow.node = (driver as any).node || apiDriver
  }

  // The empty-path guards that used to be written onto `window.node.fs` here
  // now live in the `nodeApi` shim (src/renderer/src/utils/shims/node.ts).
  // Under contextIsolation that object reaches the renderer through
  // contextBridge, frozen, and patching it throws. The shim is the only route
  // the renderer takes to the filesystem, and it is ours to change.

  if (!anyWindow.server) anyWindow.server = (driver as any).server
  if (!anyWindow.terminal) anyWindow.terminal = (driver as any).terminal
  if (!anyWindow.presentationAPI) anyWindow.presentationAPI = (driver as any).presentationAPI
  if (!anyWindow.meetingAPI) anyWindow.meetingAPI = (driver as any).meetingAPI
  if (!anyWindow.platformApi) anyWindow.platformApi = apiDriver
}

/**
 * The main API export.
 * Using a Proxy ensures that simply importing this file has NEAR-ZERO cost.
 */
export const api: AppPlatformAPI = new Proxy({} as AppPlatformAPI, {
  get(target, prop) {
    // Optimization: bypass proxy once resolved
    if (resolvedDriver) {
      const d = (resolvedDriver as any).api || resolvedDriver
      return d[prop]
    }

    const property = prop as keyof AppPlatformAPI

    // Handle methods that return Promises (The majority of the API)
    const asyncMethods = [
      'readFile',
      'readDir',
      'getFonts',
      'getStorageDir',
      'openExternal',
      'loadSystemFont',
      'openDialogFile',
      'openDialogFiles',
      'saveDialogFile',
      'openDialogDirectory'
    ]
    if (asyncMethods.includes(prop as string)) {
      return async (...args: any[]) => {
        const d = await getDriver()
        return d[property](...args)
      }
    }

    // Handle UI/Sync methods: resolve in background, then call
    return (...args: any[]) => {
      getDriver().then((d) => {
        if (typeof d[property] === 'function') d[property](...args)
      })
    }
  }
})

// Trigger non-blocking initialization immediately on browser load
if (anyWindow) {
  // When a preload is present it owns `__platform`. Under contextIsolation it
  // arrives through contextBridge as a read-only, non-configurable property, so
  // assigning over it throws — and because this runs while the module is being
  // evaluated, that would abort the whole API bootstrapper and leave the app
  // with no driver at all. Only publish the value when nobody else has.
  if (anyWindow.__platform === undefined) {
    anyWindow.__platform = platform
  }
  // Pre-load the driver in the background without blocking main.ts execution.
  // Expose readiness (window.server & co patched) so early callers — the auth
  // store boots before the driver resolves — can await it instead of hitting
  // an undefined window.server and failing silently.
  anyWindow.__ddocDriverReady = new Promise((resolve) => {
    setTimeout(() => getDriver().then(resolve, resolve), 0)
  })
}
