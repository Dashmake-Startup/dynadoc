<script lang="ts">
  import { _ } from 'svelte-i18n'
  import SettingRow from '../controls/SettingRow.svelte'
  import ToggleSwitch from '../controls/ToggleSwitch.svelte'
  import Utils from '../../../utils/Utils'
  import SelectField from '../controls/SelectField.svelte'
</script>

<section>
  <h3>{$_('Auto Save')}</h3>
  <SettingRow title={$_('Auto-save')} description={$_('Continuously save edits to avoid data loss.')}>
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow title={$_('Auto-save interval')} description={$_('How frequently changes are committed.')}>
    <SelectField
      value={$_('10 seconds')}
      options={[ $_('5 seconds'), $_('10 seconds'), $_('30 seconds'), $_('1 minute') ]}
    />
  </SettingRow>
  <SettingRow
    title={$_('Version snapshots')}
    description={$_('Create automatic restore points in the background.')}
  >
    <ToggleSwitch checked />
  </SettingRow>
</section>

<section>
  <h3>{$_('File Handling')}</h3>
  <SettingRow title={$_('Default format')} description={$_('Choose the file format for new documents.')}>
    <SelectField value={Utils.DYNADOC_EXTENSIONS.default} options={[Utils.DYNADOC_EXTENSIONS.default, Utils.OFFICE_EXTENSIONS.word, Utils.PDF_EXTENSION, '.md']} />
  </SettingRow>
  <SettingRow
    title={$_('Backup copies')}
    description={$_('Keep a rolling backup of the last 5 versions.')}
  >
    <ToggleSwitch checked />
  </SettingRow>
</section>

<section>
  <h3>{$_('Cloud Sync')}</h3>
  <SettingRow
    title={$_('Sync in background')}
    description={$_('Continue syncing even when the app is idle.')}
  >
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow title={$_('Network priority')} description={$_('Tune bandwidth for large asset uploads.')}>
    <SelectField value={$_('Balanced')} options={[ $_('Low'), $_('Balanced'), $_('High') ]} />
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
