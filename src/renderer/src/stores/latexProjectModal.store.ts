import { writable } from 'svelte/store'

export type LatexProjectModalOptions = {
  projectId: string
  projectDir: string
  mainFilePath: string
  title?: string
}

export type LatexProjectModalState = LatexProjectModalOptions & {
  open: boolean
  locked: boolean
}

const INITIAL_STATE: LatexProjectModalState = {
  projectId: '',
  projectDir: '',
  mainFilePath: '',
  title: '',
  open: false,
  // open: true,
  locked: false
}

export const _$_latexProjectModal = (() => {
  const store = writable<LatexProjectModalState>(INITIAL_STATE)

  function open(options: LatexProjectModalOptions) {
    store.update((state) => ({
      ...state,
      ...options,
      open: true,
      locked: true
    }))
  }

  function close() {
    store.update((state) => ({ ...state, open: false, locked: false }))
  }

  return {
    subscribe: store.subscribe,
    open,
    close,
    setExternalState: (state: LatexProjectModalState) => store.set(state)
  }
})()

export function openLatexProjectModal(options: LatexProjectModalOptions) {
    console.log('[LatexProjectModal] openLatexProjectModal')

  _$_latexProjectModal.open(options)
}
