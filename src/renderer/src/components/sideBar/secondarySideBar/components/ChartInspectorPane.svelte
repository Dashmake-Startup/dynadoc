<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { get } from 'svelte/store'
  import {
    CHART_TYPE_ORDER,
    getChartTypeLabel,
    parseA1Range,
    buildA1Range,
    type ChartType
  } from '../../../../extensions/tiptap/CustomChartExtension/utils/chartDataBridge'
  import { sheetRegistry } from '../../../../stores/sheetBridge.store'
  import { _$_chartInspectorPane } from '../../../../stores/chartInspectorPane.store'
  import { _$_chartStylePresets, type ChartStylePreset } from '../../../../stores/chartPresets.store'
  import { openTextInputModal } from '../../../../stores/textInputModal.store'
  import { getTableSelectionRange } from '../../../../extensions/tiptap/CustomExcelTableExtension/utils/chartTableBridge'

  const paletteOptions = [
    { id: 'default', label: 'Dynadoc' },
    { id: 'neon', label: 'Neon' },
    { id: 'pastel', label: 'Pastel' },
    { id: 'mono', label: 'Monochrome' }
  ]

  const palettes: Record<string, string[]> = {
    default: ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
    neon: ['#22d3ee', '#38bdf8', '#a78bfa', '#f472b6', '#facc15', '#4ade80'],
    pastel: ['#93c5fd', '#f9a8d4', '#a7f3d0', '#fde68a', '#fca5a5', '#c4b5fd'],
    mono: ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db']
  }

  let chartType = $state<ChartType>('bar')
  let range = $state('')
  let title = $state('')
  let legendEnabled = $state(true)
  let xAxisLabel = $state('')
  let yAxisLabel = $state('')
  let palette = $state('default')
  let embedSync = $state(false)

  const activeTarget = $derived($_$_chartInspectorPane)

  $effect(() => {
    const target = activeTarget
    if (!target) return
    chartType = (target.chartType || 'bar') as ChartType
    range = target.range || ''
    title = target.title || ''
    const opts = target.options || {}
    legendEnabled = opts?.legend?.show ?? true
    xAxisLabel = opts?.xAxis?.name || ''
    yAxisLabel = opts?.yAxis?.name || ''
    const paletteId = Object.entries(palettes).find(([, colors]) => {
      const current = Array.isArray(opts?.color) ? opts.color : []
      return current.length && colors.join(',') === current.join(',')
    })?.[0]
    palette = paletteId || 'default'
    embedSync = Boolean(target.embedSync)
  })

  const resolveSheetMethods = () => {
    const sourcePath = activeTarget?.sourcePath || ''
    if (!sourcePath) return null
    const registry = sheetRegistry.getSnapshot?.() || get(sheetRegistry as any)
    return registry?.[sourcePath]?.methods ?? null
  }

  const useCurrentSelection = () => {
    const target = activeTarget
    if (!target) return
    if (target.sourceType === 'table') {
      const selection = getTableSelectionRange(target.editor, target.sourcePath)
      if (selection?.range) range = selection.range
      return
    }
    const methods = resolveSheetMethods()
    const selection = methods?.getSelection?.()
    if (!selection?.length) return
    const rangeObj = selection[0]
    const row = rangeObj.row ?? []
    const column = rangeObj.column ?? []
    if (!row.length || !column.length) return
    range = buildA1Range({
      sr: row[0],
      er: row[1] ?? row[0],
      sc: column[0],
      ec: column[1] ?? column[0]
    })
  }

  const highlightRange = () => {
    const target = activeTarget
    if (!target || target.sourceType === 'table') return
    const methods = resolveSheetMethods()
    const parsed = parseA1Range(range)
    if (!methods?.setSelection || !parsed) return
    methods.setSelection({
      row: [parsed.sr, parsed.er],
      column: [parsed.sc, parsed.ec]
    })
  }

  const buildOptions = () => {
    const colors = palettes[palette] || palettes.default
    return {
      legend: { show: legendEnabled },
      xAxis: { name: xAxisLabel || undefined },
      yAxis: { name: yAxisLabel || undefined },
      color: colors
    }
  }

  const applyChanges = () => {
    const target = activeTarget
    if (!target?.updateAttributes) return
    const payload = {
      chartType,
      range: range?.trim(),
      title,
      options: buildOptions(),
      embedSync
    }
    target.updateAttributes(payload)
    if (embedSync) {
      window.dispatchEvent(
        new CustomEvent('dynadoc-chart-embed-request', { detail: { id: target.id } })
      )
    }
  }

  const embedNow = () => {
    const target = activeTarget
    if (!target?.updateAttributes) return
    if (!embedSync) {
      embedSync = true
      target.updateAttributes({ embedSync: true })
    }
    window.dispatchEvent(
      new CustomEvent('dynadoc-chart-embed-request', { detail: { id: target.id } })
    )
  }

  const savePreset = async () => {
    const name = await openTextInputModal({
      title: $_('Save Chart Preset'),
      placeholder: $_('My Chart Style'),
      label: $_('Preset Name')
    })
    if (!name) return
    _$_chartStylePresets.addPreset({
      name,
      chartType,
      paletteId: palette,
      colors: palettes[palette],
      legendEnabled,
      xAxisLabel,
      yAxisLabel,
      title
    })
  }

  const applyPreset = (preset: ChartStylePreset) => {
    chartType = preset.chartType
    palette = preset.paletteId || 'default'
    legendEnabled = preset.legendEnabled ?? true
    xAxisLabel = preset.xAxisLabel || ''
    yAxisLabel = preset.yAxisLabel || ''
    if (preset.title) title = preset.title
  }
</script>

<div class="chart-inspector-pane h-full min-h-0 flex flex-col gap-4">
  {#if !activeTarget}
    <div class="p-4 text-sm text-base-content/60">
      {$_('Select a chart to inspect styles, data range, and sync options.')}
    </div>
  {:else}
    <div class="p-4 flex flex-col gap-4 overflow-y-auto">
      <div class="flex flex-col gap-2">
        <div class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('Chart Type')}</div>
        <select bind:value={chartType} class="select select-bordered select-sm bg-base-100">
          {#each CHART_TYPE_ORDER as type}
            <option value={type}>{$_(getChartTypeLabel(type))}</option>
          {/each}
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <div class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('Title')}</div>
        <input bind:value={title} class="input input-bordered input-sm bg-base-100" />
      </div>

      <div class="flex flex-col gap-2">
        <div class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('Range')}</div>
        <div class="flex flex-wrap gap-2">
          <input bind:value={range} class="input input-bordered input-sm bg-base-100 flex-1" />
          <button class="btn btn-xs btn-outline" onclick={useCurrentSelection}>
            {$_('Use Selection')}
          </button>
          <button class="btn btn-xs btn-ghost" onclick={highlightRange}>
            {$_('Highlight')}
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('Legend')}</div>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" bind:checked={legendEnabled} class="toggle toggle-sm" />
          <span>{legendEnabled ? $_('Visible') : $_('Hidden')}</span>
        </label>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-2">
          <div class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('X Axis Label')}</div>
          <input bind:value={xAxisLabel} class="input input-bordered input-sm bg-base-100" />
        </div>
        <div class="flex flex-col gap-2">
          <div class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('Y Axis Label')}</div>
          <input bind:value={yAxisLabel} class="input input-bordered input-sm bg-base-100" />
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('Palette')}</div>
        <select bind:value={palette} class="select select-bordered select-sm bg-base-100">
          {#each paletteOptions as option}
            <option value={option.id}>{$_(option.label)}</option>
          {/each}
        </select>
      </div>

      <div class="flex items-center justify-between gap-2">
        <div class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('Auto Sync Embed')}</div>
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" bind:checked={embedSync} class="toggle toggle-sm" />
            <span>{embedSync ? $_('On') : $_('Off')}</span>
          </label>
          <button class="btn btn-xs btn-outline" onclick={embedNow}>
            {$_('Embed Chart')}
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('Presets')}</div>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-xs btn-primary" onclick={savePreset}>
            {$_('Save Preset')}
          </button>
          {#each $_$_chartStylePresets as preset (preset.id)}
            <div class="flex items-center gap-1">
              <button class="btn btn-xs btn-outline" onclick={() => applyPreset(preset)}>
                {preset.name}
              </button>
              <button
                class="btn btn-xs btn-ghost text-red-400"
                onclick={() => _$_chartStylePresets.removePreset(preset.id)}
              >
                ✕
              </button>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <div class="px-4 py-2 border-t border-white/10 flex justify-end gap-2 bg-base-300/60">
      <button class="btn btn-xs btn-primary" onclick={applyChanges}>{$_('Apply')}</button>
    </div>
  {/if}
</div>

<style>
  .chart-inspector-pane {
    @apply h-full min-h-0 bg-[var(--color-base-200)] text-[var(--color-base-content)]/80;
  }
</style>
