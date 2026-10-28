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
  import type { IFontInfo } from 'font-list'
  import { _ } from 'svelte-i18n'
  import ContextMenu from '../contextMenu/ContextMenu.svelte'
  import {
    ensureFontPickerSync,
    fontPickerState,
    setFontPickerFromUi
  } from '../../../stores/fontPicker.store'

  // --- Props ---
  let {
    __selectedFont = $bindable('Arial'),
    __selectedSize = $bindable(12),
    __onFontSizeChanged,
    __onFontFamilyChanged,
    __onFontHoverPreview
  } = $props()

  // --- State ---
  let isOpen = $state(false)
  let sizeOpen = $state(false)
  let searchTerm = $state('') // This now doubles as our input text when searching
  let _systemFontsLoading = $state(true)
  let __systemAvailableFonts = $state<IFontInfo[]>([])

  let inputElement: HTMLInputElement | null = $state(null)

  const FONT_SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72]

  // --- Derived State ---
  // If the menu is open and user is typing, filter by searchTerm.
  // If the menu is closed, searchTerm is usually empty or matches the selectedFont.
  let filteredFonts = $derived(
    __systemAvailableFonts.filter((f) =>
      (f?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  onMount(async () => {
    ensureFontPickerSync()

    try {
      const fetchedFonts = (await window.api?.getFonts()) ?? []
      __systemAvailableFonts = Array.isArray(fetchedFonts)
        ? (fetchedFonts as any[]).map((font) =>
            typeof font === 'string' ? ({ name: font } as IFontInfo) : (font as IFontInfo)
          )
        : []
    } finally {
      _systemFontsLoading = false
    }
  })

  $effect(() => {
    const shared = $fontPickerState
    if (!shared) return

    // Keep all dropdown instances aligned with active editor selection.
    // Avoid overriding while user is actively typing in search.
    if (!isOpen) {
      __selectedFont = shared.fontFamily
    }
    if (!sizeOpen) {
      __selectedSize = shared.fontSize
    }
  })

  // --- Handlers ---
  function handleInputFocus() {
    isOpen = true
    searchTerm = '' // Clear on focus to show all/start fresh search, like Photoshop
  }

  function handleBlur() {
    // Small timeout to allow 'onclick' of the list items to fire before the list disappears
    setTimeout(() => {
      isOpen = false
      searchTerm = ''
    }, 200)
  }

  function selectFont(fontName: string, closeContextMenu?: () => void) {
    __selectedFont = fontName
    setFontPickerFromUi({ fontFamily: fontName })
    searchTerm = ''
    isOpen = false
    __onFontFamilyChanged?.(__selectedFont)
    closeContextMenu?.()
  }
</script>

<div
  class="theme-font-toolbar flex items-center bg-base-200 border border-[--color-base-400] p-0.5 rounded-sm h-7 text-base-content/85 font-sans select-none"
>
  <div
    class="relative flex-grow min-w-[160px] h-full flex items-center bg-base-100 group focus-within:ring-1 focus-within:ring-primary"
  >
    <ContextMenu>
      <div class="inline-flex items-center cursor-pointer transition-transform active:scale-95">
        <div class="pl-2 pr-1 opacity-50 group-focus-within:text-primary">
          <i class={'ph-light i-icon ph-text-aa w-3.5 h-3.5'}></i>
        </div>

        <input
          bind:this={inputElement}
          type="text"
          placeholder={__selectedFont}
          bind:value={searchTerm}
          onfocus={handleInputFocus}
          onblur={handleBlur}
          class="w-full h-full bg-transparent text-[11px] border-none outline-none text-base-content/85 placeholder:text-base-content/45"
          style="font-family: {searchTerm ? 'sans-serif' : __selectedFont}"
        />
        <!-- <input
        bind:this={inputElement}
        type="text"
        placeholder={__selectedFont}
        bind:value={searchTerm}
        onfocus={handleInputFocus}
        onblur={handleBlur}
        class="w-full h-full bg-transparent text-[11px] border-none outline-none text-base-content/85 placeholder:text-base-content/45"
        style="font-family: {searchTerm ? 'sans-serif' : __selectedFont}"
      /> -->

        <button
          onclick={() => inputElement?.focus()}
          class="h-full px-1 hover:bg-base-content/10 transition-colors border-l border-[--color-base-400]"
        >
          <i class={'ph-light i-icon ph-caret-down w-3 h-3 opacity-40'}></i>
        </button>
      </div>
      <svelte:fragment slot="content" let:closeContextMenu>
        <!-- {#if isOpen} -->
        <!-- <div
          class="absolute top-[calc(100%+2px)] left-[-1px] w-[280px] bg-base-200 border border-[--color-base-400] shadow-2xl z-[1000] rounded-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        > -->
        <div
          class="w-[280px] bg-base-200 border border-[--color-base-400] shadow-2xl z-[1000] rounded-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        >
          <div class="max-h-[350px] overflow-y-auto custom-scrollbar bg-base-100">
            {#if _systemFontsLoading}
              <div
                class="p-4 text-[10px] uppercase tracking-widest text-base-content/45 animate-pulse33 text-center"
              >
                {$_('Initialising Fonts...')}
              </div>
            {:else if filteredFonts.length === 0}
              <div class="p-4 text-[11px] text-base-content/45 text-center italic">
                {$_('No matches found')}
              </div>
            {:else}
              {#each filteredFonts as font}
                <button
                  class="w-full flex items-center justify-between px-3 py-1.5 text-base-content hover:bg-primary hover:text-primary-content group transition-colors border-b border-base-content/10"
                  onmouseenter={() => __onFontHoverPreview?.(font.name)}
                  onclick={() => selectFont(font.name, closeContextMenu)}
                >
                  <div class="flex items-center gap-3">
                    {#if font.name === __selectedFont}
                      <i
                        class={'ph-light i-icon ph-check w-3 h-3 text-primary group-hover:text-primary-content'}
                      ></i>
                    {:else}
                      <div class="w-3"></div>
                    {/if}
                    <span
                      class="text-[12px] group-hover:text-primary-content"
                      style="font-family: {font.name}"
                    >
                      {font.name}
                    </span>
                  </div>
                  <span
                    class="text-[11px] opacity-40 group-hover:opacity-100 group-hover:text-primary-content font-serif"
                    >{$_('Abc')}</span
                  >
                </button>
              {/each}
            {/if}
          </div>

          <div
            class="p-1.5 bg-base-200 border-t border-[--color-base-400] flex justify-between items-center px-3"
          >
            <span class="text-[9px] uppercase font-bold text-base-content/45"
              >{filteredFonts.length} {$_('Fonts')}</span
            >
            <div class="flex gap-2 text-base-content/55">
              <i
                class={'ph-light i-icon ph-funnel w-3 h-3 hover:text-base-content/90 cursor-pointer'}
              ></i>
            </div>
          </div>
        </div>
        <!-- {/if} -->
      </svelte:fragment>
    </ContextMenu>
  </div>

  <div class="relative w-[70px] h-full flex items-center border-l border-[--color-base-400]">
    <!-- <div class="px-1.5 opacity-40"> -->
    <!-- <i class={'ph-light i-icon ph-text-h w-3.5 h-3.5'}></i> -->
    <!-- </div> -->
    <!-- <ContextMenu> -->
    <div class="inline-flex items-center cursor-pointer transition-transform active:scale-95">
      <input
        type="number"
        bind:value={__selectedSize}
        oninput={() => {
          setFontPickerFromUi({ fontSize: Number(__selectedSize) })
          __onFontSizeChanged?.(__selectedSize)
        }}
        class="w-full h-full bg-transparent text-[11px] border-none outline-none hover:bg-base-content/10 px-1 text-center font-mono"
      />
      <ContextMenu>
        <button
          onclick={() => (sizeOpen = !sizeOpen)}
          class="h-full px-1 hover:bg-base-content/10 border-l border-[--color-base-400]"
        >
          <i class={'ph-light i-icon ph-caret-down w-2.5 h-2.5 opacity-40'}></i>
        </button>
        <!-- </div> -->
        <svelte:fragment slot="content" let:closeContextMenu>
          <!-- {#if sizeOpen} -->
          <!-- <div
          class="absolute top-[calc(100%+2px)] right-0 w-[65px] bg-base-200 border border-[--color-base-400] shadow-xl z-[1000] rounded-sm overflow-hidden"
        > -->
          <div
            class="w-[65px] bg-base-200 border border-[--color-base-400] shadow-xl z-[1000] rounded-sm overflow-hidden"
          >
            {#each FONT_SIZES as size}
              <button
                onclick={() => {
                  __selectedSize = size
                  setFontPickerFromUi({ fontSize: Number(size) })
                  sizeOpen = false
                  __onFontSizeChanged?.(__selectedSize)
                  closeContextMenu()
                }}
                class="w-full px-2 py-1.5 text-[11px] text-left text-base-content hover:bg-primary hover:text-primary-content border-b border-base-300 transition-colors"
              >
                {size} pt
              </button>
            {/each}
          </div>
          <!-- {/if} -->
        </svelte:fragment>
      </ContextMenu>
    </div>
  </div>
</div>

<!-- <div
      class="theme-font-toolbar flex items-center bg-base-200 border border-[--color-base-400] p-0.5 rounded-sm h-7 text-base-content/85 font-sans select-none"
>
  <div
    class="relative flex-grow min-w-[160px] h-full flex items-center bg-base-100 group focus-within:ring-1 focus-within:ring-primary"
  >
    <div class="pl-2 pr-1 opacity-50 group-focus-within:text-primary">
      <div class="i-theme-workflow:text-format w-3.5 h-3.5"></div>
    </div>

    <input
      bind:this={inputElement}
      type="text"
      placeholder={__selectedFont}
      bind:value={searchTerm}
      onfocus={handleInputFocus}
      onblur={handleBlur}
      class="w-full h-full bg-transparent text-[11px] border-none outline-none text-base-content/85 placeholder:text-base-content/45"
      style="font-family: {searchTerm ? 'sans-serif' : __selectedFont}"
    />

    <button
      onclick={() => inputElement?.focus()}
      class="h-full px-1 hover:bg-base-content/10 transition-colors border-l border-[--color-base-400]"
    >
      <div class="i-theme-workflow:chevron-down w-3 h-3 opacity-40"></div>
    </button>

    {#if isOpen}
      <div
        class="absolute top-[calc(100%+2px)] left-[-1px] w-[280px] bg-base-200 border border-[--color-base-400] shadow-2xl z-[1000] rounded-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
      >
        <div class="max-h-[350px] overflow-y-auto custom-scrollbar bg-base-100">
          {#if _systemFontsLoading}
            <div
              class="p-4 text-[10px] uppercase tracking-widest text-base-content/45 animate-pulse33 text-center"
            >
              Initialising Fonts...
            </div>
          {:else if filteredFonts.length === 0}
            <div class="p-4 text-[11px] text-base-content/45 text-center italic">No matches found</div>
          {:else}
            {#each filteredFonts as font}
              <button
                class="w-full flex items-center justify-between px-3 py-1.5 hover:bg-primary group transition-colors border-b border-base-content/10"
                onmouseenter={() => __onFontHoverPreview?.(font.name)}
                onclick={() => selectFont(font.name)}
              >
                <div class="flex items-center gap-3">
                  {#if font.name === __selectedFont}
                    <div
                      class="i-theme-workflow:checkmark w-3 h-3 text-primary group-hover:text-primary-content"
                    ></div>
                  {:else}
                    <div class="w-3"></div>
                  {/if}
                  <span class="text-[12px] group-hover:text-primary-content" style="font-family: {font.name}">
                    {font.name}
                  </span>
                </div>
                <span
                  class="text-[11px] opacity-40 group-hover:opacity-100 group-hover:text-primary-content font-serif"
                  >Abc</span
                >
              </button>
            {/each}
          {/if}
        </div>

        <div
          class="p-1.5 bg-base-200 border-t border-[--color-base-400] flex justify-between items-center px-3"
        >
          <span class="text-[9px] uppercase font-bold text-base-content/45"
            >{filteredFonts.length} Fonts</span
          >
          <div class="flex gap-2 text-base-content/55">
            <div class="i-theme-workflow:filter w-3 h-3 hover:text-base-content cursor-pointer"></div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <div class="relative w-[70px] h-full flex items-center border-l border-[--color-base-400]">
    <div class="px-1.5 opacity-40">
      <div class="i-theme-workflow:text-size w-3.5 h-3.5"></div>
    </div>
    <input
      type="number"
      bind:value={__selectedSize}
      class="w-full h-full bg-transparent text-[11px] border-none outline-none hover:bg-base-content/10 px-1 text-center font-mono"
    />
    <button
      onclick={() => (sizeOpen = !sizeOpen)}
      class="h-full px-1 hover:bg-base-content/10 border-l border-[--color-base-400]"
    >
      <div class="i-theme-workflow:chevron-down w-2.5 h-2.5 opacity-40"></div>
    </button>

    {#if sizeOpen}
      <div
        class="absolute top-[calc(100%+2px)] right-0 w-[65px] bg-base-200 border border-[--color-base-400] shadow-xl z-[1000] rounded-sm overflow-hidden"
      >
        {#each FONT_SIZES as size}
          <button
            onclick={() => {
              __selectedSize = size
              sizeOpen = false
              __onFontSizeChanged?.(__selectedSize)
            }}
            class="w-full px-2 py-1.5 text-[11px] text-left hover:bg-primary hover:text-base-content border-b border-base-content/12 transition-colors"
          >
            {size} pt
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div> -->

<style lang="postcss">
  .custom-scrollbar::-webkit-scrollbar {
    width: 5px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(var(--theme-text-rgb), 0.22);
    border-radius: 2px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(var(--theme-text-rgb), 0.06);
  }

  input[type='number']::-webkit-inner-spin-button,
  input[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
</style>
