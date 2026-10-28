<script lang="ts">
  import type { Editor } from '@tiptap/core'
  import { _ } from 'svelte-i18n'
  import { GenericFormatingEditorCommands } from '../../../../components/common/actions/formatting/commands/GenericFormatingEditorCommands.svelte'
  import { fluentUIcons } from '../../../../components/common/icons/Icons'

  let { editor, visible } = $props<{
    editor: Editor | null | undefined
    visible: boolean
  }>()

  const safeCmd = async (fn: (() => unknown) | null | undefined) => {
    try {
      editor?.commands?.focus?.()
      await fn?.()
    } catch (e) {
      console.warn('[InteractivePlaceholder] action failed', e)
    }
  }

  const run = (name: keyof typeof GenericFormatingEditorCommands, fallback?: () => unknown) => {
    const fn = (GenericFormatingEditorCommands as any)?.[name]
    if (typeof fn === 'function') return fn()
    return fallback?.()
  }

  const cmdInsertWorksheet = () =>
    run('insertWorksheet' as any, () => run('insertSpreadsheet' as any))

  const actions = [
    {
      icon: 'ph-light ph-sparkle',
      label: 'Ask AI',
      color: 'text-violet-600',
      cmd: () => run('generateTextWithAI' as any)
    },
    {
      icon: 'ph-light ph-brackets-curly',
      label: 'Insert Variable',
      color: 'text-sky-600',
      cmd: () => run('insertVariable' as any)
    },
    {
      icon: 'ph-light ph-table',
      label: 'Insert Worksheet',
      color: 'text-emerald-600',
      cmd: cmdInsertWorksheet
    },
    {
      icon: 'ph-light ph-presentation',
      label: 'Insert Slide',
      color: 'text-amber-600',
      cmd: () => run('insertSlide' as any)
    },
    {
      iconHtml: fluentUIcons.fluentUIconSurvey,
      label: 'Insert Form',
      color: 'text-red-600',
      cmd: () => run('insertSurvey' as any)
    },
    {
      icon: 'ph-light ph-brackets-angle',
      label: 'Code Block',
      color: 'text-slate-600',
      cmd: () => run('insertMonacoCodeBlock' as any)
    }
  ]
</script>

{#if visible}
  <div
    class="editor-placeholder pointer-events-none absolute inset-0 flex items-start px-3 pt-2 select-none"
  >
    <!-- <div
      class="pointer-events-auto flex flex-row gap-2 rounded-xl border border-gray-200/80 bg-[color-mix(in_srgb,var(--color-base-white)_70%,transparent)] backdrop-blur-sm shadow-[0_12px_40px_-30px_rgba(0,0,0,0.6)] p-1"
    > -->
    <div
      class="pointer-events-auto flex flex-row gap-2 rounded-xl border border-gray-200/80 bg-base-100 backdrop-blur-sm shadow-[0_12px_40px_-30px_rgba(0,0,0,0.6)] p-1"
    >
      <!-- <div class="flex items-center gap-2 text-[12px] font-600 text-gray-600">
        <span class="tracking-wide">{$_('Quick start')}</span>
        <span class="text-gray-400">•</span>
        <span class="text-gray-500">{$_('Type / for commands')}</span>
      </div> -->

      <div class="flex items-center gap-2 flex-wrap">
        {#each actions as action (action.label)}
          <!-- <button
            type="button"
            class="flex items-center gap-2 rounded-lg border border-transparent bg-[color-mix(in_srgb,var(--color-base-white)_70%,transparent)] px-2.5 py-1.5 text-[12px] text-gray-700 hover:(bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] shadow-sm border-gray-200) transition"
            on:click={() => safeCmd(action.cmd)}
          > -->
          <button
            type="button"
            class="flex items-center gap-2 rounded-lg border border-transparent bg-base-100 cursor-pointer px-2.5 py-1.5 text-[12px] hover:(bg-base-100 shadow-sm border-gray-200) transition"
            on:click={() => safeCmd(action.cmd)}
          >
            {#if action.iconHtml}
              {@html `<div class="${action.color} w-[16px] max-w-[max-content]">${action.iconHtml}</div>`}
            {:else if action.icon}
              <i class={`${action.icon} ${action.color} text-[16px]`} />
            {/if}
            <!-- <i class={`${action.icon} ${action.color} text-[16px]`} /> -->

            <span class="font-500">{$_(action.label)}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}
