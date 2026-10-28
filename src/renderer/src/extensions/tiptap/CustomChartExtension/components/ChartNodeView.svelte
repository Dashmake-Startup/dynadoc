<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import type { NodeViewProps } from '@tiptap/core'
  import { NodeViewWrapper } from 'svelte-tiptap'
  import type * as echarts from 'echarts'
  import { get } from 'svelte/store'
  import { _ } from 'svelte-i18n'
  import toast from 'svelte-hot-french-toast'
  import { DocumentModel } from '../../../../models/Document'
  import { sheetRegistry } from '../../../../stores/sheetBridge.store'
  import {
    buildChartOption,
    parseA1Range,
    type ChartType,
    buildA1Range,
    getTableFromRange
  } from '../utils/chartDataBridge'
  import {
    isPathInsideDoc,
    readChartConfig,
    resolveChartConfigPath,
    writeChartConfig
  } from '../utils/chartPersistence'
  import { openChartInspector } from '../../../../stores/chartInspectorModal.store'
  import { _$_chartInspectorPane } from '../../../../stores/chartInspectorPane.store'
  import {
    _$_activeSecondarySidebarItem,
    _$_secondarySidebarVisible
  } from '../../../../stores/common.store'
  import { nodeApi } from '../../../../utils/shims/node'
  import {
    getTableDataFromEditor,
    getTableSelectionRange
  } from '../../../../extensions/tiptap/CustomExcelTableExtension/utils/chartTableBridge'

  interface Props extends NodeViewProps {
    node: any
    editor: any
    getPos: () => number
    updateAttributes: (attrs: Record<string, any>) => void
    selected: boolean
  }

  let { node, editor, getPos, updateAttributes }: Props = $props()

  let chartEl: HTMLDivElement
  let chartInstance: echarts.ECharts | null = null
  let missingReason: string | null = null
  let lastSignature: string | null = null
  let resizeObserver: ResizeObserver | null = null

  const chartType = $derived((node?.attrs?.chartType || 'bar') as ChartType)
  const sourceType = $derived((node?.attrs?.sourceType || 'sheet') as string)
  const sourcePath = $derived((node?.attrs?.sourcePath || '') as string)
  const sourceTableId = $derived((node?.attrs?.sourceTableId || '') as string)
  const sampleData = $derived(Boolean(node?.attrs?.sampleData))
  const rangeA1 = $derived((node?.attrs?.range || '') as string)
  const title = $derived((node?.attrs?.title || '') as string)
  const height = $derived(Number(node?.attrs?.height || 360))
  const configPath = $derived((node?.attrs?.configPath || '') as string)
  const embedSync = $derived(Boolean(node?.attrs?.embedSync))
  const embedAssetPath = $derived((node?.attrs?.embedAssetPath || '') as string)
  const embedId = $derived((node?.attrs?.embedId || '') as string)

  const optionOverrides = $derived.by(() => {
    const raw = node?.attrs?.options
    if (!raw) return null
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {
      return null
    }
  })

  const resolveSheetMethods = () => {
    if (!sourcePath) return null
    const registry = sheetRegistry.getSnapshot?.() || get(sheetRegistry as any)
    return registry?.[sourcePath]?.methods ?? null
  }

  const resolveTableData = () => {
    const range = parseA1Range(rangeA1)
    return getTableDataFromEditor(editor, sourcePath, range, sourceTableId)
  }

  /* 
  import * as echarts from 'echarts';

// Create the echarts instance
var myChart = echarts.init(document.getElementById('main'));

// Draw the chart
myChart.setOption({
  title: {
    text: 'ECharts Getting Started Example'
  },
  tooltip: {},
  xAxis: {
    data: ['shirt', 'cardigan', 'chiffon', 'pants', 'heels', 'socks']
  },
  yAxis: {},
  series: [
    {
      name: 'sales',
      type: 'bar',
      data: [5, 20, 36, 10, 10, 20]
    }
  ]
});
  */

  const updateChart = () => {
    console.log('buildChartOptionbuildChartOption updateChart chartInstance', {
      chartInstance,
      sourcePath,
      sourceType
    })

    if (!chartInstance) return
    if (!sourcePath && sourceType !== 'table') {
      missingReason = 'Data source missing'
      return
    }
    if (sourceType === 'table' && !sourcePath && !sourceTableId) {
      missingReason = 'Table source missing'
      return
    }
    console.log('buildChartOptionbuildChartOption missingReason 1', { missingReason })

    const range = parseA1Range(rangeA1)
        console.log('buildChartOptionbuildChartOption missingReason 12', { missingReason, range ,rangeA1})

    if (!range) {
      missingReason = 'Select a range to render this chart'
      return
    }
    console.log('buildChartOptionbuildChartOption missingReason 123', { missingReason, range ,rangeA1})

    if (sourceType !== 'table' && !resolveSheetMethods()) {
      missingReason = 'Spreadsheet not loaded'
      return
    }
    const table =
      sourceType === 'table' ? resolveTableData() : getTableFromRange(resolveSheetMethods(), range)
    if (!table || !table.length) {
      if (sourceType === 'table') {
        missingReason = 'Table not loaded'
        return
      }
      missingReason = 'No data found in range'
      return
    }
    const signature = JSON.stringify({ chartType, sourceType, sourcePath, rangeA1, table })
    console.log('buildChartOptionbuildChartOption updateChart signature', { signature })

    if (signature === lastSignature) return
    lastSignature = signature
    missingReason = null
    const option = buildChartOption(chartType, table, optionOverrides)
    if (title) option.title = { text: title, left: 'center', top: 4 }
    console.log('buildChartOptionbuildChartOption Updating chart with option', { option })
    chartInstance.setOption(option, true)
    if (embedSync) scheduleEmbedRefresh()
  }

  const ensureConfigLoaded = async () => {
    const doc = DocumentModel.getActiveDocument()
    if (!doc || !node?.attrs?.id) return
    let resolvedPath = configPath
    if (!resolvedPath || !isPathInsideDoc(resolvedPath, doc)) {
      resolvedPath = await resolveChartConfigPath(doc, node.attrs.id)
      if (resolvedPath && resolvedPath !== configPath) {
        updateAttributes({ configPath: resolvedPath })
      }
    }
    if (!resolvedPath) return
    const loaded = await readChartConfig(resolvedPath)
    if (!loaded) return
    const nextAttrs: Record<string, any> = {}
    if (!node?.attrs?.chartType && loaded.chartType) nextAttrs.chartType = loaded.chartType
    if (!node?.attrs?.sourceType && loaded.sourceType) nextAttrs.sourceType = loaded.sourceType
    if (!node?.attrs?.sourcePath && loaded.sourcePath) nextAttrs.sourcePath = loaded.sourcePath
    if (!node?.attrs?.sourceTableId && loaded.sourceTableId)
      nextAttrs.sourceTableId = loaded.sourceTableId
    if (!node?.attrs?.range && loaded.range) nextAttrs.range = loaded.range
    if (loaded.sampleData != null && node?.attrs?.sampleData == null)
      nextAttrs.sampleData = loaded.sampleData
    if (!node?.attrs?.title && loaded.title) nextAttrs.title = loaded.title
    if (!node?.attrs?.options && loaded.options) nextAttrs.options = loaded.options
    if (loaded.embedSync != null && node?.attrs?.embedSync == null)
      nextAttrs.embedSync = loaded.embedSync
    if (!node?.attrs?.embedAssetPath && loaded.embedAssetPath)
      nextAttrs.embedAssetPath = loaded.embedAssetPath
    if (Object.keys(nextAttrs).length) {
      updateAttributes(nextAttrs)
    }
  }

  const persistConfig = async () => {
    const doc = DocumentModel.getActiveDocument()
    if (!doc || !node?.attrs?.id) return
    let resolvedPath = configPath
    if (!resolvedPath || !isPathInsideDoc(resolvedPath, doc)) {
      resolvedPath = await resolveChartConfigPath(doc, node.attrs.id)
      if (resolvedPath && resolvedPath !== configPath) {
        updateAttributes({ configPath: resolvedPath })
      }
    }
    if (!resolvedPath) return
    writeChartConfig(resolvedPath, {
      id: node.attrs.id,
      chartType,
      sourceType,
      sourcePath,
      sourceTableId,
      sampleData,
      range: rangeA1,
      title,
      options: optionOverrides,
      embedSync,
      embedAssetPath
    })
  }

  const subscribeSheetEvents = () => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as any
      if (sourceType === 'table') {
        if (!detail?.sheetName || detail.sheetName !== sourcePath) return
      } else {
        if (!detail?.rootPath || detail.rootPath !== sourcePath) return
      }
      updateChart()
    }
    window.addEventListener('dynadoc-sheet-dirty', handler as any)
    window.addEventListener('dynadoc-sheet-sync', handler as any)
    window.addEventListener('dynadoc-sheet-ready', handler as any)
    window.addEventListener('dynadoc-sheet-destroy', handler as any)
    window.addEventListener('dynadoc-table-dirty', handler as any)
    return () => {
      window.removeEventListener('dynadoc-sheet-dirty', handler as any)
      window.removeEventListener('dynadoc-sheet-sync', handler as any)
      window.removeEventListener('dynadoc-sheet-ready', handler as any)
      window.removeEventListener('dynadoc-sheet-destroy', handler as any)
      window.removeEventListener('dynadoc-table-dirty', handler as any)
    }
  }

  const ensureRange = () => {
    if (rangeA1) return
    if (sourceType === 'table') {
      const selection = getTableSelectionRange(editor, sourcePath)
      if (selection?.range) {
        updateAttributes({ range: selection.range })
      }
      return
    }
    const methods = resolveSheetMethods()
    const selection = methods?.getSelection?.()
    if (!selection?.length) return
    const range = selection[0]
    const row = range.row ?? []
    const column = range.column ?? []
    if (!row.length || !column.length) return
    const nextRange = buildA1Range({
      sr: row[0],
      er: row[1] ?? row[0],
      sc: column[0],
      ec: column[1] ?? column[0]
    })
    updateAttributes({ range: nextRange })
  }

  let embedTimer: ReturnType<typeof setTimeout> | null = null

  const ensureEmbedAssetPath = async () => {
    const doc = DocumentModel.getActiveDocument()
    if (!doc || !node?.attrs?.id) return ''
    let resolvedPath = embedAssetPath
    if (!resolvedPath || !isPathInsideDoc(resolvedPath, doc)) {
      const result = await DocumentModel.getAssetFilePathFromDocument(
        DocumentModel.AssetType.IMG,
        doc,
        `chart-${node.attrs.id}.png`
      )
      resolvedPath = result?.filePath || ''
      if (resolvedPath && resolvedPath !== embedAssetPath) {
        updateAttributes({ embedAssetPath: resolvedPath })
      }
    }
    return resolvedPath || ''
  }

  const writeDataUrlToFile = async (dataUrl: string, path: string) => {
    const base64 = dataUrl.split(',')[1] || ''
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    if (nodeApi?.fsPromises?.writeFile) {
      await nodeApi.fsPromises.writeFile(path, bytes)
      return
    }
    if (nodeApi?.fs?.writeFileSync) {
      nodeApi.fs.writeFileSync(path, bytes)
    }
  }

  const updateEmbeddedImages = (assetPath: string) => {
    if (!editor || !assetPath) return
    const cacheBuster = `?v=${Date.now()}`
    const src = `${assetPath}${cacheBuster}`
    const embedKey = embedId || node?.attrs?.id
    if (!embedKey) return
    const { state, view } = editor
    let tr = state.tr
    state.doc.descendants((child, pos) => {
      if (child.type?.name !== 'imageFigure') return
      if (child.attrs?.chartEmbedId !== embedKey) return
      tr = tr.setNodeMarkup(pos, undefined, {
        ...child.attrs,
        src,
        chartEmbedId: embedKey,
        chartEmbedPath: assetPath
      })
    })
    if (tr.docChanged) view.dispatch(tr)
  }

  const refreshEmbedAsset = async () => {
    if (!chartInstance || !nodeApi) return
    const targetPath = await ensureEmbedAssetPath()
    if (!targetPath) return
    const dataUrl = chartInstance.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#ffffff'
    })
    if (!dataUrl) return
    try {
      await writeDataUrlToFile(dataUrl, targetPath)
      updateEmbeddedImages(targetPath)
    } catch (err) {
      console.warn('Chart embed update failed', err)
    }
  }

  const scheduleEmbedRefresh = () => {
    if (!embedSync) return
    if (embedTimer) clearTimeout(embedTimer)
    embedTimer = setTimeout(() => {
      embedTimer = null
      void refreshEmbedAsset()
    }, 250)
  }

  onMount(() => {
    if (chartEl) {
      // Loaded on demand — echarts is ~2.3 MB and must not sit on the
      // first-render critical path for plain text documents.
      import('echarts').then((echarts) => {
        if (!chartEl) return
        chartInstance = echarts.init(chartEl)
        updateChart()
        resizeObserver = new ResizeObserver(() => {
          chartInstance?.resize()
        })
        resizeObserver.observe(chartEl)
      })
    }
    const unsubscribe = subscribeSheetEvents()
    void ensureConfigLoaded()
    const embedListener = (event: Event) => {
      const detail = (event as CustomEvent).detail as any
      if (!detail?.id || detail.id !== node?.attrs?.id) return
      void refreshEmbedAsset()
      updateAttributes({ embedSync: true })
    }
    window.addEventListener('dynadoc-chart-embed-request', embedListener as any)
    return () => {
      unsubscribe?.()
      window.removeEventListener('dynadoc-chart-embed-request', embedListener as any)
    }
  })

  onDestroy(() => {
    resizeObserver?.disconnect()
    chartInstance?.dispose()
    chartInstance = null
  })

  $effect(() => {
    if (!chartInstance) return
    ensureRange()
    updateChart()
    void persistConfig()
    if (embedSync) scheduleEmbedRefresh()
  })

  const editChart = async () => {
    if (sourceType === 'table' && sourceTableId) {
      const mod = await import(
        '../../CustomExcelTableExtension/CustomExcelTableExtension.svelte'
        // 'src/renderer/src/extensions/tiptap/CustomExcelTableExtension/CustomExcelTableExtension.svelte.ts'
      )
      const opened = mod?.openTableExcelModalForChart?.(editor, sourceTableId)
      if (opened) return
    }
    await openChartInspector({
      chartType,
      sourcePath,
      sourceType,
      range: rangeA1,
      title,
      options: optionOverrides || null,
      editor,
      onApply: (next) => {
        if (!next) return
        updateAttributes(next)
      }
    })
  }

  const downloadDataUrl = async (dataUrl: string, fileName: string) => {
    if (!dataUrl) return
    if (window?.api?.saveDialogFile && nodeApi?.fsPromises) {
      const savePath = await window.api.saveDialogFile({
        title: $_('Export chart'),
        defaultPath: fileName,
        filters: [{ name: 'Chart', extensions: [fileName.split('.').pop() || 'png'] }]
      })
      if (!savePath) return
      const base64 = dataUrl.split(',')[1] || ''
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
      }
      await nodeApi.fsPromises.writeFile(savePath, bytes)
      return
    }
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportChart = async (type: 'png' | 'svg') => {
    if (!chartInstance) return
    try {
      const dataUrl = chartInstance.getDataURL({
        type,
        pixelRatio: type === 'png' ? 2 : 1,
        backgroundColor: '#ffffff'
      })
      await downloadDataUrl(dataUrl, `chart-${node?.attrs?.id || Date.now()}.${type}`)
      toast.success($_('Chart exported'))
    } catch (err) {
      console.warn('Chart export failed', err)
      toast.error($_('Chart export failed'))
    }
  }

  const insertChartAsImage = async () => {
    if (!chartInstance || !editor) return
    const targetPath = await ensureEmbedAssetPath()
    if (!targetPath) {
      toast.error($_('Unable to prepare chart asset'))
      return
    }
    const dataUrl = chartInstance.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#ffffff'
    })
    if (!dataUrl) return
    try {
      await writeDataUrlToFile(dataUrl, targetPath)
      const embedKey = embedId || node?.attrs?.id
      if (!embedId && embedKey) {
        updateAttributes({ embedId: embedKey })
      }
      const inserted =
        typeof (editor.commands as any).insertImage === 'function'
          ? (editor.commands as any).insertImage({
              src: targetPath,
              chartEmbedId: embedKey,
              chartEmbedPath: targetPath
            })
          : false
      if (!inserted) {
        toast.error($_('Unable to insert chart as image'))
      } else {
        updateAttributes({ embedSync: true })
      }
    } catch (err) {
      console.warn('Chart embed failed', err)
      toast.error($_('Unable to insert chart as image'))
    }
  }

  const activateInspectorPane = () => {
    if (!node?.attrs?.id) return
    _$_chartInspectorPane.open({
      id: node.attrs.id,
      chartType,
      range: rangeA1,
      title,
      options: optionOverrides || null,
      sourcePath,
      sourceType,
      embedSync,
      embedAssetPath,
      updateAttributes,
      editor
    })
    _$_activeSecondarySidebarItem.set('chartInspector')
    _$_secondarySidebarVisible.set(true)
  }

  let _lastInspectorSignature = ''
  $effect(() => {
    const target = $_$_chartInspectorPane
    if (!target || target.id !== node?.attrs?.id) return
    const signature = JSON.stringify({
      id: target.id,
      chartType,
      range: rangeA1,
      title,
      options: optionOverrides || null,
      sourcePath,
      sourceType,
      embedSync,
      embedAssetPath
    })
    if (signature === _lastInspectorSignature) return
    _lastInspectorSignature = signature
    _$_chartInspectorPane.open({
      ...target,
      chartType,
      range: rangeA1,
      title,
      options: optionOverrides || null,
      sourcePath,
      sourceType,
      embedSync,
      embedAssetPath
    })
  })
</script>

<NodeViewWrapper
  class="chart-nodeview node-view-chart"
  data-chart-type={chartType}
  data-source={sourcePath}
  style={`min-height: ${height}px;`}
>
  <div class="chart-toolbar" on:click={activateInspectorPane} on:dblclick={editChart}>
    <div class="chart-meta">
      <span class="chart-badge">{chartType}</span>
      {#if rangeA1}
        <span class="chart-range">{rangeA1}</span>
      {/if}
      {#if sampleData}
        <span class="chart-badge">{$_('Sample')}</span>
      {/if}
    </div>
    <div class="chart-actions">
      <button type="button" class="chart-btn" on:click={editChart}>
        {$_('Edit')}
      </button>
      <button type="button" class="chart-btn" on:click={() => exportChart('png')}>
        {$_('PNG')}
      </button>
      <button type="button" class="chart-btn" on:click={() => exportChart('svg')}>
        {$_('SVG')}
      </button>
      <button type="button" class="chart-btn" on:click={insertChartAsImage}>
        {$_('Insert')}
      </button>
      <button type="button" class="chart-btn" on:click={updateChart}>
        {$_('Refresh')}
      </button>
    </div>
  </div>

  <div class="chart-body">
    {#if missingReason}
      <div class="chart-empty">
        <div class="chart-empty-title">{$_('Chart is waiting for data')}</div>
        <div class="chart-empty-sub">{missingReason}</div>
      </div>
    {:else}
      <div class="chart-canvas" bind:this={chartEl}></div>
    {/if}
  </div>
</NodeViewWrapper>

<style>
  .chart-nodeview {
    @apply relative w-full rounded-[16px] border border-black/10 dark:border-white/10 bg-[color-mix(in_srgb,var(--color-base-white)_90%,transparent)] dark:bg-dark-900/70 overflow-hidden shadow-sm;
  }

  .chart-toolbar {
    @apply flex items-center justify-between px-4 py-2 bg-black/5 dark:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-[12px] uppercase tracking-widest;
  }

  .chart-badge {
    @apply rounded-full bg-blue-600/90 text-[var(--color-base-content)] px-2 py-1 text-[10px];
  }

  .chart-range {
    @apply ml-2 text-black/60 dark:text-[var(--color-base-content)]/60;
  }

  .chart-actions {
    @apply flex items-center gap-2;
  }

  .chart-btn {
    @apply rounded-full px-3 py-1 text-[10px] font-semibold bg-[color-mix(in_srgb,var(--color-base-white)_90%,transparent)] dark:bg-black/40 border border-black/10 dark:border-white/10;
  }

  .chart-body {
    @apply relative w-full;
  }

  .chart-canvas {
    width: 100%;
    min-height: 320px;
    height: 100%;
  }

  .chart-empty {
    @apply flex flex-col items-center justify-center gap-2 text-center py-10 text-black/60 dark:text-[var(--color-base-content)]/60;
  }

  .chart-empty-title {
    @apply text-sm font-semibold;
  }

  .chart-empty-sub {
    @apply text-xs opacity-70;
  }
</style>
