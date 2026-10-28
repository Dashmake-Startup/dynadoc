<script lang="ts">
  /**
   * InternalLinkPicker.svelte
   *
   * Modal dialog that lets users search for and select an internal document
   * to link to. Triggered via:
   *   - editor.commands.openInternalLinkPicker()
   *   - Toolbar "Insert Link" button
   *   - [[Label]] input rule (when no fileId is provided)
   *
   * Design: Adobe Spectrum dark modal + Phosphor icons.
   * Performance: search is fully client-side against a pre-fetched index,
   * debounced at 150 ms so keystrokes never lag.
   */

  import { fly, fade } from 'svelte/transition'
  import { internalLinkStore } from '../stores/internalLink.store.svelte'
  import { _$_documentEditorsList } from '../../../../stores/editor.store'
  import { nodeApi } from '../../../../utils/shims/node'

  // ── Types ────────────────────────────────────────────────────────────────────

  interface FileEntry {
    fileId: string
    title: string
    path: string
    docType: 'document' | 'spreadsheet' | 'presentation' | 'folder' | 'unknown'
    lastModified: string
    status: 'draft' | 'published' | 'archived'
  }

  // ── State ────────────────────────────────────────────────────────────────────

  const activeEditorStore = _$_documentEditorsList.getActive()
  const activeEditor = $derived($activeEditorStore)
  const activeDocument = $derived(activeEditor?.document || null)

  const rootPath = $derived(
    activeDocument?.cachePath ||
      (activeDocument?.path ? nodeApi.path.dirname(activeDocument.path) : '')
  )

  let query = $state(internalLinkStore.picker.query)
  let results = $state<FileEntry[]>([])
  let loading = $state(false)
  let selectedIndex = $state(0)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let inputEl: HTMLInputElement

  // ── Search ───────────────────────────────────────────────────────────────────

  const DOC_TYPE_ICONS: Record<string, string> = {
    document:     'ph-file-text',
    spreadsheet:  'ph-file-xls',
    presentation: 'ph-presentation-chart',
    folder:       'ph-folder',
    unknown:      'ph-file',
  }

  const STATUS_COLORS: Record<string, string> = {
    draft:     'hsl(42 90% 55%)',
    published: 'hsl(152 55% 42%)',
    archived:  'hsl(0 0% 50%)',
  }

  async function search(q: string) {
    loading = true
    selectedIndex = 0
    try {
      const path = rootPath
      if (!path) {
        results = []
        return
      }

      const res = await window.api.searchFileNames({
        rootPath: path,
        query: q,
        maxResults: 30
      })

      if (res && res.ok && Array.isArray(res.items)) {
        results = res.items.map((item: any) => ({
          fileId: item.path,
          title: item.name,
          path: item.path,
          docType: item.isFolder ? 'folder' : 'document',
          lastModified: '',
          status: 'draft'
        }))
      } else {
        results = []
      }
    } catch (err) {
      console.error('[InternalLinkPicker] Search failed:', err)
      results = []
    } finally {
      loading = false
    }
  }

  function handleInput() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => search(query), 150)
  }

  // ── Keyboard navigation ──────────────────────────────────────────────────────

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      internalLinkStore.closePicker()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1)
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedIndex = Math.max(selectedIndex - 1, 0)
    }
    if (e.key === 'Enter' && results[selectedIndex]) {
      confirm(results[selectedIndex])
    }
  }

  function confirm(file: FileEntry) {
    internalLinkStore.confirmPicker(file.fileId, file.title)
  }

  // ── Highlight matched text ───────────────────────────────────────────────────

  function highlight(text: string, q: string): string {
    if (!q.trim()) return text
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>')
  }

  // Trigger initial search when picker opens
  $effect(() => {
    if (internalLinkStore.picker.open) {
      query = internalLinkStore.picker.query
      search(query)
      setTimeout(() => inputEl?.focus(), 50)
    }
  })
</script>

{#if internalLinkStore.picker.open}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="ilpk-backdrop"
    transition:fade={{ duration: 150 }}
    onclick={() => internalLinkStore.closePicker()}
    onkeydown={e => e.key === 'Escape' && internalLinkStore.closePicker()}
    role="dialog"
    aria-modal="true"
    aria-label="Select internal document to link"
  ></div>

  <!-- Dialog panel -->
  <div
    class="ilpk-panel"
    transition:fly={{ y: -16, duration: 200 }}
    role="document"
  >
    <!-- Header -->
    <div class="ilpk-header">
      <i class="ph-light ph-link-simple ilpk-header-icon"></i>
      <span class="ilpk-title">Link to a document</span>
      <button class="ilpk-close" onclick={() => internalLinkStore.closePicker()} aria-label="Close">
        <i class="ph-light ph-x"></i>
      </button>
    </div>

    <!-- Search input -->
    <div class="ilpk-search-wrap">
      <i class="ph-light ph-magnifying-glass ilpk-search-icon"></i>
      <input
        bind:this={inputEl}
        bind:value={query}
        oninput={handleInput}
        onkeydown={handleKeydown}
        class="ilpk-search"
        type="search"
        placeholder="Search documents by name, tag, or content…"
        autocomplete="off"
        spellcheck={false}
      />
      {#if loading}
        <i class="ph-light ph-circle-notch ilpk-spin"></i>
      {/if}
    </div>

    <!-- Results list -->
    <div class="ilpk-results" role="listbox" aria-label="Search results">
      {#if results.length === 0 && !loading}
        <div class="ilpk-empty">
          <i class="ph-light ph-magnifying-glass"></i>
          <span>{query ? 'No documents found.' : 'Start typing to search your workspace…'}</span>
        </div>

      {:else}
        {#each results as file, i (file.fileId)}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <div
            class="ilpk-item {i === selectedIndex ? 'selected' : ''}"
            onclick={() => confirm(file)}
            onmouseenter={() => (selectedIndex = i)}
            role="option"
            aria-selected={i === selectedIndex}
          >
            <div class="ilpk-item-icon-wrap">
              <i class="ph-light {DOC_TYPE_ICONS[file.docType] ?? 'ph-file'} ilpk-item-icon"></i>
            </div>
            <div class="ilpk-item-body">
              <div class="ilpk-item-title">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html highlight(file.title, query)}
              </div>
              {#if file.path}
                <div class="ilpk-item-path">{file.path}</div>
              {/if}
            </div>
            <div class="ilpk-item-meta">
              <span
                class="ilpk-status-dot"
                title={file.status}
                style="background:{STATUS_COLORS[file.status] ?? 'hsl(0 0% 50%)'}"
              ></span>
              {#if file.lastModified}
                <span class="ilpk-date">
                  {new Date(file.lastModified).toLocaleDateString(undefined, { month:'short', day:'numeric' })}
                </span>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Footer tips -->
    <div class="ilpk-footer">
      <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
      <span><kbd>Enter</kbd> select</span>
      <span><kbd>Esc</kbd> cancel</span>
    </div>
  </div>
{/if}

<style>
  /* ── Backdrop ────────────────────────────────────────────────────────────── */
  .ilpk-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10100;
    background: hsl(220 20% 5% / 0.6);
    backdrop-filter: blur(4px);
    cursor: default;
  }

  /* ── Panel ───────────────────────────────────────────────────────────────── */
  .ilpk-panel {
    position: fixed;
    z-index: 10101;
    top: 15vh;
    left: 50%;
    transform: translateX(-50%);
    width: min(580px, 90vw);
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    background: hsl(220 16% 11%);
    border: 1px solid hsl(220 12% 20%);
    border-radius: 12px;
    box-shadow:
      0 0 0 1px hsl(220 12% 6%),
      0 24px 64px hsl(220 30% 3% / 0.9);
    overflow: hidden;
    font-family: var(--brand-font-sans);
  }

  /* ── Header ──────────────────────────────────────────────────────────────── */
  .ilpk-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid hsl(220 12% 16%);
    flex-shrink: 0;
  }

  .ilpk-header-icon {
    font-size: 18px;
    color: hsl(220 80% 65%);
  }

  .ilpk-title {
    flex: 1;
    font-size: 14px;
    font-weight: 700;
    color: hsl(220 10% 92%);
    letter-spacing: -0.01em;
  }

  .ilpk-close {
    background: transparent;
    border: none;
    color: hsl(220 8% 50%);
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    line-height: 1;
    transition: color 0.15s, background 0.15s;
  }

  .ilpk-close:hover {
    color: hsl(220 10% 80%);
    background: hsl(220 12% 18%);
  }

  /* ── Search ──────────────────────────────────────────────────────────────── */
  .ilpk-search-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-bottom: 1px solid hsl(220 12% 15%);
    flex-shrink: 0;
    background: hsl(220 14% 9%);
  }

  .ilpk-search-icon {
    font-size: 17px;
    color: hsl(220 8% 45%);
    flex-shrink: 0;
  }

  .ilpk-search {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 13.5px;
    color: hsl(220 10% 90%);
    font-family: inherit;
    caret-color: hsl(220 80% 65%);
  }

  .ilpk-search::placeholder {
    color: hsl(220 8% 38%);
  }

  .ilpk-spin {
    font-size: 16px;
    color: hsl(220 8% 45%);
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Results ─────────────────────────────────────────────────────────────── */
  .ilpk-results {
    flex: 1;
    overflow-y: auto;
    padding: 6px 0;
    scrollbar-width: thin;
    scrollbar-color: hsl(220 12% 20%) transparent;
  }

  .ilpk-results::-webkit-scrollbar {
    width: 4px;
  }

  .ilpk-results::-webkit-scrollbar-thumb {
    background: hsl(220 12% 22%);
    border-radius: 4px;
  }

  .ilpk-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 40px 20px;
    color: hsl(220 8% 40%);
    font-size: 13px;
  }

  .ilpk-empty i {
    font-size: 32px;
    opacity: 0.4;
  }

  /* ── Item ────────────────────────────────────────────────────────────────── */
  .ilpk-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 16px;
    cursor: pointer;
    transition: background 0.1s;
    border-radius: 0;
    user-select: none;
  }

  .ilpk-item:hover,
  .ilpk-item.selected {
    background: hsl(220 12% 16%);
  }

  .ilpk-item.selected {
    background: hsl(220 80% 55% / 0.12);
  }

  .ilpk-item-icon-wrap {
    width: 32px;
    height: 32px;
    border-radius: 7px;
    background: hsl(220 14% 15%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .ilpk-item-icon {
    font-size: 17px;
    color: hsl(220 60% 65%);
  }

  .ilpk-item-body {
    flex: 1;
    min-width: 0;
  }

  .ilpk-item-title {
    font-size: 13px;
    font-weight: 600;
    color: hsl(220 10% 90%);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Highlight matched text */
  :global(.ilpk-item-title mark) {
    background: hsl(220 90% 60% / 0.25);
    color: hsl(220 80% 78%);
    border-radius: 2px;
    padding: 0 1px;
  }

  .ilpk-item-path {
    font-size: 10.5px;
    color: hsl(220 8% 45%);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
  }

  .ilpk-item-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
  }

  .ilpk-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: block;
  }

  .ilpk-date {
    font-size: 10px;
    color: hsl(220 8% 40%);
    white-space: nowrap;
  }

  /* ── Footer ──────────────────────────────────────────────────────────────── */
  .ilpk-footer {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 9px 16px;
    border-top: 1px solid hsl(220 12% 15%);
    font-size: 10px;
    color: hsl(220 8% 38%);
    flex-shrink: 0;
    background: hsl(220 14% 9%);
  }

  kbd {
    background: hsl(220 12% 16%);
    border: 1px solid hsl(220 12% 22%);
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 9px;
    font-family: inherit;
    color: hsl(220 8% 55%);
  }
</style>
