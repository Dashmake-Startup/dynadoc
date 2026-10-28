import { writable, get } from 'svelte/store'

export type ShareLinkContext = {
  shareId?: string
  link?: string
  password?: string
  docUuid?: string
  path?: string
  name?: string
  role?: string
}

type ShareLinkState = Record<string, ShareLinkContext>

const store = writable<ShareLinkState>({})

export const _$_shareLinkContext = {
  subscribe: store.subscribe,
  setForDocument: (docUuid: string, context: ShareLinkContext) => {
    if (!docUuid) return
    store.update((state) => ({
      ...state,
      [docUuid]: { ...(state[docUuid] || {}), ...context }
    }))
  },
  getForDocument: (docUuid: string) => {
    if (!docUuid) return null
    return get(store)?.[docUuid] || null
  },
  clearForDocument: (docUuid: string) => {
    if (!docUuid) return
    store.update((state) => {
      const next = { ...state }
      delete next[docUuid]
      return next
    })
  }
}

export function setShareLinkContext(docUuid: string, context: ShareLinkContext) {
  _$_shareLinkContext.setForDocument(docUuid, context)
}

export function getShareLinkContext(docUuid: string) {
  return _$_shareLinkContext.getForDocument(docUuid)
}
