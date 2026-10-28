import { Preferences } from '@capacitor/preferences'
import { Network } from '@capacitor/network'

type SyncEntry = {
  id: string
  channel: string
  args: any[]
  createdAt: number
  attempts: number
}

type SyncInit = {
  getNetworkStatus: () => Promise<{ connected: boolean }>
  invokeRemote: (channel: string, ...args: any[]) => Promise<any>
}

const QUEUE_KEY = 'sync-queue-v1'

class SyncManager {
  private queue: SyncEntry[] = []
  private initialized = false
  private flushing = false
  private invokeRemote: SyncInit['invokeRemote'] | null = null
  private getNetworkStatus: SyncInit['getNetworkStatus'] | null = null

  async init(config: SyncInit) {
    if (this.initialized) return
    this.invokeRemote = config.invokeRemote
    this.getNetworkStatus = config.getNetworkStatus
    await this.loadQueue()
    this.initialized = true
    try {
      Network.addListener('networkStatusChange', (status) => {
        if (status.connected) this.flush().catch(() => {})
      })
    } catch {
      // ignore
    }
  }

  async enqueue(entry: { channel: string; args: any[] }) {
    const item: SyncEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      channel: entry.channel,
      args: entry.args,
      createdAt: Date.now(),
      attempts: 0
    }
    this.queue.push(item)
    await this.persistQueue()
    await this.flush().catch(() => {})
  }

  async flush() {
    if (this.flushing) return
    this.flushing = true
    try {
      if (!this.invokeRemote || !this.getNetworkStatus) return
      const status = await this.getNetworkStatus()
      if (!status.connected) return

      const remaining: SyncEntry[] = []
      for (const entry of this.queue) {
        try {
          await this.invokeRemote(entry.channel, ...entry.args)
        } catch {
          entry.attempts += 1
          remaining.push(entry)
        }
      }
      this.queue = remaining
      await this.persistQueue()
    } finally {
      this.flushing = false
    }
  }

  private async loadQueue() {
    const stored = await Preferences.get({ key: QUEUE_KEY })
    if (!stored.value) return
    try {
      this.queue = JSON.parse(stored.value) as SyncEntry[]
    } catch {
      this.queue = []
    }
  }

  private async persistQueue() {
    await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(this.queue) })
  }
}

export const syncManager = new SyncManager()

