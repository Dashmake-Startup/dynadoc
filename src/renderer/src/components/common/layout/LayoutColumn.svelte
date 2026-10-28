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
  // export let label
  // export let icon
  // export let __label
  // export let __icon
  // export let __disabled: boolean = false
  // export let __isActive: boolean = false
  // export let __onClick: (event: MouseEvent | CustomEvent) => void = () => {}

  let { __label, __icon, __disabled = false, __isActive = false, __onClick = () => {} } = $props()
</script>

<!-- <div class="flex flex-col" > -->
<!-- <div class="flex flex-col p-y-1 p-x-3 hover:bg-base-200 gap-[0.2rem] cursor-pointer rounded-[2px]"> -->
<div class="layout-col-tool flex flex-col items-center min-w-0 max-w-[84px]" title={$_(__label)}>
  <slot name="icon"></slot>
  <div
    class="layout-col-label flex items-center justify-center gap-1 cursor-pointer hover:text-primary transition-colors"
  >
    <slot name="label"></slot>
  </div>
</div>

<style>
  /* Keep tool labels within the button width: wrap to two lines and centre,
     instead of overflowing onto neighbouring tools. */
  .layout-col-label {
    max-width: 84px;
    text-align: center;
    line-height: 1.1;
    white-space: normal;
    overflow-wrap: anywhere;
  }
</style>
