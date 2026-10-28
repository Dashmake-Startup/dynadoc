<script lang="ts">
  import { _$_folderStructureModal } from '../../../stores/folderStructureModal.store'
  import { _ } from 'svelte-i18n'
  import TreeView from '../react/treeView/TreeView.svelte'

  const modal = _$_folderStructureModal

  function close() {
    _$_folderStructureModal.close()
  }
</script>

{#if $modal.open}
  <div
    class="modal-shell fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    role="dialog"
    aria-modal="true"
  >
    <div
      class="modal-card w-full max-w-[800px] max-h-[85vh] bg-[#1e1e1e] border border-white/10 rounded-xl flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
    >
      <div class="flex items-start justify-between gap-4 p-6 border-b border-white/5">
        <div>
          <h3 class="text-base-content text-lg font-700">{$modal.name || $_('Folder Structure')}</h3>
          <p class="text-base-content/50 text-[11px]">
            {$modal.path}
          </p>
        </div>
        <button onclick={close} class="text-base-content/50 hover:text-base-content text-sm">
          <i class="ph-bold ph-x"></i>
        </button>
      </div>

      <div class="flex-1 overflow-auto p-4 min-h-[400px]">
        <TreeView
          __rootPath={$modal.path}
          __sourceType="drive"
          __accountOrg={$modal.accountOrg || ''}
          __openOnSelect={true}
        />
      </div>

      <div class="flex justify-end gap-2 p-6 border-t border-white/5">
        <button
          onclick={close}
          class="px-6 py-2 bg-base-300 rounded-md text-[12px] text-base-content font-700 hover:bg-base-300/80 transition-colors"
        >
          {$_('Done')}
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
      max-height: 90vh;
    }
  }
</style>
