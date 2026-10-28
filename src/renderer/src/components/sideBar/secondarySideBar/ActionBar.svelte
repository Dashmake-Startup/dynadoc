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
  import { createEventDispatcher } from 'svelte'
  import { onMount } from 'svelte'
  import Utils from '../../../utils/Utils'
  import { _$_documentEditorsList } from '../../../stores/editor.store'
  import {
    _$_activeSecondarySidebarItem,
    _$_rightSidebarVisible,
    _$_secondarySidebarVisible,
    _$_secondarySidebarItemOrder,
    type SecondarySidebarItemId
  } from '../../../stores/common.store'
  import { fluentUIcons } from '../../common/icons/Icons'
  import { authStore, initializeAuthStore } from '../../../stores/auth.store'
  import ContextMenu from '../../common/contextMenu/ContextMenu.svelte'
  import AuthMenu from '../../common/auth/AuthMenu.svelte'
  import { openSettingsModal } from '../../../stores/settingsModal.store'
  import { _ } from 'svelte-i18n'
  import { get } from 'svelte/store'
  // import '@phosphor-icons/web/light'
  // import '@phosphor-icons/web/bold'

  const dispatch = createEventDispatcher<{ command: { id: string } }>()

  // export let active: string = 'chat'

  type Item = {
    id: SecondarySidebarItemId
    label: string
    icon: string
    badge?: string
  }

  const activeDocumentEditorStore = _$_documentEditorsList.getActive()
  let activeEditor = $derived($activeDocumentEditorStore)

  const t = get(_)

  const items: Item[] = [
    { id: 'chat', label: t('Chat'), icon: fluentUIcons.fluentUIconPeopleChat },
    { id: 'meeting', label: t('Meeting'), icon: fluentUIcons.fluentUIconChatVideo },
    { id: 'chat-ai', label: t('Chat with AI'), icon: fluentUIcons.fluentUIconAIChat },
    { id: 'browser', label: t('Browser'), icon: fluentUIcons.fluentUIconGlobeDesktop },
    { id: 'review', label: t('Review Pane'), icon: fluentUIcons.fluentUIconTextProofingTools },
    {
      id: 'chartInspector',
      label: t('Chart Inspector'),
      icon: fluentUIcons.fluentUIconChartMultiple
    },
    {
      id: 'limitationManager',
      label: t('Editing Limitation Manager'),
      icon: fluentUIcons.fluentUIconEditLock
    },
    {
      id: 'variablesManager',
      label: t('Variables Manager'),
      icon: fluentUIcons.fluentUIconVariable
    },
    {
      id: 'filesManager',
      label: t('Files Manager. files addeed in the document'),
      icon: fluentUIcons.fluentUIconDocumentDataLink
    },
    { id: 'protectionPane', label: t('Protection Pane'), icon: fluentUIcons.fluentUIconShield },
    { id: 'translate', label: t('Translate Pane'), icon: fluentUIcons.fluentUIconTranslate },
    { id: 'layers', label: t('Layers'), icon: fluentUIcons.fluentUIconLayerDiagonal },
    { id: 'form', label: t('Form'), icon: fluentUIcons.fluentUIconForm }
    // { id: 'extensions', label: 'Extensions', icon: 'ph-puzzle-piece' }
  ]

  let draggingId: SecondarySidebarItemId | null = null
  let dragOverIndex = $state<number | null>(null)
  let dragInsertPosition = $state<'before' | 'after'>('before')

  let orderedItems = $derived.by(() => {
    const order = $_$_secondarySidebarItemOrder || []
    if (!order.length) return items
    const map = new Map(items.map((item) => [item.id, item]))
    const ordered = order.map((id) => map.get(id)).filter(Boolean) as Item[]
    const rest = items.filter((item) => !order.includes(item.id))
    return [...ordered, ...rest]
  })

  // function clickItem(item: Item) {
  //   dispatch('command', { id: item.id })
  //   active = item.id
  // }

  function clickItem(item: { id: SecondarySidebarItemId }) {
    // function clickItem(item: { id: PrimarySidebarItemId }) {
    _$_activeSecondarySidebarItem.update((current) => {
      if (current === item.id) {
        // Toggle off
        _$_secondarySidebarVisible.set(false)
        return null
      }

      // Switch panel
      _$_secondarySidebarVisible.set(true)
      return item.id
    })
  }

  function handleDragStart(event: DragEvent, id: SecondarySidebarItemId) {
    draggingId = id
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', id)
    }
  }

  /*   function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault()
    dragOverIndex = index
    const target = event.currentTarget as HTMLElement
    if (target) {
      const rect = target.getBoundingClientRect()
      dragInsertPosition = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    }
  } */
  function handleDragOver(event: DragEvent, index: number) {
    // 1. MUST prevent default to allow drop and maintain drag state
    event.preventDefault()

    // 2. Optimization: only update state if the index actually changed
    if (dragOverIndex !== index) {
      dragOverIndex = index
    }

    const target = event.currentTarget as HTMLElement
    if (target) {
      const rect = target.getBoundingClientRect()
      // Determine if mouse is in top or bottom half of the button
      const newPos = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
      if (dragInsertPosition !== newPos) {
        dragInsertPosition = newPos
      }
    }
  }

  // 3. Add a Leave handler to clean up
  function handleDragLeave(event: DragEvent) {
    // Only reset if we are actually leaving the button, not entering a child (icon/span)
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    if (
      event.clientX <= rect.left ||
      event.clientX >= rect.right ||
      event.clientY <= rect.top ||
      event.clientY >= rect.bottom
    ) {
      dragOverIndex = null
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
    _$_secondarySidebarItemOrder.set(ids)
    draggingId = null
    dragOverIndex = null
  }

  function handleDragEnd() {
    draggingId = null
    dragOverIndex = null
  }

  onMount(() => {
    initializeAuthStore()
  })

  function openSettings() {
    openSettingsModal('general')
  }

  function collapseSidebar() {
    _$_secondarySidebarVisible.set(false)
    _$_rightSidebarVisible.set(false)
  }
</script>

<div
  id="action-bar"
  class="action-bar relative scrollable-section rounded-[10px_0_0_10px] border border-light dark:border-dark border-r-0"
>
  <button
    class="sidebar-collapse-control sidebar-collapse-control-right"
    type="button"
    title={$_('Collapse right sidebar')}
    aria-label={$_('Collapse right sidebar')}
    onclick={collapseSidebar}
  >
    <i class="ph-bold ph-x"></i>
  </button>
  <!-- {#if Object.values(Utils.IMAGE_EXTENSIONS).includes(activeEditor?.document.extension)}
    <div id="image-editor-primary-side-bar-pane" class="">
      <VerticalToolBar></VerticalToolBar>
    </div>
  {:else} -->
  <div class="flex flex-col items-center justify-between w-full h-full">
    <!-- top items -->
    <div class="action-group flex flex-col items-center gap-1 mt-2">
      {#each orderedItems as item, index (item.id)}
        <!-- <button
          class="relative w-full h-12 flex items-center justify-center transition-colors
               hover:bg-neutral-200 dark:hover:bg-neutral-800
               {active === item.id ? 'bg-neutral-200 dark:bg-neutral-800' : ''}"
          aria-label={item.label}
          title={item.label}
          onclick={() => clickItem(item)}
        >
          <i class="ph-light {item.icon} text-2xl"></i>
        </button> -->

        <!-- <button
          class="
                    action-btn w-[90%] flex justify-center items-center relative
                    cursor-pointer transition-colors {dragOverIndex === index
            ? 'bg-border-left-primary/80'
            : 'noneee ' + dragOverIndex + ' - ' + index}
                "
          class:bg-border-left-primary={dragOverIndex === index}
          title={item.label}
          draggable
          ondragstart={(event) => handleDragStart(event, item.id)}
          ondragover={(event) => handleDragOver(event, index)}
          ondrop={(event) => handleDrop(event, index)}
          ondragend={handleDragEnd}
          onclick={() => clickItem(item)}
        > -->

        <button
          class="action-btn w-[90%] flex justify-center items-center relative cursor-pointer transition-colors"
          class:border-base-300={$_$_activeSecondarySidebarItem === item.id}
          class:border-r-10={$_$_activeSecondarySidebarItem === item.id}
          title={item.label}
          draggable="true"
          ondragstart={(event) => handleDragStart(event, item.id)}
          ondragover={(event) => handleDragOver(event, index)}
          ondragleave={handleDragLeave}
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
            class="absolute right-0 top-0 bottom-0 w-[2px]
                        bg-base-variant transition-opacity"
            class:opacity-100={$_$_activeSecondarySidebarItem === item.id}
            class:opacity-0={$_$_activeSecondarySidebarItem !== item.id}
            class:active={$_$_activeSecondarySidebarItem === item.id}
          ></div> -->

          <div
            class="
                        action-btn-inner w-[40px] h-full flex justify-center items-center
                        transition-colors p-2
                    "
            class:text-base-content={$_$_activeSecondarySidebarItem === item.id}
            class:opacity-70={$_$_activeSecondarySidebarItem === item.id}
            class:bg-base-100={$_$_activeSecondarySidebarItem === item.id}
            class:hover:text-base-content={$_$_activeSecondarySidebarItem !== item.id}
          >
            <span class="text-base-content/70 w-[25px] max-w-[max-content]">
              {@html item.icon}
            </span>

            {#if item.badge}
              <div
                class="
                            absolute top-7 left-0
                            bg-blue-600 text-base-content text-xs font-semibold
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
    <div class="action-group-bottom flex flex-col items-center gap-1 mb-2">
      <ContextMenu>
        <button
          class="cursor-pointer w-12 h-12 flex items-center justify-center rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-800"
          aria-label={$_('Account')}
          title={$authStore.authenticated ? 'Logout' : 'Sign in / Sign up'}
          disabled={$authStore.loading && !$authStore.initializing}
        >
          <i
            class="ph-light {$authStore.authenticated
              ? 'ph-sign-out'
              : 'ph-user-circle'} text-2xl {$authStore.authenticated ? 'text-green-500' : ''}"
          ></i>
        </button>
        <svelte:fragment slot="content">
          <AuthMenu></AuthMenu>
        </svelte:fragment>
      </ContextMenu>

      <button
        class="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-800"
        aria-label={$_('Settings')}
        title={$_('Settings')}
        onclick={openSettings}
      >
        <i class="ph-light ph-gear text-2xl"></i>
      </button>
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
    /* transform: translateY(-50%); */
    transition:
      width 160ms ease,
      color 160ms ease,
      background-color 160ms ease;
  }

  /* .sidebar-collapse-control {
    display: flex;
    width: 100%;
    height: 20px;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-base-300);
    background: var(--color-base-100);
    color: color-mix(in srgb, var(--color-base-content) 60%, transparent);
    box-shadow: 0 2px 8px color-mix(in srgb, black 14%, transparent);
    transition:
      width 160ms ease,
      color 160ms ease,
      background-color 160ms ease;
  } */

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
  .sidebar-collapse-control-right {
    left: -11px;
    border-radius: 300px;
    /* border-radius: 7px 0 0 7px; */
  }

  @media (max-width: 768px) {
    .sidebar-collapse-control {
      display: none;
    }
    .action-bar {
      width: 100%;
      height: 56px;
      padding: 0 8px;
      border-radius: 0;
      border-left: 0;
      border-right: 0;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    .action-group {
      flex-direction: row;
      justify-content: space-around;
      margin-top: 0;
      width: 100%;
      gap: 6px;
    }
    .action-group-bottom {
      display: none;
    }
    .action-btn {
      height: 44px;
      flex: 1 1 auto;
    }
    .action-btn-inner {
      width: 100%;
      height: 44px;
    }
  }
  @media (max-width: 480px) {
    .action-btn {
      height: 40px;
    }
    .action-btn-inner span {
      transform: scale(0.9);
      display: inline-block;
    }
  }
</style>
