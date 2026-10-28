import { persistStore } from '../utils/storePersistence'
import { DocumentEditorModel } from '../models/Document'
import type { Writable } from 'svelte/store'

export function attachEditorPersistence(
  storePath: string,
  store: Writable<DocumentEditorModel[]>
) {
  return persistStore(storePath, store, [], {
    onLoad: (data) => DocumentEditorModel.fromJSONList(data),
    onSave: (data) => DocumentEditorModel.toJSONList(data)
  })
}
