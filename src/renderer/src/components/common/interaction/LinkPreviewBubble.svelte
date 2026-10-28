<script lang="ts">
  import { onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { _$_linkPreview, closeLinkPreview } from '../../../stores/linkPreview.store'
  import EditorCommonUtils from '../../../utils/common.utils'

  const linkState = _$_linkPreview
  let bubbleEl: HTMLDivElement | null = null
  let showPreview = $state(false)

  const canPreview = $derived(() => {
    const href = $linkState?.href ?? ''
    return /^https?:\/\//i.test(href)
  })

  $effect(() => {
    if ($linkState.open) {
      showPreview = false
    }
  })

  const openExternal = async () => {
    const href = $linkState.href
    if (!href) return
    const api = (window as any).api
    if (api?.openExternal) {
      await api.openExternal(href)
    } else {
      window.open(href, '_blank')
    }
  }

  const copyLink = async () => {
    if (!$linkState.href) return
    try {
      await EditorCommonUtils.copyToClipboard($linkState.href)
    } catch {
      // no-op
    }
  }

  function onGlobalPointer(event: MouseEvent) {
    if (!bubbleEl) return
    if (event.target instanceof Node && bubbleEl.contains(event.target)) return
    closeLinkPreview()
  }

  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLinkPreview()
    }
    window.addEventListener('mousedown', onGlobalPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onGlobalPointer)
      window.removeEventListener('keydown', onKey)
    }
  })
</script>

{#if $linkState.open && $linkState.href}
  <div
    bind:this={bubbleEl}
    class="link-preview-bubble fixed z-[1300] max-w-[360px] rounded-lg border shadow-2xl backdrop-blur-lg text-base-content"
    style={`left: ${Math.max(12, Math.min($linkState.x, window.innerWidth - 380))}px; top: ${Math.max(12, Math.min($linkState.y, window.innerHeight - 320))}px;`}
  >
    <div class="px-3 py-2 border-b border-base-300/15 flex items-center justify-between gap-2">
      <div class="text-[11px] font-semibold tracking-wide">{$_('Link')}</div>
      <button
        class="text-[10px] uppercase tracking-[0.2em] text-base-content/60 hover:text-base-content"
        onclick={closeLinkPreview}
      >
        {$_('Close')}
      </button>
    </div>
    <div class="px-3 py-2 text-[12px] break-all text-primary">{ $linkState.href }</div>
    <div class="px-3 pb-2 flex items-center gap-2">
      <button
        class="rounded-md bg-primary/15 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-primary hover:bg-primary/20"
        onclick={openExternal}
      >
        {$_('Open')}
      </button>
      <button
        class="rounded-md bg-base-200 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-base-content/70 hover:bg-base-300/20"
        onclick={copyLink}
      >
        {$_('Copy')}
      </button>
      {#if canPreview}
        <button
          class="rounded-md bg-base-200 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-base-content/70 hover:bg-base-300/20"
          onclick={() => (showPreview = !showPreview)}
        >
          {showPreview ? $_('Hide preview') : $_('Preview')}
        </button>
      {/if}
    </div>
    {#if showPreview && canPreview}
      <div class="border-t border-base-300/15 bg-base-200/60">
        <iframe
          title={$_('Link preview')}
          class="w-full h-40"
          src={$linkState.href}
          sandbox="allow-same-origin allow-scripts allow-popups"
        />
      </div>
    {/if}
  </div>
{/if}

<style>
  .link-preview-bubble {
    background: var(--theme-popover-bg);
    border-color: var(--theme-border-subtle);
    box-shadow: var(--theme-popover-shadow);
  }
</style>
