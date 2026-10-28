/**
 * IndexedDB cache for internal-link metadata.
 *
 * Design goals:
 * - Write-through cache: serve UI instantly from IDB, refresh in background via the electron/server API.
 * - LRU-style auto-eviction: keep at most MAX_ENTRIES records (oldest-access pruned first).
 * - Zero dependency on any UI store — the worker calls these functions independently.
 */

import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'InternalLinkCache'
const STORE_NAME = 'linkMeta'
const DB_VERSION = 1
const MAX_ENTRIES = 500          // hard cap — protects RAM & disk
const RETENTION_DAYS = 14        // stale entries older than this are pruned on open

export interface LinkMeta {
    /** Target file UUID — also the IDB record key */
    fileId: string
    /** Human-readable document title */
    title: string
    /** Plain-text excerpt (first ~200 chars of content) */
    snippet: string
    /** ISO date string of last server-side modification */
    lastModified: string
    /** Author display name */
    author: string
    /** Document lifecycle state */
    status: 'draft' | 'published' | 'archived'
    /** How many other docs link to this one */
    backlinksCount: number
    /** Document type / icon hint */
    docType: 'document' | 'spreadsheet' | 'presentation' | 'folder' | 'unknown'
    /** Unix timestamp of the last time WE accessed this cached record */
    lastAccessed: number
    /** Unix timestamp when this cached record was stored */
    cachedAt: number
}

let _db: IDBPDatabase | null = null

async function getDB(): Promise<IDBPDatabase> {
    if (_db) return _db
    _db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'fileId' })
                store.createIndex('lastAccessed', 'lastAccessed')
                store.createIndex('cachedAt', 'cachedAt')
            }
        },
    })
    // Run cleanup async — does not block first read
    pruneStaleEntries(_db).catch(() => {})
    return _db
}

/** Read one record from cache. Returns null on miss. */
export async function getCached(fileId: string): Promise<LinkMeta | null> {
    const db = await getDB()
    const record: LinkMeta | undefined = await db.get(STORE_NAME, fileId)
    if (!record) return null

    // Touch lastAccessed for LRU tracking (fire-and-forget)
    const updated: LinkMeta = { ...record, lastAccessed: Date.now() }
    db.put(STORE_NAME, updated).catch(() => {})
    return updated
}

/** Write (upsert) one record into cache. Triggers eviction if over limit. */
export async function putCached(meta: LinkMeta): Promise<void> {
    const db = await getDB()
    await db.put(STORE_NAME, { ...meta, lastAccessed: Date.now(), cachedAt: Date.now() })
    evictIfOverLimit(db).catch(() => {})
}

/** Remove a specific entry (e.g. after a file is deleted) */
export async function deleteCached(fileId: string): Promise<void> {
    const db = await getDB()
    await db.delete(STORE_NAME, fileId)
}

/** Get count of cached items */
export async function getCachedCount(): Promise<number> {
    const db = await getDB()
    return db.count(STORE_NAME)
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function pruneStaleEntries(db: IDBPDatabase): Promise<void> {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const index = tx.store.index('cachedAt')
    let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff))
    let pruned = 0
    while (cursor) {
        await cursor.delete()
        pruned++
        cursor = await cursor.continue()
    }
    await tx.done
    if (pruned > 0) {
        console.debug(`[InternalLinkCache] Pruned ${pruned} stale entries.`)
    }
}

async function evictIfOverLimit(db: IDBPDatabase): Promise<void> {
    const count = await db.count(STORE_NAME)
    if (count <= MAX_ENTRIES) return

    const toEvict = count - MAX_ENTRIES
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const index = tx.store.index('lastAccessed')
    // Oldest-accessed first → evict those
    let cursor = await index.openCursor()
    let evicted = 0
    while (cursor && evicted < toEvict) {
        await cursor.delete()
        evicted++
        cursor = await cursor.continue()
    }
    await tx.done
}
