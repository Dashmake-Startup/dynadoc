import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import EditorHelpers from "../../../../utils/EditorHelpers";
import { nodeApi } from '../../../../utils/shims/node'
import { buildCollabDocId, resolveShareContext } from '../../../../utils/collabUtils'
import { fetchCollabToken } from '../../../../services/collab/tokenService'

export interface CollaborativeSurvey {
    ydoc: Y.Doc
    provider: HocuspocusProvider
    yMap: Y.Map<any>
    destroy: () => void
}

type SurveyEntry = {
    ydoc: Y.Doc;
    provider: HocuspocusProvider;
    yMap: Y.Map<any>;
    refCount: number;
};

const surveys = new Map<string, SurveyEntry>();

export async function createSurvey(surveyId: string, filePath: string, parentDoc?: any, userInfo?: { name: string, color: string }): Promise<CollaborativeSurvey> {
    let entry = surveys.get(filePath)

    if (!entry) {
        const ydoc = new Y.Doc()
        
        const collabDocId = await buildCollabDocId(parentDoc, filePath, surveyId)
        const share = resolveShareContext(parentDoc)

        const provider = new HocuspocusProvider({
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
                provider.setConfiguration({ token: res.token })
                provider.connect()
            }
        })

        const yMap = ydoc.getMap('survey_data')

        const loadPersisted = async () => {
            try {
                const exists = await nodeApi.fsPromises?.exists?.(filePath) || nodeApi.fs?.existsSync?.(filePath)
                if (!exists) return

                const raw = await nodeApi.fsPromises?.readFile?.(filePath, 'utf8') || nodeApi.fs?.readFileSync?.(filePath, 'utf8')
                if (raw) {
                    const parsed = JSON.parse(String(raw))
                    // Only apply if yMap is empty
                    if (yMap.size === 0) {
                       ydoc.transact(() => {
                           for (const [key, value] of Object.entries(parsed)) {
                               yMap.set(key, value)
                           }
                       }, 'local')
                    }
                }
            } catch (err) {
                console.warn('[Survey] Failed to load persisted survey update', err)
            }
        }

        await loadPersisted()

        let saveTimer: any = null

        ydoc.on('update', () => {
            if (saveTimer) clearTimeout(saveTimer)

            saveTimer = setTimeout(() => {
                const data = yMap.toJSON()
                if (nodeApi.fs && nodeApi.path) {
                    EditorHelpers.writeFileEnsuringDir(filePath, JSON.stringify(data, null, 2))
                }
            }, 1000)
        })

        entry = {
            ydoc,
            provider,
            yMap,
            refCount: 0,
        }

        surveys.set(filePath, entry)
    }

    entry.refCount++

    return {
        ...entry,

        destroy() {
            if (!entry) return
            entry.refCount--
            if (entry.refCount === 0) {
                entry.provider.destroy()
                entry.ydoc.destroy()
                surveys.delete(filePath)
            }
        },
    }
}
