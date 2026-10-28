<script lang="ts">
  import { onMount } from 'svelte'
  import { fly } from 'svelte/transition'
  import { get, writable } from 'svelte/store'
  import './assets/css/vendor/daisyui@5.css'
  import './assets/js/vendor/tailwindcss.js'
  import './assets/css/vendor/themes.css'
  import { _, locale as svelteLocale } from 'svelte-i18n'
  import './utils/canvasPresentationBridge'

  import {
    _$_leftSidebarVisible,
    _$_primarySidebarVisible,
    _$_rightSidebarVisible,
    _$_secondarySidebarVisible,
    _$_statusBarContainerHeight,
    _$_tabListContainerHeight,
    _$_terminalVisible,
    _$_currentView
  } from './stores/common.store'
  import { _$_ribbbonVisible } from './stores/ribbon.store'
  import Platform from './libs/platform'

  // Web component imports here
  // import { register as vueAdvancedChatRegister } from 'vue-advanced-chat'
  import GlobalCodeEditor from './components/app/editor/code/GlobalCodeEditor.svelte'
  import TitleBar from './components/titleBar/TitleBar.svelte'
  import StatusBar from './components/titleBar/StatusBar.svelte'
  import ActionBar from './components/sideBar/secondarySideBar/ActionBar.svelte'
  import SecondarySideBar from './components/sideBar/secondarySideBar/SecondarySideBar.svelte'
  import Terminal from './components/app/panel/Terminal.svelte'
  import PrimarySideBar from './components/sideBar/primarySideBar/PrimarySideBar.svelte'
  import ActivityBar from './components/sideBar/primarySideBar/ActivityBar.svelte'
  import SidebarEdgeHandle from './components/sideBar/SidebarEdgeHandle.svelte'
  import App from './App.svelte'
  import Utils from './utils/Utils'
  // import { _$_ribbonContainer } from './stores/ribbon.store'
  import { _$_ribbonContainerHeight } from './stores/ribbon.store'
  import { _$_documentEditorsList } from './stores/editor.store'
  import { _$_activeDocKind } from './stores/docKind.store'
  import { _$_recentDocuments } from './stores/common.store'
  import { authStore, initializeAuthStore, startAuth } from './stores/auth.store'
  import { publicShareGuest } from './utils/authMode'
  import NotAuthenticated from './components/common/auth/NotAuthenticated.svelte'

  // On the web the shell — home screen included — belongs to signed-in
  // people only, so it is not built at all without a session: hiding it
  // would still mount it, run its effects and let it talk to the server.
  // Reading a public share as a guest is the one case that opens it without
  // one. Desktop keeps its own flow.
  const _webShellBlocked = $derived(
    !Platform.isDesktopPlatform && !$authStore?.authenticated && !$publicShareGuest
  )
  // No session means the real sign-in page — Casdoor — right away, not a
  // card with a button. The current URL travels as the return target, so a
  // share link survives the round trip. One attempt per session: if we come
  // back still signed out (cancelled, failed, signed out on purpose), show
  // the card instead of redirecting again, so this can never loop.
  const AUTO_SIGN_IN_KEY = 'ddoc.web_auto_signin'

  function _hasPendingAuthCallback(): boolean {
    try {
      return new URL(window.location.href).searchParams.has('code')
    } catch {
      return false
    }
  }
  let _autoSignInStarted = $state(false)
  let _autoSignInFailed = $state(false)
  // A share link in the URL may still make this visitor a legitimate guest,
  // and that answer comes from the server. Redirecting before it lands sends
  // a recipient to a sign-in page the share never required.
  let _shareLinkPending = $state(EditorCommonUtils.getShareLinkFromLocation() !== '')
  // The session store keeps changing while the redirect is being prepared,
  // and a second pass would read back the marker the first one wrote and
  // call the attempt failed. Decide once.
  let _autoSignInDecided = false
  // Signing out must not bounce straight back to Casdoor, which still holds
  // its own session and would hand the same one back: once a session has
  // lived here, its end is deliberate and deserves the card.
  let _hadSession = false
  $effect(() => {
    if ($authStore?.authenticated) _hadSession = true
  })
  $effect(() => {
    if (!_webShellBlocked || $authStore?.initializing || _shareLinkPending) return
    // A URL still carrying an authorization code means the callback is in
    // flight: the session is about to exist. Redirecting now would send the
    // browser back here with a code the server has already spent.
    if (_hasPendingAuthCallback()) return
    if (_autoSignInDecided) return
    _autoSignInDecided = true
    if (_hadSession) {
      _autoSignInFailed = true
      return
    }
    let attempted = false
    try {
      attempted = sessionStorage.getItem(AUTO_SIGN_IN_KEY) === '1'
    } catch {
      attempted = true
    }
    if (attempted) {
      _autoSignInFailed = true
      return
    }
    try {
      sessionStorage.setItem(AUTO_SIGN_IN_KEY, '1')
    } catch {
      // without session storage we cannot guard the loop: fall back to the card
      _autoSignInFailed = true
      return
    }
    _autoSignInStarted = true
    // startAuth reports a failed redirect through the store instead of
    // throwing, so a rejected promise is not the only way this can fail.
    void startAuth('signin').then(
      () => {
        if (get(authStore)?.error) _autoSignInFailed = true
      },
      () => {
        _autoSignInFailed = true
      }
    )
  })
  import { viewport } from './stores/viewport.store'
  import StatusBarRight from './components/titleBar/StatusBarRight.svelte'
  import StatusBarRightP from './components/titleBar/StatusBarRightP.svelte'
  import TabList from './components/app/navigation/TabList.svelte'
  import WpsGuestBanner from './components/common/auth/WpsGuestBanner.svelte'
  import { DocumentModel } from './models/Document'
  import PresenterWindow from './extensions/tiptap/CustomPresentationExtension/components/PresenterWindow.svelte'
  import PresenterWindowModal from './extensions/tiptap/CustomPresentationExtension/components/PresenterWindowModal.svelte'
  import MeetingWindow from './components/app/editor/meeting/MeetingWindow.svelte'
  import { meetingStore } from './extensions/tiptap/CustomMeetingNoteTakingExtension/stores/meeting.store.svelte'
  import MeetingWindowWidget from './components/sideBar/secondarySideBar/components/MeetingWindowWidget.svelte'
  import SplitPane from './components/common/layout/splitPane/SplitPane.svelte'
  import ConfirmModal from './components/common/modal/ConfirmModal.svelte'
  import AlertModal from './components/common/modal/AlertModal.svelte'
  import StepUpModal from './components/common/modal/StepUpModal.svelte'
  import SealOptionsModal from './components/common/modal/SealOptionsModal.svelte'
  import TextInputModal from './components/common/modal/TextInputModal.svelte'
  import ShareModal from './components/common/modal/ShareModal.svelte'
  import ShareManagerModal from './components/common/modal/ShareManagerModal.svelte'
  import ExportOptionsModal from './components/common/modal/ExportOptionsModal.svelte'
  import ExportUpdateModal from './components/common/modal/ExportUpdateModal.svelte'
  import SettingsModal from './components/settings/SettingsModal.svelte'
  import FileBackstage from './components/app/backstage/FileBackstage.svelte'
  import toast, { Toaster } from 'svelte-hot-french-toast'
  import DownloadManager from './components/common/download/DownloadManager.svelte'
  import { initGlobalVarDropdown } from './extensions/tiptap/CustomVarExtension/utils/globalVarDropdown'
  import { setupOverlaySource } from './utils/overlayBridge'
  import IncludeFromDocumentModal from './components/common/modal/IncludeFromDocumentModal.svelte'
  import UpgradePlanModal from './components/common/upgrade/UpgradePlanModal.svelte'
  import LatexProjectModal from './components/common/modal/LatexProjectModal.svelte'
  import SpreadsheetExportModal from './components/common/modal/SpreadsheetExportModal.svelte'
  import SpreadsheetImportModal from './components/common/modal/SpreadsheetImportModal.svelte'
  import SpreadsheetEditorModal from './components/common/modal/SpreadsheetEditorModal.svelte'
  import ChartInspectorModal from './components/common/modal/ChartInspectorModal.svelte'
  import SessionRecoveryModal from './components/common/modal/SessionRecoveryModal.svelte'
  import ConditionalFormattingModal from './components/common/modal/ConditionalFormattingModal.svelte'
  import UtilityBar from './components/app/editor/wysiwyg/components/UtilityBar.svelte'
  import { startAutosave, stopAutosave } from './services/save/savePipeline.service'
  import TranslationPickerModal from './components/common/modal/TranslationPickerModal.svelte'
  import LinkPreviewBubble from './components/common/interaction/LinkPreviewBubble.svelte'
  import EditorCommonUtils from './utils/common.utils'
  import { saveActiveDocument } from './services/save/savePipeline.service'
  import { openShareModal } from './stores/shareModal.store'
  import { openAlertModal } from './stores/alertModal.store'
  import { openConfirmModal } from './stores/confirmModal.store'
  import { GenericFormatingEditorCommands } from './components/common/actions/formatting/commands/GenericFormatingEditorCommands.svelte'
  import { initializeThemeStore } from './stores/theme.store'
  import GrammarSettingsModal from './extensions/tiptap/CustomGrammarCheckExtension/components/GrammarSettingsModal.svelte'
  import FolderStructureModal from './components/common/modal/FolderStructureModal.svelte'
  import AddFilesToDocumentModal from './components/common/modal/AddFilesToDocumentModal.svelte'

  // import { provideFluentDesignSystem, fluentButton, fluentCard, setTheme } from '@fluentui/web-components'
  // import { provideFluentDesignSystem, allComponents } from '@fluentui/web-components'

  // provideFluentDesignSystem().register(allComponents)

  /* import { setTheme } from '@fluentui/web-components'
  import { webLightTheme } from '@fluentui/tokens'

  import '@fluentui/web-components/button.js'
  import '@fluentui/web-components/tooltip.js'
  // import '@fluentui/web-components/link.js'
  import '@fluentui/web-components/tablist.js'
  import '@fluentui/web-components/tab.js' */

  // import "@vscode-elements/elements/dist/button/index.js";
  // import "@vscode-elements/elements/dist/vscode-tabs/index.js";
  // import "@vscode-elements/elements/dist/vscode-tab-header/index.js";
  // import "@vscode-elements/elements/dist/vscode-tab-panel/index.js";

  // import { ButtonDefinition, FluentDesignSystem } from '@fluentui/web-components';

  // ButtonDefinition.define(FluentDesignSystem.registry);

  // setTheme(webLightTheme)

  // provideFluentDesignSystem().register(
  //   fluentButton(),
  //   fluentCard()
  //   // Add more as needed
  // )

  // Register the web component of vue-advanced-chat
  // vueAdvancedChatRegister()

  // let droppedFiles: string[] = []

  // const _$_leftSidebarVisible = writable(false)
  // const _$_rightSidebarVisible = writable(false)
  // const _$_primarySidebarVisible = writable(false)
  // const _$_secondarySidebarVisible = writable(false)
  // const _$_terminalVisible = writable(false)
  const renderStart = performance.now()
  let overlayCleanup: (() => void) | null = null
  let themeCleanup: (() => void) | null = null
  const baseTitle = document.title || 'Dynadoc'
  const unsavedCount = $derived.by(
    () =>
      ($_$_documentEditorsList ?? []).filter((entry) => entry?.document?.isUnsavedDocument?.())
        .length
  )
  let appCloseFlowPending = false

  async function handleAppCloseRequested() {
    if (appCloseFlowPending) return
    appCloseFlowPending = true

    try {
      const unsavedEditors = _$_documentEditorsList
        .getList()
        .filter((entry) => entry?.document?.isUnsavedDocument?.())

      if (!unsavedEditors.length) {
        await window.api.respondToAppClose?.({ action: 'quit' })
        return
      }

      const previewNames = unsavedEditors
        .slice(0, 3)
        .map((entry) => `• ${entry?.document?.name || 'Untitled'}`)
        .join('\n')
      const hiddenCount = Math.max(0, unsavedEditors.length - 3)
      let quitHandled = false

      await openConfirmModal({
        title: 'Quit with unsaved documents?',
        message:
          `${unsavedEditors.length} document${unsavedEditors.length === 1 ? '' : 's'} still need a save location.\n\n` +
          `${previewNames}${hiddenCount > 0 ? `\n• ${hiddenCount} more` : ''}\n\n` +
          'Save them now, cancel the quit, or close the app anyway.',
        confirmText: 'Quit Anyway',
        cancelText: 'Cancel',
        destructive: true,
        extraActionText: 'Save & Quit',
        onExtraAction: async () => {
          const result = await EditorCommonUtils.saveAllUnsavedDocuments()
          if (result.allSaved) {
            quitHandled = true
            await window.api.respondToAppClose?.({ action: 'quit' })
            return
          }

          const remaining = Math.max(1, result.attemptedCount - result.savedCount)
          await openAlertModal({
            title: 'Quit canceled',
            message: `${remaining} document${remaining === 1 ? '' : 's'} still need attention before quitting.`
          })
          await window.api.respondToAppClose?.({ action: 'cancel' })
        }
      }).then(async (confirmedQuit) => {
        if (quitHandled) return
        if (confirmedQuit) {
          await window.api.respondToAppClose?.({ action: 'quit' })
          return
        }
        await window.api.respondToAppClose?.({ action: 'cancel' })
      })
    } catch (error) {
      console.error('Failed to handle app close request', error)
      await window.api.respondToAppClose?.({ action: 'cancel' })
    } finally {
      appCloseFlowPending = false
    }
  }

  onMount(() => {
    themeCleanup = initializeThemeStore()
    overlayCleanup = setupOverlaySource()
    // The chrome used to be what woke the session up. It no longer mounts
    // without one, so the root asks for it itself.
    void initializeAuthStore()
    setTimeout(() => {
      void EditorCommonUtils.openSharedLinkFromLocationIfPresent().finally(() => {
        _shareLinkPending = false
      })
    }, 0)
    const closeCleanup = window.api?.onAppCloseRequested?.(() => {
      void handleAppCloseRequested()
    })
    if (window.api?.onFileDrop) {
      window.api.onFileDrop(async (files: string[]) => {
        if (!files?.length) return
        for (const filePath of files) {
          await EditorCommonUtils.openDocumentFromInput(filePath, { parentPath: null })
        }
      })
    }
    const handler = async (_event: any, id: string) => {
      try {
        if (id?.startsWith('file:open-recent|')) {
          const parts = id.split('|')
          const rawPath = parts[1] ? decodeURIComponent(parts[1]) : ''
          const rawParent = parts[2] ? decodeURIComponent(parts[2]) : ''
          if (rawPath) {
            await EditorCommonUtils.addNewDocumentEditor(rawPath, rawParent || null)
          }
          return
        }
        switch (id) {
          case 'file:new':
            await EditorCommonUtils.addNewDocumentEditor(
              null,
              null,
              undefined,
              'document',
              'default'
            )
            return
          case 'file:open': {
            const paths = await window.api.openDialogFiles([
              { name: 'All Files', extensions: ['*'] },
              {
                name: 'Dynadoc',
                extensions: [
                  Utils.DYNADOC_EXTENSIONS_FORMAT.default,
                  Utils.DYNADOC_EXTENSIONS_FORMAT.secured
                ]
              },
              {
                name: 'Documents',
                extensions: [
                  Utils.OFFICE_EXTENSIONS_FORMAT.word,
                  Utils.FILE_TYPES.pdf,
                  Utils.OFFICE_EXTENSIONS_FORMAT.powerpoint,
                  Utils.OFFICE_EXTENSIONS_FORMAT.excel,
                  'xls',
                  'csv',
                  'html',
                  'htm',
                  'txt'
                ]
              }
            ])
            if (!paths?.length) return
            for (const filePath of paths) {
              await EditorCommonUtils.openDocumentFromInput(filePath, { parentPath: null })
            }
            return
          }
          case 'file:open-recent-clear':
            _$_recentDocuments.set([])
            return
          case 'file:save':
            await saveActiveDocument()
            return
          case 'file:save-as':
            await saveActiveDocument({ saveAs: true })
            return
          case 'file:save-all':
            await EditorCommonUtils.saveAllUnsavedDocuments()
            return
          case 'file:export-pdf': {
            const { promptAndExport } = await import('./services/export/editorExport.service')
            await promptAndExport(Utils.FILE_TYPES.pdf)
            return
          }
          case 'file:export-docx': {
            const { exportActiveEditorToDocx } = await import('./services/export/docxExport.service')
            await exportActiveEditorToDocx({
              reasonLabel: 'Word export ready',
              promptSelection: true
            })
            return
          }
          case 'file:export-xlsx': {
            const { promptAndExportActiveSheet } = await import(
              './services/export/spreadsheetExchange.service'
            )
            await promptAndExportActiveSheet()
            return
          }
          case 'file:export-picture': {
            const { promptAndExport } = await import('./services/export/editorExport.service')
            await promptAndExport('picture')
            return
          }
          case 'file:export-selection': {
            const { exportSelectionToFile } = await import('./services/export/editorExport.service')
            await exportSelectionToFile({ format: 'html' })
            return
          }
          case 'file:export-tables': {
            const { exportTablesToFile } = await import('./services/export/editorExport.service')
            await exportTablesToFile({ format: 'csv', scope: 'all' })
            return
          }
          case 'file:share': {
            const active = _$_documentEditorsList.getActiveSync?.()
            const doc = active?.document
            if (doc?.path) {
              await openShareModal({
                path: doc.path,
                name: doc.name || 'Document',
                source: 'disk',
                targetType: 'document',
                docUuid: doc.uuid
              })
            }
            return
          }
          case 'file:print': {
            const { promptAndExport } = await import('./services/export/editorExport.service')
            await promptAndExport('print')
            return
          }
          case 'file:close': {
            const active = _$_documentEditorsList.getActiveSync?.()
            if (active?.id) {
              await _$_documentEditorsList.closeTab(active.id)
            }
            return
          }
          case 'view:ribbon':
            _$_ribbbonVisible.set(!$_$_ribbbonVisible)
            return
          case 'view:sidebar':
            _$_primarySidebarVisible.set(!$_$_primarySidebarVisible)
            return
          case 'format:bold':
            GenericFormatingEditorCommands.bold()
            return
          case 'format:italic':
            GenericFormatingEditorCommands.italic()
            return
          case 'format:underline':
            GenericFormatingEditorCommands.underline()
            return
          case 'format:strike':
            GenericFormatingEditorCommands.strike()
            return
          case 'format:h1':
            GenericFormatingEditorCommands.heading(1)
            return
          case 'format:h2':
            GenericFormatingEditorCommands.heading(2)
            return
          case 'format:paragraph':
            GenericFormatingEditorCommands.paragraph()
            return
          case 'format:align-left':
            GenericFormatingEditorCommands.alignLeft()
            return
          case 'format:align-center':
            GenericFormatingEditorCommands.alignCenter()
            return
          case 'format:align-right':
            GenericFormatingEditorCommands.alignRight()
            return
          case 'format:bullet':
            GenericFormatingEditorCommands.bulletList()
            return
          case 'format:ordered':
            GenericFormatingEditorCommands.orderedList()
            return
          case 'review:toggle':
            GenericFormatingEditorCommands.toggleTrackChanges()
            return
          case 'review:comment':
            await GenericFormatingEditorCommands.addComment()
            return
          case 'review:accept':
            GenericFormatingEditorCommands.acceptSelection()
            return
          case 'review:reject':
            GenericFormatingEditorCommands.rejectSelection()
            return
          case 'review:next':
            GenericFormatingEditorCommands.nextChange()
            return
          case 'review:prev':
            GenericFormatingEditorCommands.previousChange()
            return
          case 'insert:table':
            GenericFormatingEditorCommands.insertTable()
            return
          case 'insert:image':
            await GenericFormatingEditorCommands.insertImageFromDevice()
            return
          case 'insert:codeblock':
            GenericFormatingEditorCommands.insertMonacoCodeBlock()
            return
          case 'insert:slide':
            GenericFormatingEditorCommands.insertSlide()
            return
          case 'insert:spreadsheet':
            GenericFormatingEditorCommands.insertSpreadsheet()
            return
          default:
            return
        }
      } catch (error) {
        console.warn('Menu action failed', id, error)
      }
    }

    const menuActionCleanup = window.api?.onInvokeMenuAction?.(handler)
    const cleanupVarDropdown = initGlobalVarDropdown()
    if (!_isDesktopPlatform) {
      _$_terminalVisible.set(false)
    }

    console.log('[Main.svelte ] oncreate Main.svelte onMount')
    window.addEventListener('scroll', handleScroll)
    window.removeEventListener('scroll', handleScroll)

    return () => {
      closeCleanup?.()
      themeCleanup?.()
      themeCleanup = null
      menuActionCleanup?.()
      overlayCleanup?.()
      overlayCleanup = null
      cleanupVarDropdown?.()
      if (_autosaveId && _autosaveEditor) {
        stopAutosave(_autosaveEditor)
      }
    }
  })

  $effect(() => {
    const list = Array.isArray($_$_recentDocuments) ? $_$_recentDocuments : []
    const activeOrg = $authStore?.activeOrg || ''
    const filtered = list.filter((entry) => !entry.accountOrg || entry.accountOrg === activeOrg)
    const items = filtered.slice(0, 12).map((entry) => ({
      label: entry.name || entry.path || 'Untitled',
      path: entry.path,
      parentPath: entry.parentPath ?? null
    }))
    window.api?.updateRecentMenu?.(items)
  })

  $effect(() => {
    const count = unsavedCount
    document.title = count > 0 ? `(${count}) ${baseTitle}` : baseTitle
    window.api?.setUnsavedBadge?.(count)
  })

  let _selectedTab = $state('')

  // let _componentReady = $state({
  //   app: false
  // })

  // Tracks if children components are ready
  // let _ischildReadyForRender = $state(false)
  // store all child ready flags in a single object
  /* $: _ischildReadyForRender = {
    activityBar: false,
    primarySideBar: false,
    secondarySideBar: false,
    app: false,
    actionBar: false,
    statusBar: false
    terminal: false
  } */
  // let _ischildReadyForRender;
  // let childReady = writable(false)

  let _ischildReadyForRender = {
    activityBar: writable(false),
    primarySideBar: writable(false),
    secondarySideBar: writable(false),
    app: writable(false),
    actionBar: writable(false),
    statusBar: writable(false),
    terminal: writable(false)
  }

  let _statusBarContainer: HTMLElement

  function handleChildReady() {
    // childReady = true
    // childReady.set(true)
  }

  // setupI18n()

  let scrolled = false

  function handleScroll() {
    // scrolled = window.scrollY > 20 // shrink after 20px
  }
  // $: if (_statusBarContainer) {
  // _$_ribbonContainerHeight.set(_statusBarContainer?.offsetHeight)
  // }

  const activeDocumentEditorStore = _$_documentEditorsList.getActive()
  // let _activeEditor = $derived($activeDocumentEditorStore)
  let _activeEditor = $state()
  let _autosaveId: string | null = null
  let _autosaveEditor: any = null

  // $: if ($activeDocumentEditorStore) {
  /* if (Object.values(Utils.IMAGE_EXTENSIONS).includes(activeEditor?.document?.extension)) {
      _$_primarySidebarVisible.set(false)
      _$_rightSidebarVisible.set(false)
      _$_terminalVisible.set(false)
    } else {
      _$_primarySidebarVisible.set(true)
      _$_rightSidebarVisible.set(true)
      _$_terminalVisible.set(true)
    } */
  // }

  let _isMobileScreen = $state(false)
  const _isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
  $effect(() => {
    Object.keys(_ischildReadyForRender).forEach((name) => {
      _ischildReadyForRender[name].set(true)
    })
    _$_ribbonContainerHeight.set(_statusBarContainer?.offsetHeight || 0)
    const ro = new ResizeObserver(() => {
      _$_ribbonContainerHeight.set(_statusBarContainer?.offsetHeight || 0)
    })
    if (_statusBarContainer) ro.observe(_statusBarContainer)
    return () => ro.disconnect()
  })

  $effect(() => {
    _activeEditor = $activeDocumentEditorStore
  })

  // Drive the WPS-style per-file-type accent: tag <html> with the active
  // document kind so the var(--accent) overrides in main.css recolour the chrome
  // (tab underline, Share, Sign in, badges…). Cleared on the home screen.
  $effect(() => {
    const kind = $_$_currentView === 'editor' ? $_$_activeDocKind : null
    const root = document.documentElement
    if (kind) root.dataset.doctype = kind
    else delete root.dataset.doctype
  })

  $effect(() => {
    if (!_activeEditor) return
    const nextId = _activeEditor.uuid || _activeEditor.document?.uuid || _activeEditor.id
    if (nextId && nextId !== _autosaveId) {
      if (_autosaveId && _autosaveEditor) {
        stopAutosave(_autosaveEditor)
      }
      _autosaveId = nextId
      _autosaveEditor = _activeEditor
      startAutosave(_activeEditor)
    }
  })

  $effect(() => {
    _isMobileScreen = Boolean($viewport?.isMobile)
    if (_isMobileScreen) {
      _$_leftSidebarVisible.set(false)
      _$_primarySidebarVisible.set(false)
      _$_secondarySidebarVisible.set(false)
      _$_rightSidebarVisible.set(false)
      _$_terminalVisible.set(false)
    }
  })

  const componentName = import.meta.url.split('/').pop()
  // ?.replace(".svelte", "") || "Unknown";
  Utils.measureRender(componentName)
  /* onMount(() => {
    // const renderStart = performance.now()

    const renderEnd = performance.now()
    console.log('Svelte page render time:', renderEnd - renderStart, 'ms')
  }) */
  function toggleLeftSidebar() {
    _$_leftSidebarVisible.update((v) => !v)
  }
  function toggleRightSidebar() {
    console.log('toggleRightSidebar 6')
    _$_rightSidebarVisible.update((v) => !v)
  }
  function togglePrimarySidebar() {
    _$_primarySidebarVisible.update((v) => !v)
  }
  function toggleSecondarySidebar() {
    _$_secondarySidebarVisible.update((v) => !v)
  }
  function toggleTerminal() {
    _$_terminalVisible.update((v) => !v)
  }
  // })
</script>

{#key $svelteLocale}
  <div id="app-body" class="h-full overflow-hidden flex flex-col">
    {#if _webShellBlocked}
      <!-- On the web, no session means the sign-in page and nothing else:
           the shell below is never built while this is shown. -->
      <div class="h-full min-h-0 overflow-auto">
        {#if _autoSignInFailed}
          <NotAuthenticated fullPage={true} />
        {:else if _autoSignInStarted}
          <div class="h-full w-full flex items-center justify-center text-[13px] opacity-60">
            {$_('Redirecting to sign-in…')}
          </div>
        {:else}
          <!-- Nothing is known yet: not a word about signing in until it is. -->
          <div class="h-full w-full flex items-center justify-center">
            <div class="size-8px rd-full bg-base-300 animate-pulse"></div>
          </div>
        {/if}
      </div>
    {:else}
      <!-- <vscode-checkbox label="Checkbox example" value="testvalue1" checked></vscode-checkbox> -->

      <!-- <div class="row">
    <label>
      <input id="single" type="checkbox" />
      <span>Accept terms</span>
    </label>
  </div> -->

      {#if _isMobileScreen}
        <!-- {#if _isMobileScreen && $isLoading} -->

        <!-- Mobile toggle buttons -->
        <!-- <div class="navbar fixed top-0 left-0 right-0 z-50 bg-base-100 shadow-sm"> -->

        <div
          class="navbar bg-base-100 shadow-sm fixed top-0 left-0 right-0 z-50 transition-all duration-300"
          class:py-2={!scrolled}
          class:py-1={scrolled}
          class:text-xl={!scrolled}
          class:text-lg={scrolled}
        >
          <div class="flex-1">
            <ul class="menu menu-horizontal bg-base-200 rounded-box">
              <li>
                <a
                  class="tooltip tooltip-bottom"
                  data-tip={$_('Left Sidebar')}
                  on:click={toggleLeftSidebar}
                >
                  <i class="ph-light ph-sidebar"></i>
                </a>
              </li>
              <!-- <li>
            <a
              class="tooltip tooltip-bottom"
              data-tip="Primary Sidebar"
              on:click={togglePrimarySidebar}
            >
              <i class="ph-light ph-layout"></i>
            </a>
          </li> -->
              <!-- <li>
            <a
              class="tooltip tooltip-bottom"
              data-tip="Secondary Sidebar"
              on:click={toggleSecondarySidebar}
            >
              <i class="ph-light ph-sidebar inline-block transform scale-x-[-1]"></i>
            </a>
          </li> -->
              <li>
                <a
                  class="tooltip tooltip-bottom"
                  data-tip={$_('Right Sidebar')}
                  on:click={toggleRightSidebar}
                >
                  <i class="ph-light ph-square-half"></i>
                </a>
              </li>
            </ul>
            <!-- <button class="btn btn-square btn-ghost"> </button> -->
          </div>
          <div class="flex-none">
            <!-- <div class="flex-1"> -->
            <a class="btn btn-ghost text-xl">{$_('ddoc-office')}</a>
          </div>
        </div>

        <!-- Prevent content from hiding under navbar -->
        <div class="pt-16"></div>
        <!-- <div class="top-2 left-2 z-50 space-x-2 flex"> -->
        <!-- <div class="fixed top-2 left-2 z-50 space-x-2 flex"> -->
        <!-- <button class="btn btn-primary btn-sm" on:click={toggleLeftSidebar}>☰ Left</button>
      <button class="btn btn-primary btn-sm" on:click={togglePrimarySidebar}>☰ Primary</button>
      <button class="btn btn-primary btn-sm" on:click={toggleSecondarySidebar}>☰ Secondary</button>
      <button class="btn btn-primary btn-sm" on:click={toggleRightSidebar}>☰ Right</button> -->
        <!-- <button class="btn btn-primary btn-sm" on:click={toggleTerminal}>☰ Terminal</button> -->
        <!-- </div> -->
      {/if}

      <!-- <button on:click={() => setLocale('ja')}>日本語</button>
    <button on:click={() => setLocale('en')}>English</button> -->

      <!-- <div id="app-body" class="grid grid-rows-[3vh,1fr,3vh] h-full"> -->
      <!-- Title bar -->
      {#if !_isMobileScreen}
        <div id="title-bar" class="wps-titlebar-chrome shrink-0">
          <TitleBar />
        </div>
      {/if}

      <!-- Main content (auto-expands to fill remaining space) -->
      <div id="main" class="app-layout-container min-h-0 flex-1 overflow-hidden flex flex-col">
        <!-- <fluent-button appearance="primary" on:click={toggleRightSidebar}>Save</fluent-button> -->

        <div class="navigation-tablist-wrapper bg-base-100 shrink-0 overflow-hidden">
          <TabList
            __elements={[
              // ..._documentEditors.map((de) => DocumentModel.toNavigationTab(de.document))
              // ..._documentEditors.map((de) => DocumentModel.toNavigationTab(de))
              ...$_$_documentEditorsList.map((de) => DocumentModel.toNavigationTab(de))
              // ...$_$_documentEditorsList.getList().map((de) => DocumentModel.toNavigationTab(de))
              // .filter((tab) => tab != null) // removes null & undefined
            ]}
            __draggable={true}
            __hideHeader={true}
            __dataTabsGroup="document-editor"
            __dataTabsTargetPrefix="#document-editor-"
          >
            <!-- {#each _documentEditors as documentEditor (documentEditor.id)}
      <DocumentEditor key={documentEditor.id}>
        <div class="navigation-tab" slot="navigation-tab" key={documentEditor.id}>
          <Tab draggable index={documentEditor.id}>
            {documentEditor.id}
          </Tab>
        </div>
      </DocumentEditor>
    {/each} -->
            <!-- <svelte:fragment slot="add-new-document-editor-button"> -->
            <svelte:fragment slot="tablist-prepend">
              <!-- <button id="go-to-home=screen">
          <i class={'ph-light i-icon ph-house'}></i>
        </button> -->

              <!-- <vscode-tab-header slot="header">
          <i class={'ph-light i-icon ph-house'}></i>
        </vscode-tab-header>
        <vscode-tab-panel>
          <p>Lorem ipsum dolor...</p>
          <HomeScreen></HomeScreen>
        </vscode-tab-panel> -->
            </svelte:fragment>

            <svelte:fragment slot="tablist-append">
              <!-- <button
          id="add-new-document-editor"
          on:click={async () =>
            // _documentEditors =

            await EditorHelpers.addNewDocumentEditor(null, () => {
              // _canRenderComponents = true
            })}
        >
          <img src={addRoundedIcon} alt="Add Icon" class="icon add-icon" />
        </button> -->
            </svelte:fragment>
          </TabList>
        </div>

        {#if $_$_currentView === 'editor' && !$authStore?.authenticated}
          <WpsGuestBanner />
        {/if}

        <div class="main-container flex-1 min-h-0 p-x-1 overflow-hidden">
          <div class="flex -mx-2 h-full min-h-0 overflow-hidden">
            <!-- {#if _ischildReadyForRender.activityBar}  -->
            {#if $_$_leftSidebarVisible}
              <!-- <div
            id="activity-bar-wrapper"
            class="scrollable-section"
            style="margin-top: {$_$_tabListContainerHeight
              ? `calc(${$_$_tabListContainerHeight}px + 3em)`
              : '3em'}; margin-bottom: {$_$_tabListContainerHeight
              ? `calc(${$_$_statusBarContainerHeight}px)`
              : '0'}"
          > -->
              <div
                id="activity-bar-wrapper"
                class="activity-bar-wrapper scrollable-section"
                in:fly={{ x: -72, duration: 180 }}
                out:fly={{ x: -72, duration: 180 }}
              >
                {#if _ischildReadyForRender.activityBar}
                  <ActivityBar />
                {:else}
                  <div class="flex h-full w-full flex-col gap-4">
                    <div class="skeleton h-full w-full"></div>
                  </div>
                  <!-- <div class="flex w-52 flex-col gap-4">
                <div class="skeleton h-32 w-full"></div>
                <div class="skeleton h-4 w-28"></div>
                <div class="skeleton h-4 w-full"></div>
                <div class="skeleton h-4 w-full"></div>
              </div> -->
                {/if}
                <!-- bool {$_$_leftSidebarVisible} -->
              </div>
            {/if}
            <!-- {/if} -->
            <!-- <vscode-split-layout style="height: calc(100% - 60px); width:100%"> -->
            <!-- <SplitPane __id="main-sidebar" snapAt={20}> -->
            <SplitPane __id="main-split-layout-primary">
              {#if $_$_primarySidebarVisible}
                <div
                  data-initial="25"
                  data-min="5"
                  data-max="40"
                  class="h-full min-h-0 overflow-hidden"
                >
                  <!-- <div
                id="primary-side-bar"
                class="scrollable-section mt-[{$_$_ribbbonVisible ? '30em' : '12em'}]"
              > -->
                  <!-- <div id="primary-side-bar" class="scrollable-section mt-[{$_$_tabListContainer??.offsetHeight}]"> -->
                  <!-- <div
                id="primary-side-bar-wrapper"
                class="scrollable-section mx-[2%] rounded-[10px] border border-light dark:border-dark"
                style="margin-top: {$_$_tabListContainerHeight
                  ? `calc(${$_$_tabListContainerHeight}px + 3em)`
                  : '3em'};"
              > -->
                  <div
                    id="primary-side-bar-wrapper"
                    class="scrollable-section mx-[2%] rounded-[10px] border border-light dark:border-dark"
                  >
                    <!-- {#if $childReady} -->
                    {#if _ischildReadyForRender.primarySideBar}
                      <PrimarySideBar />
                    {:else}
                      <div class="flex h-full w-full flex-col gap-4">
                        <div class="skeleton h-full w-full"></div>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}

              <div
                data-initial={$_$_primarySidebarVisible ? 75 : 100}
                data-min="60"
                data-max="95"
                class="h-full min-h-0 overflow-hidden"
              >
                <!-- <vscode-split-layout
              style="height: 100%; 
          --start-flex-slot-start-wrapper-split-layout-app: {$_$_secondarySidebarVisible
                ? '1 1 75%'
                : '1 1 100%'};
          --end-flex-slot-start-wrapper-split-layout-app:{$_$_secondarySidebarVisible
                ? '1 1 25%'
                : '1 1 0%'};
          --start-flex-slot-end-terminal: {$_$_terminalVisible ? '1 1 75%' : '1 1 100%'};
          --end-flex-slot-end-terminal:{$_$_terminalVisible ? '1 1 25%' : '1 1 0%'};
          "
            > -->
                <SplitPane direction="horizontal" __id="main-split-layout-app">
                  <!-- {#if $_$_primarySidebarVisible} -->
                  <div
                    id="slot-start-wrapper-split-layout-app"
                    data-initial={$_$_secondarySidebarVisible ? 75 : 100}
                    data-min="60"
                    data-max="95"
                    class="h-full min-h-0 overflow-hidden"
                  >
                    <!-- Central area with nested split for terminal -->
                    <!-- <vscode-split-layout split="horizontal" style="height: 100%;"> -->
                    <SplitPane direction="vertical" __id="main-split-layout-editor-terminal">
                      <!-- <div
                    slot="start"
                    size="{$_$_terminalVisible ? 75 : 100}%"
                    class="h-[{$_$_terminalVisible ? 70 : 100}vh] overflow-hidden"
                  > -->
                      <div
                        data-initial={$_$_terminalVisible ? 75 : 100}
                        data-min="50"
                        data-max="95"
                        class="h-full min-h-0 overflow-hidden"
                      >
                        <!-- {#if $childReady} -->
                        {#if _ischildReadyForRender.app}
                          <App />
                        {:else}
                          <div class="flex h-full w-full flex-col gap-4">
                            <div class="skeleton h-full w-full"></div>
                            <!-- <div class="skeleton h-4 w-full"></div> -->
                            <!-- <div class="skeleton h-4 w-28"></div>
                        <div class="skeleton h-4 w-full"></div>
                        <div class="skeleton h-4 w-full"></div> -->
                          </div>
                        {/if}
                      </div>

                      {#if _isDesktopPlatform && $_$_terminalVisible}
                        <div
                          id="slot-end-terminal"
                          data-initial="25"
                          data-min="5"
                          data-max="50"
                          class="h-full min-h-0 overflow-hidden"
                        >
                          {#if _isDesktopPlatform && _ischildReadyForRender.terminal}
                            <Terminal />
                            <!-- <Terminal __codeEditorId={1} __wysiwygEditorId={1} /> -->
                          {:else}
                            <div class="flex h-full w-full flex-col gap-4">
                              <div class="skeleton h-full w-full"></div>
                            </div>
                          {/if}
                        </div>
                      {/if}
                      <!-- </vscode-split-layout> -->
                    </SplitPane>
                  </div>
                  <!-- {/if} -->

                  <!-- <vscode-split-layout slot="end" style="height: 100%;"> -->

                  {#if $_$_secondarySidebarVisible}
                    <div
                      data-initial="25"
                      data-min="5"
                      data-max="40"
                      class="h-full min-h-0 overflow-hidden"
                    >
                      <!-- <div
                    id="secondary-side-bar-wrapper"
                    class="mb-4 resizable scrollable-section mx-[2%] rounded-[10px] border border-light dark:border-dark"
                    style="margin-top: {$_$_tabListContainerHeight
                      ? `calc(${$_$_tabListContainerHeight}px + 3em)`
                      : '3em'}"
                  > -->
                      <div
                        id="secondary-side-bar-wrapper"
                        class="mb-4 resizable scrollable-section mx-[2%] rounded-[10px] border border-light dark:border-dark"
                      >
                        <!-- <SecondarySideBar /> -->
                        {#if _ischildReadyForRender.secondarySideBar}
                          <SecondarySideBar />
                        {:else}
                          <div class="flex h-full w-full flex-col gap-4">
                            <div class="skeleton h-full w-full"></div>
                          </div>
                        {/if}
                      </div>
                      <!-- </div> -->
                    </div>
                  {/if}

                  <!-- </vscode-split-layout> -->

                  <!-- {#if $_$_rightSidebarVisible}
                <div slot="end" style="flex: 0 0 5%;">
                  <div id="action-bar" class="px-2 scrollable-section">
                    <ActionBar />
                  </div>
                </div>
              {/if} -->
                  <!-- </vscode-split-layout> -->
                  <!-- </vscode-split-layout> -->
                </SplitPane>
              </div>
              <!-- </vscode-split-layout> -->
            </SplitPane>

            {#if $_$_rightSidebarVisible}
              <!-- <div
            id="action-bar-wrapper"
            class="scrollable-section"
            style="margin-top: {$_$_tabListContainerHeight
              ? `calc(${$_$_tabListContainerHeight}px + 3em)`
              : '3em'}"
          > -->
              <div
                id="action-bar-wrapper"
                class="action-bar-wrapper scrollable-section"
                in:fly={{ x: 72, duration: 180 }}
                out:fly={{ x: 72, duration: 180 }}
              >
                {#if _ischildReadyForRender.actionBar}
                  <ActionBar />
                {:else}
                  <div class="flex h-full w-full flex-col gap-4">
                    <div class="skeleton h-full w-full"></div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        {#if !_isMobileScreen && !$_$_leftSidebarVisible}
          <SidebarEdgeHandle
            side="left"
            onExpand={() => {
              _$_leftSidebarVisible.set(true)
              _$_primarySidebarVisible.set(true)
            }}
          />
        {/if}
        {#if !_isMobileScreen && !$_$_rightSidebarVisible}
          <SidebarEdgeHandle
            side="right"
            onExpand={() => {
              _$_rightSidebarVisible.set(true)
              _$_secondarySidebarVisible.set(true)
            }}
          />
        {/if}
      </div>

      <!-- Status bar -->
      {#if !_isMobileScreen && _activeEditor}
        <div
          id="status-bar"
          class="flex items-center min-w-0 w-full h-[22px] shrink-0 overflow-hidden text-[11px] bg-base-200 text-base-content select-none transition-colors border-t border-base-300"
          bind:this={_statusBarContainer}
        >
          {#if _ischildReadyForRender.statusBar}
            <div
              id="status-bar-left"
              class="flex shrink min-w-0 items-center h-full overflow-hidden"
            >
              <!-- <div id="status-bar-left" class="flex items-center flex-1 min-w-0 h-full overflow-auto"> -->
              <!-- <LimitToolbar /> -->
              <StatusBar />
            </div>

            <div
              id="status-bar-center"
              class="status-bar-center flex shrink min-w-0 items-center justify-center h-full px-2 gap-2 overflow-hidden opacity-80 hover:opacity-100 cursor-pointer"
            >
              <span class="i-carbon-script"></span>
              <span class="status-document-label truncate">{$_('Main Document')}</span>
              <div class="status-utility-bar"><UtilityBar /></div>
              <!-- <UtilityBar {_editorPaginationOptions} {_editor} {__wysiwygEditorId} /> -->
            </div>

            <div
              id="status-bar-right"
              class="flex shrink-0 items-center justify-end min-w-0 h-full overflow-hidden"
            >
              <!-- <div id="status-bar-right" class="flex items-center justify-end flex-1 min-w-0 h-full overflow-auto"> -->
              <StatusBarRight />
              <StatusBarRightP />
              <!-- <div class="px-3 h-full flex items-center hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] cursor-pointer transition-colors">
        UTF-8
      </div>
      <div class="px-3 h-full flex items-center hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] cursor-pointer transition-colors">
        Ln 1, Col 1
      </div>
      <div class="px-3 h-full flex items-center hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] cursor-pointer transition-colors bg-red-500/20">
        <span class="i-carbon-warning-alt mr-1"></span> 0
      </div> -->
            </div>
          {:else if _activeEditor}
            <div class="w-full px-2 opacity-50 italic text-[10px]">
              <!-- <div class="w-full px-2 opacity-50 italic animate-pulse33 text-[10px]"> -->
              Initializing Status Bar...
            </div>
          {/if}
        </div>

        <div
          id="status-barss"
          class="!hidden flex items-center w-full gap-2 px-2 h-8 text-sm"
          bind:this={_statusBarContainer}
        >
          <!-- <div
      id="status-bar"
      bind:this={_statusBarContainer}
    > -->
          {#if _ischildReadyForRender.statusBar}
            <!-- Left -->
            <!-- <div id="status-bar-left" class=""> -->
            <div id="status-bar-left" class="flex items-center flex-1 min-w-0">
              <StatusBar />
            </div>

            <!-- Center -->
            <!-- <div id="status-bar-center" class=""> -->
            <div id="status-bar-center" class="flex items-center justify-center flex-1 min-w-0">
              <!-- optional content -->
            </div>

            <!-- Right -->
            <!-- <div id="status-bar-right" class=""> -->
            <div id="status-bar-right" class="flex items-center justify-end flex-1 min-w-0">
              <!-- optional content -->
              <StatusBarRight />
            </div>
          {:else}
            <div class="flex h-full w-full flex-col gap-4">
              <div class="skeleton h-full w-full"></div>
            </div>
          {/if}
        </div>
      {/if}

      {#if _isMobileScreen && _activeEditor}
        <div
          id="status-bar-mobile"
          class="fixed bottom-[calc(var(--mobile-bottom-bar)+76px)] right-3 z-[90] bg-base-100/90 border border-white/10 text-base-content/70 text-[10px] px-3 py-1 rounded-full shadow-lg backdrop-blur"
        >
          <span class="truncate">{_activeEditor?.document?.name || $_('Document')}</span>
        </div>
      {/if}

      <!-- Overlay to close sidebars on mobile -->
      <!-- {#if _isMobileScreen && ($_$_leftSidebarVisible || $_$_primarySidebarVisible || $_$_secondarySidebarVisible || $_$_rightSidebarVisible || $_$_terminalVisible)}
    <div
      class="overlay"
      on:click={() => {
        _$_leftSidebarVisible.set(false)
        _$_primarySidebarVisible.set(false)
        _$_secondarySidebarVisible.set(false)
        _$_rightSidebarVisible.set(false)
        _$_terminalVisible.set(false)
      }}
    ></div>
  {/if} -->
    {/if}
  </div>

  <!-- Global code editor : to edit code globally -->
  <!-- {#if !_isMobileScreen} -->
  <div id="global-code-editor" class="">
    <GlobalCodeEditor />
  </div>

  <!-- {/if} -->

  <!-- Presentation presenter view window -->
  <!-- {#if !_isMobileScreen} -->
  <div id="presenter-view-window" class="">
    <PresenterWindowModal />
  </div>

  <!-- Global meeting window -->
  <div id="meeting-window" class="">
    <!-- {#if meetingStore.joinMeetingUrl} -->
    <!-- <div
      class="transition-all duration-300 {meetingStore.isMinimized
        ? 'w-full h-full'
        : 'w-[95%] h-[90%] rd-4 overflow-hidden shadow-2xl'}"
      class:pointer-events-none={meetingStore.isMinimized}
    > -->
    <MeetingWindowWidget />
    <!-- <MeetingWindowWidget
        meetingUrl={meetingStore.joinMeetingUrl}
        isMinimized={meetingStore.isMinimized}
      /> -->
    <!-- </div> -->
    <!-- {/if} -->
  </div>
{/key}

<Toaster position="bottom-start" />

<AddFilesToDocumentModal />
<IncludeFromDocumentModal />
<UpgradePlanModal />
<TextInputModal />
<ConfirmModal />
<AlertModal />
<StepUpModal />
<SealOptionsModal />
<ShareModal />
<ShareManagerModal />
<ExportOptionsModal />
<ExportUpdateModal />
<SettingsModal />
<ExportOptionsModal />
<LatexProjectModal />
<SessionRecoveryModal />
<TranslationPickerModal />
<FolderStructureModal />

<SpreadsheetExportModal />
<SpreadsheetImportModal />
<SpreadsheetEditorModal />
<ChartInspectorModal />
<ConditionalFormattingModal />
<LinkPreviewBubble />

<DownloadManager />
<GrammarSettingsModal />
<FileBackstage />

<style lang="postcss">
  .main-container {
    /* padding: 8px; */
  }

  :global(.splitpanes__pane) {
    /* box-shadow: 0 0 3px rgba(0, 0, 0, .2) inset;
  justify-content: center;
  align-items: center;
  display: flex;
  position: relative; */
    background-color: initial !important;
  }

  :global(.overlay) {
    @apply fixed inset-0 bg-black bg-opacity-40 z-40;
  }

  /* Animated slide for mobile */
  :global(.sidebar-wrapper) {
    @apply transition-transform duration-300 ease-in-out;
  }
  :global(.sidebar-hidden-left) {
    transform: translateX(-100%);
  }
  :global(.sidebar-hidden-right) {
    transform: translateX(100%);
  }

  #status-bar-left:empty {
    display: none;
  }

  .status-bar-center {
    flex: 1 1 auto;
  }

  .status-utility-bar {
    min-width: 0;
  }

  @media (max-width: 1280px) {
    .status-document-label {
      display: none;
    }
  }

  @media (max-width: 980px) {
    .status-utility-bar {
      display: none;
    }

    .status-bar-center {
      flex: 0 1 auto;
      padding-left: 0.25rem;
      padding-right: 0.25rem;
    }
  }
</style>
