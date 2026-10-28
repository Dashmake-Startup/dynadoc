<script lang="ts">
  import { onMount } from 'svelte'
  import { _ } from 'svelte-i18n'

  // Svelte 5 Props
  let {
    __width = $bindable(null),
    __height = $bindable(null),
    __minWidth = 200,
    __minHeight = 0,
    __maxWidth = Infinity,
    __maxHeight = Infinity,
    __resizable = true,
    __direction = 'both', // "horizontal" | "vertical" | "both"
    __lockAspectRatio = $bindable(false),
    __onUpdate = null
    // __children
  } = $props()

  // Internal State
  let resizing = $state(false)
  let resizeDir = $state<string | null>(null)
  let startX = 0,
    startY = 0,
    startW = 0,
    startH = 0
  let aspectRatio = $state(__width / __height)
  let _rootEl: HTMLDivElement | null = null

  const isFiniteNumber = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value)

  const toPixelOrFull = (value: number | null | undefined) =>
    isFiniteNumber(value) ? `${value}px` : '100%'

  // Position for the Adobe-style dimension tooltip
  let mouseX = $state(0)
  let mouseY = $state(0)

  function startResize(e: MouseEvent, dir: string) {
    if (!__resizable) return
    e.preventDefault()
    e.stopPropagation()

    resizing = true
    resizeDir = dir
    startX = e.clientX
    startY = e.clientY
    if (!isFiniteNumber(__width)) {
      __width = _rootEl?.offsetWidth ?? __minWidth
    }
    if (!isFiniteNumber(__height)) {
      __height = _rootEl?.offsetHeight ?? __minHeight
    }
    startW = __width
    startH = __height
    aspectRatio = startW && startH ? startW / startH : 1

    window.addEventListener('mousemove', onResize)
    window.addEventListener('mouseup', stopResize)
  }

  function onResize(e: MouseEvent) {
    if (!resizing) return

    mouseX = e.clientX
    mouseY = e.clientY

    let deltaX = e.clientX - startX
    let deltaY = e.clientY - startY

    let newW = startW
    let newH = startH

    // __directional Calculation
    if (__direction === 'horizontal' || __direction === 'both') {
      if (resizeDir?.includes('right')) newW = startW + deltaX
      if (resizeDir?.includes('left')) newW = startW - deltaX
    }

    if (__direction === 'vertical' || __direction === 'both') {
      if (resizeDir?.includes('bottom')) newH = startH + deltaY
      if (resizeDir?.includes('top')) newH = startH - deltaY
    }

    // Aspect Ratio Logic
    if (__lockAspectRatio) {
      if (resizeDir === 'left' || resizeDir === 'right') {
        newH = newW / aspectRatio
      } else {
        newW = newH * aspectRatio
      }
    }

    // Constraints
    const maxW = isFiniteNumber(__maxWidth) ? __maxWidth : Number.POSITIVE_INFINITY
    const maxH = isFiniteNumber(__maxHeight) ? __maxHeight : Number.POSITIVE_INFINITY

    __width = Math.min(Math.max(newW, __minWidth), maxW) || __minWidth
    __height = Math.min(Math.max(newH, __minHeight), maxH) || __minHeight

    __onUpdate?.({ width: __width, height: __height })
  }

  function stopResize() {
    resizing = false
    resizeDir = null
    window.removeEventListener('mousemove', onResize)
    window.removeEventListener('mouseup', stopResize)
  }
</script>

<!-- {__maxWidth} {__maxHeight} -->
<!-- <div
  class="relative inline-block group select-none transition-shadow"
  class:ring-1={resizing}
  class:ring-primary={resizing}
  style:width={toPixelOrFull(__width)}
  style:height={toPixelOrFull(__height)}
  bind:this={_rootEl}
> -->

<div
  class="relative group select-none transition-shadow"
  class:ring-1={resizing}
  class:ring-primary={resizing}
  style:width={toPixelOrFull(__width)}
  style:height={startH && startH !== __minHeight ? toPixelOrFull(__height) : "fit-content;"}
  bind:this={_rootEl}
>
<!-- __height = {startH !== __minHeight ? toPixelOrFull(__height) : "fit-content;"}
__minHeight =  {__minHeight} __height =  {__height}  startH =  {startH} -->
  <div
    class="absolute -top-8 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20"
  >
    <button
      onclick={() => (__lockAspectRatio = !__lockAspectRatio)}
      class="p-1 rounded bg-base-200 border border-base-200 hover:bg-base-300 text-base-content transition-colors shadow-sm"
      title={$_('Toggle Aspect Ratio')}
    >
      <i class="ph-light {__lockAspectRatio ? 'ph-lock-simple' : 'ph-lock-simple-open'} text-[14px]"
      ></i>
    </button>
  </div>

  <!-- <div
    class="w-full h-full overflow-auto rounded-sm border border-base-200
    group-hover:border-primary/50 bg-base-100 shadow-sm transition-colors
    max-w-[{__maxWidth}px]
   max-h-[{__maxHeight}px]
    "
  > -->
  <div
    class="w-full h-full overflow-auto rounded-sm  border border-dashed dark:border-dark rounded-[5px]
     shadow-sm transition-colors
    "
    style={`max-width: ${toPixelOrFull(__maxWidth)}; max-height: ${toPixelOrFull(__maxHeight)};`}
  >
    <!-- {@render __children?.()} -->
    <slot />
  </div>

  {#if resizing}
    <div
      class="absolute inset-0 border-1 border-primary border-dashed pointer-events-none z-10"
    ></div>

    <div
      class="fixed z-50 pointer-events-none bg-neutral text-neutral-content text-[10px] font-mono px-1.5 py-0.5 rounded shadow-xl flex items-center gap-1"
      style:left="{mouseX + 15}px"
      style:top="{mouseY + 15}px"
    >
      <span>{Math.round(__width)}</span>
      <span class="opacity-40">×</span>
      <span>{Math.round(__height)}</span>
    </div>
  {/if}

  {#if __resizable}
    <div class="handles">
      <button onmousedown={(e) => startResize(e, 'top-left')} class="h-tl cursor-nwse-resize"
      ></button>
      <button onmousedown={(e) => startResize(e, 'top-right')} class="h-tr cursor-nesw-resize"
      ></button>
      <button onmousedown={(e) => startResize(e, 'bottom-left')} class="h-bl cursor-nesw-resize"
      ></button>
      <button onmousedown={(e) => startResize(e, 'bottom-right')} class="h-br cursor-nwse-resize"
      ></button>

      <button onmousedown={(e) => startResize(e, 'top')} class="e-t cursor-ns-resize"></button>
      <button onmousedown={(e) => startResize(e, 'bottom')} class="e-b cursor-ns-resize"></button>
      <button onmousedown={(e) => startResize(e, 'left')} class="e-l cursor-ew-resize"></button>
      <button onmousedown={(e) => startResize(e, 'right')} class="e-r cursor-ew-resize"></button>
    </div>
  {/if}
</div>

<style>
  /* Adobe 2025 "Precision" Handle Styles */
  .handles button {
    @apply absolute bg-transparent border-none p-0 z-30 transition-all;
  }

  /* Show corner points on hover */
  .group:hover .h-tl,
  .group:hover .h-tr,
  .group:hover .h-bl,
  .group:hover .h-br {
    @apply w-1.5 h-1.5 bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] border border-primary;
  }

  /* Corner Positions */
  .h-tl {
    top: -3px;
    left: -3px;
  }
  .h-tr {
    top: -3px;
    right: -3px;
  }
  .h-bl {
    bottom: -3px;
    left: -3px;
  }
  .h-br {
    bottom: -3px;
    right: -3px;
  }

  /* Edge Hit Areas (Invisible but large for UX) */
  .e-t,
  .e-b {
    left: 4px;
    right: 4px;
    height: 4px;
  }
  .e-l,
  .e-r {
    top: 4px;
    bottom: 4px;
    width: 4px;
  }

  .e-t {
    top: -2px;
  }
  .e-b {
    bottom: -2px;
  }
  .e-l {
    left: -2px;
  }
  .e-r {
    right: -2px;
  }

  /* Visual Feedback on Edge Hover */
  .handles button:hover {
    @apply bg-primary/20;
  }
</style>
