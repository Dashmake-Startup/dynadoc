<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { _$_chartInspectorModal } from '../../../stores/chartInspectorModal.store'
  import { _$_chartStylePresets, type ChartStylePreset } from '../../../stores/chartPresets.store'
  import { openTextInputModal } from '../../../stores/textInputModal.store'
  import {
    CHART_TYPE_ORDER,
    getChartTypeLabel,
    parseA1Range,
    buildA1Range,
    type ChartType
  } from '../../../extensions/tiptap/CustomChartExtension/utils/chartDataBridge'
  import { sheetRegistry } from '../../../stores/sheetBridge.store'
  import { getTableSelectionRange } from '../../../extensions/tiptap/CustomExcelTableExtension/utils/chartTableBridge'

  const modal = _$_chartInspectorModal

  let chartType = $state<ChartType>('bar')
  let range = $state('')
  let title = $state('')
  let legendEnabled = $state(true)
  let xAxisLabel = $state('')
  let yAxisLabel = $state('')
  let palette = $state('default')

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

  const templates = [
    {
      id: 'sales-kpi',
      label: 'Sales KPI',
      chartType: 'stacked-area' as ChartType,
      title: 'Sales KPI',
      palette: 'neon'
    },
    {
      id: 'quarterly-trend',
      label: 'Quarterly Trend',
      chartType: 'line' as ChartType,
      title: 'Quarterly Trend',
      palette: 'pastel'
    },
    {
      id: 'budget-vs-actual',
      label: 'Budget vs Actual',
      chartType: 'stacked-bar' as ChartType,
      title: 'Budget vs Actual',
      palette: 'default'
    }
  ]

  $effect(() => {
    if ($modal.open) {
      chartType = $modal.chartType || 'bar'
      range = $modal.range || ''
      title = $modal.title || ''
      const opts = $modal.options || {}
      legendEnabled = opts?.legend?.show ?? true
      xAxisLabel = opts?.xAxis?.name || ''
      yAxisLabel = opts?.yAxis?.name || ''
      const paletteId = Object.entries(palettes).find(([, colors]) => {
        const current = Array.isArray(opts?.color) ? opts.color : []
        return current.length && colors.join(',') === current.join(',')
      })?.[0]
      palette = paletteId || 'default'
    }
  })

  const resolveSheetMethods = () => {
    const sourcePath = $modal.sourcePath || ''
    if (!sourcePath) return null
    const registry = sheetRegistry.getSnapshot?.() || {}
    return registry?.[sourcePath]?.methods ?? null
  }

  const useCurrentSelection = () => {
    if ($modal.sourceType === 'table') {
      const selection = getTableSelectionRange($modal.editor, $modal.sourcePath)
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
    if ($modal.sourceType === 'table') return
    const methods = resolveSheetMethods()
    const parsed = parseA1Range(range)
    if (!methods?.setSelection || !parsed) return
    methods.setSelection({
      row: [parsed.sr, parsed.er],
      column: [parsed.sc, parsed.ec]
    })
  }

  const applyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId)
    if (!template) return
    chartType = template.chartType
    title = template.title
    palette = template.palette
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

  const applyChanges = () => {
    const payload = {
      chartType,
      range: range?.trim(),
      title,
      options: buildOptions()
    }
    $modal?.onApply?.(payload)
    modal.confirm()
  }
</script>

{#if $modal.open}
  <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="w-[min(900px,96vw)] max-h-[90vh] bg-base-200 border border-base-100 rounded-xl shadow-2xl flex flex-col overflow-hidden">
      <div class="px-4 py-3 flex items-center justify-between border-b border-white/10 bg-base-300/80">
        <div class="text-[11px] uppercase tracking-widest text-base-content/60">
          {$_('Chart Inspector')}
        </div>
        <button class="text-base-content/60 hover:text-base-content/90 transition-colors" onclick={() => modal.cancel()}>
          ✕
        </button>
      </div>

      <div class="p-4 flex flex-col gap-4 overflow-y-auto">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('Chart Type')}</label>
            <select bind:value={chartType} class="select select-bordered select-sm bg-base-100">
              {#each CHART_TYPE_ORDER as type}
                <option value={type}>{$_(getChartTypeLabel(type))}</option>
              {/each}
            </select>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('Title')}</label>
            <input bind:value={title} class="input input-bordered input-sm bg-base-100" placeholder="Quarterly Revenue" />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('Range')}</label>
            <div class="flex gap-2">
              <input bind:value={range} class="input input-bordered input-sm bg-base-100 flex-1" placeholder="A1:C10" />
              <button class="btn btn-xs btn-outline" onclick={useCurrentSelection}>
                {$_('Use Selection')}
              </button>
              <button class="btn btn-xs btn-ghost" onclick={highlightRange}>
                {$_('Highlight')}
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('Legend')}</label>
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" bind:checked={legendEnabled} class="toggle toggle-sm" />
              <span>{legendEnabled ? $_('Visible') : $_('Hidden')}</span>
            </label>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('X Axis Label')}</label>
            <input bind:value={xAxisLabel} class="input input-bordered input-sm bg-base-100" placeholder="Quarter" />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('Y Axis Label')}</label>
            <input bind:value={yAxisLabel} class="input input-bordered input-sm bg-base-100" placeholder="Revenue" />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('Palette')}</label>
            <select bind:value={palette} class="select select-bordered select-sm bg-base-100">
              {#each paletteOptions as option}
                <option value={option.id}>{$_(option.label)}</option>
              {/each}
            </select>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('Templates')}</label>
            <div class="flex flex-wrap gap-2">
              {#each templates as template}
                <button class="btn btn-xs btn-outline" onclick={() => applyTemplate(template.id)}>
                  {$_(template.label)}
                </button>
              {/each}
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[11px] uppercase tracking-widest text-base-content/50">{$_('Presets')}</label>
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
      </div>

      <div class="px-4 py-2 border-t border-white/10 flex justify-end gap-2 bg-base-300/60">
        <button class="btn btn-xs btn-ghost" onclick={() => modal.cancel()}>
          {$_('Cancel')}
        </button>
        <button class="btn btn-xs btn-primary" onclick={applyChanges}>
          {$_('Apply')}
        </button>
      </div>
    </div>
  </div>
{/if}
