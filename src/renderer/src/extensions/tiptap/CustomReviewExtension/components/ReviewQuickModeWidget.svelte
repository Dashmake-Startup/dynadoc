<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import type { Editor } from '@tiptap/core'
  import { _$_documentEditorsList } from '../../../../stores/editor.store'
  import { GenericFormatingEditorCommands } from '../../../../components/common/actions/formatting'

  /* Import Context Menu Components */
  import ContextMenuWidget from '../../../../components/common/contextMenu/components/ContextMenuWidget.svelte'
  import type { ContextMenuItem } from '../../../../components/common/contextMenu/utils/utils'

  const { editor } = $props<{ editor: Editor | null }>()

  type ReviewMode = 'edit' | 'suggest' | 'view'
  let currentMode = $state<ReviewMode>('edit')

  /* Context Menu State */
  let menuShow = $state(false)
  let menuX = $state(0)
  let menuY = $state(0)
  let menuRef = $state<HTMLElement | null>(null)
  let triggerEl = $state<HTMLElement | null>(null)

  const activeDocStore = _$_documentEditorsList.getActive()
  let activeDoc = $derived($activeDocStore)

  const resolveMode = () => {
    const enabled =
      editor?.storage?.review?.enabled ??
      activeDoc?.document?.config?.reviewSettings?.trackChangesEnabled
    const markup = activeDoc?.document?.config?.reviewSettings?.markupMode || 'all'

    if (enabled) return 'suggest'
    if (markup === 'original' || markup === 'none') return 'view'
    return 'edit'
  }

  const setMode = (mode: ReviewMode) => {
    if (mode === 'edit') {
      GenericFormatingEditorCommands.toggleTrackChanges(false)
      GenericFormatingEditorCommands.setMarkupMode('all')
    }
    if (mode === 'suggest') {
      GenericFormatingEditorCommands.toggleTrackChanges(true)
      GenericFormatingEditorCommands.setMarkupMode('all')
    }
    if (mode === 'view') {
      GenericFormatingEditorCommands.toggleTrackChanges(false)
      GenericFormatingEditorCommands.setMarkupMode('original')
    }
    currentMode = mode
    menuShow = false
  }

  /* Define Menu Items using the ContextMenuItem interface */
  const menuItems = $derived.by<ContextMenuItem[]>(() => [
    {
      label: $_('Edit mode'),
      icon: 'ph-light ph-pencil-simple',
      action: () => setMode('edit'),
      active: currentMode === 'edit'
    },
    {
      label: $_('Suggest mode'),
      icon: 'ph-light ph-chats',
      action: () => setMode('suggest'),
      active: currentMode === 'suggest'
    },
    {
      label: $_('View mode'),
      icon: 'ph-light ph-eye',
      action: () => setMode('view'),
      active: currentMode === 'view'
    }
  ])

  const openMenu = (event?: MouseEvent) => {
    if (event) event.stopPropagation()
    if (!triggerEl) return
    const rect = triggerEl.getBoundingClientRect()
    // Position to the left of the button since the widget is on the right
    menuX = rect.left - 170
    menuY = rect.top
    menuShow = true
  }

  const cycleMode = () => {
    const order: ReviewMode[] = ['edit', 'suggest', 'view']
    const idx = order.indexOf(currentMode)
    const next = order[(idx + 1) % order.length]
    setMode(next)
  }

  let unsubscribe: (() => void) | null = null
  onMount(() => {
    currentMode = resolveMode()
    if (!editor) return
    const handler = () => {
      currentMode = resolveMode()
    }
    editor.on('transaction', handler)
    unsubscribe = () => editor.off('transaction', handler)
  })

  onDestroy(() => {
    unsubscribe?.()
  })
</script>

<div class="app-component-no-print review-quick-container">
  <div class="review-quick">
    <button class="review-fab" onclick={cycleMode} title={$_('Review Mode')}>
      <span class="review-fab-icon">
        {#if currentMode === 'edit'}
          <i class="ph-light ph-pencil-simple"></i>
        {:else if currentMode === 'suggest'}
          <i class="ph-light ph-chats"></i>
        {:else}
          <i class="ph-light ph-eye"></i>
        {/if}
      </span>
      <span class="review-fab-status">{currentMode}</span>
    </button>

    <button class="review-menu-toggle" bind:this={triggerEl} onclick={openMenu}>
      <i class="ph-light ph-dots-three-vertical"></i>
    </button>
  </div>
</div>

<ContextMenuWidget
  bind:__show={menuShow}
  bind:__menuRef={menuRef}
  __x={menuX}
  __y={menuY}
  __menuItems={menuItems}
/>

<style lang="postcss">
  :global(.review-quick-container) {
    @apply absolute top-4 right-4 z-[120] w-12 pointer-events-auto;
  }

  .review-quick {
    @apply relative flex flex-col items-center gap-2;
  }

  .review-fab {
    @apply relative w-12 h-12 flex flex-col items-center justify-center;
    @apply rounded-xl border border-white/10 shadow-2xl transition-all duration-200;
    @apply bg-primary/20 text-primary hover:bg-primary/30 active:scale-95;
    @apply backdrop-blur-md backdrop-saturate-150;
  }

  .review-fab-icon {
    @apply text-xl;
  }

  .review-fab-status {
    @apply text-[8px] font-bold uppercase tracking-widest text-primary/80;
  }

  .review-menu-toggle {
    @apply flex items-center justify-center w-8 h-8;
    @apply rounded-lg border border-white/5 shadow-lg transition-colors;
    @apply bg-[color-mix(in_srgb,var(--color-base-200)_50%,transparent)] text-[var(--color-base-content)]/60 hover:bg-[var(--color-base-200)] hover:text-[var(--color-base-content)];
    @apply backdrop-blur-sm;
  }
</style>
