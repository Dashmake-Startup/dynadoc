import { Table, createColGroup } from '@tiptap/extension-table'
import { mergeAttributes } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { DOMOutputSpec } from '@tiptap/pm/model'
import { TableRowGroup } from './TableRowGroup'

import { DOMSerializer } from '@tiptap/pm/model'
import TableRowPlus from './TableRowPlus'
// node: a ProseMirror node (e.g. from editor.state.doc or nodeView)
function nodeToHTML(node, schema) {
  const serializer = DOMSerializer.fromSchema(schema)
  const fragment = serializer.serializeFragment(node.content)
  const div = document.createElement('div')
  div.appendChild(fragment)
  return div.innerHTML
}

export const TablePlus = Table.extend({
  // content: 'tableRow+',
  content: '(tableRowGroup|tableRow)+',
  addExtensions() {
    // return [TableRowPlus]
    return [TableRowGroup]
  },
  renderHTML({ node, HTMLAttributes }) {
    console.log('node renderHTML Table ', node, HTMLAttributes)
    const table: DOMOutputSpec = [
      // 'div',
      'table',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        border: 1
      }),
      0
    ]
    return table
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('table')
      console.log('node addNodeView Table ', node )
      console.log('node addNodeView Table json ', node.toJSON() )

      // log current HTML of node (via serializer)
      console.log('node addNodeView Table HTML:', nodeToHTML(node, this.editor.schema))

      // const tbody = document.createElement('tbody')
      // dom.appendChild(tbody)
      let maxCellCount = 0
      node.forEach((child) => {
        if (child.type.name === 'tableRowGroup') {
          child.forEach((row) => {
            if (row.type.name === 'tableRow') {
              if (row.childCount > maxCellCount) {
                maxCellCount = row.childCount
              }
            }
          })
        } else if (child.type.name === 'tableRow') {
          if (child.childCount > maxCellCount) {
            maxCellCount = child.childCount
          }
        }
      })

      dom.style.setProperty('--cell-count', maxCellCount.toString())
      // return { dom, contentDOM: tbody }
      return { dom, contentDOM: dom }
    }
  }
})

export default TablePlus
