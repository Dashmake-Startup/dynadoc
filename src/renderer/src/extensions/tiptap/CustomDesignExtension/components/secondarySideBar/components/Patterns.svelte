

<script lang="ts">
  import { _ } from 'svelte-i18n'
  /* 
  The Patterns Tab is structurally similar to Swatches and Gradients but presents its data as tiling image thumbnails arranged in grids within folders.
  */
  // --- PATTERN DATA (Using small base64 images for demo tiling) ---
  // A real app would use URLs to pattern image assets.
  const dotsPattern =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAABdJREFUGFdjZICC/2AGkxhoAOQQleQAAAu7A/210p8kAAAAAElFTkSuQmCC' // Tiny 4x4 dots
  const stripePattern =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAABVJREFUGFdjZGBg+A+EDAwMgIEBAAA+AwEDBRE70QAAAABJRU5ErkJggg==' // Tiny 4x4 stripes
  const checkPattern =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAAXNSR0IArs4c6QAAACNJREFUGFdjZICC/3gwAwygLCYcCmEcpIgJzQJ0hZSKBwAAjxcH9xS2T0EAAAAASUVORK5CYII=' // 8x8 checkered

  const patternGroupsData = [
    {
      name: 'Basic Textures',
      open: true,
      items: [
        { name: 'Micro Dots', src: dotsPattern },
        { name: 'Fine Stripes', src: stripePattern },
        { name: 'Checkerboard', src: checkPattern },
        { name: 'Micro Dots 2', src: dotsPattern },
        { name: 'Fine Stripes 2', src: stripePattern }
      ]
    },
    {
      name: 'Nature',
      open: false,
      items: [
        // In a real app, these would be images of leaves, water, bark, etc.
        { name: 'Bark Base', src: checkPattern },
        { name: 'Water Ripple', src: stripePattern }
      ]
    }
  ]

  // --- SVELTE 5 STATE ---
  let groups = $state(patternGroupsData)
  // Track selected pattern by its source URL string
  let activePatternSrc = $state(patternGroupsData[0].items[0].src)

  let recentPatterns = $state([checkPattern, dotsPattern])

  const selectPattern = (src: string) => {
    activePatternSrc = src
    // Add to recents if unique
    if (!recentPatterns.includes(src)) {
      recentPatterns = [src, ...recentPatterns.slice(0, 4)]
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
        placeholder={$_('Search patterns...')}
        class="bg-transparent border-none outline-none text-[11px] w-full text-base-content placeholder:text-base-content/30"
      />
    </div>
  </div>

  <div class="flex-grow overflow-y-auto custom-scrollbar px-2">
    <div class="mb-4">
      <div class="text-[10px] uppercase opacity-50 mb-2 font-bold px-1">{$_('Recent')}</div>
      <div class="flex gap-2 px-1">
        {#each recentPatterns as src}
          <button
            onclick={() => selectPattern(src)}
            class="w-10 h-10 border border-base-content/10 hover:border-base-content/50 transition-all rounded-sm shadow-sm bg-repeat"
            style:background-image="url({src})"
            title={$_('Recent Pattern')}
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
          <div class="transition-transform duration-100 {group.open ? 'rotate-90' : ''}">
            <div class="i-theme-workflow:chevron-right w-3 h-3"></div>
          </div>
          <div class="i-theme-workflow:folder-pattern w-3.5 h-3.5 mx-1.5 opacity-70"></div>
          <span class="flex-grow text-left">{group.name}</span>
          <span class="opacity-40 text-[10px]">{group.items.length}</span>
        </button>

        {#if group.open}
          <div class="grid grid-cols-5 gap-2 p-y-2 p-l-6 pr-2">
            {#each group.items as item}
              <button
                onclick={() => selectPattern(item.src)}
                class="relative w-10 h-10 border border-base-content/10 hover:border-base-content/50 hover:scale-105 transition-all rounded-sm shadow-sm bg-repeat group"
                class:border-blue-500={activePatternSrc === item.src}
                class:ring-1={activePatternSrc === item.src}
                class:ring-blue-500={activePatternSrc === item.src}
                style:background-image="url({item.src})"
                title={item.name}
              >
                {#if activePatternSrc === item.src}
                  <div class="absolute bottom-0 right-0 bg-blue-500 text-base-content p-[1px]">
                    <div class="i-theme-workflow:check w-2 h-2"></div>
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="p-2 border-t border-base-content/10 flex justify-between items-center px-4">
    <div class="flex gap-4 opacity-60">
      <button
        class="i-theme-workflow:folder-add w-4 h-4 hover:opacity-100"
        title={$_('New Pattern Group')}
      ></button>
      <button
        class="i-theme-workflow:pattern-add w-4 h-4 hover:opacity-100"
        title={$_('Create New Pattern')}
      ></button>
    </div>
    <button
      class="i-theme-workflow:delete w-4 h-4 opacity-60 hover:opacity-100"
      title={$_('Delete Pattern')}
    ></button>
  </div>
</div>

<style>
  /* Same scrollbar style as other tabs for consistency */
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
