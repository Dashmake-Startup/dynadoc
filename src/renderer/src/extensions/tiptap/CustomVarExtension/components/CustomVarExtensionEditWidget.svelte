

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onDestroy } from 'svelte'
  import toast from 'svelte-hot-french-toast'
  import { _$_documentEditorsList } from '../../../../stores/editor.store'
  import {
    listVariables,
    setVariable,
    renameVariable,
    deleteVariable,
    VariableManipulatorUtils,
    getVariableId,
    onVariableChange
  } from '../stores/variableManipulator'
  import {
    buildVariablePayload,
    normalizeVariableName,
    isNameTaken
  } from '../utils/variableForm.utils'
  import { getVariableDisplayValue } from '../utils/variableDisplay.utils'
  import VariableCodexInput from './VariableCodexInput.svelte'
  import { formatSpreadsheetRefName } from '../utils/utils'
  import { nodeApi } from '../../../../utils/shims/node'

  // Svelte 5 Props
  let {
    __variable = $bindable(),
    __onSave = null,
    __onDelete = null,
    __handlePickFile = null,
    __handleEditRichText = null,
    __allowNameEdit = true
  } = $props()

  // Local state for the draft before saving
  let draftName = $state(__variable?.rawValue?.name || __variable?.name || '')
  let draftType = $state(
    __variable?.rawValue?.type || __variable?.type || VariableManipulatorUtils.VAR_TYPE.text
  )
  let draftValue = $state(__variable?.rawValue?.value ?? __variable?.value ?? '')
  let draftFormat = $state(__variable?.rawValue?.format || VariableManipulatorUtils.EXCEL_FORMATS.GENERAL)
  let draftAutoUpdate = $state(Boolean(__variable?.rawValue?.autoUpdate))
  let nameError = $state('')
  let showAdvanced = $state(false)
  let draftAliases = $state((__variable?.rawValue?.aliases || []).join(', '))
  let draftDescription = $state(__variable?.rawValue?.description || '')
  let draftVisibility = $state(__variable?.rawValue?.visibility || 'package')
  let draftAccess = $state((__variable?.rawValue?.permissions?.access || []).join(', '))
  let draftRead = $state((__variable?.rawValue?.permissions?.read || []).join(', '))
  let draftWrite = $state((__variable?.rawValue?.permissions?.write || []).join(', '))
  let resolvedVar = $state<any>(__variable)
  let previewValue = $derived(getVariableDisplayValue(resolvedVar || __variable, { plainText: true }))
  let sourceLabel = $derived(
    (resolvedVar?.rawValue?.source || __variable?.rawValue?.source || 'user') === 'ai' ? 'AI' : 'User'
  )

  const parseListInput = (value: string) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  const parsePermissionInput = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return null
    return parseListInput(trimmed)
  }

  const TYPE_CONFIG = {
    text: { icon: 'ph-light ph-text-t', color: 'text-blue-400', label: 'Text' },
    ai: { icon: 'ph-light ph-sparkle', color: 'text-purple-400', label: 'AI Prompt' },
    file: { icon: 'ph-light ph-file-plus', color: 'text-orange-400', label: 'File' },
    folder: { icon: 'ph-light ph-folder-plus', color: 'text-yellow-400', label: 'Folder' },
    richtext: { icon: 'ph-light ph-article', color: 'text-green-400', label: 'Rich Text' },
    datetime: { icon: 'ph-light ph-calendar', color: 'text-emerald-400', label: 'Datetime' },
    spreadsheet: { icon: 'ph-light ph-table', color: 'text-cyan-400', label: 'Spreadsheet' }
  };

  const activeDocStore = _$_documentEditorsList.getActive()
  let activeDoc = $derived($activeDocStore)

  const resolveFromStore = () => {
    if (!activeDoc || !__variable) return __variable
    const vars = listVariables([], activeDoc)
    const byId = vars.find((v) => v.name === __variable?.name)
    if (byId) return byId
    const id = getVariableId(__variable?.name, activeDoc) || __variable?.name
    return vars.find((v) => v.name === id) || __variable
  }

  const getSpreadsheetDisplayName = (value: string) => formatSpreadsheetRefName(value)
  const isSpreadsheetVar = $derived(
    draftType === VariableManipulatorUtils.VAR_TYPE.spreadsheet ||
      formatSpreadsheetRefName(String(draftName ?? '')) !== String(draftName ?? '')
  )

  const syncDraftFromResolved = (source: any) => {
    if (!source) return
    draftName = source?.rawValue?.name || source?.name || ''
    draftType = source?.rawValue?.type || source?.type || VariableManipulatorUtils.VAR_TYPE.text
    draftValue = source?.rawValue?.value ?? source?.value ?? ''
    draftFormat = __variable?.rawValue?.format || VariableManipulatorUtils.EXCEL_FORMATS.GENERAL
    draftAutoUpdate = Boolean(__variable?.rawValue?.autoUpdate)
    draftAliases = (source?.rawValue?.aliases || []).join(', ')
    draftDescription = source?.rawValue?.description || ''
    draftVisibility = source?.rawValue?.visibility || 'package'
    draftAccess = (source?.rawValue?.permissions?.access || []).join(', ')
    draftRead = (source?.rawValue?.permissions?.read || []).join(', ')
    draftWrite = (source?.rawValue?.permissions?.write || []).join(', ')
  }

  $effect(() => {
    const nextResolved = resolveFromStore()
    resolvedVar = nextResolved
    syncDraftFromResolved(nextResolved)
  })

  const unsubscribe = onVariableChange?.(() => {
    if (!activeDoc) return
    const nextResolved = resolveFromStore()
    resolvedVar = nextResolved
    syncDraftFromResolved(nextResolved)
  })

  onDestroy(() => {
    if (typeof unsubscribe === 'function') unsubscribe()
  })

  function getPayload() {
    const basePayload = buildVariablePayload(
      draftType,
      draftValue,
      __variable?.rawValue,
      draftFormat,
      draftAutoUpdate
    )
    return {
      ...basePayload,
      name: normalizeVariableName(draftName),
      aliases: parseListInput(draftAliases),
      description: draftDescription?.trim() || undefined,
      visibility: draftVisibility || undefined,
      permissions: {
        access: parsePermissionInput(draftAccess),
        read: parsePermissionInput(draftRead),
        write: parsePermissionInput(draftWrite)
      }
    }
  }

  async function handleSave() {
    const nextName = normalizeVariableName(draftName)

    if (!nextName) {
      nameError = 'Please enter a variable name.'
      toast.error(nameError, {
        position: 'bottom-start',
        style: 'background: #333; color: #fff; font-size: 12px; border: 1px solid #f44336;'
      })
      return
    }

    const currentName = resolvedVar?.rawValue?.name || resolvedVar?.name || ''
    if (nextName !== currentName) {
      const vars = activeDoc ? listVariables([], activeDoc) : []
      if (isNameTaken(nextName, vars)) {
        nameError = `Variable "${nextName}" already exists.`
        toast.error(nameError, {
          position: 'bottom-start',
          style: 'background: #333; color: #fff; font-size: 12px; border: 1px solid #f44336;'
        })
        draftName = currentName
        return
      }
    }

    const payload = { ...getPayload(), name: nextName }
    if (activeDoc) {
      const resolvedId =
        resolvedVar?.name ||
        getVariableId(__variable?.name, activeDoc) ||
        __variable?.name ||
        nextName
      if (nextName !== currentName) {
        renameVariable(resolvedId, nextName, activeDoc)
      }
      setVariable(resolvedId, payload, activeDoc)
    }

    __onSave?.({
      ...__variable,
      name: __variable?.name,
      value: draftValue,
      type: draftType,
      rawValue: payload
    })
  }

  async function handleDelete() {
    if (activeDoc) {
      deleteVariable(__variable?.name, activeDoc)
    }
    __onDelete?.()
  }

  async function handlePick(kind: 'file' | 'folder') {
    const result =
      kind === 'file'
        ? await window.api.openDialogFile?.()
        : await window.api.openDialogDirectory?.()
    if (!result) return
    draftType = kind === 'file' ? VariableManipulatorUtils.VAR_TYPE.file : VariableManipulatorUtils.VAR_TYPE.folder
    draftValue = result
  }

  async function handlePickSpreadsheet() {
    const result = await window.api.openDialogFile?.()
    if (!result) return
    draftType = VariableManipulatorUtils.VAR_TYPE.spreadsheet
    draftValue = result
  }

  const getSourceLabel = (value: string) => {
    if (!value) return ''
    try {
      const ext = nodeApi?.path?.extname?.(value) || ''
      return nodeApi?.path?.basename?.(value, ext) || value
    } catch {
      return value
    }
  }
</script>

<div class="w-[280px] bg-base-300 text-base-content font-sans text-[12px] flex flex-col shadow-xl rounded-sm border border-base-100 overflow-hidden">
  
  <div class="px-3 py-2 bg-base-200 border-b border-base-100 flex justify-between items-center">
    <div class="flex items-center gap-2">
      <i class="{TYPE_CONFIG[draftType]?.icon} {TYPE_CONFIG[draftType]?.color} text-[16px]"></i>
      <span class="font-bold uppercase tracking-widest text-[10px] opacity-50">Edit {TYPE_CONFIG[draftType]?.label}</span>
    </div>
    <div class="flex items-center gap-2">
      <span
        class="px-1.5 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-[0.2em] border"
        class:bg-purple-500-20={sourceLabel === 'AI'}
        class:text-purple-300={sourceLabel === 'AI'}
        class:border-purple-500-30={sourceLabel === 'AI'}
        class:bg-emerald-500-10={sourceLabel === 'User'}
        class:text-emerald-200={sourceLabel === 'User'}
        class:border-emerald-500-30={sourceLabel === 'User'}
      >
        {sourceLabel}
      </span>
    <button 
      onclick={handleDelete}
      class="hover:text-error transition-colors p-1"
      title={$_('Delete Variable')}
    >
      <i class="ph-light ph-trash text-[14px]"></i>
    </button>
    </div>
  </div>

  <div class="p-3 space-y-4">
    {#if __allowNameEdit}
      <div class="space-y-1.5">
        <label class="text-[10px] font-bold opacity-40 uppercase tracking-tighter" for="var-name">{$_('Variable Name')}</label>
        <div class="relative">
          <i class="ph-light ph-tag absolute left-2 top-1/2 -translate-y-1/2 opacity-30"></i>
          {#if isSpreadsheetVar}
            <input
              id="var-name"
              type="text"
              value={getSpreadsheetDisplayName(draftName)}
              readonly
              class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1.5 pl-7 pr-2 outline-none focus:ring-1 focus:ring-primary/50 transition-all text-[11px] opacity-60"
            />
          {:else}
            <input
              id="var-name"
              type="text"
              bind:value={draftName}
              class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1.5 pl-7 pr-2 outline-none focus:ring-1 focus:ring-primary/50 transition-all text-[11px]"
              oninput={() => (nameError = '')}
            />
          {/if}
        </div>
        {#if nameError}
          <div class="text-[10px] text-red-400">{nameError}</div>
        {/if}
      </div>
    {/if}

    <div class="space-y-1.5">
      <label class="text-[10px] font-bold opacity-40 uppercase tracking-tighter" for="var-value">{$_('Value / Source')}</label>
      
      {#if draftType === 'file'}
        <button 
          class="theme-edit-btn w-full"
          onclick={() => handlePick('file')}
        >
          <i class="ph-light ph-folder-open mr-2"></i> 
          {draftValue ? 'Change File' : 'Select File'}
        </button>
        {#if draftValue}
          <div class="text-[10px] opacity-50 truncate mt-1 italic">{draftValue}</div>
        {:else if previewValue}
          <div class="text-[10px] opacity-50 truncate mt-1 italic">{previewValue}</div>
        {/if}

      {:else if draftType === 'folder'}
        <button
          class="theme-edit-btn w-full"
          onclick={() => handlePick('folder')}
        >
          <i class="ph-light ph-folder-plus mr-2"></i>
          {draftValue ? 'Change Folder' : 'Select Folder'}
        </button>
        {#if draftValue}
          <div class="text-[10px] opacity-50 truncate mt-1 italic">{draftValue}</div>
        {:else if previewValue}
          <div class="text-[10px] opacity-50 truncate mt-1 italic">{previewValue}</div>
        {/if}

      {:else if isSpreadsheetVar}
        <button 
          class="theme-edit-btn w-full"
          onclick={handlePickSpreadsheet}
          disabled
        >
          <i class="ph-light ph-table mr-2"></i>
          {draftValue ? 'Spreadsheet Source' : 'Spreadsheet Source'}
        </button>
        {#if draftValue}
          <div class="text-[10px] opacity-50 truncate mt-1 italic">{getSourceLabel(draftValue)}</div>
        {:else if previewValue}
          <div class="text-[10px] opacity-50 truncate mt-1 italic">{previewValue}</div>
        {/if}
        {#if draftName}
          <div class="mt-1 rounded bg-base-200 px-2 py-1 text-[10px] text-base-content/70">
            {getSpreadsheetDisplayName(draftName)}
          </div>
        {/if}

      {:else if draftType === 'richtext'}
        <button 
          class="theme-edit-btn w-full"
          onclick={() => __handleEditRichText?.(__variable)}
        >
          <i class="ph-light ph-pencil-line mr-2"></i> {$_('Edit Content')}
        </button>

      {:else if draftType === 'ai'}
        <textarea
          id="var-value"
          bind:value={draftValue}
          placeholder={$_('Enter AI instructions...')}
          class="w-full bg-base-100 border border-base-100 rounded-[2px] p-2 h-20 outline-none focus:ring-1 focus:ring-primary/50 text-[11px] resize-none"
        ></textarea>

      {:else if draftType === 'datetime'}
        <div class="flex flex-col gap-2">
          <input
            id="var-value"
            type="datetime-local"
            bind:value={draftValue}
            class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1.5 px-2 outline-none focus:ring-1 focus:ring-primary/50 text-[11px]"
          />
          <div class="flex items-center gap-2">
            <select
              class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
              bind:value={draftFormat}
            >
              {#each Object.entries(VariableManipulatorUtils.FORMAT_LABELS) as [value, label]}
                <option value={VariableManipulatorUtils.EXCEL_FORMATS[value]}>{label}</option>
              {/each}
            </select>
            <label class="flex items-center gap-1 text-[9px] opacity-70">
              <input
                type="checkbox"
                checked={draftAutoUpdate}
                onchange={(e) => (draftAutoUpdate = (e.target as HTMLInputElement).checked)}
              />
              Auto
            </label>
          </div>
        </div>
      
      {:else}
        <VariableCodexInput
          className="w-full bg-base-100 border border-base-100 rounded-[2px] py-1.5 px-2 outline-none focus:ring-1 focus:ring-primary/50 text-[11px]"
          value={draftValue}
          documentEditor={activeDoc}
          onChange={(nextValue) => (draftValue = nextValue)}
        />
      {/if}
    </div>
    {#if draftType === 'text'}
      <div class="space-y-1">
        <label class="text-[10px] font-bold opacity-40 uppercase tracking-tighter">{$_('Format')}</label>
        <select
          class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
          bind:value={draftFormat}
        >
          {#each Object.entries(VariableManipulatorUtils.FORMAT_LABELS) as [value, label]}
            <option value={VariableManipulatorUtils.EXCEL_FORMATS[value]}>{label}</option>
          {/each}
        </select>
      </div>
    {/if}

    <button
      onclick={() => (showAdvanced = !showAdvanced)}
      class="text-[9px] text-primary hover:underline self-start flex items-center gap-1"
    >
      {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
    </button>

    {#if showAdvanced}
      <div class="grid grid-cols-1 gap-2 text-[10px]">
        <div class="flex flex-col gap-1">
          <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Aliases')}</span>
          <input
            type="text"
            class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
            bind:value={draftAliases}
            placeholder={$_('Comma separated')}
          />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Description')}</span>
          <input
            type="text"
            class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
            bind:value={draftDescription}
            placeholder={$_('Optional description')}
          />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Visibility')}</span>
          <select
            class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
            bind:value={draftVisibility}
          >
            <option value="document">{$_('Document')}</option>
            <option value="package">{$_('Package')}</option>
            <option value="desktop">{$_('Desktop')}</option>
            <option value="cloud">{$_('Cloud')}</option>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Access')}</span>
          <input
            type="text"
            class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
            bind:value={draftAccess}
            placeholder={$_('Emails (empty = everyone)')}
          />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Read')}</span>
          <input
            type="text"
            class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
            bind:value={draftRead}
            placeholder={$_('Emails (empty = everyone)')}
          />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Write')}</span>
          <input
            type="text"
            class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
            bind:value={draftWrite}
            placeholder={$_('Emails (empty = everyone)')}
          />
        </div>
      </div>
    {/if}
  </div>

  <div class="px-3 py-2 bg-base-200/50 border-t border-base-100 flex gap-2">
    <button
      onclick={handleSave}
      class="flex-grow bg-primary hover:brightness-110 text-primary-content py-1.5 rounded-[2px] font-bold text-[10px] uppercase tracking-widest transition-all"
    >
      {$_('Apply Changes')}
    </button>
  </div>
</div>

<style>
  .theme-edit-btn {
    @apply flex items-center justify-center bg-[var(--color-base-100)] border border-[var(--color-base-100)] rounded-[2px] py-2 text-[11px] font-semibold hover:bg-primary/10 hover:border-primary/40 transition-all;
  }

  /* Custom thin scrollbar for textarea */
  textarea::-webkit-scrollbar { width: 3px; }
  textarea::-webkit-scrollbar-thumb { @apply bg-[var(--color-base-300)]; }
</style>
