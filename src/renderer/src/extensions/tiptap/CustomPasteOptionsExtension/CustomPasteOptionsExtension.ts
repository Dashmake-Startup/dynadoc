import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import { openConfirmModal } from '../../../stores/confirmModal.store'
import { importFileIntoDocumentAssets } from '../../../utils/documentAssetImport'
import { _$_wysiwygEditorDynamicReferenceIndexes } from '../CustomDynamicReferenceNodeExtension/stores/common.store'
import { nodeApi } from '../../../utils/shims/node'
import { toAssetUrl, toLocalPath } from '../../../utils/assetUrl'

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

type PasteAction = {
  id: string
  label: string
  description?: string
  run: () => void
}

function normalizePastedPath(raw: string): string | null {
  let cleaned = (raw || '').trim()
  if (!cleaned) return null

  cleaned = cleaned.replace(/^['"]+|['"]+$/g, '')
  cleaned = toLocalPath(cleaned)

  if (cleaned.startsWith('~/')) {
    const home = nodeApi.os?.homedir?.()
    if (home) cleaned = nodeApi.path.join(home, cleaned.slice(2))
  }

  if (/^\/[A-Za-z]:[\\/]/.test(cleaned)) {
    cleaned = cleaned.slice(1)
  }

  const pathApi = nodeApi.path
  if (pathApi?.normalize && pathApi?.resolve) {
    cleaned = pathApi.normalize(pathApi.resolve(cleaned))
  }

  const fsApi = nodeApi.fs
  if (fsApi?.existsSync && !fsApi.existsSync(cleaned)) return null

  return cleaned || null
}

function removePopover(node?: HTMLElement | null) {
  if (node && node.parentElement) node.parentElement.removeChild(node)
}

function hasIncludedFile(editor: any, filePath: string) {
  const target = normalizePastedPath(filePath)
  if (!target) return false
  let exists = false
  editor.state.doc.descendants((node: any) => {
    if (node.type?.name !== 'fileInclude') return true
    const nodePath = normalizePastedPath(node.attrs?.sourcePath || '')
    if (nodePath && nodePath === target) {
      exists = true
      return false
    }
    return true
  })
  return exists
}

function getDynamicReferenceEditorId(editor: any): string {
  const ext = editor?.extensionManager?.extensions?.find?.((item: any) => item?.name === 'ref')
  return ext?.options?.editorId || 'external'
}

function registerExternalReference(editor: any, filePath: string) {
  const editorId = getDynamicReferenceEditorId(editor)
  const displayName = nodeApi?.path?.basename?.(filePath) || filePath
  const html = `<span>${displayName}</span>`

  _$_wysiwygEditorDynamicReferenceIndexes.update((currentMap) => {
    const next = new Map(currentMap)
    const editorMap = new Map(next.get(editorId) || new Map())
    editorMap.set(filePath, {
      id: filePath,
      text: displayName,
      html,
      display: displayName,
      type: 'external'
    })
    next.set(editorId, editorMap)
    return next
  })
}

function getFilePathFromClipboard(event: ClipboardEvent): string | null {
  const files = event.clipboardData?.files
  if (files && files.length > 0) {
    const file = files[0] as any
    if (file?.path) return file.path
  }

  const items = event.clipboardData?.items
  if (items) {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      if (item.kind === 'file') {
        const file = item.getAsFile() as any
        if (file?.path) return file.path
      }
    }
  }

  const uriList = event.clipboardData?.getData('text/uri-list') || ''
  if (uriList) {
    const firstUri = uriList
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('#'))
    if (firstUri) {
      const normalized = normalizePastedPath(firstUri)
      if (normalized) return normalized
    }
  }

  const nativePaths = window.api?.clipboard?.readFilePaths?.()
  if (nativePaths && nativePaths.length > 0) {
    const normalized = normalizePastedPath(nativePaths[0])
    if (normalized) return normalized
  }

  const text = event.clipboardData?.getData('text/plain') || ''
  return normalizePastedPath(text)
}

export const CustomPasteOptionsExtension = Extension.create({
  name: 'pasteOptions',

  addOptions() {
    return {
      editorId: 'external'
    }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    let activePopover: HTMLElement | null = null
    let removeListeners: (() => void) | null = null

    const closePopover = () => {
      if (removeListeners) {
        removeListeners()
        removeListeners = null
      }
      removePopover(activePopover)
      activePopover = null
    }

    const showPopover = async (coords: { left: number; top: number; bottom: number }, actions: PasteAction[]) => {
      closePopover()

      const container = document.createElement('div')
      container.className = 'paste-options-popover'
      container.style.left = `${coords.left}px`
      container.style.top = `${coords.bottom + 6}px`

      const title = document.createElement('div')
      title.className = 'paste-options-title'
      title.textContent = 'Paste as...'
      container.appendChild(title)

      actions.forEach((action) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'paste-options-button'
        button.innerHTML = `<span class="paste-options-label">${action.label}</span>${
          action.description ? `<span class="paste-options-hint">${action.description}</span>` : ''
        }`
        button.addEventListener('click', () => {
          closePopover()
          action.run()
        })
        container.appendChild(button)
      })

      document.body.appendChild(container)
      activePopover = container

      const virtualEl = {
        getBoundingClientRect: () =>
          ({
            x: coords.left,
            y: coords.top,
            left: coords.left,
            right: coords.left,
            top: coords.top,
            bottom: coords.bottom,
            width: 0,
            height: coords.bottom - coords.top
          } as DOMRect)
      }

      try {
        const position = await computePosition(virtualEl as any, container, {
          placement: 'bottom-start',
          middleware: [offset(6), flip(), shift({ padding: 8 })]
        })
        container.style.left = `${position.x}px`
        container.style.top = `${position.y}px`
      } catch {
        // fallback to initial placement
      }

      const onPointerDown = (event: MouseEvent) => {
        if (!container.contains(event.target as Node)) {
          closePopover()
        }
      }
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          closePopover()
        }
      }

      document.addEventListener('mousedown', onPointerDown)
      document.addEventListener('keydown', onKeyDown)
      removeListeners = () => {
        document.removeEventListener('mousedown', onPointerDown)
        document.removeEventListener('keydown', onKeyDown)
      }
    }

    return [
      new Plugin({
        key: new PluginKey('paste-options'),
        props: {
          handleDOMEvents: {
            paste: (view, event) => {
              const filePath = getFilePathFromClipboard(event as ClipboardEvent)
              if (!filePath) return false

              event.preventDefault()

              const selectionPos = view.state.selection.from
              const insertPos = Math.min(selectionPos, view.state.doc.content.size)
              const fileName = nodeApi?.path?.basename?.(filePath) || filePath
              const fileUrl = toAssetUrl(filePath)

              const actions: PasteAction[] = [
                {
                  id: 'paste-text',
                  label: 'Text',
                  description: 'Paste the path as plain text',
                  run: () => editor.chain().focus().insertContentAt(insertPos, filePath).run()
                },
                {
                  id: 'paste-link',
                  label: 'Link',
                  description: 'Insert a clickable file link',
                  run: () =>
                    editor
                      .chain()
                      .focus()
                      .insertContentAt(insertPos, `<a href="${fileUrl}">${fileName}</a>`)
                      .run()
                },
                {
                  id: 'paste-reference',
                  label: 'Reference',
                  description: 'Insert a dynamic reference chip',
                  run: () => {
                    registerExternalReference(editor, filePath)
                    editor.chain().focus().insertContentAt(insertPos, {
                      type: 'ref',
                      attrs: { src: filePath }
                    }).run()
                  }
                },
                {
                  id: 'include-static',
                  label: 'Include Static',
                  description: 'Paste the current file content',
                  run: async () => {
                    const content = await window.api.readFile(filePath)
                    if (typeof content === 'string') {
                      editor.chain().focus().insertContentAt(insertPos, content).run()
                    }
                  }
                },
                {
                  id: 'include-sync',
                  label: 'Include Sync',
                  description: 'Keep in sync with source file',
                  run: async () => {
                    if (hasIncludedFile(editor, filePath)) {
                      const confirmed = await openConfirmModal({
                        title: 'Include File',
                        message: 'This file is already included. Include it again?',
                        confirmText: 'Include Again'
                      })
                      if (!confirmed) return
                    }
                    editor.commands.insertFileInclude(filePath)
                  }
                },
                {
                  id: 'attach-file',
                  label: 'Attach File Card',
                  description: 'Insert a file preview card',
                  run: async () => {
                    const importedPath = await importFileIntoDocumentAssets(filePath)
                    editor.commands.insertFile(importedPath)
                  }
                },
                {
                  id: 'open-file',
                  label: 'Open File',
                  description: 'Open without inserting',
                  run: () => window.api.openFile(filePath)
                }
              ]

              const coords = view.coordsAtPos(insertPos)
              void showPopover(coords, actions)
              return true
            }
          }
        }
      })
    ]
  }
})
