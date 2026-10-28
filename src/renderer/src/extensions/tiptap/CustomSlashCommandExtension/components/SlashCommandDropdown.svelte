<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, tick } from 'svelte'

  interface Props {
    items: any[]
    activeIndex: number
    selectItem: Function
    position: { x: number; y: number } | null
  }
  let { items, activeIndex, selectItem, position }: Props = $props()

  let container = $state<HTMLElement>()

  $effect(() => {
    if (container && activeIndex >= 0) {
      const activeEl = container.querySelector(`[data-index="${activeIndex}"]`)
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  })
</script>

<div
  bind:this={container}
  class="fixed z-[1000] flex flex-col overflow-y-auto
         rounded-xl border border-white/10 bg-base-100/80 backdrop-blur-2xl
         shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/5"
  style="width: 320px; max-height: 400px;"
  style:left="{position?.x ?? 0}px"
  style:top="{position?.y ?? 0}px"
  style:visibility={position?.x ? 'visible' : 'hidden'}
>
  <div
    class="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-base-100/40 px-4 py-2 backdrop-blur-md"
  >
    <span class="text-[10px] font-bold uppercase tracking-widest text-base-content/40">
      {$_('Slash Commands')}
    </span>
    <span class="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
      {items.length} Commands
    </span>
  </div>

  <div class="p-1.5">
    {#each items as item, i}
      <button
        data-index={i}
        onclick={() => selectItem(item)}
        class="group relative flex w-full items-center gap-3 rounded-lg border-none bg-transparent p-2.5 text-left transition-all duration-200 cursor-pointer
               {i === activeIndex ? 'bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] shadow-inner' : 'hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)]'}"
      >
        <div class="flex h-8 w-8 items-center justify-center rounded-md bg-base-content/5 group-[.active]:bg-primary/10 transition-colors">
          <i class="{item.icon || 'ph-bold ph-command'} text-[16px] {i === activeIndex ? 'text-primary' : 'text-base-content/40'}"></i>
        </div>

        <div class="flex flex-1 flex-col truncate">
          <span class="text-[13px] font-500 text-base-content/90 {i === activeIndex ? 'text-base-content' : ''}">
            {item.title}
          </span>
          {#if item.subtitle}
            <span class="text-[10px] text-base-content/30 truncate">{item.subtitle}</span>
          {/if}
        </div>

        {#if item.hotkey}
          <div class="flex gap-1 opacity-40">
            {#each item.hotkey.split('+') as key}
              <kbd class="min-w-[16px] rounded border border-base-content/20 bg-base-content/5 px-1 py-0.5 text-center font-sans text-[9px] font-700">
                {key}
              </kbd>
            {/each}
          </div>
        {/if}

        {#if i === activeIndex}
          <div
            class="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_12px_rgba(124,58,237,0.5)]"
          ></div>
        {/if}
      </button>
    {/each}
  </div>

  {#if items.length <= 0}
    <div class="flex flex-col items-center justify-center gap-2 p-8 text-base-content/20">
      <i class="ph-light ph-command text-[24px]"></i>
      <span class="text-[10px] font-medium uppercase tracking-widest">{$_('No commands found')}</span>
    </div>
  {/if}
</div>

<style>
  div::-webkit-scrollbar {
    width: 4px;
  }
  div::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }
  div::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
