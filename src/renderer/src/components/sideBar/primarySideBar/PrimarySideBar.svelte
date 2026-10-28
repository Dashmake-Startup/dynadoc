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
<!-- TitleBar.svelte -->
<script lang="ts">
  import { _ } from 'svelte-i18n'
  // let _wysiwygEditor = _$_wysiwygEditorsList.get(__wysiwygEditorId)

  // console.lo

  // import '../../common/react/treeView/ReactTreeElement.jsx'
  import TreeView from '../../common/react/treeView/TreeView.svelte'
  import ExplorerWidget from './components/explorer/ExplorerWidget.svelte'
  import DriveExplorerWidget from './components/explorer/DriveExplorerWidget.svelte'
  import Utils from '../../../utils/Utils'
  import { _$_documentEditorsList } from '../../../stores/editor.store'
  import {
    _$_activePrimarySidebarItem,
    _$_primarySidebarVisible
  } from '../../../stores/common.store'
  import NavigationPane from './components/navigation/NavigationPane.svelte'
  import OutlinePane from './components/outline/OutlinePane.svelte'
  import Search from './components/search/Search.svelte'
  import VersionControl from './components/versionControl/VersionControl.svelte'
  import ContributePane from './components/contribute/ContributePane.svelte'
  import LazyPersistent from '../../../extensions/tiptap/components/common/LazyPersistent.svelte'

  const componentName = import.meta.url.split('/').pop()
  // ?.replace(".svelte", "") || "Unknown";
  Utils.measureRender(componentName)

  const activeDocumentEditorStore = _$_documentEditorsList.getActive()
  let activeEditor = $derived($activeDocumentEditorStore)
</script>

<div id="primary-side-bar" class:mobile-sidebar-open={$_$_primarySidebarVisible}>
  {#if Object.values(Utils.IMAGE_EXTENSIONS).includes(activeEditor?.document?.extension)}
    <!-- <div id="image-editor-primary-side-bar-pane" class="">
      <VerticalToolBar></VerticalToolBar>
    </div> -->
  {:else}
    <div id="wysiwyg-primary-side-bar-pane" class="">
      <!-- <div class="sidebar-content scrollable-section"> -->
      <!--left side bar... -->
      <!-- <react-tree root-path="/path/to/Documents/Obsidian Vault"></react-tree> -->
      <!-- <react-tree root-path="/path/to/dynadoc"></react-tree> -->
      <!-- <react-tree root-path="/path/to/Documents/test"></react-tree> -->
      <!-- <ExplorerWidget /> -->

      {#if $_$_primarySidebarVisible}
        <!-- {#if $_$_activePrimarySidebarItem === 'navigation'} -->

        <!-- <NavigationPane /> -->
        <div id="navigation-pane">
          <LazyPersistent __isVisible={$_$_activePrimarySidebarItem === 'navigation'}>
            <NavigationPane />
          </LazyPersistent>
        </div>
        <div id="outline-pane">
          <LazyPersistent __isVisible={$_$_activePrimarySidebarItem === 'outline'}>
            <OutlinePane />
          </LazyPersistent>
        </div>
        <!-- {:else if $_$_activePrimarySidebarItem === 'explorer'} -->
        <div id="explorer-pane">
          <LazyPersistent __isVisible={$_$_activePrimarySidebarItem === 'explorer'}>
            <ExplorerWidget />
          </LazyPersistent>
        </div>
        <div id="drive-pane">
          <LazyPersistent __isVisible={$_$_activePrimarySidebarItem === 'drive'}>
            <DriveExplorerWidget />
          </LazyPersistent>
        </div>
        <!-- {:else if $_$_activePrimarySidebarItem === 'search'} -->
        <!-- <Search />
      -->
        <div id="search-pane">
          <LazyPersistent __isVisible={$_$_activePrimarySidebarItem === 'search'}>
            <Search />
          </LazyPersistent>
        </div>
        <!-- <Search></Search> -->

        <!-- {:else if $_$_activePrimarySidebarItem === 'versionControl'} -->
        <!-- <SourceControl /> -->
        <div id="versionControl-pane">
          <LazyPersistent __isVisible={$_$_activePrimarySidebarItem === 'versionControl'}>
            <VersionControl />
          </LazyPersistent>
        </div>
        <div id="contribute-pane">
          <LazyPersistent __isVisible={$_$_activePrimarySidebarItem === 'contribute'}>
            <ContributePane />
          </LazyPersistent>
        </div>
        <!-- <VersionControl /> -->
        <!-- <div>versionControl (can create different version of a file) Widget Placeholder</div>
          <div>history manager (git of thee current file) Widget Placeholder</div> -->
        <!-- {/if} -->
      {/if}

      <!-- Other widgets here : Search, translate, version control.$$render.. -->

      <!-- <TreeView rootPath="/path/to/dynadoc" /> -->
      <!-- <h2 class="text-xl font-bold mb-">Left Sidebar</h2>
  <p>Content for the left sidebar.</p>
  <br /><br /><br /><br /><br /><br /><br /><br /><br /><br />
  <p>Content for the left sidebar.</p>
  <br /><br /><br /><br /><br /><br /><br /><br /><br /><br />
  <p>Content for the left sidebar.</p>
  <br /><br /><br /><br /><br /><br /><br /><br /><br /><br />
  <p>Content for the left sidebar.</p>
  <br /><br /><br /><br /><br /><br /><br /><br /><br /><br />
  <p>Content for the left sidebar.</p>
  <br /><br /><br /><br /><br /><br /><br /><br /><br /><br /> -->
    </div>
  {/if}
</div>

<style>
</style>
