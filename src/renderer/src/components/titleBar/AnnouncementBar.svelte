<script lang="ts">
  import { fa } from '@faker-js/faker'
  import { onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { get } from 'svelte/store'
  import EditorCommonUtils from '../../utils/common.utils'

  const t = get(_)
  const STORAGE_KEY = 'dynadoc.ui.announcement.devBanner.dismissed.v1'

  // export let dense = false
  interface Props {
    dense?: boolean
  }

  // Use $props() with destructuring and default values
  let {
    dense = $bindable(false) // Use $bindable if the parent needs to sync this state
  }: Props = $props()

  let dismissed = $state(false)

  onMount(() => {
    try {
      // dismissed = localStorage.getItem(STORAGE_KEY) === 'true'
      dismissed = false // Always show the announcement bar for now, as dynadoc is in early preview stage. We can enable the dismissal feature later when we have more stable releases.
    } catch {
      dismissed = false
    }
  })

  function dismiss() {
    dismissed = true
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // ignore
    }
  }

  const title = t('dynadoc is under active development')
  const message = t(
    'Some features may not work as expected yet. We’re sorry about that — thank you for your patience.'
  )
</script>

{#if !dismissed}
  <div class="ddoc-announcement-bar" class:dense role="status" aria-label={title}>
    <div class="ddoc-announcement-inner">
      <div class="ddoc-announcement-left">
        <span class="ddoc-pill">{t('Preview version')}</span>
        <span class="ddoc-text">
          <strong class="ddoc-title">{title}.</strong>
          <span class="ddoc-msg">{message}</span>
          <span class="ddoc-msg underline text-base-300" onclick={() => EditorCommonUtils.openRepo()}>
            {t('Contribute on GitHub')}
          </span>
        </span>
      </div>

      <div class="ddoc-announcement-actions">
        <button class="ddoc-btn" type="button" onclick={dismiss} aria-label={t('Dismiss')}>
          <i class="ph-light ph-x"></i>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .ddoc-announcement-bar {
    height: 28px;
    -webkit-app-region: drag;
    user-select: none;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--color-primary) 20%, transparent),
      color-mix(in srgb, var(--color-base-200) 92%, rgba(255, 255, 255, 0.04))
    );
    border-bottom: 1px solid color-mix(in srgb, var(--color-base-content) 10%, transparent);
    display: flex;
    align-items: center;
    padding: 0 10px;
  }

  .ddoc-announcement-bar.dense {
    height: 24px;
  }

  .ddoc-announcement-inner {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .ddoc-announcement-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .ddoc-pill {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-primary) 24%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-primary) 38%, transparent);
    color: color-mix(in srgb, var(--color-base-content) 92%, var(--color-primary));
    flex: 0 0 auto;
  }

  .ddoc-text {
    font-size: 11px;
    color: color-mix(in srgb, var(--color-base-content) 82%, transparent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ddoc-title {
    color: color-mix(in srgb, var(--color-base-content) 95%, transparent);
    font-weight: 700;
  }

  .ddoc-msg {
    margin-left: 4px;
  }

  .ddoc-announcement-actions {
    -webkit-app-region: no-drag;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ddoc-btn {
    -webkit-app-region: no-drag;
    width: 26px;
    height: 22px;
    border-radius: 6px;
    border: 1px solid color-mix(in srgb, var(--color-base-content) 12%, transparent);
    background: color-mix(in srgb, var(--color-base-content) 6%, transparent);
    color: color-mix(in srgb, var(--color-base-content) 80%, transparent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: 120ms ease;
  }

  .ddoc-btn:hover {
    background: color-mix(in srgb, var(--color-base-content) 12%, transparent);
    border-color: color-mix(in srgb, var(--color-base-content) 18%, transparent);
    color: color-mix(in srgb, var(--color-base-content) 92%, transparent);
  }
</style>
