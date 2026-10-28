<script lang="ts">
  import { nodeApi } from '../../utils/shims/node'
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import videojs from 'video.js'
  import 'video.js/dist/video-js.css'
  import MissingFilePlaceholder from './MissingFilePlaceholder.svelte'
  import { toLocalPath } from '../../utils/assetUrl'

  let { __src = '', __poster = '', __autoplay = false } = $props()

  let videoElement = $state<HTMLVideoElement | null>(null);
  let player: any = null;
  let _asset = $state<{url: string, mimeType: string} | null>(null);
  let _loadError = $state('')

  const isExternalUrl = (value: string) => /^(blob:|data:|https?:)/i.test(value || '')
  const _path = $derived.by(() => {
    const raw = toLocalPath(__src)
    return (raw || '').split('?')[0]
  })
  let _exists = $state<boolean | 'checking'>('checking')

  $effect(() => {
    const currentPath = _path
    _loadError = ''
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

  // 1. Fetch the Asset URL via your new webNode driver
  $effect(() => {
    if (!_path) return
    if (_exists !== true) return
    if (__src.startsWith('blob:')) {
      _asset = { url: __src, mimeType: '' }
      return
    }

    async function loadVideo() {
      try {
        // This calls your unified invoke with { asResponse: true }
        const result = await nodeApi.fsPromises.readAssetBlob(__src);
        _asset = result;
      } catch (e) {
        console.error("Video Load Error", e);
        _loadError = String((e as any)?.message || e || 'Video load failed')
      }
    }
    loadVideo();

    return () => {
      if (_asset?.url) URL.revokeObjectURL(_asset.url);
    };
  });

  // 2. Initialize / Update Video.js
  $effect(() => {
    // Wait until we have both the DOM element and the Blob URL
    if (videoElement && _asset?.url) {
      if (!player) {
        player = videojs(videoElement, {
          autoplay: __autoplay,
          controls: true,
          fluid: true,
          sources: [{ src: _asset.url, type: _asset.mimeType }]
        });
      } else {
        // Update source if it changes
        player.src({ src: _asset.url, type: _asset.mimeType });
      }
    }
  });

  onDestroy(() => {
    if (player) player.dispose();
  });
</script>

{#if !_path}
  <MissingFilePlaceholder
    __title={$_('No video selected')}
    __subtitle={$_('Pick a video to preview.')}
  />
{:else if _exists === 'checking'}
  <div class="h-48 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] animate-pulse rounded-lg flex items-center justify-center border border-white/5">
    <i class="ph-bold ph-circle-notch animate-spin text-white/20"></i>
  </div>
{:else if _exists === false || _loadError}
  <MissingFilePlaceholder
    __title={$_('Video missing')}
    __subtitle={_loadError || $_('The video file could not be found.')}
    __path={_path}
  />
{:else if !_asset}
  <div class="h-48 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] animate-pulse rounded-lg flex items-center justify-center">
    <i class="ph-bold ph-video-camera text-white/20 text-3xl"></i>
  </div>
{:else}
  <div data-vjs-player>
    <video 
      bind:this={videoElement} 
      class="video-js vjs-default-skin vjs-big-play-centered" 
      playsinline
    ></video>
  </div>
{/if}

<style>
  :global(.video-js) {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  }
</style>
