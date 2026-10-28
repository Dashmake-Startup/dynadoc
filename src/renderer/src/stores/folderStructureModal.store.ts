import { writable } from 'svelte/store'

export type FolderStructureModalOptions = {
  path: string
  name?: string
  accountOrg?: string
  shareId?: string
  docUuid?: string
}

type FolderStructureModalState = FolderStructureModalOptions & {
  open: boolean
}

const INITIAL_STATE: FolderStructureModalState = {
  open: false,
  path: '',
  name: ''
}

export const _$_folderStructureModal = (() => {
  const store = writable<FolderStructureModalState>(INITIAL_STATE)

  function open(options: FolderStructureModalOptions) {
    store.set({ ...INITIAL_STATE, ...options, open: true })
  }

  function close() {
    store.set(INITIAL_STATE)
  }

  return {
    subscribe: store.subscribe,
    open,
    close
  }
})()

export function openFolderStructureModal(options: FolderStructureModalOptions) {
  return _$_folderStructureModal.open(options)
}
