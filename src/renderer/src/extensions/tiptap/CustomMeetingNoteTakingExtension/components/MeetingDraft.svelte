

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { tick } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import { transcriptionStore } from '../stores/transcription.store.svelte'

  let transcriptMode = $state('live')
  let filterStart = $state('')
  let filterEnd = $state('')
  let viewport: HTMLDivElement
  let isAtBottom = $state(true)

  // Derive data directly from the global background store
  let displayData = $derived(
    transcriptMode === 'live' ? transcriptionStore.liveFeed : transcriptionStore.historicalFeed
  )

  // Handle auto-scrolling logic
  $effect(() => {
    // We only want to auto-scroll if we are in 'live' mode AND the user is already at the bottom
    if (displayData.length && isAtBottom && transcriptMode === 'live') {
      scrollToBottom()
    }
  })

  function handleScroll() {
    if (!viewport) return
    const threshold = 100
    const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    isAtBottom = distanceToBottom < threshold
  }

  async function scrollToBottom() {
    await tick()
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })
  }

  function resetToLive() {
    filterStart = ''
    filterEnd = ''
    transcriptMode = 'live'
    isAtBottom = true
    scrollToBottom()
  }

  function handleFilterChange() {
    if (!filterStart && !filterEnd) {
      resetToLive()
    } else {
      transcriptMode = 'history'
      const today = new Date().toISOString().split('T')[0]
      const start = filterStart ? new Date(`${today}T${filterStart}`) : new Date(0)
      const end = filterEnd ? new Date(`${today}T${filterEnd}`) : new Date()

      // Use the store's reference to the worker to query
      transcriptionStore.queryHistory(start, end)
    }
  }

  function formatTime(date: Date | string) {
    const d = new Date(date)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
</script>

<!-- <br/><br/><br/><br/><br/><br/><br/><br/>d<br/><br/><br/><br/><br/>d<br/><br/><br/><br/>
<br/><br/><br/><br/><br/><br/><br/><br/>d<br/><br/><br/><br/><br/>d<br/><br/><br/><br/>
<br/><br/><br/><br/><br/><br/><br/><br/>d<br/><br/><br/><br/><br/>d<br/><br/><br/><br/>
<br/><br/><br/><br/><br/><br/><br/><br/>d<br/><br/><br/><br/><br/>d<br/><br/><br/><br/>
<br/><br/><br/><br/><br/><br/><br/><br/>d<br/><br/><br/><br/><br/>d<br/><br/><br/><br/>
<br/><br/><br/><br/><br/><br/><br/><br/>d<br/><br/><br/><br/><br/>d<br/><br/><br/><br/> -->

<div class="flex flex-col h-full bg-base-200 text-base-content relative overflow-hidden">
  <header class="p-3 bg-base-content/5 flex items-center justify-between border-b border-base-content/10 z-10">
    <div class="flex items-center gap-2">
      <div
        class="w-2 h-2 rounded-full {transcriptMode === 'live' ? 'bg-red-500' : 'bg-base-content/20'}"
      ></div>
      <span class="text-[10px] font-bold uppercase tracking-wider text-base-content/70">
        {transcriptMode === 'live' ? 'Live Transcript' : 'Archive Search'}
      </span>
    </div>

    <div class="flex items-center gap-2">
      <input
        type="time"
        bind:value={filterStart}
        onchange={handleFilterChange}
        class="time-input"
      />
      <span class="text-base-content/20 text-[10px]">to</span>
      <input type="time" bind:value={filterEnd} onchange={handleFilterChange} class="time-input" />
    </div>
  </header>

  <div
    bind:this={viewport}
    onscroll={handleScroll}
    class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth"
  >
    {#each displayData as entry (entry.id)}
      <div in:fade={{ duration: 150 }} class="transcript-entry">
        <div class="flex items-baseline gap-3 mb-1">
          <span class="text-[11px] font-black text-[#0265D2] uppercase tracking-tighter">
            {entry.peerName}
          </span>
          <span class="text-[9px] font-medium text-base-content/30">
            {formatTime(entry.timeObj)}
          </span>
        </div>
        <p class="text-[13px] text-base-content/90 leading-relaxed font-medium">
          {entry.text}
          {#if !entry.isFinal}<span class="text-[#0265D2]">|</span>{/if}
        </p>
      </div>
    {:else}
      <div class="h-full flex flex-col items-center justify-center opacity-20 text-base-content">
        <i class="ph-bold ph-microphone-stage text-6xl mb-2"></i>
        <p class="text-[10px] uppercase tracking-widest font-bold">{$_('Waiting for audio...')}</p>
      </div>
    {/each}
  </div>

  {#if !isAtBottom || transcriptMode === 'history'}
    <button
      transition:fly={{ y: 20, duration: 300 }}
      onclick={resetToLive}
      class="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#0265D2] hover:bg-[#0378f5] text-base-content px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 transition-transform active:scale-95 z-20"
    >
      <i class="ph-bold ph-arrow-down text-sm"></i>
      <span class="text-[10px] font-black uppercase tracking-widest">{$_('Jump to Present')}</span>
    </button>
  {/if}
</div>

<style>
  .time-input {
    @apply bg-[var(--color-base-100)] border border-[var(--color-base-content)]/10 text-[10px] text-[var(--color-base-content)] p-1 rounded focus:border-[#0265D2] outline-none;
  }
  .transcript-entry {
    @apply relative pl-4 border-l border-[var(--color-base-content)]/10 hover:border-[#0265D2]/50 transition-colors;
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(var(--theme-text-rgb), 0.14);
    border-radius: 10px;
  }
</style>
