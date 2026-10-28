import * as Y from 'yjs'
import { v4 as uuidv4 } from 'uuid'
import { prosemirrorJSONToYDoc } from 'y-prosemirror'

import { encodeSnapshot } from '../../../../utils/canvasSnapshot.utils'
import { ShapeType, type Shape } from '../../../../utils/canvas.types'
import { writeFileEnsuringDirAsync } from '../../../../utils/documentFileUtils'
import EditorExtensionHelpers from '../../../../utils/EditorExtensionHelpers'
import Utils from '../../../../utils/Utils'
import { CustomFileExtensionProps } from '../../CustomFileFolderExtension/utils/common.utils'
import { CustomSlideExtensionProps } from './common.utils'
import { defaultPaginationOptions } from '../../utils/common.utils'
import { nodeApi } from '../../../../utils/shims/node'

// const fs = nodeApi.fs
// const path = nodeApi.path

// const fs = window.node?.fs
// const path = window.node?.path

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

export type DynadocPresentation = {
  version?: string
  widthPx?: number
  heightPx?: number
  assetsBasePath?: string
  slides?: DynadocSlide[]
}

export type DynadocSlide = {
  id?: string
  slideIndex?: number
  name?: string
  transition?: Record<string, any>
  notes?: string | null
  comments?: Array<Record<string, any>>
  master?: Record<string, any>
  background?: any
  elements?: DynadocElement[]
}

export type DynadocElement = {
  id?: string
  type?: string
  name?: string
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  src?: string
  shape?: string
  text?: string
  tiptapContent?: any
  fill?: string | null
  stroke?: string | null
  strokeWidth?: number | null
  animation?: Record<string, any> | null
}

const toNumber = (value: any, fallback: number) => {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

const sanitizeTiptapDoc = (node: any): any => {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node.marks)) {
    node.marks = node.marks.filter(Boolean)
  }
  if (Array.isArray(node.content)) {
    node.content = node.content.map(sanitizeTiptapDoc).filter(Boolean)
  }
  return node
}

const stripUnknownSchemaItems = (node: any, schema: any): any => {
  if (!node || typeof node !== 'object') return null
  if (schema?.nodes && node.type && !schema.nodes[node.type]) {
    return null
  }
  if (Array.isArray(node.marks) && schema?.marks) {
    node.marks = normalizeMarks(node.marks, schema)
  }
  if (Array.isArray(node.content)) {
    node.content = node.content
      .map((child) => stripUnknownSchemaItems(child, schema))
      .filter(Boolean)
  }
  return node
}

const mergeTextStyleMark = (marks: any[], attrs: Record<string, any>) => {
  let textStyle = marks.find((mark) => mark?.type === 'textStyle')
  if (!textStyle) {
    textStyle = { type: 'textStyle', attrs: {} }
    marks.push(textStyle)
  }
  textStyle.attrs = { ...(textStyle.attrs || {}), ...attrs }
}

const normalizeMarks = (marks: any[], schema: any): any[] => {
  const next: any[] = []
  for (const mark of marks) {
    if (!mark || !mark.type) continue
    if (schema.marks[mark.type]) {
      next.push(mark)
      continue
    }
    // Map common marks into textStyle attributes
    if (mark.type === 'bold') mergeTextStyleMark(next, { fontWeight: 'bold' })
    if (mark.type === 'italic') mergeTextStyleMark(next, { fontStyle: 'italic' })
    if (mark.type === 'underline') mergeTextStyleMark(next, { textDecoration: 'underline' })
    if (mark.type === 'strike') mergeTextStyleMark(next, { textDecoration: 'line-through' })
    if (mark.type === 'highlight' && mark.attrs?.color) {
      mergeTextStyleMark(next, { backgroundColor: mark.attrs.color })
    }
    if (mark.type === 'textColor' && mark.attrs?.color) {
      mergeTextStyleMark(next, { color: mark.attrs.color })
    }
    if (mark.type === 'fontFamily' && mark.attrs?.fontFamily) {
      mergeTextStyleMark(next, { fontFamily: mark.attrs.fontFamily })
    }
    if (mark.type === 'fontSize' && mark.attrs?.fontSize) {
      mergeTextStyleMark(next, { fontSize: mark.attrs.fontSize })
    }
  }
  return next.filter((mark) => mark?.type && schema.marks[mark.type])
}

const normalizeTiptapDoc = (value: any, textFallback: string) => {
  if (value && typeof value === 'object') {
    normalizeTextStyleMarks(value)
    const cleaned = sanitizeTiptapDoc(value)
    if (cleaned) return cleaned
  }
  const text = textFallback ?? ''
  if (!text) return { type: 'doc', content: [{ type: 'paragraph' }] }
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }]
      }
    ]
  }
  normalizeTextStyleMarks(doc)
  return doc
}

const normalizeTextStyleMarks = (node: any) => {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node.content)) {
    node.content.forEach((child) => normalizeTextStyleMarks(child))
  }
  if (Array.isArray(node.marks)) {
    node.marks = node.marks.map((mark) => {
      if (!mark || mark.type !== 'textStyle') return mark
      const attrs = { ...(mark.attrs || {}) }
      if (attrs.fontSize != null) {
        if (typeof attrs.fontSize === 'number') {
          attrs.fontSize = `${attrs.fontSize}px`
        } else if (typeof attrs.fontSize === 'string') {
          const trimmed = attrs.fontSize.trim()
          if (/^\d+(\.\d+)?$/.test(trimmed)) {
            attrs.fontSize = `${trimmed}px`
          }
        }
      }
      if (attrs.color && typeof attrs.color === 'object') {
        const r = attrs.color.r ?? attrs.color.red
        const g = attrs.color.g ?? attrs.color.green
        const b = attrs.color.b ?? attrs.color.blue
        if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
          attrs.color = `rgb(${r}, ${g}, ${b})`
        }
      }
      if (typeof attrs.color === 'string') {
        const trimmed = attrs.color.trim()
        if (/^[0-9a-fA-F]{6}$/.test(trimmed)) {
          attrs.color = `#${trimmed}`
        }
      }
      if (attrs.fontFamily && typeof attrs.fontFamily === 'string') {
        attrs.fontFamily = attrs.fontFamily.replace(/^"+|"+$/g, '')
      }
      return { ...mark, attrs }
    })
  }
}

const normalizeShapeKind = (kind?: string | null) => {
  if (!kind) return ''
  return String(kind).toLowerCase()
}

const normalizeSlidePayload = (slide: DynadocSlide) => {
  if (!slide || typeof slide !== 'object') return slide
  const normalized: DynadocSlide = { ...slide }
  if (Array.isArray(slide.elements)) {
    normalized.elements = slide.elements.map((element) => ({
      ...element
    }))
  }
  if (slide.master && typeof slide.master === 'object') {
    const master: Record<string, any> = { ...(slide.master as any) }
    if (Array.isArray((master as any).elements)) {
      master.elements = (master as any).elements.map((element: any) => ({ ...element }))
    }
    normalized.master = master
  }
  return normalized
}

const resolveShapeType = (element: DynadocElement) => {
  if (element.type === 'image') return ShapeType.File
  if (element.type === 'text') return ShapeType.Text
  if (element.type === 'shape') {
    const kind = normalizeShapeKind(element.shape)
    if (['ellipse', 'circle', 'oval'].includes(kind)) return ShapeType.Ellipse
    if (['line', 'straightconnector1', 'connector1', 'lineinv'].includes(kind))
      return ShapeType.Line
    if (['triangle', 'isoscelestriangle', 'righttriangle'].includes(kind))
      return ShapeType.Triangle
    return ShapeType.Rect
  }
  return ShapeType.Text
}

const resolveAssetPath = (basePath: string | undefined, fileRef: string | undefined) => {
  if (!fileRef) return ''
  if (nodeApi.path.isAbsolute(fileRef)) return fileRef
  if (!basePath) return fileRef
  return nodeApi.path.join(basePath, fileRef)
}

const copyMediaToSlides = async (
  sourcePath: string,
  resolveAsset: (fileName: string, assetType: string) => Promise<string>
) => {
  if (!sourcePath) return ''
  if (!(await nodeApi.fsPromises.exists(sourcePath))) return sourcePath
  const ext = nodeApi.path.extname(sourcePath) || '.png'
  const assetType = resolveMediaAssetType(ext)
  const sep = nodeApi.path.sep
  const normalizedSource = sourcePath.split('/').join(sep)
  const isInAssets = normalizedSource.includes(`${sep}assets${sep}`)
  const isInTargetDir = normalizedSource.includes(`${sep}assets${sep}${assetType}${sep}`)
  if (isInAssets && isInTargetDir) {
    return sourcePath
  }
  const sourceBaseName = nodeApi.path.basename(sourcePath)
  const isSlideMedia = normalizedSource.includes(`${sep}assets${sep}slide${sep}media${sep}`)
  const fileName = isSlideMedia ? sourceBaseName : `Slide Media ${Date.now()}-${Math.floor(Math.random() * 1000)}${ext}`
  const targetPath = await resolveAsset(fileName, assetType)
  try {
    await nodeApi.fsPromises.copyFile(sourcePath, targetPath)
    if (isSlideMedia) {
      await nodeApi.fsPromises.unlink(sourcePath).catch(() => undefined)
    }
    return targetPath
  } catch (err) {
    try {
      const buf = await nodeApi.fsPromises.readFile(sourcePath)
      await writeFileEnsuringDirAsync(targetPath, buf)
      if (isSlideMedia) {
        await nodeApi.fsPromises.unlink(sourcePath).catch(() => undefined)
      }
      return targetPath
    } catch (fallbackErr) {
      console.warn('[presentationImport] failed to copy media asset', err, fallbackErr)
    }
  }
  return targetPath
}

const resolveMediaAssetType = (extension: string): string => {
  const ext = (extension || '').toLowerCase()
  if (Object.values(Utils.IMAGE_EXTENSIONS).includes(ext)) return 'img'
  if (Object.values(Utils.VIDEO_EXTENSIONS).includes(ext)) return 'video'
  if (Object.values(Utils.AUDIO_EXTENSIONS).includes(ext)) return 'audio'
  return 'other'
}

const createSlideSnapshotFromPresentation = async (
  slide: DynadocSlide,
  presentation: DynadocPresentation,
  resolveAsset: (fileName: string, assetType: string) => Promise<string>
) => {
  const ydoc = new Y.Doc()
  const shapes = ydoc.getMap<Shape>('shapes')
  const texts = ydoc.getMap<Y.XmlFragment>('texts')
  const meta = ydoc.getMap<any>('meta')

  const masterPayload = slide.master
  const normalizedMaster = masterPayload
    ? {
      ...(masterPayload as any),
      background: (masterPayload as any)?.background ?? undefined
    }
    : null

  const slideBackground = slide.background ?? normalizedMaster?.background ?? undefined

  if (slide.transition) meta.set('transition', slide.transition)
  if (slide.notes) meta.set('notes', slide.notes)
  if (slide.comments?.length) meta.set('comments', slide.comments)
  if (normalizedMaster) {
    meta.set('master', normalizedMaster)
  }
  if (slideBackground) meta.set('background', slideBackground)
  if (presentation?.widthPx) meta.set('slideWidth', presentation.widthPx)
  if (presentation?.heightPx) meta.set('slideHeight', presentation.heightPx)

  const elements = slide.elements ?? []
  let z = 0

  for (const element of elements) {
    const id = element.id || uuidv4()
    const shapeType = resolveShapeType(element)
    const isImage = shapeType === ShapeType.File
    const name = element.name || (isImage ? 'Image' : shapeType === ShapeType.Text ? 'Text' : 'Shape')
    const resolvedSrc = isImage
      ? await copyMediaToSlides(
          resolveAssetPath(presentation.assetsBasePath, element.src),
          resolveAsset
        )
      : element.src

    const shape: Shape = {
      id,
      name,
      type: shapeType,
      x: toNumber(element.x, 80),
      y: toNumber(element.y, 80),
      w: toNumber(element.width, 360),
      h: toNumber(element.height, 180),
      z,
      rotation: toNumber(element.rotation, 0),
      visible: true,
      selected: false,
      shapeKind: element.shape,
      fill: element.fill ?? undefined,
      stroke: element.stroke ?? undefined,
      strokeWidth: typeof element.strokeWidth === 'number' ? element.strokeWidth : undefined,
      animation: element.animation ?? undefined,
      src: resolvedSrc ?? undefined
    }

    shapes.set(id, shape)
    const fragment = new Y.XmlFragment()

    if (isImage) {
      const fileNode = new Y.XmlElement(CustomFileExtensionProps.name)
      fileNode.setAttribute(CustomFileExtensionProps.attributeSrc, resolvedSrc || '')
      fragment.insert(0, [fileNode])
    } else {
      // const schema = EditorExtensionHelpers.getHeadlessSchema(`slide-import-${slide.id || id}`)
      // const tiptapDoc = normalizeTiptapDoc(element.tiptapContent, element.text || '')
      // const tempYDoc = prosemirrorJSONToYDoc(schema, tiptapDoc, 'prosemirror')
      // const sourceFragment = tempYDoc.getXmlFragment('prosemirror')
      // const nodes = (sourceFragment?.toArray?.() ?? []).filter(Boolean)
      /* if (nodes.length) {
        // fragment.insert(0, nodes)
      } else {
        // fragment.insert(0, [new Y.XmlElement('paragraph')])
      } */

      const schema = EditorExtensionHelpers.getHeadlessSchema(`slide-import-${slide.id || id}`)
      let tiptapDoc = normalizeTiptapDoc(element.tiptapContent, element.text || '')
      tiptapDoc = stripUnknownSchemaItems(tiptapDoc, schema) ?? {
        type: 'doc',
        content: [{ type: 'paragraph' }]
      }

      // Create the temp doc
      const tempYDoc = prosemirrorJSONToYDoc(schema, tiptapDoc, 'prosemirror')
      const sourceFragment = tempYDoc.getXmlFragment('prosemirror')

      // IMPORTANT: We must CLONE the nodes. 
      // Yjs types cannot belong to two documents/fragments at once.
      const nodes = sourceFragment.toArray().map(node => {
        if (typeof node.clone === 'function') {
          return node.clone();
        }
        return node;
      }).filter(node => node instanceof Y.AbstractType); // Ensure they are real Yjs types

      if (nodes.length > 0) {
        fragment.insert(0, nodes)
      } else {
        // Fallback if conversion resulted in nothing
        const p = new Y.XmlElement('paragraph')
        fragment.insert(0, [p])
      }

    }

    texts.set(id, fragment)
    z += 1
  }

  if (!elements.length) {
    const id = uuidv4()
    shapes.set(id, {
      id,
      name: 'Empty',
      type: ShapeType.Text,
      x: 120,
      y: 120,
      w: 640,
      h: 240,
      z: 0,
      visible: true,
      selected: false
    })
    const fragment = new Y.XmlFragment()
    fragment.insert(0, [new Y.XmlElement('paragraph')])
    texts.set(id, fragment)
  }

  return encodeSnapshot(ydoc)
}

export async function convertPresentationJsonToSlidesHtml(
  presentationPath: string,
  tempDir: string,
  mainFilePath: string,
  resolveAssetPath: (
    assetType: string,
    mainFilePath?: string,
    fileName?: string
  ) => Promise<{ filePath: string } | null>,
  slideAssetType: string
) {
  const raw = await nodeApi.fsPromises.readFile(presentationPath, 'utf-8')
  const presentation: DynadocPresentation = JSON.parse(raw)
  const slides = presentation.slides ?? []
  const pageWidth = toNumber(presentation.widthPx, 1920)
  const pageHeight = toNumber(presentation.heightPx, 1080)
  const slidePaths: string[] = []
  for (let index = 0; index < slides.length; index += 1) {
    if (index > 0 && index % 3 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    const slide = normalizeSlidePayload(slides[index])
    const fileName = `Slide ${index + 1}.json`
    const slidePath = await resolveAssetPath(slideAssetType, mainFilePath, fileName)
    if (!slidePath) continue

    const snapshot = await createSlideSnapshotFromPresentation(
      slide,
      presentation,
      async (mediaName, assetType) => {
        const mediaPath = await resolveAssetPath(assetType, mainFilePath, mediaName)
        return mediaPath?.filePath ?? mediaName
      }
    )

    await writeFileEnsuringDirAsync(
      slidePath.filePath,
      JSON.stringify({ snapshot, updates: [] }, null, 2),
      'utf-8'
    )
    slidePaths.push(slidePath.filePath)
  }

  const html = slidePaths
    .map((src, index) => {
      const slideId = (slides[index] as any)?.id || uuidv4()
      return `<${CustomSlideExtensionProps.tagName} ${CustomSlideExtensionProps.parentFilePath}="${mainFilePath}" ${CustomSlideExtensionProps.tagAttributeSrc}="${src}" id="${slideId}"></${CustomSlideExtensionProps.tagName}>`
    })
    .join('\n')

  await nodeApi.fsPromises.mkdir(tempDir, { recursive: true })
  const htmlPath = nodeApi.path.join(tempDir, `${nodeApi.path.basename(mainFilePath)}.html`)
  await nodeApi.fsPromises.writeFile(htmlPath, html, 'utf-8')

  const infoPath = nodeApi.path.join(
    tempDir,
    `${nodeApi.path.basename(mainFilePath)}.${Utils.DOCUMENT_INFO_FILE_NAME}${Utils.DOCUMENT_INFO_FILE_EXTENSION}`
  )
  let infoData: Record<string, any> = {}
  if (await nodeApi.fsPromises.exists(infoPath)) {
    try {
      infoData = JSON.parse((await nodeApi.fsPromises.readFile(infoPath, 'utf-8')) || '{}') || {}
    } catch {
      infoData = {}
    }
  }
  const mergedInfo = {
    ...infoData,
    pageWidth,
    pageHeight,
    pageKind: 'slide',
    sourceType: Utils.OFFICE_EXTENSIONS_FORMAT.powerpoint,
    pageUnit: 'px',
    slideCount: slides.length,
    assetsBasePath: nodeApi.path.join(tempDir, 'assets', 'img'),
    author: (presentation as any)?.author ?? (presentation as any)?.metadata?.author ?? infoData.author ?? null,
    importedAt: new Date().toISOString()
  }
  await writeFileEnsuringDirAsync(infoPath, JSON.stringify(mergedInfo, null, 2), 'utf-8')

  const configPath = nodeApi.path.join(
    tempDir,
    `${nodeApi.path.basename(mainFilePath)}.${Utils.DOCUMENT_CONFIG_FILE_NAME}${Utils.DOCUMENT_CONFIG_FILE_EXTENSION}`
  )
  let configData: Record<string, any> = {}
  if (await nodeApi.fsPromises.exists(configPath)) {
    try {
      configData = JSON.parse((await nodeApi.fsPromises.readFile(configPath, 'utf-8')) || '{}') || {}
    } catch {
      configData = {}
    }
  }

  const pagination = {
    enabled: true,
    pageWidth,
    pageHeight,
    pageGap: 0,
    pageGapBorderSize: 0,
    pageGapBorderColor: '',
    pageBreakBackground: '',
    footerRight: '',
    footerLeft: '',
    headerRight: '',
    headerLeft: '',
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
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
  return htmlPath
}
