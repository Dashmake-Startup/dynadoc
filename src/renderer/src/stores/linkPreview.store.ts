import { writable } from 'svelte/store'

export type LinkPreviewState = {
  open: boolean
  href: string | null
  x: number
  y: number
}

const DEFAULT_STATE: LinkPreviewState = {
  open: false,
  href: null,
  x: 0,
  y: 0
}

const store = writable<LinkPreviewState>({ ...DEFAULT_STATE })

export const _$_linkPreview = {
  subscribe: store.subscribe,
  open: (payload: { href: string; x: number; y: number }) => {
    store.set({
      open: true,
      href: payload.href,
      x: payload.x,
      y: payload.y
    })
  },
  close: () => {
    store.set({ ...DEFAULT_STATE })
  }
}

export const openLinkPreview = (payload: { href: string; x: number; y: number }) =>
  _$_linkPreview.open(payload)

export const closeLinkPreview = () => _$_linkPreview.close()
