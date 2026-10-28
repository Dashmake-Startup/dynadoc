<script lang="ts">
  const _ = (key: string) => key

  import { GenericFormattingComponentMap } from '../../../../common/actions/formatting'

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

  const groups: RibbonGroup[] = [
    {
      id: 'toc',
      label: _('Table of Contents'),
      items: [
        makeItem('TableOfContentsSelect', { __class: 'editor-select' }),
        makeItem('UpdateTableOfContents'),
        makeItem('TableOfContentsLevels', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'footnotes',
      label: _('Footnotes'),
      items: [
        makeItem('NoteSelect', { __class: 'editor-select', __label: _('Insert Footnote') }),
        makeItem('PreviousFootnoteSelect', { __class: 'editor-select' }),
        makeItem('NextFootnoteSelect', { __class: 'editor-select' }),
        makeItem('NoteAddSelect', { __class: 'editor-select', __label: _('Insert Endnote') }),
        makeItem('PreviousEndnoteSelect', { __class: 'editor-select' }),
        makeItem('NextEndnoteSelect', { __class: 'editor-select' }),
        makeItem('FootnoteSeparatorSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'captions',
      label: _('Captions'),
      items: [
        makeItem('CaptionSelect', { __class: 'editor-select' }),
        makeItem('InsertTableOfFigures'),
        makeItem('CrossReferenceSelect', { __class: 'editor-select' })
      ].filter(Boolean)
    },
    {
      id: 'index',
      label: _('Index'),
      items: [
        makeItem('MarkEntrySelect', { __class: 'editor-select' }),
        makeItem('InsertIndexSelect', { __class: 'editor-select' }),
        makeItem('UpdateIndexSelect')
      ].filter(Boolean)
    },
    {
      id: 'mail',
      label: _('Mail Merge'),
      items: [makeItem('MailMergeSelect')].filter(Boolean)
    },
    {
      id: 'settings',
      label: _('Settings'),
      items: [makeItem('ReferencesSettingsSelect', { __class: 'editor-select' })].filter(Boolean)
    }
  ]
</script>

<div class="editor-references">
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
  .editor-references {
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
