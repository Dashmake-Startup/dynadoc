<!--
 Copyright (C) 2024 Dashmake Inc.

 This file is part of DDoc Office.

 DDoc Office is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 DDoc Office is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
  const _ = (key: string) => key
  import GenericRibbon from '../GenericRibbon.svelte'
  import type { Group, Item } from '../utils/utils'
  import {
    GenericFormattingComponentMap,
    type GenericFormattingProps,
    type GenericFormattingPropsFactory

    // fluentUIconSplitHorizontal,
    // fluentUIconTable,
    // fluentUIconColor,
    // fluentUIconImage,
    // fluentUIconDrawShape,
    // fluentUIconLink,
    // fluentUIconList,
    // fluentUIconBookmark,
    // fluentUIconVideo,
    // fluentUIconCommentAdd,
    // fluentUIconDocumentHeader,
    // fluentUIconNumberSymbol,
    // fluentUIconMathFormula,
    // fluentUIconApps,
    // fluentUIconEmoji
  } from '../../../../common/actions/formatting'
  import { _$_ribbonContext } from '../../../../../stores/ribbon.store'
  import { createExcelItemSafe } from '../excel/utils/excelRibbonUtils'
  import Layout from '../../../../common/layout/layout'
  import GenericGroup from '../../../../common/actions/formatting/GenericGroup.svelte'

  let { compact = false } = $props()

  const sheetGroups: Group[] = [
    {
      id: 'sheet-tables',
      title: _('Tables'),
      items: [createExcelItemSafe('InsertPivotTable')].filter(Boolean)
    },
    {
      id: 'sheet-charts',
      title: _('Charts'),
      items: [createExcelItemSafe('InsertChart'), createExcelItemSafe('InsertSparklines')].filter(
        Boolean
      )
    },
    {
      id: 'sheet-text',
      title: _('Text'),
      items: [createExcelItemSafe('TextBox'), createExcelItemSafe('HeaderFooter')].filter(Boolean)
    }
  ].filter((group) => group.items.length)

  const makeLayout = (
    key: string,
    title: string,
    layout: string = Layout.LAYOUT.ROW,
    items: any
  ): Group | null => {
    return {
      id: key,
      title,
      layout,
      items: Array.isArray(items) ? items.filter(Boolean) : []
    }
  }

  function makeItem(
    key: keyof typeof GenericFormattingComponentMap,
    overrides: Partial<GenericFormattingProps | GenericFormattingPropsFactory> = {}
  ): Item | null {
    const entry = GenericFormattingComponentMap[key]
    if (!entry) return null
    const baseProps = typeof entry.props === 'function' ? entry.props({}) : entry.props
    return {
      id: key.toString(),
      variant: 'primary',
      body: {
        component: entry.component,
        props: { ...baseProps, ...overrides }
      }
    }
  }

  function makeGroupItem(
    id: string,
    items: Array<Item | null>,
    direction: Layout.DIRECTION = Layout.DIRECTION.HORIZONTAL
  ): Item {
    return {
      id,
      variant: 'primary',
      body: {
        component: GenericGroup,
        props: {
          direction,
          items: items.filter(Boolean)
        }
      }
    }
  }

  const editorGroups: Group[] = [
    makeLayout('pages', _('Pages'), Layout.LAYOUT.ROW, [
      makeItem('BlankPageSelect'),
      makeGroupItem(
        'cover-page-break',
        [
          makeItem('CoverPageSelect', { __direction: Layout.DIRECTION.VERTICAL }),
          makeItem('BreaksSelect', { __direction: Layout.DIRECTION.VERTICAL })
        ],
        Layout.DIRECTION.VERTICAL
      ),
      makeGroupItem(
        'page-number-header-footer',
        [
          makeItem('PageNumberSelect', { __direction: Layout.DIRECTION.VERTICAL }),
          makeItem('HeaderFooterSelect', { __direction: Layout.DIRECTION.VERTICAL })
        ],
        Layout.DIRECTION.VERTICAL
      )
    ]),

    makeLayout('Special', _('Special'), Layout.LAYOUT.ROW, [
      makeItem('TableSelect'),
      makeItem('WorksheetSelect'),
      makeItem('SlideSelect'),
      makeItem('DesignSelect'),
      makeItem('SurveySelect'),
      makeItem('LatexProjectSelect'),
      makeItem('ChartSelect'),
      makeItem('MermaidSelect'),
      makeItem('GallerySelect'),
      makeItem('IncludeSelect'),
      makeGroupItem(
        'cover-page-break',
        [
          makeItem('FileSelect', { __direction: Layout.DIRECTION.VERTICAL }),
          makeItem('AppsSelect', { __direction: Layout.DIRECTION.VERTICAL })
        ],
        Layout.DIRECTION.VERTICAL
      ),
      makeGroupItem(
        'page-number-header-footer',
        [
          makeItem('VideoSelect', { __direction: Layout.DIRECTION.VERTICAL })
          // makeItem('HeaderFooterSelect', { __direction: Layout.DIRECTION.VERTICAL })
        ],
        Layout.DIRECTION.VERTICAL
      )
    ]),
    makeLayout('links', _('Links'), Layout.LAYOUT.ROW, [
      makeItem('LinkSelect'),
      makeItem('InternalLinkSelect'),
      makeItem('BookmarkSelect')
    ]),
    makeLayout('illustrations', _('Illustrations'), Layout.LAYOUT.ROW, [
      // makeItem('TableSelect'),
      makeItem('PictureSelect'),
      makeItem('ScreenshotSelect'),
      makeItem('ShapesSelect'),
      makeItem('TextBoxSelect'),
      makeItem('WordArtSelect'),
      // makeItem('SmartArtSelect'),
      // makeItem('ChartSelect')
      makeGroupItem(
        'page-number-header-footer',
        [
          makeItem('SmartArtSelect', { __direction: Layout.DIRECTION.VERTICAL }),
          makeItem('ChartSelect', { __direction: Layout.DIRECTION.VERTICAL })
        ],
        Layout.DIRECTION.VERTICAL
      )
    ]),
    makeLayout('symbols', _('Symbols'), Layout.LAYOUT.ROW, [
      makeItem('SymbolSelect'),
      makeItem('EquationSelect')
    ]),

    makeLayout('comments', _('Comments'), Layout.LAYOUT.ROW, [
      makeItem('CommentInsert'),
      makeItem('EnvelopesSelect')
    ])
  ]
</script>

<GenericRibbon __groups={editorGroups} />

<!-- {#if $_$_ribbonContext.inSheet} -->
<!-- <GenericRibbon __groups={sheetGroups} /> -->
<!-- {:else}
  <div class="editor-insert">
    <div class="editor-ribbon">
      {#each editorSections as section, idx}
        <div class="editor-section">
          {#if section.badge}
            <div class="editor-badge">{section.badge}</div>
          {/if}
          {#each section.items as item}
            <div class="editor-item">
              <svelte:component this={item.component} {...item.props} {compact} />
            </div>
          {/each}
        </div>
        {#if idx < editorSections.length - 1}
          <div class="editor-separator"></div>
        {/if}
      {/each}
    </div>
  </div>
{/if} -->

<style>
  .editor-insert {
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
    min-width: 52px;
  }

  .editor-separator {
    width: 1px;
    height: 40px;
    background: rgba(255, 255, 255, 0.08);
  }

  .editor-badge {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 2px 6px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.7);
    margin-right: 6px;
  }

  :global(.editor-insert .uppercase) {
    text-transform: none;
  }

  :global(.editor-insert .tracking-tighter) {
    letter-spacing: 0;
  }

  :global(.editor-insert .editor-select span) {
    font-weight: 600;
  }
</style>
