<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onDestroy, onMount } from 'svelte'
  import { NodeSelection } from 'prosemirror-state'

  import { GenericFormatingEditorCommands, GenericFormattingComponentMap } from '../../../../common/actions/formatting'
  import { _$_wysiwygEditorsList } from '../../../../../stores/editor.store'
  import { CustomSlideExtensionProps } from '../../../../../extensions/tiptap/CustomSlideExtension/utils/common.utils'

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

  const transitions = [
    { id: null, label: $_('None'), swatch: '#1f2937' },
    { id: 'fade', label: $_('Fade'), swatch: '#3b82f6' },
    { id: 'push', label: $_('Push'), swatch: '#10b981' },
    { id: 'wipe', label: $_('Wipe'), swatch: '#f59e0b' },
    { id: 'split', label: $_('Split'), swatch: '#f43f5e' },
    { id: 'zoom', label: $_('Zoom'), swatch: '#8b5cf6' }
  ]

  const setTransition = (id: string | null) => {
    GenericFormatingEditorCommands.setSlideTransition(id)
    _activeTransition = id
  }

  let _speed = $state('0.50')
  let _autoInterval = $state('0.00')
  let _autoEnabled = $state(false)
  let _clickToChange = $state(true)
  let _activeTransition: string | null = $state(null)

  const resolveActiveSlideAttrs = () => {
    const active = _$_wysiwygEditorsList.getActiveEntry?.()
    const editor = active?.editor
    if (!editor) return null
    const { selection } = editor.state
    if (selection instanceof NodeSelection && selection.node.type.name === CustomSlideExtensionProps.name) {
      return selection.node.attrs
    }
    // const { $from } = selection
    const from = selection.$from
    for (let depth = from.depth; depth > 0; depth--) {
      const node = from.node(depth)
      if (node.type.name === CustomSlideExtensionProps.name) return node.attrs
    }
    return null
  }

  const refreshState = () => {
    const attrs = resolveActiveSlideAttrs()
    if (!attrs) return
    _activeTransition = attrs.transition ?? null
    _speed = String(attrs.transitionDuration ?? 0.6)
    _autoEnabled = attrs.transitionAdvance === 'after'
    _clickToChange = attrs.transitionAdvance !== 'after'
    _autoInterval = String(attrs.transitionAdvanceAfter ?? 0)
  }

  let _unsub: (() => void) | null = null
  onMount(() => {
    refreshState()
    _unsub = _$_wysiwygEditorsList.subscribe(() => refreshState())
  })
  onDestroy(() => {
    _unsub?.()
  })

  const applySpeed = () => {
    const value = Number(_speed)
    if (!Number.isFinite(value)) return
    GenericFormatingEditorCommands.setSlideTransitionDuration(Math.max(0, value))
  }

  const applyAutoInterval = () => {
    const value = Number(_autoInterval)
    if (!Number.isFinite(value)) return
    GenericFormatingEditorCommands.setSlideAdvance('after')
    GenericFormatingEditorCommands.setSlideAdvanceAfter(Math.max(0, value))
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
      items: [makeItem('TransitionPreview')].filter(Boolean)
    },
    {
      id: 'effect-select',
      items: [makeItem('TransitionEffectOptionsSelect', { __class: 'editor-select' })].filter(Boolean)
    },
    {
      id: 'timing',
      items: [
        makeItem('TransitionSoundSelect', { __class: 'editor-select' }),
        makeItem('TransitionDurationSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'advance',
      items: [
        makeItem('TransitionAdvanceSelect', { __class: 'editor-select' }),
        makeItem('TransitionApplyAll')
      ].filter(Boolean)
    }
  ]
</script>

<div class="editor-transitions">
  <div class="editor-ribbon">
    <div class="editor-section editor-transition-gallery">
      <div class="editor-transition-strip">
        {#each transitions as transition}
          <button
            class="editor-transition-card"
            class:active={_activeTransition === transition.id}
            title={transition.label}
            style={`--accent:${transition.swatch};`}
            on:click={() => setTransition(transition.id)}
          >
            <div class="editor-transition-preview"></div>
            <div class="editor-transition-label">{transition.label}</div>
          </button>
        {/each}
      </div>
    </div>
    <div class="editor-separator"></div>
    {#each sections as section, idx}
      <div class="editor-section">
        {#if section.id === 'timing'}
          <div class="editor-timing">
            <div class="editor-timing-row">
              <label>{$_('Speed')}:</label>
              <input type="number" step="0.01" min="0" bind:value={_speed} on:change={applySpeed} />
            </div>
            <div class="editor-timing-row">
              <label>{$_('Sound')}:</label>
              {#each section.items as item}
                <div class="editor-item">
                  <svelte:component this={item.component} {...item.props} {compact} />
                </div>
              {/each}
            </div>
          </div>
        {:else if section.id === 'advance'}
          <div class="editor-timing editor-advance">
            <label class="editor-check">
              <input
                type="checkbox"
                bind:checked={_clickToChange}
                on:change={() => {
                  if (_clickToChange) {
                    GenericFormatingEditorCommands.setSlideAdvance('click')
                  }
                }}
              />
              <span>{$_('Click to change slides')}</span>
            </label>
            <label class="editor-check">
              <input
                type="checkbox"
                bind:checked={_autoEnabled}
                on:change={() => {
                  if (_autoEnabled) {
                    applyAutoInterval()
                  }
                }}
              />
              <span>{$_('Auto interval')}:</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              bind:value={_autoInterval}
              on:change={applyAutoInterval}
              class="editor-interval"
            />
            <div class="editor-item">
              <svelte:component
                this={GenericFormattingComponentMap.TransitionApplyAll.component}
                {...GenericFormattingComponentMap.TransitionApplyAll.props}
                {compact}
              />
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
      {#if idx < sections.length - 1}
        <div class="editor-separator"></div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .editor-transitions {
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

  .editor-transition-gallery {
    flex: 1 1 auto;
  }

  .editor-transition-strip {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .editor-transition-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 72px;
    padding: 6px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.05);
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  .editor-transition-card:hover {
    border-color: rgba(99, 102, 241, 0.55);
    background: rgba(99, 102, 241, 0.12);
  }

  .editor-transition-card.active {
    border-color: rgba(99, 102, 241, 0.85);
    background: rgba(99, 102, 241, 0.2);
  }

  .editor-transition-preview {
    height: 18px;
    border-radius: 4px;
    background: linear-gradient(120deg, rgba(255, 255, 255, 0.08), var(--accent));
    border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  }

  .editor-transition-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.6);
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

  .editor-advance {
    gap: 12px;
  }

  .editor-interval {
    width: 70px;
  }

  .editor-check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .editor-check input {
    width: 14px;
    height: 14px;
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
