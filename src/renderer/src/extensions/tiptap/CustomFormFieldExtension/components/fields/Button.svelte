<script lang="ts">
  let { label = 'Button', disabled = false } = $props()
</script>

<button class="btn btn-sm" type="button" {disabled}>
  {label}
</button>
