<script lang="ts">
  import { _ } from 'svelte-i18n'

  // 1. Define Props using $props()
  let {
    key,
    component,
    props = {}
  }: {
    key: string
    component: any
    props?: Record<string, any>
  } = $props()

  // 2. Setup Global Cache
  // We use a regular variable because the Map itself doesn't need to be
  // a Svelte state, but the values inside it might.
  if (!(globalThis as any).__cachedComponents) {
    ;(globalThis as any).__cachedComponents = new Map<string, any>()
  }
  const cache: Map<string, any> = (globalThis as any).__cachedComponents

  // 3. Instance state using $state()
  let instance = $state<any>(null)

  // 4. Replace $: with $effect
  // This runs whenever key, component, or props changes
  $effect(() => {
    // Hide all other instances in the global cache
    cache.forEach((c, k) => {
      c.visible = k === key
    })

    // Create or Update the cache entry
    if (!cache.has(key)) {
      cache.set(key, {
        component,
        props,
        visible: true
      })
    } else {
      const entry = cache.get(key)
      entry.props = props
      entry.visible = true
    }

    // Update the local state to trigger a re-render
    instance = cache.get(key)
  })
</script>

{#if instance}
  <div class:hidden={!instance.visible}>
    <instance.component {...instance.props} />
  </div>
{/if}

<style>
  .hidden {
    display: none;
  }
</style>
