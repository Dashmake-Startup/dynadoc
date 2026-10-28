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
  import FloatingMenu from "./FloatingMenu.svelte"

  let { editor } = $props()
</script>

<FloatingMenu {editor}>
  <div class="floating-menu">
    <button
      on:click={() => editor.chain().focus().setParagraph().run()}
      class:is-active={editor.isActive('paragraph')}
    >
      Paragraph
    </button>

    <button
      on:click={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      class:is-active={editor.isActive('heading', { level: 1 })}
    >
      H1
    </button>

    <button
      on:click={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      class:is-active={editor.isActive('heading', { level: 2 })}
    >
      H2
    </button>
  </div>
</FloatingMenu>

<style>
  .floating-menu {
    display: flex;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: white;
    border: 1px solid #ccc;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 100;
  }

  .floating-menu button {
    padding: 4px 8px;
    border: none;
    background: transparent;
    font-weight: bold;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.2s ease;
  }

  .floating-menu button:hover {
    background: gray;
    /* background: #f0f0f0; */
  }

  .floating-menu button.is-active {
    background: #0077ff;
    color: white;
  }
</style>
