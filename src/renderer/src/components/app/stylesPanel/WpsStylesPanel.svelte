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
<!-- WPS-style "Styles and Formatting" side panel (wired to the editor). -->
<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { closeStylesPanel } from '../../../stores/stylesPanel.store'
  import { GenericFormatingEditorCommands } from '../../common/actions/formatting/commands/GenericFormatingEditorCommands.svelte'

  type StyleRow = { id: string; label: string; preview: string; apply: () => void }

  const styles: StyleRow[] = [
    {
      id: 'default',
      label: 'Default Paragraph Font',
      preview: 'default',
      apply: () => GenericFormatingEditorCommands.paragraph()
    },
    { id: 'h1', label: 'Heading 1', preview: 'h1', apply: () => GenericFormatingEditorCommands.heading(1) },
    { id: 'h2', label: 'Heading 2', preview: 'h2', apply: () => GenericFormatingEditorCommands.heading(2) },
    { id: 'h3', label: 'Heading 3', preview: 'h3', apply: () => GenericFormatingEditorCommands.heading(3) },
    { id: 'normal', label: 'Normal', preview: 'normal', apply: () => GenericFormatingEditorCommands.paragraph() }
  ]

  function applyStyle(style: StyleRow): void {
    try {
      style.apply()
    } catch (error) {
      console.warn('[WpsStylesPanel] failed to apply style', error)
    }
  }
</script>

<div class="wps-styles-panel">
  <div class="sp-head">
    <span class="sp-title">{$_('Styles and Formatting')}</span>
    <div class="sp-head-actions">
      <button class="sp-icon" title={$_('Pin')} aria-label={$_('Pin')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v4M9 8l3-5 3 5v4l3 2H6l3-2z"/></svg>
      </button>
      <button class="sp-icon" title={$_('Close')} aria-label={$_('Close')} onclick={closeStylesPanel}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
  </div>

  <div class="sp-select">
    <span>{$_('Normal')}</span>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
  </div>

  <div class="sp-pills">
    <button class="sp-pill sp-pill-accent">{$_('Create a Style')}</button>
    <button class="sp-pill">{$_('Clear')}</button>
  </div>

  <div class="sp-apply-label">{$_('Apply a style:')}</div>
  <div class="sp-list">
    {#each styles as style (style.id)}
      <button class="sp-style sp-{style.preview}" onclick={() => applyStyle(style)}>
        {$_(style.label)}
      </button>
    {/each}
  </div>
</div>

<style>
  .wps-styles-panel {
    width: 252px;
    flex: none;
    background: var(--panel);
    border-left: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    padding: 14px 14px 0;
    height: 100%;
    overflow: auto;
  }
  .sp-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .sp-title {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text);
  }
  .sp-head-actions {
    display: flex;
    gap: 4px;
  }
  .sp-icon {
    width: 22px;
    height: 22px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 0;
    cursor: pointer;
    color: var(--muted);
    transition: background 0.08s;
  }
  .sp-icon:hover {
    background: var(--hover);
  }
  .sp-select {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px solid var(--fieldline);
    background: var(--field);
    border-radius: 7px;
    padding: 8px 11px;
    font-size: 13px;
    margin-bottom: 12px;
    color: var(--text);
  }
  .sp-pills {
    display: flex;
    gap: 8px;
    margin-bottom: 18px;
  }
  .sp-pill {
    flex: 1;
    border: 1px solid var(--fieldline);
    border-radius: 7px;
    padding: 7px 0;
    font-size: 12px;
    background: transparent;
    cursor: pointer;
    color: var(--text);
    transition: background 0.08s;
  }
  .sp-pill:hover {
    background: var(--hover);
  }
  .sp-pill-accent {
    color: var(--accent);
    font-weight: 500;
  }
  .sp-apply-label {
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .sp-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-family: Georgia, serif;
  }
  .sp-style {
    text-align: left;
    padding: 9px 10px;
    border-radius: 6px;
    background: transparent;
    border: 0;
    cursor: pointer;
    color: var(--text);
    transition: background 0.08s;
  }
  .sp-style:hover {
    background: var(--hover);
  }
  .sp-default {
    font-size: 12.5px;
    color: var(--muted);
  }
  .sp-h1 {
    font-size: 21px;
    font-weight: 700;
  }
  .sp-h2 {
    font-size: 18px;
    font-weight: 700;
  }
  .sp-h3 {
    font-size: 15px;
    font-weight: 700;
  }
  .sp-normal {
    font-size: 13px;
    background: var(--hover);
  }
</style>
