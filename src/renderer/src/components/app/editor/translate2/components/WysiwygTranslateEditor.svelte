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
//   const nodeApi =
//     typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
//   const fsPromises = nodeApi?.fsPromises

  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import StarterKit from '@tiptap/starter-kit'
  import { Editor } from '@tiptap/core'

  import {
    _$_translationPairsMap,
    _$_translationSyncController,
    getOrCreateFileMap,
    updateTranslation,
    type TranslationPair
  } from '../../../../../extensions/tiptap/CustomTranslationExtension/stores/translationSync.store'

  import { CustomTranslationSyncExtension } from '../../../../../extensions/tiptap/CustomTranslationExtension/CustomTranslationExtension.svelte'
  import UniqueID from '@tiptap/extension-unique-id'
  import EditorHelpers from '../../../../../utils/EditorHelpers'
import { nodeApi } from '../../../../../utils/shims/node'
  let { __translatedPath, __originalPath }: { __translatedPath: string, __originalPath: string } = $props()


  let editor: Editor
  let editorEl: HTMLDivElement
  let _isOutdated = false

  let unsubAdd: () => void
  let unsubUpdate: () => void
  let unsubRemove: () => void

  /* ---------------------------------------
   * LIFECYCLE
   * -------------------------------------*/
  // onMount(async () => {
  onMount( () => {
    const translatedRaw = '{}'
    // const translatedRaw = await nodeApi.fsPromises.readFile(__translatedPath, 'utf-8')
    const translatedJson = JSON.parse(translatedRaw)

    editor = new Editor({
      element: editorEl,
      extensions: [
        StarterKit,
        CustomTranslationSyncExtension.configure({
          role: 'translated',
          controller: _$_translationSyncController,
          filePath: __originalPath,
          translatedFilePath: __translatedPath
        }),
        UniqueID.configure({
          attributeName: EditorHelpers.uuidAttributeName,

          types: ['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem']
          //   generateID: ({ node }) => uuid
        })
      ],
      content: translatedJson,
      // content: translated ? { type: 'doc', content: [translated] } : { type: 'doc', content: [] },

      // onUpdate: ({ editor }) => {
      onTransaction: ({ editor }) => {
        // const json = editor.getJSON() ?? null
        const json = editor.getJSON().content?.[0] ?? null
        const isEmpty = editor.getText().trim() === ''
      }
    })

    // unsubAdd = _$_translationSyncController.onOriginalAdded(handleOriginalAdded)
    // unsubUpdate = _$_translationSyncController.onOriginalUpdated(handleOriginalUpdated)
    // unsubRemove = _$_translationSyncController.onOriginalRemoved(handleOriginalRemoved)
  })

  onDestroy(() => {
    unsubAdd?.()
    unsubUpdate?.()
    unsubRemove?.()
    // unsubscribeOutdated?.()
    editor?.destroy()
  })
</script>

<!-- <div class="grid grid-cols-2 gap-2 min-h-[60px]"> -->

<!-- Translation editor -->
<div bind:this={editorEl} class="p-2 border min-h-[50px]" class:bg-red-100={_isOutdated} />
<!-- </div> -->
