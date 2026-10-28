<script lang="ts">

  import { _ } from 'svelte-i18n'
  import type { ToolGroup } from '../../utils/utils'
  import ColorSwitcher from './verticalToolBar/ColorSwitcher.svelte'
  let { __flex = 'col', __toolGroups = [] }: { __flex?: 'col' | 'row', __toolGroups?: ToolGroup[] } = $props()

</script>

<!-- <aside class="flex flex-{__flex} items-center p-y-2 flex-shrink-0"> -->
  <!-- <aside class="flex flex-{__flex} items-stretch p-y-2 flex-shrink-0  h-screen"> -->
  <aside class="flex flex-{__flex} items-center p-y-2 flex-shrink-0 gap-2">
  <!-- <div class="flex-grow overflow-y-auto"> -->

  {#each __toolGroups as toolGroup}
    {#each toolGroup.items as tool}
      <button class="flex items-center justify-center mb-1" title={tool.label}>
        <!-- <i class="ph-light {tool.icon}"></i> -->
        <!-- <iconify-icon icon="theme-workflow:{tool.icon}"></iconify-icon> -->
        <!-- <iconify-icon icon="theme-workflow:select"></iconify-icon> -->

        <svelte:component
          this={tool.body.component}
          __disabled={tool.disabled}
          {...tool.body.props}
        >
          <svelte:fragment slot="icon">{@html tool.body.props.__icon}</svelte:fragment>
          <svelte:fragment slot="label">
            {@html tool.body.props.__label}
          </svelte:fragment>
        </svelte:component>
      </button>
    {/each}
  {/each}
    <!-- </div> -->

  <!-- <div class="flex flex-col items-center mt-auto p-y-2">
    <div class="w-6 h-6 bg-black border-2 border-gray-200 shadow-md"></div>
    <div class="w-6 h-6 bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] border-2 border-gray-800 -mt-2 shadow-md"></div>
    <button class="i-carbon-switcher text-gray-400 w-5 h-5 mt-2 hover:text-base-content"></button>
  </div> -->

  <!-- <div class="flex flex-col h-full bg-base-200 border-r bg-base-400">
    <div class="mt-auto pb-4 flex flex-col items-center gap-4">
      <div class="w-[35px] h-[15px] bg-[#444]"></div>

      <ColorSwitcher />
    </div>
  </div> -->
</aside>

<!-- <aside class="flex flex-col items-stretch p-y-2 flex-shrink-0 w-12 h-screen bg-base-200 border-r bg-base-400">
  
  <div class="flex-1 overflow-y-auto">
    {#each __toolGroups as toolGroup}
      <div class="flex flex-col w-full">
        {#each toolGroup.items as tool}
          <button class="flex items-center justify-center w-full p-y-2 hover:bg-[#444] transition-colors">
            </button>
        {/each}
        <div class="h-[1px] w-full bg-base-100 m-y-1"></div>
      </div>
    {/each}
  </div>

  <div class="mt-auto flex flex-col items-center gap-4 p-b-4">
    <div class="w-8 h-[1px] bg-[#444]"></div>
    <ColorSwitcher />
    
    <button class="i-theme-workflow:settings text-[#ccc] hover:text-base-content w-5 h-5"></button>
  </div>

</aside> -->

<!-- </div> -->
<style>
  /* Styling the Web Component */
  iconify-icon {
    font-size: 18px; /* Control icon size via font-size */
  }
</style>
