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
//   const fs = nodeApi?.fs
//   const path = nodeApi?.path

  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import TranslationPairViewItem from './TranslationPairViewItem.svelte'
  import EditorHelpers from '../../../../../utils/EditorHelpers'
  import {
    _$_translationPairsMap,
    setPairs,
    type TranslationPair
  } from '../../../../../extensions/tiptap/CustomTranslationExtension/stores/translationSync.store'
  import { generateJSON } from '@tiptap/core'
  import StarterKit from '@tiptap/starter-kit'
  import { _$_wysiwygEditorsList } from '../../../../../stores/editor.store'
  import Utils from '../../../../../utils/Utils'
import { nodeApi } from '../../../../../utils/shims/node'
  let { __translatedPath, __originalPath }: { __translatedPath: string; __originalPath: string } =
    $props()

  async function loadFiles() {
    /* -------- LOAD TRANSLATED JSON -------- */

    const translatedRaw = await nodeApi.fsPromises?.readFile(__translatedPath, 'utf-8')
    const translatedJson = JSON.parse(translatedRaw)

    /* -------- LOAD ORIGINAL HTML -------- */

    const originalRaw = await nodeApi.fsPromises?.readFile(__originalPath, 'utf-8')
    const parser = new DOMParser()
    const originalDoc = parser.parseFromString(originalRaw, 'text/html')

    /* -------- MAP UUID → ORIGINAL TEXT -------- */

    // const originalMap: Record<string, string> = {}

    // originalDoc.querySelectorAll(`[${EditorHelpers.dataUuidAttributeName}]`).forEach((el) => {
    //   const uuid = el.getAttribute(EditorHelpers.dataUuidAttributeName)!
    //   originalMap[uuid] = el.textContent || ''
    // })

    // include ALL extensions you actually use
    const extensions = [
      StarterKit
      // UniqueID.configure({
      //   types: ['heading', 'paragraph'],
      // }),
    ]

    const json = generateJSON(originalRaw, extensions)

    const wysiwygEditor = _$_wysiwygEditorsList.getItem(__originalPath)

    const { doc } = wysiwygEditor.state

    let foundNode: any = null
    let foundPos: number | null = null
    const pairs: TranslationPair[] = []

    doc.descendants((nodeOriginal, pos) => {
      // if (node.attrs?.uuid === targetUuid) {
      if (nodeOriginal.attrs?.uuid) {
        // foundNode = nodeOriginal
        // foundPos = pos
        // return false // stop traversal

        console.log('TranslationSyncControllerImpl loadFiles  ', {
          translatedJson,
          nodeOriginal
        })

        /* -------- BUILD TRANSLATION PAIRS -------- */

        function walk(node: any) {
          let uuid = ''
          let translatedMap = new Map<string, any>()
          let json
          let isEmpty = false
          if (node?.attrs?.uuid && nodeOriginal.attrs?.uuid == node?.attrs?.uuid) {
            uuid = node.attrs.uuid
            // translatedMap = new Map<string, any>()

            translatedMap.set(__translatedPath, node)
            json = node
            isEmpty = false
            // }
            /* else {
            uuid = nodeOriginal.attrs?.uuid
            translatedMap.set(__translatedPath, nodeOriginal.toJSON())
            json = nodeOriginal.toJSON()
            isEmpty = false
            // isEmpty = true
          } */
            pairs.push({
              id: __translatedPath,
              uuid,
              // original: JSON.parse(
              //   `{"type":"paragraph","attrs":{"uuid":"c1ba74f7-866e-4634-bdda-a5a7327f3087"},"content":[{"type":"text","text":"ccccccc"}]}`
              // ),
              original: nodeOriginal.toJSON(),
              // original: originalMap[uuid] ?? '',
              // translated: 'ok',
              translated: translatedMap,
              // translated: node,
              json: json,
              isEmpty: isEmpty
            })
          }

          node?.content?.forEach(walk)
        }
        /* 
        function walk(node: any) {
          if (node?.attrs?.uuid && nodeOriginal.attrs?.uuid == node?.attrs?.uuid) {
            const uuid = node.attrs.uuid
            const translatedMap = new Map<string, any>()

            translatedMap.set(__translatedPath, node)
            pairs.push({
              id: __translatedPath,
              uuid,
              // original: JSON.parse(
              //   `{"type":"paragraph","attrs":{"uuid":"c1ba74f7-866e-4634-bdda-a5a7327f3087"},"content":[{"type":"text","text":"ccccccc"}]}`
              // ),
              original: nodeOriginal.toJSON(),
              // original: originalMap[uuid] ?? '',
              translated: translatedMap,
              // translated: node,
              json: node,
              isEmpty: false
            })
          }

          node?.content?.forEach(walk)
        } */

        walk(translatedJson)
        console.log('TranslationSyncControllerImpl loadFiles setPairs ', { __originalPath, pairs })

        setPairs(__originalPath, pairs)
      }
    })
    /* -------- INIT STORE FOR THIS FILE -------- */
    // console.log('TranslationSyncControllerImpl loadFiles setPairs ', { __originalPath, pairs })

    // setPairs(__originalPath, pairs)
    // setPairs(__translatedPath, pairs)
  }

  async function saveAll() {
    Utils.saveAllTranslationsFor(__originalPath, __translatedPath)
  }
  /*  async function saveAll() {
    const map = get(_$_translationPairsMap)
    const fileMap = map.get(__originalPath)
    // const fileMap = map.get(__translatedPath)

    if (!fileMap) return

    const content = Array.from(fileMap.values())
      .map((p) => p.json)
      .filter(Boolean)

    const updatedJson = {
      type: 'doc',
      content
    }

    await nodeApi.fsPromises.writeFile(
      __translatedPath,
      JSON.stringify(updatedJson, null, 2),
      'utf-8'
    )

    // alert('Translations saved!')
  } */

  onMount(loadFiles)
</script>

<div class="mt-4 flex justify-end">
  <button class="bg-blue-500 text-base-content px-4 py-2 rounded hover:bg-blue-600" on:click={saveAll}>
    {$_('Save All Translations')}
  </button>
</div>

<div class="space-y-2 scrollable-section">
  <!-- <br /><br />
  {JSON.stringify(
    Array.from($_$_translationPairsMap?.get(__originalPath)?.values() || []),
    null,
    2
  )}
  <br /><br />
  {JSON.stringify(
    Array.from(get(_$_translationPairsMap)?.get(__originalPath)?.values() || []),
    null,
    2
  )} -->
  <!-- <TranslationPairViewItem
    nodes, tabId={{__translatedPath}}
        
      /> -->

  {#if $_$_translationPairsMap.get(__originalPath)}
    {#each Array.from($_$_translationPairsMap.get(__originalPath).values()) as pair (pair.uuid)}
      <TranslationPairViewItem
        filePath={__originalPath}
        translatedFilePath={__translatedPath}
        uuid={pair.uuid}
        original={pair.original}
        translated={pair.translated?.get(__translatedPath)}
      />
    {/each}
  {/if}
</div>
