<script lang="ts">
  import { _$_confirmModal } from '../../../stores/confirmModal.store'
  import { isOverlayMode, sendOverlayAction } from '../../../utils/overlayBridge'
  import { _ } from 'svelte-i18n'

  const modal = _$_confirmModal
  const overlay = isOverlayMode()

  function accept() {
    if (overlay) {
      sendOverlayAction('confirm', 'confirm')
      return
    }
    _$_confirmModal.confirm()
  }

  function decline() {
    if (overlay) {
      sendOverlayAction('confirm', 'cancel')
      return
    }
    _$_confirmModal.cancel()
  }

  async function handleExtraAction() {
    if (overlay) {
      sendOverlayAction('confirm', 'extra')
      return
    }
    await _$_confirmModal.runExtraAction()
  }

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) decline()
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      decline()
    }
  }
</script>

{#if $modal.open}
  <div
    class="modal-shell fixed inset-0 z-[1190] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    onclick={onBackdropClick}
    onkeydown={onKeydown}
    role="dialog"
    aria-modal="true"
    aria-label={$modal.title || $_('Confirmation')}
  >
    <div
      class="modal-card w-full max-w-[440px] rounded-xl p-6 animate-in zoom-in-95 duration-200"
    >
      <h3 class="modal-title">{$modal.title || $_('Please confirm')}</h3>
      <p class="modal-message">
        {$modal.message || $_('Are you sure you want to continue?')}
      </p>

      <div class="flex justify-end gap-2">
        <button
          onclick={decline}
          class="modal-button modal-button-ghost"
        >
          {$modal.cancelText || $_('Cancel')}
        </button>
        {#if $modal.extraActionText}
          <button
            onclick={handleExtraAction}
            class="modal-button modal-button-solid text-base-content {($modal.extraActionDestructive
              ? 'bg-amber-600 hover:bg-amber-700'
              : 'bg-blue-600 hover:bg-blue-700')}"
          >
            {$modal.extraActionText}
          </button>
        {/if}
        <button
          onclick={accept}
          class="modal-button modal-button-solid text-base-content {($modal.destructive
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-base-300 hover:opacity-90')}"
        >
          {$modal.confirmText || $_('Confirm')}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-card {
    background: var(--theme-surface-1);
    border: 1px solid var(--theme-border-subtle);
    box-shadow: var(--theme-popover-shadow);
  }

  .modal-title {
    color: var(--theme-text-1);
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .modal-message {
    color: color-mix(in srgb, var(--theme-text-1) 64%, transparent);
    font-size: 12px;
    margin-bottom: 1.25rem;
    white-space: pre-wrap;
  }

  .modal-button {
    padding: 0.5rem 1rem;
    font-size: 11px;
    font-weight: 700;
    border-radius: 0.5rem;
    transition:
      background 150ms ease,
      color 150ms ease,
      transform 150ms ease;
  }

  .modal-button:hover {
    transform: translateY(-1px);
  }

  .modal-button-ghost {
    color: color-mix(in srgb, var(--theme-text-1) 72%, transparent);
  }

  .modal-button-ghost:hover {
    color: var(--theme-text-1);
    background: var(--theme-elevated);
  }

  .modal-button-solid {
    box-shadow: 0 10px 24px -18px rgba(15, 23, 42, 0.7);
  }

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
