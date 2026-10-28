

<script lang="ts">

  import { _ } from 'svelte-i18n'
  import { onMount, createEventDispatcher } from 'svelte'
  import { Editor } from '@tiptap/core'
  import StarterKit from '@tiptap/starter-kit'
  import Underline from '@tiptap/extension-underline'
  import Link from '@tiptap/extension-link'
  let { open = false, initialContent = '<p>Edit your rich text here...</p>', onSave = (html:string) => {}, onCancel = () => {} } = $props()

//   export const content = ''
  let editor
  const dispatch = createEventDispatcher()

  let _editorElement: HTMLDivElement


  function closeModal() {
    open = false
    onCancel()
  }

  function save() {
    const html = editor.getHTML()
    console.log("save newHtml", html)
    onSave(html)
    // dispatch('save', { html })
    closeModal()
  }

  // Svelte 5 action to mount Tiptap content
//   function bindEditor(node) {
//     if (editor && !editor.isDestroyed) {
//       node.appendChild(editor.view.dom)
//     }
//     return {
//       destroy() {
//         if (editor && !editor.isDestroyed) editor.destroy()
//       }
//     }
//   }

  onMount(() => {
    editor = new Editor({
      element: _editorElement,

      extensions: [StarterKit, Underline, Link],
      content: initialContent,
      editorProps: {
        attributes: {
          class: 'prose dark:prose-invert focus:outline-none p-3'
        }
      }
    })
  })
</script>

{#if open}
  <dialog class="modal modal-open">
    <div class="modal-box w-11/12 max-w-3xl bg-base-100">
      <h3 class="font-bold text-lg mb-3">{$_('🧾 Rich Text Variable Editor')}</h3>
      <div class="border border-base-200 rounded-md p-2 h-[60vh] overflow-auto">
        <div bind:this={_editorElement} />
      </div>
      <div class="modal-action">
        <button class="btn btn-outline" on:click={closeModal}>{$_('Cancel')}</button>
        <button class="btn btn-primary" on:click={save}>{$_('Save')}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" on:click={closeModal}>
      <button>{$_('close')}</button>
    </form>
  </dialog>
{/if}

<style>
  .ProseMirror {
    min-height: 100%;
  }
</style>
