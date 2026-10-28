<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { nodeFieldValues, updateNodeField, refreshNodeFieldValues } from '../../stores/field.store'

  export type Option = string | { value: string; label?: string }

  let {
    nodeId,
    value = '',
    options = [],
    disabled = false,
    required = false,
    onInput = null
  }: {
    nodeId: string
    value?: string
    options?: Option[]
    disabled?: boolean
    required?: boolean
    onInput?: ((value: string) => void) | null
  } = $props()

  let selected = ''

  const normalized = () =>
    (options || []).map((opt) =>
      typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.label ?? opt.value }
    )

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
    const target = event.target as HTMLSelectElement
    selected = target.value
    if (onInput) onInput(selected)
    if (nodeId) updateNodeField(nodeId, 'value', selected)
  }
</script>

<select
  class="select select-bordered select-sm text-inherit bg-transparent"
  bind:value={selected}
  {disabled}
  {required}
  on:change={handleChange}
>
  {#each normalized() as opt}
    <option value={opt.value}>{opt.label}</option>
  {/each}
</select>
