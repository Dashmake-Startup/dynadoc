<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { openUpgradePlanModal, type UpgradePlanTier } from '../../../stores/upgradePlanModal.store'

  interface Props {
    label?: string;
    subtitle?: string;
    highlight?: UpgradePlanTier;
    size?: 'sm' | 'md' | 'lg';
  }

  let { 
    label = 'Upgrade', 
    subtitle = 'Unlock Pro Tier', 
    highlight = 'pro', 
    size = 'md' 
  } = $props();

  function handleClick() {
    openUpgradePlanModal({ source: 'cta', highlight })
  }
</script>

<button class="adobe-cta-btn {size}" onclick={handleClick}>
  <div class="adobe-bg-layer"></div>
  
  <div class="flex items-center gap-3 relative z-10">
    <div class="tier-indicator">
      <i class="ph-bold ph-crown text-[14px] text-base-300"></i>
    </div>

    <div class="flex flex-col items-start text-left leading-none">
      <span class="adobe-eyebrow">{$_(label)}</span>
      <!-- <span class="adobe-subtitle">{$_(subtitle)}</span> -->
    </div>

    <div class="v-divider"></div>

    <div class="action-icon">
      <i class="ph-bold ph-arrow-right"></i>
    </div>
  </div>
</button>

<style lang="postcss">
  .adobe-cta-btn {
    @apply relative overflow-hidden flex items-center border border-white/10 rd-[4px] transition-all duration-200 select-none;
    background: var(--theme-surface-1);
    box-shadow:
      0 4px 12px rgba(var(--theme-text-rgb), 0.12),
      inset 0 1px 0 rgba(var(--theme-text-rgb), 0.05);
  }

  /* Size Variants */
  .adobe-cta-btn.sm { @apply px-0.2 py-0.5; }
  .adobe-cta-btn.md { @apply px-0.3 py-0.2; }
  .adobe-cta-btn.lg { @apply px-0.5 py-0.3; }

  /* Hover States */
  .adobe-cta-btn:hover {
    @apply border-[var(--color-base-300)]/50;
    background: var(--theme-surface-2);
    transform: translateY(-1px);
    box-shadow:
      0 8px 20px rgba(var(--theme-text-rgb), 0.16),
      inset 0 1px 0 rgba(var(--theme-text-rgb), 0.08);
  }

  .adobe-cta-btn:active {
    @apply scale-[0.97];
    background: rgba(var(--theme-text-rgb), 0.06);
  }

  /* Typography */
  .adobe-eyebrow {
    @apply text-[8px] font-900 uppercase tracking-[0.2em] text-[var(--color-base-300)] mb-1;
  }

  .adobe-subtitle {
    @apply text-[12px] font-700 text-[var(--color-base-content)]/90 tracking-tight;
  }

  /* Internal Elements */
  .tier-indicator {
    @apply size-7 rd-[3px] bg-[var(--color-base-100)]/10 flex items-center justify-center border border-white/5;
  }

  .v-divider {
    @apply w-px h-4 bg-[var(--color-base-100)]/10 mx-1;
  }

  .action-icon {
    @apply text-[var(--color-base-content)]/20 transition-all;
  }
  .adobe-cta-btn:hover .action-icon {
    @apply text-[var(--color-base-300)] translate-x-0.5;
  }

  .adobe-bg-layer {
    @apply absolute inset-0 opacity-0 transition-opacity duration-300;
    background: linear-gradient(135deg, rgba(0,190,172,0.08) 0%, transparent 100%);
  }
  .adobe-cta-btn:hover .adobe-bg-layer {
    @apply opacity-100;
  }
</style>
