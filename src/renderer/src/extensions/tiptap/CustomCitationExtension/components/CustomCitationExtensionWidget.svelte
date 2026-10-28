
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
// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

  import { _ } from 'svelte-i18n'
  import { onMount, createEventDispatcher } from 'svelte'
import { nodeApi } from '../../../../utils/shims/node'
  // import { bibContent } from '$lib/stores/bib'
  // import { get } from 'svelte/store'

  export let bibFilePath
  const dispatch = createEventDispatcher()

  let keys: { id: string; title?: string }[] = []
  let query = ''

  onMount(async () => {
    const bib =
      (nodeApi.fs.existsSync(bibFilePath)
        ? await nodeApi.fsPromises.readFile(bibFilePath, 'utf-8')
        : null) || ''
    if (!bib.trim()) return
    // if (!bib) return
    const CJ = await import('@citation-js/core')
    // parse bibtex -> get ids
    const cite = await CJ.Cite.async(bib)
    const items = cite.get({ type: 'json' })
    keys = items.map((it: any) => ({ id: it.id, title: it.title || it['title'] }))
  })

  function choose(k) {
    dispatch('select', k)
  }
</script>

<div class="p-4">
  <input placeholder={$_('filter')} bind:value={query} class="input input-sm w-full mb-2" />
  <ul class="max-h-60 overflow-auto">
    {#each keys.filter((k) => !query || k.id.includes(query) || String(k.title)
          .toLowerCase()
          .includes(query.toLowerCase())) as k}
      <li class="py-1 cursor-pointer hover:bg-base-200" on:click={() => choose(k)}>
        <strong>{k.id}</strong> — <span class="text-sm">{k.title}</span>
      </li>
    {/each}
  </ul>
</div>