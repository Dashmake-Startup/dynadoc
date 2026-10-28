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
<!-- DocumentExplorer.svelte -->
<script lang="ts">
  import { _, isLoading } from 'svelte-i18n'

  import { _$_documentEditorsList } from '../../../../../stores/editor.store'

  import TreeView from '../../../../common/react/treeView/TreeView.svelte'
  // export let __rootPath: string
  // export let __rootParentPath: string

    const { __rootPath, __rootParentPath } = $props<{
    __rootPath: string
    __rootParentPath: string
  }>()

  // console.log('__rootPath', __rootPath)
  //   const activeEditor = _$_documentEditorsList.getActive()

  // console.log('__rootPath _$_documentEditorsList = ', $activeEditor?.document)

  // setInterval(() => {
  //   console.log('__rootPath Doc ExplorerWidget activeEditor', $activeEditor?.document)
  // }, 2000)
</script>

<div class="">
  <div
    heading={$_('Document Explorer')}
    description={__rootPath}
    class="collapsible complex-example"
    open
  >
    <i name="new-file" action-icon id="pin-icon"></i>
    <i name="refresh" action-icon id="refresh-icon"></i>
    <i name="save-all" action-icon id="filter-icon"></i>
    <i name="close-all" action-icon id="filter-icon"></i>
    <vscode-scrollable>
      <TreeView {__rootPath} {__rootParentPath} />
    </vscode-scrollable>
  </div>
</div>

<style>
</style>
