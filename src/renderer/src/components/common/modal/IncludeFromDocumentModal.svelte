<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { v4 as uuidv4 } from 'uuid'
  import TreeView from '../react/treeView/TreeView.svelte'
  import PreviewEditor from '../../app/editor/preview/PreviewEditor.svelte'
  import { _$_documentEditorsList } from '../../../stores/editor.store'
  import {
    _$_includeFromDocumentModal,
    type IncludeFromDocumentMode
  } from '../../../stores/includeFromDocumentModal.store'
  import WysiwygEditor from '../../app/editor/wysiwyg/WysiwygEditor.svelte'
  import { nodeApi } from '../../../utils/shims/node'

  // const nodeApi =
  //   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
  // const fs = nodeApi?.fs
  // const path = nodeApi?.path

  const modal = _$_includeFromDocumentModal
  const activeEditorStore = _$_documentEditorsList.getActive()

  let selectedPath = $state('')
  let selectedIsFolder = $state(false)
  let includeMode = $state<IncludeFromDocumentMode>('include')
  let searchQuery = $state('')
  let previewId = $state(uuidv4())

  // --- Logic Fixes ---
  const activeEditor = $derived($activeEditorStore)
  const activeDocument = $derived(activeEditor?.document || null)

  const rootPath = $derived(
    activeDocument?.cachePath ||
      (activeDocument?.path ? nodeApi.path.dirname(activeDocument.path) : '')
  )
  const rootParentPath = $derived(activeDocument?.path || '')

  // Fixed fileStats: Simplified derived state for reactive FS calls
  const stats = $derived.by(() => {
    if (!selectedPath || selectedIsFolder) return null
    try {
      return nodeApi.fs.statSync(selectedPath)
    } catch {
      return null
    }
  })

  const canSelect = $derived(Boolean(selectedPath && !selectedIsFolder))

  $effect(() => {
    if (!$modal.open) return
    selectedPath = $modal.initialPath || ''
    includeMode = $modal.initialMode || 'include'
    selectedIsFolder = false
    previewId = uuidv4()
  })

  function formatBytes(bytes: number) {
    if (!bytes) return '0 B'
    const k = 1024,
      units = ['B', 'KB', 'MB', 'GB'],
      i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i]
  }

  function handleTreeSelect(item: { path: string; isFolder: boolean }) {
    selectedPath = item.path
    selectedIsFolder = item.isFolder
    previewId = uuidv4()
  }

  const confirm = () => canSelect && modal.confirm({ path: selectedPath, mode: includeMode })
</script>

{#if $modal.open}
  <div class="adobe-backdrop" onclick={() => modal.cancel()}>
    <div class="adobe-panel include-orchestrator" onclick={(e) => e.stopPropagation()}>
      <header class="adobe-header">
        <div class="flex items-center gap-4">
          <div class="header-glyph">
            <i class="ph-duotone ph-file-arrow-down text-[18px] text-base-300"></i>
          </div>
          <div class="flex flex-col">
            <span class="eyebrow">{$_('Add from Document')}</span>
            <h2 class="title">{$_('Choose a File to add')}</h2>
          </div>
        </div>
        <button class="close-btn" onclick={() => modal.cancel()}
          ><i class="ph-light ph-x"></i></button
        >
      </header>

      <div class="adobe-body">
        <aside class="left-pane">
          <div class="tool-section">
            <div class="adobe-search-box">
              <i class="ph-light ph-magnifying-glass"></i>
              <input
                type="text"
                placeholder={$_('FILTER_SOURCE_FILES...')}
                bind:value={searchQuery}
              />
            </div>

            <div class="adobe-segmented-control">
              <button
                class:active={includeMode === 'include'}
                onclick={() => (includeMode = 'include')}
              >
                <i class="ph-bold ph-link"></i>
                {$_('Sync')}
              </button>
              <button
                class:active={includeMode === 'append'}
                onclick={() => (includeMode = 'append')}
              >
                <i class="ph-bold ph-copy"></i>
                {$_('Static')}
              </button>
            </div>
          </div>

          <div class="tree-viewport no-scrollbar">
            <TreeView
              __rootPath={rootPath}
              __rootParentPath={rootParentPath}
              __searchQuery={searchQuery}
              __capabilities={{ canCreate: false, canDelete: false, canDragDrop: false }}
              __openOnSelect={false}
              __onSelect={handleTreeSelect}
            />
          </div>
        </aside>

        <main class="right-pane">
          {#if !selectedPath || selectedIsFolder}
            <div class="adobe-placeholder">
              <div class="placeholder-icon">
                <i class="ph-duotone ph-file-search"></i>
              </div>
              <p>
                {selectedIsFolder
                  ? $_('Select a file, not a folder.')
                  : $_('Select a source asset to preview.')}
              </p>
            </div>
          {:else}
            <div class="preview-header">
              <div class="flex-1 min-w-0">
                <div class="eyebrow">{$_('SOURCE_PATH')}</div>
                <div class="path-string truncate">{selectedPath}</div>
              </div>
              <div class="v-sep"></div>
              <div class="meta-block">
                <div class="eyebrow">{$_('FILE_SIZE')}</div>
                <div class="meta-val">{formatBytes(stats?.size || 0)}</div>
              </div>
              <div class="v-sep"></div>
              <div class="meta-block">
                <div class="eyebrow">{$_('LAST_MODIFIED')}</div>
                <div class="meta-val">
                  {stats?.mtime ? new Date(stats.mtime).toLocaleTimeString() : '--:--'}
                </div>
              </div>
            </div>

            <div class="preview-viewport">
              <PreviewEditor
                __previewEditorId={previewId}
                __documentToOpen={activeDocument}
                __filePathToOpenFromDocument={selectedPath}
                __parentContainerKey={previewId}
              />
            </div>
          {/if}
        </main>
      </div>

      <footer class="adobe-footer">
        <div class="sync-status">
          <div class="pulse-dot" class:is-sync={includeMode === 'include'}></div>
          <span class="text-[9px] font-900 tracking-widest text-base-content/30 uppercase">
            Mode: {includeMode === 'include' ? 'Dynamic Link (Live)' : 'Static Import (Snapshot)'}
          </span>
        </div>

        <div class="flex gap-2">
          <button class="adobe-btn-secondary" onclick={() => modal.cancel()}>{$_('Cancel')}</button>
          <button class="adobe-btn-primary" onclick={confirm} disabled={!canSelect}>
            <span>{includeMode === 'include' ? 'ESTABLISH LINK' : 'IMPORT CONTENT'}</span>
            <i class="ph-bold ph-caret-right"></i>
          </button>
        </div>
      </footer>
    </div>
  </div>
{/if}

<style lang="postcss">
  .adobe-panel {
    @apply w-full h-full max-w-[1080px] rd-[8px] flex flex-col overflow-auto;
    background: var(--theme-surface-1);
    border: 1px solid var(--theme-border-subtle);
    box-shadow: var(--theme-popover-shadow);
  }
  /* .adobe-panel {
    @apply fixed inset-[50% auto auto 50%] -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[720px] 
           bg-[#1e1e1e] border border-white/10 rd-[6px] shadow-[0_40px_100px_rgba(0,0,0,0.7)]
           flex flex-col overflow-hidden z-[60];
  } */

  .adobe-backdrop {
    @apply fixed inset-0 z-[12000] backdrop-blur-md flex items-center justify-center p-4;
    background: var(--theme-backdrop-strong);
    /* @apply fixed inset-0 bg-black/70 backdrop-blur-sm z-50; */
  }

  /* --- Header --- */
  .adobe-header {
    @apply flex items-center justify-between px-6 py-4 bg-black/20 border-b border-white/5;
  }
  .header-glyph {
    @apply size-10 flex items-center justify-center bg-black/40 border border-white/5 rd-[4px];
  }
  .eyebrow {
    @apply text-[9px] font-900 tracking-[0.2em] text-[var(--color-base-300)] uppercase;
  }
  .title {
    @apply text-[18px] font-700 text-[var(--color-base-content)]/90 tracking-tight;
  }
  .close-btn {
    @apply text-[var(--color-base-content)]/20 hover:text-[var(--color-base-content)] transition-colors;
  }

  /* --- Body Grid --- */
  .adobe-body {
    @apply flex-1 grid grid-cols-[320px_1fr] overflow-auto;
  }

  .left-pane {
    @apply border-r border-white/5 flex flex-col bg-black/5;
  }
  .right-pane {
    @apply flex flex-col p-4 bg-[var(--color-base-200)] overflow-auto;
  }

  /* --- Segmented Controls (Adobe Signature) --- */
  .adobe-segmented-control {
    @apply flex bg-black/40 p-1 rd-[4px] border border-white/5 mt-3;
  }
  .adobe-segmented-control button {
    @apply flex-1 flex items-center justify-center gap-2 py-1.5 text-[10px] 
           font-800 uppercase tracking-widest text-[var(--color-base-content)]/30 transition-all;
  }
  .adobe-segmented-control button.active {
    @apply bg-[var(--color-base-200)] text-[var(--color-base-content)] rd-[3px] shadow-xl;
  }

  /* --- Search & Inputs --- */
  .tool-section {
    @apply p-4 border-b border-white/5;
  }
  .adobe-search-box {
    @apply flex items-center gap-3 bg-black/40 border border-white/5 px-3 py-2 rd-[4px];
  }
  .adobe-search-box input {
    @apply bg-transparent outline-none text-[11px] text-[var(--color-base-content)]/80 w-full font-mono;
  }

  .tree-viewport {
    @apply flex-1 overflow-y-auto p-2;
  }

  /* --- Preview Area --- */
  .preview-header {
    @apply flex items-center gap-4 bg-[color-mix(in_srgb,var(--color-base-white)_3%,transparent)] border border-white/5 p-4 rd-[4px] mb-4;
  }
  .path-string {
    @apply text-[12px] font-600 text-[var(--color-base-content)]/90 mt-1;
  }

  @media (max-width: 1024px) {
    .adobe-panel {
      width: min(92vw, 900px);
      height: min(82vh, 680px);
    }
    .adobe-body {
      grid-template-columns: 280px 1fr;
    }
  }

  @media (max-width: 768px) {
    .adobe-panel {
      inset: auto 0 0 0;
      transform: none;
      width: 100%;
      height: 90vh;
      border-radius: 18px 18px 0 0;
    }
    .adobe-header {
      padding: 16px;
    }
    .adobe-body {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 1fr;
    }
    .left-pane {
      border-right: 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .right-pane {
      padding: 12px;
    }
  }
  .meta-val {
    @apply text-[11px] font-700 text-[var(--color-base-content)]/60 mt-0.5 tabular-nums;
  }
  .v-sep {
    @apply w-px h-6 bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)];
  }

  .preview-viewport {
    @apply flex-1 bg-black/40 border border-white/5 rd-[4px] overflow-auto;
  }

  /* --- Footer & Actions --- */
  .adobe-footer {
    @apply px-6 py-4 bg-black/20 border-t border-white/5 flex items-center justify-between;
  }

  .adobe-btn-primary {
    @apply flex items-center gap-3 px-6 py-2 bg-[var(--color-base-300)] text-black font-900 
           text-[10px] uppercase tracking-widest rd-[3px] hover:bg-[#00D9C5] 
           disabled:opacity-20 disabled:grayscale transition-all;
  }

  .adobe-btn-secondary {
    @apply px-4 py-2 text-[10px] font-800 uppercase tracking-widest text-[var(--color-base-content)]/40 hover:text-[var(--color-base-content)];
  }

  .pulse-dot {
    @apply size-2 rd-full bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] transition-colors;
  }
  .pulse-dot.is-sync {
    @apply bg-[var(--color-base-300)];
  }
  .sync-status {
    @apply flex items-center gap-3;
  }

  .adobe-placeholder {
    @apply flex-1 flex flex-col items-center justify-center text-[var(--color-base-content)]/20 text-center gap-4;
  }
  .placeholder-icon {
    @apply text-[48px] opacity-20;
  }
</style>
