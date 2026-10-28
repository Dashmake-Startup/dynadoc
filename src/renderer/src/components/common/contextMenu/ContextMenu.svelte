<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy, mount, unmount } from 'svelte'
  import tippy, { type Instance as TippyInstance, type Placement as TippyPlacement } from 'tippy.js'
  import 'tippy.js/dist/tippy.css'
  import 'tippy.js/animations/shift-away.css'

  let {
    __component = null,
    __props = {},
    __trigger = 'click',
    __placement = 'bottom', // Default to bottom for Command Center
    __offset = [0, 12], // Space between pill and palette
    __interactive = true,
    __delay = [120, 0],
    __disabled = false
  } = $props<{
    __component?: any
    __props?: any
    __trigger?: string
    __placement?: TippyPlacement
    __offset?: [number, number]
    __interactive?: boolean
    __delay?: [number, number]
    __disabled?: boolean
  }>()

  let container = $state<HTMLElement | null>(null)
  let tooltipDiv = $state<HTMLElement | null>(null)
  let tippyInstance: TippyInstance | null = null
  let tooltipComponent: any = null

  const mountTooltip = () => {
    if (!tooltipDiv) return
    if (tooltipComponent) {
      unmount(tooltipComponent)
      tooltipComponent = null
    }
    if (__component) {
      tooltipComponent = mount(__component, {
        target: tooltipDiv,
        props: { ...__props, __closeContextMenu: close }
      })
    }
  }

  onMount(() => {
    if (!container || !tooltipDiv) return

    mountTooltip()

    tippyInstance = tippy(container, {
      content: tooltipDiv,
      allowHTML: true,
      interactive: __interactive,
      trigger: __trigger,
      placement: __placement,
      offset: __offset,
      delay: __delay,
      appendTo: () => document.body,
      animation: 'shift-away',

      // 🟢 INNOVATIVE: Full-width Strategy
      // This allows the Command Palette to be wider than the Search Pill
      maxWidth: 'none',

      popperOptions: {
        modifiers: [
          {
            name: 'preventOverflow',
            options: { boundary: 'viewport', padding: 20 }
          },
          {
            name: 'flip',
            options: { fallbackPlacements: [] } // We want it strictly at the top/bottom
          }
        ]
      },

      onShow(instance) {
        mountTooltip()
        document.body.classList.add('command-center-active')
      },
      onHidden(instance) {
        document.body.classList.remove('command-center-active')
      }
    })
  })

  onDestroy(() => {
    if (tooltipComponent) unmount(tooltipComponent)
    tippyInstance?.destroy()
  })

  $effect(() => {
    if (!tippyInstance) return
    tippyInstance.setProps({
      trigger: __trigger,
      placement: __placement,
      offset: __offset,
      interactive: __interactive,
      delay: __delay
    })
    if (__disabled) {
      tippyInstance.hide()
      tippyInstance.disable()
    } else {
      tippyInstance.enable()
    }
  })

  $effect(() => {
    if (!tooltipDiv) return
    if (!__component) return
    mountTooltip()
  })

  /** Close this menu from a bound component reference or its content slot. */
  export function close() {
    tippyInstance?.hide()
  }

  /** @deprecated Prefer `close()` for new callers. */
  export function hide() {
    close()
  }

  export function show() {
    tippyInstance?.show()
  }
</script>

<!-- <span bind:this={container} class="w-full transition-transform active:scale-[0.98]"> -->
<!-- <span
  bind:this={container}
  class="inline-flex items-center cursor-pointer transition-transform active:scale-95"
> -->
<span bind:this={container} class="">
  <slot />
</span>
<div class="hidden">
  <!-- <div bind:this={tooltipDiv} class="command-palette-hud"> -->
  <div bind:this={tooltipDiv} class="">
    {#if !__component}
      <!--
        Consumers opt into closing on an item-by-item basis:
        <svelte:fragment slot="content" let:closeContextMenu>
          <button onclick={() => { action(); closeContextMenu() }}>…</button>
        </svelte:fragment>

        Component content receives the same callback as the
        `__closeContextMenu` prop.
      -->
      <slot name="content" closeContextMenu={close} />
    {/if}
  </div>
</div>

<style lang="postcss">
  /* 🟢 INNOVATIVE: The "Floating Glass" Container */
  :global(.tippy-box) {
    background-color: transparent !important;
    box-shadow: none !important;
  }

  :global(.tippy-content) {
    padding: 0 !important;
  }

  :global(.tippy-arrow) {
    color: var(--bg-[var(--color-base-300)]) !important;
  }

  .command-palette-hud {
    background: rgba(30, 30, 30, 0.85);
    backdrop-filter: blur(40px) saturate(150%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    box-shadow:
      0 30px 60px -12px rgba(0, 0, 0, 0.5),
      0 18px 36px -18px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  /* Dim background for total focus */
  :global(body.command-center-active) {
    --bg-dim: rgba(0, 0, 0, 0.3);
  }
</style>
