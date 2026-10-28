<script lang="ts">
  import { fade, scale } from 'svelte/transition'
  import { _ } from 'svelte-i18n'

  // --- Runes: Props ---
  let {
    __onSelection = (rows: number, cols: number, hasHeader: boolean) => {},
    __maxRows = 10,
    __maxCols = 10,
    __cellSize = 1.25, // rem
    __withHeader = $bindable(true),
    __closeContextMenu = () => {}
  } = $props()

  // --- Runes: State ---
  let hoverRow = $state(0)
  let hoverCol = $state(0)

  // Derived state for the footer label
  const selectionLabel = $derived(hoverRow > 0 ? `${hoverRow} × ${hoverCol}` : $_('Select Grid'))

  function handleMouseEnter(r: number, c: number) {
    hoverRow = r + 1
    hoverCol = c + 1
  }

  function handleClick() {
    __onSelection?.(hoverRow, hoverCol, __withHeader)
    __closeContextMenu?.()
  }

  function resetHover() {
    hoverRow = 0
    hoverCol = 0
  }
</script>

<div
  class="inline-block p-3 bg-base-100 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl select-none font-sans"
  onmouseleave={resetHover}
>
  <div class="flex items-center justify-between mb-3 px-1">
    <span class="text-[10px] font-black uppercase tracking-[0.15em] text-base-content/40">
      {selectionLabel}
    </span>
    <i class="ph-light ph-table text-primary/50 text-xs"></i>
  </div>

  <div
    class="grid gap-[3px]"
    style="grid-template-rows: repeat({__maxRows}, {__cellSize}rem); grid-template-columns: repeat({__maxCols}, {__cellSize}rem)"
  >
    {#each Array(__maxRows) as _, rIndex}
      {#each Array(__maxCols) as _, cIndex}
        {@const isHovered = rIndex < hoverRow && cIndex < hoverCol}
        {@const isHeaderRow = __withHeader && rIndex === 0 && isHovered}

        <button
          type="button"
          class="relative w-full h-full rounded-[2px] border transition-all duration-200 ease-out outline-none"
          class:border-white-5={!isHovered}
          class:bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)]-[0.03]={!isHovered}
          class:border-primary={isHovered}
          class:bg-primary-20={isHovered && !isHeaderRow}
          class:bg-primary-50={isHeaderRow}
          onmouseenter={() => handleMouseEnter(rIndex, cIndex)}
          onclick={handleClick}
        >
          {#if isHovered}
            <div
              transition:scale={{ start: 0.8, duration: 150 }}
              class="absolute inset-0 shadow-[inset_0_0_8px_rgba(var(--primary-rgb),0.3)]"
            ></div>
          {/if}
        </button>
      {/each}
    {/each}
  </div>

  <div class="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2">
    <label class="flex items-center justify-between group cursor-pointer">
      <div class="flex items-center gap-2">
        <i
          class="ph-bold ph-layout text-[10px] {__withHeader
            ? 'text-primary'
            : 'text-base-content/20'}"
        ></i>
        <span
          class="text-[10px] font-bold text-base-content/60 group-hover:text-base-content transition-colors"
          >{$_('Include Header')}</span
        >
      </div>
      <input type="checkbox" bind:checked={__withHeader} class="checkbox-custom" />
    </label>

    <button
      class="w-full mt-1 py-1.5 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] border border-white/5 rounded text-[9px] font-black uppercase tracking-widest text-base-content/40 hover:text-primary transition-all"
    >
      {$_('Custom Table...')}
    </button>
  </div>
</div>

<style>
  /* Custom Checkbox to match Adobe 2025 */
  .checkbox-custom {
    appearance: none;
    width: 12px;
    height: 12px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    position: relative;
    cursor: pointer;
    transition: all 0.2s;
  }
  .checkbox-custom:checked {
    background: var(--primary);
    border-color: var(--primary);
  }
  .checkbox-custom:checked::after {
    content: '✓';
    position: absolute;
    color: white;
    font-size: 8px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  /* Define Primary RGB for the shadow variable */
  :root {
    /* --primary-rgb: 2, 101, 210; Example: Adobe Blue */
  }
</style>
