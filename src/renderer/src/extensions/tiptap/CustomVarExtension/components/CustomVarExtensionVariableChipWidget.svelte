<!--
 Copyright (C) 2025 Dashmake Inc.

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
  import { onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'
  import { VariableManipulatorUtils, type VariableValue } from '../stores/variableManipulator'
  import FileRenderer from '../../../fileRenderers/FileRenderer.svelte'
  import FolderRenderer from '../../../fileRenderers/FolderRenderer.svelte'
  import CustomAIExtensionChipWidget from '../../CustomAIExtension/components/CustomAIExtensionChipWidget.svelte'
  import ContextMenu from '../../../../components/common/contextMenu/ContextMenu.svelte'
  import CustomVarExtensionEditWidget from './CustomVarExtensionEditWidget.svelte'
  import { formatSpreadsheetRefName } from '../utils/utils'

  let { rawValue, value, type, name, __maxPageHeight = 0, __maxPageWidth = 0 } = $props()
  // useNodeViewWrapper?: boolean
  // isMirror?: boolean

  let hovered = false
  let showTooltip = false
  let hoverTimeout

  const color = $derived.by(() =>
    type === 'string'
      ? 'green'
      : type === 'number'
        ? 'blue'
        : type === 'boolean'
          ? 'purple'
          : type === 'error'
            ? 'red'
            : 'black'
  )

  function handleMouseEnter() {
    return
    hovered = true // brackets appear immediately
    // tooltip appears with delay
    hoverTimeout = setTimeout(() => {
      showTooltip = true
    }, 500) // 500ms delay for tooltip
  }

  function handleMouseLeave() {
    return
    hovered = false
    showTooltip = false
    clearTimeout(hoverTimeout)
  }

  onDestroy(() => {
    clearTimeout(hoverTimeout)
  })
</script>

<span
  class="variable-chip tooltip !bg-[{color}]/10"
  data-tip="{formatSpreadsheetRefName(String(name ?? ''))} {$_('(Double click to edit)')}"
>
  <!-- {value}{name}{type} -->
  <!-- <span
  class="variable-chip tooltip !bg-[{color}]/10"
  data-tip={name}
  class:tooltip-visible={showTooltip}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
> -->
  <!-- <span
  class="variable-chip tooltip"
  data-tip={name}
  class:tooltip-visible={showTooltip}
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  style="color: {color}; font-weight: bold; cursor: pointer;"
> -->
  <!-- {#if hovered}<span>[</span>{/if} -->
  <ContextMenu
    __component={CustomVarExtensionEditWidget}
    __trigger={'dblclick'}
    __props={{
      __variable: { name, value, type, rawValue }
    }}
  >
    <!-- type {type} {(rawValue as VariableValue).type} -->
    {#if type === 'object'}
      {#if (rawValue as VariableValue).type === VariableManipulatorUtils.VAR_TYPE.text}
        <!-- {(value as VariableValue).value} -->
        {VariableManipulatorUtils.formatValue(
          value,
          // (value as VariableValue).value,
          (rawValue as VariableValue).format
        )}
      {:else if (rawValue as VariableValue).type === VariableManipulatorUtils.VAR_TYPE.datetime}
        {VariableManipulatorUtils.formatValue(
          (value as VariableValue).value,
          (rawValue as VariableValue).format,
          (rawValue as VariableValue).autoUpdate
        )}
      {:else if (rawValue as VariableValue).type === VariableManipulatorUtils.VAR_TYPE.richtext}
        {@html (rawValue as VariableValue).value}
      {:else if (rawValue as VariableValue).type === VariableManipulatorUtils.VAR_TYPE.file}
        <!-- Render file type -->
        <FileRenderer __src={(rawValue as VariableValue).url} {__maxPageWidth} {__maxPageHeight}
        ></FileRenderer>
      {:else if (rawValue as VariableValue).type === VariableManipulatorUtils.VAR_TYPE.folder}
        <!-- Render folder type -->
        <FolderRenderer
          __src={(rawValue as VariableValue).url}
          {__maxPageWidth}
          {__maxPageHeight}
        />
      {:else if (rawValue as VariableValue).type === VariableManipulatorUtils.VAR_TYPE.ai}
        <!-- Render folder type -->
        <CustomAIExtensionChipWidget
          __result={(rawValue as VariableValue).value}
          __prompt={(rawValue as VariableValue).prompt}
        />
      {:else}
        {value}
      {/if}
    {:else}
      {value}
    {/if}
  </ContextMenu>
  <!-- {#if hovered}<span>]</span>{/if} -->
</span>

<style>
  .variable-chip {
    user-select: none;
    opacity: 0.9;
    transition: color 0.2s ease;
    display: inherit;
    background-color: rgba(0, 0, 0, 0.1);
    cursor: pointer;
  }

  /* Optional: fade tooltip in/out smoothly */
  .tooltip[data-tip] {
    /* opacity: 0; */
    /* transition: opacity 0.3s ease; */
  }

  .tooltip.tooltip-visible[data-tip] {
    opacity: 1;
  }
</style>
