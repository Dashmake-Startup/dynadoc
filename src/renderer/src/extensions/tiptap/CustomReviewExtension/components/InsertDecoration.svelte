<script lang="ts">

  import { _ } from 'svelte-i18n'
  let { text, author }: { text: string, author: string } = $props()
</script>

<span class="insert-decoration" title={author}>
  {text}
</span>

<style>
  .insert-decoration {
    background-color: rgba(76, 175, 80, 0.12);
    border-bottom: 2px solid rgba(76, 175, 80, 0.6);
  }
</style>
