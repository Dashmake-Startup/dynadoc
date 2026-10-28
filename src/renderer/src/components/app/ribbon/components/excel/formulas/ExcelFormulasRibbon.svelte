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
    primary?: RibbonItem[]
    grid?: RibbonItem[]
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
      id: 'function-library',
      label: _('Function Library'),
      primary: [makeExcelItem('AutoSum'), makeExcelItem('FunctionInsert')].filter(Boolean),
      grid: [
        makeExcelItem('RecentlyUsed'),
        makeExcelItem('Financial'),
        makeExcelItem('Logical'),
        makeExcelItem('Text'),
        makeExcelItem('DateTime'),
        makeExcelItem('LookupReference'),
        makeExcelItem('MathTrig'),
        makeExcelItem('MoreFunctions')
      ].filter(Boolean)
    },
    {
      id: 'defined-names',
      label: _('Defined Names'),
      items: [
        makeExcelItem('NameManager'),
        makeExcelItem('DefineName'),
        makeExcelItem('UseInFormula'),
        makeExcelItem('CreateFromSelection')
      ].filter(Boolean)
    },
    {
      id: 'formula-auditing',
      label: _('Formula Auditing'),
      items: [
        makeExcelItem('TracePrecedents'),
        makeExcelItem('TraceDependents'),
        makeExcelItem('RemoveArrows'),
        makeExcelItem('ShowFormulas'),
        makeExcelItem('ErrorChecking'),
        makeExcelItem('EvaluateFormula'),
        makeExcelItem('WatchWindow')
      ].filter(Boolean)
    },
    {
      id: 'calculation',
      label: _('Calculation'),
      items: [makeExcelItem('CalculationOptions'), makeExcelItem('CalculateNow'), makeExcelItem('CalculateSheet')].filter(
        Boolean
      )
    }
  ].filter((group) => (group.items?.length ?? 0) + (group.primary?.length ?? 0) + (group.grid?.length ?? 0) > 0)
</script>

<div class="editor-formulas">
  <div class="editor-ribbon">
    {#each groups as group, idx}
      <div class="editor-group">
        <div class="editor-group-body">
          {#if group.primary}
            <div class="editor-primary">
              {#each group.primary as item}
                <div class="editor-item">
                  <svelte:component this={item.component} {...item.props} {compact} />
                </div>
              {/each}
            </div>
          {/if}

          {#if group.grid}
            <div class="editor-grid">
              {#each group.grid as item}
                <div class="editor-item editor-item-compact">
                  <svelte:component this={item.component} {...item.props} {compact} />
                </div>
              {/each}
            </div>
          {/if}

          {#if group.items}
            <div class="editor-row">
              {#each group.items as item}
                <div class="editor-item">
                  <svelte:component this={item.component} {...item.props} {compact} />
                </div>
              {/each}
            </div>
          {/if}
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
  .editor-formulas {
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
    min-width: 160px;
  }

  .editor-group-body {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .editor-primary {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 90px;
  }

  .editor-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .editor-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(90px, 1fr));
    gap: 8px 10px;
  }

  .editor-item {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 46px;
  }

  .editor-item-compact :global(.label) {
    font-size: 10px;
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
