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
  import type { ComponentType, SvelteComponent } from 'svelte'
  import { _ } from 'svelte-i18n'
  import ContextMenu from '../contextMenu/ContextMenu.svelte'
  import GenericDropdown from '../dropdown/GenericDropdown.svelte'
  import type { GenericFormattingProps } from '../actions/formatting'

  let {
    __label,
    __description,
    __class = '',
    __direction = Layout.DIRECTION.HORIZONTAL,
    __data = [],
    __contextMenudata = null,
    __selectDataProps = {},
    __disabled = false,
    __isActive = false,
    __onClick = () => {}
  } = $props()

  let _component
  let _data
  // console.log('componeeent', __data, typeof __data)
  /*   if (typeof __data === 'function') {
    _component = __data
  } else {
    // _data = __data
    _component = GenericDropdown
    console.log('itemsitems ', { __selectDataProps })

    // __selectDataProps = { items: __selectDataProps }
  } */
</script>

<div class="flex gap-2 p-2 border rounded bg-[rgba(255,255,255,0.03)]">
  {#each __data as GenericFormattingProps[] as data}
    <button class="style-sample">
      <span class="text-sm font-normal">{$_(data.__label)}</span>
    </button>
  {/each}

  <!-- <button class="style-sample">
    <span class="text-sm italic">Quote</span>
  </button>
  <button class="style-sample">
    <span class="text-sm underline">Underlined</span>
  </button> -->

  <ContextMenu __component={__contextMenudata}>
    <button class="w-full h-full" title={$_('Settings')} transparent>
      <div>
        <i class="ph-light ph-caret-down"></i>
      </div>
    </button>
  </ContextMenu>
</div>

<style>
  .style-sample {
    @apply:flex flex-col items-center justify-center w-[max-content] h-12 px-2 py-1 border border-[rgba(255,255,255,0.1)] rounded hover:bg-[rgba(255,255,255,0.05)] transition-all duration-150;
  }
  /* 4. More Styles Button (Dropdown Arrow) */
  .style-sample.more-styles {
    /* This button is only an icon, so change its layout */
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px; /* Narrower button */
    height: 50px;
    font-size: 12px;
    margin-left: 5px;
    /* background-color: #fcfcfc; */
  }

  .style-sample.more-styles i {
    color: #333;
  }

  /* --- Styles Pane Container --- */
  .styles-pane {
    width: 250px;
    border: 1px solid #ccc;
    box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.1);
    background-color: #fcfcfc; /* Very light background */
    font-family: var(--brand-font-sans);
    color: #333;
    display: flex;
    flex-direction: column;
    height: fit-content;
  }

  /* --- Pane Header --- */
  .pane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    font-weight: 600;
    font-size: 14px;
    border-bottom: 1px solid #ddd;
    background-color: #f0f0f0; /* Slightly darker header */
  }

  .options-btn {
    background: none;
    border: 1px solid transparent;
    border-radius: 3px;
    font-weight: bold;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0 4px;
  }

  .options-btn:hover {
    background-color: #e0e0e0;
  }

  /* --- Styles List --- */
  .styles-list {
    padding: 5px 0;
    overflow-y: auto;
  }

  .style-entry {
    padding: 8px 10px;
    margin: 2px 0;
    cursor: pointer;
    line-height: 1.3;
    border-left: 3px solid transparent; /* Used for active state */
  }

  .style-entry:hover {
    background-color: #e6f2ff; /* Light blue hover, similar to Office */
  }

  /* Active State (The style currently applied) */
  .style-entry.active {
    background-color: #cce7ff; /* Deeper blue background for active */
    border-left: 3px solid #005a9e; /* Solid blue bar on the left */
  }

  /* Style Name and Preview */
  .style-name {
    display: block;
    font-size: 13px;
    font-weight: 500;
  }

  .style-preview {
    display: block;
    font-size: 10px;
    color: #666;
    margin-top: 2px;
  }

  /* --- Specific Style Visuals (Mimicking actual text styles) --- */
  .style-name.normal {
    font-weight: normal;
  }

  .style-name.heading-1 {
    font-size: 18px;
    font-weight: bold;
    color: var(--color-base-200);
  }

  .style-name.heading-2 {
    font-size: 16px;
    font-weight: bold;
    color: #444;
  }

  .style-name.list-bullet {
    font-size: 13px;
    /* You could add a bullet icon here */
  }

  .style-name.quote {
    font-style: italic;
    color: #777;
  }

  /* --- Pane Footer --- */
  .pane-footer {
    padding: 8px 10px;
    border-top: 1px solid #ddd;
    text-align: right;
    background-color: #fff;
  }

  .pane-footer a {
    color: var(--bg-primary); /* Standard Microsoft blue link color */
    text-decoration: none;
    font-size: 12px;
  }

  .pane-footer a:hover {
    text-decoration: underline;
  }

  /* --- Styles Gallery Group Container --- */
  .styles-gallery-group {
    /* Ensures the group is wider and contains the samples */
    border-right: 1px solid #ccc;
    padding-right: 10px;
    margin-right: 10px;
  }

  .styles-gallery-content {
    /* Flex layout to keep samples side-by-side */
    display: flex;
    align-items: flex-start;
    padding-top: 5px;
    height: 60px; /* Matching the height of other ribbon groups */
  }
</style>
