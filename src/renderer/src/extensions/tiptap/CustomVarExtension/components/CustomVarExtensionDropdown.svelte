<script lang="ts">
  import { _ } from 'svelte-i18n'
  import toast from 'svelte-hot-french-toast'
  import { _$_documentEditorsList } from '../../../../stores/editor.store'
  import {
    listVariables,
    defineVariable,
    setVariable,
    renameVariable,
    listSpreadsheetPointers,
    VariableManipulatorUtils
  } from '../stores/variableManipulator'
  import {
    buildVariablePayload,
    requiresValue,
    normalizeVariableName,
    isNameTaken
  } from '../utils/variableForm.utils'
  import { formatSpreadsheetRefName } from '../utils/utils'
  import { nodeApi } from '../../../../utils/shims/node'

  // CustomVarExtensionDropdown
  // Svelte 5 Props
  let {
    items = [],
    activeIndex = 0,
    query = '',
    position = { x: 0, y: 0 },
    selectItem = () => {},
    onAddVariable = null,
    handlePickFile = () => {},
    handlePickFolder = () => {},
    handleEditRichText = () => {}
  } = $props()

  let container = $state<HTMLElement>()
  let newVarName = $state('')
  let newVarValue = $state('')
  let newVarFormat = $state(VariableManipulatorUtils.EXCEL_FORMATS.GENERAL)
  let newVarAutoUpdate = $state(false)
  let selectedType = $state(VariableManipulatorUtils.VAR_TYPE.text)
  let valueDirty = $state(false)
  let advancedDirty = $state(false)
  let nameError = $state('')
  let editingOriginalName = $state<string | null>(null)
  let _vars = $state<any[]>([])
  let showAdvanced = $state(false)
  let advAliases = $state('')
  let advDescription = $state('')
  let advVisibility = $state('package')
  let advAccess = $state('')
  let advRead = $state('')
  let advWrite = $state('')
  // let _spreadsheetPointers = $state<{ id: string; name?: string; path: string }[]>([])
  let _sheetRefId = $state('')
  let _sheetRefName = $state('')
  let _sheetCellRef = $state('A1')
  let _sheetUseName = $state(true)

  const activeDocStore = _$_documentEditorsList.getActive()
  let activeDoc = $derived($activeDocStore)

  let _spreadsheetPointers = $derived.by(() => {
    return listSpreadsheetPointers(activeDoc)
  })

  const getWorkbookLabel = (path?: string) => {
    if (!path) return ''
    try {
      const ext = nodeApi?.path?.extname?.(path) || ''
      return nodeApi?.path?.basename?.(path, ext) || path
    } catch {
      return path
    }
  }

  const getSpreadsheetPointerLabel = (pointer: any) => {
    const sheetLabel = pointer?.name || pointer?.id
    const workbookLabel = getWorkbookLabel(pointer?.path)
    return workbookLabel ? `${sheetLabel} • ${workbookLabel}` : sheetLabel
  }

  const getDisplayName = (v: any) => {
    const base = v?.rawValue?.name || v?.name || ''
    const type = v?.rawValue?.type
    if (type !== VariableManipulatorUtils.VAR_TYPE.spreadsheet) return base
    const stripped = formatSpreadsheetRefName(base)
    if (stripped !== base) return stripped
    if (typeof v?.rawValue?.value === 'string') {
      const fromValue = formatSpreadsheetRefName(v.rawValue.value)
      if (fromValue !== v.rawValue.value) return fromValue
    }
    return base
  }

  const formatRefName = (name: string, type?: string) => {
    if (!name) return ''
    if (type === VariableManipulatorUtils.VAR_TYPE.spreadsheet) return formatSpreadsheetRefName(name)
    const stripped = formatSpreadsheetRefName(name)
    return stripped !== name ? stripped : name
  }
  const isAiItem = (item: any) => (item?.rawValue?.source || item?.source) === 'ai'
  const getEditingDisplayName = () => {
    if (!editingOriginalName) return ''
    const existing = _vars.find((v) => v.name === editingOriginalName)
    return existing ? getDisplayName(existing) : editingOriginalName
  }
  const listToInput = (value?: string[] | null) =>
    Array.isArray(value) ? value.filter(Boolean).join(', ') : ''
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

  // Recent History State (In a real app, you could sync this to localStorage)
  let recentHistory = $state<any[]>([])

  const TYPE_CONFIG = {
    text: { icon: 'ph-light ph-text-t', color: 'text-blue-400' },
    ai: { icon: 'ph-light ph-sparkle', color: 'text-purple-400' },
    file: { icon: 'ph-light ph-file-plus', color: 'text-orange-400' },
    folder: { icon: 'ph-light ph-folder-plus', color: 'text-yellow-400' },
    richtext: { icon: 'ph-light ph-article', color: 'text-green-400' }
  }

  function addToHistory(variable) {
    // Keep only the last 3 unique items
    const filtered = recentHistory.filter((h) => h.name !== variable.name)
    recentHistory = [variable, ...filtered].slice(0, 3)
  }

  $effect(() => {
    if (!activeDoc) return
    _vars = listVariables([], activeDoc)
    if (_spreadsheetPointers.length && !_sheetRefId) {
      _sheetRefId = _spreadsheetPointers[0].id
      _sheetRefName = _spreadsheetPointers[0].name || 'Sheet1'
    }
  })

  $effect(() => {
    if (!newVarName && query) {
      newVarName = query
    }
  })

  $effect(() => {
    if (!newVarName) {
      editingOriginalName = null
      nameError = ''
      advancedDirty = false
      return
    }

    const name = normalizeVariableName(newVarName)
    const match = _vars.find((v) => getDisplayName(v).toLowerCase() === name.toLowerCase())

    if (match && !editingOriginalName) {
      editingOriginalName = match.name
      if (!valueDirty) {
        const type = match.rawValue?.type || VariableManipulatorUtils.VAR_TYPE.text
        selectedType = type
        newVarFormat = match.rawValue?.format || VariableManipulatorUtils.EXCEL_FORMATS.GENERAL
        newVarAutoUpdate = Boolean(match.rawValue?.autoUpdate)
        if (type === VariableManipulatorUtils.VAR_TYPE.ai) {
          newVarValue = match.rawValue?.prompt || ''
        } else if (
          type === VariableManipulatorUtils.VAR_TYPE.file ||
          type === VariableManipulatorUtils.VAR_TYPE.folder
        ) {
          newVarValue = match.rawValue?.url || ''
        } else {
          newVarValue = match.rawValue?.value ?? match.value ?? ''
        }
      }
      if (!advancedDirty) {
        advAliases = listToInput(match.rawValue?.aliases)
        advDescription = match.rawValue?.description || ''
        advVisibility = match.rawValue?.visibility || 'package'
        advAccess = listToInput(match.rawValue?.permissions?.access)
        advRead = listToInput(match.rawValue?.permissions?.read)
        advWrite = listToInput(match.rawValue?.permissions?.write)
      }
    }
  })

  async function handleAddOrUpdate() {
    const name = normalizeVariableName(newVarName)
    const input = String(newVarValue || '').trim()
    const existingVar = editingOriginalName
      ? _vars.find((v) => v.name === editingOriginalName)
      : null
    const currentName = existingVar ? getDisplayName(existingVar) : ''
    const isRename = Boolean(editingOriginalName && currentName && currentName !== name)

    if (!name) {
      nameError = 'Please enter a variable name.'
      toast.error(nameError, {
        position: 'bottom-start',
        style: 'background: #333; color: #fff; font-size: 12px; border: 1px solid #f44336;'
      })
      return
    }

    const taken = isNameTaken(name, _vars)
    if (taken && (!editingOriginalName || isRename)) {
      nameError = `Variable "${name}" already exists. Choose another name.`
      toast.error(nameError, {
        position: 'bottom-start',
        style: 'background: #333; color: #fff; font-size: 12px; border: 1px solid #f44336;'
      })
      return
    }

    if (requiresValue(selectedType) && !input) {
      nameError = ''
      toast.error('Please enter a variable value.', {
        position: 'bottom-start',
        style: 'background: #333; color: #fff; font-size: 12px; border: 1px solid #f44336;'
      })
      return
    }

    const payload = buildVariablePayload(
      selectedType,
      input,
      existingVar?.rawValue,
      newVarFormat,
      newVarAutoUpdate
    )
    const advancedPayload = {
      name,
      aliases: parseListInput(advAliases),
      description: advDescription?.trim() || undefined,
      visibility: advVisibility || undefined,
      permissions: {
        access: parsePermissionInput(advAccess),
        read: parsePermissionInput(advRead),
        write: parsePermissionInput(advWrite)
      }
    }

    if (!activeDoc) return

    if (editingOriginalName) {
      if (isRename) {
        renameVariable(editingOriginalName, name, activeDoc)
      }
      setVariable(editingOriginalName || name, { ...payload, ...advancedPayload }, activeDoc)
    } else {
      defineVariable(name, { ...payload, ...advancedPayload }, true, activeDoc)
    }

    onAddVariable?.({ name, type: selectedType, value: input })
    addToHistory({ name, type: selectedType })
    newVarName = ''
    newVarValue = ''
    newVarFormat = VariableManipulatorUtils.EXCEL_FORMATS.GENERAL
    newVarAutoUpdate = false
    selectedType = VariableManipulatorUtils.VAR_TYPE.text
    valueDirty = false
    editingOriginalName = null
    nameError = ''
    showAdvanced = false
    advAliases = ''
    advDescription = ''
    advVisibility = 'package'
    advAccess = ''
    advRead = ''
    advWrite = ''
    advancedDirty = false
  }

  async function handlePick(kind: 'file' | 'folder') {
    const result =
      kind === 'file'
        ? await window.api.openDialogFile?.()
        : await window.api.openDialogDirectory?.()
    if (!result) return
    newVarValue = result
    selectedType =
      kind === 'file'
        ? VariableManipulatorUtils.VAR_TYPE.file
        : VariableManipulatorUtils.VAR_TYPE.folder
    valueDirty = true
  }

  function buildSpreadsheetReference(): string {
    if (!_sheetRefId || !_sheetCellRef) return ''
    const cleanCell = _sheetCellRef.trim().toUpperCase()
    if (_sheetUseName && _sheetRefName) {
      return `${_sheetRefId}!${_sheetRefName}!${cleanCell}`
    }
    return `${_sheetRefId}!${cleanCell}`
  }

  function insertSpreadsheetReference() {
    const ref = buildSpreadsheetReference()
    if (!ref) return
    selectItem?.({ name: ref, value: ref })
  }

  $effect(() => {
    if (!_spreadsheetPointers.length) return
    if (_sheetRefId) return
    _sheetRefId = _spreadsheetPointers[0].id
    _sheetRefName = _spreadsheetPointers[0].name || 'Sheet1'
  })

  /* $effect(() => {
    if (container) {
      // Use fixed to ensure it floats over everything
      container.style.position = 'fixed'
      container.style.left = `${position.x}px`
      container.style.top = `${position.y}px`
    }
  }) */
</script>

<div
  bind:this={container}
  class="fixed z-[10000] w-72 bg-base-300 border border-base-100 shadow-2xl rounded-sm overflow-hidden flex flex-col font-sans text-[12px]"
  style:left="{position?.x ?? 0}px"
  style:top="{position?.y ?? 0}px"
  style:visibility={position?.x ? 'visible' : 'hidden'}
>
  <div class="flex items-center gap-0.5 p-1 bg-base-200 border-b border-base-100">
    {#each Object.entries(TYPE_CONFIG) as [type, cfg]}
      <button
        onclick={() => (selectedType = type)}
        class="flex-grow py-1 flex justify-center rounded-[2px] transition-all"
        class:bg-base-100={selectedType === type}
        class:shadow-sm={selectedType === type}
      >
        <i class="{cfg.icon} text-[16px] {selectedType === type ? cfg.color : 'opacity-30'}"></i>
      </button>
    {/each}
  </div>

  <div class="p-2 flex flex-col gap-2 bg-base-100">
    <input
      type="text"
      bind:value={newVarName}
      placeholder={$_('Variable name...')}
      class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 outline-none focus:ring-1 focus:ring-primary/40 text-[11px]"
      oninput={() => {
        if (nameError) nameError = ''
        editingOriginalName = null
      }}
    />
    {#if nameError}
      <div class="text-[10px] text-red-400">{nameError}</div>
    {/if}
    {#if editingOriginalName}
      <div class="text-[9px] text-emerald-300/80">
        Editing existing variable: {getEditingDisplayName()}
      </div>
    {/if}

    <div class="flex gap-1.5">
      {#if selectedType === 'file'}
        <button class="theme-action-btn flex-grow" onclick={() => handlePick('file')}>
          <i class="ph-light ph-file-plus mr-2"></i>
          {$_('Pick File')}
        </button>
      {:else if selectedType === 'folder'}
        <button class="theme-action-btn flex-grow" onclick={() => handlePick('folder')}>
          <i class="ph-light ph-folder-plus mr-2"></i>
          {$_('Pick Folder')}
        </button>
      {:else if selectedType === 'richtext'}
        <button class="theme-action-btn flex-grow" onclick={() => handleEditRichText?.(newVarName)}>
          <i class="ph-light ph-article mr-2"></i>
          {$_('Edit Text')}
        </button>
      {:else}
        <input
          class="flex-grow bg-base-200/50 rounded-[2px] border border-transparent text-[11px] px-2 py-1 outline-none"
          placeholder={selectedType === 'ai' ? 'AI prompt...' : 'Value...'}
          bind:value={newVarValue}
          oninput={() => (valueDirty = true)}
        />
      {/if}

      <button
        onclick={handleAddOrUpdate}
        class="bg-primary hover:brightness-110 text-primary-content px-4 py-1 rounded-[2px] font-bold text-[10px] uppercase tracking-wider"
      >
        {editingOriginalName ? 'Update' : 'Add'}
      </button>
    </div>
    {#if selectedType === VariableManipulatorUtils.VAR_TYPE.text || selectedType === VariableManipulatorUtils.VAR_TYPE.datetime}
      <div class="flex items-center gap-2">
        <select
          class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
          bind:value={newVarFormat}
        >
          {#each Object.entries(VariableManipulatorUtils.FORMAT_LABELS) as [value, label]}
            <option value={VariableManipulatorUtils.EXCEL_FORMATS[value]}>{label}</option>
          {/each}
        </select>
        {#if selectedType === VariableManipulatorUtils.VAR_TYPE.datetime}
          <label class="flex items-center gap-1 text-[9px] opacity-70">
            <input
              type="checkbox"
              checked={newVarAutoUpdate}
              onchange={(e) => (newVarAutoUpdate = (e.target as HTMLInputElement).checked)}
            />
            Auto
          </label>
        {/if}
      </div>
    {/if}

    {#if selectedType === VariableManipulatorUtils.VAR_TYPE.text && _spreadsheetPointers.length}
      <div class="rounded-[2px] border border-base-100 bg-base-200/60 p-2 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-[9px] uppercase tracking-[0.2em] text-base-content/50">
            {$_('Spreadsheet Reference')}
          </span>
          <label class="flex items-center gap-1 text-[9px] text-base-content/40">
            <input type="checkbox" class="toggle toggle-xs" bind:checked={_sheetUseName} />
            {$_('Use sheet name')}
          </label>
        </div>
        <div class="grid grid-cols-[1fr_120px] gap-2">
          <select
            class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
            bind:value={_sheetRefId}
            onchange={() => {
              const match = _spreadsheetPointers.find((s) => s.id === _sheetRefId)
              _sheetRefName = match?.name || 'Sheet1'
            }}
          >
            {#each _spreadsheetPointers as sheet}
              <option value={sheet.id}>{getSpreadsheetPointerLabel(sheet)}</option>
            {/each}
          </select>
          <input
            type="text"
            class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
            placeholder={$_('Sheet1')}
            bind:value={_sheetRefName}
            disabled={!_sheetUseName}
          />
        </div>
        <div class="grid grid-cols-[1fr_90px] gap-2">
          <input
            type="text"
            class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
            placeholder={$_('A1 or A1:B2')}
            bind:value={_sheetCellRef}
          />
          <button
            class="bg-primary hover:brightness-110 text-primary-content px-2 py-1 rounded-[2px] text-[9px] uppercase"
            onclick={insertSpreadsheetReference}
          >
            {$_('Insert')}
          </button>
        </div>
        <div class="text-[9px] text-base-content/40">
          {buildSpreadsheetReference()}
        </div>
      </div>
    {/if}

    <button
      onclick={() => (showAdvanced = !showAdvanced)}
      class="text-[9px] text-primary hover:underline self-start flex items-center gap-1"
    >
      {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
    </button>

    {#if showAdvanced}
      <div class="flex flex-col gap-2 animate-in fade-in duration-200">
        <div class="flex flex-col gap-1">
          <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Aliases')}</span>
          <input
            type="text"
            class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
            placeholder={$_('Comma separated')}
            bind:value={advAliases}
            oninput={() => (advancedDirty = true)}
          />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Description')}</span>
          <input
            type="text"
            class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
            placeholder={$_('Optional description')}
            bind:value={advDescription}
            oninput={() => (advancedDirty = true)}
          />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Visibility')}</span>
          <select
            class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
            bind:value={advVisibility}
            onchange={() => (advancedDirty = true)}
          >
            <option value="document">{$_('Document')}</option>
            <option value="package">{$_('Package')}</option>
            <option value="desktop">{$_('Desktop')}</option>
            <option value="cloud">{$_('Cloud')}</option>
          </select>
        </div>
        <div class="grid grid-cols-1 gap-2">
          <div class="flex flex-col gap-1">
            <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Access')}</span>
            <input
              type="text"
              class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
              placeholder={$_('Emails (empty = everyone)')}
              bind:value={advAccess}
              oninput={() => (advancedDirty = true)}
            />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Read')}</span>
            <input
              type="text"
              class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
              placeholder={$_('Emails (empty = everyone)')}
              bind:value={advRead}
              oninput={() => (advancedDirty = true)}
            />
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Write')}</span>
            <input
              type="text"
              class="w-full bg-base-100 border border-base-100 rounded-[2px] py-1 px-2 text-[10px]"
              placeholder={$_('Emails (empty = everyone)')}
              bind:value={advWrite}
              oninput={() => (advancedDirty = true)}
            />
          </div>
        </div>
      </div>
    {/if}
  </div>

  <div class="max-h-40 overflow-y-auto py-1">
    <div class="px-3 py-1 text-[9px] font-bold opacity-30 uppercase tracking-widest">
      {$_('Suggestions')}
    </div>
    {#if items.length === 0}
      <div class="px-3 py-2 text-[10px] opacity-50">{$_('No matches')}</div>
    {/if}
    {#each items as item, i}
      <button
        class="w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors border-l-2 border-transparent"
        class:bg-primary-10={i === activeIndex}
        class:border-primary={i === activeIndex}
        onmousedown={(e) => {
          e.preventDefault()
          selectItem(item)
        }}
      >
        <i class="ph-light {TYPE_CONFIG[item.type]?.icon || 'ph-variable'} opacity-40"></i>
        <span class="truncate flex-grow">{formatRefName(item.name, item.type)}</span>
        {#if isAiItem(item)}
          <span
            class="ml-1 px-1.5 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-[0.2em] bg-purple-500/20 text-purple-300 border border-purple-500/30"
          >{$_('AI')}</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if recentHistory.length > 0}
    <div class="border-t border-base-100 bg-base-200/80 pb-1">
      <div
        class="px-3 py-2 text-[9px] font-bold opacity-30 uppercase tracking-widest flex justify-between"
      >
        <span>{$_('Recent')}</span>
        <i class="ph-light ph-clock-counter-clockwise"></i>
      </div>
      {#each recentHistory as hist}
        <button
          onclick={() => selectItem(hist)}
          class="w-full text-left px-3 py-1 flex items-center gap-2 opacity-60 hover:opacity-100 hover:bg-base-100 transition-all"
        >
          <i class="ph-light {TYPE_CONFIG[hist.type]?.icon} text-[12px]"></i>
          <span class="truncate text-[11px]">{formatRefName(hist.name, hist.type)}</span>
          {#if isAiItem(hist)}
            <span
              class="ml-1 px-1.5 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-[0.2em] bg-purple-500/20 text-purple-300 border border-purple-500/30"
            >{$_('AI')}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .theme-action-btn {
    @apply flex items-center justify-center bg-[var(--color-base-100)] border border-[var(--color-base-100)] rounded-[2px] py-1 text-[10px] font-semibold hover:bg-primary/10 hover:border-primary/40 transition-all;
  }
</style>
