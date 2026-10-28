import Utils from '../../utils/Utils'
import { generateHTML } from '@tiptap/html'
import { _ } from 'svelte-i18n'
import { get } from 'svelte/store'
import type { Editor } from '@tiptap/core'
import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../stores/editor.store'
import { openAlertModal } from '../../stores/alertModal.store'
import { openConfirmModal } from '../../stores/confirmModal.store'
import EditorExtensionHelpers from '../../utils/EditorExtensionHelpers'
import {
  defaultPaginationOptions,
  getPaginationImpactedExtensionOptions,
  type PaginationPlusOptions
} from '../../extensions/tiptap/utils/common.utils'
import EditorCommonUtils from '../../utils/common.utils'
import {
  convertHtmlFileToDocx,
  convertHtmlFileToOdt,
  convertHtmlFileToOdp,
  ensureDocxExtension,
  ensureOdtExtension,
  ensureOdpExtension,
  maybeDownloadConvertedFile,
  toCompleteOfficeHtml,
  writeFileEnsuringDirAsync
} from '../conversion/officeConversion.service'
import { recordDocumentExport } from './exportTracking.service'
import { nodeApi } from '../../utils/shims/node'
import Platform from '../../libs/platform'
import { showExportToast } from './export.common.utils'

const $_ = get(_)

type ActiveEditorContext = {
  activeEntry: ReturnType<typeof _$_wysiwygEditorsList.getActiveEntry>
  activeDocument: ReturnType<typeof _$_documentEditorsList.getActiveSync>
}

export type OfficeExportOptions = {
  format?: typeof Utils.OFFICE_EXTENSIONS_FORMAT.word | 'odt' | 'odp'
  outputPath?: string | null
  selectionOnly?: boolean
  promptSelection?: boolean
  includeComments?: boolean
  includeTrackChanges?: boolean
  watermarkText?: string
  openAfterExport?: boolean
  revealAfterExport?: boolean
  suggestedName?: string
  reasonLabel?: string
}

export type DocxExportOptions = OfficeExportOptions

const LAST_DIR_KEY = 'ui:lastOfficeExportDir'
const TOAST_STYLE_ID = 'dynadoc-office-export-toast'

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
  return [
    ...EditorExtensionHelpers.getMainWysiwygExtensions(
      null,
      null,
      null,
      paginationOptions,
      impactedOptions,
      null
    )
  ]
}

function buildActiveEditorHtml(context: ActiveEditorContext, selectionOnly = false) {
  const editor = context.activeEntry.editor as Editor
  const editorExtensions = buildExtensions(context)
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

function sanitizeHtmlForOffice(html: string): string {
  if (!html) return ''

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const blacklist = [
    'script',
    'iframe',
    'canvas',
    'video',
    'audio',
    'svg',
    'math',
    'source',
    'track',
    'embed'
  ]
  blacklist.forEach((tag) => {
    const elements = doc.querySelectorAll(tag)
    elements.forEach((el) => el.remove())
  })

  return doc.body.innerHTML
}

function buildOfficeCss(context: ActiveEditorContext): string {
  const chunks: string[] = []
  const root =
    context.activeEntry.editor?.view?.dom ||
    context.activeEntry.editorHTMLContainer ||
    context.activeEntry.editorHTMLElement
  if (root instanceof HTMLElement) {
    const style = window.getComputedStyle(root)
    chunks.push(
      `body{font-family:${style.fontFamily};font-size:${style.fontSize};line-height:${style.lineHeight};color:${style.color};}`
    )
  }

  document.querySelectorAll('style').forEach((styleEl) => {
    const text = styleEl.textContent?.trim()
    if (text) chunks.push(text)
  })

  return chunks.join('\n')
}

function getLastExportDir(): string | null {
  try {
    return window.localStorage.getItem(LAST_DIR_KEY)
  } catch {
    return null
  }
}

function setLastExportDir(dir: string) {
  try {
    window.localStorage.setItem(LAST_DIR_KEY, dir)
  } catch {
    // ignore storage failures
  }
}

/* function ensureToastStyles() {
  if (document.getElementById(TOAST_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = TOAST_STYLE_ID
  style.textContent = `
    .office-export-toast {
      position: fixed;
      right: 20px;
      bottom: 24px;
      z-index: 10000;
      min-width: 320px;
      max-width: 420px;
      background: rgba(20, 20, 20, 0.95);
      color: #f3f4f6;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 14px 16px;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(10px);
      opacity: 0;
      transform: translateY(12px);
      transition: opacity 160ms ease, transform 160ms ease;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .office-export-toast.show {
      opacity: 1;
      transform: translateY(0);
    }
    .office-export-toast .title {
      font-weight: 600;
      letter-spacing: 0.3px;
      font-size: 13px;
    }
    .office-export-toast .path {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.6);
      word-break: break-all;
      line-height: 1.3;
    }
    .office-export-toast .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .office-export-toast .btn {
      border: none;
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 11px;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.08);
      color: #f8fafc;
      transition: background 120ms ease, transform 120ms ease;
    }
    .office-export-toast .btn.primary {
      background: rgba(59, 130, 246, 0.9);
      color: #fff;
    }
    .office-export-toast .btn:hover {
      background: rgba(255, 255, 255, 0.16);
      transform: translateY(-1px);
    }
    .office-export-toast .btn.primary:hover {
      background: rgba(37, 99, 235, 0.9);
    }
  `
  document.head.appendChild(style)
}

export function showExportToast(payload: {
  title: string
  path: string
  onOpen: () => void
  onReveal: () => void
}) {
  ensureToastStyles()

  const toast = document.createElement('div')
  toast.className = 'office-export-toast'
  toast.innerHTML = `
    <div class="title">${payload.title}</div>
    <div class="path">${payload.path}</div>
    <div class="actions">
      <button class="btn primary" data-action="open">Open</button>
      <button class="btn" data-action="reveal">Show in Folder</button>
      <button class="btn" data-action="copy">Copy Path</button>
      <button class="btn" data-action="dismiss">Dismiss</button>
    </div>
  `

  const cleanup = () => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 160)
  }

  toast.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement
    const action = target?.dataset?.action
    if (!action) return
    if (action === 'open') payload.onOpen()
    if (action === 'reveal') payload.onReveal()
    if (action === 'copy') {
      try {
        await EditorCommonUtils.copyToClipboard(payload.path)
      } catch {
        // ignore clipboard failures
      }
    }
    if (action === 'dismiss') cleanup()
  })

  document.body.appendChild(toast)
  requestAnimationFrame(() => toast.classList.add('show'))
  setTimeout(cleanup, 9000)
} */

export async function exportActiveEditorToDocx(options: OfficeExportOptions = {}) {
  return exportActiveEditorToOffice({ ...options, format: 'docx' })
}

export async function exportActiveEditorToOdt(options: OfficeExportOptions = {}) {
  return exportActiveEditorToOffice({ ...options, format: 'odt' })
}

export async function exportActiveEditorToOdp(options: OfficeExportOptions = {}) {
  return exportActiveEditorToOffice({ ...options, format: 'odp' })
}

export async function exportActiveEditorToOffice(options: OfficeExportOptions = {}) {
  const format = options.format || 'docx'
  const context = getActiveEditorContext()
  if (!context) {
    await openAlertModal({ title: 'Export failed', message: 'No active editor available.' })
    return null
  }
  try {
    EditorCommonUtils.toggleDocumentBodyLoading()

    const editor = context.activeEntry.editor as Editor
    let selectionOnly = !!options.selectionOnly

    if (!selectionOnly && options.promptSelection && !editor.state.selection.empty) {
      const choice = await openConfirmModal({
        title: 'Export selection only?',
        message: 'You have a selection in the editor. Do you want to export only the selection?'
      })
      selectionOnly = choice
    }

    if (selectionOnly && editor.state.selection.empty) {
      await openAlertModal({
        title: 'Export selection',
        message: 'Select content in the editor to export only a selection.'
      })
      return null
    }

    const htmlFragment = sanitizeHtmlForOffice(buildActiveEditorHtml(context, selectionOnly))
    const docTitle = options.suggestedName || context.activeDocument?.document?.name || 'export'

    let outputPath = options.outputPath
    if (!outputPath && Platform.isDesktopPlatform) {
      const lastDir = getLastExportDir()
      const baseDir =
        lastDir ||
        context.activeDocument?.document?.dirPath ||
        nodeApi.path.dirname(context.activeEntry.filePath)
      const defaultPath = baseDir ? nodeApi.path.join(baseDir, `${docTitle}.${format}`) : `${docTitle}.${format}`

      const filters = {
        docx: [{ name: $_('Word Document'), extensions: ['docx'] }],
        odt: [{ name: $_('OpenDocument Text'), extensions: ['odt'] }],
        odp: [{ name: $_('OpenDocument Presentation'), extensions: ['odp'] }]
      }

      outputPath = await window.api.saveDialogFile({
        title: `Export to ${format.toUpperCase()}`,
        defaultPath,
        filters: filters[format]
      })
    }

    const extensionEnsurer = {
      docx: ensureDocxExtension,
      odt: ensureOdtExtension,
      odp: ensureOdpExtension
    }
    const finalOutputPath = outputPath ? extensionEnsurer[format](outputPath) : `${docTitle}.${format}`
    const tempFileName = `dynadoc-${format}-export-${Date.now()}`
    const cssFilePathName = `${tempFileName}-styles.css`

    const localStagingDir = Platform.isDesktopPlatform ? nodeApi.path.dirname(finalOutputPath) : ''
    const tempFilePath = nodeApi.path.join(localStagingDir, `${tempFileName}-${Date.now()}.html`)
    const cssFilePath = nodeApi.path.join(localStagingDir, cssFilePathName)

    const cssContent = buildOfficeCss(context)
    if (cssContent.trim()) {
      await writeFileEnsuringDirAsync(cssFilePath, cssContent, 'utf-8')
    }

    let fullHtml = toCompleteOfficeHtml(htmlFragment, {
      title: docTitle,
      styles: cssContent.trim() ? [cssFilePath] : []
    })

    // Force self-closing tags for common XHTML void elements
    fullHtml = fullHtml.replace(
      /<(link|meta|img|br|hr|input|source|track|col|base|param|embed|wbr)([^>]*)>/gi,
      (match, tag, attrs) => {
        if (attrs.trim().endsWith('/')) return match
        return `<${tag}${attrs}/>`
      }
    )

    await writeFileEnsuringDirAsync(tempFilePath, fullHtml, 'utf-8')

    let resultPath = ''
    try {
      const conversionOptions = {
        ensureCompleteHtml: false,
        downloadOnWeb: false
      }

      if (format === 'docx') {
        resultPath = await convertHtmlFileToDocx(tempFilePath, finalOutputPath, conversionOptions)
      } else if (format === 'odt') {
        resultPath = await convertHtmlFileToOdt(tempFilePath, finalOutputPath, conversionOptions)
      } else if (format === 'odp') {
        resultPath = await convertHtmlFileToOdp(tempFilePath, finalOutputPath, conversionOptions)
      }

      if (typeof resultPath === 'string' && resultPath.toLowerCase().includes('error')) {
        throw new Error(resultPath)
      }
    } catch (error) {
      console.error(`${format.toUpperCase()} export failed:`, error)
      await openAlertModal({
        title: 'Export failed',
        message: `Unable to export the document to ${format.toUpperCase()}. ${String(error)}`.slice(0, 300)
      })
      return null
    } finally {
      try {
        await nodeApi.fsPromises.unlink(tempFilePath)
        if (cssContent.trim()) await nodeApi.fsPromises.unlink(cssFilePath)
      } catch {
        // ignore cleanup failure
      }
    }

    let resolvedPath = resultPath
    console.log(`[docx] Exported ${format.toUpperCase()} file path:`, { resultPath, resolvedPath, finalOutputPath, tempFilePath: tempFilePath })

    if (Platform.isDesktopPlatform && resolvedPath && resolvedPath !== finalOutputPath) {
      try {
        if (await nodeApi.fsPromises.exists(resolvedPath)) {
          await nodeApi.fsPromises.rename(resolvedPath, finalOutputPath)
          resolvedPath = finalOutputPath
        }
      } catch {
        // ignore move failure
      }
    }


    if (!resolvedPath) {
      await openAlertModal({
        title: 'Export failed',
        message: `${format.toUpperCase()} export did not produce a valid file.`
      })
      return null
    }

    if (Platform.isDesktopPlatform) {
      setLastExportDir(nodeApi.path.dirname(resolvedPath))
      const openFile = () => window.api.openFile(resolvedPath)
      const revealFile = () => window.api.openFile(nodeApi.path.dirname(resolvedPath))

      if (options.openAfterExport) openFile()
      else if (options.revealAfterExport) revealFile()

      showExportToast({
        id: TOAST_STYLE_ID,
        title: options.reasonLabel || `${format.toUpperCase()} export ready`,
        path: resolvedPath,
        onOpen: openFile,
        onReveal: revealFile
      })
    }

    if (context?.activeDocument) {
      recordDocumentExport(context.activeDocument, {
        format: format,
        target: format,
        outputPath: resolvedPath,
        selectionOnly,
        scope: selectionOnly ? 'selection' : 'document'
      })
    }

    await maybeDownloadConvertedFile(resolvedPath, nodeApi.path.basename(finalOutputPath))

    return resolvedPath

  } finally {
    EditorCommonUtils.toggleDocumentBodyLoading()
  }
}

