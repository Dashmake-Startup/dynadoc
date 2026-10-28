<script lang="ts">
  import { _ } from 'svelte-i18n'
  import type { Editor } from '@tiptap/core'
  import { onDestroy, onMount } from 'svelte'
  import { _$_wysiwygEditorsList } from '../../../../../../stores/editor.store'

  // let tocItems: any[] = []
  let tocItems: (HTMLElement | HTMLHeadingElement)[] = $state([])
  let draggingId = $state('')
  let dragOverId = $state('')
  let dragOverPlacement = $state<'before' | 'after'>('before')
  let focusedId = $state('')
  let allowCrossLevelReorder = $state(false)
  let isBlockedDrop = $state(false)

  let _wysiwygEditor: Editor | undefined 
  // let _wysiwygEditor: Editor | undefined = $state(null)
  let wysiwygEditorStore

  let activeId = $state('') // Track currently scrolled heading

  const headingLevelColors: Record<number, string> = {
    1: '#60a5fa',
    2: '#34d399',
    3: '#fbbf24',
    4: '#f472b6',
    5: '#a78bfa',
    6: '#fb7185'
  }

  const activeWysiwygEditorStore = _$_wysiwygEditorsList.getActive()
  $effect(() => {
    wysiwygEditorStore = activeWysiwygEditorStore
    const nextEditor = $activeWysiwygEditorStore?.editor

    if (_wysiwygEditor !== nextEditor) {
      detachEditor()
      _wysiwygEditor = nextEditor
      attachEditor()
      updateTOC()
    }
  })

  // Assuming these are defined in your script
  // let _wysiwygEditor = $state(null);

  /* $effect(() => {
    // 1. Dependency tracking: Accessing the store value ($)
    // makes this effect re-run whenever the store changes.
    const nextEditor = $activeWysiwygEditorStore?.editor

    // 2. Logic Check
    if (_wysiwygEditor !== nextEditor) {
      // Use untrack() if you have functions that shouldn't
      // trigger further reactivity loops, but usually standard calls are fine.
      detachEditor()
      _wysiwygEditor = nextEditor
      attachEditor()
      updateTOC()
    }
  }) */

  function updateTOC() {
    // Assuming storage.tableOfContents returns items with pos, level, and text
    // tocItems = _wysiwygEditor?.storage.tableOfContents.content || []
    const anchors = _wysiwygEditor?.storage.tableOfContents.anchors || []
    tocItems = anchors.filter((item) => getItemId(item))
  }

  function handleSelection() {
    // Logic to find the current active heading based on cursor position
    // This adds the MS Word "Active Heading" tracking feature
  }

  function attachEditor() {
    if (!_wysiwygEditor) return
    _wysiwygEditor.on('transaction', updateTOC)
    _wysiwygEditor.on('selectionUpdate', handleSelection)
  }

  function detachEditor() {
    if (!_wysiwygEditor) return
    _wysiwygEditor.off('transaction', updateTOC)
    _wysiwygEditor.off('selectionUpdate', handleSelection)
  }

  function scrollToHeading(id: string) {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
      activeId = id
    }
  }

  const getItemId = (el: HTMLElement | HTMLHeadingElement): string => {
    if (!el) return ''
    return el.id || el.getAttribute('data-toc-id') || ''
  }

  const getItemText = (el: HTMLElement | HTMLHeadingElement): string => {
    return (el?.textContent || '').trim()
  }

  const getHeadingLevel = (el: HTMLElement | HTMLHeadingElement): number => {
    const tag = (el?.tagName || '').toUpperCase()
    if (tag.startsWith('H')) {
      const num = Number(tag.slice(1))
      return Number.isFinite(num) ? Math.max(1, Math.min(6, num)) : 1
    }
    return 1
  }

  const getIndentPx = (el: HTMLElement | HTMLHeadingElement): number => {
    const level = getHeadingLevel(el)
    return (level - 1) * 12 + 8
  }

  const getHeadingPos = (el: HTMLElement | HTMLHeadingElement): number | null => {
    if (!_wysiwygEditor || !el) return null
    try {
      const pos = _wysiwygEditor.view.posAtDOM(el, 0)
      const _pos = _wysiwygEditor.state.doc.resolve(pos)
      for (let depth = _pos.depth; depth >= 0; depth -= 1) {
        if (_pos.node(depth).type.name === 'heading') {
          return _pos.before(depth)
        }
      }
      return pos
    } catch {
      return null
    }
  }

  const moveHeading = (sourceEl: HTMLElement | HTMLHeadingElement, targetEl: HTMLElement | HTMLHeadingElement, placement: 'before' | 'after') => {
    if (!_wysiwygEditor) return
    if (getHeadingLevel(sourceEl) !== getHeadingLevel(targetEl) && !allowCrossLevelReorder) return
    if (getItemId(sourceEl) === getItemId(targetEl)) return
    const sourcePos = getHeadingPos(sourceEl)
    const targetPos = getHeadingPos(targetEl)
    if (sourcePos === null || targetPos === null) return
    const { state, view } = _wysiwygEditor
    const sourceNode = state.doc.nodeAt(sourcePos)
    const targetNode = state.doc.nodeAt(targetPos)
    if (!sourceNode || !targetNode) return

    let dropPos = placement === 'before' ? targetPos : targetPos + targetNode.nodeSize
    let tr = state.tr.delete(sourcePos, sourcePos + sourceNode.nodeSize)
    dropPos = tr.mapping.map(dropPos)
    tr = tr.insert(dropPos, sourceNode)
    tr.setSelection(NodeSelection.create(tr.doc, dropPos))
    view.dispatch(tr)
    _wysiwygEditor.commands.focus()
    updateTOC()
  }

  const handleDragStart = (e: DragEvent, item: HTMLElement | HTMLHeadingElement) => {
    if (!item) return
    draggingId = getItemId(item)
    if (!draggingId) return
    isBlockedDrop = false
    e.dataTransfer?.setData('text/toc-id', draggingId)
    e.dataTransfer?.setData('text/plain', draggingId)
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: DragEvent, item: HTMLElement | HTMLHeadingElement) => {
    e.preventDefault()
    if (!item) return
    if (!getItemId(item)) return
    if (draggingId) {
      const sourceItem = tocItems.find((i) => i?.id === draggingId)
      if (sourceItem && getHeadingLevel(sourceItem) !== getHeadingLevel(item) && !allowCrossLevelReorder) {
        dragOverId = getItemId(item)
        isBlockedDrop = true
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
        return
      }
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    dragOverPlacement = e.clientY - rect.top > rect.height / 2 ? 'after' : 'before'
    dragOverId = getItemId(item)
    isBlockedDrop = false
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: DragEvent, targetItem: HTMLElement | HTMLHeadingElement) => {
    e.preventDefault()
    if (!targetItem) return
    const draggedId = e.dataTransfer?.getData('text/toc-id') || draggingId
    const targetId = getItemId(targetItem)
    if (!draggedId || !targetId || draggedId === targetId) {
      dragOverId = ''
      draggingId = ''
      return
    }
    const sourceItem = tocItems.find((i) => i?.id === draggedId)
    if (!sourceItem) return
    if (getHeadingLevel(sourceItem) !== getHeadingLevel(targetItem) && !allowCrossLevelReorder) {
      dragOverId = ''
      draggingId = ''
      isBlockedDrop = false
      return
    }
    moveHeading(sourceItem, targetItem, dragOverPlacement)
    dragOverId = ''
    draggingId = ''
    isBlockedDrop = false
  }

  const handleKeyDown = (e: KeyboardEvent, item: HTMLElement | HTMLHeadingElement) => {
    if (!item || !e.altKey) return
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const level = getHeadingLevel(item)
    const sameLevel = tocItems.filter((i) => getHeadingLevel(i) === level)
    const index = sameLevel.findIndex((i) => getItemId(i) === getItemId(item))
    if (index === -1) return
    const nextIndex = e.key === 'ArrowUp' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= sameLevel.length) return
    const target = sameLevel[nextIndex]
    const placement = e.key === 'ArrowUp' ? 'before' : 'after'
    moveHeading(item, target, placement)
  }

  onMount(() => updateTOC())
  onDestroy(() => detachEditor())
</script>

<div
  class="h-full flex flex-col bg-base-200 text-base-content border-l border-base-content/10 font-sans select-none overflow-hidden"
>
  <!-- {$_(
    'Add possibility of drag and drop nodes in the editor to change their position in the editor'
  )} -->

  <div class="flex items-center justify-between px-3 py-2 bg-base-300/60 border-b border-base-content/10">
    <div class="flex items-center gap-2">
      <div class="i-theme-workflow:table-all w-4 h-4 text-primary"></div>
      <span class="text-[10px] font-bold uppercase tracking-widest text-base-content/90">
        {$_('Table of Contents')}
      </span>
    </div>
    <div class="flex items-center gap-2">
      <button
        class="px-1.5 py-0.5 rounded-sm text-[9px] uppercase tracking-wider border border-base-content/15 text-base-content/50 hover:text-primary hover:border-primary transition-colors"
        onclick={() => (allowCrossLevelReorder = !allowCrossLevelReorder)}
        title={$_('Toggle cross-level reorder')}
      >
        {allowCrossLevelReorder ? 'All Levels' : 'Same Level'}
      </button>
      <button class="p-1 hover:bg-base-content/10 rounded-sm text-base-content/45" onclick={updateTOC}>
        <div class="i-theme-workflow:refresh w-3.5 h-3.5"></div>
      </button>
    </div>
  </div>

  <div class="p-2 border-b border-base-content/10 bg-base-200">
    <div class="relative group">
      <div
        class="absolute left-2 top-1/2 -translate-y-1/2 i-theme-workflow:search w-3 h-3 text-base-content/30"
      ></div>
      <input
        type="text"
        placeholder={$_('Search headings...')}
        class="w-full bg-base-100 border border-base-content/15 rounded-sm pl-7 pr-2 py-1 text-[11px] outline-none focus:border-primary"
      />
    </div>
  </div>

  <div class="flex-grow overflow-y-auto custom-scrollbar bg-base-100 py-1">
    {#if tocItems?.length === 0}
      <div class="p-8 text-center opacity-30 flex flex-col items-center gap-2">
        <div class="i-theme-workflow:anchor w-8 h-8"></div>
        <span class="text-[11px] italic">{$_('No headings found in document.')}</span>
      </div>
    {:else}
      {#each tocItems as item}
        <button
          draggable
          ondragstart={(e) => handleDragStart(e, item)}
          ondragover={(e) => handleDragOver(e, item)}
          ondragleave={() => {
            if (dragOverId === getItemId(item)) dragOverId = ''
            isBlockedDrop = false
          }}
          ondrop={(e) => handleDrop(e, item)}
          onfocus={() => (focusedId = item?.id || '')}
          onblur={() => {
            if (focusedId === item?.id) focusedId = ''
          }}
          onkeydown={(e) => handleKeyDown(e, item)}
          onclick={() => scrollToHeading(getItemId(item))}
          tabindex="0"
          class="relative w-full group flex items-center h-7 px-2 transition-all border-l-2 border-transparent
                 {activeId === getItemId(item)
            ? 'bg-base-content/12 border-l-primary text-base-content'
            : 'hover:bg-base-content/6 text-base-content/60'}"
          style:cursor={isBlockedDrop && dragOverId === getItemId(item) ? 'not-allowed' : draggingId ? 'move' : 'pointer'}
        >
          {#if dragOverId === getItemId(item)}
            <div
              class="absolute h-0.5 z-50 pointer-events-none {isBlockedDrop ? 'bg-red-400' : 'bg-primary'}"
              style:left="{getIndentPx(item)}px"
              style:right="8px"
              style:top={dragOverPlacement === 'before' ? '0' : 'auto'}
              style:bottom={dragOverPlacement === 'after' ? '0' : 'auto'}
            ></div>
          {/if}
          <!-- <div class="flex items-center" style="padding-left: {(item.level - 1) * 12}px"> -->
          <div class="flex items-center" style="padding-left: {getIndentPx(item)}px">
            <span class="mr-2 flex items-center gap-1">
              <span
                class="w-1.5 h-1.5 rounded-full"
                style:background="{headingLevelColors[getHeadingLevel(item)] || '#888'}"
              ></span>
              <span class="text-[9px] font-mono opacity-50 group-hover:opacity-100">
                H{getHeadingLevel(item)}
              </span>
            </span>

            <span class="text-[11px] truncate text-left transition-colors">
              {getItemText(item)}
            </span>
          </div>

          <div class="ml-auto hidden group-hover:flex items-center gap-1 opacity-60">
            <div class="i-theme-workflow:drag w-3 h-3" title={$_('Drag to reorder')}></div>
            <div class="i-theme-workflow:link-out w-3 h-3" title={$_('Jump to heading')}></div>
          </div>
        </button>
      {/each}
    {/if}
  </div>

  <div class="p-2 border-t border-base-content/10 bg-base-300/50 flex justify-between items-center px-3">
    <span class="text-[9px] text-base-content/35 font-bold uppercase">{tocItems.length} Headings</span>
    <button class="text-[9px] text-primary hover:underline">{$_('Collapse All')}</button>
  </div>
</div>

<style>
  /* Adobe Scrollbar Style */
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(var(--theme-text-rgb), 0.24);
    border-radius: 2px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  /* Smooth scroll into document */
  :global(html) {
    scroll-behavior: smooth;
  }
</style>
