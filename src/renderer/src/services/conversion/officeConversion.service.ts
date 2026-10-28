import Utils from '../../utils/Utils'
import Platform from '../../libs/platform'
import { nodeApi } from '../../utils/shims/node'

export type OfficeConversionKind =
  | 'docx-to-html'
  | 'html-to-docx'
  | 'odt-to-html'
  | 'html-to-odt'
  | 'odp-to-html'
  | 'html-to-odp'
  | 'pptx-to-presentation'

export type OfficeConversionResult = {
  path: string
  kind: OfficeConversionKind
  downloaded?: boolean
}

export type HtmlToOfficeOptions = {
  ensureCompleteHtml?: boolean
  cleanupTempFile?: boolean
  downloadOnWeb?: boolean
  downloadName?: string
}

export type HtmlToDocxOptions = HtmlToOfficeOptions

function normalizePathForPlatform(inputPath: string): string {
  const raw = typeof inputPath === 'string' ? inputPath : String(inputPath ?? '')
  if (Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop) return raw
  return raw.replace(/^file:\/\//i, '').replace(/^\/+/, '')
}

function ensureWindowApi() {
  if (typeof window === 'undefined' || !(window as any).api) {
    throw new Error('DynaDoc conversion API is not available in this environment.')
  }
  return (window as any).api
}

function ensureFsApis() {
  if (!nodeApi.fsPromises || !nodeApi.path) {
    throw new Error('Filesystem API is not available for document conversion.')
  }
}

function isDesktop() {
  return Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
}

function sanitizeDownloadName(name: string, fallback: string) {
  const cleaned = String(name || '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || fallback
}

export function ensureDocxExtension(pathValue: string) {
  const ext = nodeApi.path.extname(pathValue).toLowerCase()
  return ext === Utils.OFFICE_EXTENSIONS.word ? pathValue : `${pathValue}.docx`
}

export function ensureOdtExtension(pathValue: string) {
  const ext = nodeApi.path.extname(pathValue).toLowerCase()
  return ext === '.odt' ? pathValue : `${pathValue}.odt`
}

export function ensureOdpExtension(pathValue: string) {
  const ext = nodeApi.path.extname(pathValue).toLowerCase()
  return ext === '.odp' ? pathValue : `${pathValue}.odp`
}

export function ensureHtmlExtension(pathValue: string) {
  const ext = nodeApi.path.extname(pathValue).toLowerCase()
  return ext === '.html' || ext === '.htm' ? pathValue : `${pathValue}.html`
}

export function stripOfficeExtension(pathValue: string) {
  return pathValue.replace(/\.(docx|html|htm|pptx|odt|odp)$/i, '')
}

export function toCompleteOfficeHtml(
  html: string,
  options: { title?: string; styles?: string[]; scripts?: string[]; lang?: string } = {}
) {
  const title = options.title || 'DynaDoc Export'
  const lang = options.lang || 'en'
  const styles = options.styles || []
  const scripts = options.scripts || []

  const metaTags = `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  `.trim()
  const styleTags = styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('\n    ')
  const scriptTags = scripts.map((src) => `<script src="${src}"></script>`).join('\n    ')

  let xhtml = `<!DOCTYPE html>
<html lang="${lang}">
<head>
    ${metaTags}
    <title>${title}</title>
    ${styleTags}
    ${scriptTags}
</head>
<body>
${html}
</body>
</html>`

  return xhtml
    .replace(
      /<(link|meta|img|br|hr|input|source|track|col|base|param|embed|wbr)([^>]*)>/gi,
      (match, tag, attrs) => {
        if (
          String(attrs || '')
            .trim()
            .endsWith('/')
        )
          return match
        return `<${tag}${attrs}/>`
      }
    )
    .replace(/&nbsp;/g, '&#160;')
}

export async function writeFileEnsuringDirAsync(
  filePath: string,
  content: string | Uint8Array | ArrayBuffer = '',
  encoding?: string
) {
  ensureFsApis()
  const safePath = normalizePathForPlatform(filePath)
  if (!safePath) return
  const parentDir = nodeApi.path.dirname(safePath)
  if (parentDir && parentDir !== '.') {
    await nodeApi.fsPromises.mkdir(parentDir, { recursive: true })
  }
  if (encoding) {
    await nodeApi.fsPromises.writeFile(safePath, content, encoding)
    return
  }
  await nodeApi.fsPromises.writeFile(safePath, content)
}

export async function prepareHtmlFileForDocx(
  filePath: string,
  options: { title?: string; styles?: string[] } = {}
) {
  ensureFsApis()
  const safeFilePath = normalizePathForPlatform(filePath)
  const htmlContent = await nodeApi.fsPromises.readFile(safeFilePath, 'utf-8')
  const tempDir = nodeApi.path.dirname(safeFilePath)
  const tempFilePath = nodeApi.path.join(tempDir, `dynadoc-office-convert-${Date.now()}.html`)
  await writeFileEnsuringDirAsync(tempFilePath, toCompleteOfficeHtml(htmlContent, options), 'utf-8')
  return tempFilePath
}

export async function convertDocxFileToHtml(
  filePath: string,
  outputPath: string,
  returnFilePath = true
): Promise<string> {
  ensureFsApis()
  const api = ensureWindowApi()
  if (!api.convertDocxToHtml) throw new Error('DOCX to HTML conversion is not available.')

  const safeFilePath = normalizePathForPlatform(filePath)
  let resolvedOutput = normalizePathForPlatform(outputPath)
  if (nodeApi.path.extname(resolvedOutput).toLowerCase() === Utils.OFFICE_EXTENSIONS.word) {
    resolvedOutput = stripOfficeExtension(resolvedOutput)
  }

  await nodeApi.fsPromises.mkdir(resolvedOutput, { recursive: true }).catch(() => undefined)
  const htmlPath = await api.convertDocxToHtml(safeFilePath, resolvedOutput)
  if (typeof htmlPath === 'string' && htmlPath.toLowerCase().includes('error')) {
    throw new Error(htmlPath)
  }
  if (returnFilePath) return htmlPath
  return api.readFileContent
    ? api.readFileContent(htmlPath)
    : nodeApi.fsPromises.readFile(htmlPath, 'utf-8')
}

export async function convertOdtFileToHtml(
  filePath: string,
  outputPath: string,
  returnFilePath = true
): Promise<string> {
  ensureFsApis()
  const api = ensureWindowApi()
  if (!api.convertOdtToHtml) throw new Error('ODT to HTML conversion is not available.')

  const safeFilePath = normalizePathForPlatform(filePath)
  const resolvedOutput = normalizePathForPlatform(outputPath)

  const htmlPath = await api.convertOdtToHtml(safeFilePath, resolvedOutput)
  if (typeof htmlPath === 'string' && htmlPath.toLowerCase().includes('error')) {
    throw new Error(htmlPath)
  }
  if (returnFilePath) return htmlPath
  return api.readFileContent
    ? api.readFileContent(htmlPath)
    : nodeApi.fsPromises.readFile(htmlPath, 'utf-8')
}

export async function convertHtmlFileToDocx(
  filePath: string,
  outputPath: string,
  options: HtmlToDocxOptions = {}
): Promise<string> {
  ensureFsApis()
  const api = ensureWindowApi()
  if (!api.convertHtmlToDocx) throw new Error('HTML to DOCX conversion is not available.')

  const safeFilePath = normalizePathForPlatform(filePath)
  const finalOutputPath = ensureDocxExtension(normalizePathForPlatform(outputPath))
  const sourcePath =
    options.ensureCompleteHtml === false ? safeFilePath : await prepareHtmlFileForDocx(safeFilePath)

  try {
    const docxPath = await api.convertHtmlToDocx(sourcePath, finalOutputPath)
    if (typeof docxPath === 'string' && docxPath.toLowerCase().includes('error')) {
      throw new Error(docxPath)
    }
    if (options.downloadOnWeb !== false) {
      await maybeDownloadConvertedFile(
        docxPath,
        options.downloadName || nodeApi.path.basename(finalOutputPath)
      )
    }
    return docxPath
  } finally {
    if (sourcePath !== safeFilePath && options.cleanupTempFile !== false) {
      await nodeApi.fsPromises.unlink(sourcePath).catch(() => undefined)
    }
  }
}

export async function convertHtmlFileToOdt(
  filePath: string,
  outputPath: string,
  options: HtmlToOfficeOptions = {}
): Promise<string> {
  ensureFsApis()
  const api = ensureWindowApi()
  if (!api.convertHtmlToOdt) throw new Error('HTML to ODT conversion is not available.')

  const safeFilePath = normalizePathForPlatform(filePath)
  const finalOutputPath = ensureOdtExtension(normalizePathForPlatform(outputPath))
  const sourcePath =
    options.ensureCompleteHtml === false ? safeFilePath : await prepareHtmlFileForDocx(safeFilePath)

  try {
    const odtPath = await api.convertHtmlToOdt(sourcePath, finalOutputPath)
    if (typeof odtPath === 'string' && odtPath.toLowerCase().includes('error')) {
      throw new Error(odtPath)
    }
    if (options.downloadOnWeb !== false) {
      await maybeDownloadConvertedFile(
        odtPath,
        options.downloadName || nodeApi.path.basename(finalOutputPath)
      )
    }
    return odtPath
  } finally {
    if (sourcePath !== safeFilePath && options.cleanupTempFile !== false) {
      await nodeApi.fsPromises.unlink(sourcePath).catch(() => undefined)
    }
  }
}

export async function convertHtmlFileToOdp(
  filePath: string,
  outputPath: string,
  options: HtmlToOfficeOptions = {}
): Promise<string> {
  ensureFsApis()
  const api = ensureWindowApi()
  if (!api.convertHtmlToOdp) throw new Error('HTML to ODP conversion is not available.')

  const safeFilePath = normalizePathForPlatform(filePath)
  const finalOutputPath = ensureOdpExtension(normalizePathForPlatform(outputPath))
  const sourcePath =
    options.ensureCompleteHtml === false ? safeFilePath : await prepareHtmlFileForDocx(safeFilePath)

  try {
    const odpPath = await api.convertHtmlToOdp(sourcePath, finalOutputPath)
    if (typeof odpPath === 'string' && odpPath.toLowerCase().includes('error')) {
      throw new Error(odpPath)
    }
    if (options.downloadOnWeb !== false) {
      await maybeDownloadConvertedFile(
        odpPath,
        options.downloadName || nodeApi.path.basename(finalOutputPath)
      )
    }
    return odpPath
  } finally {
    if (sourcePath !== safeFilePath && options.cleanupTempFile !== false) {
      await nodeApi.fsPromises.unlink(sourcePath).catch(() => undefined)
    }
  }
}

export async function convertPptxFileToPresentation(
  pptxPath: string,
  outputDir: string
): Promise<string> {
  ensureFsApis()
  const api = ensureWindowApi()
  if (!api.convertPptxToPresentation) {
    throw new Error('PPTX conversion requires the DynaDoc presentation extractor.')
  }
  const safePptxPath = normalizePathForPlatform(pptxPath)
  const safeOutputDir = normalizePathForPlatform(outputDir)
  return api.convertPptxToPresentation(safePptxPath, safeOutputDir)
}

export async function triggerBrowserDownloadFromPath(
  filePath: string,
  fileName?: string
): Promise<boolean> {
  if (typeof document === 'undefined' || isDesktop()) return false

  const safePath = normalizePathForPlatform(filePath)
  const ext = nodeApi.path.extname(safePath).toLowerCase()
  const isBinary = [Utils.OFFICE_EXTENSIONS.word, Utils.OFFICE_EXTENSIONS.powerpoint, '.pdf', '.zip', '.xlsx', '.png', '.jpg', '.jpeg', '.odt', '.odp'].includes(ext)

  const downloadName = sanitizeDownloadName(
    fileName || nodeApi.path.basename(safePath),
    'dynadoc-export'
  )
  let blob: Blob | null = null
  const assetReader = (nodeApi as any)?.fsPromises?.readAssetBlob

  if (typeof assetReader === 'function') {
    try {
      const result = await assetReader(safePath)
      if (result?.blob) blob = result.blob
    } catch (err) {
      console.error('triggerBrowserDownloadFromPath: readAssetBlob failed', { safePath, err })
    }
  }

  if (!blob) {
    if (isBinary) {
      console.error('triggerBrowserDownloadFromPath: failed to get blob for binary file', { safePath })
      return false
    }
    // Fallback only for text files
    const content = await nodeApi.fsPromises.readFile(safePath, 'utf-8')
    blob = new Blob([content || ''], { type: 'text/plain' })
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = downloadName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
  return true
}

export async function maybeDownloadConvertedFile(pathValue: string, fileName?: string) {
  if (!pathValue || isDesktop()) return false
  return triggerBrowserDownloadFromPath(pathValue, fileName)
}

