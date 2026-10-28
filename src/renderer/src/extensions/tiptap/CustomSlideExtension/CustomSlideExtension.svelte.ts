import { v4 as uuidv4 } from 'uuid'
import { Editor, Node, mergeAttributes } from '@tiptap/core'
import { mount, unmount } from 'svelte'
import SlideDeck from './components/SlideDeck.svelte'
import { SvelteNodeViewRenderer } from 'svelte-tiptap'
import { CustomSlideExtensionProps } from './utils/common.utils'
import EditorHelpers from '../../../utils/EditorHelpers'
import { createSlide } from './collab/collab'
import { createCanvasCommands } from '../../../commands/canvasCommands'
import { ensureNodeViewSrc } from '../utils/utils'
// import { getSlideFilePath } from './utils/utils'
import { DocumentModel } from '../../../models/Document'



export interface PaginationOptions {
    maxPageHeight: number
    maxPageWidth: number,
    slideWidth: number,
    slideHeight: number,
    wysiwygEditorIdToUpdate: string
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        sheet: {
            insertSlide: (attrs?) => ReturnType
            updatePageContext: (attrs?) => ReturnType
        }
    }
}

let extensionName = CustomSlideExtensionProps.name
let extensionTagName = CustomSlideExtensionProps.tagName
let extensionTagAttributeSrc = CustomSlideExtensionProps.tagAttributeSrc
// let extensionName = 'slide'
// let extensionTagName = 'slide'
// let extensionTagAttributeSrc = 'src'

const defaultOptions: PaginationOptions = {
    maxPageHeight: null,
    maxPageWidth: null,
    slideWidth: null,
    slideHeight: null,
    wysiwygEditorIdToUpdate: null
}
export const CustomSlideExtension = Node.create({
    name: extensionName,
    group: 'block',
    // atom: true,
    selectable: false,
    // atom: false,
    // selectable: true,
    // content: 'inline*',
    // content: 'block+',

    // group: 'inline',
    // inline: true,
    draggable: true,
    // atom: true,
    // selectable: true,

    addAttributes() {
        return {
            id: { default: '' },
            [extensionTagAttributeSrc]: { default: '' },// path or ID of slide JSON
            parentFilePath: { default: '' },
            layout: { default: 'inline' },
            offsetX: { default: 0 },
            offsetY: { default: 0 },
            transition: { default: null },
            transitionDuration: { default: 0.6 },
            transitionSound: { default: null },
            transitionAdvance: { default: 'click' },
            transitionAdvanceAfter: { default: null },
            // label: { default: '' },
            // name: { default: '' },
            // placeholder: { default: '' },
            // value: { default: '' },
            // options: { default: [] },
            // required: { default: false },
            // src: node.attrs[extensionTagAttributeSrc],
            maxPageHeight: { default: this.options.maxPageHeight },
            maxPageWidth: { default: this.options.maxPageWidth },
            slideWidth: { default: this.options.slideWidth || this.options.maxPageWidth || 1280 },
            slideHeight: { default: this.options.slideHeight || this.options.maxPageHeight || 720 },
            wysiwygEditorIdToUpdate: { default: this.options.wysiwygEditorIdToUpdate },
        }
    },
    addOptions() {
        return defaultOptions;
    },

    parseHTML() {
        return [{ tag: extensionName }]
    },

    renderHTML({ HTMLAttributes }) {
        return [extensionName, mergeAttributes(HTMLAttributes)]
    },



    onCreate({ editor }) {



    },

    onUpdate({ editor }) {

    },

    addNodeView() {
        return SvelteNodeViewRenderer(SlideDeck);

        // return ReactNodeViewRenderer(SpreadsheetEditor)
        // return {
        // ReactNodeViewRenderer(SpreadsheetEditor)
        // destroy,
        // }
    },
    // ✅ Pure NodeView that manually mounts a Svelte component
    /* addNodeView() {
        return ({ node, editor, getPos }) => {
            const nodeId = node.attrs.id
            // const nodeId = node.attrs.id || uuidv4()
            // const nodeId = node.attrs.id || cryptoRandomUUID()
            const dom = document.createElement('span')
            dom.classList.add('slide-wrapper')
            // dom.classList.add(nodeId)

            // --- Mount Svelte component manually ---
            // const component = new FormFieldView({
            //   target: dom,
            //   props: {
            //     editor,
            //     node,
            //     /* updateAttrs: (attrs) => {
            //       editor.commands.updateAttributes('formField', attrs)
            //     }, +/
            //   },
            // })
            // Create reactive props object
            const props = $state({
                __src: node.attrs[extensionTagAttributeSrc],
                __maxPageHeight: this.options.maxPageHeight,
                __maxPageWidth: this.options.maxPageWidth,
                __wysiwygEditorIdToUpdate: this.options.wysiwygEditorIdToUpdate,

            })
            //  initNodeFieldValues()

            // Mount Svelte component (Svelte 5)
            //  const { destroy: unmountComponent } = mount(FormFieldView, {
            const component = mount(SlideDeck, {
                target: dom,
                props
            })
            // const pos = getPos()

            // const tr = editor.state.tr
            // tr.setNodeMarkup(pos, undefined, {
            //   ...node.attrs,
            //   id: nodeId,
            // })
            // editor.view.dispatch(tr)



            const destroy = () => {
                if (component) unmount(component)
                // component.$destroy()
                // component.destroy?.()
            }

            return {
                dom,
                // contentDOM: null, // Tells ProseMirror this is non editable
                contentDOM: component, // Tells ProseMirror this is editable
                // update,
                destroy,
            }
        }
    }, */


    addCommands() {
        return {
            insertSlide: (attrs = null) => ({ editor }) => {
                // 1. Generate ID immediately so it's locked to this specific action
                const id = uuidv4();

                // 2. Start the async work in the background
                (async () => {
                    try {
                        // Fetch the asset path using flat sequential filenames: slide.json, slide2.json, ...
                        const src = await ensureNodeViewSrc(
                            '',
                            'slide',
                            DocumentModel.AssetType.SLIDE,
                            undefined,
                            undefined,
                            '{}'
                        );

                        // 3. SAFETY CHECK: Ensure editor wasn't destroyed during the await
                        if (editor.isDestroyed) return;

                        const newAttrs = {
                            id: id,
                            [extensionTagAttributeSrc]: src,
                            parentFilePath: this.options.wysiwygEditorIdToUpdate,
                            ...(attrs ? attrs : {})
                        }

                        // 4. Dispatch the content insertion
                        // We use editor.commands to ensure a fresh transaction
                        editor.chain()
                            .focus()
                            .insertContent({
                                type: this.name, // or extensionName
                                // attrs: attrs || {
                                /* attrs: {
                                    id: id,
                                    [extensionTagAttributeSrc]: src,
                                    parentFilePath: this.options.wysiwygEditorIdToUpdate,
                                    ...attrs
                                }, */
                                attrs: newAttrs
                            })
                            .run();

                        // Ensure default content exists even if UI hasn't mounted yet
                        if (src) {
                            try {
                                const canvas = await createSlide(id, src)
                                await canvas.load?.()
                                if (canvas?.shapes?.size === 0) {
                                    const cmds = createCanvasCommands(canvas.shapes, canvas.texts, canvas.meta)
                                    const w = newAttrs?.slideWidth || this.options.maxPageWidth || 1280
                                    const h = newAttrs?.slideHeight || this.options.maxPageHeight || 720
                                    cmds.createDefaultCanvasContent(w, h)
                                }
                                canvas.release?.()
                            } catch (err) {
                                console.warn('[Slide] Failed to initialize default content', err)
                            }
                        }

                    } catch (error) {
                        console.error("Failed to fetch slide path:", error);
                    }
                })();

                // 5. Return true synchronously to notify Tiptap the command was handled
                return true;
            },
            /* insertSlide:
                (attrs = null) =>
                    // ({ state, dispatch, editor }) => {
                    async ({ chain, state }) => {
                        const id = uuidv4()
                        // editor.chain().focus().insertContent({
                        // const slideFileName = EditorHelpers.generateUniqueName (id)
                        const slidePath = await DocumentModel.getAssetFilePathFromDocument(DocumentModel.AssetType.SLIDE)
                        // const slidePath = getSlideFilePath()
                        // const slidePath = getSlideFilePath(id)
                        const src = slidePath?.filePath
                        chain().focus().insertContent({
                            type: extensionName,
                            // attrs: attrs,
                            attrs: attrs || {
                                id: id,
                                [extensionTagAttributeSrc]: src,
                                parentFilePath: this.options.wysiwygEditorIdToUpdate,
                            },
                        }).run()
                        // .focus()
                        return true
                    }, */


        }
    },




})
