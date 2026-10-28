import { mount, unmount } from 'svelte'
import { computePosition, offset, flip, shift } from '@floating-ui/dom'
import { get } from 'svelte/store'
import CustomVarExtensionDropdown from '../components/CustomVarExtensionDropdown.svelte'
import { listVariables } from '../stores/variableManipulator'
import { _$_documentEditorsList } from '../../../../stores/editor.store'
import { buildVarDropdownItems } from './variableDropdown.utils'
import { formatVariableInsertText } from './variableInsert.utils'

type DropdownItem = {
  name: string
  value?: any
  type?: string
  aliases?: string[]
  rawValue?: any
  displayValue?: string
}

type DropdownState = {
  items: DropdownItem[]
  activeIndex: number
  query: string
  position: { x: number; y: number } | null
  selectItem: (item: DropdownItem) => void
}

type AllowedElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement

const TRIGGER_CHAR = '@'
const ALLOW_ATTR = 'data-var-allow'
const INPUT_TYPE_ATTR = 'data-var-input-type'

function isAllowedElement(target: EventTarget | null): AllowedElement | null {
  if (!(target instanceof HTMLElement)) return null
  const el = target.closest<HTMLElement>(`[${ALLOW_ATTR}="true"]`)
  if (!el) return null
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el
  if (el.isContentEditable) return el
  return null
}

function getInsertionTemplate(el: AllowedElement | null): string {
  if (!el) return 'value'
  const template = el.getAttribute(INPUT_TYPE_ATTR)
  if (!template) return 'value'
  return template.trim()
}

function getActiveDoc() {
  return get(_$_documentEditorsList.getActive())
}

function buildItems(query: string): DropdownItem[] {
  const activeDoc = getActiveDoc()
  if (!activeDoc) return []
  return buildVarDropdownItems(listVariables([], activeDoc), query)
}

function getInputTextBeforeCaret(el: HTMLInputElement | HTMLTextAreaElement) {
  const caret = el.selectionStart ?? 0
  return { text: el.value.slice(0, caret), caret }
}

function getContentEditableTextBeforeCaret(el: HTMLElement) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return { text: '', caret: 0 }
  const range = selection.getRangeAt(0)
  if (!el.contains(range.startContainer)) return { text: '', caret: 0 }
  const clone = range.cloneRange()
  clone.selectNodeContents(el)
  clone.setEnd(range.startContainer, range.startOffset)
  const text = clone.toString()
  return { text, caret: text.length }
}

function findTrigger(textBefore: string) {
  const match = textBefore.match(/(^|\s)@([\w.-]*)$/)
  if (!match) return null
  const query = match[2] || ''
  const atIndex = textBefore.length - query.length - 1
  return { query, atIndex }
}

function replaceInputRange(
  el: HTMLInputElement | HTMLTextAreaElement,
  start: number,
  end: number,
  insertText: string
) {
  const value = el.value
  const next = value.slice(0, start) + insertText + value.slice(end)
  el.value = next
  const caretPos = start + insertText.length
  el.setSelectionRange(caretPos, caretPos)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function getTextNodes(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let node = walker.nextNode()
  while (node) {
    nodes.push(node as Text)
    node = walker.nextNode()
  }
  return nodes
}

function rangeFromCharacterOffsets(root: HTMLElement, start: number, end: number) {
  const nodes = getTextNodes(root)
  let current = 0
  const range = document.createRange()
  let startSet = false

  for (const node of nodes) {
    const len = node.nodeValue?.length || 0
    const next = current + len

    if (!startSet && start <= next) {
      range.setStart(node, Math.max(0, start - current))
      startSet = true
    }
    if (startSet && end <= next) {
      range.setEnd(node, Math.max(0, end - current))
      return range
    }
    current = next
  }
  return null
}

function replaceContentEditableRange(
  el: HTMLElement,
  start: number,
  end: number,
  insertText: string
) {
  const range = rangeFromCharacterOffsets(el, start, end)
  if (!range) return
  range.deleteContents()
  range.insertNode(document.createTextNode(insertText))
  const selection = window.getSelection()
  if (selection) {
    selection.removeAllRanges()
    const caret = document.createRange()
    caret.setStart(range.endContainer, range.endOffset)
    caret.collapse(true)
    selection.addRange(caret)
  }
}

function getCaretRect(el: AllowedElement) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const rect = el.getBoundingClientRect()
    return { x: rect.left, y: rect.bottom }
  }
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  if (!rect) return null
  return { x: rect.left, y: rect.bottom }
}


export function initGlobalVarDropdown() {
  let activeElement: AllowedElement | null = null
  let triggerIndex = 0
  let isOpen = false
  let container: HTMLElement | null = null
  let component: any = null
  let state: DropdownState = {
    items: [],
    activeIndex: 0,
    query: '',
    position: null,
    selectItem: () => undefined
  }

  const updatePosition = async () => {
    if (!isOpen || !activeElement || !container) return
    const caretRect = getCaretRect(activeElement)
    if (!caretRect) return
    const virtualEl = {
      getBoundingClientRect: () => ({
        x: caretRect.x,
        y: caretRect.y,
        top: caretRect.y,
        bottom: caretRect.y,
        left: caretRect.x,
        right: caretRect.x,
        width: 0,
        height: 0
      })
    }
    const { x, y } = await computePosition(virtualEl, container.firstElementChild || container, {
      placement: 'bottom-start',
      strategy: 'fixed',
      middleware: [offset(8), flip(), shift({ padding: 12 })]
    })
    state.position = { x, y }
  }

  const closeDropdown = () => {
    // return
    if (component) unmount(component)
    component = null
    container?.remove()
    container = null
    isOpen = false
    activeElement = null
  }

  const openDropdown = (items: DropdownItem[], query: string) => {
    if (!container) {
      container = document.createElement('span')
      document.body.appendChild(container)
    }

    state.items = items
    state.activeIndex = 0
    state.query = query
    state.selectItem = (item) => {
      if (!activeElement) return
      const insertText = formatVariableInsertText(item, getInsertionTemplate(activeElement))
      if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
        const end = activeElement.selectionStart ?? triggerIndex
        replaceInputRange(activeElement, triggerIndex, end, insertText)
      } else {
        const before = getContentEditableTextBeforeCaret(activeElement)
        const end = before.caret
        replaceContentEditableRange(activeElement, triggerIndex, end, insertText)
      }
      closeDropdown()
    }

    if (!component) {
      component = mount(CustomVarExtensionDropdown, {
        target: container,
        props: state
      })
    }
    isOpen = true
    void updatePosition()
  }

  const updateDropdown = (items: DropdownItem[], query: string) => {
    if (!isOpen) {
      openDropdown(items, query)
      return
    }
    state.items = items
    state.activeIndex = Math.min(state.activeIndex, Math.max(items.length - 1, 0))
    state.query = query
    void updatePosition()
  }

  const handleInput = (event: Event) => {
    const el = isAllowedElement(event.target)
    if (!el) {
      closeDropdown()
      return
    }

    activeElement = el
    const textBefore =
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        ? getInputTextBeforeCaret(el).text
        : getContentEditableTextBeforeCaret(el).text

    const trigger = findTrigger(textBefore)
    if (!trigger) {
      closeDropdown()
      return
    }

    triggerIndex = trigger.atIndex
    const items = buildItems(trigger.query)
    updateDropdown(items, trigger.query)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isOpen) return
    const el = isAllowedElement(event.target)
    if (!el || el !== activeElement) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      state.activeIndex = (state.activeIndex + 1) % Math.max(state.items.length, 1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      state.activeIndex =
        (state.activeIndex - 1 + Math.max(state.items.length, 1)) %
        Math.max(state.items.length, 1)
      return
    }
    if (event.key === 'Enter') {
      if (!state.items.length) return
      event.preventDefault()
      state.selectItem(state.items[state.activeIndex])
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      closeDropdown()
    }
  }

  const handlePointerDown = (event: Event) => {
    if (!isOpen) return
    const target = event.target as Node | null
    if (!target) return
    if (container?.contains(target)) return
    if (activeElement?.contains(target)) return
    closeDropdown()
  }

  const handleFocusOut = (event: FocusEvent) => {
    if (!isOpen) return
    const related = event.relatedTarget as Node | null
    if (related && container?.contains(related)) return
    closeDropdown()
  }

  document.addEventListener('input', handleInput, true)
  document.addEventListener('keydown', handleKeyDown, true)
  document.addEventListener('pointerdown', handlePointerDown, true)
  document.addEventListener('focusout', handleFocusOut, true)
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)

  return () => {
    document.removeEventListener('input', handleInput, true)
    document.removeEventListener('keydown', handleKeyDown, true)
    document.removeEventListener('pointerdown', handlePointerDown, true)
    document.removeEventListener('focusout', handleFocusOut, true)
    window.removeEventListener('resize', updatePosition)
    window.removeEventListener('scroll', updatePosition, true)
    closeDropdown()
  }
}
