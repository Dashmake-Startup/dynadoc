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
  import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../stores/editor.store'
  import { _ } from 'svelte-i18n'

  // State for view modes
  type ViewMode = 'normal' | 'sorter' | 'reading' | 'slideshow'
  let activeView = $state<ViewMode>('normal')

  // State for zoom and notes
  let zoomLevel = $state(85)
  let showNotes = $state(false)
  let showComments = $state(false)

  // Constants
  const MIN_ZOOM = 10
  const MAX_ZOOM = 400

  function fitToWindow() {
    zoomLevel = 85 // Logic to calculate actual fit would go here
  }

  const activeWysiwygEntryStore = _$_wysiwygEditorsList.getActive()
  const activeWysiwygEntry = $derived($activeWysiwygEntryStore)
  const _wysiwygEditor = $derived(activeWysiwygEntry?.editor ?? null)
</script>

<div
  class="flex items-center h-full text-[11px] font-sans select-none text-base-content/60 bg-base-100 border-t border-base-300"
>
  <div class="flex items-center h-full border-r border-white/10">
    <button
      onclick={() => (showNotes = !showNotes)}
      class="status-text-action flex items-center px-3 h-full hover:bg-base-200 transition-colors"
      class:text-base-content={showNotes}
      class:bg-base-200={showNotes}
      title={$_('Notes')}
    >
      <i class="status-action-icon ph-bold ph-note-blank mr-1.5 text-[14px]"></i>
      <span class="status-action-label status-notes-label">{$_('Notes')}</span>
    </button>

    <button
      onclick={() => (showComments = !showComments)}
      class="status-text-action flex items-center px-3 h-full hover:bg-base-200 transition-colors border-l border-white/5"
      class:text-base-content={showComments}
      class:bg-base-200={showComments}
      title={$_('Comments')}
    >
      <i class="status-action-icon ph-bold ph-chat-centered-text mr-1.5 text-[14px]"></i>
      <span class="status-action-label status-comments-label">{$_('Comments')}</span>
    </button>
  </div>

  <div class="flex items-center h-full px-1 border-r border-white/10 bg-base-100">
    <button
      onclick={() => (activeView = 'normal')}
      class="w-8 h-full flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] transition-all cursor-pointer"
      class:text-primary={activeView === 'normal'}
      title={$_('Normal View')}
    >
      <i class="ph-bold ph-monitor text-[15px]"></i>
    </button>

    <button
      onclick={() => (activeView = 'sorter')}
      class="w-8 h-full flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] transition-all cursor-pointer"
      class:text-primary={activeView === 'sorter'}
      title={$_('Slide Sorter')}
    >
      <i class="ph-bold ph-squares-four text-[15px]"></i>
    </button>

    <button
      onclick={() => (activeView = 'reading')}
      class="w-8 h-full flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] transition-all cursor-pointer"
      class:text-primary={activeView === 'reading'}
      title={$_('Reading View')}
    >
      <i class="ph-bold ph-book-open text-[15px]"></i>
    </button>

    <button
      onclick={() => {
        const startPresentation = _wysiwygEditor?.commands?.startPresentation
        if (typeof startPresentation === 'function') {
          startPresentation()
          activeView = 'slideshow'
        }
      }}
      class="w-8 h-full flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-base-content animate-pulse33 cursor-pointer"
      title={$_('Start Slideshow')}
    >
      <i class="ph-bold ph-monitor-play text-[16px]"></i>
    </button>
  </div>

  <!-- <div class="flex items-center h-full px-3 gap-2">
    <button
      onclick={() => (zoomLevel = 100)}
      class="w-10 text-right font-mono text-[10px] hover:text-base-content cursor-pointer"
    >
      {zoomLevel}%
    </button>

    <div class="flex items-center gap-2 group">
      <button
        onclick={() => (zoomLevel = Math.max(MIN_ZOOM, zoomLevel - 10))}
        class="opacity-50 hover:opacity-100"
      >
        <i class="ph-bold ph-minus"></i>
      </button>

      <div class="relative w-20 h-0.5 bg-base-200">
        <div
          class="absolute h-full bg-base-variant"
          style="width: {(zoomLevel / MAX_ZOOM) * 100}%"
        ></div>
        <-- <div class="absolute h-full bg-orange-500" style="width: {(zoomLevel / MAX_ZOOM) * 100}%"></div> --
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          bind:value={zoomLevel}
          class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      <button
        onclick={() => (zoomLevel = Math.min(MAX_ZOOM, zoomLevel + 10))}
        class="opacity-50 hover:opacity-100"
      >
        <i class="ph-bold ph-plus"></i>
      </button>
    </div>

    <button
      onclick={fitToWindow}
      class="ml-2 flex items-center justify-center w-7 h-full hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] transition-colors"
      title="Fit slide to current window"
    >
      <i class="ph-bold ph-frame-corners text-[14px]"></i>
    </button>
  </div> -->
</div>

<style>
  @media (max-width: 1260px) {
    .status-notes-label {
      display: none;
    }

    .status-text-action:first-child .status-action-icon {
      margin-right: 0;
    }

    .status-text-action:first-child {
      width: 2rem;
      justify-content: center;
      padding-left: 0;
      padding-right: 0;
    }
  }

  @media (max-width: 1120px) {
    .status-action-label {
      display: none;
    }

    .status-action-icon {
      margin-right: 0;
    }

    .status-text-action {
      width: 2rem;
      justify-content: center;
      padding-left: 0;
      padding-right: 0;
    }
  }
</style>
