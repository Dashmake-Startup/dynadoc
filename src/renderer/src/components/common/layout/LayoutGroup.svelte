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
  import LayoutIcon from './LayoutIcon.svelte'
  import LayoutRow from './LayoutRow.svelte'
  import LayoutSelect from './LayoutSelect.svelte'
  import LayoutGroup from './LayoutGroup.svelte'
  let {
    __label = '',
    __description = '',
    __items = [],
    __direction = Layout.DIRECTION.HORIZONTAL,
    __disabled = false,
    __isActive = false,
    __onClick = () => {}
  }: {
    __label?: any
    __description?: any
    __items?: any[]
    __direction?: any
    __disabled?: boolean
    __isActive?: boolean
    __onClick?: (event: MouseEvent | CustomEvent) => void
  } = $props()
  // export let layout = Layout.LAYOUT.COLUMN

  /* const layouts = {
    [Layout.LAYOUT.COLUMN]: LayoutColumn,
    [Layout.LAYOUT.ROW]: LayoutRow,
    [Layout.LAYOUT.SELECT]: LayoutSelect,
    [Layout.LAYOUT.ICON]: LayoutIcon
  } */
  // import RibbonButton from './LayoutRow.svelte'
  // import RibbonSelect from './LayoutSelect.svelte'
  // import RibbonIcon from './LayoutIcon.svelte'
  // import RibbonGroup from './LayoutGroup.svelte'

  // $: LayoutComponent = Layout.LAYOUT_COMPONENTS[layout]

  /* const getItemComponent = (type) => {
    switch (type) {
      case 'button':
        return RibbonButton
      case 'select':
        return RibbonSelect
      case 'icon':
        return RibbonIcon
      case 'group':
        return RibbonGroup
      default:
        return null
    }
  } */
</script>

<div class="">
  <div class="" title={__description}>
    {__label}
  </div>
  <div class={`layout-${__direction}`}>
    <!-- <button-group> -->
    {#each __items as item}
      {#if item}
        {#if item?.body}
          <!-- <LayoutGroup __items={item.props.items} __direction={item.props.direction}></LayoutGroup> -->
          <svelte:component this={item.body.component} {...item.body.props} />
        {:else}
          <!-- {#if item.type} -->
          <svelte:component this={item.component} {...item.props} />
          <!-- <svelte:component this={LayoutComponent}>
          <svelte:fragment slot="icon">{@html icon}</svelte:fragment>
          <svelte:fragment slot="label">{@html label}</svelte:fragment>
        </svelte:component> -->
          <!-- {#if getItemComponent(item.type)}
          <svelte:component this={getItemComponent(item.type)} {...item} />
        {/if} -->
        {/if}
      {/if}
    {/each}
    <!-- </button-group> -->
  </div>
</div>

<style>
  /* Horizontal layout */
  .layout-horizontal {
    display: flex;
    align-items: center;
    /* gap: 10px; */
    max-height: 3em;
  }

  /* Vertical layout */
  .layout-vertical {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    /* gap: 10px; */
  }

  /* Horizontal-only layout */
  .layout-horizontal-only {
    display: flex;
    align-items: center;
    /* gap: 10px; */
    flex-wrap: nowrap;
    max-height: 3em;
  }
</style>
