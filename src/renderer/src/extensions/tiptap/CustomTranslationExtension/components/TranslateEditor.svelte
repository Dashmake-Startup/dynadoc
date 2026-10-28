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
  import SplitPane from '../../../../components/common/layout/splitPane/SplitPane.svelte'
  import SideBySideTranslateEditor from './SideBySideTranslateEditor.svelte'
  import WysiwygTranslateEditor from './WysiwygTranslateEditor.svelte'
  let { __wysiwygEditorId, __translatedPath, __originalPath }: { __wysiwygEditorId: string, __translatedPath: string, __originalPath: string } = $props()


  console.log('__translatedPath, __originalPath', __translatedPath, __originalPath)
</script>

<!-- <SideBySideTranslateEditor {__translatedPath} {__originalPath}></SideBySideTranslateEditor> -->

<SplitPane __id="main-split-layout-editor-terminal">
  <div data-initial={50} data-min="30" data-max="80" class="h-full min-h-0 overflow-hidden">
    <SideBySideTranslateEditor {__translatedPath} {__originalPath} {__wysiwygEditorId}
    ></SideBySideTranslateEditor>
  </div>
  <div data-initial={50} data-min="30" data-max="80" class="h-full min-h-0 overflow-hidden">
    <WysiwygTranslateEditor {__translatedPath} {__originalPath} {__wysiwygEditorId}
    ></WysiwygTranslateEditor>
  </div>
</SplitPane>
