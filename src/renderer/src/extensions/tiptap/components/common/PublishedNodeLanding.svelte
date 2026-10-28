<script lang="ts">
  import { onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import Utils from '../../../../utils/Utils'
  import { resolveApiBaseUrl } from '../../../../lib/api/shared/baseUrl'
  import {
    mountShareZip,
    shareCacheHas,
    shareCacheListDir,
    shareCacheReadFile,
    shareCacheStat
  } from '../../../../utils/shareCache'
  import { coerceSurveyDoc, defaultSurveyDocV1, type SurveyDocV1 } from '../../CustomSurveyExtension/utils/surveySchema'
  import { nodeLandingRegistry } from '../../../../utils/nodeLandingRegistry'
  import { extractSettingsFromUpdate } from '../../CustomSpreadsheetExtension/collab/collab'

  import EditorCommonUtils from '../../../../utils/common.utils'

  type ShareResolveResult = {
    ok: boolean
    message?: string
    error?: string
    data?: any
    shareId?: string
    docUuid?: string
    name?: string
    docFolder?: string
    path?: string
    role?: string
    canView?: boolean
    canEdit?: boolean
    editLocked?: boolean
    requiresAuth?: boolean
  }

  const typeItems = [
    { type: 'short_text', label: $_('Short answer'), icon: 'ph-light ph-text-t' },
    { type: 'long_text', label: $_('Paragraph'), icon: 'ph-light ph-text-align-left' },
    { type: 'single_choice', label: $_('Multiple choice'), icon: 'ph-light ph-radio-button' },
    { type: 'multiple_choice', label: $_('Checkboxes'), icon: 'ph-light ph-check-square' },
    { type: 'dropdown', label: $_('Dropdown'), icon: 'ph-light ph-caret-circle-down' },
    { type: 'date', label: $_('Date'), icon: 'ph-light ph-calendar' },
    { type: 'file_upload', label: $_('File upload'), icon: 'ph-light ph-upload-simple' },
    { type: 'slider', label: $_('Linear scale'), icon: 'ph-light ph-sliders-horizontal' },
    { type: 'switch', label: $_('Yes / No'), icon: 'ph-light ph-toggle-right' },
    { type: 'section_header', label: $_('Section title'), icon: 'ph-light ph-layout' }
  ] as const

  let loading = $state(true)
  let error = $state('')
  let needsAuth = $state(false)
  let shareInfo = $state<any>(null)
  let sharedNodeId = $state('')
  let shareId = $state('')
  let docUuid = $state('')
  let ownerId = $state('')
  let nodeType = $state('')
  let nodeAttrs = $state<Record<string, any>>({})
  
  // Specific to surveys
  let survey = $state<SurveyDocV1>(defaultSurveyDocV1())

  // Specific to spreadsheets
  let sheetSettings = $state<any>({})

  let mountedRoot = $state('')
  let mountedMainFile = $state('')

  const baseUrl = resolveApiBaseUrl().replace(/\/$/, '')

  function getUrlParams() {
    try {
      const url = new URL(window.location.href)
      return url.searchParams
    } catch {
      return new URLSearchParams(window.location.search)
    }
  }

  function findMainFile(root: string, preferredPath?: string) {
    if (preferredPath) {
      const full = `${root}/${preferredPath}`.replace(/\/{2,}/g, '/')
      if (shareCacheHas(full)) return full
    }
    const preferredMain = `${root}/${Utils.MAIN_DOCUMENT_FILE}`.replace(/\/{2,}/g, '/')
    if (shareCacheHas(preferredMain)) return preferredMain
    const children = shareCacheListDir(root)
    for (const child of children) {
      const full = `${root}/${child}`.replace(/\/{2,}/g, '/')
      const st = shareCacheStat(full)
      if (st?.isFile?.() && child.toLowerCase().endsWith('.html')) return full
      if (st?.isDirectory?.()) {
        const nested = findMainFile(full)
        if (nested) return nested
      }
    }
    return ''
  }

  function resolveNodeInfoFromHtml(html: string, docRoot: string, nodeId: string) {
    if (!html || !nodeId) return null
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      const element = doc.querySelector(
        `[id="${CSS.escape(nodeId)}"], [data-id="${CSS.escape(nodeId)}"]`
      ) as HTMLElement | null
      if (!element) return null

      nodeType = element.tagName.toLowerCase()
      const attrs: Record<string, any> = {}
      for (const attr of Array.from(element.attributes)) {
        attrs[attr.name] = attr.value
      }
      nodeAttrs = attrs

      const raw = element.getAttribute('src') || ''
      if (!raw) return { src: '', type: nodeType, attrs }
      
      const cleaned = raw.replace(/\\/g, '/')
      let resolvedSrc = ''

      if (cleaned.startsWith('share-cache/') && shareCacheHas(cleaned)) resolvedSrc = cleaned
      else if (cleaned.startsWith(`${docRoot}/`) && shareCacheHas(cleaned)) resolvedSrc = cleaned
      else {
        const assetsIdx = cleaned.lastIndexOf('/assets/')
        if (assetsIdx >= 0) {
          const rel = cleaned.slice(assetsIdx + 1).replace(/^\/+/, '')
          const candidate = `${docRoot}/${rel}`.replace(/\/{2,}/g, '/')
          if (shareCacheHas(candidate)) resolvedSrc = candidate
        }
        if (!resolvedSrc && cleaned.startsWith('assets/')) {
          const candidate = `${docRoot}/${cleaned}`.replace(/\/{2,}/g, '/')
          if (shareCacheHas(candidate)) resolvedSrc = candidate
        }
      }
      return { src: resolvedSrc, type: nodeType, attrs }
    } catch {
      return null
    }
  }

  function walkFirstAssetJson(docRoot: string, type: string) {
    const base = `${docRoot}/assets/${type}`.replace(/\/{2,}/g, '/')
    if (!shareCacheHas(base) || !shareCacheStat(base)?.isDirectory?.()) return ''
    const visit = (dir: string): string => {
      const kids = shareCacheListDir(dir)
      for (const kid of kids) {
        const full = `${dir}/${kid}`.replace(/\/{2,}/g, '/')
        const st = shareCacheStat(full)
        if (st?.isDirectory?.()) {
          const found = visit(full)
          if (found) return found
        } else if (st?.isFile?.() && kid.toLowerCase().endsWith('.json')) {
          return full
        }
      }
      return ''
    }
    return visit(base)
  }

  async function loadPublishedNode() {
    loading = true
    error = ''
    needsAuth = false
    
    const params = getUrlParams()
    sharedNodeId = String(params.get('sharedNode') || '').trim()
    const currentLink = window.location.href

    if (!sharedNodeId) {
      error = 'Missing sharedNode in URL.'
      loading = false
      return
    }

    try {
      console.log('[published-node-landing] Public share opening:', {currentLink})
      const publicShare = await EditorCommonUtils.openPublicShareInBrowser(currentLink)
      console.log('[published-node-landing] Public share opened:', {publicShare})
      
      shareInfo = publicShare
      shareId = publicShare.shareId || ''
      docUuid = publicShare.docUuid || ''
      ownerId = publicShare.ownerId || ''
      
      mountedRoot = publicShare.filePath.split('/').slice(0, 2).join('/') // share-cache/ID
      mountedMainFile = publicShare.filePath

      const mainHtml = String(shareCacheReadFile(mountedMainFile, 'utf8') || '')
      const nodeInfo = resolveNodeInfoFromHtml(mainHtml, mountedRoot, sharedNodeId)
      let srcCandidate = nodeInfo?.src || ''
      
      if (!srcCandidate && nodeType) {
        srcCandidate = walkFirstAssetJson(mountedRoot, nodeType)
      }
      
      // Fallback for surveys specifically if nodeType is not yet resolved
      if (!srcCandidate && !nodeType) {
        srcCandidate = walkFirstAssetJson(mountedRoot, 'survey')
        if (srcCandidate) nodeType = 'survey'
      }

      if (srcCandidate && (nodeType === 'survey' || nodeType === 'sheet' || nodeType === 'slide')) {
         const rawData = shareCacheReadFile(srcCandidate)
         if (rawData) {
           try {
             if (nodeType === 'survey') {
               const parsedData = JSON.parse(String(rawData))
               survey = coerceSurveyDoc(parsedData)
               if (!survey?.settings) (survey as any).settings = {}
             } else if (nodeType === 'sheet') {
               const update = rawData instanceof Uint8Array ? rawData : new Uint8Array(Buffer.from(String(rawData), 'binary'))
               sheetSettings = extractSettingsFromUpdate(update)
               
               // Innovative: Check deadline
               if (sheetSettings?.publish?.deadline) {
                 const deadline = new Date(sheetSettings.publish.deadline)
                 if (!isNaN(deadline.getTime()) && deadline < new Date()) {
                   error = $_('This link has expired (Deadline: {deadline})', { values: { deadline: deadline.toLocaleString() } })
                   loading = false
                   return
                 }
               }
             }
           } catch {
             // ignore parse errors
           }
         }
      }
    } catch (e: any) {
      const msg = e?.message || String(e)
      if (msg.toLowerCase().includes('sign in required')) {
        needsAuth = true
      }
      error = msg
    } finally {
      loading = false
    }
  }

  async function handleSignIn() {
    try {
      const auth = (window as any)?.server?.auth
      if (auth?.signIn) {
        await auth.signIn()
        return
      }
      window.location.reload()
    } catch {
      window.location.reload()
    }
  }

  onMount(() => {
    void loadPublishedNode().catch((e) => {
      error = e?.message || String(e)
      loading = false
    })
  })

  const Renderer = $derived(nodeLandingRegistry[nodeType] || null)
</script>

<div class="min-h-screen w-full bg-base-200 text-base-content flex flex-col">
  <header class="px-5 py-4 border-b border-base-300 bg-base-100/80 backdrop-blur">
    <div class="max-w-3xl mx-auto flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="text-[12px] uppercase tracking-[0.16em] text-base-content/50">
          {nodeType === 'survey' ? $_('DynaDoc Survey') : $_('DynaDoc Shared Content')}
        </div>
        <div class="text-[18px] font-800 truncate">
          {survey?.title || shareInfo?.name || $_('Published Content')}
        </div>
      </div>
      <div class="flex items-center gap-2 text-[11px] text-base-content/60">
        {#if shareInfo?.role}
          <span class="px-2 py-1 rounded-md bg-base-200 border border-base-300">
            {shareInfo.role}
          </span>
        {/if}
      </div>
    </div>
  </header>

  <main class="flex-1 px-5 py-6">
    <div class="max-w-3xl mx-auto">
      {#if loading}
        <div class="p-6 bg-base-100 border border-base-300 rounded-xl">
          <div class="text-[12px] text-base-content/60">{$_('Loading content…')}</div>
          <div class="mt-3 h-2 bg-base-200 rounded">
            <div class="h-2 w-1/2 bg-primary rounded animate-pulse"></div>
          </div>
        </div>
      {:else if error}
        <div class="p-6 bg-base-100 border border-base-300 rounded-xl">
          <div class="text-[14px] font-700">{$_('Unable to open content')}</div>
          <div class="mt-2 text-[12px] text-base-content/70 whitespace-pre-wrap">{error}</div>
          {#if needsAuth}
            <button
              class="mt-4 btn btn-primary btn-sm"
              onclick={handleSignIn}
            >
              {$_('Sign in to continue')}
            </button>
          {/if}
        </div>
      {:else if Renderer}
        {#if nodeType === 'survey'}
          <svelte:component 
            this={Renderer}
            survey={survey}
            typeItems={typeItems as any}
            __disabled={false}
            __submissionKey={`${shareId}:${sharedNodeId}`}
            __surveyDrivePath={survey?.publish?.surveyDrivePath || ''}
            __docUuid={docUuid}
            __ownerId={ownerId}
          />
        {:else if nodeType === 'sheet'}
          <svelte:component 
            this={Renderer}
            node={{ attrs: nodeAttrs }}
            isMirror={true}
            __src={nodeAttrs.src}
            __readOnly={sheetSettings?.publish?.role !== 'editor'}
            __shareId={shareId}
            __docUuid={docUuid}
            __name={shareInfo?.name}
          />
        {:else}
          <svelte:component 
            this={Renderer}
            node={{ attrs: nodeAttrs }}
            isMirror={true}
            __src={nodeAttrs.src}
          />
        {/if}
      {:else}
        <div class="p-6 bg-base-100 border border-base-300 rounded-xl">
          <div class="text-[14px] font-700">{$_('Shared Content')}</div>
          <div class="mt-2 text-[12px] text-base-content/70">
            {$_('This content type ({nodeType}) is not yet supported for direct landing. Please open it in the full app.', { values: { nodeType } })}
          </div>
          {#if shareInfo?.link}
            <a href={shareInfo.link} class="mt-4 btn btn-primary btn-sm">
              {$_('Open in App')}
            </a>
          {/if}
        </div>
      {/if}
    </div>
  </main>

  <footer class="px-5 pb-6">
    <div class="max-w-3xl mx-auto text-[10px] text-base-content/40">
      {#if shareId}
        Share: {shareId.slice(0, 8)}…
      {/if}
    </div>
  </footer>
</div>
