<script lang="ts">
  import { _ } from 'svelte-i18n'
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

  const effects = [
    { id: null, label: $_('None') },
    { id: 'dynamic', label: $_('Dynamic') },
    { id: 'appear', label: $_('Appear') },
    { id: 'blinds', label: $_('Blinds') },
    { id: 'box', label: $_('Box') },
    { id: 'checker', label: $_('Checkerboard') }
  ]

  const applyEffect = (id: string | null) => {
    if (!id) {
      GenericFormatingEditorCommands.unwrapAnimation()
      return
    }
    GenericFormatingEditorCommands.wrapWithAnimation(id, 1)
  }

  let _duration = $state('0.50')
  let _delay = $state('0.00')

  const applyDuration = () => {
    const value = Number(_duration)
    if (!Number.isFinite(value)) return
    GenericFormatingEditorCommands.setAnimationDuration(Math.max(0, value))
  }

  const applyDelay = () => {
    const value = Number(_delay)
    if (!Number.isFinite(value)) return
    GenericFormatingEditorCommands.setAnimationDelay(Math.max(0, value))
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
      id: 'preview',
      items: [makeItem('AnimationPreview')].filter(Boolean)
    },
    {
      id: 'effect-options',
      items: [
        makeItem('AnimationEffectOptionsSelect', { __class: 'editor-select' }),
        makeItem('TextAnimationSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'timing',
      items: [
        makeItem('AnimationStartSelect', { __class: 'editor-select' }),
        makeItem('AnimationDurationSelect', { __class: 'editor-select' }),
        makeItem('AnimationDelaySelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'manage',
      items: [makeItem('AnimationDelete'), makeItem('AnimationPane')].filter(Boolean)
    }
  ]
</script>

<div class="editor-animations">
  <div class="editor-ribbon">
    <div class="editor-section">
      {#each sections[0].items as item}
        <div class="editor-item">
          <svelte:component this={item.component} {...item.props} {compact} />
        </div>
      {/each}
    </div>
    <div class="editor-separator"></div>
    <div class="editor-section editor-effect-gallery">
      <div class="editor-effect-strip">
        {#each effects as effect}
          <button class="editor-effect-card" on:click={() => applyEffect(effect.id)} title={effect.label}>
            <span class="editor-effect-icon">{effect.label[0]}</span>
            <span class="editor-effect-label">{effect.label}</span>
          </button>
        {/each}
      </div>
      <button class="editor-effect-more">▾</button>
    </div>
    <div class="editor-separator"></div>
    {#each sections.slice(1) as section, idx}
      <div class="editor-section">
        {#if section.id === 'timing'}
          <div class="editor-timing">
            <div class="editor-timing-row">
              <label>{$_('Start')}:</label>
              {#each section.items.slice(0, 1) as item}
                <div class="editor-item">
                  <svelte:component this={item.component} {...item.props} {compact} />
                </div>
              {/each}
            </div>
            <div class="editor-timing-row">
              <label>{$_('Duration')}:</label>
              <input type="number" step="0.01" min="0" bind:value={_duration} on:change={applyDuration} />
            </div>
            <div class="editor-timing-row">
              <label>{$_('Delay')}:</label>
              <input type="number" step="0.01" min="0" bind:value={_delay} on:change={applyDelay} />
            </div>
          </div>
        {:else}
          {#each section.items as item}
            <div class="editor-item">
              <svelte:component this={item.component} {...item.props} {compact} />
            </div>
          {/each}
        {/if}
      </div>
      {#if idx < sections.slice(1).length - 1}
        <div class="editor-separator"></div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .editor-animations {
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

  .editor-effect-gallery {
    flex: 1 1 auto;
  }

  .editor-effect-strip {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .editor-effect-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 64px;
    padding: 6px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.05);
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  .editor-effect-card:hover {
    border-color: rgba(99, 102, 241, 0.55);
    background: rgba(99, 102, 241, 0.12);
  }

  .editor-effect-icon {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
  }

  .editor-effect-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.6);
  }

  .editor-effect-more {
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

  .editor-timing {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
  }

  .editor-timing-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .editor-timing input {
    width: 64px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(15, 23, 42, 0.8);
    color: white;
    padding: 2px 6px;
  }

  :global(.editor-select .label) {
    text-transform: none !important;
    letter-spacing: normal !important;
  }
</style>
