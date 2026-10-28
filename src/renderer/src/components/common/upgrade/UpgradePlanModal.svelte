<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { _$_upgradePlanModal, type UpgradePlanTier } from '../../../stores/upgradePlanModal.store'
  import { openAlertModal } from '../../../stores/alertModal.store'

  const modal = _$_upgradePlanModal

  const plans: Array<{
    id: UpgradePlanTier
    label: string
    price: string
    summary: string
    badge?: string
    highlights: string[]
    cta: string
  }> = $state([
    {
      id: 'pro',
      label: $_('Pro'),
      price: $_('For growing teams'),
      summary: $_('Advanced collaboration, governance, and premium automation.'),
      badge: $_('Most Popular'),
      highlights: [
        $_('Identity-bound sharing and invite approvals'),
        $_('Chat retention policies and exportable audit trails'),
        $_('Meeting controls: lobby, roles, and recording governance'),
        $_('Advanced document restrictions with tamper protection')
      ],
      cta: $_('Upgrade to Pro')
    },
    {
      id: 'corporate',
      label: $_('Corporate'),
      price: $_('For regulated organizations'),
      summary: $_('Enterprise controls, compliance workflows, and SLA-backed support.'),
      badge: $_('Security'),
      highlights: [
        $_('Granular permissions, approval flows, and legal hold'),
        $_('SSO / SCIM and organization-wide policy packs'),
        $_('Centralized audit, eDiscovery-ready exports'),
        $_('Priority support and onboarding')
      ],
      cta: $_('Talk to Sales')
    },
    {
      id: 'onprem',
      label: $_('On‑Prem'),
      price: $_('For sovereign deployments'),
      summary: $_('Self-hosted, air‑gapped, and fully controlled infrastructure.'),
      badge: $_('Air‑Gapped'),
      highlights: [
        $_('Private key custody and offline signing'),
        $_('Dedicated security hardening + custom integrations'),
        $_('Data residency and local compliance controls'),
        $_('On‑prem support, updates, and training')
      ],
      cta: $_('Request On‑Prem')
    }
  ])

  function handleChoose(plan: UpgradePlanTier) {
    _$_upgradePlanModal.choose(plan)
    openAlertModal({
      title: $_('Upgrade Request Sent'),
      message: $_('Thanks! Our team will reach out to finalize your upgrade details.')
    })
  }
</script>

{#if $modal.open}
  <div class="adobe-modal-backdrop" onclick={() => _$_upgradePlanModal.cancel()}>
    <div class="adobe-upgrade-panel" onclick={(e) => e.stopPropagation()}>
      <header class="adobe-header">
        <div class="flex items-center gap-4">
          <div class="brand-glyph">
            <i class="ph-fill ph-shield-star text-[24px] text-base-300"></i>
          </div>
          <div>
            <div class="adobe-eyebrow">{$_('SYSTEM_UPGRADE_ORCHESTRATOR')}</div>
            <h2 class="adobe-title">{$_('Scale Governance & Infrastructure')}</h2>
          </div>
        </div>
        <button class="adobe-close-btn" onclick={() => _$_upgradePlanModal.cancel()}>
          <i class="ph-light ph-x"></i>
        </button>
      </header>

      <div class="adobe-grid no-scrollbar">
        {#each plans as plan}
          <section
            class="adobe-card"
            class:is-highlighted={($modal.highlight || 'pro') === plan.id}
          >
            <div class="card-identity">
              <div class="flex justify-between items-start">
                <span class="plan-label">{plan.label}</span>
                {#if plan.badge}
                  <span class="plan-badge">{plan.badge}</span>
                {/if}
              </div>
              <div class="plan-sub-price">{plan.price}</div>
            </div>

            <div class="card-body">
              <p class="plan-summary">{plan.summary}</p>

              <div class="specs-label">{$_('KEY CAPABILITIES')}</div>
              <ul class="plan-highlights">
                {#each plan.highlights as item}
                  <li>
                    <i class="ph-bold ph-check-circle text-base-300"></i>
                    <span>{item}</span>
                  </li>
                {/each}
              </ul>
            </div>

            <div class="card-footer">
              <button class="adobe-cta-btn" onclick={() => handleChoose(plan.id)}>
                <span>{plan.cta}</span>
                <i class="ph-bold ph-caret-right"></i>
              </button>
            </div>
          </section>
        {/each}
      </div>

      <footer class="adobe-footer">
        <div class="footer-note">
          <i class="ph-light ph-info text-base-300"></i>
          <span>{$_('Deployment adjustments can be finalized with your account engineer.')}</span>
        </div>
        <div class="flex items-center gap-2">
          <button class="adobe-ghost-btn" onclick={() => handleChoose('corporate')}
            >{$_('REQUEST_WALKTHROUGH')}</button
          >
          <div class="v-divider"></div>
          <button class="adobe-ghost-btn" onclick={() => handleChoose('pro')}
            >{$_('COMPARE_DETAILED_SPECS')}</button
          >
        </div>
      </footer>
    </div>
  </div>
{/if}

<style lang="postcss">
  /* --- Adobe Backdrop --- */
  .adobe-modal-backdrop {
    @apply fixed inset-0 z-[12000] backdrop-blur-md flex items-center justify-center p-4;
    background: var(--theme-backdrop-strong);
  }

  /* --- Main Panel --- */
  .adobe-upgrade-panel {
    @apply w-full h-full max-w-[1080px] rd-[8px] flex flex-col overflow-auto;
    background: var(--theme-surface-1);
    border: 1px solid var(--theme-border-subtle);
    box-shadow: var(--theme-popover-shadow);
  }

  /* --- Header --- */
  .adobe-header {
    @apply flex items-center justify-between p-6;
    background: var(--theme-overlay-soft);
    border-bottom: 1px solid var(--theme-border-subtle);
  }
  .brand-glyph {
    @apply size-12 rd-[4px] flex items-center justify-center;
    background: var(--theme-overlay-strong);
    border: 1px solid var(--theme-border-subtle);
  }
  .adobe-eyebrow {
    @apply text-[9px] font-900 uppercase tracking-[0.3em] text-[var(--color-base-300)];
  }
  .adobe-title {
    @apply text-[20px] font-700 tracking-tight mt-0.5;
    color: rgba(var(--theme-text-rgb), 0.94);
  }
  .adobe-close-btn {
    @apply size-8 flex items-center justify-center rd-[4px] transition-all;
    color: rgba(var(--theme-text-rgb), 0.3);
  }
  .adobe-close-btn:hover {
    background: rgba(var(--theme-text-rgb), 0.06);
    color: rgba(var(--theme-text-rgb), 0.92);
  }

  /* --- Grid & Cards --- */
  .adobe-grid {
    @apply grid grid-cols-1 lg:grid-cols-3 gap-px p-px;
    background: rgba(var(--theme-text-rgb), 0.06);
  }

  .adobe-card {
    @apply p-8 flex flex-col gap-6 transition-all;
    background: var(--theme-surface-1);
  }
  .adobe-card.is-highlighted {
    @apply ring-inset ring-1 ring-[var(--color-base-300)]/30;
    background: var(--theme-surface-2);
  }

  /* Card Components */
  .plan-label {
    @apply text-[22px] font-800 tracking-tighter;
    color: rgba(var(--theme-text-rgb), 0.96);
  }
  .plan-sub-price {
    @apply text-[10px] font-800 uppercase tracking-widest mt-1;
    color: rgba(var(--theme-text-rgb), 0.34);
  }
  .plan-badge {
    @apply text-[8px] font-900 uppercase tracking-widest px-2 py-0.5 rd-[2px] bg-[var(--color-base-300)] text-black;
  }
  .plan-summary {
    @apply text-[13px] leading-relaxed h-12;
    color: rgba(var(--theme-text-rgb), 0.58);
  }
  .specs-label {
    @apply text-[9px] font-900 uppercase tracking-widest mt-4 mb-2;
    color: rgba(var(--theme-text-rgb), 0.26);
  }
  .plan-highlights {
    @apply flex flex-col gap-3;
  }
  .plan-highlights li {
    @apply flex items-start gap-3 text-[12px] leading-snug;
    color: rgba(var(--theme-text-rgb), 0.74);
  }

  /* --- Buttons --- */
  .adobe-cta-btn {
    @apply w-full mt-4 flex items-center justify-between px-4 py-3 rd-[4px] bg-[var(--color-base-300)] text-black 
           text-[12px] font-800 uppercase tracking-widest transition-all
           hover:(bg-[#00D9C5] translate-y-[-1px]) active:scale-[0.98];
  }
  .is-highlighted .adobe-cta-btn {
    @apply shadow-[0_0_30px_rgba(0,190,172,0.3)];
  }

  /* --- Footer --- */
  .adobe-footer {
    @apply p-6 flex flex-col md:flex-row items-center justify-between gap-4;
    background: rgba(var(--theme-text-rgb), 0.04);
    border-top: 1px solid var(--theme-border-subtle);
  }
  .footer-note {
    @apply flex items-center gap-3 text-[11px] font-600;
    color: rgba(var(--theme-text-rgb), 0.42);
  }
  .adobe-ghost-btn {
    @apply text-[10px] font-800 uppercase tracking-widest transition-colors;
    color: rgba(var(--theme-text-rgb), 0.46);
  }
  .adobe-ghost-btn:hover {
    color: var(--color-base-300);
  }
  .v-divider {
    @apply w-px h-3;
    background: rgba(var(--theme-text-rgb), 0.12);
  }

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
</style>
