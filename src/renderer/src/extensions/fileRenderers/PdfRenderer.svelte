<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import { v4 as uuidv4 } from 'uuid'
  import * as pdfjsLib from 'pdfjs-dist'
  import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
  import { _$_wysiwygEditorsList } from '../../stores/editor.store'
  import MissingFilePlaceholder from './MissingFilePlaceholder.svelte'
  import { nodeApi } from '../../utils/shims/node'
  import Platform from '../../libs/platform'
  import { toLocalPath } from '../../utils/assetUrl'

  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

  interface Props {
    __src?: string
    __maxPageHeight?: number
    __maxPageWidth?: number
    __wysiwygEditorIdToUpdate?: string | null
  }

  let {
    __src = '',
    __maxPageHeight = 800,
    __maxPageWidth = 700,
    __wysiwygEditorIdToUpdate = null
  }: Props = $props()

  // --- State ---
  let container = $state<HTMLDivElement | null>(null)
  let _exists = $state<boolean | 'checking'>('checking')
  let _rendering = $state(false)
  let _reloadToken = $state(0)

  let _pdfDoc: any = null
  let _blobUrl: string | null = null
  const _watchCallerId = `pdf-renderer-${uuidv4()}`
  let _watchedPath: string | null = null

  // --- Utilities ---
  const isExternalUrl = (val: string) => /^(blob:|data:|https?:)/i.test(val || '')

  const _normalizedSrc = $derived.by(() => {
    if (!__src) return ''
    const raw = toLocalPath(__src)
    return decodeURIComponent(raw.split('?')[0])
  })

  // --- Core Methods ---
  const clearRender = () => {
    if (container) container.innerHTML = ''
    if (_blobUrl) {
      URL.revokeObjectURL(_blobUrl)
      _blobUrl = null
    }
    if (_pdfDoc) {
      _pdfDoc.destroy()
      _pdfDoc = null
    }
  }

  const renderPdf = async (path: string) => {
    if (!path || !container) return
    _rendering = true
    clearRender()

    try {
      // Fetch via your optimized Go serveAsset bridge
      const asset = await nodeApi.fsPromises.readAssetBlob(path)
      if (Platform.isDesktopPlatform) {
        _blobUrl = asset.url
        _pdfDoc = await pdfjsLib.getDocument(_blobUrl).promise
      } else {
        const arrayBuffer = await asset.blob.arrayBuffer()
        _pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      }

      for (let i = 1; i <= _pdfDoc.numPages; i++) {
        const page = await _pdfDoc.getPage(i)
        const unscaled = page.getViewport({ scale: 1 })
        const scale = Math.min(__maxPageWidth / unscaled.width, __maxPageHeight / unscaled.height)
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.className = 'pdf-page-canvas'
        canvas.width = viewport.width
        canvas.height = viewport.height

        const ctx = canvas.getContext('2d')
        if (ctx) await page.render({ canvasContext: ctx, viewport }).promise
        container.appendChild(canvas)
      }
    } catch (err) {
      console.error('[dynadoc] PDF Render Error:', err)
      _exists = false // Treat render failure as "missing/unreadable"
    } finally {
      _rendering = false
      if (__wysiwygEditorIdToUpdate) {
        _$_wysiwygEditorsList.getItem(__wysiwygEditorIdToUpdate)?.commands.updatePagination()
      }
    }
  }

  // --- Effects ---
  // 1. Unified Existence Check
  $effect(() => {
    const path = _normalizedSrc
    if (!path) {
      _exists = false
      return
    }
    if (isExternalUrl(path)) {
      _exists = true
      return
    }

    _exists = 'checking'
    nodeApi.fsPromises
      .exists(path)
      .then((ok) => {
        _exists = ok
      })
      .catch(() => {
        _exists = false
      })
  })

  // 2. Render & Watcher Management
  $effect(() => {
    const path = _normalizedSrc
    const token = _reloadToken // Track reload requests

    if (_exists === true && path) {
      renderPdf(path)

      // Setup file watcher
      if (!isExternalUrl(path) && window?.api?.watchFile) {
        if (_watchedPath && _watchedPath !== path) {
          window.api.unwatchFile(_watchedPath, _watchCallerId)
        }
        _watchedPath = path
        window.api.watchFile(path, _watchCallerId)
      }
    } else {
      clearRender()
    }

    return () => {
      if (_watchedPath && window?.api?.unwatchFile) {
        window.api.unwatchFile(_watchedPath, _watchCallerId)
        _watchedPath = null
      }
    }
  })

  onMount(() => {
    const unsub = window?.api?.onFileChange?.((_: any, cid: string) => {
      if (cid === _watchCallerId) _reloadToken++
    })
    return () => {
      unsub?.()
      clearRender()
    }
  })
</script>

<div class="pdf-wrapper relative w-full h-full overflow-auto">
  {#if _exists === 'checking' || _rendering}
    <div
      class="absolute inset-0 flex flex-col items-center justify-center bg-black/10 backdrop-blur-sm z-10"
    >
      <vscode-progress-ring></vscode-progress-ring>
      <span class="mt-4 text-xs font-bold uppercase tracking-widest opacity-50"
        >{$_('Processing PDF')}</span
      >
    </div>
  {/if}

  {#if _exists === false}
    <MissingFilePlaceholder
      __title={$_('Document unreachable')}
      __subtitle={$_('The PDF could not be found or loaded.')}
      __path={_normalizedSrc}
    />
  {/if}

  <div
    bind:this={container}
    class="pdf-preview-container flex flex-col items-center gap-6 p-8"
    class:opacity-0={_exists !== true}
  ></div>
</div>

<style>
  .pdf-preview-container :global(.pdf-page-canvas) {
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    background: white;
    border-radius: 2px;
    max-width: 100%;
    height: auto !important;
    transition: transform 0.2s ease;
  }

  .pdf-wrapper {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
  }

  :global(.pdf-preview-container canvas) {
    @apply: m-auto border border-ligt dark:border-dark rounded-[5px];
  }
  canvas {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: opacity 0.3s ease;
  }
</style>
