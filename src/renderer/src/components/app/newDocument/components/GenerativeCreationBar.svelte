<script lang="ts">
  import { _ } from 'svelte-i18n'
  import type { DocumentContentType } from '../../../../models/Document'
  import EditorCommonUtils from '../../../../utils/common.utils'
  import EditorHelpers from '../../../../utils/EditorHelpers'

  // Svelte 5 State
  interface Props {
    prompt?
    selectedType?: DocumentContentType
  }

  let {
    prompt = $bindable(''),
    selectedType = 'text'
    // handleCreate
  }: Props = $props()
  //   let prompt = $state('')
  //   let selectedType = $state('text') // "text" | "design" | "slide" | "sheet"
  let textareaEl = $state<HTMLTextAreaElement>()
  let showError = $state(false) // New error state
  // Auto-resize logic for the textarea
  /* $effect(() => {
    if (textareaEl && prompt !== undefined) {
      //   textareaEl.style.height = 'auto'
      //   textareaEl.style.height = textareaEl.scrollHeight + 'px'
    }
  }) */

  // Auto-resize logic for the textarea
  $effect(() => {
    // We add 'prompt' here to ensure the effect reruns whenever text changes
    if (textareaEl && prompt !== undefined) {
      // 1. Reset height to auto to allow it to shrink if text is deleted
      textareaEl.style.height = 'auto';
      
      // 2. Set new height based on content
      // We use Math.min to cap it at a specific value (e.g., 200px)
      const nextHeight = Math.min(textareaEl.scrollHeight, 200);
      textareaEl.style.height = nextHeight + 'px';
    }
  });

  async function onKeyDown(e: KeyboardEvent) {
    // CMD/CTRL + Enter to submit (Standard Pro-App behavior)
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      await handleCreate()
    }
  }
  const TYPES = [
    { id: 'text', labelKey: 'Document', icon: 'ph-light ph-article', color: 'text-blue-400' },
    {
      id: 'design',
      labelKey: 'Design',
      icon: 'ph-light ph-paint-brush-broad',
      color: 'text-purple-400'
    },
    {
      id: 'slide',
      labelKey: 'Presentation',
      icon: 'ph-light ph-presentation-chart',
      color: 'text-orange-400'
    },
    { id: 'sheet', labelKey: 'Spreadsheet', icon: 'ph-light ph-table', color: 'text-green-400' }
  ]

  async function handleCreate() {
    // if (!prompt.trim()) return
    if (!prompt.trim()) {
      showError = true
      // Shake animation or focus effect
      textareaEl?.focus()
      return
    }

    showError = false // Reset error on success

    console.log(`Generating ${selectedType}: ${prompt}`)

    await EditorCommonUtils.addNewDocumentEditor(
      null,
      null,
      () => {
        // _canRenderComponents = true
      },
      selectedType,
      'generative',
      prompt
    )
  }
</script>

<div class="w-full mx-auto space-y-4 font-sans">
  <div
    class="flex items-center gap-1 p-1 bg-base-300 w-full rounded-lg border border-base-100 shadow-sm"
  >
    {#each TYPES as type}
      <button
        onclick={() => (selectedType = type.id)}
        class="flex items-center gap-2 px-4 py-1.5 rounded-md transition-all text-[12px] font-bold uppercase tracking-wider"
        class:bg-base-100={selectedType === type.id}
        class:text-primary={selectedType === type.id}
        class:shadow-sm={selectedType === type.id}
        class:opacity-50={selectedType !== type.id}
        class:hover:opacity-100={selectedType !== type.id}
      >
        <i class="{type.icon} text-lg {selectedType === type.id ? type.color : ''}"></i>
        {$_(type.labelKey)}
      </button>
    {/each}
  </div>

  <div
    class="group flex items-center gap-4 px-5 py-3 bg-base-200 border-2 border-transparent
         rounded-[16px] shadow-xl transition-all duration-300
         focus-within:bg-base-100 focus-within:border-primary/40 focus-within:shadow-2xl"
    class:border-transparent={!showError}
    class:border-error={showError}
    class:focus-within:border-primary-40={!showError}
  >
    <div class="flex-shrink-0 flex items-center justify-center">
      <i class="ph-light ph-sparkle text-primary text-[24px] animate-pulse33"></i>
    </div>

    <!-- <input
      type="text"
      bind:value={prompt}
      placeholder={$_('Describe the {selectedType} you want to create...')}
      class="flex-grow bg-transparent border-none outline-none text-xl font-medium tracking-tight
           placeholder:opacity-20 text-base-content min-w-0"
      onkeydown={(e) => e.key === 'Enter' && handleCreate()}
    /> -->

    <textarea
      bind:this={textareaEl}
      bind:value={prompt}
      placeholder="Describe the {selectedType} you want to create..."
      rows="1"
      oninput={() => (showError = false)}
      class="flex-grow bg-transparent border-none outline-none text-xl font-medium tracking-tight
           placeholder:opacity-20 text-base-content min-w-0 resize-none py-1 leading-relaxed
           overflow-auto  max-h-[200px]"
      onkeydown={onKeyDown}
    ></textarea>

    
    <!-- Error Message -->
    {#if showError}
      <div
        class="px-5 text-error text-xs font-bold uppercase tracking-widest animate-in fade-in slide-in-from-top-1"
      >
        <i class="ph-bold ph-warning-circle mr-1"></i>
        {$_('Please enter a description to generate')}
      </div>
    {/if}

    <div class="flex items-center gap-4 flex-shrink-0">
      <div
        class=" md:flex items-center gap-1 opacity-40 group-focus-within:opacity-100 group-focus-within:opacity-40 transition-opacity"
      >
        <kbd class="kbd kbd-sm bg-base-300 border-none font-mono text-[10px]">⌘</kbd>
        <kbd class="kbd kbd-sm bg-base-300 border-none font-mono text-[10px]">{$_('RET')}</kbd>
      </div>

      <button
        onclick={handleCreate}
        class="btn btn-primary btn-md h-12 px-6 rounded-[16px] font-black uppercase tracking-tighter
             shadow-lg hover:scale-105 active:scale-95 transition-all opacity-40 group-focus-within:opacity-100"
      >
        <i class="ph-bold i-icon ph-sparkle animate-pulse33"></i>

        {$_('Generate')}
      </button>
    </div>
  </div>

  <!-- <div class="relative group">
    <div class="absolute inset-y-0 left-5 flex items-center pointer-events-none">
      <i class="ph-light ph-sparkle text-primary text-[22px] animate-pulse33"></i>
    </div>

    <input
      type="text"
      bind:value={prompt}
      placeholder="Describe the {selectedType} you want to create..."
      class="w-full bg-base-200 border-2 border-transparent focus:border-primary/50 focus:bg-base-100 rounded-2xl py-6 pl-14 pr-32 outline-none text-xl transition-all shadow-xl placeholder:opacity-20 font-medium tracking-tight"
      onkeydown={(e) => e.key === 'Enter' && handleCreate()}
    />

    <div class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
      <div
        class="flex items-center gap-1 opacity-40 group-focus-within:opacity-100 transition-opacity"
      >
        <kbd class="kbd kbd-sm bg-base-300 border-base-100 font-mono">⌘</kbd>
        <kbd class="kbd kbd-sm bg-base-300 border-base-100 font-mono">RET</kbd>
      </div>

      <button
        onclick={handleCreate}
        class="btn btn-primary btn-md rounded-xl font-black uppercase tracking-tighter shadow-lg hover:scale-105 transition-transform"
      >
        Generate
      </button>
    </div>
  </div> -->

  <div class="flex flex-wrap gap-2 px-2">
    <span class="text-[10px] font-black uppercase tracking-widest opacity-30 mt-2 mr-2">
      {$_('Suggestions:')}
    </span>
    {#if selectedType === 'design'}
      <button class="suggestion-chip">{$_('Modern Bakery Logo')}</button>
      <button class="suggestion-chip">{$_('Instagram Story Set')}</button>
    {:else if selectedType === 'slide'}
      <button class="suggestion-chip">{$_('Q4 Financial Report')}</button>
      <button class="suggestion-chip">{$_('Product Pitch Deck')}</button>
    {/if}
  </div>
</div>

<style>
  .suggestion-chip {
    @apply px-3 py-1 rounded-full bg-[var(--color-base-200)] border border-[var(--color-base-300)] text-[11px] font-medium opacity-60 hover:opacity-100 hover:border-primary transition-all cursor-pointer;
  }
</style>
