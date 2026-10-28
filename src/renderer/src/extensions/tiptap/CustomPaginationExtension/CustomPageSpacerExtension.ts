import { Node, mergeAttributes } from '@tiptap/core'

export const CustomPageSpacerExtension = Node.create({
  name: 'pageSpacer',
  group: 'block',
  content: 'inline*',
  isolating: true,

  addAttributes() {
    return {
      height: {
        default: 0,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-height')
          const value = raw ? Number(raw) : 0
          return Number.isFinite(value) ? value : 0
        }
      }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-page-spacer]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const height = Number(HTMLAttributes.height || 0)
    const style = `min-height:${Math.max(0, height)}px;`
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-page-spacer': 'true',
        'data-height': height,
        class: 'rm-page-spacer',
        style
      }),
      0
    ]
  }
})

export default CustomPageSpacerExtension
