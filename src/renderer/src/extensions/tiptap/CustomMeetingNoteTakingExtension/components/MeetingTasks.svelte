

<script lang="ts">
  import { _ } from 'svelte-i18n'
  let actions = $state([
    { id: 1, task: "Review UI Mockups", assignee: "Alex", deadline: "Today", status: "pending" }
  ]);

  function addManualAction() {
    actions.unshift({ 
        id: Date.now(), 
        task: "New Action Item", 
        assignee: "Unassigned", 
        deadline: "TBD", 
        status: "pending" 
    });
  }
</script>

<div class="h-full flex flex-col bg-base-200 text-base-content">
  <div class="p-4 flex justify-between items-center border-b border-base-content/10">
    <h3 class="text-[10px] font-900 uppercase tracking-widest text-[#2D9D78]">{$_('Action Items')}</h3>
    <button onclick={addManualAction} class="p-1 hover:bg-base-content/10 rounded">
      <i class="ph-bold ph-plus text-[#2D9D78]"></i>
    </button>
  </div>

  <div class="flex-1 overflow-y-auto p-2 space-y-2">
    {#each actions as action (action.id)}
      <div class="p-3 bg-base-content/[0.03] border border-base-content/10 rounded-lg group hover:border-[#2D9D78]/40 transition-all">
        <input
          bind:value={action.task} 
          class="bg-transparent border-none text-base-content text-[11px] font-600 w-full focus:outline-none"
        />
        <div class="flex items-center justify-between mt-3">
          <div class="flex gap-2">
             <span class="text-[8px] px-2 py-0.5 bg-base-300 rounded-full text-base-content/50 border border-base-content/10">
               @{action.assignee}
             </span>
             <span class="text-[8px] px-2 py-0.5 bg-[#2D9D78]/10 text-[#2D9D78] rounded-full">
               {action.deadline}
             </span>
          </div>
          <button class="opacity-0 group-hover:opacity-100 transition-opacity">
            <i class="ph-bold ph-bell-ringing text-[10px] text-base-content/20 hover:text-yellow-500"></i>
          </button>
        </div>
      </div>
    {/each}
  </div>
</div>
