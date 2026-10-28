<script lang="ts">
  // const nodeApi =
  //   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
  // const fs = nodeApi?.fs
  // const path = nodeApi?.path

  import { _ } from 'svelte-i18n'
  import PdfRenderer from './PdfRenderer.svelte'
  import ImageRenderer from './ImageRenderer.svelte'
  import VideoRenderer from './VideoRenderer.svelte'
  import CodeRenderer from './CodeRenderer.svelte'
  import SpreadsheetRenderer from './SpreadsheetRenderer.svelte'
  import Utils from '../../utils/Utils'
  import AudioRenderer from './Audio/AudioRenderer.svelte'
  import Resizer from '../../components/app/editor/components/display/Resizer.svelte'
  import { NodeViewWrapper } from 'svelte-tiptap'
  import MaxMinSizeContrainstWidget from '../../components/app/editor/components/display/MaxMinSizeContrainstWidget.svelte'
  import { _$_wysiwygEditorsList } from '../../stores/editor.store'
  import MissingFilePlaceholder from './MissingFilePlaceholder.svelte'
  import { nodeApi } from '../../utils/shims/node'
  import FileRendererWidget from './FileRendererWidget.svelte'
  import Platform from '../../libs/platform'
  import { toAssetUrl, toLocalPath } from '../../utils/assetUrl'

  // let fs = fs
  // let path = path

  interface Props {
    node?: any
    view?: any
    getPos?: () => number
    updateAttributes?: (attrs: Record<string, any>) => void
    selected?: boolean
    extension?: any
    __src?: string
    __itemHeight?: number
    __itemWidth?: number
    __maxPageHeight?: number
    __maxPageWidth?: number
    __wysiwygEditorIdToUpdate?: string
    // Added from your lower script section
    __updateAttrs?: (attrs: Record<string, any>) => void
    __node?: any
  }

  // 1. Destructure props with $props()
  let {
    node,
    view,
    getPos,
    updateAttributes,
    selected,
    extension,
    __src,
    __itemHeight,
    __itemWidth,
    __maxPageHeight,
    __maxPageWidth,
    __wysiwygEditorIdToUpdate,
    __updateAttrs,
    __node
  }: Props = $props()

  // 2. Derived logic (Replaces $: and manual calculations)
  let _src = $derived(__src ?? node?.attrs?.src ?? '')
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
  const _rawSrc = $derived(_src ? normalizePath(_src) : '')
  // Inside your <script> section
  /* let refreshKey = $state(0)

  const handleReload = () => {
    refreshKey += 1
  } */
  let _displaySrc = $state(null)

  $effect(() => {
    if (!_rawSrc) return

    loadFile()
    /* nodeApi.fsPromises.readAssetBlob(_path).then((res) => {
      if (res) _displaySrc = res.url
    })

    // Cleanup to prevent Electron memory bloating
    return () => {
      if (_displaySrc) URL.revokeObjectURL(_displaySrc)
    } */
  })

  async function loadFile() {
    if (!Platform.isDesktopPlatform) {
      nodeApi.fsPromises.readAssetBlob(_rawSrc).then((res) => {
        if (res) {
          _displaySrc = res.url
          // _displaySrc = _fileUrl = _src = res.url
        }
      })

      // Cleanup to prevent Electron memory bloating
      return () => {
        if (_displaySrc) URL.revokeObjectURL(_displaySrc)
      }
    }
    return () => {}
  }

  // Update your _fileUrl to be "cache-aware"
  // const _fileUrl = $derived(
  //   _rawSrc ? `file://${nodeApi.path.resolve(_rawSrc)}?v=${refreshKey}` : ''
  // )

  let _fileUrl = $derived(_rawSrc ? toAssetUrl(nodeApi.path.resolve(_rawSrc)) : '')
  const _fileExtension = $derived(_rawSrc ? nodeApi.path.extname(_rawSrc).toLowerCase() : '')
  const _hasSrc = $derived(!!_rawSrc)
  /* const _exists = $derived.by(async () => {
    if (!_rawSrc) return false
    if (!nodeApi.fsPromises?.exists) return true
    // if (!nodeApi.fs?.existsSync) return true
    try {
      return await nodeApi.fsPromises.exists(_rawSrc)
      // return  nodeApi.fs.existsSync(_rawSrc)
    } catch {
      return false
    }
  }) */

  let _exists = $state<boolean | 'checking'>('checking')

  $effect(() => {
    // We must track _path inside the effect for it to re-run
    const currentPath = _rawSrc

    if (!currentPath) {
      _exists = true
      return
    }

    // Explicitly set to checking whenever the path changes
    _exists = 'checking'

    async function checkFile() {
      try {
        // Use access (modern async way) instead of exists
        // F_OK simply checks if the file is visible to the process
        // await nodeApi.fsPromises.access(currentPath, nodeApi.constants.F_OK);
        _exists = await nodeApi.fsPromises.exists(currentPath)
        // _exists = true
      } catch (err) {
        console.warn(`[dynadoc] Async Access Denied/Missing: ${currentPath}`, { err })
        _exists = false
      }
    }

    checkFile()
  })
  const _maxPageHeight = $derived(__maxPageHeight ?? node?.attrs?.maxPageHeight)
  const _maxPageWidth = $derived(__maxPageWidth ?? node?.attrs?.maxPageWidth)
  const _wysiwygId = $derived(__wysiwygEditorIdToUpdate ?? node?.attrs?.wysiwygEditorIdToUpdate)
  const _itemHeight = $derived(__itemHeight ?? node?.attrs?.height ?? _maxPageHeight)
  const _itemWidth = $derived(__itemWidth ?? node?.attrs?.width ?? _maxPageWidth)

  const paginationStore = _$_wysiwygEditorsList.getPaginationOptionsStore(_wysiwygId)
  // Now $derived will track $paginationStore correctly!
  let _editorPaginationOptions = $derived($paginationStore || null)

  // 3. Status Helpers (Derived from _fileExtension)
  const isPreviewable = $derived(
    Object.values(Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST).includes(_fileExtension)
  )
  const isPdf = $derived(_fileExtension === Utils.PREVIEWABLE_FILE_EXTENSIONS.pdf)
  const isImage = $derived(Object.values(Utils.IMAGE_EXTENSIONS).includes(_fileExtension))
  const isVideo = $derived(Object.values(Utils.VIDEO_EXTENSIONS).includes(_fileExtension))
  const isAudio = $derived(Object.values(Utils.AUDIO_EXTENSIONS).includes(_fileExtension))
  const isSpreadsheet = $derived(
    _fileExtension === Utils.OFFICE_EXTENSIONS.excel || _fileExtension === '.csv' || _fileExtension === '.xls'
  )
  const isCode = $derived(
    Object.values(Utils.PROGRAMMING_LANGUAGE_EXTENSIONS_LIST ?? {}).includes(_fileExtension)
  )
</script>

{#if node}
  <NodeViewWrapper>
    {@render content()}
  </NodeViewWrapper>
{:else}
  {@render content()}
{/if}

{#snippet content()}
  <div class="relative group">
    {#if selected}
      <div class="absolute top-2 right-2 z-50 flex gap-2 animate-in fade-in zoom-in duration-200">
        <button
          onclick={loadFile}
          class="flex items-center gap-2 px-3 py-1.5 bg-base-200 border border-white/10 rounded-md shadow-2xl text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-[#3d3d3d] transition-all active:scale-95"
          title={$_('Reload Asset')}
        >
          <i class="ph-bold ph-arrows-clockwise"></i>
          <!-- <i class="ph-bold ph-arrows-clockwise {refreshKey > 0 ? 'animate-spin-once' : ''}"></i> -->
          <span>{$_('Reload')}</span>
        </button>
      </div>
    {/if}
  </div>
  {#if !_hasSrc}
    <MissingFilePlaceholder
      __title={$_('No file selected')}
      __subtitle={$_('Add a file to preview.')}
    />
  {:else if !_exists}
    <MissingFilePlaceholder
      __title={$_('File missing')}
      __subtitle={$_('The file could not be found.')}
      __path={_rawSrc}
    />
  {:else if !isPreviewable}
    <div class="text-gray-500 p-4">File not supported: {_fileExtension}</div>
  {:else}
    <MaxMinSizeContrainstWidget
      __width={_itemWidth}
      __height={_itemHeight}
      __maxHeight={_maxPageHeight}
      __maxWidth={_maxPageWidth}
    >
      {#if isPdf}
        <PdfRenderer
          __src={_displaySrc ?? _rawSrc}
          __maxPageHeight={_maxPageHeight}
          __maxPageWidth={_maxPageWidth}
          __wysiwygEditorIdToUpdate={_wysiwygId}
        />
      {:else if isImage}
        <Resizer
          __width={_itemWidth}
          __height={_itemHeight}
          __maxHeight={_maxPageHeight}
          __maxWidth={_maxPageWidth}
          __direction="both"
          __onUpdate={(newAttrs) =>
            updateAttributes?.({ width: newAttrs.width, height: newAttrs.height })}
        >
          <ImageRenderer __src={_displaySrc ?? _fileUrl} />
        </Resizer>
      {:else if isVideo}
        <VideoRenderer __src={_displaySrc ?? _fileUrl} />
      {:else if isAudio}
        <AudioRenderer __src={_displaySrc ?? _fileUrl} />
      {:else if isSpreadsheet}
        <SpreadsheetRenderer __src={_displaySrc ?? _src} />
      {:else if isCode}
        <CodeRenderer __src={_displaySrc ?? _src} />
      {/if}
    </MaxMinSizeContrainstWidget>
  {/if}
{/snippet}

<style>
  div {
    font-size: 0.9rem;
  }
</style>
