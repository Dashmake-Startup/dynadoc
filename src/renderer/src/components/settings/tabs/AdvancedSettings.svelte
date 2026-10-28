<script lang="ts">
  import { _ } from 'svelte-i18n'
  import SettingRow from '../controls/SettingRow.svelte'
  import ToggleSwitch from '../controls/ToggleSwitch.svelte'
  import SelectField from '../controls/SelectField.svelte'
</script>

<section>
  <h3>{$_('Performance')}</h3>
  <SettingRow
    title={$_('MRU hot tabs')}
    description={$_('Keep the top 3 most recent documents alive for instant switching.')}
  >
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow
    title={$_('Background rendering')}
    description={$_('Reduce CPU usage when editors are inactive.')}
  >
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow
    title={$_('GPU acceleration')}
    description={$_('Use GPU for canvas and effects rendering.')}
  >
    <ToggleSwitch checked />
  </SettingRow>
</section>

<section>
  <h3>{$_('Developer')}</h3>
  <SettingRow
    title={$_('Diagnostics overlay')}
    description={$_('Show live memory, CPU, and sync status.')}
  >
    <ToggleSwitch />
  </SettingRow>
  <SettingRow title={$_('Logging level')} description={$_('Verbose logs for debugging.')}>
    <SelectField
      value={$_('Normal')}
      options={[ $_('Silent'), $_('Normal'), $_('Verbose'), $_('Trace') ]}
    />
  </SettingRow>
</section>

<section>
  <h3>{$_('Experimental')}</h3>
  <SettingRow
    title={$_('AI command bar')}
    description={$_('Enable the command center for AI-driven tasks.')}
  >
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow
    title={$_('Realtime co-authoring')}
    description={$_('Enable collaborative editing in shared sessions.')}
  >
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
