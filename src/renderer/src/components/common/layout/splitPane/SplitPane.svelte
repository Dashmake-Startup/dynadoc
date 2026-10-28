
<!-- 
Usage example 
<SplitPane direction="horizontal" __id="main-layout">
  <div data-initial="20" data-min="10" data-max="40" class="bg-[#252526]">
    <ActivityBar />
  </div>

  <div data-initial="60" data-min="30" class="bg-[#1e1e1e]">
    <SplitPane direction="vertical" __id="editor-bottom-split">
      <div data-initial="70" class="overflow-auto">
        <CodeEditor />
      </div>
      <div data-initial="30" data-min="10" class="bg-[#181818] border-t border-white/5">
        <Terminal />
      </div>
    </SplitPane>
  </div>

  <div data-initial="20" data-min="15" class="bg-base-200">
    <SecondarySideBar />
  </div>
</SplitPane>
-->
<script>
  import { _ } from 'svelte-i18n'
  import { onDestroy, onMount, tick } from 'svelte';

  // --- Props using Svelte 5 pattern ---
  let { 
    direction = 'horizontal', 
    __id = '', 
    children 
  } = $props();

  // --- State Runes ---
  let container = $state();
  let items = $state([]);
  let isDragging = $state(false);
  let activeIndex = $state(null);
  let mutationObserver = $state(null);
  let savedSizes = $state([]);

  // Computed: Calculate the sash positions based on item sizes
  let sashPositions = $derived.by(() => {
    let current = 0;
    return items.slice(0, -1).map(item => {
      current += item.size;
      return current;
    });
  });

  // Sync DOM styles whenever items state changes
  $effect(() => {
    if (items.length > 0) {
      items.forEach((item) => {
        const prop = direction === 'horizontal' ? 'width' : 'height';
        item.el.style[prop] = `${item.size}%`;
        item.el.style.flex = 'none';
        item.el.style.minWidth = '0';
        item.el.style.minHeight = '0';
      });
    }
  });

  function normalizeItems(nextItems) {
    if (nextItems.length === 0) return [];
    if (nextItems.length === 1) return [{ ...nextItems[0], size: 100 }];

    const total = nextItems.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
    const safeTotal = total > 0 ? total : nextItems.length;
    return nextItems.map((item) => ({
      ...item,
      size: ((Number(item.size) || 1) / safeTotal) * 100
    }));
  }

  function collectPaneElements() {
    if (!container) return [];
    return Array.from(container.children).filter((el) => !el.classList.contains('sash'));
  }

  function syncItems() {
    const paneElements = collectPaneElements();
    const previousByElement = new Map(items.map((item) => [item.el, item]));

    const nextItems = paneElements.map((el, index) => {
      const previous = previousByElement.get(el);
      const initialAttr = parseFloat(el.dataset.initial);
      const defaultSize = initialAttr || (100 / Math.max(paneElements.length, 1));

      return {
        el,
        size: previous?.size ?? savedSizes[index] ?? defaultSize,
        min: parseFloat(el.dataset.min) || 5,
        max: parseFloat(el.dataset.max) || 95
      };
    });

    items = normalizeItems(nextItems);
  }

  onMount(async () => {
    await tick();

    if (__id) {
      const saved = localStorage.getItem(`layout-size-${__id}`);
      if (saved) savedSizes = JSON.parse(saved);
    }

    syncItems();

    mutationObserver = new MutationObserver(() => {
      syncItems();
    });

    mutationObserver.observe(container, {
      childList: true
    });
  });

  onDestroy(() => {
    mutationObserver?.disconnect?.();
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', stopDrag);
    document.body.style.cursor = 'default';
  });

  function startDrag(index) {
    isDragging = true;
    activeIndex = index;
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
  }

  function onDrag(e) {
    if (!isDragging || activeIndex === null) return;

    const rect = container.getBoundingClientRect();
    const totalSize = direction === 'horizontal' ? rect.width : rect.height;
    const mousePos = direction === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top;
    const mousePercent = (mousePos / totalSize) * 100;

    let offset = 0;
    for (let i = 0; i < activeIndex; i++) {
      offset += items[i].size;
    }

    const leftItem = items[activeIndex];
    const rightItem = items[activeIndex + 1];
    const combinedSize = leftItem.size + rightItem.size;
    
    const newLeftSize = mousePercent - offset;
    const newRightSize = combinedSize - newLeftSize;

    if (newLeftSize >= leftItem.min && newRightSize >= rightItem.min && 
        newLeftSize <= leftItem.max && newRightSize <= rightItem.max) {
      items[activeIndex].size = newLeftSize;
      items[activeIndex + 1].size = newRightSize;
    }
  }

  function stopDrag() {
    isDragging = false;
    activeIndex = null;
    if (__id) {
      localStorage.setItem(`layout-size-${__id}`, JSON.stringify(items.map(i => i.size)));
    }
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', stopDrag);
    document.body.style.cursor = 'default';
  }
</script>

<div
  bind:this={container}
  class="relative flex h-full w-full overflow-hidden bg-transparent {direction === 'horizontal' ? 'flex-row' : 'flex-col'}"
>
  {@render children?.()}

  {#each sashPositions as position, i}
    <div
      class="sash group absolute z-50 flex items-center justify-center transition-colors duration-200"
      class:cursor-col-resize={direction === 'horizontal'}
      class:cursor-row-resize={direction === 'vertical'}
      style="{direction === 'horizontal' 
        ? `left: ${position}%; top: 0; bottom: 0; width: 6px; margin-left: -3px;` 
        : `top: ${position}%; left: 0; right: 0; height: 6px; margin-top: -3px;`}"
      onmousedown={() => startDrag(i)}
    >
      <div class="pointer-events-none transition-all duration-200 
        {direction === 'horizontal' ? 'w-[1px] h-full' : 'h-[1px] w-full'} 
        bg-base-300/75 group-hover:bg-base-300 {isDragging && activeIndex === i ? 'bg-base-300 scale-x-150' : ''}">
      </div>
    </div>
  {/each}
</div>
