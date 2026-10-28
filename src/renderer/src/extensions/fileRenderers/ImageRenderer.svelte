<script lang="ts">
  import { nodeApi } from '../../utils/shims/node'
  import { _ } from 'svelte-i18n'
  import DesignStudioMain from '../tiptap/CustomDesignExtension/components/DesignStudioMain.svelte'
  import MissingFilePlaceholder from './MissingFilePlaceholder.svelte'
  import { toLocalPath } from '../../utils/assetUrl'

  interface Props {
    __src?: string | null
    __editable?: boolean
  }

  let { __src = null, __editable = false }: Props = $props()

  // --- Reactive Path Resolution ---
  const _src = $derived(__src || '')
  const _isExternalUrl = $derived(/^(blob:|data:|https?:)/i.test(_src))

  const _path = $derived.by(() => {
    let raw = _src.split('?')[0]
    raw = toLocalPath(raw)
    return raw
  })

  // --- Fixed Protocol for the <img> tag ---
  /* const _displaySrc = $derived.by(() => {
    if (!_src || _isExternalUrl) return _src
    const absolute = nodeApi.path.resolve(_path)
    // CRITICAL: Ensure file:/// (triple slash) for Linux/Rclone paths
    return `file://${absolute.startsWith('/') ? '' : '/'}${absolute}`
  }) */
  // let _displaySrc = $state('')

  // $effect(() => {
  //   if (!_path) return

  //   loadFile()
  //   /* nodeApi.fsPromises.readAssetBlob(_path).then((res) => {
  //     if (res) _displaySrc = res.url
  //   })

  //   // Cleanup to prevent Electron memory bloating
  //   return () => {
  //     if (_displaySrc) URL.revokeObjectURL(_displaySrc)
  //   } */
  // })

  // async function loadFile() {
  //   nodeApi.fsPromises.readAssetBlob(_path).then((res) => {
  //     if (res) _displaySrc = res.url
  //   })

  //   // Cleanup to prevent Electron memory bloating
  //   return () => {
  //     if (_displaySrc) URL.revokeObjectURL(_displaySrc)
  //   }
  // }

  // --- Async State Management ---
  let _exists = $state<boolean | 'checking'>('checking')

  $effect(() => {
    // We must track _path inside the effect for it to re-run
    const currentPath = _path
    if (!currentPath || _isExternalUrl) {
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
</script>

{#if !_path}
  <MissingFilePlaceholder
    __title={$_('No image selected')}
    __subtitle={$_('Pick an image to preview.')}
  />
{:else if _exists === 'checking'}
  <div
    class="image-renderer bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] animate-pulse rounded-lg flex items-center justify-center border border-white/5"
  >
    <i class="ph-bold ph-circle-notch animate-spin text-white/20"></i>
  </div>
{:else if _exists === false}
  <MissingFilePlaceholder
    __title={$_('Image missing')}
    __subtitle={$_('The image file could not be found.')}
    __path={_path}
  />
{:else if __editable}
  <DesignStudioMain __src={_src}></DesignStudioMain>
  <!-- <DesignStudioMain __src={_displaySrc}></DesignStudioMain> -->
{:else}
  <img class="image-renderer" src={_src} alt="" />
  <!-- <img class="image-renderer" src={_displaySrc} alt="" /> -->
{/if}

<style>
  .image-renderer {
    max-width: 100%;
    height: auto;
    display: block;
    min-height: 150px; /* Prevents layout shift during async check */
  }
</style>
