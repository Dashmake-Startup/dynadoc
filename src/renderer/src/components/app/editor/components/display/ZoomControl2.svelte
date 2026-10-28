<script lang="ts">
  import { _ } from 'svelte-i18n'
  // Assuming $zoom is a Svelte Store or a passed state
  // If using Svelte 5 runes, replace $zoom with a reactive state variable

  let { zoom = $bindable(100), min = 10, max = 400, step = 10 } = $props()

  const zoomIn = () => {
    if (zoom < max) zoom += step
  }
  const zoomOut = () => {
    if (zoom > min) zoom -= step
  }

  // Generate tick marks for the Adobe track
  let stepsArray = [10, 100, 200, 300, 400]
</script>

{#if true}
  <div
    class="flex flex-col gap-3 p-3 bg-base-200 border bg-base-400 rounded-sm shadow-2xl w-56 text-[#ccc] font-sans select-none"
  >
    <div class="flex items-center justify-between gap-1 h-6">
      <button
        onclick={zoomOut}
        class="w-6 h-full flex items-center justify-center hover:bg-base-200 active:bg-[#454545] rounded-sm transition-colors group"
      >
        <div class="i-theme-workflow:remove w-3.5 h-3.5 opacity-50 group-hover:opacity-100"></div>
      </button>

      <div class="flex-grow h-full relative group">
        <input
          type="text"
          value="{zoom}%"
          onchange={(e) => {
            const val = parseInt(e.currentTarget.value)
            if (!isNaN(val)) zoom = Math.min(Math.max(val, min), max)
          }}
          class="w-full h-full bg-base-100 border border-[#3e3e3e] rounded-sm text-[11px] text-center font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <button
        onclick={zoomIn}
        class="w-6 h-full flex items-center justify-center hover:bg-base-200 active:bg-[#454545] rounded-sm transition-colors group"
      >
        <div class="i-theme-workflow:add w-3.5 h-3.5 opacity-50 group-hover:opacity-100"></div>
      </button>
    </div>

    <div class="flex flex-col px-1">
      <div class="relative h-4 flex items-center">
        <div class="absolute w-full h-[2px] bg-base-100 border-b border-[#3e3e3e]"></div>

        <input type="range" {min} {max} bind:value={zoom} class="theme-range-slider" />
      </div>

      <div class="flex justify-between mt-1 px-[2px]">
        {#each stepsArray as s}
          <div class="flex flex-col items-center gap-1">
            <div class="w-[1px] h-1 bg-[#444]"></div>
            <span class="text-[9px] font-bold text-[#666] uppercase tracking-tighter">
              {s === 100 ? 'Fit' : s}
            </span>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  /* Custom Adobe Slider Styling */
  .theme-range-slider {
    @apply absolute w-full appearance-none bg-transparent cursor-pointer z-10;
  }

  /* The Thumb - Classic Adobe Square Thumb */
  .theme-range-slider::-webkit-slider-thumb {
    @apply appearance-none w-2 h-4 bg-[#bbb] border bg-[var(--color-base-400)] rounded-[1px] hover:bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] active:bg-primary transition-colors shadow-sm;
    margin-top: -1px; /* Center alignment */
  }

  .theme-range-slider::-moz-range-thumb {
    @apply w-2 h-4 bg-[#bbb] border bg-[var(--color-base-400)] rounded-[1px] hover:bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] active:bg-primary transition-colors;
  }

  /* Remove default focuses */
  .theme-range-slider:focus {
    outline: none;
  }
</style>
