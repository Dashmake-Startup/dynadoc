<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { get } from 'svelte/store'
  import ContextMenu from '../contextMenu/ContextMenu.svelte'

  let {
    title = '',
    icon = 'ph-info',
    maxWidth = 360
  } = $props<{
    title?: string
    icon?: string
    maxWidth?: number
  }>()

  const t = get(_)
</script>

<ContextMenu __trigger="click" __placement="bottom-end" __offset={[0, 10]} __interactive={true}>
  <span class="ddoc-info-root">
    <button
      class="ddoc-info-btn"
      type="button"
      aria-label={title ? `${t('What is this?')} ${title}` : t('What is this?')}
      title={t('What is this?')}
    >
      <i class="ph-light {icon}"></i>
    </button>
  </span>

  <div slot="content" class="ddoc-info-pop" style={`max-width: ${maxWidth}px;`}>
    {#if title}
      <div class="ddoc-info-title">{title}</div>
    {/if}
    <div class="ddoc-info-body">
      <slot />
    </div>
  </div>
</ContextMenu>

<style>
  .ddoc-info-root {
    display: inline-flex;
    align-items: center;
  }

  .ddoc-info-btn {
    width: 22px;
    height: 22px;
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--color-base-content) 12%, transparent);
    background: color-mix(in srgb, var(--color-base-content) 6%, transparent);
    color: color-mix(in srgb, var(--color-base-content) 65%, transparent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: 120ms ease;
  }

  .ddoc-info-btn:hover {
    background: color-mix(in srgb, var(--color-base-content) 12%, transparent);
    border-color: color-mix(in srgb, var(--color-base-content) 18%, transparent);
    color: color-mix(in srgb, var(--color-base-content) 92%, transparent);
  }

  .ddoc-info-pop {
    border-radius: 12px;
    border: 1px solid color-mix(in srgb, var(--color-base-content) 12%, transparent);
    background: color-mix(in srgb, var(--color-base-200) 92%, rgba(10, 10, 10, 0.2));
    box-shadow: 0 18px 50px -18px rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(18px);
    padding: 10px;
  }

  .ddoc-info-title {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--color-base-content) 80%, transparent);
    margin-bottom: 6px;
  }

  .ddoc-info-body {
    font-size: 11px;
    line-height: 1.35;
    color: color-mix(in srgb, var(--color-base-content) 70%, transparent);
  }

  .ddoc-info-body :global(code) {
    font-size: 10px;
    padding: 1px 4px;
    border-radius: 6px;
    border: 1px solid color-mix(in srgb, var(--color-base-content) 10%, transparent);
    background: color-mix(in srgb, var(--color-base-content) 6%, transparent);
  }

  .ddoc-info-body :global(ul) {
    margin: 6px 0 0;
    padding-left: 16px;
  }

  .ddoc-info-body :global(li) {
    margin: 2px 0;
  }
</style>
