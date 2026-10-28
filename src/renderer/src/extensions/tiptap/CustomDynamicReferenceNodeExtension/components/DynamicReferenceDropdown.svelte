<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { CustomAIExtensionProps } from '../../CustomAIExtension/utils/common.utils'
  import { CustomDesignExtensionProps } from '../../CustomDesignExtension/utils/common.utils'
  import { CustomChartExtensionProps } from '../../CustomChartExtension/utils/common.utils'
  import { CustomFileExtensionProps, CustomFolderExtensionProps } from '../../CustomFileFolderExtension/utils/common.utils'
  import { CustomSlideExtensionProps } from '../../CustomSlideExtension/utils/common.utils'
  import { CustomSpreadsheetExtensionProps } from '../../CustomSpreadsheetExtension/utils/common.utils'
  import { CustomVarExtensionProps } from '../../CustomVarExtension/utils/common.utils'
  import type { SuggestionItemsType } from '../utils/utils'
  interface Props {
    items: SuggestionItemsType[]
    activeIndex: number
    selectItem: Function
    position
  }
  let { items, activeIndex, selectItem, position }: Props = $props()

  let visibleCount = $state(50)
  let container = $state()

  function handleScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    if (scrollHeight - scrollTop <= clientHeight + 150) {
      if (visibleCount < items.length) visibleCount += 50
    }
  }

  // Helper to identify node type for Adobe-style icons
  function getNodeIcon1(content) {
    if (content.includes('<h')) return 'ph-text-h-one'
    if (content.includes('<img')) return 'ph-image'
    if (content.includes('<li')) return 'ph-list-bullets'
    return 'ph-paragraph'
  }
  function getNodeIcon(content, item?: SuggestionItemsType) {
    if (item?.type === CustomFileExtensionProps.name) return 'ph-file'
    if (item?.type === CustomFolderExtensionProps.name) return 'ph-folder'
    if (item?.type === CustomVarExtensionProps.name) return 'ph-brackets-curly'
    if (!content) return 'ph-paragraph'

    // We use a priority list: specific structural elements first
    const icons = [
      { tag: '<table', icon: 'ph-table' },
      { tag: '<tr', icon: 'ph-table' }, // Table Row
      { tag: '<ul', icon: 'ph-list-bullets' },
      { tag: '<ol', icon: 'ph-list-numbers' },
      { tag: '<li', icon: 'ph-list-bullets' },
      { tag: '<img', icon: 'ph-image' },
      { tag: '<video', icon: 'ph-video' },
      { tag: '<code', icon: 'ph-code' },
      { tag: '<blockquote', icon: 'ph-quotes' },
      { tag: '<hr', icon: 'ph-minus' }, // Horizontal Rule
      { tag: '<h1', icon: 'ph-text-h-one' },
      { tag: '<h2', icon: 'ph-text-h-two' },
      { tag: '<h3', icon: 'ph-text-h-three' },
      { tag: '<h', icon: 'ph-text-h' }, // Fallback for other headings

      // Custom Tags from your Pro App
      { tag: `<${CustomSlideExtensionProps.name}`, icon: 'ph-presentation-chart' },
      { tag: `<${CustomDesignExtensionProps.name}`, icon: 'ph-palette' },
      { tag: `<${CustomAIExtensionProps.name}`, icon: 'ph-sparkle' },
      { tag: `<${CustomSpreadsheetExtensionProps.name}`, icon: 'ph-microsoft-excel-logo' },
      { tag: `<${CustomChartExtensionProps.name}`, icon: 'ph-chart-line-up' },
      // { tag: '<excel', icon: 'ph-microsoft-excel-logo' },
      { tag: `<${CustomVarExtensionProps.name}`, icon: 'ph-brackets-curly' }
    ]

    // Find the first match based on priority
    const match = icons.find((item) => content.includes(item.tag))

    return match ? match.icon : 'ph-paragraph'
  }

  function getNodeContent(content, index = 0, item?: SuggestionItemsType) {
    // if (!content) return 'Empty block';
    if (!content || content.trim() === '') return 'Empty block'

    // 1. Check for Heavy Structural Elements first
    if (content.includes('<table')) return `Table [${index + 1}]`
    if (content.includes(`<${CustomSpreadsheetExtensionProps.name}`))
      return `Spreadsheet [${index + 1}]`
    if (content.includes(`<${CustomChartExtensionProps.name}`)) return `Chart [${index + 1}]`
    if (content.includes(`<${CustomSlideExtensionProps.name}`)) return `Slide: ${index + 1}`
    if (content.includes(`<${CustomDesignExtensionProps.name}`)) return `Design Workspace`

    // 2. Check for Media/Embeds
    if (content.includes('<img')) return 'Image Attachment'
    if (content.includes('<video')) return 'Video Content'
    // if (content.includes(`<${CustomMona.name}`)) return 'Code Snippet';

    // 3. Handle Lists and Quotes
    if (content.includes('<ul') || content.includes('<ol')) return 'List Items...'
    if (content.includes('<blockquote')) return 'Quote...'

    // 4. Handle Custom Variables or AI tags
    if (item?.type === CustomVarExtensionProps.name || item?.type === CustomFileExtensionProps.name || item?.type === CustomFolderExtensionProps.name) {
      return item.display || '{Variable}'
    }
    if (content.includes(`<${CustomAIExtensionProps.name}`)) return 'AI Generated Response'

    return content
    // 5. Fallback for Standard Text
    // Strip HTML tags and return a truncated preview of the actual text
    /* const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  const plainText = tempDiv.textContent || tempDiv.innerText || '';
  
  if (plainText.trim().length === 0) return 'Non-text content';
  
  return plainText.length > 40 
    ? plainText.substring(0, 40) + '...' 
    : plainText; */
  }
  $effect(() => {
    if (container && activeIndex >= 0) {
      const activeEl = container.querySelector(`[data-index="${activeIndex}"]`)
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  })
</script>

<div
  bind:this={container}
  onscroll={handleScroll}
  class="fixed z-[1000] flex flex-col overflow-y-auto
         rounded-xl border border-white/10 bg-base-100/80 backdrop-blur-2xl
         shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/5"
  style="width: 360px; max-height: 480px;"
  style:left="{position?.x ?? 0}px"
  style:top="{position?.y ?? 0}px"
  style:visibility={position?.x ? 'visible' : 'hidden'}
>
  <div
    class="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-base-100/40 px-4 py-2 backdrop-blur-md"
  >
    <span class="text-[10px] font-bold uppercase tracking-widest text-base-content/40">
      {$_('Select Reference')}
    </span>
    <span class="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
      {items.length} Matches
    </span>
  </div>

  <div class="p-1.5">
    {#each items.slice(0, visibleCount) as item, i}
      <button
        data-index={i}
        onclick={() => selectItem(item)}
        class="group relative flex w-full flex-col gap-2 rounded-lg border-none bg-transparent p-3 text-left transition-all duration-200 cursor-pointer
               {i === activeIndex ? 'bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] shadow-inner' : 'hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)]'}"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i
              class="ph-bold {getNodeIcon(item.html, item)} text-[12px] {i === activeIndex
                ? 'text-primary'
                : 'text-base-content/30'}"
            ></i>
            <span class="font-mono text-[9px] font-medium text-base-content/20">
              {item.type === CustomVarExtensionProps.name ||
              item.type === CustomFileExtensionProps.name ||
              item.type === CustomFolderExtensionProps.name
                ? item.display
                : item.id}
            </span>
            <!-- <span class="font-mono text-[9px] font-medium text-base-content/20">0x{item.id.slice(0, 8)}</span> -->
          </div>

          {#if i === activeIndex}
            <div
              class="flex items-center gap-1 text-[9px] font-bold text-primary animate-in fade-in slide-in-from-right-1"
            >
              <span>{$_('INSERT')}</span>
              <i class="ph-bold ph-arrow-bend-down-left"></i>
            </div>
          {/if}
        </div>

        <div
          class="content-preview prose-invert pointer-events-none line-clamp-2 text-[13px] leading-relaxed text-base-content/70 transition-colors group-hover:text-base-content"
        >
          {@html getNodeContent(item.html, i, item)}
          <!-- {@html item.content} -->
        </div>

        {#if i === activeIndex}
          <div
            class="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary shadow-[0_0_12px_rgba(124,58,237,0.5)]"
          ></div>
        {/if}
      </button>
    {/each}
  </div>

  {#if items.length <= 0}
    <div class="flex items-center justify-center gap-2 p-4 text-[10px] text-base-content/20">
      <div class="h-1 w-1 animate-bounce rounded-full bg-[color-mix(in_srgb,var(--color-base-white)_20%,transparent)]"></div>
      <span class="font-medium uppercase tracking-tighter">{$_('Loading references...')}</span>
    </div>
  {/if}
  {#if items.length > visibleCount}
    <div class="flex items-center justify-center gap-2 p-4 text-[10px] text-base-content/20">
      <div class="h-1 w-1 animate-bounce rounded-full bg-[color-mix(in_srgb,var(--color-base-white)_20%,transparent)]"></div>
      <span class="font-medium uppercase tracking-tighter">{$_('Loading more assets')}</span>
    </div>
  {/if}
</div>

<style>
  /* Adobe-style Custom Scrollbar */
  div::-webkit-scrollbar {
    width: 4px;
  }
  div::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }
  div::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Resetting potential leaked styles from prose */
  .content-preview :global(p),
  .content-preview :global(h1),
  .content-preview :global(h2) {
    display: inline;
    margin: 0;
    font-size: inherit;
    font-weight: inherit;
    color: inherit;
  }
</style>
