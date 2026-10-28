import { Node, mergeAttributes } from '@tiptap/core'
import { SvelteNodeViewRenderer } from 'svelte-tiptap'
import MermaidView from './components/MermaidView.svelte'
import { CustomMermaidExtensionProps } from './utils/common.utils'

export const CustomMermaidExtension = Node.create({
  name: CustomMermaidExtensionProps.name,
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      code: { default: '' },
      src: { default: null },
      title: { default: '' }
    }
  },

  parseHTML() {
    return [{ tag: CustomMermaidExtensionProps.tagName }]
  },

  renderHTML({ HTMLAttributes }) {
    return [CustomMermaidExtensionProps.tagName, mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return SvelteNodeViewRenderer(MermaidView)
  },

  addCommands() {
    return {
      insertMermaid:
        (attrs: { code?: string; src?: string | null; title?: string } = {}) =>
        ({ editor }) => {
          const src = attrs?.src ?? null
          const template = `graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[OK]
  B -->|No| D[Fix]
`

          const code = src ? '' : attrs?.code ?? template
          const title = attrs?.title ?? 'Mermaid Diagram'

          return editor
            .chain()
            .focus()
            .insertContent({
              type: this.name,
              attrs: { code, src, title }
            })
            .run()
        }
    }
  }
})

