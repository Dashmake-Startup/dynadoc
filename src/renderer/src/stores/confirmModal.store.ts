import { writable } from 'svelte/store'

export interface ConfirmModalOptions {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
  extraActionText?: string
  extraActionDestructive?: boolean
  onExtraAction?: (() => void | Promise<void>) | null
}

export interface ConfirmModalState extends ConfirmModalOptions {
  open: boolean
}

const INITIAL_STATE: ConfirmModalState = {
  open: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  destructive: false,
  extraActionText: '',
  extraActionDestructive: false,
  onExtraAction: null
}

type ConfirmResolver = (value: boolean) => void

export const _$_confirmModal = (() => {
  const store = writable<ConfirmModalState>(INITIAL_STATE)
  let resolver: ConfirmResolver | null = null
  let extraActionHandler: (() => void | Promise<void>) | null = null

  function settle(value: boolean) {
    if (resolver) resolver(value)
    resolver = null
    store.set(INITIAL_STATE)
    extraActionHandler = null
  }

  function open(options: ConfirmModalOptions = {}): Promise<boolean> {
    if (resolver) {
      resolver(false)
      resolver = null
    }

    extraActionHandler = options.onExtraAction ?? null
    store.set({
      ...INITIAL_STATE,
      ...options,
      onExtraAction: null,
      open: true
    })

    return new Promise<boolean>((resolve) => {
      resolver = resolve
    })
  }

  function confirm() {
    settle(true)
  }

  function cancel() {
    settle(false)
  }

  async function runExtraAction() {
    if (!extraActionHandler) {
      settle(false)
      return
    }
    try {
      await extraActionHandler()
    } finally {
      settle(false)
    }
  }

  return {
    subscribe: store.subscribe,
    open,
    confirm,
    cancel,
    runExtraAction,
    setExternalState: (state: ConfirmModalState) => store.set(state)
  }
})()

export function openConfirmModal(options: ConfirmModalOptions = {}) {
  return _$_confirmModal.open(options)
}
