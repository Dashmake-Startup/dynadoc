type Bounds = { x: number; y: number; width: number; height: number }

const channelName = 'dynadoc-browser-bounds'
let channel: BroadcastChannel | null = null
let bounds: Bounds | null = null

function ensureChannel() {
  if (channel) return
  channel = new BroadcastChannel(channelName)
  channel.onmessage = (event) => {
    if (!event.data) return
    bounds = event.data
  }
}

export function setBrowserBounds(next: Bounds) {
  ensureChannel()
  bounds = next
  channel?.postMessage(next)
}

export function getBrowserBounds() {
  ensureChannel()
  return bounds
}
