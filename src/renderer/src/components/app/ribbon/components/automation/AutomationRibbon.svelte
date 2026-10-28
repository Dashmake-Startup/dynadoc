<script lang="ts">
  import { get } from 'svelte/store'
  import { _ as base_ } from 'svelte-i18n'
  import GenericRibbon from '../GenericRibbon.svelte'
  import type { Group, Item } from '../utils/utils'
  import { GenericFormattingComponentMap } from '../../../../common/actions/formatting'
  import { fluentUIcons } from '../../../../common/icons/Icons'

  const _ = (key: string) => key

  function createItem(
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

  const groups: Group[] = [
    {
      id: 'automation-ai',
      title: _('AI Assistant'),
      items: [
        createItem('GenerateWithAI', fluentUIcons.fluentUIconSparkle),
        createItem('DummyContentGenerator', fluentUIcons.fluentUIconDocumentOnePage)
      ]
    },
    {
      id: 'automation-logic',
      title: _('Smart Content'),
      items: [
        createItem('VariableSelect', fluentUIcons.fluentUIconVariable),
        createItem('ProgrammingStyleComment', fluentUIcons.fluentUIconProgrammingStyleComment),
        createItem('SecuredContent', fluentUIcons.fluentUIconShield)
      ]
    },
    {
      id: 'automation-workflow',
      title: _('Workflow'),
      items: [
        createItem('TrackChangesSelect', fluentUIcons.fluentUIconHistory),
        createItem('CommentSelect', fluentUIcons.fluentUIconComment),
        createItem('TranslateSelect', fluentUIcons.fluentUIconTranslate)
      ]
    }
  ]
</script>

<GenericRibbon __groups={groups} />
