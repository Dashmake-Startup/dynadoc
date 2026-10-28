import { writable } from 'svelte/store'

export type SharePermission = {
  subjectType: 'user' | 'email' | 'org' | 'team'
  subjectId: string
  role: 'viewer' | 'commenter' | 'editor' | 'owner'
  email?: string
}

export type ShareModalOptions = {
  path: string
  accountOrg?: string
  name?: string
  source?: 'drive' | 'disk'
  targetType?: 'document' | 'file' | 'folder'
  docUuid?: string
  initialPermissions?: SharePermission[]
  initialPublic?: boolean
  initialPublicRole?: 'viewer' | 'commenter' | 'editor'
  initialExpiresAt?: string
  initialLink?: string
  initialShareId?: string
  initialMetadata?: Record<string, any>
}

export type ShareModalResult = {
  link: string
  shareId: string
}

type ShareModalState = ShareModalOptions & {
  open: boolean
}

const INITIAL_STATE: ShareModalState = {
  open: false,
  path: '',
  name: '',
  source: 'drive',
  targetType: 'file',
  docUuid: ''
}

type ModalResolver = (value: ShareModalResult | null) => void

export const _$_shareModal = (() => {
  const store = writable<ShareModalState>(INITIAL_STATE)
  let resolver: ModalResolver | null = null

  function settle(value: ShareModalResult | null) {
    if (resolver) resolver(value)
    resolver = null
    store.set(INITIAL_STATE)
  }

  function open(options: ShareModalOptions): Promise<ShareModalResult | null> {
    if (resolver) {
      resolver(null)
      resolver = null
    }
    store.set({ ...INITIAL_STATE, ...options, open: true })
    return new Promise<ShareModalResult | null>((resolve) => {
      resolver = resolve
    })
  }

  function confirm(value: ShareModalResult) {
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
    setExternalState: (state: ShareModalState) => store.set(state)
  }
})()

export function openShareModal(options: ShareModalOptions) {
  return _$_shareModal.open(options)
}
