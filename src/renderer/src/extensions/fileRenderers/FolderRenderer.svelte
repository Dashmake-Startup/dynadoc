<script lang="ts">
import { nodeApi } from '../../utils/shims/node'
  import { _ } from 'svelte-i18n'
  import FileRenderer from './FileRenderer.svelte'
  import FolderRenderer from './FolderRenderer.svelte'
  import { NodeViewWrapper } from 'svelte-tiptap'
  import MissingFilePlaceholder from './MissingFilePlaceholder.svelte'
  import { toLocalPath } from '../../utils/assetUrl'

// const  fs = nodeApi.fs
// const  path = nodeApi.path

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

  // Define props - Tiptap passes attributes directly or inside a 'node' object
  // let { __src = '', node } = $props<{ __src?: string, node?: any }>();
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

  const _maxPageHeight = $derived(__maxPageHeight ?? node?.attrs?.maxPageHeight)
  const _maxPageWidth = $derived(__maxPageWidth ?? node?.attrs?.maxPageWidth)
  const _wysiwygId = $derived(__wysiwygEditorIdToUpdate ?? node?.attrs?.wysiwygEditorIdToUpdate)
  const _itemHeight = $derived(__itemHeight ?? node?.attrs?.height ?? _maxPageHeight)
  const _itemWidth = $derived(__itemWidth ?? node?.attrs?.width ?? _maxPageWidth)

  // Determine the actual source: check the prop __src, then node attributes
  let effectiveSrc = $derived(__src || node?.attrs?.src || '')
  const normalizedSrc = $derived.by(() => {
    const raw =
      toLocalPath(effectiveSrc)
    return (raw || '').split('?')[0]
  })
  const isExternalUrl = (value: string) => /^(blob:|data:|https?:)/i.test(value || '')
  let folderExists = $state<boolean | 'checking'>('checking')

  $effect(() => {
    const currentPath = normalizedSrc
    if (!currentPath) {
      folderExists = false
      return
    }
    if (isExternalUrl(currentPath)) {
      folderExists = true
      return
    }
    folderExists = 'checking'
    async function checkFolder() {
      try {
        if (nodeApi.fsPromises?.exists) {
          folderExists = await nodeApi.fsPromises.exists(currentPath)
          return
        }
        if (nodeApi.fs?.existsSync) {
          folderExists = nodeApi.fs.existsSync(currentPath)
          return
        }
        folderExists = true
      } catch {
        folderExists = false
      }
    }
    void checkFolder()
  })

  let items = $state<
    Array<{
      name: string
      fullPath: string
      type: 'file' | 'folder'
    }>
  >([])

  async function loadFolder(ignoreHidden = true) {
    // GUARD: If effectiveSrc is empty, do nothing
    if (!normalizedSrc || normalizedSrc.trim() === '') {
      items = []
      return
    }
    if (folderExists !== true) {
      items = []
      return
    }

    try {
      const all = await nodeApi.fsPromises?.readdir(normalizedSrc)
      if (!all) return

      const mapped = await Promise.all(
        all
          .filter((name) => !ignoreHidden || !name.startsWith('.'))
          .map(async (name) => {
            const fullPath = nodeApi.path.join(normalizedSrc, name)
            const stat = await nodeApi.fsPromises?.lstat(fullPath)
            return {
              name,
              fullPath,
              type: stat?.isDirectory() ? 'folder' : 'file'
            }
          })
      )
      items = mapped as any
    } catch (e) {
      console.error('Error reading folder:', e)
      items = []
    }
  }

  // Reactive effect: reload whenever effectiveSrc changes
  $effect(() => {
    void loadFolder()
  })
</script>

{#if node}
  <NodeViewWrapper class="folder">
    {#if !effectiveSrc}
      <MissingFilePlaceholder __title={$_('No folder selected')} __subtitle={$_('Choose a folder to preview.')} />
    {:else if folderExists === 'checking'}
      <div class="h-32 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] animate-pulse rounded-lg flex items-center justify-center border border-white/5">
        <i class="ph-bold ph-circle-notch animate-spin text-white/20"></i>
      </div>
    {:else if folderExists === false}
      <MissingFilePlaceholder __title={$_('Folder missing')} __subtitle={$_('The folder could not be found.')} __path={effectiveSrc} />
    {:else if items.length === 0}
      <div class="empty">{$_('Folder is empty')}</div>
    {:else}
      {#each items as item (item.fullPath)}
        {#if item.type === 'file'}
          <FileRenderer
            __src={item.fullPath}
            {node}
            {view}
            {getPos}
            {updateAttributes}
            {selected}
            {extension}
            __itemHeight={_itemHeight}
            __itemWidth={_itemWidth}
            __maxPageHeight={_maxPageHeight}
            __maxPageWidth={_maxPageWidth}
            {__wysiwygEditorIdToUpdate}
          />
        {:else}
          <FolderRenderer
            __src={item.fullPath}
            {node}
            {view}
            {getPos}
            {updateAttributes}
            {selected}
            {extension}
            __itemHeight={_itemHeight}
            __itemWidth={_itemWidth}
            __maxPageHeight={_maxPageHeight}
            __maxPageWidth={_maxPageWidth}
            {__wysiwygEditorIdToUpdate}
          />
        {/if}
      {/each}
    {/if}
  </NodeViewWrapper>
{:else}
  <div class="folder">
    {#if !effectiveSrc}
      <MissingFilePlaceholder __title={$_('No folder selected')} __subtitle={$_('Choose a folder to preview.')} />
    {:else if folderExists === 'checking'}
      <div class="h-32 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] animate-pulse rounded-lg flex items-center justify-center border border-white/5">
        <i class="ph-bold ph-circle-notch animate-spin text-white/20"></i>
      </div>
    {:else if folderExists === false}
      <MissingFilePlaceholder __title={$_('Folder missing')} __subtitle={$_('The folder could not be found.')} __path={effectiveSrc} />
    {:else if items.length === 0}
      <div class="empty">{$_('Folder is empty')}</div>
    {:else}
      {#each items as item (item.fullPath)}
        {#if item.type === 'file'}
          <FileRenderer
            __src={item.fullPath}
            __itemHeight={_itemHeight}
            __itemWidth={_itemWidth}
            __maxPageHeight={_maxPageHeight}
            __maxPageWidth={_maxPageWidth}
            {__wysiwygEditorIdToUpdate}
          />
        {:else}
          <FolderRenderer
            __src={item.fullPath}
            __itemHeight={_itemHeight}
            __itemWidth={_itemWidth}
            __maxPageHeight={_maxPageHeight}
            __maxPageWidth={_maxPageWidth}
            {__wysiwygEditorIdToUpdate}
          />
        {/if}
      {/each}
    {/if}
  </div>
{/if}
