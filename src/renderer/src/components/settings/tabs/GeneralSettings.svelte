<script lang="ts">
  import { _ } from 'svelte-i18n'
  import SettingRow from '../controls/SettingRow.svelte'
  import ToggleSwitch from '../controls/ToggleSwitch.svelte'
  import SelectField from '../controls/SelectField.svelte'

  let openOnStartup = true
  let showWelcome = true
  let recentDocs = true
  let language = 'English (US)'
</script>

<section>
  <h3>{$_('Workspace')}</h3>
  <SettingRow
    title={$_('Open last workspace')}
    description={$_('Restore tabs, layouts, and focus from your last session.')}
  >
    <ToggleSwitch bind:checked={openOnStartup} />
  </SettingRow>
  <SettingRow
    title={$_('Welcome screen')}
    description={$_('Show starter templates, tips, and recent activity on launch.')}
  >
    <ToggleSwitch bind:checked={showWelcome} />
  </SettingRow>
  <SettingRow
    title={$_('Recent documents')}
    description={$_('Keep recently opened documents pinned across devices.')}
  >
    <ToggleSwitch bind:checked={recentDocs} />
  </SettingRow>
</section>

<section>
  <h3>{$_('Language & Region')}</h3>
  <SettingRow title={$_('Interface language')} description={$_('Applies after restart.')}>
    <SelectField bind:value={language} options={[
      $_('English (US)'),
      $_('English (UK)'),
      $_('Français'),
      $_('Deutsch'),
      $_('Español'),
      $_('Português'),
      $_('Italiano'),
      $_('日本語'),
      $_('한국어')
    ]} />
  </SettingRow>
  <SettingRow title={$_('Default paper size')} description={$_('Used for new documents and exports.')}>
    <SelectField value={$_('A4')} options={[ $_('A4'), $_('Letter'), $_('Legal'), $_('A3'), $_('Tabloid') ]} />
  </SettingRow>
</section>

<section>
  <h3>{$_('Smart Workspace')}</h3>
  <SettingRow
    title={$_('Focus follow mode')}
    description={$_('Automatically focuses the active editor and dims inactive panels.')}
  >
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow
    title={$_('Smart panel memory')}
    description={$_('Keeps panel visibility per document type (doc, sheet, slide).')}
  >
    <ToggleSwitch checked />
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
</style>
