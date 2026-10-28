

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import type { Editor } from '@tiptap/core'
  import { _$_documentEditorsList } from '../../../../stores/editor.store'

  //   export let editor: Editor | null = null
  // Extract props from the runtime
  const { editor } = $props<{ editor: Editor | null }>()

  // If the component should react when the parent updates the editor, use $effect:
  //   $effect(() => {
  //     if (editor) {
  //       console.log('Editor prop changed:', editor)
  //     }
  //   })

  let reviewEnabled = $state(false)
  let author = 'anonymous'
  let insertCount = 0
  let deleteCount = 0

  // update suggestion counts
  function updateCounts() {
    if (!editor) return
    const doc = editor.getJSON()
    insertCount = 0
    deleteCount = 0

    function countMarks(node: any) {
      if (node.marks) {
        node.marks.forEach((m: any) => {
          if (m.type === 'review') {
            if (m.attrs.kind === 'insert') insertCount++
            if (m.attrs.kind === 'delete') deleteCount++
          }
        })
      }
      if (node.content) node.content.forEach(countMarks)
    }

    countMarks(doc)
  }

  function toggleReviewMode() {
    console.log('toggleReviewMode', editor)
    if (!editor) return
    // console.log('yess ', reviewEnabled)
    // reviewEnabled = !reviewEnabled
    // console.log('yess2 ', reviewEnabled)
    editor.commands.setReviewMode(reviewEnabled, author)
    const active = _$_documentEditorsList.getActiveSync?.()
    if (active?.id) {
      _$_documentEditorsList.updateDocumentConfig(active.id, (doc) => {
        doc.config.reviewSettings = {
          ...(doc.config.reviewSettings || {}),
          trackChangesEnabled: reviewEnabled,
          reviewerName: author || doc.config.reviewSettings?.reviewerName || 'Editor'
        }
      })
    }
  }

  function acceptAll() {
    if (!editor) return
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const marks: any[] = []
        editor.state.doc.descendants((node, pos) => {
          node.marks.forEach((m) => {
            if (m.type.name === 'review')
              marks.push({ from: pos, to: pos + node.nodeSize, kind: m.attrs.kind })
          })
        })

        marks.forEach((m) => {
          if (m.kind === 'insert') {
            // already inserted, just remove review mark
            editor.commands.unsetMark('review', { from: m.from, to: m.to })
          } else if (m.kind === 'delete') {
            // remove text with delete mark
            tr.delete(m.from, m.to)
          }
        })
        return true
      })
      .run()
    updateCounts()
  }

  function rejectAll() {
    if (!editor) return
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const marks: any[] = []
        editor.state.doc.descendants((node, pos) => {
          node.marks.forEach((m) => {
            if (m.type.name === 'review')
              marks.push({ from: pos, to: pos + node.nodeSize, kind: m.attrs.kind })
          })
        })

        marks.forEach((m) => {
          if (m.kind === 'insert') {
            // remove inserted text
            tr.delete(m.from, m.to)
          } else if (m.kind === 'delete') {
            // just remove review mark, keep text
            editor.commands.unsetMark('review', { from: m.from, to: m.to })
          }
        })
        return true
      })
      .run()
    updateCounts()
  }

  // observe editor updates
  onMount(() => {
    if (!editor) return
    const updateListener = () => updateCounts()
    editor.on('update', updateListener)
    updateCounts()
    return () => editor.off('update', updateListener)
  })
</script>

<div class="flex flex-wrap items-center gap-2 p-2 bg-base-200 rounded shadow">
  <!-- Toggle Review Mode -->
  <label class="flex items-center gap-1 cursor-pointer">
    <span>Review Mode {reviewEnabled}</span>
    <input
      type="checkbox"
      bind:checked={reviewEnabled}
      onchange={toggleReviewMode}
      class="toggle toggle-primary"
    />
  </label>

  <!-- Author Input -->
  <input
    type="text"
    bind:value={author}
    placeholder={$_('Author')}
    class="input input-sm input-bordered w-32"
    onchange={() => {
      if (!editor) return
      editor.commands.setReviewMode(reviewEnabled, author)
      const active = _$_documentEditorsList.getActiveSync?.()
      if (active?.id) {
        _$_documentEditorsList.updateDocumentConfig(active.id, (doc) => {
          doc.config.reviewSettings = {
            ...(doc.config.reviewSettings || {}),
            reviewerName: author
          }
        })
      }
    }}
  />

  <!-- Suggestion Counts -->
  <span class="text-sm">
    {$_('Insertions:')} <span class="font-semibold text-green-600">{insertCount}</span>
    &nbsp; {$_('Deletions:')} <span class="font-semibold text-red-600">{deleteCount}</span>
  </span>

  <!-- Accept/Reject Buttons -->
  <button
    class="btn btn-xs btn-success"
    onclick={acceptAll}
    disabled={insertCount + deleteCount === 0}
  >
    {$_('Accept All')}
  </button>
  <button
    class="btn btn-xs btn-error"
    onclick={rejectAll}
    disabled={insertCount + deleteCount === 0}
  >
    {$_('Reject All')}
  </button>
</div>
