<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { _$_addFilesToDocumentModal } from '../../../stores/addFilesToDocumentModal.store'
  import { nodeApi } from '../../../utils/shims/node'
  import { onMount } from 'svelte'
  import TreeView from '../react/treeView/TreeView.svelte'

  const modal = _$_addFilesToDocumentModal

  const documentRootPath = $derived($modal.documentRootPath || '')
  const documentParentPath = $derived($modal.documentParentPath || '')
  const maxWidth = $derived($modal.maxWidth || 980)
  const maxHeight = $derived($modal.maxHeight || 680)

  // ─── state ────────────────────────────────────────────────────────────────
  /** Paths of files currently selected in the TreeView (files only, no folders) */
  let selectedPaths = $state<string[]>([])
  let searchQuery = $state('')
  let sortBy = $state<'name' | 'type' | 'date'>('name')

  /** Keys used to trigger inline create inside TreeView */
  let createFileKey = $state(0)
  let createFolderKey = $state(0)

  // ─── selection callback from TreeView ─────────────────────────────────────
  function handleSelectionChange(items: { path: string; isFolder: boolean }[]) {
    // Only count files (not folders) as selection
    selectedPaths = items.filter((item) => !item.isFolder).map((item) => item.path)
  }

  // ─── confirm / cancel ─────────────────────────────────────────────────────
  function handleConfirm() {
    modal.confirm(selectedPaths)
  }

  function handleCancel() {
    modal.cancel()
  }

  // ─── toolbar actions ───────────────────────────────────────────────────────
  function requestNewFile() {
    createFileKey = Date.now()
  }

  function requestNewFolder() {
    createFolderKey = Date.now()
  }

  // ─── keyboard shortcuts ───────────────────────────────────────────────────
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleCancel()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleConfirm()
  }

  // ─── lifecycle ────────────────────────────────────────────────────────────
  $effect(() => {
    if ($modal.open) {
      selectedPaths = []
      searchQuery = ''
    }
  })

  onMount(() => {
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  })
</script>

{#if $modal.open}
  <!-- backdrop -->
  <div
    class="afdm-backdrop"
    onclick={handleCancel}
    role="dialog"
    aria-modal="true"
    aria-label={$_('Add files to document')}
  >
    <!-- panel -->
    <div
      class="afdm-panel"
      style="max-width:{maxWidth}px; max-height:{maxHeight}px;"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- ─── header ─────────────────────────────────────────── -->
      <div class="afdm-header">
        <div class="afdm-header-left">
          <i class="ph-light ph-folder-plus afdm-header-icon"></i>
          <div>
            <div class="afdm-title">{$_('Add Files to Document')}</div>
            <div class="afdm-subtitle">
              {documentRootPath ? documentRootPath : $_('No document open')}
            </div>
          </div>
        </div>
        <button class="afdm-close-btn" onclick={handleCancel} title={$_('Close')}>
          <i class="ph-bold ph-x"></i>
        </button>
      </div>

      <!-- ─── toolbar ───────────────────────────────────────── -->
      <div class="afdm-toolbar">
        <div class="afdm-search">
          <i class="ph-light ph-magnifying-glass afdm-search-icon"></i>
          <input
            class="afdm-search-input"
            placeholder={$_('Search files…')}
            bind:value={searchQuery}
          />
          {#if searchQuery}
            <button class="afdm-search-clear" onclick={() => (searchQuery = '')}>
              <i class="ph-bold ph-x"></i>
            </button>
          {/if}
        </div>

        <div class="afdm-toolbar-actions">
          <!-- New file in root -->
          <button
            class="afdm-btn afdm-btn-ghost"
            onclick={requestNewFile}
            title={$_('New file')}
            disabled={!documentRootPath}
          >
            <i class="ph-light ph-file-plus"></i>
            <span>{$_('New file')}</span>
          </button>
          <!-- New folder in root -->
          <button
            class="afdm-btn afdm-btn-ghost"
            onclick={requestNewFolder}
            title={$_('New folder')}
            disabled={!documentRootPath}
          >
            <i class="ph-light ph-folder-plus"></i>
            <span>{$_('New folder')}</span>
          </button>
          <!-- Sort (visual label only — TreeView sorts by name by default) -->
          <select class="afdm-select" bind:value={sortBy} title={$_('Sort by')}>
            <option value="name">{$_('Name')}</option>
            <option value="type">{$_('Type')}</option>
            <option value="date">{$_('Date')}</option>
          </select>
        </div>
      </div>

      <!-- ─── selection pill ────────────────────────────────── -->
      {#if selectedPaths.length > 0}
        <div class="afdm-selection-bar">
          <i class="ph-light ph-check-circle"></i>
          <span>
            {selectedPaths.length}
            {selectedPaths.length === 1 ? $_('file selected') : $_('files selected')}
          </span>
          <button class="afdm-selection-clear" onclick={() => (selectedPaths = [])}>
            {$_('Clear')}
          </button>
        </div>
      {/if}

      <!-- ─── body ──────────────────────────────────────────── -->
      <div class="afdm-body">
        {#if !documentRootPath}
          <div class="afdm-empty">
            <i class="ph-light ph-folder-dashed-open afdm-empty-icon"></i>
            <p>{$_('No document root path. Please open a document first.')}</p>
          </div>
        {:else}
          <!--
            TreeView handles:
            - Lazy directory loading & expand/collapse
            - Inline rename (F2 / pencil action)
            - Inline file/folder creation (triggered by createFileKey/createFolderKey)
            - Delete (Del key / trash action)
            - Drag-and-drop move
            - Multi-select (Ctrl/Cmd+Click, Shift+Click) with checkboxes
            - Keyboard shortcuts (Ctrl+A, Ctrl+C/X/V, Del, etc.)
          -->
          <div class="afdm-tree-wrapper">
            <TreeView
              __rootPath={documentRootPath}
              __rootParentPath={documentParentPath}
              __searchQuery={searchQuery}
              __selectionMode="multi"
              __openOnSelect={false}
              __enforceDocumentExtension={true}
              __capabilities={{
                canCreate: true,
                canRename: true,
                canCopyCutPaste: true,
                canDuplicate: false,
                canDelete: true,
                canDragDrop: true,
                canOpenInTerminal: false,
                canRevealInOS: false,
                canVersioning: false,
                canSecurity: false,
                canTranslation: false,
                canVariables: false
              }}
              __requestCreateFileKey={createFileKey}
              __requestCreateFileParentPath={documentRootPath}
              __requestCreateFolderKey={createFolderKey}
              __requestCreateFolderParentPath={documentRootPath}
              __onSelectionChange={handleSelectionChange}
            />
          </div>
        {/if}
      </div>

      <!-- ─── footer ────────────────────────────────────────── -->
      <div class="afdm-footer">
        <div class="afdm-footer-left">
          {#if selectedPaths.length > 0}
            <div class="afdm-selected-files">
              {#each selectedPaths.slice(0, 3) as p}
                <span class="afdm-selected-chip">
                  <i class="ph-light ph-file"></i>
                  {nodeApi.path?.basename(p) ?? p}
                  <button
                    onclick={() => {
                      selectedPaths = selectedPaths.filter((x) => x !== p)
                    }}
                  >
                    <i class="ph-bold ph-x"></i>
                  </button>
                </span>
              {/each}
              {#if selectedPaths.length > 3}
                <span class="afdm-selected-more">+{selectedPaths.length - 3} {$_('more')}</span>
              {/if}
            </div>
          {:else}
            <span class="afdm-hint">
              <i class="ph-light ph-info"></i>
              {$_(
                'Click files to select · Ctrl+Click to multi-select · Shift+Click to range-select'
              )}
            </span>
          {/if}
        </div>
        <div class="afdm-footer-right">
          <button class="afdm-btn afdm-btn-ghost" onclick={handleCancel}>
            {$_('Cancel')}
          </button>
          <button
            class="afdm-btn afdm-btn-primary"
            disabled={selectedPaths.length === 0}
            onclick={handleConfirm}
          >
            <i class="ph-light ph-check-circle"></i>
            {selectedPaths.length > 0
              ? `${$_('Open')} ${selectedPaths.length} ${selectedPaths.length === 1 ? $_('file') : $_('files')}`
              : $_('Select files')}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  /* ── Keyframes ────────────────────────────────────────────────── */
  @keyframes afdm-fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes afdm-slide-in {
    from {
      transform: scale(0.96) translateY(12px);
      opacity: 0;
    }
    to {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
  }

  /* ── Backdrop ─────────────────────────────────────────────────── */
  .afdm-backdrop {
    @apply fixed inset-0 z-[12000] backdrop-blur-md flex items-center justify-center p-4;
    background: var(--theme-backdrop-strong);
    animation: afdm-fade-in 0.15s ease;
  }

  /* ── Panel ────────────────────────────────────────────────────── */
  .afdm-panel {
    @apply flex flex-col rd-[8px] overflow-hidden;
    width: min(980px, 96vw);
    height: min(680px, 92vh);
    background: var(--theme-surface-1);
    border: 1px solid var(--theme-border-subtle);
    box-shadow: var(--theme-popover-shadow);
    animation: afdm-slide-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* ── Header ───────────────────────────────────────────────────── */
  .afdm-header {
    @apply flex items-center justify-between px-6 py-4 bg-black/20 border-b border-white/5 shrink-0;
  }

  .afdm-header-left {
    @apply flex items-center gap-3;
  }

  .afdm-header-icon {
    @apply size-9 flex items-center justify-center bg-black/40 border border-white/5 rd-[4px] text-[18px];
    color: var(--color-base-300);
  }

  .afdm-title {
    @apply text-[14px] font-700 text-[var(--color-base-content)]/90 tracking-tight;
  }

  .afdm-subtitle {
    @apply text-[9px] font-900 tracking-[0.2em] uppercase mt-0.5 max-w-[400px] overflow-hidden text-ellipsis whitespace-nowrap;
    color: var(--color-base-content);
    opacity: 0.4;
    direction: rtl;
    text-align: left;
  }

  .afdm-close-btn {
    @apply size-7 flex items-center justify-center rd-[4px] bg-transparent border-none cursor-pointer transition-colors text-[14px];
    color: var(--color-base-content);
    opacity: 0.3;

    &:hover {
      @apply bg-white/5;
      opacity: 0.9;
    }
  }

  /* ── Toolbar ──────────────────────────────────────────────────── */
  .afdm-toolbar {
    @apply flex items-center gap-2 px-4 py-3 shrink-0 flex-wrap bg-black/10;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .afdm-search {
    @apply relative flex-1 min-w-[160px];
  }

  .afdm-search-icon {
    @apply absolute left-[10px] top-1/2 -translate-y-1/2 text-[12px] pointer-events-none;
    color: var(--color-base-content);
    opacity: 0.3;
  }

  .afdm-search-input {
    @apply w-full h-[32px] pl-[32px] pr-8 rd-[4px] text-[11px] outline-none transition-all font-mono;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: var(--color-base-content);

    &:focus {
      border-color: var(--color-base-300);
      background: rgba(0, 0, 0, 0.5);
    }
  }

  .afdm-search-clear {
    @apply absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[10px] p-0.5 flex items-center transition-colors;
    color: var(--color-base-content);
    opacity: 0.4;

    &:hover {
      opacity: 0.8;
    }
  }

  .afdm-toolbar-actions {
    @apply flex items-center gap-1.5;
  }

  .afdm-select {
    @apply h-[32px] px-2.5 rd-[4px] text-[10px] font-800 uppercase tracking-wider cursor-pointer outline-none transition-all;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: var(--color-base-content);
    opacity: 0.8;

    &:focus {
      border-color: var(--color-base-300);
    }
  }

  /* ── Buttons ──────────────────────────────────────────────────── */
  .afdm-btn {
    @apply inline-flex items-center gap-2 px-4 h-[32px] rd-[4px] text-[10px] font-800 uppercase tracking-widest cursor-pointer border-none transition-all whitespace-nowrap;
  }

  .afdm-btn-primary {
    background: var(--color-base-300);
    color: black;

    &:hover:not(:disabled) {
      background: #00d9c5;
    }

    &:disabled {
      @apply opacity-20 grayscale cursor-not-allowed;
    }
  }

  .afdm-btn-ghost {
    @apply border border-white/5;
    background: rgba(255, 255, 255, 0.03);
    color: var(--color-base-content);
    opacity: 0.5;

    &:hover:not(:disabled) {
      @apply border-white/10;
      background: rgba(255, 255, 255, 0.06);
      opacity: 0.9;
    }

    &:disabled {
      @apply opacity-20 cursor-not-allowed;
    }
  }

  /* ── Selection Bar ────────────────────────────────────────────── */
  .afdm-selection-bar {
    @apply flex items-center gap-2 px-4 py-2 text-[10px] font-800 uppercase tracking-wider shrink-0;
    background: rgba(0, 217, 197, 0.08);
    border-bottom: 1px solid rgba(0, 217, 197, 0.15);
    color: #00d9c5;
  }

  .afdm-selection-clear {
    @apply ml-auto bg-none border-none text-[9px] font-900 tracking-widest cursor-pointer underline uppercase;
    color: var(--color-base-content);
    opacity: 0.5;

    &:hover {
      opacity: 0.9;
    }
  }

  /* ── Body & Tree ───────────────────────────────────────────────── */
  .afdm-body {
    @apply flex-1 overflow-hidden flex flex-col bg-black/10;
  }

  .afdm-tree-wrapper {
    @apply flex-1 overflow-hidden;
  }

  /* ── Empty State ──────────────────────────────────────────────── */
  .afdm-empty {
    @apply flex-1 flex flex-col items-center justify-center gap-4 text-center p-10;
    color: var(--color-base-content);
    opacity: 0.3;
  }

  .afdm-empty-icon {
    @apply text-[48px] opacity-25;
  }

  /* ── Footer ───────────────────────────────────────────────────── */
  .afdm-footer {
    @apply flex items-center justify-between gap-3 px-6 py-4 bg-black/20 border-t border-white/5 shrink-0 flex-wrap;
  }

  .afdm-footer-left {
    @apply flex items-center gap-2 flex-1 min-w-0 overflow-hidden;
  }

  .afdm-footer-right {
    @apply flex items-center gap-3 shrink-0;
  }

  .afdm-selected-files {
    @apply flex items-center gap-1.5 overflow-hidden;
  }

  .afdm-selected-chip {
    @apply inline-flex items-center gap-1.5 py-0.5 pr-2 pl-2.5 rd-full text-[9px] font-800 uppercase tracking-wider max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--color-base-content);

    & button {
      @apply bg-none border-none cursor-pointer p-0 flex items-center shrink-0 text-[8px] transition-colors;
      color: var(--color-base-content);
      opacity: 0.4;

      &:hover {
        opacity: 0.9;
      }
    }
  }

  .afdm-selected-more {
    @apply text-[10px] font-700;
    color: var(--color-base-content);
    opacity: 0.3;
  }

  .afdm-hint {
    @apply text-[10px] font-700 tracking-wide flex items-center gap-2 whitespace-nowrap overflow-hidden text-ellipsis;
    color: var(--color-base-content);
    opacity: 0.35;
  }
</style>
