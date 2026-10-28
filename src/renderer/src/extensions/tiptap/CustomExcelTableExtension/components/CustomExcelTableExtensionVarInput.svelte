

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, tick } from 'svelte'
  import { normalizeIfFormula } from '../utils/utils'
  import { validateFormulaInput } from '../../CustomVarExtension/stores/variableManipulator'
  import { openAlertModal } from '../../../../stores/alertModal.store'
  import {
    VariableInsertModes,
    type VariableInsertMode
  } from '../../CustomVarExtension/utils/utils'
  import VariableCodexInput from '../../CustomVarExtension/components/VariableCodexInput.svelte'

  // Svelte 5 Props
  let {
    __labelText = 'Variable',
    __inputValue = $bindable(),
    // __inputValue = $bindable(''),
    __placeholder = 'Enter value or =formula...',
    __buttonText = 'Apply to Cell',
    __overrideNodeContent = $bindable(false),
    __insertVariable = $bindable(true),
    __onFormulaSave,
    __documentEditorId = null,
    __contextNodeId = null,
    // Innovative: Pass the raw cell content from the spreadsheet
    __rawCellContent = ''
  } = $props()

  let localValue = $state(__inputValue)
  $effect(() => {
    if (__inputValue !== localValue) {
      localValue = __inputValue ?? ''
    }
  })

  // Intelligent State
  let isFormula = $derived(localValue.toString().startsWith('='))
  let isNumber = $derived(!isNaN(Number(localValue)) && localValue !== '')

  async function focusInput() {
    await tick()
  }

  function handleMagicExtract() {
    if (__rawCellContent) {
      localValue = __rawCellContent
    }
  }

  function handleSave() {
    const finalValue = normalizeIfFormula(localValue)
    const trimmed = (finalValue || '').trim()
    const shouldValidate = trimmed.startsWith('=') || /\{[^}]+\}/.test(trimmed)
    if (shouldValidate && __documentEditorId) {
      const validationInput = trimmed.startsWith('=')
        ? trimmed
        : /\{[^}]+\}/.test(trimmed)
          ? `=${trimmed}`
          : trimmed
      const result = validateFormulaInput(validationInput, __documentEditorId, {
        contextNodeId: __contextNodeId || undefined
      })
      if (!result.valid) {
        openAlertModal({ title: 'Formula', message: result.error || 'Invalid formula.' })
        return
      }
    }
    __onFormulaSave?.(
      finalValue,
      __overrideNodeContent ? VariableInsertModes.override : '',
      __insertVariable
    )
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') {
      /* Handle Tippy close via parent */
    }
  }

  onMount(() => {
    localValue = __inputValue
    focusInput()
  })
</script>

<div
  class="w-72 bg-base-300 text-base-content font-sans rounded-sm border border-base-100 shadow-2xl flex flex-col overflow-hidden"
>
  <div class="px-3 py-2 bg-base-200 border-b border-base-100 flex justify-between items-center">
    <div class="flex items-center gap-2">
      <i class="ph-light ph-table {isFormula ? 'text-primary' : 'opacity-40'} text-[14px]"></i>
      <span class="text-[10px] font-bold uppercase tracking-widest opacity-80">{$_('Cell Inspector')}</span>
    </div>
    {#if isFormula}
      <span class="badge badge-primary badge-outline text-[9px] h-4 font-mono">{$_('FORMULA')}</span>
    {:else if isNumber}
      <span class="badge badge-ghost text-[9px] h-4 font-mono opacity-80">{$_('NUM')}</span>
    {/if}
  </div>

  <div class="p-3 space-y-3">
    <div class="space-y-1.5">
      <div class="flex justify-between items-center">
        <label class="text-[10px] font-bold opacity-90 uppercase tracking-tighter" for="cell-val"
          >{$_('Source Value')}</label
        >

        <button
          onclick={handleMagicExtract}
          class="text-[10px] text-primary hover:underline flex items-center gap-1 transition-all"
          title={$_('Pull value currently in cell')}
        >
          <i class="ph-light ph-magic-wand"></i>
          {$_('Sync from Cell')}
        </button>
      </div>

      <div class="relative">
        <!-- <span class="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[14px] opacity-30 pointer-events-none">
          {isFormula ? '' : 'f'}
        </span> -->
        <VariableCodexInput
          className="w-full bg-base-100 border border-base-100 rounded-[2px] py-2 pl-6 pr-2 focus:ring-1 focus:ring-primary/50 text-[12px] font-mono transition-all"
          placeholder={__placeholder}
          value={localValue}
          documentEditor={__documentEditorId}
          contextNodeId={__contextNodeId}
          onChange={(nextValue) => (localValue = nextValue)}
          onEnter={() => handleSave()}
        />
      </div>
    </div>

    <div class="space-y-2 py-1">
      <label class="flex items-center justify-between cursor-pointer group">
        <span class="text-[11px]"
          >{$_('Insert variable in cell')}</span
        >
        <input
          type="checkbox"
          bind:checked={__insertVariable}
          class="checkbox checkbox-xs rounded-sm"
        />
      </label>
      {#if __insertVariable}
        <label class="flex items-center justify-between cursor-pointer group">
          <span class="text-[11px]"
            >{$_('Override Cell Content')}</span
          >
          <input
            type="checkbox"
            bind:checked={__overrideNodeContent}
            class="checkbox checkbox-xs rounded-sm"
          />
        </label>

        <div
          class="p-2 bg-base-200/50 border border-base-100 rounded-sm text-[10px] opacity-70 leading-relaxed italic"
        >
          {#if __overrideNodeContent}
            <i class="ph-light ph-info mr-1"></i> Cell text will be replaced by variable value.
          {:else}
            <i class="ph-light ph-info mr-1"></i> Variable will be inserted at cursor position.
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <div class="p-2 bg-base-200 border-t border-base-100 flex gap-2">
    <button
      onclick={handleSave}
      class="flex-grow bg-primary hover:brightness-110 text-primary-content py-1.5 rounded-[2px] font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm"
    >
      {__buttonText}
    </button>
  </div>
</div>

<style>
  /* Precision Scrollbar for Adobe style popovers */
  ::-webkit-scrollbar {
    width: 4px;
  }
  ::-webkit-scrollbar-thumb {
    @apply bg-[var(--color-base-100)];
  }
</style>
