<script lang="ts">
  import Utils from '../../../utils/Utils'
  import { _$_spreadsheetExportModal } from '../../../stores/spreadsheetExportModal.store'
  import { _ } from 'svelte-i18n'

  const modal = _$_spreadsheetExportModal

  let scope = $state<'current' | 'all' | 'selected'>('current')
  let fileType = $state<Utils.OFFICE_EXTENSIONS_FORMAT.excel | 'csv'>(Utils.OFFICE_EXTENSIONS_FORMAT.excel)
  let selectedSheetIds = $state<string[]>([])
  let openAfterExport = $state(false)
  let revealAfterExport = $state(true)

  $effect(() => {
    if ($modal.open) {
      scope = $modal.defaultScope || 'current'
      fileType = $modal.defaultFileType || Utils.OFFICE_EXTENSIONS_FORMAT.excel
      selectedSheetIds = ($modal.sheets || []).map((sheet) => sheet.id)
      openAfterExport = false
      revealAfterExport = true
    }
  })

  const sheets = $derived.by(() => $modal.sheets || [])
  const selectedCount = $derived.by(() => selectedSheetIds.length)
  const hasMultipleSelected = $derived.by(() => selectedSheetIds.length > 1)
  const selectionEmpty = $derived.by(() => scope === 'selected' && selectedSheetIds.length === 0)
  const csvInvalid = $derived.by(() => fileType === 'csv' && (scope === 'all' || hasMultipleSelected))

  function toggleSheet(id: string) {
    if (selectedSheetIds.includes(id)) {
      selectedSheetIds = selectedSheetIds.filter((entry) => entry !== id)
    } else {
      selectedSheetIds = [...selectedSheetIds, id]
    }
  }

  function confirm() {
    if (csvInvalid || selectionEmpty) return
    _$_spreadsheetExportModal.confirm({
      scope,
      fileType,
      selectedSheetIds,
      openAfterExport,
      revealAfterExport
    })
  }
</script>

{#if $modal.open}
  <div class="modal-shell fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center">
    <div
      class="modal-card w-[540px] bg-base-100 text-base-content rounded-lg border border-white/10 shadow-2xl p-6"
      role="dialog"
      aria-modal="true"
      aria-label={$_('Export Spreadsheet')}
    >
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold">{$_('Export Spreadsheet')}</h3>
          <p class="text-[11px] text-base-content/50">
            {$modal.documentName || $_('Active document')} • {sheets.length} {$_('sheet(s)')}
          </p>
        </div>
        <button class="btn btn-sm btn-ghost text-base-content/60" on:click={() => _$_spreadsheetExportModal.cancel()}>
          <i class="ph-light ph-x"></i>
        </button>
      </div>

      <div class="space-y-4">
        <div>
          <div class="text-[11px] uppercase tracking-widest text-base-content/40 mb-2">{$_('Scope')}</div>
          <div class="grid grid-cols-3 gap-2">
            <button
              class="btn btn-sm"
              class:btn-primary={scope === 'current'}
              class:btn-ghost={scope !== 'current'}
              on:click={() => (scope = 'current')}
            >
              {$_('Current sheet')}
            </button>
            <button
              class="btn btn-sm"
              class:btn-primary={scope === 'all'}
              class:btn-ghost={scope !== 'all'}
              on:click={() => (scope = 'all')}
            >
              {$_('All sheets')}
            </button>
            <button
              class="btn btn-sm"
              class:btn-primary={scope === 'selected'}
              class:btn-ghost={scope !== 'selected'}
              on:click={() => (scope = 'selected')}
            >
              {$_('Selected')}
            </button>
          </div>
        </div>

        {#if scope === 'selected'}
          <div class="bg-base-800/60 rounded-lg border border-white/10 max-h-40 overflow-y-auto">
            {#each sheets as sheet}
              <label class="flex items-center gap-2 px-3 py-2 text-[12px] border-b border-white/5 last:border-b-0">
                <input
                  type="checkbox"
                  class="checkbox checkbox-xs"
                  checked={selectedSheetIds.includes(sheet.id)}
                  on:change={() => toggleSheet(sheet.id)}
                />
                <span>{sheet.name}</span>
              </label>
            {/each}
          </div>
          <div class="text-[10px] text-base-content/40">
            {selectedCount} {$_('selected')}
          </div>
        {/if}

        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="text-[11px] uppercase tracking-widest text-base-content/40 mb-2">{$_('Format')}</div>
            <div class="grid grid-cols-2 gap-2">
              <button
                class="btn btn-sm"
                class:btn-primary={fileType === Utils.OFFICE_EXTENSIONS_FORMAT.excel}
                class:btn-ghost={fileType !== Utils.OFFICE_EXTENSIONS_FORMAT.excel}
                on:click={() => (fileType = Utils.OFFICE_EXTENSIONS_FORMAT.excel)}
              >
                Excel
              </button>
              <button
                class="btn btn-sm"
                class:btn-primary={fileType === 'csv'}
                class:btn-ghost={fileType !== 'csv'}
                on:click={() => (fileType = 'csv')}
              >
                CSV
              </button>
            </div>
          </div>

          <div>
            <div class="text-[11px] uppercase tracking-widest text-base-content/40 mb-2">{$_('After export')}</div>
            <div class="flex flex-col gap-2 text-[12px]">
              <label class="flex items-center gap-2">
                <input type="checkbox" class="checkbox checkbox-xs" bind:checked={revealAfterExport} />
                {$_('Show in folder')}
              </label>
              <label class="flex items-center gap-2">
                <input type="checkbox" class="checkbox checkbox-xs" bind:checked={openAfterExport} />
                {$_('Open file')}
              </label>
            </div>
          </div>
        </div>

        {#if csvInvalid}
          <div class="text-[10px] text-warning/80">
            {$_('CSV can only export one worksheet. Pick a single sheet or switch to Excel format.')}
          </div>
        {/if}
        {#if selectionEmpty}
          <div class="text-[10px] text-warning/80">
            {$_('Select at least one worksheet to export.')}
          </div>
        {/if}
      </div>

      <div class="mt-6 flex items-center justify-between">
        <div class="text-[10px] text-base-content/40">
          {$_('Exports preserve formatting, formulas, and column widths where possible.')}
        </div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-ghost" on:click={() => _$_spreadsheetExportModal.cancel()}>
            {$_('Cancel')}
          </button>
          <button class="btn btn-sm btn-primary" disabled={csvInvalid || selectionEmpty} on:click={confirm}>
            {$_('Export')}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  @media (max-width: 768px) {
    .modal-shell {
      align-items: flex-end;
      padding-bottom: env(safe-area-inset-bottom);
    }
    .modal-card {
      width: 100%;
      border-radius: 16px 16px 0 0;
    }
  }
</style>
