<!--
 Copyright (C) 2024 Dashmake Inc.
-->
<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { _$_documentEditorsList } from '../../../../../stores/editor.store'
  import { DocumentModel } from '../../../../../models/Document'
  import type { NavigationTab } from '../../../../../models/Tab'
  import ContextMenuWidget from '../../../../common/contextMenu/components/ContextMenuWidget.svelte'
  import type { ContextMenuItem } from '../../../../common/contextMenu/utils/utils'
  import EditorCommonUtils from '../../../../../utils/common.utils'
import { nodeApi } from '../../../../../utils/shims/node'

//   const nodeApi =
//     typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
//   const fs = nodeApi?.fs
//   const path = nodeApi?.path

  let searchQuery = $state('')
  let draggingId = $state<string | null>(null)
  let dragOverId = $state<string | null>(null)

  let menuShow = $state(false)
  let menuX = $state(0)
  let menuY = $state(0)
  let menuItems = $state<ContextMenuItem[]>([])
  let menuTab = $state<NavigationTab | null>(null)

  // Use $derived for reactive transformations
  const __openEditorsExplorer = $derived(
    ($_$_documentEditorsList ?? [])
      .map((de) => DocumentModel.toNavigationTab(de))
      .filter((tab): tab is NavigationTab => Boolean(tab))
  )

  function splitParentSegments(filePath: string): string[] {
    if (!nodeApi.path || !filePath) return []
    const dir = nodeApi.path.dirname(filePath)
    if (!dir) return []
    const parts = dir.split(nodeApi.path.sep).filter(Boolean)
    return parts.reverse()
  }

  function buildDisplayTabs(tabs: NavigationTab[]) {
    const grouped = new Map<string, NavigationTab[]>()
    tabs.forEach((tab) => {
      const key = tab.title || 'Untitled'
      const list = grouped.get(key) || []
      list.push(tab)
      grouped.set(key, list)
    })

    return tabs.map((tab) => {
      const list = grouped.get(tab.title) || []
      if (list.length <= 1 || !nodeApi.path) {
        return { ...tab, displayTitle: tab.title, suffix: '' }
      }

      const stacks = list.map((entry) => splitParentSegments(entry.documentPath))
      let depth = 1
      let suffix = ''
      const index = list.indexOf(tab)
      while (depth <= 5) {
        const candidate = stacks[index].slice(0, depth).join(nodeApi.path.sep)
        const isUnique = stacks.every((stack, idx) => {
          if (idx === index) return true
          return stack.slice(0, depth).join(nodeApi.path.sep) !== candidate
        })
        if (candidate) suffix = candidate
        if (isUnique) break
        depth += 1
      }
      return { ...tab, displayTitle: tab.title, suffix }
    })
  }

 // 1. Derive the display tabs from the explorer tabs
const displayTabs = $derived(buildDisplayTabs(__openEditorsExplorer));

// 2. Derive the filtered list based on the search query
const filteredTabs = $derived.by(() => {
  const query = searchQuery.trim().toLowerCase();
  
  if (!query) return displayTabs;

  return displayTabs.filter((tab) => {
    const titleMatch = tab.displayTitle.toLowerCase().includes(query);
    const suffixMatch = tab.suffix?.toLowerCase().includes(query);
    return titleMatch || suffixMatch;
  });
});

  function handleOnItemClick(tab: NavigationTab) {
    _$_documentEditorsList.setActive(tab.id)
  }

  async function handleClose(tab: NavigationTab) {
    const editor = _$_documentEditorsList.getItem(tab.id)
    const ok = await EditorCommonUtils.confirmCloseIfUnsaved(editor)
    if (!ok) return
    _$_documentEditorsList.closeTab(tab.id)
  }

  function handleDragStart(tabId: string) {
    draggingId = tabId
  }

  function handleDragOver(event: DragEvent, tabId: string) {
    event.preventDefault()
    dragOverId = tabId
  }

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) return
    const ids = displayTabs.map((tab) => tab.id)
    const fromIndex = ids.indexOf(draggingId)
    const toIndex = ids.indexOf(targetId)
    if (fromIndex < 0 || toIndex < 0) return
    ids.splice(fromIndex, 1)
    ids.splice(toIndex, 0, draggingId)
    _$_documentEditorsList.reorderByIds(ids)
    draggingId = null
    dragOverId = null
  }

  async function handleCloseAll() {
    const list = _$_documentEditorsList.getList()
    const ok = await EditorCommonUtils.confirmCloseManyIfUnsaved(list)
    if (!ok) return
    const ids = displayTabs.map((tab) => tab.id)
    ids.forEach((id) => _$_documentEditorsList.closeTab(id))
  }

  async function closeOthers(tab: NavigationTab) {
    const list = _$_documentEditorsList.getList()
    const toClose = list.filter((entry) => entry?.id !== tab.id && entry?.uuid !== tab.id)
    const ok = await EditorCommonUtils.confirmCloseManyIfUnsaved(toClose)
    if (!ok) return
    _$_documentEditorsList.closeOthers(tab.id)
  }

  async function closeRight(tab: NavigationTab) {
    const list = _$_documentEditorsList.getList()
    const index = list.findIndex((entry) => entry?.id === tab.id || entry?.uuid === tab.id)
    const toClose = index >= 0 ? list.slice(index + 1) : []
    const ok = await EditorCommonUtils.confirmCloseManyIfUnsaved(toClose)
    if (!ok) return
    _$_documentEditorsList.closeRight(tab.id)
  }

  function handleContextMenu(event: MouseEvent, tab: NavigationTab) {
    event.preventDefault()
    menuTab = tab
    menuX = event.clientX
    menuY = event.clientY
    menuItems = [
      {
        icon: 'ph-bold ph-x',
        label: 'Close',
        action: () => handleClose(tab)
      },
      {
        icon: 'ph-bold ph-rectangle-split',
        label: 'Close Others',
        action: () => closeOthers(tab)
      },
      {
        icon: 'ph-bold ph-arrow-right',
        label: 'Close to the Right',
        action: () => closeRight(tab)
      },
      {
        icon: 'ph-bold ph-folder-notch-open',
        label: 'Reveal in Explorer',
        action: async () => {
          if (!tab.documentPath) return
          await window.api.openFile(tab.documentPath)
        }
      }
    ]
    menuShow = true
  }

  function getFileIcon(fileName: string): string {
    const extension = fileName.includes('.') ? fileName.split('.').pop() || '' : ''
    const iconClass = `ph-light ph-file-${extension}`
    return `<i class="${iconClass}"></i>`
  }
</script>

<div class="">
  <div heading={$_('Open Documents')} class="collapsible" open>
    <i name="new-file" action-icon id="pin-icon"></i>
    <i name="refresh" action-icon id="refresh-icon"></i>
    <i
      name="save-all"
      action-icon
      id="filter-icon"
      onclick={() => EditorCommonUtils.saveAllUnsavedDocuments()}
      title={$_('Save All Unsaved')}
    ></i>
    <i name="close-all" action-icon id="filter-icon" onclick={handleCloseAll}></i>

    <div class="px-4 pb-2">
      <input
        class="w-full bg-base-200 border border-white/10 rounded px-2 py-1 text-[11px]"
        placeholder={$_('Filter open editors...')}
        bind:value={searchQuery}
      />
    </div>

    <!-- <vscode-scrollable>
      <vscode-tree> -->
        {#each filteredTabs as element (element.id)}
            <div
              class="group flex items-center h-7 px-2 transition-colors cursor-pointer
                {dragOverId === element.id
                ? 'bg-primary/25 border-l-2 border-primary'
                : element.isActive
                  ? 'bg-primary/20 border-l-2 border-primary'
                  : 'hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] border-l-2 border-transparent'}"
              onclick={() => handleOnItemClick(element)}
              oncontextmenu={(e) => handleContextMenu(e, element)}
              draggable={true}
              ondragstart={() => handleDragStart(element.id)}
              ondragover={(e) => handleDragOver(e, element.id)}
              ondrop={() => handleDrop(element.id)}
            >
              <span
                class="opacity-0 transition duration-150 group-hover:opacity-100 mr-2"
                onclick={() => handleClose(element)}
              >
                <i class="ph-light ph-x"></i>
              </span>
              {@html getFileIcon(element.title)}
              <span class="ml-2 text-[11px] truncate">
                {element.displayTitle}
              </span>
              {#if element.isDirty}
                <span class="ml-2 text-[9px] uppercase tracking-[0.2em] text-amber-400">{$_('Unsaved')}</span>
              {/if}
              {#if element.suffix}
                <span class="ml-1 text-[10px] opacity-40 truncate">— {element.suffix}</span>
              {/if}
            </div>
        {/each}
      <!-- </vscode-tree>
    </vscode-scrollable> -->
  </div>
</div>

<ContextMenuWidget bind:__show={menuShow} __x={menuX} __y={menuY} __menuItems={menuItems} />

<style>
</style>