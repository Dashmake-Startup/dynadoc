import { Node, mergeAttributes } from '@tiptap/core'
import { mount, unmount, type Component } from 'svelte'
import type FileRenderer from '../../fileRenderers/FileRenderer.svelte'
import type FolderRenderer from '../../fileRenderers/FolderRenderer.svelte'
import { CustomFileExtensionProps, CustomFolderExtensionProps } from './utils/common.utils'
import { SvelteNodeViewRenderer } from 'svelte-tiptap'
import { v4 as uuidv4 } from 'uuid'
import Utils from '../../../utils/Utils'
import EditorHelpers from '../../../utils/EditorHelpers'
// import FileRenderer from '../../FileRenderer.svelte'
// import FolderRenderer from '../../FolderRenderer.svelte'

export interface PaginationOptions {
    maxPageHeight: number
    maxPageWidth: number
    wysiwygEditorIdToUpdate: string
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        file: {
            insertFile: (src: string) => ReturnType
        }
        folder: {
            insertFolder: (src: string) => ReturnType
        }
    }
}


let extensionName = CustomFileExtensionProps.name
let extensionTagName = CustomFileExtensionProps.tagName
let extensionTagAttributeSrc = CustomFileExtensionProps.attributeSrc
// let extensionName = 'file'
// let extensionTagName = 'file'
// let extensionTagAttributeSrc = 'src'
export const CustomFileTagExtension2 = Node.create({
    name: extensionName,
    group: 'block',
    atom: true,

    addAttributes() {
        const uuidAttr = EditorHelpers.uuidAttributeName
        return {
            [extensionTagAttributeSrc]: { default: '' },
            [uuidAttr]: {
                default: () => uuidv4(),
                parseHTML: (element) =>
                    element.getAttribute(uuidAttr) ||
                    element.getAttribute(EditorHelpers.dataUuidAttributeName),
                renderHTML: (attributes) =>
                    attributes?.[uuidAttr]
                        ? {
                            [uuidAttr]: attributes[uuidAttr],
                            [EditorHelpers.dataUuidAttributeName]: attributes[uuidAttr]
                        }
                        : {}
            }
        }
    },

    parseHTML() {
        // return [{ tag: 'file[src]' }]
        return [{ tag: extensionTagName }]

    },

    renderHTML({ HTMLAttributes }) {
        return [extensionTagName, mergeAttributes(HTMLAttributes)]
    },

    addNodeView() {
        return ({ node, editor, getPos }) => {
            // const span = HTMLElement
            const span = document.createElement('div')
            span.className = 'file'


            span.dataset[extensionTagAttributeSrc] = node.attrs[extensionTagAttributeSrc]


            // Create reactive props object
            const props =
            // $state(
            {
                __src: node.attrs[extensionTagAttributeSrc],
            }
            // )

            // Mount Svelte component (Svelte 5)
            const component = mount(FileRenderer, {
                // const component = mount(FileView, {
                target: span,
                props
            })



            return { dom: span }
        }
    },

    addCommands() {
        return {
            insertFile:
                (src: string) =>
                    ({ commands }) => {
                        return commands.insertContent({
                            type: this.name,
                            attrs: { src },
                        })
                    },
        }
    },
})


export const CustomFileTagExtension = createGenericNode({
    name: extensionName,
    tag: extensionTagName,
    component: import('../../fileRenderers/FileRenderer.svelte'),
    componentLoader: () => import('../../fileRenderers/FileRenderer.svelte'),
    // options: this?.options.maxPageHeight,

    attributes: {
        src: '',
        width: '',
        height: '',
        maxWidth: '',
        maxHeight: '',
        minWidth: '',
        minHeight: '',
        // src: 
        // {
        // [extensionTagAttributeSrc]: { default: '' },
        // },
        // name: '',
        // size: 0,
        // type: 'unknown',
    },

    commandName: 'insertFile',
})


extensionName = CustomFolderExtensionProps.name
extensionTagName = CustomFolderExtensionProps.tagName
// extensionName = 'folder'
// extensionTagName = 'folder'

export const CustomFolderTagExtension = createGenericNode({
    name: extensionName,
    tag: extensionTagName,
    componentLoader: () => import('../../fileRenderers/FolderRenderer.svelte'),

    attributes: {
        src: ''
    },

    commandName: 'insertFolder',
})

interface GenericNodeConfig {
    // basic identity
    name: string
    tag: string
    // component?: Component
    componentLoader?: () => Promise<{ default: Component } | Component>

    // attributes: { src: '', path: '', type: Utils.FILE_TYPES.pdf }
    options?: Record<string, any>
    attributes?: Record<string, any>

    // tiptap behaviors
    group?: string
    inline?: boolean
    atom?: boolean

    // commands such as insertFile, insertFolder, insertWidget
    commandName?: string

    // optional custom getters / setters for svelte communication
    onUpdate?: (nodeAttrs: any, updateAttrs: (a: any) => void) => void
}

export function createGenericNode(config: GenericNodeConfig) {
    const {
        name,
        tag,
        // component,
        componentLoader,
        attributes = {},
        group = 'block',
        inline = false,
        atom = true,
        commandName = `insert${capitalize(name)}`,
        onUpdate,
    } = config

    const defaultOptions: PaginationOptions = {
        maxPageHeight: null,
        maxPageWidth: null,
        wysiwygEditorIdToUpdate: null
    }

    return Node.create({
        name,
        inline,
        group,
        atom,
        addOptions() {
            return defaultOptions;
            // return  this.options || defaultOptions;
        },

        addAttributes() {
            const result: any = {}
            for (const key in attributes) {
                result[key] = { default: attributes[key] }
            }
            const append = {
                maxPageHeight: { default: this.options.maxPageHeight },
                maxPageWidth: { default: this.options.maxPageWidth },
                wysiwygEditorIdToUpdate: { default: this.options.wysiwygEditorIdToUpdate },
            }
            const uuidAttr = EditorHelpers.uuidAttributeName
            const uuidEntry = {
                [uuidAttr]: {
                    default: () => uuidv4(),
                    parseHTML: (element) =>
                        element.getAttribute(uuidAttr) ||
                        element.getAttribute(EditorHelpers.dataUuidAttributeName),
                    renderHTML: (attrs) =>
                        attrs?.[uuidAttr]
                            ? {
                                [uuidAttr]: attrs[uuidAttr],
                                [EditorHelpers.dataUuidAttributeName]: attrs[uuidAttr]
                            }
                            : {}
                }
            }
            return { ...result, ...append, ...uuidEntry }
        },

        parseHTML() {
            return [{ tag }]
        },

        renderHTML({ HTMLAttributes }) {
            return [tag, mergeAttributes(HTMLAttributes)]
        },

        addNodeView() {
            // The 'props' here is of type NodeViewRendererProps
            return (props) => {
                const { node, editor, getPos } = props;
                const dom = document.createElement('div');
                dom.classList.add(`${name}-wrapper`);

                let renderer: any = null;

                if (componentLoader) {

                    // Inside addNodeView return object...
                    componentLoader().then((module) => {
                        const Comp = (module as any).default || module;

                        // 1. Initialize the renderer factory with the Component
                        const rendererFactory = SvelteNodeViewRenderer(Comp);

                        // 2. Pass the FULL 'props' object to the factory
                        // This includes view, decorations, extension, etc.
                        // renderer = rendererFactory(props);
                        // Ensure we are passing the initial attributes as props
                        renderer = rendererFactory({
                            ...props,
                            // Manually injecting __src to match your FolderRenderer prop
                            props: {
                                __src: node.attrs.src,
                                ...props.props // merge other props if they exist
                            }
                        });

                        if (renderer && renderer.dom) {
                            dom.appendChild(renderer.dom);
                        }
                    }).catch(err => {
                        console.error(`Failed to load component for ${name}:`, err);
                        dom.innerText = 'Error loading preview';
                    });
                }

                return {
                    dom,
                    update: (updatedNode) => {
                        if (updatedNode.type !== node.type) return false;
                        // Proxy the update call to the internal Svelte renderer
                        if (renderer?.update) {
                            return renderer.update(updatedNode);
                        }
                        return true;
                    },
                    destroy: () => {
                        if (renderer?.destroy) {
                            renderer.destroy();
                        }
                    }
                };
            }
        },

        /* addNodeView() {
            // if (component) {
            //     return SvelteNodeViewRenderer(component)
            // }

            return ({ node }) => {
                const container = document.createElement('div')
                let destroyed = false
                let componentInstance: any = null

                const props = {
                    __src: node?.attrs?.src,
                    __node: node,
                    __updateAttrs: (attrs: any) => {
                        if (node?.attrs && attrs && typeof attrs === 'object') {
                            Object.assign(node.attrs, attrs)
                        }
                    },
                    __maxPageHeight: node?.attrs?.maxPageHeight,
                    __maxPageWidth: node?.attrs?.maxPageWidth,
                    __wysiwygEditorIdToUpdate: node?.attrs?.wysiwygEditorIdToUpdate
                }

                const load = async () => {
                    if (!componentLoader) return
                    const mod = await componentLoader()
                    if (destroyed) return
                    const Comp = (mod as any).default || mod
                    componentInstance = mount(Comp, {
                        target: container,
                        props
                    })
                }

                load().catch((error) => {
                    console.error('Failed to load file/folder renderer', error)
                })

                return {
                    dom: container,
                    destroy() {
                        destroyed = true
                        if (componentInstance) {
                            unmount(componentInstance)
                            componentInstance = null
                        }
                    }
                }
            }

        }, */

        /* addNodeView() {
    return ({ node, getPos, editor }) => {
        const container = document.createElement('div');
        let destroyed = false;
        let componentInstance: any = null;

        // Helper to update Tiptap attributes
        const updateNodeAttrs = (attrs: any) => {
            if (typeof getPos !== 'function') return;
            editor.commands.command(({ tr }) => {
                tr.setNodeMarkup(getPos(), undefined, { ...node.attrs, ...attrs });
                return true;
            });
        };

        const load = async () => {
            const mod = componentLoader ? await componentLoader() : null;
            if (destroyed) return;
            
            const Comp = mod ? ((mod as any).default || mod) : component;
            
            componentInstance = mount(Comp, {
                target: container,
                props: {
                    __node: node,
                    __updateAttrs: updateNodeAttrs,
                    // Spread all attributes so the Svelte component gets them reactively
                    ...node.attrs 
                }
            });
        };

        load();

        return {
            dom: container,
            // REACTIVITY: This ensures the Svelte component receives new props when node updates
            update: (updatedNode) => {
                if (updatedNode.type.name !== name) return false;
                
                // If using Svelte 5 $props, you may need to update the instance manually
                // or use a Svelte 5 'update' method if your component supports it.
                // For standard Svelte components, re-mounting or syncing is key:
                if (componentInstance && typeof componentInstance.$set === 'function') {
                    componentInstance.$set({ ...updatedNode.attrs });
                }
                return true;
            },
            destroy: () => {
                destroyed = true;
                if (componentInstance) {
                    unmount(componentInstance);
                    componentInstance = null;
                }
            }
        };
    };
} */
        /* addNodeView() {
            return ({ node, getPos, editor }) => {
                const dom = document.createElement('span')
                dom.className = `${name}-node`
                dom.dataset.type = name

                // collect initial props
                const props = {
                    __editor: editor,
                    __maxPageHeight: this.options.maxPageHeight,
                    __maxPageWidth: this.options.maxPageWidth,
                    __wysiwygEditorIdToUpdate: this.options.wysiwygEditorIdToUpdate,
                    __src: node.attrs[extensionTagAttributeSrc],
                    __node: node,
                    // getPos,
                    ...node.attrs,
                    // attrs: { ...node.attrs },
                    __updateAttrs: (newAttrs: any) => {
                        console.log("__updateAttrs yees",{newAttrs})
                        editor.commands.command(({ tr }) => {
                            tr.setNodeMarkup(getPos(), undefined, {
                                ...node.attrs,
                                ...newAttrs,
                            })
                            return true
                        })
                    },
                }

                const view = mount(component, {
                    target: dom,
                    props,
                })

                // reactively update Svelte when Yjs updates attrs
                if (onUpdate) {
                    onUpdate(node.attrs, props.__updateAttrs)
                }

                return {
                    dom,
                    destroy() {
                        unmount(view)
                        // view.$destroy()
                    },
                }
            }
        }, */

        // dynamic "insertX" command
        addCommands() {
            return {
                [commandName]:
                    (src: any) =>
                        // (attrs: any) =>
                        ({ commands }) =>
                            commands.insertContent({
                                type: name,
                                attrs: {
                                    src,
                                    width: this.options.maxPageWidth || 500,
                                    height: this.options.maxPageHeight || 500,
                                    maxWidth: this.options.maxPageWidth || 500,
                                    maxHeight: this.options.maxPageHeight || 500,
                                    minWidth: this.options.maxPageWidth || 500,
                                    minHeight: this.options.maxPageHeight || 500,
                                },
                                // attrs: attributes,
                                // attrs: {
                                // [attributeName]: value,   // <── force correct field
                                //   },
                            }),
            }
        },
    })
}

function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}
