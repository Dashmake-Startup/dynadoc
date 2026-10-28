import { writable } from 'svelte/store'

export type IncludeFromDocumentMode = 'include' | 'append'

export interface IncludeFromDocumentModalOptions {
  initialPath?: string
  initialMode?: IncludeFromDocumentMode
}

export interface IncludeFromDocumentModalResult {
  path: string
  mode: IncludeFromDocumentMode
}

export interface IncludeFromDocumentModalState extends IncludeFromDocumentModalOptions {
  open: boolean
}

const INITIAL_STATE: IncludeFromDocumentModalState = {
  open: false,
  initialPath: '',
  initialMode: 'include'
}

type IncludeResolver = (value: IncludeFromDocumentModalResult | null) => void

export const _$_includeFromDocumentModal = (() => {
  const store = writable<IncludeFromDocumentModalState>(INITIAL_STATE)
  let resolver: IncludeResolver | null = null

  function settle(value: IncludeFromDocumentModalResult | null) {
    if (resolver) resolver(value)
    resolver = null
    store.set(INITIAL_STATE)
  }

  function open(options: IncludeFromDocumentModalOptions = {}): Promise<IncludeFromDocumentModalResult | null> {
    if (resolver) {
      resolver(null)
      resolver = null
    }

    store.set({
      ...INITIAL_STATE,
      ...options,
      open: true
    })

    return new Promise<IncludeFromDocumentModalResult | null>((resolve) => {
      resolver = resolve
    })
  }

  function confirm(payload: IncludeFromDocumentModalResult) {
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
    setExternalState: (state: IncludeFromDocumentModalState) => store.set(state)
  }
})()

export function openIncludeFromDocumentModal(options: IncludeFromDocumentModalOptions = {}) {
  return _$_includeFromDocumentModal.open(options)
}
