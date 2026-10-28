<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom';
  import type { ContextMenuItem } from '../utils/utils';
  import { fade } from 'svelte/transition';

  let { item, onSelection } = $props<{ 
    item: ContextMenuItem; 
    onSelection: () => void 
  }>();

  let rowEl = $state<HTMLElement | null>(null);
  let submenuEl = $state<HTMLElement | null>(null);
  let showSub = $state(false);
  let closeTimeout: ReturnType<typeof setTimeout>;

  // --- Logic ---

  function handleMouseEnter() {
    if (item.disabled) return
    clearTimeout(closeTimeout);
    showSub = true;
  }

  function handleMouseLeave() {
    closeTimeout = setTimeout(() => {
      showSub = false;
    }, 150); // Increased slightly for better accessibility
  }

  // Use autoUpdate to keep the submenu attached if the window moves/resizes
  $effect(() => {
    if (showSub && rowEl && submenuEl) {
      const cleanup = autoUpdate(rowEl, submenuEl, () => {
        computePosition(rowEl!, submenuEl!, {
          placement: 'right-start',
          middleware: [
            offset(4), 
            flip({ fallbackPlacements: ['left-start', 'right-end'] }), 
            shift({ padding: 12 })
          ]
        }).then(({ x, y }) => {
          if (submenuEl) {
            submenuEl.style.left = `${x}px`;
            submenuEl.style.top = `${y}px`;
          }
        });
      });

      return cleanup; // Svelte 5 effect cleanup
    }
  });
</script>

<div 
  bind:this={rowEl}
  class="relative w-full"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  role="none"
>
  <button
    type="button"
    disabled={item.disabled}
    title={item.disabled && item.tooltip ? $_(item.tooltip) : ''}
    class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-[4px] cursor-pointer group transition-all 
           {item.disabled
             ? 'opacity-40 cursor-not-allowed text-base-content/40'
             : showSub && item.children
               ? 'bg-primary text-base-content'
               : 'hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-base-content/80'}"
    onclick={(e) => {
      if (item.disabled) return;
      if (item.children) {
        showSub = !showSub;
      } else {
        item.action?.();
        onSelection();
      }
    }}
  >
    <div class="flex items-center gap-3">
      {#if item.icon}
        <i class="{item.icon} text-[16px] {item.disabled
          ? 'text-base-content/30'
          : showSub && item.children
            ? 'text-base-content'
            : 'text-base-content/40 group-hover:text-primary'}"></i>
      {:else}
        <div class="w-4"></div>
      {/if}
      
      <span class="text-[11px] font-medium tracking-wide">{$_(item.label)}</span>
    </div>
    
    <div class="flex items-center gap-2">
      {#if item.shortcut}
        <span class="text-[9px] font-mono opacity-40 group-hover:opacity-100">{item.shortcut}</span>
      {/if}
      {#if item.children}
        <i class="ph-bold ph-caret-right text-[10px] opacity-50"></i>
      {/if}
    </div>
  </button>

  {#if item.children && showSub}
    <div
      bind:this={submenuEl}
      class="submenu-container fixed z-[1002] bg-base-100 border border-white/10 rounded-lg shadow-2xl p-1.5 min-w-[200px]"
      onmouseenter={handleMouseEnter}
      onmouseleave={handleMouseLeave}
      transition:fade={{ duration: 60 }}
    >
      {#each item.children as child}
        <svelte:self item={child} {onSelection} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .submenu-container {
    /* Critical: must be fixed to work with Floating UI's absolute coordinates */
    position: fixed;
    top: 0;
    left: 0;
  }

  /* THE INVISIBLE BRIDGE
     This fills the gap between the parent and the child.
     Without this, the mouse leaving the parent row triggers 'mouseleave' 
     before it hits the child menu.
  */
  .submenu-container::before {
    content: '';
    position: absolute;
    /* Bridge the 4px gap + provide a safety buffer */
    left: -15px; 
    top: 0;
    bottom: 0;
    width: 20px;
    background: transparent;
  }
</style>
