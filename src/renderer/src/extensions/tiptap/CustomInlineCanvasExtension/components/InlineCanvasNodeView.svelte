<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { NodeViewWrapper } from 'svelte-tiptap'
  import type { Shape } from '../../../../utils/canvas.types'
  import { ShapeType } from '../../../../utils/canvas.types'

  interface Props {
    node?: any
    updateAttributes?: (attrs: Record<string, any>) => void
    selected?: boolean
  }

  let { node, updateAttributes, selected = false }: Props = $props()

  let _nodeViewRoot: HTMLSpanElement | null = null
  let _containerEl: HTMLDivElement | null = null
  let _stage: any = null
  let _layer: any = null
  let _transformer: any = null
  let _isEditing = $state(false)
  let _shapeMap = new Map<string, any>()
  let _lastSerialized = ''

  const shapes = $derived((node?.attrs?.shapes || []) as Shape[])
  const width = $derived(Number(node?.attrs?.width || 280))
  const height = $derived(Number(node?.attrs?.height || 180))
  const floatMode = $derived((node?.attrs?.float || 'left') as 'left' | 'right' | 'none')
  const wrapMargin = $derived(Number(node?.attrs?.wrapMargin || 12))

  const wrapperStyle = $derived(() => {
    const floatValue = floatMode === 'none' ? 'none' : floatMode
    const margin = `${wrapMargin}px`
    return [
      `float: ${floatValue};`,
      `margin: ${margin};`,
      `width: ${width}px;`,
      `height: ${height}px;`,
      'shape-outside: inset(0 round 6px);'
    ].join(' ')
  })

  const ensureKonva = async () => {
    const mod = await import('konva')
    return mod.default || mod
  }

  const createKonvaNode = (Konva: any, shape: Shape) => {
    const base = {
      id: shape.id,
      x: shape.x || 0,
      y: shape.y || 0,
      width: shape.w || 80,
      height: shape.h || 60,
      fill: shape.fill || '#e6e6e6',
      stroke: '#333',
      strokeWidth: 1,
      draggable: _isEditing
    }

    switch (shape.type) {
      case ShapeType.Circle:
        return new Konva.Circle({
          id: shape.id,
          x: (shape.x || 0) + (shape.w || 80) / 2,
          y: (shape.y || 0) + (shape.h || 80) / 2,
          radius: Math.min(shape.w || 80, shape.h || 80) / 2,
          fill: base.fill,
          stroke: base.stroke,
          strokeWidth: 1,
          draggable: _isEditing
        })
      case ShapeType.Ellipse:
        return new Konva.Ellipse({
          id: shape.id,
          x: (shape.x || 0) + (shape.w || 80) / 2,
          y: (shape.y || 0) + (shape.h || 60) / 2,
          radiusX: (shape.w || 80) / 2,
          radiusY: (shape.h || 60) / 2,
          fill: base.fill,
          stroke: base.stroke,
          strokeWidth: 1,
          draggable: _isEditing
        })
      case ShapeType.Triangle:
        return new Konva.RegularPolygon({
          id: shape.id,
          x: (shape.x || 0) + (shape.w || 80) / 2,
          y: (shape.y || 0) + (shape.h || 80) / 2,
          sides: 3,
          radius: Math.min(shape.w || 80, shape.h || 80) / 2,
          fill: base.fill,
          stroke: base.stroke,
          strokeWidth: 1,
          draggable: _isEditing
        })
      case ShapeType.Text:
        return new Konva.Text({
          id: shape.id,
          x: base.x,
          y: base.y,
          width: base.width,
          height: base.height,
          text: shape.content?.value || 'Text',
          fontSize: 16,
          fill: '#333',
          draggable: _isEditing
        })
      case ShapeType.Rect:
      default:
        return new Konva.Rect(base)
    }
  }

  const loadShapes = async () => {
    if (!_containerEl) return
    const Konva = await ensureKonva()

    if (!_stage) {
      _stage = new Konva.Stage({
        container: _containerEl,
        width,
        height
      })
      _layer = new Konva.Layer()
      _stage.add(_layer)
      _transformer = new Konva.Transformer({
        rotateEnabled: true,
        borderStroke: 'var(--color-base-300)',
        anchorFill: '#ffffff',
        anchorStroke: 'var(--color-base-300)',
        anchorCornerRadius: 2
      })
      _layer.add(_transformer)

      _stage.on('mousedown', (e) => {
        if (!_isEditing) return
        if (e.target === _stage) {
          _transformer.nodes([])
          _layer.draw()
          return
        }
        const node = e.target
        if (!node) return
        _transformer.nodes([node])
        _layer.draw()
      })
    }

    _layer?.destroyChildren()
    _shapeMap.clear()

    shapes.forEach((shape) => {
      const node = createKonvaNode(Konva, shape)
      if (!node) return
      node.on('dragend transformend', () => {
        syncShapesToAttrs()
      })
      _shapeMap.set(shape.id, node)
      _layer.add(node)
    })
    _layer.add(_transformer)
    _layer.draw()
    _lastSerialized = JSON.stringify(shapes)
  }

  const syncShapesToAttrs = () => {
    if (!_shapeMap.size) return
    const updated: Shape[] = []
    _shapeMap.forEach((node, id) => {
      const shape = shapes.find((s) => s.id === id) || { id } as Shape
      let x = node.x()
      let y = node.y()
      let w = node.width?.() || shape.w || 0
      let h = node.height?.() || shape.h || 0

      if (node.getClassName?.() === 'Circle') {
        const radius = node.radius?.() || Math.min(w, h) / 2
        w = radius * 2
        h = radius * 2
        x = node.x() - radius
        y = node.y() - radius
      }
      if (node.getClassName?.() === 'Ellipse') {
        const rx = node.radiusX?.() || w / 2
        const ry = node.radiusY?.() || h / 2
        w = rx * 2
        h = ry * 2
        x = node.x() - rx
        y = node.y() - ry
      }

      updated.push({
        ...shape,
        x,
        y,
        w,
        h,
        fill: node.fill?.() || shape.fill
      })
    })

    const nextSerialized = JSON.stringify(updated)
    if (nextSerialized === _lastSerialized) return
    _lastSerialized = nextSerialized
    updateAttributes?.({ shapes: updated })
  }

  const addShape = async (type: ShapeType) => {
    const next: Shape = {
      id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      name: 'Shape',
      type,
      x: 24,
      y: 24,
      w: type === ShapeType.Circle ? 120 : 160,
      h: type === ShapeType.Circle ? 120 : 100,
      z: shapes.length,
      fill: '#e6e6e6',
      visible: true,
      selected: false
    }
    updateAttributes?.({ shapes: [...shapes, next] })
    await loadShapes()
  }

  const toggleEdit = () => {
    _isEditing = !_isEditing
    if (!_isEditing) {
      _transformer?.nodes([])
    }
    _shapeMap.forEach((node) => node.draggable(_isEditing))
  }

  const setFloat = (value: 'left' | 'right' | 'none') => {
    updateAttributes?.({ float: value })
  }

  $effect(() => {
    if (!_stage) return
    _stage.width(width)
    _stage.height(height)
    _stage.draw()
  })

  $effect(() => {
    if (!_stage) return
    const serialized = JSON.stringify(shapes)
    if (serialized !== _lastSerialized) {
      loadShapes()
    }
  })

  onMount(async () => {
    await loadShapes()
  })

  onDestroy(() => {
    try {
      _stage?.destroy()
    } catch {
      // ignore
    }
  })
</script>

<NodeViewWrapper as="span" class="inline-canvas-node" bind:this={_nodeViewRoot}>
  <span
    class="inline-canvas-wrap {selected ? 'inline-canvas-selected' : ''}"
    style={wrapperStyle}
    ondblclick={() => toggleEdit()}
  >
    <div class="inline-canvas-stage" bind:this={_containerEl}></div>

    {#if _isEditing}
      <div class="inline-canvas-toolbar">
        <button class="inline-canvas-btn" onclick={() => addShape(ShapeType.Rect)}>▭</button>
        <button class="inline-canvas-btn" onclick={() => addShape(ShapeType.Circle)}>◯</button>
        <button class="inline-canvas-btn" onclick={() => addShape(ShapeType.Triangle)}>△</button>
        <div class="inline-canvas-divider"></div>
        <button class="inline-canvas-btn" onclick={() => setFloat('left')}>Wrap Left</button>
        <button class="inline-canvas-btn" onclick={() => setFloat('right')}>Wrap Right</button>
        <button class="inline-canvas-btn" onclick={() => setFloat('none')}>Inline</button>
        <button class="inline-canvas-btn inline-canvas-done" onclick={() => toggleEdit()}>Done</button>
      </div>
    {/if}
  </span>
</NodeViewWrapper>

<style>
  .inline-canvas-node {
    display: inline;
  }
  .inline-canvas-wrap {
    position: relative;
    display: inline-block;
    vertical-align: middle;
    border-radius: 6px;
    background: #fff;
    user-select: none;
  }
  .inline-canvas-wrap::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 1px solid rgba(0, 0, 0, 0.08);
    pointer-events: none;
    border-radius: 6px;
  }
  .inline-canvas-selected::after {
    border-color: var(--color-base-300);
    box-shadow: 0 0 0 1px rgba(0, 190, 172, 0.45);
  }
  .inline-canvas-stage {
    width: 100%;
    height: 100%;
  }
  .inline-canvas-toolbar {
    position: absolute;
    top: -36px;
    left: 0;
    display: flex;
    gap: 6px;
    padding: 4px 6px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 8px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
    z-index: 5;
  }
  .inline-canvas-btn {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    background: #fff;
    cursor: pointer;
  }
  .inline-canvas-btn:hover {
    background: #f4f4f4;
  }
  .inline-canvas-done {
    color: #d64545;
    font-weight: 600;
  }
  .inline-canvas-divider {
    width: 1px;
    background: rgba(0, 0, 0, 0.1);
    margin: 0 4px;
  }
</style>
