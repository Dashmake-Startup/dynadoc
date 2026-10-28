import { Node, mergeAttributes } from '@tiptap/core'
import { SvelteNodeViewRenderer } from 'svelte-tiptap'
import { v4 as uuidv4 } from 'uuid'
import { CustomLatexProjectExtensionProps } from './utils/common.utils'
import LatexProjectView from './components/LatexProjectView.svelte'
import { DocumentModel } from '../../../models/Document'
import { nodeApi } from '../../../utils/shims/node'

// const fs = nodeApi.fs
// const path = nodeApi.path

// const fs = window.node?.fs
// const path = window.node?.path

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

export interface PaginationOptions {
  maxPageHeight: number
  maxPageWidth: number
  wysiwygEditorIdToUpdate: string
}

const defaultOptions: PaginationOptions = {
  maxPageHeight: null,
  maxPageWidth: null,
  wysiwygEditorIdToUpdate: null
}

export const CustomLatexProjectExtension = Node.create({
  name: CustomLatexProjectExtensionProps.name,
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return defaultOptions
  },

  addAttributes() {
    return {
      id: { default: '' },
      projectId: { default: '' },
      projectPath: { default: '' },
      mainFilePath: { default: '' },
      title: { default: '' },
      status: { default: 'idle' },
      lastCompiledAt: { default: null },
      lastPdfPath: { default: '' },
      maxPageHeight: { default: this.options.maxPageHeight },
      maxPageWidth: { default: this.options.maxPageWidth },
      wysiwygEditorIdToUpdate: { default: this.options.wysiwygEditorIdToUpdate }
    }
  },

  parseHTML() {
    return [{ tag: CustomLatexProjectExtensionProps.tagName }]
  },

  renderHTML({ HTMLAttributes }) {
    return [CustomLatexProjectExtensionProps.tagName, mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return SvelteNodeViewRenderer(LatexProjectView)
  },

  addCommands() {
    return {
      insertLatexProject:
        (attrs = {}) =>
        async ({ editor }) => {
          const activeDoc = DocumentModel.getActiveDocument()
          if (!activeDoc) return false
          const baseDir = activeDoc.getAsset(DocumentModel.AssetType.LATEX)
          if (!baseDir) return false
          await nodeApi.fsPromises.mkdir(baseDir, { recursive: true })

          const projectId = uuidv4()
          const projectDir = nodeApi.path.join(baseDir, projectId)
          const title = attrs?.title || `LaTeX Project`

          const init = await window.api.latexProjectInit({
            projectDir,
            title
          })
          const mainFilePath = init?.mainFilePath || nodeApi.path.join(projectDir, 'main.tex')

          if (editor.isDestroyed) return false

          console.log("insertLatexProjectinsertLatexProject")

          editor
            .chain()
            .focus()
            .insertContent({
              type: this.name,
              attrs: {
                id: uuidv4(),
                projectId,
                projectPath: projectDir,
                mainFilePath,
                title,
                status: 'idle',
                lastCompiledAt: null,
                lastPdfPath: ''
              }
            })
            .run()
                      console.log("insertLatexProjectinsertLatexProject end")
 
          return true
        }
    }
  }
})
