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
<!-- <script lang="ts">
import { nodeApi } from '../../utils/shims/node'

  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { onMount } from "svelte";
  let { src }: { src: string; // can be file path, URL, or base64 string } = $props()


  let viewerUrl: string = "";

  function isBase64(str: string): boolean {
    return /^JVBERi0/.test(str); // quick check for PDF base64 (starts with %PDF -> "JVBERi0")
  }

  onMount(() => {
    if (!src) return;

    if (isBase64(src)) {
      // Base64 → Blob → object URL
      const binary = atob(src);
      const len = binary.length;
      const buffer = new Uint8Array(len);
      for (let i = 0; i < len; i++) buffer[i] = binary.charCodeAt(i);
      const blob = new Blob([buffer], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      viewerUrl = `/pdfjs/web/viewer.html?file=${encodeURIComponent(blobUrl)}`;
    } else if (src.startsWith("http")) {
      // Remote URL
      viewerUrl = `/pdfjs/web/viewer.html?file=${encodeURIComponent(src)}`;
    } else {
      // Local file path
      viewerUrl = `./pdfjs/web/viewer.html?file=${encodeURIComponent(toAssetUrl(src))}`;
    }
  });
</script>

<iframe
  src={viewerUrl}
  
  class="w-full h-full border-0"></iframe> -->

<script lang="ts">
import { nodeApi } from '../../utils/shims/node'
  import { onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import MissingFilePlaceholder from '../fileRenderers/MissingFilePlaceholder.svelte'
  import { toAssetUrl, toLocalPath } from '../../utils/assetUrl'

//   let fs = nodeApi.fs
//   let path = nodeApi.path

  interface Props {
    __src?: string
  }

  let { __src = '' }: Props = $props()
  let reloadToken = $state(0)
  const watchCallerId = `pdf-viewer-${Math.random().toString(36).slice(2)}`
  let watchedPath: string | null = null
  const normalizePath = (value: string) => {
    if (!value) return ''
    const stripped = toLocalPath(value)
    const noQuery = stripped.split('?')[0]
    try {
      return decodeURIComponent(noQuery)
    } catch {
      return noQuery
    }
  }
  const normalizedSrc = $derived(normalizePath(__src))
  const isExternalUrl = (value: string) => /^(blob:|data:|https?:)/i.test(value || '')

  let viewerURL = $state('')
  let iframeRef: HTMLIFrameElement
  let fileExists = $state(false)

  $effect(() => {
    let cancelled = false
    const currentSrc = normalizedSrc
    void reloadToken
    void (async () => {
      if (!currentSrc) {
        if (!cancelled) fileExists = false
        return
      }
      if (isExternalUrl(currentSrc)) {
        if (!cancelled) fileExists = true
        return
      }
      try {
        const exists = await nodeApi.fsPromises.exists(currentSrc)
        if (!cancelled) fileExists = exists
      } catch {
        if (!cancelled) fileExists = false
      }
    })()

    return () => {
      cancelled = true
    }
  })

  $effect(() => {
    let cancelled = false
    const currentSrc = normalizedSrc
    const currentExists = fileExists
    const currentReload = reloadToken
    void currentReload

    void (async () => {
      if (!currentSrc || !currentExists) {
        if (!cancelled) viewerURL = ''
        return
      }
      if (isExternalUrl(currentSrc)) {
        if (!cancelled) viewerURL = `/pdfjs/web/viewer.html?file=${encodeURIComponent(currentSrc)}`
        return
      }
      try {
        const data = await nodeApi.fsPromises.readFile(currentSrc)
        const blob = new Blob([data], { type: 'application/pdf' })
        const blobURL = URL.createObjectURL(blob)
        if (!cancelled) {
          viewerURL = `/pdfjs/web/viewer.html?file=${encodeURIComponent(blobURL)}`
        } else {
          URL.revokeObjectURL(blobURL)
        }
      } catch {
        if (!cancelled) viewerURL = ''
      }
    })()

    return () => {
      cancelled = true
    }
  })

  const unwatchCurrent = () => {
    if (!watchedPath || !window?.api?.unwatchFile) return
    try {
      window.api.unwatchFile(watchedPath, watchCallerId)
    } catch {
      // ignore
    }
    watchedPath = null
  }

  const watchPath = (nextPath: string) => {
    if (!nextPath || !window?.api?.watchFile) return
    if (watchedPath === nextPath) return
    unwatchCurrent()
    watchedPath = nextPath
    try {
      window.api.watchFile(nextPath, watchCallerId)
    } catch {
      // ignore
    }
  }

  $effect(() => {
    watchPath(normalizedSrc)
  })

  $effect(() => {
    if (!normalizedSrc) return
    if (!fileExists) {
      try {
        const id = setInterval(() => {
          void nodeApi.fsPromises.exists(normalizedSrc).then((exists) => {
            if (!exists) return
            reloadToken += 1
            clearInterval(id)
          })
        }, 1000)
        return () => clearInterval(id)
      } catch {
        // ignore
      }
    }
  })

  onMount(() => {
    const unsubscribe =
      window?.api?.onFileChange?.((_content: string, callerId: string) => {
        if (callerId !== watchCallerId) return
        reloadToken += 1
      }) ?? null

    return () => {
      unwatchCurrent()
      unsubscribe?.()
    }
  })
</script>

{#if !__src}
  <MissingFilePlaceholder
    __title={$_('No PDF selected')}
    __subtitle={$_('Choose a PDF file to preview.')}
  />
{:else if !fileExists}
  <MissingFilePlaceholder
    __title={$_('PDF missing')}
    __subtitle={$_('The PDF file could not be found.')}
    __path={normalizedSrc}
  />
{:else}
  <div class="wrapper">
    <iframe bind:this={iframeRef} src={viewerURL}></iframe>
  </div>
{/if}

<style>
  .wrapper {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
</style>
