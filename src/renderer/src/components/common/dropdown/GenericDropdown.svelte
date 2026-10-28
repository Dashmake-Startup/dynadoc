<script lang="ts">
  import { _ } from 'svelte-i18n'
  import GenericFormattingComponent from '../actions/formatting/GenericFormattingComponent.svelte'
  import Layout from '../layout/layout'
  import DropdownRow from './DropdownRow.svelte'
  import { onMount, onDestroy } from 'svelte'
  import { _$_wysiwygEditorsList } from '../../../stores/editor.store'

  type DropdownItem = {
    __id?: string
    __label?: string
    __description?: string
    __detail?: string
    __icon?: string // UnoCSS __icon class e.g., 'i-carbon-settings'
    __keybinding?: string // e.g., 'Ctrl+Alt+S'
    __active?: boolean
    __disabled?: boolean | (() => boolean)
    __tooltip?: string
    __type?: 'item' | 'separator' | 'header'
    __children?: DropdownItem[]
    __onClick?: () => void
  }

  interface Props {
    __items: DropdownItem[]
    __width?: string
    __header?: string
    __onSelection?: () => void
    __closeContextMenu?: () => void
  }
  //   export let items: Record<string, any> = {} // Props to pass to component
  //   export let width = 'w-72'
  //   export let header = ''

  let {
    __items: __items = [],
    __width: __width = 'w-72',
    __header: __header = '',
    __onSelection: __onSelection = undefined,
    __closeContextMenu: __closeContextMenu = undefined
  }: Props = $props()
  //   let { items = [], width = 'w-72', header = '' }: Props = $props();
  //   let { items = [], width = 'w-72', header = '' }: Props = $props();

  // Determine if we need to reserve space for __icons to keep __labels aligned
  const has__icons = __items.some((item) => item.__icon)

  let selectionTick = $state(0)
  let detachSelection: (() => void) | null = null

  const resolveDisabled = (item: DropdownItem) => {
    // ensure reactive dependency on selection changes
    selectionTick
    if (typeof item.__disabled === 'function') return item.__disabled()
    return item.__disabled ?? false
  }

  const resolveTooltip = (item: DropdownItem) =>
    resolveDisabled(item) ? (item.__tooltip ? $_(item.__tooltip) : $_('Select text to enable')) : ''

  const bindSelectionListener = () => {
    const entry = _$_wysiwygEditorsList.getActiveEntry?.()
    const editor = entry?.editor
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
</script>

<!-- <div
  class="{width} bg-[#292827] text-[#f3f2f1] rounded-sm shadow-xl border border-[#484644] py-1 font-sans select-none overflow-hidden"
> -->
<div
  class="{__width} bg-base-100 text-base-content rounded-sm shadow-xl border border-base-300 py-1 font-sans select-none overflow-hidden"
>
  {#if __header}
    <div class="px-4 py-2 text-sm font-semibold text-base-content">
      {__header}
    </div>
  {/if}

  <div class="flex flex-col">
    {#each __items as item}
      {#if item.__children}
        <DropdownRow
          {item}
          onSelection={() => {
            __onSelection?.()
            __closeContextMenu?.()
          }}
        />
      {:else if item.__type === 'separator'}
        <div class="h-px bg-base-300 my-1 mx-1"></div>
      {:else if item.__type === 'header'}
        <div class="px-4 py-1.5 text-xs font-bold text-base-content/50 uppercase tracking-wider">
          {item.__label}
        </div>
      {:else}
        <button
          onclick={() => {
            item.__onClick?.()
            __onSelection?.()
            __closeContextMenu?.()
          }}
          class="w-full flex items-center px-3 py-1.5 text-sm text-base-content transition-colors group
            {item.__active ? 'bg-base-300' : 'hover:bg-base-200'}"
          disabled={resolveDisabled(item)}
          title={resolveTooltip(item)}
        >
          {#if has__icons}
            <div class="w-6 flex flex-shrink-0 items-center justify-start">
              {#if item.__icon}
                <span class="w-4 h-4 text-base-content/60 group-hover:text-base-content"
                  >{@html item.__icon}</span
                >
              {/if}
            </div>
          {/if}

          <span class="flex-grow text-left">
            <span class="block text-sm leading-tight">{@html item.__label}</span>
            {#if item.__description}
              <span class="block text-[10px] text-base-content/50 leading-tight">
                {item.__description}
              </span>
            {/if}
          </span>

          {#if item.__detail}
            <span class="relative ml-2 group/info">
              <i class="ph-light ph-info text-[12px] text-base-content/50"></i>
              <span
                class="pointer-events-none absolute right-0 top-6 z-50 w-64 rounded-md bg-base-200 border border-white/10 px-2.5 py-2 text-[10px] text-base-content/80 opacity-0 translate-y-1 group-hover/info:opacity-100 group-hover/info:translate-y-0 transition"
              >
                {item.__detail}
              </span>
            </span>
          {/if}

          {#if item.__keybinding}
            <span class="ml-4 text-xs text-[#a19f9d] font-normal">
              {item.__keybinding}
            </span>
          {/if}
        </button>
      {/if}
    {/each}
  </div>
</div>
