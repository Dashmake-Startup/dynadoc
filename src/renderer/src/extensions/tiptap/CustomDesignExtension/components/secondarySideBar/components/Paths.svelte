

<script lang="ts">
  import { _ } from 'svelte-i18n'
    /* 
    The Paths Tab is where Photoshop stores vector-based work, such as Pen Tool drawings and Work Paths. It is functionally simpler than Layers but uses specific interaction patterns, such as "Work Path" persistence (a temporary path that gets overwritten unless named).
    */
  // --- SVELTE 5 STATE ---
  let paths = $state([
    { id: 'p1', name: 'Work Path', isActive: true, isWorkPath: true },
    { id: 'p2', name: 'Bottle Outline', isActive: false, isWorkPath: false },
    { id: 'p3', name: 'Logo Vector', isActive: false, isWorkPath: false },
  ]);

  const selectPath = (id: string) => {
    paths.forEach(p => p.isActive = (p.id === id));
  };

  const deletePath = (id: string) => {
    paths = paths.filter(p => p.id !== id);
  };

  const createNewPath = () => {
    const newId = `p${Date.now()}`;
    // Add a new named path
    paths = [...paths.map(p => ({...p, isActive: false})), {
      id: newId,
      name: `Path ${paths.length + 1}`,
      isActive: true,
      isWorkPath: false
    }];
  };
</script>

<div class="bg-base-200 flex flex-col h-full text-xs text-base-content/80 border-l border-base-content/10 select-none">


  <div class="flex-grow overflow-y-auto custom-scrollbar">
    {#if paths.length === 0}
      <div class="p-8 text-center opacity-30 italic">
        {$_('No paths available.')}
      </div>
    {:else}
      {#each paths as path (path.id)}
        <div 
          role="button"
          tabindex="0"
          onclick={() => selectPath(path.id)}
          onkeydown={(e) => e.key === 'Enter' && selectPath(path.id)}
          class="flex items-center h-12 border-b bg-base-400 transition-colors
                 {path.isActive ? 'bg-base-content/12 text-base-content' : 'hover:bg-base-content/6'}"
        >
          <div class="w-12 h-9 mx-3 bg-base-100 border border-base-content/15 flex-shrink-0 flex items-center justify-center">
              <div class="i-theme-workflow:path-edit w-5 h-5 opacity-40"></div>
          </div>

          <div class="flex-grow truncate">
            <span class={path.isWorkPath ? 'italic opacity-80' : 'font-medium'}>
              {path.name}
            </span>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <div class="p-2 border-t border-base-content/10 flex justify-between px-4 bg-base-300/55">
    <div class="flex gap-4 opacity-60">
      <button class="i-theme-workflow:fill w-4 h-4 hover:opacity-100" title={$_('Fill path with foreground color')}></button>
      <button class="i-theme-workflow:stroke w-4 h-4 hover:opacity-100" title={$_('Stroke path with brush')}></button>
      <button class="i-theme-workflow:selection-checked w-4 h-4 hover:opacity-100" title={$_('Load path as selection')}></button>
      <button class="i-theme-workflow:mask-path w-4 h-4 hover:opacity-100" title={$_('Make selection from path')}></button>
    </div>

    <div class="flex gap-4 opacity-60">
      <button 
        onclick={createNewPath}
        class="i-theme-workflow:add w-4 h-4 hover:opacity-100" 
        title={$_('Create new path')}
      ></button>
      <button 
        onclick={() => {
          const active = paths.find(p => p.isActive);
          if (active) deletePath(active.id);
        }}
        class="i-theme-workflow:delete w-4 h-4 hover:opacity-100" 
        title={$_('Delete current path')}
      ></button>
    </div>
  </div>
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--theme-text-rgb), 0.24); border-radius: 10px; }
</style>
