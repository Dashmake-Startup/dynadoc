import { v4 as uuidv4 } from 'uuid'
import { createUiPersistedStore } from './uiPersistence'
import type { ChartType } from '../extensions/tiptap/CustomChartExtension/utils/chartDataBridge'

export type ChartStylePreset = {
  id: string
  name: string
  chartType: ChartType
  paletteId: string
  colors?: string[]
  legendEnabled?: boolean
  xAxisLabel?: string
  yAxisLabel?: string
  title?: string
}

const DEFAULT_PRESETS: ChartStylePreset[] = [
  {
    id: 'preset-sales-kpi',
    name: 'Sales KPI',
    chartType: 'stacked-area',
    paletteId: 'neon',
    title: 'Sales KPI',
    legendEnabled: true
  },
  {
    id: 'preset-quarterly-trend',
    name: 'Quarterly Trend',
    chartType: 'line',
    paletteId: 'pastel',
    title: 'Quarterly Trend',
    legendEnabled: true
  },
  {
    id: 'preset-budget-vs-actual',
    name: 'Budget vs Actual',
    chartType: 'stacked-bar',
    paletteId: 'default',
    title: 'Budget vs Actual',
    legendEnabled: true
  }
]

// Through createUiPersistedStore, like every other persisted store.
//
// This called persistStore directly with 'charts/style-presets.json', a
// relative path. persistStore resolves its argument with path.resolve on the
// desktop, and that resolves against the renderer's working directory -- so
// the presets were written next to wherever the application happened to be
// started from. In a packaged build that is the installation directory, which
// means they were lost on every update, and in a read-only location they were
// never written at all. Nothing reported it: persistStore logs a failed save
// and carries on.
//
// createUiPersistedStore anchors the file under the storage directory instead,
// and already handles the part that made the relative path tempting: the
// storage directory is only known asynchronously, so it defers attaching
// persistence until the path is available. Writing that again here is how the
// bug would come back.
const store = createUiPersistedStore<ChartStylePreset[]>('charts:style-presets', DEFAULT_PRESETS)

const { subscribe, set, update } = store

const addPreset = (preset: Omit<ChartStylePreset, 'id'> & { id?: string }) => {
  const id = preset.id || uuidv4()
  update((current) => [...current, { ...preset, id }])
  return id
}

const removePreset = (id: string) => {
  update((current) => current.filter((preset) => preset.id !== id))
}

const updatePreset = (id: string, patch: Partial<ChartStylePreset>) => {
  update((current) =>
    current.map((preset) => (preset.id === id ? { ...preset, ...patch } : preset))
  )
}

export const _$_chartStylePresets = {
  subscribe,
  set,
  update,
  addPreset,
  removePreset,
  updatePreset
}

