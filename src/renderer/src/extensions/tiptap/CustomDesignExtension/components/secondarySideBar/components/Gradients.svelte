

<script lang="ts">
  import { _ } from 'svelte-i18n'
  // --- GRADIENT PRESET DATA ---
  const gradientGroups = [
    {
      name: 'Basics',
      open: true,
      items: [
        { name: 'FG to BG', css: 'linear-gradient(90deg, #000 0%, #fff 100%)' },
        { name: 'FG to Transparent', css: 'linear-gradient(90deg, #000 0%, transparent 100%)' },
        { name: 'Black, White', css: 'linear-gradient(90deg, #000 0%, #fff 100%)' }
      ]
    },
    {
      name: 'Blues',
      open: true,
      items: [
        { name: 'Deep Sea', css: 'linear-gradient(90deg, #2b5876 0%, #4e4376 100%)' },
        { name: 'Sky High', css: 'linear-gradient(90deg, #00c6ff 0%, #0072ff 100%)' },
        { name: 'Morning', css: 'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)' }
      ]
    },
    {
      name: 'Iridescent',
      open: false,
      items: [
        { name: 'Pearl', css: 'linear-gradient(90deg, #a1c4fd 0%, #c2e9fb 100%)' },
        { name: 'Vapor', css: 'linear-gradient(90deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)' }
      ]
    }
  ]

  // --- SVELTE 5 STATE ---
  let groups = $state(gradientGroups)
  let activeGradient = $state(gradientGroups[0].items[0].css)
  let recentGradients = $state([
    'linear-gradient(90deg, #000 0%, #fff 100%)',
    'linear-gradient(90deg, #ff9a9e 0%, #fecfef 100%)'
  ])

  const selectGradient = (css: string) => {
    activeGradient = css
    if (!recentGradients.includes(css)) {
      recentGradients = [css, ...recentGradients.slice(0, 4)]
    }
  }

  const toggleGroup = (index: number) => {
    groups[index].open = !groups[index].open
  }
</script>

<div
  class=" bg-base-200 flex flex-col h-full text-xs text-base-content/80 border-l border-base-content/10 select-none"
>
  <div class="p-2">
    <div class="flex items-center bg-base-100 border border-base-content/15 px-2 py-1 rounded-sm">
      <div class="i-theme-workflow:search w-3 h-3 mr-2 opacity-50"></div>
      <input
        type="text"
        placeholder={$_('Search gradients...')}
        class="bg-transparent border-none outline-none text-[11px] w-full text-base-content"
      />
    </div>
  </div>

  <div class="flex-grow overflow-y-auto custom-scrollbar px-2">
    <div class="mb-4">
      <div class="text-[10px] uppercase opacity-50 mb-2 font-bold px-1">{$_('Recent')}</div>
      <div class="grid grid-cols-2 gap-2 px-1">
        {#each recentGradients as css}
          <button
            onclick={() => selectGradient(css)}
            class="h-8 border border-base-content/10 hover:border-base-content/50 transition-all rounded-sm"
            style:background={css}
          ></button>
        {/each}
      </div>
    </div>

    {#each groups as group, i}
      <div class="mb-1">
        <button
          onclick={() => toggleGroup(i)}
          class="flex items-center w-full py-1.5 hover:bg-base-content/8 px-1 rounded-sm transition-colors"
        >
          <div class="transition-transform {group.open ? 'rotate-90' : ''}">
            <div class="i-theme-workflow:chevron-right w-3 h-3"></div>
          </div>
          <div class="i-theme-workflow:gradient w-3.5 h-3.5 mx-1.5 opacity-70"></div>
          <span class="flex-grow text-left">{group.name}</span>
        </button>

        {#if group.open}
          <div class="flex flex-col gap-1 p-y-2 p-l-6 p-r-1">
            {#each group.items as item}
              <button
                onclick={() => selectGradient(item.css)}
                class="group flex items-center gap-3 w-full p-1 hover:bg-base-content/10 rounded-sm transition-all {activeGradient ===
                item.css
                  ? 'bg-base-content/10 ring-1 ring-blue-500'
                  : ''}"
              >
                <div
                  class="w-12 h-4 border border-base-content/10 flex-shrink-0"
                  style:background={item.css}
                ></div>
                <span class="truncate opacity-80 group-hover:opacity-100">{item.name}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="p-2 border-t border-base-content/10 flex justify-between items-center px-4">
    <div class="flex gap-4 opacity-60">
      <button class="i-theme-workflow:folder-add w-4 h-4 hover:opacity-100"></button>
      <button class="i-theme-workflow:add w-4 h-4 hover:opacity-100"></button>
    </div>
    <button class="i-theme-workflow:delete w-4 h-4 opacity-60 hover:opacity-100"></button>
  </div>
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(var(--theme-text-rgb), 0.24);
    border-radius: 10px;
  }
</style>
