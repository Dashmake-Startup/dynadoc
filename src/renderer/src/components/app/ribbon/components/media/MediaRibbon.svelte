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
      id: 'media-insert',
      title: _('Insert Media'),
      items: [
        createItem('PictureSelect', fluentUIcons.fluentUIconImage),
        createItem('VideoSelect', fluentUIcons.fluentUIconVideo),
        createItem('BookmarkMusicSelect', fluentUIcons.fluentUIconAudio)
      ]
    },
    {
      id: 'media-graphics',
      title: _('Graphics'),
      items: [
        createItem('DrawShapeSelect', fluentUIcons.fluentUIconDrawShape),
        createItem('GallerySelect', fluentUIcons.fluentUIconTableImage),
        createItem('ColorSelect', fluentUIcons.fluentUIconColor)
      ]
    },
    {
      id: 'media-widgets',
      title: _('Widgets'),
      items: [
        createItem('AppsSelect', fluentUIcons.fluentUIconApps),
        createItem('EmojiSelect', fluentUIcons.fluentUIconEmoji),
        createItem('HyperlinkSelect', fluentUIcons.fluentUIconLink)
      ]
    }
  ]
</script>

<GenericRibbon __groups={groups} />
