<script lang="ts">
  const _ = (key: string) => key

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

  const shapeStyles = [
    { id: 'classic', label: _('Classic'), fill: '#111827', stroke: '#94a3b8', effect: 'none' },
    { id: 'azure', label: _('Azure'), fill: '#0b1f3a', stroke: '#60a5fa', effect: 'shadow' },
    { id: 'emerald', label: _('Emerald'), fill: '#0d241e', stroke: '#34d399', effect: 'shadow' },
    { id: 'sunset', label: _('Sunset'), fill: '#2b1208', stroke: '#fb923c', effect: 'shadow' },
    { id: 'rose', label: _('Rose'), fill: '#2a0f16', stroke: '#f472b6', effect: 'shadow' },
    { id: 'violet', label: _('Violet'), fill: '#1a102d', stroke: '#a78bfa', effect: 'shadow' },
    { id: 'mono', label: _('Mono'), fill: '#0f172a', stroke: '#e2e8f0', effect: 'none' }
  ]

  const applyShapeStyle = (style: typeof shapeStyles[number]) => {
    GenericFormatingEditorCommands.setShapeFill(style.fill)
    GenericFormatingEditorCommands.setShapeOutline(style.stroke)
    GenericFormatingEditorCommands.setShapeEffects(style.effect)
  }

  let _shapeWidth = $state('')
  let _shapeHeight = $state('')

  const updateWidth = () => {
    const width = Number(_shapeWidth)
    if (!width) return
    GenericFormatingEditorCommands.setShapeSize(width, undefined)
  }

  const updateHeight = () => {
    const height = Number(_shapeHeight)
    if (!height) return
    GenericFormatingEditorCommands.setShapeSize(undefined, height)
  }

  const sections: RibbonSection[] = [
    {
      id: 'tools',
      items: [
        makeItem('FormatPainter'),
        makeItem('TextBoxSelect'),
        makeItem('ShapesSelect'),
        makeItem('EditShapeSelect', { __class: 'editor-select' }),
        makeItem('MergeShapesSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'styles',
      items: [
        makeItem('ShapeFillSelect', { __class: 'editor-select' }),
        makeItem('ShapeOutlineSelect', { __class: 'editor-select' }),
        makeItem('ShapeEffectsSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'arrange',
      items: [
        makeItem('ShapeGroupSelect', { __class: 'editor-select' }),
        makeItem('ShapeAlignSelect', { __class: 'editor-select' }),
        makeItem('ShapeRotateSelect', { __class: 'editor-select' }),
        makeItem('ShapeBringForwardSelect', { __class: 'editor-select' }),
        makeItem('ShapeSendBackwardSelect', { __class: 'editor-select' }),
        makeItem('ShapeSelectSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'settings',
      items: [makeItem('ShapeSettingsSelect', { __class: 'editor-select' })].filter(Boolean)
    }
  ]
</script>

<div class="editor-drawing-tools">
  <div class="editor-ribbon">
    {#each sections as section, idx}
      {#if section.id === 'styles'}
        <div class="editor-section editor-style-gallery">
          <div class="editor-style-strip">
            {#each shapeStyles as style}
              <button
                class="editor-style-card"
                style={`--accent:${style.stroke}; --fill:${style.fill};`}
                title={style.label}
                on:click={() => applyShapeStyle(style)}
              >
                <div class="editor-style-shape"></div>
              </button>
            {/each}
          </div>
          <button class="editor-style-more">▾</button>
        </div>
      {/if}

      <div class="editor-section">
        {#each section.items as item}
          <div class="editor-item">
            <svelte:component this={item.component} {...item.props} {compact} />
          </div>
        {/each}
        {#if section.id === 'arrange'}
          <div class="editor-size">
            <div class="editor-size-input">
              <div class="editor-size-label">{_('Width')}</div>
              <input
                type="number"
                step="1"
                min="1"
                bind:value={_shapeWidth}
                placeholder="in"
                on:change={updateWidth}
              />
              <span>in</span>
            </div>
            <div class="editor-size-input">
              <div class="editor-size-label">{_('Height')}</div>
              <input
                type="number"
                step="1"
                min="1"
                bind:value={_shapeHeight}
                placeholder="in"
                on:change={updateHeight}
              />
              <span>in</span>
            </div>
          </div>
        {/if}
      </div>
      {#if idx < sections.length - 1}
        <div class="editor-separator"></div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .editor-drawing-tools {
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

  .editor-style-gallery {
    flex: 1 1 auto;
  }

  .editor-style-strip {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .editor-style-card {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    height: 34px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.05);
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  .editor-style-card:hover {
    border-color: rgba(99, 102, 241, 0.55);
    background: rgba(99, 102, 241, 0.12);
  }

  .editor-style-shape {
    width: 26px;
    height: 18px;
    border-radius: 4px;
    background: var(--fill);
    border: 2px solid var(--accent);
    box-shadow: 0 4px 10px color-mix(in srgb, var(--accent) 40%, transparent);
  }

  .editor-style-more {
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 4px 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.04);
  }

  .editor-size {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 2px 6px;
  }

  .editor-size-input {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
  }

  .editor-size-input input {
    width: 64px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(15, 23, 42, 0.8);
    color: white;
    padding: 2px 6px;
  }

  .editor-size-label {
    min-width: 44px;
  }

  :global(.editor-select .label) {
    text-transform: none !important;
    letter-spacing: normal !important;
  }
</style>
