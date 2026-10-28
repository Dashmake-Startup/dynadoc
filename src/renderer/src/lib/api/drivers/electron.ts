import type { AppPlatformAPI } from '../../types/api'

const getBridge = () => {
  if (typeof window === 'undefined') return undefined
  return (window as any).api
}

const missingBridgeError = (method: string) =>
  new Error(`[ElectronDriver] Missing preload bridge for ${method}`)

export const ElectronDriver: AppPlatformAPI = {
  readFile: (path, encoding) => {
    const bridge = getBridge()
    if (!bridge?.readFile) return Promise.reject(missingBridgeError('readFile'))
    return bridge.readFile(path, encoding)
  },
  readDir: (path) => {
    const bridge = getBridge()
    if (!bridge?.readDir) return Promise.reject(missingBridgeError('readDir'))
    return bridge.readDir(path)
  },
  getFonts: () => {
    const bridge = getBridge()
    if (!bridge?.getFonts) return Promise.reject(missingBridgeError('getFonts'))
    return bridge.getFonts()
  },
  getStorageDir: () => {
    const bridge = getBridge()
    if (!bridge?.getStorageDir) return Promise.reject(missingBridgeError('getStorageDir'))
    return bridge.getStorageDir()
  },
  openExternal: async (url) => {
    const bridge = getBridge()
    if (bridge?.openExternal) {
      await bridge.openExternal(url)
      return
    }
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener')
    }
  },
  showContextMenu: (template) => {
    const bridge = getBridge()
    if (bridge?.showContextMenu) {
      bridge.showContextMenu(template)
      return
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('show-web-menu', { detail: template }))
    }
  },
  showNotification: (title, body) => {
    if (typeof window === 'undefined') return
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body })
        return
      }
      if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification(title, { body })
          }
        })
      }
      return
    }
    console.log(`[Notification] ${title}: ${body}`)
  }
}
