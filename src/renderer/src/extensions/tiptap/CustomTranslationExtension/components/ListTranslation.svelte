<script lang="ts">
  import { _ } from 'svelte-i18n'
  import ISO6391 from 'iso-639-1'
  import { fade, scale, slide } from 'svelte/transition'
  import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../../stores/editor.store'
  import { openConfirmModal } from '../../../../stores/confirmModal.store'
  import { getFlagEmoji, translateRegions } from '../utils/utils'
  import AddTranslationPicker from './AddTranslationPicker.svelte'

  // --- Props ---
  let {
    showAddPanel = $bindable(false),
    onClose = () => {},
    embedded = false,
    __closeContextMenu = () => {}
  } = $props()

  // --- Internal State ---
  let searchQuery = $state('')
  let highlightedIndex = $state(0)
  let confirmedSelection = $state(null)

  // --- Derived Data (Store Connections) ---
  const activeDocStore = _$_documentEditorsList.getActive()
  let activeDoc = $derived($activeDocStore)
  let wysiwygEntry = $derived(activeDoc ? _$_wysiwygEditorsList.getEntry(activeDoc.id) : null)

  // The actual translation assets from the file system
  // let existingTranslations = $derived(
  //   activeDoc && wysiwygEntry
  //     ? activeDoc.document.getDocumentTranslations(wysiwygEntry.filePath)
  //     : []
  // )

  let existingTranslations = $derived.by(() => {
    if (!activeDoc) return []
    return [...(activeDoc.document.documentMainFileTranslations || [])]
  })

  // --- Logic: Language Generation ---
  const allLanguages = $derived.by(() => {
    const baseCodes = ISO6391.getAllCodes()
    const list = []
    // const regions = { en: ['US', 'GB', 'CA'], fr: ['FR', 'CA'], es: ['ES', 'MX'], pt: ['PT', 'BR'] }
    const regions = translateRegions

    for (const code of baseCodes) {
      list.push({ name: ISO6391.getNativeName(code), code })
      if (regions[code]) {
        regions[code].forEach((r) => {
          const full = `${code}-${r}`
          try {
            const name = new Intl.DisplayNames([full], { type: 'language' }).of(full)
            list.push({ name: name || `${ISO6391.getNativeName(code)} (${r})`, code: full })
          } catch {
            /* skip invalid */
          }
        })
      }
    }
    return list
  })

  let filteredLanguages = $derived(
    allLanguages
      .filter(
        (l) =>
          l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.code.includes(searchQuery)
      )
      .sort((a, b) => {
        const aEx = existingTranslations.some((t) => t.language === a.code)
        const bEx = existingTranslations.some((t) => t.language === b.code)
        return aEx === bEx ? a.name.localeCompare(b.name) : aEx ? -1 : 1
      })
  )

  // --- Actions ---
  /* async function handleCreate(lang) {
    if (!activeDoc || !wysiwygEntry) return
    const editor = _$_wysiwygEditorsList.getItem(activeDoc.id)
    const content = editor ? JSON.stringify(editor.getJSON()) : ''

    await _$_documentEditorsList.findOrOpenTranslation(
      activeDoc.id,
      lang.code,
      wysiwygEntry.filePath,
      content
    )
    searchQuery = ''
    confirmedSelection = null
  } */

  async function handleDelete(path: string) {
    const confirmed = await openConfirmModal({
      title: 'Delete translation',
      message: 'Delete this translation file permanently?',
      confirmText: 'Delete',
      destructive: true
    })
    if (!confirmed) return

    // activeDoc.document.deleteTranslationFile(path)
    // await activeDoc.document.deleteTranslationFile(path)
    await _$_documentEditorsList.deleteTranslation(activeDoc.id, path)
  }

  // --- Helpers ---
  /* function getFlag(code: string) {
    const country = code.includes('-') ? code.split('-')[1] : code.toUpperCase();
    // Simplified flag logic
    return `https://purecatamphetamine.github.io/country-flag-icons/3x2/${country.slice(0,2)}.svg`;
  } */
</script>

<div
  class="bg-base-100 border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] font-sans {embedded
    ? 'w-full'
    : 'w-[600px]'}"
>
  <div
    class="p-4 bg-[color-mix(in_srgb,var(--color-base-white)_3%,transparent)] border-b border-white/10 flex items-center justify-between"
  >
    <div>
      <h2 class="text-sm font-bold text-base-content flex items-center gap-2">
        <i class="ph-fill ph-translate text-base-300"></i>
        {$_('Project Localization')}
      </h2>
      <p class="text-[10px] text-base-content/40 uppercase tracking-widest mt-0.5">
        {$_('Manage Assets & Regional Variants')}
      </p>
    </div>
    <button
      on:click={onClose}
      class="text-base-content/20 hover:text-base-content transition-colors"
    >
      <i class="ph-bold ph-x text-lg"></i>
    </button>
  </div>

  <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
    {#if existingTranslations.length === 0}
      <div class="py-12 text-center border-2 border-dashed border-white/5 rounded-lg">
        <i class="ph-light ph-files text-3xl text-base-content/10 mb-2 block"></i>
        <p class="text-xs text-base-content/30">
          {$_('No regional variants found for this document.')}
        </p>
      </div>
    {:else}
      <div class="grid gap-2">
        {#each existingTranslations as t}
          <div
            class="group flex items-center justify-between p-3 bg-[color-mix(in_srgb,var(--color-base-white)_2%,transparent)] border border-white/5 rounded-lg hover:border-base-300/30 transition-all"
          >
            <div class="flex items-center gap-4">
              <!-- <img src={getFlagEmoji(t.language)} alt="" class="w-5 rounded-sm opacity-80 group-hover:opacity-100" /> -->
              <span class="mr-2 text-sm leading-none">
                {getFlagEmoji(t.language)}
              </span>
              <div class="flex flex-col">
                <span class="text-xs font-bold text-base-content/90 uppercase tracking-tighter"
                  >{t.language}</span
                >
                <span class="text-[9px] text-base-content/30 font-mono truncate w-40">
                  {t.path.split(/[/\\]/).pop()}
                </span>
              </div>

              <div
                class="h-1 w-16 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rounded-full overflow-hidden ml-4"
              >
                <div class="h-full bg-base-300 w-[65%]"></div>
              </div>
            </div>

            <div
              class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <button
                on:click={() => {
                  _$_documentEditorsList.setActiveTranslation(activeDoc.id, t.path)
                  __closeContextMenu?.()
                }}
                class="p-2 hover:bg-base-300/20 text-base-300 rounded-md"
                title={$_('Open')}
              >
                <i class="ph-bold ph-arrow-square-out text-base"></i>
              </button>
              <button
                on:click={() => handleDelete(t.path)}
                class="p-2 hover:bg-red-500/20 text-red-400 rounded-md"
                title={$_('Delete')}
              >
                <i class="ph-bold ph-trash-simple text-base"></i>
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <AddTranslationPicker />

  <!-- <div class="p-4 bg-black/20 border-t border-white/10">
    <div class="relative">
      <i class="ph-light ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-base-content/20"
      ></i>
      <input
        type="text"
        placeholder="Search for a language to add..."
        bind:value={searchQuery}
        class="w-full bg-[#222] border border-white/10 rounded-lg py-2 pl-9 pr-4 text-xs text-base-content focus:border-base-300/50 outline-none transition-all"
      />

      {#if searchQuery.length > 0}
        <div
          transition:slide
          class="absolute bottom-full left-0 w-full bg-base-100 border border-white/10 rounded-lg mb-2 shadow-2xl max-h-48 overflow-y-auto z-50 p-1"
        >
          {#each filteredLanguages as lang}
            {@const exists = existingTranslations.some((t) => t.language === lang.code)}
            <button
              disabled={exists}
              onclick={() => handleCreate(lang)}
              class="w-full flex items-center justify-between p-2 rounded hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] disabled:opacity-30 disabled:grayscale transition-all"
            >
              <div class="flex items-center gap-2">
                <span class="mr-2 text-sm leading-none">
                {getFlagEmoji(t.language)}
              </span>
                <span class="text-xs text-base-content/80">{lang.name}</span>
              </div>
              <span class="text-[9px] font-mono text-base-content/20">{lang.code}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div> -->
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }
</style>
