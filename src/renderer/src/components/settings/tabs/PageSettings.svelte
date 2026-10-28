<script lang="ts">
  import { _ } from 'svelte-i18n'
  import SettingRow from '../controls/SettingRow.svelte'
  import SelectField from '../controls/SelectField.svelte'
  import ToggleSwitch from '../controls/ToggleSwitch.svelte'

  let marginPreset = 'Normal'
</script>

<section>
  <h3>{$_('Page Setup')}</h3>
  <SettingRow title={$_('Default orientation')} description={$_('Applies to new pages and exports.')}>
    <SelectField options={[ $_('Portrait'), $_('Landscape') ]} value={$_('Portrait')} />
  </SettingRow>
  <SettingRow title={$_('Margins')} description={$_('Preset margins for new pages.')}>
    <SelectField
      bind:value={marginPreset}
      options={[ $_('Normal'), $_('Narrow'), $_('Wide'), $_('Mirror'), $_('Custom') ]}
    />
  </SettingRow>
  <SettingRow
    title={$_('Headers & Footers')}
    description={$_('Show headers and footers in editing view.')}
  >
    <ToggleSwitch checked />
  </SettingRow>
</section>

<section>
  <h3>{$_('Pagination')}</h3>
  <SettingRow title={$_('Page numbers')} description={$_('Display page numbers in the footer.')}>
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow
    title={$_('Section breaks')}
    description={$_('Auto-insert section breaks between slides/pages.')}
  >
    <ToggleSwitch />
  </SettingRow>
</section>

<section>
  <h3>{$_('Print & Export')}</h3>
  <SettingRow title={$_('Bleed')} description={$_('Add 3mm bleed for print-ready exports.')}>
    <ToggleSwitch />
  </SettingRow>
  <SettingRow
    title={$_('Print background')}
    description={$_('Include background colors and images in print.')}
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
