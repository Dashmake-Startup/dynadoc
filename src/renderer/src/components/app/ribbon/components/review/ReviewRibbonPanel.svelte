<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../../../stores/editor.store'
  import { GenericFormatingEditorCommands } from '../../../../common/actions/formatting'
  import { untrack } from 'svelte' // Import untrack

  let reviewEnabled = $state(false)
  let reviewerName = $state('')
  let insertCount = $state(0)
  let deleteCount = $state(0)
  let filtersOpen = $state(false)
  let availableReviewers = $state<string[]>([])
  let filterAuthors = $state<string[]>([])
  let filterModes = $state<string[]>([])
  let filterSummary = $state('')

  const activeDocStore = _$_documentEditorsList.getActive()
  const activeWysiwygStore = _$_wysiwygEditorsList.getActive()
  let activeDoc = $derived($activeDocStore)

  const getEditor = () =>
    $activeWysiwygStore?.editor ||
    _$_wysiwygEditorsList.getActiveEntry?.()?.editor ||
    _$_wysiwygEditorsList.getActive2?.() ||
    null

  const updateCounts = () => {
    const editor = getEditor()
    if (!editor) return

    // Use untrack so that setting these variables doesn't re-trigger the effect
    untrack(() => {
      let ins = 0
      let del = 0

      // PRO TIP: Don't use getJSON(). Scan the ProseMirror doc directly for performance.
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'review') {
          if (node.attrs?.mode === 'insert') ins++
          if (node.attrs?.mode === 'delete') del++
        }
      })

      insertCount = ins
      deleteCount = del
    })
  }

  const syncState = () => {
    const editor = getEditor()
    const settings = activeDoc?.document?.config?.reviewSettings || {}
    const nextFilterAuthors = settings.filterAuthors ?? []
    const nextFilterModes = settings.filterModes ?? []
    const nextAvailableReviewers = GenericFormatingEditorCommands.listReviewAuthors()
    const nextReviewEnabled = !!editor?.storage?.review?.enabled
    const nextReviewerName =
      editor?.storage?.review?.author || settings.reviewerName || 'Editor'
    const authorsLabel =
      nextFilterAuthors.length === 0 ? $_('All reviewers') : nextFilterAuthors.join(', ')
    const modesLabel =
      nextFilterModes.length === 0
        ? $_('All changes')
        : nextFilterModes.includes('insert') && nextFilterModes.includes('delete')
          ? $_('Insertions, Deletions')
          : nextFilterModes.includes('insert')
            ? $_('Insertions')
            : $_('Deletions')
    const nextSummary = `${authorsLabel} · ${modesLabel}`

    reviewEnabled = nextReviewEnabled
    reviewerName = nextReviewerName
    filterAuthors = nextFilterAuthors
    filterModes = nextFilterModes
    availableReviewers = nextAvailableReviewers
    filterSummary = nextSummary
  }

  $effect(() => {
    const editor = getEditor()
    if (!editor) return

    // Initial sync
    syncState()
    GenericFormatingEditorCommands.applyReviewFiltersFromConfig()
    updateCounts()

    const handler = () => {
      // Logic inside handlers is naturally "untracked" from the effect's
      // initial execution, but keep it clean:
      syncState()
      GenericFormatingEditorCommands.applyReviewFiltersFromConfig()
      updateCounts()
    }

    editor.on('transaction', handler)
    return () => editor.off('transaction', handler)
  })

  const toggleAuthor = (name: string) => {
    const next = filterAuthors.includes(name)
      ? filterAuthors.filter((item) => item !== name)
      : [...filterAuthors, name]
    filterAuthors = next
    GenericFormatingEditorCommands.setReviewFilterAuthors(next)
  }

  const toggleMode = (mode: 'insert' | 'delete') => {
    const next = filterModes.includes(mode)
      ? filterModes.filter((item) => item !== mode)
      : [...filterModes, mode]
    filterModes = next
    GenericFormatingEditorCommands.setReviewFilterModes(next)
  }

  const clearFilters = () => {
    filterAuthors = []
    filterModes = []
    GenericFormatingEditorCommands.clearReviewFilters()
  }

  // ... other imports
</script>

<div class="review-ribbon-panel">
  <div class="review-row">
    <label class="review-toggle">
      <input
        type="checkbox"
        bind:checked={reviewEnabled}
        onchange={() => GenericFormatingEditorCommands.toggleTrackChanges(reviewEnabled)}
      />
      <span>{$_('Track Changes')}</span>
    </label>
    <span class="review-spacer"></span>
    <button class="review-chip" onclick={() => GenericFormatingEditorCommands.setReviewAuthor()}>
      <i class="ph-light ph-user"></i>
      <span class="review-chip-label">{reviewerName || $_('Reviewer')}</span>
    </button>
    <button
      class="review-chip"
      class:active={filtersOpen}
      title={filterSummary}
      onclick={() => (filtersOpen = !filtersOpen)}
    >
      <i class="ph-light ph-funnel"></i>
      <span>{$_('Filters')}</span>
    </button>
  </div>

  {#if filtersOpen}
    <div class="review-filters">
      <div class="review-filter-block">
        <div class="review-filter-title">{$_('Reviewers')}</div>
        {#if availableReviewers.length === 0}
          <div class="review-filter-empty">{$_('No reviewers found')}</div>
        {:else}
          {#each availableReviewers as reviewer (reviewer)}
            <label class="review-filter-item">
              <input
                type="checkbox"
                checked={filterAuthors.includes(reviewer)}
                onchange={() => toggleAuthor(reviewer)}
              />
              <span>{reviewer}</span>
            </label>
          {/each}
        {/if}
      </div>
      <div class="review-filter-block">
        <div class="review-filter-title">{$_('Change types')}</div>
        <label class="review-filter-item">
          <input
            type="checkbox"
            checked={filterModes.includes('insert')}
            onchange={() => toggleMode('insert')}
          />
          <span>{$_('Insertions')}</span>
        </label>
        <label class="review-filter-item">
          <input
            type="checkbox"
            checked={filterModes.includes('delete')}
            onchange={() => toggleMode('delete')}
          />
          <span>{$_('Deletions')}</span>
        </label>
      </div>
      <div class="review-filter-actions">
        <button class="review-btn" onclick={clearFilters}>{$_('Clear Filters')}</button>
      </div>
    </div>
  {/if}

  <div class="review-row">
    <span class="review-stat review-stat-ins" title={$_('Insertions')}>
      <i class="ph-bold ph-plus"></i>{insertCount}
    </span>
    <span class="review-stat review-stat-del" title={$_('Deletions')}>
      <i class="ph-bold ph-minus"></i>{deleteCount}
    </span>
    <span class="review-spacer"></span>
    <button
      class="review-btn review-accept"
      onclick={GenericFormatingEditorCommands.acceptAll}
      disabled={insertCount + deleteCount === 0}
    >
      <i class="ph-bold ph-check"></i>{$_('Accept All')}
    </button>
    <button
      class="review-btn review-reject"
      onclick={GenericFormatingEditorCommands.rejectAll}
      disabled={insertCount + deleteCount === 0}
    >
      <i class="ph-bold ph-x"></i>{$_('Reject All')}
    </button>
  </div>
</div>

<style lang="postcss">
  .review-ribbon-panel {
    @apply relative flex flex-col gap-2 px-3 py-2 border rounded-lg;
    min-width: 232px;
    align-self: center;
    background: var(--field);
    border-color: var(--line);
  }
  .review-row {
    @apply flex items-center gap-2;
  }
  .review-spacer {
    @apply flex-1;
  }
  .review-toggle {
    @apply flex items-center gap-2 text-[11px] font-medium cursor-pointer;
    color: var(--text);
  }
  .review-toggle input {
    @apply toggle toggle-primary toggle-xs;
  }
  .review-chip {
    @apply flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border;
    color: var(--text);
    border-color: var(--line);
    background: var(--ribbon);
    transition: border-color 0.12s, color 0.12s;
  }
  .review-chip:hover {
    border-color: var(--accent);
  }
  .review-chip.active {
    border-color: var(--accent);
    color: var(--accent);
  }
  .review-chip-label {
    @apply truncate;
    max-width: 90px;
  }
  .review-filters {
    @apply absolute left-0 z-40 flex flex-col gap-2 border rounded-md p-3;
    top: calc(100% + 6px);
    min-width: 220px;
    background: var(--panel);
    border-color: var(--line);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
  }
  .review-filter-block {
    @apply flex flex-col gap-1.5;
  }
  .review-filter-title {
    @apply text-[10px] uppercase tracking-wide font-semibold;
    color: var(--muted);
  }
  .review-filter-item {
    @apply flex items-center gap-2 text-[12px] cursor-pointer;
    color: var(--text);
  }
  .review-filter-empty {
    @apply text-[12px];
    color: var(--muted);
  }
  .review-filter-actions {
    @apply flex justify-end;
  }
  .review-stat {
    @apply flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md;
  }
  .review-stat-ins {
    color: #1a9e6b;
    background: color-mix(in srgb, #1a9e6b 12%, transparent);
  }
  .review-stat-del {
    color: #d6492f;
    background: color-mix(in srgb, #d6492f 12%, transparent);
  }
  .review-btn {
    @apply flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md border;
    color: var(--text);
    border-color: var(--line);
    background: var(--ribbon);
    transition: border-color 0.12s, background 0.12s;
  }
  .review-btn:hover {
    border-color: var(--accent);
  }
  .review-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .review-accept {
    color: #1a9e6b;
    border-color: color-mix(in srgb, #1a9e6b 35%, transparent);
  }
  .review-accept:hover:not(:disabled) {
    border-color: #1a9e6b;
    background: color-mix(in srgb, #1a9e6b 8%, transparent);
  }
  .review-reject {
    color: #d6492f;
    border-color: color-mix(in srgb, #d6492f 35%, transparent);
  }
  .review-reject:hover:not(:disabled) {
    border-color: #d6492f;
    background: color-mix(in srgb, #d6492f 8%, transparent);
  }
</style>
