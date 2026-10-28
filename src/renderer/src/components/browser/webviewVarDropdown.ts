import { mount, unmount } from 'svelte'
import { computePosition, offset, flip, shift } from '@floating-ui/dom'
import CustomVarExtensionDropdown from '../../extensions/tiptap/CustomVarExtension/components/CustomVarExtensionDropdown.svelte'
import { listVariables } from '../../extensions/tiptap/CustomVarExtension/stores/variableManipulator'
import { buildVarDropdownItems } from '../../extensions/tiptap/CustomVarExtension/utils/variableDropdown.utils'
import { formatVariableInsertText } from '../../extensions/tiptap/CustomVarExtension/utils/variableInsert.utils'
import { _$_documentEditorsList } from '../../stores/editor.store'

type VarInputPayload = {
  open?: boolean
  text?: string
  x?: number
  y?: number
  rect?: { x: number; y: number; width: number; height: number }
}

type DropdownState = {
  items: any[]
  activeIndex: number
  query: string
  position: { x: number; y: number } | null
  selectItem: (item: any) => void
}

const ALLOW_ATTR = 'data-var-allow'
const INPUT_TYPE_ATTR = 'data-var-input-type'

function getInputTemplate(el: HTMLElement) {
  const template = el.getAttribute(INPUT_TYPE_ATTR)
  return template?.trim() || 'value'
}

export function registerWebviewVarDropdown(webviewEl: HTMLElement & { send: any }) {
  let component: any = null
  let container: HTMLElement | null = null
  let state: DropdownState = {
    items: [],
    activeIndex: 0,
    query: '',
    position: null,
    selectItem: () => undefined
  }

  const close = () => {
    if (component) unmount(component)
    component = null
    container?.remove()
    container = null
    webviewEl.send?.('dropdown-active', { active: false })
  }

  const updatePosition = async (rect?: VarInputPayload['rect']) => {
    if (!container || !rect) return
    const webviewRect = webviewEl.getBoundingClientRect()
    const globalRect = {
      x: webviewRect.left + rect.x,
      y: webviewRect.top + rect.y,
      width: rect.width,
      height: rect.height
    }
    const virtualEl = {
      getBoundingClientRect: () => ({
        x: globalRect.x,
        y: globalRect.y,
        top: globalRect.y,
        bottom: globalRect.y + globalRect.height,
        left: globalRect.x,
        right: globalRect.x + globalRect.width,
        width: globalRect.width,
        height: globalRect.height
      })
    }
    const { x, y } = await computePosition(virtualEl, container.firstElementChild || container, {
      placement: 'bottom-start',
      strategy: 'fixed',
      middleware: [offset(8), flip(), shift({ padding: 12 })]
    })
    state.position = { x, y }
  }

  const open = async (payload: VarInputPayload) => {
    if (!container) {
      container = document.createElement('span')
      document.body.appendChild(container)
    }

    const activeDoc = _$_documentEditorsList.getActiveSync?.()
    const vars = activeDoc ? listVariables([], activeDoc) : []
    const items = buildVarDropdownItems(vars, payload.text || '')

    state.items = items
    state.activeIndex = 0
    state.query = payload.text || ''
    state.selectItem = (item) => {
      const text = formatVariableInsertText(item, getInputTemplate(webviewEl))
      webviewEl.send('insert-value', { text })
      close()
    }

    if (!component) {
      component = mount(CustomVarExtensionDropdown, {
        target: container,
        props: state
      })
    }
    webviewEl.send?.('dropdown-active', { active: true })
    await updatePosition(payload.rect)
  }

  const handleDocPointer = (event: MouseEvent) => {
    if (!container) return
    const target = event.target as Node | null
    if (target && container.contains(target)) return
    close()
  }

  function getRectFromPayload(payload: VarInputPayload) {
    if (payload.rect) return payload.rect
    if (typeof payload.x === 'number' && typeof payload.y === 'number') {
      return { x: payload.x, y: payload.y, width: 1, height: 16 }
    }
    return null
  }

  function parseTrigger(textBefore: string) {
    const match = textBefore.match(/(^|\s)@([\w.-]*)$/)
    if (!match) return null
    return match[2] || ''
  }

  const handleIpcMessage = (event: any) => {
    if (!webviewEl.getAttribute(ALLOW_ATTR)) return
    if (event.channel === 'show-dropdown') {
      const payload = event.args?.[0] as VarInputPayload
      if (!payload || payload.open === false) {
        close()
        return
      }
      const query = parseTrigger(payload.text || '')
      if (query === null) {
        close()
        return
      }
      const rect = getRectFromPayload(payload)
      if (!rect) return
      void open({ rect, text: query })
      return
    }
    if (event.channel === 'var-input-key') {
      const payload = event.args?.[0] as { key: string }
      if (!payload?.key) return
      if (!state.items.length) return
      if (payload.key === 'ArrowDown') {
        state.activeIndex = (state.activeIndex + 1) % Math.max(state.items.length, 1)
        return
      }
      if (payload.key === 'ArrowUp') {
        state.activeIndex =
          (state.activeIndex - 1 + Math.max(state.items.length, 1)) % Math.max(state.items.length, 1)
        return
      }
      if (payload.key === 'Enter') {
        const item = state.items[state.activeIndex]
        if (!item) return
        const text = formatVariableInsertText(item, getInputTemplate(webviewEl))
        webviewEl.send('insert-value', { text })
        close()
        return
      }
      if (payload.key === 'Escape') {
        close()
      }
    }
  }

  webviewEl.addEventListener('ipc-message', handleIpcMessage)
  document.addEventListener('mousedown', handleDocPointer)

  return () => {
    close()
    webviewEl.removeEventListener('ipc-message', handleIpcMessage)
    document.removeEventListener('mousedown', handleDocPointer)
  }
}
