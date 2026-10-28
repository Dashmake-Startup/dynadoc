/**
 * Copyright (C) 2025 Dashmake Inc.
 *
 * This file is part of DDoc Office.
 *
 * DDoc Office is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DDoc Office is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
 */

export default class Platform {
  // All supported platforms
  static SUPPORTED_PLATFORMS = {
    web: 'web',
    mobile: 'mobile',
    desktop: 'desktop'
  }
  // _cachedPlatform is declared before isDesktopPlatform on purpose. Static
  // fields initialise in source order, so with the two the other way round the
  // getPlatform() call below populated the cache and the `= null` on the next
  // line immediately wiped it. The answer stayed correct -- the next caller
  // simply recomputed it -- but the cache this class exists to keep was dead
  // from the first line of the file.
  private static _cachedPlatform:
    (typeof Platform.SUPPORTED_PLATFORMS)[keyof typeof Platform.SUPPORTED_PLATFORMS] | null = null
  public static isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop

  private static shouldDebug(): boolean {
    try {
      const win = typeof globalThis !== 'undefined' ? (globalThis as any).window : undefined
      if (win && win.__DDOC_PLATFORM_DEBUG__ === true) return true
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('ddoc.debug.platform') === 'true'
      }
    } catch {
      // ignore
    }
    return false
  }

  /* public static getPlatform(): Platform.SUPPORTED_PLATFORMS {
    // ✅ Check Electron
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      return Platform.SUPPORTED_PLATFORMS.desktop
    }

    // ✅ Check Capacitor (mobile)
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
      return Platform.SUPPORTED_PLATFORMS.mobile
    }

    // ✅ Default: Web
    return Platform.SUPPORTED_PLATFORMS.web
  }
} */

  // public static getPlatform(): Platform.SUPPORTED_PLATFORMS {
  public static getPlatform(): (typeof Platform.SUPPORTED_PLATFORMS)[keyof typeof Platform.SUPPORTED_PLATFORMS] {
    if (Platform._cachedPlatform) return Platform._cachedPlatform
    const debug = Platform.shouldDebug()
    const win = typeof globalThis !== 'undefined' ? (globalThis as any).window : undefined
    // export function getPlatform(): "web" | "mobile" | "desktop" {
    if (win) {
      const declared = win.__platform
      if (debug) console.log('Platform.getPlatform declared', { declared })

      if (declared === Platform.SUPPORTED_PLATFORMS.desktop)
        return (Platform._cachedPlatform = Platform.SUPPORTED_PLATFORMS.desktop)
      if (declared === Platform.SUPPORTED_PLATFORMS.mobile)
        return (Platform._cachedPlatform = Platform.SUPPORTED_PLATFORMS.mobile)
      if (declared === Platform.SUPPORTED_PLATFORMS.web)
        return (Platform._cachedPlatform = Platform.SUPPORTED_PLATFORMS.web)
    }

    const ua = typeof navigator !== 'undefined' ? (navigator as any).userAgent || '' : ''
    if (debug) console.log('Platform.getPlatform ua', { ua })

    if (ua && /Electron/i.test(ua)) {
      return (Platform._cachedPlatform = Platform.SUPPORTED_PLATFORMS.desktop)
    }
    // ✅ Check Electron first
    if (win && win.electronAPI) {
      return (Platform._cachedPlatform = Platform.SUPPORTED_PLATFORMS.desktop) // Electron
    }

    // ✅ Check Capacitor
    if (typeof navigator !== 'undefined' && (navigator as any).userAgent) {
      if (win?.Capacitor?.isNativePlatform?.()) {
        return (Platform._cachedPlatform = Platform.SUPPORTED_PLATFORMS.mobile) // Capacitor iOS/Android
      }
    }

    // ✅ Default: Web
    return (Platform._cachedPlatform = Platform.SUPPORTED_PLATFORMS.web)
  }

  public static isMobileScreen(): boolean {
    // return window.innerWidth < 768
    if (typeof screen === 'undefined') return false
    return screen.width < 768
    // _isMobile = window.innerWidth < 768
  }
}
