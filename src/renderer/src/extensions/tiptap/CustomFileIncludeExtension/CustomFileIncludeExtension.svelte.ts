import { Node, mergeAttributes } from '@tiptap/core'
import { SvelteNodeViewRenderer } from 'svelte-tiptap'
import { v4 as uuidv4 } from 'uuid'
import FileIncludeComponent from './components/FileInclude.svelte'
import { CustomFileIncludeExtensionProps } from './utils/common.utils'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileInclude: {
      insertFileInclude: (sourcePath: string) => ReturnType
    }
  }
}

export const CustomFileIncludeExtension = Node.create({
  name: CustomFileIncludeExtensionProps.name,
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true, // Prevents accidental deletion of the boundary during backspacing
  allowGapCursor: true,


  // Use 'inline' to allow it to flow with text
  // group: 'inline', 
  // inline: true,

  // Must be non-atom so the content can be updated/split by pagination
  atom: false,
  
  selectable: true,
  draggable: true,
  // isolating: true,

  addAttributes() {
    return {
      id: { default: null },
      sourcePath: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('sourcePath') || element.getAttribute('sourcepath')
      },
      lastSyncedAt: { default: null },
      // Innovative idea: add a 'locked' attribute for UI state
      isLocked: { default: true }
    }
  },

  parseHTML() {
    return [{ tag: CustomFileIncludeExtensionProps.tagName }]
  },

  renderHTML({ HTMLAttributes }) {
    return [CustomFileIncludeExtensionProps.tagName, mergeAttributes(HTMLAttributes), 0]
  },
  // Ensure the pagination extension treats this as a container
  // renderHTML({ HTMLAttributes }) {
  //   return [CustomFileIncludeExtensionProps.tagName, mergeAttributes(HTMLAttributes), 0]
  // },

  addNodeView() {
    return SvelteNodeViewRenderer(FileIncludeComponent)
  },

  addCommands() {
    return {
      insertFileInclude:
        (sourcePath: string) =>
        ({ editor, commands }) => {
          if (!sourcePath) return false

          return commands.insertContent({
            type: this.name,
            attrs: {
              id: uuidv4(),
              sourcePath
            },
            content: [{ type: 'paragraph' }]
          })
        }
    }
  }
})
