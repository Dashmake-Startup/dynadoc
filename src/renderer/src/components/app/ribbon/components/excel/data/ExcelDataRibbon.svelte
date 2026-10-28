<script lang="ts">
  const _ = (key: string) => key

  import { createExcelItemSafe } from '../utils/excelRibbonUtils'

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

  const makeExcelItem = (key: Parameters<typeof createExcelItemSafe>[0]) => {
    const item = createExcelItemSafe(key)
    if (!item) return null
    return {
      id: item.id,
      component: item.body.component,
      props: item.body.props
    }
  }

  const groups: RibbonGroup[] = [
    {
      id: 'pivot',
      label: _('PivotTable'),
      items: [makeExcelItem('InsertPivotTable')].filter(Boolean)
    },
    {
      id: 'sort-filter',
      label: _('Sort & Filter'),
      items: [
        makeExcelItem('Filter'),
        makeExcelItem('ShowAll'),
        makeExcelItem('Reapply'),
        makeExcelItem('Sort')
      ].filter(Boolean)
    },
    {
      id: 'duplicates',
      label: _('Duplicates'),
      items: [makeExcelItem('HighlightDuplicates'), makeExcelItem('ManageDuplicates')].filter(Boolean)
    },
    {
      id: 'data-tools',
      label: _('Data Tools'),
      items: [
        makeExcelItem('TextToColumns'),
        makeExcelItem('DataValidation'),
        makeExcelItem('Fill'),
        makeExcelItem('InsertDropDownList')
      ].filter(Boolean)
    },
    {
      id: 'consolidate',
      label: _('Consolidate'),
      items: [makeExcelItem('Consolidate')].filter(Boolean)
    },
    {
      id: 'outline',
      label: _('Outline'),
      items: [
        makeExcelItem('Subtotal'),
        makeExcelItem('Group'),
        makeExcelItem('Ungroup'),
        makeExcelItem('ShowDetail'),
        makeExcelItem('HideDetail')
      ].filter(Boolean)
    },
    {
      id: 'get-transform',
      label: _('Get & Transform'),
      items: [makeExcelItem('GetData'), makeExcelItem('RefreshAll')].filter(Boolean)
    },
    {
      id: 'connections',
      label: _('Connections'),
      items: [makeExcelItem('EditLinks')].filter(Boolean)
    },
    {
      id: 'what-if',
      label: _('What-If Analysis'),
      items: [makeExcelItem('WhatIfAnalysis')].filter(Boolean)
    },
    {
      id: 'settings',
      label: _('Settings'),
      items: [makeExcelItem('Settings')].filter(Boolean)
    }
  ].filter((group) => group.items.length)
</script>

<div class="editor-data">
  <div class="editor-ribbon">
    {#each groups as group, idx}
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
      {#if idx < groups.length - 1}
        <div class="editor-separator"></div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .editor-data {
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
    min-width: 120px;
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
</style>
