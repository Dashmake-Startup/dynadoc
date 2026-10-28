<script lang="ts">
  import { get } from 'svelte/store'
  import { _ as base_ } from 'svelte-i18n'
  import GenericRibbon from '../GenericRibbon.svelte'
  import type { Group, Item } from '../utils/utils'
  import {
    GenericFormattingComponentMap,
    TableLayoutFormattingMap
  } from '../../../../common/actions/formatting'
  import { fluentUIcons } from '../../../../common/icons/Icons'
  import { _$_ribbonContext } from '../../../../../stores/ribbon.store'
  import { createExcelItemSafe } from '../excel/utils/excelRibbonUtils'
  import ExcelDataRibbon from '../excel/data/ExcelDataRibbon.svelte'

  const _ = (key: string) => key

  function createGenericItem(
    key: keyof typeof GenericFormattingComponentMap,
    icon?: string
  ): Item {
    const config = GenericFormattingComponentMap[key]
    return {
      id: key.toString(),
      variant: 'primary',
      body: {
        component: config.component,
        props: {
          ...config.props,
          ...(icon ? { __icon: `<div class="text-base-content-600 w-[25px] max-w-[max-content]">${icon}</div>` } : {})
        }
      }
    }
  }

  function createTableItem(key: keyof typeof TableLayoutFormattingMap): Item {
    const config = TableLayoutFormattingMap[key]
    return {
      id: key.toString(),
      variant: 'primary',
      body: {
        component: config.component,
        props: {
          ...config.props
        }
      }
    }
  }

  const baseGroups: Group[] = [
    {
      id: 'data-grid',
      title: _('Sheets & Tables'),
      items: [
        createGenericItem('WorksheetSelect', fluentUIcons.fluentUIconSpreadsheet),
        createGenericItem('TableSelect', fluentUIcons.fluentUIconTable),
        createTableItem('TableInsertSelect')
      ]
    },
    {
      id: 'data-calculation',
      title: _('Calculation'),
      items: [
        createTableItem('Formula'),
        createGenericItem('MathFormulaSelect', fluentUIcons.fluentUIconMathFormula),
        createGenericItem('NumberSymbolSelect', fluentUIcons.fluentUIconNumberSymbol)
      ]
    },
    {
      id: 'data-quality',
      title: _('Data Quality'),
      items: [
        createTableItem('Sort'),
        createGenericItem('TextSearch', fluentUIcons.fluentUIconSearch),
        createGenericItem('TextReplace', fluentUIcons.fluentUIconReplace)
      ]
    }
  ]

  const sheetGroups: Group[] = [
    {
      id: 'sheet-import-export',
      title: _('Import & Export'),
      items: [createExcelItemSafe('ImportExcel'), createExcelItemSafe('ExportExcel')].filter(Boolean)
    },
    {
      id: 'sheet-get-transform',
      title: _('Get & Transform'),
      items: [
        createExcelItemSafe('GetData'),
        createExcelItemSafe('QueriesConnections'),
        createExcelItemSafe('RefreshAll')
      ].filter(Boolean)
    },
    {
      id: 'sheet-sort-filter',
      title: _('Sort & Filter'),
      items: [
        createTableItem('Sort'),
        createExcelItemSafe('Filter'),
        createExcelItemSafe('Advanced')
      ].filter(Boolean)
    },
    {
      id: 'sheet-data-tools',
      title: _('Data Tools'),
      items: [
        createExcelItemSafe('TextToColumns'),
        createExcelItemSafe('RemoveDuplicates'),
        createExcelItemSafe('DataValidation'),
        createExcelItemSafe('FlashFill')
      ].filter(Boolean)
    },
    {
      id: 'sheet-forecast',
      title: _('Forecast'),
      items: [createExcelItemSafe('WhatIfAnalysis'), createExcelItemSafe('ForecastSheet')].filter(
        Boolean
      )
    },
    {
      id: 'sheet-outline',
      title: _('Outline'),
      items: [
        createExcelItemSafe('Group'),
        createExcelItemSafe('Ungroup'),
        createExcelItemSafe('Subtotal')
      ].filter(Boolean)
    },
    {
      id: 'sheet-functions',
      title: _('Function Library'),
      items: [createExcelItemSafe('AutoSum'), createExcelItemSafe('FunctionInsert')].filter(Boolean)
    },
    {
      id: 'sheet-defined-names',
      title: _('Defined Names'),
      items: [
        createExcelItemSafe('NameManager'),
        createExcelItemSafe('DefineName'),
        createExcelItemSafe('UseInFormula')
      ].filter(Boolean)
    },
    {
      id: 'sheet-formula-auditing',
      title: _('Formula Auditing'),
      items: [
        createExcelItemSafe('TracePrecedents'),
        createExcelItemSafe('TraceDependents'),
        createExcelItemSafe('ErrorChecking'),
        createExcelItemSafe('EvaluateFormula')
      ].filter(Boolean)
    },
    {
      id: 'sheet-calculation',
      title: _('Calculation'),
      items: [
        createExcelItemSafe('CalculationOptions'),
        createExcelItemSafe('CalculateNow'),
        createExcelItemSafe('CalculateSheet')
      ].filter(Boolean)
    }
  ].filter((group) => group.items.length)

  const groups: Group[] = $_$_ribbonContext.inSheet
    ? sheetGroups
    : baseGroups
</script>

{#if $_$_ribbonContext.inSheet}
  <ExcelDataRibbon />
{:else}
  <GenericRibbon __groups={groups} />
{/if}
