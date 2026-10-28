<script lang="ts">
  import { _ } from 'svelte-i18n'
  import {
    _$_conditionalFormattingModal,
    type ConditionalFormattingRule,
    type ConditionalFormattingRuleType
  } from '../../../stores/conditionalFormattingModal.store'

  const modal = _$_conditionalFormattingModal

  let ruleType: ConditionalFormattingRuleType = 'greater'
  let threshold = ''
  let color = '#dbeeff'
  let rules = $state<ConditionalFormattingRule[]>([])

  const formatRange = (range?: { sr: number; sc: number; er: number; ec: number }) => {
    if (!range) return ''
    return `R${range.sr + 1}:C${range.sc + 1} → R${range.er + 1}:C${range.ec + 1}`
  }

  $effect(() => {
    if ($modal.open) {
      ruleType = 'greater'
      threshold = ''
      color = '#dbeeff'
      rules = ($modal.rules || []).map((rule) => ({ ...rule }))
    }
  })

  function addRule(existingRules: ConditionalFormattingRule[]) {
    if (ruleType !== 'duplicates' && !threshold.trim()) {
      return { rules: existingRules, applyRule: null }
    }
    const rule: ConditionalFormattingRule = {
      id: `cf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      type: ruleType,
      threshold: ruleType === 'duplicates' ? undefined : Number.parseFloat(threshold),
      color,
      range: $modal.selectionRange || undefined,
      createdAt: Date.now()
    }
    return { rules: [...existingRules, rule], applyRule: rule }
  }

  function submit() {
    const { rules: nextRules, applyRule } = addRule(rules)
    _$_conditionalFormattingModal.confirm({
      action: 'apply',
      rules: nextRules,
      applyRule: applyRule || null
    })
  }

  function clearAll() {
    _$_conditionalFormattingModal.confirm({
      action: 'clear',
      rules: []
    })
  }

  function removeRule(ruleId: string) {
    rules = rules.filter((rule) => rule.id !== ruleId)
  }

  function close() {
    _$_conditionalFormattingModal.cancel()
  }
</script>

{#if $modal.open}
  <div
    class="modal-shell fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    onclick={(event) => event.target === event.currentTarget && close()}
    role="dialog"
    aria-modal="true"
    aria-label={$modal.title || $_('Conditional Formatting')}
  >
    <div
      class="modal-card w-full max-w-[520px] bg-[#1e1e1e] border border-white/10 rounded-xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base-content text-lg font-600">
          {$modal.title || $_('Conditional Formatting')}
        </h3>
        <button class="text-base-content/60 hover:text-base-content text-[12px]" onclick={close}>
          {$_('Close')}
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label class="text-[11px] text-base-content/60">{$_('Rule Type')}</label>
          <select
            class="w-full mt-1 bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 rounded-md py-2 px-3 text-base-content text-[13px]"
            bind:value={ruleType}
          >
            <option value="greater">{$_('Greater Than')}</option>
            <option value="less">{$_('Less Than')}</option>
            <option value="duplicates">{$_('Highlight Duplicates')}</option>
          </select>
        </div>
        <div>
          <label class="text-[11px] text-base-content/60">{$_('Threshold')}</label>
          <input
            type="number"
            class="w-full mt-1 bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 rounded-md py-2 px-3 text-base-content text-[13px]"
            bind:value={threshold}
            disabled={ruleType === 'duplicates'}
            placeholder={ruleType === 'duplicates' ? $_('Not required') : '0'}
          />
        </div>
        <div>
          <label class="text-[11px] text-base-content/60">{$_('Color')}</label>
          <input
            type="color"
            class="mt-2 h-10 w-16 rounded-md border border-white/10 bg-transparent"
            bind:value={color}
          />
        </div>
        <div>
          <label class="text-[11px] text-base-content/60">{$_('Range')}</label>
          <div class="mt-2 text-[12px] text-base-content/70">
            {formatRange($modal.selectionRange || undefined) || $_('Current Selection')}
          </div>
        </div>
      </div>

      <div class="mb-4">
        <div class="text-[11px] uppercase tracking-[0.2em] text-base-content/50 mb-2">
          {$_('Applied Rules')}
        </div>
        {#if rules.length === 0}
          <div class="text-[12px] text-base-content/40">{$_('No rules yet')}</div>
        {:else}
          <div class="space-y-2">
            {#each rules as rule (rule.id)}
              <div
                class="flex items-center justify-between gap-2 bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 rounded-md px-3 py-2"
              >
                <div class="flex flex-col gap-1">
                  <div class="text-[12px] text-base-content/80">
                    {rule.type === 'duplicates'
                      ? $_('Highlight Duplicates')
                      : rule.type === 'greater'
                        ? $_('Greater Than')
                        : $_('Less Than')}
                    {#if rule.threshold !== undefined}
                      {rule.threshold}{/if}
                  </div>
                  <div class="text-[10px] text-base-content/50">{formatRange(rule.range)}</div>
                </div>
                <div class="flex items-center gap-2">
                  <div
                    class="h-4 w-4 rounded-sm border border-white/20"
                    style={`background:${rule.color || '#dbeeff'}`}
                  ></div>
                  <button
                    class="text-[10px] text-rose-300 hover:text-rose-200"
                    onclick={() => removeRule(rule.id)}
                  >
                    {$_('Remove')}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="flex items-center justify-between gap-2">
        <button
          class="px-3 py-2 text-[11px] text-base-content/70 hover:text-base-content transition-colors"
          onclick={clearAll}
        >
          {$_('Clear All')}
        </button>
        <div class="flex gap-2">
          <button
            class="px-3 py-2 text-[11px] text-base-content/70 hover:text-base-content transition-colors"
            onclick={close}
          >
            {$_('Cancel')}
          </button>
          <button
            class="px-4 py-2 bg-base-300 rounded-md text-[11px] text-base-content font-700 hover:bg-base-300/10"
            onclick={submit}
          >
            {$_('Apply')}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
