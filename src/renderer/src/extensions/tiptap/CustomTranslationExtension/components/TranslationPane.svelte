<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../../stores/editor.store'
  import { _$_activeSecondarySidebarItem } from '../../../../stores/common.store'
  import ListTranslation from './ListTranslation.svelte'
  import { runAIWithResult } from '../../CustomAIExtension/utils/utils'
  import { getTranslationLanguages, getTranslationLanguageName } from '../utils/utils'
  import { onMount } from 'svelte'
  import { CustomVarExtensionProps } from '../../CustomVarExtension/utils/common.utils'
  import { getVariable } from '../../CustomVarExtension/stores/variableManipulator'
  import EditorCommonUtils from '../../../../utils/common.utils'

  let activeTab = $state<'translate' | 'files'>('translate')

  let sourceText = $state('')
  let targetText = $state('')
  let sourceLang = $state('auto')
  let targetLang = $state('en')
  let isTranslating = $state(false)
  let translateError = $state('')
  let autoTranslateEnabled = $state(false)
  // let autoTranslateEnabled = $state(true)
  let lastAutoSource = $state('')
  let manualEdit = $state(false)
  let settingsOpen = $state(false)
  let insertMode = $state<'replace' | 'append'>('replace')
  let history = $state<
    {
      key: string
      source: string
      target: string
      sourceLang: string
      targetLang: string
      at: number
    }[]
  >([])
  let pinnedKeys = $state<string[]>([])

  const cache = new Map<string, string>()

  const activeDocStore = _$_documentEditorsList.getActive()
  let activeDoc = $derived($activeDocStore)
  const getEditorInstance = () => {
    if (!activeDoc) return null
    if (activeDoc.editor) return activeDoc.editor
    const activeEntry = _$_wysiwygEditorsList.getActiveEntry?.()
    if (activeEntry?.editor) return activeEntry.editor
    if (activeEntry?.editorInstance) return activeEntry.editorInstance
    if (activeEntry?.tiptap) return activeEntry.tiptap
    const activeSync = _$_wysiwygEditorsList.getActiveSync?.()
    if (activeSync?.editor) return activeSync.editor
    const identity = activeDoc.id ?? activeDoc.uuid ?? null
    if (!identity) return null
    const entry = _$_wysiwygEditorsList.getItem(identity)
    return entry?.editor || entry?.editorInstance || entry?.tiptap || entry || null
  }
  let selectionRange = $state<{ from: number; to: number } | null>(null)
  const languages = $derived(getTranslationLanguages())
  const activePane = $derived($_$_activeSecondarySidebarItem)

  const getDocKey = () => {
    const doc = activeDoc?.document
    return doc?.uuid || doc?.path || activeDoc?.id || 'global'
  }

  const HISTORY_KEY = (key: string) => `translation:history:${key}`
  const CACHE_KEY = (key: string) => `translation:cache:${key}`
  const PIN_KEY = (key: string) => `translation:pins:${key}`

  const loadLastTargetLang = () => {
    const key = getDocKey()
    const stored = localStorage.getItem(`translation:lastTarget:${key}`)
    if (stored) targetLang = stored
  }

  const saveLastTargetLang = () => {
    const key = getDocKey()
    if (!key) return
    localStorage.setItem(`translation:lastTarget:${key}`, targetLang)
  }

  $effect(() => {
    if (!activeDoc) return
    loadLastTargetLang()
    const key = getDocKey()
    try {
      const rawHistory = localStorage.getItem(HISTORY_KEY(key))
      if (rawHistory) history = JSON.parse(rawHistory) || []
      const rawPins = localStorage.getItem(PIN_KEY(key))
      if (rawPins) pinnedKeys = JSON.parse(rawPins) || []
      const rawCache = localStorage.getItem(CACHE_KEY(key))
      if (rawCache) {
        const entries = JSON.parse(rawCache) as [string, string][]
        if (Array.isArray(entries)) {
          cache.clear()
          entries.forEach(([k, v]) => {
            if (k && typeof v === 'string') cache.set(k, v)
          })
        }
      }
    } catch {
      // ignore
    }
  })

  const persistState = () => {
    if (!activeDoc) return
    saveLastTargetLang()
    const key = getDocKey()
    try {
      localStorage.setItem(HISTORY_KEY(key), JSON.stringify(history))
      localStorage.setItem(PIN_KEY(key), JSON.stringify(pinnedKeys))
      const cacheEntries = Array.from(cache.entries()).slice(-50)
      localStorage.setItem(CACHE_KEY(key), JSON.stringify(cacheEntries))
    } catch {
      // ignore
    }
  }

  let autoTimer: any
  const scheduleAutoTranslate = () => {
    if (!autoTranslateEnabled) return
    if (autoTimer) clearTimeout(autoTimer)
    autoTimer = setTimeout(() => {
      handleTranslate(true)
    }, 350)
  }

  const buildCacheKey = (text: string, source: string, target: string) => {
    const docKey = getDocKey()
    return `${docKey}::${source}::${target}::${text}`
  }

  const buildHistoryKey = (source: string, target: string, from: string, to: string) =>
    `${from}::${to}::${source}::${target}`

  const addHistory = (source: string, target: string, from: string, to: string) => {
    const key = buildHistoryKey(source, target, from, to)
    const entry = { key, source, target, sourceLang: from, targetLang: to, at: Date.now() }
    const filtered = history.filter((h) => h.key !== key)
    const pinned = filtered.filter((h) => pinnedKeys.includes(h.key))
    const others = filtered.filter((h) => !pinnedKeys.includes(h.key))
    history = [entry, ...pinned, ...others].slice(0, 30)
    persistState()
  }

  const resolveVariableText = (node: any) => {
    const name =
      node?.attrs?.[CustomVarExtensionProps.tagAttributeName] ||
      node?.attrs?.name ||
      node?.attrs?.variable
    if (!name) return ''
    const resolved = getVariable(name, activeDoc?.document || activeDoc)
    if (resolved === null || resolved === undefined) return ''
    if (typeof resolved === 'string' || typeof resolved === 'number' || typeof resolved === 'boolean') {
      return String(resolved)
    }
    if (typeof resolved === 'object') {
      if ('url' in resolved && resolved.url) return String(resolved.url)
      if ('path' in resolved && resolved.path) return String(resolved.path)
      if ('value' in resolved && resolved.value) return String(resolved.value)
      return JSON.stringify(resolved)
    }
    return ''
  }

  const selectionToText = (editorOverride?: any) => {
    const editor = editorOverride || getEditorInstance()
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from === to) {
      selectionRange = null
      return
    }
    const selected = editor.state.doc.textBetween(from, to, ' ', (node) => {
      if (node?.type?.name === CustomVarExtensionProps.name) {
        return resolveVariableText(node)
      }
      return undefined
    })
    if (!selected) return
    if (manualEdit && selected.trim() === sourceText.trim()) return
    sourceText = selected
    selectionRange = { from, to }
    manualEdit = false
    if (autoTranslateEnabled) scheduleAutoTranslate()
  }

  let boundEditor: any = null
  let boundHandler: any = null
  let bindRetryTimer: any = null
  const bindToEditor = (editor: any) => {
    if (!editor) return
    if (boundEditor && boundEditor !== editor) {
      if (boundHandler) {
        boundEditor.off('selectionUpdate', boundHandler)
        boundEditor.off('transaction', boundHandler)
        boundEditor.off('focus', boundHandler)
      }
      boundEditor = null
      boundHandler = null
    }
    if (!boundEditor) {
      boundEditor = editor
      boundHandler = () => selectionToText(editor)
      editor.on('selectionUpdate', boundHandler)
      editor.on('transaction', boundHandler)
      editor.on('focus', boundHandler)
      requestAnimationFrame(() => selectionToText(editor))
    }
  }

  $effect(() => {
    activeDoc
    const editor = getEditorInstance()
    if (bindRetryTimer) {
      clearTimeout(bindRetryTimer)
      bindRetryTimer = null
    }
    if (!editor) {
      bindRetryTimer = setTimeout(() => {
        bindToEditor(getEditorInstance())
      }, 250)
      return
    }
    bindToEditor(editor)
    return () => {
      if (bindRetryTimer) {
        clearTimeout(bindRetryTimer)
        bindRetryTimer = null
      }
      if (boundEditor === editor) {
        if (boundHandler) {
          editor.off('selectionUpdate', boundHandler)
          editor.off('transaction', boundHandler)
          editor.off('focus', boundHandler)
        }
        boundEditor = null
        boundHandler = null
      }
    }
  })

  $effect(() => {
    if (activePane !== 'translate') return
    const editor = getEditorInstance()
    if (editor) {
      bindToEditor(editor)
      requestAnimationFrame(() => selectionToText(editor))
    }
  })

  onMount(() => {
    let attempts = 0
    const timer = setInterval(() => {
      if (activePane !== 'translate') return
      const editor = getEditorInstance()
      if (editor) {
        bindToEditor(editor)
        selectionToText(editor)
        clearInterval(timer)
      }
      attempts += 1
      if (attempts > 12) {
        clearInterval(timer)
      }
    }, 250)
    return () => clearInterval(timer)
  })

  const cleanAIResponse = (value: string) => {
    if (!value) return ''
    return value.replace(/```json|```/gi, '').trim()
  }

  const buildTranslatePrompt = (text: string, source: string, target: string) => {
    const sourceLabel = source === 'auto' ? 'auto-detect' : getTranslationLanguageName(source)
    const targetLabel = getTranslationLanguageName(target)
    return `
TASK: Translate the USER_TEXT from ${sourceLabel} to ${targetLabel}.
RULES:
1) Return ONLY the translated text.
2) Do NOT include labels, explanations, or code fences.
3) Preserve meaning and tone.

USER_TEXT:
${text}
`.trim()
  }

  const handleTranslate = async (auto = false) => {
    translateError = ''
    const current = sourceText.trim()
    if (!current) return
    if (auto && current === lastAutoSource) return
    isTranslating = true
    try {
      const cacheKey = buildCacheKey(current, sourceLang, targetLang)
      if (cache.has(cacheKey)) {
        targetText = cache.get(cacheKey) || ''
        if (auto) lastAutoSource = current
        addHistory(current, targetText, sourceLang, targetLang)
        return
      }
      const prompt = buildTranslatePrompt(current, sourceLang, targetLang)
      const raw = await runAIWithResult(prompt, activeDoc, {
        mode: `translate-${targetLang}`,
        format: 'text'
      })
      targetText = cleanAIResponse(raw || '')
      cache.set(cacheKey, targetText || '')
      addHistory(current, targetText, sourceLang, targetLang)
      persistState()
      if (auto) lastAutoSource = current
    } catch (err) {
      translateError = err?.message || 'Translation failed.'
    } finally {
      isTranslating = false
    }
  }

  const handleInsert = () => {
    if (!targetText) return
    const editor = getEditorInstance()
    if (!editor) return
    if (selectionRange) {
      if (insertMode === 'replace') {
        editor.chain().focus().insertContentAt(selectionRange, targetText).run()
      } else {
        editor.chain().focus().insertContentAt(selectionRange.to, `\n${targetText}`).run()
      }
    } else {
      editor.chain().focus().insertContent(targetText).run()
    }
  }

  const swapLanguages = () => {
    if (sourceLang === 'auto') return
    const prevSource = sourceLang
    sourceLang = targetLang
    targetLang = prevSource
    const prevText = sourceText
    sourceText = targetText
    targetText = prevText
    manualEdit = true
  }
</script>

<div class="panel-container">
  <div class="flex flex-col bg-base-300/55 border-b border-base-content/10">
    <div class="flex items-center justify-between px-3 pt-3 pb-2">
      <div class="flex items-center gap-2">
        <i class="ph-light ph-translate text-[var(--color-base-300)] text-[16px]"></i>
        <span class="text-[10px] font-800 uppercase tracking-[0.15em] text-base-content/50"
          >{$_('Language Hub')}</span
        >
      </div>
      <button
        class="settings-btn"
        onclick={() => (settingsOpen = !settingsOpen)}
        title={$_('Translation settings')}
      >
        <i class="ph-light ph-gear"></i>
      </button>
    </div>

    <div class="px-3 pb-3">
      <div class="flex p-0.5 bg-base-content/5 rd-[4px] border border-base-content/10">
        {#each [{ id: 'translate', label: 'Translate' }, { id: 'files', label: 'History' }] as tab}
          <button
            onclick={() => (activeTab = tab.id)}
            class="flex-1 py-1 text-[10px] font-700 uppercase tracking-wider rd-[3px] transition-all
            {activeTab === tab.id
              ? 'bg-base-content/15 text-base-content shadow-sm'
              : 'text-base-content/35 hover:text-base-content/70'}"
          >
            {tab.label}
          </button>
        {/each}
      </div>
    </div>

    {#if settingsOpen}
      <div class="px-3 pb-3">
        <div class="settings-panel">
          <label class="settings-row">
            <input type="checkbox" bind:checked={autoTranslateEnabled} />
            <span>{$_('Translate on selection')}</span>
          </label>
          <div class="settings-row muted">
            {$_('Target language is remembered per document.')}
          </div>
        </div>
      </div>
    {/if}
  </div>

  <div class="flex-1 overflow-hidden flex flex-col">
    {#if activeTab === 'translate'}
      <div class="flex-1 overflow-y-auto no-scrollbar p-3 space-y-5">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="section-label">{$_('Input Content')}</label>
            <div class="flex items-center gap-2">
              <button
                class="auto-pill {autoTranslateEnabled ? 'active' : ''}"
                onclick={() => (autoTranslateEnabled = !autoTranslateEnabled)}
              >
                {autoTranslateEnabled ? $_('Auto') : $_('Manual')}
              </button>
              <button class="swap-btn" onclick={swapLanguages} title={$_('Swap languages')}>
                <i class="ph-light ph-arrows-left-right"></i>
              </button>
              <select bind:value={sourceLang} class="adobe-select">
                <option value="auto">{$_('Auto-detect')}</option>
                {#each languages as lang}
                  <option value={lang.code}>{lang.name}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="relative group">
            <textarea
              bind:value={sourceText}
              placeholder={$_('Selection or manual input...')}
              oninput={() => (manualEdit = true)}
              class="adobe-textarea h-32"
            ></textarea>
            {#if sourceText}
              <button onclick={() => (sourceText = '')} class="clear-btn">
                <i class="ph-light ph-x-circle text-[14px]"></i>
              </button>
            {/if}
          </div>
        </div>

        <div class="flex items-center gap-3 py-1">
          <div class="h-px flex-1 bg-base-content/10"></div>
          <button
            onclick={handleTranslate}
            disabled={!sourceText || isTranslating}
            class="translate-trigger group"
          >
            {#if isTranslating}
              <i class="ph-light ph-circle-notch animate-spin text-[16px] text-base-content"></i>
            {:else}
              <i
                class="ph-light ph-arrow-down text-[16px] text-base-content transition-transform group-hover:translate-y-0.5"
              ></i>
            {/if}
          </button>
          <div class="h-px flex-1 bg-base-content/10"></div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="section-label">{$_('Target Language')}</label>
            <select bind:value={targetLang} class="adobe-select">
              {#each languages as lang}
                <option value={lang.code}>{lang.name}</option>
              {/each}
            </select>
          </div>
          <div
            class="adobe-output-box h-32 {targetText
              ? 'text-base-content/90'
              : 'text-base-content/25 italic text-[11px]'}"
          >
            {targetText || 'Translation results will appear here...'}
          </div>
          <div class="flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-base-content/40">
            <span>{$_('Insert')}</span>
            <button
              class="mode-pill {insertMode === 'replace' ? 'active' : ''}"
              onclick={() => (insertMode = 'replace')}
            >
              {$_('Replace')}
            </button>
            <button
              class="mode-pill {insertMode === 'append' ? 'active' : ''}"
              onclick={() => (insertMode = 'append')}
            >
              {$_('New Paragraph')}
            </button>
          </div>
          {#if translateError}
            <div class="error-container">
              <i class="ph-light ph-warning-circle text-[14px]"></i>
              {translateError}
            </div>
          {/if}
        </div>

        <div class="p-3 bg-base-300/55 border-t border-base-content/10">
          <button onclick={handleInsert} disabled={!targetText} class="primary-action-btn">
            <i class="ph-light ph-arrow-square-in text-[16px]"></i>
            <span>{$_('Insert to Document')}</span>
          </button>
        </div>

        {#if history.length}
          <div class="space-y-2">
            {#if pinnedKeys.length}
              <label class="section-label">{$_('Pinned Translations')}</label>
              <div class="history-list">
                {#each history.filter((entry) => pinnedKeys.includes(entry.key)) as entry}
                  <div
                    class="history-item"
                    onclick={() => {
                      sourceText = entry.source
                      targetText = entry.target
                      sourceLang = entry.sourceLang
                      targetLang = entry.targetLang
                    }}
                  >
                    <div class="history-meta">
                      <span>{entry.sourceLang} → {entry.targetLang}</span>
                      <span>{new Date(entry.at).toLocaleTimeString()}</span>
                    </div>
                    <div class="history-text">
                      <div class="history-source">{entry.source}</div>
                      <div class="history-target">{entry.target}</div>
                    </div>
                    <div class="history-actions">
                      <button
                        class="history-action"
                        onclick={(e) => {
                          e.stopPropagation()
                          pinnedKeys = pinnedKeys.filter((k) => k !== entry.key)
                          persistState()
                        }}
                      >
                        <i class="ph-light ph-push-pin-fill"></i>
                        {$_('Pinned')}
                      </button>
                      <button
                        class="history-action"
                        onclick={async (e) => {
                          e.stopPropagation()
                          await EditorCommonUtils.copyToClipboard(entry.target)
                          persistState()
                        }}
                      >
                        <i class="ph-light ph-copy"></i>
                        {$_('Copy')}
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            <label class="section-label">{$_('Recent Translations')}</label>
            <div class="history-list">
              {#each history.filter((entry) => !pinnedKeys.includes(entry.key)) as entry}
                <div
                  class="history-item"
                  onclick={() => {
                    sourceText = entry.source
                    targetText = entry.target
                    sourceLang = entry.sourceLang
                    targetLang = entry.targetLang
                  }}
                >
                  <div class="history-meta">
                    <span>{entry.sourceLang} → {entry.targetLang}</span>
                    <span>{new Date(entry.at).toLocaleTimeString()}</span>
                  </div>
                  <div class="history-text">
                    <div class="history-source">{entry.source}</div>
                    <div class="history-target">{entry.target}</div>
                  </div>
                  <div class="history-actions">
                    <div
                      class="history-action"
                      onclick={(e) => {
                        e.stopPropagation()
                        pinnedKeys = [entry.key, ...pinnedKeys]
                        persistState()
                      }}
                    >
                      <i class="ph-light ph-push-pin"></i>
                      {$_('Pin')}
                    </div>
                    <button
                      class="history-action"
                      onclick={async (e) => {
                        e.stopPropagation()
                        await EditorCommonUtils.copyToClipboard(entry.target)
                        persistState()
                      }}
                    >
                      <i class="ph-light ph-copy"></i>
                      {$_('Copy')}
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="flex-1 overflow-y-auto no-scrollbar">
        <ListTranslation embedded />
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .panel-container {
    @apply h-full flex flex-col bg-[var(--color-base-200)] text-[var(--color-base-content)] border-l border-[var(--color-base-content)]/10 font-sans select-none;
  }

  .section-label {
    @apply text-[9px] font-900 uppercase tracking-[0.12em] text-[var(--color-base-content)]/35;
  }

  .adobe-select {
    @apply bg-[var(--color-base-100)] border border-[var(--color-base-content)]/10 rd-[2px] px-1.5 py-0.5 text-[10px] font-600
           outline-none hover:bg-[var(--color-base-100)]/10 text-[var(--color-base-content)]/75 transition-colors;
  }

  .adobe-textarea {
    @apply w-full bg-[var(--color-base-100)] border border-[var(--color-base-content)]/10 rd-[4px] p-3 text-[12px] text-[var(--color-base-content)]/90
           outline-none focus:border-[var(--color-base-300)]/50 transition-all resize-none placeholder:text-[var(--color-base-content)]/20;
  }

  .auto-pill {
    @apply px-2 py-0.5 text-[9px] font-800 uppercase tracking-[0.12em] rd-full border border-[var(--color-base-content)]/10
           text-[var(--color-base-content)]/45 hover:text-[var(--color-base-content)]/75 transition-all;
  }
  .auto-pill.active {
    @apply bg-[var(--color-base-300)]/20 text-[#7db3ff] border-[var(--color-base-300)]/40;
  }
  .swap-btn {
    @apply size-6 flex items-center justify-center text-[var(--color-base-content)]/40 hover:text-[var(--color-base-content)]/80
           bg-[var(--color-base-100)]/5 rd-[4px] transition-all;
  }
  .mode-pill {
    @apply px-2 py-0.5 text-[9px] font-800 uppercase tracking-[0.12em] rd-full border border-[var(--color-base-content)]/10
           text-[var(--color-base-content)]/40 hover:text-[var(--color-base-content)]/70 transition-all;
  }
  .mode-pill.active {
    @apply bg-[var(--color-base-300)]/20 text-[#7db3ff] border-[var(--color-base-300)]/40;
  }

  .settings-btn {
    @apply size-7 flex items-center justify-center text-[var(--color-base-content)]/40 hover:text-[var(--color-base-content)]/80
           bg-[var(--color-base-100)]/5 rd-[6px] transition-all;
  }

  .settings-panel {
    @apply bg-[var(--color-base-100)] border border-[var(--color-base-content)]/10 rd-[6px] p-3 flex flex-col gap-2 text-[10px];
  }

  .settings-row {
    @apply flex items-center gap-2 text-[var(--color-base-content)]/75;
  }

  .settings-row input[type='checkbox'] {
    @apply checkbox checkbox-xs;
  }

  .settings-row.muted {
    @apply text-[var(--color-base-content)]/35 text-[9px];
  }

  .adobe-output-box {
    @apply w-full bg-[var(--color-base-100)]/5 border border-[var(--color-base-content)]/10 rd-[4px] p-3 text-[12px] leading-relaxed overflow-y-auto;
  }

  .clear-btn {
    @apply absolute top-2 right-2 p-1 text-[var(--color-base-content)]/20 hover:text-[var(--color-base-content)] transition-colors;
  }

  .translate-trigger {
    @apply size-9 rd-full bg-[var(--color-base-300)] flex items-center justify-center shadow-[0_4px_12px_rgba(2,101,220,0.3)]
           hover:bg-[#0054B4] active:scale-95 disabled:opacity-30 transition-all;
  }

  .primary-action-btn {
    @apply w-full flex items-center justify-center gap-2.5 py-2.5 bg-[color-mix(in_srgb,var(--color-base-300)_70%,transparent)] border border-[var(--color-base-content)]/10
           rd-[4px] text-[11px] font-700 text-[var(--color-base-content)] uppercase tracking-widest transition-all
           hover:(bg-[var(--color-base-100)]/15 border-[var(--color-base-content)]/15) active:scale-[0.98] disabled:opacity-20;
  }

  .error-container {
    @apply flex items-center gap-1.5 text-red-400 text-[10px] font-600 bg-red-400/5 p-2 rd-[2px] border border-red-400/10;
  }

  .history-list {
    @apply flex flex-col gap-2;
  }
  .history-item {
    @apply w-full text-left bg-[var(--color-base-100)]/5 border border-[var(--color-base-content)]/10 rd-[6px] p-2 hover:border-[var(--color-base-content)]/20 transition-all;
  }
  .history-meta {
    @apply flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-[var(--color-base-content)]/30 mb-1;
  }
  .history-text {
    @apply flex flex-col gap-1 text-[11px];
  }
  .history-source {
    @apply text-[var(--color-base-content)]/55 line-clamp-2;
  }
  .history-target {
    @apply text-[var(--color-base-content)]/85 line-clamp-2;
  }
  .history-actions {
    @apply flex items-center gap-2 mt-2 text-[9px] uppercase tracking-[0.2em] text-[var(--color-base-content)]/40;
  }
  .history-action {
    @apply flex items-center gap-1 px-2 py-0.5 rounded-full border border-[var(--color-base-content)]/10 hover:border-[var(--color-base-content)]/30;
  }

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
</style>
