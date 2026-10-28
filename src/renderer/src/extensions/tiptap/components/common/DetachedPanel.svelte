<script lang="ts">
  import { _ } from 'svelte-i18n'

  // Svelte 5 syntax for snippets
  let { title, children } = $props()
  
  let modalRef: HTMLDialogElement = $state()
  let isExpanded = $state(false) // Tracking state for teleportation logic

  function openModal() {
    isExpanded = true
    modalRef.showModal()
  }

  function handleClose() {
    isExpanded = false
  }
</script>

<div class="relative group h-full flex flex-col">
  <div class="flex-grow overflow-hidden">
    {#if !isExpanded}
      {@render children?.()}
    {/if}
  </div>

  <div class="absolute left-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-300">
    <button
      class="btn btn-xs btn-square bg-base-200 hover:bg-primary bg-base-400 text-base-content shadow-xl"
      onclick={openModal}
      title={$_('Expand to Dialog')}
    >
      <i class="ph-light ph-arrows-out text-base"></i>
    </button>
  </div>

  <dialog bind:this={modalRef} class="modal" onclose={handleClose}>
    <div
      class="modal-box w-11/12 max-w-6xl h-[85vh] p-0 overflow-hidden flex flex-col bg-base-200 border border-[#444] shadow-2xl rounded-md"
    >
      <div
        class="flex items-center justify-between px-4 py-2 bg-base-200 border-b bg-base-400"
      >
        <div class="flex items-center gap-2">
          <i class="ph-light ph-table text-primary text-lg"></i>
          <h3 class="text-[11px] font-bold uppercase tracking-widest text-[#e1e1e1]">
            {title} — {$_('Expanded View')}
          </h3>
        </div>
        <form method="dialog">
          <button
            class="btn btn-sm btn-ghost btn-circle text-[#959595] hover:text-base-content hover:bg-red-600 transition-colors"
          >
            <i class="ph-light ph-x text-lg"></i>
          </button>
        </form>
      </div>

      <div class="flex-grow overflow-hidden bg-base-100">
        {#if isExpanded}
          {@render children?.()}
        {/if}
      </div>
    </div>

    <form method="dialog" class="modal-backdrop bg-black/70 backdrop-blur-sm">
      <button>{$_('close')}</button>
    </form>
  </dialog>
</div>

<style>
  /* Custom scrollbar to match the sidebar in the modal view */
  :global(.modal-box::-webkit-scrollbar) {
    width: 8px;
    height: 8px;
  }
  :global(.modal-box::-webkit-scrollbar-thumb) {
    background: #444;
    border-radius: 4px;
  }
</style>