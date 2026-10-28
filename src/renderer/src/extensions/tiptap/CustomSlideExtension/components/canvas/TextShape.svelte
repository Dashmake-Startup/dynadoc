<script lang="ts">
  import { _ } from 'svelte-i18n'
  import * as Y from 'yjs'

  import { onDestroy, onMount } from 'svelte'
  import Konva from 'konva'
  import { Editor } from '@tiptap/core'
  import { gsap } from 'gsap'
  import StarterKit from '@tiptap/starter-kit'
  import Collaboration from '@tiptap/extension-collaboration'
  import { _$_wysiwygEditorsList } from '../../../../../stores/editor.store'
  import EditorHelpers from '../../../../../utils/EditorHelpers'
  import CollaborationCaret from '@tiptap/extension-collaboration-caret'
  import EditorExtensionHelpers from '../../../../../utils/EditorExtensionHelpers'
  import { CustomAnimationExtension } from '../../../CustomAnimationExtension/CustomAnimationExtension'
  import { smartSnapping } from '../../../../konva/snapping'
  import type { CanvasCommands } from '../../../../../commands/canvasCommands.types'
  import { _$_canvasCommands } from '../../../../../stores/canvas.store'
  import type { Shape } from '../../../../../utils/canvas.types'
  import { GenericFormatingEditorCommands } from '../../../../../components/common/actions/formatting/commands/GenericFormatingEditorCommands.svelte'
  //   import CollaborationCursor from '@tiptap/extension-collaboration-cursor'

  // 1. Handle Props using $props()
  let { 
    __slideId, 
    __slidePath, 
    __stage, 
    __shape, 
    __layer, 
    __yText, 
    __nodeMap, 
    __provider, 
    __awareness, 
    __onSelect 
  } = $props();

  // 2. State variables
  let _editorEl = $state();
  let _editor: Editor = $state();
  let _group: Konva.Group = $state();
  let _rect: Konva.Rect = $state();
  let _transformer: Konva.Transformer | null = $state(null);
  let _onNodeClick: (() => void) | null = $state(null);
  let _onTransform: (() => void) | null = $state(null);
  let _isEditing = $state(false);
  const DRAG_BORDER_SIZE = 6;
  let _duplicateDrag: { id: string; originX: number; originY: number } | null = null;
  let _transformStartRotation = 0;
  let _autoResizeRaf = 0;
  let _lastAnimationKey = '';
  let _pendingDrag: {
    startX: number;
    startY: number;
    startTime: number;
    timeoutId: number | null;
    isBorder: boolean;
  } | null = null;

  let slideCommands: CanvasCommands | null = $state(null);
  let _animationArmed = false;

  function runAnimation() {
    if (!_group || !__shape?.animation) return
    const key = JSON.stringify(__shape.animation)
    if (key === _lastAnimationKey) return
    _lastAnimationKey = key

    const anim = __shape.animation || {}
    const type = String(anim.type || 'fade').toLowerCase()
    const duration = Math.max(0.1, Number(anim.duration ?? 0.5))
    const delay = Math.max(0, Number(anim.delay ?? 0))
    const start = String(anim.start || 'with-previous')

    const target = _group
    gsap.killTweensOf(target)

    const play = () => {
      if (type.includes('zoom')) {
        gsap.fromTo(target, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration, delay })
      } else if (type.includes('fly') || type.includes('slide') || type.includes('push')) {
        gsap.from(target, { x: target.x() - 80, opacity: 0, duration, delay, ease: 'power2.out' })
      } else {
        gsap.fromTo(target, { opacity: 0 }, { opacity: 1, duration, delay })
      }
    }

    if (start === 'on-click') {
      if (_animationArmed) return
      _animationArmed = true
      const handler = () => {
        _animationArmed = false
        play()
        _group?.off('click', handler)
      }
      _group.on('click', handler)
      return
    }

    play()
  }

  // 3. Replace $: with $effect
  // This effect handles the Konva group/rect updates whenever props change
  $effect(() => {
    if (_group && _rect && __shape) {
      _group.position({ x: __shape.x, y: __shape.y });
      _group.rotation(__shape.rotation || 0);
      _rect.size({ width: __shape.w, height: __shape.h });
      _rect.rotation(0);
      _group.zIndex(__shape.z ?? 0);

      __layer.batchDraw();
      syncEditorPosition();
    }
  });

  // 4. Separate effect for selection logic
  $effect(() => {
    if (_rect && __shape) {
      if (__shape.selected) {
        showTransformer();
      } else {
        hideTransformer();
      }
    }
  });

  $effect(() => {
    if (!__shape?.animation) return
    runAnimation()
  });

  // export let __slideId
  // export let __slidePath
  // export let __stage: Konva.Stage
  // export let __shape: Shape
  // export let __layer: Konva.Layer
  // export let __yText: Y.XmlFragment
  // export let __nodeMap: Map<string, Konva.Node>
  // export let __provider
  // export let __awareness
  // export let __onSelect

  // let _editorEl
  // let _editor: Editor
  // //   let _group
  // let _group: Konva.Group
  // let _rect: Konva.Rect
  // let _transformer: Konva.Transformer | null = null
  // let _onNodeClick: (() => void) | null = null
  // let _onTransform: (() => void) | null = null
  // let _isEditing = $state(false)

  //   $: syncEditorPosition()

  /* $: if (_group && _rect && __shape) {
    // Update group position
    _group.position({ x: __shape.x, y: __shape.y })

    // Update rect size
    _rect.size({ width: __shape.w, height: __shape.h })
    _rect.rotation(__shape.rotation || 0)
    _group.zIndex(__shape.z ?? 0)

    // Redraw layer
    __layer.batchDraw()

    // Sync editor div
    syncEditorPosition()
  }

  $: if (_rect && __shape) {
    if (__shape.selected) {
      showTransformer()
    } else {
      hideTransformer()
    }
  }

  let slideCommands: CanvasCommands | null = null
 */
  let unsubscribe: () => void

  function selectNode(node) {}

  function setupNode1(node) {
    // Add a transformer when a node is clicked
    node.on('click tap', () => {
      // Remove old transformer
      const existingTr = __layer.findOne('Transformer')
      existingTr?.destroy()

      const tr = new Konva.Transformer({
        // Allow all anchors (resize width & height)
        enabledAnchors: [
          'top-left',
          'top-center',
          'top-right',
          'middle-left',
          'middle-right',
          'bottom-left',
          'bottom-center',
          'bottom-right'
        ],
        // Set bounds for resizing
        /* boundBoxFunc: (oldBox, newBox) => {
          if (newBox.width < 10 || newBox.height < 10) {
            return oldBox
          }
          return newBox
        } */
        boundBoxFunc: (oldBox, newBox) => {
          // Enforce minimum width & height
          if (newBox.width < 30) newBox.width = 30
          if (newBox.height < 20) newBox.height = 20
          return newBox
        }
      })

      __layer.add(tr)
      tr.nodes([node])

      // Listen for transform event
      tr.on('transform', () => {
        // Only update the width and height of the text box
        // Do NOT scale the text itself
        node.width(node.width() * node.scaleX())
        node.height(node.height() * node.scaleY())

        // Reset scales to keep text size constant
        node.scaleX(1)
        node.scaleY(1)

        __layer.batchDraw()
      })

      __layer.batchDraw()
    })

    // Removed the stage.on('click tap', ...) listener from here (moved to onMount)
  }

  function unsetupNode(node: Konva.Node) {
    // 1️⃣ Remove node listeners
    if (_onNodeClick) {
      node.off('click tap', _onNodeClick)
      _onNodeClick = null
    }

    // 2️⃣ Remove transformer listeners
    if (_transformer && _onTransform) {
      _transformer.off('transform', _onTransform)
      _onTransform = null
    }

    // 3️⃣ Destroy transformer
    if (_transformer) {
      _transformer.destroy()
      _transformer = null
    }

    // 4️⃣ Optional: destroy the node itself

    node.destroy()

    __layer?.batchDraw()
  }

  function showTransformer(node?: Konva.Node) {
    if (_transformer) return

    _transformer = new Konva.Transformer({
      enabledAnchors: [
        'top-left',
        'top-center',
        'top-right',
        'middle-left',
        'middle-right',
        'bottom-left',
        'bottom-center',
        'bottom-right'
      ],
      rotateEnabled: true,
      rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
      rotationSnapTolerance: 5,
      boundBoxFunc: (oldBox, newBox) => {
        if (newBox.width < 30) newBox.width = 30
        if (newBox.height < 20) newBox.height = 20
        return newBox
      }
    })

    __layer.add(_transformer)
    _transformer.nodes([node || _group])
    __layer.batchDraw()
  }

  function hideTransformer() {
    if (!_transformer) return
    _transformer.destroy()
    _transformer = null
    __layer.batchDraw()
  }

  function setupNode(node: Konva.Node) {
    _onNodeClick = () => {
      // Remove old transformer (global)
      //   const existingTr = __layer.findOne('Transformer')
      //   existingTr?.destroy()

      /*  _transformer = new Konva.Transformer({
        enabledAnchors: [
          'top-left',
          'top-center',
          'top-right',
          'middle-left',
          'middle-right',
          'bottom-left',
          'bottom-center',
          'bottom-right'
        ],
        boundBoxFunc: (oldBox, newBox) => {
          if (newBox.width < 30) newBox.width = 30
          if (newBox.height < 20) newBox.height = 20
          return newBox
        }
      }) */

      //   __layer.add(_transformer)
      //   _transformer.nodes([node])

      showTransformer()
      //   __layer.batchDraw()
    }

    node.on('click tap', _onNodeClick)
  }

  function syncEditorPosition11() {
    // function syncEditorPosition(block: SlideBlock) {
    // const { _group, _editorEl } = block

    // Get full absolute transform (includes scale, parent transforms, etc.)
    const transform = _group.getAbsoluteTransform().copy()

    // Top-left corner in stage space
    const topLeft = transform.point({ x: 0, y: 0 })

    const scaleX = transform.getMatrix()[0]
    const scaleY = transform.getMatrix()[3]

    _editorEl.style.left = `${topLeft.x}px`
    _editorEl.style.top = `${topLeft.y}px`
    _editorEl.style.width = `${_group.width() * scaleX}px`
    _editorEl.style.height = `${_group.height() * scaleY}px`
  }

  function syncEditorPosition2() {
    const transform = _group.getAbsoluteTransform().copy()
    const topLeft = transform.point({ x: 0, y: 0 })
    const scaleX = transform.getMatrix()[0]
    const scaleY = transform.getMatrix()[3]

    _editorEl.style.left = `${topLeft.x}px`
    _editorEl.style.top = `${topLeft.y}px`
    _editorEl.style.width = `${_group.width() * scaleX}px`
    _editorEl.style.height = `${_group.height() * scaleY}px`
  }

  function syncEditorPosition22() {
    const rect = _group.getClientRect({ relativeTo: __layer })
    _editorEl.style.left = `${rect.x}px`
    _editorEl.style.top = `${rect.y}px`
    _editorEl.style.width = `${Math.max(rect.width, 30)}px`
    _editorEl.style.height = `${Math.max(rect.height, 20)}px`
  }

  function syncEditorPositionGemin() {
    const stage = __layer.getStage()
    const container = stage.container()

    // 1. Get the shape position relative to the Stage
    const rect = _group.getClientRect({ relativeTo: stage })

    // 2. Get the Stage's actual position on the page
    const stageRect = container.getBoundingClientRect()

    // 3. If your .text div is relative to the BODY,
    // you must add the stage's offset to the rect's local position.
    // Note: Only use this if Solution 1 isn't possible.
    _editorEl.style.left = `${stageRect.left + rect.x}px`
    _editorEl.style.top = `${stageRect.top + rect.y}px`

    _editorEl.style.width = `${Math.max(rect.width, 30)}px`
    _editorEl.style.height = `${Math.max(rect.height, 20)}px`
  }

  function syncEditorPosition(updateCommand: boolean = false) {
    const transform = _group.getAbsoluteTransform().copy()
    const topLeft = transform.point({ x: 0, y: 0 })
    const rawWidth = Math.max(_rect.width(), 30)
    const rawHeight = Math.max(_rect.height(), 20)
    const inset = 6

    _editorEl.style.left = `${topLeft.x + inset}px`
    _editorEl.style.top = `${topLeft.y + inset}px`
    _editorEl.style.width = `${Math.max(rawWidth - inset * 2, 20)}px`
    _editorEl.style.height = `${Math.max(rawHeight - inset * 2, 20)}px`
    _editorEl.style.transform = `rotate(${_group.rotation() || 0}deg)`
    _editorEl.style.transformOrigin = 'top left'
    if (updateCommand) {
      slideCommands?.updateShape(__shape.id, {
        x: _group.x(),
        y: _group.y(),
        w: _rect.width(),
        h: _rect.height()
      })
    }
  }

  function wireBlockInteractions() {
    //   function wireBlockInteractions(block: SlideBlock) {
    // const { _group, editor, _editorEl } = block

    /* _group.on('dragmove', () => {
      __shape.x = _group.x()
      __shape.y = _group.y()
      slideCommands.updateShape(__shape.id, { x: _group.x(), y: _group.y() })
      //   slideCommands.updateShape(block.id, {x: rect.x(), y: rect.y()})
    }) */

    // Konva group click
    _rect.on('click tap', (e) => {
      __onSelect?.(__shape.id, e.evt)
      GenericFormatingEditorCommands.applySlideFormatPainterIfArmed?.()
      if (!isBorderHit()) {
        enterEditMode()
        const clientX = e?.evt?.clientX
        const clientY = e?.evt?.clientY
        if (typeof clientX === 'number' && typeof clientY === 'number') {
          requestAnimationFrame(() => {
            const down = new MouseEvent('mousedown', { clientX, clientY, bubbles: true })
            const up = new MouseEvent('mouseup', { clientX, clientY, bubbles: true })
            _editorEl?.dispatchEvent(down)
            _editorEl?.dispatchEvent(up)
          })
        }
      }
    })

    // _rect.on('pointerdown', (e) => {
    //   __onSelect?.(__shape.id, e.evt)
    // })

    _group.on('click tap', (e) => {
      __onSelect?.(__shape.id, e.evt)
      GenericFormatingEditorCommands.applySlideFormatPainterIfArmed?.()
    })

    _group.on('contextmenu', (e) => {
      e.evt.preventDefault()
      __onSelect?.(__shape.id, e.evt)
      window.api?.showContextMenu?.([
        { label: 'Edit Text', click: () => enterEditMode() },
        { type: 'separator' },
        { label: 'Bring Forward', click: () => slideCommands?.bringForward() },
        { label: 'Send Backward', click: () => slideCommands?.sendBackward() },
        { type: 'separator' },
        { label: 'Delete', click: () => slideCommands?.deleteSelected() }
      ])
    })
    _editorEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      enterEditMode()
    })

    // 🖱 Drag
    /* _rect.on('dragmove', () => {
      __shape.x = _rect.x()
      __shape.y = _rect.y()
      //   slideCommands.updateShape(__shape.id, { x: _rect.x(), y: _rect.y() })

      syncEditorPosition(true)
    }) */
    _group.on('dragmove', () => {
      if (_isEditing) return
      if (_duplicateDrag) {
        const dx = _group.x() - _duplicateDrag.originX
        const dy = _group.y() - _duplicateDrag.originY
        slideCommands?.updateShape(_duplicateDrag.id, {
          x: _duplicateDrag.originX + dx,
          y: _duplicateDrag.originY + dy
        })
        _group.position({ x: _duplicateDrag.originX, y: _duplicateDrag.originY })
        syncEditorPosition(false)
        return
      }
      __shape.x = _group.x()
      __shape.y = _group.y()
      syncEditorPosition(true)
    })
    _group.on('dragend', () => {
      _duplicateDrag = null
      _group.draggable(false)
      syncEditorPosition(true)
    })

    // 📐 Resize
    _group.on('transformstart', () => {
      _transformStartRotation = __shape.rotation || 0
    })
    _group.on('transform', () => {
      syncEditorPosition(true)
    })
    _group.on('transformend', () => {
      const nextW = _rect.width() * _group.scaleX()
      const nextH = _rect.height() * _group.scaleY()
      const nextRotation = _group.rotation()
      const deltaRotation = nextRotation - _transformStartRotation
      const selectedIds = slideCommands?.getSelectedIds?.() ?? []

      slideCommands?.updateShape(__shape.id, {
        x: _group.x(),
        y: _group.y(),
        w: nextW,
        h: nextH
      })

      if (selectedIds.length > 1 && Math.abs(deltaRotation) > 0.01) {
        const pivot = {
          x: _group.x() + nextW / 2,
          y: _group.y() + nextH / 2
        }
        slideCommands?.rotateSelected(deltaRotation, pivot)
      } else {
        slideCommands?.updateShape(__shape.id, {
          rotation: nextRotation
        })
      }

      _rect.width(nextW)
      _rect.height(nextH)
      _group.scaleX(1)
      _group.scaleY(1)
      syncEditorPosition()
    })
    /* _group.on('transformend', () => {
      //   block.width *= _group.scaleX()
      //   _group.scaleX(1)
      //   syncEditorPosition(true)
    }) */

    // ✏️ Edit
    _group.on('dblclick dbltap', () => {
      enterEditMode()
    })

    // ❌ Exit on blur / scroll / escape
    _editorEl.addEventListener('keydown', (e) => {
      //   if (e.key === 'Escape') exitEditMode()
    })

    _editorEl.addEventListener('focusout', () => {
      exitEditMode()
    })
    const container = __layer.getStage().container()
    container.tabIndex = 1 // IMPORTANT: makes div focusable

    container.addEventListener('keydown', (e) => {
      console.log('container keydown', { e })
      // 🚫 Ignore if a WYSIWYG editor is active
      if (_editor?.isFocused) return

      if (slideCommands.getSelectedIds().length) {
        // e.preventDefault()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') slideCommands?.deleteSelected()
    })

    // _group.on('keydown', )
  }

  function isBorderHit(): boolean {
    const pointer = __stage.getPointerPosition()
    if (!pointer) return false
    const local = _group.getAbsoluteTransform().copy().invert().point(pointer)
    const w = _rect.width()
    const h = _rect.height()
    return (
      local.x <= DRAG_BORDER_SIZE ||
      local.y <= DRAG_BORDER_SIZE ||
      w - local.x <= DRAG_BORDER_SIZE ||
      h - local.y <= DRAG_BORDER_SIZE
    )
  }

  function scheduleAutoResize() {
    if (_autoResizeRaf) cancelAnimationFrame(_autoResizeRaf)
    _autoResizeRaf = requestAnimationFrame(() => {
      _autoResizeRaf = 0
      if (!slideCommands?.isAutoResizeEnabled?.()) return
      const content = _editorEl?.querySelector?.('.ProseMirror') as HTMLElement
      if (!content) return
      const inset = 6
      const targetHeight = Math.max(content.scrollHeight + inset * 2, 20)
      const targetWidth = Math.max(content.scrollWidth + inset * 2, 60)
      if (Math.abs(targetHeight - __shape.h) > 1 || Math.abs(targetWidth - __shape.w) > 1) {
        slideCommands?.updateShape(__shape.id, {
          w: targetWidth,
          h: targetHeight
        })
      }
    })
  }

  function enterEditMode() {
    // 1. EXIT EARLY if the editor is already in edit mode
    if (_editor.isEditable) {
      return
    }
    //   function enterEditMode(block: SlideBlock) {
    // if (block.editing) return
    // block.editing = true
    console.log("Entering edit mode..."); // For debugging

    showTransformer()
    _isEditing = true
    _group.draggable(false)
    _editorEl.style.pointerEvents = 'auto'
    // slideCommands.select(__shape.id)
    // _rect.fire('click')
    // __onSelect?.()

    _$_wysiwygEditorsList.setActive(__shape.id)
    _editor.setEditable(true)
    _editor.commands.focus()
    ensureContentSelection()
  }

  function exitEditMode() {
    // if (!block.editing) return
    // block.editing = false

    // 🔥 SAVE FULL RICH TEXT HERE
    // const pmJson =_editor.getJSON()
    // persist pmJson to your document model
    // _editorEl.style.pointerEvents = 'none'
    // hideTransformer()
    // _$_wysiwygEditorsList.unsetActive(__shape.id)
    _isEditing = false
    _group.draggable(false)
    _editorEl.style.pointerEvents = 'auto'
    _editor.setEditable(false)
  }

  function ensureContentSelection() {
    if (__shape?.content?.type !== 'content') return
    if (!_editor) return
    if (_editor.state.selection.empty) {
      _editor.commands.focus('end')
    }
  }

  onMount(() => {
    console.log('yTextyText ', { yText: __yText })
    unsubscribe = _$_canvasCommands.subscribeById(__slideId).subscribe((value) => {
      // unsubscribe = _$_canvasCommands.subscribe((value) => {
      slideCommands = value
    })

    _group = new Konva.Group({
      x: __shape.x,
      y: __shape.y,
      draggable: false,
      name: 'object'
    })

    _rect = new Konva.Rect({
      width: __shape.w,
      height: __shape.h,
      name: 'object',
      // stroke: '#ccc'
      // 1. Color
      stroke: '#ccc',

      // 2. Width (Thickness)
      strokeWidth: 1,

      // 3. Style (Dashed)
      // [dash length, gap length]
      dash: [2, 2],

      // 4. Corners (Optional)
      // 'miter', 'round', or 'bevel'
      lineJoin: 'round',
      lineCap: 'round', // Makes the tiny dash look like a circle

      // 5. Opacity of the stroke
      strokeAlpha: 0.5
    })
    setupNode(_rect)

    __stage.on('pointerdown', (e) => {
      if (e.target === __stage) {
        // const cmds = get(_$_canvasCommands)
        // cmds?.unselect()
        hideTransformer()
        slideCommands?.unselect()
        // exitEditMode()
      }
    })

    _rect.on('mousedown touchstart', (e) => {
      const isBorder = isBorderHit()
      const shiftKey = Boolean(e?.evt?.shiftKey)
      __onSelect?.(__shape.id, e?.evt)
      if (!isBorder) return

      const stagePointer = __stage.getPointerPosition()
      const startX = stagePointer?.x ?? 0
      const startY = stagePointer?.y ?? 0

      if (shiftKey && isBorder) {
        const newId = slideCommands?.duplicateShape?.(__shape.id, { offsetX: 20, offsetY: 20 })
        if (newId) {
          _duplicateDrag = { id: newId, originX: __shape.x, originY: __shape.y }
        }
      }
      _group.draggable(false)
      if (_pendingDrag?.timeoutId) {
        clearTimeout(_pendingDrag.timeoutId)
      }
      const timeoutId = window.setTimeout(() => {
        if (_pendingDrag && _pendingDrag.isBorder) {
          _group.draggable(true)
          _group.startDrag()
        }
      }, 140)

      _pendingDrag = {
        startX,
        startY,
        startTime: Date.now(),
        timeoutId,
        isBorder: true
      }
    })
    _rect.on('mousemove', () => {
      const cursor = isBorderHit() ? 'move' : 'text'
      __stage.container().style.cursor = cursor
    })
    _rect.on('mouseleave', () => {
      __stage.container().style.cursor = 'default'
    })

    __stage.on('mousemove touchmove', () => {
      if (!_pendingDrag || !_pendingDrag.isBorder) return
      const pointer = __stage.getPointerPosition()
      if (!pointer) return
      const dx = pointer.x - _pendingDrag.startX
      const dy = pointer.y - _pendingDrag.startY
      const distance = Math.hypot(dx, dy)
      if (distance > 4) {
        _group.draggable(true)
        _group.startDrag()
      }
    })

    __stage.on('mouseup touchend', () => {
      if (_pendingDrag?.timeoutId) {
        clearTimeout(_pendingDrag.timeoutId)
      }
      _pendingDrag = null
    })

    // __nodeMap.set(__shape.id, _group)
    // __nodeMap.set(__shape.id, _group)

    _group.add(_rect)
    __layer.add(_group)
    __layer.draw()

    // Add smart snapping
    // smartSnapping(__stage, __layer)

    const extensions = [
      ...EditorExtensionHelpers.getMainWysiwygExtensions(
        _editorEl,
        null,
        __shape.content?.placeholder
      ),
      CustomAnimationExtension
    ]

    if (__yText) {
      extensions.push(
        Collaboration.configure({
          fragment: __yText
        })
      )
    }

    if (__provider?.awareness) {
      extensions.push(
        CollaborationCaret.configure({
          provider: __provider,
          user: EditorExtensionHelpers.getMainWysiwygCollaborationExtensionCurrentUser(),
          render: (user) => {
            const wrapper = document.createElement('span')
            wrapper.classList.add('collaboration-carets')

            const caret = document.createElement('span')
            caret.classList.add('collaboration-carets__caret')
            caret.style.borderColor = user.color

            const label = document.createElement('div')
            label.classList.add('collaboration-carets__label')
            label.style.backgroundColor = user.color
            label.textContent = user.name

            wrapper.appendChild(caret)
            wrapper.appendChild(label)

            return wrapper
          }
        })
      )
    }

    _editor = new Editor({
      element: _editorEl,
      /* content:
        __shape.content?.type === 'title'
          ? { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 } }] }
          : undefined, */
      extensions
    })
    _editor.on('focus', () => {
      ensureContentSelection()
    })
    _editor.on('update', () => {
      scheduleAutoResize()
    })

    _editor.setEditable(false)
    _editorEl.style.pointerEvents = 'auto'
    syncEditorPosition(true)

    wireBlockInteractions()

    __nodeMap.set(__shape.id, _group)
  })

  onDestroy(() => {
    // 1️⃣ Destroy Konva nodes
    // _rect?.destroy()

    _group?.destroy()

    // Optional safety
    _group = null
    // _rect = null
    // __nodeMap.delete(__shape.id)

    unsetupNode(_rect)
    __nodeMap.delete(__shape.id)

    // 2️⃣ Force layer redraw
    __layer?.batchDraw()

    // 3️⃣ Optional: unregister editor
    _$_wysiwygEditorsList.unregister?.(__shape.id)
  })
</script>

<!-- <div
  bind:this={_editorEl}
  class="text"
  style="
    left: {__shape.x}px;
    top: {__shape.y}px;
    width: {__shape.w}px;
    height: {__shape.h}px;
  "
> -->
<div bind:this={_editorEl} class="text"></div>

<style>
  .text {
    position: absolute;
    pointer-events: auto;
    transform-origin: top left;
  }
</style>
