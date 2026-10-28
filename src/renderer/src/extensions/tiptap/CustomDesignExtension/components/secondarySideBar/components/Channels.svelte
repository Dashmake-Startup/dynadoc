<script lang="ts">
  import { _ } from 'svelte-i18n'
  /* 
  the Channels Tab is crucial for managing color separation. It displays the composite channel (RGB) followed by the individual color components (Red, Green, and Blue), as well as any Alpha channels (masks) you've created. */
  // --- SVELTE 5 STATE ---
  let channels = $state([
    {
      id: 'rgb',
      name: 'RGB',
      shortcut: 'Ctrl+2',
      visible: true,
      selected: true,
      isComposite: true
    },
    { id: 'red', name: 'Red', shortcut: 'Ctrl+3', visible: true, selected: true },
    { id: 'green', name: 'Green', shortcut: 'Ctrl+4', visible: true, selected: true },
    { id: 'blue', name: 'Blue', shortcut: 'Ctrl+5', visible: true, selected: true },
    {
      id: 'alpha1',
      name: 'Alpha 1',
      shortcut: 'Ctrl+6',
      visible: false,
      selected: false,
      isAlpha: true
    }
  ])

  const toggleVisibility = (index: number, e: MouseEvent) => {
    e.stopPropagation()
    channels[index].visible = !channels[index].visible
  }

  const selectChannel = (index: number) => {
    // Photoshop behavior: Clicking RGB selects all sub-channels.
    // Clicking an individual channel deselects others.
    const target = channels[index]

    if (target.isComposite) {
      channels.forEach((c) => (!c.isAlpha ? (c.selected = true) : (c.selected = false)))
      channels[index].selected = true
    } else {
      channels.forEach((c) => (c.selected = false))
      channels[index].selected = true
    }
  }
</script>

<div
  class="bg-base-200 flex flex-col h-full text-xs text-base-content/80 border-l border-base-content/10 select-none"
>
  <div class="flex-grow overflow-y-auto custom-scrollbar">
    {#each channels as channel, i}
      <div
        role="button"
        tabindex="0"
        onclick={() => selectChannel(i)}
        onkeydown={(e) => e.key === 'Enter' && selectChannel(i)}
        class="flex items-center h-12 border-b bg-base-400 transition-colors
               {channel.selected ? 'bg-base-content/12' : 'hover:bg-base-content/6'}"
      >
        <button
          onclick={(e) => toggleVisibility(i, e)}
          class="w-8 h-full flex items-center justify-center border-r border-base-content/10 opacity-80 hover:opacity-100"
        >
          {#if channel.visible}
            <div class="i-theme-workflow:visibility-show w-4 h-4"></div>
          {/if}
        </button>

        <div
          class="w-12 h-9 mx-2 bg-base-100 border border-base-content/15 flex-shrink-0 flex items-center justify-center overflow-hidden"
        >
          <div class="text-[8px] opacity-20 uppercase">{channel.name[0]}</div>
        </div>

        <div class="flex flex-grow justify-between pr-3">
          <span class={channel.selected ? 'text-base-content font-medium' : ''}>{channel.name}</span>
          <span class="opacity-30 text-[10px]">{channel.shortcut}</span>
        </div>
      </div>
    {/each}
  </div>

  <div class="p-2 border-t border-base-content/10 flex justify-end gap-4 px-4 bg-base-300/55">
    <button
      class="i-theme-workflow:selection-checked w-4 h-4 opacity-60 hover:opacity-100"
      title={$_('Load channel as selection')}
    ></button>
    <button
      class="i-theme-workflow:add w-4 h-4 opacity-60 hover:opacity-100"
      title={$_('Create new channel')}
    ></button>
    <button
      class="i-theme-workflow:delete w-4 h-4 opacity-60 hover:opacity-100"
      title={$_('Delete current channel')}
    ></button>
  </div>
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(var(--theme-text-rgb), 0.24);
    border-radius: 10px;
  }
</style>
