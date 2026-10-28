<script lang="ts">
  import { onDestroy } from 'svelte'
  import { Editor } from '@tiptap/core'
  import { StarterKit } from '@tiptap/starter-kit'
  import { TextStyleKit } from '@tiptap/extension-text-style'
  import { Highlight } from '@tiptap/extension-highlight'
  import { CustomTextStyleExtension } from '../../CustomTextStyleExtension/CustomTextStyleExtension'
  import { CustomLinkExtension } from '../../CustomLinkExtension/CustomLinkExtension'
  import { CustomImageExtension } from '../../CustomImageExtension/CustomImageExtension'
  import { CustomFileIncludeExtension } from '../../CustomFileIncludeExtension/CustomFileIncludeExtension.svelte'

  type SavePayload = {
    html: string
    text: string
  }

  const {
    value = '',
    placeholder = 'Write a comment…',
    autofocus = false,
    onSave, onCancel
  } = $props<{
    value?: string
    placeholder?: string
    autofocus?: boolean,
    onSave?: (payload: SavePayload) => void
    onCancel?: () => void
  }>()

  // const { onSave, onCancel } = $props<{
  //   onSave?: (payload: SavePayload) => void
  //   onCancel?: () => void
  // }>()

  let editor: Editor | null = null
  let editorEl: HTMLDivElement | null = null

  const editorExtensions = [
    StarterKit.configure({
      history: true,
      codeBlock: false,
      bold: false,
      italic: false,
      strike: false
    }),
    TextStyleKit.configure({ textStyle: false }),
    CustomTextStyleExtension,
    CustomLinkExtension,
    Highlight.configure({ multicolor: true }),
    CustomImageExtension,
    CustomFileIncludeExtension
  ]

  $effect(() => {
    if (!editorEl || editor) return
    editor = new Editor({
      element: editorEl,
      extensions: editorExtensions,
      content: value || '',
      editorProps: {
        attributes: {
          class:
            'comment-editor-content prose max-w-none focus:outline-none text-[12px] text-base-content/80 min-h-[100px]'
        }
      }
    })
  })

  let isEmpty = $state(true)

  $effect(() => {
    if (!editor) return
    if (!autofocus) return
    editor.commands.focus('end')
  })

  $effect(() => {
    if (!editor) return
    const update = () => {
      isEmpty = !editor?.getText().trim().length
    }
    update()
    editor.on('update', update)
    editor.on('transaction', update)
    return () => {
      editor?.off('update', update)
      editor?.off('transaction', update)
    }
  })

  onDestroy(() => {
    editor?.destroy()
    editor = null
  })

  function promptLink() {
    if (!editor) return
    const previous = editor.getAttributes('link')?.href || ''
    const href = window.prompt('Link URL', previous)
    if (href === null) return
    if (!href) {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().setLink({ href }).run()
  }

  function promptImage() {
    if (!editor) return
    const src = window.prompt('Image URL or file path')
    if (!src) return
    editor.commands.insertImage({ src })
  }

  function promptFileInclude() {
    if (!editor) return
    const sourcePath = window.prompt('File path to include')
    if (!sourcePath) return
    editor.commands.insertFileInclude(sourcePath)
  }

  function isUnderlineActive() {
    const attrs = editor?.getAttributes('textStyle') || {}
    const decoration = String(attrs.textDecoration || '')
    return decoration.includes('underline')
  }

  function handleSave() {
    const html = editor?.getHTML() ?? ''
    const text = editor?.getText() ?? ''
    onSave?.({ html, text })
  }

  function handleCancel() {
    onCancel?.()
  }
</script>

<div class="comment-editor">
  <div class="comment-editor-toolbar">
    <button
      type="button"
      class:active={editor?.isActive('textStyle', { fontWeight: 'bold' })}
      onclick={() => editor?.chain().focus().toggleBold().run()}
      title="Bold"
    >
      <i class="ph-bold ph-text-b"></i>
    </button>
    <button
      type="button"
      class:active={editor?.isActive('textStyle', { fontStyle: 'italic' })}
      onclick={() => editor?.chain().focus().toggleItalic().run()}
      title="Italic"
    >
      <i class="ph-bold ph-text-italic"></i>
    </button>
    <button
      type="button"
      class:active={isUnderlineActive()}
      onclick={() => editor?.chain().focus().toggleUnderline().run()}
      title="Underline"
    >
      <i class="ph-bold ph-text-underline"></i>
    </button>
    <button type="button" onclick={promptLink} title="Link">
      <i class="ph-bold ph-link"></i>
    </button>
    <button type="button" onclick={promptImage} title="Image">
      <i class="ph-bold ph-image-square"></i>
    </button>
    <button type="button" onclick={promptFileInclude} title="File include">
      <i class="ph-bold ph-paperclip"></i>
    </button>
  </div>

  <div class="comment-editor-body">
    <div bind:this={editorEl} class="comment-editor-surface"></div>
    {#if isEmpty}
      <div class="comment-editor-placeholder">{placeholder}</div>
    {/if}
  </div>

  <div class="comment-editor-actions">
    <button class="comment-btn primary" onclick={handleSave}>Save</button>
    <button class="comment-btn ghost" onclick={handleCancel}>Cancel</button>
  </div>
</div>

<style lang="postcss">
  .comment-editor {
    @apply flex flex-col gap-2 bg-black/30 border border-white/10 rd-6px p-2;
  }
  .comment-editor-toolbar {
    @apply flex items-center gap-1 text-[12px];
  }
  .comment-editor-toolbar button {
    @apply size-7 rd-4px flex items-center justify-center text-[var(--color-base-content)]/60
           hover:(bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-[var(--color-base-content)]) transition-all;
  }
  .comment-editor-toolbar button.active {
    @apply bg-primary/20 text-primary;
  }
  .comment-editor-body {
    @apply relative min-h-[110px] bg-black/20 rd-4px p-2;
  }
  .comment-editor-surface {
    @apply min-h-[100px];
  }
  .comment-editor-placeholder {
    @apply pointer-events-none absolute left-2 top-2 text-[11px] text-[var(--color-base-content)]/30;
  }
  .comment-editor-actions {
    @apply flex justify-end gap-2;
  }
  .comment-btn {
    @apply h-6 px-3 text-[10px] font-800 tracking-widest rd-4px transition-all;
  }
  .comment-btn.primary {
    @apply bg-primary text-black hover:bg-primary/80;
  }
  .comment-btn.ghost {
    @apply bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-[var(--color-base-content)]/50 hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] hover:text-[var(--color-base-content)];
  }
</style>
