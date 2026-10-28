<script lang="ts">
  import { get } from 'svelte/store'
  import { _$_documentEditorsList } from './stores/editor.store'

  import { createEventDispatcher, onDestroy, onMount, tick, untrack } from 'svelte'
  import { _, isLoading } from 'svelte-i18n'

  import DocumentEditor from './DocumentEditor.svelte'
  import Ribbon from './components/app/ribbon/Ribbon.svelte'
  // import CodeEditor from './components/app/editor/code/CodeEditor.svelte'
  // import HomeRibbon from './components/app/ribbon/home/HomeRibbon.svelte'
  import TabList from './components/app/navigation/TabList.svelte'

  // Images import
  // import addRoundedIcon from 'assetsImgDir/common/add-rounded.svg'
  // import SelectedTextModel from './components/app/editor/wysiwyg/models/SelectedTextModel'
  // import Terminal from './components/app/panel/Terminal.svelte'
  import Editor from './components/app/editor/Editor.svelte'
  import { DocumentModel, type DocumentEditorModel } from './models/Document'
  // import type { Document } from '../../../models/Document'

  // import { DocumentInfo } from './models/DocumentInfo'
  // import PreviewEditor from './components/app/editor/preview/PreviewEditor.svelte'
  // import IconHeartRegular from 'phosphor-icons-svelte/IconHeartRegular.svelte'
  import Utils from './utils/Utils.js'
  import EditorHelpers from './utils/EditorHelpers'
  import { _$_ribbbonVisible, _$_ribbonContainerHeight } from './stores/ribbon.store'
  import HomeScreen from './components/app/home/HomeScreen.svelte'
  import DocumentNotFound from './components/common/error/DocumentNotFound.svelte'
  import ContextMenuWidget from './components/common/contextMenu/components/ContextMenuWidget.svelte'
  import type { ContextMenuItem } from './components/common/contextMenu/utils/utils'
  import BubbleMenuWidget from './components/app/editor/components/formatting/BubbleMenuWidget.svelte'
  import {
    _$_currentView,
    _$_homeScreenVisible,
    _$_newDocumentVisible,
    _$_tabListContainerHeight,
    _$_lastOpenError,
    _$_activePrimarySidebarItem,
    _$_primarySidebarVisible,
    hideAll,
    setVisibility,
    showOnly,
    _$_homeTourCompleted,
    _$_editorTourCompleted
  } from './stores/common.store'
  import EditorCommonUtils, { goToHomeScreen, goToNewDocumentScreen } from './utils/common.utils'
  import { fluentUIcons } from './components/common/icons/Icons'
  import NewDocumentScreen from './components/app/newDocument/NewDocumentScreen.svelte'
  import { resolveApiBaseUrl } from './lib/api/shared/baseUrl'
  import { authStore } from './stores/auth.store'
  import NotAuthenticated from './components/common/auth/NotAuthenticated.svelte'
  import RegionSelector from './components/common/auth/RegionSelector.svelte'
  import Platform from './libs/platform'
  import { isGuestMode } from './utils/authMode'
  // import FormRibbon from './components/app/ribbon/components/form/FormRibbon.svelte'
  // 1. Define state using the $state rune
  // null while the probe runs, true/false for a verdict, and 'unknown' when the
  // probe could not give one. The fourth state exists because the other three
  // cannot say "nobody answered": that used to be recorded as false, and false
  // puts "We couldn't find this document" over a document that is there.
  // 'unknown' lets the editor open instead — reading the content is the
  // authoritative check, and it fails loudly on its own now, so refusing to try
  // protects nothing.
  let _documentExistence = $state<Record<string, boolean | 'unknown' | null>>({})
  // Use a Map for better lookup performance in large suites
  // let _documentExistence = $state(new Map<string, boolean | 'loading'>())
  const isAuthenticated = $derived($authStore?.authenticated)
  // The session is only known once the store settles. Until then a signed-in
  // user still reads as signed out, which is what made the app demand a second
  // sign-in while a valid token was already in hand.
  const authSettled = $derived(!$authStore?.initializing)
  const needsRegionSelection = $derived(
    isAuthenticated && Boolean($authStore?.provisioning?.needs_region_selection)
  )

  const BASE_URL = resolveApiBaseUrl()
  const packedExtensions = new Set([
    Utils.DYNADOC_EXTENSIONS.default,
    Utils.DYNADOC_EXTENSIONS.secured
  ])
  // const packedExtensions = new Set(['.xddoc', '.sddoc', '.ddoc'])
  const getAccessToken = () => {
    if (typeof localStorage === 'undefined') return null
    try {
      return localStorage.getItem('ddoc.access_token')
    } catch {
      return null
    }
  }

  const isPackedDoc = (name: string) => {
    const ext = name ? `.${name.split('.').pop() || ''}`.toLowerCase() : ''
    return packedExtensions.has(ext)
  }

  const uploadDroppedFile = async (file: File): Promise<string | null> => {
    if (!file) return null
    const token = getAccessToken()
    if (isPackedDoc(file.name)) {
      const form = new FormData()
      form.append('file', file, file.name)
      form.append('unpack', '1')
      const res = await fetch(`${BASE_URL}/drive/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: form
      })
      if (!res.ok) return null
      const payload = await res.json().catch(() => ({}))
      return payload?.path || payload?.data?.path || payload?.data?.remotePath || null
    }

    // Prefer Drive multipart for large dropped files (web/mobile). Falls back to legacy FS upload.
    const authenticated = Boolean(token)
    const stamp = new Date().toISOString().slice(0, 10)
    const uploadDir = authenticated ? `home/.tmp/uploads/${stamp}` : `public-temp/${stamp}`

    try {
      const result = await (window as any)?.server?.drive?.uploadFiles?.({
        file,
        path: uploadDir
      })
      const remotePath = result?.data?.path || result?.path || result?.data?.paths?.[0] || ''
      if (result?.ok && remotePath) return remotePath
    } catch {
      // ignore
    }

    const legacyPath = `${uploadDir}/${file.name}`.replace(/\/{2,}/g, '/')
    const res = await fetch(
      `${BASE_URL}/${authenticated ? 'fs/upload' : 'fs/public/upload'}?path=${encodeURIComponent(
        legacyPath
      )}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: file
      }
    )
    if (!res.ok) return null
    const payload = await res.json().catch(() => ({}))
    return payload?.path || legacyPath
  }

  async function ensureDocumentExists(
    editor: DocumentEditorModel | null | undefined,
    options?: { force?: boolean }
  ) {
    if (!editor?.document) return

    const editorId = resolveEditorId(editor) || editor.document.uuid || editor.id || ''
    if (!editorId) return

    // The map is keyed by the document's own id, so every editor opened on the
    // same document shares one entry. A "missing" verdict must therefore never
    // be cached for the rest of the session: a document can be missing when a
    // tab is restored and present a moment later — the drive answers late, the
    // file is unpacked, the same document is reopened by another path — and the
    // old verdict kept showing "document introuvable" over a document that was
    // there, with no way back short of reloading the page. Only a definite
    // "it is there" is cached; a negative and an unknown are both re-checked,
    // for the same reason. A probe still in flight (null) is left alone so the
    // next run of the effect does not fire a second one.
    const tracked = editorId in _documentExistence
    const verdict = _documentExistence[editorId]
    if (!options?.force && tracked && verdict !== false && verdict !== 'unknown') return

    // Re-checking a known-missing document keeps the panel on screen while the
    // probe runs; only a first check shows the loading state.
    if (!tracked) {
      _documentExistence[editorId] = null
    }
    // _documentExistence.set(editorId, 'loading')

    try {
      const exists = await editor.document.locationExistAsync()
      _documentExistence[editorId] = exists
      // _documentExistence.set(editorId, exists)
    } catch (err) {
      // The probe itself broke. That says nothing about the document, so it
      // must not be recorded as the document's absence.
      console.warn('ensureDocumentExists: probe failed, verdict unknown', editorId, err)
      _documentExistence[editorId] = 'unknown'
    }
  }

  // 3. Use $derived to track the list and $effect to handle the side effect
  $effect(() => {
    // Accessing .length makes this effect re-run whenever the list changes
    if ($_$_documentEditorsList?.length || isAuthenticated) {
      for (const editor of $_$_documentEditorsList) {
        // We don't need 'void' here, but it's fine for linting
        ensureDocumentExists(editor)
      }
    }
  })

  // Web/mobile: when returning from Casdoor, we may have already cached "not found" while unauthenticated.
  // Force a re-check once auth becomes available so open documents recover without a manual reload.
  let _prevAuth = $state<boolean | null>(null)
  $effect(() => {
    const authed = Boolean(isAuthenticated)
    if (_prevAuth === null) {
      _prevAuth = authed
      return
    }
    if (!_prevAuth && authed && !Platform.isDesktopPlatform) {
      for (const editor of $_$_documentEditorsList || []) {
        const id = resolveEditorId(editor) || editor?.document?.uuid || editor?.id || ''
        if (id && id in _documentExistence) {
          delete _documentExistence[id]
        }
        ensureDocumentExists(editor, { force: true })
      }
    }
    _prevAuth = authed
  })

  $effect(() => {
    if ($_$_documentEditorsList.length <= 0 && $_$_currentView === 'editor') {
      _$_currentView.set('home')
    }
  })

  /*
  variable namin convention
  _ global app variable in the component
  __ params
  _$_ global app variables. Available in all the app

  */
  // let _canRenderComponents = false
  let _activeElementIndex = 0
  // const dispatch = createEventDispatcher();
  // export let childReady; // store from parent
  // let _$_wysiwygEditorsList = [{ id: _activeElementIndex, editor: null }]
  // let _$_codeEditorsList = [{ id: _activeElementIndex, editor: null }]
  // type DocumentEditor = {
  //   id: number
  //   document: Document | null
  // }
  // let isReady = false;
  onMount(() => {
    console.log('[App.svelte ] oncreate App.svelte onMount')

    if (window.api?.onAppOpenFile) {
      const unsub = window.api.onAppOpenFile(async (filePath: string) => {
        console.log('[App] System requested open file:', filePath)
        if (filePath) {
          await EditorCommonUtils.openDocumentFromInput(filePath, { parentPath: null })
        }
      })
      onDestroy(unsub)
    }

    // EditorHelpers.restoreAllDocumentEditors()
    // Notify parent that it's ready
    // dispatch("ready");
    // Now the component is ready
    // isReady = true;
    // childReady.set(true);   // make visible
  })

  let _prevEditorCount = $state<number>(0)
  let _prevView = $state<string | null>(null)

  // Home onboarding: run once when we land on the Home screen.
  $effect(() => {
    const view = $_$_currentView
    if (view === _prevView) return
    _prevView = view

    if (view !== 'home') return
    if (get(_$_homeTourCompleted)) return

    void (async () => {
      try {
        await tick()
        const { startHomeTour } = await import('./lib/tourManager')
        startHomeTour()
        _$_homeTourCompleted.set(true)
      } catch (e) {
        console.warn('[tour] failed to start home tour', e)
      }
    })()
  })

  // Editor onboarding: run once on first document open/create.
  $effect(() => {
    const count = $_$_documentEditorsList?.length || 0
    const becameNonEmpty = _prevEditorCount === 0 && count > 0
    _prevEditorCount = count
    if (!becameNonEmpty) return

    if (get(_$_editorTourCompleted)) return

    void (async () => {
      try {
        // Wait for editor/ribbon DOM to be ready.
        await tick()
        await tick()
        const { startEditorTour } = await import('./lib/tourManager')
        startEditorTour()
        _$_editorTourCompleted.set(true)
      } catch (e) {
        console.warn('[tour] failed to start editor tour', e)
      }
    })()
  })

  let _showContextMenu = false
  let _menuItems: ContextMenuItem[] = []
  let _contextMenuPositionX = 0
  let _contextMenuPositionY = 0
  let _lastMouseX = 0
  let _lastMouseY = 0

  onMount(() => {
    const trackMouse = (event: MouseEvent) => {
      _lastMouseX = event.clientX
      _lastMouseY = event.clientY
    }

    const handleWebMenu = (event: Event) => {
      const custom = event as CustomEvent<ContextMenuItem[]>
      _menuItems = Array.isArray(custom.detail) ? custom.detail : []
      _contextMenuPositionX = _lastMouseX
      _contextMenuPositionY = _lastMouseY
      _showContextMenu = true
    }

    window.addEventListener('mousemove', trackMouse)
    window.addEventListener('show-web-menu', handleWebMenu as EventListener)

    return () => {
      window.removeEventListener('mousemove', trackMouse)
      window.removeEventListener('show-web-menu', handleWebMenu as EventListener)
    }
  })

  const componentName = import.meta.url.split('/').pop()
  // ?.replace(".svelte", "") || "Unknown";
  Utils.measureRender(componentName)

  // let _documentEditors: DocumentEditorModel[] = [
  //   { index: _activeElementIndex, id: null, document: null, isActive: true }
  // ]

  // Set the editor list instance in the store
  // console.log('__rootPath Set the editor list instance in the store ', _documentEditors)
  // _$_documentEditorsList.set([..._documentEditors])

  // let _documentEditors = [{ id: _activeElementIndex, document:Document  null }]
  // let _wysiwygEditorsSelectedTextList: SelectedTextModel[][] = [[new SelectedTextModel()]]

  /*  async function addNewDocumentEditor(documentPath: string | undefined | null): Promise<void> {
    //  function addNewDocumentEditor(): void {
    const id = _documentEditors.length
    _canRenderComponents = false

    /* const docInfo = new DocumentInfo({
      size: 5000,
      mimeType: 'text/plain',
      createdAt: new Date(),
      modifiedAt: new Date()
    })

    const doc = new Document({
      path: '/path/to/dynadoc/test/test.xddoc',
      dirPath: '/path/to/dynadoc/test/',
      cachePath:
        '/path/to/dynadoc/test/cache/test.xddoc',
      cacheDirPath: '/path/to/dynadoc/test/cache/',
      info: docInfo,
      openMode: Document.OpenMode.WRITE
    }) +/

    // const json = doc.toJSON()
    // const docCopy = Document.fromJSON(json)

    // console.log(docCopy.openMode) // 'read'

    const doc = await DocumentModel.loadFrom(
      // '/path/to/dynadoc/test/test.xddoc',
      '/path/to/dynadoc/test/test.xddoc',
      DocumentModel.OpenMode.WRITE
    ) // Load a document from a file path

    console.log('Loaded document:', doc)

    _documentEditors = [
      // ..._documentEditors,
      ..._documentEditors.map((editor) => ({
        ...editor,
        isActive: false // set all other editors to inactive
      })),
      {
        index: id,
        id: id.toString(),
        document:
          // null // Create a new Document instance
          // For testing
          // Document.loadFrom(
          //   '/path/to/dynadoc/test/test.xddoc',
          //   Document.OpenMode.WRITE
          // ) // Load a document from a file path
          doc,
        isActive: true
      }
    ]

    // Set the editor list instance in the store
    console.log('__rootPath Set the editor list instance in the store ', _documentEditors)
    _$_documentEditorsList.set([..._documentEditors])
    // _$_documentEditorsList.set(_documentEditors)
    console.log(
      '__rootPath Set the editor list instance in the store ',
      _$_documentEditorsList.get(id.toString())
    )

    // _documentEditors = [..._documentEditors, { id: id, document: null }]
    // _$_wysiwygEditorsList = [..._$_wysiwygEditorsList, { id: id, editor: null }]
    // _$_codeEditorsList = [..._$_codeEditorsList, { id: id, editor: null }]
    // _wysiwygEditorsSelectedTextList = [
    //   ..._wysiwygEditorsSelectedTextList,
    //   [new SelectedTextModel()]
    // ]
    _canRenderComponents = true

    console.log('_documentEditors', _documentEditors)
  } */

  // Handle files drop
  let droppedFiles: FileList

  // window.addEventListener('dragover', (e) => e.preventDefault())
  /* window.addEventListener('drop', async (e) => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) {
      droppedFiles = e.dataTransfer.files
      // var droppedFile = e.dataTransfer.files[0].path // full file path
      console.log('Dropped file:', droppedFiles)
      for (let i = 0; i < droppedFiles.length; i++) {
        const file = droppedFiles[i]
        console.log('File path:', file.path)
        // _documentEditors =
        await EditorHelpers.addNewDocumentEditor(file.path, () => {
          _canRenderComponents = true
        })
        // await  addNewDocumentEditor(file.path)
      }
    }
  }) */
  /* window.addEventListener('drop', async (e) => {
      e.preventDefault()
      if (e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files).map(f => ({
          path: f.path,
          name: f.name
        }))

        await window.electronAPI.sendDroppedFiles(files, async (files) => {
          for (const file of files) {
            console.log('Dropped file path:', file.path)
            await EditorHelpers.addNewDocumentEditor(file.path, () => {
              console.log('Editor ready for', file.path)
            })
          }
        })
      }
    }) */

  /*  window.api.handleFileDrop(async (files) => {
      for (const file of files) {
        console.log('Dropped file path:',file, file.path) // TS happy
        await EditorHelpers.addNewDocumentEditor(file.path)
      }
    }) */

  window.addEventListener('drop', async (e) => {
    e.preventDefault()
    // Get the dataTransfer object which holds the dropped files
    const droppedFiles = e.dataTransfer.files

    if (droppedFiles.length > 0) {
      // filePaths = []; // Reset paths

      for (let i = 0; i < droppedFiles.length; i++) {
        const file = droppedFiles[i]
        // Call the exposed API from the preload script
        const droppedPath = (() => {
          try {
            return window.api?.getFilePath?.(file) || (file as any)?.path || null
          } catch {
            return null
          }
        })()

        if (typeof droppedPath === 'string' && droppedPath.trim()) {
          console.log('Dropped file path:', droppedPath)
          await EditorCommonUtils.addNewDocumentEditor(droppedPath, null, () => {
            console.log('Editor ready for', droppedPath)
          })
          continue
        }

        const uploadedPath = await uploadDroppedFile(file)
        if (uploadedPath) {
          console.log('Dropped file uploaded to:', uploadedPath)
          await EditorCommonUtils.addNewDocumentEditor(uploadedPath, null, () => {
            console.log('Editor ready for', uploadedPath)
          })
        }
      }

      /*c onst items = Array.from(e.dataTransfer.items).map((i) => i.getAsFile())

      console.log('Dropped file items :', items)
      const files = await window.api.sendDroppedFiles(items)
      console.log('Dropped file files :', files)
      for (const file of files) {
        console.log('Dropped file path:', file.path) // ✅ full path
      } */
    }
  })

  window.addEventListener('dragover', (e) => e.preventDefault())

  async function handleRetryMissingFile() {
    const filePath = await window.api.openDialogFile()
    if (!filePath) return
    await EditorCommonUtils.openDocumentFromInput(filePath, { parentPath: null })
    _$_lastOpenError.set(null)
  }

  function handleGoBackFromMissing() {
    _$_lastOpenError.set(null)
    goToHomeScreen()
  }

  function handleSearchFromMissing() {
    _$_activePrimarySidebarItem.set('search')
    _$_primarySidebarVisible.set(true)
  }

  function handleCreateNewFromMissing() {
    _$_lastOpenError.set(null)
    goToNewDocumentScreen()
  }

  // const topTabs = ['Home']
  // 1. Track the active tab state
  // let activeTopTab = 'Home'
  // const topTabComponents = {
  //   Home: HomeScreen
  // }

  const activeDocument = _$_documentEditorsList.getActive()
  $effect(() => {
    // setVisibility('homeScreen', $activeDocument ? false : true)
    // setVisibility('newDocument', $activeDocument ? false : true)
  })

  const MAX_HOT_TABS = 10
  // const MAX_HOT_TABS = 3
  let hotPoolIds = $state<string[]>([])

  const resolveEditorId = (editor?: DocumentEditorModel | null): string | null => {
    if (!editor) return null
    // Prioritize unique identifiers over paths
    const id = editor.uuid || editor.document?.uuid || editor.id || editor.document?.path
    return id ? id.toString() : null
  }

  const buildUniqueEditorKeys = (editors: Array<DocumentEditorModel | null | undefined>) => {
    const seen = new Map<string, number>()
    return (editors || []).filter(Boolean).map((editor, index) => {
      const base = resolveEditorId(editor) || `index:${index}`
      const count = seen.get(base) ?? 0
      seen.set(base, count + 1)
      const key = count === 0 ? base : `${base}::${count}`
      return { editor, key }
    })
  }

  const keyedEditors = $derived.by(() => buildUniqueEditorKeys($_$_documentEditorsList || []))

  $effect(() => {
    // 1. This is your "Trigger": Whenever the document list or active status changes
    const list = $_$_documentEditorsList || []

    // 2. Logic that shouldn't trigger a re-run
    untrack(() => {
      const currentIds = list
        .map((editor, index) => resolveEditorId(editor) || `index:${index}`)
        .filter(Boolean)

      // Filter existing pool based on what's still in the document list
      let updatedPool = hotPoolIds.filter((id) => currentIds.includes(id))

      const activeEditor = list.find((e) => e?.isActive)
      const activeId = activeEditor
        ? resolveEditorId(activeEditor) || currentIds[list.indexOf(activeEditor)]
        : null

      if (activeId) {
        updatedPool = [activeId, ...updatedPool.filter((id) => id !== activeId)]
      } else if (updatedPool.length === 0 && currentIds.length > 0) {
        updatedPool = currentIds
      }

      // 3. This write is now safe because the read was untracked
      hotPoolIds = updatedPool.slice(0, MAX_HOT_TABS)
    })
  })

  // function goToHomeScreen() {
  //   showOnly('homeScreen')
  //   _$_documentEditorsList.clearActive()
  // }
</script>

<!-- {#if isReady} -->
<div class="app-container h-full min-h-0 overflow-hidden">
  <!-- <IconHeartRegular /> -->
  <!-- <DocumentEditor key="1"> -->

  <!-- {#if _canRenderComponents} -->
  <!-- {$_$_documentEditorsList[0].document.path} -->
  <!-- {$_$_documentEditorsList[0].document.getMainFileContent()} -->
  <!-- {#if false} -->
  <!-- <HomeScreen></HomeScreen> -->
  <!-- <FloatingToolbar></FloatingToolbar> -->
  {#if needsRegionSelection}
    <RegionSelector />
  {:else}
    <ContextMenuWidget
      bind:__show={_showContextMenu}
      __x={_contextMenuPositionX}
      __y={_contextMenuPositionY}
      __menuItems={_menuItems}
    />
    <div class="h-full min-h-0 overflow-hidden">
      <!-- {#if $_$_homeScreenVisible} -->
      {#if ($_$_documentEditorsList.length <= 0 && $_$_currentView !== 'new-doc') || $_$_currentView === 'home'}
        <div class="h-full min-h-0 overflow-auto">
          {#if $_$_lastOpenError?.type === 'not-found'}
            <DocumentNotFound
              docName={$_$_lastOpenError?.path?.split(/[/\\]/).pop()}
              onRetry={handleRetryMissingFile}
              onGoBack={handleGoBackFromMissing}
              onSearch={handleSearchFromMissing}
              onCreateNew={handleCreateNewFromMissing}
              showCreateNew={true}
            />
          {:else}
            <HomeScreen />
            <!-- <svelte:component this={topTabComponents[activeTopTab]} /> -->
          {/if}
        </div>
        <!-- {/if} -->
      {:else if $_$_currentView === 'new-doc'}
        <!-- {:else if $_$_newDocumentVisible} -->
        <!-- {#if $_$_newDocumentVisible} -->
        <div class="h-full min-h-0 overflow-auto">
          <NewDocumentScreen />
          <!-- <svelte:component this={topTabComponents[activeTopTab]} /> -->
        </div>
      {/if}
      <!-- {:else if $_$_documentEditorsList.length > 0} -->
      {#if $_$_documentEditorsList.length > 0}
        <!-- <div
        class="document-editors-list h-full {!$_$_homeScreenVisible && !$_$_newDocumentVisible
          ? '!block'
          : '!hidden'}"
        id="document-editors-list"
        role="tablist"
        style="padding-top: {$_$_ribbonContainerHeight
          ? `calc(${$_$_ribbonContainerHeight}px + 3em)`
          : '3em'}"
      > -->

        <!-- <div class="{$_$_ribbbonVisible ? '' : 'hidden'} absolute w-full bg-base-100">
                <div class="document-editor h-full {true ? '' : 'hidden'} ">
                <div class="document-editor h-full {element.isActive ? '' : 'hidden'} ">
                  <Ribbon />
                </div>
              </div> -->

        <!-- <div
        class="document-editors-list h-full {$_$_currentView === 'editor' ? '!block' : '!hidden'}"
        id="document-editors-list"
        role="tablist"
        style="padding-top: {$_$_tabListContainerHeight
          ? `calc(${$_$_tabListContainerHeight}px + 3em)`
          : '3em'}"
      > -->
        <!-- <div
        class="document-editors-list h-full {$_$_currentView === 'editor' ? '!block' : '!hidden'}"
        id="document-editors-list"
        role="tablist"
        style="padding-top: {$_$_tabListContainerHeight
          ? `calc(${$_$_tabListContainerHeight}px + 3em)`
          : '3em'}"
      > -->
        <div
          class="document-editors-list h-full min-h-0 {$_$_currentView === 'editor'
            ? '!block'
            : '!hidden'}"
          id="document-editors-list"
          role="tablist"
        >
          {#each keyedEditors as entry (entry.key)}
            {@const documentEditor = entry.editor}
            {@const documentEditorIndex = $_$_documentEditorsList.indexOf(documentEditor)}
            <!-- {#each $_$_documentEditorsList as documentEditor, documentEditorIndex (documentEditor.index)} -->
            <!-- {#each _$_documentEditorsList.getList() as documentEditor, documentEditorIndex (documentEditor.index)} -->
            <!-- {#each _documentEditors as documentEditor, documentEditorIndex (documentEditor.index)} -->
            <!-- {#if documentEditor.document} -->
            {#if documentEditor}
              {@const documentEditorId =
                resolveEditorId(documentEditor) || `index:${documentEditorIndex}`}
              {#if hotPoolIds.includes(documentEditorId)}
                {@const state = _documentExistence[documentEditorId]}
                <!-- {@const state = _documentExistence.get(documentEditorId)} -->
                <!-- {@const state = _documentExistence.get(documentEditorId)} -->
                {@const isPublicShared =
                  Boolean(documentEditor?.document?.path) &&
                  DocumentModel.isShareCachePath(documentEditor.document.path)}
                {@const requiresAuthForThisDoc =
                  !Platform.isDesktopPlatform &&
                  authSettled &&
                  !isAuthenticated &&
                  !isPublicShared &&
                  !isGuestMode()}
                {#if requiresAuthForThisDoc}
                  <div
                    class="document-editor h-full {documentEditor.isActive
                      ? 'active !block'
                      : 'mru-hidden'}"
                  >
                    <NotAuthenticated
                      docName={documentEditor?.document?.path?.split(/[/\\]/).pop()}
                    />
                  </div>
                {:else if state === null}
                  <div
                    class="document-editor h-full {documentEditor.isActive
                      ? 'active !block'
                      : 'mru-hidden'}"
                  >
                    <div
                      class="h-full w-full flex items-center justify-center text-base-content/50 text-[12px]"
                    >
                      {$_('Loading...')}
                    </div>
                  </div>
                  <!-- Only a definite "it is not there" says so. An 'unknown'
                       verdict falls through to the editor below, where reading
                       the content decides. -->
                {:else if state === false}
                  <!-- {:else if documentExists === false} -->
                  <!-- __documentToOpen = {JSON.stringify(documentEditor)}, -->
                  <div
                    class="document-editor h-full {documentEditor.isActive
                      ? 'active !block'
                      : 'mru-hidden'}"
                  >
                    <DocumentNotFound
                      docName={documentEditor?.document?.path?.split(/[/\\]/).pop()}
                      onRetry={handleRetryMissingFile}
                      onGoBack={handleGoBackFromMissing}
                      onSearch={handleSearchFromMissing}
                      onCreateNew={handleCreateNewFromMissing}
                      showCreateNew={true}
                    />
                  </div>
                {:else if state !== false && documentEditor.document}
                  <!-- {:else if documentExists !== false && documentEditor.document} -->
                  <div
                    class="document-editor h-full {documentEditor.isActive
                      ? 'active !block'
                      : 'mru-hidden'}"
                    id="document-editor-{documentEditorIndex}"
                    data-tabs-group="document-editor"
                    data-tabs-target="#document-editor-{documentEditorIndex}"
                    role="tab"
                    aria-controls={documentEditorIndex}
                    aria-selected="false"
                    style:content-visibility={documentEditor.isActive ? 'visible' : 'hidden'}
                  >
                    <div class="document-editor-wrapper">
                      <!-- <div class="top">Header or Top content</div>

          <div class="middle hidde">
            <p>Line 1<br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /></p>
            <p>Line 2<br /><br /><br /><br /><br /><br /><br /><br /><br /><br /></p>
            <p>Line 2<br /><br /><br /><br /><br /><br /><br /><br /><br /><br /></p>
            <p>Line 2<br /><br /><br /><br /><br /><br /><br /><br /><br /><br /></p>
            <p>...</p>
            <p>Line 100</p>
          </div> -->
                      <!-- <div class="middle hidden"> -->
                      <DocumentEditor key={documentEditorIndex}>
                        <!-- <div slot="ribbon" class="top"> -->
                        <!-- <div class="top hidde"> -->
                        <!-- <Ribbon
                    __codeEditorId={documentEditorIndex}
                    __wysiwygEditorId={documentEditorIndex}
                  /> -->
                        <!-- <Ribbon
                    bind:__wysiwygEditorSelectedTextList={_wysiwygEditorsSelectedTextList[
                      documentEditorIndex
                    ]}
                    __codeEditorId={documentEditorIndex}
                    __wysiwygEditorId={documentEditorIndex}
                  /> -->
                        <!-- </div> -->
                        <!-- </div> -->
                        <div slot="editor" class="middle">
                          <!-- <div class="middle hidde"> -->
                          <!-- <CodeEditor -->

                          <Editor
                            __parentContainerKey={documentEditor.uuid ||
                              documentEditor.document?.uuid ||
                              documentEditor.id}
                            __documentToOpen={documentEditor.document}
                            __filePathToOpenFromDocument={documentEditor.document.getMainFilePath()}
                            __codeEditorId={documentEditor.uuid ||
                              documentEditor.document?.uuid ||
                              documentEditor.id}
                            __wysiwygEditorId={documentEditor.uuid ||
                              documentEditor.document?.uuid ||
                              documentEditor.id}
                            __isPreviewEditor={documentEditor.document.isDocumentLikeNonWysiwyg()}
                          />
                          <!-- <Editor
                          __parentContainerKey={documentEditor.uuid ||
                            documentEditor.document?.uuid ||
                            documentEditor.id}
                          __documentToOpen={documentEditor.document}
                          __filePathToOpenFromDocument={documentEditor.document.getMainFilePath()}
                          __codeEditorId={documentEditor.uuid ||
                            documentEditor.document?.uuid ||
                            documentEditor.id}
                          __wysiwygEditorId={documentEditor.uuid ||
                            documentEditor.document?.uuid ||
                            documentEditor.id}
                          __isPreviewEditor={documentEditor.document.isDocumentLoadedFromAssets()}
                        /> -->
                          <!-- <Editor
                      __parentContainerKey={documentEditor.id}
                      __documentToOpen={documentEditor.document}
                      __filePathToOpenFromDocument={documentEditor.document.getMainFilePath()}
                      __codeEditorId={documentEditor.document.getMainFilePath()}
                      __wysiwygEditorId={documentEditor.document.getMainFilePath()}
                      __isPreviewEditor={(Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST.includes(
                        documentEditor.document.extension
                      ) &&
                        !documentEditor.document.cachePath) ||
                        (documentEditor.document.cachePath &&
                          documentEditor.document.path.startsWith(
                            documentEditor.document.getAsset(DocumentModel.AssetType.CODE)
                          ))}
                    /> -->
                          <!-- <Editor
                    __parentContainerKey={documentEditor.id}
                    __documentToOpen={documentEditor.document}
                    __filePathToOpenFromDocument={documentEditor.document.getMainFilePath()}
                    __codeEditorId={documentEditorIndex}
                    __wysiwygEditorId={documentEditorIndex} 
                    __isPreviewEditor={(Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST.includes(
                      documentEditor.document.extension
                    ) &&
                      !documentEditor.document.cachePath) ||
                      (documentEditor.document.cachePath &&
                        documentEditor.document.path.startsWith(
                          documentEditor.document.getAsset(DocumentModel.AssetType.CODE)
                        ))}
                  /> -->
                          <!-- <Editor
                    __parentContainerKey={documentEditor.index}
                    __documentToOpen={documentEditor.document}
                    __filePathToOpenFromDocument={documentEditor.document.getMainFilePath()}
                    __codeEditorId={documentEditorIndex}
                    __wysiwygEditorId={documentEditorIndex}
                    __isPreviewEditor={Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST.includes(
                      documentEditor.document.extension
                    )}
                  /> -->

                          <!-- <Editor
                    __parentContainerKey={documentEditor.id}
                    __documentToOpen={documentEditor.document}
                    __filePathToOpenFromDocument={documentEditor.document.getMainFilePath()}
                    bind:__wysiwygEditorSelectedTextList={_wysiwygEditorsSelectedTextList[
                      documentEditorIndex
                    ]}
                    __codeEditorId={documentEditorIndex}
                    __wysiwygEditorId={documentEditorIndex}
                  /> -->
                        </div>
                        <!-- </div> -->

                        <!-- <div slot="panel" class="bottom resizable">
                  <div class="resize-handle top"></div>
                  <-- <div class="bottom"> ->
                  <--bottom panel for the terminal... ->
                  <Terminal
                    __codeEditorId={documentEditorIndex}
                    __wysiwygEditorId={documentEditorIndex}
                  />
                </div> -->
                        <!-- </div> -->
                      </DocumentEditor>
                    </div>

                    <!-- <div class="bottom">Footer or Bottom content</div> -->
                  </div>
                {:else}
                  <div
                    class="document-editor h-full {documentEditor.isActive
                      ? 'active !block'
                      : 'mru-hidden'}"
                    id="document-editor-{documentEditorIndex}"
                    data-tabs-group="document-editor"
                    data-tabs-target="#document-editor-{documentEditorIndex}"
                    role="tab"
                    aria-controls={documentEditorIndex}
                    aria-selected="false"
                    style:content-visibility={documentEditor.isActive ? 'visible' : 'hidden'}
                  >
                    <div class="document-editor-wrapper">
                      <div class="flex h-full w-full flex-col gap-4">
                        <div class="skeleton h-full w-full"></div>
                      </div>
                    </div>
                  </div>
                {/if}
              {/if}
            {/if}
            <!-- </div> -->
          {/each}
        </div>
      {/if}
    </div>
  {/if}
  <!-- </DocumentEditor> -->
</div>

<!-- {/if} -->

<style>
  /* .navigation-tablist-wrapper {
    display: flex;
    position: fixed;
    left: 0;
    right: 0;
    z-index: 30;
  } */
  .app-container {
    display: flex;
    flex-direction: column;
  }

  .document-editors-list {
    /* display: flex;
    flex-direction: column; */
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  .document-editor {
    /* display: none; */
  }
  .document-editor.active {
    /* display: block !important; */
  }
  .mru-hidden {
    display: none !important;
  }

  .document-editor-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .top {
    /* height: 60px; */
    /* background: #f0f0f0; */
    /* flex-shrink: 0; */
    flex: 0 0 150px;
    /* max-height: 150px; */
    min-height: 0;
    overflow: auto;
  }

  .middle {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    /* background: #e0e0ff; */
    /* margin-bottom: var(--bottom-height, 100px); */
  }

  .bottom {
    resize: vertical;
    overflow: auto;
    /* height: var(--bottom-height, 100px); */
    background: #ccc;
    position: absolute;
    bottom: 10vh;
    left: 0;
    right: 0;
    min-height: 50px;
    max-height: 50%;
    z-index: 12;
  }
  /*
  .ccontainer2 {
    display: flex;
    flex-direction: column;
    height: 100vh; or 100% if parent has a defined height
  }

  .top2,
  .bottom2 {
    flex: 0 0 auto; fixed height content
    padding: 10px;
    background: #f0f0f0;
  }

  .middle2 {
    flex: 1 1 auto; takes up remaining space
    overflow-y: auto; scroll vertically if needed
    padding: 10px;
    background: #d0d0ff;
  } */
</style>
