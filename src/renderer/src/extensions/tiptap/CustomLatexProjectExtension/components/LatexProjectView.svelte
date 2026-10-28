<script lang="ts">
import { nodeApi } from '../../../../utils/shims/node'
  import { NodeViewWrapper } from 'svelte-tiptap'
  import { _ } from 'svelte-i18n'
  import { onDestroy } from 'svelte'
  import { openLatexProjectModal } from '../../../../stores/latexProjectModal.store'
  import FileRenderer from '../../../fileRenderers/FileRenderer.svelte'

  // export let node: any
  // export let updateAttributes: (attrs: any) => void

  interface Props {
    node?: any
    view?: any
    getPos?: () => number
    updateAttributes?: (attrs: Record<string, any>) => void
  }

  let {
    node, // The Prosemirror node (contains attributes)
    view, // The editor view
    getPos, // Function to get the current position
    updateAttributes // Function to update node attributes
  }: Props = $props()

  // const t = _

  let fileCount = $state(0)
  let status = $state(node?.attrs?.status || 'idle')
  let lastCompiledAt = $state<number | null>(node?.attrs?.lastCompiledAt || null)
  let lastPdfPath = $state<string | null>(node?.attrs?.lastPdfPath || null)
  let projectId = $state(node?.attrs?.projectId || '')
  let projectPath = $state(node?.attrs?.projectPath || '')
  let mainFilePath = $state(node?.attrs?.mainFilePath || '')
  let title = $state(node?.attrs?.title || $_('LaTeX Project'))
  let maxPageHeight = $state(node?.attrs?.maxPageHeight || null)
  let maxPageWidth = $state(node?.attrs?.maxPageWidth || null)
  let wysiwygEditorIdToUpdate = $state(node?.attrs?.wysiwygEditorIdToUpdate || null)
// const  fs = nodeApi.fs
  const pdfAvailable = $derived.by(() => {
    if (!lastPdfPath) return false
    if (!nodeApi.fs?.existsSync) return true
    try {
      return nodeApi.fs.existsSync(lastPdfPath)
    } catch {
      return false
    }
  })

  let unwatch = () => {}

  async function refreshFiles() {
    if (!projectPath) return
    const files = await window.api.latexProjectList(projectPath)
    fileCount = files.filter((f) => !f.isDir).length
  }

  const getStatusColor = (s) => {
    if (s === 'compiling') return '#00A3EE' // Cerulean
    if (s === 'error') return '#FF4F5E' // Adobe Red
    return 'var(--color-base-300)' // Dynadoc Teal
  }

  function openProject() {
    openLatexProjectModal({
      projectId,
      projectDir: projectPath,
      mainFilePath,
      title
    })
  }

  async function compile() {
    if (!projectId || !mainFilePath) return
    status = 'compiling'
    updateAttributes({ status })
    try {
      const pdfPath = await window.api.latexProjectCompile({
        projectId,
        texFilePath: mainFilePath
      })
      status = 'ready'
      lastPdfPath = pdfPath
      lastCompiledAt = Date.now()
      updateAttributes({
        status,
        lastPdfPath,
        lastCompiledAt
      })
    } catch (err) {
      status = 'error'
      updateAttributes({ status })
    }
  }

  function openPdf() {
    if (lastPdfPath) {
      window.api.openFile(lastPdfPath)
    }
  }

  const onProjectChanged = (payload: any) => {
    if (payload?.projectId !== projectId) return
    status = 'dirty'
    updateAttributes({ status })
    refreshFiles()
  }

  const onCompileDone = (payload: any) => {
    if (payload?.projectId !== projectId) return
    status = 'ready'
    lastPdfPath = payload?.pdfPath || lastPdfPath
    lastCompiledAt = Date.now()
    updateAttributes({ status, lastPdfPath, lastCompiledAt })
  }

  const onCompileError = (payload: any) => {
    if (payload?.projectId !== projectId) return
    status = 'error'
    updateAttributes({ status })
  }

  $effect(() => {
    projectId = node?.attrs?.projectId || ''
    projectPath = node?.attrs?.projectPath || ''
    mainFilePath = node?.attrs?.mainFilePath || ''
    title = node?.attrs?.title || $_('LaTeX Project')
    lastPdfPath = node?.attrs?.lastPdfPath || null
    lastCompiledAt = node?.attrs?.lastCompiledAt || null
    status = node?.attrs?.status || 'idle'
    maxPageHeight = node?.attrs?.maxPageHeight || null
    maxPageWidth = node?.attrs?.maxPageWidth || null
    wysiwygEditorIdToUpdate = node?.attrs?.wysiwygEditorIdToUpdate || null
  })

  $effect(() => {
    if (!projectId || !projectPath) return
    refreshFiles()
    window.api.latexProjectWatch({ projectId, projectDir: projectPath })
    const offChanged = window.api.onLatexProjectChanged(onProjectChanged)
    const offDone = window.api.onLatexCompileDone(onCompileDone)
    const offError = window.api.onLatexCompileError(onCompileError)
    return () => {
      window.api.latexProjectUnwatch(projectId)
      offChanged?.()
      offDone?.()
      offError?.()
    }
  })

  onDestroy(() => {
    try {
      window.api.latexProjectUnwatch(projectId)
    } catch {
      // ignore
    }
  })
</script>

<NodeViewWrapper
  class="latex-project-node block w-full my-4 rounded-xl border border-white/10 bg-base-100/60 shadow-lg"
>
  <!-- <div class="p-4 flex items-center justify-between gap-4">
    <div class="flex items-start gap-3">
      <div class="w-10 h-10 rounded-lg bg-[#242424] border border-white/10 flex items-center justify-center">
        <i class="ph-bold ph-function text-[#8bd5ff] text-[16px]"></i>
      </div>
      <div>
        <div class="text-[13px] font-semibold text-base-content/90">{title}</div>
        <div class="text-[10px] uppercase tracking-[0.2em] text-base-300">
          {status === 'compiling'
            ? $_('Compiling')
            : status === 'error'
            ? $_('Compile Error')
            : status === 'dirty'
            ? $_('Uncompiled Changes')
            : $_('Ready')}
        </div>
        <div class="text-[10px] text-base-300 mt-1">
          {fileCount} {$_('files')} •
          {lastCompiledAt ? new Date(lastCompiledAt).toLocaleTimeString() : $_('Never compiled')}
        </div>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button class="btn btn-xs btn-ghost" onclick={openProject}>
        <i class="ph ph-code"></i>
        {$_('Edit')}
      </button>
      <button class="btn btn-xs btn-primary" onclick={compile} disabled={status === 'compiling'}>
        <i class="ph ph-play"></i>
        {$_('Compile')}
      </button>
      <button class="btn btn-xs btn-ghost" onclick={openPdf} disabled={!lastPdfPath}>
        <i class="ph ph-file-pdf"></i>
        {$_('Preview')}
      </button>
    </div>
  </div>
  <div class="px-4 pb-3">
    <div class="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[10px] text-base-content/50">
      {projectPath}
    </div>
  </div> -->
  {#if pdfAvailable}
    <div class="px-4 pb-4" onclick={openProject}>
      <FileRenderer
        __src={lastPdfPath}
        __maxPageHeight={maxPageHeight}
        __maxPageWidth={maxPageWidth}
        __wysiwygEditorIdToUpdate={wysiwygEditorIdToUpdate}
      />
    </div>
  {:else}
    <!-- <div class="px-6 py-8">
      <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-[#141414] via-[var(--color-base-200)] to-[#101010] p-6 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.6)]">
        <div class="flex items-start gap-4">
          <div class="h-12 w-12 rounded-xl bg-[#0f1b22] border border-[#1b2b33] flex items-center justify-center">
            <i class="ph-bold ph-function text-[#7fd4ff] text-[18px]"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[14px] font-semibold text-base-content/90">{title}</div>
            <div class="text-[11px] uppercase tracking-[0.22em] text-base-300 mt-1">
              {status === 'compiling'
                ? $_('Compiling')
                : status === 'error'
                ? $_('Compile Error')
                : status === 'dirty'
                ? $_('Uncompiled Changes')
                : $_('Ready to compile')}
            </div>
            <p class="text-[12px] text-base-content/60 mt-3 leading-relaxed">
              {$_('No PDF preview yet. Compile to generate a preview, or open the project to edit your LaTeX files.')}
            </p>
            <div class="text-[10px] text-base-300 mt-3">
              {fileCount} {$_('files')} •
              {lastCompiledAt ? new Date(lastCompiledAt).toLocaleTimeString() : $_('Never compiled')}
            </div>
          </div>
        </div>
        <div class="mt-5 flex flex-wrap gap-2">
          <button class="btn btn-sm btn-ghost" onclick={openProject}>
            <i class="ph ph-code"></i>
            {$_('Open Project')}
          </button>
          <button class="btn btn-sm btn-primary" onclick={compile} disabled={status === 'compiling'}>
            <i class="ph ph-play"></i>
            {status === 'compiling' ? $_('Compiling') : $_('Compile PDF')}
          </button>
          <button class="btn btn-sm btn-ghost" onclick={openPdf} disabled>
            <i class="ph ph-file-pdf"></i>
            {$_('Preview')}
          </button>
        </div>
      </div>
    </div> -->

    <div class="adobe-blueprint" style="--accent: {getStatusColor(status)}" onclick={openProject}>
      <div class="blueprint-gutter">
        <div class="gutter-icon">
          <i class="ph-bold ph-function"></i>
        </div>
        <div class="gutter-line"></div>
      </div>

      <div class="blueprint-content">
        <header class="blueprint-header">
          <div class="title-stack">
            <span class="eyebrow">{$_('LATEX_WORKSPACE')}</span>
            <span class="filename font-mono">{title}</span>
          </div>

          <div class="status-indicator">
            <span class="status-dot"></span>
            <span class="status-text">{status.toUpperCase()}</span>
          </div>
        </header>

        <p class="instruction">
          {$_(
            'No PDF output detected. Initialize the compilation engine to render your mathematical notations.'
          )}
        </p>

        <footer class="blueprint-footer">
          <div class="stats-group">
            <span class="stat-item">
              <i class="ph-bold ph-files"></i>
              {fileCount} ITEMS
            </span>
            <span class="stat-item">
              <i class="ph-bold ph-clock-counter-clockwise"></i>
              {lastCompiledAt ? new Date(lastCompiledAt).toLocaleTimeString() : 'UNRENDERED'}
            </span>
          </div>

          <div class="action-cluster">
            <button class="adobe-action-btn secondary">
              <i class="ph-bold ph-code"></i>
              <span>{$_('SOURCE')}</span>
            </button>
            <button
              class="adobe-action-btn primary"
              onclick={compile}
              disabled={status === 'compiling'}
            >
              <i
                class="ph-bold {status === 'compiling'
                  ? 'ph-circle-notch animate-spin'
                  : 'ph-play'}"
              ></i>
              <span>{status === 'compiling' ? 'WORKING...' : 'COMPILE'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  {/if}
</NodeViewWrapper>

<style lang="postcss">
  .adobe-blueprint {
    @apply flex gap-4 my-6 p-4 rd-4px border border-dashed border-[var(--color-base-300)];
    /* Subtle mechanical depth */
    /* box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.2); */
  }

  /* --- The Gutter Architecture --- */
  .blueprint-gutter {
    @apply flex flex-col items-center gap-2;
  }
  .gutter-icon {
    @apply size-7 flex items-center justify-center rd-3px bg-black/40 border border-white/10 text-[var(--color-base-300)] text-12px;
  }
  .gutter-line {
    @apply w-[1px] flex-1 bg-gradient-to-b from-white/10 to-transparent;
  }

  .blueprint-content {
    @apply flex-1 min-w-0;
  }

  /* --- Typography --- */
  .blueprint-header {
    @apply flex justify-between items-start mb-3;
  }
  .eyebrow {
    @apply text-[8px] font-900 tracking-[0.2em] text-[var(--color-base-300)] block;
  }
  .filename {
    @apply text-11px text-[var(--color-base-300)] block mt-0.5;
  }

  .status-indicator {
    @apply flex items-center gap-2 px-2 py-0.5 bg-black/40 rd-2px border border-white/5;
  }
  .status-text {
    @apply text-[8px] font-900 tracking-widest text-[var(--color-base-300)];
  }
  .status-dot {
    @apply size-1 rd-full bg-[var(--accent)] shadow-[0_0_5px_var(--accent)];
  }

  .instruction {
    @apply text-12px text-[var(--color-base-content)]/50 leading-relaxed max-w-2xl mb-5;
  }

  /* --- Footer & Actions --- */
  .blueprint-footer {
    @apply flex items-center justify-between pt-3 border-t border-white/5;
  }

  .stats-group {
    @apply flex gap-4;
  }
  .stat-item {
    @apply flex items-center gap-1.5 text-[9px] font-800 text-[var(--color-base-content)]/20 tracking-wider;
  }

  .action-cluster {
    @apply flex items-center gap-2;
  }

  .adobe-action-btn {
    @apply h-7 px-3 rd-2px flex items-center gap-2 text-[9px] font-900 tracking-widest transition-all;
  }

  .adobe-action-btn.primary {
    @apply bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-[var(--color-base-300)] border border-primary/20 hover:(bg-primary text-black border-transparent);
  }

  .adobe-action-btn.secondary {
    @apply text-[var(--color-base-300)] hover:(bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-[var(--color-base-content)]);
  }
</style>
