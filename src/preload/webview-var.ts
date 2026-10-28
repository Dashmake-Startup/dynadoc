import { ipcRenderer } from 'electron'

type AllowedElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement

const TRIGGER_CHAR = '@'

let activeElement: AllowedElement | null = null
let triggerIndex = 0
let isOpen = false
let suppressCloseUntil = 0

function isAllowedElement(target: EventTarget | null): AllowedElement | null {
  if (!(target instanceof HTMLElement)) return null
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return target
  if (target.isContentEditable) return target
  return null
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

function buildMirror(el: HTMLInputElement | HTMLTextAreaElement) {
  const div = document.createElement('div')
  const style = window.getComputedStyle(el)
  const isTextArea = el instanceof HTMLTextAreaElement

  div.style.position = 'absolute'
  div.style.visibility = 'hidden'
  div.style.whiteSpace = isTextArea ? 'pre-wrap' : 'pre'
  div.style.wordWrap = 'break-word'
  div.style.font = style.font
  div.style.padding = style.padding
  div.style.border = style.border
  div.style.boxSizing = style.boxSizing
  div.style.letterSpacing = style.letterSpacing
  div.style.textTransform = style.textTransform
  div.style.width = `${el.clientWidth}px`
  div.style.lineHeight = style.lineHeight
  div.style.textAlign = style.textAlign

  return div
}

function getInputCaretRect(el: HTMLInputElement | HTMLTextAreaElement) {
  const value = el.value
  const caret = el.selectionStart ?? 0
  const mirror = buildMirror(el)
  const before = document.createElement('span')
  before.textContent = value.slice(0, caret)
  const caretSpan = document.createElement('span')
  caretSpan.textContent = value.slice(caret) || '.'
  mirror.appendChild(before)
  mirror.appendChild(caretSpan)
  document.body.appendChild(mirror)
  const caretRect = caretSpan.getBoundingClientRect()
  const mirrorRect = mirror.getBoundingClientRect()
  const inputRect = el.getBoundingClientRect()
  document.body.removeChild(mirror)

  return {
    x: inputRect.left + (caretRect.left - mirrorRect.left),
    y: inputRect.top + (caretRect.top - mirrorRect.top),
    width: 1,
    height: parseFloat(window.getComputedStyle(el).lineHeight || '16')
  }
}

function getContentEditableCaretRect(el: HTMLElement) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!el.contains(range.startContainer)) return null
  const rect = range.getBoundingClientRect()
  if (rect && rect.width + rect.height > 0) {
    return { x: rect.left, y: rect.top, width: rect.width || 1, height: rect.height || 16 }
  }
  const fallback = el.getBoundingClientRect()
  return { x: fallback.left, y: fallback.top, width: 1, height: 16 }
}

function getCaretRect(el: AllowedElement) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return getInputCaretRect(el)
  }
  return getContentEditableCaretRect(el)
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

function sendOpen(
  textBefore: string,
  rect: { x: number; y: number; width: number; height: number }
) {
  ipcRenderer.sendToHost('show-dropdown', {
    x: rect.x,
    y: rect.y,
    text: textBefore
  })
}

function sendClose() {
  if (!isOpen) return
  if (Date.now() < suppressCloseUntil) return
  ipcRenderer.sendToHost('show-dropdown', { open: false })
  isOpen = false
  activeElement = null
}

function handleInputEvent(e: Event) {
  const target = isAllowedElement(e.target)
  if (!target) {
    sendClose()
    return
  }

  const before =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      ? getInputTextBeforeCaret(target)
      : getContentEditableTextBeforeCaret(target)
  const trigger = findTrigger(before.text)
  if (!trigger) {
    sendClose()
    return
  }

  activeElement = target
  triggerIndex = trigger.atIndex
  const caretRect = getCaretRect(target)
  if (!caretRect) return
  isOpen = true
  sendOpen(before.text, caretRect)
}

function handleKeydown(e: KeyboardEvent) {
  if (!isOpen) return
  if (!activeElement) return
  const key = e.key
  if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(key)) {
    ipcRenderer.sendToHost('var-input-key', { key })
    if (key === 'Escape') sendClose()
  }
}


ipcRenderer.on('insert-value', (_event, payload: { text: string }) => {
  if (!activeElement || !payload?.text) return
  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
    const end = activeElement.selectionStart ?? triggerIndex
    replaceInputRange(activeElement, triggerIndex, end, payload.text)
  } else {
    const before = getContentEditableTextBeforeCaret(activeElement)
    replaceContentEditableRange(activeElement, triggerIndex, before.caret, payload.text)
  }
  sendClose()
})

ipcRenderer.on('dropdown-active', (_event, payload: { active: boolean }) => {
  if (payload?.active) {
    suppressCloseUntil = Date.now() + 400
    return
  }
  suppressCloseUntil = 0
})

document.addEventListener('input', handleInputEvent, true)
document.addEventListener('keydown', handleKeydown, true)
