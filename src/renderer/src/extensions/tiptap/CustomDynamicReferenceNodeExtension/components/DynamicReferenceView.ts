
import { refEvents, uuidIndexerKey } from "../CustomDynamicReferenceNodeExtension.svelte";

import { mount, unmount } from 'svelte';
import { DYNAMIC_REFERENCE_RENDERING_NODE_COMPONENT_MAP } from "../utils/utils";
import { get } from "svelte/store";
import { _$_wysiwygEditorDynamicReferenceAllNodesIndex } from "../stores/common.store";
import { _$_wysiwygEditorsList } from "../../../../stores/editor.store";
import { DOMSerializer } from "prosemirror-model";
import { CustomVarExtensionProps } from "../../CustomVarExtension/utils/common.utils";
import { getVariable, onVariableChange } from "../../CustomVarExtension/stores/variableManipulator";
import { getVariableDisplayValue } from "../../CustomVarExtension/utils/variableDisplay.utils";
import FileRenderer from "../../../fileRenderers/FileRenderer.svelte";
import { CustomFileExtensionProps } from "../../CustomFileFolderExtension/utils/common.utils";
// export const DYNAMIC_REFERENCE_RENDERING_NODE_COMPONENT_MAP: Record<string, any> = {
//     [CustomSlideExtensionProps.name]: CustomSlideExtensionProps.nodeViewComponent,
//     [CustomSpreadsheetExtensionProps.name]: CustomSpreadsheetExtensionProps.nodeViewComponent,
//     [CustomVarExtensionProps.name]: CustomVarExtensionProps.nodeViewComponent,
//       'aiExtension': CustomAIExtension,
// };




const REF_TEMPLATE = document.createElement('template');
REF_TEMPLATE.innerHTML = `
  <span class="theme-mirror-root group relative items-baseline mx-0.5">
    <span class="theme-context-badge pointer-events-none absolute -top-10 left-0 z-50 
                flex items-center gap-2 whitespace-nowrap rounded-md 
                bg-[#2a2a2a] px-2.5 py-1.5 text-[10px] font-bold text-base-content/90 
                opacity-0 transition-all duration-200 group-hover:opacity-100 ring-1 ring-white/10">
     <i class="ph-bold ph-map-pin text-primary"></i>
      <span class="context-text uppercase tracking-widest">Scanning...</span>
      <span class="absolute -bottom-1 left-3 h-2 w-2 rotate-45 bg-[#2a2a2a] border-r border-b border-white/10"></span>
    </span>

    <span class="dynamic-reference-container items-center gap-1 px-0.5 py-0.5 
                 rounded bg-primary/10 border border-primary/20 
                 transition-all hover:bg-primary/20 hover:border-primary/40 cursor-pointer">
       <!--<i class="ph-bold ph-link-simple text-[10px] opacity-40 group-hover:opacity-100"></i>-->
      
      <span class="content-area mirror-content-locked 
                   [&_p]:!inline [&_p]:!m-0 [&_p]:!p-0 [&_p]:text-inherit [&_p]:font-inherit 
                    opacity-95 leading-none"></span>
    </span>
  </span>
`;

/* 
<span class="content-area mirror-content-locked 
                   [&_*]:!inline [&_*]:!m-0 [&_*]:!p-0 [&_*]:text-inherit [&_*]:font-inherit 
                    opacity-95 leading-none"></span>
*/


const observerRegistry = new Map<Element | null, IntersectionObserver>();
const editorUpdateRegistry = new WeakMap<any, { count: number; handler: (payload: any) => void }>();
const renderQueue = new Set<DynamicReferenceView>();
let renderQueueRaf: number | null = null;

const flushRenderQueue = () => {
    renderQueueRaf = null;
    const start = performance.now();
    const maxTime = 6; // ms per frame budget
    const items = Array.from(renderQueue);
    renderQueue.clear();
    for (let i = 0; i < items.length; i += 1) {
        const view = items[i];
        view._flushQueuedRender();
        if (performance.now() - start > maxTime) {
            for (let j = i + 1; j < items.length; j += 1) {
                renderQueue.add(items[j]);
            }
            renderQueueRaf = requestAnimationFrame(flushRenderQueue);
            break;
        }
    }
};

const scheduleRender = (view: DynamicReferenceView) => {
    renderQueue.add(view);
    if (renderQueueRaf) return;
    renderQueueRaf = requestAnimationFrame(flushRenderQueue);
};

const registerEditorUpdateListener = (editor: any) => {
    if (!editor?.on) return;
    const entry = editorUpdateRegistry.get(editor);
    if (entry) {
        entry.count += 1;
        return;
    }
    const handler = ({ editor: updatedEditor, transaction }: any) => {
        if (!transaction?.docChanged) return;
        refEvents.dispatchEvent(new CustomEvent('editor-update', { detail: { editor: updatedEditor } }));
    };
    editor.on('update', handler);
    editorUpdateRegistry.set(editor, { count: 1, handler });
};

const unregisterEditorUpdateListener = (editor: any) => {
    if (!editor?.off) return;
    const entry = editorUpdateRegistry.get(editor);
    if (!entry) return;
    entry.count -= 1;
    if (entry.count <= 0) {
        editor.off('update', entry.handler);
        editorUpdateRegistry.delete(editor);
    }
};

const findScrollParent = (element: HTMLElement | null): HTMLElement | null => {
    let current = element?.parentElement || null;
    while (current) {
        const style = window.getComputedStyle(current);
        const overflow = `${style.overflow} ${style.overflowY} ${style.overflowX}`;
        if (/(auto|scroll|overlay)/.test(overflow)) return current;
        current = current.parentElement;
    }
    return null;
};

const getObserverForRoot = (root: Element | null) => {
    if (observerRegistry.has(root)) return observerRegistry.get(root)!;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const nodeView = (entry.target as any).__nodeView;
            if (!nodeView) return;
            nodeView.isVisible = entry.isIntersecting;
            if (entry.isIntersecting) nodeView.queueRender();
        });
    }, { rootMargin: '400px', root: root || null });
    observerRegistry.set(root, observer);
    return observer;
};

export class DynamicReferenceView {
    dom: HTMLElement;
    contentArea: HTMLElement;
    contextText: HTMLElement;
    uuid: string;
    view: any;
    editor: any;
    isVisible = false;
    node: any;
    mountedComponent: any = null;
    private viewObserver: IntersectionObserver | null = null;
    private pendingData: any = null;
    private rafId: number | null = null;
    private variableUnsubscribe: (() => void) | null = null;
    private variableTokenIds = new Set<string>();
    private hasIndexData = true;
    private lastHtml = '';
    private lastRenderKey = '';
    private lastRenderMode: 'component' | 'file' | 'html' | '' = '';
    private lastFileSrc = '';
    private hasEverRendered = false;
    private lastFallbackAt = 0;
    private filePreviewActive = false;
    private isFileReference = false;
    private pendingFileSrc = '';

    private unsubscribe: () => void;

    constructor(node: any, editor: any) {
        this.node = node;
        this.editor = editor;
        this.view = editor.view;
        const src = node.attrs.src || '';
        this.uuid = src.includes('#') ? src.split('#')[1] : src;

        const clone = REF_TEMPLATE.content.cloneNode(true) as HTMLElement;
        this.dom = clone.querySelector('.theme-mirror-root')!;
        this.contentArea = clone.querySelector('.content-area')!;
        this.contextText = clone.querySelector('.context-text')!;

        // 1. Interaction: Jump to Source
        const jump = (e: MouseEvent) => {
            if (e.type === 'dblclick' || e.ctrlKey || e.metaKey) {
                e.preventDefault();
                this.editor.commands.scrollToNode(this.uuid);
            }
        };
        // this.dom.addEventListener('click', jump);
        // this.dom.addEventListener('dblclick', jump);

        this.dom.addEventListener('click', (e) => this.jumpToSource(e));
        this.dom.addEventListener('dblclick', (e) => this.jumpToSource(e));


        // 2. Metadata Lookup on Hover
        this.dom.addEventListener('mouseenter', () => this.updateContextInfo());

        // 3. Observer Link
        (this.dom as any).__nodeView = this;
        const root = findScrollParent(this.view?.dom) || null;
        this.viewObserver = getObserverForRoot(root);
        this.viewObserver.observe(this.dom);

        // 4. Update Event Listener
        /* this._handleUpdate = (e: any) => {
            if (e.detail.id === this.uuid) {
                this.triggerFlash();
                this.render();
            }
        }; */

        this._handleUpdate = (e: any) => {
            if (e.detail?.id === this.uuid) {
                this.triggerFlash();
                this.render(e.detail);
            }
        };
        refEvents.addEventListener('update', this._handleUpdate);

        this._handleEditorUpdate = (e: any) => {
            if (!this.isVisible) return;
            if (!e?.detail?.editor || e.detail.editor !== this.editor) return;
            if (this.hasIndexData) return;
            this.queueRender();
        };
        refEvents.addEventListener('editor-update', this._handleEditorUpdate);

        // ENHANCED: Selection Change Handler with Node Deletion Cleanup
        this._handleSelectionChange = (e: any) => {
            if (!this.isVisible) return;
            if (!e?.detail?.editor || e.detail.editor !== this.editor) return;
            // Force re-render to show newly created nodes
            this.queueRender();
        };
        refEvents.addEventListener('selection-change', this._handleSelectionChange);

        // INNOVATIVE: Node Deletion Handler
        // Cleans up variables associated with deleted asset nodes
        this._handleNodeDeleted = (e: any) => {
            const { uuid, nodeType, editorId } = e.detail || {};
            if (!uuid || editorId !== this.editor?.extensionManager?.extensions?.find?.(ext => ext.name === 'customDynamicReferenceNodeExtension')?.options?.editorId) {
                return;
            }
            // Cleanup: This will be handled by the extension to delete vars.json entries
            // The event is dispatched for centralized handling
        };
        refEvents.addEventListener('node-deleted', this._handleNodeDeleted);

        registerEditorUpdateListener(this.editor);
        this.render();
    }

    private _handleUpdate = (e: any) => {
        if (e.detail?.id === this.uuid) {
            this.render(e.detail);
        }
    };
    private _handleEditorUpdate = (e: any) => {
        if (e.detail?.editor === this.editor && !this.hasIndexData) {
            this.queueRender();
        }
    };
    private _handleSelectionChange = (e: any) => {
        if (e.detail?.editor === this.editor) {
            this.queueRender();
        }
    };

    private focusEditor = (editorId: string, uuid: string) => {
        console.log(`🎯 Navigating to Editor: ${editorId}, Node: ${uuid}`);

        // 1. Find the editor instance in our registry
        const targetEditor = get(_$_wysiwygEditorsList.get(editorId));
        // const targetEditor = editorInstances.get(editorId);

        if (!targetEditor) {
            console.warn(`Editor ${editorId} is not currently active or mounted.`);
            return;
        }

        // 2. If you use a Tab System (Svelte), trigger a tab switch first
        // This assumes you have a store tracking the active tab
        // activeTabStore.set(editorId);

        // 3. Use requestAnimationFrame to ensure the tab has rendered 
        // before attempting to scroll
        requestAnimationFrame(() => {
            targetEditor.commands.focus();

            // Execute the scroll command (which we previously defined)
            if (targetEditor.commands.scrollToNode) {
                targetEditor.commands.scrollToNode(uuid);
            }

            // 4. INNOVATIVE: Temporary "Target Flash"
            // Find the node in the DOM and give it a quick CSS animation
            const domNode = targetEditor.view.dom.querySelector(`[data-uuid="${uuid}"], [id="${uuid}"]`);
            if (domNode) {
                domNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
                domNode.classList.add('jump-highlight');
                setTimeout(() => domNode.classList.remove('jump-highlight'), 2000);
            }
        });
    };

    private triggerFlash() {
        const target = this.dom.querySelector('.dynamic-reference-container');
        target?.classList.remove('update-flash');
        target?.offsetWidth; // Force reflow
        target?.classList.add('update-flash');
    }



    private jumpToSource = (e: MouseEvent) => {
        if (!e.ctrlKey && !e.metaKey && e.type === 'click') {
            if (this.isFileReference && !this.filePreviewActive) {
                this.filePreviewActive = true;
                this.queueRender();
                return;
            }
            if (this.isFileReference && this.filePreviewActive && e.altKey) {
                this.filePreviewActive = false;
                this.queueRender();
                return;
            }
        }
        if (e.type === 'dblclick' || e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();

            // Check global index to see which editor owns this UUID
            const globalData = get(_$_wysiwygEditorDynamicReferenceAllNodesIndex).get(this.uuid);


            if (globalData && globalData.id) {
                // If you have a global focus function, use it here
                // e.g., window.focusEditor(globalData.editorId, this.uuid);
                console.log(`Jumping to UUID ${this.uuid} in Editor ${globalData.id}`);
                this.focusEditor(globalData.id, this.uuid)
            } else {
                this.editor.commands.scrollToNode(this.uuid);
            }
        }

        if (e.type === 'dblclick' || e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();

            // Execute the scrollToNode command we defined in the extension
            if (this.editor?.commands?.scrollToNode) {
                this.editor.commands.scrollToNode(this.uuid);
            }
        }
    };

    private queueRender(providedData?: any) {
        if (providedData) {
            this.render(providedData);
            return;
        }
        if (!this.isVisible && this.hasEverRendered) return;
        if (this.rafId) return;
        this.rafId = 1;
        scheduleRender(this);
    }

    _flushQueuedRender() {
        this.rafId = null;
        if (!this.isVisible && this.hasEverRendered) return;
        this.render(this.pendingData);
        this.pendingData = null;
    }

    private attachVariableListener(varId: string) {
        this.setVariableTokenIds(new Set([varId]));
    }

    private detachVariableListener() {
        if (this.variableUnsubscribe) {
            this.variableUnsubscribe();
            this.variableUnsubscribe = null;
        }
    }

    private ensureVariableListener() {
        if (this.variableUnsubscribe) return;
        this.variableUnsubscribe = onVariableChange((name) => {
            if (this.variableTokenIds.has(name)) this.queueRender();
        });
    }

    private setVariableTokenIds(ids: Set<string>) {
        this.variableTokenIds = ids;
        if (ids.size > 0) {
            this.ensureVariableListener();
        } else {
            this.detachVariableListener();
        }
    }

    private resolveVariableTokensInHtml(rawHtml: string, editorId?: string | null) {
        const tokens = new Set<string>();
        if (!rawHtml || rawHtml.indexOf('{') === -1) {
            return { html: rawHtml || '', tokens };
        }
        const replacedHtml = rawHtml.replace(/\{([^}]+)\}/g, (full, id) => {
            const varId = String(id || '').trim();
            if (!varId) return full;
            tokens.add(varId);
            const raw = getVariable(varId, editorId || '', false);
            const value = getVariable(varId, editorId || '', true);
            const display =
                getVariableDisplayValue({ value, rawValue: raw }, { plainText: false }) || varId;
            return `<span class="variable-reference" data-var-id="${varId}">${display}</span>`;
        });
        return { html: replacedHtml, tokens };
    }

    private refreshVariableSpans(html: string, editorId?: string | null) {
        if (!html || html.indexOf('data-var-id=') === -1) {
            return html;
        }
        return html.replace(
            /<span class="variable-reference"[^>]*data-var-id="([^"]+)"[^>]*>.*?<\/span>/g,
            (_full, id) => {
                const varId = String(id || '').trim();
                if (!varId) return _full;
                const raw = getVariable(varId, editorId || '', false);
                const value = getVariable(varId, editorId || '', true);
                const display =
                    getVariableDisplayValue({ value, rawValue: raw }, { plainText: false }) || varId;
                return `<span class="variable-reference" data-var-id="${varId}">${display}</span>`;
            }
        );
    }

    private findSourceNodeData() {
        const editors = _$_wysiwygEditorsList.getList();
        for (const entry of editors) {
            const editor = entry?.editor;
            const doc = editor?.state?.doc;
            if (!doc) continue;
            let foundNode: any = null;
            doc.descendants((node) => {
                const id = node.attrs?.uuid || node.attrs?.id || node.attrs?.['data-uuid'];
                if (id === this.uuid) {
                    foundNode = node;
                    return false;
                }
                return true;
            });
            if (!foundNode) continue;
            let html = '';
            let plainText = foundNode.textContent || '';
            let src: string | undefined = undefined;
            if (foundNode.type.name === CustomVarExtensionProps.name) {
                const varId = this.uuid;
                const raw = getVariable(varId, entry?.id, false);
                const value = getVariable(varId, entry?.id, true);
                const display =
                    getVariableDisplayValue({ value, rawValue: raw }, { plainText: true }) || varId;
                plainText = display;
                html = `<span class="variable-reference" data-var-id="${varId}">${display}</span>`;
            } else if (foundNode.type.name === CustomFileExtensionProps.name) {
                src = foundNode.attrs?.[CustomFileExtensionProps.attributeSrc] || foundNode.attrs?.src;
                const serializer = DOMSerializer.fromSchema(editor.schema);
                const wrapper = document.createElement('div');
                wrapper.appendChild(serializer.serializeNode(foundNode));
                html = wrapper.innerHTML;
            } else {
                const serializer = DOMSerializer.fromSchema(editor.schema);
                const wrapper = document.createElement('div');
                wrapper.appendChild(serializer.serializeNode(foundNode));
                html = wrapper.innerHTML;
            }
            return {
                id: this.uuid,
                html,
                rawHtml: html,
                text: `${foundNode.type.name} ${plainText}`.toLowerCase(),
                display: plainText.substring(0, 50),
                type: foundNode.type.name,
                node: foundNode,
                src,
                editorId: entry?.id
            };
        }
        return null;
    }

    render(providedData?: any) {
        if (!this.isVisible && this.hasEverRendered) return;
        this.hasEverRendered = true;

        // 1. Get Data: Priority: Provided -> Local Doc -> Global Store
        let data = providedData || this.pendingData;
        this.pendingData = null;
        let dataSource: 'index' | 'global' | 'fallback' | null = null;

        if (!data) {
            const localIndex = uuidIndexerKey.getState(this.view.state);
            data = localIndex?.get(this.uuid);
            if (data) dataSource = 'index';
        }

        if (!data) {
            data = get(_$_wysiwygEditorDynamicReferenceAllNodesIndex).get(this.uuid);
            if (data) dataSource = 'global';
        }

        if (!data) {
            const now = performance.now();
            // if (now - this.lastFallbackAt > 250) {
            this.lastFallbackAt = now;
            data = this.findSourceNodeData();
            if (data) dataSource = 'fallback';
            // }
        }
        this.hasIndexData = dataSource !== 'fallback';
        // return

        if (data) {
            const isVariable = data.type === CustomVarExtensionProps.name;
            const isFile = data.type === CustomFileExtensionProps.name;
            const ComponentClass = !isVariable && !isFile
                ? DYNAMIC_REFERENCE_RENDERING_NODE_COMPONENT_MAP[data.type]
                : null;

            const renderKey = `${data.type}|${data.id}|${data.text || ''}|${data.display || ''}`;
            this.isFileReference = isFile;
            this.pendingFileSrc = isFile ? (data.src || data.id || '') : '';
            if (!isFile) this.filePreviewActive = false;

            if (ComponentClass) {
                // return
                if (this.lastRenderMode !== 'component' || this.lastRenderKey !== renderKey) {
                    this.setVariableTokenIds(new Set());
                    this.unmountSvelte();
                    this.lastHtml = '';
                    this.mountedComponent = mount(ComponentClass, {
                        target: this.contentArea,
                        props: {
                            node: data.node || { attrs: { uuid: this.uuid }, type: { name: data.type } },
                            editor: this.editor,
                            isMirror: true,
                            useNodeViewWrapper: false
                        }
                    });
                    this.lastRenderMode = 'component';
                }
            } else if (isFile) {
                const src = this.pendingFileSrc;
                if (!this.filePreviewActive) {
                    this.setVariableTokenIds(new Set());
                    if (this.mountedComponent) this.unmountSvelte();
                    const label = data.display || String(src || '').split(/[\\/]/).pop() || 'File';
                    const html = `<span class="file-reference">${label}</span>`;
                    if (this.lastHtml !== html) {
                        this.contentArea.innerHTML = html;
                        this.lastHtml = html;
                    }
                    this.lastRenderMode = 'file';
                    this.lastFileSrc = src;
                } else {
                    if (this.lastRenderMode !== 'file' || this.lastFileSrc !== src || !this.mountedComponent) {
                        this.setVariableTokenIds(new Set());
                        this.unmountSvelte();
                        this.lastHtml = '';
                        this.mountedComponent = mount(FileRenderer, {
                            target: this.contentArea,
                            props: {
                                __src: src,
                                __wysiwygEditorIdToUpdate: data.editorId
                            }
                        });
                        this.lastFileSrc = src;
                        this.lastRenderMode = 'file';
                    }
                }
            } else {
                // return
                this.lastRenderMode = 'html';
                let html = isVariable ? (data.html || '') : (data.rawHtml || data.html || '');
                let tokens = new Set<string>();
                const varExt = this.editor?.extensionManager?.extensions?.find?.(
                    (ext: any) => ext?.name === CustomVarExtensionProps.name
                );
                const fallbackEditorId = data.editorId || varExt?.options?.editorId || '';
                if (isVariable) {
                    this.attachVariableListener(this.uuid);
                    if (!html) {
                        const varId = this.uuid;
                        const raw = getVariable(varId, fallbackEditorId, false);
                        const value = getVariable(varId, fallbackEditorId, true);
                        const display =
                            getVariableDisplayValue({ value, rawValue: raw }, { plainText: false }) || varId;
                        html = `<span class="variable-reference" data-var-id="${varId}">${display}</span>`;
                    }
                } else {
                    const resolved = this.resolveVariableTokensInHtml(html, fallbackEditorId);
                    html = resolved.tokens.size
                        ? resolved.html
                        : this.refreshVariableSpans(html, fallbackEditorId);
                    tokens = resolved.tokens;
                    if (data.varTokens?.length) {
                        tokens = new Set([...(data.varTokens || []), ...tokens]);
                    }
                    this.setVariableTokenIds(tokens);
                }
                if (this.lastHtml !== html) {
                    this.contentArea.innerHTML = html;
                    this.lastHtml = html;
                }
            }
            this.lastRenderKey = renderKey;
        } else {
            this.isFileReference = false;
            this.pendingFileSrc = '';
            this.setVariableTokenIds(new Set());
            const emptyHtml = `<span class="text-[10px] opacity-50 italic">Reference not found in any open document</span>`;
            if (this.lastHtml !== emptyHtml) {
                this.contentArea.innerHTML = emptyHtml;
                this.lastHtml = emptyHtml;
            }
        }
    }

    renderM(providedData?: any) {
        this.render(providedData);
    }

    renderFrezzing(providedData?: any) {
        this.render(providedData);
    }

    private updateContextInfo() {
        const globalData = get(_$_wysiwygEditorDynamicReferenceAllNodesIndex).get(this.uuid);
        if (globalData) {
            this.contextText.textContent = `Source: ${globalData.id || 'External Document'}`;
        }
    }

    private unmountSvelte() {
        if (this.mountedComponent) {
            unmount(this.mountedComponent);
            this.mountedComponent = null;
        }
    }

    update(node: any) {
        if (node.type !== this.node.type) return false;
        this.node = node;
        const newUuid = (node.attrs.src || '').split('#')[1] || node.attrs.src;
        if (newUuid !== this.uuid) {
            this.uuid = newUuid;
            this.render();
        }
        return true;
    }

    destroy() {
        this.unmountSvelte();
        this.viewObserver?.unobserve(this.dom);
        refEvents.removeEventListener('update', this._handleUpdate);
        refEvents.removeEventListener('editor-update', this._handleEditorUpdate);
        refEvents.removeEventListener('selection-change', this._handleSelectionChange);
        refEvents.removeEventListener('node-deleted', this._handleNodeDeleted);
        this.dom.removeEventListener('click', this.jumpToSource);
        this.dom.removeEventListener('dblclick', this.jumpToSource);
        unregisterEditorUpdateListener(this.editor);
        this.detachVariableListener();
    }
}
