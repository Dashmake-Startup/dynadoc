<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onDestroy } from 'svelte'
  import { _$_ribbonContext } from '../../../../../stores/ribbon.store'
  import { GenericFormatingEditorCommands } from '../../../../common/actions/formatting/commands/GenericFormatingEditorCommands.svelte'
  import { CustomSlideExtensionProps } from '../../../../../extensions/tiptap/CustomSlideExtension/utils/common.utils'
  import { CustomDesignExtensionProps } from '../../../../../extensions/tiptap/CustomDesignExtension/utils/common.utils'
  import { CustomSpreadsheetExtensionProps } from '../../../../../extensions/tiptap/CustomSpreadsheetExtension/utils/common.utils'
  import { CustomChartExtensionProps } from '../../../../../extensions/tiptap/CustomChartExtension/utils/common.utils'

  const typeLabels: Record<string, string> = {
    [CustomSlideExtensionProps.name]: 'Slides',
    [CustomDesignExtensionProps.name]: 'Designs',
    [CustomSpreadsheetExtensionProps.name]: 'Spreadsheets',
    [CustomChartExtensionProps.name]: 'Charts'
  }

  let activeLayout = $state('inline')
  let activeType = $state<string | null>(null)

  const unsubscribe = _$_ribbonContext.subscribe((ctx) => {
    activeLayout = GenericFormatingEditorCommands.getActiveNodeviewLayout?.() ?? 'inline'
    activeType = ctx?.activePositionableType ?? null
  })

  onDestroy(() => {
    unsubscribe?.()
  })

  const setLayout = (layout: string) => {
    GenericFormatingEditorCommands.setActiveNodeviewLayout?.(layout)
    activeLayout = layout
  }

  const nudge = (dx: number, dy: number) => {
    GenericFormatingEditorCommands.nudgeActiveNodeview?.(dx, dy)
  }

  const resetPosition = () => {
    GenericFormatingEditorCommands.resetActiveNodeviewPosition?.()
  }

  const resolveTypeLabel = (type: string | null) => {
    if (!type) return $_('Position')
    return typeLabels[type] ? $_(typeLabels[type]) : $_('Position')
  }
</script>

<div class="positioning-group">
  <div class="positioning-header">
    <span class="positioning-title">{resolveTypeLabel(activeType)}</span>
    <span class="positioning-subtitle">{$_('Position')}</span>
  </div>

  <div class="positioning-grid">
    <button
      class:is-active={activeLayout === 'inline'}
      on:click={() => setLayout('inline')}
      title={$_('In line with text')}
    >
      <i class="ph-bold ph-text-t"></i>
      <span>{$_('Inline')}</span>
    </button>
    <button
      class:is-active={activeLayout === 'center'}
      on:click={() => setLayout('center')}
      title={$_('Center')}
    >
      <i class="ph-bold ph-text-align-center"></i>
      <span>{$_('Center')}</span>
    </button>
    <button
      class:is-active={activeLayout === 'full'}
      on:click={() => setLayout('full')}
      title={$_('Full width')}
    >
      <i class="ph-bold ph-arrows-out-simple"></i>
      <span>{$_('Full')}</span>
    </button>
    <button
      class:is-active={activeLayout === 'float-left'}
      on:click={() => setLayout('float-left')}
      title={$_('Float left')}
    >
      <i class="ph-bold ph-text-align-left"></i>
      <span>{$_('Left')}</span>
    </button>
    <button
      class:is-active={activeLayout === 'float-right'}
      on:click={() => setLayout('float-right')}
      title={$_('Float right')}
    >
      <i class="ph-bold ph-text-align-right"></i>
      <span>{$_('Right')}</span>
    </button>
    <button
      class:is-active={activeLayout === 'front'}
      on:click={() => setLayout('front')}
      title={$_('In front of text')}
    >
      <i class="ph-bold ph-bring-forward"></i>
      <span>{$_('Front')}</span>
    </button>
    <button
      class:is-active={activeLayout === 'behind'}
      on:click={() => setLayout('behind')}
      title={$_('Behind text')}
    >
      <i class="ph-bold ph-send-back"></i>
      <span>{$_('Behind')}</span>
    </button>
  </div>

  <div class="positioning-row">
    <button on:click={() => nudge(-10, 0)} title={$_('Nudge left')}>
      <i class="ph-bold ph-arrow-left"></i>
    </button>
    <button on:click={() => nudge(10, 0)} title={$_('Nudge right')}>
      <i class="ph-bold ph-arrow-right"></i>
    </button>
    <button on:click={() => nudge(0, -10)} title={$_('Nudge up')}>
      <i class="ph-bold ph-arrow-up"></i>
    </button>
    <button on:click={() => nudge(0, 10)} title={$_('Nudge down')}>
      <i class="ph-bold ph-arrow-down"></i>
    </button>
    <button class="reset" on:click={resetPosition} title={$_('Reset position')}>
      <i class="ph-bold ph-arrow-counter-clockwise"></i>
      <span>{$_('Reset')}</span>
    </button>
  </div>
</div>

<style>
  .positioning-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 240px;
  }

  .positioning-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .positioning-title {
    font-size: 10px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.75);
  }

  .positioning-subtitle {
    font-size: 9px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.45);
  }

  .positioning-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .positioning-grid button,
  .positioning-row button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    color: rgba(255, 255, 255, 0.85);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    transition: all 0.15s ease;
    min-height: 28px;
  }

  .positioning-grid button span {
    font-size: 9px;
  }

  .positioning-grid button:hover,
  .positioning-row button:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.22);
  }

  .positioning-grid button.is-active {
    background: rgba(56, 189, 248, 0.15);
    border-color: rgba(56, 189, 248, 0.5);
    color: rgba(255, 255, 255, 0.95);
  }

  .positioning-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .positioning-row button {
    flex: 0 0 auto;
    padding: 6px;
    min-width: 30px;
  }

  .positioning-row .reset {
    margin-left: auto;
    padding: 6px 10px;
    gap: 6px;
  }
</style>
