<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import Pickr from '@simonwep/pickr'
  import '@simonwep/pickr/dist/themes/nano.min.css' // Use 'nano' for that Adobe look
  import { colorActions, colorStore } from './stores/color.store'

  // --- Runes: Props ---
  let {
    __activeColor = '#0265D2',
    __onSelect = (color: string) => {},
    __mode = 'text',
    __closeContextMenu = () => {}
  } = $props<{
    __activeColor: string
    __onSelect: (color: string) => void
    __mode: 'text' | 'background' | 'highlight'
  }>()

  // Svelte 5 style access
  let activeColors = $derived($colorStore.selection)
  let _activeColor = $derived(activeColors[__mode] || __activeColor)
  // let activeColors = $derived($colorStore.selection);
  let history = $derived($colorStore.history)

  function onColorChange(newHex: string) {
    // This updates the store, the history, and persists to LocalStorage
    // colorActions.setColor(__mode, newHex);
    // colorActions.setColor('text', newHex);
  }

  // --- State ---
  let pickrContainer = $state<HTMLElement | null>(null)
  let pickrInstance: Pickr | null = null
  let recentColors = $state(['#FF4B4B', '#0265D2', '#27C34B', '#FACC15', '#A855F7'])

  const swatches = [
    '#000000',
    '#4D4D4D',
    '#999999',
    '#E6E6E6',
    '#FFFFFF',
    '#FF4B4B',
    '#FF9F1C',
    '#FACC15',
    '#27C34B',
    '#0265D2'
  ]

  /* function handleQuickSelect(color: string) {
    __onSelect(color)
    _activeColor = color
    colorActions.setColor(__mode, color)
    pickrInstance?.setColor(color)
  }
 */
  function handleQuickSelect(color: string | null) {
    const finalColor = color || 'transparent'
    _activeColor = finalColor
    __onSelect(finalColor)
    __closeContextMenu?.()

    // Update the store so the toolbar indicator changes immediately
    colorActions.setColor(__mode, finalColor)

    if (color && pickrInstance) {
      pickrInstance.setColor(color)
    }
  }

  onMount(() => {
    if (pickrContainer) {
      pickrInstance = Pickr.create({
        el: pickrContainer,
        theme: 'nano', // Cleanest theme for Adobe layouts
        default: _activeColor,
        swatches: swatches,
        comparison: false, // Keep it high-density
        components: {
          preview: true,
          opacity: __mode !== 'text', // No opacity for text, allowed for highlights
          hue: true,
          interaction: {
            hex: true,
            rgba: false,
            input: true,
            clear: true,
            save: true
          }
        }
      })

      pickrInstance
        .on('change', (color: any) => {
          __onSelect(color.toHEXA().toString())
          __closeContextMenu?.()
        })
        .on('save', (color: any) => {
          const hex = color.toHEXA().toString()
          if (!recentColors.includes(hex)) {
            recentColors = [hex, ...recentColors.slice(0, 4)]
          }
          __closeContextMenu?.()
        })
    }
  })

  onDestroy(() => {
    pickrInstance?.destroyAndRemove()
  })
</script>

<div
  class="w-72 bg-base-100 border border-white/10 rounded-lg shadow-2xl flex flex-col font-sans overflow-hidden"
>
  <div class="px-3 py-2 bg-base-200 border-b border-black/20 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <i class="ph-bold ph-palette text-primary text-[14px]"></i>
      <span class="text-[10px] font-black uppercase tracking-widest text-base-content/50">
        {__mode} Spectrum
      </span>
    </div>
    <div
      class="size-3 rounded-full shadow-inner border border-white/10"
      style="background: {_activeColor}"
    ></div>
  </div>

  <div class="p-4 space-y-5">
    <button
      onclick={() => handleQuickSelect(null)}
      class="w-full flex items-center justify-between p-2 hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rounded-md border border-white/5 transition-all group"
    >
      <!-- <button
      onclick={() => handleQuickSelect('inherit')}
      class="w-full flex items-center justify-between p-2 hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rounded-md border border-white/5 transition-all group"
    > -->
      <div class="flex items-center gap-3">
        <div
          class="size-5 rounded border border-white/20 bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] flex items-center justify-center relative overflow-hidden"
        >
          <div class="absolute w-[120%] h-[1.5px] bg-red-500 rotate-45"></div>
        </div>
        <span
          class="text-[11px] font-bold text-base-content/80 group-hover:text-primary transition-colors"
          >{$_('Default Color')}</span
        >
      </div>
      <i
        class="ph-bold ph-arrow-counter-clockwise text-base-content/20 group-hover:text-base-content text-[12px]"
      ></i>
    </button>

    <div>
      <span
        class="text-[9px] font-black text-base-content/20 uppercase tracking-[0.15em] block mb-3"
        >{$_('System Palette')}</span
      >
      <div class="grid grid-cols-5 gap-2">
        {#each swatches as color}
          <button
            onclick={() => handleQuickSelect(color)}
            class="group relative size-9 rounded-sm transition-all hover:scale-105"
            style="background: {color}"
          >
            <!-- {#if _activeColor.toString().toLowerCase() === color.toLowerCase()}
              <div class="absolute inset-0 border-2 border-primary ring-1 ring-black/50"></div>
            {/if} -->
            {#if _activeColor?.toLowerCase() === color.toLowerCase()}
              <div class="absolute inset-0 border-2 border-primary ring-1 ring-black/50"></div>
              <div
                class="absolute inset-0 border-2 border-[#0265D2] flex items-center justify-center"
              >
                <i class="ph-bold ph-check text-[10px] text-base-content shadow-md"></i>
              </div>
            {/if}
            <div
              class="absolute inset-0 opacity-0 group-hover:opacity-100 border border-white/40 pointer-events-none"
            ></div>
          </button>
        {/each}
      </div>
    </div>

    <div class="pickr-wrapper pt-2 border-t border-white/5">
      <span
        class="text-[9px] font-black text-base-content/20 uppercase tracking-[0.15em] block mb-3"
        >{$_('Custom Mixer')}</span
      >
      <div bind:this={pickrContainer} class="theme-pickr"></div>
    </div>

    <div class="flex items-center justify-between">
      <span class="text-[9px] font-black text-base-content/20 uppercase tracking-[0.15em]"
        >{$_('Recent')}</span
      >
      <div class="flex gap-1.5">
        {#each recentColors as color}
          <button
            onclick={() => handleQuickSelect(color)}
            class="size-5 rounded-full border border-white/5 hover:ring-1 ring-primary transition-all"
            style="background: {color}"
          ></button>
        {/each}
      </div>
    </div>
  </div>

  <div class="px-4 py-2 bg-black/20 flex items-center justify-between">
    <!-- <div class="flex items-center gap-2">
       <i class="ph-bold ph-eyedropper text-base-content/40 hover:text-primary cursor-pointer"></i>
       <span class="text-[9px] font-mono text-base-content/20">A11Y CHECK: <span class="text-green-500">PASS</span></span>
     </div> -->
    <button
      class="text-[10px] font-black uppercase text-primary hover:text-base-content transition-colors"
      >{$_('Apply')}</button
    >
  </div>
</div>

<style>
  /* Override Pickr Nano to fit Adobe 2025 */
  :global(.pickr) {
    width: 100%;
    height: 32px;
  }

  :global(.pcr-button) {
    width: 100% !important;
    height: 100% !important;
    border-radius: 4px !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
  }

  :global(.pcr-app) {
    background: #2d2d2d !important;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    border-radius: 8px !important;
  }

  :global(.pcr-interaction input) {
    background: var(--color-base-200) !important;
    color: #fff !important;
    font-family: 'Fira Code', monospace !important;
    font-size: 11px !important;
    border-radius: 4px !important;
  }

  :global(.pcr-interaction .pcr-save) {
    background: #0265d2 !important; /* Adobe Primary */
    font-size: 10px !important;
    font-weight: 800 !important;
    text-transform: uppercase !important;
  }
</style>
