<script lang="ts">
  import { _ } from 'svelte-i18n'
  import type { SurveyQuestionType } from '../utils/surveySchema'

  export type MenuItem = {
    type: SurveyQuestionType
    label: string
    icon: string
    hint?: string
  }

  let {
    items,
    onPick
  }: {
    items: MenuItem[]
    onPick: (type: SurveyQuestionType) => void
  } = $props()
</script>

<div
  class="min-w-[280px] rounded-sm border border-base-content/10 bg-base-100 shadow-xl overflow-hidden"
>
  <div class="px-3 py-2 text-[10px] tracking-widest font-semibold text-base-content/60 bg-base-200/60">
    {$_('Question type')}
  </div>
  <div class="py-1">
    {#each items as item (item.type)}
      <button
        type="button"
        class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-base-200/50 active:bg-base-200/70"
        on:click={() => onPick(item.type)}
      >
        <div class="w-5 h-5 flex items-center justify-center text-base-content/70">
          <div class="{item.icon} w-5 h-5"></div>
        </div>
        <div class="flex-1">
          <div class="text-[12px] font-medium text-base-content/90">{item.label}</div>
          {#if item.hint}
            <div class="text-[11px] text-base-content/60">{item.hint}</div>
          {/if}
        </div>
      </button>
    {/each}
  </div>
</div>

