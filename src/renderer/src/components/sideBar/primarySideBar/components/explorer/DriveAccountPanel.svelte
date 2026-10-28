<script lang="ts">
  import { _ } from 'svelte-i18n'
  import TreeView from '../../../../common/react/treeView/TreeView.svelte'
  import { startAuth, withTimeout } from '../../../../../stores/auth.store'
  import { openAlertModal } from '../../../../../stores/alertModal.store'
  import { DriveActions } from '../../../../../utils/driveActions'

  interface Props {
    accountOrg: string
    accountLabel: string
    accountEmail: string
    isActive?: boolean
    authenticated?: boolean
    onActivate?: ((org: string) => void) | null
  }

  // Use $props() with destructuring and default values
  let {
    accountOrg,
    accountLabel,
    accountEmail,
    isActive = $bindable(false), // Use $bindable if the parent needs to sync this state
    authenticated = false,
    onActivate = null
  }: Props = $props()

  type DriveNode = {
    name: string
    path: string
    isFolder: boolean
    displayName?: string
    size?: number
    modifiedAt?: string
  }

  let rootPath = $state('')
  let loading = $state(false)
  let error = $state('')
  let query = $state('')
  let refreshKey = $state(0)
  let showOnlyFolders = $state(false)
  let totalFiles = $state(0)
  let totalFolders = $state(0)
  let totalBytes = $state(0)
  let opBusy = $state(false)
  let createFolderRequestKey = $state(0)
  let hasAttemptedAutoLoad = $state(false)

  // accountOrg vient du serveur et peut contenir des espaces : tel quel il
  // produit un for="drv-q-Mon Org" que le label ne relie à rien.
  const searchFieldId = $derived('drv-q-' + String(accountOrg).replace(/[^A-Za-z0-9_-]/g, '-'))

  function normalizeDrivePath(value: string) {
    const raw = String(value || '').trim()
    if (!raw || raw === '/' || raw === '.') return ''
    return raw
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/{2,}/g, '/')
  }

  function stripRootPrefix(value: string) {
    const rootNorm = normalizeDrivePath(rootPath)
    const norm = normalizeDrivePath(value)
    if (!rootNorm) return norm
    if (norm === rootNorm) return ''
    if (norm.startsWith(`${rootNorm}/`)) return norm.slice(rootNorm.length + 1)
    return norm
  }

  function joinDrivePath(parent: string, child: string) {
    return [normalizeDrivePath(parent), normalizeDrivePath(child)].filter(Boolean).join('/')
  }

  function isUuidLike(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(value || '').trim()
    )
  }

  function isRootListingPath(value: string) {
    // return true
    const rootNorm = normalizeDrivePath(rootPath)
    const norm = normalizeDrivePath(value)
    return norm === rootNorm || (!rootNorm && !norm)
  }

  function toHumanSize(bytes: number) {
    if (!bytes || bytes < 1024) return `${bytes || 0} B`
    const units = ['KB', 'MB', 'GB', 'TB']
    let value = bytes / 1024
    let idx = 0
    while (value >= 1024 && idx < units.length - 1) {
      value /= 1024
      idx += 1
    }
    return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[idx]}`
  }

  async function loadDriveRoot() {
    if (loading) return
    loading = true
    error = ''
    try {
      const root = await withTimeout(DriveActions.getRoot({ accountOrg }), 12000, 'drive:get-root')
      if (!root) {
        rootPath = ''
        error = authenticated
          ? 'Drive root unavailable. Check backend route/auth token.'
          : 'Sign in to connect your cloud drive.'
        return
      }
      rootPath = String(root)
    } catch (err) {
      console.error('Failed to load drive root', err)
      error = 'Unable to connect to drive service.'
      rootPath = ''
    } finally {
      loading = false
    }
  }

  async function fetchDriveDir(
    dirPath: string,
    options: { sort?: boolean; query?: string } = {}
  ): Promise<any[]> {
    const items = await DriveActions.listDir({
      accountOrg,
      rootPath,
      path: normalizeDrivePath(dirPath),
      query: query || options.query || '',
      sort: options.sort ?? true
    })

    if (!Array.isArray(items)) return []
    return items
  }

  function mapDriveItems(items: any[], dirPath: string): DriveNode[] {
    return items.map((item: any) => {
      const baseName = String(item?.name || '').trim()
      const rawPath = String(item?.path || joinDrivePath(dirPath, baseName))
      const stripped = stripRootPrefix(rawPath)
      const normalizedPath = normalizeDrivePath(stripped || joinDrivePath(dirPath, baseName))
      return {
        name: baseName || normalizedPath.split('/').pop() || 'unknown',
        path: normalizedPath,
        isFolder: Boolean(
          item?.isFolder ??
          item?.folder ??
          item?.isDir ??
          item?.is_dir ??
          item?.isDirectory ??
          false
        ),
        size: Number(item?.size || 0) || undefined,
        modifiedAt: item?.modifiedAt
          ? String(item.modifiedAt)
          : item?.modTime || item?.mod_time
            ? String(item.modTime || item.mod_time)
            : undefined
      }
    })
  }

  async function readDriveDir(
    dirPath: string,
    options: { sort?: boolean; query?: string } = {}
  ): Promise<DriveNode[]> {
    console.debug('[drive] Reading drive dir', { dirPath, options })
    const items = await fetchDriveDir(dirPath, options)
    let normalized: DriveNode[] = mapDriveItems(items, dirPath)
    console.debug('[drive] Reading drive dir', { isRoot: isRootListingPath(dirPath), options, items,normalized })

    if (isRootListingPath(dirPath) && !options.query && !query) {
      const flattened: DriveNode[] = []
      const passthrough: DriveNode[] = []

      for (const item of normalized) {
        const firstSegment = normalizeDrivePath(item.path).split('/')[0] || item.name
        if (!item.isFolder || !isUuidLike(firstSegment)) {
          passthrough.push(item)
          continue
        }

        try {
          const childItems = await fetchDriveDir(item.path, { sort: options.sort ?? true })
          const childFolders = mapDriveItems(childItems, item.path).filter(
            (child) => child.isFolder
          )
          if (!childFolders.length) {
            passthrough.push(item)
            continue
          }
          for (const child of childFolders) {
            flattened.push({
              ...child,
              displayName: child.name || child.path.split('/').pop() || item.name
            })
          }
        } catch {
          passthrough.push(item)
        }
      }

      normalized = [...flattened, ...passthrough]
    }

    const uniqueMap = new Map<string, DriveNode>()
    for (const item of normalized) {
      if (!item?.path) continue
      if (!uniqueMap.has(item.path)) uniqueMap.set(item.path, item)
    }
    const unique = Array.from(uniqueMap.values())

    if (!options.query) {
      totalFolders = unique.filter((item) => item.isFolder).length
      totalFiles = unique.filter((item) => !item.isFolder).length
      totalBytes = unique.reduce((sum, item) => sum + Number(item?.size || 0), 0)
    }

    if (showOnlyFolders) return unique.filter((item) => item.isFolder)
    return unique
  }

  function refreshTree() {
    refreshKey += 1
  }

  function createRootFolder() {
    createFolderRequestKey += 1
  }

  async function uploadToRoot() {
    const localPaths = await (window as any).api?.openDialogFiles?.([])
    if (!Array.isArray(localPaths) || !localPaths.length) return
    opBusy = true
    try {
      const uploaded = await DriveActions.uploadFiles({
        accountOrg,
        path: '',
        localPaths
      })
      if (!uploaded?.ok) {
        await openAlertModal({
          title: 'Drive upload',
          message: uploaded?.message || 'Upload failed'
        })
        return
      }
      refreshTree()
    } finally {
      opBusy = false
    }
  }

  async function openAuthFlow() {
    await startAuth('signin', accountOrg || undefined)
  }

  $effect(() => {
    if (!authenticated) {
      rootPath = ''
      hasAttemptedAutoLoad = false
      return
    }
    if (!rootPath && !loading && !hasAttemptedAutoLoad) {
      hasAttemptedAutoLoad = true
      loadDriveRoot()
    }
  })
</script>

<!-- Habillage seulement : tous les gestionnaires, liaisons et propriétés
     passés à TreeView sont ceux d'avant. Ce qui change est le langage —
     surfaces teintées au lieu de bordures dures, rayons du tableau de bord,
     un seul accent (le lecteur actif), et des tailles de texte qui restent
     lisibles au lieu de 8 px à 20 % d'opacité. -->
<div class="drv-panel flex flex-col h-full font-sans select-none" class:drv-panel--on={isActive}>
  <div class="drv-head">
    <span class="drv-head__icon" aria-hidden="true">
      <i class="ph-light ph-hard-drive text-[15px]"></i>
    </span>

    <div class="min-w-0 flex-1">
      <div class="drv-name truncate">{accountLabel || $_('Drive')}</div>
      {#if accountEmail}
        <div class="drv-sub truncate">{accountEmail}</div>
      {/if}
    </div>

    <div class="flex items-center gap-1 shrink-0">
      {#if !isActive}
        <button
          class="drv-act"
          title={$_('Set active')}
          aria-label={$_('Set active')}
          onclick={() => onActivate && onActivate(accountOrg)}
        >
          <i class="ph-light ph-star text-[14px]"></i>
        </button>
      {/if}
      <button
        class="drv-act"
        title={$_('Refresh Drive')}
        aria-label={$_('Refresh Drive')}
        onclick={async () => {
          await loadDriveRoot()
          refreshTree()
        }}
      >
        <i class="ph-light ph-arrows-clockwise text-[14px]"></i>
      </button>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto no-scrollbar">
    <div class="drv-strip">
      <span class="drv-state {authenticated ? 'drv-state--on' : 'drv-state--off'}">
        <span class="drv-state__dot" aria-hidden="true"></span>
        {authenticated ? $_('Active') : $_('Offline')}
      </span>

      <span class="flex items-center gap-1.5 ml-auto shrink-0">
        {#if !authenticated}
          <button class="drv-signin" onclick={openAuthFlow}>{$_('Sign In')}</button>
        {:else}
          <button
            class="drv-act"
            title={$_('New Folder')}
            aria-label={$_('New Folder')}
            onclick={createRootFolder}
          >
            <i class="ph-light ph-folder-plus text-[14px]"></i>
          </button>
          <button
            class="drv-act"
            title={$_('Upload')}
            aria-label={$_('Upload')}
            onclick={uploadToRoot}
            disabled={opBusy}
          >
            <i class="ph-light ph-cloud-arrow-up text-[14px]"></i>
          </button>
        {/if}
      </span>
    </div>

    <div class="drv-stats">
      <div class="drv-stat">
        <div class="drv-stat__k">{$_('Folders')}</div>
        <div class="drv-stat__v">{totalFolders}</div>
      </div>
      <div class="drv-stat">
        <div class="drv-stat__k">{$_('Files')}</div>
        <div class="drv-stat__v">{totalFiles}</div>
      </div>
      <div class="drv-stat">
        <div class="drv-stat__k">{$_('Size')}</div>
        <div class="drv-stat__v">{toHumanSize(totalBytes)}</div>
      </div>
    </div>

    <div class="drv-search">
      <span class="drv-search__wrap">
        <i class="ph-light ph-magnifying-glass drv-search__icon text-[13px]" aria-hidden="true"></i>
        <label for={searchFieldId} class="sr-only">{$_('Search this drive')}</label>
        <input
          id={searchFieldId}
          class="drv-input"
          bind:value={query}
          placeholder={$_('Search this drive')}
        />
      </span>
      <button
        class="drv-toggle {showOnlyFolders ? 'drv-toggle--on' : ''}"
        title={$_('Folders only')}
        aria-label={$_('Folders only')}
        aria-pressed={showOnlyFolders}
        onclick={() => (showOnlyFolders = !showOnlyFolders)}
      >
        <i class="ph-light ph-funnel text-[13px]"></i>
      </button>
    </div>

    {#if loading}
      <div class="drv-msg">
        <i class="ph-light ph-circle-notch animate-spin text-[20px] opacity-60"></i>
        <p class="drv-msg__s">{$_('Loading…')}</p>
      </div>
    {:else if error}
      <div class="drv-err">
        <i class="ph-light ph-warning-circle mr-1.5"></i>{error}
      </div>
    {:else if rootPath}
      {#key `${accountOrg}:${rootPath}:${refreshKey}:${query}:${showOnlyFolders}:${authenticated}`}
        <div class="drv-tree">
          <TreeView
            __rootPath={rootPath}
            __rootParentPath={rootPath}
            __sourceType="drive"
            __searchQuery={query}
            __requestCreateFolderKey={createFolderRequestKey}
            __requestCreateFolderParentPath={rootPath}
            __readDirHandler={readDriveDir}
            __accountOrg={accountOrg}
            __capabilities={{
              canCreate: true,
              canRename: true,
              canCopyCutPaste: true,
              canDuplicate: true,
              canDelete: true,
              canDragDrop: true,
              canOpenInTerminal: false,
              canRevealInOS: true,
              canVersioning: false,
              canSecurity: false,
              canTranslation: false,
              canVariables: false
            }}
          />
        </div>
      {/key}
    {:else}
      <div class="drv-msg">
        <i class="ph-light ph-cloud-slash text-[22px] opacity-35"></i>
        <p class="drv-msg__t mt-2">{$_('Drive unavailable')}</p>
        <p class="drv-msg__s">{$_('Reconnect or refresh to see your files.')}</p>
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
</style>
