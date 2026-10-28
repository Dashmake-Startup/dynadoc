type DriveReadyOptions = {
  timeoutMs?: number
  minDelayMs?: number
  maxDelayMs?: number
}

let ready = false
let pending: Promise<void> | null = null

const defaultOptions: Required<DriveReadyOptions> = {
  timeoutMs: 12000,
  minDelayMs: 200,
  maxDelayMs: 2000
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function markReady() {
  if (ready) return
  ready = true
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dynadoc-drive-ready'))
  }
}

async function probeDrive() {
  if (typeof window === 'undefined') return false
  const api = (window as any)?.api
  if (!api?.getStorageDir || !api?.getCacheDir) return false
  const [storageDir, cacheDir] = await Promise.all([
    api.getStorageDir().catch(() => ''),
    api.getCacheDir().catch(() => '')
  ])
  return Boolean(storageDir && cacheDir)
}

export function isDriveReady() {
  return ready
}

export async function awaitDriveReady(options: DriveReadyOptions = {}): Promise<void> {
  if (ready) return
  if (pending) return pending
  const settings = { ...defaultOptions, ...options }
  pending = (async () => {
    const start = Date.now()
    let delay = settings.minDelayMs
    while (Date.now() - start < settings.timeoutMs) {
      try {
        const ok = await probeDrive()
        if (ok) {
          markReady()
          return
        }
      } catch {
        // ignore
      }
      await sleep(delay)
      delay = Math.min(settings.maxDelayMs, Math.round(delay * 1.6))
    }
    throw new Error('Drive not ready')
  })()
  return pending.finally(() => {
    pending = null
  })
}

export function ensureDriveReadySoon(options: DriveReadyOptions = {}) {
  if (ready || pending) return
  void awaitDriveReady(options).catch(() => {
    // Allow later retries; do not throw globally.
  })
}

