import { writable, derived } from 'svelte/store'
import { evaluate } from 'mathjs'
import { persistStore } from '../../../../utils/storePersistence'
import { _$_documentEditorsList } from '../../../../stores/editor.store'
import type { Variable } from './variableManipulator'

// Reactive derived store for the active editor
const activeEditorStore = _$_documentEditorsList.getActive()

// The writable store holding variables of the active document
// export const _$_activeDocumentVars = writable<Variable[]>([])
// export const _$_activeDocumentVars = writable({})

// The computed vars (reactive formulas)
/* export const computedVars = derived(_$_activeDocumentVars, ($vars) => {
    const result = {}

    for (const key in $vars) {
        const val = $vars[key]
        if (typeof val === 'string' && val.trim().startsWith('=')) {
            try {
                result[key] = evaluate(val.slice(1), result)
            } catch (err) {
                console.warn(`Error computing ${key}:`, err)
                result[key] = 'Error'
            }
        } else {
            result[key] = val
        }
    }

    return result
}) */

// --- Reactively handle activeEditor changes ---
let unsubscribePersist = null

activeEditorStore.subscribe((activeEditor) => {
    // Clean up old persistence if switching documents
    if (unsubscribePersist) {
        unsubscribePersist()
        unsubscribePersist = null
    }

    if (!activeEditor || !activeEditor.document) {
        console.log('No active editor yet — vars store not initialized.')
        // _$_activeDocumentVars.set([])
        // _$_activeDocumentVars.set({})
        return
    }

    const beforeSave = () => {
        // Get the file path for the vars of this active document
        const varStorePath = activeEditor.document.getVarsFilePath()
        const initialVars = activeEditor.document.getVars?.() || {}

        console.log('Initializing vars persistence for beforeSave:', varStorePath, initialVars)

        // Initialize with document vars first
        // _$_activeDocumentVars.set(initialVars)

        // No peersitence needed
        if (!varStorePath) {
            console.log('No Initializing vars persistence for:', varStorePath, initialVars)
            return false
        }
        return true
    }

    if (beforeSave()) {
        // Get the file path for the vars of this active document
        const varStorePath = activeEditor.document.getVarsFilePath()
        const initialVars = activeEditor.document.getVars?.() || {}

        let activeDocumentVars = writable({})
        // console.log('Initializing vars persistence for:', varStorePath, initialVars)

        // Initialize with document vars first
        // _$_activeDocumentVars.set(initialVars)
        activeDocumentVars.set(initialVars)

        // No peersitence needed
        if (!varStorePath) {
            console.log('No Initializing vars persistence for:', varStorePath, initialVars)
            return
        }
        console.log('Initializing vars persistence for:', varStorePath, initialVars)

        // Attach persistence
        unsubscribePersist = persistStore(
            varStorePath,
            activeDocumentVars,
            // _$_activeDocumentVars,
            initialVars,
            {
                onLoad: (data) => {
                    // return data
                    try {
                        return initialVars
                        // return JSON.parse(data)
                    } catch (e) {
                        console.error('Error parsing vars file:', e)
                        return {}
                    }
                },
                beforeSave: () => {
                    return beforeSave()
                },
                onSave: (data) => data,
            }
        )
    }
})
