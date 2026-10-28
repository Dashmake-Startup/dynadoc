<script lang="ts">
  import { _ } from 'svelte-i18n'
  import type { Snippet } from 'svelte'

  interface Props {
    __isVisible: boolean
    children: Snippet
  }

  let {__isVisible, children }: Props = $props()
  let hasMounted = $state(false)

  // Once it becomes visible the first time, keep it mounted forever
  $effect(() => {
    if (__isVisible) {
      hasMounted = true
    }
  })
</script>

<div class="lazy-persistent-container" class:hidden={!__isVisible} aria-hidden={!__isVisible}>
  {#if hasMounted}
    {@render children()}
  {/if}
</div>

<style>
  .lazy-persistent-container {
    height: 100%;
    width: 100%;
  }

  /* We use display: none to stop the browser from 
     rendering/painting while keeping the JS state alive */
  .hidden {
    display: none !important;
  }
</style>
