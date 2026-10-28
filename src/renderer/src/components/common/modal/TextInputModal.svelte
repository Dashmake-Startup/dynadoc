<script lang="ts">
  import { _$_textInputModal } from '../../../stores/textInputModal.store'
  import { isOverlayMode, sendOverlayAction } from '../../../utils/overlayBridge'
  import { _ } from 'svelte-i18n'

  const modal = _$_textInputModal
  const overlay = isOverlayMode()
  let value = ''

  $effect(() => {
    if ($modal.open) {
      value = $modal.defaultValue || ''
    }
  })

  function submit() {
    if (overlay) {
      sendOverlayAction('textInput', 'confirm', value.trim())
      return
    }
    _$_textInputModal.confirm(value.trim())
  }

  function close() {
    if (overlay) {
      sendOverlayAction('textInput', 'cancel')
      return
    }
    _$_textInputModal.cancel()
  }

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) close()
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }

    if (!$modal.multiline && event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  }
</script>

{#if $modal.open}
  <div
    class="modal-shell fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    onclick={onBackdropClick}
    onkeydown={onKeydown}
    role="dialog"
    aria-modal="true"
    aria-label={$modal.title || $_('Input')}
  >
    <div
      class="modal-card w-full max-w-[420px] bg-[#1e1e1e] border border-white/10 rounded-xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
    >
      <h3 class="text-base-content text-lg font-600 mb-1">{$modal.title || $_('Input required')}</h3>
      {#if $modal.message}
        <p class="text-base-content/50 text-[11px] mb-4">{$modal.message}</p>
      {/if}

      {#if $modal.multiline}
        <textarea
          bind:value
          rows={$modal.rows || 4}
          placeholder={$modal.placeholder || ''}
          class="w-full bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 rounded-md py-2 px-3 text-base-content text-[13px] focus:outline-none focus:border-base-300 mb-4 resize-y"
        ></textarea>
      {:else}
        <input
          bind:value
          placeholder={$modal.placeholder || ''}
          class="w-full bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 rounded-md py-2 px-3 text-base-content text-[13px] focus:outline-none focus:border-base-300 mb-4"
        />
      {/if}

      <div class="flex justify-end gap-2">
        <button
          onclick={close}
          class="px-4 py-2 text-[11px] text-base-content/70 hover:text-base-content transition-colors"
        >
          {$modal.cancelText || $_('Cancel')}
        </button>
        <button
          onclick={submit}
          class="px-4 py-2 bg-base-300 rounded-md text-[11px] text-base-content font-700 hover:bg-base-300/10"
        >
          {$modal.confirmText || $_('Confirm')}
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
    .modal-card input {
      font-size: 14px;
    }
  }
</style>
