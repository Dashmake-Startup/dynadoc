import { Node, mergeAttributes, Extension } from '@tiptap/core'
import EditorHelpers from '../../utils/EditorHelpers'
// import PdfRenderer from '../PdfRenderer.svelte'

import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import PsdRenderer from '../fileRenderers/PsdRenderer.svelte'
import PdfRenderer from '../fileRenderers/PdfRenderer.svelte'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

function createPDFView(node: any) {
  const dom = document.createElement('div')
  dom.classList.add('pdf-view')

  let pdfData = atob(
    `JVBERi0xLjcNJc3K0qkNMSAwIG9iago8PAovTGVuZ3RoIDAgICAgICAgICAKL1R5cGUgL01ldGFPRm9ybQo+PgpzdHJlYW0NCgplbmRzdHJlYW0KZW5kb2JqCjIgMCBvYmoKPDwKL01ldGFkYXRhIDIwIDAgUgovUGFnZUxheW91dCAvT25lQ29sdW1uCi9QYWdlTW9kZSAvVXNlTm9uZQovUGFnZXMgMyAwIFIKL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvdW50IDIKL0tpZHMgWyA1IDAgUiAxNyAwIFIgXQovVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0F1dGhvciAo/v9cMDAwdFwwMDBoXDAwMGVcMDAwZ1wwMDBlXDAwMG5cMDAwdFwwMDBsXDAwMGVcMDAwbVwwMDBhXDAwMG4pCi9DcmVhdGlvbkRhdGUgKEQ6MjAyNTA3MjgwOTA4NDArMDAnMDAnKQovQ3JlYXRvciAo/v9cMDAwT1wwMDBOXDAwMExcMDAwWVwwMDBPXDAwMEZcMDAwRlwwMDBJXDAwMENcMDAwRVwwMDAvXDAwMDlcMDAwLlwwMDAwXDAwMC5cMDAwMFwwMDAuXDAwMDFcMDAwN1wwMDAyKQovTW9kRGF0ZSAoRDoyMDI1MDcyODA5MDg0MCswMCcwMCcpCi9Qcm9kdWNlciAo/v9cMDAwT1wwMDBOXDAwMExcMDAwWVwwMDBPXDAwMEZcMDAwRlwwMDBJXDAwMENcMDAwRVwwMDAvXDAwMDlcMDAwLlwwMDAwXDAwMC5cMDAwMFwwMDAuXDAwMDFcMDAwN1wwMDAyKQo+PgplbmRvYmoKNSAwIG9iago8PAovQ29udGVudHMgWyA2IDAgUiBdCi9NZWRpYUJveCBbIDAgMCA1OTUuMjk5OTkgODQxLjkwMDAyIF0KL1BhcmVudCAzIDAgUgovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSA4IDAgUgo+PgovUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PgovVHlwZSAvUGFnZQo+PgplbmRvYmoKNiAwIG9iago8PAovRmlsdGVyIFsgL0ZsYXRlRGVjb2RlIF0KL0xlbmd0aCA3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J6iN1bmCWhXy0cPe1nCL+zvehjauz9vtkYZ4oIZ72gEJFQ1r64TDh/e1dqzjah1ENi/tNth74KC/f/1eHzqNdiV18tp/+/RGcaMAQDPCYfKvvp893OHJYSSi/D+SQqYlWIXCh0p0zs71+efy/rx8v/wDLNRx9wplbmRzdHJlYW0KZW5kb2JqCjE5IDAgb2JqCjEyMjUKZW5kb2JqCjIwIDAgb2JqCjw8Ci9MZW5ndGggMjEgMCBSCi9TdWJ0eXBlIC9YTUwKL1R5cGUgL01ldGFkYXRhCj4+CnN0cmVhbQ0KPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iMy4xLTcwMSI+CjxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CjxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnBkZj0iaHR0cDovL25zLmFkb2JlLmNvbS9wZGYvMS4zLyI+CjxwZGY6UHJvZHVjZXI+T05MWU9GRklDRS85LjAuMC4xNzI8L3BkZjpQcm9kdWNlcj4KPC9yZGY6RGVzY3JpcHRpb24+CjxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+Cjx4bXA6Q3JlYXRvclRvb2w+T05MWU9GRklDRS85LjAuMC4xNzI8L3htcDpDcmVhdG9yVG9vbD4KPHhtcDpDcmVhdGVEYXRlPjIwMjUtMDctMjhUMDk6MDg6NDArMDA6MDA8L3htcDpDcmVhdGVEYXRlPjx4bXA6TW9kaWZ5RGF0ZT4yMDI1LTA3LTI4VDA5OjA4OjQwKzAwOjAwPC94bXA6TW9kaWZ5RGF0ZT48L3JkZjpEZXNjcmlwdGlvbj4KPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIj4KPGRjOmZvcm1hdD5hcHBsaWNhdGlvbi9wZGY8L2RjOmZvcm1hdD48ZGM6Y3JlYXRvcj48cmRmOlNlcT48cmRmOmxpPnRoZWdlbnRsZW1hbjwvcmRmOmxpPjwvcmRmOlNlcT48L2RjOmNyZWF0b3I+CjwvcmRmOkRlc2NyaXB0aW9uPgo8L3JkZjpSREY+CjwveDp4bXBtZXRhPjw/eHBhY2tldCBlbmQ9InciPz4KZW5kc3RyZWFtCmVuZG9iagoyMSAwIG9iago4MjcKZW5kb2JqCjIyIDAgb2JqCjw8Ci9GaWx0ZXIgL0ZsYXRlRGVjb2RlCi9JbmRleCBbIDAgMjMgXQovSW5mbyA0IDAgUgovTGVuZ3RoIDkwCi9Sb290IDIgMCBSCi9TaXplIDIzCi9UeXBlIC9YUmVmCi9XIFsgMSAyIDIgXQo+PgpzdHJlYW0NCnicY2Bg+P+fkYGfgYGRIRpEHAcSjJxAgmk6kGAOBxICF0DEEyAhWAQkhL4BCZEzIOIBkBDdDiS81oOIo0DCuxREdAAJHy8gEZgCIiqBRCgXiJBjYAAA10UQxAplbmRzdHJlYW0KZW5kb2JqCnN0YXJ0eHJlZgoyMTc5MAolJUVPRgo=`
  )
  const loadingTask = pdfjsLib.getDocument({ data: pdfData })
  requestAnimationFrame(async () => {
    loadingTask.promise
      .then(async (pdf) => {
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum)
          const viewport = page.getViewport({ scale: 1.5 })

          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const context = canvas.getContext('2d')

          // await page.render({
          //   canvasContext: context!,
          //   viewport
          // }).promise

          await page
            .render({
              canvas,
              canvasContext: context,
              viewport
            })
            .promise.then(() => {
              console.log('finish render PDF page:', pageNum, canvas)
            })

          dom.appendChild(canvas)
        }
      })
      .catch((err) => {
        dom.innerText = 'Failed to render PDF: ' + err.message
      })
  })

  return {
    dom,
    contentDOM: null // no editable content inside
  }
}

function isInlineTag(tagName: string): boolean {
  return EditorHelpers.allowedCustomInlineTags.includes(tagName)
}

function isSelfClosingTag(tagName: string): boolean {
  return EditorHelpers.allowedCustomSelfClosingTags.includes(tagName)
}
// function isAtomicTag(tagName: string): boolean {
//   return EditorHelpers.allowedCustomSelfClosingTags.includes(tagName)
// }
function isEditableTag(tagName: string): boolean {
  return EditorHelpers.allowedEditableTags.includes(tagName)
}

export function CustomTagExtension(tagName: string): Node {
  const safeName = tagName
  // const safeName = `customTag_${tagName.replace(/[^a-zA-Z0-9]/g, '')}`
  const inline = isInlineTag(tagName)
  const atom = isSelfClosingTag(tagName)
  const editable = isEditableTag(tagName)

  return Node.create({
    name: safeName,

    group: inline ? 'inline' : 'block',

    inline: inline,

    // atom: !editable, // disable true so content is allowed
    // atom: atom , // disable true so content is allowed
    // atom: false, // disable true so content is allowed
    atom: true, //  true so content is disallowed

    isolating: true,

    selectable: true,
    draggable: true,

    content: inline ? 'inline*' : 'block+',

    defining: true, // helps with nesting structure

    addAttributes() {
      return {
        id: { default: null },
        class: { default: null },
        style: { default: null },
        // [EditorHelpers.varTagDataCodeAttributeName]: { default: null },
        // [EditorHelpers.varTagDataValueAttributeName]: { default: null },
        ...Object.fromEntries(
          EditorHelpers.allowedCustomTagAttributes.map((key) => [key, { default: null }])
        ),
        src: { default: null }, // useful for <custom-img>
        alt: { default: null },
        width: { default: null },
        height: { default: null },
        editable: { default: editable }
      }
    },

    parseHTML() {
      return [{ tag: tagName }]
    },

    renderHTML({ HTMLAttributes }) {
      // return [tagName, mergeAttributes(HTMLAttributes), 0] // `0` = placeholder for nested content
      return [tagName, mergeAttributes(HTMLAttributes), 0] // `0` = placeholder for nested content
    },
    addNodeView() {
      return ({ HTMLAttributes, node }) => {
        // const isEditable = HTMLAttributes?.editable
        const isEditable =
          HTMLAttributes?.editable !== false && HTMLAttributes?.editable !== 'false'

        if (!isEditable) {
          // Non-editable: use contentDOM for nested editable content
          const dom = document.createElement(tagName)

          Object.entries(HTMLAttributes).forEach(([key, value]) => {
            if (value != null) dom.setAttribute(key, value)
          })

          dom.innerHTML = node.textContent || ''
          let pdfRendererComponent, psdRendererComponent
          // let pdfRendererComponent = {}
          // if (tagName === 'h') {
          if (tagName === EditorHelpers.pdfTagName) {
            // ✅ Mount your Svelte component
            pdfRendererComponent = new PdfRenderer({
              target: dom,
              props: {
                __src: HTMLAttributes.src
                // pass more props as needed
              }
            })
            // pdfRendererComponent = createPDFView(node)
          }
          if (tagName === EditorHelpers.psdTagName) {
            // ✅ Mount your Svelte component
            psdRendererComponent = new PsdRenderer({
              target: dom,
              props: {
                // src: HTMLAttributes.src
                // pass more props as needed
              }
            })
            // pdfRendererComponent = createPDFView(node)
          }
          return {
            dom, // Optional but recommended: clean up the component on destroy
            // ...pdfRendererComponent
            destroy() {
              pdfRendererComponent?.$destroy()
              psdRendererComponent?.$destroy()
            }
          }
        } else {
          // Editable: render direct content inside <tagName>
          const dom = document.createElement(tagName)
          const contentDOM = document.createElement(inline ? 'span' : 'div')

          Object.entries(HTMLAttributes).forEach(([key, value]) => {
            if (value != null) dom.setAttribute(key, value)
          })

          dom.appendChild(contentDOM)
          return { dom, contentDOM }
        }
      }
    }
  })

  /* addNodeView() {
     function addEditableNodeView() {
      return ({ HTMLAttributes, node }) => {
        const dom = document.createElement(tagName)

        // Apply attributes
        Object.entries(HTMLAttributes).forEach(([key, value]) => {
          if (value != null) dom.setAttribute(key, value)
        })

        // Render direct text or HTML content inside tagName
        dom.innerHTML = node.textContent // or use node.attrs.htmlContent if using HTML strings

        // No contentDOM — because we don't want Tiptap to manage nested content
        return { dom }
      }
    }

    function addNonEditableNodeView() {
      return ({ HTMLAttributes }) => {
        const dom = document.createElement(tagName)
        const contentDOM = document.createElement(inline ? 'span' : 'div')

        Object.entries(HTMLAttributes).forEach(([key, value]) => {
          if (value != null) dom.setAttribute(key, value)
        })

        dom.appendChild(contentDOM)

        // return { dom }
        return { dom, contentDOM }
      }
    }

    HTMLAttributes.editable? return addEditableNodeView():addNonEditableNodeView()
  } */
}

export const CustomScriptTag = Node.create({
  name: 'scriptTag',

  group: 'block',

  content: 'text*',

  selectable: false,
  atom: true,

  addAttributes() {
    return {
      type: {
        default: 'text/javascript'
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'script'
      }
    ]
  },

  renderHTML({ node }) {
    return ['script', { type: node.attrs.type }, node.textContent]
  }
})

export const CustomStyleTag = Node.create({
  name: 'styleTag',

  group: 'block',

  content: 'text*',

  selectable: false,
  atom: true,

  parseHTML() {
    return [
      {
        tag: 'style'
      }
    ]
  },

  renderHTML({ node }) {
    return ['style', {}, node.textContent]
  }
})

export const CustomNodeManipulationCommand = Extension.create({
  name: 'customNodeManipulation',

  addCommands() {
    return {
      // all custom commands should start with underscore to avoid conflicts with other build-in commands
      _insertNode:
        (options: {
          nodeName: string
          attrs?: Record<string, any>
          text?: string
          deleteCharacters?: number // number of characters to delete before inserting the node
        }) =>
        ({ tr, state, dispatch, commands, chain }) => {
          console.log('insertNode options:', options)
          const { nodeName, attrs = {}, text = '', deleteCharacters } = options

          if (deleteCharacters > 0) {
            const { $from } = state.selection
            const pos = $from.pos

            // Delete the number of character before the cursor (if not at beginning)
            if (pos > 0 && dispatch) {
              dispatch(tr.delete(pos - deleteCharacters, pos))
            }
          }

          // Insert the custom node after eventual deletion
          /* return commands.insertContent({
            type: nodeName,
            attrs: { ...attrs, text },
            content: [
              {
                type: 'text',
                text: text
              }
            ]
          }) */

          return (
            chain()
              .focus()
              // .deleteRange({ from: pos - 1, to: pos }) // delete char before cursor
              .insertContent({
                type: nodeName,
                attrs: { ...attrs, text },
                content: [
                  {
                    type: 'text',
                    text: text
                  }
                  // {
                  //   type: 'text',
                  //   text: ' ' // Add a space to move the cursor out of the var node
                  // }
                ]
              })
              // Add a space to move the cursor out of the var node
              .insertContent(' ', {
                type: 'text'
              })
              .run()
          )
        },

      /* _insertNode2:
        // insertNode:
        (options: { nodeName: string; attrs?: Record<string, any>; text?: string }) =>
          ({ commands }) => {
            console.log('insertNode options:', options)
            const { nodeName, attrs = {}, text = '' } = options

            return commands.insertContent({
              type: nodeName,
              attrs: { ...attrs, text }
            })
          }, */

      deleteNode:
        (nodeName: string) =>
        ({ tr, state, dispatch }) => {
          const { selection } = state
          const { from, to } = selection

          let deleted = false

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.type.name === nodeName) {
              if (dispatch) {
                dispatch(tr.delete(pos, pos + node.nodeSize))
              }
              deleted = true
              return false
            }
            return true
          })

          return deleted
        }
    }
  }
})
