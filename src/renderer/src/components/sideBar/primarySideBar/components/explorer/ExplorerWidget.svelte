
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
<!-- ExplorerWidget.svelte -->
<script lang="ts">
  
// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

import { _ } from 'svelte-i18n'
  import { _$_documentEditorsList } from '../../../../../stores/editor.store'

  // let _wysiwygEditor = _$_wysiwygEditorsList.get(__wysiwygEditorId)

  // console.lo

  // import '../../common/react/treeView/ReactTreeElement.jsx'
  import OpenEditorsExplorer from './OpenEditorsExplorer.svelte'
  import DocumentExplorer from './DocumentExplorer.svelte'
  import DiskExplorer from './DiskExplorer.svelte'
  import Platform from '../../../../../libs/platform'

  // import { _$_documentEditorsList } from './stores'
  import { derived } from 'svelte/store'
  import { onMount } from 'svelte'
  import CachedComponent from './CachedComponent.svelte'
import { nodeApi } from '../../../../../utils/shims/node'

  // onMount(() => {
  // derive a reactive store for the active editor
  const activeEditor = _$_documentEditorsList.getActive()
  const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
  const diskRootPath = $derived.by(() => {
    if (!nodeApi.path) return ''
    const doc = $activeEditor?.document
    if (!doc) return ''
    const dirPath = doc.dirPath || (doc.path ? nodeApi.path.dirname(doc.path) : '')
    if (!dirPath) return ''
    const cacheDir = doc.cacheDirPath || ''
    const isUnsaved = typeof doc.isUnsavedDocument === 'function' ? doc.isUnsavedDocument() : false
    const inCache = cacheDir ? dirPath.startsWith(cacheDir) : false
    if (isUnsaved && inCache) return ''
    return dirPath
  })
  // })
  // set timeinterval
  // setInterval
  // console.log('__rootPath ExplorerWidget activeEditor', $activeEditor?.document)
  // console.log('__rootPath ExplorerWidget cachePath', nodeApi.path.dirname($activeEditor?.document?.cachePath || ''))
  // console.log('__rootPath ExplorerWidget dirPath', nodeApi.path.dirname($activeEditor?.document?.cachePath || ''))

  // setInterval(() => {
  //   console.log('__rootPath ExplorerWidget activeEditor', $activeEditor?.document)
  // }, 2000)
</script>

<div class="">
  <!-- <div
    heading="Timeline"
    description="div.ts"
    class="collapsible complex-example"
    open
  >
    <i name="pin" action-icon id="pin-icon"></i>
    <i name="refresh" action-icon id="refresh-icon"></i>
    <i name="filter" action-icon id="filter-icon"></i>
    <vscode-scrollable>
      <vscode-tree>
        <vscode-tree-item>
          <i name="circle-outline" slot="icon-leaf"></i>
          File saved
        </vscode-tree-item>
        <vscode-tree-item>
          <i name="circle-outline" slot="icon-leaf"></i>
          File saved
        </vscode-tree-item>
        ...
      </vscode-tree>
    </vscode-scrollable>
  </div> -->
  <!--left side bar... -->
  <!-- <react-tree root-path="/path/to/Documents/Obsidian Vault"></react-tree> -->
  <!-- <react-tree root-path="/path/to/dynadoc"></react-tree> -->
  <!-- <react-tree root-path="/path/to/Documents/test"></react-tree> -->

  <div id="open-editors" class="resizable">
    <OpenEditorsExplorer />
  </div>

  <div class="explorer-divider"></div>

  <div id="document-explorer" class="resizable">
    <!-- <DocumentExplorer
          __rootPath={_$_documentEditorsList.getActive()?.document?.cacheDirPath || ''}
        /> -->
    <!-- <DocumentExplorer __rootPath='/path/to/dynadoc/vite.fluent.config.mts'  __rootParentPath='/path/to/projects'/> -->
    <DocumentExplorer
      __rootPath={$activeEditor?.document?.cachePath || ($activeEditor?.document?.path ? nodeApi.path.dirname($activeEditor.document.path) : '')}
      __rootParentPath={$activeEditor?.document?.path || ''}
    />
    <!-- <CachedComponent
      key={$activeEditor.document.cachePath}
      component={DocumentExplorer}
      props={{ __rootPath: $activeEditor.document.cachePath }}
    /> -->

    <!-- <DocumentExplorer
          __rootPath={nodeApi.path.dirname($activeEditor?.document?.cachePath || '')}
        /> -->
  </div>

  {#if isDesktopPlatform && diskRootPath}
    <div class="explorer-divider"></div>
    <div id="disk-explorer" class="resizable">
      <DiskExplorer __rootPath={diskRootPath} __rootParentPath="" />
    </div>
  {/if}
</div>

<style>
  .explorer-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
    margin: 6px 0;
  }
</style>