import { writable, type Readable } from 'svelte/store'
import { _$_wysiwygEditorsList } from './editor.store'

type FontPickerState = {
  fontFamily: string
  fontSize: number
}

const DEFAULT_FONT_FAMILY = 'Arial'
const DEFAULT_FONT_SIZE_PT = 12

const state = writable<FontPickerState>({
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: DEFAULT_FONT_SIZE_PT
})

let syncStarted = false
let activeEditorUnsubscribe: (() => void) | null = null
let boundEditor: any = null

function pxToPt(px: number): number {
  return (px * 72) / 96
}

function normalizeFontFamily(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return DEFAULT_FONT_FAMILY
  return raw.replace(/^['"]|['"]$/g, '') || DEFAULT_FONT_FAMILY
}

function normalizeFontSizePt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.round(value))
  }

  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return DEFAULT_FONT_SIZE_PT

  if (raw.endsWith('pt')) {
    const parsed = Number.parseFloat(raw.replace('pt', ''))
    return Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : DEFAULT_FONT_SIZE_PT
  }

  if (raw.endsWith('px')) {
    const parsedPx = Number.parseFloat(raw.replace('px', ''))
    return Number.isFinite(parsedPx) ? Math.max(1, Math.round(pxToPt(parsedPx))) : DEFAULT_FONT_SIZE_PT
  }

  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : DEFAULT_FONT_SIZE_PT
}

function getTextStyleFromEditor(editor: any): FontPickerState {
  try {
    const attrs = editor?.getAttributes?.('textStyle') || {}
    let fontFamily = attrs.fontFamily
    let fontSize = attrs.fontSize

    // Cursor-only selection often relies on stored marks.
    if ((!fontFamily || !fontSize) && editor?.state?.storedMarks?.length) {
      const storedTextStyle = editor.state.storedMarks.find((mark: any) => mark?.type?.name === 'textStyle')
      if (storedTextStyle?.attrs) {
        fontFamily = fontFamily || storedTextStyle.attrs.fontFamily
        fontSize = fontSize || storedTextStyle.attrs.fontSize
      }
    }

    return {
      fontFamily: normalizeFontFamily(fontFamily),
      fontSize: normalizeFontSizePt(fontSize)
    }
  } catch {
    return {
      fontFamily: DEFAULT_FONT_FAMILY,
      fontSize: DEFAULT_FONT_SIZE_PT
    }
  }
}

function syncFromEditor(editor: any) {
  if (!editor) return
  const next = getTextStyleFromEditor(editor)
  state.update((prev) => {
    if (prev.fontFamily === next.fontFamily && prev.fontSize === next.fontSize) return prev
    return next
  })
}

function unbindEditor() {
  if (!boundEditor) return
  boundEditor.off?.('selectionUpdate', handleEditorSelectionChange)
  boundEditor.off?.('transaction', handleEditorSelectionChange)
  boundEditor.off?.('focus', handleEditorSelectionChange)
  boundEditor = null
}

function bindEditor(editor: any) {
  if (!editor || editor === boundEditor) return
  unbindEditor()
  boundEditor = editor
  editor.on?.('selectionUpdate', handleEditorSelectionChange)
  editor.on?.('transaction', handleEditorSelectionChange)
  editor.on?.('focus', handleEditorSelectionChange)
  syncFromEditor(editor)
}

function handleEditorSelectionChange(payload: any) {
  const editor = payload?.editor || boundEditor
  syncFromEditor(editor)
}

export function ensureFontPickerSync() {
  if (syncStarted) return
  syncStarted = true

  const activeEditorStore = _$_wysiwygEditorsList.getActive() as Readable<any>
  activeEditorUnsubscribe = activeEditorStore.subscribe((entry) => {
    const editor = entry?.editor || null
    if (!editor) {
      unbindEditor()
      return
    }
    bindEditor(editor)
  })
}

export function setFontPickerFromUi(partial: Partial<FontPickerState>) {
  state.update((prev) => ({
    fontFamily:
      partial.fontFamily !== undefined ? normalizeFontFamily(partial.fontFamily) : prev.fontFamily,
    fontSize: partial.fontSize !== undefined ? normalizeFontSizePt(partial.fontSize) : prev.fontSize
  }))
}

export const fontPickerState = {
  subscribe: state.subscribe
}

export function destroyFontPickerSync() {
  activeEditorUnsubscribe?.()
  activeEditorUnsubscribe = null
  unbindEditor()
  syncStarted = false
}
