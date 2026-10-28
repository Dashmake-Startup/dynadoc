<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { _$_latexProjectModal } from '../../../stores/latexProjectModal.store'
  import { openConfirmModal } from '../../../stores/confirmModal.store'
  import TreeView from '../react/treeView/TreeView.svelte'
  import TabList from '../../app/navigation/TabList.svelte'
  // import baseCss from '../../../assets/css/vendor/webtex/base.css'
  // import articleCss from '../../../assets/css/vendor/webtex/article.css?raw'
  // import mathjaxCss from '../../../assets/css/vendor/webtex/mathjax.css?raw'
  import { isOverlayMode } from '../../../utils/overlayBridge'
  import { nodeApi } from '../../../utils/shims/node'

  const modal = $derived(_$_latexProjectModal)
  const overlay = isOverlayMode()
  // const t = _

  let editorContainer: HTMLDivElement | null = $state(null)
  let monacoRef: any = null
  let editor: any = null
  let model: any = null
  let isLoading = $state(false)
  let isCompiling = $state(false)
  let selectedFile = $state<string>('')
  let openTabs = $state<
    {
      id: string
      title: string
      path: string
      isActive: boolean
      isDirty: boolean
      isSaving?: boolean
    }[]
  >([])
  let logs = $state<string[]>([])
  let previewHtml = $state<string>('')
  let previewTimer: number | null = null
  let autoSaveTimer: number | null = null
  let previewWorker: Worker | null = null
  const previewWorkerUrl = new URL('./latex.worker.ts', import.meta.url)
  // Loaded on demand (only as a fallback if the preview worker fails) —
  // webtex is ~12 MB and must not sit on the first-render critical path for
  // plain text documents. This component is mounted eagerly but hidden, so a
  // top-level `import('webtex')` here used to fetch it on every app boot.
  let _webtexPromise: Promise<typeof import('webtex')> | null = null
  const getWebtex = () => (_webtexPromise ??= import('webtex'))
  let autoSaveEnabled = $state(true)
  const autoSaveStorageKey = 'dynadoc.latex.autosave'
  let createFileKey = $state(0)
  let createFolderKey = $state(0)
  //   const nodeApi =
  //     typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
  //   const fs = nodeApi?.fs
  //   const path = nodeApi?.path
  const tabModels = new Map<string, any>()
  const tabDisposers = new Map<string, any>()

  async function loadMonaco() {
    if (monacoRef) return monacoRef
    monacoRef = await import('monaco-editor')
    return monacoRef
  }

  async function ensurePreviewWorker() {
    if (previewWorker) return previewWorker
    previewWorker = new Worker(previewWorkerUrl, { type: 'module' })
    previewWorker.onmessage = (event) => {
      const payload = event?.data
      if (payload?.type === 'preview:ok') {
        const bodyHtml = payload?.html || ''
        previewHtml = bodyHtml
          ? `<div class="webtex-preview">${bodyHtml}</div>`
          : `<div class="text-xs text-base-content/50">${$_('Preview unavailable.')}</div>`
      }
      if (payload?.type === 'preview:error') {
        previewHtml = `<div class="text-xs text-red-300">${payload?.error || 'Preview failed'}</div>`
      }
    }
    return previewWorker
  }

  async function loadFile(filePath: string) {
    if (!filePath || !editorContainer) return
    selectedFile = filePath
    isLoading = true
    const content = tabModels.has(filePath)
      ? (tabModels.get(filePath)?.getValue?.() ?? '')
      : await window.api.latexProjectRead(filePath)
    const monaco = await loadMonaco()
    if (!tabModels.has(filePath)) {
      const newModel = monaco.editor.createModel(content ?? '', 'latex')
      tabModels.set(filePath, newModel)
      const disposable = newModel.onDidChangeContent(() => {
        openTabs = openTabs.map((tab) => (tab.id === filePath ? { ...tab, isDirty: true } : tab))
        // schedulePreviewUpdate()
        scheduleAutoSave()
      })
      tabDisposers.set(filePath, disposable)
      openTabs = [
        ...openTabs.filter((tab) => tab.id !== filePath),
        {
          id: filePath,
          path: filePath,
          title: nodeApi.path.basename(filePath),
          isActive: true,
          isDirty: false,
          isSaving: false
        }
      ]
    }
    openTabs = openTabs.map((tab) => ({
      ...tab,
      isActive: tab.id === filePath
    }))
    model = tabModels.get(filePath)
    if (!editor) {
      editor = monaco.editor.create(editorContainer, {
        model,
        theme: 'vs-dark',
        minimap: { enabled: false },
        fontSize: 13,
        wordWrap: 'on',
        automaticLayout: true
      })
    } else {
      editor.setModel(model)
    }
    // schedulePreviewUpdate()
    isLoading = false
  }

  async function saveFile() {
    if (!selectedFile || !editor) return
    openTabs = openTabs.map((tab) => (tab.id === selectedFile ? { ...tab, isSaving: true } : tab))
    await window.api.latexProjectWrite(selectedFile, editor.getValue())
    openTabs = openTabs.map((tab) =>
      tab.id === selectedFile ? { ...tab, isDirty: false, isSaving: false } : tab
    )
  }

  async function saveAll() {
    if (!openTabs.length) return
    const dirtyIds = new Set(openTabs.filter((tab) => tab.isDirty).map((tab) => tab.id))
    if (dirtyIds.size) {
      openTabs = openTabs.map((tab) => (dirtyIds.has(tab.id) ? { ...tab, isSaving: true } : tab))
    }
    for (const tab of openTabs) {
      if (!tab.isDirty) continue
      const tabModel = tabModels.get(tab.id)
      if (!tabModel) continue
      await window.api.latexProjectWrite(tab.id, tabModel.getValue())
    }
    openTabs = openTabs.map((tab) =>
      dirtyIds.has(tab.id) ? { ...tab, isDirty: false, isSaving: false } : tab
    )
  }

  let idleCallbackHandle: number | null = null

  async function schedulePreviewUpdate() {
    if (!model) return

    if (idleCallbackHandle) {
      window.cancelIdleCallback(idleCallbackHandle)
    }

    idleCallbackHandle = window.requestIdleCallback(
      async () => {
        const content = model?.getValue?.() || ''
        try {
          const worker = await ensurePreviewWorker()
          worker.postMessage({ content })
        } catch (err) {
          try {
            const mod = await getWebtex()
            const HtmlGenerator = mod?.HtmlGenerator
            const parse = mod?.parse
            if (typeof HtmlGenerator === 'function' && typeof parse === 'function') {
              const generator = new HtmlGenerator({ hyphenate: false })
              const doc = parse(content, { generator }).htmlDocument()
              const bodyHtml = doc?.body?.innerHTML || ''
              previewHtml = bodyHtml
                ? `<div class="webtex-preview">${bodyHtml}</div>`
                : `<div class="text-xs text-base-content/50">${$_('Preview unavailable.')}</div>`
            } else {
              previewHtml = `<div class="text-xs text-base-content/50">${$_('Preview unavailable.')}</div>`
            }
          } catch (innerErr) {
            previewHtml = `<div class="text-xs text-red-300">${String(innerErr || err)}</div>`
          }
        }
      },
      { timeout: 1000 }
    )
  }

  function scheduleAutoSave() {
    if (!autoSaveEnabled || !selectedFile || !editor) return
    if (autoSaveTimer) window.clearTimeout(autoSaveTimer)
    autoSaveTimer = window.setTimeout(async () => {
      const currentTab = openTabs.find((tab) => tab.id === selectedFile)
      if (!currentTab?.isDirty) return
      await saveFile()
    }, 1200)
  }

  async function closeTab(tabId: string) {
    const tab = openTabs.find((t) => t.id === tabId)
    if (!tab) return
    if (tab.isDirty) {
      const ok = await openConfirmModal({
        title: $_('Unsaved changes'),
        message: $_('Close without saving?')
      })
      if (!ok) return
    }
    tabDisposers.get(tabId)?.dispose?.()
    tabDisposers.delete(tabId)
    tabModels.get(tabId)?.dispose?.()
    tabModels.delete(tabId)
    openTabs = openTabs.filter((t) => t.id !== tabId)
    if (selectedFile === tabId) {
      const next = openTabs[openTabs.length - 1]
      selectedFile = next?.id || ''
      if (selectedFile) loadFile(selectedFile)
    }
  }

  async function compileProject() {
    if (!$modal.mainFilePath) return
    isCompiling = true
    logs = []
    await saveAll()
    try {
      await window.api.latexProjectCompile({
        projectId: $modal.projectId,
        texFilePath: $modal.mainFilePath
      })
    } catch (err) {
      logs = [...logs, String(err)]
    } finally {
      isCompiling = false
    }
  }

  const onCompileLog = (payload: any) => {
    if (payload?.projectId !== $modal.projectId) return
    const line = payload?.message?.toString?.() || ''
    if (!line.trim()) return
    logs = [...logs, line.trim()]
  }

  $effect(() => {
    if (!$modal.open) return
    loadFile($modal.mainFilePath)
    const offLog = window.api.onLatexCompileLog(onCompileLog)
    return () => {
      offLog?.()
    }
  })

  function requestNewFile() {
    createFileKey = Date.now()
  }

  function requestNewFolder() {
    createFolderKey = Date.now()
  }

  const selectedDir = $derived.by(() => {
    if (!selectedFile) return $modal.projectDir
    return nodeApi.path.dirname(selectedFile)
  })

  $effect(() => {
    if ($modal.open) return
    if (editor) editor.dispose()
    if (model) model.dispose()
    editor = null
    model = null
    monacoRef = null
    tabDisposers.forEach((disposer) => disposer?.dispose?.())
    tabDisposers.clear()
    tabModels.forEach((tabModel) => tabModel?.dispose?.())
    tabModels.clear()
    openTabs = []
    logs = []
    previewHtml = ''
    selectedFile = ''
  })

  $effect(() => {
    if (!$modal.open) return
    const mainFile = $modal.mainFilePath
    if (!selectedFile && mainFile) {
      loadFile(mainFile)
    }
  })

  $effect(() => {
    try {
      window.localStorage?.setItem(autoSaveStorageKey, String(autoSaveEnabled))
    } catch {
      // ignore
    }
  })

  async function close() {
    const hasDirty = openTabs.some((tab) => tab.isDirty)
    if (hasDirty) {
      await saveAll()
      try {
        await compileProject()
      } catch {
        // compile errors are shown in logs
      }
    }
    _$_latexProjectModal.close()
  }

  onMount(() => {
    console.log('[LatexProjectModal] mounted')
    try {
      const saved = window.localStorage?.getItem(autoSaveStorageKey)
      if (saved !== null) autoSaveEnabled = saved === 'true'
    } catch {
      // ignore
    }
    ensurePreviewWorker()
  })

  onDestroy(() => {
    if (previewTimer) window.clearTimeout(previewTimer)
    if (autoSaveTimer) window.clearTimeout(autoSaveTimer)
    if (idleCallbackHandle) window.cancelIdleCallback(idleCallbackHandle)
    previewWorker?.terminate()
    previewWorker = null
    if (editor) editor.dispose()
    if (model) model.dispose()
    editor = null
    model = null
    monacoRef = null
  })
</script>

{#if $modal.open}
  <div
    class="modal-shell fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center"
  >
    <div
      class="bg-base-100 modal-card w-[1100px] max-w-[95vw] h-[80vh] bg-base-100 text-base-content rounded-xl border border-white/10 shadow-2xl flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={$_('LaTeX Project')}
    >
      <header class="px-5 py-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <div class="text-[13px] uppercase tracking-[0.2em] text-base-content/40">
            {$_('LaTeX Project')}
          </div>
          <div class="text-[16px] font-semibold text-base-content/90">
            {$modal.title || $_('Project')}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <label
            class="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]"
            class:text-base-300={autoSaveEnabled}
            class:text-base-content={!autoSaveEnabled}
          >
            <input
              type="checkbox"
              class="toggle toggle-xs"
              bind:checked={autoSaveEnabled}
              class:text-base-300={autoSaveEnabled}
              class:text-base-content={!autoSaveEnabled}
            />
            <span>{$_('Autosave')}</span>
          </label>
          <button class="btn btn-xs btn-ghost" on:click={requestNewFile}>
            <i class="ph-light ph-file-plus"></i>
            {$_('New File')}
          </button>
          <button class="btn btn-xs btn-ghost" on:click={requestNewFolder}>
            <i class="ph-light ph-folder-plus"></i>
            {$_('New Folder')}
          </button>
          <button class="btn btn-xs btn-ghost" on:click={saveFile}>
            <i class="ph-light ph-floppy-disk"></i>
            {$_('Save')}
          </button>
          <button class="btn btn-xs btn-ghost" on:click={saveAll}>
            <i class="ph-light ph-floppy-disk-back"></i>
            {$_('Save All')}
          </button>
          <button class="btn btn-xs btn-primary" disabled={isCompiling} on:click={compileProject}>
            <i class="ph-light ph-play"></i>
            {isCompiling ? $_('Compiling') : $_('Compile')}
          </button>
          <button class="btn btn-xs btn-ghost" on:click={close}>
            <i class="ph-light ph-x"></i>
          </button>
        </div>
      </header>

      <div class="flex-1 grid grid-cols-[260px_1fr_280px] gap-0 overflow-hidden">
        <aside class="border-r border-white/10 p-3 overflow-auto">
          <div class="text-[10px] uppercase tracking-widest text-base-content/40 mb-2">
            {$_('Files')}
          </div>
          <TreeView
            __rootPath={$modal.projectDir}
            __rootParentPath={$modal.projectDir}
            __openOnSelect={false}
            __onSelect={(item) => {
              if (!item?.isFolder) {
                loadFile(item.path)
              }
            }}
            __capabilities={{
              canCreate: true,
              canRename: true,
              canCopyCutPaste: true,
              canDuplicate: true,
              canDelete: true,
              canDragDrop: true,
              canOpenInTerminal: false,
              canRevealInOS: true,
              canVersioning: false,
              canSecurity: false,
              canTranslation: false,
              canVariables: false
            }}
            __requestCreateFileKey={createFileKey}
            __requestCreateFileParentPath={selectedDir}
            __requestCreateFolderKey={createFolderKey}
            __requestCreateFolderParentPath={selectedDir}
            __defaultNewFileName="main"
            __defaultFileExtension=".tex"
            __defaultFileContent="% New LaTeX file\n"
            __enforceDocumentExtension={false}
            __excludeExtensions={['.aux', '.log', '.out', '.synctex.gz']}
            __contextMenuMode="latex"
          />
        </aside>
        <section class="relative">
          <div class="absolute inset-0 flex flex-col">
            <TabList
              __mode="lite"
              __elements={openTabs.map((tab) => ({
                ...tab,
                isActive: tab.id === selectedFile
              }))}
              __onSelect={(id) => loadFile(id)}
              __onClose={(id) => closeTab(id)}
            />
            <div class="flex-1 relative">
              <div class="absolute inset-0" bind:this={editorContainer}></div>
            </div>
          </div>
          {#if isLoading}
            <div
              class="absolute inset-0 flex items-center justify-center text-base-content/50 text-sm"
            >
              {$_('Loading file...')}
            </div>
          {/if}
        </section>
        <aside class="border-l border-white/10 p-3 overflow-auto flex flex-col gap-4">
          <div>
            <div class="text-[10px] uppercase tracking-widest text-base-content/40 mb-2">
              {$_('Live Math Preview')}
            </div>
            <div
              class="max-h-[50px] max-w-[50px] text-[12px] text-base-content/70 bg-black/20 border border-white/10 rounded-md p-3 min-h-[120px]"
            >
              {@html previewHtml}
            </div>
          </div>
          <div>
            <div class="text-[10px] uppercase tracking-widest text-base-content/40 mb-2">
              {$_('Build log')}
            </div>
            {#if logs.length === 0}
              <div class="text-[11px] text-base-content/40">
                {$_('No compilation output yet.')}
              </div>
            {:else}
              <div class="space-y-2 text-[11px] text-base-content/60 font-mono">
                {#each logs as line, idx (idx)}
                  <div>{line}</div>
                {/each}
              </div>
            {/if}
          </div>
        </aside>
      </div>

      <footer class="px-5 py-3 border-t border-white/10 text-[10px] text-base-content/40">
        {$_(
          'Tip: keep this modal open while editing, and compile on demand to avoid file-lock conflicts.'
        )}
      </footer>
    </div>
  </div>
{/if}
