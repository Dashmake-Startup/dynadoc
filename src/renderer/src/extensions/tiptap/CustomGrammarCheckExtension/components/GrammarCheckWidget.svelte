<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'
  import type { Editor } from '@tiptap/core'
  import { CustomGrammarCheckExtensionProps } from '../utils/common.utils'
  import { openGrammarSettingsModal } from '../../../../stores/grammarSettingsModal.store'

  const { editor } = $props<{ editor: Editor | null }>()

  // State
  let isRunning = $state(false)
  let progress = $state(0)
  let errorCount = $state(0)
  let lastError = $state('')

  // Settings state
  let spellingEnabled = $state(true)
  let grammarEnabled = $state(true)
  let grammarRules = $state({
    clarity: true,
    conciseness: true,
    punctuation: true,
    vocabulary: true
  })

  // Dictionary state
  let customDictionary = $state<string[]>([])
  let newWord = $state('')
  let ignoredWords = $state<string[]>([])

  // Language state
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

  const updateStatus = () => {
    if (!editor) return
    const storage = editor.storage[CustomGrammarCheckExtensionProps.name]
    if (!storage) return

    const status = storage?.status || { running: false, progress: 0, lastError: '' }
    isRunning = !!status.running
    progress = typeof status.progress === 'number' ? Math.round(status.progress * 100) : 0
    lastError = typeof status.lastError === 'string' ? status.lastError : ''

    // Count total errors
    let totalErrors = 0
    if (storage.matches && storage.matches instanceof Map) {
      for (const matches of storage.matches.values()) {
        if (Array.isArray(matches)) {
          const ignored = storage.ignoredMatchKeys || new Set()
          totalErrors += matches.filter((m: any) => !ignored.has(m.matchKey)).length
        }
      }
    }
    errorCount = totalErrors
  }

  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('grammar-checker-settings')
      if (saved) {
        const settings = JSON.parse(saved)
        spellingEnabled = settings.spellingEnabled ?? true
        grammarEnabled = settings.grammarEnabled ?? true
        grammarRules = settings.grammarRules ?? grammarRules
        customDictionary = settings.customDictionary ?? []
        ignoredWords = settings.ignoredWords ?? []
        autoDetectLanguage = settings.autoDetectLanguage ?? false
        selectedLanguage = settings.selectedLanguage ?? 'en-US'
      }
    } catch (e) {
      console.warn('Failed to load grammar settings:', e)
    }
  }

  const saveSettings = () => {
    try {
      localStorage.setItem('grammar-checker-settings', JSON.stringify({
        spellingEnabled,
        grammarEnabled,
        grammarRules,
        customDictionary,
        ignoredWords,
        autoDetectLanguage,
        selectedLanguage
      }))
      // Dispatch event to update extension
      window.dispatchEvent(new CustomEvent('dynadoc:grammar-settings-updated', {
        detail: {
          spellingEnabled,
          grammarEnabled,
          grammarRules,
          selectedLanguage
        }
      }))
    } catch (e) {
      console.warn('Failed to save grammar settings:', e)
    }
  }

  const toggleSpelling = () => {
    spellingEnabled = !spellingEnabled
    saveSettings()
  }

  const toggleGrammar = () => {
    grammarEnabled = !grammarEnabled
    saveSettings()
  }

  const toggleRule = (rule: keyof typeof grammarRules) => {
    grammarRules[rule] = !grammarRules[rule]
    saveSettings()
  }

  const addToDictionary = () => {
    const word = newWord.trim()
    if (word && !customDictionary.includes(word)) {
      customDictionary = [...customDictionary, word]
      saveSettings()
      newWord = ''
    }
  }

  const removeFromDictionary = (word: string) => {
    customDictionary = customDictionary.filter(w => w !== word)
    saveSettings()
  }

  const ignoreWord = (word: string) => {
    if (word && !ignoredWords.includes(word)) {
      ignoredWords = [...ignoredWords, word]
      saveSettings()
    }
  }

  const unignoreWord = (word: string) => {
    ignoredWords = ignoredWords.filter(w => w !== word)
    saveSettings()
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
      saveSettings()
    }
  }

  const hideErrors = () => {
    if (editor) {
      const storage = editor.storage[CustomGrammarCheckExtensionProps.name]
      if (storage) {
        storage.settings = { ...storage.settings, visibilityHidden: true }
        editor.view.dispatch(editor.state.tr.setMeta('ltUpdate', true))
      }
    }
  }

  const showErrors = () => {
    if (editor) {
      const storage = editor.storage[CustomGrammarCheckExtensionProps.name]
      if (storage) {
        storage.settings = { ...storage.settings, visibilityHidden: false }
        editor.view.dispatch(editor.state.tr.setMeta('ltUpdate', true))
      }
    }
  }

  let unsubscribe: (() => void) | null = null
  onMount(() => {
    loadSettings()
    updateStatus()
    if (!editor) return
    const handler = () => {
      updateStatus()
    }
    editor.on('transaction', handler)
    editor.on('selectionUpdate', handler)
    unsubscribe = () => {
      editor.off('transaction', handler)
      editor.off('selectionUpdate', handler)
    }
  })

  onDestroy(() => {
    unsubscribe?.()
  })
</script>

<!-- Status Bar Widget -->
<div class="grammar-check-widget">
  <button
    onclick={() => openGrammarSettingsModal('overview')}
    class="grammar-status-button"
    title={$_('Grammar & Spelling Checker')}
  >
    <div class="grammar-check-icon">
      {#if isRunning}
        <i class="i-ph-circle-notch-bold animate-spin text-base-content/60"></i>
      {:else if errorCount > 0}
        <i class="i-ph-warning-circle-bold text-amber-500"></i>
      {:else}
        <i class="i-ph-check-circle-bold text-emerald-500"></i>
      {/if}
    </div>

    <div class="grammar-check-info">
      {#if isRunning}
        <span class="text-[11px] font-medium text-base-content/60">
          {$_('Grammar Check')} {progress}%
        </span>
      {:else if errorCount > 0}
        <span class="text-[11px] font-medium text-amber-600">
          {errorCount} {errorCount === 1 ? $_('error') : $_('errors')}
        </span>
      {:else}
        <span class="text-[11px] font-medium text-emerald-600">
          {$_('No errors')}
        </span>
      {/if}
    </div>

    {#if isRunning}
      <div class="grammar-check-progress-bar">
        <div class="progress-fill" style="width: {progress}%"></div>
      </div>
    {/if}
  </button>
</div>

<style lang="postcss">
  .grammar-check-widget {
    @apply relative;
  }

  .grammar-status-button {
    @apply flex items-center gap-2 px-3 py-2 text-[var(--color-base-content)]/70 cursor-pointer transition-all hover:bg-[var(--color-base-100)]/5 rounded-md;
  }

  .grammar-check-icon {
    @apply flex items-center justify-center text-base;
  }

  .grammar-check-info {
    @apply text-[11px] font-medium;
  }

  .grammar-check-progress-bar {
    @apply absolute bottom-0 left-0 w-full h-0.5 bg-[var(--color-base-100)]/10 rounded-full overflow-hidden;
  }

  .progress-fill {
    @apply h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300;
  }
</style>

