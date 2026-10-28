<script lang="ts">
  import { _ } from 'svelte-i18n'
  let { checked = false, label = '', disabled = false } = $props()
</script>

<label class="toggle {disabled ? 'disabled' : ''}">
  <input type="checkbox" bind:checked disabled={disabled} />
  <span class="track">
    <span class="thumb"></span>
  </span>
  {#if label}
    <span class="label">{label}</span>
  {/if}
</label>

<style>
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .toggle.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input {
    display: none;
  }

  .track {
    width: 42px;
    height: 22px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    position: relative;
    transition: background 0.2s ease;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #f4f4f4;
    position: absolute;
    top: 1px;
    left: 2px;
    transition: transform 0.2s ease, background 0.2s ease;
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
  }

  input:checked + .track {
    background: linear-gradient(120deg, #2d6cff, #55a3ff);
    border-color: rgba(88, 166, 255, 0.6);
  }

  input:checked + .track .thumb {
    transform: translateX(20px);
    background: #ffffff;
  }

  .label {
    font-size: 11px;
    color: #c5c5c5;
  }
</style>
