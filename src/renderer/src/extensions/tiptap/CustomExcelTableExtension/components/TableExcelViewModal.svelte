<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { untrack } from 'svelte'
  import SpreadsheetEditorWidget from '../../CustomSpreadsheetExtension/components/SpreadsheetEditorWidget.svelte'
  import { tableExcelViewStore, closeTableExcelView } from './tableExcelView.store'

  let methods = $state<any>(null)
  let previewOn = $state(false)
  let applySelectionOnly = $state(false)

  // Use a state-proxied Set or replace the object to trigger updates
  let highlightedCells = $state<Set<string>>(new Set())
  let outOfRangeCells = $state<Set<string>>(new Set())

  const MAX_TABLE_ROWS = 20
  const MAX_TABLE_COLS = 100

  // Svelte 5: Store values are accessed directly with the $ prefix
  const componentState = $derived($tableExcelViewStore)

  const handleReady = (event: any) => {
    console.log('tableexmodal handleReady ')

    // FIX: Ensure we use the most recent state value inside the callback
    // without triggering an infinite effect loop.
    untrack(() => {
      console.log('tableexmodal untrack ', { componentState, event })

      if (!event?.detail || event.detail.rootPath !== componentState.rootPath) return
      methods = event.detail.methods
      // if (componentState.open) {
      if (componentState.open && componentState.initialSheets?.length) {
        console.log('tableexmodal seedSheet ')

        seedSheet()
      }
    })
  }

  // Lifecycle: Event Listener
  $effect(() => {
    window.addEventListener('dynadoc-sheet-ready', handleReady)
    return () => window.removeEventListener('dynadoc-sheet-ready', handleReady)
  })

  // Watch for external re-seed requests
  $effect(() => {
    // We want to re-seed whenever seedToken changes while open
    const token = componentState.seedToken
    const isOpen = componentState.open

    // if (isOpen && methods) {
    if (isOpen && methods && componentState.initialSheets?.length) {
      untrack(() => {
        seedSheet()
        clearHighlights()
        previewOn = false
      })
    }
  })

  const togglePreview = () => {
    if (!methods) return
    if (previewOn) {
      clearHighlights()
      previewOn = false
      return
    }
    applyHighlights()
    previewOn = true
  }

  const toDenseMatrix = (sheet: any) => {
    const celldata = sheet?.celldata || []
    if (celldata.length === 0 && Array.isArray(sheet?.data)) {
      return sheet.data.map((row: any[]) =>
        Array.isArray(row)
          ? row.map((cell: any) =>
              cell && typeof cell === 'object' && 'v' in cell
                ? String(cell.v ?? '')
                : String(cell ?? '')
            )
          : []
      )
    }
    if (celldata.length === 0) return [[]]

    let maxRow = 0
    let maxCol = 0
    celldata.forEach((cell) => {
      maxRow = Math.max(maxRow, Number(cell?.r) || 0)
      maxCol = Math.max(maxCol, Number(cell?.c) || 0)
    })

    const data = Array.from({ length: maxRow + 1 }, () => Array(maxCol + 1).fill(''))
    celldata.forEach((cell) => {
      const r = Number(cell?.r),
        c = Number(cell?.c)
      if (Number.isFinite(r) && Number.isFinite(c)) {
        const v = cell?.v
        data[r][c] = v && typeof v === 'object' && 'v' in v ? String(v.v ?? '') : String(v ?? '')
      }
    })
    return data
  }

  const seedSheet = () => {
    console.log('tableexmodal seedSheet ', { methods, componentState })

    if (!methods || !componentState.initialSheets?.length) return
    const sheets = componentState.initialSheets

    // Performance: If the sheet is very large, updateSheet is usually faster than setCellValuesByRange
    if (methods.updateSheet) {
      methods.updateSheet(JSON.parse(JSON.stringify(sheets)))
    } else if (methods.setCellValuesByRange) {
      const data = toDenseMatrix(sheets[0])
      methods.setCellValuesByRange(data, {
        row: [0, data.length - 1],
        column: [0, (data[0]?.length || 1) - 1]
      })
    }
  }

  const clearHighlights = () => {
    if (!methods || highlightedCells.size === 0) return
    highlightedCells.forEach((key) => {
      const [r, c] = key.split(':').map(Number)
      methods.setCellFormatByRange?.('bg', null, { row: [r, r], column: [c, c] })
    })
    highlightedCells = new Set() // New reference triggers reactivity
  }

  const clearOutOfRange = () => {
    if (!methods || outOfRangeCells.size === 0) return
    outOfRangeCells.forEach((key) => {
      const [r, c] = key.split(':').map(Number)
      methods.setCellFormatByRange?.('bg', null, { row: [r, r], column: [c, c] })
      methods.setCellFormatByRange?.('fc', null, { row: [r, r], column: [c, c] })
    })
    outOfRangeCells = new Set()
  }

  const applyHighlights = () => {
    if (!methods || !componentState.initialSheets?.length) return
    clearHighlights()
    clearOutOfRange()

    const currentSheets = methods.getAllSheets?.() || []
    const current =
      currentSheets.find((sheet: any) => sheet?.name === componentState.activeSheetName) ||
      currentSheets[0]
    const initial =
      componentState.initialSheets.find(
        (sheet: any) => sheet?.name === componentState.activeSheetName
      ) || componentState.initialSheets[0]
    if (!current) return

    const initialMap = buildCellMap(initial)
    const currentMap = buildCellMap(current)
    const allKeys = new Set([...initialMap.keys(), ...currentMap.keys()])

    const nextHighlights = new Set<string>()
    allKeys.forEach((key) => {
      if ((initialMap.get(key) ?? '') !== (currentMap.get(key) ?? '')) {
        const [r, c] = key.split(':').map(Number)
        methods.setCellFormatByRange?.('bg', '#1f4b99', { row: [r, r], column: [c, c] })
        nextHighlights.add(key)
      }
    })
    highlightedCells = nextHighlights
  }

  const buildCellMap11 = (sheet: any) => {
    const map = new Map<string, string>()
    if (!sheet) return map

    // Strategy A: Use the 2D 'data' grid (Most reliable for live edits)
    if (Array.isArray(sheet.data)) {
      sheet.data.forEach((row: any[], r: number) => {
        if (!Array.isArray(row)) return
        row.forEach((cell: any, c: number) => {
          if (cell === null || cell === undefined) return

          let value = ''
          if (typeof cell === 'object') {
            // FortuneSheet stores the raw value in .v
            value = String(cell.v ?? '')
          } else {
            value = String(cell)
          }

          if (value !== '') map.set(`${r}:${c}`, value)
        })
      })
      return map
    }

    // Strategy B: Fallback to 'celldata' (Sparse array)
    const celldata = sheet.celldata || []
    celldata.forEach((cell: any) => {
      const r = cell?.r,
        c = cell?.c
      const v = cell?.v
      const val = v && typeof v === 'object' && 'v' in v ? String(v.v ?? '') : String(v ?? '')
      map.set(`${r}:${c}`, val)
    })
    return map
  }

  const buildCellMap = (sheet: any) => {
    console.log('tableexmodal buildCellMapbuildCellMap ', { sheet })
    const map = new Map<string, string>()
    if (Array.isArray(sheet?.data)) {
      sheet.data.forEach((row: any, r: number) => {
        if (!Array.isArray(row)) return
        row.forEach((cell: any, c: number) => {
          if (cell === null || cell === undefined) return
          map.set(`${r}:${c}`, String(cell))
        })
      })
      return map
    }
    const celldata = sheet?.celldata || []
    celldata.forEach((cell) => {
      const r = cell?.r,
        c = cell?.c
      const v = cell?.v
      const val = v && typeof v === 'object' && 'v' in v ? String(v.v ?? '') : String(v ?? '')
      map.set(`${r}:${c}`, val)
    })
    return map
  }

  const applyChanges = () => {
    if (!methods) return
    const sheets = JSON.parse(JSON.stringify(methods.getAllSheets?.() || []))
    const selection = applySelectionOnly ? getSelectionRange() : null
    const activeSheet =
      sheets.find((sheet: any) => sheet?.name === componentState.activeSheetName) || sheets[0]
    if (activeSheet) {
      const violations = getOutOfRangeCells(activeSheet)
      if (violations.size > 0) {
        highlightOutOfRange(violations)
        window.alert(
          `Some edits are outside the allowed range (${MAX_TABLE_ROWS}x${MAX_TABLE_COLS}). ` +
            `Please move data inside the allowed area before applying.`
        )
        return
      }
    }
    componentState.onApply?.(sheets, { selectionOnly: applySelectionOnly, selection })
  }

  // Helper for selection extraction
  function getSelectionRange() {
    const sel = methods?.getSelectionCoordinates?.() || methods?.getSelection?.()
    if (!sel) return null
    const range = Array.isArray(sel) ? sel[0] : sel
    // Normalized check for various spreadsheet engine coordinate formats
    const r = range?.row ?? range?.rowIndex ?? range?.r
    const c = range?.column ?? range?.col ?? range?.c
    return Array.isArray(r) && Array.isArray(c) ? { row: r, column: c } : null
  }

  function getOutOfRangeCells(sheet: any): Set<string> {
    const violations = new Set<string>()
    if (Array.isArray(sheet?.data)) {
      sheet.data.forEach((row: any, r: number) => {
        if (!Array.isArray(row)) return
        row.forEach((cell: any, c: number) => {
          if (r < MAX_TABLE_ROWS && c < MAX_TABLE_COLS) return
          const value = cell && typeof cell === 'object' && 'v' in cell ? cell.v : cell
          if (value == null || String(value).trim() === '') return
          violations.add(`${r}:${c}`)
        })
      })
      return violations
    }
    const celldata = sheet?.celldata || []
    celldata.forEach((cell: any) => {
      const r = Number(cell?.r)
      const c = Number(cell?.c)
      if (r < MAX_TABLE_ROWS && c < MAX_TABLE_COLS) return
      const v = cell?.v
      const value = v && typeof v === 'object' && 'v' in v ? v.v : v
      if (value == null || String(value).trim() === '') return
      violations.add(`${r}:${c}`)
    })
    return violations
  }

  function highlightOutOfRange(violations: Set<string>) {
    if (!methods) return
    clearOutOfRange()
    const next = new Set<string>()
    violations.forEach((key) => {
      const [r, c] = key.split(':').map(Number)
      methods.setCellFormatByRange?.('bg', '#7f1d1d', { row: [r, r], column: [c, c] })
      methods.setCellFormatByRange?.('fc', '#ffffff', { row: [r, r], column: [c, c] })
      next.add(key)
    })
    outOfRangeCells = next
  }
</script>

{#if componentState.open}
  <div
    class="excel-modal-backdrop"
    onclick={() => componentState.onClose?.() || closeTableExcelView()}
  >
    <div class="excel-modal" onclick={(e) => e.stopPropagation()}>
      <div class="excel-modal-header">
        <div class="excel-modal-title">
          <i class="ph-light ph-table"></i>
          <span>{componentState.title}</span>
          <span class="excel-chip">{$_('Sandbox')}</span>
        </div>
        <div class="excel-modal-actions">
          <button class="excel-btn ghost" onclick={togglePreview}>
            <i class="ph-light ph-highlighter"></i>
            {previewOn ? 'Hide' : 'Preview'}
          </button>
          <label class="excel-toggle">
            <input type="checkbox" bind:checked={applySelectionOnly} />
            <span>{$_('Apply selection only')}</span>
          </label>
          <button class="excel-btn ghost" onclick={() => componentState.onReload?.()}>
            <i class="ph-light ph-arrows-clockwise"></i>{$_('Reload')}</button
          >
          <button class="excel-btn ghost" onclick={() => componentState.onClose?.()}>
            <i class="ph-light ph-x"></i>{$_('Close')}</button
          >
          <button class="excel-btn primary" onclick={applyChanges}>
            <i class="ph-light ph-check"></i>{$_('Apply Changes')}</button
          >
        </div>
      </div>

      <div class="excel-modal-body">
        <SpreadsheetEditorWidget
          __src={componentState.rootPath}
          __sheetName={componentState.activeSheetName}
          __disableCollab={true}
          __maxPageHeight={520}
          __maxPageWidth={960}
          __spreadsheetHeight={520}
          __spreadsheetWidth={960}
        />
      </div>
    </div>
  </div>
{/if}

<style>
  .excel-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(10, 10, 10, 0.6);
    backdrop-filter: blur(6px);
    z-index: 10050;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: modalFade 140ms ease-out;
  }

  .excel-modal {
    width: min(1200px, 94vw);
    height: min(720px, 90vh);
    background: #111;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 30px 120px rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    animation: modalSlide 180ms ease-out;
  }

  .excel-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: linear-gradient(180deg, rgba(22, 22, 22, 0.98), rgba(18, 18, 18, 0.92));
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .excel-modal-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #e2e2e2;
  }

  .excel-chip {
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    background: rgba(0, 190, 172, 0.16);
    color: #66f0e0;
    border: 1px solid rgba(0, 190, 172, 0.35);
    padding: 2px 6px;
    border-radius: 10px;
  }

  .excel-modal-actions {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .excel-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid transparent;
    cursor: pointer;
  }

  .excel-btn.ghost {
    background: rgba(255, 255, 255, 0.04);
    color: #d6d6d6;
    border-color: rgba(255, 255, 255, 0.08);
  }

  .excel-btn.primary {
    background: var(--color-base-300);
    color: #0e0e0e;
    font-weight: 700;
  }

  .excel-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #cfcfcf;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 4px 8px;
    border-radius: 8px;
  }

  .excel-modal-body {
    flex: 1;
    padding: 12px;
    overflow: hidden;
    background: #0f0f0f;
  }

  @keyframes modalFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes modalSlide {
    from {
      transform: translateY(12px);
      opacity: 0.9;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>
