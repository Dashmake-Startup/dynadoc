import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export type CustomPlaceholderExtensionState = {
  visible: boolean
  emptyDoc: boolean
  emptyParagraph: boolean
  topLevel: boolean
}

const key = new PluginKey('customPlaceholderExtension')

const compute = (state: any): CustomPlaceholderExtensionState => {
  const { doc, selection } = state
  const first = doc?.firstChild
  const emptyDoc =
    doc?.childCount === 1 &&
    first?.type?.name === 'paragraph' &&
    (first?.content?.size ?? 0) === 0

  const $from = selection?.$from
  const parent = $from?.parent
  const emptyParagraph = parent?.type?.name === 'paragraph' && (parent?.content?.size ?? 0) === 0
  const topLevel = ($from?.depth ?? 0) === 1

  // Show only when user is in an empty top-level paragraph (typically the start of a new doc).
  const visible = Boolean(emptyDoc && emptyParagraph && topLevel)

  return { visible, emptyDoc, emptyParagraph, topLevel }
}

export const CustomPlaceholderExtension = Extension.create<{
  onUpdate?: (next: CustomPlaceholderExtensionState) => void
}>({
  name: 'customPlaceholderExtension',

  addOptions() {
    return {
      onUpdate: undefined
    }
  },

  addStorage() {
    return {
      state: { visible: false, emptyDoc: false, emptyParagraph: false, topLevel: false } as CustomPlaceholderExtensionState
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        view: (view) => {
          let prev = compute(view.state)
          this.storage.state = prev
          this.options.onUpdate?.(prev)

          return {
            update: (nextView) => {
              const next = compute(nextView.state)
              const changed =
                next.visible !== prev.visible ||
                next.emptyDoc !== prev.emptyDoc ||
                next.emptyParagraph !== prev.emptyParagraph ||
                next.topLevel !== prev.topLevel
              if (!changed) return
              prev = next
              this.storage.state = next
              this.options.onUpdate?.(next)
            }
          }
        }
      })
    ]
  }
})

