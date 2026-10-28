type Bounds = { x: number; y: number; width: number; height: number }

const embeddedBounds = new Map<string, Bounds>()
const channelName = 'dynadoc-embedded-bounds'
let channel: BroadcastChannel | null = null

function ensureChannel() {
  if (channel) return
  channel = new BroadcastChannel(channelName)
  channel.onmessage = (event) => {
    const payload = event.data
    if (!payload?.id || !payload?.bounds) return
    embeddedBounds.set(payload.id, payload.bounds)
  }
}

export function setEmbeddedBounds(id: string, bounds: Bounds) {
  ensureChannel()
  embeddedBounds.set(id, bounds)
  channel?.postMessage({ id, bounds })
}

export function getEmbeddedBounds(id: string) {
  ensureChannel()
  return embeddedBounds.get(id) || null
}
