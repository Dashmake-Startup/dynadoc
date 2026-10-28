<script lang="ts">
  import { _ } from 'svelte-i18n'
  import ContextMenu from '../../../../components/common/contextMenu/ContextMenu.svelte'
  import SurveyQuestionTypeMenu from './SurveyQuestionTypeMenu.svelte'
  import {
    defaultQuestionV1,
    type SurveyActions,
    type SurveyQuestionType,
    type SurveyQuestionV1
  } from '../utils/surveySchema'
  import { v4 as uuidv4 } from 'uuid'

  let {
    question,
    selected,
    typeItems,
    actions,

    onChange,
    onDelete,
    onDuplicate,
    onMoveUp,
    onMoveDown
  }: {
    question: SurveyQuestionV1
    selected: boolean
    typeItems: Array<{ type: SurveyQuestionType; label: string; icon: string; hint?: string }>
    onChange: (patch: Partial<SurveyQuestionV1>) => void
    onDelete: () => void
    onDuplicate: () => void
    onMoveUp: () => void
    onMoveDown: () => void
    actions: SurveyActions
  } = $props()

  const isChoice = (t: SurveyQuestionType) =>
    t === 'single_choice' || t === 'multiple_choice' || t === 'dropdown'

  const ensureOptions = (t: SurveyQuestionType, current?: SurveyQuestionV1['options']) => {
    if (!isChoice(t)) return undefined
    if (Array.isArray(current) && current.length) return current
    return [
      { id: uuidv4(), label: 'Option 1', value: 'option_1' },
      { id: uuidv4(), label: 'Option 2', value: 'option_2' }
    ]
  }

  const onPickType = (t: SurveyQuestionType) => {
    const base = defaultQuestionV1(t)
    onChange({
      type: t,
      component: base.component,
      placeholder: base.placeholder,
      meta: base.meta,
      options: ensureOptions(t, question.options)
    })
  }
</script>

<div class="spectrum-q-card {selected ? 'is-selected' : ''}">
  <!-- FOCUS INDICATOR -->
  {#if selected}
    <div class="selection-indicator"></div>
  {/if}

  <div class="card-main-layout">
    <!-- HEADER: INPUTS & TYPE SELECTOR -->
    <div class="flex items-start gap-4 p-5">
      <div class="flex-1 min-w-0 space-y-1">
        <input
          class="q-title-input"
          value={question.title}
          placeholder={$_('ENTER_QUESTION_TEXT')}
          oninput={(e) => onChange({ title: e.currentTarget.value })}
        />
        <input
          class="q-desc-input"
          value={question.description || ''}
          placeholder={$_('Add helper text or instructions...')}
          oninput={(e) => onChange({ description: e.currentTarget.value })}
        />
      </div>

      <ContextMenu
        __component={SurveyQuestionTypeMenu}
        __props={{ items: typeItems, onPick: onPickType }}
        __placement="bottom-end"
        __offset={[0, 8]}
      >
        <button class="spectrum-type-selector" type="button">
          <i
            class="ph-bold {typeItems.find((i) => i.type === question.type)?.icon ||
              'ph-terminal-window'} text-accent"
          ></i>
          <span>{typeItems.find((i) => i.type === question.type)?.label}</span>
          <i class="ph-light ph-caret-down text-[10px] opacity-40"></i>
        </button>
      </ContextMenu>
    </div>

    <!-- BODY: OPTIONS & INPUT PREVIEWS -->
    <div class="px-5 pb-5">
      {#if isChoice(question.type)}
        <div class="option-list">
          {#each question.options || [] as opt, idx (opt.id)}
            <div class="option-row group">
              <div class="option-bullet">
                {#if question.type === 'single_choice'}
                  <i class="ph-light ph-circle"></i>
                {:else if question.type === 'multiple_choice'}
                  <i class="ph-light ph-square"></i>
                {:else}
                  <span class="text-[10px] opacity-30 font-mono">{idx + 1}.</span>
                {/if}
              </div>
              <input
                class="option-input"
                value={opt.label}
                placeholder={`${$_('Option')} ${idx + 1}`}
                oninput={(e) => {
                  const label = e.currentTarget.value
                  const next = (question.options || []).map((o) =>
                    o.id === opt.id ? { ...o, label, value: o.value || label } : o
                  )
                  onChange({ options: next })
                }}
              />
              <button
                type="button"
                class="option-remove"
                onclick={() => {
                  const next = (question.options || []).filter((o) => o.id !== opt.id)
                  onChange({ options: next.length ? next : ensureOptions(question.type, []) })
                }}
              >
                <i class="ph-light ph-x"></i>
              </button>
            </div>
          {/each}

          <button
            type="button"
            class="add-option-trigger"
            onclick={() => {
              const next = [
                ...(question.options || []),
                { id: uuidv4(), label: '', value: `option_${uuidv4()}` }
              ]
              onChange({ options: next })
            }}
          >
            <i class="ph-light ph-plus-circle text-accent"></i>
            <span>{$_('ADD_NEW_CHOICE')}</span>
          </button>
        </div>
      {:else}
        <!-- NON-CHOICE PREVIEWS -->
        <div class="type-preview-zone">
          <i class="ph-light ph-info opacity-40"></i>
          <span>
            {question.type === 'short_text'
              ? $_('Single-line text entry')
              : question.type === 'long_text'
                ? $_('Multi-line paragraph entry')
                : question.type === 'date'
                  ? $_('Calendar date selector')
                  : question.type === 'switch'
                    ? $_('Binary toggle (Yes/No)')
                    : $_('Static system content')}
          </span>
        </div>
      {/if}
    </div>

    <!-- FOOTER: ACTIONS & SETTINGS -->
    <footer class="card-footer">
      <div class="flex items-center gap-1">
        <button class="footer-icon-btn" onclick={onMoveUp} title={$_('MOVE_UP')}>
          <i class="ph-light ph-arrow-up"></i>
        </button>
        <button class="footer-icon-btn" onclick={onMoveDown} title={$_('MOVE_DOWN')}>
          <i class="ph-light ph-arrow-down"></i>
        </button>
      </div>

      <div class="flex items-center gap-4">
        <!-- REQUIRED TOGGLE -->
        <label class="spectrum-toggle">
          <input
            type="checkbox"
            checked={question.required}
            onchange={(e) => onChange({ required: e.currentTarget.checked })}
          />
          <span class="toggle-slider"></span>
          <span class="toggle-label">{$_('MANDATORY')}</span>
        </label>

        <div class="v-divider"></div>

        <div class="flex items-center gap-1">
          <button class="footer-icon-btn" onclick={onDuplicate} title={$_('DUPLICATE')}>
            <i class="ph-light ph-copy"></i>
          </button>
          <button class="footer-icon-btn is-danger" onclick={onDelete} title={$_('DELETE')}>
            <i class="ph-light ph-trash"></i>
          </button>
        </div>
      </div>
    </footer>
  </div>

  <!-- {#if selected} -->
    <!-- SPECTRUM FLOATING TOOLBAR -->
    <!-- <aside class="spectrum-rail">
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
          <button
            class="rail-btn"
            title={$_('Export JSON')}
            onclick={actions.exportJsonToClipboard}
          >
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
    </aside> -->
  <!-- {/if} -->
</div>

<style lang="postcss">
  .spectrum-q-card {
    @apply relative rd-10px overflow-hidden transition-all duration-300;
    /* Replaced bg-[var(--color-base-200)] and border-white/5 */
    background-color: var(--theme-surface-1);
    border: 1px solid var(--theme-border-subtle);
    /* box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2); */
  }

  .spectrum-q-card.is-selected {
    @apply -translate-y-0.5;
    /* Replaced bg-[#222222] and border-white/20 */
    background-color: var(--theme-surface-2);
    border-color: var(--color-base-300);
    box-shadow:
      0 8px 30px rgba(0, 0, 0, 0.4),
      0 0 0 1px var(--theme-border-subtle);
  }

  .selection-indicator {
    @apply absolute left-0 top-0 bottom-0 w-[4px] rd-r-full z-10;
    /* Replaced bg-accent */
    background-color: var(--color-base-300);
    /* box-shadow: 4px 0 15px color-mix(in srgb, var(--color-base-300) 30%, transparent); */
  }

  /* INPUTS */
  .q-title-input {
    @apply w-full bg-transparent border-none outline-none text-[16px] font-700;
    /* Replaced text-white */
    color: var(--color-base-content);
    &::placeholder {
      color: color-mix(in srgb, var(--color-base-content) 20%, transparent);
    }
  }
  .q-desc-input {
    @apply w-full bg-transparent border-none outline-none text-[11px];
    /* Replaced text-white/40 */
    color: var(--theme-text-muted);
    &::placeholder {
      color: color-mix(in srgb, var(--color-base-content) 10%, transparent);
    }
  }

  /* TYPE SELECTOR */
  .spectrum-type-selector {
    @apply shrink-0 flex items-center gap-3 px-3 py-2 rd-6px text-[11px] font-bold transition-all;
    /* Replaced bg-black/40 and border-white/10 */
    background-color: var(--theme-surface-2);
    border: 1px solid var(--theme-border-subtle);
    color: var(--theme-text-1);

    &:hover {
      background-color: var(--theme-elevated);
      border-color: var(--color-base-300);
    }
  }

  /* FLOATING RAIL */
  /* .spectrum-rail {
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
  } */

  /* OPTIONS */
  .option-list {
    @apply space-y-1.5;
  }
  .option-row {
    @apply flex items-center gap-3 py-1;
  }
  .option-bullet {
    @apply size-5 flex items-center justify-center text-14px;
    color: var(--theme-text-muted);
  }
  .option-input {
    @apply flex-1 bg-transparent border-b py-1 text-[12px] outline-none transition-colors;
    /* Replaced border-white/5 and focus:border-accent */
    border-color: var(--theme-border-subtle);
    color: var(--theme-text-1);

    &:focus {
      border-color: var(--color-base-300);
    }
    &::placeholder {
      color: color-mix(in srgb, var(--color-base-content) 10%, transparent);
    }
  }
  .option-remove {
    @apply opacity-0 group-hover:opacity-100 p-1 transition-all;
    color: var(--theme-text-muted);
    &:hover {
      @apply text-error;
    }
  }

  .add-option-trigger {
    @apply flex items-center gap-3 px-2 py-3 w-full text-[11px] font-bold rd-4px transition-all mt-2;
    /* Replaced text-white/30 and hover:text-accent */
    color: var(--theme-text-muted);
    &:hover {
      color: var(--color-base-300);
      background-color: var(--theme-surface-2);
    }
  }

  .type-preview-zone {
    @apply flex items-center gap-3 p-4 rd-6px border border-dashed text-[11px];
    /* Replaced bg-black/20 and border-white/5 */
    background-color: var(--theme-surface-2);
    border-color: var(--theme-border-subtle);
    color: var(--theme-text-muted);
  }

  /* FOOTER */
  .card-footer {
    @apply flex items-center justify-between px-4 py-3 border-t;
    /* Replaced bg-black/20 and border-white/5 */
    background-color: var(--theme-surface-2);
    border-color: var(--theme-border-subtle);
  }

  .footer-icon-btn {
    @apply size-8 flex items-center justify-center rd-6px transition-all;
    color: var(--theme-text-muted);
    &:hover {
      background-color: var(--theme-elevated);
      color: var(--color-base-content);
    }
    &.is-danger {
      @apply hover:text-error hover:bg-error/10;
    }
  }

  .v-divider {
    @apply w-px h-5 mx-1;
    background-color: var(--theme-border-subtle);
  }

  /* TOGGLE SPECTRUM STYLE */
  .spectrum-toggle {
    @apply flex items-center gap-3 cursor-pointer select-none;
  }
  .toggle-label {
    @apply text-[9px] font-900 tracking-widest uppercase;
    color: var(--theme-text-muted);
  }
  .toggle-slider {
    @apply relative w-8 h-4 rd-full transition-all;
    /* Replaced bg-white/10 */
    background-color: var(--theme-border-subtle);
  }
  .toggle-slider::after {
    @apply content-[''] absolute left-0.5 top-0.5 size-3 rd-full transition-all;
    background-color: var(--theme-text-muted);
  }
  input:checked + .toggle-slider {
    /* Replaced bg-accent */
    background-color: var(--color-base-300);
  }
  input:checked + .toggle-slider::after {
    @apply left-[18px];
    background-color: var(--theme-surface-1);
  }
</style>
