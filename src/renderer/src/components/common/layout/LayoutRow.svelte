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
  let {
    __label,
    __icon,
    __disabled = false,
    __isActive = false,
    __onClick = () => {}
  } = $props()
</script>

<!-- <div class="flex flex-row p-y-1 p-x-2 hover:bg-base-200 gap-[0.2rem] cursor-pointer rounded-[2px]"> -->
  <!-- <div class="row" on:click={onClick} {disabled} > -->
  <!-- <div class="col-6">{icon}</div> -->
  <!-- <div class="col-6">{label}</div> -->
  <!-- <div class="col-6 "><slot name="icon"></slot></div> -->
  <!-- <div class=""><slot name="icon"></slot></div>
  <div class=""><slot name="label"></slot></div>
</div> -->

<div class="w-full flex items-center" title={$_(__label)}>
  <!-- <div class="row" on:click={onClick} {disabled} > -->
  <!-- <div class="col-6">{icon}</div> -->
  <!-- <div class="col-6">{label}</div> -->
  <!-- <div class=""> -->
  <slot name="icon"></slot>
  <!-- </div> -->
  <!-- <div class=""> -->
  <div class="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors">
    <slot name="label"></slot>
  </div>
</div>

<style>
  .ribbon-item.button {
    display: flex;
    align-items: center;
    padding: 5px 10px;
    cursor: pointer;
  }
  .ribbon-item.button i {
    margin-right: 4px;
  }
</style>
