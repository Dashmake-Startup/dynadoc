// import { Extension, Mark, Node } from '@tiptap/core'
import { Node, Mark, mergeAttributes, Extension } from '@tiptap/core'
import { mount } from 'svelte';

import { Decoration, DecorationSet } from 'prosemirror-view'
import { Node as ProseMirrorNode } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'
import CustomProgrammingStyleCommentExtensionWidget from './components/CustomProgrammingStyleCommentExtensionWidget.svelte';

let inlineTagName = 'visibility',
  blockTagName = 'visibility'

// import { Decoration } from 'prosemirror-view'

function createCommentDecoration(from, to, comment, restoreAttrs) {
  return Decoration.inline(
    from,
    to,
    {
      nodeName: 'span',
      ...restoreAttrs, // reapply any parent styles/classes/etc.
      class: 'commented-text'
      // inline decoration gets an actual DOM node we can extend
    },
    {
      inclusiveStart: true,
      inclusiveEnd: true
    }
  )
}
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    CustomProgrammingStyleComment: {
      setProgrammingStyleComment: (type: string) => ReturnType
      unsetProgrammingStyleComment: (pos: number) => ReturnType
      toggleProgrammingStyleComment: (type: string) => ReturnType
    }
  }
}


export const CustomProgrammingStyleCommentExtension = Node.create({
  // name: 'customProgrammingStyleCommentExtension',
  // name: 'comment',
  name: blockTagName,
  // group: 'block',
  // atom: true,
  // selectable: true,
  // content: 'inline*',

  inline: true,
  atom: true,
  selectable: true,
  group: 'inline',
  addAttributes() {
    // return { value: { default: '' } }
    return {
      value: { default: '' },
      marks: { default: [] }, // inline marks
      context: { default: [] }, // parent node info
      author: { default: null }
    }
  },
  parseHTML() {
    return [{ tag: blockTagName, getAttrs: (el) => ({ value: el.getAttribute('value') || '' }) }]
  },
  renderHTML({ node }) {
    return [
      blockTagName,
      // { value: node.attrs.value, class: 'programming-style-comment block' }
      /* {
        value: node.attrs.value,
        marks: JSON.stringify(node.attrs.marks),
        context: JSON.stringify(node.attrs.context),
        author: node.attrs.author || '',
        class: 'programming-style-comment block'
      }, */

      {
        value: node.attrs.value ?? '',
        author: node.attrs.author ?? '',
        marks: Array.isArray(node.attrs.marks)
          ? JSON.stringify(node.attrs.marks)
          : node.attrs.marks,
        // marks: node.attrs.marks
        //   ? JSON.stringify(node.attrs.marks)
        //   : undefined,
        context: Array.isArray(node.attrs.context)
          ? JSON.stringify(node.attrs.context)
          : node.attrs.context,
        class: 'programming-style-comment block',
      },
      // 0
    ]
  },

  addOptions() {
    return {
      inlineTagName: inlineTagName,
      blockTagName: inlineTagName,
      caretColor: '#f97316',
      attributeName: 'value'
    }
  },

  addNodeView() {

    return ({ node, editor, getPos }) => {

      // wrapper for both caret + label
      const wrapper = document.createElement('span')
      wrapper.classList.add(
        'programming-style-comment-wrapper',
        'relative',
        'inline-flex',
        'group'
      )

      // caret
      const caretEl = document.createElement('span')
      caretEl.className = 'programming-style-comment-caret'
      wrapper.appendChild(caretEl)

      // mount Svelte component here instead of labelEl
      const labelContainer = document.createElement('span')
      labelContainer.className = 'programming-style-comment-caret-label'

      wrapper.appendChild(labelContainer)

      mount(CustomProgrammingStyleCommentExtensionWidget, {
        // new CustomProgrammingStyleCommentExtensionWidget({
        target: labelContainer,
        props: {
          __author: node.attrs.author || 'Unknown',
          __text: node.attrs.value || '',
          __onUnset: () => {
            // call the command here
            this.editor.commands.unsetProgrammingStyleComment(getPos())
          }
        }
      })

      // label
      /* const labelEl = document.createElement('span')
      labelEl.className = 'programming-style-comment-caret-label'
      labelEl.textContent = `💬 ${node.attrs.value}`
      wrapper.appendChild(labelEl)

      // label (author name)
      // const labelEl = document.createElement('span')
      // labelEl.className = 'programming-style-comment-caret-label'
      // labelEl.textContent = `💬 ${node.attrs.author || 'Unknown'}`
      // wrapper.appendChild(labelEl)

      // main content (the comment text itself, optional)
      // if (node.attrs.value) {
      if (node.attrs.author) {
        const authorEl = document.createElement('span')
        authorEl.className = 'programming-style-comment-caret-author'
        authorEl.textContent = node.attrs.author
        wrapper.appendChild(authorEl)
      }

      // uncomment button
      const button = document.createElement('button')
      button.className = 'programming-style-comment-caret-button uncomment'
      button.textContent = 'Uncomment'
      // button.style.width = '100%'
      button.onclick = (e) => {
        e.preventDefault()
        e.stopPropagation()
        // Call your tiptap command
        this.editor.commands.unsetProgrammingStyleComment(pos)
      }
      wrapper.appendChild(button) */


      return { dom: wrapper }
      // return { dom: wrapper, destroy: unsubscribe }
    }
  },

  addCommands() {
    return {
      setProgrammingStyleComment:
        () =>
          // (type: 'inline' | 'block') =>
          ({ chain, state }) => {
            const { from, to } = state.selection
            const selectedText = state.doc.textBetween(from, to, '').trim()
            if (!selectedText) return false

            let marks: any[] = []
            let context: any[] = []

            // Collect marks
            state.doc.nodesBetween(from, to, (node) => {
              if (node.marks?.length) {
                // context.push({
                //   type: node.type.name,
                //   attrs: node.attrs
                // })
                // marks = node.marks
                // marks = node.marks.map((m) => m)
                marks = node.marks.map((m) => m.toJSON())
              }
            })

            // Collect parent chain context
            let $from = state.doc.resolve(from)
            for (let depth = $from.depth; depth > 0; depth--) {
              const node = $from.node(depth)
              if (node && node.attrs) {
                context.push({
                  type: node.type.name,
                  attrs: node.attrs
                })
              }
            }

            // const content =
            //   type === 'inline'
            //     ? [] // inline: zero-width or empty content
            //     : [[{ type: 'text', text: '' }]] //
            let nodeType = blockTagName
            // let nodeType = type === 'inline' ? inlineTagName : blockTagName

            console.log('nodeType', nodeType)


            const insertNode = state.schema.nodes.visibility.create(
              {
                value: selectedText, marks, context,
              },
              //  state.schema.text(normalizeStringLength(encryptedSelectedText, selectedText.length))
            )
            console.log("insertContentAtValue insertNode ", insertNode)
            //  return true
            const tr = state.tr.replaceRangeWith(from, to, insertNode)

            // Move cursor after inserted suggestion node
            const resolvedPos = tr.doc.resolve(from + insertNode.nodeSize)
            tr.setSelection(state.selection.constructor.near(resolvedPos))

            return true
          },
      setProgrammingStyleComment2:
        () =>
          // (type: 'inline' | 'block') =>
          ({ chain, state }) => {
            const { from, to } = state.selection
            const selectedText = state.doc.textBetween(from, to, ' ').trim()
            if (!selectedText) return false

            let marks: any[] = []
            let context: any[] = []

            // Collect marks
            state.doc.nodesBetween(from, to, (node) => {
              if (node.marks?.length) {
                marks = node.marks.map((m) => m.toJSON())
              }
            })

            // Collect parent chain context
            let $from = state.doc.resolve(from)
            for (let depth = $from.depth; depth > 0; depth--) {
              const node = $from.node(depth)
              if (node && node.attrs) {
                context.push({
                  type: node.type.name,
                  attrs: node.attrs
                })
              }
            }

            // const content =
            //   type === 'inline'
            //     ? [] // inline: zero-width or empty content
            //     : [[{ type: 'text', text: '' }]] //
            let nodeType = blockTagName
            // let nodeType = type === 'inline' ? inlineTagName : blockTagName

            console.log('nodeType', nodeType)
            const insertContentAtValue =
              type === 'inline'
                ? {
                  // type: 'c',
                  type: inlineTagName,
                  // type: nodeType,
                  attrs: { value: selectedText, marks, context }
                } // inline: zero-width or empty content
                : {
                  type: blockTagName,
                  // type: nodeType,

                  // type: 'comment',
                  attrs: { value: selectedText, marks, context },
                  content: [{ type: 'text', text: '' }]
                } // block: empty content node

            // return chain().deleteRange({ from, to }).insertContentAt(from, insertContentAtValue).focus().run()
            return chain().deleteRange({ from, to }).
              insertContentAt(from, insertContentAtValue)
              .setTextSelection(from + 1) // 👈 move cursor
              .focus()
              .run()
            // return chain()  
            // .focus()
          },

      unsetProgrammingStyleComment:
        /* (pos: number) =>
        ({ state, tr, dispatch }) => {
          const { from, to } = state.selection
          let changed = false

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === 'comment' || node.type.name === 'c') {
              const text = node.attrs.value || ''

              // replace the comment node with the stored text
              tr = tr.insertText(text, pos, pos + node.nodeSize)
              changed = true
            }
          })

          if (changed && dispatch) {
            dispatch(tr)
            return true
          }
          return false
        }, */
        (pos: number) =>
          ({ state, dispatch }) => {
            console.log('unsetProgrammingStyleComment eenteer', pos)

            const $pos = state.doc.resolve(pos)
            const node: ProseMirrorNode | null = $pos.nodeAfter
            console.log('unsetProgrammingStyleComment nodeAfter', node)

            if (!node) return false
            if (node.type.name !== inlineTagName && node.type.name !== blockTagName) return false
            // if (node.type.name !== 'comment' && node.type.name !== 'c') return false
            console.log('unsetProgrammingStyleComment comment', node)

            // const value = node.attrs.value
            // if (!value) return false

            const value = node.attrs.value
            const marksData = !Array.isArray(node.attrs.marks)
              ? JSON.parse(node.attrs.marks)
              : node.attrs.marks || []
            const contextData = !Array.isArray(node.attrs.context)
              ? JSON.parse(node.attrs.context)
              : node.attrs.context || []
            // const contextData = node.attrs.context || []

            console.log('unsetProgrammingStyleComment value', { value, marksData, contextData })

            // Restore marks
            const marks = marksData.map((m) => state.schema.markFromJSON(m))
            let content: any = { type: 'text', text: value, marks }
            console.log('unsetProgrammingStyleComment marks', marks, content)

            // const marksData = node.attrs.marks || []
            // const marks = marksData.map((m) => state.schema.markFromJSON(m))

            const textNode = state.schema.text(node.attrs.value, marks)

            // Restore parent wrapping nodes
            /* for (let i = contextData.length - 1; i >= 0; i--) {
              const ctx = contextData[i]
              console.log('unsetProgrammingStyleComment ctx', ctx, ctx.attrs)
              content = {
                type: ctx.type,
                attrs: ctx.attrs
                // content: [content]
              }
            } */
            console.log(
              'unsetProgrammingStyleComment textNode',
              textNode
              // state.schema.nodeFromJSON(content.marks)
            )
            const tr = state.tr.replaceWith(
              pos,
              pos + node.nodeSize,
              textNode
              // state.schema.nodeFromJSON(content.marks)
            )
            if (dispatch) dispatch(tr)
            return true
            // const tr = state.tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(value))

            // if (dispatch) dispatch(tr)
            // return true
          },
      toggleProgrammingStyleComment:
        () =>
          // (type: 'inline' | 'block') =>
          ({ chain, state, commands }) => {
            const { from, to, $from } = state.selection
            const selectedText = state.doc.textBetween(from, to, '').trim()
            // console.log('unsetProgrammingStyleComment eenteer toggleProgrammingStyleComment ', { selectedText, from, to, $from })

            // if (!selectedText) return false

            const node = $from.nodeAfter
            const nodeType = blockTagName
            // const nodeType = type == 'inline' ? inlineTagName : blockTagName
            const isCustomProgrammingStyleCommentExtensionCommentNode = node?.type.name === nodeType

            // console.log('unsetProgrammingStyleComment eenteer toggleProgrammingStyleComment2 ', { isCustomProgrammingStyleCommentExtensionCommentNode, selectedText, from, to, $from })

            return isCustomProgrammingStyleCommentExtensionCommentNode
              ? commands.unsetProgrammingStyleComment(from)
              // ? commands.deleteSelection()
              : commands.setProgrammingStyleComment()
            // : commands.setProgrammingStyleComment(type)
          }
    }
  },

  /* addCommands() {
    return {
      setProgrammingStyleComment:
        (type: 'inline' | 'block') =>
        ({ chain, state }) => {
          const { from, to } = state.selection
          const selectedText = state.doc.textBetween(from, to, ' ').trim()
          if (!selectedText) return false

          if (type === 'inline') {
            // return chain().setMark(inlineTagName, { value: selectedText }).run()
            return chain()
              .deleteRange({ from, to })
              .insertContentAt(from, {
                // type: 'em',
                type: inlineTagName,
                attrs: { value: selectedText }
                //  content: [{ type: 'text', text: '' }]
                // content: [{ type: 'text', text: selectedText }]
              })
              .run()
          } else {
            console.log('insert block comment', selectedText)
            return chain()
              .deleteRange({ from, to })
              .insertContentAt(from, {
                // type: 'em',
                type: inlineTagName,
                attrs: { value: selectedText },
                content: [{ type: 'text', text: '' }]
                // content: [{ type: 'text', text: selectedText }]
              })
              .run()
          }
        },

      toggleProgrammingStyleComment:
        (type: 'inline' | 'block') =>
        ({ chain, state, commands }) => {
          const { from, to, $from } = state.selection
          const selectedText = state.doc.textBetween(from, to, ' ').trim()
          if (!selectedText) return false

          // if (type === 'inline') {
          //   const hasMark = state.doc.rangeHasMark(from, to, state.schema.marks.c)
          //   return hasMark ? commands.unsetMark(inlineTagName) : commands.setProgrammingStyleComment('inline')
          // } else {
          const node = $from.nodeAfter
          const isProgrammingStyleComment = node?.type.name === inlineTagName || blockTagName
          return isProgrammingStyleComment
            ? commands.deleteSelection()
            : commands.setProgrammingStyleComment('block')
          // }
        }
    }
  }, */

  /*   addCommands() {
    return {
      setProgrammingStyleComment:
        ({ type, value }: { type: 'inline' | 'block'; value: string }) =>
        ({ chain, state }) => {
          const { from, to } = state.selection
          if (from === to) return false

          if (type === 'inline') {
            return chain().setMark(inlineTagName, { value }).run()
          } else {
            return chain()
              .deleteRange({ from, to })
              .insertContentAt(from, { type: inlineTagName, attrs: { value } })
              .run()
          }
        },

      toggleProgrammingStyleComment:
        ({ type, value }: { type: 'inline' | 'block'; value: string }) =>
        ({ commands, state }) => {
          const { $from } = state.selection
          if (type === 'inline') {
            const active = state.doc.rangeHasMark(
              state.selection.from,
              state.selection.to,
              state.schema.marks.c
            )
            return active ? commands.unsetMark(inlineTagName) : commands.setProgrammingStyleComment({ type: 'inline', value })
          } else {
            const node = $from.nodeAfter
            if (node?.type.name === inlineTagName) {
              return commands.deleteSelection()
            }
            return commands.setProgrammingStyleComment({ type: 'block', value })
          }
        }
    }
  }, */

  // addProseMirrorPlugins() {
  //   return [
  //     new Plugin({
  //       props: {
  //         decorations: (state) => {
  //           const decos: Decoration[] = []

  //           state.doc.descendants((node: ProseMirrorNode, pos: number) => {
  //             /* node.marks.forEach((mark) => {
  //               if (mark.type.name === inlineTagName) {
  //                 const caret = Decoration.widget(pos, () => {
  //                   // const caret = Decoration.widget(pos + 1, () => {
  //                   const el = document.createElement('span')
  //                   el.className = 'programming-style-comment-caret-label'
  //                   return el
  //                 })

  //                 const label = Decoration.widget(pos + 1, () => {
  //                   const el = document.createElement('span')
  //                   el.className = 'programming-style-comment-caret-label'
  //                   el.textContent = `💬 ${node.attrs.value}`
  //                   // el.style.background = this.options.caretColor
  //                   // el.style.color = '#fff'
  //                   // el.style.fontSize = '0.75em'
  //                   // el.style.padding = '0 4px'
  //                   // el.style.borderRadius = '4px'
  //                   // el.style.marginLeft = '2px'
  //                   return el
  //                 })
  //                 decos.push(caret, label)
  //               }
  //             }) */

  //             // block comment decoration
  //             if (node.type.name === inlineTagName || node.type.name === blockTagName) {
  //               const deco = Decoration.widget(pos + 1, () => {
  //                 // wrapper for both caret + label
  //                 const wrapper = document.createElement('span')
  //                 wrapper.classList.add(
  //                   'programming-style-comment-wrapper',
  //                   'relative',
  //                   'inline-flex',
  //                   'group'
  //                 )

  //                 // caret
  //                 const caretEl = document.createElement('span')
  //                 caretEl.className = 'programming-style-comment-caret'
  //                 wrapper.appendChild(caretEl)

  //                 // mount Svelte component here instead of labelEl
  //                 const labelContainer = document.createElement('span')
  //                 labelContainer.className = 'programming-style-comment-caret-label'

  //                 wrapper.appendChild(labelContainer)

  //                 mount(CustomProgrammingStyleCommentExtensionWidget, {
  //                   // new CustomProgrammingStyleCommentExtensionWidget({
  //                   target: labelContainer,
  //                   props: {
  //                     __author: node.attrs.author || 'Unknown',
  //                     __text: node.attrs.value || '',
  //                     __onUncomment: () => {
  //                       // call the command here
  //                       this.editor.commands.unsetProgrammingStyleComment(pos)
  //                     }
  //                   }
  //                 })

  //                 // label
  //                 /* const labelEl = document.createElement('span')
  //                 labelEl.className = 'programming-style-comment-caret-label'
  //                 labelEl.textContent = `💬 ${node.attrs.value}`
  //                 wrapper.appendChild(labelEl)

  //                 // label (author name)
  //                 // const labelEl = document.createElement('span')
  //                 // labelEl.className = 'programming-style-comment-caret-label'
  //                 // labelEl.textContent = `💬 ${node.attrs.author || 'Unknown'}`
  //                 // wrapper.appendChild(labelEl)

  //                 // main content (the comment text itself, optional)
  //                 // if (node.attrs.value) {
  //                 if (node.attrs.author) {
  //                   const authorEl = document.createElement('span')
  //                   authorEl.className = 'programming-style-comment-caret-author'
  //                   authorEl.textContent = node.attrs.author
  //                   wrapper.appendChild(authorEl)
  //                 }

  //                 // uncomment button
  //                 const button = document.createElement('button')
  //                 button.className = 'programming-style-comment-caret-button uncomment'
  //                 button.textContent = 'Uncomment'
  //                 // button.style.width = '100%'
  //                 button.onclick = (e) => {
  //                   e.preventDefault()
  //                   e.stopPropagation()
  //                   // Call your tiptap command
  //                   this.editor.commands.unsetProgrammingStyleComment(pos)
  //                 }
  //                 wrapper.appendChild(button) */

  //                 return wrapper
  //               })
  //               /* const caret = Decoration.widget(pos + 1, () => {
  //                 const caretEl = document.createElement('span')
  //                 caretEl.className = 'programming-style-comment-caret'
  //                 // caretEl.style.borderLeft = `2px solid ${this.options.caretColor}`
  //                 // caretEl.style.height = '1em'
  //                 // caretEl.style.display = 'inline-block'
  //                 // caretEl.style.pointerEvents = 'none'
  //                 return caretEl
  //               })
  //               const label = Decoration.widget(pos + 1, () => {
  //                 const el = document.createElement('span')
  //                 el.className = 'programming-style-comment-caret-label'
  //                 el.textContent = `💬 ${node.attrs.value}`
  //                 // el.style.background = this.options.caretColor
  //                 // el.style.color = '#fff'
  //                 // el.style.fontSize = '0.75em'
  //                 // el.style.padding = '0 4px'
  //                 // el.style.borderRadius = '4px'
  //                 // el.style.marginLeft = '2px'
  //                 return el
  //               })
  //               decos.push(caret, label) */
  //               /* decos.push(
  //                 deco,
  //                 createWidgetDecoration(pos, {
  //                   author: 'comment.author',
  //                   text: 'comment.text',
  //                   onUncomment: () => {
  //                     console.log('Uncomment clicked', 'comment')
  //                     // trigger your removal logic here
  //                   }
  //                 })
  //               ) */
  //               decos.push(deco)
  //             }
  //           })

  //           return DecorationSet.create(state.doc, decos)
  //         }
  //       }
  //     })
  //   ]
  // }
})
