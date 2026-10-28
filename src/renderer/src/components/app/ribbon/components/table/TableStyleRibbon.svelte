<script lang="ts">
  const _ = (key: string) => key

  import Layout from '../../../../common/layout/layout'
  import {
    GenericFormatingEditorCommands,
    GenericFormattingComponentMap,
    TableLayoutFormattingMap
  } from '../../../../common/actions/formatting'

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

  const makeTableItem = (
    key: keyof typeof TableLayoutFormattingMap,
    overrides: Record<string, any> = {}
  ) => {
    const entry = TableLayoutFormattingMap[key]
    if (!entry) return null
    const baseProps = typeof entry.props === 'function' ? entry.props({}) : entry.props
    return {
      id: key.toString(),
      component: entry.component,
      props: { ...baseProps, ...overrides }
    }
  }

  const stylePresets = [
    { id: 'plain', label: _('Plain'), accent: '#e5e7eb', fill: '#111827' },
    { id: 'blue', label: _('Blue'), accent: '#60a5fa', fill: '#0b1220' },
    { id: 'red', label: _('Red'), accent: '#f87171', fill: '#1f0a12' },
    { id: 'green', label: _('Green'), accent: '#34d399', fill: '#0c1f1a' },
    { id: 'purple', label: _('Purple'), accent: '#a78bfa', fill: '#160d24' },
    { id: 'teal', label: _('Teal'), accent: '#22d3ee', fill: '#0b1620' },
    { id: 'orange', label: _('Orange'), accent: '#fb923c', fill: '#221209' },
    { id: 'mono', label: _('Mono'), accent: '#94a3b8', fill: '#0f172a' }
  ]

  let tableOptions = $state({
    headerRow: true,
    bandedRows: true,
    firstColumn: false,
    totalRow: false,
    bandedColumns: false,
    lastColumn: false
  })

  const toggleOption = (key: keyof typeof tableOptions) => {
    tableOptions[key] = !tableOptions[key]
    GenericFormatingEditorCommands.setTableStyleOption(key, tableOptions[key])
  }

  const sections: RibbonSection[] = [
    {
      id: 'style-format',
      items: [
        makeItem('TableShadingSelect'),
        makeItem('TableBorderSelect'),
        makeItem('TableBorderWeightSelect'),
        makeItem('TableBorderColorSelect'),
        makeTableItem('DrawTable', { __layout: Layout.LAYOUT.ROW }),
        makeTableItem('Eraser', { __layout: Layout.LAYOUT.ROW }),
        makeItem('ClearTableStyle')
      ].filter(Boolean)
    }
  ]
</script>

<div class="editor-table-style">
  <div class="editor-ribbon">
    <div class="editor-section editor-options">
      <div class="editor-option-grid">
        <label class="editor-check">
          <input type="checkbox" bind:checked={tableOptions.headerRow} on:change={() => toggleOption('headerRow')} />
          <span>{_('First Row')}</span>
        </label>
        <label class="editor-check">
          <input type="checkbox" bind:checked={tableOptions.totalRow} on:change={() => toggleOption('totalRow')} />
          <span>{_('Last Row')}</span>
        </label>
        <label class="editor-check">
          <input type="checkbox" bind:checked={tableOptions.bandedRows} on:change={() => toggleOption('bandedRows')} />
          <span>{_('Banded Rows')}</span>
        </label>
        <label class="editor-check">
          <input type="checkbox" bind:checked={tableOptions.bandedColumns} on:change={() => toggleOption('bandedColumns')} />
          <span>{_('Banded Columns')}</span>
        </label>
        <label class="editor-check">
          <input type="checkbox" bind:checked={tableOptions.firstColumn} on:change={() => toggleOption('firstColumn')} />
          <span>{_('First Column')}</span>
        </label>
        <label class="editor-check">
          <input type="checkbox" bind:checked={tableOptions.lastColumn} on:change={() => toggleOption('lastColumn')} />
          <span>{_('Last Column')}</span>
        </label>
      </div>
    </div>
    <div class="editor-separator"></div>
    <div class="editor-section editor-style-gallery">
      <div class="editor-style-strip">
        {#each stylePresets as preset}
          <button
            class="editor-style-card"
            style={`--accent:${preset.accent}; --fill:${preset.fill};`}
            title={preset.label}
            on:click={() => GenericFormatingEditorCommands.setTableStylePreset(preset.id)}
          >
            <div class="editor-style-grid">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </button>
        {/each}
      </div>
      <button class="editor-style-more">▾</button>
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
  .editor-table-style {
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

  .editor-style-gallery {
    flex: 1 1 auto;
  }

  .editor-options {
    min-width: 260px;
  }

  .editor-option-grid {
    display: grid;
    grid-template-columns: repeat(3, auto);
    column-gap: 16px;
    row-gap: 6px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
  }

  .editor-check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .editor-check input {
    width: 14px;
    height: 14px;
  }

  .editor-style-strip {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .editor-style-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 48px;
    padding: 4px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.05);
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  .editor-style-card:hover {
    border-color: rgba(99, 102, 241, 0.55);
    background: rgba(99, 102, 241, 0.12);
  }

  .editor-style-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
  }

  .editor-style-grid span {
    display: block;
    height: 6px;
    background: color-mix(in srgb, var(--fill) 60%, #111827);
    border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  }

  .editor-style-grid span:nth-child(1),
  .editor-style-grid span:nth-child(2),
  .editor-style-grid span:nth-child(3) {
    background: var(--accent);
  }

  .editor-style-more {
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 4px 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.04);
  }

  .editor-item {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 46px;
  }

  .editor-separator {
    width: 1px;
    height: 40px;
    background: rgba(255, 255, 255, 0.08);
  }

  :global(.editor-select .label) {
    text-transform: none !important;
    letter-spacing: normal !important;
  }
</style>
