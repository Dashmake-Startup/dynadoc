<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { _ } from 'svelte-i18n'
  let { message = '', visible = false } = $props()
  const dispatch = createEventDispatcher()

  let input = ''

  function submit() {
    dispatch('submit', input)
    input = ''
  }

  function cancel() {
    dispatch('cancel')
    input = ''
  }
</script>

{#if visible}
  <div class="modal-backdrop">
    <div class="modal">
      <p>{message}</p>
      <input bind:value={input} />
      <div style="margin-top: 8px;">
        <button on:click={submit}>{$_('OK')}</button>
        <button on:click={cancel}>{$_('Cancel')}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  .modal {
    background: white;
    padding: 1rem;
    border-radius: 5px;
    min-width: 300px;
  }
  input {
    width: 100%;
    padding: 4px 8px;
    margin-top: 4px;
    box-sizing: border-box;
  }
  button {
    margin-right: 4px;
  }
</style>
