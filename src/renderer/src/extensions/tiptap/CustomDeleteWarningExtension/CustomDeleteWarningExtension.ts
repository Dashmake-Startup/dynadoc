import { Extension } from '@tiptap/core'
import { get } from 'svelte/store'
import { _ } from 'svelte-i18n'
import { openConfirmModal } from '../../../stores/confirmModal.store'
import { CustomSlideExtensionProps } from '../CustomSlideExtension/utils/common.utils'
import { CustomSpreadsheetExtensionProps } from '../CustomSpreadsheetExtension/utils/common.utils'
import { CustomSurveyExtensionProps } from '../CustomSurveyExtension/utils/common.utils'
import { CustomDesignExtensionProps } from '../CustomDesignExtension/utils/common.utils'
import { CustomChartExtensionProps } from '../CustomChartExtension/utils/common.utils'
import { CustomWebviewExtensionProps } from '../CustomWebviewExtension/utils/utils'
import { Plugin, PluginKey,NodeSelection } from '@tiptap/pm/state';
import { ReplaceStep } from '@tiptap/pm/transform'
import { nodeApi } from '../../../utils/shims/node'
import { cleanupSpreadsheetVariablesForPath, cleanupTableCellVariablesForSheet } from '../CustomVarExtension/stores/variableManipulator'
import { _$_wysiwygEditorsList } from '../../../stores/editor.store'

export type DeleteWarningOptions = {
  protectedTypes: string[]
}

function hasProtectedInRange(state: any, protectedSet: Set<string> | undefined) {
  if (!state || !protectedSet || !(protectedSet instanceof Set)) return false;
  
  const { from, to } = state.selection;
  let found = false;
  
  try {
    state.doc.nodesBetween(from, to, (node: any) => {
      if (node && node.type && protectedSet.has(node.type.name)) {
        found = true;
        return false;
      }
      return !found;
    });
  } catch (error) {
    console.warn('Error in hasProtectedInRange:', error);
  }
  
  return found;
}

function hasProtectedAdjacent(state: any, protectedSet: Set<string> | undefined, direction: 'backspace' | 'delete') {
  if (!state || !protectedSet || !(protectedSet instanceof Set)) return false;
  
  try {
    const { $from } = state.selection;
    const doc = state.doc;
    const pos = $from.pos;
    const node =
      direction === 'backspace'
        ? $from.nodeBefore || doc.nodeAt(Math.max(0, pos - 1)) || doc.nodeAt(pos)
        : $from.nodeAfter || doc.nodeAt(pos) || doc.nodeAt(pos + 1);
    
    if (!node || !node.type) return false;
    return protectedSet.has(node.type.name);
  } catch (error) {
    console.warn('Error in hasProtectedAdjacent:', error);
    return false;
  }
}

function hasProtectedAdjacent1(state: any, protectedSet: Set<string>, direction: 'backspace' | 'delete') {
  const { $from } = state.selection
  const doc = state.doc

  // 1. Get the current block node (the one the cursor is inside)
  const currentBlock = $from.node($from.depth)

  // 2. Identify the target node based on direction
  const targetNode = direction === 'backspace'
    ? ($from.nodeBefore || doc.resolve($from.pos - 1).nodeBefore)
    : ($from.nodeAfter || doc.resolve($from.pos + 1).nodeAfter)

  // 3. Verify if that node (or its content) matches our protected set
  if (!targetNode) return false

  // Check the node itself
  if (protectedSet.has(targetNode.type.name)) return true

  // Also check if the node CONTAINS a protected node (common for wrappers)
  let containsProtected = false
  targetNode.descendants((node) => {
    if (protectedSet.has(node.type.name)) {
      containsProtected = true
      return false // stop searching
    }
  })

  return containsProtected
}

async function deleteFileSafe(filePath?: string | null) {
  const target = typeof filePath === 'string' ? filePath.trim() : ''
  if (!target) return
  try {
    if (nodeApi.fsPromises?.stat) {
      await nodeApi.fsPromises.stat(target)
    } else if (nodeApi.fs?.existsSync && !nodeApi.fs.existsSync(target)) {
      return
    }
  } catch {
    return
  }

  try {
    if (nodeApi.fsPromises?.rm) {
      await nodeApi.fsPromises.rm(target, { force: true })
      return
    }
  } catch {
    // fallback
  }
  try {
    if (nodeApi.fsPromises?.unlink) {
      await nodeApi.fsPromises.unlink(target)
      return
    }
  } catch {
    // fallback
  }
  try {
    nodeApi.fs?.unlinkSync?.(target)
  } catch {
    // ignore
  }
}

function collectProtectedNodes(editor: any, protectedSet: Set<string> | undefined) {
  if (!editor || !protectedSet || !(protectedSet instanceof Set)) {
    console.warn('collectProtectedNodes: Invalid editor or protectedSet');
    return [];
  }
  
  const state = editor.state;
  if (!state || !state.selection) return [];
  
  const { from, to, empty } = state.selection;
  const result: Array<{ type: string; attrs: any }> = [];

  try {
    if (!empty) {
      state.doc.nodesBetween(from, to, (node: any) => {
        if (node && node.type && protectedSet.has(node.type.name)) {
          result.push({ type: node.type.name, attrs: node.attrs || {} });
        }
      });
      return result;
    }

    const { $from } = state.selection;
    const before = $from.nodeBefore;
    const after = $from.nodeAfter;
    if (before && before.type && protectedSet.has(before.type.name)) {
      result.push({ type: before.type.name, attrs: before.attrs || {} });
    }
    if (after && after.type && protectedSet.has(after.type.name)) {
      result.push({ type: after.type.name, attrs: after.attrs || {} });
    }
  } catch (error) {
    console.warn('Error in collectProtectedNodes:', error);
  }
  
  return result;
}

async function cleanupEmbeddedAssets(editor: any, protectedSet: Set<string> | undefined) {
  if (!editor || !protectedSet) return;
  
  const embedded = collectProtectedNodes(editor, protectedSet);
  if (!embedded.length) return;

  const editorId = editor?.options?.editorId;
  if (!editorId) {
    console.warn('cleanupEmbeddedAssets: No editorId found');
    return;
  }
  
  // CRITICAL FIX FOR TASK 2: Get the actual DocumentEditorModel from the store
  const editorsList = get(_$_wysiwygEditorsList);
  const documentEditor = editorsList?.get(editorId);
  
  for (const node of embedded) {
    const src = node?.attrs?.src || node?.attrs?.sourcePath || node?.attrs?.path;
    const nodeUuid = node?.attrs?.uuid || node?.attrs?.id || node?.attrs?.['data-uuid'];
    
    if (node.type === CustomSpreadsheetExtensionProps.name) {
      // Remove spreadsheet persisted state file + its related pointer variables.
      try {
        // FIXED: Pass the actual documentEditor instead of just editorId
        if (documentEditor) {
          cleanupSpreadsheetVariablesForPath(String(src || ''), documentEditor, nodeUuid || null);
        } else {
          console.warn('No documentEditor found for spreadsheet cleanup');
        }
      } catch (error) {
        console.warn('Error cleaning up spreadsheet variables:', error);
      }
      await deleteFileSafe(src);
      continue;
    }
    
    if (node.type === 'table' || node.type === 'customTableNode') {
      const sheetName =
        node?.attrs?.['data-excel-table-sheet'] ||
        node?.attrs?.sheet ||
        node?.attrs?.name ||
        nodeUuid ||
        '';
      try {
        if (sheetName && documentEditor) {
          // FIXED: Pass documentEditor for table cleanup
          cleanupTableCellVariablesForSheet(String(sheetName), documentEditor);
        }
      } catch (error) {
        console.warn('Error cleaning up table variables:', error);
      }
      await deleteFileSafe(src);
      continue;
    }
    
    if (node.type === CustomSlideExtensionProps.name) {
      await deleteFileSafe(src);
      continue;
    }

    if (node.type === CustomSurveyExtensionProps.name) {
      await deleteFileSafe(src);
      continue;
    }
    
    // Best-effort cleanup for other embedded assets that store a file path.
    if (typeof src === 'string' && src.trim()) {
      await deleteFileSafe(src);
    }
  }
}

async function confirmDelete(
  editor: any,
  protectedSet: Set<string>,
  direction?: 'backspace' | 'delete',
  options: { skipDelete?: boolean } = {}
) {
  const t = get(_)
  const ok = await openConfirmModal({
    title: t('Delete embedded content?'),
    message: t(
      'Your selection includes embedded content (slides, spreadsheets, charts, designs, or webviews). Deleting it cannot be undone. Continue?'
    ),
    confirmText: t('Delete'),
    cancelText: t('Cancel'),
    destructive: true
  })
  if (!ok) return false

  // When deleting an atom node with an empty selection, explicitly select it first.
  if (editor?.state?.selection?.empty) {
    try {
      if (direction === 'backspace' && editor.commands?.selectNodeBackward) {
        editor.commands.selectNodeBackward()
      } else if (direction === 'delete' && editor.commands?.selectNodeForward) {
        editor.commands.selectNodeForward()
      }
    } catch {
      // ignore
    }
  }

  // Cleanup persisted assets before removing the node from the document.
  await cleanupEmbeddedAssets(editor, protectedSet)

  if (!options.skipDelete) {
    editor.commands.deleteSelection()
  }
  return ok
}

export const CustomDeleteWarningExtension = Extension.create<DeleteWarningOptions>({
  name: 'customDeleteWarning',

  addOptions() {
    return {
      protectedTypes: [
        CustomSlideExtensionProps.name,
        CustomSpreadsheetExtensionProps.name,
        CustomSurveyExtensionProps.name,
        CustomChartExtensionProps.name,
        CustomDesignExtensionProps.name,
        CustomWebviewExtensionProps.name,
        'table'
        // add more later
      ]
    }
  },

  addKeyboardShortcuts() {
    const protectedSet = new Set(this.options.protectedTypes)

    const needsWarning = (direction: 'backspace' | 'delete') => {
      const { state } = this.editor
      if (state.selection.empty) {
        return hasProtectedAdjacent(state, protectedSet, direction)
      }

      return hasProtectedInRange(state, protectedSet)
    }

    return {
      Backspace: () => {
        if (!needsWarning('backspace')) return false
        void confirmDelete(this.editor, protectedSet, 'backspace')
        return true
      },
      Delete: () => {
        if (!needsWarning('delete')) return false
        void confirmDelete(this.editor, protectedSet, 'delete')
        return true
      },
      'Mod-Backspace': () => {
        if (!needsWarning('backspace')) return false
        void confirmDelete(this.editor, protectedSet, 'backspace')
        return true
      },
      'Mod-Delete': () => {
        if (!needsWarning('delete')) return false
        void confirmDelete(this.editor, protectedSet, 'delete')
        return true
      },
      'Shift-Delete': () => {
        if (!needsWarning('delete')) return false
        void confirmDelete(this.editor, protectedSet, 'delete')
        return true
      },
      'Mod-x': () => {
        const { state } = this.editor
        if (state.selection.empty) return false
        if (!hasProtectedInRange(state, protectedSet)) return false
        void confirmDelete(this.editor, protectedSet, undefined, { skipDelete: true }).then((ok) => {
          if (!ok) return
          if (document?.execCommand) {
            try {
              document.execCommand('cut')
              return
            } catch {
              // fallback
            }
          }
          this.editor.commands.deleteSelection()
        })
        return true
      }
    }
  },

  /* addProseMirrorPlugins() {
      const protectedSet = new Set(this.options.protectedTypes)
      const extension = this
  
      return [
        new Plugin({
          key: new PluginKey('customDeleteWarningPlugin'),
          filterTransaction: (tr, state) => {
            // 1. BYPASS: If our confirmation logic set this flag, allow the deletion
            if (tr.getMeta('bypassWarning')) {
              return true
            }
  
            // 2. DETECT: Only monitor deletion steps
            let isDeleting = false
            tr.steps.forEach((step) => {
              if (step instanceof ReplaceStep && step.from !== step.to) {
                isDeleting = true
              }
            })
  
            if (!isDeleting) return true
  
            // 3. SCAN: Check if the deleted range contains any protected nodes
            let foundProtected = false
            tr.steps.forEach((step) => {
              state.doc.nodesBetween(step.from, step.to, (node) => {
                if (protectedSet.has(node.type.name)) {
                  foundProtected = true
                  return false // Stop traversing
                }
              })
            })
  
            // 4. INTERCEPT: Block the deletion and trigger the modal
            if (foundProtected) {
              setTimeout(async () => {
                const t = get(_)
                const confirmed = await openConfirmModal({
                  title: t('Delete embedded content?'),
                  message: t('Your selection includes embedded content. Deleting it cannot be undone. Continue?'),
                  confirmText: t('Delete'),
                  cancelText: t('Cancel'),
                  destructive: true
                })
  
                if (confirmed) {
                  // Execute the deletion with the 'bypassWarning' meta-tag
                  extension.editor.chain().focus().command(({ tr }) => {
                    tr.setMeta('bypassWarning', true)
                    // If atomic, ensure node is selected first
                    if (extension.editor.state.selection.empty) {
                      extension.editor.commands.selectNodeBackward()
                    }
                    tr.deleteSelection()
                    return true
                  }).run()
                }
              }, 0)
  
              return false // Block the transaction
            }
  
            return true
          }
        })
      ]
    },
   */

    addProseMirrorPlugins() {
  const protectedSet = new Set(this.options.protectedTypes)
  const extension = this

  let pendingTr: any = null

  return [
    new Plugin({
      key: new PluginKey('customDeleteWarningPlugin'),

      filterTransaction(tr, state) {

        // allow confirmed deletion
        if (tr.getMeta('bypassWarning')) {
          return true
        }

        let isDeleting = false
        tr.steps.forEach((step) => {
          if (
            step instanceof ReplaceStep &&
            step.from !== step.to &&
            step.slice?.size === 0
          ) {
            isDeleting = true
          }
        })

        if (!isDeleting) return true

        let foundProtected = false

        tr.steps.forEach((step: any) => {
          state.doc.nodesBetween(step.from, step.to, (node) => {
            if (protectedSet.has(node.type.name)) {
              foundProtected = true
              return false
            }
          })
        })

        if (!foundProtected) return true

        // store the blocked transaction
        pendingTr = tr

        setTimeout(async () => {
          const confirmed = await confirmDelete(extension.editor, protectedSet)

          if (!confirmed || !pendingTr) {
            pendingTr = null
            return
          }

          const { view } = extension.editor

          const replay = view.state.tr

          pendingTr.steps.forEach((step: any) => {
            replay.step(step)
          })

          replay.setMeta('bypassWarning', true)

          view.dispatch(replay)

          pendingTr = null
        }, 0)

        return false
      }
    })
  ]
}


//   addProseMirrorPlugins() {
//     const protectedSet = new Set(this.options.protectedTypes);
//     const extension = this;

//     return [
//       new Plugin({
//         key: new PluginKey('customDeleteWarningPlugin'),

//         filterTransaction: (tr, state) => {

//   if (tr.getMeta('bypassWarning')) {
//     return true
//   }

//   let isDeleting = false

//   tr.steps.forEach((step) => {
//     if (step instanceof ReplaceStep && step.from !== step.to) {
//       isDeleting = true
//     }
//   })

//   if (!isDeleting) return true

//   let foundProtected = false

//   tr.steps.forEach((step: any) => {
//     state.doc.nodesBetween(step.from, step.to, (node) => {
//       if (protectedSet.has(node.type.name)) {
//         foundProtected = true
//         return false
//       }
//     })
//   })

//   if (foundProtected) {

//     setTimeout(async () => {

//       const confirmed = await confirmDelete(extension.editor)

//       if (confirmed) {
//         extension.editor
//           .chain()
//           .focus()
//           .command(({ tr }) => {
//             tr.setMeta('bypassWarning', true)
//             tr.deleteSelection()
//             return true
//           })
//           .run()
//       }

//     }, 0)

//     return false
//   }

//   return true
// },

//         // THIS is where filterTransaction belongs (at the root of PluginSpec)
//         // filterTransaction: (tr, state) => {
//         //   // Check if the transaction deletes content
//         //   let isDeleting = false;
//         //   tr.steps.forEach((step: any) => {
//         //     // Detect if this is a deletion (ReplaceStep)
//         //     if (step.slice?.size === 0 && step.from !== step.to) {
//         //       isDeleting = true;
//         //     }
//         //   });

//         //   if (!isDeleting) return true;

//         //   let foundProtected = false;
//         //   tr.steps.forEach((step: any) => {
//         //     if (step.from !== undefined && step.to !== undefined) {
//         //       state.doc.nodesBetween(step.from, step.to, (node) => {
//         //         if (protectedSet.has(node.type.name)) {
//         //           foundProtected = true;
//         //           return false;
//         //         }
//         //       });
//         //     }
//         //   });

//         //   /* if (foundProtected) {
//         //     // Use setTimeout to defer the modal call
//         //     setTimeout(async () => {
//         //       const confirmed = await confirmDelete(extension.editor);
//         //       if (confirmed) {
//         //         extension.editor.view.dispatch(extension.editor.state.tr.deleteSelection());
//         //       }
//         //     }, 0);

//         //     return false; // Prevent the default deletion
//         //   } */

//         //   /* if (foundProtected) {
//         //     setTimeout(async () => {
//         //       const confirmed = await confirmDelete(extension.editor);
//         //       // if (confirmed) {
//         //       //   // Use the editor command chain instead of manual dispatch
//         //       //   // This is safer and handles history/selection correctly
//         //       //   extension.editor.chain().focus().deleteSelection().run();
//         //       // }

//         //       if (confirmed) {
//         //         // If selection is empty, select the node before deleting
//         //         if (extension.editor.state.selection.empty) {
//         //           extension.editor.commands.selectNodeBackward(); // Or selectNodeForward
//         //         }
//         //         extension.editor.chain().focus().deleteSelection().run();
//         //       }
//         //     }, 0);

//         //     return false;
//         //   } */

//         //   // 4. INTERCEPT: Block the deletion and trigger the modal
//         //   if (foundProtected) {
//         //     setTimeout(async () => {
//         //       const t = get(_)
//         //       const confirmed = await openConfirmModal({
//         //         title: t('Delete embedded content?'),
//         //         message: t('Your selection includes embedded content. Deleting it cannot be undone. Continue?'),
//         //         confirmText: t('Delete'),
//         //         cancelText: t('Cancel'),
//         //         destructive: true
//         //       })

//         //       /* if (confirmed) {
//         //         // Execute the deletion with the 'bypassWarning' meta-tag
//         //         extension.editor.chain().focus().command(({ tr }) => {
//         //           tr.setMeta('bypassWarning', true)
//         //           // If atomic, ensure node is selected first
//         //           if (extension.editor.state.selection.empty) {
//         //             extension.editor.commands.selectNodeBackward()
//         //           }
//         //           tr.deleteSelection()
//         //           return true
//         //         }).run()
//         //       } */

//         //       /* if (confirmed) {
//         //         const { selection, doc } = extension.editor.state;
//         //         const node = selection.$anchor.node();
//         //         console.log("Deleting node type:", node.type.name);
//         //         console.log("Is selection empty?", selection.empty);

//         //         // 1. Force the selection onto the target if it's currently empty
//         //         if (extension.editor.state.selection.empty) {
//         //           extension.editor.commands.selectNodeBackward();
//         //         }

//         //         // 2. Perform the deletion using a standard transaction
//         //         // We bypass the chain() to ensure it executes regardless of internal state checks
//         //         const { view, state } = extension.editor;
//         //         const tr = state.tr.deleteSelection();

//         //         // 3. Mark the transaction with the bypass flag
//         //         tr.setMeta('bypassWarning', true);

//         //         // 4. Dispatch the transaction directly to the view
//         //         view.dispatch(tr);

//         //         // 5. Ensure focus is returned
//         //         extension.editor.commands.focus();
//         //       } */

//         //       if (confirmed) {
//         //         const { state, view } = extension.editor;
//         //         const { $from } = state.selection;

//         //         // 1. Identify which node is "protected" (the one we want to delete)
//         //         // We look at the node before or after the cursor
//         //         const nodeToDelete = $from.nodeBefore || $from.nodeAfter;

//         //         if (nodeToDelete) {
//         //           // 2. Select the node specifically
//         //           // We create a new NodeSelection at the position of the protected node
//         //           const pos = $from.pos - ($from.nodeBefore ? $from.nodeBefore.nodeSize : 0);
//         //           const tr = state.tr.setSelection(
//         //            new NodeSelection(state.doc.resolve(pos))
//         //           );

//         //           // 3. Mark for bypass so the filter doesn't trigger again
//         //           tr.setMeta('bypassWarning', true);
//         //           tr.deleteSelection();

//         //           view.dispatch(tr);
//         //         } else {
//         //           // Fallback: If we can't find it, delete the selection normally
//         //           extension.editor.chain().focus().deleteSelection().run();
//         //         }
//         //       }
//         //     }, 0)

//         //     return false // Block the transaction
//         //   }


//         //   return true;
//         // },

//         // Other props (like event handlers) go here
//         props: {
//           // handleKeyDown: ...
//         }
//       })
//     ];
//   }
})
