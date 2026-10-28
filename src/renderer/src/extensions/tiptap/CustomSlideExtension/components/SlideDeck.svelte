<!-- SlideNodeView.svelte — Ghost Layout Edition -->
<!-- 
  LAYOUT STRATEGY: "Virtual Ghost + Slide Breakout"
  ─────────────────────────────────────────────────
  The NodeViewWrapper is A4-sized and transparent. The pagination engine
  (tiptap-pagination-plus) sees it as a normal A4 block. Visually, a child
  div breaks OUT of the ghost using absolute positioning, respects 16:9 ratio,
  and is clipped to the ghost's height — so it never overflows the page.
  
  Ghost (A4 / transparent)
  └── .slide-breakout-zone (absolute, 100vw, centered)
      └── .slide-canvas (16:9, max-height = ghost height, shadow, border)
          └── SlidesViewport (the actual slide content)
-->

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onDestroy, onMount } from 'svelte'
  import { NodeViewWrapper } from 'svelte-tiptap'
  import { _$_wysiwygEditorsList } from '../../../../stores/editor.store'
  import { _$_canvasCommands } from '../../../../stores/canvas.store'
  import { CustomSlideExtensionProps } from '../utils/common.utils'
  import { DocumentModel } from '../../../../models/Document'
  import { GenericFormatingEditorCommands } from '../../../../components/common/actions/formatting/commands/GenericFormatingEditorCommands.svelte'
  import { enqueueSlideLoad, setSlideLoadConcurrency } from '../utils/slideLoadQueue'
  import { createSlide } from '../collab/collab'
  import SlidesViewport from './slides/SlidesViewport.svelte'
  import type { CanvasCommands } from '../../../../commands/canvasCommands'

  // ─── Props ────────────────────────────────────────────────────────────────

  interface Props {
    node?: any
    view?: any
    getPos?: () => number
    updateAttributes?: (attrs: Record<string, any>) => void
    selected?: boolean
    extension?: any
    useNodeViewWrapper?: boolean
    isMirror?: boolean
    __src?: string
    __slideHeight?: number
    __slideWidth?: number
    __maxPageHeight?: number
    __maxPageWidth?: number
    __wysiwygEditorIdToUpdate?: string
  }

  let {
    node,
    view,
    getPos,
    updateAttributes,
    selected,
    extension,
    useNodeViewWrapper = true,
    isMirror = false,
    __src,
    __slideHeight,
    __slideWidth,
    __maxPageHeight,
    __maxPageWidth,
    __wysiwygEditorIdToUpdate
  }: Props = $props()

  // ─── Derived Attributes ───────────────────────────────────────────────────

  const _src = $derived(__src ?? node.attrs.src)
  const _maxPageHeight = $derived(__maxPageHeight || node.attrs.maxPageHeight)
  const _maxPageWidth = $derived(__maxPageWidth ?? node.attrs.maxPageWidth)
  const _slideHeight = $derived(__slideHeight ?? node.attrs.slideHeight ?? _maxPageHeight)
  const _slideWidth = $derived(__slideWidth || node.attrs.slideWidth || _maxPageWidth)
  const _layout = $derived(node?.attrs?.layout ?? 'inline')
  const _offsetX = $derived(Number(node?.attrs?.offsetX ?? 0))
  const _offsetY = $derived(Number(node?.attrs?.offsetY ?? 0))
  const _transition = $derived(node?.attrs?.transition ?? null)
  const _transitionDuration = $derived(node?.attrs?.transitionDuration ?? null)
  const _transitionSound = $derived(node?.attrs?.transitionSound ?? null)
  const _transitionAdvance = $derived(node?.attrs?.transitionAdvance ?? null)
  const _transitionAdvanceAfter = $derived(node?.attrs?.transitionAdvanceAfter ?? null)
  const _wysiwygEditorIdToUpdate = $derived(
    __wysiwygEditorIdToUpdate ?? node.attrs.wysiwygEditorIdToUpdate
  )

  // Mirror mode forces no wrapper — we render raw without NodeViewWrapper
  const _shouldWrap = $derived(useNodeViewWrapper && !isMirror)

  // ─── Pagination Store ─────────────────────────────────────────────────────

  const paginationStore = _$_wysiwygEditorsList.getPaginationOptionsStore(_wysiwygEditorIdToUpdate)
  let _editorPaginationOptions = $derived($paginationStore || null)

  // ─── Ghost / Layout Geometry ──────────────────────────────────────────────

  /**
   * The "ghost" is the transparent A4-sized block the pagination engine measures.
   * We derive its size from maxPage dimensions. Its height defines the visual
   * clipping boundary for the slide canvas inside.
   */
  const _ghostWidth = $derived(_slideWidth ?? 1280)
  const _ghostHeight = $derived(_slideHeight ?? 720)
  // const _ghostHeight = null

  /**
   * The slide canvas targets a 16:9 ratio.
   * It is constrained to ghostHeight so it never overflows the page.
   * Width = ghostHeight * (16/9), but capped at something sane.
   */
  const SLIDE_RATIO = 16 / 9
  const _canvasMaxHeight = $derived(_ghostHeight)
  // Ideal width at 16:9 for the ghost height, but never exceed 100vw (handled by CSS)
  const _canvasIdealWidth = $derived(Math.round(_canvasMaxHeight * SLIDE_RATIO))

  // The ghost style — transparent, exact A4 dimensions, no visual chrome
  const ghostStyle = $derived(`
    width: 100%;
    height: fit-content;
  `)
  // const ghostStyle = $derived(`
  //   width: ${_ghostWidth}px;
  //   height: fit-content; /* allow height to grow if content exceeds, but we will clip it visually */
  //   // height: ${_ghostHeight}px;
  // `)

  // ─── Visibility / IntersectionObserver ───────────────────────────────────

  const PREFETCH_DISABLE_THRESHOLD = 300
  const MAX_PREFETCH_NEIGHBORS = 2

  let _nodeViewRoot: HTMLDivElement | null = null
  let _isVisible = $state(false)
  let _observer: IntersectionObserver | null = null
  let _hideTimer: ReturnType<typeof setTimeout> | null = null
  let _prefetchTimer: number | null = null
  const _prefetchedSlides = new Set<string>()
  let _slideCacheKey = ''
  let _slideCache: { id: string; src?: string }[] = []

  const ensureVisible = () => {
    if (_isVisible) return
    _isVisible = true
    _observer?.disconnect()
  }

  const scheduleIdle = (callback: () => void) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      return window.requestIdleCallback(callback, { timeout: 1200 })
    }
    return setTimeout(callback, 200)
  }

  const getSlideIndexSnapshot = () => {
    if (!view?.state?.doc) return []
    const key = `${view.state.doc.content.size}:${view.state.doc.childCount}`
    if (key === _slideCacheKey && _slideCache.length) return _slideCache
    const slides: { id: string; src?: string }[] = []
    view.state.doc.descendants((docNode) => {
      if (docNode.type.name === CustomSlideExtensionProps.name) {
        slides.push({ id: docNode.attrs?.id, src: docNode.attrs?.src })
      }
    })
    _slideCacheKey = key
    _slideCache = slides
    return slides
  }

  const prefetchSlides = () => {
    if (!view?.state?.doc || !node?.attrs?.id) return
    const slides = getSlideIndexSnapshot()
    if (!slides.length || slides.length > PREFETCH_DISABLE_THRESHOLD) return
    const index = slides.findIndex((s) => s.id === node.attrs.id)
    if (index === -1) return
    const candidates = [slides[index + 1], slides[index + 2], slides[index - 1], slides[index - 2]]
      .filter(Boolean)
      .filter((s) => s?.id && !_prefetchedSlides.has(s.id))
      .slice(0, MAX_PREFETCH_NEIGHBORS)

    candidates.forEach((slide) => {
      _prefetchedSlides.add(slide.id)
      scheduleIdle(async () => {
        try {
          const canvas = await enqueueSlideLoad(() => createSlide(slide.id, slide.src))
          await enqueueSlideLoad(() => canvas.load?.())
          canvas.release?.()
        } catch (err) {
          console.warn('[SlidePrefetch] failed', { id: slide.id, err })
        }
      })
    })
  }

  // ─── Slide Path Resolution ────────────────────────────────────────────────

  const ensureSlidePath = async () => {
    console.log('ensureSlidePath ', { __src, nodeF: node?.attrs?.src, node })
    // if (node?.attrs?.src) return
    if (__src || node?.attrs?.src) return
    console.log('ensureSlidePath 2', { __src, nodeF: node?.attrs?.src, node })

    if (!node?.attrs?.id) return
    console.log('ensureSlidePath 3', { __src, nodeF: node?.attrs?.src, node })

    try {
      const result = await DocumentModel.getAssetFilePathFromDocument(
        DocumentModel.AssetType.SLIDE,
        undefined,
        node.attrs.id
      )
      console.log('ensureSlidePath ', { result })

      if (result?.filePath) {
        updateAttributes?.({ src: result.filePath })
      }
    } catch (err) {
      console.warn('[SlideDeck] ensureSlidePath Failed to resolve slide path', err)
    }
  }

  // ─── Context Menu ─────────────────────────────────────────────────────────

  function setActiveNodeview() {
    if (!_wysiwygEditorIdToUpdate || !node?.attrs?.id) return
    _$_wysiwygEditorsList.registerNodeview(_wysiwygEditorIdToUpdate, {
      id: node.attrs.id,
      type: CustomSlideExtensionProps.name,
      collaborativeCanvas: null,
      isActive: false
    })
    _$_wysiwygEditorsList.setActiveNodeview(_wysiwygEditorIdToUpdate, node.attrs.id)
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

  // ─── Canvas Commands ──────────────────────────────────────────────────────

  let slideCommands: CanvasCommands | null = null
  let unsubscribe: () => void

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  onMount(() => {
    void ensureSlidePath()

    unsubscribe = _$_canvasCommands.subscribeById(node.attrs.id).subscribe((value) => {
      slideCommands = value
    })

    if (typeof IntersectionObserver === 'undefined') {
      ensureVisible()
      return
    }

    const slidesForObserver = getSlideIndexSnapshot()
    const isLargeDoc = slidesForObserver.length > PREFETCH_DISABLE_THRESHOLD
    setSlideLoadConcurrency(isLargeDoc ? 1 : 2)
    // const rootMargin = isLargeDoc ? '200px 0px' : '800px 0px'

    _observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return

        if (entry.isIntersecting) {
          if (_hideTimer) {
            clearTimeout(_hideTimer)
            _hideTimer = null
          }
          ensureVisible()
          if (_prefetchTimer) return
          _prefetchTimer = scheduleIdle(() => {
            _prefetchTimer = null
            prefetchSlides()
          }) as number
          return
        }

        if (selected) return
        if (_hideTimer) return
        _hideTimer = setTimeout(() => {
          _hideTimer = null
          if (!selected) _isVisible = false
        }, 600)
      },
      {
        root: view?.dom?.parentElement ?? null
        // rootMargin
      }
    )

    if (_nodeViewRoot) _observer.observe(_nodeViewRoot)
  })

  onDestroy(() => {
    unsubscribe?.()
    _observer?.disconnect()
    _observer = null
    if (_hideTimer) {
      clearTimeout(_hideTimer)
      _hideTimer = null
    }
    if (_prefetchTimer) {
      clearTimeout(_prefetchTimer)
      _prefetchTimer = null
    }
  })
</script>

<!--
  ─── RENDER ────────────────────────────────────────────────────────────────
  Both branches (mirror / normal) share the same inner markup.
  The only difference is the wrapping element.
  
  Ghost layout explained:
  • .slide-ghost      → A4 sized, transparent, contains: layout
  • .slide-breakout   → position:absolute, 100vw wide, centered — escapes ghost width
  • .slide-canvas     → 16:9 aspect-ratio, max-height = ghostHeight, white bg, shadow
  • .slide-inner      → fills the canvas, holds SlidesViewport or placeholder
-->

{#snippet slideContent()}
  <div
    class="slide-ghost"
    class:is-selected={selected}
    style={ghostStyle}
    oncontextmenu={handleContextMenu}
    bind:this={_nodeViewRoot}
    role="presentation"
  >
    <div
      class="relative h-full bg-hatched-5-important"
      style={`width: ${_maxPageWidth ? `${_maxPageWidth}px` : '100%'};
      height: ${_maxPageHeight ? `${_maxPageHeight}px` : '100%'};
      max-width: ${_maxPageWidth ? `${_maxPageWidth}px` : '100%'};
      max-height: ${_maxPageHeight ? `${_maxPageHeight}px` : '100%'};`}
    >
      <div class="slide-breakout" style={`top: ${(_maxPageHeight - _ghostHeight) / 2}px;`}>
        <div class="slide-canvas" style={`max-height: ${_canvasMaxHeight}px;`}>
          {#if _isVisible}
            <SlidesViewport
              __slideId={node.attrs.id}
              __slidePath={_src}
              __layout={_layout}
              __maxPageHeight={_maxPageHeight}
              __maxPageWidth={_maxPageWidth}
              __slideWidth={_ghostWidth}
              __slideHeight={_ghostHeight}
              __wysiwygEditorIdToUpdate={_wysiwygEditorIdToUpdate}
            />
          {:else}{/if}
        </div>
      </div>
    </div>
  </div>
{/snippet}

{#if _shouldWrap}
  <NodeViewWrapper class="node-view-{CustomSlideExtensionProps.name}">
    {@render slideContent()}
  </NodeViewWrapper>
{:else}
  {@render slideContent()}
{/if}

<style>
  /* ─── Breakout zone ─── */
  .slide-breakout {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    /* height: 100%;
    width: 100vw; */
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 10; /* Ensure it stays above the ghost */
    cursor: initial;
  }

  /* ─── The actual slide canvas ─── */
  .slide-canvas {
    /* aspect-ratio: 16 / 9; */
    /* height: 100%; */
    width: auto;
    /* This is the red part in your screenshot */
    background: #ffffff;
    border-radius: 6px;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Clips the green part if it overflows */
    /* overflow: hidden;  */
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
    position: relative;
  }
  .slide-ghost {
    position: relative;
    background: transparent;
    margin: 0 auto;
    /* Layout engine sees this as a solid A4 block */
    contain: layout;
    /* No visual chrome — the breakout child provides it */
  }

  /* Force the inner SlideView/Konva to fill the canvas 100% */
  :global(.slide-absolute) {
    position: relative !important; /* Overrides the absolute/left/-293px */
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    display: flex !important;
    align-items: center;
    justify-content: center;
  }
</style>
