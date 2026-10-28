/**
 * Copyright (C) 2025 Dashmake Inc.
 *
 * This file is part of DDoc Office.
 *
 * DDoc Office is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DDoc Office is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
 */

/*
const editor = new Editor({
  extensions: [
    StarterKit,
    CustomUuidIdentificationExtension.configure({
      target: 'both',
      ignoreInlineTypes: ['strong', 'em', 'link'],
      ignoreChildren: true,
      regenerateOnPaste: true,
    }),
  ],
});

// Regenerate UUID for a block at a specific position
editor.commands.regenerateUuid(pos)

// Regenerate UUID for a block and all its descendants
editor.commands.regenerateUuid(pos, 0)


*/

import { Extension } from '@tiptap/core'
import { v4 as uuidv4 } from 'uuid'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Node as ProseMirrorNode } from 'prosemirror-model'


const extensionName = 'uuid'
const extensionTagAttributeName = 'data-uuid'

// Helper that walks the document and sets missing UUID attrs
function assignUuidsToEditor(editor, options) {
  const tr = editor.state.tr
  let modified = false
  const skipRoots: number[] = []
  // console.log('assignUuidsToEditor', { editor, options })
  let _node, _pos
  editor.state.doc.descendants((node, pos) => {
    // skip text nodes
    if (node.isText) return

    // skip if inside a previously marked skipRoot range
    if (
      skipRoots.some(
        (rootPos) => pos > rootPos && pos < rootPos + editor.state.doc.nodeAt(rootPos).nodeSize
      )
    ) {
      return
    }
    // console.log('assignUuidsToEditor skipRoots', { skipRoots })

    // ignore node types if requested
    if (options.ignoreNodeTypes?.includes(node.type.name)) {
      if (options.ignoreChildren) {
        skipRoots.push(pos)
      }
      return
    }
    // console.log('assignUuidsToEditor isBlock', { skipRoots, node })

    const isBlock = node.isBlock
    const isInline = node.isInline
    const shouldAdd =
      (options.target === 'block' && isBlock) ||
      (options.target === 'inline' && isInline) ||
      options.target === 'both'

    if (!shouldAdd) return

    const hasUuid = !!node.attrs?.[options.attributeName]
    // console.log('assignUuidsToEditor hasUuid', { hasUuid, node })
    if (!hasUuid) {
      const attrs = { ...node.attrs, [options.attributeName]: uuidv4() }
      _node = node
      _pos = attrs
      tr.setNodeMarkup(pos, undefined, attrs)
      modified = true
    }
  })
  // console.log('assignUuidsToEditor modifid', { modified }, _node, _pos)

  if (modified) {
    // console.log("assignUuidsToEditor be  ", _node, _pos)

    editor.view.dispatch(tr)
    // console.log("assignUuidsToEditor ok  ", _node, _pos)

    return true
  }
  return false
}

export const CustomUuidIdentificationExtension = Extension.create({
  name: extensionName,

  addOptions() {
    return {
      attributeName: extensionTagAttributeName,
      target: 'both', // "block" | "inline" | "both"
      // target: 'block', // "block" | "inline" | "both"
      // types: ['paragraph', 'heading', 'listItem', 'blockquote', 'table', 'tableRow', 'tableCell'],
      types: [
        'paragraph',
        'heading',
        'listItem',
        'blockquote',
        'table',
        'tableRow',
        'tableCell'
        // 'span',
        // 'textStyle' // <--- for inline spans
      ],

      ignoredNodes: [] // optional: node names to skip
    }
  },

  /**
   * Auto-inject schema attributes into configured node types
   */
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          [this.options.attributeName]: {
            default: null,
            // default: uuidv4(),
            // default: () => uuidv4(),
            parseHTML: (element) => element.getAttribute(this.options.attributeName),
            renderHTML: (attributes) =>
              attributes[this.options.attributeName]
                ? { [this.options.attributeName]: attributes[this.options.attributeName] }
                : {}
          }
        }
      }
    ]
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey(extensionName)

    return [
      new Plugin({
        key: pluginKey,
        /* appendTransaction: (transactions, oldState, newState) => {
          const tr = newState.tr
          let modified = false

          newState.doc.descendants((node, pos) => {
            if (node.isText) return
            if (!node.attrs?.[this.options.attributeName]) {
              const attrs = { ...node.attrs, [this.options.attributeName]: uuidv4() }
              tr.setNodeMarkup(pos, undefined, attrs)
              modified = true
            }
          })

          return modified ? tr : null
        } */
        // run after transactions (used to detect paste/cloned content)
        appendTransaction: (transactions, oldState, newState) => {
          // console.log('CustomUuidIdentificationExtension appendTransaction', { transactions })
          return
          // if configured to regenerate on paste/cloned content, check whether any transaction changed the doc
          const docChanged = transactions.some((t) => t.docChanged)
          if (!docChanged) return null

          // We only want to regenerate UUIDs if regenerateOnPaste is true
          // if (!this.options.regenerateOnPaste) return null

          // Gather changes and set uuids on nodes that are missing OR regenerate existing uuids (optional)
          const tr = newState.tr
          let modified = false
          const skipRoots: number[] = []

          newState.doc.descendants((node, pos) => {
            if (node.isText) return

            if (
              skipRoots.some(
                (rootPos) => pos > rootPos && pos < rootPos + newState.doc.nodeAt(rootPos).nodeSize
              )
            ) {
              return
            }

            if (this.options.ignoreNodeTypes?.includes(node.type.name)) {
              if (this.options.ignoreChildren) skipRoots.push(pos)
              return
            }

            const isBlock = node.isBlock
            const isInline = node.isInline
            const shouldAdd =
              (this.options.target === 'block' && isBlock) ||
              (this.options.target === 'inline' && isInline) ||
              this.options.target === 'both'

            if (!shouldAdd) return

            const hasUuid = !!node.attrs?.[this.options.attributeName]

            // If pasted content already had uuids, regenerate them to avoid duplicates
            // or if missing, add one
            if (!hasUuid) {
              // if (!hasUuid || this.options.regenerateOnPaste) {
              const attrs = { ...node.attrs, [this.options.attributeName]: uuidv4() }
              // tr.setNodeMarkup(pos, undefined, attrs)
              modified = true
              // console.log("assignUuidsToEditor be  ", node, attrs)

            }

          })

          return modified ? tr : null
        }
      })
    ]
  },
  /**
   * ProseMirror plugin to assign UUIDs automatically
   */
  /* addProseMirrorPlugins() {
    const { attributeName, target, ignoredNodes } = this.options
    const pluginKey = new PluginKey('uuid-plugin')

    return [
      new Plugin({
        key: pluginKey,

        appendTransaction: (transactions, oldState, newState) => {
          let tr = newState.tr
          let modified = false

          newState.doc.descendants((node: ProseMirrorNode, pos: number) => {
            if (ignoredNodes.includes(node.type.name)) return

            if (target === 'block' && !node.isBlock) return
            if (target === 'inline' && node.isBlock) return

            const hasUuid = node.attrs[attributeName]
            if (!hasUuid) {
              tr = tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                [attributeName]: uuidv4()
              })
              modified = true
            }
          })

          return modified ? tr : null
        }
      })
    ]
  } */

  // Initialize incoming document nodes on editor create
  onCreate() {
    setTimeout(() => {
      assignUuidsToEditor(this.editor, this.options)
    }, 3 * 1000);
  },

  // Also run on update to catch nodes created by user actions
  onUpdate() {
    // assignUuidsToEditor(this.editor, this.options)
  },

  addCommands() {
    return {
      // regenerate all UUIDs in the doc (useful after cloning)
      regenerateUuid:
        () =>
          ({ editor }) => {
            assignUuidsToEditor(editor, this.options)
            return true
          }
    }
  }
})

/* import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { v4 as uuidv4 } from 'uuid'

export const CustomUuidIdentificationExtension = Extension.create({
  name: 'uuidBlock',

  addOptions() {
    return {
      attributeName: 'data-uuid'
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('uuidBlockPlugin'),

        appendTransaction: (transactions, oldState, newState) => {
          const tr = newState.tr
          let modified = false

          // Iterate all block nodes
          newState.doc.descendants((node, pos) => {
            if (!node.isBlock) return

            // Skip if node already has a uuid
            if (node.attrs?.[this.options.attributeName]) return

            // Add uuid attribute
            const attrs = { ...node.attrs, [this.options.attributeName]: uuidv4() }
            tr.setNodeMarkup(pos, undefined, attrs)
            modified = true
          })

          return modified ? tr : null
        }
      })
    ]
  }
})
 */

// import { Extension } from '@tiptap/core'
// import { v4 as uuidv4 } from 'uuid'
// import { Plugin, PluginKey } from 'prosemirror-state'
// import { Node as ProseMirrorNode } from 'prosemirror-model'

// /**
//  * Step 1: Extend all nodes to allow a `data-uuid` attribute
//  */
// export const CustomUuidAttributeExtension = Extension.create({
//   name: 'uuidAttribute',

//   addGlobalAttributes() {
//     return [
//       {
//         types: this.options.types || [
//           'paragraph',
//           'heading',
//           'listItem',
//           'blockquote',
//           'table',
//           'tableRow',
//           'tableCell'
//         ],
//         attributes: {
//           'data-uuid': {
//             default: null,
//             parseHTML: (element) => element.getAttribute('data-uuid'),
//             renderHTML: (attributes) => {
//               return attributes['data-uuid'] ? { 'data-uuid': attributes['data-uuid'] } : {}
//             }
//           }
//         }
//       }
//     ]
//   }
// })

// /**
//  * Step 2: Manage automatic UUID assignment
//  */
// export const CustomUuidIdentificationExtension = Extension.create({
//   name: 'uuid',

//   addOptions() {
//     return {
//       attributeName: 'data-uuid',
//       target: 'block', // "block" | "inline" | "both"
//       ignoredNodes: [] // optional: node names to ignore
//     }
//   },

//   addProseMirrorPlugins() {
//     const { attributeName, target, ignoredNodes } = this.options
//     const pluginKey = new PluginKey('uuid-plugin')

//     return [
//       new Plugin({
//         key: pluginKey,

//         appendTransaction: (transactions, oldState, newState) => {
//           let tr = newState.tr
//           let modified = false

//           newState.doc.descendants((node: ProseMirrorNode, pos: number) => {
//             // Skip ignored node types
//             if (ignoredNodes.includes(node.type.name)) return

//             // Handle block vs inline
//             if (target === 'block' && !node.isBlock) return
//             if (target === 'inline' && node.isBlock) return

//             const hasUuid = node.attrs[attributeName]
//             if (!hasUuid) {
//               tr = tr.setNodeMarkup(pos, undefined, {
//                 ...node.attrs,
//                 [attributeName]: uuidv4()
//               })
//               modified = true
//             }
//           })

//           return modified ? tr : null
//         }
//       })
//     ]
//   }
// })
