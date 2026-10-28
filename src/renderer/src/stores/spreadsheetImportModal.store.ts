import { writable } from 'svelte/store'

export type SpreadsheetImportMode = 'replaceAll' | 'replaceCurrent' | 'append'

export interface SpreadsheetImportModalOptions {
  fileName?: string
}

export interface SpreadsheetImportModalResult {
  mode: SpreadsheetImportMode
}

export interface SpreadsheetImportModalState extends SpreadsheetImportModalOptions {
  open: boolean
}

const INITIAL_STATE: SpreadsheetImportModalState = {
  open: false,
  fileName: ''
}

type ImportResolver = (value: SpreadsheetImportModalResult | null) => void

export const _$_spreadsheetImportModal = (() => {
  const store = writable<SpreadsheetImportModalState>(INITIAL_STATE)
  let resolver: ImportResolver | null = null

  function settle(value: SpreadsheetImportModalResult | null) {
    resolver?.(value)
    resolver = null
    store.set(INITIAL_STATE)
  }

  function open(options: SpreadsheetImportModalOptions = {}): Promise<SpreadsheetImportModalResult | null> {
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

  function confirm(payload: SpreadsheetImportModalResult) {
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
    setExternalState: (state: SpreadsheetImportModalState) => store.set(state)
  }
})()

export function openSpreadsheetImportModal(options: SpreadsheetImportModalOptions = {}) {
  return _$_spreadsheetImportModal.open(options)
}
