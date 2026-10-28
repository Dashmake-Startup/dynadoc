<script lang="ts">
  import { get } from 'svelte/store'
  import { _ as base_ } from 'svelte-i18n'
  const _ = (key: string) => key

  import GenericRibbon from '../GenericRibbon.svelte'
  import type { Group, Item } from '../utils/utils'
  import {
    TranslationFormattingMap // Import the new translation map
  } from '../../../../common/actions/formatting'

  let { compact = false } = $props()

  // Organize groups based on translation professional standards
  const groups: Group[] = [
    {
      id: 'group-view-modes',
      title: _('Views'),
      items: [
        createItem('TranslationAddNew'),
        createItem('TranslationList'),
        createItem('TranslationViewMode')
      ]
    },
    {
      id: 'group-language',
      title: _('Language Pair'),
      items: [createItem('TargetLanguage')]
    },
    {
      id: 'group-workflow',
      title: _('Automation'),
      items: [createItem('AutoTranslate'), createItem('TranslationMemory')]
    },
    {
      id: 'group-review-qa',
      title: _('Review & QA'),
      items: [createItem('StatusSelect'), createItem('ConsistencyCheck')]
    },
    {
      id: 'group-export',
      title: _('Finalize'),
      items: [createItem('ProfessionalExport')]
    }
  ]

  /**
   * Helper function to map the TranslationFormattingMap to Group Items
   */
  function createItem(key: keyof typeof TranslationFormattingMap): Item {
    const config = TranslationFormattingMap[key]
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
</script>

<GenericRibbon __groups={groups} />
