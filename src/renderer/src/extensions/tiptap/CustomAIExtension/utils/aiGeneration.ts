import * as Y from 'yjs'
import { v4 as uuidv4 } from 'uuid'
import { get } from 'svelte/store'

import { DocumentModel } from '../../../../models/Document'
import { writeFileEnsuringDir } from '../../../../utils/documentFileUtils'
import { encodeSnapshot } from '../../../../utils/canvasSnapshot.utils'
import { ShapeType, type Shape } from '../../../../utils/canvas.types'
import { CustomSlideExtensionProps } from '../../CustomSlideExtension/utils/common.utils'
import { CustomSpreadsheetExtensionProps } from '../../CustomSpreadsheetExtension/utils/common.utils'
import { CustomDesignExtensionProps } from '../../CustomDesignExtension/utils/common.utils'
import { CustomLatexProjectExtensionProps } from '../../CustomLatexProjectExtension/utils/common.utils'
import { _$_documentEditorsList } from '../../../../stores/editor.store'
import { runAIWithResult } from './utils'
import { aiGenerationStore } from '../stores/aiGeneration.store'
import { setVariable, VariableManipulatorUtils, listVariables, deleteVariable } from '../../CustomVarExtension/stores/variableManipulator'
import { nodeApi } from '../../../../utils/shims/node'

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

export type AIGenerationMode = 'text' | 'slides' | 'spreadsheet' | 'design' | 'latex'

type SlideOutline = {
  title: string
  bullets?: string[]
  notes?: string
}

type SlidePayload = {
  type?: string
  slides?: SlideOutline[]
  theme?: { background?: string }
  vars?: VarSpec[]
}

type SpreadsheetPayload = {
  type?: string
  sheets?: { name?: string; rows?: any[][] }[]
  vars?: VarSpec[]
}

type DesignPayload = {
  type?: string
  title?: string
  sections?: { heading?: string; body?: string }[]
  background?: string
  vars?: VarSpec[]
}

type LatexPayload = {
  type?: string
  title?: string
  main?: string
  vars?: VarSpec[]
}

type VarSpec = {
  name?: string
  value?: string | number
  format?: string
  description?: string
  type?: string
}

const JSON_START = '{'
const JSON_END = '}'

const normalizeAiVarSyntax = (text: string) => {
  if (!text) return ''
  let next = text
    .replace(/@vars?:/gi, '{var:')
    .replace(/@\s*\"vars\"\s*:/gi, '{"vars":')
    .replace(/@\s*vars\s*:/gi, '{"vars":')
    .replace(/@\s*\{/g, '{')
    .replace(/\bvars\s*\[/gi, '{"vars":[')
    .replace(/\bvars\s*:\s*\[/gi, '{"vars":[')
    .replace(/```json|```/gi, '')
    .replace(/\{var:([^}\s"']+)(?=$|\s|["'.,;:!?])/g, '{var:$1}')
    .replace(/"name"\s*:\s*"\{var:([^"}]+)"/gi, '"name":"$1"')
    .replace(/"name"\s*:\s*"@var:([^"}]+)"/gi, '"name":"$1"')
    .replace(/@var:([A-Za-z0-9_-]+)/gi, '{var:$1}')
    .replace(/@\s*\{/g, '{')
  return next
}

const cleanJsonFromText = (input: string) => {
  if (!input) return ''
  const start = input.indexOf(JSON_START)
  const end = input.lastIndexOf(JSON_END)
  if (start === -1 || end === -1 || end <= start) return input.trim()
  return input.slice(start, end + 1).trim()
}

const parseJson = <T>(raw: string): T | null => {
  if (!raw) return null
  const normalized = normalizeAiVarSyntax(raw)
  try {
    return JSON.parse(normalized) as T
  } catch {
    try {
      return JSON.parse(cleanJsonFromText(normalized)) as T
    } catch {
      return null
    }
  }
}

const buildSlidesPrompt = (prompt: string, context: string) => {
  const varHint = shouldPreferVars()
    ? '- If reusable values appear (dates, names, KPIs), add them to "vars" and reference them in text using {var:Name}.'
    : ''
  return `
You are generating slide deck data for a WYSIWYG editor.
Return ONLY valid JSON with this shape:
{
  "type": "slides",
  "slides": [
    { "title": "Slide title", "bullets": ["Point 1", "Point 2"] }
  ],
  "theme": { "background": "#ffffff" },
  "vars": [
    { "name": "Quarter", "value": "Q2 2026", "format": "", "description": "Reporting period" }
  ]
}
Rules:
- JSON only, no markdown, no code fences.
- Provide 3-8 slides unless user asks otherwise.
- Keep bullets short (max 8 words each).
${varHint}

User request:
${prompt}

Context (optional):
${context}
`.trim()
}

const buildSpreadsheetPrompt = (prompt: string, context: string) => {
  const varHint = shouldPreferVars()
    ? '- If reusable values appear, add them to "vars" and reference them in text using {var:Name}.'
    : ''
  return `
You are generating spreadsheet data for a WYSIWYG editor.
Return ONLY valid JSON with this shape:
{
  "type": "spreadsheet",
  "sheets": [
    { "name": "Sheet1", "rows": [["Header1","Header2"],["Row1Col1","Row1Col2"]] }
  ],
  "vars": [
    { "name": "Currency", "value": "USD", "format": "", "description": "Reporting currency" }
  ]
}
Rules:
- JSON only, no markdown, no code fences.
- Keep to one sheet unless user requests multiple.
- Rows should be a 2D array of strings/numbers.
${varHint}

User request:
${prompt}

Context (optional):
${context}
`.trim()
}

const buildDesignPrompt = (prompt: string, context: string) => {
  const varHint = shouldPreferVars()
    ? '- If reusable values appear, add them to "vars" and reference them in text using {var:Name}.'
    : ''
  return `
You are generating a design canvas layout for a WYSIWYG editor.
Return ONLY valid JSON with this shape:
{
  "type": "design",
  "title": "Design title",
  "sections": [
    { "heading": "Section title", "body": "Short supporting text" }
  ],
  "background": "#ffffff",
  "vars": [
    { "name": "ProductName", "value": "Nova", "format": "", "description": "Product name" }
  ]
}
Rules:
- JSON only, no markdown, no code fences.
- Keep content concise.
${varHint}

User request:
${prompt}

Context (optional):
${context}
`.trim()
}

const buildLatexPrompt = (prompt: string, context: string) => {
  const varHint = shouldPreferVars()
    ? '- If reusable values appear, add them to "vars" and reference them in text using {var:Name}.'
    : ''
  return `
You are generating a LaTeX project main file.
Return ONLY valid JSON with this shape:
{
  "type": "latex",
  "title": "Project title",
  "main": "% LaTeX content here",
  "vars": [
    { "name": "ReportTitle", "value": "Q2 Report", "format": "", "description": "Doc title" }
  ]
}
Rules:
- JSON only, no markdown, no code fences.
- Provide a minimal preamble and a \\begin{document} ... \\end{document} body.
${varHint}

User request:
${prompt}

Context (optional):
${context}
`.trim()
}

const shouldPreferVars = () => get(aiGenerationStore).preferVariables

const inferVarFormat = (value: string) => {
  const raw = String(value || '').trim()
  if (!raw) return undefined
  if (/[%]$/.test(raw)) return VariableManipulatorUtils.EXCEL_FORMATS.PERCENT_DEC
  if (/^\$[\d,]+(\.\d+)?$/.test(raw)) return VariableManipulatorUtils.EXCEL_FORMATS.CURRENCY_USD
  if (/^[€£¥][\d,]+(\.\d+)?$/.test(raw)) return VariableManipulatorUtils.EXCEL_FORMATS.CURRENCY_EUR
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return VariableManipulatorUtils.EXCEL_FORMATS.DATE_ISO
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) return VariableManipulatorUtils.EXCEL_FORMATS.DATE_SHORT
  if (/^\d{1,2}:\d{2}(:\d{2})?\s?(AM|PM)?$/i.test(raw))
    return VariableManipulatorUtils.EXCEL_FORMATS.TIME_12H
  return undefined
}

const createHeadingFragment = (text: string) => {
  const fragment = new Y.XmlFragment()
  const heading = new Y.XmlElement('heading')
  heading.setAttribute('level', '1')
  heading.insert(0, [new Y.XmlText(text || '')])
  fragment.insert(0, [heading])
  return fragment
}

const createBulletFragment = (bullets: string[]) => {
  const fragment = new Y.XmlFragment()
  const list = new Y.XmlElement('bulletList')
  const items = bullets?.length ? bullets : ['']
  items.forEach((bullet) => {
    const item = new Y.XmlElement('listItem')
    const paragraph = new Y.XmlElement('paragraph')
    paragraph.insert(0, [new Y.XmlText(bullet || '')])
    item.insert(0, [paragraph])
    list.insert(list.length, [item])
  })
  fragment.insert(0, [list])
  return fragment
}

const createParagraphFragment = (text: string) => {
  const fragment = new Y.XmlFragment()
  const paragraph = new Y.XmlElement('paragraph')
  paragraph.insert(0, [new Y.XmlText(text || '')])
  fragment.insert(0, [paragraph])
  return fragment
}

const createCanvasSnapshot = (blocks: { type: 'title' | 'content'; text: string }[], background?: string) => {
  const ydoc = new Y.Doc()
  const shapes = ydoc.getMap<Shape>('shapes')
  const texts = ydoc.getMap<Y.XmlFragment>('texts')
  const meta = ydoc.getMap<any>('meta')
  if (background) meta.set('background', background)

  const stageW = 1280
  const stageH = 720
  const marginX = stageW * 0.1
  const width = stageW * 0.8
  let y = stageH * 0.1

  blocks.forEach((block, index) => {
    const id = uuidv4()
    const isTitle = block.type === 'title'
    const height = isTitle ? stageH * 0.2 : stageH * 0.55

    shapes.set(id, {
      id,
      name: block.text.slice(0, 32) || 'Text',
      type: ShapeType.Text,
      x: marginX,
      y,
      w: width,
      h: height,
      z: index,
      visible: true,
      selected: false,
      content: {
        type: isTitle ? 'title' : 'content',
        value: block.text || ''
      }
    })

    const fragment = isTitle
      ? createHeadingFragment(block.text)
      : createBulletFragment((block.text || '').split('\n').filter(Boolean))
    texts.set(id, fragment)

    y += height + stageH * 0.05
  })

  return encodeSnapshot(ydoc)
}

const writeCanvasFile = (filePath: string, snapshot: string) => {
  const payload = { snapshot, updates: [] as string[] }
  writeFileEnsuringDir(filePath, JSON.stringify(payload, null, 2), 'utf-8')
}

const writeSpreadsheetFile = (filePath: string, sheets: { name?: string; rows?: any[][] }[]) => {
  const ydoc = new Y.Doc()
  const snapshot = ydoc.getMap('snapshot')
  const normalized = (sheets?.length ? sheets : [{ name: 'Sheet1', rows: [] }]).map((sheet, idx) => {
    const rows = Array.isArray(sheet.rows) ? sheet.rows : []
    const celldata: any[] = []
    rows.forEach((row, r) => {
      if (!Array.isArray(row)) return
      row.forEach((cell, c) => {
        if (cell == null || cell === '') return
        celldata.push({ r, c, v: cell })
      })
    })
    return {
      id: sheet.name ? sheet.name : `sheet-${idx + 1}`,
      name: sheet.name || `Sheet${idx + 1}`,
      celldata
    }
  })

  snapshot.set('sheets', normalized)
  const update = Y.encodeStateAsUpdate(ydoc)
  writeFileEnsuringDir(filePath, Buffer.from(update))
}

const getContextText = (editor: any, range: { from: number; to: number }) => {
  try {
    if (!editor?.state?.doc) return ''
    if (!range || range.from === range.to) return ''
    const docSize = editor.state.doc.content.size
    const from = Math.max(0, Math.min(range.from, docSize))
    const to = Math.max(from, Math.min(range.to, docSize))
    if (from === to) return ''
    return editor.state.doc.textBetween(from, to, '\n').trim()
  } catch {
    return ''
  }
}

const VAR_REF_REGEX = /\{var:([^}]+)\}/g
const VAR_INLINE_REGEX = /\{\{var:([^|}]+)\|([^|}]*)?(?:\|([^}]*))?\}\}/g

const normalizeVarText = (text: string) => {
  if (!text) return ''
  return text
    .replace(VAR_INLINE_REGEX, (_match, rawName) => `{${String(rawName || '').trim()}}`)
    .replace(VAR_REF_REGEX, (_match, rawName) => `{${String(rawName || '').trim()}}`)
}

const normalizeVarKey = (value: string) =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const findCloseMatch = (desired: string, existing: Map<string, string>) => {
  const desiredKey = normalizeVarKey(desired)
  if (!desiredKey) return undefined
  for (const [key, name] of existing.entries()) {
    const existingKey = normalizeVarKey(key)
    if (!existingKey) continue
    if (existingKey === desiredKey) return name
    if (existingKey.startsWith(desiredKey) || desiredKey.startsWith(existingKey)) return name
  }
  return undefined
}

const extractVarUsages = (texts: string[]) => {
  const usage = new Set<string>()
  const regex = /\{([^}]+)\}/g
  texts.filter(Boolean).forEach((text) => {
    let match = regex.exec(text)
    while (match) {
      const name = String(match[1] || '').trim()
      if (name) usage.add(name)
      match = regex.exec(text)
    }
  })
  return usage
}

const applyVars = (vars: VarSpec[] | undefined, docEditor: any) => {
  if (!vars?.length || !docEditor) return []
  const existingVars = listVariables([], docEditor)
  const nameMap = new Map<string, string>()
  const valueMap = new Map<string, string>()
  existingVars.forEach((v) => {
    const name = String(v?.rawValue?.name || v?.name || '').trim()
    if (name) nameMap.set(name.toLowerCase(), name)
    const value = String(v?.rawValue?.value ?? v?.value ?? '').trim()
    if (value) valueMap.set(value.toLowerCase(), name)
  })

  const created: string[] = []
  vars.forEach((spec) => {
    const desiredName = String(spec?.name || '').trim()
    if (!desiredName) return
    const byName = nameMap.get(desiredName.toLowerCase())
    if (byName) return
    const closeByName = findCloseMatch(desiredName, nameMap)
    if (closeByName) return
    const value = spec?.value != null ? String(spec.value) : desiredName
    const byValue = value ? valueMap.get(value.toLowerCase()) : undefined
    if (byValue) return
    const payload = {
      type: spec?.type || VariableManipulatorUtils.VAR_TYPE.text,
      value,
      format: spec?.format || inferVarFormat(String(value)),
      description: spec?.description,
      source: 'ai',
      generatedAt: new Date().toISOString()
    }
    setVariable(desiredName, payload, docEditor)
    nameMap.set(desiredName.toLowerCase(), desiredName)
    if (value) valueMap.set(value.toLowerCase(), desiredName)
    created.push(desiredName)
  })
  return created
}

const repairJson = async (mode: AIGenerationMode, raw: string, docEditor: any) => {
  aiGenerationStore.repairing()
  const repairPrompt = `
You are repairing JSON for a document editor.
Return ONLY valid JSON for type "${mode}".
Input:
${raw}
`.trim()
  const repaired = await runAIWithResult(repairPrompt, docEditor, {
    mode: `${mode}-repair`,
    format: 'json'
  })
  return normalizeAiVarSyntax(repaired || '')
}

const ensureJsonPayload = async <T>(
  mode: AIGenerationMode,
  raw: string,
  docEditor: any
): Promise<T | null> => {
  let parsed = parseJson<T>(raw)
  if (parsed) return parsed
  const repaired = await repairJson(mode, raw, docEditor)
  parsed = parseJson<T>(repaired)
  return parsed
}

export const runAIGeneration = async (
  editor: any,
  mode: AIGenerationMode,
  prompt: string,
  range: { from: number; to: number }
) => {
  const context = getContextText(editor, range)
  const docEditor = get(_$_documentEditorsList.getActive())

  if (mode === 'text') {
    return { mode, raw: prompt }
  }

  let aiPrompt = prompt
  if (mode === 'slides') aiPrompt = buildSlidesPrompt(prompt, context)
  if (mode === 'spreadsheet') aiPrompt = buildSpreadsheetPrompt(prompt, context)
  if (mode === 'design') aiPrompt = buildDesignPrompt(prompt, context)
  if (mode === 'latex') aiPrompt = buildLatexPrompt(prompt, context)

  aiGenerationStore.start(mode, prompt)
  try {
    const raw = await runAIWithResult(aiPrompt, docEditor, { mode, format: 'json' })
    return { mode, raw }
  } catch (err: any) {
    aiGenerationStore.error(err?.message || 'AI generation failed')
    aiGenerationStore.finish()
    throw err
  }
}

export const applyAIGenerationResult = async (
  editor: any,
  mode: AIGenerationMode,
  raw: string
) => {
  if (!editor) return

  if (mode === 'slides') {
    const docEditor = get(_$_documentEditorsList.getActive())
    const payload = await ensureJsonPayload<SlidePayload>(mode, raw, docEditor)
    if (!payload) {
      aiGenerationStore.error('Invalid slides JSON')
      aiGenerationStore.finish()
      return
    }
    const createdVars = applyVars(payload.vars, docEditor)
    const slides = payload?.slides?.length ? payload.slides : [{ title: 'Untitled', bullets: [] }]

    const nodes: any[] = []
    for (const slide of slides) {
      const slidePath = await DocumentModel.getAssetFilePathFromDocument(
        DocumentModel.AssetType.SLIDE
      )
      if (!slidePath?.filePath) continue

      const titleText = normalizeVarText(slide.title || 'Untitled')
      const bulletText = normalizeVarText((slide.bullets || []).join('\n'))
      const snapshot = createCanvasSnapshot(
        [
          { type: 'title', text: titleText },
          { type: 'content', text: bulletText }
        ],
        payload?.theme?.background
      )
      writeCanvasFile(slidePath.filePath, snapshot)
      nodes.push({
        type: CustomSlideExtensionProps.name,
        attrs: {
          id: uuidv4(),
          [CustomSlideExtensionProps.tagAttributeSrc]: slidePath.filePath
        }
      })
    }

    if (createdVars.length) {
      const usage = extractVarUsages(
        slides.flatMap((s) => [
          normalizeVarText(s.title || ''),
          normalizeVarText((s.bullets || []).join('\n')),
          normalizeVarText(s.notes || '')
        ])
      )
      createdVars.forEach((name) => {
        if (!usage.has(name)) deleteVariable(name, docEditor)
      })
    }

    if (nodes.length) {
      editor.chain().focus().insertContent(nodes).run()
    }
    aiGenerationStore.finish()
    return
  }

  if (mode === 'spreadsheet') {
    const docEditor = get(_$_documentEditorsList.getActive())
    const payload = await ensureJsonPayload<SpreadsheetPayload>(mode, raw, docEditor)
    if (!payload) {
      aiGenerationStore.error('Invalid spreadsheet JSON')
      aiGenerationStore.finish()
      return
    }
    const createdVars = applyVars(payload.vars, docEditor)
    const sheets = payload?.sheets?.length ? payload.sheets : [{ name: 'Sheet1', rows: [] }]
    const sheetPath = await DocumentModel.getAssetFilePathFromDocument(
      DocumentModel.AssetType.SHEET
    )
    if (!sheetPath?.filePath) return

    const normalizedSheets = sheets.map((sheet) => ({
      ...sheet,
      rows: Array.isArray(sheet?.rows)
        ? sheet.rows.map((row) =>
            Array.isArray(row) ? row.map((cell) => (typeof cell === 'string' ? normalizeVarText(cell) : cell)) : row
          )
        : sheet?.rows
    }))
    writeSpreadsheetFile(sheetPath.filePath, normalizedSheets)
    if (createdVars.length) {
      const allTextCells: string[] = []
      normalizedSheets.forEach((sheet) => {
        sheet.rows?.forEach((row) => {
          if (!Array.isArray(row)) return
          row.forEach((cell) => {
            if (typeof cell === 'string') allTextCells.push(cell)
          })
        })
      })
      const usage = extractVarUsages(allTextCells)
      createdVars.forEach((name) => {
        if (!usage.has(name)) deleteVariable(name, docEditor)
      })
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: CustomSpreadsheetExtensionProps.name,
        attrs: {
          id: uuidv4(),
          [CustomSpreadsheetExtensionProps.tagAttributeSrc]: sheetPath.filePath
        }
      })
      .run()
    aiGenerationStore.finish()
    return
  }

  if (mode === 'design') {
    const docEditor = get(_$_documentEditorsList.getActive())
    const payload = await ensureJsonPayload<DesignPayload>(mode, raw, docEditor)
    if (!payload) {
      aiGenerationStore.error('Invalid design JSON')
      aiGenerationStore.finish()
      return
    }
    const createdVars = applyVars(payload.vars, docEditor)
    const designPath = await DocumentModel.getAssetFilePathFromDocument(
      DocumentModel.AssetType.DESIGN
    )
    if (!designPath?.filePath) return

    const title = normalizeVarText(payload?.title || 'Design')
    const body =
      payload?.sections
        ?.map((s) =>
          normalizeVarText(`${s.heading || ''}\n${s.body || ''}`.trim())
        )
        .join('\n\n') || ''
    const snapshot = createCanvasSnapshot(
      [
        { type: 'title', text: title },
        { type: 'content', text: body }
      ],
      payload?.background
    )
    writeCanvasFile(designPath.filePath, snapshot)
    if (createdVars.length) {
      const usage = extractVarUsages([title, body])
      createdVars.forEach((name) => {
        if (!usage.has(name)) deleteVariable(name, docEditor)
      })
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: CustomDesignExtensionProps.name,
        attrs: {
          id: uuidv4(),
          [CustomDesignExtensionProps.tagAttributeSrc]: designPath.filePath
        }
      })
      .run()
    aiGenerationStore.finish()
    return
  }

  if (mode === 'latex') {
    const docEditor = get(_$_documentEditorsList.getActive())
    const payload = await ensureJsonPayload<LatexPayload>(mode, raw, docEditor)
    if (!payload) {
      aiGenerationStore.error('Invalid LaTeX JSON')
      aiGenerationStore.finish()
      return
    }
    const createdVars = applyVars(payload.vars, docEditor)
    const activeDoc = DocumentModel.getActiveDocument()
    if (!activeDoc) return
    const baseDir = activeDoc.getAsset(DocumentModel.AssetType.LATEX)
    if (!baseDir) return

    // const nodeApi =
    //   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
    // const fs = nodeApi?.fs
    // const path = nodeApi?.path
//     if (!nodeApi.fs || !nodeApi.path) return
//     nodeApi.fs.mkdirSync(baseDir, { recursive: true })

    const projectId = uuidv4()
    const projectDir = nodeApi.path.join(baseDir, projectId)
    const title = payload?.title || 'LaTeX Project'

    const init = await window.api.latexProjectInit({ projectDir, title })
    const mainFilePath = init?.mainFilePath || nodeApi.path.join(projectDir, 'main.tex')
    if (payload?.main) {
      const normalized = normalizeVarText(payload.main)
      await window.api.latexProjectWrite(mainFilePath, normalized)
      if (createdVars.length) {
        const usage = extractVarUsages([normalized])
        createdVars.forEach((name) => {
          if (!usage.has(name)) deleteVariable(name, docEditor)
        })
      }
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: CustomLatexProjectExtensionProps.name,
        attrs: {
          id: uuidv4(),
          projectId,
          projectPath: projectDir,
          mainFilePath,
          title,
          status: 'idle',
          lastCompiledAt: null,
          lastPdfPath: ''
        }
      })
      .run()
    aiGenerationStore.finish()
  }
}