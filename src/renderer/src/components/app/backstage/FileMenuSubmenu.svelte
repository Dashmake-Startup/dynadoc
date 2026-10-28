<script lang="ts" context="module">
  // Export the type cleanly so it can be safely referenced recursively
  export type MenuItem = {
    id: string
    label?: string
    icon?: string
    shortcut?: string
    hasSubmenu?: boolean
    active?: boolean
    type?: 'item' | 'separator'
    action?: () => void | Promise<void>
    disabled?: boolean
    submenu?: MenuItem[]
    badge?: string
    tooltip?: string
  }
</script>

<script lang="ts">
  import FileMenuSubmenu from './FileMenuSubmenu.svelte'

  // Explicit Svelte 5 Props destructuring
  let { items = [], __onAction = null } = $props<{
    items: MenuItem[]
    __onAction?: ((action?: () => void | Promise<void>) => void) | null
  }>()

  // Tracks open submenus within *this* specific branch level only
  let openId = $state<string | null>(null)

  function runAction(item: MenuItem) {
    if (item.disabled) return
    if (item.submenu?.length) return
    __onAction?.(item.action)
  }
</script>

<div
  class="submenu-panel bg-base-100 border border-base-200 rounded-md shadow-xl py-1"
  onmouseleave={() => (openId = null)}
>
  {#each items as item (item.id)}
    {#if item.type === 'separator'}
      <div class="h-px bg-base-200 my-1 mx-2"></div>
    {:else}
      <div
        class="submenu-row relative"
        onmouseenter={() => {
          if (item.submenu?.length) openId = item.id
        }}
      >
        <button
          disabled={item.disabled}
          title={item.tooltip}
          onclick={() => runAction(item)}
          class="w-full flex items-center px-3 py-2 text-[12px] transition-all
            {item.disabled
            ? 'opacity-40 cursor-not-allowed'
            : 'hover:bg-base-200 text-base-content/70 hover:text-base-content'}"
        >
          <i class="{item.icon?.replace('i-carbon-', 'ph-light ph-') || ''} text-sm mr-3 opacity-60"
          ></i>
          <span class="flex-grow text-left">{item.label}</span>

          {#if item.badge}
            <span
              class="ml-2 text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400"
            >
              {item.badge}
            </span>
          {/if}

          {#if item.submenu?.length}
            <i class="ph-light ph-caret-right text-[10px] ml-2 opacity-40"></i>
          {/if}
        </button>

        {#if item.submenu?.length && openId === item.id}
          <div class="submenu-child absolute left-full top-0 h-full z-50">
            <FileMenuSubmenu items={item.submenu} {__onAction} />
          </div>
        {/if}
      </div>
    {/if}
  {/each}
</div>

<style lang="postcss">
  .submenu-panel {
    min-width: 220px;
  }

  .submenu-child {
    /* CRITICAL PRO FIX:
      Instead of using margin-left (which leaves dead space), we use padding-left.
      This acts as an invisible continuous hover bridge, preventing unwanted mouseleave fires.
    */
    padding-left: 6px;
  }
</style>
