<script lang="ts">
  import { _ } from 'svelte-i18n'
  import TranslateEditor from './TranslateEditor.svelte'

  // Svelte 5 Props
  let {
    _allTabs = [],
    __activeTab = $bindable(),
    __filePathToOpenFromDocument = $bindable()
    // setActiveTab,
    // scrollLeft,
    // scrollRight
  } = $props()

  let _translatedFilesTabContainer = $state<HTMLElement>()

  // keep track of which tabs are already loaded
  let _loadedTabs: Set<string> = new Set([__activeTab])

  const setActiveTab = (tab: string) => {
    __activeTab = tab
    _loadedTabs.add(tab) // mark as loaded
  }

  // First set the active tab to the file to open from document
  setActiveTab(__activeTab)

  function scrollLeft() {
    _translatedFilesTabContainer.scrollBy({ left: -100, behavior: 'smooth' })
  }

  function scrollRight() {
    _translatedFilesTabContainer.scrollBy({ left: 100, behavior: 'smooth' })
  }
</script>

<div
  class="app-component-no-print flex items-center bg-base-200 border-b border-base-200 h-9 select-none"
>
  <button
    class="w-7 h-full flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-base-300 transition-all border-r border-base-200"
    onclick={scrollLeft}
  >
    <i class="ph-light ph-caret-left text-[14px]"></i>
  </button>

  <div
    bind:this={_translatedFilesTabContainer}
    class="flex-1 overflow-x-auto no-scrollbar flex items-center h-full px-1 scroll-smooth"
  >
    {#each _allTabs as tab}
      <button
        class="relative h-full flex items-center px-4 cursor-pointer whitespace-nowrap transition-all group"
        class:bg-base-100={__activeTab === tab}
        class:text-primary={__activeTab === tab}
        class:font-bold={__activeTab === tab}
        class:text-base-content={__activeTab !== tab}
        class:opacity-60={__activeTab !== tab}
        onclick={() => setActiveTab(tab)}
      >
        <i class="ph-light ph-file-text mr-2 text-[14px] group-hover:scale-110 transition-transform"
        ></i>

        <span class="text-[11px] uppercase tracking-wider"> {tab}</span>

        {#if __activeTab === tab}
          <div class=" bottom-0 left-0 right-0 h-[2px] bg-primary">
            <!-- dddd -->
          </div>
        {/if}

        {#if __activeTab !== tab}
          <div class=" right-0 top-1/4 bottom-1/4 w-[1px] bg-base-300 opacity-50"></div>
        {/if}
      </button>
    {/each}
  </div>

  <button
    class="w-7 h-full flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-base-300 transition-all border-l border-base-200"
    onclick={scrollRight}
  >
    <i class="ph-light ph-caret-right text-[14px]"></i>
  </button>

  <button
    class="w-9 h-full flex items-center justify-center hover:bg-primary/10 hover:text-primary border-l border-base-200 transition-colors"
  >
    <i class="ph-light ph-plus text-[16px]"></i>
  </button>
</div>

<div class="tab-content flex-1">
  {#each _allTabs as tab, index}
    {#if index > 0 && __activeTab === tab}
      <TranslateEditor __originalPath={__filePathToOpenFromDocument} __translatedPath={tab} />
    {/if}
  {/each}
</div>

<style>
  /* Hide scrollbar for Adobe "Clean" look */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
</style>
