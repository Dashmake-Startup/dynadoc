import { Extension, getHTMLFromFragment } from '@tiptap/core'
import { debounce } from 'lodash'
import { CustomTranslationExtensionProps } from './utils/common.utils'

const _translationWorker = new SharedWorker(
    new URL('./workers/translation-worker.ts', import.meta.url),
    { type: 'module' }
)
// export interface TranslationStorage {

//     debouncedSync: any,

// }

let knownUuids = new Set<string>()
declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        CustomTranslationExtension: {

        };
    }
    // interface Storage {
    //     [CustomTranslationExtensionProps.name]: TranslationStorage
    // }
}

let debouncedSync = debounce((payloads: any[]) => {
    payloads.forEach(payload => {
        _translationWorker.port.postMessage(payload)
    })
}, 500) // 500ms delay: perfect balance between "real-time" and performance


export const CustomTranslationExtension = Extension.create({
    name: CustomTranslationExtensionProps.name,

    /*  addStorage() {
         return {
             // Store the debounced function so we can cancel it on destroy
             debouncedSync: null,
         }
     }, */

    onCreate() {
        // 1. Initialize the debounced worker sync
        /* this.storage.debouncedSync = debounce((payloads: any[]) => {
            payloads.forEach(payload => {
                _translationWorker.port.postMessage(payload)
            })
        }, 500) */ // 500ms delay: perfect balance between "real-time" and performance
    },

    onDestroy() {
        debouncedSync?.cancel()
        // this.storage.debouncedSync?.cancel()
    },

    // getFormattedHTML(node: any, editor: any) {
    //     return getHTMLFromFragment(node.content, editor.schema)
    // },

    //   onTransaction: ({ editor, transaction }) => {


    // onTransaction({ editor, transaction }) {
    //     let _this = this
    //     if (!transaction.docChanged || transaction.getMeta('preventWorkerSync')) return

    //     // Collect updates for this frame
    //     const updatesToSync: any[] = []
    //     const currentUuids = new Set<string>()


    //     const trDoc = transaction.doc

    //     transaction.mapping.maps.forEach(map => {
    //         map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
    //             if (newStart === newEnd) return

    //             trDoc.nodesBetween(newStart, newEnd, (node, pos) => {
    //                 const uuid = node.attrs?.uid || node.attrs?.uuid
    //                 if (!uuid) return

    //                 const skipTypes = ['table', 'tableRow']
    //                 if (skipTypes.includes(node.type.name)) return

    //                 currentUuids.add(uuid)

    //                 const resolvedPos = trDoc.resolve(pos)
    //                 const index = resolvedPos.index(0)

    //                 let prevId = null
    //                 if (index > 0) {
    //                     const prevNode = trDoc.child(index - 1)
    //                     prevId = prevNode?.attrs?.uid || prevNode?.attrs?.uuid || null
    //                 }

    //                 updatesToSync.push({
    //                     type: 'NODE_SYNC',
    //                     id: uuid,
    //                     html: getHTMLFromFragment(node.content, editor.schema),
    //                     prevId,
    //                     nodeType: node.type.name,
    //                     json: node.toJSON(),
    //                 })
    //             })
    //         })
    //     })

    //     // 2. Queue the updates for debouncing
    //         if (updatesToSync.length > 0) {
    //             // this.storage.debouncedSync(updatesToSync)
    //             debouncedSync(updatesToSync)
    //         }

    //         // 3. Immediate Deletion check (Deletion usually needs to be fast)
    //         editor.state.doc.descendants((node) => {
    //             const uuid = node.attrs?.uid || node.attrs?.uuid
    //             if (uuid) currentUuids.add(uuid)
    //         })

    //         knownUuids.forEach((oldUuid) => {
    //             if (!currentUuids.has(oldUuid)) {
    //                 _translationWorker.port.postMessage({ type: 'NODE_DELETED', id: oldUuid })
    //             }
    //         })

    //         knownUuids = currentUuids


    //     // Use requestAnimationFrame to let ProseMirror finish its work first
    //     /* requestAnimationFrame(() => {
    //         transaction.steps.forEach((step) => {
    //             // @ts-ignore
    //             const { from, to } = step
    //             if (from === undefined || to === undefined) return

    //             editor.state.doc.nodesBetween(from, to, (node, pos) => {
    //                 const uuid = node.attrs?.uid || node.attrs?.uuid
    //                 if (!uuid) return

    //                 // Skip container nodes to avoid redundant massive HTML strings
    //                 const skipTypes = ['table', 'tableRow']
    //                 if (skipTypes.includes(node.type.name)) return

    //                 currentUuids.add(uuid)

    //                 const resolvedPos = editor.state.doc.resolve(pos)
    //                 const index = resolvedPos.index(0)
    //                 let prevId = null
    //                 if (index > 0) {
    //                     const prevNode = editor.state.doc.child(index - 1)
    //                     prevId = prevNode?.attrs?.uid || prevNode?.attrs?.uuid || null
    //                 }

    //                 const nodeHtml = getHTMLFromFragment(node.content, editor.schema)
    //                 // getFormattedHTML(node, editor)

    //                 updatesToSync.push({
    //                     type: 'NODE_SYNC',
    //                     id: uuid,
    //                     html: nodeHtml,
    //                     prevId: prevId,
    //                     nodeType: node.type.name,
    //                     json: node.toJSON()
    //                 })
    //             })
    //         })

    //         // 2. Queue the updates for debouncing
    //         if (updatesToSync.length > 0) {
    //             // this.storage.debouncedSync(updatesToSync)
    //             debouncedSync(updatesToSync)
    //         }

    //         // 3. Immediate Deletion check (Deletion usually needs to be fast)
    //         editor.state.doc.descendants((node) => {
    //             const uuid = node.attrs?.uid || node.attrs?.uuid
    //             if (uuid) currentUuids.add(uuid)
    //         })

    //         knownUuids.forEach((oldUuid) => {
    //             if (!currentUuids.has(oldUuid)) {
    //                 _translationWorker.port.postMessage({ type: 'NODE_DELETED', id: oldUuid })
    //             }
    //         })

    //         knownUuids = currentUuids
    //     }) */
    // },


    onTransaction({ editor, transaction }) {
        if (!transaction.docChanged || transaction.getMeta('preventWorkerSync')) return

        const updatesToSync: any[] = []
        const currentUuids = new Set<string>()
        const trDoc = transaction.doc

        // Use transaction.steps to find exactly what changed
        transaction.steps.forEach((step, index) => {
            const map = transaction.mapping.maps[index]

            map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
                // Ensure positions are within the current doc bounds
                const docSize = trDoc.content.size
                const safeStart = Math.max(0, Math.min(newStart, docSize))
                const safeEnd = Math.max(0, Math.min(newEnd, docSize))

                if (safeStart === safeEnd) return

                // Now it is safe to scan the nodes
                trDoc.nodesBetween(safeStart, safeEnd, (node, pos) => {
                    const uuid = node.attrs?.uid || node.attrs?.uuid
                    if (!uuid) return

                    const skipTypes = ['table', 'tableRow']
                    if (skipTypes.includes(node.type.name)) return

                    currentUuids.add(uuid)

                    // Get previous node ID for structural context
                    const resolvedPos = trDoc.resolve(pos)
                    const nodeIndex = resolvedPos.index(0)
                    let prevId = null
                    if (nodeIndex > 0) {
                        try {
                            const prevNode = trDoc.child(nodeIndex - 1)
                            prevId = prevNode?.attrs?.uid || prevNode?.attrs?.uuid || null
                        } catch (e) {
                            // Catch cases where index might be out of sync
                        }
                    }

                    updatesToSync.push({
                        type: 'NODE_SYNC',
                        id: uuid,
                        html: getHTMLFromFragment(node.content, editor.schema),
                        prevId,
                        nodeType: node.type.name,
                        json: node.toJSON(),
                    })
                })
            })
        })

        // 2. Queue the updates for debouncing
        if (updatesToSync.length > 0) {
            // this.storage.debouncedSync(updatesToSync)
            debouncedSync(updatesToSync)
        }

        // 3. Immediate Deletion check (Deletion usually needs to be fast)
        editor.state.doc.descendants((node) => {
            const uuid = node.attrs?.uid || node.attrs?.uuid
            if (uuid) currentUuids.add(uuid)
        })

        knownUuids.forEach((oldUuid) => {
            if (!currentUuids.has(oldUuid)) {
                _translationWorker.port.postMessage({ type: 'NODE_DELETED', id: oldUuid })
            }
        })

        knownUuids = currentUuids


    }
})