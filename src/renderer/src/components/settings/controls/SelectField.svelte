<script lang="ts">
  import { _ } from 'svelte-i18n'
  let { value = '', options = [], disabled = false } = $props()
</script>

<div class="select-wrapper">
  <select bind:value disabled={disabled}>
    {#each options as option}
      <option value={option}>{option}</option>
    {/each}
  </select>
  <i class="ph-light ph-caret-down"></i>
</div>

<style>
  .select-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  select {
    appearance: none;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f1f1f1;
    font-size: 11px;
    padding: 6px 28px 6px 10px;
    border-radius: 8px;
    min-width: 140px;
  }

  select:focus {
    outline: none;
    border-color: rgba(88, 166, 255, 0.8);
    box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.15);
  }

  i {
    position: absolute;
    right: 10px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    pointer-events: none;
  }
</style>
