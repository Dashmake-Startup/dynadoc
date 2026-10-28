<script lang="ts">
  import { _ , locale as svelteLocale } from 'svelte-i18n'
  import { get } from 'svelte/store'
  import { _$_documentEditorsList } from '../../../stores/editor.store'
  import { _$_translationPickerModal } from '../../../stores/translationPickerModal.store'
  import { getFlagEmoji, getTranslationLanguages } from '../../../extensions/tiptap/CustomTranslationExtension/utils/utils'

  const modal = _$_translationPickerModal
  const activeTranslationStore = _$_documentEditorsList.getActiveTranslation()
  const preselectLanguageCode =
    get(activeTranslationStore)?.language || get(svelteLocale) || 'en'

  const PINNED_KEY = 'ddoc.translation.pinned'
  const RECENT_KEY = 'ddoc.translation.recent'
  const MAX_RECENT = 8

  let searchQuery = $state('')
  let selectedLanguage = $state<{ name: string; code: string } | null>(null)
  let pinnedCodes = $state<string[]>([])
  let recentCodes = $state<string[]>([])
  let highlightedIndex = $state(0)
  let didInit = $state(false)

  const allLanguages = $derived.by(() => getTranslationLanguages())

  const filteredLanguages = $derived.by(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return allLanguages
    return allLanguages.filter(
      (lang) =>
        lang.name.toLowerCase().includes(query) ||
        lang.code.toLowerCase() === query ||
        lang.code.toLowerCase().includes(query)
    )
  })

  const pinnedLanguages = $derived.by(() =>
    allLanguages.filter((lang) => pinnedCodes.includes(lang.code))
  )

  const recentLanguages = $derived.by(() =>
    allLanguages.filter((lang) => recentCodes.includes(lang.code))
  )

  $effect(() => {
    searchQuery
    highlightedIndex = 0
  })

  function loadList(key: string): string[] {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []
    } catch {
      return []
    }
  }

  function saveList(key: string, values: string[]) {
    try {
      localStorage.setItem(key, JSON.stringify(values))
    } catch {
      // ignore
    }
  }

  function togglePin(code: string) {
    const next = pinnedCodes.includes(code)
      ? pinnedCodes.filter((c) => c !== code)
      : [code, ...pinnedCodes]
    pinnedCodes = next
    saveList(PINNED_KEY, next)
  }

  function pushRecent(code: string) {
    const next = [code, ...recentCodes.filter((c) => c !== code)].slice(0, MAX_RECENT)
    recentCodes = next
    saveList(RECENT_KEY, next)
  }

  function close() {
    modal.cancel()
  }

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) close()
  }

  function handleSelect(lang: { name: string; code: string }) {
    selectedLanguage = lang
  }

  function confirmSelection() {
    if (!selectedLanguage) return
    pushRecent(selectedLanguage.code)
    modal.confirm(selectedLanguage)
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      highlightedIndex = (highlightedIndex + 1) % Math.max(filteredLanguages.length, 1)
      selectedLanguage = filteredLanguages[highlightedIndex] || selectedLanguage
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      highlightedIndex =
        (highlightedIndex - 1 + Math.max(filteredLanguages.length, 1)) %
        Math.max(filteredLanguages.length, 1)
      selectedLanguage = filteredLanguages[highlightedIndex] || selectedLanguage
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (!selectedLanguage && filteredLanguages[highlightedIndex]) {
        selectedLanguage = filteredLanguages[highlightedIndex]
      }
      confirmSelection()
    }
  }

  $effect(() => {
    if (!$modal.open) {
      didInit = false
      return
    }
    if (didInit) return
    didInit = true

    const loadedPins = loadList(PINNED_KEY)
    const loadedRecents = loadList(RECENT_KEY)
    pinnedCodes = loadedPins
    recentCodes = loadedRecents

    const preselect =
      allLanguages.find((lang) => lang.code === preselectLanguageCode) ||
      allLanguages.find((lang) => lang.code.startsWith(`${preselectLanguageCode}-`))
    if (preselect) {
      selectedLanguage = preselect
    }

    if (!loadedPins.length && preselect?.code) {
      const nextPins = [preselect.code]
      pinnedCodes = nextPins
      saveList(PINNED_KEY, nextPins)
    }
  })
</script>

{#if $modal.open}
  <div
    class="modal-shell fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    onclick={onBackdropClick}
    onkeydown={handleKeyDown}
    role="dialog"
    aria-modal="true"
    aria-label={$modal.title || $_('Translate')}
  >
    <div
      class="modal-card w-full max-w-[680px] bg-[#1e1e1e] border border-white/10 rounded-xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 class="text-base-content text-lg font-600">{$modal.title || $_('Translate to')}</h3>
          {#if $modal.message}
            <p class="text-base-content/50 text-[11px] mt-1">{$modal.message}</p>
          {/if}
        </div>
        <button
          class="text-base-content/50 hover:text-base-content text-[12px]"
          onclick={close}
          aria-label={$_('Close')}
        >
          <i class="ph-light ph-x"></i>
        </button>
      </div>

      <div class="flex items-center gap-3 mb-4">
        <div class="flex-1">
          <div class="relative">
            <i class="ph-light ph-magnifying-glass absolute left-3 top-2.5 text-[12px] text-base-content/40"></i>
            <input
              class="w-full bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 rounded-md py-2 pl-9 pr-3 text-base-content text-[12px] focus:outline-none focus:border-base-300"
              placeholder={$_('Search language')}
              bind:value={searchQuery}
              onkeydown={handleKeyDown}
            />
          </div>
        </div>
        <button
          class="px-3 py-2 text-[10px] rounded-md bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-base-content/70 hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)]"
          onclick={() => (searchQuery = '')}
        >
          {$_('Reset')}
        </button>
      </div>

      {#if pinnedLanguages.length}
        <div class="section">
          <div class="section-title">{$_('Pinned')}</div>
          <div class="grid">
            {#each pinnedLanguages as lang}
              <div
                class="lang-card {selectedLanguage?.code === lang.code ? 'active' : ''}"
                onclick={() => handleSelect(lang)}
              >
                <span class="flag">{getFlagEmoji(lang.code)}</span>
                <div class="lang-meta">
                  <div class="lang-name">{lang.name}</div>
                  <div class="lang-code">{lang.code}</div>
                </div>
                <button class="pin" onclick={(e) => { e.stopPropagation(); togglePin(lang.code) }}>
                  <i class="ph-fill ph-push-pin"></i>
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if recentLanguages.length}
        <div class="section">
          <div class="section-title">{$_('Recent')}</div>
          <div class="grid">
            {#each recentLanguages as lang}
              <div
                class="lang-card {selectedLanguage?.code === lang.code ? 'active' : ''}"
                onclick={() => handleSelect(lang)}
              >
                <span class="flag">{getFlagEmoji(lang.code)}</span>
                <div class="lang-meta">
                  <div class="lang-name">{lang.name}</div>
                  <div class="lang-code">{lang.code}</div>
                </div>
                <button class="pin" onclick={(e) => { e.stopPropagation(); togglePin(lang.code) }}>
                  <i class={pinnedCodes.includes(lang.code) ? 'ph-fill ph-push-pin' : 'ph-light ph-push-pin'}></i>
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div class="section">
        <div class="section-title">{$_('All languages')}</div>
        <div class="grid max-h-[320px] overflow-y-auto pr-1">
          {#each filteredLanguages as lang}
            <div
              class="lang-card {selectedLanguage?.code === lang.code ? 'active' : ''}"
              onclick={() => handleSelect(lang)}
            >
              <span class="flag">{getFlagEmoji(lang.code)}</span>
              <div class="lang-meta">
                <div class="lang-name">{lang.name}</div>
                <div class="lang-code">{lang.code}</div>
              </div>
              <button class="pin" onclick={(e) => { e.stopPropagation(); togglePin(lang.code) }}>
                <i class={pinnedCodes.includes(lang.code) ? 'ph-fill ph-push-pin' : 'ph-light ph-push-pin'}></i>
              </button>
            </div>
          {/each}
        </div>
      </div>

      <p class="text-[10px] text-base-content/50 mt-3">
        {$_("This won't create a translation file, only translates the selected text.")}
      </p>

      <div class="flex justify-end gap-2 mt-4">
        <button
          class="px-4 py-2 text-[11px] text-base-content/70 hover:text-base-content transition-colors"
          onclick={close}
        >
          {$_('Cancel')}
        </button>
        <button
          class="px-4 py-2 bg-base-300 rounded-md text-[11px] text-base-content font-700 hover:bg-base-300/10 disabled:opacity-40"
          onclick={confirmSelection}
          disabled={!selectedLanguage}
        >
          {$_('Translate')}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  @media (max-width: 768px) {
    .modal-shell {
      align-items: flex-end;
      padding-bottom: env(safe-area-inset-bottom);
    }
    .modal-card {
      max-width: 100%;
      width: 100%;
      border-radius: 16px 16px 0 0;
    }
  }

  .section {
    margin-bottom: 16px;
  }
  .section-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 10px;
  }
  .lang-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    transition: all 0.15s ease;
    text-align: left;
  }
  .lang-card:hover {
    border-color: rgba(0, 190, 172, 0.5);
    background: rgba(0, 190, 172, 0.08);
  }
  .lang-card.active {
    border-color: rgba(0, 190, 172, 0.8);
    box-shadow: 0 0 0 1px rgba(0, 190, 172, 0.6);
  }
  .flag {
    font-size: 16px;
  }
  .lang-meta {
    flex: 1;
    min-width: 0;
  }
  .lang-name {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.9);
  }
  .lang-code {
    font-size: 9px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.4);
  }
  .pin {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }
</style>
