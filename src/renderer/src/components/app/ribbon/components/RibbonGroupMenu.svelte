<script lang="ts">
  import { _ } from 'svelte-i18n'
  import type { Group } from './utils/utils'

  let { group } = $props<{ group: Group }>()
</script>

<!-- <div class="ribbon-group-menu" aria-label={$_(group.title)}> -->
<div
  class="p-3 bg-base-100 text-base-content rounded-sm shadow-xl border border-base-300 py-1 font-sans select-none overflow-hidden"
  aria-label={$_(group.title)}
>
  <div class="ribbon-group-menu-title">{$_(group.title)}</div>
  <div class="ribbon-group-menu-actions">
    {#each group.items as item}
      {#if item?.body}
        <div class="ribbon-group-menu-action" title={item.label || item.id}>
          <svelte:component this={item.body.component} {...item.body.props} compact />
        </div>
      {/if}
    {/each}
  </div>
</div>

<!-- <style>
  .ribbon-group-menu {
    min-width: 190px;
    max-width: min(520px, calc(100vw - 24px));
    padding: 0.4rem;
    border: 1px solid var(--color-base-300);
    border-radius: 0.5rem;
    background: var(--color-base-100);
    box-shadow: 0 12px 28px color-mix(in srgb, black 25%, transparent);
  }

  .ribbon-group-menu-title {
    padding: 0.25rem 0.4rem 0.45rem;
    color: color-mix(in srgb, var(--color-base-content) 70%, transparent);
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .ribbon-group-menu-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.15rem;
    max-height: min(360px, calc(100vh - 140px));
    overflow: auto;
  }

  .ribbon-group-menu-action {
    display: flex;
    min-width: 28px;
    min-height: 28px;
    align-items: center;
    justify-content: center;
  }
</style> -->
