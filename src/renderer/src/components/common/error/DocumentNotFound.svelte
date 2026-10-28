<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  // Using Phosphor Icons as requested
  // Props for customization
  let {
    docName = 'Untitled_Draft.ddoc',
    onRetry = () => {},
    onGoBack = () => {},
    onSearch = () => {},
    onCreateNew = () => {},
    showCreateNew = false
  } = $props()

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onGoBack()
      return
    }
    if (event.key === 'F5') {
      event.preventDefault()
      onRetry()
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
      event.preventDefault()
      onRetry()
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault()
      onSearch()
      return
    }
    if (showCreateNew && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
      event.preventDefault()
      onCreateNew()
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
</script>

<div class="empty-state-canvas">
  <div class="adobe-card-container">
    <div class="card-header">
      <div class="flex items-center gap-2">
        <i class="ph-light ph-warning-octagon text-ddoc-orange text-[16px]"></i>
        <span class="technical-label">{$_('Notice')}</span>
      </div>
    </div>

    <div class="p-10 flex flex-col items-center text-center">
      <div class="relative mb-8">
        <div class="absolute -inset-4 bg-ddoc-primary/5 blur-2xl rd-full"></div>
        <div
          class="relative size-80px flex items-center justify-center rd-[12px] bg-base-content/5 border border-white/5 shadow-inner"
        >
          <i class="ph-light ph-file-search text-[42px] text-ddoc-primary"></i>
          <div
            class="absolute -bottom-1 -right-1 size-24px bg-base-100 rd-full flex items-center justify-center border border-white/10"
          >
            <i class="ph-bold ph-x text-ddoc-orange text-[10px]"></i>
          </div>
        </div>
      </div>

      <h2 class="text-[20px] font-700 text-base-content mb-2 tracking-tight">
        {$_("We couldn't find this document")}
      </h2>
      <p class="max-w-[320px] text-[13px] text-base-content/40 leading-relaxed mb-8">
        <span class="block text-base-content/80 font-600 mb-2">"{docName}"</span>
        {$_(
          'Nothing by this name is in your account. It may belong to a different account, or have been moved or removed. Your other work is unaffected.'
        )}
      </p>

      <div class="flex flex-col w-full gap-2">
        <button onclick={onRetry} class="primary-action-btn">
          <i class="ph-bold ph-arrows-clockwise text-[14px]"></i>
          <span>{$_('Locate File')}</span>
        </button>

        <div class="flex gap-2 w-full">
          <button onclick={onGoBack} class="secondary-tool-btn flex-1">
            <i class="ph-light ph-arrow-left text-[14px]"></i>
            <span>{$_('Go Back')}</span>
          </button>
          <button class="secondary-tool-btn flex-1" onclick={onSearch}>
            <i class="ph-light ph-magnifying-glass text-[14px]"></i>
            <span>{$_('Search Drive')}</span>
          </button>
        </div>
        {#if showCreateNew}
          <button onclick={onCreateNew} class="secondary-tool-btn w-full">
            <i class="ph-light ph-file-plus text-[14px]"></i>
            <span>{$_('Create New Document')}</span>
          </button>
        {/if}
      </div>
    </div>

    <div class="card-footer">
      <div class="flex items-center gap-4">
        <button type="button" class="footer-action" onclick={onGoBack}>
          <kbd class="adobe-kbd">{$_('Esc')}</kbd>
          {$_('Dismiss')}
        </button>
        <div class="size-3px rd-full bg-base-content/10"></div>
        <button type="button" class="footer-action" onclick={onRetry}>
          <kbd class="adobe-kbd">{$_('F5')}</kbd>
          {$_('Reload')}
        </button>
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  .empty-state-canvas {
    @apply w-full h-full flex items-center justify-center p-6 font-sans select-none;
    background: linear-gradient(180deg, var(--theme-surface-2), var(--root-bg));
  }

  .adobe-card-container {
    @apply w-full max-w-[440px] rd-[8px] border border-white/10 overflow-hidden;
    background: var(--theme-popover-bg);
    box-shadow: var(--theme-popover-shadow);
  }

  .card-header {
    @apply flex items-center justify-between px-4 py-3 bg-[var(--color-base-100)]/8 border-b border-white/5;
  }

  .technical-label {
    @apply text-[10px] font-900 uppercase tracking-[0.15em] text-[var(--color-base-content)]/40;
  }

  .primary-action-btn {
    @apply flex items-center justify-center gap-2.5 w-full py-3 bg-[var(--color-base-300)] 
           text-black text-[12px] font-700 uppercase tracking-widest rd-[4px] transition-all
           hover:(bg-[#009D8E] shadow-[0_0_20px_rgba(0,190,172,0.3)]) active:scale-[0.98];
  }

  .secondary-tool-btn {
    @apply flex items-center justify-center gap-2 py-2.5 bg-[var(--color-base-100)]/5 border border-white/5
           text-[var(--color-base-content)]/70 text-[11px] font-600 rd-[4px] transition-all
           hover:(bg-[var(--color-base-100)]/10 text-[var(--color-base-content)] border-white/10) active:scale-[0.98];
  }

  .card-footer {
    @apply flex items-center justify-between px-4 py-3 bg-[var(--color-base-100)]/6 border-t border-white/5
           text-[9px] font-800 uppercase tracking-widest text-[var(--color-base-content)]/30;
  }

  .footer-action {
    @apply flex items-center gap-1.5 cursor-pointer text-[9px] font-800 uppercase tracking-widest
           text-[var(--color-base-content)]/30 transition-colors
           hover:text-[var(--color-base-content)]/60;
  }

  .adobe-kbd {
    @apply px-1.5 py-0.5 rd-[3px] bg-[var(--color-base-100)]/5 border border-white/10 text-[var(--color-base-content)]/40 font-mono;
  }
</style>
