import { writable } from 'svelte/store'

export type FindBarState = {
  open: boolean
  query: string
  caseSensitive: boolean
  wholeWord: boolean
  currentIdx: number
  totalCount: number
}

export const _$_findBar = writable<FindBarState>({
  open: false,
  query: '',
  caseSensitive: false,
  wholeWord: false,
  currentIdx: 0,
  totalCount: 0
})
