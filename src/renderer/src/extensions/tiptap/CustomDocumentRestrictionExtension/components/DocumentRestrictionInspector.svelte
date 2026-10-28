<script lang="ts">
  import { _, isLoading } from 'svelte-i18n'
  import { _$_documentEditorsList } from '../../../../stores/editor.store'
  import {
    // defaultDocumentRestrictionRules,
    // documentRestrictionRulesTypes,
    loadDocumentRestrictionRules,
    saveDocumentRestrictionRules
    // type DocumentRestrictionRules
  } from '../utils/common.utils'
  import {
    defaultDocumentRestrictionRules,
    documentRestrictionRulesTypes,
    type DocumentRestrictionRules
  } from '../utils/restriction.defaults'

  import { DocumentConfiguration } from '../../../../models/DocumentInfo'
  import { untrack } from 'svelte'
  import { defaultStats, nodeCounts } from '../stores/restriction.store'
  import UpgradeNotice from '../../../../components/common/upgrade/UpgradeNotice.svelte'
  import InfoPopover from '../../../../components/common/info/InfoPopover.svelte'

  // 1. Subscribe to the globally active editor
  const activeDocumentEditorStore = _$_documentEditorsList.getActive()

  // 2. Reactive state for the rules
  let limits: DocumentRestrictionRules = $state(defaultDocumentRestrictionRules)
  // 1. Get the globally active translation (Reacts to setActiveTranslation)
  const activeTranslation = _$_documentEditorsList.getActiveTranslation()
  const activeDocStore = _$_documentEditorsList.getActive()

  // const editorId = $activeDocStore.id

  // 2. Derive the current active ID from the translation path
  // If no translation is active, fallback to the active document editor's ID
  let currentActiveId  = $derived.by(() => {
    if ($activeTranslation) return $activeTranslation.path

    // const activeDoc = _$_documentEditorsList.getActiveSync()
    // return activeDoc?.id || null

    // Fallback to the main document editor
    const activeDoc = $activeDocStore
    if (!activeDoc) return null

    // IMPORTANT: Check if your editorId is the filePath or the numeric ID
    // We try to match both possibilities
    return activeDoc.id?.toString()
  })

  let editorId = $derived(currentActiveId)

  // 3. Performance Check: Only compute if THIS toolbar matches the ACTIVE view
  let isActiveView = $derived(currentActiveId === editorId)

  // 2. Only compute stats if we are the active tab (saves performance)
  let counts = $derived(isActiveView ? $nodeCounts[editorId] || defaultStats : null)
  // let rules = $derived(isActiveView ? loadDocumentRestrictionRules(editorId) : null)

  // 2. Derive Rules directly from the Store (Fastest - Memory only)
  // We check if the current active document's ID matches this toolbar
  let rules = $derived.by(() => {
    if (!isActiveView) return null

    // Use the active doc's config if it exists, otherwise fall back to loading by ID
    // Mutating editor.document.config in the inspector will trigger this automatically
    const configRules = $activeDocStore?.document?.config?.restrictionRules

    return {
      ...defaultDocumentRestrictionRules,
      ...(configRules || {})
    }
  })

  // Filter types that have non-default constraints
  const activeRestrictions = $derived(
    documentRestrictionRulesTypes.filter((t) => {
      const rule = rules?.[t.key]
      if (!rule) return false
      return rule.min > 0 || (rule.max !== Infinity && rule.max !== null)
    })
  )

  // 3. Helper to determine status color
  // Add this derived map to connect your store counts to the UI loop
  const statsMap = $derived(counts || {})

  // Update this function to return valid UnoCSS classes and expected labels
  function getStatus(key: string, count: number) {
    if (!rules || !rules[key]) return { color: 'text-zinc-500', icon: 'ph-circle', label: 'Valid' }
    const rule = rules[key]

    if ((rule.max && count > rule.max) || (rule.min && count < rule.min))
      return { color: 'text-red-500', icon: 'ph-warning-octagon', label: 'Invalid' }

    if (rule.max && count >= rule.max * 0.9)
      return { color: 'text-amber-500', icon: 'ph-warning', label: 'Near Limit' }

    return { color: 'text-emerald-500', icon: 'ph-check-circle', label: 'Valid' }
  }

  // 3. Effect: When the active editor changes, reload the specific limits for that doc
  /* $effect(() => {
    const editor = $activeDocumentEditorStore
    if (editor) {
      //  console.log('loadDocumentRestrictionRules effect', {limits})

      // Load rules specific to this editor's document configuration
      // const loaded = loadDocumentRestrictionRules(editor.document)
      // limits = { ...loaded }
      // console.log('loadDocumentRestrictionRules effect2', loaded )

      // 1. Get the rules
      const loaded = loadDocumentRestrictionRules(editor.document)

      // 2. Merge with defaults to ensure every key exists
      // This prevents "undefined" errors in the #each loop
      limits = {
        ...defaultDocumentRestrictionRules,
        ...loaded
      }

      console.log('Synced limits for editor:', editor.id, limits)

      // limits = { ...defaultDocumentRestrictionRules, ...loaded }
    }
  }) */

  $effect(() => {
    // 1. Establish the dependency on the Editor ID only
    const editor = $activeDocumentEditorStore
    const editorId = editor?.id

    if (editorId) {
      // 2. Use untrack to prevent the effect from re-running
      // when we read or write to other properties inside this block
      untrack(() => {
        console.log('Switching editor to:', editorId)

        const loaded = loadDocumentRestrictionRules(editor.document)

        // Ensure we merge with defaults so UI doesn't break
        limits = {
          ...defaultDocumentRestrictionRules,
          ...loaded
        }
      })
    }
  })

  // 4. Improved Update & Auto-Save
  /*   function updateLimit1(type: keyof DocumentRestrictionRules, field: 'min' | 'max', value: any) {
    const numValue = value === Infinity ? Infinity : Number(value)

    // Update local state
    if (!limits[type]) limits[type] = { min: 0, max: Infinity }
    limits[type][field] = numValue

    // Business Logic: Consistency check
    if (field === 'min' && limits[type].max < numValue) limits[type].max = numValue
    if (field === 'max' && limits[type].min > numValue) limits[type].min = numValue

    // Auto-Save: Write back to the active editor's configuration file
    const editor = $activeDocumentEditorStore
    if (editor?.document) {
      // Here we assume document.config stores these limits
      editor.document.config = { ...editor.document.config, ...limits }
      saveDocumentRestrictionRules(editor.document)
    }
  }

  function updateLimit2(type: keyof DocumentRestrictionRules, field: 'min' | 'max', value: any) {
    const numValue = value === Infinity ? Infinity : Number(value)

    // 1. Update local reactive state for UI snappiness
    if (!limits[type]) limits[type] = { min: 0, max: Infinity }
    limits[type][field] = numValue

    // Consistency checks...
    if (field === 'min' && limits[type].max < numValue) limits[type].max = numValue
    if (field === 'max' && limits[type].min > numValue) limits[type].min = numValue

    // 2. Update the Document Model
    const editor = $activeDocumentEditorStore
    if (editor?.document) {
      // Create the new config data object
      const newConfigData = {
        ...editor.document.config,
        restrictionRules: { ...limits }
      }

      // If DocumentConfiguration is a class, re-instantiate it:
      // @ts-ignore if constructor strictly requires methods, or use 'as'
      editor.document.config = new DocumentConfiguration(newConfigData)

      // 3. Save to disk
      saveDocumentRestrictionRules(editor.document)
    }
  } */

  function updateLimit(type: keyof DocumentRestrictionRules, field: 'min' | 'max', value: any) {
    // 1. Handle the "None" / Empty case for Maximum
    if (field === 'max' && (value === '' || value === null || value === undefined)) {
      applyChange(type, field, Infinity)
      return
    }

    // 2. Validate it's actually a number
    const numValue = Number(value)
    if (isNaN(numValue)) return // Exit early if input is invalid text

    applyChange(type, field, numValue)
  }

  // Separate logic to satisfy the DocumentConfiguration type requirements
  /*   function applyChange1(type: keyof DocumentRestrictionRules, field: 'min' | 'max', value: number) {
    if (!limits[type]) limits[type] = { min: 0, max: Infinity }

    // Update local reactive state
    limits[type][field] = value

    // Consistency check
    if (field === 'min' && limits[type].max < value) limits[type].max = value
    if (field === 'max' && limits[type].min > value) limits[type].min = value

    const editor = $activeDocumentEditorStore
    if (editor?.document) {
      // Satisfaction for the 'toJSON' missing error:
      // Instead of spreading a class, modify the existing instance or
      // use a Type Assertion if DocumentConfiguration is an interface.
      const updatedRules = { ...limits }

      // Update the config object property directly to preserve methods like toJSON
      editor.document.config.restrictionRules = updatedRules

      // Trigger save
      saveDocumentRestrictionRules(editor.document)
    }
  }

  function applyChange2(type: keyof DocumentRestrictionRules, field: 'min' | 'max', value: number) {
    // Update local state first
    const currentRules = { ...limits }
    if (!currentRules[type]) currentRules[type] = { min: 0, max: Infinity }

    currentRules[type][field] = value

    // Apply constraints
    if (field === 'min' && currentRules[type].max < value) currentRules[type].max = value
    if (field === 'max' && currentRules[type].min > value) currentRules[type].min = value

    // Trigger UI update
    limits = currentRules

    const editor = $activeDocumentEditorStore
    if (editor?.document) {
      // Direct mutation of the class property satisfies the type system
      editor.document.config.restrictionRules = { ...limits }
      saveDocumentRestrictionRules(editor.document)
    }
  } */

  /* function applyChange1(type: keyof DocumentRestrictionRules, field: 'min' | 'max', value: number) {
    // Prevent redundant updates
    if (limits[type]?.[field] === value) return

    // Update local state
    limits[type][field] = value

    const editor = $activeDocumentEditorStore
    if (editor?.document) {
      // Use untrack here if this function is called inside any other reactive context
      untrack(() => {
        editor.document.config.restrictionRules = { ...limits }
        saveDocumentRestrictionRules(editor.document)
      })
    }
  } */

  function applyChange(type: keyof DocumentRestrictionRules, field: 'min' | 'max', value: number) {
    if (limits[type]?.[field] === value) return

    const editor = $activeDocumentEditorStore
    if (!editor?.document) return

    // 1. Update local local state (so the slider feels smooth)
    limits[type][field] = value

    // 2. Call the debounced saver
    // UI updates instantly via store.update inside the function
    saveDocumentRestrictionRules(editor.document, { ...limits })
  }
</script>

<UpgradeNotice
  title={$_('Restriction Integrity')}
  message={$_('In the free plan, restrictions can be bypassed by anyone with edit access. Upgrade to enforce tamper‑proof rules and locked, secured documents.')}
  highlight="corporate"
  compact={true}
/>

<div class="flex items-center justify-between px-2 pt-2">
  <div class="text-[10px] font-800 tracking-[0.14em] uppercase text-base-content/55">
    {$_('Document limits')}
  </div>
  <InfoPopover title={$_('What are document restrictions?')} maxWidth={420}>
    <div>
      <div class="font-700 text-base-content/85">
        {$_('Restrictions are guardrails that keep a document within specific bounds (size, elements, complexity).')}
      </div>
      <ul>
        <li>{$_('They help enforce standards for teams and ensure performance stays smooth.')}</li>
        <li>{$_('They also prevent accidental “scope creep” in templates and regulated documents.')}</li>
      </ul>
      <div class="mt-2 font-700 text-base-content/85">{$_('Examples')}</div>
      <ul>
        <li>{$_('A classroom template: max 2 pages, max 3 images, max 1 table.')}</li>
        <li>{$_('A pitch deck: max 15 slides, max 10 charts, block external links.')}</li>
        <li>{$_('A compliance doc: require at least 1 signature block and a minimum word count.')}</li>
      </ul>
      <div class="mt-2 font-700 text-base-content/85">{$_('How to use this pane')}</div>
      <ul>
        <li>{$_('Set max/min values, then watch the live summary to see where you are relative to the limits.')}</li>
        <li>{$_('Use “Near limit” as an early warning before a document becomes invalid.')}</li>
      </ul>
    </div>
  </InfoPopover>
</div>

{#if $activeDocStore}
  <div class="p-2 mb-2 bg-base-content/6 rd-lg border border-white/5 mx-2 mt-2">
    <div class="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
      <span class="text-[9px] font-bold uppercase tracking-tighter text-base-content/40"
        >{$_('Live Document Summary')}</span
      >
      <div class="flex gap-1">
        <span
          class="px-1.5 py-0.5 rd bg-emerald-500/10 text-emerald-500 text-[8px] font-bold uppercase"
          >{$_('Live')}</span
        >
      </div>
      <!-- <span class="px-1.5 py-0.5 rd bg-blue-500/10 text-blue-400 text-[9px] font-mono uppercase"
        >Syncing</span
      > -->
    </div>

    <div class="grid grid-cols-2 gap-4 mb-3">
      <div class="flex flex-col border-l-2 border-blue-500/30 pl-2">
        <span class="text-[16px] font-mono font-bold text-base-content tracking-tight">
          {statsMap.words || 0}
        </span>
        <span class="text-[8px] uppercase text-base-content/30 tracking-widest font-600">{$_('Total Words')}</span>
      </div>
      <div class="flex flex-col border-l-2 border-purple-500/30 pl-2">
        <span class="text-[16px] font-mono font-bold text-base-content tracking-tight">
          {statsMap.characters || 0}
        </span>
        <span class="text-[8px] uppercase text-base-content/30 tracking-widest font-600">{$_('Characters')}</span>
      </div>
    </div>

    {#if activeRestrictions.length > 0}
      <div class="flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
        {#each activeRestrictions as t}
          {@const currentVal = statsMap[t.key] || 0}
          {@const status = getStatus(t.key, currentVal)}

          <div
            class="flex items-center gap-1.5 px-2 py-1 rd-md bg-base-content/8 border border-white/5 transition-colors"
            title="{t.label}: {currentVal} / {rules[t.key].max}"
          >
            <span class="text-[10px] opacity-50 {status.color}">{@html t.icon}</span>
            <span class="text-[9px] font-mono font-bold {status.color}">{currentVal}</span>
            <div class="w-[1px] h-2 bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)]"></div>
            <span class="text-[8px] font-bold text-base-content/40 uppercase">{t.label.split(' ')[0]}</span>
          </div>
        {/each}
      </div>
    {:else}
      <div class="text-center py-1">
        <span class="text-[8px] text-base-content/20 uppercase tracking-widest italic"
          >{$_('No active restrictions set')}</span
        >
      </div>
    {/if}
  </div>
{/if}

<!-- {#if $activeDocStore}
  <div class="p-2 mb-2 bg-zinc-900/50 rd-lg border border-white/5 mx-2 mt-2">
    <div class="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
      <span class="text-[9px] font-bold uppercase tracking-tighter text-base-content/40"
        >Live Document Summary</span
      >
      <span class="px-1.5 py-0.5 rd bg-blue-500/10 text-blue-400 text-[9px] font-mono uppercase"
        >Syncing</span
      >
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div class="flex flex-col">
        <span class="text-[18px] font-mono font-bold text-base-content leading-tight"
          >{statsMap.words || 0}</span
        >
        <span class="text-[8px] uppercase text-base-content/30 tracking-widest">Total Words</span>
      </div>
      <div class="flex flex-col">
        <span class="text-[18px] font-mono font-bold text-base-content leading-tight"
          >{statsMap.characters || 0}</span
        >
        <span class="text-[8px] uppercase text-base-content/30 tracking-widest">Characters</span>
      </div>
    </div>
  </div>
{/if} -->

<div heading={$_('Document restriction Pane')} class="collapsible" open>
  <div class="p-2 flex flex-col gap-1 w-full bg-base-200">
    {#each documentRestrictionRulesTypes as t}
      {@const currentVal = statsMap[t.key] || 0}
      {@const status = getStatus(t.key, currentVal)}

      <div
        class="bg-base-200 border border-white/5 flex flex-col select-none group mb-1 rd-md overflow-hidden"
      >
        <div
          class="flex items-center justify-between px-2 py-1.5 bg-base-content/4 border-b border-white/5"
        >
          <span
            class="text-base-content/80 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
          >
            <span class="opacity-70 text-blue-500">{@html t.icon}</span>
            {t.label}
          </span>

          <div class="flex items-center gap-2 px-1.5 py-0.5 rd bg-base-content/10 border border-white/5">
            <span class="text-[9px] font-mono font-bold {status.color}">{currentVal}</span>
            <i class="ph-bold {status.icon} text-[8px] {status.color}"></i>
          </div>
        </div>

        <div class="p-2 flex flex-col gap-2">
          <div class="grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-1">
              <span class="text-[8px] text-zinc-500 uppercase font-bold">{$_('Min Requirement')}</span>
              <input
                type="number"
                class="bg-base-content/10 border border-white/10 rd-sm text-base-content/80 text-[11px] px-2 py-1 outline-none focus:border-blue-500/50 transition-all font-mono"
                value={limits[t.key]?.min}
                on:input={(e) => updateLimit(t.key, 'min', e.currentTarget.value)}
              />
            </div>

            <div class="flex flex-col gap-1">
              <span class="text-[8px] text-zinc-500 uppercase font-bold">{$_('Max Threshold')}</span>
              <input
                type="number"
                class="bg-base-content/10 border border-white/10 rd-sm text-base-content/80 text-[11px] px-2 py-1 outline-none focus:border-blue-500/50 transition-all font-mono"
                value={isFinite(limits[t.key]?.max) ? limits[t.key].max : ''}
                placeholder={$_('∞')}
                on:input={(e) => updateLimit(t.key, 'max', e.currentTarget.value)}
              />
            </div>
          </div>

          <div class="relative w-full h-1 bg-base-content/15 rd-full mt-1 overflow-hidden">
            <div
              class="absolute h-full {status.color.replace(
                'text',
                'bg'
              )} opacity-40 transition-all duration-500"
              style="width: {Math.min(
                (currentVal / (rules?.[t.key]?.max || currentVal || 1)) * 100,
                100
              )}%"
            ></div>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-[8px] text-zinc-600 font-mono tracking-tighter">
              TARGET: {rules?.[t.key]?.min || 0} — {isFinite(rules?.[t.key]?.max)
                ? rules[t.key].max
                : '∞'}
            </span>

            {#if status.label !== 'Valid'}
              <span class="{status.color} text-[8px] font-bold uppercase tracking-widest">
                {status.label}
              </span>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  /* Customizing the appearance of number inputs to look more like Adobe scrubbers */
  input[type='number']::-webkit-inner-spin-button,
  input[type='number']::-webkit-outer-spin-button {
    opacity: 0.2;
    filter: invert(1);
  }
  input[type='number'] {
    text-align: right;
  }
</style>
