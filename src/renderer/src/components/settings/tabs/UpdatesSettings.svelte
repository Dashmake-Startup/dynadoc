<script lang="ts">
  import { _ } from 'svelte-i18n'
  import SettingRow from '../controls/SettingRow.svelte'
  import ToggleSwitch from '../controls/ToggleSwitch.svelte'
  import SelectField from '../controls/SelectField.svelte'
</script>

<section>
  <h3>{$_('Updates')}</h3>
  <SettingRow title={$_('Automatic updates')} description={$_('Download and install updates in the background.')}>
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow title={$_('Update channel')} description={$_('Choose stability vs. new features.')}>
    <SelectField value={$_('Stable')} options={[ $_('Stable'), $_('Beta'), $_('Canary') ]} />
  </SettingRow>
</section>

<section>
  <h3>{$_('Release Notes')}</h3>
  <SettingRow title={$_('Show release notes')} description={$_('Open release notes after updates.')}>
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow title={$_('Maintenance window')} description={$_('Preferred time for background updates.')}>
    <SelectField value="02:00 AM" options={['02:00 AM', '05:00 AM', '09:00 PM', $_('Manual only')]} />
  </SettingRow>
</section>

<section>
  <h3>{$_('Compliance')}</h3>
  <SettingRow title={$_('Signed builds only')} description={$_('Allow updates signed by Dynadoc.')}>
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
