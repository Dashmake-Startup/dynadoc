<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { get, writable } from 'svelte/store'

  import type { NodeViewProps } from '@tiptap/core'
  import { NodeViewWrapper } from 'svelte-tiptap'
  import { v4 as uuidv4 } from 'uuid'
  import { _, isLoading } from 'svelte-i18n'

  let sheetName = 'Sheet1'
  let _sheetDisplayName = ''
  let _sheetMeta = $state<{ id?: string; name?: string }[]>([])
  let _lastAttrSrc = $state<string | null>(null)
  let _lastPointerName = $state<string | null>(null)
  let _lastSheetSignature = $state<string | null>(null)
  import Resizer from '../../../../components/app/editor/components/display/Resizer.svelte'
  import SpreadsheetEditorWidget from './SpreadsheetEditorWidget.svelte'
  import EditorHelpers from '../../../../utils/EditorHelpers'
  import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../../stores/editor.store'
  import { _$_activeDocKind } from '../../../../stores/docKind.store'
  import { DocumentModel } from '../../../../models/Document'
  import { ensureNodeViewSrc } from '../../utils/utils'
  import Utils from '../../../../utils/Utils'
  import ScrollGuardOverlay from '../../../../components/common/interaction/ScrollGuardOverlay.svelte'
  import {
    registerSpreadsheetPointer,
    registerSpreadsheetWorkbookSheets,
    unregisterSpreadsheet
  } from '../../CustomVarExtension/stores/variableManipulator'
  import { openSpreadsheetEditorModal } from '../../../../stores/spreadsheetEditorModal.store'
  import { CustomSpreadsheetExtensionProps } from '../utils/common.utils'
  import { GenericFormatingEditorCommands } from '../../../../components/common/actions/formatting'
  import { nodeApi } from '../../../../utils/shims/node'
  import { resolveLocalCollabPresence } from '../../../../utils/collabPresence'
  import { authStore } from '../../../../stores/auth.store'
  import { openAuth, getSession } from '../../../../services/auth/auth.service'
  import { openAlertModal } from '../../../../stores/alertModal.store'
  import { openConfirmModal } from '../../../../stores/confirmModal.store'
  import { DriveActions } from '../../../../utils/driveActions'
  import EditorCommonUtils from '../../../../utils/common.utils'
  import { buildCollabDocId, resolveShareContext } from '../../../../utils/collabUtils'
  import { createSheetYjs, type CollaborativeSheet } from '../collab/collab'
  import QRCode from 'qrcode'
  import { NodeSharing } from '../../utils/nodeSharing'

  interface Props {
    node: any
    editor: any
    view: any
    getPos: () => number
    updateAttributes: (attrs: Record<string, any>) => void
    selected: boolean
    extension: any
    useNodeViewWrapper?: boolean
    isMirror?: boolean
    __src?: string
    __spreadsheetHeight?: number | string
    __spreadsheetWidth?: number | string
    __maxPageHeight?: number | string
    __maxPageWidth?: number | string
    __wysiwygEditorIdToUpdate?: string
    __shareId?: string
    __docUuid?: string
    __name?: string
    __readOnly?: boolean
  }

  let {
    node,
    editor,
    view,
    getPos,
    updateAttributes,
    selected,
    extension,
    useNodeViewWrapper = true,
    isMirror = false,
    __src,
    __spreadsheetHeight,
    __spreadsheetWidth,
    __maxPageHeight,
    __maxPageWidth,
    __wysiwygEditorIdToUpdate,
    __shareId,
    __docUuid,
    __name,
    __readOnly
  }: Props = $props()

  let _src = $derived(__src ?? node.attrs.src)
  const _spreadsheetHeight = $derived(__spreadsheetHeight ?? node.attrs.spreadsheetHeight)
  const _spreadsheetWidth = $derived(__spreadsheetWidth ?? node.attrs.spreadsheetWidth)
  // When the whole document is a spreadsheet (WPS-style), drop the fixed page
  // dimensions so the grid fills the editor body edge to edge instead of sitting
  // as a fixed-width widget on a floating page. Embedded spreadsheets inside a
  // Writer/Slides document keep their page sizing.
  const _fillContainer = $derived($_$_activeDocKind === 'sheets')
  const _maxPageHeight = $derived(
    _fillContainer ? null : __maxPageHeight || node.attrs.maxPageHeight
  )
  const _maxPageWidth = $derived(
    _fillContainer ? null : (__maxPageWidth ?? node.attrs.maxPageWidth)
  )
  const _layout = $derived(node?.attrs?.layout ?? 'inline')
  const _offsetX = $derived(Number(node?.attrs?.offsetX ?? 0))
  const _offsetY = $derived(Number(node?.attrs?.offsetY ?? 0))
  const _wysiwygEditorIdToUpdate = $derived(
    __wysiwygEditorIdToUpdate ?? node.attrs.wysiwygEditorIdToUpdate
  )
  const _parentDoc = $derived.by(() => {
    if (__docUuid) {
      return { uuid: __docUuid, name: __name, isShared: true, shareId: __shareId }
    }
    return get(_$_documentEditorsList.get(_wysiwygEditorIdToUpdate))?.document
  })

  const _userInfo = $derived.by(() => {
    const authState = get(authStore)
    const presence = resolveLocalCollabPresence({
      docId: _collabDocId || 'spreadsheet-init',
      authUser: authState?.authenticated ? authState.user : null,
      forceAnonymous: Boolean(resolveShareContext(_parentDoc)) || isMirror
    })
    return { name: presence.name, color: presence.color }
  })

  const _shouldWrap = $derived(useNodeViewWrapper && !isMirror)

  let _spreadsheetContainer: HTMLDivElement
  let _nodeViewRoot: HTMLDivElement | null = null
  let _isVisible = $state(false)
  let _observer: IntersectionObserver | null = null
  let _collab: CollaborativeSheet | null = $state(null)
  let _settings = $state<any>({})
  let _collabDocId = $state('')
  let _mountCleanup: (() => void) | null = null

  $effect(() => {
    if (_parentDoc && _src) {
      buildCollabDocId(_parentDoc, _src).then((id) => {
        _collabDocId = id
      })
    }
  })

  const _placeholderHeight = $derived(
    (() => {
      const raw = _spreadsheetHeight ?? _maxPageHeight ?? 320
      const value = typeof raw === 'number' ? raw : parseFloat(String(raw))
      return Number.isFinite(value) ? value : 320
    })()
  )

  const _layoutTakesSpace = $derived(!['front', 'behind'].includes(_layout))
  const _positionStyle = $derived.by(() => {
    const pieces = [`--nodeview-offset-x: ${_offsetX}px`, `--nodeview-offset-y: ${_offsetY}px`]
    return pieces.join('; ')
  })

  function setActiveNodeview() {
    if (!_wysiwygEditorIdToUpdate || !node?.attrs?.id) return
    _$_wysiwygEditorsList.registerNodeview(_wysiwygEditorIdToUpdate, {
      id: node.attrs.id,
      type: CustomSpreadsheetExtensionProps.name,
      collaborativeCanvas: null,
      isActive: false
    })
    _$_wysiwygEditorsList.setActiveNodeview(_wysiwygEditorIdToUpdate, node.attrs.id)
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault()
    setActiveNodeview()
    window.api?.showContextMenu?.([
      {
        label: 'In line with text',
        click: () => GenericFormatingEditorCommands.setActiveNodeviewLayout?.('inline')
      },
      { type: 'separator' },
      {
        label: 'Center',
        click: () => GenericFormatingEditorCommands.setActiveNodeviewLayout?.('center')
      },
      {
        label: 'Full width',
        click: () => GenericFormatingEditorCommands.setActiveNodeviewLayout?.('full')
      },
      {
        label: 'Float left',
        click: () => GenericFormatingEditorCommands.setActiveNodeviewLayout?.('float-left')
      },
      {
        label: 'Float right',
        click: () => GenericFormatingEditorCommands.setActiveNodeviewLayout?.('float-right')
      },
      { type: 'separator' },
      {
        label: 'In front of text',
        click: () => GenericFormatingEditorCommands.setActiveNodeviewLayout?.('front')
      },
      {
        label: 'Behind text',
        click: () => GenericFormatingEditorCommands.setActiveNodeviewLayout?.('behind')
      },
      { type: 'separator' },
      {
        label: 'Nudge left',
        click: () => GenericFormatingEditorCommands.nudgeActiveNodeview?.(-10, 0)
      },
      {
        label: 'Nudge right',
        click: () => GenericFormatingEditorCommands.nudgeActiveNodeview?.(10, 0)
      },
      {
        label: 'Nudge up',
        click: () => GenericFormatingEditorCommands.nudgeActiveNodeview?.(0, -10)
      },
      {
        label: 'Nudge down',
        click: () => GenericFormatingEditorCommands.nudgeActiveNodeview?.(0, 10)
      },
      {
        label: 'Reset position',
        click: () => GenericFormatingEditorCommands.resetActiveNodeviewPosition?.()
      },
      { type: 'separator' },
      {
        label: 'Delete spreadsheet',
        click: () => deleteSpreadsheetNode()
      }
    ])
  }

  const ensureSpreadsheetSrc = async () => {
    if (__src || node?.attrs?.src) return
    if (!node?.attrs?.id) return

    try {
      const resolvedPath = await ensureNodeViewSrc(
        node?.attrs?.src || '',
        'spreadsheet',
        DocumentModel.AssetType.SHEET,
        undefined,
        undefined,
        ''
      )
      if (resolvedPath) {
        updateAttributes?.({ src: resolvedPath })
      }
    } catch (err) {
      console.warn('[Spreadsheet] Failed to resolve spreadsheet path', err)
    }
  }

  function computeFallbackSheetName() {
    if (_sheetDisplayName) return _sheetDisplayName
    try {
      const ext = nodeApi?.path?.extname?.(_src) || ''
      return nodeApi?.path?.basename?.(_src, ext) || ''
    } catch {
      return ''
    }
  }

  function registerPointer(nextName?: string) {
    if (!node?.attrs?.id || !_src) return
    const resolvedName = nextName || node.attrs.label || computeFallbackSheetName() || sheetName
    if (resolvedName && resolvedName !== _sheetDisplayName) {
      _sheetDisplayName = resolvedName
    }
    if (_lastPointerName === _sheetDisplayName && _lastAttrSrc === _src) return
    registerSpreadsheetPointer(
      {
        id: node.attrs.id,
        name: _sheetDisplayName || resolvedName || sheetName,
        path: _src,
        type: 'spreadsheet',
        workbookId: node.attrs.id
      },
      _wysiwygEditorIdToUpdate
    )
    _lastPointerName = _sheetDisplayName
  }

  function registerWorkbookSheets(sheets: Array<{ id?: string; name?: string }>) {
    if (!node?.attrs?.id || !_src || !Array.isArray(sheets) || sheets.length === 0) return
    const signature = JSON.stringify(
      sheets.map((sheet) => ({ id: sheet?.id || '', name: sheet?.name || '' }))
    )
    if (signature === _lastSheetSignature) return
    _lastSheetSignature = signature
    _sheetMeta = sheets
    registerSpreadsheetWorkbookSheets(
      {
        workbookId: node.attrs.id,
        path: _src,
        sheets
      },
      _wysiwygEditorIdToUpdate
    )
  }

  const ensureVisible = () => {
    if (_isVisible) return
    _isVisible = true
    _observer?.disconnect()
    _observer = null
  }

  async function setPublished(
    published: boolean,
    options?: { deadline?: string; password?: string; role?: 'viewer' | 'editor' }
  ) {
    const result = await NodeSharing.setPublished(
      published,
      {
        nodeId: String(node?.attrs?.id || '').trim(),
        assetPath: _src,
        assetName: _sheetDisplayName || $_('Spreadsheet'),
        wysiwygId: _wysiwygEditorIdToUpdate
      },
      options
    )

    if (!result) return

    _settings.isPublished = result.isPublished
    _settings.publish = result.publish

    if (_collab) {
      _collab.ySettings.set('isPublished', result.isPublished)
      if (result.publish) {
        _collab.ySettings.set('publish', result.publish)
      } else {
        _collab.ySettings.delete('publish')
      }
    }
  }

  onMount(async () => {
    await ensureSpreadsheetSrc()
    registerPointer()

    _collab = await createSheetYjs(_src, _parentDoc, _userInfo)
    _collab.ySettings.observe(() => {
      _settings = _collab!.ySettings.toJSON()
    })
    _settings = _collab.ySettings.toJSON()

    if (typeof IntersectionObserver === 'undefined') {
      ensureVisible()
      return
    }

    _observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          ensureVisible()
        }
      },
      {
        root: editor?.view?.dom?.parentElement ?? null,
        rootMargin: '600px 0px'
      }
    )

    if (_nodeViewRoot) {
      _observer.observe(_nodeViewRoot)
    }

    const onSheetMetadata = (event: any) => {
      const detail = event?.detail
      if (!detail?.rootPath || detail.rootPath !== _src) return
      const sheets = detail?.sheets || []
      if (Array.isArray(sheets) && sheets.length) {
        const firstName = sheets?.[0]?.name
        if (firstName && firstName !== _sheetDisplayName) {
          registerPointer(firstName)
        }
        registerWorkbookSheets(sheets)
      }
    }
    const onSheetDirty = (event: any) => {
      const detail = event?.detail
      if (!detail?.rootPath || detail.rootPath !== _src) return
      registerPointer()
      if (_sheetMeta.length) registerWorkbookSheets(_sheetMeta)
    }
    const onFileChange = (payload: any) => {
      if (!payload?.path || payload.path !== _src) return
      registerPointer()
      if (_sheetMeta.length) registerWorkbookSheets(_sheetMeta)
    }
    const unsubscribe = window.api?.onSpreadsheetFileChanged?.(onFileChange)
    window.addEventListener?.('dynadoc-sheet-metadata', onSheetMetadata)
    window.addEventListener?.('dynadoc-sheet-dirty', onSheetDirty)

    _mountCleanup = () => {
      _observer?.disconnect()
      _observer = null
      if (typeof unsubscribe === 'function') unsubscribe()
      window.removeEventListener?.('dynadoc-sheet-metadata', onSheetMetadata)
      window.removeEventListener?.('dynadoc-sheet-dirty', onSheetDirty)
      _collab?.destroy()
    }
  })

  onDestroy(() => {
    _mountCleanup?.()
  })

  $effect(() => {
    if (!_src) return
    if (node?.attrs?.src !== _src) {
      updateAttributes({ src: _src })
      _lastAttrSrc = _src
    } else if (_lastAttrSrc !== _src) {
      _lastAttrSrc = _src
    }
    registerPointer()
  })

  function handleClick() {
    if (typeof getPos === 'function') {
      ensureVisible()
      editor.commands.setNodeSelection(getPos())
    }
  }

  const openEditorModal = async () => {
    // A full-bleed worksheet document is edited inline, so the double-click
    // editor modal is redundant. It stays available only for spreadsheets
    // embedded as a preview node inside a Writer/Slides document.
    if (_fillContainer) return
    if (!_src) return
    await openSpreadsheetEditorModal({
      src: _src
    })
  }

  // Remove the whole spreadsheet block from the document. FortuneSheet captures
  // keyboard focus, so Backspace/Delete never reach ProseMirror — this gives an
  // explicit, discoverable way to delete the node.
  async function deleteSpreadsheetNode(event?: Event) {
    event?.preventDefault()
    event?.stopPropagation()
    if (typeof getPos !== 'function') return
    const confirmed = await openConfirmModal({
      title: $_('Delete spreadsheet'),
      message: $_('Remove this spreadsheet from the document?'),
      confirmText: $_('Delete'),
      cancelText: $_('Cancel')
    })
    if (!confirmed) return
    const pos = getPos()
    if (typeof pos !== 'number') return
    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .run()
    // Drop the spreadsheet's variable pointer(s) so any {spreadsheet} reference
    // stops resolving to the now-deleted asset's file path.
    await unregisterSpreadsheet(
      { workbookId: node?.attrs?.id, path: _src },
      _wysiwygEditorIdToUpdate
    )
  }

  async function handleShareClick() {
    const confirm = await openConfirmModal({
      title: $_('Share Spreadsheet'),
      message: $_(
        'Do you want to publish this spreadsheet to the web? You can set a deadline and permissions.'
      ),
      confirmText: $_('Publish'),
      cancelText: $_('Cancel')
    })
    if (confirm) {
      await setPublished(true)
    }
  }

  async function handleUnshareClick() {
    const confirm = await openConfirmModal({
      title: $_('Unpublish Spreadsheet'),
      message: $_(
        'Are you sure you want to unpublish this spreadsheet? The link will no longer work.'
      ),
      confirmText: $_('Unpublish'),
      cancelText: $_('Cancel')
    })
    if (confirm) {
      await setPublished(false)
    }
  }

  async function showQRCode() {
    if (!_settings?.publish?.link) return
    try {
      const qrDataUrl = await QRCode.toDataURL(_settings.publish.link)
      await openAlertModal({
        title: $_('QR Code for Share Link'),
        message: `<div class="flex flex-col items-center gap-4">
          <img src="${qrDataUrl}" alt="QR Code" class="size-48" />
          <div class="text-[10px] break-all opacity-60">${_settings.publish.link}</div>
        </div>`
      })
    } catch (err) {
      console.error('Failed to generate QR code', err)
    }
  }
</script>

<!-- _shouldWrap {_shouldWrap} -->
{#if !_shouldWrap}
  <div
    class="spreadsheet-node-view"
    bind:this={_nodeViewRoot}
    onmousedown={handleClick}
    ondblclick={openEditorModal}
  >
    {#if _isVisible}
      <SpreadsheetEditorWidget
        __src={_src}
        __spreadsheetHeight={_spreadsheetHeight}
        __spreadsheetWidth={_spreadsheetWidth}
        __maxPageHeight={_maxPageHeight}
        __maxPageWidth={_maxPageWidth}
        __wysiwygEditorIdToUpdate={_wysiwygEditorIdToUpdate}
        __parentDoc={_parentDoc}
        __userInfo={_userInfo}
        __readOnly={true}
        __sheetName={_sheetDisplayName || sheetName}
      />
    {:else}
      <div class="spreadsheet-placeholder" style={`height: ${_placeholderHeight}px`}>
        {$_('Loading...')}
      </div>
    {/if}
  </div>
{:else}
  <!-- <NodeViewWrapper
    class="node-view-{CustomSpreadsheetExtensionProps.name} nodeview-position"
    data-layout={_layout}
    style={_positionStyle}
    oncontextmenu={handleContextMenu}
    onmousedown={setActiveNodeview}
  > -->

  <NodeViewWrapper
    class="node-view-{CustomSpreadsheetExtensionProps.name}"
    data-layout={_layout}
    style={_positionStyle}
    oncontextmenu={handleContextMenu}
    onmousedown={setActiveNodeview}
  >
    <!-- data-layout={_layout}
    style={_positionStyle} -->
    <!-- __src={_src}
    __spreadsheetHeight={_spreadsheetHeight}
    __spreadsheetWidth={_spreadsheetWidth}
    __maxPageHeight={_maxPageHeight}
    __maxPageWidth={_maxPageWidth}
    __wysiwygEditorIdToUpdate={_wysiwygEditorIdToUpdate} -->
    <div
      class="spreadsheet-node-view {selected ? 'is-selected' : ''}"
      bind:this={_nodeViewRoot}
      onmousedown={handleClick}
      ondblclick={openEditorModal}
    >
      {#if !_fillContainer}
        <div class="spreadsheet-node-toolbar" contenteditable="false">
          <button
            type="button"
            class="spreadsheet-node-delete"
            title={$_('Delete spreadsheet')}
            onmousedown={(e) => e.stopPropagation()}
            onclick={deleteSpreadsheetNode}
          >
            <i class="ph-bold ph-trash"></i>
          </button>
        </div>
      {/if}
      <!-- <ScrollGuardOverlay message="Double-click to edit"> -->
      {#if _isVisible}
        <SpreadsheetEditorWidget
          __src={_src}
          __spreadsheetHeight={_spreadsheetHeight}
          __spreadsheetWidth={_spreadsheetWidth}
          __maxPageHeight={_maxPageHeight}
          __maxPageWidth={_maxPageWidth}
          __wysiwygEditorIdToUpdate={_wysiwygEditorIdToUpdate}
          __parentDoc={_parentDoc}
          __userInfo={_userInfo}
          __readOnly={false}
          __sheetName={_sheetDisplayName || sheetName}
        />
      {:else}
        <div class="spreadsheet-placeholder" style={`height: ${_placeholderHeight}px`}>
          {$_('Loading...')}
        </div>
      {/if}
      <!-- </ScrollGuardOverlay> -->
    </div>
  </NodeViewWrapper>
{/if}

<style>
  :global(.spreadsheet-preview-container canvas) {
    @apply: m-auto border border-ligt dark:border-dark rounded-[5px];
  }
  .app {
    display: grid;
    grid-template-columns: 220px 1fr 320px;
    grid-template-rows: 48px 1fr;
    grid-template-areas: 'sidebar toolbar editor' 'sidebar main editor';
    height: 100vh;
  }
  .toolbar {
    grid-area: toolbar;
  }
  .sidebar {
    grid-area: sidebar;
    padding: 8px;
    border-right: 1px solid #eee;
    overflow: auto;
  }
  .main {
    grid-area: main;
    padding: 8px;
  }
  .editor {
    grid-area: editor;
    border-left: 1px solid #eee;
  }

  .spreadsheet-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed rgba(0, 0, 0, 0.2);
    color: #6f6f6f;
    background: rgba(0, 0, 0, 0.02);
  }

  .spreadsheet-node-view {
    position: relative;
  }
  /* Floating delete control, revealed on hover or when the node is selected. */
  .spreadsheet-node-toolbar {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 40;
    display: flex;
    gap: 4px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms ease;
  }
  .spreadsheet-node-view:hover .spreadsheet-node-toolbar,
  .spreadsheet-node-view.is-selected .spreadsheet-node-toolbar {
    opacity: 1;
    pointer-events: auto;
  }
  .spreadsheet-node-delete {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    font-size: 15px;
    color: #fff;
    background: rgba(220, 38, 38, 0.92);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
    cursor: pointer;
    transition:
      background 120ms ease,
      transform 120ms ease;
  }
  .spreadsheet-node-delete:hover {
    background: rgba(185, 28, 28, 0.98);
    transform: translateY(-1px);
  }
</style>
