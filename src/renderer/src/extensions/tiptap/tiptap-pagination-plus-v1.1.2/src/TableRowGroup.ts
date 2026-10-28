import { Node } from '@tiptap/core'
import { DOMOutputSpec } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'

import { DOMSerializer } from '@tiptap/pm/model'

// node: a ProseMirror node (e.g. from editor.state.doc or nodeView)
function nodeToHTML(node, schema) {
  const serializer = DOMSerializer.fromSchema(schema)
  const fragment = serializer.serializeFragment(node.content)
  const div = document.createElement('div')
  div.appendChild(fragment)
  return div.innerHTML
}

export const TableRowGroup = Node.create({
  name: 'tableRowGroup',
  group: 'tableRowGroup',
  // content: 'block+',
  content: 'tableRow+',
  tableRole: 'table',
  parseHTML() {
    return [
      {
        // tag: 'thead'
        tag: 'tbody'
      }
    ]
  },
  addNodeView() {
    return ({ node }) => {
      console.log('node addNodeView TableRowGroup ', node)

      // const dom = document.createElement('div')
      // dom.classList.add('table-row-group')
      // const tbody = document.createElement('tbody')
      // dom.appendChild(tbody)
      const dom = document.createElement('tbody')
      dom.classList.add('table-row-group')
      return { dom, contentDOM: dom }
    }
  },
  renderHTML() {
    // const table: DOMOutputSpec = ['thead', {}, 0]
    const table: DOMOutputSpec = ['tbody', {}, 0]
    return table
  },

  addProseMirrorPlugins() {
    const { editor } = this
    return [
      new Plugin({
        key: new PluginKey('tableRowGroupKey'),
        appendTransaction(_, oldState, newState) {
          const { doc, tr } = newState

          let modified = false

          newState.doc.descendants((node, pos) => {
            // 1. Clean invalid direct children of <table>
            if (node.type.name === 'table') {
              node.forEach((child, offset) => {
                const childPos = pos + 1 + offset
                console.log(
                  'node addProseMirrorPlugins child table HTML:',
                  nodeToHTML(child, editor.schema)
                )
                /* if (child.type.name !== 'tableRow') {
                  modified = true
                  // unwrap: replace the wrapper with its content
                  tr.replaceWith(childPos, childPos + child.nodeSize, child.content)
                } */

                if (child.type.name === 'tableRow') {
                  child.forEach((childRow, offset) => {
                    const childRowPos = pos + 1 + offset
                    console.log(
                      'node addProseMirrorPlugins childRow tableRow HTML:',
                      childRow,
                      nodeToHTML(childRow, editor.schema)
                    )
                    if (childRow.type.name == 'tableCell') {
                      // if (childRow.type.name !== 'tableCell' && childRow.type.name !== 'tableHeader') {
                      // modified = true
                      // tr.replaceWith(childPos, childPos + child.nodeSize, childRow.content)
                      console.log(
                        'node addProseMirrorPlugins childRow tableRow modified:',
                        childRow,
                        nodeToHTML(childRow, editor.schema)
                      )
                    }
                  })
                }
              })
            }

            // 2. Clean invalid children of <tr> (like a wrapping <div>)
            /* if (node.type.name === 'tableRow') {
              node.forEach((child, offset) => {
                const childPos = pos + 1 + offset
                 console.log(
                   'node addProseMirrorPlugins child tableRow HTML:',child,
                   nodeToHTML(child, editor.schema)
                 )
                if (child.type.name !== 'tableCell' && child.type.name !== 'tableHeader') {
                  modified = true
                  tr.replaceWith(childPos, childPos + child.nodeSize, child.content)
                 console.log(
                   'node addProseMirrorPlugins child tableRow modified:',
                   child,
                   nodeToHTML(child, editor.schema)
                 )
                }
              })
            } */
            // return true
          })

          doc.descendants((tableNode, pos) => {
            if (tableNode.type.name !== 'table') return false

            /* // log current HTML of node (via serializer)
            console.log(
              'node addProseMirrorPlugins tableNode HTML:',
              nodeToHTML(tableNode, editor.schema)
            )

            // iterate table children
            tableNode.forEach((child, offset) => {
              const childPos = pos + 1 + offset

              console.log(
                'node addProseMirrorPlugins tableNode child HTML:',
                child,
                nodeToHTML(child, editor.schema)
              )


              // if table has something that's not a tableRow, unwrap it
              if (child.type.name !== 'tableRow') {
                modified = true
                // replace it with its own content
                tr.replaceWith(childPos, childPos + child.nodeSize, child.content)
                return false
              }

              // handle tr > div issue
              child.forEach((cell, cellOffset) => {
                const cellPos = childPos + 1 + cellOffset

                console.log(
                  'node addProseMirrorPlugins tableNode cell HTML:',cell,
                  nodeToHTML(cell, editor.schema)
                )

                if (cell.type.name === 'paragraph' && cell.firstChild?.type.name === 'div') {
                  // unwrap the <div>, keep its content
                  modified = true
                  tr.replaceWith(cellPos, cellPos + cell.nodeSize, cell.firstChild.content)
                }
              })
            }) */

            const rowGroups: ProseMirrorNode[] = []
            const rows: ProseMirrorNode[] = []
            const oldRowGroupStructure: Record<number, number> = {}

            // Collect all rows, whether they're direct children or inside row groups
            tableNode.forEach((child, childOffset, childIndex) => {
              if (child.type.name === 'tableRowGroup') {
                oldRowGroupStructure[childIndex] = child.childCount
                child.forEach((row) => {
                  if (row.type.name === 'tableRow') {
                    rows.push(row)
                  }
                })
              } else if (child.type.name === 'tableRow') {
                oldRowGroupStructure[childIndex] = 1
                rows.push(child)
              }
            })

            // Group the rows into tableRowGroup with rowspan logic
            let rowSpanList: Record<number, number> = {}
            for (let i = 0; i < rows.length; i++) {
              rowSpanList[i + 1] = getMaximumRowSpan(rows[i])
            }
            const rowGroupList = mergeOverlappingGroups(getRowGroupList(rows.length, rowSpanList))
            const newRowGroupStructure: Record<number, number> = Object.assign(
              {},
              rowGroupList.map((group) => group.length)
            )

            if (!deepMatch(oldRowGroupStructure, newRowGroupStructure)) {
              const nodeType = editor.schema.nodes.tableRowGroup
              const rowGroupMoreThanOne = rowGroupList.findIndex((group) => group.length > 1)
              for (let i = 0; i < rowGroupList.length; i++) {
                const rowGroup = rows.slice(
                  Math.min(...rowGroupList[i]) - 1,
                  Math.max(...rowGroupList[i])
                )
                if (rowGroup.length > 0) {
                  if (rowGroupMoreThanOne !== -1) {
                    rowGroups.push(nodeType.createAndFill(null, rowGroup) as ProseMirrorNode)
                  } else {
                    rowGroups.push(rowGroup[0] as ProseMirrorNode)
                  }
                }
              }
              const tableNodeType = editor.schema.nodes.table
              const tableNodeNew = tableNodeType.createAndFill(null, rowGroups) as ProseMirrorNode
              tr.replaceWith(pos, pos + tableNode.nodeSize, tableNodeNew)

              modified = true
            }

            return false // Do not descend into table children
          })

          return modified ? tr : null
        }
      })
    ]
  }
})

export const getMaximumRowSpan = (row: ProseMirrorNode) => {
  let maxRowSpan = 0
  row.forEach((child) => {
    const rowspan = child.attrs.rowspan || 1
    if (rowspan > maxRowSpan) {
      maxRowSpan = rowspan
    }
  })
  return maxRowSpan
}

function deepMatch(obj1: Record<number, number>, obj2: Record<number, number>) {
  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
    return obj1 === obj2
  }

  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)

  if (keys1.length !== keys2.length) {
    return false
  }

  for (let key of keys1) {
    // @ts-ignore
    if (!obj2.hasOwnProperty(key) || !deepMatch(obj1[key], obj2[key])) {
      return false
    }
  }

  return true
}

export const getRowGroupList = (totalRows: number, rowSpanList: Record<number, number>) => {
  const rowGroupListWithRowCount = []

  for (let i = 1; i <= totalRows; i++) {
    const span = rowSpanList[i] || 1
    const group = []

    for (let j = 0; j < span && i + j <= totalRows; j++) {
      group.push(i + j)
    }

    rowGroupListWithRowCount.push(group)
  }

  return rowGroupListWithRowCount
}

export const mergeOverlappingGroups = (inputGroups: number[][]): number[][] => {
  const result: number[][] = []

  for (const group of inputGroups) {
    let merged = false
    const groupSet = new Set(group)

    for (let i = 0; i < result.length; i++) {
      const existingSet = new Set(result[i])
      const intersection = Array.from(groupSet).some((val) => existingSet.has(val))

      if (intersection) {
        // Merge and update
        result[i] = Array.from(new Set([...result[i], ...group]))
        merged = true
        break
      }
    }

    if (!merged) {
      result.push([...group])
    }
  }

  // Recursively merge in case earlier merges caused new overlaps
  const allSets = result.map((g) => new Set(g))
  for (let i = 0; i < allSets.length; i++) {
    for (let j = i + 1; j < allSets.length; j++) {
      const overlap = Array.from(allSets[i]).some((val) => allSets[j].has(val))
      if (overlap) {
        // Merge and restart process
        return mergeOverlappingGroups(result.map((g) => [...g]))
      }
    }
  }

  // Sort each group
  return result.map((g) => Array.from(new Set(g)).sort((a, b) => a - b))
}
