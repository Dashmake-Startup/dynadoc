/**
 * internalLink.store.svelte.ts
 *
 * Global reactive state engine for the Internal Link feature.
 * Manages:
 *  - Hover-popup visibility & positioning
 *  - Metadata cache (in-memory LRU on top of IDB via a Web Worker)
 *  - Link-picker dialog state
 *  - Prefetch scheduler (requests metadata for all links visible after a debounce)
 *
 * Uses Svelte 5 class-based runes ($state / $derived) — consistent with
 * the project's existing store pattern (see meeting.store.svelte.ts).
 */

import type { LinkMeta } from '../dbs/db'

// ─── In-memory LRU map ────────────────────────────────────────────────────────

const MEM_CACHE_SIZE = 200

class LruMap<K, V> {
    private map = new Map<K, V>()
    private max: number

    constructor(max: number) {
        this.max = max
    }

    get(key: K): V | undefined {
        const val = this.map.get(key)
        if (val !== undefined) {
            // Move to end (most-recently-used)
            this.map.delete(key)
            this.map.set(key, val)
        }
        return val
    }

    set(key: K, val: V): void {
        if (this.map.has(key)) this.map.delete(key)
        this.map.set(key, val)
        if (this.map.size > this.max) {
            // Evict oldest entry (first key)
            this.map.delete(this.map.keys().next().value!)
        }
    }

    has(key: K): boolean {
        return this.map.has(key)
    }

    delete(key: K): void {
        this.map.delete(key)
    }
}

// ─── Worker singleton ─────────────────────────────────────────────────────────

let _worker: Worker | null = null

function getWorker(): Worker {
    if (!_worker) {
        _worker = new Worker(
            new URL('../workers/linkMeta.worker.ts', import.meta.url),
            { type: 'module' }
        )
        _worker.onmessage = (e: MessageEvent) => {
            const { type, payload } = e.data as {
                type: 'META_READY' | 'META_ERROR'
                payload: any
            }
            if (type === 'META_READY') {
                internalLinkStore._onMetaReady(payload as LinkMeta)
            }
            if (type === 'META_ERROR') {
                internalLinkStore._onMetaError(payload.fileId, payload.message)
            }
        }
    }
    return _worker
}

// ─── Link-picker dialog state ─────────────────────────────────────────────────

export interface LinkPickerState {
    open: boolean
    /** The editor chain callback to call once a file is chosen */
    onConfirm: ((fileId: string, label: string) => void) | null
    /** Pre-fill search query when opening the picker */
    query: string
}

// ─── Main Store ───────────────────────────────────────────────────────────────

class InternalLinkStore {
    // — Popup state
    visible = $state(false)
    fileId = $state<string | null>(null)
    x = $state(0)
    y = $state(0)
    data = $state<LinkMeta | null>(null)
    loading = $state(false)
    error = $state<string | null>(null)

    // — Link picker dialog
    picker = $state<LinkPickerState>({
        open: false,
        onConfirm: null,
        query: '',
    })

    // — In-memory metadata cache (top of IDB)
    private memCache = new LruMap<string, LinkMeta>(MEM_CACHE_SIZE)
    private hideTimer: ReturnType<typeof setTimeout> | null = null
    private prefetchTimer: ReturnType<typeof setTimeout> | null = null

    // ── Popup control ──────────────────────────────────────────────────────────

    show(fileId: string, x: number, y: number): void {
        if (this.hideTimer) clearTimeout(this.hideTimer)

        // If switching to a different link, clear stale data immediately
        if (this.fileId !== fileId) {
            this.data = null
            this.error = null
        }

        this.fileId = fileId
        // Smart positioning: clamp so popup never overflows viewport
        const POPUP_W = 480
        const POPUP_H = 340
        const clampedX = Math.min(x, window.innerWidth - POPUP_W - 16)
        const clampedY = Math.min(y + 12, window.innerHeight - POPUP_H - 16)
        this.x = Math.max(clampedX, 8)
        this.y = Math.max(clampedY, 8)
        this.visible = true

        // Serve from mem-cache immediately, then confirm freshness via worker
        const cached = this.memCache.get(fileId)
        if (cached) {
            this.data = cached
            this.loading = false
        } else {
            this.loading = true
        }

        // Always ask worker (serves IDB → network)
        this._requestMeta(fileId)
    }

    hide(): void {
        if (this.hideTimer) clearTimeout(this.hideTimer)
        this.hideTimer = setTimeout(() => {
            this.visible = false
        }, 280) // grace window so user can move mouse into popup
    }

    cancelHide(): void {
        if (this.hideTimer) clearTimeout(this.hideTimer)
    }

    // ── Prefetch control ───────────────────────────────────────────────────────

    /**
     * Schedules a batched prefetch for a set of fileIds (e.g. all links in
     * the current viewport). Debounced by 1 s to avoid blasting the worker
     * during fast scrolling.
     */
    schedulePrefetch(fileIds: string[]): void {
        if (this.prefetchTimer) clearTimeout(this.prefetchTimer)
        this.prefetchTimer = setTimeout(() => {
            // Only request IDs not already in mem-cache
            const needed = fileIds.filter(id => !this.memCache.has(id))
            if (needed.length > 0) {
                getWorker().postMessage({ type: 'PREFETCH', payload: { fileIds: needed } })
            }
        }, 1000)
    }

    // ── Invalidation (e.g. after rename / delete) ──────────────────────────────

    invalidate(fileId: string): void {
        this.memCache.delete(fileId)
        getWorker().postMessage({ type: 'INVALIDATE', payload: { fileId } })
    }

    // ── Link picker ────────────────────────────────────────────────────────────

    openPicker(query = '', onConfirm: (fileId: string, label: string) => void): void {
        this.picker = { open: true, query, onConfirm }
    }

    closePicker(): void {
        this.picker = { open: false, onConfirm: null, query: '' }
    }

    confirmPicker(fileId: string, label: string): void {
        this.picker.onConfirm?.(fileId, label)
        this.closePicker()
    }

    // ── Internal callbacks (called by worker message handler) ──────────────────

    _onMetaReady(meta: LinkMeta): void {
        this.memCache.set(meta.fileId, meta)
        if (this.fileId === meta.fileId) {
            this.data = meta
            this.loading = false
            this.error = null
        }
    }

    _onMetaError(fileId: string, message: string): void {
        if (this.fileId === fileId) {
            this.loading = false
            this.error = message
        }
    }

    // ── Private ────────────────────────────────────────────────────────────────

    private _requestMeta(fileId: string): void {
        getWorker().postMessage({ type: 'FETCH', payload: { fileId } })
    }
}

export const internalLinkStore = new InternalLinkStore()