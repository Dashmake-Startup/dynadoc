<script lang="ts">
  import { _ } from 'svelte-i18n'
  import * as Y from 'yjs'
  import { onMount, onDestroy } from 'svelte'
  import { Editor } from '@tiptap/core'
  import Collaboration from '@tiptap/extension-collaboration'
  import CollaborationCaret from '@tiptap/extension-collaboration-caret'
  import EditorExtensionHelpers from '../../../../../utils/EditorExtensionHelpers'
  import { CustomAnimationExtension } from '../../../../../extensions/tiptap/CustomAnimationExtension/CustomAnimationExtension'
  import { _$_wysiwygEditorsList } from '../../../../../stores/editor.store'
  import { _$_canvasCommands } from '../../../../../stores/canvas.store'
  import type { Shape } from '../../../../../utils/canvas.utils'
  import type { CanvasCommands } from '../../../../../commands/canvasCommands'

  let {
    __canvaId,
    __canvaPath,
    __shape,
    __yText,
    __provider,
    __awareness,
    __onSelect,
    __syncTick
  }: {
    __canvaId: any
    __canvaPath: any
    __shape: Shape
    __yText: Y.XmlFragment
    __provider: any
    __awareness: any
    __onSelect: any
    __syncTick: number
  } = $props()

  let editorEl: HTMLDivElement
  let editor: Editor
  let slideCommands: CanvasCommands | null = null
  let unsubscribe: () => void

  /* ------------------------------
   * Positioning
   * ------------------------------ */

  let lastX = 0
  let lastY = 0
  let lastW = 0
  let lastH = 0

  $effect(() => {
    if (__syncTick) {
      if (__shape.x !== lastX || __shape.y !== lastY || __shape.w !== lastW || __shape.h !== lastH) {
        syncPosition()
        lastX = __shape.x
        lastY = __shape.y
        lastW = __shape.w
        lastH = __shape.h
      }
    }
  })

  function syncPosition() {
    // console.log('syncPosition')
    if (!editorEl || !__shape) return

    /* 
    
    let rawWidth = Math.max(rect.width, 30)
    let recalculatedWidth = rawWidth * 0.9
    let rawHeight = Math.max(rect.height, 20)
    let recalculatedHeight = rawHeight * 0.9
    // __shape.x = _editorEl.style.left = `${rect.x + (rawWidth - recalculatedWidth) / 2}px`
    _editorEl.style.left = `${rect.x + (rawWidth - recalculatedWidth) / 2}px`
    _editorEl.style.top = `${rect.y + (rawHeight - recalculatedHeight) / 2}px`
    // _editorEl.style.top = `${rect.y}px`
    _editorEl.style.width = `${recalculatedWidth}px`
    _editorEl.style.height = `${recalculatedHeight}px`
    */

    editorEl.style.left = `${__shape.x}px`
    editorEl.style.top = `${__shape.y}px`
    editorEl.style.width = `${Math.max(__shape.w, 30)}px`
    editorEl.style.height = `${Math.max(__shape.h, 20)}px`
  }

  // $: syncPosition()

  /* ------------------------------
   * Editing mode
   * ------------------------------ */

  function enterEditMode() {
    _$_wysiwygEditorsList.setActive(__shape.id)
    editor.setEditable(true)
    editor.commands.focus()
  }

  function exitEditMode() {
    editor.setEditable(false)
  }

  /* ------------------------------
   * Pointer handling
   * ------------------------------ */

  function onDblClick(e: PointerEvent) {
    // __onSelect?.(__shape.id, e)
    enterEditMode()
  }

  /* ------------------------------
   * Pointer handling
   * ------------------------------ */

  function onPointerDown(e: PointerEvent) {
    __onSelect?.(__shape.id, e)
    // enterEditMode()
  }

  /* ------------------------------
   * Lifecycle
   * ------------------------------ */

  onMount(() => {
    syncPosition()
    unsubscribe = _$_canvasCommands
      .subscribeById(__canvaId)
      .subscribe((cmds) => (slideCommands = cmds))

    editor = new Editor({
      element: editorEl,
      editable: false,
      extensions: [
        ...EditorExtensionHelpers.getMainWysiwygExtensions(
          editorEl,
          null,
          __shape.content?.placeholder
        ),

        CustomAnimationExtension,

        Collaboration.configure({
          fragment: __yText
        }),

        CollaborationCaret.configure({
          provider: __provider,
          user: EditorExtensionHelpers.getMainWysiwygCollaborationExtensionCurrentUser(),
          render: (user) => {
            const wrapper = document.createElement('span')
            wrapper.className = 'collaboration-carets'

            const caret = document.createElement('span')
            caret.className = 'collaboration-carets__caret'
            caret.style.borderColor = user.color

            const label = document.createElement('div')
            label.className = 'collaboration-carets__label'
            label.style.backgroundColor = user.color
            label.textContent = user.name

            wrapper.append(caret, label)
            return wrapper
          }
        })
      ]
    })

    _$_wysiwygEditorsList.register(__shape.id, editor, '', editorEl, null, null, false)

    editorEl.addEventListener('pointerdown', onPointerDown)
    editorEl.addEventListener('dblclick', onDblClick)
  })

  onDestroy(() => {
    editor?.destroy()
    unsubscribe?.()
    _$_wysiwygEditorsList.unregister?.(__shape.id)
  })
</script>

<div bind:this={editorEl} class="skia-text" class:!hidden={!__shape.visible}></div>

<style>
  .skia-text {
    position: absolute;
    pointer-events: auto;
    outline: none;
  }
</style>
