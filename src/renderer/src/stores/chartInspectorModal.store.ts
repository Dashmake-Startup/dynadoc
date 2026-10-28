import { writable } from 'svelte/store'
import type { ChartType } from '../extensions/tiptap/CustomChartExtension/utils/chartDataBridge'

export interface ChartInspectorPayload {
  chartType: ChartType
  sourcePath?: string
  sourceType?: string
  range?: string
  title?: string
  options?: Record<string, any> | null
  onApply?: (attrs: Record<string, any>) => void
  editor?: any
}

export interface ChartInspectorModalState extends ChartInspectorPayload {
  open: boolean
}

const INITIAL_STATE: ChartInspectorModalState = {
  open: false,
  chartType: 'bar',
  sourcePath: '',
  sourceType: 'sheet',
  range: '',
  title: '',
  options: null
}

type Resolver = (value: boolean) => void
let resolver: Resolver | null = null

const store = writable<ChartInspectorModalState>(INITIAL_STATE)

function settle(value: boolean) {
  if (resolver) {
    resolver(value)
    resolver = null
  }
  store.set({ ...INITIAL_STATE })
}

export const _$_chartInspectorModal = {
  subscribe: store.subscribe,
  open(payload: ChartInspectorPayload) {
    return new Promise<boolean>((resolve) => {
      resolver = resolve
      store.set({
        open: true,
        chartType: payload.chartType,
        sourcePath: payload.sourcePath || '',
        sourceType: payload.sourceType || 'sheet',
        range: payload.range || '',
        title: payload.title || '',
        options: payload.options || null,
        onApply: payload.onApply,
        editor: payload.editor
      })
    })
  },
  confirm() {
    settle(true)
  },
  cancel() {
    settle(false)
  }
}

export function openChartInspector(payload: ChartInspectorPayload) {
  return _$_chartInspectorModal.open(payload)
}
