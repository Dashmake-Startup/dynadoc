<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { openUpgradePlanModal, type UpgradePlanTier } from '../../../stores/upgradePlanModal.store'

  interface Props {
    title: string;
    message: string;
    highlight?: UpgradePlanTier;
    compact?: boolean;
    featureKey?: string; // Innovative idea: show which specific tech is locked
  }

  let { 
    title, 
    message, 
    highlight = 'pro', 
    compact = false,
    featureKey = "ADVANCED_RENDER_ENGINE" 
  } = $props();

  function handleUpgrade() {
    openUpgradePlanModal({ source: title, highlight })
  }
</script>

<div class="adobe-upgrade-card" class:is-compact={compact}>
  <div class="tech-grid-overlay"></div>

  <div class="flex items-start gap-4 z-10">
    <div class="tier-hex-icon">
      <i class="ph-bold ph-shield-star text-[20px] text-base-300"></i>
      <div class=""></div>
      <!-- <div class="hex-pulse"></div> -->
    </div>

    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-1">
        <span class="adobe-eyebrow">{title}</span>
        <div class="v-divider"></div>
        <span class="feature-code">{$_(featureKey)}</span>
      </div>
      <p class="adobe-message">{message}</p>
    </div>
  </div>

  <div class="flex items-center gap-3 z-10">
    {#if !compact}
      <div class="hidden lg:flex flex-col items-end gap-1 mr-2">
        <span class="text-[8px] font-900 text-base-content/20 uppercase tracking-widest">{$_('Tier Status')}</span>
        <div class="flex gap-1">
          <div class="h-1 w-4 bg-base-300 rd-full"></div>
          <div class="h-1 w-4 bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] rd-full animate-pulse"></div>
        </div>
      </div>
    {/if}

    <button class="adobe-upgrade-btn" onclick={handleUpgrade}>
      <span>{$_('Unlock Tier')}</span>
      <i class="ph-bold ph-lightning"></i>
    </button>
  </div>
</div>

<style lang="postcss">
  .adobe-upgrade-card {
    @apply relative w-full flex items-center justify-between gap-4 p-4 border border-white/10 rd-[6px] overflow-hidden select-none;
    background: var(--theme-surface-1);
    box-shadow: var(--theme-popover-shadow);
  }

  .adobe-upgrade-card.is-compact {
    @apply p-2.5 gap-2;
  }

  /* Technical Grid Background (Adobe Spectrum Style) */
  .tech-grid-overlay {
    @apply absolute inset-0 opacity-[0.03] pointer-events-none;
    background-image: radial-gradient(circle, rgba(var(--theme-text-rgb), 1) 1px, transparent 1px);
    background-size: 12px 12px;
  }

  /* Tier Icon with pulse */
  .tier-hex-icon {
    @apply relative size-10 flex items-center justify-center bg-[var(--color-base-100)]/10 rd-[4px] border border-white/5;
  }
  .hex-pulse {
    @apply absolute inset-0 bg-[color-mix(in_srgb,var(--color-base-300)_10%,transparent)] rd-[4px] animate-ping opacity-40;
  }

  /* Typography Scale */
  .adobe-eyebrow {
    @apply text-[10px] font-900 uppercase tracking-[0.2em] text-[var(--color-base-300)];
  }

  .feature-code {
    @apply text-[9px] font-mono text-[var(--color-base-content)]/20 tracking-tighter;
  }

  .adobe-message {
    @apply text-[12px] font-500 text-[var(--color-base-content)]/50 leading-snug max-w-[400px];
  }

  .v-divider {
    @apply w-px h-2 bg-[var(--color-base-100)]/10;
  }

  /* Adobe Spectrum Button: Solid, High-Contrast */
  .adobe-upgrade-btn {
    @apply flex items-center gap-2 px-4 py-2 bg-[var(--color-base-300)] text-black 
           text-[10px] font-900 uppercase tracking-widest rd-[3px] 
           transition-all hover:(bg-[#00D9C5] shadow-[0_0_20px_rgba(0,190,172,0.4)])
           active:scale-95;
  }

  .is-compact .adobe-upgrade-btn {
    @apply px-3 py-1.5 text-[9px];
  }
</style>
