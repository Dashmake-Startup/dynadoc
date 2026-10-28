import { generateHTML } from '@tiptap/html'
import html2canvas from 'html2canvas'
import { exportTiptapToPdf } from './pdfExport.service'
import { openExportOptionsModal } from '../../stores/exportOptionsModal.store'
import type { ExportPreset, ExportTarget } from '../../stores/exportOptionsModal.store'
import EditorExtensionHelpers from '../../utils/EditorExtensionHelpers'
import {

  defaultPaginationOptions,
  getPaginationImpactedExtensionOptions,
  type PaginationPlusOptions
} from '../../extensions/tiptap/utils/common.utils'
import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../stores/editor.store'
import { openAlertModal } from '../../stores/alertModal.store'
import { recordDocumentExport } from './exportTracking.service'
import toast from 'svelte-hot-french-toast'
import { _ as base_ } from 'svelte-i18n'
import { get } from 'svelte/store'
import { nodeApi } from '../../utils/shims/node'
import EditorCommonUtils from '../../utils/common.utils'
import Utils from '../../utils/Utils'
import Platform from '../../libs/platform'
import { showExportToast } from './export.common.utils'

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

const t = (key: string, options?: any) => get(base_)(key, options)

type ActiveEditorContext = {
  activeEntry: ReturnType<typeof _$_wysiwygEditorsList.getActiveEntry>
  activeDocument: ReturnType<typeof _$_documentEditorsList.getActiveSync>
}

type ExportImageOptions = {
  format?: 'png' | 'jpeg'
  quality?: number
  backgroundColor?: string
  watermarkText?: string
  watermarkOpacity?: number
  preset?: ExportPreset
  outputPath?: string
  openAfterExport?: boolean
  revealAfterExport?: boolean
  reasonLabel?: string
}

type ExportPdfOptions = {
  fileName?: string
  outputPath?: string
  selectionOnly?: boolean
  pageRanges?: string
  watermarkText?: string
  watermarkOpacity?: number
  preset?: ExportPreset
  openAfterExport?: boolean
  revealAfterExport?: boolean
  reasonLabel?: string
}

const IGNORE_SELECTORS = new Set([
  'handles',
  'node-view-controls',
  'node-view-control',
  'node-view-toolbar',
  'node-view-slide-toolbar',
  'node-view-slide-controls',
  'node-view-floating-toolbar',
  'node-view-resize-handles',
  'selection-toolbar',
  'bubble-menu',
  'floating-menu'
])

function getActiveEditorContext(): ActiveEditorContext | null {
  const activeEntry = _$_wysiwygEditorsList.getActiveEntry?.()
  const activeDocument = _$_documentEditorsList.getActiveSync?.()
  if (!activeEntry || !activeDocument) return null
  return { activeEntry, activeDocument }
}

function buildExtensions(context: ActiveEditorContext) {
  const paginationOptions: PaginationPlusOptions =
    context.activeDocument?.document?.config?.pagination || defaultPaginationOptions
  const impactedOptions = getPaginationImpactedExtensionOptions(
    paginationOptions,
    context.activeDocument.id
  )
  const editorExtensions = [
    ...EditorExtensionHelpers.getMainWysiwygExtensions(
      null,
      null,
      null,
      paginationOptions,
      impactedOptions,
      null
    )
  ]
  return editorExtensions
}

function buildActiveEditorHtml(context: ActiveEditorContext, selectionOnly = false) {
  const editorExtensions = buildExtensions(context)
  const editor = context.activeEntry.editor
  if (selectionOnly) {
    const { from, to, empty } = editor.state.selection
    if (!empty) {
      const slice = editor.state.doc.slice(from, to)
      const selectionDoc = {
        type: 'doc',
        content: slice.content.toJSON()
      }
      return generateHTML(selectionDoc as any, editorExtensions)
    }
  }
  const json = editor.getJSON()
  return generateHTML(json, editorExtensions)
}

function resolveCaptureRoot(context: ActiveEditorContext): HTMLElement | null {
  const directRoot =
    context.activeEntry.editorHTMLElement ||
    context.activeEntry.editorHTMLContainer ||
    context.activeEntry.editor?.view?.dom
  if (!directRoot) return null
  return directRoot
}

export async function exportActiveEditorToPdf(options: ExportPdfOptions = {}) {
  const context = getActiveEditorContext()
  if (!context) {
    await openAlertModal({ title: 'Export failed', message: 'No active editor available.' })
    return null
  }

  try {
     EditorCommonUtils.toggleDocumentBodyLoading()
    const html = buildActiveEditorHtml(context, options.selectionOnly)
    const domRoot = resolveCaptureRoot(context)
    const preset = options.preset || 'print'
    const presetScale = preset === 'web' ? 0.92 : preset === 'high' ? 1.2 : 1
    const livePaginationOptions =
      (context.activeEntry?.editor?.storage?.PaginationPlus as PaginationPlusOptions | undefined) ||
      context.activeDocument?.document?.config?.pagination ||
      defaultPaginationOptions

    const watermarkText = options.watermarkText?.trim()
    const outputPath = await exportTiptapToPdf({
      editor: context.activeEntry.editor,
      // context.activeDocument,
      html,
      domRoot: domRoot || undefined,
      paginationOptions: livePaginationOptions,
      fileName: options.fileName || `${context.activeDocument?.document?.name || 'export'}.pdf`,
      outputPath: options.outputPath,
      watermarkText,
      watermarkOpacity: options.watermarkOpacity,
      printOptions: {
        scale: presetScale,
        pageRanges: options.pageRanges
      }
    })
    if (outputPath && context.activeDocument) {
      recordDocumentExport(context.activeDocument, {
        format: Utils.FILE_TYPES.pdf,
        target: Utils.FILE_TYPES.pdf,
        outputPath,
        selectionOnly: options.selectionOnly,
        scope: options.selectionOnly ? 'selection' : 'document'
      })
    }
    if (outputPath) {
      // toast.success(t('Exported PDF to {path}', { values: { path: outputPath } }))
      if (Platform.isDesktopPlatform) {
        // setLastExportDir(nodeApi.path.dirname(resolvedPath))
        const openFile = () => window.api.openFile(outputPath)
        const revealFile = () => window.api.openFile(nodeApi.path.dirname(outputPath))

        if (options.openAfterExport) openFile()
        else if (options.revealAfterExport) revealFile()

        showExportToast({
          id: 'pdf-export',
          title: options.reasonLabel || `PDF export ready`,
          path: outputPath,
          onOpen: openFile,
          onReveal: revealFile
        })
      }
    }
    return outputPath
  } finally {
    EditorCommonUtils.toggleDocumentBodyLoading()
  }
}

export async function exportActiveEditorToPicture(options: ExportImageOptions = {}) {
  const context = getActiveEditorContext()
  if (!context) {
    await openAlertModal({ title: 'Export failed', message: 'No active editor available.' })
    return null
  }

  const domRoot = resolveCaptureRoot(context)
  if (!domRoot) {
    await openAlertModal({ title: 'Export failed', message: 'Editor DOM not available.' })
    return null
  }

  const preset = options.preset || 'print'
  const format = options.format || 'png'
  const quality =
    typeof options.quality === 'number'
      ? options.quality
      : preset === 'web'
        ? 0.85
        : preset === 'high'
          ? 1
          : 0.95
  const backgroundColor = options.backgroundColor || '#ffffff'
  const scale = preset === 'web' ? 1 : preset === 'high' ? 3 : 2

  const canvas = await html2canvas(domRoot, {
    backgroundColor,
    scale,
    useCORS: true,
    ignoreElements: (element) => {
      if (!(element instanceof HTMLElement)) return false
      for (const selector of IGNORE_SELECTORS) {
        if (element.classList.contains(selector)) return true
      }
      return false
    }
  })

  if (options.watermarkText) {
    applyCanvasWatermark(canvas, options.watermarkText, options.watermarkOpacity)
  }

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, format === 'jpeg' ? 'image/jpeg' : 'image/png', quality)
  )

  if (!blob) {
    await openAlertModal({ title: 'Export failed', message: 'Unable to render image.' })
    return null
  }

  const extension = format === 'jpeg' ? 'jpg' : 'png'
  const suggestedName = `${context.activeDocument?.document?.name || 'export'}.${extension}`
  const outputPath =
    options.outputPath ||
    (await window.api.saveDialogFile({
      title: 'Export to Picture',
      defaultPath: suggestedName,
      filters: [{ name: 'Images', extensions: [extension] }]
    }))

  if (!outputPath) return null

  const arrayBuffer = await blob.arrayBuffer()
  await nodeApi.fsPromises.writeFile(outputPath, new Uint8Array(arrayBuffer))
  if (context.activeDocument) {
    recordDocumentExport(context.activeDocument, {
      format: extension,
      target: 'picture',
      outputPath,
      scope: 'document'
    })
  }
  toast.success(t('Exported image to {path}', { values: { path: outputPath } }))
  return outputPath
}

export async function printActiveEditor(options: ExportPdfOptions = {}, printOptions?: any) {
  const api = (window as any)?.api
  const tempRoot = api?.getCacheDir ? await api.getCacheDir() : null
  const tempDir = tempRoot
    ? nodeApi.path.join(tempRoot, 'prints')
    : nodeApi.path.join(nodeApi?.os.tmpdir?.() || '.', 'dynadoc-prints')
  await nodeApi.fsPromises.mkdir(tempDir, { recursive: true })
  const tempPath = nodeApi.path.join(tempDir, `print-${Date.now()}.pdf`)

  const outputPath = await exportActiveEditorToPdf({
    ...options,
    outputPath: tempPath
  })
  if (!outputPath) return null
  if (!api?.printFile) {
    await openAlertModal({
      title: 'Print failed',
      message: 'Printing is not available in this build.'
    })
    return null
  }
  await api.printFile(outputPath, printOptions)
  toast.success(t('Print job sent'))
  return outputPath
}

function resolveSelectionAvailable(context: ActiveEditorContext) {
  const { empty } = context.activeEntry.editor.state.selection
  return !empty
}

function resolveWatermarkDefaults(context: ActiveEditorContext) {
  const isSecured = Boolean(context.activeDocument?.document?.isSecured)
  const name = context.activeDocument?.document?.name || 'Document'
  return {
    watermarkEnabled: isSecured,
    watermarkText: isSecured ? `${name} • Secured` : ''
  }
}

function applyCanvasWatermark(
  canvas: HTMLCanvasElement,
  text: string,
  opacity: number = 0.12
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const width = canvas.width
  const height = canvas.height
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.translate(width / 2, height / 2)
  ctx.rotate((-25 * Math.PI) / 180)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#111111'
  ctx.font = `${Math.max(32, Math.floor(width / 18))}px sans-serif`
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

export async function promptAndExport(target: ExportTarget) {
  const context = getActiveEditorContext()
  if (!context) {
    await openAlertModal({ title: 'Export failed', message: 'No active editor available.' })
    return null
  }

  const selectionAvailable = resolveSelectionAvailable(context)
  const watermarkDefaults = resolveWatermarkDefaults(context)
  const isSecured = Boolean(context.activeDocument?.document?.isSecured)
  const modalResult = await openExportOptionsModal({
    target,
    title: target === 'print' ? 'Print' : 'Export',
    selectionAvailable,
    isSecured,
    documentName: context.activeDocument?.document?.name || 'Document',
    defaultPreset: target === 'picture' ? 'print' : 'print'
  })

  if (!modalResult) return null

  const fallbackWatermark = `${context.activeDocument?.document?.name || 'Document'} • Secured`
  const watermarkText =
    isSecured || modalResult.watermarkEnabled
      ? modalResult.watermarkText?.trim() || fallbackWatermark
      : ''
  const preset = modalResult.preset

  if (target === 'picture') {
    return exportActiveEditorToPicture({
      format: modalResult.pictureFormat || 'png',
      preset,
      watermarkText,
      watermarkOpacity: isSecured ? 0.14 : 0.1
    })
  }

  const pdfOptions: ExportPdfOptions = {
    preset,
    selectionOnly: modalResult.selectionOnly,
    pageRanges: modalResult.pageRanges,
    watermarkText
  }

  if (target === 'print') {
    return printActiveEditor(pdfOptions, {
      pageRanges: modalResult.pageRanges || undefined
    })
  }

  return exportActiveEditorToPdf(pdfOptions)
}

type GranularExportFormat = 'html' | 'markdown' | 'txt' | 'csv'
type TableExportScope = 'selected' | 'all'

function htmlToPlainText(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

function extractTables(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.querySelectorAll('table'))
}

function tableToMarkdown(table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll('tr'))
  if (!rows.length) return ''
  const cells = (row: HTMLTableRowElement) =>
    Array.from(row.querySelectorAll('th,td')).map((cell) =>
      (cell.textContent || '').replace(/\s+/g, ' ').trim()
    )
  const header = cells(rows[0])
  const bodyRows = rows.slice(1).map((row) => cells(row))
  const headerLine = `| ${header.join(' | ')} |`
  const separator = `| ${header.map(() => '---').join(' | ')} |`
  const body = bodyRows.map((row) => `| ${row.join(' | ')} |`).join('\n')
  return [headerLine, separator, body].filter(Boolean).join('\n')
}

function tableToCsv(table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll('tr'))
  const escapeCell = (value: string) => {
    const cleaned = value.replace(/\r?\n/g, ' ').trim()
    if (cleaned.includes('"') || cleaned.includes(',') || cleaned.includes('\n')) {
      return `"${cleaned.replace(/\"/g, '""')}"`
    }
    return cleaned
  }
  return rows
    .map((row) =>
      Array.from(row.querySelectorAll('th,td'))
        .map((cell) => escapeCell(cell.textContent || ''))
        .join(',')
    )
    .join('\n')
}

export async function exportSelectionToFile(options: {
  format: 'html' | 'markdown' | 'txt'
  outputPath?: string
}) {
  const context = getActiveEditorContext()
  if (!context) {
    await openAlertModal({ title: 'Export failed', message: 'No active editor available.' })
    return null
  }

  const editor = context.activeEntry.editor
  if (editor.state.selection.empty) {
    await openAlertModal({ title: 'Export selection', message: 'Select content to export.' })
    return null
  }

  const html = buildActiveEditorHtml(context, true)
  let content = ''
  let extension = options.format

  if (options.format === 'html') {
    content = html
  } else if (options.format === 'txt') {
    content = htmlToPlainText(html)
  } else {
    const tables = extractTables(html)
    if (tables.length) {
      content = tables.map((table) => tableToMarkdown(table)).filter(Boolean).join('\n\n')
    } else {
      content = htmlToPlainText(html)
    }
    extension = 'md'
  }

  const suggestedName = `${context.activeDocument?.document?.name || 'selection'}.${extension}`
  const outputPath =
    options.outputPath ||
    (await window.api.saveDialogFile({
      title: 'Export selection',
      defaultPath: suggestedName,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
    }))
  if (!outputPath) return null
  await nodeApi.fsPromises.writeFile(outputPath, content, 'utf-8')

  if (context.activeDocument) {
    recordDocumentExport(context.activeDocument, {
      format: extension,
      target:
        options.format === 'html'
          ? 'selection-html'
          : options.format === 'txt'
            ? 'selection-text'
            : 'selection-markdown',
      outputPath,
      selectionOnly: true,
      scope: 'selection'
    })
  }
  toast.success(t('Exported selection to {path}', { values: { path: outputPath } }))
  return outputPath
}

export async function exportTablesToFile(options: {
  format: 'csv' | 'markdown' | 'html'
  scope?: TableExportScope
  outputPath?: string
}) {
  const context = getActiveEditorContext()
  if (!context) {
    await openAlertModal({ title: 'Export failed', message: 'No active editor available.' })
    return null
  }

  const scope = options.scope || 'all'
  const html = buildActiveEditorHtml(context, scope === 'selected')
  const tables = extractTables(html)
  if (!tables.length) {
    await openAlertModal({ title: 'Export tables', message: 'No tables found to export.' })
    return null
  }

  let content = ''
  let extension = options.format === 'markdown' ? 'md' : options.format
  if (options.format === 'html') {
    content = `<html><body>${tables.map((t) => t.outerHTML).join('\n')}</body></html>`
  } else if (options.format === 'markdown') {
    content = tables.map((t) => tableToMarkdown(t)).filter(Boolean).join('\n\n')
  } else {
    content = tables.map((t) => tableToCsv(t)).filter(Boolean).join('\n\n')
  }

  const suggestedName = `${context.activeDocument?.document?.name || 'tables'}.${extension}`
  const outputPath =
    options.outputPath ||
    (await window.api.saveDialogFile({
      title: 'Export tables',
      defaultPath: suggestedName,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
    }))
  if (!outputPath) return null
  await nodeApi.fsPromises.writeFile(outputPath, content, 'utf-8')

  if (context.activeDocument) {
    recordDocumentExport(context.activeDocument, {
      format: extension,
      target:
        options.format === 'html'
          ? 'tables-html'
          : options.format === 'markdown'
            ? 'tables-markdown'
            : 'tables-csv',
      outputPath,
      scope: scope === 'selected' ? 'tables-selected' : 'tables-all'
    })
  }

  toast.success(t('Exported tables to {path}', { values: { path: outputPath } }))
  return outputPath
}
