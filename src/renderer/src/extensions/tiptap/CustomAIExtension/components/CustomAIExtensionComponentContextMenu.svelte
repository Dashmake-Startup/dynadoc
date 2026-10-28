<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()
  
  let {
    status = 'idle',
    versionCount = 1,
    currentVersion = 1,
    temperature = 0.7
  } = $props()

  // Innovative State: Creativity/Tone Slider
  const emitTemp = () => dispatch('temperatureChange', { value: temperature })
</script>

<div class="adobe-ai-orchestrator" class:is-loading={status === 'drafting'}>
  <div class="spark-status">
    <i class="ph-fill ph-sparkle"></i>
    {#if status === 'drafting'}
      <div class="pulse-ring"></div>
    {/if}
  </div>

  <div class="v-sep"></div>

  <div class="intent-group">
    <div class="version-scrub" title={$_('Scrub through generated versions')}>
      <button class="scrub-btn" disabled={currentVersion <= 1} on:click={() => dispatch('prevVersion')}>
        <i class="ph-bold ph-caret-left"></i>
      </button>
      <span class="version-label">{currentVersion}/{versionCount}</span>
      <button class="scrub-btn" disabled={currentVersion >= versionCount} on:click={() => dispatch('nextVersion')}>
        <i class="ph-bold ph-caret-right"></i>
      </button>
    </div>

    <div class="v-sep"></div>

    <div class="action-strip">
      <button 
        class="menu-btn primary" 
        title={$_('Regenerate with current settings')}
        on:click={() => dispatch('regenerate')}
      >
        <i class="ph-bold ph-arrows-clockwise"></i>
        <span class="btn-text">{$_('REGEN')}</span>
      </button>

      <button class="menu-btn" title={$_('View Source Prompt & Parameters')} on:click={() => dispatch('showPrompt')}>
        <i class="ph-bold ph-terminal-window"></i>
      </button>

      <div class="tone-control group">
        <i class="ph-bold ph-sliders-horizontal"></i>
        <div class="tone-popover">
          <span class="eyebrow">{$_('CREATIVITY_INDEX')}</span>
          <input type="range" min="0" max="1" step="0.1" bind:value={temperature} on:input={emitTemp} />
          <div class="flex justify-between text-[8px] opacity-40">
            <span>{$_('PRECISE')}</span>
            <span>{$_('CREATIVE')}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="v-sep"></div>

  <button class="accept-btn" title={$_('Accept and Merge into Document')} on:click={() => dispatch('accept')}>
    <i class="ph-bold ph-check"></i>
  </button>
</div>

<style lang="postcss">
  .adobe-ai-orchestrator {
    @apply flex items-center h-8 px-2 bg-[var(--color-base-100)] border border-white/10 rd-[4px]
           shadow-[0_12px_24px_rgba(0,0,0,0.5)] transition-all animate-in fade-in zoom-in duration-200;
    /* Inner technical glow */
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 24px rgba(0,0,0,0.5);
  }

  /* --- Technical Elements --- */
  .v-sep { @apply w-px h-4 bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] mx-2; }
  .eyebrow { @apply text-[8px] font-900 tracking-[0.2em] text-[var(--color-base-300)] mb-2 block; }

  /* --- Spark Anchor --- */
  .spark-status {
    @apply relative size-6 flex items-center justify-center text-[var(--color-base-300)] text-[14px];
  }
  .pulse-ring {
    @apply absolute inset-0 rd-full border border-[var(--color-base-300)] animate-ping opacity-40;
  }

  /* --- Version Scrubber --- */
  .version-scrub {
    @apply flex items-center gap-2 bg-black/20 px-1.5 rd-[3px] border border-white/5 h-6;
  }
  .version-label { @apply text-[9px] font-mono text-[var(--color-base-content)]/40 min-w-[24px] text-center; }
  .scrub-btn { @apply text-[var(--color-base-content)]/20 hover:text-[var(--color-base-300)] disabled:opacity-10 transition-colors; }

  /* --- Action Buttons --- */
  .intent-group { @apply flex items-center; }
  .action-strip { @apply flex items-center gap-1; }

  .menu-btn {
    @apply h-6 px-2 flex items-center gap-2 rd-[2px] text-[var(--color-base-content)]/40 
           hover:(bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-[var(--color-base-content)]) transition-all;
  }
  .menu-btn.primary { @apply text-[var(--color-base-300)] hover:bg-[color-mix(in_srgb,var(--color-base-300)_10%,transparent)]; }
  .btn-text { @apply text-[9px] font-900 tracking-widest; }

  /* --- Innovative Tone Popover --- */
  .tone-control { @apply relative h-6 w-6 flex items-center justify-center text-[var(--color-base-content)]/30 cursor-pointer; }
  .tone-popover {
    @apply absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-32 p-3 
           bg-[var(--color-base-100)] border border-white/10 rd-[4px] shadow-2xl
           opacity-0 translate-y-2 pointer-events-none transition-all;
  }
  .tone-control:hover .tone-popover { @apply opacity-100 translate-y-0 pointer-events-auto; }

  /* Custom Range Style */
  input[type='range'] {
    @apply w-full h-1 bg-black/40 rd-full appearance-none mb-1;
    &::-webkit-slider-thumb { @apply appearance-none size-3 bg-[var(--color-base-300)] rd-full cursor-pointer border-2 border-[#252525]; }
  }

  /* --- Accept Action --- */
  .accept-btn {
    @apply size-6 flex items-center justify-center rd-full bg-[color-mix(in_srgb,var(--color-base-300)_10%,transparent)] text-[var(--color-base-300)]
           hover:(bg-[var(--color-base-300)] text-black) transition-all;
  }

  /* --- Loading State --- */
  .is-loading { @apply border-[var(--color-base-300)]/30; }
</style>
