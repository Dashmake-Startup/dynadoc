<!--
 Copyright (C) 2024 Dashmake Inc.

 This file is part of DDoc Office.

 DDoc Office is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 DDoc Office is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
-->
<!-- ExplorerWidget.svelte -->
<script lang="ts">
  import { _, isLoading } from 'svelte-i18n'
  import { get } from 'svelte/store'
  import Utils from '../../../../../utils/Utils'
  import { openAlertModal } from '../../../../../stores/alertModal.store'
  import { openConfirmModal } from '../../../../../stores/confirmModal.store'
  import {
    convertDocxToHtml,
    toCompleteHTML,
    writeFileEnsuringDir
  } from '../../../../../utils/documentFileUtils'
  import { convertPptxToSlidesHtml } from '../../../../../extensions/tiptap/CustomSlideExtension/utils/pptxImport'
  import { DocumentModel } from '../../../../../models/Document'
  import TreeView from '../../../../common/react/treeView/TreeView.svelte'
import { nodeApi } from '../../../../../utils/shims/node'

  type FileNode = {
    name: string
    path: string
    isFolder: boolean
  }

  // export let __rootPath: string
  // export let __rootParentPath: string

  const { __rootPath, __rootParentPath } = $props<{
    __rootPath: string
    __rootParentPath: string
  }>()

  const t = get(_)
//   const nodeApi =
//     typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
//   const fs = nodeApi?.fs
//   const path = nodeApi?.path
  const convertibleExtensions = new Set(Utils.CONVERTIBLE_EXTENSIONS)
  const textLikeExtensions = new Set(Utils.CONVERTIBLE_TEXT_LIKE_EXTENSIONS)
  const htmlLikeExtensions = new Set(Utils.CONVERTIBLE_HTML_LIKE_EXTENSIONS)

  let selectedItems = $state<FileNode[]>([])
  let conversionProgress = $state<{
    active: boolean
    total: number
    done: number
    current: string
    errors: string[]
  }>({
    active: false,
    total: 0,
    done: 0,
    current: '',
    errors: []
  })
  let conversionQueue = $state<
    Array<{
      id: string
      path: string
      status: 'pending' | 'running' | 'done' | 'failed'
      outputPath?: string
      error?: string
      startedAt?: number
      finishedAt?: number
      durationMs?: number
    }>
  >([])
  let queueRunning = $state(false)
  let queuePaused = $state(false)
  let lastSummary = $state<{ success: string[]; failed: string[] } | null>(null)
  let showSummary = $state(false)
  let showQueueManager = $state(false)

  function handleSelectionChange(items: FileNode[]) {
    selectedItems = items || []
  }

  function isConvertibleFile(filePath: string) {
    const ext = nodeApi.path.extname(filePath).toLowerCase()
    return convertibleExtensions.has(ext)
  }

  async function ensureUniqueOutputPath(outputBase: string) {
    const ext = Utils.DYNADOC_EXTENSIONS.default
    let candidate = `${outputBase}${ext}`
    if (!(await nodeApi.fsPromises?.exists(candidate))) return outputBase
    let index = 1
    while (index < 1000) {
      const nextBase = `${outputBase} (${index})`
      candidate = `${nextBase}${ext}`
      if (!(await nodeApi.fsPromises?.exists(candidate))) return nextBase
      index += 1
    }
    return outputBase
  }

  async function convertOfficeFileToDdoc(sourcePath: string) {
    const ext = nodeApi.path.extname(sourcePath).toLowerCase()
    const baseName = nodeApi.path.basename(sourcePath, nodeApi.path.extname(sourcePath))
    const outputDir = nodeApi.path.dirname(sourcePath)
    const outputBase = await ensureUniqueOutputPath(nodeApi.path.join(outputDir, baseName))

    const cacheRoot = await window.api.getCacheDir()
    const scratchDir = nodeApi.path.join(cacheRoot, 'imports', `${baseName}-${Date.now().toString(36)}`)
    await nodeApi.fsPromises?.mkdir(scratchDir, { recursive: true })

    let htmlPath = ''
    try {
      if (ext === Utils.OFFICE_EXTENSIONS.powerpoint) {
        const mainFilePath = nodeApi.path.join(scratchDir, baseName)
        htmlPath = await convertPptxToSlidesHtml(
          sourcePath,
          scratchDir,
          mainFilePath,
          DocumentModel.getAssetFilePathFromDocument,
          DocumentModel.AssetType.SLIDE
        )
      } else if (
        ext === Utils.OFFICE_EXTENSIONS.word ||
        ext === Utils.OFFICE_EXTENSIONS.excel ||
        ext === '.xls'
      ) {
        htmlPath = await convertDocxToHtml(sourcePath, scratchDir)
      } else if (htmlLikeExtensions.has(ext) || textLikeExtensions.has(ext)) {
        const raw = await nodeApi.fsPromises?.readFile(sourcePath, 'utf-8')
        const body = htmlLikeExtensions.has(ext)
          ? raw
          : `<pre>${raw.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch] || ch)}</pre>`
        const fullHtml = toCompleteHTML(body, {
          title: baseName,
          lang: 'en'
        })
        htmlPath = nodeApi.path.join(scratchDir, `${baseName}.html`)
        await writeFileEnsuringDirAsync(htmlPath, fullHtml, 'utf-8')
      }

      if (!htmlPath) {
        throw new Error(t('Conversion failed'))
      }

      const packSource = nodeApi.path.dirname(htmlPath)
      const ddocPath = await window.api.ddocify(packSource, outputBase)
      return ddocPath
    } finally {
      try {
        await nodeApi.fsPromises?.rm(scratchDir, { recursive: true, force: true })
      } catch {
        // ignore cleanup errors
      }
    }
  }

  function collectConvertibleFilesInDir(root: string, limit = 200): string[] {
    const results: string[] = []
    const stack = [root]
    while (stack.length) {
      const dir = stack.pop()
      if (!dir) continue
      let entries: any[] = []
      try {
        entries = nodeApi.fs.readdirSync(dir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        const fullPath = nodeApi.path.join(dir, entry.name)
        if (entry.isDirectory()) {
          stack.push(fullPath)
          continue
        }
        if (isConvertibleFile(fullPath)) {
          results.push(fullPath)
          if (results.length >= limit) return results
        }
      }
    }
    return results
  }

  function collectConvertibleFilesFromSelection(items: FileNode[], limit = 200) {
    const results = new Set<string>()
    for (const item of items) {
      if (item.isFolder) {
        collectConvertibleFilesInDir(item.path, limit).forEach((file) => results.add(file))
      } else if (isConvertibleFile(item.path)) {
        results.add(item.path)
      }
      if (results.size >= limit) break
    }
    return Array.from(results)
  }

  function syncProgressFromQueue() {
    const total = conversionQueue.length
    const done = conversionQueue.filter((entry) => entry.status === 'done').length
    const current = conversionQueue.find((entry) => entry.status === 'running')?.path || ''
    const errors = conversionQueue.filter((entry) => entry.status === 'failed').map((e) => e.path)
    conversionProgress = {
      active: queueRunning,
      total,
      done,
      current,
      errors
    }
  }

  function formatDuration(ms?: number) {
    if (!ms && ms !== 0) return '—'
    if (ms < 1000) return `${ms}ms`
    const seconds = ms / 1000
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    const minutes = Math.floor(seconds / 60)
    const rem = Math.round(seconds % 60)
    return `${minutes}m ${rem}s`
  }

  const analytics = $derived.by(() => {
    const completed = conversionQueue.filter((entry) => entry.durationMs && entry.status === 'done')
    const totalTime = completed.reduce((sum, entry) => sum + (entry.durationMs || 0), 0)
    const avg = completed.length ? totalTime / completed.length : 0
    const filesPerMinute = avg ? Math.round((60_000 / avg) * 10) / 10 : 0
    return {
      completed: completed.length,
      totalTime,
      avg,
      filesPerMinute
    }
  })

  async function processQueue() {
    if (queueRunning) return
    queueRunning = true
    syncProgressFromQueue()

    while (true) {
      const next = conversionQueue.find((entry) => entry.status === 'pending')
      if (!next) break
      if (queuePaused) {
        await new Promise((resolve) => setTimeout(resolve, 250))
        continue
      }
      next.status = 'running'
      next.startedAt = Date.now()
      syncProgressFromQueue()
      try {
        const output = await convertOfficeFileToDdoc(next.path)
        next.status = 'done'
        next.outputPath = output
      } catch (error: any) {
        next.status = 'failed'
        next.error = error?.message || 'failed'
      } finally {
        next.finishedAt = Date.now()
        if (next.startedAt) {
          next.durationMs = next.finishedAt - next.startedAt
        }
      }
      syncProgressFromQueue()
    }

    queueRunning = false
    syncProgressFromQueue()

    const success = conversionQueue.filter((entry) => entry.status === 'done').map((e) => e.path)
    const failed = conversionQueue.filter((entry) => entry.status === 'failed').map((e) => e.path)
    if (success.length || failed.length) {
      lastSummary = { success, failed }
      showSummary = true
    }
    if (failed.length > 0) {
      await openAlertModal({
        title: t('Convert to Dynadoc'),
        message: t('Some files could not be converted.')
      })
    }
  }

  async function enqueueConversion(filePaths: string[], confirmMessage: string) {
    if (!filePaths.length) {
      await openAlertModal({
        title: t('Convert to Dynadoc'),
        message: t('No supported files selected.')
      })
      return
    }
    let shouldProceed = true
    if (filePaths.length > 10) {
      shouldProceed = await openConfirmModal({
        title: t('Convert to Dynadoc'),
        message: t('Convert selected files to Dynadoc?')
      })
    } else if (confirmMessage) {
      shouldProceed = await openConfirmModal({
        title: t('Convert to Dynadoc'),
        message: confirmMessage
      })
    }
    if (!shouldProceed) return

    const existing = new Set(conversionQueue.map((entry) => entry.path))
    const additions = filePaths
      .filter((path) => !existing.has(path))
      .map((filePath) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        path: filePath,
        status: 'pending' as const
      }))
    conversionQueue = [...conversionQueue, ...additions]
    syncProgressFromQueue()
    void processQueue()
  }

  function pauseQueue() {
    queuePaused = true
  }

  function resumeQueue() {
    queuePaused = false
    void processQueue()
  }

  function clearQueue() {
    conversionQueue = []
    syncProgressFromQueue()
  }

  function clearCompleted() {
    conversionQueue = conversionQueue.filter((entry) => entry.status !== 'done')
    syncProgressFromQueue()
  }

  function retryItem(pathValue: string) {
    const target = conversionQueue.find((entry) => entry.path === pathValue)
    if (target) {
      target.status = 'pending'
      target.error = undefined
      target.outputPath = undefined
      target.startedAt = undefined
      target.finishedAt = undefined
      target.durationMs = undefined
    } else {
      conversionQueue = [
        ...conversionQueue,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          path: pathValue,
          status: 'pending'
        }
      ]
    }
    syncProgressFromQueue()
    void processQueue()
  }

  function retryFailed() {
    const failed = conversionQueue.filter((entry) => entry.status === 'failed')
    failed.forEach((entry) => retryItem(entry.path))
  }

  function moveQueueItem(pathValue: string, direction: 'up' | 'down') {
    const index = conversionQueue.findIndex((entry) => entry.path === pathValue)
    if (index === -1) return
    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= conversionQueue.length) return
    const copy = [...conversionQueue]
    const [item] = copy.splice(index, 1)
    copy.splice(nextIndex, 0, item)
    conversionQueue = copy
    syncProgressFromQueue()
  }

  function removeQueueItem(pathValue: string) {
    conversionQueue = conversionQueue.filter((entry) => entry.path !== pathValue)
    syncProgressFromQueue()
  }

  async function convertSelection() {
    const targets = collectConvertibleFilesFromSelection(selectedItems)
    await enqueueConversion(targets, t('Convert selected files to Dynadoc?'))
  }

  async function convertFolder() {
    if (!__rootPath) return
    const targets = collectConvertibleFilesInDir(__rootPath)
    if (!targets.length) {
      await openAlertModal({
        title: t('Convert to Dynadoc'),
        message: t('No supported files found in this folder.')
      })
      return
    }
    await enqueueConversion(targets, t('Convert all supported files in this folder to Dynadoc?'))
  }

  function buildContextMenuActions(ctx: {
    item: FileNode
    selection: FileNode[]
    selectionCount: number
  }) {
    const { item, selection, selectionCount } = ctx
    const actions = []
    const selectable = selectionCount > 0 ? selection : [item]
    const selectedConvertible = collectConvertibleFilesFromSelection(selectable)
    if (selectedConvertible.length > 0) {
      actions.push({
        icon: 'ph-bold ph-arrows-clockwise',
        label: t('Convert selection to Dynadoc'),
        group: 0,
        action: async () =>
          enqueueConversion(selectedConvertible, t('Convert selected files to Dynadoc?'))
      })
    }
    if (item.isFolder && item.path) {
      actions.push({
        icon: 'ph-bold ph-stack',
        label: t('Convert folder to Dynadoc'),
        group: 0,
        action: async () =>
          enqueueConversion(
            collectConvertibleFilesInDir(item.path),
            t('Convert all supported files in this folder to Dynadoc?')
          )
      })
    }
    if (conversionQueue.length > 0) {
      actions.push({
        icon: queuePaused ? 'ph-bold ph-play' : 'ph-bold ph-pause',
        label: queuePaused ? t('Resume queue') : t('Pause queue'),
        group: 1,
        action: () => (queuePaused ? resumeQueue() : pauseQueue())
      })
      actions.push({
        icon: 'ph-bold ph-broom',
        label: t('Clear conversion queue'),
        group: 1,
        action: () => clearQueue()
      })
    }
    if (lastSummary) {
      actions.push({
        icon: 'ph-bold ph-list-bullets',
        label: t('Show conversion summary'),
        group: 1,
        action: () => (showSummary = true)
      })
    }
    actions.push({
      icon: 'ph-bold ph-queue',
      label: t('Queue manager'),
      group: 1,
      action: () => (showQueueManager = true)
    })
    return actions
  }
</script>

<div class="">
  <div
    heading={$_('Disk Explorer')}
    description={__rootPath}
    class="collapsible complex-example"
    open
  >
    {#if conversionProgress.active}
      <div class="conversion-progress">
        <div class="progress-meta">
          <span class="label">{$_('Converting')}</span>
          <span class="count">{conversionProgress.done + 1} / {conversionProgress.total}</span>
        </div>
        <progress
          class="progress progress-primary w-full h-[6px]"
          value={conversionProgress.done}
          max={conversionProgress.total}
        ></progress>
        <div class="current-file">{conversionProgress.current}</div>
      </div>
    {/if}
    {#if showQueueManager}
      <div class="queue-manager">
        <div class="queue-header">
          <span class="title">{$_('Queue manager')}</span>
          <div class="queue-actions">
            <button
              class="btn btn-xs btn-ghost"
              on:click={() => (queuePaused ? resumeQueue() : pauseQueue())}
            >
              {queuePaused ? $_('Resume queue') : $_('Pause queue')}
            </button>
            <button class="btn btn-xs btn-ghost" on:click={clearCompleted}>
              {$_('Clear completed')}
            </button>
            <button class="btn btn-xs btn-ghost" on:click={() => (showQueueManager = false)}>
              {$_('Hide')}
            </button>
          </div>
        </div>
        <div class="queue-analytics">
          <div>
            <div class="label">{$_('Completed')}</div>
            <div class="value">{analytics.completed}</div>
          </div>
          <div>
            <div class="label">{$_('Avg time per file')}</div>
            <div class="value">{formatDuration(analytics.avg)}</div>
          </div>
          <div>
            <div class="label">{$_('Files per minute')}</div>
            <div class="value">{analytics.filesPerMinute || '—'}</div>
          </div>
          <div>
            <div class="label">{$_('Total time')}</div>
            <div class="value">{formatDuration(analytics.totalTime)}</div>
          </div>
        </div>
        <div class="queue-list">
          {#if conversionQueue.length === 0}
            <div class="queue-empty">{$_('No files')}</div>
          {:else}
            {#each conversionQueue as entry}
              <div class="queue-row">
                <div class="queue-main">
                  <span class="status {entry.status}">{entry.status}</span>
                  <span class="path">{entry.path}</span>
                  <span class="duration">{formatDuration(entry.durationMs)}</span>
                </div>
                <div class="queue-buttons">
                  <button
                    class="btn btn-xs btn-ghost"
                    on:click={() => moveQueueItem(entry.path, 'up')}
                  >
                    <i class="ph-light ph-caret-up"></i>
                  </button>
                  <button
                    class="btn btn-xs btn-ghost"
                    on:click={() => moveQueueItem(entry.path, 'down')}
                  >
                    <i class="ph-light ph-caret-down"></i>
                  </button>
                  {#if entry.status === 'failed'}
                    <button class="btn btn-xs btn-ghost" on:click={() => retryItem(entry.path)}>
                      {$_('Retry')}
                    </button>
                  {/if}
                  <button class="btn btn-xs btn-ghost" on:click={() => removeQueueItem(entry.path)}>
                    <i class="ph-light ph-x"></i>
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    {/if}
    {#if showSummary && lastSummary}
      <div class="conversion-summary">
        <div class="summary-header">
          <span class="title">{$_('Conversion summary')}</span>
          <div class="summary-actions">
            <button class="btn btn-xs btn-ghost" on:click={retryFailed}>
              {$_('Retry failed')}
            </button>
            <button class="btn btn-xs btn-ghost" on:click={() => (showSummary = false)}>
              {$_('Hide')}
            </button>
          </div>
        </div>
        <div class="summary-grid">
          <div>
            <div class="summary-label">{$_('Succeeded')}</div>
            {#if lastSummary.success.length === 0}
              <div class="summary-empty">{$_('No files')}</div>
            {:else}
              <ul>
                {#each lastSummary.success as entry}
                  <li>{entry}</li>
                {/each}
              </ul>
            {/if}
          </div>
          <div>
            <div class="summary-label">{$_('Failed')}</div>
            {#if lastSummary.failed.length === 0}
              <div class="summary-empty">{$_('No files')}</div>
            {:else}
              <ul class="failed">
                {#each lastSummary.failed as entry}
                  <li>
                    <span class="failed-path">{entry}</span>
                    <button class="btn btn-xs btn-ghost" on:click={() => retryItem(entry)}>
                      {$_('Retry')}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      </div>
    {/if}
    <vscode-scrollable>
      <TreeView
        {__rootPath}
        {__rootParentPath}
        __onSelectionChange={handleSelectionChange}
        __contextMenuItems={buildContextMenuActions}
      />
    </vscode-scrollable>
  </div>
</div>

<style>
  .conversion-progress {
    @apply mx-2 mb-2 rounded-md bg-[#111319] border border-white/10 px-3 py-2 text-[11px] text-[var(--color-base-content)]/70;
  }
  .progress-meta {
    @apply flex items-center justify-between mb-1 uppercase tracking-[0.18em] text-[9px] text-[var(--color-base-content)]/40;
  }
  .current-file {
    @apply mt-1 text-[10px] text-[var(--color-base-content)]/50 truncate;
  }
  .conversion-summary {
    @apply mx-2 mb-2 rounded-md bg-[#0f1116] border border-white/10 px-3 py-2 text-[11px] text-[var(--color-base-content)]/70;
  }
  .summary-header {
    @apply flex items-center justify-between mb-2 uppercase tracking-[0.18em] text-[9px] text-[var(--color-base-content)]/40;
  }
  .summary-actions {
    @apply flex items-center gap-2;
  }
  .summary-grid {
    @apply grid grid-cols-2 gap-2;
  }
  .summary-label {
    @apply text-[9px] uppercase tracking-[0.16em] text-[var(--color-base-content)]/30 mb-1;
  }
  .summary-empty {
    @apply text-[var(--color-base-content)]/40;
  }
  .conversion-summary ul {
    @apply space-y-1 max-h-24 overflow-y-auto;
  }
  .conversion-summary li {
    @apply flex items-center justify-between gap-2;
  }
  .conversion-summary ul.failed li {
    @apply text-rose-300;
  }
  .failed-path {
    @apply truncate;
  }
  .queue-manager {
    @apply mx-2 mb-2 rounded-md bg-[#0b0d12] border border-white/10 px-3 py-2 text-[11px] text-[var(--color-base-content)]/70;
  }
  .queue-header {
    @apply flex items-center justify-between mb-2 uppercase tracking-[0.18em] text-[9px] text-[var(--color-base-content)]/40;
  }
  .queue-actions {
    @apply flex items-center gap-2;
  }
  .queue-analytics {
    @apply grid grid-cols-2 gap-2 mb-2;
  }
  .queue-analytics .label {
    @apply text-[9px] uppercase tracking-[0.16em] text-[var(--color-base-content)]/30;
  }
  .queue-analytics .value {
    @apply text-[var(--color-base-content)]/80 font-semibold;
  }
  .queue-list {
    @apply space-y-1 max-h-40 overflow-y-auto;
  }
  .queue-row {
    @apply flex items-center justify-between gap-2 bg-[#0f131a] border border-white/5 rounded px-2 py-1;
  }
  .queue-main {
    @apply flex items-center gap-2 min-w-0;
  }
  .queue-main .path {
    @apply truncate;
  }
  .queue-main .duration {
    @apply text-[var(--color-base-content)]/40 text-[10px];
  }
  .queue-main .status {
    @apply text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 rounded border border-white/10;
  }
  .queue-main .status.pending {
    @apply text-[var(--color-base-content)]/50;
  }
  .queue-main .status.running {
    @apply text-amber-200 border-amber-200/30;
  }
  .queue-main .status.done {
    @apply text-emerald-200 border-emerald-200/30;
  }
  .queue-main .status.failed {
    @apply text-rose-200 border-rose-200/30;
  }
  .queue-buttons {
    @apply flex items-center gap-1;
  }
  .queue-empty {
    @apply text-[var(--color-base-content)]/40;
  }
</style>