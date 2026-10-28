<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { _$_spreadsheetEditorModal } from '../../../stores/spreadsheetEditorModal.store'
  import SpreadsheetEditorWidget from '../../../extensions/tiptap/CustomSpreadsheetExtension/components/SpreadsheetEditorWidget.svelte'
  import { GenericFormatingEditorCommands } from '../actions/formatting/commands/GenericFormatingEditorCommands.svelte'
  import { sheetRegistry } from '../../../stores/sheetBridge.store'

  const modal = _$_spreadsheetEditorModal

  const src = $derived($modal.src || '')
  const maxWidth = $derived($modal.maxWidth || 1100)
  const maxHeight = $derived($modal.maxHeight || 720)

  const columnIndexToLabel = (index: number) => {
    let label = ''
    let value = index + 1
    while (value > 0) {
      const mod = (value - 1) % 26
      label = String.fromCharCode(65 + mod) + label
      value = Math.floor((value - 1) / 26)
    }
    return label
  }

  const buildA1Range = (
    rowStart: number,
    columnStart: number,
    rowEnd: number,
    columnEnd: number
  ) => {
    const start = `${columnIndexToLabel(columnStart)}${rowStart + 1}`
    const end = `${columnIndexToLabel(columnEnd)}${rowEnd + 1}`
    return start === end ? start : `${start}:${end}`
  }

  const getSelectionRange = () => {
    if (!src) return ''
    const registry = sheetRegistry.getSnapshot()
    const entry = registry?.[src]
    const methods = entry?.methods
    const coords = methods?.getSelectionCoordinates?.()
    if (Array.isArray(coords) && coords.length > 0) {
      return coords[0] || ''
    }
    const selection = methods?.getSelection?.()
    if (Array.isArray(selection) && selection[0]) {
      const range = selection[0]
      const row = range?.row ?? []
      const column = range?.column ?? []
      const rowStart = row[0] ?? 0
      const rowEnd = row[1] ?? rowStart
      const columnStart = column[0] ?? 0
      const columnEnd = column[1] ?? columnStart
      return buildA1Range(rowStart, columnStart, rowEnd, columnEnd)
    }
    return ''
  }

  const handleInsertChartFromSelection = () => {
    const range = getSelectionRange()
    GenericFormatingEditorCommands.insertChartFromSheetSource(src, range, 'bar')
  }
</script>

{#if $modal.open}
  <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <!-- <div class="w-[min(1100px,95vw)] h-[min(720px,90vh)] bg-base-200 border border-base-100 rounded-xl shadow-2xl flex flex-col overflow-hidden"> -->
         <div class="w-[min(1100px,95vw)] h-[min(720px,90vh)] bg-base-200 border border-base-100 rounded-xl shadow-2xl flex flex-col overflow-hidden">

      <div class="px-4 py-3 flex items-center justify-between border-b border-white/10 bg-base-300/80">
        <div class="text-[11px] uppercase tracking-widest text-base-content/60">
          {$_('Spreadsheet Editor')}
        </div>
        <button
          class="text-base-content/60 hover:text-base-content/90 transition-colors"
          onclick={() => modal.confirm()}
        >
          ✕
        </button>
      </div>
      <div class="flex-1 overflow-hidden p-3">
        {#if src}
          <SpreadsheetEditorWidget
            __src={src}
            __readOnly={false}
          />
        {:else}
          <div class="h-full w-full flex items-center justify-center text-base-content/40 text-[11px]">
            {$_('No spreadsheet selected')}
          </div>
        {/if}
      </div>
      <div class="px-4 py-2 border-t border-white/10 flex justify-end gap-2 bg-base-300/60">
        <button
          class="btn btn-xs btn-ghost"
          onclick={() => modal.cancel()}
        >
          {$_('Close')}
        </button>
        <button
          class="btn btn-xs btn-outline"
          onclick={handleInsertChartFromSelection}
        >
          {$_('Chart from Selection')}
        </button>
        <button
          class="btn btn-xs btn-primary"
          onclick={() => modal.confirm()}
        >
          {$_('Done')}
        </button>
      </div>
    </div>
  </div>
{/if}
