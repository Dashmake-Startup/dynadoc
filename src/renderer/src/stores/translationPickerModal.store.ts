import { writable } from 'svelte/store'

export type TranslationPickerSelection = { name: string; code: string } | null

export interface TranslationPickerModalState {
  open: boolean
  title?: string
  message?: string
}

const INITIAL_STATE: TranslationPickerModalState = {
  open: false,
  title: '',
  message: ''
}

type ModalResolver = (value: TranslationPickerSelection) => void

export const _$_translationPickerModal = (() => {
  const store = writable<TranslationPickerModalState>(INITIAL_STATE)
  let resolver: ModalResolver | null = null

  function settle(value: TranslationPickerSelection) {
    if (resolver) resolver(value)
    resolver = null
    store.set(INITIAL_STATE)
  }

  function open(options: Omit<TranslationPickerModalState, 'open'> = {}) {
    if (resolver) {
      resolver(null)
      resolver = null
    }
    store.set({ ...INITIAL_STATE, ...options, open: true })
    return new Promise<TranslationPickerSelection>((resolve) => {
      resolver = resolve
    })
  }

  function confirm(selection: TranslationPickerSelection) {
    settle(selection)
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

export function openTranslationPickerModal(options: Omit<TranslationPickerModalState, 'open'> = {}) {
  return _$_translationPickerModal.open(options)
}
