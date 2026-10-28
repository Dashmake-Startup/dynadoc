
<script lang="ts">
  
// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import MissingFilePlaceholder from './MissingFilePlaceholder.svelte'

  // import 'ag-psd/initialize-canvas' // only needed for reading image data and thumbnails
  import { readPsd } from 'ag-psd'
import { nodeApi } from '../../utils/shims/node'
import { toLocalPath } from '../../utils/assetUrl'

  interface Props {
    __src?: string
  }

  let { __src = '' }: Props = $props()
  let container: HTMLDivElement

  const isExternalUrl = (value: string) => /^(blob:|data:|https?:)/i.test(value || '')
  const _path = $derived.by(() => {
    const raw = toLocalPath(__src)
    return (raw || '').split('?')[0]
  })

  let _exists = $state<boolean | 'checking'>('checking')
  let _loaded = $state(false)

  $effect(() => {
    _loaded = false
    if (container) container.innerHTML = ''
  })

  $effect(() => {
    const currentPath = _path
    if (!currentPath) {
      _exists = false
      return
    }
    if (isExternalUrl(currentPath)) {
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

  $effect(() => {
    if (_loaded) return
    if (!container) return
    if (_exists !== true) return
    if (!_path) return
    if (!nodeApi.fsPromises?.readFile) return
    // The read is awaited inside its own function, and the effect only kicks it
    // off with `void` -- the same shape as the checkFile effect above.
    //
    // This matters more than it looks. An `$effect` callback must return either
    // nothing or a cleanup function; making this one `async` would hand Svelte a
    // promise where it expects a teardown. And a rejection escaping an effect
    // takes the component down rather than failing the read, so the catch has to
    // live inside the async function, not around the `void` call. The failure
    // path is unchanged: log, and mark the file as unreadable so the placeholder
    // is shown.
    const load = async (): Promise<void> => {
      try {
        const buffer = await nodeApi.fsPromises.readFile(_path)
        const psd = readPsd(buffer)
        container.appendChild(psd.canvas)
        _loaded = true
      } catch (e) {
        console.error('PSD load error:', e)
        _exists = false
      }
    }
    void load()
  })
</script>

{#if !_path}
  <MissingFilePlaceholder __title={$_('PSD missing')} __subtitle={$_('The PSD file could not be found.')} __path={__src} />
{:else if _exists === 'checking'}
  <div class="h-48 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] animate-pulse rounded-lg flex items-center justify-center border border-white/5">
    <i class="ph-bold ph-circle-notch animate-spin text-white/20"></i>
  </div>
{:else if _exists === false}
  <MissingFilePlaceholder __title={$_('PSD missing')} __subtitle={$_('The PSD file could not be found.')} __path={_path} />
{:else}
  <div class="w-full my-4 canvas-container">
    <div bind:this={container}></div>
  </div>
{/if}

<style>
  :global(pdf) {
    display: flex;
    flex-direction: column;
    max-height: fit-content;
    width: 100%;
  }
  .canvas-container {
    max-height: 2524px;
    overflow: auto; /* allow scrolling if overflow */
    display: flex;
    flex-direction: column;
  }
</style>
