<script lang="ts">
  import { _ } from 'svelte-i18n'
  import SettingRow from '../controls/SettingRow.svelte'
  import ToggleSwitch from '../controls/ToggleSwitch.svelte'
  import SelectField from '../controls/SelectField.svelte'

  let theme = 'Midnight Glass'
</script>

<section>
  <h3>{$_('Theme')}</h3>
  <SettingRow
    title={$_('Application theme')}
    description={$_('Choose a visual style for the entire workspace.')}
  >
    <SelectField bind:value={theme} options={[
      $_('Midnight Glass'),
      $_('Paper Studio'),
      $_('Carbon Tech'),
      $_('High Contrast'),
      $_('Solarized Night')
    ]} />
  </SettingRow>
  <SettingRow
    title={$_('Accent intensity')}
    description={$_('Controls vibrancy on active tabs and buttons.')}
  >
    <SelectField value={$_('Balanced')} options={[ $_('Subtle'), $_('Balanced'), $_('Vibrant') ]} />
  </SettingRow>
</section>

<section>
  <h3>{$_('Interface')}</h3>
  <SettingRow title={$_('Compact spacing')} description={$_('Reduce padding in toolbars and panels.')}>
    <ToggleSwitch />
  </SettingRow>
  <SettingRow title={$_('Motion')} description={$_('Enable subtle motion in transitions and focus states.')}>
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow title={$_('Noise texture')} description={$_('Adds a soft grain to reduce banding on gradients.')}>
    <ToggleSwitch checked />
  </SettingRow>
</section>

<section>
  <h3>{$_('Canvas')}</h3>
  <SettingRow
    title={$_('Editor background')}
    description={$_('Sets the workspace background behind pages.')}
  >
    <SelectField value={$_('Deep slate')} options={[ $_('Deep slate'), $_('Warm gray'), $_('Pure white'), $_('Night blue') ]} />
  </SettingRow>
  <SettingRow title={$_('Document shadow')} description={$_('Soft shadow around pages in edit mode.')}>
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
