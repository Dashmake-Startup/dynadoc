<!--
 Copyright (C) 2025 Dashmake Inc.
 
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

<script lang="ts">

  import { _ } from 'svelte-i18n'
  import SideBySideTranslateEditor from './components/SideBySideTranslateEditor.svelte'
  import WysiwygTranslateEditor from './components/WysiwygTranslateEditor.svelte'
  let { __translatedPath, __originalPath }: { __translatedPath: string, __originalPath: string } = $props()


  console.log('__translatedPath, __originalPath', __translatedPath, __originalPath)
</script>

 <!-- <vscode-split-layout style="height: 100%;"> -->
 <vscode-split-layout style="height: 100vh;">
<!-- <Splitpanes style="height: 100%"> -->
  <!-- <Splitpanes style="height: 400px"> -->
  <!-- <Pane size={45}> -->
    <div slot="start" size="45%">
    <SideBySideTranslateEditor {__translatedPath} {__originalPath}></SideBySideTranslateEditor>
  </div>
  <!-- </Pane> -->
   <div slot="end" size="55%">  
      <WysiwygTranslateEditor {__translatedPath} {__originalPath}></WysiwygTranslateEditor>
</div>
  <!-- <Pane size={55}></Pane> -->
<!-- </Splitpanes> -->
</vscode-split-layout>