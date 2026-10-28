<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import {
    _$_grammarSettingsModal,
    type GrammarSettingsTabId
  } from '../../../../stores/grammarSettingsModal.store'

  const modal = _$_grammarSettingsModal

  let spellingEnabled = $state(true)
  let grammarEnabled = $state(true)
  let grammarRules = $state({
    clarity: true,
    conciseness: true,
    punctuation: true,
    vocabulary: true
  })
  let customDictionary = $state<string[]>([])
  let newWord = $state('')
  let ignoredWords = $state<string[]>([])
  let autoDetectLanguage = $state(false)
  let selectedLanguage = $state('en-US')
  let supportedLanguages = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (GB)' },
    { code: 'en-CA', name: 'English (Canadian)' },
    { code: 'en-AU', name: 'English (Australian)' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'es', name: 'Español' }
  ]

  const tabs: { id: GrammarSettingsTabId; label: string; hint: string }[] = [
    { id: 'overview', label: 'Overview', hint: 'Current status and quick actions' },
    { id: 'settings', label: 'Settings', hint: 'Toggle grammar and spell checking options' },
    { id: 'dictionary', label: 'Dictionary', hint: 'Manage custom and ignored words' },
    { id: 'language', label: 'Language', hint: 'Proofing language preferences' }
  ]

  const close = () => modal.close()

  const safeLoad = () => {
    try {
      const saved = localStorage.getItem('grammar-checker-settings')
      if (!saved) return
      const settings = JSON.parse(saved)
      spellingEnabled = settings.spellingEnabled ?? true
      grammarEnabled = settings.grammarEnabled ?? true
      grammarRules = settings.grammarRules ?? grammarRules
      customDictionary = settings.customDictionary ?? []
      ignoredWords = settings.ignoredWords ?? []
      autoDetectLanguage = settings.autoDetectLanguage ?? false
      selectedLanguage = settings.selectedLanguage ?? 'en-US'
    } catch (error) {
      console.warn('Failed to load grammar settings:', error)
    }
  }

  const safeSave = () => {
    try {
      localStorage.setItem(
        'grammar-checker-settings',
        JSON.stringify({
          spellingEnabled,
          grammarEnabled,
          grammarRules,
          customDictionary,
          ignoredWords,
          autoDetectLanguage,
          selectedLanguage
        })
      )
      window.dispatchEvent(
        new CustomEvent('dynadoc:grammar-settings-updated', {
          detail: {
            spellingEnabled,
            grammarEnabled,
            grammarRules,
            selectedLanguage
          }
        })
      )
    } catch (error) {
      console.warn('Failed to save grammar settings:', error)
    }
  }

  const toggleSpelling = () => {
    spellingEnabled = !spellingEnabled
    safeSave()
  }

  const toggleGrammar = () => {
    grammarEnabled = !grammarEnabled
    safeSave()
  }

  const toggleRule = (rule: keyof typeof grammarRules) => {
    grammarRules[rule] = !grammarRules[rule]
    safeSave()
  }

  const addToDictionary = () => {
    const word = newWord.trim()
    if (word && !customDictionary.includes(word)) {
      customDictionary = [...customDictionary, word]
      safeSave()
      newWord = ''
    }
  }

  const removeFromDictionary = (word: string) => {
    customDictionary = customDictionary.filter((w) => w !== word)
    safeSave()
  }

  const ignoreWord = (word: string) => {
    if (word && !ignoredWords.includes(word)) {
      ignoredWords = [...ignoredWords, word]
      safeSave()
    }
  }

  const unignoreWord = (word: string) => {
    ignoredWords = ignoredWords.filter((w) => w !== word)
    safeSave()
  }

  const resetSettings = () => {
    if (confirm($_('Reset all grammar settings to default?'))) {
      spellingEnabled = true
      grammarEnabled = true
      grammarRules = { clarity: true, conciseness: true, punctuation: true, vocabulary: true }
      customDictionary = []
      ignoredWords = []
      autoDetectLanguage = false
      selectedLanguage = 'en-US'
      safeSave()
    }
  }

  const onBackdropClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) close()
  }

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  onMount(() => {
    safeLoad()
  })
</script>

{#if $modal.open}
  <div
    class="modal-shell fixed inset-0 z-[1190] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6"
    onclick={onBackdropClick}
    onkeydown={onKeydown}
    role="dialog"
    aria-modal="true"
    aria-label={$_('Grammar settings')}
  >
    <div
      class="modal-card w-full max-w-[760px] rounded-xl bg-base-100 border border-base-content/10 shadow-xl overflow-hidden"
    >
      <header
        class="modal-header flex items-start justify-between gap-4 p-6 border-b border-base-content/10"
      >
        <div>
          <p class="eyebrow text-xs uppercase tracking-[0.24em] text-base-content/50">
            {$_('Proofing')}
          </p>
          <h2 class="text-xl font-semibold text-base-content">
            {$_('Spelling & Grammar Settings')}
          </h2>
          <p class="mt-2 text-sm text-base-content/70">
            {$_('Manage grammar and spelling options in a global modal, just like MS Word.')}
          </p>
        </div>
        <button
          class="close-button rounded-lg p-2 text-base-content/70 hover:bg-base-content/5"
          onclick={close}
          aria-label={$_('Close grammar settings')}
        >
          <i class="ph-bold ph-x"></i>
        </button>
      </header>

      <div class="modal-body flex min-h-[400px]">
        <aside class="modal-sidebar w-[220px] border-r border-base-content/10 bg-base-200/50 p-4">
          {#each tabs as tab}
            <button
              class="sidebar-tab w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors"
              class:selected={$modal.activeTab === tab.id}
              onclick={() => modal.setActiveTab(tab.id)}
            >
              <div>{$_(tab.label)}</div>
              <p class="mt-1 text-xs text-base-content/60">{$_(tab.hint)}</p>
            </button>
          {/each}
        </aside>

        <section class="modal-content flex-1 p-6 overflow-y-auto">
          {#if $modal.activeTab === 'overview'}
            <div class="space-y-4">
              <div class="status-card rounded-xl border border-base-content/10 bg-base-100 p-4">
                <h3 class="text-lg font-semibold text-base-content">{$_('Overview')}</h3>
                <p class="mt-2 text-sm text-base-content/70">
                  {$_('Check the current proofing state and open quick actions.')}
                </p>
                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                  <div class="rounded-xl border border-base-content/10 bg-base-200 p-4">
                    <p class="text-xs uppercase tracking-[0.18em] text-base-content/50">
                      {$_('Spelling')}
                    </p>
                    <p class="mt-2 text-base font-semibold text-base-content">
                      {spellingEnabled ? $_('Enabled') : $_('Disabled')}
                    </p>
                  </div>
                  <div class="rounded-xl border border-base-content/10 bg-base-200 p-4">
                    <p class="text-xs uppercase tracking-[0.18em] text-base-content/50">
                      {$_('Grammar')}
                    </p>
                    <p class="mt-2 text-base font-semibold text-base-content">
                      {grammarEnabled ? $_('Enabled') : $_('Disabled')}
                    </p>
                  </div>
                  <div class="rounded-xl border border-base-content/10 bg-base-200 p-4">
                    <p class="text-xs uppercase tracking-[0.18em] text-base-content/50">
                      {$_('Language')}
                    </p>
                    <p class="mt-2 text-base font-semibold text-base-content">
                      {supportedLanguages.find((lang) => lang.code === selectedLanguage)?.name}
                    </p>
                  </div>
                  <div class="rounded-xl border border-base-content/10 bg-base-200 p-4">
                    <p class="text-xs uppercase tracking-[0.18em] text-base-content/50">
                      {$_('Dictionary')}
                    </p>
                    <p class="mt-2 text-base font-semibold text-base-content">
                      {customDictionary.length}
                      {$_('custom words')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          {:else if $modal.activeTab === 'settings'}
            <div class="space-y-5">
              <div class="setting-card rounded-xl border border-base-content/10 bg-base-100 p-5">
                <label class="setting-toggle flex items-center gap-3">
                  <input type="checkbox" checked={spellingEnabled} onchange={toggleSpelling} />
                  <span class="text-sm font-medium text-base-content">{$_('Spelling checker')}</span
                  >
                </label>
                <p class="mt-2 text-sm text-base-content/60">
                  {$_('Enable automatic underlines for spelling issues.')}
                </p>
              </div>

              <div class="setting-card rounded-xl border border-base-content/10 bg-base-100 p-5">
                <label class="setting-toggle flex items-center gap-3">
                  <input type="checkbox" checked={grammarEnabled} onchange={toggleGrammar} />
                  <span class="text-sm font-medium text-base-content">{$_('Grammar checker')}</span>
                </label>
                <p class="mt-2 text-sm text-base-content/60">
                  {$_('Enable automatic grammar suggestions and rule checks.')}
                </p>
              </div>

              {#if grammarEnabled}
                <div class="setting-card rounded-xl border border-base-content/10 bg-base-100 p-5">
                  <h4 class="text-sm font-semibold text-base-content">
                    {$_('Grammar rule categories')}
                  </h4>
                  <div class="mt-4 grid gap-3 md:grid-cols-2">
                    {#each Object.keys(grammarRules) as rule}
                      <label
                        class="flex items-center gap-3 rounded-xl border border-base-content/10 bg-base-200 p-3"
                      >
                        <input
                          type="checkbox"
                          checked={grammarRules[rule as keyof typeof grammarRules]}
                          onchange={() => toggleRule(rule as keyof typeof grammarRules)}
                        />
                        <span class="text-sm text-base-content capitalize">{$_(rule)}</span>
                      </label>
                    {/each}
                  </div>
                </div>
              {/if}

              <button class="action-btn danger" onclick={resetSettings}>
                <i class="ph-light ph-arrow-counter-clockwise"></i>
                {$_('Reset to default')}
              </button>
            </div>
          {:else if $modal.activeTab === 'dictionary'}
            <div class="space-y-5">
              <div class="rounded-xl border border-base-content/10 bg-base-100 p-5">
                <h3 class="text-base font-semibold text-base-content">{$_('Add to dictionary')}</h3>
                <div class="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    class="input-field flex-1 rounded-xl border border-base-content/10 bg-base-200 px-4 py-3"
                    placeholder={$_('Enter word...')}
                    bind:value={newWord}
                    onkeydown={(event) => event.key === 'Enter' && addToDictionary()}
                  />
                  <button class="action-btn primary" onclick={addToDictionary}>
                    <i class="ph-light ph-plus"></i>
                    {$_('Add')}
                  </button>
                </div>
              </div>

              {#if customDictionary.length > 0}
                <div class="rounded-xl border border-base-content/10 bg-base-100 p-5">
                  <h3 class="text-base font-semibold text-base-content">
                    {$_('Custom dictionary')}
                  </h3>
                  <div class="mt-3 space-y-2">
                    {#each customDictionary as word}
                      <div
                        class="flex items-center justify-between gap-3 rounded-xl border border-base-content/10 bg-base-200 px-4 py-3"
                      >
                        <span>{word}</span>
                        <button
                          class="text-base-content/70 hover:text-base-content"
                          onclick={() => removeFromDictionary(word)}
                        >
                          <i class="ph-light ph-x"></i>
                        </button>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if ignoredWords.length > 0}
                <div class="rounded-xl border border-base-content/10 bg-base-100 p-5">
                  <h3 class="text-base font-semibold text-base-content">{$_('Ignored words')}</h3>
                  <div class="mt-3 space-y-2">
                    {#each ignoredWords as word}
                      <div
                        class="flex items-center justify-between gap-3 rounded-xl border border-base-content/10 bg-base-200 px-4 py-3"
                      >
                        <span>{word}</span>
                        <button
                          class="text-base-content/70 hover:text-base-content"
                          onclick={() => unignoreWord(word)}
                        >
                          <i class="ph-light ph-x"></i>
                        </button>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {:else if $modal.activeTab === 'language'}
            <div class="space-y-5">
              <div class="rounded-xl border border-base-content/10 bg-base-100 p-5">
                <label class="setting-toggle flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={autoDetectLanguage}
                    onchange={() => {
                      autoDetectLanguage = !autoDetectLanguage
                      safeSave()
                    }}
                  />
                  <span class="text-sm font-medium text-base-content"
                    >{$_('Auto-detect language')}</span
                  >
                </label>
                <p class="mt-2 text-sm text-base-content/60">
                  {$_(
                    'Use browser language settings when multiple authoring languages are available.'
                  )}
                </p>
              </div>

              {#if !autoDetectLanguage}
                <div class="rounded-xl border border-base-content/10 bg-base-100 p-5">
                  <label
                    class="block text-sm font-medium text-base-content mb-2"
                    for="proofing-language-select">{$_('Proofing language')}</label
                  >
                  <select
                    id="proofing-language-select"
                    class="select-field w-full rounded-xl border border-base-content/10 bg-base-200 px-4 py-3"
                    bind:value={selectedLanguage}
                    onchange={safeSave}
                  >
                    {#each supportedLanguages as lang}
                      <option value={lang.code}>{lang.name}</option>
                    {/each}
                  </select>
                </div>
              {/if}

              <div class="rounded-xl border border-base-content/10 bg-base-100 p-5">
                <p class="text-sm text-base-content/70">
                  {$_('Current language')}:
                  <strong
                    >{supportedLanguages.find((lang) => lang.code === selectedLanguage)
                      ?.name}</strong
                  >
                </p>
                <p class="mt-2 text-sm text-base-content/70">
                  {$_('The selected proofing language is used for spelling and grammar checks.')}
                </p>
              </div>
            </div>
          {/if}
        </section>
      </div>

      <footer
        class="modal-footer flex items-center justify-end gap-3 border-t border-base-content/10 p-5 bg-base-200/50"
      >
        <button class="action-btn secondary" onclick={close}>{$_('Done')}</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .sidebar-tab {
    @apply mb-2 rounded-xl px-4 py-4 text-left transition-colors;
  }
  .sidebar-tab.selected {
    @apply bg-[var(--color-base-100)] border border-primary text-primary;
  }
  .modal-header {
    @apply items-start;
  }
  .setting-toggle input {
    @apply h-4 w-4 rounded border-[var(--color-base-content)]/20 bg-[var(--color-base-100)];
  }
  .action-btn {
    @apply inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90;
  }
  .action-btn.primary {
    @apply bg-blue-600;
  }
  .action-btn.secondary {
    @apply bg-[var(--color-base-200)] text-[var(--color-base-content)];
  }
  .action-btn.danger {
    @apply bg-amber-600;
  }
  .input-field,
  .select-field {
    @apply w-full rounded-xl border border-[var(--color-base-content)]/10 bg-[var(--color-base-100)] px-4 py-3;
  }
</style>
