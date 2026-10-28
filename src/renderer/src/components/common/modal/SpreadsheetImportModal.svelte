<script lang="ts">
  import { _$_spreadsheetImportModal } from '../../../stores/spreadsheetImportModal.store'
  import { _ } from 'svelte-i18n'

  const modal = _$_spreadsheetImportModal

  let mode = $state<'replaceAll' | 'replaceCurrent' | 'append'>('replaceAll')

  $effect(() => {
    if ($modal.open) {
      mode = 'replaceAll'
    }
  })

  function confirm() {
    _$_spreadsheetImportModal.confirm({ mode })
  }
</script>

{#if $modal.open}
  <div class="modal-shell fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center">
    <div
      class="modal-card w-[520px] bg-base-100 text-base-content rounded-lg border border-white/10 shadow-2xl p-6"
      role="dialog"
      aria-modal="true"
      aria-label={$_('Import Spreadsheet')}
    >
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold">{$_('Import Spreadsheet')}</h3>
          <p class="text-[11px] text-base-content/50">
            {$modal.fileName || $_('Selected file')}
          </p>
        </div>
        <button class="btn btn-sm btn-ghost text-base-content/60" on:click={() => _$_spreadsheetImportModal.cancel()}>
          <i class="ph-light ph-x"></i>
        </button>
      </div>

      <div class="space-y-4">
        <div class="text-[11px] uppercase tracking-widest text-base-content/40">{$_('Import mode')}</div>
        <div class="flex flex-col gap-2">
          <button
            class="btn btn-sm justify-start"
            class:btn-primary={mode === 'replaceAll'}
            class:btn-ghost={mode !== 'replaceAll'}
            on:click={() => (mode = 'replaceAll')}
          >
            {$_('Replace all worksheets')}
          </button>
          <button
            class="btn btn-sm justify-start"
            class:btn-primary={mode === 'replaceCurrent'}
            class:btn-ghost={mode !== 'replaceCurrent'}
            on:click={() => (mode = 'replaceCurrent')}
          >
            {$_('Replace current worksheet')}
          </button>
          <button
            class="btn btn-sm justify-start"
            class:btn-primary={mode === 'append'}
            class:btn-ghost={mode !== 'append'}
            on:click={() => (mode = 'append')}
          >
            {$_('Append as new worksheets')}
          </button>
        </div>

        <div class="text-[10px] text-base-content/40">
          {$_('We keep formatting, merged cells, and formulas when the source supports them.')}
        </div>
      </div>

      <div class="mt-6 flex items-center justify-between">
        <div class="text-[10px] text-base-content/40">
          {$_('Tip: append lets you bring multiple files into a single workbook.')}
        </div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-ghost" on:click={() => _$_spreadsheetImportModal.cancel()}>
            {$_('Cancel')}
          </button>
          <button class="btn btn-sm btn-primary" on:click={confirm}>
            {$_('Import')}
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
