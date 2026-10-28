import { writable } from 'svelte/store'

export type SessionRecoveryState = {
  open: boolean
  force: boolean
  token: number
}

const INITIAL_STATE: SessionRecoveryState = {
  open: false,
  force: false,
  token: 0
}

const store = writable<SessionRecoveryState>(INITIAL_STATE)

export const _$_sessionRecovery = {
  subscribe: store.subscribe,
  open: (force = false) =>
    store.update((state) => ({ open: true, force, token: state.token + 1 })),
  close: () => store.set(INITIAL_STATE)
}
