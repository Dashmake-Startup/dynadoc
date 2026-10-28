import { Mark, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { v4 as uuidv4 } from 'uuid'

export type WordCommentThreadItem = {
  id: string
  author: string
  text: string
  html?: string
  createdAt: number
}

export interface WordCommentAttrs {
  id: string
  author: string
  createdAt: number
  resolved?: boolean
  thread?: WordCommentThreadItem[]
}

export interface WordCommentExtensionOptions {
  highlightClass: string
  resolvedClass: string
}

const commentPluginKey = new PluginKey('wordCommentPlugin')

const decodeHtmlEntitiesOnce = (value: string) => {
  if (!value) return value
  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea')
      textarea.innerHTML = value
      return textarea.value
    }
  } catch {
    // ignore
  }
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

const decodeHtmlEntities = (value: string) => {
  let current = value || ''
  for (let i = 0; i < 3; i++) {
    const next = decodeHtmlEntitiesOnce(current)
    if (next === current) break
    current = next
  }
  return current
}

const extractWordCommentAttrs = (el: Element): Partial<WordCommentAttrs> | null => {
  const id = el.getAttribute('data-word-comment-id')
  if (!id) return null
  const author =
    el.getAttribute('author') ||
    el.getAttribute('data-word-comment-author') ||
    'Editor'
  const createdRaw = el.getAttribute('data-word-comment-created-at')
  const parsedCreated = createdRaw ? Date.parse(createdRaw) : NaN
  const createdAt = Number.isNaN(parsedCreated) ? null : parsedCreated
  const rawThread = el.getAttribute('data-word-comment-thread')
  let thread: WordCommentThreadItem[] = []
  if (rawThread) {
    try {
      const decoded = decodeHtmlEntities(rawThread)
      console.log("extractWordCommentAttrs", { decoded })
      const cleaned = decoded
        .replace(/[\u0000-\u001F]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      thread = JSON.parse(cleaned)
      // console.log("extractWordCommentAttrs", { cleaned ,thread})


    }

    catch {
      thread = []
    }
  }

  // console.log("extractWordCommentAttrs", {
  //   id,
  //   author,
  //   ...(createdAt ? { createdAt } : {}),
  //   thread
  // })

  return {
    id,
    author,
    ...(createdAt ? { createdAt } : {}),
    thread
  }
}

export const CustomWordCommentExtension = Mark.create<WordCommentExtensionOptions>({
  name: 'wordComment',

  addOptions() {
    return {
      highlightClass: 'word-comment-highlight',
      resolvedClass: 'word-comment-resolved'
    }
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-word-comment-id') || el.querySelector('[data-word-comment-id]')?.getAttribute('data-word-comment-id'),
        // Control DOM output name
        renderHTML: (attrs) => ({ 'data-word-comment-id': attrs.id })
      },
      author: {
        default: 'Editor',
        parseHTML: (el) => el.getAttribute('data-word-comment-author') || el.getAttribute('author'),
        renderHTML: (attrs) => ({ 'data-word-comment-author': attrs.author })
      },
      createdAt: {
        default: () => Date.now(),
        parseHTML: (el) => {
          const raw = el.getAttribute('data-word-comment-created-at') || el.getAttribute('createdat')
          return raw ? Date.parse(raw) : Date.now()
        },
        renderHTML: (attrs) => ({
          'data-word-comment-created-at': attrs.createdAt ? new Date(attrs.createdAt).toISOString() : null
        })
      },
      resolved: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-word-comment-resolved') === 'true' || el.getAttribute('resolved') === 'true',
        renderHTML: (attrs) => ({ 'data-word-comment-resolved': attrs.resolved })
      },
      thread: {
        default: [],
        parseHTML: (el) => {
          const raw = el.getAttribute('data-word-comment-thread') ||
            el.querySelector('[data-word-comment-thread]')?.getAttribute('data-word-comment-thread');
          if (!raw || raw === '[object Object]') return [] // Guard against broken data
          try {
            const decoded = decodeHtmlEntities(raw)
            return JSON.parse(decoded)
          } catch (e) {
            return []
          }
        },
        // This fixes the [object Object] issue
        renderHTML: (attrs) => {
          if (!attrs.thread || !attrs.thread.length) return {}
          return { 'data-word-comment-thread': JSON.stringify(attrs.thread) }
        }
      }
    }
  },

  // addAttributes() {
  //   return {
  //     id: {
  //       default: null,
  //       parseHTML: (el) => {

  //         console.log("parseHTMLparseHTML id Parse :", { el, "attr thread :": el.getAttribute('data-word-comment-thread'), "attr id :": el.getAttribute('data-word-comment-id') })

  //         return el.getAttribute('data-word-comment-id')


  //       }
  //     },
  //     author: {
  //       default: 'Editor',
  //       parseHTML: (el) => el.getAttribute('author') || el.getAttribute('data-word-comment-author')
  //     },
  //     createdAt: {
  //       default: () => Date.now(),
  //       parseHTML: (el) => {
  //         const raw = el.getAttribute('data-word-comment-created-at')
  //         if (!raw) return null
  //         const parsed = Date.parse(raw)
  //         return Number.isNaN(parsed) ? null : parsed
  //       }
  //     },
  //     resolved: { default: false },



  //     thread: {
  //       default: [],
  //       // This ensures that when Tiptap maps the HTML to the Prosemirror Node,
  //       // it knows exactly where to look for the JSON string.
  //       parseHTML: (el) => {
  //         // Check the element itself OR a nested marker (common in MS Word-like pastes)
  //         const raw = el.getAttribute('data-word-comment-thread') ||
  //           el.querySelector('[data-word-comment-thread]')?.getAttribute('data-word-comment-thread');

  //         console.log("parseHTMLparseHTML Thread Parse :", { raw, el, "attr thread :": el.getAttribute('data-word-comment-thread'), "attr id :": el.getAttribute('data-word-comment-id') })
  //         if (!raw) return []
  //         try {
  //           // Use your existing decoding logic here if the string is double-encoded
  //           const decoded = decodeHtmlEntities(raw)
  //           return JSON.parse(decoded)
  //         } catch (e) {
  //           console.error("Thread Parse Error:", e)
  //           return []
  //         }
  //       },
  //       // renderHTML: (attrs) => {
  //       //   if (!attrs.thread || !attrs.thread.length) return {}
  //       //   return { 'data-word-comment-thread': JSON.stringify(attrs.thread) }
  //       // }
  //     },

  //     /*  thread: {
  //        default: [],
  //        parseHTML: (el) => {
  //          const raw = el.getAttribute('data-word-comment-thread')
  //          if (!raw) return []
  //          try {
  //            return JSON.parse(raw)
  //          } catch {
  //            return []
  //          }
  //        },
  //        renderHTML: (attrs) =>
  //          attrs.thread && attrs.thread.length
  //            ? { 'data-word-comment-thread': JSON.stringify(attrs.thread) }
  //            : {}
  //      } */
  //   }
  // },


  /* parseHTML() {
    return [
      {
        // Highest priority: standard tags
        tag: 'span[data-word-comment-id]',
        getAttrs: (el) => extractWordCommentAttrs(el as HTMLElement),
      },
      {
        // Fallback: wrapper spans that contain the marker
        tag: 'span',
        getAttrs: (node) => {
          const element = node as HTMLElement
          const marker = element.querySelector('span[data-word-comment-id]')
          if (!marker) return false

          // Return the full object from your helper function
          return extractWordCommentAttrs(marker)
        }
      }
    ]
  }, */

  parseHTML() {
    return [
      {
        // This tells Tiptap: "If you see this tag, look at addAttributes to parse it"
        tag: 'span[data-word-comment-id]',
      },
      {
        tag: 'span',
        priority: 1000,
        // Only use getAttrs to VALIDATE if this span is a comment
        getAttrs: (node) => {
          const element = node as HTMLElement;
          return element.hasAttribute('data-word-comment-id') ||
            element.querySelector('[data-word-comment-id]') ? {} : false;
        }
      }
    ]
  },

  /* parseHTML() {
    return [
      {
        tag: 'span[data-word-comment-id]'
      },
      {
        tag: 'span',
        priority: 1000,
        getAttrs: (node) => {
          const element = node as HTMLElement
          const marker = element.querySelector('span[data-word-comment-id]')
          if (!marker) return false
          // const attrs = []
          const attrs = extractWordCommentAttrs(marker)

          console.log("extractWordCommentAttrs parseHTML", { attrs })
          if (!attrs) return false
          marker.remove()
          return attrs
        }
      }
    ]
  }, */

  /* renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-word-comment-id': HTMLAttributes.id,
        author: HTMLAttributes.author,
        ...(HTMLAttributes.thread && HTMLAttributes.thread.length
          ? { 'data-word-comment-thread': JSON.stringify(HTMLAttributes.thread) }
          : {}),
        ...(HTMLAttributes.createdAt
          ? { 'data-word-comment-created-at': new Date(HTMLAttributes.createdAt).toISOString() }
          : {}),
        class: [
          this.options.highlightClass,
          HTMLAttributes.resolved ? this.options.resolvedClass : ''
        ]
          .filter(Boolean)
          .join(' ')
      }),
      0
    ]
  }, */

  renderHTML({ HTMLAttributes }) {
    // Filter out the "naked" keys that Tiptap puts in HTMLAttributes by default
    // We only want the class and the data-word attributes we defined in addAttributes
    const { id, author, thread, createdAt, resolved, ...filteredAttributes } = HTMLAttributes

    return [
      'span',
      mergeAttributes(filteredAttributes, {
        class: [
          this.options.highlightClass,
          // Check both possible keys for resolved status
          (HTMLAttributes.resolved === true || HTMLAttributes['data-word-comment-resolved'] === 'true')
            ? this.options.resolvedClass : ''
        ].filter(Boolean).join(' ')
      }),
      0
    ]
  },

  /*  renderHTML({ HTMLAttributes }) {
     // We clean up the attributes that Tiptap automatically prepares
     // and merge them into the final span tag.
     return [
       'span',
       mergeAttributes(HTMLAttributes, {
         class: [
           this.options.highlightClass,
           HTMLAttributes['data-word-comment-resolved'] === 'true' || HTMLAttributes.resolved ? this.options.resolvedClass : ''
         ].filter(Boolean).join(' ')
       }),
       0
     ]
   }, */

  /* renderHTML({ HTMLAttributes }) {
    const { id, author, thread, createdAt, resolved } = HTMLAttributes;

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, {
        'data-word-comment-id': id,
        'data-word-comment-author': author,
        'data-word-comment-resolved': resolved,
        // 'data-word-comment-thread': 'ok',
        'data-word-comment-thread': thread ? JSON.stringify(thread) : null,
        'data-word-comment-created-at': createdAt ? new Date(createdAt).toISOString() : null,
        class: [
          this.options.highlightClass,
          resolved ? this.options.resolvedClass : ''
        ].filter(Boolean).join(' ')
      }),
      0
    ]
  }, */

  addCommands() {
    return {
      addWordComment:
        (text: string, author: string) =>
          ({ state, dispatch }) => {
            const { from, to } = state.selection
            if (from === to || !text) return false
            const id = uuidv4()
            const createdAt = Date.now()
            const thread: WordCommentThreadItem[] = [
              { id: uuidv4(), author, text, createdAt }
            ]
            const attrs: WordCommentAttrs = { id, author, createdAt, resolved: false, thread }
            const mark = state.schema.marks.wordComment.create(attrs)
            if (dispatch) {
              dispatch(state.tr.addMark(from, to, mark))
            }
            return true
          },
      replyWordComment:
        (id: string, text: string, author: string) =>
          ({ state, dispatch }) => {
            if (!text) return false
            const updates = updateCommentMarks(state, id, (attrs) => {
              const thread = Array.isArray(attrs.thread) ? [...attrs.thread] : []
              thread.push({ id: uuidv4(), author, text, createdAt: Date.now() })
              return { ...attrs, thread }
            })
            if (updates && dispatch) dispatch(updates)
            return !!updates
          },
      replyWordCommentRich:
        (id: string, payload: { author: string; html?: string; text?: string }) =>
          ({ state, dispatch }) => {
            const html = payload?.html || ''
            const text = payload?.text || stripHtml(html) || ''
            if (!text && !html) return false
            const updates = updateCommentMarks(state, id, (attrs) => {
              const thread = Array.isArray(attrs.thread) ? [...attrs.thread] : []
              thread.push({
                id: uuidv4(),
                author: payload.author || 'Editor',
                text,
                html: html || undefined,
                createdAt: Date.now()
              })
              return { ...attrs, thread }
            })
            if (updates && dispatch) dispatch(updates)
            return !!updates
          },
      updateWordCommentThreadItem:
        (
          id: string,
          itemId: string,
          payload: { html?: string; text?: string; author?: string }
        ) =>
          ({ state, dispatch }) => {
            if (!id || !itemId) return false
            const updates = updateCommentMarks(state, id, (attrs) => {
              const thread = Array.isArray(attrs.thread) ? [...attrs.thread] : []
              const index = thread.findIndex((entry) => entry.id === itemId)
              if (index === -1) return attrs
              const nextText =
                payload?.text ?? (payload?.html ? stripHtml(payload.html) : undefined)
              const existing = thread[index]
              thread[index] = {
                ...existing,
                author: payload?.author ?? existing.author,
                text: nextText ?? existing.text,
                html: payload?.html ?? existing.html
              }
              return { ...attrs, thread }
            })
            if (updates && dispatch) dispatch(updates)
            return !!updates
          },
      deleteWordCommentThreadItem:
        (id: string, itemId: string) =>
          ({ state, dispatch }) => {
            if (!id || !itemId) return false
            let removedRoot = false
            const updates = updateCommentMarks(state, id, (attrs) => {
              const thread = Array.isArray(attrs.thread) ? [...attrs.thread] : []
              const index = thread.findIndex((entry) => entry.id === itemId)
              if (index === -1) return attrs
              if (index === 0) {
                removedRoot = true
                return attrs
              }
              thread.splice(index, 1)
              return { ...attrs, thread }
            })
            if (removedRoot) {
              const tr = state.tr
              state.doc.descendants((node, pos) => {
                if (!node.marks?.length) return
                node.marks
                  .filter((m) => m.type.name === 'wordComment' && m.attrs.id === id)
                  .forEach((mark) => {
                    tr.removeMark(pos, pos + node.nodeSize, mark)
                  })
              })
              if (tr.steps.length && dispatch) {
                dispatch(tr)
                return true
              }
              return false
            }
            if (updates && dispatch) dispatch(updates)
            return !!updates
          },
      resolveWordComment:
        (id: string, resolved = true) =>
          ({ state, dispatch }) => {
            const updates = updateCommentMarks(state, id, (attrs) => ({
              ...attrs,
              resolved
            }))
            if (updates && dispatch) dispatch(updates)
            return !!updates
          },
      deleteWordComment:
        (id: string) =>
          ({ state, dispatch }) => {
            const tr = state.tr
            state.doc.descendants((node, pos) => {
              if (!node.marks?.length) return
              node.marks
                .filter((m) => m.type.name === 'wordComment' && m.attrs.id === id)
                .forEach((mark) => {
                  tr.removeMark(pos, pos + node.nodeSize, mark)
                })
            })
            if (tr.steps.length && dispatch) {
              dispatch(tr)
              return true
            }
            return false
          }
    }
  },

  addProseMirrorPlugins() {
    const extension = this
    return [
      new Plugin({
        key: commentPluginKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (!node.marks?.length) return
              node.marks.forEach((mark) => {
                if (mark.type.name !== 'wordComment') return
                const resolved = !!mark.attrs?.resolved
                const className = [
                  extension.options.highlightClass,
                  resolved ? extension.options.resolvedClass : ''
                ]
                  .filter(Boolean)
                  .join(' ')
                decorations.push(
                  Decoration.inline(pos, pos + node.nodeSize, {
                    class: className,
                    'data-word-comment-id': mark.attrs.id
                  })
                )
              })
            })
            return DecorationSet.create(state.doc, decorations)
          }
        }
      })
    ]
  }
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wordComment: {
      addWordComment: (text: string, author: string) => ReturnType
      replyWordComment: (id: string, text: string, author: string) => ReturnType
      replyWordCommentRich: (
        id: string,
        payload: { author: string; html?: string; text?: string }
      ) => ReturnType
      updateWordCommentThreadItem: (
        id: string,
        itemId: string,
        payload: { html?: string; text?: string; author?: string }
      ) => ReturnType
      deleteWordCommentThreadItem: (id: string, itemId: string) => ReturnType
      resolveWordComment: (id: string, resolved?: boolean) => ReturnType
      deleteWordComment: (id: string) => ReturnType
    }
  }
}

function updateCommentMarks(
  state,
  id: string,
  updater: (attrs: WordCommentAttrs) => WordCommentAttrs
) {
  const { tr } = state
  let changed = false
  state.doc.descendants((node, pos) => {
    if (!node.marks?.length) return
    node.marks.forEach((mark) => {
      if (mark.type.name !== 'wordComment' || mark.attrs.id !== id) return
      const nextAttrs = updater(mark.attrs as WordCommentAttrs)
      tr.removeMark(pos, pos + node.nodeSize, mark)
      tr.addMark(pos, pos + node.nodeSize, mark.type.create(nextAttrs))
      changed = true
    })
  })
  return changed ? tr : null
}

function stripHtml(value: string) {
  if (!value) return ''
  if (typeof document !== 'undefined') {
    const div = document.createElement('div')
    div.innerHTML = value
    return div.textContent || div.innerText || ''
  }
  return value.replace(/<[^>]+>/g, '').trim()
}
