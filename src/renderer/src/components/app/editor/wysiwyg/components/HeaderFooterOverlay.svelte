<script lang="ts">
  import { _ } from 'svelte-i18n'
  interface Props {
    show: boolean
    title: string
    hint?: string
    position: { top: number; left: number; width: number; height: number }
    onClose: () => void
  }

  let { show, title, hint, position, onClose }: Props = $props()
  // let contentEl = $bindable<HTMLDivElement | null>(null)
</script>

{#if show}
  <div
    class="header-footer-overlay"
    style="top:{position.top}px; left:{position.left}px; width:{position.width}px;"
  >
    <div class="header-footer-overlay-toolbar">
      <div class="header-footer-overlay-title">
        {title}
        {#if hint}
          <span class="header-footer-overlay-hint">{hint}</span>
        {/if}
      </div>
      <button class="header-footer-overlay-close" onclick={onClose} aria-label={$_('Close')}>
        {$_('Done')}
      </button>
    </div>
    <div
      class="header-footer-overlay-content"
      style="min-height:{position.height}px;"
      bind:this={contentEl}
    ></div>
  </div>
{/if}

<style>
  .header-footer-overlay {
    position: absolute;
    z-index: 60;
    pointer-events: auto;
  }

  .header-footer-overlay-toolbar {
    position: absolute;
    right: 0;
    top: -18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .header-footer-overlay-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.6);
  }

  .header-footer-overlay-hint {
    font-size: 8px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(0, 190, 172, 0.6);
  }

  .header-footer-overlay-content {
    min-height: 32px;
    pointer-events: auto;
  }

  :global(.header-footer-overlay-content .ProseMirror) {
    min-height: inherit;
    outline: none;
    padding: 0;
  }

  .header-footer-overlay-close {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid rgba(0, 190, 172, 0.4);
    background: transparent;
    color: #8ff0e6;
  }
</style>
