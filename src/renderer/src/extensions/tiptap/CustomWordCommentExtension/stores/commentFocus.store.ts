import { writable } from 'svelte/store'

export type WordCommentFocusPayload = {
  id: string | null
  scroll?: boolean
  source?: 'gutter' | 'review' | 'external'
}

export const _$_wordCommentFocus = writable<WordCommentFocusPayload>({
  id: null,
  scroll: false,
  source: 'external'
})

export function focusWordComment(
  id: string | null,
  options: Omit<WordCommentFocusPayload, 'id'> = {}
) {
  _$_wordCommentFocus.set({
    id,
    scroll: options.scroll ?? true,
    source: options.source ?? 'external'
  })
}
