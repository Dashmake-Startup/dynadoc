<!--
 Copyright (C) 2024 Dashmake Inc.

 This file is part of DDoc Office.

 DDoc Office is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 DDoc Office is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
  import { onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import type { Editor } from '@tiptap/core'
  import { NodeSelection } from 'prosemirror-state'
  import {
    _$_ribbonsList,
    _$_ribbonContainerHeight,
    _$_ribbonContext,
    _$_ribbonActiveTab,
    _$_ribbonUserVisible,
    _$_ribbonAutoHidden,
    _$_ribbonDisplayPreferences,
    RibbonType,
    type RibbonEntry
  } from '../../../stores/ribbon.store'
  import { _$_wysiwygEditorsList, _$_documentEditorsList } from '../../../stores/editor.store'
  import { _$_activeDocKind } from '../../../stores/docKind.store'
  import { openShareModal } from '../../../stores/shareModal.store'
  import { CustomSlideExtensionProps } from '../../../extensions/tiptap/CustomSlideExtension/utils/common.utils'
  import { CustomDesignExtensionProps } from '../../../extensions/tiptap/CustomDesignExtension/utils/common.utils'

  import FormRibbon from './components/form/FormRibbon.svelte'
  import TranslateRibbon from './components/translate/TranslateRibbon.svelte'
  import HomeRibbon from './components/home/HomeRibbon.svelte'
  import InsertRibbon from './components/insert/InsertRibbon.svelte'
  import DesignRibbon from './components/design/DesignRibbon.svelte'
  import DataRibbon from './components/data/DataRibbon.svelte'
  import MediaRibbon from './components/media/MediaRibbon.svelte'
  import AutomationRibbon from './components/automation/AutomationRibbon.svelte'
  import LayoutRibbon from './components/layout/LayoutRibbon.svelte'
  import ReferencesRibbon from './components/references/ReferencesRibbon.svelte'
  import ReviewRibbon from './components/review/ReviewRibbon.svelte'
  import ViewRibbon from './components/view/ViewRibbon.svelte'
  import AnimationsRibbon from './components/animations/AnimationsRibbon.svelte'
  import TransitionsRibbon from './components/transitions/TransitionsRibbon.svelte'
  import TableToolsRibbon from './components/table/TableToolsRibbon.svelte'
  import TableStyleRibbon from './components/table/TableStyleRibbon.svelte'
  import PictureToolsRibbon from './components/media/PictureToolsRibbon.svelte'
  import DrawingToolsRibbon from './components/drawing/DrawingToolsRibbon.svelte'
  import ExcelDrawRibbon from './components/excel/draw/ExcelDrawRibbon.svelte'
  import ExcelDeveloperRibbon from './components/excel/developer/ExcelDeveloperRibbon.svelte'
  import ExcelAddinsRibbon from './components/excel/addins/ExcelAddinsRibbon.svelte'
  import ExcelHelpRibbon from './components/excel/help/ExcelHelpRibbon.svelte'
  import ExcelFormulasRibbon from './components/excel/formulas/ExcelFormulasRibbon.svelte'
  import LeftQuickAccessToolBar from '../../titleBar/leftQuickAccess/LeftQuickAccessToolBar.svelte'
  import { CustomSpreadsheetExtensionProps } from '../../../extensions/tiptap/CustomSpreadsheetExtension/utils/common.utils'
  import { CustomChartExtensionProps } from '../../../extensions/tiptap/CustomChartExtension/utils/common.utils'
  import { CustomImageExtensionProps } from '../../../extensions/tiptap/CustomImageExtension/utils/common.utils'

  // --- Runes: Reactive State ---
  let activeTabId = $state<keyof typeof RibbonType>(RibbonType.home)
  let ribbonCollapsed = $state(false)
  let ribbonContainer = $state<HTMLElement | null>(null)
  let activeEditor = $state<Editor | null>(null)
  let rafHandle = 0

  // Sliding underline under the active ribbon tab.
  let tabEls = $state<Record<string, HTMLButtonElement | null>>({})
  let underline = $state<{ left: number; width: number; animate: boolean }>({
    left: 0,
    width: 0,
    animate: false
  })
  let _underlineInited = false
  let ribbonPreferences = $derived($_$_ribbonDisplayPreferences)

  // Define the ribbon items (Runes-friendly)
  const items: RibbonEntry[] = [
    { id: 'home', label: $_('Home'), body: HomeRibbon },
    { id: 'insert', label: $_('Insert'), body: InsertRibbon },
    { id: 'design', label: $_('Design'), body: DesignRibbon },
    { id: 'translate', label: $_('Translate'), body: TranslateRibbon },
    { id: 'data', label: $_('Data'), body: DataRibbon },
    { id: 'media', label: $_('Media'), body: MediaRibbon },
    { id: 'automation', label: $_('Automation'), body: AutomationRibbon },
    { id: 'layout', label: $_('Layout'), body: LayoutRibbon },
    { id: 'references', label: $_('References'), body: ReferencesRibbon },
    { id: 'form', label: $_('Form'), body: FormRibbon },
    { id: 'review', label: $_('Review'), body: ReviewRibbon },
    { id: 'view', label: $_('View'), body: ViewRibbon },
    { id: 'draw', label: $_('Draw'), body: ExcelDrawRibbon },
    { id: 'developer', label: $_('Developer'), body: ExcelDeveloperRibbon },
    { id: 'addins', label: $_('Add-ins'), body: ExcelAddinsRibbon },
    { id: 'help', label: $_('Help'), body: ExcelHelpRibbon },
    { id: 'transitions', label: $_('Transitions'), body: TransitionsRibbon },
    { id: 'animations', label: $_('Animations'), body: AnimationsRibbon },
    { id: 'table_tools', label: $_('Table tools'), body: TableToolsRibbon },
    { id: 'table_style', label: $_('Table style'), body: TableStyleRibbon },
    { id: 'picture_tools', label: $_('Picture tools'), body: PictureToolsRibbon },
    { id: 'drawing_tools', label: $_('Drawing tools'), body: DrawingToolsRibbon },
    { id: 'formulas', label: $_('Formulas'), body: ExcelFormulasRibbon }
  ]
  const sheetOnlyTabs = new Set<keyof typeof RibbonType>([
    RibbonType.draw,
    RibbonType.developer,
    RibbonType.addins,
    RibbonType.help
  ])

  // WPS-style per-file-type ribbon tabs. Home / Insert / Review / View (and the
  // Dynadoc-only Translate / Media / Automation) stay visible for every kind;
  // the rest are gated to the document kind they belong to.
  const sheetTabs = new Set<keyof typeof RibbonType>([
    RibbonType.data,
    RibbonType.formulas,
    RibbonType.draw,
    RibbonType.developer,
    RibbonType.addins,
    RibbonType.help
  ])
  const slideTabs = new Set<keyof typeof RibbonType>([
    RibbonType.transitions,
    RibbonType.animations
  ])
  // Page Layout applies to Writer and Sheets in WPS (not Presentation).
  const writerOrSheetTabs = new Set<keyof typeof RibbonType>([RibbonType.layout])

  const docKind = $derived($_$_activeDocKind ?? 'writer')

  const drawingToolsAllowed = $derived.by(() => {
    const type = $_$_ribbonContext.activePositionableType
    return type === CustomSlideExtensionProps.name || type === CustomDesignExtensionProps.name
  })

  // A tab is visible when it belongs to the active document kind. Sheet- and
  // slide-specific tabs also appear when the cursor sits inside an embedded
  // spreadsheet / slide node of another document (live context), so editing
  // embedded objects keeps its tools.
  const isTabAllowedForKind = (id: keyof typeof RibbonType): boolean => {
    if (sheetTabs.has(id)) return docKind === 'sheets' || $_$_ribbonContext.inSheet
    if (slideTabs.has(id)) return docKind === 'slides' || $_$_ribbonContext.inSlide
    // Design tab: Presentation and Design documents (and embedded slide nodes).
    if (id === RibbonType.design)
      return docKind === 'slides' || docKind === 'design' || $_$_ribbonContext.inSlide
    // References belongs to Writer; the Form tab to Writer and Form documents.
    if (id === RibbonType.references) return docKind === 'writer'
    if (id === RibbonType.form) return docKind === 'writer' || docKind === 'form'
    if (writerOrSheetTabs.has(id))
      return docKind === 'writer' || docKind === 'sheets' || $_$_ribbonContext.inSheet
    return true
  }

  const visibleItems = $derived.by(() =>
    items.filter(
      (tab) =>
        (tab.id !== RibbonType.table_tools || $_$_ribbonContext.inTable) &&
        (tab.id !== RibbonType.table_style || $_$_ribbonContext.inTable) &&
        (tab.id !== RibbonType.picture_tools || $_$_ribbonContext.inImage) &&
        (tab.id !== RibbonType.drawing_tools || drawingToolsAllowed) &&
        isTabAllowedForKind(tab.id)
    )
  )

  // Helper to find the active component body
  const activeComponent = $derived.by(() => {
    const found = visibleItems.find((r) => r.id === activeTabId)
    return found?.body ?? visibleItems[0]?.body ?? null
  })

  function selectTab(id: keyof typeof RibbonType, _fromUser = true) {
    // The ribbon stays expanded at all times: selecting a tab never collapses
    // the body.
    activeTabId = id
    ribbonCollapsed = false
    _$_ribbonsList.setActive(id)
    _$_ribbonActiveTab.set(id)
    _$_ribbonUserVisible.set(true)
  }

  function collapseRibbonFromDocument(event: PointerEvent) {
    if (!ribbonPreferences.autoCollapse || ribbonCollapsed) return
    const target = event.target as HTMLElement | null
    if (target?.closest('.theme-ribbon-system')) return
    ribbonCollapsed = true
  }

  async function handleShare() {
    const active = _$_documentEditorsList.getActiveSync?.()
    const doc = active?.document
    if (!doc?.path) return
    await openShareModal({
      path: doc.path,
      name: doc.name || 'Document',
      source: 'disk',
      targetType: 'document',
      docUuid: doc.uuid
    })
  }

  function hasTableContext(editor: Editor | null): boolean {
    // console.log("hasTableContext hasTableContext", editor?.isActive('table'))
    if (!editor) return false
    return (
      editor.isActive('table') ||
      editor.isActive('tableRow') ||
      editor.isActive('tableCell') ||
      editor.isActive('tableHeader')
    )
  }

  function hasSheetContext(editor: Editor | null): boolean {
    // console.log("hasTableContext hasSheetContext", editor?.isActive(CustomSpreadsheetExtensionProps.name))
    if (!editor) return false
    return editor.isActive(CustomSpreadsheetExtensionProps.name)
  }

  function hasImageContext(editor: Editor | null): boolean {
    if (!editor) return false
    return editor.isActive(CustomImageExtensionProps.name) || editor.isActive('img')
  }

  function hasSlideContext(): boolean {
    const activeNodeview = _$_wysiwygEditorsList.getActiveNodeviewOfActiveEditor?.()
    return activeNodeview?.type === CustomSlideExtensionProps.name
  }

  const positionableTypes = new Set([
    CustomSlideExtensionProps.name,
    CustomDesignExtensionProps.name,
    CustomSpreadsheetExtensionProps.name,
    CustomChartExtensionProps.name
  ])

  function resolveActivePositionableType(editor: Editor | null): string | null {
    const activeNodeview = _$_wysiwygEditorsList.getActiveNodeviewOfActiveEditor?.()
    if (activeNodeview?.type && positionableTypes.has(activeNodeview.type)) {
      return activeNodeview.type
    }

    if (!editor) return null
    const { selection } = editor.state
    if (selection instanceof NodeSelection) {
      const nodeType = selection.node?.type?.name
      if (nodeType && positionableTypes.has(nodeType)) return nodeType
    }

    return null
  }

  function syncRibbonContextFromEditor(editor: Editor | null) {
    const positionableType = resolveActivePositionableType(editor)
    _$_ribbonContext.patch({
      hasEditor: Boolean(editor),
      inTable: hasTableContext(editor),
      inImage: hasImageContext(editor),
      inSheet: hasSheetContext(editor),
      inSlide: hasSlideContext(),
      hasPositionableNode: Boolean(positionableType),
      activePositionableType: positionableType
    })
  }

  function scheduleContextSync(editor: Editor | null) {
    if (rafHandle) cancelAnimationFrame(rafHandle)
    rafHandle = requestAnimationFrame(() => {
      syncRibbonContextFromEditor(editor)
      rafHandle = 0
    })
  }

  function bindEditor(editor: Editor | null): () => void {
    activeEditor = editor
    syncRibbonContextFromEditor(editor)
    if (!editor) return () => {}

    const sync = () => scheduleContextSync(editor)
    editor.on('selectionUpdate', sync)
    editor.on('transaction', sync)
    editor.on('focus', sync)
    editor.on('blur', sync)

    return () => {
      editor.off('selectionUpdate', sync)
      editor.off('transaction', sync)
      editor.off('focus', sync)
      editor.off('blur', sync)
    }
  }

  const isTabVisible = (tabId: keyof typeof RibbonType) =>
    visibleItems.some((tab) => tab.id === tabId)

  $effect(() => {
    if ($_$_ribbonActiveTab && activeTabId !== $_$_ribbonActiveTab) {
      activeTabId = $_$_ribbonActiveTab
    }
    if (!isTabVisible(activeTabId)) {
      selectTab(visibleItems[0]?.id ?? RibbonType.home, false)
    }
  })

  // Reposition the sliding underline whenever the active tab or the tab set
  // changes. requestAnimationFrame lets the layout settle first.
  $effect(() => {
    activeTabId
    visibleItems.length
    requestAnimationFrame(() => {
      const el = tabEls[activeTabId]
      if (!el) return
      underline = { left: el.offsetLeft, width: el.offsetWidth, animate: _underlineInited }
      _underlineInited = true
    })
  })

  onMount(() => {
    _$_ribbonsList.addRibbonsFromList(items)
    _$_ribbonContext.reset()
    // The ribbon is expanded by default on every launch (it can still be
    // collapsed during the session via the chevron).
    _$_ribbonUserVisible.set(true)
    _$_ribbonAutoHidden.set(false)
    ribbonCollapsed = false
    selectTab($_$_ribbonActiveTab || RibbonType.home, false)

    const activeEditorStore = _$_wysiwygEditorsList.getActive()
    const activeNodeviewStore = _$_wysiwygEditorsList.getActiveNodeviewOfActiveEditorStore?.()
    let unbindEditor = () => {}
    const unlistenActiveEditor = activeEditorStore.subscribe((entry) => {
      const nextEditor = entry?.editor ?? null
      if (activeEditor === nextEditor) return
      unbindEditor()
      unbindEditor = bindEditor(nextEditor)
    })
    const unlistenActiveNodeview = activeNodeviewStore?.subscribe?.(() => {
      scheduleContextSync(activeEditor)
    })

    // Initial height sync for the layout engine
    let ro: ResizeObserver | null = null
    if (ribbonContainer) {
      _$_ribbonContainerHeight.set(ribbonContainer.offsetHeight)
      ro = new ResizeObserver(() => {
        _$_ribbonContainerHeight.set(ribbonContainer.offsetHeight)
      })
      ro.observe(ribbonContainer)
    }

    window.addEventListener('pointerdown', collapseRibbonFromDocument, true)

    return () => {
      window.removeEventListener('pointerdown', collapseRibbonFromDocument, true)
      if (rafHandle) cancelAnimationFrame(rafHandle)
      unbindEditor()
      unlistenActiveEditor()
      unlistenActiveNodeview?.()
      ro?.disconnect()
      _$_ribbonContext.reset()
    }
  })

  $effect(() => {
    if ($_$_ribbonUserVisible) ribbonCollapsed = false
  })
</script>

<div
  class="theme-ribbon-system flex flex-col w-full bg-base-100 border-b border-base-300 select-none"
  bind:this={ribbonContainer}
>
  <nav class="flex items-center px-2 gap-1 bg-base-100">
    <!-- <button
      class="px-4 py-1.5 mr-2 text-[11px] font-black uppercase tracking-tighter bg-primary text-base-content rounded-t-md hover:brightness-110 transition-all"
    >
      File
    </button> -->

    <div class="flex-shrink-0 flex items-center mr-1">
      <LeftQuickAccessToolBar />
    </div>

    <div
      class="flex flex-1 min-w-0 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
    >
      <div
        class="ribbon-tab-list relative inline-flex items-center gap-1 px-2"
        class:ribbon-tabs-centered={ribbonPreferences.centerButtons}
        class:ribbon-tabs-start={!ribbonPreferences.centerButtons}
      >
        {#each visibleItems as tab}
          <button
            bind:this={tabEls[tab.id]}
            class="relative px-3 lg:px-4 py-2 text-[12px] tracking-tight transition-colors duration-150 outline-none
                 {activeTabId === tab.id
              ? 'text-primary font-medium'
              : 'text-base-content/60 hover:text-base-content'}"
            onclick={() => selectTab(tab.id)}
          >
            <span class="relative z-10">{tab.label}</span>
          </button>
        {/each}
        <!-- single underline that slides to the active tab -->
        <div
          class="ribbon-tab-underline"
          class:animate={underline.animate}
          style="left:{underline.left}px;width:{underline.width}px;"
        ></div>
      </div>
    </div>

    <!-- WPS right cluster: cloud status + Share -->
    <div class="flex-shrink-0 flex items-center gap-2 pl-2 pr-1">
      <span class="hidden md:flex items-center gap-1 text-[11px] text-base-content/50">
        <i class="ph-light ph-cloud-slash text-[14px]"></i>
        {$_('Not uploaded')}
      </span>
      <button
        class="flex items-center gap-1.5 h-7 px-3 rounded text-[12px] font-medium text-primary-content bg-primary hover:brightness-105 transition-all"
        onclick={handleShare}
        title={$_('Share')}
      >
        <i class="ph-light ph-share-network text-[14px]"></i>
        {$_('Share')}
      </button>
    </div>
  </nav>

  <div
    class="ribbon-body-wrapper relative bg-base-100 border-t border-base-300 overflow-hidden"
    class:ribbon-collapsed={ribbonCollapsed || !$_$_ribbonUserVisible}
  >
    <div class="p-1 lg:p-2 h-full flex items-center">
      {#if activeComponent}
        <svelte:component this={activeComponent} />
      {/if}
    </div>
  </div>
</div>

<style>
  .theme-ribbon-system {
    font-family: var(--brand-font-sans);
  }

  /* Sliding underline under the active ribbon tab */
  .ribbon-tab-underline {
    position: absolute;
    bottom: 2px;
    height: 2px;
    border-radius: 2px;
    background: var(--accent, var(--color-primary));
    pointer-events: none;
  }
  .ribbon-tab-underline.animate {
    transition:
      left 240ms cubic-bezier(0.4, 0, 0.2, 1),
      width 240ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  @media (prefers-reduced-motion: reduce) {
    .ribbon-tab-underline.animate {
      transition: none;
    }
  }

  .ribbon-body-wrapper {
    container-type: inline-size;
    min-height: 90px;
    max-height: 200px;
    transition:
      max-height 180ms ease,
      min-height 180ms ease,
      opacity 150ms ease,
      padding 150ms ease;
    opacity: 1;
  }

  .ribbon-tabs-centered {
    margin-left: auto;
    margin-right: auto;
  }
  .ribbon-tabs-start {
    margin-right: auto;
  }

  .ribbon-body-wrapper.ribbon-collapsed {
    min-height: 0;
    max-height: 0;
    opacity: 0;
    overflow: hidden;
  }

  /* Ribbon Body Content Layout */
  :global(.ribbon-group) {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 12px;
    border-right: 1px solid var(--line2);
    height: 100%;
    justify-content: center;
  }

  :global(.ribbon-group-label) {
    font-size: 9px;
    text-transform: uppercase;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--theme-text-muted);
    margin-top: auto;
    padding-top: 4px;
  }
</style>
