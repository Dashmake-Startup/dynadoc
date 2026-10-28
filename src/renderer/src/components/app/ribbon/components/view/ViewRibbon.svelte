<script lang="ts">
  const _ = (key: string) => key

  import GenericRibbon from '../GenericRibbon.svelte'
  import type { Group } from '../utils/utils'
  import { GenericFormattingComponentMap, GenericFormatingEditorCommands } from '../../../../common/actions/formatting'
  import { _$_ribbonContext } from '../../../../../stores/ribbon.store'
  import { createExcelItemSafe, createTableItem } from '../excel/utils/excelRibbonUtils'

  let { compact = false } = $props()

  type RibbonItem = {
    id: string
    component: any
    props: Record<string, any>
  }

  type RibbonGroup = {
    id: string
    label: string
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

  let showRuler = $state(false)
  let showMarkup = $state(true)
  let showTableGridlines = $state(false)
  let showTaskWindow = $state(false)
  let showGridlines = $state(false)

  const sheetGroups: Group[] = [
    {
      id: 'sheet-workbook-views',
      title: 'Workbook Views',
      items: [
        createExcelItemSafe('NormalView'),
        createExcelItemSafe('PageBreakPreview'),
        createExcelItemSafe('PageLayoutView')
      ].filter(Boolean)
    },
    {
      id: 'sheet-show',
      title: 'Show',
      items: [createTableItem('ViewGridlines'), createExcelItemSafe('Headings')].filter(Boolean)
    },
    {
      id: 'sheet-window',
      title: 'Window',
      items: [
        createExcelItemSafe('NewWindow'),
        createExcelItemSafe('ArrangeAll'),
        createExcelItemSafe('FreezePanes'),
        createExcelItemSafe('Split')
      ].filter(Boolean)
    },
    {
      id: 'sheet-macros',
      title: 'Macros',
      items: [createExcelItemSafe('Macros'), createExcelItemSafe('RecordMacro')].filter(Boolean)
    }
  ].filter((group) => group.items.length)

  const viewGroups: RibbonGroup[] = [
    {
      id: 'document-views',
      label: _('Document Views'),
      items: [
        makeItem('ViewFullScreenSelect'),
        makeItem('ViewPrintLayoutSelect'),
        makeItem('ViewOutlineSelect'),
        makeItem('ViewWebLayoutSelect'),
        makeItem('ViewNavigationPaneSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'zoom',
      label: _('Zoom'),
      items: [
        makeItem('ZoomSelect', { __class: 'editor-select' }),
        makeItem('ViewZoom100Select'),
        makeItem('ViewPageWidthSelect'),
        makeItem('ViewOnePageSelect'),
        makeItem('ViewMultiplePagesSelect')
      ].filter(Boolean)
    },
    {
      id: 'immersive',
      label: _('Immersive'),
      items: [makeItem('ViewEyeProtectionSelect')].filter(Boolean)
    },
    {
      id: 'window',
      label: _('Window'),
      items: [
        makeItem('ViewRearrangePanesSelect', { __class: 'editor-select' }),
        makeItem('ViewNewWindowSelect'),
        makeItem('ViewSplitWindowSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'side-by-side',
      label: _('View'),
      items: [
        makeItem('ViewSideBySideSelect'),
        makeItem('ViewSynchronousScrollingSelect'),
        makeItem('ViewResetWindowPositionSelect')
      ].filter(Boolean)
    }
  ]
</script>

{#if $_$_ribbonContext.inSheet}
  <GenericRibbon __groups={sheetGroups} />
{:else}
  <div class="editor-view">
    <div class="editor-ribbon">
      <div class="editor-group">
        <div class="editor-group-body">
          <div class="editor-toggle">
            <label>
              <input type="checkbox" bind:checked={showRuler} on:change={() => GenericFormatingEditorCommands.toggleRuler(showRuler)} />
              <span>{_('Ruler')}</span>
            </label>
            <label>
              <input type="checkbox" bind:checked={showMarkup} on:change={() => GenericFormatingEditorCommands.toggleMarkup(showMarkup)} />
              <span>{_('Markup')}</span>
            </label>
            <label>
              <input
                type="checkbox"
                bind:checked={showTableGridlines}
                on:change={() => GenericFormatingEditorCommands.toggleTableGridlines()}
              />
              <span>{_('Table Gridlines')}</span>
            </label>
            <label>
              <input type="checkbox" bind:checked={showTaskWindow} on:change={() => GenericFormatingEditorCommands.toggleTaskWindow()} />
              <span>{_('Task Window')}</span>
            </label>
            <label>
              <input type="checkbox" bind:checked={showGridlines} on:change={() => GenericFormatingEditorCommands.toggleGridlines(showGridlines)} />
              <span>{_('Gridlines')}</span>
            </label>
          </div>
        </div>
        <div class="editor-group-label">{_('Show')}</div>
      </div>
      <div class="editor-separator"></div>
      {#each viewGroups as group, idx}
        <div class="editor-group">
          <div class="editor-group-body">
            {#each group.items as item}
              <div class="editor-item">
                <svelte:component this={item.component} {...item.props} {compact} />
              </div>
            {/each}
          </div>
          <div class="editor-group-label">{group.label}</div>
        </div>
        {#if idx < viewGroups.length - 1}
          <div class="editor-separator"></div>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .editor-view {
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

  .editor-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 150px;
  }

  .editor-group-body {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .editor-item {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 46px;
  }

  .editor-group-label {
    font-size: 9px;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.35);
    text-align: center;
  }

  .editor-separator {
    width: 1px;
    height: 46px;
    background: rgba(255, 255, 255, 0.08);
  }

  .editor-toggle {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
  }

  .editor-toggle label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .editor-toggle input {
    width: 14px;
    height: 14px;
  }

  :global(.editor-select .label) {
    text-transform: none !important;
    letter-spacing: normal !important;
  }
</style>
