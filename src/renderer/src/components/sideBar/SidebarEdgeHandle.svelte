<script lang="ts">
  import { _ } from 'svelte-i18n'

  let { side, onExpand } = $props<{ side: 'left' | 'right'; onExpand: () => void }>()

  const isLeft = $derived(side === 'left')
  const label = $derived(isLeft ? $_('Show left sidebar') : $_('Show right sidebar'))
</script>

<button
  class="app-component-no-print sidebar-edge-handle"
  class:sidebar-edge-handle-left={isLeft}
  class:sidebar-edge-handle-right={!isLeft}
  type="button"
  title={label}
  aria-label={label}
  onclick={onExpand}
>
  <i class={`ph-bold ${isLeft ? 'ph-caret-right' : 'ph-caret-left'}`}></i>
</button>

<style>
  .sidebar-edge-handle {
    position: fixed;
    top: 40%;
    z-index: 75;
    display: flex;
    width: 16px;
    height: 46px;
    align-items: center;
    justify-content: center;
    border: 1px solid color-mix(in srgb, var(--color-base-content) 16%, transparent);
    background: color-mix(in srgb, var(--color-base-100) 92%, transparent);
    color: color-mix(in srgb, var(--color-base-content) 62%, transparent);
    box-shadow: 0 2px 10px color-mix(in srgb, black 18%, transparent);
    backdrop-filter: blur(10px);
    transform: translateY(-50%);
    transition:
      width 160ms ease,
      background-color 160ms ease,
      color 160ms ease;
  }
  .sidebar-edge-handle:hover {
    width: 22px;
    background: var(--color-base-200);
    color: var(--color-primary);
  }
  .sidebar-edge-handle-left {
    left: 0;
    border-radius: 0 7px 7px 0;
    border-left: 0;
  }
  .sidebar-edge-handle-right {
    right: 0;
    border-radius: 7px 0 0 7px;
    border-right: 0;
  }
</style>
