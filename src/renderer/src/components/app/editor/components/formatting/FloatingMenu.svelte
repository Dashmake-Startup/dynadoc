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
  import { onMount, onDestroy } from 'svelte'
  import { FloatingMenuPlugin } from '../../../../../../../../node_modules/@tiptap/extension-floating-menu/dist'
  import type { FloatingMenuPluginProps } from '../../../../../../../../node_modules/@tiptap/extension-floating-menu/dist'
  import type { Editor } from '@tiptap/core'
  let { pluginKey = 'floatingMenu', editor, options = {}, shouldShow = null }: { pluginKey?: FloatingMenuPluginProps['pluginKey'], editor: Editor, options?: FloatingMenuPluginProps['options'], shouldShow?: FloatingMenuPluginProps['shouldShow'] | null } = $props()


  let root: HTMLDivElement | null = null

  onMount(() => {
    if (!root || !editor) return

    // Position/visibility styles
    root.style.visibility = 'hidden'
    root.style.position = 'absolute'

    // Detach from DOM
    root.remove()

    // Append to body manually
    document.body.appendChild(root)

    editor.registerPlugin(
      FloatingMenuPlugin({
        pluginKey,
        editor,
        element: root,
        options,
        shouldShow
      })
    )
  })

  onDestroy(() => {
    if (editor && pluginKey) {
      editor.unregisterPlugin(pluginKey)
    }

    // Clean up manually
    root?.remove()
  })
</script>

<!-- Render the menu initially here, but it gets moved to <body> -->
<div bind:this={root} class="floating-menu">
  <slot />
</div>

<!-- <style lang="scss"> -->
<style>
  /* Ensure the floating menu is positioned correctly */
  /* .floating-menu {
    position: absolute;
    z-index: 1000; /* Ensure it appears above other content /
    visibility: hidden; /* Initially hidden until shown by Tiptap /
  } */
  /* Floating menu */
  .floating-menu {
    display: flex;
    background-color: var(--gray-3);
    padding: 0.1rem;
    border-radius: 0.5rem;
  }
</style>
