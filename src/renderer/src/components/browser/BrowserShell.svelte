<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte'
  import Platform from '../../libs/platform'
  import {
    browserActions,
    _$_browserTabs,
    _$_browserDownloads,
    _$_browserPermissionPrompt
  } from '../../stores/browser.store'
  import { _ } from 'svelte-i18n'
  // var dropdown moved to overlay view
  import { setBrowserBounds } from './browserViewRegistry'
  import { mountEmbeddedView, navigateEmbeddedView } from './embeddedViewHost'
  import CustomVarExtensionDropdown from '../../extensions/tiptap/CustomVarExtension/components/CustomVarExtensionDropdown.svelte'
  import type { BrowserTab, BrowserDownload, PermissionPrompt } from '../../stores/browser.store'
  import { cryptoRandomUUID } from '../../utils/common.utils'

  interface Props {
    __isVisible?: boolean
  }

  let { __isVisible = true }: Props = $props()

  let container: HTMLDivElement | null = null
  let address = ''
  let selectedTabId: string | null = null
  let searchResults: { url: string; title?: string }[] = []
  let showSuggestions = false
  let disposeEmbedded: (() => void) | null = null
  let embeddedId: string | null = null
  const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
  const localTabSeed = cryptoRandomUUID()
  // const localTabSeed = cryptoRandomUUID()
  let localTabs = $state<BrowserTab[]>([
    {
      id: localTabSeed,
      url: 'https://www.google.com',
      title: 'Google',
      isLoading: false,
      isActive: true,
      lastActiveAt: Date.now(),
      hibernated: false
    }
  ])
  let desktopTabs = $state<BrowserTab[]>([])
  let desktopDownloads = $state<BrowserDownload[]>([])
  let desktopPermissionPrompt = $state<PermissionPrompt | null>(null)

  const tabsStore = _$_browserTabs
  const downloadsStore = _$_browserDownloads
  const permissionStore = _$_browserPermissionPrompt
  const tabs = $derived(isDesktopPlatform ? desktopTabs : localTabs)
  const downloads = $derived(isDesktopPlatform ? desktopDownloads : [])
  const permissionPrompt = $derived(isDesktopPlatform ? desktopPermissionPrompt : null)
  const activeTab = $derived(tabs.find((tab) => tab.isActive) ?? tabs[0] ?? null)

  /* 
  // Add this helper function at the top of your script
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return cryptoRandomUUID();
  }
  // Fallback for non-secure contexts
  return ([1e7].toString() + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  );
}

// Update your variables
const localTabSeed = generateId();

function createLocalTab(url: string = 'https://www.google.com'): BrowserTab {
  return {
    id: generateId(), // Use the helper here
    url,
    title: readableHost(url) || 'Google',
    isLoading: false,
    isActive: true,
    lastActiveAt: Date.now(),
    hibernated: false
  }
}

// And inside onMount
embeddedId = activeTab?.id ?? embeddedId ?? generateId();
  */

  function createLocalTab(url: string = 'https://www.google.com'): BrowserTab {
    return {
      id: cryptoRandomUUID(),
      url,
      title: readableHost(url) || 'Google',
      isLoading: false,
      isActive: true,
      lastActiveAt: Date.now(),
      hibernated: false
    }
  }

  function syncBounds() {
    if (!container || !isDesktopPlatform) return
    const rect = container.getBoundingClientRect()
    const bounds = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    }
    browserActions.setBounds(bounds)
    setBrowserBounds(bounds)
  }

  function scheduleBoundsSync() {
    if (!container) return
    requestAnimationFrame(() => {
      syncBounds()
      setTimeout(syncBounds, 0)
    })
  }

  function handleActivate(id: string) {
    selectedTabId = id
    if (isDesktopPlatform) {
      browserActions.activateTab(id)
      return
    }

    localTabs = localTabs.map((tab) => ({
      ...tab,
      isActive: tab.id === id,
      lastActiveAt: tab.id === id ? Date.now() : tab.lastActiveAt
    }))
  }

  function handleNavigate(tabId: string) {
    if (!address.trim()) return
    if (isDesktopPlatform) {
      browserActions.navigate(tabId, address)
    } else {
      const normalized = normalizeBrowserUrl(address)
      address = normalized
      localTabs = localTabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              url: normalized,
              title: readableHost(normalized),
              isLoading: true,
              lastActiveAt: Date.now()
            }
          : tab
      )
    }
    showSuggestions = false
  }

  async function handleSearchInput() {
    if (!address.trim()) {
      searchResults = []
      showSuggestions = false
      return
    }
    if (!isDesktopPlatform) {
      searchResults = []
      showSuggestions = false
      return
    }
    const results = await browserActions.queryHistory(address)
    searchResults = results || []
    showSuggestions = true
  }

  function handleSuggestionClick(item: { url: string }) {
    address = item.url
    if (selectedTabId) handleNavigate(selectedTabId)
  }

  function handleNewTab() {
    if (isDesktopPlatform) {
      browserActions.createTab('https://www.google.com')
      return
    }

    const nextTab = createLocalTab()
    selectedTabId = nextTab.id
    address = nextTab.url
    localTabs = [
      ...localTabs.map((tab) => ({ ...tab, isActive: false })),
      nextTab
    ]
  }

  function handleCloseTab(id: string) {
    if (isDesktopPlatform) {
      browserActions.closeTab(id)
      return
    }

    const remainingTabs = localTabs.filter((tab) => tab.id !== id)
    if (remainingTabs.length === 0) {
      const replacementTab = createLocalTab()
      selectedTabId = replacementTab.id
      address = replacementTab.url
      localTabs = [replacementTab]
      return
    }

    const nextActiveId = remainingTabs.some((tab) => tab.id === selectedTabId)
      ? selectedTabId
      : remainingTabs[remainingTabs.length - 1]?.id

    localTabs = remainingTabs.map((tab) => ({
      ...tab,
      isActive: tab.id === nextActiveId
    }))
  }

  function handleReload() {
    if (selectedTabId && isDesktopPlatform) {
      browserActions.reload(selectedTabId)
      return
    }

    if (activeTab && container && embeddedId) {
      localTabs = localTabs.map((tab) =>
        tab.id === activeTab.id ? { ...tab, isLoading: true } : tab
      )
      navigateEmbeddedView(container, embeddedId, activeTab.url)
    }
  }

  function normalizeBrowserUrl(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    if (trimmed.includes(' ') || !trimmed.includes('.')) {
      return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
    }
    return `https://${trimmed}`
  }

  function readableHost(value: string) {
    try {
      return new URL(value).hostname.replace(/^www\./, '')
    } catch {
      return value
    }
  }

  onMount(() => {
    const cleanups: Array<() => void> = []

    if (isDesktopPlatform) {
      cleanups.push(
        tabsStore.subscribe((tabs) => {
          desktopTabs = tabs
          const active = tabs.find((tab) => tab.isActive) || tabs[0]
          if (active) {
            selectedTabId = active.id
            address = active.url || ''
          }
        })
      )
      cleanups.push(downloadsStore.subscribe((items) => (desktopDownloads = items)))
      cleanups.push(permissionStore.subscribe((value) => (desktopPermissionPrompt = value)))

      const resizeObserver = new ResizeObserver(() => syncBounds())
      if (container) resizeObserver.observe(container)
      scheduleBoundsSync()
      cleanups.push(() => resizeObserver.disconnect())
    } else if (container) {
      embeddedId = activeTab?.id ?? embeddedId ?? cryptoRandomUUID()
      address = activeTab?.url || address
      mountEmbeddedView(container, {
        id: embeddedId,
        url: activeTab?.url || 'about:blank',
        onEvent: (payload) => {
          if (payload.type === 'dom-ready' && activeTab) {
            localTabs = localTabs.map((tab) =>
              tab.id === activeTab.id ? { ...tab, isLoading: false } : tab
            )
          }
        }
      }).then((dispose) => {
        disposeEmbedded = dispose
      })
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  })

  $effect(() => {
    if (!isDesktopPlatform) {
      return
    }

    if (!__isVisible) {
      browserActions.setVisible(false)
      browserActions.setBounds({ x: 0, y: 0, width: 0, height: 0 })
      return
    }
    browserActions.setVisible(true)
    tick().then(() => scheduleBoundsSync())
  })

  $effect(() => {
    if (isDesktopPlatform || !container || !embeddedId || !activeTab) return

    selectedTabId = activeTab.id
    address = activeTab.url || ''
    navigateEmbeddedView(container, embeddedId, activeTab.url || 'about:blank')
  })

  onDestroy(() => {
    disposeEmbedded?.()
    disposeEmbedded = null

    if (isDesktopPlatform) {
      browserActions.setBounds({ x: 0, y: 0, width: 0, height: 0 })
    }
  })
</script>


<div class="h-full flex flex-col bg-base-200 text-[#e1e1e1] font-sans select-none overflow-hidden">
  <div class="flex items-center h-9 bg-[#1e1e1e] border-b border-black/20 px-1 gap-px">
    
    {#each tabs as tab}
      <div class="pro-tab {tab.isActive ? 'active' : ''}" onclick={() => handleActivate(tab.id)}>
        <div class="flex items-center gap-2 min-w-0">
          {#if tab.isActive}
            <div class="size-1.5 rd-full bg-base-300"></div>
          {/if}
          <span class="truncate text-[11px] font-600 uppercase tracking-tight">
            {tab.title || $_('Loading...')}
          </span>
        </div>
        <button
          class="hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] rd-[2px] p-0.5"
          onclick={(e) => {
            e.stopPropagation()
            handleCloseTab(tab.id)
          }}
        >
          <i class="ph-bold ph-x text-[10px]"></i>
        </button>
      </div>
    {/each}
  </div>

  <div
    class="flex items-center gap-3 px-3 py-2 bg-base-100 border-b border-black/40 shadow-sm z-50"
  >
    <div class="flex items-center p-0.5 bg-black/20 rd-[4px] border border-white/5">
      <button
        class="adobe-nav-btn"
        onclick={() => selectedTabId && isDesktopPlatform && browserActions.goBack(selectedTabId)}
      >
        <i class="ph-bold ph-arrow-left"></i>
      </button>
      <button
        class="adobe-nav-btn"
        onclick={() =>
          selectedTabId && isDesktopPlatform && browserActions.goForward(selectedTabId)}
      >
        <i class="ph-bold ph-arrow-right"></i>
      </button>
      <div class="w-px h-3 bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] mx-0.5"></div>
      <button
        class="adobe-nav-btn"
        onclick={handleReload}
      >
        <i class="ph-bold ph-arrows-clockwise"></i>
      </button>
    </div>

    <div class="relative flex-1 group">
      <div
        class="absolute left-3 top-[35%] -translate-y-1/2 flex items-center gap-2 pointer-events-none"
      >
        <i class="ph-bold ph-lock-key text-emerald-400 text-[12px]"></i>
      </div>
      <input
        class="adobe-omnibox"
        bind:value={address}
        placeholder={$_('https:// or search...')}
        onkeydown={(e) => e.key === 'Enter' && selectedTabId && handleNavigate(selectedTabId)}
        oninput={handleSearchInput}
        data-var-allow="true"
      />

      {#if showSuggestions && searchResults.length > 0}
        <div class="adobe-dropdown">
          {#each searchResults as item}
            <button class="dropdown-item" onclick={() => handleSuggestionClick(item)}>
              <div class="flex items-center gap-2">
                <i class="ph-bold ph-globe text-base-content/30"></i>
                <span class="truncate font-600">{item.title || $_('Untitled')}</span>
              </div>
              <span class="text-[9px] text-base-content/20 truncate uppercase tracking-widest pl-6"
                >{item.url}</span
              >
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="flex items-center gap-1">
      <button class="adobe-tool-btn" onclick={handleNewTab}>
        <i class="ph-bold ph-plus text-base-300"></i>
      </button>
      <button class="adobe-tool-btn" title={isDesktopPlatform ? $_('Process isolated browser') : $_('Sandboxed web browser')}>
        <i class="ph-bold {isDesktopPlatform ? 'ph-app-window' : 'ph-globe-hemisphere-west'}"></i>
      </button>
    </div>
  </div>

  <div class="flex-1 relative bg-black">
    <div class="absolute inset-0" bind:this={container}></div>

    {#if permissionPrompt}
      <div class="adobe-alert-toast">
        <div class="flex items-center gap-3">
          <div class="size-8 rd-full bg-base-300/20 flex items-center justify-center">
            <i class="ph-fill ph-shield-check text-base-300"></i>
          </div>
          <div>
            <div class="text-[11px] font-800 uppercase tracking-widest text-base-content/40">
              {$_('Request Access')}
            </div>
            <div class="text-[12px] font-600">{$_('Allow {permission}?', { values: { permission: permissionPrompt.permission } })}</div>
          </div>
        </div>
        <div class="flex gap-2 mt-4 justify-end">
          <button
            class="adobe-btn-secondary"
            onclick={() => {
              browserActions.respondPermission(permissionPrompt.requestId, false)
              permissionStore.set(null)
            }}>{$_('Deny')}</button
          >
          <button
            class="adobe-btn-primary"
            onclick={() => {
              browserActions.respondPermission(permissionPrompt.requestId, true)
              permissionStore.set(null)
            }}>{$_('Accept')}</button
          >
        </div>
      </div>
    {/if}
  </div>

  <div class="h-6 bg-base-100 border-t border-black/40 flex items-center justify-between px-3">
    <div
      class="flex items-center gap-4 text-[9px] font-800 uppercase tracking-[0.15em] text-base-content/30"
    >
      <span class="flex items-center gap-1"
        ><i class="ph-bold ph-activity text-emerald-400"></i> {isDesktopPlatform ? $_('Render Engine 2026') : $_('Sandboxed Browser Bridge')}</span
      >
      <span>{$_('{count} Workspace(s)', { values: { count: tabs.length } })}</span>
    </div>

    {#if downloads.length > 0}
      <div class="flex items-center gap-3">
        {#each downloads as dl}
          <div class="flex items-center gap-2 h-4 px-2 bg-black/30 rd-[2px] border border-white/5">
            <span class="text-[9px] font-700 text-base-content/50 truncate max-w-[60px]">{dl.filename}</span>
            <div class="w-12 h-1 bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] rd-full overflow-hidden">
              <div
                class="h-full bg-base-300"
                style="width: {(dl.receivedBytes / dl.totalBytes) * 100}%"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .adobe-nav-btn {
    @apply size-7 flex items-center justify-center text-[var(--color-base-content)]/40 hover:text-[var(--color-base-content)] hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] transition-all active:scale-95;
  }

  .adobe-tool-btn {
    @apply size-8 flex items-center justify-center text-[var(--color-base-content)]/30 hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rd-[4px];
  }

  .adobe-omnibox {
    @apply w-full h-8 bg-black/30 border border-white/5 rd-[4px] pl-8 pr-3 text-[12px] text-[var(--color-base-content)]/90 
           placeholder-white/10 transition-all outline-none focus:(bg-black/50 border-[var(--color-base-300)]/50 ring-1 ring-[var(--color-base-300)]/20);
  }

  .pro-tab {
    @apply h-full min-w-[140px] max-w-[200px] flex items-center justify-between px-3 gap-3 
           bg-transparent border-r border-black/20 text-[var(--color-base-content)]/40 transition-all;
  }
  .pro-tab.active {
    @apply bg-[var(--color-base-100)] text-[var(--color-base-content)] border-b-2 border-b-[var(--color-base-300)];
  }

  .adobe-dropdown {
    @apply absolute mt-1 w-full bg-[#2a2a2a] border border-black/60 rd-[4px] shadow-2xl overflow-hidden py-1;
  }
  .dropdown-item {
    @apply w-full text-left px-3 py-2 hover:bg-[var(--color-base-300)] flex flex-col gap-0.5;
  }

  .adobe-alert-toast {
    @apply absolute right-4 bottom-4 w-[320px] bg-[var(--color-base-200)] border border-white/10 rd-[6px] p-4 shadow-2xl;
  }

  .adobe-btn-primary {
    @apply px-4 py-1.5 bg-[var(--color-base-300)] text-[var(--color-base-content)] text-[11px] font-800 uppercase tracking-widest rd-[3px] hover:bg-[#009D8E];
  }
  .adobe-btn-secondary {
    @apply px-4 py-1.5 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-[var(--color-base-content)]/60 text-[11px] font-800 uppercase tracking-widest rd-[3px] hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)];
  }

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
</style>
