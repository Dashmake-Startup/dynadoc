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
  import TranslationPairViewItem from './TranslationPairViewItem.svelte'
  // import { generateJSON } from '@tiptap/core'
  import { _$_wysiwygEditorsList } from '../../../../stores/editor.store'
  import type { TranslationUnit } from '../utils/utils'
  import { generateJSON, generateHTML } from '@tiptap/core'
  import EditorExtensionHelpers from '../../../../utils/EditorExtensionHelpers'
  import { v4 as uuidv4 } from 'uuid'
import { nodeApi } from '../../../../utils/shims/node'

  let { __originalPath, __translatedPath, __wysiwygEditorId } = $props()
  // --- Runes for State ---
  let units = $state<TranslationUnit[]>([])
  let editingId = $state<string | null>(null)

  const emptyDoc = () => ({ type: 'doc', content: [] })

  async function loadFiles() {
    // console.log('loadFilesss', {__translatedPath, __originalPath,})

    // 1. Load Files
    let translatedRaw = ''
    try {
      translatedRaw = await nodeApi.fsPromises?.readFile(__translatedPath, 'utf-8')
    } catch {
      translatedRaw = ''
    }

    // console.log('loadFilesss', {__translatedPath, __originalPath, translatedRaw})

    let translatedDoc = emptyDoc()
    try {
      translatedDoc = translatedRaw ? JSON.parse(translatedRaw) : emptyDoc()
    } catch {
      translatedDoc = emptyDoc()
    }

    let originalRaw = ''
    try {
      originalRaw = await nodeApi.fsPromises?.readFile(__originalPath, 'utf-8')
    } catch {
      originalRaw = ''
    }

    // console.log('loadFilesss ggg', {translatedRaw, translatedDoc,originalRaw})

    const extensions = [
      ...EditorExtensionHelpers.getMainWysiwygExtensions(
        null,
        null,
        'Start translating...',
        null,
        null,
        uuidv4()
      )
    ]
    /* const extensions = [
      StarterKit,
      UniqueID.configure({
        types: ['heading', 'paragraph']
      })
    ] */
    // Assuming you have access to a Tiptap instance or generateJSON helper
    // const originalJson = generateJSON(originalRaw, extensions)

    const wysiwygEditor = _$_wysiwygEditorsList.getItem(__originalPath)
    let originalJson: any = emptyDoc()
    if (wysiwygEditor?.getJSON) {
      originalJson = wysiwygEditor.getJSON()
    } else if (originalRaw) {
      try {
        // Try JSON first (if file already JSON)
        originalJson = JSON.parse(originalRaw)
      } catch {
        try {
          originalJson = generateJSON(originalRaw, extensions)
        } catch {
          originalJson = emptyDoc()
        }
      }
    }

    // Inside your file loading logic
    const originalContent = Array.isArray(originalJson?.content) ? originalJson.content : []
    const filteredOriginalContent = originalContent.filter((node) => {
      const text =
        node.content
          ?.map((n) => n.text)
          .join('')
          .trim() ?? ''
      // Ignore nodes that have no text and aren't functional assets (like images)
      return text.length > 0 || node.type === 'image' || node.type === 'video'
    })

    // 2. Flatten & Align (High Performance)
    const newUnits: TranslationUnit[] = []
    const translatedMap = new Map()

    // Index translated nodes by UUID for O(1) lookup
    const translatedContent = Array.isArray(translatedDoc?.content) ? translatedDoc.content : []
    translatedContent.forEach((node) => {
      if (node?.attrs?.uuid) translatedMap.set(node.attrs.uuid, node)
    })
    // console.log('loadFilesss ggg', { translatedMap, originalJson, newUnits })

    // Helper to wrap single nodes for Tiptap's generateHTML
    const wrapNode = (n: any) => ({
      type: 'doc',
      content: [n]
    })

    // --- MATCHING LOGIC (Using the filtered list) ---
    filteredOriginalContent.forEach((node) => {
      const uuid = node.attrs?.uuid
      if (!uuid) return

      const translation = translatedMap.get(uuid)

      newUnits.push({
        id: uuid,
        originalJson: node,
        // Generate valid HTML for the source pane
        originalHtml: generateHTML(wrapNode(node), extensions),

        // If no translation exists, we keep the JSON null or empty
        // to trigger your 'isMissing' Red BG logic correctly
        translatedJson: translation || null,

        // Generate HTML only if translation exists
        translatedHtml: translation ? generateHTML(wrapNode(translation), extensions) : '',

        isStale: false
      })
    })

    // Match original nodes to translations
    /* originalJson.content.forEach((node) => {
      // filteredOriginalContent.content.forEach((node) => {
      const uuid = node.attrs?.uuid
      if (!uuid) return

      const translation = translatedMap.get(uuid)
      // Create a dummy doc structure for the generator
      const wrapNode = (n: any) => ({
        type: 'doc',
        content: [n]
      })

      newUnits.push({
        id: uuid,
        originalJson: node,
        // originalHtml: generateHTML(node, extensions), // Cache HTML for the left pane
        // originalHtml: node?.content?.map((n) => n.text).join('') ?? '',

        originalHtml: generateHTML(wrapNode(node), extensions),
        // originalHtml: "<p>dd</p>",
        // originalHtml: node.toJSON(),

        translatedJson: translation || { ...node, content: [] }, // Default to empty if missing
        // translatedHtml: translation || { ...node, content: [] }, // Default to empty if missing
        // Correctly generate HTML for translated content
        // If translation doesn't exist, we render the original node shell (or empty)
        translatedHtml: translation ? generateHTML(wrapNode(translation), extensions) : '',
        isStale: false // Logic for dirty checking goes here
      })
    }) */

    units = newUnits
    console.log('loadFilesss ggg', { translatedMap, originalJson, newUnits })
  }

  onMount(loadFiles)

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

  // onMount(loadFiles)
</script>

<!-- <div class="mt-4 flex justify-end">
  <button class="bg-blue-500 text-base-content px-4 py-2 rounded hover:bg-blue-600" on:click={saveAll}>
    Save All Translations
  </button>
</div> -->

<!-- <div class="space-y-2 scrollable-section"> -->
<div class="space-y-2 h-full w-full">
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
  <TranslationPairViewItem
    __items={units}
    __translatedFilePath={__translatedPath}
    __filePath={__originalPath}
  />
  <!-- {JSON.stringify(pair, null, 2)}
      <br /><br />
      {JSON.stringify(Array.from($_$_translationPairsMap.get(__originalPath).values()), null, 2)}
      <br /><br /> -->
  <!-- {JSON.stringify( Array.from(get(_$_translationPairsMap).get(__originalPath).values()), null, 2)} -->

  <!-- {#if $_$_translationPairsMap.get(__originalPath)}
    {#each Array.from($_$_translationPairsMap.get(__originalPath).values()) as pair (pair.uuid)}
      <TranslationPairViewItem
        filePath={__originalPath}
        translatedFilePath={__translatedPath}
        uuid={pair.uuid}
        original={pair.original}
        translated={pair.translated?.get(__translatedPath)}
      />{/each}
  {/if} -->
</div>
