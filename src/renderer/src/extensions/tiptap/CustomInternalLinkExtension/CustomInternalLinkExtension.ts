/**
 * CustomInternalLinkExtension.ts
 *
 * A Tiptap Mark extension that implements wiki-style internal document linking
 * in the Dynadoc editor. Every [[Link]] becomes a styled inline span that:
 *
 *  • Stores the target document's UUID (fileId) as a data-attribute
 *  • Shows a rich hover-preview popup (off-thread, via Web Worker + IDB cache)
 *  • Opens the file in the active workspace tab on click
 *  • Opens a split view on Alt+Click
 *  • Supports `[[Label|fileId]]` or `[[Label]]` input-rule syntax
 *  • Exposes full command API: setInternalLink / toggleInternalLink / unsetInternalLink
 *  • Integrates a link-picker dialog for toolbar-driven insertion
 *  • Prefetches metadata for all visible links after editor idle (debounced)
 */

import { Mark, mergeAttributes, markInputRule } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { CustomInternalLinkExtensionProps as Props } from './utils/common.utils'
import { internalLinkStore } from './stores/internalLink.store.svelte'
import EditorCommonUtils from '../../../utils/common.utils'

// ─── Type augmentation ────────────────────────────────────────────────────────


// 1. Update the options interface to include Hover boundaries
export interface InternalLinkOptions {
    HTMLAttributes: Record<string, any>;
    /**
     * Called when the user clicks an internal link.
     */
    onClick?: (event: MouseEvent, fileId: string) => void;
    /**
     * Called when the user Alt+Clicks an internal link.
     */
    onAltClick?: (event: MouseEvent, fileId: string) => void;
    /**
     * Called when the user hovers into an internal link mark.
     */
    onHoverIn?: (event: MouseEvent, fileId: string, clientRect: DOMRect) => void;
    /**
     * Called when the user's cursor leaves an internal link mark.
     */
    onHoverOut?: (event: MouseEvent) => void;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        CustomInternalLink: {
            setInternalLink: (attributes: { fileId: string; label?: string }) => ReturnType;
            toggleInternalLink: (attributes: { fileId: string; label?: string }) => ReturnType;
            unsetInternalLink: () => ReturnType;
            openInternalLinkPicker: () => ReturnType;
        };
    }
}

const PLUGIN_KEY = new PluginKey<void>('CustomInternalLinkExtension');
const PREFETCH_IDLE_MS = 1500;

export const CustomInternalLinkExtension = Mark.create<InternalLinkOptions>({
    name: Props.name,
    excludes: '_',
    spanning: true,

    // 2. Add options mapping parameters with default fallback boundaries
    addOptions() {
        return {
            HTMLAttributes: {
                class: Props.cssClass,
                'data-type': Props.dataType,
            },
            onClick: undefined,
            onAltClick: undefined,
            onHoverIn: undefined,
            onHoverOut: undefined,
        };
    },

    addAttributes() {
        return {
            fileId: {
                default: null,
                parseHTML: element => element.getAttribute(Props.attributeFileId),
                renderHTML: attributes => {
                    if (!attributes.fileId) return {};
                    return { [Props.attributeFileId]: attributes.fileId };
                },
            },
            label: {
                default: null,
                parseHTML: element => element.getAttribute(Props.attributeLabel),
                renderHTML: attributes => {
                    if (!attributes.label) return {};
                    return { [Props.attributeLabel]: attributes.label };
                },
            },
        };
    },

    parseHTML() {
        return [
            { tag: `${Props.tagName}[${Props.attributeFileId}]` },
            { tag: `${Props.tagName}[data-type="${Props.dataType}"]` },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [Props.tagName, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setInternalLink: attributes => ({ chain }) =>
                chain().setMark(this.name, attributes).run(),

            toggleInternalLink: attributes => ({ chain }) =>
                chain().toggleMark(this.name, attributes).run(),

            unsetInternalLink: () => ({ chain }) =>
                chain().unsetMark(this.name).run(),

            openInternalLinkPicker: () => ({ chain, editor }) => {
                const { from, to } = editor.state.selection;
                const query = editor.state.doc.textBetween(from, to, ' ').trim();

                internalLinkStore.openPicker(query, (fileId: string, label: string) => {
                    editor
                        .chain()
                        .focus()
                        .setInternalLink({ fileId, label })
                        .run();
                });
                return true;
            },
        };
    },

    addInputRules() {
        return [
            markInputRule({
                find: /\[\[([^\]|]+)\|?([^\]]*)\]\]$/,
                type: this.type,
                getAttributes: match => {
                    const label = match[1]?.trim() ?? '';
                    const fileId = match[2]?.trim() || null;

                    if (fileId) {
                        return { fileId, label };
                    }

                    setTimeout(() => {
                        internalLinkStore.openPicker(label, (resolvedId, resolvedLabel) => {
                            // Picker handled in your Svelte context structure 
                        });
                    }, 0);

                    return { fileId: null, label };
                },
            }),
        ];
    },

    addProseMirrorPlugins() {
        const options = this.options;
        let prefetchTimer: ReturnType<typeof setTimeout> | null = null;

        return [
            new Plugin({
                key: PLUGIN_KEY,
                props: {
                    handleDOMEvents: {
                        // ── Hover In Handler ─────────────────────────
                        mouseover: (_view, event) => {
                            const target = event.target as HTMLElement;
                            const linkEl = target.closest<HTMLElement>(`.${Props.cssClass}`);
                            if (!linkEl) return false;

                            const fileId = linkEl.getAttribute(Props.attributeFileId);
                            if (!fileId) return false;

                            const rect = linkEl.getBoundingClientRect();
                            
                            // 3. If an explicit onHoverIn parameter exists, use it. Otherwise drop to fallback store.
                            if (options.onHoverIn) {
                                options.onHoverIn(event, fileId, rect);
                            } else {
                                internalLinkStore.show(fileId, rect.left, rect.bottom);
                            }
                            return false; 
                        },

                        // ── Hover Out Handler ───────────────────────
                        mouseout: (_view, event) => {
                            const target = event.target as HTMLElement;
                            const leavingLink = target.closest<HTMLElement>(`.${Props.cssClass}`);
                            if (leavingLink) {
                                if (options.onHoverOut) {
                                    options.onHoverOut(event);
                                } else {
                                    internalLinkStore.hide();
                                }
                            }
                            return false;
                        },

                        // ── Click Routing Loop ─────────────────────
                        click: (_view, event) => {
                            const target = event.target as HTMLElement;
                            const linkEl = target.closest<HTMLElement>(`.${Props.cssClass}`);
                            if (!linkEl) return false;

                            event.preventDefault();
                            event.stopPropagation();

                            const fileId = linkEl.getAttribute(Props.attributeFileId);
                            if (!fileId) return true;

                            const win = window as any;

                            if (event.altKey) {
                                if (options.onAltClick) {
                                    options.onAltClick(event, fileId);
                                } else if (win.dynadocApp?.openSplitView) {
                                    win.dynadocApp.openSplitView(fileId);
                                } else {
                                    EditorCommonUtils.openDocumentFromInput(fileId);
                                }
                            } else {
                                // 4. Prioritize configured callback, then default core app actions
                                if (options.onClick) {
                                    options.onClick(event, fileId);
                                } else if (win.dynadocApp?.openFile) {
                                    win.dynadocApp.openFile(fileId);
                                } else {
                                    EditorCommonUtils.openDocumentFromInput(fileId);
                                }
                            }

                            return true;
                        },
                    },
                },

                view(editorView) {
                    return {
                        update(view) {
                            if (!view.state.doc) return;
                            if (prefetchTimer) clearTimeout(prefetchTimer);
                            prefetchTimer = setTimeout(() => {
                                const fileIds: string[] = []
                                view.state.doc.descendants(node => {
                                    if (node.isText) {
                                        node.marks.forEach(mark => {
                                            if (mark.type.name === Props.name) {
                                                const fid = mark.attrs.fileId;
                                                if (fid && !fileIds.includes(fid)) {
                                                    fileIds.push(fid)
                                                }
                                            }
                                        });
                                    }
                                });
                                if (fileIds.length > 0) {
                                    internalLinkStore.schedulePrefetch(fileIds);
                                }
                            }, PREFETCH_IDLE_MS);
                        },
                        destroy() {
                            if (prefetchTimer) clearTimeout(prefetchTimer);
                        },
                    };
                },
            }),
        ];
    },
});