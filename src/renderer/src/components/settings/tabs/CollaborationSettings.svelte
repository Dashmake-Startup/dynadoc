<script lang="ts">
  import { _ } from 'svelte-i18n'
  import SettingRow from '../controls/SettingRow.svelte'
  import ToggleSwitch from '../controls/ToggleSwitch.svelte'
  import SelectField from '../controls/SelectField.svelte'
</script>

<section>
  <h3>{$_('Live Collaboration')}</h3>
  <SettingRow
    title={$_('Presence indicators')}
    description={$_('Show avatars and cursors for collaborators.')}
  >
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow
    title={$_('Change highlights')}
    description={$_('Highlight edits from collaborators.')}
  >
    <ToggleSwitch checked />
  </SettingRow>
  <SettingRow title={$_('Conflict strategy')} description={$_('How to resolve edit conflicts.')}>
    <SelectField
      value={$_('Merge automatically')}
      options={[ $_('Merge automatically'), $_('Ask me'), $_('Keep mine') ]}
    />
  </SettingRow>
</section>

<section>
  <h3>{$_('Meeting Mode')}</h3>
  <SettingRow
    title={$_('Presenter mode')}
    description={$_('Enable presenter tools in shared sessions.')}
  >
    <ToggleSwitch />
  </SettingRow>
  <SettingRow title={$_('Live comments')} description={$_('Allow comments during presentations.')}>
    <ToggleSwitch checked />
  </SettingRow>
</section>

<section>
  <h3>{$_('Team Defaults')}</h3>
  <SettingRow title={$_('Default access')} description={$_('Permission for new collaborators.')}>
    <SelectField value={$_('Can comment')} options={[ $_('Can comment'), $_('Can edit'), $_('Owner only') ]} />
  </SettingRow>
  <SettingRow
    title={$_('Auto-share insights')}
    description={$_('Share document health stats with admins.')}
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
