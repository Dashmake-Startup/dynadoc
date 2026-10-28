<script lang="ts">
  import { _ } from 'svelte-i18n'
  // no lifecycle needed
  import type { Editor } from '@tiptap/core'

  import ContextMenuWidget from '../../../../components/common/contextMenu/components/ContextMenuWidget.svelte'
  import type { ContextMenuItem } from '../../../../components/common/contextMenu/utils/utils'
  import { GenericFormatingEditorCommands } from '../../../../components/common/actions/formatting'
  import { aiGenerationStore } from '../stores/aiGeneration.store'
  import { AI_TRACKING_PLUGIN_KEY } from '../utils/aiTracking'

  const { editor } = $props<{ editor: Editor | null }>()

  const aiState = aiGenerationStore

  const abort = () => {
    window.server?.ai?.abort?.()
    if (editor) {
      const tr = editor.state.tr.setMeta(AI_TRACKING_PLUGIN_KEY, { action: 'clear' })
      editor.view.dispatch(tr)
    }
  }

  let menuShow = $state(false)
  let menuX = $state(0)
  let menuY = $state(0)
  let menuRef = $state<HTMLElement | null>(null)
  let triggerEl = $state<HTMLElement | null>(null)
  let toolbarEl = $state<HTMLElement | null>(null)
  let selectionTick = $state(0)

  $effect(() => {
    if (!editor) return
    const handleSelection = () => {
      selectionTick += 1
    }
    editor.on('selectionUpdate', handleSelection)
    return () => {
      editor.off('selectionUpdate', handleSelection)
    }
  })

  const hasSelection = $derived.by(() => {
    selectionTick
    return GenericFormatingEditorCommands.hasSelection()
  })

  const openMenu = (event?: MouseEvent) => {
    if (event) event.stopPropagation()
    if (!triggerEl) return
    const rect = triggerEl.getBoundingClientRect()
    menuX = rect.right + 6
    menuY = rect.top
    menuShow = true
  }

  const togglePreferVariables = (event?: MouseEvent) => {
    if (event) event.stopPropagation()
    aiGenerationStore.togglePreferVariables()
  }

  const menuItems = $derived.by<ContextMenuItem[]>(() => [
    {
      label: 'Generate',
      icon: 'ph-bold ph-sparkle',
      group: 1,
      children: [
        {
          label: 'Text',
          icon: 'ph-bold ph-text-t',
          action: () => GenericFormatingEditorCommands.generateWithAI()
        },
        {
          label: 'Slides',
          icon: 'ph-bold ph-presentation',
          action: () => GenericFormatingEditorCommands.generateSlidesWithAI()
        },
        {
          label: 'Spreadsheet',
          icon: 'ph-bold ph-table',
          action: () => GenericFormatingEditorCommands.generateSpreadsheetWithAI()
        },
        {
          label: 'Design',
          icon: 'ph-bold ph-shapes',
          action: () => GenericFormatingEditorCommands.generateDesignWithAI()
        },
        {
          label: 'LaTeX Project',
          icon: 'ph-bold ph-code',
          action: () => GenericFormatingEditorCommands.generateLatexWithAI()
        }
      ]
    },
    {
      label: 'Summarize',
      icon: 'ph-bold ph-text-indent',
      action: () => GenericFormatingEditorCommands.summarizeWithAI(),
      disabled: !hasSelection,
      tooltip: 'Select text to enable',
      group: 1
    },
    {
      label: 'Translate',
      icon: 'ph-bold ph-translate',
      action: () => GenericFormatingEditorCommands.translateWithAI(),
      disabled: !hasSelection,
      tooltip: 'Select text to enable',
      group: 1
    },
    {
      label: 'Translate To',
      icon: 'ph-bold ph-translate',
      action: () => GenericFormatingEditorCommands.translateToWithAI(),
      disabled: !hasSelection,
      tooltip: 'Select text to enable',
      group: 1
    },
    {
      label: 'Rewrite',
      icon: 'ph-bold ph-pen-nib',
      action: () => GenericFormatingEditorCommands.rewriteWithAI(),
      disabled: !hasSelection,
      tooltip: 'Select text to enable',
      group: 2
    },
    {
      label: 'Business Presets',
      icon: 'ph-bold ph-briefcase',
      action: () => {},
      disabled: true,
      group: 2
    },
    {
      label: 'Executive Summary',
      icon: 'ph-bold ph-briefcase',
      action: () => GenericFormatingEditorCommands.executiveSummaryWithAI(),
      disabled: !hasSelection,
      tooltip: 'Select text to enable',
      group: 2
    },
    {
      label: 'Investor Tone',
      icon: 'ph-bold ph-chart-line-up',
      action: () => GenericFormatingEditorCommands.investorToneWithAI(),
      disabled: !hasSelection,
      tooltip: 'Select text to enable',
      group: 2
    },
    {
      label: 'Technical Rewrite',
      icon: 'ph-bold ph-code',
      action: () => GenericFormatingEditorCommands.technicalRewriteWithAI(),
      disabled: !hasSelection,
      tooltip: 'Select text to enable',
      group: 2
    },
    {
      label: 'Expand',
      icon: 'ph-bold ph-plus-circle',
      action: () => GenericFormatingEditorCommands.expandWithAI(),
      disabled: !hasSelection,
      tooltip: 'Select text to enable',
      group: 2
    },
    {
      label: 'Shorten',
      icon: 'ph-bold ph-minus-circle',
      action: () => GenericFormatingEditorCommands.shortenWithAI(),
      disabled: !hasSelection,
      tooltip: 'Select text to enable',
      group: 2
    },
    {
      label: 'Fix Grammar',
      icon: 'ph-bold ph-check-circle',
      action: () => GenericFormatingEditorCommands.fixGrammarWithAI(),
      disabled: !hasSelection,
      tooltip: 'Select text to enable',
      group: 2
    },
    {
      label: 'Bulletize',
      icon: 'ph-bold ph-list-bullets',
      action: () => GenericFormatingEditorCommands.bulletizeWithAI(),
      disabled: !hasSelection,
      tooltip: 'Select text to enable',
      group: 3
    },
    {
      label: 'Outline',
      icon: 'ph-bold ph-list-numbers',
      action: () => GenericFormatingEditorCommands.outlineWithAI(),
      disabled: !hasSelection,
      tooltip: 'Select text to enable',
      group: 3
    },
    {
      label: 'Action Items',
      icon: 'ph-bold ph-check-square',
      action: () => GenericFormatingEditorCommands.extractActionItemsWithAI(),
      disabled: !hasSelection,
      tooltip: 'Select text to enable',
      group: 3
    },
    {
      label: 'Simplify',
      icon: 'ph-bold ph-wind',
      action: () => GenericFormatingEditorCommands.simplifyWithAI(),
      disabled: !hasSelection,
      tooltip: 'Select text to enable',
      group: 3
    },
    {
      label: 'Insert AI Block',
      icon: 'ph-bold ph-cursor-text',
      action: () => GenericFormatingEditorCommands.insertAI(),
      group: 4
    },
    {
      label: 'Stop Generation',
      icon: 'ph-bold ph-stop-circle',
      action: abort,
      disabled: $aiState.phase === 'idle',
      group: 4
    }
  ])
</script>

<!-- <div class="ai-toolbar-container"> -->
<div class="app-component-no-print ai-toolbar" bind:this={toolbarEl}>
  <button class="ai-fab" bind:this={triggerEl} title={$_('AI Tools')} onclick={openMenu}>
    <span class="ai-fab-icon">
      <i class="ph-bold ph-sparkle"></i>
    </span>
    {#if $aiState.phase !== 'idle'}
      <span class="ai-fab-pulse" aria-hidden="true"></span>
    {/if}
  </button>

  {#if $aiState.phase !== 'idle'}
    <div class="ai-fab-status">
      <span class="ai-status-label">
        {#if $aiState.phase === 'running'}
          {$_('Generating')}
        {:else if $aiState.phase === 'repairing'}
          {$_('Repairing JSON')}
        {:else if $aiState.phase === 'long-running'}
          {$_('Still working')}
        {:else if $aiState.phase === 'error'}
          {$_('Error')}
        {/if}
      </span>
    </div>
  {/if}

  <button
    class="ai-pref-toggle {$aiState.preferVariables ? 'is-on' : ''}"
    title={$_('Prefer variables')}
    onclick={togglePreferVariables}
  >
    <span>{$_('Vars')}</span>
    <span class="ai-pref-pill">{$aiState.preferVariables ? $_('On') : $_('Off')}</span>
  </button>
</div>
<!-- </div> -->

<ContextMenuWidget
  bind:__show={menuShow}
  bind:__menuRef={menuRef}
  __x={menuX}
  __y={menuY}
  __menuItems={menuItems}
/>

<style lang="postcss">
  :global(.ai-toolbar-container) {
    position: sticky;
    top: 16px;
    left: 16px;
    z-index: 120;
    width: 48px;
    margin-left: 0;
    align-self: flex-start;
    pointer-events: auto;
  }

  .ai-toolbar {
    @apply flex flex-col items-center gap-2;
  }

  .ai-fab {
    /* accent-tinted so it stays visible in both light and dark themes
       (it used --color-base-300, which is near-white and invisible on a
       light canvas). */
    @apply relative w-10 h-10 rounded-full flex items-center justify-center shadow-lg shadow-black/20 transition;
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
    color: var(--accent);
  }
  .ai-fab:hover {
    background: color-mix(in srgb, var(--accent) 24%, transparent);
  }
  .ai-fab-icon {
    @apply text-[16px];
  }
  .ai-fab-pulse {
    @apply absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full;
    background: var(--accent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 80%, transparent);
    animation: aiPulse 1.2s infinite ease-in-out;
  }
  .ai-fab-status {
    @apply text-[8px] uppercase tracking-[0.2em] text-[var(--color-base-content)]/50 text-center;
    writing-mode: vertical-rl;
  }
  .ai-status-label {
    @apply font-semibold;
  }

  .ai-pref-toggle {
    /* theme-aware so it stays visible on a light canvas (was white/base-300). */
    @apply text-[8px] uppercase tracking-[0.18em] rounded-full px-2 py-1 flex flex-col items-center gap-1 transition;
    color: var(--color-base-content);
    border: 1px solid color-mix(in srgb, var(--color-base-content) 22%, transparent);
    background: color-mix(in srgb, var(--color-base-content) 5%, transparent);
  }
  .ai-pref-toggle.is-on {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }
  .ai-pref-pill {
    @apply text-[7px] px-1.5 py-0.5 rounded-full;
    background: color-mix(in srgb, var(--color-base-content) 10%, transparent);
  }
  .ai-pref-toggle.is-on .ai-pref-pill {
    background: color-mix(in srgb, var(--accent) 20%, transparent);
    color: var(--accent);
  }

  @keyframes aiPulse {
    0% {
      transform: scale(0.85);
      opacity: 0.5;
    }
    60% {
      transform: scale(1.2);
      opacity: 1;
    }
    100% {
      transform: scale(0.9);
      opacity: 0.6;
    }
  }
</style>
