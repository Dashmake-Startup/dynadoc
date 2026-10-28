import { BulletList } from '@tiptap/extension-bullet-list'
import { OrderedList } from '@tiptap/extension-ordered-list'
import { TaskList } from '@tiptap/extension-task-list'
import ListItem from '@tiptap/extension-list-item'
import { Editor } from '@tiptap/core'
import { Plugin, NodeSelection, TextSelection, PluginKey } from 'prosemirror-state'

export const listMarkerSelectionKey = new PluginKey('listMarkerSelection')

export const CustomListStyleExtensionCommands = {
  setOrderedListStyle: (editor: Editor, styleType: string, preset: string = 'default') => {
    if (!editor) return;
    editor.chain()
      .focus()
      // If not in an ordered list, toggle it
      .command(({ commands, state }) => {
        if (!editor.isActive('orderedList')) {
          return commands.toggleOrderedList();
        }
        return true;
      })
      .updateAttributes('orderedList', { styleType, preset })
      .run();
  },

  // REAL Restart at 1 (Sets value on the LI, not the whole OL)
  /* restartNumbering: (editor: Editor) => {
    editor.chain().focus().updateAttributes('listItem', { value: 1 }).run();
  },

  // Set Start Value (For the whole list)
  setStartValue: (editor: Editor, value: number) => {
    editor.chain().focus().updateAttributes('orderedList', { start: value }).run();
  },

  continueNumbering: (editor: Editor) => {
    // Remove the 'value' override to let it flow naturally
    editor.chain().focus().updateAttributes('listItem', { value: null }).run();
  } */

  restartNumbering: (editor: Editor) => {
    editor.chain().focus().updateAttributes('orderedList', { start: 1, continueAuto: false }).run();
  },

  setStartValue: (editor: Editor, value: number) => {
    editor.chain().focus().updateAttributes('orderedList', { start: value, continueAuto: false }).run();
  },
  continueNumbering: (editor: Editor) => {
    editor.chain().focus().updateAttributes('orderedList', { start: null, continueAuto: true }).run();
  }
};

/**
 * Merges attributes into a clean HTML object.
 * Note: Svelte/Tiptap prefers data-attributes for custom state.
 */
function normalizeListAttrs(attrs: Record<string, any>) {
  const next = { ...attrs }
  const styles: string[] = []

  if (next.styleType) {
    styles.push(`list-style-type:${next.styleType}`)
    next['data-list-style'] = next.styleType
  }
  if (next.stylePosition) {
    styles.push(`list-style-position:${next.stylePosition}`)
    next['data-list-position'] = next.stylePosition
  }
  if (next.markerColor) {
    styles.push(`--list-marker-color:${next.markerColor}`)
  }
  if (next.markerSize) {
    styles.push(`--list-marker-size:${next.markerSize}`)
  }
  if (next.markerWeight) {
    styles.push(`--list-marker-weight:${next.markerWeight}`)
  }

  if (styles.length) {
    next.style = [next.style, styles.join(';')].filter(Boolean).join('; ')
  }

  if (next.preset) {
    next['data-list-preset'] = next.preset
  }

  // Cleanup internal keys so they don't render as invalid HTML attributes
  delete next.styleType
  delete next.stylePosition
  delete next.preset
  delete next.markerColor
  delete next.markerSize
  delete next.markerWeight

  return next
}

function normalizeListItemAttrs(attrs: Record<string, any>) {
  const next = { ...attrs }
  const styles: string[] = []

  if (next.markerColor) {
    styles.push(`--list-marker-color:${next.markerColor}`)
  }
  if (next.markerSize) {
    styles.push(`--list-marker-size:${next.markerSize}`)
  }
  if (next.markerWeight) {
    styles.push(`--list-marker-weight:${next.markerWeight}`)
  }
  if (next.markerFont) {
    styles.push(`--list-marker-font:${next.markerFont}`)
  }
  if (next.markerStyle) {
    styles.push(`--list-marker-style:${next.markerStyle}`)
  }
  if (next.markerDecoration) {
    styles.push(`--list-marker-decoration:${next.markerDecoration}`)
  }
  if (next.markerBg) {
    styles.push(`--list-marker-bg:${next.markerBg}`)
  }
  if (next.markerShadow) {
    styles.push(`--list-marker-shadow:${next.markerShadow}`)
  }
  if (next.markerTransform) {
    styles.push(`--list-marker-transform:${next.markerTransform}`)
  }
  if (next.matchContent) {
    next['data-match-content'] = 'true'
  }

  if (styles.length) {
    next.style = [next.style, styles.join(';')].filter(Boolean).join('; ')
  }

  delete next.markerColor
  delete next.markerSize
  delete next.markerWeight
  delete next.markerFont
  delete next.markerStyle
  delete next.markerDecoration
  delete next.markerBg
  delete next.markerShadow
  delete next.markerTransform
  delete next.matchContent

  return next
}

export const CustomListItem = ListItem.extend({
  content: 'block+', // Crucial: Allows H1/H2 inside the LI
  addAttributes() {
    return {
      ...this.parent?.(),
      markerColor: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-color') || null
      },
      markerSize: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-size') || null
      },
      markerWeight: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-weight') || null
      },
      markerFont: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-font') || null
      },
      markerStyle: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-style') || null
      },
      markerDecoration: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-decoration') || null
      },
      markerBg: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-bg') || null
      },
      markerShadow: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-shadow') || null
      },
      markerTransform: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-transform') || null
      },
      matchContent: {
        default: true,
        parseHTML: element => element.getAttribute('data-match-content') !== 'false'
      },
      value: {
        default: null,
        parseHTML: element => element.getAttribute('value'),
        renderHTML: attributes => attributes.value ? { value: attributes.value } : {}
      }
    }
  },
  renderHTML({ HTMLAttributes }) {
    return ['li', normalizeListItemAttrs(HTMLAttributes), 0]
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: listMarkerSelectionKey,
        state: {
          init: () => ({ listPos: null as number | null }),
          apply: (tr, value) => {
            const meta = tr.getMeta('selectingAllMarkers')
            if (meta?.listPos != null) {
              return { listPos: meta.listPos }
            }
            if (tr.selectionSet) {
              return { listPos: null }
            }
            return value
          }
        },
        view: (view) => {
          let lastListPos: number | null = null
          const updateClasses = (listPos: number | null) => {
            if (lastListPos != null) {
              const prevDom = view.nodeDOM(lastListPos) as HTMLElement | null
              prevDom?.classList.remove('list-markers-selected', 'orderedList-selected', 'bulletList-selected')
            }
            if (listPos != null) {
              const nextDom = view.nodeDOM(listPos) as HTMLElement | null
              if (nextDom) {
                nextDom.classList.add('list-markers-selected')
                const node = view.state.doc.nodeAt(listPos)
                if (node?.type?.name === 'orderedList') {
                  nextDom.classList.add('orderedList-selected')
                }
                if (node?.type?.name === 'bulletList') {
                  nextDom.classList.add('bulletList-selected')
                }
              }
            }
            lastListPos = listPos
          }
          updateClasses(listMarkerSelectionKey.getState(view.state)?.listPos ?? null)
          return {
            update: (nextView) => {
              const listPos = listMarkerSelectionKey.getState(nextView.state)?.listPos ?? null
              if (listPos !== lastListPos) {
                updateClasses(listPos)
              }
            },
            destroy: () => {
              updateClasses(null)
            }
          }
        }
      })
    ]
  },
  addNodeView() {



    return ({ node, getPos, editor }) => {
      /* const container = document.createElement('li')
      container.className = 'ms-office-li'

      const marker = document.createElement('span')
      marker.className = 'li-marker'
      marker.contentEditable = 'false'
      marker.setAttribute('aria-hidden', 'true')

      marker.addEventListener('mousedown', (event) => {
        event.preventDefault()
      })

      marker.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (typeof getPos === 'function') {
          const pos = getPos()
          if (typeof pos === 'number') {
            editor.commands.setNodeSelection(pos)
          }
        }
      }) */


      const container = document.createElement('li')
      container.className = 'ms-office-li'

      const marker = document.createElement('span')
      marker.className = 'li-marker'
      marker.contentEditable = 'false'
      marker.setAttribute('aria-hidden', 'true')

      // Set the text cursor so the user feels they can "format" it
      marker.style.cursor = 'text'

      marker.addEventListener('mousedown', (event) => {
        // Prevent default to avoid the browser trying to place a 
        // real text cursor inside a contentEditable="false" element
        event.preventDefault()
      })

      marker.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()

        if (typeof getPos === 'function') {
          const pos = getPos()
          const { selection } = editor.state
          const isAlreadySelected =
            selection instanceof NodeSelection &&
            selection.node?.type?.name === 'listItem' &&
            selection.from === pos

          if (isAlreadySelected) {
            const resolved = editor.state.doc.resolve(pos)
            const parentDepth = resolved.depth - 1
            if (parentDepth >= 0) {
              const parentList = resolved.node(parentDepth)
              const listPos = resolved.before(parentDepth)
              if (
                parentList.type?.name === 'orderedList' ||
                parentList.type?.name === 'bulletList'
              ) {
                const tr = editor.state.tr.setSelection(
                  TextSelection.create(editor.state.doc, listPos, listPos + parentList.nodeSize)
                )
                tr.setMeta('selectingAllMarkers', { listPos })
                editor.view.dispatch(tr)
                editor.commands.focus()
                return
              }
            }
          }

          // setNodeSelection is what creates that "box" highlight around the marker
          editor.commands.setNodeSelection(pos)
        }
      })

      marker.addEventListener('contextmenu', () => {
        if (typeof getPos === 'function') {
          const pos = getPos()
          editor.commands.setNodeSelection(pos)
        }
      })

      marker.addEventListener('keydown', (event) => {
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          editor.commands.focus('start')
        }
      })

      const content = document.createElement('div')
      content.className = 'li-content'

      const applyAttrs = (attrs: Record<string, any>) => {
        if (attrs.markerColor) {
          container.style.setProperty('--list-marker-color', attrs.markerColor)
        } else {
          container.style.removeProperty('--list-marker-color')
        }
        if (attrs.markerSize) {
          container.style.setProperty('--list-marker-size', attrs.markerSize)
        } else {
          container.style.removeProperty('--list-marker-size')
        }
        if (attrs.markerWeight) {
          container.style.setProperty('--list-marker-weight', attrs.markerWeight)
        } else {
          container.style.removeProperty('--list-marker-weight')
        }
        if (attrs.markerFont) {
          container.style.setProperty('--list-marker-font', attrs.markerFont)
        } else {
          container.style.removeProperty('--list-marker-font')
        }
        if (attrs.markerStyle) {
          container.style.setProperty('--list-marker-style', attrs.markerStyle)
        } else {
          container.style.removeProperty('--list-marker-style')
        }
        if (attrs.markerDecoration) {
          container.style.setProperty('--list-marker-decoration', attrs.markerDecoration)
        } else {
          container.style.removeProperty('--list-marker-decoration')
        }
        if (attrs.markerBg) {
          container.style.setProperty('--list-marker-bg', attrs.markerBg)
        } else {
          container.style.removeProperty('--list-marker-bg')
        }
        if (attrs.markerShadow) {
          container.style.setProperty('--list-marker-shadow', attrs.markerShadow)
        } else {
          container.style.removeProperty('--list-marker-shadow')
        }
        if (attrs.markerTransform) {
          container.style.setProperty('--list-marker-transform', attrs.markerTransform)
        } else {
          container.style.removeProperty('--list-marker-transform')
        }

        if (attrs.matchContent) {
          container.setAttribute('data-match-content', 'true')
        } else {
          container.removeAttribute('data-match-content')
        }

        if (attrs.value) {
          container.setAttribute('value', attrs.value.toString())
        } else {
          container.removeAttribute('value')
        }
      }

      applyAttrs(node.attrs || {})
      container.append(marker, content)

      return {
        dom: container,
        contentDOM: content,
        update: (updatedNode) => {
          if (updatedNode.type.name !== node.type.name) return false
          applyAttrs(updatedNode.attrs || {})
          return true
        }
      }
    }
  }
})

export const CustomOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      preset: {
        default: 'default',
        parseHTML: element => element.getAttribute('data-list-preset'),
        renderHTML: attributes => ({ 'data-list-preset': attributes.preset })
      },
      styleType: {
        default: 'decimal',
        parseHTML: element => element.style.listStyleType
      },
      stylePosition: {
        default: null,
        parseHTML: element => element.style.listStylePosition || null
      },
      markerColor: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-color') || null
      },
      markerSize: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-size') || null
      },
      markerWeight: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-weight') || null
      },
      start: {
        default: 1,
        parseHTML: element => {
          const raw = element.getAttribute('start')
          const parsed = raw ? Number.parseInt(raw, 10) : 1
          return Number.isFinite(parsed) ? parsed : 1
        },
        renderHTML: attributes => (attributes.start && attributes.start !== 1 ? { start: attributes.start } : {})
      },
      continueAuto: {
        default: true,
        parseHTML: element => element.getAttribute('data-list-continue') !== 'false',
        renderHTML: attributes => ({ 'data-list-continue': attributes.continueAuto ? 'true' : 'false' })
      }
    }
  },
  // We override renderHTML to ensure normalizeListAttrs is applied
  renderHTML({ HTMLAttributes }) {
    const { start, ...rest } = HTMLAttributes;
    const attrs = normalizeListAttrs(rest);
    if (start && start !== 1) {
      attrs.start = start;
      attrs.style = [attrs.style, `--list-start:${start}`].filter(Boolean).join('; ')
    }
    return ['ol', attrs, 0]
  }
})

function countMeaningfulListItems(listNode: any): number {
  let count = 0
  listNode.forEach((child: any) => {
    if (child.type?.name !== 'listItem') return
    const text = (child.textContent || '').trim()
    if (text.length > 0) count += 1
  })
  return count
}

function findPreviousOrderedListAtDepth(doc: any, pos: number, depth: number) {
  let previous: { node: any; pos: number; depth: number } | null = null
  doc.nodesBetween(0, pos, (node: any, nodePos: number) => {
    if (node.type?.name === 'orderedList') {
      const resolved = doc.resolve(nodePos)
      if (resolved.depth === depth) {
        previous = { node, pos: nodePos, depth }
      }
    }
  })
  return previous
}

export const CustomOrderedListAutoContinue = CustomOrderedList.extend({
  addProseMirrorPlugins() {
    const plugins = this.parent?.() ?? []
    return [
      ...plugins,
      new Plugin({
        appendTransaction: (transactions: any[], oldState: any, newState: any) => {
          if (!transactions.some((tr) => tr.docChanged)) return null
          const tr = newState.tr
          let mutated = false

          newState.doc.descendants((node: any, pos: number) => {
            if (node.type?.name !== 'orderedList') return
            if (node.attrs?.continueAuto === false) return
            if (node.attrs?.start && node.attrs.start !== 1) return

            const depth = newState.doc.resolve(pos).depth
            const previous = findPreviousOrderedListAtDepth(newState.doc, pos, depth)
            if (!previous) return
            const previousCount = countMeaningfulListItems(previous.node)
            if (!previousCount) return
            const previousStart = Number.isFinite(previous.node.attrs?.start) ? previous.node.attrs.start : 1
            const nextStart = previousStart + previousCount
            if (!nextStart || nextStart <= 1) return

            tr.setNodeMarkup(pos, undefined, { ...node.attrs, start: nextStart })
            mutated = true
          })

          return mutated ? tr : null
        }
      })
    ]
  }
})

export const CustomBulletList = BulletList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      preset: { default: 'default' },
      styleType: { default: null },
      stylePosition: {
        default: null,
        parseHTML: element => element.style.listStylePosition || null
      },
      markerColor: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-color') || null
      },
      markerSize: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-size') || null
      },
      markerWeight: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-weight') || null
      }
    }
  },
  renderHTML({ HTMLAttributes }) {
    return ['ul', normalizeListAttrs(HTMLAttributes), 0]
  }
})

export const CustomTaskList = TaskList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      preset: { default: 'task' },
      stylePosition: {
        default: null,
        parseHTML: element => element.style.listStylePosition || null
      },
      markerColor: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-color') || null
      },
      markerSize: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-size') || null
      },
      markerWeight: {
        default: null,
        parseHTML: element => element.style.getPropertyValue('--list-marker-weight') || null
      }
    }
  },
  renderHTML({ HTMLAttributes }) {
    return ['ul', normalizeListAttrs(HTMLAttributes), 0]
  }
})
