import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../../../stores/editor.store'

const ZOOM_CONTAINER_BASE_CLASS = 'zoom-controls-container'
const zoomControlContainers = new Map<string, HTMLElement>()
let visibleZoomContainerKey: string | null = null
let zoomObserversReady = false
let stopActiveEditorObserver: (() => void) | null = null
let stopActiveTranslationObserver: (() => void) | null = null

const getZoomKey = (value: unknown): string => String(value ?? '')

function resolveActiveZoomKey(): string | null {
  const activeWysiwyg = _$_wysiwygEditorsList.getActiveEntry?.()
  if (activeWysiwyg?.filePath) return getZoomKey(activeWysiwyg.filePath)

  const activeTranslation = _$_documentEditorsList.getActiveTranslationSync?.()
  if (activeTranslation?.path) return getZoomKey(activeTranslation.path)

  const activeDoc = _$_documentEditorsList.getActiveSync?.()
  if (!activeDoc) return null

  return getZoomKey(activeDoc.id) || getZoomKey(activeDoc.document?.getMainFilePath?.()) || null
}

function setVisibleZoomContainer(nextKey: string | null) {
  // Editors remain mounted while their tabs are inactive, so do not rely on
  // the previously visible key alone. Reconcile the complete registry on
  // every tab change to guarantee that exactly one control can be visible.
  for (const [key, container] of zoomControlContainers) {
    const isActive = key === nextKey
    container.classList.toggle('hidden', !isActive)
    container.style.display = isActive ? '' : 'none'
  }

  visibleZoomContainerKey = nextKey
}

function syncVisibleZoomContainer() {
  setVisibleZoomContainer(resolveActiveZoomKey())
}

function ensureZoomVisibilityObservers() {
  if (zoomObserversReady) return
  zoomObserversReady = true
  stopActiveEditorObserver = _$_documentEditorsList.getActive().subscribe(() => {
    syncVisibleZoomContainer()
  })
  stopActiveTranslationObserver = _$_documentEditorsList.getActiveTranslation().subscribe(() => {
    syncVisibleZoomContainer()
  })
}

function cleanupZoomVisibilityObserversIfIdle() {
  if (zoomControlContainers.size > 0) return
  stopActiveEditorObserver?.()
  stopActiveTranslationObserver?.()
  stopActiveEditorObserver = null
  stopActiveTranslationObserver = null
  zoomObserversReady = false
  visibleZoomContainerKey = null
}

export function registerZoomControls(zoomKey: unknown, container: HTMLElement) {
  const key = getZoomKey(zoomKey)
  if (!key) return
  container.classList.add(ZOOM_CONTAINER_BASE_CLASS, 'hidden')
  container.style.display = 'none'
  container.dataset.zoomKey = key
  zoomControlContainers.set(key, container)
  ensureZoomVisibilityObservers()
  syncVisibleZoomContainer()
}

export function unregisterZoomControls(zoomKey: unknown, container?: HTMLElement) {
  const key = getZoomKey(zoomKey)
  if (!key) return
  // Do not unregister a newer control that happens to use the same key.
  if (!container || zoomControlContainers.get(key) === container) {
    zoomControlContainers.delete(key)
  }
  if (visibleZoomContainerKey === key) {
    visibleZoomContainerKey = null
  }
  if (container) {
    container.classList.remove(ZOOM_CONTAINER_BASE_CLASS, 'hidden')
    container.style.display = ''
  }
  cleanupZoomVisibilityObserversIfIdle()
  syncVisibleZoomContainer()
}

export function forceZoomControlsVisibilitySync() {
  syncVisibleZoomContainer()
}
