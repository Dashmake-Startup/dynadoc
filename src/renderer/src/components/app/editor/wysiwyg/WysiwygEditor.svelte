<!--
 Copyright (C) 2024 Dashmake Inc.

 This file is part of DDoc Office.

 DDoc Office is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 DDoc Office is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
-->
<!-- App.svelte -->
<script lang="ts">
  // Transcription WebSocket endpoint — provided at build time, never hardcoded.
  const TRANSCRIBE_WS_URL = (import.meta as any).env?.VITE_TRANSCRIBE_WS_URL ?? ''

  //   const nodeApi =
  //     typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
  //   const fs = nodeApi?.fs
  //   const path = nodeApi?.path
  import { _ } from 'svelte-i18n'
  import {
    _$_wysiwygEditorsList,
    _$_codeEditorsList,
    _$_documentEditorsList
  } from '../../../../stores/editor.store'
  // import { _$_activeDocumentVars } from '../../../../stores/vars'

  import { v4 as uuidv4 } from 'uuid'
  import { cryptoRandomUUID } from '../../../../utils/common.utils'
  import { openTiming, type OpenTimingHandle } from '../../../../utils/openTiming'
  // import prettier from 'prettier'
  // import prettierSvelte from 'prettier-plugin-svelte'
  // import {plugin} from "@prettier/plugin-pug"

  /*   import {
    Svelte_component,
    detach,
    init,
    insert,
    noop,
    safe_not_equal,
    text
    // } from "./test/svelte/src/runtime/internal";
  } from 'https://unpkg.com/svelte@4.2.18/src/runtime/internal/index.js' */
  // from 'https://unpkg.com/svelte@latest/internal/index.mjs';

  // import * from './test/svelte/src/runtime/internal/animations.js'
  import { initFlowbite } from 'flowbite'
  // import * as sveltew from 'svelte/internal'
  // import * as esbuild from 'esbuild'
  // import pug from 'pug'
  // import html2pug from 'html2pug'
  // import { convert } from 'xhtml2pug' // Lib to convert html to pug code
  import TurndownService from 'turndown'
  import markdownit from 'markdown-it'

  // import parserHtml from 'prettier/plugins/html.mjs';

  // import parserHtml from "prettier/parser-html";
  // import parserTypeScript from "prettier/parser-typescript";
  import prettier from 'prettier/standalone'
  import { html as beautifyHtml } from 'js-beautify'

  // import prettier from 'prettier/standalone'
  // import parserHtml from 'prettier/plugins/html';  // Note the `.js` extension
  // import path from 'path'
  // npm install marked
  import EditorHelpers from '../../../../utils/EditorHelpers.js'

  import Document from '@tiptap/extension-document'
  import { OrderedList } from '@tiptap/extension-list'
  import Paragraph from '@tiptap/extension-paragraph'
  import Text from '@tiptap/extension-text'

  import {
    CustomTagExtension,
    CustomNodeManipulationCommand,
    CustomScriptTag,
    CustomStyleTag
  } from '../../../../extensions/tiptap/CustomCustomTagExtension'
  import { CustomSlashCommandExtension } from '../../../../extensions/tiptap/CustomSlashCommandExtension/CustomSlashCommandExtension.svelte'
  import { CustomSlashCommandExtensionProps } from '../../../../extensions/tiptap/CustomSlashCommandExtension/utils/common.utils'
  import ExpressionInserter from '../components/expression/ExpressionInserter.svelte'
  // import SelectedTextModel from './models/SelectedTextModel.js'
  import type { Event } from 'electron'
  import Utils from '../../../../utils/Utils.js'
  import { prosemirrorToYXmlFragment } from 'y-prosemirror'
  import { DOMParser } from 'prosemirror-model'

  // import { Editor } from '@tiptap/core'

  /*   import { onMount } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Drawing from '../../ribbon/components/objects/drawing';
  import DrawingNode from '../../ribbon/components/objects/DrawingNode.svelte';

  let editor;

  onMount(() => {
    editor = new Editor({
      element: document.querySelector('#editor'),
      extensions: [
        StarterKit,
        Drawing.extend({
          addNodeView() {
            return ({ node }) => {
              const dom = document.createElement('div');
              new DrawingNode({ target: dom, props: { node } });
              return { dom };
            };
          }
        })
      ],
      content: `
        <p>This is a text editor with a canvas below:</p>
        <drawing></drawing>
      `
    }); */

  /*
    npm install @tiptap/starter-kit @tiptap/extension-highlight @tiptap/extension-text-align
    npm i @tiptap/starter-kit @tiptap/extension-list-item @tiptap/extension-highlight @tiptap/extension-text-align

    npm uninstall @tiptap/svelte @tiptap/starter-kit @tiptap/extension-highlight @tiptap/extension-text-align


    */

  import { Editor } from '@tiptap/core'
  import Collaboration, { isChangeOrigin } from '@tiptap/extension-collaboration'
  import CollaborationCaret from '@tiptap/extension-collaboration-caret'
  import { registerEditorHistory } from '../../../../stores/history.store'
  import { Color } from '@tiptap/extension-color'
  import { ListItem } from '@tiptap/extension-list-item'
  import { TextStyle, FontSize, FontFamily, TextStyleKit } from '@tiptap/extension-text-style'
  import Superscript from '@tiptap/extension-superscript'
  import Subscript from '@tiptap/extension-subscript'
  // import Highlight from '@tiptap/extension-highlight'
  import { StarterKit } from '@tiptap/starter-kit'
  import Image from '@tiptap/extension-image'
  import { Highlight } from '@tiptap/extension-highlight'
  import { TextAlign } from '@tiptap/extension-text-align'
  import { Node as ProseMirrorNode } from 'prosemirror-model'
  import { TextSelection, Selection } from 'prosemirror-state'
  import InvisibleCharacters from '@tiptap/extension-invisible-characters'
  import { generateUniqueIds, UniqueID } from '@tiptap/extension-unique-id'
  import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details'
  import { queueFontResolveFromEditor } from '../../../../services/fonts/fontResolver'
  // Tiptap extensions cloned from github

  /*   import {
    PaginationPlus
    // TablePlus,
    // TableRowPlus,
    // TableCellPlus,
    // TableHeaderPlus
  } from '../../../../extensions/tiptap/tiptap-pagination-plus-v1.2.2/src/index'
 */

  import {
    PaginationPlus,
    PAGE_SIZES
    // type PaginationPlusOptions
  } from '../../../../extensions/tiptap/tiptap-pagination-plus/src/index'

  import { TableCell, TableKit } from '@tiptap/extension-table'

  // import TableRow from '@tiptap/extension-table-row'
  // import TableCell from '@tiptap/extension-table-cell'
  // import TableHeader from '@tiptap/extension-table-header'
  import {
    PaginationTable
    // TablePlus
  } from '../../../../extensions/tiptap/tiptap-table-plus/src/index'
  // } from '../../../../extensions/tiptap/tiptap-table-plus/src/index'

  // '/path/to/dynadoc/src/renderer/src/extensions/tiptap/tiptap-table-plus/src/index.ts'
  import ImageResizeWithCaption from '../../../../extensions/tiptap/tiptap-extension-figure/src/index'

  // import PaginationExtension, {
  //   PageNode,
  //   HeaderFooterNode,
  //   BodyNode
  // } from '../../../../extensions/tiptap/tiptap-extension-pagination/src/index'
  import {
    DEFAULT_PAPER_SIZE,
    paperDimensions
  } from '../../../../extensions/tiptap/tiptap-pagination-plus-v1.1.2/src/custom/constants/paperSize'

  import type {
    PaperDimensions,
    PaperSize
  } from '../../../../extensions/tiptap/tiptap-pagination-plus-v1.1.2/src/custom/types/paper'
  import { mmToPixels } from '../../../../extensions/tiptap/tiptap-pagination-plus-v1.1.2/src/custom/utils/window'

  // import PaginationExtension from 'tiptap-extension-pagination'

  import { Markdown } from 'tiptap-markdown-3'

  // import markdownit from 'markdown-it'
  import MarkdownIt from 'markdown-it'

  import * as Y from 'yjs'
  import InputModal from './InputModal.svelte'

  // Add custom Tiptap extensions

  // import FloatingMenu from '../components/formatting/FloatingMenu.svelte'

  import { onDestroy, onMount } from 'svelte'
  import { debounce } from 'lodash'
  import Platform from '../../../../libs/platform'
  import BubbleMenuWidget from '../components/formatting/BubbleMenuWidget.svelte'
  // FloatingToolbar is kept for future activation — not mounted yet
  import type { DocumentModel } from '../../../../models/Document'
  // import PdfRenderer from '../../../../extensions/PdfRenderer.svelte'
  import ZoomWrapper from '../components/display/ZoomWrapper.svelte'

  import ContextMenuWidget from '../../../common/contextMenu/components/ContextMenuWidget.svelte'
  import BubbleMenu from '@tiptap/extension-bubble-menu'
  import { CustomLineParagraphSpacingExtension } from '../../../../extensions/tiptap/CustomLineParagraphSpacingExtension/CustomLineParagraphSpacingExtension'
  import { CustomDummyContentExtension } from '../../../../extensions/tiptap/CustomDummyContentExtension/CustomDummyContentExtension'
  import EditorExtensionHelpers from '../../../../utils/EditorExtensionHelpers'
  import { CustomPresentationExtension } from '../../../../extensions/tiptap/CustomPresentationExtension/CustomPresentationExtension'
  import { CustomAnimationExtension } from '../../../../extensions/tiptap/CustomAnimationExtension/CustomAnimationExtension'
  import { GhostWrite } from '../../../../extensions/GhostWriteExtension'
  import EditorPlaceholder from '../../../../extensions/tiptap/CustomPlaceholderExtension/components/EditorPlaceholder.svelte'
  import { CustomPlaceholderExtension } from '../../../../extensions/tiptap/CustomPlaceholderExtension/CustomPlaceholderExtension'
  import { createVariableStore } from '../../../../stores/variables.store.svelte'
  import CustomExcelTableExtensionVarLabel from '../../../../extensions/tiptap/CustomExcelTableExtension/components/CustomExcelTableExtensionVarLabel.svelte'
  import { derived, get } from 'svelte/store'
  import UtilityBar from './components/UtilityBar.svelte'
  import HeaderFooterOverlay from './components/HeaderFooterOverlay.svelte'
  import EditorCommonUtils from '../../../../utils/common.utils'
  import {
    defaultPaginationOptions,
    GenericCustomExtensionProps,
    getPaginationImpactedExtensionOptions,
    type PaginationPlusOptions
  } from '../../../../extensions/tiptap/utils/common.utils'
  import { _$_wysiwygEditorDynamicReferenceIndexes } from '../../../../extensions/tiptap/CustomDynamicReferenceNodeExtension/stores/common.store'
  import GrammarSuggestion from '../../../../extensions/tiptap/CustomGrammarCheckExtension/components/GrammarSuggestion.svelte'
  import WordCommentGutter from '../../../../extensions/tiptap/CustomWordCommentExtension/components/WordCommentGutter.svelte'
  import FindBar from '../../../../extensions/tiptap/CustomFindReplaceExtension/components/FindBar.svelte'
  import { CustomFindReplaceExtension } from '../../../../extensions/tiptap/CustomFindReplaceExtension/CustomFindReplaceExtension'
  import { _$_findBar } from '../../../../extensions/tiptap/CustomFindReplaceExtension/findBar.store'
  import MeetingFloatingToolbar from '../meeting/MeetingFloatingToolbar.svelte'
  import { CustomMeetingNoteTakingExtension } from '../../../../extensions/tiptap/CustomMeetingNoteTakingExtension/CustomMeetingNoteTakingExtension'
  import { CustomMeetingNoteTakingExtensionProps } from '../../../../extensions/tiptap/CustomMeetingNoteTakingExtension/utils/common.utils'
  import { CustomTranslationExtension } from '../../../../extensions/tiptap/CustomTranslationExtension/CustomTranslationExtension.svelte'
  import ExportOptionsModal from '../../../common/modal/ExportOptionsModal.svelte'
  import { ProviderManager } from '../../../../ProviderManager'
  import { getShareLinkContext } from '../../../../stores/shareLink.store'
  import { isGuestMode } from '../../../../utils/authMode'
  import { authStore } from '../../../../stores/auth.store'
  import { resolveLocalCollabPresence } from '../../../../utils/collabPresence'
  import { isShareCachePath } from '../../../../lib/api/web/node'
  import { nodeApi } from '../../../../utils/shims/node'
  import {
    decodeStyleBlocksInHtml,
    prepareStyleHtmlForEditor
  } from '../../../../extensions/tiptap/CustomHtmlStyleExtension/CustomHtmlStyleExtension'
  import {
    getHtmlWithComments,
    prepareHtmlForEditor
  } from '../../../../extensions/tiptap/CustomHtmlCommentExtension/CustomHtmlCommentExtension'
  import { buildCollabDocId, resolveShareContext } from '../../../../utils/collabUtils'
  // let {
  //   __documentToOpen = null, // Document to open in the editor,
  //   __filePathToOpenFromDocument,
  //   __parentContainerKey // Parent key to append to this component's id and make it unique
  // }: {
  //   __documentToOpen?: DocumentModel
  //   __filePathToOpenFromDocument: string
  //   __parentContainerKey:any // Parent key to append to this component's id and make it unique

  // } = $props()
  // import LanguageToolApi from '@343dev/languagetool-node'

  // import { editorContent } from '../../../../../../../test/editor-content'

  // export let _editorContent = ''
  /*   export let __wysiwygEditorId: string // unique identifier for this editor
  // export let __wysiwygEditor
 */
  // 1. Handle Props using the $props() rune
  let {
    _currentPaperSize = 'A4',
    __wysiwygEditorId,
    __documentToOpen = null,
    __filePathToOpenFromDocument,
    __parentContainerKey,
    __isReadOnly = false
  } = $props<{
    _currentPaperSize?: string
    __wysiwygEditorId: string
    __documentToOpen?: DocumentModel | null
    __filePathToOpenFromDocument: string
    __parentContainerKey: any
    __isReadOnly?: boolean
  }>()

  // 2. Replace reactive ($:) statements with $derived() runes
  // These will automatically update whenever _currentPaperSize changes
  const _currentPaperDimensions = $derived(paperDimensions[_currentPaperSize])

  const _currentPaperWidth = $derived(Math.round(mmToPixels(_currentPaperDimensions.width)))

  const _currentPaperHeight = $derived(Math.round(mmToPixels(_currentPaperDimensions.height)))
  const _isReadOnly = $derived(!!__isReadOnly)
  // export let handleWysiwygChange = (event, content: string = null): void => {}
  // export let handleWysiwygKeydown = (event): void => {}
  // export let handleWysiwygInput = (event): void => {}
  // export let handleWysiwygClick = (event): void => {}
  // export let handleWysiwygFocusOut = (event): void => {}
  // export let handleWysiwygFocus = (event): void => {}
  // export let handleWysiwygBlur = (event): void => {}

  let _editorElement: HTMLDivElement
  // let _editor
  let _editor: Editor = $state(null)
  let _isEditorReady = $state(false)
  // Set when the document's content could not be read. The editor is then
  // never constructed: an empty editor over a document that failed to load
  // is exactly what an autosave would persist.
  let _loadError = $state('')
  // Timing of this open, when one is being measured (see utils/openTiming).
  let _openTiming: OpenTimingHandle = null
  let _interactivePlaceholderVisible = $state(false)
  let previousEditorContent = ''
  let _headerEditor: Editor | null = null
  let _footerEditor: Editor | null = null
  let _headerEditorEl: HTMLDivElement | null = null
  let _footerEditorEl: HTMLDivElement | null = null
  let _isEditingHeader = $state(false)
  let _isEditingFooter = $state(false)
  let _headerOverlay = $state({ top: 0, left: 0, width: 0, height: 0 })
  let _footerOverlay = $state({ top: 0, left: 0, width: 0, height: 0 })
  let _headerHtml = $state('')
  let _footerHtml = $state('')

  // let editor: Editor
  let _editorContainer: HTMLDivElement, _editorContainerRoot: HTMLDivElement
  let detachBubbleMenuScrollListener: (() => void) | null = null
  // let _domEditorContent: HTMLDivElement

  let _domWysiwygEditor,
    _isWysiwygEditorFocused = false,
    _isUserWritingExpression = false,
    _preventKeyDownDefaultEvent = true

  let _savedRange = null
  let _component
  // let compiledSvelteComponentContainer, domWysiwygEditorCompiledCode

  // let _documentVariables = {},
  //   _currentlyFocusedDocumentExpression

  let _expressionInserterPosition = {
      top: '0px',
      left: '0px'
    },
    _expressionInserterInstance,
    _expressionInserterTarget,
    _expressionInserterSearchQuery = '',
    _destroyExpressionInserterInstance = () => {
      _isUserWritingExpression = false
      _expressionInserterSearchQuery = ''
      if (_expressionInserterInstance) {
        _expressionInserterInstance.$destroy()
        _expressionInserterInstance = null
        if (_expressionInserterTarget) {
          document.body.removeChild(_expressionInserterTarget)
          _expressionInserterTarget = null
        }
      }
      _domWysiwygEditor.focus()
    }

  //   $: _editorContent = async (){
  // return  await __documentToOpen.getFileContent(__filePathToOpenFromDocument)
  //   }

  let _editorContent = ''

  let _contextMenuPositionX = 0
  let _contextMenuPositionY = 0
  let _showContextMenu = $state(false)
  function hideContextMenu() {
    _showContextMenu = false
  }

  async function openContextMenuAtEvent(event: MouseEvent) {
    if (_isReadOnly) return
    event.preventDefault()
    event.stopPropagation()

    // If already showing, hide it first to force a re-render/re-position
    if (_showContextMenu) {
      _showContextMenu = false
      // Optional: wait a tiny bit for Svelte to batch the update
      await new Promise(requestAnimationFrame)
    }

    if (_editor?.view) {
      _editor.commands.focus()
      const coords = { left: event.clientX, top: event.clientY }
      const pos = _editor.view.posAtCoords(coords)
      if (pos?.pos != null) {
        const { from, to } = _editor.view.state.selection
        const isInsideSelection = pos.pos >= from && pos.pos <= to
        if (!isInsideSelection) {
          const selection = Selection.near(_editor.view.state.doc.resolve(pos.pos), 1)
          const tr = _editor.view.state.tr.setSelection(selection)
          _editor.view.dispatch(tr)
        }
      }
    }

    _contextMenuPositionX = event.clientX
    _contextMenuPositionY = event.clientY
    _showContextMenu = true
  }
  function getContextMenuItems() {
    return null
    /* let menuItems = [
      { label: 'Copy', action: () => editor.commands.copy() },
      { label: 'Paste', action: () => editor.commands.paste() },
      { label: 'Bold', action: () => editor.commands.toggleBold() },
      { label: 'Clear Formatting', action: () => editor.commands.unsetAllMarks() }
    ]
    return menuItems */
  }

  // $: (async () => {
  //   if (__documentToOpen && __filePathToOpenFromDocument) {
  //     _editorContent = await __documentToOpen.getFileContent(__filePathToOpenFromDocument)
  //   }
  // })()

  // export let _currentPaperSize = 'B0'
  // export let _currentPaperSize = 'A0'
  /* export let _currentPaperSize = 'A4'
  let _currentPaperDimensions: PaperDimensions = paperDimensions[_currentPaperSize]
  let _currentPaperWidth: number = mmToPixels(_currentPaperDimensions.width)
  let _currentPaperHeight: number = mmToPixels(_currentPaperDimensions.height)

  $: _currentPaperDimensions = paperDimensions[_currentPaperSize]
  $: _currentPaperWidth = Math.round(mmToPixels(_currentPaperDimensions.width))
  $: _currentPaperHeight = Math.round(mmToPixels(_currentPaperDimensions.height)) */

  let _collaborationExtensionComments: any[] = []

  // Modal state
  let _collaborationExtensionModalVisible = false
  let _collaborationExtensionModalMessage = ''
  let _collaborationExtensionModalCallback: (value: string) => void = () => {}

  /* let rand = Math.floor(Math.random() * 100)
  // Multi-user setup
  const _collaborationExtensionCurrentUser = {
    id: Math.random().toString(36).slice(2),
    name: 'Anonymous' + rand,
    // name: 'Anonymous' + Math.floor(Math.random() * 100),
    color: '#' + Math.floor(Math.random() * 16777215).toString(16)
  } */
  let rand = Math.floor(Math.random() * 100)
  // Local presence user. This will be updated on mount (and on auth changes) to show
  // a real display name for authenticated users, or a Google-Docs-style anonymous label
  // for public shares / guests.
  let _collaborationExtensionCurrentUser =
    EditorExtensionHelpers.getMainWysiwygCollaborationExtensionCurrentUser(rand)

  let _authUnsub: (() => void) | null = null

  // Yjs setup
  /* const _collaborationExtensionYDoc = new Y.Doc()
  const _collaborationExtensionProvider = new WebsocketProvider(
    'ws://localhost:1234',
    `room-${rand}`,
    // 'room-1',
    _collaborationExtensionYDoc
  ) */

  // 1. Setup YDoc
  const _collaborationExtensionYDocXmlFragmentName = 'prosemirror'
  let _providerManager: ProviderManager | null = null
  let _documentVariables: Record<string, any> = {}
  let _variableStore: ReturnType<typeof createVariableStore> | null = null
  let _collabStatus: 'offline' | 'connecting' | 'connected' | 'error' = 'offline'
  let _presenceForceAnonymous = false

  const setCollabStatus = (next: 'offline' | 'connecting' | 'connected' | 'error') => {
    _collabStatus = next
    const root = _editorContainerRoot || _editorElement
    if (root) root.setAttribute('data-collab-status', next)
    if (_editor?.storage) {
      _editor.storage.collaborationStatus = next
      if (next === 'connected') {
        _editor.storage.collaborationLastSeen = null
      } else {
        _editor.storage.collaborationLastSeen = Date.now()
      }
    }
  }

  const setGhostText = (text: string) => {
    if (!_editor?.storage?.ghostWrite) return
    _editor.storage.ghostWrite.ghostText = text || ''
    _editor.view.dispatch(_editor.state.tr)
  }

  const acceptGhostText = () => {
    if (!_editor?.storage?.ghostWrite?.ghostText) return
    const text = _editor.storage.ghostWrite.ghostText
    _editor.commands.insertContent(text)
    _editor.storage.ghostWrite.ghostText = ''
    _editor.view.dispatch(_editor.state.tr)
  }

  const clearGhostText = () => {
    if (!_editor?.storage?.ghostWrite) return
    _editor.storage.ghostWrite.ghostText = ''
    _editor.view.dispatch(_editor.state.tr)
  }
  let _collaborationExtensionYDoc: Y.Doc | null = $state(null)
  let xmlFragment: Y.XmlFragment | null = null

  // 2. Perform Headless Seed
  /*  if (xmlFragment.length === 0 && _editorContent) {
    try {
      const schema = EditorExtensionHelpers.getHeadlessSchema(__wysiwygEditorId)

      // Parse HTML string to ProseMirror Doc (Headless)
      const domParser = new window.DOMParser()
      const parsedHtml = domParser.parseFromString(
        EditorHelpers.sanitizeHtml(_editorContent),
        'text/html'
      )
      // const parsedHtml = domParser.parseFromString(_editorContent, 'text/html');
      const pmDoc = DOMParser.fromSchema(schema).parse(parsedHtml.body)

      // Write to Yjs in a single transaction
      _collaborationExtensionYDoc.transact(() => {
        prosemirrorToYXmlFragment(pmDoc, xmlFragment)
      }, 'local-initial-seed')

      console.log('✅ Seeded Yjs Doc from local content successfully')
    } catch (e) {
      console.error('❌ Failed to seed Yjs Doc:', e)
    }
  } */

  // 3. Connect Provider AFTER seeding
  let _collaborationExtensionProvider: any = $state()
  /*  = new WebsocketProvider(
    'ws://localhost:1234',
    `room-${rand}`,
    _collaborationExtensionYDoc
  ) */

  /* // 1. Setup YDoc
  const _collaborationExtensionYDoc = new Y.Doc()

  // 2. SEED LOCAL CONTENT (Before Provider)
  // We check if we have local content and the YDoc is empty
  const type = _collaborationExtensionYDoc.getXmlFragment('prosemirror')
  if (type.length === 0 && _editorContent) {
    // We parse your local HTML and "seed" the YDoc
    // This makes the local content the 'base' version
    const tempEditor = new Editor({
      content: _editorContent,
      extensions: YourExtensionsArray // Use same extensions to match schema
    })

    // Convert current editor state to YDoc update
    // This effectively 'populates' the YDoc with your local data
    const nodes = tempEditor.state.doc.content
    // ... logic to sync tempEditor to _collaborationExtensionYDoc
    tempEditor.destroy()
  }

  // 3. Setup WebSocket Provider
  // Now when it connects, it will 'Merge' the online content with your local seed
  const _collaborationExtensionProvider = new WebsocketProvider(
    'ws://localhost:1234',
    `room-${rand}`,
    _collaborationExtensionYDoc
  ) */

  // let _paginationEnabled = false
  let _paginationEnabled = true

  const documentEditor = get(_$_documentEditorsList.get(__wysiwygEditorId))
  const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
  const basePaginationOptions =
    documentEditor?.document?.config.pagination || defaultPaginationOptions
  const requestedPaginationEnabled = basePaginationOptions?.enabled ?? true
  let _paginationOptions: PaginationPlusOptions = { ...basePaginationOptions }

  console.log('paginationpaginationpagination:', {
    _paginationOptions,
    basePaginationOptions,
    documentEditor
  })
  /* let _paginationOptions1: PaginationPlusOptions = {
    enabled: _paginationEnabled, // to disable pagination
    // enabled: true, // to disable pagination
    // enabled:false, // to disable pagination
    // pageHeight: 800, // Height of each page in pixels
    // pageWidth: 789, // Width of each page in pixels
    // pageHeight: 720, // Height of each page in pixels
    // pageWidth: 1280, // Width of each page in pixels
    pageHeight: PAGE_SIZES.A4.pageHeight, // Height of each page in pixels
    pageWidth: PAGE_SIZES.A4.pageWidth, // Width of each page in pixels
    pageGap: 10, // Gap between pages in pixels
    pageGapBorderSize: 1, // Border size for page gaps
    pageGapBorderColor: 'transparent', // Border color for page gaps
    pageBreakBackground: 'rgb(29 35 42)', // Background color for page gaps
    footerRight: 'Made with ❤️ by Helton', // Custom HTML content to display in the footer right side
    footerLeft: '<p><strong>Contact Me :</strong><br>dev.romikmakavana@gmail.com</p>', // Custom HTML content to display in the footer left side
    headerRight: 'Page {page}', // Custom HTML content to display in the header right side
    headerLeft: '<h1>Hey Header</h1><p>Welcome</p>', // Custom HTML content to display in the header left side
    // headerLeft: '<h1>Tiptap Pagination Plus</h1><p>by Romik Makavana</p>', // Custom HTML content to display in the header left side
    marginTop: 20, // Top margin for pages
    marginBottom: 20, // Bottom margin for pages
    marginLeft: 50, // Left margin for pages
    marginRight: 50, // Right margin for pages
    contentMarginTop: 10, // Top margin for content within pages
    contentMarginBottom: 10 // Bottom margin for content within pages
  }

  let _paginationOptions2: PaginationPlusOptions = {
    enabled: _paginationEnabled, // to disable pagination
    // enabled: true, // to disable pagination
    // enabled:false, // to disable pagination
    // pageHeight: 800, // Height of each page in pixels
    // pageWidth: 789, // Width of each page in pixels
    pageHeight: 720, // Height of each page in pixels
    pageWidth: 1280, // Width of each page in pixels
    // pageHeight: PAGE_SIZES.A4.pageHeight, // Height of each page in pixels
    // pageWidth: PAGE_SIZES.A4.pageWidth, // Width of each page in pixels
    pageGap: 2, // Gap between pages in pixels
    pageGapBorderSize: 1, // Border size for page gaps
    pageGapBorderColor: 'transparent', // Border color for page gaps
    pageBreakBackground: 'rgb(29 35 42)', // Background color for page gaps
    footerRight: '', // Custom HTML content to display in the footer right side
    footerLeft: '', // Custom HTML content to display in the footer left side
    headerRight: '{page}', // Custom HTML content to display in the header right side
    headerLeft: '', // Custom HTML content to display in the header left side
    // headerLeft: '<h1>Tiptap Pagination Plus</h1><p>by Romik Makavana</p>', // Custom HTML content to display in the header left side
    marginTop: 0, // Top margin for pages
    marginBottom: 0, // Bottom margin for pages
    marginLeft: 10, // Left margin for pages
    marginRight: 10, // Right margin for pages
    contentMarginTop: 10, // Top margin for content within pages
    contentMarginBottom: 10 // Bottom margin for content within pages
  } */

  const autosaveToDriveDebounced = debounce(async () => {
    if (_isReadOnly || isDesktopPlatform) return
    const entry = _$_documentEditorsList.getItem(__wysiwygEditorId)
    if (!entry?.document) return

    const doc = entry.document
    let outputPath = doc.isFilePartOfAParentDocument() ? doc.parentPath || doc.path : doc.path
    if (!isDesktopPlatform) {
      outputPath = doc.cachePath || outputPath
    }

    try {
      const authed = await EditorCommonUtils.ensureAuthenticated()
      if (!authed) return
    } catch {
      return
    }

    try {
      if (isDesktopPlatform) {
        const cacheDir = await window.api.getCacheDir()
        const normalizedCache =
          typeof cacheDir === 'string'
            ? cacheDir.replace(/^file:\/\//i, '').replace(/^\/+/, '')
            : ''
        if (!outputPath || (normalizedCache && outputPath.startsWith(normalizedCache))) {
          const storageDirRaw = await window.api.getStorageDir()
          const storageDir =
            typeof storageDirRaw === 'string'
              ? storageDirRaw.replace(/^file:\/\//i, '').replace(/^\/+/, '')
              : ''
          const baseName = doc.name || 'Untitled'
          const ext = doc.extension || Utils.DYNADOC_EXTENSIONS.default
          outputPath = storageDir
            ? nodeApi.path.join(storageDir, `${baseName}${ext}`)
            : `${baseName}${ext}`
        }
      }
    } catch {
      // ignore
    }

    try {
      await EditorHelpers.saveDocumentEditor(entry, { outputPath })
    } catch (err) {
      console.warn('Autosave failed', err)
      return
    }

    try {
      if (doc.cachePath) {
        await (window as any)?.server?.sync?.commit?.({ cachePath: doc.cachePath })
      }
    } catch (err) {
      console.warn('Autosave commit failed', err)
    }
  }, 2000)

  // a reference to the reactive store
  const paginationStore = _$_wysiwygEditorsList.getPaginationOptionsStore(__wysiwygEditorId)
  let paginationUnsubscribe: (() => void) | null = null

  // Now $derived will track $paginationStore correctly!
  let _editorPaginationOptions = $derived($paginationStore)

  let _paginationImpactedExtensionOptions = getPaginationImpactedExtensionOptions(
    _paginationOptions,
    __wysiwygEditorId
  )

  const LARGE_DOC_CHAR_THRESHOLD = 200000
  const shouldStartDraftMode = (html: string | null | undefined) =>
    requestedPaginationEnabled && (html?.length ?? 0) > LARGE_DOC_CHAR_THRESHOLD

  const needsHeavyExtensions = (html: string | null | undefined) =>
    /<(sheet|slide|design|gallery|survey|webpage)\b/i.test(html ?? '')

  const scheduleIdle = (callback: () => void) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      return window.requestIdleCallback(callback, { timeout: 1200 })
    }
    return window.setTimeout(callback, 200)
  }

  const applyPaginationOptions = (next: PaginationPlusOptions | null) => {
    if (!next || !_editor || _editor.isDestroyed) return
    Object.assign(_paginationOptions, next)

    // Extension instances are read-only; rely on storage + forced recalculation instead.

    if (_editor?.storage?.PaginationPlus) {
      Object.assign(_editor.storage.PaginationPlus, next)
      ;(_editor.storage.PaginationPlus as any)._forceRecalc =
        ((_editor.storage.PaginationPlus as any)._forceRecalc ?? 0) + 1
    }

    if (typeof next.enabled === 'boolean') {
      const currentEnabled = _editor.storage?.PaginationPlus?.enabled
      if (currentEnabled !== next.enabled) {
        _editor.commands.enablePagination?.(next.enabled)
      } else {
        _editor.commands.updatePagination?.(next.enabled)
      }
    } else {
      _editor.commands.updatePagination?.()
    }
  }

  const persistPaginationHeaderFooter = (patch: Partial<PaginationPlusOptions>) => {
    const nextOptions = { ..._paginationOptions, ...patch }
    _paginationOptions = nextOptions
    _$_wysiwygEditorsList.setPaginationOptions(__wysiwygEditorId, nextOptions)
    _$_documentEditorsList.updateDocumentConfig(__wysiwygEditorId, (doc) => {
      doc.config.pagination = {
        ...(doc.config.pagination || {}),
        headerLeft: nextOptions.headerLeft,
        headerRight: nextOptions.headerRight,
        footerLeft: nextOptions.footerLeft,
        footerRight: nextOptions.footerRight
      }
    })
  }

  const updateHeaderDebounced = debounce((html: string) => {
    if (!_editor) return
    const headerRight = _paginationOptions.headerRight || ''
    _editor.chain().focus().updateHeaderContent(html, headerRight).run()
    persistPaginationHeaderFooter({ headerLeft: html })
  }, 300)

  const updateFooterDebounced = debounce((html: string) => {
    if (!_editor) return
    const footerRight = _paginationOptions.footerRight || ''
    _editor.chain().focus().updateFooterContent(html, footerRight).run()
    persistPaginationHeaderFooter({ footerLeft: html })
  }, 300)

  const ensureHeaderFooterEditors = () => {
    if (!_headerEditor) {
      _headerEditor = new Editor({
        extensions: [StarterKit, Image, TextStyle, FontFamily, FontSize, TextAlign],
        content: _paginationOptions.headerLeft || '<p>Header</p>',
        onUpdate: ({ editor }) => {
          _headerHtml = editor.getHTML()
          updateHeaderDebounced(_headerHtml)
        }
      })
    }
    if (!_footerEditor) {
      _footerEditor = new Editor({
        extensions: [StarterKit, Image, TextStyle, FontFamily, FontSize, TextAlign],
        content: _paginationOptions.footerLeft || '<p>Footer</p>',
        onUpdate: ({ editor }) => {
          _footerHtml = editor.getHTML()
          updateFooterDebounced(_footerHtml)
        }
      })
    }
  }

  const getOverlayPosition = (targetEl: HTMLElement) => {
    if (!_editorContainerRoot) return { top: 0, left: 0, width: 0, height: 0 }
    const rect = targetEl.getBoundingClientRect()
    const rootRect = _editorContainerRoot.getBoundingClientRect()
    return {
      top: rect.top - rootRect.top + _editorContainerRoot.scrollTop,
      left: rect.left - rootRect.left + _editorContainerRoot.scrollLeft,
      width: rect.width,
      height: rect.height
    }
  }

  const openHeaderOverlay = (targetEl: HTMLElement) => {
    ensureHeaderFooterEditors()
    _headerOverlay = getOverlayPosition(targetEl)
    _isEditingHeader = true
    _isEditingFooter = false
  }

  const openFooterOverlay = (targetEl: HTMLElement) => {
    ensureHeaderFooterEditors()
    _footerOverlay = getOverlayPosition(targetEl)
    _isEditingFooter = true
    _isEditingHeader = false
  }

  const closeHeaderFooterOverlay = () => {
    _isEditingHeader = false
    _isEditingFooter = false
  }

  $effect(() => {
    if (!_editorContainerRoot || _isReadOnly) return
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      const header = target.closest('.rm-page-header')
      if (header) {
        openHeaderOverlay(header as HTMLElement)
        return
      }
      const footer = target.closest('.rm-page-footer')
      if (footer) {
        openFooterOverlay(footer as HTMLElement)
      }
    }
    _editorContainerRoot.addEventListener('dblclick', handler)
    return () => _editorContainerRoot.removeEventListener('dblclick', handler)
  })

  $effect(() => {
    if (typeof window === 'undefined') return
    if (!_editorContainerRoot || _isReadOnly) return
    const openHeader = () => {
      const header = _editorContainerRoot?.querySelector('.rm-page-header') as HTMLElement | null
      if (header) openHeaderOverlay(header)
    }
    const openFooter = () => {
      const footer = _editorContainerRoot?.querySelector('.rm-page-footer') as HTMLElement | null
      if (footer) openFooterOverlay(footer)
    }
    const openHeaderFooter = () => {
      openHeader()
      if (!_isEditingHeader) openFooter()
    }
    const handleHeader = () => openHeader()
    const handleFooter = () => openFooter()
    const handleHeaderFooter = () => openHeaderFooter()
    window.addEventListener('ddoc-open-header', handleHeader as EventListener)
    window.addEventListener('ddoc-open-footer', handleFooter as EventListener)
    window.addEventListener('ddoc-open-header-footer', handleHeaderFooter as EventListener)
    return () => {
      window.removeEventListener('ddoc-open-header', handleHeader as EventListener)
      window.removeEventListener('ddoc-open-footer', handleFooter as EventListener)
      window.removeEventListener('ddoc-open-header-footer', handleHeaderFooter as EventListener)
    }
  })

  $effect(() => {
    if (_headerEditor && !_isEditingHeader) {
      const next = _paginationOptions.headerLeft || '<p>Header</p>'
      if (_headerEditor.getHTML() !== next) {
        _headerEditor.commands.setContent(next, false)
      }
    }
  })

  $effect(() => {
    if (_footerEditor && !_isEditingFooter) {
      const next = _paginationOptions.footerLeft || '<p>Footer</p>'
      if (_footerEditor.getHTML() !== next) {
        _footerEditor.commands.setContent(next, false)
      }
    }
  })

  $effect(() => {
    if (!_headerEditor || !_headerEditorEl) return
    if (_headerEditor.options.element !== _headerEditorEl) {
      _headerEditor.setOptions({ element: _headerEditorEl })
    }
    if (_headerEditor.view?.dom && _headerEditor.view.dom.parentElement !== _headerEditorEl) {
      _headerEditorEl.appendChild(_headerEditor.view.dom)
    }
    if (_isEditingHeader) {
      _headerEditor.commands.focus('end')
    }
  })

  $effect(() => {
    if (!_footerEditor || !_footerEditorEl) return
    if (_footerEditor.options.element !== _footerEditorEl) {
      _footerEditor.setOptions({ element: _footerEditorEl })
    }
    if (_footerEditor.view?.dom && _footerEditor.view.dom.parentElement !== _footerEditorEl) {
      _footerEditorEl.appendChild(_footerEditor.view.dom)
    }
    if (_isEditingFooter) {
      _footerEditor.commands.focus('end')
    }
  })

  /* {
    maxPageHeight:
      _paginationOptions.pageHeight -
      (_paginationOptions.marginBottom +
        _paginationOptions.marginTop +
        _paginationOptions.contentMarginTop +
        _paginationOptions.contentMarginBottom +
        _paginationOptions.pageHeight * (12 / 100)), // Max Height of a file render viewport in pixels
    // 120), // Max Height of a file render viewport in pixels
    maxPageWidth:
      _paginationOptions.pageWidth -
      (_paginationOptions.marginLeft + _paginationOptions.marginRight), // Max Width of  of a file render viewport in pixels
    wysiwygEditorIdToUpdate: __wysiwygEditorId
  } */

  async function LanguageToolApi(text) {
    const { default: axios } = await import('axios')
    const url = 'http://localhost:8081/v2/check'
    const data = new URLSearchParams()
    data.append('text', text)
    data.append('language', 'en-US') // Specify the language

    try {
      const response = await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      // The response.data contains the LanguageTool API response
      console.log('Errors found:', response.data.matches)
      return response.data.matches
    } catch (error) {
      console.error('Error checking text:', error.response ? error.response.data : error.message)
    }
  }

  // Example usage
  // const myText = 'A test with an error.';
  // checkTextWithAxios(myText);

  // 3️⃣ LanguageTool Client
  // const lt = new LanguageToolApi()
  // const lt = new LanguageToolApi({ endpoint: 'http://localhost:8081/v2/check' })

  // 4️⃣ Grammar check function
  async function highlightGrammar() {
    console.log('highlightGrammar called')
    if (!_editor) return
    console.log('highlightGrammar _editor', _editor)
    const text = _editor.getText()
    console.log('highlightGrammar _editor text', text)
    // console.log('highlightGrammar _editor getHtml',  _editor.getHtml())
    const result = await LanguageToolApi(text)
    // const result = await lt.check({ language: 'en-US', text })
    _editor.commands.unsetGrammar()

    result.matches.forEach((m) => {
      _editor.commands.setGrammar({
        from: m.offset,
        to: m.offset + m.length,
        suggestion: JSON.stringify(m.replacements.map((r) => r.value))
      })
    })
  }

  // 5️⃣ Native Right-click Menu
  /* function handleContextMenu(e: MouseEvent) {
    if (!_editor) return
    const pos = _editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
    if (!pos) return
    const node = _editor.state.doc.nodeAt(pos.pos)
    if (!node) return
    const marks = node.marks
    const grammarMark = marks.find((m) => m.type.name === 'grammarHighlight')
    if (!grammarMark) return

    e.preventDefault()
    const suggestions = JSON.parse(grammarMark.attrs.suggestion || '[]')

    // Send suggestions to preload bridge for native menu
    window.electronContextMenu.show({
      items: suggestions.map((s) => ({ label: s, click: () => applySuggestion(s, pos.pos) })),
      x: e.clientX,
      y: e.clientY,
    })
  } */

  function applySuggestion(suggestion: string, pos: number) {
    if (!_editor) return
    const node = _editor.state.doc.nodeAt(pos)
    const mark = node?.marks.find((m) => m.type.name === 'grammarHighlight')
    if (!mark) return

    const from = pos
    const to = pos + node.nodeSize - 2 // exclude node's start/end
    _editor.commands.insertContentAt({ from, to }, suggestion)
    highlightGrammar() // re-check grammar after replacement
  }

  // 6️⃣ Optionally, run grammar check on content update
  let grammarTimeout
  function onUpdateGrammarCheck() {
    clearTimeout(grammarTimeout)
    grammarTimeout = setTimeout(() => highlightGrammar(), 500)
  }

  // $: console.log('_activeDocumentVars ', $_$_activeDocumentVars) // raw values
  // $: console.log($computedVars) // evaluated ones

  // let isItalic = false

  /* const _editor22 = new Editor({
      element: document.getElementById('editor2'),
      // element: _editorElement,
      extensions: [
        // StarterKit,
        StarterKit.configure({
          history: false,
          codeBlock: false // disable default code block
        }),
        
      ],
      content: '<p>sss</p>',
      // content: _editorContent,
      
    
    }) */

  /* const saveContentDebounced = debounce((editor) => {
    console.log('debounce fileContentToSave ok')
    const fileContentToSave = editor.getHTML()
    // const fileContentToSave = _editor.getHTML()
    EditorHelpers.saveToFile(__filePathToOpenFromDocument, fileContentToSave) // Save the content to the file
  }, 1000) */
  // 1. Get a derived store for this specific editor
  const _currentEditorStore = _$_documentEditorsList.get(__wysiwygEditorId)
  const _currentEditor = $derived($_currentEditorStore)

  // 2. Track if we have already connected to a room to avoid duplicate workers
  let _activeTranscriptionRoom = $state<string | null>(null)
  let _whisperWorker: Worker | null = null

  $effect(() => {
    console.log('associatedMeetingLinks', _currentEditor?.document?.associatedMeetingLinks)

    // We only care about the links
    const links = _currentEditor?.document?.associatedMeetingLinks || []

    // Use a simple string check to avoid unnecessary re-runs
    const latestRoom = links.length > 0 ? links[links.length - 1] : null
    console.log('associatedMeetingLinks', { latestRoom, links, _activeTranscriptionRoom })
    if (!xmlFragment || !_collaborationExtensionYDoc) return
    if (latestRoom && latestRoom !== _activeTranscriptionRoom) {
      // Kill old worker to free up RAM/CPU
      if (_whisperWorker) {
        console.log('♻️ associatedMeetingLinks Terminating previous worker for performance')
        _whisperWorker.terminate()
      }

      _activeTranscriptionRoom = latestRoom
      console.log('♻️ associatedMeetingLinks starting')

      _whisperWorker = startMeetingTranscriptionWorker(latestRoom)
    }

    return () => {
      // if (_whisperWorker) {
      //   _whisperWorker.terminate()
      //   _whisperWorker = null
      // }
    }
  })

  let editor22

  // const _translationWorker = new SharedWorker(
  //   new URL('../translate/workers/translation-worker.ts', import.meta.url),
  //   { type: 'module' } // Critical for Vite/TypeScript workers
  // )

  // _translationWorker.port.start()

  /* function startMeetingTranscriptionWorker1() {
    const associatedMeetingLinks =
      _$_documentEditorsList.getItem(__wysiwygEditorId).document.associatedMeetingLinks
    const room = associatedMeetingLinks[associatedMeetingLinks.length]
    if (!room) return

    console.log('oncreate wysi ', { _editorContent })

    // 1. Initialize your Worker
    const whisperWorker = new Worker(
      new URL(
        '../../../../extensions/tiptap/CustomMeetingNoteTakingExtension/workers/transcription.worker.ts',
        import.meta.url
      )
    )

    // 2. Start the connection
    // This triggers the 'CONNECT' block inside your worker
    whisperWorker.postMessage({
      type: 'CONNECT',
      url: TRANSCRIBE_WS_URL,
      // room: '82242NewSquid'
      room
    })
    // 3. Define the handler (using your specific attribute names)
    const handleWhisperUpdate2 = (text: string, isFinal: boolean) => {
      _collaborationExtensionYDoc.transact(() => {
        console.log('Worker WS whisperWorker _collaborationExtensionYDoc:', { text })

        const lastNode = xmlFragment.get(xmlFragment.length - 1)

        // Check if we can append to the existing draft
        if (
          lastNode instanceof Y.XmlElement &&
          lastNode.name === CustomMeetingNoteTakingExtensionProps.name &&
          lastNode.getAttribute(CustomMeetingNoteTakingExtensionProps.tagAttributeStatus) ===
            'draft'
        ) {
          const yText = lastNode.get(0) as Y.XmlText
          yText.insert(yText.length, text)

          if (isFinal) {
            lastNode.setAttribute(
              CustomMeetingNoteTakingExtensionProps.tagAttributeStatus,
              'finalized'
            )
          }
        } else {
          // Create new node if last one is finalized or doesn't exist
          const newText = new Y.XmlText(text)
          const newElement = new Y.XmlElement(CustomMeetingNoteTakingExtensionProps.name)

          newElement.setAttribute(
            CustomMeetingNoteTakingExtensionProps.tagAttributeStatus,
            isFinal ? 'finalized' : 'draft'
          )
          newElement.setAttribute(CustomMeetingNoteTakingExtensionProps.tagAttributeSpeaker, 'AI')
          // Add unique ID if needed
          newElement.setAttribute(GenericCustomExtensionProps.tagAttributeId, cryptoRandomUUID())

          newElement.insert(0, [newText])
          xmlFragment.insert(xmlFragment.length, [newElement])
          console.log('Worker WS whisperWorker xmlFragment:', { newElement, newText })
        }
      }, 'whisper-service')
    }

    const handleWhisperUpdate22 = (text: string, isFinal: boolean) => {
      _collaborationExtensionYDoc.transact(() => {
        // 1. Get the last child of the fragment
        const lastNode = xmlFragment.get(xmlFragment.length - 1)

        // 2. Target the specific node name from your props
        const nodeName = CustomMeetingNoteTakingExtensionProps.name
        const statusAttr = CustomMeetingNoteTakingExtensionProps.tagAttributeStatus

        if (
          lastNode instanceof Y.XmlElement &&
          lastNode.name === nodeName &&
          lastNode.getAttribute(statusAttr) === 'draft'
        ) {
          // APPEND LOGIC
          // We look for the first child which should be the Y.XmlText
          let yText = lastNode.get(0)

          if (yText instanceof Y.XmlText) {
            yText.insert(yText.length, text)
          }

          if (isFinal) {
            lastNode.setAttribute(statusAttr, 'finalized')
          }
        } else {
          // NEW NODE LOGIC
          const newElement = new Y.XmlElement(nodeName)
          const newText = new Y.XmlText(text) // This is the 'inline*' content

          newElement.setAttribute(statusAttr, isFinal ? 'finalized' : 'draft')
          newElement.setAttribute(CustomMeetingNoteTakingExtensionProps.tagAttributeSpeaker, 'AI')
          newElement.setAttribute(GenericCustomExtensionProps.tagAttributeId, cryptoRandomUUID())

          // CRITICAL: Insert the text object INTO the element
          newElement.insert(0, [newText])

          // Insert the element into the main fragment
          xmlFragment.insert(xmlFragment.length, [newElement])
        }
      }, 'whisper-service')
    }

    let whisperBuffer = ''
    let animationFrame: number

    const handleWhisperUpdate = (text: string, isFinal: boolean) => {
      whisperBuffer += text

      // Use requestAnimationFrame to sync with the monitor's refresh rate
      if (!animationFrame) {
        animationFrame = requestAnimationFrame(() => {
          _collaborationExtensionYDoc.transact(() => {
            const lastNode = xmlFragment.get(xmlFragment.length - 1)
            const nodeName = CustomMeetingNoteTakingExtensionProps.name
            const now = new Date()
            const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

            if (
              lastNode instanceof Y.XmlElement &&
              lastNode.name === nodeName &&
              lastNode.getAttribute(CustomMeetingNoteTakingExtensionProps.tagAttributeStatus) ===
                'draft'
            ) {
              const yText = lastNode.get(0) as Y.XmlText
              // Apply the buffer all at once
              yText.insert(yText.length, whisperBuffer)

              if (isFinal) {
                lastNode.setAttribute(
                  CustomMeetingNoteTakingExtensionProps.tagAttributeStatus,
                  'finalized'
                )
                // lastNode.setAttribute(
                //   CustomMeetingNoteTakingExtensionProps.tagAttributeTimestamp,
                //   timestamp
                // )
                // We can optionally unset the animate attribute here or let the animation finish
              }
            } else {
              // New Block creation
              const newElement = new Y.XmlElement(nodeName)
              const newText = new Y.XmlText(whisperBuffer)

              newElement.setAttribute(
                CustomMeetingNoteTakingExtensionProps.tagAttributeStatus,
                isFinal ? 'finalized' : 'draft'
              )
              newElement.setAttribute(
                CustomMeetingNoteTakingExtensionProps.tagAttributeSpeaker,
                'AI'
              )
              newElement.setAttribute(
                GenericCustomExtensionProps.tagAttributeId,
                cryptoRandomUUID()
              )
              newElement.setAttribute(
                CustomMeetingNoteTakingExtensionProps.tagAttributeTimestamp,
                timestamp
              )
              newElement.setAttribute(
                CustomMeetingNoteTakingExtensionProps.tagAttributeAnimate,
                'true'
              ) // Triggers CSS wipe
              const speed = (Math.random() * (1.2 - 0.6) + 0.6).toFixed(2)
              newElement.setAttribute('style', `animation-duration: ${speed}s`)

              newElement.insert(0, [newText])
              xmlFragment.insert(xmlFragment.length, [newElement])
            }

            whisperBuffer = '' // Reset buffer
            animationFrame = 0 // Reset frame lock
          }, 'whisper-service')
        })
      }
    }

    // 3. Listen to the Worker
    whisperWorker.onmessage = (event) => {
      console.log('Worker WS whisperWorker onmessage2:', { event })

      const { text, isFinal } = event.data
      handleWhisperUpdate(text, isFinal)
    }
  } */

  function startMeetingTranscriptionWorker(room: string) {
    console.log('♻️ associatedMeetingLinks startMeetingTranscriptionWorker', { room })

    const whisperWorker = new Worker(
      new URL(
        '../../../../extensions/tiptap/CustomMeetingNoteTakingExtension/workers/transcription.worker.ts',
        import.meta.url
      ),
      { type: 'module' }
    )

    whisperWorker.postMessage({
      type: 'CONNECT',
      url: TRANSCRIBE_WS_URL,
      room
      // room: '82242NewSquid'
    })
    console.log('♻️ associatedMeetingLinks whisperWorker', { whisperWorker })

    let whisperBuffer = ''
    let animationFrame: number

    const handleWhisperUpdate = (text: string, isFinal: boolean) => {
      console.log('♻️ associatedMeetingLinks handleWhisperUpdate', { text })

      whisperBuffer += text

      if (!animationFrame) {
        animationFrame = requestAnimationFrame(() => {
          _collaborationExtensionYDoc.transact(() => {
            const lastNode = xmlFragment.get(xmlFragment.length - 1)
            const nodeName = CustomMeetingNoteTakingExtensionProps.name
            const statusAttr = CustomMeetingNoteTakingExtensionProps.tagAttributeStatus

            const now = new Date()
            const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

            // Logic: Append to last node if it's a 'draft' meeting node
            if (
              lastNode instanceof Y.XmlElement &&
              lastNode.name === nodeName &&
              lastNode.getAttribute(statusAttr) === 'draft'
            ) {
              const yText = lastNode.get(0) as Y.XmlText
              yText.insert(yText.length, whisperBuffer)

              if (isFinal) {
                lastNode.setAttribute(statusAttr, 'finalized')
                // We keep the original timestamp of when the block started
              }
            } else {
              // New Node Logic
              const newElement = new Y.XmlElement(nodeName)
              const newText = new Y.XmlText(whisperBuffer)

              newElement.setAttribute(statusAttr, isFinal ? 'finalized' : 'draft')
              newElement.setAttribute(
                CustomMeetingNoteTakingExtensionProps.tagAttributeSpeaker,
                'AI'
              )
              newElement.setAttribute(
                GenericCustomExtensionProps.tagAttributeId,
                cryptoRandomUUID()
              )
              newElement.setAttribute(
                CustomMeetingNoteTakingExtensionProps.tagAttributeTimestamp,
                timestamp
              )

              // Animation Trigger
              newElement.setAttribute(
                CustomMeetingNoteTakingExtensionProps.tagAttributeAnimate,
                'true'
              )
              const speed = (Math.random() * 0.6 + 0.6).toFixed(2)
              newElement.setAttribute('style', `animation-duration: ${speed}s`)

              newElement.insert(0, [newText])
              xmlFragment.insert(xmlFragment.length, [newElement])
            }

            whisperBuffer = ''
            animationFrame = 0
          }, 'whisper-service')
        })
      }
    }

    whisperWorker.onmessage = (event) => {
      console.log('associatedMeetingLinks Worker WS whisperWorker onmessage2:', { event })

      const { text, isFinal } = event.data
      if (text) handleWhisperUpdate(text, isFinal)
    }

    return whisperWorker
  }
  /* function seedWorkerWithOriginals() {
    const originals: { id: string; html: string; json: any }[] = []

    _editor.state.doc.forEach((node) => {
      const uuid = node.attrs?.uid || node.attrs?.uuid
      if (uuid) {
        originals.push({
          id: uuid,
          html:
            _editor.view.dom.querySelector(`[data-uid="${uuid}"], [data-uuid="${uuid}"]`)
              ?.innerHTML ||
            node.textContent ||
            '',
          json: node.toJSON()
        })
      }
    })
    // console.log("WorkerSync SYNC_ORIGINAL seedWorkerWithOriginals", {originals})

    if (originals.length > 0) {
      console.log('WorkerSync SYNC_ORIGINAL seedWorkerWithOriginals', {
        type: 'SYNC_ORIGINAL',
        payload: originals,
        _worker: _translationWorker
      })

      _translationWorker.port.postMessage({
        type: 'SYNC_ORIGINAL',
        payload: originals
      })
    }
  } */

  // Trigger this once when the editor is ready
  /* _editor.on('create', seedWorkerWithOriginals);
// Also trigger when provider syncs to ensure we have the latest from other peers
_collaborationExtensionProvider.on('sync', (isSynced) => {
  if (isSynced) seedWorkerWithOriginals();
});
 */
  // onMount(() => {
  // 1. Move the listener reference to the top scope so onDestroy can see it
  let ghostListener: (event: any) => void

  async function waitForProviderSync(provider: any, timeoutMs = 2500): Promise<boolean> {
    if (!provider) return false
    if (provider.isSynced) return true
    return new Promise((resolve) => {
      let done = false
      const timer = setTimeout(() => {
        if (done) return
        done = true
        provider.off?.('synced', onSynced)
        resolve(false)
      }, timeoutMs)
      const onSynced = () => {
        if (done) return
        done = true
        clearTimeout(timer)
        provider.off?.('synced', onSynced)
        resolve(true)
      }
      provider.on?.('synced', onSynced)
    })
  }

  onMount(async () => {
    const rawHtml = prepareStyleHtmlForEditor(prepareHtmlForEditor(__filePathToOpenFromDocument))
    try {
      _editorContent = await __documentToOpen.getFileContent(rawHtml)
    } catch (err: any) {
      console.error('WysiwygEditor: unable to read document content', err)
      _loadError = String(err?.message || err || 'Unable to read this document.')
      return
    }
    // _editorContent = await __documentToOpen.getFileContent(__filePathToOpenFromDocument)
    _openTiming = openTiming.attach(__documentToOpen?.uuid || __documentToOpen?.path)
    _openTiming?.mark('content-read')

    ghostListener = (event: any) => {
      const text = event?.detail?.text ?? ''
      setGhostText(text)
    }
    window.addEventListener('dynadoc:ghostwrite', ghostListener)

    const startDraftMode = shouldStartDraftMode(_editorContent)
    const includeHeavyInitially = needsHeavyExtensions(_editorContent)
    if (startDraftMode) {
      _paginationOptions.enabled = false
      _paginationImpactedExtensionOptions = getPaginationImpactedExtensionOptions(
        _paginationOptions,
        __wysiwygEditorId
      )
    }

    // 1. Initialize ProviderManager
    const shareContext = resolveShareContext(__documentToOpen)
    const collabDocId = await buildCollabDocId(__documentToOpen, __filePathToOpenFromDocument)

    // Presence identity:
    // - Public share or guest-mode: always anonymous (privacy)
    // - Authenticated + non-share: show real display name
    const shouldForceAnonymous = Boolean(shareContext) || isGuestMode()
    _presenceForceAnonymous = shouldForceAnonymous
    const authState = get(authStore)
    const presence = resolveLocalCollabPresence({
      docId: collabDocId,
      authUser: authState?.authenticated ? authState.user : null,
      forceAnonymous: shouldForceAnonymous
    })
    _collaborationExtensionCurrentUser.id = presence.id
    _collaborationExtensionCurrentUser.name = presence.name
    _collaborationExtensionCurrentUser.color = presence.color

    // Keep presence in sync if the user signs in/out while the doc is open.
    _authUnsub?.()
    _authUnsub = authStore.subscribe(async (next) => {
      if (shouldForceAnonymous) return
      const updatedCollabDocId = await buildCollabDocId(
        __documentToOpen,
        __filePathToOpenFromDocument
      )
      const updated = resolveLocalCollabPresence({
        docId: updatedCollabDocId,
        authUser: next?.authenticated ? next.user : null,
        forceAnonymous: false
      })
      const changed =
        updated.name !== _collaborationExtensionCurrentUser.name ||
        updated.color !== _collaborationExtensionCurrentUser.color
      if (!changed) return
      _collaborationExtensionCurrentUser.name = updated.name
      _collaborationExtensionCurrentUser.color = updated.color
      try {
        _providerManager?.provider?.awareness?.setLocalStateField('user', {
          name: updated.name,
          color: updated.color
        })
      } catch {
        // ignore
      }
    })

    _providerManager = new ProviderManager({
      docId: collabDocId,
      username: _collaborationExtensionCurrentUser.name,
      color: _collaborationExtensionCurrentUser.color,
      role: _isReadOnly ? 'viewer' : 'editor',
      share: shareContext || undefined
    })
    // A recipient opening a share link cannot write to the room, and has no
    // local copy to fall back on. Making them wait for a live sync — which
    // took 30 to 40 s in practice, and never completed on a connection that
    // kept dropping — left them on a blank page. The share is a snapshot:
    // open it from the archive, with no room to wait for.
    const viewerOnlyShare = Boolean(shareContext) && _isReadOnly
    if (viewerOnlyShare) {
      console.info('[collab] read-only share view: opening from the archive without a live room')
    } else {
      await _providerManager.connect()
    }
    _collaborationExtensionYDoc = _providerManager.ydoc
    _collaborationExtensionProvider = _providerManager.provider
    setCollabStatus(_providerManager.status)
    xmlFragment = _collaborationExtensionYDoc.getXmlFragment(
      _collaborationExtensionYDocXmlFragmentName
    )

    const canUseCollabVars =
      !!_collaborationExtensionProvider && _providerManager?.status !== 'offline'
    if (canUseCollabVars) {
      _variableStore = createVariableStore(_collaborationExtensionYDoc, (vars) => {
        _documentVariables = vars
        ;(window as any)._var = vars
      })
      ;(window as any)._varStore = _variableStore
      ;(window as any)._varStoreDocId = collabDocId
    } else {
      _variableStore = null
      delete (window as any)._varStore
      delete (window as any)._varStoreDocId
    }

    // 2. Wait for local persistence + remote sync before seeding
    try {
      await _providerManager.persistence?.whenSynced
    } catch {
      // ignore persistence sync errors
    }
    _openTiming?.mark('persistence-synced')
    // A room that holds nothing but empty paragraphs is empty for our
    // purpose: that is what an editor leaves behind in local persistence
    // when it opened on nothing, and it must not block the seed next time.
    // updateYFragment diffs the room against the parsed document, so
    // seeding over such a paragraph replaces it instead of adding to it.
    const roomIsEffectivelyEmpty = (): boolean =>
      xmlFragment.length === 0 ||
      xmlFragment.toArray().every((node: any) => {
        if (node?.nodeName !== 'paragraph') return false
        const text = String(node.toString?.() ?? '')
          .replace(/<[^>]+>/g, '')
          .trim()
        return text === ''
      })
    // Only wait for the live room when there is nothing to show yet. A local
    // copy renders at once and the room reconciles behind it — the same
    // Yjs history on both sides merges to itself. Waiting here regardless
    // cost every owner eight seconds per open, because the first
    // connection rarely syncs in time.
    if (roomIsEffectivelyEmpty()) {
      _openTiming?.roomWaitStart()
      const synced = await waitForProviderSync(_collaborationExtensionProvider, 8000)
      _openTiming?.roomWaitEnd(synced)
    }

    // 3. Seed the room from the local content when it is still empty.
    //
    // A provider that is connected but has not finished its first sync
    // cannot say whether the room is empty, so seeding then could duplicate
    // what the server is about to send. A bounded wait covers the common
    // case. But giving up after it left a recipient — who has no local copy
    // to fall back on — with a blank document forever: the room on the
    // server held nothing, the archive held the text, and nobody ever
    // wrote the one into the other. So when the wait runs out, keep
    // listening, and seed on the first sync (or on disconnect) if the room
    // is still empty by then.
    const seedFromLocalContent = (reason: string): boolean => {
      if (!roomIsEffectivelyEmpty() || !_editorContent) {
        // A declined seed used to be indistinguishable from one that never
        // ran. Say why.
        console.warn('[collab] seed declined', {
          reason,
          fragmentChildren: xmlFragment.length,
          contentLength: _editorContent?.length || 0
        })
        return false
      }
      console.log('oncreate wysi xmlFragment ', { reason, xmlFragment, _editorContent })
      try {
        const schema = EditorExtensionHelpers.getHeadlessSchema(__wysiwygEditorId)

        // Parse HTML string to ProseMirror Doc (Headless)
        const domParser = new window.DOMParser()
        const parsedHtml = domParser.parseFromString(
          EditorHelpers.sanitizeHtml(_editorContent),
          'text/html'
        )
        // const parsedHtml = domParser.parseFromString(_editorContent, 'text/html');
        const pmDoc = DOMParser.fromSchema(schema).parse(parsedHtml.body)

        // Write to Yjs in a single transaction
        _collaborationExtensionYDoc.transact(() => {
          // console.log('✅ _collaborationExtensionYDoc transact',{pmDoc,xmlFragment})

          prosemirrorToYXmlFragment(pmDoc, xmlFragment)
          console.log('✅ _collaborationExtensionYDoc transact', { pmDoc, xmlFragment })
        }, 'local-initial-seed')

        console.log('✅ Seeded Yjs Doc from local content successfully', {
          reason,
          pmDoc,
          xmlFragment
        })
        return true
      } catch (e) {
        console.error('❌ Failed to seed Yjs Doc:', e)
        return false
      }
    }
    const providerSynced = !!_collaborationExtensionProvider?.isSynced
    const roomStateKnown =
      !_collaborationExtensionProvider || _providerManager.status !== 'connected' || providerSynced
    if (roomStateKnown) {
      seedFromLocalContent(providerSynced ? 'synced' : 'no-provider-or-offline')
    } else {
      console.warn(
        '[collab] connected but not synced after the wait; will seed on first sync if the room is still empty'
      )
      const provider = _collaborationExtensionProvider
      const onRoomStateKnown = (event: string) => () => {
        provider?.off?.('synced', onSynced)
        provider?.off?.('disconnect', onDisconnect)
        seedFromLocalContent(`late-${event}`)
      }
      const onSynced = onRoomStateKnown('sync')
      const onDisconnect = onRoomStateKnown('disconnect')
      provider?.on?.('synced', onSynced)
      provider?.on?.('disconnect', onDisconnect)
    }

    // 4. Provider is already connected by ProviderManager

    console.log('oncreate wysi ', { _editorContent })

    // const _whisperWorker = startMeetingTranscriptionWorker('82242NewSquid')
    // startMeetingTranscriptionWorker()

    /* // 1. Initialize your Worker
    const whisperWorker = new Worker(
      new URL(
        '../../../../extensions/tiptap/CustomMeetingNoteTakingExtension/workers/transcription.worker.ts',
        import.meta.url
      )
    )

    // 2. Start the connection
    // This triggers the 'CONNECT' block inside your worker
    whisperWorker.postMessage({
      type: 'CONNECT',
      url: TRANSCRIBE_WS_URL,
      room: '82242NewSquid'
    })
    // 3. Define the handler (using your specific attribute names)
    const handleWhisperUpdate2 = (text: string, isFinal: boolean) => {
      _collaborationExtensionYDoc.transact(() => {
        console.log('Worker WS whisperWorker _collaborationExtensionYDoc:', { text })

        const lastNode = xmlFragment.get(xmlFragment.length - 1)

        // Check if we can append to the existing draft
        if (
          lastNode instanceof Y.XmlElement &&
          lastNode.name === CustomMeetingNoteTakingExtensionProps.name &&
          lastNode.getAttribute(CustomMeetingNoteTakingExtensionProps.tagAttributeStatus) ===
            'draft'
        ) {
          const yText = lastNode.get(0) as Y.XmlText
          yText.insert(yText.length, text)

          if (isFinal) {
            lastNode.setAttribute(
              CustomMeetingNoteTakingExtensionProps.tagAttributeStatus,
              'finalized'
            )
          }
        } else {
          // Create new node if last one is finalized or doesn't exist
          const newText = new Y.XmlText(text)
          const newElement = new Y.XmlElement(CustomMeetingNoteTakingExtensionProps.name)

          newElement.setAttribute(
            CustomMeetingNoteTakingExtensionProps.tagAttributeStatus,
            isFinal ? 'finalized' : 'draft'
          )
          newElement.setAttribute(CustomMeetingNoteTakingExtensionProps.tagAttributeSpeaker, 'AI')
          // Add unique ID if needed
          newElement.setAttribute(GenericCustomExtensionProps.tagAttributeId, cryptoRandomUUID())

          newElement.insert(0, [newText])
          xmlFragment.insert(xmlFragment.length, [newElement])
          console.log('Worker WS whisperWorker xmlFragment:', { newElement, newText })
        }
      }, 'whisper-service')
    }

    const handleWhisperUpdate22 = (text: string, isFinal: boolean) => {
      _collaborationExtensionYDoc.transact(() => {
        // 1. Get the last child of the fragment
        const lastNode = xmlFragment.get(xmlFragment.length - 1)

        // 2. Target the specific node name from your props
        const nodeName = CustomMeetingNoteTakingExtensionProps.name
        const statusAttr = CustomMeetingNoteTakingExtensionProps.tagAttributeStatus

        if (
          lastNode instanceof Y.XmlElement &&
          lastNode.name === nodeName &&
          lastNode.getAttribute(statusAttr) === 'draft'
        ) {
          // APPEND LOGIC
          // We look for the first child which should be the Y.XmlText
          let yText = lastNode.get(0)

          if (yText instanceof Y.XmlText) {
            yText.insert(yText.length, text)
          }

          if (isFinal) {
            lastNode.setAttribute(statusAttr, 'finalized')
          }
        } else {
          // NEW NODE LOGIC
          const newElement = new Y.XmlElement(nodeName)
          const newText = new Y.XmlText(text) // This is the 'inline*' content

          newElement.setAttribute(statusAttr, isFinal ? 'finalized' : 'draft')
          newElement.setAttribute(CustomMeetingNoteTakingExtensionProps.tagAttributeSpeaker, 'AI')
          newElement.setAttribute(GenericCustomExtensionProps.tagAttributeId, cryptoRandomUUID())

          // CRITICAL: Insert the text object INTO the element
          newElement.insert(0, [newText])

          // Insert the element into the main fragment
          xmlFragment.insert(xmlFragment.length, [newElement])
        }
      }, 'whisper-service')
    }

    let whisperBuffer = ''
    let animationFrame: number

    const handleWhisperUpdate = (text: string, isFinal: boolean) => {
      whisperBuffer += text

      // Use requestAnimationFrame to sync with the monitor's refresh rate
      if (!animationFrame) {
        animationFrame = requestAnimationFrame(() => {
          _collaborationExtensionYDoc.transact(() => {
            const lastNode = xmlFragment.get(xmlFragment.length - 1)
            const nodeName = CustomMeetingNoteTakingExtensionProps.name
            const now = new Date()
            const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

            if (
              lastNode instanceof Y.XmlElement &&
              lastNode.name === nodeName &&
              lastNode.getAttribute(CustomMeetingNoteTakingExtensionProps.tagAttributeStatus) ===
                'draft'
            ) {
              const yText = lastNode.get(0) as Y.XmlText
              // Apply the buffer all at once
              yText.insert(yText.length, whisperBuffer)

              if (isFinal) {
                lastNode.setAttribute(
                  CustomMeetingNoteTakingExtensionProps.tagAttributeStatus,
                  'finalized'
                )
                // lastNode.setAttribute(
                //   CustomMeetingNoteTakingExtensionProps.tagAttributeTimestamp,
                //   timestamp
                // )
                // We can optionally unset the animate attribute here or let the animation finish
              }
            } else {
              // New Block creation
              const newElement = new Y.XmlElement(nodeName)
              const newText = new Y.XmlText(whisperBuffer)

              newElement.setAttribute(
                CustomMeetingNoteTakingExtensionProps.tagAttributeStatus,
                isFinal ? 'finalized' : 'draft'
              )
              newElement.setAttribute(
                CustomMeetingNoteTakingExtensionProps.tagAttributeSpeaker,
                'AI'
              )
              newElement.setAttribute(
                GenericCustomExtensionProps.tagAttributeId,
                cryptoRandomUUID()
              )
              newElement.setAttribute(
                CustomMeetingNoteTakingExtensionProps.tagAttributeTimestamp,
                timestamp
              )
              newElement.setAttribute(
                CustomMeetingNoteTakingExtensionProps.tagAttributeAnimate,
                'true'
              ) // Triggers CSS wipe
              const speed = (Math.random() * (1.2 - 0.6) + 0.6).toFixed(2)
              newElement.setAttribute('style', `animation-duration: ${speed}s`)

              newElement.insert(0, [newText])
              xmlFragment.insert(xmlFragment.length, [newElement])
            }

            whisperBuffer = '' // Reset buffer
            animationFrame = 0 // Reset frame lock
          }, 'whisper-service')
        })
      }
    }

    // 3. Listen to the Worker
    whisperWorker.onmessage = (event) => {
      console.log('Worker WS whisperWorker onmessage2:', { event })

      const { text, isFinal } = event.data
      handleWhisperUpdate(text, isFinal)
    } */

    /* const yXml = _collaborationExtensionYDoc.getXmlFragment('content');

// Only if first load → inject initial content
if (yXml.length === 0) {
  const parser = new DOMParser()
  const doc = parser.parseFromString('<p>Hello world</p>', 'text/html').body
  yXml.insert(0, [...doc.childNodes].map(n => Y.XmlElement.fromDOM(n)))
} */
    // 2️⃣ Initial HTML
    const initialHTML = `
  <p>Hello World</p>
  <p>This content is synced using <strong>y-prosemirror!</strong></p>
`

    const editor2 = new Editor({
      element: editor22!,
      // element: document.querySelector('#editor22')!,
      extensions: [
        // StarterKit,
        // StarterKit.configure({
        //   history: false,
        //   codeBlock: false // disable default code block
        // }),
        /* Document,
        Paragraph,
        Text,
        BulletList,
        OrderedList,
        ListItem, */

        // StarterKit,
        StarterKit.configure({
          history: false,
          codeBlock: false // disable default code block
          // placeholder: 'Write something …'
        }),

        // CustomScriptTag, // To allow script tags
        /*  CustomStyleTag, // To allow style tags
        // Color.configure({ types: [TextStyle.name, ListItem.name], defaultColor: 'black' }),
        TextStyle.configure({ types: [ListItem.name] }),
        FontFamily,
        FontSize,
        ListKit,

        // Color.configure({ types: [TextStyle.name, ListItem.name] }),
        //         TextStyle.configure({ types: [ListItem.name] }),
        Highlight,
        TextAlign.configure({
          types: ['heading', 'paragraph']
        }),

        PaginationTable.TablePlus.configure({
          resizeHandleStyle: {
            background: 'gray'
          }
        }),
        PaginationTable.TableRowPlus,
        PaginationTable.TableCellPlus,
        PaginationTable.TableHeaderPlus, */
        UniqueID.configure({
          attributeName: 'uid',
          types: ['heading', 'paragraph']
        })

        // Collaboration extensions
        // Collaboration.configure({
        //   document: _collaborationExtensionYDoc // 👈 required
        // }),
        // CollaborationCaret.configure({
        //   provider: _collaborationExtensionProvider,
        //   // user: _collaborationExtensionCurrentUser,
        //   user: {
        //     id: Math.random().toString(36).slice(2),
        //     name: 'Anonymous' + rand,
        //     // name: 'Anonymous' + Math.floor(Math.random() * 100),
        //     color: '#' + Math.floor(Math.random() * 16777215).toString(16)
        //   },
        //   /* user: {
        //     name: 'Alice',
        //     color: '#ff00ff'
        //   } */
        //   // Create a custom renderer to control the the caret and label display in css
        //   render: (user) => {
        //     const wrapper = document.createElement('span')
        //     wrapper.classList.add('collaboration-carets')

        //     const caret = document.createElement('span')
        //     caret.classList.add('collaboration-carets__caret')
        //     caret.style.borderColor = user.color

        //     const label = document.createElement('div')
        //     label.classList.add('collaboration-carets__label')
        //     label.style.backgroundColor = user.color
        //     label.textContent = user.name

        //     wrapper.appendChild(caret)
        //     wrapper.appendChild(label)

        //     return wrapper
        //   }
        // }),
        // CustomReviewExtension
        // CustomVarExtension,
        // CustomAIExtension
      ],
      /* extensions: [
        StarterKit.configure({
          history: false,
          codeBlock: false // disable default code block
        }),
      ], */

      // content: "<p>Hello from <strong>Tiptap</strong> with TypeScript! @myVar <variable name='my Var' value='6'></variable> <variable name='my Var' value='6'></variable> <variable name='myVar1'></variable></p>",
      // content: await __documentToOpen.getFileContent(__filePathToOpenFromDocument)
      // content: _editorContent
      content: initialHTML
      // "<p>Tiptap</p> <p>Hello from <strong>Tiptap</strong> with TypeScript! replace {my Var} is  <var name='my Var'></var> <var name='my Var'></var> <var name='myVar1'></var></p>"
      // "<p>Tiptap</p> <pdf src='./2.pdf'></pdf><p>Hello from <strong>Tiptap</strong> with TypeScript! replace {my Var} is  <var name='my Var'></var> <var name='my Var'></var> <var name='myVar1'></var></p>"
    })

    // 4️⃣ Apply initial HTML to Y.Doc
    // EditorHelpers.applyInitialContentHTMLToYDoc(
    //   _collaborationExtensionYDoc,
    //   initialHTML,
    //   editor2.schema
    // )

    // 1. Create Y.Doc from HTML
    /*  EditorHelpers.createYDocFromHTML(
      _collaborationExtensionYDoc,
      initialHTML,
      editor2.schema
    ) */

    // editor2.storage.reviewMode.ydoc = _collaborationExtensionYDoc
    // editor2.commands.setReviewMode(true, 'Haruna san')

    // Updating a variable automatically saves it
    // _$_activeDocumentVars.update(v => ({ ...v, jour: 40 }))

    // Pagination Options

    // const allNodeTypes = Object.keys(EditorSchema.nodes)

    let knownUuids = new Set<string>()

    const coreExtensions = EditorExtensionHelpers.getMainWysiwygExtensions(
      _editorContainer,
      _editorContainerRoot,
      $_('Type / for commands, @ for variabes, # for dynamic references'),
      _paginationOptions,
      _paginationImpactedExtensionOptions,
      __wysiwygEditorId,
      _collaborationExtensionProvider,
      { includeHeavy: includeHeavyInitially }
    )

    const heavyExtensions = EditorExtensionHelpers.getHeavyWysiwygExtensions(
      _paginationImpactedExtensionOptions,
      __wysiwygEditorId
    )

    const collaborationExtensions = [
      Collaboration.configure({
        document: _collaborationExtensionYDoc, // 👈 required
        field: _collaborationExtensionYDocXmlFragmentName // 👈 CRITICAL: Must match the fragment name above
      }),
      ...(_collaborationExtensionProvider
        ? [
            CollaborationCaret.configure({
              provider: _collaborationExtensionProvider,
              user: _collaborationExtensionCurrentUser,
              /* user: {
                name: 'Alice',
                color: '#ff00ff'
              } */
              render: (user) => {
                const wrapper = document.createElement('span')
                wrapper.classList.add('collaboration-carets')

                const caret = document.createElement('span')
                caret.classList.add('collaboration-carets__caret')
                caret.style.borderColor = user.color

                const label = document.createElement('div')
                label.classList.add('collaboration-carets__label')
                label.style.backgroundColor = user.color
                label.textContent = user.name

                wrapper.appendChild(caret)
                wrapper.appendChild(label)

                return wrapper
              }
            })
          ]
        : [])
    ]

    const extraExtensions = [
      CustomMeetingNoteTakingExtension,
      CustomTranslationExtension.configure({
        collaborationProvider: _collaborationExtensionProvider
      }),
      ...collaborationExtensions,
      CustomPlaceholderExtension.configure({
        onUpdate: (next) => {
          _interactivePlaceholderVisible = !!next?.visible
        }
      }),
      GhostWrite,
      CustomPresentationExtension.configure({ pagination: _paginationOptions }),
      // CustomPresentationExtension.configure(_paginationOptions),
      CustomAnimationExtension,
      CustomFindReplaceExtension
    ]

    _isEditorReady = false
    _editor = new Editor({
      // element: document.getElementById('editor'),
      element: _editorElement,
      editable: !_isReadOnly,
      // autofocus: true,
      extensions: [...coreExtensions, ...extraExtensions],
      // ],
      // content: initialHTML,
      // content: '<p>sss</p>',
      // content: _editorContent,
      // content: await __documentToOpen.getFileContent(__filePathToOpenFromDocument),
      editorProps: {
        ...EditorExtensionHelpers.getMainWysiwygEditorProps()
        // handlePaste(view, event) {
        //   // console.log('Pasting in WYSIWYG editor')
        //   /* const markdown = event.clipboardData?.getData('text/plain') || ''
        //       console.log('Pasting in WYSIWYG editor', markdown)
        //       // const html = markdownToHTML(markdown)
        //       // const json = generateJSON(html, [StarterKit])
        //       const markdownOutput = _editor.storage.markdown.getMarkdown()
        //       // console.log('after Pasting in WYSIWYG editor', markdownOutput)
        //       // _editor.commands.setContent(markdown)
        //       // _editor.commands.setContent(json)
        //       // return true
        //       const text = event.clipboardData?.getData('text/plain') || ''
        //       const markdownExtension = _editor.extensionManager.extensions.find(
        //         (ext) => ext.name === 'markdown'
        //       )
        //       if (markdownExtension?.storage?.markdown?.setMarkdown) {
        //              console.log('setMarkdown', _editorContent)
        //         _editor.commands.clearContent()
        //         markdownExtension.storage.markdown.setMarkdown(text)
        //         return true
        //       } */
        //     //  return false
        //   // Handle pasting markdown content and convert it to HTML
        //   const clipboardText = event.clipboardData?.getData('text/plain') || ''
        //   // console.log('after Pasting in WYSIWYG editor', clipboardText)
        //   const md = new MarkdownIt()
        //   if (clipboardText) {
        //     // const html =  clipboardText
        //     const html = md.render(clipboardText)
        //     console.log('after Pasting in WYSIWYG editor html', html)
        //     _editor.commands.insertContent(html)
        //     return true // prevent default paste
        //   }
        //   return false
        // }
      },
      onCreate: ({ editor }) => {
        // Register the editor instance in the store
        console.log('Register the editor instance in the store ', editor)
        _openTiming?.mark('editor-created')
        queueFontResolveFromEditor(editor)
        editor.storage.collaborationStatus = _collabStatus
        editor.storage.collaborationLastSeen =
          _collabStatus === 'connected' ? null : editor.storage.collaborationLastSeen || Date.now()
        if (!_isReadOnly) {
          _$_wysiwygEditorsList.register(
            __wysiwygEditorId,
            editor,
            // _editor,
            __filePathToOpenFromDocument,
            _editorElement,
            _editorContainer,
            _editorContainerRoot,
            null,
            [],
            _paginationOptions
          )
        }
        console.log(
          'Register the editor instance in the store activeDocumentEditorStore activeDocumentEditor',
          _$_wysiwygEditorsList.getList()
        )

        console.log(
          'yes focus registerNodeview onCreate wysiwig',
          _$_wysiwygEditorsList.getList(),
          _$_wysiwygEditorsList.getEntry(__wysiwygEditorId)
        )
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            _isEditorReady = true
            _openTiming?.watchText(editor.view?.dom)
          })
        })

        // seedWorkerWithOriginals()

        /* setTimeout(() => {
          seedWorkerWithOriginals() 
        }, 500); */
      },
      onUpdate: ({ editor }) => {
        // onUpdateGrammarCheck()
        console.log('onUpdate in WYSIWYG editor')
        queueFontResolveFromEditor(editor)

        // const markdownOutput = editor.storage.markdown.getMarkdown();
        // console.log('after Pasting in WYSIWYG editor', markdownOutput)
        // editor.commands.setContent(markdownOutput)
        // _editorContent = markdownOutput
        // const markdownOutput = editor.storage.markdown.getMarkdown()
        // const markdown = editor.storage.markdown.getMarkdown?.()
        // _editorContent = markdownOutput
        // _editorContent = editor.getHTML()
        // handleWysiwygChange(null, _editorContent)

        // console.log('onUpdate in WYSIWYG editor ', editor.getHTML(), '======= ', _editorContent)

        // const fileContentToSave = EditorHelpers.restoreSvelteExpressionsFromHtmlTags(
        // editor.getHTML()
        // )
        // .replace(/&quot;/g, '"')
        // .replace(/&apos;/g, "'")

        /* console.log(
          'onUpdate in WYSIWYG editor ',
          editor.getHTML(),
          '===== ',
          _editorContent,
          ' fileContentToSave = ',
          fileContentToSave
        ) */

        // Get the editor instance from the store
        // let _codeEditor = _$_codeEditorsList.get(__wysiwygEditorId)
        // EditorHelpers.setCodeEditorValuePreserveState(_codeEditor, fileContentToSave)

        // Save the content to the file. This will trigger code editor update too via the store
        // debounce((editor) => {
        //   const fileContentToSave = editor.getHTML()
        //   EditorHelpers.saveToFile(__filePathToOpenFromDocument, fileContentToSave) // Save the content to the file
        // })
        // EditorHelpers.saveToFile(__filePathToOpenFromDocument, editor.getHTML()) // Save the content to the file
        // console.log('onUpdate in WYSIWYG editor ', editor.getHTML(), _editorContent)

        // updateContent()
        // autoPaginate()
        // requestAnimationFrame(() => autoPaginate())

        // Register the editor instance in the store
        // console.log('Register the editor instance in the store ', editor)
        /*  _$_wysiwygEditorsList.register(
          __wysiwygEditorId,
          _editor,
          __filePathToOpenFromDocument,
          _editorElement,
          _editorContainer,
          _editorContainerRoot
        ) */

        // Save a snapshot
        // editor.commands.saveSnapshot()

        // List snapshots
        // const snapshots = editor.commands.listSnapshots()
        // console.log(snapshots)

        // Restore a snapshot
        // editor.commands.restoreSnapshot(snapshots[0].id)

        // Clear all snapshots
        // editor.commands.clearSnapshots()

        // Add a comment
        // editor.commands.addComment({
        //   author: 'Alice',
        //   color: '#FF90BC'
        // })

        // Remove a comment by ID
        // editor.commands.removeComment('1694456789123')
      },
      /* onTransaction: ({ editor, transaction }) => {
        if (transaction.docChanged) {
          // Save the content to the file. This will trigger code editor update too via the store
          // EditorHelpers.saveToFile(__filePathToOpenFromDocument, fileContentToSave) // Save the content to the file
          // saveContentDebounced(editor)
          const fileContentToSave = editor.getHTML()
          Utils.saveToFileDebounced(
            __filePathToOpenFromDocument,
            fileContentToSave,
            handleWysiwygOnSave
          )
          /* debounce((editor) => {
            console.log('debounce fileContentToSave ok')
            const fileContentToSave = editor.getHTML()
            // const fileContentToSave = _editor.getHTML()
            EditorHelpers.saveToFile(__filePathToOpenFromDocument, fileContentToSave) // Save the content to the file
          }, 1000)(editor) +/
        }
      }, */

      onTransaction: ({ editor, transaction }) => {
        // Force unique ID persistence on remote changes to ensure custom node views stay linked
        if (!isChangeOrigin(transaction) && transaction.docChanged) {
          // Small delay to let the Yjs transaction settle into the Prosemirror state
          requestAnimationFrame(() => {
            if (!editor.isDestroyed) editor.commands.reindexUUIDs?.()
          })
        }

        if (_isReadOnly) return
        if (transaction.docChanged) {
          // const fileContentToSave = editor.getHTML()
          const fileContentToSave = decodeStyleBlocksInHtml(getHtmlWithComments(editor))

          // INNOVATIVE FIX: Don't pass callback on autosave to prevent ribbon closure
          // The callback (handleWysiwygOnSave) should only be used for intentional saves, not background autosaves
          // 1. Standard file save (WITHOUT callback to prevent ribbon closing)
          Utils.saveToFileDebounced(
            __filePathToOpenFromDocument,
            fileContentToSave
            // handleWysiwygOnSave // ❌ REMOVED: Don't pass callback during autosave
          )
          console.log('__filePathToOpenFromDocument__filePathToOpenFromDocument', {
            __filePathToOpenFromDocument
          })
          if (
            !isDesktopPlatform &&
            // !isGuestMode() &&
            !isShareCachePath(__filePathToOpenFromDocument)
          ) {
            console.log('__filePathToOpenFromDocument__filePathToOpenFromDocument', {
              __filePathToOpenFromDocument
            })
            // Very important. Uncomment later after testing
            autosaveToDriveDebounced()
          }
          // return
        }
      },
      // onTransaction: ({ editor }) => {
      // force re-render so `_editor.isActive` works as expected
      // _editor = _editor
      // Update sidebar on every change
      // _collaborationExtensionComments = editor.commands.listComments()
      // },
      onFocus: () => {
        // autoPaginate()
        // _isWysiwygEditorFocused = true
        // console.log('WYSIWYG editor focused')
      }
    })

    paginationUnsubscribe = paginationStore?.subscribe((nextOptions) => {
      if (!nextOptions) return
      applyPaginationOptions(nextOptions)
    })

    if (!includeHeavyInitially) {
      scheduleIdle(() => {
        if (_editor?.isDestroyed) return
        _editor.setOptions({
          extensions: [...coreExtensions, ...heavyExtensions, ...extraExtensions]
        })
      })
    }

    if (startDraftMode && requestedPaginationEnabled) {
      scheduleIdle(() => {
        if (_editor?.isDestroyed) return
        const nextOptions: PaginationPlusOptions = { ..._paginationOptions, enabled: true }
        _$_wysiwygEditorsList.setPaginationOptions(__wysiwygEditorId, nextOptions)
        applyPaginationOptions(nextOptions)
      })
    }

    if (!_isReadOnly) {
      registerEditorHistory({
        editorId: __wysiwygEditorId?.toString(),
        editor: _editor,
        ydocTypes: [xmlFragment]
      })
    }

    const reviewSettings = documentEditor?.document?.config?.reviewSettings
    if (reviewSettings) {
      const reviewerName = reviewSettings.reviewerName || 'Editor'
      _editor.commands.setReviewMode(!!reviewSettings.trackChangesEnabled, reviewerName)
      _editor.storage.review = _editor.storage.review || { enabled: false, author: reviewerName }
      _editor.storage.review.onlyShowMine = !!reviewSettings.onlyShowMine
      _editor.storage.review.hideResolvedComments = !!reviewSettings.hideResolvedComments
      _editor.storage.review.commentsMarginOnly = !!reviewSettings.commentsMarginOnly
      const root = _editorContainerRoot || _editorElement
      if (root) {
        root.classList.remove(
          'review-markup-all',
          'review-markup-simple',
          'review-markup-none',
          'review-markup-original',
          'review-comments-hidden',
          'review-comments-margin-only',
          'grammar-suggestions-hidden'
        )
        root.classList.add(`review-markup-${reviewSettings.markupMode || 'all'}`)
        if (reviewSettings.commentsVisible === false) {
          root.classList.add('review-comments-hidden')
        }
        if (reviewSettings.commentsMarginOnly) {
          root.classList.add('review-comments-margin-only')
        }
        if (reviewSettings.grammarVisible === false) {
          root.classList.add('grammar-suggestions-hidden')
        }
      }
    }

    // _editor.commands.setContent(`
    //       <p>This is a radically reduced version of Tiptap. It has support for a document, with paragraphs and text. That’s it. It’s probably too much for real minimalists though.</p>
    //       <p>The paragraph extension is not really required, but you need at least one node. Sure, that node can be something different.</p>
    //       `)
    // Set editor content here to enable collaboration eextension to use the content
    // _editor.commands.setContent(await __documentToOpen.getFileContent(__filePathToOpenFromDocument))

    // _editor.commands.setContent(EditorHelpers.sanitizeHtml(_editorContent))

    // _editor.commands.setContent(_editorContent)

    // _editor.commands.enableReviewMode()
    // Optional: attach the Yjs doc from the extension
    // _editor.storage.reviewMode.ydoc = _collaborationExtensionYDoc
    // _editor.commands.setReviewMode(true, 'Haruna san')
    // _editor.commands.setReviewMode(false)

    // Update sidebar on every change
    /* _editor.on('transaction', async () => {
      // updateActiveMarks()
      const fileContentToSave2 = EditorHelpers.restoreSvelteExpressionsFromHtmlTags(
        _editor.getHTML()
      )
      // Save the content to the file. This will trigger code editor update too via the store
      // EditorHelpers.saveToFile(__filePathToOpenFromDocument, fileContentToSave) // Save the content to the file
      debounce((editor) => {
        console.log('debounce fileContentToSave ok')
        const fileContentToSave = editor.getHTML()
        // const fileContentToSave = _editor.getHTML()
        EditorHelpers.saveToFile(__filePathToOpenFromDocument, fileContentToSave) // Save the content to the file
      }, 800)(_editor)
      // await highlightGrammar() // Initial grammar check
      // _collaborationExtensionComments = _editor.commands.listComments()
    }) */
    // const updateActiveMarks = () => {
    //   isItalic = _editor.isActive('italic')
    // }

    // Listen for all relevant editor events
    /*  _editor.on('selectionUpdate', async () => {
      updateActiveMarks()
    })
    _editor.on('update', async () => {
      updateActiveMarks()
    })
    // Initial check
    updateActiveMarks() */

    if (!_isReadOnly && _collaborationExtensionProvider) {
      _collaborationExtensionProvider.on('status', (event) => {
        console.log('Yjs status:', event.status, _collaborationExtensionProvider.synced)
        setCollabStatus(event.status === 'connected' ? 'connected' : 'offline')
        if (event.status === 'connected') {
          // Use a small timeout to ensure ProseMirror has rendered the incoming steps
          setTimeout(() => {
            _editor.commands.reindexUUIDs()
            // seedWorkerWithOriginals()
          }, 50)
        }
      })

      _collaborationExtensionProvider.on('sync', (isSynced: boolean) => {
        console.log('✅ Yjs Synced. Triggering full reindex...', { isSynced })

        if (isSynced) {
          console.log('✅ Yjs Synced. Triggering full reindex...')

          // Use a small timeout to ensure ProseMirror has rendered the incoming steps
          setTimeout(() => {
            _editor.commands.reindexUUIDs()
          }, 50)
        }
      })
    }

    // Listen for node clicks
    document.addEventListener('tiptap-citation-click', (ev: any) => {
      console.log('addEventListener tiptap-citation-click', ev.detail)
      // ev.detail contains node and pos
      // open your CitationPicker UI
      // you can store pos to update attributes later
      const { node, pos } = ev.detail
      return

      _editor.commands.insertBibliography(`
       @article{Miccadei2002Synergistic,
                journal={Molecular Endocrinology},
        doi={10.1210/MEND.16.4.0808},
        number=4,
        pmid=11923479,
        title={{The Synergistic Activity of Thyroid Transcription Factor 1 and Pax 8 Relies on the Promoter/Enhancer Interplay}},
        volume=16,
        author={Miccadei, Stefania and De Leo, Rossana and Zammarchi, Enrico and Natali, Pier Giorgio and Civitareale, Donato},
        pages={837--846},
        date={2002-01-01},
        year=2002,
        month=1,
        day=1,
        }`)
      // open modal...
      // when pick a key: editor.commands.updateAttributes('citation', { key: 'pickedKey' }) with selection/pos
    })

    // autoPaginate()
    // const observer = new ResizeObserver(autoPaginate)
    // observer.observe(_editorContainer)

    // setTimeout(autoPaginate, 100) // Wait a tick for DOM render

    // const resizeObserver = new ResizeObserver(autoPaginate)
    // resizeObserver.observe(_editorElement)

    // Add event listeners to the editor's DOM element

    const editorDom = _editor.view.dom

    // Match desktop-office behaviour: dismiss the floating formatting menu as
    // soon as the editor viewport moves, while preserving the selected text.
    // BubbleMenu closes when the editor blurs; unlike changing the selection,
    // this leaves the highlighted range intact.
    const dismissBubbleMenuOnScroll = () => {
      if (_editor?.isDestroyed || _editor.state.selection.empty) return
      _editor.commands.blur()
    }
    _editorContainerRoot?.addEventListener('scroll', dismissBubbleMenuOnScroll, {
      passive: true
    })
    detachBubbleMenuScrollListener = () => {
      _editorContainerRoot?.removeEventListener('scroll', dismissBubbleMenuOnScroll)
    }

    editorDom.addEventListener('keypress', (event) => {
      handleWysiwygChange(event)
      console.log('Key pressed in WYSIWYG editor')
    })
    editorDom.addEventListener('keyup', (event) => {
      handleWysiwygChange(event)
      console.log('Key keyup in WYSIWYG editor')
    })
    editorDom.addEventListener('keydown', (event) => {
      if (_editor?.storage?.ghostWrite?.ghostText) {
        if (event.key === 'Tab') {
          event.preventDefault()
          acceptGhostText()
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          clearGhostText()
          return
        }
      }
      // handleWysiwygKeydown(event)
      console.log('Key keydown in WYSIWYG editor')
    })
    editorDom.addEventListener('input', (event) => {
      handleWysiwygInput(event)
      console.log('Key input in WYSIWYG editor')
    })
    editorDom.addEventListener('click', (event) => {
      handleWysiwygClick(event)
      console.log('Key click in WYSIWYG editor')
    })
    editorDom.addEventListener('focusout', (event) => {
      handleWysiwygFocusOut(event)
      console.log('Key focusout WYSIWYG editor')
    })
    editorDom.addEventListener('focus', (event) => {
      handleWysiwygFocus(event)
      console.log('Key focus in WYSIWYG editor')
    })
    editorDom.addEventListener('blur', (event) => {
      handleWysiwygBlur(event)
      console.log('Key blur in WYSIWYG editor')
    })

    // Register the editor instance in the store
    // console.log('Register the editor instance in the store ', editor)
    /* _$_wysiwygEditorsList.register(
      __wysiwygEditorId,
      _editor,
      __filePathToOpenFromDocument,
      _editorElement,
      _editorContainer,
      _editorContainerRoot
    ) */

    // renderPDF()

    /* return () => {
      _editor.off('selectionUpdate', updateActiveMarks)
      _editor.off('transaction', updateActiveMarks)
      _editor.off('update', updateActiveMarks)
    } */
  })

  onDestroy(() => {
    _authUnsub?.()
    _authUnsub = null
  })

  onDestroy(() => {
    if (typeof window !== 'undefined' && ghostListener) {
      window.removeEventListener('dynadoc:ghostwrite', ghostListener)
    }
  })
  onDestroy(() => {
    detachBubbleMenuScrollListener?.()
    detachBubbleMenuScrollListener = null
    paginationUnsubscribe?.()
    _headerEditor?.destroy()
    _footerEditor?.destroy()
    _headerEditor = null
    _footerEditor = null
    _providerManager?.destroy()
    _openTiming?.detach()
  })

  /* onDestroy(() => {
    // 1. Remove from Svelte Store
    _$_wysiwygEditorDynamicReferenceIndexes.update(currentMap => {
        currentMap.delete(__wysiwygEditorId);
        return currentMap;
    });

    // 2. Notify Worker to clear memory for this editor
    worker.postMessage({ 
        type: 'CLEAR_EDITOR', 
        editorId: __wysiwygEditorId 
    });
}); */

  // $: page = PAGE_SIZES[pageSize]
  // $: document.documentElement.style.setProperty('--page-width', page.width)
  // $: document.documentElement.style.setProperty('--page-height', page.height)

  // ✅ Watch for parent updates and apply to editor
  /* $: if (_editor && _editorContent !== previousEditorContent) {
    const current = _editor.getHTML()
    /* console.log(
      'Watch for parent updates in WYSIWYG editor ',
      current,
      '--- p',
      previousEditorContent,
      '--- e',
      _editorContent
    ) /

    if (_editorContent !== current) {
      /* console.log(
        'Watch for parent _editorContent !== current ',
        current,
        '--- p',
        previousEditorContent,
        '--- e',
        _editorContent
      ) /

      // _editor.commands.setContent(_editorContent, false)

      // _editor.commands.setContent(current, false)
      // handleWysiwygChange(null, current)
      handleWysiwygChange(null, _editorContent)

      // const { inlineStyles, externalStyles, bodyContent } =
      //   EditorHelpers.extractStylesAndBody(_editorContent)
      // _editorContentInlineStyles = inlineStyles
      // _editorContentExternalStyles = externalStyles
      // _editorContentBodyContent = bodyContent
    }
    previousEditorContent = _editorContent
    // Update the editor instance in the store
    _$_wysiwygEditorsList.register(__wysiwygEditorId, _editor)
    // console.log('Watch for parent updates in WYSIWYG editor current ', current)
  } */

  // Open modal helper
  function collaborationExtensionOpenModal(message: string, callback: (value: string) => void) {
    _collaborationExtensionModalMessage = message
    _collaborationExtensionModalCallback = callback
    _collaborationExtensionModalVisible = true
  }

  // Add comment using modal
  function collaborationExtensionAddComment() {
    collaborationExtensionOpenModal('Enter your name for this comment:', (author) => {
      _editor.commands.addComment({
        // Public shares/guests stay anonymous for privacy.
        author: _presenceForceAnonymous
          ? _collaborationExtensionCurrentUser.name
          : author || _collaborationExtensionCurrentUser.name,
        color: _collaborationExtensionCurrentUser.color,
        userId: _collaborationExtensionCurrentUser.id
      })
    })
  }
  // Set usename using modal
  function collaborationExtensionSetName() {
    collaborationExtensionOpenModal('Change name:', (author) => {
      const next = (author || '').trim()
      if (!next) return
      _collaborationExtensionCurrentUser.name = _presenceForceAnonymous
        ? next.toLowerCase().startsWith('anonymous ')
          ? next
          : `Anonymous ${next}`
        : next
      try {
        _providerManager?.provider?.awareness?.setLocalStateField('user', {
          name: _collaborationExtensionCurrentUser.name,
          color: _collaborationExtensionCurrentUser.color
        })
      } catch {
        // ignore
      }
    })
  }

  // Select comment text in editor
  function collaborationExtensionSelectComment(comment) {
    _editor.commands.setTextSelection({ from: comment.from, to: comment.to })
  }

  // Remove comment
  function collaborationExtensionRemoveComment(comment) {
    _editor.commands.removeComment(comment.id)
  }

  function handleWysiwygOnSave(): void {
    // IMPORTANT: This callback should ONLY be called on intentional/manual saves, NOT on autosave (onTransaction)
    // Calling this during autosave can trigger state changes that close the ribbon UI
    // Reserved for future use with explicit "Save" commands (e.g., Ctrl-S, manual save button)

    // Emit presentation updates if any presentation is currently active
    _editor.commands.emitPresentationUpdate()
  }

  function handleWysiwygFocusOut(event): void {
    console.log('focusout')
    // _isWysiwygEditorFocused = false
    // __wysiwygEditorSelectedTextList = null
  }

  function handleWysiwygFocus(event): void {
    console.log('focus in ')
    if (!_isReadOnly) {
      _$_wysiwygEditorsList.setActive(__wysiwygEditorId)
    }
    // _isWysiwygEditorFocused = true
  }

  function handleWysiwygBlur(event): void {
    console.log('blur')
    // _isWysiwygEditorFocused = false
    // __wysiwygEditorSelectedTextList = null
  }

  function handleWysiwygChange(event, wysiwygContentParam: string = null): void {
    return
    const wysiwygContent =
      wysiwygContentParam ||
      EditorHelpers.restoreSvelteExpressionsFromHtmlTags(event.target.innerHTML)
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")

    // console.log('handleWysiwygChange1', event.target.innerHTML)
    // console.log('handleWysiwygChange2', wysiwygContent)
    // _currentWysiwygContentCode = wysiwygContent
    // _wysiwygContentCode = _codeEditor.getValue()
    // console.log('_codeEditor', _wysiwygContentCode)
    // const wysiwygContent = _wysiwygContentCode
    let wysiwygContentCode = wysiwygContent // Put default code to html
  }

  function handleWysiwygClick(event): void {
    // EditorHelpers.isCursorInsideAVarTag()
    console.log('handleWysiwygClick  ' + event)
  }

  function handleWysiwygInput(event): void {
    console.log('handleWysiwygInput  ' + event)
  }
  // let _component
</script>

<!--
<svelte:head>
  <style>
      /* injects the <style> block(s) if any */
      {@html _editorContentInlineStyles}
  </style>
</svelte:head> -->

<!-- <MeetingFloatingToolbar/> -->

<div class="h-full min-h-0 w-full flex flex-col overflow-hidden">
  <!-- <svelte:document on:selectionchange={handleDocumentSelectionChange} /> -->

  <InputModal
    bind:visible={_collaborationExtensionModalVisible}
    message={_collaborationExtensionModalMessage}
    on:submit={(e) => {
      _collaborationExtensionModalVisible = false
      _collaborationExtensionModalCallback(e.detail)
    }}
    on:cancel={() => (_collaborationExtensionModalVisible = false)}
  />

  <!-- {#if !_isReadOnly}
    <UtilityBar {_editorPaginationOptions} {_editor} {__wysiwygEditorId} />
  {/if} -->

  <!-- Layout with ruler -->
  <div
    id="editor-{__parentContainerKey}"
    class="editor-shell flex flex-1 min-h-0 w-full overflow-auto px-6 py-8"
    style="width: 100%; margin: 0;"
    bind:this={_editorContainerRoot}
  >
    <!-- <pdf src="./2.pdf" width="100%" height="600px" type="application/pdf"></pdf> -->
    <!-- <ZoomWrapper> -->
    <!-- <ZoomWrapper initialScale={1} minScale={0.5} maxScale={2} step={0.2}> -->
    <ZoomWrapper
      __zoomControlContainer={document.getElementById('status-bar-right')}
      __zoomKey={__filePathToOpenFromDocument || __wysiwygEditorId}
    >
      <div class="editor-stage">
        <div bind:this={_editorContainer} class="editor-container relative">
          {#if $_$_findBar.open && _editor}
            <FindBar editor={_editor} />
          {/if}

          <!-- <div class="page"> -->

          {#if !_isEditorReady}
            <div class="wysiwyg-loader">
              <div class="loader-card">
                <div class="loader-logo">
                  <i class="ph-bold ph-sparkle"></i>
                </div>
                <div class="loader-text">
                  <div class="title">
                    {_loadError ? $_('This document could not be read') : $_('Preparing editor')}
                  </div>
                  <!-- The document exists; its content did not come back. Saying
                       "not found" would send the reader looking for a file that
                       is where it has always been. The technical reason stays in
                       the console and in this element's tooltip. -->
                  <div class="subtitle" title={_loadError}>
                    {_loadError
                      ? $_(
                          'Its content did not arrive, so it was not opened. Nothing has been changed. Try again in a moment.'
                        )
                      : $_('Loading layout, pagination, and tools…')}
                  </div>
                </div>
                {#if _loadError}
                  <button type="button" class="loader-retry" onclick={() => location.reload()}>
                    {$_('Reload')}
                  </button>
                {:else}
                  <div class="loader-bar"></div>
                {/if}
              </div>
            </div>
          {/if}

          {#if !_isReadOnly}
            <div class="sidebar">
              <div id="var-label-widget">
                {#if _editor}
                  <div id="grammar-suggestion-widget">
                    <GrammarSuggestion editor={_editor}></GrammarSuggestion>
                  </div>

                  <div id="word-comment-gutter-widget">
                    <WordCommentGutter editor={_editor}></WordCommentGutter>
                  </div>

                  <div class="pointer-events-none">
                    {#each _editor.storage?.excelTable?.items ?? [] as item (item.id)}
                      <!-- {#each _editor.storage.CustomExcelTableExtension.items as item (item.id)} -->
                      <CustomExcelTableExtensionVarLabel editor={_editor} {item} />
                    {/each}
                  </div>
                {/if}
              </div>
              <!-- </div> -->
              <div class="!hidden" style="display: none">
                <div id="bubble-menu-widget" class="z-1000">
                  <BubbleMenuWidget></BubbleMenuWidget>
                </div>
              </div>
            </div>
          {/if}

          <div
            class="relative m-auto {_editorPaginationOptions?.enabled
              ? 'bg-[white]'
              : 'bg-checkerboard'} {_isEditorReady ? '' : 'wysiwyg-hidden'}"
            style:margin-left={!_editorPaginationOptions?.enabled
              ? `-${_editorPaginationOptions?.marginLeft}px`
              : 'none'}
            style:background={!_editorPaginationOptions?.enabled ? `none` : 'white'}
            style:margin-right={!_editorPaginationOptions?.enabled
              ? `-${_editorPaginationOptions?.marginRight}px`
              : 'none'}
            style="width:{_editorPaginationOptions?.pageWidth}px;
                padding:{!_editorPaginationOptions?.enabled ? '2% 1%' : 'none'};
                min-height:{_editorPaginationOptions?.enabled
              ? `${_editorPaginationOptions?.pageHeight || 1100}px`
              : '100rem'};
                "
          >
            <div
              class="editor-content w-full h-full"
              bind:this={_editorElement}
              oncontextmenu={(e) => openContextMenuAtEvent(e)}
              onclick={() => hideContextMenu()}
              onscroll={() => hideContextMenu()}
            ></div>
            {#if _editor}
              <EditorPlaceholder
                editor={_editor}
                visible={_interactivePlaceholderVisible && !_isReadOnly}
              />
            {/if}
          </div>

          <HeaderFooterOverlay
            show={_isEditingHeader}
            title={$_('Edit Header')}
            hint={$_('Use {page} for page numbers')}
            position={_headerOverlay}
            bind:contentEl={_headerEditorEl}
            onClose={closeHeaderFooterOverlay}
          />

          <HeaderFooterOverlay
            show={_isEditingFooter}
            title={$_('Edit Footer')}
            hint={$_('Use {page} for page numbers')}
            position={_footerOverlay}
            bind:contentEl={_footerEditorEl}
            onClose={closeHeaderFooterOverlay}
          />
          <!-- </div> -->
        </div>
        <!-- </div> -->
        <!-- </div> -->
      </div></ZoomWrapper
    >
  </div>

  <ExportOptionsModal />

  {#if !_isReadOnly}
    <ContextMenuWidget
      __x={_contextMenuPositionX}
      __y={_contextMenuPositionY}
      __show={_showContextMenu}
      __menuItems={getContextMenuItems()}
    />
  {/if}
</div>

<style lang="postcss">
  :global(.editor-shell) {
    @apply relative flex items-start justify-center;
    /* WPS mockup: flat canvas using the --bg token (was a radial gradient) */
    background: var(--bg, var(--color-base-200));
  }

  :global(.editor-stage) {
    @apply w-full min-h-full flex justify-center;
  }

  :global(.editor-container) {
    @apply min-h-full;
  }

  .wysiwyg-loader {
    @apply absolute inset-0 flex items-center justify-center backdrop-blur-[8px] z-40;
    background: radial-gradient(
      circle at top,
      color-mix(in srgb, var(--color-accent, --color-base-300) 8%, transparent),
      color-mix(in srgb, var(--color-base-100, #000) 40%, transparent)
    );
  }

  .loader-card {
    @apply flex flex-col items-center gap-[10px] p-[18px_22px] rounded-[14px]
           min-w-[240px] absolute top-[5%];
    border: 1px solid color-mix(in srgb, var(--color-base-content, #fff) 10%, transparent);
    background: color-mix(in srgb, var(--color-base-200, #141414) 85%, transparent);
    box-shadow: 0 16px 40px color-mix(in srgb, var(--color-base-100, #000) 40%, transparent);
  }

  .loader-logo {
    @apply w-[42px] h-[42px] rounded-[14px] grid place-items-center;
    color: var(--color-accent, --color-base-300);
    background: color-mix(in srgb, var(--color-accent, --color-base-300) 15%, transparent);
    box-shadow: 0 0 20px color-mix(in srgb, var(--color-accent, --color-base-300) 25%, transparent);
  }

  .loader-text {
    @apply text-center;
  }

  .loader-text .title {
    @apply text-[12px] font-bold tracking-[0.15em] uppercase;
    color: color-mix(in srgb, var(--color-base-content, #fff) 85%, transparent);
  }

  .loader-text .subtitle {
    @apply text-[10px] mt-1;
    color: color-mix(in srgb, var(--color-base-content, #fff) 50%, transparent);
  }

  .loader-retry {
    @apply text-[10px] font-bold tracking-[0.12em] uppercase px-3 py-1.5 rounded-[8px];
    color: color-mix(in srgb, var(--color-base-content, #fff) 85%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-base-content, #fff) 20%, transparent);
    background: color-mix(in srgb, var(--color-base-content, #fff) 6%, transparent);
  }

  .loader-bar {
    @apply w-full h-1 rounded-full relative overflow-hidden;
    background: color-mix(in srgb, var(--color-base-content, #fff) 10%, transparent);
  }

  .loader-bar::after {
    @apply content-[''] absolute inset-0 w-[40%];
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--color-accent, --color-base-300) 20%, transparent),
      color-mix(in srgb, var(--color-accent, --color-base-300) 80%, transparent)
    );
    animation: loader-slide 1.2s infinite ease-in-out;
  }

  .wysiwyg-hidden {
    @apply opacity-0 pointer-events-none select-none;
  }

  @keyframes loader-slide {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(260%);
    }
  }
</style>
