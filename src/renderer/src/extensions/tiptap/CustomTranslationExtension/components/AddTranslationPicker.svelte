<script lang="ts">
  import { _ } from 'svelte-i18n'
  import ISO6391 from 'iso-639-1'
  import { fade, scale, slide } from 'svelte/transition'
  import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../../stores/editor.store'
  import { getFlagEmoji, translateRegions } from '../utils/utils'

  // --- Runes (State) ---
  let searchQuery = $state('')
  let isOpen = $state(false)
  let highlightedIndex = $state(0)
  let confirmedSelection = $state(null) // The actual item "held" in the ribbon
  let {
    __onSelectLanguage = null,
    __confirmLabel = null,
    __existingLabel = null,
    __preselectLanguageCode = null,
    __closeContextMenu = () => {}
  } = $props()

  const activeDocStore = _$_documentEditorsList.getActive()
  let activeDoc = $derived.by(() => $activeDocStore)

  let wysiwygEntry = $derived.by(() => {
    if (!activeDoc) return null
    const identity = activeDoc.id ?? activeDoc.uuid ?? null
    if (!identity) return null
    return _$_wysiwygEditorsList.getEntry(identity)
  })
  let existingTranslations = $derived.by(() => {
    if (!activeDoc) return []
    return [...(activeDoc.document.documentMainFileTranslations || [])]
  })

  const allLanguages1 = ISO6391.getAllNativeNames().map((name, i) => ({
    name,
    code: ISO6391.getAllCodes()[i]
  }))

  // Helper to get native name for a full locale (e.g., "fr-FR")
  function getFullNativeName(locale: string) {
    try {
      return new Intl.DisplayNames([locale], { type: 'language' }).of(locale)
    } catch {
      return null
    }
  }

  // Generate a list that includes specific regions for major languages
  const allLanguages = $derived.by(() => {
    const baseCodes = ISO6391.getAllCodes()
    const list = []

    for (const code of baseCodes) {
      const nativeName = ISO6391.getNativeName(code)

      // Add the generic language (e.g., "fr")
      list.push({ name: nativeName, code: code })

      // Logic: Add specific regional variants for major global languages
      /* const regions: Record<string, string[]> = {
        en: ['US', 'GB', 'CA', 'AU', 'IN', 'IE', 'NZ', 'SG'],
        fr: ['FR', 'CA', 'BE', 'CH', 'LU'],
        es: ['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'US'],
        pt: ['PT', 'BR', 'AO', 'MZ'],
        zh: ['CN', 'TW', 'HK', 'SG'],
        de: ['DE', 'AT', 'CH'],
        ar: ['SA', 'EG', 'AE'],
        it: ['IT', 'CH'],
        nl: ['NL', 'BE'],
        ja: ['JP'],
        ko: ['KR'],
        ru: ['RU'],
        hi: ['IN'],
        tr: ['TR'],
        vi: ['VN'],
        th: ['TH'],
        id: ['ID'],
        ms: ['MY', 'SG'],
        sw: ['KE', 'TZ'],
        ur: ['PK', 'IN']
      } */
      const regions = translateRegions

      if (regions[code]) {
        regions[code].forEach((region) => {
          const fullCode = `${code}-${region}`
          const regionalName = getFullNativeName(fullCode)
          list.push({
            name: regionalName || `${nativeName} (${region})`,
            code: fullCode
          })
        })
      }
    }
    return list
  })

  let filteredLanguages = $derived.by(() => {
    const query = searchQuery.toLowerCase()
    const list = allLanguages.filter(
      (l) =>
        l.name.toLowerCase().includes(query) ||
        l.code.toLowerCase() === query ||
        l.code.includes(query)
    )

    return list.sort((a, b) => {
      // ✅ FIX: Use strict equality to prevent 'en' matching 'en-US'
      const aExists = existingTranslations?.some((t) => t.language === a.code)
      const bExists = existingTranslations?.some((t) => t.language === b.code)

      if (aExists && !bExists) return -1
      if (!aExists && bExists) return 1
      return a.name.localeCompare(b.name)
    })
  })

  // ✅ FIX: Strict check for the primary action button
  let isExisting = $derived(
    confirmedSelection
      ? existingTranslations?.some((t) => t.language === confirmedSelection.code)
      : false
  )

  let didPreselect = $state(false)

  $effect(() => {
    if (didPreselect) return
    if (!__preselectLanguageCode) return
    const match =
      allLanguages.find((lang) => lang.code === __preselectLanguageCode) ||
      allLanguages.find((lang) => lang.code.startsWith(`${__preselectLanguageCode}-`))
    if (match) {
      confirmedSelection = match
      didPreselect = true
    }
  })

  async function handleFinalAction1() {
    if (!confirmedSelection) return
    const existing = existingTranslations?.find((t) => t.language === confirmedSelection.code)

    if (existing) {
      _$_documentEditorsList.setActiveTranslation(activeDoc.id, existing.path)
    } else {
      const editor = _$_wysiwygEditorsList.getItem(activeDoc.id)
      if (editor && wysiwygEntry) {
        await activeDoc.document.createTranslationFile(
          wysiwygEntry.filePath,
          confirmedSelection.code,
          JSON.stringify(editor.getJSON())
        )
        // add the neew tranlation to _$_documentEditorsList.tranlation list
        //setActiveTranslation
        // ...
      }
    }
    // Reset after action
    confirmedSelection = null
    searchQuery = ''
    isOpen = false
  }

  async function handleFinalAction(lang: { name: string; code: string }) {
    // console.log('handleFinalAction Final action for:', lang)
    if (typeof __onSelectLanguage === 'function') {
      await __onSelectLanguage(lang)
      confirmedSelection = null
      searchQuery = ''
      isOpen = false
      __closeContextMenu?.()
      return
    }

    const currentDoc = _$_documentEditorsList.getActiveSync() ?? activeDoc
    const identity = currentDoc?.document?.uuid ?? currentDoc?.id ?? currentDoc?.uuid ?? null
    const currentWysiwygEntry = _$_wysiwygEditorsList.getActiveEntry()
    // const currentWysiwygEntry = identity ? _$_wysiwygEditorsList.getEntry(identity) : null
    // console.log('handleFinalAction ye eeeer:', { lang, activeDoc: currentDoc,identity,currentWysiwygEntry})
    if (!currentWysiwygEntry) return
    // if (!currentDoc || !currentWysiwygEntry || !identity) return

    // console.log('handleFinalAction yes for:', { lang, activeDoc: currentDoc })

    const editor = _$_wysiwygEditorsList.getItem(identity)
    const content = editor ? JSON.stringify(editor.getJSON()) : ''
    console.log('handleFinalAction fater for:', {
      activeDoc: currentDoc,
      identity,
      currentWysiwygEntry,
      content
    })

    // This will now:
    // 1. Create file
    // 2. Update DocumentModel array
    // 3. Trigger Svelte store reactivity
    // 4. Call setActiveTranslation to open the new tab
    if (identity) {
      _$_documentEditorsList.setActive(identity)
    }
    await _$_documentEditorsList.findOrOpenTranslation(
      identity,
      lang.code,
      currentWysiwygEntry.filePath,
      content
    )

    isOpen = false
  }

  function selectItem(lang) {
    confirmedSelection = lang
    isOpen = false
    searchQuery = ''
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      highlightedIndex = (highlightedIndex + 1) % filteredLanguages.length
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      highlightedIndex =
        (highlightedIndex - 1 + filteredLanguages.length) % filteredLanguages.length
    }
    if (e.key === 'Enter') {
      if (isOpen) selectItem(filteredLanguages[highlightedIndex])
      else handleFinalAction(filteredLanguages[highlightedIndex])
    }
    if (e.key === 'Escape') isOpen = false
  }
</script>

<div class="adobe-ribbon-group flex items-center gap-1 font-sans">
  <div
    class="relative flex items-center bg-[#222] border border-white/10 rounded-md w-full h-8 transition-all focus-within:border-base-300/50 {confirmedSelection
      ? 'pr-1'
      : ''}"
  >
    <div class="px-2 text-base-content/30">
      <i class="ph-light ph-translate text-sm"></i>
    </div>

    {#if confirmedSelection}
      <div
        in:fade={{ duration: 100 }}
        class="flex items-center gap-2 bg-base-300/10 border border-base-300/30 px-2 py-0.5 rounded mr-1"
      >
        <span class="text-[10px] font-black text-base-300 uppercase">{confirmedSelection.code}</span
        >
        <span class="text-[11px] text-base-content/90 font-medium">{confirmedSelection.name}</span>
        <button
          onclick={() => (confirmedSelection = null)}
          class="hover:text-base-content text-base-content/30 transition-colors"
        >
          <i class="ph-light ph-x-circle text-[12px]"></i>
        </button>
      </div>
    {:else}
      <input
        type="text"
        placeholder={$_('Select Language...')}
        bind:value={searchQuery}
        onfocus={() => (isOpen = true)}
        onkeydown={handleKeyDown}
        class="bg-transparent border-none text-[11px] text-base-content outline-none w-full placeholder:text-base-content/20"
      />
    {/if}

    <button
      onclick={() => (isOpen = !isOpen)}
      class="px-2 h-full border-l border-white/5 hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-base-content/30"
    >
      <i
        class="ph-light ph-caret-down text-[10px] {isOpen ? 'rotate-180' : ''} transition-transform"
      ></i>
    </button>

    {#if isOpen && filteredLanguages.length > 0}
      <div
        transition:slide={{ duration: 150 }}
        class="fixed top-full left-0 mt-1 w-full bg-base-200 border border-white/10 rounded-lg shadow-2xl z-[100] overflow-hidden"
      >
        <div class="max-h-60 overflow-y-auto py-1 custom-scrollbar">
          {#each filteredLanguages as lang, i}
            {@const exists = existingTranslations?.some((t) => t.language === lang.code)}

            <button
              class="w-full flex items-center justify-between px-3 py-2 {i === highlightedIndex
                ? 'bg-base-300/20'
                : 'hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)]'}"
              onclick={() => selectItem(lang)}
            >
              <div class="flex items-center gap-2">
                <span class="mr-2 text-sm leading-none">
                  {getFlagEmoji(lang.code)}
                </span>
                <span
                  class="text-[9px] font-black text-base-content/40 uppercase w-10 text-center bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] py-0.5 rounded"
                >
                  {lang.code}
                </span>
                <span
                  class="text-[11px] {i === highlightedIndex
                    ? 'text-base-300'
                    : 'text-base-content/80'}"
                >
                  {lang.name}
                </span>
              </div>

              {#if exists}
                <div class="flex items-center gap-1.5" in:fade>
                  <span class="text-[8px] text-base-300 font-bold uppercase tracking-widest"
                    >{$_('Active')}</span
                  >
                  <div
                    class="w-1.5 h-1.5 rounded-full bg-base-300 shadow-[0_0_8px_var(--color-base-300)]"
                  ></div>
                </div>
              {/if}
            </button>
          {/each}
          {#if false}
            {#each filteredLanguages as lang, i}
              {@const exists = existingTranslations?.some((t) => t.language === lang.code)}
              <button
                class="w-full flex items-center justify-between px-3 py-2 transition-colors {i ===
                highlightedIndex
                  ? 'bg-base-300/20'
                  : 'hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)]'}"
                onmouseenter={() => (highlightedIndex = i)}
                onclick={() => selectItem(lang)}
              >
                <!-- <div class="flex items-center gap-2">
                <span class="text-[9px] font-black text-base-content/20 uppercase w-6">{lang.code}</span>
                <span
                  class="text-[11px] {i === highlightedIndex ? 'text-base-300' : 'text-base-content/80'}"
                  >{lang.name}</span
                >
              </div>
              {#if exists}
                <div class="w-1.5 h-1.5 rounded-full bg-base-300 shadow-[0_0_8px_var(--color-base-300)]"></div>
              {/if} -->

                <div class="flex items-center gap-2">
                  <span class="text-[9px] font-black text-base-content/20 uppercase w-10"
                    >{lang.code}</span
                  >
                  <span
                    class="text-[11px] {i === highlightedIndex
                      ? 'text-base-300'
                      : 'text-base-content/80'}"
                  >
                    {lang.name}
                  </span>
                </div>
                {#if exists}
                  <div class="flex items-center gap-1.5">
                    <span class="text-[8px] text-base-300/50 font-bold uppercase"
                      >{$_('Stored')}</span
                    >
                    <div
                      class="w-1.5 h-1.5 rounded-full bg-base-300 shadow-[0_0_8px_var(--color-base-300)]"
                    ></div>
                  </div>
                {/if}
              </button>
            {/each}
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if confirmedSelection}
    <button
      transition:scale={{ duration: 150, start: 0.9 }}
      onclick={() => handleFinalAction(confirmedSelection)}
      class="h-8 px-4 bg-base-300 hover:bg-base-300/90 text-[#141414] rounded-md text-[10px] font-black uppercase tracking-tight shadow-lg shadow-base-300/10 active:scale-95 transition-all"
    >
      {isExisting
        ? (__existingLabel ?? 'Open Translation')
        : (__confirmLabel ?? 'Confirm & Create')}
    </button>
  {/if}
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }

  .adobe-ribbon-group {
    /* Prevent ribbon height jitter */
    min-height: 32px;
  }
</style>
