<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  // import { EventEmitter } from 'events'

  // export let prompt: string
  const { __prompt, __done, __result } = $props<{
    __prompt: string
    __done?: boolean
    __result: string
  }>()
</script>

<span class="ai-content">
  {__result}
  <!-- {#if isLoading} -->
  <!-- Generating... -->
  <!-- ... -->
  <!-- {:else} -->
  <!-- Start Generation -->
  <!-- {/if} -->
  <!-- {responseText} -->
</span>

<style>
  .ai-content {
    background: linear-gradient(90deg, rgba(0, 120, 255, 0.2), rgba(200, 50, 255, 0.2));
  }
</style>
