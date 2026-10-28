

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
<!-- App.svelte -->
<script lang="ts">
  import { v4 as uuidv4 } from 'uuid'
  import type { DocumentModel } from '../../../../models/Document'
  import WysiwygEditor from '../wysiwyg/WysiwygEditor.svelte'

  // export let _editorContent = ''
  let {
    __previewEditorId,
    __documentToOpen = null,
    __filePathToOpenFromDocument,
    __parentContainerKey
  } = $props()
  // export let __previewEditor

  // export let handleWysiwygChange = (event, content: string = null): void => {}
  // export let handleWysiwygKeydown = (event): void => {}
  // export let handleWysiwygInput = (event): void => {}
  // export let handleWysiwygClick = (event): void => {}
  // export let handleWysiwygFocusOut = (event): void => {}
  // export let handleWysiwygFocus = (event): void => {}
  // export let handleWysiwygBlur = (event): void => {}

  const resolvedPreviewId = __previewEditorId || `preview-${uuidv4()}`
</script>

<!-- <svelte:head>
  <style>
      /* injects the <style> block(s) if any */
      {@html _editorContentInlineStyles}
  </style>
</svelte:head> -->

<div class="preview-editor">
  <WysiwygEditor
    __wysiwygEditorId={resolvedPreviewId}
    __documentToOpen={__documentToOpen}
    __filePathToOpenFromDocument={__filePathToOpenFromDocument}
    __parentContainerKey={__parentContainerKey || resolvedPreviewId}
    __isReadOnly={true}
  />
</div>

<style>
</style>
