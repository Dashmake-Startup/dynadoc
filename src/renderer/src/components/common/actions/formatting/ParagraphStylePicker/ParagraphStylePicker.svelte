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
  import type { Editor } from '@tiptap/core'
  import { onDestroy, onMount } from 'svelte'
  import ContextMenu from '../../../contextMenu/ContextMenu.svelte'
  import Layout from '../../../layout/layout'
  import { GenericFormatingEditorCommands } from '../index'
  import { _$_wysiwygEditorsList } from '../../../../../stores/editor.store'

  let { layout = Layout.LAYOUT.COLUMN, displayFontSizePicker = true } = $props()

  type StyleTab = 'styles' | 'paragraph' | 'lists'
  type StylePresetId =
    | 'normal'
    | 'noSpacing'
    | 'title'
    | 'subtitle'
    | 'heading1'
    | 'heading2'
    | 'heading3'
    | 'quote'

  type StylePreset = {
    id: StylePresetId
    label: string
    preview: string
    className: string
    apply: () => void
    isActive: () => boolean
  }

  let activeTab: StyleTab = 'styles'
  let activeEditor: Editor | null = null
  let currentStyleLabel = 'Normal'
  let currentContextHint = 'Paragraph'
  let inTable = false
  let inList = false
  let hasEditor = false
  let lineSpacing = 1.15
  let recentStyles: StylePresetId[] = []

  let detachEditorListeners: (() => void) | null = null
  let unsubscribeActiveEditor: (() => void) | null = null

  function run(action: () => unknown) {
    try {
      action()
      queueMicrotask(syncFromEditor)
    } catch (error) {
      console.error('[ParagraphStylePicker] action failed', error)
    }
  }

  function detectCurrentStyle(): StylePresetId {
    if (!activeEditor) return 'normal'
    if (activeEditor.isActive('heading', { level: 1 })) return 'heading1'
    if (activeEditor.isActive('heading', { level: 2 })) return 'heading2'
    if (activeEditor.isActive('heading', { level: 3 })) return 'heading3'
    if (activeEditor.isActive('blockquote')) return 'quote'
    if (activeEditor.isActive('paragraph') && Math.abs(lineSpacing - 1) < 0.01) {
      return 'noSpacing'
    }
    return 'normal'
  }

  function updateRecentStyles(id: StylePresetId) {
    recentStyles = [id, ...recentStyles.filter((v) => v !== id)].slice(0, 4)
  }

  function applyStylePreset(id: StylePresetId) {
    const preset = stylePresets.find((item) => item.id === id)
    if (!preset) return
    run(() => preset.apply())
    updateRecentStyles(id)
  }

  function syncFromEditor() {
    if (!activeEditor) {
      hasEditor = false
      currentStyleLabel = 'Normal'
      currentContextHint = 'Paragraph'
      inTable = false
      inList = false
      lineSpacing = 1.15
      return
    }

    hasEditor = true
    inTable =
      activeEditor.isActive('table') ||
      activeEditor.isActive('tableRow') ||
      activeEditor.isActive('tableCell')
    inList =
      activeEditor.isActive('bulletList') ||
      activeEditor.isActive('orderedList') ||
      activeEditor.isActive('taskList')

    const paraAttrs = activeEditor.getAttributes('paragraph') || {}
    const headingAttrs = activeEditor.getAttributes('heading') || {}
    const spacing = Number(paraAttrs?.lineSpacing ?? headingAttrs?.lineSpacing)
    lineSpacing = Number.isFinite(spacing) ? spacing : 1.15

    const current = detectCurrentStyle()
    currentStyleLabel = stylePresets.find((item) => item.id === current)?.label ?? 'Normal'

    if (inTable) {
      currentContextHint = 'Table Context'
      return
    }
    if (activeEditor.isActive('blockquote')) {
      currentContextHint = 'Quote Block'
      return
    }
    if (inList) {
      currentContextHint = 'List Paragraph'
      return
    }
    if (activeEditor.isActive('heading', { level: 1 })) {
      currentContextHint = 'Heading 1'
      return
    }
    if (activeEditor.isActive('heading', { level: 2 })) {
      currentContextHint = 'Heading 2'
      return
    }
    if (activeEditor.isActive('heading', { level: 3 })) {
      currentContextHint = 'Heading 3'
      return
    }
    currentContextHint = 'Paragraph'
  }

  function bindEditor(editor: Editor | null) {
    if (detachEditorListeners) {
      detachEditorListeners()
      detachEditorListeners = null
    }

    activeEditor = editor

    if (!editor) {
      syncFromEditor()
      return
    }

    const sync = () => syncFromEditor()
    editor.on('selectionUpdate', sync)
    editor.on('transaction', sync)
    editor.on('focus', sync)
    editor.on('blur', sync)

    detachEditorListeners = () => {
      editor.off('selectionUpdate', sync)
      editor.off('transaction', sync)
      editor.off('focus', sync)
      editor.off('blur', sync)
    }

    sync()
  }

  onMount(() => {
    unsubscribeActiveEditor = _$_wysiwygEditorsList.getActive().subscribe((entry) => {
      bindEditor(entry?.editor ?? null)
    })
  })

  onDestroy(() => {
    if (unsubscribeActiveEditor) unsubscribeActiveEditor()
    if (detachEditorListeners) detachEditorListeners()
  })

  const stylePresets: StylePreset[] = [
    {
      id: 'normal',
      label: 'Normal',
      preview: 'Standard body paragraph text.',
      className: 'is-normal',
      apply: () => {
        GenericFormatingEditorCommands.paragraph()
        GenericFormatingEditorCommands.setLineSpacing(1.15)
      },
      isActive: () => Boolean(activeEditor?.isActive('paragraph'))
    },
    {
      id: 'noSpacing',
      label: 'No Spacing',
      preview: 'Tight paragraph spacing for compact docs.',
      className: 'is-no-spacing',
      apply: () => {
        GenericFormatingEditorCommands.paragraph()
        GenericFormatingEditorCommands.setLineSpacing(1)
        GenericFormatingEditorCommands.removeSpaceAfter()
      },
      isActive: () =>
        Boolean(activeEditor?.isActive('paragraph')) && Math.abs(lineSpacing - 1) < 0.01
    },
    {
      id: 'title',
      label: 'Title',
      preview: 'Prominent top-level document title.',
      className: 'is-title',
      apply: () => {
        GenericFormatingEditorCommands.heading(1)
        GenericFormatingEditorCommands.alignCenter()
      },
      isActive: () =>
        Boolean(activeEditor?.isActive('heading', { level: 1 })) &&
        Boolean(activeEditor?.isActive({ textAlign: 'center' }))
    },
    {
      id: 'subtitle',
      label: 'Subtitle',
      preview: 'Secondary title or contextual subtitle.',
      className: 'is-subtitle',
      apply: () => {
        GenericFormatingEditorCommands.heading(2)
        GenericFormatingEditorCommands.alignCenter()
      },
      isActive: () =>
        Boolean(activeEditor?.isActive('heading', { level: 2 })) &&
        Boolean(activeEditor?.isActive({ textAlign: 'center' }))
    },
    {
      id: 'heading1',
      label: 'Heading 1',
      preview: 'Primary section heading.',
      className: 'is-heading-1',
      apply: () => GenericFormatingEditorCommands.heading(1),
      isActive: () => Boolean(activeEditor?.isActive('heading', { level: 1 }))
    },
    {
      id: 'heading2',
      label: 'Heading 2',
      preview: 'Secondary section heading.',
      className: 'is-heading-2',
      apply: () => GenericFormatingEditorCommands.heading(2),
      isActive: () => Boolean(activeEditor?.isActive('heading', { level: 2 }))
    },
    {
      id: 'heading3',
      label: 'Heading 3',
      preview: 'Tertiary section heading.',
      className: 'is-heading-3',
      apply: () => GenericFormatingEditorCommands.heading(3),
      isActive: () => Boolean(activeEditor?.isActive('heading', { level: 3 }))
    },
    {
      id: 'quote',
      label: 'Quote',
      preview: 'Indented quote for references.',
      className: 'is-quote',
      apply: () => GenericFormatingEditorCommands.blockquote(),
      isActive: () => Boolean(activeEditor?.isActive('blockquote'))
    }
  ]

  const quickStyleIds: StylePresetId[] = ['normal', 'heading1', 'heading2', 'quote']

  let quickStyles = $derived(
    quickStyleIds
      .map((id) => stylePresets.find((item) => item.id === id))
      .filter(Boolean) as StylePreset[]
  )

  let recentStyleObjects = $derived(
    recentStyles
      .map((id) => stylePresets.find((item) => item.id === id))
      .filter(Boolean) as StylePreset[]
  )
</script>

<div class="adobe-style-orchestrator style-picker">
  <div class="adobe-toolbar-group" role="toolbar">
    <!-- <div class="quick-access">
      {#each quickStyles as preset (preset.id)}
        <button
          type="button"
          class="adobe-tool-btn"
          class:is-active={preset.isActive()}
          on:click={() => applyStylePreset(preset.id)}
          disabled={!hasEditor}
        >
          <span class="btn-label {preset.className}">{preset.label}</span>
        </button>
      {/each}
    </div> -->

    <div class="adobe-ribbon-strip">
      <div class="quick-access-viewport">
        {#each quickStyles as preset (preset.id)}
          <button
            type="button"
            class="ribbon-tab"
            class:is-active={preset.isActive()}
            on:click={() => applyStylePreset(preset.id)}
            disabled={!hasEditor}
          >
            <div class="micro-preview {preset.className}" aria-hidden="true">
              <span class="line"></span>
              <span class="line"></span>
              <span class="line"></span>
            </div>

            <span class="tab-label {preset.className}">{preset.label}</span>

            {#if preset.isActive()}
              <div class="active-bar"></div>
            {/if}
          </button>
        {/each}
      </div>

      <div class="v-divider"></div>
    </div>

    <ContextMenu __placement="bottom-start" __offset={[0, 10]}>
      <button
        type="button"
        class="adobe-dropdown-trigger"
        class:is-active={!['Normal'].includes(currentStyleLabel)}
        disabled={!hasEditor}
      >
        <div class="trigger-content">
          <span class="eyebrow">{currentContextHint}</span>
          <span class="current-val">{currentStyleLabel}</span>
        </div>
        <i class="ph-bold ph-caret-down"></i>
      </button>

      <div slot="content" class="adobe-style-pane no-scrollbar">
        <header class="pane-header">
          <div class="title-stack">
            <span class="main-title">{$_('TYPOGRAPHY ORCHESTRATOR')}</span>
            <span class="sub-title">{$_('Manage structural and local formatting')}</span>
          </div>
          <button
            type="button"
            class="action-icon-btn"
            title={$_('Clear all direct styling')}
            on:click={() => run(() => GenericFormatingEditorCommands.clearFormatting())}
          >
            <i class="ph-bold ph-broom"></i>
          </button>
        </header>

        <nav class="adobe-tabs">
          {#each ['styles', 'paragraph', 'lists'] as tab}
            <button class:is-active={activeTab === tab} on:click={() => (activeTab = tab)}>
              {tab.toUpperCase()}
            </button>
          {/each}
        </nav>

        <div class="pane-content">
          {#if activeTab === 'styles'}
            <div class="section">
              <span class="section-label">{$_('SYSTEM_PRESETS')}</span>
              <div class="styles-grid">
                {#each stylePresets as preset (preset.id)}
                  <button
                    type="button"
                    class="style-card"
                    class:is-active={preset.isActive()}
                    on:click={() => applyStylePreset(preset.id)}
                  >
                    <div class="card-identity">
                      <span class="card-title {preset.className}">{preset.label}</span>
                      <i class="ph-bold ph-check-circle active-indicator"></i>
                    </div>
                    <span class="card-desc">{preset.preview}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          {#if activeTab === 'paragraph'}
            <div class="section">
              <span class="section-label">{$_('ALIGNMENT_&_SPACING')}</span>
              <div class="adobe-grid-4">
                {#each ['left', 'center', 'right', 'justify'] as align}
                  <button
                    class:is-active={activeEditor?.isActive({ textAlign: align })}
                    on:click={() =>
                      run(() =>
                        (GenericFormatingEditorCommands as any)[
                          `align${align.charAt(0).toUpperCase() + align.slice(1)}`
                        ]()
                      )}
                  >
                    <i class="ph-bold ph-text-align-{align}"></i>
                  </button>
                {/each}
              </div>

              <div class="spacing-strip mt-4">
                {#each [1, 1.15, 1.5, 2] as spacing}
                  <button
                    class:is-active={Math.abs(lineSpacing - spacing) < 0.01}
                    on:click={() =>
                      run(() => GenericFormatingEditorCommands.setLineSpacing(spacing))}
                  >
                    {spacing}x
                  </button>
                {/each}
              </div>
            </div>

            <div class="section border-t pt-4">
              <div class="adobe-grid-2">
                <button on:click={() => run(() => GenericFormatingEditorCommands.indent())}>
                  <i class="ph-bold ph-text-indent"></i>{$_('INDENT')}</button
                >
                <button on:click={() => run(() => GenericFormatingEditorCommands.outdent())}>
                  <i class="ph-bold ph-text-outdent"></i>{$_('OUTDENT')}</button
                >
              </div>
            </div>
          {/if}

          {#if activeTab === 'lists'}
            <div class="section">
              <span class="section-label">{$_('STRUCTURAL_BLOCKS')}</span>
              <div class="adobe-grid-2">
                <button
                  on:click={() => run(() => GenericFormatingEditorCommands.bulletList())}
                  class:is-active={activeEditor?.isActive('bulletList')}
                >
                  <i class="ph-bold ph-list-bullets"></i>{$_('BULLETS')}</button
                >
                <button
                  on:click={() => run(() => GenericFormatingEditorCommands.orderedList())}
                  class:is-active={activeEditor?.isActive('orderedList')}
                >
                  <i class="ph-bold ph-list-numbers"></i>{$_('NUMBERED')}</button
                >
                <button
                  on:click={() => run(() => GenericFormatingEditorCommands.taskList())}
                  class:is-active={activeEditor?.isActive('taskList')}
                >
                  <i class="ph-bold ph-list-checks"></i>{$_('CHECKLIST')}</button
                >
                <button
                  on:click={() => run(() => GenericFormatingEditorCommands.blockquote())}
                  class:is-active={activeEditor?.isActive('blockquote')}
                >
                  <i class="ph-bold ph-quotes"></i>{$_('BLOCKQUOTE')}</button
                >
              </div>
            </div>

            {#if inTable}
              <div class="section highlight-box">
                <span class="section-label text-base-300">{$_('TABLE_CONTEXT_ACTIVE')}</span>
                <div class="adobe-grid-2 mt-2">
                  <button on:click={() => run(() => GenericFormatingEditorCommands.addRowAfter())}
                    ><i class="ph-bold ph-rows"></i>{$_('+ROW')}</button
                  >
                  <button
                    on:click={() => run(() => GenericFormatingEditorCommands.addColumnAfter())}
                    ><i class="ph-bold ph-columns"></i>{$_('+COL')}</button
                  >
                </div>
              </div>
            {/if}
          {/if}
        </div>
      </div>
    </ContextMenu>
  </div>
</div>

<style lang="postcss">
  /* --- Adobe Spectrum 2 Fundamentals --- */
  .adobe-style-orchestrator {
    @apply flex items-center bg-[var(--color-base-200)] p-1 rd-[6px] border border-[var(--color-base-300)] shadow-inner;
  }

  .adobe-toolbar-group {
    @apply flex items-center gap-1;
  }

  /* --- Tool Buttons --- */
  .adobe-tool-btn {
    @apply h-8 px-3 rd-[4px] flex items-center bg-transparent text-[var(--color-base-content)]/40 
           hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] hover:text-[var(--color-base-content)] transition-all text-[11px] font-700 uppercase tracking-widest;
  }
  .adobe-tool-btn.is-active {
    @apply bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] rd-b-0;
  }

  /* --- Dropdown Trigger --- */
  .adobe-dropdown-trigger {
    @apply h-9 px-3 rd-[4px] bg-[var(--color-base-200)] border border-[var(--color-base-300)] flex items-center gap-4
           min-w-[140px] text-left transition-all hover:border-[var(--color-primary)]/40;
  }
  .trigger-content {
    @apply flex flex-col flex-1;
  }
  .eyebrow {
    @apply text-[8px] font-900 text-[var(--color-primary)] tracking-[0.2em] uppercase;
  }
  .current-val {
    @apply text-[11px] font-700 text-[var(--color-base-content)]/80;
  }

  /* --- Advanced Style Pane --- */
  .adobe-style-pane {
    @apply w-[340px] bg-[var(--color-base-100)] border border-[var(--color-base-300)] rd-[4px] shadow-[0_24px_48px_rgba(0,0,0,0.6)]
           overflow-hidden flex flex-col;
  }

  .pane-header {
    @apply flex items-center justify-between p-4 bg-[var(--color-base-200)] border-b border-[var(--color-base-300)];
  }
  .main-title {
    @apply text-[10px] font-900 tracking-[0.2em] text-[var(--color-primary)] block;
  }
  .sub-title {
    @apply text-[10px] text-[var(--color-base-content)]/30 block mt-0.5;
  }

  /* --- Adobe Mechanical Tabs --- */
  .adobe-tabs {
    @apply flex p-1 bg-[var(--color-base-200)] border-b border-[var(--color-base-300)];
  }
  .adobe-tabs button {
    @apply flex-1 py-1.5 text-[9px] font-900 tracking-widest text-[var(--color-base-content)]/20 rd-[3px] transition-all;
  }
  .adobe-tabs button.is-active {
    @apply bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-[var(--color-base-content)] shadow-lg;
  }

  /* --- Sections & Cards --- */
  .pane-content {
    @apply p-4 max-h-[480px] overflow-y-auto;
  }
  .section-label {
    @apply text-[9px] font-900 text-[var(--color-base-content)]/20 tracking-widest block mb-3;
  }

  .style-card {
    @apply w-full p-3 mb-1 rd-[4px] border border-[var(--color-base-300)] bg-[color-mix(in_srgb,var(--color-base-white)_2%,transparent)] 
           text-left transition-all hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)];
  }
  .style-card.is-active {
    @apply border-[var(--color-primary)]/40 bg-[color-mix(in_srgb,var(--color-primary)_5%,transparent)];
  }
  .card-identity {
    @apply flex justify-between items-center;
  }
  .card-title {
    @apply text-[12px] font-700 text-[var(--color-base-content)]/90;
  }
  .card-desc {
    @apply text-[10px] text-[var(--color-base-content)]/40 block mt-1 leading-relaxed;
  }
  .active-indicator {
    @apply opacity-0 text-[var(--color-primary)];
  }
  .is-active .active-indicator {
    @apply opacity-100;
  }

  /* --- Grids --- */
  .adobe-grid-4 {
    @apply grid grid-cols-4 gap-px bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] border border-[var(--color-base-300)] rd-[4px] overflow-hidden;
  }
  .adobe-grid-4 button {
    @apply h-10 bg-[var(--color-base-100)] text-[var(--color-base-content)]/30 hover:text-[var(--color-base-content)] transition-all;
  }
  .adobe-grid-4 button.is-active {
    @apply text-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)];
  }

  .adobe-grid-2 {
    @apply grid grid-cols-2 gap-2;
  }
  .adobe-grid-2 button {
    @apply h-9 bg-[color-mix(in_srgb,var(--color-base-white)_2%,transparent)] border border-[var(--color-base-300)] rd-[4px] text-[10px] font-800 
           tracking-widest flex items-center justify-center gap-2 text-[var(--color-base-content)]/40 hover:text-[var(--color-base-content)];
  }

  .highlight-box {
    @apply mt-4 p-3 bg-[color-mix(in_srgb,var(--color-primary)_5%,transparent)] rd-[4px] border border-[var(--color-primary)]/10;
  }

  /* Preset Styles (Typography Preview) */
  .is-title {
    @apply text-[16px] font-900 tracking-tighter;
  }
  .is-heading-1 {
    @apply text-[14px] font-800;
  }
  .is-quote {
    @apply border-l-2 border-[var(--color-primary)] pl-2 italic;
  }

  /* --- Ribbon Container --- */
  .adobe-ribbon-strip {
    @apply flex items-center h-full max-h-12 overflow-hidden;
  }

  .quick-access-viewport {
    @apply flex items-center h-full gap-0.5;
  }

  /* --- The Ribbon Tab --- */
  .ribbon-tab {
    @apply relative flex flex-col items-center justify-center px-3 h-full 
           min-w-[70px] bg-transparent transition-all duration-150
           hover:bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] disabled:opacity-30;
  }

  /* Adobe Spectrum 2 Active State */
  .ribbon-tab.is-active {
    @apply bg-[color-mix(in_srgb,var(--color-base-white)_6%,transparent)];
  }

  .tab-label {
    @apply text-[10px] font-800 tracking-tight text-[var(--color-base-content)]/40 uppercase 
           whitespace-nowrap transition-colors mt-0.5;
  }

  .is-active .tab-label {
    @apply text-[var(--color-primary)];
  }

  /* --- Micro-Preview Icon (Innovative Idea) --- */
  /* This gives the user a visual "shape" of the paragraph without reading */
  .micro-preview {
    @apply flex flex-col gap-0.5 w-4 opacity-30 group-hover:opacity-60;
  }
  .line {
    @apply h-[1.5px] w-full bg-current rd-full;
  }

  /* Style-specific glyph adjustments */
  .micro-preview.is-heading-1 .line:first-child {
    @apply h-[3px] w-3/4;
  }
  .micro-preview.is-quote .line {
    @apply ml-1 w-3;
  }
  .micro-preview.is-title .line:first-child {
    @apply h-[4px] w-full;
  }

  /* --- The Teal Indicator Bar --- */
  .active-bar {
    @apply absolute bottom-0 left-1 right-1 h-[2px] bg-[var(--color-primary)] 
           shadow-[0_0_8px_rgba(43,118,246,0.35)] rd-t-1px;
  }

  /* --- Technical Dividers --- */
  .v-divider {
    @apply w-px h-6 bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] mx-2;
  }

  /* CSS overrides for the labels to keep them small in ribbon */
  :global(.tab-label.is-title) {
    font-weight: 900;
  }
  :global(.tab-label.is-heading-1) {
    font-weight: 800;
  }
  :global(.tab-label.is-quote) {
    font-style: italic;
  }
</style>
