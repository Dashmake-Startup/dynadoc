<script lang="ts">
  import { NodeViewWrapper } from 'svelte-tiptap'
  import { _ } from 'svelte-i18n'
  import { onDestroy } from 'svelte'
  import { debounce } from 'lodash-es'
  import { onVariableChange, getVariable } from '../../CustomVarExtension/stores/variableManipulator'
  import { getVariableDisplayValue } from '../../CustomVarExtension/utils/variableDisplay.utils'
  import EditorHelpers from '../../../../utils/EditorHelpers'
  import { toLocalPath } from '../../../../utils/assetUrl'

  interface Props {
    node: any
    editor: any
    view: any
    getPos: () => number
    updateAttributes: (attrs: Record<string, any>) => void
    selected: boolean
    extension: any
  }

  let { node, getPos, updateAttributes, selected }: Props = $props()

  let isEditing = $state(false)
  let fileStatus = $state<'idle' | 'loading' | 'ready' | 'error'>('idle')
  let fileError = $state('')
  let fileContent = $state('')

  let resolvedCode = $state('')
  let svgContent = $state('')
  let renderError = $state('')
  let isRendering = $state(false)

  let monacoContainer: HTMLDivElement | null = null
  let monacoEditor: any = null
  let monacoRef: any = null

  let mermaidRef: any = null
  let mermaidInit = $state(false)

  let refreshToken = $state(0)
  let variableTick = $state(0)

  const src = $derived.by(() => node?.attrs?.src || null)
  const codeAttr = $derived.by(() => node?.attrs?.code || '')
  const title = $derived.by(() => node?.attrs?.title || $_('Mermaid Diagram'))
  const isFileSource = $derived.by(() => !!src)

  const rawCode = $derived.by(() => {
    if (isFileSource) return fileContent || ''
    return codeAttr || ''
  })

  const normalizedSrc = $derived.by(() => {
    if (!src) return null
    const raw = String(src)
    return toLocalPath(raw)
  })

  function coerceToPlainText(value: any): string {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (typeof value === 'object') {
      if ('rawValue' in value || 'value' in value) {
        return getVariableDisplayValue(value as any, { plainText: true })
      }
      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    }
    return String(value)
  }

  function resolveVariables(input: string): string {
    if (!input || !input.includes('{')) return input || ''
    return input.replace(/\{([^{}]+)\}/g, (match, name) => {
      const key = String(name || '').trim()
      if (!key) return match
      const v = getVariable(key, undefined as any)
      if (v === undefined || v === null) return match
      const out = coerceToPlainText(v)
      return out === '' ? match : out
    })
  }

  async function ensureMermaid() {
    if (mermaidRef) return mermaidRef
    const mod = await import('mermaid')
    const resolved = (mod as any)?.default ?? mod
    mermaidRef = resolved
    return mermaidRef
  }

  async function initMermaidOnce() {
    if (mermaidInit) return
    const mermaid = await ensureMermaid()
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables: {
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
        primaryColor: 'var(--color-base-300)',
        primaryBorderColor: 'rgba(255,255,255,0.14)',
        primaryTextColor: '#EAF6F4',
        secondaryColor: '#101418',
        tertiaryColor: '#0B0F14',
        background: '#0B0F14',
        lineColor: 'rgba(255,255,255,0.28)',
        textColor: 'rgba(255,255,255,0.88)'
      }
    })
    mermaidInit = true
  }

  async function readFile() {
    if (!normalizedSrc) return
    fileStatus = 'loading'
    fileError = ''
    try {
      const content =
        (await (window as any)?.api?.readFileContent?.(normalizedSrc)) ??
        (await (window as any)?.api?.readFile?.(normalizedSrc, 'utf-8'))

      if (typeof content !== 'string') {
        throw new Error('Failed to read Mermaid source file')
      }
      if (content.startsWith('Error reading file:')) {
        throw new Error(content)
      }
      fileContent = content
      fileStatus = 'ready'
    } catch (err: any) {
      fileStatus = 'error'
      fileContent = ''
      fileError = String(err?.message || err || 'Unknown error')
    }
  }

  async function renderSvg() {
    renderError = ''
    svgContent = ''
    isRendering = true
    try {
      await initMermaidOnce()
      const code = (resolvedCode || '').trim()
      if (!code) return

      const renderId = `dynadoc-mermaid-${node?.attrs?.[EditorHelpers.uuidAttributeName] || getPos?.() || 'x'}-${Date.now()}-${Math.random().toString(16).slice(2)}`
      const res = await mermaidRef.render(renderId, code)
      svgContent = res?.svg || ''
    } catch (err: any) {
      renderError = String(err?.message || err || 'Failed to render Mermaid diagram')
    } finally {
      isRendering = false
    }
  }

  const persistCode = debounce((value: string) => {
    updateAttributes({ code: value })
  }, 250)

  async function ensureMonaco() {
    if (monacoRef && monacoEditor) return
    if (!monacoContainer) return
    const mod = await import('monaco-editor')
    monacoRef = mod

    monacoEditor = monacoRef.editor.create(monacoContainer, {
      value: codeAttr || '',
      language: 'markdown',
      theme: 'vs-dark',
      readOnly: false,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      fontSize: 13,
      tabSize: 2,
      scrollbar: { verticalScrollbarSize: 8 }
    })

    monacoEditor.onDidChangeModelContent(() => {
      const next = monacoEditor?.getValue?.() ?? ''
      persistCode(next)
    })
  }

  function destroyMonaco() {
    if (monacoEditor) {
      monacoEditor.dispose()
      monacoEditor = null
    }
  }

  function toggleEditMode() {
    if (isFileSource) return
    isEditing = !isEditing
  }

  async function refreshFromDisk() {
    if (!isFileSource) return
    refreshToken++
    await readFile()
  }

  let unsubscribeVars = () => {}
  unsubscribeVars = onVariableChange(() => {
    variableTick++
  })

  onDestroy(() => {
    try {
      unsubscribeVars?.()
    } catch {
      // ignore
    }
    destroyMonaco()
  })

  $effect(() => {
    if (!isFileSource) {
      fileStatus = 'idle'
      fileError = ''
      fileContent = ''
      return
    }
    void refreshFromDisk()
  })

  $effect(() => {
    if (isFileSource) isEditing = false
  })

  $effect(() => {
    // depend on variableTick + refreshToken, even if codeAttr is unchanged
    variableTick
    refreshToken
    resolvedCode = resolveVariables(rawCode || '')
  })

  $effect(() => {
    if (isEditing) return
    void renderSvg()
  })

  $effect(() => {
    if (!isEditing || isFileSource) {
      destroyMonaco()
      return
    }
    void ensureMonaco()
  })
</script>

<!-- <NodeViewWrapper
  class="node-view-mermaid my-4 block w-full rounded-xl border border-white/10 bg-base-100/60 shadow-lg backdrop-blur"
> -->
<NodeViewWrapper
  class="node-view-mermaid my-4 block w-full"
>
  <div class="mermaid-node-view relative" data-source={isFileSource ? 'file' : 'internal'}>
    {#if selected}
      <!-- <div
        class="mermaid-toolbar absolute right-2 top-2 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-2 py-1 shadow-md backdrop-blur"
      > -->
      <div
        class="mermaid-toolbar absolute right-2 top-2 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-base-100/50 px-2 py-1 shadow-md backdrop-blur"
      >
        {#if !isFileSource}
          <button class="btn btn-xs btn-ghost" onclick={toggleEditMode}>
            <i class={`ph-light ${isEditing ? 'ph-eye' : 'ph-pencil-simple'}`}></i>
            {isEditing ? $_('Preview') : $_('Edit')}
          </button>
        {/if}
        <div
          class="rounded-md border border-white/10 bg-base-300/30 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-base-content/70"
          title={isFileSource ? normalizedSrc || '' : $_('Stored in node attributes')}
        >
          {isFileSource ? $_('File') : $_('Internal')}
        </div>
        {#if isFileSource}
          <button class="btn btn-xs btn-ghost" onclick={refreshFromDisk} disabled={fileStatus === 'loading'}>
            <i class="ph-light ph-arrow-clockwise"></i>
            {$_('Refresh')}
          </button>
        {/if}
      </div>
    {/if}

    <!-- <div class="mermaid-header flex items-start justify-between gap-3 px-4 pt-4">
      <div class="flex items-start gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/30"
        >
          <i class="ph ph-git-branch text-[18px] text-base-300"></i>
        </div>
        <div class="min-w-0">
          <div class="truncate text-[13px] font-semibold text-base-content/90">{title}</div>
          <div class="mt-1 text-[10px] text-base-content/55">
            {#if isFileSource}
              <span class="truncate">{normalizedSrc}</span>
            {:else}
              {$_('Mermaid code stored in document')}
            {/if}
          </div>
        </div>
      </div>
    </div> -->

    <div class="">
    <!-- <div class="px-4 pb-4 pt-3"> -->
      {#if isEditing && !isFileSource}
        <div class="mermaid-editor rounded-lg border border-white/10 bg-black/30">
          <div class="mermaid-editor-header flex items-center justify-between px-3 py-2">
            <div class="text-[10px] uppercase tracking-[0.2em] text-base-content/60">
              {$_('Mermaid Source')}
            </div>
            <div class="text-[10px] text-base-content/45">{$_('Variables like {name} resolve in preview')}</div>
          </div>
          <div class="mermaid-monaco" bind:this={monacoContainer}></div>
        </div>
      {:else}
        <div class="mermaid-preview">
        <!-- <div class="mermaid-preview rounded-lg border border-white/10 bg-black/20 p-3"> -->
          {#if fileStatus === 'loading'}
            <div class="text-[12px] text-base-content/60">{$_('Loading diagram...')}</div>
          {:else if fileStatus === 'error'}
            <div class="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-200">
              <div class="font-semibold">{$_('Could not read file')}</div>
              <div class="mt-1 break-words text-[11px] opacity-80">{fileError}</div>
            </div>
          {:else if renderError}
            <div class="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-200">
              <div class="font-semibold">{$_('Mermaid render error')}</div>
              <div class="mt-1 whitespace-pre-wrap break-words text-[11px] opacity-80">
                {renderError}
              </div>
            </div>
          {:else if isRendering}
            <div class="text-[12px] text-base-content/60">{$_('Rendering...')}</div>
          {:else if svgContent}
            <div class="mermaid-svg"> {@html svgContent}</div>
          {:else}
            <div class="text-[12px] text-base-content/60">{$_('No diagram source')}</div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</NodeViewWrapper>

<style>
  .mermaid-monaco {
    height: 260px;
  }

  :global(.node-view-mermaid .mermaid-svg svg) {
    width: 100%;
    height: auto;
    display: block;
  }

  /* :global(.node-view-mermaid .mermaid-svg .label) {
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial,
      'Apple Color Emoji', 'Segoe UI Emoji' !important;
  } */

  :global(.node-view-mermaid .mermaid-node-view[data-source='internal'] .mermaid-preview) {
    /* box-shadow: 0 0 0 1px rgba(0, 190, 172, 0.04) inset; */
  }

  :global(.node-view-mermaid .mermaid-toolbar .btn) {
    min-height: 22px;
    height: 22px;
    padding-inline: 8px;
    gap: 6px;
  }
</style>
