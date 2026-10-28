<script lang="ts">
  /**
   * InternalLinkPreview.svelte
   *
   * Rich hover-preview popup for internal wiki links.
   * Mounted once at the workspace layout root — never re-mounted per link.
   * Reads from `internalLinkStore` (reactive Svelte 5 class state).
   *
   * Design: Adobe Spectrum dark + Phosphor icons.
   */
  import { fly } from 'svelte/transition'
  import { internalLinkStore } from '../stores/internalLink.store.svelte'
  import { v4 as uuidv4 } from 'uuid'
  import PreviewEditor from '../../../../components/app/editor/preview/PreviewEditor.svelte'
  import { _$_documentEditorsList } from '../../../../stores/editor.store'
  import { nodeApi } from '../../../../utils/shims/node'

  const activeEditorStore = _$_documentEditorsList.getActive()
  const activeEditor = $derived($activeEditorStore)
  const activeDocument = $derived(activeEditor?.document || null)

  let lastFileId = $state<string | null>(null)
  let previewId = $state(uuidv4())

  $effect(() => {
    const currentFileId = internalLinkStore.fileId
    if (currentFileId !== lastFileId) {
      lastFileId = currentFileId
      previewId = uuidv4()
    }
  })

  function openFile() {
    const fid = internalLinkStore.fileId
    if (!fid) return
    import('../../../../utils/common.utils').then(({ default: EditorCommonUtils }) => {
      EditorCommonUtils.openDocumentFromInput(fid)
    })
    internalLinkStore.visible = false
  }
</script>

{#if internalLinkStore.visible && internalLinkStore.fileId}
  {@const fileName = nodeApi.path?.basename(internalLinkStore.fileId) || 'Document'}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="ilp-root"
    style="left:{internalLinkStore.x}px; top:{internalLinkStore.y}px"
    onmouseenter={() => internalLinkStore.cancelHide()}
    onmouseleave={() => internalLinkStore.hide()}
    transition:fly={{ y: 8, duration: 180, opacity: 0 }}
    role="tooltip"
    aria-live="polite"
  >
    <div class="ilp-header">
      <div class="ilp-title-row">
        <i class="ph-light ph-file-text ilp-doc-icon"></i>
        <span class="ilp-title" title={fileName}>{fileName}</span>
      </div>
      <div class="ilp-path-row truncate" title={internalLinkStore.fileId}>
        {internalLinkStore.fileId}
      </div>
    </div>

    <div class="preview-viewport">
      <PreviewEditor
        __previewEditorId={previewId}
        __documentToOpen={activeDocument}
        __filePathToOpenFromDocument={internalLinkStore.fileId}
        __parentContainerKey={previewId}
      />
    </div>

    <div class="ilp-footer">
      <div class="ilp-shortcut-tips">
        <span><kbd>Click</kbd> open</span>
        <span><kbd>Alt</kbd>+<kbd>Click</kbd> open</span>
      </div>
      <div class="ilp-actions">
        <button class="ilp-btn ilp-btn-primary" onclick={openFile}>
          <i class="ph-light ph-arrow-square-out"></i>
          Open
        </button>
      </div>
    </div>

    <!-- Subtle top accent bar -->
    <div class="ilp-accent-bar"></div>
  </div>
{/if}

<style>
  /* ── Root popup container ────────────────────────────────────────────────── */
  .ilp-root {
    position: fixed;
    z-index: 10090;
    width: 480px;
    background: hsl(220 16% 12%);
    border: 1px solid hsl(220 12% 20%);
    border-radius: 10px;
    box-shadow:
      0 0 0 1px hsl(220 12% 8%),
      0 8px 24px hsl(220 30% 4% / 0.7),
      0 2px 6px hsl(220 20% 4% / 0.5);
    padding: 14px 14px 12px;
    color: hsl(220 10% 88%);
    pointer-events: auto;
    font-family: var(--brand-font-sans);
    font-size: 13px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* ── Accent bar ──────────────────────────────────────────────────────────── */
  .ilp-accent-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, hsl(220 90% 62%), hsl(267 80% 68%), hsl(220 90% 62%));
    background-size: 200% 100%;
    animation: shimmer 3s linear infinite;
    border-radius: 10px 10px 0 0;
  }

  @keyframes shimmer {
    0%   { background-position: 200% center; }
    100% { background-position: -200% center; }
  }

  /* ── Header ──────────────────────────────────────────────────────────────── */
  .ilp-header {
    display: flex;
    flex-direction: column;
  }

  .ilp-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }

  .ilp-doc-icon {
    font-size: 18px;
    color: hsl(220 80% 65%);
    flex-shrink: 0;
  }

  .ilp-title {
    flex: 1;
    font-weight: 700;
    font-size: 14px;
    color: hsl(220 10% 95%);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }

  .ilp-path-row {
    font-size: 11px;
    color: hsl(220 8% 55%);
  }

  /* ── Preview Viewport ────────────────────────────────────────────────────── */
  .preview-viewport {
    flex: 1;
    background-color: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    overflow: auto;
    height: 220px;
    max-height: 300px;
    display: flex;
    flex-direction: column;
  }

  /* ── Footer ──────────────────────────────────────────────────────────────── */
  .ilp-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid hsl(220 12% 16%);
    padding-top: 10px;
    gap: 8px;
  }

  .ilp-shortcut-tips {
    display: flex;
    gap: 10px;
    font-size: 9.5px;
    color: hsl(220 8% 40%);
  }

  kbd {
    background: hsl(220 12% 18%);
    border: 1px solid hsl(220 12% 24%);
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 9px;
    font-family: inherit;
    color: hsl(220 8% 60%);
  }

  .ilp-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ilp-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: none;
    border-radius: 5px;
    font-size: 11.5px;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
    white-space: nowrap;
  }

  .ilp-btn:active {
    transform: scale(0.96);
  }

  .ilp-btn-primary {
    background: hsl(220 90% 55%);
    color: white;
    padding: 5px 11px;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .ilp-btn-primary:hover {
    background: hsl(220 90% 62%);
  }
</style>