import { writable } from 'svelte/store'
import { _$_wysiwygEditorsList } from './editor.store'

export type BrowserTab = {
  id: string
  url: string
  title: string
  favicon?: string
  isLoading: boolean
  isActive: boolean
  lastActiveAt: number
  hibernated: boolean
}

export type BrowserDownload = {
  id: string
  tabId: string
  url: string
  filename: string
  receivedBytes: number
  totalBytes: number
  state: string
}

export type PermissionPrompt = {
  requestId: string
  tabId: string
  permission: string
  origin?: string
}

const tabsStore = writable<BrowserTab[]>([])
const downloadsStore = writable<BrowserDownload[]>([])
const permissionStore = writable<PermissionPrompt | null>(null)

export const _$_browserTabs = {
  subscribe: tabsStore.subscribe,
  set: tabsStore.set
}

export const _$_browserDownloads = {
  subscribe: downloadsStore.subscribe
}

export const _$_browserPermissionPrompt = {
  subscribe: permissionStore.subscribe,
  set: permissionStore.set
}

export function initializeBrowserStore() {
  const api = (window as any)?.api?.browser
  if (!api) return

  api.listTabs?.().then((tabs: BrowserTab[]) => {
    if (!tabs || tabs.length === 0) {
      api.createTab?.('https://www.google.com')
      return
    }
    tabsStore.set(tabs)
  })

  api.onTabsChanged((tabs: BrowserTab[]) => tabsStore.set(tabs))
  api.onTabUpdated((tab: BrowserTab) => {
    tabsStore.update((list) => {
      const existing = list.find((item) => item.id === tab.id)
      if (!existing) return [...list, tab]
      return list.map((item) => (item.id === tab.id ? { ...item, ...tab } : item))
    })
  })
  api.onTabRemoved((tabId: string) => {
    tabsStore.update((list) => list.filter((item) => item.id !== tabId))
  })
  api.onDownloadUpdate((payload: BrowserDownload) => {
    downloadsStore.update((list) => {
      const existing = list.find((item) => item.id === payload.id)
      if (!existing) return [...list, payload]
      return list.map((item) => (item.id === payload.id ? payload : item))
    })
  })
  api.onPermissionRequest((payload: PermissionPrompt) => {
    permissionStore.set(payload)
  })
  api.onInsertText((payload: { text: string }) => {
    const editor = _$_wysiwygEditorsList.getActive2?.()
    if (editor) {
      editor.commands.insertContent(payload.text)
    }
  })
}

export const browserActions = {
  createTab: (url?: string) => (window as any).api?.browser?.createTab(url),
  closeTab: (id: string) => (window as any).api?.browser?.closeTab(id),
  activateTab: (id: string) => (window as any).api?.browser?.activateTab(id),
  navigate: (id: string, url: string) => (window as any).api?.browser?.navigate(id, url),
  reload: (id: string) => (window as any).api?.browser?.reload(id),
  goBack: (id: string) => (window as any).api?.browser?.goBack(id),
  goForward: (id: string) => (window as any).api?.browser?.goForward(id),
  setBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
    (window as any).api?.browser?.setBounds(bounds),
  setVisible: (visible: boolean) => (window as any).api?.browser?.setVisible(visible),
  queryHistory: (query: string) => (window as any).api?.browser?.queryHistory(query),
  respondPermission: (requestId: string, allow: boolean) =>
    (window as any).api?.browser?.respondPermission(requestId, allow)
}
