import Utils from "../utils/Utils"
import { writable } from 'svelte/store'

export type ExportPreset = 'web' | 'print' | 'high'
export type ExportTarget = Utils.FILE_TYPES.pdf | 'print' | 'picture'

export interface ExportOptionsPayload {
  target: ExportTarget
  preset: ExportPreset
  selectionOnly?: boolean
  pageRanges?: string
  watermarkEnabled?: boolean
  watermarkText?: string
  pictureFormat?: 'png' | 'jpeg'
}

export interface ExportOptionsContext {
  target: ExportTarget
  title?: string
  selectionAvailable?: boolean
  isSecured?: boolean
  documentName?: string
  defaultPreset?: ExportPreset
}

export interface ExportOptionsModalState extends ExportOptionsContext {
  open: boolean
}

const INITIAL_STATE: ExportOptionsModalState = {
  open: false,
  // open: true,
  target: Utils.FILE_TYPES.pdf,
  title: '',
  selectionAvailable: false,
  isSecured: false,
  documentName: '',
  defaultPreset: 'print'
}

type ExportOptionsResolver = (value: ExportOptionsPayload | null) => void

export const _$_exportOptionsModal = (() => {
  const store = writable<ExportOptionsModalState>(INITIAL_STATE)
  let resolver: ExportOptionsResolver | null = null

  function settle(value: ExportOptionsPayload | null) {
    if (resolver) resolver(value)
    resolver = null
    store.set(INITIAL_STATE)
  }

  function open(options: ExportOptionsContext): Promise<ExportOptionsPayload | null> {
    if (resolver) {
      resolver(null)
      resolver = null
    }

    store.set({
      ...INITIAL_STATE,
      ...options,
      open: true
    })

    return new Promise<ExportOptionsPayload | null>((resolve) => {
      resolver = resolve
    })
  }

  function confirm(payload: ExportOptionsPayload) {
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
    setExternalState: (state: ExportOptionsModalState) => store.set(state)
  }
})()

export function openExportOptionsModal(options: ExportOptionsContext) {
  return _$_exportOptionsModal.open(options)
}
