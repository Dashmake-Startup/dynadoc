// FormFieldExtension.ts
import { v4 as uuidv4 } from 'uuid'
import { Editor, Node, mergeAttributes } from '@tiptap/core'
import FormFieldView from './components/FormFieldView.svelte'
import { mount, unmount } from 'svelte'
import { initNodeFieldValues } from './stores/field.store'
import { SvelteNodeViewRenderer } from 'svelte-tiptap'
import { FormComponentFrameWorks, FormComponentNames, FormComponentPacks } from './components/fields/libs/componentRegistry'
import { CustomFormFieldExtensionUtils } from './utils/utils'
// import  FormFieldViewReact  from './components/FormFieldViewReact'
// import FormFieldView from '../components/FormFieldView.svelte'


declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    CustomFormFieldExtension: {
      insertFormField: (attrs: {}) => ReturnType
    }
  }
}

function formFieldToPDFHTML(node: any) {
  const { type, label, value, placeholder, options } = node.attrs

  switch (type) {
    case 'text':
      return `
        <span class="form-field-wrapper">
          <label>${label}</label>
          <input type="text" value="${value || ''}" placeholder="${placeholder}" class="input input-bordered" readonly/>
        </span>
      `
    case 'select':
      const opts = options
        .map((o: string) => `<option ${o === value ? 'selected' : ''}>${o}</option>`)
        .join('')
      return `
        <span class="form-field-wrapper">
          <label>${label}</label>
          <select class="select select-bordered" disabled>${opts}</select>
        </span>
      `
    case 'checkbox':
      return `
        <span class="form-field-wrapper">
          <label>
            <input type="checkbox" ${value ? 'checked' : ''} disabled />
            ${label}
          </label>
        </span>
      `
    default:
      return `<span class="form-field-wrapper">[${label}]</span>`
  }
}
function assignUuidsToNodes(editor: Editor) {
  // Patch all form_field nodes that are missing an ID
  const { tr } = editor.state
  let modified = false

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === extensionName && !node.attrs.id) {
      const nodeId = uuidv4()
      const label = node.attrs?.label || node.attrs?.name || 'Field'
      const name =
        node.attrs?.name ||
        String(label)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '') ||
        `field_${nodeId.slice(0, 8)}`
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: nodeId, name })
      modified = true
    }
  })

  if (modified) {
    editor.view.dispatch(tr)
  }
}


export const extensionName = "form_field"
export const extensionTagName = "form-field"

export const CustomFormFieldExtension = Node.create({
  name: CustomFormFieldExtensionUtils.extensionName,
  // group: 'block',
  // atom: true,
  // selectable: false,
  selectable: true,
  // content: 'inline*',

  group: 'inline',
  inline: true,
  draggable: true,
  // atom: true,
  // selectable: true,

  addAttributes() {
    return {
      id: { default: '' },
      type: { default: 'text' },
      framework: { default: FormComponentFrameWorks.svelte },
      pack: { default: FormComponentPacks.fluent },
      component: { default: null },
      // props: { default: {}},
      // children: { default: ''},
      label: { default: '' },
      name: { default: '' },
      placeholder: { default: '' },
      value: { default: '' },
      options: { default: [] },
      required: { default: false },
      helper: { default: '' },
      min: { default: null },
      max: { default: null },
      step: { default: null },
      pattern: { default: '' },
      disabled: { default: false },
      width: { default: 150 },
      height: { default: 60 },
      lockAspectRatio: { default: false },
    }
  },

  parseHTML() {
    return [{ tag: extensionTagName }]
  },

  renderHTML({ HTMLAttributes }) {
    return [extensionTagName, mergeAttributes(HTMLAttributes)]
  },



  /* renderHTML({ node, HTMLAttributes }) {
  const { type, label, value, placeholder, options } = node.attrs

  // Simple example for text input
  if (type === 'text') {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'form-field-wrapper' }),
      `<label>${label}</label>
       <input type="text" value="${value || ''}" placeholder="${placeholder}" class="input input-bordered"/>`,
    ]
  }

  if (type === 'select') {
    const opts = options.map((o: string) => `<option>${o}</option>`).join('')
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'form-field-wrapper' }),
      `<label>${label}</label>
       <select class="select select-bordered">${opts}</select>`,
    ]
  }

  // fallback for unknown types
  return ['span', mergeAttributes(HTMLAttributes, { class: 'form-field-wrapper' }), `[${label}]`]
}, */

  // Instead of the usual extension hooks, we can inject into the editor:
  /* onCreate({ editor }) {
    editor.toPDFHTML = function () {
      const json = editor.getJSON()

      function traverse(node: any): string {
        if (node.type === extensionName) return formFieldToPDFHTML(node)
        if (node.content) return node.content.map(traverse).join('')
        if (node.text) return node.text
        return ''
      }

      return traverse(json)
    }
  },
 */

  onCreate({ editor }) {
    initNodeFieldValues()



    // assignUuidsToNodes(editor)


    editor.toPDFHTML = function () {
      const json = editor.getJSON()

      function traverse(node: any): string {
        // --- Handle your custom form_field nodes ---
        if (node.type === extensionName) return formFieldToPDFHTML(node)

        // --- Handle text nodes with marks (bold, italic, link) ---
        if (node.type === 'text') {
          let text = node.text
          if (node.marks) {
            node.marks.forEach((mark: any) => {
              switch (mark.type) {
                case 'bold':
                  text = `<strong>${text}</strong>`
                  break
                case 'italic':
                  text = `<em>${text}</em>`
                  break
                case 'link':
                  text = `<a href="${mark.attrs.href}">${text}</a>`
                  break
              }
            })
          }
          return text
        }

        // --- Handle images ---
        if (node.type === 'image') {
          return `<img src="${node.attrs.src}" alt="${node.attrs.alt || ''}" style="max-width:100%"/>`
        }

        // --- Handle headings, paragraphs, lists, blockquotes ---
        let inner = ''
        if (node.content) inner = node.content.map(traverse).join('')

        switch (node.type) {
          case 'paragraph':
            return `<p>${inner}</p>`
          case 'heading':
            return `<h${node.attrs.level}>${inner}</h${node.attrs.level}>`
          case 'bulletList':
            return `<ul>${inner}</ul>`
          case 'orderedList':
            return `<ol>${inner}</ol>`
          case 'listItem':
            return `<li>${inner}</li>`
          case 'blockquote':
            return `<blockquote>${inner}</blockquote>`
          case 'codeBlock':
            return `<pre><code>${inner}</code></pre>`
          case 'horizontalRule':
            return `<hr/>`
          default:
            return inner
        }
      }

      return traverse(json)
    }
  },

  onUpdate({ editor }) {

    assignUuidsToNodes(editor)
  },

  /*  addNodeView() {
     return () => {
       // Markup
       
 
       const dom = document.createElement('div')
 
       dom.classList.add('node-view')
 
       const label = document.createElement('label')
 
       label.innerHTML = 'Node view'
       label.contentEditable = false
 
       const content = document.createElement('div')
       content.innerHTML = '<p>This is editable.</p>'
 
 
       content.classList.add('content')
       content.classList.add('is-editable')
 
       dom.append(label, content)
 
       return {
         dom,
         contentDOM: content,
       }
     }
   },
  */
  // ✅ Pure NodeView that manually mounts a Svelte component
  // addNodeView() {
  //   return ({ node, editor, getPos }) => {
  /* addNodeView() {

    switch (node.attrs.framework) {
      case FormComponentFrameWorks.svelte:
        return SvelteNodeViewRenderer(FormFieldView);
      case FormComponentFrameWorks.react:
        return ReactNodeViewRenderer(FormFieldView);
      case FormComponentFrameWorks.vue:
        return VueNodeViewRenderer(FormFieldView);

      // break;

      // default:
      //   break;
    } */
  addNodeView() {
    return SvelteNodeViewRenderer(FormFieldView)

    // return ({ node }) => {
    // return
    switch (FormComponentFrameWorks.react) {
      // switch (this.attrs.framework) {
      case FormComponentFrameWorks.react:
        return ReactNodeViewRenderer(FormFieldViewReact)
      case FormComponentFrameWorks.vue:
      // return VueNodeViewRenderer(FormFieldView)
      default:
        return SvelteNodeViewRenderer(FormFieldView)
    }
    // }


    // return SvelteNodeViewRenderer(FormFieldView);

    /* const nodeId = node.attrs.id
    // const nodeId = node.attrs.id || uuidv4()
    // const nodeId = node.attrs.id || cryptoRandomUUID()
    const dom = document.createElement('span')
    dom.classList.add('form-field-wrapper')
    // dom.classList.add(nodeId)
  
    // --- Mount Svelte component manually ---
    // const component = new FormFieldView({
    //   target: dom,
    //   props: {
    //     editor,
    //     node,
    //     /* updateAttrs: (attrs) => {
    //       editor.commands.updateAttributes('formField', attrs)
    //     }, +/
    //   },
    // })
    // Create reactive props object
    const props = $state({
      editor,
      node,
      nodeId,
    })
    //  initNodeFieldValues()
  
    // Mount Svelte component (Svelte 5)
    //  const { destroy: unmountComponent } = mount(FormFieldView, {
    const component = mount(FormFieldView, {
      target: dom,
      props
    })
    // const pos = getPos()
  
    // const tr = editor.state.tr
    // tr.setNodeMarkup(pos, undefined, {
    //   ...node.attrs,
    //   id: nodeId,
    // })
    // editor.view.dispatch(tr)
  
  
    // --- Handle updates when attributes change ---
    const update = (updatedNode) => {
      if (updatedNode.type !== node.type) return false
      // component.$set({ node: updatedNode })
      props.node = updatedNode
  
      return true
    }
  
    const destroy = () => {
      if (component) unmount(component)
      // component.$destroy()
      // component.destroy?.()
    }
  
    return {
      dom,
      // contentDOM: null, // Tells ProseMirror this is non editable
      contentDOM: component, // Tells ProseMirror this is editable
      update,
      destroy,
    } 
  }*/
  },


  addCommands() {
    return {
      insertFormField:
        (attrs = {}) =>
          // ({ state, dispatch, editor }) => {
          ({ chain, state }) => {
            const type = attrs?.component || attrs?.type || 'TextField'
            const nextId = attrs?.id || uuidv4()
            const label = attrs?.label || (typeof type === 'string' ? type.replace(/([A-Z])/g, ' $1').trim() : 'Field')
            const name =
              attrs?.name ||
              label
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '') ||
              `field_${nextId.slice(0, 8)}`

            chain()
              .focus()
              .insertContent({
                type: extensionName,
                attrs: {
                  framework: FormComponentFrameWorks.svelte,
                  pack: FormComponentPacks.fluent,
                  component: type,
                  id: nextId,
                  label,
                  name,
                  required: false,
                  ...attrs,
                }
                // attrs: {
                //   // framework: FormComponentFrameWorks.svelte,
                //   framework: FormComponentFrameWorks.react,
                //   pack: FormComponentPacks.fluent,
                //   component: FormComponentNames.Button,
                //   ...attrs,
                //   /* props: {
                //     appearance: 'primary',
                //     children: 'Click me',
                //   }, */
                // },
              })
              .run()
            return true

            // editor.chain().focus().insertContent({
            chain().focus().insertContent({
              type: extensionName,
              attrs: attrs,
              /* attrs: {
                type: type,
                label: 'Name',
                placeholder: 'Enter your name',
              }, */
            }).run()
            // .focus()
            return true
          },
    }
  },




})
