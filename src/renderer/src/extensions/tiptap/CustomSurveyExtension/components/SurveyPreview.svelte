<script lang="ts">
  import { onMount } from 'svelte'
  import type { SurveyDocV1 } from '../utils/surveySchema'
  import { authStore } from '../../../../stores/auth.store'
  import { _$_documentEditorsList } from '../../../../stores/editor.store'
  import { getCurrentUserIdentity } from '../../../../services/identity/identity.service'
  import { submitFormResponse } from '../../../../services/forms/forms.service'
  import { listFormResponses } from '../../../../services/forms/forms.service'
  import type { FormFieldSchema, FormSubmissionPayload } from '../../CustomFormFieldExtension/utils/form.utils'

  interface Props {
    survey: SurveyDocV1
    typeItems: { type: string; label: string; icon?: string }[]
    __disabled?: boolean
    __submissionKey?: string
    __surveyDrivePath?: string
    __docUuid?: string
    __ownerId?: string
  }

  let {
    survey,
    typeItems,
    __disabled = true,
    __submissionKey = '',
    __surveyDrivePath = '',
    __docUuid = '',
    __ownerId = ''
  }: Props = $props()

  const activeDocStore = _$_documentEditorsList.getActive()
  const docUuid = $derived(__docUuid || $activeDocStore?.document?.uuid || '')
  const isAuthenticated = $derived($authStore?.authenticated)

  const valueById = $state<Record<string, any>>({})
  let submitError = $state('')
  let submitSuccess = $state('')
  let submitting = $state(false)
  let responsesCount = $state<number | null>(null)

  const storageKey = $derived.by(() => {
    const base = __submissionKey || docUuid || survey?.title || 'survey'
    return `dynadoc.survey.submission:${base}`
  })
  const draftKey = $derived(`${storageKey}:draft`)

  const hasSubmittedOnce = $derived.by(() => {
    try {
      if (typeof localStorage === 'undefined') return false
      return Boolean(localStorage.getItem(storageKey))
    } catch {
      return false
    }
  })

  // ── Helper: type label ─────────────────────────────────────────────────────
  function typeLabel(type: string) {
    return typeItems.find((t) => t.type === type)?.label ?? type
  }

  function typeIcon(type: string) {
    return typeItems.find((t) => t.type === type)?.icon ?? 'ph-question'
  }

  // ── Sections with at least one visible question ────────────────────────────
  const visibleSections = $derived(survey.sections?.filter((s) => s.questions?.length > 0) ?? [])

  let pageIndex = $state(0)
  const canPaginate = $derived.by(() => !__disabled && visibleSections.length > 1)
  const clampedPageIndex = $derived.by(() =>
    Math.max(0, Math.min(pageIndex, Math.max(0, visibleSections.length - 1)))
  )
  const pageSection = $derived.by(() => (canPaginate ? visibleSections[clampedPageIndex] : null))
  const sectionsToRender = $derived.by(() =>
    canPaginate ? (pageSection ? [pageSection] : []) : visibleSections
  )

  $effect(() => {
    // Keep page index valid if sections change.
    visibleSections.length
    pageIndex = Math.max(0, Math.min(pageIndex, Math.max(0, visibleSections.length - 1)))
  })

  function hashSeed(str: string) {
    let h = 2166136261
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h | 0
  }

  function shuffleStable<T>(list: T[], seed: number) {
    const arr = [...list]
    let x = seed || 1
    for (let i = arr.length - 1; i > 0; i--) {
      x ^= x << 13
      x ^= x >> 17
      x ^= x << 5
      const j = Math.abs(x) % (i + 1)
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  function getQuestionValue(questionId: string) {
    return valueById?.[questionId]
  }

  function setQuestionValue(questionId: string, value: any) {
    valueById[questionId] = value
  }

  function toggleMulti(questionId: string, value: string) {
    const current = Array.isArray(valueById?.[questionId]) ? valueById[questionId] : []
    const next = current.includes(value) ? current.filter((v: string) => v !== value) : current.concat(value)
    setQuestionValue(questionId, next)
  }

  function buildSchema(): FormFieldSchema[] {
    const fields: FormFieldSchema[] = []
    for (const section of visibleSections) {
      for (const q of section.questions || []) {
        if (!q || q.type === 'section_header') continue
        const component =
          q.type === 'short_text' || q.type === 'long_text'
            ? 'TextField'
            : q.type === 'single_choice'
              ? 'RadioGroup'
              : q.type === 'multiple_choice'
                ? 'Checkbox'
                : q.type === 'dropdown'
                  ? 'Select'
                  : q.type === 'date'
                    ? 'DatePicker'
                    : q.type === 'switch'
                      ? 'Switch'
                      : q.type === 'slider'
                        ? 'Slider'
                        : q.type === 'file_upload'
                          ? 'FileUpload'
                          : 'TextField'

        fields.push({
          id: String(q.id),
          name: String(q.id),
          label: String(q.title || 'Question'),
          component,
          type: String(q.type || ''),
          required: Boolean(q.required),
          options: Array.isArray(q.options)
            ? q.options.map((o: any) => ({ value: String(o?.value ?? o), label: String(o?.label ?? o?.value ?? o) }))
            : [],
          placeholder: String(q.placeholder || ''),
          helper: String(q.hint || ''),
          min: q.min ?? null,
          max: q.max ?? null,
          step: q.step ?? null,
          pattern: q.pattern || ''
        })
      }
    }
    return fields
  }

  const formSchema = $derived.by(() => buildSchema())
  const answeredCount = $derived.by(() => {
    let count = 0
    for (const field of formSchema) {
      const v = valueById?.[field.id]
      const ok =
        v !== null &&
        v !== undefined &&
        !(typeof v === 'string' && v.trim() === '') &&
        !(Array.isArray(v) && v.length === 0)
      if (ok) count++
    }
    return count
  })
  const progressPct = $derived.by(() => {
    const total = formSchema.length || 1
    return Math.max(0, Math.min(100, Math.round((answeredCount / total) * 100)))
  })

  onMount(() => {
    if (__disabled) return
    try {
      if (typeof localStorage === 'undefined') return
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        Object.assign(valueById, parsed)
      }
    } catch {
      // ignore
    }
  })

  onMount(() => {
    if (__disabled) return
    const max = survey?.settings?.maxResponses
    if (!docUuid || !max || typeof max !== 'number') return
    listFormResponses({ docUuid })
      .then((res) => {
        if (res?.ok && Array.isArray(res?.items)) responsesCount = res.items.length
      })
      .catch(() => {})
  })

  // Persist draft while filling.
  $effect(() => {
    if (__disabled) return
    try {
      if (typeof localStorage === 'undefined') return
      // Touch to ensure the effect re-runs when answers change.
      JSON.stringify(valueById)
      localStorage.setItem(draftKey, JSON.stringify(valueById))
    } catch {
      // ignore
    }
  })

  function validateRequired(fields: FormFieldSchema[]) {
    for (const f of fields) {
      if (!f.required) continue
      const raw = valueById?.[f.id]
      const empty =
        raw === null ||
        raw === undefined ||
        (typeof raw === 'string' && raw.trim() === '') ||
        (Array.isArray(raw) && raw.length === 0)
      if (empty) return `${f.label || f.name} is required`
    }
    return ''
  }

  async function handleSubmit() {
    if (__disabled) return
    submitError = ''
    submitSuccess = ''

    if (!survey?.settings?.isPublished) {
      submitError = 'This survey is not published yet.'
      return
    }
    if (survey?.settings?.isOpen === false) {
      submitError = 'Responses are closed.'
      return
    }
    if (survey?.settings?.deadlineAt) {
      const deadline = new Date(survey.settings.deadlineAt)
      if (!Number.isNaN(deadline.getTime()) && Date.now() > deadline.getTime()) {
        submitError = 'The submission deadline has passed.'
        return
      }
    }
    const max = survey?.settings?.maxResponses
    if (typeof max === 'number' && max > 0 && responsesCount != null && responsesCount >= max) {
      submitError = 'No more responses are accepted.'
      return
    }

    if (survey?.settings?.requireSignIn && !isAuthenticated) {
      submitError = 'Sign in is required to submit this survey.'
      return
    }
    if (survey?.settings?.limitOneResponse && hasSubmittedOnce) {
      submitError = 'Only one response is allowed.'
      return
    }
    if (!docUuid) {
      submitError = 'Document is not ready.'
      return
    }

    const schema = formSchema
    const requiredMsg = validateRequired(schema)
    if (requiredMsg) {
      submitError = requiredMsg
      return
    }

    submitting = true
    try {
      const identity = await getCurrentUserIdentity()
      const payload: FormSubmissionPayload = {
        docUuid,
        ownerId:
          __ownerId ||
          $activeDocStore?.document?.info?.createdBy ||
          $activeDocStore?.document?.info?.createdByTemp ||
          '',
        responderId: identity.userId || identity.deviceId || '',
        responderName:
          $authStore?.user?.displayName ||
          $authStore?.user?.name ||
          $authStore?.user?.username ||
          '',
        submittedAt: new Date().toISOString(),
        answers: schema.map((f) => ({
          fieldId: f.id,
          name: f.name,
          label: f.label,
          value: valueById?.[f.id]
        })),
        schema,
        metadata: {
          type: 'survey',
          surveyTitle: survey?.title || '',
          surveyUpdatedAt: survey?.updatedAt || null,
          surveyDrivePath: __surveyDrivePath || survey?.publish?.surveyDrivePath || '',
          settings: survey?.settings || {},
          responderAuthenticated: Boolean(isAuthenticated)
        }
      }

      const result = await submitFormResponse(payload)
      if (result?.ok) {
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(storageKey, JSON.stringify({ submittedAt: payload.submittedAt }))
            localStorage.removeItem(draftKey)
          }
        } catch {
          // ignore
        }
        submitSuccess = 'Submission sent'
      } else {
        submitError = result?.message || 'Submission failed'
      }
    } catch (err: any) {
      submitError = err?.message || 'Submission failed'
    } finally {
      submitting = false
      if (submitSuccess) {
        setTimeout(() => (submitSuccess = ''), 2000)
      }
    }
  }

  const submitBlockedReason = $derived.by(() => {
    if (__disabled) return 'Preview'
    if (!survey?.settings?.isPublished) return 'Not published'
    if (survey?.settings?.isOpen === false) return 'Closed'
    if (survey?.settings?.deadlineAt) {
      const deadline = new Date(survey.settings.deadlineAt)
      if (!Number.isNaN(deadline.getTime()) && Date.now() > deadline.getTime()) return 'Deadline passed'
    }
    const max = survey?.settings?.maxResponses
    if (typeof max === 'number' && max > 0 && responsesCount != null && responsesCount >= max) return 'Max responses reached'
    if (survey?.settings?.requireSignIn && !isAuthenticated) return 'Sign-in required'
    if (survey?.settings?.limitOneResponse && hasSubmittedOnce) return 'Already submitted'
    return ''
  })
</script>

<div class="survey-preview">
  <!-- ── Survey header ─────────────────────────────────────────────────────── -->
  <div class="preview-header">
    <div class="preview-title">{survey.title || 'Untitled Survey'}</div>
    {#if survey.description}
      <div class="preview-description">{survey.description}</div>
    {/if}
    {#if !__disabled}
      {#if !survey?.settings?.isPublished}
        <div class="notice notice-warn">
          <i class="ph-light ph-lock-key"></i>
          <span>This survey is not published yet.</span>
        </div>
      {:else if survey?.settings?.isOpen === false}
        <div class="notice notice-warn">
          <i class="ph-light ph-hand-stop"></i>
          <span>Responses are closed.</span>
        </div>
      {:else if survey?.settings?.deadlineAt && Date.now() > new Date(survey.settings.deadlineAt).getTime()}
        <div class="notice notice-warn">
          <i class="ph-light ph-alarm"></i>
          <span>The submission deadline has passed.</span>
        </div>
      {:else if typeof survey?.settings?.maxResponses === 'number' && survey.settings.maxResponses > 0 && responsesCount != null && responsesCount >= survey.settings.maxResponses}
        <div class="notice notice-warn">
          <i class="ph-light ph-prohibit"></i>
          <span>No more responses are accepted.</span>
        </div>
      {/if}
    {/if}
    {#if !__disabled && survey?.settings?.showProgressBar}
      <div class="progress-wrap" aria-label="Progress">
        <div class="progress-bar">
          <div class="progress-fill" style={`width:${progressPct}%`}></div>
        </div>
        <div class="progress-meta">{answeredCount} / {formSchema.length} answered</div>
      </div>
    {/if}
    <div class="preview-meta">
      <span class="meta-badge">
        <i class="ph-light ph-stack text-[10px]"></i>
        {visibleSections.length} section{visibleSections.length !== 1 ? 's' : ''}
      </span>
      <span class="meta-badge">
        <i class="ph-light ph-list-checks text-[10px]"></i>
        {visibleSections.reduce((n, s) => n + s.questions.length, 0)} questions
      </span>
      {#if __disabled}
        <span class="meta-badge preview-only-badge">
          <i class="ph-light ph-eye text-[10px]"></i>
          Preview mode — all fields disabled
        </span>
      {:else}
        <span class="meta-badge live-badge">
          <i class="ph-light ph-paper-plane-tilt text-[10px]"></i>
          Live survey
        </span>
      {/if}
    </div>
  </div>

  <!-- ── Sections ──────────────────────────────────────────────────────────── -->
  {#each sectionsToRender as section (section.id)}
    <div class="preview-section">
      <!-- Section header -->
      <div class="section-header">
        <div class="section-title">{section.title}</div>
        {#if section.description}
          <div class="section-desc">{section.description}</div>
        {/if}
      </div>

      <!-- Questions -->
      <div class="questions-list">
        {#each (survey?.settings?.shuffleQuestions ? shuffleStable(section.questions || [], hashSeed(storageKey + ':' + section.id)) : section.questions) as q (q.id)}
          <div class="question-card" class:required={q.required}>
            <!-- Question label row -->
            <div class="question-label-row">
              <span class="type-chip">
                <i class="ph-light {typeIcon(q.type)} text-[10px]"></i>
                {typeLabel(q.type)}
              </span>
              {#if q.required}
                <span class="required-badge">Required</span>
              {/if}
            </div>

            <!-- Question title -->
            <div class="question-title">
              {q.title}
              {#if q.required}
                <span class="required-star">*</span>
              {/if}
            </div>

            <!-- Question description -->
            {#if q.description}
              <div class="question-desc">{q.description}</div>
            {/if}

            {#if q.type === 'section_header'}
              <div class="section-break">{q.title}</div>
            {:else}
              <div class="question-input-wrap" class:is-enabled={!__disabled}>
                {#if q.type === 'short_text'}
                  <input
                    class="dynainput"
                    type="text"
                    placeholder={q.placeholder ?? q.title}
                    value={getQuestionValue(q.id) ?? ''}
                    disabled={__disabled}
                    oninput={(e) => setQuestionValue(q.id, e.currentTarget.value)}
                  />
                {:else if q.type === 'long_text'}
                  <textarea
                    class="dynainput dynatextarea"
                    placeholder={q.placeholder ?? q.title}
                    value={getQuestionValue(q.id) ?? ''}
                    disabled={__disabled}
                    oninput={(e) => setQuestionValue(q.id, e.currentTarget.value)}
                  ></textarea>
                {:else if q.type === 'single_choice'}
                  <div class="choice-list">
                    {#each (q.options || []) as opt (opt.id || opt.value || opt)}
                      {@const v = String(opt?.value ?? opt)}
                      {@const label = String(opt?.label ?? opt?.value ?? opt)}
                      <label class="choice-item">
                        <input
                          type="radio"
                          name={q.id}
                          value={v}
                          checked={getQuestionValue(q.id) === v}
                          disabled={__disabled}
                          onchange={() => setQuestionValue(q.id, v)}
                        />
                        <span>{label}</span>
                      </label>
                    {/each}
                  </div>
                {:else if q.type === 'multiple_choice'}
                  <div class="choice-list">
                    {#each (q.options || []) as opt (opt.id || opt.value || opt)}
                      {@const v = String(opt?.value ?? opt)}
                      {@const label = String(opt?.label ?? opt?.value ?? opt)}
                      <label class="choice-item">
                        <input
                          type="checkbox"
                          value={v}
                          checked={Array.isArray(getQuestionValue(q.id)) && getQuestionValue(q.id).includes(v)}
                          disabled={__disabled}
                          onchange={() => toggleMulti(q.id, v)}
                        />
                        <span>{label}</span>
                      </label>
                    {/each}
                  </div>
                {:else if q.type === 'dropdown'}
                  <select
                    class="dynainput"
                    value={getQuestionValue(q.id) ?? ''}
                    disabled={__disabled}
                    onchange={(e) => setQuestionValue(q.id, e.currentTarget.value)}
                  >
                    <option value="" disabled selected={!(getQuestionValue(q.id) ?? '')}>
                      Select...
                    </option>
                    {#each (q.options || []) as opt (opt.id || opt.value || opt)}
                      {@const v = String(opt?.value ?? opt)}
                      {@const label = String(opt?.label ?? opt?.value ?? opt)}
                      <option value={v}>{label}</option>
                    {/each}
                  </select>
                {:else if q.type === 'date'}
                  <input
                    class="dynainput"
                    type="date"
                    value={getQuestionValue(q.id) ?? ''}
                    disabled={__disabled}
                    onchange={(e) => setQuestionValue(q.id, e.currentTarget.value)}
                  />
                {:else if q.type === 'switch'}
                  <label class="switch-row">
                    <input
                      type="checkbox"
                      checked={Boolean(getQuestionValue(q.id))}
                      disabled={__disabled}
                      onchange={(e) => setQuestionValue(q.id, e.currentTarget.checked)}
                    />
                    <span>{q.placeholder || 'Yes / No'}</span>
                  </label>
                {:else if q.type === 'slider'}
                  <div class="slider-row">
                    <input
                      type="range"
                      min={q.min ?? 0}
                      max={q.max ?? 100}
                      step={q.step ?? 1}
                      value={getQuestionValue(q.id) ?? q.min ?? 0}
                      disabled={__disabled}
                      oninput={(e) => setQuestionValue(q.id, Number(e.currentTarget.value))}
                    />
                    <div class="slider-value">{getQuestionValue(q.id) ?? q.min ?? 0}</div>
                  </div>
                {:else if q.type === 'file_upload'}
                  <input
                    class="dynainput"
                    type="file"
                    disabled={__disabled}
                    onchange={(e) => {
                      const files = Array.from(e.currentTarget.files || []).map((f) => ({
                        name: f.name,
                        size: f.size,
                        type: f.type
                      }))
                      setQuestionValue(q.id, files)
                    }}
                  />
                {:else}
                  <input
                    class="dynainput"
                    type="text"
                    placeholder={q.placeholder ?? q.title}
                    value={getQuestionValue(q.id) ?? ''}
                    disabled={__disabled}
                    oninput={(e) => setQuestionValue(q.id, e.currentTarget.value)}
                  />
                {/if}
              </div>
            {/if}

            <!-- Validation hint -->
            {#if q.validation?.hint || q.hint}
              <div class="question-hint">
                <i class="ph-light ph-info text-[10px]"></i>
                {q.validation?.hint ?? q.hint}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/each}

  {#if canPaginate}
    <div class="pager">
      <button
        class="pager-btn"
        disabled={clampedPageIndex <= 0}
        onclick={() => (pageIndex = Math.max(0, clampedPageIndex - 1))}
      >
        <i class="ph-light ph-arrow-left"></i> Back
      </button>
      <div class="pager-meta">
        Page {clampedPageIndex + 1} / {visibleSections.length}
      </div>
      <button
        class="pager-btn"
        disabled={clampedPageIndex >= visibleSections.length - 1}
        onclick={() => (pageIndex = Math.min(visibleSections.length - 1, clampedPageIndex + 1))}
      >
        Next <i class="ph-light ph-arrow-right"></i>
      </button>
    </div>
  {/if}

  <!-- ── Submit button (disabled) ──────────────────────────────────────────── -->
  <div class="preview-footer">
    {#if submitError}
      <span class="footer-error">{submitError}</span>
    {:else if submitSuccess}
      <span class="footer-success">{submitSuccess}</span>
    {/if}

    <button
      class="submit-btn"
      disabled={__disabled || submitting || Boolean(submitBlockedReason)}
      onclick={handleSubmit}
    >
      <i class="ph-bold ph-paper-plane-tilt text-[13px]"></i>
      {submitting ? 'Submitting...' : 'Submit'}
    </button>
    {#if __disabled}
      <span class="footer-note">Submission disabled in preview</span>
    {:else if submitBlockedReason && !submitting}
      <span class="footer-note">Cannot submit: {submitBlockedReason}</span>
    {:else if survey?.settings?.limitOneResponse && hasSubmittedOnce}
      <span class="footer-note">You already submitted one response.</span>
    {/if}
  </div>
</div>

<style lang="postcss">
  /* ── Layout ─────────────────────────────────────────────────────────────── */
  .survey-preview {
    @apply flex flex-col gap-4 p-5 max-w-[820px] mx-auto;
  }

  /* ── Survey header ──────────────────────────────────────────────────────── */
  .preview-header {
    @apply rounded-[10px] p-[20px_22px];
    background: color-mix(in srgb, var(--color-base-white, #fff) 4%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-base-white, #fff) 10%, transparent);
  }

  .preview-title {
    @apply text-[18px] font-bold leading-tight tracking-[-0.02em];
    color: var(--color-base-content, #e1e1e1);
  }

  .preview-description {
    @apply mt-2 text-[12px] whitespace-pre-wrap leading-[1.55];
    color: color-mix(in srgb, var(--color-base-content, #e1e1e1) 55%, transparent);
  }

  .preview-meta {
    @apply flex items-center gap-2 mt-[14px] flex-wrap;
  }

  .notice {
    @apply mt-3 flex items-center gap-2 rounded-[10px] p-[10px_12px] text-[12px] font-bold tracking-[-0.01em];
    border: 1px solid color-mix(in srgb, var(--color-base-white, #fff) 12%, transparent);
    background: color-mix(in srgb, var(--color-base-white, #fff) 6%, transparent);
    color: color-mix(in srgb, var(--color-base-content, #e1e1e1) 70%, transparent);
  }

  .notice-warn {
    border-color: color-mix(in srgb, var(--color-warning, #f59e0b) 22%, transparent);
    background: color-mix(in srgb, var(--color-warning, #f59e0b) 8%, transparent);
    color: color-mix(in srgb, var(--color-warning, #f59e0b) 85%, transparent);
  }

  .progress-wrap {
    @apply mt-[14px];
  }

  .progress-bar {
    @apply h-2 rounded-full overflow-hidden;
    border: 1px solid color-mix(in srgb, var(--color-base-white, #fff) 10%, transparent);
    background: color-mix(in srgb, var(--color-base-white, #fff) 6%, transparent);
  }

  .progress-fill {
    @apply h-full rounded-full transition-[width] duration-[180ms] ease-linear;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--color-accent, --color-base-300) 90%, transparent),
      color-mix(in srgb, var(--color-accent, --color-base-300) 60%, transparent)
    );
  }

  .progress-meta {
    @apply mt-[6px] text-[10px] font-bold tracking-[0.06em] uppercase;
    color: color-mix(in srgb, var(--color-base-content, #e1e1e1) 45%, transparent);
  }

  .meta-badge {
    @apply inline-flex items-center gap-1 px-[9px] py-[3px] rounded-full
           text-[10px] font-semibold tracking-[0.04em];
    background: color-mix(in srgb, var(--color-base-white, #fff) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-base-white, #fff) 10%, transparent);
    color: color-mix(in srgb, var(--color-base-content, #e1e1e1) 50%, transparent);
  }

  .preview-only-badge {
    color: color-mix(in srgb, var(--color-accent, --color-base-300) 80%, transparent);
    border-color: color-mix(in srgb, var(--color-accent, --color-base-300) 20%, transparent);
    background: color-mix(in srgb, var(--color-accent, --color-base-300) 6%, transparent);
  }

  .live-badge {
    color: color-mix(in srgb, var(--color-success, #22c55e) 80%, transparent);
    border-color: color-mix(in srgb, var(--color-success, #22c55e) 20%, transparent);
    background: color-mix(in srgb, var(--color-success, #22c55e) 6%, transparent);
  }

  /* ── Sections ───────────────────────────────────────────────────────────── */
  .preview-section {
    @apply rounded-[10px] overflow-hidden;
    border: 1px solid color-mix(in srgb, var(--color-base-white, #fff) 8%, transparent);
    background: color-mix(in srgb, var(--color-base-white, #fff) 3%, transparent);
  }

  .section-header {
    @apply px-[18px] pt-[14px] pb-3;
    border-bottom: 1px solid color-mix(in srgb, var(--color-base-white, #fff) 6%, transparent);
    background: color-mix(in srgb, var(--color-base-white, #fff) 2%, transparent);
  }

  .section-title {
    @apply text-[13px] font-bold tracking-[-0.01em];
    color: var(--color-base-content, #e1e1e1);
  }

  .section-desc {
    @apply mt-1 text-[11px] whitespace-pre-wrap leading-[1.5];
    color: color-mix(in srgb, var(--color-base-content, #e1e1e1) 45%, transparent);
  }

  /* ── Questions list ─────────────────────────────────────────────────────── */
  .questions-list {
    @apply flex flex-col gap-0;
  }

  .question-card {
    @apply p-[16px_18px] transition-colors duration-150;
    border-bottom: 1px solid color-mix(in srgb, var(--color-base-white, #fff) 5%, transparent);
  }

  .question-card:last-child {
    @apply border-b-0;
  }

  .question-card:hover {
    background: color-mix(in srgb, var(--color-base-white, #fff) 2%, transparent);
  }

  .question-card.required {
    border-left: 2px solid color-mix(in srgb, var(--color-error, #f33d3d) 50%, transparent);
  }

  /* ── Question label row ─────────────────────────────────────────────────── */
  .question-label-row {
    @apply flex items-center gap-[6px] mb-[6px];
  }

  .type-chip {
    @apply inline-flex items-center gap-[3px] px-[7px] py-[2px] rounded
           text-[9px] font-bold uppercase tracking-[0.08em];
    background: color-mix(in srgb, var(--color-accent, --color-base-300) 10%, transparent);
    color: color-mix(in srgb, var(--color-accent, --color-base-300) 80%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-accent, --color-base-300) 20%, transparent);
  }

  .required-badge {
    @apply text-[9px] font-bold uppercase tracking-[0.06em] px-[7px] py-[2px] rounded;
    background: color-mix(in srgb, var(--color-error, #f33d3d) 10%, transparent);
    color: color-mix(in srgb, var(--color-error, #f33d3d) 80%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-error, #f33d3d) 20%, transparent);
  }

  /* ── Question text ──────────────────────────────────────────────────────── */
  .question-title {
    @apply text-[13px] font-semibold leading-[1.3] mb-1;
    color: var(--color-base-content, #e1e1e1);
  }

  .required-star {
    @apply ml-[2px];
    color: var(--color-error, #f33d3d);
  }

  .question-desc {
    @apply text-[11px] whitespace-pre-wrap leading-[1.5] mb-[6px];
    color: color-mix(in srgb, var(--color-base-content, #e1e1e1) 45%, transparent);
  }

  /* ── Input container ────────────────────────────────────────────────────── */
  .question-input-wrap {
    @apply mt-[10px] max-w-full overflow-hidden;
  }

  .question-input-wrap:not(.is-enabled) {
    @apply opacity-[0.65] pointer-events-none select-none;
  }

  .dynainput {
    @apply w-full rounded-lg px-3 py-[10px] text-[12px] outline-none;
    color: var(--color-base-content, #e1e1e1);
    background: color-mix(in srgb, var(--color-base-white, #fff) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-base-white, #fff) 10%, transparent);
  }

  .dynainput:focus {
    border-color: color-mix(in srgb, var(--color-accent, --color-base-300) 35%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent, --color-base-300) 10%, transparent);
  }

  .dynatextarea {
    @apply min-h-[90px] resize-y;
  }

  .choice-list {
    @apply flex flex-col gap-2;
  }

  .choice-item {
    @apply flex gap-[10px] items-center text-[12px] px-[10px] py-2 rounded-lg;
    color: color-mix(in srgb, var(--color-base-content, #e1e1e1) 70%, transparent);
    background: color-mix(in srgb, var(--color-base-white, #fff) 4%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-base-white, #fff) 8%, transparent);
  }

  .choice-item input {
    accent-color: var(--color-accent, --color-base-300);
  }

  .switch-row {
    @apply flex items-center gap-[10px] text-[12px];
    color: color-mix(in srgb, var(--color-base-content, #e1e1e1) 70%, transparent);
  }

  .slider-row {
    @apply flex items-center gap-[10px];
  }

  .slider-row input[type='range'] {
    @apply flex-1;
    accent-color: var(--color-accent, --color-base-300);
  }

  .slider-value {
    @apply min-w-[32px] text-right text-[11px];
    color: color-mix(in srgb, var(--color-base-content, #e1e1e1) 55%, transparent);
  }

  .section-break {
    @apply px-3 py-[10px] rounded-lg font-bold tracking-[-0.01em];
    background: color-mix(in srgb, var(--color-accent, --color-base-300) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-accent, --color-base-300) 18%, transparent);
    color: color-mix(in srgb, var(--color-accent, --color-base-300) 85%, transparent);
  }

  /* ── Hint ───────────────────────────────────────────────────────────────── */
  .question-hint {
    @apply flex items-center gap-1 mt-[6px] text-[10px] italic;
    color: color-mix(in srgb, var(--color-base-content, #e1e1e1) 35%, transparent);
  }

  /* ── Footer ─────────────────────────────────────────────────────────────── */
  .preview-footer {
    @apply flex items-center justify-end gap-3 pt-1 pb-2;
  }

  .pager {
    @apply flex items-center justify-between gap-3 pt-2 pb-1;
  }

  .pager-meta {
    @apply text-[10px] font-extrabold tracking-[0.14em] uppercase;
    color: color-mix(in srgb, var(--color-base-content, #e1e1e1) 35%, transparent);
  }

  .pager-btn {
    @apply inline-flex items-center gap-2 px-[14px] py-2 rounded-[10px]
           text-[12px] font-extrabold cursor-pointer;
    border: 1px solid color-mix(in srgb, var(--color-base-white, #fff) 10%, transparent);
    background: color-mix(in srgb, var(--color-base-white, #fff) 5%, transparent);
    color: color-mix(in srgb, var(--color-base-content, #e1e1e1) 70%, transparent);
  }

  .pager-btn:disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .submit-btn {
    @apply inline-flex items-center gap-[6px] px-5 py-2 rounded-[7px]
           text-[12px] font-bold border-none text-white cursor-pointer
           transition-[opacity,filter] duration-200;
    background: var(--color-accent, --color-base-300);
  }

  .submit-btn:hover:not(:disabled) {
    @apply brightness-105;
  }

  .submit-btn:disabled {
    @apply cursor-not-allowed opacity-50;
  }

  .footer-note {
    @apply text-[10px] italic;
    color: color-mix(in srgb, var(--color-base-content, #e1e1e1) 30%, transparent);
  }

  .footer-error {
    @apply text-[11px] font-semibold mr-auto;
    color: color-mix(in srgb, var(--color-error, #f33d3d) 85%, transparent);
  }

  .footer-success {
    @apply text-[11px] font-bold mr-auto;
    color: color-mix(in srgb, var(--color-success, #22c55e) 85%, transparent);
  }
</style>
