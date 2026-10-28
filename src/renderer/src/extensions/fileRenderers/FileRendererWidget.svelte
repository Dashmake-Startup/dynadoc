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
  const _src = $derived(__src ?? node?.attrs?.src ?? '')
  const _isExternalUrl = $derived.by(() => /^(blob:|data:|https?:)/i.test(_src || ''))
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

  const _fileUrl = $derived(_rawSrc ? toAssetUrl(nodeApi.path.resolve(_rawSrc)) : '')
  const _fileExtension = $derived(_rawSrc ? nodeApi.path.extname(_rawSrc).toLowerCase() : '')
  const _hasSrc = $derived(!!_rawSrc)
  let _exists = $state<boolean | 'checking'>('checking')

  $effect(() => {
    const currentPath = _rawSrc
    if (!currentPath) {
      _exists = false
      return
    }
    if (_isExternalUrl) {
      _exists = true
      return
    }
    _exists = 'checking'
    async function checkFile() {
      try {
        if (nodeApi.fsPromises?.exists) {
          _exists = await nodeApi.fsPromises.exists(currentPath)
          return
        }
        if (nodeApi.fs?.existsSync) {
          _exists = nodeApi.fs.existsSync(currentPath)
          return
        }
        _exists = true
      } catch {
        _exists = false
      }
    }
    void checkFile()
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

<!--  -->
{#if !_hasSrc}
  <MissingFilePlaceholder
    __title={$_('No file selected')}
    __subtitle={$_('Add a file to preview.')}
  />
{:else if !_exists}
  <MissingFilePlaceholder
    __title={$_('File missing')}
    __subtitle={$_('The file could not be found on disk.')}
    __path={_rawSrc}
  />
{:else if _exists === 'checking'}
  <div class="h-32 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] animate-pulse rounded-lg flex items-center justify-center border border-white/5">
    <i class="ph-bold ph-circle-notch animate-spin text-white/20"></i>
  </div>
{:else if !isPreviewable}
  <!--  -->
  <div class="text-gray-500 p-4">File not supported: {_fileExtension} - {_fileUrl}</div>
  <!--  -->
{:else if isPdf}
  {#if node}
    <!-- <MaxMinSizeContrainstWidget
        __width={_itemWidth}
        __height={_itemHeight}
        __maxHeight={_maxPageHeight}
        __maxWidth={_maxPageWidth}
      > -->
    <PdfRenderer
      __src={_rawSrc}
      __maxPageHeight={_maxPageHeight}
      __maxPageWidth={_maxPageWidth}
      __wysiwygEditorIdToUpdate={_wysiwygId}
    />
    <!-- </MaxMinSizeContrainstWidget> -->
  {:else}
    <!-- <MaxMinSizeContrainstWidget
      __width={_itemWidth}
      __height={_itemHeight}
      __maxHeight={_maxPageHeight}
      __maxWidth={_maxPageWidth}
    > -->
    <PdfRenderer
      __src={_rawSrc}
      __maxPageHeight={_maxPageHeight}
      __maxPageWidth={_maxPageWidth}
      __wysiwygEditorIdToUpdate={_wysiwygId}
    />
    <!-- </MaxMinSizeContrainstWidget> -->
  {/if}
{:else if isImage}
  {#if node}
    <!-- node -->

    <!-- __width={_itemWidth}
        __height={_itemHeight} -->
    <Resizer
      __width={_itemWidth}
      __height={_itemHeight}
      __maxHeight={_maxPageHeight}
      __maxWidth={_maxPageWidth}
      __direction="both"
      __lockAspectRatio={false}
      __onUpdate={(newAttrs) => {
        console.log('Update Attrs:', newAttrs)
        // update node src
        updateAttributes({
          width: newAttrs.width,
          height: newAttrs.height
        })
        // __updateAttrs?.(newAttrs)
      }}
    >
      <MaxMinSizeContrainstWidget
        __width={_itemWidth}
        __height={_itemHeight}
        __maxHeight={_maxPageHeight}
        __maxWidth={_maxPageWidth}
      >
        <ImageRenderer __src={_fileUrl} />
      </MaxMinSizeContrainstWidget>
    </Resizer>
  {:else}
    <!-- img -->
    <!-- <ImageRenderer __src={_fileUrl} /> -->
    <Resizer
      __width={_itemWidth}
      __height={_itemHeight}
      __maxHeight={_maxPageHeight}
      __maxWidth={_maxPageWidth}
      __direction="both"
      __lockAspectRatio={false}
      __onUpdate={(newAttrs) => {
        console.log('Update Attrs:', newAttrs)
        // update node src
        updateAttributes({
          width: newAttrs.width,
          height: newAttrs.height
        })
        // __updateAttrs?.(newAttrs)
      }}
    >
      <MaxMinSizeContrainstWidget
        __width={_itemWidth}
        __height={_itemHeight}
        __maxHeight={_maxPageHeight}
        __maxWidth={_maxPageWidth}
      >
        <ImageRenderer __src={_fileUrl} />
      </MaxMinSizeContrainstWidget>
    </Resizer>
  {/if}
{:else if isVideo}
  {#if node}
    <MaxMinSizeContrainstWidget
      __width={_itemWidth}
      __height={_itemHeight}
      __maxHeight={_maxPageHeight}
      __maxWidth={_maxPageWidth}
    >
      <VideoRenderer __src={_fileUrl} />
    </MaxMinSizeContrainstWidget>
  {:else}
    <!-- <VideoRenderer __src={_fileUrl} /> -->
    <MaxMinSizeContrainstWidget
      __width={_itemWidth}
      __height={_itemHeight}
      __maxHeight={_maxPageHeight}
      __maxWidth={_maxPageWidth}
    >
      <VideoRenderer __src={_fileUrl} />
    </MaxMinSizeContrainstWidget>
  {/if}
{:else if isAudio}
  {#if node}
    <MaxMinSizeContrainstWidget
      __width={_itemWidth}
      __height={_itemHeight}
      __maxHeight={_maxPageHeight}
      __maxWidth={_maxPageWidth}
    >
      <AudioRenderer __src={_fileUrl} />
    </MaxMinSizeContrainstWidget>
  {:else}
    <!-- <AudioRenderer __src={_fileUrl} /> -->
    <MaxMinSizeContrainstWidget
      __width={_itemWidth}
      __height={_itemHeight}
      __maxHeight={_maxPageHeight}
      __maxWidth={_maxPageWidth}
    >
      <AudioRenderer __src={_fileUrl} />
    </MaxMinSizeContrainstWidget>
  {/if}
{:else if isSpreadsheet}
  {#if node}
    <MaxMinSizeContrainstWidget
      __width={_itemWidth}
      __height={_itemHeight}
      __maxHeight={_maxPageHeight}
      __maxWidth={_maxPageWidth}
    >
      <SpreadsheetRenderer __src={_src} />
    </MaxMinSizeContrainstWidget>
  {:else}
    <!-- <SpreadsheetRenderer __src={_src} /> -->
    <MaxMinSizeContrainstWidget
      __width={_itemWidth}
      __height={_itemHeight}
      __maxHeight={_maxPageHeight}
      __maxWidth={_maxPageWidth}
    >
      <SpreadsheetRenderer __src={_src} />
    </MaxMinSizeContrainstWidget>
  {/if}
{:else if isCode}
  {#if node}
    <MaxMinSizeContrainstWidget
      __width={_itemWidth}
      __height={_itemHeight}
      __maxHeight={_maxPageHeight}
      __maxWidth={_maxPageWidth}
    >
      <!-- <CodeRenderer __src={_fileUrl} /> -->
      <CodeRenderer __src={_src} />
    </MaxMinSizeContrainstWidget>
  {:else}
    <!-- <CodeRenderer __src={_src} /> -->
    <MaxMinSizeContrainstWidget
      __width={_itemWidth}
      __height={_itemHeight}
      __maxHeight={_maxPageHeight}
      __maxWidth={_maxPageWidth}
    >
      <!-- <CodeRenderer __src={_fileUrl} /> -->
      <CodeRenderer __src={_src} />
    </MaxMinSizeContrainstWidget>
  {/if}
{:else}
  <!--  -->
  <div class="text-gray-500 p-4">Unsupported file type: {_fileExtension}</div>
  <!--  -->
{/if}

<!--  -->

<style>
  div {
    font-size: 0.9rem;
  }
</style>
