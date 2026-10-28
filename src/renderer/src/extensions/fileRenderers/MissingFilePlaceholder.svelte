<script lang="ts">
  import { _ } from 'svelte-i18n'

  interface Props {
    __title?: string
    __path?: string
    __subtitle?: string
  }

  let { __title = $_('File not found'), __path = '', __subtitle = '' }: Props = $props()
</script>

<div class="missing-file-card">
  <div class="missing-file-icon">
    <i class="ph-bold ph-warning-circle"></i>
  </div>
  <div class="missing-file-body">
    <div class="missing-file-title">{__title}</div>
    {#if __subtitle}
      <div class="missing-file-subtitle">{__subtitle}</div>
    {/if}
    {#if __path}
      <div class="missing-file-path" title={__path}>{__path}</div>
    {/if}
  </div>
</div>

<style>
  .missing-file-card {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: linear-gradient(135deg, rgba(30, 30, 30, 0.9), rgba(16, 16, 16, 0.9));
    color: rgba(255, 255, 255, 0.7);
    box-shadow: 0 18px 40px -28px rgba(0, 0, 0, 0.6);
  }
  .missing-file-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(255, 99, 99, 0.12);
    border: 1px solid rgba(255, 99, 99, 0.28);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ff7b7b;
  }
  .missing-file-title {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
  }
  .missing-file-subtitle {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 2px;
  }
  .missing-file-path {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.35);
    margin-top: 6px;
    word-break: break-all;
  }
</style>
