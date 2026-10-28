<script lang="ts">
  import { _ } from 'svelte-i18n'
  import SettingRow from '../controls/SettingRow.svelte'
  import ToggleSwitch from '../controls/ToggleSwitch.svelte'
  import SelectField from '../controls/SelectField.svelte'
</script>

<section>
  <h3>{$_('Writing Assistance')}</h3>
  <SettingRow title={$_('Spell check')} description={$_('Underline potential spelling issues in documents.')}>
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow title={$_('Grammar suggestions')} description={$_('Flag grammar and clarity opportunities.')}>
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow title={$_('Writing tone')} description={$_('Choose the voice for suggestions.')}>
    <SelectField value={$_('Professional')} options={[ $_('Professional'), $_('Casual'), $_('Academic'), $_('Technical') ]} />
  </SettingRow>
</section>

<section>
  <h3>{$_('Auto-correction')}</h3>
  <SettingRow title={$_('Auto-capitalize')} description={$_('Capitalize the first letter of sentences.')}>
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow title={$_('Smart quotes')} description={$_('Convert straight quotes to smart quotes.')}>
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow title={$_('Formatting patterns')} description={$_('Auto format lists, headers, and tables.')}>
    <ToggleSwitch />
  </SettingRow>
</section>

<section>
  <h3>{$_('Dictionary')}</h3>
  <SettingRow title={$_('Custom dictionary')} description={$_('Sync custom terms across your devices.')}>
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow title={$_('Primary language')} description={$_('Used for proofing rules.')}>
    <SelectField value={$_('English (US)')} options={[ $_('English (US)'), $_('English (UK)'), $_('Français'), $_('Deutsch') ]} />
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
