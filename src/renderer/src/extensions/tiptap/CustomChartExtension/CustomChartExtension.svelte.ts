import { v4 as uuidv4 } from 'uuid'
import { Editor, Node, mergeAttributes } from '@tiptap/core'
import { SvelteNodeViewRenderer } from 'svelte-tiptap'
import ChartNodeView from './components/ChartNodeView.svelte'
import EditorHelpers from '../../../utils/EditorHelpers'
import { CustomChartExtensionProps } from './utils/common.utils'

export interface ChartOptions {
  defaultHeight: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    CustomChartExtension: {
      insertChart: (attrs?: Record<string, any>) => ReturnType
    }
  }
}

const defaultOptions: ChartOptions = {
  defaultHeight: 360
}

export const CustomChartExtension = Node.create<ChartOptions>({
  name: CustomChartExtensionProps.name,
  group: 'block',
  draggable: true,
  selectable: true,

  addOptions() {
    return defaultOptions
  },

  addAttributes() {
    return {
      [EditorHelpers.uuidAttributeName]: {
        default: () => uuidv4(),
        parseHTML: (element) =>
          element.getAttribute(EditorHelpers.uuidAttributeName) ||
          element.getAttribute(EditorHelpers.dataUuidAttributeName),
        renderHTML: (attributes) =>
          attributes?.[EditorHelpers.uuidAttributeName]
            ? {
                [EditorHelpers.uuidAttributeName]: attributes[EditorHelpers.uuidAttributeName],
                [EditorHelpers.dataUuidAttributeName]: attributes[EditorHelpers.uuidAttributeName]
              }
            : {}
      },
      id: { default: '' },
      configPath: { default: '' },
      chartType: { default: 'bar' },
      sourceType: { default: 'sheet' },
      sourcePath: { default: '' },
      sourceTableId: { default: '' },
      sampleData: { default: false },
      range: { default: '' },
      title: { default: '' },
      options: { default: null },
      embedSync: { default: false },
      embedAssetPath: { default: '' },
      embedId: { default: '' },
      height: { default: this.options.defaultHeight }
    }
  },

  parseHTML() {
    return [{ tag: CustomChartExtensionProps.tagName }]
  },

  renderHTML({ HTMLAttributes }) {
    return [CustomChartExtensionProps.tagName, mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return SvelteNodeViewRenderer(ChartNodeView)
  },

  addCommands() {
    return {
      insertChart:
        (attrs: Record<string, any> = {}) =>
        ({ editor }) => {
          const payload = {
            id: uuidv4(),
            chartType: 'bar',
            sourcePath: '',
            range: '',
            title: '',
            height: this.options.defaultHeight,
            ...attrs
          }
          return editor
            .chain()
            .focus()
            .insertContent({ type: CustomChartExtensionProps.name, attrs: payload })
            .run()
        }
    }
  }
})
