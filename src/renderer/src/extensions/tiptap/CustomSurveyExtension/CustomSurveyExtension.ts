import { Node, mergeAttributes } from '@tiptap/core'
import { SvelteNodeViewRenderer } from 'svelte-tiptap'
import SurveyBuilder from './components/SurveyBuilder.svelte'
import { CustomSurveyExtensionProps } from './utils/common.utils'
import { v4 as uuidv4 } from 'uuid'
import { ensureNodeViewSrc } from '../utils/utils'
import { DocumentModel } from '../../../models/Document'
import { defaultSurveyDocV1 } from './utils/surveySchema'



export interface PaginationOptions {
  maxPageHeight: number
  maxPageWidth: number
  wysiwygEditorIdToUpdate: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    CustomSurveyExtension: {
      insertSurvey: (attrs?) => ReturnType
    }
  }
}


const defaultOptions: PaginationOptions = {
  maxPageHeight: null,
  maxPageWidth: null,
  wysiwygEditorIdToUpdate: null
}
export const CustomSurveyExtension = Node.create({
  name: CustomSurveyExtensionProps.name,

  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  /*   addAttributes() {
      return {
        [CustomSurveyExtensionProps.tagAttributeSchema]: {
          default: {
            display: 'form',
            components: []
          }
        },
        mode: {
          default: 'builder' // 'builder' | 'runtime'
        }
      }
    }, */

  addAttributes() {
    return {
      id: { default: '' },
      title: { default: '' },
      [CustomSurveyExtensionProps.tagAttributeSrc]: { default: '' }, // points to survey JSON on disk
      // src: node.attrs[extensionTagAttributeSrc],
      maxPageHeight: { default: this.options.maxPageHeight },
      maxPageWidth: { default: this.options.maxPageWidth },
      wysiwygEditorIdToUpdate: { default: this.options.wysiwygEditorIdToUpdate },
    }
  },
  addOptions() {
    return defaultOptions;
  },

  parseHTML() {
    return [{ tag: CustomSurveyExtensionProps.tagName }]
  },

  renderHTML({ HTMLAttributes }) {
    return [CustomSurveyExtensionProps.tagName, mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return SvelteNodeViewRenderer(SurveyBuilder)
  }
  ,
  addCommands() {
    return {
      insertSurvey: (attrs = {}) => ({ editor }) => {
        // 1. Generate ID immediately so it's locked to this specific action
        const id = uuidv4();

        // 2. Start the async work in the background
        (async () => {
          try {
            // Fetch the asset path using flat sequential filenames: survey.json, survey2.json, ...
            const src = await ensureNodeViewSrc(
              '',
              'survey',
              DocumentModel.AssetType.SURVEY,
              undefined,
              undefined,
              JSON.stringify(defaultSurveyDocV1(), null, 2)
            );

            // 3. SAFETY CHECK: Ensure editor wasn't destroyed during the await
            if (editor.isDestroyed) return;

            // 4. Dispatch the content insertion
            // We use editor.commands to ensure a fresh transaction
            editor.chain()
              .focus()
              .insertContent({
                type: this.name, // or extensionName
                attrs: {
                  ...attrs,
                  id: id,
                  title: attrs?.title || '',
                  [CustomSurveyExtensionProps.tagAttributeSrc]: src,
                  parentFilePath: this.options.wysiwygEditorIdToUpdate,
                }
              })
              .run();

          } catch (error) {
            console.error("Failed to fetch survey path:", error);
          }
        })();

        // 5. Return true synchronously to notify Tiptap the command was handled
        return true;
      },
    }
  },
})
