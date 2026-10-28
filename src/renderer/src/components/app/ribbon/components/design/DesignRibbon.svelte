<script lang="ts">
  import { get } from 'svelte/store'
  import { _ as base_ } from 'svelte-i18n'
  import { GenericFormatingEditorCommands, GenericFormattingComponentMap } from '../../../../common/actions/formatting'

  let { compact = false } = $props()

  type RibbonItem = {
    id: string
    component: any
    props: Record<string, any>
  }

  type RibbonSection = {
    id: string
    items: RibbonItem[]
  }

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

  const previewTheme = (id?: string) => {
    GenericFormatingEditorCommands.previewDocumentTheme(id)
  }

  const applyTheme = (id: string) => {
    GenericFormatingEditorCommands.setDocumentTheme(id)
  }

  const makeItem = (key: keyof typeof GenericFormattingComponentMap, overrides: Record<string, any> = {}) => {
    const entry = GenericFormattingComponentMap[key]
    if (!entry) return null
    const baseProps = typeof entry.props === 'function' ? entry.props({}) : entry.props
    return {
      id: key.toString(),
      component: entry.component,
      props: { ...baseProps, ...overrides }
    }
  }

  const sections: RibbonSection[] = [
    {
      id: 'theme-actions',
      items: [
        makeItem('ColorSchemeSelect', { __class: 'editor-select' }),
        makeItem('BackgroundSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'page-setup',
      items: [
        makeItem('SlideLayoutSelect', { __class: 'editor-select' }),
        makeItem('SlideSizeSelect', { __class: 'editor-select' }),
        makeItem('SlideMasterSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'dynadoc',
      items: [
        makeItem('DesignSelect'),
        makeItem('GallerySelect'),
        makeItem('VisualEffectsSelect')
      ].filter(Boolean)
    }
  ]
</script>

<div class="editor-design">
  <div class="editor-ribbon">
    <div class="editor-section editor-themes">
      <div class="editor-theme-strip">
        {#each themes as theme (theme.id)}
          <button
            class="editor-theme-card"
            onmouseenter={() => previewTheme(theme.id)}
            onmouseleave={() => previewTheme()}
            onclick={() => applyTheme(theme.id)}
            title={theme.label}
          >
            <div class="editor-theme-header" style={`color:${theme.swatches[0]}`}>Aa</div>
            <div class="editor-theme-body">
              <div class="editor-theme-line" style={`background:${theme.swatches[1]}`}></div>
              <div class="editor-theme-line" style={`background:${theme.swatches[1]}`}></div>
              <div class="editor-theme-line thin" style={`background:${theme.swatches[1]}`}></div>
            </div>
            <div class="editor-theme-swatches">
              {#each theme.swatches as swatch}
                <span style={`background:${swatch}`}></span>
              {/each}
            </div>
          </button>
        {/each}
      </div>
    </div>
    <div class="editor-separator"></div>
    {#each sections as section, idx}
      <div class="editor-section">
        {#each section.items as item}
          <div class="editor-item">
            <svelte:component this={item.component} {...item.props} {compact} />
          </div>
        {/each}
      </div>
      {#if idx < sections.length - 1}
        <div class="editor-separator"></div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .editor-design {
    width: 100%;
    height: 100%;
  }

  .editor-ribbon {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 10px;
    overflow-x: auto;
  }

  .editor-section {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .editor-themes {
    flex: 1 1 auto;
  }

  .editor-theme-strip {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .editor-theme-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 6px;
    padding: 6px 8px;
    min-width: 72px;
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  .editor-theme-card:hover {
    border-color: rgba(99, 102, 241, 0.65);
    background: rgba(99, 102, 241, 0.12);
  }

  .editor-theme-header {
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
  }

  .editor-theme-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .editor-theme-line {
    height: 4px;
    border-radius: 999px;
  }

  .editor-theme-line.thin {
    height: 2px;
  }

  .editor-theme-swatches {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .editor-theme-swatches :global(span) {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .editor-item {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 52px;
  }

  .editor-separator {
    width: 1px;
    height: 46px;
    background: rgba(255, 255, 255, 0.12);
  }

  :global(.editor-select .label) {
    text-transform: none !important;
    letter-spacing: normal !important;
  }
</style>
