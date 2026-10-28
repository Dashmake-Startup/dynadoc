

<script lang="ts">
  import { _ } from 'svelte-i18n'
  // --- SWATCH DATA STRUCTURE ---
  const swatchGroups = [
    {
      name: 'RGB Grey',
      open: true,
      colors: [
        '#000000',
        'var(--color-base-200)',
        '#333333',
        '#4d4d4d',
        '#666666',
        '#808080',
        '#999999',
        '#b3b3b3',
        '#cccccc',
        '#e6e6e6',
        '#ffffff'
      ]
    },
    {
      name: 'Pure',
      open: true,
      colors: ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff']
    },
    {
      name: 'Pastels',
      open: false,
      colors: ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#e0baff']
    },
    {
      name: 'Dark Themes',
      open: false,
      colors: ['#2c3e50', '#8e44ad', '#2980b9', '#27ae60', '#f39c12', '#d35400', '#c0392b']
    }
  ]

  // --- SVELTE 5 STATE ---
  // We wrap the initial data in $state to make the 'open' toggles reactive
  let groups = $state(swatchGroups)
  let recentColors = $state(['#ffffff', '#000000']) // Top row of "Recently Used"

  // This would ideally be linked to your global Color State
  let selectedColor = $state('#ffffff')

  const selectColor = (color: string) => {
    selectedColor = color

    // Add to recents if not already there (Photoshop behavior)
    if (!recentColors.includes(color)) {
      recentColors = [color, ...recentColors.slice(0, 9)]
    }
  }

  const toggleGroup = (index: number) => {
    groups[index].open = !groups[index].open
  }
</script>

<div
  class="bg-base-200 flex flex-col h-full text-xs text-base-content/80 border-l border-base-content/10 select-none"
>
  <div class="p-2">
    <div class="flex items-center bg-base-100 border border-base-content/15 px-2 py-1 rounded-sm">
      <div class="i-theme-workflow:search w-3 h-3 mr-2 opacity-50"></div>
      <input
        type="text"
        placeholder={$_('Search swatches...')}
        class="bg-transparent border-none outline-none text-[11px] w-full text-base-content placeholder:text-base-content/30"
      />
    </div>
  </div>

  <div class="flex-grow overflow-y-auto custom-scrollbar px-2">
    <div class="mb-4">
      <div class="text-[10px] uppercase tracking-wider opacity-50 mb-2 font-bold">
        {$_('Recent Colors')}
      </div>
      <div class="grid grid-cols-10 gap-1">
        {#each recentColors as color}
          <button
            onclick={() => selectColor(color)}
            class="w-5 h-5 border border-base-content/10 hover:border-base-content/50 transition-all"
            style:background-color={color}
          ></button>
        {/each}
      </div>
    </div>

    {#each groups as group, i}
      <div class="mb-1">
        <button
          onclick={() => toggleGroup(i)}
          class="flex items-center w-full py-1 hover:bg-base-content/8 px-1 rounded-sm transition-colors"
        >
          <div class="transition-transform duration-100 {group.open ? 'rotate-90' : ''}">
            <div class="i-theme-workflow:chevron-right w-3 h-3"></div>
          </div>
          <div class="i-theme-workflow:folder w-3 h-3 mx-1.5 opacity-70"></div>
          <span class="flex-grow text-left">{group.name}</span>
        </button>

        {#if group.open}
          <div class="grid grid-cols-10 gap-1 p-y-2 p-l-6">
            {#each group.colors as color}
              <button
                onclick={() => selectColor(color)}
                class="w-5 h-5 border border-base-content/10 hover:scale-110 hover:z-10 hover:border-base-content/50 transition-all shadow-sm"
                style:background-color={color}
                title={color}
              ></button>
            {/each}

            <button
              class="w-5 h-5 border border-dashed border-base-content/20 flex items-center justify-center hover:border-base-content/50"
            >
              <span class="text-[10px]">+</span>
            </button>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="p-2 border-t border-base-content/10 flex justify-end gap-3 opacity-60">
    <button class="i-theme-workflow:add w-4 h-4 hover:opacity-100"></button>
    <button class="i-theme-workflow:delete w-4 h-4 hover:opacity-100"></button>
  </div>
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(var(--theme-text-rgb), 0.24);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(var(--theme-text-rgb), 0.34);
  }
</style>
