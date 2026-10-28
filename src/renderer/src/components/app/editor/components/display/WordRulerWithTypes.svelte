<script lang="ts">

  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte';
  import type { Editor } from '@tiptap/core';
  let { editor, rulerWidth = 800, unit = 10, showTicks = true }: { editor: Editor, rulerWidth: any, unit: any, showTicks: any } = $props()


  // State
  let leftIndent = 0;
  let firstLineIndent = 0;
  let selectedTabType: 'left' | 'right' | 'center' | 'decimal' = 'left';
  let tabStops: { pos: number; type: 'left' | 'right' | 'center' | 'decimal' }[] = [];

  // Add tab stop on click
  function addTabStop(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const pos = Math.round((e.clientX - rect.left) / unit) * unit;
    if (!tabStops.find(t => t.pos === pos)) {
      tabStops = [...tabStops, { pos, type: selectedTabType }].sort((a, b) => a.pos - b.pos);
    }
  }

  function removeTabStop(pos: number, e: MouseEvent) {
    e.preventDefault();
    tabStops = tabStops.filter(t => t.pos !== pos);
  }

  function dragTabStop(event: DragEvent, idx: number) {
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
    const newPos = Math.round((event.clientX - rect.left)/unit)*unit;
    tabStops[idx].pos = newPos;
    tabStops = [...tabStops].sort((a,b)=>a.pos-b.pos);
  }

  function applyParagraph() {
    if (!editor) return;
    editor.chain().focus().updateAttributes('paragraph', {
      indent: leftIndent,
      firstLineIndent,
      tabStops
    }).run();
  }

  function handleTabKey(event: KeyboardEvent) {
    if (event.key === 'Tab') {
      event.preventDefault();
      const selection = editor.state.selection;
      const dom = editor.view.domAtPos(selection.from).node as HTMLElement;
      const rect = dom.getBoundingClientRect();
      const relativeCursor = rect.left;

      const nextTab = tabStops.find(t => t.pos > relativeCursor)?.pos ?? tabStops[0]?.pos ?? leftIndent;
      firstLineIndent = nextTab;
      applyParagraph();
    }
  }

  onMount(() => {
    // editor.view.dom.addEventListener('keydown', handleTabKey);
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
    width: 12px;
    height: 30px;
    cursor: pointer;
  }
  .tab-stop.left { background: var(--bg-primary); clip-path: polygon(0% 0%, 100% 0%, 100% 50%, 0% 50%); }
  .tab-stop.right { background: #28a745; clip-path: polygon(0% 0%, 100% 0%, 100% 50%, 0% 50%); transform: rotate(180deg); }
  .tab-stop.center { background: #ff7f0a; clip-path: polygon(50% 0%, 60% 10%, 40% 10%); }
  .tab-stop.decimal { background: #d62728; border-radius: 50%; }
  .margin-handle {
    position: absolute;
    top: 0;
    width: 10px;
    height: 30px;
    background: #333;
    cursor: ew-resize;
    border-radius: 2px;
  }
  .tab-type-selector {
    display: flex;
    gap: 4px;
    margin-bottom: 4px;
  }
  .tab-type-selector button {
    padding: 2px 6px;
    font-size: 12px;
    cursor: pointer;
  }
</style>

<div class="tab-type-selector">
  <button on:click={() => selectedTabType='left'} class:selected={selectedTabType==='left'}>L</button>
  <button on:click={() => selectedTabType='right'} class:selected={selectedTabType==='right'}>R</button>
  <button on:click={() => selectedTabType='center'} class:selected={selectedTabType==='center'}>C</button>
  <button on:click={() => selectedTabType='decimal'} class:selected={selectedTabType==='decimal'}>.</button>
</div>

<div class="ruler" style="width:{rulerWidth}px" on:click={addTabStop}>
  {#each Array(Math.floor(rulerWidth/unit)) as _, i}
    <div
      class="tick"
      style="left:{i*unit}px; height:{i % 5 === 0 ? 10 : 5}px"
    ></div>
    {#if i % 5 === 0}
      <div class="tick-label" style="left:{i*unit}px">{i*unit}</div>
    {/if}
  {/each}

  <!-- Left indent handle -->
  <div class="margin-handle" style="left:{leftIndent-5}px"
       draggable="true"
       on:dragend={(e)=>{ leftIndent = Math.round((e.clientX)/unit)*unit; applyParagraph(); }}></div>

  <!-- First-line indent handle -->
  <div class="margin-handle" style="left:{firstLineIndent-5}px; top:0"
       draggable="true"
       on:dragend={(e)=>{ firstLineIndent = Math.round((e.clientX)/unit)*unit; applyParagraph(); }}></div>

  <!-- Tab stops -->
  {#each tabStops as t, idx}
    <div
      class="tab-stop {t.type}"
      style="left:{t.pos-6}px"
      on:contextmenu={(e)=>removeTabStop(t.pos,e)}
      draggable="true"
      on:dragend={(e)=>dragTabStop(e,idx)}
    ></div>
  {/each}
</div>

<div class="mt-1 text-sm text-gray-700">
  Left indent: {leftIndent}px | First-line indent: {firstLineIndent}px | Tab stops: {tabStops.map(t=>t.pos + '('+t.type+')').join(', ')}
</div>
