import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import EditorHelpers from "../../../../utils/EditorHelpers";
import { nodeApi } from '../../../../utils/shims/node'
import { buildCollabDocId, resolveShareContext } from '../../../../utils/collabUtils'
import { fetchCollabToken } from '../../../../services/collab/tokenService'
import { shareCacheHas, shareCacheReadFile } from '../../../../utils/shareCache'

export interface CollaborativeSheet {
    ydoc: Y.Doc
    provider: HocuspocusProvider
    yOps: Y.Array<any>
    ySettings: Y.Map<any>
    destroy: () => void
}

type SheetEntry = {
    ydoc: Y.Doc;
    provider: HocuspocusProvider;
    yOps: Y.Array<any>;
    ySnapshot: Y.Map<any>;
    ySettings: Y.Map<any>;
    refCount: number;
    flushPendingSave: () => void;
};

const sheets = new Map<string, SheetEntry>();
const pendingSheets = new Map<string, Promise<SheetEntry>>();

export function extractSettingsFromUpdate(update: Uint8Array) {
    const ydoc = new Y.Doc()
    Y.applyUpdate(ydoc, update)
    const settings = ydoc.getMap('settings').toJSON()
    ydoc.destroy()
    return settings
}

export async function createSheetYjs(filePath: string, parentDoc?: any, userInfo?: { name: string, color: string }) {
    let entry = sheets.get(filePath)

    if (!entry && pendingSheets.has(filePath)) {
        entry = await pendingSheets.get(filePath)!
    }

    if (!entry) {
        const pending = buildSheetEntry(filePath, parentDoc, userInfo)
        pendingSheets.set(filePath, pending)
        try {
            entry = await pending
            sheets.set(filePath, entry)
        } finally {
            pendingSheets.delete(filePath)
        }
    }

    entry.refCount++
    let destroyed = false

    return {
        ...entry,

        destroy() {
            if (!entry || destroyed) return
            destroyed = true
            entry.refCount--
            if (entry.refCount === 0) {
                entry.flushPendingSave()
                entry.provider.destroy()
                entry.ydoc.destroy()
                sheets.delete(filePath)
            }
        },
    }
}

async function buildSheetEntry(filePath: string, parentDoc?: any, userInfo?: { name: string, color: string }): Promise<SheetEntry> {
        const ydoc = new Y.Doc()
        
        const collabDocId = await buildCollabDocId(parentDoc, filePath)
        const share = resolveShareContext(parentDoc)

        const provider = new HocuspocusProvider({
            url: (window as any).DYNADOC_WS_URL || 'wss://api.dynadoc.dashmake.com/ws', // Fallback to production if not set
            name: collabDocId,
            document: ydoc,
            connect: false, // Wait for token
            onAuthenticationFailed: () => {
                console.warn('[Spreadsheet] Collab authentication failed — operating offline')
                provider.disconnect()
            }
        })

        // Fetch token and connect
        const username = userInfo?.name || 'Anonymous'
        const color = userInfo?.color || '#000000'

        const tokenTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
        Promise.race([
            fetchCollabToken({ docId: collabDocId, username, color, share: share || undefined }),
            tokenTimeout
        ]).then(res => {
            if (res?.token) {
                provider.setConfiguration({ token: res.token })
                provider.connect()
            }
        }).catch(err => {
            console.warn('[Spreadsheet] Collab token fetch failed:', err)
        })
        //     username,
        //     color,
        //     share: share || undefined
        // }).then(res => {
        //     if (res?.token) {
        //         provider.setConfiguration({ token: res.token })
        //         provider.connect()
        //     }
        // })

        const toUint8Array = (value: any): Uint8Array | null => {
            if (value == null) return null
            if (value instanceof Uint8Array) return value
            const anyBuffer: any = Buffer as any
            if (anyBuffer?.isBuffer?.(value)) return new Uint8Array(value)
            if (value instanceof ArrayBuffer) return new Uint8Array(value)
            if (Array.isArray(value)) return new Uint8Array(value)
            if (typeof value === 'string') {
                try {
                    return new Uint8Array(Buffer.from(value, 'base64'))
                } catch {
                    try {
                        return new Uint8Array(Buffer.from(value))
                    } catch {
                        return null
                    }
                }
            }
            return null
        }

        const loadPersisted = async () => {
            try {
                let raw: any = null
                if (filePath.startsWith('share-cache/')) {
                    if (shareCacheHas(filePath)) {
                        raw = shareCacheReadFile(filePath)
                    }
                } else {
                    const exists = await nodeApi.fsPromises?.exists?.(filePath) || nodeApi.fs?.existsSync?.(filePath)
                    if (exists) {
                        raw = await nodeApi.fsPromises?.readFile?.(filePath) || nodeApi.fs?.readFileSync?.(filePath)
                    }
                }

                if (!raw) return

                const update = toUint8Array(raw)
                if (update && update.length > 0) {
                    try {
                        Y.applyUpdate(ydoc, update)
                    } catch (err) {
                        console.warn('[Spreadsheet] Persisted Yjs update is corrupt, starting fresh', err)
                    }
                }
            } catch (err) {
                console.warn('[Spreadsheet] Failed to load persisted sheet update', err)
            }
        }

        // Load the persisted state BEFORE callers read the snapshot map,
        // otherwise the sheet renders empty on reopen and the stale empty
        // state can overwrite the file.
        await loadPersisted()

        const ySnapshot = ydoc.getMap('snapshot')
        const yOps = ydoc.getArray('fortune_ops')
        const ySettings = ydoc.getMap('settings')

        let saveTimer: any = null

        const persistNow = () => {
            const update = Y.encodeStateAsUpdate(ydoc)
            if (window?.api?.spreadsheetAtomicWrite) {
                window.api.spreadsheetAtomicWrite({ path: filePath, data: Buffer.from(update) })
            } else if (nodeApi.fs && nodeApi.path) {
                EditorHelpers.writeFileEnsuringDir(filePath, Buffer.from(update))
            }
        }

        ydoc.on('update', () => {
            if (saveTimer) clearTimeout(saveTimer)
            saveTimer = setTimeout(persistNow, 1000)
        })

        return {
            ydoc,
            provider,
            ySnapshot,
            yOps,
            ySettings,
            refCount: 0,
            flushPendingSave: () => {
                if (!saveTimer) return
                clearTimeout(saveTimer)
                saveTimer = null
                persistNow()
            }
        }
}
