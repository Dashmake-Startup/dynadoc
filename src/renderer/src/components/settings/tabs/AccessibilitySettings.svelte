<script lang="ts">
  import { _ } from 'svelte-i18n'
  import SettingRow from '../controls/SettingRow.svelte'
  import ToggleSwitch from '../controls/ToggleSwitch.svelte'
  import SelectField from '../controls/SelectField.svelte'
</script>

<section>
  <h3>{$_('Visibility')}</h3>
  <SettingRow title={$_('High contrast')} description={$_('Increase contrast for UI elements and text.')}>
    <ToggleSwitch />
  </SettingRow>
  <SettingRow title={$_('Larger UI')} description={$_('Scale interface controls and text.')}>
    <SelectField value={$_('100%')} options={[ $_('90%'), $_('100%'), $_('110%'), $_('125%'), $_('150%') ]} />
  </SettingRow>
</section>

<section>
  <h3>{$_('Navigation')}</h3>
  <SettingRow
    title={$_('Keyboard focus')}
    description={$_('Show bold focus outlines when navigating with keyboard.')}
  >
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow title={$_('Reduced motion')} description={$_('Disable motion in panels and transitions.')}>
    <ToggleSwitch />
  </SettingRow>
</section>

<section>
  <h3>{$_('Assistive')}</h3>
  <SettingRow title={$_('Screen reader hints')} description={$_('Announce toolbar and section context.')}>
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow title={$_('Live captions')} description={$_('Enable captions during voice dictation.')}>
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
