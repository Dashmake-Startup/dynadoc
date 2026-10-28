

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { createEventDispatcher, onMount } from 'svelte'
  import SSF from 'ssf'
  import { VariableManipulatorUtils } from '../stores/variableManipulator'

  // export let value: string
  let { value = $bindable() } = $props()

  const dispatch = createEventDispatcher<{ change: string }>()

  let showDropdown = $state(false)
  let showModal = $state(false)
  let search = $state('')
  let customFormat = $state('')
  let recentFormats = $state<string[]>([])
  let localeCode = $state(VariableManipulatorUtils.FORMAT_LOCALES[0]?.code || 'en-US')
  let negativeStyle = $state<'default' | 'red' | 'paren' | 'red_paren'>('default')
  let applyLocaleTag = $state(false)
  let showAccountingPreview = $state(true)
  let activeCategory = $state(VariableManipulatorUtils.FORMAT_CATEGORIES[0]?.id || 'general')

  const RECENT_KEY = 'dynadoc:variable-format-recent'

  const popularFormats = VariableManipulatorUtils.POPULAR_FORMAT_KEYS.map(
    (key) => VariableManipulatorUtils.EXCEL_FORMATS[key]
  ).filter(Boolean)

  const allCategories = VariableManipulatorUtils.FORMAT_CATEGORIES

  const formatLabel = (format: string) => VariableManipulatorUtils.getFormatLabel(format) || format

  const localeFor = (code: string) =>
    VariableManipulatorUtils.FORMAT_LOCALES.find((loc) => loc.code === code) ||
    VariableManipulatorUtils.FORMAT_LOCALES[0]

  const isDateFormat = (format: string) => /[ymdhHs]/.test(format)
  const isCurrencyFormat = (format: string): boolean =>
  /\$|€|£|¥|₹|₩|₽|₺|฿|₫|Rp|C\$|A\$|CHF|\bAccounting\b|_\("\$"\)/.test(format);

  const addLocaleTag = (format: string, code: string) => {
    if (!format || !code) return format
    if (format.includes('[$-')) return format
    return `[$-${code}]${format}`
  }

  const stripLocaleTag = (format: string) => format.replace(/\[\$-[^\]]+\]/g, '')

  const applyNegativeStyle = (format: string, style: typeof negativeStyle) => {
    if (!format || style === 'default') return format
    if (isDateFormat(format)) return format

    const parts = format.split(';')
    const positive = parts[0] || format
    const base = positive.replace(/\[[^\]]+\]/g, '')
    let negative = parts[1] || `-${base}`

    if (style === 'red') {
      negative = `[Red]-${base}`
    }

    if (style === 'paren') {
      negative = `(${base})`
    }

    if (style === 'red_paren') {
      negative = `[Red](${base})`
    }

    const zero = parts[2]
    const text = parts[3]
    return [positive, negative, zero, text].filter(Boolean).join(';')
  }

  const localizePreview = (value: string, code: string) => {
    if (!value) return value
    const locale = localeFor(code)
    if (!locale || (locale.decimal === '.' && locale.thousand === ',')) return value
    const temp = value.replace(/,/g, '__THOUSAND__')
    const withDecimal = temp.replace(/\./g, locale.decimal)
    return withDecimal.replace(/__THOUSAND__/g, locale.thousand)
  }

  const previewFor = (format: string, sampleOverride?: number | Date) => {
    try {
      const baseFormat = stripLocaleTag(format)
      const hasDate = isDateFormat(baseFormat)
      const sample = sampleOverride ?? (hasDate ? new Date('2026-03-01T13:30:45') : 12345.678)
      const formatted = SSF.format(baseFormat, sample)
      return localizePreview(formatted, localeCode)
    } catch {
      return format
    }
  }

  function loadRecent() {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      if (raw) recentFormats = JSON.parse(raw)
    } catch {
      recentFormats = []
    }
  }

  function persistRecent(next: string[]) {
    recentFormats = next
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  function pushRecent(format: string) {
    if (!format) return
    const next = [format, ...recentFormats.filter((f) => f !== format)].slice(0, 8)
    persistRecent(next)
  }

  function normalizeFormat(format: string) {
    if (!format) return format
    let next = format
    next = applyNegativeStyle(next, negativeStyle)
    if (applyLocaleTag && localeCode && isCurrencyFormat(next)) {
      next = addLocaleTag(next, localeCode)
    }
    return next
  }

  function setFormat(format: string) {
    const next = normalizeFormat(format)
    value = next
    pushRecent(next)
    dispatch('change', next)
  }

  const filteredCategories = $derived.by(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allCategories
    return allCategories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => `${item.label} ${item.format}`.toLowerCase().includes(q))
      }))
      .filter((cat) => cat.items.length > 0)
  })

  onMount(() => {
    loadRecent()
    try {
      const browserLocale = navigator.language || ''
      const directMatch = VariableManipulatorUtils.FORMAT_LOCALES.find(
        (loc) => loc.code.toLowerCase() === browserLocale.toLowerCase()
      )
      if (directMatch) {
        localeCode = directMatch.code
        return
      }
      const baseMatch = VariableManipulatorUtils.FORMAT_LOCALES.find(
        (loc) => loc.code.split('-')[0].toLowerCase() === browserLocale.split('-')[0]?.toLowerCase()
      )
      if (baseMatch) localeCode = baseMatch.code
    } catch {
      // ignore
    }
  })

  const previewSamples = [1234.56, -1234.56, 0, 987654.32]

  const visibleCategories = $derived.by(() => {
    if (search.trim()) return filteredCategories
    return allCategories.filter((cat) => cat.id === activeCategory)
  })

  // State
  // let showDropdown = $state(false)
  // let showModal = $state(false)
  // let activeCategory = $state('number') // Default to Number for structural demo
  // let localeCode = $state('en-US')
  let decimalPlaces = $state(2) // New Excel-specific state
  let useSeparator = $state(true) // New Excel-specific state
  // let negativeStyle = $state('default')

  // Derived visible items based on Excel Category
  const currentCategoryItems = $derived.by(() => {
    const cat = VariableManipulatorUtils.FORMAT_CATEGORIES.find((c) => c.id === activeCategory)
    if (!cat) return []
    const q = search.trim().toLowerCase()
    if (!q) return cat.items
    return cat.items.filter((item) => `${item.label} ${item.format}`.toLowerCase().includes(q))
  })

  const sampleValue = 1234.5678
</script>

<div class="adobe-format-picker">
  <button
    class="format-trigger"
    class:active={showDropdown}
    onclick={() => (showDropdown = !showDropdown)}
  >
    <div class="flex flex-col items-start min-w-0 pointer-events-none">
      <span class="eyebrow">{$_('Format')}</span>
      <span class="current-value">{previewFor(value)}</span>
    </div>
    <div class="trigger-icon">
      <i class="ph-light ph-caret-down"></i>
    </div>
  </button>

  {#if showDropdown}
    <div class="menu-backdrop" onclick={() => (showDropdown = false)}></div>

    <div class="adobe-popover">
      <div class="popover-scroll no-scrollbar">
        {#if recentFormats.length}
          <div class="menu-section">
            <div class="menu-label">{$_('Recent')}</div>
            {#each recentFormats as fmt}
              <button
                class="menu-item"
                class:selected={value === fmt}
                onclick={() => (setFormat(fmt), (showDropdown = false))}
              >
                <div class="flex items-center gap-2 min-w-0">
                  <div class="selection-gutter">
                    {#if value === fmt}<i class="ph-bold ph-check"></i>{/if}
                  </div>
                  <span class="item-label">{formatLabel(fmt)}</span>
                </div>
                <span class="item-preview">{previewFor(fmt)}</span>
              </button>
            {/each}
          </div>
          <div class="menu-divider"></div>
        {/if}

        <div class="menu-section">
          <div class="menu-label">{$_('Standard Formats')}</div>
          {#each popularFormats as fmt}
            <button
              class="menu-item"
              class:selected={value === fmt}
              onclick={() => (setFormat(fmt), (showDropdown = false))}
            >
              <div class="flex items-center gap-2 min-w-0">
                <div class="selection-gutter">
                  {#if value === fmt}<i class="ph-bold ph-check text-[10px]"></i>{/if}
                </div>
                <span class="item-label">{formatLabel(fmt)}</span>
              </div>
              <span class="item-preview">{previewFor(fmt)}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="menu-footer">
        <button
          class="more-btn"
          onclick={() => {
            showDropdown = false
            showModal = true
          }}
        >
          <i class="ph-light ph-dots-three-circle"></i>
          <span>{$_('More Formats...')}</span>
        </button>
      </div>
    </div>
  {/if}
</div>

{#if showModal}
  <div class="adobe-modal-backdrop" onclick={() => (showModal = false)}>
    <div class="adobe-modal" onclick={(e) => e.stopPropagation()}>
      <header class="adobe-modal-header">
        <span class="text-[11px] font-800 uppercase tracking-[0.2em] text-base-content/50"
          >{$_('Format Cells')}</span
        >
        <button class="close-x" onclick={() => (showModal = false)}
          ><i class="ph-light ph-x"></i></button
        >
      </header>

      <div class="adobe-modal-content">
        <aside class="category-sidebar">
          <div class="text-[9px] font-900 text-base-content/20 uppercase mb-2 px-2">{$_('Category')}</div>
          <nav class="category-nav">
            {#each VariableManipulatorUtils.FORMAT_CATEGORIES as cat}
              <button
                class="category-btn"
                class:active={activeCategory === cat.id}
                onclick={() => (activeCategory = cat.id)}
              >
                {cat.label}
              </button>
            {/each}
          </nav>
        </aside>

        <main class="format-details">
          <section class="sample-section">
            <div class="section-label">{$_('Sample')}</div>
            <div class="sample-display">
              {previewFor(value, sampleValue)}
            </div>
          </section>

          <section class="options-grid">
            <div class="flex flex-col gap-4">
              <div class="property-row flex-col items-start gap-2">
                <label>{$_('Locale:')}</label>
                <select bind:value={localeCode} class="adobe-select">
                  {#each VariableManipulatorUtils.FORMAT_LOCALES as locale}
                    <option value={locale.code}>{locale.label}</option>
                  {/each}
                </select>
                <label class="flex items-center gap-2 cursor-pointer text-[11px] text-base-content/60">
                  <input type="checkbox" bind:checked={applyLocaleTag} class="adobe-checkbox" />
                  {$_('Apply locale tag to currency/accounting formats only')}
                </label>
              </div>
              {#if activeCategory === 'number' || activeCategory === 'currency'}
                <div class="property-row">
                  <label>{$_('Decimal places:')}</label>
                  <input
                    type="number"
                    bind:value={decimalPlaces}
                    class="adobe-number-input"
                    min="0"
                    max="30"
                  />
                </div>
                <div class="property-row">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" bind:checked={useSeparator} class="adobe-checkbox" />
                    {$_('Use 1000 Separator (,)')}
                  </label>
                </div>
              {/if}

              <div class="property-row flex-col items-start gap-2">
                <label>{$_('Negative numbers:')}</label>
                <div class="negative-list">
                  {#each ['default', 'red', 'paren', 'red_paren'] as style}
                    <button
                      class="negative-option"
                      class:active={negativeStyle === style}
                      onclick={() => (negativeStyle = style)}
                    >
                      <span class={style.includes('red') ? 'text-red-400' : ''}>
                        {previewFor(normalizeFormat('#,##0.00'), -1234.56)}
                      </span>
                    </button>
                  {/each}
                </div>
              </div>
            </div>

            <div class="sub-format-list-container">
              <div class="section-label">{$_('Type:')}</div>
              <input
                type="search"
                bind:value={search}
                placeholder={$_('Search formats...')}
                class="adobe-search"
              />
              <div class="sub-format-list">
                {#each currentCategoryItems as item}
                  <button class="type-item" onclick={() => setFormat(item.format)}>
                    {previewFor(item.format, sampleValue)}
                  </button>
                {/each}
                {#if currentCategoryItems.length === 0}
                  <div class="empty-state">{$_('No formats matched your search.')}</div>
                {/if}
              </div>
              <div class="custom-format">
                <label>{$_('Custom format')}</label>
                <input
                  type="text"
                  bind:value={customFormat}
                  placeholder={$_('e.g. 0.0000;[Red](0.0000)')}
                  class="adobe-text-input"
                />
                <div class="custom-preview">{customFormat ? previewFor(customFormat, sampleValue) : 'Preview'}</div>
                <button
                  class="adobe-btn-ghost w-full text-left"
                  onclick={() => {
                    if (!customFormat) return
                    setFormat(customFormat)
                  }}
                >
                  Apply Custom Format
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      <footer class="adobe-modal-footer">
        <div class="flex-1 text-[10px] text-base-content/30 italic">
          {activeCategory === 'number' ? 'Number is used for general display of numbers.' : ''}
        </div>
        <button class="adobe-btn-ghost" onclick={() => (showModal = false)}>Cancel</button>
        <button class="adobe-btn-primary" onclick={() => (showModal = false)}>OK</button>
      </footer>
    </div>
  </div>
{/if}

<style lang="postcss">
  /* Adobe 2025 Neutrals */
  :root {
    --adobe-bg: #1e1e1e;
    --adobe-canvas: #141414;
    --adobe-border: rgba(255, 255, 255, 0.08);
    --ddoc-teal: var(--color-base-300);
  }

  .adobe-modal-backdrop {
    @apply fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center;
  }

  .adobe-modal {
    @apply bg-[var(--adobe-bg)] border border-[var(--adobe-border)] rd-[6px] shadow-2xl w-[720px] overflow-hidden flex flex-col;
  }

  .adobe-modal-header {
    @apply px-4 py-3 border-b border-black/40 flex justify-between items-center bg-black/10;
  }

  .adobe-modal-content {
    @apply grid grid-cols-[180px_1fr] h-[480px];
  }

  /* Excel Sidebar Navigation */
  .category-sidebar {
    @apply border-r border-black/40 p-3 bg-black/5;
  }

  .category-nav {
    @apply flex flex-col gap-0.5;
  }

  .category-btn {
    @apply w-full text-left px-3 py-1.5 rd-[4px] text-[12px] text-[var(--color-base-content)]/50 transition-all;
  }
  .category-btn:hover {
    @apply bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-[var(--color-base-content)]/80;
  }
  .category-btn.active {
    @apply bg-[var(--ddoc-teal)] text-black font-700;
  }

  /* Format Details Area */
  .format-details {
    @apply p-6 flex flex-col gap-6 overflow-y-auto;
  }

  .section-label {
    @apply text-[10px] font-800 uppercase tracking-widest text-[var(--color-base-content)]/30 mb-2;
  }

  .sample-display {
    @apply bg-[var(--adobe-canvas)] border border-[var(--adobe-border)] rd-[4px] p-4 text-center text-[18px] font-600 text-[var(--color-base-content)] tabular-nums;
  }

  .options-grid {
    @apply grid grid-cols-2 gap-8;
  }

  .property-row {
    @apply flex items-center justify-between text-[12px] text-[var(--color-base-content)]/70;
  }

  .adobe-number-input {
    @apply bg-black/40 border border-[var(--adobe-border)] rd-[4px] px-2 py-1 w-[60px] text-right outline-none focus:border-[var(--ddoc-teal)];
  }

  /* Excel Type Listbox */
  .sub-format-list-container {
    @apply flex flex-col h-full;
  }

  .sub-format-list {
    @apply bg-[var(--adobe-canvas)] border border-[var(--adobe-border)] rd-[4px] h-[200px] overflow-y-auto;
  }

  .type-item {
    @apply w-full text-left px-3 py-2 text-[12px] border-b border-white/5 hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] tabular-nums;
  }

  /* Negative Numbers Picker */
  .negative-list {
    @apply border border-[var(--adobe-border)] rd-[4px] overflow-hidden w-full;
  }

  .negative-option {
    @apply w-full text-left px-3 py-1.5 bg-[var(--adobe-canvas)] text-[11px] border-b border-white/5 last:border-0;
  }
  .negative-option.active {
    @apply bg-[var(--ddoc-teal)]/10;
  }
  .adobe-select {
    @apply w-full bg-black/40 border border-[var(--adobe-border)] rd-[4px] px-2 py-1 text-[12px] text-[var(--color-base-content)]/80;
  }
  .adobe-search {
    @apply w-full bg-black/40 border border-[var(--adobe-border)] rd-[4px] px-2 py-1 text-[11px] text-[var(--color-base-content)]/80 mb-2;
  }
  .adobe-text-input {
    @apply w-full bg-black/40 border border-[var(--adobe-border)] rd-[4px] px-2 py-1 text-[11px] text-[var(--color-base-content)]/80;
  }
  .custom-format {
    @apply mt-3 flex flex-col gap-2;
  }
  .custom-preview {
    @apply text-[11px] text-[var(--color-base-content)]/40 bg-black/20 rd-[4px] px-2 py-1;
  }
  .empty-state {
    @apply px-3 py-2 text-[11px] text-[var(--color-base-content)]/40;
  }

  /* Footer */
  .adobe-modal-footer {
    @apply px-4 py-4 border-t border-black/40 bg-black/10 flex justify-end gap-3 items-center;
  }

  .adobe-btn-primary {
    @apply bg-[var(--ddoc-teal)] text-black px-6 py-1.5 rd-[4px] text-[12px] font-700 hover:brightness-110 active:scale-95 transition-all;
  }

  .adobe-btn-ghost {
    @apply text-[var(--color-base-content)]/50 px-6 py-1.5 rd-[4px] text-[12px] font-600 hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)];
  }

  .adobe-checkbox {
    @apply appearance-none size-4 border border-white/20 rd-[2px] checked:bg-[var(--ddoc-teal)] relative transition-all;
  }

  .adobe-format-picker {
    @apply relative w-full font-sans select-none;
  }

  /* --- Trigger Styles --- */
  .format-trigger {
    @apply w-full flex items-center justify-between gap-3 px-3 py-1.5 
           bg-[var(--color-base-100)] border border-white/5 rd-[4px] transition-all
           hover:border-white/20 active:bg-[#2a2a2a];
  }
  .format-trigger.active {
    @apply border-[var(--color-base-300)]/50 ring-1 ring-[var(--color-base-300)]/20 bg-[var(--color-base-100)];
  }

  .eyebrow {
    @apply text-[9px] font-900 uppercase tracking-[0.12em] text-[var(--color-base-content)]/30 mb-0.5;
  }

  .current-value {
    @apply text-[12px] font-600 text-[var(--color-base-content)]/90 truncate tabular-nums;
  }

  .trigger-icon {
    @apply text-[var(--color-base-content)]/20 text-[12px] transition-transform duration-200;
  }
  .format-trigger.active .trigger-icon {
    @apply rotate-180 text-[var(--color-base-300)];
  }

  /* --- Popover / Menu Styles --- */
  .adobe-popover {
    @apply absolute z-[100] top-[calc(100%+4px)] left-0 w-full min-w-[240px]
           bg-[var(--color-base-200)] border border-black/40 shadow-[0_12px_32px_-4px_rgba(0,0,0,0.5)] 
           rd-[6px] overflow-hidden flex flex-col;
  }

  .popover-scroll {
    @apply max-h-[320px] overflow-y-auto py-1;
  }

  .menu-label {
    @apply px-3 py-1 text-[8px] font-900 uppercase tracking-widest text-[var(--color-base-content)]/20;
  }

  .menu-item {
    @apply w-full flex items-center justify-between px-2 py-1.5 text-left
           hover:bg-[var(--color-base-300)] group transition-colors;
  }

  /* Checkmark Gutter */
  .selection-gutter {
    @apply w-3 flex justify-center text-[var(--color-base-300)] group-hover:text-[var(--color-base-content)];
  }

  .item-label {
    @apply text-[11px] font-500 text-[var(--color-base-content)]/80 group-hover:text-[var(--color-base-content)] truncate;
  }

  .item-preview {
    @apply text-[10px] font-400 text-[var(--color-base-content)]/30 group-hover:text-[var(--color-base-content)]/70 tabular-nums pl-4;
  }

  .menu-divider {
    @apply h-px bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] my-1 mx-1;
  }

  .menu-footer {
    @apply bg-black/10 border-t border-white/5 p-1;
  }

  .more-btn {
    @apply w-full flex items-center gap-2 px-2 py-1.5 rd-[4px]
           text-[11px] font-600 text-[var(--color-base-content)]/50 hover:(bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-[var(--color-base-300)]) transition-all;
  }

  .menu-backdrop {
    @apply fixed inset-0 z-[99];
  }

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
</style>
