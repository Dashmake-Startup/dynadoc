import { Node, mergeAttributes } from '@tiptap/core'
import { CustomDesignExtensionProps } from './utils/common.utils'
import { SvelteNodeViewRenderer } from 'svelte-tiptap'
import { v4 as uuidv4 } from 'uuid'
import { DocumentModel } from '../../../models/Document'
import DesignStudioMain from './components/DesignStudioMain.svelte'

export interface InsertDesignOptions {
    src: string
    alt?: string
    title?: string
    width?: number
    height?: number

}
export interface PaginationOptions {
    maxPageHeight: number
    maxPageWidth: number
    wysiwygEditorIdToUpdate: string
}


declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        CustomDesignExtension: {
            insertDesign: (options: InsertDesignOptions) => ReturnType

        }
    }
}
const defaultOptions: PaginationOptions = {
    maxPageHeight: null,
    maxPageWidth: null,
    wysiwygEditorIdToUpdate: null
}

let extensionName = CustomDesignExtensionProps.name
let extensionTagName = CustomDesignExtensionProps.tagName
let extensionTagAttributeSrc = CustomDesignExtensionProps.tagAttributeSrc

export const CustomDesignExtension = Node.create({
    name: CustomDesignExtensionProps.name,

    inline: false,
    group: 'block',
    atom: true,
    draggable: true,
    // selectable: true,
    selectable: false,

    addAttributes() {
        return {
            id: { default: '' },
            [CustomDesignExtensionProps.tagAttributeSrc]: { default: '' },// path or ID of slide JSON
            parentFilePath: { default: '' },
            // src: { default: null },
            alt: { default: null },
            title: { default: null },
            width: { default: null },
            height: { default: null },
            layout: { default: 'inline' },
            offsetX: { default: 0 },
            offsetY: { default: 0 },
            maxPageHeight: { default: this.options.maxPageHeight },
            maxPageWidth: { default: this.options.maxPageWidth },
            wysiwygEditorIdToUpdate: { default: this.options.wysiwygEditorIdToUpdate },
        }
    },

    addOptions() {
        return defaultOptions;
    },

    /* parseHTML() {
        return [
            {
                tag: `${CustomDesignExtensionProps.tagName}[src]`,

                // tag: 'img[src]',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return [CustomDesignExtensionProps.name, mergeAttributes(HTMLAttributes)]
    },
 */

    parseHTML() {
        return [{ tag: extensionName }]
    },

    renderHTML({ HTMLAttributes }) {
        return [extensionName, mergeAttributes(HTMLAttributes)]
    },

    addNodeView() {
        return SvelteNodeViewRenderer(DesignStudioMain);
    },

    // 🔑 COMMAND
    addCommands() {



        return {
            insertDesign: (attrs = null) => ({ view, dispatch, editor }) => {
                // 1. Tiptap commands must return true/false synchronously.
                // We return true to tell the editor "I am handling this."

                const id = uuidv4();

                // 2. Start the async work
                (async () => {
                    try {
                        const designPath = await DocumentModel.getAssetFilePathFromDocument(
                            DocumentModel.AssetType.DESIGN
                        );
                        const src = designPath?.filePath;

                        // 3. IMPORTANT: Once the data is ready, we MUST check if 
                        // the editor still exists before dispatching.
                        if (editor.isDestroyed) return;

                        // 4. Use the editor instance to run a NEW command 
                        // with the results of the async operation.
                        editor.commands.insertContent({
                            type: CustomDesignExtensionProps.name,
                            attrs: attrs || {
                                id: id,
                                [CustomDesignExtensionProps.tagAttributeSrc]: src,
                                parentFilePath: this.options.wysiwygEditorIdToUpdate,
                            },
                        });
                    } catch (error) {
                        console.error("Failed to insert design asset:", error);
                    }
                })();

                return true;
            },

            /* insertDesign:
                (attrs = null) =>
                    // ({ state, dispatch, editor }) => {
                     ({ chain, state }) => {
                        const id = uuidv4()
                        // editor.chain().focus().insertContent({
                        // const designFileName = EditorHelpers.generateUniqueName (id)
                        const designPath = await DocumentModel.getAssetFilePathFromDocument(DocumentModel.AssetType.DESIGN)
                        // const designPath = getDesignFilePath(id)
                        const src = designPath?.filePath
                        // console.log(' insertDesign src designPath ', {src,designPath},)
                        chain().focus().insertContent({
                            type: CustomDesignExtensionProps.name,
                            // attrs: attrs,
                            attrs: attrs || {
                                id: id,
                                [CustomDesignExtensionProps.tagAttributeSrc]: src,
                                parentFilePath: this.options.wysiwygEditorIdToUpdate,
                            },
                        }).run()
                        // .focus()
                        return true
                    }, */
        }
    },
})
