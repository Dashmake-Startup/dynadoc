/**
 * Copyright (C) 2025 Dashmake Inc.
 *
 * This file is part of DDoc Office.
 *
 * DDoc Office is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DDoc Office is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
 */
import { mount, unmount } from 'svelte';
import { Editor, Extension,Node, mergeAttributes } from '@tiptap/core'
import HyperFormula from 'hyperformula'
import { Step } from 'prosemirror-transform'
// import { nodeApi } from '../../../utils/shims/node'
// import { editor } from '@tiptap/core'
import { Decoration, DecorationSet } from 'prosemirror-view'
// import { Fragment } from "prosemirror-model"
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import CustomExcelTableExtensionVarLabel from './components/CustomExcelTableExtensionVarLabel.svelte';
import { Slice, Fragment, Node as ProseMirrorNode } from "@tiptap/pm/model";
import { deleteVariable, ensureVariableGroup, getVariable, listVariables, onVariableChange, setVariable, VariableManipulatorUtils } from '../CustomVarExtension/stores/variableManipulator';
import { extensionAttributeNames, extensionName, getRawDataAttribute, isInsideFormula, normalizeIfFormula } from './utils/utils';
import type { VariableInsertMode } from '../CustomVarExtension/utils/utils';
import { GenericFormatingEditorCommands } from '../../../components/common/actions/formatting/commands/GenericFormatingEditorCommands.svelte';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isUuid = (value: any): boolean => typeof value === 'string' && UUID_REGEX.test(value)

const getEditorId = (editor: any): string | null => {
  return (
    editor?.options?.editorId ||
    editor?.extensionManager?.extensions?.find((ext) => ext.name === extensionName)?.options?.editorId ||
    null
  )
}
import CustomExcelTableExtensionVarInput from './components/CustomExcelTableExtensionVarInput.svelte';
import TableExcelViewModal from './components/TableExcelViewModal.svelte';
import { openTableExcelView, closeTableExcelView } from './components/tableExcelView.store';

import { TableMap } from 'prosemirror-tables'


let hyperFormula = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' })
let sheetNamePrefix = 'TableSheet'
let tableUpdateTimer: ReturnType<typeof setTimeout> | null = null

let _tableExcelModal
let _tableExcelModalWrapper
let _tableExcelStylesInjected = false
let _excelContextMenuEl: HTMLElement | null = null
// Bulk actions reuse the existing Cell Inspector (CustomExcelTableExtensionVarInput)
// Convert column index → Excel-like letter
function getColumnName(index: number) {
  let name = ''
  while (index >= 0) {
    name = String.fromCharCode((index % 26) + 65) + name
    index = Math.floor(index / 26) - 1
  }
  return name
}

function buildTableSheetData(
  tableNode: ProseMirrorNode,
  sheetName: string,
  sheetId?: string,
  status?: number,
  editorId?: string | null
) {
  const map = TableMap.get(tableNode)
  const width = map.width
  const height = map.height
  const celldata: any[] = []
  const data: any[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null)
  )

  const uuidIndex = new Map<string, { sheet: string; row: number; col: number; label: string }>()
  if (editorId) {
    let vars = listVariables([], editorId)
    if (!vars.length) {
      vars = listVariables([], undefined)
    }
    vars.forEach((entry) => {
      const id = entry?.name
      if (!id) return
      const raw = getVariable(id, editorId, false) as any
      if (!raw || typeof raw !== 'object') return
      if (!raw.nodeId) return
      const row = Number(raw.row)
      const col = Number(raw.col)
      if (!Number.isFinite(row) || !Number.isFinite(col)) return
      const label = raw.name || `${getColumnName(col)}${row + 1}`
      uuidIndex.set(id, { sheet: raw.nodeId, row, col, label })
    })
  }

  const toA1 = (row: number, col: number) => `${getColumnName(col)}${row + 1}`

  const translateUuidFormulaToA1 = (value: string): string | null => {
    const raw = String(value || '').trim()
    if (!raw || !/\{[0-9a-f\-]{36}\}/i.test(raw)) return null

    let text = raw
    // Ranges first
    text = text.replace(/\{([0-9a-f\-]{36})\}\s*:\s*\{([0-9a-f\-]{36})\}/gi, (full, startId, endId) => {
      const start = uuidIndex.get(startId)
      const end = uuidIndex.get(endId)
      if (!start || !end) return full
      if (start.sheet !== end.sheet) return full
      const startRef = toA1(start.row, start.col)
      const endRef = toA1(end.row, end.col)
      return start.sheet === sheetName ? `${startRef}:${endRef}` : `${start.sheet}!${startRef}:${endRef}`
    })

    // Singles
    text = text.replace(/\{([0-9a-f\-]{36})\}/gi, (full, id) => {
      const entry = uuidIndex.get(id)
      if (!entry) return full
      const ref = toA1(entry.row, entry.col)
      return entry.sheet === sheetName ? ref : `${entry.sheet}!${ref}`
    })

    return text
  }

  const extractRawValue = (raw: any): string => {
    if (!raw) return ''
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      return String(raw)
    }
    if (typeof raw === 'object') {
      if (typeof raw.value === 'string' || typeof raw.value === 'number') return String(raw.value)
      if (typeof raw.prompt === 'string') return String(raw.prompt)
    }
    return ''
  }

  const normalizeComputedValue = (computed: any): { value: any; display: string } => {
    if (computed === null || computed === undefined) return { value: null, display: '' }
    if (typeof computed === 'object') {
      const flat = extractVariableInputValue(computed as any)
      return { value: flat, display: flat !== undefined && flat !== null ? String(flat) : '' }
    }
    return { value: computed, display: String(computed) }
  }

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cellPos = map.map[r * width + c]
      const cell = tableNode.nodeAt(cellPos)
      if (!cell) continue
      const raw = cell.attrs?.[extensionAttributeNames.raw] ?? ''
      const varId = cell.attrs?.[extensionAttributeNames.var] || null
      let value = raw
      let computedValue: any = null
      if (varId) {
        const rawVar = getVariable(varId, editorId ?? undefined, false)
        const rawValue = extractRawValue(rawVar)
        if (rawValue) {
          value = rawValue
        }
        let resolved = getVariable(varId, editorId ?? undefined, true)
        if (resolved === undefined && editorId) {
          resolved = getVariable(varId, undefined, true)
        }
        computedValue = resolved
      }
      if (value === null || value === undefined || String(value).trim() === '') continue
      const label = cell.attrs?.[extensionAttributeNames.varLabel] || ''
      const formulaRaw = typeof value === 'string' ? translateUuidFormulaToA1(value) : null
      const formula = typeof formulaRaw === 'string' ? formulaRaw.replace(/^=\s*/, '') : null
      const computed = normalizeComputedValue(computedValue ?? value)
      const cellObj = formula
        ? { f: `=${formula}`, v: computed.value, m: computed.display }
        : { v: value, m: String(value ?? '') }
      data[r][c] = cellObj
      celldata.push({
        r,
        c,
        v: cellObj,
        custom: { varId, label }
      })
    }
  }

  if (editorId) {
    let vars = listVariables([], editorId)
    if (!vars.length) {
      vars = listVariables([], undefined)
    }
    vars.forEach((entry) => {
      const id = entry?.name
      if (!id) return
      const raw = getVariable(id, editorId, false) as any
      if (!raw || typeof raw !== 'object') return
      if (raw.nodeId !== sheetName) return
      const row = Number(raw.row)
      const col = Number(raw.col)
      if (!Number.isFinite(row) || !Number.isFinite(col)) return
      if (row < 0 || col < 0 || row >= height || col >= width) return
      if (data[row][col]) return

      const rawValue = extractRawValue(raw)
      let value: any = rawValue
      let computedValue: any = null
      if (!rawValue) {
        computedValue = getVariable(id, editorId, true)
        value = computedValue
        if (value !== null && value !== undefined && typeof value === 'object') {
          value = extractVariableInputValue(value)
        }
      } else {
        computedValue = getVariable(id, editorId, true)
      }
      if (value === null || value === undefined || String(value).trim() === '') return

      const label = raw.name || `${getColumnName(col)}${row + 1}`
      const formulaRaw = typeof value === 'string' ? translateUuidFormulaToA1(value) : null
      const formula = typeof formulaRaw === 'string' ? formulaRaw.replace(/^=\s*/, '') : null
      const computed = normalizeComputedValue(computedValue ?? value)
      const cellObj = formula
        ? { f: `=${formula}`, v: computed.value, m: computed.display }
        : { v: value, m: String(value ?? '') }
      data[row][col] = cellObj
      celldata.push({
        r: row,
        c: col,
        v: cellObj,
        custom: { varId: id, label }
      })
    })
  }

  return [
    {
      id: sheetId || sheetName,
      name: sheetName,
      celldata,
      data,
      status: typeof status === 'number' ? status : undefined
    }
  ]
}

function buildAllTableSheets(
  editor: Editor,
  activeSheetName: string
): any[] {
  const sheets: any[] = []
  let tableIndex = 0
  let sheetIndex = 0
  const editorId = getEditorId(editor)
  editor.state.doc.descendants((node) => {
    if (node.type.name !== 'table') return true
    let sheetName = node.attrs?.[extensionAttributeNames.sheet]
    if (!sheetName) {
      sheetName = `${sheetNamePrefix}${++tableIndex}`
    } else {
      tableIndex += 1
    }
    const sheetId = `sheet-${++sheetIndex}`
    const status = sheetName === activeSheetName ? 1 : 0
    const data = buildTableSheetData(node, sheetName, sheetId, status, editorId)
    sheets.push(...data)
    return true
  })
  if (sheets.length > 0 && !sheets.some((s) => s.status === 1)) {
    sheets[0].status = 1
  }
  return sheets
}

function resolveSheetNameForTable(editor: Editor, tablePos: number, tableNode: ProseMirrorNode): string {
  const existing = tableNode.attrs?.[extensionAttributeNames.sheet]
  if (existing) return existing
  let count = 0
  let foundName = `${sheetNamePrefix}1`
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return true
    count += 1
    if (pos === tablePos) {
      foundName = `${sheetNamePrefix}${count}`
      return false
    }
    return true
  })
  const tr = editor.state.tr.setNodeMarkup(tablePos, undefined, {
    ...tableNode.attrs,
    [extensionAttributeNames.sheet]: foundName
  })
  tr.setMeta('preventInternalAppend', true)
  editor.view.dispatch(tr)
  return foundName
}

function flattenSheetData(sheet: any, width: number, height: number): string[][] {
  const data = Array.from({ length: height }, () => Array(width).fill(''))
  if (Array.isArray(sheet?.data)) {
    for (let r = 0; r < Math.min(height, sheet.data.length); r++) {
      const row = sheet.data[r]
      if (!Array.isArray(row)) continue
      for (let c = 0; c < Math.min(width, row.length); c++) {
        const v = row[c]
        if (v && typeof v === 'object') {
          if ('f' in v && v.f) {
            data[r][c] = String(v.f)
          } else if ('v' in v && v.v !== null && v.v !== undefined) {
            data[r][c] = String(v.v)
          } else {
            data[r][c] = ''
          }
        } else {
          data[r][c] = v !== null && v !== undefined ? String(v) : ''
        }
      }
    }
    return data
  }
  const cells = sheet?.celldata || []
  for (const cell of cells) {
    const r = Number(cell?.r)
    const c = Number(cell?.c)
    if (!Number.isFinite(r) || !Number.isFinite(c)) continue
    if (r < 0 || c < 0 || r >= height || c >= width) continue
    const v = cell?.v
    let value = ''
    if (v && typeof v === 'object') {
      if ('f' in v && v.f) value = String(v.f)
      else if ('v' in v) value = String(v.v ?? '')
    }
    else if (v !== null && v !== undefined) value = String(v)
    data[r][c] = value
  }
  return data
}

function applySheetToTable(
  editor: Editor,
  tablePos: number,
  tableNode: ProseMirrorNode,
  sheet: any,
  selection?: { row?: number[]; column?: number[] } | null
) {
  const sheetName = tableNode.attrs?.[extensionAttributeNames.sheet] || `Table_${tablePos}`
  const editorId = getEditorId(editor)
  const MAX_TABLE_ROWS = 30
  const MAX_TABLE_COLS = 30

  const getNonEmptyBounds = (input: any): { rows: number; cols: number; maxRow: number; maxCol: number } => {
    let maxRow = -1
    let maxCol = -1
    if (Array.isArray(input?.data)) {
      input.data.forEach((row, r) => {
        if (!Array.isArray(row)) return
        row.forEach((cell, c) => {
          if (cell == null) return
          const value = cell && typeof cell === 'object' && 'v' in cell ? cell.v : cell
          if (value == null || String(value).trim() === '') return
          maxRow = Math.max(maxRow, r)
          maxCol = Math.max(maxCol, c)
        })
      })
      return { rows: maxRow + 1, cols: maxCol + 1, maxRow, maxCol }
    }
    const celldata = input?.celldata || []
    celldata.forEach((cell) => {
      const v = cell?.v
      const value = v && typeof v === 'object' && 'v' in v ? v.v : v
      if (value == null || String(value).trim() === '') return
      maxRow = Math.max(maxRow, Number(cell?.r) || 0)
      maxCol = Math.max(maxCol, Number(cell?.c) || 0)
    })
    return { rows: maxRow + 1, cols: maxCol + 1, maxRow, maxCol }
  }

  const ensureTableSize = (targetRows: number, targetCols: number) => {
    let currentNode = editor.state.doc.nodeAt(tablePos)
    if (!currentNode) return
    let currentMap = TableMap.get(currentNode)
    let width = currentMap.width
    let height = currentMap.height
    const needsRows = targetRows > height
    const needsCols = targetCols > width
    if (!needsRows && !needsCols) return

    if (targetRows > MAX_TABLE_ROWS || targetCols > MAX_TABLE_COLS) {
      window.alert(
        `Some data is too far from the current table (max ${MAX_TABLE_ROWS} rows × ${MAX_TABLE_COLS} columns). ` +
          `Move the data closer (within ${MAX_TABLE_ROWS}x${MAX_TABLE_COLS}) before applying.`
      )
      return
    }

    const ok = window.confirm(
      `The Excel view has data outside the current table size (${height}x${width}). ` +
        `Create ${Math.max(0, targetRows - height)} new rows and ${Math.max(0, targetCols - width)} new columns?`
    )
    if (!ok) return

    const focusAtCell = (row: number, col: number) => {
      currentNode = editor.state.doc.nodeAt(tablePos)
      if (!currentNode) return false
      currentMap = TableMap.get(currentNode)
      const index = Math.max(0, Math.min(currentMap.height - 1, row)) * currentMap.width +
        Math.max(0, Math.min(currentMap.width - 1, col))
      const cellOffset = currentMap.map[index]
      const cellPos = tablePos + cellOffset + 1
      const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, cellPos))
      editor.view.dispatch(tr)
      return true
    }

    while (height < targetRows) {
      if (!focusAtCell(height - 1, 0)) break
      editor.chain().focus().addRowAfter().run()
      currentNode = editor.state.doc.nodeAt(tablePos)
      if (!currentNode) break
      currentMap = TableMap.get(currentNode)
      height = currentMap.height
      width = currentMap.width
    }

    while (width < targetCols) {
      if (!focusAtCell(0, width - 1)) break
      editor.chain().focus().addColumnAfter().run()
      currentNode = editor.state.doc.nodeAt(tablePos)
      if (!currentNode) break
      currentMap = TableMap.get(currentNode)
      height = currentMap.height
      width = currentMap.width
    }
  }

  const targetSize = getNonEmptyBounds(sheet)
  ensureTableSize(targetSize.rows, targetSize.cols)

  const refreshedNode = editor.state.doc.nodeAt(tablePos)
  if (!refreshedNode) return
  const map = TableMap.get(refreshedNode)
  const width = map.width
  const height = map.height
  const data = flattenSheetData(sheet, width, height)

  const isFormulaInput = (value: string): boolean => {
    const text = String(value || '').trim()
    if (!text) return false
    if (text.startsWith('=')) return true
    if (/[+\-*/^]/.test(text)) return true
    if (/[A-Za-z]+\s*\(/.test(text)) return true
    if (/[A-Z]+[0-9]+\s*:\s*[A-Z]+[0-9]+/i.test(text)) return true
    return false
  }

  const parseCellRef = (ref: string): { row: number; col: number } | null => {
    const match = /^([A-Za-z]+)(\d+)$/.exec(ref.trim())
    if (!match) return null
    const col = getColumnIndexFromName(match[1])
    const row = Number(match[2]) - 1
    if (col < 0 || row < 0) return null
    return { row, col }
  }

  const resolveVarIdForCell = (row: number, col: number, allowCreate: boolean): string | null => {
    if (row < 0 || col < 0 || row >= height || col >= width) return null
    const index = row * width + col
    const cellOffset = map.map[index]
    const cell = refreshedNode.nodeAt(cellOffset)
    let varId = cell?.attrs?.[extensionAttributeNames.var] || null
    if (!isUuid(varId) && allowCreate && editorId) {
      const label = `${getColumnName(col)}${row + 1}`
      const payload = {
        type: VariableManipulatorUtils.VAR_TYPE.text,
        value: '',
        name: label,
        nodeId: sheetName,
        row,
        col
      }
      varId = setVariable(label, payload, editorId) ?? varId
    }
    return isUuid(varId) ? varId : null
  }

  const translateFormulaToUuid = (raw: string): string => {
    let text = String(raw || '').trim()
    if (text.startsWith('=')) text = text.slice(1).trim()

    const uuidTokens: string[] = []
    text = text.replace(/\{[0-9a-f\-]{36}\}/gi, (match) => {
      const token = `__UUID_${uuidTokens.length}__`
      uuidTokens.push(match)
      return token
    })

    const resolveVarIdBySheet = (sheet: string, row: number, col: number): string | null => {
      if (!editorId) return null
      if (sheet === sheetName) return resolveVarIdForCell(row, col, true)
      const pos = findTablePosBySheet(editor, sheet)
      if (pos === null) return null
      const node = editor.state.doc.nodeAt(pos)
      if (!node) return null
      const localMap = TableMap.get(node)
      if (row < 0 || col < 0 || row >= localMap.height || col >= localMap.width) return null
      const index = row * localMap.width + col
      const cellOffset = localMap.map[index]
      const cell = node.nodeAt(cellOffset)
      let id = cell?.attrs?.[extensionAttributeNames.var] || null
      if (!isUuid(id)) {
        const label = `${getColumnName(col)}${row + 1}`
        const payload = {
          type: VariableManipulatorUtils.VAR_TYPE.text,
          value: '',
          name: label,
          nodeId: sheet,
          row,
          col
        }
        id = setVariable(label, payload, editorId) ?? id
      }
      return isUuid(id) ? id : null
    }

    const parseSheetRef = (ref: string): { sheet: string; row: number; col: number } | null => {
      const match = /^([^!]+)!([A-Za-z]+)(\d+)$/.exec(ref.trim())
      if (!match) return null
      const sheet = match[1]
      const col = getColumnIndexFromName(match[2])
      const row = Number(match[3]) - 1
      if (col < 0 || row < 0) return null
      return { sheet, row, col }
    }

    // Sheet-qualified ranges
    text = text.replace(/([^!\s]+!\s*[A-Za-z]+[0-9]+)\s*:\s*([A-Za-z]+[0-9]+)/g, (full, startRef, endRef) => {
      const start = parseSheetRef(String(startRef).replace(/\s+/g, ''))
      const end = parseCellRef(endRef)
      if (!start || !end) return full
      const startId = resolveVarIdBySheet(start.sheet, start.row, start.col)
      const endId = resolveVarIdBySheet(start.sheet, end.row, end.col)
      if (startId && endId) return `{${startId}}:{${endId}}`
      return full
    })

    // Ranges (same sheet)
    text = text.replace(/([A-Za-z]+[0-9]+)\s*:\s*([A-Za-z]+[0-9]+)/g, (full, startRef, endRef) => {
      const start = parseCellRef(startRef)
      const end = parseCellRef(endRef)
      if (!start || !end) return full
      const startId = resolveVarIdForCell(start.row, start.col, true)
      const endId = resolveVarIdForCell(end.row, end.col, true)
      if (startId && endId) return `{${startId}}:{${endId}}`
      return full
    })

    // Single refs
    text = text.replace(/([^!\s]+!\s*[A-Za-z]+[0-9]+)/g, (full) => {
      const parsed = parseSheetRef(String(full).replace(/\s+/g, ''))
      if (!parsed) return full
      const id = resolveVarIdBySheet(parsed.sheet, parsed.row, parsed.col)
      return id ? `{${id}}` : full
    })

    text = text.replace(/([A-Za-z]+)(\d+)/g, (full, colLetters, rowDigits, offset, original) => {
      const before = original[offset - 1]
      const after = original[offset + full.length]
      if (before === '{' || after === '}') return full
      if (before === '_' || after === '_') return full
      const coord = parseCellRef(`${colLetters}${rowDigits}`)
      if (!coord) return full
      const id = resolveVarIdForCell(coord.row, coord.col, true)
      return id ? `{${id}}` : full
    })

    text = text.replace(/__UUID_(\d+)__/g, (full, idx) => uuidTokens[Number(idx)] || full)

    return text
  }

  let tr = editor.state.tr
  const updates: Array<{
    cellPos: number
    cell: ProseMirrorNode
    nextRaw: string
    row: number
    col: number
  }> = []

  const rowRange = selection?.row || [0, height - 1]
  const colRange = selection?.column || [0, width - 1]
  const rowStart = Math.max(0, rowRange[0] ?? 0)
  const rowEnd = Math.min(height - 1, rowRange[1] ?? height - 1)
  const colStart = Math.max(0, colRange[0] ?? 0)
  const colEnd = Math.min(width - 1, colRange[1] ?? width - 1)

  for (let r = rowStart; r <= rowEnd; r++) {
    for (let c = colStart; c <= colEnd; c++) {
      const cellOffset = map.map[r * width + c]
      const cellPos = tablePos + cellOffset + 1
      const cell = refreshedNode.nodeAt(cellOffset)
      if (!cell) continue
      const nextRaw = data[r][c] ?? ''
      updates.push({
        cellPos,
        cell,
        nextRaw,
        row: r,
        col: c
      })
    }
  }

  updates
    .sort((a, b) => b.cellPos - a.cellPos)
    .forEach(({ cellPos, cell, nextRaw, row, col }) => {
      let nextVarId = cell.attrs?.[extensionAttributeNames.var] || null
      const label = cell.attrs?.[extensionAttributeNames.varLabel] || `${getColumnName(col)}${row + 1}`
      const hasValue = String(nextRaw ?? '').trim().length > 0
      const displayFormula = hasValue && isFormulaInput(nextRaw) ? String(nextRaw ?? '').trim() : ''
      const valueToStore = hasValue && isFormulaInput(nextRaw)
        ? translateFormulaToUuid(nextRaw)
        : nextRaw

      if (editorId) {
        if (hasValue) {
          if (isUuid(nextVarId)) {
            const existingRaw = getVariable(nextVarId, editorId, false)
            if (existingRaw && typeof existingRaw === 'object') {
              setVariable(
                nextVarId,
                {
                  ...existingRaw,
                  value: valueToStore,
                  displayFormula,
                  name: label,
                  nodeId: sheetName,
                  row,
                  col
                },
                editorId
              )
            } else {
              setVariable(
                nextVarId,
                {
                  type: VariableManipulatorUtils.VAR_TYPE.text,
                  value: valueToStore,
                  displayFormula,
                  name: label,
                  nodeId: sheetName,
                  row,
                  col
                },
                editorId
              )
            }
          } else {
            const payload = {
              type: VariableManipulatorUtils.VAR_TYPE.text,
              value: valueToStore,
              displayFormula,
              name: label,
              nodeId: sheetName,
              row,
              col
            }
            nextVarId = setVariable(label, payload, editorId) ?? nextVarId
          }
        } else if (isUuid(nextVarId)) {
          deleteVariable(nextVarId, editorId)
          nextVarId = null
        }
      }

      const newAttrs = {
        ...cell.attrs,
        [extensionAttributeNames.raw]: valueToStore,
        [extensionAttributeNames.varLabel]: label,
        [extensionAttributeNames.var]: hasValue && isUuid(nextVarId) ? nextVarId : null
      }
      tr = tr.setNodeMarkup(cellPos, undefined, newAttrs)
    })
  tr.setMeta('preventInternalAppend', true)
  editor.view.dispatch(tr)
  _updateCellVars(editor)
}

function findTablePosBySheet(editor: Editor, sheetName: string): number | null {
  let found: number | null = null
  editor.state.doc.descendants((node, pos) => {
    if (found !== null) return false
    if (node.type.name === 'table' && node.attrs?.[extensionAttributeNames.sheet] === sheetName) {
      found = pos
      return false
    }
    return true
  })
  return found
}

function openTableExcelModal(editor: Editor, tablePos: number, tableNode: ProseMirrorNode) {
  const sheetName = resolveSheetNameForTable(editor, tablePos, tableNode)
  const editorId = getEditorId(editor) || 'doc'
  const rootPath = `${editorId}-table-excel.sheet`

  if (!_tableExcelModalWrapper) {
    _tableExcelModalWrapper = document.createElement('div')
    document.body.appendChild(_tableExcelModalWrapper)
    _tableExcelModal = mount(TableExcelViewModal, {
      target: _tableExcelModalWrapper
    })
  }

  const seed = Date.now()
  const initialSheets = buildAllTableSheets(editor, sheetName)

  openTableExcelView({
    title: `Excel View · ${sheetName}`,
    rootPath,
    activeSheetName: sheetName,
    initialSheets,
    seedToken: seed,
    onClose: () => {
      closeTableExcelView()
    },
    onReload: () => {
      const currentPos = findTablePosBySheet(editor, sheetName)
      if (currentPos === null) return
      const currentNode = editor.state.doc.nodeAt(currentPos)
      if (!currentNode) return
      openTableExcelModal(editor, currentPos, currentNode)
    },
    onApply: (sheets: any[], options?: { selectionOnly?: boolean; selection?: any }) => {
      const currentPos = findTablePosBySheet(editor, sheetName)
      if (currentPos === null) return
      const currentNode = editor.state.doc.nodeAt(currentPos)
      if (!currentNode) return
      const sheet = Array.isArray(sheets)
        ? sheets.find((item: any) => item?.name === sheetName) || sheets[0]
        : null
      if (!sheet) return
      applySheetToTable(editor, currentPos, currentNode, sheet, options?.selectionOnly ? options?.selection : null)
      closeTableExcelView()
    }
  })
}

export function openTableExcelModalForChart(editor: Editor, tableId: string): boolean {
  if (!editor || !tableId) return false
  let foundPos: number | null = null
  let foundNode: ProseMirrorNode | null = null
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return true
    const nodeId = node.attrs?.uuid || node.attrs?.id || ''
    if (nodeId === tableId) {
      foundPos = pos
      foundNode = node
      return false
    }
    return true
  })
  if (foundPos == null || !foundNode) return false
  openTableExcelModal(editor, foundPos, foundNode)
  return true
}

function ensureTableExcelStyles() {
  if (_tableExcelStylesInjected) return
  _tableExcelStylesInjected = true
  const style = document.createElement('style')
  style.textContent = `
    .excel-table-launcher {
      display: inline-flex;
      position: relative;
      margin-right: 6px;
      z-index: 5;
    }
    .excel-table-launcher-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 2px 6px;
      border-radius: 6px;
      border: 1px solid rgba(0, 190, 172, 0.4);
      color: #66f0e0;
      background: rgba(0, 190, 172, 0.12);
      cursor: pointer;
    }
    .excel-table-launcher-btn:hover {
      background: rgba(0, 190, 172, 0.22);
    }
    .excel-table-context-menu {
      position: fixed;
      z-index: 10060;
      background: #1b1b1b;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
      padding: 6px;
      min-width: 160px;
      display: none;
    }
    .excel-table-context-menu button {
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      color: #e7e7e7;
      padding: 6px 8px;
      font-size: 11px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .excel-table-context-menu button:hover {
      background: rgba(0, 190, 172, 0.2);
      color: #66f0e0;
    }

  `
  document.head.appendChild(style)
}

function ensureTableContextMenu() {
  if (_excelContextMenuEl) return
  _excelContextMenuEl = document.createElement('div')
  _excelContextMenuEl.className = 'excel-table-context-menu'
  _excelContextMenuEl.innerHTML = `
    <button type="button" data-action="excel-view">
      <i class="ph-light ph-table"></i>
      Open Excel View
    </button>
    <button type="button" data-action="chart-selection-below">
      <i class="ph-light ph-chart-line"></i>
      Chart below selection
    </button>
    <button type="button" data-action="chart-selection-above">
      <i class="ph-light ph-chart-line"></i>
      Chart above selection
    </button>
  `
  document.body.appendChild(_excelContextMenuEl)

  document.addEventListener('click', () => {
    if (_excelContextMenuEl) _excelContextMenuEl.style.display = 'none'
  })
}

function showTableContextMenu(
  x: number,
  y: number,
  editor: Editor,
  tablePos: number,
  tableNode: ProseMirrorNode,
  cellPos: number
) {
  ensureTableContextMenu()
  if (!_excelContextMenuEl) return
  _excelContextMenuEl.style.left = `${x}px`
  _excelContextMenuEl.style.top = `${y}px`
  _excelContextMenuEl.style.display = 'block'

  const btn = _excelContextMenuEl.querySelector('[data-action="excel-view"]') as HTMLButtonElement
  if (btn) {
    btn.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      _excelContextMenuEl!.style.display = 'none'
      openTableExcelModal(editor, tablePos, tableNode)
    }
  }

  const chartBelowBtn = _excelContextMenuEl.querySelector(
    '[data-action="chart-selection-below"]'
  ) as HTMLButtonElement
  if (chartBelowBtn) {
    chartBelowBtn.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      _excelContextMenuEl!.style.display = 'none'
      if (Number.isFinite(cellPos)) {
        const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, cellPos))
        editor.view.dispatch(tr)
      }
      GenericFormatingEditorCommands.insertChartBelowSelection('bar')
    }
  }

  const chartAboveBtn = _excelContextMenuEl.querySelector(
    '[data-action="chart-selection-above"]'
  ) as HTMLButtonElement
  if (chartAboveBtn) {
    chartAboveBtn.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      _excelContextMenuEl!.style.display = 'none'
      if (Number.isFinite(cellPos)) {
        const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, cellPos))
        editor.view.dispatch(tr)
      }
      GenericFormatingEditorCommands.insertChartAboveSelection('bar')
    }
  }
}

function applyBulkToTable(
  editor: Editor,
  tablePos: number,
  tableNode: ProseMirrorNode,
  formula: any,
  insertVariable?: boolean,
  overrideNodeContent?: boolean
) {
  const sheetName = resolveSheetNameForTable(editor, tablePos, tableNode)
  const editorId = getEditorId(editor) || 'doc'
  const map = TableMap.get(tableNode)
  const width = map.width
  const height = map.height
  const paragraph = editor.schema.nodes.paragraph
  if (!paragraph) return

  const displayFormula = typeof formula === 'string' ? String(formula ?? '').trim() : ''
  const valueToStore = typeof formula === 'string' ? normalizeIfFormula(formula) : String(formula ?? '')

  let tr = editor.state.tr
  const updates: Array<{ cellPos: number; cell: ProseMirrorNode; row: number; col: number; label: string; varId: string | null }> = []

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cellOffset = map.map[r * width + c]
      const cell = tableNode.nodeAt(cellOffset)
      if (!cell) continue
      const cellPos = tablePos + cellOffset + 1
      const label = cell.attrs?.[extensionAttributeNames.varLabel] || `${getColumnName(c)}${r + 1}`
      let varId = cell.attrs?.[extensionAttributeNames.var] || null
      if (insertVariable) {
        if (!isUuid(varId)) {
          const payload = {
            type: VariableManipulatorUtils.VAR_TYPE.text,
            value: valueToStore,
            displayFormula,
            name: label,
            nodeId: sheetName,
            row: r,
            col: c
          }
          varId = setVariable(label, payload, editorId) ?? varId
        } else {
          const existingRaw = getVariable(varId, editorId, false)
          if (existingRaw && typeof existingRaw === 'object') {
            setVariable(
              varId,
              { ...(existingRaw as any), value: valueToStore, displayFormula, name: label, nodeId: sheetName, row: r, col: c },
              editorId
            )
          } else {
            setVariable(
              varId,
              { type: VariableManipulatorUtils.VAR_TYPE.text, value: valueToStore, displayFormula, name: label, nodeId: sheetName, row: r, col: c },
              editorId
            )
          }
        }
      }

      updates.push({ cellPos, cell, row: r, col: c, label, varId: isUuid(varId) ? varId : null })
    }
  }

  updates
    .sort((a, b) => b.cellPos - a.cellPos)
    .forEach(({ cellPos, cell, row, col, label, varId }) => {
      const nextAttrs = {
        ...cell.attrs,
        [extensionAttributeNames.raw]: valueToStore,
        [extensionAttributeNames.varLabel]: label,
        [extensionAttributeNames.var]: insertVariable && varId ? varId : null,
        [extensionAttributeNames.row]: String(row),
        [extensionAttributeNames.col]: String(col + 1),
        [extensionAttributeNames.sheet]: sheetName
      }
      tr = tr.setNodeMarkup(cellPos, undefined, nextAttrs)

      if (overrideNodeContent) {
        const from = cellPos + 1
        const to = cellPos + cell.nodeSize - 1
        const text = insertVariable && varId ? `{${varId}}` : valueToStore
        const content = paragraph.create(null, text ? editor.schema.text(String(text)) : undefined)
        tr = tr.replaceWith(from, to, content)
      }
    })

  tr.setMeta('preventInternalAppend', true)
  editor.view.dispatch(tr)
  _updateCellVars(editor)
}

function findTableFromPos(state: any, pos: number): { node: ProseMirrorNode; pos: number } | null {
  const _pos = state.doc.resolve(pos)
  for (let depth = _pos.depth; depth > 0; depth--) {
    const node = _pos.node(depth)
    if (node.type.name === 'table') {
      return { node, pos: _pos.before(depth) }
    }
  }
  return null
}

function getColumnIndexFromName(name: string): number {
  if (!name) return -1
  let index = 0
  const upper = name.toUpperCase()
  for (let i = 0; i < upper.length; i++) {
    const code = upper.charCodeAt(i)
    if (code < 65 || code > 90) return -1
    index = index * 26 + (code - 64)
  }
  return index - 1
}

function resolveCellContext(nodeAttrs: Record<string, any>) {
  const rowAttr = nodeAttrs?.[extensionAttributeNames.row]
  const colAttr = nodeAttrs?.[extensionAttributeNames.col]
  let rowZero =
    typeof rowAttr === 'number' ? rowAttr : Number.isFinite(Number(rowAttr)) ? Number(rowAttr) : NaN
  let colZero =
    typeof colAttr === 'number' ? colAttr - 1 : Number.isFinite(Number(colAttr)) ? Number(colAttr) - 1 : NaN

  let displayLabel = nodeAttrs?.[extensionAttributeNames.varLabel] || ''

  if ((!Number.isFinite(rowZero) || rowZero < 0 || !Number.isFinite(colZero) || colZero < 0) && displayLabel) {
    const match = /^([A-Za-z]+)(\d+)$/.exec(displayLabel.trim())
    if (match) {
      const parsedCol = getColumnIndexFromName(match[1])
      const parsedRow = Number(match[2]) - 1
      if (parsedCol >= 0) colZero = parsedCol
      if (parsedRow >= 0) rowZero = parsedRow
    }
  }

  if (!Number.isFinite(rowZero) || rowZero < 0) rowZero = 0
  if (!Number.isFinite(colZero) || colZero < 0) colZero = 0

  if (!displayLabel) {
    displayLabel = `${getColumnName(colZero)}${rowZero + 1}`
  }

  return { rowZero, colZero, displayLabel }
}

function extractVariableInputValue(raw: any): string {
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


function _updateCellVars(editor) {
  // function _updateCellVars(_this) {
  // if (isUpdatingVars) return;
  // isUpdatingVars = true;
  // try {
  // const editor = _this.editor
  // const { state, view } = editor
  let tr = editor.state.tr
  // let tr = _this.editor.state.tr
  // console.log("initHyperFormula _updateCellVars", _this)

  let tableCount = 0
  const touchedTables = new Set<string>()

  let sheetName = ''
  let tableAttrs = {}
  let cellIndex = 0
  let rowIndex = 0

  editor.state.doc.descendants((node, pos) => {
    // _this.editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'table') {
      sheetName = `${sheetNamePrefix}${++tableCount}`
      touchedTables.add(sheetName)
      tableAttrs = { ...node.attrs, sheet: sheetName }
      // Update table itself
      tr = tr.setNodeMarkup(pos, undefined, tableAttrs)
      const editorId = getEditorId(editor)
      if (editorId) ensureVariableGroup(sheetName, editorId)
    }

    if (
      // cellNode.type.name === 'tableCell'
      (node.type.name === 'tableCell' || node.type.name === 'tableCell+') ||
      (node.type.name === 'tableHeader' || node.type.name === 'tableHeader+')) {
      console.log('initHyperFormula _updateCellVars new col', { rowIndex, cellIndex })
      const tdPos = pos
      const colName = getColumnName(cellIndex)
      const rawValue = getRawDataAttribute(node, true) || ''
      const displayRow = rowIndex
      const rowZero = Math.max(0, rowIndex - 1)
      const displayLabel = `${colName}${displayRow}`
      const editorId = getEditorId(editor)
      let varId = node.attrs?.[extensionAttributeNames.var]

      const hasValue = rawValue.toString().trim().length > 0
      if (editorId) {
        if (hasValue) {
          if (!isUuid(varId)) {
            const payload = {
              type: VariableManipulatorUtils.VAR_TYPE.text,
              value: rawValue ?? '',
              nodeId: sheetName,
              row: rowZero,
              col: cellIndex
            }
            varId = setVariable(displayLabel, payload, editorId) ?? varId
          } else {
            const existingRaw = getVariable(varId, editorId, false)
            if (existingRaw && typeof existingRaw === 'object') {
              const needsContext =
                existingRaw.nodeId === undefined ||
                existingRaw.row === undefined ||
                existingRaw.col === undefined
              const needsName = !existingRaw.name || existingRaw.name === 'Variable'
              const rawText = rawValue ?? ''
              const currentValue = typeof existingRaw.value === 'string' ? existingRaw.value : ''
              const needsValue = currentValue !== rawText
              if (needsContext || needsName) {
                setVariable(
                  varId,
                  {
                    ...existingRaw,
                    name: needsName ? displayLabel : existingRaw.name,
                    nodeId: sheetName,
                    row: rowZero,
                    col: cellIndex
                  },
                  editorId
                )
              } else if (needsValue) {
                setVariable(
                  varId,
                  {
                    ...existingRaw,
                    value: rawText,
                    name: displayLabel,
                    nodeId: sheetName,
                    row: rowZero,
                    col: cellIndex
                  },
                  editorId
                )
              }
            } else {
              setVariable(
                varId,
                {
                  type: VariableManipulatorUtils.VAR_TYPE.text,
                  value: rawValue ?? '',
                  name: displayLabel,
                  nodeId: sheetName,
                  row: rowZero,
                  col: cellIndex
                },
                editorId
              )
            }
          }
        } else if (isUuid(varId)) {
          deleteVariable(varId, editorId)
          varId = null
        }
      }

      const newAttrs = {
        ...node.attrs,
        [extensionAttributeNames.var]: hasValue && isUuid(varId) ? varId : null,
        [extensionAttributeNames.varLabel]: displayLabel,
        // [extensionAttributeNames.var]: `${colName}${rowIndex + 1}`,
        // [extensionAttributeNames.raw]: `${cellNode.textContent?.trim()}`,
        [extensionAttributeNames.raw]: rawValue,
        // [extensionAttributeNames.raw]: (isInsideFormula(cellNode) ? cellNode.attrs[extensionAttributeNames.raw] : null) || `${cellNode.textContent?.trim()}`,
        // [extensionAttributeNames.computed]: `${cellNode.textContent?.trim()}`,
        [extensionAttributeNames.row]: rowZero.toString(),
        // [extensionAttributeNames.row]: (rowIndex + 1).toString(),
        [extensionAttributeNames.col]: (cellIndex + 1).toString(),
        [extensionAttributeNames.sheet]: sheetName,
      }
      tr = tr.setNodeMarkup(tdPos, undefined, newAttrs)

      // Set variables in the file vars
      // if (newAttrs[extensionAttributeNames.raw]) {
      // setVariable(newAttrs[extensionAttributeNames.var], getRawDataAttribute(node, true), true)
      // setVariable(colName, newAttrs[extensionAttributeNames.raw])
      // }
      // VariableManipulatorUtils.

      cellIndex++
    }

    if (node.type.name === 'tableRow' || node.type.name === 'tableRow+') {
      console.log('initHyperFormula _updateCellVars new row b', { rowIndex, cellIndex })
      rowIndex++
      cellIndex = 0
      console.log('initHyperFormula _updateCellVars new row', { rowIndex, cellIndex })

    }

  })


  // if (_this.editor.state.tr.docChanged) 
  editor.view.dispatch(tr)

  if (typeof window !== 'undefined' && touchedTables.size) {
    touchedTables.forEach((name) => {
      window.dispatchEvent(
        new CustomEvent('dynadoc-table-dirty', {
          detail: { sheetName: name, editorId: getEditorId(editor) }
        })
      )
    })
  }

  // _computeFormulas(editor)

  // _this.editor.view.dispatch(tr)
  // console.log('✅ initHyperFormula Cell variables updated.')
  // Use visual update AFTER dispatch and avoid DOM re-triggers
  // requestAnimationFrame(() => addVisualLabels(_this));
  /* } finally {
    isUpdatingVars = false;
  } */
}

function scheduleTableUpdate(editor: any, delay: number) {
  if (tableUpdateTimer) clearTimeout(tableUpdateTimer)
  tableUpdateTimer = setTimeout(() => {
    tableUpdateTimer = null
    _updateCellVars(editor)
  }, delay)
}

function _computeFormulas(editor) {
  // function _computeFormulas(_this) {
  console.log("initHyperFormula _computeFormulas  ", editor)
  // console.log("initHyperFormula _computeFormulas  ", _this.editor, _this)



  let tr = editor.state.tr
  // let tr = _this.editor.state.tr
  // console.log("initHyperFormula _updateCellVars", _this)

  let tableCount = 0

  let sheetName = ''
  let sheetId = -1
  let tableAttrs = {}
  let cellIndex = 0
  let rowIndex = 0
  // let data = []
  let rowData = []

  editor.state.doc.descendants((node, pos) => {
    // _this.editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'table') {
      console.log('initHyperFormula _computeFormulas new tablee', { node, rowIndex, cellIndex })

      sheetName = `${sheetNamePrefix}${++tableCount}`
      if (!hyperFormula.doesSheetExist(sheetName)) hyperFormula.addSheet(sheetName)
      sheetId = hyperFormula.getSheetId(sheetName)
      // tableAttrs = { ...node.attrs, sheet: sheetName }
      // Update table itself
      // tr = tr.setNodeMarkup(pos, undefined, tableAttrs)
      /* if (data.length > 0) {
        if (!hyperFormula.doesSheetExist(sheetName)) hyperFormula.addSheet(sheetName)
        const sheetId = hyperFormula.getSheetId(sheetName)
        console.log('initHyperFormula _computeFormulas data.length', { data, sheetName, sheetId, rowIndex, cellIndex })

        hyperFormula.setSheetContent(sheetId, data)
      } */
      // data = []
    }

    if (
      // cellNode.type.name === 'tableCell'
      (node.type.name === 'tableCell' || node.type.name === 'tableCell+') ||
      (node.type.name === 'tableHeader' || node.type.name === 'tableHeader+')) {
      console.log('initHyperFormula _computeFormulas new col', { node, rowIndex, cellIndex })
      /* const tdPos = pos
      const colName = getColumnName(cellIndex)
      const newAttrs = {
        ...node.attrs,
        [extensionAttributeNames.var]: `${colName}${rowIndex}`,
        // [extensionAttributeNames.var]: `${colName}${rowIndex + 1}`,
        // [extensionAttributeNames.raw]: `${cellNode.textContent?.trim()}`,
        [extensionAttributeNames.raw]: getRawDataAttribute(node),
        // [extensionAttributeNames.raw]: (isInsideFormula(cellNode) ? cellNode.attrs[extensionAttributeNames.raw] : null) || `${cellNode.textContent?.trim()}`,
        // [extensionAttributeNames.computed]: `${cellNode.textContent?.trim()}`,
        [extensionAttributeNames.row]: (rowIndex).toString(),
        // [extensionAttributeNames.row]: (rowIndex + 1).toString(),
        [extensionAttributeNames.col]: (cellIndex + 1).toString(),
        [extensionAttributeNames.sheet]: sheetName,
      }
      tr = tr.setNodeMarkup(tdPos, undefined, newAttrs) */

      // rowData.push(getRawDataAttribute(node, true) || '')
      const formula = getRawDataAttribute(node, true) || ''
      const data = { sheet: sheetId, row: rowIndex - 1, col: cellIndex }

      // if (!hyperFormula.doesSheetExist(sheetName)) hyperFormula.addSheet(sheetName)
      // const sheetId = hyperFormula.getSheetId(sheetName)
      console.log('initHyperFormula _computeFormulas data.length', { data, sheetName, sheetId, rowIndex, cellIndex })

      hyperFormula.setCellContents(data, formula)



      cellIndex++
    }

    if (node.type.name === 'tableRow' || node.type.name === 'tableRow+') {
      rowIndex++
      cellIndex = 0
      /* if (rowData.length > 0) {
        // data.push(rowData)

        if (!hyperFormula.doesSheetExist(sheetName)) hyperFormula.addSheet(sheetName)
        const sheetId = hyperFormula.getSheetId(sheetName)
        console.log('initHyperFormula _computeFormulas data.length', { data, sheetName, sheetId, rowIndex, cellIndex })

        hyperFormula.setCellContents({ sheet: sheetId, row, col }, formula)

      }
      console.log('initHyperFormula _computeFormulas new row b', { rowData, data, rowIndex, cellIndex })

      rowData = [] */

      /* if (data.length > 0) {
        if (!hyperFormula.doesSheetExist(sheetName)) hyperFormula.addSheet(sheetName)
        const sheetId = hyperFormula.getSheetId(sheetName)
            console.log('initHyperFormula _computeFormulas data.length', {data,sheetName, sheetId,rowIndex, cellIndex })

        hyperFormula.setSheetContent(sheetId, data)
      }
      data = [] */
      console.log('initHyperFormula _computeFormulas new row', { rowIndex, cellIndex })

    }

  })







  // // const editor = _this.editor
  // const tables = Array.from(editor.view.dom.querySelectorAll('tables'))
  // // const tables = Array.from(editor.view.dom.querySelectorAll('table'))


  // tables.forEach((table, tIndex) => {
  //   const sheetName = `${sheetNamePrefix}${tIndex + 1}`
  //   const rows = Array.from(table.querySelectorAll('tr'))
  //   const data = rows.map((row) =>
  //     Array.from(row.querySelectorAll('td,th')).map((cell) => getRawDataAttribute(cell, true) || ''),
  //     // Array.from(row.querySelectorAll('td,th')).map((cell) => cell.innerText.trim() || ''),
  //   )
  //   console.log("initHyperFormula forEach _computeFormulas  ", data)

  //   if (!hyperFormula.doesSheetExist(sheetName)) hyperFormula.addSheet(sheetName)
  //   const sheetId = hyperFormula.getSheetId(sheetName)
  //   hyperFormula.setSheetContent(sheetId, data)

  //   /* rows.forEach((row, trIndex) => {
  //     Array.from(row.querySelectorAll('td,th')).forEach((td, tdIndex) => {
  //       // if (isInsideFormula(td)) {

  //       // Listen for blur (user finishes editing)
  //       td.addEventListener('blur', () => {
  //         const cellData = { sheet: sheetId, row: trIndex, col: tdIndex }
  //         console.log('User finished editing cell:', cellData)

  //         // const computed = hyperFormula.getCellValue(cellData)
  //         // console.log('Computed value:', computed, cellData)

  //         // // Update <p> content in this cell
  //         // const pElements = td.querySelectorAll('p')
  //         // Array.from(pElements).forEach((p) => {
  //         //   p.innerText = computed
  //         // })
  //       })
  //       // if (isInsideFormula(td) && getRawDataAttribute(td))
  //       // const rawValue = tdNode.attrs[extensionAttributeNames.raw] || ''
  //       /* const cellData = { sheet: sheetId, row: trIndex, col: tdIndex }
  //       console.log("initHyperFormula forEach _computeFormulas 3 -  ", cellData, { sheet: sheetId, row: trIndex, col: tdIndex })
  //       const computed = hyperFormula.getCellValue(cellData)
  //       // td.
  //       console.log("initHyperFormula forEach _computeFormulas 35 -  ", computed, cellData)

  //       const pElements = td.querySelectorAll('p')
  //       Array.from(pElements).
  //         forEach((p, pIndex) => {
  //           p.innerText = computed
  //         }) +/
  //       // }

  //     })
  //   }) */
  // })

  return recalculateAll(editor)
  // return recalculateAll(_this)
}

function setCellFormula(
  editor,
  table: HTMLElement,
  row: number,
  col: number,
  formula: string,
) {

  const tIndex = 0
  // const tIndex = Array.from(_this.editor.view.dom.querySelectorAll('table')).indexOf(table)
  const sheetName = `${sheetNamePrefix}${tIndex + 1}`

  if (!hyperFormula.doesSheetExist(sheetName)) hyperFormula.addSheet(sheetName)
  const sheetId = hyperFormula.getSheetId(sheetName)
  hyperFormula.setCellContents({ sheet: sheetId, row, col }, formula)
  recalculateAll(editor)
}



function recalculateAll(editor) {
  // function recalculateAll(_this) {
  // const editor = _this.editor
  let transaction = editor.state.tr
  let _tableIndex = 0
  let startPositions = []
  let endPositions = []
  let computedValues = []
  let sheetName = ''
  let sheetId
  let tableAttrs = {}
  let cellIndex = 0
  let rowIndex = 0

  editor.state.doc.descendants((node, pos) => {
    // console.log("initHyperFormula node nodeIndex  ", node)

    if (node.type.name === 'table') {
      // sheetName = `${sheetNamePrefix}${++_tableIndex}`
      sheetName = `${sheetNamePrefix}${_tableIndex + 1}`
      tableAttrs = { ...node.attrs, sheet: sheetName }
      sheetId = hyperFormula.getSheetId(sheetName)
      _tableIndex++// Update table itself
      transaction = transaction.setNodeMarkup(pos, undefined, tableAttrs)

    }

    if ((node.type.name === 'tableCell' || node.type.name === 'tableCell+') ||
      (node.type.name === 'tableHeader' || node.type.name === 'tableHeader+')) {
      const rawValue = node.attrs[extensionAttributeNames.raw] || ''
      // if (!isInsideFormula(node)) {
      // return
      // }
      // console.log('initHyperFormula recalculateAll isInsideFormula new col', { rowIndex, cellIndex })

      if (isInsideFormula(node)) {

        const data = { sheet: sheetId, row: rowIndex - 1, col: cellIndex }
        console.log('initHyperFormula recalculateAll isInsideFormula new col formula', { node, data, rowIndex, cellIndex })

        const computed = hyperFormula.getCellValue(data)
        const isComputedAnError = hyperFormula.getCellValueType(data).toString() == 'ERROR'
        // const isComputedAnError = hyperFormula.getCellValueType(data)
        const isComputedAnError2 = hyperFormula.getCellValueType(data)
        console.log("initHyperFormula recalculateAll isInsideFormula b tdNode  ", { isComputedAnError, isComputedAnError2, computed, data })


        if (computed !== undefined
          // if (isInsideFormula(tdNode) && computed !== undefined
          && !isComputedAnError
        ) {

          // if (rawValue.startsWith('=') && computed !== undefined) {
          const newAttrs = { ...node.attrs, [extensionAttributeNames.computed]: String(computed) }
          const updateAt = pos
          // updatePostions.push(updateAt)

          // 2️⃣ Compute position of cell start and end
          const start = updateAt + 1// position inside the <td> node
          // const start = updateAt + 1// position inside the <td> node
          // const end = updateAt + 2 // before </td>
          const end = updateAt + node.nodeSize - 1 // before </td>
          // const end = updateAt + tdNode.textContent.toString().length - 1 // before </td>
          // const end = pos + tdNode.nodeSize - 3 // before </td>

          startPositions.push(start)
          endPositions.push(end)
          computedValues.push(computed)
          console.log("initHyperFormula recalculateAll isInsideFormula b tdNode  ", { pos }, String(isComputedAnError), isComputedAnError2, node, "computed = ", computed, "data = ", data)

          transaction = transaction.setNodeMarkup(updateAt, undefined, newAttrs)

          // 3️⃣ Replace the inner text
          /* transaction = transaction.replaceWith(
            start,
            end,
            // editor.state.schema.text('yes')
            editor.state.schema.text(String(computed))
          ) */


          // console.log("initHyperFormula recalculateAll tdNode ine ", tdNode, updateAt, newAttrs)

        }
      }
      // _tdIndex++
      cellIndex++
    }


    if (node.type.name === 'tableRow' || node.type.name === 'tableRow+') {
      // console.log('initHyperFormula recalculateAll isInsideFormula new row b', { rowIndex, cellIndex })
      rowIndex++
      cellIndex = 0
      // console.log('initHyperFormula recalculateAll isInsideFormula new row', { rowIndex, cellIndex })
    }

  })
  // editor.view.dispatch(transaction)

  console.log("recalculateAll updateAt ", startPositions)

  // Replaciing text from the bottom to the top help avoid undefined range issues
  /* for (let index = startPositions.length - 1; index >= 0; index--) {
    // for (let index = 0; index < updatePostions.length; index++) {
    const start = startPositions[index];
    const end = endPositions[index];
    const computed = computedValues[index];

    editor.commands.addVariableAt("tst", computed, start).run()

  }
  // console.log("updateAt ", updatePostions)

  // _this.editor = editor
  return editor */

  // Replaciing text from the bottom to the top help avoid undefined range issues
  for (let index = startPositions.length - 1; index >= 0; index--) {
    // for (let index = 0; index < updatePostions.length; index++) {
    const start = startPositions[index];
    const end = endPositions[index];
    const computed = computedValues[index];
    transaction = transaction.replaceWith(
      start,
      end,
      // editor.state.schema.text('yes')
      editor.state.schema.text(String(computed))
    )
  }
  transaction.setMeta('preventInternalAppend', true)
  editor.view.dispatch(transaction)
  // console.log("updateAt ", updatePostions)

  // _this.editor = editor
  return editor
  // return _this
}

let _varInputComponent, _varInputComponentWrapper
let _varInputComponentProps = $state({
  __labelText: '',
  __inputValue: '',
  __placeholder: 'Enter value or =formula...',
  __buttonText: 'Apply',
  __insertVariable: true,
  __overrideNodeContent: false,
  __onFormulaSave: (formula: any, insertMode: VariableInsertMode, insertVariable?: boolean) => { },
  __documentEditorId: null,
  __contextNodeId: null
})
/**
 * Toggle visibility of the wrapper and update its position
 * @param top - top position in px
 * @param right - right position in px
 * @param show - optional, true=show, false=hide, undefined=toggle
 */
function setVarInputWrapper(
  top: number,
  left: number,
  show?: boolean
) {
  // Update position
  _varInputComponentWrapper.style.top = `${top}px`;
  _varInputComponentWrapper.style.left = `${left}px`;
  // _varInputComponentWrapper.style.right = `${right}px`;

  // Toggle visibility
  if (show === true) {
    _varInputComponentWrapper.classList.remove('hidden');
  } else if (show === false) {
    _varInputComponentWrapper.classList.add('hidden');
  } else {
    // no argument: just toggle
    _varInputComponentWrapper.classList.toggle('hidden');
  }
}


function addVarInputComponentToDom() {
  // function addVarInputComponentToDom( props) {
  _varInputComponentWrapper = document.createElement('span')
  _varInputComponentWrapper.className = 'cell-var-label'
  _varInputComponentWrapper.classList.add('hidden')
  // wrapper.textContent = varName
  Object.assign(_varInputComponentWrapper.style, {
    position: 'absolute',
    top: '2px',
    right: '4px',
    // "z-index": 2000,
    // fontSize: '10px',
    // color: '#0074D9',
    // opacity: '0.6',
    // pointerEvents: 'none',
    // backgroundColor: 'rgba(255,255,255,0.7)',
    // borderRadius: '3px',
    // padding: '0 2px',
  })

  _varInputComponent = mount(CustomExcelTableExtensionVarInput, {
    // new CustomProgrammingStyleCommentExtensionWidget({
    target: _varInputComponentWrapper,
    props: _varInputComponentProps
  })

  document.body.append(_varInputComponentWrapper)
  // document.append(_varInputComponentWrapper)
}
const defaultOptions = {
  editorId: null,
}
export const CustomExcelTableExtension = Extension.create({
 
  // export const CustomExcelTableExtension = Extension.create({
  name: extensionName,
  atom: true, // Treat the table as a single unit for cleaner selection


  addAttributes() {
    return {
      // Storing the entire grid data flat saves Tiptap from parsing deep nested trees
      tableData: {
        default: { rows: 10, cols: 5, cells: {} },
      },
      width: { default: '100%' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="custom-excel-table"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'custom-excel-table' }), 0];
  },


  addOptions() {
    return {
      ...defaultOptions,
      attributeNames: extensionAttributeNames,
      // attributeNames: extensionAttributeNames,
      types: [
        'table',
        'tableHeader',
        'tableRow',
        'tableCell'
      ],
      debounceDelay: 150,
      highlightClass: 'highlight-ref',
    }
  },

  /**
  * Auto-inject schema attributes into configured node types
  */
  addGlobalAttributes() {
    const attributes: Record<string, any> = {}

    // Dynamically add each attribute defined in options.attributeNames
    /* for (const [key, attrName] of Object.entries(this.options.attributeNames)) {
      attributes[attrName] = {
        // attributes[key] = {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute(attrName),
        renderHTML: (attrs: Record<string, string>) =>
          attrs[key] ? { [attrName]: attrs[key] } : {},
      }
    }

    // console.log("attributes --- ", attributes)
    return [
      {
        types: this.options.types,
        attributes,
      },
    ] */



    const attrDefs = {}
    for (const [key, attrName] of Object.entries(extensionAttributeNames)) {
      attrDefs[attrName] = {
        default: null,
        // parseHTML: (el) => el.getAttribute(attrName),
        // Read attribute from HTML → store into Tiptap node attrs
        parseHTML: (element) => {
          const value = element.getAttribute(attrName)
          // console.log("parseHTML dom ", { element, attrName, value })

          if (value === null) return null         // missing attribute
          if (value === "true") return true       // support booleans
          if (value === "false") return false
          if (!isNaN(Number(value))) return Number(value) // support numbers

          return value                            // fallback: string
        },
        renderHTML: (attrs) => {
          if (attrs[attrName]) {
            //  return {}
            return { [attrName]: attrs[attrName] }
          }
          return {}
        },
      }
    }

    return [
      {
        types: this.options.types,
        attributes: attrDefs,
      },
    ]
  },

  onCreate() {
    console.log("onCreate excell")
    const editor = this.editor

    addVarInputComponentToDom()
    ensureTableExcelStyles()
    _varInputComponentProps.__documentEditorId = this.options.editorId || null

    // ----------------------------
    // Initial update
    // ----------------------------
    setTimeout(() => {
      // setTimeout(() => {
      // this._updateCellVars()
      // this._computeFormulas()
      // _updateCellVars(this)
      // _computeFormulas(this)


      // _updateCellVars(this)
      // _computeFormulas(this)
      _updateCellVars(editor)
      // attachCellFocusHandlers(editor)

      // _computeFormulas(editor)

    }, 3 * 1000);
  },


  /* onUpdate({ editor, transaction }) {
    // return
    setTimeout(() => {
      let tableChanged = false

      transaction.steps.forEach((step: Step) => {
        // get the "from" and "to" positions if the step has them
        let from = (step as any).from
        let to = (step as any).to
        //  from = 10
        //  to = 100
        // console.log("from", from, to, step)
        if (typeof from === 'number' && typeof to === 'number') {
          editor.state.doc.nodesBetween(from, to, (node, pos) => {
            console.log("from node", node)
            if (node.type.name === 'table') {
              tableChanged = true
              return false // stop iterating
            }
            return true
          })
        }
      })

      if (tableChanged) {
        console.log('Table actually changed!')
        // if (this._updateCellVars && this._computeFormulas) {

        // this._updateCellVars()
        // this._computeFormulas()
        // _updateCellVars(this)
        // _computeFormulas(this)
        _updateCellVars(editor)
        // _computeFormulas(editor)

      }

    }, 0);
    // }, 3 * 10);
  }, */



  onUpdate({ editor, transaction }) {

    setTimeout(() => {
      //  _updateCellVars(editor)
    })
    return
    // Skip programmatic updates (not user typing or user actions)
    if (!transaction.docChanged || transaction.getMeta("addToHistory") === false) {
      return;
    }

    // Skip updates during composition (IME typing)
    if (transaction.getMeta("composition")) {
      return;
    }

    let tableChanged = false;
    const docSize = editor.state.doc.content.size;

    for (const step of transaction.steps) {
      const map = step.getMap();

      map.forEach((oldStart, oldEnd, newStart, newEnd) => {
        // Validate safe positions
        if (newStart < 0 || newStart > docSize) return;
        if (newEnd < 0 || newEnd > docSize) return;

        // Quick check: look for table inside the mapped range
        editor.state.doc.nodesBetween(
          newStart,
          Math.min(newEnd, docSize),
          (node) => {
            if (node.type.name === "table") {
              tableChanged = true;
              return false; // stop scanning
            }
            return true;
          },
        );
      });

      if (tableChanged) break;
    }

    if (tableChanged) {
      // Debounce to avoid running many times during fast typing
      // requestAnimationFrame(() => _updateCellVars(editor));
    }
  },



 /*  addNodeView() {
    return ({ node, editor, getPos, HTMLAttributes }) => {
      // 1. Create a lightweight container element
      const dom = document.createElement('div');
      dom.className = 'custom-excel-table-wrapper';
      dom.style.minHeight = '150px'; // Provide immediate layout tracking structure
      dom.style.contentVisibility = 'auto'; // Browser native optimization performance hint

      let observer: IntersectionObserver | null = null;
      let svelteComponent: any = null;
      let isVisible = false;

      // Cache the attributes to safely inspect changes
      let currentAttrs = { ...node.attrs };

      // 2. Define mounting and demounting lifecycle strategy
      const mountExcelComponent = () => {
        if (svelteComponent) return; // Already loaded

        // Dynamically instantiate the full reactive component on target view
        // Adjust syntax below depending on your exact Svelte 5 mounting helper
        import('./ExcelTableComponent.svelte').then((Component) => {
          if (!isVisible) return; // Guard clause if scrolled away mid-fetch
          
          // Clear layout padding/placeholders if necessary
          dom.innerHTML = ''; 
          
          svelteComponent =  mount(CustomExcelTableExtensionVarInput, {
    // new CustomProgrammingStyleCommentExtensionWidget({
    target: _varInputComponentWrapper,
    props: _varInputComponentProps
  })
          
          
          
          Component.default(dom, {
            props: {
              // Extract data using $state.raw inside component to eliminate heavy nested tracking
              initialData: currentAttrs.tableData,
              onUpdate: (updatedData: any) => {
                // Only commit transactions on explicit updates or blur events
                if (typeof getPos === 'function') {
                  editor.commands.command(({ tr }) => {
                    tr.setNodeAttribute(getPos(), 'tableData', updatedData);
                    return true;
                  });
                }
              }
            }
          });
        });
      };

      const destroyExcelComponent = () => {
        if (svelteComponent) {
          // Properly unmount or destroy Svelte 5 application node
          svelteComponent.$destroy?.(); 
          svelteComponent = null;
          
          // Restore a lightweight placeholder layout so the document page height doesn't snap
          dom.innerHTML = `
            <div class="excel-placeholder" style="height: 100%; display: flex; align-items: center; justify-content: center; background: #f9f9f9; border: 1px solid #ddd; color: #888;">
              Excel Table (Loading...)
            </div>
          `;
        }
      };

      // 3. Bind the Intersection Observer
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
          if (isVisible) {
            mountExcelComponent();
          } else {
            destroyExcelComponent();
          }
        });
      }, {
        rootMargin: '300px 0px 300px 0px' // Pre-render 300px before it touches the visible viewport
      });

      // Start observing the wrapper DOM node immediately
      observer.observe(dom);

      return {
        dom,
        // 4. Critical Node Optimization: Intercept unnecessary re-renders
        update: (updatedNode) => {
          if (updatedNode.type !== node.type) return false;

          // If the data hasn't structurally changed, skip the Tiptap layout pipeline update completely
          if (JSON.stringify(updatedNode.attrs.tableData) === JSON.stringify(currentAttrs.tableData)) {
            return true;
          }

          currentAttrs = { ...updatedNode.attrs };

          // If visible and component exists, pass props downward dynamically
          if (svelteComponent && isVisible) {
             svelteComponent.tableData = currentAttrs.tableData;
          }
          return true;
        },
        destroy() {
          observer?.disconnect();
          destroyExcelComponent();
        },
      };
    };
  }, */



  addProseMirrorPlugins() {

    const pluginKey = new PluginKey(extensionName)
    const TableSyncKey = new PluginKey(`${extensionName}-sync`)

    const editor = this.editor
    const debounceDelay = this.options?.debounceDelay ?? 150
    const state = editor.state
    // let tr = editor.state.tr


    const getDecorations = (doc: any, tr) => {
      const decorations: any[] = []
      // let tr = doc.state.tr
      doc.descendants((node: any, pos: number) => {
        // console.log("initHyperFormula descendants", node)

        if (node.type.name === 'table') {
          const sheetName = node.attrs?.[extensionAttributeNames.sheet] || `Table_${pos}`
          const deco = Decoration.widget(
            pos + 1,
            () => {
              const wrapper = document.createElement('span')
              wrapper.className = 'excel-table-launcher'
              wrapper.contentEditable = 'false'
              wrapper.style.pointerEvents = 'auto'
              wrapper.title = 'Excel View (Batch Edit)'
              wrapper.innerHTML = `
                <button type="button" class="excel-table-launcher-btn" data-action="excel">
                  <i class="ph-light ph-table"></i>
                  <span>Excel</span>
                </button>
                <button type="button" class="excel-table-launcher-btn" data-action="bulk" style="margin-left:6px;">
                  <i class="ph-light ph-sliders-horizontal"></i>
                  <span>Bulk</span>
                </button>
              `
              const btn = wrapper.querySelector('[data-action="excel"]') as HTMLButtonElement | null
              const bulkBtn = wrapper.querySelector('[data-action="bulk"]') as HTMLButtonElement | null
              const stop = (e: Event) => {
                e.preventDefault()
                e.stopPropagation()
              }
              const open = (e: Event) => {
                e.preventDefault()
                e.stopPropagation()
                openTableExcelModal(editor, pos, node)
              }
              const openBulk = (e: Event) => {
                e.preventDefault()
                e.stopPropagation()
                const rect = (bulkBtn || wrapper).getBoundingClientRect()
                // Reuse the existing Cell Inspector UI for bulk actions.
                _varInputComponentProps.__labelText = 'Bulk Cells'
                _varInputComponentProps.__buttonText = 'Apply to Table'
                _varInputComponentProps.__placeholder = 'Enter value or =formula...'
                _varInputComponentProps.__inputValue = ''
                _varInputComponentProps.__overrideNodeContent = true
                _varInputComponentProps.__insertVariable = true
                _varInputComponentProps.__documentEditorId = getEditorId(editor) || null
                _varInputComponentProps.__contextNodeId = resolveSheetNameForTable(editor, pos, node)
                _varInputComponentProps.__onFormulaSave = (formula: any, insertMode: VariableInsertMode, insertVariable?: boolean) => {
                  applyBulkToTable(editor, pos, node, formula, insertVariable, Boolean(_varInputComponentProps.__overrideNodeContent))
                }
                setVarInputWrapper(rect.bottom, rect.left, true)
              }
              wrapper.addEventListener('mousedown', stop)
              wrapper.addEventListener('click', stop)
              btn?.addEventListener('click', open)
              btn?.addEventListener('pointerdown', open)
              bulkBtn?.addEventListener('mousedown', stop)
              bulkBtn?.addEventListener('click', stop)
              bulkBtn?.addEventListener('pointerdown', openBulk)
              bulkBtn?.addEventListener('pointerup', openBulk)
              bulkBtn?.addEventListener('click', openBulk)
              return wrapper
            },
            { side: -1 }
          )
          decorations.push(deco)
        }

        if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
          let varId = node.attrs[extensionAttributeNames.var]
          const { rowZero, colZero, displayLabel } = resolveCellContext(node.attrs || {})
          const varLabel = displayLabel
          const varRawValue = node.attrs[extensionAttributeNames.raw]
          let currentVarId = varId
          // console.log("initHyperFormula varName", varName)
          // Always show label; only create vars when there is a value/formula.
          if (varLabel) {
            const onFormulaSave = (formula: any, insertMode: VariableInsertMode, insertVariable?: boolean) => {
              // console.log("onFormulaSave ", formula)
              // formula = normalizeIfFormula(formula)
              // formula = toFormula(formula)

              const { from, to, empty } = editor.state.selection;
              // if (!empty) return; // user selected a range
              const cursorPos = from;

              // if (insertVariable) {
              let activeVarId = currentVarId
              if (!activeVarId) {
                const sheetName = node.attrs[extensionAttributeNames.sheet]
                if (sheetName) ensureVariableGroup(sheetName, this.options.editorId)
                const payload = {
                  type: VariableManipulatorUtils.VAR_TYPE.text,
                  value: formula ?? '',
                  nodeId: sheetName,
                  row: rowZero,
                  col: colZero
                }
                const created = setVariable(displayLabel, payload, this.options.editorId)
                if (created) {
                  activeVarId = created
                  currentVarId = created
                }
              }

              if (activeVarId) {
                editor.commands.addOrReplaceVariableAt(
                  activeVarId,
                  formula,
                  pos,
                  cursorPos,
                  true,
                  insertMode,
                  insertVariable
                )
              }
              // }
              // editor.commands.addOrReplaceVariableAt(varName, formula, pos, cursorPos, true)
              // editor.commands.addOrReplaceVariableAt("tst", formula,state, pos).run()


              const computedValue = activeVarId
                ? getVariable(activeVarId, this.options.editorId) ?? `@${varLabel}`
                : `@${varLabel}`

              const newAttrs = {
                ...node.attrs,
                [extensionAttributeNames.raw]: formula,
                // [extensionAttributeNames.raw]: toFormula(formula),
                [extensionAttributeNames.computed]: computedValue,
                [extensionAttributeNames.var]: activeVarId ?? currentVarId,
                [extensionAttributeNames.varLabel]: node.attrs[extensionAttributeNames.varLabel] || varLabel,
              }
              console.log("onFormulaSave ", { computedValue, formula, newAttrs, node })

              // IMPORTANT: get a fresh transaction AFTER the command changed the doc
              const tr2 = editor.state.tr.setNodeMarkup(pos, undefined, newAttrs)
              editor.view.dispatch(tr2)
              // tr = tr.setNodeMarkup(pos, undefined, newAttrs)
              // editor.view.dispatch(tr)



              console.log("onFormulaSave eend ", { "s": node.attrs[extensionAttributeNames.raw], node })

              // _computeFormulas(editor)

            }
            let component
            const deco = Decoration.widget(pos + 1,

              () => {
                const wrapper = document.createElement('span')
                wrapper.className = 'cell-var-label'
                // wrapper.textContent = varName
                Object.assign(wrapper.style, {
                  position: 'absolute',
                  top: '2px',
                  right: '4px',
                  // "z-index": 2000,
                  // fontSize: '10px',
                  // color: '#0074D9',
                  // opacity: '0.6',
                  // pointerEvents: 'none',
                  // backgroundColor: 'rgba(255,255,255,0.7)',
                  // borderRadius: '3px',
                  // padding: '0 2px',
                })



                // Create the dropdown container
                /* const container = document.createElement('div');
                container.className = 'relative inline-block';
  
                // Toggle button
                const toggle = document.createElement('div');
                toggle.className = 'cursor-pointer select-none flex items-center gap-1';
                toggle.addEventListener('click', () => {
                  dropdown.classList.toggle('hidden');
                });
  
                const badge = document.createElement('vscode-badge');
                badge.textContent = 'Heere';
                toggle.appendChild(badge);
  
                const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                arrow.setAttribute('class', 'w-3 h-3 ml-1 transition-transform duration-200');
                arrow.setAttribute('fill', 'none');
                arrow.setAttribute('stroke', 'currentColor');
                arrow.setAttribute('viewBox', '0 0 24 24');
  
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('stroke-linecap', 'round');
                path.setAttribute('stroke-linejoin', 'round');
                path.setAttribute('stroke-width', '2');
                path.setAttribute('d', 'M19 9l-7 7-7-7');
                arrow.appendChild(path);
  
                toggle.appendChild(arrow);
                container.appendChild(toggle);
  
                // Dropdown content
                const dropdown = document.createElement('div');
                dropdown.className = 'fixed z-50 mt-2 p-3 bg-base-100 shadow-lg rounded-box border border-base-200 animate-fadeIn hidden';
  
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'input input-sm input-bordered w-full mb-2 text-base-content';
                input.placeholder = 'Type here...';
                dropdown.appendChild(input);
  
                const label = document.createElement('label');
                label.className = 'flex items-center gap-1 cursor-pointer';
  
                const span = document.createElement('span');
                span.textContent = 'Override cell content';
                label.appendChild(span);
  
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'toggle toggle-primary';
                label.appendChild(checkbox);
  
                dropdown.appendChild(label);
  
                const button = document.createElement('button');
                button.className = 'btn btn-sm btn-primary w-full';
                button.textContent = 'k';
                dropdown.appendChild(button);
  
                container.appendChild(dropdown);
                wrapper.appendChild(container);
  
                return wrapper; */



                // });
                // console.log("initHyperFormula varName", span)

                /* mount(CustomExcelTableExtensionVarLabel, {
                  // new CustomProgrammingStyleCommentExtensionWidget({
                  target: wrapper,
                  props: {
                    __labelText: varLabel,
                    __inputValue : varRawValue || '',
                    __onClick: () => {
                      console.log("yes on clikc========")
                      // _varInputComponentProps
                      _varInputComponentProps.__labelText = varLabel
                      _varInputComponentProps.__inputValue = varRawValue || ''
                      _varInputComponentProps.__overrideNodeContent = false
                      _varInputComponentProps.__onFormulaSave = (formula: any, insertMode: VariableInsertMode) => {
                        onFormulaSave(formula, insertMode)
                      }
                      // setVarInputWrapper(34,45)
                      // Get the wrapper's position
                      const rect = wrapper.getBoundingClientRect();
   
                      // Position the floating input right under the wrapper
                      setVarInputWrapper(rect.bottom , rect.left );
                      // setVarInputWrapper(rect.bottom + window.scrollY, rect.left + window.scrollX);
   
   
                    }
                    /* __inputValue: varRawValue || '',
                    __overrideNodeContent: false,
                    __onFormulaSave: (formula: any, insertMode: VariableInsertMode) => {
                      console.log(' Saved __onFormulaSave:', formula)
                      // updatee the ceell conteent with the 
                      onFormulaSave(formula, insertMode)
   
                    } =/
                  }
                }) */



                const editorId = this.options.editorId
                const resolveInputValue = () => {
                  if (currentVarId && editorId) {
                    const raw = getVariable(currentVarId, editorId, false)
                    return extractVariableInputValue(raw)
                  }
                  return extractVariableInputValue(varRawValue)
                }

                const varInputComponentProps = {
                  __labelText: '',
                  __inputValue: '',
                  __overrideNodeContent: false,
                  __onFormulaSave: (formula: any, insertMode: VariableInsertMode, insertVariable?: boolean) => { },
                  __documentEditorId: this.options.editorId || null,
                  __contextNodeId: node.attrs?.[extensionAttributeNames.sheet] || null
                }
                varInputComponentProps.__labelText = varLabel
                varInputComponentProps.__inputValue = resolveInputValue()
                varInputComponentProps.__overrideNodeContent = false
                varInputComponentProps.__onFormulaSave = (formula: any, insertMode: VariableInsertMode, insertVariable?: boolean) => {
                  onFormulaSave(formula, insertMode, insertVariable)
                }

                /* _varInputComponentProps.__labelText = varName
                _varInputComponentProps.__inputValue = varRawValue || ''
                _varInputComponentProps.__overrideNodeContent = false
                _varInputComponentProps.__onFormulaSave = (formula: any, insertMode: VariableInsertMode) => {
                  onFormulaSave(formula, insertMode)
                }
  */
                // Mount Svelte 5 component
                const component = mount(CustomExcelTableExtensionVarLabel, {
                  target: wrapper,
                  props: varInputComponentProps
                });

                // Subscribe to changes
                const unsubscribe = onVariableChange((changedId) => {
                  if (!changedId || changedId !== currentVarId) return;
                  const nextValue = resolveInputValue();
                  // In Svelte 5, if the component is reactive, use a proxy or:
                  // component.__inputValue = nextValue (if using $props)
                });

                /** * FIX: Store references on the DOM node so 'destroy' can access them
                 */
                (wrapper as any)._cleanup = () => {
                  unmount(component);
                  unsubscribe?.();
                };

                return wrapper;
              }, {
              // 'dom' here is the wrapper returned by the function above
              destroy(dom: Node) {
                const wrapper = dom as any;
                if (wrapper._cleanup) {
                  wrapper._cleanup();
                }
              }
            });

            decorations.push(deco);
          }
        }
      })

      return DecorationSet.create(doc, decorations)
    }

    function getTableAtSafe(doc, pos) {
      if (pos < 0 || pos > doc.content.size) return null;

      let _pos;
      try {
        _pos = doc.resolve(pos);
      } catch {
        return null;
      }

      for (let depth = _pos.depth; depth > 0; depth--) {
        const node = _pos.node(depth);
        if (node.type.name === "table") return node;
      }
      return null;
    }

    function tableStructureChanged(oldState, newState): boolean {
      let changed = false
      const newDoc = newState.doc
      const newSize = newDoc.content.size // Capture new doc size once

      oldState.doc.descendants((oldNode, oldPos) => {
        if (changed) return false
        if (oldNode.type.name !== 'table') return true
        // 1. BOUNDARY CHECK: Ensure the position exists in the new document
        // We check if oldPos + oldNode.nodeSize is within bounds to be fully safe
        if (oldPos >= newSize) {
          changed = true
          return false
        }

        // 2. RETRIEVAL: nodeAt returns null if out of range, but we check anyway
        const newNode = newState.doc.nodeAt(oldPos)
        if (!newNode || newNode.type.name !== 'table') {
          changed = true
          return false
        }

        try {
          const oldMap = TableMap.get(oldNode)
          const newMap = TableMap.get(newNode)

          if (
            oldMap.width !== newMap.width ||
            oldMap.height !== newMap.height ||
            oldMap.map.length !== newMap.map.length
          ) {
            changed = true
            return false
          }
        } catch {
          // Table invalid / replaced
          changed = true
          return false
        }

        return true
      })

      return changed
    }


    const TableSyncPlugin =
      new Plugin({
        key: TableSyncKey,

        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some(tr => tr.docChanged)) return null

          // Prevent loops
          if (transactions.some(tr => tr.getMeta('preventInternalAppend'))) {
            return null
          }

          if (!tableStructureChanged(oldState, newState)) {
            return null
          }

          // console.log("tableStructureChanged", { tableStructureChanged })

          scheduleTableUpdate(editor, debounceDelay)

          return null
        }


        /* appendTransaction(transactions, oldState, newState) {
          // 1️⃣ Ignore transactions that didn't change the doc
          const docChanged = transactions.some(tr => tr.docChanged)
          if (!docChanged) return null

          // 2️⃣ Avoid infinite loops (VERY important)
          const isInternal = transactions.some(tr =>
            tr.getMeta('preventInternalAppend')
          )
          if (isInternal) return null

          // 3️⃣ Detect TABLE STRUCTURE changes only
          let tableStructureChanged = false

          for (const tr of transactions) {
            for (const step of tr.steps) {
              const map = step.getMap()

              map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
                if (tableStructureChanged) return

                newState.doc.nodesBetween(
                  newStart,
                  Math.min(newEnd, newState.doc.content.size),
                  (node) => {
                    if (
                      node.type.name === 'table' ||
                      node.type.name === 'tableRow' ||
                      node.type.name === 'tableCell' ||
                      node.type.name === 'tableHeader'
                    ) {
                      tableStructureChanged = true
                      return false
                    }
                    return true
                  },
                )
              })
            }
          }

          if (!tableStructureChanged) return null

          console.log("tableStructureChanged", {tableStructureChanged})

          // 4️⃣ Run your logic ONCE
          requestAnimationFrame(() => {
            // _updateCellVars(editor)
            // _computeFormulas(editor)
          })

          return null
        }, */
      })


    const TableContextMenuPlugin = new Plugin({
      props: {
        handleDOMEvents: {
          contextmenu: (view, event) => {
            const target = event.target as HTMLElement | null
            if (!target) return false
            const tableEl = target.closest('table')
            if (!tableEl) return false
            event.preventDefault()
            ensureTableContextMenu()
            const pos = view.posAtDOM(target, 0)
            const found = findTableFromPos(view.state, pos)
            if (!found) return false
            showTableContextMenu(event.clientX, event.clientY, editor, found.pos, found.node, pos)
            return true
          }
        }
      }
    })

    const TableMainPlugin = new Plugin({
      key: pluginKey,


      state: {
        init(_, { doc, tr }) {
          return getDecorations(doc, tr)
        },
        apply(tr, oldDecos, oldState, newState) {


          if (!tr.docChanged) {
            return oldDecos;
          }



          // return oldDecos
          let tableChanged = false

          for (const step of tr.steps) {
            const map = step.getMap();

            map.forEach((oldStart, oldEnd, newStart, newEnd) => {
              const docSize = newState.doc.content.size;

              // ignore invalid positions
              if (newStart < 0 || newStart > docSize) return;
              if (newEnd < 0 || newEnd > docSize) return;

              const table = getTableAtSafe(newState.doc, newStart);
              if (table) tableChanged = true;
            });

          }


          // Only recalc if doc changed
          // if (tr.docChanged) {
          if (tableChanged) {
            // console.log("apply")
            console.log('Table actually changed deeco!')
            // _computeFormulas(editor)

            return getDecorations(newState.doc, newState.tr)
          }
          return oldDecos.map(tr.mapping, tr.doc)
        },
      },

      // view:()=?

      props: {
        decorations(state) {
          return this.getState(state)
        },
      },


      // 🔹 Runs after each transaction — perfect for HyperFormula sync
      //     appendTransaction(transactions, oldState, newState) {
      //       return null
      //       const docChanged = transactions.some(tr => tr.docChanged)
      //       if (!docChanged) return null
      //       const skip = transactions.some(tr => tr.getMeta('preventInternalAppend'))

      //       console.log(' appendTransaction excel:', String(skip))

      //       if (skip) return null

      //       // check if cursor is in a table


      //       // Prevent infinite loop by not dispatching recursively
      //       let tr = newState.tr

      //       const { selection } = newState
      //       const { $from } = selection

      //       // Walk up from the cursor position to see if any ancestor node is a table
      //       let insideTable = false
      //       for (let d = $from.depth; d > 0; d--) {
      //         const node = $from.node(d)
      //         if (node.type.name === 'table') {
      //           insideTable = true
      //           break
      //         }
      //       }

      //       if (!insideTable) return null

      //       console.log('✅ Cursor is inside a table, running table-specific logic')


      //       // const tr = newState.tr
      //       _computeFormulas(editor)

      //       return

      //       // Example: update computed formula results
      //       newState.doc.descendants((node, pos) => {
      //         // if (node.type.name === 'tableCell') {
      //         if ((node.type.name === 'tableCell' || node.type.name === 'tableCell+') ||
      //           (node.type.name === 'tableHeader' || node.type.name === 'tableHeader+')) {


      //           // _computeFormulas(editor)

      //           return
      //           // const { schema, tr, selection } = editor.state
      //           // 🧠 Save current cursor position before modification
      //           const prevSelection = editor.state.selection

      //           // 1️⃣ Save the current selection anchor (cursor) before the replacement
      //           const oldSelection = editor.state.selection
      //           const oldPos = oldSelection.from

      //           // tdElement.title = `${rawValue} = ${computed}`
      //           // tdElement.style.backgroundColor = '#f0faff'
      //           // tdElement.innerText = 'yes'
      //           // tdElement.innerText = String(computed)
      //           const computedValue = node.attrs[extensionAttributeNames.computed] ||
      //             node.textContent.trim() || ''
      //           // const computedValue = node.attrs[extensionAttributeNames.computed] ?? node.textContent ?? "."
      //           console.log("initHyperFormula tdElement",)
      //           // if (computedValue) {

      //           // }


      //           // 1️⃣ Build the replacement content
      //           let replacement
      //           if (computedValue === "") {
      //             // Empty cell → empty paragraph
      //             const paragraphNode = editor.schema.nodes.paragraph.create()
      //             replacement = Fragment.from(paragraphNode)
      //           } else {
      //             // Non-empty → paragraph with text
      //             const paragraphNode = editor.schema.nodes.paragraph.create({}, editor.schema.text(computedValue))
      //             replacement = Fragment.from(paragraphNode)
      //           }

      //           // 2️⃣ Create a slice for the replacement
      //           const slice = new Slice(replacement, 0, 0)

      //           // 3️⃣ Replace the inner content of the cell (pos+1 .. pos+node.nodeSize-1)
      //           tr.replaceRange(pos + 1, pos + node.nodeSize - 1, slice)


      //           const newText = editor.state.schema.text(computedValue)
      //           console.log("initHyperFormula tdElement ok ", newText, node)

      //           // Ensure we always have a paragraph inside the cell
      //           /* const paragraphNode = editor.state.schema.nodes.paragraph.create(
      //             {},
      //             newText ? editor.state.schema.text('d') : Fragment.empty
      //           ) */

      //           // Replace the **inner content** of the cell (pos + 1 .. pos + node.nodeSize - 1)
      //           // tr.replaceWith(pos + 1, pos + node.nodeSize - 1, Fragment.from(paragraphNode))
      //           // Build a proper ProseMirror node for replacement
      //           /* let newNode
      //           if (computedValue === "") {
      //             // Empty cell → create empty paragraph
      //             newNode = editor.state.schema.nodes.paragraph.create()
      //           } else {
      //             // Non-empty → paragraph with text
      //             newNode = editor.state.schema.nodes.paragraph.create({}, editor.state.schema.text(computedValue))
      //           }

      //           // Replace cell content
      //           tr.replaceWith(pos + 1, pos + node.nodeSize - 1, newNode.content)
      // */
      //           // tr.replaceWith(pos + 1, pos + node.nodeSize - 1, newText)

      //           //  tr = newState.tr
      //           const resolvedPos = tr.doc.resolve(pos + 1)
      //           // tr.setSelection(TextSelection.near(resolvedPos))
      //           // Compute range of the text inside the cell’s content
      //           const cellStart = pos + 1
      //           const cellEnd = pos + node.nodeSize - 1


      //           // tr.replaceWith(pos + 1, pos + node.nodeSize - 1, newText)

      //           // Replace only the text content
      //           // tr.insertText('oo', cellStart, cellEnd)
      //           // editor.commands.focus()


      //           // 2️⃣ Perform the replacement
      //           // tr.replaceWith(pos + 1, pos + node.nodeSize - 1, state.schema.text(newText))

      //           // 3️⃣ Map the old cursor position through the transformation
      //           // const mappedPos = tr.mapping.map(oldPos)

      //           // 4️⃣ Restore the selection
      //           // tr.setSelection(TextSelection.near(tr.doc.resolve(mappedPos)))

      //           // 🧩 Restore the previous cursor position (if still valid)
      //           const mappedSelection = TextSelection.create(
      //             tr.doc,
      //             //  Math.min(prevSelection.to, tr.doc.content.size - 1)
      //             // prevSelection.from
      //             Math.min(prevSelection.from, tr.doc.content.size - 1),
      //             Math.min(prevSelection.to, tr.doc.content.size - 1)
      //           )
      //           tr.setSelection(mappedSelection)

      //           // Safely compute the new position inside the updated cell
      //           /* const cellEndResolved = tr.doc.resolve(pos + node.nodeSize - 1)

      //           // If there's text, place cursor at the end of it; otherwise, inside the cell
      //           const newPos =
      //             computedValue.length > 0
      //               ? cellEndResolved.pos - 1 // end of text
      //               : pos + 1 // start of cell (empty)

      //           // Create a text selection at that position
      //           const selection = TextSelection.create(tr.doc, newPos)

      //           tr.setSelection(selection) */

      //           // Apply the transaction
      //           // editor.view.dispatch(tr)

      //           /* const varName = node.attrs['data-var']
      //           const formula = node.textContent.trim()
      //           if (formula.startsWith('=')) {
      //             const computed = extension.hyper.evaluateFormula(varName, formula)
      //             if (computed !== undefined && computed !== formula) {
      //               const newText = extension.editor.state.schema.text(String(computed))
      //               tr.replaceWith(pos + 1, pos + node.nodeSize - 1, newText)
      //             }
      //           } */
      //         }
      //       })

      //       // If no content actually changed, skip
      //       return tr.docChanged ? tr : null
      //     },


    })
    // ]

    return [
      TableMainPlugin,
      TableSyncPlugin,
      TableContextMenuPlugin
    ]
  },


  addCommands() {
    return {
      updateCellVars: () => () => {
        _updateCellVars(this.editor)
        // _updateCellVars(this)
        // this._updateCellVars()
        return true
      },
      computeFormulas: () => () => {
        // _computeFormulas(this.editor)
        // _computeFormulas(this)
        // this._computeFormulas()
        return true
      },
    }
  },
})
