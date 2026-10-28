

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import ContextMenu from '../../../../components/common/contextMenu/ContextMenu.svelte';

  // Svelte 5 Runes
  let { 
    __author = "Editor", 
    __text = "", 
    __onUnset, 
    __onDelete,
    __timestamp = new Date().toLocaleTimeString(),
    __type = "note" 
  } = $props();

  let showFullPreview = $state(false);

  // Adobe Type Config for categorization
  const TYPE_THEMES = {
    todo: { color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'TODO' },
    fixme: { color: 'text-error', bg: 'bg-error/10', label: 'FIXME' },
    note: { color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'NOTE' }
  };

  const currentTheme = $derived(TYPE_THEMES[__type] || TYPE_THEMES.note);
  const wordCount = $derived(__text.split(/\s+/).filter(Boolean).length);
</script>

<ContextMenu>
  <div class="relative inline-flex items-center align-middle group px-1 cursor-pointer">
    <!-- <span class="w-[2px] h-[1.2em] bg-primary/40 rounded-full mr-1 group-hover:bg-primary transition-colors"></span> -->
  <span class=" programming-style-comment-caret-label-trigger">

    <button 
      class="flex items-center gap-1.5 px-1.5 py-0.5 rounded-[2px] bg-base-300 border border-base-100/20 
             text-[9px] font-black uppercase tracking-tighter transition-all shadow-sm"
    >
      <i class="ph-bold ph-code text-[10px] {currentTheme.color}"></i>
      <!-- <span class="opacity-40">{__author.split(' ')[0]}</span> -->
      <!-- <span class="opacity-20 font-mono">[{wordCount}w]</span> -->
    </button>
  </div>

  <svelte:fragment slot="content">
    <div class="w-72 bg-base-300 border border-base-100 shadow-2xl rounded-sm overflow-hidden font-sans text-[12px] animate-in fade-in zoom-in-95 duration-150">
      
      <div class="px-3 py-2 bg-base-200 border-b border-base-100 flex justify-between items-center">
        <div class="flex items-center gap-2">
          <span class="badge badge-xs rounded-none font-bold text-[8px] {currentTheme.bg} {currentTheme.color} border-none px-1">
            {currentTheme.label}
          </span>
          <span class="text-[10px] opacity-40 font-mono tracking-tighter">{__timestamp}</span>
        </div>
        <div class="flex items-center gap-2 opacity-30">
           <i class="ph-light ph-lock-key"></i>
           <i class="ph-light ph-dots-three-circle hover:opacity-100 cursor-pointer"></i>
        </div>
      </div>

      <div class="p-4 bg-base-100">
        <div class="flex gap-3">
          <div class="flex flex-col gap-0.5 opacity-20 font-mono text-[9px] select-none pt-0.5 border-r border-base-300 pr-2">
            <span>01</span>
            {#if showFullPreview}<span>02</span><span>03</span>{/if}
          </div>
          
          <div class="flex flex-col gap-2">
            <p class="text-[11px] leading-relaxed text-base-content/80 italic font-mono {showFullPreview ? '' : 'line-clamp-3'}">
               "{__text}"
            </p>
            
            {#if __text.length > 80}
              <button 
                onclick={(e) => { e.stopPropagation(); showFullPreview = !showFullPreview }}
                class="text-[9px] font-bold text-primary uppercase tracking-widest hover:underline text-left"
              >
                {showFullPreview ? 'Collapse View' : 'Expand Content'}
              </button>
            {/if}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 border-t border-base-100 bg-base-200">
        <button 
          onclick={__onUnset}
          class="flex items-center justify-center gap-2 py-3 hover:bg-base-100 transition-colors border-r border-base-100 group"
        >
          <i class="ph-light ph-arrow-square-out opacity-40 group-hover:text-primary group-hover:opacity-100"></i>
          <span class="text-[10px] font-bold uppercase tracking-widest">{$_('Reveal')}</span>
        </button>

        <button 
          onclick={__onDelete}
          class="flex items-center justify-center gap-2 py-3 hover:bg-base-100 transition-colors group"
        >
          <i class="ph-light ph-trash opacity-40 group-hover:text-error group-hover:opacity-100"></i>
          <span class="text-[10px] font-bold uppercase tracking-widest">{$_('Discard')}</span>
        </button>
      </div>

      <div class="flex p-1 bg-base-300 gap-1 border-t border-base-100">
         {#each Object.keys(TYPE_THEMES) as t}
           <button class="flex-1 py-1 rounded-[1px] hover:bg-base-100 text-[8px] font-bold uppercase opacity-20 hover:opacity-100 transition-opacity">
             {t}
           </button>
         {/each}
      </div>
    </div>
  </svelte:fragment>
</ContextMenu>

<style>
  /* Ensure the trigger looks like a "code" insertion in the text */
  :global(.programming-comment-trigger) {
    vertical-align: baseline;
  }


  /* Ensure caret wrapper is positioned relative */
  :global(.programming-style-comment-wrapper) {
    position: relative;
    display: inline;
    /* display: inherit; */
    /* display: inline-flex; */
  }

  /* Caret itself */
  /* :global(.programming-style-comment-caret) {
    width: 2px;
    height: 1.2em;
    background: #3b82f6; /* Tailwind blue-500 /
    margin-left: 2px;
  } */

  /* The colored caret line */
  :global(.programming-style-comment-caret) {
    border-left: 2px solid var(--caret-color, #ff00ff);
    /* margin-left: -1px;
    margin-right: -1px; */
    position: absolute;
    top: 0;
    bottom: 0;
    pointer-events: none;
  }

  /* Card label floating */
  :global(.programming-style-comment-caret-label) {
    /* @apply z-50; floats below caret */
    @apply absolute z-50 top-0; /* floats below caret */
    /* @apply absolute top-full left-0 mt-2 z-50; floats below caret */
    @apply max-h-64;
    /* @apply max-h-64 overflow-y-auto; scroll if too tall */
    @apply shadow-lg rounded-lg; /* nicer floating look */
    transform: translate(0%, -100%);
    /* transform: translate(-50%, -100%); */
  }

  :global(.programming-style-comment-caret-label-floating) {
    /* position: relative; */
    @apply absolute;
  }

  /* Optional: smooth scrollbar */
  :global(.programming-style-comment-caret-label::-webkit-scrollbar) {
    width: 6px;
  }
  :global(.programming-style-comment-caret-label::-webkit-scrollbar-thumb) {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }

  .comment-label {
    background: rgba(255, 255, 0, 0.2);
    border: 1px solid orange;
    padding: 0.25em;
    font-size: 0.85em;
  }

  /* Make the caret container relative so label can float */

  /* .comment-widget {
    position: relative;
    display: inline-block;
    border: 1px solid #ccc;
    border-radius: 6px;
    padding: 4px;
    background: #fdfdfd;
  } */

  /* .comment-widget-label {
    font-size: 0.75rem;
  font-weight: bold;
  color: #333;
  position: absolute;
  top: -12px;
  left: 4px;
  background: #fdfdfd;
  padding: 0 4px;
    position: absolute;
    bottom: 100%;
    width: max-content;
  } */

  /* .programming-style-comment-widget-value {
    margin: 8px 0;
    font-size: 0.85rem;
    color: #555;
  } */

  /* .programming-style-comment-widget-uncomment {
    display: block;
    border: none;
    background: #e33;
    color: white;
    padding: 4px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
  }
  .programming-style-comment-widget-uncomment:hover {
    background: #c00;
  } */

  .programming-style-comment-wrapper {
    position: relative;
  }

  /* The colored caret line */
  .programming-style-comment-caret {
    border-left: 2px solid var(--caret-color, #ff00ff);
    margin-left: -1px;
    margin-right: -1px;
    position: absolute;
    top: 0;
    bottom: 0;
    pointer-events: none;
  }

  /* The username label */
  .programming-style-comment-caret-label {
    position: absolute;
    top: -1.5em; /* float above the text */
    left: 0;
    transform: translateX(-50%); /* center above caret */
    padding: 2px 6px;
    font-size: 12px;
    background: var(--caret-color, #ff00ff);
    color: white;
    border-radius: 4px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 10;
  }
</style>