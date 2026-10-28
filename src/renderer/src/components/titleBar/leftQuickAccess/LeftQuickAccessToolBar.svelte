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
  import { fade } from 'svelte/transition'
  import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../stores/editor.store'
  import { _$_lastActiveEditorId, _$_lastActiveTranslationPath } from '../../../stores/common.store'
  import { onMount } from 'svelte'
  import type { Unsubscriber } from 'svelte/store'
  import {
    canRedoFor,
    canUndoFor,
    getRedoPreview,
    getUndoPreview,
    redoFor,
    subscribeToHistoryChanges,
    undoFor
  } from '../../../stores/history.store'
  import EditorHelpers from '../../../utils/EditorHelpers'
  import SecurityHelpers from '../../../utils/SecurityHelpers'
  import Utils from '../../../utils/Utils'
  import Platform from '../../../libs/platform'
  import { promptAndExport } from '../../../services/export/editorExport.service'
  import {
    exportActiveEditorToDocx,
    exportActiveEditorToOdt
  } from '../../../services/export/docxExport.service'
  import { openFileBackstage } from '../../../stores/fileBackstage.store'
  import { _ } from 'svelte-i18n'
  import { saveActiveDocument } from '../../../services/save/savePipeline.service'
  // import { nodeApi } from '../../../utils/shims/node'
  import {
    isSecureLeaseAvailable,
    notifySecureLeaseRequired,
    secureLeaseStore
  } from '../../../stores/secureLease.store'
  import { svgIcons } from '../../common/icons/Icons'
  import ContextMenu from '../../common/contextMenu/ContextMenu.svelte'
  import { _$_ribbonDisplayPreferences, _$_ribbonUserVisible } from '../../../stores/ribbon.store'
  import { openSettingsModal } from '../../../stores/settingsModal.store'

  // const fs = nodeApi.fs
  // const path = nodeApi.path

  //   const nodeApi =
  //   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
  // const fs = nodeApi?.fs
  // const path = nodeApi?.path

  // import '@phosphor-icons/web/light'
  // import '@phosphor-icons/web/bold'

  // --- Runes: Active Document State ---
  let activeDoc = $state(null)
  let activeEditorEntry = $state(null)
  let activeNodeview = $state(null)
  let lastActiveEditorId = $state(null)
  let lastActiveTranslationPath = $state(null)
  let canUndo = $state(false)
  let canRedo = $state(false)
  let isDirty = $state(false) // Track unsaved changes
  let syncStatus = $state('synced') // 'synced', 'saving', 'error'
  let previewOpen = $state(false)
  let previewKind = $state<'undo' | 'redo' | null>(null)
  let previewItems = $state<{ label: string; at: number }[]>([])
  let previewPos = $state({ x: 0, y: 0 })
  let pressTimer: number | null = null
  let secureLeaseAvailable = $state(isSecureLeaseAvailable())

  const historyContext = $derived.by(() => ({
    editorId: activeEditorEntry?.id?.toString() || '',
    nodeviewId: activeNodeview?.id?.toString() || null
  }))

  const undoTitle = $derived.by(() =>
    canUndo
      ? activeNodeview?.type
        ? `${$_('Undo')} · ${activeNodeview.type}`
        : $_('Undo')
      : $_('Nothing to undo')
  )
  const redoTitle = $derived.by(() =>
    canRedo
      ? activeNodeview?.type
        ? `${$_('Redo')} · ${activeNodeview.type}`
        : $_('Redo')
      : $_('Nothing to redo')
  )

  const resolveHistoryContext = () => {
    const fallbackEntry = _$_wysiwygEditorsList.getActiveEntry?.()
    const fallbackNodeview = _$_wysiwygEditorsList.getActiveNodeviewOfActiveEditor?.()
    const fallbackId = lastActiveTranslationPath || lastActiveEditorId || ''
    return {
      editorId:
        activeEditorEntry?.id?.toString() ||
        fallbackEntry?.id?.toString() ||
        fallbackId?.toString() ||
        '',
      nodeviewId: activeNodeview?.id?.toString() || fallbackNodeview?.id?.toString() || null
    }
  }

  const handleUndo = () => {
    const { editorId, nodeviewId } = resolveHistoryContext()
    if (!editorId) return
    undoFor(editorId, nodeviewId)
  }

  const handleRedo = () => {
    const { editorId, nodeviewId } = resolveHistoryContext()
    if (!editorId) return
    redoFor(editorId, nodeviewId)
  }

  const openPreview = (kind: 'undo' | 'redo', event: MouseEvent | PointerEvent) => {
    event.preventDefault()
    const { editorId, nodeviewId } = resolveHistoryContext()
    if (!editorId) return
    previewKind = kind
    previewItems =
      kind === 'undo' ? getUndoPreview(editorId, nodeviewId) : getRedoPreview(editorId, nodeviewId)
    const target = event.currentTarget as HTMLElement
    const rect = target?.getBoundingClientRect?.()
    previewPos = rect
      ? { x: rect.left, y: rect.bottom + 6 }
      : { x: event.clientX, y: event.clientY }
    previewOpen = true
  }

  const closePreview = () => {
    previewOpen = false
    previewKind = null
  }

  const startPress = (kind: 'undo' | 'redo', event: PointerEvent) => {
    if (pressTimer) window.clearTimeout(pressTimer)
    pressTimer = window.setTimeout(() => {
      openPreview(kind, event)
    }, 420)
  }

  const clearPress = () => {
    if (pressTimer) {
      window.clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  onMount(() => {
    const unsubs: Unsubscriber[] = []
    const activeDocStore = _$_documentEditorsList.getActive()
    const activeEditorStore = _$_wysiwygEditorsList.getActive()
    const activeNodeviewStore = _$_wysiwygEditorsList.getActiveNodeviewOfActiveEditorStore()
    const lastEditorStore = _$_lastActiveEditorId
    const lastTranslationStore = _$_lastActiveTranslationPath
    const refreshHistoryState = () => {
      const fallbackEntry = _$_wysiwygEditorsList.getActiveEntry?.()
      const fallbackNodeview = _$_wysiwygEditorsList.getActiveNodeviewOfActiveEditor?.()
      const fallbackId = lastActiveTranslationPath || lastActiveEditorId || ''
      const editorId =
        activeEditorEntry?.id?.toString() ||
        fallbackEntry?.id?.toString() ||
        fallbackId?.toString() ||
        ''
      const nodeviewId = activeNodeview?.id?.toString() || fallbackNodeview?.id?.toString() || null
      canUndo = editorId ? canUndoFor(editorId, nodeviewId) : false
      canRedo = editorId ? canRedoFor(editorId, nodeviewId) : false
    }

    unsubs.push(
      activeDocStore.subscribe((value) => {
        activeDoc = value
        refreshHistoryState()
      })
    )
    unsubs.push(
      activeEditorStore.subscribe((value) => {
        activeEditorEntry = value
        refreshHistoryState()
      })
    )
    unsubs.push(
      activeNodeviewStore.subscribe((value) => {
        activeNodeview = value
        refreshHistoryState()
      })
    )
    unsubs.push(
      lastEditorStore.subscribe((value) => {
        lastActiveEditorId = value
        refreshHistoryState()
      })
    )
    unsubs.push(
      lastTranslationStore.subscribe((value) => {
        lastActiveTranslationPath = value
        refreshHistoryState()
      })
    )
    unsubs.push(subscribeToHistoryChanges(refreshHistoryState))
    unsubs.push(
      secureLeaseStore.subscribe((state) => {
        secureLeaseAvailable = Boolean(state?.available)
      })
    )

    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        handleUndo()
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', handler)
    const clickHandler = (event: MouseEvent) => {
      if (!previewOpen) return
      const target = event.target as HTMLElement
      if (target?.closest?.('.history-preview')) return
      closePreview()
    }
    window.addEventListener('click', clickHandler)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('click', clickHandler)
      unsubs.forEach((fn) => fn())
    }
  })

  // Innovative: Auto-save status indicator
  const statusColors = {
    synced: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]',
    saving: 'bg-base-300 animate-pulse',
    error: 'bg-red-500 animate-bounce'
  }
  const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop

  async function onSave() {
    syncStatus = 'saving'
    // ... logic for handleSaveDocument()
    syncStatus = 'synced'

    handleSaveDocument()
  }

  async function handleSyncToCloud() {
    const activeDocumentEditor = _$_documentEditorsList.getActiveSync?.()
    if (!activeDocumentEditor) {
      console.warn('No active document found')
      return
    }
    await EditorHelpers.syncDocumentEditorToCloud(activeDocumentEditor)
  }

  async function handleConvertToDocx() {
    await exportActiveEditorToDocx({
      reasonLabel: $_('Exported successfully'),
      promptSelection: true
    })
  }

  async function handleConvertToOdt() {
    await exportActiveEditorToOdt({
      reasonLabel: $_('Exported successfully'),
      promptSelection: true
    })
  }

  async function handleConvertToPDF() {
    await promptAndExport(Utils.FILE_TYPES.pdf)
    // html: activeEntry.editor.toPDFHTML(),
  }
  async function handleSaveDocument() {
    const activeDocumentEditor = _$_documentEditorsList.getActiveSync?.()
    if (!activeDocumentEditor) {
      console.warn('No active document found')
      return
    }
    await saveActiveDocument()
  }
  async function handleSaveDocumentAsSecured() {
    // const activeEntry = _$_wysiwygEditorsList.getActiveEntry?.()
    const activeDocument = _$_documentEditorsList.getActiveSync?.()
    if (!activeDocument) {
      console.warn('No active document found')
      return
    }
    if (!secureLeaseAvailable) {
      await notifySecureLeaseRequired(
        'Secure saving is currently unavailable. Please renew your secure writing license.'
      )
      return
    }
    await saveActiveDocument({ saveAs: true, saveAsSecured: true })
    // EditorHelpers.saveDocumentEditor(activeDocument.document, true)
  }
  const secureSaveTitle = $derived.by(() =>
    secureLeaseAvailable ? $_('Secure Save') : $_('Secure Save — License required')
  )
  let ribbonPreferences = $derived($_$_ribbonDisplayPreferences)
  let ribbonVisible = $derived($_$_ribbonUserVisible)

  function updateRibbonPreference<K extends keyof typeof ribbonPreferences>(
    key: K,
    value: (typeof ribbonPreferences)[K]
  ) {
    _$_ribbonDisplayPreferences.update((preferences) => ({ ...preferences, [key]: value }))
  }
</script>

<div class="flex items-center select-none">
  <div class="flex items-center">
    <button
      class="flex items-center gap-2 px-2 py-1 hover:bg-base-300 rounded-md transition-all group"
      onclick={openFileBackstage}
      title={$_('File')}
    >
      <div class="flex flex-col gap-[2px]">
        <div
          class="w-3 h-[1.5px] bg-[--theme-text-1] group-hover:bg-base-300 transition-colors"
        ></div>
        <div
          class="w-2 h-[1.5px] bg-[--theme-text-1] group-hover:bg-base-300 transition-colors"
        ></div>
        <div
          class="w-3 h-[1.5px] bg-[--theme-text-1] group-hover:bg-base-300 transition-colors"
        ></div>
      </div>
      <span class="text-[12px] font-medium text-base-content/80">{$_('File')}</span>
    </button>
  </div>

  <div class="w-px h-4 bg-[--theme-text-1]/10 mx-2"></div>

  <div class="flex items-center gap-0.5">
    {#if isDesktopPlatform}
      <button
        onclick={onSave}
        class="rail-btn text-base-content/70 relative"
        title={$_('Save Document')}
      >
        <i class="ph-light ph-floppy-disk"></i>
        {#if isDirty}
          <div
            class="absolute top-1.5 right-1.5 size-1.5 rounded-full {statusColors[syncStatus]}"
          ></div>
        {/if}
      </button>
    {/if}

    <button
      onclick={handleSyncToCloud}
      class="rail-btn text-base-content/70"
      title={$_('Sync to Cloud')}
    >
      <i class="ph-light ph-cloud-arrow-up"></i>
    </button>

    <button
      onclick={() => handleConvertToDocx()}
      class="rail-btn text-base-content/70"
      title={$_('Export to Word')}
    >
      <i class="ph-light ph-file-doc"></i>
    </button>

    <button
      onclick={() => handleConvertToOdt()}
      class="rail-btn text-base-content/70"
      title={$_('Export to ODT')}
    >
      <div class="w-[14px]">{@html svgIcons.libreofficeWriter}</div>
      <!-- <i class="ph-light ph-file-text"></i> -->
    </button>

    <button
      onclick={() => handleConvertToPDF()}
      class="rail-btn text-base-content/70"
      title={$_('Export to PDF')}
    >
      <i class="ph-light ph-file-pdf"></i>
    </button>

    {#if isDesktopPlatform}
      <button
        onclick={() => {
          handleSaveDocumentAsSecured()
          // EditorHelpers.saveDocumentEditor(activeDoc, { saveAs: true })
        }}
        class="rail-btn text-base-content/70 group"
        title={secureSaveTitle}
      >
        <i class="ph-light ph-shield-check text-orange-400 group-hover:text-orange-300"></i>
      </button>
    {/if}

    <div class="flex items-center ml-2 mr-1">
      <button
        class="rail-btn text-base-content/70 !px-1.5"
        class:rail-btn--disabled={!canUndo}
        class:rail-btn--ready={canUndo}
        title={undoTitle}
        onclick={handleUndo}
        oncontextmenu={(event) => openPreview('undo', event)}
        onpointerdown={(event) => startPress('undo', event)}
        onpointerup={clearPress}
        onpointerleave={clearPress}
        disabled={!canUndo}><i class="ph-light ph-arrow-u-up-left"></i></button
      >
      <button
        class="rail-btn text-base-content/70 !px-1.5"
        class:rail-btn--disabled={!canRedo}
        class:rail-btn--ready={canRedo}
        title={redoTitle}
        onclick={handleRedo}
        oncontextmenu={(event) => openPreview('redo', event)}
        onpointerdown={(event) => startPress('redo', event)}
        onpointerup={clearPress}
        onpointerleave={clearPress}
        disabled={!canRedo}><i class="ph-light ph-arrow-u-up-right"></i></button
      >
    </div>
  </div>

  <ContextMenu __placement="bottom-start" __offset={[0, 6]}>
    <button class="rail-btn ribbon-menu-trigger" title={$_('Ribbon display options')}>
      <i class="ph-light ph-caret-down"></i>
    </button>
    <svelte:fragment slot="content" let:closeContextMenu>
      <div class="ribbon-options-menu">
        <div class="ribbon-options-title">{$_('Ribbon')}</div>
        <button
          class="ribbon-option"
          role="menuitemcheckbox"
          aria-checked={ribbonVisible}
          onclick={() => {
            _$_ribbonUserVisible.set(!ribbonVisible)
            closeContextMenu()
          }}
        >
          <i class="ph-bold {ribbonVisible ? 'ph-check' : 'ph-blank'}"></i>
          <span>{$_('Show Ribbon')}</span>
        </button>
        <button
          class="ribbon-option"
          role="menuitemcheckbox"
          aria-checked={ribbonPreferences.showGroupNames}
          onclick={() => {
            updateRibbonPreference('showGroupNames', !ribbonPreferences.showGroupNames)
            closeContextMenu()
          }}
        >
          <i class="ph-bold {ribbonPreferences.showGroupNames ? 'ph-check' : 'ph-blank'}"></i>
          <span>{$_('Show Ribbon Group Names')}</span>
        </button>
        <button
          class="ribbon-option"
          role="menuitemcheckbox"
          aria-checked={ribbonPreferences.centerButtons}
          onclick={() => {
            updateRibbonPreference('centerButtons', !ribbonPreferences.centerButtons)
            closeContextMenu()
          }}
        >
          <i class="ph-bold {ribbonPreferences.centerButtons ? 'ph-check' : 'ph-blank'}"></i>
          <span>{$_('Center Ribbon Buttons')}</span>
        </button>
        <button
          class="ribbon-option"
          role="menuitemcheckbox"
          aria-checked={ribbonPreferences.autoCollapse}
          onclick={() => {
            updateRibbonPreference('autoCollapse', !ribbonPreferences.autoCollapse)
            closeContextMenu()
          }}
        >
          <i class="ph-bold {ribbonPreferences.autoCollapse ? 'ph-check' : 'ph-blank'}"></i>
          <span>{$_('Auto Collapse Ribbon')}</span>
        </button>
        <div class="ribbon-option-separator"></div>
        <button
          class="ribbon-option"
          onclick={() => {
            openSettingsModal('shortcuts')
            closeContextMenu()
          }}
        >
          <i class="ph-light ph-sliders-horizontal"></i>
          <span>{$_('Customize Commands')}</span>
          <i class="ph-light ph-caret-right ml-auto"></i>
        </button>
      </div>
    </svelte:fragment>
  </ContextMenu>

  {#if previewOpen}
    <div
      class="history-preview fixed z-50 min-w-48 rounded-md border border-white/10 bg-base-100/95 shadow-lg backdrop-blur px-2 py-1 text-[10px] text-base-content/70"
      style="left: {previewPos.x}px; top: {previewPos.y}px;"
    >
      <div
        class="flex items-center justify-between px-1 py-1 text-[9px] uppercase tracking-[0.14em] text-base-content/40"
      >
        <span>{previewKind === 'undo' ? $_('Undo History') : $_('Redo History')}</span>
        <span>{previewItems.length}</span>
      </div>
      {#if previewItems.length === 0}
        <div class="px-2 py-2 text-base-content/40">{$_('No actions')}</div>
      {:else}
        {#each previewItems as item, idx}
          <div class="px-2 py-1 {idx === 0 ? 'text-base-content/70' : 'text-base-content/60'}">
            {item.label}
          </div>
        {/each}
      {/if}
    </div>
  {/if}

  <!-- <div class="ml-auto flex items-center gap-3 pr-2">
    <div class="flex flex-col items-end">
      <span class="text-[9px] font-black text-base-content/20 uppercase tracking-tighter leading-none"
        >Status</span
      >
      <span class="text-[10px] font-bold text-green-500/70 leading-none">Cloud Synced</span>
    </div>
    <div
      class="size-8 rounded-full bg-[--theme-text-1]/5 border border-white/10 flex items-center justify-center overflow-hidden"
    >
      <i class="ph-light ph-user text-base-content/20 text-lg"></i>
    </div>
  </div> -->
</div>

<style>
  .rail-btn {
    @apply text-[var(--color-base-content)]/70 flex items-center justify-center py-0.5 px-1 rounded-[4px] 
            hover:text-[var(--color-base-content)]/70 hover:bg-[--color-base-300]/50 
           transition-all duration-200 cursor-pointer text-[16px];
  }
  .rail-btn--disabled {
    @apply opacity-30 cursor-not-allowed pointer-events-none;
  }
  .rail-btn--ready {
    @apply text-[var(--color-base-content)]/70;
  }
  .history-preview {
    @apply select-none;
  }

  .ribbon-options-menu {
    width: 20rem;
    padding: 0.35rem;
    border: 1px solid var(--color-base-300);
    border-radius: 0.5rem;
    background: var(--color-base-100);
    box-shadow: 0 12px 28px color-mix(in srgb, black 25%, transparent);
  }
  .ribbon-options-title {
    padding: 0.35rem 0.55rem 0.45rem;
    color: color-mix(in srgb, var(--color-base-content) 55%, transparent);
    font-size: 11px;
    font-weight: 700;
  }
  .ribbon-option {
    display: flex;
    width: 100%;
    min-height: 2rem;
    align-items: center;
    gap: 0.55rem;
    padding: 0.35rem 0.55rem;
    border-radius: 0.3rem;
    color: var(--color-base-content);
    font-size: 12px;
    text-align: left;
  }
  .ribbon-option:hover {
    background: var(--color-base-200);
  }
  .ribbon-option > i:first-child {
    width: 0.85rem;
    font-size: 11px;
  }
  .ribbon-option-separator {
    height: 1px;
    margin: 0.35rem;
    background: var(--color-base-300);
  }

  /* Customizing the Phosphor Bold icons for micro-ui */
  :global(.ph-light) {
    display: inline-block;
  }
</style>
