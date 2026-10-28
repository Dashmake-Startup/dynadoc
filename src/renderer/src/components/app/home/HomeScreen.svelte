<script lang="ts">
  // Imported rather than referenced as /brand/…: the packaged app is loaded
  // with loadFile(), so an absolute URL resolves against the filesystem root
  // and the mark silently fails to paint. The copies under public/ are the
  // ones Casdoor and the e-mails fetch over HTTP.
  // Le rail fait 68 px : c'est le monogramme qui y tient, pas le lock-up.
  import brandMark from '@resources/img/brand/dynadoc-mark.png'
  import { _ } from 'svelte-i18n'
  import { get } from 'svelte/store'
  import { onDestroy, onMount } from 'svelte'
  import debounce from 'lodash/debounce'
  import EditorCommonUtils, { goToNewDocumentScreen } from '../../../utils/common.utils'
  import Utils from '../../../utils/Utils'
  import Platform from '../../../libs/platform'
  import DriveExplorerWidget from '../../sideBar/primarySideBar/components/explorer/DriveExplorerWidget.svelte'
  import { openUpgradePlanModal } from '../../../stores/upgradePlanModal.store'
  import { _$_isFeatureEnabled } from '../../../stores/features.store'
  import { authStore } from '../../../stores/auth.store'
  import { _$_documentEditorsList } from '../../../stores/editor.store'
  import {
    _$_pinnedRecentDocuments,
    _$_recentDocuments,
    _$_activeSecondarySidebarItem,
    _$_secondarySidebarVisible,
    type RecentDocumentEntry
  } from '../../../stores/common.store'
  import type { DocumentContentType } from '../../../models/Document'
  import { DocumentModel } from '../../../models/Document'
  import { nodeApi } from '../../../utils/shims/node'

  const ENTRY_FILE_NAMES = new Set(['index.html', 'index.sddoc', 'index.md'])
  function documentDisplayName(filePath: string): string {
    if (!filePath) return ''
    const base = nodeApi.path.basename(filePath)
    if (ENTRY_FILE_NAMES.has(base.toLowerCase())) {
      return nodeApi.path.basename(nodeApi.path.dirname(filePath))
    }
    const ext = nodeApi.path.extname(base)
    return ext ? base.slice(0, -ext.length) : base
  }

  type RecentRow = RecentDocumentEntry & {
    type:
      | 'word'
      | 'excel'
      | Utils.FILE_TYPES.pdf
      | 'slide'
      | `${typeof Utils.DYNADOC_EXTENSIONS_FORMAT.name}`
      | 'unknown'
    locationLabelKey: string
  }

  //   const nodeApi =
  //     typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
  //   const fs = nodeApi?.fs
  //   const path = nodeApi?.path
  const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop

  // Order and colour both come from the brand mockup: Document, Spreadsheet,
  // Presentation, Design, Form, Meeting, each on its own hue. The colours are
  // token references rather than utility classes so light and dark resolve to
  // two different sets of six — the mockup's own values hold on its dark
  // ground but two of them vanish on a white panel.
  const quickCreate = [
    {
      id: 'text',
      labelKey: 'Document',
      icon: 'ph-light ph-file-text',
      color: 'var(--brand-tile-document)'
    },
    {
      id: 'sheet',
      // "Spreadsheet", as the mockup labels it. The key already exists in both
      // locale files ("Feuille de calcul" in fr), so this needs no edit there.
      labelKey: 'Spreadsheet',
      icon: 'ph-light ph-table',
      color: 'var(--brand-tile-spreadsheet)'
    },
    {
      id: 'slide',
      labelKey: 'Presentation',
      icon: 'ph-light ph-presentation-chart',
      color: 'var(--brand-tile-presentation)'
    },
    {
      id: 'design',
      labelKey: 'Design',
      icon: 'ph-light ph-paint-brush-broad',
      color: 'var(--brand-tile-design)'
    },
    { id: 'form', labelKey: 'Form', icon: 'ph-light ph-textbox', color: 'var(--brand-tile-form)' },
    {
      id: 'meeting',
      labelKey: 'Meeting',
      icon: 'ph-light ph-video-camera',
      color: 'var(--brand-tile-meeting)'
    }
  ] as const satisfies Array<{
    id: DocumentContentType
    labelKey: string
    icon: string
    color: string
  }>

  // Les Quick Tools ne sont plus posés sur l'accueil par défaut : ils sont
  // rendus derrière l'interrupteur « quickTools », éteint tant que la licence
  // ne l'allume pas. Voir stores/features.store.ts.
  const featureCards = [
    {
      icon: 'ph-light ph-sparkle',
      titleKey: 'AI Workspace',
      descriptionKey: 'Draft, translate, and summarize entire documents instantly.',
      tone: 'var(--accent-text)',
      tint: 'var(--brand-tint-design)',
      action: () => openSecondaryPanel('chat-ai')
    },
    {
      icon: 'ph-light ph-translate',
      titleKey: 'Parallel Translate',
      descriptionKey: 'Bilingual side-by-side reading for compliance teams.',
      tone: 'var(--brand-tile-document)',
      tint: 'var(--brand-tint-document)',
      action: () => openSecondaryPanel('translate')
    },
    {
      icon: 'ph-light ph-file-pdf',
      titleKey: 'PDF Studio',
      descriptionKey: 'Edit, sign, and export polished PDFs in seconds.',
      tone: 'var(--brand-tile-form)',
      tint: 'var(--brand-tint-form)',
      action: () => handleOpenDialog()
    },
    {
      icon: 'ph-light ph-cloud',
      titleKey: 'Cloud Sync',
      descriptionKey: 'Work across devices with secure, versioned cloud history.',
      tone: 'var(--brand-tile-spreadsheet)',
      tint: 'var(--brand-tint-spreadsheet)',
      action: () => openSecondaryPanel('filesManager')
    }
  ]

  const sidebarNav = [
    { icon: 'ph-light ph-house', labelKey: 'Home', active: true, group: 'main', action: () => {} },
    {
      icon: 'ph-light ph-plus-square',
      labelKey: 'New',
      active: false,
      group: 'main',
      action: goToNewDocumentScreen
    },
    {
      icon: 'ph-light ph-clock',
      labelKey: 'Recent',
      active: false,
      group: 'main',
      action: () => scrollToSection('recent')
    },
    {
      icon: 'ph-light ph-star',
      labelKey: 'Starred',
      active: false,
      group: 'main',
      action: () => scrollToSection('recent')
    },
    {
      icon: 'ph-light ph-share-network',
      labelKey: 'Shared',
      active: false,
      group: 'main',
      action: () => scrollToSection('shared')
    },
    {
      icon: 'ph-light ph-cloud',
      labelKey: 'Cloud Documents',
      active: false,
      group: 'dynadoc',
      action: () => scrollToSection('recent')
    },
    {
      icon: 'ph-light ph-desktop',
      labelKey: 'This Computer',
      active: false,
      group: 'local-desktop',
      action: () => scrollToSection('recent'),
      desktopOnly: true
    }
  ]

  let editors = $state<any[]>([])
  let pinnedIds = $state<string[]>([])
  let recentDocsRaw = $state<RecentDocumentEntry[]>([])
  let nowTick = $state(Date.now())
  let ephemeralStatus = $state<Record<string, { deadlineAt: string; remainingMs: number }>>({})

  let searchQuery = $state('')
  let searchResults = $state<RecentRow[]>([])
  let searching = $state(false)
  let searchError = $state<string | null>(null)
  let viewMode = $state<'list' | 'grid'>('list')
  let showPinnedOnly = $state(false)
  let isPremiumPlan = $derived(
    ['pro', 'corporate', 'onprem', 'business', 'enterprise'].includes(
      ($authStore?.effectivePlanType || $authStore?.planType || '').toLowerCase()
    )
  )

  const unsubscribeEditors = _$_documentEditorsList.subscribe((list) => {
    editors = Array.isArray(list) ? list : []
  })
  const unsubscribePins = _$_pinnedRecentDocuments.subscribe((list) => {
    pinnedIds = Array.isArray(list) ? list : []
  })
  const unsubscribeRecent = _$_recentDocuments.subscribe((list) => {
    recentDocsRaw = Array.isArray(list) ? list : []
  })

  $effect(() => {
    void refreshEphemeralStatuses()
  })

  onDestroy(() => {
    unsubscribeEditors?.()
    unsubscribePins?.()
    unsubscribeRecent?.()
  })

  onMount(() => {
    const id = window.setInterval(() => {
      nowTick = Date.now()
    }, 60_000)
    return () => window.clearInterval(id)
  })

  const activeDoc = $derived.by(() => editors.find((editor) => editor.isActive))
  const ddocExtensionsWithDot = Object.values(Utils.DYNADOC_EXTENSIONS)

  function resolveFileTypeFromPath(filePath?: string | null): RecentRow['type'] {
    if (!filePath || !nodeApi.path) return 'unknown'
    const ext = nodeApi.path.extname(filePath).toLowerCase()
    if (['.ppt', Utils.OFFICE_EXTENSIONS.powerpoint, '.slide'].includes(ext)) return 'slide'
    if (['.xls', Utils.OFFICE_EXTENSIONS.excel, '.csv', '.sheet'].includes(ext)) return 'excel'
    if ([Utils.PDF_EXTENSION].includes(ext)) return Utils.FILE_TYPES.pdf
    if (ddocExtensionsWithDot.includes(ext)) return Utils.DYNADOC_EXTENSIONS_FORMAT.name
    return 'word'
  }

  function formatDate(value?: string | null) {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  }

  function buildRecentRows(list: RecentDocumentEntry[]): RecentRow[] {
    const pinnedSet = new Set(pinnedIds)
    const sorted = [...list].sort((a, b) => {
      const timeA = a.openedAt ? new Date(a.openedAt).getTime() : 0
      const timeB = b.openedAt ? new Date(b.openedAt).getTime() : 0
      return timeB - timeA
    })

    const mapped = sorted.map((item) => {
      const documentPath = item.path || item.remotePath || ''
      return {
        ...item,
        type: resolveFileTypeFromPath(documentPath),
        locationLabelKey: isDesktopPlatform ? 'Local' : 'Cloud'
      } satisfies RecentRow
    })

    const pinnedItems = mapped.filter((file) => pinnedSet.has(file.id))
    const regularItems = mapped.filter((file) => !pinnedSet.has(file.id))
    return showPinnedOnly ? pinnedItems : [...pinnedItems, ...regularItems]
  }

  const recentDocs = $derived.by(() => {
    const activeOrg = $authStore?.activeOrg || ''
    return recentDocsRaw.filter((entry) => !entry.accountOrg || entry.accountOrg === activeOrg)
  })
  const recentRows = $derived.by(() => buildRecentRows(recentDocs))

  // ---- Tableau de bord ----
  // Chaque zone ci-dessous est branchée sur une donnée que l'application
  // possède déjà. Les zones sans source (partages reçus, nombre de
  // destinataires) ne sont pas affichées du tout plutôt que remplies de
  // contenu de démonstration.
  type TypeStyle = { tone: string; tint: string; icon: string }

  function styleForType(type: RecentRow['type']): TypeStyle {
    if (type === Utils.DYNADOC_EXTENSIONS_FORMAT.name) {
      return {
        tone: 'var(--brand-tile-design)',
        tint: 'var(--brand-tint-design)',
        icon: 'ph-light ph-file-lock'
      }
    }
    if (type === Utils.FILE_TYPES.pdf) {
      return {
        tone: 'var(--brand-tile-form)',
        tint: 'var(--brand-tint-form)',
        icon: 'ph-light ph-file-pdf'
      }
    }
    if (type === 'excel') {
      return {
        tone: 'var(--brand-tile-spreadsheet)',
        tint: 'var(--brand-tint-spreadsheet)',
        icon: 'ph-light ph-table'
      }
    }
    if (type === 'slide') {
      return {
        tone: 'var(--brand-tile-presentation)',
        tint: 'var(--brand-tint-presentation)',
        icon: 'ph-light ph-presentation-chart'
      }
    }
    return {
      tone: 'var(--brand-tile-document)',
      tint: 'var(--brand-tint-document)',
      icon: 'ph-light ph-file-text'
    }
  }

  /** Where the file lives, from what the entry actually carries. */
  function locationOf(entry: RecentRow): string {
    if (entry.remotePath || entry.remoteRef) return get(_)('Cloud Documents')
    const dir = entry.parentPath || entry.dirPath
    if (dir && nodeApi.path) return nodeApi.path.basename(dir) || dir
    return get(_)('This Computer')
  }

  const recentCards = $derived.by(() =>
    recentRows.slice(0, 3).map((entry) => {
      const style = styleForType(entry.type)
      const ephemeral = ephemeralStatus[entry.id]
      return {
        entry,
        name: documentDisplayName(entry.path) || entry.name,
        where: locationOf(entry),
        when: entry.updatedAt || entry.openedAt,
        expiry: ephemeral ? formatRemaining(ephemeral.remainingMs) : '',
        ...style
      }
    })
  )

  /** The document to resume: the open editor, else the most recent entry. */
  const resumeTarget = $derived.by(() => {
    const doc = activeDoc?.document
    if (doc) {
      const path = doc.getMainFilePath?.() || doc.path || ''
      return {
        kind: 'editor' as const,
        name: doc.name || documentDisplayName(path),
        path,
        where: path && nodeApi.path ? nodeApi.path.basename(nodeApi.path.dirname(path)) : '',
        style: styleForType(resolveFileTypeFromPath(path)),
        when: null as string | null,
        expiry: ''
      }
    }
    const entry = recentRows[0]
    if (!entry) return null
    const ephemeral = ephemeralStatus[entry.id]
    return {
      kind: 'recent' as const,
      name: documentDisplayName(entry.path) || entry.name,
      path: entry.path,
      where: locationOf(entry),
      style: styleForType(entry.type),
      when: entry.updatedAt || entry.openedAt,
      expiry: ephemeral ? formatRemaining(ephemeral.remainingMs) : '',
      entry
    }
  })

  /** "To review" is only shown when something real is in it: for now that is
      documents with an expiry the app has already computed. */
  const reviewItems = $derived.by(() =>
    recentRows
      .filter((entry) => ephemeralStatus[entry.id])
      .slice(0, 3)
      .map((entry) => ({
        entry,
        name: documentDisplayName(entry.path) || entry.name,
        remaining: formatRemaining(ephemeralStatus[entry.id].remainingMs),
        tone: badgeTone(ephemeralStatus[entry.id].remainingMs),
        ...styleForType(entry.type)
      }))
  )

  /** Drives, counted from the recent entries rather than from a storage quota
      the client does not have. */
  const drives = $derived.by(() => {
    const cloud = recentDocs.filter((entry) => entry.remotePath || entry.remoteRef).length
    const local = recentDocs.length - cloud
    const total = Math.max(1, recentDocs.length)
    const list = [
      {
        labelKey: 'Cloud Documents',
        count: cloud,
        share: `${Math.round((cloud / total) * 100)}%`,
        tone: 'var(--accent)'
      }
    ]
    if (isDesktopPlatform) {
      list.push({
        labelKey: 'This Computer',
        count: local,
        share: `${Math.round((local / total) * 100)}%`,
        tone: 'var(--brand-tile-document)'
      })
    }
    return list
  })

  async function handleResume() {
    const target = resumeTarget
    if (!target) return
    if (target.kind === 'editor') {
      await handleResumeActive()
      return
    }
    await handleOpenRecent(target.entry)
  }

  function formatRemaining(ms: number): string {
    if (!Number.isFinite(ms)) return ''
    if (ms <= 0) return $_('Expired')
    const minute = 60_000
    const hour = 60 * minute
    const day = 24 * hour
    if (ms < minute) return '<1m'
    if (ms < hour) return `${Math.max(1, Math.round(ms / minute))}m`
    if (ms < day) {
      const hours = Math.floor(ms / hour)
      const mins = Math.floor((ms % hour) / minute)
      return mins ? `${hours}h ${mins}m` : `${hours}h`
    }
    const days = Math.floor(ms / day)
    const hours = Math.floor((ms % day) / hour)
    return hours ? `${days}d ${hours}h` : `${days}d`
  }

  function badgeTone(remainingMs: number) {
    if (remainingMs <= 3_600_000) return 'danger'
    if (remainingMs <= 86_400_000) return 'warning'
    return 'safe'
  }

  async function refreshEphemeralStatuses() {
    const entries = recentRows
    if (!entries.length) {
      ephemeralStatus = {}
      return
    }
    const updates: Record<string, { deadlineAt: string; remainingMs: number }> = {}
    await Promise.all(
      entries.map(async (entry) => {
        const status = await DocumentModel.getEphemeralStatusForPath(entry.path)
        if (status?.deadlineAt) {
          updates[entry.id] = {
            deadlineAt: status.deadlineAt,
            remainingMs: status.remainingMs
          }
        }
      })
    )
    ephemeralStatus = updates
  }

  async function handleCreate(type: DocumentContentType) {
    await EditorCommonUtils.addNewDocumentEditor(null, null, undefined, type, 'default')
  }

  async function handleOpenDialog() {
    const t = get(_)
    const paths = await window.api.openDialogFiles([
      { name: t('Dynadoc'), extensions: ddocExtensionsWithDot.map((ext) => ext.replace('.', '')) },
      {
        name: t('Documents'),
        extensions: ['docx', Utils.FILE_TYPES.pdf, 'pptx', 'xlsx', 'html', 'htm', 'txt']
      },
      { name: t('All Files'), extensions: ['*'] }
    ])

    const normalized = Array.isArray(paths) ? paths : paths ? [paths] : []
    if (!normalized.length) return
    for (const filePath of normalized) {
      await EditorCommonUtils.openDocumentFromInput(filePath, { parentPath: null })
    }
  }

  async function handleOpenSharedLink() {
    let clipboardText = ''
    try {
      const { text } = await EditorCommonUtils.readFromClipboard()
      clipboardText = text || ''
    } catch {
      clipboardText = ''
    }
    await EditorCommonUtils.openSharedLinkPrompt(clipboardText)
  }

  async function handleOpenRecent(file: RecentDocumentEntry) {
    if (!file?.path) return
    await EditorCommonUtils.openDocumentFromInput(file.path, {
      parentPath: file.parentPath || null
    })
  }

  async function handleResumeActive() {
    const doc = activeDoc?.document
    if (!doc?.getMainFilePath?.() && !doc?.path) return
    await EditorCommonUtils.openDocumentFromInput(doc.getMainFilePath?.() || doc.path, {
      parentPath: doc.parentPath || null
    })
  }

  function togglePin(file: RecentDocumentEntry) {
    if (!file?.id) return
    _$_pinnedRecentDocuments.update((list) => {
      const next = Array.isArray(list) ? [...list] : []
      const idx = next.indexOf(file.id)
      if (idx >= 0) {
        next.splice(idx, 1)
      } else {
        next.unshift(file.id)
      }
      return next
    })
  }

  function scrollToSection(id: string) {
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function openSecondaryPanel(id: string) {
    _$_activeSecondarySidebarItem.set(id as any)
    _$_secondarySidebarVisible.set(true)
  }

  function mapSearchResult(item: any): RecentRow | null {
    if (!item) return null
    const documentPath = item.path || item.filePath || item.location || ''
    if (!documentPath) return null
    return {
      id: item.id || documentPath,
      name: item.name || item.title || documentDisplayName(documentPath) || get(_)('Untitled'),
      path: documentPath,
      parentPath: item.parentPath || null,
      dirPath: item.dirPath || null,
      extension: item.extension || null,
      updatedAt: item.updatedAt || null,
      openedAt: null,
      remotePath: item.remotePath || null,
      remoteRef: item.remoteRef || null,
      type: resolveFileTypeFromPath(documentPath),
      locationLabelKey: isDesktopPlatform ? 'Local' : 'Cloud'
    }
  }

  const runSearch = debounce(async (query: string) => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      searchResults = []
      searchError = null
      return
    }

    searching = true
    searchError = null
    try {
      const payload = await window.api.searchFiles({ query: trimmed, limit: 20 })
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.files)
          ? payload.files
          : Array.isArray(payload?.data)
            ? payload.data
            : []
      searchResults = list.map(mapSearchResult).filter(Boolean) as RecentRow[]
    } catch (error: any) {
      searchError = error?.message || get(_)('Search unavailable.')
      searchResults = []
    } finally {
      searching = false
    }
  }, 250)

  $effect(() => {
    runSearch(searchQuery)
  })
</script>

<div
  class="brand-ui flex min-h-screen bg-base-100 text-base-content font-sans selection:bg-primary/20 transition-colors duration-200"
>
  <!-- Rail d'icônes : la navigation tient en 68 px au lieu de 232, le contenu
       respire. Les libellés deviennent title + aria-label ; les cibles
       gardent 44 px. -->
  <aside
    class="w-[68px] shrink-0 border-r border-base-200 bg-base-200 flex flex-col items-center gap-4 py-5 transition-colors"
  >
    <img src={brandMark} alt="dynadoc" class="h-9 w-auto" />

    <nav class="flex flex-col gap-1.5">
      {#each sidebarNav.filter((n) => n.group === 'main') as item}
        <button
          class="dash-rail-btn"
          class:dash-rail-btn--on={item.active}
          title={$_(item.labelKey)}
          aria-label={$_(item.labelKey)}
          on:click={item.action}
        >
          <i class="{item.icon} text-[19px]"></i>
        </button>
      {/each}
    </nav>

    <div class="h-[1px] w-7 bg-base-100"></div>

    <nav class="flex flex-col gap-1.5">
      {#each sidebarNav.filter((n) => n.group === 'dynadoc' || n.group === 'local-desktop') as item}
        {#if !item.desktopOnly || isDesktopPlatform}
          <button
            class="dash-rail-btn"
            title={$_(item.labelKey)}
            aria-label={$_(item.labelKey)}
            on:click={item.action}
          >
            <i class="{item.icon} text-[19px]"></i>
          </button>
        {/if}
      {/each}
    </nav>

    <button
      class="dash-rail-btn mt-auto"
      title={$_('Open file manager')}
      aria-label={$_('Open file manager')}
      on:click={() => openSecondaryPanel('filesManager')}
    >
      <i class="ph-light ph-folders text-[19px]"></i>
    </button>
  </aside>

  <main class="flex-grow flex flex-col min-w-0 bg-base-100">
    <!-- Navigation courte et centrée, recherche et réglages à droite. Trois
         colonnes au-dessus de md pour que la nav soit vraiment centrée ;
         empilées en dessous, ce qui est la seule forme tenable à 400 px. -->
    <header
      class="border-b border-base-200 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-3 sticky top-0 bg-base-100/85 backdrop-blur-md z-10"
    >
      <div class="hidden md:block"></div>

      <nav class="dash-nav justify-self-center">
        <button class="dash-nav-item" on:click={() => scrollToSection('top')}>
          {$_('Dashboard')}
        </button>
        <button class="dash-nav-item" on:click={() => scrollToSection('recent')}>
          {$_('Documents')}
        </button>
        <button class="dash-nav-item" on:click={() => scrollToSection('shared')}>
          {$_('Shared')}
        </button>
        <button class="dash-nav-item" on:click={goToNewDocumentScreen}>
          {$_('Templates')}
        </button>
      </nav>

      <div class="flex items-center gap-2 md:justify-self-end">
        <div
          class="flex items-center bg-base-200 rounded-full px-3.5 h-9 flex-grow md:flex-grow-0 focus-within:ring-1 focus-within:ring-primary transition-all"
        >
          <i class="ph-light ph-magnifying-glass opacity-40 text-[15px]"></i>
          <input
            type="text"
            placeholder={$_('Search files, templates, people...')}
            class="bg-transparent border-none py-1.5 pl-2 pr-1 text-sm w-full md:w-52 focus:outline-none outline-none"
            bind:value={searchQuery}
          />
        </div>
      </div>
    </header>

    <div class="p-8 overflow-y-auto">
      {#if searchQuery.trim().length >= 2}
        <section class="mb-10">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold tracking-tight">{$_('Search Results')}</h2>
            {#if searching}
              <span class="text-xs opacity-50">{$_('Searching...')}</span>
            {/if}
          </div>
          {#if searchError}
            <div class="text-sm text-error">{searchError}</div>
          {:else if searchResults.length === 0 && !searching}
            <div class="text-sm opacity-60">{$_('No results found.')}</div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {#each searchResults as item}
                <button
                  on:click={() => handleOpenRecent(item)}
                  class="text-left border border-base-200 rounded-md p-4 hover:border-primary hover:shadow-md transition-all"
                >
                  <div class="flex items-start gap-3">
                    <i
                      class="ph-light {item.type === Utils.FILE_TYPES.pdf
                        ? 'ph-file-pdf text-error'
                        : item.type === 'slide'
                          ? 'ph-file-ppt text-orange-400'
                          : item.type === 'excel'
                            ? 'ph-file-xls text-green-500'
                            : 'ph-file-text text-primary'} text-xl"
                    ></i>
                    <div class="min-w-0">
                      <div class="text-sm font-semibold truncate">{item.name}</div>
                      <div class="text-xs opacity-60 truncate">{item.path}</div>
                      <div class="text-[10px] opacity-40 mt-1">{formatDate(item.updatedAt)}</div>
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </section>
      {/if}

      <!-- Le teal n'habille qu'une seule chose : Reprendre. Tout le reste est
           neutre ou porte la teinte de son type de document. -->
      <section id="top" class="mb-8">
        <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div class="min-w-0">
            <h2 class="text-[34px] font-light tracking-tight leading-none">{$_('Dashboard')}</h2>
            <p class="text-sm text-base-content/60 mt-2">{$_('Pick up where you left off.')}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            {#each quickCreate as item}
              <button
                class="dash-chip"
                style="--tile:{item.color}"
                on:click={() => handleCreate(item.id)}
              >
                <i class="{item.icon} text-[15px]" style="color:var(--tile)"></i>
                {$_(item.labelKey)}
              </button>
            {/each}
          </div>
        </div>

        <div class="flex flex-wrap gap-5 items-start">
          <!-- Documents récents : une teinte par type, pas de couleur gratuite -->
          <section class="dash-card flex-1 basis-[320px] min-w-0">
            <div class="flex items-start justify-between gap-3 mb-4">
              <div class="min-w-0">
                <h3 class="text-base font-semibold tracking-tight">{$_('Recent Documents')}</h3>
                <p class="text-xs text-base-content/60 mt-0.5">
                  {$_('Your most recently opened files.')}
                </p>
              </div>
              <button
                class="dash-ghost-round shrink-0"
                aria-label={$_('See all')}
                on:click={() => scrollToSection('recent')}
              >
                <i class="ph-light ph-arrow-up-right text-[15px]"></i>
              </button>
            </div>

            {#if recentCards.length}
              <div class="flex flex-col gap-2.5">
                {#each recentCards as card}
                  <button
                    class="dash-doc"
                    style="--tint:{card.tint}; --tile:{card.tone}"
                    on:click={() => handleOpenRecent(card.entry)}
                  >
                    <span class="flex items-start gap-2.5 w-full">
                      <i class="{card.icon} text-[18px] shrink-0 mt-0.5" style="color:var(--tile)"
                      ></i>
                      <span class="min-w-0 flex-1 text-left">
                        <span class="block text-sm font-semibold truncate">{card.name}</span>
                        <span class="block text-xs text-base-content/60 truncate mt-0.5"
                          >{card.where}</span
                        >
                      </span>
                    </span>
                    <span class="flex items-center flex-wrap gap-2 mt-3">
                      <span class="dash-pill-soft">{formatDate(card.when)}</span>
                      {#if card.expiry}
                        <span class="dash-pill-soft">{$_('Expires in')} {card.expiry}</span>
                      {/if}
                    </span>
                  </button>
                {/each}
              </div>
            {:else}
              <div class="dash-empty">
                <i class="ph-light ph-file-text text-2xl opacity-40"></i>
                <p class="text-sm font-semibold mt-2">{$_('No document yet')}</p>
                <p class="text-xs text-base-content/60 mt-1">
                  {$_('Open or create a document to see it here.')}
                </p>
              </div>
            {/if}
          </section>

          <div class="flex-[999_1_420px] min-w-0 flex flex-col gap-5">
            <!-- Reprendre : la grande zone, le seul élément accentué -->
            <section class="dash-card">
              {#if resumeTarget}
                <div class="flex flex-wrap items-start justify-between gap-4 mb-5">
                  <div class="min-w-0">
                    <h3 class="text-base font-semibold tracking-tight">{$_('Resume')}</h3>
                    <p class="text-xs text-base-content/60 mt-0.5">{$_('Last session')}</p>
                  </div>
                  <button class="dash-primary shrink-0" on:click={handleResume}>
                    <i class="ph-light ph-arrow-right text-[15px]"></i>
                    {$_('Resume')}
                  </button>
                </div>

                <div class="flex flex-wrap gap-5 items-start">
                  <div class="flex-[999_1_240px] min-w-0">
                    <div class="flex items-start gap-2.5">
                      <i
                        class="{resumeTarget.style.icon} text-[20px] shrink-0 mt-0.5"
                        style="color:{resumeTarget.style.tone}"
                      ></i>
                      <div class="min-w-0">
                        <div class="text-lg font-semibold tracking-tight truncate">
                          {resumeTarget.name}
                        </div>
                        {#if resumeTarget.where}
                          <div class="text-xs text-base-content/60 truncate mt-1">
                            {resumeTarget.where}
                          </div>
                        {/if}
                      </div>
                    </div>
                    <div class="flex flex-wrap gap-2 mt-4">
                      {#if resumeTarget.when}
                        <span class="dash-pill">{formatDate(resumeTarget.when)}</span>
                      {/if}
                      {#if resumeTarget.expiry}
                        <span class="dash-pill">{$_('Expires in')} {resumeTarget.expiry}</span>
                      {/if}
                    </div>
                    <div class="flex flex-wrap gap-2 mt-4">
                      <button class="dash-outline" on:click={handleOpenDialog}>{$_('Open')}</button>
                      <button class="dash-outline" on:click={handleOpenSharedLink}>
                        {$_('Open shared link')}
                      </button>
                    </div>
                  </div>
                </div>
              {:else}
                <!-- Nouvel utilisateur : rien à reprendre, on propose de partir. -->
                <h3 class="text-base font-semibold tracking-tight">{$_('Get started')}</h3>
                <p class="text-xs text-base-content/60 mt-0.5 mb-5">
                  {$_('Nothing to resume yet.')}
                </p>
                <div class="flex flex-wrap gap-3">
                  <button class="dash-primary" on:click={() => handleCreate('text')}>
                    <i class="ph-light ph-plus text-[15px]"></i>
                    {$_('Start your first document')}
                  </button>
                  <button class="dash-outline" on:click={handleOpenDialog}>
                    {$_('Import a file')}
                  </button>
                  <button class="dash-outline" on:click={goToNewDocumentScreen}>
                    {$_('Templates')}
                  </button>
                </div>
              {/if}
            </section>

            <div class="flex flex-wrap gap-5 items-start">
              {#if reviewItems.length}
                <!-- Affichée seulement quand l'application a vraiment quelque
                     chose à y mettre : ici, des documents qui expirent. -->
                <section class="dash-card flex-[999_1_280px] min-w-0">
                  <h3 class="text-base font-semibold tracking-tight">{$_('To review')}</h3>
                  <p class="text-xs text-base-content/60 mt-0.5 mb-3">
                    {$_('Documents with an expiry date.')}
                  </p>
                  <div class="flex flex-col">
                    {#each reviewItems as item}
                      <div class="dash-row">
                        <span
                          class="dash-row__icon"
                          style="--tint:{item.tint}; --tile:{item.tone}"
                          aria-hidden="true"
                        >
                          <i class="{item.icon} text-[16px]"></i>
                        </span>
                        <span class="min-w-0 flex-1 text-left">
                          <span class="block text-sm font-semibold truncate">{item.name}</span>
                          <span class="block text-xs text-base-content/60 mt-0.5">
                            {$_('Expires in')}
                            {item.remaining}
                          </span>
                        </span>
                        <button
                          class="dash-outline dash-outline--sm shrink-0"
                          on:click={() => handleOpenRecent(item.entry)}
                        >
                          {$_('Open')}
                        </button>
                      </div>
                    {/each}
                  </div>
                </section>
              {/if}

              <section class="dash-card flex-1 basis-[240px] min-w-0">
                <h3 class="text-base font-semibold tracking-tight">{$_('Your drives')}</h3>
                <p class="text-xs text-base-content/60 mt-0.5 mb-4">
                  {$_('Where your recent documents sit.')}
                </p>
                <div class="flex flex-col gap-4">
                  {#each drives as drive}
                    <div>
                      <div class="flex items-center gap-2 mb-2">
                        <span class="text-sm font-semibold flex-1 min-w-0 truncate"
                          >{$_(drive.labelKey)}</span
                        >
                        <span class="text-xs text-base-content/60 shrink-0">{drive.count}</span>
                      </div>
                      <div class="dash-bar">
                        <div style="width:{drive.share}; background:{drive.tone}"></div>
                      </div>
                    </div>
                  {/each}
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      {#if $_$_isFeatureEnabled('quickTools')}
        <!-- Derrière l'interrupteur « quickTools ». Posée après « À traiter »
             et « Vos lecteurs » pour ne pas passer devant la reprise. -->
        <section class="mb-8">
          <h2 class="text-base font-semibold tracking-tight mb-3">{$_('Quick Tools')}</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {#each featureCards as card}
              <button class="dash-card text-left" style="--tile:{card.tone}" on:click={card.action}>
                <span
                  class="dash-row__icon mb-3"
                  style="--tint:{card.tint}; --tile:{card.tone}"
                  aria-hidden="true"
                >
                  <i class="{card.icon} text-[17px]"></i>
                </span>
                <span class="block text-sm font-semibold">{$_(card.titleKey)}</span>
                <span class="block text-xs text-base-content/60 leading-relaxed mt-1">
                  {$_(card.descriptionKey)}
                </span>
              </button>
            {/each}
          </div>
        </section>
      {/if}

      {#if !isPremiumPlan}
        <!-- Le plan tient sur une ligne, pas sur une carte. -->
        <div class="dash-planline mb-8">
          <span class="text-sm font-semibold">{$_('Pilot plan')}</span>
          <span class="text-sm text-base-content/60 flex-1 min-w-0">
            {$_('Free during the pilot.')}
          </span>
          <button
            class="dash-outline dash-outline--sm shrink-0"
            on:click={() => openUpgradePlanModal({ source: 'home', highlight: 'pro' })}
          >
            {$_('Compare plans')}
          </button>
        </div>
      {/if}

      <section id="cloud-documents" class="mb-10">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-2xl font-black tracking-tighter">{$_('Cloud Documents')}</h2>
            <p class="text-sm opacity-75">
              {$_('Manage your connected drives without opening a document.')}
            </p>
          </div>
          <button class="btn btn-sm btn-ghost" on:click={() => openSecondaryPanel('filesManager')}>
            <i class="ph-light ph-folder-open mr-1"></i>
            {$_('Open file manager')}
          </button>
        </div>
        <div class="border border-base-200 rounded-lg overflow-hidden h-[360px]">
          <DriveExplorerWidget />
        </div>
      </section>

      <section id="recent">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold tracking-tight">{$_('Recent Documents')}</h2>
          <div class="flex items-center gap-2">
            <button
              class="btn btn-xs btn-ghost"
              class:opacity-60={!showPinnedOnly}
              on:click={() => (showPinnedOnly = !showPinnedOnly)}
            >
              <i class="ph-light ph-push-pin mr-1"></i>
              {$_('Pinned')}
            </button>
            <div class="join border border-base-200">
              <button
                class="join-item btn btn-xs btn-ghost"
                class:active={viewMode === 'list'}
                on:click={() => (viewMode = 'list')}
              >
                <i class="ph-light ph-list"></i>
              </button>
              <button
                class="join-item btn btn-xs btn-ghost"
                class:active={viewMode === 'grid'}
                on:click={() => (viewMode = 'grid')}
              >
                <i class="ph-light ph-squares-four"></i>
              </button>
            </div>
          </div>
        </div>

        {#if viewMode === 'list'}
          <div class="overflow-x-auto border border-base-200 rounded-sm bg-base-100 shadow-sm">
            <table class="table table-compact w-full">
              <thead class="bg-base-200 border-b border-base-200">
                <tr class="text-[10px] uppercase tracking-widest opacity-60 font-black">
                  <th class="bg-transparent">{$_('Name')}</th>
                  <th class="bg-transparent">{$_('Location')}</th>
                  <th class="bg-transparent">{$_('Modified')}</th>
                  <th class="bg-transparent text-right">{$_('Pin')}</th>
                </tr>
              </thead>
              <tbody>
                {#if recentRows.length === 0}
                  <tr>
                    <td colspan="4" class="text-center text-sm opacity-50 py-6">
                      {$_('No recent documents yet.')}
                    </td>
                  </tr>
                {:else}
                  {#each recentRows as file}
                    {@const status = ephemeralStatus[file.id]}
                    <tr class="hover:bg-base-200/50 cursor-pointer transition-colors group">
                      <td on:click={() => handleOpenRecent(file)}>
                        <div class="flex items-center gap-3">
                          <i
                            class="ph-light {file.type === Utils.FILE_TYPES.pdf
                              ? 'ph-file-pdf text-error'
                              : file.type === 'slide'
                                ? 'ph-file-ppt text-orange-400'
                                : file.type === 'excel'
                                  ? 'ph-file-xls text-green-500'
                                  : 'ph-file-text text-primary'} text-xl"
                          ></i>
                          <div class="min-w-0 flex items-center gap-2">
                            <span class="text-[13px] font-medium truncate">{file.name}</span>

                            {#if status}
                              {@const remainingMs = status.remainingMs - (Date.now() - nowTick)}
                              <span
                                class="text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded
                                  {badgeTone(remainingMs) === 'danger'
                                  ? 'bg-rose-500/25 text-rose-200'
                                  : badgeTone(remainingMs) === 'warning'
                                    ? 'bg-amber-500/20 text-amber-200'
                                    : 'bg-emerald-500/20 text-emerald-200'}"
                                title={`${$_('Expires at')}: ${new Date(status.deadlineAt).toLocaleString()}`}
                              >
                                {remainingMs <= 0
                                  ? $_('Expired')
                                  : `${formatRemaining(remainingMs)} ${$_('...left')}`}
                              </span>
                            {/if}
                          </div>
                        </div>
                      </td>
                      <td class="text-xs opacity-60">{$_(file.locationLabelKey)}</td>
                      <td class="text-xs opacity-60"
                        >{formatDate(file.updatedAt || file.openedAt)}</td
                      >
                      <td class="text-right">
                        <button class="btn btn-ghost btn-xs" on:click={() => togglePin(file)}>
                          <i
                            class="ph-light {pinnedIds.includes(file.id)
                              ? 'ph-push-pin-fill text-primary'
                              : 'ph-push-pin'}"
                          ></i>
                        </button>
                      </td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each recentRows as file, i}
              {@const status = ephemeralStatus[file.id]}
              <div
                class="wps-recent-card border border-base-200 rounded-md p-4 hover:border-primary hover:shadow-md transition-all text-left"
                style="animation-delay:{Math.min(i, 12) * 35}ms"
                on:click={() => handleOpenRecent(file)}
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-start gap-3">
                    <i
                      class="ph-light {file.type === Utils.FILE_TYPES.pdf
                        ? 'ph-file-pdf text-error'
                        : file.type === 'slide'
                          ? 'ph-file-ppt text-orange-400'
                          : file.type === 'excel'
                            ? 'ph-file-xls text-green-500'
                            : 'ph-file-text text-primary'} text-xl"
                    ></i>
                    <div class="min-w-0">
                      <div class="text-sm font-semibold truncate flex items-center gap-2">
                        {file.name}

                        {#if status}
                          {@const remainingMs = status.remainingMs - (Date.now() - nowTick)}
                          <span
                            class="text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded
                              {badgeTone(remainingMs) === 'danger'
                              ? 'bg-rose-500/25 text-rose-200'
                              : badgeTone(remainingMs) === 'warning'
                                ? 'bg-amber-500/20 text-amber-200'
                                : 'bg-emerald-500/20 text-emerald-200'}"
                            title={`${$_('Expires at')}: ${new Date(status.deadlineAt).toLocaleString()}`}
                          >
                            {remainingMs <= 0
                              ? $_('Expired')
                              : `${formatRemaining(remainingMs)} ${$_('...left')}`}
                          </span>
                        {/if}
                      </div>
                      <div class="text-xs opacity-50 truncate">{file.path}</div>
                      <div class="text-[10px] opacity-40 mt-1">
                        {formatDate(file.updatedAt || file.openedAt)}
                      </div>
                    </div>
                  </div>
                  <button class="btn btn-ghost btn-xs" on:click={() => togglePin(file)}>
                    <i
                      class="ph-light {pinnedIds.includes(file.id)
                        ? 'ph-push-pin-fill text-primary'
                        : 'ph-push-pin'}"
                    ></i>
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <section id="shared" class="mt-10">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold tracking-tight">{$_('Shared with you')}</h2>
          <button class="btn btn-xs btn-ghost" on:click={handleOpenSharedLink}>
            <i class="ph-light ph-link mr-1"></i>
            {$_('Open shared link')}
          </button>
        </div>
        <div class="border border-base-200 rounded-md p-6 bg-base-100 text-sm opacity-75">
          {$_(
            'Collaborations and shared links appear here. Paste a shared link to open a live document.'
          )}
        </div>
      </section>
    </div>
  </main>
</div>

<style>
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    @apply bg-[var(--color-base-300)] rounded-full;
  }
  ::-webkit-scrollbar-thumb:hover {
    @apply bg-neutral/30;
  }
</style>
