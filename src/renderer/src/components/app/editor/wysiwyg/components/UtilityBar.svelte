<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onDestroy, onMount } from 'svelte'
  import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../../../stores/editor.store'
  import type { PaginationPlusOptions } from '../../../../../extensions/tiptap/utils/common.utils'
  import { PAGE_SIZES, type PageSize } from 'tiptap-pagination-plus'

  const _activeEntryStore = _$_wysiwygEditorsList.getActive()
  let _activeEntry = $derived(_activeEntryStore ? $_activeEntryStore : null)
  let _editor = $derived(_activeEntry?.editor ?? null)
  let __wysiwygEditorId = $derived(_activeEntry?.id ?? '')
  let _editorPaginationOptions = $derived(_activeEntry?.paginationOptions ?? null)

  let _paginationEnabled = $derived(_editorPaginationOptions?.enabled || false)
  let viewMode = $state('print') // 'print' | 'web' | 'draft'
  let zoomLevel = $state(100)
  let _now = $state(Date.now())

  // The editor's `storage` is a plain object that the collaboration extension
  // mutates in place. Svelte cannot see that, so a `$derived` reading it
  // recomputes only when `_editor` itself is replaced -- which is why the
  // badge stayed on "connecting" while the document was in fact connected and
  // being stored. Reading `_now` gives these three a dependency that does
  // change, so they are re-read on every tick.
  let _collabUsers = $derived.by(() => {
    void _now
    return _editor?.storage?.collaborationCaret?.users || []
  })
  let _collabStatus = $derived.by(() => {
    void _now
    return _editor?.storage?.collaborationStatus || 'offline'
  })
  let _collabLastSeen = $derived.by(() => {
    void _now
    return _editor?.storage?.collaborationLastSeen || null
  })

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(/\s+/)
    if (!parts.length) return 'U'
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
  }

  const formatRelative = (timestamp: number | null, now: number) => {
    if (!timestamp) return $_('Offline')
    const diff = Math.max(0, now - timestamp)
    const sec = Math.floor(diff / 1000)
    if (sec < 60) return $_('Last seen just now')
    const min = Math.floor(sec / 60)
    if (min < 60) return $_(`Last seen ${min}m ago`)
    const hr = Math.floor(min / 60)
    if (hr < 24) return $_(`Last seen ${hr}h ago`)
    const day = Math.floor(hr / 24)
    return $_(`Last seen ${day}d ago`)
  }

  onMount(() => {
    // Two seconds, not thirty. This tick now also carries the connection
    // badge, and telling someone their work is not syncing for half a minute
    // after it started is the same lie in a smaller size. The relative time
    // beside it renders in minutes, so refreshing it more often costs nothing
    // and shows nothing new.
    const timer = window.setInterval(() => {
      _now = Date.now()
    }, 2000)
    onDestroy(() => window.clearInterval(timer))
  })

  function togglePagination() {
    if (!_editor) return
    _paginationEnabled = !_paginationEnabled
    const options: PaginationPlusOptions = {
      ..._editorPaginationOptions,
      enabled: _paginationEnabled
    }
    _editor.commands?.updatePagination?.(_paginationEnabled)
    _$_wysiwygEditorsList.setPaginationOptions(__wysiwygEditorId, options)
    _$_documentEditorsList.updateDocumentConfig(__wysiwygEditorId, (doc) => {
      doc.config.pagination = {
        ...(doc.config.pagination || {}),
        ...options
      }
    })
  }

  function setPageSize(size: PageSize) {
    // function setPageSize(size: 'A4' | 'Letter' | 'Legal') {
    // Innovative: Direct command to change CSS @page bounds
    if (!_editor) return
    _editor.commands.updatePageSize(size)
  }
</script>

<div
  class="utility-bar flex items-center justify-between px-2 h-full bg-base-200 select-none font-sans"
>
  <div class="flex items-center gap-1">
    <div class="flex bg-base-300 p-0.5 rounded-[4px] border border-base-100/10">
      <button
        onclick={togglePagination}
        title={$_('Paginated')}
        class="px-2 py-1 text-[10px] font-bold uppercase tracking-tighter rounded-[3px] transition-all
               {_paginationEnabled
          ? 'bg-primary text-primary-content shadow-sm'
          : 'hover:bg-base-100 opacity-50'}"
      >
        <i class="utility-mode-icon ph-light ph-file-text"></i>
        <span class="utility-mode-label">{$_('Paginated')}</span>
      </button>
      <button
        onclick={togglePagination}
        title={$_('Flow')}
        class="px-2 py-1 text-[10px] font-bold uppercase tracking-tighter rounded-[3px] transition-all
               {!_paginationEnabled
          ? 'bg-primary text-primary-content shadow-sm'
          : 'hover:bg-base-100 opacity-50'}"
      >
        <i class="utility-mode-icon ph-light ph-text-align-left"></i>
        <span class="utility-mode-label">{$_('Flow')}</span>
      </button>
    </div>

    <div class="h-4 w-px bg-base-300 mx-1"></div>

    <div class="dropdown dropdown-bottom">
      <button tabindex="0" class="theme-util-btn" title={$_('Page size')}>
        <i class="ph-light ph-file-text mr-1.5"></i>
        <span class="utility-page-label">{$_('A4')}</span>
        <i class="ph-light ph-caret-down ml-1 text-[10px]"></i>
      </button>
      <ul
        tabindex="0"
        class="dropdown-content z-[1] menu p-1 shadow-2xl bg-base-300 border border-base-100 rounded-sm w-32 mt-1 text-[11px]"
      >
        <li><button onclick={() => setPageSize(PAGE_SIZES.A4)}>{$_('A4 (ISO)')}</button></li>
        <li><button onclick={() => setPageSize(PAGE_SIZES.LETTER)}>{$_('Letter (US)')}</button></li>
        <li><button onclick={() => setPageSize(PAGE_SIZES.LEGAL)}>{$_('Legal')}</button></li>
      </ul>
    </div>
  </div>

  <div class="flex items-center gap-2">
    <div class="collab-pill">
      <div class="avatar-stack">
        {#if !_collabUsers.length}
          <div class="avatar avatar-empty">
            <span>{getInitials('You')}</span>
          </div>
        {:else}
          {#each _collabUsers.slice(0, 5) as user, idx (user?.name + idx)}
            <div class="avatar" style={`z-index:${10 - idx}; background:${user?.color || '#444'}`}>
              {#if user?.avatar || user?.image || user?.photo}
                <img src={user?.avatar || user?.image || user?.photo} alt={user?.name || 'user'} />
              {:else}
                <span>{getInitials(user?.name)}</span>
              {/if}
            </div>
          {/each}
        {/if}
        {#if _collabUsers.length > 5}
          <div class="avatar avatar-count">
            <span>+{_collabUsers.length - 5}</span>
          </div>
        {/if}
      </div>
      <div class="status-label">
        {#if _collabStatus === 'connected'}
          <span class="dot dot-live"></span>
          <span class="label-text">{$_('Live')}</span>
        {:else if _collabStatus === 'connecting'}
          <span class="dot dot-warn"></span>
          <span class="label-text">{$_('Connecting')}</span>
        {:else}
          <span class="dot dot-offline"></span>
          <span class="label-text">{formatRelative(_collabLastSeen, _now)}</span>
        {/if}
      </div>
    </div>

    <button class="theme-util-btn-icon" title={$_('Two-Page Spread')}
      ><i class="ph-light ph-book-open"></i></button
    >
    <button class="theme-util-btn-icon" title={$_('Dark Mode Canvas')}
      ><i class="ph-light ph-moon"></i></button
    >
    <button class="theme-util-btn-icon" title={$_('Focus Mode (Hide UI)')}
      ><i class="ph-light ph-arrows-out"></i></button
    >

    <div class="h-4 w-px bg-base-300 mx-1"></div>

    <!-- <div class="flex items-center gap-1 px-2">
      <button class="hover:text-primary transition-colors" onclick={() => (zoomLevel -= 10)}
        ><i class="ph-light ph-minus-circle"></i></button
      >
      <span class="text-[10px] font-mono w-8 text-center">{zoomLevel}%</span>
      <button class="hover:text-primary transition-colors" onclick={() => (zoomLevel += 10)}
        ><i class="ph-light ph-plus-circle"></i></button
      >
    </div> -->
  </div>

  <!-- <div class="flex items-center gap-2">
    <div class="flex items-center gap-3 text-[10px] font-medium opacity-40 px-2">
      <span class="flex items-center gap-1"><i class="ph-light ph-text-aa"></i> {$_('1,240 Words')}</span>
      <span class="flex items-center gap-1"><i class="ph-light ph-clock"></i> {$_('5 min read')}</span>
    </div>

    <button
      class="btn btn-xs btn-primary rounded-[4px] font-black text-[9px] tracking-widest h-6 uppercase"
    >
      {$_('Publish')}
    </button>
  </div> -->
</div>

<style>
  .theme-util-btn {
    @apply flex items-center px-2 py-1 rounded-[4px] hover:bg-[var(--color-base-300)] text-[11px] font-medium transition-all;
  }
  .theme-util-btn-icon {
    @apply p-1.5 rounded-[4px] hover:bg-[var(--color-base-300)] text-[16px] transition-all opacity-60 hover:opacity-100;
  }

  .utility-mode-icon {
    display: none;
  }

  @media (max-width: 1180px) {
    .utility-mode-label,
    .utility-page-label,
    .label-text {
      display: none;
    }

    .utility-mode-icon {
      display: inline-block;
      font-size: 0.9rem;
    }

    .status-label {
      padding-left: 0.3rem;
      padding-right: 0.3rem;
    }
  }

  @media (max-width: 1060px) {
    .collab-pill,
    .utility-bar > div:last-of-type > .theme-util-btn-icon,
    .utility-bar > div:last-of-type > .h-4 {
      display: none;
    }
  }

  .collab-pill {
    @apply flex items-center gap-2 px-2 py-1 rounded-full border border-[var(--color-base-300)]/60 bg-[color-mix(in_srgb,var(--color-base-100)_40%,transparent)] backdrop-blur;
  }

  .avatar-stack {
    @apply flex items-center;
  }

  .avatar {
    @apply h-6 w-6 rounded-full border border-[var(--color-base-200)]/60 flex items-center justify-center text-[9px] font-semibold text-[var(--color-base-content)] shadow-sm;
    margin-left: -6px;
    overflow: hidden;
  }

  .avatar:first-child {
    margin-left: 0;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-empty {
    @apply bg-[var(--color-base-300)] text-[var(--color-base-content)]/70;
  }

  .avatar-count {
    @apply bg-[var(--color-base-300)] text-[var(--color-base-content)]/70;
  }

  .status-label {
    @apply flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.1em] bg-[color-mix(in_srgb,var(--color-base-300)_70%,transparent)] text-[var(--color-base-content)]/70;
  }

  .dot {
    @apply h-2 w-2 rounded-full;
  }

  .dot-live {
    background: #22c55e;
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.7);
    /* animation: pulse 1.8s infinite; */
  }

  .dot-offline {
    background: #94a3b8;
  }

  .dot-warn {
    background: #f59e0b;
    box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 0.85;
    }
    70% {
      transform: scale(1.4);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 0;
    }
  }

  /* Precision font tracking */
  span {
    letter-spacing: -0.01em;
  }
</style>
