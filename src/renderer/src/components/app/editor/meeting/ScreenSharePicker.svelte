<script>
  import { onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  let sources = $state([])
  let showModal = $state(false)

  onMount(() => {
    // Listen for the sources from Main Process
    /* window.meetingAPI.onFromMain('show-screen-picker', (data) => {
      sources = data;
      showModal = true;
    }); */

    window.meetingAPI.onShowScreenPicker((_sources) => {
      console.error('Rece ipc:  meeting:show-screen-picker', { _sources })

      sources = _sources
      showModal = true
    })
  })

  function selectSource(id) {
    // window.meetingAPI.sendToMain('screen-source-selected', id)
    window.meetingAPI.selectScreenSource(id)

    showModal = false
  }
</script>

{#if showModal}
  <div
    class="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-8"
  >
    <div
      class="bg-[#1E1E1E] border border-[#3E3E3E] rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl"
    >
      <header class="p-6 border-b border-[#3E3E3E] flex justify-between items-center">
        <h2 class="text-base-content text-xl font-semibold">{$_('Share your screen')}</h2>
        <button onclick={() => (showModal = false)} class="text-base-content/50 hover:text-base-content">✕</button
        >
      </header>

      <div class="p-6 overflow-y-auto grid grid-cols-3 gap-4">
        {#each sources as source}
          <button
            onclick={() => selectSource(source.id)}
            class="group flex flex-col gap-2 p-2 rounded-lg hover:bg-base-200 transition-all"
          >
            <div
              class="aspect-video bg-black rounded border border-[#3E3E3E] overflow-hidden group-hover:border-[#0265D2]"
            >
              <img src={source.thumbnail} alt={source.name} class="w-full h-full object-cover" />
            </div>
            <span class="text-[11px] text-base-content/70 truncate text-left">{source.name}</span>
          </button>
        {/each}
      </div>

      <footer class="p-4 border-t border-[#3E3E3E] flex justify-end">
        <button onclick={() => (showModal = false)} class="px-6 py-2 text-base-content/50 text-sm"
          >{$_('Cancel')}</button
        >
      </footer>
    </div>
  </div>
{/if}

<style>
  /* Adobe precision scrollbar */
  div::-webkit-scrollbar {
    width: 6px;
  }
  div::-webkit-scrollbar-thumb {
    background: #3e3e3e;
    border-radius: 10px;
  }
</style>
