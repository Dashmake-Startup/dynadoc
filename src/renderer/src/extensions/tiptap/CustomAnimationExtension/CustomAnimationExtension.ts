import { Extension, Mark, mergeAttributes, Node } from '@tiptap/core'
import { CustomAnimationExtensionProps } from './utils/utils'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        CustomAnimationExtension: {
            wrapWithAnimation: (type?: string, order?: number) => ReturnType
            updateAnimation: (attrs: { type?: string; order?: number; start?: string; duration?: number; delay?: number; text?: string }) => ReturnType
            unwrapAnimation: () => ReturnType
            clearAllAnimation: (idList?: string[]) => ReturnType
        }
    }
}

export const CustomAnimationExtension = Node.create({
    name: CustomAnimationExtensionProps.name,
    // inline: true,
    // group: 'inline',
    // content: 'inline*',

    group: 'block',
    content: 'block+',

    selectable: true,
    draggable: false,
    atom: false, // IMPORTANT: must be false so text is editable

    addAttributes() {
        return {
            id: { default: '' },
            type: {
                default: 'fade-in', // fade-in, fly-in, zoom-in...
                // parseHTML: element => element.getAttribute('data-animation-type'),
                // renderHTML: attributes => ({ 'data-animation-type': attributes.type }),
            },
            order: {
                default: 0, // The sequence in which it appears
                // parseHTML: element => element.getAttribute('data-animation-order'),
                // renderHTML: attributes => ({ 'data-animation-order': attributes.order }),
            },
            start: { default: 'on-click' },
            duration: { default: 0.5 },
            delay: { default: 0 },
            text: { default: 'all-at-once' }
        }
    },

    parseHTML() { return [{ tag: CustomAnimationExtensionProps.name }] },
    // parseHTML() { return [{ tag: 'span[data-animation-type]' }] },

    renderHTML({ HTMLAttributes }) {
        return [CustomAnimationExtensionProps.name, mergeAttributes(HTMLAttributes, {
            'data-animation': 'true',
            'data-animation-type': HTMLAttributes.type,
            'data-animation-start': HTMLAttributes.start,
            'data-animation-duration': HTMLAttributes.duration,
            'data-animation-delay': HTMLAttributes.delay,
            'data-animation-text': HTMLAttributes.text,
            class: 'animate-target'
        }), 0]
        // return ['span', mergeAttributes(HTMLAttributes, { class: 'animate-target' }), 0]
    },


    addCommands() {
        return {
            wrapWithAnimation:
                (type = 'fade-in', order = 1) =>
                    ({ commands }) => {
                        console.log("wrapWithAnimation ", this.name, { type, order })
                        // commands.wrapIn('paragraph')
                        commands.wrapIn(this.name, { type, order })
                    },

            updateAnimation:
                attrs =>
                    ({ commands }) =>
                        commands.updateAttributes(this.name, attrs),

            unwrapAnimation:
                () =>
                    ({ commands }) =>
                        commands.lift(this.name),
            clearAllAnimation:
                (idList?: string[]) =>
                    ({ state, dispatch }) => {
                        const { doc } = state
                        let tr = state.tr

                        const targets: {
                            from: number
                            to: number
                            content: any
                        }[] = []

                        // 1️⃣ Collect ALL animation nodes (including nested)
                        doc.descendants((node, pos) => {
                            if (node.type.name !== 'animation') return

                            const nodeId = node.attrs?.id
                            if (idList && (!nodeId || !idList.includes(nodeId))) return

                            targets.push({
                                from: pos,
                                to: pos + node.nodeSize,
                                content: node.content,
                            })
                        })

                        if (!targets.length) return false

                        // 2️⃣ Replace from deepest to shallowest
                        // (later positions first)
                        for (let i = targets.length - 1; i >= 0; i--) {
                            const { from, to, content } = targets[i]
                            tr = tr.replaceWith(from, to, content)
                        }

                        dispatch(tr)
                        return true
                    }

            ,
            clearAllAnimation1:
                (idList?: string[]) =>
                    ({ state, dispatch }) => {
                        const { doc } = state
                        let tr = state.tr

                        const targets: { pos: number; node: any }[] = []

                        doc.descendants((node, pos) => {
                            if (node.type.name !== this.name) return

                            const nodeId = node.attrs?.id
                            if (idList && (!nodeId || !idList.includes(nodeId))) return

                            targets.push({ pos, node })
                        })

                        // 🔥 CRITICAL: process from bottom → top
                        for (let i = targets.length - 1; i >= 0; i--) {
                            const { pos, node } = targets[i]
                            tr = tr.replaceWith(pos, pos + node.nodeSize, node.content)
                        }

                        if (targets.length && dispatch) {
                            dispatch(tr)
                            return true
                        }

                        return false
                    },

            clearAllAnimation2:
                (idList?: string[]) =>
                    ({ state, dispatch }) => {
                        const { tr, doc } = state
                        let modified = false

                        doc.descendants((node, pos) => {
                            if (node.type.name !== this.name) return

                            const nodeId = node.attrs?.id

                            // 🎯 Filter by idList if provided
                            if (idList && (!nodeId || !idList.includes(nodeId))) {
                                return
                            }

                            // ✅ Replace animation node with its content
                            tr.replaceWith(
                                pos,
                                pos + node.nodeSize,
                                node.content,
                            )

                            modified = true
                        })

                        if (modified && dispatch) {
                            dispatch(tr)
                        }

                        return modified
                    },
        }
    },




    addProseMirrorPlugins() {
        const pluginKey = new PluginKey(CustomAnimationExtensionProps.name)

        return [
            new Plugin({
                key: pluginKey,

                props: {
                    decorations(state) {
                        const decorations: Decoration[] = []

                        state.doc.descendants((node, pos) => {
                            // ✅ 1. TARGET THE NODE (not mark)
                            if (node.type.name !== CustomAnimationExtensionProps.name) return

                            const { type, order } = node.attrs

                            // --- UI container
                            const dom = document.createElement('span')
                            dom.className = 'animation-control'
                            dom.contentEditable = 'false'

                            // --- ORDER INPUT
                            const orderInput = document.createElement('input')
                            orderInput.type = 'number'
                            orderInput.min = '1'
                            orderInput.value = String(order)
                            orderInput.className = 'animation-order-input'

                            orderInput.onchange = () => {
                                const tr = state.tr.setNodeMarkup(pos, undefined, {
                                    ...node.attrs,
                                    order: Number(orderInput.value),
                                })
                                state.view.dispatch(tr)
                            }

                            // --- TYPE SELECT
                            const select = document.createElement('select')
                                ;['fade-in', 'fly-in', 'zoom-in'].forEach(t => {
                                    const opt = document.createElement('option')
                                    opt.value = t
                                    opt.textContent = t
                                    if (t === type) opt.selected = true
                                    select.appendChild(opt)
                                })

                            select.onchange = () => {
                                const tr = state.tr.setNodeMarkup(pos, undefined, {
                                    ...node.attrs,
                                    type: select.value,
                                })
                                state.view.dispatch(tr)
                            }

                            // --- REMOVE BUTTON
                            const remove = document.createElement('button')
                            remove.textContent = '✕'
                            remove.onclick = () => {
                                const tr = state.tr.delete(pos, pos + node.nodeSize)
                                state.view.dispatch(tr)
                            }

                            dom.append(orderInput, select, remove)

                            // ✅ 2. PLACE DECORATION AFTER NODE
                            decorations.push(
                                Decoration.widget(pos + node.nodeSize, dom, {
                                    side: 1,
                                }),
                            )
                        })

                        return DecorationSet.create(state.doc, decorations)
                    },
                },
            }),
        ]
    }

})
