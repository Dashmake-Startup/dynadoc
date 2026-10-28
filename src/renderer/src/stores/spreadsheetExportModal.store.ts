import Utils from "../utils/Utils"
import { writable } from 'svelte/store'

export type SpreadsheetExportScope = 'current' | 'all' | 'selected'
export type SpreadsheetExportFileType = Utils.OFFICE_EXTENSIONS_FORMAT.excel | 'csv'

export interface SpreadsheetExportModalOptions {
  documentName?: string
  sheets?: { id: string; name: string }[]
  defaultScope?: SpreadsheetExportScope
  defaultFileType?: SpreadsheetExportFileType
}

export interface SpreadsheetExportModalResult {
  scope: SpreadsheetExportScope
  fileType: SpreadsheetExportFileType
  selectedSheetIds: string[]
  openAfterExport?: boolean
  revealAfterExport?: boolean
}

export interface SpreadsheetExportModalState extends SpreadsheetExportModalOptions {
  open: boolean
}

const INITIAL_STATE: SpreadsheetExportModalState = {
  open: false,
  documentName: '',
  sheets: [],
  defaultScope: 'current',
  defaultFileType: Utils.OFFICE_EXTENSIONS_FORMAT.excel
}

type ExportResolver = (value: SpreadsheetExportModalResult | null) => void

export const _$_spreadsheetExportModal = (() => {
  const store = writable<SpreadsheetExportModalState>(INITIAL_STATE)
  let resolver: ExportResolver | null = null

  function settle(value: SpreadsheetExportModalResult | null) {
    resolver?.(value)
    resolver = null
    store.set(INITIAL_STATE)
  }

  function open(options: SpreadsheetExportModalOptions = {}): Promise<SpreadsheetExportModalResult | null> {
    if (resolver) {
      resolver(null)
      resolver = null
    }

    store.set({
      ...INITIAL_STATE,
      ...options,
      open: true
    })

    return new Promise((resolve) => {
      resolver = resolve
    })
  }

  function confirm(payload: SpreadsheetExportModalResult) {
    settle(payload)
  }

  function cancel() {
    settle(null)
  }

  return {
    subscribe: store.subscribe,
    open,
    confirm,
    cancel,
    setExternalState: (state: SpreadsheetExportModalState) => store.set(state)
  }
})()

export function openSpreadsheetExportModal(options: SpreadsheetExportModalOptions = {}) {
  return _$_spreadsheetExportModal.open(options)
}
