<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { mount, onDestroy, onMount } from 'svelte'
  import Konva from 'konva'
  import * as Y from 'yjs'

  import TextShape from './TextShape.svelte'
  import ShapeNode from './ShapeNode.svelte'
  import { get } from 'svelte/store'
  import { gsap } from 'gsap'
  import { smartSnapping } from '../../../../konva/snapping'
  import { CustomSlideExtensionProps } from '../../utils/common.utils'
  import { ShapeType, type Shape } from '../../../../../utils/canvas.types'
  import EditorExtensionHelpers from '../../../../../utils/EditorExtensionHelpers'
  import { GenericFormatingEditorCommands } from '../../../../../components/common/actions/formatting/commands/GenericFormatingEditorCommands.svelte'

  // export let __slideId
  // export let __slidePath
  // export let __shapes
  // export let __texts
  // export let __awareness
  // export let __provider
  // export let __onSelect
  // export let __onCreate
  // export let __slideHeight: number = null
  // export let __slideWidth: number = null
  // export let __maxPageHeight: number = null
  // export let __maxPageWidth: number = null
  // export let __wysiwygEditorIdToUpdate: string = null

  interface Props {
    __slideId: string
    __slidePath: string
    __shapes: Y.Map<any>
    __texts: Y.Map<any>

    __awareness: any
    __provider: any

    __onSelect?: (id: string, evt?: MouseEvent) => void
    __onCreate?: (w: number, h: number) => void

    __slideBackground?: string | null
    __slideHeight?: number | null
    __slideWidth?: number | null
    __maxPageHeight?: number | null
    __maxPageWidth?: number | null
    __wysiwygEditorIdToUpdate?: string | null
    __layout?: string
    __meta?: Y.Map<any>
  }

  const {
    __slideId,
    __slidePath,
    __shapes,
    __texts,

    __awareness,
    __provider,

    __onSelect,
    __onCreate,
    __slideBackground,
    __slideHeight = null,
    __slideWidth,
    __maxPageHeight = null,
    __maxPageWidth = null,
    __wysiwygEditorIdToUpdate = null,
    __layout = 'inline',
    __meta = null
  }: Props = $props()

  // const DEFAULT_SLIDE_WIDTH = 1800
  const DEFAULT_SLIDE_WIDTH = 1280
  // const DEFAULT_SLIDE_HEIGHT = 100
  const DEFAULT_SLIDE_HEIGHT = 720
  // const DEFAULT_SLIDE_BG = 'red'
  const DEFAULT_SLIDE_BG = '#fff'

  // __slideWidth = __slideWidth || __maxPageWidth || DEFAULT_SLIDE_WIDTH
  // const _slideWidth = DEFAULT_SLIDE_WIDTH
  const _slideWidth = $derived(__slideWidth || __maxPageWidth || DEFAULT_SLIDE_WIDTH)
  const _slideHeight = $derived(__slideHeight || DEFAULT_SLIDE_HEIGHT)
  let _metaBackground: string | null = $state(null)
  let _masterElements: Shape[] = $state([])
  const _slideBackground = $derived(__slideBackground || _metaBackground || DEFAULT_SLIDE_BG)
  const _layout = $derived(__layout || 'inline')
  const _layoutIsOverlay = $derived(['front', 'behind'].includes(_layout))
  let _lastTransitionKey = ''

  $effect(() => {
    if (!_stage || !__meta) return
    const transition = __meta.get('transition')
    if (!transition) return
    const key = JSON.stringify(transition)
    if (key === _lastTransitionKey) return
    _lastTransitionKey = key

    const container = _stage.container()
    if (!container) return

    const duration = Math.max(0.2, (transition.durationMs ?? 500) / 1000)
    const type = String(transition.type ?? 'fade').toLowerCase()

    if (type.includes('push') || type.includes('wipe')) {
      gsap.from(container, { x: _slideWidth, duration, ease: 'power2.inOut' })
    } else if (type.includes('zoom')) {
      gsap.from(container, { scale: 0.95, opacity: 0, duration, ease: 'power2.out' })
    } else {
      gsap.fromTo(container, { opacity: 0 }, { opacity: 1, duration })
    }
  })

  let _container: string | HTMLDivElement
  let _stage: Konva.Stage
  let _backgroundLayer: Konva.Layer
  let _backgroundRect: Konva.Rect | null = null
  let _masterLayer: Konva.Layer
  let _layer: Konva.Layer
  const _nodeMap = new Map<string, Konva.Node>()

  // let _shapeList = []
  let _shapeList: Shape[] = $state([])
  let _positionLeft: number = $state(0)
  let _positionTop: number = $state(0)
  let _selectionBounds: { x: number; y: number; width: number; height: number } | null = $state(null)

  function sync() {
    // console.log('Syncing shapes...')
    _shapeList = Array.from(__shapes.entries())
      .map(([id, data]) => ({
        ...data,
        id // put id LAST so it always wins
      }))
      .sort((a, b) => (a?.z ?? 0) - (b?.z ?? 0))

    // Avoid noisy logs when handling many slides
    updateSelectionBounds()
  }

  const mapMasterElements = (elements: any[]): Shape[] => {
    if (!Array.isArray(elements)) return []
    return elements.map((element, index) => {
      const kind = String(element?.shape || '').toLowerCase()
      const type =
        element?.type === 'image'
          ? ShapeType.File
          : element?.type === 'text'
            ? ShapeType.Text
            : ['ellipse', 'circle', 'oval'].includes(kind)
              ? ShapeType.Ellipse
              : ['line', 'straightconnector1', 'connector1', 'lineinv'].includes(kind)
                ? ShapeType.Line
                : ['triangle', 'righttriangle', 'isoscelestriangle'].includes(kind)
                  ? ShapeType.Triangle
                  : ShapeType.Rect
      return {
        id: element?.id || `master-${index}`,
        name: element?.name || 'Master',
        type,
        x: Number(element?.x ?? 0),
        y: Number(element?.y ?? 0),
        w: Number(element?.width ?? 0),
        h: Number(element?.height ?? 0),
        z: index,
        rotation: Number(element?.rotation ?? 0),
        visible: true,
        selected: false,
        shapeKind: element?.shape,
        fill: element?.fill,
        stroke: element?.stroke,
        strokeWidth: element?.strokeWidth,
        src: element?.src
      }
    })
  }

  const syncMeta = () => {
    if (!__meta) return
    const master = __meta.get('master')
    _masterElements = mapMasterElements(master?.elements ?? [])

    _metaBackground =
      master?.background ||
      __meta.get('background') ||
      _metaBackground ||
      DEFAULT_SLIDE_BG
  }

  const splitGradientParts = (input: string) => {
    const parts: string[] = []
    let current = ''
    let depth = 0
    for (const char of input) {
      if (char === '(') depth += 1
      if (char === ')') depth = Math.max(0, depth - 1)
      if (char === ',' && depth === 0) {
        parts.push(current.trim())
        current = ''
        continue
      }
      current += char
    }
    if (current.trim()) parts.push(current.trim())
    return parts
  }

  const parseLinearGradient = (value: string, width: number, height: number) => {
    const match = value.match(/linear-gradient\s*\((.+)\)/i)
    if (!match) return null
    const parts = splitGradientParts(match[1])
    if (parts.length < 2) return null

    let angleDeg = 180
    const first = parts[0].toLowerCase()
    let colorStartIndex = 0
    if (first.includes('deg') || first.startsWith('to ')) {
      colorStartIndex = 1
      if (first.includes('deg')) {
        angleDeg = parseFloat(first)
      } else if (first.includes('to right')) {
        angleDeg = 90
      } else if (first.includes('to left')) {
        angleDeg = 270
      } else if (first.includes('to top')) {
        angleDeg = 0
      } else if (first.includes('to bottom')) {
        angleDeg = 180
      }
    }

    const colors = parts.slice(colorStartIndex).map((part) => {
      const colorMatch = part.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/)
      const color = colorMatch ? colorMatch[1] : part.split(/\s+/)[0]
      const stopMatch = part.match(/(\d+)%/)
      const stop = stopMatch ? parseFloat(stopMatch[1]) / 100 : null
      return { color, stop }
    })

    const colorStops: number[] = []
    const inferredStops = colors.every((item) => item.stop == null)
    colors.forEach((item, idx) => {
      const stop = inferredStops ? idx / Math.max(1, colors.length - 1) : (item.stop ?? idx / colors.length)
      colorStops.push(stop, item.color)
    })

    const angleRad = ((angleDeg - 90) * Math.PI) / 180
    const halfDiagonal = Math.sqrt(width * width + height * height) / 2
    const cx = width / 2
    const cy = height / 2
    const dx = Math.cos(angleRad) * halfDiagonal
    const dy = Math.sin(angleRad) * halfDiagonal

    return {
      colorStops,
      start: { x: cx - dx, y: cy - dy },
      end: { x: cx + dx, y: cy + dy }
    }
  }

  const resolveBackgroundColor = (value: any) => {
    if (!value) return DEFAULT_SLIDE_BG
    if (typeof value === 'string') return value
    if (typeof value === 'object') {
      if (value.color) return value.color
      if (value.fill) return value.fill
      if (value.background) return value.background
    }
    return DEFAULT_SLIDE_BG
  }

  const applyBackgroundToStage = (value: any) => {
    if (!_backgroundRect) return
    const width = _slideWidth || DEFAULT_SLIDE_WIDTH
    const height = _slideHeight || DEFAULT_SLIDE_HEIGHT
    _backgroundRect.size({ width, height })

    if (typeof value === 'string' && value.toLowerCase().includes('linear-gradient')) {
      const gradient = parseLinearGradient(value, width, height)
      if (gradient) {
        _backgroundRect.fill(null)
        _backgroundRect.fillLinearGradientStartPoint(gradient.start)
        _backgroundRect.fillLinearGradientEndPoint(gradient.end)
        _backgroundRect.fillLinearGradientColorStops(gradient.colorStops)
        _backgroundLayer?.batchDraw()
        return
      }
    }

    if (typeof value === 'object' && (value?.type || value?.Type) && (value?.stops || value?.Stops)) {
      const rawStops = value.stops || value.Stops
      const angleRaw = value.angle ?? value.Angle
      const angleDeg =
        typeof angleRaw === 'number' && Number.isFinite(angleRaw) ? angleRaw : 180
      const stops = (Array.isArray(rawStops) ? rawStops : [])
        .map((stop) => {
          const position =
            typeof stop?.position === 'number'
              ? stop.position
              : typeof stop?.Position === 'number'
                ? stop.Position
                : stop?.offset
          const color = stop?.color ?? stop?.Color
          if (typeof position !== 'number' || !color) return null
          return [Math.max(0, Math.min(1, position)), color]
        })
        .filter(Boolean)
        .flat()
      if (stops.length >= 4) {
        const angleRad = ((angleDeg - 90) * Math.PI) / 180
        const halfDiagonal = Math.sqrt(width * width + height * height) / 2
        const cx = width / 2
        const cy = height / 2
        const dx = Math.cos(angleRad) * halfDiagonal
        const dy = Math.sin(angleRad) * halfDiagonal
        _backgroundRect.fill(null)
        _backgroundRect.fillLinearGradientStartPoint({ x: cx - dx, y: cy - dy })
        _backgroundRect.fillLinearGradientEndPoint({ x: cx + dx, y: cy + dy })
        _backgroundRect.fillLinearGradientColorStops(stops as number[])
        _backgroundLayer?.batchDraw()
        return
      }
    }

    _backgroundRect.fill(resolveBackgroundColor(value))
    _backgroundRect.fillLinearGradientColorStops([])
    _backgroundLayer?.batchDraw()
  }

  let _metaObserver: ((event: any) => void) | null = null

  function updateSelectionBounds() {
    const selectedNodes = _shapeList
      .filter((shape) => shape.selected)
      .map((shape) => _nodeMap.get(shape.id))
      .filter(Boolean) as Konva.Node[]

    if (selectedNodes.length === 0) {
      _selectionBounds = null
      return
    }

    const rects = selectedNodes.map((node) => node.getClientRect({ relativeTo: _layer }))
    const minX = Math.min(...rects.map((r) => r.x))
    const minY = Math.min(...rects.map((r) => r.y))
    const maxX = Math.max(...rects.map((r) => r.x + r.width))
    const maxY = Math.max(...rects.map((r) => r.y + r.height))
    _selectionBounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }

  /* function sync() {
    shapeList = Array.from(shapes.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => a.z - b.z)
  } */

  function getOrCreateTextFragment(texts: Y.Map<any>, id: string): Y.XmlFragment {
    let frag = texts.get(id)
    // return frag

    if (!frag || !(frag instanceof Y.XmlFragment)) {
      frag = new Y.XmlFragment()
      texts.set(id, frag)
    }

    return frag
  }

  /*   function updateSelection(selectedIds: string[]) {
  const nodes = selectedIds
    .map(id => nodeById.get(id)) // Map<string, Konva.Node>
    .filter(Boolean)

  transformer.nodes(nodes)
  layer.batchDraw()
} */

  /*   _$_slidesCommands.subscribe((commands) => {
    console.log('command _slidesCommands', { commands })

    if (!commands) return

    const ids = commands.getSelectedIds()
    if (ids.length <= 0) return
    const nodes = ids.map((id) => _nodeMap.get(id)).filter(Boolean)

    _transformer.nodes(nodes)
    _layer.batchDraw()
  }) */

  onMount(() => {
    _stage = new Konva.Stage({
      container: _container,
      width: _slideWidth,
      // width: __slideWidth || __maxPageWidth || DEFAULT_SLIDE_WIDTH,
      // width: 1280,
      height: _slideHeight
      // height: __slideHeight || DEFAULT_SLIDE_HEIGHT
      // height: __slideHeight || __maxPageHeight || DEFAULT_SLIDE_HEIGHT
    })

    _backgroundLayer = new Konva.Layer()
    _backgroundRect = new Konva.Rect({
      x: 0,
      y: 0,
      width: _slideWidth,
      height: _slideHeight,
      fill: resolveBackgroundColor(_slideBackground),
      listening: false
    })
    _backgroundLayer.add(_backgroundRect)

    _masterLayer = new Konva.Layer()
    _layer = new Konva.Layer()
    _stage.add(_backgroundLayer)
    _stage.add(_masterLayer)
    _stage.add(_layer)
    _stage.container().tabIndex = 0
    _stage.container().addEventListener('pointerdown', () => {
      _stage.container().focus()
    })

    const centerAbsolutePosition = EditorExtensionHelpers.centerAbsolute(
      __maxPageWidth,
      __maxPageHeight,
      _slideWidth,
      _slideHeight
    )

    _positionLeft = centerAbsolutePosition.left
    _positionTop = centerAbsolutePosition.top

    /* console.log(
      'yes focus registerNodeview 1',
      __wysiwygEditorIdToUpdate,
      _$_wysiwygEditorsList.getList(),
      _$_wysiwygEditorsList.getEntry(__wysiwygEditorIdToUpdate)
    ) */

    /* // Register the nodeview
    _$_wysiwygEditorsList.registerNodeview(__wysiwygEditorIdToUpdate, {
      id: __slideId,
      type: CustomSlideExtensionProps.name,
            collaborativeCanvas:_design,

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

    _stage.on('pointerdown', (e) => {
      if (e.target === _stage) {
        // const cmds = get(_$_slidesCommands)
        const cmds = _$_slidesCommands.get(__slideId)
        cmds?.unselect()
      }
    })
    _stage.container().addEventListener('focus', (e) => {
      console.log('yes focus', e)
      // Set this nodeview as active
      _$_wysiwygEditorsList.setActiveNodeview(
        __wysiwygEditorIdToUpdate,
        // _$_wysiwygEditorsList.getActiveEntry().id
        __slideId
      )
      console.log('yes focus active', _$_wysiwygEditorsList.getActiveEntry())
    })
    _stage.container().addEventListener('blur', (e) => {
      console.log('yes blur', e)
       // Unset this slide
    // _$_wysiwygEditorsList.unsetActiveNodeview(__wysiwygEditorIdToUpdate, __slideId)

    }) */

    // Add smart snapping
    smartSnapping(_stage, _layer)

    __onCreate?.(_stage.width(), _stage.height())

    sync()
    __shapes.observe(sync)
    if (__meta) {
      syncMeta()
      _metaObserver = () => syncMeta()
      __meta.observe(_metaObserver)
    }
    _stage.on('dragmove transform', () => {
      updateSelectionBounds()
    })

    _stage.on('pointerdown', (e) => {
      if (e.target === _stage) {
        __onSelect?.(null, e.evt as MouseEvent)
      }
    })

    const container = _stage.container()
    container.addEventListener('keydown', (e) => {
      const activeElement = document.activeElement
      const isTyping = activeElement && (activeElement as HTMLElement).closest?.('.text')
      if (isTyping) return

      const move = e.shiftKey ? 10 : 1
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const selected = _shapeList.filter((shape) => shape.selected)
        selected.forEach((shape) => {
          const next = { x: shape.x, y: shape.y }
          if (e.key === 'ArrowUp') next.y -= move
          if (e.key === 'ArrowDown') next.y += move
          if (e.key === 'ArrowLeft') next.x -= move
          if (e.key === 'ArrowRight') next.x += move
          __shapes.set(shape.id, { ...shape, ...next })
        })
      }
    })

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
    })

    _transformer.on('transformend', () => {
      const cmds = get(_$_slidesCommands)
      if (!cmds) return

      _transformer.nodes().forEach((node) => {
        const id = [..._nodeMap.entries()].find(([, n]) => n === node)?.[0]

        if (!id) return

        cmds.updateShape(id, {
          x: node.x(),
          y: node.y(),
          w: node.width() * node.scaleX(),
          h: node.height() * node.scaleY()
        })

        node.scaleX(1)
        node.scaleY(1)
      })

      _layer.batchDraw()
    })

    _layer.add(_transformer) */

    // shapeList.forEach(shape => {
    // add Konva group for each shape
    // Mount each TextShape into the same container
    /* shapeList.forEach((shape) => {
      mount(TextShape, {
        target: container, // HTML overlay container
        props: {
          __shape: shape,
          __layer: layer,
          __yText: getOrCreateTextFragment(__texts, shape.id),
          __awareness,
          __onSelect: () => __onSelect?.(shape.id)
        }
      })
    }) */
    // })
  })

  $effect(() => {
    if (!_stage) return
    _stage.width(_slideWidth)
    _stage.height(_slideHeight)
    applyBackgroundToStage(_slideBackground)
  })

  onDestroy(() => {
    if (__meta && _metaObserver) {
      __meta.unobserve(_metaObserver)
      _metaObserver = null
    }
  })
</script>

<!-- <div class="relative w-full h-full"> -->
<div
  class="slide-absolute node-view-{CustomSlideExtensionProps.name}-content node-view-content {_layoutIsOverlay
    ? 'absolute'
    : ''} w-[{_slideWidth}px] h-[{_slideHeight}px] top-[{_positionTop}px] left-[{_positionLeft}px]"
  style={`background: ${typeof _slideBackground === 'string' ? _slideBackground : DEFAULT_SLIDE_BG};`}
>
  <!-- {__maxPageWidth},
  {__maxPageHeight},
  {_slideWidth},
  {_slideHeight} -->
  <!-- <div
    bind:this={_container}
    class="items-center max-w-[{__maxPageWidth}px]
   max-h-[{__maxPageHeight}px] h-full
   m-auto
   "
  >  -->
  <div
    bind:this={_container}
    class="items-center h-full m-auto
   "
  ></div>

  {#each _masterElements as masterShape (masterShape.id)}
    <ShapeNode
      {__slideId}
      {__slidePath}
      __stage={_stage}
      __shape={masterShape}
      __layer={_masterLayer}
      __nodeMap={_nodeMap}
      __locked={true}
    />
  {/each}

  {#each _shapeList as shape (shape.id)}
    {#if !shape.type || shape.type === ShapeType.Text}
      <TextShape
        {__slideId}
        {__slidePath}
        __stage={_stage}
        __shape={shape}
        __layer={_layer}
        __nodeMap={_nodeMap}
        {__provider}
        __yText={getOrCreateTextFragment(__texts, shape.id)}
        {__awareness}
        __onSelect={(id, ev) => __onSelect?.(id || shape.id, ev)}
      />
    {:else}
      <ShapeNode
        {__slideId}
        {__slidePath}
        __stage={_stage}
        __shape={shape}
        __layer={_layer}
        __nodeMap={_nodeMap}
        __yText={getOrCreateTextFragment(__texts, shape.id)}
        __onSelect={(id, ev) => __onSelect?.(id || shape.id, ev)}
      />
    {/if}
  {/each}

  {#if _selectionBounds}
    <div
      class="slide-mini-toolbar"
      style="
        left: {_selectionBounds.x + _selectionBounds.width / 2}px;
        top: {_selectionBounds.y - 36}px;
      "
    >
      <button class="mini-btn" onclick={() => GenericFormatingEditorCommands.bold()}>
        B
      </button>
      <button class="mini-btn" onclick={() => GenericFormatingEditorCommands.italic()}>
        I
      </button>
      <button class="mini-btn" onclick={() => GenericFormatingEditorCommands.underline()}>
        U
      </button>
      <div class="mini-sep"></div>
      <button class="mini-btn" onclick={() => GenericFormatingEditorCommands.formatPainter()}>
        FP
      </button>
    </div>
  {/if}
</div>

<style>
  .slide-absolute {
    /* position: absolute; */
    /* left: -20%; */
    /* width: 1000px;
    height: 500px; */
    max-width: none !important;
    max-height: none !important;
    /* background: red; */
    /* background: white;
    width: 1280px;
    height: 720px; */
  }
  .slide-mini-toolbar {
    position: absolute;
    transform: translate(-50%, -100%);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 10px;
    background: rgba(20, 20, 20, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
    z-index: 50;
  }
  .mini-btn {
    width: 22px;
    height: 22px;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
  }
  .mini-btn:hover {
    background: rgba(255, 255, 255, 0.18);
  }
  .mini-sep {
    width: 1px;
    height: 18px;
    background: rgba(255, 255, 255, 0.15);
  }
</style>
