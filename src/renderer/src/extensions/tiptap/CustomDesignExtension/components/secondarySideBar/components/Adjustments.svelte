

<script lang="ts">
  import { _ } from 'svelte-i18n'
  /* 
  The Adjustments Tab in Photoshop 2025 is divided into two main parts: Presets (which are AI-powered or curated looks) and the classic Adjustments icons grid.
  */
  // --- SVELTE 5 STATE ---
  let expandedPresets = $state(true)
  let expandedIndividual = $state(true)

  // Preset categories data
  const presetCategories = [
    { name: 'Portraits', color: 'bg-blue-900/30' },
    { name: 'Landscapes', color: 'bg-green-900/30' },
    { name: 'Photo Repair', color: 'bg-amber-900/30' },
    { name: 'Creative', color: 'bg-purple-900/30' },
    { name: 'Black & White', color: 'bg-gray-700/30' },
    { name: 'Cinematic', color: 'bg-red-900/30' }
  ]

  // Classic Adjustments Icons mapping
  const adjustments = [
    { id: 'brightness', icon: 'brightness-contrast', label: 'Brightness/Contrast' },
    { id: 'levels', icon: 'levels', label: 'Levels' },
    { id: 'curves', icon: 'curves', label: 'Curves' },
    { id: 'exposure', icon: 'exposure', label: 'Exposure' },
    { id: 'vibrance', icon: 'vibrance', label: 'Vibrance' },
    { id: 'hue', icon: 'hue-saturation', label: 'Hue/Saturation' },
    { id: 'color-balance', icon: 'color-balance', label: 'Color Balance' },
    { id: 'bw', icon: 'black-and-white', label: 'Black & White' },
    { id: 'photo-filter', icon: 'photo-filter', label: 'Photo Filter' },
    { id: 'channel-mixer', icon: 'channel-mixer', label: 'Channel Mixer' },
    { id: 'color-lookup', icon: 'color-lookup', label: 'Color Lookup' },
    { id: 'invert', icon: 'invert', label: 'Invert' },
    { id: 'posterize', icon: 'posterize', label: 'Posterize' },
    { id: 'threshold', icon: 'threshold', label: 'Threshold' },
    { id: 'gradient-map', icon: 'gradient-map', label: 'Gradient Map' },
    { id: 'selective-color', icon: 'selective-color', label: 'Selective Color' }
  ]

  const handleAdjust = (id: string) => {
    console.log(`Creating adjustment layer: ${id}`)
    // Logic to add adjustment layer to your store would go here
  }
</script>

<div
  class=" bg-base-200 flex flex-col h-full text-xs text-base-content/80 border-l border-base-content/10 select-none"
>
  <div class="flex-grow overflow-y-auto custom-scrollbar">
    <div class="border-b border-base-content/10">
      <button
        onclick={() => (expandedPresets = !expandedPresets)}
        class="flex items-center w-full p-2 hover:bg-base-content/8 font-bold text-[10px] uppercase tracking-wider"
      >
        <div
          class="i-theme-workflow:chevron-right w-3 h-3 mr-1 transition-transform {expandedPresets
            ? 'rotate-90'
            : ''}"
        ></div>
        {$_('Presets')}
      </button>

      {#if expandedPresets}
        <div class="p-3 grid grid-cols-2 gap-2">
          {#each presetCategories as category}
            <button
              class="relative h-16 rounded overflow-hidden group border border-base-content/15 hover:border-base-content/30"
            >
              <div
                class="absolute inset-0 {category.color} group-hover:scale-110 transition-transform"
              ></div>
              <div
                class="absolute inset-0 flex items-end p-1.5 bg-gradient-to-t from-black/80 to-transparent"
              >
                <span class="text-[10px] font-medium text-base-content">{category.name}</span>
              </div>
            </button>
          {/each}
          <button
            class="col-span-2 py-1.5 text-center text-base-content/45 hover:text-base-content border border-dashed border-base-content/20 rounded mt-1"
          >
            {$_('More Presets...')}
          </button>
        </div>
      {/if}
    </div>

    <div class="border-b border-base-content/10">
      <button
        onclick={() => (expandedIndividual = !expandedIndividual)}
        class="flex items-center w-full p-2 hover:bg-base-content/8 font-bold text-[10px] uppercase tracking-wider"
      >
        <div
          class="i-theme-workflow:chevron-right w-3 h-3 mr-1 transition-transform {expandedIndividual
            ? 'rotate-90'
            : ''}"
        ></div>
        {$_('Adjustments')}
      </button>

      {#if expandedIndividual}
        <div class="p-3 grid grid-cols-4 gap-y-4 justify-items-center">
          {#each adjustments as adj}
            <button
              onclick={() => handleAdjust(adj.id)}
              class="group flex flex-col items-center gap-1 w-full"
              title={adj.label}
            >
              <div
                class="w-8 h-8 flex items-center justify-center rounded-sm hover:bg-base-content/10 transition-colors border border-transparent hover:border-base-content/20"
              >
                <div
                  class="i-theme-workflow:{adj.icon} w-6 h-6 text-base-content/80 group-hover:text-base-content"
                ></div>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <div class="p-3 text-[10px] leading-relaxed text-base-content/45 italic border-t border-base-content/10">
    {$_('Select an adjustment icon to create a new adjustment layer.')}
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
