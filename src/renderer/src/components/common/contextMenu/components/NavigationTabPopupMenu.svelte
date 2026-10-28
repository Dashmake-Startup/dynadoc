<script lang="ts">
  import { _ as base_ } from 'svelte-i18n'
  import type { NavigationTab } from '../../../../models/Tab'
  import { get } from 'svelte/store'
  import EditorCommonUtils from '../../../../utils/common.utils'
  import { nodeApi } from '../../../../utils/shims/node'
  import Platform from '../../../../libs/platform'

  const _ = base_
  const t = get(base_)

  //   const nodeApi =
  //     typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
  //   const fs = nodeApi?.fs
  //   const path = nodeApi?.path

  let {
    __tab = null,
    __onReveal,
    __onClose,
    __onPin,
    __onDuplicate
  } = $props<{
    __tab?: NavigationTab | null
    __onReveal?: () => void
    __onClose?: () => void
    __onPin?: () => void
    __onDuplicate?: () => void
  }>()

  const fileName = $derived.by(() => __tab?.title || t('Untitled'))
  const filePath = $derived.by(() => {
    const raw = __tab?.documentPath || ''
    if (!raw || !nodeApi.path) return '—'
    return raw.split(nodeApi.path.sep).join(' › ')
  })
  const lastSave = $derived.by(() => {
    const value = __tab?.lastAccessed
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString()
  })
  const statusChips = $derived.by(() => {
    const chips: string[] = []
    if (__tab?.isDirty) chips.push(t('Unsaved'))
    if (__tab?.isReadOnly) chips.push(t('Read-only'))
    if (__tab?.isSecured) chips.push(t('Protected'))
    if (__tab?.isLoading) chips.push(t('Loading'))
    return chips
  })

  function copyPath() {
    if (!__tab?.documentPath) return
    EditorCommonUtils.copyToClipboard(__tab.documentPath)
  }
</script>

<div class="adobe-inspector-popup bg-base-100 text-base-content">
  <header class="inspector-header">
    <div class="file-icon-wrapper">
      <i class="ph-fill ph-file-doc"></i>
      <!-- <i class="ph-fill ph-file-doc text-[#4285F4]"></i> -->
      {#if __tab?.isDirty}
        <div class="sync-indicator"></div>
      {/if}
    </div>
    <div class="file-info">
      <h3 class="filename truncate" title={fileName}>{fileName}</h3>
      <span class="file-extension">{__tab?.documentExtension?.replace('.', '') || 'DOC'}</span>
    </div>
  </header>

  {#if statusChips.length}
    <div class="status-row">
      {#each statusChips as chip}
        <span class="status-chip">{chip}</span>
      {/each}
    </div>
  {/if}

  <div class="inspector-body">
    <div class="meta-row group" onclick={copyPath} role="button" tabindex="0">
      <div class="meta-label">
        <i class="ph-bold ph-desktop"></i>
        <span>{$_('LOCAL_PATH')}</span>
      </div>
      <div class="meta-value font-mono">
        {filePath}
        <i class="ph-bold ph-copy opacity-0 group-hover:opacity-100 transition-opacity ml-1"></i>
      </div>
    </div>

    <div class="meta-row">
      <div class="meta-label">
        <i class="ph-bold ph-clock-counter-clockwise"></i>
        <span>{$_('LAST_MODIFIED')}</span>
      </div>
      <div class="meta-value tabular-nums">{lastSave}</div>
    </div>
  </div>

  <footer class="inspector-footer">
    {#if Platform.isDesktopPlatform}
      <button class="adobe-btn-primary" onclick={__onReveal}>
        <i class="ph-bold ph-folder-open"></i>
        <span>{$_('REVEAL_IN_FOLDER')}</span>
      </button>
    {/if}

    <div class="quick-actions">
      {#if Platform.isDesktopPlatform}
        <button class="icon-action" title={$_('Reveal in Finder/Explorer')} onclick={__onReveal}>
          <i class="ph-bold ph-folder-open"></i>
        </button>
      {/if}
      <button class="icon-action" title={$_('Pin tab')} onclick={__onPin}>
        <i class="ph-bold ph-push-pin"></i>
      </button>
      <button class="icon-action" title={$_('Duplicate tab')} onclick={__onDuplicate}>
        <i class="ph-bold ph-copy"></i>
      </button>
      <button class="icon-action" title={$_('Close tab')} onclick={__onClose}>
        <i class="ph-bold ph-x"></i>
      </button>
    </div>
  </footer>
</div>

<style lang="postcss">
  .adobe-inspector-popup {
    @apply w-[320px] border border-white/10 rd-[6px] overflow-hidden transition-all;
    background: var(--theme-popover-bg);
    box-shadow:
      inset 0 1px 0 rgba(var(--theme-text-rgb), 0.05),
      var(--theme-popover-shadow);
  }

  /* --- Header Section --- */
  .inspector-header {
    @apply flex items-center gap-3 p-4 bg-[var(--color-base-100)]/8 border-b border-white/5;
  }

  .file-icon-wrapper {
    @apply relative size-10 flex items-center justify-center bg-[var(--color-base-100)]/10 border border-white/5 rd-[4px] text-[20px];
  }

  .sync-indicator {
    @apply absolute -top-1 -right-1 size-2.5 bg-[var(--color-base-100)] rd-full border-2 border-[var(--color-base-100)];
  }

  .file-info {
    @apply flex-1 min-w-0;
  }
  .filename {
    @apply text-[13px] font-700 text-[var(--color-base-content)] tracking-tight leading-tight;
  }
  .file-extension {
    @apply text-[9px] font-900 text-[var(--color-base-content)] tracking-[0.15em] mt-0.5;
  }
  .status-row {
    @apply flex flex-wrap gap-1 px-4 pb-2;
  }
  .status-chip {
    @apply text-[8px] uppercase tracking-widest font-900 px-2 py-0.5 rounded-full
           bg-[var(--color-base-100)]/5 text-[color-mix(in_srgb,var(--color-base-content)_60%,transparent)] border border-white/10;
  }

  /* --- Body Section --- */
  .inspector-body {
    @apply p-3 flex flex-col gap-1;
  }

  .meta-row {
    @apply p-2 rd-[4px] transition-colors hover:bg-[var(--color-base-100)]/5 cursor-default outline-none;
  }

  .meta-label {
    @apply flex items-center gap-2 text-[9px] font-900 text-[color-mix(in_srgb,var(--color-base-content)_20%,transparent)] tracking-widest mb-1;
  }

  .meta-value {
    @apply text-[11px] text-[var(--color-base-content)] leading-relaxed break-all;
  }

  /* --- Footer Section --- */
  .inspector-footer {
    @apply p-3 bg-[var(--color-base-100)]/6 border-t border-white/5 flex flex-col gap-2;
  }

  .adobe-btn-primary {
    @apply w-full h-9 flex items-center justify-center gap-2 bg-[var(--color-base-300)] text-[var(--color-elevated-text)]
           font-900 text-[10px] uppercase tracking-widest rd-[3px] 
           hover:bg-[var(--color-base-300)] active:scale-[0.98] transition-all;
  }

  .quick-actions {
    @apply flex items-center justify-between border-t border-white/5 pt-2 mt-1;
  }

  .icon-action {
    @apply size-8 flex items-center justify-center text-[var(--color-base-content)] rd-[4px]
           hover:(bg-[var(--color-base-100)]/5 text-[var(--color-base-content)]) transition-all;
  }
</style>
