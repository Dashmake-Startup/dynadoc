

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import Resizer from '../../../../components/app/editor/components/display/Resizer.svelte'
  import { NodeViewWrapper } from 'svelte-tiptap'
  import GalleryBuilderWidget from './GalleryBuilderWidget.svelte'
  import ScrollGuardOverlay from '../../../../components/common/interaction/ScrollGuardOverlay.svelte'
import { nodeApi } from '../../../../utils/shims/node'
import { toAssetUrl } from '../../../../utils/assetUrl'

  interface Props {
    node: any
    view: any
    getPos: () => number
    updateAttributes: (attrs: Record<string, any>) => void
    selected: boolean
    extension: any
    useNodeViewWrapper?: boolean
    isMirror?: boolean
    __src?: string
    __spreadsheetHeight?: number
    __spreadsheetWidth?: number
    __maxPageHeight?: number
    __maxPageWidth?: number
    __wysiwygEditorIdToUpdate?: string
  }

  let {
    node,
    view,
    getPos,
    updateAttributes,
    selected,
    extension,
    useNodeViewWrapper = true,
    isMirror = false,
    __src,
    __spreadsheetHeight,
    __spreadsheetWidth,
    __maxPageHeight,
    __maxPageWidth,
    __wysiwygEditorIdToUpdate
  }: Props = $props()

  let _src = $derived(__src ?? node.attrs.src)
  const _spreadsheetHeight = $derived(__spreadsheetHeight ?? node.attrs.spreadsheetHeight)
  const _spreadsheetWidth = $derived(__spreadsheetWidth ?? node.attrs.spreadsheetWidth)
  const _maxPageHeight = $derived(__maxPageHeight || node.attrs.maxPageHeight)
  const _maxPageWidth = $derived(__maxPageWidth ?? node.attrs.maxPageWidth)
  const _wysiwygEditorIdToUpdate = $derived(
    __wysiwygEditorIdToUpdate ?? node.attrs.wysiwygEditorIdToUpdate
  )

  // IMPORTANT: If isMirror is true, we MUST force useNodeViewWrapper to false
  const _shouldWrap = $derived(useNodeViewWrapper && !isMirror)

  // --- Node.js Environment (from your window context) ---
//   const nodeApi =
//     typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
//   const fs = nodeApi?.fs
//   const path = nodeApi?.path

  // Source path from Tiptap node attributes
  //   let __src = $derived(node.attrs[CustomGalleryExtensionProps.tagAttributeSrc] || '')

  let galleryItems: Array<{
    src: string
    thumb: string
    type: 'image' | 'video'
    name: string
    videoParams?: string
  }> = $state([])

  let galleryContainer: HTMLElement
  let lgInstance: any = null

  // --- Load Folder Logic ---
  async function loadGalleryFromFolder1() {
    if (!_src) return
    try {
      const all = await nodeApi.fsPromises.readdir(_src)

      galleryItems = all
        .filter((name) => !name.startsWith('.')) // Ignore hidden files
        .map((name) => {
          const fullPath = nodeApi.path.join(_src, name)
          const ext = nodeApi.path.extname(name).toLowerCase()

          // Identify images vs videos
          const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)
          const isVideo = ['.mp4', '.webm', '.ogg'].includes(ext)

          if (!isImage && !isVideo) return null

          return {
            name,
            src: toAssetUrl(fullPath), // Use file protocol for local assets
            thumb: toAssetUrl(fullPath), // For videos, you might need a separate thumbnail generator
            type: isImage ? 'image' : 'video',
            // lightGallery video params for HTML5 local videos
            videoParams: isVideo
              ? JSON.stringify({
                  source: [{ src: toAssetUrl(fullPath), type: `video/${ext.replace('.', '')}` }],
                  attributes: { preload: false, controls: true }
                })
              : null
          }
        })
        .filter(Boolean) as any

      // Refresh lightGallery after items load
      setTimeout(initLightGallery, 0)
    } catch (e) {
      console.error('Error reading gallery folder:', e)
      galleryItems = []
    }
  }

  /**
   * @param {string} folderPath - The root path to scan
   * @param {boolean} recursive - Whether to look inside subfolders
   */
  async function loadGalleryFromFolder(folderPath = _src, recursive = true) {
    if (!folderPath) return

    try {
      const getFiles = async (dir: string): Promise<any[]> => {
        const entries = await nodeApi.fsPromises.readdir(dir)
        const results = await Promise.all(entries.map(async (entryName) => {
          const fullPath = nodeApi.path.join(dir, entryName)
          let stat: any
          try {
            stat = await nodeApi.fsPromises.stat(fullPath)
          } catch {
            return []
          }

          if (stat.isDirectory()) {
            return recursive ? await getFiles(fullPath) : []
          }

          if (entryName.startsWith('.')) return []

          const ext = nodeApi.path.extname(entryName).toLowerCase()
          const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)
          const isVideo = ['.mp4', '.webm', '.ogg'].includes(ext)

          if (!isImage && !isVideo) return []

          return {
            name: entryName,
            src: toAssetUrl(fullPath),
            thumb: toAssetUrl(fullPath),
            type: isImage ? 'image' : 'video',
            videoParams: isVideo
              ? JSON.stringify({
                  source: [{ src: toAssetUrl(fullPath), type: `video/${ext.replace('.', '')}` }],
                  attributes: { preload: false, controls: true }
                })
              : null
          }
        }))
        return results.flat()
      }

      galleryItems = await getFiles(folderPath)

      // Refresh lightGallery
      setTimeout(initLightGallery, 0)
    } catch (e) {
      console.error('Error reading gallery folder:', e)
      galleryItems = []
    }
  }

  function initLightGallery() {
    if (lgInstance) {
      lgInstance.destroy()
    }
    if (galleryContainer && galleryItems.length > 0) {
      lgInstance = lightGallery(galleryContainer, {
        plugins: [lgVideo, lgThumbnail],
        selector: '.gallery-item',
        speed: 500,
        download: false
      })
    }
  }

  onMount(() => {
    void loadGalleryFromFolder()
  })

  // React to source path changes
  $effect(() => {
    if (_src) {
      void loadGalleryFromFolder()
    }
  })

  onDestroy(() => {
    if (lgInstance) lgInstance.destroy()
  })
</script>

{#if !_shouldWrap}
  <Resizer
    __width={_maxPageWidth}
    __height={_maxPageHeight * 0.8}
    __direction="both"
    __lockAspectRatio={false}
    __updateAttributes={(newAttrs) => {}}
  >
    <ScrollGuardOverlay message="Click to scroll/browse">
      <div class="gallery-extension-container bg-[#1e1e1e] p-4 rounded-lg border border-white/10">
        <div
          class="flex items-center gap-2 mb-4 text-base-content/50 text-[10px] uppercase tracking-widest font-bold"
        >
          <i class="ph-bold ph-images"></i>
          <span>Media Gallery: {nodeApi.path.basename(_src)}</span>
        </div>

        <div bind:this={galleryContainer} class="gallery-grid">
          {#if galleryItems.length === 0}
            <div
              class="col-span-full py-10 text-center text-base-content/20 border-2 border-dashed border-white/5 rounded"
            >
              {$_('No images or videos found in folder')}
            </div>
          {:else}
            {#each galleryItems as item}
              <a
                href={item.src}
                class="gallery-item group relative overflow-hidden rounded bg-black/40 border border-white/5 aspect-square flex items-center justify-center"
                data-video={item.videoParams}
              >
                {#if item.type === 'image'}
                  <img
                    src={item.src}
                    alt={item.name}
                    class="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                {:else}
                  <div class="flex flex-col items-center gap-2">
                    <i class="ph-light ph-play-circle text-primary text-4xl"></i>
                    <span class="text-[9px] text-base-content/40">{item.name}</span>
                  </div>
                {/if}

                <div
                  class="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                ></div>
              </a>
            {/each}
          {/if}
        </div>
      </div>
    </ScrollGuardOverlay>
  </Resizer>
{:else}
  <NodeViewWrapper class="gallery-node p-4 rounded-md"
    ><Resizer
      __width={_maxPageWidth}
      __height={_maxPageHeight * 0.8}
      __direction="both"
      __lockAspectRatio={false}
      __updateAttributes={(newAttrs) => {}}
    >
      <ScrollGuardOverlay message="Click to scroll/browse">
        <GalleryBuilderWidget __src={_src}/>
      </ScrollGuardOverlay>
    </Resizer>
  </NodeViewWrapper>
{/if}

<style>
  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
  }

  :global(.lg-backdrop) {
    background-color: rgba(0, 0, 0, 0.9) !important;
  }
</style>
