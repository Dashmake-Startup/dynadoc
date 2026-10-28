<script lang="ts">
  import { _ } from 'svelte-i18n'
  import SurveyQuestionCard from './SurveyQuestionCard.svelte'
  import type { SurveyActions, SurveyDocV1, SurveyQuestionType } from '../utils/surveySchema'

  let {
    survey = $bindable(),
    activeSectionId = $bindable(),
    activeQuestionId = $bindable(),
    typeItems,
    actions
  } = $props<{
    survey: SurveyDocV1
    activeSectionId: string
    activeQuestionId: string
    typeItems: Array<{ type: SurveyQuestionType; label: string; icon?: string; hint?: string }>
    /* actions: {
      addQuestion: (type?: SurveyQuestionType) => void
      patchQuestion: (questionId: string, patch: any) => void
      deleteQuestion: (questionId: string) => void
      duplicateQuestion: (q: any) => void
      moveQuestion: (questionId: string, dir: -1 | 1) => void
      addSection: () => void
      patchSection: (sectionId: string, patch: any) => void
      deleteSection: (sectionId: string) => void
      setPublished?: (published: boolean) => Promise<void> | void
      scheduleSave: () => void
      exportJsonToClipboard?: () => void
      importJsonFromClipboard?: () => void
    } */
    actions: SurveyActions
  }>()

  const activeSection = $derived.by(
    () => survey.sections.find((s) => s.id === activeSectionId) || survey.sections[0] || null
  )
</script>

<div class="builder-workspace">
  <!-- SECTION NAVIGATION TABS -->
  <nav class="section-nav">
    {#each survey.sections as section, idx (section.id)}
      <button
        class="nav-tab {section.id === activeSectionId ? 'is-active' : ''}"
        onclick={() => {
          activeSectionId = section.id
          activeQuestionId = section.questions[0]?.id || ''
        }}
      >
        <span class="tab-index">{idx + 1}</span>
        <span class="tab-text">{section.title || $_('Section')}</span>
      </button>
    {/each}
    <button class="nav-add" onclick={actions.addSection} title={$_('Add section')}>
      <i class="ph-light ph-plus"></i>
    </button>
  </nav>

  <div class="main-scroller">
    <div class="max-w-[720px] mx-auto space-y-6 pb-24">
      <!-- MASTER SETTINGS CARD -->
      <div class="spectrum-card master-settings">
        <div class="active-indicator"></div>
        <textarea
          class="desc-textarea"
          value={survey.description}
          placeholder={$_('Type survey description...')}
          oninput={(e) => {
            survey.description = e.currentTarget.value
            actions.scheduleSave()
          }}
        ></textarea>

        <div class="settings-row">
          <label class="spectrum-checkbox">
            <input
              type="checkbox"
              checked={survey.settings.showProgressBar}
              onchange={(e) => {
                survey.settings.showProgressBar = e.currentTarget.checked
                actions.scheduleSave()
              }}
            />
            <span>{$_('Progress Bar')}</span>
          </label>
          <label class="spectrum-checkbox">
            <input
              type="checkbox"
              checked={survey.settings.shuffleQuestions}
              onchange={(e) => {
                survey.settings.shuffleQuestions = e.currentTarget.checked
                actions.scheduleSave()
              }}
            />
            <span>{$_('Shuffle')}</span>
          </label>
        </div>

        <div class="settings-row">
          <label class="spectrum-checkbox">
            <input
              type="checkbox"
              checked={survey.settings.isPublished}
              onchange={(e) => {
                const next = e.currentTarget.checked
                if (actions.setPublished) {
                  void actions.setPublished(next)
                } else {
                  survey.settings.isPublished = next
                  // When publishing, default to accepting responses unless the author explicitly closes it.
                  if (survey.settings.isPublished && survey.settings.isOpen === undefined) {
                    survey.settings.isOpen = true
                  }
                  actions.scheduleSave()
                }
              }}
            />
            <span>{$_('Published')}</span>
          </label>
          <label class="spectrum-checkbox">
            <input
              type="checkbox"
              checked={survey.settings.isOpen !== false}
              onchange={(e) => {
                survey.settings.isOpen = e.currentTarget.checked
                actions.scheduleSave()
              }}
            />
            <span>{$_('Accept responses')}</span>
          </label>
          <label class="spectrum-checkbox">
            <input
              type="checkbox"
              checked={survey.settings.collectEmail === true}
              onchange={(e) => {
                survey.settings.collectEmail = e.currentTarget.checked
                actions.scheduleSave()
              }}
            />
            <span>{$_('Collect email')}</span>
          </label>
          <label class="spectrum-checkbox">
            <input
              type="checkbox"
              checked={survey.settings.requireSignIn === true}
              onchange={(e) => {
                survey.settings.requireSignIn = e.currentTarget.checked
                actions.scheduleSave()
              }}
            />
            <span>{$_('Require sign-in')}</span>
          </label>
        </div>

        <div class="advanced-grid">
          <label class="field">
            <span class="field-label">{$_('Deadline')}</span>
            <input
              class="adv-input"
              type="datetime-local"
              value={survey.settings.deadlineAt
                ? new Date(survey.settings.deadlineAt).toISOString().slice(0, 16)
                : ''}
              oninput={(e) => {
                const v = e.currentTarget.value
                survey.settings.deadlineAt = v ? new Date(v).toISOString() : ''
                actions.scheduleSave()
              }}
            />
          </label>
          <label class="field">
            <span class="field-label">{$_('Max responses')}</span>
            <input
              class="adv-input"
              type="number"
              min="1"
              step="1"
              value={survey.settings.maxResponses ?? ''}
              oninput={(e) => {
                const raw = e.currentTarget.value
                const n = raw ? Number(raw) : NaN
                survey.settings.maxResponses = Number.isFinite(n) && n > 0 ? Math.floor(n) : null
                actions.scheduleSave()
              }}
            />
          </label>
        </div>
      </div>

      {#if activeSection}
        <!-- SECTION CONTENT -->
        <div class="spectrum-card section-card">
          <div class="flex items-center justify-between mb-4">
            <input
              class="section-title-input"
              value={activeSection.title}
              oninput={(e) =>
                actions.patchSection(activeSection.id, { title: e.currentTarget.value })}
            />
            <button
              class="icon-btn-danger"
              onclick={() => actions.deleteSection(activeSection.id)}
              disabled={survey.sections.length <= 1}
              title={$_('Delete section')}
            >
              <i class="ph-light ph-trash"></i>
            </button>
          </div>
        </div>

        {#each activeSection.questions as q (q.id)}
          <div onclick={() => (activeQuestionId = q.id)}>
            <SurveyQuestionCard
              question={q}
              selected={q.id === activeQuestionId}
              {typeItems}
              {actions}
              onChange={(patch) => actions.patchQuestion(q.id, patch)}
              onDelete={() => actions.deleteQuestion(q.id)}
              onDuplicate={() => actions.duplicateQuestion(q)}
              onMoveUp={() => actions.moveQuestion(q.id, -1)}
              onMoveDown={() => actions.moveQuestion(q.id, 1)}
            />
          </div>
        {/each}
      {/if}

      <!-- ADD CONTENT BUTTONS -->
      <div class="add-content-zone">
        <button class="add-main-btn" onclick={() => actions.addQuestion('short_text')}>
          <i class="ph-light ph-plus-circle"></i>
          <span>{$_('Insert Question')}</span>
        </button>
      </div>
    </div>
  </div>

  <!-- SPECTRUM FLOATING TOOLBAR -->
  <aside class="spectrum-rail">
    <div class="rail-inner">
      <button
        class="rail-btn"
        title={$_('Add Question')}
        onclick={() => actions.addQuestion('short_text')}
      >
        <i class="ph-bold ph-plus"></i>
      </button>
      <div class="rail-divider"></div>
      <button class="rail-btn" title={$_('Add Section')} onclick={actions.addSection}>
        <i class="ph-bold ph-selection-background"></i>
      </button>
      {#if actions.exportJsonToClipboard}
        <button class="rail-btn" title={$_('Export JSON')} onclick={actions.exportJsonToClipboard}>
          <i class="ph-bold ph-export"></i>
        </button>
      {/if}
      {#if actions.importJsonFromClipboard}
        <button
          class="rail-btn"
          title={$_('Import JSON')}
          onclick={actions.importJsonFromClipboard}
        >
          <i class="ph-bold ph-download-simple"></i>
        </button>
      {/if}
    </div>
  </aside>
</div>

<style lang="postcss">
  .builder-workspace {
    @apply relative flex flex-col h-full min-h-0 bg-[var(--theme-surface-1)];
  }

  .main-scroller {
    @apply flex-1 min-h-0 overflow-y-auto scroll-smooth;
  }

  /* CARDS: Using surface-2 for a subtle contrast from the main background */
  .spectrum-card {
    @apply relative border rd-12px p-6 transition-all;
    @apply bg-[var(--theme-surface-2)] border-[var(--theme-border-subtle)] backdrop-blur-md;
  }

  .master-settings {
    @apply border-l-4 border-l-[var(--color-base-300)];
  }

  /* SECTION NAVIGATION TABS */
  .section-nav {
    @apply flex items-center gap-1 px-4 py-2 border-b overflow-x-auto backdrop-blur-sm;
    @apply bg-[var(--theme-overlay-soft)] border-[var(--theme-border-subtle)];
  }

  .nav-tab {
    @apply flex items-center gap-2 px-4 py-2 rd-8px text-11px font-bold transition-all;
    @apply text-[var(--theme-text-muted)] hover:bg-[var(--theme-overlay-medium)];
  }

  .nav-tab.is-active {
    @apply text-[var(--color-base-300)] border border-[var(--color-base-300)] shadow-sm;
    @apply bg-[var(--theme-overlay-medium)];
  }

  .tab-index {
    @apply text-[9px] font-mono opacity-50;
  }

  .nav-add {
    @apply ml-1 size-8 flex items-center justify-center rd-8px transition-all;
    @apply text-[var(--theme-text-muted)] hover:bg-[var(--theme-overlay-strong)] hover:text-[var(--color-base-300)];
  }

  /* INPUTS & TEXT AREAS */
  .section-title-input {
    @apply bg-transparent border-none outline-none text-20px font-900 w-full;
    @apply text-[var(--theme-text-1)] placeholder:text-[var(--theme-text-muted)] focus:ring-0;
  }

  .desc-textarea {
    @apply w-full bg-transparent border-none outline-none text-13px resize-none leading-relaxed;
    @apply text-[var(--theme-text-muted)] placeholder:text-[var(--theme-text-muted)] focus:ring-0;
    min-height: 60px;
  }

  /* SETTINGS & GRID */
  .settings-row {
    @apply mt-6 flex flex-wrap items-center gap-x-6 gap-y-3;
  }

  .field-label {
    @apply text-[9px] font-black uppercase tracking-[0.15em] mb-1;
    @apply text-[var(--theme-text-muted)];
  }

  .adv-input {
    @apply border rd-8px px-3 py-2.5 text-12px transition-all outline-none;
    @apply bg-[var(--theme-surface-1)] text-[var(--theme-text-1)] border-[var(--theme-border-subtle)] focus:border-[var(--color-base-300)];
  }

  /* BUTTONS */
  .icon-btn-danger {
    @apply size-9 flex items-center justify-center rd-10px;
    @apply bg-[var(--theme-overlay-soft)] text-error;
    @apply hover:bg-error hover:text-white transition-all duration-200;
    @apply disabled:opacity-20 disabled:grayscale;
  }

  .add-main-btn {
    @apply flex items-center gap-3 px-6 py-3 rd-12px font-bold text-12px transition-all border;
    @apply bg-[var(--theme-surface-1)] text-[var(--color-base-300)] border-[var(--color-base-300)];
    @apply hover:bg-[var(--color-base-300)] hover:text-[var(--theme-elevated-text)] shadow-lg active:scale-95;
  }

  /* FLOATING RAIL */
  .spectrum-rail {
    @apply fixed top-1/2 -translate-y-1/2 right-6 z-50;
  }

  .rail-inner {
    @apply flex flex-col gap-2 p-1.5 border rd-full shadow-2xl backdrop-blur-xl;
    @apply bg-[var(--theme-surface-1)] border-[var(--theme-border-subtle)];
  }

  .rail-btn {
    @apply size-11 flex items-center justify-center rd-full transition-all;
    @apply text-[var(--theme-text-muted)] hover:bg-[var(--color-base-300)] hover:text-[var(--theme-elevated-text)];
    @apply active:scale-90 shadow-sm;
  }

  .rail-divider {
    @apply h-px w-6 mx-auto my-1 bg-[var(--theme-border-subtle)];
  }

  /* CHECKBOX */
  .spectrum-checkbox {
    @apply flex items-center gap-2.5 text-11px font-bold cursor-pointer transition-colors;
    @apply text-[var(--theme-text-muted)] hover:text-[var(--theme-text-1)];
  }

  .spectrum-checkbox input {
    @apply appearance-none size-4 border-2 rd-5px transition-all cursor-pointer relative;
    @apply border-[var(--theme-border-subtle)] checked:bg-[var(--color-base-300)] checked:border-[var(--color-base-300)];
  }

  .spectrum-checkbox input:checked::after {
    content: '✓';
    @apply absolute inset-0 flex items-center justify-center text-[10px] font-black;
    @apply text-[var(--theme-elevated-text)];
  }

  /* SCROLLBARS */
  .main-scroller::-webkit-scrollbar {
    @apply w-1.5;
  }
  .main-scroller::-webkit-scrollbar-thumb {
    @apply rd-full transition-colors bg-[var(--theme-border-subtle)] hover:bg-[var(--theme-text-muted)];
  }
</style>
