import { Node, mergeAttributes } from '@tiptap/core'
import { DOMParser as PMDOMParser, Fragment } from 'prosemirror-model'
import { CustomVarExtensionProps } from '../CustomVarExtension/utils/common.utils'
import { Plugin, PluginKey } from 'prosemirror-state'
import * as Y from 'yjs'
  import { v4 as uuidv4 } from 'uuid'


import { mount, unmount } from 'svelte'
import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../stores/editor.store'
import { getVariable } from '../CustomVarExtension/stores/variableManipulator'
import ReviewQuickModeWidget from './components/ReviewQuickModeWidget.svelte'
// import { ySyncPlugin, yCursorPlugin } from 'y-prosemirror'

export interface ReviewOptions {
    toolbarHTMLContainerRoot: HTMLElement | null
}

// Help Typescript to recognize the commands with proper IntelliSense and type-safety.
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        review: {
            /**
             * Enable or disable review mode.
             * @param enabled - true or false
             * @param author - optional override for the author name
             */
            setReviewMode: (enabled: boolean, author?: string) => ReturnType

        }
    }
}


type ReviewDec = { id: string; from: number; to: number; kind: 'insert' | 'delete'; author?: string }

const reviewPluginKey = new PluginKey('tiptapReviewPlugin')

function uid() {
    return Math.random().toString(36).slice(2, 9)
}

const normalizeReviewIds = (tr, doc) => {
    let changed = false
    const seen = new Set<string>()
    doc.descendants((node, pos) => {
        if (node.type?.name !== 'review') return
        const currentId = (node.attrs?.id || '').toString()
        if (!currentId || seen.has(currentId)) {
            const nextId = uuidv4()
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: nextId }, node.marks)
            seen.add(nextId)
            changed = true
            return
        }
        seen.add(currentId)
    })
    return changed
}

const normalizeAuthor = (author?: string | null) => (author || 'anonymous').trim() || 'anonymous'

const getAuthorColor = (author?: string | null) => {
    const value = normalizeAuthor(author)
    let hash = 0
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i)
        hash |= 0
    }
    const hue = Math.abs(hash) % 360
    return `hsl(${hue} 72% 45%)`
}

const getReviewColor = (mode?: string, author?: string | null) => {
    if (mode === 'delete') return 'hsl(0 72% 52%)'
    if (mode === 'insert') return 'hsl(142 55% 42%)'
    return getAuthorColor(author)
}

const formatReviewTimestamp = (timestamp?: number | string | null) => {
    if (!timestamp) return ''
    const value = typeof timestamp === 'string' ? Number(timestamp) : timestamp
    if (!Number.isFinite(value)) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString()
}

const buildReviewTimestampLabel = (timestamp?: number | string | null) => {
    const label = formatReviewTimestamp(timestamp)
    return label || ''
}

const resolveVariableText = (node: any, documentEditor?: any) => {
    const name =
        node?.attrs?.[CustomVarExtensionProps.tagAttributeName] ||
        node?.attrs?.name ||
        node?.attrs?.variable
    if (!name) return ''
    const resolved = getVariable(name, documentEditor || _$_documentEditorsList.getActiveSync?.() || '')
    if (resolved === null || resolved === undefined) return ''
    if (typeof resolved === 'string' || typeof resolved === 'number' || typeof resolved === 'boolean') {
        return String(resolved)
    }
    if (typeof resolved === 'object') {
        if ('url' in resolved && resolved.url) return String(resolved.url)
        if ('path' in resolved && resolved.path) return String(resolved.path)
        if ('value' in resolved && resolved.value) return String(resolved.value)
        return JSON.stringify(resolved)
    }
    return ''
}

const replaceVarTokens = (text: string, documentEditor?: any) =>
    text.replace(/\{var:([^}]+)\}/g, (_, raw) => {
        const name = String(raw || '').trim()
        if (!name) return ''
        const resolved = getVariable(name, documentEditor || _$_documentEditorsList.getActiveSync?.() || '')
        if (resolved === null || resolved === undefined) return `{var:${name}}`
        if (typeof resolved === 'string' || typeof resolved === 'number' || typeof resolved === 'boolean') {
            return String(resolved)
        }
        if (typeof resolved === 'object') {
            if ('url' in resolved && resolved.url) return String(resolved.url)
            if ('path' in resolved && resolved.path) return String(resolved.path)
            if ('value' in resolved && resolved.value) return String(resolved.value)
            return JSON.stringify(resolved)
        }
        return `{var:${name}}`
    })

const buildReviewContentFromText = (schema: any, text: string, documentEditor?: any) => {
    if (!text) return null
    const variableType = schema?.nodes?.[CustomVarExtensionProps.name]
    const parts: any[] = []
    let lastIndex = 0
    const pattern = /\{var:([^}]+)\}/g
    let match: RegExpExecArray | null

    while ((match = pattern.exec(text))) {
        const start = match.index
        if (start > lastIndex) {
            const slice = text.slice(lastIndex, start)
            if (slice) parts.push(schema.text(slice))
        }
        const rawName = String(match[1] || '').trim()
        if (rawName) {
            if (variableType) {
                const resolved = getVariable(rawName, documentEditor || _$_documentEditorsList.getActiveSync?.() || '')
                const value =
                    resolved === null || resolved === undefined
                        ? rawName
                        : typeof resolved === 'string' || typeof resolved === 'number' || typeof resolved === 'boolean'
                            ? String(resolved)
                            : typeof resolved === 'object'
                                ? resolved.url || resolved.path || resolved.value || rawName
                                : rawName
                parts.push(
                    variableType.create({
                        [CustomVarExtensionProps.tagAttributeName]: rawName,
                        [CustomVarExtensionProps.tagAttributeValue]: value
                    })
                )
            } else {
                const resolvedText = replaceVarTokens(`{var:${rawName}}`, documentEditor)
                if (resolvedText) parts.push(schema.text(resolvedText))
            }
        }
        lastIndex = start + match[0].length
    }

    if (lastIndex < text.length) {
        const tail = text.slice(lastIndex)
        if (tail) parts.push(schema.text(tail))
    }

    if (!parts.length) {
        return schema.text(replaceVarTokens(text, documentEditor))
    }
    return Fragment.fromArray(parts)
}

const extractTextWithVars = (schema: any, html: string) => {
    try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        const pmDoc = PMDOMParser.fromSchema(schema).parse(doc.body)
        const text = pmDoc.textBetween(0, pmDoc.content.size, '\n\n', (node) => {
            if (node?.type?.name === CustomVarExtensionProps.name) {
                const name =
                    node?.attrs?.[CustomVarExtensionProps.tagAttributeName] ||
                    node?.attrs?.name ||
                    node?.attrs?.variable
                return name ? `{var:${name}}` : ''
            }
            return undefined
        })
        return text
    } catch {
        return ''
    }
}

/* function createSvelteDecoration(dec: ReviewDec, getText: () => string) {
    const dom = document.createElement('span')
    const props = {
        text: getText(),
        author: dec.author || 'anonymous'
    }

    if (dec.kind === 'insert') {
        // Mount Svelte component (Svelte 5)
        const component = mount(InsertDecoration, {
            target: dom,
            props
        })
        // new InsertDecoration({ target: dom, props })
    } else if (dec.kind === 'delete') {
        const component = mount(DeleteDecoration, {
            target: dom,
            props
        })
        // new DeleteDecoration({ target: dom, props })
    }

    return Decoration.inline(dec.from, dec.to, { nodeName: 'span', class: 'svelte-decoration', dom })
} */

export const CustomReviewExtension = Node.create({
    name: 'review',
    group: 'inline',
    inline: true,
    content: 'inline*',

    defining: true,
    selectable: true,


    addOptions() {
        return {
            defaultAuthor: 'anonymous',
            insertClass: 'review-insert',
            deleteClass: 'review-delete',
            toolbarHTMLContainerRoot: null,
        }
    },

    addAttributes() {
        return {
            mode: {
                default: 'insert', // "insert" | "delete"
            },
            author: { default: 'anonymous' },
            id: { default: '' },
            color: { default: null },
            timestamp: {
                default: null,
            },
            resolved: { default: false },
            resolvedBy: { default: null },
            resolvedAt: { default: null },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'review',
                getAttrs: (el: HTMLElement) => ({
                    mode: el.getAttribute('data-mode') || el.getAttribute('mode') || 'insert',
                    author: el.getAttribute('data-author') || el.getAttribute('author') || 'anonymous',
                    id: el.getAttribute('data-id') || el.getAttribute('id') || '',
                    color: el.getAttribute('data-color'),
                    timestamp: el.getAttribute('data-timestamp') || el.getAttribute('timestamp'),
                    resolved: el.getAttribute('data-resolved') === 'true',
                    resolvedBy: el.getAttribute('data-resolved-by'),
                    resolvedAt: el.getAttribute('data-resolved-at')
                }),
            },
            {
                tag: 'span[data-suggestion]',
                getAttrs: (el: HTMLElement) => ({
                    mode: el.getAttribute('data-mode') || 'insert',
                    author: el.getAttribute('data-author') || 'anonymous',
                    id: el.getAttribute('data-id') || '',
                    color: el.getAttribute('data-color'),
                    timestamp: el.getAttribute('data-timestamp') || el.getAttribute('timestamp'),
                    resolved: el.getAttribute('data-resolved') === 'true',
                    resolvedBy: el.getAttribute('data-resolved-by'),
                    resolvedAt: el.getAttribute('data-resolved-at')
                }),
            },
        ]
    },

    renderHTML({ node, HTMLAttributes }) {
        const { mode } = node.attrs

        const style =
            mode === 'insert'
                ? 'text-decoration: underline;'
                : 'text-decoration: line-through;'
        const cls = mode === 'insert' ? 'review-insert' : 'review-delete'
        const author = normalizeAuthor(node.attrs.author)
        const color = getReviewColor(mode, author)
        const styleWithColor = `${style} --review-color: ${color};`
        const timestampLabel = buildReviewTimestampLabel(node.attrs.timestamp)

        return [
            'span',
            mergeAttributes(HTMLAttributes, {
                'data-suggestion': 'true',
                'data-review': 'true',
                'data-mode': node.attrs.mode,
                'data-author': author,
                'data-timestamp': node.attrs.timestamp,
                'data-timestamp-label': timestampLabel,
                'data-id': node.attrs.id,
                'data-color': color,
                'data-resolved': node.attrs.resolved ? 'true' : 'false',
                'data-resolved-by': node.attrs.resolvedBy,
                'data-resolved-at': node.attrs.resolvedAt,
                style: styleWithColor,
                class: cls
            }),
            0,
        ]
    },

    onCreate({ editor }) {
        const activeEntry = _$_wysiwygEditorsList.getActiveEntry?.()
        const editorHTMLContainerRoot = this.options.toolbarHTMLContainerRoot || activeEntry?.editorHTMLContainerRoot
        if (!editorHTMLContainerRoot) {
            return
        }

        const activeDoc = _$_wysiwygEditorsList.getActiveSync?.()
        const reviewSettings = activeDoc?.document?.config?.reviewSettings
        if (reviewSettings) {
            editor.storage.review = editor.storage.review || { enabled: false, author: this.options.defaultAuthor }
            editor.storage.review.enabled = !!reviewSettings.trackChangesEnabled
            if (reviewSettings.reviewerName) {
                editor.storage.review.author = reviewSettings.reviewerName
            }
        }

        const container = document.createElement('div')
        container.className = 'review-quick-container'
        editorHTMLContainerRoot.prepend(container)

        const props = $state({ editor })
        const component = mount(ReviewQuickModeWidget, {
            target: container,
            props,
        })

        editor.on('destroy', () => {
            if (component) unmount(component)
            container?.remove()
        })
    },

    /* addAttributes() {
        return {
            kind: { default: 'insert' },
            author: { default: 'anonymous' },
            id: { default: '' },
        }
    },
    parseHTML() {
        return [{ tag: 'span[data-review-id]' }]
    },
    renderHTML({ HTMLAttributes }) {
        const cls = HTMLAttributes.kind === 'insert' ? 'review-insert' : 'review-delete'
        return ['span', mergeAttributes(HTMLAttributes, { class: cls }), 0]
    }, */

    addCommands() {
        return {
            setReviewMode:
                (enabled: boolean, author?: string) => ({ tr, state, dispatch, editor }) => {
                    editor.storage.review = editor.storage.review || { enabled: false, author: this.options.defaultAuthor }
                    editor.storage.review.enabled = enabled
                    if (author) editor.storage.review.author = author
                    if (dispatch) dispatch(state.tr.setMeta(reviewPluginKey, { setMode: { enabled, author: editor.storage.review.author } }))
                    return true
                },
            insertSuggestion:
                (text: string) =>
                    ({ chain }) => {
                        const author = (that as any).editor?.storage?.review?.author || this.options.defaultAuthor
                        const color = getReviewColor('insert', author)
                        return chain()
                            .insertContent({
                                type: 'review',
                                attrs: {
                                    mode: 'insert',
                                    id: uuidv4(),
                                    author,
                                    color,
                                    timestamp: Date.now(),
                                },
                                content: [{ type: 'text', text }],
                            })
                            .run()
                    },

            deleteSuggestion:
                () =>
                    ({ state, chain }) => {
                        const { from, to } = state.selection
                        const text = state.doc.textBetween(from, to)

                        if (!text) return false

                        const author = (that as any).editor?.storage?.review?.author || this.options.defaultAuthor
                        const color = getReviewColor('delete', author)

                        return chain()
                            .deleteRange({ from, to })
                            .insertContentAt(from, {
                                type: 'review',
                                attrs: {
                                    mode: 'delete',
                                    id: uuidv4(),
                                    author,
                                    color,
                                    timestamp: Date.now(),
                                },
                                content: [{ type: 'text', text }],
                            })
                            .run()
                    },

        }
    },

    addStorage() {
        return {
            review: { enabled: false, author: this.options.defaultAuthor },
            // ydoc: editor.storage.collaboration?.ydoc || new Y.Doc(),
            ydoc: new Y.Doc(),
            reviewMap: null as Y.Map<any> | null,
        }
    },

    addProseMirrorPlugins() {
        const that = this

        return [
            // ySyncPlugin(this.storage.ydoc.getXmlFragment('prosemirror')),
            // yCursorPlugin(this.storage.ydoc),

            new Plugin<any>({
                key: reviewPluginKey,
                appendTransaction: (transactions, oldState, newState) => {
                    if (!transactions.some((tr) => tr.docChanged)) return null
                    if (transactions.some((tr) => tr.getMeta('reviewIdNormalize'))) return null
                    const tr = newState.tr
                    const changed = normalizeReviewIds(tr, newState.doc)
                    if (!changed) return null
                    tr.setMeta('reviewIdNormalize', true)
                    return tr
                },

                /* state: {
                    init: (_, { doc }) => {
                        // initialize Y.Map for review decorations
                        // that.storage.reviewMap = that.storage.ydoc.getMap('reviewDecs')
                        return {
                            decorations: DecorationSet.empty,
                        }
                    },

                    apply(tr, value, oldState, newState) {
                        let decs = value.decorations.map(tr.mapping, tr.doc)
                        return { decorations: decs }

                    },
                }, */

                props: {

                    handleDOMEvents: {
                        paste(view, event: ClipboardEvent) {
                            const editor = (that as any).editor
                            const storage = editor?.storage?.review || { enabled: false }
                            if (!storage.enabled) return false
                            if (!event.clipboardData) return false
                            const html = event.clipboardData.getData('text/html') || ''
                            let text = event.clipboardData.getData('text/plain') || ''
                            if (html) {
                                const extracted = extractTextWithVars(view.state.schema, html)
                                if (extracted) text = extracted
                            }
                            if (!text) return false

                            event.preventDefault()

                            const { state, dispatch } = view
                            const { from, to } = state.selection
                            const author = storage.author || that.options.defaultAuthor
                            const color = getReviewColor('insert', author)
                            const activeDoc = _$_documentEditorsList.getActiveSync?.()
                            const content = buildReviewContentFromText(
                                state.schema,
                                text,
                                activeDoc?.document || activeDoc
                            )
                            const insertNode = state.schema.nodes.review.create(
                                {
                                    mode: 'insert',
                                    id: uid(),
                                    author,
                                    color,
                                    timestamp: Date.now(),
                                },
                                content || state.schema.text(text)
                            )
                            const tr = state.tr.replaceRangeWith(from, to, insertNode)
                            const resolvedPos = tr.doc.resolve(from + insertNode.nodeSize)
                            tr.setSelection(state.selection.constructor.near(resolvedPos))
                            dispatch(tr)
                            return true
                        },
                        beforeinput(view, event: InputEvent) {
                            const editor = (that as any).editor
                            const storage = editor?.storage?.review || { enabled: false }
                            if (!storage.enabled) return false

                            const { state, dispatch } = view
                            const { from, to } = state.selection

                            //
                            // ---------- INSERTIONS ----------
                            //
                            if (event.inputType === 'insertText' && event.data) {
                                event.preventDefault()

                                const id = uid()
                                const author = storage.author || that.options.defaultAuthor
                                const color = getReviewColor('insert', author)

                                const insertNode = state.schema.nodes.review.create(
                                    {
                                        mode: 'insert',
                                        id: id,
                                        author,
                                        color,
                                        timestamp: Date.now(),
                                    },
                                    state.schema.text(event.data)
                                )

                                const tr = state.tr.replaceRangeWith(from, to, insertNode)

                                // Move cursor after inserted suggestion node
                                const resolvedPos = tr.doc.resolve(from + insertNode.nodeSize)
                                tr.setSelection(state.selection.constructor.near(resolvedPos))

                                dispatch(tr)
                                return true
                            }

                            return false
                        },
                    },

                    handleKeyDown(view, event) {
                        const editor = (that as any).editor
                        const storage = editor?.storage?.review || { enabled: false }
                        if (!storage.enabled) return false

                        const { state, dispatch } = view
                        const sel = state.selection
                        const { from, to, empty } = sel

                        //
                        // Utility: create safe review delete node (no empty text)
                        //
                        function createDeleteNode(from: number, to: number) {
                            const slice = state.doc.slice(from, to)
                            const deletedText = state.doc.textBetween(from, to)
                            const author = storage.author || that.options.defaultAuthor
                            const color = getReviewColor('delete', author)

                            const attrs = {
                                mode: "delete",
                                id: uid(),
                                author,
                                color,
                                timestamp: Date.now(),
                            }

                            if (slice?.content?.size) {
                                return state.schema.nodes.review.create(attrs, slice.content)
                            }

                            // Avoid empty text-node → ProseMirror crash
                            if (!deletedText) {
                                return state.schema.nodes.review.create(attrs)
                            }

                            return state.schema.nodes.review.create(attrs, state.schema.text(deletedText))
                        }

                        //
                        // ============================================================
                        // MULTI-CHAR DELETE (Backspace/Delete on a selection)
                        // ============================================================
                        //
                        if ((event.key === "Backspace" || event.key === "Delete") && !empty) {
                            event.preventDefault()
                            const ranges: { from: number; to: number; content: any }[] = []
                            state.doc.nodesBetween(from, to, (node, pos) => {
                                if (!node.isTextblock) return
                                const blockFrom = pos + 1
                                const blockTo = pos + node.content.size + 1
                                const sliceFrom = Math.max(from, blockFrom)
                                const sliceTo = Math.min(to, blockTo)
                                if (sliceFrom >= sliceTo) return
                                const slice = state.doc.slice(sliceFrom, sliceTo)
                                ranges.push({ from: sliceFrom, to: sliceTo, content: slice.content })
                            })

                            if (!ranges.length) {
                                const delNode = createDeleteNode(from, to)
                                const tr = state.tr.replaceRangeWith(from, to, delNode)
                                const resolvedPos = tr.doc.resolve(from + delNode.nodeSize)
                                tr.setSelection(state.selection.constructor.near(resolvedPos))
                                dispatch(tr)
                                return true
                            }

                            const tr = state.tr
                            const sorted = [...ranges].sort((a, b) => b.from - a.from)
                            sorted.forEach((range) => {
                                const author = storage.author || that.options.defaultAuthor
                                const color = getReviewColor('delete', author)
                                const delNode = state.schema.nodes.review.create(
                                    {
                                        mode: "delete",
                                        id: uid(),
                                        author,
                                        color,
                                        timestamp: Date.now(),
                                    },
                                    range.content
                                )
                                tr.replaceRangeWith(range.from, range.to, delNode)
                            })

                            const resolvedPos = tr.doc.resolve(Math.max(0, from))
                            tr.setSelection(state.selection.constructor.near(resolvedPos))
                            dispatch(tr)
                            return true
                        }

                        //
                        // ============================================================
                        // SINGLE BACKSPACE
                        // ============================================================
                        //
                        if (event.key === "Backspace" && empty) {
                            const pos = from
                            if (pos === 0) return false
                            event.preventDefault()

                            const nodeBefore = state.selection.$from.nodeBefore
                            const delFrom = nodeBefore?.isAtom ? pos - nodeBefore.nodeSize : pos - 1
                            const delTo = pos

                            const delNode = createDeleteNode(delFrom, delTo)

                            const tr = state.tr.replaceRangeWith(delFrom, delTo, delNode)

                            // Cursor stays at delFrom
                            const resolvedPos = tr.doc.resolve(delFrom)
                            tr.setSelection(state.selection.constructor.near(resolvedPos))

                            dispatch(tr)
                            return true
                        }

                        //
                        // ============================================================
                        // SINGLE DELETE (forward)
                        // ============================================================
                        //
                        if (event.key === "Delete" && empty) {
                            const pos = from
                            if (pos === state.doc.content.size) return false
                            event.preventDefault()

                            const nodeAfter = state.selection.$from.nodeAfter
                            const delFrom = pos
                            const delTo = nodeAfter?.isAtom ? pos + nodeAfter.nodeSize : pos + 1

                            const delNode = createDeleteNode(delFrom, delTo)

                            const tr = state.tr.replaceRangeWith(delFrom, delTo, delNode)

                            // Cursor goes after delNode
                            const resolvedPos = tr.doc.resolve(delFrom + delNode.nodeSize)
                            tr.setSelection(state.selection.constructor.near(resolvedPos))

                            dispatch(tr)
                            return true
                        }

                        return false
                    }


                },

                view(editorView) {
                    ; (that as any).editor = (that as any).editor || (editorView as any).props?.editor || null
                    return {}
                },
            }),
        ]
    },
})
