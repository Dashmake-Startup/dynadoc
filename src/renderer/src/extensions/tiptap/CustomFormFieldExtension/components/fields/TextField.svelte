<script>
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { nodeFieldValues, updateNodeField, refreshNodeFieldValues } from '../../stores/field.store'
  import { get } from 'svelte/store'

  // import { createEventDispatcher } from 'svelte';

  let {
    nodeId,
    value = '',
    placeholder = 'Enter text...',
    label = '',
    helperText = '',
    disabled = false,
    required = false,
    onInput = null
  } = $props()

  // const dispatch = createEventDispatcher();

  onMount(() => {
    refreshNodeFieldValues()
    const store = get(nodeFieldValues)
    if (nodeId && store[nodeId] && store[nodeId].value !== undefined) {
      value = store[nodeId].value
    }
  })

  function handleInput(event) {
    value = event.target.value
    if (onInput) {
      onInput(value)
    }
    if (nodeId) updateNodeField(nodeId, 'value', value)

    // dispatch('input', { value });
  }
</script>

<input
  contenteditable="false"
  type="text"
  class="input input-bordered text-inherit bg-transparent border-green-500 h-inherit w-inherit"
  {placeholder}
  bind:value
  {disabled}
  {required}
  on:input={handleInput}
/>

<!-- 
<span class="form-control w-full">
  {#if label}
    <label class="label" contenteditable="false">
      <span class="label-text">{label}</span>
    </label>
  {/if}

  <input
    type="text"
    class="input input-bordered"
    {placeholder}
    bind:value
    {disabled}
    {required}
    on:input={handleInput}
  />

  {#if helperText}
    <label class="label">
      <span class="label-text-alt">{helperText}</span>
    </label>
  {/if}
</span> -->

<style>
  /* Optional: adjust opacity or transitions */
  .input {
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
    background-color: transparent;
    color: inherit;
  }

  .input:focus {
    border-color: #4ade80; /* Tailwind green-400 focus color */
    box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.3);
  }
</style>
