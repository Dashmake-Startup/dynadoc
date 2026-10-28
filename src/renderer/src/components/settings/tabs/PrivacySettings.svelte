<script lang="ts">
  import { _ } from 'svelte-i18n'
  import SettingRow from '../controls/SettingRow.svelte'
  import ToggleSwitch from '../controls/ToggleSwitch.svelte'
  import SelectField from '../controls/SelectField.svelte'
</script>

<section>
  <h3>{$_('Data')}</h3>
  <SettingRow
    title={$_('Diagnostics')}
    description={$_('Send anonymous usage statistics to improve Dynadoc.')}
  >
    <ToggleSwitch />
  </SettingRow>
  <SettingRow title={$_('Crash reports')} description={$_('Automatically send crash reports.')}>
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow
    title={$_('Content analytics')}
    description={$_('Analyze document structure for insights (local only).')}
  >
    <ToggleSwitch checked />
  </SettingRow>
</section>

<section>
  <h3>{$_('Security')}</h3>
  <SettingRow
    title={$_('Require biometric unlock')}
    description={$_('Lock protected documents behind device authentication.')}
  >
    <ToggleSwitch />
  </SettingRow>
  <SettingRow title={$_('Auto-lock')} description={$_('Time before secure documents lock when idle.')}>
    <SelectField
      value={$_('10 minutes')}
      options={[ $_('2 minutes'), $_('5 minutes'), $_('10 minutes'), $_('30 minutes') ]}
    />
  </SettingRow>
</section>

<section>
  <h3>{$_('Sharing')}</h3>
  <SettingRow title={$_('Default link access')} description={$_('Access level for newly shared links.')}>
    <SelectField
      value={$_('Only invited')}
      options={[ $_('Only invited'), $_('Anyone with link'), $_('Organization') ]}
    />
  </SettingRow>
  <SettingRow title={$_('Watermark exports')} description={$_('Add watermark to shared PDFs.')}>
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
</style>
