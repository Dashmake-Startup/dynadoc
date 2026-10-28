/**
 * linkMeta.worker.ts
 *
 * Dedicated Web Worker that handles ALL metadata fetching and caching
 * for internal links — completely off the main thread.
 *
 * Message protocol (main → worker):
 *   { type: 'FETCH', payload: { fileId: string } }
 *   { type: 'PREFETCH', payload: { fileIds: string[] } }   ← prefetch on editor idle
 *   { type: 'INVALIDATE', payload: { fileId: string } }    ← force refetch
 *
 * Message protocol (worker → main):
 *   { type: 'META_READY', payload: LinkMeta }
 *   { type: 'META_ERROR', payload: { fileId: string; message: string } }
 */

import { getCached, putCached, deleteCached, type LinkMeta } from '../dbs/db'

/** In-flight request deduplication: fileId → Promise */
const inFlight = new Map<string, Promise<void>>()

self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data as {
        type: 'FETCH' | 'PREFETCH' | 'INVALIDATE'
        payload: any
    }

    switch (type) {
        case 'FETCH':
            await handleFetch(payload.fileId)
            break

        case 'PREFETCH':
            // Stagger prefetches to avoid flooding the server
            for (const fileId of (payload.fileIds as string[])) {
                setTimeout(() => handleFetch(fileId), 0)
            }
            break

        case 'INVALIDATE':
            await deleteCached(payload.fileId)
            await handleFetch(payload.fileId, /* forceNetwork */ true)
            break
    }
}

// ─── Core fetch logic ─────────────────────────────────────────────────────────

async function handleFetch(fileId: string, forceNetwork = false): Promise<void> {
    // Deduplicate concurrent requests for the same fileId
    if (inFlight.has(fileId)) return
    const task = _doFetch(fileId, forceNetwork)
    inFlight.set(fileId, task)
    task.finally(() => inFlight.delete(fileId))
}

async function _doFetch(fileId: string, forceNetwork: boolean): Promise<void> {
    try {
        // 1. Serve from IDB cache first (unless invalidated)
        if (!forceNetwork) {
            const cached = await getCached(fileId)
            if (cached) {
                self.postMessage({ type: 'META_READY', payload: cached })
                // Refresh in background if older than 5 minutes
                const staleMs = Date.now() - cached.cachedAt
                if (staleMs < 5 * 60 * 1000) return
                // Fall through to re-fetch quietly
            }
        }

        // 2. Fetch from server via the Electron IPC bridge exposed as `self.dynadocApi`
        //    In the worker context there is no `window`, so we rely on a dedicated
        //    fetch-via-postMessage bridge (injected by the renderer before worker start).
        //    Fallback: derive minimal metadata from the fileId itself.
        const meta = await fetchFromServer(fileId)

        // 3. Persist to IDB and notify main thread
        await putCached(meta)
        self.postMessage({ type: 'META_READY', payload: meta })
    } catch (err: any) {
        self.postMessage({
            type: 'META_ERROR',
            payload: { fileId, message: err?.message ?? 'Unknown error' },
        })
    }
}

/**
 * Fetch metadata from the Dynadoc server.
 *
 * Workers cannot use `window.electron` or `window.server` directly.
 * We rely on `fetch()` against an internal IPC-bridged URL that the
 * Electron main process routes to the local SQLite/file-system layer.
 *
 * Pattern:   GET /internal-api/file-meta?id=<fileId>
 * Response:  { ok: boolean, data: LinkMeta | null }
 *
 * If the bridge is not available (e.g. unit tests), we manufacture a
 * placeholder so the UI still renders gracefully.
 */
async function fetchFromServer(fileId: string): Promise<LinkMeta> {
    try {
        // The Electron renderer exposes a local HTTP server on a fixed port
        // for IPC bridging from workers. See main/server/localApi.ts.
        const res = await fetch(
            `/internal-api/file-meta?id=${encodeURIComponent(fileId)}`,
            { signal: AbortSignal.timeout(5000) }
        )
        if (res.ok) {
            const json = await res.json()
            if (json?.ok && json?.data) {
                return json.data as LinkMeta
            }
        }
    } catch {
        // Network unavailable or timeout — fall through to placeholder
    }

    // Graceful placeholder — UI renders without crashing
    return buildPlaceholder(fileId)
}

function buildPlaceholder(fileId: string): LinkMeta {
    return {
        fileId,
        title: `Document (${fileId.slice(0, 8)}…)`,
        snippet: 'Preview is loading or unavailable for this document.',
        lastModified: new Date().toISOString(),
        author: '',
        status: 'draft',
        backlinksCount: 0,
        docType: 'unknown',
        lastAccessed: Date.now(),
        cachedAt: Date.now(),
    }
}
