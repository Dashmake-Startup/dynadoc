import { writable, get } from 'svelte/store'

export type SheetBridgeMethods = {
  undo?: () => void
  redo?: () => void
  getSelection?: () => any[]
  getSelectionCoordinates?: () => string[]
  getFlattenRange?: (range: any) => { r: number; c: number }[]
  getCellsByRange?: (range: any, options?: any) => any[][]
  getCellValue?: (row: number, column: number, options?: any) => any
  setCellValue?: (row: number, column: number, value: any, options?: any) => void
  clearCell?: (row: number, column: number, options?: any) => void
  setCellFormat?: (row: number, column: number, attr: string, value: any, options?: any) => void
  setCellFormatByRange?: (attr: string, value: any, range: any, options?: any) => void
  setCellValuesByRange?: (data: any[][], range: any, options?: any) => void
  setSelection?: (range: any, options?: any) => void
  mergeCells?: (ranges: any[], type?: string, options?: any) => void
  cancelMerge?: (ranges: any[], options?: any) => void
  freeze?: (type: 'row' | 'column' | 'both', range: { row: number; column: number }, options?: any) => void
  setRowHeight?: (rowInfo: Record<string, number>, options?: any) => void
  setColumnWidth?: (columnInfo: Record<string, number>, options?: any) => void
  getRowHeight?: (rows: number[], options?: any) => Record<number, number>
  getColumnWidth?: (columns: number[], options?: any) => Record<number, number>
  hideRowOrColumn?: (rowOrColInfo: string[], type: 'row' | 'column') => void
  showRowOrColumn?: (rowOrColInfo: string[], type: 'row' | 'column') => void
  insertRowOrColumn?: (
    type: 'row' | 'column',
    index: number,
    count: number,
    direction?: 'lefttop' | 'rightbottom',
    options?: any
  ) => void
  deleteRowOrColumn?: (
    type: 'row' | 'column',
    start: number,
    end: number,
    options?: any
  ) => void
  autoFillCell?: (
    copyRange: { row: number[]; column: number[] },
    applyRange: { row: number[]; column: number[] },
    direction: 'up' | 'down' | 'left' | 'right'
  ) => void
  getAllSheets?: () => any[]
  getSheet?: (options?: any) => any
  updateSheet?: (data: any[]) => void
  addSheet?: (sheetId?: string) => void
  deleteSheet?: (options?: any) => void
  setSheetName?: (name: string, options?: any) => void
  calculateFormula?: (id?: string, range?: any) => void
  scroll?: (options: { scrollLeft?: number; scrollTop?: number; targetRow?: number; targetColumn?: number }) => void
}

export type SheetBridgeEntry = {
  rootPath: string
  methods: SheetBridgeMethods
}

const registry = writable<Record<string, SheetBridgeEntry>>({})
export const activeSheet = writable<SheetBridgeEntry | null>(null)

function setActive(rootPath: string | null) {
  if (!rootPath) {
    activeSheet.set(null)
    return
  }
  const map = get(registry)
  const entry = map[rootPath]
  if (entry) {
    activeSheet.set(entry)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('dynadoc-sheet-ready', (event: Event) => {
    const detail = (event as CustomEvent).detail as SheetBridgeEntry | undefined
    if (!detail?.rootPath || !detail.methods) return
    registry.update((map) => ({
      ...map,
      [detail.rootPath]: detail
    }))
    setActive(detail.rootPath)
  })

  window.addEventListener('dynadoc-sheet-focus', (event: Event) => {
    const detail = (event as CustomEvent).detail as { rootPath?: string } | undefined
    if (!detail?.rootPath) return
    setActive(detail.rootPath)
  })

  window.addEventListener('dynadoc-sheet-destroy', (event: Event) => {
    const detail = (event as CustomEvent).detail as { rootPath?: string } | undefined
    if (!detail?.rootPath) return
    registry.update((map) => {
      const next = { ...map }
      delete next[detail.rootPath]
      return next
    })
    const active = get(activeSheet)
    if (active?.rootPath === detail.rootPath) {
      activeSheet.set(null)
    }
  })
}

export const sheetRegistry = {
  subscribe: registry.subscribe,
  getSnapshot: () => get(registry)
}

export const sheetBridge = {
  getActive() {
    return get(activeSheet)
  }
}
