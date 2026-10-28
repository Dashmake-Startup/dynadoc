<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onDestroy, onMount, tick } from 'svelte'
  import hotkeys from 'hotkeys-js'
  import {
    GenericFormattingComponentMap,
    GenericFormatingEditorCommands,

    baseCommands,

    type CommandEntry,

    formattingCommandsFromMap



  } from '../../common/actions/formatting'
  import { _$_documentEditorsList } from '../../../stores/editor.store'
  import EditorCommonUtils from '../../../utils/common.utils'
  import { openPrimarySearchPane } from '../../../stores/search.store'
  import { _$_findBar } from '../../../extensions/tiptap/CustomFindReplaceExtension/findBar.store'
  import { get } from 'svelte/store'
  import { nodeApi } from '../../../utils/shims/node'
  import { startHomeTour, startEditorTour } from '../../../lib/tourManager'
//   const nodeApi =
//     typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
//   const fs = nodeApi?.fs
//   const path = nodeApi?.path
  type PaletteItemKind = 'section' | 'command' | 'file' | 'recent'

  type FileResult = {
    name: string
    path: string
    relativePath: string
    isFolder: boolean
  }

  type PaletteItem = {
    id: string
    kind: PaletteItemKind
    title: string
    subtitle?: string
    icon?: string
    hotkey?: string
    isSelectable: boolean
    action?: () => void | Promise<void>
  }


  const MAX_FILE_RESULTS = 80
  const MAX_COMMAND_RESULTS = 70

  let { closePopover = null }: { closePopover?: (() => void) | null } = $props()

  let inputElement = $state<HTMLInputElement | null>(null)
  let searchQuery = $state('')
  let selectedIndex = $state(0)
  let docsList = $state<any[]>([])
  let activeDocumentEditor = $state<any | null>(null)
  let fileResults = $state<FileResult[]>([])
  let loadingFiles = $state(false)
  let formattingCommandCache = $state<CommandEntry[]>([])
  let visibleItems = $state<PaletteItem[]>([])
  let selectableItems = $state<PaletteItem[]>([])
  let selectableIndexById = $state<Record<string, number>>({})

  let docsUnsub: (() => void) | null = null
  let activeDocUnsub: (() => void) | null = null
  let fileSearchTimer: ReturnType<typeof setTimeout> | null = null
  let fileSearchSeq = 0
  let includeHotkeysBound = false
  let clipboardHotkeysBound = false
  let searchHotkeyBound = false

  function shouldIgnoreHotkeys(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null
    if (!target) return false
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    return false
  }

  function registerIncludeHotkeys() {
    if (includeHotkeysBound) return
    includeHotkeysBound = true

    const bindings = [
      {
        combo: 'ctrl+alt+i,command+alt+i',
        action: () => GenericFormatingEditorCommands.includeFile()
      },
      {
        combo: 'ctrl+alt+a,command+alt+a',
        action: () => GenericFormatingEditorCommands.appendFile()
      },
      {
        combo: 'ctrl+alt+shift+i,command+alt+shift+i',
        action: () => GenericFormatingEditorCommands.includeFileFromClipboard()
      },
      {
        combo: 'ctrl+alt+shift+a,command+alt+shift+a',
        action: () => GenericFormatingEditorCommands.appendFileFromClipboard()
      }
    ]

    bindings.forEach((binding) => {
      hotkeys(binding.combo, (event) => {
        if (shouldIgnoreHotkeys(event)) return
        event.preventDefault()
        binding.action()
      })
    })
  }

  function unregisterIncludeHotkeys() {
    if (!includeHotkeysBound) return
    includeHotkeysBound = false
    hotkeys.unbind('ctrl+alt+i,command+alt+i')
    hotkeys.unbind('ctrl+alt+a,command+alt+a')
    hotkeys.unbind('ctrl+alt+shift+i,command+alt+shift+i')
    hotkeys.unbind('ctrl+alt+shift+a,command+alt+shift+a')
  }

  function registerClipboardHotkeys() {
    if (clipboardHotkeysBound) return
    clipboardHotkeysBound = true
    hotkeys('shift+command+c,shift+ctrl+c', (event) => {
      if (shouldIgnoreHotkeys(event)) return
      event.preventDefault()
      GenericFormatingEditorCommands.copyAsText()
    })
  }

  function unregisterClipboardHotkeys() {
    if (!clipboardHotkeysBound) return
    clipboardHotkeysBound = false
    hotkeys.unbind('shift+command+c,shift+ctrl+c')
  }

  function handleSearchHotkey(event: KeyboardEvent) {
    if (event.repeat) return
    const isMac = navigator.platform.includes('Mac')
    const mod = isMac ? event.metaKey : event.ctrlKey
    if (mod && event.shiftKey && event.key.toLowerCase() === 'f') {
      event.preventDefault()
      event.stopPropagation()
      openPrimarySearchPane({ autoFocus: true })
    }
  }

  function registerSearchHotkey() {
    if (searchHotkeyBound) return
    searchHotkeyBound = true
    document.addEventListener('keydown', handleSearchHotkey, true)
  }

  function unregisterSearchHotkey() {
    if (!searchHotkeyBound) return
    searchHotkeyBound = false
    document.removeEventListener('keydown', handleSearchHotkey, true)
  }

  function toSafeLabel(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
  }

  function normalizeCommandLabel(value: string) {
    return value.replace(/\s+/g, ' ').trim()
  }

  function shouldSkipLabel(label: string) {
    if (!label) return true
    if (/^[-\s]{2,}$/.test(label)) return true
    return false
  }

  function getActiveRootPath() {
    const activeDoc = activeDocumentEditor?.document
    if (!activeDoc) return ''

    if (activeDoc.cachePath) return activeDoc.cachePath
    if (activeDoc.path) return nodeApi.path.dirname(activeDoc.path)
    return ''
  }

  function getActiveMainPath() {
    const activeDoc = activeDocumentEditor?.document
    if (!activeDoc) return null
    try {
      return activeDoc.getMainFilePath?.() || activeDoc.path || null
    } catch {
      return activeDoc.path || null
    }
  }

  function getRecentFiles() {
    const seen = new Set<string>()
    const files: FileResult[] = []

    for (const entry of docsList) {
      const doc = entry?.document
      if (!doc) continue

      const mainPath = doc?.getMainFilePath?.() || doc?.path
      if (!mainPath || seen.has(mainPath)) continue
      seen.add(mainPath)

      files.push({
        name: documentDisplayName(mainPath),
        path: mainPath,
        relativePath: mainPath,
        isFolder: false
      })
    }

    return files.slice(0, 12)
  }

  


  function commandQuery() {
    const value = searchQuery.trim()
    return value.startsWith('>') ? value.slice(1).trim() : value
  }

  function isCommandMode() {
    return searchQuery.trim().startsWith('>')
  }

  function scoreMatch(haystack: string, query: string) {
    if (!query) return 10
    const h = haystack.toLowerCase()
    const q = query.toLowerCase()
    if (h === q) return 120
    if (h.startsWith(q)) return 80
    if (h.includes(q)) return 40
    return 0
  }

  function filterCommands(commands: CommandEntry[], query: string) {
    const q = query.trim().toLowerCase()
    const scored = commands
      .map((command) => {
        const titleScore = scoreMatch(command.title, q)
        const subtitleScore = command.subtitle ? scoreMatch(command.subtitle, q) : 0
        const tagsScore = command.tags.reduce((acc, tag) => Math.max(acc, scoreMatch(tag, q)), 0)
        const score = Math.max(titleScore, subtitleScore, tagsScore)
        return { command, score }
      })
      .filter((entry) => (q ? entry.score > 0 : true))
      .sort((a, b) => b.score - a.score || a.command.title.localeCompare(b.command.title))

    return scored.slice(0, MAX_COMMAND_RESULTS).map((entry) => entry.command)
  }

  function toCommandItem(command: CommandEntry): PaletteItem {
    return {
      id: command.id,
      kind: 'command',
      title: command.title,
      subtitle: command.subtitle,
      icon: 'ph-light ph-command',
      hotkey: command.hotkey,
      isSelectable: true,
      action: command.action
    }
  }

  // Internal entry-point filenames — display the parent folder name instead
  const INTERNAL_ENTRY_FILES = new Set(['index.html', 'index.sddoc', 'index.md'])

  function documentDisplayName(filePath: string): string {
    const base = nodeApi.path.basename(filePath)
    if (INTERNAL_ENTRY_FILES.has(base)) {
      return nodeApi.path.basename(nodeApi.path.dirname(filePath))
    }
    const ext = nodeApi.path.extname(base)
    return ext ? base.slice(0, -ext.length) : base
  }

  function toFileItem(file: FileResult, kind: 'file' | 'recent'): PaletteItem {
    const activeMainPath = getActiveMainPath()
    const displayName = file.isFolder ? file.name : documentDisplayName(file.path)
    return {
      id: `${kind}:${file.path}`,
      kind,
      title: displayName,
      subtitle: file.relativePath,
      icon: file.isFolder ? 'ph-light ph-folder' : 'ph-light ph-file',
      isSelectable: true,
      action: async () => {
        if (file.isFolder) {
          await window.api.openFile(file.path)
          return
        }
        await EditorCommonUtils.addNewDocumentEditor(file.path, activeMainPath)
      }
    }
  }

  function sectionItem(id: string, title: string): PaletteItem {
    return {
      id: `section:${id}`,
      kind: 'section',
      title,
      isSelectable: false
    }
  }

  function getVisibleItems(): PaletteItem[] {
    const items: PaletteItem[] = []
    const allCommands = [...baseCommands(), ...formattingCommandCache]

    if (isCommandMode()) {
      const commandResults = filterCommands(allCommands, commandQuery())
      items.push(sectionItem('commands', 'Commands'))
      items.push(...commandResults.map(toCommandItem))
      return items
    }

    const q = searchQuery.trim().toLowerCase()
    const rawQuery = searchQuery.trim()
    const recentFiles = getRecentFiles()

    if (!q) {
      if (recentFiles.length > 0) {
        items.push(sectionItem('recent', 'Recently Opened'))
        items.push(...recentFiles.map((file) => toFileItem(file, 'recent')))
      }

      const suggested = filterCommands(allCommands, '').slice(0, 10)
      if (suggested.length > 0) {
        items.push(sectionItem('suggested', 'Suggested Commands'))
        items.push(...suggested.map(toCommandItem))
      }
      return items
    }

    if (EditorCommonUtils.isLikelyShareLink(rawQuery)) {
      items.push(sectionItem('share', 'Shared Link'))
      items.push({
        id: 'share:open',
        kind: 'command',
        title: 'Open shared link',
        subtitle: rawQuery,
        icon: 'ph-light ph-link',
        isSelectable: true,
        action: async () => {
          await EditorCommonUtils.openDocumentFromShareLink(rawQuery)
        }
      })
    }

    if (EditorCommonUtils.isLikelyFileInput(rawQuery) && !EditorCommonUtils.isLikelyShareLink(rawQuery)) {
      const isLocalPath = EditorCommonUtils.isLikelyLocalPath(rawQuery)
      items.push(sectionItem('open-path', isLocalPath ? 'Open Local Path' : 'Open Path'))
      items.push({
        id: 'path:open',
        kind: 'command',
        title: isLocalPath ? 'Open or upload this path' : 'Open this path',
        subtitle: rawQuery,
        icon: 'ph-light ph-file',
        isSelectable: true,
        action: async () => {
          await EditorCommonUtils.openDocumentFromInput(rawQuery, {
            parentPath: getActiveMainPath()
          })
        }
      })
    }

    const fileMatches = fileResults.slice(0, MAX_FILE_RESULTS)
    if (fileMatches.length > 0) {
      items.push(sectionItem('files', loadingFiles ? 'Go to File (loading...)' : 'Go to File'))
      items.push(...fileMatches.map((file) => toFileItem(file, 'file')))
    } else if (loadingFiles) {
      items.push(sectionItem('files', 'Go to File (loading...)'))
    }

    // Commands only shown in command mode (>) — not mixed into file search
    if (items.length === 0) {
      items.push(sectionItem('empty', 'No matches — use > to search commands'))
    }

    return items
  }

  function getSelectableItems() {
    return getVisibleItems().filter((item) => item.isSelectable)
  }

  function getSelectableFrom(items: PaletteItem[]) {
    return items.filter((item) => item.isSelectable)
  }

  async function executeItem(item: PaletteItem | undefined) {
    if (!item || !item.isSelectable || !item.action) return
    // Close palette first so the editor regains focus before the command runs.
    // Editor commands (insertMonacoCodeBlock, etc.) require an active WYSIWYG
    // editor — which is only true once the palette input has lost focus.
    await close()
    await new Promise((r) => setTimeout(r, 80))
    console.log('[Palette] executing action:', item.id, '| activeElement:', document.activeElement)
    try {
      await Promise.resolve(item.action())
      console.log('[Palette] action completed:', item.id)
    } catch (error) {
      console.error('[Palette] executeItem failed', error)
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    const selectable = selectableItems
    const count = selectable.length

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (count > 0) selectedIndex = (selectedIndex + 1) % count
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (count > 0) selectedIndex = (selectedIndex - 1 + count) % count
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const rawQuery = searchQuery.trim()
      if (rawQuery && EditorCommonUtils.isLikelyShareLink(rawQuery)) {
        void executeItem(selectableItems.find((item) => item.id === 'share:open'))
        close()
        return
      }
      if (selectedIndex >= 0 && selectedIndex < count) {
        void executeItem(selectable[selectedIndex])
      }
      close()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      void close()
    }
  }

  export async function open(initialQuery = '') {
    searchQuery = initialQuery
    selectedIndex = 0
    await tick()
    inputElement?.focus()
  }

  export async function close() {
    searchQuery = ''
    inputElement?.blur()
    closePopover?.()
  }
  async function refreshFileResults() {
    const q = searchQuery.trim()
    if (!q || isCommandMode()) {
      fileResults = []
      loadingFiles = false
      return
    }

    const rootPath = getActiveRootPath()
    if (!rootPath) {
      fileResults = []
      loadingFiles = false
      return
    }

    const requestId = ++fileSearchSeq
    loadingFiles = true

    try {
      const response = await window.api.searchFileNames({
        rootPath,
        query: q,
        maxResults: MAX_FILE_RESULTS
      })

      if (requestId !== fileSearchSeq) return
      if (!response?.ok) {
        fileResults = []
        loadingFiles = false
        return
      }

      fileResults = Array.isArray(response.items) ? response.items : []
      loadingFiles = false
    } catch {
      if (requestId === fileSearchSeq) {
        fileResults = []
        loadingFiles = false
      }
    }
  }

  function handleGlobalEsc(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      // FindBar is open — let its input keydown handler take precedence
      if (get(_$_findBar).open) return
      e.stopPropagation()
      void close()
    }
  }

  onMount(() => {
    ;(window as any)._$_commandPalette = { open }
    formattingCommandCache = formattingCommandsFromMap()
    registerIncludeHotkeys()
    registerClipboardHotkeys()
    registerSearchHotkey()
    document.addEventListener('keydown', handleGlobalEsc, true)

    docsUnsub = _$_documentEditorsList.subscribe((list) => {
      docsList = list || []
    })

    activeDocUnsub = _$_documentEditorsList.getActive().subscribe((entry) => {
      activeDocumentEditor = entry || null
    })
  })

  onDestroy(() => {
    if ((window as any)._$_commandPalette?.open === open) {
      delete (window as any)._$_commandPalette
    }
    unregisterIncludeHotkeys()
    unregisterClipboardHotkeys()
    unregisterSearchHotkey()
    document.removeEventListener('keydown', handleGlobalEsc, true)
    if (docsUnsub) docsUnsub()
    if (activeDocUnsub) activeDocUnsub()
    if (fileSearchTimer) clearTimeout(fileSearchTimer)
  })

  $effect(() => {
    const query = searchQuery
    const root = getActiveRootPath()
    const commandMode = isCommandMode()
    void query
    void root
    void commandMode

    if (fileSearchTimer) clearTimeout(fileSearchTimer)
    fileSearchTimer = setTimeout(() => {
      void refreshFileResults()
    }, 180)

    return () => {
      if (fileSearchTimer) clearTimeout(fileSearchTimer)
    }
  })

  $effect(() => {
    const selectableCount = selectableItems.length
    if (selectableCount === 0) {
      selectedIndex = 0
      return
    }
    if (selectedIndex >= selectableCount) selectedIndex = 0
    if (selectedIndex < 0) selectedIndex = 0
  })

  $effect(() => {
    const computedVisible = getVisibleItems()
    visibleItems = computedVisible

    const computedSelectable = getSelectableFrom(computedVisible)
    selectableItems = computedSelectable

    const indexMap: Record<string, number> = {}
    computedSelectable.forEach((entry, index) => {
      indexMap[entry.id] = index
    })
    selectableIndexById = indexMap
  })
</script>

<div class="palette-container" onkeydown={onKeyDown}>
  <div class="palette-header">
    <i class="ph-bold ph-magnifying-glass text-base-300 text-[16px]"></i>
    <input
      bind:this={inputElement}
      bind:value={searchQuery}
      class="palette-input"
      placeholder={$_('Search commands... (use > for actions)')}
      autocomplete="off"
      spellcheck="false"
    />
    <div class="hidden sm:block opacity-20 text-[8px] font-800 tracking-tighter uppercase">
      {$_('Esc to Close')}
    </div>
  </div>

  <div class="palette-results overflow-y-auto">
    {#if visibleItems.length === 0}
      <div class="flex flex-col items-center justify-center h-[120px] text-base-content/20">
        <i class="ph-light ph-selection-slash text-[24px] mb-2"></i>
        <span class="text-[11px] uppercase tracking-widest font-700">{$_('No results found')}</span>
      </div>
    {:else}
      {#each visibleItems as item (item.id)}
        {#if item.kind === 'section'}
          <div class="section-row">
            <span>{item.title}</span>
            <div class="h-[1px] flex-1 bg-base-content/5"></div>
          </div>
        {:else}
          {@const selectableIndex = selectableIndexById[item.id] ?? -1}
          <button
            class="result-row group"
            class:active={selectableIndex === selectedIndex}
            onmouseenter={() => (selectedIndex = Math.max(0, selectableIndex))}
            onclick={() => executeItem(item)}
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-[24px] flex justify-center text-base-content/40 group-[.active]:text-primary">
                <i class={item.icon || 'ph-bold ph-command'}></i>
              </div>
              <div class="flex flex-col truncate">
                <span class="text-[12px] font-500 text-base-content/90 group-[.active]:text-base-content"
                  >{item.title}</span
                >
                {#if item.subtitle}
                  <span class="text-[10px] text-base-content/30 truncate">{item.subtitle}</span>
                {/if}
              </div>
            </div>

            <div class="flex gap-1">
              {#if item.hotkey}
                {#each item.hotkey.split('+') as key}
                  <kbd class="adobe-kbd">{key}</kbd>
                {/each}
              {/if}
            </div>
          </button>
        {/if}
      {/each}
    {/if}
  </div>

  <div class="palette-footer">
    <div class="flex items-center gap-4">
      <span class="flex items-center gap-1.5"
        ><kbd class="text-base-300">↑↓</kbd> {$_('Navigate')}</span
      >
      <div class="size-3px rd-full bg-base-content/10"></div>
      <span class="flex items-center gap-1.5"
        ><kbd class="text-base-300">↵</kbd> {$_('Execute')}</span
      >
    </div>
  </div>
</div>

<style lang="postcss">
  /* Spectrum 2 Core Tokens via UnoCSS @apply */

  .palette-container {
    @apply w-[min(720px,90vw)] max-h-[480px] overflow-hidden rd-[6px] grid grid-rows-[auto_1fr_auto];
    background: var(--theme-popover-bg);
    border: 1px solid var(--theme-border-subtle);
    box-shadow: var(--theme-popover-shadow);
    color: var(--theme-text-1);
  }

  .palette-header {
    @apply flex items-center gap-3 px-4 py-3.5;
    background: var(--theme-surface-2);
    border-bottom: 1px solid var(--theme-border-subtle);
  }

  .palette-input {
    @apply flex-1 bg-transparent border-none outline-none text-[13px] font-500 placeholder-[var(--color-base-content)]/20;
  }

  .palette-results {
    @apply overflow-y-auto p-1;
    background: var(--theme-surface-1);
  }

  .section-row {
    @apply flex items-center gap-3 px-3 pt-3 pb-1.5 text-[9px] font-800 
           uppercase tracking-[0.15em] text-[var(--color-base-content)]/25 select-none;
  }

  .result-row {
    @apply relative w-full flex items-center justify-between px-3 py-1.5 mb-0.5 
           rd-[4px] transition-colors duration-100 border-none bg-transparent text-left;
  }

  /* Adobe Selection Logic */
  .result-row.active {
    background: rgba(var(--theme-text-rgb), 0.08);
  }

  .result-row.active::before {
    content: '';
    @apply absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-adobe-blue rd-r-2px;
  }

  .adobe-kbd {
    @apply font-sans text-[9px] font-700 px-1.5 py-0.5 rd-[3px] 
           bg-[var(--color-base-100)]/5 border border-[var(--color-base-content)]/10 text-[var(--color-base-content)]/50 min-w-[18px] text-center;
  }

  .palette-footer {
    @apply flex items-center justify-between px-4 py-2 text-[9px] font-800 uppercase tracking-widest text-[var(--color-base-content)]/30;
    background: rgba(var(--theme-text-rgb), 0.04);
    border-top: 1px solid var(--theme-border-subtle);
  }

  /* Custom Color Helper */
  /* :global(:root) {
    --adobe-blue: var(--color-base-300);
  }
  
  .text-[var(--color-base-300)] {
    color: var(--adobe-blue);
  } */

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
</style>
