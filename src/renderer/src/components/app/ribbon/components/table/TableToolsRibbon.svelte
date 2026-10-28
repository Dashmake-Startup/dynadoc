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

  let _rowHeight = $state('0.17')
  let _colWidth = $state('2.96')

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

  const makeGenericItem = (
    key: keyof typeof GenericFormattingComponentMap,
    overrides: Record<string, any> = {}
  ) => {
    const entry = GenericFormattingComponentMap[key]
    if (!entry) return null
    const baseProps = typeof entry.props === 'function' ? entry.props({}) : entry.props
    return {
      id: key.toString(),
      component: entry.component,
      props: { ...baseProps, ...overrides }
    }
  }

  const applyTableAlign = (
    vertical: 'top' | 'middle' | 'bottom',
    horizontal: 'left' | 'center' | 'right'
  ) => {
    if (horizontal === 'left') GenericFormatingEditorCommands.alignLeft()
    if (horizontal === 'center') GenericFormatingEditorCommands.alignCenter()
    if (horizontal === 'right') GenericFormatingEditorCommands.alignRight()

    if (vertical === 'top') GenericFormatingEditorCommands.alignTop()
    if (vertical === 'middle') GenericFormatingEditorCommands.alignMiddle()
    if (vertical === 'bottom') GenericFormatingEditorCommands.alignBottom()
  }

  const sections: RibbonSection[] = [
    {
      id: 'table',
      items: [
        makeTableItem('TableProperties', { __layout: Layout.LAYOUT.ROW }),
        makeTableItem('ViewGridlines', { __layout: Layout.LAYOUT.ROW })
      ].filter(Boolean)
    },
    {
      id: 'draw',
      items: [
        makeTableItem('DrawTable', { __layout: Layout.LAYOUT.COLUMN }),
        makeTableItem('Eraser', { __layout: Layout.LAYOUT.COLUMN })
      ].filter(Boolean)
    },
    {
      id: 'rows-columns',
      items: [
        makeTableItem('TableDeleteSelect', { __class: 'editor-select' }),
        makeTableItem('TableInsertSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'merge',
      items: [
        makeTableItem('MergeCells', { __class: 'editor-select' }),
        makeTableItem('SplitCells', { __layout: Layout.LAYOUT.COLUMN }),
        makeTableItem('SplitTable', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'cell-size',
      items: [makeTableItem('AutoFit', { __class: 'editor-select' })].filter(Boolean)
    },
    {
      id: 'font',
      items: [
        makeGenericItem('FontPicker'),
        makeGenericItem('FontSizeDecrease', { __layout: Layout.LAYOUT.ICON }),
        makeGenericItem('FontSizeIncrease', { __layout: Layout.LAYOUT.ICON }),
        makeGenericItem('TextBold'),
        makeGenericItem('TextItalic'),
        makeGenericItem('TextUnderline'),
        makeGenericItem('TextColorSelect', {
          __layout: Layout.LAYOUT.SELECT,
          __class: 'editor-select'
        })
      ].filter(Boolean)
    },
    {
      id: 'alignment',
      items: [makeTableItem('TextDirection', { __layout: Layout.LAYOUT.COLUMN })].filter(Boolean)
    },
    {
      id: 'data',
      items: [
        makeTableItem('Formula', { __layout: Layout.LAYOUT.ROW }),
        makeTableItem('FastCalculation', { __class: 'editor-select' }),
        makeTableItem('ConvertTableToText', { __layout: Layout.LAYOUT.ROW }),
        makeTableItem('RepeatHeaderRows', { __layout: Layout.LAYOUT.ROW }),
        makeTableItem('Sort', { __class: 'editor-select' }),
        makeTableItem('TableSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    }
  ]
</script>

<div class="editor-table-tools">
  <div class="editor-ribbon">
    {#each sections as section, idx}
      <div class="editor-section">
        {#if section.id === 'cell-size'}
          {#each section.items as item}
            <div class="editor-item">
              <svelte:component this={item.component} {...item.props} {compact} />
            </div>
          {/each}
          <div class="editor-cell-size">
            <div class="editor-size-input">
              <div class="editor-size-label">{_('Height')}</div>
              <input
                type="number"
                step="0.01"
                bind:value={_rowHeight}
                on:change={() =>
                  GenericFormatingEditorCommands.setTableRowHeight(Number(_rowHeight))}
              />
              <span>in</span>
            </div>
            <div class="editor-size-input">
              <div class="editor-size-label">{_('Width')}</div>
              <input
                type="number"
                step="0.01"
                bind:value={_colWidth}
                on:change={() =>
                  GenericFormatingEditorCommands.setTableColumnWidth(Number(_colWidth))}
              />
              <span>in</span>
            </div>
          </div>
        {:else if section.id === 'alignment'}
          <div class="editor-align-grid">
            <button on:click={() => applyTableAlign('top', 'left')}></button>
            <button on:click={() => applyTableAlign('top', 'center')}></button>
            <button on:click={() => applyTableAlign('top', 'right')}></button>
            <button on:click={() => applyTableAlign('middle', 'left')}></button>
            <button on:click={() => applyTableAlign('middle', 'center')}></button>
            <button on:click={() => applyTableAlign('middle', 'right')}></button>
            <button on:click={() => applyTableAlign('bottom', 'left')}></button>
            <button on:click={() => applyTableAlign('bottom', 'center')}></button>
            <button on:click={() => applyTableAlign('bottom', 'right')}></button>
          </div>
          {#each section.items as item}
            <div class="editor-item">
              <svelte:component this={item.component} {...item.props} {compact} />
            </div>
          {/each}
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
  .editor-table-tools {
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

  .editor-cell-size {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 2px 6px;
  }

  .editor-size-input {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 2px 6px;
    font-size: 11px;
  }

  .editor-size-input input {
    width: 52px;
    background: transparent;
    border: none;
    color: inherit;
    font-size: 11px;
  }

  .editor-size-input input:focus {
    outline: none;
  }

  .editor-size-label {
    opacity: 0.6;
    font-size: 10px;
  }

  .editor-align-grid {
    display: grid;
    grid-template-columns: repeat(3, 18px);
    grid-template-rows: repeat(3, 18px);
    gap: 2px;
    padding: 2px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
  }

  .editor-align-grid button {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
  }

  .editor-align-grid button:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  :global(.editor-table-tools .uppercase) {
    text-transform: none;
  }

  :global(.editor-table-tools .tracking-tighter) {
    letter-spacing: 0;
  }
</style>
