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
  import { onMount } from 'svelte'

  // State for toggles
  let isPrintLayout = $state(true)
  let isEyeProtection = $state(false)
  let isOutlineView = $state(false)
  let zoomLevel = $state(100)

  // Helper for tooltips or "status" descriptions
  let statusMessage = $state('')

  const setStatus = (msg: string) => (statusMessage = msg)
  const clearStatus = () => (statusMessage = '')
</script>

<div
  class="flex items-center h-full text-[11px] font-sans select-none border-l border-base-300 text-base-content/70 bg-base-100"
>
  <div class="flex items-center h-full px-1 border-r border-white/5">
    <button
      class="flex items-center justify-center w-7 h-full hover:bg-base-200 transition-colors group"
      class:bg-base-200={isPrintLayout}
      class:text-primary={isPrintLayout}
      onclick={() => (isPrintLayout = !isPrintLayout)}
      onmouseenter={() =>
        setStatus('Print Layout: Show the document as it will appear on the printed page.')}
      onmouseleave={clearStatus}
      title={$_('Print Layout')}
    >
      <i class="ph-bold ph-layout text-[14px]"></i>
    </button>

    <button
      class="flex items-center justify-center w-7 h-full hover:bg-base-200 transition-colors group"
      class:bg-base-200={isOutlineView}
      class:text-primary={isOutlineView}
      onclick={() => (isOutlineView = !isOutlineView)}
      onmouseenter={() =>
        setStatus('Outline: View the document as an outline with nested headings.')}
      onmouseleave={clearStatus}
      title={$_('Outline View')}
    >
      <i class="ph-bold ph-list-dashes text-[14px]"></i>
    </button>
  </div>

  <div
    class="flex items-center h-full px-2 border-r border-white/5 group hover:bg-base-200 cursor-pointer"
    onclick={() => (isEyeProtection = !isEyeProtection)}
    title={$_('Eye Protection')}
  >
    <i
      class="ph-bold {isEyeProtection ? 'ph-eye' : 'ph-eye-closed'} mr-1.5 {isEyeProtection
        ? 'text-orange-300'
        : 'opacity-50'}"
    ></i>
    <!-- <span class="tracking-tight">Eye Protection: <b>{isEyeProtection ? 'ON' : 'OFF'}</b></span> -->
  </div>

  <div
    class="hidden xl:flex items-center h-full px-3 border-r border-white/5 opacity-60 hover:opacity-100 transition-opacity"
  >
    <i class="ph-bold ph-check-circle mr-1.5 text-green-500"></i>
    <!-- <span>Accessibility: Good</span> -->
  </div>

  <button
    class="flex items-center justify-center w-9 h-full hover:bg-red-900/20 text-base-content/40 hover:text-base-content"
    title={$_('Notifications')}
  >
    <i class="ph-bold ph-bell-simple"></i>
  </button>
</div>

<style>
  /* Input range thumb cleanup for Photoshop feel */
  input[type='range']::-webkit-slider-thumb {
    appearance: none;
    height: 12px;
    width: 12px;
  }
</style>
