<script lang="ts">
  import { fade, slide } from 'svelte/transition'
  import { _ } from 'svelte-i18n'

  // --- Runes: Props ---
  let {
    items = [],
    activeIndex = 0,
    query = '',
    selectItem,
    position = { x: 0, y: 0 }
  } = $props<{
    items: any[]
    activeIndex: number
    query: string
    selectItem: (item: any) => void
  }>()
  let container = $state<HTMLElement>()

  // Innovative: AI Confidence Mock-up (Adobe 2025 uses probabilistic ranking)
  const getConfidence = (item: any) => item.confidence || (0.85 + Math.random() * 0.14).toFixed(2)

  function escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function highlight(name: string, query: string) {
    if (!query) return name
    const safeQuery = escapeRegExp(query)
    const regex = new RegExp(`(${safeQuery})`, 'ig')
    // Using Adobe Primary for the highlight color
    return name.replace(regex, `<span class="text-base-content font-black">$1</span>`)
  }

  /* $effect(() => {
    if (container) {
      container.style.left = `${position.x}px`
      container.style.top = `${position.y}px`
    }
  }) */
</script>

<div
  bind:this={container}
  class="fixed w-80 flex flex-col bg-base-100 backdrop-blur-2xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden font-sans select-none"
  style:left="{position?.x ?? 0}px"
  style:top="{position?.y ?? 0}px"
  style:visibility={position?.x ? 'visible' : 'hidden'}
  transition:fade={{ duration: 100 }}
>
  <div class="px-3 py-2 bg-[color-mix(in_srgb,var(--color-base-white)_3%,transparent)] border-b border-white/5 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="size-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#0265D2]"></div>
      <span class="text-[9px] font-black uppercase tracking-[0.15em] text-base-content/40">
        {$_('AI Suggestions')}
      </span>
    </div>
    <span class="text-[8px] font-mono text-base-content/20">{$_('CTRL + SPACE')}</span>
  </div>

  <div class="max-h-64 overflow-y-auto no-scrollbar p-1.5">
    {#each items as item, i}
      <button
        class="w-full flex flex-col px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 group text-left
               {i === activeIndex ? 'bg-primary' : 'hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)]'}"
        onmousedown={(e) => {
          e.preventDefault()
          selectItem(item)
        }}
      >
        <div class="flex items-start justify-between">
          <div class="flex flex-col gap-0.5">
            <span
              class="text-[12px] font-bold leading-none {i === activeIndex
                ? 'text-base-content'
                : 'text-base-content/80'}"
            >
              {@html highlight(item.name, query)}
            </span>

            {#if item.description}
              <span
                class="text-[10px] leading-tight {i === activeIndex
                  ? 'text-base-content/70'
                  : 'text-base-content/30'}"
              >
                {item.description}
              </span>
            {/if}
          </div>

          <!-- {#if i === activeIndex}
            <div class="flex flex-col items-end" transition:fade>
              <span class="text-[8px] font-black text-base-content/50 leading-none">MATCH</span>
              <span class="text-[10px] font-mono font-bold text-base-content"
                >{(getConfidence(item) * 100).toFixed(0)}%</span
              >
            </div>
          {/if} -->
        </div>

        {#if i === activeIndex && item.params}
          <div class="mt-2 flex gap-1.5" transition:slide>
            {#each item.params as param}
              <span
                class="px-1.5 py-0.5 rounded-sm bg-black/30 border border-white/10 text-[8px] font-mono text-base-content/60"
              >
                {param}
              </span>
            {/each}
          </div>
        {/if}
      </button>
    {:else}
      <div class="p-4 text-center">
        <span class="text-[11px] text-base-content/20 italic font-medium">
          {$_('No commands found...')}
        </span>
      </div>
    {/each}
  </div>

  <div class="px-3 py-2 bg-black/40 border-t border-white/5 flex items-center justify-between">
    <div class="flex items-center gap-1.5">
      <i class="ph-light ph-keyboard text-[12px] text-base-content/20"></i>
      <span class="text-[9px] font-bold text-base-content/40 uppercase tracking-tighter"
        >{$_('Navigate with arrows')}</span
      >
    </div>
    <i class="ph-bold ph-sparkle text-primary text-[11px]"></i>
  </div>
</div>

<style>
  /* Inter is the choice for Adobe 2025 */
  div {
    font-family: var(--brand-font-sans);
  }

  /* Smooth scrolling */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  :global(strong) {
    color: inherit; /* Handled by highlight function span */
  }
</style>
