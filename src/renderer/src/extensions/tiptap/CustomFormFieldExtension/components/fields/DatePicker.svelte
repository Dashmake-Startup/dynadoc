<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { nodeFieldValues, updateNodeField, refreshNodeFieldValues } from '../../stores/field.store'

  let {
    nodeId,
    value = '',
    disabled = false,
    required = false,
    onInput = null
  }: {
    nodeId: string
    value?: string
    disabled?: boolean
    required?: boolean
    onInput?: ((value: string) => void) | null
  } = $props()

  let selected = ''

  onMount(() => {
    refreshNodeFieldValues()
    const store = get(nodeFieldValues)
    if (nodeId && store[nodeId] && store[nodeId].value !== undefined) {
      selected = String(store[nodeId].value ?? '')
    } else {
      selected = value || ''
    }
  })

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement
    selected = target.value
    if (onInput) onInput(selected)
    if (nodeId) updateNodeField(nodeId, 'value', selected)
  }
</script>

<input
  type="date"
  class="input input-bordered input-sm text-inherit bg-transparent"
  bind:value={selected}
  {disabled}
  {required}
  on:change={handleChange}
/>
