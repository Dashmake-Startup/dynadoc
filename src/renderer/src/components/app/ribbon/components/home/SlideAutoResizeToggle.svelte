<script lang="ts">
  import { _$_canvasCommands } from '../../../../../stores/canvas.store'
  import { _ } from 'svelte-i18n'
  import { _$_wysiwygEditorsList } from '../../../../../stores/editor.store'
  import type { CanvasCommands } from '../../../../../commands/canvasCommands.types'

  const activeNodeviewStore = _$_wysiwygEditorsList.getActiveNodeviewOfActiveEditorStore?.()
  let _activeNodeview = $derived(activeNodeviewStore ? $activeNodeviewStore : null)
  let _commands = $state<CanvasCommands | null>(null)

  $effect(() => {
    const id = _activeNodeview?.id
    if (!id) {
      _commands = null
      return
    }
    const store = _$_canvasCommands.subscribeById(id)
    const unsubscribe = store.subscribe((value) => {
      _commands = value ?? null
    })
    return () => unsubscribe()
  })

  const enabled = $derived(_commands?.isAutoResizeEnabled?.() ?? false)

  function toggle() {
    if (!_commands) return
    _commands.toggleAutoResizeEnabled()
  }
</script>

<button
  class="flex items-center gap-2 px-2 py-1.5 rounded-md border border-white/10 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] transition"
  onclick={toggle}
  disabled={!_commands}
>
  <span class="i-carbon-fit-to-height w-4 h-4"></span>
  <span class="text-[11px]">{$_('Auto Resize')}</span>
  <span
    class="ml-1 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border border-white/10"
    class:bg-primary={enabled}
    class:text-base-content={enabled}
  >
    {enabled ? $_('On') : $_('Off')}
  </span>
</button>
