import { get } from 'svelte/store'
import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../stores/editor.store'
import { setPresentationUpdateHandler } from './canvas.utils'

setPresentationUpdateHandler(() => {
  const activeDocumentEditor = get(_$_documentEditorsList.getActive())
  if (!activeDocumentEditor) return
  const activeWysiwygEditor = get(_$_wysiwygEditorsList.get(activeDocumentEditor?.id))
  activeWysiwygEditor?.commands?.emitPresentationUpdate?.()
})
