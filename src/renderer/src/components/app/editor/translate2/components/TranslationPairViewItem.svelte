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
  import { onMount, onDestroy } from 'svelte'
  import StarterKit from '@tiptap/starter-kit'
  import { Editor } from '@tiptap/core'

  import {
    _$_translationPairsMap,
    _$_translationSyncController,
    addExistingOrEmptyTranslation,
    getOrCreateFileMap,
    removeTranslation,
    updateTranslation,
    type TranslationPair
  } from '../../../../../extensions/tiptap/CustomTranslationExtension/stores/translationSync.store'

  import { CustomTranslationSyncExtension } from '../../../../../extensions/tiptap/CustomTranslationExtension/CustomTranslationExtension.svelte'
  import UniqueID from '@tiptap/extension-unique-id'
  import EditorHelpers from '../../../../../utils/EditorHelpers'
  import Utils from '../../../../../utils/Utils'
  import { get } from 'svelte/store'
  let { filePath, translatedFilePath, uuid, original, translated }: { filePath: string, translatedFilePath: string, uuid: string, original: any, translated: any | null } = $props()


  let editor: Editor
  let editorEl: HTMLDivElement
  let _isOutdated = false

  /* ---------------------------------------
   * OUTDATED STATE
   * -------------------------------------*/
  const unsubscribeOutdated = _$_translationSyncController.subscribe(() => {
    _isOutdated = _$_translationSyncController.isTranslationOutdated(
      filePath,
      translatedFilePath,
      uuid
    )
  })
  // const unsubscribeOnTranslationPairsUpdate = _$_translationPairsMap.subscribe(() => {
  //   Utils.saveAllTranslationsFor(filePath, translatedFilePath)
  // })

  /* ---------------------------------------
   * ORIGINAL SYNC HANDLERS
   * -------------------------------------*/

  function handleOriginalAdded(fileId: string, addedUuid: string, node: any) {
    console.log('TranslationSyncControllerImpl handleOriginalAdded enter ', {
      fileId,
      addedUuid,
      uuid,
      filePath,
      node
      // editor
    })

    if (fileId !== filePath) return
    if (!editor) return
    // if (addedUuid !== uuid || !editor) return
    console.log('TranslationSyncControllerImpl handleOriginalAdded enter2 ')

    // addExistingOrEmptyTranslation(fileId, addedUuid, node)
    // Utils.saveAllTranslationsFor(filePath, translatedFilePath)
    // Ensure paragraph exists in editor
    /* const exists = editor.state.doc.content.some(
      (n) => n.type.name === 'paragraph' && n.attrs?.uuid === addedUuid
    )

    if (!exists) {
      editor.commands.insertContent({
        type: 'paragraph',
        attrs: { uuid: addedUuid },
        content: []
      })
    } */
  }
  function handleOriginalAdded2(fileId: string, addedUuid: string, node: any) {
    console.log('TranslationSyncControllerImpl handleOriginalAdded enter ', {
      fileId,
      addedUuid,
      filePath,
      node
    })

    if (fileId !== filePath) return
    if (addedUuid !== uuid || !editor) return

    _$_translationPairsMap.update((map) => {
      const fileMap = getOrCreateFileMap(fileId)
      //  const fileMap = map.get(fileId)
      // if (!fileMap) return map

      // const pair = fileMap.get(addedUuid)
      // if (!pair) return map

      // Create translation pair if missing
      if (!fileMap.has(addedUuid)) {
        fileMap.set(addedUuid, {
          uuid: addedUuid,
          original: node,
          translated: null
        } as TranslationPair)
      }

      return map
    })

    // Ensure paragraph exists in editor
    const exists = editor.state.doc.content.some(
      (n) => n.type.name === 'paragraph' && n.attrs?.uuid === addedUuid
    )

    if (!exists) {
      editor.commands.insertContent({
        type: 'paragraph',
        attrs: { uuid: addedUuid },
        content: []
      })
    }
  }

  function handleOriginalRemoved(fileId: string, removedUuid: string) {
    if (fileId !== filePath) return
    if (!editor) return
    // if (removedUuid !== uuid || !editor) return
    // removeTranslation(fileId, translatedFilePath, removedUuid)
    // Utils.saveAllTranslationsFor(filePath, translatedFilePath)

    // Clear editor content (translation no longer has a source)
    // editor.commands.clearContent()
  }
  function handleOriginalRemoved2(fileId: string, removedUuid: string) {
    if (fileId !== filePath) return
    if (removedUuid !== uuid || !editor) return

    // Remove from store
    _$_translationPairsMap.update((map) => {
      const fileMap = map.get(fileId)
      if (!fileMap) return map

      if (!fileMap.has(removedUuid)) return map

      fileMap.delete(removedUuid)
      return map
    })

    // Clear editor content (translation no longer has a source)
    editor.commands.clearContent()
  }

  function handleOriginalUpdated(fileId: string, updatedUuid: string, node: any) {
    console.log('TranslationSyncControllerImpl handleOriginalUpdated enter2 ', {
      fileId,
      updatedUuid,
      node
    })

    if (fileId !== filePath) return
    if (!editor) return
    // if (updatedUuid !== uuid || !editor) return
    // if (updatedUuid !== uuid || !editor) return
    // updateTranslation(filePath, translatedFilePath, uuid, json, isEmpty)

    // updateTranslation(fileId, translatedFilePath, updatedUuid)
    console.log('TranslationSyncControllerImpl handleOriginalUpdated enter3 ', {
      fileId,
      updatedUuid,
      node
    })

    _$_translationPairsMap.update((map) => {
      const fileMap = map.get(fileId)
      if (!fileMap) return map

      const pair = fileMap.get(updatedUuid)
      if (!pair) return map

      // 🔥 update original snapshot
      fileMap.set(updatedUuid, {
        ...pair,
        original: node
      })

      return map
    })
    console.log('TranslationSyncControllerImpl handleOriginalUpdated enter4 ', {
      fileId,
      updatedUuid,
      node,
      naop: get(_$_translationPairsMap).get(fileId)
    })

    Utils.saveAllTranslationsFor(fileId, translatedFilePath)
  }

  function handleOriginalUpdated2(fileId: string, updatedUuid: string, node: any) {
    if (fileId !== filePath) return
    if (updatedUuid !== uuid || !editor) return

    _$_translationPairsMap.update((map) => {
      const fileMap = map.get(fileId)
      if (!fileMap) return map

      const pair = fileMap.get(updatedUuid)
      if (!pair) return map

      // 🔥 update original snapshot
      fileMap.set(updatedUuid, {
        ...pair,
        original: node
      })

      return map
    })
  }

  let unsubAdd: () => void
  let unsubUpdate: () => void
  let unsubRemove: () => void

  /* ---------------------------------------
   * LIFECYCLE
   * -------------------------------------*/
  onMount(() => {
    console.log('TranslationSyncControllerImpl updateTranslation11  ', { translated })

    editor = new Editor({
      element: editorEl,
      extensions: [
        StarterKit,
        CustomTranslationSyncExtension.configure({
          role: 'translated',
          controller: _$_translationSyncController,
          filePath: filePath,
          translatedFilePath: translatedFilePath
        }),
        UniqueID.configure({
          attributeName: EditorHelpers.uuidAttributeName,

          types: ['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem'],
          generateID: ({ node }) => uuid
        })
      ],
      // content:  translated ,
      content: translated ? { type: 'doc', content: [translated] } : { type: 'doc', content: [] },
      // content: translated ? { type: 'doc', content: [translated] } : { type: 'doc', content: [] },

      onCreate(props) {
        const html = editor.getHTML()
        const json = editor.getJSON()
        const isEmpty = editor.getText().trim() === ''

        console.log('TranslationSyncControllerImpl updateTranslation onCreate  ', { html, json, translated })
        // updateTranslation(filePath, translatedFilePath, uuid, json, isEmpty)
      },

      // onUpdate: ({ editor }) => {
      onTransaction: ({ editor }) => {
        // const json = editor.getJSON() ?? null
        const json = editor.getJSON().content?.[0] ?? null
        const isEmpty = editor.getText().trim() === ''

        updateTranslation(filePath, translatedFilePath, uuid, json, isEmpty)
      }
    })

    // handleOriginalUpdated(filePath, uuid, node)

    unsubAdd = _$_translationSyncController.onOriginalAdded(handleOriginalAdded)
    unsubUpdate = _$_translationSyncController.onOriginalUpdated(handleOriginalUpdated)
    unsubRemove = _$_translationSyncController.onOriginalRemoved(handleOriginalRemoved)
  })

  onDestroy(() => {
    unsubAdd?.()
    unsubUpdate?.()
    unsubRemove?.()
    unsubscribeOutdated?.()
    editor?.destroy()
  })
</script>

<div class="grid grid-cols-2 gap-2 min-h-[60px]">
  <!-- Original paragraph (read-only) -->
  <div class="p-2 border whitespace-pre-wrap">
    {original?.content?.map((n) => n.text).join('') ?? ''}
  </div>

  <!-- Translation editor -->
  <div bind:this={editorEl} class="p-2 border min-h-[50px]" class:bg-red-100={_isOutdated} />
</div>
