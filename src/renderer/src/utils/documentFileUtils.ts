import '../lib/api'
import Platform from '../libs/platform'
import Utils from './Utils'
import { defaultPaginationOptions } from '../extensions/tiptap/utils/common.utils'
import { nodeApi } from './shims/node'
import {
  convertDocxFileToHtml,
  convertHtmlFileToDocx,
  stripOfficeExtension
} from '../services/conversion/officeConversion.service'

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path
// const fsPromises = nodeApi?.fsPromises

// function getFs() {
//   return (typeof window !== 'undefined' && (window as any).api?.node?.fs) as any
// }

// function getPath() {
//   return (typeof window !== 'undefined' && (window as any).api?.node?.path) as any
// }

function normalizePathForPlatform(inputPath: string): string {
  const raw = typeof inputPath === 'string' ? inputPath : String(inputPath ?? '')
  if (Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop) return raw
  return raw.replace(/^file:\/\//i, '').replace(/^\/+/, '')
}

function toPxFromCss(value: string): number | undefined {
  if (!value) return undefined
  const trimmed = value.trim().toLowerCase()
  const num = parseFloat(trimmed)
  if (!Number.isFinite(num)) return undefined
  if (trimmed.endsWith('px')) return num
  if (trimmed.endsWith('pt')) return (num * 96) / 72
  if (trimmed.endsWith('in')) return num * 96
  if (trimmed.endsWith('cm')) return num * 37.7952755906
  if (trimmed.endsWith('mm')) return num * 3.77952755906
  return undefined
}

function extractHtmlBlock(html: string, selectors: string[]): string | undefined {
  if (!html) return undefined
  for (const selector of selectors) {
    const classMatch = selector.startsWith('.')
    const dataMatch = selector.startsWith('data-')
    let regex: RegExp | null = null
    if (classMatch) {
      const className = selector.slice(1)
      regex = new RegExp(
        `<([a-z0-9]+)([^>]*\\sclass=["'][^"']*${className}[^"']*["'][^>]*)>([\\s\\S]*?)<\\/\\1>`,
        'i'
      )
    } else if (dataMatch) {
      const attr = selector
      regex = new RegExp(
        `<([a-z0-9]+)([^>]*\\s${attr}=["'][^"']*["'][^>]*)>([\\s\\S]*?)<\\/\\1>`,
        'i'
      )
    } else {
      regex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'i')
    }
    const match = html.match(regex)
    const inner = match?.[3] || match?.[1]
    if (inner && inner.trim()) return inner.trim()
  }
  return undefined
}

function extractPageFormatFromHtml(html: string): {
  pageWidth?: number
  pageHeight?: number
  marginTop?: number
  marginBottom?: number
  marginLeft?: number
  marginRight?: number
  headerLeft?: string
  headerRight?: string
  footerLeft?: string
  footerRight?: string
} | null {
  if (!html) return null
  const pageBlockMatch = html.match(/@page\\s*[^\\{]*\\{[^}]*\\}/i)
  const pageBlock = pageBlockMatch?.[0] || ''
  if (!pageBlock) return null

  const sizeMatch = pageBlock.match(/size\\s*:\\s*([^;}]*)/i)
  const sizeValue = sizeMatch?.[1]?.trim() || ''

  let pageWidth: number | undefined
  let pageHeight: number | undefined

  const namedSizes: Record<string, { width: number; height: number }> = {
    a4: { width: 8.27 * 96, height: 11.69 * 96 },
    letter: { width: 8.5 * 96, height: 11 * 96 },
    legal: { width: 8.5 * 96, height: 14 * 96 },
    a3: { width: 11.69 * 96, height: 16.54 * 96 },
    a5: { width: 5.83 * 96, height: 8.27 * 96 }
  }

  if (sizeValue) {
    const tokens = sizeValue.split(/\\s+/).filter(Boolean)
    const nameToken = tokens.find((t) => /^[a-z]+$/i.test(t) && namedSizes[t.toLowerCase()])
    if (nameToken) {
      const base = namedSizes[nameToken.toLowerCase()]
      pageWidth = base.width
      pageHeight = base.height
    }
    if (tokens.length >= 2) {
      const widthValue = toPxFromCss(tokens[0])
      const heightValue = toPxFromCss(tokens[1])
      if (widthValue) pageWidth = widthValue
      if (heightValue) pageHeight = heightValue
    }
  }

  const marginMatch = pageBlock.match(/margin\\s*:\\s*([^;}]*)/i)
  const marginValue = marginMatch?.[1]?.trim() || ''
  let marginTop: number | undefined
  let marginBottom: number | undefined
  let marginLeft: number | undefined
  let marginRight: number | undefined

  if (marginValue) {
    const tokens = marginValue.split(/\\s+/).filter(Boolean)
    if (tokens.length === 1) {
      const px = toPxFromCss(tokens[0])
      marginTop = px
      marginBottom = px
      marginLeft = px
      marginRight = px
    } else if (tokens.length === 2) {
      const v = toPxFromCss(tokens[0])
      const h = toPxFromCss(tokens[1])
      marginTop = v
      marginBottom = v
      marginLeft = h
      marginRight = h
    } else if (tokens.length === 3) {
      marginTop = toPxFromCss(tokens[0])
      marginLeft = toPxFromCss(tokens[1])
      marginRight = toPxFromCss(tokens[1])
      marginBottom = toPxFromCss(tokens[2])
    } else if (tokens.length >= 4) {
      marginTop = toPxFromCss(tokens[0])
      marginRight = toPxFromCss(tokens[1])
      marginBottom = toPxFromCss(tokens[2])
      marginLeft = toPxFromCss(tokens[3])
    }
  }

  return {
    pageWidth,
    pageHeight,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    headerLeft: extractHtmlBlock(html, [
      'data-ddoc-header-left',
      'data-header-left',
      '.header-left',
      '.page-header-left',
      '.ddoc-header-left',
      'header'
    ]),
    headerRight: extractHtmlBlock(html, [
      'data-ddoc-header-right',
      'data-header-right',
      '.header-right',
      '.page-header-right',
      '.ddoc-header-right'
    ]),
    footerLeft: extractHtmlBlock(html, [
      'data-ddoc-footer-left',
      'data-footer-left',
      '.footer-left',
      '.page-footer-left',
      '.ddoc-footer-left',
      'footer'
    ]),
    footerRight: extractHtmlBlock(html, [
      'data-ddoc-footer-right',
      'data-footer-right',
      '.footer-right',
      '.page-footer-right',
      '.ddoc-footer-right'
    ])
  }
}

export function writeFileEnsuringDir(
  filePath: string,
  content: string | Buffer | Uint8Array = '',
  encoding?: string
) {
  console.log('writeFileSyncwriteFileSync writeFileEnsuringDir', { filePath, content })

  const safePath = normalizePathForPlatform(filePath)
  if (!nodeApi.fsPromises?.mkdir || !nodeApi.path?.dirname || !nodeApi.fsPromises?.writeFile) {
    throw new Error('Filesystem API not available for writeFileEnsuringDir')
  }

  void (async () => {
    try {
      console.log('writeFileSyncwriteFileSync writeFileEnsuringDir mkdir', {
        filePath,
        content,
        encoding
      })
      await nodeApi.fsPromises.mkdir(nodeApi.path.dirname(safePath), { recursive: true })

      if (encoding) {
        console.log('writeFileSyncwriteFileSync writeFileEnsuringDir writeFile encoding', {
          filePath,
          content,
          encoding
        })
        await nodeApi.fsPromises.writeFile(safePath, content, encoding)
      } else {
        console.log('writeFileSyncwriteFileSync writeFileEnsuringDir writeFile else', {
          filePath,
          content,
          encoding
        })
        await nodeApi.fsPromises.writeFile(safePath, content)
      }
    } catch (err) {
      console.error('writeFileEnsuringDir failed:', err)
    }
  })()
}

export async function writeFileEnsuringDirAsync(
  filePath: string,
  content: string | Buffer | Uint8Array = '',
  encoding?: string
) {
  const safePath = normalizePathForPlatform(filePath)
  if (!nodeApi.fsPromises?.mkdir || !nodeApi.path?.dirname || !nodeApi.fsPromises?.writeFile) {
    throw new Error('Filesystem API not available for writeFileEnsuringDirAsync')
  }
  await nodeApi.fsPromises.mkdir(nodeApi.path.dirname(safePath), { recursive: true })
  if (encoding) {
    await nodeApi.fsPromises.writeFile(safePath, content, encoding)
    return
  }
  await nodeApi.fsPromises.writeFile(safePath, content)
}

export type UniqueNameOptions = {
  baseName: string
  parentDir: string
  extension?: string
  separator?: string
  copyStyle?: string | null
  sanitize?: boolean
}

// generateUniqueName was here, synchronous, and it is gone rather than
// converted: it had no call sites at all. The only thing reaching it was an
// unused import in models/Document.ts, removed with it. Every caller already
// uses generateUniqueNameAsync below, which is the same function written
// asynchronously -- so there was nothing to migrate, only something to
// delete. Two of the renderer's remaining synchronous filesystem calls were
// inside it.

export async function generateUniqueNameAsync({
  baseName,
  parentDir,
  extension = '',
  separator = ' ',
  copyStyle = null,
  sanitize = true
}: UniqueNameOptions): Promise<string> {
  if (!nodeApi.fsPromises?.readdir || !nodeApi.fsPromises?.mkdir || !nodeApi.path) {
    throw new Error('Filesystem API not available for generateUniqueNameAsync')
  }
  const rawBase = typeof baseName === 'string' ? baseName : String(baseName ?? '')
  let safeBase = sanitize ? rawBase.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim() : rawBase

  if (!safeBase) safeBase = 'Untitled'

  let existing: string[] = []
  const normalizedParent = normalizePathForPlatform(parentDir)
  try {
    existing = await nodeApi.fsPromises.readdir(normalizedParent)
  } catch {
    await nodeApi.fsPromises.mkdir(normalizedParent, { recursive: true })
  }

  const escaped = safeBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const numberRegex = copyStyle
    ? new RegExp(`^${copyStyle} ${escaped}(?:${separator}(\\d+))?${extension}$`)
    : new RegExp(`^${escaped}(?:${separator}(\\d+))?${extension}$`)

  let maxIndex = 0
  for (const name of existing) {
    const candidate = typeof name === 'string' ? name : String(name ?? '')
    const match = candidate.match(numberRegex)
    if (!match) continue
    const num = match[1] ? parseInt(match[1], 10) : 1
    if (num > maxIndex) maxIndex = num
  }

  if (maxIndex === 0) {
    return copyStyle ? `${copyStyle} ${safeBase}${extension}` : `${safeBase}${extension}`
  }

  return copyStyle
    ? `${copyStyle} ${safeBase}${separator}${maxIndex + 1}${extension}`
    : `${safeBase}${separator}${maxIndex + 1}${extension}`
}

export function getFileRootFromBaseDir(baseDir: string, filePath: string): string {
  // const path = getPath()
  if (!nodeApi.path?.relative || !nodeApi.path?.sep || !nodeApi.path?.join) {
    return baseDir
  }
  const relative = nodeApi.path.relative(baseDir, filePath)
  const parts = relative.split(nodeApi.path.sep)
  if (parts.length === 0) return baseDir

  const looksLikeUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

  const projectName = parts[0]
  const maybeDocName = parts[1]
  if (looksLikeUuid(projectName) && maybeDocName) {
    return nodeApi.path.join(baseDir, projectName, maybeDocName)
  }

  return nodeApi.path.join(baseDir, projectName)
}

export function toCompleteHTML(
  input: string,
  options: {
    title?: string
    lang?: string
    styles?: string[]
    scripts?: string[]
    meta?: { [name: string]: string }
  } = {}
): string {
  const {
    title = 'Document',
    lang = 'en',
    styles = [],
    scripts = [],
    meta = { charset: 'utf-8', viewport: 'width=device-width, initial-scale=1.0' }
  } = options

  let html = input.trim()

  html = html
    .replace(/<!doctype html[^>]*>/i, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .trim()

  const metaTags = Object.entries(meta)
    .map(([name, content]) =>
      name === 'charset'
        ? `<meta charset="${content}"/>`
        : `<meta name="${name}" content="${content}"/>`
    )
    .join('\n    ')

  const styleTags = styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('\n    ')
  const scriptTags = scripts.map((src) => `<script src="${src}"></script>`).join('\n    ')

  const head = `<head>
    ${metaTags}
    <title>${title}</title>
    ${styleTags}
    ${scriptTags}
  </head>`

  const body = `<body>
${html}
</body>`

  let xhtml = `<!DOCTYPE html>
<html lang="${lang}">
${head}
${body}
</html>`

  xhtml = xhtml
    .replace(/<br([^>]*)>/gi, '<br$1/>')
    .replace(/<hr([^>]*)>/gi, '<hr$1/>')
    .replace(/<img([^>]*)>/gi, '<img$1/>')
    .replace(/<col(?!group)([^>]*)>/gi, '<col$1/>')
    .replace(/&nbsp;/g, '&#160;')

  return xhtml
}

export async function convertDocxToHtml(
  filePath: string,
  outputPath: string,
  returnFilePath = true
): Promise<string> {
  if (
    !nodeApi.fsPromises?.mkdir ||
    !nodeApi.fsPromises?.exists ||
    !nodeApi.path?.extname ||
    !nodeApi.path?.dirname
  ) {
    throw new Error('Filesystem API not available for convertDocxToHtml')
  }
  const safeFilePath = normalizePathForPlatform(filePath)
  let resolvedOutput = normalizePathForPlatform(outputPath)
  if (nodeApi.path.extname(resolvedOutput).toLowerCase() === Utils.OFFICE_EXTENSIONS.word) {
    resolvedOutput = stripOfficeExtension(resolvedOutput)
  }

  try {
    let htmlPath = await convertDocxFileToHtml(safeFilePath, resolvedOutput, true)
    
    // If htmlPath is a directory, look for the first .html file
    const stat = await nodeApi.fsPromises.lstat(htmlPath).catch(() => null)
    if (stat?.isDirectory?.()) {
      const files = await nodeApi.fsPromises.readdir(htmlPath)
      const firstHtml = files.find((f) => f.toLowerCase().endsWith('.html'))
      if (firstHtml) {
        htmlPath = nodeApi.path.join(htmlPath, firstHtml)
      }
    }

    if (!(await nodeApi.fsPromises.exists(htmlPath))) {
      throw new Error(`Generated HTML not found: ${htmlPath}`)
    }

    const actualOutputDir = nodeApi.path.dirname(htmlPath)
    
    // Ensure the main file is named 'index.html' for standard structure
    const currentBaseName = nodeApi.path.basename(htmlPath, nodeApi.path.extname(htmlPath))
    if (currentBaseName !== Utils.MAIN_DOCUMENT_FILE_NAME) {
      const newHtmlPath = nodeApi.path.join(
        actualOutputDir,
        `${Utils.MAIN_DOCUMENT_FILE_NAME}.html`
      )
      await nodeApi.fsPromises.rename(htmlPath, newHtmlPath)
      htmlPath = newHtmlPath
    }

    const generatedBaseName = Utils.MAIN_DOCUMENT_FILE_NAME
    const res = await window.api.readFileContent(htmlPath)
    const format = extractPageFormatFromHtml(res)
    if (format?.pageWidth && format?.pageHeight) {
      const infoPath = nodeApi.path.join(
        actualOutputDir,
        `${generatedBaseName}.${Utils.DOCUMENT_INFO_FILE_NAME}${Utils.DOCUMENT_INFO_FILE_EXTENSION}`
      )
      const configPath = nodeApi.path.join(
        actualOutputDir,
        `${generatedBaseName}.${Utils.DOCUMENT_CONFIG_FILE_NAME}${Utils.DOCUMENT_CONFIG_FILE_EXTENSION}`
      )
      let infoData: Record<string, any> = {}
      if (await nodeApi.fsPromises.exists(infoPath)) {
        try {
          infoData =
            JSON.parse((await nodeApi.fsPromises.readFile(infoPath, 'utf-8')) || '{}') || {}
        } catch {
          infoData = {}
        }
      }
      const originalBaseName = nodeApi.path.basename(safeFilePath, nodeApi.path.extname(safeFilePath))
      const mergedInfo = {
        ...infoData,
        name: infoData.name || originalBaseName,
        pageWidth: format.pageWidth,
        pageHeight: format.pageHeight,
        marginTop: format.marginTop ?? infoData.marginTop,
        marginBottom: format.marginBottom ?? infoData.marginBottom,
        marginLeft: format.marginLeft ?? infoData.marginLeft,
        marginRight: format.marginRight ?? infoData.marginRight,
        pageKind: infoData.pageKind ?? 'document',
        sourceType: infoData.sourceType ?? Utils.OFFICE_EXTENSIONS_FORMAT.word
      }
      await writeFileEnsuringDirAsync(infoPath, JSON.stringify(mergedInfo, null, 2), 'utf-8')

      let configData: Record<string, any> = {}
      if (await nodeApi.fsPromises.exists(configPath)) {
        try {
          configData =
            JSON.parse((await nodeApi.fsPromises.readFile(configPath, 'utf-8')) || '{}') || {}
        } catch {
          configData = {}
        }
      }
      const pagination = {
        enabled: true,
        pageWidth: format.pageWidth,
        pageHeight: format.pageHeight,
        pageGap: 0,
        pageGapBorderSize: 0,
        pageGapBorderColor: '',
        pageBreakBackground: '',
        footerRight: format.footerRight ?? '',
        footerLeft: format.footerLeft ?? '',
        headerRight: format.headerRight ?? '',
        headerLeft: format.headerLeft ?? '',
        marginTop: format.marginTop ?? 0,
        marginBottom: format.marginBottom ?? 0,
        marginLeft: format.marginLeft ?? 0,
        marginRight: format.marginRight ?? 0,
        contentMarginTop: 0,
        contentMarginBottom: 0,
        customHeader: {},
        customFooter: {},
        hiddenPages: [],
        pageOrder: [],
        maxPageCount: defaultPaginationOptions.maxPageCount ?? 600,
        minPageContentHeight: defaultPaginationOptions.minPageContentHeight ?? 120
      }
      const mergedConfig = {
        ...configData,
        pagination
      }
      await writeFileEnsuringDirAsync(configPath, JSON.stringify(mergedConfig, null, 2), 'utf-8')
    }
    return returnFilePath ? htmlPath : res
  } catch (e) {
    console.error('Conversion failed:', e)
    return ''
  }
}

export async function convertHtmlToDocx(
  filePath: string,
  outputPath: string,
  returnFilePath = true
): Promise<string> {
  if (
    !nodeApi.fsPromises?.readFile ||
    !nodeApi.fsPromises?.unlink ||
    !nodeApi.path?.dirname ||
    !nodeApi.path?.join
  ) {
    throw new Error('Filesystem API not available for convertHtmlToDocx')
  }
  const safeFilePath = normalizePathForPlatform(filePath)
  outputPath = normalizePathForPlatform(outputPath).replace(/\.html$/, '')

  try {
    const docxPath = await convertHtmlFileToDocx(safeFilePath, outputPath)
    return returnFilePath ? docxPath : docxPath
  } catch (e) {
    console.error('Conversion failed:', e)
    return ''
  }
}
