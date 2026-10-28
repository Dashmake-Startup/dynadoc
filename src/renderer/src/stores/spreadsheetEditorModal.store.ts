import { writable } from 'svelte/store'

export interface SpreadsheetEditorModalOptions {
  src?: string
  sheetName?: string
  maxWidth?: number
  maxHeight?: number
}

export interface SpreadsheetEditorModalState extends SpreadsheetEditorModalOptions {
  open: boolean
}

const INITIAL_STATE: SpreadsheetEditorModalState = {
  open: false,
  src: '',
  sheetName: ''
}

type Resolver = (value: boolean) => void
let resolver: Resolver | null = null

const store = writable<SpreadsheetEditorModalState>(INITIAL_STATE)

function settle(value: boolean) {
  if (resolver) {
    resolver(value)
    resolver = null
  }
  store.set({ ...INITIAL_STATE })
}

export const _$_spreadsheetEditorModal = {
  subscribe: store.subscribe,
  open(options: SpreadsheetEditorModalOptions = {}) {
    return new Promise<boolean>((resolve) => {
      resolver = resolve
      store.set({
        open: true,
        src: options.src || '',
        sheetName: options.sheetName || '',
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight
      })
    })
  },
  confirm() {
    settle(true)
  },
  cancel() {
    settle(false)
  }
}

export function openSpreadsheetEditorModal(options: SpreadsheetEditorModalOptions = {}) {
  return _$_spreadsheetEditorModal.open(options)
}

