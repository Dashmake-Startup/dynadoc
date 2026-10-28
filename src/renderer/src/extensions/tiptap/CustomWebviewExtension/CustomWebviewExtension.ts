import { Node, mergeAttributes } from '@tiptap/core'
import Webview from './components/Webview.svelte'
import { SvelteNodeViewRenderer } from 'svelte-tiptap'
import { CustomWebviewExtensionProps } from './utils/utils'
import type { ResizerComponentOptions } from '../../../components/app/editor/components/display/utils/utils'

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        CustomWebviewExtension: {
            insertWebview: () => ReturnType
        }
    }
}

const defaultOptions: ResizerComponentOptions = {
    maxPageHeight: null,
    maxPageWidth: null,
    wysiwygEditorIdToUpdate: null
}
export const CustomWebviewExtension = Node.create({
    name: CustomWebviewExtensionProps.name,

    group: 'block',
    selectable: false,

    atom: true,
    addOptions() {
        return defaultOptions;
    },

    addAttributes() {
        return {
            src: {
                default: ''
            },
            width: {
                default: '100%'
            },
            height: {
                // default: '50vh'
                default: '100%'
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
        return [
            { tag: CustomWebviewExtensionProps.name }
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return [
            CustomWebviewExtensionProps.name,
            mergeAttributes(HTMLAttributes),
        ]
    },

    addNodeView() {

        return SvelteNodeViewRenderer(Webview)
    },

    /* addNodeView() {
        return ({ node, getPos, editor }) => {
            const dom = document.createElement('div')
            dom.className = 'webview-node'

            const webview = document.createElement('webview')
            webview.src = node.attrs.src

            webview.style.width = '100%'
            webview.style.height = '300px'

            const input = document.createElement('input')
            input.value = node.attrs.src
            input.onchange = () => {
                editor
                    .chain()
                    .focus()
                    .command(({ tr }) => {
                        tr.setNodeMarkup(getPos(), undefined, {
                            ...node.attrs,
                            src: input.value,
                        })
                        return true
                    })
                    .run()
            }

            dom.insertBefore(input, webview)


            dom.appendChild(webview)

            return {
                dom,
                update(updatedNode) {
                    if (updatedNode.attrs.src !== node.attrs.src) {
                        webview.src = updatedNode.attrs.src
                    }
                    return true
                }
            }
        }
    }, */

    addCommands() {
        return {
            insertWebview: (url: string) => {
                // if(!url) return
                return ({ state, chain }) => {
                    chain().insertContent({
                        type: CustomWebviewExtensionProps.name,
                        attrs: { src: url }
                    }).run()

                }
            }
        }
    }
})
