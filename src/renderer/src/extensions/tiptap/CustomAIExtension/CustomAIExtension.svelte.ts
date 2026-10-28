import { Node, mergeAttributes } from '@tiptap/core';
// import { NodeView, } from '@tiptap/pm/view';
import { Extension } from '@tiptap/core'
import Suggestion, { exitSuggestion } from '@tiptap/suggestion'
import { computePosition, shift, flip, offset } from '@floating-ui/dom'
import { v4 as uuidv4 } from 'uuid'

import { PluginKey, Plugin, Transaction } from 'prosemirror-state';
import Fuse from 'fuse.js'


import { mount, unmount } from 'svelte';
import CustomAIExtensionComponent from './components/CustomAIExtensionComponent.svelte';
import CustomAIExtensionDropdown from './components/CustomAIExtensionDropdown.svelte';
import { caption1StrongerClassNames } from '@fluentui/react-components';
import { SvelteNodeViewRenderer } from 'svelte-tiptap';
import { CustomAIExtensionProps } from './utils/common.utils';
import { runAIGeneration, applyAIGenerationResult, type AIGenerationMode } from './utils/aiGeneration';
import CustomAIToolbar from './components/CustomAIToolbar.svelte'
import { AiTrackingPlugin } from './utils/aiTracking'

function posToDOMRect1(view: any, from: number, to: number) {
    const start = view.coordsAtPos(from)
    const end = view.coordsAtPos(to)
    return {
        top: start.top,
        bottom: end.bottom,
        left: start.left,
        right: end.right,
        width: end.right - start.left,
        height: end.bottom - start.top,
    }
}

function posToDOMRect(view: any, from: number, to: number) {
    try {
        const start = view.coordsAtPos(from);
        const end = view.coordsAtPos(to);
        return {
            top: start.top,
            bottom: end.bottom,
            left: start.left,
            right: start.left, // 'right' calculation can be buggy if selection spans lines
            width: 0,
            height: end.bottom - start.top,
        };
    } catch (e) {
        return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
    }
}

async function getMenuPosition1(editor, container) {
    const virtualEl = {
        getBoundingClientRect: () =>
            posToDOMRect(editor.view, editor.state.selection.from, editor.state.selection.to)
    }
    const { x, y } = await computePosition(virtualEl, container, {
        placement: 'bottom-start',
        middleware: [shift(), flip()],
    })
    return { x, y }
}

async function getMenuPosition(editor, container, range) {
    if (!container || !range) return { x: 0, y: 0 };

    // Use the suggestion range (the '@' char) for the coordinates
    // This is more stable than editor.state.selection
    const virtualEl = {
        getBoundingClientRect: () => {
            const start = editor.view.coordsAtPos(range.from);
            const end = editor.view.coordsAtPos(range.to);
            return {
                top: start.top,
                bottom: end.bottom,
                left: start.left,
                right: end.right,
                width: end.right - start.left,
                height: end.bottom - start.top,
                x: start.left,
                y: start.top
            };
        }
    };

    const { x, y } = await computePosition(virtualEl, container, {
        placement: 'bottom-start',
        strategy: 'fixed', // Better for Electron and modals
        middleware: [
            offset(10), // Gap between cursor and menu
            flip({
                padding: 10,
                fallbackPlacements: ['top-start', 'bottom-end', 'top-end'],
            }),
            shift({ padding: 15 })
        ],
    });

    return { x, y };
}

const extensionName = CustomAIExtensionProps.name
const extensionTagName = CustomAIExtensionProps.tagName
// const extensionName = "CustomAIExtension"
// const extensionTagName = "ai"

export interface CustomAIOptions {
    toolbarHTMLContainerRoot: HTMLElement | null
}

export const CustomAIExtension = Node.create<CustomAIOptions>({
    // export const CustomAIExtension = Extension.create({
    name: extensionName,
    // group: 'inline',
    // inline: true,
    inline: false,
    group: 'block',
    atom: false,
    // content: 'inline*', // <-- makes node editable (super important)
    // isolating: false,

    // group: 'block',
    content: 'block+', // Allows <p>, <ul>, etc. inside <ai>
    // inline: false,

    // atom: false is default, but important: 
    // it means the node is NOT a single unit and its content is editable.
    // atom: false, 

    // ensures the node doesn't disappear easily when empty
    // defining: true,
    // isolating: true,

    isolating: false,  // Allows backspacing out of the node
    selectable: true, // Allows clicking the node to select it
    defining: true,

    addOptions() {
        return {
            toolbarHTMLContainerRoot: null
        }
    },

    addAttributes() {
        return {
            id: {
                default: null,
                renderHTML: attributes =>
                    ({ 'data-id': attributes.id || uuidv4() })
            },
            prompt: { default: '' },
            result: { default: '' },
            done: { default: false },
            temperature: { default: 0.7 },
            versions: { default: [] },
            currentVersion: { default: 0 },
        };
    },
    parseHTML() {
        return [{ tag: extensionTagName }];
    },
    renderHTML({ HTMLAttributes }) {
        // return [extensionTagName, mergeAttributes(HTMLAttributes)];
        // IMPORTANT: add "0" to render children (editable content)
        // return [extensionTagName, mergeAttributes(HTMLAttributes), 0];

        // return [extensionName, mergeAttributes(HTMLAttributes)]
        // [tag, attributes, 0] 
        // The "0" is the hole where children (<p> etc) will be rendered
        return [extensionTagName, mergeAttributes(HTMLAttributes), 0];

        // return [extensionTagName, mergeAttributes(HTMLAttributes), ''];
    },

    addNodeView() {
        return SvelteNodeViewRenderer(CustomAIExtensionComponent);
    },

    onCreate({ editor }) {
        const editorHTMLContainerRoot = this.options.toolbarHTMLContainerRoot
        if (!editorHTMLContainerRoot) {
            return
        }

        const container = document.createElement('div')
        container.className = 'ai-toolbar-container'
        // container.className = 'ai-toolbar-container-wrapper'
        editorHTMLContainerRoot.prepend(container)

        const props = $state({ editor })

        const component = mount(CustomAIToolbar, {
            target: container,
            props
        })

        editor.on('destroy', () => {
            if (component) unmount(component)
            container?.remove()
        })
    },
   
    addProseMirrorPlugins() {
        const editor = this.editor

        const suggestionCommand = ({ editor, range, props }) => {
            if (!props) return
            // editor
            //     .chain()
            //     .focus()
            //     .insertContentAt(range, { type: this.name, attrs: { name: props.name, value: props.value } })
            //     .run()

            const mode: AIGenerationMode = props.mode || 'text'

            if (mode === 'text') {
                editor
                    .chain()
                    .focus()
                    // .deleteRange(range) // <-- deletes the matched text
                    .insertContentAt(range, {
                        type: extensionName,
                        attrs: { id: uuidv4(), prompt: props.value },
                        content: [
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: ' ' }]
                            }
                        ]
                    })
                    .run();
                return
            }

            // For non-text generation, remove the trigger text and run AI orchestration
            editor.chain().focus().deleteRange(range).run()

            ;(async () => {
                try {
                    const result = await runAIGeneration(editor, mode, props.value || '', range)
                    await applyAIGenerationResult(editor, result.mode, result.raw)
                } catch (err) {
                    console.error('[AI] generation failed', err)
                    editor
                        .chain()
                        .focus()
                        .insertContent({
                            type: extensionName,
                            attrs: { id: uuidv4(), prompt: props.value || '' },
                            content: [
                                {
                                    type: 'paragraph',
                                    content: [{ type: 'text', text: 'AI generation failed.' }]
                                }
                            ]
                        })
                        .run()
                }
            })()
        }


        const pastePlugin = new Plugin({
            key: new PluginKey("ai-paste-capture"),
            props: {
                handleDOMEvents: {
                    paste(view, event) {
                        const { state } = view;
                        const selectionFrom = state.selection.$from; // Renamed to avoid $ prefix error

                        let targetNode = null;
                        // Search up the tree
                        for (let d = selectionFrom.depth; d > 0; d--) {
                            if (selectionFrom.node(d).type.name === extensionName) {
                                targetNode = selectionFrom.node(d);
                                break;
                            }
                        }

                        // Check node immediately before
                        if (!targetNode && selectionFrom.nodeBefore?.type.name === extensionName) {
                            targetNode = selectionFrom.nodeBefore;
                        }

                        if (targetNode) {
                            event.preventDefault();
                            const pastedText = event.clipboardData?.getData('text/plain') || '';
                            // Use the correct attribute names defined in addAttributes
                            const currentPrompt = targetNode.attrs.prompt || '';

                            suggestionCommand({
                                editor,
                                range: { from: state.selection.from, to: state.selection.to },
                                props: { value: currentPrompt + pastedText }
                            });
                            return true;
                        }
                        return false;
                    },
                },
            },
        });


        let userTriggered = false
        const suggestionPluginKey = new PluginKey('ai-suggestion')

        return [
            AiTrackingPlugin,
            Suggestion({
                editor: this.editor,
                char: '...',
                // char: '#',
                // startOfLine: false,
                pluginKey: suggestionPluginKey,  // unique plugin key

                // matcher: {
                // char: '#',
                allowSpaces: true,
                // startOfLine: false,
                // supportedCharacters: /[\w\s]+/,   // allow words + spaces
                // },
                items: ({ query, editor }) => {
                    console.log("query ", query)


                    /* let r = [{ name: "dd", value: "hello" }]
                    return r
                        .filter(v => v.name.toLowerCase().startsWith(query.toLowerCase()))
                        // .map(v => ({ name: v.name }));
                        .map(v => ({ name: v.name, value: v.value })) // include value here
                 */

                    // query is exactly what the user typed after '#'
                    const userInput = query.trim();
                    // if (!userInput) return []

                    const label = userInput || ''

                    return [
                        {
                            name: `Generate Text: ${label}`,
                            value: userInput,
                            mode: 'text',
                            description: 'Draft paragraphs inside the document.'
                        },
                        {
                            name: `Generate Slides: ${label}`,
                            value: userInput,
                            mode: 'slides',
                            description: 'Create a multi-slide deck.'
                        },
                        {
                            name: `Generate Spreadsheet: ${label}`,
                            value: userInput,
                            mode: 'spreadsheet',
                            description: 'Build a structured table with sheets.'
                        },
                        {
                            name: `Generate Design: ${label}`,
                            value: userInput,
                            mode: 'design',
                            description: 'Create a visual design canvas.'
                        },
                        {
                            name: `Generate LaTeX Project: ${label}`,
                            value: userInput,
                            mode: 'latex',
                            description: 'Create a LaTeX project with main.tex.'
                        }
                    ];

                },



                command: ({ editor, range, props }) => {
                    console.log('yes ai ...')
                    // Replace typed "#prompt" with NodeView
                    // this.editor
                    //     .chain()
                    //     .focus()
                    //     .deleteRange(range)
                    //     .insertContent({
                    //         type: 'CustomAIExtension',
                    //         attrs: { prompt: 'hello' },
                    //         // attrs: { prompt: props.query },
                    //     })
                    //     .run();

                    suggestionCommand({ editor, range, props })

                    /* editor
                        .chain()
                        .focus()
                        .insertContentAt(range, { type: extensionName, attrs: { prompt: 'hello' } })
                        .run(); */
                },

                render: () => {
                    let component: any
                    // let svelteProps = $state({})
                    // reactive state holder
                    let svelteProps = $state({
                        items: [],
                        activeIndex: 0,
                        query: '',
                        position: null,
                        selectItem: (item) => { }
                    })
                    let container: HTMLElement
                    let items: any[] = []
                    let activeIndex = 0
                    let cleanupOutsideHandlers: (() => void) | null = null
                    const editor = this.editor

                    return {
                        onStart: async (props) => {
                            userTriggered = true
                            console.log("sugges render onStart ", props)
                            items = props.items
                            activeIndex = 0

                            container = document.createElement('span')
                            // container = document.createElement('div')
                            document.body.appendChild(container)
                            const handlePointerDown = (event: Event) => {
                                const target = event.target as Node | null
                                if (!target) return
                                if (container?.contains(target)) return
                                if (editor?.view?.dom?.contains(target)) return
                                exitSuggestion(editor.view, suggestionPluginKey)
                            }
                            const handleWindowBlur = () => exitSuggestion(editor.view, suggestionPluginKey)
                            const handleVisibility = () => {
                                if (document.visibilityState !== 'visible') {
                                    exitSuggestion(editor.view, suggestionPluginKey)
                                }
                            }
                            document.addEventListener('pointerdown', handlePointerDown, true)
                            window.addEventListener('blur', handleWindowBlur)
                            document.addEventListener('visibilitychange', handleVisibility)
                            cleanupOutsideHandlers = () => {
                                document.removeEventListener('pointerdown', handlePointerDown, true)
                                window.removeEventListener('blur', handleWindowBlur)
                                document.removeEventListener('visibilitychange', handleVisibility)
                            }

                            // Create reactive props object
                            /* svelteProps = {
                                // const svelteProps = $state({
                                items,
                                activeIndex,
                                query: props.query,
                                position: await getMenuPosition(editor, container),
                                selectItem: (item) => {
                                    suggestionCommand({ editor, range: props.range, props: item })
                                }
                            } */
                            // update reactive props
                            svelteProps.items = items
                            svelteProps.activeIndex = activeIndex
                            svelteProps.query = props.query
                            // svelteProps.position = await getMenuPosition(editor, container)
                            // svelteProps.position = await getMenuPosition(editor, container)
                            svelteProps.selectItem = (item) => {
                                suggestionCommand({ editor, range: props.range, props: item })
                            }


                            component = mount(CustomAIExtensionDropdown, {
                                target: container,
                                props: svelteProps
                                /* {
                                    items,
                                    activeIndex,
                                    query: props.query,
                                    position: await getMenuPosition(editor, container),
                                    selectItem: (item) => {
                                        suggestionCommand({ editor, range: props.range, props: item })
                                    } 
    
                            }*/
                            })

                            // WAIT for Svelte to paint, then calculate position
                            requestAnimationFrame(async () => {
                                const pos = await getMenuPosition(editor, container.firstElementChild, props.range);
                                svelteProps.position = pos;
                            });
                        },

                        onUpdate: async (props) => {
                            console.log("sugges render onUpdate ", props)

                            items = props.items
                            activeIndex = Math.min(activeIndex, items.length - 1)
                            // component.$set({
                            /* svelteProps = {
                                items,
                                activeIndex,
                                query: props.query,
                                position: await getMenuPosition(editor, container)
                            } */
                            // Update component props reactively
                            // update reactive props
                            svelteProps.items = items
                            svelteProps.activeIndex = activeIndex
                            svelteProps.query = props.query
                            // svelteProps.position = await getMenuPosition(editor, container)
                            svelteProps.selectItem = (item) => {
                                suggestionCommand({ editor, range: props.range, props: item })
                            }
                            // component.$set(svelteProps)
                            // )
                            // Recalculate on every keystroke/update
                            const pos = await getMenuPosition(editor, container.firstElementChild, props.range);
                            svelteProps.position = pos;
                        },

                        onKeyDown: (props) => {
                            console.log("sugges render onKeyDown ", props)

                            if (props.event.key === 'ArrowDown') {
                                activeIndex = (activeIndex + 1) % items.length
                                // component.$set({ activeIndex })
                                svelteProps.activeIndex = activeIndex
                                return true
                            }
                            if (props.event.key === 'ArrowUp') {
                                activeIndex = (activeIndex - 1 + items.length) % items.length
                                // component.$set({ activeIndex })
                                svelteProps.activeIndex = activeIndex
                                return true
                            }
                            if (props.event.key === 'Enter') {
                                const item = items[activeIndex]
                                suggestionCommand({ editor, range: props.range, props: item })
                                return true
                            }
                            return false
                        },

                        onExit: () => {
                            // component?.$destroy()
                            if (component) unmount(component)
                            container?.remove()
                            cleanupOutsideHandlers?.()
                            cleanupOutsideHandlers = null
                            userTriggered = false
                        },
                    }
                },
                /* shouldShow: ({ query, transaction }) => {
                    if (!query || query.trim().length === 0) return false
                    if (userTriggered) return true
                    return transaction?.docChanged === true
                }, */
            }),
            pastePlugin
        ];
    },
});
