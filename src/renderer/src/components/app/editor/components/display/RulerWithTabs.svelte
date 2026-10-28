<script lang="ts">

  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte';
  import type { Editor } from '@tiptap/core';
  let { editor, rulerWidth = 800; // pixels, unit = 10; // pixels per tick }: { editor: Editor, rulerWidth: any, unit: any } = $props()


  let tabStops: number[] = [];
  let leftIndent = 0;

  // Add a new tab stop on click
  function addTabStop(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const pos = Math.round((e.clientX - rect.left) / unit) * unit;
    if (!tabStops.includes(pos)) {
      tabStops = [...tabStops, pos].sort((a, b) => a - b);
    }
  }

  // Remove a tab stop on right click
  function removeTabStop(pos: number, e: MouseEvent) {
    e.preventDefault();
    tabStops = tabStops.filter(p => p !== pos);
  }

  // Apply left indent to selected paragraph
  function applyLeftIndent() {
    if (!editor) return;
    editor.chain().focus().updateAttributes('paragraph', { indent: leftIndent }).run();
  }

  // Handle Tab key inside TipTap
  function handleTabKey(event: KeyboardEvent) {
    if (!editor) return;
    if (event.key === 'Tab') {
      event.preventDefault();
      const selection = editor.state.selection;
      const startPos = selection.from;
      const dom = editor.view.domAtPos(startPos).node as HTMLElement;
      const rect = dom.getBoundingClientRect();
      const relativeCursor = rect.left; // approximate cursor offset

      // find next tab stop
      const nextTab = tabStops.find(t => t > relativeCursor) ?? tabStops[0];
      if (nextTab != null) {
        const newIndent = nextTab; // pixels
        leftIndent = newIndent;
        applyLeftIndent();
      }
    }
  }

  onMount(() => {
    // const view = editor.view;
    // view.dom.addEventListener('keydown', handleTabKey);
  });
</script>

<style>
  .ruler {
    position: relative;
    height: 30px;
    border-bottom: 1px solid #ccc;
    background: #f9f9f9;
    user-select: none;
  }
  .tick {
    position: absolute;
    bottom: 0;
    width: 1px;
    background: #666;
  }
  .tick-label {
    position: absolute;
    bottom: 12px;
    font-size: 10px;
    color: #333;
    transform: translateX(-50%);
  }
  .tab-stop {
    position: absolute;
    top: 0;
    width: 10px;
    height: 30px;
    background: var(--bg-primary);
    cursor: pointer;
    border-radius: 2px;
  }
</style>

<div class="ruler" on:click={addTabStop} style="width:{rulerWidth}px">
  {#each Array(rulerWidth / unit) as _, i}
    <div
      class="tick"
      style="left:{i*unit}px; height:{i % 5 === 0 ? 10 : 5}px"
    ></div>
    {#if i % 5 === 0}
      <div class="tick-label" style="left:{i*unit}px">{i*unit}</div>
    {/if}
  {/each}

  {#each tabStops as pos}
    <div
      class="tab-stop"
      style="left:{pos - 5}px"
      on:contextmenu={(e) => removeTabStop(pos, e)}
      draggable="true"
      on:dragend={(e) => {
        const rect = (e.currentTarget as HTMLDivElement).parentElement!.getBoundingClientRect();
        const newPos = Math.round((e.clientX - rect.left)/unit)*unit;
        tabStops = tabStops.map(p => p === pos ? newPos : p).sort((a,b)=>a-b);
      }}
    ></div>
  {/each}
</div>

<div class="mt-1 text-sm text-gray-700">
  Left indent: {leftIndent}px | Tab stops: {tabStops.join(', ')}
</div>
