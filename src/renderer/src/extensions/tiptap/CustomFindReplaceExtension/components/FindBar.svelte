<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte'
  import type { Editor } from '@tiptap/core'
  import { _$_findBar } from '../findBar.store'

  let { editor }: { editor: Editor | null } = $props()

  let inputEl = $state<HTMLInputElement | null>(null)
  let query = $state('')
  let caseSensitive = $state(false)
  let wholeWord = $state(false)
  let currentIdx = $state(0)
  let totalCount = $state(0)

  // Sync currentIdx/totalCount from plugin back to local state
  const unsub = _$_findBar.subscribe((s) => {
    currentIdx = s.currentIdx
    totalCount = s.totalCount
  })

  // Focus input whenever the bar opens
  $effect(() => {
    tick().then(() => inputEl?.focus())
  })

  // Dispatch query to ProseMirror plugin whenever query/flags change
  $effect(() => {
    const q = query
    const cs = caseSensitive
    const ww = wholeWord
    editor?.commands.setFindQuery(q, { caseSensitive: cs, wholeWord: ww })
  })

  function next() { editor?.commands.findNext() }
  function prev() { editor?.commands.findPrev() }

  function close() {
    editor?.commands.clearFind()
    query = ''
    _$_findBar.update((s) => ({ ...s, open: false, query: '', totalCount: 0, currentIdx: 0 }))
  }

  function onInputKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); return }
    if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? prev() : next() }
  }

  function toggleCase() { caseSensitive = !caseSensitive }
  function toggleWord() { wholeWord = !wholeWord }

  // Capture-phase global listener so Cmd+F refocuses even when input is not active
  function onGlobalKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault()
      e.stopPropagation()
      tick().then(() => { inputEl?.focus(); inputEl?.select() })
    }
  }

  onMount(() => {
    document.addEventListener('keydown', onGlobalKeyDown, true)
  })

  onDestroy(() => {
    document.removeEventListener('keydown', onGlobalKeyDown, true)
    unsub()
  })
</script>

<div class="find-bar" role="search">
  <div class="find-input-row">
    <input
      bind:this={inputEl}
      bind:value={query}
      onkeydown={onInputKeyDown}
      type="text"
      placeholder="Find"
      class="find-input"
      autocomplete="off"
      spellcheck="false"
    />

    <button
      class="flag-btn {caseSensitive ? 'active' : ''}"
      title="Match Case"
      onclick={toggleCase}
      tabindex="-1"
    >Aa</button>

    <button
      class="flag-btn {wholeWord ? 'active' : ''}"
      title="Match Whole Word"
      onclick={toggleWord}
      tabindex="-1"
    >W</button>

    <span class="match-count">
      {#if totalCount === 0}
        No results
      {:else}
        {currentIdx + 1} / {totalCount}
      {/if}
    </span>

    <button class="nav-btn" title="Previous match (Shift+Enter)" onclick={prev} tabindex="-1">
      <i class="ph-light ph-arrow-up"></i>
    </button>
    <button class="nav-btn" title="Next match (Enter)" onclick={next} tabindex="-1">
      <i class="ph-light ph-arrow-down"></i>
    </button>
    <button class="close-btn" title="Close (Escape)" onclick={close} tabindex="-1">
      <i class="ph-light ph-x"></i>
    </button>
  </div>
</div>

<style>
  .find-bar {
    position: absolute;
    top: 12px;
    right: 16px;
    z-index: 50;
    background: var(--color-base-200, #1e1e1e);
    border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    padding: 4px 6px;
    min-width: 280px;
  }

  .find-input-row {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .find-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 12px;
    color: inherit;
    padding: 2px 4px;
    min-width: 0;
  }

  .flag-btn {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: color-mix(in srgb, currentColor 45%, transparent);
    line-height: 1.6;
    flex-shrink: 0;
  }

  .flag-btn:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
  .flag-btn.active { background: var(--color-primary, #4f8ef7); color: white; }

  .match-count {
    font-size: 10px;
    color: color-mix(in srgb, currentColor 40%, transparent);
    white-space: nowrap;
    padding: 0 4px;
    flex-shrink: 0;
  }

  .nav-btn, .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 3px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: color-mix(in srgb, currentColor 55%, transparent);
    flex-shrink: 0;
  }

  .nav-btn:hover, .close-btn:hover {
    background: color-mix(in srgb, currentColor 10%, transparent);
    color: inherit;
  }
</style>
