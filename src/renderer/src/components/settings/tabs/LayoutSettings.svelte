<script lang="ts">
  import { _ } from 'svelte-i18n'
  import SettingRow from '../controls/SettingRow.svelte'
  import ToggleSwitch from '../controls/ToggleSwitch.svelte'
  import SelectField from '../controls/SelectField.svelte'

  let defaultGrid = '8px'
</script>

<section>
  <h3>{$_('Canvas & Guides')}</h3>
  <SettingRow title={$_('Snap to grid')} description={$_('Align objects to a modular grid.')}>
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow title={$_('Grid size')} description={$_('Sets the base spacing for snapping.')}>
    <SelectField bind:value={defaultGrid} options={[ $_('4px'), $_('8px'), $_('12px'), $_('16px'), $_('24px') ]} />
  </SettingRow>
  <SettingRow title={$_('Smart guides')} description={$_('Show dynamic alignment guides while dragging.')}>
    <ToggleSwitch checked />
  </SettingRow>
</section>

<section>
  <h3>{$_('Panels')}</h3>
  <SettingRow
    title={$_('Auto-hide inspector')}
    description={$_('Collapse inspector when canvas is in focus mode.')}
  >
    <ToggleSwitch />
  </SettingRow>
  <SettingRow title={$_('Sticky toolbars')} description={$_('Keep top toolbars visible during scroll.')}>
    <ToggleSwitch checked />
  </SettingRow>
</section>

<section>
  <h3>{$_('Multi-Page Layout')}</h3>
  <SettingRow title={$_('Continuous pages')} description={$_('Show continuous flow instead of page-by-page.')}>
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow title={$_('Page gap')} description={$_('Space between pages in editing mode.')}>
    <SelectField value={$_('Medium')} options={[ $_('Compact'), $_('Medium'), $_('Large') ]} />
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
