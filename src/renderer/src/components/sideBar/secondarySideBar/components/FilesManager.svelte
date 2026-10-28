<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { get } from 'svelte/store'
  import Utils from '../../../../utils/Utils'
  import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../../stores/editor.store'
  import {
    CustomFileExtensionProps,
    CustomFolderExtensionProps
  } from '../../../../extensions/tiptap/CustomFileFolderExtension/utils/common.utils'
  import { CustomFileIncludeExtensionProps } from '../../../../extensions/tiptap/CustomFileIncludeExtension/utils/common.utils'
  import { CustomImageExtensionProps } from '../../../../extensions/tiptap/CustomImageExtension/utils/common.utils'
  import { CustomGalleryExtensionProps } from '../../../../extensions/tiptap/CustomGalleryExtension/utils/common.utils'
  import { CustomSpreadsheetExtensionProps } from '../../../../extensions/tiptap/CustomSpreadsheetExtension/utils/common.utils'
  import { CustomWebviewExtensionProps } from '../../../../extensions/tiptap/CustomWebviewExtension/utils/utils'
import { nodeApi } from '../../../../utils/shims/node'
import { toLocalPath } from '../../../../utils/assetUrl'

  // --- Props & State (Svelte 5) ---
  let { files = $bindable([]) } = $props()

  let selection = $state(new Set())
  let searchQuery = $state('')
  let showMissingOnly = $state(false)
  let groupByType = $state(true)
  let showUnused = $state(false)
  let typeFilter = $state<
    'all' | 'image' | 'video' | 'audio' | Utils.FILE_TYPES.pdf | 'folder' | 'spreadsheet' | 'web' | 'file'
  >('all')

  type AssetEntry = {
    id: string
    name: string
    path: string
    type: string
    size: string
    sizeBytes: number
    status: 'linked' | 'embedded' | 'missing'
    usage: number
    sourceType: string
    page?: number
    section?: string
  }

//   const nodeApi =
//     typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
//   const fs = nodeApi?.fs
//   const path = nodeApi?.path
//   const nodeApi.path = window.api.node?.path

  let documentAssets = $state<AssetEntry[]>([])
  let unusedAssets = $state<AssetEntry[]>([])
  let lastHash = $state('')
  let listContainer: HTMLDivElement | null = null
  let scrollTop = $state(0)
  let viewportHeight = $state(0)

  let filteredAssets = $derived(
    documentAssets.filter((a) => {
      if (showMissingOnly && a.status !== 'missing') return false
      if (typeFilter !== 'all' && a.type !== typeFilter) return false
      return a.name.toLowerCase().includes(searchQuery.toLowerCase())
    })
  )

  const totalBytes = $derived(
    documentAssets.reduce((sum, asset) => sum + (asset.sizeBytes || 0), 0)
  )
  const missingCount = $derived(documentAssets.filter((a) => a.status === 'missing').length)

  function groupAssets(items: AssetEntry[]) {
    const grouped: Record<string, AssetEntry[]> = {}
    for (const asset of items) {
      if (!grouped[asset.type]) grouped[asset.type] = []
      grouped[asset.type].push(asset)
    }
    return grouped
  }

  const groupedAssets = $derived(
    groupByType ? groupAssets(filteredAssets) : { all: filteredAssets }
  )

  type RenderRow =
    | { kind: 'group'; key: string; label: string; height: number }
    | { kind: 'asset'; key: string; asset: AssetEntry; height: number }

  const groupRowHeight = 22
  const assetRowHeight = 34

  const flatRows = $derived.by(() => {
    const rows: RenderRow[] = []
    Object.entries(groupedAssets).forEach(([group, assets]) => {
      if (groupByType) {
        rows.push({ kind: 'group', key: `group:${group}`, label: group, height: groupRowHeight })
      }
      assets.forEach((asset) => {
        rows.push({ kind: 'asset', key: asset.id, asset, height: assetRowHeight })
      })
    })

    if (showUnused && unusedAssets.length) {
      rows.push({
        kind: 'group',
        key: 'group:unused',
        label: 'Unused Assets',
        height: groupRowHeight
      })
      unusedAssets.forEach((asset) => {
        rows.push({ kind: 'asset', key: asset.id, asset, height: assetRowHeight })
      })
    }

    return rows
  })

  // 1. Memoized Layout: Only recalculates when flatRows structure changes
  const listMetrics = $derived.by(() => {
    const rows = flatRows
    const offsets = new Float32Array(rows.length)
    let totalHeight = 0

    for (let i = 0; i < rows.length; i++) {
      offsets[i] = totalHeight
      totalHeight += rows[i].height
    }

    return { offsets, totalHeight }
  })

  // 2. Render State: Recalculates ONLY on scroll/viewport change, uses binary search
  const virtualState = $derived.by(() => {
    const rows = flatRows
    const { offsets, totalHeight } = listMetrics
    const safeViewport = viewportHeight > 0 ? viewportHeight : 360
    const overscan = 6

    // Binary Search to find start index (O(log n))
    let low = 0
    let high = rows.length - 1
    let startIndex = 0

    const startOffset = Math.max(0, scrollTop - overscan * assetRowHeight)

    while (low <= high) {
      const mid = (low + high) >>> 1 // Unsigned right shift for performance
      if (offsets[mid] <= startOffset) {
        startIndex = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    // Determine endIndex
    const endOffset = scrollTop + safeViewport + overscan * assetRowHeight
    let endIndex = startIndex
    while (endIndex < rows.length && offsets[endIndex] < endOffset) {
      endIndex++
    }

    return {
      visible: rows.slice(startIndex, endIndex),
      paddingTop: offsets[startIndex] ?? 0,
      paddingBottom: Math.max(0, totalHeight - (offsets[endIndex] ?? totalHeight)),
      totalHeight
    }
  })

  const activeDocStore = _$_documentEditorsList.getActive()
  const activeDoc = $derived($activeDocStore)
  const activeWysiwygStore = _$_wysiwygEditorsList.getActive()
  const activeWysiwyg = $derived($activeWysiwygStore)
  const activeEditor = $derived(
    activeWysiwyg?.editor || (activeDoc?.id ? _$_wysiwygEditorsList.getItem(activeDoc.id) : null)
  )

  function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '—'
    const units = ['B', 'KB', 'MB', 'GB']
    let value = bytes
    let idx = 0
    while (value >= 1024 && idx < units.length - 1) {
      value /= 1024
      idx += 1
    }
    return `${value.toFixed(value < 10 && idx > 0 ? 1 : 0)} ${units[idx]}`
  }

  function normalizePath(raw: string) {
    if (!raw) return ''
    let cleaned = raw.trim()
    if (/^https?:\/\//i.test(cleaned)) return cleaned
    cleaned = toLocalPath(cleaned)
    if (/^\/[A-Za-z]:[\\/]/.test(cleaned)) {
      cleaned = cleaned.slice(1)
    }
    if (nodeApi.path?.normalize) cleaned = nodeApi.path.normalize(cleaned)
    return cleaned
  }

  function detectType(filePath: string, sourceType: string) {
    if (sourceType === 'folder' || sourceType === 'gallery') return 'folder'
    if (sourceType === 'webview') return 'web'
    if (!filePath) return 'file'
    if (/^https?:\/\//i.test(filePath)) return 'web'
    const ext = nodeApi.path?.extname(filePath).toLowerCase() || ''
    if (ext === '.pdf') return Utils.FILE_TYPES.pdf
    if (Object.values(Utils.IMAGE_EXTENSIONS).includes(ext)) return 'image'
    if (Object.values(Utils.VIDEO_EXTENSIONS).includes(ext)) return 'video'
    if (Object.values(Utils.AUDIO_EXTENSIONS).includes(ext)) return 'audio'
    if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') return 'spreadsheet'
    return 'file'
  }

  async function computeStatus(filePath: string) {
    if (!filePath) return 'missing'
    if (/^https?:\/\//i.test(filePath)) return 'linked'
    if (!(await nodeApi.fsPromises?.exists(filePath))) return 'missing'
    const cachePath = activeDoc?.document?.cachePath
    if (cachePath && filePath.startsWith(cachePath)) return 'embedded'
    return 'linked'
  }

  function getAttrCI(node: any, keys: string[]) {
    const attrs = node?.attrs || {}
    for (const key of keys) {
      if (attrs[key] != null) return attrs[key]
      const lower = key.toLowerCase()
      if (attrs[lower] != null) return attrs[lower]
      const upper = key.toUpperCase()
      if (attrs[upper] != null) return attrs[upper]
    }
    return ''
  }

  function addOrUpdateAsset(map: Map<string, AssetEntry>, entry: Omit<AssetEntry, 'usage' | 'id'>) {
    const key = entry.path
    const existing = map.get(key)
    if (existing) {
      existing.usage += 1
      if (entry.page && (!existing.page || entry.page < existing.page)) {
        existing.page = entry.page
      }
      if (entry.section && !existing.section) {
        existing.section = entry.section
      }
      return
    }
    map.set(key, {
      id: `${entry.sourceType}:${key}`,
      usage: 1,
      ...entry
    })
  }

  async function buildAssetFromMeta(entry: any, meta: any) {
    const pathValue = entry.path
    const status = meta?.status || (await computeStatus(pathValue))
    const sizeBytes = meta?.sizeBytes || 0
    const size = sizeBytes ? formatBytes(sizeBytes) : meta?.isDir ? 'Folder' : '—'
    return {
      id: entry.id,
      name: entry.name,
      path: pathValue,
      type: detectType(pathValue, entry.sourceType),
      size,
      sizeBytes,
      status,
      usage: entry.usage,
      sourceType: entry.sourceType,
      page: entry.page,
      section: entry.section
    } satisfies AssetEntry
  }

  async function getRawEntries() {
    const assetsMap = new Map<string, any>()
    const editor = activeEditor

    if (editor) {
      const pageBreakNames = new Set(['page_break', 'page-break', 'pageBreak'])
      let currentPage = 1
      let currentSection = ''

      editor.state.doc.descendants((node) => {
        if (pageBreakNames.has(node.type?.name)) {
          currentPage += 1
          return true
        }

        if (node.type?.name === 'heading') {
          const text = node.textContent?.trim()
          if (text) currentSection = text
        }

        const typeName = node.type?.name
        let rawPath = ''
        let sourceType = ''

        if (typeName === CustomFileIncludeExtensionProps.name) {
          rawPath = getAttrCI(node, ['sourcePath', 'sourcepath'])
          sourceType = 'include'
        } else if (typeName === CustomFileExtensionProps.name) {
          rawPath = getAttrCI(node, ['src'])
          sourceType = 'file'
        } else if (typeName === CustomFolderExtensionProps.name) {
          rawPath = getAttrCI(node, ['src'])
          sourceType = 'folder'
        } else if (typeName === CustomImageExtensionProps.name) {
          rawPath = getAttrCI(node, ['src'])
          sourceType = 'image'
        } else if (typeName === CustomGalleryExtensionProps.name) {
          rawPath = getAttrCI(node, ['src'])
          sourceType = 'gallery'
        } else if (typeName === CustomSpreadsheetExtensionProps.name) {
          rawPath = getAttrCI(node, ['src'])
          sourceType = 'spreadsheet'
        } else if (typeName === CustomWebviewExtensionProps.name) {
          rawPath = getAttrCI(node, ['src'])
          sourceType = 'webview'
        }

        if (!rawPath) return true
        const normalized = normalizePath(rawPath)
        if (!normalized) return true

        const name = nodeApi.path?.basename(normalized) || normalized
        const key = normalized
        const existing = assetsMap.get(key)
        if (existing) {
          existing.usage += 1
          if (currentPage && (!existing.page || currentPage < existing.page)) {
            existing.page = currentPage
          }
          if (currentSection && !existing.section) {
            existing.section = currentSection
          }
          return true
        }

        assetsMap.set(key, {
          id: `${sourceType}:${key}`,
          name,
          path: normalized,
          usage: 1,
          sourceType,
          page: currentPage,
          section: currentSection || undefined
        })

        return true
      })
    } else {
      const mainPath = activeDoc?.document?.getMainFilePath?.(false)
      if (mainPath && (await nodeApi.fsPromises?.exists(mainPath))) {
        try {
          const html = await nodeApi.fsPromises?.readFile(mainPath, 'utf8')
          const doc = new DOMParser().parseFromString(html, 'text/html')
          const selectors = ['file', 'folder', 'include', 'img', 'gallery', 'sheet', 'webpage']
          doc.querySelectorAll(selectors.join(',')).forEach((el) => {
            const tag = el.tagName.toLowerCase()
            let rawPath = ''
            let sourceType = ''
            if (tag === 'include') {
              rawPath = el.getAttribute('sourcepath') || el.getAttribute('sourcePath') || ''
              sourceType = 'include'
            } else if (tag === 'folder') {
              rawPath = el.getAttribute('src') || ''
              sourceType = 'folder'
            } else if (tag === 'file') {
              rawPath = el.getAttribute('src') || ''
              sourceType = 'file'
            } else if (tag === 'img') {
              rawPath = el.getAttribute('src') || ''
              sourceType = 'image'
            } else if (tag === 'gallery') {
              rawPath = el.getAttribute('src') || ''
              sourceType = 'gallery'
            } else if (tag === 'sheet') {
              rawPath = el.getAttribute('src') || ''
              sourceType = 'spreadsheet'
            } else if (tag === 'webpage') {
              rawPath = el.getAttribute('src') || ''
              sourceType = 'webview'
            }
            if (!rawPath) return
            const normalized = normalizePath(rawPath)
            if (!normalized) return
            const name = nodeApi.path?.basename(normalized) || normalized
            const key = normalized
            const existing = assetsMap.get(key)
            if (existing) {
              existing.usage += 1
              return
            }
            assetsMap.set(key, {
              id: `${sourceType}:${key}`,
              name,
              path: normalized,
              usage: 1,
              sourceType
            })
          })
        } catch {
          // ignore
        }
      }
    }

    return Array.from(assetsMap.values())
  }

  async function performSync() {
    const entries = await getRawEntries()
    const rawPaths = entries.map((entry) => entry.path)
    const hash = JSON.stringify({
      paths: rawPaths,
      usage: entries.map((e) => e.usage),
      pages: entries.map((e) => e.page || 0),
      sections: entries.map((e) => e.section || ''),
      includeUnused: showUnused
    })
    if (hash === lastHash) return
    lastHash = hash

    const cachePath = activeDoc?.document?.cachePath
    const syncAssets = window.api?.syncAssets
    const response = syncAssets
      ? await syncAssets({
          paths: rawPaths,
          cachePath,
          includeUnused: showUnused
        })
      : { items: entries, unused: [] }

    const items = Array.isArray(response) ? response : response?.items || []
    const unused = Array.isArray(response) ? [] : response?.unused || []
    const metaMap = new Map(items.map((item) => [item.path, item]))

    documentAssets = await Promise.all(
      entries.map(async (entry) => buildAssetFromMeta(entry, metaMap.get(entry.path)))
    )
    documentAssets.sort((a, b) => a.name.localeCompare(b.name))

    unusedAssets = unused.map((item: any) => {
      const name = nodeApi.path?.basename(item.path) || item.path
      const sizeBytes = item.sizeBytes || 0
      return {
        id: `unused:${item.path}`,
        name,
        path: item.path,
        type: detectType(item.path, 'file'),
        size: sizeBytes ? formatBytes(sizeBytes) : '—',
        sizeBytes,
        status: 'embedded',
        usage: 0,
        sourceType: 'unused'
      }
    })
  }

  function scheduleSync() {
    const idle = (window as any).requestIdleCallback
    if (idle) {
      idle(() => performSync(), { timeout: 1000 })
    } else {
      setTimeout(() => performSync(), 250)
    }
  }

  $effect(() => {
    scheduleSync()
    const editor = activeEditor
    if (!editor) return

    let disposed = false
    let timer: any = null

    const handler = () => {
      if (disposed) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => scheduleSync(), 120)
    }

    editor.on?.('update', handler)
    editor.on?.('transaction', handler)

    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
      editor.off?.('update', handler)
      editor.off?.('transaction', handler)
    }
  })

  $effect(() => {
    if (!listContainer) return
    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        viewportHeight = listContainer?.clientHeight || 0
      })
      resizeObserver.observe(listContainer)
    }
    viewportHeight = listContainer.clientHeight || 0
    return () => resizeObserver?.disconnect()
  })

  // --- Handlers ---
  function toggleSelect(id: string, event: MouseEvent) {
    if (event.ctrlKey || event.metaKey) {
      if (selection.has(id)) selection.delete(id)
      else selection.add(id)
    } else {
      selection.clear()
      selection.add(id)
    }
  }

  function deleteSelected() {
    documentAssets = documentAssets.filter((a) => !selection.has(a.id))
    selection.clear()
  }

  async function revealAsset(asset: AssetEntry) {
    if (!asset?.path) return
    const target = (await nodeApi.fsPromises?.exists(asset.path))
      ? asset.type === 'folder'
        ? asset.path
        : nodeApi.path?.dirname(asset.path)
      : asset.path
    if (target) await window.api.openFile(target)
  }

  async function openAsset(asset: AssetEntry) {
    if (!asset?.path) return
    await window.api.openFile(asset.path)
  }

  function copyPath(asset: AssetEntry) {
    if (!asset?.path) return
    window.api?.clipboard?.writeText?.(asset.path)
  }

  async function relinkAsset(asset: AssetEntry) {
    if (!asset?.path) return
    const newPath = await window.api.openDialogFile()
    if (!newPath) return
    const editor = activeDoc?.id ? _$_wysiwygEditorsList.getItem(activeDoc.id) : null
    if (!editor) return

    const oldPath = normalizePath(asset.path)
    const tr = editor.state.tr

    editor.state.doc.descendants((node, pos) => {
      const typeName = node.type?.name
      let attrKey: 'src' | 'sourcePath' | null = null

      if (typeName === CustomFileIncludeExtensionProps.name) attrKey = 'sourcePath'
      else if (
        typeName === CustomFileExtensionProps.name ||
        typeName === CustomFolderExtensionProps.name ||
        typeName === CustomImageExtensionProps.name ||
        typeName === CustomGalleryExtensionProps.name
      )
        attrKey = 'src'

      if (!attrKey) return true
      const current = normalizePath(node.attrs?.[attrKey] || '')
      if (current === oldPath) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, [attrKey]: newPath })
      }
      return true
    })

    if (tr.docChanged) editor.view.dispatch(tr)
    scheduleCollect()
  }
</script>

<div
  class="files-manager h-full flex flex-col bg-base-200 text-base-content/80 font-sans select-none overflow-hidden border-l border-base-content/10"
>
  <header class="files-header flex flex-col bg-base-300/60 border-b border-base-content/10">
    <div class="flex items-center justify-between px-3 py-2">
      <div class="flex items-center gap-2">
        <i class={'ph-bold i-icon ph-folder-open text-primary text-[14px]'}></i>
        <span class="text-[10px] font-bold uppercase tracking-widest text-base-content"
          >{$_('Document Assets')}</span
        >
      </div>
      <div class="flex gap-1">
        <button class="theme-icon-btn" title={$_('Upload File')}
          ><i class={'ph-bold i-icon ph-plus'}></i></button
        >
        <button
          class="theme-icon-btn {showMissingOnly ? 'text-yellow-400' : ''}"
          onclick={() => (showMissingOnly = !showMissingOnly)}
          title={$_('Toggle Missing')}
        >
          <i class={'ph-bold i-icon ph-warning-circle'}></i>
        </button>
        <button
          class="theme-icon-btn {groupByType ? 'text-primary' : ''}"
          onclick={() => (groupByType = !groupByType)}
          title={$_('Toggle Grouping')}
        >
          <i class={'ph-bold i-icon ph-stack'}></i>
        </button>
        <button
          class="theme-icon-btn {showUnused ? 'text-primary' : ''}"
          onclick={() => (showUnused = !showUnused)}
          title={$_('Toggle Unused Assets')}
        >
          <i class={'ph-bold i-icon ph-trash-simple'}></i>
        </button>
        <button
          class="theme-icon-btn"
          onclick={deleteSelected}
          disabled={selection.size === 0}
          title={$_('Delete')}
        >
          <i class={'ph-bold i-icon ph-trash text-red-500'}></i>
        </button>
      </div>
    </div>

    <div class="px-2 pb-2">
      <div
        class="relative flex items-center bg-base-100 border border-[#3e3e3e] rounded-sm px-2 h-6 focus-within:border-primary"
      >
        <i class={'ph-bold i-icon ph-magnifying-glass text-[12px] opacity-40'}></i>
        <input
          bind:value={searchQuery}
          placeholder={$_('Filter assets...')}
          class="bg-transparent border-none outline-none text-[11px] w-full pl-2 text-base-content"
        />
      </div>
    </div>
  </header>

  <div
    class="files-list flex-grow overflow-y-auto custom-scrollbar bg-base-100"
    bind:this={listContainer}
    onscroll={() => (scrollTop = listContainer?.scrollTop || 0)}
  >
    <div
      class="files-table-header flex items-center px-3 py-1 bg-base-300/55 border-b border-base-content/10 text-[9px] font-bold uppercase text-base-content/40"
    >
      <span class="w-8"></span>
      <span class="flex-grow">{$_('Name')}</span>
      <span class="w-16">{$_('Page')}</span>
      <span class="w-16">{$_('Status')}</span>
      <span class="w-12 text-right">{$_('Usage')}</span>
    </div>

    <div
      style={`padding-top: ${virtualState.paddingTop}px; padding-bottom: ${virtualState.paddingBottom}px;`}
    >
      {#each virtualState.visible as row (row.key)}
        {#if row.kind === 'group'}
          <div
            class="px-3 py-1 text-[9px] uppercase tracking-widest text-base-content/40 border-b border-base-content/10"
          >
            {row.label}
          </div>
        {:else if row.asset}
          <div
            role="button"
            tabindex="0"
            onclick={(e) => toggleSelect(row.asset.id, e)}
            class="flex items-center px-3 py-1.5 border-b border-[#252525] transition-colors group
                    {selection.has(row.asset.id) ? 'bg-primary text-primary-content' : 'hover:bg-base-content/5'}"
          >
            <div class="w-8">
              {#if row.asset.type === Utils.FILE_TYPES.pdf}
                <i class={'ph-light i-icon ph-file-pdf text-red-400'}></i>
              {:else if row.asset.type === 'image'}
                <i class={'ph-light i-icon ph-image text-blue-400'}></i>
              {:else if row.asset.type === 'video'}
                <i class={'ph-light i-icon ph-video text-purple-400'}></i>
              {:else if row.asset.type === 'audio'}
                <i class={'ph-light i-icon ph-music-note text-green-400'}></i>
              {:else if row.asset.type === 'folder'}
                <i class={'ph-light i-icon ph-folder text-yellow-400'}></i>
              {:else if row.asset.type === 'spreadsheet'}
                <i class={'ph-light i-icon ph-microsoft-excel-logo text-emerald-400'}></i>
              {:else if row.asset.type === 'web'}
                <i class={'ph-light i-icon ph-globe text-cyan-400'}></i>
              {:else}
                <i class={'ph-light i-icon ph-file-text text-gray-400'}></i>
              {/if}
            </div>

            <div class="flex-grow flex flex-col overflow-hidden">
              <span class="text-[11px] truncate">{row.asset.name}</span>
              <span class="text-[9px] opacity-50"
                >{row.asset.size}{row.asset.section ? ` · ${row.asset.section}` : ''}</span
              >
            </div>

            <div class="w-16 text-[9px] text-base-content/50">
              {row.asset.page ? `P.${row.asset.page}` : '—'}
            </div>

            <div class="w-16 flex items-center">
              {#if row.asset.status === 'missing'}
                <i class={'ph-bold i-icon ph-warning-circle text-yellow-500'} title={$_('Missing Link')}
                ></i>
              {:else if row.asset.status === 'linked'}
                <i class={'ph-bold i-icon ph-link text-green-500'} title={$_('Linked File')}></i>
              {:else}
                <i class={'ph-bold i-icon ph-package text-blue-400'} title={$_('Embedded')}></i>
              {/if}
            </div>

            <div class="w-12 text-right">
              <span
                class="px-1.5 py-0.5 rounded-full bg-base-content/10 group-hover:bg-base-content/15 text-[9px] font-bold"
              >
                {row.asset.usage}
              </span>
            </div>

            <div class="absolute right-2 hidden group-hover:flex items-center gap-1">
              <button
                class="p-1 bg-base-200 border border-base-content/15 rounded-sm hover:text-base-content"
                title={$_('Open')}
                onclick={() => openAsset(row.asset)}
              >
                <i class={'ph-bold i-icon ph-arrow-square-out text-[10px]'}></i>
              </button>
              <button
                class="p-1 bg-base-200 border border-base-content/15 rounded-sm hover:text-base-content"
                title={$_('Reveal in Folder')}
                onclick={() => revealAsset(row.asset)}
              >
                <i class={'ph-bold i-icon ph-folder-open text-[10px]'}></i>
              </button>
              <button
                class="p-1 bg-base-200 border border-base-content/15 rounded-sm hover:text-base-content"
                title={$_('Copy Path')}
                onclick={() => copyPath(row.asset)}
              >
                <i class={'ph-bold i-icon ph-copy text-[10px]'}></i>
              </button>
              <button
                class="p-1 bg-base-200 border border-base-content/15 rounded-sm hover:text-base-content"
                title={$_('Relink')}
                onclick={() => relinkAsset(row.asset)}
              >
                <i class={'ph-bold i-icon ph-arrows-left-right text-[10px]'}></i>
              </button>
            </div>
          </div>
        {/if}
      {/each}
    </div>
  </div>

  <footer
    class="files-footer p-2 bg-base-300/55 border-t border-base-content/10 flex justify-between items-center text-[9px] font-bold uppercase text-base-content/45"
  >
    <span>{documentAssets.length} Assets · {formatBytes(totalBytes)}</span>
    <div class="flex gap-3">
      <span class="flex items-center gap-1">
        <i class={'ph-light ph-circle text-green-500 text-[6px]'}></i>
        {documentAssets.filter((a) => a.status !== 'missing').length} OK
      </span>
      <span class="flex items-center gap-1">
        <i class={'ph-light ph-circle text-yellow-500 text-[6px]'}></i>
        {missingCount} MISSING
      </span>
    </div>
  </footer>
</div>

<style lang="postcss">
  .theme-icon-btn {
    @apply p-1 hover:bg-[var(--color-base-100)]/10 rounded-sm transition-colors text-[var(--color-base-content)]/65 hover:text-[var(--color-base-content)] disabled:opacity-20;
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(var(--theme-text-rgb), 0.24);
    border-radius: 2px;
  }

  @media (max-width: 768px) {
    .files-manager {
      border-left: 0;
    }
    .files-header .theme-icon-btn {
      padding: 6px;
    }
    .files-table-header {
      display: none;
    }
    .files-list .flex.items-center {
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 6px;
      padding: 10px 12px;
    }
    .files-list .w-16,
    .files-list .w-12 {
      width: auto;
      text-align: left;
    }
    .files-footer {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }
  }

  @media (max-width: 480px) {
    .files-list .absolute.right-2 {
      position: static;
      margin-left: auto;
      display: flex !important;
      gap: 6px;
    }
  }
</style>
