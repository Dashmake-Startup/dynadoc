<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onDestroy } from 'svelte'
  import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../../stores/editor.store'
  import { GenericFormatingEditorCommands } from '../../../common/actions/formatting/commands/GenericFormatingEditorCommands.svelte'
  import { focusWordComment } from '../../../../extensions/tiptap/CustomWordCommentExtension/stores/commentFocus.store'

  type ReviewItem = {
    id: string
    type: 'insert' | 'delete'
    author?: string
    text: string
    pos: number
    timestamp?: number
  }

  type CommentItem = {
    id: string
    author?: string
    text: string
    from: number
    to: number
    resolved: boolean
    thread: any[]
    timestamp?: number
  }

  const activeDocumentStore = _$_documentEditorsList.getActive()
  const activeWysiwygStore = _$_wysiwygEditorsList.getActive()

  let tab = $state<'changes' | 'comments'>('changes')
  let reviewItems: ReviewItem[] = $state([])
  let commentItems: CommentItem[] = $state([])
  let reviewEnabled = $state(false)
  let reviewerName = $state('Editor')
  let markupMode = $state<'all' | 'simple' | 'none' | 'original'>('all')
  let onlyMine = $state(false)
  let hideResolved = $state(false)
  let marginOnly = $state(false)

  let unsubscribeEditor: (() => void) | null = null

  function refresh() {
    const entry = $activeWysiwygStore
    const editor = entry?.editor
    if (!editor) {
      reviewItems = []
      commentItems = []
      return
    }

    const configSettings = $activeDocumentStore?.document?.config?.reviewSettings
    reviewEnabled = configSettings?.trackChangesEnabled ?? !!editor.storage?.review?.enabled
    reviewerName = configSettings?.reviewerName || editor.storage?.review?.author || reviewerName
    markupMode = configSettings?.markupMode || markupMode
    onlyMine = !!configSettings?.onlyShowMine
    hideResolved = !!configSettings?.hideResolvedComments
    marginOnly = !!configSettings?.commentsMarginOnly

    const newReviewItems: ReviewItem[] = []
    const commentMap = new Map<string, CommentItem>()

    editor.state.doc.descendants((node, pos) => {
      if (node.type?.name === 'review') {
        newReviewItems.push({
          id: node.attrs?.id || `${pos}`,
          type: node.attrs?.mode === 'delete' ? 'delete' : 'insert',
          author: node.attrs?.author,
          text: node.textContent || '',
          pos,
          timestamp: node.attrs?.timestamp
        })
      }

      if (!node.marks?.length) return
      node.marks.forEach((mark) => {
        if (mark.type?.name !== 'wordComment') return
        const id = mark.attrs?.id || `${pos}`
        const thread = Array.isArray(mark.attrs?.thread) ? mark.attrs.thread : []
        const first = thread[0] || {}
        const existing = commentMap.get(id)
        const from = pos
        const to = pos + node.nodeSize
        if (!existing) {
          commentMap.set(id, {
            id,
            author: first.author || mark.attrs?.author || 'Editor',
            text: first.text || node.textContent || '',
            from,
            to,
            resolved: !!mark.attrs?.resolved,
            thread,
            timestamp: first.createdAt || mark.attrs?.createdAt
          })
        } else {
          existing.from = Math.min(existing.from, from)
          existing.to = Math.max(existing.to, to)
        }
      })
    })

    const normalizedReviewer = (reviewerName || '').trim().toLowerCase()
    reviewItems =
      onlyMine && normalizedReviewer
        ? newReviewItems.filter(
            (item) => (item.author || '').trim().toLowerCase() === normalizedReviewer
          )
        : newReviewItems
    let entries = Array.from(commentMap.values()).sort((a, b) => a.from - b.from)
    if (hideResolved) {
      entries = entries.filter((item) => !item.resolved)
    }
    commentItems =
      onlyMine && normalizedReviewer
        ? entries.filter((item) => (item.author || '').trim().toLowerCase() === normalizedReviewer)
        : entries
  }

  function bindEditor() {
    const entry = $activeWysiwygStore
    const editor = entry?.editor
    if (!editor) return

    const onUpdate = () => refresh()
    editor.on('transaction', onUpdate)
    editor.on('update', onUpdate)
    refresh()

    unsubscribeEditor = () => {
      editor.off('transaction', onUpdate)
      editor.off('update', onUpdate)
    }
  }

  $effect(() => {
    const entry = $activeWysiwygStore
    if (!entry?.editor) {
      if (unsubscribeEditor) {
        unsubscribeEditor()
        unsubscribeEditor = null
      }
      reviewItems = []
      commentItems = []
      return
    }
    if (unsubscribeEditor) unsubscribeEditor()
    bindEditor()
  })

  onDestroy(() => {
    if (unsubscribeEditor) unsubscribeEditor()
  })

  function jumpTo(from: number, to?: number) {
    const editor = $activeWysiwygStore?.editor
    if (!editor) return
    const node = editor.state.doc.nodeAt(from)
    const end = to ?? (node ? from + node.nodeSize : from + 1)
    editor.commands.setTextSelection({ from, to: end })
    editor.commands.scrollIntoView()
  }

  function acceptItem(item: ReviewItem) {
    jumpTo(item.pos)
    GenericFormatingEditorCommands.acceptSelection()
    refresh()
  }

  function rejectItem(item: ReviewItem) {
    jumpTo(item.pos)
    GenericFormatingEditorCommands.rejectSelection()
    refresh()
  }

  function deleteComment(item: CommentItem) {
    jumpTo(item.from, item.to)
    GenericFormatingEditorCommands.deleteWordComment(item.id)
    refresh()
  }

  function replyComment(item: CommentItem) {
    jumpTo(item.from, item.to)
    GenericFormatingEditorCommands.replyWordComment(item.id).then(refresh)
  }

  function resolveComment(item: CommentItem) {
    GenericFormatingEditorCommands.resolveWordComment(item.id, !item.resolved)
    refresh()
  }

  function commentText(entry?: any) {
    if (!entry) return ''
    if (entry.text) return entry.text
    if (!entry.html) return ''
    if (typeof document !== 'undefined') {
      const div = document.createElement('div')
      div.innerHTML = entry.html
      return div.textContent || div.innerText || ''
    }
    return entry.html.replace(/<[^>]+>/g, '')
  }

  function toggleTrackChanges() {
    GenericFormatingEditorCommands.toggleTrackChanges()
    refresh()
  }

  function updateReviewer() {
    GenericFormatingEditorCommands.setReviewAuthor().then(refresh)
  }

  function setMarkup(mode: 'all' | 'simple' | 'none' | 'original') {
    markupMode = mode
    GenericFormatingEditorCommands.setMarkupMode(mode)
  }

  function toggleOnlyMine() {
    const next = GenericFormatingEditorCommands.toggleOnlyMine()
    if (typeof next === 'boolean') {
      onlyMine = next
      refresh()
    }
  }

  function toggleHideResolved() {
    const next = GenericFormatingEditorCommands.toggleHideResolvedComments()
    if (typeof next === 'boolean') {
      hideResolved = next
      refresh()
    }
  }

  function toggleMarginOnly() {
    const next = GenericFormatingEditorCommands.toggleCommentsMarginOnly()
    if (typeof next === 'boolean') {
      marginOnly = next
    }
  }

  function formatTimestamp(value?: number) {
    if (!value) return ''
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value))
    } catch {
      return new Date(value).toLocaleString()
    }
  }

  function initials(name?: string) {
    const safe = (name || 'U').trim()
    if (!safe) return 'U'
    const parts = safe.split(' ')
    const head = parts[0]?.[0] || 'U'
    const tail = parts[1]?.[0] || ''
    return `${head}${tail}`.toUpperCase()
  }

  function avatarColor(name?: string) {
    const safe = (name || 'User').toLowerCase()
    let hash = 0
    for (let i = 0; i < safe.length; i += 1) {
      hash = (hash * 31 + safe.charCodeAt(i)) >>> 0
    }
    const hue = hash % 360
    return `hsl(${hue} 55% 45%)`
  }
</script>

<div class="h-full flex flex-col bg-base-300 text-base-content font-sans select-none">
  <header class="p-3 bg-base-300 border-b border-white/5">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <div class="size-2 rd-full bg-primary shadow-[0_0_8px_var(--bg-primary)]"></div>
        <span class="text-[9px] font-900 tracking-[0.2em] opacity-40 uppercase"
          >{$_('Review_Engine')}</span
        >
      </div>
      <button class="adobe-toggle-btn" class:is-active={reviewEnabled} onclick={toggleTrackChanges}>
        <i class="ph-bold ph-record"></i>
        <span>{reviewEnabled ? 'TRACKING_ON' : 'TRACKING_OFF'}</span>
      </button>
    </div>

    <div class="flex flex-wrap gap-1.5">
      <div class="adobe-pill-select" onclick={updateReviewer}>
        <i class="ph-bold ph-user-focus"></i>
        <span>{reviewerName.toUpperCase()}</span>
      </div>
      <button class="adobe-filter-btn" class:active={onlyMine} onclick={toggleOnlyMine}>
        {$_('MINE_ONLY')}
      </button>
      <button class="adobe-filter-btn" class:active={hideResolved} onclick={toggleHideResolved}>
        {$_('HIDE_RESOLVED')}
      </button>
    </div>

    <div class="mt-3 grid grid-cols-4 gap-1 bg-base-content/8 p-1 rd-2px">
      {#each ['all', 'simple', 'none', 'original'] as mode}
        <button
          class="text-[8px] font-900 py-1 rd-1px transition-all"
          class:bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)]={markupMode === mode}
          class:text-black={markupMode === mode}
          class:opacity-30={markupMode !== mode}
          onclick={() => setMarkup(mode as any)}
        >
          {mode.toUpperCase()}
        </button>
      {/each}
    </div>
  </header>

  <nav class="flex px-3 bg-base-300 border-b border-white/5">
    {#each ['changes', 'comments'] as t}
      <button
        class="px-3 py-2 text-[10px] font-800 tracking-widest transition-all relative"
        class:opacity-100={tab === t}
        class:opacity-30={tab !== t}
        onclick={() => (tab = t as any)}
      >
        {t.toUpperCase()}
        {#if tab === t}
          <div class="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"></div>
        {/if}
      </button>
    {/each}
  </nav>

  <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar bg-base-300">
    <div class="p-3 flex flex-col gap-2">
      {#if tab === 'changes'}
        {#each reviewItems as item (`${item.id}-${item.pos}`)}
          <div class="adobe-card group">
            <div class="card-gutter" class:is-delete={item.type === 'delete'}></div>
            <div class="card-body">
              <div class="flex justify-between items-center mb-1">
                <span class="type-tag">{item.type.toUpperCase()}</span>
                <span class="meta-tag">{item.author}</span>
              </div>
              <p class="content-text">{item.text || 'Empty Fragment'}</p>
              <div class="card-actions">
                <button class="act-btn accept" onclick={() => acceptItem(item)}>ACCEPT</button>
                <button class="act-btn reject" onclick={() => rejectItem(item)}>REJECT</button>
                <button class="act-btn jump" onclick={() => jumpTo(item.pos)}
                  ><i class="ph-bold ph-crosshair"></i></button
                >
              </div>
            </div>
          </div>
        {/each}
      {:else}
        {#each commentItems as item (`${item.id}-${item.from}`)}
          <div
            class="adobe-card comment"
            class:is-resolved={item.resolved}
            onclick={() => {
              jumpTo(item.from, item.to)
              focusWordComment(item.id, { source: 'review', scroll: true })
            }}
          >
            <div class="card-body">
              <div class="flex items-center gap-2 mb-2">
                <div
                  class="size-5 rd-full flex items-center justify-center text-[8px] font-900 border border-white/10"
                  style="background:{avatarColor(item.author)}"
                >
                  {initials(item.author)}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-[10px] font-700 truncate">{item.author}</div>
                  <div class="text-[8px] opacity-30 font-mono uppercase tracking-tighter">
                    {formatTimestamp(item.timestamp)}
                  </div>
                </div>
              </div>

              <div class="content-text">
                {#if item.thread?.[0]?.html}
                  {@html item.thread?.[0]?.html}
                {:else}
                  {commentText(item.thread?.[0]) || item.text}
                {/if}
              </div>

              {#if item.thread?.length > 1}
                <div class="mt-2 pl-3 border-l border-white/5 flex flex-col gap-1.5">
                  {#each item.thread.slice(1) as reply}
                    <div class="text-[10px] leading-snug">
                      <span class="font-900 opacity-40 mr-1 text-[8px] uppercase"
                        >{reply.author}:</span
                      >
                      <span class="opacity-80">
                        {#if reply?.html}
                          {@html reply.html}
                        {:else}
                          {commentText(reply)}
                        {/if}
                      </span>
                    </div>
                  {/each}
                </div>
              {/if}

              <button
                class="act-btn"
                onclick={(e) => {
                  e.stopPropagation()
                  replyComment(item)
                }}
              >
                REPLY
              </button>

              <button
                class="act-btn reject"
                onclick={(e) => {
                  e.stopPropagation()
                  deleteComment(item)
                }}
              >
                <i class="ph-bold ph-trash"></i>
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <footer class="p-2 bg-base-content/6 border-t border-white/5 flex gap-2">
    <button class="adobe-batch-btn primary flex-1">
      <i class="ph-bold ph-check-square"></i>
      <span>{$_('ACCEPT_ALL')}</span>
    </button>
    <button class="adobe-batch-btn flex-1">
      <i class="ph-bold ph-x-square"></i>
      <span>{$_('REJECT_ALL')}</span>
    </button>
  </footer>
</div>

<style lang="postcss">
  /* Spectrum 2 Mechanical Primitives */
  .adobe-toggle-btn {
    @apply flex items-center gap-2 px-3 h-6 bg-[var(--color-base-100)]/10 rd-2px border border-white/5
           text-[9px] font-900 tracking-widest transition-all hover:bg-[var(--color-base-100)]/14;
  }
  .adobe-toggle-btn.is-active {
    @apply text-primary border-primary/30 bg-primary/5;
  }

  .adobe-pill-select {
    @apply flex items-center gap-2 px-2 h-5 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rd-2px text-[8px] font-900 tracking-widest 
           text-[var(--color-base-content)]/40 cursor-pointer hover:text-[var(--color-base-content)] transition-all;
  }

  .adobe-filter-btn {
    @apply px-2 h-5 text-[8px] font-900 tracking-widest text-[var(--color-base-content)]/20 border border-transparent 
           rd-2px hover:text-[var(--color-base-content)] transition-all;
  }
  .adobe-filter-btn.active {
    @apply bg-primary/10 text-primary border-primary/20;
  }

  /* Card Architecture */
  .adobe-card {
    @apply flex bg-[color-mix(in_srgb,var(--color-base-white)_3%,transparent)] border border-white/5 rd-2px overflow-hidden transition-all;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  .adobe-card:hover {
    @apply border-white/10 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)];
  }
  .is-resolved {
    @apply opacity-40 grayscale;
  }

  .card-gutter {
    @apply w-[3px] bg-primary/60;
  }
  .card-gutter.is-delete {
    @apply bg-red-500/60;
  }

  .card-body {
    @apply flex-1 p-3 min-w-0;
  }

  .type-tag {
    @apply text-[8px] font-900 tracking-widest text-primary opacity-60;
  }
  .meta-tag {
    @apply text-[8px] font-mono text-[var(--color-base-content)]/20;
  }

  .content-text {
    @apply text-[11px] text-[var(--color-base-content)]/70 leading-relaxed font-sans;
  }

  .card-actions {
    @apply flex gap-1 mt-3;
  }

  .act-btn {
    @apply h-5 px-2 text-[8px] font-900 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rd-1px text-[var(--color-base-content)]/40 
           hover:(bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-[var(--color-base-content)]) transition-all;
  }
  .act-btn.accept {
    @apply hover:(bg-primary text-black);
  }
  .act-btn.reject {
    @apply hover:(bg-red-500 text-[var(--color-base-content)]);
  }
  .act-btn.resolve {
    @apply text-primary/60 hover:(bg-primary/20 text-primary);
  }

  .adobe-batch-btn {
    @apply h-8 flex items-center justify-center gap-2 text-[9px] font-900 tracking-widest 
           bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rd-2px text-[var(--color-base-content)]/30 hover:(bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-[var(--color-base-content)]);
  }
  .adobe-batch-btn.primary {
    @apply text-primary/80 hover:text-primary;
  }

  /* Custom Scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    @apply bg-transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    @apply bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rd-full hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)];
  }
</style>
