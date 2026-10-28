import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('browserBridge', {
  notifySelection(text: string) {
    ipcRenderer.send('browser:selection-changed', { text })
  }
})

const ALLOW_ATTR = 'data-var-allow'
const INPUT_TYPE_ATTR = 'data-var-input-type'

type AllowedElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement

function isAllowedElement(target: EventTarget | null): AllowedElement | null {
  if (!(target instanceof HTMLElement)) return null
  const blocked = target.closest<HTMLElement>(`[${ALLOW_ATTR}="false"]`)
  if (blocked) return null
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

function getCaretRectForInput(el: HTMLInputElement | HTMLTextAreaElement) {
  const style = window.getComputedStyle(el)
  const mirror = document.createElement('div')
  mirror.style.position = 'fixed'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.wordWrap = 'break-word'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.font = style.font
  mirror.style.padding = style.padding
  mirror.style.border = style.border
  mirror.style.boxSizing = style.boxSizing
  mirror.style.width = style.width
  mirror.style.lineHeight = style.lineHeight
  mirror.style.letterSpacing = style.letterSpacing

  const textBefore = el.value.slice(0, el.selectionStart ?? 0)
  const textAfter = el.value.slice(el.selectionStart ?? 0) || '.'
  mirror.textContent = textBefore

  const span = document.createElement('span')
  span.textContent = textAfter
  mirror.appendChild(span)
  document.body.appendChild(mirror)

  const rect = span.getBoundingClientRect()
  const inputRect = el.getBoundingClientRect()
  const x = inputRect.left + rect.left - mirror.getBoundingClientRect().left
  const y = inputRect.top + rect.top - mirror.getBoundingClientRect().top
  document.body.removeChild(mirror)
  return { x, y, width: rect.width || 0, height: rect.height || parseFloat(style.lineHeight || '16') }
}

function getCaretRect(el: AllowedElement) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return getCaretRectForInput(el)
  }
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  if (!rect) return null
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
}

function getInputTypeTemplate(el: AllowedElement | null) {
  if (!el) return 'value'
  return el.getAttribute(INPUT_TYPE_ATTR) || 'value'
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

window.addEventListener('DOMContentLoaded', () => {
  let lastText = ''
  let activeElement: AllowedElement | null = null
  let triggerIndex = 0
  let isOpen = false

  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection()?.toString() || ''
    if (selection && selection !== lastText) {
      lastText = selection
      ipcRenderer.send('browser:selection-changed', { text: selection })
    }
  })

  const emitClose = () => {
    if (!isOpen) return
    isOpen = false
    ipcRenderer.send('browser:var-input', { open: false })
  }

  const emitOpen = (query: string, rect: { x: number; y: number; width: number; height: number }) => {
    isOpen = true
    ipcRenderer.send('browser:var-input', {
      open: true,
      query,
      rect,
      inputType: getInputTypeTemplate(activeElement)
    })
  }

  document.addEventListener('input', (event) => {
    const el = isAllowedElement(event.target)
    if (!el) {
      emitClose()
      return
    }

    activeElement = el
    const textBefore =
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        ? getInputTextBeforeCaret(el).text
        : getContentEditableTextBeforeCaret(el).text

    const trigger = findTrigger(textBefore)
    if (!trigger) {
      emitClose()
      return
    }

    triggerIndex = trigger.atIndex
    const rect = getCaretRect(el)
    if (!rect) {
      emitClose()
      return
    }
    emitOpen(trigger.query, rect)
  }, true)

  document.addEventListener('keydown', (event) => {
    if (!isOpen) return
    const el = isAllowedElement(event.target)
    if (!el || el !== activeElement) return
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
      event.preventDefault()
      ipcRenderer.send('browser:var-input-key', { key: event.key })
    }
  }, true)

  document.addEventListener('focusout', () => emitClose(), true)

  ipcRenderer.on('browser:var-insert', (_event, payload: { text: string }) => {
    if (!activeElement || !payload?.text) return
    if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
      const end = activeElement.selectionStart ?? triggerIndex
      replaceInputRange(activeElement, triggerIndex, end, payload.text)
    } else {
      const before = getContentEditableTextBeforeCaret(activeElement)
      const end = before.caret
      replaceContentEditableRange(activeElement, triggerIndex, end, payload.text)
    }
  })
})
