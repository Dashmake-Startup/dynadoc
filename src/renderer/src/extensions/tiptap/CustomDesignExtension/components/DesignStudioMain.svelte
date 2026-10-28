<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import { createDesign } from '../collab/collab'
  import { createCanvasCommands, type CanvasCommands } from '../../../../commands/canvasCommands'
  import { _$_canvasCommands } from '../../../../stores/canvas.store'
  import SkiaCanva from './canvas/SkiaCanva.svelte'
  import { NodeViewWrapper } from 'svelte-tiptap'
  import { _$_wysiwygEditorsList, _$_documentEditorsList } from '../../../../stores/editor.store'
  import { CustomDesignExtensionProps } from '../utils/common.utils'
  import type { CollaborativeCanvas } from '../../../../utils/canvas.types'
  import { show, showOnly, showOnlyPrimarySidebarContent } from '../../../../stores/common.store'
  import Resizer from '../../../../components/app/editor/components/display/Resizer.svelte'
  import { GenericFormatingEditorCommands } from '../../../../components/common/actions/formatting/commands/GenericFormatingEditorCommands.svelte'
  import { get } from 'svelte/store'
  import { authStore } from '../../../../stores/auth.store'
  import { resolveLocalCollabPresence } from '../../../../utils/collabPresence'
  import { buildCollabDocId, resolveShareContext } from '../../../../utils/collabUtils'

  interface Props {
    node?: any
    view?: any
    getPos?: () => number
    updateAttributes?: (attrs: Record<string, any>) => void
    selected?: boolean
    extension?: any
    // The '?' here marks them as optional in the type system
    useNodeViewWrapper?: boolean
    isMirror?: boolean
    __src?: string

    __designId?: string
    // __designPath?: string
    __designHeight?: number
    __designWidth?: number
    __maxPageHeight?: number
    __maxPageWidth?: number
    __wysiwygEditorIdToUpdate?: string
  }

  let {
    node, // The Prosemirror node (contains attributes)
    view, // The editor view
    getPos, // Function to get the current position
    updateAttributes, // Function to update node attributes
    selected, // Boolean: is the node selected?
    extension, // The extension instance
    useNodeViewWrapper = true, // Default to true for normal Tiptap use
    isMirror = false,
    __src, //make it optional
    __designId,
    // __designPath,

    __designHeight,
    __designWidth,
    __maxPageHeight,
    __maxPageWidth,
    __wysiwygEditorIdToUpdate
  }: Props = $props()

  const DEFAULT_DESIGN_WIDTH = 800
  // const DEFAULT_DESIGN_HEIGHT = 100
  const DEFAULT_DESIGN_HEIGHT = 1200
  const DEFAULT_DESIGN_BG = '#fff'

  // Derived values: Use the prop if passed, otherwise fall back to the Tiptap node attribute
  let _designId = $derived(__designId || node?.attrs?.id)
  let _src = $derived(__src ?? node?.attrs?.src)
  const _maxPageHeight = $derived(__maxPageHeight || node?.attrs?.maxPageHeight)
  const _maxPageWidth = $derived(__maxPageWidth ?? node?.attrs?.maxPageWidth)

  const _designHeight = $derived(
    __designHeight ?? node?.attrs?.designHeight ?? _maxPageHeight ?? DEFAULT_DESIGN_HEIGHT
  )
  const _designWidth = $derived(
    __designWidth ?? node?.attrs?.designWidth ?? _maxPageWidth ?? DEFAULT_DESIGN_WIDTH
  )
  const _layout = $derived(node?.attrs?.layout ?? 'inline')
  const _offsetX = $derived(Number(node?.attrs?.offsetX ?? 0))
  const _offsetY = $derived(Number(node?.attrs?.offsetY ?? 0))

  const _wysiwygEditorIdToUpdate = $derived(
    __wysiwygEditorIdToUpdate ?? node?.attrs?.wysiwygEditorIdToUpdate
  )
  const _parentDoc = $derived(get(_$_documentEditorsList.get(_wysiwygEditorIdToUpdate))?.document)

  const _userInfo = $derived.by(() => {
    const authState = get(authStore)
    const shareContext = resolveShareContext(_parentDoc)
    const presence = resolveLocalCollabPresence({
      docId: _collabDocId || 'design-init',
      authUser: authState?.authenticated ? authState.user : null,
      forceAnonymous: Boolean(shareContext)
    })
    return { name: presence.name, color: presence.color }
  })
  
  const paginationStore = _$_wysiwygEditorsList.getPaginationOptionsStore(_wysiwygEditorIdToUpdate)
  // Now $derived will track $paginationStore correctly!
  let _editorPaginationOptions = $derived($paginationStore || null)

  // IMPORTANT: If isMirror is true, we MUST force useNodeViewWrapper to false
  const _shouldWrap = $derived(useNodeViewWrapper && !isMirror)

  const activeNodeviewStore = _$_wysiwygEditorsList.getActiveNodeviewStore(_wysiwygEditorIdToUpdate)

  const _showToolBar = $derived($activeNodeviewStore?.id == _designId)

  let _collabDocId = $state('')
  $effect(() => {
    if (_parentDoc && _src) {
      buildCollabDocId(_parentDoc, _src).then((id) => {
        _collabDocId = id
      })
    }
  })

  $effect(() => {
    console.log('Syncing shapes _showToolBar', { _showToolBar })

    if (_showToolBar) {
      // show('leftSidebar')
      // show('secondarySidebar')
    }
    // 1. Select all 4 elements
    const imageToolbar = document.querySelector(
      '#image-editor-toolbar-bar-pane'
    ) as HTMLElement | null
    const activityBar = document.querySelector('#activity-bar-pane') as HTMLElement | null
    const imageSideBar = document.querySelector(
      '#image-editor-secondary-side-bar-pane'
    ) as HTMLElement | null
    const wysiwygSideBar = document.querySelector(
      '#wysiwyg-secondary-side-bar-pane'
    ) as HTMLElement | null

    // 2. Defensive check: only proceed if the primary toggle elements exist
    if (!imageToolbar || !activityBar) return

    const showToolBar = _showToolBar

    console.log('Pane Switcher Logic:', {
      showToolBar,
      designId: _designId,
      activeId: $activeNodeviewStore?.id
    })

    if (showToolBar) {
      // Show Image Editor UI
      imageToolbar.style.display = 'block'
      if (imageSideBar) imageSideBar.style.display = 'block'

      // Hide Standard WYSIWYG UI
      activityBar.style.display = 'none'
      if (wysiwygSideBar) wysiwygSideBar.style.display = 'none'
    } else {
      // Hide Image Editor UI
      imageToolbar.style.display = 'none'
      if (imageSideBar) imageSideBar.style.display = 'none'

      // Show Standard WYSIWYG UI
      activityBar.style.display = 'block'
      if (wysiwygSideBar) wysiwygSideBar.style.display = 'block'
    }
  })
  // export let __designId = "id1"
  // export let __designPath = "~/Library/Application Support/ddoc-office/ddoc-office/test/assets/design/Design.json"
  // export let __designHeight: number = null
  // export let __designWidth: number = null
  // export let __maxPageHeight: number = null
  // export let __maxPageWidth: number = null
  // export let __wysiwygEditorIdToUpdate: string = null

  let _design: CollaborativeCanvas = $state(null)
  let _commands: CanvasCommands
  let _containeEl: HTMLElement
  let _nodeViewRoot: HTMLDivElement | null = null
  let _isVisible = $state(false)
  let _observer: IntersectionObserver | null = null
  let _initStarted = false

  function setActiveNodeview() {
    if (!_wysiwygEditorIdToUpdate || !_designId) return
    _$_wysiwygEditorsList.registerNodeview(_wysiwygEditorIdToUpdate, {
      id: _designId,
      type: CustomDesignExtensionProps.name,
      collaborativeCanvas: _design,
      isActive: false
    })
    _$_wysiwygEditorsList.setActiveNodeview(_wysiwygEditorIdToUpdate, _designId)
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault()
    setActiveNodeview()
    window.api?.showContextMenu?.([
      {
        label: 'In line with text',
        click: () => GenericFormatingEditorCommands.setActiveNodeviewLayout?.('inline')
      },
      { type: 'separator' },
      {
        label: 'Center',
        click: () => GenericFormatingEditorCommands.setActiveNodeviewLayout?.('center')
      },
      {
        label: 'Full width',
        click: () => GenericFormatingEditorCommands.setActiveNodeviewLayout?.('full')
      },
      {
        label: 'Float left',
        click: () => GenericFormatingEditorCommands.setActiveNodeviewLayout?.('float-left')
      },
      {
        label: 'Float right',
        click: () => GenericFormatingEditorCommands.setActiveNodeviewLayout?.('float-right')
      },
      { type: 'separator' },
      {
        label: 'In front of text',
        click: () => GenericFormatingEditorCommands.setActiveNodeviewLayout?.('front')
      },
      {
        label: 'Behind text',
        click: () => GenericFormatingEditorCommands.setActiveNodeviewLayout?.('behind')
      },
      { type: 'separator' },
      {
        label: 'Nudge left',
        click: () => GenericFormatingEditorCommands.nudgeActiveNodeview?.(-10, 0)
      },
      {
        label: 'Nudge right',
        click: () => GenericFormatingEditorCommands.nudgeActiveNodeview?.(10, 0)
      },
      {
        label: 'Nudge up',
        click: () => GenericFormatingEditorCommands.nudgeActiveNodeview?.(0, -10)
      },
      {
        label: 'Nudge down',
        click: () => GenericFormatingEditorCommands.nudgeActiveNodeview?.(0, 10)
      },
      {
        label: 'Reset position',
        click: () => GenericFormatingEditorCommands.resetActiveNodeviewPosition?.()
      }
    ])
  }

  const _placeholderHeight = $derived(
    (() => {
      const raw = _designHeight ?? _maxPageHeight ?? 320
      const value = typeof raw === 'number' ? raw : parseFloat(String(raw))
      return Number.isFinite(value) ? value : 320
    })()
  )
  const _layoutTakesSpace = $derived(!['front', 'behind'].includes(_layout))
  const _positionStyle = $derived(() => {
    const pieces = [
      `--nodeview-offset-x: ${_offsetX}px`,
      `--nodeview-offset-y: ${_offsetY}px`
    ]
    if (_layoutTakesSpace) {
      pieces.push(`min-height: ${_placeholderHeight}px`)
    }
    return pieces.join('; ')
  })

  const initializeDesign = async () => {
    _design = await createDesign(_designId, _src, _parentDoc, _userInfo)

    _designId = _designId || _design.id
    _src = _src || _design.path
    console.log('Syncing shapes createDesign...', {
      _design,
      __designId: _designId,
      _src,
      '_design.shapes': _design.shapes._length
    })

    const designMeta = _design.ydoc.getMap('meta')

    _commands = createCanvasCommands(_design.shapes, _design.texts, designMeta)

    // 🔑 expose commands globally (same as before)
    _$_canvasCommands.set(_designId, _commands)

    // Awareness scoped to this design
    _design.awareness.setLocalStateField('designId', _designId)

    // Register the nodeview
    _$_wysiwygEditorsList.registerNodeview(_wysiwygEditorIdToUpdate, {
      id: _designId,
      type: CustomDesignExtensionProps.name,
      collaborativeCanvas: _design,
      isActive: false
    })
    // Set only this to active, desactive others
    _$_wysiwygEditorsList.setActiveNodeview(_wysiwygEditorIdToUpdate, _designId)

    console.log(
      'yes focus registerNodeview',
      _wysiwygEditorIdToUpdate,
      _$_wysiwygEditorsList.getList(),
      _$_wysiwygEditorsList.getEntry(_wysiwygEditorIdToUpdate)
    )

    // Make the element focusable
    _containeEl.tabIndex = 0

    _containeEl.addEventListener('pointerdown', (e) => {
      _containeEl.focus()
      // onPointerDown(e)
    })
    _containeEl.addEventListener('click', (e) => {
      // _containeEl.addEventListener('focus', (e) => {
      console.log('yes click _containeEl', e)

      // Make sure designing toolbars are shown
      show('leftSidebar')
      show('secondarySidebar')

      // Set this nodeview as active
      _$_wysiwygEditorsList.setActiveNodeview(
        _wysiwygEditorIdToUpdate,
        // _$_wysiwygEditorsList.getActiveEntry().id
        _designId
      )
      // console.log('yes focus active', _$_wysiwygEditorsList.getActiveEntry())
    })
    _containeEl.addEventListener('blur', (e) => {
      console.log('yes blur _containeEl', e)
      // Unset this DESIGN
      // _$_wysiwygEditorsList.unsetActiveNodeview(__wysiwygEditorIdToUpdate, __DESIGNId)
    })
  }

  const ensureVisible = async () => {
    if (_isVisible) return
    _isVisible = true
    _observer?.disconnect()
    _observer = null
    if (_initStarted) return
    _initStarted = true
    await initializeDesign()
  }

  onMount(async () => {
    if (typeof IntersectionObserver === 'undefined') {
      await ensureVisible()
      return
    }

    _observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          ensureVisible()
        }
      },
      {
        root: view?.dom?.parentElement ?? null,
        rootMargin: '600px 0px'
      }
    )

    if (_nodeViewRoot) {
      _observer.observe(_nodeViewRoot)
    }
  })

  onDestroy(() => {
    _observer?.disconnect()
    _observer = null
    _design?.provider.destroy()
    _design?.ydoc.destroy()
  })

  function onDesignCreated(width: number, height: number) {
    if (_design?.newlyCreated) {
      _commands.createDefaultCanvasContent(width, height)
    }
  }
</script>

{#if node && _shouldWrap}
  <NodeViewWrapper>
    <Resizer
      __width={_maxPageWidth}
      __height={_maxPageHeight}
      __direction="both"
      __lockAspectRatio={false}
      __updateAttributes={(newAttrs) => {}}
    >
      <div
        class="node-view-{CustomDesignExtensionProps.name} nodeview-position"
        data-layout={_layout}
        style={_positionStyle}
        bind:this={_nodeViewRoot}
        oncontextmenu={handleContextMenu}
      >
        <!-- <div> -->
        <!-- <div
      bind:this={_containeEl}
      tabindex="0"
      class="items-center max-w-[{_maxPageWidth}px] h-[{_maxPageHeight}px]
   max-h-[{_maxPageHeight}px] relative
   m-auto border border-dashed dark:border-dark rounded-[5px]
   "
    > -->
        <div
          bind:this={_containeEl}
          tabindex="0"
          class="items-center relative m-auto border border-dashed dark:border-dark rounded-[5px]"
          style:max-width={_editorPaginationOptions?.enabled ? `${_maxPageWidth}px` : 'none'}
          style:max-height={_editorPaginationOptions?.enabled ? `${_maxPageHeight}px` : 'none'}
          style:width={_editorPaginationOptions?.enabled ? `${_maxPageWidth}px` : '100%'}
          style:height={_editorPaginationOptions?.enabled ? `${_maxPageHeight}px` : 'auto'}
        >
          {#if _isVisible && _design}
            <SkiaCanva
              __canvaCommands={_commands}
              __canvaId={_designId}
              __canvaPath={_src}
              __shapes={_design.shapes}
              __texts={_design.texts}
              __provider={_design.provider}
              __awareness={_design.awareness}
              __canvaWidth={_designWidth}
              __canvaHeight={_designHeight}
              __maxPageWidth={_maxPageWidth}
              __maxPageHeight={_maxPageHeight}
              __wysiwygEditorIdToUpdate={_wysiwygEditorIdToUpdate}
              __onCreate={(w, h) => onDesignCreated(w, h)}
              __onSelect={(id, evt) => {
                if (!id) {
                  _commands.clearSelection()
                  _$_canvasCommands.set(_designId, _commands)
                  return
                }
                _commands.select(id, {
                  toggle: evt?.shiftKey || evt?.metaKey
                })
                _$_canvasCommands.set(_designId, _commands)
              }}
            />
          {:else}
            <div class="design-placeholder" style={`height: ${_placeholderHeight}px`}>
              {$_('Loading...')}
            </div>
          {/if}
        </div>
      </div>
    </Resizer>
  </NodeViewWrapper>
{:else}
  <!-- <div
    class="p-4 items-center max-w-[{_maxPageWidth}px]
   max-h-[{_maxPageHeight}px] relative
   m-auto border border-ligt dark:border-dark rounded-[5px]
   "
  > -->
  <Resizer
    __width={_maxPageWidth}
    __height={_maxPageHeight}
    __direction="both"
    __lockAspectRatio={false}
    __updateAttributes={(newAttrs) => {}}
  >
    <div
      class="node-view-{CustomDesignExtensionProps.name} nodeview-position"
      data-layout={_layout}
      style={_positionStyle}
      bind:this={_nodeViewRoot}
      oncontextmenu={handleContextMenu}
    >
      <div bind:this={_containeEl}>
        {#if _isVisible && _design}
          <SkiaCanva
            __canvaCommands={_commands}
            __canvaId={_designId}
            __canvaPath={_src}
            __shapes={_design.shapes}
            __texts={_design.texts}
            __provider={_design.provider}
            __awareness={_design.awareness}
            __canvaWidth={_designWidth}
            __canvaHeight={_designHeight}
            __maxPageWidth={_maxPageWidth}
            __maxPageHeight={_maxPageHeight}
            __wysiwygEditorIdToUpdate={_wysiwygEditorIdToUpdate}
            __onCreate={(w, h) => onDesignCreated(w, h)}
            __onSelect={(id, evt) => {
              if (!id) {
                _commands.clearSelection()
                _$_canvasCommands.set(_designId, _commands)
                return
              }
              _commands.select(id, {
                toggle: evt?.shiftKey || evt?.metaKey
              })
              _$_canvasCommands.set(_designId, _commands)
            }}
          />
        {:else}
          <div class="design-placeholder" style={`height: ${_placeholderHeight}px`}>
            {$_('Loading...')}
          </div>
        {/if}
      </div>
    </div>
  </Resizer>
{/if}

<style>
  .design-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed rgba(0, 0, 0, 0.2);
    color: #6f6f6f;
    background: rgba(0, 0, 0, 0.02);
  }
</style>
