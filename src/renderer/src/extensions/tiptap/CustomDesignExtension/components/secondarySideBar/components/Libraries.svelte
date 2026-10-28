

<script lang="ts">
  import { _ } from 'svelte-i18n'
  /* 
  The Libraries Tab in Photoshop 2025 is the bridge to Adobe Creative Cloud. 
  It features a library selector (dropdown), a search bar for assets, and a categorized
   view of synced colors, character styles, and graphics.
  */
  // --- SVELTE 5 STATE ---
  let selectedLibrary = $state('My Library')
  let searchQuery = $state('')
  let isSyncing = $state(false)

  // Asset Data Mockup
  const assetGroups = [
    {
      name: 'Colors',
      type: 'color',
      items: ['#FF5733', '#33FF57', '#3357FF', '#F333FF']
    },
    {
      name: 'Character Styles',
      type: 'text',
      items: [
        { name: 'Heading 1', font: 'Inter Bold 24px' },
        { name: 'Body Text', font: 'Inter Regular 14px' }
      ]
    },
    {
      name: 'Graphics',
      type: 'image',
      items: [
        { name: 'Logo_Final.svg', thumb: 'https://placehold.co/80x80/3c3c3c/white?text=Logo' },
        { name: 'Icon_Set.png', thumb: 'https://placehold.co/80x80/3c3c3c/white?text=Icons' }
      ]
    }
  ]

  const triggerSync = () => {
    isSyncing = true
    setTimeout(() => (isSyncing = false), 2000)
  }
</script>

<div
  class="bg-base-200 flex flex-col h-full text-xs text-base-content/80 border-l border-base-content/10 select-none"
>
  <div class="p-2 flex flex-col gap-2 border-b border-base-content/10">
    <button
      class="flex items-center justify-between w-full px-2 py-1.5 bg-base-100 border border-base-content/10 rounded-sm hover:bg-base-content/10"
    >
      <span class="truncate font-medium">{selectedLibrary}</span>
      <div class="i-theme-workflow:chevron-down w-3 h-3"></div>
    </button>

    <div class="flex items-center bg-base-100 border border-base-content/15 px-2 py-1 rounded-sm">
      <div class="i-theme-workflow:search w-3 h-3 mr-2 opacity-50"></div>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder={$_('Search current library...')}
        class="bg-transparent border-none outline-none text-[11px] w-full text-base-content placeholder:text-base-content/30"
      />
    </div>
  </div>

  <div class="flex-grow overflow-y-auto custom-scrollbar p-2">
    {#each assetGroups as group}
      <div class="mb-6">
        <div class="flex items-center justify-between mb-2 px-1">
          <span class="text-[10px] uppercase font-bold tracking-widest opacity-60"
            >{group.name}</span
          >
          <div
            class="i-theme-workflow:more w-3 h-3 opacity-40 hover:opacity-100 cursor-pointer"
          ></div>
        </div>

        <div class="grid grid-cols-4 gap-2">
          {#if group.type === 'color'}
            {#each group.items as color}
              <button
                class="w-full aspect-square border border-base-content/10 hover:border-base-content/50 transition-all shadow-sm"
                style:background-color={color.toString()}
                title={color.toString()}
              ></button>
            {/each}
          {:else if group.type === 'text'}
            <div class="col-span-4 flex flex-col gap-1">
              {#each group.items as style}
                <button
                  class="flex flex-col p-2 bg-base-content/8 hover:bg-base-content/12 border border-base-content/10 rounded-sm text-left"
                >
                  <span class="font-bold text-[11px] truncate">{style.name.toString()}</span>
                  <span class="text-[9px] opacity-50">{style.font.toString()}</span>
                </button>
              {/each}
            </div>
          {:else if group.type === 'image'}
            {#each group.items as img}
              <button
                class="col-span-2 group relative border border-base-content/10 hover:border-base-content/50 bg-base-100 rounded-sm overflow-hidden"
              >
                <img
                  src={img.thumb.toString()}
                  alt={img.name.toString()}
                  class="w-full aspect-square object-cover opacity-80 group-hover:opacity-100"
                />
                <div
                  class="absolute bottom-0 left-0 right-0 bg-black/60 p-1 truncate text-[9px] translate-y-full group-hover:translate-y-0 transition-transform"
                >
                  {img.name.toString()}
                </div>
              </button>
            {/each}
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <div class="px-2 py-3 border-t border-base-content/10 bg-base-300/55">
    <button
      class="flex items-center justify-center w-full py-2 bg-primary hover:bg-[#0086ed] text-base-content rounded-full font-bold text-[11px] transition-colors"
    >
      <div class="i-theme-workflow:search-theme-stock w-4 h-4 mr-2"></div>
      {$_('Search Adobe Stock')}
    </button>
  </div>

  <div class="p-2 border-t border-base-content/10 flex justify-between items-center px-4 bg-base-200">
    <div class="flex gap-4 opacity-60">
      <button
        onclick={triggerSync}
        class="i-theme-workflow:cloud-upload w-4 h-4 hover:opacity-100 {isSyncing
          ? 'animate-pulse33 text-blue-400'
          : ''}"
      ></button>
      <button class="i-theme-workflow:add w-4 h-4 hover:opacity-100"></button>
    </div>
    <span class="text-[9px] opacity-40">{$_('Up to date')}</span>
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
