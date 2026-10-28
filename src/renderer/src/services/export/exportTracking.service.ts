import { v4 as uuidv4 } from 'uuid'
import type { DocumentEditorModel } from '../../models/Document'
import type { DocumentExportRecord } from '../../models/DocumentInfo'
import Utils from '../../utils/Utils'
import { _$_exportUpdatePreference } from '../../stores/common.store'
import { openExportUpdateModal } from '../../stores/exportUpdateModal.store'
import { exportActiveEditorToPdf, exportActiveEditorToPicture, exportSelectionToFile, exportTablesToFile } from './editorExport.service'
import { exportActiveEditorToDocx } from './docxExport.service'
import { exportActiveSheetToFile } from './spreadsheetExchange.service'
import { nodeApi } from '../../utils/shims/node'
import Platform from '../../libs/platform'

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

type ExportUpdateAction = 'overwrite' | 'new' | 'skip'

const readStoreValue = <T>(store): T => {
  let value: T = null
  try {
    const unsubscribe = store.subscribe((v) => (value = v))
    unsubscribe?.()
  } catch {
    // ignore
  }
  return value
}

export function recordDocumentExport(
  documentEditor: DocumentEditorModel,
  record: Omit<DocumentExportRecord, 'id' | 'exportedAt' | 'sourceUpdatedAt'> & {
    exportedAt?: string
    sourceUpdatedAt?: string
  }
) {
  const doc = documentEditor?.document
  if (!doc) return
  const config = doc.config
  const exports = Array.isArray(config.exports) ? config.exports : []
  const sourceUpdatedAt =
    record.sourceUpdatedAt || doc.info?.updatedAt?.toISOString?.() || new Date().toISOString()
  const exportedAt = record.exportedAt || new Date().toISOString()

  const existingIndex = exports.findIndex((entry) => entry.outputPath === record.outputPath)
  const nextEntry: DocumentExportRecord = {
    id: existingIndex >= 0 ? exports[existingIndex].id : uuidv4(),
    format: record.format,
    target: record.target,
    outputPath: record.outputPath,
    exportedAt,
    sourceUpdatedAt,
    selectionOnly: record.selectionOnly,
    scope: record.scope
  }

  if (existingIndex >= 0) {
    exports[existingIndex] = nextEntry
  } else {
    exports.push(nextEntry)
  }

  config.exports = exports
  doc.writeConfigurationFileContent()
}

export function getOutdatedExports(documentEditor: DocumentEditorModel): DocumentExportRecord[] {
  const doc = documentEditor?.document
  if (!doc) return []
  const updatedAt = doc.info?.updatedAt?.toISOString?.() || ''
  if (!updatedAt) return []
  const exports = Array.isArray(doc.config?.exports) ? doc.config.exports : []
  return exports.filter((entry) => entry.sourceUpdatedAt && entry.sourceUpdatedAt < updatedAt)
}

async function resolveNewPath(record: DocumentExportRecord) {
  const base = nodeApi.path.basename(record.outputPath, nodeApi.path.extname(record.outputPath))
  const dir = nodeApi.path.dirname(record.outputPath)
  const ext = nodeApi.path.extname(record.outputPath).replace('.', '')
  const defaultPath = nodeApi.path.join(dir, `${base}-updated.${ext}`)
  const outputPath = await window.api.saveDialogFile({
    title: 'Export updated file',
    defaultPath,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
  })
  return outputPath || null
}

async function rerunExport(record: DocumentExportRecord, action: ExportUpdateAction) {
  let outputPath = action === 'overwrite' ? record.outputPath : null
  if (action === 'new') {
    outputPath = await resolveNewPath(record)
    if (!outputPath) return null
  }

  switch (record.target) {
    case Utils.FILE_TYPES.pdf:
      return exportActiveEditorToPdf({ outputPath, selectionOnly: record.selectionOnly })
    case Utils.OFFICE_EXTENSIONS_FORMAT.word:
      return exportActiveEditorToDocx({ outputPath, selectionOnly: record.selectionOnly })
    case 'picture':
      return exportActiveEditorToPicture({ outputPath })
    case 'selection-html':
      return exportSelectionToFile({ format: 'html', outputPath })
    case 'selection-markdown':
      return exportSelectionToFile({ format: 'markdown', outputPath })
    case 'selection-text':
      return exportSelectionToFile({ format: 'txt', outputPath })
    case 'tables-csv':
      return exportTablesToFile({ format: 'csv', scope: 'all', outputPath })
    case 'tables-markdown':
      return exportTablesToFile({ format: 'markdown', scope: 'all', outputPath })
    case 'tables-html':
      return exportTablesToFile({ format: 'html', scope: 'all', outputPath })
    case Utils.OFFICE_EXTENSIONS_FORMAT.excel:
    case 'csv':
      return exportActiveSheetToFile({
        fileType: record.target as 'xlsx' | 'csv',
        scope: (record.scope as any) || 'current',
        outputPath: outputPath || undefined
      } as any)
    default:
      return null
  }
}

export async function promptExportUpdatesIfNeeded(documentEditor: DocumentEditorModel) {
  if (!Platform.isDesktopPlatform) return // only desktop has export update tracking for now, as it relies on file system access
  const outdated = getOutdatedExports(documentEditor)
  if (!outdated.length) return

  const pref = readStoreValue(_$_exportUpdatePreference)
  let action: ExportUpdateAction | 'ask' = pref?.action || 'ask'

  if (action === 'ask') {
    const result = await openExportUpdateModal({
      count: outdated.length,
      samplePath: outdated[0]?.outputPath || '',
      rememberDefault: false
    })
    if (!result) return
    action = result.action
    if (result.remember) {
      _$_exportUpdatePreference.set({ action })
    }
  }

  if (action === 'skip') return

  for (const record of outdated) {
    const output = await rerunExport(record, action as ExportUpdateAction)
    if (output && typeof output === 'string') {
      recordDocumentExport(documentEditor, {
        format: record.format,
        target: record.target,
        outputPath: output,
        selectionOnly: record.selectionOnly,
        scope: record.scope
      })
    }
  }
}