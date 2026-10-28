<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy, setContext } from 'svelte'
  import SlideCanvas from '../canvas/SlideCanvas.svelte'
  import SlideNotesPanel from './SlideNotesPanel.svelte'
  import { createSlide } from '../../collab/collab'
  import { enqueueSlideLoad } from '../../utils/slideLoadQueue'
  import { DocumentModel } from '../../../../../models/Document'
  import { createCanvasCommands } from '../../../../../commands/canvasCommands'
  import type { CanvasCommands } from '../../../../../commands/canvasCommands.types'
  import { _$_canvasCommands } from '../../../../../stores/canvas.store'
  import { _$_wysiwygEditorsList, _$_documentEditorsList } from '../../../../../stores/editor.store'
  import { CustomSlideExtensionProps } from '../../utils/common.utils'
  import type { CollaborativeCanvas } from '../../../../../utils/canvas.types'
  import { get } from 'svelte/store'
  import { authStore } from '../../../../../stores/auth.store'
  import { resolveLocalCollabPresence } from '../../../../../utils/collabPresence'
  import { buildCollabDocId, resolveShareContext } from '../../../../../utils/collabUtils'

  let {
    __slideId,
    __slidePath,
    __slideHeight = null,
    __slideWidth = null,
    __maxPageHeight = null,
    __maxPageWidth = null,
    __wysiwygEditorIdToUpdate = null,
    __layout = null,
    __transition = null,
    __transitionDuration = null,
    __transitionSound = null,
    __transitionAdvance = null,
    __transitionAdvanceAfter = null
  } = $props<{
    __slideId: any // Specify actual type if known
    __slidePath: any
    __slideHeight?: number | null
    __slideWidth?: number | null
    __maxPageHeight?: number | null
    __maxPageWidth?: number | null
    __wysiwygEditorIdToUpdate?: string | null
    __layout?: string | null
    __transition?: string | null
    __transitionDuration?: number | null
    __transitionSound?: string | null
    __transitionAdvance?: string | null
    __transitionAdvanceAfter?: number | null
  }>()

  // let _slide: CollaborativeCanvas = null
  let _slide: CollaborativeCanvas = $state(null)
  let _commands: CanvasCommands = null
  // let _commands: CanvasCommands = $state(null)
  let _containeEl: HTMLElement = null
  // let _containeEl: HTMLElement = $state(null)
  let _isLoaded = $state(false)
  let _loadError = $state<string | null>(null)
  const _parentDoc = $derived(get(_$_documentEditorsList.get(__wysiwygEditorIdToUpdate))?.document)

  const _userInfo = $derived.by(() => {
    const authState = get(authStore)
    const shareContext = resolveShareContext(_parentDoc)
    const presence = resolveLocalCollabPresence({
      docId: _collabDocId || 'slide-init',
      authUser: authState?.authenticated ? authState.user : null,
      forceAnonymous: Boolean(shareContext)
    })
    return { name: presence.name, color: presence.color }
  })
  
  let _collabDocId = $state('')
  $effect(() => {
    if (_parentDoc && __slidePath) {
      buildCollabDocId(_parentDoc, __slidePath).then((id) => {
        _collabDocId = id
      })
    }
  })

  let _scrollParent: HTMLElement | null = $state(null)
  let _lastScrollTop = 0
  let _userScrolled = false
  let _scrollHandler: (() => void) | null = null
  let _resolvedPath: string | null = $state(null)
  let _debugInfo = $state({
    slideId: '',
    resolvedPath: '',
    isLoaded: false,
    error: ''
  })
  let _pendingCreate: { w: number; h: number } | null = null
  let _defaultCreated = false
  let _lastTransitionSync = ''

  const findScrollParent = (el: HTMLElement | null) => {
    let node = el?.parentElement
    while (node) {
      const style = window.getComputedStyle(node)
      const overflowY = style.overflowY
      if (
        (overflowY === 'auto' || overflowY === 'scroll') &&
        node.scrollHeight > node.clientHeight
      ) {
        return node
      }
      node = node.parentElement
    }
    return null
  }

  onMount(async () => {
    try {
      const resolvedPath =
        __slidePath ||
        (
          await DocumentModel.getAssetFilePathFromDocument(
            DocumentModel.AssetType.SLIDE,
            undefined,
            __slideId
          )
        )?.filePath
      _resolvedPath = resolvedPath ?? null
      _debugInfo = {
        slideId: String(__slideId ?? ''),
        resolvedPath: _resolvedPath ?? '',
        isLoaded: false,
        error: ''
      }
    _slide = await enqueueSlideLoad(() => createSlide(__slideId, resolvedPath, _parentDoc, _userInfo))
    } catch (err) {
      console.error('[ActiveSlide] createSlide failed', err)
      _loadError = 'Failed to load slide'
      _isLoaded = true
      _debugInfo = {
        slideId: String(__slideId ?? ''),
        resolvedPath: _resolvedPath ?? '',
        isLoaded: false,
        error: _loadError
      }
      return
    }
    // slide = await createSlide(slideId, slidePath)

    if (!_slide) {
      _loadError = 'Failed to load slide'
      _isLoaded = true
      _debugInfo = {
        slideId: String(__slideId ?? ''),
        resolvedPath: _resolvedPath ?? '',
        isLoaded: false,
        error: _loadError
      }
      return
    }

    _scrollParent = findScrollParent(_containeEl)
    if (_scrollParent) {
      _lastScrollTop = _scrollParent.scrollTop
      _scrollHandler = () => {
        _userScrolled = true
      }
      _scrollParent.addEventListener('scroll', _scrollHandler, { passive: true })
    }

    _isLoaded = true
    enqueueSlideLoad(() => _slide.load?.())
      .then(() => {
        _isLoaded = true
        _debugInfo = {
          slideId: String(__slideId ?? ''),
          resolvedPath: _resolvedPath ?? '',
          isLoaded: true,
          error: _loadError ?? ''
        }
        try {
          const meta = _slide?.meta
          if (meta) {
            const master = meta.get('master') as any
            const masterBg = master?.background
            if (!meta.get('background') && masterBg) {
              meta.set('background', masterBg)
            }
          }
        } catch {
          // ignore meta fallback errors
        }
        if (_pendingCreate) {
          const { w, h } = _pendingCreate
          _pendingCreate = null
          maybeCreateDefault(w, h)
        } else if (_slide?.shapes?.size === 0) {
          const fallbackW = __slideWidth ?? __maxPageWidth ?? 1280
          const fallbackH = __slideHeight ?? __maxPageHeight ?? 720
          maybeCreateDefault(fallbackW, fallbackH)
        }
      })
      .catch((err) => {
        console.error('[ActiveSlide] load failed', err)
        _loadError = 'Failed to load slide'
        _debugInfo = {
          slideId: String(__slideId ?? ''),
          resolvedPath: _resolvedPath ?? '',
          isLoaded: false,
          error: _loadError
        }
      })

    if (_scrollParent && !_userScrolled) {
      const previous = _lastScrollTop
      requestAnimationFrame(() => {
        if (_scrollParent && !_userScrolled) {
          _scrollParent.scrollTop = previous
        }
      })
    }

    const slideMeta = _slide.ydoc.getMap('meta')

    _commands = createCanvasCommands(_slide.shapes, _slide.texts, slideMeta)

    // 🔑 make commands available to NodeView UI
    // setContext('slide-commands', commands)
    // _$_canvasCommands.
    // _$_canvasCommands.set(commands)
    _$_canvasCommands.set(__slideId, _commands)

    _slide.awareness?.setLocalStateField('slideId', __slideId)

    // Register the nodeview
    _$_wysiwygEditorsList.registerNodeview(__wysiwygEditorIdToUpdate, {
      id: __slideId,
      type: CustomSlideExtensionProps.name,
      collaborativeCanvas: _slide,
      isActive: false
    })
    // Set only this to active, desactive others
    _$_wysiwygEditorsList.setActiveNodeview(__wysiwygEditorIdToUpdate, __slideId)

    console.log(
      'yes focus registerNodeview',
      __wysiwygEditorIdToUpdate,
      _$_wysiwygEditorsList.getList(),
      _$_wysiwygEditorsList.getEntry(__wysiwygEditorIdToUpdate)
    )

    // Make the element focusable
    _containeEl.tabIndex = 0

    _containeEl.addEventListener('pointerdown', (e) => {
      _containeEl.focus()
      // onPointerDown(e)
    })
    _containeEl.addEventListener('focus', (e) => {
      console.log('yes focus _containeEl', e)
      // Set this nodeview as active
      _$_wysiwygEditorsList.setActiveNodeview(
        __wysiwygEditorIdToUpdate,
        // _$_wysiwygEditorsList.getActiveEntry().id
        __slideId
      )
      // console.log('yes focus active', _$_wysiwygEditorsList.getActiveEntry())
    })
    _containeEl.addEventListener('blur', (e) => {
      console.log('yes blur _containeEl', e)
      // Unset this slide
      // _$_wysiwygEditorsList.unsetActiveNodeview(__wysiwygEditorIdToUpdate, __slideId)
    })
  })

  $effect(() => {
    if (!_slide?.meta) return
    const transition = {
      type: __transition ?? null,
      durationMs:
        typeof __transitionDuration === 'number'
          ? Math.max(0, __transitionDuration) * 1000
          : null,
      sound: __transitionSound ?? null,
      advance: __transitionAdvance ?? null,
      advanceAfter: __transitionAdvanceAfter ?? null
    }
    const key = JSON.stringify(transition)
    if (key === _lastTransitionSync) return
    _lastTransitionSync = key
    if (transition.type) {
      _slide.meta.set('transition', transition)
    } else {
      _slide.meta.delete('transition')
    }
  })

  onDestroy(() => {
    if (_scrollParent && _scrollHandler) {
      _scrollParent.removeEventListener('scroll', _scrollHandler)
    }
    if (_slide?.release) {
      _slide.release()
      return
    }
    _slide?.provider?.destroy()
    _slide?.ydoc?.destroy()
  })

  function onSlideNewlyCreated(stageW: number, stageH: number) {
    console.log('onSlideNewlyCreated', { stageW, stageH })
    if (_loadError) return
    if (!_slide?.isLoaded) {
      _pendingCreate = { w: stageW, h: stageH }
      return
    }
    maybeCreateDefault(stageW, stageH)
  }

  function maybeCreateDefault(stageW: number, stageH: number) {
    if (_defaultCreated) return
    if (!_slide?.isLoaded || !_commands) return
    if (_slide.shapes?.size > 0) return
    if (_slide.newlyCreated || _slide.shapes?.size === 0) {
      _defaultCreated = true
      _commands.createDefaultCanvasContent(stageW, stageH)
    }
  }
</script>

<div class="slide-root" bind:this={_containeEl}>
  <!-- <div class="slide-debug">
    <div><strong>Slide</strong> {_debugInfo.slideId || '—'}</div>
    <div><strong>Path</strong> {_debugInfo.resolvedPath || '—'}</div>
    <div><strong>Loaded</strong> {_debugInfo.isLoaded ? 'yes' : 'no'}</div>
    <div><strong>Error</strong> {_debugInfo.error || '—'}</div>
  </div> -->
  <!-- SlideCanvas {__slideWidth} {__maxPageWidth} -->
  {#if _slide}
    <SlideCanvas
      {__slideId}
      __slidePath={_resolvedPath ?? __slidePath}
      __shapes={_slide.shapes}
      __texts={_slide.texts}
      __meta={_slide.meta}
      __provider={_slide.provider}
      __awareness={_slide.awareness}
      __onSelect={(id, evt) => {
        if (!id) {
          _commands.clearSelection()
        } else {
          _commands.select(id, {
            mode: evt?.shiftKey || evt?.metaKey ? 'toggle' : 'replace'
          })
        }
        // _$_canvasCommands.set(commands)
        _$_canvasCommands.set(__slideId, _commands)
      }}
      __onCreate={(stageW: number, stageH: number) => onSlideNewlyCreated(stageW, stageH)}
      {__maxPageHeight}
      {__maxPageWidth}
      {__slideWidth}
      {__slideHeight}
      {__wysiwygEditorIdToUpdate}
      {__layout}
    />
    <!-- <SlideNotesPanel __meta={_slide?.meta} /> -->
  {:else}
    <div class="slide-loading">
      {_loadError ?? $_('Loading...')}
    </div>
  {/if}
</div>

<style>
  .slide-root {
    position: relative;
  }

  .slide-debug {
    position: absolute;
    right: 6px;
    top: 6px;
    z-index: 10;
    background: rgba(0, 0, 0, 0.65);
    color: #f1f1f1;
    font-size: 11px;
    padding: 6px 8px;
    border-radius: 6px;
    max-width: 280px;
    line-height: 1.3;
    pointer-events: none;
  }

  .slide-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6f6f6f;
    padding: 12px 0;
  }
</style>
