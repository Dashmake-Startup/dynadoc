import { Extension } from '@tiptap/core'

export interface SpacingOptions {
    types: string[]
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        spacing: {
            setLineSpacing: (value: number) => ReturnType
            setSpaceBefore: (value: number) => ReturnType
            setSpaceAfter: (value: number) => ReturnType
            unsetSpacing: () => ReturnType
            getCurrentLineSpacing: () => number | null | 'mixed'
            isActiveLineSpacing: (value: number) => boolean
            isActiveSpaceBefore: (value: number) => boolean
            isActiveSpaceAfter: (value: number) => boolean
        }
    }
}

export const CustomLineParagraphSpacingExtension = Extension.create<SpacingOptions>({
    name: 'spacing',

    addOptions() {
        return {
            types: ['paragraph', 'heading', 'listItem'],
        }
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    lineHeight: {
                        default: null,
                        parseHTML: el => el.style.lineHeight || null,
                        renderHTML: attrs =>
                            attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {},
                    },
                    marginTop: {
                        default: null,
                        parseHTML: el => el.style.marginTop || null,
                        renderHTML: attrs =>
                            attrs.marginTop ? { style: `margin-top: ${attrs.marginTop}` } : {},
                    },
                    marginBottom: {
                        default: null,
                        parseHTML: el => el.style.marginBottom || null,
                        renderHTML: attrs =>
                            attrs.marginBottom ? { style: `margin-bottom: ${attrs.marginBottom}` } : {},
                    },
                },
            },
        ]
    },

    addCommands() {
        return {
            setLineSpacing:
                value =>
                    ({ commands }) =>
                        this.options.types.every(type =>
                            commands.updateAttributes(type, { lineHeight: value }),
                        ),

            setSpaceBefore:
                value =>
                    ({ commands }) =>
                        this.options.types.every(type =>
                            commands.updateAttributes(type, { marginTop: `${value}px` }),
                        ),

            setSpaceAfter:
                value =>
                    ({ commands }) =>
                        this.options.types.every(type =>
                            commands.updateAttributes(type, { marginBottom: `${value}px` }),
                        ),

            unsetSpacing:
                () =>
                    ({ commands }) =>
                        this.options.types.every(type =>
                            commands.updateAttributes(type, {
                                lineHeight: null,
                                marginTop: null,
                                marginBottom: null,
                            }),
                        ),

            isActiveLineSpacing: (value: number) => {
                const { state } = this.editor
                const { from, to } = state.selection

                let active = true

                state.doc.nodesBetween(from, to, node => {
                    if (!this.options.types.includes(node.type.name)) return

                    if (node.attrs.lineHeight !== value) {
                        active = false
                        return false
                    }
                })

                return active
            },

            isActiveSpaceBefore: (value: number) => {
                const px = `${value}px`
                const { state } = this.editor
                const { from, to } = state.selection

                let active = true

                state.doc.nodesBetween(from, to, node => {
                    if (!this.options.types.includes(node.type.name)) return
                    if (node.attrs.marginTop !== px) {
                        active = false
                        return false
                    }
                })

                return active
            },

            isActiveSpaceAfter: (value: number) => {
                const px = `${value}px`
                const { state } = this.editor
                const { from, to } = state.selection

                let active = true

                state.doc.nodesBetween(from, to, node => {
                    if (!this.options.types.includes(node.type.name)) return
                    if (node.attrs.marginBottom !== px) {
                        active = false
                        return false
                    }
                })

                return active
            },

            /* isActiveLineSpacing: (value: number) => {
                const { state } = this.editor
                const { from, to } = state.selection

                let active = true

                state.doc.nodesBetween(from, to, node => {
                    if (!this.options.types.includes(node.type.name)) return

                    if (node.attrs.lineHeight !== value) {
                        active = false
                        return false
                    }
                })

                return active
            }, */

            getCurrentLineSpacing: () => {
                const { state } = this.editor
                const { from, to } = state.selection

                let current: number | null | undefined = undefined
                let mixed = false

                state.doc.nodesBetween(from, to, node => {
                    if (!this.options.types.includes(node.type.name)) return

                    const lh = node.attrs.lineHeight ?? null

                    if (current === undefined) {
                        current = lh
                    } else if (current !== lh) {
                        mixed = true
                        return false
                    }
                })

                if (mixed) return 'mixed'
                return current ?? null
            },
        }
    },
})
