<script lang="ts">
  import { _ as base_ } from 'svelte-i18n'
  import { get } from 'svelte/store'
  import { GenericFormatingEditorCommands } from '../../../../common/actions/formatting/commands/GenericFormatingEditorCommands.svelte'

  // const _ = (key: string) => key
  const _ = (key: string) => get(base_)(key)

</script>

<div class="flex items-center gap-2">
  <button
    class="px-2 py-1.5 rounded-md border border-white/10 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-[11px]"
    onclick={() => GenericFormatingEditorCommands.slidePresetTitle()}
  >
    {_['Title']}
  </button>
  <button
    class="px-2 py-1.5 rounded-md border border-white/10 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-[11px]"
    onclick={() => GenericFormatingEditorCommands.slidePresetSubtitle()}
  >
    {_['Subtitle']}
  </button>
  <button
    class="px-2 py-1.5 rounded-md border border-white/10 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-[11px]"
    onclick={() => GenericFormatingEditorCommands.slidePresetBody()}
  >
    {_['Body']}
  </button>
</div>
