import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { v4 as uuidv4 } from 'uuid'
import { DocumentModel } from '../models/Document'
import { writeFileEnsuringDir } from './documentFileUtils'
import { buildCollabDocId, resolveShareContext } from './collabUtils'
import { fetchCollabToken } from '../services/collab/tokenService'

import { nodeApi } from './shims/node'
import {
    ShapeType,
    type Shape,
    type ShapeContent,
    type CollaborativeCanvas
} from './canvas.types'

// NOTE: Prefer nodeApi (desktop/web/mobile shim) over touching window globals directly.

import { _ as base_, isLoading } from 'svelte-i18n'
import { get } from 'svelte/store'
// Avoid editor.store imports to prevent circular dependency during builds.
const t = (key: string) => get(base_)(key)

const COMPACT_AFTER = 50

let presentationUpdateHandler: (() => void) | null = null

export const setPresentationUpdateHandler = (handler: (() => void) | null) => {
    presentationUpdateHandler = handler
}

export { ShapeType } from './canvas.types'
export type { Shape, ShapeContent, CollaborativeCanvas } from './canvas.types'

export function getDefaultShapeProps(id: string, shapes: Y.Map<Shape>): Shape {
    return {
        id: id,
        name: t('Text'),
        type: ShapeType.Text,
        x: 100,
        y: 100,
        w: 320,
        h: 120,
        z: shapes.size,
        content: {
            type: 'content',
            value: '',
            placeholder: 'Start typing...'
        },

        visible: true,
        selected: true,
    }
}

export function serializeYDoc(ydoc: Y.Doc): string {
    const update = Y.encodeStateAsUpdate(ydoc)
    return Buffer.from(update).toString('base64')
}

/* export function loadYDoc(ydoc: Y.Doc, base64: string) {
    const update = Uint8Array.from(Buffer.from(base64, 'base64'))
    Y.applyUpdate(ydoc, update)
} */

export function loadYDoc(ydoc: Y.Doc, base64?: string) {
    if (!base64) return
    const update = Uint8Array.from(Buffer.from(base64, 'base64'))
    Y.applyUpdate(ydoc, update)
}


function serializeUpdate(update: Uint8Array): string {
    return Buffer.from(update).toString('base64')
}

function deserializeUpdate(base64: string): Uint8Array {
    return Uint8Array.from(Buffer.from(base64, 'base64'))
}


export function encodeSnapshot(ydoc: Y.Doc): string {
    return serializeUpdate(Y.encodeStateAsUpdate(ydoc))
}


type CanvasLoadOptions = {
    lazyLoad?: boolean
    connectOnLoad?: boolean
    updateChunkSize?: number
    yieldMs?: number
    progressive?: boolean
    enableCache?: boolean
    cacheMax?: number
}

const DEFAULT_CANVAS_LOAD_OPTIONS: Required<CanvasLoadOptions> = {
    lazyLoad: false,
    connectOnLoad: false,
    updateChunkSize: 25,
    yieldMs: 8,
    progressive: false,
    enableCache: false,
    cacheMax: 6
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function fileExists(filePath?: string): Promise<boolean> {
    if (!filePath) return false
    try {
        if (nodeApi.fsPromises?.exists) return Boolean(await nodeApi.fsPromises.exists(filePath))
    } catch {
        // ignore
    }
    try {
        if (nodeApi.fsPromises?.stat) {
            await nodeApi.fsPromises.stat(filePath)
            return true
        }
    } catch {
        // ignore
    }
    try {
        if (nodeApi.fs?.exists) return Boolean(await nodeApi.fs.exists(filePath))
    } catch {
        // ignore
    }
    try {
        if (nodeApi.fs?.existsSync) return Boolean(nodeApi.fs.existsSync(filePath))
    } catch {
        // ignore
    }
    return false
}

async function readTextFile(filePath: string): Promise<string> {
    if (!filePath) return ''
    if (nodeApi.fsPromises?.readFile) {
        return String(await nodeApi.fsPromises.readFile(filePath, 'utf-8'))
    }
    if (nodeApi.fs?.promises?.readFile) {
        return String(await nodeApi.fs.promises.readFile(filePath, 'utf-8'))
    }
    if (nodeApi.fs?.readFile) {
        return await new Promise<string>((resolve, reject) => {
            nodeApi.fs.readFile(filePath, 'utf-8', (err, data) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve(String(data ?? ''))
            })
        })
    }
    throw new Error('File system API unavailable')
}

type CanvasCacheEntry = {
    canvas: CollaborativeCanvas
    refCount: number
    lastUsed: number
}

const canvasCache = new Map<string, CanvasCacheEntry>()

const touchCache = (key: string) => {
    const entry = canvasCache.get(key)
    if (!entry) return
    entry.lastUsed = Date.now()
    canvasCache.delete(key)
    canvasCache.set(key, entry)
}

const evictCache = (max: number) => {
    if (canvasCache.size <= max) return
    for (const [key, entry] of canvasCache) {
        if (canvasCache.size <= max) break
        if (entry.refCount > 0) continue
        entry.canvas.provider?.destroy()
        entry.canvas.ydoc.destroy()
        canvasCache.delete(key)
    }
}

export function releaseCanvas(canvasPath?: string) {
    if (!canvasPath) return
    const entry = canvasCache.get(canvasPath)
    if (!entry) return
    entry.refCount = Math.max(0, entry.refCount - 1)
    touchCache(canvasPath)
    evictCache(DEFAULT_CANVAS_LOAD_OPTIONS.cacheMax)
}

export async function createCanvas(
    assetType: typeof DocumentModel.AssetType[keyof typeof DocumentModel.AssetType],
    canvasId?: string,
    canvasPath?: string,
    options: CanvasLoadOptions = {},
    parentDoc?: any,
    userInfo?: { name: string, color: string }
): Promise<CollaborativeCanvas> {
    const loadOptions = { ...DEFAULT_CANVAS_LOAD_OPTIONS, ...options }

    // Create one if not provided
    canvasId = canvasId || uuidv4()
    canvasPath = canvasPath || (await DocumentModel.getAssetFilePathFromDocument(assetType))?.filePath
    console.log('Syncing shapes createCanvas...', { canvasId, canvasPath })

    const cacheKey = loadOptions.enableCache ? canvasPath : null
    if (cacheKey && canvasCache.has(cacheKey)) {
        const cached = canvasCache.get(cacheKey)
        cached.refCount += 1
        touchCache(cacheKey)
        return cached.canvas
    }

    const ydoc = new Y.Doc()
    let newlyCreated = true

    let persisted = { snapshot: null, updates: [] as string[] }
    let provider: HocuspocusProvider | null = null
    let loaded = false

    const loadPersisted = async () => {
        if (loaded) return
        loaded = true

        try {
            const exists = await fileExists(canvasPath)
            if (exists) {
                const raw = await readTextFile(canvasPath!)
                persisted = JSON.parse(raw || '{"snapshot":null,"updates":[]}')
            } else if (canvasPath) {
                // Don't eagerly overwrite on web until we have a real existence answer.
                // fileExists() already uses async APIs first when available.
                writeFileEnsuringDir(canvasPath, JSON.stringify(persisted), 'utf-8')
            }
        } catch (err) {
            console.warn('Failed to read slide canvas data, resetting.', err)
            persisted = { snapshot: null, updates: [] }
            if (canvasPath) {
                writeFileEnsuringDir(canvasPath, JSON.stringify(persisted), 'utf-8')
            }
        }

        console.log('onSlideNewlyCreated snapshot', { persisted }, persisted.snapshot)

        if (persisted.snapshot) {
            Y.applyUpdate(ydoc, deserializeUpdate(persisted.snapshot))
        }

        if (persisted.updates.length) {
            newlyCreated = false
        }

        const applyChunk = (start: number) => {
            const chunk = persisted.updates.slice(start, start + loadOptions.updateChunkSize)
            for (const u of chunk) {
                Y.applyUpdate(ydoc, deserializeUpdate(u))
            }
            const next = start + loadOptions.updateChunkSize
            if (next >= persisted.updates.length) return
            setTimeout(() => applyChunk(next), loadOptions.yieldMs)
        }

        if (loadOptions.progressive && persisted.updates.length) {
            applyChunk(0)
        } else {
            for (let i = 0; i < persisted.updates.length; i += loadOptions.updateChunkSize) {
                const chunk = persisted.updates.slice(i, i + loadOptions.updateChunkSize)
                for (const u of chunk) {
                    Y.applyUpdate(ydoc, deserializeUpdate(u))
                }
                if (i + loadOptions.updateChunkSize < persisted.updates.length) {
                    await delay(loadOptions.yieldMs)
                }
            }
        }

    }

    const setupProvider = async () => {
        const collabDocId = await buildCollabDocId(parentDoc, canvasPath || '', canvasId)
        const share = resolveShareContext(parentDoc)

        provider = new HocuspocusProvider({
            url: (window as any).DYNADOC_WS_URL || 'wss://api.dynadoc.dashmake.com/ws',
            name: collabDocId,
            document: ydoc,
            connect: false,
        })

        const username = userInfo?.name || 'Anonymous'
        const color = userInfo?.color || '#000000'

        fetchCollabToken({
            docId: collabDocId,
            username,
            color,
            share: share || undefined
        }).then(res => {
            if (res?.token) {
                provider?.setConfiguration({ token: res.token })
                provider?.connect()
            }
        })
    }

    if (!loadOptions.lazyLoad) {
        await loadPersisted()
        await setupProvider()
    } else if (!loadOptions.connectOnLoad) {
        await setupProvider()
    }

    // ------------------------------------
    // 3️⃣ Shared types (canonical)
    // ------------------------------------
    const shapes = ydoc.getMap<any>('shapes')
    const texts = ydoc.getMap<Y.XmlFragment>('texts')
    const meta = ydoc.getMap<any>('meta')

    // ------------------------------------
    // 4️⃣ Persistence (NO DROPPED UPDATES)
    // ------------------------------------
    ydoc.on('update', update => {
        persisted.updates.push(serializeUpdate(update))

        // Compact periodically
        if (persisted.updates.length >= COMPACT_AFTER) {
            persisted.snapshot = encodeSnapshot(ydoc)
            persisted.updates = []
        }

        if (canvasPath) {
            writeFileEnsuringDir(
                canvasPath,
                JSON.stringify(persisted),
                'utf-8'
            )
        }
        // console.log("emitPresentationUpdate persisted", { persisted })

        // Sync presentation slideshow
        presentationUpdateHandler?.()
    })

    console.log('Syncing shapes createCanvas shapes...', { shapes: shapes, texts })


    // ------------------------------------
    // 5️⃣ Return API
    // ------------------------------------
    const canvas: CollaborativeCanvas = {
        id: canvasId,
        path: canvasPath || '',
        ydoc,
        provider: provider!,
        shapes,
        texts,
        meta,
        awareness: provider?.awareness ?? null,
        newlyCreated,
        isLoaded: loaded,
        load: async () => {
            await loadPersisted()
            if (!provider) {
                setupProvider()
                canvas.provider = provider!
                canvas.awareness = provider?.awareness ?? null
            }
            canvas.isLoaded = true
        }
    }
    if (cacheKey) {
        canvas.release = () => releaseCanvas(cacheKey)
        canvasCache.set(cacheKey, { canvas, refCount: 1, lastUsed: Date.now() })
        evictCache(loadOptions.cacheMax)
    }
    return canvas
}

