import { writable } from 'svelte/store'

export interface StepUpModalState {
  open: boolean
}

const INITIAL_STATE: StepUpModalState = {
  open: false
}

// Resolves with the fresh step-up token, or null when the user cancels.
type StepUpResolver = (token: string | null) => void

export const _$_stepUpModal = (() => {
  const store = writable<StepUpModalState>(INITIAL_STATE)
  let resolver: StepUpResolver | null = null

  function settle(token: string | null) {
    if (resolver) resolver(token)
    resolver = null
    store.set(INITIAL_STATE)
  }

  function open(): Promise<string | null> {
    if (resolver) {
      resolver(null)
      resolver = null
    }
    store.set({ open: true })
    return new Promise<string | null>((resolve) => {
      resolver = resolve
    })
  }

  return {
    subscribe: store.subscribe,
    open,
    complete: (token: string) => settle(token),
    cancel: () => settle(null)
  }
})()

export function openStepUpModal(): Promise<string | null> {
  return _$_stepUpModal.open()
}
