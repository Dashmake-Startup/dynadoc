

<script lang="ts">
  import { _ } from 'svelte-i18n'
  /* 
  The Properties Panel in Photoshop 2025 is the most complex tab because it is context-sensitive. It changes entirely depending on whether you have a Pixel Layer, a Shape, or Text selected.
  */
  // --- SVELTE 5 STATE ---
  let selectionType = $state('pixel'); // 'pixel', 'shape', 'text'
  
  // Transform State
  let transform = $state({
    x: 0, y: 0,
    w: 1920, h: 1080,
    rotation: 0,
    flipX: false, flipY: false
  });

  // Collapsible sections state
  let sections = $state({
    transform: true,
    align: true,
    quickActions: true
  });

  const toggleSection = (key: string) => sections[key] = !sections[key];
</script>

<div class="w-70 bg-base-200 flex flex-col h-full text-xs text-base-content/80 border-l border-base-content/10 select-none">
  
  <!-- <div class="flex gap-4 px-3 pt-3 border-b bg-base-400">
    <span class="border-b-2 border-white pb-1 text-base-content cursor-pointer">Properties</span>
    <span class="pb-1 hover:text-base-content cursor-pointer opacity-60">Adjustments</span>
    <span class="pb-1 hover:text-base-content cursor-pointer opacity-60">Libraries</span>
  </div> -->

  <div class="flex-grow overflow-y-auto custom-scrollbar">
    
    <div class="border-b border-base-content/10">
      <button 
        onclick={() => toggleSection('transform')}
        class="flex items-center w-full p-2 hover:bg-base-content/8 font-bold text-[10px] uppercase tracking-wider"
      >
        <div class="i-theme-workflow:chevron-right w-3 h-3 mr-1 transition-transform {sections.transform ? 'rotate-90' : ''}"></div>
        {$_('Transform')}
      </button>

      {#if sections.transform}
        <div class="p-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <div class="flex items-center gap-2">
            <span class="opacity-50 w-3">{$_('X')}</span>
            <input type="number" bind:value={transform.x} class="prop-input" />
          </div>
          <div class="flex items-center gap-2">
            <span class="opacity-50 w-3">{$_('Y')}</span>
            <input type="number" bind:value={transform.y} class="prop-input" />
          </div>
          <div class="flex items-center gap-2">
            <span class="opacity-50 w-3">{$_('W')}</span>
            <input type="number" bind:value={transform.w} class="prop-input" />
          </div>
          <div class="flex items-center gap-2">
            <span class="opacity-50 w-3">{$_('H')}</span>
            <input type="number" bind:value={transform.h} class="prop-input" />
          </div>
          <div class="flex items-center gap-2">
            <div class="i-theme-workflow:rotate-left w-3 h-3 opacity-50"></div>
            <input type="number" bind:value={transform.rotation} class="prop-input" />
          </div>
          <div class="flex gap-1">
            <button class="prop-btn flex-1"><div class="i-theme-workflow:reflect-horizontal w-4 h-4"></div></button>
            <button class="prop-btn flex-1"><div class="i-theme-workflow:reflect-vertical w-4 h-4"></div></button>
          </div>
        </div>
      {/if}
    </div>

    <div class="border-b border-base-content/10">
      <button 
        onclick={() => toggleSection('align')}
        class="flex items-center w-full p-2 hover:bg-base-content/8 font-bold text-[10px] uppercase tracking-wider"
      >
        <div class="i-theme-workflow:chevron-right w-3 h-3 mr-1 transition-transform {sections.align ? 'rotate-90' : ''}"></div>
        {$_('Align and Distribute')}
      </button>

      {#if sections.align}
        <div class="p-3">
          <div class="grid grid-cols-6 gap-1 mb-4">
            <button class="prop-btn"><div class="i-theme-workflow:align-left w-4 h-4"></div></button>
            <button class="prop-btn"><div class="i-theme-workflow:align-center-horizontal w-4 h-4"></div></button>
            <button class="prop-btn"><div class="i-theme-workflow:align-right w-4 h-4"></div></button>
            <div class="w-[1px] h-4 bg-base-content/20 mx-auto self-center"></div>
            <button class="prop-btn"><div class="i-theme-workflow:align-top w-4 h-4"></div></button>
            <button class="prop-btn"><div class="i-theme-workflow:align-center-vertical w-4 h-4"></div></button>
          </div>
          
          <button class="w-full py-1 border border-base-content/20 rounded-sm hover:bg-base-content/10 text-[11px]">
            {$_('Align to: Selection')}
          </button>
        </div>
      {/if}
    </div>

    <div class="border-b border-base-content/10">
      <button 
        onclick={() => toggleSection('quickActions')}
        class="flex items-center w-full p-2 hover:bg-base-content/8 font-bold text-[10px] uppercase tracking-wider"
      >
        <div class="i-theme-workflow:chevron-right w-3 h-3 mr-1 transition-transform {sections.quickActions ? 'rotate-90' : ''}"></div>
        {$_('Quick Actions')}
      </button>

      {#if sections.quickActions}
        <div class="p-3 flex flex-col gap-2">
          <button class="action-btn">
            <div class="i-theme-workflow:image-remove-background w-4 h-4 mr-2"></div>
            {$_('Remove Background')}
          </button>
          <button class="action-btn">
            <div class="i-theme-workflow:select-object w-4 h-4 mr-2"></div>
            {$_('Select Subject')}
          </button>
        </div>
      {/if}
    </div>

  </div>
</div>

<style lang="postcss">
  .prop-input {
    @apply w-full bg-[var(--color-base-100)] border border-[var(--color-base-content)]/15 rounded-sm px-1 py-0.5 text-[var(--color-base-content)] outline-none focus:border-blue-500;
  }

  .prop-btn {
    @apply flex items-center justify-center p-1.5 hover:bg-[var(--color-base-100)]/10 rounded-sm transition-colors text-[var(--color-base-content)] border border-transparent active:bg-[var(--color-base-100)]/15;
  }

  .action-btn {
    @apply flex items-center justify-center w-full py-2 bg-[var(--color-base-100)]/10 hover:bg-[var(--color-base-100)]/15 border border-[var(--color-base-content)]/10 rounded-md text-[11px] font-medium transition-colors;
  }

  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--theme-text-rgb), 0.24); border-radius: 10px; }
</style>
