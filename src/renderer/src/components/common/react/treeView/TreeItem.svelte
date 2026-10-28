<script lang="ts">
  import Utils from '../../../../utils/Utils'
  import { _ } from 'svelte-i18n'
  import { slide } from 'svelte/transition'
  import { createEventDispatcher, onMount } from 'svelte'

  type FileNode = {
    name: string
    path: string
    isFolder: boolean
    displayName?: string
    isMainFile?: boolean
    isAssetFile?: boolean
    isDocumentContent?: boolean
    isLocked?: boolean
    ephemeralMeta?: {
      deadlineAt: string
      readsLeft?: number | null
      writesLeft?: number | null
    } | null
    shareMeta?: {
      shareId?: string
      link?: string
      role?: string
      publicRole?: string
      checked?: boolean
    }
  }
  type InlineInputMode = 'rename' | 'create-file' | 'create-folder' | 'add-locale' | 'define-var'
  type InlineInputState = {
    mode: InlineInputMode
    parentPath: string
    targetPath?: string
    value: string
    placeholder?: string
  }

  // Props
  let {
    item,
    level = 0,
    expandedPaths,
    selectedPath,
    selectedPaths,
    nowTick = Date.now(),
    refreshTick = 0,
    inlineInput = null,
    excludeExt = [],
    displayHiddenFiles = false,
    readDirHandler = null,
    allowDragDrop = true,
    dragOverPath = null,
    dropPlacement = 'before',
    dropBlocked = false,
    selectionMode = 'single'
  } = $props<{
    item: FileNode
    level?: number
    expandedPaths: Set<string>
    selectedPath: string
    selectedPaths: Set<string>
    nowTick?: number
    refreshTick?: number
    inlineInput?: InlineInputState | null
    excludeExt?: string[]
    displayHiddenFiles?: boolean
    readDirHandler?:
      | ((dirPath: string, options?: Record<string, any>) => Promise<FileNode[]>)
      | null
    allowDragDrop?: boolean
    dragOverPath?: string | null
    dropPlacement?: 'before' | 'after'
    dropBlocked?: boolean
    /** 'single' = default open-on-click; 'multi' = checkbox toggle mode for files */
    selectionMode?: 'single' | 'multi'
  }>()

  const dispatch = createEventDispatcher()
  let inlineInputEl = $state<HTMLInputElement | null>(null)
  let inlineValue = $state('')
  let blurTimer: ReturnType<typeof setTimeout> | null = null
  let isDragOver = $state(false)
  let isHovered = $state(false)
  let children = $state<FileNode[]>([])
  let childrenLoading = $state(false)
  let childrenError = $state(false)
  let lastChildrenLoadKey = $state('')

  // Derived state
  let isExpanded = $derived(expandedPaths.has(item.path))
  let isSelected = $derived(selectedPaths?.has(item.path) || selectedPath === item.path)
  let isSecured = $derived(
    item.name.endsWith(Utils.DYNADOC_EXTENSIONS.secured) ||
      item.name.endsWith(Utils.DYNADOC_EXTENSIONS.default)
  )
  let isAssetFile = $derived(Boolean(item.isAssetFile))
  let isDocumentContent = $derived(Boolean(item.isDocumentContent))
  let isLocked = $derived(Boolean(item.isLocked))
  let displayName = $derived(item.displayName ?? item.name)
  let fileExtension = $derived.by(() => {
    const name = (item?.name || '').toLowerCase()
    const idx = name.lastIndexOf('.')
    if (idx <= 0) return ''
    return name.slice(idx)
  })
  let fileIconClass = $derived.by(() => {
    if (item.isFolder) return 'ph-folder'
    if (isSecured) return 'ph-shield-checkered text-primary'
    if (isAssetFile) return 'ph-file-code text-amber-300'

    const ext = fileExtension
    if (['.doc', Utils.OFFICE_EXTENSIONS.word, '.rtf', '.odt', '.txt', '.md'].includes(ext)) {
      return 'ph-file-doc text-sky-300'
    }
    if ([Utils.PDF_EXTENSION].includes(ext)) {
      return 'ph-file-pdf text-rose-300'
    }
    if (['.xls', Utils.OFFICE_EXTENSIONS.excel, '.csv', '.ods'].includes(ext)) {
      return ext === '.csv' ? 'ph-file-csv text-emerald-300' : 'ph-file-xls text-emerald-300'
    }
    if (['.ppt', Utils.OFFICE_EXTENSIONS.powerpoint, '.odp'].includes(ext)) {
      return 'ph-file-ppt text-orange-300'
    }
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif'].includes(ext)) {
      return 'ph-file-image text-amber-300'
    }
    if (['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.aiff'].includes(ext)) {
      return 'ph-file-audio text-violet-300'
    }
    if (['.mp4', '.mov', '.mkv', '.avi', '.webm', '.wmv'].includes(ext)) {
      return 'ph-file-video text-fuchsia-300'
    }
    if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'].includes(ext)) {
      return 'ph-file-zip text-amber-200'
    }
    if (
      [
        '.html',
        '.htm',
        '.css',
        '.js',
        '.ts',
        '.jsx',
        '.tsx',
        '.json',
        '.xml',
        '.yml',
        '.yaml',
        '.toml'
      ].includes(ext)
    ) {
      return 'ph-file-code text-amber-300'
    }
    return 'ph-file text-base-content/50'
  })
  let isInlineRenameTarget = $derived(
    !!inlineInput && inlineInput.mode === 'rename' && inlineInput.targetPath === item.path
  )
  let nameExists = $derived.by(() => {
    if (!inlineInput || !inlineValue.trim()) return false
    const trimmed = inlineValue.trim()
    // For rename, exclude the current item itself if name hasn't changed
    if (inlineInput.mode === 'rename' && trimmed === item.name) return false
    return children.some((child) => child.name.toLowerCase() === trimmed.toLowerCase())
  })

  let isInlineCreateHost = $derived(
    !!inlineInput && inlineInput.mode !== 'rename' && inlineInput.parentPath === item.path
  )
  let showDropIndicator = $derived(dragOverPath === item.path)
  let isDropBlocked = $derived(showDropIndicator && dropBlocked)
  let shareMeta = $derived(item.shareMeta ?? null)
  let shareRoleLabel = $derived.by(() => {
    if (!shareMeta?.shareId) return ''
    const role = String(shareMeta.publicRole || shareMeta.role || '').toLowerCase()
    if (role === 'editor') return $_('EDIT')
    if (role === 'commenter') return $_('COMMENT')
    return $_('VIEW')
  })
  let ephemeralBadge = $derived.by(() => {
    if (!item.ephemeralMeta?.deadlineAt) return null
    const deadline = new Date(item.ephemeralMeta.deadlineAt)
    if (Number.isNaN(deadline.getTime())) return null
    const remaining = deadline.getTime() - nowTick
    if (remaining <= 0) {
      return {
        label: $_('Expired'),
        isExpired: true,
        deadlineLabel: deadline.toLocaleString(),
        tone: 'danger',
        readsLeft: item.ephemeralMeta?.readsLeft ?? null,
        writesLeft: item.ephemeralMeta?.writesLeft ?? null
      }
    }
    const minute = 60_000
    const hour = 60 * minute
    const day = 24 * hour
    const tone = remaining <= hour ? 'danger' : remaining <= day ? 'warning' : 'safe'
    if (remaining < minute) {
      return {
        label: '<1m',
        isExpired: false,
        deadlineLabel: deadline.toLocaleString(),
        tone,
        readsLeft: item.ephemeralMeta?.readsLeft ?? null,
        writesLeft: item.ephemeralMeta?.writesLeft ?? null
      }
    }
    if (remaining < hour) {
      const mins = Math.max(1, Math.round(remaining / minute))
      return {
        label: `${mins}m`,
        isExpired: false,
        deadlineLabel: deadline.toLocaleString(),
        tone,
        readsLeft: item.ephemeralMeta?.readsLeft ?? null,
        writesLeft: item.ephemeralMeta?.writesLeft ?? null
      }
    }
    if (remaining < day) {
      const hours = Math.floor(remaining / hour)
      const mins = Math.floor((remaining % hour) / minute)
      return {
        label: mins ? `${hours}h ${mins}m` : `${hours}h`,
        isExpired: false,
        deadlineLabel: deadline.toLocaleString(),
        tone,
        readsLeft: item.ephemeralMeta?.readsLeft ?? null,
        writesLeft: item.ephemeralMeta?.writesLeft ?? null
      }
    }
    const days = Math.floor(remaining / day)
    const hours = Math.floor((remaining % day) / hour)
    return {
      label: hours ? `${days}d ${hours}h` : `${days}d`,
      isExpired: false,
      deadlineLabel: deadline.toLocaleString(),
      tone,
      readsLeft: item.ephemeralMeta?.readsLeft ?? null,
      writesLeft: item.ephemeralMeta?.writesLeft ?? null
    }
  })

  $effect(() => {
    if (!inlineInput) {
      inlineValue = ''
      return
    }
    if (isInlineRenameTarget || isInlineCreateHost) {
      inlineValue = inlineInput.value ?? ''
      queueMicrotask(() => inlineInputEl?.focus())
      queueMicrotask(() => inlineInputEl?.select())
    }
  })

  function handleClick(e: MouseEvent) {
    if (isInlineRenameTarget) return
    dispatch('select', { item, event: e })
    if (item.isFolder && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      dispatch('toggle', item.path)
    }
  }

  function handleDoubleClick(e: MouseEvent) {
    if (isInlineRenameTarget) return
    dispatch('open', { item, event: e })
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault()
    dispatch('contextmenu', { event: e, item })
  }

  onMount(() => {
    dispatch('nodeinfo', item)
  })

  async function loadChildren() {
    if (!item.isFolder || !isExpanded) return
    const loadKey = `${item.path}::${refreshTick}`
    if (loadKey === lastChildrenLoadKey) return
    lastChildrenLoadKey = loadKey
    childrenLoading = true
    childrenError = false
    try {
      const nextChildren = readDirHandler
        ? await readDirHandler(item.path, { refreshTick })
        : await (window as any).api.readDir(item.path, { refreshTick })
      children = Array.isArray(nextChildren) ? nextChildren : []
    } catch (error) {
      console.error('Tree item directory load failed:', { path: item.path, error })
      children = []
      childrenError = true
    } finally {
      childrenLoading = false
    }
  }

  $effect(() => {
    if (!item.isFolder || !isExpanded) return
    void loadChildren()
  })

  const isFileHidden = (fileName: string): boolean => {
    return fileName.startsWith('.')
  }
  /**
   * Logic to determine if a file should be hidden.
   * In Unix/macOS/Linux, files starting with '.' are hidden.
   */
  /* const isFileVisible = (fileName: string): boolean => {
    // 1. Exclude hidden files (starting with a dot)
    if (fileName.startsWith('.')) return false

    // return fileName.startsWith('.')

    // 2. Exclude specific extensions from thee list
    const hasExcludedExtension = excludeExtensions.some((ext) =>
      fileName.toLowerCase().endsWith(ext.toLowerCase())
    )

    return !hasExcludedExtension
  } */

  function commitInline() {
    if (!inlineInput) return
    dispatch('inlinecommit', {
      mode: inlineInput.mode,
      value: inlineValue,
      parentPath: inlineInput.parentPath,
      targetPath: inlineInput.targetPath,
      item
    })
  }

  function cancelInline() {
    dispatch('inlinecancel')
  }

  function handleDragStart(e: DragEvent) {
    if (!allowDragDrop) return
    e.stopPropagation()
    if (!e.dataTransfer) return
    e.dataTransfer.effectAllowed = 'copyMove'
    e.dataTransfer.setData('application/x-ddoc-tree-item', item.path)
    e.dataTransfer.setData('text/plain', item.path)
    dispatch('dragstart', { event: e, item })
  }

  function handleDragOver(e: DragEvent) {
    if (!allowDragDrop) return
    e.preventDefault()
    e.stopPropagation()
    isDragOver = true
    dispatch('dragover', { event: e, item })
  }

  function handleDragLeave(e: DragEvent) {
    if (!allowDragDrop) return
    e.stopPropagation()
    isDragOver = false
  }

  function handleDrop(e: DragEvent) {
    if (!allowDragDrop) return
    e.preventDefault()
    e.stopPropagation()
    isDragOver = false
    dispatch('drop', { event: e, item })
  }

  function handleQuickRefresh() {
    dispatch('quickrefresh')
  }

  function handleQuickAddFile() {
    dispatch('quickaddfile')
  }

  function handleQuickAddFolder() {
    dispatch('quickaddfolder')
  }

  function handleQuickCollapseAll() {
    dispatch('quickcollapseall')
  }
</script>

<li
  class="list-none select-none"
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
>
  <div class="relative">
    <div
      class="relative group flex items-center h-7 px-2 transition-colors cursor-pointer
           {isDragOver
        ? 'bg-primary/25 border-l-2 border-primary'
        : isSelected
          ? 'bg-primary/20 border-l-2 border-primary'
          : 'hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] border-l-2 border-transparent'}"
      style="padding-left: {level * 12 + 8}px"
      data-tree-path={item.path}
      onclick={handleClick}
      ondblclick={handleDoubleClick}
      oncontextmenu={onContextMenu}
      draggable={allowDragDrop}
      ondragstart={handleDragStart}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
      style:cursor={isDropBlocked ? 'not-allowed' : 'pointer'}
    >
      {#if showDropIndicator}
        <div
          class="absolute left-0 right-0 h-0.5 z-10 pointer-events-none {isDropBlocked
            ? 'bg-red-400'
            : 'bg-primary'}"
          style:top={dropPlacement === 'before' ? '0' : 'auto'}
          style:bottom={dropPlacement === 'after' ? '0' : 'auto'}
          style:left="{level * 12 + 8}px"
          style:right="8px"
        ></div>
      {/if}
      <div class="w-4 flex items-center justify-center mr-1">
        {#if item.isFolder}
          <i
            class="ph-bold text-[10px] text-base-content/40 {isExpanded
              ? 'ph-caret-down'
              : 'ph-caret-right'}"
          ></i>
        {/if}
      </div>

      {#if selectionMode === 'multi' && !item.isFolder}
        <!-- Checkbox shown in multi-select mode for files -->
        <div
          class="w-3.5 h-3.5 border rounded-[3px] shrink-0 flex items-center justify-center text-[9px] mr-1 transition-all duration-100
            {isSelected
            ? 'bg-primary border-primary text-white font-black'
            : 'bg-transparent border-base-content/20'}"
        >
          {#if isSelected}<i class="ph-bold ph-check text-[8px]"></i>{/if}
        </div>
      {/if}

      <div class="mr-2 flex items-center">
        {#if item.isFolder}
          <i
            class="ph-light text-base {isExpanded ? 'ph-folder-open text-primary/80' : 'ph-folder'}"
          ></i>
        {:else}
          <i class="ph-bold text-sm {fileIconClass}"></i>
        {/if}
      </div>

      {#if isInlineRenameTarget}
        <input
          bind:this={inlineInputEl}
          bind:value={inlineValue}
          class="text-[11px] flex-grow bg-base-200 border rounded px-1.5 py-0.5 text-base-content outline-none {nameExists
            ? 'border-rose-500'
            : 'border-primary/50'}"
          onclick={(e) => e.stopPropagation()}
          onmousedown={(e) => e.stopPropagation()}
          onkeydown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') commitInline()
            if (e.key === 'Escape') cancelInline()
          }}
          onblur={() => {
            if (blurTimer) clearTimeout(blurTimer)
            blurTimer = setTimeout(() => commitInline(), 60)
          }}
        />
        {#if nameExists}
          <div
            class="absolute left-0 top-full mt-0.5 z-20 px-1.5 py-0.5 rounded bg-rose-900 border border-rose-500 shadow-xl"
          >
            <span class="text-[9px] text-rose-100 whitespace-nowrap"
              >{$_('Name already exists')}</span
            >
          </div>
        {/if}
      {:else}
        <span
          class="text-[11px] truncate flex-grow {isSelected
            ? 'text-base-content'
            : 'text-base-content/70'}"
        >
          {displayName}
        </span>
      {/if}

      {#if isSecured}
        <span class="text-[8px] font-black text-primary opacity-60 ml-2">{$_('SECURE')}</span>
      {/if}
      {#if isAssetFile}
        <span class="text-[8px] font-black text-amber-300/80 ml-2">{$_('ASSET')}</span>
      {:else if isDocumentContent}
        <span class="text-[8px] font-black text-primary/80 ml-2">{$_('DOC')}</span>
      {/if}
      {#if isLocked}
        <span class="text-[8px] font-black text-rose-300 ml-2">{$_('LOCKED')}</span>
      {/if}
      {#if shareMeta?.shareId}
        <span
          class="ml-2 inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.18em] px-1.5 py-0.5 rounded
          {shareRoleLabel === $_('EDIT')
            ? 'bg-emerald-500/20 text-emerald-200'
            : shareRoleLabel === $_('COMMENT')
              ? 'bg-amber-500/20 text-amber-200'
              : 'bg-sky-500/20 text-sky-200'}"
          title={shareMeta?.link || $_('Shared link')}
        >
          <i class="ph-bold ph-link-simple"></i>
          {shareRoleLabel}
        </span>
      {/if}
      {#if ephemeralBadge}
        <span
          class="text-[8px] font-black ml-2 px-1 py-0.5 rounded
          {ephemeralBadge.tone === 'danger'
            ? 'bg-rose-500/25 text-rose-200'
            : ephemeralBadge.tone === 'warning'
              ? 'bg-amber-500/20 text-amber-200'
              : 'bg-emerald-500/20 text-emerald-200'}"
          title={`${$_('Expires at')}: ${ephemeralBadge.deadlineLabel}${
            typeof ephemeralBadge.readsLeft === 'number'
              ? ` | ${$_('Reads left')}: ${Math.max(0, ephemeralBadge.readsLeft)}`
              : ''
          }${
            typeof ephemeralBadge.writesLeft === 'number'
              ? ` | ${$_('Writes left')}: ${Math.max(0, ephemeralBadge.writesLeft)}`
              : ''
          }`}
        >
          {ephemeralBadge.isExpired ? $_('Expired') : `${ephemeralBadge.label} ${$_('...left')}`}
        </span>
      {/if}
    </div>
    {#if level === 0 && isHovered}
      <div class="ml-2 flex gap-1 absolute top-0 right-0">
        <button class="adobe-tool-btn" title={$_('Refresh')} onclick={handleQuickRefresh}>
          <i class="ph-bold ph-arrow-clockwise"></i>
        </button>
        <button class="adobe-tool-btn" title={$_('Add file')} onclick={handleQuickAddFile}>
          <i class="ph-bold ph-file-plus"></i>
        </button>
        <button class="adobe-tool-btn" title={$_('Add folder')} onclick={handleQuickAddFolder}>
          <i class="ph-bold ph-folder-plus"></i>
        </button>
        <button class="adobe-tool-btn" title={$_('Collapse all')} onclick={handleQuickCollapseAll}>
          <i class="ph-bold ph-arrows-in"></i>
        </button>
      </div>
    {/if}
  </div>

  {#if item.isFolder && isExpanded}
    <ul transition:slide={{ duration: 150 }} class="m-0 p-0">
      {#if isInlineCreateHost}
        <li class="list-none select-none">
          <div
            class="group flex items-center h-7 px-2 transition-colors cursor-text border-l-2 border-primary/50 bg-primary/10"
            style="padding-left: {(level + 1) * 12 + 8}px"
          >
            <div class="w-4 flex items-center justify-center mr-1"></div>
            <div class="mr-2 flex items-center">
              {#if inlineInput?.mode === 'create-folder'}
                <i class="ph-light text-base ph-folder text-primary/90"></i>
              {:else}
                <i class="ph-bold text-sm ph-file-plus text-primary/90"></i>
              {/if}
            </div>
            <input
              bind:this={inlineInputEl}
              bind:value={inlineValue}
              class="text-[11px] flex-grow bg-base-200 border rounded px-1.5 py-0.5 text-base-content outline-none {nameExists
                ? 'border-rose-500'
                : 'border-primary/50'}"
              placeholder={inlineInput?.placeholder || 'Name'}
              onclick={(e) => e.stopPropagation()}
              onmousedown={(e) => e.stopPropagation()}
              onkeydown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') commitInline()
                if (e.key === 'Escape') cancelInline()
              }}
              onblur={() => {
                if (blurTimer) clearTimeout(blurTimer)
                blurTimer = setTimeout(() => commitInline(), 60)
              }}
            />
            {#if nameExists}
              <div
                class="absolute left-0 top-full mt-0.5 z-20 px-1.5 py-0.5 rounded bg-rose-900 border border-rose-500 shadow-xl"
              >
                <span class="text-[9px] text-rose-100 whitespace-nowrap"
                  >{$_('Name already exists')}</span
                >
              </div>
            {/if}
          </div>
        </li>
      {/if}

      {#if childrenLoading}
        <li
          style="padding-left: {(level + 1) * 12 + 24}px"
          class="text-[10px] opacity-40 italic py-1"
        >
          {$_('Loading...')}
        </li>
      {:else if childrenError}
        <li class="text-red-500 text-[10px] pl-8">{$_('Error loading directory')}</li>
      {:else}
        <!-- {#each children.filter((c) => !excludeExt.some((ext) => {
              return c.name.endsWith(ext) && (displayHiddenFiles ? isFileHidden(c.name) : false)
            })) as child} -->

        {#each children.filter((c) => {
          // 1. Check if the extension is in the blacklist
          const isBlacklisted = excludeExt.some((ext) => c.name.endsWith(ext))
          if (isBlacklisted) return false

          // 2. Check if the file is hidden
          const isHidden = isFileHidden(c.name)

          // 3. Logic: If it is hidden AND we are NOT displaying hidden files, filter it out
          if (isHidden && !displayHiddenFiles) return false

          return true // Otherwise, show it
        }) as child}
          <svelte:self
            item={child}
            level={level + 1}
            {expandedPaths}
            {selectedPath}
            {selectedPaths}
            {nowTick}
            {refreshTick}
            {inlineInput}
            {excludeExt}
            {readDirHandler}
            {allowDragDrop}
            {dragOverPath}
            {dropPlacement}
            {dropBlocked}
            {selectionMode}
            on:toggle
            on:select
            on:contextmenu
            on:open
            on:nodeinfo
            on:inlinecommit
            on:inlinecancel
            on:dragstart
            on:dragover
            on:dragleave
            on:drop
          />
        {/each}
      {/if}
    </ul>
  {/if}
</li>

<style>
  .adobe-tool-btn {
    @apply h-6 px-2 rounded text-[10px] flex items-center bg-transparent text-[var(--color-base-content)]/40 
           hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] hover:text-[var(--color-base-content)] transition-all;
  }
</style>
