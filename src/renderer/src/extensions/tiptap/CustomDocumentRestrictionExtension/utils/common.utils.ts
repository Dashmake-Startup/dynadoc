import { get } from "svelte/store"
import { DocumentEditorModel, DocumentModel } from "../../../../models/Document"
import { _$_documentEditorsList } from "../../../../stores/editor.store"
import { CustomAIExtensionProps } from "../../CustomAIExtension/utils/common.utils"
import { CustomMonacoCodeBlockExtensionProps } from "../../CustomMonacoCodeBlockExtension/utils/common.utils"
// import { nodeApi } from '../../../../utils/shims/node'
import {
  defaultDocumentRestrictionRules,
  documentRestrictionRulesIcons,
  documentRestrictionRulesLabels,
  documentRestrictionRulesTypes,
  type DocumentRestrictionRules,
  type RestrictionLimit
} from "./restriction.defaults"
let saveDebounceTimer: ReturnType<typeof setTimeout>;

export const CustomDocumentRestrictionExtensionProps = {
  name: 'nodeLimit',
  // tagName: 'ref',
  containerBaseClassName: 'node-limit-warning-container',
  // tagAttributeSrc : 'src',
  // tagAttributePrompt : 'prompt',
  // tagAttributeDone : 'done'
}


// 🧩 Load limits from file (if available)
// export function loadDocumentRestrictionRules(documentRestrictionRulesPath:string): DocumentRestrictionRules {
export function loadDocumentRestrictionRules(document?: DocumentModel | string): DocumentRestrictionRules {

  /* if (!document) {
    const activeDocumentEditor = _$_documentEditorsList.getActiveSync?.()
    if (!activeDocumentEditor) {
      console.warn('No active document found')
      return null
    }

    document = activeDocumentEditor?.document
  } */
  //  console.log('loadDocumentRestrictionRules', {document})

  let documentEditor: DocumentEditorModel
  if (document && typeof document === "string") {
    documentEditor = get(_$_documentEditorsList.get(document))
    document = null
  }
  documentEditor = documentEditor || get(_$_documentEditorsList.getActive())

  document = (document || documentEditor?.document) as DocumentModel
  try {
    if (document?.config && document) {
      const fullConfig = document.config.toJSON?.() || document.config

      // IMPORTANT: Extract the nested restrictionRules property
      const data = fullConfig.restrictionRules || {}

      console.log('loadDocumentRestrictionRules Success:', { data })
      return { ...defaultDocumentRestrictionRules, ...data }
    }
  } catch (err) {
    console.warn('⚠️ Load failed:', err)
  }
  return { ...defaultDocumentRestrictionRules };

  return { ...defaultDocumentRestrictionRules }
}

// 💾 Save limits to file
export function saveDocumentRestrictionRules1(document?: DocumentModel) {
  const activeDocumentEditor = _$_documentEditorsList.getActiveSync?.()
  if (!document) {
    if (!activeDocumentEditor) {
      console.warn('No active document found')
      return null
    }

    document = activeDocumentEditor?.document
  }
  // document?.writeConfigurationFileContent()

  _$_documentEditorsList.updateDocumentConfig(activeDocumentEditor.id, (doc) => {
    // doc.config.restrictionRules = { ...rules };
  });
}


/**
 * Updates the document configuration via the reactive store 
 * and handles debounced disk persistence.
 */
export function saveDocumentRestrictionRules(document: DocumentModel, rules: DocumentRestrictionRules) {
  const activeDocumentEditor = _$_documentEditorsList.getActiveSync?.()
  if (!activeDocumentEditor) {
    console.warn('No active document found')
    return null
  }

  // 1. Update the Reactive Store
  // This ensures the UI reflects the change instantly across all components
  _$_documentEditorsList.updateDocumentConfig(activeDocumentEditor.id, (doc) => {
    doc.config.restrictionRules = { ...rules };
  });

  // 2. Manage the Side Effect (Disk Write)
  /* clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    // We call the method on the document instance
    // Since updateDocumentCookie might have cloned it, we ensure we have the latest
    const latestDoc = _$_documentEditorsList.getItem(activeDocumentEditor.id || "")?.document || document;
    latestDoc.writeConfigurationFileContent();

    // console.log(`[dynadoc] Restriction rules persisted for: ${latestDoc.uuid}`);
  }, 400); */
}
/* export function saveDocumentRestrictionRules(documentRestrictionRules, documentRestrictionRulesPath: string) {
  try {
    EditorHelpers.writeFileEnsuringDir(documentRestrictionRulesPath, JSON.stringify(documentRestrictionRules, null, 2), 'utf-8')
  } catch (err) {
    console.error('❌ Failed to save node/text limits:', err)
  }
} */
