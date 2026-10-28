import { Node, mergeAttributes } from '@tiptap/core'
import { SvelteNodeViewRenderer } from 'svelte-tiptap'
import GalleryBuilder from './components/GalleryBuilder.svelte'
import { v4 as uuidv4 } from 'uuid'
import { CustomGalleryExtensionProps } from './utils/common.utils'
import type { ResizerComponentOptions } from '../../../components/app/editor/components/display/utils/utils'

/* export interface GalleryOptions {
    maxPageHeight: number
    maxPageWidth: number
    wysiwygEditorIdToUpdate: string
} */

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        CustomGalleryExtension: {
            /**
             * Insert a gallery block pointed at a specific folder
             * @param attrs { src: string }
             */
            insertGallery: (src: string) => ReturnType
            // insertGallery: (attrs?: { src: string }) => ReturnType
        }
    }
}

// const defaultOptions: GalleryOptions = {
const defaultOptions: ResizerComponentOptions = {
    maxPageHeight: null,
    maxPageWidth: null,
    wysiwygEditorIdToUpdate: null
}

export const CustomGalleryExtension = Node.create({
    name: CustomGalleryExtensionProps.name,

    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,

    addOptions() {
        return defaultOptions;
    },

    addAttributes() {
        return {
            id: { default: '' },
            // Updated to match your Folder/File Renderer naming convention
            src: {
                default: '',
                parseHTML: element => element.getAttribute('src'),
                renderHTML: attributes => ({ 'src': attributes.src })
            },
            maxPageHeight: { default: this.options.maxPageHeight },
            maxPageWidth: { default: this.options.maxPageWidth },
            // Keep metadata context
            wysiwygEditorIdToUpdate: {
                default: this.options.wysiwygEditorIdToUpdate
            },
        }
    },

    parseHTML() {
        return [{ tag: CustomGalleryExtensionProps.tagName }]
    },

    renderHTML({ HTMLAttributes }) {
        // This renders <custom-gallery-component src="..."></custom-gallery-component>
        return [CustomGalleryExtensionProps.tagName, mergeAttributes(HTMLAttributes)]
    },

    addNodeView() {
        return SvelteNodeViewRenderer(GalleryBuilder)
    },

    addCommands() {
        return {
            insertGallery:
                (src = '') =>
                    // (attrs = { src: '' }) =>
                    ({ chain }) => {
                        /* console.log("insertGalleryinsertGallery addCommands", { src }, {
                            type: this.name,
                            attrs: {
                                id: uuidv4(),
                                src,
                                wysiwygEditorIdToUpdate: this.options.wysiwygEditorIdToUpdate,
                            },
                        }) */

                        return chain()
                            .focus()
                            .insertContent({
                                type: this.name,
                                attrs: {
                                    id: uuidv4(),
                                    src,
                                    wysiwygEditorIdToUpdate: this.options.wysiwygEditorIdToUpdate,
                                },
                            })
                            .run();
                    },
        }
    },
})