<script lang="ts">
  import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom'
  import { _ } from 'svelte-i18n'
  import { fade } from 'svelte/transition'
  import { onDestroy, onMount } from 'svelte'
  import { _$_wysiwygEditorsList } from '../../../stores/editor.store'

  type DropdownItem = {
    __id?: string
    __label?: string
    __description?: string
    __detail?: string
    __icon?: string
    __keybinding?: string
    __active?: boolean
    __disabled?: boolean | (() => boolean)
    __tooltip?: string
    __type?: 'item' | 'separator' | 'header'
    __children?: DropdownItem[]
    __onClick?: () => void
  }

  let { item, onSelection } = $props<{ item: DropdownItem; onSelection?: () => void }>()

  let rowEl = $state<HTMLElement | null>(null)
  let submenuEl = $state<HTMLElement | null>(null)
  let showSub = $state(false)
  let closeTimeout: ReturnType<typeof setTimeout>
  let selectionTick = $state(0)
  let detachSelection: (() => void) | null = null

  const resolveDisabled = (entry: DropdownItem) => {
    selectionTick
    if (typeof entry.__disabled === 'function') return entry.__disabled()
    return entry.__disabled ?? false
  }

  const resolveTooltip = (entry: DropdownItem) =>
    resolveDisabled(entry) ? (entry.__tooltip ? $_(entry.__tooltip) : $_('Select text to enable')) : ''

  const bindSelectionListener = () => {
    const activeEntry = _$_wysiwygEditorsList.getActiveEntry?.()
    const editor = activeEntry?.editor
    if (!editor) return
    const handler = () => {
      selectionTick += 1
    }
    editor.on?.('selectionUpdate', handler)
    editor.on?.('blur', handler)
    detachSelection = () => {
      editor.off?.('selectionUpdate', handler)
      editor.off?.('blur', handler)
    }
  }

  onMount(() => {
    bindSelectionListener()
  })

  onDestroy(() => {
    detachSelection?.()
  })

  function handleMouseEnter() {
    if (resolveDisabled(item)) return
    clearTimeout(closeTimeout)
    showSub = true
  }

  function handleMouseLeave() {
    closeTimeout = setTimeout(() => {
      showSub = false
    }, 150)
  }

  $effect(() => {
    if (showSub && rowEl && submenuEl) {
      const cleanup = autoUpdate(rowEl, submenuEl, () => {
        computePosition(rowEl!, submenuEl!, {
          placement: 'right-start',
          middleware: [offset(6), flip({ fallbackPlacements: ['left-start', 'right-end'] }), shift({ padding: 12 })]
        }).then(({ x, y }) => {
          if (submenuEl) {
            submenuEl.style.left = `${x}px`
            submenuEl.style.top = `${y}px`
          }
        })
      })
      return cleanup
    }
  })
</script>

<div
  bind:this={rowEl}
  class="relative w-full"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  role="none"
>
  <button
    type="button"
    disabled={resolveDisabled(item)}
    title={resolveTooltip(item)}
    class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-[4px] cursor-pointer group transition-all
      {resolveDisabled(item)
        ? 'opacity-40 cursor-not-allowed text-base-content/40'
        : showSub && item.__children
          ? 'bg-primary text-base-content'
          : 'hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-base-content/80'}"
    onclick={() => {
      if (resolveDisabled(item)) return
      if (item.__children) {
        showSub = !showSub
      } else {
        item.__onClick?.()
        onSelection?.()
      }
    }}
  >
    <div class="flex items-center gap-3">
      <div class="w-5 flex items-center justify-start">
        {#if item.__icon}
          <span class="w-4 h-4 text-base-content/50 group-hover:text-primary">{@html item.__icon}</span>
        {/if}
      </div>
      <div class="flex flex-col items-start">
        <span class="text-[11px] font-medium tracking-wide">{item.__label ? $_(item.__label) : ''}</span>
        {#if item.__description}
          <span class="text-[9px] text-base-content/40">{item.__description ? $_(item.__description) : ''}</span>
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-2">
      {#if item.__keybinding}
        <span class="text-[9px] font-mono opacity-40 group-hover:opacity-100">{item.__keybinding}</span>
      {/if}
      {#if item.__children}
        <i class="ph-bold ph-caret-right text-[10px] opacity-50"></i>
      {/if}
    </div>
  </button>

  {#if item.__children && showSub}
    <div
      bind:this={submenuEl}
      class="submenu-container fixed z-[1002] bg-base-100 border border-white/10 rounded-lg shadow-2xl p-1.5 min-w-[200px]"
      onmouseenter={handleMouseEnter}
      onmouseleave={handleMouseLeave}
      transition:fade={{ duration: 60 }}
    >
      {#each item.__children as child}
        {#if child.__type === 'separator'}
          <div class="h-px bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] mx-1 my-1.5"></div>
        {:else if child.__type === 'header'}
          <div class="px-3 py-1.5 text-[9px] font-bold text-base-content/40 uppercase tracking-widest">
            {child.__label ? $_(child.__label) : ''}
          </div>
        {:else if child.__children}
          <svelte:self item={child} {onSelection} />
        {:else}
          <button
            class="w-full flex items-center gap-3 px-2.5 py-1.5 rounded-[4px] text-[11px] transition-all
              {resolveDisabled(child)
                ? 'opacity-40 cursor-not-allowed text-base-content/40'
                : 'text-base-content/80 hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)]'}"
            disabled={resolveDisabled(child)}
            title={resolveTooltip(child)}
            onclick={() => {
              if (resolveDisabled(child)) return
              child.__onClick?.()
              onSelection?.()
            }}
          >
            <div class="w-5 flex items-center justify-start">
              {#if child.__icon}
                <span class="w-4 h-4 text-base-content/50">{@html child.__icon}</span>
              {/if}
            </div>
            <span>{child.__label ? $_(child.__label) : ''}</span>
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .submenu-container {
    position: fixed;
    top: 0;
    left: 0;
  }
  .submenu-container::before {
    content: '';
    position: absolute;
    left: -15px;
    top: 0;
    bottom: 0;
    width: 20px;
    background: transparent;
  }
</style>
