<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'

  // Svelte 5 Props
  let {
    __width = $bindable(200),
    __height = $bindable(120),
    __minWidth = 60,
    __minHeight = 40,
    __maxWidth = Infinity,
    __maxHeight = Infinity,
    // __maxWidth = 100,
    // __maxHeight = 100,
  } = $props()
</script>

<div
  class="max-w-[{__maxWidth}px] max-h-[{__maxHeight}px] min-w-[{__minWidth}px] min-h-[{__minHeight}px]"
>
  <slot />
</div>
