let interactionCount = 0

function updatePointerEvents() {
  if (typeof document === 'undefined') return
  document.body.style.pointerEvents = interactionCount > 0 ? 'auto' : 'none'
  document.body.style.background = 'transparent'
  const api = (window as any)?.api?.overlay
  api?.setVisible?.({ visible: interactionCount > 0 })
}

export function acquireOverlayInteraction() {
  interactionCount += 1
  updatePointerEvents()
  let released = false
  return () => {
    if (released) return
    released = true
    interactionCount = Math.max(0, interactionCount - 1)
    updatePointerEvents()
  }
}

export function forceOverlayInteraction(active: boolean) {
  interactionCount = active ? Math.max(1, interactionCount) : 0
  updatePointerEvents()
}
