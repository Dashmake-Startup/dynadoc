<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { _ } from 'svelte-i18n'
  import { _$_documentEditorsList } from '../../../stores/editor.store'
  import {
    _$_leftSidebarVisible,
    _$_rightSidebarVisible,
    _$_primarySidebarVisible,
    _$_secondarySidebarVisible,
    _$_terminalVisible,
    _$_currentView,
    _$_tabListContainerHeight,
    toggle
  } from '../../../stores/common.store'
  import { _$_tabListOrder } from '../../../stores/common.store'

  import DocumentEditor from '../../../DocumentEditor.svelte'
  import Ribbon from '../ribbon/Ribbon.svelte'
  import MobileRibbon from '../ribbon/MobileRibbon.svelte'
  import { viewport } from '../../../stores/viewport.store'
  import { NavigationTab } from '../../../models/Tab'
  import { _$_ribbbonVisible, _$_ribbonAutoHidden } from '../../../stores/ribbon.store'
  import Utils from '../../../utils/Utils'
  import Platform from '../../../libs/platform'
  import { goToHomeScreen, goToNewDocumentScreen } from '../../../utils/common.utils'
  import NavigationTabContextMenu from '../../common/contextMenu/components/NavigationTabContextMenu.svelte'
  import ContextMenu from '../../common/contextMenu/ContextMenu.svelte'
  import NavigationTabPopupMenu from '../../common/contextMenu/components/NavigationTabPopupMenu.svelte'
  import EditorCommonUtils from '../../../utils/common.utils'
  import EditorHelpers from '../../../utils/EditorHelpers'
  import { nodeApi } from '../../../utils/shims/node'
  import { openAddFilesToDocumentModal } from '../../../stores/addFilesToDocumentModal.store'
  //   const nodeApi =
  //     typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
  //   const fs = nodeApi?.fs
  //   const path = nodeApi?.path

  type LiteTab = {
    id: string
    title?: string
    displayTitle?: string
    suffix?: string
    isActive?: boolean
    isDirty?: boolean
    isSaving?: boolean
  }

  // Svelte 5 Props
  let {
    __elements = [],
    __draggable = false,
    __mode = 'app',
    __hideHeader = false,
    __onSelect = null,
    __onClose = null,
    __onAdd = null,
    __onAddFileToDocument = null
  } = $props<{
    __elements?: Array<NavigationTab | LiteTab>
    __draggable?: boolean
    __mode?: 'app' | 'lite'
    __hideHeader?: boolean
    __onSelect?: ((id: string) => void) | null
    __onClose?: ((id: string) => void) | null
    __onAdd?: (() => void) | null
    __onAddFileToDocument?: (() => void) | null
  }>()

  let scrollContainer = $state<HTMLElement>()
  let tabListContainer = $state<HTMLElement | null>(null)
  let tabListHeaderContainer = $state<HTMLElement | null>(null)
  let _contextMenuOpen = $state(false)
  let _contextMenuX = $state(0)
  let _contextMenuY = $state(0)
  let _contextMenuTab = $state<NavigationTab | null>(null)
  let draggingTabId = $state<string | null>(null)
  let dragOverTabId = $state<string | null>(null)
  let dragInsertPosition = $state<'before' | 'after'>('before')
  let nowTick = $state(Date.now())
  // const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop

  type TabView = NavigationTab & { displayTitle: string; suffix?: string; __key?: string }

  function splitParentSegments(filePath: string): string[] {
    if (!nodeApi.path || !filePath) return []
    const dir = nodeApi.path.dirname(filePath)
    if (!dir) return []
    const parts = dir.split(nodeApi.path.sep).filter(Boolean)
    return parts.reverse()
  }

  // Document-type badge for the tab pill (icon + brand colour by file type).
  // Native documents carry their kind in contentType (matches the home-screen
  // create cards); imported office files fall back to their extension.
  function tabBadge(
    ext?: string | null,
    contentType?: string | null
  ): { icon: string; color: string } {
    switch (contentType) {
      case 'text':
        return { icon: 'ph-light ph-file-text', color: '#2b579a' }
      case 'sheet':
        return { icon: 'ph-light ph-table', color: '#217346' }
      case 'slide':
        return { icon: 'ph-light ph-presentation-chart', color: '#d24726' }
      case 'design':
        return { icon: 'ph-light ph-paint-brush-broad', color: '#8b5cf6' }
      case 'form':
        return { icon: 'ph-light ph-textbox', color: '#e0457b' }
      case 'meeting':
        return { icon: 'ph-light ph-video-camera', color: '#e0a313' }
    }
    const e = (ext || '').toLowerCase().replace(/^\./, '')
    if (['doc', 'docx', 'odt', 'rtf'].includes(e))
      return { icon: 'ph-light ph-file-text', color: '#2b579a' }
    if (['xls', 'xlsx', 'xlsm', 'csv', 'ods', 'sheet'].includes(e))
      return { icon: 'ph-light ph-table', color: '#217346' }
    if (['ppt', 'pptx', 'odp', 'slide'].includes(e))
      return { icon: 'ph-light ph-presentation-chart', color: '#d24726' }
    if (e === 'pdf') return { icon: 'ph-light ph-file-pdf', color: '#cf3a2f' }
    return { icon: 'ph-light ph-file-text', color: 'var(--accent)' }
  }

  function buildDisplayTabs(tabs: NavigationTab[]): TabView[] {
    const grouped = new Map<string, NavigationTab[]>()
    tabs.forEach((tab) => {
      const key = tab.title || 'Untitled'
      const list = grouped.get(key) || []
      list.push(tab)
      grouped.set(key, list)
    })

    return tabs.map((tab) => {
      const list = grouped.get(tab.title) || []
      if (list.length <= 1 || !nodeApi.path) {
        return { ...tab, displayTitle: tab.title, suffix: '' }
      }

      const stacks = list.map((entry) => splitParentSegments(entry.documentPath))
      let depth = 1
      let suffix = ''
      const index = list.indexOf(tab)
      while (depth <= 5) {
        const candidate = stacks[index].slice(0, depth).join(nodeApi.path.sep)
        const isUnique = stacks.every((stack, idx) => {
          if (idx === index) return true
          return stack.slice(0, depth).join(nodeApi.path.sep) !== candidate
        })
        if (candidate) {
          suffix = candidate
        }
        if (isUnique) break
        depth += 1
      }
      return { ...tab, displayTitle: tab.title, suffix }
    })
  }

  const isLite = $derived(__mode === 'lite')

  function buildUniqueTabKeys<T extends { id?: string; documentPath?: string; title?: string }>(
    tabs: T[]
  ): Array<T & { __key: string }> {
    const seen = new Map<string, number>()
    const normalized = tabs.filter(Boolean) as T[]
    return normalized.map((tab, index) => {
      const base =
        (tab?.id ?? tab?.documentPath ?? tab?.title ?? `tab-${index}`)?.toString() || `tab-${index}`
      const count = seen.get(base) ?? 0
      seen.set(base, count + 1)
      const key = count === 0 ? base : `${base}::${count}`
      return { ...tab, __key: key }
    })
  }

  let displayTabs = $derived.by(() => {
    const sourceTabs = (__elements || []) as any[]
    if (isLite) {
      const liteTabs = sourceTabs.map((tab) => ({
        ...tab,
        displayTitle: tab.displayTitle || tab.title || tab.name || $_('Untitled'),
        suffix: tab.suffix || ''
      }))
      return buildUniqueTabKeys(liteTabs)
    }
    const tabs = buildDisplayTabs(sourceTabs as NavigationTab[])
    const order = $_$_tabListOrder || []
    if (!order.length) return buildUniqueTabKeys(tabs)
    const map = new Map(tabs.map((tab) => [tab.id, tab]))
    const ordered = order.map((id) => map.get(id)).filter(Boolean) as TabView[]
    const rest = tabs.filter((tab) => !order.includes(tab.id))
    return buildUniqueTabKeys([...ordered, ...rest])
  })

  const renderElements = $derived.by(() => {
    const source = (__elements || []) as any[]
    return buildUniqueTabKeys(source)
  })

  //  Active Logic
  async function handleSelectTab(tabId: string) {
    if (isLite) {
      __onSelect?.(tabId)
      return
    }
    const ok = await ensureTabCacheReady(tabId)
    if (!ok) return
    _$_documentEditorsList.setActive(tabId)
    _$_currentView.set('editor')
  }

  async function ensureTabCacheReady(tabId: string): Promise<boolean> {
    if (!nodeApi?.path || !nodeApi?.fs) return true
    const editor = _$_documentEditorsList.getItem(tabId)
    const doc = editor?.document
    if (!doc) return true
    const isNonWysiwyg = Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST.includes(doc.extension)

    const cachePath = doc.cachePath || ''
    const mainPath = doc.getMainFilePath?.() || ''
    const cacheExists = cachePath ? await nodeApi.fsPromises?.exists(cachePath) : false
    const mainExists = mainPath ? await nodeApi.fsPromises?.exists(mainPath) : false

    if (cacheExists && (mainExists || isNonWysiwyg)) {
      return true
    }

    const sourcePath = doc.path
    if (sourcePath && (await nodeApi.fsPromises?.exists(sourcePath))) {
      return true
    }
    if (!sourcePath || !(await nodeApi.fsPromises?.exists(sourcePath))) {
      await EditorCommonUtils.addNewDocumentEditor(sourcePath, doc.parentPath || null)
      return false
    }

    const needsConfirm = editor?.isDirty
    if (needsConfirm) {
      const ok = await EditorCommonUtils.confirmCloseIfUnsaved(editor)
      if (!ok) return false
    }

    _$_documentEditorsList.closeTab(tabId)
    await EditorCommonUtils.addNewDocumentEditor(sourcePath, doc.parentPath || null)
    return false
  }

  function syncRibbonForTab(tab: NavigationTab | undefined) {
    if (!tab) return
    const ext = (tab.documentExtension || '').toLowerCase()
    // The ribbon (= editing tools) stays deployed on every editor document,
    // including native .html docs. It is hidden only for non-editable media
    // previews (PDF, image, video, audio).
    _$_ribbonAutoHidden.set(Utils.MEDIA_PREVIEW_EXTENSIONS_LIST.includes(ext))
  }

  function handleDragStartTab(tabId: string) {
    // if (isLite) return
    draggingTabId = tabId
  }

  function handleDragOverTab(event: DragEvent, tabId: string) {
    // if (isLite) return
    event.preventDefault()
    dragOverTabId = tabId
    const target = event.currentTarget as HTMLElement
    if (target) {
      const rect = target.getBoundingClientRect()
      dragInsertPosition = event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
    }
  }

  function handleDropTab(targetId: string) {
    // if (isLite) return
    if (!draggingTabId || draggingTabId === targetId) return
    const ids = displayTabs.map((tab) => tab.id)
    const fromIndex = ids.indexOf(draggingTabId)
    const toIndex = ids.indexOf(targetId)
    if (fromIndex < 0 || toIndex < 0) return
    ids.splice(fromIndex, 1)
    const insertIndex = dragInsertPosition === 'after' ? toIndex + 1 : toIndex
    ids.splice(insertIndex > ids.length ? ids.length : insertIndex, 0, draggingTabId)
    _$_documentEditorsList.reorderByIds(ids)
    _$_tabListOrder.set(ids)
    draggingTabId = null
    dragOverTabId = null
    dragInsertPosition = 'before'
  }

  $effect(() => {
    if (isLite) return
    const active = __elements?.find((tab: NavigationTab) => tab.isActive)
    syncRibbonForTab(active)
  })

  function handleContextMenu(event: MouseEvent, tab: NavigationTab) {
    console.log('handleContextMenu', { tab })
    // if (isLite) return
    event.preventDefault()
    event.stopPropagation()
    _contextMenuX = event.clientX
    _contextMenuY = event.clientY
    _contextMenuTab = tab
    _contextMenuOpen = true
    console.log('handleContextMenu 2', { tab })
  }

  async function handleCloseTab(e: MouseEvent, tab: NavigationTab) {
    // console.log('handleCloseTab 1')
    e.stopPropagation() // Prevent tab selection when closing
    // if (isLite) {
    //   __onClose?.(tab.id)
    //   return
    // }
    console.log('handleCloseTab 12')

    const editor = _$_documentEditorsList.getItem(tab.id)
    console.log('handleCloseTab 13')
    // Check the unsaved status only on desktop because on web and mobile the save is automatic
    if (Platform.isDesktopPlatform) {
      const ok = await EditorCommonUtils.confirmCloseIfUnsaved(editor)
      console.log('handleCloseTab 14')
      if (!ok) return
      console.log('handleCloseTab 15')
    }

    _$_documentEditorsList.closeTab(tab.id)
  }

  async function revealTab(tab: NavigationTab) {
    if (!tab?.documentPath) return
    const target = nodeApi.path?.dirname?.(tab.documentPath) || tab.documentPath
    await window.api.openFile(target)
  }

  async function duplicateTab(tab: NavigationTab) {
    if (!tab?.documentPath) return
    await EditorCommonUtils.addNewDocumentEditor(tab.documentPath, null)
  }

  function pinTab(tab: NavigationTab) {
    const order = $_$_tabListOrder || []
    const next = [tab.id, ...order.filter((id) => id !== tab.id)]
    _$_tabListOrder.set(next)
  }

  /*   async function closeTab(tab: NavigationTab) {
    const editor = _$_documentEditorsList.getItem(tab.id)
    const ok = await EditorCommonUtils.confirmCloseIfUnsaved(editor)
    if (!ok) return
    _$_documentEditorsList.closeTab(tab.id)
  } */

  async function saveTab(tab: NavigationTab, saveAs = false) {
    const editor = _$_documentEditorsList.getItem(tab.id)
    if (!editor) return
    await EditorHelpers.saveDocumentEditor(editor, saveAs ? { saveAs: true } : false)
  }

  const unsavedCount = $derived.by(() => displayTabs.filter((tab) => tab.isDirty).length)

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

  function getEphemeralBadge(tab: NavigationTab): {
    label: string
    isExpired: boolean
    deadlineLabel: string
    tone: 'danger' | 'warning' | 'safe'
    readsLeft?: number | null
    writesLeft?: number | null
  } | null {
    nowTick
    const editor = _$_documentEditorsList.getItem(tab.id)
    const remaining = editor?.document?.getEphemeralTimeRemaining?.()
    if (!remaining) return null
    const label = formatRemaining(remaining.remainingMs)
    if (!label) return null
    const deadlineLabel = new Date(remaining.deadlineAt).toLocaleString()
    const tone =
      remaining.remainingMs <= 3_600_000
        ? 'danger'
        : remaining.remainingMs <= 86_400_000
          ? 'warning'
          : 'safe'
    return {
      label,
      isExpired: remaining.remainingMs <= 0,
      deadlineLabel,
      tone,
      readsLeft: typeof remaining.readsLeft === 'number' ? remaining.readsLeft : null,
      writesLeft: typeof remaining.writesLeft === 'number' ? remaining.writesLeft : null
    }
  }

  function getTabMaxWidth(tab: NavigationTab) {
    const badge = getEphemeralBadge(tab)
    if (tab.isDirty || badge) {
      return '320px'
    }
    return '220px'
  }

  async function handleOpenAddFilesToDocumentModal() {
    // ── 1. Resolve the active document root ────────────────────────────────
    const activeTab = (displayTabs as any[]).find((t) => t.isActive) as NavigationTab | undefined

    // documentPath is the full path to the file (e.g. /home/user/project/main.ddoc)
    const documentPath = activeTab?.documentPath ?? ''
    if (!documentPath) {
      console.warn('handleOpenAddFilesToDocumentModal: no active document path')
      return
    }

    // For multi-file projects (LaTeX, etc.) the editor's parentPath is the
    // project root. Prefer it over dirname(documentPath) when available.
    const editor = _$_documentEditorsList.getItem(activeTab?.id ?? '')
    const editorParentPath = editor?.document?.parentPath ?? ''
    const documentRootPath =
      editorParentPath && editorParentPath !== documentPath
        ? editorParentPath
        : (nodeApi.path?.dirname?.(documentPath) ?? '')

    if (!documentRootPath) {
      console.warn('handleOpenAddFilesToDocumentModal: could not resolve documentRootPath')
      return
    }

    // ── 2. Open the modal ───────────────────────────────────────────────────
    const result = await openAddFilesToDocumentModal({
      documentRootPath,
      documentParentPath: documentRootPath
    })

    // ── 3. Open selected / created files as tabs ────────────────────────────
    if (!result.confirmed || !result.selectedPaths.length) return

    for (const filePath of result.selectedPaths) {
      // Skip directories – only open files
      try {
        const stat = await nodeApi.fsPromises?.stat(filePath)
        if (stat?.isDirectory?.()) continue
      } catch {
        // stat failed – still try opening the file
      }
      await EditorCommonUtils.addNewDocumentEditor(filePath, documentRootPath)
    }
  }

  // Scroll utilities
  function scroll(direction: 'left' | 'right') {
    if (!scrollContainer) return
    const amount = direction === 'left' ? -200 : 200
    scrollContainer.scrollBy({ left: amount, behavior: 'smooth' })
  }
  onMount(() => {
    // Initial height sync for the layout engine
    if (tabListContainer) {
      _$_tabListContainerHeight.set(tabListContainer.offsetHeight)

      const ro = new ResizeObserver(() => {
        _$_tabListContainerHeight.set(tabListContainer.offsetHeight)
      })
      if (tabListContainer) ro?.observe(tabListContainer)
      return () => ro.disconnect()
    }
  })

  onMount(() => {
    const id = window.setInterval(() => {
      nowTick = Date.now()
    }, 60_000)
    return () => window.clearInterval(id)
  })
  $effect(() => {
    const activeTab = __elements.find((t) => t.isActive)
    if (activeTab && scrollContainer) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        const activeEl = scrollContainer.querySelector('.tab-active')
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
        }
      }, 50)
    }
  })
</script>

{#if isLite && !__onAdd}
  <div class="tablist-root flex flex-col w-full bg-base-200" bind:this={tabListContainer}>
    <div class="tablist-header flex items-center h-10 px-1 relative">
      <div
        bind:this={scrollContainer}
        class="tablist-scroll flex-grow flex items-center overflow-x-auto no-scrollbar h-full scroll-smooth"
      >
        {#each displayTabs as element (element.__key)}
          {@const badge = tabBadge(
            (element as any).documentExtension,
            (element as any).documentContentType
          )}
          <ContextMenu
            __component={NavigationTabPopupMenu}
            __trigger={draggingTabId ? 'manual' : 'mouseenter'}
            __placement="bottom-start"
            __offset={[0, 8]}
            __interactive={!draggingTabId}
            __delay={[180, 80]}
            __disabled={Boolean(draggingTabId)}
            __props={{
              __tab: element,
              __onReveal: () => revealTab(element),
              __onClose: (e) => handleCloseTab(e, element),
              __onPin: () => pinTab(element),
              __onDuplicate: () => duplicateTab(element)
            }}
          >
            <button
              onclick={() => handleSelectTab(element.id)}
              oncontextmenu={(event) => handleContextMenu(event, element)}
              draggable={true}
              ondragstart={() => handleDragStartTab(element.id)}
              ondragover={(event) => handleDragOverTab(event, element.id)}
              ondrop={() => handleDropTab(element.id)}
              class="relative h-full flex items-center px-4 gap-3 min-w-[120px]
                   transition-all duration-200 group border-r border-base-100/30 rounded-tl-md rounded-tr-md"
              class:bg-base-100={element.isActive}
              class:tab-active={element.isActive}
              class:text-primary={element.isActive}
              style={`max-width: ${getTabMaxWidth(element)};`}
            >
              <span
                class="flex-none flex items-center justify-center"
                style="width:16px;height:16px;color:{badge.color};line-height:1;"
                ><i class="{badge.icon} text-[15px]"></i></span
              >
              <span class="truncate tracking-wider flex-grow text-left">
                {element.displayTitle || $_('Untitled')}
                {#if element.isDirty}
                  <span class="ml-2 text-[9px] uppercase tracking-[0.2em] text-amber-400">•</span>
                {/if}
                {#if true}
                  <!-- {#if !isLite} -->
                  {@const badge = getEphemeralBadge(element)}

                  {#if badge}
                    <span
                      class="ml-2 text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded
                      {badge.tone === 'danger'
                        ? 'bg-rose-500/25 text-rose-200'
                        : badge.tone === 'warning'
                          ? 'bg-amber-500/20 text-amber-200'
                          : 'bg-emerald-500/20 text-emerald-200'}"
                      title={`${$_('Expires at')}: ${badge.deadlineLabel}${
                        typeof badge.readsLeft === 'number'
                          ? ` | ${$_('Reads left')}: ${Math.max(0, badge.readsLeft)}`
                          : ''
                      }${
                        typeof badge.writesLeft === 'number'
                          ? ` | ${$_('Writes left')}: ${Math.max(0, badge.writesLeft)}`
                          : ''
                      }`}
                    >
                      {badge.isExpired ? $_('Expired') : `${badge.label} ${$_('...left')}`}
                    </span>
                  {/if}
                {/if}
              </span>
              {#if element.isActive}
                <div
                  class="flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-base-content/40"
                >
                  {#if element.isSaving}
                    <i class="ph-light ph-spinner-gap animate-spin text-[12px] text-blue-400"></i>
                    <span>{$_('Saving')}</span>
                  {:else if !element.isDirty}
                    <!-- <i class="ph-light ph-check-circle text-[12px] text-emerald-400"></i>
                  <span>{$_('Synced')}</span> -->
                  {/if}
                </div>
              {/if}
              <!-- <div
              onclick={(e) => handleCloseTab(e, element)}
              class="opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-error transition-all p-1"
            > -->
              <div
                onclick={(e) => handleCloseTab(e, element)}
                class="hover:text-error transition-all p-1 group-hover:opacity-100"
                class:opacity-0={!element.isActive}
                class:opacity-100={element.isActive}
              >
                <i class="ph-bold ph-x text-[10px]"></i>
              </div>
              {#if element.isActive}
                <div
                  class="absolute bottom-0 left-0 right-0 h-[2px] bg-primary animate-in fade-in slide-in-from-bottom-1"
                ></div>
              {/if}
            </button>
          </ContextMenu>
        {/each}
      </div>

      <NavigationTabContextMenu
        bind:__show={_contextMenuOpen}
        __x={_contextMenuX}
        __y={_contextMenuY}
        __tab={_contextMenuTab}
      />
    </div>
  </div>
{:else if __onAdd}
  {#if displayTabs.length > 0}
    <ContextMenu __placement="bottom">
      <button
        class="tablist-add-lite flex-none flex items-center justify-center w-7 h-7 ml-1 rounded-md text-base-content/60 hover:bg-base-300 hover:text-base-content transition-colors"
        title={$_('New')}
        aria-label={$_('New')}
      >
        <i class="ph-light ph-plus text-[15px]"></i>
      </button>
      <!-- <svelte:fragment slot="content">
              <p>Yes</p>
              <p onclick={() => __onAdd?.()}>Yes</p>
            </svelte:fragment> -->

      <svelte:fragment slot="content">
        <div class="quick-menu">
          <!-- <div class="quick-header">
            <span class="quick-title">{$_('Language')}</span>
            <span class="quick-sub">{$_('Current language')}</span>
          </div> -->
          <button
            class="quick-item"
            onclick={() =>
              __onAddFileToDocument ? __onAddFileToDocument() : handleOpenAddFilesToDocumentModal()}
          >
            <!-- <span class="quick-flag">{getFlagEmoji(lang.code)}</span> -->
            <span class="quick-name">{$_('Add file to document')}</span>
            <!-- <span class="quick-meta">{lang.native}</span> -->
          </button>
          <button class="quick-item" onclick={() => __onAdd?.()}>
            <!-- <span class="quick-flag">{getFlagEmoji(lang.code)}</span> -->
            <span class="quick-name">{$_('Add new document')}</span>
            <!-- <span class="quick-meta">{lang.native}</span> -->
          </button>
        </div>
      </svelte:fragment>
    </ContextMenu>
  {:else}
    <button
      class="tablist-add-lite flex-none flex items-center justify-center w-7 h-7 ml-1 rounded-md text-base-content/60 hover:bg-base-300 hover:text-base-content transition-colors"
      title={$_('New')}
      aria-label={$_('New')}
      onclick={() => __onAdd?.()}
    >
      <i class="ph-light ph-plus text-[15px]"></i>
    </button>
  {/if}
{:else}
  <div class="tablist-root flex flex-col w-full bg-base-200" bind:this={tabListContainer}>
    {#if !__hideHeader}
      <div class="tablist-header wps-tabband-chrome flex items-center h-10 px-1 relative">
        <div class="flex-shrink-0 flex items-center px-2">
          <!-- <slot name="tablist-prepend" /> -->
          <!-- <div class="flex flex-col border-b border-gray-900"> -->
          <div
            class="flex h-full border-b border-base-300 bg-base-300/10 text-xs font-medium p-3 rounded-tl-md rounded-tr-md"
          >
            <button
              type="button"
              class="flex-grow flex items-center justify-center cursor-pointer border-none outline-none"
              onclick={() => {
                goToHomeScreen()
                // _$_currentView.set('home')
              }}
            >
              <i class={'ph-light i-icon ph-house'}></i>
            </button>
            <!-- {/each} -->
          </div>
        </div>

        <div
          bind:this={scrollContainer}
          class="tablist-scroll flex-grow flex items-center overflow-x-auto no-scrollbar h-full scroll-smooth"
        >
          <!-- </div> -->
          {#each displayTabs as element (element.__key)}
            {@const badge = getEphemeralBadge(element)}
            {@const typeBadge = tabBadge(
              (element as any).documentExtension,
              (element as any).documentContentType
            )}
            <ContextMenu
              __component={NavigationTabPopupMenu}
              __trigger={draggingTabId ? 'manual' : 'mouseenter'}
              __placement="bottom-start"
              __offset={[0, 8]}
              __interactive={!draggingTabId}
              __delay={[180, 80]}
              __disabled={Boolean(draggingTabId)}
              __props={{
                __tab: element,
                __onReveal: () => revealTab(element),
                __onClose: (e) => handleCloseTab(e, element),
                __onPin: () => pinTab(element),
                __onDuplicate: () => duplicateTab(element)
              }}
            >
              <button
                onclick={() => handleSelectTab(element.id)}
                oncontextmenu={(event) => handleContextMenu(event, element)}
                draggable={true}
                ondragstart={() => handleDragStartTab(element.id)}
                ondragover={(event) => handleDragOverTab(event, element.id)}
                ondrop={() => handleDropTab(element.id)}
                class="relative h-full flex items-center px-4 gap-3 min-w-[120px]
                   transition-all duration-200 group border-r border-base-100/30 rounded-tl-md rounded-tr-md"
                class:bg-base-100={element.isActive}
                class:tab-active={element.isActive}
                class:text-primary={element.isActive}
                class:border-primary-70={dragOverTabId === element.id}
                style={`max-width: ${getTabMaxWidth(element)};`}
              >
                {#if dragOverTabId === element.id}
                  <div
                    class="absolute top-1 bottom-1 w-[2px] bg-primary rounded-full"
                    style={dragInsertPosition === 'before' ? 'left:4px;' : 'right:4px;'}
                  ></div>
                {/if}
                <i
                  class="{typeBadge.icon} text-[16px] opacity-70 group-hover:opacity-100 transition-opacity"
                  style="color:{typeBadge.color};"
                ></i>

                <span class="truncate tracking-wider flex-grow text-left">
                  {element.displayTitle || $_('Untitled')}
                  {#if element.suffix}
                    <span class="ml-1 text-[10px] opacity-50">— {element.suffix}</span>
                  {/if}
                  {#if Platform.isDesktopPlatform && element.isDirty}
                    <span class="ml-2 text-[10px] uppercase tracking-[0.2em] text-amber-400"
                      >{$_('Unsaved')}</span
                    >
                  {/if}

                  {#if badge}
                    <span
                      class="ml-2 text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded
                    {badge.tone === 'danger'
                        ? 'bg-rose-500/25 text-rose-200'
                        : badge.tone === 'warning'
                          ? 'bg-amber-500/20 text-amber-200'
                          : 'bg-emerald-500/20 text-emerald-200'}"
                      title={`${$_('Expires at')}: ${badge.deadlineLabel}${
                        typeof badge.readsLeft === 'number'
                          ? ` | ${$_('Reads left')}: ${Math.max(0, badge.readsLeft)}`
                          : ''
                      }${
                        typeof badge.writesLeft === 'number'
                          ? ` | ${$_('Writes left')}: ${Math.max(0, badge.writesLeft)}`
                          : ''
                      }`}
                    >
                      {badge.isExpired ? $_('Expired') : `${badge.label} ${$_('...left')}`}
                    </span>
                  {/if}
                </span>
                {#if element.isDirty}
                  <!-- <div class="inline-flex items-center gap-1">
                <button
                  class="px-2 py-1 rounded-md text-[9px] uppercase tracking-[0.2em] bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                  onclick={(e) => {
                    e.stopPropagation()
                    saveTab(element, false)
                  }}
                >
                  Save
                </button>
                <button
                  class="px-2 py-1 rounded-md text-[9px] uppercase tracking-[0.2em] bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                  onclick={(e) => {
                    e.stopPropagation()
                    saveTab(element, true)
                  }}
                >
                  Save As
                </button>
              </div> -->
                {/if}

                <!-- <div
                onclick={(e) => handleCloseTab(e, element)}
                class="opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-error transition-all p-1"
              > -->
                <div
                  onclick={(e) => handleCloseTab(e, element)}
                  class="hover:text-error transition-all p-1 group-hover:opacity-100"
                  class:opacity-0={!element.isActive}
                  class:opacity-100={element.isActive}
                >
                  <i class="ph-bold ph-x text-[10px]"></i>
                </div>

                {#if element.isActive}
                  <div
                    class="absolute bottom-0 left-0 right-0 h-[2px] bg-primary animate-in fade-in slide-in-from-bottom-1"
                  ></div>
                {/if}
              </button>
            </ContextMenu>
            <!-- sjsjsdjsjjsdjsd sdjsddsdskkskdskdsdddddd sdjsddsdskkskdskdsddddddsjsjsdjsjjsdjsd sdjsddsdskkskdskdsdddddd
        sdjsddsdskkskdskdsddddddsjsjsdjsjjsdjsd sdjsddsdskkskdskdsdddddd sdjsddsdskkskdskdsdddddd -->
          {/each}
          <div>
            <button
              id="add-new-document-editor"
              class="cursor-pointer w-9 h-full flex items-center justify-center hover:bg-primary/10 hover:text-primary border-l border-base-200 transition-colors"
              onclick={() => {
                goToNewDocumentScreen()
                // _$_currentView.set('new-doc')
                /* async () =>
          // _documentEditors =

          await EditorHelpers.addNewDocumentEditor(null, () => {
            // _canRenderComponents = true
          }) */
              }}
            >
              <!-- <img src={addRoundedIcon} alt="Add Icon" class="icon add-icon" /> -->
              <!-- <div class="text-base-content-600  w-[20px] max-w-[max-content]">{@html fluentUIcons.fluentUIconPaintBrush}</div> -->
              <i class="ph-light i-icon ph-plus"></i>

              <!-- {$_('ddoc-office')} -->
            </button>
          </div>
        </div>

        <NavigationTabContextMenu
          bind:__show={_contextMenuOpen}
          __x={_contextMenuX}
          __y={_contextMenuY}
          __tab={_contextMenuTab}
        />

        <div class="tablist-actions flex items-center h-full border-l border-base-200 bg-base-200">
          <!-- <slot name="tablist-append" /> -->
          <div>
            {#if Platform.isDesktopPlatform && unsavedCount > 0}
              <button
                class="cursor-pointer h-full px-3 flex items-center justify-center text-[10px] uppercase tracking-[0.2em] text-amber-300 hover:bg-amber-500/10 border-l border-base-200 transition-colors"
                onclick={() => EditorCommonUtils.saveAllUnsavedDocuments()}
                title={$_('Save All Unsaved')}
              >
                <i class="ph-bold ph-floppy-disk mr-2 text-[12px]"></i>{$_('Save All')}</button
              >
            {/if}
            <button
              id="add-new-document-editor"
              class="cursor-pointer w-9 h-full flex items-center justify-center hover:bg-primary/10 hover:text-primary border-l border-base-200 transition-colors"
              onclick={() => {
                goToNewDocumentScreen()
                // _$_currentView.set('new-doc')
                /* async () =>
          // _documentEditors =

          await EditorHelpers.addNewDocumentEditor(null, () => {
            // _canRenderComponents = true
          }) */
              }}
            >
              <!-- <img src={addRoundedIcon} alt="Add Icon" class="icon add-icon" /> -->
              <!-- <div class="text-base-content-600  w-[20px] max-w-[max-content]">{@html fluentUIcons.fluentUIconPaintBrush}</div> -->
              <i class="ph-light i-icon ph-plus"></i>

              <!-- {$_('ddoc-office')} -->
            </button>
          </div>
          <div class="flex items-center gap-0.5 px-2 border-l border-base-200 ml-2">
            <!-- <button onclick={() => _$_primarySidebarVisible.update((v) => !v)} class="toolbar-btn">
          <i class="ph-light ph-layout"></i>
        </button> -->
            <button onclick={() => toggle('ribbon')} class="toolbar-btn">
              <i class="ph-light ph-rows"></i>
            </button>
          </div>
        </div>
      </div>
    {/if}

    <div class="relative w-full overflow-hidden">
      {#each renderElements as entry (entry.__key)}
        {@const element = entry}
        <div class:hidden={!element.isActive} class="w-full">
          <DocumentEditor key={element.__key}>
            <svelte:fragment slot="ribbon">
              <!-- {#if $_$_ribbbonVisible} -->
              {#if $viewport.isMobile}
                <MobileRibbon />
              {:else}
                <div class="bg-base-100 animate-in fade-in duration-300">
                  <Ribbon />
                </div>
              {/if}
              <!-- {/if} -->
            </svelte:fragment>
          </DocumentEditor>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .quick-menu {
    @apply w-64 rounded-lg overflow-hidden font-sans;
    background: var(--theme-popover-bg);
    border: 1px solid var(--theme-border-subtle);
    box-shadow: var(--theme-popover-shadow);
    color: var(--theme-text-1);
  }

  .quick-header {
    @apply px-3 py-2 flex flex-col gap-0.5;
    border-bottom: 1px solid var(--theme-border-subtle);
    background: var(--theme-elevated-strong);
  }

  .quick-title {
    @apply text-[10px] font-black uppercase tracking-[0.2em];
    color: var(--theme-elevated-text);
    /* color: var(--theme-text-muted); */
  }

  .quick-sub {
    @apply text-[10px];
    color: color-mix(in srgb, var(--theme-text-1) 45%, transparent);
  }

  .quick-item {
    @apply w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] transition-colors;
    color: color-mix(in srgb, var(--theme-text-1) 72%, transparent);
  }

  .quick-item:hover {
    background: var(--theme-elevated-strong);
  }

  .quick-item.active {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    color: var(--theme-text-1);
  }

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .toolbar-btn {
    @apply p-1.5 rounded-[4px] hover:bg-[var(--color-base-300)] text-[var(--color-base-content)]/60 hover:text-[var(--color-base-content)] transition-all text-lg;
  }

  /* Adobe Spectrum Tab Logic */
  .theme-tablist-root {
    --vscode-tab-activeBackground: transparent; /* Cleaning up old styles */
  }

  @media (max-width: 768px) {
    .tablist-header {
      height: 44px;
      padding-left: 4px;
      padding-right: 4px;
    }
    .tablist-scroll button {
      min-width: 96px;
      padding-left: 10px;
      padding-right: 10px;
      gap: 8px;
      font-size: 12px;
    }
    .tablist-actions {
      display: none;
    }
  }
</style>
