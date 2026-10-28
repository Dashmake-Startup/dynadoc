<script lang="ts">
  const _ = (key: string) => key

  import GenericRibbon from '../GenericRibbon.svelte'
  import type { Group } from '../utils/utils'
  import { GenericFormattingComponentMap } from '../../../../common/actions/formatting'
  import ReviewRibbonPanel from './ReviewRibbonPanel.svelte'
  import { _$_ribbonContext } from '../../../../../stores/ribbon.store'
  import { createExcelItemSafe } from '../excel/utils/excelRibbonUtils'

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

  const makeCustomItem = (id: string, component: any, props: Record<string, any> = {}) => ({
    id,
    component,
    props
  })

  const baseGroups: RibbonGroup[] = [
    {
      id: 'proofing',
      label: _('Proofing'),
      items: [
        makeItem('AISpellCheckSelect', { __class: 'editor-select' }),
        makeItem('ThesaurusSelect'),
        makeItem('DocumentOnePageSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'compare',
      label: _('Compare'),
      items: [makeItem('ReviewCompareSelect', { __class: 'editor-select' })].filter(Boolean)
    },
    {
      id: 'comments',
      label: _('Comments'),
      items: [
        makeItem('CommentSelect', { __label: _('New Comment') }),
        makeItem('CommentDismissSelect', { __label: _('Delete') }),
        makeItem('CommentPreviousSelect'),
        makeItem('CommentNextSelect')
      ].filter(Boolean)
    },
    {
      id: 'tracking',
      label: _('Tracking'),
      items: [
        makeItem('TrackChangesSelect', { __class: 'editor-select' }),
        makeItem('ReviewShowMarkupSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'changes',
      label: _('Changes'),
      items: [
        makeItem('AcceptRevisionSelect', { __class: 'editor-select', __label: _('Accept') }),
        makeItem('RejectRevisionSelect', { __class: 'editor-select', __label: _('Reject') })
      ].filter(Boolean)
    },
    {
      id: 'review-panel',
      label: '',
      items: [makeCustomItem('review-panel', ReviewRibbonPanel)].filter(Boolean)
    },
    {
      id: 'draw',
      label: _('Draw'),
      items: [makeItem('ReviewDrawSelect')].filter(Boolean)
    },
    {
      id: 'language',
      label: _('Language'),
      items: [
        makeItem('ReviewTraditionalSelect'),
        makeItem('ReviewSimplifiedSelect'),
        makeItem('ReviewConversionSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'protect',
      label: _('Protect'),
      items: [makeItem('ReviewRestrictEditingSelect')].filter(Boolean)
    },
    {
      id: 'translate',
      label: _('Translate'),
      items: [makeItem('ParallelTranslateSelect')].filter(Boolean)
    },
    {
      id: 'settings',
      label: _('Settings'),
      items: [makeItem('ReviewSettingsSelect', { __class: 'editor-select' })].filter(Boolean)
    }
  ]

  const sheetGroups: Group[] = [
    {
      id: 'sheet-proofing',
      title: 'Proofing',
      items: [createExcelItemSafe('Spelling'), createExcelItemSafe('Accessibility')].filter(Boolean)
    },
    {
      id: 'sheet-protect',
      title: 'Protect',
      items: [createExcelItemSafe('ProtectSheet'), createExcelItemSafe('AllowEditRanges')].filter(
        Boolean
      )
    },
    {
      id: 'sheet-insights',
      title: 'Insights',
      items: [createExcelItemSafe('SmartLookup'), createExcelItemSafe('Insights')].filter(Boolean)
    }
  ].filter((group) => group.items.length)
</script>

{#if $_$_ribbonContext.inSheet}
  <GenericRibbon __groups={sheetGroups} />
{:else}
  <div class="editor-review">
    <div class="editor-ribbon">
      {#each baseGroups as group, idx}
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
        {#if idx < baseGroups.length - 1}
          <div class="editor-separator"></div>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .editor-review {
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
    min-width: 140px;
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

  :global(.editor-select .label) {
    text-transform: none !important;
    letter-spacing: normal !important;
  }
</style>
