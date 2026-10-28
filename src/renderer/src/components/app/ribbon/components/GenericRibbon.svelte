<script lang="ts">
  import { _ } from 'svelte-i18n'
  import Layout from '../../../common/layout/layout'
  import type { Group, Item } from './utils/utils'
  import RibbonGroupSelect from './RibbonGroupSelect.svelte'
  import { _$_ribbonDisplayPreferences } from '../../../../stores/ribbon.store'

  // --- Svelte 5 Runes: Props ---
  let { compact = false, __groups = [] } = $props<{
    compact?: boolean
    __groups: Group[]
  }>()

  // --- State & Context ---
  // Innovative: Track interaction state to "dim" the labels for focus
  let isInteracting = $state(false)
  let ribbonPreferences = $derived($_$_ribbonDisplayPreferences)
</script>

<div
  class="generic-ribbon w-full h-full flex flex-col select-none overflow-hidden"
  class:hide-group-names={!ribbonPreferences.showGroupNames}
>
  <div
    class="flex items-stretch h-full overflow-x-auto no-scrollbar mask-fade-right px-4"
    onmouseenter={() => (isInteracting = true)}
    onmouseleave={() => (isInteracting = false)}
  >
    {#each __groups as group, index}
      <div
        class="ribbon-category group-container flex flex-col justify-center items-center px-1 min-w-fit"
        class:compact-stage-one={index >= 7}
        class:compact-stage-two={index >= 4}
        class:compact-stage-three={index >= 2}
      >
        <div
          class="group-expanded flex h-full gap-0.5 items-center px-1.5 py-1 rounded-lg transition-colors hover:bg-[color-mix(in_srgb,var(--color-base-white)_3%,transparent)]"
          class:flex-col={group.layout === Layout.LAYOUT.COLUMN}
          class:flex-row={group.layout !== Layout.LAYOUT.COLUMN}
        >
          {#each group.items as item}
            {#if item.body}
              <div class="item-wrapper flex items-center justify-center">
                <svelte:component this={item.body.component} {...item.body.props} {compact} />
              </div>
            {/if}
          {/each}
        </div>

        <div class="group-compact"><RibbonGroupSelect {group} /></div>

        <div
          class="group-label py-1 transition-all duration-300"
          class:opacity-10={isInteracting}
          class:opacity-40={!isInteracting}
        >
          {$_(group.title)}
        </div>
      </div>

      <div class="w-px h-10 my-auto bg-[var(--line2)] mx-1 last:hidden"></div>
    {/each}
  </div>

  <div class="absolute right-4 bottom-1.5 flex items-center gap-2">
    <div
      class="flex items-center gap-1.5 bg-black/20 border border-white/5 px-2 py-0.5 rounded-full hover:border-primary/50 transition-all cursor-text"
    >
      <i class="ph-light ph-sparkle text-primary text-[10px]"></i>
      <span class="text-[9px] font-black uppercase tracking-tighter text-base-content/30"
        >{$_('Ask AI Command...')}</span
      >
      <span class="text-[8px] opacity-10 font-mono">{$_('⌘K')}</span>
    </div>
  </div>
</div>

<style>
  /* CUSTOM SCROLLBAR: Hide it while allowing scrolling for that fluid feel */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  /* Micro-Label Styling */
  .group-label {
    font-size: 8.5px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-family: var(--brand-font-sans);
    white-space: nowrap;
    pointer-events: none;
  }

  /* Ribbon Group Separation Depth */
  .group-container {
    position: relative;
  }

  /* Gradient Masking for Overflow indication */
  .mask-fade-right {
    mask-image: linear-gradient(to right, black 90%, transparent 100%);
  }

  /* Standard Item Transitions */
  .item-wrapper {
    transition: transform 0.1s ease-out;
  }
  .item-wrapper:active {
    transform: scale(0.95);
  }

  .group-compact {
    display: none;
  }

  .hide-group-names .group-label {
    display: none;
  }

  @container (max-width: 1480px) {
    .compact-stage-one .group-expanded,
    .compact-stage-one .group-label {
      display: none;
    }
    .compact-stage-one .group-compact {
      display: block;
    }
  }

  @container (max-width: 1220px) {
    .compact-stage-two .group-expanded,
    .compact-stage-two .group-label {
      display: none;
    }
    .compact-stage-two .group-compact {
      display: block;
    }
  }

  @container (max-width: 960px) {
    .compact-stage-three .group-expanded,
    .compact-stage-three .group-label {
      display: none;
    }
    .compact-stage-three .group-compact {
      display: block;
    }
  }

  @container (max-width: 740px) {
    .ribbon-category .group-expanded,
    .ribbon-category .group-label {
      display: none;
    }
    .ribbon-category .group-compact {
      display: block;
    }
    .group-container {
      padding-left: 0;
      padding-right: 0;
    }
  }
</style>
