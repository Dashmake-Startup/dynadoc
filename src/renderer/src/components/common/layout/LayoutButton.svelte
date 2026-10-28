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
  import Layout from './layout'
  import LayoutColumn from './LayoutColumn.svelte'
  import LayoutRow from './LayoutRow.svelte'

  let {
    __label,
    __icon,
    __direction = Layout.DIRECTION.HORIZONTAL,
    __disabled = false,
    __isActive = false,
    __onClick = () => {}
  } = $props()
</script>

<span onclick={__onClick}>
  <button
    class="
  px-4 py-1.5 rounded-[4px] text-[13px] font-500 tracking-wide transition-all duration-200
  flex items-center justify-center gap-2 select-none outline-none
  
  bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-[#cccccc] border border-white/10 backdrop-blur-md
  
  hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] hover:text-base-content hover:border-white/20 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]
  
  active:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] active:scale-97 active:border-white/5
  
  focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e1e1e]
"
  >
    {#if __direction == Layout.DIRECTION.HORIZONTAL}
      <LayoutRow {__disabled} {__label} {__icon}>
        <svelte:fragment slot="icon">{@html __icon}</svelte:fragment>
        <svelte:fragment slot="label">{@html __label}</svelte:fragment>
      </LayoutRow>
    {:else if __direction == Layout.DIRECTION.VERTICAL}
      <LayoutColumn {__disabled} {__label} {__icon}>
        <svelte:fragment slot="icon">{@html __icon}</svelte:fragment>
        <svelte:fragment slot="label">{@html __label}</svelte:fragment>
      </LayoutColumn>
    {/if}
  </button>
</span>

<style>
</style>
