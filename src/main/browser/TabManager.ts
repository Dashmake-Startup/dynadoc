import { app, BrowserWindow, Menu, WebContentsView, type Rectangle } from 'electron'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

export type BrowserTabState = {
  id: string
  url: string
  title: string
  favicon?: string
  isLoading: boolean
  isActive: boolean
  lastActiveAt: number
  hibernated: boolean
  webContentsId?: number
}

export type PermissionRequestPayload = {
  requestId: string
  tabId: string
  permission: string
  details?: Record<string, any>
  origin?: string
}

type TabManagerOptions = {
  preloadPath: string
  onHistory?: (payload: { url: string; title: string; favicon?: string }) => void
  onTabsChanged?: (tabs: BrowserTabState[]) => void
  onTabUpdated?: (tab: BrowserTabState) => void
  onTabRemoved?: (tabId: string) => void
  onDownloadUpdate?: (payload: any) => void
  onPermissionRequest?: (payload: PermissionRequestPayload) => void
  onInsertText?: (payload: { tabId: string; text: string }) => void
}

export class TabManager {
  private window: BrowserWindow
  private preloadPath: string
  private tabs = new Map<string, BrowserTabState>()
  private views = new Map<string, WebContentsView>()
  private overlayView: WebContentsView | null = null
  private overlayVisible = false
  private activeTabId: string | null = null
  private bounds: Rectangle = { x: 0, y: 0, width: 0, height: 0 }
  private isVisible = false
  private permissionRequests = new Map<string, (allow: boolean) => void>()
  private webContentsToTab = new Map<number, string>()
  private hibernateTimer: NodeJS.Timeout | null = null
  private readonly onHistory?: TabManagerOptions['onHistory']
  private readonly onTabsChanged?: TabManagerOptions['onTabsChanged']
  private readonly onTabUpdated?: TabManagerOptions['onTabUpdated']
  private readonly onTabRemoved?: TabManagerOptions['onTabRemoved']
  private readonly onDownloadUpdate?: TabManagerOptions['onDownloadUpdate']
  private readonly onPermissionRequest?: TabManagerOptions['onPermissionRequest']
  private readonly onInsertText?: TabManagerOptions['onInsertText']

  constructor(window: BrowserWindow, options: TabManagerOptions) {
    this.window = window
    this.preloadPath = options.preloadPath
    this.onHistory = options.onHistory
    this.onTabsChanged = options.onTabsChanged
    this.onTabUpdated = options.onTabUpdated
    this.onTabRemoved = options.onTabRemoved
    this.onDownloadUpdate = options.onDownloadUpdate
    this.onPermissionRequest = options.onPermissionRequest
    this.onInsertText = options.onInsertText
    this.startHibernationLoop()
  }

  listTabs(): BrowserTabState[] {
    return Array.from(this.tabs.values())
  }

  getTabIdByWebContentsId(webContentsId: number): string | null {
    return this.webContentsToTab.get(webContentsId) || null
  }

  sendToTab(tabId: string, channel: string, payload: any) {
    const view = this.views.get(tabId)
    if (!view) return
    if (view.webContents.isDestroyed()) return
    view.webContents.send(channel, payload)
  }

  setVisible(visible: boolean) {
    this.isVisible = visible
    if (!visible) {
      this.detachAllViews()
      for (const tab of this.tabs.values()) {
        this.throttleTab(tab.id, true)
      }
      return
    }
    if (this.activeTabId) {
      this.attachView(this.activeTabId)
      this.throttleTab(this.activeTabId, false)
    }
  }

  createTab(url = 'about:blank'): BrowserTabState {
    const id = uuidv4()
    const tab: BrowserTabState = {
      id,
      url: this.sanitizeUrl(url) || 'about:blank',
      title: 'New Tab',
      isLoading: false,
      isActive: false,
      lastActiveAt: Date.now(),
      hibernated: false
    }
    this.tabs.set(id, tab)
    this.createViewForTab(tab)
    if (!this.activeTabId) {
      this.activateTab(id)
    } else {
      this.emitTabUpdated(tab)
      this.emitTabsChanged()
    }
    return tab
  }

  closeTab(tabId: string) {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    this.destroyView(tabId)
    this.tabs.delete(tabId)
    if (this.activeTabId === tabId) {
      const remaining = Array.from(this.tabs.values())
      const next = remaining[0]
      this.activeTabId = null
      if (next) {
        this.activateTab(next.id)
      } else {
        this.emitTabsChanged()
      }
    } else {
      this.emitTabsChanged()
    }
    this.onTabRemoved?.(tabId)
  }

  activateTab(tabId: string) {
    if (this.activeTabId === tabId) return
    const next = this.tabs.get(tabId)
    if (!next) return

    if (this.activeTabId) {
      const current = this.tabs.get(this.activeTabId)
      if (current) {
        current.isActive = false
        this.throttleTab(current.id, true)
        this.detachView(current.id)
        this.emitTabUpdated(current)
      }
    }

    this.activeTabId = tabId
    next.isActive = true
    next.lastActiveAt = Date.now()
    if (next.hibernated) {
      this.createViewForTab(next)
    }
    if (this.isVisible) {
      this.attachView(tabId)
      this.throttleTab(tabId, false)
    } else {
      this.throttleTab(tabId, true)
    }
    this.emitTabUpdated(next)
    this.emitTabsChanged()
  }

  navigate(tabId: string, url: string) {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    const target = this.sanitizeUrl(url)
    if (!target) return
    tab.url = target
    tab.isLoading = true
    this.emitTabUpdated(tab)
    const view = this.views.get(tabId)
    if (view) {
      view.webContents.loadURL(target).catch(() => undefined)
    } else {
      this.createViewForTab(tab)
    }
  }

  reload(tabId: string) {
    const view = this.views.get(tabId)
    view?.webContents.reload()
  }

  goBack(tabId: string) {
    const view = this.views.get(tabId)
    if (view?.webContents.canGoBack()) view.webContents.goBack()
  }

  goForward(tabId: string) {
    const view = this.views.get(tabId)
    if (view?.webContents.canGoForward()) view.webContents.goForward()
  }

  setBounds(bounds: Rectangle) {
    this.bounds = { ...bounds }
    const isHidden = bounds.width <= 0 || bounds.height <= 0
    if (isHidden) {
      this.detachAllViews()
      return
    }
    if (this.activeTabId && this.isVisible) {
      const view = this.views.get(this.activeTabId)
      if (view) view.setBounds(this.bounds)
    }
  }

  respondToPermission(requestId: string, allow: boolean) {
    const handler = this.permissionRequests.get(requestId)
    if (!handler) return
    handler(allow)
    this.permissionRequests.delete(requestId)
  }

  private createViewForTab(tab: BrowserTabState) {
    if (this.views.has(tab.id)) return
    const view = new WebContentsView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        preload: this.preloadPath
      }
    })

    view.setBounds(this.bounds)
    this.attachLifecycle(tab, view)
    this.views.set(tab.id, view)
    this.webContentsToTab.set(view.webContents.id, tab.id)

    tab.hibernated = false
    tab.webContentsId = view.webContents.id
    this.emitTabUpdated(tab)
    if (tab.url) {
      view.webContents.loadURL(tab.url).catch(() => undefined)
    }
    if (tab.isActive && this.isVisible) {
      this.attachView(tab.id)
      this.throttleTab(tab.id, false)
    } else {
      this.throttleTab(tab.id, true)
    }
  }

  private attachLifecycle(tab: BrowserTabState, view: WebContentsView) {
    view.webContents.on('did-start-loading', () => {
      tab.isLoading = true
      this.emitTabUpdated(tab)
    })

    view.webContents.on('did-stop-loading', () => {
      tab.isLoading = false
      tab.url = view.webContents.getURL() || tab.url
      this.emitTabUpdated(tab)
    })

    view.webContents.on('page-title-updated', (_event, title) => {
      tab.title = title || tab.title
      this.emitTabUpdated(tab)
    })

    view.webContents.on('page-favicon-updated', (_event, favicons) => {
      tab.favicon = favicons?.[0]
      this.emitTabUpdated(tab)
    })

    view.webContents.on('did-navigate', (_event, url) => {
      tab.url = url
      this.emitTabUpdated(tab)
      this.onHistory?.({ url, title: tab.title, favicon: tab.favicon })
    })

    view.webContents.on('did-finish-load', () => {
      tab.url = view.webContents.getURL() || tab.url
      tab.title = view.webContents.getTitle() || tab.title
      this.emitTabUpdated(tab)
      this.onHistory?.({ url: tab.url, title: tab.title, favicon: tab.favicon })
    })

    view.webContents.on('context-menu', (_event, params) => {
      if (!params.selectionText) return
      const menu = new Menu()
      menu.append({
        label: 'Insert into Dynadoc',
        click: () => {
          this.onInsertText?.({ tabId: tab.id, text: params.selectionText })
        }
      })
      menu.popup({ window: this.window })
    })

    view.webContents.on('will-navigate', (event, url) => {
      if (!this.sanitizeUrl(url)) {
        event.preventDefault()
      }
    })

    view.webContents.setWindowOpenHandler(({ url }) => {
      if (!this.sanitizeUrl(url)) return { action: 'deny' }
      this.createTab(url)
      return { action: 'deny' }
    })

    view.webContents.on('render-process-gone', () => {
      tab.hibernated = true
      tab.isLoading = false
      this.emitTabUpdated(tab)
    })

    view.webContents.session.setPermissionRequestHandler((wc, permission, callback, details) => {
      if (wc.id !== view.webContents.id) return callback(false)
      const requestId = uuidv4()
      this.permissionRequests.set(requestId, callback)
      this.onPermissionRequest?.({
        requestId,
        tabId: tab.id,
        permission,
        details,
        origin: details?.requestingUrl || tab.url
      })
    })

    view.webContents.session.on('will-download', (event, item, wc) => {
      if (wc.id !== view.webContents.id) return
      const downloadId = uuidv4()
      const totalBytes = item.getTotalBytes()
      const payload = () => ({
        tabId: tab.id,
        id: downloadId,
        url: item.getURL(),
        filename: item.getFilename(),
        receivedBytes: item.getReceivedBytes(),
        totalBytes,
        state: item.getState()
      })

      this.onDownloadUpdate?.(payload())
      item.on('updated', () => this.onDownloadUpdate?.(payload()))
      item.once('done', () => this.onDownloadUpdate?.(payload()))
    })
  }

  private attachView(tabId: string) {
    if (this.window.isDestroyed()) return
    const view = this.views.get(tabId)
    if (!view) return
    if (!this.window.contentView.children.includes(view)) {
      try {
        this.window.contentView.addChildView(view)
      } catch {
        return
      }
    }
    if (this.overlayView && this.overlayVisible) {
      if (this.window.contentView.children.includes(this.overlayView)) {
        this.window.contentView.removeChildView(this.overlayView)
      }
      this.window.contentView.addChildView(this.overlayView)
    }
    view.setBounds(this.bounds)
  }

  private detachView(tabId: string) {
    const view = this.views.get(tabId)
    if (!view) return
    if (this.window.isDestroyed()) return
    if (this.window.contentView.children.includes(view)) {
      try {
        this.window.contentView.removeChildView(view)
      } catch {
        return
      }
    }
  }

  private detachAllViews() {
    for (const tabId of this.views.keys()) {
      this.detachView(tabId)
    }
  }

  private throttleTab(tabId: string, isBackground: boolean) {
    const view = this.views.get(tabId)
    if (!view) return
    view.webContents.setBackgroundThrottling(isBackground)
    view.webContents.setAudioMuted(isBackground)
  }

  private destroyView(tabId: string) {
    const view = this.views.get(tabId)
    if (!view) return
    this.detachView(tabId)
    this.views.delete(tabId)
    if (!view.webContents.isDestroyed()) {
      this.webContentsToTab.delete(view.webContents.id)
      try {
        view.webContents.close()
      } catch {
        // ignore if already torn down
      }
    }
  }

  setOverlayView(view: WebContentsView | null) {
    this.overlayView = view
  }

  setOverlayVisibility(visible: boolean) {
    this.overlayVisible = visible
    if (this.overlayView && !visible) {
      if (!this.window.isDestroyed() && this.window.contentView.children.includes(this.overlayView)) {
        try {
          this.window.contentView.removeChildView(this.overlayView)
        } catch {
          // ignore
        }
      }
    }
  }

  destroyAllViews() {
    if (this.window.isDestroyed()) {
      this.views.clear()
      this.webContentsToTab.clear()
      return
    }
    for (const tabId of Array.from(this.views.keys())) {
      this.destroyView(tabId)
    }
  }

  private startHibernationLoop() {
    if (this.hibernateTimer) return
    this.hibernateTimer = setInterval(() => {
      const mem = process.getSystemMemoryInfo?.()
      const freeMb = mem ? mem.free / 1024 : 1024
      if (freeMb > 700) return
      const now = Date.now()
      for (const tab of this.tabs.values()) {
        if (tab.isActive) continue
        if (tab.hibernated) continue
        if (now - tab.lastActiveAt < 30 * 60 * 1000) continue
        this.destroyView(tab.id)
        tab.hibernated = true
        tab.isLoading = false
        this.emitTabUpdated(tab)
      }
    }, 5 * 60 * 1000)
  }

  private sanitizeUrl(url: string): string | null {
    if (!url) return null
    const trimmed = url.trim()
    if (!trimmed) return null
    if (trimmed.startsWith('javascript:')) return null
    if (trimmed.startsWith('file:')) return null
    const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)
    const normalized = hasScheme ? trimmed : `https://${trimmed}`
    try {
      const parsed = new URL(normalized)
      if (parsed.protocol === 'file:' || parsed.protocol === 'javascript:') return null
      return parsed.toString()
    } catch {
      return null
    }
  }

  private emitTabsChanged() {
    this.onTabsChanged?.(this.listTabs())
  }

  private emitTabUpdated(tab: BrowserTabState) {
    this.onTabUpdated?.({ ...tab })
  }
}
