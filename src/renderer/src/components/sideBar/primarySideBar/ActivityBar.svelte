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
<!-- Activity.svelte -->

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { createEventDispatcher } from 'svelte'
  import Utils from '../../../utils/Utils'
  import {
    _$_documentEditorsList,
    _$_wysiwygEditorsList,
    type WysiwygEditorEntry,
    type WysiwygEditorNodeviewEntry
  } from '../../../stores/editor.store'
  import {
    _$_activePrimarySidebarItem,
    _$_leftSidebarVisible,
    _$_primarySidebarContentVisibility,
    _$_primarySidebarVisible,
    _$_primarySidebarItemOrder,
    type PrimarySidebarItemId
  } from '../../../stores/common.store'
  import { fluentUIcons } from '../../common/icons/Icons'
  import VerticalToolBar from '../../../extensions/tiptap/CustomDesignExtension/components/toolBar/verticalToolBar/VerticalToolBar.svelte'
  import { CustomDesignExtensionProps } from '../../../extensions/tiptap/CustomDesignExtension/utils/common.utils'
  // import '@phosphor-icons/web/light'
  // import '@phosphor-icons/web/bold'

  const dispatch = createEventDispatcher<{ command: { id: string } }>()

  // export let active: string = 'explorer'

  type Item = {
    id: PrimarySidebarItemId
    // id: string
    label: string
    icon: string
    // active?: boolean
    badge?: string
  }

  const activeDocumentEditorStore = _$_documentEditorsList.getActive()
  let activeEditor = $derived($activeDocumentEditorStore)
  let activeWysiwyg: WysiwygEditorEntry | undefined
  let activeNodeview: WysiwygEditorNodeviewEntry | undefined

  $effect(() => {
    console.log(' yes focus activeNodeview acti55', activeEditor, _$_wysiwygEditorsList.getList())

    // 1️⃣ Get currently active document editor
    // const activeDoc = get(_$_documentEditorsList.getActive());
    // if (!activeDoc) {
    //   console.warn('No active document editor');
    //   return false;
    // }

    /*  activeWysiwyg = _$_wysiwygEditorsList.getEntry(activeEditor?.id)

    activeNodeview = _$_wysiwygEditorsList.getActiveNodeview(activeWysiwyg?.id)
    console.log(
      ' yes focus activeNodeview acti',
      activeWysiwyg,
      activeNodeview,
      _$_wysiwygEditorsList.getList()
    ) */
  })

  $effect(() => {
    // const unsubscribe = _$_wysiwygEditorsList.subscribe((value) => {
    activeWysiwyg = _$_wysiwygEditorsList.getEntry(activeEditor?.id)

    //  activeWysiwyg = value[activeEditor?.id]

    activeNodeview = _$_wysiwygEditorsList.getActiveNodeview(activeWysiwyg?.id)
    console.log(
      ' yes focus activeNodeview acti',
      activeWysiwyg,
      activeNodeview,
      _$_wysiwygEditorsList.getList()
    )
    // })
  })

  const items: Item[] = [
    {
      id: 'navigation',
      label: 'Navigation Pane',
      icon: fluentUIcons.fluentUIconContentView
      // here we will have 3 tabs: content (table of content), section, bookmarks
      // active: true
    },
    {
      id: 'outline',
      label: 'Outline',
      icon: fluentUIcons.fluentUIconList
    },
    {
      id: 'explorer',
      label: 'Explorer',
      icon: fluentUIcons.fluentUIconDocumentFolder
      // active: true
    },
    {
      id: 'drive',
      label: 'Drive',
      // icon: fluentUIcons.fluentUIconDocumentFolder
      icon:
        // '<i class="ph-light ph-cloud-lightning text-[25px]"></i>'
        `
      <div class="w-[40px] _h-full_8cje8z flex items-center">
    <i class="text-[25px] ph-light ph-cloud-lightning"></i>
</div>
      `
      // active: true
    },
    // { id: 'explorer', label: 'Explorer', icon: 'ph-files', active:true },
    { id: 'search', label: 'Search', icon: fluentUIcons.fluentUIconSearch },
    // { id: 'search', label: 'Search', icon: 'ph-magnifying-glass' },
    {
      id: 'versionControl',
      label: 'Source Control',
      icon: fluentUIcons.fluentUIconBranch
      // active: true
    },
    {
      id: 'contribute',
      label: 'Contribute',
      icon: `
      <div class="w-[40px] _h-full_8cje8z flex items-center">
        <i class="text-[25px] ph-light ph-github-logo"></i>
      </div>
      `
    }
    /* ,{
      id: 'terminal',
      label: 'Terminal',
      icon: fluentUIcons.fluentUIconWindowConsole
      // active: true
    } */
    // { id: 'versionControl', label: 'Source Control', icon: 'ph-git-branch' }
    // { id: 'git', label: 'Source Control', icon: 'ph-git-branch' }
    // { id: 'debug', label: 'Run & Debug', icon: 'ph-bug' },
    // { id: 'extensions', label: 'Extensions', icon: 'ph-puzzle-piece' }
  ]

  let draggingId: PrimarySidebarItemId | null = null
  let dragOverIndex = $state<number | null>(null)
  let dragInsertPosition = $state<'before' | 'after'>('before')

  let orderedItems = $derived.by(() => {
    const order = $_$_primarySidebarItemOrder || []
    if (!order.length) return items
    const map = new Map(items.map((item) => [item.id, item]))
    const ordered = order.map((id) => map.get(id)).filter(Boolean) as Item[]
    const rest = items.filter((item) => !order.includes(item.id))
    return [...ordered, ...rest]
  })

  function clickItem2(item: Item) {
    if (_$_primarySidebarContentVisibility[item.id] === false) {
      // set
      _$_primarySidebarVisible.set(true)
      // hide all items inside _$_primarySidebarContentVisibility
      _$_primarySidebarContentVisibility[item.id].set(true)
    } else {
      _$_primarySidebarVisible.set(false)
      // hide all items inside _$_primarySidebarContentVisibility
    }
    //if _$_primarySidebarVisible
    // dispatch('command', { id: item.id })
    // active = item.id
  }

  function clickItem(item: { id: PrimarySidebarItemId }) {
    // function clickItem(item: { id: PrimarySidebarItemId }) {
    _$_activePrimarySidebarItem.update((current) => {
      if (current === item.id) {
        // Toggle off
        _$_primarySidebarVisible.set(false)
        return null
      }

      // Switch panel
      _$_primarySidebarVisible.set(true)
      return item.id
    })
  }

  function handleDragStart(event: DragEvent, id: PrimarySidebarItemId) {
    draggingId = id
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', id)
    }
  }

  function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault()
    dragOverIndex = index
    const target = event.currentTarget as HTMLElement
    if (target) {
      const rect = target.getBoundingClientRect()
      dragInsertPosition = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    }
  }

  function handleDrop(event: DragEvent, index: number) {
    event.preventDefault()
    if (!draggingId) return
    const ids = orderedItems.map((item) => item.id)
    const fromIndex = ids.indexOf(draggingId)
    if (fromIndex < 0) return
    let toIndex = index
    if (dragInsertPosition === 'after') toIndex += 1
    ids.splice(fromIndex, 1)
    if (toIndex > ids.length) toIndex = ids.length
    ids.splice(toIndex, 0, draggingId)
    _$_primarySidebarItemOrder.set(ids)
    draggingId = null
    dragOverIndex = null
  }

  function handleDragEnd() {
    draggingId = null
    dragOverIndex = null
  }

  function collapseSidebar() {
    _$_primarySidebarVisible.set(false)
    _$_leftSidebarVisible.set(false)
  }
</script>

<div
  id="activity-bar"
  class="activity-bar relative scrollable-section rounded-[0_10px_10px_0] border border-light dark:border-dark border-l-0"
>
  <button
    class="sidebar-collapse-control sidebar-collapse-control-left"
    type="button"
    title={$_('Collapse left sidebar')}
    aria-label={$_('Collapse left sidebar')}
    onclick={collapseSidebar}
  >
    <i class="ph-bold ph-x"></i>
  </button>
  <!-- {#if Object.values(Utils.IMAGE_EXTENSIONS).includes(activeEditor?.document?.extension) || activeNodeview?.type == CustomDesignExtensionProps.name} -->
  <div id="image-editor-toolbar-bar-pane" class="hidden">
    <VerticalToolBar></VerticalToolBar>
  </div>
  <!-- {:else} -->
  <div id="activity-bar-pane">
    <div class="flex flex-col items-center justify-between w-full h-full">
      <!-- top items -->
      <div class="activity-group flex flex-col items-center gap-1 mt-2">
        {#each orderedItems as item, index (item.id)}
          <!-- <button
            class="relative w-full h-12 flex items-center justify-center transition-colors
               hover:bg-neutral-200 dark:hover:bg-neutral-800
               {active === item.id ? 'bg-neutral-200 dark:bg-neutral-800' : ''}"
            aria-label={item.label}
            title={item.label}
            onclick={() => clickItem(item)}
          >
            <div class="text-base-content-600 w-[40px] max-w-[max-content]">
              {@html item.icon}
            </div> -->
          <!-- <i class="ph-light {item.icon} text-2xl"></i> -->
          <!-- </button> -->

          <button
            class="
                    activity-btn w-[90%] flex justify-center items-center relative
                    cursor-pointer transition-colors
                "
            class:border-base-300={$_$_activePrimarySidebarItem === item.id}
            class:border-r-10={$_$_activePrimarySidebarItem === item.id}
            title={item.label}
            draggable
            ondragstart={(event) => handleDragStart(event, item.id)}
            ondragover={(event) => handleDragOver(event, index)}
            ondrop={(event) => handleDrop(event, index)}
            ondragend={handleDragEnd}
            onclick={() => clickItem(item)}
          >
            {#if dragOverIndex === index}
              <div
                class="absolute left-1 right-1 h-1 bg-primary/80 rounded-full"
                style={dragInsertPosition === 'before' ? 'top:2px;' : 'bottom:2px;'}
              ></div>
            {/if}
            <!-- <div
              class="
                        absolute left-0 top-0 bottom-0 w-[2px]
                        bg-primary transition-opacity
                    "
              class:opacity-100={$_$_activePrimarySidebarItem === item.id}
              class:opacity-0={$_$_activePrimarySidebarItem !== item.id}
              class:active={$_$_activePrimarySidebarItem === item.id}
            ></div> -->

            <div
              class="
                        activity-btn-inner w-[40px] h-full flex justify-center items-center
                        transition-colors p-2
                    "
              class:text-base-content={$_$_activePrimarySidebarItem === item.id}
              class:opacity-70={$_$_activePrimarySidebarItem === item.id}
              class:bg-base-100={$_$_activePrimarySidebarItem === item.id}
              class:hover:text-base-content={$_$_activePrimarySidebarItem !== item.id}
            >
              <span class="text-base-content/70 w-[25px] max-w-[max-content]">
                {@html item.icon}
              </span>

              {#if item.badge}
                <div
                  class="
                            absolute top-7 right-0
                            bg-primary text-base-content text-xs font-semibold
                            rounded-full w-4 h-4 flex items-center justify-center
                            shadow-md
                        "
                >
                  {item.badge}
                </div>
              {/if}
            </div>
          </button>
        {/each}
      </div>

      <!-- bottom items (account/settings like VSCode) -->
      <!-- <div class="flex flex-col items-center gap-1 mb-2">
        <button
          class="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-800"
          aria-label="Account"
          title="Account"
          onclick={() => dispatch('command', { id: 'account' })}
        >
          <i class="ph-light ph-user-circle text-2xl"></i>
        </button>
        <button
          class="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-800"
          aria-label="Settings"
          title="Settings"
          onclick={() => dispatch('command', { id: 'settings' })}
        >
          <i class="ph-light ph-gear text-2xl"></i>
        </button>
      </div> -->
    </div>
  </div>
  <!-- {/if} -->
</div>

<style>
  .sidebar-collapse-control {
    position: sticky;
    top: 0%;
    z-index: 4;
    display: flex;
    width: 20px;
    height: 20px;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-base-300);
    background: var(--color-base-100);
    color: color-mix(in srgb, var(--color-base-content) 60%, transparent);
    box-shadow: 0 2px 8px color-mix(in srgb, black 14%, transparent);
    transform: translateX(100%);
    transition:
      width 160ms ease,
      color 160ms ease,
      background-color 160ms ease;
  }
  /* .sidebar-collapse-control {
    position: absolute;
    top: 50%;
    z-index: 4;
    display: flex;
    width: 20px;
    height: 42px;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-base-300);
    background: var(--color-base-100);
    color: color-mix(in srgb, var(--color-base-content) 60%, transparent);
    box-shadow: 0 2px 8px color-mix(in srgb, black 14%, transparent);
    transform: translateY(-50%);
    transition:
      width 160ms ease,
      color 160ms ease,
      background-color 160ms ease;
  } */
  .sidebar-collapse-control:hover {
    /* width: 24px; */
    background: var(--color-base-200);
    color: var(--color-primary);
  }
  .sidebar-collapse-control-left {
    right: -11px;
    border-radius: 300px;
    /* border-radius: 7px 0 0 7px; */
  }

  @media (max-width: 768px) {
    .sidebar-collapse-control {
      display: none;
    }
    .activity-bar {
      width: 100%;
      height: 56px;
      padding: 0 8px;
      border-radius: 0;
      border-left: 0;
      border-right: 0;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    #activity-bar-pane .activity-group {
      flex-direction: row;
      justify-content: space-around;
      margin-top: 0;
      width: 100%;
      gap: 6px;
    }
    #activity-bar-pane .activity-btn {
      height: 44px;
      flex: 1 1 auto;
    }
    #activity-bar-pane .activity-btn-inner {
      width: 100%;
      height: 44px;
    }
    #activity-bar-pane {
      width: 100%;
    }
  }
  @media (max-width: 480px) {
    #activity-bar-pane .activity-btn {
      height: 40px;
    }
    #activity-bar-pane .activity-btn-inner span {
      transform: scale(0.9);
      display: inline-block;
    }
  }
</style>
