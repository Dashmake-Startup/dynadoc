import { writable } from 'svelte/store'

export type ExportUpdateAction = 'overwrite' | 'new' | 'skip'

export interface ExportUpdateModalPayload {
  count: number
  samplePath?: string
  rememberDefault?: boolean
}

export interface ExportUpdateModalState extends ExportUpdateModalPayload {
  open: boolean
}

const INITIAL_STATE: ExportUpdateModalState = {
  open: false,
  count: 0,
  samplePath: '',
  rememberDefault: false
}

type ExportUpdateResolver = (value: { action: ExportUpdateAction; remember: boolean } | null) => void

export const _$_exportUpdateModal = (() => {
  const store = writable<ExportUpdateModalState>(INITIAL_STATE)
  let resolver: ExportUpdateResolver | null = null

  function settle(value: { action: ExportUpdateAction; remember: boolean } | null) {
    if (resolver) resolver(value)
    resolver = null
    store.set(INITIAL_STATE)
  }

  function open(options: ExportUpdateModalPayload): Promise<{ action: ExportUpdateAction; remember: boolean } | null> {
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

  function confirm(action: ExportUpdateAction, remember = false) {
    settle({ action, remember })
  }

  function cancel() {
    settle(null)
  }

  return {
    subscribe: store.subscribe,
    open,
    confirm,
    cancel
  }
})()

export function openExportUpdateModal(options: ExportUpdateModalPayload) {
  return _$_exportUpdateModal.open(options)
}
