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
  // export let icon
  let {
    __disabled = false,
    __isActive = false,
    __description = '',
    __label = '',
    __onClick = () => {}
  } = $props()
</script>

<!-- <div class="text-xl"> -->
  <!-- ok -->
  <!-- <div class="text-xl" on:click={onClick} {disabled} class:is-active={isActive}> -->
  <div class="" onclick={__onClick}>
  <!-- <slot name="icon"></slot> -->
  <button class="flex flex-row p-y-1 p-x-1 hover:bg-base-200 gap-[0.2rem] cursor-pointer rounded-[2px]" title="{__description}" disabled={__disabled} class:is-active={__isActive}>
  <!-- <button secondary title="Align center" icon-only> -->
    <slot name="icon"></slot>
  </button>
</div>
<!-- </div> -->

<style>
</style>
