import { Node, mergeAttributes, InputRule, Editor, nodeInputRule } from '@tiptap/core'
import Suggestion, { exitSuggestion } from '@tiptap/suggestion'
import { computePosition, shift, flip, offset, size } from '@floating-ui/dom'
import { PluginKey, Plugin, Transaction } from 'prosemirror-state'
import { Node as PNode, Fragment, Slice } from 'prosemirror-model'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { nanoid } from 'nanoid'
// import { nodeApi } from '../../../utils/shims/node'
//    import { Fragment, Text } from 'prosemirror-model'

// import AutoComplete from '@tarekraafat/autocomplete.js'

import {
  getVariable,
  setVariable,
  defineVariable,
  onVariableChange,
  listVariables,
  loadAndDefineVariables,
  VariableManipulatorUtils,
  loadAndDefineVariablesOfAllOpenDocumentEditors,
  getVariableType,
  getVariableId
} from './stores/variableManipulator'
import CustomVarExtensionVariableChipWidget from './components/CustomVarExtensionVariableChipWidget.svelte'
import { mount, unmount } from 'svelte'
import Utils from '../../../utils/Utils'
import CustomVarExtensionDropdown from './components/CustomVarExtensionDropdown.svelte'
import { isLinkLikeText, isLinkLikeVariable, type VariableInsertMode } from './utils/utils'
import type { DocumentEditorModel } from '../../../models/Document'
import { CustomVarExtensionProps } from './utils/common.utils'
import { buildVariablePayload } from './utils/variableForm.utils'
import { buildVarDropdownItems } from './utils/variableDropdown.utils'
import { get as getStore } from 'svelte/store'
import { _$_documentEditorsList } from '../../../stores/editor.store'

// Help Typescript to recognize the commands with proper IntelliSense and type-safety.
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    CustomVarExtension: {
      /**
       * Enable or disable review mode.
       * @param enabled - true or false
       * @param author - optional override for the author name
       */
      setReviewMode: (enabled: boolean, author?: string) => ReturnType
      convertSelectionToVariable: (name?: string) => ReturnType
      addVariableAt: (name?: string, value?: string, range?: number) => ReturnType
      // addOrReplaceVariableAt: (name?: string, value?: string, nodePos?: number, cursorPos?: number, insertOnlyInCurrentNode?: boolean, insertMode?: VariableInsertMode) => ReturnType

      addOrReplaceVariableAt: (
        name?: string,
        value?: string,
        nodePos?: number,
        cursorPos?: number,
        insertOnlyInCurrentNode?: boolean,
        insertMode?: VariableInsertMode,
        insertVariable?: boolean,
        documentEditor?: DocumentEditorModel
      ) => ReturnType
    }
  }
}

function posToDOMRect(view: any, from: number, to: number) {
  try {
    const start = view.coordsAtPos(from)
    const end = view.coordsAtPos(to)
    return {
      top: start.top,
      bottom: end.bottom,
      left: start.left,
      right: start.left, // 'right' calculation can be buggy if selection spans lines
      width: 0,
      height: end.bottom - start.top
    }
  } catch (e) {
    return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }
  }
}
async function getMenuPosition(editor, container, range) {
  if (!container || !range) return { x: 0, y: 0 }

  // Use the suggestion range (the '@' char) for the coordinates
  // This is more stable than editor.state.selection
  const virtualEl = {
    getBoundingClientRect: () => {
      const start = editor.view.coordsAtPos(range.from)
      const end = editor.view.coordsAtPos(range.to)
      return {
        top: start.top,
        bottom: end.bottom,
        left: start.left,
        right: end.right,
        width: end.right - start.left,
        height: end.bottom - start.top,
        x: start.left,
        y: start.top
      }
    }
  }

  const { x, y } = await computePosition(virtualEl, container, {
    placement: 'bottom-start',
    strategy: 'fixed', // Better for Electron and modals
    middleware: [
      offset(10), // Gap between cursor and menu
      flip({
        padding: 10,
        fallbackPlacements: ['top-start', 'bottom-end', 'top-end']
      }),
      shift({ padding: 15 })
    ]
  })

  return { x, y }
}

const _hydratedVarDocs = new Set<string>()

async function waitForDocumentEditor(
  editorId: string,
  timeoutMs: number = 4000
): Promise<DocumentEditorModel | null> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const candidate = getStore(_$_documentEditorsList.get(editorId)) as any
    if (candidate?.document) return candidate as DocumentEditorModel
    await new Promise((r) => setTimeout(r, 60))
  }
  return (getStore(_$_documentEditorsList.get(editorId)) as any) || null
}

async function ensureVarsHydrated(editorId: string, editor: Editor): Promise<void> {
  if (!editorId) return
  const docEditor = await waitForDocumentEditor(editorId)
  const docId = (docEditor as any)?.document?.uuid || (docEditor as any)?.uuid || ''
  if (!docId) return
  if (_hydratedVarDocs.has(docId)) return
  _hydratedVarDocs.add(docId)

  try {
    await loadAndDefineVariables(docEditor as any, true)
  } catch (err) {
    try {
      _hydratedVarDocs.delete(docId)
    } catch {}
    console.warn('CustomVarExtension: variable hydration failed', err)
    return
  }

  // Force a transform pass once variables are available (no history pollution).
  try {
    const tr = editor.state.tr.setMeta('forceVarTransform', true).setMeta('addToHistory', false)
    editor.view.dispatch(tr)
  } catch {
    // ignore
  }
}

const defaultOptions = {
  editorId: null,
  maxPageHeight: null,
  maxPageWidth: null
}
// export interface PaginationOptions {
//     maxPageHeight: number
//     maxPageWidth: number
//     wysiwygEditorIdToUpdate: string
// }

let extensionName = CustomVarExtensionProps.name
let extensionTagName = CustomVarExtensionProps.tagName

let extensionTagAttributeName = CustomVarExtensionProps.tagAttributeName
// export let extensionTagAttributeName = VariableManipulatorUtils.VAR_UPDATE_TYPE.name
let extensionTagAttributeValue = CustomVarExtensionProps.tagAttributeValue
let extensionTagAttributeClass = CustomVarExtensionProps.tagAttributeClass
let extensionTagAttributeDataVariable = CustomVarExtensionProps.tagAttributeDataVariable

export const CustomVarExtension = Node.create({
  name: extensionName,
  inline: true,
  group: 'inline',
  atom: true,

  selectable: true, // ✅ allows selection in the editor
  draggable: false, // optional: disable dragging
  isolating: true, // prevent content merging around the node

  addAttributes() {
    return {
      [extensionTagAttributeName]: { default: '' },
      [extensionTagAttributeValue]: { default: '' }
    }
  },
  addOptions() {
    return defaultOptions
  },

  parseHTML() {
    return [{ tag: extensionTagName }]
  },

  /*  renderHTML({ node, HTMLAttributes }) {
         // When getHTML() is called, return only the original string
         // return 
         // node.attrs[extensionTagAttributeName]
         return `{${node.attrs[extensionTagAttributeName]}}`
     }, */

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: extensionTagAttributeClass,
        [extensionTagAttributeDataVariable]: node.attrs[extensionTagAttributeName]
      }),
      `{${node.attrs[extensionTagAttributeName]}}` // text content of the span
    ]
  },

  renderText({ node }) {
    return `{${node.attrs[extensionTagAttributeName]}}`
  },

  /*     addInputRules() {
        return [
            nodeInputRule({
                find: /\{([a-zA-Z0-9_]+)\}$/,
                type: this.type,
                getAttributes: match => ({ [extensionTagAttributeName]: match[1] }),
            }),
        ]
    }, */

  // ── CUSTOM EXPORT HOOK ──────────────────────────────────────────────────
  // This is a custom property outside of Tiptap's native core keys,
  // accessible via the editor's extension manager.
  toStaticHTML(element: HTMLElement) {
    const varName = element.getAttribute(CustomVarExtensionProps.tagAttributeDataVariable) || ''

    // Fetch the current evaluation value safely out of your data registry
    const varValue = getVariable(varName, null) || '#REF!'

    const staticSpan = document.createElement('span')
    staticSpan.className = 'ddoc-print-variable-value'
    // staticSpan.style.fontWeight = '600';
    // staticSpan.style.color = '#111827';
    staticSpan.textContent = String(varValue)

    element.replaceWith(staticSpan)
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      console.log('varrrrrr props ent', { op: this.options })
      // const span = HTMLElement
      const span = document.createElement('span')
      span.className = `${CustomVarExtensionProps.tagAttributeClass} relative z-[2000]`
      // return { dom: span }
      span.dataset[CustomVarExtensionProps.name] = node.attrs[extensionTagAttributeName]
      let currentNode = node
      let currentVarId: string | null = null
      let props = $state({
        name: '',
        rawValue: {},
        value: '',
        type: '',
        __maxPageHeight: 0,
        __maxPageWidth: 0
      })

      props.name = node.attrs[extensionTagAttributeName]
      props.value =
        getVariable(props.name, this.options.editorId) ?? node.attrs[extensionTagAttributeValue]
      props.rawValue = getVariable(props.name, this.options.editorId, false) ?? props.value
      // props.value = getVariable(node.attrs[extensionTagAttributeName], null) ?? node.attrs[extensionTagAttributeValue]
      // props.type = Utils.getVariableType(props.value)
      props.type = getVariableType(props.name, this.options.editorId)
      props.__maxPageHeight = this.options.maxPageHeight
      props.__maxPageWidth = this.options.maxPageWidth
      // props.type = Utils.getVariableType(node.attrs[extensionTagAttributeValue])
      // console.log("varrrrrr props", { props, "op": this.options })
      // Mount Svelte component (Svelte 5)
      const component = mount(CustomVarExtensionVariableChipWidget, {
        target: span,
        props
      })

      const applyProps = (next: Partial<typeof props>) => {
        Object.assign(props, next)
      }

      /** 🔁 Update when variable value changes */
      const resolveVarId = (name: string) => {
        if (!name) return null
        if (Utils.isUuid?.(name)) return name
        return getVariableId(name, this.options.editorId)
      }

      const update = () => {
        const isInvalid = !!currentNode.attrs?.isInvalid
        const val = isInvalid
          ? '#REF!'
          : (getVariable(currentNode.attrs[extensionTagAttributeName], this.options.editorId) ??
            currentNode.attrs[extensionTagAttributeValue])
        // const val = getVariable(currentNode.attrs[extensionTagAttributeName], null) ?? currentNode.attrs[extensionTagAttributeValue]
        const nextName = currentNode.attrs[extensionTagAttributeName]
        currentVarId = resolveVarId(nextName)
        applyProps({
          name: nextName,
          value: val,
          rawValue: getVariable(nextName, this.options.editorId, false) ?? val,
          type: isInvalid
            ? Utils.getVariableType(null)
            : getVariableType(nextName, this.options.editorId),
          __maxPageHeight: this.options.maxPageHeight,
          __maxPageWidth: this.options.maxPageWidth
        })
        span.dataset[CustomVarExtensionProps.name] = String(nextName ?? '')

        // console.log("variable vlaue changed",{props,val})
        /* if (props.type === "object") {

                } */
      }

      update()
      const unsubscribe = onVariableChange((name, value, type) => {
        // return
        const varAttr = extensionTagAttributeName
        const currentName = currentNode.attrs[varAttr]
        const isMatch = name === currentVarId || name === currentName
        // console.log("name onVariableChange", name, currentName, value, type)
        if (type == VariableManipulatorUtils.VAR_UPDATE_TYPE.value) {
          if (isMatch) {
            const nextName = currentName
            const nextValue =
              value ??
              getVariable(nextName, this.options.editorId) ??
              currentNode.attrs[extensionTagAttributeValue]
            const nextRaw = getVariable(nextName, this.options.editorId, false) ?? nextValue
            const nextType =
              getVariableType(nextName, this.options.editorId) ?? Utils.getVariableType(nextValue)
            applyProps({
              name: nextName,
              value: nextValue,
              rawValue: nextRaw,
              type: nextType,
              __maxPageHeight: this.options.maxPageHeight,
              __maxPageWidth: this.options.maxPageWidth
            })
            span.dataset[CustomVarExtensionProps.name] = String(nextName ?? '')
          }
        } // 🗑️ 2️⃣ Variable DELETE update
        else if (type === VariableManipulatorUtils.VAR_UPDATE_TYPE.delete) {
          const invalidValue = '#REF!'
          // if (currentName === invalidValue) {
          if (isMatch) {
            // console.log(`⚠️ onVariableChange Variable "${name}" deleted → updating node view`)

            const pos = getPos()
            const tr = editor.state.tr

            // Option A: mark visually invalid
            // const invalidValue = "#REF!"
            const newAttrs = {
              ...currentNode.attrs,
              [varAttr]: name,
              // [varAttr]: invalidValue,
              isInvalid: true
            }

            // Update node attributes
            tr.setNodeMarkup(pos, undefined, newAttrs)
            editor.view.dispatch(tr)

            // Update DOM
            // span.dataset[CustomVarExtensionProps.name]= invalidValue

            // span.dataset[CustomVarExtensionProps.name]= name
            // span.classList.add("variable-invalid")
            // span.textContent = invalidValue

            applyProps({
              name,
              value: invalidValue,
              type: Utils.getVariableType(null),
              __maxPageHeight: this.options.maxPageHeight,
              __maxPageWidth: this.options.maxPageWidth
            })
            span.dataset[CustomVarExtensionProps.name] = String(name ?? '')
            // console.log(`⚠️ onVariableChange span `, span)
          }
        } else if (type == VariableManipulatorUtils.VAR_UPDATE_TYPE.name) {
          const oldName = name
          const newName = value
          // console.log("name onVariableChange enter oldName ", oldName, "newName ", newName, type, node.attrs)
          if (isMatch) {
            // Update the nodeview display & dataset
            //  node.attrs[extensionTagAttributeName] = newName
            // console.log("name onVariableChange enter span", span)
            span.dataset[CustomVarExtensionProps.name] = newName

            // console.log("name onVariableChange enter span af", span)
            const pos = getPos()
            const tr = editor.state.tr
            tr.setNodeMarkup(pos, undefined, {
              ...currentNode.attrs,
              [extensionTagAttributeName]: newName
            })
            editor.view.dispatch(tr)
            currentNode = editor.state.doc.nodeAt(pos) || currentNode
            currentVarId = resolveVarId(newName)
            // console.log("name onVariableChange enter dis", node.attrs)

            // Optional: update visible text
            const renamedValue = getVariable(newName, this.options.editorId)
            applyProps({
              name: newName,
              value: renamedValue ?? currentNode.attrs[extensionTagAttributeValue],
              rawValue: getVariable(newName, this.options.editorId, false) ?? renamedValue,
              type:
                getVariableType(newName, this.options.editorId) ??
                Utils.getVariableType(renamedValue),
              __maxPageHeight: this.options.maxPageHeight,
              __maxPageWidth: this.options.maxPageWidth
            })
          }
        }
        // if (name ===  node.attrs[extensionTagAttributeName]) update()

        // 🧮 Case 1: Value update
        /* if (typeof info === 'string') {
                    if (info ===  node.attrs[extensionTagAttributeName]) update()
                }

                // 🔁 Case 2: Rename event
                else if (info.type === 'rename') {
                    const { oldName, newName } = info

                    if (oldName ===  node.attrs[extensionTagAttributeName]) {
                        // Update the nodeview display & dataset
                         node.attrs[extensionTagAttributeName] = newName
                        span.dataset[CustomVarExtensionProps.name]= newName

                        // Optional: update visible text
                        update()
                    }
                } */
      })

      return {
        dom: span,
        update: (updatedNode) => {
          if (updatedNode.type !== currentNode.type) return false
          currentNode = updatedNode
          update()
          return true
        },
        destroy: unsubscribe
      }
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-v': () => {
        // 'Mod-v': () => {
        console.log('addKeyboardShortcuts variable')
        //   'Mod-Shift-v': () => {
        this.editor.chain().focus().convertSelectionToVariable().run()
        // this.editor.commands.convertSelectionToVariable().focus()
        return true
      }
    }
  },

  addCommands() {
    return {
      convertSelectionToVariable:
        (name = null, documentEditor: DocumentEditorModel) =>
        ({ state, dispatch }) => {
          const { from, to } = state.selection
          const selectedText = state.doc.textBetween(from, to, ' ')

          if (!selectedText || from === to) return false
          const nodeAtSelection = state.doc.nodeAt(from)

          // ✅ Return true immediately if already a variable node
          const nodeType = state.schema.nodes[extensionName]
          // const nodeType = state.schema.nodes[extensionName]
          if (!nodeType) return false

          if (nodeAtSelection && nodeAtSelection.type === nodeType) {
            // Already a variable → no processing needed
            // 🧩 CASE 1: Selection is already a variable → Unset it
            if (nodeAtSelection && nodeAtSelection.type === nodeType) {
              const variableName = nodeAtSelection.attrs[extensionTagAttributeName]
              const variableValue = nodeAtSelection.attrs[extensionTagAttributeValue]

              // Replace the variable node with its text value
              const tr = state.tr.replaceWith(
                from,
                from + nodeAtSelection.nodeSize,
                state.schema.text(variableValue)
              )
              dispatch(tr.scrollIntoView())

              // Optionally remove it from your store
              // unsetVariable?.(variableName)

              return true
            }
          }

          // If no variable name is provided, default to the selected text
          let variableName = name || selectedText.trim().replace(/\s+/g, '_')
          // Ensure variableName is not the same as selectedText to avoid #CYCLE! error in formula
          if (variableName === selectedText) {
            variableName += `_${nanoid(6)}`
          }
          /* const payload = buildVariablePayload(
                            variableType,
                            value,
                            undefined,
                            //   newVarFormat,
                            //   newVarAutoUpdate
                        ) */
          // Define or update variable value in store
          setVariable(
            variableName,
            {
              type: VariableManipulatorUtils.VAR_TYPE.text,
              value: selectedText.trim(),
              source: 'user'
            },
            documentEditor
          )

          // Replace the selected text with a variable node

          const variableNode = nodeType.create({
            [extensionTagAttributeName]: variableName,
            [extensionTagAttributeValue]: selectedText.trim()
          })

          const tr = state.tr.replaceRangeWith(from, to, variableNode)
          dispatch(tr.scrollIntoView())

          return true
        },

      addVariableAt:
        (name = null, value = null, range = 0) =>
        ({ state, dispatch, editor }) => {
          // 1. Check if name or value is provided
          const hasData = name !== null && value !== null

          if (!hasData) {
            // 2. If no name/value provided, insert the '@' character
            return (
              editor
                .chain()
                .insertContentAt(range, CustomVarExtensionProps.suggestion.char)
                // .insertContentAt(range, '@')
                .run()
            )
          }

          // 3. Otherwise, insert the Variable Node as planned
          return editor
            .chain()
            .insertContentAt(range, {
              type: this.name,
              attrs: { name, value }
            })
            .run()
        },
      addOrReplaceVariableAt:
        (
          name = null,
          value = null,
          nodePos = null,

          cursorPos = null,
          insertOnlyInCurrentNode: boolean = false,
          insertMode: VariableInsertMode = 'append',
          insertVariable?: boolean,
          documentEditor?: DocumentEditorModel
        ) =>
        ({ state, dispatch, editor }) => {
          const variableType = state.schema.nodes[this.name]
          if (!variableType || nodePos == null) return false

          //
          // 2️⃣ Update our variable store
          //
          const payload = buildVariablePayload(
            VariableManipulatorUtils.VAR_TYPE.text,
            // null,
            value
            // undefined,
            //   newVarFormat,
            //   newVarAutoUpdate
          )

          setVariable(name, { ...payload, source: payload?.source || 'user' }, documentEditor)
          // setVariable(name, value, documentEditor);

          if (!insertVariable) return true

          const rootNode = state.doc.nodeAt(nodePos)
          if (!rootNode) return false

          const tr = state.tr

          //
          // 🔍 1. Look for an existing variable node anywhere inside root node
          //
          let foundExistingPos: number | null = null
          let foundExistingNodeSize = 0

          rootNode.descendants((child, relativePos) => {
            if (child.type.name === this.name) {
              foundExistingPos = nodePos + relativePos
              foundExistingNodeSize = child.nodeSize
              return false // stop scanning
            }
            return true
          })

          //
          // 2️⃣ Update our variable store
          //

          // setVariable(name, value, documentEditor);
          setVariable(name, { ...payload, source: payload?.source || 'user' }, documentEditor)

          //
          // 3️⃣ Create new variable node
          //
          const newVarNode = variableType.create({ name, value })

          //
          // 4️⃣ Handle override mode (replace all content of the node)
          //
          if (insertMode === 'override') {
            const start = nodePos + 1
            const end = nodePos + rootNode.nodeSize - 1

            if (start < end) {
              tr.replaceRangeWith(start, end, newVarNode)
            } else {
              tr.insert(start, newVarNode)
            }

            if (dispatch) dispatch(tr)
            return true
          }

          console.log('addOrReplaceVariableAt foundExistingPos', { foundExistingPos })
          //
          // 5️⃣ Replace existing variable node if found
          //
          if (foundExistingPos !== null) {
            tr.replaceWith(foundExistingPos, foundExistingPos + foundExistingNodeSize, newVarNode)

            if (dispatch) dispatch(tr)
            return true
          }
          console.log('addOrReplaceVariableAt foundExistingPosend', { foundExistingPos })

          //
          // 6️⃣ Compute safe cursor range
          //
          const nodeStart = nodePos + 1
          const nodeEnd = nodePos + rootNode.nodeSize
          // const nodeEnd = nodePos + rootNode.nodeSize - 1;

          if (insertOnlyInCurrentNode) {
            if (cursorPos == null || cursorPos < nodeStart || cursorPos > nodeEnd) {
              cursorPos = nodeStart
            }
          } else {
            if (cursorPos == null) cursorPos = nodeStart
          }

          //
          // 7️⃣ Handle prepend / append modes
          //
          if (insertMode === 'prepend') {
            cursorPos = nodeStart
          }

          if (insertMode === 'append') {
            cursorPos = nodeEnd
          }

          //
          // 8️⃣ Default: insert at cursor or fallback at nodeStart
          //
          const insertPos = cursorPos ?? nodeStart

          tr.insert(insertPos, newVarNode)

          if (dispatch) dispatch(tr)
          return true
        }
    }
  },

  addProseMirrorPlugins() {
    // return

    const variablePluginKey = new PluginKey('variable-transform')

    const decorations: any[] = []

    function transformCurlyBraces(
      node: PNode,
      pos: number,
      editor: any,
      tr: any,
      options: any,
      onSuccess?: Function
    ) {
      console.log('loadAndDefineVariables transformCurlyBraces', { node, pos, editor, tr })

      if (node.type.name !== 'text') return

      const text = node.text
      const marks = node.marks // ← ❗ Save existing marks (bold/italic/etc.)
      // Skip transformation for link-like text ONLY if it doesn't contain a variable token
      if (isLinkLikeText(text) && !/\{[^}]+\}/.test(text)) return

      const regex = /\{([^\}]+)\}/g
      const content: any[] = []
      let lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = regex.exec(text)) !== null) {
        const rawName = match[1].trim()
        console.log('loadAndDefineVariables rawName', { rawName })

        // Skip if variable itself looks like a URL, email, file nodeApi.path...
        if (isLinkLikeVariable(rawName)) continue

        // const value = getVariable(rawName) ?? `@${rawName}`
        const value = getVariable(rawName, options.editorId) ?? `@${rawName}`
        // const value = getVariable(rawName, null) ?? `@${rawName}`
        // const type = Utils.getVariableType(value)

        // push text before the variable
        if (match.index > lastIndex) {
          content.push(editor.state.schema.text(text.slice(lastIndex, match.index), marks))
        }

        // push variable node
        const variableNode = editor.state.schema.nodes.variable.create(
          { name: rawName, value },
          undefined,
          marks
        )
        content.push(variableNode)

        lastIndex = match.index + match[0].length
      }

      // push remaining text after last match
      if (lastIndex < text.length) {
        content.push(editor.state.schema.text(text.slice(lastIndex), marks))
      }

      if (content.length > 0) {
        const fragment = Fragment.fromArray(content)

        tr.replaceWith(pos, pos + node.nodeSize, fragment)

        if (onSuccess) onSuccess()
      }
    }

    const applyTransformCurlyBraces = (time: number = 0) => {
      setTimeout(async () => {
        await ensureVarsHydrated(this.options.editorId, this.editor)
        // loadAndDefineVariables(null, this.options.editorId)
        // loadAndDefineVariablesOfAllOpenDocumentEditors()
        const { state, dispatch } = this.editor.view
        // const { state, dispatch } = editorView
        const tr = state.tr
        let nodes = []

        state.doc.descendants((node, pos) => {
          if (node.type.name === 'text') nodes.push({ node, pos })
          // transformCurlyBraces(node, pos, this.editor, tr)
        })

        // Process from last to first
        for (let i = nodes.length - 1; i >= 0; i--) {
          const { node, pos } = nodes[i]
          transformCurlyBraces(node, pos, this.editor, tr, this.options, () => {
            // if (dispatch) dispatch(tr)
          })
        }

        if (tr.docChanged) dispatch(tr)
      }, time || 0)
    }

    const transformCurlyBracesPlugin = new Plugin({
      key: variablePluginKey,
      props: {
        transformPasted: (slice) => {
          applyTransformCurlyBraces(100)
          return slice
          /* const schema = this.editor.schema

                    const result = slice.content
                    // const result = mapNode(slice.content, schema)

                    const fragment = Array.isArray(result)
                        ? Fragment.fromArray(result)
                        : Fragment.from(result)

                    return new Slice(
                        fragment,
                        slice.openStart,
                        slice.openEnd
                    ) */
        }
      },
      appendTransaction: (transactions, _oldState, newState) => {
        const shouldForce = transactions.some((tr) => tr.getMeta('forceVarTransform'))
        if (!shouldForce) return null

        // Hydration is handled in the plugin view/onCreate; keep this safe and non-blocking.
        void ensureVarsHydrated(this.options.editorId, this.editor)
        const tr = newState.tr
        const nodes: { node: PNode; pos: number }[] = []
        newState.doc.descendants((node, pos) => {
          if (node.type.name === 'text') nodes.push({ node, pos })
        })
        for (let i = nodes.length - 1; i >= 0; i--) {
          const { node, pos } = nodes[i]
          transformCurlyBraces(node, pos, this.editor, tr, this.options)
        }
        if (!tr.docChanged) return null
        tr.setMeta('addToHistory', false)
        return tr
      },
      view: (editorView) => {
        // Pro: ensure vars are hydrated even if the inspector panel is never opened.
        void ensureVarsHydrated(this.options.editorId, this.editor)
        applyTransformCurlyBraces()

        return {}
      }
    })

    const suggestionCommand = ({ editor, range, props }) => {
      // console.log("suggestionCommand ", { props })
      if (!props) return
      editor
        .chain()
        .focus()
        .insertContentAt(range, {
          type: this.name,
          attrs: {
            name: props.name,
            value: typeof props.value == 'object' ? props.value.value : props.value
          }
        })
        .run()
    }

    // return [
    let userTriggered = false
    const suggestionPluginKey = new PluginKey('variable-suggestion')

    const suggestionPlugin = Suggestion({
      char: CustomVarExtensionProps.suggestion.char,
      // char: '@',
      editor: this.editor, // pass editor instance
      pluginKey: suggestionPluginKey, // unique plugin key

      items: ({ query }) => {
        return buildVarDropdownItems(listVariables([], this.options.editorId), query)
      },
      /* shouldShow: ({ query, transaction }) => {
                if (!query || query.length === 0) return false
                if (userTriggered) return true
                return transaction?.docChanged === true
            }, */

      command: ({ editor, range, props }) => {
        editor
          .chain()
          .focus()
          .insertContentAt(range, { type: this.name, attrs: { name: props.name } })
          .run()
      },

      render: () => {
        let component: any
        let svelteProps = $state({
          items: [],
          activeIndex: 0,
          query: '',
          position: null,
          selectItem: (item) => {}
        })
        let container: HTMLElement
        let items: any[] = []
        let activeIndex = 0
        let cleanupOutsideHandlers: (() => void) | null = null
        const editor = this.editor

        return {
          onStart: async (props) => {
            userTriggered = true
            items = props.items
            activeIndex = 0

            container = document.createElement('span')
            // container = document.createElement('div')
            document.body.appendChild(container)
            const handlePointerDown = (event: Event) => {
              const target = event.target as Node | null
              if (!target) return
              if (container?.contains(target)) return
              if (editor?.view?.dom?.contains(target)) return
              exitSuggestion(editor.view, suggestionPluginKey)
            }
            const handleWindowBlur = () => exitSuggestion(editor.view, suggestionPluginKey)
            const handleVisibility = () => {
              if (document.visibilityState !== 'visible') {
                exitSuggestion(editor.view, suggestionPluginKey)
              }
            }
            document.addEventListener('pointerdown', handlePointerDown, true)
            window.addEventListener('blur', handleWindowBlur)
            document.addEventListener('visibilitychange', handleVisibility)
            cleanupOutsideHandlers = () => {
              document.removeEventListener('pointerdown', handlePointerDown, true)
              window.removeEventListener('blur', handleWindowBlur)
              document.removeEventListener('visibilitychange', handleVisibility)
            }

            // Create reactive props object
            /* const svelteProps = $state({
                            items,
                            activeIndex,
                            query: props.query,
                            position: await getMenuPosition(editor, container),
                            selectItem: (item) => {
                                suggestionCommand({ editor, range: props.range, props: item })
                            }
                        }) */
            // update reactive props
            svelteProps.items = items
            svelteProps.activeIndex = activeIndex
            svelteProps.query = props.query
            // svelteProps.position = await getMenuPosition(editor, container)
            // svelteProps.position = await getMenuPosition(editor, container)
            svelteProps.selectItem = (item) => {
              suggestionCommand({ editor, range: props.range, props: item })
            }

            component = mount(CustomVarExtensionDropdown, {
              target: container,
              props: svelteProps
            })
            // WAIT for Svelte to paint, then calculate position
            requestAnimationFrame(async () => {
              const pos = await getMenuPosition(editor, container.firstElementChild, props.range)
              svelteProps.position = pos
            })
          },

          onUpdate: async (props) => {
            console.log('onUpdate')
            items = props.items
            activeIndex = Math.min(activeIndex, items.length - 1)
            // update reactive props
            svelteProps.items = items
            svelteProps.activeIndex = activeIndex
            svelteProps.query = props.query
            // svelteProps.position = await getMenuPosition(editor, container)
            svelteProps.selectItem = (item) => {
              suggestionCommand({ editor, range: props.range, props: item })
            }
            // )
            // Recalculate on every keystroke/update
            const pos = await getMenuPosition(editor, container.firstElementChild, props.range)
            svelteProps.position = pos
          },

          onKeyDown: (props) => {
            if (props.event.key === 'ArrowDown') {
              activeIndex = (activeIndex + 1) % items.length
              // component.$set({ activeIndex })
              svelteProps.activeIndex = activeIndex
              return true
            }
            if (props.event.key === 'ArrowUp') {
              activeIndex = (activeIndex - 1 + items.length) % items.length
              // component.$set({ activeIndex })
              svelteProps.activeIndex = activeIndex
              return true
            }
            if (props.event.key === 'Enter') {
              const item = items[activeIndex]
              suggestionCommand({ editor, range: props.range, props: item })
              return true
            }
            return false
          },

          onExit: () => {
            // component?.$destroy()
            if (component) unmount(component)
            container?.remove()
            cleanupOutsideHandlers?.()
            cleanupOutsideHandlers = null
            userTriggered = false
          }
        }
      }
    })
    // ];

    // return [ transformCurlyBracesPlugin];
    // return [suggestionPlugin];
    return [transformCurlyBracesPlugin, suggestionPlugin]
  }
})

// ── EXPORT/IMPORT UTILITIES ──────────────────────────────────────────────────

export function exportEditableHtml(editor: Editor): string {
  const html = editor.getHTML()
  const container = document.createElement('div')
  container.innerHTML = html

  container.querySelectorAll(`[${extensionTagAttributeDataVariable}]`).forEach((el) => {
    const varName = el.getAttribute(extensionTagAttributeDataVariable)
    el.replaceWith(document.createTextNode(`{${varName}}`))
  })

  return container.innerHTML
}

export function reinflateVariableTokens(html: string): string {
  return html.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, varName) => {
    return `<span ${extensionTagAttributeDataVariable}="${varName}" class="${extensionTagAttributeClass}">{${varName}}</span>`
  })
}
