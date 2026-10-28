<script lang="ts">
  import { _$_exportUpdateModal } from '../../../stores/exportUpdateModal.store'
  import { _ } from 'svelte-i18n'
  const modal = _$_exportUpdateModal
  let rememberChoice = $state(false)

  $effect(() => {
    if (!modal.open) rememberChoice = false
  })
</script>

{#if $modal.open}
  <div class="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center">
    <div class="bg-base-200 border border-white/10 rounded-lg shadow-xl w-[420px] max-w-[90vw] p-5">
      <div class="text-sm font-semibold mb-2">{$_('Update exported files?')}</div>
      <div class="text-xs opacity-70 leading-relaxed mb-4">
        This document was exported before the latest save. Update {$modal.count} exported file(s)?
        {#if $modal.samplePath}
          <div class="mt-2 text-[10px] font-mono opacity-60 truncate">
            Example: {$modal.samplePath}
          </div>
        {/if}
      </div>

      <label class="flex items-center gap-2 text-[11px] mb-4">
        <input type="checkbox" bind:checked={rememberChoice} />{$_(
          'Remember my choice for future exports'
        )}</label
      >

      <div class="flex items-center justify-end gap-2">
        <button
          class="btn btn-sm btn-ghost text-base-content/60"
          on:click={() => _$_exportUpdateModal.cancel()}
        >
          Cancel
        </button>
        <button
          class="btn btn-sm btn-ghost"
          on:click={() => _$_exportUpdateModal.confirm('new', rememberChoice)}
        >
          Export New
        </button>
        <button
          class="btn btn-sm btn-primary"
          on:click={() => _$_exportUpdateModal.confirm('overwrite', rememberChoice)}
        >
          Override Existing
        </button>
      </div>
    </div>
  </div>
{/if}
