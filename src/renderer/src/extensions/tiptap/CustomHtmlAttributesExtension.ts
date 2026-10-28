import { Paragraph } from '@tiptap/extension-paragraph'
import { TextStyle } from '@tiptap/extension-text-style'
import { Node, mergeAttributes } from '@tiptap/core'

type AttrMap = Record<string, string>

const collectAttributes = (element: HTMLElement): AttrMap | null => {
  const attrs: AttrMap = {}
  for (const attr of Array.from(element.attributes)) {
    const name = attr.name
    const value = attr.value
    if (!name) continue
    if (/^on/i.test(name)) continue
    if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(value)) {
      continue
    }
    attrs[name] = value
  }
  return Object.keys(attrs).length ? attrs : null
}

const mergeDataAttrs = (HTMLAttributes: Record<string, any>) => {
  const merged = { ...HTMLAttributes }
  const dataAttrs = merged.dataAttrs
  delete merged.dataAttrs
  if (dataAttrs && typeof dataAttrs === 'object') {
    Object.assign(merged, dataAttrs)
  }
  return merged
}

/* export const PreserveParagraph = Paragraph.extend({
  addAttributes() {
    return {
      dataAttrs: {
        default: null,
        parseHTML: (element) => collectAttributes(element as HTMLElement),
        renderHTML: (attrs) => attrs?.dataAttrs || {}
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'p',
        getAttrs: (element) => {
          const dataAttrs = collectAttributes(element as HTMLElement)
          return dataAttrs ? { dataAttrs } : {}
        }
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const merged = mergeDataAttrs(HTMLAttributes)
    return ['p', mergeAttributes(this.options.HTMLAttributes, merged), 0]
  }
}) */


export const PreserveParagraph = Paragraph.extend({
  // Increase priority to ensure it defines the schema before TextAlign/UniqueID
  priority: 1000,

  addAttributes() {
    return {
      // 1. Explicitly define class so Tiptap recognizes it for merging
      class: {
        default: null,
        parseHTML: element => element.getAttribute('class'),
        renderHTML: attrs => attrs.class ? { class: attrs.class } : {},
      },
      // 2. Explicitly define style
      style: {
        default: null,
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attrs => attrs.style ? { style: attrs.style } : {},
      },
      // 3. Keep your catch-all for data-* or other weird attributes
      dataAttrs: {
        default: null,
        parseHTML: (element) => {
          const all = collectAttributes(element as HTMLElement)
          if (!all) return null
          // Remove class and style from the map so they aren't duplicated
          const { class: _, style: __, ...rest } = all
          return Object.keys(rest).length ? rest : null
        },
        renderHTML: (attrs) => attrs?.dataAttrs || {}
      }
    }
  },

  parseHTML() {
    return [{ tag: 'p' }]
  },

  renderHTML({ HTMLAttributes }) {
    // mergeAttributes handles combining the class/style/dataAttrs into one flat object
    const { dataAttrs, ...rest } = HTMLAttributes
    const finalAttrs = { ...rest, ...(dataAttrs || {}) }
    
    return ['p', mergeAttributes(this.options.HTMLAttributes, finalAttrs), 0]
  }
})

export const PreserveTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      dataAttrs: {
        default: null,
        parseHTML: (element) => collectAttributes(element as HTMLElement),
        renderHTML: (attrs) => attrs?.dataAttrs || {}
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span',
        consuming: false,
        getAttrs: (element) => {
          const dataAttrs = collectAttributes(element as HTMLElement)
          if (!dataAttrs) return false
          return { dataAttrs }
        }
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const merged = mergeDataAttrs(HTMLAttributes)
    return ['span', mergeAttributes(this.options.HTMLAttributes, merged), 0]
  }
})


export const CustomDiv = Node.create({
  name: 'customDiv',
  group: 'block',
  content: 'block*', // Allows h1, p, and other divs inside
  defining: true,

  addAttributes() {
    return {
      class: {
        default: null,
        parseHTML: el => el.getAttribute('class'),
        renderHTML: attrs => attrs.class ? { class: attrs.class } : {},
      },
      style: {
        default: null,
        parseHTML: el => el.getAttribute('style'),
        renderHTML: attrs => attrs.style ? { style: attrs.style } : {},
      }
    }
  },

  parseHTML() {
    return [{ tag: 'div' }]
  },

  renderHTML({ HTMLAttributes }) {
    // mergeAttributes ensures classes like 'header' are preserved
    return ['div', mergeAttributes(HTMLAttributes), 0]
  },
})
