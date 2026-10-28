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
    name = '',
    onInput = null
  }: {
    nodeId: string
    value?: string
    options?: Option[]
    disabled?: boolean
    required?: boolean
    name?: string
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
    const target = event.target as HTMLInputElement
    selected = target.value
    if (onInput) onInput(selected)
    if (nodeId) updateNodeField(nodeId, 'value', selected)
  }
</script>

<div class="flex flex-col gap-1">
  {#each normalized() as opt}
    <label class="flex items-center gap-2 text-inherit">
      <input
        type="radio"
        class="radio radio-xs"
        name={name || nodeId}
        value={opt.value}
        checked={selected === opt.value}
        {disabled}
        {required}
        on:change={handleChange}
      />
      <span class="text-xs">{opt.label}</span>
    </label>
  {/each}
</div>
