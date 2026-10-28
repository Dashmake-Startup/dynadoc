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
  import { _ } from 'svelte-i18n'
  import {
    _$_wysiwygEditorsList,
    _$_codeEditorsList,
    _$_documentEditorsList
  } from '../../../stores/editor.store'

  import { onMount, onDestroy, tick } from 'svelte'
  import EditorHelpers from '../../../utils/EditorHelpers.js'

  // import SelectedTextModel from './wysiwyg/models/SelectedTextModel.js'
  import type { Event } from 'electron'
  import WysiwygEditor from './wysiwyg/WysiwygEditor.svelte'
  import Utils from '../../../utils/Utils.js'
  import CodeEditor from './code/CodeEditor.svelte'
  import PreviewEditor from './preview/PreviewEditor.svelte'
  import PdfReader from '../../../extensions/fileViewers/PdfViewer.svelte'
  // import ImageEditor from '../../common/image/ImageEditor.svelte'
  import VideoEditor from '../../common/video/VideoEditor.svelte'
  import Platform from '../../../libs/platform'
  import FileViewer from '../../../extensions/fileViewers/FileViewer.svelte'
  import { _$_documentCodeEditorVisible } from '../../../stores/common.store'
  import TranslateEditor from '../../../extensions/tiptap/CustomTranslationExtension/components/TranslateEditor.svelte'
  import { DocumentModel } from '../../../models/Document'
  import { getFlagEmoji } from '../../../extensions/tiptap/CustomTranslationExtension/utils/utils'
  import ContextMenu from '../../common/contextMenu/ContextMenu.svelte'
  import AddTranslationPicker from '../../../extensions/tiptap/CustomTranslationExtension/components/AddTranslationPicker.svelte'
  import SplitPane from '../../common/layout/splitPane/SplitPane.svelte'
  import FormResponseBar from './FormResponseBar.svelte'

  // --- Props ---
  let {
    __documentToOpen,
    __filePathToOpenFromDocument,
    __parentContainerKey,
    __codeEditorId = $bindable(),
    __wysiwygEditorId = $bindable(),
    __isPreviewEditor = false,
    // Initialize activeTab with the prop value
    __activeTab = $bindable(__filePathToOpenFromDocument)
  } = $props()

  // --- Internal State ---
  // Use a local state if you don't want to force the parent to provide __isPreviewEditor
  let isPreview = $state(__isPreviewEditor)

  // --- Confirm again if opened file should be open as editor or not ---
  $effect(() => {
    // We use an async IIFE inside the effect to handle the promise
    ;(async () => {
      if (__filePathToOpenFromDocument) {
        const shouldPreview = await DocumentModel.shouldOpenAsFile(__filePathToOpenFromDocument)

        // Update both the local state and the bindable prop
        isPreview = shouldPreview
        __isPreviewEditor = shouldPreview
      }
    })()
  })
  // 1. Subscribe to the store reactively using Runes
  const activeDocStore = _$_documentEditorsList.getActive()

  // --- Reactive State ---
  // Replaces $: _ischildReadyForRender = { ... }
  let _ischildReadyForRender = $state({
    codeEditor: false,
    wysiwyg: false
  })

  let _translatedFilesTabContainer = $state<HTMLElement>()
  let _translatedFilesTabs = [
    // __filePathToOpenFromDocument,
    ...__documentToOpen.getDocumentTranslations(__filePathToOpenFromDocument).map((t) => t.path)
  ]
  // 1. Get the store's idea of the "Active Translation"
  const activeTranslationStore = _$_documentEditorsList.getActiveTranslation()
  const paginationOptionsStore = $derived.by(() =>
    __wysiwygEditorId ? _$_wysiwygEditorsList.getPaginationOptionsStore(__wysiwygEditorId) : null
  )
  let _paginationOptions = $derived(paginationOptionsStore ? $paginationOptionsStore : null)
  let _paginationRekey = $derived(
    (_paginationOptions?.enabled ?? true)
      ? `pagination-on-${__wysiwygEditorId}`
      : `pagination-off-${__wysiwygEditorId}`
  )
  // 2. Derived Tabs list
  // This automatically updates when createTranslationFile triggers a store update
  let _allTabs = $derived.by(() => {
    const doc = $activeDocStore?.document
    if (!doc) return [__filePathToOpenFromDocument]

    const translations = doc.getDocumentTranslations(__filePathToOpenFromDocument)
    return [__filePathToOpenFromDocument, ...translations.map((t) => t.path)]
  })

  let _initialized = $state(false)
  // Unique key for this specific document in Electron
  const storageKey = $derived(`last_tab_${__documentToOpen.path}`)
  let _wysiwygScrollEl = $state<HTMLElement>()
  let _uiStateApplied = $state(false)
  let _selectionApplied = $state(false)
  let _scrollSaveTimer: ReturnType<typeof setTimeout> | null = null
  let _selectionSaveTimer: ReturnType<typeof setTimeout> | null = null
  let _detachSelectionListener: (() => void) | null = null
  let _detachScrollListener: (() => void) | null = null

  $effect(() => {
    if (!_initialized && _allTabs.length > 1) {
      const savedTab = localStorage.getItem(storageKey)

      if (savedTab && _allTabs.includes(savedTab)) {
        // Option 1: Restore Memory
        setActiveTab(savedTab)
      } else {
        // Option 2: Smart Locale Match
        const bestMatch = DocumentModel.getAutoTranslationTabMatch(
          _allTabs,
          __filePathToOpenFromDocument
        )
        if (bestMatch !== __filePathToOpenFromDocument) {
          setActiveTab(bestMatch)
        }
      }
      _initialized = true
    }
  })

  // Keep localStorage updated when user switches tabs
  $effect(() => {
    if (__activeTab) {
      localStorage.setItem(storageKey, __activeTab)
    }
  })

  // When the store says a translation is active, update the local tab
  $effect(() => {
    const activeT = $activeTranslationStore
    if (activeT && activeT.isActive) {
      __activeTab = activeT.path
    } else if ($activeDocStore?.isActive && !activeT) {
      // If no translation is active, fall back to the main document
      __activeTab = __filePathToOpenFromDocument
    }
  })

  $effect(() => {
    if (!__activeTab) return
    const uiState = __documentToOpen?.getUIState?.()
    if (!uiState?.activeTab) return
    if (uiState.activeTab === __activeTab) return
    if (_loadedTabs.has(uiState.activeTab)) {
      __activeTab = uiState.activeTab
    }
  })

  // keep track of which tabs are already loaded
  let _loadedTabs: Set<string> = new Set([__activeTab])

  const getEditorIdentity = () => {
    const editor = $activeDocStore
    return (
      __documentToOpen?.uuid ||
      editor?.document?.uuid ||
      editor?.id ||
      editor?.uuid ||
      __wysiwygEditorId
    )
  }

  const setActiveTab = (tab: string) => {
    __activeTab = tab
    const editorId = getEditorIdentity()
    if (editorId) {
      _$_documentEditorsList.setActive(editorId)
      if (tab === __filePathToOpenFromDocument) {
        _$_documentEditorsList.clearTranslation(editorId)
      } else {
        _$_documentEditorsList.setActiveTranslation(editorId, tab)
      }
    }
    _loadedTabs.add(tab) // mark as loaded
  }

  const applyScrollState = async () => {
    if (_uiStateApplied || !_wysiwygScrollEl) return

    const uiState = __documentToOpen?.getUIState?.()
    if (!uiState || typeof uiState.scrollTop !== 'number') return

    // 1. Wait for Svelte to finish updating the DOM (mounting the editor)
    await tick()

    // 2. Use requestAnimationFrame to wait for the next paint
    requestAnimationFrame(() => {
      if (!_wysiwygScrollEl) return

      // 3. Double-check if the content height is actually scrollable yet
      // If it's still 0, the editor hasn't injected the HTML yet.
      if (_wysiwygScrollEl.scrollHeight <= _wysiwygScrollEl.clientHeight) {
        // Optional: Retry once if the editor is slow to load
        setTimeout(() => {
          _wysiwygScrollEl.scrollTop = uiState.scrollTop
        }, 50)
      } else {
        _wysiwygScrollEl.scrollTop = uiState.scrollTop
      }

      _uiStateApplied = true
    })
  }

  const applyScrollState2 = () => {
    // console.log("applyScrollState",{_uiStateApplied,_wysiwygScrollEl})
    if (_uiStateApplied) return
    if (!_wysiwygScrollEl) return
    const uiState = __documentToOpen?.getUIState?.()
    console.log('applyScrollState', { _uiStateApplied, uiState })

    if (!uiState) return
    if (typeof uiState.scrollTop === 'number') {
      requestAnimationFrame(() => {
        console.log('applyScrollState requestAnimationFrame', {
          _uiStateApplied,
          uiState,
          _wysiwygScrollEl
        })

        if (!_wysiwygScrollEl) return
        // _wysiwygScrollEl.scrollTop = uiState.scrollTop
        _wysiwygScrollEl.scrollTo({
          top: uiState.scrollTop,
          behavior: 'instant' // Use 'smooth' if you want a nice transition
        })
      })
    }
    _uiStateApplied = true
  }

  const applySelectionState = () => {
    if (_selectionApplied) return
    const uiState = __documentToOpen?.getUIState?.()
    if (!uiState?.selection) return
    const editor = _$_wysiwygEditorsList.getItem(__wysiwygEditorId)
    if (!editor) return
    try {
      const selection = uiState.selection as { from?: number; to?: number }
      if (typeof selection?.from === 'number' && typeof selection?.to === 'number') {
        editor.commands.setTextSelection({ from: selection.from, to: selection.to })
      } else {
        editor.commands.setTextSelection(uiState.selection as any)
      }
    } catch (error) {
      console.warn('Failed to restore selection', error)
    }
    _selectionApplied = true
  }

  const saveScrollState = () => {
    if (_scrollSaveTimer) clearTimeout(_scrollSaveTimer)
    _scrollSaveTimer = setTimeout(() => {
      __documentToOpen?.setUIState?.({
        scrollTop: _wysiwygScrollEl?.scrollTop ?? 0,
        activeTab: __activeTab
      })
    }, 80)
  }

  const saveSelectionState = () => {
    if (_selectionSaveTimer) clearTimeout(_selectionSaveTimer)
    _selectionSaveTimer = setTimeout(() => {
      const editor = _$_wysiwygEditorsList.getItem(__wysiwygEditorId)
      const selection = editor?.state?.selection?.toJSON?.()
      __documentToOpen?.setUIState?.({
        selection,
        activeTab: __activeTab
      })
    }, 120)
  }

  $effect(() => {
    if (!_wysiwygScrollEl) return
    applyScrollState()

    if (_detachScrollListener) _detachScrollListener()
    const onScroll = () => saveScrollState()
    _wysiwygScrollEl.addEventListener('scroll', onScroll, { passive: true })
    _detachScrollListener = () => _wysiwygScrollEl?.removeEventListener('scroll', onScroll)
  })

  $effect(() => {
    const editor = _$_wysiwygEditorsList.getItem(__wysiwygEditorId)
    if (!editor) return

    applySelectionState()

    if (_detachSelectionListener) _detachSelectionListener()
    editor.on('selectionUpdate', saveSelectionState)
    editor.on('blur', saveSelectionState)
    _detachSelectionListener = () => {
      editor.off('selectionUpdate', saveSelectionState)
      editor.off('blur', saveSelectionState)
    }
  })

  onDestroy(() => {
    if (_detachSelectionListener) _detachSelectionListener()
    if (_detachScrollListener) _detachScrollListener()
    const editor = _$_wysiwygEditorsList.getItem(__wysiwygEditorId)
    const selection = editor?.state?.selection?.toJSON?.()
    __documentToOpen?.setUIState?.({
      scrollTop: _wysiwygScrollEl?.scrollTop ?? 0,
      selection,
      activeTab: __activeTab
    })
  })

  // First set the active tab to the file to open from document
  setActiveTab(__activeTab)

  function scrollLeft() {
    _translatedFilesTabContainer.scrollBy({ left: -100, behavior: 'smooth' })
  }

  function scrollRight() {
    _translatedFilesTabContainer.scrollBy({ left: 100, behavior: 'smooth' })
  }

  // onMount(async () => {
  onMount(() => {
    // await loadFileFunc
    console.log('oncreate EditorWidget.svelte onMount')

    // schedule each child to mount asynchronously
    Object.keys(_ischildReadyForRender).forEach((name) => {
      // defer mounting to next tick or next macrotask
      // render the base immediately and avoid child blocking
      setTimeout(() => {
        _ischildReadyForRender[name] = true
      }, 0) // 0ms is enough to let base render first
    })
  })

  onDestroy(() => {
    // _destroyExpressionInserterInstance()
  })
</script>

<div class="editor-container-wrapper h-full min-h-0 overflow-hidden">
  <!-- __filePathToOpenFromDocument {__filePathToOpenFromDocument} -->
  {#if __isPreviewEditor}
    <FileViewer __src={__filePathToOpenFromDocument} />
  {:else}
    <div class="editor-container h-full min-h-0 overflow-hidden">
      <!-- <div class="editor-container p-[2rem] m-b-[50rem]"> -->
      <div class="flex flex-col h-full min-h-0 overflow-hidden">
        <!-- <TranslateTabList {_allTabs} {__activeTab} {__filePathToOpenFromDocument}></TranslateTabList> -->

        <div
          class="app-component-no-print flex items-center bg-base-200 border-b border-base-200 h-9 select-none"
        >
          <button
            class="w-7 h-full flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-base-300 transition-all border-r border-base-200"
            onclick={scrollLeft}
          >
            <i class="ph-light ph-caret-left text-[14px]"></i>
          </button>

          <div
            bind:this={_translatedFilesTabContainer}
            class="flex-1 overflow-x-auto no-scrollbar flex items-center h-full px-1 scroll-smooth"
          >
            {#each _allTabs as tab}
              {#if tab}
                {@const isMain = tab === __filePathToOpenFromDocument}
                {@const tabParts = tab.split('.')}
                {@const localeCode = isMain ? '' : tabParts[tabParts.length - 2]}

                <button
                  class="relative h-full flex items-center px-4 cursor-pointer whitespace-nowrap transition-all group border-r border-base-300/30"
                  class:bg-base-100={__activeTab === tab}
                  class:active-tab={__activeTab === tab}
                  onclick={() => setActiveTab(tab)}
                >
                  <span
                    class="mr-2 text-sm leading-none {__activeTab === tab
                      ? ''
                      : 'grayscale opacity-50'}"
                  >
                    {isMain ? '🏠' : getFlagEmoji(tab)}
                  </span>

                  <div class="flex flex-col items-start leading-tight">
                    <span
                      class="text-[10px] font-bold uppercase tracking-tighter {__activeTab === tab
                        ? 'text-primary'
                        : 'opacity-60'}"
                    >
                      {isMain ? 'Source' : localeCode}
                    </span>

                    <span
                      class="text-[9px] opacity-30 font-normal italic lowercase truncate max-w-[100px]"
                    >
                      {tab.toString().split(/[/\\]/).pop()}
                    </span>
                  </div>

                  {#if __activeTab === tab}
                    <div
                      class="absolute bottom-0 left-0 right-0 h-[3px] bg-primary shadow-[0_-2px_10px_rgba(var(--p),0.5)]"
                    ></div>
                  {/if}
                </button>
              {/if}
            {/each}
            <ContextMenu>
              <button
                class="w-9 h-full flex items-center justify-center hover:bg-primary/10 hover:text-primary border-l border-base-200 transition-colors"
              >
                <i class="ph-light ph-translate text-[16px]"></i>
                <i class="ph-light ph-plus text-[11px]"></i>
              </button>
              <svelte:fragment slot="content">
                <AddTranslationPicker />
              </svelte:fragment>
            </ContextMenu>
          </div>

          <button
            class="w-7 h-full flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-base-300 transition-all border-l border-base-200"
            onclick={scrollRight}
          >
            <i class="ph-light ph-caret-right text-[14px]"></i>
          </button>

          <ContextMenu>
            <button
              class="w-9 h-full flex items-center justify-center hover:bg-primary/10 hover:text-primary border-l border-base-200 transition-colors"
            >
              <i class="ph-light ph-translate text-[16px]"></i>
              <i class="ph-light ph-plus text-[11px]"></i>
            </button>
            <svelte:fragment slot="content">
              <AddTranslationPicker />
            </svelte:fragment>
          </ContextMenu>
        </div>

        <div
          class:hidden={__activeTab !== __filePathToOpenFromDocument}
          class="h-full min-h-0 overflow-hidden"
        >
          <!-- <vscode-split-layout style="height: 100%;"> -->
          <!-- <vscode-split-layout
            style="height: 100vh; 
          --start-flex-slot-start-wrapper-split-code-editor: {$_$_documentCodeEditorVisible
              ? '1 1 30%'
              : '1 1 0%'};
          --end-flex-slot-start-wrapper-split-code-editor:{$_$_documentCodeEditorVisible
              ? '1 1 70%'
              : '1 1 100%'};"
          > -->
          <!-- {@const showCodePane = $_$_documentCodeEditorVisible && !Platform.isMobileScreen()} -->
          <SplitPane __id="main-split-layout-editor">
            <!-- <Splitpanes style="height: 100%"> -->
            <!-- <Splitpanes style="height: 400px"> -->
            {#if $_$_documentCodeEditorVisible && !Platform.isMobileScreen()}
              <div
                data-initial="30"
                data-min="5"
                data-max="95"
                class="h-full min-h-0 overflow-hidden"
              >
                <!-- <Pane size={30}> -->
                <!-- <div> -->
                <!-- <div
                id="slot-start-wrapper-split-code-editor"
                slot="start"
                size="{$_$_documentCodeEditorVisible ? 30 : 0}%"
              > -->
                <!-- <div
            slot="start"
            style="background:red;"
            size="{$_$_primarySidebarVisible ? 25 : 0}%"
            max="300px"
          > -->
                <!-- <Pane size={70}> -->
                <!-- <CodeEditor
        on:onChangeCodeEditorLanguage={() => {}} -->
                <!-- {#if _ischildReadyForRender} -->

                {#if _ischildReadyForRender.codeEditor}
                  <CodeEditor
                    {__documentToOpen}
                    {__filePathToOpenFromDocument}
                    {__codeEditorId}
                    {__wysiwygEditorId}
                  ></CodeEditor>
                {:else}
                  <div class="flex h-full w-full flex-col gap-4">
                    <div class="skeleton h-full w-full"></div>
                  </div>
                {/if}
                <!-- <ImageEditorUI>
                    <svelte:fragment slot="main">
                      <ImageEditor></ImageEditor>
                    </svelte:fragment>
                  </ImageEditorUI> -->
                <!-- </div> -->
                <!-- </Pane> -->
              </div>
            {/if}
            <!-- <Pane size={30}> -->
            <!-- <Pane size={70}> -->
            <div
              id="slot-end-wysiwyg-editor"
              data-initial={$_$_documentCodeEditorVisible && !Platform.isMobileScreen() ? 70 : 100}
              class="h-full min-h-0 overflow-hidden"
            >
              <div
                id="domWysiwygEditor-{__parentContainerKey}"
                data-id={__parentContainerKey}
                class="wysiwyg-editor px-2 scrollable-section h-full min-h-0 min-w-sm"
                bind:this={_wysiwygScrollEl}
              >
                <!-- <div
                id="domWysiwygEditor-{EditorHelpers.pathToDomId(__parentContainerKey)}"
                data-id={__parentContainerKey}
                class="wysiwyg-editor px-2 scrollable-section h-full min-h-0 min-w-sm"
              > -->
                <!-- <button
      class="bg-blue-500 text-base-content font-bold py-2 px-4 rounded mb-2"
      on:click={updateManually}
    >
      Update Wysiwyg Content
    </button> -->
                <!-- {@html _wysiwygContent} -->
                <!-- { _wysiwygContent} -->
                <!-- {@html _wysiwygContent} -->

                {#if _ischildReadyForRender.wysiwyg}
                  <!-- {#if _ischildReadyForRender2} -->
                  {#if !__isPreviewEditor}
                    {#key _paginationRekey}
                      <!-- __documentToOpen = {__documentToOpen},
    {__filePathToOpenFromDocument},
    {__parentContainerKey}, -->
                      <WysiwygEditor
                        {__documentToOpen}
                        {__filePathToOpenFromDocument}
                        {__parentContainerKey}
                        {__wysiwygEditorId}
                      ></WysiwygEditor>
                    {/key}
                  {:else}
                    <PreviewEditor
                      {__documentToOpen}
                      {__filePathToOpenFromDocument}
                      {__parentContainerKey}
                      __previewEditorId={__wysiwygEditorId}
                    />
                  {/if}
                {:else}
                  <div class="flex h-full w-full flex-col gap-4">
                    <div class="skeleton h-full w-full"></div>
                  </div>
                {/if}
              </div>
              <!-- </Pane> -->
            </div>
            <!-- </Splitpanes> -->
          </SplitPane>
          <!-- </vscode-split-layout> -->
        </div>
        <!-- {:else} -->
        <!-- {:else if __activeTab === translatedFilesTab} -->
        {#each _allTabs as tab}
          {#if tab !== __filePathToOpenFromDocument}
            <div class="h-full min-h-0 overflow-hidden" class:hidden={__activeTab !== tab}>
              <TranslateEditor
                {__wysiwygEditorId}
                __originalPath={__filePathToOpenFromDocument}
                __translatedPath={tab}
              />
            </div>
          {/if}
        {/each}
      </div>
    </div>
    <!-- </div> -->
  {/if}
</div>

{#if !__isPreviewEditor}
  <FormResponseBar />
{/if}

<style>
  /* Add any custom styles here */
  .editor-container {
    height: 100%;
    /* @apply flex;
    width: 100%; */
    /* display: flex;
    height: 100vh;
    overflow: hidden; */
  }
  .wysiwyg-editor {
    /* @apply flex-1;
    display: block;
    border: 1px white solid;
    height: auto;
    padding: 3%;
    overflow: auto; */

    /* flex-grow: 1;
    background-color: #ffffff;
    overflow-y: auto;
    padding: 20px; */
    /* padding-bottom: 4rem; */
  }

  .code-editor-wrapper {
    /* @apply flex-1; */
    /* width: 100%; */
    /* height: 100%; */

    /*  background-color: #f0f0f0;
    overflow-y: auto;
    width: 50px;
    resize: horizontal;
    overflow: auto;
    transition: width 0.2s ease; */
  }
  .code-editor {
    /* width: 100%; */
    /* height: 100%; */
    /* height: 100px; */
  }

  .resizer {
  }

  /* Hide scrollbar but keep scroll functionality */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .unmodifiable-line {
    background-color: #989292;
    color: red;
  }
</style>
