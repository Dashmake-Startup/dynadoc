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
<!-- CommentLabel.svelte -->

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import ContextMenu from '../../../../components/common/contextMenu/ContextMenu.svelte'
  import { fluentUIcons } from '../../../../components/common/icons/Icons'
  import type { VariableInsertMode } from '../../CustomVarExtension/utils/utils'
  import CustomExcelTableExtensionVarInput from './CustomExcelTableExtensionVarInput.svelte'

  // export let __labelText: string = 'Variable'
  let {
    __onClick = () => {},
    __labelText = 'Variable',
    __inputValue = '',
    __placeholder = 'Enter value...',
    __buttonText = 'Save',
    __overrideNodeContent = false,
    __onFormulaSave = (formula: any, insertMode?: VariableInsertMode, insertVariable?: boolean) =>
      {},
    __variant = 'primary',
    __pulse = false
  } = $props()
  // Color logic for Adobe 2025 spectrum
  const themes = {
    primary:
      'bg-primary/20 border-primary/40 text-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.2)]',
    warning: 'bg-orange-500/20 border-orange-500/40 text-orange-400',
    ghost: 'bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] border-white/10 text-base-content/40'
  }
</script>

<!-- <span onclick={() => __onClick()}>
  <vscode-badge>{__labelText}</vscode-badge>
</span> -->

<ContextMenu
  __component={CustomExcelTableExtensionVarInput}
  __props={{
    __labelText,
    __inputValue,
    __placeholder,
    __buttonText,
    __overrideNodeContent,
    __onFormulaSave
  }}
>
  <!-- <vscode-badge variant="activity-bar-counter">
    <div>
      <span class="inline-block">
        {__labelText}
      </span>
      <span class="text-base-content-600 w-[10px] max-w-[max-content] inline-block"
        >{@html fluentUIcons.fluentUIconVariable}
      </span>
    </div>
  </vscode-badge> -->

  <div
    class="inline-flex items-center gap-1.5 px-1.5 py-0.5
            rounded-[4px] border border-solid transition-all duration-300
            {themes[__variant]} {__pulse ? 'animate-pulse' : ''}"
  >
    <span class="text-[9px] font-black leading-none uppercase tracking-[0.05em] font-sans">
      {__labelText}
    </span>

    <span
      class="flex items-center justify-center w-[10px] max-w-[max-content] inline-block opacity-80 group-hover:opacity-100 transition-opacity"
    >
      {@html fluentUIcons.fluentUIconVariable}
    </span>
  </div>
</ContextMenu>

<style>
  /* Inter or any clean Sans is the standard for Adobe 2025 */
  div {
    font-family: var(--brand-font-sans);
    backdrop-filter: blur(4px); /* Glassmorphism depth */
  }

  /* Define the primary RGB for the shadow variable */
  :root {
    /* --primary-rgb: 2, 101, 210; Adobe Blue */
  }
</style>
