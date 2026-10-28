<script lang="ts">
  import { _ } from 'svelte-i18n'
  let { title = '', description = '', compact = false } = $props()
</script>

<div class="setting-row {compact ? 'compact' : ''}">
  <div class="copy">
    <div class="title">{title}</div>
    {#if description}
      <div class="description">{description}</div>
    {/if}
  </div>
  <div class="control">
    <slot />
  </div>
</div>

<style>
  .setting-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 16px;
    align-items: center;
    padding: 14px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .setting-row.compact {
    padding: 10px 0;
  }

  .title {
    font-size: 13px;
    font-weight: 700;
    color: #f2f2f2;
  }

  .description {
    font-size: 11px;
    color: #a2a2a2;
    margin-top: 4px;
    line-height: 1.45;
  }

  .control {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
