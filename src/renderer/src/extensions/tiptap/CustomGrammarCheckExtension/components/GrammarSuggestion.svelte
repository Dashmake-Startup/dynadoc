<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { computePosition, flip, shift, offset } from '@floating-ui/dom'
  import type { Editor } from '@tiptap/core'
  import { fade, fly, scale } from 'svelte/transition'
  import { CustomGrammarCheckExtensionProps } from '../utils/common.utils'

  interface Props {
    editor: Editor
  }
  let { editor = $bindable() }: Props = $props()

  // --- Runes State ---
  let activeError = $state<any>(null)
  let replacements = $state<any[]>([])
  let floatingEl = $state<HTMLElement | null>(null)
  let pos = $state({ x: 0, y: 0 })
  let isExplaining = $state(false)
  let mode = $state<'standard' | 'picky'>('picky')

  // ✅ FIX: Local shadow set of ignored keys so syncErrorState
  // immediately sees them even before storage propagates
  let localIgnoredKeys = $state<Set<string>>(new Set())

  // --- Logic ---
  function syncErrorState() {
    if (!editor) return
    const { selection } = editor.state
    const storage = editor.storage[CustomGrammarCheckExtensionProps.name]
    if (!storage?.matches) return
    mode = storage?.settings?.mode || mode

    // ✅ FIX: Merge storage-level ignored keys with our local shadow set
    const storageIgnored: Set<string> = storage.ignoredMatchKeys || new Set()
    const ignored = new Set([...storageIgnored, ...localIgnoredKeys])

    const allMatches = Array.from(storage.matches.values())
      .flat()
      .filter((m: any) => !ignored.has(m.matchKey))

    // ✅ FIX: Pass the already-filtered allMatches into findMatchAtPos
    // instead of letting it re-query raw storage internally
    const match = findMatchAtPos(editor, allMatches, selection.from)

    if (match && Array.isArray(match.replacements) && match.replacements.length > 0) {
      activeError = match
      replacements = match.replacements
      requestAnimationFrame(updatePosition)
    } else {
      activeError = null
      replacements = []
      isExplaining = false
    }
  }

  // Effect for listeners
  $effect(() => {
    if (!editor) return undefined
    editor.on('selectionUpdate', syncErrorState)
    editor.on('transaction', syncErrorState)
    return () => {
      editor.off('selectionUpdate', syncErrorState)
      editor.off('transaction', syncErrorState)
    }
  })

  async function updatePosition() {
    if (!activeError || !floatingEl) return
    try {
      const domCoords = editor.view.coordsAtPos(activeError.from)
      const virtualEl = {
        getBoundingClientRect: () =>
          new DOMRect(domCoords.left, domCoords.top, 0, domCoords.bottom - domCoords.top)
      }
      const { x, y } = await computePosition(virtualEl, floatingEl, {
        placement: 'bottom-start',
        middleware: [offset(16), flip(), shift({ padding: 10 })]
      })
      pos = { x, y }
    } catch (e) {
      activeError = null
    }
  }

  function applyFix(replacement: string) {
    editor
      .chain()
      .focus()
      .insertContentAt({ from: activeError.from, to: activeError.to }, replacement)
      .run()
    activeError = null
  }

  function ignoreThis() {
    const storage = editor?.storage?.[CustomGrammarCheckExtensionProps.name]
    const docKey = storage?.docKey || ''
    const matchKey = activeError?.matchKey || ''

    // ✅ FIX: Register into local shadow set FIRST, before nulling activeError
    // and before the transaction/selectionUpdate re-fires syncErrorState
    if (matchKey) {
      localIgnoredKeys = new Set([...localIgnoredKeys, matchKey])
    }

    if (docKey && matchKey) {
      window.dispatchEvent(
        new CustomEvent('dynadoc:grammar-ignore', {
          detail: { docKey, matchKey }
        })
      )
    }

    activeError = null
  }

  function toggleMode() {
    const storage = editor?.storage?.[CustomGrammarCheckExtensionProps.name]
    const docKey = storage?.docKey || ''
    if (!docKey) return
    const next = mode === 'picky' ? 'standard' : 'picky'
    mode = next
    window.dispatchEvent(
      new CustomEvent('dynadoc:grammar-settings', {
        detail: { docKey, settings: { mode: next } }
      })
    )
  }

  // ✅ FIX: findMatchAtPos now works purely from the pre-filtered `matches`
  // array passed in — it no longer re-queries raw storage, closing the bypass
  function findMatchAtPos(editor: any, filteredMatches: any[], currentPos: number) {
    let found = null
    editor.state.doc.descendants((node: any, nodePos: number) => {
      if (found) return false // early exit once found

      const id = node.attrs.uid || node.attrs.uuid || node.attrs.id || node.attrs['data-uuid']
      if (!id) return

      // Only look at matches that survived the ignored filter
      const nodeMatches = filteredMatches.filter(
        (m: any) => m.nodeId === id || m.paragraphId === id
      )

      // ✅ Fallback: if matches don't carry a nodeId, derive position the old
      // way but only from the already-filtered list
      const storage = editor.storage[CustomGrammarCheckExtensionProps.name]
      const rawNodeMatches = storage?.matches?.get(id) || []

      rawNodeMatches.forEach((m: any) => {
        // ✅ Skip if this match was filtered out (ignored)
        if (!filteredMatches.some((fm: any) => fm.matchKey === m.matchKey)) return

        const start = nodePos + 1 + m.offset
        const end = start + m.length
        if (currentPos >= start && currentPos <= end) {
          found = { ...m, from: start, to: end }
        }
      })
    })
    return found
  }

  function showGhost(replacement: string) {
    if (!activeError?.from || !activeError?.to || typeof replacement !== 'string') return
    editor.view.dispatch(
      editor.state.tr
        .setMeta('ghostUpdate', {
          from: activeError.from,
          to: activeError.to,
          text: replacement
        })
        .setMeta('ltUpdate', true)
    )
  }

  function clearGhost() {
    editor.view.dispatch(editor.state.tr.setMeta('ghostUpdate', null).setMeta('ltUpdate', true))
  }
</script>

{#if activeError}
  <div
    bind:this={floatingEl}
    style="left: {pos.x}px; top: {pos.y}px;"
    transition:fly={{ y: 12, duration: 400, easing: (t) => 1 - Math.pow(1 - t, 4) }}
    class="fixed z-100 w-[320px] flex flex-col overflow-hidden
           bg-base-100 backdrop-blur-2xl border border-white/10 rounded-2xl
           shadow-[0_32px_64px_-16px_rgba(0,0,0,0.7)] text-base-content select-none"
  >
    <header
      class="flex items-center justify-between px-4 py-2.5 bg-[color-mix(in_srgb,var(--color-base-white)_3%,transparent)] border-b border-white/5"
    >
      <div class="flex items-center gap-2.5">
        <div class="relative size-2">
          <div class="absolute inset-0 bg-primary rounded-full animate-ping opacity-40"></div>
          <div class="relative size-full bg-primary rounded-full shadow-[0_0_10px]"></div>
        </div>
        <span class="text-[10px] font-black uppercase tracking-[0.15em] text-base-content/40">
          {$_('Neural Insight')} <span class="mx-1 opacity-20">//</span>
          {activeError.langDetected || 'EN'}
        </span>
      </div>
      <button
        onclick={() => (activeError = null)}
        aria-label={$_('Close grammar suggestion')}
        class="size-5 flex items-center justify-center rounded-full hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] transition-colors text-base-content/30 hover:text-base-content"
      >
        <i class="i-ph-x-bold text-[10px]"></i>
      </button>
    </header>

    <div class="p-4 flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-2">
          <span class="text-[9px] font-black text-primary uppercase tracking-widest"
            >{$_('Diagnostic')}</span
          >
          <div class="h-px flex-1 bg-primary/20"></div>
        </div>
        <p
          class="text-[14px] leading-snug font-medium text-base-content/90 italic decoration-primary/30 underline-offset-4 decoration-2"
        >
          "{activeError.message}"
        </p>
      </div>

      <div class="flex flex-col gap-2.5">
        <div class="flex items-center justify-between">
          <span class="text-[9px] font-black text-base-content/20 uppercase tracking-widest"
            >{$_('Neural Fixes')}</span
          >
          <span class="text-[8px] font-mono text-base-content/10 italic"
            >{$_('High Confidence')}</span
          >
        </div>

        <div class="flex flex-col gap-1.5">
          {#if replacements.length > 0}
            {#each replacements.slice(0, 3) as repl, i}
              <button
                onmouseenter={() => showGhost(repl?.value)}
                onmouseleave={clearGhost}
                onclick={() => applyFix(repl?.value)}
                class="group flex items-center justify-between w-full p-3 rounded-xl
                       bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/5 hover:border-primary/50 hover:bg-primary/[0.08]
                       transition-all duration-300 active:scale-[0.98]"
              >
                <span
                  class="text-[15px] font-bold text-base-content tracking-tight group-hover:text-primary transition-colors"
                >
                  {repl?.value ?? $_('No replacement')}
                </span>
                <div class="flex items-center gap-3">
                  <kbd
                    class="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-[9px] font-mono text-base-content/20 group-hover:text-primary/60 transition-colors"
                  >
                    ⌘{i + 1}
                  </kbd>
                  <i
                    class="i-ph-arrow-right-bold text-[12px] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary"
                  ></i>
                </div>
              </button>
            {/each}
          {:else}
            <div
              class="rounded-xl border border-white/10 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] p-3 text-[13px] text-base-content/60"
            >
              {$_('No grammar suggestions available for this selection.')}
            </div>
          {/if}
        </div>
      </div>

      {#if isExplaining && replacements.length > 0}
        <div
          transition:scale={{ start: 0.95, duration: 200 }}
          class="p-3.5 bg-primary/[0.03] rounded-xl border border-primary/20 relative overflow-hidden"
        >
          <div class="absolute top-0 left-0 w-1 h-full bg-primary/40"></div>
          <p class="text-[12px] text-base-content/60 leading-relaxed pl-2">
            {$_('dynadoc suggests')}
            <span class="text-primary font-bold">"{replacements[0]?.value}"</span>
            {$_(
              'to align with standard subject-verb agreement patterns found in high-quality professional documents.'
            )}
          </p>
        </div>
      {/if}
    </div>

    <footer class="flex items-center justify-between px-4 py-3 bg-black/40 border-t border-white/5">
      <div class="flex gap-4">
        <button
          class="flex items-center gap-2 text-[11px] font-bold text-base-content/40 hover:text-primary transition-all"
          onclick={toggleMode}
          title="Toggle grammar strictness"
        >
          <i class="i-ph-sliders-horizontal-bold text-[16px]"></i>
          {mode === 'picky' ? 'Picky' : 'Standard'}
        </button>

        <button
          class="flex items-center gap-2 text-[11px] font-bold transition-colors"
          class:text-primary={isExplaining}
          class:text-base-content-40={!isExplaining}
          onclick={() => (isExplaining = !isExplaining)}
        >
          <i class="i-ph-info-fill text-[16px]"></i>
          {isExplaining ? 'Collapse' : 'Explain'}
        </button>

        <button
          class="flex items-center gap-2 text-[11px] font-bold text-base-content/40 hover:text-primary transition-all group"
        >
          <i class="i-ph-sparkle-fill text-[16px] group-hover:animate-pulse text-primary/60"></i>
          {$_('Neural Rephrase')}
        </button>
      </div>

      <button
        class="text-[11px] font-bold text-base-content/20 hover:text-amber-300 transition-colors"
        onclick={ignoreThis}
      >
        {$_('Ignore')}
      </button>
    </footer>
  </div>
{/if}

<style>
  /* 🟢 Adobe Spectrum 2 Underline */
  :global(.lt-error-underline) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='3'%3E%3Cpath d='M0 2.5 Q 2 0, 4 2.5 T 8 2.5' fill='none' stroke='%230265D2' stroke-width='1.5'/%3E%3C/svg%3E");
    background-repeat: repeat-x;
    background-position: bottom;
    padding-bottom: 4px;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  :global(.lt-error-underline:hover) {
    cursor: pointer;
  }
  /*  :global(.ghost-preview-text) {
  background-color: rgba(0, 118, 255, 0.15); 
  color: transparent !important;
  position: relative;
  border-radius: 2px;
}

:global(.ghost-preview-text::after) {
  content: attr(data-replacement);
  position: absolute;
  left: 0;
  top: 0;
  color: #0076ff;
  font-weight: 500;
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  pointer-events: none;
  animation: fadePulse 1.5s infinite ease-in-out;
}

@keyframes fadePulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
} */

  :global(.ghost-preview-text) {
    color: transparent !important;
    position: relative;
    border-radius: 2px;
  }

  :global(.ghost-preview-text::after) {
    content: attr(data-replacement);
    position: absolute;
    left: 2px;
    top: 0;
    /* Adobe Spectrum 2 Blue */
    color: #147aff;
    font-weight: 500;
    white-space: nowrap;
    letter-spacing: -0.01em;

    /* Precision Underline */
    text-decoration: underline;
    text-decoration-color: rgba(20, 122, 255, 0.4);
    text-decoration-thickness: 2.5px;
    text-underline-offset: 4px;
    text-decoration-skip-ink: none;

    /* The AI Shimmer Scan */
    background: linear-gradient(
      120deg,
      transparent 20%,
      rgba(255, 255, 255, 0.8) 50%,
      transparent 80%
    );
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    animation: adobeAIScan 2.5s infinite linear;
  }

  /* The Glow Aura */
  :global(.ghost-preview-text::before) {
    content: '';
    position: absolute;
    inset: -1px -4px;
    background: rgba(20, 122, 255, 0.08);
    filter: blur(4px);
    border-radius: 8px;
    z-index: -1;
    animation: pulseBlur 2s infinite ease-in-out;
  }

  /* Dark Mode: Adobe Spectrum Midnight */
  :global(.dark .ghost-preview-text::after) {
    color: #4da3ff;
    text-decoration-color: rgba(77, 163, 255, 0.5);
  }
</style>
