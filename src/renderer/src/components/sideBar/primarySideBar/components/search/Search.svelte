

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { tick } from 'svelte'
  import { _$_documentEditorsList } from '../../../../../stores/editor.store'
  import { _$_wysiwygEditorsList } from '../../../../../stores/editor.store'
  import EditorCommonUtils from '../../../../../utils/common.utils.js'
  import { _$_searchRequest, type SearchMode } from '../../../../../stores/search.store'
  import Utils from '../../../../../utils/Utils'
  import type { Editor } from '@tiptap/core'
  import { TextSelection } from '@tiptap/pm/state'
import { nodeApi } from '../../../../../utils/shims/node'

  type SearchMatch = {
    line: number
    column: number
    length: number
    preview: string
    before: string
    match: string
    after: string
    occurrence?: number
  }

  type SearchResultFile = {
    file: string
    path: string
    relativePath: string
    matches: number
    expanded: boolean
    items: SearchMatch[]
  }

  type SearchResponse = {
    ok: boolean
    files: Array<Omit<SearchResultFile, 'expanded'>>
    totalMatches: number
    scannedFiles: number
    truncated: boolean
    error?: string
  }

//   const nodeApi =
//     typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
//   const fs = nodeApi?.fs
//   const path = nodeApi?.path
  const activeEditorStore = _$_documentEditorsList.getActive()

  let _activeSearchHitEl: HTMLElement | null = null
  function clearActiveSearchHit() {
    _activeSearchHitEl?.classList.remove('search-hit-active')
    _activeSearchHitEl = null
  }

  let isReplaceOpen = $state(false)
  let searchQuery = $state('')
  let replaceQuery = $state('')
  const DOCUMENT_INCLUDE_GLOB = '**/*.html,**/*.md,**/*.txt,**/*.'

  let filesToInclude = $state('')
  let filesToExclude = $state('')
  let isAdvancedOpen = $state(false)
  let isLoading = $state(false)
  let scopeLabel = $state('Current document workspace')
  let mode = $state<SearchMode>('text')
  let results = $state<SearchResultFile[]>([])
  let totalMatches = $state(0)
  let scannedFiles = $state(0)
  let isTruncated = $state(false)
  let errorMessage = $state('')
  let replaceSummary = $state('')

  let inputEl = $state<HTMLInputElement | null>(null)

  let scopePath = $state<string | null>(null)
  let scopeType = $state<'workspace' | 'folder' | 'file'>('workspace')
  let sourcePath = $state<string | null>(null)

  let isRegex = $state(false)
  let isCaseSensitive = $state(false)
  let isWholeWord = $state(false)

  let flatFocusIdx = $state(-1)
  const flatResults = $derived(
    results.flatMap((file, fi) =>
      file.expanded
        ? file.items.map((match, mi) => ({ fi, mi, path: file.path, match }))
        : []
    )
  )

  function moveFocus(delta: number) {
    if (flatResults.length === 0) return
    flatFocusIdx = Math.max(0, Math.min(flatFocusIdx + delta, flatResults.length - 1))
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-flat-idx="${flatFocusIdx}"]`)?.scrollIntoView({ block: 'nearest' })
    })
  }

  function onInputKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); moveFocus(flatFocusIdx < 0 ? 0 : 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); moveFocus(-1) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (flatResults.length === 0) return
      // VSCode-style: cycle forward through occurrences on each Enter
      flatFocusIdx = flatFocusIdx < flatResults.length - 1 ? flatFocusIdx + 1 : 0
      const item = flatResults[flatFocusIdx]
      if (item) openResult(item.path, item.match).catch(err => console.warn('[search] openResult failed', err))
    } else if (e.key === 'Escape') {
      flatFocusIdx = -1
      inputEl?.blur()
    }
  }

  let searchRequestSeq = 0

  function resetResults() {
    results = []
    totalMatches = 0
    scannedFiles = 0
    isTruncated = false
    errorMessage = ''
    clearActiveSearchHit()
  }

  function clearSearch() {
    searchQuery = ''
    replaceQuery = ''
    filesToInclude = ''
    filesToExclude = ''
    replaceSummary = ''
    resetResults()
  }

  function getEditorScopeFallback() {
    const active = $activeEditorStore?.document
    const cachePath = active?.cachePath
    if (cachePath) return cachePath

    const filePath = active?.path
    if (filePath) return nodeApi.path.dirname(filePath)

    return ''
  }

  function normalizeQueryForMode(rawValue: string) {
    const raw = rawValue.trim()
    if (!raw) return ''
    if (mode === 'variable' && !raw.includes('{{')) return `{{${raw}}}`
    return raw
  }

  async function executeSearch() {
    const query = normalizeQueryForMode(searchQuery)
    if (!query) {
      resetResults()
      return
    }

    const baseScope = scopePath || getEditorScopeFallback()
    if (!baseScope) {
      resetResults()
      errorMessage = 'No active document workspace found.'
      return
    }

    const seq = ++searchRequestSeq
    isLoading = true
    replaceSummary = ''

    const normalizedInclude = filesToInclude?.trim() ? filesToInclude : DOCUMENT_INCLUDE_GLOB
    const DEFAULT_EXCLUDE = '**/node_modules/**,**/.git/**,**/dist/**,**/.cache/**,**/build/**,**/*.ts,**/*.js,**/*.svelte,**/*.css,**/*.json,**/*.svg'
    const normalizedExclude = filesToExclude?.trim()
      ? `${filesToExclude},${DEFAULT_EXCLUDE}`
      : DEFAULT_EXCLUDE

    const payload = {
      rootPath: baseScope,
      query,
      isRegex,
      caseSensitive: isCaseSensitive,
      wholeWord: isWholeWord,
      includePattern: normalizedInclude,
      excludePattern: normalizedExclude,
      maxResults: 5000,
      maxMatchesPerFile: 300
    }

    let response: SearchResponse
    try {
      response = (await window.api.searchFiles(payload)) as SearchResponse
    } catch (err) {
      console.warn('[search] searchFiles IPC failed:', err)
      response = {
        ok: false,
        files: [],
        totalMatches: 0,
        scannedFiles: 0,
        truncated: false,
        error: 'Search request failed.'
      }
    }

    if (seq !== searchRequestSeq) return

    if (!response?.ok) {
      resetResults()
      errorMessage = response?.error || 'Search failed.'
      isLoading = false
      return
    }

    errorMessage = ''
    flatFocusIdx = -1
    results = (response.files || [])
      .map((item) => ({
        ...item,
        expanded: true,
        items: (item.items || [])
          .filter((match) => {
            const visibleLine = sanitizeSnippet(
              `${match.before || ''}${match.match || ''}${match.after || ''}`
            )
            const visibleMatch = sanitizeSnippet(match.match || '')
            return visibleMatch && visibleLine.includes(visibleMatch)
          })
          .map((match, idx) => ({
            ...match,
            occurrence: idx
          }))
      }))
    totalMatches = results.reduce((sum, file) => sum + (file.items?.length || 0), 0)
    scannedFiles = response.scannedFiles || 0
    isTruncated = Boolean(response.truncated)
    isLoading = false
  }

  async function replaceInFile(filePath: string) {
    const query = normalizeQueryForMode(searchQuery)
    if (!query || !replaceQuery) return

    const baseScope = scopePath || getEditorScopeFallback()
    if (!baseScope) return

    isLoading = true
    replaceSummary = ''
    errorMessage = ''

    const response = await window.api.replaceInFiles({
      rootPath: baseScope,
      query,
      replaceText: replaceQuery,
      isRegex,
      caseSensitive: isCaseSensitive,
      wholeWord: isWholeWord,
      includePattern: filesToInclude,
      excludePattern: filesToExclude,
      restrictToPaths: [filePath]
    })

    if (!response?.ok) {
      errorMessage = response?.error || 'Replace failed.'
      isLoading = false
      return
    }

    replaceSummary = `Replaced ${response.replacements || 0} occurrence(s) in ${response.changedFiles || 0} file.`
    await executeSearch()
  }

  async function replaceAll() {
    const query = normalizeQueryForMode(searchQuery)
    if (!query || !replaceQuery) return

    const baseScope = scopePath || getEditorScopeFallback()
    if (!baseScope) return

    isLoading = true
    replaceSummary = ''
    errorMessage = ''

    const response = await window.api.replaceInFiles({
      rootPath: baseScope,
      query,
      replaceText: replaceQuery,
      isRegex,
      caseSensitive: isCaseSensitive,
      wholeWord: isWholeWord,
      includePattern: filesToInclude,
      excludePattern: filesToExclude
    })

    if (!response?.ok) {
      errorMessage = response?.error || 'Replace all failed.'
      isLoading = false
      return
    }

    replaceSummary = `Replaced ${response.replacements || 0} occurrence(s) in ${response.changedFiles || 0} file(s).`
    await executeSearch()
  }

  function applySearchRequest() {
    const req = $_$_searchRequest
    if (!req || !req.id) return

    const newScopePath = req.scopePath
    const newScopeType = req.scopeType || 'workspace'

    mode = req.mode || 'text'
    if (req.query) searchQuery = req.query
    scopePath = newScopePath
    scopeType = newScopeType
    sourcePath = req.sourcePath
    scopeLabel = newScopePath
      ? `${newScopeType.toUpperCase()}: ${nodeApi.path.basename(newScopePath)}`
      : 'Current document workspace'

    if (req.autoFocus) tick().then(() => inputEl?.focus())
    executeSearch()
  }

  function toggleExpand(result: SearchResultFile) {
    result.expanded = !result.expanded
    results = [...results]
  }

  function sanitizeSnippet(text: string) {
    if (!text) return ''
    return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  }

  function clipText(text: string, max = 120) {
    if (!text) return ''
    if (text.length <= max) return text
    return `${text.slice(0, max).trim()}…`
  }

  function highlightMatch(editor: Editor, match: SearchMatch) {
    const target = (match?.match || '').trim()
    if (!target) return false

    const occurrenceIndex = match?.occurrence ?? 0
    const needle = isCaseSensitive ? target : target.toLowerCase()
    const doc = editor.state.doc

    let count = 0
    let found: { from: number; to: number } | null = null

    // Walk Tiptap document model (not rendered DOM) to find exact text positions
    doc.descendants((node, pos) => {
      if (found || !node.isText) return
      const rawText = node.text || ''
      const hay = isCaseSensitive ? rawText : rawText.toLowerCase()
      let idx = hay.indexOf(needle)
      while (idx !== -1) {
        if (count === occurrenceIndex) {
          found = { from: pos + idx, to: pos + idx + target.length }
          return false
        }
        count++
        idx = hay.indexOf(needle, idx + Math.max(1, needle.length))
      }
    })

    // Fallback: first occurrence regardless of index
    if (!found) {
      doc.descendants((node, pos) => {
        if (found || !node.isText) return
        const rawText = node.text || ''
        const hay = isCaseSensitive ? rawText : rawText.toLowerCase()
        const idx = hay.indexOf(needle)
        if (idx !== -1) {
          found = { from: pos + idx, to: pos + idx + target.length }
          return false
        }
      })
    }

    if (!found) {
      // text not found in doc — occurrence may have been edited since search ran
      return false
    }


    // Focus editor to show selection visually, then return focus to search input
    // The async gap from openResult means the Enter keydown is already fully consumed here
    editor.chain().focus().setTextSelection(found).scrollIntoView().run()

    try {
      const domPos = editor.view.domAtPos(found.from)
      const domNode = domPos.node as HTMLElement
      const parent =
        domNode?.closest?.('p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote') ??
        domNode?.parentElement
      if (parent instanceof HTMLElement) {
        clearActiveSearchHit()
        _activeSearchHitEl = parent
        parent.classList.add('search-hit-active')
        parent.classList.add('search-hit-flash')
        setTimeout(() => parent.classList.remove('search-hit-flash'), 2200)
      }
    } catch (err) { console.warn('[search] DOM highlight failed at pos', found.from, err) }

    // Return focus to search input so Enter keeps cycling
    setTimeout(() => inputEl?.focus(), 50)

    return true
  }

  async function openResult(filePath: string, match?: SearchMatch) {
    const activeDocPath = $activeEditorStore?.document?.path || null
    await EditorCommonUtils.addNewDocumentEditor(filePath, activeDocPath)
    if (!match) return

    // Poll for the active wysiwyg editor (UUID-based, max 2s)
    let editor: Editor | null = null
    const deadline = Date.now() + 2000
    while (Date.now() < deadline) {
      const entry = _$_wysiwygEditorsList.getActiveEntry?.()
      if (entry?.editor) { editor = entry.editor; break }
      await new Promise((r) => setTimeout(r, 80))
    }
    if (!editor) {
      console.warn('[search] openResult: editor not ready after 2s for', filePath)
      return
    }
    highlightMatch(editor, match)
  }

  async function deleteResultFile(filePath: string) {
    isLoading = true
    const deleted = await window.api.deleteFile(filePath)
    if (!deleted) {
      errorMessage = 'Unable to delete file from search result.'
      isLoading = false
      return
    }
    await executeSearch()
  }

  $effect(() => {
    applySearchRequest()
  })

  const ENTRY_FILE_NAMES = new Set(['index.html', 'index.sddoc', 'index.md'])

  function getFileParts(relativePath: string, fullPath?: string): { name: string; dir: string } {
    const parts = relativePath.replace(/\\/g, '/').split('/')
    const rawName = parts.pop() || relativePath
    if (ENTRY_FILE_NAMES.has(rawName.toLowerCase())) {
      const folderName = parts.pop()
        ?? (fullPath ? nodeApi.path.basename(nodeApi.path.dirname(fullPath)) : rawName)
      return { name: folderName, dir: parts.join('/') }
    }
    const dotIdx = rawName.lastIndexOf('.')
    const name = dotIdx > 0 ? rawName.slice(0, dotIdx) : rawName
    return { name, dir: parts.join('/') }
  }

  function getFileIcon(relativePath: string): { icon: string; color: string } {
    const ext = relativePath.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'html': case Utils.DYNADOC_EXTENSIONS_FORMAT.secured: return { icon: 'ph-light ph-file-text', color: '#047857' }
      case 'md': return { icon: 'ph-light ph-file-text', color: '#5a5a52' }
      case 'txt': return { icon: 'ph-light ph-file-text', color: '#8a8a7f' }
      default: return { icon: 'ph-light ph-file-text', color: '#6b7280' }
    }
  }

  function collapseAll() {
    results = results.map(r => ({ ...r, expanded: false }))
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  $effect(() => {
    const _q = searchQuery
    const _i = filesToInclude
    const _e = filesToExclude
    const _m = mode
    const _s = scopePath
    const _t = scopeType
    const _regex = isRegex
    const _case = isCaseSensitive
    const _word = isWholeWord
    void _q
    void _i
    void _e
    void _m
    void _s
    void _t
    void _regex
    void _case
    void _word

    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => executeSearch(), 220)
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  })
</script>

<div id="search-pane" class="h-full flex flex-col font-sans select-none overflow-hidden text-base-content/80">

  <!-- Header -->
  <div class="flex items-center justify-between px-3 h-9 shrink-0 border-b border-base-content/10 bg-base-300/40">
    <span class="text-[10px] font-bold uppercase tracking-[0.12em] opacity-55">{$_('Search')}</span>
    <div class="flex gap-0.5">
      <button class="search-hdr-btn" title={$_('Refresh')} onclick={executeSearch}><i class="ph-light ph-arrow-clockwise"></i></button>
      <button class="search-hdr-btn" title={$_('Collapse All')} onclick={collapseAll}><i class="ph-light ph-arrows-in-simple"></i></button>
      <button class="search-hdr-btn" title={$_('Clear Results')} onclick={clearSearch}><i class="ph-light ph-x"></i></button>
    </div>
  </div>

  <!-- Inputs -->
  <div class="px-3 pt-2.5 pb-2 flex flex-col gap-1.5 shrink-0 border-b border-base-content/10 bg-base-200">
    <div class="flex items-start gap-1">
      <button
        onclick={() => (isReplaceOpen = !isReplaceOpen)}
        class="mt-1.5 p-0.5 rounded-sm hover:bg-base-content/10 transition-transform {isReplaceOpen ? 'rotate-90' : ''}"
      >
        <i class="ph-light ph-caret-right w-3 h-3 opacity-40"></i>
      </button>

      <div class="flex-grow flex flex-col gap-1">
        <div class="search-input-wrap">
          <input
            bind:this={inputEl}
            type="text"
            bind:value={searchQuery}
            onkeydown={onInputKeyDown}
            class="search-input-bare"
            placeholder={mode === 'variable' ? $_('Variable key…') : $_('Search')}
          />
          <div class="flex items-center gap-0.5 shrink-0">
            <button class="search-flag-btn {isCaseSensitive ? 'active' : ''}" title={$_('Match Case')} onmousedown={(e) => e.preventDefault()} onclick={() => (isCaseSensitive = !isCaseSensitive)}>Aa</button>
            <button class="search-flag-btn {isWholeWord ? 'active' : ''}" title={$_('Match Whole Word')} onmousedown={(e) => e.preventDefault()} onclick={() => (isWholeWord = !isWholeWord)}><span class="underline">ab</span></button>
            <button class="search-flag-btn {isRegex ? 'active' : ''}" title={$_('Use Regular Expression')} onmousedown={(e) => e.preventDefault()} onclick={() => (isRegex = !isRegex)}>.*</button>
          </div>
        </div>

        {#if isReplaceOpen}
          <div class="relative">
            <input type="text" bind:value={replaceQuery} class="search-input" placeholder={$_('Replace')} />
            <button
              class="absolute right-1 top-1/2 -translate-y-1/2 p-1 opacity-40 hover:opacity-90 hover:bg-base-content/10 rounded-sm"
              title={$_('Replace All')}
              onclick={replaceAll}
              disabled={!replaceQuery || !searchQuery}
            >
              <i class="ph-light ph-stack w-3.5 h-3.5"></i>
            </button>
          </div>
        {/if}
      </div>
    </div>

    <button onclick={() => (isAdvancedOpen = !isAdvancedOpen)} class="text-[9px] opacity-35 hover:opacity-70 self-start flex items-center gap-1 ml-5">
      <i class="ph-light ph-sliders w-3 h-3"></i>
      {isAdvancedOpen ? $_('Hide filters') : $_('More filters')}
    </button>

    {#if isAdvancedOpen}
      <div class="flex flex-col gap-1 ml-5">
        <input type="text" bind:value={filesToInclude} class="search-input" placeholder={$_('Files to include (e.g. *.ts)')} />
        <input type="text" bind:value={filesToExclude} class="search-input" placeholder={$_('Files to exclude')} />
      </div>
    {/if}

    {#if errorMessage}
      <p class="text-[10px] text-red-400 ml-5">{errorMessage}</p>
    {/if}
    {#if replaceSummary}
      <p class="text-[10px] text-green-400 ml-5">{replaceSummary}</p>
    {/if}
  </div>

  <!-- Summary -->
  <div class="px-3 py-1.5 text-[10px] opacity-40 shrink-0 border-b border-base-content/10">
    {#if isLoading}
      {$_('Searching…')}
    {:else if searchQuery.trim() && results.length > 0}
      {totalMatches} {$_('results in')} {results.length} {$_('files')}
      {#if isTruncated}<span class="text-amber-400 ml-1">({$_('truncated')})</span>{/if}
      {#if mode === 'variable'}<span class="text-primary ml-2">{$_('Variable mode')}</span>{/if}
    {:else if searchQuery.trim()}
      {$_('No results')}
    {:else}
      {scopeLabel}
    {/if}
  </div>

  <!-- Results list -->
  <div class="flex-grow overflow-y-auto search-scrollbar">
    {#if searchQuery.trim() === ''}
      <div class="flex flex-col items-center justify-center h-40 opacity-20 gap-2">
        <i class="ph-light ph-magnifying-glass text-3xl"></i>
        <span class="text-xs">{$_('Enter a search query')}</span>
      </div>
    {:else if !isLoading && results.length === 0}
      <div class="flex items-center justify-center h-40 opacity-30">
        <span class="text-xs italic">{$_('No results found')}</span>
      </div>
    {:else}
      {#each results as res, fi}
        {@const icon = getFileIcon(res.relativePath)}
        {@const parts = getFileParts(res.relativePath, res.path)}
        <div>
          <!-- File row -->
          <div class="search-file-row group" onclick={() => toggleExpand(res)}>
            <i class="ph-light ph-caret-right shrink-0 text-[11px] opacity-35 transition-transform {res.expanded ? 'rotate-90' : ''}"></i>
            <i class="{icon.icon} shrink-0 text-[13px]" style="color:{icon.color}"></i>
            <span class="text-[11px] font-medium truncate min-w-0">{parts.name}</span>
            {#if parts.dir}<span class="text-[10px] opacity-30 truncate min-w-0 ml-0.5">{parts.dir}</span>{/if}
            <div class="ml-auto flex items-center gap-1 shrink-0 pl-2">
              <span class="search-badge">{res.items.length}</span>
              {#if isReplaceOpen && replaceQuery}
                <button class="search-row-btn opacity-0 group-hover:opacity-100" title={$_('Replace in file')}
                  onclick={(e) => { e.stopPropagation(); replaceInFile(res.path).catch(err => { errorMessage = $_('Replace failed'); console.error('[search] replaceInFile', err) }) }}>
                  <i class="ph-light ph-arrows-left-right"></i>
                </button>
              {/if}
              <button class="search-row-btn opacity-0 group-hover:opacity-100" title={$_('Delete file')}
                onclick={(e) => { e.stopPropagation(); deleteResultFile(res.path).catch(err => { errorMessage = $_('Delete failed'); console.error('[search] deleteResultFile', err) }) }}>
                <i class="ph-light ph-trash"></i>
              </button>
            </div>
          </div>

          <!-- Match rows -->
          {#if res.expanded}
            {#each res.items as match, mi}
              {@const flatIdx = flatResults.findIndex(r => r.fi === fi && r.mi === mi)}
              <button
                class="search-match-row {flatIdx === flatFocusIdx ? 'focused' : ''}"
                data-flat-idx={flatIdx}
                onclick={() => { flatFocusIdx = flatIdx; openResult(res.path, match).catch(err => console.warn('[search] openResult failed', err)) }}
              >
                <span class="text-[9px] opacity-25 w-8 shrink-0 text-right pr-2 tabular-nums">{match.line}</span>
                <span class="truncate text-left text-[11px] opacity-55">
                  {clipText(sanitizeSnippet(match.before), 40)}<mark class="search-hl">{sanitizeSnippet(match.match)}</mark>{clipText(sanitizeSnippet(match.after), 40)}
                </span>
              </button>
            {/each}
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style lang="postcss">
  .search-input-wrap {
    @apply flex items-center bg-[color-mix(in_srgb,var(--color-base-100)_60%,transparent)] border border-[var(--color-base-content)]/10 rounded-sm px-2 py-1 text-[11px] text-[var(--color-base-content)] transition-colors;
    &:focus-within { @apply border-primary; }
  }
  .search-input-bare {
    @apply flex-1 min-w-0 bg-transparent outline-none py-0.5 text-[11px] text-[var(--color-base-content)];
  }
  .search-input-bare::placeholder { @apply opacity-35; }

  /* keep .search-input for replace/filter inputs that don't have flag buttons */
  .search-input {
    @apply w-full bg-[color-mix(in_srgb,var(--color-base-100)_60%,transparent)] border border-[var(--color-base-content)]/10 rounded-sm px-2 py-1.5 text-[11px] text-[var(--color-base-content)] outline-none transition-colors;
  }
  .search-input:focus { @apply border-primary; }
  .search-input::placeholder { @apply opacity-35; }

  .search-hdr-btn {
    @apply p-1.5 rounded-sm text-[14px] opacity-40 hover:opacity-90 hover:bg-[var(--color-base-100)]/8 cursor-pointer transition-opacity;
  }

  .search-flag-btn {
    @apply text-[9px] font-mono px-1 py-0.5 rounded-sm opacity-40 hover:opacity-80 cursor-pointer transition-opacity;
  }
  .search-flag-btn.active {
    @apply opacity-100 text-primary;
    background: color-mix(in srgb, var(--color-primary, #3b82f6) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-primary, #3b82f6) 40%, transparent);
  }

  .search-file-row {
    @apply flex items-center gap-1.5 px-2 h-[26px] cursor-pointer border-b border-[var(--color-base-content)]/5 hover:bg-[var(--color-base-100)]/4 transition-colors;
  }

  .search-badge {
    @apply text-[9px] font-bold text-white px-1.5 rounded-full;
    background: #3b82f6;
    min-width: 18px;
    line-height: 16px;
    text-align: center;
  }

  .search-row-btn {
    @apply p-0.5 rounded-sm text-[12px] hover:bg-[var(--color-base-100)]/10 cursor-pointer transition-opacity;
  }

  .search-match-row {
    @apply flex items-center w-full h-[21px] pl-4 pr-2 cursor-pointer text-left hover:bg-[var(--color-base-100)]/4 transition-colors;
  }
  .search-match-row.focused {
    @apply outline-none;
    background: color-mix(in srgb, #3b82f6 12%, transparent);
  }

  .search-hl {
    background: color-mix(in srgb, #528bff 30%, transparent);
    color: inherit;
    border-radius: 2px;
    padding: 0 1px;
    font-style: normal;
  }

  .search-scrollbar::-webkit-scrollbar { width: 4px; }
  .search-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,.10); border-radius: 2px; }

  :global(.search-hit-active) {
    background: rgba(255, 190, 0, 0.22) !important;
    outline: 2px solid rgba(255, 160, 0, 0.45) !important;
    border-radius: 4px;
  }
  :global(.search-hit-flash) {
    animation: search-hit-glow 2.4s ease-out;
    border-radius: 4px;
  }
  @keyframes search-hit-glow {
    0%   { background: rgba(255, 180, 0, 0.85); outline: 2px solid rgba(255, 150, 0, 0.9); }
    30%  { background: rgba(255, 200, 0, 0.65); outline: 2px solid rgba(255, 150, 0, 0.6); }
    70%  { background: rgba(255, 220, 80, 0.30); outline: 2px solid transparent; }
    100% { background: rgba(255, 190, 0, 0.22); outline: 2px solid rgba(255, 160, 0, 0.45); }
  }
</style>
