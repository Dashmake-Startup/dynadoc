<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { fade } from 'svelte/transition';
  /* ... imports remain the same ... */
  import Color from './components/Color.svelte'
  import Swatches from './components/Swatches.svelte'
  import Gradients from './components/Gradients.svelte'
  import Patterns from './components/Patterns.svelte'
  import Properties from './components/Properties.svelte'
  import Adjustments from './components/Adjustments.svelte'
  import Libraries from './components/Libraries.svelte'
  import Layers from './components/Layers.svelte'
  import Channels from './components/Channels.svelte'
  import Paths from './components/Paths.svelte'

  // --- Runes: State Management ---
  let activeTopTab = $state('Color');
  let activeBottomTab = $state('Properties');
  let activeLayersTab = $state('Layers');

  const topTabs = ['Color', 'Swatches', 'Gradients', 'Patterns'];
  const topTabComponents = { Color, Swatches, Gradients, Patterns };

  const bottomTabs = ['Properties', 'Adjustments', 'Libraries'];
  const bottomTabComponents = { Properties, Adjustments, Libraries };

  const layersTabs = ['Layers', 'Channels', 'Paths'];
  const layersTabComponents = { Layers, Channels, Paths };
</script>

<aside class="adobe-sidebar w-full h-full flex flex-col bg-base-100 border-l border-black/40 select-none">
  
  <section class="panel-group flex-shrink-0">
    <header class="tab-header">
      {#each topTabs as tab}
        <button 
          class="tab-btn" 
          class:active={activeTopTab === tab}
          onclick={() => activeTopTab = tab}
        >
          {tab}
          {#if activeTopTab === tab}
            <div class="active-indicator" in:fade></div>
          {/if}
        </button>
      {/each}
    </header>
    
    <div class="panel-content h-64 overflow-auto custom-scrollbar">
      <svelte:component this={topTabComponents[activeTopTab]} />
    </div>
  </section>

  <section class="panel-group flex-shrink-0 border-t border-black/20">
    <header class="tab-header">
      {#each bottomTabs as tab}
        <button 
          class="tab-btn" 
          class:active={activeBottomTab === tab}
          onclick={() => activeBottomTab = tab}
        >
          {tab}
          {#if activeBottomTab === tab}
            <div class="active-indicator" in:fade></div>
          {/if}
        </button>
      {/each}
      <div class="header-actions">
        <i class="ph-bold ph-plus-circle"></i>
        <i class="ph-bold ph-dots-three-vertical"></i>
      </div>
    </header>

    <div class="panel-content h-72 overflow-auto custom-scrollbar">
      <svelte:component this={bottomTabComponents[activeBottomTab]} />
    </div>
  </section>

  <section class="panel-group flex-grow border-t border-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
    <header class="tab-header">
      {#each layersTabs as tab}
        <button 
          class="tab-btn" 
          class:active={activeLayersTab === tab}
          onclick={() => activeLayersTab = tab}
        >
          {tab}
          {#if activeLayersTab === tab}
            <div class="active-indicator" in:fade></div>
          {/if}
        </button>
      {/each}
      <div class="header-actions">
        <i class="ph-bold ph-magnifying-glass"></i>
        <i class="ph-bold ph-trash"></i>
      </div>
    </header>

    <div class="panel-content h-full overflow-auto custom-scrollbar">
      <svelte:component this={layersTabComponents[activeLayersTab]} />
    </div>
  </section>

</aside>

<style>
  /* 🟢 ADOBE 2025 DESIGN SYSTEM (SPECTRUM 2) */
  
  .adobe-sidebar {
    font-family: var(--brand-font-sans);
    /* Subtle inner glow for depth */
    box-shadow: inset 1px 0 0 rgba(255,255,255,0.02);
  }

  .panel-group {
    @apply flex flex-col;
  }

  /* Glassy Header Style */
  .tab-header {
    @apply flex h-9 items-center bg-[var(--color-base-200)] border-b border-black/20 px-1;
  }

  .tab-btn {
    @apply relative h-full px-3 text-[11px] text-[var(--color-base-content)]/40 
           hover:text-[var(--color-base-content)]/80 transition-all duration-200 cursor-pointer;
    letter-spacing: 0.02em;
  }

  .tab-btn.active {
    @apply text-[var(--color-base-content)];
  }

  /* The "Anchor" Indicator */
  .active-indicator {
    @apply absolute bottom-0 left-0 right-0 h-[2px] bg-primary;
    /* box-shadow: 0 -2px 6px rgba(var(--bg-primary-rgb)); */
    /* box-shadow: 0 -2px 6px rgba(2, 101, 210, 0.4); */
  }

  .header-actions {
    @apply ml-auto flex items-center gap-2 px-2 text-[var(--color-base-content)]/20;
  }

  .header-actions i {
    @apply text-sm hover:text-[var(--color-base-content)]/60 cursor-pointer transition-colors;
  }

  .panel-content {
    @apply bg-[var(--color-base-100)] p-2;
  }

  /* Adobe Custom Scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.1);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.2);
  }
</style>