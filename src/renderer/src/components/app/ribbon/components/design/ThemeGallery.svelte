<script lang="ts">
  import { _ as base_ } from 'svelte-i18n'
  import { GenericFormatingEditorCommands } from '../../../../common/actions/formatting'
  import { get } from 'svelte/store'

  const _ = base_
  const t = get(base_)
  const themes = [
    {
      id: 'neutral',
      label: t('Theme Neutral'),
      swatches: ['#2f2f2f', '#6b7280', '#e5e7eb']
    },
    {
      id: 'blue',
      label: t('Theme Blue'),
      swatches: ['#1f4e79', '#2563eb', '#dbeafe']
    },
    {
      id: 'emerald',
      label: t('Theme Emerald'),
      swatches: ['#1b5e20', '#10b981', '#d1fae5']
    },
    {
      id: 'rose',
      label: t('Theme Rose'),
      swatches: ['#7a1e3a', '#e11d48', '#ffe4e6']
    }
  ]

  const preview = (id?: string) => {
    GenericFormatingEditorCommands.previewDocumentTheme(id)
  }

  const applyTheme = (id: string) => {
    GenericFormatingEditorCommands.setDocumentTheme(id)
  }
</script>

<div class="theme-gallery">
  <div class="theme-gallery-title">{$_('Theme Gallery')}</div>
  <div class="theme-gallery-grid">
    {#each themes as theme (theme.id)}
      <button
        class="theme-card"
        onmouseenter={() => preview(theme.id)}
        onmouseleave={() => preview()}
        onclick={() => applyTheme(theme.id)}
        title={theme.label}
      >
        <div class="theme-card-header" style={`color:${theme.swatches[0]}`}>
          Aa
        </div>
        <div class="theme-card-body">
          <div class="theme-card-line" style={`background:${theme.swatches[1]}`}></div>
          <div class="theme-card-line" style={`background:${theme.swatches[1]}`}></div>
          <div class="theme-card-line thin" style={`background:${theme.swatches[1]}`}></div>
        </div>
        <div class="theme-card-footer">
          {#each theme.swatches as swatch}
            <span style={`background:${swatch}`}></span>
          {/each}
        </div>
        <span class="theme-card-label">{theme.label}</span>
      </button>
    {/each}
  </div>
  <div class="theme-gallery-hint">{$_('Hover to preview')}</div>
</div>

<style lang="postcss">
  .theme-gallery {
    @apply flex flex-col gap-2;
  }
  .theme-gallery-title {
    @apply text-[10px] uppercase tracking-[0.2em] text-[var(--color-base-content)]/50;
  }
  .theme-gallery-grid {
    @apply grid grid-cols-2 gap-2;
  }
  .theme-card {
    @apply relative flex flex-col gap-2 bg-[color-mix(in_srgb,var(--color-base-white)_3%,transparent)] border border-white/10 rounded-lg p-2 text-left hover:border-primary/40 transition-colors;
  }
  .theme-card-header {
    @apply text-[16px] font-700;
  }
  .theme-card-body {
    @apply flex flex-col gap-1;
  }
  .theme-card-line {
    @apply h-[4px] rounded-full;
  }
  .theme-card-line.thin {
    @apply h-[2px];
  }
  .theme-card-footer {
    @apply flex items-center gap-1;
  }
  .theme-card-footer :global(span) {
    @apply h-2 w-2 rounded-full border border-white/20 inline-block;
  }
  .theme-card-label {
    @apply text-[9px] uppercase tracking-[0.2em] text-[var(--color-base-content)]/60;
  }
  .theme-gallery-hint {
    @apply text-[10px] text-[var(--color-base-content)]/40;
  }
</style>
