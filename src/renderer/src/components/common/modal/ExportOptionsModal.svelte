<script lang="ts">
  import { _$_exportOptionsModal } from '../../../stores/exportOptionsModal.store'
  import { isOverlayMode, sendOverlayAction } from '../../../utils/overlayBridge'
  import { _ } from 'svelte-i18n'
  import { get } from 'svelte/store'

  const modal = _$_exportOptionsModal
  const overlay = isOverlayMode()

  let preset = $state<'web' | 'print' | 'high'>('print')
  let selectionOnly = $state(false)
  let pageRanges = $state('')
  let watermarkEnabled = $state(false)
  let watermarkText = $state('')
  let pictureFormat = $state<'png' | 'jpeg'>('png')

  $effect(() => {
    if ($modal.open) {
      preset = $modal.defaultPreset || 'print'
      selectionOnly = false
      pageRanges = ''
      watermarkEnabled = Boolean($modal.isSecured)
      const t = get(_)
      watermarkText = $modal.documentName ? `${$modal.documentName} • ${t('Secured')}` : t('Secured')
      pictureFormat = 'png'
    }
  })

  function confirm() {
    const payload = {
      target: $modal.target,
      preset,
      selectionOnly,
      pageRanges: selectionOnly ? '' : pageRanges,
      watermarkEnabled,
      watermarkText: watermarkEnabled ? watermarkText.trim() : '',
      pictureFormat
    }
    if (overlay) {
      sendOverlayAction('exportOptions', 'confirm', payload)
      return
    }
    _$_exportOptionsModal.confirm(payload)
  }
</script>

{#if $modal.open}
  <div class="modal-shell fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center">
    <div
      class="modal-card w-[520px] bg-base-100 text-base-content rounded-lg border border-white/10 shadow-2xl p-6"
      role="dialog"
      aria-modal="true"
      aria-label={$modal.title || $_('Export Options')}
    >
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold">
            {$modal.title || ($modal.target === 'print' ? $_('Print') : $_('Export'))}
          </h3>
          <p class="text-[11px] text-base-content/50">
            {$modal.documentName || $_('Active document')} • {$modal.target.toUpperCase()}
          </p>
        </div>
        <button
          class="btn btn-sm btn-ghost text-base-content/60"
          on:click={() => {
            if (overlay) {
              sendOverlayAction('exportOptions', 'cancel')
            } else {
              _$_exportOptionsModal.cancel()
            }
          }}
        >
          <i class="ph-light ph-x"></i>
        </button>
      </div>

      <div class="space-y-4">
        <div>
          <div class="text-[11px] uppercase tracking-widest text-base-content/40 mb-2">{$_('Preset')}</div>
          <div class="grid grid-cols-3 gap-2">
            <button
              class="btn btn-sm"
              class:btn-primary={preset === 'web'}
              class:btn-ghost={preset !== 'web'}
              on:click={() => (preset = 'web')}
            >
              {$_('Web')}
            </button>
            <button
              class="btn btn-sm"
              class:btn-primary={preset === 'print'}
              class:btn-ghost={preset !== 'print'}
              on:click={() => (preset = 'print')}
            >
              {$_('Print')}
            </button>
            <button
              class="btn btn-sm"
              class:btn-primary={preset === 'high'}
              class:btn-ghost={preset !== 'high'}
              on:click={() => (preset = 'high')}
            >
              {$_('High-Res')}
            </button>
          </div>
        </div>

        {#if $modal.target !== 'picture'}
          <div class="grid grid-cols-2 gap-4">
            <label class="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                class="checkbox checkbox-xs"
                bind:checked={selectionOnly}
                disabled={!$modal.selectionAvailable}
              />
              {$_('Selection only')}
            </label>
            <label class="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                class="checkbox checkbox-xs"
                bind:checked={watermarkEnabled}
                disabled={$modal.isSecured}
              />
              {$_('Watermark')}
            </label>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-[11px] text-base-content/50 mb-1">{$_('Page ranges')}</div>
              <input
                class="input input-sm input-bordered w-full bg-base-800 text-base-content"
                placeholder={$_('1-3,5')}
                bind:value={pageRanges}
                disabled={selectionOnly}
              />
            </div>
            <div>
              <div class="text-[11px] text-base-content/50 mb-1">{$_('Watermark text')}</div>
              <input
                class="input input-sm input-bordered w-full bg-base-800 text-base-content"
                placeholder={$_('Confidential')}
                bind:value={watermarkText}
                disabled={!watermarkEnabled && !$modal.isSecured}
              />
            </div>
          </div>
          {#if $modal.isSecured}
            <div class="text-[10px] text-warning/80">
              {$_('Secured documents always include a watermark.')}
            </div>
          {/if}
        {:else}
          <div class="grid grid-cols-2 gap-4">
            <label class="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                class="checkbox checkbox-xs"
                bind:checked={watermarkEnabled}
                disabled={$modal.isSecured}
              />
              {$_('Watermark')}
            </label>
            <div>
              <div class="text-[11px] text-base-content/50 mb-1">{$_('Format')}</div>
              <select
                class="select select-sm select-bordered w-full bg-base-800 text-base-content"
                bind:value={pictureFormat}
              >
                <option value="png">{$_('PNG')}</option>
                <option value="jpeg">{$_('JPG')}</option>
              </select>
            </div>
          </div>
          <div>
            <div class="text-[11px] text-base-content/50 mb-1">{$_('Watermark text')}</div>
            <input
              class="input input-sm input-bordered w-full bg-base-800 text-base-content"
              placeholder={$_('Confidential')}
              bind:value={watermarkText}
              disabled={!watermarkEnabled && !$modal.isSecured}
            />
          </div>
        {/if}
      </div>

      <div class="mt-6 flex items-center justify-between">
        <div class="text-[10px] text-base-content/40">
          {$_('Presets adapt scale and quality for business-grade exports.')}
        </div>
        <div class="flex gap-2">
          <button
            class="btn btn-sm btn-ghost"
            on:click={() => {
              if (overlay) {
                sendOverlayAction('exportOptions', 'cancel')
              } else {
                _$_exportOptionsModal.cancel()
              }
            }}
          >
            {$_('Cancel')}
          </button>
          <button class="btn btn-sm btn-primary" on:click={confirm}>
            {$modal.target === 'print' ? $_('Print') : $_('Export')}
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
