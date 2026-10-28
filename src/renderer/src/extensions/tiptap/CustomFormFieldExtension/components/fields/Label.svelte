

<script>
  import { _ } from 'svelte-i18n'
  // import { createEventDispatcher } from 'svelte';

  let { value = '', label = '', disabled = false } = $props()

  // const dispatch = createEventDispatcher();

</script>

<span class="text-xs opacity-70">{label || value}</span>

<style>
  /* Optional: adjust opacity or transitions */
  .input {
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .input:focus {
    border-color: #4ade80; /* Tailwind green-400 focus color */
    box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.3);
  }
</style>
