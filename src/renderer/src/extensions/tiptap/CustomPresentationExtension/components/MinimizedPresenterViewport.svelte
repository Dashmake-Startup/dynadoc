

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import {
    currentSlide,
    pageWidth,
    pageHeight,
    totalSlides,
    visibleSlideIndexes
  } from '../store/presentation.store';
  import { fade } from 'svelte/transition';

  let { payload, index } = $props();
  let actualIndex = $derived.by(() => $visibleSlideIndexes?.[index] ?? index);

  // Extract notes for the current slide from payload HTML or metadata
  // Assuming notes might be slide-specific or global
  let currentNotes = $derived(payload.notes || "No speaker notes available.");
</script>

<div class="w-full h-full bg-[#0F0F0F] flex flex-col select-none border border-white/10 overflow-hidden font-sans">
  
  <div class="relative h-[55%] bg-black flex items-center justify-center overflow-hidden group">
    <div 
      class="editor-content relative bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] shadow-2xl transition-transform duration-500 ease-out"
      style="width:{pageWidth}px; height:{pageHeight}px; transform: scale(0.25);"
    >
      <!-- <div
        class="absolute top-0 left-0 w-full will-change-transform"
        style="transform: translateY(-{(index - 1) * payload.pageHeight}px);"
      > -->
      <div
        class="w-full will-change-transform bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)]"
        style="transform: translateY(-{actualIndex * payload.pageHeight}px);"
      >
        {@html payload.html}
      </div>
    </div>

    <div class="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rd-sm border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
       <span class="text-[9px] font-700 tracking-tighter text-base-content/70">SLIDE {index + 1}</span>
    </div>
  </div>

  <div class="flex-grow flex flex-col bg-base-100 border-t border-white/10 p-3">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-1.5 text-base-400">
        <i class="ph-bold ph-chats-teardrop text-xs"></i>
        <span class="text-[9px] font-800 uppercase tracking-widest">{$_('Notes')}</span>
      </div>
      <span class="text-[9px] font-500 text-base-content/30 font-mono">{index + 1} / {$totalSlides}</span>
    </div>

    <div class="flex-grow overflow-y-auto custom-scrollbar pr-1">
      <div class="text-[12px] leading-relaxed text-base-content/80 font-400 prose-invert">
        {#if payload.notes}
          {@html payload.notes}
        {:else}
          <span class="opacity-20 italic">{$_('No notes for this slide.')}</span>
        {/if}
      </div>
    </div>

    <div class="mt-2 w-full h-0.5 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rd-full overflow-hidden">
      <div 
        class="h-full bg-base-500 transition-all duration-300"
        style="width: {$totalSlides ? ((index + 1) / $totalSlides) * 100 : 0}%"
      ></div>
    </div>
  </div>
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }
</style>
