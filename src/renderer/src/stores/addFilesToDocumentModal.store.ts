import { writable } from 'svelte/store'

export interface AddFilesToDocumentModalOptions {
  src?: string
  sheetName?: string
  maxWidth?: number
  maxHeight?: number
  documentRootPath?: string
  /** Optional parent path to use when opening newly created files */
  documentParentPath?: string
}

export interface AddFilesToDocumentModalResult {
  confirmed: boolean
  /** Absolute file paths the user selected or created in the modal */
  selectedPaths: string[]
}

export interface AddFilesToDocumentModalState extends AddFilesToDocumentModalOptions {
  open: boolean
}

const INITIAL_STATE: AddFilesToDocumentModalState = {
  open: false,
  src: '',
  sheetName: '',
  documentRootPath: '',
  documentParentPath: ''
}

type Resolver = (value: AddFilesToDocumentModalResult) => void
let resolver: Resolver | null = null

const store = writable<AddFilesToDocumentModalState>(INITIAL_STATE)

function settle(result: AddFilesToDocumentModalResult) {
  if (resolver) {
    resolver(result)
    resolver = null
  }
  store.set({ ...INITIAL_STATE })
}

export const _$_addFilesToDocumentModal = {
  subscribe: store.subscribe,
  open(options: AddFilesToDocumentModalOptions = {}) {
    return new Promise<AddFilesToDocumentModalResult>((resolve) => {
      resolver = resolve
      store.set({
        open: true,
        src: options.src || '',
        sheetName: options.sheetName || '',
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight,
        documentRootPath: options.documentRootPath || '',
        documentParentPath: options.documentParentPath || ''
      })
    })
  },
  confirm(selectedPaths: string[] = []) {
    settle({ confirmed: true, selectedPaths })
  },
  cancel() {
    settle({ confirmed: false, selectedPaths: [] })
  }
}

export function openAddFilesToDocumentModal(options: AddFilesToDocumentModalOptions = {}) {
  return _$_addFilesToDocumentModal.open(options)
}
