<script lang="ts">
//   const nodeApi =
//     typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
//   const fs = nodeApi?.fs
//   const path = nodeApi?.path

  import { _ } from 'svelte-i18n'
  import { onDestroy, onMount, tick } from 'svelte'
  import { get } from 'svelte/store'
  import { v4 as uuidv4 } from 'uuid'
  import type { Editor } from '@tiptap/core'
  import type { PaginationPlusOptions } from '../../../../../extensions/tiptap/utils/common.utils'
  import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../../../stores/editor.store'
  import { _$_canvasCommands } from '../../../../../stores/canvas.store'
  import { CustomSlideExtensionProps } from '../../../../../extensions/tiptap/CustomSlideExtension/utils/common.utils'
  import { CustomSpreadsheetExtensionProps } from '../../../../../extensions/tiptap/CustomSpreadsheetExtension/utils/common.utils'
  import { CustomChartExtensionProps } from '../../../../../extensions/tiptap/CustomChartExtension/utils/common.utils'
  import { CustomDesignExtensionProps } from '../../../../../extensions/tiptap/CustomDesignExtension/utils/common.utils'
  import { DocumentModel } from '../../../../../models/Document'
  import html2canvas from 'html2canvas'
  import { toPng } from 'html-to-image'
  import ContextMenuWidget from '../../../../common/contextMenu/components/ContextMenuWidget.svelte'
  import type { ContextMenuItem } from '../../../../common/contextMenu/utils/utils'
import { nodeApi } from '../../../../../utils/shims/node'

  type OutlinePageType = 'slide' | 'sheet' | 'chart' | 'design' | 'text'

  type OutlinePage = {
    index: number
    type: OutlinePageType
    label: string
    pageTop: number
    hidden: boolean
    nodePos?: number
    nodeId?: string
    nodeType?: string
  }

  let pages = $state<OutlinePage[]>([])
  let activePageIndex = $state(1)
  let contextMenuVisible = $state(false)
  let contextMenuX = $state(0)
  let contextMenuY = $state(0)
  let contextMenuPage = $state<OutlinePage | null>(null)
  let draggingIndex = $state<number | null>(null)
  let dragOverIndex = $state<number | null>(null)
  let thumbnailCache = $state<Record<number, string>>({})
  let thumbnailQueue = new Set<number>()
  let thumbnailRunning = false

  let activeEditorId = $state('')
  let activeEditor = $state<Editor | null>(null)
  let editorScrollContainer = $state<HTMLElement | null>(null)
  let paginationOptions = $state<PaginationPlusOptions | null>(null)

  let selectedPageIndexes = $state<number[]>([])
  let lastSelectedIndex = $state<number | null>(null)

  const selectedPages = $derived(pages.filter((page) => selectedPageIndexes.includes(page.index)))
  const selectedCount = $derived(selectedPageIndexes.length)
  const hasSelection = $derived(selectedCount > 0)

  const nodeViewSelectors: Record<OutlinePageType, string> = {
    slide: '.node-view-slide',
    design: '.node-view-design',
    sheet: '.spreadsheet-node-view',
    chart: '.chart-nodeview',
    text: ''
  }

  const nodeTypeByName: Record<string, OutlinePageType> = {
    [CustomSlideExtensionProps.name]: 'slide',
    [CustomDesignExtensionProps.name]: 'design',
    [CustomSpreadsheetExtensionProps.name]: 'sheet',
    [CustomChartExtensionProps.name]: 'chart'
  }

  const destroyHandlers: Array<() => void> = []
  const IGNORE_THUMB_SELECTORS = new Set([
    'handles',
    'node-view-controls',
    'node-view-control',
    'node-view-toolbar',
    'node-view-slide-toolbar',
    'node-view-slide-controls',
    'node-view-floating-toolbar',
    'node-view-resize-handles',
    'selection-toolbar',
    'bubble-menu',
    'floating-menu'
  ])

  const selectionByIndex = () => new Set(selectedPageIndexes)

  function updateSelection(page: OutlinePage, event: MouseEvent) {
    const pageIndex = page.index
    const pageList = pages.map((p) => p.index)
    const currentIndex = pageList.indexOf(pageIndex)
    if (currentIndex < 0) return

    if (event.shiftKey && lastSelectedIndex != null) {
      const anchorIndex = pageList.indexOf(lastSelectedIndex)
      if (anchorIndex >= 0) {
        const [start, end] =
          anchorIndex < currentIndex ? [anchorIndex, currentIndex] : [currentIndex, anchorIndex]
        selectedPageIndexes = pageList.slice(start, end + 1)
      } else {
        selectedPageIndexes = [pageIndex]
      }
    } else if (event.metaKey || event.ctrlKey) {
      const set = selectionByIndex()
      if (set.has(pageIndex)) {
        set.delete(pageIndex)
      } else {
        set.add(pageIndex)
      }
      selectedPageIndexes = Array.from(set)
      if (set.size) {
        lastSelectedIndex = pageIndex
      }
    } else {
      selectedPageIndexes = [pageIndex]
      lastSelectedIndex = pageIndex
    }
  }

  function getNearestNodePage(startIndex: number): OutlinePage | null {
    const forward = pages.slice(startIndex).find((page) => page.nodePos != null)
    if (forward) return forward
    const backward = pages
      .slice(0, startIndex)
      .reverse()
      .find((page) => page.nodePos != null)
    return backward ?? null
  }

  function setContextMenu(page: OutlinePage, event: MouseEvent) {
    event.preventDefault()
    if (!selectedPageIndexes.includes(page.index)) {
      selectedPageIndexes = [page.index]
      lastSelectedIndex = page.index
    }
    contextMenuVisible = true
    contextMenuPage = page
    contextMenuX = event.clientX
    contextMenuY = event.clientY
  }

  function closeContextMenu() {
    contextMenuVisible = false
    contextMenuPage = null
  }

  function getPageOffsets(editorEl: HTMLElement) {
    const pageBreaks = Array.from(editorEl.querySelectorAll<HTMLElement>('.rm-page-break .page'))
    const offsets = [0]
    pageBreaks.forEach((el) => offsets.push(el.offsetTop))
    return offsets
  }

  function getPageCount(editorEl: HTMLElement) {
    const pageBreaks = editorEl.querySelectorAll('.rm-page-break .page')
    return Math.max(1, pageBreaks.length + 1)
  }

  function getNodePageIndexMap(editor: Editor) {
    try {
      return editor.commands.getAllNodePageIndexes?.([
        'node-view-slide',
        'node-view-design',
        'spreadsheet-node-view',
        'chart-nodeview'
      ]) as Map<HTMLElement, number>
    } catch {
      return new Map<HTMLElement, number>()
    }
  }

  function buildOutlinePages() {
    if (!activeEditor || !activeEditor.view?.dom) {
      pages = []
      return
    }

    const editorEl = activeEditor.view.dom as HTMLElement
    const pageOffsets = getPageOffsets(editorEl)
    const pageCount = getPageCount(editorEl)
    const nodePageIndexMap = getNodePageIndexMap(activeEditor)

    const nodeEntries: {
      pos: number
      nodeType: OutlinePageType
      nodeId?: string
      dom?: HTMLElement | null
    }[] = []

    const domByType: Record<OutlinePageType, HTMLElement[]> = {
      slide: Array.from(editorEl.querySelectorAll<HTMLElement>(nodeViewSelectors.slide)),
      design: Array.from(editorEl.querySelectorAll<HTMLElement>(nodeViewSelectors.design)),
      sheet: Array.from(editorEl.querySelectorAll<HTMLElement>(nodeViewSelectors.sheet)),
      chart: Array.from(editorEl.querySelectorAll<HTMLElement>(nodeViewSelectors.chart)),
      text: []
    }

    const domIndexByType: Record<OutlinePageType, number> = {
      slide: 0,
      design: 0,
      sheet: 0,
      chart: 0,
      text: 0
    }

    activeEditor.state.doc.descendants((node, pos) => {
      const nodeType = nodeTypeByName[node.type.name]
      if (!nodeType) return
      const domList = domByType[nodeType]
      const domIndex = domIndexByType[nodeType] ?? 0
      const dom = domList[domIndex] ?? null
      domIndexByType[nodeType] = domIndex + 1
      nodeEntries.push({
        pos,
        nodeType,
        nodeId: node.attrs?.id,
        dom
      })
    })

    const hiddenPages = new Set<number>(paginationOptions?.hiddenPages ?? [])

    const pageMap = new Map<number, OutlinePage>()
    for (let i = 1; i <= pageCount; i += 1) {
      pageMap.set(i, {
        index: i,
        type: 'text',
        label: `Page ${i}`,
        pageTop: pageOffsets[i - 1] ?? 0,
        hidden: hiddenPages.has(i)
      })
    }

    nodeEntries.forEach((entry) => {
      const pageIndex = entry.dom ? nodePageIndexMap.get(entry.dom) : null
      const index = pageIndex ?? 1
      const existing = pageMap.get(index)
      const label =
        entry.nodeType === 'slide'
          ? `Slide ${index}`
          : entry.nodeType === 'sheet'
            ? `Sheet ${index}`
            : entry.nodeType === 'chart'
              ? `Chart ${index}`
              : entry.nodeType === 'design'
                ? `Design ${index}`
                : `Page ${index}`
      pageMap.set(index, {
        ...(existing ?? {
          index,
          pageTop: pageOffsets[index - 1] ?? 0,
          hidden: hiddenPages.has(index)
        }),
        type: entry.nodeType,
        label,
        nodePos: entry.pos,
        nodeId: entry.nodeId,
        nodeType: entry.nodeType
      })
    })

    const order = paginationOptions?.pageOrder ?? []
    pages = Array.from(pageMap.values()).sort((a, b) => {
      const aKey = a.nodeId ? order.indexOf(a.nodeId) : -1
      const bKey = b.nodeId ? order.indexOf(b.nodeId) : -1
      if (aKey !== -1 || bKey !== -1) {
        if (aKey === -1) return 1
        if (bKey === -1) return -1
        return aKey - bKey
      }
      return a.index - b.index
    })
    selectedPageIndexes = selectedPageIndexes.filter((index) =>
      pages.some((page) => page.index === index)
    )
    scheduleThumbnails()
  }

  function updateActivePageFromScroll() {
    if (!editorScrollContainer) return
    const scrollTop = editorScrollContainer.scrollTop
    let current = 1
    for (const page of pages) {
      if (scrollTop >= page.pageTop - 4) current = page.index
    }
    activePageIndex = current
  }

  function scrollToPage(page: OutlinePage) {
    if (!editorScrollContainer) return
    editorScrollContainer.scrollTop = page.pageTop
    activePageIndex = page.index
  }

  function toggleHidden(page: OutlinePage) {
    if (!activeEditor || !paginationOptions) return
    const targetPages = selectedPages.length ? selectedPages : [page]
    const hiddenPages = new Set<number>(paginationOptions.hiddenPages ?? [])
    targetPages.forEach((item) => {
      if (hiddenPages.has(item.index)) {
        hiddenPages.delete(item.index)
      } else {
        hiddenPages.add(item.index)
      }
    })
    const nextOptions = {
      ...paginationOptions,
      hiddenPages: Array.from(hiddenPages),
      pageOrder: paginationOptions.pageOrder ?? []
    }
    paginationOptions = nextOptions
    activeEditor.storage.PaginationPlus.hiddenPages = nextOptions.hiddenPages
    persistOutlineState(nextOptions)
    buildOutlinePages()
  }

  function hideOthers(keep: OutlinePage[]) {
    if (!activeEditor || !paginationOptions) return
    const keepSet = new Set(keep.map((page) => page.index))
    const hidden = pages.filter((page) => !keepSet.has(page.index)).map((page) => page.index)
    const nextOptions = {
      ...paginationOptions,
      hiddenPages: hidden,
      pageOrder: paginationOptions.pageOrder ?? []
    }
    paginationOptions = nextOptions
    activeEditor.storage.PaginationPlus.hiddenPages = nextOptions.hiddenPages
    persistOutlineState(nextOptions)
    buildOutlinePages()
  }

  function showAllPages() {
    if (!activeEditor || !paginationOptions) return
    const nextOptions = {
      ...paginationOptions,
      hiddenPages: [],
      pageOrder: paginationOptions.pageOrder ?? []
    }
    paginationOptions = nextOptions
    activeEditor.storage.PaginationPlus.hiddenPages = nextOptions.hiddenPages
    persistOutlineState(nextOptions)
    buildOutlinePages()
  }

  async function duplicatePage(page: OutlinePage) {
    if (!activeEditor) return
    const targetPages = selectedPages.length ? selectedPages : [page]
    const pagesToDuplicate = targetPages.filter((item) => item.nodePos != null)
    for (const item of pagesToDuplicate) {
      const node = activeEditor.state.doc.nodeAt(item.nodePos)
      if (!node) continue

      const typeName = node.type.name
      const assetType =
        typeName === CustomSlideExtensionProps.name
          ? DocumentModel.AssetType.SLIDE
          : typeName === CustomSpreadsheetExtensionProps.name
            ? DocumentModel.AssetType.SHEET
            : typeName === CustomDesignExtensionProps.name
              ? DocumentModel.AssetType.DESIGN
              : null

      const attrs = { ...node.attrs }
      attrs.id = uuidv4()

      if (assetType && attrs.src) {
        try {
          const activeDoc = get(_$_documentEditorsList.getActive())?.document
          const newAsset = await DocumentModel.getAssetFilePathFromDocument(assetType, activeDoc)
          if (newAsset?.filePath && nodeApi?.fs?.existsSync(attrs.src)) {
          // if (newAsset?.filePath && window.api.node?.fs?.existsSync(attrs.src)) {
            await nodeApi.fsPromises.copyFile(attrs.src, newAsset.filePath)
            attrs.src = newAsset.filePath
          }
        } catch (error) {
          console.error('Failed to duplicate asset file', error)
        }
      }

      const tr = activeEditor.state.tr.insert(
        item.nodePos + node.nodeSize,
        node.type.create(attrs, node.content, node.marks)
      )
      activeEditor.view.dispatch(tr)
    }
    buildOutlinePages()
  }

  function deletePage(page: OutlinePage) {
    if (!activeEditor) return
    const targetPages = selectedPages.length ? selectedPages : [page]
    const deletable = targetPages.filter((item) => item.nodePos != null)
    if (!deletable.length) return
    const sorted = [...deletable].sort((a, b) => (b.nodePos ?? 0) - (a.nodePos ?? 0))
    let tr = activeEditor.state.tr
    sorted.forEach((item) => {
      if (item.nodePos == null) return
      const node = activeEditor.state.doc.nodeAt(item.nodePos)
      if (!node) return
      tr = tr.delete(item.nodePos, item.nodePos + node.nodeSize)
    })
    activeEditor.view.dispatch(tr)
    selectedPageIndexes = []
    buildOutlinePages()
  }

  function addSlideBox(page: OutlinePage, type: 'title' | 'content') {
    const targets = selectedPages.length ? selectedPages : [page]
    targets.forEach((item) => {
      if (!item.nodeId || item.type !== 'slide') return
      const commands = _$_canvasCommands.get(item.nodeId)
      if (!commands?.addText) return
      const width = type === 'title' ? 1200 : 1200
      const height = type === 'title' ? 120 : 320
      const y = type === 'title' ? 80 : 280
      commands.addText({
        x: 120,
        y,
        w: width,
        h: height,
        content: {
          type,
          value: type === 'title' ? 'Click to add title' : 'Click to add content',
          placeholder: type === 'title' ? 'Title' : 'Content'
        }
      })
    })
  }

  function moveNodes(selected: OutlinePage[], target: OutlinePage, placeAfter: boolean) {
    if (!activeEditor || target.nodePos == null) return
    const movable = selected.filter((item) => item.nodePos != null)
    if (!movable.length) return
    if (movable.some((item) => item.nodePos === target.nodePos)) return

    const doc = activeEditor.state.doc
    const sortedByPos = [...movable].sort((a, b) => (a.nodePos ?? 0) - (b.nodePos ?? 0))
    const nodesToMove = sortedByPos.map((item) => doc.nodeAt(item.nodePos)).filter(Boolean)
    if (!nodesToMove.length) return

    const targetNode = doc.nodeAt(target.nodePos)
    if (!targetNode) return

    let insertPos = target.nodePos + (placeAfter ? targetNode.nodeSize : 0)
    let tr = activeEditor.state.tr

    const deleteRanges = [...sortedByPos].sort((a, b) => (b.nodePos ?? 0) - (a.nodePos ?? 0))
    deleteRanges.forEach((item) => {
      if (item.nodePos == null) return
      const node = doc.nodeAt(item.nodePos)
      if (!node) return
      tr = tr.delete(item.nodePos, item.nodePos + node.nodeSize)
    })

    insertPos = tr.mapping.map(insertPos)
    let cursor = insertPos
    nodesToMove.forEach((node) => {
      tr = tr.insert(cursor, node.copy(node.content))
      cursor += node.nodeSize
    })
    activeEditor.view.dispatch(tr)
    buildOutlinePages()
    persistOutlineState()
  }

  function moveSelectionRelative(direction: -1 | 1) {
    if (!pages.length) return
    const selected = selectedPages.length ? selectedPages : contextMenuPage ? [contextMenuPage] : []
    if (!selected.length) return
    const indices = selected
      .map((page) => pages.findIndex((p) => p.index === page.index))
      .filter((value) => value >= 0)
    if (!indices.length) return

    const anchorIndex = direction < 0 ? Math.min(...indices) : Math.max(...indices)
    const targetIndex = anchorIndex + direction
    const targetPage = pages[targetIndex]
    if (!targetPage) return
    const nearest = targetPage.nodePos != null ? targetPage : getNearestNodePage(targetIndex)
    if (!nearest) return
    moveNodes(selected, nearest, direction > 0)
  }

  function moveSelectionToEdge(edge: 'start' | 'end') {
    if (!pages.length) return
    const selected = selectedPages.length ? selectedPages : contextMenuPage ? [contextMenuPage] : []
    if (!selected.length) return
    const targetIndex = edge === 'start' ? 0 : pages.length - 1
    const targetPage = pages[targetIndex]
    if (!targetPage) return
    const nearest = targetPage.nodePos != null ? targetPage : getNearestNodePage(targetIndex)
    if (!nearest) return
    moveNodes(selected, nearest, edge === 'end')
  }

  function handleDragStart(index: number) {
    draggingIndex = index
    const page = pages[index]
    if (page && !selectedPageIndexes.includes(page.index)) {
      selectedPageIndexes = [page.index]
      lastSelectedIndex = page.index
    }
  }

  function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault()
    dragOverIndex = index
  }

  function handleDrop(event: DragEvent, index: number) {
    event.preventDefault()
    if (draggingIndex == null || dragOverIndex == null) {
      draggingIndex = null
      dragOverIndex = null
      return
    }

    const fromPage = pages[draggingIndex]
    const targetPage = pages[dragOverIndex]
    draggingIndex = null
    dragOverIndex = null

    if (!targetPage) return
    const toPage = targetPage.nodePos != null ? targetPage : getNearestNodePage(dragOverIndex)
    if (!toPage?.nodePos) return
    const selected = selectedPages.length ? selectedPages : fromPage ? [fromPage] : []
    if (!selected.length) return
    const selectedIndices = selected
      .map((p) => pages.findIndex((x) => x.index === p.index))
      .filter((value) => value >= 0)
    const maxSelectedIndex = selectedIndices.length ? Math.max(...selectedIndices) : -1
    const placeAfter = dragOverIndex > maxSelectedIndex
    moveNodes(selected, toPage, placeAfter)
  }

  function attachEditorEntry(entry: ReturnType<typeof _$_wysiwygEditorsList.getActiveEntry>) {
    if (!entry?.id) return
    activeEditorId = entry.id?.toString()
    activeEditor = entry?.editor ?? null
    editorScrollContainer = entry?.editorHTMLContainerRoot ?? null
    paginationOptions = entry?.paginationOptions ?? null
    selectedPageIndexes = []
    lastSelectedIndex = null

    destroyHandlers.splice(0).forEach((fn) => fn())

    if (activeEditor) {
      const update = () => buildOutlinePages()
      activeEditor.on('update', update)
      destroyHandlers.push(() => activeEditor?.off('update', update))
    }

    if (editorScrollContainer) {
      const onScroll = () => updateActivePageFromScroll()
      editorScrollContainer.addEventListener('scroll', onScroll, { passive: true })
      destroyHandlers.push(() => editorScrollContainer?.removeEventListener('scroll', onScroll))
    }

    buildOutlinePages()
    updateActivePageFromScroll()
  }

  function syncActiveEditor() {
    const activeWysiwygEntry = _$_wysiwygEditorsList.getActiveEntry()
    if (!activeWysiwygEntry?.id) {
      pages = []
      activeEditor = null
      return
    }
    if (activeWysiwygEntry.id?.toString() !== activeEditorId) {
      attachEditorEntry(activeWysiwygEntry)
    } else {
      buildOutlinePages()
    }
  }

  function buildOutlineMenuItems(): ContextMenuItem[] {
    if (!contextMenuPage) return []
    const targets = selectedPages.length ? selectedPages : [contextMenuPage]
    const hasNodes = targets.some((page) => page.nodePos != null)
    const hasSlides = targets.some((page) => page.type === 'slide' && page.nodeId)
    const anyHidden = targets.some((page) => page.hidden)
    const canMove = hasNodes && pages.length > 1

    return [
      {
        label: anyHidden ? 'Show in presentation' : 'Hide from presentation',
        icon: anyHidden ? 'ph-bold ph-eye' : 'ph-bold ph-eye-slash',
        group: 0,
        action: () => {
          toggleHidden(contextMenuPage)
          closeContextMenu()
        }
      },
      {
        label: 'Show only selected',
        icon: 'ph-bold ph-rectangle',
        group: 0,
        action: () => {
          hideOthers(targets)
          closeContextMenu()
        }
      },
      {
        label: 'Show all pages',
        icon: 'ph-bold ph-eye',
        group: 0,
        action: () => {
          showAllPages()
          closeContextMenu()
        }
      },
      {
        label: 'Duplicate',
        icon: 'ph-bold ph-copy',
        group: 1,
        disabled: !hasNodes,
        action: () => {
          duplicatePage(contextMenuPage)
          closeContextMenu()
        }
      },
      {
        label: 'Delete',
        icon: 'ph-bold ph-trash',
        group: 1,
        disabled: !hasNodes,
        action: () => {
          deletePage(contextMenuPage)
          closeContextMenu()
        }
      },
      {
        label: 'Move Up',
        icon: 'ph-bold ph-arrow-up',
        group: 2,
        disabled: !canMove,
        action: () => {
          moveSelectionRelative(-1)
          closeContextMenu()
        }
      },
      {
        label: 'Move Down',
        icon: 'ph-bold ph-arrow-down',
        group: 2,
        disabled: !canMove,
        action: () => {
          moveSelectionRelative(1)
          closeContextMenu()
        }
      },
      {
        label: 'Move to Start',
        icon: 'ph-bold ph-caret-double-up',
        group: 2,
        disabled: !canMove,
        action: () => {
          moveSelectionToEdge('start')
          closeContextMenu()
        }
      },
      {
        label: 'Move to End',
        icon: 'ph-bold ph-caret-double-down',
        group: 2,
        disabled: !canMove,
        action: () => {
          moveSelectionToEdge('end')
          closeContextMenu()
        }
      },
      {
        label: 'Add title box',
        icon: 'ph-bold ph-text-aa',
        group: 3,
        hidden: !hasSlides,
        action: () => {
          addSlideBox(contextMenuPage, 'title')
          closeContextMenu()
        }
      },
      {
        label: 'Add content box',
        icon: 'ph-bold ph-text-align-left',
        group: 3,
        hidden: !hasSlides,
        action: () => {
          addSlideBox(contextMenuPage, 'content')
          closeContextMenu()
        }
      },
      {
        label: 'Select all',
        icon: 'ph-bold ph-selection-all',
        group: 4,
        action: () => {
          selectedPageIndexes = pages.map((page) => page.index)
          closeContextMenu()
        }
      },
      {
        label: 'Clear selection',
        icon: 'ph-bold ph-selection-slash',
        group: 4,
        action: () => {
          selectedPageIndexes = []
          closeContextMenu()
        }
      }
    ]
  }

  onMount(() => {
    const unsubscribe = _$_documentEditorsList.getActive().subscribe(() => {
      syncActiveEditor()
    })
    const unsubscribeWysiwyg = _$_wysiwygEditorsList.getActive().subscribe(() => {
      syncActiveEditor()
    })
    destroyHandlers.push(unsubscribe)
    destroyHandlers.push(unsubscribeWysiwyg)
    syncActiveEditor()
    const close = () => closeContextMenu()
    window.addEventListener('click', close)
    destroyHandlers.push(() => window.removeEventListener('click', close))
  })

  onDestroy(() => {
    destroyHandlers.splice(0).forEach((fn) => fn())
  })

  function persistOutlineState(nextOptions?: PaginationPlusOptions) {
    if (!activeEditorId) return
    const pageOrder = pages.filter((page) => page.nodeId).map((page) => page.nodeId as string)
    const finalOptions = nextOptions ?? paginationOptions
    if (!finalOptions) return

    const updatedOptions: PaginationPlusOptions = {
      ...finalOptions,
      pageOrder
    }

    paginationOptions = updatedOptions
    _$_wysiwygEditorsList.setPaginationOptions(activeEditorId, updatedOptions)

    _$_documentEditorsList.updateDocumentConfig(activeEditorId, (doc) => {
      doc.config.pagination = {
        ...doc.config.pagination,
        hiddenPages: updatedOptions.hiddenPages ?? [],
        pageOrder: updatedOptions.pageOrder ?? []
      }
    })
  }

  function scheduleThumbnails() {
    pages.forEach((page) => {
      if (!thumbnailCache[page.index]) {
        thumbnailQueue.add(page.index)
      }
    })
    processThumbnailQueue()
  }

  async function processThumbnailQueue() {
    if (thumbnailRunning) return
    thumbnailRunning = true
    await tick()

    while (thumbnailQueue.size && activeEditor) {
      const next = thumbnailQueue.values().next().value
      thumbnailQueue.delete(next)
      const page = pages.find((item) => item.index === next)
      if (!page) continue
      const image = await captureThumbnail(page)
      if (image) {
        thumbnailCache = { ...thumbnailCache, [page.index]: image }
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }

    thumbnailRunning = false
  }

  async function captureThumbnail1(page: OutlinePage) {
    if (!activeEditor || !activeEditor.view?.dom) return null
    const root = activeEditor.view.dom as HTMLElement
    const target = root.querySelector('.ProseMirror') as HTMLElement | null
    if (!target) return null
    const width = paginationOptions?.pageWidth ?? 794
    const height = paginationOptions?.pageHeight ?? 450

    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-10000px'
    container.style.top = '0'
    container.style.width = `${width}px`
    container.style.height = `${height}px`
    container.style.overflow = 'hidden'
    container.style.background = '#ffffff'
    container.style.pointerEvents = 'none'

    const clone = target.cloneNode(true) as HTMLElement
    clone.style.transform = `translateY(-${page.pageTop}px)`
    clone.style.transformOrigin = 'top left'
    clone.style.width = `${width}px`

    container.appendChild(clone)
    document.body.appendChild(container)

    try {
      const canvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 0.2,
        useCORS: true,
        ignoreElements: (element) => {
          if (!(element instanceof HTMLElement)) return false
          for (const selector of IGNORE_THUMB_SELECTORS) {
            if (element.classList.contains(selector)) return true
          }
          return false
        }
      })
      return canvas.toDataURL('image/png')
    } catch (error) {
      console.warn('Outline thumbnail generation failed', error)
      return null
    } finally {
      container.remove()
    }
  }

  async function captureThumbnailOL(page: OutlinePage) {
    if (!activeEditor || !activeEditor.view?.dom) return null
    const root = activeEditor.view.dom as HTMLElement
    const target = root.querySelector('.ProseMirror') as HTMLElement | null
    if (!target) return null
    const width = paginationOptions?.pageWidth ?? 794
    const height = paginationOptions?.pageHeight ?? 450

    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-10000px'
    container.style.top = '0'
    container.style.width = `${width}px`
    container.style.height = `${height}px`
    container.style.overflow = 'hidden'
    container.style.background = '#ffffff'
    container.style.pointerEvents = 'none'

    const clone = target.cloneNode(true) as HTMLElement
    clone.style.transform = `translateY(-${page.pageTop}px)`
    clone.style.transformOrigin = 'top left'
    clone.style.width = `${width}px`

    container.appendChild(clone)
    document.body.appendChild(container)

    try {
      const dataUrl = await toPng(container, {
        backgroundColor: '#ffffff',
        pixelRatio: 0.2, // equivalent to scale in html2canvas
        filter: (node) => {
          if (!(node instanceof HTMLElement)) return true
          return !IGNORE_THUMB_SELECTORS.some((s) => node.classList.contains(s))
        }
      })
      return dataUrl
    } catch (error) {
      console.warn('Thumbnail generation failed', error)
      return null
    }
  }

  async function captureThumbnail(page: OutlinePage) {
    if (!activeEditor || !activeEditor.view?.dom) return null
    const root = activeEditor.view.dom as HTMLElement
    const target = root.querySelector('.ProseMirror') as HTMLElement | null
    if (!target) return null

    const width = paginationOptions?.pageWidth ?? 794
    const height = paginationOptions?.pageHeight ?? 450

    const container = document.createElement('div')
    // ... (your existing style setup)
    container.style.position = 'fixed'
    container.style.left = '-10000px'
    container.style.top = '0'
    container.style.width = `${width}px`
    container.style.height = `${height}px`
    container.style.overflow = 'hidden'
    container.style.background = '#ffffff'

    const clone = target.cloneNode(true) as HTMLElement
    clone.style.transform = `translateY(-${page.pageTop}px)`
    clone.style.transformOrigin = 'top left'
    clone.style.width = `${width}px`

    container.appendChild(clone)
    document.body.appendChild(container)

    try {
      const dataUrl = await toPng(container, {
        backgroundColor: '#ffffff',
        canvasWidth: width * 0.2, // Scaling via dimensions is often more stable
        canvasHeight: height * 0.2,
        filter: (node) => {
          // html-to-image filter: return true to INCLUDE, false to EXCLUDE
          if (!(node instanceof HTMLElement)) return true

          // Convert to array if it's a Set, or handle as array
          const selectors = Array.isArray(IGNORE_THUMB_SELECTORS)
            ? IGNORE_THUMB_SELECTORS
            : Array.from(IGNORE_THUMB_SELECTORS as any)

          // If any class matches, return false to filter it out
          const shouldIgnore = selectors.some((s: string) => node.classList.contains(s))
          return !shouldIgnore
        }
      })
      return dataUrl
    } catch (error) {
      console.warn('Thumbnail generation failed', error)
      return null
    } finally {
      container.remove()
    }
  }
</script>

<div class="outline-pane">
  <div class="outline-header">
    <div class="title">{$_('Outline')}</div>
    <div class="subtitle">{pages.length} pages</div>
  </div>
  {#if hasSelection}
    <div class="outline-toolbar">
      <span class="selection-count">{selectedCount} selected</span>
      <div class="toolbar-actions">
        <button on:click={() => toggleHidden(contextMenuPage ?? selectedPages[0])}>
          {selectedPages.some((page) => page.hidden) ? 'Show' : 'Hide'}
        </button>
        <button on:click={() => duplicatePage(contextMenuPage ?? selectedPages[0])}>
          Duplicate
        </button>
        <button on:click={() => deletePage(contextMenuPage ?? selectedPages[0])}>Delete</button>
      </div>
    </div>
  {/if}

  <div class="outline-list">
    {#if !pages.length}
      <div class="empty">{$_('No pages to show.')}</div>
    {:else}
      {#each pages as page, index (page.index)}
        <div
          class="outline-item {page.index === activePageIndex ? 'active' : ''} {page.hidden
            ? 'hidden'
            : ''} {dragOverIndex === index ? 'drag-over' : ''} {selectedPageIndexes.includes(
            page.index
          )
            ? 'selected'
            : ''}"
          draggable={!!page.nodePos}
          on:dragstart={() => handleDragStart(index)}
          on:dragover={(event) => handleDragOver(event, index)}
          on:drop={(event) => handleDrop(event, index)}
          on:contextmenu={(event) => setContextMenu(page, event)}
          on:click={(event) => {
            updateSelection(page, event)
            scrollToPage(page)
          }}
        >
          <div class="thumbnail {page.type}">
            {#if thumbnailCache[page.index]}
              <img src={thumbnailCache[page.index]} alt={page.label} />
            {:else}
              <div class="thumb-label">{page.label}</div>
              <div class="thumb-type">{page.type}</div>
            {/if}
          </div>
          <div class="meta">
            <div class="label">{page.label}</div>
            <div class="badge-row">
              <span class="badge">{page.type}</span>
              {#if page.hidden}
                <span class="badge warning">{$_('Hidden')}</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<ContextMenuWidget
  __x={contextMenuX}
  __y={contextMenuY}
  bind:__show={contextMenuVisible}
  __menuItems={buildOutlineMenuItems()}
/>

<style>
  .outline-pane {
    @apply flex flex-col h-full text-[var(--color-base-content)] border-r border-white/10;
    background: var(--theme-surface-1);
  }

  .outline-header {
    @apply px-4 py-3 border-b border-white/10 flex items-center justify-between;
  }

  .outline-header .title {
    @apply text-xs font-bold uppercase tracking-widest text-[var(--color-base-content)]/70;
  }

  .outline-header .subtitle {
    @apply text-[10px] text-[var(--color-base-content)]/40;
  }

  .outline-toolbar {
    @apply px-4 py-2 border-b border-white/10 flex items-center justify-between gap-3;
    background: var(--theme-surface-2);
  }

  .selection-count {
    @apply text-[10px] uppercase tracking-widest text-[var(--color-base-content)]/50 font-semibold;
  }

  .toolbar-actions {
    @apply flex gap-2;
  }

  .toolbar-actions button {
    @apply text-[10px] uppercase px-3 py-1 rounded-full border border-white/10 text-[var(--color-base-content)]/70 hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)];
  }

  .outline-list {
    @apply flex-1 overflow-y-auto px-3 py-3 space-y-2 custom-scrollbar;
  }

  .empty {
    @apply text-xs text-[var(--color-base-content)]/40 px-2 py-4;
  }

  .outline-item {
    @apply flex gap-3 p-2 rounded-lg border border-transparent bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] cursor-pointer transition-colors;
  }

  .outline-item:hover {
    @apply bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] border-white/10;
  }

  .outline-item.active {
    @apply bg-primary/20 border-primary/40;
  }

  .outline-item.selected {
    @apply border-primary/60 bg-primary/15;
  }

  .outline-item.hidden {
    @apply opacity-60;
  }

  .outline-item.drag-over {
    @apply border-primary/70 bg-primary/10;
  }

  .thumbnail {
    @apply w-16 h-10 rounded-md border border-white/10 flex flex-col items-center justify-center text-[9px] uppercase tracking-wider overflow-hidden;
    background: var(--theme-surface-2);
  }

  .thumbnail.slide {
    @apply bg-gradient-to-br from-[#1f2937] to-[#111827] text-[var(--color-base-content)]/80;
  }

  .thumbnail.design {
    @apply bg-gradient-to-br from-[#1f1f2e] to-[#14141d];
  }

  .thumbnail.sheet {
    @apply bg-gradient-to-br from-[#13301e] to-[#0f2016];
  }

  .thumbnail.chart {
    @apply bg-gradient-to-br from-[#1b2540] to-[#111827];
  }

  .thumbnail.text {
    background: var(--theme-elevated);
  }

  .thumb-label {
    @apply font-semibold;
  }

  .thumb-type {
    @apply text-[8px] text-[var(--color-base-content)]/50;
  }

  .thumbnail img {
    @apply w-full h-full object-cover block;
  }

  .meta {
    @apply flex flex-col justify-center flex-1;
  }

  .label {
    @apply text-[12px] font-semibold text-[var(--color-base-content)]/90;
  }

  .badge-row {
    @apply flex gap-2 mt-1;
  }

  .badge {
    @apply text-[9px] uppercase px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-[var(--color-base-content)]/60;
  }

  .badge.warning {
    @apply bg-yellow-500/20 text-yellow-300;
  }

  .outline-context-menu {
    @apply fixed z-[9999] border border-white/10 rounded-md shadow-xl flex flex-col p-2 min-w-[180px];
    background: var(--theme-popover-bg);
  }

  .outline-context-menu button {
    @apply text-left text-xs px-2 py-1.5 rounded hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-[var(--color-base-content)]/80;
  }

  .outline-context-menu .divider {
    @apply h-px bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] my-1;
  }
</style>
