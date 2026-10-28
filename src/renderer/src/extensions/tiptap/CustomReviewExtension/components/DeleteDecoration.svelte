<script lang="ts">

  import { _ } from 'svelte-i18n'
  let { text, author }: { text: string, author: string } = $props()
</script>

<span class="delete-decoration" title={author}>
  {text}
</span>

<style>
  .delete-decoration {
    text-decoration: line-through;
    opacity: 0.8;
    color: rgba(0,0,0,0.6);
  }
</style>
