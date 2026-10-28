<script lang="ts">
  import { _$_sealOptionsModal } from '../../../stores/sealOptionsModal.store'
  import { _ } from 'svelte-i18n'

  const modal = _$_sealOptionsModal

  let require2fa = $state(false)

  function confirm() {
    const options = { require2fa }
    require2fa = false
    _$_sealOptionsModal.confirm(options)
  }

  function cancel() {
    require2fa = false
    _$_sealOptionsModal.cancel()
  }

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) cancel()
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
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
    aria-label={$_('Seal the document')}
  >
    <div class="modal-card w-full max-w-[440px] rounded-xl p-6 animate-in zoom-in-95 duration-200">
      <h3 class="modal-title">🔒 {$_('Seal the document')}</h3>
      {#if $modal.fileName}
        <p class="modal-message">{$modal.fileName}</p>
      {/if}

      <label class="option">
        <input type="checkbox" bind:checked={require2fa} />
        <span>
          <strong>{$_('Require a verification to open')}</strong>
          <small>
            {$_('The recipient will confirm a code sent by email before reading the document.')}
          </small>
        </span>
      </label>

      <div class="flex justify-end gap-2 mt-4">
        <button onclick={cancel} class="modal-button modal-button-ghost">
          {$_('Cancel')}
        </button>
        <button
          onclick={confirm}
          class="modal-button modal-button-solid text-base-content bg-base-300 hover:opacity-90"
        >
          {$_('Seal')}
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
    margin-bottom: 1rem;
  }

  .option {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    cursor: pointer;
    padding: 0.6rem;
    border-radius: 0.5rem;
    border: 1px solid var(--theme-border-subtle);
    background: var(--theme-elevated);
  }

  .option input {
    margin-top: 2px;
    accent-color: #2a4a67;
  }

  .option strong {
    display: block;
    color: var(--theme-text-1);
    font-size: 12px;
    font-weight: 600;
  }

  .option small {
    display: block;
    color: color-mix(in srgb, var(--theme-text-1) 60%, transparent);
    font-size: 11px;
    margin-top: 2px;
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
