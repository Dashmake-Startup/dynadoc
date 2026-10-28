import Platform from '../../libs/platform'

type EmbeddedConfig = {
  id: string
  url: string
  preloadPath?: string | null
  partition?: string
  userAgent?: string
  onEvent?: (payload: any) => void
  permissions?: string[]
  enableVarDropdown?: boolean
}

export function findEmbeddedIframe(container: HTMLElement | null, id: string) {
  if (!container) return null
  return container.querySelector(`iframe[data-embedded-id="${id}"]`) as HTMLIFrameElement | null
}

export function postMessageToEmbeddedView(
  container: HTMLElement | null,
  id: string,
  payload: any,
  targetOrigin: string = '*'
) {
  const iframe = findEmbeddedIframe(container, id)
  iframe?.contentWindow?.postMessage(payload, targetOrigin)
}

export function navigateEmbeddedView(container: HTMLElement | null, id: string, url: string) {
  const api = (window as any)?.api?.embedded
  const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop

  if (isDesktopPlatform && api) {
    return api.navigate?.({ id, url })
  }

  const iframe = findEmbeddedIframe(container, id)
  if (iframe && iframe.src !== url) {
    iframe.src = url || 'about:blank'
  }
}

export async function mountEmbeddedView(
  container: HTMLElement,
  config: EmbeddedConfig
) {
  const api = (window as any)?.api?.embedded
  const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop

  if (!container) return () => undefined

  if (!isDesktopPlatform) {
    const iframe = document.createElement('iframe')
    iframe.dataset.embeddedId = config.id
    iframe.id = `embedded-${config.id}`
    iframe.src = config.url || 'about:blank'
    iframe.allow =
      'camera *; microphone *; display-capture *; autoplay; fullscreen; clipboard-read; clipboard-write'
    iframe.className =
      'w-full h-full border-none bg-black transition-opacity duration-300 opacity-0'
    iframe.setAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads'
    )
    iframe.onload = () => {
      iframe.classList.remove('opacity-0')
      config.onEvent?.({ id: config.id, type: 'dom-ready', transport: 'iframe' })
    }
    container.replaceChildren()
    container.appendChild(iframe)

    return () => {
      iframe.src = 'about:blank'
      iframe.remove()
    }
  }

  let rafId: number | null = null
  let disposed = false

  await api.create({
    id: config.id,
    url: config.url,
    preloadPath: config.preloadPath || undefined,
    partition: config.partition,
    userAgent: config.userAgent,
    permissions: config.permissions
  })

  api.setVisible({ id: config.id, visible: true })

  if (config.enableVarDropdown) {
    const { ensureEmbeddedVarDropdown } = await import('./embeddedVarDropdown')
    ensureEmbeddedVarDropdown()
  }

  let lastZIndex: number | null = null
  let lastBounds: { x: number; y: number; width: number; height: number } | null = null

  const updateBounds = () => {
    if (disposed) return
    const rect = container.getBoundingClientRect()
    const width = Math.max(0, Math.round(rect.width))
    const height = Math.max(0, Math.round(rect.height))
    const x = Math.round(rect.left)
    const y = Math.round(rect.top)
    const bounds = { x, y, width, height }
    const boundsChanged =
      !lastBounds ||
      lastBounds.x !== bounds.x ||
      lastBounds.y !== bounds.y ||
      lastBounds.width !== bounds.width ||
      lastBounds.height !== bounds.height

    if (boundsChanged) {
      lastBounds = bounds
      api.setBounds({ id: config.id, bounds })
      import('./embeddedViewRegistry').then(({ setEmbeddedBounds }) => {
        setEmbeddedBounds(config.id, bounds)
      })
    }

    const zIndexRaw = window.getComputedStyle(container).zIndex
    const zIndex = Number.isFinite(Number(zIndexRaw)) ? Number(zIndexRaw) : 0
    if (lastZIndex !== zIndex) {
      lastZIndex = zIndex
      api.setZ?.({ id: config.id, zIndex })
    }
  }

  const scheduleUpdate = () => {
    if (rafId !== null) return
    rafId = window.requestAnimationFrame(() => {
      rafId = null
      updateBounds()
    })
  }

  let watchId: number | null = null
  const watchBounds = () => {
    if (disposed) return
    updateBounds()
    watchId = window.requestAnimationFrame(watchBounds)
  }

  const resizeObserver = new ResizeObserver(scheduleUpdate)
  resizeObserver.observe(container)

  const onScroll = () => scheduleUpdate()
  window.addEventListener('resize', onScroll)
  window.addEventListener('scroll', onScroll, true)
  const onExternalUpdate = () => scheduleUpdate()
  window.addEventListener('embedded-view:update', onExternalUpdate)

  const onEvent = (payload: any) => {
    if (payload?.id !== config.id) return
    config.onEvent?.(payload)
  }
  const unsubscribe = api.onEvent?.(onEvent)

  scheduleUpdate()
  if (watchId === null) {
    watchId = window.requestAnimationFrame(watchBounds)
  }

  return () => {
    disposed = true
    resizeObserver.disconnect()
    window.removeEventListener('resize', onScroll)
    window.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('embedded-view:update', onExternalUpdate)
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId)
      rafId = null
    }
    if (watchId !== null) {
      window.cancelAnimationFrame(watchId)
      watchId = null
    }
    api.setVisible({ id: config.id, visible: false })
    api.destroy(config.id)
    unsubscribe?.()
  }
}
