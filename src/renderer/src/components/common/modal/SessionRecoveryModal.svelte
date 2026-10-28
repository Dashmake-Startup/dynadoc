<script lang="ts">
  import { onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { _$_documentEditorsList } from '../../../stores/editor.store'
  import EditorHelpers from '../../../utils/EditorHelpers'
  import EditorCommonUtils from '../../../utils/common.utils'
  import { _$_sessionRecovery } from '../../../stores/sessionRecovery.store'

  let isOpen = $state(false)
  let hasPrompted = $state(false)
  let manualToken = $state(0)

  const unsavedEditors = $derived.by(() =>
    ($_$_documentEditorsList ?? []).filter((entry) => entry?.document?.isUnsavedDocument?.())
  )

  const openIds = $derived.by(() =>
    new Set(
      ($_$_documentEditorsList ?? []).map(
        (entry) => entry?.uuid || entry?.id || entry?.document?.uuid
      )
    )
  )

  const recoveryCandidates = $derived.by(() =>
    unsavedEditors.filter((entry) => {
      const id = entry?.uuid || entry?.id || entry?.document?.uuid
      return id ? !openIds.has(id) : true
    })
  )

  onMount(() => {
    const alreadyPrompted = sessionStorage.getItem('dynadoc:session-recovery-shown')
    if (!alreadyPrompted && recoveryCandidates.length > 0) {
      isOpen = true
      hasPrompted = true
      sessionStorage.setItem('dynadoc:session-recovery-shown', '1')
    }
  })

  $effect(() => {
    if (hasPrompted) return
    if (recoveryCandidates.length > 0) {
      isOpen = true
      hasPrompted = true
      sessionStorage.setItem('dynadoc:session-recovery-shown', '1')
    }
  })

  $effect(() => {
    const state = $_$_sessionRecovery
    if (!state?.open) return
    manualToken = state.token
    isOpen = true
  })

  async function handleSaveAll() {
    await EditorCommonUtils.saveAllUnsavedDocuments()
    isOpen = false
    _$_sessionRecovery.close()
  }

  async function handleOpenAndSave(editorId: string) {
    _$_documentEditorsList.setActive(editorId)
    const editor = _$_documentEditorsList.getItem(editorId)
    if (!editor) return
    await EditorHelpers.saveDocumentEditor(editor, { saveAs: true })
  }

  function close() {
    isOpen = false
    _$_sessionRecovery.close()
  }
</script>

{#if isOpen}
  <div class="modal-shell fixed inset-0 z-[1185] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" role="dialog" aria-modal="true" aria-label={$_('Session recovery')}>
    <div class="modal-card w-full max-w-[560px] bg-[#1e1e1e] border border-white/10 rounded-xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
      <h3 class="text-base-content text-lg font-600 mb-2">{$_('Recover unsaved work')}</h3>
      <p class="text-base-content/60 text-[12px] mb-5 whitespace-pre-wrap">
        {$_('We found unsaved documents from your last session. Save them now or keep working and save later.')}
      </p>

      <div class="max-h-[240px] overflow-auto border border-white/5 rounded-lg mb-5">
        {#if recoveryCandidates.length === 0}
          <div class="px-3 py-6 text-[12px] text-base-content/60 text-center">
            {$_('No additional unsaved sessions were found.')}
          </div>
        {:else}
          {#each recoveryCandidates as editor (editor.uuid || editor.id)}
            <div class="flex items-center justify-between px-3 py-2 border-b border-white/5 last:border-b-0">
              <div class="text-[12px] text-base-content/80 truncate">
                {editor.document?.name || $_('Untitled')}
              </div>
              <div class="flex items-center gap-2">
                <button
                  class="px-2 py-1 rounded-md text-[10px] uppercase tracking-[0.2em] bg-blue-600/20 text-blue-300 hover:bg-blue-600/30"
                  onclick={() => handleOpenAndSave(editor.uuid || editor.id)}
                >
                  {$_('Open & Save')}
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <div class="flex justify-between items-center">
        <button
          class="px-4 py-2 text-[11px] text-base-content/60 hover:text-base-content transition-colors"
          onclick={close}
        >
          {$_('Dismiss')}
        </button>
        <button
          class="px-4 py-2 rounded-md text-[11px] text-base-content font-700 bg-emerald-600 hover:bg-emerald-700"
          onclick={handleSaveAll}
        >
          {$_('Save All Now')}
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
