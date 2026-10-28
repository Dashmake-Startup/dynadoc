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
<!-- WPS-style right icon rail. "Edit" toggles the Styles panel; others reserved. -->
<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { _$_stylesPanelVisible, toggleStylesPanel } from '../../../stores/stylesPanel.store'

  const panelOpen = $derived($_$_stylesPanelVisible)
</script>

<div class="wps-icon-rail">
  <button
    class="rail-btn"
    class:active={panelOpen}
    title={$_('Edit / Styles')}
    aria-label={$_('Edit / Styles')}
    onclick={toggleStylesPanel}
  >
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19l3.5-1 9-9-2.5-2.5-9 9z"/><path d="M14 6l2.5 2.5"/></svg>
  </button>
  <button class="rail-btn" title={$_('Select')} aria-label={$_('Select')}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5 4l13 6-5.5 1.8L11 17z"/></svg>
  </button>
  <button class="rail-btn" title={$_('Lock')} aria-label={$_('Lock')}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V8a4 4 0 0 1 8 0v2"/></svg>
  </button>
  <button class="rail-btn" title={$_('History')} aria-label={$_('History')}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/><path d="M12 8v4l3 2"/></svg>
  </button>
  <button class="rail-btn" title={$_('Apps')} aria-label={$_('Apps')}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="6" height="6" rx="1.3"/><rect x="14" y="4" width="6" height="6" rx="1.3"/><rect x="4" y="14" width="6" height="6" rx="1.3"/><rect x="14" y="14" width="6" height="6" rx="1.3"/></svg>
  </button>
</div>

<style>
  .wps-icon-rail {
    width: 46px;
    flex: none;
    background: var(--ribbon);
    border-left: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 12px 0;
  }
  .rail-btn {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--inert);
    background: transparent;
    border: 0;
    cursor: pointer;
    transition: background 0.08s;
  }
  .rail-btn:hover {
    background: var(--hover);
  }
  .rail-btn.active {
    background: var(--accent);
    color: #fff;
  }
</style>
