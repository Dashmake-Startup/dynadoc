<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import { get } from 'svelte/store'
  import { authStore } from '../../../stores/auth.store'
  import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../stores/editor.store'
  import { nodeFieldValues, nodeFieldMeta, clearNodeFieldValues, refreshNodeFieldValues } from '../../../extensions/tiptap/CustomFormFieldExtension/stores/field.store'
  import { extractFormSchema, validateFormSubmission, buildFormSubmissionPayload } from '../../../extensions/tiptap/CustomFormFieldExtension/utils/form.utils'
  import { getCurrentUserIdentity } from '../../../services/identity/identity.service'
  import { submitFormResponse } from '../../../services/forms/forms.service'
  import { appendSubmissionHistory } from '../../../extensions/tiptap/CustomFormFieldExtension/stores/submission.store'
  import { loadSubmissionHistory } from '../../../extensions/tiptap/CustomFormFieldExtension/stores/submission.store'

  const activeDocStore = _$_documentEditorsList.getActive()
  const activeWysiwygStore = _$_wysiwygEditorsList.getActive()

  let formSchema = $state({ id: '', fields: [] })
  let isVisible = $state(false)
  let submitError = $state('')
  let submitSuccess = $state('')
  let savingLabel = $state('')
  let refreshTimer: ReturnType<typeof setInterval> | null = null
  let editorUnsub: (() => void) | null = null

  const formConfig = $derived($activeDocStore?.document?.config?.form || {})
  const docUuid = $derived($activeDocStore?.document?.uuid || '')
  const isAuthenticated = $derived($authStore?.authenticated)

  const isClosed = $derived(formConfig?.isOpen === false)
  const requireAuth = $derived(formConfig?.requireAuth === true)
  const allowAnonymous = $derived(formConfig?.allowAnonymous !== false)
  const oneResponsePerUser = $derived(formConfig?.oneResponsePerUser === true)
  const deadlineAt = $derived(formConfig?.deadlineAt ? new Date(formConfig.deadlineAt) : null)
  const isAfterDeadline = $derived(Boolean(deadlineAt && Date.now() > deadlineAt.getTime()))

  function refreshSchema() {
    const entry = $activeWysiwygStore
    const editor = entry?.editor
    formSchema = extractFormSchema(editor)
    isVisible = formSchema.fields.length > 0
    refreshNodeFieldValues()
  }

  async function updateSavingLabel() {
    const meta = get(nodeFieldMeta)
    if (!meta?.lastSavedAt) {
      savingLabel = $_('Not saved yet')
      return
    }
    const diffSec = Math.max(1, Math.round((Date.now() - meta.lastSavedAt) / 1000))
    savingLabel = $_('Saved locally · {seconds}s ago', { seconds: diffSec })
  }

  onMount(() => {
    refreshSchema()
    refreshNodeFieldValues()
    refreshTimer = setInterval(updateSavingLabel, 1500)
    updateSavingLabel()

    editorUnsub = _$_wysiwygEditorsList.getActive().subscribe(() => {
      refreshSchema()
    })
  })

  $effect(() => {
    const editor = $activeWysiwygStore?.editor
    if (!editor) return
    const handler = () => refreshSchema()
    editor.on('update', handler)
    return () => {
      editor.off('update', handler)
    }
  })

  onDestroy(() => {
    if (refreshTimer) clearInterval(refreshTimer)
    editorUnsub?.()
  })

  async function handleReset() {
    clearNodeFieldValues()
    submitError = ''
    submitSuccess = $_('Cleared')
    setTimeout(() => (submitSuccess = ''), 1500)
  }

  async function handleSubmit() {
    submitError = ''
    submitSuccess = ''

    if (requireAuth && !isAuthenticated) {
      submitError = $_('Sign in is required to submit this form.')
      return
    }
    if (!allowAnonymous && !isAuthenticated) {
      submitError = $_('Anonymous responses are disabled.')
      return
    }
    if (isClosed) {
      submitError = $_('This form is closed.')
      return
    }
    if (isAfterDeadline) {
      submitError = $_('The submission deadline has passed.')
      return
    }
    if (oneResponsePerUser) {
      const history = await loadSubmissionHistory(docUuid)
      if (history?.length) {
        submitError = $_('Only one response is allowed per user.')
        return
      }
    }

    const values = get(nodeFieldValues)
    const errors = validateFormSubmission(formSchema, values)
    if (errors.length) {
      submitError = errors[0].message
      return
    }

    const identity = await getCurrentUserIdentity()
    const payload = buildFormSubmissionPayload($activeWysiwygStore?.editor, values, {
      docUuid,
      ownerId: $activeDocStore?.document?.info?.createdBy,
      responderId: identity.userId || identity.deviceId || '',
      responderName: $authStore?.user?.displayName || $authStore?.user?.name || $authStore?.user?.username || '',
      metadata: {
        appVersion: (window as any)?.appVersion,
        locale: navigator?.language,
        responderAuthenticated: Boolean(isAuthenticated),
        formConfig: {
          requireAuth: formConfig?.requireAuth ?? false,
          allowAnonymous: formConfig?.allowAnonymous ?? true,
          oneResponsePerUser: formConfig?.oneResponsePerUser ?? false,
          deadlineAt: formConfig?.deadlineAt ?? null,
          maxResponses: formConfig?.maxResponses ?? null
        }
      }
    })

    if (!payload) {
      submitError = $_('Unable to build submission payload.')
      return
    }

    const result = await submitFormResponse(payload)
    if (result?.ok) {
      await appendSubmissionHistory(docUuid, payload)
      submitSuccess = $_('Submission sent')
      setTimeout(() => (submitSuccess = ''), 2000)
    } else {
      submitError = result?.message || $_('Submission failed')
    }
  }
</script>

{#if isVisible}
  <div class="fixed bottom-0 left-0 right-0 z-50 bg-base-200 border-t border-base-300">
    <div class="max-w-5xl mx-auto px-4 py-2 flex flex-wrap items-center gap-2 text-xs">
      <div class="flex flex-col flex-1 min-w-[180px]">
        <span class="font-semibold">{$_('Form ready')}</span>
        <span class="opacity-60">{savingLabel}</span>
      </div>

      {#if submitError}
        <div class="text-error text-xs">{submitError}</div>
      {:else if submitSuccess}
        <div class="text-success text-xs">{submitSuccess}</div>
      {/if}

      <div class="flex items-center gap-2 ml-auto">
        <button class="btn btn-xs btn-ghost" on:click={handleReset}>
          {$_('Reset')}
        </button>
        <button class="btn btn-xs btn-primary" on:click={handleSubmit} disabled={isClosed || isAfterDeadline}>
          {$_('Send')}
        </button>
      </div>
    </div>
  </div>
{/if}
