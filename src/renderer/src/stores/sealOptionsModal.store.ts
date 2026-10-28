import { writable } from 'svelte/store'

export interface SealOptions {
  require2fa: boolean
}

export interface SealOptionsModalState {
  open: boolean
  fileName?: string
}

const INITIAL_STATE: SealOptionsModalState = {
  open: false,
  fileName: ''
}

// Resolves with the chosen options, or null when the user cancels sealing.
type SealOptionsResolver = (options: SealOptions | null) => void

export const _$_sealOptionsModal = (() => {
  const store = writable<SealOptionsModalState>(INITIAL_STATE)
  let resolver: SealOptionsResolver | null = null

  function settle(options: SealOptions | null) {
    if (resolver) resolver(options)
    resolver = null
    store.set(INITIAL_STATE)
  }

  function open(fileName = ''): Promise<SealOptions | null> {
    if (resolver) {
      resolver(null)
      resolver = null
    }
    store.set({ open: true, fileName })
    return new Promise<SealOptions | null>((resolve) => {
      resolver = resolve
    })
  }

  return {
    subscribe: store.subscribe,
    open,
    confirm: (options: SealOptions) => settle(options),
    cancel: () => settle(null)
  }
})()

export function openSealOptionsModal(fileName = ''): Promise<SealOptions | null> {
  return _$_sealOptionsModal.open(fileName)
}
