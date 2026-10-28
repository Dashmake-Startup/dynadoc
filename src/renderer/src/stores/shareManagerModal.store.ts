import { writable } from 'svelte/store'

export type ShareManagerModalState = {
  open: boolean
  accountOrg?: string
}

const INITIAL_STATE: ShareManagerModalState = {
  open: false,
  accountOrg: undefined
}

type ModalResolver = (value: boolean) => void

export const _$_shareManagerModal = (() => {
  const store = writable<ShareManagerModalState>(INITIAL_STATE)
  let resolver: ModalResolver | null = null

  function settle(value: boolean) {
    if (resolver) resolver(value)
    resolver = null
    store.set(INITIAL_STATE)
  }

  function open(payload?: { accountOrg?: string }): Promise<boolean> {
    if (resolver) {
      resolver(false)
      resolver = null
    }
    store.set({ open: true, accountOrg: payload?.accountOrg })
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

  return {
    subscribe: store.subscribe,
    open,
    confirm,
    cancel,
    setExternalState: (state: ShareManagerModalState) => store.set(state)
  }
})()

export function openShareManagerModal(payload?: { accountOrg?: string }) {
  return _$_shareManagerModal.open(payload)
}
