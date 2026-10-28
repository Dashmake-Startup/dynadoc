<script lang="ts">
  import { _ } from 'svelte-i18n'

  import GenericRibbon from '../GenericRibbon.svelte'
  import type { Group } from '../utils/utils'

  import { GenericFormattingComponentMap, GenericFormatingEditorCommands } from '../../../../common/actions/formatting'
  import { _$_ribbonContext, _$_ribbonAutoHidden, _$_ribbonUserVisible } from '../../../../../stores/ribbon.store'
  import { _$_wysiwygEditorsList } from '../../../../../stores/editor.store'
  import type { PaginationPlusOptions } from '../../../../../extensions/tiptap/utils/common.utils'
  import { createExcelItemSafe, createTableItem } from '../excel/utils/excelRibbonUtils'
  import PositioningRibbonGroup from './PositioningRibbonGroup.svelte'

  // import {
  //   fluentUIconMargin,
  //   fluentUIconPageOrientation,
  //   fluentUIconPageFit,
  //   fluentUIconColumnTriple,
  //   fluentUIconNumberRow,
  //   fluentUIconMoreCircle,
  //   fluentUIconBorder,
  //   fluentUIconColorFill
  // } from '../../../../common/actions/formatting'
  import { fluentUIcons } from '../../../../common/icons/Icons'

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

  const PX_PER_INCH = 96

  let marginTop = $state('1')
  let marginBottom = $state('1')
  let marginLeft = $state('1')
  let marginRight = $state('1')
  let isEditingMargins = $state(false)

  const inchToPx = (value: string) => {
    const n = Number(value)
    if (Number.isNaN(n) || !Number.isFinite(n)) return null
    return Number((n * PX_PER_INCH).toFixed(2))
  }

  const pxToInch = (value: number | null | undefined) => {
    if (!value || Number.isNaN(value)) return ''
    const inches = value / PX_PER_INCH
    return Number(inches.toFixed(2)).toString()
  }

  const applyMargins = () => {
   

          // return
    const top = inchToPx(marginTop)
    const bottom = inchToPx(marginBottom)
    const left = inchToPx(marginLeft)
    const right = inchToPx(marginRight)
    if (top === null || bottom === null || left === null || right === null) return
    // _$_ribbonAutoHidden.set(false)
    // _$_ribbonUserVisible.set(true)
    GenericFormatingEditorCommands.updatePageMargins({ top, bottom, left, right })
  }

  const keepRibbonVisible = () => {
    // _$_ribbonAutoHidden.set(false)
    // _$_ribbonUserVisible.set(true)
  }

  const formatPageSize = (options?: PaginationPlusOptions | null) => {
    if (!options) return ''
    const width = Number((options.pageWidth / PX_PER_INCH).toFixed(2))
    const height = Number((options.pageHeight / PX_PER_INCH).toFixed(2))
    return `${width} × ${height} in`
  }

  const getOrientationLabel = (options?: PaginationPlusOptions | null) => {
    if (!options) return ''
    return options.pageWidth >= options.pageHeight ? $_('Landscape') : $_('Portrait')
  }

  const activeEntryStore = _$_wysiwygEditorsList.getActive()
  let activeEntry = $derived($activeEntryStore)
  let paginationOptions: PaginationPlusOptions | null = $state(null)
  let paginationUnsubscribe: (() => void) | null = null

  $effect(() => {
    const editorId = activeEntry?.id?.toString()
    paginationUnsubscribe?.()
    paginationOptions = null
    if (!editorId) return
    const store = _$_wysiwygEditorsList.getPaginationOptionsStore(editorId)
    if (!store) return
    paginationUnsubscribe = store.subscribe((next) => {
      paginationOptions = next
      if (!next || isEditingMargins) return
      marginTop = pxToInch(next.marginTop)
      marginBottom = pxToInch(next.marginBottom)
      marginLeft = pxToInch(next.marginLeft)
      marginRight = pxToInch(next.marginRight)
    })
    return () => paginationUnsubscribe?.()
  })

  const baseGroups: Group[] = [
    {
      id: 'layout-margin',
      title: 'Margins',
      items: [
        {
          id: 'margin',
          variant: 'primary',
          body: {
            component: GenericFormattingComponentMap.MarginSelect.component,
            props: {
              ...GenericFormattingComponentMap.MarginSelect.props,
              __icon: `<div class="text-base-content-600 w-[25px] max-w-[max-content]">${fluentUIcons.fluentUIconMargin}</div>`
            }
          }
        }
      ]
    },
    {
      id: 'layout-orientation',
      title: 'Orientation',
      items: [
        {
          id: 'orientation',
          variant: 'primary',
          body: {
            component: GenericFormattingComponentMap.PageOrientationSelect.component,
            props: {
              ...GenericFormattingComponentMap.PageOrientationSelect.props,
              __icon: `<div class="text-base-content-600 w-[25px] max-w-[max-content]">${fluentUIcons.fluentUIconPageOrientation}</div>`
            }
          }
        }
      ]
    },
    {
      id: 'layout-size',
      title: 'Page Size',
      items: [
        {
          id: 'page-size',
          variant: 'primary',
          body: {
            component: GenericFormattingComponentMap.PageSizeSelect.component,
            props: {
              ...GenericFormattingComponentMap.PageSizeSelect.props,
              __icon: `<div class="text-base-content-600 w-[25px] max-w-[max-content]">${fluentUIcons.fluentUIconPageFit}</div>`
            }
          }
        }
      ]
    },
    {
      id: 'layout-columns',
      title: 'Columns',
      items: [
        {
          id: 'columns',
          variant: 'primary',
          body: {
            component: GenericFormattingComponentMap.ColumnsSelect.component,
            props: {
              ...GenericFormattingComponentMap.ColumnsSelect.props,
              __icon: `<div class="text-base-content-600 w-[25px] max-w-[max-content]">${fluentUIcons.fluentUIconColumnTriple}</div>`
            }
          }
        }
      ]
    },
    {
      id: 'layout-line-numbers',
      title: 'Line Numbers',
      items: [
        {
          id: 'line-numbers',
          variant: 'primary',
          body: {
            component: GenericFormattingComponentMap.LineNumberSelect.component,
            props: {
              ...GenericFormattingComponentMap.LineNumberSelect.props,
              __icon: `<div class="text-base-content-600 w-[25px] max-w-[max-content]">${fluentUIcons.fluentUIconNumberRow}</div>`
            }
          }
        }
      ]
    },
    {
      id: 'layout-borders',
      title: 'Borders',
      items: [
        {
          id: 'border',
          variant: 'primary',
          body: {
            component: GenericFormattingComponentMap.BorderSelect.component,
            props: {
              ...GenericFormattingComponentMap.BorderSelect.props,
              __icon: `<div class="text-base-content-600 w-[25px] max-w-[max-content]">${fluentUIcons.fluentUIconBorder}</div>`
            }
          }
        }
      ]
    },
    {
      id: 'layout-background',
      title: 'Page Color',
      items: [
        {
          id: 'background',
          variant: 'primary',
          body: {
            component: GenericFormattingComponentMap.ColorFillSelect.component,
            props: {
              ...GenericFormattingComponentMap.ColorFillSelect.props,
              __icon: `<div class="text-base-content-600 w-[25px] max-w-[max-content]">${fluentUIcons.fluentUIconColorFill}</div>`
            }
          }
        }
      ]
    },
    {
      id: 'layout-more',
      title: 'More',
      items: [
        {
          id: 'more-options',
          variant: 'primary',
          body: {
            component: GenericFormattingComponentMap.MoreSelect.component,
            props: {
              ...GenericFormattingComponentMap.MoreSelect.props,
              __icon: `<div class="text-base-content-600 w-[25px] max-w-[max-content]">${fluentUIcons.fluentUIconMoreCircle}</div>`
            }
          }
        }
      ]
    }
  ]

  const sheetGroups: Group[] = [
    {
      id: 'sheet-themes',
      title: 'Themes',
      items: [createExcelItemSafe('Themes'), createExcelItemSafe('Colors'), createExcelItemSafe('Fonts')].filter(
        Boolean
      )
    },
    {
      id: 'sheet-scale',
      title: 'Scale to Fit',
      items: [
        createExcelItemSafe('ScaleToFit'),
        createExcelItemSafe('PrintArea'),
        createExcelItemSafe('Breaks')
      ].filter(Boolean)
    },
    {
      id: 'sheet-options',
      title: 'Sheet Options',
      items: [createTableItem('ViewGridlines'), createExcelItemSafe('Headings')].filter(Boolean)
    },
    {
      id: 'sheet-arrange',
      title: 'Arrange',
      items: [
        createExcelItemSafe('BringForward'),
        createExcelItemSafe('SendBackward'),
        createExcelItemSafe('SelectionPane')
      ].filter(Boolean)
    }
  ].filter((group) => group.items.length)

  const positioningGroups: Group[] = $_$_ribbonContext.hasPositionableNode
    ? [
        {
          id: 'layout-positioning',
          title: 'Position',
          items: [
            {
              id: 'positioning-controls',
              variant: 'primary',
              body: {
                component: PositioningRibbonGroup,
                props: {}
              }
            }
          ]
        }
      ]
    : []

  const editorGroups: RibbonGroup[] = [
    {
      id: 'page-setup',
      label: $_('Page Setup'),
      items: [
        makeItem('MarginSelect', { __class: 'editor-select', __label: $_('Margins') }),
        makeItem('PageOrientationSelect', { __class: 'editor-select', __label: $_('Orientation') }),
        makeItem('PageSizeSelect', { __class: 'editor-select', __label: $_('Size') }),
        makeItem('ColumnsSelect', { __class: 'editor-select' }),
        makeItem('TextDirection', { __label: $_('Text Direction') })
      ].filter(Boolean)
    },
    {
      id: 'page-background',
      label: $_('Page Background'),
      items: [
        makeItem('BorderSelect', { __class: 'editor-select', __label: $_('Page Borders') }),
        makeItem('ColorFillSelect', { __class: 'editor-select', __label: $_('Page Color') }),
        makeItem('WatermarkSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'page-elements',
      label: $_('Page Elements'),
      items: [
        makeItem('LineNumberSelect', { __class: 'editor-select' }),
        makeItem('CoverPageSelect', { __class: 'editor-select' }),
        makeItem('BlankPageSelect'),
        makeItem('TableOfContentsSelect', { __class: 'editor-select' }),
        makeItem('BreaksSelect', { __class: 'editor-select' }),
        makeItem('SectionPaneSelect'),
        makeItem('DeleteSectionSelect')
      ].filter(Boolean)
    },
    {
      id: 'headers',
      label: $_('Headers & Footers'),
      items: [
        makeItem('PageNumberSelect', { __class: 'editor-select', __label: $_('Page Number') }),
        makeItem('HeaderFooterSelect', { __class: 'editor-select', __label: $_('Header') })
      ].filter(Boolean)
    }
  ]

  const groups: Group[] = $_$_ribbonContext.inSheet
    ? [...positioningGroups, ...sheetGroups]
    : [...positioningGroups, ...baseGroups]
</script>

{#if $_$_ribbonContext.inSheet}
  <div class="editor-layout" on:pointerdown|capture={keepRibbonVisible}>
    <GenericRibbon __groups={groups} />
  </div>
{:else}
  <div class="editor-layout" on:pointerdown|capture={keepRibbonVisible}>
    <div class="editor-ribbon">
      {#if $_$_ribbonContext.hasPositionableNode}
        <div class="editor-group">
          <div class="editor-group-body">
            <div class="editor-item">
              <svelte:component this={PositioningRibbonGroup} />
            </div>
          </div>
          <div class="editor-group-label">{ $_('Position')}</div>
        </div>
        <div class="editor-separator"></div>
      {/if}

      {#each editorGroups as group, idx}
        <div class="editor-group">
          <div class="editor-group-body">
            {#if group.id === 'page-setup'}
              <div class="editor-margins">
                <div class="editor-margins-row">
                  <label>{ $_('Top')}</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    bind:value={marginTop}
                    on:focus={() => (isEditingMargins = true)}
                    on:blur={() => (isEditingMargins = false)}
                    on:change={applyMargins}
                  />
                  <span>in</span>
                  <label>{ $_('Bottom')}</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    bind:value={marginBottom}
                    on:focus={() => (isEditingMargins = true)}
                    on:blur={() => (isEditingMargins = false)}
                    on:change={applyMargins}
                  />
                  <span>in</span>
                </div>
                <div class="editor-margins-row">
                  <label>{ $_('Left')}</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    bind:value={marginLeft}
                    on:focus={() => (isEditingMargins = true)}
                    on:blur={() => (isEditingMargins = false)}
                    on:change={applyMargins}
                  />
                  <span>in</span>
                  <label>{ $_('Right')}</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    bind:value={marginRight}
                    on:focus={() => (isEditingMargins = true)}
                    on:blur={() => (isEditingMargins = false)}
                    on:change={applyMargins}
                  />
                  <span>in</span>
                </div>
                {#if paginationOptions}
                  <div class="editor-page-meta">
                    <span>{ $_('Size')}:</span>
                    <strong>{formatPageSize(paginationOptions)}</strong>
                    <span class="editor-dot">•</span>
                    <span>{ $_('Orientation')}:</span>
                    <strong>{getOrientationLabel(paginationOptions)}</strong>
                  </div>
                {/if}
              </div>
            {/if}
            {#each group.items as item}
              <div class="editor-item">
                <svelte:component this={item.component} {...item.props} {compact} />
              </div>
            {/each}
          </div>
          <div class="editor-group-label">{group.label}</div>
        </div>
        {#if idx < editorGroups.length - 1}
          <div class="editor-separator"></div>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .editor-layout {
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

  .editor-margins {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 2px 6px;
  }

  .editor-margins-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
  }

  .editor-margins-row label {
    min-width: 36px;
  }

  .editor-margins-row input {
    width: 56px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(15, 23, 42, 0.8);
    color: white;
    padding: 2px 6px;
  }

  .editor-page-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.55);
  }

  .editor-page-meta strong {
    font-weight: 700;
    color: rgba(255, 255, 255, 0.85);
  }

  .editor-dot {
    opacity: 0.4;
  }

  :global(.editor-select .label) {
    text-transform: none !important;
    letter-spacing: normal !important;
  }
</style>
