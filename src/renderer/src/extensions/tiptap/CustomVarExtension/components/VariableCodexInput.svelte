<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import { _$_documentEditorsList } from '../../../../stores/editor.store'
  import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom'
  import {
    getVariable,
    listVariables,
    onVariableChange,
    validateFormulaInput
  } from '../stores/variableManipulator'
  import CustomVarExtensionDropdown from './CustomVarExtensionDropdown.svelte'
  import { buildVarDropdownItems } from '../utils/variableDropdown.utils'

  type VariableItem = {
    id: string
    name: string
    aliases?: string[]
    type?: string
    value?: any
    displayValue?: string
  }

  let {
    value = $bindable(''), // Use $bindable for cleaner sync
    placeholder = '',
    documentEditor = null,
    className = '',
    onChange = (nextValue: string) => {},
    onEnter = () => {},
    onBlur = (nextValue: string) => {},
    contextNodeId = null
  } = $props()

  let editable = $state<HTMLDivElement>()
  let raw = $state(String(value ?? ''))
  let dropdownOpen = $state(false)
  let dropdownItems = $state<VariableItem[]>([])
  let activeIndex = $state(0)
  let query = $state('')
  let dropdownPos = $state({ x: 0, y: 0 })
  let triggerIndex = $state<number | null>(null)
  let errorMessage = $state('')

  // let {
  //   value = '',
  //   placeholder = '',
  //   documentEditor = null,
  //   className = '',
  //   onChange = (nextValue: string) => {},
  //   onEnter = () => {}
  // } = $props()

  // let editable = $state<HTMLDivElement>()
  // let raw = $state(String(value ?? ''))
  // let dropdownOpen = $state(false)
  // let dropdownItems = $state<VariableItem[]>([])
  // let activeIndex = $state(0)
  // let query = $state('')
  // let dropdownPos = $state({ x: 0, y: 0 })
  let rangeMode = $state(false)
  // let triggerIndex = $state<number | null>(null)

  const activeDocStore = _$_documentEditorsList.getActive()
  const activeDoc = $derived(documentEditor || $activeDocStore)

  let cleanup: () => void // To stop auto-updating when dropdown closes
  let dropdownEl = $state<HTMLElement>() // Bind this to the dropdown component/wrapper

  onDestroy(() => cleanup?.())

  const getVarItems = (): VariableItem[] => {
    if (!activeDoc) return []
    return buildVarDropdownItems(listVariables([], activeDoc), '').map((item) => ({
      id: item.id || item.name,
      name: item.displayName || item.name,
      aliases: item.aliases || [],
      type: item.type,
      value: item.value,
      displayValue: item.displayValue
    }))
  }

  const filterItems = (items: VariableItem[], needle: string): VariableItem[] => {
    const lower = (needle || '').toLowerCase()
    if (!lower) return items
    return items.filter((item) => {
      if (item.name?.toLowerCase().includes(lower)) return true
      return (item.aliases || []).some((alias) => alias?.toLowerCase().includes(lower))
    })
  }

  const buildDisplayName = (uuid: string): string => {
    const match = getVarItems().find((item) => item.id === uuid)
    return match?.name || uuid
  }

  const getValuePreview = (uuid: string): string => {
    if (!activeDoc) return ''
    const value = getVariable(uuid, activeDoc)
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') {
      const raw = value as any
      if ('value' in raw) return String(raw.value ?? '')
      if ('type' in raw || 'message' in raw) return '#ERROR!'
      try {
        return JSON.stringify(raw)
      } catch {
        return String(raw)
      }
    }
    return String(value)
  }

  const createChip = (uuid: string): HTMLElement => {
    const span = document.createElement('span')
    span.className = 'codex-chip'
    span.dataset.varUuid = uuid
    const name = buildDisplayName(uuid)
    const preview = getValuePreview(uuid)
    span.textContent = name
    const hasError = typeof preview === 'string' && preview.trim().startsWith('#')
    if (hasError) {
      span.classList.add('codex-chip-error')
      span.dataset.error = 'Syntax error'
    }
    span.title = preview ? `${name} = ${preview}` : `${name}`
    span.contentEditable = 'false'
    return span
  }

  // BUG FIX: Effect management
  // This effect only runs when the "value" prop changes from the outside
  $effect(() => {
    if (value !== raw) {
      raw = String(value ?? '')
      // We untrack to prevent the effect from re-running if renderFromRaw
      // accidentally touches a reactive state it shouldn't
      untrack(() => renderFromRaw())
    }
  })

  // Initial render
  $effect(() => {
    if (editable && !editable.innerHTML && raw) {
      renderFromRaw()
    }
  })

  const renderFromRaw1 = () => {
    if (!editable) return

    // Save selection if we have focus
    const savedOffset = document.activeElement === editable ? getCaretOffset() : null

    editable.innerHTML = ''
    if (!raw) return

    const regex = /\{([^}]+)\}/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(raw)) !== null) {
      const before = raw.slice(lastIndex, match.index)
      if (before) editable.appendChild(document.createTextNode(before))
      const uuid = match[1].trim()
      editable.appendChild(createChip(uuid))
      lastIndex = match.index + match[0].length
    }

    const rest = raw.slice(lastIndex)
    if (rest) editable.appendChild(document.createTextNode(rest))

    // Restore selection
    if (savedOffset !== null) {
      setTimeout(() => setCaretFromOffset(savedOffset), 0)
    }
  }

  const renderFromRaw = () => {
    if (!editable) return

    // 1. Capture current caret position before we wipe the DOM
    const isFocused = document.activeElement === editable
    const savedOffset = isFocused ? getCaretOffset() : null

    editable.innerHTML = ''
    if (!raw) return

    const regex = /\{([^}]+)\}/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(raw)) !== null) {
      // Append text before the chip
      const before = raw.slice(lastIndex, match.index)
      if (before) {
        editable.appendChild(document.createTextNode(before))
      }

      // Append the Chip
      const uuid = match[1].trim()
      editable.appendChild(createChip(uuid))

      // FIX: Append Zero-Width Space so the cursor can exist after the chip
      editable.appendChild(document.createTextNode('\u200B'))

      lastIndex = match.index + match[0].length
    }

    // Append remaining text
    const rest = raw.slice(lastIndex)
    if (rest) {
      editable.appendChild(document.createTextNode(rest))
    }

    // 2. Restore Caret Position
    if (savedOffset !== null) {
      // We use requestAnimationFrame or setTimeout to wait for DOM paint
      requestAnimationFrame(() => {
        setCaretFromOffset(savedOffset)
      })
    }
  }

  const handleInput = () => {
    const nextRaw = readRawFromDom()
    raw = nextRaw
    value = nextRaw // Update the prop
    onChange(nextRaw)
    errorMessage = ''
    updateTrigger()
    // NOTICE: We do NOT call renderFromRaw() here.
    // Let the browser handle the text nodes while typing.
  }

  /* const renderFromRaw = () => {
    if (!editable) return
    editable.innerHTML = ''
    if (!raw) return

    const regex = /\{([^}]+)\}/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(raw)) !== null) {
      const before = raw.slice(lastIndex, match.index)
      if (before) editable.appendChild(document.createTextNode(before))

      const uuid = match[1].trim()
      editable.appendChild(createChip(uuid))

      lastIndex = match.index + match[0].length
    }

    const rest = raw.slice(lastIndex)
    if (rest) editable.appendChild(document.createTextNode(rest))
  } */

  const readRawFromDom1 = (): string => {
    if (!editable) return ''
    const parts: string[] = []
    editable.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent || '')
        return
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        const uuid = el.dataset?.varUuid
        if (uuid) {
          parts.push(`{${uuid}}`)
          return
        }
        parts.push(el.textContent || '')
      }
    })
    return parts.join('')
  }

  const readRawFromDom = (): string => {
    if (!editable) return ''
    let result = ''

    editable.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        // FIX: Remove the invisible marker characters
        const text = (node.textContent || '').replace(/\u200B/g, '')
        result += text
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        const uuid = el.dataset?.varUuid
        if (uuid) {
          result += `{${uuid}}`
        } else {
          // Handle case where user might have pasted or browser added <div>
          result += (el.textContent || '').replace(/\u200B/g, '')
        }
      }
    })

    return result
  }

  const getCaretOffset = (): number => {
    if (!editable) return raw.length
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return raw.length
    const range = sel.getRangeAt(0)
    const startContainer = range.startContainer
    const chipAncestor =
      startContainer instanceof Element
        ? startContainer.closest?.('[data-var-uuid]')
        : startContainer.parentElement?.closest?.('[data-var-uuid]')

    let offset = 0

    editable.childNodes.forEach((node) => {
      if (node === startContainer || node.contains?.(startContainer)) {
        if (chipAncestor) {
          const uuid = (chipAncestor as HTMLElement).dataset.varUuid || ''
          offset += `{${uuid}}`.length
        } else if (node.nodeType === Node.TEXT_NODE) {
          offset += range.startOffset
        } else {
          offset += node.textContent?.length || 0
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        offset += node.textContent?.length || 0
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const uuid = (node as HTMLElement).dataset?.varUuid
        if (uuid) offset += `{${uuid}}`.length
        else offset += node.textContent?.length || 0
      }
    })

    return offset
  }

  const setCaretFromOffset = (offset: number) => {
    if (!editable) return
    const range = document.createRange()
    const sel = window.getSelection()
    let current = 0
    let placed = false

    editable.childNodes.forEach((node) => {
      if (placed) return
      if (node.nodeType === Node.TEXT_NODE) {
        const len = node.textContent?.length || 0
        if (offset <= current + len) {
          range.setStart(node, Math.max(0, offset - current))
          range.collapse(true)
          placed = true
          return
        }
        current += len
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const uuid = (node as HTMLElement).dataset?.varUuid
        const len = uuid ? `{${uuid}}`.length : node.textContent?.length || 0
        if (offset <= current + len) {
          range.setStartAfter(node)
          range.collapse(true)
          placed = true
          return
        }
        current += len
      }
    })

    if (!placed) {
      range.selectNodeContents(editable)
      range.collapse(false)
    }

    if (sel) {
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }

  const updateDropdownPositionOld = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    dropdownPos = {
      x: rect.left,
      y: rect.bottom + 6
    }
  }

  const updateDropdownPosition = async () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !dropdownEl) return

    const range = sel.getRangeAt(0)

    // Floating UI needs a 'Virtual Element' for the caret
    const virtualElement = {
      getBoundingClientRect: () => range.getBoundingClientRect(),
      getClientRects: () => range.getClientRects()
    }

    const { x, y } = await computePosition(virtualElement, dropdownEl, {
      placement: 'bottom-start',
      middleware: [
        offset(6), // Gap between cursor and dropdown
        flip(), // Flips to top if no space at bottom
        shift({ padding: 5 }) // Keeps dropdown within viewport
      ]
    })

    dropdownPos = { x, y }
  }

  // Start tracking position when dropdown opens
  $effect(() => {
    if (dropdownOpen && editable && dropdownEl) {
      cleanup = autoUpdate(editable, dropdownEl, updateDropdownPosition)
    } else {
      cleanup?.()
    }
  })

  const openDropdown = (needle = '', isRange = false) => {
    query = needle
    rangeMode = isRange
    const items = filterItems(getVarItems(), needle)
    dropdownItems = items
    activeIndex = 0
    dropdownOpen = true
    requestAnimationFrame(updateDropdownPosition)
  }

  const closeDropdown = () => {
    dropdownOpen = false
    rangeMode = false
    query = ''
    dropdownItems = []
  }

  const insertTokenAtCaret = (token: string) => {
    const offset = getCaretOffset()
    const next = `${raw.slice(0, offset)}${token}${raw.slice(offset)}`
    raw = next
    onChange(next)
    renderFromRaw()
    setCaretFromOffset(offset + token.length)
  }

  const handleSelect = (item: VariableItem) => {
    const token = `{${item.id}}`
    if (triggerIndex !== null) {
      const caretOffset = getCaretOffset()
      const start = Math.max(0, triggerIndex)
      const next = `${raw.slice(0, start)}${token}${raw.slice(caretOffset)}`
      raw = next
      onChange(next)
      renderFromRaw()
      setCaretFromOffset(start + token.length)
    } else {
      insertTokenAtCaret(token)
    }
    closeDropdown()
  }

  const updateTrigger = () => {
    const offset = getCaretOffset()
    const before = raw.slice(0, offset)
    const after = raw.slice(offset)

    if (before.endsWith(':') && before.trim().endsWith('}:')) {
      triggerIndex = null
      openDropdown('', true)
      return
    }

    const atIndex = before.lastIndexOf('@')
    if (atIndex >= 0) {
      const token = before.slice(atIndex + 1)
      if (!/[\s{}]/.test(token)) {
        triggerIndex = atIndex
        openDropdown(token, false)
        return
      }
    }

    triggerIndex = null
    if (dropdownOpen) {
      closeDropdown()
    }
  }

  // const handleInput = () => {
  //   raw = readRawFromDom()
  //   onChange(raw)
  //   updateTrigger()
  // }

  const autoCloseFormula = (text: string): { value: string; invalid: boolean } => {
    let invalid = false
    let value = text
    const pairs: Array<[string, string]> = [
      ['(', ')'],
      ['[', ']']
    ]
    for (const [open, close] of pairs) {
      const openCount = (value.match(new RegExp(`\\${open}`, 'g')) || []).length
      const closeCount = (value.match(new RegExp(`\\${close}`, 'g')) || []).length
      if (closeCount > openCount) {
        invalid = true
        continue
      }
      if (openCount > closeCount) {
        value += close.repeat(openCount - closeCount)
      }
    }
    return { value, invalid }
  }

  const shouldValidateFormula = (text: string): boolean => {
    const trimmed = (text || '').trim()
    if (!trimmed) return false
    if (trimmed.startsWith('=')) return true
    if (/\{[^}]+\}/.test(trimmed)) return true
    return false
  }

  const validateAndNormalize = (): boolean => {
    let next = raw
    if (shouldValidateFormula(next)) {
      const autoClosed = autoCloseFormula(next)
      if (autoClosed.invalid) {
        errorMessage = 'Syntax error: unexpected closing bracket.'
        return false
      }
      if (autoClosed.value !== next) {
        next = autoClosed.value
        raw = next
        onChange(next)
        renderFromRaw()
      }
      const editor = activeDoc
      if (!editor) return false
      const validationInput = next.trim().startsWith('=')
        ? next.trim()
        : /\{[^}]+\}/.test(next)
          ? `=${next.trim()}`
          : next.trim()
      const { valid, error } = validateFormulaInput(validationInput, editor, {
        contextNodeId: contextNodeId || undefined
      })
      if (!valid) {
        errorMessage = error || 'Invalid formula'
        return false
      }
    }
    errorMessage = ''
    return true
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.ctrlKey && event.key === ' ') {
      event.preventDefault()
      triggerIndex = null
      openDropdown('', false)
      return
    }
    if (!dropdownOpen && event.key === 'Enter') {
      event.preventDefault()
      if (validateAndNormalize()) {
        onEnter()
      }
      return
    }
    if (!dropdownOpen) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      activeIndex = (activeIndex + 1) % Math.max(dropdownItems.length, 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      activeIndex =
        (activeIndex - 1 + Math.max(dropdownItems.length, 1)) % Math.max(dropdownItems.length, 1)
    } else if (event.key === 'Enter') {
      const item = dropdownItems[activeIndex]
      if (item) {
        event.preventDefault()
        handleSelect(item)
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeDropdown()
    }
  }

  const handleFocus = () => {
    if (!raw) return
    renderFromRaw()
    requestAnimationFrame(updateDropdownPosition)
  }

  /*   const handleBlur = () => {
    const next = readRawFromDom()
    raw = next
    onChange(next)
    if (validateAndNormalize()) {
      onBlur(next)
    }
    closeDropdown()
    renderFromRaw()
  } */

  const handleBlur = (event: FocusEvent) => {
    const next = readRawFromDom()
    raw = next
    onChange(next)

    // Check if the new focus is inside the dropdown wrapper
    const relatedTarget = event.relatedTarget as HTMLElement
    if (dropdownEl && dropdownEl.contains(relatedTarget)) {
      // Keep dropdown open, the user is interacting with the search input/dropdown
      return
    }

    if (validateAndNormalize()) {
      onBlur(next)
    }
    closeDropdown()
    renderFromRaw()
  }

  // $effect(() => {
  //   if (value !== raw) {
  //     raw = String(value ?? '')
  //     renderFromRaw()
  //   }
  // })

  // $effect(() => {
  //   if (!editable) return
  //   renderFromRaw()
  // })

  /*   const handlePointerDown = (event: PointerEvent) => {
    if (!dropdownOpen) return
    const target = event.target as Node | null
    if (!target) return
    if ((target as HTMLElement)?.closest?.('.codex-dropdown-wrapper')) return
    if (editable?.contains(target)) return
    closeDropdown()
  } */

  const handlePointerDown = (event: PointerEvent) => {
    if (!dropdownOpen) return

    const target = event.target as Node | null
    if (!target) return

    // 1. Check if clicking inside the dropdown wrapper
    if (dropdownEl && dropdownEl.contains(target)) {
      return // Don't close
    }

    // 2. Check if clicking the main input
    if (editable && editable.contains(target)) {
      return // Don't close
    }

    // If we clicked anywhere else, close it
    closeDropdown()
  }

  document.addEventListener('pointerdown', handlePointerDown, true)
  onDestroy(() => document.removeEventListener('pointerdown', handlePointerDown, true))

  const unsubscribe = onVariableChange((id) => {
    if (!raw || !id) return
    if (raw.includes(`{${id}}`)) {
      renderFromRaw()
    }
  })
  onDestroy(() => unsubscribe?.())
</script>

<!-- <div class="codex-input-wrapper">
  <div
    class="codex-input {className}"
    bind:this={editable}
    contenteditable="true"
    data-placeholder={placeholder}
    oninput={handleInput}
    onkeydown={handleKeydown}
    onfocus={handleFocus}
    onblur={handleBlur}
    spellcheck="false"
  ></div> -->
<div class="relative w-full">
  <div class="codex-input-wrapper">
    <div
      bind:this={editable}
      class="codex-input {className}"
      contenteditable="true"
      data-placeholder={placeholder}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onfocus={handleFocus}
      onblur={handleBlur}
      spellcheck="false"
    ></div>
  </div>

  {#if dropdownOpen}
    <!-- <div class="codex-dropdown-wrapper"> -->
    <div
      bind:this={dropdownEl}
      class="fixed z-50 pointer-events-none"
      style="left: {dropdownPos.x}px; top: {dropdownPos.y}px; visibility: {dropdownOpen
        ? 'visible'
        : 'hidden'}"
    >
      <div class="pointer-events-auto">
        <CustomVarExtensionDropdown
          items={dropdownItems}
          {activeIndex}
          {query}
          position={dropdownPos}
          selectItem={(item) => handleSelect(item)}
        />
        <!-- </div> -->
      </div>
    </div>
  {/if}
  {#if errorMessage}
    <div class="codex-input-error">{errorMessage}</div>
  {/if}
</div>

<style>
  .codex-input-wrapper {
    position: relative;
    width: 100%;
  }

  .codex-input {
    min-height: 32px;
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--color-base-200);
    background: var(--color-base-100);
    color: var(--text-[var(--color-base-100)]);
    font-size: 11px;
    line-height: 1.6; /* Increased for better chip alignment */
    outline: none;

    /* FIX: display block + pre-wrap allows cursor to move naturally */
    display: block;
    word-wrap: break-word;
    white-space: pre-wrap;
    text-align: left;
  }

  .codex-input:empty:before {
    content: attr(data-placeholder);
    color: rgba(255, 255, 255, 0.35);
    pointer-events: none;
  }

  /* FIX: Ensure chips behave like characters in a sentence */
  :global(.codex-chip) {
    display: inline-flex;
    align-items: center;
    padding: 0px 6px;
    margin: 1px 2px;
    border-radius: 4px;
    background: rgba(66, 133, 244, 0.25);
    color: #d6e4ff;
    border: 1px solid rgba(66, 133, 244, 0.45);
    font-size: 10px;
    font-weight: 600;
    line-height: 18px;
    vertical-align: baseline;
    user-select: none;
    cursor: default;
  }

  :global(.codex-chip-error) {
    background: rgba(239, 68, 68, 0.18);
    border-color: rgba(239, 68, 68, 0.55);
    color: #ffd7d7;
    position: relative;
  }

  :global(.codex-chip-error)::after {
    content: attr(data-error);
    margin-left: 6px;
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 0 4px;
    border-radius: 3px;
    background: rgba(239, 68, 68, 0.35);
    color: #ffecec;
  }

  .codex-input-error {
    margin-top: 4px;
    font-size: 10px;
    color: #f87171;
  }
</style>
