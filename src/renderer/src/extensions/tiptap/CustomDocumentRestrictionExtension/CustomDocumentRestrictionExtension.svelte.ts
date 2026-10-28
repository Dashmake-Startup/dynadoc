import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { defaultStats, nodeCounts } from './stores/restriction.store';
import { get } from 'svelte/store';
import StatsWorker from './workers/stats.worker?worker';
import { mount, unmount } from 'svelte';
import DocumentRestrictionToolbar from './components/DocumentRestrictionToolbar.svelte';
import { CustomDocumentRestrictionExtensionProps } from './utils/common.utils';
import EditorHelpers from '../../../utils/EditorHelpers';
import { _$_documentEditorsList } from '../../../stores/editor.store';
import { defaultDocumentRestrictionRules } from './utils/restriction.defaults';

// Shared toolbar visibility controller (O(1) toggle, optimized for many tabs)
const restrictionToolbarContainers = new Map<string, HTMLElement>();
let visibleRestrictionToolbarKey: string | null = null;
let toolbarVisibilityObserversReady = false;
let stopActiveEditorObserver: (() => void) | null = null;
let stopActiveTranslationObserver: (() => void) | null = null;

function getRestrictionToolbarKey(value: unknown): string {
  return String(value ?? '');
}

function resolveActiveRestrictionToolbarKey(): string | null {
  const activeTranslation = _$_documentEditorsList.getActiveTranslationSync?.();
  if (activeTranslation?.path) return getRestrictionToolbarKey(activeTranslation.path);

  const activeDoc = _$_documentEditorsList.getActiveSync?.();
  if (!activeDoc) return null;

  return (
    getRestrictionToolbarKey(activeDoc.id) ||
    getRestrictionToolbarKey(activeDoc.document?.getMainFilePath?.()) ||
    null
  );
}

function setVisibleRestrictionToolbar(nextKey: string | null) {
  if (visibleRestrictionToolbarKey === nextKey) return;

  if (visibleRestrictionToolbarKey) {
    restrictionToolbarContainers.get(visibleRestrictionToolbarKey)?.classList.add('hidden');
  }

  visibleRestrictionToolbarKey = nextKey;

  if (nextKey) {
    restrictionToolbarContainers.get(nextKey)?.classList.remove('hidden');
  }
}

function syncVisibleRestrictionToolbar() {
  setVisibleRestrictionToolbar(resolveActiveRestrictionToolbarKey());
}

function ensureToolbarVisibilityObservers() {
  if (toolbarVisibilityObserversReady) return;

  toolbarVisibilityObserversReady = true;
  stopActiveEditorObserver = _$_documentEditorsList.getActive().subscribe(() => {
    syncVisibleRestrictionToolbar();
  });
  stopActiveTranslationObserver = _$_documentEditorsList.getActiveTranslation().subscribe(() => {
    syncVisibleRestrictionToolbar();
  });
}

function cleanupToolbarVisibilityObserversIfIdle() {
  if (restrictionToolbarContainers.size > 0) return;

  stopActiveEditorObserver?.();
  stopActiveTranslationObserver?.();
  stopActiveEditorObserver = null;
  stopActiveTranslationObserver = null;
  toolbarVisibilityObserversReady = false;
  visibleRestrictionToolbarKey = null;
}

function registerRestrictionToolbarContainer(editorId: unknown, container: HTMLElement) {
  const key = getRestrictionToolbarKey(editorId);
  restrictionToolbarContainers.set(key, container);
  ensureToolbarVisibilityObservers();
  syncVisibleRestrictionToolbar();
}

function unregisterRestrictionToolbarContainer(editorId: unknown) {
  const key = getRestrictionToolbarKey(editorId);
  restrictionToolbarContainers.delete(key);
  if (visibleRestrictionToolbarKey === key) {
    visibleRestrictionToolbarKey = null;
  }
  cleanupToolbarVisibilityObserversIfIdle();
  syncVisibleRestrictionToolbar();
}

// const mapToObj = (map: any) => {
//   const obj: Record<string, any> = {};
//   map.forEach((key: string, value: any) => {
//     obj[key] = value;
//   });
//   return obj;
// };

function getSchemaSpec1(editor) {
  const mapToObj = (map: any) => {
    const obj: Record<string, any> = {};
    // OrderedMap.forEach callback signature is (value, key)
    map.forEach((value: any, key: string) => {
      // Create a shallow copy so we don't mutate the actual editor schema
      const spec = { ...value };
      
      // Remove non-serializable functions (Worker doesn't need these)
      delete spec.toDOM;
      delete spec.parseDOM;
      
      obj[key] = spec;
    });
    return obj;
  };

  return {
    nodes: mapToObj(editor.schema.spec.nodes),
    marks: mapToObj(editor.schema.spec.marks)
  };
}

function getSchemaSpec11(editor) {
  const mapToObj = (map: any) => {
    const obj: Record<string, any> = {};
    map.forEach((value: any, key: string) => {
      // We clone the spec to avoid modifying the active editor schema
      const spec = { ...value };
      
      // Clean up non-serializable properties
      delete spec.toDOM;
      delete spec.parseDOM;
      
      obj[key] = spec;
    });
    return obj;
  };


  return {
    nodes: mapToObj(editor.schema.spec.nodes),
    marks: mapToObj(editor.schema.spec.marks)
  };
}

function getSchemaSpec22(editor) {
  const mapToObj = (map: any) => {
    const obj: Record<string, any> = {};
    
    // 1. Explicitly pull 'doc' and 'text' first to satisfy ProseMirror's order requirements
    const essentialNodes = ['doc', 'text'];
    essentialNodes.forEach(nodeName => {
      const spec = map.get(nodeName);
      if (spec) {
        const cleanSpec = { ...spec };
        delete cleanSpec.toDOM;
        delete cleanSpec.parseDOM;
        obj[nodeName] = cleanSpec;
      }
    });

    // 2. Add the rest of the nodes
    map.forEach((value: any, key: string) => {
      if (essentialNodes.includes(key)) return;
      
      const spec = { ...value };
      delete spec.toDOM;
      delete spec.parseDOM;
      obj[key] = spec;
    });
    return obj;
  };

  return {
    nodes: mapToObj(editor.schema.spec.nodes),
    marks: mapToObj(editor.schema.spec.marks)
  };
}

function getSchemaSpec(editor) {
  const mapToObj = (map: any) => {
    const obj: Record<string, any> = {};
    
    // 1. Explicitly pull 'doc' and 'text' first to satisfy ProseMirror's order requirements
    const essentialNodes = ['doc', 'text'];
    essentialNodes.forEach(nodeName => {
      const spec = map.get(nodeName);
      if (spec) {
        const cleanSpec = { ...spec };
        delete cleanSpec.toDOM;
        delete cleanSpec.parseDOM;
        obj[nodeName] = cleanSpec;
      }
    });

    // 2. Add the rest of the nodes
    map.forEach((value: any, key: string) => {
      if (essentialNodes.includes(key)) return;
      
      const spec = { ...value };
      delete spec.toDOM;
      delete spec.parseDOM;
      obj[key] = spec;
    });
    return obj;
  };

  return {
    nodes: mapToObj(editor.schema.spec.nodes),
    marks: mapToObj(editor.schema.spec.marks)
  };
}

export const CustomDocumentRestrictionExtension = Extension.create({
  name: CustomDocumentRestrictionExtensionProps.name,
  // name: 'customNodeLimit',

  addOptions() {
    return {
      toolbarHTMLContainerRoot: null,
      pageHeight: 1123,
      editorId: null,
    };
  },

  addStorage() {
    return {
      worker: null as Worker | null,
      component: null as any,
    };
  },

  onCreate({ editor }) {
    const id = this.options.editorId;
    const domId = EditorHelpers.pathToDomId(id)
    // const domId = id

    // Initialize store entry
    nodeCounts.updateEditor(id, { isReconciling: true });

    this.storage.worker = new StatsWorker();
    this.storage.worker.onmessage = (e) => {
      // nodeCounts.update(s => ({ ...s, ...e.data, isReconciling: false }));
      // Update specific editor entry
      nodeCounts.updateEditor(id, { ...e.data, isReconciling: false });
    };

    const schemaSpec = getSchemaSpec(editor)
    /* const cleanNodes = mapToObj(editor.schema.spec.nodes);

    // Optional: If the worker throws errors about functions, 
    // strip them since the worker only needs the structure.
    Object.keys(cleanNodes).forEach(key => {
      delete cleanNodes[key].toDOM;
      delete cleanNodes[key].parseDOM;
    }); */


    this.storage.worker.postMessage({
      type: 'FULL_RELOAD',
      json: editor.state.doc.toJSON(),
      schemaSpec,
      options: { editorId: this.options.editorId }

    });

    // UI Mounting
    let editorHTMLContainerRoot = this.options.toolbarHTMLContainerRoot

    if (editorHTMLContainerRoot) {
      const containerClassName = `${CustomDocumentRestrictionExtensionProps.containerBaseClassName}-${domId}`
      let container: HTMLElement = editorHTMLContainerRoot.querySelector(`.${containerClassName}`)
      if (!container) {
        // if (!editorHTMLContainerRoot.querySelector(`.${containerClassName}`)) {
        // 3️⃣ Create placeholder container
        container = document.createElement('div')
        container.className = `${CustomDocumentRestrictionExtensionProps.containerBaseClassName} ${containerClassName} hidden `
        // container.className = 'node-limit-warning-container'
        editorHTMLContainerRoot.prepend(container)
      }

      this.storage.component = mount(DocumentRestrictionToolbar, {
        target: container,
        props: { editorId: String(id ?? '') } // Pass the ID down
      });

      registerRestrictionToolbarContainer(id, container);
    }
  },

  addProseMirrorPlugins() {
    const { editor } = this;
    const { editorId, pageHeight } = this.options; // Extract ID from options
    let debounceTimer: any = null;

    return [
      new Plugin({
        key: new PluginKey(`${CustomDocumentRestrictionExtensionProps.name}Plugin-${editorId}`), // Unique key per instance
        // PREVENT the change before it happens
        /* filterTransaction(tr, state) {
          // 1. Only care about transactions that change the document
          if (!tr.docChanged || tr.getMeta('force-update')) return true;

          // 2. Get current rules from your logic/config
          // 1. Get the current state of the editors store
          const editorsMap = get(_$_documentEditorsList);

          // 2. Find the document that matches this editor's ID
          // We search both the active document and the active translation path
          const activeDoc = editorsMap.getActiveSync(); // or however your store exposes the list
          const rulesSource = activeDoc?.document?.config?.restrictionRules;

          // 3. Merge with defaults (exactly like your Svelte component)
          const rules = {
            ...defaultDocumentRestrictionRules,
            ...(rulesSource || {})
          };

          // 4. Now perform the check
          // if (!rules) return true;
          // Assuming you can access the editor's config here
          // const rules = editor.options.doc?.config?.restrictionRules;
          if (!rules) return true;

          // 3. Get current counts from your store
          const currentStats = get(nodeCounts)[editorId];
          if (!currentStats) return true;

          let isForbidden = false;
          let forbiddenReason = "";

          // 4. Analyze what is being added in this transaction
          tr.steps.forEach(step => {
            step.getMap().forEach((fromA, toA, fromB, toB) => {
              const slice = tr.doc.slice(fromB, toB);

              // A. Check for specific Node types (Table, Image, etc.)
              slice.content.descendants(node => {
                const type = node.type.name; // e.g., 'table', 'image', 'paragraph'
                const limit = rules[type]?.max;
                const current = currentStats[type] || 0;

                if (limit !== undefined && isFinite(limit) && current >= limit) {
                  isForbidden = true;
                  forbiddenReason = `Limit reached: Max ${limit} ${type}(s) allowed.`;
                }
              });

              // B. Check for Text/Word limits
              if (rules.words?.max || rules.characters?.max) {
                const addedText = tr.doc.textBetween(fromB, toB);
                const wordCount = (addedText.trim().match(/\b\w+\b/g) || []).length;

                if (rules.words?.max && (currentStats.words + wordCount) > rules.words.max) {
                  isForbidden = true;
                  forbiddenReason = "Word limit reached.";
                }
              }
            });
          });

          if (isForbidden) {
            // Trigger a UI notification scoped to this editor
            window.dispatchEvent(new CustomEvent('restriction-warning', {
              detail: { message: forbiddenReason, editorId }
            }));
            return false; // This cancels the transaction!
          }

          return true;
        }, */

        /* filterTransaction(tr, state) {
          // 1. Only intercept transactions that change content
          // 'force-update' allows us to bypass the check programmatically if needed
          if (!tr.docChanged || tr.getMeta('force-update')) return true;

          // 2. DATA RESOLUTION (Mirroring your Svelte Logic)
          const activeTranslationStore = _$_documentEditorsList.getActiveTranslation();
          const activeDocStore = _$_documentEditorsList.getActive();

          const activeTrans = get(activeTranslationStore);
          const activeDoc = get(activeDocStore);

          // Determine if we are looking at a translation or a main doc
          const currentRulesSource = activeTrans?.path === editorId
            ? activeDoc?.document?.config?.restrictionRules // Logic for translation
            : activeDoc?.document?.config?.restrictionRules; // Logic for main doc

          const rules = {
            ...defaultDocumentRestrictionRules,
            ...(currentRulesSource || {})
          };
          console.log()

          // 3. GET CURRENT COUNTS
          const counts = get(nodeCounts)[editorId] || { words: 0, characters: 0 };

          let isForbidden = false;
          let reason = "";

          tr.steps.forEach(step => {
            const map = step.getMap();
            map.forEach((fromA, toA, fromB, toB) => {
              // 1. CALCULATE THE DIFF
              // Content being removed
              const removedSlice = state.doc.slice(fromA, toA);
              // Content being added
              const addedSlice = tr.doc.slice(fromB, toB);

              // 2. CHECK NODE LIMITS (Tables, Images, etc.)
              addedSlice.content.descendants(node => {
                const type = node.type.name;
                const rule = rules[type];
                // if (rule && rule.max !== undefined) {
                if (rule && rule.max !== undefined && rule.max !== Infinity) {
                  // Count how many of this node type are being REMOVED in this step
                  let removedCount = 0;
                  removedSlice.content.descendants(n => { if (n.type.name === type) removedCount++; });

                  const currentCount = counts[type] || 0;
                  // ONLY block if the NEXT change puts us over the limit
                  if (currentCount - removedCount >= rule.max) {
                    isForbidden = true;
                    reason = `Limit reached: Maximum ${rule.max} ${type}(s) allowed.`;
                  }
                }
              });

              // 3. CHECK WORD LIMITS
              if (rules.words?.max && rules.words.max !== Infinity) {
                const addedText = tr.doc.textBetween(fromB, toB, " ");
                const removedText = state.doc.textBetween(fromA, toA, " ");

                const getWords = (t: string) => (t.trim().match(/\b\w+\b/g) || []).length;
                const addedWords = getWords(addedText);
                const removedWords = getWords(removedText);

                // Allow if we are deleting words (net change <= 0)
                // Block only if we are adding words AND the total exceeds max
                if (addedWords > removedWords && (counts.words + (addedWords - removedWords)) > rules.words.max) {
                  isForbidden = true;
                  reason = "Word limit reached.";
                }
              }
            });
          });

          if (isForbidden) {
            window.dispatchEvent(new CustomEvent('restriction-warning', { detail: { message: reason, editorId } }));
            return false;
          }

          return true;// ALLOW TRANSACTION
        }, */

        filterTransaction(tr, state) {
          if (!tr.docChanged || tr.getMeta('force-update')) return true;
        
          // 1. Resolve Rules & Counts
          const activeDoc = get(_$_documentEditorsList.getActive());
          const activeTrans = get(_$_documentEditorsList.getActiveTranslation());
        
          const currentRulesSource = activeTrans?.path === editorId
            ? activeDoc?.document?.config?.restrictionRules
            : activeDoc?.document?.config?.restrictionRules;
        
          const rules = { ...defaultDocumentRestrictionRules, ...(currentRulesSource || {}) };
          const counts = get(nodeCounts)[editorId] || {};
        
          let isForbidden = false;
          let reason = "";
        
          // Helper to get word count
          const getWords = (t: string) => (t.trim().match(/\b\w+\b/g) || []).length;
          // Helper to get sentence count
          const getSentences = (t: string) => (t.trim().match(/[.!?]+(?=\s|$)/g) || []).length;
        
          tr.steps.forEach(step => {
            if (isForbidden) return;
            const map = step.getMap();
        
            map.forEach((fromA, toA, fromB, toB) => {
              if (isForbidden) return;
        
              const removedSlice = state.doc.slice(fromA, toA);
              const addedSlice = tr.doc.slice(fromB, toB);
              const removedText = state.doc.textBetween(fromA, toA, " ");
              const addedText = tr.doc.textBetween(fromB, toB, " ");
        
              // --- 2. TEXT-BASED & NODE COUNT RESTRICTIONS ---
              const metrics = [
                { key: 'characters', added: addedText.length, removed: removedText.length },
                { key: 'words', added: getWords(addedText), removed: getWords(removedText) },
                { key: 'sentences', added: getSentences(addedText), removed: getSentences(removedText) },
                { key: 'nodeCount', added: addedSlice.content.childCount, removed: removedSlice.content.childCount }
              ];
        
              for (const metric of metrics) {
                const rule = rules[metric.key];
                if (rule?.max && rule.max !== Infinity) {
                  const currentTotal = counts[metric.key] || 0;
                  const netChange = metric.added - metric.removed;
        
                  if (netChange > 0 && (currentTotal + netChange) > rule.max) {
                    isForbidden = true;
                    reason = `${metric.key.charAt(0).toUpperCase() + metric.key.slice(1)} limit reached (${rule.max})`;
                    return;
                  }
                }
              }
        
              // --- 3. SPECIFIC NODE-TYPE RESTRICTIONS ---
              addedSlice.content.descendants(node => {
                if (isForbidden) return;
        
                const type = node.type.name;
                const rule = rules[type];
        
                if (rule?.max && rule.max !== Infinity) {
                  let removedCount = 0;
                  removedSlice.content.descendants(n => { if (n.type.name === type) removedCount++; });
        
                  const currentTotal = counts[type] || 0;
                  // This logic is tricky. A simple "1" assumes one node is added,
                  // but the slice could contain multiple.
                  // A better approach is to count added nodes of this type.
                  let addedCount = 0;
                  addedSlice.content.descendants(n => { if (n.type.name === type) addedCount++; });

                  const netChange = addedCount - removedCount;
        
                  if (netChange > 0 && (currentTotal + netChange) > rule.max) {
                    isForbidden = true;
                    reason = `Limit reached: Maximum ${rule.max} ${type}(s) allowed.`;
                  }
                }
              });
            });
          });
        
          if (isForbidden) {
            window.dispatchEvent(new CustomEvent('restriction-warning', { detail: { message: reason, editorId } }));
            return false;
          }
        
          return true;
        },
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some(tr => tr.docChanged)) return null;

          // 1. Capture the worker reference immediately
          // const worker = this.storage.worker;
          const worker = editor.storage[CustomDocumentRestrictionExtensionProps.name]?.worker;
          if (!worker) return null;

          if (worker) {
            // 1. Extract only the steps from the transactions
            const stepsJSON = [];
            transactions.forEach(tr => {
              if (tr.docChanged) {
                tr.steps.forEach(step => {
                  stepsJSON.push(step.toJSON());
                });
              }
            });

            // 2. Post the tiny "delta" to the worker
            // We also send the current doc once at startup (onCreate)
            worker.postMessage({
              type: 'PATCH',
              steps: stepsJSON,
              schemaSpec: getSchemaSpec(editor),
              options: { editorId }
            });
          }

          // 2. INSTANT INCREMENTAL ACCURACY (Local to this editorId)
          /*  let addedText = "";
           let removedText = "";
 
           transactions.forEach(tr => {
             tr.steps.forEach(step => {
               const map = step.getMap();
               // Iterate through the changes in the step
               map.forEach((fromA, toA, fromB, toB) => {
                 // Text removed from the old document
                 removedText += oldState.doc.textBetween(fromA, toA, " ");
                 // Text added to the new document
                 addedText += newState.doc.textBetween(fromB, toB, " ");
               });
             });
           });
  */

          let totalAddedWords = 0;
          let totalRemovedWords = 0;
          let totalAddedChars = 0;
          let totalRemovedChars = 0;

          const getWords = (t: string) => (t.trim().match(/\b\w+\b/g) || []).length;

          transactions.forEach(tr => {
            if (!tr.docChanged) return;

            tr.steps.forEach(step => {
              const map = step.getMap();

              map.forEach((fromA, toA, fromB, toB) => {
                // Use tr.before for the state BEFORE this specific step
                // We use Math.min/max to ensure we stay within the actual doc bounds 
                // to prevent the 'nodeSize' error if indices shifted
                try {
                  const removedText = tr.before.textBetween(
                    Math.min(fromA, tr.before.content.size),
                    Math.min(toA, tr.before.content.size),
                    " "
                  );
                  totalRemovedChars += removedText.length;
                  totalRemovedWords += getWords(removedText);

                  // Use tr.doc for the state AFTER this specific step
                  const addedText = tr.doc.textBetween(
                    Math.min(fromB, tr.doc.content.size),
                    Math.min(toB, tr.doc.content.size),
                    " "
                  );
                  totalAddedChars += addedText.length;
                  totalAddedWords += getWords(addedText);
                } catch (e) {
                  console.warn("Incremental count skipped a step due to boundary shift", e);
                }
              });
            });
          });

          // Update the store using the accumulated diffs
          nodeCounts.updateEditor(editorId, (prev) => ({
            characters: Math.max(0, prev.characters + (totalAddedChars - totalRemovedChars)),
            words: Math.max(0, prev.words + (totalAddedWords - totalRemovedWords)),
            isReconciling: true
          }));

          /* const getWords = (t: string) => (t.trim().match(/\b\w+\b/g) || []).length;

          // ✅ This is now clean, safe, and works with multiple editors
          nodeCounts.updateEditor(editorId, (prev) => ({
            characters: Math.max(0, prev.characters + (addedText.length - removedText.length)),
            words: Math.max(0, prev.words + (getWords(addedText) - getWords(removedText))),
            isReconciling: true
          })); */

          // 3. DEBOUNCED BACKGROUND RECONCILIATION

          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            // Prepare only the steps that occurred in the recent transactions
            const stepsJSON = transactions
              .filter(tr => tr.docChanged)
              .flatMap(tr => tr.steps.map(s => s.toJSON()));

            const runWorker = () => {
              // Check again to ensure worker hasn't been terminated in the meantime
              if (worker) {
                worker.postMessage({
                  type: 'PATCH',
                  steps: stepsJSON,
                  schemaSpec: getSchemaSpec(editor),
                  options: {
                    editorId: editorId,
                    pageHeight: pageHeight
                  }
                });
              }
            };

            if ('requestIdleCallback' in window) {
              window.requestIdleCallback(runWorker);
            } else {
              runWorker();
            }
          }, 1000);

          // clearTimeout(debounceTimer);
          // debounceTimer = setTimeout(() => {
          //   /* const runWorker = () => {
          //     // const worker = editor.storage.nodeLimit?.worker;
          //     if (worker) {
          //       // Only serialize the document when the user stops typing
          //       const json = newState.doc.toJSON();
          //       worker.postMessage({
          //         json,
          //         options: { pageHeight, editorId } // Pass metadata back to worker
          //       });
          //     }
          //   }; */

          //   // 1. Prepare only the steps that occurred
          //   const steps = transactions
          //     .filter(tr => tr.docChanged)
          //     .flatMap(tr => tr.steps.map(s => s.toJSON()));

          //   // 2. Schedule the update without blocking the UI
          //   const runWorker = () => {
          //     worker.postMessage({
          //       type: 'PATCH',
          //       steps,
          //       options: {
          //         editorId: this.options.editorId,
          //         pageHeight: this.options.pageHeight
          //       }
          //     });
          //   };

          //   // High performance: wait for browser idle time
          //   if ('requestIdleCallback' in window) {
          //     window.requestIdleCallback(runWorker);
          //   } else {
          //     runWorker();
          //     setTimeout(runWorker, 100);
          //   }
          // }, 1000);

          return null;
        },
      }),
    ];
  },

  onDestroy() {
    if (this.storage.worker) this.storage.worker.terminate();
    if (this.storage.component) unmount(this.storage.component);
    const id = this.options.editorId;
    unregisterRestrictionToolbarContainer(id);
    nodeCounts.removeEditor(id); // Cleanup
  },
});
