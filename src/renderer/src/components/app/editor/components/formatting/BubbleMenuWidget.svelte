<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'
  import { get } from 'svelte/store'
  import type { Editor } from '@tiptap/core'

  import {
    GenericFormattingComponentMap,
    TableLayoutFormattingMap,
    type GenericFormattingComponentType,
    type GenericFormattingProps
  } from '../../../../common/actions/formatting'
  import Layout from '../../../../common/layout/layout'
  import { _$_wysiwygEditorsList } from '../../../../../stores/editor.store'

  type ToolModel = {
    id: string
    component: any
    props: GenericFormattingProps
  }

  let root: HTMLDivElement | null = null
  let activeEditor: Editor | null = null
  let detachEditorListeners: (() => void) | null = null
  let detachActiveStore: (() => void) | null = null

  let hasSelection = false
  let selectionChars = 0
  let selectionWords = 0
  let isTableContext = false
  let isLinkContext = false
  let isCodeContext = false
  let proximityOpacity = $state(1)

  const PROXIMITY_FADE_START_PX = 110
  const PROXIMITY_DISMISS_PX = 340
  const PROXIMITY_MIN_OPACITY = 0.18

  function distanceToRect(x: number, y: number, rect: DOMRect): number {
    const horizontal = Math.max(rect.left - x, 0, x - rect.right)
    const vertical = Math.max(rect.top - y, 0, y - rect.bottom)
    return Math.hypot(horizontal, vertical)
  }

  function dismissForPointerDistance() {
    if (!activeEditor || activeEditor.state.selection.empty) return
    // Tiptap's blur command closes BubbleMenu without changing the current
    // ProseMirror selection, so the selected text remains highlighted.
    activeEditor.commands.blur()
    proximityOpacity = 1
  }

  function handlePointerMove(event: PointerEvent) {
    // The BubbleMenu extension detaches the element when it is hidden. In
    // that state, or before the selection menu has been positioned, there is
    // nothing to fade.
    if (!root?.isConnected || !hasSelection || root.style.visibility === 'hidden') return

    const rect = root.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const distance = distanceToRect(event.clientX, event.clientY, rect)
    if (distance >= PROXIMITY_DISMISS_PX) {
      dismissForPointerDistance()
      return
    }

    if (distance <= PROXIMITY_FADE_START_PX) {
      proximityOpacity = 1
      return
    }

    const progress =
      (distance - PROXIMITY_FADE_START_PX) / (PROXIMITY_DISMISS_PX - PROXIMITY_FADE_START_PX)
    proximityOpacity = 1 - progress * (1 - PROXIMITY_MIN_OPACITY)
  }

  function resolveProps(source: GenericFormattingComponentType): GenericFormattingProps {
    if (typeof source?.props === 'function') {
      return source.props({})
    }
    return source?.props || {}
  }

  function makeTool(
    id: string,
    source: GenericFormattingComponentType,
    layout: keyof typeof Layout.LAYOUT_COMPONENTS = Layout.LAYOUT.ICON,
    extraProps: Record<string, any> = {}
  ): ToolModel {
    return {
      id,
      component: source.component,
      props: {
        ...resolveProps(source),
        __layout: layout,
        ...extraProps
      }
    }
  }

  function invokeTool(source: GenericFormattingComponentType) {
    const props = resolveProps(source)
    props?.__onClick?.()
  }

  const fontTools: ToolModel[] = [
    makeTool('font-picker', GenericFormattingComponentMap.FontPicker, Layout.LAYOUT.COLUMN)
  ]

  const typographyTools: ToolModel[] = [
    makeTool('font-inc', GenericFormattingComponentMap.FontSizeIncrease),
    makeTool('font-dec', GenericFormattingComponentMap.FontSizeDecrease),
    makeTool('bold', GenericFormattingComponentMap.TextBold),
    makeTool('italic', GenericFormattingComponentMap.TextItalic),
    makeTool('underline', GenericFormattingComponentMap.TextUnderline),
    makeTool('strike', GenericFormattingComponentMap.TextStrikethrough),
    makeTool('highlight', GenericFormattingComponentMap.TextHighlight),
    makeTool('color', GenericFormattingComponentMap.TextColorSelect)
  ]

  const paragraphTools: ToolModel[] = [
    makeTool('align-left', GenericFormattingComponentMap.TextAlignLeft),
    makeTool('align-center', GenericFormattingComponentMap.TextAlignCenter),
    makeTool('align-right', GenericFormattingComponentMap.TextAlignRight),
    makeTool('align-justify', GenericFormattingComponentMap.TextAlignJustify),
    makeTool('bullet', GenericFormattingComponentMap.TextBullet),
    makeTool('number', GenericFormattingComponentMap.TextNumberList),
    makeTool('indent-dec', GenericFormattingComponentMap.TextIndentDecrease),
    makeTool('indent-inc', GenericFormattingComponentMap.TextIndentIncrease)
  ]

  const linkTools: ToolModel[] = [
    makeTool('hyperlink', GenericFormattingComponentMap.HyperlinkSelect, Layout.LAYOUT.SELECT)
  ]

  const tableTools: ToolModel[] = [
    makeTool('table-insert', TableLayoutFormattingMap.TableInsertSelect, Layout.LAYOUT.SELECT),
    makeTool('table-delete', TableLayoutFormattingMap.TableDeleteSelect, Layout.LAYOUT.SELECT),
    makeTool('merge-cells', TableLayoutFormattingMap.MergeCells),
    makeTool('split-cells', TableLayoutFormattingMap.SplitCells)
  ]

  let smartActions = [
    {
      id: 'rewrite',
      label: 'Rewrite',
      icon: 'ph-light ph-magic-wand',
      run: () => invokeTool(GenericFormattingComponentMap.GenerateWithAI)
    },
    {
      id: 'variable',
      label: 'Make Variable',
      icon: 'ph-light ph-brackets-curly',
      run: () => invokeTool(GenericFormattingComponentMap.VariableSelect)
    },
    {
      id: 'protect',
      label: 'Protect',
      icon: 'ph-light ph-shield-check',
      run: () => invokeTool(GenericFormattingComponentMap.SecuredContent)
    },
    {
      id: 'find',
      label: 'Find',
      icon: 'ph-light ph-magnifying-glass',
      run: () => invokeTool(GenericFormattingComponentMap.TextSearch)
    }
  ]
  smartActions = [] // Temporarily disable smart actions until we can ensure they work well in the bubble context

  function computeContext(editor: Editor | null) {
    if (!editor) {
      hasSelection = false
      selectionChars = 0
      selectionWords = 0
      isTableContext = false
      isLinkContext = false
      isCodeContext = false
      return
    }

    const { from, to, empty } = editor.state.selection
    const selectedText = empty ? '' : editor.state.doc.textBetween(from, to, ' ', ' ')
    const normalizedText = selectedText.trim()

    hasSelection = !empty
    selectionChars = normalizedText.length
    selectionWords = normalizedText ? normalizedText.split(/\s+/).length : 0

    isTableContext =
      editor.isActive('table') || editor.isActive('tableRow') || editor.isActive('tableCell')
    isLinkContext = editor.isActive('link')
    isCodeContext = editor.isActive('code') || editor.isActive('codeBlock')
  }

  function bindEditorOld(nextEditor: Editor | null) {
    if (activeEditor === nextEditor) {
      computeContext(nextEditor)
      return
    }

    if (detachEditorListeners) {
      detachEditorListeners()
      detachEditorListeners = null
    }

    activeEditor = nextEditor

    if (!nextEditor) {
      computeContext(null)
      return
    }

    const update = () => {
      computeContext(nextEditor)
      if (hasSelection) proximityOpacity = 1
    }

    nextEditor.on('selectionUpdate', update)
    nextEditor.on('transaction', update)
    nextEditor.on('focus', update)
    nextEditor.on('blur', update)

    computeContext(nextEditor)

    detachEditorListeners = () => {
      nextEditor.off('selectionUpdate', update)
      nextEditor.off('transaction', update)
      nextEditor.off('focus', update)
      nextEditor.off('blur', update)
    }
  }

  function bindEditor(nextEditor: Editor | null) {
    if (activeEditor === nextEditor) {
      computeContext(nextEditor)
      return
    }

    if (detachEditorListeners) {
      detachEditorListeners()
      detachEditorListeners = null
    }

    activeEditor = nextEditor

    if (!nextEditor) {
      computeContext(null)
      return
    }

    const update = () => {
      computeContext(nextEditor)
      if (hasSelection) proximityOpacity = 1
    }

    // Handle Right-Click Event to close the Bubble Menu
    const handleContextMenu = (event: MouseEvent) => {
      if (!nextEditor) return

      // Clear text selection by collapsing it to a single cursor point
      // at the position where the right-click occurred
      const pos = nextEditor.view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos) {
        nextEditor.commands.setTextSelection(pos.inside >= 0 ? pos.inside : pos.pos)
      } else {
        // Fallback safety baseline: completely blur/empty selection if coordinate mapping fails
        nextEditor.commands.blur()
      }

      // Update local state variables immediately so the DOM reacts without lag
      computeContext(nextEditor)
    }

    nextEditor.on('selectionUpdate', update)
    nextEditor.on('transaction', update)
    nextEditor.on('focus', update)
    nextEditor.on('blur', update)

    // Append standard DOM listener to the editor wrapper element container
    nextEditor.view.dom.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('pointermove', handlePointerMove, { passive: true })

    computeContext(nextEditor)

    detachEditorListeners = () => {
      nextEditor.off('selectionUpdate', update)
      nextEditor.off('transaction', update)
      nextEditor.off('focus', update)
      nextEditor.off('blur', update)

      // Clean up the DOM event listener to prevent structural memory leaks
      nextEditor.view.dom.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }

  onMount(() => {
    const activeStore = _$_wysiwygEditorsList.getActive()

    const sync = (entry: any) => {
      bindEditor(entry?.editor || null)
    }

    detachActiveStore = activeStore.subscribe(sync)
    sync(get(activeStore))
  })

  onDestroy(() => {
    detachActiveStore?.()
    detachEditorListeners?.()
  })

  // Design constants for a compact "Word-style" bubble
  const adobePanelBg = 'bg-base-100 backdrop-blur-3xl'
  const adobeBorder = 'border-white/10'
  const sectionDivider =
    'w-[1px] h-4 bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] mx-1'
</script>

<div
  bind:this={root}
  transition:fade={{ duration: 120 }}
  style:opacity={proximityOpacity}
  onmouseenter={() => (proximityOpacity = 1)}
  class="bubble-menu-panel rd-[8px] border {adobeBorder} {adobePanelBg} p-1.5 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.6)] flex flex-col gap-1.5"
>
  <div
    class="flex items-center justify-between bg-[color-mix(in_srgb,var(--color-base-white)_3%,transparent)] rd-[4px] p-0.5 border border-white/5"
  >
    <div class="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
      {#each fontTools as tool (tool.id)}
        <svelte:component this={tool.component} {...tool.props} />
      {/each}
    </div>

    <div class={sectionDivider}></div>

    <div class="px-1.5 flex items-center">
      <i
        class="ph-bold {isTableContext
          ? 'ph-table text-base-300'
          : 'ph-text-t text-base-content/20'} text-[14px]"
      ></i>
    </div>
  </div>

  <div class="flex items-center gap-1">
    <div
      class="flex-1 flex items-center bg-[color-mix(in_srgb,var(--color-base-white)_3%,transparent)] rd-[4px] p-0.5 border border-white/5"
    >
      <!-- {#each paragraphTools.slice(0, 4) as tool (tool.id)} -->
      {#each typographyTools as tool (tool.id)}
        <svelte:component this={tool.component} {...tool.props} />
      {/each}

      {#if isLinkContext}
        <div class={sectionDivider}></div>
        <svelte:component this={linkTools[0].component} {...linkTools[0].props} />
      {/if}
    </div>

    {#if hasSelection}
      <div
        class="bg-base-300/10 border border-base-300/20 rd-[4px] px-2 py-1 flex flex-col items-center min-w-10"
      >
        <span class="text-[8px] font-800 text-base-300 leading-none">{selectionChars}</span>
        <span class="text-[7px] font-900 text-base-300/60 uppercase tracking-tighter mt-0.5"
          >{$_('CH')}</span
        >
      </div>
    {/if}
  </div>

  <div class="flex items-center gap-1">
    <div
      class="flex-1 flex items-center bg-[color-mix(in_srgb,var(--color-base-white)_3%,transparent)] rd-[4px] p-0.5 border border-white/5"
    >
      <!-- {#each paragraphTools.slice(0, 4) as tool (tool.id)} -->
      {#each paragraphTools as tool (tool.id)}
        <svelte:component this={tool.component} {...tool.props} />
      {/each}

      {#if isLinkContext}
        <div class={sectionDivider}></div>
        <svelte:component this={linkTools[0].component} {...linkTools[0].props} />
      {/if}
    </div>
  </div>

  {#if isTableContext}
    <div
      class="flex items-center gap-1 bg-[var(--color-base-300)]/10 border border-[var(--color-base-300)]/30 rd-[4px] p-0.5"
    >
      <span class="text-[8px] font-900 uppercase tracking-widest text-base-300 px-1.5"
        >{$_('Table')}</span
      >
      {#each tableTools as tool (tool.id)}
        <svelte:component this={tool.component} {...tool.props} />
      {/each}
    </div>
  {:else if !isCodeContext}
    <div class="flex items-center justify-around bg-black/20 rd-[4px] p-1 border border-white/5">
      {#each smartActions as action (action.id)}
        <button
          onclick={action.run}
          title={action.label}
          class="p-1.5 rd-[3px] text-base-content/50 hover:(bg-base-300 text-base-content) transition-all active:scale-90 group"
        >
          <i class="{action.icon} text-[14px] group-hover:scale-110 transition-transform"></i>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .bubble-menu-panel {
    transition: opacity 100ms ease-out;
  }

  /* Hide scrollbar for the font-size/typography area if it overflows */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
</style>
