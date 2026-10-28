<script lang="ts">
  import { _ } from 'svelte-i18n'
  import LayoutSelect from '../../../common/layout/LayoutSelect.svelte'
  import type { Group } from './utils/utils'
  import RibbonGroupMenu from './RibbonGroupMenu.svelte'

  let { group } = $props<{ group: Group }>()

  const categoryIcons: Record<string, string> = {
    clipboard: 'ph-clipboard-text',
    font: 'ph-text-aa',
    paragraph: 'ph-text-align-left',
    styles: 'ph-palette',
    editing: 'ph-magnifying-glass',
    insert: 'ph-plus-circle',
    table: 'ph-table',
    media: 'ph-image',
    layout: 'ph-layout',
    page: 'ph-file-text',
    references: 'ph-book-open-text',
    review: 'ph-check-square',
    view: 'ph-eye',
    data: 'ph-chart-bar',
    formulas: 'ph-function',
    draw: 'ph-pencil-simple',
    shapes: 'ph-shapes',
    animation: 'ph-sparkle',
    transition: 'ph-arrows-left-right',
    automation: 'ph-lightning',
    translate: 'ph-translate',
    comments: 'ph-chat-centered-text'
  }

  const iconFor = (id: string) =>
    categoryIcons[id] ||
    Object.entries(categoryIcons).find(([key]) => id.toLowerCase().includes(key))?.[1] ||
    'ph-squares-four'

  const iconMarkup = $derived(`<i class="ph-light ${iconFor(group.id)} text-[xx-large]"></i>`)
</script>

<LayoutSelect
  __class="ribbon-group-select"
  __label={$_(group.title)}
  __description={$_(group.title)}
  __icon={iconMarkup}
  __data={RibbonGroupMenu}
  __selectDataProps={{ group }}
/>

<!-- <style lang="postcss">
  :global(.ribbon-group-select) {
    min-width: 68px;
    color: color-mix(in srgb, var(--color-base-content) 75%, transparent);
    transition: color 150ms ease;
  }

  :global(.ribbon-group-select:hover) {
    color: var(--color-primary);
  }

  :global(.ribbon-group-select .icon-wrapper) {
    min-height: 37px;
    border-radius: 0.375rem;
  }

  :global(.ribbon-group-select .layout-select-label) {
    min-height: 17px;
    padding: 0 0.25rem 0.15rem;
    border-radius: 0.375rem;
  }

  :global(.ribbon-group-select .layout-select-label-text) {
    max-width: 78px;
    font-size: 9px;
    font-weight: 700;
    line-height: 1.1;
  }

  :global(.ribbon-group-select-icon) {
    font-size: 25px;
    line-height: 1;
  }
</style> -->
