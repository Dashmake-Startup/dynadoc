import { createGenerator, type UnoGenerator } from '@unocss/core'
import unoConfig from '../../../../../uno.config'
import type { PaginationPlusOptions } from '../../extensions/tiptap/utils/common.utils'
import Utils from '../../utils/Utils'
import Platform from '../../libs/platform'
import type { Editor } from '@tiptap/core'
import { CustomVarExtensionProps } from '../../extensions/tiptap/CustomVarExtension/utils/common.utils'

import { Previewer } from 'pagedjs'

let _generator: UnoGenerator | null = null

async function getGenerator() {
  if (!_generator) {
    const config =
      typeof unoConfig === 'function' ? await (unoConfig as unknown as () => any)() : unoConfig
    _generator = await createGenerator(config)
  }
  return _generator
}

interface ExportOptions {
  editor: Editor
  html: string
  css?: string
  domRoot?: HTMLElement
  paginationOptions?: PaginationPlusOptions
  outputPath?: string
  fileName?: string
  title?: string
  watermarkText?: string
  watermarkOpacity?: number
  watermarkSize?: number
  printOptions?: {
    landscape?: boolean
    pageSize?: string
    marginsType?: number | string
    margin?: { top?: number; bottom?: number; left?: number; right?: number }
    displayHeaderFooter?: boolean
    headerTemplate?: string
    footerTemplate?: string
    scale?: number
    pageRanges?: string
  }
  backgroundColor?: string
}

export async function debugExport(documentHtml) {
  // ──────────────────────────────────────────────────────────────────────────
  // 🔬 DEBUG HOOK: EXPORT LOCAL SOURCE FOR INSPECTION
  // ──────────────────────────────────────────────────────────────────────────
  const DEBUG_EXPORT_SOURCE = true // Set to false to disable in production

  if (DEBUG_EXPORT_SOURCE) {
    try {
      if (Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop && api?.saveDebugFile) {
        // Desktop environment: Write directly to your project or local disk via IPC
        await api.saveDebugFile(documentHtml, 'debug-dump.html')
        console.log('🔬 [Debug] Raw HTML payload successfully dumped via IPC.')
      } else {
        // Web Browser / Fallback environment: Trigger an instant browser-managed download
        const blob = new Blob([documentHtml], { type: 'text/html;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `debug-${'export'}.html`)
        // link.setAttribute('download', `debug-${'export'}-${Date.now()}.html`);
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        console.log('🔬 [Debug] Raw HTML snapshot triggered as a web client download.')
      }
    } catch (debugErr) {
      console.error('🔬 [Debug] Failed to capture HTML trace snapshot:', debugErr)
    }
  }
}
export async function exportWithPagedJs(
  editorEl: HTMLElement,
  options: ExportOptions,
  filename = `document`
) {
  // 1. Serialize out the document content cleanly
  const resolvedHtml = serializeEditorDom(editorEl, options.paginationOptions, options.editor)

  if (!resolvedHtml) return null

  // 2. High-Performance Token Analysis via UnoCSS
  // This extracts only the active core utility styles used directly inside the text
  const generator = await getGenerator()
  const { css: generatedCss } = await generator.generate(resolvedHtml)

  // 3. Tree-Shake Runtime Styles
  // Parses active global styles but drops everything unmatched by the document markup
  const cleanRuntimeCss = collectUsedRuntimeStyles(resolvedHtml)

  const watermarkText = options.watermarkText?.trim()
  const watermarkOpacity =
    typeof options.watermarkOpacity === 'number' ? options.watermarkOpacity : 0.08
  const watermarkSize = typeof options.watermarkSize === 'number' ? options.watermarkSize : 42
  const fontCss = buildExportFontCss(editorEl)
  const { html, domRoot, backgroundColor = '#ffffff' } = options

  const watermarkHtml = watermarkText
    ? `<div class="ddoc-watermark" data-watermark="${watermarkText.replace(/"/g, '&quot;')}"></div>`
    : ''

  const cs = getComputedStyle(editorEl)
  const pageW = cs.getPropertyValue('--rm-page-width').trim() || '794px'
  const pageH = cs.getPropertyValue('--rm-page-height').trim() || '1123px'
  const mT = cs.getPropertyValue('--rm-margin-top').trim() || '20px'
  const mB = cs.getPropertyValue('--rm-margin-bottom').trim() || '20px'
  const mL = cs.getPropertyValue('--rm-margin-left').trim() || '50px'
  const mR = cs.getPropertyValue('--rm-margin-right').trim() || '50px'
  const toIn = (px: string) => `${parseFloat(px) / 96}in`

  // 1. Clone and clean the editor DOM
  const clone = editorEl.cloneNode(true) as HTMLElement
  ;[
    '.ProseMirror-widget',
    '.drag-handle-ui',
    '#bubble-menu-widget',
    '.rm-pagination-gap',
    '.rm-page-footer',
    '.rm-page-header',
    '.rm-pages-wrapper',
    '[data-no-print]',
    '.lt-error-underline',
    '.collaboration-cursor__caret',
    '.ProseMirror-trailingBreak'
  ].forEach((sel) => clone.querySelectorAll(sel).forEach((e) => e.remove()))
  clone.removeAttribute('contenteditable')

  // 2. Build a full HTML string with all styles inlined
  let allCSS = Array.from(document.styleSheets)
    .flatMap((s) => {
      try {
        return Array.from(s.cssRules).map((r) => r.cssText)
      } catch {
        return []
      }
    })
    .join('\n')

  allCSS = ''

  // 3. Open a hidden iframe for Paged.js to work in
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none'
  // iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none'
  document.body.appendChild(iframe)

  const documentHtml1 = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
   html, body {
            height: auto !important;
           /*  min-height: 0 !important; */
            overflow: visible !important;
          }

    /* All app styles */
    ${allCSS}
     ${generatedCss}
          ${cleanRuntimeCss}
          ${options.css || ''}
          ${fontCss}

    /* Paged.js @page definition using exact editor dimensions */
    /* @page {
      size: ${toIn(pageW)} ${toIn(pageH)};
      margin: ${toIn(mT)} ${toIn(mR)} ${toIn(mB)} ${toIn(mL)};
    } */
   @page {
              size: A4 portrait;
              /* Clears browser headers/footers default margins */
              /* margin: 0;  */
              margin-left: 0px; 
              margin-right: 0px; 
              /* margin-top: ${(options.paginationOptions?.marginTop ?? 0) / 2}px;  */
              margin-top: ${options.paginationOptions?.contentMarginTop ?? 0}px; 
              /* margin-bottom: ${(options.paginationOptions?.marginBottom ?? 0) + (options.paginationOptions?.contentMarginBottom ?? 0)}px;  */
              margin-bottom: ${(options.paginationOptions?.contentMarginBottom ?? 0) * 3}px; 
            }

    /* Map TipTap pagination markers to CSS page breaks */
    .rm-page-break {
      break-before: page;
      page-break-before: always;
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
            background-color: ${backgroundColor} !important;
          }


          
          .editor-content {
            display: flex !important;
          }
          .tiptap-content {
            width: ${options.paginationOptions?.pageWidth}px !important;
          }
          .rm-with-pagination {
            background: ${backgroundColor} !important;
          }
          .rm-page-break,
          .rm-pagination-gap,
          .rm-page-header,
          .rm-page-footer,
          .rm-first-page-header,
          .page {
            background-color: ${backgroundColor} !important;
          }
          .rm-pagination-gap, 
          .rm-page-footer {
            display: none !important;
          }

    @media print {
            @page {
              size: A4 portrait;
              /* Clears browser headers/footers default margins */
              /* margin: 0;  */
              margin-left: 0px; 
              margin-right: 0px; 
              /* margin-top: ${(options.paginationOptions?.marginTop ?? 0) / 2}px;  */
              margin-top: ${options.paginationOptions?.contentMarginTop ?? 0}px; 
              /* margin-bottom: ${(options.paginationOptions?.marginBottom ?? 0) + (options.paginationOptions?.contentMarginBottom ?? 0)}px;  */
              margin-bottom: ${(options.paginationOptions?.contentMarginBottom ?? 0) * 3}px; 
            }
            
            body {
              width: 210mm;
              height: 297mm;
            }

            .rm-page-header,
            .rm-page-footer,
            .rm-first-page-header
            {
              padding-top: 0 !important;
            }
          }
  </style>
</head>
<body>
        ${watermarkHtml}
        <div class="tiptap-content">
          ${resolvedHtml}
        </div>
      </body>
</html>`

  const documentHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>

  .ProseMirror,
    .tiptap {
     width: auto !important;
    }

    /* All app styles */
    ${allCSS}


    /* Paged.js @page definition using exact editor dimensions */
    /* @page {
      size: ${toIn(pageW)} ${toIn(pageH)};
      margin: ${toIn(mT)} ${toIn(mR)} ${toIn(mB)} ${toIn(mL)};
    } */

    /* Map TipTap pagination markers to CSS page breaks */
    .rm-page-break {
      break-before: page;
      page-break-before: always;
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

     html, body {
            background-color: ${backgroundColor} !important;
          }


          
          .editor-content {
            display: flex !important;
          }
          .tiptap-content {
            width: ${options.paginationOptions?.pageWidth}px !important;
          }
          .rm-with-pagination {
            background: ${backgroundColor} !important;
          }
          .rm-page-break,
          .rm-pagination-gap,
          .rm-page-header,
          .rm-page-footer,
          .rm-first-page-header,
          .page {
            background-color: ${backgroundColor} !important;
          }
          .rm-pagination-gap, 
          .rm-page-footer {
            display: none !important;
          }

    @media print {
            @page {
              size: A4 portrait;
              /* Clears browser headers/footers default margins */
              /* margin: 0;  */
              margin-left: 0px; 
              margin-right: 0px; 
              /* margin-top: ${(options.paginationOptions?.marginTop ?? 0) / 2}px;  */
              margin-top: ${options.paginationOptions?.contentMarginTop ?? 0}px; 
              /* margin-bottom: ${(options.paginationOptions?.marginBottom ?? 0) + (options.paginationOptions?.contentMarginBottom ?? 0)}px;  */
              margin-bottom: ${(options.paginationOptions?.contentMarginBottom ?? 0) * 3}px; 
            }
            
            body {
              width: 210mm;
              height: 297mm;
            }

            .rm-page-header,
            .rm-page-footer,
            .rm-first-page-header
            {
              padding-top: 0 !important;
            }
          }

  </style>
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`

  // ${clone.outerHTML}

  // debugExport(documentHtml)

  const iDoc = iframe.contentDocument!
  iDoc.open()
  iDoc.write(documentHtml)
  iDoc.close()

  // 4. Run Paged.js inside the iframe
  /*  const previewer = new Previewer()
   await previewer.preview(
     iDoc.body.innerHTML,
     [{ url: '' }],  // no external stylesheets needed — all inlined above
     iDoc.body
   ) */

  // 5. Print the iframe (user gets Save as PDF dialog)
  iframe.contentWindow!.focus()
  iframe.contentWindow!.print()

  // 6. Cleanup
  // window.addEventListener('afterprint', () => iframe.remove(), { once: true })
}

export async function exportWithPagedJs222(
  editorEl: HTMLElement,
  options: ExportOptions,

  filename = `document`
): Promise<void> {
  // ── 1. Read exact dimensions from TipTap's CSS variables ─────────────────
  const cs = getComputedStyle(editorEl)
  const readPx = (v: string, fallback: number) =>
    parseFloat(cs.getPropertyValue(v).trim()) || fallback

  const pageWpx = readPx('--rm-page-width', 794)
  const pageHpx = readPx('--rm-page-height', 1123)
  const mTpx = readPx('--rm-margin-top', 20)
  const mBpx = readPx('--rm-margin-bottom', 20)
  const mLpx = readPx('--rm-margin-left', 50)
  const mRpx = readPx('--rm-margin-right', 50)
  const toIn = (px: number) => `${(px / 96).toFixed(4)}in`

  // ── 2. Collect all CSS variables from the live theme ─────────────────────
  const rootVars = collectCSSVariables()

  // ── 3. Collect all stylesheets ────────────────────────────────────────────
  const allCSS = collectAllStyles()

  // ── 4. Clone and clean the editor DOM ────────────────────────────────────
  const contentHTML = buildCleanHTML(editorEl, pageWpx)

  // ── 5. Build the full document HTML ──────────────────────────────────────
  const fullHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /* Theme variables */
    ${rootVars}

    /* All app CSS */
    ${allCSS}

    /* Paged.js page definition */
    @page {
      size: ${toIn(pageWpx)} ${toIn(pageHpx)};
      margin: ${toIn(mTpx)} ${toIn(mRpx)} ${toIn(mBpx)} ${toIn(mLpx)};
    }

    /* ── CRITICAL: reset body so Paged.js can measure full content ── */
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      /* Do NOT set height/overflow here — Paged.js needs auto height */
      width: ${pageWpx}px !important;
      background: white !important;
      visibility: visible !important;
      overflow: auto !important;
    }

    /* ── CRITICAL: strip ALL overflow:hidden from editor chain ── */
    .ProseMirror,
    .tiptap,
    [class*="editor"],
    [class*="content"] {
      overflow: visible !important;
      height: auto !important;
      max-height: none !important;
    }

    /* Strip pagination plugin's own page visual chrome */
    .rm-pages-wrapper,
    .rm-pagination-gap,
    .rm-page-footer,
    .rm-page-header,
    .rm-first-page-header,
    .rm-page-break > .breaker {
      display: none !important;
    }

    /* ── CRITICAL: the actual page break signal ── */
    /* TipTap pagination inserts .rm-page-break wrappers.
       We keep the .page div inside them and use it as the break trigger. */
    .rm-page-break > .page {
      break-before: page !important;
      page-break-before: always !important;
      display: block !important;
      height: 0 !important;
      overflow: hidden !important;
    }

    /* Colour fidelity */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* Strip interactive chrome */
    .ProseMirror-widget,
    .drag-handle-ui,
    .custom-drag-handle-ui,
    #bubble-menu-widget,
    [data-no-print],
    .lt-error-underline,
    .collaboration-cursor__caret,
    .collaboration-cursor__label,
    .ProseMirror-trailingBreak {
      display: none !important;
    }
  </style>
</head>
<body>
  ${contentHTML}
</body>
</html>`

  // ── 6. Create a VISIBLE iframe with correct page dimensions ──────────────
  // CRITICAL: must not be 0×0. Paged.js measures rendered dimensions.
  const iframe = document.createElement('iframe')
  iframe.style.cssText = [
    `position: fixed`,
    `top: 0`,
    `left: 0`,
    // Match exact page width so layout is identical to editor
    `width: ${pageWpx}px`,
    // Tall enough to hold all content — Paged.js will paginate it
    `height: ${pageHpx}px`,
    `border: none`,
    `background: white`,
    // Keep it off-screen but NOT display:none or visibility:hidden
    // (those prevent layout calculation)
    `transform: translateX(-9999px)`,
    `z-index: -1`,
    `pointer-events: none`
  ].join(';')

  document.body.appendChild(iframe)

  // debugExport(fullHTML)
  // debugExport(iframe.contentDocument?.documentElement.outerHTML)

  try {
    await renderAndPrint(iframe, fullHTML, pageWpx, pageHpx)
  } finally {
    return
    // Cleanup after print dialog closes
    const cleanup = () => {
      iframe.remove()
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup, { once: true })
    // Fallback cleanup if afterprint never fires (mobile)
    setTimeout(cleanup, 60_000)
  }
}

export async function exportWithPagedJs11(
  editorEl: HTMLElement,
  options: ExportOptions,

  filename = `document`
): Promise<void> {
  const cs = getComputedStyle(editorEl)
  const readPx = (v: string, fallback: number) =>
    parseFloat(cs.getPropertyValue(v).trim()) || fallback

  const pageWpx = readPx('--rm-page-width', 794)
  const pageHpx = 3000
  // const pageHpx = readPx('--rm-page-height', 1123)
  const mTpx = readPx('--rm-margin-top', 20)
  const mBpx = readPx('--rm-margin-bottom', 20)
  const mLpx = readPx('--rm-margin-left', 50)
  const mRpx = readPx('--rm-margin-right', 50)
  const toIn = (px: number) => `${(px / 96).toFixed(4)}in`

  const rootVars = collectCSSVariables()
  const contentHTML = buildCleanHTML(editorEl, pageWpx)

  // 1. Grab all live style/link tags directly from the main document head
  // This preserves exact source order, font links, and bundle paths.
  const headElements = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join('\n')

  const fullHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  
  ${headElements}

  <style>
    /* Theme variables override */
    ${rootVars}

    @page {
      size: ${toIn(pageWpx)} ${toIn(pageHpx)};
      margin: ${toIn(mTpx)} ${toIn(mRpx)} ${toIn(mBpx)} ${toIn(mLpx)};
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${pageWpx}px !important;
      background: white !important;
    }

    .ProseMirror, .tiptap, [class*="editor"] {
      overflow: visible !important;
      height: auto !important;
      max-height: none !important;
    }

    .rm-pages-wrapper, .rm-pagination-gap, .rm-page-footer, .rm-page-header {
      display: none !important;
    }

    .rm-page-break > .page {
      break-before: page !important;
      page-break-before: always !important;
      display: block !important;
      height: 0 !important;
      overflow: hidden !important;
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .ProseMirror-widget, [data-no-print], .collaboration-cursor__label {
      display: none !important;
    }
  </style>
</head>
<body>
  <div class="print-content-wrapper">
    ${contentHTML}
  </div>
</body>
</html>`

  const iframe = document.createElement('iframe')
  iframe.style.cssText = [
    `position: fixed`,
    `top: 0`,
    `left: 0`,
    `width: ${pageWpx}px`,
    `height: 3000px`,
    `border: none`,
    `background: white`,
    `transform: translateX(-9999px)`,
    `z-index: -1`,
    `pointer-events: none`
  ].join(';')

  document.body.appendChild(iframe)

  try {
    await renderAndPrint(iframe, fullHTML)
  } finally {
    const cleanup = () => {
      iframe.remove()
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup, { once: true })
    setTimeout(cleanup, 60_000)
  }
}

async function renderAndPrint(iframe: HTMLIFrameElement, fullHTML: string): Promise<void> {
  const iWin = iframe.contentWindow!
  const iDoc = iframe.contentDocument!

  iDoc.open()
  iDoc.write(fullHTML)
  iDoc.close()

  // Wait for stylesheet links and assets to resolve inside the iframe
  await new Promise<void>((resolve) => {
    if (iDoc.readyState === 'complete') return resolve()
    iframe.addEventListener('load', () => resolve(), { once: true })
  })

  await iDoc.fonts.ready

  const previewer = new Previewer()

  // Select your clean target wrapper to ensure styling context is intact
  const targetContent =
    iDoc.querySelector('.print-content-wrapper')?.innerHTML || iDoc.body.innerHTML
  iDoc.body.innerHTML = ''

  await previewer.preview(targetContent, [], iDoc.body)

  await new Promise<void>((resolve) => {
    iDoc.addEventListener('rendered', () => resolve(), { once: true })
    setTimeout(resolve, 4000)
  })

  await new Promise((r) => requestAnimationFrame(r))

  iWin.focus()
  iWin.print()
}

function buildCleanHTML(editorEl: HTMLElement, pageWpx: number): string {
  const clone = editorEl.cloneNode(true) as HTMLElement

  // Retain all your existing clean-up selectors here...
  clone.removeAttribute('contenteditable')

  return clone.outerHTML
}

function collectCSSVariables(): string {
  const vars: Record<string, string> = {}
  const rs = getComputedStyle(document.documentElement)
  for (const prop of Array.from(rs)) {
    if (prop.startsWith('--')) {
      vars[prop] = rs.getPropertyValue(prop).trim()
    }
  }
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')
  return `:root {\n${body}\n}`
}

/**
 * High-Fidelity Tiptap to PDF Export
 *
 * Prints the LIVE rendered DOM directly via event.sender.printToPDF().
 * No HTML serialization, no UnoCSS extraction, no CSS reconstruction.
 * The tiptap editor's own rendering IS the PDF source.
 * @media print rules in main.css hide all UI chrome automatically.
 */
export async function exportTiptapToPdf(options: ExportOptions) {
  const api = (window as any)?.api
  if (!api?.exportToPDF) {
    console.error('exportTiptapToPdf: window.api not available')
    return null
  }

  // Read exact page dimensions from TipTap's CSS variables (set by the pagination plugin)
  const editorEl = options.domRoot || (document.querySelector('.tiptap-content') as HTMLElement)
  const cs = editorEl ? getComputedStyle(editorEl) : null
  const readPx = (varName: string, fallback: number): number => {
    const val = cs?.getPropertyValue(varName)?.trim()
    return val ? parseFloat(val) || fallback : fallback
  }

  // Prefer values from pagination options (most accurate), then CSS vars, then hardcoded A4
  const pageWpx = options.paginationOptions?.pageWidth || readPx('--rm-page-width', 794)
  const pageHpx = options.paginationOptions?.pageHeight || readPx('--rm-page-height', 1123)

  // Convert px → inches (96 px/inch) for Electron's printToPDF pageSize
  const toInches = (px: number) => px / 96

  const suggestedName = options.fileName || 'export.pdf'

  // Compute margins from user's pagination options
  let margins: any = { marginType: 'none', top: 0, bottom: 0, left: 0, right: 0 }
  if (options.paginationOptions?.enabled) {
    margins = {
      marginType: 'custom',
      top: toInches(options.paginationOptions.marginTop ?? 0),
      bottom: toInches(options.paginationOptions.marginBottom ?? 0),
      left: toInches(options.paginationOptions.marginLeft ?? 0),
      right: toInches(options.paginationOptions.marginRight ?? 0)
    }
  }

  const printOptions = {
    landscape: options.printOptions?.landscape ?? false,
    printBackground: true,
    preferCSSPageSize: false,
    pageSize: {
      width: toInches(pageWpx),
      height: toInches(pageHpx)
    },
    margins
  }

  if (Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop) {
    if (!api?.saveDialogFile) {
      console.error('exportTiptapToPdf: saveDialogFile not available on desktop build')
      return null
    }

    let outputPath = options.outputPath
    if (!outputPath) {
      outputPath = await api.saveDialogFile({
        title: 'Export to PDF',
        defaultPath: suggestedName,
        filters: [{ name: 'PDF', extensions: [Utils.FILE_TYPES.pdf] }]
      })
    }
    if (!outputPath) return null

    await api.exportToPDF(
      {
        printFromSender: true,
        pageWidth: pageWpx,
        pageHeight: pageHpx,
        printOptions,
        fileName: suggestedName
      },
      outputPath
    )
    return outputPath
  }

  // Web / non-desktop fallback
  await api.exportToPDF({
    printFromSender: true,
    pageWidth: pageWpx,
    pageHeight: pageHpx,
    printOptions,
    fileName: suggestedName
  })
  return suggestedName
}

function serializeEditorDom(
  root: HTMLElement,
  paginationOptions?: PaginationPlusOptions,
  editorInstance?: any
): string {
  if (!root) return ''
  const sourceRoot = root
  const original = sourceRoot
  const clone = original.cloneNode(true) as HTMLElement

  const cleanupSelectors = [
    '.handles',
    '.node-view-controls',
    '.node-view-control',
    '.node-view-toolbar',
    '.node-view-slide-toolbar',
    '.node-view-slide-controls',
    '.node-view-floating-toolbar',
    '.node-view-resize-handles',
    '.selection-toolbar',
    '.bubble-menu',
    '.floating-menu'
  ]

  cleanupSelectors.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((el) => el.remove())
  })

  // ──────────────────────────────────────────────────────────────────────────
  // 🚀 DYNAMIC MULTI-NODE TRANSFORMATION PIPELINE
  // ──────────────────────────────────────────────────────────────────────────
  if (editorInstance?.extensionManager?.extensions) {
    const extensions = editorInstance.extensionManager.extensions

    extensions.forEach((ext: any) => {
      // Check if your custom configuration strategy exists on the extension block
      if (typeof ext.config?.toStaticHTML === 'function') {
        // Look up target nodes based on extension layout identifiers
        // For your variables, it targets '.variable-chip[data-variable]' or matching tags
        const selector =
          ext.config.name === CustomVarExtensionProps.name
            ? `.${CustomVarExtensionProps.tagAttributeClass}[${CustomVarExtensionProps.tagAttributeDataVariable}]`
            : // ? '.variable-chip[data-variable]'
              ext.config.parseHTML?.()?.[0]?.tag || ext.config.name

        if (selector) {
          // Process nodes backwards using Array.from to prevent live DOM collection updates from breaking the index
          Array.from(clone.querySelectorAll<HTMLElement>(selector)).forEach((nodeItem) => {
            ext.config.toStaticHTML(nodeItem)
          })
        }
      }
    })
  }
  // ──────────────────────────────────────────────────────────────────────────

  clone.querySelectorAll('[contenteditable]').forEach((el) => {
    el.removeAttribute('contenteditable')
    el.removeAttribute('role')
    el.removeAttribute('tabindex')
  })

  clone.querySelectorAll('.ProseMirror-trailingBreak').forEach((el) => el.remove())
  clone.querySelectorAll('.ProseMirror-gapcursor').forEach((el) => el.remove())

  clone.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const style = el.getAttribute('style')
    if (!style) return
    const sanitized = style
      .split(';')
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .filter((rule) => {
        const lower = rule.toLowerCase()
        if (lower.startsWith('overflow') && lower.includes('hidden')) return false
        if (lower.startsWith('height') && (lower.includes('100%') || lower.includes('100vh')))
          return false
        if (lower.startsWith('max-height') && (lower.includes('100%') || lower.includes('100vh')))
          return false
        if (lower.startsWith('position') && lower.includes('fixed')) return false
        return true
      })
      .join('; ')
    if (sanitized) {
      el.setAttribute('style', sanitized)
    } else {
      el.removeAttribute('style')
    }
  })

  const canvasData: string[] = []
  const canvasSizes: Array<{ width: number; height: number }> = []
  original.querySelectorAll('canvas').forEach((canvas) => {
    try {
      canvasData.push(canvas.toDataURL('image/png'))
      const rect = canvas.getBoundingClientRect()
      canvasSizes.push({
        width: rect.width || canvas.width,
        height: rect.height || canvas.height
      })
    } catch (error) {
      console.warn('PDF export: unable to snapshot canvas', error)
      canvasData.push('')
      canvasSizes.push({ width: canvas.width, height: canvas.height })
    }
  })

  const originalCanvases = Array.from(original.querySelectorAll('canvas'))
  const clonedCanvases = Array.from(clone.querySelectorAll('canvas'))
  clonedCanvases.forEach((canvas, index) => {
    const dataUrl = canvasData[index]
    if (!dataUrl) return
    const img = document.createElement('img')
    img.src = dataUrl
    const source = originalCanvases[index] as HTMLCanvasElement | undefined
    const fallbackWidth = source?.width || (canvas as HTMLCanvasElement).width
    const fallbackHeight = source?.height || (canvas as HTMLCanvasElement).height
    const size = canvasSizes[index]
    const width = size?.width || fallbackWidth
    const height = size?.height || fallbackHeight
    if (width) img.style.width = `${width}px`
    if (height) img.style.height = `${height}px`
    img.style.maxWidth = '100%'
    img.style.display = 'block'
    canvas.replaceWith(img)
  })

  applyPaginationHeaderFooter(clone, paginationOptions)

  // Ensure pagination header/footer layout survives PDF export.
  const copyComputedStyles = (selector: string, properties: string[]) => {
    const originalNodes = Array.from(original.querySelectorAll<HTMLElement>(selector))
    const clonedNodes = Array.from(clone.querySelectorAll<HTMLElement>(selector))
    const count = Math.min(originalNodes.length, clonedNodes.length)
    for (let i = 0; i < count; i += 1) {
      const source = originalNodes[i]
      const target = clonedNodes[i]
      const computed = window.getComputedStyle(source)
      for (const prop of properties) {
        const value = computed.getPropertyValue(prop)
        if (!value) continue
        target.style.setProperty(prop, value.trim())
      }
    }
  }

  copyComputedStyles('.rm-page-header', [
    'padding-top',
    'padding-bottom',
    'display',
    'justify-content',
    'max-height',
    'overflow-y',
    'width'
  ])
  copyComputedStyles('.rm-page-header-left', ['display', 'float', 'margin-left'])
  copyComputedStyles('.rm-page-header-right', ['display', 'float', 'margin-right'])
  copyComputedStyles('.rm-page-footer', [
    'padding-top',
    'padding-bottom',
    'display',
    'justify-content',
    'max-height',
    'overflow-y',
    'width'
  ])
  copyComputedStyles('.rm-page-footer-left', ['display', 'float', 'margin-left'])
  copyComputedStyles('.rm-page-footer-right', ['display', 'float', 'margin-right'])
  /* copyComputedStyles('.rm-pagination-gap', [
    'height',
    'background-color',
    'border-top-width',
    'border-top-style',
    'border-top-color',
    'border-bottom-width',
    'border-bottom-style',
    'border-bottom-color',
    'border-left-width',
    'border-left-style',
    'border-left-color',
    'border-right-width',
    'border-right-style',
    'border-right-color',
    'width',
    'left'
  ]) */

  return clone.outerHTML
}

/**
 * Business-level Tree Shaking: Filters out all unused CSS selectors using a temporary fragment
 */
function collectUsedRuntimeStyles11(resolvedHtml: string): string {
  let matchedCss = ''

  // Create a headless context fragment to run element selector evaluations quickly
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${resolvedHtml}</div>`, 'text/html')

  // Helper logic to run selector evaluations safely without layout costs
  const isSelectorUsed = (selector: string): boolean => {
    try {
      // Clean up print, pseudo-elements, and dynamic state suffixes to test basic selectors
      const cleanSelector = selector
        .replace(/::?[a-zA-Z-]+/g, '') // Strips :hover, ::before, ::after
        .replace(/>/g, ' ') // Flattens direct child selectors
        .replace(/\+/g, ' ') // Flattens siblings
        .replace(/~/g, ' ')
        .trim()

      if (
        !cleanSelector ||
        cleanSelector === '*' ||
        cleanSelector === 'html' ||
        cleanSelector === 'body'
      ) {
        return true // Retain engine global scopes
      }

      return doc.querySelector(cleanSelector) !== null
    } catch {
      // If selector formatting is specialized (e.g. keyframe definitions), keep it to avoid missing layout visuals
      return true
    }
  }

  // Look through standard injected layout document styles
  const styleElements = Array.from(document.querySelectorAll('style'))
  for (const style of styleElements) {
    if (style.hasAttribute('data-vite-theme')) continue // Drop development-specific UI blocks instantly

    // If it looks like standard text rules, extract them cleanly
    const content = style.textContent || ''
    if (content.length < 2000) {
      matchedCss += `${content}\n`
    }
  }

  // Extract, parse, and shake down compound rules across stylesheets
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules
      if (!rules) continue

      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule) {
          // Split compound selectors (e.g., ".classA, .classB") and test if any are used
          const dynamicSelectors = rule.selectorText.split(',')
          const hasMatch = dynamicSelectors.some((sel) => isSelectorUsed(sel.trim()))

          if (hasMatch) {
            matchedCss += `${rule.cssText}\n`
          }
        } else if (
          rule instanceof CSSMediaRule ||
          rule instanceof CSSFontFaceRule ||
          rule instanceof CSSKeyframesRule
        ) {
          // Keep print queries, fonts, and animation blocks unconditionally
          matchedCss += `${rule.cssText}\n`
        }
      }
    } catch {
      // Bypass locked cross-origin tracking rules cleanly
    }
  }

  return matchedCss
}

/**
 * Business-level Tree Shaking: Filters out all unused CSS selectors using a temporary fragment
 * and cleans up malformed arbitrary dynamic CSS tokens.
 */
function collectUsedRuntimeStyles(resolvedHtml: string): string {
  let matchedCss = ''

  // Create a headless context fragment to run element selector evaluations quickly
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${resolvedHtml}</div>`, 'text/html')

  // Helper logic to run selector evaluations safely without layout costs
  const isSelectorUsed = (selector: string): boolean => {
    try {
      // Clean up print, pseudo-elements, and dynamic state suffixes to test basic selectors
      const cleanSelector = selector
        .replace(/::?[a-zA-Z-]+/g, '') // Strips :hover, ::before, ::after
        .replace(/>/g, ' ') // Flattens direct child selectors
        .replace(/\+/g, ' ') // Flattens siblings
        .replace(/~/g, ' ')
        .trim()

      if (
        !cleanSelector ||
        cleanSelector === '*' ||
        cleanSelector === 'html' ||
        cleanSelector === 'body'
      ) {
        return true // Retain engine global scopes
      }

      return doc.querySelector(cleanSelector) !== null
    } catch {
      // If selector formatting is specialized (e.g. keyframe definitions), keep it to avoid missing layout visuals
      return true
    }
  }

  /**
   * Cleans malformed CSS property patterns that browser engines choke on when inlining.
   * Target: color: var(--bg-[var(--color-base-300)]) !important;
   */
  const cleanMalformedCssTokens = (cssText: string): string => {
    // Regex matches instances where `var(...)` contains illegal nested square brackets `[...]`
    // or unclosed dynamic custom variables stemming from complex compilation pipelines.
    return (
      cssText
        // Option A: Safely strip out properties that have an unparsed trailing bracket structure inside a var expression
        .replace(
          /[a-zA-Z-]+:\s*var\([^)]*\[[^\]]+\][^)]*\)[^;]*;/g,
          '/* Stripped malformed nested token */'
        )
        // Option B: Fallback catch-all for jagged tailwind arbitrary layout definitions that didn't process clean
        .replace(/--[a-zA-Z0-9-]+:\s*var\([^)]*\[.+;/g, '/* Stripped malformed variable root */')
    )
  }

  // Look through standard injected layout document styles
  const styleElements = Array.from(document.querySelectorAll('style'))
  for (const style of styleElements) {
    if (style.hasAttribute('data-vite-theme')) continue // Drop development-specific UI blocks instantly

    // If it looks like standard text rules, extract them cleanly
    const content = style.textContent || ''
    if (content.length < 2000) {
      matchedCss += `${cleanMalformedCssTokens(content)}\n`
    }
  }

  // Extract, parse, and shake down compound rules across stylesheets
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules
      if (!rules) continue

      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule) {
          // Split compound selectors (e.g., ".classA, .classB") and test if any are used
          const dynamicSelectors = rule.selectorText.split(',')
          const hasMatch = dynamicSelectors.some((sel) => isSelectorUsed(sel.trim()))

          if (hasMatch) {
            matchedCss += `${cleanMalformedCssTokens(rule.cssText)}\n`
          }
        } else if (rule instanceof CSSMediaRule) {
          // If it's a media query block, recursively filter or scrub its internal rule matches safely
          let internalRulesText = ''
          for (const subRule of Array.from(rule.cssRules)) {
            if (subRule instanceof CSSStyleRule) {
              const dynamicSelectors = subRule.selectorText.split(',')
              if (dynamicSelectors.some((sel) => isSelectorUsed(sel.trim()))) {
                internalRulesText += `${cleanMalformedCssTokens(subRule.cssText)}\n`
              }
            } else {
              internalRulesText += `${subRule.cssText}\n`
            }
          }
          if (internalRulesText.trim()) {
            matchedCss += `@media ${rule.conditionText} {\n${internalRulesText}}\n`
          }
        } else if (rule instanceof CSSFontFaceRule || rule instanceof CSSKeyframesRule) {
          // Keep fonts and animation blocks unconditionally
          matchedCss += `${rule.cssText}\n`
        }
      }
    } catch {
      // Bypass locked cross-origin tracking rules cleanly
    }
  }

  return matchedCss
}

function buildExportFontCss(root?: HTMLElement): string {
  if (typeof window === 'undefined' || !root) return ''
  const contentRoot = root.classList?.contains('ProseMirror')
    ? root
    : (root.querySelector('.ProseMirror') as HTMLElement) || root

  const parts: string[] = []
  try {
    const base = window.getComputedStyle(contentRoot)
    if (base?.fontFamily || base?.fontSize || base?.lineHeight) {
      parts.push(
        `.tiptap-content, .tiptap-content .ProseMirror {` +
          (base.fontFamily ? `font-family: ${base.fontFamily};` : '') +
          (base.fontSize ? `font-size: ${base.fontSize};` : '') +
          (base.lineHeight ? `line-height: ${base.lineHeight};` : '') +
          `}`
      )
    }

    const sampleSelectors = ['h1', 'h2', 'h3', 'p']
    for (const selector of sampleSelectors) {
      const el = contentRoot.querySelector(selector) as HTMLElement | null
      if (!el) continue
      const style = window.getComputedStyle(el)
      if (!style) continue
      parts.push(
        `.tiptap-content ${selector} {` +
          (style.fontFamily ? `font-family: ${style.fontFamily};` : '') +
          (style.fontSize ? `font-size: ${style.fontSize};` : '') +
          (style.lineHeight ? `line-height: ${style.lineHeight};` : '') +
          (style.fontWeight ? `font-weight: ${style.fontWeight};` : '') +
          // (style.margin ? `margin: ${style.margin};` : 'inherit') +
          `}`
      )
    }
  } catch {
    return ''
  }

  return parts.join('\n')
}

function applyPaginationHeaderFooter(root: HTMLElement, options?: PaginationPlusOptions) {
  if (!root || !options) return
  const commonHeaderLeft = options.headerLeft ?? ''
  const commonHeaderRight = options.headerRight ?? ''
  const commonFooterLeft = options.footerLeft ?? ''
  const commonFooterRight = options.footerRight ?? ''
  const customHeader = options.customHeader ?? {}
  const customFooter = options.customFooter ?? {}

  const resolveCustom = (map: Record<string, any>, key: number) => {
    return map?.[key] ?? map?.[String(key)] ?? null
  }

  const replaceHeaderPage = (value: string) =>
    String(value ?? '').replace('{page}', '<span class="rm-page-number-plus"></span>')
  const replaceFooterPage = (value: string) =>
    String(value ?? '').replace('{page}', '<span class="rm-page-number"></span>')

  const updateHeaderNodes = (
    headerEl: HTMLElement | null,
    headerLeft: string,
    headerRight: string
  ) => {
    if (!headerEl) return
    const left = headerEl.querySelector<HTMLElement>('.rm-page-header-left')
    const right = headerEl.querySelector<HTMLElement>('.rm-page-header-right')
    if (left) left.innerHTML = replaceHeaderPage(headerLeft)
    if (right) right.innerHTML = replaceHeaderPage(headerRight)
  }

  const updateFooterNodes = (
    footerEl: HTMLElement | null,
    footerLeft: string,
    footerRight: string
  ) => {
    if (!footerEl) return
    const left = footerEl.querySelector<HTMLElement>('.rm-page-footer-left')
    const right = footerEl.querySelector<HTMLElement>('.rm-page-footer-right')
    if (left) left.innerHTML = replaceFooterPage(footerLeft)
    if (right) right.innerHTML = replaceFooterPage(footerRight)
  }

  const injectPageNumbers = (
    rootEl: HTMLElement | null,
    pageNumber: number,
    headerPageNumber?: number
  ) => {
    if (!rootEl) return
    const headerNumber = headerPageNumber ?? pageNumber
    rootEl
      .querySelectorAll<HTMLElement>('.rm-page-number-plus')
      .forEach((el) => (el.textContent = String(headerNumber)))
    rootEl
      .querySelectorAll<HTMLElement>('.rm-page-number')
      .forEach((el) => (el.textContent = String(pageNumber)))
  }

  const pageBreaks = Array.from(root.querySelectorAll<HTMLElement>('.rm-page-break'))
  pageBreaks.forEach((pageBreak, index) => {
    const pageNumber = index + 1
    const headerPageNumber = index + 2
    const customHeaderOptions = resolveCustom(customHeader as any, headerPageNumber)
    const customFooterOptions = resolveCustom(customFooter as any, pageNumber)
    const headerLeft = customHeaderOptions?.headerLeft ?? commonHeaderLeft
    const headerRight = customHeaderOptions?.headerRight ?? commonHeaderRight
    const footerLeft = customFooterOptions?.footerLeft ?? commonFooterLeft
    const footerRight = customFooterOptions?.footerRight ?? commonFooterRight

    const headerEl = pageBreak.querySelector<HTMLElement>('.rm-page-header')
    const footerEl = pageBreak.querySelector<HTMLElement>('.rm-page-footer')
    updateHeaderNodes(headerEl, headerLeft, headerRight)
    updateFooterNodes(footerEl, footerLeft, footerRight)
    injectPageNumbers(pageBreak, pageNumber, headerPageNumber)
  })

  const firstHeader = root.querySelector<HTMLElement>('.rm-first-page-header')
  const firstHeaderOptions = resolveCustom(customHeader as any, 1)
  updateHeaderNodes(
    firstHeader,
    firstHeaderOptions?.headerLeft ?? commonHeaderLeft,
    firstHeaderOptions?.headerRight ?? commonHeaderRight
  )
  injectPageNumbers(firstHeader, 1, 1)
}
