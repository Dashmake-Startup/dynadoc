

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import { _$_referenceUpdates } from '../stores/common.store'
  import { NodeViewWrapper } from 'svelte-tiptap'

  // --- Props from SvelteNodeViewRenderer ---
  let { node, editor, getPos } = $props<{
    node: any
    editor: any
    getPos: () => number
  }>()

  // --- State Runes ---
  let contentHtml = $state('')
  let isBroken = $state(false)
  let isHovered = $state(false)

  // --- Derived Calculations ---
  const src = $derived(node.attrs.src || '')
  const uuid = $derived(src.includes('#') ? src.split('#')[1] : '')

  /**
   * Scans the document for the source UUID and extracts its content.
   * If not found, sets the node to 'broken' state.
   */
  function syncContent() {
            console.log("child.attrs syncContent", node)

    if (!uuid) {
      isBroken = true
      return
    }

    let found = false

    // Scan doc for the matching data-uuid or id
    editor.state.doc.descendants((child: any) => {
        console.log("child.attrs ", child.attrs)
      if (child.attrs['uuid'] === uuid || child.attrs['id'] === uuid) {
        found = true

        // Use Tiptap's internal view to serialize the node to HTML
        // This ensures custom extensions (like AI tags) render correctly
        const element = document.createElement('div')
        const { dom } = editor.outputs.html(child)
        contentHtml = dom.innerHTML || child.textContent || ''

        return false // Found it, stop searching
      }
    })

    isBroken = !found
  }

  /**
   * Uses the custom Tiptap command to find, scroll, and pulse the source node.
   */
  function jumpToSource() {
    if (isBroken) return
    editor.commands.scrollToNode(uuid)
  }

  onMount(() => {
    syncContent()

    // Subscribe to the global update bus.
    // When a transaction changes a node with a specific UUID, we re-sync.
    const unsubscribe = _$_referenceUpdates.subscribe((updatedUuid) => {
      // If the updated node is our source, or if we were broken (to check for recovery)
      if (updatedUuid === uuid || isBroken) {
        syncContent()
      }
    })

    return unsubscribe
  })
</script>

<NodeViewWrapper>
    uuid {uuid}
    src {src}
  <div
    class="dynamic-reference-container group relative my-6 transition-all duration-300"
    onmouseenter={() => (isHovered = true)}
    onmouseleave={() => (isHovered = false)}
  >
    <div
      class="relative overflow-hidden rounded-md border-l-4 p-4 shadow-sm"
      class:border-primary={!isBroken}
      class:bg-base-200={!isBroken}
      class:border-red-500={isBroken}
      class:bg-red-500-10={isBroken}
    >
      {#if isBroken}
        <div class="flex items-center gap-4 py-2">
          <div class="flex size-10 items-center justify-center rounded-full bg-red-500/20">
            <i class="ph-bold ph-link-break text-xl text-red-500"></i>
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">
              {$_('Link Severed')}
            </span>
            <span class="text-xs text-base-content/40 font-mono">
              Source 0x{uuid.slice(0, 8)} missing
            </span>
          </div>
        </div>
      {:else}
        <div class="mb-3 flex items-center justify-between border-b border-white/5 pb-2">
          <div class="flex items-center gap-2">
            <i class="ph-bold ph-intersect text-primary text-[14px]"></i>
            <span class="text-[9px] font-black uppercase tracking-widest text-base-content/30">
              {$_('Dynamic Mirror')}
            </span>
          </div>

          <button
            onclick={jumpToSource}
            class="flex items-center gap-1.5 rounded bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] px-2 py-1 text-[9px] font-bold uppercase tracking-tighter text-base-content/60 transition-all hover:bg-primary hover:text-base-content"
          >
            <i class="ph-bold ph-target"></i>
            {$_('Locate Source')}
          </button>
        </div>

        <div
          class="prose-invert pointer-events-none select-none text-sm leading-relaxed italic text-base-content/70"
        >
          {@html contentHtml || '<span class="opacity-20">{$_('Extracting content...')}</span>'}
        </div>
      {/if}

      <div class="absolute bottom-0 left-0 h-[2px] w-full bg-primary/10">
        <div
          class="h-full bg-primary transition-all duration-500"
          style="width: {isBroken ? '0%' : '100%'}"
        ></div>
      </div>
    </div>

    {#if isHovered && !isBroken}
      <div
        class="absolute -right-2 -top-2 rounded bg-primary px-2 py-0.5 text-[8px] font-black uppercase text-base-content shadow-lg"
      >
        {$_('Live Sync Active')}
      </div>
    {/if}
  </div>
</NodeViewWrapper>

<style>
  /* Optional: Ensure the preview looks like the rest of your MS Word / Adobe UI */
  .dynamic-reference-container {
    user-select: none;
  }

  /* Prevent the preview from inheriting unwanted editor styles */
  :global(.prose-invert img) {
    max-height: 150px;
    object-fit: contain;
    border-radius: 4px;
    margin: 10px 0;
  }
</style>
