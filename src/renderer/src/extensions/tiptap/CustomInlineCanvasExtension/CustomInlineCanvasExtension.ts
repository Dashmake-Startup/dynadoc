import { Node, mergeAttributes } from '@tiptap/core'
import { SvelteNodeViewRenderer } from 'svelte-tiptap'
import { v4 as uuidv4 } from 'uuid'
import { CustomInlineCanvasExtensionProps } from './utils/common.utils'
import InlineCanvasNodeView from './components/InlineCanvasNodeView.svelte'
import { ShapeType, type Shape } from '../../../utils/canvas.types'

export type InlineCanvasFloat = 'left' | 'right' | 'none'

export interface InlineCanvasOptions {
  defaultWidth?: number
  defaultHeight?: number
  defaultFloat?: InlineCanvasFloat
}

const DEFAULT_OPTIONS: InlineCanvasOptions = {
  defaultWidth: 280,
  defaultHeight: 180,
  defaultFloat: 'left'
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    InlineCanvas: {
      insertInlineCanvas: (attrs?: Record<string, any>) => ReturnType
      insertInlineShape: (shapeType: ShapeType, attrs?: Record<string, any>) => ReturnType
      setInlineCanvasFloat: (value: InlineCanvasFloat) => ReturnType
    }
  }
}

const createShape = (type: ShapeType, opts?: Partial<Shape>): Shape => {
  const id = uuidv4()
  const base: Shape = {
    id,
    name: type === ShapeType.Text ? 'Text' : 'Shape',
    type,
    x: 20,
    y: 20,
    w: 160,
    h: 100,
    z: 0,
    fill: '#e6e6e6',
    visible: true,
    selected: false
  }

  if (type === ShapeType.Circle || type === ShapeType.Ellipse) {
    base.w = 120
    base.h = 120
  }

  if (type === ShapeType.Triangle) {
    base.w = 140
    base.h = 120
  }

  if (type === ShapeType.Text) {
    base.w = 200
    base.h = 60
    base.content = {
      type: 'content',
      value: 'Double-click to edit',
      placeholder: 'Type here'
    }
  }

  return { ...base, ...opts }
}

export const CustomInlineCanvasExtension = Node.create<InlineCanvasOptions>({
  name: CustomInlineCanvasExtensionProps.name,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return DEFAULT_OPTIONS
  },

  addAttributes() {
    return {
      id: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-id') || '',
        renderHTML: (attrs) => ({ 'data-id': attrs.id || '' })
      },
      shapes: {
        default: [],
        parseHTML: (el) => {
          const raw = el.getAttribute('data-shapes') || '[]'
          try {
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed : []
          } catch {
            return []
          }
        },
        renderHTML: (attrs) => ({
          'data-shapes': JSON.stringify(attrs.shapes || [])
        })
      },
      width: {
        default: this.options.defaultWidth,
        parseHTML: (el) => Number(el.getAttribute('data-width') || this.options.defaultWidth),
        renderHTML: (attrs) => ({ 'data-width': attrs.width ?? this.options.defaultWidth })
      },
      height: {
        default: this.options.defaultHeight,
        parseHTML: (el) => Number(el.getAttribute('data-height') || this.options.defaultHeight),
        renderHTML: (attrs) => ({ 'data-height': attrs.height ?? this.options.defaultHeight })
      },
      float: {
        default: this.options.defaultFloat,
        parseHTML: (el) => (el.getAttribute('data-float') as InlineCanvasFloat) || 'left',
        renderHTML: (attrs) => ({ 'data-float': attrs.float || 'left' })
      },
      wrapMargin: {
        default: 12,
        parseHTML: (el) => Number(el.getAttribute('data-wrap-margin') || 12),
        renderHTML: (attrs) => ({ 'data-wrap-margin': attrs.wrapMargin ?? 12 })
      }
    }
  },

  parseHTML() {
    return [{ tag: `${CustomInlineCanvasExtensionProps.tagName}` }]
  },

  renderHTML({ HTMLAttributes }) {
    return [CustomInlineCanvasExtensionProps.tagName, mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return SvelteNodeViewRenderer(InlineCanvasNodeView)
  },

  addCommands() {
    return {
      insertInlineCanvas:
        (attrs = {}) =>
        ({ commands }) => {
          const shape = createShape(ShapeType.Rect)
          return commands.insertContent({
            type: CustomInlineCanvasExtensionProps.name,
            attrs: {
              id: uuidv4(),
              shapes: [shape],
              width: this.options.defaultWidth,
              height: this.options.defaultHeight,
              float: this.options.defaultFloat,
              wrapMargin: 12,
              ...attrs
            }
          })
        },
      insertInlineShape:
        (shapeType: ShapeType, attrs = {}) =>
        ({ commands }) => {
          const shape = createShape(shapeType)
          return commands.insertContent({
            type: CustomInlineCanvasExtensionProps.name,
            attrs: {
              id: uuidv4(),
              shapes: [shape],
              width: this.options.defaultWidth,
              height: this.options.defaultHeight,
              float: this.options.defaultFloat,
              wrapMargin: 12,
              ...attrs
            }
          })
        },
      setInlineCanvasFloat:
        (value: InlineCanvasFloat) =>
        ({ editor }) => {
          const { state, view } = editor
          const { from, to } = state.selection
          let updated = false
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name !== CustomInlineCanvasExtensionProps.name) return
            const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, float: value })
            view.dispatch(tr)
            updated = true
          })
          return updated
        }
    }
  }
})

export const InlineCanvas = CustomInlineCanvasExtension
