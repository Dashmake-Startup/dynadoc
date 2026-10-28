<script lang="ts">
  import { _ } from 'svelte-i18n'
  import SettingRow from '../controls/SettingRow.svelte'
  import ToggleSwitch from '../controls/ToggleSwitch.svelte'
</script>

<section>
  <h3>{$_('Keyboard')}</h3>
  <SettingRow title={$_('Command palette')} description={$_('Shortcut for opening the command palette.')}>
    <span class="chip">{$_('⌘K')}</span>
  </SettingRow>
  <SettingRow title={$_('Quick search')} description={$_('Shortcut for global search.')}>
    <span class="chip">{$_('⌘F')}</span>
  </SettingRow>
  <SettingRow title={$_('Toggle focus mode')} description={$_('Shortcut for distraction-free view.')}>
    <span class="chip">{$_('⇧⌘F')}</span>
  </SettingRow>
</section>

<section>
  <h3>{$_('Behavior')}</h3>
  <SettingRow title={$_('Emacs bindings')} description={$_('Use Emacs-style keyboard shortcuts.')}>
    <ToggleSwitch />
  </SettingRow>
  <SettingRow title={$_('Vim bindings')} description={$_('Use Vim-style keyboard shortcuts.')}>
    <ToggleSwitch />
  </SettingRow>
</section>

<style>
  section {
    margin-bottom: 28px;
  }

  h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: #7f7f7f;
    margin-bottom: 12px;
  }

  .chip {
    font-family: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: #d8d8d8;
  }
</style>
