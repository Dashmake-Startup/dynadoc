<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { nodeFieldValues, updateNodeField, refreshNodeFieldValues } from '../../stores/field.store'

  let {
    nodeId,
    label = '',
    value = false,
    disabled = false,
    required = false,
    onInput = null
  }: {
    nodeId: string
    label?: string
    value?: boolean | string | number
    disabled?: boolean
    required?: boolean
    onInput?: ((value: boolean) => void) | null
  } = $props()

  let checked = false

  onMount(() => {
    refreshNodeFieldValues()
    const store = get(nodeFieldValues)
    if (nodeId && store[nodeId] && store[nodeId].value !== undefined) {
      checked = Boolean(store[nodeId].value)
    } else {
      checked = Boolean(value)
    }
  })

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement
    checked = target.checked
    if (onInput) onInput(checked)
    if (nodeId) updateNodeField(nodeId, 'value', checked)
  }
</script>

<label class="flex items-center gap-2 text-inherit">
  <input
    type="checkbox"
    class="checkbox checkbox-sm"
    bind:checked
    {disabled}
    {required}
    on:change={handleChange}
  />
  <span class="text-xs">{label}</span>
</label>
