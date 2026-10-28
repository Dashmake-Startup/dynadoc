import { writable } from 'svelte/store'

export interface AlertModalOptions {
  title?: string
  message?: string
  confirmText?: string
}

export interface AlertModalState extends AlertModalOptions {
  open: boolean
}

const INITIAL_STATE: AlertModalState = {
  open: false,
  title: '',
  message: '',
  confirmText: 'OK'
}

type AlertResolver = () => void

export const _$_alertModal = (() => {
  const store = writable<AlertModalState>(INITIAL_STATE)
  let resolver: AlertResolver | null = null

  function settle() {
    if (resolver) resolver()
    resolver = null
    store.set(INITIAL_STATE)
  }

  function open(options: AlertModalOptions = {}): Promise<void> {
    if (resolver) {
      resolver()
      resolver = null
    }

    store.set({
      ...INITIAL_STATE,
      ...options,
      open: true
    })

    return new Promise<void>((resolve) => {
      resolver = resolve
    })
  }

  function close() {
    settle()
  }

  return {
    subscribe: store.subscribe,
    open,
    close,
    setExternalState: (state: AlertModalState) => store.set(state)
  }
})()

export function openAlertModal(options: AlertModalOptions = {}) {
  return _$_alertModal.open(options)
}
