<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import Konva from 'konva'
  import * as Y from 'yjs'
  import { gsap } from 'gsap'

  import type { Shape } from '../../../../../utils/canvas.types'
  import { ShapeType } from '../../../../../utils/canvas.types'
  import { _$_canvasCommands } from '../../../../../stores/canvas.store'
  import type { CanvasCommands } from '../../../../../commands/canvasCommands.types'
  import { CustomFileExtensionProps } from '../../../CustomFileFolderExtension/utils/common.utils'
  import { toAssetUrl } from '../../../../../utils/assetUrl'

  interface Props {
    __slideId: string
    __slidePath: string
    __stage: Konva.Stage
    __shape: Shape
    __layer: Konva.Layer
    __nodeMap: Map<string, Konva.Node>
    __yText?: Y.XmlFragment
    __onSelect?: (id: string, evt?: MouseEvent) => void
    __locked?: boolean
  }

  let {
    __slideId,
    __slidePath,
    __stage,
    __shape,
    __layer,
    __nodeMap,
    __yText,
    __onSelect,
    __locked = false
  }: Props = $props()

  let _group: Konva.Group | null = $state(null)
  let _node: Konva.Node | null = $state(null)
  let _transformer: Konva.Transformer | null = $state(null)
  let _imageEl: HTMLImageElement | null = null
  let _lastAnimationKey = ''
  let slideCommands: CanvasCommands | null = null
  let _unsubscribe: (() => void) | null = null

  // toAssetUrl already passes http(s), blob: and data: through untouched and
  // turns a bare path into a ddoc://asset URL, which is what this did.
  const normalizeFileUrl = (value: string) => toAssetUrl(value)

  const extractFileSrc = () => {
    if (__shape?.src) return __shape.src
    if (!__yText) return ''
    const nodes = __yText.toArray()
    for (const node of nodes) {
      if (node instanceof Y.XmlElement) {
        const src = node.getAttribute(CustomFileExtensionProps.attributeSrc)
        if (src) return src
      }
    }
    return ''
  }

  const resolveFill = () => (__shape?.fill ? __shape.fill : 'transparent')
  const resolveStroke = () => (__shape?.stroke ? __shape.stroke : undefined)
  const resolveStrokeWidth = () =>
    typeof __shape?.strokeWidth === 'number' ? __shape.strokeWidth : __shape?.stroke ? 1 : 0

  function buildNode() {
    if (!__shape) return null
    const type = __shape.type
    if (type === ShapeType.File) {
      const image = new Konva.Image({
        width: __shape.w,
        height: __shape.h
      })
      const src = normalizeFileUrl(extractFileSrc())
      if (src) {
        _imageEl = new Image()
        _imageEl.onload = () => {
          image.image(_imageEl)
          __layer?.batchDraw()
        }
        _imageEl.src = src
      }
      return image
    }

    if (type === ShapeType.Line) {
      return new Konva.Line({
        points: [0, 0, __shape.w, __shape.h],
        stroke: resolveStroke() ?? '#111827',
        strokeWidth: resolveStrokeWidth(),
        lineCap: 'round',
        lineJoin: 'round'
      })
    }

    if (type === ShapeType.Ellipse || type === ShapeType.Circle) {
      return new Konva.Ellipse({
        x: __shape.w / 2,
        y: __shape.h / 2,
        radiusX: Math.max(1, __shape.w / 2),
        radiusY: Math.max(1, __shape.h / 2),
        fill: resolveFill(),
        stroke: resolveStroke(),
        strokeWidth: resolveStrokeWidth()
      })
    }

    if (type === ShapeType.Triangle) {
      const radius = Math.max(4, Math.min(__shape.w, __shape.h) / 2)
      return new Konva.RegularPolygon({
        x: __shape.w / 2,
        y: __shape.h / 2,
        sides: 3,
        radius,
        fill: resolveFill(),
        stroke: resolveStroke(),
        strokeWidth: resolveStrokeWidth()
      })
    }

    return new Konva.Rect({
      width: __shape.w,
      height: __shape.h,
      fill: resolveFill(),
      stroke: resolveStroke(),
      strokeWidth: resolveStrokeWidth(),
      cornerRadius: __shape?.cornerRadius || 0
    })
  }

  function syncNodeProps() {
    if (!_group || !_node || !__shape) return
    _group.position({ x: __shape.x, y: __shape.y })
    _group.rotation(__shape.rotation || 0)
    _group.zIndex(__shape.z ?? 0)

    if (_node instanceof Konva.Line) {
      _node.points([0, 0, __shape.w, __shape.h])
      _node.stroke(resolveStroke() ?? '#111827')
      _node.strokeWidth(resolveStrokeWidth())
    } else if (_node instanceof Konva.Ellipse) {
      _node.position({ x: __shape.w / 2, y: __shape.h / 2 })
      _node.radius({ x: Math.max(1, __shape.w / 2), y: Math.max(1, __shape.h / 2) })
      _node.fill(resolveFill())
      _node.stroke(resolveStroke())
      _node.strokeWidth(resolveStrokeWidth())
    } else if (_node instanceof Konva.RegularPolygon) {
      _node.position({ x: __shape.w / 2, y: __shape.h / 2 })
      _node.radius(Math.max(4, Math.min(__shape.w, __shape.h) / 2))
      _node.fill(resolveFill())
      _node.stroke(resolveStroke())
      _node.strokeWidth(resolveStrokeWidth())
    } else if (_node instanceof Konva.Image) {
      _node.size({ width: __shape.w, height: __shape.h })
      const src = normalizeFileUrl(extractFileSrc())
      if (src && (!_imageEl || _imageEl.src !== src)) {
        _imageEl = new Image()
        _imageEl.onload = () => {
          _node?.image(_imageEl)
          __layer?.batchDraw()
        }
        _imageEl.src = src
      }
    } else if (_node instanceof Konva.Rect) {
      _node.size({ width: __shape.w, height: __shape.h })
      _node.fill(resolveFill())
      _node.stroke(resolveStroke())
      _node.strokeWidth(resolveStrokeWidth())
      _node.cornerRadius(__shape?.cornerRadius || 0)
    }

    __layer?.batchDraw()
  }

  function showTransformer() {
    if (__locked || !_group || !_layer) return
    if (!_transformer) {
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
        boundBoxFunc: (oldBox, newBox) => {
          if (newBox.width < 12) newBox.width = 12
          if (newBox.height < 12) newBox.height = 12
          return newBox
        }
      })
      _layer.add(_transformer)
    }
    _transformer.nodes([_group])
    _layer.batchDraw()
  }

  function hideTransformer() {
    if (_transformer) {
      _transformer.nodes([])
      _layer?.batchDraw()
    }
  }

  function commitTransform() {
    if (!slideCommands || !_group || !_node) return
    const nextW = Math.max(2, (__shape.w || 1) * _group.scaleX())
    const nextH = Math.max(2, (__shape.h || 1) * _group.scaleY())
    const nextRotation = _group.rotation() || 0

    _group.scaleX(1)
    _group.scaleY(1)
    slideCommands.updateShape(__shape.id, {
      x: _group.x(),
      y: _group.y(),
      w: nextW,
      h: nextH,
      rotation: nextRotation
    })
  }

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

    const run = () => {
      if (type.includes('zoom')) {
        gsap.fromTo(target, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration, delay })
      } else if (type.includes('fly') || type.includes('slide') || type.includes('push')) {
        gsap.from(target, { x: target.x() - 80, opacity: 0, duration, delay, ease: 'power2.out' })
      } else {
        gsap.fromTo(target, { opacity: 0 }, { opacity: 1, duration, delay })
      }
    }

    if (start === 'on-click') {
      const handler = () => {
        run()
        _group?.off('click', handler)
      }
      _group.on('click', handler)
      return
    }

    run()
  }

  $effect(() => {
    if (!_group || !_node || !__shape) return
    syncNodeProps()
  })

  $effect(() => {
    if (!__shape) return
    if (__shape.selected) {
      showTransformer()
    } else {
      hideTransformer()
    }
  })

  $effect(() => {
    if (!__shape?.animation) return
    runAnimation()
  })

  onMount(() => {
    _unsubscribe = _$_canvasCommands.subscribeById(__slideId).subscribe((value) => {
      slideCommands = value
    })

    _group = new Konva.Group({
      x: __shape.x,
      y: __shape.y,
      draggable: !__locked,
      name: 'object'
    })

    _node = buildNode()
    if (_node) {
      _group.add(_node)
    }

    __layer.add(_group)
    __nodeMap.set(__shape.id, _group)

    _group.on('mousedown tap', (e) => {
      if (__locked) return
      __onSelect?.(__shape.id, e?.evt)
    })

    _group.on('dragend', () => {
      if (__locked) return
      slideCommands?.updateShape(__shape.id, {
        x: _group?.x() ?? __shape.x,
        y: _group?.y() ?? __shape.y
      })
    })

    _group.on('transformend', () => {
      if (__locked) return
      commitTransform()
    })

  })

  onDestroy(() => {
    _unsubscribe?.()
    _transformer?.destroy()
    _transformer = null
    _group?.destroy()
    _nodeMap?.delete(__shape.id)
  })
</script>
