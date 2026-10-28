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

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import DetachedPanel from '../../../../extensions/tiptap/components/common/DetachedPanel.svelte'
  import CodeEditorCore from '../../../../extensions/fileRenderers/CodeEditorCore.svelte'

  let { __codeEditorId, __wysiwygEditorId, __documentToOpen, __filePathToOpenFromDocument } =
    $props()
</script>

<DetachedPanel title={$_('Code Editor')}>
  {#snippet children()}
    <CodeEditorCore
      __src={__filePathToOpenFromDocument}
      __wysiwygEditorId={__wysiwygEditorId}
      __syncEnabled={true}
      __editable={true}
      __showToolbar={true}
      __showStatusBar={true}
    />
  {/snippet}
</DetachedPanel>
