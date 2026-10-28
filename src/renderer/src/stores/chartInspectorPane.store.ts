import { writable } from 'svelte/store'
import type { ChartType } from '../extensions/tiptap/CustomChartExtension/utils/chartDataBridge'

export type ChartInspectorTarget = {
  id: string
  chartType?: ChartType
  range?: string
  title?: string
  options?: any
  sourcePath?: string
  sourceType?: string
  embedSync?: boolean
  embedAssetPath?: string
  updateAttributes?: (attrs: Record<string, any>) => void
  editor?: any
}

const store = writable<ChartInspectorTarget | null>(null)

const { subscribe, set, update } = store

const open = (payload: ChartInspectorTarget | null) => {
  set(payload)
}

const clear = () => set(null)

export const _$_chartInspectorPane = {
  subscribe,
  set,
  update,
  open,
  clear
}

