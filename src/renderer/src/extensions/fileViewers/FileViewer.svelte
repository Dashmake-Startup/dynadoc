
<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { v4 as uuidv4 } from 'uuid'
  import Utils from '../../utils/Utils'
  import PdfViewer from './PdfViewer.svelte'
  import ImageRenderer from '../fileRenderers/ImageRenderer.svelte'
  import VideoRenderer from '../fileRenderers/VideoRenderer.svelte'
  import CodeRenderer from '../fileRenderers/CodeRenderer.svelte'
  import AudioRenderer from '../fileRenderers/Audio/AudioRenderer.svelte'
  import SpreadsheetRenderer from '../fileRenderers/SpreadsheetRenderer.svelte'
  import { isWebmVideoType } from '../fileRenderers/utils/utils'
  import MissingFilePlaceholder from '../fileRenderers/MissingFilePlaceholder.svelte'
  import { nodeApi } from '../../utils/shims/node'
  import Platform from '../../libs/platform'
  import { resolveApiBaseUrl } from '../../lib/api/shared/baseUrl'
  import { shareCacheHas, shareCacheReadFile } from '../../utils/shareCache'
  import { toAssetUrl, toAssetUrlWithVersion, toLocalPath } from '../../utils/assetUrl'


// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

  // let fs = fs
  // let fs = nodeApi.fs
  // let path = path
  // let path = nodeApi.path

  interface Props {
    __src?: string
  }

  let { __src = '' }: Props = $props()
  let reloadToken = $state(0)
  const watchCallerId = `file-viewer-${uuidv4()}`
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

  const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
  const rawPath = $derived.by(() => normalizePath(__src))
  const fileUrl = $derived(
    rawPath && isDesktopPlatform ? toAssetUrl(nodeApi.path.resolve(rawPath)) : ''
  )
  const fileUrlWithToken = $derived(
    rawPath && isDesktopPlatform
      ? toAssetUrlWithVersion(nodeApi.path.resolve(rawPath), reloadToken)
      : ''
  )
  const fileExtension = $derived(rawPath ? nodeApi.path.extname(rawPath).toLowerCase() : '')
  const isAssetPath = $derived.by(() => {
    if (!__src || !nodeApi.path?.sep) return false
    const rawPath = toLocalPath(__src)
    return rawPath.includes(`${nodeApi.path.sep}assets${nodeApi.path.sep}`)
  })
  const isExternalUrl = (value: string) => /^(blob:|data:|https?:)/i.test(value || '')
  const normalizeRemotePath = (value: string) => {
    if (!value) return value
    let normalized = String(value).replace(/^file:\/\//i, '').replace(/\\/g, '/')
    normalized = normalized.replace(/^\/+/, '')
    if (normalized === 'drive') return ''
    if (normalized.startsWith('drive/')) {
      normalized = normalized.slice('drive/'.length)
    }
    if (!normalized) return normalized
    if (normalized.startsWith('home/share-cache/')) {
      return normalized.slice('home/'.length)
    }
    if (normalized.startsWith('share-cache/')) {
      return normalized
    }
    if (
      normalized === 'home' ||
      normalized.startsWith('home/') ||
      normalized.startsWith('shared/')
    ) {
      return normalized
    }
    if (normalized.startsWith('.history/')) {
      return `home/${normalized}`
    }
    return `home/${normalized}`
  }
  const isRemotePath = $derived.by(() => {
    if (isDesktopPlatform) return false
    if (!rawPath) return false
    if (isExternalUrl(rawPath)) return true
    const normalized = normalizeRemotePath(rawPath)
    return (
      normalized.startsWith('home/') ||
      normalized.startsWith('shared/') ||
      normalized.startsWith('share-cache/')
    )
  })
  const isShareCachePath = $derived.by(() => {
    if (!rawPath) return false
    const normalized = normalizeRemotePath(rawPath)
    return normalized.startsWith('share-cache/')
  })
  const isDriveStreamPath = $derived.by(() => {
    if (isDesktopPlatform) return false
    if (!rawPath) return false
    if (isExternalUrl(rawPath)) return false
    const normalized = normalizeRemotePath(rawPath)
    return normalized.startsWith('home/') || normalized.startsWith('shared/')
  })

  let remoteBlobUrl = $state<string>('')
  let remoteLoadError = $state<string | null>(null)
  let remoteLoading = $state(false)
  let fileExists = $state(false)

  const base64ToBytes = (input: string): Uint8Array => {
    const cleaned = input.replace(/^data:[^;]+;base64,/, '')
    const binary = atob(cleaned)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  const toUint8Array = (value: any): Uint8Array | null => {
    if (value == null) return null
    if (value instanceof Uint8Array) return value
    if (value instanceof ArrayBuffer) return new Uint8Array(value)
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer)
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return new Uint8Array()
      const isBase64 = /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed) && trimmed.length % 4 === 0
      try {
        return isBase64 ? base64ToBytes(trimmed) : new TextEncoder().encode(trimmed)
      } catch {
        return null
      }
    }
    if (typeof value === 'object' && typeof value.data === 'string') {
      const encoding = String(value.encoding || '').toLowerCase()
      if (encoding === 'base64') return base64ToBytes(value.data)
      return new TextEncoder().encode(value.data)
    }
    return null
  }

  const mimeFromExtension = (ext: string) => {
    const lower = (ext || '').toLowerCase()
    if (lower === Utils.PDF_EXTENSION) return 'application/pdf'
    if (['.png'].includes(lower)) return 'image/png'
    if (['.jpg', '.jpeg'].includes(lower)) return 'image/jpeg'
    if (['.gif'].includes(lower)) return 'image/gif'
    if (['.webp'].includes(lower)) return 'image/webp'
    if (['.svg'].includes(lower)) return 'image/svg+xml'
    if (['.bmp'].includes(lower)) return 'image/bmp'
    if (['.tif', '.tiff'].includes(lower)) return 'image/tiff'
    if (['.mp4', '.m4v'].includes(lower)) return 'video/mp4'
    if (['.webm'].includes(lower)) return 'video/webm'
    if (['.mov'].includes(lower)) return 'video/quicktime'
    if (['.ogv', '.ogg'].includes(lower)) return 'video/ogg'
    if (['.mp3'].includes(lower)) return 'audio/mpeg'
    if (['.wav'].includes(lower)) return 'audio/wav'
    if (['.m4a'].includes(lower)) return 'audio/mp4'
    if (['.aac'].includes(lower)) return 'audio/aac'
    if (['.flac'].includes(lower)) return 'audio/flac'
    if (['.oga', '.ogg'].includes(lower)) return 'audio/ogg'
    return 'application/octet-stream'
  }

  $effect(() => {
    let cancelled = false
    const currentPath = rawPath
    const currentRemote = isRemotePath
    const currentLoadError = remoteLoadError
    void reloadToken

    void (async () => {
      if (!currentPath) {
        if (!cancelled) fileExists = false
        return
      }
      if (currentRemote) {
        if (!cancelled) fileExists = !currentLoadError
        return
      }
      try {
        const exists = await nodeApi.fsPromises.exists(currentPath)
        if (!cancelled) fileExists = exists
      } catch {
        if (!cancelled) fileExists = false
      }
    })()

    return () => {
      cancelled = true
    }
  })

  // optional: helpers
  // const isPreviewable = Utils.PREVIEWABLE_FILE_EXTENSIONS.includes(documentType)
  // const isPdf = documentType === Utils.PREVIEWABLE_FILE_EXTENSIONS.pdf
  // const isImage = Utils.IMAGE_EXTENSIONS.includes(documentType)
  // const isVideo = Utils.VIDEO_EXTENSIONS?.includes(documentType)
  // const isCode = Utils.CODE_EXTENSIONS?.includes(documentType)

  const isPreviewable = $derived(
    Object.values(Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST).includes(fileExtension)
  )
  const isPdf = $derived(fileExtension === Utils.PREVIEWABLE_FILE_EXTENSIONS.pdf)
  const isImage = $derived(Object.values(Utils.IMAGE_EXTENSIONS).includes(fileExtension))
  const isVideo = $derived(Object.values(Utils.VIDEO_EXTENSIONS).includes(fileExtension))
  const isAudio = $derived(Object.values(Utils.AUDIO_EXTENSIONS).includes(fileExtension))
  const isSpreadsheet = $derived(
    fileExtension === Utils.OFFICE_EXTENSIONS.excel || fileExtension === '.csv' || fileExtension === '.xls'
  )
  const isCode = $derived(
    Object.values(Utils.PROGRAMMING_LANGUAGE_EXTENSIONS_LIST ?? {}).includes(fileExtension)
  )

  const bumpReload = () => {
    reloadToken += 1
  }

  const resolveWatchPath = (value: string) => {
    if (!value) return ''
    return toLocalPath(value)
  }

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
    const resolved = resolveWatchPath(nextPath)
    if (!resolved) return
    if (watchedPath === resolved) return
    unwatchCurrent()
    watchedPath = resolved
    try {
      window.api.watchFile(resolved, watchCallerId)
    } catch {
      // ignore
    }
  }

  onMount(() => {
    const unsubscribe =
      window?.api?.onFileChange?.((_content: string, callerId: string) => {
        if (callerId !== watchCallerId) return
        bumpReload()
      }) ?? null

    return () => {
      unwatchCurrent()
      unsubscribe?.()
    }
  })

  $effect(() => {
    watchPath(rawPath)
  })

  $effect(() => {
    if (!rawPath) return
    if (!fileExists) {
      // Start a lightweight poll so recreated files appear without full app reload.
      try {
        const id = setInterval(() => {
          void nodeApi.fsPromises.exists(rawPath).then((exists) => {
            if (!exists) return
            bumpReload()
            clearInterval(id)
          })
        }, 1000)
        return () => clearInterval(id)
      } catch {
        // ignore
      }
    }
  })

  const needsBinaryBlob = $derived(isPdf || isImage || isVideo || isAudio)
  const resolvedRemotePath = $derived.by(() => (rawPath ? normalizeRemotePath(rawPath) : ''))

  const getAccessToken = () => {
    if (typeof localStorage === 'undefined') return ''
    try {
      return localStorage.getItem('ddoc.access_token') || ''
    } catch {
      return ''
    }
  }

  const driveOpenUrl = $derived.by(() => {
    if (!isDriveStreamPath || !resolvedRemotePath) return ''
    const baseUrl = resolveApiBaseUrl().replace(/\/$/, '')
    const params = new URLSearchParams()
    params.set('path', resolvedRemotePath)
    const token = getAccessToken()
    if (token) params.set('access_token', token)
    return `${baseUrl}/drive/open?${params.toString()}`
  })

  const resolvedBinarySrc = $derived.by(() => {
    if (!rawPath) return ''
    if (isExternalUrl(rawPath)) return rawPath
    if (isDesktopPlatform) return fileUrlWithToken
    if (isDriveStreamPath && driveOpenUrl) return driveOpenUrl
    return remoteBlobUrl
  })

  $effect(() => {
    let cancelled = false
    if (!needsBinaryBlob || !rawPath || isDriveStreamPath) {
      remoteLoading = false
      remoteLoadError = null
      if (remoteBlobUrl) {
        URL.revokeObjectURL(remoteBlobUrl)
        remoteBlobUrl = ''
      }
      return
    }
    if (isDesktopPlatform || isExternalUrl(rawPath)) {
      remoteLoading = false
      remoteLoadError = null
      if (remoteBlobUrl) {
        URL.revokeObjectURL(remoteBlobUrl)
        remoteBlobUrl = ''
      }
      return
    }

    const load = async () => {
      remoteLoading = true
      remoteLoadError = null
      let bytes: Uint8Array | null = null
      try {
        if (resolvedRemotePath.startsWith('share-cache/') && shareCacheHas(resolvedRemotePath)) {
          const data = shareCacheReadFile(resolvedRemotePath, 'binary')
          bytes = toUint8Array(data)
        }
        if (!bytes && window?.api?.readFileContent) {
          const data = await window.api.readFileContent(resolvedRemotePath, 'base64')
          bytes = toUint8Array(data)
        }
        if (!bytes) {
          const data = await nodeApi.fsPromises.readFile(resolvedRemotePath)
          bytes = toUint8Array(data)
        }
        if (!bytes) {
          throw new Error('Preview unavailable')
        }
        const blob = new Blob([bytes], { type: mimeFromExtension(fileExtension) })
        const url = URL.createObjectURL(blob)
        if (!cancelled) {
          if (remoteBlobUrl) URL.revokeObjectURL(remoteBlobUrl)
          remoteBlobUrl = url
        } else {
          URL.revokeObjectURL(url)
        }
      } catch (error) {
        if (!cancelled) {
          remoteLoadError = error instanceof Error ? error.message : 'Preview unavailable'
          if (remoteBlobUrl) {
            URL.revokeObjectURL(remoteBlobUrl)
            remoteBlobUrl = ''
          }
        }
      } finally {
        if (!cancelled) remoteLoading = false
      }
    }

    load()

    return () => {
      cancelled = true
    }
  })
</script>

{#key `${__src}:${reloadToken}`}
  {#if !__src}
    <MissingFilePlaceholder __title={$_('No file selected')} __subtitle={$_('Choose a file to preview.')} />
  {:else if !fileExists}
    <MissingFilePlaceholder __title={$_('File missing')} __subtitle={$_('The file could not be found.')} __path={rawPath} />
  {:else if needsBinaryBlob && !isDesktopPlatform && !isExternalUrl(rawPath) && !remoteBlobUrl && remoteLoading}
    <div class="text-gray-500 p-4">{$_('Loading preview…')}</div>
  {:else if !isPreviewable}
    <div class="text-gray-500 p-4">File not supported: {fileExtension}</div>
  {:else if isPdf}
    <PdfViewer __src={isDesktopPlatform ? rawPath : resolvedBinarySrc} />
    <!-- <PdfViewer src={fileUrl} /> -->
  {:else if isImage}
    <ImageRenderer __src={resolvedBinarySrc} __editable={false} />
  {:else if isVideo}
    <VideoRenderer __src={resolvedBinarySrc} />
  {:else if isAudio}
    <AudioRenderer __src={resolvedBinarySrc} />
  {:else if isSpreadsheet}
    <SpreadsheetRenderer __src={rawPath} __readOnly={false} />
  {:else if isCode}
    <CodeRenderer __src={rawPath} __editable={isAssetPath} />
  {:else}
    <div class="text-gray-500 p-4">Unsupported file type: {fileExtension}</div>
  {/if}
{/key}

<style>
  div {
    font-size: 0.9rem;
  }
</style>
