<script lang="ts">
  import { _$_settingsModal, type SettingsTabId } from '../../stores/settingsModal.store'
  import { _ } from 'svelte-i18n'
  import GeneralSettings from './tabs/GeneralSettings.svelte'
  import PageSettings from './tabs/PageSettings.svelte'
  import LayoutSettings from './tabs/LayoutSettings.svelte'
  import AppearanceSettings from './tabs/AppearanceSettings.svelte'
  import ProofingSettings from './tabs/ProofingSettings.svelte'
  import SaveSettings from './tabs/SaveSettings.svelte'
  import AdvancedSettings from './tabs/AdvancedSettings.svelte'
  import AccessibilitySettings from './tabs/AccessibilitySettings.svelte'
  import PrivacySettings from './tabs/PrivacySettings.svelte'
  import UpdatesSettings from './tabs/UpdatesSettings.svelte'
  import ShortcutsSettings from './tabs/ShortcutsSettings.svelte'
  import CollaborationSettings from './tabs/CollaborationSettings.svelte'

  const modal = _$_settingsModal

  const tabs: { id: SettingsTabId; labelKey: string; icon: string; hintKey: string }[] = [
    { id: 'general', labelKey: 'General', icon: 'ph-gear', hintKey: 'Core workspace defaults' },
    { id: 'appearance', labelKey: 'Appearance', icon: 'ph-paint-brush', hintKey: 'Themes and visuals' },
    { id: 'page', labelKey: 'Page', icon: 'ph-files', hintKey: 'Page setup and pagination' },
    { id: 'layout', labelKey: 'Layout', icon: 'ph-columns', hintKey: 'Canvas and guides' },
    { id: 'proofing', labelKey: 'Proofing', icon: 'ph-spell-check', hintKey: 'Writing assistance' },
    { id: 'save', labelKey: 'Save', icon: 'ph-floppy-disk', hintKey: 'Auto save and backups' },
    { id: 'collaboration', labelKey: 'Collaboration', icon: 'ph-users-three', hintKey: 'Live co-authoring' },
    { id: 'accessibility', labelKey: 'Accessibility', icon: 'ph-universal-access', hintKey: 'Visibility and motion' },
    { id: 'privacy', labelKey: 'Privacy', icon: 'ph-shield-check', hintKey: 'Security and data' },
    { id: 'updates', labelKey: 'Updates', icon: 'ph-arrow-circle-up', hintKey: 'Release channels' },
    { id: 'shortcuts', labelKey: 'Shortcuts', icon: 'ph-command', hintKey: 'Keyboard bindings' },
    { id: 'advanced', labelKey: 'Advanced', icon: 'ph-sliders', hintKey: 'Performance and labs' },
    { id: 'sovereignty', labelKey: 'Sovereignty', icon: 'ph-globe-hemisphere-west', hintKey: 'Data locality and migration' }
  ]

  const tabComponents: Record<SettingsTabId, typeof GeneralSettings> = {
    general: GeneralSettings,
    appearance: AppearanceSettings,
    page: PageSettings,
    layout: LayoutSettings,
    proofing: ProofingSettings,
    save: SaveSettings,
    advanced: AdvancedSettings,
    accessibility: AccessibilitySettings,
    privacy: PrivacySettings,
    updates: UpdatesSettings,
    shortcuts: ShortcutsSettings,
    collaboration: CollaborationSettings,
    sovereignty: CollaborationSettings
    // sovereignty: SovereigntySettings
  }

  const close = () => modal.close()
</script>

{#if $modal.open}
  <div class="settings-overlay" on:click={close}></div>
  <section class="settings-window" role="dialog" aria-modal="true">
    <header>
      <div>
        <p class="eyebrow">{$_('Dynadoc Settings')}</p>
        <h2>{$_('Workspace Preferences')}</h2>
      </div>
      <div class="header-actions">
        <button class="ghost" title={$_('Reset to defaults')}>
          <i class="ph-light ph-arrow-counter-clockwise"></i>
          {$_('Reset')}
        </button>
        <button class="close" on:click={close} aria-label={$_('Close settings')}>
          <i class="ph-bold ph-x"></i>
        </button>
      </div>
    </header>

    <div class="body">
      <nav>
        {#each tabs as tab}
          <button
            class:selected={$modal.activeTab === tab.id}
            on:click={() => modal.setActiveTab(tab.id)}
          >
            <i class={`ph-light ${tab.icon}`}></i>
            <span>
              <strong>{$_(tab.labelKey)}</strong>
              <small>{$_(tab.hintKey)}</small>
            </span>
          </button>
        {/each}
      </nav>

      <main>
        <div class="tab-header">
          <div>
            <p class="badge">{$_('Business Grade')}</p>
            <h3>{$_(tabs.find((t) => t.id === $modal.activeTab)?.labelKey || '')}</h3>
            <p class="subtitle">{$_(tabs.find((t) => t.id === $modal.activeTab)?.hintKey || '')}</p>
          </div>
          <div class="actions">
            <button class="primary">{$_('Apply')}</button>
            <button class="ghost" on:click={close}>{$_('Done')}</button>
          </div>
        </div>
        <div class="tab-content">
          <svelte:component this={tabComponents[$modal.activeTab]} />
        </div>
      </main>
    </div>
  </section>
{/if}

<style lang="postcss">
  .settings-overlay {
    @apply fixed inset-0 z-1000;
    @apply bg-black/60 backdrop-blur-md;
  }

  .settings-window {
    @apply fixed inset-[6vh_8vw] z-71 flex flex-col overflow-hidden;
    @apply bg-[var(--color-base-100)] border border-white/10 rounded-[24px] shadow-2xl;
    /* Optional Glassmorphism overlay to match previous aesthetic */
    /* background-image: radial-gradient(circle at top left, theme('colors.primary.DEFAULT' / 5%), transparent 40%); */
  }

  header {
    @apply flex items-center justify-between px-6 py-5;
    @apply border-bottom border-[var(--color-base-content)]/10 bg-[color-mix(in_srgb,var(--color-base-200)_30%,transparent)];
  }

  .eyebrow {
    @apply text-[10px] uppercase tracking-[0.3em] font-semibold text-[var(--color-base-content)]/40;
  }

  header h2 {
    @apply text-xl font-bold text-[var(--color-base-content)] mt-1.5;
  }

  .header-actions {
    @apply flex items-center gap-3;
  }

  /* Navigation Sidebar */
  .body {
    @apply grid grid-cols-[280px_1fr] flex-1 min-h-0;
  }

  nav {
    @apply flex flex-col gap-1 p-4 overflow-y-auto;
    @apply border-r border-[var(--color-base-content)]/5 bg-[color-mix(in_srgb,var(--color-base-200)_50%,transparent)];
  }

  nav button {
    @apply grid grid-cols-[24px_1fr] gap-3 items-center text-left;
    @apply px-4 py-3 rounded-xl transition-all duration-200;
    @apply text-[var(--color-base-content)]/70 border border-transparent;
    @apply hover:bg-[var(--color-base-100)]/5 hover:text-[var(--color-base-content)];
  }

  nav button.selected {
    @apply bg-primary/10 border-primary/20 text-primary shadow-sm;
  }

  nav button strong {
    @apply block text-sm font-semibold;
  }

  nav button small {
    @apply block text-[10px] opacity-60 mt-0.5;
  }

  nav button i {
    @apply text-lg opacity-80;
  }

  /* Main Content Area */
  main {
    @apply flex flex-col p-6 overflow-hidden min-h-0 bg-[var(--color-base-100)];
  }

  .tab-header {
    @apply flex items-center justify-between pb-5 mb-5;
    @apply border-b border-[var(--color-base-content)]/10;
  }

  .badge {
    @apply text-[9px] font-bold tracking-widest uppercase py-1 px-2 rounded bg-[var(--color-base-100)]/5 text-[var(--color-base-content)]/50 w-fit;
  }

  .tab-header h3 {
    @apply text-2xl font-bold mt-2 text-[var(--color-base-content)];
  }

  .subtitle {
    @apply text-xs text-[var(--color-base-content)]/50 mt-1;
  }

  .actions {
    @apply flex items-center gap-2;
  }

  .tab-content {
    @apply flex-1 overflow-y-auto pr-2;
  }

  /* Custom Scrollbar for better UX */
  .tab-content::-webkit-scrollbar {
    @apply w-1.5;
  }
  .tab-content::-webkit-scrollbar-thumb {
    @apply bg-[var(--color-base-100)]/10 rounded-full;
  }

  /* DaisyUI Button Mappings & Component Classes */
  button.primary {
    @apply btn btn-primary btn-sm px-6 rounded-lg font-bold shadow-lg shadow-primary/20;
  }

  button.ghost {
    @apply btn btn-ghost btn-sm text-[10px] uppercase tracking-widest gap-2 font-bold opacity-80 border border-[var(--color-base-content)]/10;
  }

  button.close {
    @apply btn btn-circle btn-ghost btn-sm hover:bg-error/10 hover:text-error;
  }

  /* Mobile Responsiveness */
  @media (max-width: 1024px) {
    .settings-window {
      @apply inset-0 rounded-none;
    }

    .body {
      @apply grid-cols-1;
    }

    nav {
      @apply flex-row h-fit border-r-0 border-b overflow-x-auto;
    }

    nav button {
      @apply min-w-[200px];
    }
  }
</style>
