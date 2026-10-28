import { writable } from 'svelte/store'

export interface TextInputModalOptions {
  title?: string
  message?: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  multiline?: boolean
  rows?: number
}

export interface TextInputModalState extends TextInputModalOptions {
  open: boolean
}

const INITIAL_STATE: TextInputModalState = {
  open: false,
  title: '',
  message: '',
  placeholder: '',
  defaultValue: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  multiline: false,
  rows: 4
}

type ModalResolver = (value: string | null) => void

export const _$_textInputModal = (() => {
  const store = writable<TextInputModalState>(INITIAL_STATE)
  let resolver: ModalResolver | null = null

  function settle(value: string | null) {
    if (resolver) resolver(value)
    resolver = null
    store.set(INITIAL_STATE)
  }

  function open(options: TextInputModalOptions = {}): Promise<string | null> {
    if (resolver) {
      resolver(null)
      resolver = null
    }

    store.set({
      ...INITIAL_STATE,
      ...options,
      open: true
    })

    return new Promise<string | null>((resolve) => {
      resolver = resolve
    })
  }

  function confirm(value: string) {
    settle(value)
  }

  function cancel() {
    settle(null)
  }

  return {
    subscribe: store.subscribe,
    open,
    confirm,
    cancel,
    setExternalState: (state: TextInputModalState) => store.set(state)
  }
})()

export function openTextInputModal(options: TextInputModalOptions = {}) {
  return _$_textInputModal.open(options)
}
