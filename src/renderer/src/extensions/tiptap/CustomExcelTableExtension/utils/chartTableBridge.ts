import { TableMap } from 'prosemirror-tables'
import type { Editor } from '@tiptap/core'
import { findParentNodeOfType } from '../../tiptap-table-plus/src/utilities/utils'
import { extensionAttributeNames, getRawDataAttribute } from './utils'
import { getVariable } from '../../CustomVarExtension/stores/variableManipulator'

type TableSelectionRange = {
  sheetName: string
  range: string
  tableNode: any
  tablePos: number
}

const getEditorId = (editor: any): string | null => {
  return (
    editor?.options?.editorId ||
    editor?.extensionManager?.extensions?.find((ext: any) => ext.name === 'excelTable')?.options
      ?.editorId ||
    null
  )
}

const extractVariableInputValue = (raw: any): string => {
  if (!raw) return ''
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw)
  }
  if (typeof raw === 'object') {
    if ('value' in raw) return String(raw.value ?? '')
    if ('prompt' in raw) return String(raw.prompt ?? '')
    if ('url' in raw) return String(raw.url ?? '')
  }
  return ''
}

const buildA1Range = (sr: number, sc: number, er: number, ec: number) => {
  const columnName = (index: number) => {
    let name = ''
    let current = index
    while (current >= 0) {
      name = String.fromCharCode((current % 26) + 65) + name
      current = Math.floor(current / 26) - 1
    }
    return name
  }
  return `${columnName(sc)}${sr + 1}:${columnName(ec)}${er + 1}`
}

const resolveTableNode = (editor: Editor, posHint?: number) => {
  const state = editor.state
  const tableType = editor.schema.nodes.table
  if (!tableType) return null
  const from = posHint ?? state.selection.from
  const direct = findParentNodeOfType(state, from, tableType)
  if (direct) return direct
  const fallback = findParentNodeOfType(state, state.selection.to, tableType)
  return fallback
}

export const getTableSelectionRange = (
  editor?: Editor | null,
  sheetName?: string
): TableSelectionRange | null => {
  if (!editor) return null
  let result = resolveTableNode(editor)
  let tableNode = result?.node
  let tablePos =
    typeof result?.pos === 'number'
      ? result.pos
      : typeof result?.start === 'number'
        ? Math.max(0, result.start - 1)
        : 0
  if (!tableNode && sheetName) {
    editor.state.doc.descendants((node, pos) => {
      if (node.type?.name !== 'table') return true
      if (node.attrs?.[extensionAttributeNames.sheet] !== sheetName) return true
      tableNode = node
      tablePos = pos
      return false
    })
  }
  if (!tableNode) return null
  const map = TableMap.get(tableNode)
  const width = map.width
  const height = map.height
  let sr = 0
  let sc = 0
  let er = Math.max(0, height - 1)
  let ec = Math.max(0, width - 1)

  const selection = editor.state.selection
  if (selection?.from != null && selection?.to != null) {
    const tableStart = tablePos + 1
    const tableEnd = tablePos + tableNode.nodeSize - 1
    if (selection.from >= tableStart && selection.to <= tableEnd) {
      const maxOffset = map.map[map.map.length - 1] ?? tableNode.nodeSize - 2
      const offsetFrom = Math.max(0, Math.min(selection.from - tableStart, maxOffset))
      const offsetTo = Math.max(0, Math.min(selection.to - tableStart, maxOffset))
      try {
        const start = map.findCell(offsetFrom)
        const end = map.findCell(offsetTo)
        if (start && end) {
          sr = Math.min(start.top, end.top)
          sc = Math.min(start.left, end.left)
          er = Math.max(start.bottom - 1, end.bottom - 1)
          ec = Math.max(start.right - 1, end.right - 1)
        }
      } catch {
        // fallback to full table range
      }
    }
  }

  const tableSheetName =
    (tableNode.attrs && tableNode.attrs[extensionAttributeNames.sheet]) ||
    sheetName ||
    ''
  return {
    sheetName: tableSheetName,
    range: buildA1Range(sr, sc, er, ec),
    tableNode,
    tablePos
  }
}

export const getTableDataFromEditor = (
  editor: Editor | null,
  sheetName: string,
  range: { sr: number; sc: number; er: number; ec: number } | null,
  tableId?: string | null
) => {
  if (!editor) return null
  let targetNode: any = null
  editor.state.doc.descendants((node, pos) => {
    if (node.type?.name !== 'table') return
    const nodeSheet = node.attrs?.[extensionAttributeNames.sheet]
    const nodeId = node.attrs?.uuid || node.attrs?.id || ''
    if (tableId && nodeId && nodeId === tableId) {
      targetNode = node
      return false
    }
    if (sheetName && nodeSheet === sheetName) {
      targetNode = node
    }
  })
  if (!targetNode) return null
  return getTableDataFromNode(targetNode, editor, range)
}

export const getTableDataFromNode = (
  tableNode: any,
  editor: Editor | null,
  range: { sr: number; sc: number; er: number; ec: number } | null
) => {
  if (!tableNode) return null
  const map = TableMap.get(tableNode)
  const width = map.width
  const height = map.height
  const sr = range ? Math.max(0, range.sr) : 0
  const sc = range ? Math.max(0, range.sc) : 0
  const er = range ? Math.min(height - 1, range.er) : height - 1
  const ec = range ? Math.min(width - 1, range.ec) : width - 1
  const editorId = getEditorId(editor)

  const table: any[][] = []
  for (let r = sr; r <= er; r += 1) {
    const row: any[] = []
    for (let c = sc; c <= ec; c += 1) {
      const cellPos = map.map[r * width + c]
      const cell = tableNode.nodeAt(cellPos)
      if (!cell) {
        row.push(null)
        continue
      }
      const varId = cell.attrs?.[extensionAttributeNames.var] || null
      const raw = getRawDataAttribute(cell, true)
      let value: any = raw
      if (varId) {
        const resolved = getVariable(varId, editorId ?? undefined, true)
        value = extractVariableInputValue(resolved ?? raw)
      }
      row.push(value)
    }
    table.push(row)
  }
  return table
}
