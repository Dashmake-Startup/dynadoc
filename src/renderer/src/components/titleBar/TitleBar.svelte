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
<!-- TitleBar.svelte — WPS fusion: document tabs live here (tab bar) alongside quick access. -->
<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import LeftQuickAccessToolBar from './leftQuickAccess/LeftQuickAccessToolBar.svelte'
  import RightQuickAccessToolBar from './rightQuickAccess/RightQuickAccessToolBar.svelte'
  import TabList from '../app/navigation/TabList.svelte'
  import { _$_documentEditorsList } from '../../stores/editor.store'
  import { _$_currentView } from '../../stores/common.store'
  import { DocumentModel } from '../../models/Document'
  import { goToHomeScreen, goToNewDocumentScreen } from '../../utils/common.utils'

  let _isMac = $state(false)
  onMount(() => {
    try {
      _isMac = (window as any).process?.platform === 'darwin'
    } catch {
      _isMac = false
    }
  })

  const tabs = $derived(
    ($_$_documentEditorsList || []).map((de) => DocumentModel.toNavigationTab(de))
  )

  function onSelectTab(id: string) {
    _$_documentEditorsList.setActive(id)
    _$_currentView.set('editor')
  }
  function onCloseTab(id: string) {
    _$_documentEditorsList.closeTab(id)
  }
</script>

<div class="ddoc-titlebar-stack">
  <div class="title-bar-container">
    <!-- macOS traffic-light spacer -->
    <div class="title-bar-traffic-light-region" class:hidden={!_isMac}></div>
    <!-- Home -->
    <div class="title-bar-no-drag-region">
      <button
        class="titlebar-home"
        onclick={goToHomeScreen}
        title={$_('Home')}
        aria-label={$_('Home')}
      >
        <i class="ph-light ph-house text-[17px]"></i>
      </button>
    </div>
    <!-- Document tabs (the WPS tab bar lives in the title bar) -->
    <div class="title-bar-no-drag-region title-bar-tabs">
      <!-- <TabList __mode="app" __elements={tabs} __onSelect={onSelectTab} __onClose={onCloseTab} /> -->
      <TabList __mode="lite" __elements={tabs} __onSelect={onSelectTab} __onClose={onCloseTab} />
    </div>
    <!-- Document tab add button "+" -->
    <div class="title-bar-no-drag-region title-bar-tab-add">
      <TabList __mode="lite" __elements={tabs} __onAdd={goToNewDocumentScreen} />
    </div>
    <!-- Right quick access (theme / Sign In / Buy Now / panels) -->
    <div class="title-bar-no-drag-region title-bar-quick-access">
      <RightQuickAccessToolBar />
    </div>
  </div>
</div>

<style lang="postcss">
  /* global styling: works for children components as well */
  :global(.icon) {
    width: 15px;
  }
  :global(.i-icon) {
    font-size: 1rem;
  }

  .ddoc-titlebar-stack {
    display: flex;
    flex-direction: column;
  }

  /* local styling: works only for this file */
  .title-bar-container {
    @apply flex items-center gap-2;
    background-color: transparent;
    color: inherit;
    height: 40px;
    padding: 0 10px;
    user-select: none;
    -webkit-app-region: drag; /* drag the window from empty areas */
    -webkit-user-select: none;
  }

  .title-bar-traffic-light-region {
    @apply w-[72px] min-w-[72px];
  }

  .title-bar-no-drag-region {
    -webkit-app-region: no-drag;
  }

  .title-bar-tabs {
    @apply flex items-center min-w-0 flex-1 h-full overflow-hidden;
  }

  .title-bar-quick-access {
    flex: none;
    min-width: 0;
  }

  @media (max-width: 760px) {
    .title-bar-container {
      gap: 0.25rem;
      padding: 0 0.35rem;
    }

    .title-bar-traffic-light-region {
      width: 52px;
      min-width: 52px;
    }
  }

  .titlebar-home {
    @apply flex items-center justify-center w-7 h-7 rounded-md text-base-content/60 hover:bg-base-300 hover:text-base-content transition-colors;
    flex: none;
    background: transparent;
    border: 0;
    cursor: pointer;
  }
</style>
