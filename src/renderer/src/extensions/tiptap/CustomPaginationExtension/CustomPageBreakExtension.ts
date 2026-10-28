import { Node, mergeAttributes } from '@tiptap/core'

export type PageBreakKind = 'page' | 'section' | 'blank'

export const CustomPageBreakExtension = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      height: {
        default: 0,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-height')
          const value = raw ? Number(raw) : 0
          return Number.isFinite(value) ? value : 0
        }
      },
      kind: {
        default: 'page',
        parseHTML: (element) => element.getAttribute('data-page-break') || 'page'
      }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const height = Number(HTMLAttributes.height || 0)
    const kind = (HTMLAttributes.kind || 'page') as PageBreakKind
    const style = `height:${Math.max(0, height)}px;`
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-page-break': kind,
        'data-height': height,
        class: `rm-manual-page-break rm-manual-page-break-${kind}`,
        style
      })
    ]
  }
})

export default CustomPageBreakExtension
