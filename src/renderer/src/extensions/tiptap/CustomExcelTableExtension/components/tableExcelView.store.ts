import { writable } from 'svelte/store'

export type TableExcelViewState = {
  open: boolean
  title: string
  rootPath: string
  activeSheetName: string
  initialSheets: any[]
  seedToken: number
  onClose: () => void
  onApply: (sheets: any[], options?: { selectionOnly?: boolean; selection?: any }) => void
  onReload: () => void
}

const defaultState: TableExcelViewState = {
  open: false,
  title: 'Excel View',
  rootPath: '',
  activeSheetName: '',
  initialSheets: [],
  seedToken: 0,
  onClose: () => {},
  onApply: () => {},
  onReload: () => {}
}

export const tableExcelViewStore = writable<TableExcelViewState>({ ...defaultState })

export function openTableExcelView(next: Partial<TableExcelViewState>) {
  tableExcelViewStore.update((state) => ({
    ...state,
    ...next,
    open: true,
    seedToken: next.seedToken ?? Date.now()
  }))
}

export function closeTableExcelView() {
  tableExcelViewStore.update((state) => ({
    ...state,
    open: false
  }))
}
