import { writable, get, type Writable } from 'svelte/store'
import Platform from '../libs/platform'
import { _$_ribbbonVisible, _$_ribbonUserVisible, _$_ribbonAutoHidden } from './ribbon.store'
import { createUiPersistedStore, initializeUiPersistence } from './uiPersistence'

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

const ui = (key: string) => `ui:${key}`

export async function initializeCommonStore() {
  try {
    await initializeUiPersistence()
    if (!_isDesktopPlatform) {
      _$_terminalVisible.set(false)
    }
    console.log('[boot] commonStoreHydrated')
  } catch (error) {
    console.error('Failed to initialize common store persistence:', error)
    if (!_isDesktopPlatform) {
      _$_terminalVisible.set(false)
    }
  }
}

function createFilePersistedStore<T>(key: string, defaultValue: T): Writable<T> {
  return createUiPersistedStore<T>(key, defaultValue)
}

export const _$_tabListContainerHeight = writable(0)
export const _$_tabListHeaderContainerHeight = writable(0)

// Navigation visibility global store

// export const __leftSidebarVisible = writable(false)
// export const _$_leftSidebarVisible = writable(false)
// export const _$_rightSidebarVisible = writable(false)
// export const _$_primarySidebarVisible = writable(false)
// export const _$_secondarySidebarVisible = writable(false)
// export const _$_terminalVisible = writable(false)
export const _isMobileScreen = Platform.isMobileScreen()
const _isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop

export const _$_leftSidebarVisible = createFilePersistedStore<boolean>(
  ui('leftSidebarVisible'),
  false
)

export const _$_rightSidebarVisible = createFilePersistedStore<boolean>(
  ui('rightSidebarVisible'),
  false
)

export const _$_primarySidebarVisible = createFilePersistedStore<boolean>(
  ui('primarySidebarVisible'),
  false
)

export const _$_secondarySidebarVisible = createFilePersistedStore<boolean>(
  ui('secondarySidebarVisible'),
  false
)

export const _$_terminalVisible = createFilePersistedStore<boolean>(ui('terminalVisible'), false)

export const _$_statusBarVisible = createFilePersistedStore<boolean>(ui('statusBarVisible'), false)

export const _$_statusBarContainerHeight = createFilePersistedStore<number>(
  ui('statusBarHeight'),
  0
)

export const _$_homeScreenVisible = createFilePersistedStore<boolean>(
  ui('homeScreenVisible'),
  false
)

export const _$_newDocumentVisible = createFilePersistedStore<boolean>(
  ui('newDocumentVisible'),
  false
)

// export const _$_currentView = writable<'home' | 'new-doc' | 'editor'>('editor');
// export const _$_currentView = writable<'home' | 'new-doc' | 'editor'>('home');
export const _$_currentView = createFilePersistedStore<'home' | 'new-doc' | 'editor'>(
  ui('currentViewVisible'),
  'editor'
)

export const _$_documentCodeEditorVisible = createFilePersistedStore<boolean>(
  ui('documentCodeEditorVisible'),
  false
)

export const _$_pinnedRecentDocuments = createFilePersistedStore<string[]>(
  ui('pinnedRecentDocuments'),
  []
)

export const _$_homeTourCompleted = createFilePersistedStore<boolean>(ui('tour:home:v1'), false)

export const _$_editorTourCompleted = createFilePersistedStore<boolean>(ui('tour:editor:v1'), false)

export const _$_lastSaveDirectory = createFilePersistedStore<string | null>(
  ui('lastSaveDirectory'),
  null
)

export type ExportUpdatePreference = {
  action: 'ask' | 'overwrite' | 'new' | 'skip'
}

export const _$_exportUpdatePreference = createFilePersistedStore<ExportUpdatePreference>(
  ui('exportUpdatePreference'),
  { action: 'ask' }
)

export type RecentDocumentEntry = {
  id: string
  name: string
  path: string
  parentPath?: string | null
  dirPath?: string | null
  extension?: string | null
  contentType?: string | null
  updatedAt?: string | null
  openedAt?: string | null
  remotePath?: string | null
  remoteRef?: string | null
  accountOrg?: string | null
}

export const _$_recentDocuments = createFilePersistedStore<RecentDocumentEntry[]>(
  ui('recentDocuments'),
  []
)

export type PrimarySidebarItemId =
  | 'explorer'
  | 'drive'
  | 'search'
  | 'terminal'
  | 'versionControl'
  | 'contribute'
  | 'navigation'
  | 'thumbnail'
  | 'bookmarks'
  | 'content' // or outline for slides
  | 'outline'
// | 'slide' // or outline for slides

export type SecondarySidebarItemId =
  | 'chat'
  | 'meeting'
  | 'chat-ai'
  | 'browser'
  | 'limitationManager'
  | 'variablesManager'
  | 'filesManager'
  | 'protectionPane'
  | 'extensions'
  | 'translate'
  | 'layers'
  | 'form'
  | 'review'
  | 'chartInspector'

export const _$_activePrimarySidebarItem = createFilePersistedStore<PrimarySidebarItemId | null>(
  ui('activePrimarySidebarItem'),
  null
)

export const _$_activeSecondarySidebarItem =
  createFilePersistedStore<SecondarySidebarItemId | null>(ui('activeSecondarySidebarItem'), null)

export const _$_primarySidebarContentVisibility = createFilePersistedStore<Record<string, boolean>>(
  ui('primarySidebarContentVisibility'),
  {
    fileExplorer: false,
    search: false,
    versionControl: false
  }
)

export const _$_secondarySidebarContentVisibility = createFilePersistedStore<
  Record<string, boolean>
>(ui('secondarySidebarContentVisibility'), {
  chat: false,
  browser: false,
  limitationManager: false,
  variablesManager: false,
  filesManager: false,
  protectionPane: false,
  extensions: false,
  form: false,
  translate: false,
  layers: false,
  review: false,
  chartInspector: false
})

export const _$_lastActiveEditorId = createFilePersistedStore<string | null>(
  ui('lastActiveEditorId'),
  null
)

export const _$_lastActiveTranslationPath = createFilePersistedStore<string | null>(
  ui('lastActiveTranslationPath'),
  null
)

// UI ordering (drag + drop)
export const _$_primarySidebarItemOrder = createFilePersistedStore<PrimarySidebarItemId[]>(
  ui('primarySidebarItemOrder'),
  []
)

export const _$_secondarySidebarItemOrder = createFilePersistedStore<SecondarySidebarItemId[]>(
  ui('secondarySidebarItemOrder'),
  []
)

export const _$_tabListOrder = createFilePersistedStore<string[]>(ui('tabListOrder'), [])

export type OpenDocumentError = {
  type: 'not-found' | 'unsupported' | 'error'
  path: string
  message?: string
}

export const _$_lastOpenError = writable<OpenDocumentError | null>(null)

export const createPersistedSplitLayoutSize = (key: string, defaultSize: number) => {
  const store = createFilePersistedStore<number>(`layout-size-${key}`, defaultSize)
  const { subscribe, set } = store

  return {
    subscribe,
    set: (value: number) => {
      set(value)
    }
  }
}

/* export const _$_primarySidebarContentVisibility = {
    fileExplorer: writable(false),
    search: writable(false),
    versionControl: writable(false)
}

// export const _$_primarySidebarVisible = writable(false)
export const _$_activePrimarySidebarItem =
    writable<PrimarySidebarItemId | null>(null)

export const _$_secondarySidebarContentVisibility = {
    chat: writable(false),
    limitationManager: writable(false),
    variablesManager: writable(false),
    filesManager: writable(false),
    protectionPane: writable(false),
    extensions: writable(false)
}

// export const _$_primarySidebarVisible = writable(false)
export const _$_activeSecondarySidebarItem =
    writable<SecondarySidebarItemId | null>(null) */

//  export const _$_ribbonContainer = writable<HTMLElement>()
//  export const _$_ribbonContainerHeight = writable(0)

// export const _$_statusBarVisible = writable(false)
//  export const _$_statusBarContainer = writable<HTMLElement>()
// export const _$_statusBarContainerHeight = writable(0)

export const visibilityStores = {
  leftSidebar: _$_leftSidebarVisible,
  rightSidebar: _$_rightSidebarVisible,
  primarySidebar: _$_primarySidebarVisible,
  secondarySidebar: _$_secondarySidebarVisible,
  terminal: _$_terminalVisible,
  statusBar: _$_statusBarVisible,
  homeScreen: _$_homeScreenVisible,
  ribbon: _$_ribbonUserVisible,
  newDocument: _$_newDocumentVisible,
  documentCodeEditor: _$_documentCodeEditorVisible
} as const

export type VisibilityKey = keyof typeof visibilityStores
export type VisibilityStore = Writable<boolean>

export function show(key: VisibilityKey) {
  visibilityStores[key].set(true)
}

export function hide(key: VisibilityKey) {
  visibilityStores[key].set(false)
}

export function toggle(key: VisibilityKey) {
  if (key === 'terminal' && !_isDesktopPlatform) return
  const store = visibilityStores[key]
  const next = !get(store)
  store.set(next)
  if (key === 'ribbon' && next) {
    _$_ribbonAutoHidden.set(false)
  }
}

export function setVisibility(key: VisibilityKey, value: boolean) {
  visibilityStores[key].set(value)
}

export function hideAll() {
  Object.values(visibilityStores).forEach((store) => store.set(false))
}

export function showAll() {
  Object.values(visibilityStores).forEach((store) => store.set(true))
}

export function setAll(value: boolean) {
  Object.values(visibilityStores).forEach((store) => store.set(value))
}

const groups = {
  sidebars: ['leftSidebar', 'rightSidebar', 'primarySidebar', 'secondarySidebar'],
  panels: ['terminal'],
  chrome: ['statusBar']
} satisfies Record<string, VisibilityKey[]>

export function hideGroup(group: keyof typeof groups) {
  groups[group].forEach((key) => hide(key))
}

export function showGroup(group: keyof typeof groups) {
  groups[group].forEach((key) => show(key))
}

export function showOnly(key: VisibilityKey) {
  Object.entries(visibilityStores).forEach(([k, store]) => {
    store.set(k === key)
  })
}

export function switchView(view: 'home' | 'new-doc' | 'editor') {
  hideAll()
  _$_currentView.set(view)

  //   const map = {
  //     home: 'homeScreen',
  //     'new-doc': 'newDocument',
  //     editor: 'documentCodeEditor'
  //   } as const

  //   showOnly(map[view])
}

export function toggleLeftSidebar() {
  toggle('leftSidebar')
}

export function toggleRightSidebar() {
  toggle('rightSidebar')
}

export function closeAllSidebars() {
  hideGroup('sidebars')
}

export function openAllSidebars() {
  showGroup('sidebars')
}

export function openSidebarAdaptive(key: VisibilityKey) {
  if (_isMobileScreen) {
    // mobile = exclusive
    showOnly(key)
  } else {
    show(key)
  }
}

export function hideAllPrimarySidebarContent() {
  _$_primarySidebarContentVisibility.update((map) =>
    Object.fromEntries(Object.keys(map).map((k) => [k, false]))
  )
}

export function showPrimarySidebarContent(key: string) {
  _$_primarySidebarContentVisibility.update((map) => ({
    ...map,
    [key]: true
  }))
}

export function showOnlyPrimarySidebarContent(key: string) {
  _$_primarySidebarContentVisibility.update((map) =>
    Object.fromEntries(Object.keys(map).map((k) => [k, k === key]))
  )
}
