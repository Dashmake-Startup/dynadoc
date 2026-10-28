<script lang="ts">
  interface Props {
    message?: string
    active?: boolean
  }

  let { message = 'Click to scroll/edit', active = true }: Props = $props()

  const state = $state({
    hovered: false,
    unlocked: false
  })

  const showOverlay = $derived(active && state.hovered && !state.unlocked)

  function handleEnter() {
    state.hovered = true
  }

  function handleLeave() {
    state.hovered = false
    state.unlocked = false
  }

  function handleUnlock() {
    if (!active) return
    state.unlocked = true
  }
</script>

<div class="scroll-guard" onmouseenter={handleEnter} onmouseleave={handleLeave}>
  <div class="scroll-guard__content">
    <slot />
  </div>
  {#if showOverlay}
    <div class="scroll-guard__overlay" onclick={handleUnlock}>
      <div class="scroll-guard__pill">{message}</div>
    </div>
  {/if}
</div>

<style>
  .scroll-guard {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .scroll-guard__content {
    width: 100%;
    height: 100%;
  }

  .scroll-guard__overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, rgba(var(--theme-text-rgb), 0.08), rgba(var(--theme-text-rgb), 0.16));
    backdrop-filter: blur(2px);
    cursor: pointer;
    z-index: 2;
  }

  .scroll-guard__pill {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    padding: 6px 10px;
    border-radius: 999px;
    background: var(--theme-popover-bg);
    color: rgba(var(--theme-text-rgb), 0.92);
    border: 1px solid var(--theme-border-subtle);
    box-shadow: var(--theme-popover-shadow);
  }
</style>
