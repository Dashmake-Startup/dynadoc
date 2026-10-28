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
<!-- SearchBar.svelte -->
<script lang="ts">
  import { _ } from 'svelte-i18n'
  // import searchLogo from '@/renderer/src/assets/wavy-lines.svg';
  import searchLogo from 'builtInExtensionsDir/theme-defaults/fileicons/images/search.svg'
  import { onMount, onDestroy } from 'svelte'
  import CommandPalette from './CommandPalette.svelte'
  import ContextMenu from '../../common/contextMenu/ContextMenu.svelte'
  import CommandCenterGlobalSearchPill from './CommandCenterGlobalSearchPill.svelte'

  let contextMenuRef: { hide: () => void; show: () => void } | null = $state(null)

  async function openPalette(initialQuery = '') {
    contextMenuRef?.show()
    await new Promise((r) => setTimeout(r, 50))
    ;(window as any)._$_commandPalette?.open(initialQuery)
  }

  function onGlobalKeyDown(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'p') return
    e.preventDefault()
    openPalette(e.shiftKey ? '> ' : '')
  }

  onMount(() => window.addEventListener('keydown', onGlobalKeyDown))
  onDestroy(() => window.removeEventListener('keydown', onGlobalKeyDown))
</script>

<ContextMenu bind:this={contextMenuRef} __placement="bottom" __trigger="click" __offset={[0, -30]}>
  <CommandCenterGlobalSearchPill />

  <svelte:fragment slot="content">
    <CommandPalette closePopover={() => contextMenuRef?.hide()} />
  </svelte:fragment>
</ContextMenu>

<!-- <CommandPalette /> -->

<!-- </div> -->

<style global>
  .search-bar2 {
    padding: 8px;
  }
  .search-bar {
    flex-grow: 1; /* Take up available space */
    padding: 8px;
    /* background-color: #2d2d2d; */
    color: white;
    margin: 0 auto;
    /* display: flex;
    align-items: center; */
    /* justify-content: space-between; */
    /* border:  */
  }

  .search-input {
    /* Background properties */
    @apply bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] bg-opacity-5;
    /* Padding & Margin properties */
    @apply p-[4px] mr-[8px];
    /* Border properties */
    @apply rounded-md b-1 b-solid b-white b-op-10;
    /* Width and Height properties */
    @apply w-[100%];
    /* Text  properties */
    @apply text-center;
  }

  .search-input::placeholder {
    /* Text  properties */
    @apply text-center;
    color: rgba(255, 255, 255, 0.751);
  }

  .search-icon {
    position: absolute;
    top: 50%;
    left: 3%; /* Adjust left position to align the icon */
    transform: translateY(-50%);
  }
</style>
