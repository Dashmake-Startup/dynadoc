import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { CustomGrammarCheckExtensionProps } from './utils/common.utils'
import { debounce } from 'lodash'
import { mount, unmount } from 'svelte'
import {
  defaultGrammarSettings,
  loadGrammarSettings,
  persistGrammarSettings,
  type GrammarSettings
} from './utils/grammarSettings'
import Platform from '../../../libs/platform'
import GrammarCheckWidget from './components/GrammarCheckWidget.svelte'

export interface CustomGrammarCheckExtensionOptions {
    matches: Map<string, any>;
    docKey?: string;
    toolbarHTMLContainerRoot?: HTMLElement | null;
}
const defaultOptions: CustomGrammarCheckExtensionOptions = {
    matches: new Map(),
    docKey: '',
    toolbarHTMLContainerRoot: null
}


declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        CustomGrammarCheckExtension: {
            //   getAllNodePageIndexes: (nodeViewWrapperClassList: string[]) => ReturnType;
        };
    }
    interface Storage {
        CustomGrammarCheckExtension: CustomGrammarCheckExtensionOptions
    }
}


const ACCESS_TOKEN_KEY = 'ddoc.access_token'

function getStoredAccessToken(): string {
    try {
        if (typeof localStorage === 'undefined') return ''
        return String(localStorage.getItem(ACCESS_TOKEN_KEY) || '')
    } catch {
        return ''
    }
}

async function resolveAccessToken(): Promise<string> {
    const token = getStoredAccessToken()
    if (token) return token
    try {
        const session = await (window as any)?.server?.auth?.getSession?.()
        const accessToken = session?.accessToken || session?.session?.accessToken || ''
        return typeof accessToken === 'string' ? accessToken : ''
    } catch {
        return getStoredAccessToken()
    }
}

export const CustomGrammarCheckExtension = Extension.create({
    name: CustomGrammarCheckExtensionProps.name,

    addOptions() {
        return defaultOptions
    },

    addStorage() {
        return {
            ...defaultOptions,
            ignoredMatchKeys: new Set<string>(),
            settings: defaultGrammarSettings(),
            status: { running: false, progress: 0, lastError: '' }
        } as any
    },

    onCreate({ editor }) {
        const editorHTMLContainerRoot = this.options.toolbarHTMLContainerRoot
        if (!editorHTMLContainerRoot) {
            return
        }

        const container = document.createElement('div')
        container.className = 'grammar-check-container'
        editorHTMLContainerRoot.appendChild(container)

        const props = { editor }
        const component = mount(GrammarCheckWidget, {
            target: container,
            props,
        })

        editor.on('destroy', () => {
            if (component) unmount(component)
            container?.remove()
        })
    },

    addProseMirrorPlugins() {
        const worker = new Worker(new URL('./workers/grammar.worker.ts', import.meta.url), {
            type: 'module'
        });

        const key = new PluginKey(CustomGrammarCheckExtensionProps.name);
        let debounceTimer: any = null;

        const resolveId = (node: any) =>
            node?.attrs?.uid || node?.attrs?.uuid || node?.attrs?.id || node?.attrs?.['data-uuid'] || ''

        const collectBlockNodes = (doc: any) => {
            const blocks: Array<{ id: string, text: string }> = []
            doc.descendants((node: any) => {
                if (!['paragraph', 'heading', 'listItem'].includes(node.type.name)) return
                const id = resolveId(node)
                if (!id) return
                blocks.push({ id: String(id), text: String(node.textContent || '') })
            })
            return blocks
        }

        const getPriorityParagraphs = (view: any) => {
            const blocks = collectBlockNodes(view.state.doc)
            if (!blocks.length) return { active: [], background: [] }

            const { from } = view.state.selection
            // Find the block containing selection by scanning descendants with positions.
            let activeId = ''
            view.state.doc.descendants((node: any, pos: number) => {
                if (activeId) return false
                if (!['paragraph', 'heading', 'listItem'].includes(node.type.name)) return
                const id = resolveId(node)
                if (!id) return
                const start = pos + 1
                const end = start + node.content.size
                if (from >= start && from <= end) {
                    activeId = String(id)
                    return false
                }
            })

            // Approximate viewport: 50 blocks around the active one.
            const idx = activeId ? blocks.findIndex((b) => b.id === activeId) : 0
            const start = Math.max(0, idx - 50)
            const end = Math.min(blocks.length, idx + 50)
            const activeSlice = blocks.slice(start, end).map((b) => ({ ...b, active: b.id === activeId }))
            const activeIds = new Set(activeSlice.map((b: any) => b.id))
            const background = blocks.filter((b) => !activeIds.has(b.id)).map((b) => ({ ...b, active: false }))
            return { active: activeSlice, background }
        }

        const sendToWorker = async (payload: any) => {
            const accessToken = await resolveAccessToken()
            // Web/mobile grammar endpoint requires auth; avoid spamming the backend with empty tokens.
            if (!Platform.isDesktopPlatform && !accessToken) {
                ;(this.storage as any).status = {
                    ...(this.storage as any).status,
                    running: false,
                    lastError: 'AUTH_REQUIRED'
                }
                return
            }
            const docKey = String(this.options?.docKey || this.storage?.docKey || 'default')
            const settings: GrammarSettings = (this.storage as any)?.settings || loadGrammarSettings(docKey)
            const ignoredMatchKeys = Array.from(((this.storage as any)?.ignoredMatchKeys as Set<string>) || [])
            const userLang =
                (typeof navigator !== 'undefined' &&
                    ((navigator.languages && navigator.languages[0]) || navigator.language)) ||
                'en-US'
            worker.postMessage({
                ...payload,
                accessToken,
                options: {
                    requestId: payload?.requestId,
                    docLang: settings?.docLang || '',
                    userLang,
                    preferredLanguages: settings?.preferredLanguages || '',
                    mode: settings?.mode || 'picky',
                    level: settings?.mode === 'standard' ? 'default' : 'picky',
                    disabledRules: settings?.disabledRules || [],
                    enabledRules: settings?.enabledRules || [],
                    ignoredMatchKeys
                }
            })
        }

        // Debounce grammar checking for professional UX
        const debouncedCheck = debounce((view) => {
            const { active, background } = getPriorityParagraphs(view)
            if (!active.length && !background.length) return
            const requestId = `g-${Date.now()}`
            ;(this.storage as any).status = { ...(this.storage as any).status, running: true, progress: 0 }
            void sendToWorker({ paragraphs: active, requestId })

            // Background scan in idle time (keeps huge docs responsive)
            const bg = background
            if (bg.length) {
                const runBg = () => void sendToWorker({ paragraphs: bg.slice(0, 200), requestId: `${requestId}:bg` })
                if (typeof (window as any).requestIdleCallback === 'function') {
                    ;(window as any).requestIdleCallback(runBg, { timeout: 2500 })
                } else {
                    setTimeout(runBg, 800)
                }
            }
        }, 800)

        worker.onmessage = (e) => {
            const payload = e.data || {}
            const results = Array.isArray(payload?.results) ? payload.results : []
            const progress = typeof payload?.progress === 'number' ? payload.progress : null

            results.forEach((res: any) => {
                this.storage.matches.set(res.id, Array.isArray(res.matches) ? res.matches : [])
            })

            if (progress != null) {
                ;(this.storage as any).status = { ...(this.storage as any).status, progress }
            }
            ;(this.storage as any).status = { ...(this.storage as any).status, running: false }

            this.editor.view.dispatch(this.editor.state.tr.setMeta('ltUpdate', true))
        }

        const docKey = String(this.options?.docKey || '')
        if (docKey) {
            ;(this.storage as any).docKey = docKey
            ;(this.storage as any).settings = loadGrammarSettings(docKey)
            const ignored = new Set<string>(
                Array.isArray((this.storage as any).settings?.ignoredMatchKeys)
                    ? (this.storage as any).settings.ignoredMatchKeys
                    : []
            )
            ;(this.storage as any).ignoredMatchKeys = ignored
        }

        const persistSettings = () => {
            const key = String((this.storage as any)?.docKey || this.options?.docKey || '')
            if (!key) return
            const settings: GrammarSettings = (this.storage as any).settings || defaultGrammarSettings()
            const ignored = Array.from(((this.storage as any)?.ignoredMatchKeys as Set<string>) || [])
            persistGrammarSettings(key, { ...settings, ignoredMatchKeys: ignored })
        }

        const onIgnore = (event: any) => {
            const detail = event?.detail || {}
            const key = String(detail?.docKey || (this.storage as any)?.docKey || '')
            if (!key || key !== String((this.storage as any)?.docKey || '')) return
            const matchKey = String(detail?.matchKey || '').trim()
            if (!matchKey) return
            ;((this.storage as any).ignoredMatchKeys as Set<string>).add(matchKey)
            persistSettings()
            this.editor.view.dispatch(this.editor.state.tr.setMeta('ltUpdate', true))
        }

        const onSettings = (event: any) => {
            const detail = event?.detail || {}
            const key = String(detail?.docKey || (this.storage as any)?.docKey || '')
            if (!key || key !== String((this.storage as any)?.docKey || '')) return
            const next = detail?.settings
            if (!next || typeof next !== 'object') return
            ;(this.storage as any).settings = { ...(this.storage as any).settings, ...next }
            persistSettings()
            debouncedCheck(this.editor.view)
        }

        if (typeof window !== 'undefined') {
            window.addEventListener('dynadoc:grammar-ignore', onIgnore as any)
            window.addEventListener('dynadoc:grammar-settings', onSettings as any)
        }

        return [
            new Plugin({
                key,
                view: (view) => {
                    // FORCE CHECK ON LOAD
                    const { active, background } = getPriorityParagraphs(view)
                    const initialNodes = active.concat(background.slice(0, 120))
                    if (initialNodes.length > 0) void sendToWorker({ paragraphs: initialNodes, requestId: `g-${Date.now()}` })

                    return {
                        update: (view, prevState) => {
                            if (view.state.doc.eq(prevState.doc)) return;
                            debouncedCheck(view);
                        },
                        destroy: () => {
                            debouncedCheck.cancel();
                            worker.terminate();
                            if (typeof window !== 'undefined') {
                                window.removeEventListener('dynadoc:grammar-ignore', onIgnore as any)
                                window.removeEventListener('dynadoc:grammar-settings', onSettings as any)
                            }
                        }
                    };
                },
                state: {
                    init: () => DecorationSet.empty,
                    apply: (tr, oldSet) => {
                        const matches = this.storage.matches;
                        let set = oldSet.map(tr.mapping, tr.doc);

                        if (tr.getMeta('ltUpdate')) {
                            const decos: Decoration[] = [];
                            tr.doc.descendants((node, pos) => {
                                const id = resolveId(node)
                                if (id && matches.has(id)) {
                                    const pgMatches = matches.get(id) || [];
                                    const ignored = (this.storage as any)?.ignoredMatchKeys as Set<string> | undefined
                                    pgMatches.forEach((m: any) => {
                                        const matchKey = String(m?.matchKey || '')
                                        if (ignored && matchKey && ignored.has(matchKey)) return
                                        // pos + 1 to account for the node start token
                                        decos.push(Decoration.inline(pos + 1 + m.offset, pos + 1 + m.offset + m.length, {
                                            class: 'lt-error-underline',
                                            'data-msg': m.message,
                                            'data-match-key': matchKey
                                        }));
                                    });
                                }
                            });

                            // Apply Ghost Preview Decoration
                            // Add Ghost Text Decoration if it exists in Meta
                            const ghost = tr.getMeta('ghostUpdate');
                            if (ghost) {
                                decos.push(Decoration.inline(ghost.from, ghost.to, {
                                    class: 'ghost-preview-text',
                                    'data-replacement': ghost.text
                                }));
                            }

                            set = DecorationSet.create(tr.doc, decos);
                        }
                        return set;
                    }
                },
                props: {
                    decorations(state) { return this.getState(state); }
                }
            })
        ];
    }
}); 
