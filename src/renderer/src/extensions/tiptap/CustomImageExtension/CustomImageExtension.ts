import { Node, mergeAttributes } from '@tiptap/core'
import { CustomImageExtensionProps } from './utils/common.utils'

export interface InsertImageOptions {
    src: string
    alt?: string
    title?: string
    width?: number
    height?: number

}
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        CustomImageExtension: {
            insertImage: (options: InsertImageOptions) => ReturnType

        }
    }
}


export const CustomImageExtension = Node.create({
    name: CustomImageExtensionProps.name,

    inline: false,
    group: 'block',
    draggable: true,
    selectable: true,

    addAttributes() {
        return {
            src: { default: null },
            alt: { default: null },
            title: { default: null },
            width: { default: null },
            height: { default: null },
            align: {
                default: null,
                parseHTML: el => el.getAttribute('data-align') || el.getAttribute('align'),
                renderHTML: attr => attr.align ? { 'data-align': attr.align } : {}
            },
            wrap: {
                default: null,
                parseHTML: el => el.getAttribute('data-wrap'),
                renderHTML: attr => attr.wrap ? { 'data-wrap': attr.wrap } : {}
            },
            borderColor: {
                default: null,
                parseHTML: el => el.getAttribute('data-border-color'),
                renderHTML: attr => attr.borderColor ? { 'data-border-color': attr.borderColor } : {}
            },
            borderWidth: {
                default: null,
                parseHTML: el => el.getAttribute('data-border-width'),
                renderHTML: attr => attr.borderWidth ? { 'data-border-width': attr.borderWidth } : {}
            },
            shadow: {
                default: null,
                parseHTML: el => el.getAttribute('data-shadow'),
                renderHTML: attr => attr.shadow ? { 'data-shadow': attr.shadow } : {}
            },
            filter: {
                default: null,
                parseHTML: el => el.getAttribute('data-filter'),
                renderHTML: attr => attr.filter ? { 'data-filter': attr.filter } : {}
            },
            rotate: {
                default: null,
                parseHTML: el => el.getAttribute('data-rotate'),
                renderHTML: attr => attr.rotate ? { 'data-rotate': attr.rotate } : {}
            },
            lockAspectRatio: {
                default: false,
                parseHTML: el => el.getAttribute('data-lock-aspect') === 'true',
                renderHTML: attr => attr.lockAspectRatio ? { 'data-lock-aspect': 'true' } : {}
            },
            radius: {
                default: null,
                parseHTML: el => el.getAttribute('data-radius'),
                renderHTML: attr => attr.radius ? { 'data-radius': attr.radius } : {}
            },
            opacity: {
                default: null,
                parseHTML: el => el.getAttribute('data-opacity'),
                renderHTML: attr => attr.opacity ? { 'data-opacity': attr.opacity } : {}
            }
        }
    },

    parseHTML() {
        return [
            {
                tag: `${CustomImageExtensionProps.name}[src]`,
                // tag: 'img[src]',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        const attrs: Record<string, any> = { ...HTMLAttributes }
        const styleParts: string[] = []

        if (attrs.borderColor) {
            const width = attrs.borderWidth ?? 1
            styleParts.push(`border: ${width}px solid ${attrs.borderColor}`)
        }
        if (attrs.shadow) {
            styleParts.push(`box-shadow: ${attrs.shadow}`)
        }
        if (attrs.filter) {
            styleParts.push(`filter: ${attrs.filter}`)
        }
        if (attrs.radius) {
            styleParts.push(`border-radius: ${attrs.radius}`)
        }
        if (attrs.opacity !== null && attrs.opacity !== undefined) {
            styleParts.push(`opacity: ${attrs.opacity}`)
        }
        if (attrs.rotate !== null && attrs.rotate !== undefined && attrs.rotate !== '') {
            styleParts.push(`transform: rotate(${attrs.rotate}deg)`)
        }

        if (styleParts.length) {
            attrs.style = [attrs.style, ...styleParts].filter(Boolean).join('; ')
        }

        return [CustomImageExtensionProps.name, mergeAttributes(attrs)]
    },

    // 🔑 COMMAND
    addCommands() {
        return {
            insertImage:
                (options: InsertImageOptions) =>
                    ({ commands }) => {
                        return commands.insertContent({
                            type: this.name,
                            attrs: options,
                        })
                    },
        }
    },
})
