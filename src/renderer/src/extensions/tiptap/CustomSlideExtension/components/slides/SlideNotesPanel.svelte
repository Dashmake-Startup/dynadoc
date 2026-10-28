<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { get } from 'svelte/store'
  import { onDestroy, onMount } from 'svelte'
  import * as Y from 'yjs'

  import { authStore } from '../../../../../stores/auth.store'

  interface Props {
    __meta?: Y.Map<any> | null
  }

  let { __meta = null }: Props = $props()

  let _notes = $state('')
  let _comments: Array<Record<string, any>> = $state([])
  let _newComment = $state('')
  let _editingId: string | null = $state(null)
  let _editingText = $state('')
  let _tab: 'notes' | 'comments' = $state('notes')

  const syncFromMeta = () => {
    if (!__meta) return
    _notes = __meta.get('notes') ?? ''
    _comments = Array.isArray(__meta.get('comments')) ? [...__meta.get('comments')] : []
  }

  const persistNotes = () => {
    if (!__meta) return
    __meta.set('notes', _notes)
  }

  const persistComments = (next: Array<Record<string, any>>) => {
    if (!__meta) return
    _comments = next
    __meta.set('comments', next)
  }

  const addComment = () => {
    const text = _newComment.trim()
    if (!text) return
    const user = get(authStore)?.user
    const author = user?.name || user?.displayName || user?.email || $_('Anonymous')
    const id = (crypto as any)?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const next = [
      ..._comments,
      {
        id,
        author,
        text,
        createdAt: new Date().toISOString(),
        resolved: false
      }
    ]
    _newComment = ''
    persistComments(next)
  }

  const toggleResolve = (id: string) => {
    const next = _comments.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c))
    persistComments(next)
  }

  const deleteComment = (id: string) => {
    const next = _comments.filter((c) => c.id !== id)
    persistComments(next)
  }

  const beginEdit = (comment: Record<string, any>) => {
    _editingId = comment.id
    _editingText = comment.text || ''
  }

  const saveEdit = (id: string) => {
    const text = _editingText.trim()
    if (!text) return
    const next = _comments.map((c) => (c.id === id ? { ...c, text } : c))
    _editingId = null
    _editingText = ''
    persistComments(next)
  }

  const cancelEdit = () => {
    _editingId = null
    _editingText = ''
  }

  const formatTime = (value: string) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
  }

  let _observer: ((event: any) => void) | null = null

  onMount(() => {
    syncFromMeta()
    if (__meta) {
      _observer = () => syncFromMeta()
      __meta.observe(_observer)
    }
  })

  onDestroy(() => {
    if (__meta && _observer) {
      __meta.unobserve(_observer)
      _observer = null
    }
  })
</script>

<div class="slide-notes-panel">
  <div class="notes-tabs">
    <button class:active={_tab === 'notes'} on:click={() => (_tab = 'notes')}>
      {$_('Speaker Notes')}
    </button>
    <button class:active={_tab === 'comments'} on:click={() => (_tab = 'comments')}>
      {$_('Comments')} ({_comments.length})
    </button>
  </div>

  {#if _tab === 'notes'}
    <textarea
      class="notes-input"
      bind:value={_notes}
      placeholder={$_('Write speaker notes for this slide...')}
      on:blur={persistNotes}
    ></textarea>
    <div class="notes-actions">
      <span class="notes-hint">{$_('Saved to slide')}</span>
      <button class="notes-save" on:click={persistNotes}>{$_('Save')}</button>
    </div>
  {:else}
    <div class="comment-list">
      {#if _comments.length === 0}
        <div class="comment-empty">{$_('No comments yet.')}</div>
      {:else}
        {#each _comments as comment (comment.id)}
          <div class="comment-card" data-resolved={comment.resolved}>
            <div class="comment-meta">
              <span class="comment-author">{comment.author || $_('Anonymous')}</span>
              <span class="comment-time">{formatTime(comment.createdAt)}</span>
            </div>
            {#if _editingId === comment.id}
              <textarea class="comment-edit" bind:value={_editingText}></textarea>
              <div class="comment-actions">
                <button on:click={() => saveEdit(comment.id)}>{$_('Save')}</button>
                <button class="ghost" on:click={cancelEdit}>{$_('Cancel')}</button>
              </div>
            {:else}
              <div class="comment-body">{comment.text}</div>
              <div class="comment-actions">
                <button on:click={() => beginEdit(comment)}>{$_('Edit')}</button>
                <button on:click={() => toggleResolve(comment.id)}>
                  {comment.resolved ? $_('Reopen') : $_('Resolve')}
                </button>
                <button class="danger" on:click={() => deleteComment(comment.id)}>
                  {$_('Delete')}
                </button>
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    <div class="comment-compose">
      <textarea
        class="comment-input"
        bind:value={_newComment}
        placeholder={$_('Write a comment...')}
      ></textarea>
      <button class="comment-send" on:click={addComment}>{$_('Add Comment')}</button>
    </div>
  {/if}
</div>

<style>
  .slide-notes-panel {
    margin-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .notes-tabs {
    display: flex;
    gap: 8px;
  }

  .notes-tabs button {
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
  }

  .notes-tabs button.active {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.6);
    color: #fff;
  }

  .notes-input,
  .comment-input,
  .comment-edit {
    width: 100%;
    min-height: 90px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(17, 24, 39, 0.6);
    color: #f8fafc;
    resize: vertical;
  }

  .notes-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .notes-hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.55);
  }

  .notes-save,
  .comment-send,
  .comment-actions button {
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(59, 130, 246, 0.2);
    color: #e2e8f0;
    font-size: 12px;
  }

  .comment-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .comment-actions button.ghost {
    background: rgba(255, 255, 255, 0.05);
  }

  .comment-actions button.danger {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .comment-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .comment-card {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(15, 23, 42, 0.7);
  }

  .comment-card[data-resolved='true'] {
    opacity: 0.65;
  }

  .comment-meta {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.55);
  }

  .comment-body {
    margin-top: 6px;
    color: rgba(255, 255, 255, 0.9);
  }

  .comment-empty {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.55);
  }

  .comment-compose {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
