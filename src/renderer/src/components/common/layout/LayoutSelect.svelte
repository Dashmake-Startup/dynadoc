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
  import type { ComponentType, SvelteComponent } from 'svelte'
  import ContextMenu from '../contextMenu/ContextMenu.svelte'
  import GenericDropdown from '../dropdown/GenericDropdown.svelte'
  import type { GenericFormattingProps } from '../actions/formatting'
  import Layout from './layout'

  // --- Runes: Props ---
  let {
    __label,
    __description,
    __icon, // Pass the HTML string here for reactivity
    __class = '',
    __direction = Layout.DIRECTION.HORIZONTAL,
    __data = [],
    __contextMenudata = null,
    __selectDataProps = {},
    __disabled = false,
    __isActive = false,
    __onClick = () => {}
  } = $props<{
    __label: string
    __description: string
    __icon?: string
    __class?: string
    __direction?: any
    __data?: GenericFormattingProps[] | ComponentType<SvelteComponent>
    __contextMenudata?: ComponentType<SvelteComponent> | null
    __selectDataProps?: Record<string, any>
    __disabled?: boolean
    __isActive?: boolean
    __onClick?: (event: MouseEvent | CustomEvent) => void
  }>()

  // --- Derived State ---
  let _component = $derived(typeof __data === 'function' ? __data : GenericDropdown)
</script>

<div class="flex {__class} {__disabled ? 'opacity-50 pointer-events-none' : ''}">
  {#if __direction === Layout.DIRECTION.HORIZONTAL}
    <div class="w-full flex flex-col items-center" title={$_(__description)}>
      <div
        class="icon-wrapper cursor-pointer w-full hover:rounded-t-[5px] hover:bg-[color-mix(in_srgb,var(--color-base-white),transparent_85%)]"
      >
        {#if __icon}
          {@html __icon}
        {:else}
          <slot name="icon"></slot>
        {/if}
      </div>

      <ContextMenu __component={_component} __props={{ ...__selectDataProps }}>
        <div
          class="layout-select-label flex items-center justify-center gap-1 cursor-pointer min-w-0 w-full hover:rounded-b-[5px] hover:bg-[color-mix(in_srgb,var(--color-base-white),transparent_85%)] transition-colors"
        >
          <span class="layout-select-label-text tracking-tighter">
            {@html __label}
          </span>
          <i class="ph-light ph-caret-down text-[10px] flex-none"></i>
        </div>
      </ContextMenu>
    </div>
  {:else}
    <div class="col-6">
      <!-- <button class=" w-full hover:rounded-t-[5px] hover:bg-[color-mix(in_srgb,var(--color-base-white),transparent_85%)]" title={$_(__description)} onclick={__onClick} disabled={__disabled}> -->
      <button
        class="w-full cursor-pointer"
        title={$_(__description)}
        onclick={__onClick}
        disabled={__disabled}
      >
        {#if __icon}
          {@html __icon}
        {:else}
          <slot name="icon"></slot>
        {/if}
      </button>
    </div>

    <div class="col-6">
      <ContextMenu __component={_component} __props={{ ...__selectDataProps }}>
        <!-- <button class=" w-full hover:rounded-b-[5px] hover:bg-[color-mix(in_srgb,var(--color-base-white),transparent_85%)]" title={$_(__description)} transparent> -->
        <button class="w-full" title={$_(__description)} type="button">
          <div class="flex items-center gap-1">
            {@html __label}
            <i class="ph-light ph-caret-down"></i>
          </div>
        </button>
      </ContextMenu>
    </div>
  {/if}
</div>

<style>
  .row {
    display: flex;
    align-items: center;
  }

  .icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
  }

  /* Keep the tool label within the button: wrap and centre instead of
     overflowing onto neighbouring tools. */
  .layout-select-label-text {
    min-width: 0;
    max-width: 72px;
    text-align: center;
    line-height: 1.1;
    white-space: normal;
    overflow-wrap: anywhere;
    /* cap at two lines so very long labels don't make a tool tall / overflow */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  :global(.ph-caret-down) {
    font-size: 0.8em;
    opacity: 0.7;
  }
</style>
