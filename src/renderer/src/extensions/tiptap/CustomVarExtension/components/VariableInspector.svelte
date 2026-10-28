<script lang="ts">
  import { _, isLoading } from 'svelte-i18n'

  import { onMount } from 'svelte'
  import { debounce } from 'lodash'
  import { NodeSelection, TextSelection } from 'prosemirror-state'
  import {
    listVariables,
    defineVariable,
    setVariable,
    deleteVariable,
    renameVariable,
    undoLastDelete,
    redoLastDelete,
    onVariableChange,
    loadAndDefineVariables,
    loadStacks,
    getVariable,
    validateFormulaInput,
    listSpreadsheetPointers,
    type Variable,
    VariableManipulatorUtils,
    isVariableSyncInProgress
  } from '../stores/variableManipulator'
  import { get } from 'svelte/store'
  import TiptapModalEditor from './TiptapModalEditor.svelte'
  import { nanoid } from 'nanoid'
  import { _$_documentEditorsList } from '../../../../stores/editor.store'
  import type { DocumentEditorModel } from '../../../../models/Document'
  // import { _$_activeDocumentVars } from '../stores/vars.store'
  import { V } from '../../../../utils/svelte'
  import EditorCommonUtils from '../../../../utils/common.utils'
  import { runAI } from '../../CustomAIExtension/utils/utils'
  import { getVariableDisplayValue } from '../utils/variableDisplay.utils'
  import DetachedPanel from '../../components/common/DetachedPanel.svelte'
  import { openConfirmModal } from '../../../../stores/confirmModal.store'
  import { openAlertModal } from '../../../../stores/alertModal.store'
  import toast from 'svelte-hot-french-toast'
  import VariableFormatPicker from './VariableFormatPicker.svelte'
  import VariableCodexInput from './VariableCodexInput.svelte'
  import UpgradeNotice from '../../../../components/common/upgrade/UpgradeNotice.svelte'
  import InfoPopover from '../../../../components/common/info/InfoPopover.svelte'
  import { nodeApi } from '../../../../utils/shims/node'
  import { formatSpreadsheetRefName } from '../utils/utils'
  import { CustomVarExtensionProps } from '../utils/common.utils'

  let _vars: Variable[] = $state([])
  let _search = $state('')
  let _newVariable: Variable = $state({ name: '', value: '', rawValue: {} })
  let _newType: string = $state(VariableManipulatorUtils.VAR_TYPE.text)
  let _newVariableFormat: string = $state(VariableManipulatorUtils.EXCEL_FORMATS.GENERAL)
  let _newVariableAutoUpdate: boolean = $state(false)
  let _showRichEditor = $state(false)
  let _isRichTextVariableEditing = $state(false)
  let _editingVar = $state(null)
  let _nameError = $state('')
  let _showAdvancedNew = $state(false)
  let _newAliases = $state('')
  let _newDescription = $state('')
  let _newVisibility = $state('package')
  let _newAccess = $state('')
  let _newRead = $state('')
  let _newWrite = $state('')
  let _expandedAdvancedVarId = $state<string | null>(null)
  let _spreadsheetPointers = $state<{ id: string; name?: string; path: string }[]>([])
  let _sheetRefId = $state('')
  let _sheetRefName = $state('')
  let _sheetCellRef = $state('A1')
  let _sheetUseName = $state(true)
  let _usageCounts = $state(new Map<string, number>())
  let _sourceFilter = $state<'all' | 'user' | 'ai'>('all')
  const watchCallerId = 'var-inspector'
  // const hasYjsVarStore = () => Boolean((window as any)?._varStore)

  const activeDocumentEditorStore = _$_documentEditorsList.getActive()
  let _activeDocumentEditor: DocumentEditorModel = $state(null)

  const getDisplayName = (v: Variable) => {
    const base = v?.rawValue?.name || v?.name || ''
    const type = v?.rawValue?.type ?? getType(v?.value)
    if (type !== VariableManipulatorUtils.VAR_TYPE.spreadsheet) return base

    const sheetRef = typeof base === 'string' ? base : ''
    const stripped = formatSpreadsheetRefName(sheetRef)
    if (stripped !== sheetRef) return stripped

    if (typeof v?.rawValue?.value === 'string') {
      const fromValue = formatSpreadsheetRefName(v.rawValue.value)
      if (fromValue !== v.rawValue.value) return fromValue
    }

    return base
  }
  const isTableCellVariable = (v: Variable) =>
    Boolean(v?.rawValue?.nodeId) &&
    Number.isFinite(v?.rawValue?.row) &&
    Number.isFinite(v?.rawValue?.col)
  const getAliases = (v: Variable) =>
    Array.isArray(v?.rawValue?.aliases) ? v.rawValue.aliases : []
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

  const getVarKey = (v: Variable) => v?.name || v?.id || v?.rawValue?.name || v?.rawValue?.id || ''

  const getUsageKey = (v: Variable) => v?.rawValue?.name || v?.name || ''
  const getVarSource = (v: Variable) => v?.rawValue?.source || 'user'
  const isAiVar = (v: Variable) => getVarSource(v) === 'ai'

  const escapeSelectorValue = (value: string) => {
    if (typeof window !== 'undefined' && (window as any).CSS?.escape) {
      return (window as any).CSS.escape(value)
    }
    return value.replace(/"/g, '\\"')
  }

  let _draftValues = $state(new Map<string, string>())
  let _draftNames = $state(new Map<string, string>())

  const updateUsageCounts = () => {
    const editor = (_activeDocumentEditor as any)?.editor
    const viewDom = editor?.view?.dom
    if (!viewDom) {
      _usageCounts = new Map()
      return
    }
    const next = new Map<string, number>()
    viewDom.querySelectorAll('[data-variable]').forEach((node) => {
      const name = (node as HTMLElement).dataset?.variable
      if (!name) return
      next.set(name, (next.get(name) || 0) + 1)
    })
    _usageCounts = next
  }

  const getUsageCount = (v: Variable) => {
    const key = getUsageKey(v)
    if (!key) return 0
    return _usageCounts.get(key) || 0
  }

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

  const getDraftValue = (v: Variable) => {
    const key = getVarKey(v)
    if (key && _draftValues.has(key)) return _draftValues.get(key)
    return String(v?.rawValue?.value ?? v?.value ?? '')
  }

  const setDraftValue = (v: Variable, value: string) => {
    const key = getVarKey(v)
    if (!key) return
    const next = new Map(_draftValues)
    next.set(key, value)
    _draftValues = next
  }

  const clearDraftValue = (v: Variable) => {
    const key = getVarKey(v)
    if (!key || !_draftValues.has(key)) return
    const next = new Map(_draftValues)
    next.delete(key)
    _draftValues = next
  }

  const getDraftName = (v: Variable) => {
    const key = getVarKey(v)
    if (key && _draftNames.has(key)) return _draftNames.get(key)
    return getDisplayName(v)
  }

  const setDraftName = (v: Variable, value: string) => {
    const key = getVarKey(v)
    if (!key) return
    const next = new Map(_draftNames)
    next.set(key, value)
    _draftNames = next
  }

  const clearDraftName = (v: Variable) => {
    const key = getVarKey(v)
    if (!key || !_draftNames.has(key)) return
    const next = new Map(_draftNames)
    next.delete(key)
    _draftNames = next
  }

  const isDuplicateName = (candidate: string, currentId: string) => {
    const name = candidate.toLowerCase()
    return _vars.some((v) => {
      if (v.name === currentId) return false
      const display = getDisplayName(v).toLowerCase()
      return display === name
    })
  }

  const commitRename = async (v: Variable, rawInput: string, inputEl?: HTMLInputElement) => {
    if (isTableCellVariable(v)) return
    const currentName = getDisplayName(v)
    const nextName = rawInput.trim()

    if (!nextName) {
      await openAlertModal({
        title: 'Variable',
        message: '⚠️ Please enter a variable name.'
      })
      setDraftName(v, currentName)
      inputEl && (inputEl.value = currentName)
      inputEl?.focus()
      return
    }

    if (nextName !== currentName && isDuplicateName(nextName, v.name)) {
      await openAlertModal({
        title: 'Variable',
        message: `${$_('⚠️ Variable name already exists:')} "${nextName}"`
      })
      setDraftName(v, currentName)
      inputEl && (inputEl.value = currentName)
      inputEl?.focus()
      return
    }

    if (nextName !== currentName) handleRename(v.name, nextName)
    clearDraftName(v)
  }

  // ✅ IMPROVEMENT: Use $derived for filtering.
  // This automatically updates when _vars or _search changes without an explicit function call.
  let filteredVars = $derived(
    _vars
      .filter((v) => {
        const type = v?.rawValue?.type ?? getType(v?.value)
        if (type === VariableManipulatorUtils.VAR_TYPE.spreadsheet) return false
        const source = getVarSource(v)
        if (_sourceFilter !== 'all' && source !== _sourceFilter) return false
        if (!_search) return true
        const search = _search.toLowerCase()
        return (
          getDisplayName(v).toLowerCase().includes(search) ||
          getAliases(v).some((alias) => alias?.toLowerCase().includes(search)) ||
          String(v.value).toLowerCase().includes(search)
        )
      })
      .sort((a, b) => {
        const aSource = getVarSource(a) === 'ai' ? 1 : 0
        const bSource = getVarSource(b) === 'ai' ? 1 : 0
        if (aSource !== bSource) return aSource - bSource
        const usageDiff = getUsageCount(b) - getUsageCount(a)
        if (usageDiff !== 0) return usageDiff
        return getDisplayName(a).localeCompare(getDisplayName(b))
      })
  )

  // Track the current watched path to prevent duplicate watchers
  let currentWatchedPath = ''
  let stopWatching: (() => void) | null = null
  let fileChangeListenerRegistered = false
  let unsubscribeVariableChange: (() => void) | null = null

  // Inside your script tag
  // let _newType = $state(VariableManipulatorUtils.VAR_TYPE.text);
  // let _newVariable = $state({
  //     name: '',
  //     value: '',
  //     prompt: '',
  //     url: ''
  // });
  // A safe "Computed" proxy for the UI to bind to
  const uiBinding = {
    get current() {
      if (typeof _newVariable.rawValue === 'object' && _newVariable.rawValue !== null) {
        if (_newType === 'ai') return _newVariable.rawValue.prompt || ''
        if (_newType === 'file' || _newType === 'folder') return _newVariable.rawValue.url || ''
      }
      // Fallback to the string value
      return _newVariable.value || ''
    },
    set current(v) {
      // 1. If we are in AI mode, ensure rawValue is an object and set prompt
      if (_newType === 'ai') {
        if (typeof _newVariable.rawValue !== 'object') _newVariable.rawValue = {}
        _newVariable.rawValue.prompt = v
      }
      // 2. If we are in File/Folder mode, set the URL
      else if (_newType === 'file' || _newType === 'folder') {
        if (typeof _newVariable.rawValue !== 'object') _newVariable.rawValue = {}
        _newVariable.rawValue.url = v
        // _newVariable.url = v // Sync flat field
      }
      // 3. Otherwise, treat it as a standard value
      else {
        _newVariable.value = v
        _newVariable.rawValue = v
      }
    }
  }

  // Replace $: with $effect
  $effect(() => {
    // 1. Capture current values from the proxy and state
    const type = _newType
    const currentVal = uiBinding.current

    // --- CASE A: AUTO-DETECTION (While in 'text' mode) ---
    if (type === VariableManipulatorUtils.VAR_TYPE.text && typeof currentVal === 'string') {
      // 1. AI Intent Detection
      const aiKeywords = ['write a', 'summarize', 'explain', 'translate', 'generate']
      if (aiKeywords.some((k) => currentVal.toLowerCase().startsWith(k))) {
        // _newType = VariableManipulatorUtils.VAR_TYPE.ai
        // The uiBinding.set logic handles the conversion from string to {prompt: ...}
        uiBinding.current = currentVal
        return
      }

      // 2. Path Intent Detection
      if (currentVal.startsWith('/') || currentVal.includes(':\\')) {
        _newType = VariableManipulatorUtils.VAR_TYPE.file
        uiBinding.current = currentVal
        return
      }

      // 3. Formula Intent Detection (Innovation)
      if (currentVal.startsWith('=')) {
        // Keep as text, but perhaps trigger a 'Formula Mode' UI hint
        console.log('Formula detected')
      }
    }

    // --- CASE B: TYPE MIGRATION (When user manually changes the dropdown) ---
    // Note: If uiBinding is implemented correctly, it handles the 'shape'
    // of rawValue. We just ensure data isn't lost during the swap.

    // If switching to AI but prompt is empty while value has content
    if (type === VariableManipulatorUtils.VAR_TYPE.ai && !currentVal && _newVariable.value) {
      uiBinding.current = _newVariable.value
      _newVariable.value = ''
    }
  })

  $effect(async () => {
    const editor = $activeDocumentEditorStore
    if (editor && editor.id !== _activeDocumentEditor?.id) {
      _activeDocumentEditor = editor

      // ✅ SETUP
      await initInspector()
      const onExternalVarChange = () => refreshFromDisk()
      // if (hasYjsVarStore()) {
      window.addEventListener('dynadoc:variables:change', onExternalVarChange)
      // }

      // ✅ CLEANUP: This runs when the effect re-runs (editor changes) or component destroys
      return () => {
        // If your API supports unwatching:
        if (currentWatchedPath) {
          window.api.unwatchFile?.(currentWatchedPath, watchCallerId)
        }
        stopWatching?.()
        stopWatching = null
        unsubscribeVariableChange?.()
        unsubscribeVariableChange = null
        window.removeEventListener('dynadoc:variables:change', onExternalVarChange)
      }
    }
  })

  function _refreshNow(changedVarsName?: string[]) {
    if (!_activeDocumentEditor) return
    // We only update _vars; filteredVars updates automatically via $derived
    _vars = listVariables(changedVarsName, _activeDocumentEditor)
    _spreadsheetPointers = listSpreadsheetPointers(_activeDocumentEditor)
    updateUsageCounts()
    if (_spreadsheetPointers.length && !_sheetRefId) {
      _sheetRefId = _spreadsheetPointers[0].id
      _sheetRefName = _spreadsheetPointers[0].name || 'Sheet1'
    }
  }

  // Debounce to avoid refresh storms (typing/editing can emit many change signals).
  const refresh = debounce(_refreshNow, 80, { leading: false, trailing: true })

  // When vars.json changes externally (watcher / other window), re-sync from disk then refresh UI.
  const refreshFromDisk = debounce(async () => {
    if (!_activeDocumentEditor) return
    if (isVariableSyncInProgress(_activeDocumentEditor)) return
    await loadAndDefineVariables(_activeDocumentEditor, true)
    _refreshNow()
  }, 180, { leading: false, trailing: true })

  async function watchVarFileChange(): Promise<void> {
    // if (hasYjsVarStore()) return
    if (!window.api?.watchFile || !window.api?.onFileChange) return
    const varStorePath = _activeDocumentEditor?.document.getVarsFilePath()
    if (!varStorePath || varStorePath === currentWatchedPath) return

    currentWatchedPath = varStorePath
    refresh.cancel?.()
    refreshFromDisk.cancel?.()

    // Desktop preload does not provide an unsubscribe; ensure we only register once per inspector.
    if (!fileChangeListenerRegistered) {
      fileChangeListenerRegistered = true
      window.api.onFileChange((_content: string, callerId: string) => {
        if (callerId === watchCallerId) {
          refreshFromDisk()
        }
      })
    }

    stopWatching?.()
    stopWatching = null
    const maybeStop = await window.api.watchFile(varStorePath, watchCallerId)
    stopWatching = typeof maybeStop === 'function' ? maybeStop : null
  }

  async function initInspector() {
    if (!_activeDocumentEditor) return

    await loadAndDefineVariables(_activeDocumentEditor)
    loadStacks()
    _refreshNow()
    void watchVarFileChange()

    // ✅ CRITICAL: Ensure onVariableChange isn't recursively calling refresh
    // if refresh itself triggers a change event.
    // Use a flag or check if the change is external.
    unsubscribeVariableChange?.()
    unsubscribeVariableChange = onVariableChange((_changedName) => {
      if (!isVariableSyncInProgress(_activeDocumentEditor)) {
        refresh()
      }
    })
  }

  function getType(val: any, explicitType?: string): string {
    if (explicitType) return explicitType
    if (val == null) return 'null'
    if (Array.isArray(val)) return 'array'
    if (typeof val === 'object') return 'object'
    if (!isNaN(Number(val))) return 'number'
    if (typeof val === 'string' && val.includes('<p>'))
      return VariableManipulatorUtils.VAR_TYPE.richtext
    return typeof val
  }

  async function watchVarFileChange2(): Promise<void> {
    console.log('watchVarFileChange initInspector', { _activeDocumentEditor })

    // if (hasYjsVarStore()) return
    if (!window.api?.watchFile || !window.api?.onFileChange) return
    window.api.onFileChange((_content: string, callerId: string) => {
      console.log('watchVarFileChange onFileChange', {
        _activeDocumentEditor,
        watchCallerId,
        _content,
        callerId
      })

      if (callerId === watchCallerId) {
        // loadAndDefineVariables(_activeDocumentEditor,true)

        refresh()
      }
    })
    const activeEditor = get(_$_documentEditorsList.getActive())
    const varStorePath = activeEditor?.document.getVarsFilePath()
    if (!varStorePath) return
    await window.api.watchFile(varStorePath, watchCallerId)
  }

  function initInspector2() {
    console.log('loadAndDefineVariables initInspector', _activeDocumentEditor)

    loadAndDefineVariables(_activeDocumentEditor)
    loadStacks()
    refresh()
    watchVarFileChange()
    onVariableChange(() => refresh())
  }

  onMount(() => {
    // _activeDocumentEditor = get(activeDocumentEditorStore)
    // initInspector()
  })

  function getNewVariableInput(): string {
    return String(uiBinding.current ?? '').trim()
  }

  function buildSpreadsheetReference(): string {
    if (!_sheetRefId || !_sheetCellRef) return ''
    const cleanCell = _sheetCellRef.trim().toUpperCase()
    if (_sheetUseName && _sheetRefName) {
      return `${_sheetRefId}!${_sheetRefName}!${cleanCell}`
    }
    return `${_sheetRefId}!${cleanCell}`
  }

  function applySpreadsheetReference() {
    const ref = buildSpreadsheetReference()
    if (!ref) return
    const editor = (_activeDocumentEditor as any)?.editor
    if (editor?.chain) {
      editor.chain().focus().insertContent(`{${ref}}`).run()
      toast.success($_('Spreadsheet reference inserted.'))
      return
    }
    uiBinding.current = ref
    toast.success($_('Spreadsheet reference ready.'))
  }

  function buildVariablePayload(
    type: string,
    input: string,
    existingRawValue?: any,
    format?: string,
    autoUpdate?: boolean
  ) {
    const base = { ...(existingRawValue || {}) }
    const source = base.source || 'user'

    console.log('buildVariablePayload', { base, type, input, existingRawValue, format, autoUpdate })

    if (type === VariableManipulatorUtils.VAR_TYPE.ai) {
      return { ...base, type, prompt: input, value: input, source }
    }

    if (
      type === VariableManipulatorUtils.VAR_TYPE.file ||
      type === VariableManipulatorUtils.VAR_TYPE.folder
    ) {
      return { ...base, type, url: input, value: input, source }
    }

    if (type === VariableManipulatorUtils.VAR_TYPE.datetime) {
      return { ...base, type, value: input, format: format || base.format, autoUpdate, source }
    }

    if (type === VariableManipulatorUtils.VAR_TYPE.richtext) {
      return { ...base, type, value: input, source }
    }

    return { ...base, type, value: input, format: format || base.format, source }
  }

  function requiresValue(type: string) {
    return ![VariableManipulatorUtils.VAR_TYPE.richtext].includes(type)
  }

  function shouldValidateFormula(text: string) {
    const trimmed = (text || '').trim()
    if (!trimmed) return false
    if (trimmed.startsWith('=')) return true
    if (/\{[^}]+\}/.test(trimmed)) return true
    return false
  }

  async function handleAdd() {
    const name = _newVariable.name.trim()
    const input = getNewVariableInput()
    const format = _newVariable?.rawValue?.format || _newVariableFormat || null
    const autoUpdate = _newVariable?.rawValue?.autoUpdate || _newVariableAutoUpdate || null
    let refreshOption = [name]

    if (!name) {
      await openAlertModal({ title: 'Variable', message: '⚠️ Enter a variable name.' })
      return
    }
    const existingVar = _vars.find((v) => getDisplayName(v).toLowerCase() === name.toLowerCase())
    if (existingVar) {
      _nameError = `Variable "${name}" already exists. Choose another name.`
      _search = name
      toast.error(_nameError, {
        position: 'bottom-end',
        style: 'background: #333; color: #fff; font-size: 12px; border: 1px solid #f44336;'
      })
      return
    }

    if (requiresValue(_newType) && !input) {
      await openAlertModal({ title: 'Variable', message: '⚠️ Enter a variable value.' })
      return
    }

    if (shouldValidateFormula(input)) {
      const trimmed = input.trim()
      const validationInput = trimmed.startsWith('=')
        ? trimmed
        : /\{[^}]+\}/.test(trimmed)
          ? `=${trimmed}`
          : trimmed
      const result = validateFormulaInput(validationInput, _activeDocumentEditor)
      if (!result.valid) {
        await openAlertModal({
          title: 'Formula',
          message: result.error || 'Invalid formula.'
        })
        return
      }
    }

    _search = '' // Clear search

    const payload = buildVariablePayload(
      _newType,
      input,
      _newVariable?.rawValue,
      format,
      autoUpdate
    )
    const advancedPayload = {
      name,
      aliases: parseListInput(_newAliases),
      description: _newDescription?.trim() || undefined,
      visibility: _newVisibility || undefined,
      permissions: {
        access: parsePermissionInput(_newAccess),
        read: parsePermissionInput(_newRead),
        write: parsePermissionInput(_newWrite)
      }
    }

    defineVariable(name, { ...payload, ...advancedPayload }, true, _activeDocumentEditor)

    if (_newType === VariableManipulatorUtils.VAR_TYPE.ai && input) {
      refreshOption = null
      runAI(
        input,
        _activeDocumentEditor,
        () => {
          payload.value = '...'
          refresh()
        },
        (chunk) => {
          payload.value += chunk
          refresh()
        },
        (data) => {
          payload.value = data
          setVariable(name, { ...payload, ...advancedPayload }, _activeDocumentEditor)
          refresh()
        }
      )
    }

    refresh(refreshOption)
    _newVariable = { name: '', value: '', rawValue: {} }
    _nameError = ''
    _newVariableFormat = VariableManipulatorUtils.EXCEL_FORMATS.GENERAL
    _newVariableAutoUpdate = false
    _newType = VariableManipulatorUtils.VAR_TYPE.text
    _newAliases = ''
    _newDescription = ''
    _newVisibility = 'package'
    _newAccess = ''
    _newRead = ''
    _newWrite = ''
    _showAdvancedNew = false
    const message = `${$_('Variable added successfully:')} ${name}`
    toast.success(message, {
      position: 'bottom-end'
      // style: 'background: #333; color: #fff; font-size: 12px; border: 1px solid #f44336;'
    })
  }

  async function handleUpdate(v: Variable, newValue: string, format?: string) {
    const type = v.rawValue?.type ?? getType(v.value)
    const payload = buildVariablePayload(type, newValue, v.rawValue, format, v.rawValue?.autoUpdate)
    setVariable(v.name, payload, _activeDocumentEditor)
    refresh([getDisplayName(v)])
  }

  function handleUpdateMeta(v: Variable, patch: Record<string, any>) {
    const type = v.rawValue?.type ?? getType(v.value)
    const nextRawValue = {
      ...(v.rawValue || {}),
      ...patch,
      type
    }
    if (patch.value === undefined) {
      nextRawValue.value = nextRawValue.value ?? v.value ?? ''
    }
    setVariable(v.name, nextRawValue, _activeDocumentEditor)
    refresh([getDisplayName(v)])
  }

  function handleRename(oldName: string, newName: string) {
    if (!newName || newName === oldName) return
    renameVariable(oldName, newName, _activeDocumentEditor)
    refresh()
  }

  async function handleDelete(name: string) {
    const existing = _vars.find(
      (v) => v.name === name || getDisplayName(v).toLowerCase() === name.toLowerCase()
    )
    const displayName = existing ? getDisplayName(existing) : name
    const confirmed = await openConfirmModal({
      title: $_('Delete variable'),
      message: `${$_('Delete variable')} "${displayName}"?`,
      confirmText: $_('Delete'),
      destructive: true
    })
    if (!confirmed) return

    deleteVariable(name, _activeDocumentEditor)
    refresh()
  }

  async function handleCopyVariableName(v: Variable) {
    const name = getDisplayName(v) || getVarKey(v)
    if (!name) return
    try {
      await EditorCommonUtils.copyToClipboard(name)
      toast.success($_('Variable name copied.'))
    } catch {
      toast.error($_('Unable to copy variable name.'))
    }
  }

  function handleSelectAllUsages(v: Variable) {
    const editor = (_activeDocumentEditor as any)?.editor
    if (!editor?.view?.dom) {
      toast.error($_('No active editor.'))
      return
    }
    const usageKey = getUsageKey(v)
    if (!usageKey) return
    const selector = `[${CustomVarExtensionProps.tagAttributeDataVariable}="${escapeSelectorValue(usageKey)}"]`
    const nodes = Array.from(editor.view.dom.querySelectorAll(selector)) as HTMLElement[]
    if (!nodes.length) {
      toast.error($_('No usages found in this document.'))
      return
    }

    const first = nodes[0]
    try {
      const pos = editor.view.posAtDOM(first, 0)
      const node = editor.state.doc.nodeAt(pos)
      if (node) {
        const selection = node.isSelectable
          ? NodeSelection.create(editor.state.doc, pos)
          : TextSelection.create(editor.state.doc, pos, pos + node.nodeSize)
        editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView())
      }
    } catch {
      // ignore selection errors, still highlight usages
    }

    nodes.forEach((el) => el.classList.add('variable-usage-highlight'))
    window.setTimeout(() => {
      nodes.forEach((el) => el.classList.remove('variable-usage-highlight'))
    }, 1800)
    toast.success($_(`Highlighted ${nodes.length} usage${nodes.length === 1 ? '' : 's'}.`))
  }

  function handleUndo() {
    undoLastDelete(_activeDocumentEditor)
    refresh()
  }

  function handleRedo() {
    redoLastDelete(_activeDocumentEditor)
    refresh()
  }

  async function handlePickFile(v: Variable, isVariableEditing: boolean = false) {
    const result = await window.api.openDialogFile()
    // console.log('dialog:openFile filePaths result', result)

    // const result = await window.api.openDialogDirectory({ properties: ['openFile'] })
    if (result) {
      console.log('dialog:openFile filePaths result', v.name, {
        type: VariableManipulatorUtils.VAR_TYPE.file,
        value: result
      })
      const payload = buildVariablePayload(
        VariableManipulatorUtils.VAR_TYPE.file,
        result,
        v.rawValue
      )
      v.value = result
      v.rawValue = payload
      if (isVariableEditing) {
        setVariable(v.name, payload, _activeDocumentEditor)
        refresh([getDisplayName(v)])
      }

      /* setVariable(v.name, {
        type: VariableManipulatorUtils.VAR_TYPE.file,
        value: result,
        url: result
      })
      refresh() */
    }
  }

  async function handlePickFolder(v: Variable, isVariableEditing: boolean = false) {
    const result = await window.api.openDialogDirectory()
    if (result) {
      const payload = buildVariablePayload(
        VariableManipulatorUtils.VAR_TYPE.folder,
        result,
        v.rawValue
      )
      v.value = result
      v.rawValue = payload
      if (isVariableEditing) {
        setVariable(v.name, payload, _activeDocumentEditor)
        refresh([getDisplayName(v)])
      }
      /* setVariable(v.name, {
        type: VariableManipulatorUtils.VAR_TYPE.folder,
        value: result,
        url: result
      })
      refresh() */
    }
  }

  function handleEditRichText(v: Variable, isVariableEditing: boolean = false) {
    _editingVar = v
    _showRichEditor = true
    _isRichTextVariableEditing = isVariableEditing
  }

  function handleSaveRichText(newHtml: string) {
    console.log('newHtml', newHtml)
    if (_editingVar) {
      const payload = buildVariablePayload(
        VariableManipulatorUtils.VAR_TYPE.richtext,
        newHtml,
        _editingVar.rawValue
      )
      _editingVar.value = newHtml
      _editingVar.rawValue = payload
      if (_isRichTextVariableEditing) {
        setVariable(_editingVar.name, payload, _activeDocumentEditor)
        refresh([getDisplayName(_editingVar)])
      }
      /* setVariable(editingVar.name, {
        type: VariableManipulatorUtils.VAR_TYPE.richtext,
        value: newHtml
      })
      refresh() */
      _showRichEditor = false
      _editingVar = _vars.find((item) => item.name === _editingVar.name)
    }
  }

  async function handleAIUpdate(v: Variable, newValue: string) {
    // async function handleAIInput(name: string, val: any) {

    const prompt = newValue.trim()
    if (!prompt) return

    const payload = buildVariablePayload(VariableManipulatorUtils.VAR_TYPE.ai, prompt, v.rawValue)
    v.rawValue = payload
    v.value = payload.value
    setVariable(v.name, payload, _activeDocumentEditor)
    refresh([getDisplayName(v)])
  }
  async function handleAIInput(v: Variable, isVariableEditing: boolean = false) {
    // async function handleAIInput(name: string, val: any) {

    const prompt = (v.rawValue?.prompt || '').trim()
    if (!prompt) return

    const payload = buildVariablePayload(VariableManipulatorUtils.VAR_TYPE.ai, prompt, v.rawValue)
    v.rawValue = payload
    v.value = payload.value

    if (isVariableEditing) {
      setVariable(v.name, payload, _activeDocumentEditor)
      refresh([getDisplayName(v)])
    }

    runAI(
      prompt,
      _activeDocumentEditor,
      () => {
        // isLoading = true
        payload.value = '...'
        setVariable(v.name, payload, _activeDocumentEditor)
        refresh([getDisplayName(v)])
      },
      (chunk) => {
        // responseText += chunk
        payload.value += chunk
        setVariable(v.name, payload, _activeDocumentEditor)
        refresh([getDisplayName(v)])
      },
      (data) => {
        payload.value = data
        setVariable(v.name, payload, _activeDocumentEditor)
        refresh([getDisplayName(v)])
      }
    )
  }
</script>

<div heading={$_('Variable Inspector')} class="collapsible" open>
  <DetachedPanel title={$_('Variable Inspector')}>
    <!-- <div heading={$_('Variable Inspector')} class="collapsible" open> -->

    <div class="flex items-center justify-between px-2 pt-2">
      <div class="text-[10px] font-800 tracking-[0.14em] uppercase text-base-content/55">
        {$_('Variables')}
      </div>
      <InfoPopover title={$_('What are variables?')}>
        <div>
          <div class="font-700 text-base-content/85">
            {$_('Variables are reusable values you can insert into your document.')}
          </div>
          <ul>
            <li>
              {$_(
                'Use them to keep names, numbers, dates, and computed values consistent across the whole document.'
              )}
            </li>
            <li>
              {$_(
                'When a variable changes, every place it’s used updates automatically — like a mini database for your doc.'
              )}
            </li>
          </ul>
          <div class="mt-2 font-700 text-base-content/85">{$_('Examples')}</div>
          <ul>
            <li><code>{'{client_name}'}</code> → “Acme Corp”</li>
            <li><code>{'{invoice_total}'}</code> → “$12,480.00” (could be computed)</li>
            <li><code>{'{due_date}'}</code> → “2026‑05‑15”</li>
          </ul>
          <div class="mt-2 font-700 text-base-content/85">{$_('Real use cases')}</div>
          <ul>
            <li>{$_('Proposals & contracts: keep client/company details synced everywhere.')}</li>
            <li>{$_('Reports: reuse KPI values across pages, charts, and summaries.')}</li>
            <li>{$_('Templates: build once, reuse for many customers/projects.')}</li>
          </ul>
        </div>
      </InfoPopover>
    </div>

    <UpgradeNotice
      title={$_('Variable Protection')}
      message={$_(
        'In the free plan, anyone with access can edit variables. Upgrade to lock variables, enforce approvals, and protect document logic from tampering.'
      )}
      highlight="pro"
      compact={true}
    />

    <!-- {#if _spreadsheetPointers.length}
      <div class="mt-2 rounded-md border border-white/10 bg-black/20 p-2 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="text-[10px] uppercase tracking-[0.2em] text-base-content/50">
            {$_('Spreadsheet Reference')}
          </div>
          <label class="flex items-center gap-2 text-[10px] text-base-content/50">
            <input type="checkbox" class="toggle toggle-xs" bind:checked={_sheetUseName} />
            {$_('Use sheet name')}
          </label>
        </div>
        <div class="grid grid-cols-[1fr_140px] gap-2">
          <select
            class="adobe-select"
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
            class="adobe-input"
            placeholder="Sheet1 or leave blank"
            bind:value={_sheetRefName}
            disabled={!_sheetUseName}
          />
        </div>
        <div class="grid grid-cols-[1fr_110px] gap-2">
          <input
            type="text"
            class="adobe-input"
            placeholder="A1 or A1:B2"
            bind:value={_sheetCellRef}
          />
          <button class="adobe-btn-action" onclick={applySpreadsheetReference}>
            <i class="ph ph-plus-circle"></i>
            {$_('Use')}
          </button>
        </div>
        <div class="text-[10px] text-base-content/40">
          {$_('Example:')} <span class="text-base-content/70">{buildSpreadsheetReference()}</span>
        </div>
      </div>
    {/if} -->

    <!-- <div class="flex items-center justify-center min-h-screen bg-slate-50 p-6">
      <div
        class="max-w-sm w-full bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow duration-300"
      >
        <div
          class="h-32 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"
        >
          <div class="bg-[color-mix(in_srgb,var(--color-base-white)_20%,transparent)] p-4 rounded-full backdrop-blur-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              fill="#ffffff"
              viewBox="0 0 256 256"
              ><path
                d="M208,40H48A16,16,0,0,0,32,56V200a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V56A16,16,0,0,0,208,40Zm0,160H48V56H208V200Z"
              ></path></svg
            >
          </div>
        </div>

        {#if _newType === VariableManipulatorUtils.VAR_TYPE.text && _spreadsheetPointers.length}
          <div class="mt-2 rounded-md border border-white/10 bg-black/20 p-2 flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <div class="text-[10px] uppercase tracking-[0.2em] text-base-content/50">
                {$_('Spreadsheet Reference')}
              </div>
              <label class="flex items-center gap-2 text-[10px] text-base-content/50">
                <input type="checkbox" class="toggle toggle-xs" bind:checked={_sheetUseName} />
                {$_('Use sheet name')}
              </label>
            </div>
            <div class="grid grid-cols-[1fr_140px] gap-2">
              <select
                class="adobe-select"
                bind:value={_sheetRefId}
                on:change={() => {
                  const match = _spreadsheetPointers.find((s) => s.id === _sheetRefId)
                  _sheetRefName = match?.name || 'Sheet1'
                }}
              >
                {#each _spreadsheetPointers as sheet}
                  <option value={sheet.id}>
                    {sheet.name || sheet.id}
                  </option>
                {/each}
              </select>
              <input
                type="text"
                class="adobe-input"
                placeholder={$_('Sheet1 or leave blank')}
                bind:value={_sheetRefName}
                disabled={!_sheetUseName}
              />
            </div>
            <div class="grid grid-cols-[1fr_110px] gap-2">
              <input
                type="text"
                class="adobe-input"
                placeholder={$_('A1 or A1:B2')}
                bind:value={_sheetCellRef}
              />
              <button class="adobe-btn-action" onclick={applySpreadsheetReference}>
                <i class="ph ph-plus-circle"></i>
                {$_('Use')}
              </button>
            </div>
            <div class="text-[10px] text-base-content/40">
              {$_('Example:')} <span class="text-base-content/70">{buildSpreadsheetReference()}</span>
            </div>
          </div>
        {/if}

        <div class="p-6">
          <div class="flex items-center justify-between mb-2">
            <span
              class="px-2.5 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full"
            >
              {$_('AI Agent')}
            </span>
            <span class="text-xs text-slate-500">{$_('ID: #8821')}</span>
          </div>

          <h3 class="text-xl font-bold text-slate-900 mb-2">{$_('Dify Workflow Engine')}</h3>
          <p class="text-sm text-slate-600 leading-relaxed mb-6">
            {$_('Connected to your custom Go server. Managing auth via Casdoor and orchestrating chat history.')}
          </p>

          <div class="flex items-center gap-4 py-4 border-t border-slate-100">
            <div class="flex items-center gap-1.5 text-slate-500">
              <span class="text-xs font-semibold">{$_('Uptime:')}</span>
              <span class="text-xs">99.9%</span>
            </div>
            <div class="flex items-center gap-1.5 text-slate-500">
              <span class="text-xs font-semibold">{$_('Latency:')}</span>
              <span class="text-xs">42ms</span>
            </div>
          </div>

          <button
            class="w-full bg-slate-900 hover:bg-slate-800 text-base-content font-semibold py-2.5 px-4 rounded-xl transition-colors duration-200"
          >
            {$_('Launch Dashboard')}
          </button>
        </div>
      </div>
    </div> -->

    <!-- {#if _newType === VariableManipulatorUtils.VAR_TYPE.text && _spreadsheetPointers.length}
      <div class="mt-2 rounded-md border border-white/10 bg-black/20 p-2 flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div class="text-[10px] uppercase tracking-[0.2em] text-base-content/50">
            {$_('Spreadsheet Reference')}
          </div>
          <label class="flex items-center gap-2 text-[10px] text-base-content/50">
            <input type="checkbox" class="toggle toggle-xs" bind:checked={_sheetUseName} />
            {$_('Use sheet name')}
          </label>
        </div>
        <div class="grid grid-cols-[1fr_140px] gap-2">
          <select
            class="adobe-select"
            bind:value={_sheetRefId}
            onchange={() => {
              const match = _spreadsheetPointers.find((s) => s.id === _sheetRefId)
              _sheetRefName = match?.name || 'Sheet1'
            }}
          >
            {#each _spreadsheetPointers as sheet}
              <option value={sheet.id}>
                {sheet.name || sheet.id}
              </option>
            {/each}
          </select>
          <input
            type="text"
            class="adobe-input"
            placeholder="Sheet1 or leave blank"
            bind:value={_sheetRefName}
            disabled={!_sheetUseName}
          />
        </div>
        <div class="grid grid-cols-[1fr_110px] gap-2">
          <input
            type="text"
            class="adobe-input"
            placeholder="A1 or A1:B2"
            bind:value={_sheetCellRef}
          />
          <button class="adobe-btn-action" onclick={applySpreadsheetReference}>
            <i class="ph ph-plus-circle"></i>
            {$_('Use')}
          </button>
        </div>
        <div class="text-[10px] text-base-content/40">
          {$_('Example:')} <span class="text-base-content/70">{buildSpreadsheetReference()}</span>
        </div>
      </div>
    {/if} -->

    <div
      class="bg-base-200 text-base-content/80 border border-base-content/10 flex flex-col h-full font-sans select-none overflow-hidden shadow-xl"
    >
      <div
        class="flex items-center justify-between px-3 py-2 bg-base-300/60 border-b border-base-content/10"
      >
        <span class="text-[10px] font-bold uppercase tracking-widest text-base-content/90"
          >{$_('Variable Inspector')}</span
        >
        <div class="flex gap-1">
          <button
            class="p-1 hover:bg-base-content/10 rounded-sm text-base-content/45 transition-colors active:text-base-content"
            onclick={handleUndo}
            title={$_('Undo (Ctrl+Z)')}
          >
            <i class="ph-light ph-arrow-u-up-left text-base"></i>
          </button>
          <button
            class="p-1 hover:bg-base-content/10 rounded-sm text-base-content/45 transition-colors active:text-base-content"
            onclick={handleRedo}
            title={$_('Redo (Ctrl+Y)')}
          >
            <i class="ph-light ph-arrow-u-up-right text-base"></i>
          </button>
        </div>
      </div>

      <div class="p-2 bg-base-200 border-b border-base-content/10">
        <div class="relative group">
          <div
            class="absolute left-2 top-1/2 -translate-y-1/2 i-adobe-workflow:search w-3 h-3 text-base-content/30 group-focus-within:text-primary"
          ></div>
          <input
            type="search"
            class="w-full bg-base-100 border border-base-content/15 rounded-sm pl-7 pr-2 py-1 text-xs outline-none focus:border-primary placeholder-base-content/30"
            placeholder={$_('Filter variables...')}
            bind:value={_search}
            oninput={() => {
              refresh()
            }}
          />
        </div>
        <div class="mt-2 flex items-center gap-2 text-[10px]">
          <span class="uppercase tracking-widest text-base-content/35 font-bold"
            >{$_('Source')}</span
          >
          <div class="flex items-center gap-1">
            <button
              class="px-2 py-0.5 rounded-sm border text-[9px] uppercase tracking-[0.2em] transition-colors"
              class:bg-primary-10={_sourceFilter === 'all'}
              class:border-primary={_sourceFilter === 'all'}
              class:text-base-content={_sourceFilter === 'all'}
              onclick={() => (_sourceFilter = 'all')}
            >
              {$_('All')}
            </button>
            <button
              class="px-2 py-0.5 rounded-sm border text-[9px] uppercase tracking-[0.2em] transition-colors"
              class:bg-primary-10={_sourceFilter === 'user'}
              class:border-primary={_sourceFilter === 'user'}
              class:text-base-content={_sourceFilter === 'user'}
              onclick={() => (_sourceFilter = 'user')}
            >
              {$_('User')}
            </button>
            <button
              class="px-2 py-0.5 rounded-sm border text-[9px] uppercase tracking-[0.2em] transition-colors"
              class:bg-primary-10={_sourceFilter === 'ai'}
              class:border-primary={_sourceFilter === 'ai'}
              class:text-base-content={_sourceFilter === 'ai'}
              onclick={() => (_sourceFilter = 'ai')}
            >
              {$_('AI')}
            </button>
          </div>
        </div>
      </div>

      <div class="p-3 bg-base-300/55 border-b border-base-content/10 flex flex-col gap-2">
        <!-- <div class="grid grid-cols-[1fr_120px] gap-2"> -->
        <div
          class="grid {_newType === VariableManipulatorUtils.VAR_TYPE.text ||
          _newType === VariableManipulatorUtils.VAR_TYPE.datetime
            ? 'grid-cols-[35%_30%_30%]'
            : 'grid-cols-[65%_30%]'} gap-2"
        >
          <input
            type="text"
            class="adobe-input"
            placeholder={$_('Variable Name (e.g. user_name)')}
            bind:value={_newVariable.name}
            oninput={() => {
              if (_nameError) _nameError = ''
            }}
          />
          <select class="adobe-select" bind:value={_newType}>
            {#each Object.entries(VariableManipulatorUtils.VAR_TYPE) as [key, value]}
              <option {value}>{VariableManipulatorUtils.VAR_LABELS[key]}</option>
            {/each}
          </select>

          {#if _newType === VariableManipulatorUtils.VAR_TYPE.text || _newType === VariableManipulatorUtils.VAR_TYPE.datetime}
            <VariableFormatPicker bind:value={_newVariableFormat} />
          {/if}
        </div>
        {#if _nameError}
          <div class="text-[10px] text-red-400 px-1">
            {_nameError}
          </div>
        {/if}

        <!-- <div class="grid {(_newType === 'number' || _newType === 'datetime') ? 'grid-cols-[1fr_120px_120px]' : 'grid-cols-[1fr_120px]'} gap-2">
  <input type="text" class="adobe-input" placeholder="Variable Name" bind:value={_newVariable.name} />
  <select class="adobe-select" bind:value={_newType}>
    {#each Object.entries(VariableManipulatorUtils.VAR_TYPE) as [key, value]}
      <option {value}>{VariableManipulatorUtils.VAR_LABELS[key]}</option>
    {/each}
  </select>
  
  {#if _newType === 'number' || _newType === 'datetime'}
    <select class="adobe-select animate-scale-in" bind:value={_newVariable.format}>
      {#each Object.entries(VariableManipulatorUtils.FORMAT_LABELS) as [value, label]}
        <option {value}>{label}</option>
      {/each}
    </select>
  {/if}
</div> -->

        <div class="flex gap-2 items-center">
          {#if _newType === VariableManipulatorUtils.VAR_TYPE.datetime}
            <input
              type="datetime-local"
              class="adobe-input flex-grow bg-base-100 accent-base-300"
              bind:value={uiBinding.current}
            />
            <label class="flex items-center gap-2 cursor-pointer group">
              <div class="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  class="peer appearance-none w-4 h-4 rounded border border-white/20 bg-transparent checked:bg-base-300 checked:border-base-300 transition-all cursor-pointer"
                  bind:checked={_newVariableAutoUpdate}
                />
                <i
                  class="ph-bold ph-check absolute text-[10px] text-[#141414] opacity-0 peer-checked:opacity-100 pointer-events-none"
                ></i>
              </div>
              <span
                class="text-[11px] text-base-content/50 group-hover:text-base-content/80 transition-colors selection:bg-transparent"
              >
                {$_('Auto-update')}
              </span>
            </label>

            <!-- {:else if _newType === VariableManipulatorUtils.VAR_TYPE.number}
            <input
              type="number"
              step="any"
              class="adobe-input flex-grow bg-base-100"
              placeholder="0.00"
              bind:value={uiBinding.current}
            /> -->
          {:else if _newType === VariableManipulatorUtils.VAR_TYPE.file || _newType === VariableManipulatorUtils.VAR_TYPE.folder}
            <div class="flex flex-grow gap-1">
              <input
                type="text"
                class="adobe-input flex-grow text-[10px]"
                bind:value={uiBinding.current}
                placeholder={_newType === 'file' ? 'Path/URL...' : 'Folder Path...'}
              />
              <button
                class="adobe-btn-action"
                onclick={() =>
                  _newType === 'file'
                    ? handlePickFile(_newVariable)
                    : handlePickFolder(_newVariable)}
              >
                <i class="ph-light ph-plus"></i>
              </button>
            </div>
          {:else if _newType === VariableManipulatorUtils.VAR_TYPE.richtext}
            <button
              class="adobe-btn-action flex-grow"
              onclick={() => handleEditRichText(_newVariable)}
            >
              <div class="i-adobe-workflow:text-edit w-3 h-3 mr-2"></div>
              {$_('Compose Rich Text...')}
            </button>
          {:else}
            <VariableCodexInput
              className="adobe-input flex-grow {_newType === 'ai' ? 'border-indigo-500/50' : ''}"
              placeholder={_newType === 'ai'
                ? 'Describe what the AI should do...'
                : 'Enter value or =Formula...'}
              value={uiBinding.current}
              documentEditor={_activeDocumentEditor}
              onChange={(nextValue) => {
                uiBinding.current = nextValue
              }}
              onEnter={() => handleAdd()}
            />
          {/if}

          <button
            class="bg-primary hover:brightness-110 text-base-content px-4 py-1 rounded-full text-[11px] font-bold transition-all active:scale-95 shadow-lg"
            onclick={handleAdd}
          >
            {$_('Add')}
          </button>
        </div>

        <button
          onclick={() => (_showAdvancedNew = !_showAdvancedNew)}
          class="text-[9px] text-primary hover:underline self-start mt-1 flex items-center gap-1"
        >
          {_showAdvancedNew ? 'Hide' : 'Show'} Advanced Settings
        </button>

        {#if _showAdvancedNew}
          <div class="flex flex-col gap-2 mt-1 animate-in fade-in duration-200">
            <div class="flex flex-col gap-1">
              <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Aliases')}</span>
              <input
                type="text"
                class="theme-sub-input"
                placeholder={$_('Comma separated (e.g. total, subtotal)')}
                bind:value={_newAliases}
              />
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Description')}</span>
              <input
                type="text"
                class="theme-sub-input"
                placeholder={$_('Optional description')}
                bind:value={_newDescription}
              />
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Visibility')}</span>
              <select class="adobe-select !h-7 !text-[9px]" bind:value={_newVisibility}>
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
                  class="theme-sub-input"
                  placeholder={$_('Emails (empty = everyone)')}
                  bind:value={_newAccess}
                />
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Read')}</span>
                <input
                  type="text"
                  class="theme-sub-input"
                  placeholder={$_('Emails (empty = everyone)')}
                  bind:value={_newRead}
                />
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Write')}</span>
                <input
                  type="text"
                  class="theme-sub-input"
                  placeholder={$_('Emails (empty = everyone)')}
                  bind:value={_newWrite}
                />
              </div>
            </div>
          </div>
        {/if}

        {#if _newType === 'ai' && uiBinding.current}
          <div
            class="text-[9px] text-indigo-300 italic px-1 animate-fade-in flex items-center gap-1"
          >
            <span class="i-adobe-workflow:sparkle w-2 h-2"></span>
            {$_('Will generate content based on your prompt')}
          </div>
        {/if}
      </div>

      <div class="p-3 bg-base-200 border-b bg-base-400 flex flex-col gap-2 !hidden">
        <div class="grid grid-cols-[1fr_120px] gap-2">
          <input
            type="text"
            class="adobe-input"
            placeholder={$_('Variable Name')}
            bind:value={_newVariable.name}
          />
          <!-- <select class="adobe-select" bind:value={_newType}>
          <option value={VariableManipulatorUtils.VAR_TYPE.text}>{$_('Text')}</option>
          <option value={VariableManipulatorUtils.VAR_TYPE.ai}>{$_('AI Prompt')}</option>
          <option value={VariableManipulatorUtils.VAR_TYPE.file}>{$_('File')}</option>
          <option value={VariableManipulatorUtils.VAR_TYPE.folder}>{$_('Folder')}</option>
          <option value={VariableManipulatorUtils.VAR_TYPE.richtext}>{$_('Rich Text')}</option>
        </select> -->

          <select class="adobe-select" bind:value={_newType}>
            {#each Object.entries(VariableManipulatorUtils.VAR_TYPE) as [key, value]}
              <option {value}>{VariableManipulatorUtils.VAR_LABELS[key]}</option>
            {/each}
          </select>
        </div>

        <div class="flex gap-2 items-center">
          {#if _newType === VariableManipulatorUtils.VAR_TYPE.file}
            <button class="adobe-btn-action flex-grow" onclick={() => handlePickFile(_newVariable)}>
              <div class="i-adobe-workflow:file-add w-3 h-3 mr-2"></div>
              {$_('Choose File')}
            </button>
          {:else if _newType === VariableManipulatorUtils.VAR_TYPE.folder}
            <button
              class="adobe-btn-action flex-grow"
              onclick={() => handlePickFolder(_newVariable)}
            >
              <div class="i-adobe-workflow:folder-add w-3 h-3 mr-2"></div>
              {$_('Choose Folder')}
            </button>
          {:else if _newType === VariableManipulatorUtils.VAR_TYPE.richtext}
            <button
              class="adobe-btn-action flex-grow"
              onclick={() => handleEditRichText(_newVariable)}
            >
              <div class="i-adobe-workflow:text-edit w-3 h-3 mr-2"></div>
              {$_('Write Rich Text')}
            </button>
          {:else}
            <input
              type="text"
              class="adobe-input flex-grow bg-base-100"
              placeholder={_newType === 'ai' ? $_('Enter AI prompt...') : $_('Initial Value')}
              bind:value={_newVariable.value}
              onkeydown={(e) => e.key === 'Enter' && handleAdd()}
            />
          {/if}
          <button
            class="bg-primary hover:bg-primary text-base-content px-3 py-1 rounded-full text-[11px] font-bold transition-all active:scale-95"
            onclick={handleAdd}
          >
            {$_('Add')}
          </button>
        </div>
      </div>

      <div class=" !hidden flex-grow overflow-auto custom-scrollbar bg-base-100">
        <!-- Header Row -->
        <div
          class="sticky top-0 z-10 bg-base-200 shadow-sm border-b border-[#2a2a2a]
              grid grid-cols-[1fr_80px_1fr_1fr_48px_56px]
              text-[10px] font-bold uppercase tracking-wider text-[#959595]"
        >
          <div class="px-3 py-2 border-r border-[#2a2a2a]">{$_('Name')}</div>
          <div class="px-3 py-2 border-r border-[#2a2a2a]">{$_('Type')}</div>
          <div class="px-3 py-2 border-r border-[#2a2a2a]">{$_('Input/Value')}</div>
          <div class="px-3 py-2 border-r border-[#2a2a2a]">{$_('Result')}</div>
          <div class="px-2 py-2 text-center border-r border-[#2a2a2a]">{$_('Uses')}</div>
          <div class="px-2 py-2"></div>
        </div>

        <!-- Body -->
        <div class="divide-y divide-[#2a2a2a]">
          {#each filteredVars as v}
            <!-- Main Row -->
            <div
              class="group grid grid-cols-[1fr_80px_1fr_1fr_48px_56px]
                  items-center hover:bg-[#2a2a2a] transition-colors text-[11px]"
            >
              <!-- Name -->
              <div class="px-2 py-1 border-r border-[#2a2a2a]">
                <input
                  type="text"
                  class="bg-transparent border border-transparent hover:border-[#444]
                   focus:bg-base-100 focus:border-primary w-full px-1 py-0.5
                   rounded-sm outline-none text-[#e1e1e1]"
                  class:opacity-60={isTableCellVariable(v)}
                  value={getDraftName(v)}
                  readonly={isTableCellVariable(v)}
                  title={isTableCellVariable(v)
                    ? $_('Table cell variable name is managed automatically.')
                    : ''}
                  oninput={(e) => {
                    if (isTableCellVariable(v)) return
                    setDraftName(v, (e.target as HTMLInputElement).value)
                  }}
                  onblur={async (e) => {
                    const el = e.target as HTMLInputElement
                    await commitRename(v, el.value, el)
                  }}
                  onkeydown={(e) => {
                    if (e.key !== 'Enter') return
                    void commitRename(
                      v,
                      (e.target as HTMLInputElement).value,
                      e.target as HTMLInputElement
                    )
                  }}
                />
              </div>

              <!-- Type -->
              <div class="px-3 py-1 border-r border-[#2a2a2a] flex items-center gap-1 flex-wrap">
                {#if isAiVar(v)}
                  <span
                    class="px-1.5 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-[0.2em]
                         bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  >
                    {$_('AI')}
                  </span>
                {/if}
                <span
                  class="bg-[#333] px-1.5 py-0.5 rounded-sm text-[9px] font-bold
                       text-[#888] border border-[#3e3e3e]"
                >
                  {(v.rawValue.type && v.rawValue.type == VariableManipulatorUtils.VAR_TYPE.text
                    ? getType(v.value)
                    : v.rawValue.type) ?? getType(v.value)}
                </span>
              </div>

              <!-- Input/Value -->
              <div class="px-3 py-1 border-r border-[#2a2a2a]">
                {#if (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.file}
                  <div class="flex flex-col gap-1">
                    <button class="adobe-btn-action w-full" onclick={() => handlePickFile(v, true)}>
                      <div class="i-adobe-workflow:file-add w-3 h-3 mr-2"></div>
                      {$_('Choose File')}
                    </button>
                    <small class="text-[9px] text-[#666] truncate">{v.rawValue.url}</small>
                  </div>
                {:else if (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.folder}
                  <div class="flex flex-col gap-1">
                    <button
                      class="adobe-btn-action w-full"
                      onclick={() => handlePickFolder(v, true)}
                    >
                      <div class="i-adobe-workflow:file-add w-3 h-3 mr-2"></div>
                      {$_('Choose Folder')}
                    </button>
                    <small class="text-[9px] text-[#666] truncate">{v.rawValue.url}</small>
                  </div>
                {:else if (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.richtext}
                  <div class="flex flex-col gap-1">
                    <button
                      class="adobe-btn-action w-full"
                      onclick={() => handleEditRichText(v, true)}
                    >
                      <div class="i-adobe-workflow:text-edit w-3 h-3 mr-2"></div>
                      {$_('Edit Rich Text')}
                    </button>
                    <small class="text-[9px] text-[#666] truncate">{v.rawValue.value}</small>
                  </div>
                {:else if (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.ai}
                  <input
                    type="text"
                    class="adobe-table-input italic text-blue-400"
                    placeholder={$_('Edit Your Prompt Here')}
                    value={v.rawValue.prompt}
                    onkeydown={(e) => {
                      if (e.key !== 'Enter') return
                      const value = (e.target as HTMLInputElement).value.trim()
                      if (value) handleAIUpdate(v, value)
                    }}
                    onblur={(e) => {
                      const value = (e.target as HTMLInputElement).value.trim()
                      if (value) handleAIUpdate(v, value)
                    }}
                  />
                {:else}
                  <div class="flex flex-col gap-1">
                    <VariableCodexInput
                      className="adobe-table-input"
                      value={getDraftValue(v)}
                      documentEditor={_activeDocumentEditor}
                      contextNodeId={v.rawValue?.nodeId}
                      onChange={(nextValue) => setDraftValue(v, nextValue)}
                      onBlur={(nextValue) => {
                        handleUpdate(v, String(nextValue ?? '').trim(), v.rawValue.format)
                        clearDraftValue(v)
                      }}
                      onEnter={() => {
                        handleUpdate(v, String(getDraftValue(v) ?? '').trim(), v.rawValue.format)
                        clearDraftValue(v)
                      }}
                    />

                    {#if (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.datetime || (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.text}
                      <div class="flex items-center gap-2">
                        <select
                          class="adobe-select !h-6 !text-[9px]"
                          value={v.rawValue?.format ??
                            VariableManipulatorUtils.EXCEL_FORMATS.GENERAL}
                          onchange={(e) =>
                            handleUpdateMeta(v, { format: (e.target as HTMLSelectElement).value })}
                        >
                          {#each Object.entries(VariableManipulatorUtils.FORMAT_LABELS) as [key, label]}
                            <option value={VariableManipulatorUtils.EXCEL_FORMATS[key]}
                              >{label}</option
                            >
                          {/each}
                        </select>

                        <VariableFormatPicker bind:value={_newVariableFormat} />

                        {#if (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.datetime}
                          <label
                            class="flex items-center gap-1 text-[9px] text-base-content/50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              class="accent-base-300"
                              checked={Boolean(v.rawValue?.autoUpdate)}
                              onchange={(e) =>
                                handleUpdateMeta(v, {
                                  autoUpdate: (e.target as HTMLInputElement).checked
                                })}
                            />
                            Auto
                          </label>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>

              <!-- Result -->
              <div class="px-3 py-1 border-r border-[#2a2a2a] text-[#888] truncate">
                {getVariableDisplayValue(v)}
              </div>

              <!-- Uses -->
              <div class="px-2 py-1 border-r border-[#2a2a2a] flex items-center justify-center">
                <span
                  class="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5
                       rounded-full text-[9px] font-bold border border-white/10
                       {getUsageCount(v)
                    ? 'text-emerald-200 bg-emerald-500/10'
                    : 'text-base-content/30 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)]'}"
                >
                  {getUsageCount(v)}
                </span>
              </div>

              <!-- Actions -->
              <div class="px-2 py-1 flex items-center justify-center gap-1">
                <button
                  class="opacity-0 group-hover:opacity-100 p-1 rounded-sm transition-all
                   hover:bg-[#333] hover:text-base-content"
                  onclick={() => handleCopyVariableName(v)}
                  title={$_('Copy variable name')}
                >
                  <i class="ph-light ph-clipboard-text w-3 h-3"></i>
                </button>
                <button
                  class="opacity-0 group-hover:opacity-100 p-1 rounded-sm transition-all
                   hover:bg-[#333] hover:text-base-content"
                  onclick={() => handleSelectAllUsages(v)}
                  title={$_('Select all usages')}
                >
                  <i class="ph-light ph-crosshair w-3 h-3"></i>
                </button>
                <button
                  class="opacity-0 group-hover:opacity-100 p-1 rounded-sm transition-all
                   hover:bg-[#333] hover:text-base-content"
                  onclick={() =>
                    (_expandedAdvancedVarId = _expandedAdvancedVarId === v.name ? null : v.name)}
                  title={$_('Advanced settings')}
                >
                  <i class="ph-light ph-sliders w-3 h-3"></i>
                </button>
                <button
                  class="opacity-0 group-hover:opacity-100 p-1 rounded-sm transition-all
                   hover:bg-[#f33d3d] hover:text-base-content"
                  onclick={() => handleDelete(v.name)}
                >
                  <div class="i-adobe-workflow:delete w-3 h-3">🗑️</div>
                </button>
              </div>
            </div>

            <!-- Expanded Advanced Settings Row -->
            {#if _expandedAdvancedVarId === v.name}
              <div class="bg-[#2c2c2c] border-t border-[#1f1f1f]">
                <!-- Indent to align with columns 1–5, skip actions column -->
                <div class="col-span-5 px-3 py-3">
                  <div class="grid grid-cols-2 gap-3 text-[10px]">
                    <!-- Aliases -->
                    <div class="flex flex-col gap-1">
                      <span class="text-[9px] uppercase font-bold text-[#888]">{$_('Aliases')}</span
                      >
                      <input
                        type="text"
                        class="theme-sub-input"
                        value={listToInput(v.rawValue?.aliases)}
                        placeholder={$_('Comma separated')}
                        onchange={(e) =>
                          handleUpdateMeta(v, {
                            aliases: parseListInput((e.target as HTMLInputElement).value)
                          })}
                      />
                    </div>

                    <!-- Description -->
                    <div class="flex flex-col gap-1">
                      <span class="text-[9px] uppercase font-bold text-[#888]"
                        >{$_('Description')}</span
                      >
                      <input
                        type="text"
                        class="theme-sub-input"
                        value={v.rawValue?.description || ''}
                        placeholder={$_('Optional description')}
                        onchange={(e) =>
                          handleUpdateMeta(v, {
                            description: (e.target as HTMLInputElement).value
                          })}
                      />
                    </div>

                    <!-- Visibility -->
                    <div class="flex flex-col gap-1">
                      <span class="text-[9px] uppercase font-bold text-[#888]"
                        >{$_('Visibility')}</span
                      >
                      <select
                        class="adobe-select !h-7 !text-[9px]"
                        value={v.rawValue?.visibility || 'package'}
                        onchange={(e) =>
                          handleUpdateMeta(v, {
                            visibility: (e.target as HTMLSelectElement).value
                          })}
                      >
                        <option value="document">{$_('Document')}</option>
                        <option value="package">{$_('Package')}</option>
                        <option value="desktop">{$_('Desktop')}</option>
                        <option value="cloud">{$_('Cloud')}</option>
                      </select>
                    </div>

                    <!-- Permissions -->
                    <div class="grid grid-cols-1 gap-2">
                      {#each [{ key: 'access', label: $_('Access') }, { key: 'read', label: $_('Read') }, { key: 'write', label: $_('Write') }] as perm}
                        <div class="flex flex-col gap-1">
                          <span class="text-[9px] uppercase font-bold text-[#888]"
                            >{perm.label}</span
                          >
                          <input
                            type="text"
                            class="theme-sub-input"
                            value={listToInput(v.rawValue?.permissions?.[perm.key])}
                            placeholder={$_('Emails (empty = everyone)')}
                            onchange={(e) =>
                              handleUpdateMeta(v, {
                                permissions: {
                                  ...(v.rawValue?.permissions || {}),
                                  [perm.key]: parsePermissionInput(
                                    (e.target as HTMLInputElement).value
                                  )
                                }
                              })}
                          />
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>

      <div class="flex-grow overflow-auto custom-scrollbar bg-base-100">
        <table class="w-full text-[11px] border-collapse">
          <thead
            class="sticky top-0 bg-base-200 shadow-sm z-10 text-[#959595] uppercase tracking-wider font-bold"
          >
            <tr>
              <th class="px-3 py-2 text-left border-r bg-base-400">{$_('Name')}</th>
              <th class="px-3 py-2 text-left border-r bg-base-400 w-16">{$_('Type')}</th>
              <th class="px-3 py-2 text-left border-r bg-base-400">{$_('Input/Value')}</th>
              <th class="px-3 py-2 text-left border-r bg-base-400">{$_('Result')}</th>
              <th class="px-2 py-2 text-center border-r bg-base-400 w-12">
                {$_('Uses')}
              </th>
              <th class="px-2 py-2 text-center w-14"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#2a2a2a]">
            {#each filteredVars as v}
              <tr class="hover:bg-[#2a2a2a] group transition-colors">
                <td class="px-2 py-1">
                  <div class="flex items-center gap-1">
                    <input
                      type="text"
                      class="bg-transparent border border-transparent hover:border-[#444] focus:bg-base-100 focus:border-primary w-full px-1 py-0.5 rounded-sm outline-none text-[#e1e1e1]"
                      value={getDraftName(v)}
                      readonly={isTableCellVariable(v)}
                      class:opacity-60={isTableCellVariable(v)}
                      title={isTableCellVariable(v)
                        ? $_('Table cell variable name is managed automatically.')
                        : ''}
                      oninput={(e) => {
                        if (isTableCellVariable(v)) return
                        const name = (e.target as HTMLInputElement).value
                        setDraftName(v, name)
                      }}
                      onblur={async (e) => {
                        const el = e.target as HTMLInputElement
                        await commitRename(v, el.value, el)
                      }}
                      onkeydown={(e) => {
                        if (e.key !== 'Enter') return
                        const el = e.target as HTMLInputElement
                        void commitRename(v, el.value, el)
                      }}
                    />
                  </div>
                </td>
                <td class="px-3 py-1">
                  {#if isAiVar(v)}
                    <span
                      class="ml-1 px-1.5 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-[0.2em] bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      >{$_('AI')}</span
                    >
                  {/if}
                  <span
                    class="bg-[#333] px-1.5 py-0.5 rounded-sm text-[9px] font-bold text-[#888] border border-[#3e3e3e]"
                  >
                    <!-- {v.rawValue.type ?? 'VAR'} -->
                    {(v.rawValue.type && v.rawValue.type == VariableManipulatorUtils.VAR_TYPE.text
                      ? getType(v.value)
                      : v.rawValue.type) ?? getType(v.value)}
                  </span>
                </td>
                <td class="px-3 py-1">
                  <!-- {#if v.rawValue.type === 'ai'}
                  <input
                    type="text"
                    class="adobe-table-input italic text-blue-400"
                    value={v.rawValue.prompt}
                  />
                {:else}
                  <input type="text" class="adobe-table-input" value={v.value} />
                {/if} -->

                  {#if (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.file}
                    <!-- <button class="btn btn-xs btn-outline" onclick={() => handlePickFile(v, true)}
                    >📁 Choose File</button
                  > -->
                    <div class="flex gap-2 items-center">
                      <button
                        class="adobe-btn-action flex-grow"
                        onclick={() => handlePickFile(v, true)}
                      >
                        <div class="i-adobe-workflow:file-add w-3 h-3 mr-2"></div>
                        {$_('Choose File')}
                      </button>
                    </div>
                    <small class="block text-xs mt-1">{v.rawValue.url}</small>
                  {:else if (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.folder}
                    <!-- <button class="btn btn-xs btn-outline" onclick={() => handlePickFolder(v, true)}
                    >📂 Choose Folder</button
                  > -->
                    <div class="flex gap-2 items-center">
                      <button
                        class="adobe-btn-action flex-grow"
                        onclick={() => handlePickFolder(v, true)}
                      >
                        <div class="i-adobe-workflow:file-add w-3 h-3 mr-2"></div>
                        {$_('Choose Folder')}
                      </button>
                    </div>
                    <small class="block text-xs mt-1">{v.rawValue.url}</small>
                  {:else if (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.richtext}
                    <!-- <button
                    class="btn btn-xs btn-outline"
                    onclick={() => handleEditRichText(v, true)}>🧾 Edit Rich Text</button
                  > -->
                    <div class="flex gap-2 items-center">
                      <button
                        class="adobe-btn-action flex-grow"
                        onclick={() => handleEditRichText(v, true)}
                      >
                        <div class="i-adobe-workflow:text-edit w-3 h-3 mr-2"></div>
                        {$_('Edit Rich Text')}
                      </button>
                    </div>
                    <small class="block text-xs mt-1">{v.rawValue.value}</small>
                  {:else if (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.ai}
                    <input
                      type="text"
                      class="adobe-table-input italic text-blue-400"
                      placeholder={$_('Edit Your Prompt Here')}
                      value={v.rawValue.prompt}
                      onkeydown={(e) => {
                        if (e.key === 'Enter') {
                          const el = e.target as HTMLInputElement
                          const value = el.value.trim()
                          if (value) {
                            // handleUpdate
                            handleAIUpdate(v, value)
                          }
                        }
                      }}
                      onblur={(e) => {
                        const el = e.target as HTMLInputElement
                        const value = el.value.trim()

                        if (value) {
                          handleAIUpdate(v, value)
                        }
                      }}
                    />
                    <!-- <input
                  type="text"
                  class="input input-bordered flex-1"
                  placeholder={$_('Edit Your Prompt Here')}
                  bind:value={v.rawValue.prompt}
                  onkeydown={(e) => e.key === 'Enter' && handleAIInput(v, true)}
                /> -->
                    <!-- <small class="block text-xs mt-1">{v.rawValue.value}</small> -->

                    <!-- <small class="block text-xs mt-1">{v.rawValue.value}</small> -->
                  {:else}
                    <!-- <input
                      type="text"
                      class="adobe-table-input"
                      value={v.rawValue ?? v.value}
                      onchange={(e) => handleUpdate(v, (e.target as HTMLInputElement).value)}
                    /> -->
                    <div class="flex flex-col gap-1 relative">
                      <VariableCodexInput
                        className="adobe-table-input"
                        value={getDraftValue(v)}
                        documentEditor={_activeDocumentEditor}
                        contextNodeId={v.rawValue?.nodeId}
                        onChange={(nextValue) => {
                          setDraftValue(v, nextValue)
                        }}
                        onBlur={(nextValue) => {
                          const value = String(nextValue ?? '').trim()
                          handleUpdate(v, value, v.rawValue.format)
                          clearDraftValue(v)
                        }}
                        onEnter={() => {
                          const value = String(getDraftValue(v) ?? '').trim()
                          handleUpdate(v, value, v.rawValue.format)
                          clearDraftValue(v)
                        }}
                      />
                      {#if (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.datetime || (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.text}
                        <div class="flex items-center gap-2">
                          <select
                            class="adobe-select !h-6 !text-[9px]"
                            value={v.rawValue?.format ||
                              VariableManipulatorUtils.EXCEL_FORMATS.GENERAL}
                            onchange={(e) => {
                              const format = (e.target as HTMLSelectElement).value
                              handleUpdateMeta(v, { format })
                            }}
                          >
                            {#each Object.entries(VariableManipulatorUtils.FORMAT_LABELS) as [value, label]}
                              <option value={VariableManipulatorUtils.EXCEL_FORMATS[value]}>
                                {label}
                              </option>
                            {/each}
                          </select>

                          <VariableFormatPicker bind:value={_newVariableFormat} />
                          {#if (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.datetime}
                            <label class="flex items-center gap-1 text-[9px] text-base-content/50">
                              <input
                                type="checkbox"
                                class="accent-base-300"
                                checked={Boolean(v.rawValue?.autoUpdate)}
                                onchange={(e) => {
                                  const autoUpdate = (e.target as HTMLInputElement).checked
                                  handleUpdateMeta(v, { autoUpdate })
                                }}
                              />
                              Auto
                            </label>
                          {/if}
                        </div>
                      {/if}
                    </div>
                    <!-- <input
                      type="text"
                      class="adobe-table-input"
                      value={v.rawValue.value ?? v.value}
                      onchange={(e) => {
                        const el = e.target as HTMLInputElement
                        const value = el.value.trim()
                        handleUpdate(v, value, v.rawValue.format)
                      }}
                    /> -->
                  {/if}
                </td>
                <td class="px-3 py-1 text-[#888] truncate max-w-[150px]">
                  {getVariableDisplayValue(v)}
                </td>
                <td class="px-2 py-1 text-center">
                  <span
                    class="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full text-[9px] font-bold border border-white/10 {getUsageCount(
                      v
                    )
                      ? 'text-emerald-200 bg-emerald-500/10'
                      : 'text-base-content/30 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)]'}"
                  >
                    {getUsageCount(v)}
                  </span>
                </td>
                <td class="px-2 py-1 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button
                      class="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#333] hover:text-base-content rounded-sm transition-all"
                      onclick={() => handleCopyVariableName(v)}
                      title={$_('Copy variable name')}
                    >
                      <i class="ph-light ph-clipboard-text w-3 h-3"></i>
                    </button>
                    <button
                      class="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#333] hover:text-base-content rounded-sm transition-all"
                      onclick={() => handleSelectAllUsages(v)}
                      title={$_('Select all usages')}
                    >
                      <i class="ph-light ph-crosshair w-3 h-3"></i>
                    </button>
                    <button
                      class="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#333] hover:text-base-content rounded-sm transition-all"
                      onclick={() =>
                        (_expandedAdvancedVarId =
                          _expandedAdvancedVarId === v.name ? null : v.name)}
                      title={$_('Advanced settings')}
                    >
                      <i class="ph-light ph-sliders w-3 h-3"></i>
                    </button>
                    <button
                      class="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#f33d3d] hover:text-base-content rounded-sm transition-all"
                      onclick={() => handleDelete(v.name)}
                    >
                      <div class="i-adobe-workflow:delete w-3 h-3">🗑️</div>
                    </button>
                  </div>
                </td>
              </tr>
              {#if _expandedAdvancedVarId === v.name}
                <tr class="bg-[#2c2c2c]">
                  <td colspan="5" class="px-3 py-3 border-t border-[#1f1f1f]">
                    <div class="grid grid-cols-2 gap-3 text-[10px]">
                      <div class="flex flex-col gap-1">
                        <span class="text-[9px] uppercase font-bold text-[#888]"
                          >{$_('Aliases')}</span
                        >
                        <input
                          type="text"
                          class="theme-sub-input"
                          value={listToInput(v.rawValue?.aliases)}
                          placeholder={$_('Comma separated')}
                          onchange={(e) => {
                            const aliases = parseListInput((e.target as HTMLInputElement).value)
                            handleUpdateMeta(v, { aliases })
                          }}
                        />
                      </div>
                      <div class="flex flex-col gap-1">
                        <span class="text-[9px] uppercase font-bold text-[#888]"
                          >{$_('Description')}</span
                        >
                        <input
                          type="text"
                          class="theme-sub-input"
                          value={v.rawValue?.description || ''}
                          placeholder={$_('Optional description')}
                          onchange={(e) =>
                            handleUpdateMeta(v, {
                              description: (e.target as HTMLInputElement).value
                            })}
                        />
                      </div>
                      <div class="flex flex-col gap-1">
                        <span class="text-[9px] uppercase font-bold text-[#888]"
                          >{$_('Visibility')}</span
                        >
                        <select
                          class="adobe-select !h-7 !text-[9px]"
                          value={v.rawValue?.visibility || 'package'}
                          onchange={(e) =>
                            handleUpdateMeta(v, {
                              visibility: (e.target as HTMLSelectElement).value
                            })}
                        >
                          <option value="document">{$_('Document')}</option>
                          <option value="package">{$_('Package')}</option>
                          <option value="desktop">{$_('Desktop')}</option>
                          <option value="cloud">{$_('Cloud')}</option>
                        </select>
                      </div>
                      <div class="grid grid-cols-1 gap-2">
                        <div class="flex flex-col gap-1">
                          <span class="text-[9px] uppercase font-bold text-[#888]"
                            >{$_('Access')}</span
                          >
                          <input
                            type="text"
                            class="theme-sub-input"
                            value={listToInput(v.rawValue?.permissions?.access)}
                            placeholder={$_('Emails (empty = everyone)')}
                            onchange={(e) =>
                              handleUpdateMeta(v, {
                                permissions: {
                                  ...(v.rawValue?.permissions || {}),
                                  access: parsePermissionInput((e.target as HTMLInputElement).value)
                                }
                              })}
                          />
                        </div>
                        <div class="flex flex-col gap-1">
                          <span class="text-[9px] uppercase font-bold text-[#888]"
                            >{$_('Read')}</span
                          >
                          <input
                            type="text"
                            class="theme-sub-input"
                            value={listToInput(v.rawValue?.permissions?.read)}
                            placeholder={$_('Emails (empty = everyone)')}
                            onchange={(e) =>
                              handleUpdateMeta(v, {
                                permissions: {
                                  ...(v.rawValue?.permissions || {}),
                                  read: parsePermissionInput((e.target as HTMLInputElement).value)
                                }
                              })}
                          />
                        </div>
                        <div class="flex flex-col gap-1">
                          <span class="text-[9px] uppercase font-bold text-[#888]"
                            >{$_('Write')}</span
                          >
                          <input
                            type="text"
                            class="theme-sub-input"
                            value={listToInput(v.rawValue?.permissions?.write)}
                            placeholder={$_('Emails (empty = everyone)')}
                            onchange={(e) =>
                              handleUpdateMeta(v, {
                                permissions: {
                                  ...(v.rawValue?.permissions || {}),
                                  write: parsePermissionInput((e.target as HTMLInputElement).value)
                                }
                              })}
                          />
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- 🌈 UI with DaisyUI components -->
    <!-- <div class="p-4 card bg-base-100 shadow-md">
    <div class="flex items-center justify-between mb-4">

    <div class="flex gap-2">
        <button class="btn btn-sm btn-outline" onclick={handleUndo}>↩️ {$_('Undo')}</button>
        <button class="btn btn-sm btn-outline" onclick={handleRedo}>↪️ {$_('Redo')}</button>
      </div>
    </div>

    <input
      type="search"
      class="input input-bordered w-full mb-3"
      placeholder="Search variable..."
      bind:value={_search}
    />

    <div class="flex gap-2 mb-4 flex-wrap">
      <input
        type="text"
        class="input input-bordered flex-1"
        placeholder="Name (e.g. price)"
        bind:value={_newVariable.name}
      />

      <select class="w-36" bind:value={_newType}>
        <option value={VariableManipulatorUtils.VAR_TYPE.text}>📝 {$_('Text')}</option>
        <option value={VariableManipulatorUtils.VAR_TYPE.ai}>{$_('AI')}</option>
        <option value={VariableManipulatorUtils.VAR_TYPE.file}>📁 File</option>
        <option value={VariableManipulatorUtils.VAR_TYPE.folder}>📂 Folder</option>
        <option value={VariableManipulatorUtils.VAR_TYPE.richtext}>🧾 {$_('Rich text')}</option>
      </select>

      {#if _newType === VariableManipulatorUtils.VAR_TYPE.file}
        <button class="btn btn-xs btn-outline" onclick={() => handlePickFile(_newVariable)}
          >📁 Choose File</button
        >
        <small class="block text-xs mt-1">{_newVariable.rawValue.url}</small>
      {:else if _newType === VariableManipulatorUtils.VAR_TYPE.folder}
        <button class="btn btn-xs btn-outline" onclick={() => handlePickFolder(_newVariable)}
          >📂 Choose Folder</button
        >
        <small class="block text-xs mt-1">{_newVariable.rawValue.url}</small>
      {:else if _newType === VariableManipulatorUtils.VAR_TYPE.richtext}
        <button class="btn btn-xs btn-outline" onclick={() => handleEditRichText(_newVariable)}
          >🧾 {$_('Write Rich Text')}</button
        >
        <small class="block text-xs mt-1">{_newVariable.rawValue.value}</small>
      {:else if _newType === VariableManipulatorUtils.VAR_TYPE.ai}
        <input
          type="text"
          class="input input-bordered flex-1"
          placeholder="Your Prompt Here"
          bind:value={_newVariable.value}
          onkeydown={(e) => e.key === 'Enter' && handleAdd()}
        />
        
        
      {:else}
        <input
          type="text"
          class="input input-bordered flex-1"
          placeholder="Value"
          bind:value={_newVariable.value}
          onkeydown={(e) => e.key === 'Enter' && handleAdd()}
        />
      {/if}
      <button class="btn btn-success" onclick={handleAdd}>＋ Add</button>
    </div>

    <div class="overflow-x-auto">
      <table class="table table-zebra w-full">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Value</th>
            <th>Evaluated</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each filteredVars as v}
            <tr>
              <td>

                <input
                  type="text"
                  class="input input-sm input-bordered w-full"
                  value={getDisplayName(v)}
                  readonly={isTableCellVariable(v)}
                  class:opacity-60={isTableCellVariable(v)}
                  title={isTableCellVariable(v) ? 'Table cell variable name is managed automatically.' : ''}
                  oninput={(e) => {
                    if (isTableCellVariable(v)) return
                    const name = e.target.value.trim()
                    // Let user type freely (even empty string)
                    // Only rename if it's non-empty and actually changed
                    if (name && name !== getDisplayName(v)) handleRename(v.name, name)
                  }}
                  onblur={async (e) => {
                    if (isTableCellVariable(v)) return
                    const el = e.target as HTMLInputElement
                    const name = el.value.trim()

                    if (name === '') {
                      await openAlertModal({
                        title: 'Variable',
                        message: '⚠️ Please enter a variable name.'
                      })
                      // Restore previous value
                      el.value = getDisplayName(v) === '' ? `var_${nanoid(6)}` : getDisplayName(v)
                      el.dispatchEvent(new Event('input')) // triggers Svelte's oninput listener
                      // Immediately refocus the input *before* showing the alert
                      el.focus()
                    }
                  }}
                />
              </td>
              <td class="uppercase text-xs text-gray-500">{v.rawValue.type ?? getType(v.value)}</td>
              <td>
                {#if (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.file}
                  <button class="btn btn-xs btn-outline" onclick={() => handlePickFile(v, true)}
                    >📁 Choose File</button
                  >
                  <small class="block text-xs mt-1">{v.rawValue.url}</small>
                {:else if (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.folder}
                  <button class="btn btn-xs btn-outline" onclick={() => handlePickFolder(v, true)}
                    >📂 Choose Folder</button
                  >
                  <small class="block text-xs mt-1">{v.rawValue.url}</small>
                {:else if (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.richtext}
                  <button
                    class="btn btn-xs btn-outline"
                    onclick={() => handleEditRichText(v, true)}>🧾 Edit Rich Text</button
                  >
                  <small class="block text-xs mt-1">{v.rawValue.value}</small>
                {:else if (v.rawValue.type ?? getType(v.value)) === VariableManipulatorUtils.VAR_TYPE.ai}
                  <input
                    type="text"
                    class="input input-bordered flex-1"
                    placeholder={$_('Edit Your Prompt Here')}
                    value={v.rawValue.prompt}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') {
                        // handleUpdate
                        handleAIUpdate(v, e.target.value)
                      }
                    }}
                  />
                  
                {:else}
                  <input
                    type="text"
                    class="input input-sm input-bordered w-full"
                    value={v.rawValue ?? v.value}
                    oninput={(e) => handleUpdate(v, (e.target as HTMLInputElement).value)}
                  />
                {/if}
              </td>
              <td class="text-sm text-gray-700">
                {getVariableDisplayValue(v)}
              </td>
              <td>
                <button class="btn btn-xs btn-error" onclick={() => handleDelete(v.name)}
                  >🗑️</button
                >
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div> -->
  </DetachedPanel>
</div>
{#if _showRichEditor}
  <TiptapModalEditor
    initialContent={_editingVar?.rawValue?.value || _editingVar?.value}
    open={_showRichEditor}
    onSave={(html) => handleSaveRichText(html)}
    onCancel={() => (_showRichEditor = false)}
  />
{/if}

<!-- {#if showRichEditor}
  <TiptapModalEditor
    content={editingVar?.value}
    open={showRichEditor}
    onSave={showRichEditor}
    on:save={(e) => handleSaveRichText(e.detail)}
    on:cancel={() => (showRichEditor = false)}
  />
{/if} -->
<style>
  :global(.variable-usage-highlight) {
    outline: 1px solid rgba(59, 130, 246, 0.9);
    background: rgba(59, 130, 246, 0.2);
    border-radius: 2px;
  }

  .adobe-input {
    @apply bg-[var(--color-base-100)] border border-[var(--color-base-content)]/15 rounded-sm px-2 py-1 text-xs outline-none focus:border-primary text-[var(--color-base-content)]/80;
  }

  .adobe-select {
    @apply bg-[var(--color-base-300)] border border-[var(--color-base-content)]/15 rounded-sm px-1 py-1 text-[11px] outline-none hover:bg-[var(--color-base-100)]/12 text-[var(--color-base-content)]/80;
  }

  .adobe-btn-action {
    @apply flex items-center justify-center bg-[var(--color-base-300)] border border-[var(--color-base-content)]/15 rounded-sm py-1 text-[11px] font-medium hover:bg-[var(--color-base-100)]/12 text-[var(--color-base-content)]/80 transition-colors;
  }

  .adobe-table-input {
    @apply bg-transparent w-full outline-none focus:bg-[var(--color-base-100)]/8 px-1 rounded-sm border border-transparent focus:border-primary;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(var(--theme-text-rgb), 0.24);
    border-radius: 2px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
</style>
