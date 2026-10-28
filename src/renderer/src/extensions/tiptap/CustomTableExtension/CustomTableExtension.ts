import { TablePlus } from "tiptap-table-plus";
import { mergeAttributes, Node } from "@tiptap/core";
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { v4 as uuidv4 } from 'uuid';

/**
 * Helper to create a unique fingerprint based on table structure and content
 */
const getTableSignature = (node: any) => {
  const rowCount = node.childCount;
  // Account for TablePlus row grouping structure
  const firstRow = node.firstChild?.type.name === 'tableRowGroup' 
    ? node.firstChild.firstChild 
    : node.firstChild;
  const colCount = firstRow?.childCount || 0;
  
  // Take a snippet of the first few characters of the table content
  const contentSnippet = node.textContent.substring(0, 15).replace(/\s+/g, '');
  
  return `sig_${rowCount}x${colCount}_${contentSnippet}`;
};

export const CustomTableExtension = (TablePlus as any).extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      uuid: {
        default: null,
        parseHTML: el => el.getAttribute('uuid') || el.getAttribute('data-uuid'),
        renderHTML: attr => attr.uuid ? { 'uuid': attr.uuid, 'data-uuid': attr.uuid } : {}
      },
      stylePreset: {
        default: 'plain',
        parseHTML: el => el.getAttribute('data-style-preset') || 'plain',
        renderHTML: attr =>
          attr.stylePreset ? { 'data-style-preset': attr.stylePreset } : {}
      },
      headerRow: {
        default: false,
        parseHTML: el => el.getAttribute('data-header-row') === 'true',
        renderHTML: attr =>
          attr.headerRow ? { 'data-header-row': 'true' } : {}
      },
      totalRow: {
        default: false,
        parseHTML: el => el.getAttribute('data-total-row') === 'true',
        renderHTML: attr =>
          attr.totalRow ? { 'data-total-row': 'true' } : {}
      },
      firstColumn: {
        default: false,
        parseHTML: el => el.getAttribute('data-first-column') === 'true',
        renderHTML: attr =>
          attr.firstColumn ? { 'data-first-column': 'true' } : {}
      },
      lastColumn: {
        default: false,
        parseHTML: el => el.getAttribute('data-last-column') === 'true',
        renderHTML: attr =>
          attr.lastColumn ? { 'data-last-column': 'true' } : {}
      },
      bandedRows: {
        default: false,
        parseHTML: el => el.getAttribute('data-banded-rows') === 'true',
        renderHTML: attr =>
          attr.bandedRows ? { 'data-banded-rows': 'true' } : {}
      },
      bandedColumns: {
        default: false,
        parseHTML: el => el.getAttribute('data-banded-columns') === 'true',
        renderHTML: attr =>
          attr.bandedColumns ? { 'data-banded-columns': 'true' } : {}
      },
      borderColor: {
        default: null,
        parseHTML: el => el.getAttribute('data-border-color'),
        renderHTML: attr =>
          attr.borderColor
            ? {
                'data-border-color': attr.borderColor,
                style: `--table-border-color:${attr.borderColor};`
              }
            : {}
      },
      borderWidth: {
        default: null,
        parseHTML: el => el.getAttribute('data-border-width'),
        renderHTML: attr =>
          attr.borderWidth
            ? {
                'data-border-width': attr.borderWidth,
                style: `--table-border-width:${attr.borderWidth}px;`
              }
            : {}
      },
      shadingColor: {
        default: null,
        parseHTML: el => el.getAttribute('data-shading-color'),
        renderHTML: attr =>
          attr.shadingColor
            ? {
                'data-shading-color': attr.shadingColor,
                style: `--table-shading-color:${attr.shadingColor};`
              }
            : {}
      },
      // The Fuzzy Signature: hidden from users, used for link recovery
      signature: {
        default: null,
        parseHTML: el => el.getAttribute('data-signature'),
        renderHTML: attr => attr.signature ? { 'data-signature': attr.signature } : {}
      }
    };
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      new Plugin({
        key: new PluginKey('tableUuidPersistence'),
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some(tr => tr.docChanged)) return null;

          const tr = newState.tr;
          let modified = false;

          newState.doc.descendants((node, pos) => {
            if (node.type.name === 'table') {
              const currentUuid = node.attrs.uuid;
              const currentSig = node.attrs.signature;
              
              // Map back to find the ancestor node
              const oldPos = tr.mapping.invert().map(pos);
              const oldNode = oldState.doc.nodeAt(oldPos);
              
              // 1. REPAIR UUID: If identity is lost, recover from old position
              let targetUuid = currentUuid;
              if (!currentUuid || (oldNode?.attrs?.uuid && currentUuid !== oldNode.attrs.uuid)) {
                targetUuid = oldNode?.attrs?.uuid || uuidv4();
                modified = true;
              }

              // 2. UPDATE SIGNATURE: Calculate the current state fingerprint
              const newSig = getTableSignature(node);
              
              // Apply changes if UUID was repaired OR if the signature needs updating
              if (modified || currentSig !== newSig) {
                tr.setNodeMarkup(pos, undefined, { 
                  ...node.attrs, 
                  uuid: targetUuid,
                  signature: newSig 
                });
                modified = true;
              }
            }
            if (node.type.name === 'table') return false;
          });

          return modified ? tr : null;
        }
      })
    ];
  }
});
