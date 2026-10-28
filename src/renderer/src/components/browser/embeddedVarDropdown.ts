import { mount, unmount } from 'svelte'
import { computePosition, offset, flip, shift } from '@floating-ui/dom'
import CustomVarExtensionDropdown from '../../extensions/tiptap/CustomVarExtension/components/CustomVarExtensionDropdown.svelte'
import { listVariables } from '../../extensions/tiptap/CustomVarExtension/stores/variableManipulator'
import { buildVarDropdownItems } from '../../extensions/tiptap/CustomVarExtension/utils/variableDropdown.utils'
import { formatVariableInsertText } from '../../extensions/tiptap/CustomVarExtension/utils/variableInsert.utils'
import { _$_documentEditorsList } from '../../stores/editor.store'
import { getEmbeddedBounds } from './embeddedViewRegistry'
import { acquireOverlayInteraction } from '../../utils/overlayInteraction'

type VarInputPayload = {
  open: boolean
  query?: string
  rect?: { x: number; y: number; width: number; height: number }
  inputType?: string
  id?: string
}

type DropdownState = {
  items: any[]
  activeIndex: number
  query: string
  position: { x: number; y: number } | null
  selectItem: (item: any) => void
}

let initialized = false

export function ensureEmbeddedVarDropdown() {
  if (initialized) return () => undefined
  initialized = true

  const api = (window as any)?.api?.embedded
  if (!api) return () => undefined

  let component: any = null
  let container: HTMLElement | null = null
  let releaseInteraction: (() => void) | null = null
  let activeViewId: string | null = null
  let lastInputType = 'value'
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
    releaseInteraction?.()
    releaseInteraction = null
  }

  const updatePosition = async (rect?: VarInputPayload['rect']) => {
    if (!container || !rect) return
    const bounds = activeViewId ? getEmbeddedBounds(activeViewId) : null
    const x1 = bounds ? bounds.x + rect.x : rect.x
    const y1 = bounds ? bounds.y + rect.y : rect.y
    const virtualEl = {
      getBoundingClientRect: () => ({
        x:x1,
        y:y1,
        top: y1,
        bottom: y1 + rect.height,
        left: x1,
        right: x1 + rect.width,
        width: rect.width,
        height: rect.height
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
    const items = buildVarDropdownItems(vars, payload.query || '')

    activeViewId = payload.id || activeViewId
    lastInputType = payload.inputType || 'value'

    state.items = items
    state.activeIndex = 0
    state.query = payload.query || ''
    state.selectItem = (item) => {
      if (!activeViewId) return
      const text = formatVariableInsertText(item, lastInputType)
      api.insertVarText({ id: activeViewId, text })
      close()
    }

    if (!component) {
      component = mount(CustomVarExtensionDropdown, {
        target: container,
        props: state
      })
    }
    if (!releaseInteraction) {
      releaseInteraction = acquireOverlayInteraction()
    }
    await updatePosition(payload.rect)
  }

  const onVarInput = (payload: VarInputPayload) => {
    if (!payload?.open) {
      close()
      return
    }
    void open(payload)
  }

  const onVarInputKey = (payload: { key: string; id: string }) => {
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
      const text = formatVariableInsertText(item, lastInputType)
      api.insertVarText({ id: payload.id, text })
      close()
      return
    }
    if (payload.key === 'Escape') {
      close()
    }
  }

  api.onVarInput(onVarInput)
  api.onVarInputKey(onVarInputKey)

  return () => {
    close()
  }
}
