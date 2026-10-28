<script>

  import { _ } from 'svelte-i18n'
  import TemplateCard from './TemplateCard.svelte';
  let { templates = [] } = $props()
</script>

<div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
  {#each templates as template}
    <!-- <TemplateCard {template} /> -->
  {/each}
</div>