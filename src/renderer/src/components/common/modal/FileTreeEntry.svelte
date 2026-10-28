<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { nodeApi } from '../../../utils/shims/node'

  // ─── types ────────────────────────────────────────────────────────────────
  export type FileEntry = {
    name: string
    path: string
    isDir: boolean
    ext: string
    children?: FileEntry[] | null
    expanded: boolean
    loading: boolean
    isNew?: boolean
  }

  // ─── props ────────────────────────────────────────────────────────────────
  const {
    entry,
    depth = 0,
    selected,
    inlineCreateTarget,
    inlineCreateValue,
    inlineCreateIsDir,
    renameTarget,
    renameValue,
    dragOverTarget,
    searchQuery,
    onToggleExpand,
    onToggleSelect,
    onStartRename,
    onCommitRename,
    onCancelRename,
    onSetRenameValue,
    onDeleteEntry,
    onStartInlineCreate,
    onCommitInlineCreate,
    onCancelInlineCreate,
    onSetInlineCreateValue,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop
  } = $props<{
    entry: FileEntry
    depth?: number
    selected: Set<string>
    inlineCreateTarget: string | null
    inlineCreateValue: string
    inlineCreateIsDir: boolean
    renameTarget: string | null
    renameValue: string
    dragOverTarget: string | null
    searchQuery: string
    onToggleExpand: (e: FileEntry) => Promise<void>
    onToggleSelect: (e: FileEntry, ev: MouseEvent) => void
    onStartRename: (e: FileEntry, ev: MouseEvent) => void
    onCommitRename: () => Promise<void>
    onCancelRename: () => void
    onSetRenameValue: (v: string) => void
    onDeleteEntry: (e: FileEntry, ev: MouseEvent) => Promise<void>
    onStartInlineCreate: (parentPath: string, isDir: boolean) => void
    onCommitInlineCreate: () => Promise<void>
    onCancelInlineCreate: () => void
    onSetInlineCreateValue: (v: string) => void
    onDragStart: (e: FileEntry) => void
    onDragOver: (e: FileEntry, ev: DragEvent) => void
    onDragLeave: () => void
    onDrop: (e: FileEntry, ev: DragEvent) => Promise<void>
  }>()

  function fileIcon(e: FileEntry): string {
    if (e.isDir) return e.expanded ? 'ph-folder-open' : 'ph-folder'
    const ext = e.ext.toLowerCase()
    if (['.doc', '.docx', '.odt', '.rtf', '.ddoc', '.html'].includes(ext)) return 'ph-file-text'
    if (['.xls', '.xlsx', '.csv', '.ods'].includes(ext)) return 'ph-table'
    if (['.ppt', '.pptx', '.odp'].includes(ext)) return 'ph-presentation-chart'
    if (ext === '.pdf') return 'ph-file-pdf'
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) return 'ph-image'
    if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) return 'ph-video'
    if (['.mp3', '.wav', '.flac'].includes(ext)) return 'ph-music-note'
    if (['.zip', '.tar', '.gz', '.7z'].includes(ext)) return 'ph-file-zip'
    if (['.js', '.ts', '.py', '.go', '.rs', '.java'].includes(ext)) return 'ph-file-code'
    return 'ph-file'
  }

  function fileColor(e: FileEntry): string {
    if (e.isDir) return '#e0a313'
    const ext = e.ext.toLowerCase()
    if (['.doc', '.docx', '.odt', '.rtf', '.ddoc', '.html'].includes(ext)) return '#2b579a'
    if (['.xls', '.xlsx', '.csv', '.ods'].includes(ext)) return '#217346'
    if (['.ppt', '.pptx', '.odp'].includes(ext)) return '#d24726'
    if (ext === '.pdf') return '#cf3a2f'
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) return '#8b5cf6'
    if (['.js', '.ts', '.py', '.go', '.rs', '.java'].includes(ext)) return '#f59e0b'
    return 'var(--bc, #9ca3af)'
  }

  function matchesSearch(e: FileEntry): boolean {
    if (!searchQuery) return true
    return e.name.toLowerCase().includes(searchQuery.toLowerCase())
  }

  const isSelected = $derived(selected.has(entry.path))
  const isDragOver = $derived(dragOverTarget === entry.path)
  const isRenaming = $derived(renameTarget === entry.path)
  const isInlineCreateHere = $derived(inlineCreateTarget === entry.path)

  const sharedProps = $derived({
    selected,
    inlineCreateTarget,
    inlineCreateValue,
    inlineCreateIsDir,
    renameTarget,
    renameValue,
    dragOverTarget,
    searchQuery,
    onToggleExpand,
    onToggleSelect,
    onStartRename,
    onCommitRename,
    onCancelRename,
    onSetRenameValue,
    onDeleteEntry,
    onStartInlineCreate,
    onCommitInlineCreate,
    onCancelInlineCreate,
    onSetInlineCreateValue,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop
  })
</script>

<div
  class="afte-entry"
  class:afte-selected={isSelected}
  class:afte-dir={entry.isDir}
  class:afte-dragover={isDragOver}
  class:afte-new={entry.isNew}
  style="padding-left:{12 + depth * 18}px;"
  role="treeitem"
  aria-selected={isSelected}
  aria-expanded={entry.isDir ? entry.expanded : undefined}
  draggable={true}
  ondragstart={() => onDragStart(entry)}
  ondragover={(e) => onDragOver(entry, e)}
  ondragleave={onDragLeave}
  ondrop={(e) => onDrop(entry, e)}
  onclick={(e) => {
    if (entry.isDir) onToggleExpand(entry)
    else onToggleSelect(entry, e)
  }}
>
  <!-- expand arrow -->
  {#if entry.isDir}
    <span class="afte-expand" class:afte-expanded={entry.expanded}>
      {#if entry.loading}
        <i class="ph-light ph-circle-notch afte-spin"></i>
      {:else}
        <i class="ph-light ph-caret-right"></i>
      {/if}
    </span>
  {:else}
    <span class="afte-indent"></span>
  {/if}

  <!-- checkbox for files -->
  {#if !entry.isDir}
    <span class="afte-cb" class:afte-cb-checked={isSelected}>
      {#if isSelected}<i class="ph-bold ph-check"></i>{/if}
    </span>
  {/if}

  <!-- icon -->
  <i class="ph-light {fileIcon(entry)} afte-icon" style="color:{fileColor(entry)};"></i>

  <!-- name / rename -->
  {#if isRenaming}
    <!-- svelte-ignore a11y-autofocus -->
    <input
      class="afte-rename-input"
      value={renameValue}
      autofocus
      onclick={(e) => e.stopPropagation()}
      oninput={(e) => onSetRenameValue((e.target as HTMLInputElement).value)}
      onkeydown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') onCommitRename()
        if (e.key === 'Escape') onCancelRename()
      }}
      onblur={onCommitRename}
    />
  {:else}
    <span class="afte-name" class:afte-dir-name={entry.isDir} title={entry.name}>
      {entry.name}
    </span>
    {#if entry.ext && !entry.isDir}
      <span class="afte-ext">{entry.ext.slice(1).toUpperCase()}</span>
    {/if}
  {/if}

  <!-- row actions -->
  <span class="afte-actions" onclick={(e) => e.stopPropagation()}>
    {#if entry.isDir}
      <button
        class="afte-act"
        title={$_('New file here')}
        onclick={(e) => {
          e.stopPropagation()
          onStartInlineCreate(entry.path, false)
        }}
      >
        <i class="ph-light ph-file-plus"></i>
      </button>
      <button
        class="afte-act"
        title={$_('New folder here')}
        onclick={(e) => {
          e.stopPropagation()
          onStartInlineCreate(entry.path, true)
        }}
      >
        <i class="ph-light ph-folder-plus"></i>
      </button>
    {/if}
    <button class="afte-act" title={$_('Rename')} onclick={(e) => onStartRename(entry, e)}>
      <i class="ph-light ph-pencil-simple"></i>
    </button>
    <button
      class="afte-act afte-act-danger"
      title={$_('Delete')}
      onclick={(e) => onDeleteEntry(entry, e)}
    >
      <i class="ph-light ph-trash"></i>
    </button>
  </span>
</div>

<!-- inline create inside this dir -->
{#if isInlineCreateHere}
  <div class="afte-inline-create" style="padding-left:{12 + (depth + 1) * 18}px;">
    <i
      class="ph-light {inlineCreateIsDir ? 'ph-folder' : 'ph-file'}"
      style="color:{inlineCreateIsDir ? '#e0a313' : 'var(--bc)'}; font-size:13px;"
    ></i>
    <!-- svelte-ignore a11y-autofocus -->
    <input
      class="afte-inline-input"
      placeholder={inlineCreateIsDir ? $_('Folder name…') : $_('File name…')}
      value={inlineCreateValue}
      autofocus
      oninput={(e) => onSetInlineCreateValue((e.target as HTMLInputElement).value)}
      onkeydown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') onCommitInlineCreate()
        if (e.key === 'Escape') onCancelInlineCreate()
      }}
      onblur={onCommitInlineCreate}
    />
    <button class="afte-inline-ok" onclick={onCommitInlineCreate}
      ><i class="ph-bold ph-check"></i></button
    >
    <button class="afte-inline-cancel" onclick={onCancelInlineCreate}
      ><i class="ph-bold ph-x"></i></button
    >
  </div>
{/if}

<!-- children -->
{#if entry.isDir && entry.expanded && entry.children}
  {#each entry.children as child (child.path)}
    {#if matchesSearch(child) || (child.isDir && !searchQuery)}
      <svelte:self entry={child} depth={depth + 1} {...sharedProps} />
    {/if}
  {/each}
{/if}

<style>
  .afte-entry {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    cursor: pointer;
    border-radius: 5px;
    margin: 1px 6px;
    padding-right: 6px;
    color: rgba(255, 255, 255, 0.65);
    font-size: 12px;
    transition: background 0.12s;
    position: relative;
    user-select: none;
  }
  .afte-entry:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.9);
  }
  .afte-entry:hover .afte-actions {
    opacity: 1;
  }
  .afte-selected {
    background: rgba(99, 102, 241, 0.18) !important;
    color: rgba(165, 167, 255, 0.95) !important;
  }
  .afte-dragover {
    background: rgba(99, 102, 241, 0.25) !important;
    outline: 1px dashed rgba(99, 102, 241, 0.6);
    outline-offset: -1px;
  }
  .afte-new {
    animation: afte-flash 0.5s ease;
  }
  @keyframes afte-flash {
    0% {
      background: rgba(52, 211, 153, 0.3);
    }
    100% {
      background: transparent;
    }
  }

  .afte-expand {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    flex-shrink: 0;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
    transition: transform 0.15s;
  }
  .afte-expand.afte-expanded {
    transform: rotate(90deg);
  }
  .afte-indent {
    width: 14px;
    flex-shrink: 0;
  }

  .afte-cb {
    width: 14px;
    height: 14px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    background: transparent;
    transition: all 0.12s;
  }
  .afte-cb-checked {
    background: var(--p, #6366f1);
    border-color: var(--p, #6366f1);
    color: white;
  }

  .afte-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .afte-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }
  .afte-dir-name {
    font-weight: 500;
  }
  .afte-ext {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.25);
    flex-shrink: 0;
    letter-spacing: 0.05em;
  }

  .afte-actions {
    display: flex;
    align-items: center;
    gap: 1px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.12s;
  }
  .afte-act {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 4px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.4);
    font-size: 11px;
    transition: all 0.12s;
  }
  .afte-act:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.85);
  }
  .afte-act-danger:hover {
    background: rgba(239, 68, 68, 0.15);
    color: rgba(252, 165, 165, 0.9);
  }

  .afte-rename-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--p, #6366f1);
    border-radius: 4px;
    color: var(--bc, #e5e7eb);
    font-size: 12px;
    height: 22px;
    padding: 0 6px;
    outline: none;
  }

  .afte-inline-create {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding-right: 8px;
    margin: 1px 6px;
    background: rgba(99, 102, 241, 0.08);
    border-radius: 5px;
    animation: afte-fade-in 0.1s ease;
  }
  @keyframes afte-fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .afte-inline-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid var(--p, #6366f1);
    border-radius: 4px;
    color: var(--bc, #e5e7eb);
    font-size: 12px;
    height: 22px;
    padding: 0 6px;
    outline: none;
  }

  .afte-inline-ok,
  .afte-inline-cancel {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    transition: all 0.12s;
    flex-shrink: 0;
  }
  .afte-inline-ok {
    background: rgba(52, 211, 153, 0.2);
    color: rgba(110, 231, 183, 0.9);
  }
  .afte-inline-ok:hover {
    background: rgba(52, 211, 153, 0.35);
  }
  .afte-inline-cancel {
    background: rgba(239, 68, 68, 0.15);
    color: rgba(252, 165, 165, 0.7);
  }
  .afte-inline-cancel:hover {
    background: rgba(239, 68, 68, 0.25);
  }

  .afte-spin {
    animation: afte-spin 0.8s linear infinite;
  }
  @keyframes afte-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
