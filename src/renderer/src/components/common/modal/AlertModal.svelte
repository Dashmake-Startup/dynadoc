<script lang="ts">
  import { _$_alertModal } from '../../../stores/alertModal.store'
  import { isOverlayMode, sendOverlayAction } from '../../../utils/overlayBridge'
  import { _ } from 'svelte-i18n'

  const modal = _$_alertModal
  const overlay = isOverlayMode()

  function close() {
    if (overlay) {
      sendOverlayAction('alert', 'close')
      return
    }
    _$_alertModal.close()
  }

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) close()
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Enter') {
      event.preventDefault()
      close()
    }
  }
</script>

{#if $modal.open}
  <div
    class="modal-shell fixed inset-0 z-[1400] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    onclick={onBackdropClick}
    onkeydown={onKeydown}
    role="dialog"
    aria-modal="true"
    aria-label={$modal.title || $_('Notice')}
  >
    <div
      class="modal-card w-full max-w-[420px] bg-[#1e1e1e] border border-white/10 rounded-xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
    >
      <h3 class="text-base-content text-lg font-600 mb-2">{$modal.title || $_('Notice')}</h3>
      <p class="text-base-content/60 text-[12px] mb-5 whitespace-pre-wrap">
        {$modal.message || ''}
      </p>

      <div class="flex justify-end">
        <button
          onclick={close}
          class="px-4 py-2 bg-base-300 rounded-md text-[11px] text-base-content font-700 hover:bg-base-300/10"
        >
          {$modal.confirmText || $_('OK')}
        </button>
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
      max-width: 100%;
      width: 100%;
      border-radius: 16px 16px 0 0;
    }
  }
</style>
