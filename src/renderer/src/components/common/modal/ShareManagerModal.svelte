<script lang="ts">
  import { _$_shareManagerModal } from '../../../stores/shareManagerModal.store'
  import { openShareModal } from '../../../stores/shareModal.store'
  import { authStore, initializeAuthStore, startAuth } from '../../../stores/auth.store'
  import EditorCommonUtils from '../../../utils/common.utils'
  import { DriveActions } from '../../../utils/driveActions'
  import { _ } from 'svelte-i18n'

  type ShareItem = {
    shareId: string
    link: string
    public: boolean
    publicRole?: 'viewer' | 'commenter' | 'editor'
    editLocked?: boolean
    editLockUntil?: string
    expiresAt?: string
    permissions?: any[]
    targetType?: string
    name?: string
    docUuid?: string
    path?: string
    createdAt?: string
    updatedAt?: string
    analytics?: {
      totalViews?: number
      last7Days?: number
      lastAccess?: { OccurredAt?: string }
      lastEdit?: { OccurredAt?: string }
      lastEditor?: { userName?: string; userId?: string; role?: string }
      byActor?: Record<string, number>
    }
  }

  const modal = _$_shareManagerModal
  let shares = $state<ShareItem[]>([])
  let loading = $state(false)
  let errorMessage = $state('')
  let search = $state('')
  let expandedShareId = $state<string | null>(null)
  let auditLogs = $state<Record<string, any[]>>({})
  let authAttempted = $state(false)

  const canShare = $derived($authStore?.authenticated)
  const accountOrg = $derived($modal.accountOrg || '')
  function withAccount(payload: Record<string, any> = {}) {
    return accountOrg ? { ...payload, accountOrg } : payload
  }
  const filteredShares  = $derived.by(() => {
    if (!search) return shares
    const q = search.toLowerCase()
    return shares.filter((share) =>
      [share.name, share.docUuid, share.path, share.link].some((val) =>
        String(val || '').toLowerCase().includes(q)
      )
    )
  })

  $effect(() => {
    if (!$modal.open) return
    initializeAuthStore()
    authAttempted = false
    if (!canShare) {
      if (authAttempted) return
      authAttempted = true
      ;(async () => {
        const authed = await EditorCommonUtils.ensureAuthenticated()
        if (authed) {
          await loadShares()
        }
      })()
      return
    }
    void loadShares()
  })

  async function loadShares() {
    errorMessage = ''
    loading = true
    try {
      if (!canShare) {
        const authed = await EditorCommonUtils.ensureAuthenticated()
        if (!authed) {
          errorMessage = $_('Please sign in to continue.')
          return
        }
      }
      const result = await DriveActions.listShares(withAccount())
      if (!result?.ok) {
        errorMessage = result?.message || $_('Unable to load shares.')
        return
      }
      shares = result?.items || result?.result?.items || result?.result || []
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error)
    } finally {
      loading = false
    }
  }

  function close() {
    _$_shareManagerModal.cancel()
  }

  async function handleSignIn() {
    await startAuth('signin')
  }

  async function handleRevoke(share: ShareItem) {
    if (!share?.shareId) return
    const result = await DriveActions.revokeShare(withAccount({ shareId: share.shareId }))
    if (!result?.ok) {
      errorMessage = result?.message || $_('Unable to revoke share.')
      return
    }
    shares = shares.filter((item) => item.shareId !== share.shareId)
  }

  async function handleCopy(share: ShareItem) {
    if (!share.link) return
    await EditorCommonUtils.copyToClipboard(share.link)
  }

  function handleOpen(share: ShareItem) {
    if (!share.link) return
    const openExternal = (window as any).api?.openExternal
    if (openExternal) {
      openExternal(share.link)
      return
    }
    window.open(share.link, '_blank', 'noopener')
  }

  async function handleRotate(share: ShareItem) {
    if (!share?.shareId) return
    const result = await (window as any).server?.share?.rotate?.({ shareId: share.shareId })
    if (!result?.ok) {
      errorMessage = result?.message || $_('Unable to rotate share link.')
      return
    }
    const updated = result?.result
    if (updated?.shareId) {
      shares = shares.map((item) =>
        item.shareId === share.shareId
          ? { ...item, shareId: updated.shareId, link: updated.link || item.link }
          : item
      )
    }
  }

  async function handleEditLock(share: ShareItem) {
    if (!share?.shareId) return
    if (share.editLocked) {
      const result = await (window as any).server?.share?.editLock?.({
        shareId: share.shareId,
        enabled: false
      })
      if (!result?.ok) {
        errorMessage = result?.message || $_('Unable to unlock editing.')
        return
      }
      shares = shares.map((item) =>
        item.shareId === share.shareId ? { ...item, editLocked: false, editLockUntil: '' } : item
      )
      return
    }
    const minutesRaw = prompt($_('Lock editing for how many minutes?'), '30')
    if (minutesRaw === null) return
    const minutes = Number(minutesRaw)
    const reason = prompt($_('Optional reason for the lock'), '') || ''
    const result = await (window as any).server?.share?.editLock?.({
      shareId: share.shareId,
      enabled: true,
      lockMinutes: Number.isFinite(minutes) ? minutes : 30,
      reason
    })
    if (!result?.ok) {
      errorMessage = result?.message || $_('Unable to lock editing.')
      return
    }
    shares = shares.map((item) =>
      item.shareId === share.shareId
        ? {
            ...item,
            editLocked: true,
            editLockUntil: result?.result?.editLockUntil || item.editLockUntil
          }
        : item
    )
  }

  function toLocalDateTime(value?: string) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toISOString().slice(0, 16)
  }

  async function handleEdit(share: ShareItem) {
    if (!share.path) return
    await openShareModal({
      path: share.path,
      name: share.name,
      source: 'drive',
      targetType: (share.targetType as any) || 'file',
      docUuid: share.docUuid,
      initialPublic: share.public,
      initialPublicRole: share.publicRole,
      initialPermissions: share.permissions || [],
      initialExpiresAt: toLocalDateTime(share.expiresAt),
      initialLink: share.link,
      initialShareId: share.shareId,
      accountOrg
    })
    await loadShares()
  }

  async function toggleAudit(shareId: string) {
    if (expandedShareId === shareId) {
      expandedShareId = null
      return
    }
    expandedShareId = shareId
    if (!auditLogs[shareId]) {
      const result = await (window as any).server?.share?.auditList?.({ shareId, limit: 25 })
      if (result?.ok) {
        auditLogs = { ...auditLogs, [shareId]: result.items || [] }
      }
    }
  }

  function formatTime(value?: string) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString()
  }
</script>

{#if $modal.open}
  <div class="modal-shell fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
    <div
      class="modal-card w-full max-w-[760px] bg-[#1e1e1e] border border-white/10 rounded-xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
    >
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 class="text-base-content text-lg font-700">{$_('Manage Shares')}</h3>
          <p class="text-base-content/50 text-[11px]">
            {$_('Monitor active share links, permissions, and access.')}
          </p>
        </div>
        <button onclick={close} class="text-base-content/50 hover:text-base-content text-sm">
          <i class="ph-bold ph-x"></i>
        </button>
      </div>

      {#if !canShare}
        <div class="bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] border border-white/10 rounded-lg p-4 mb-4">
          <p class="text-base-content/70 text-[12px] mb-3">
            {$_('Sign in to manage shares.')}
          </p>
          <button
            onclick={handleSignIn}
            class="px-4 py-2 bg-base-300 rounded-md text-[11px] text-base-content font-700 hover:bg-base-300/80"
          >
            {$_('Sign In')}
          </button>
        </div>
      {/if}

      <div class="flex items-center gap-2 mb-3">
        <input
          bind:value={search}
          placeholder={$_('Search shares...')}
          class="w-full bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 rounded-md py-2 px-3 text-base-content text-[12px] focus:outline-none focus:border-base-300"
        />
        <button
          onclick={loadShares}
          class="px-3 py-2 text-[11px] bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] border border-white/10 rounded-md text-base-content/70 hover:text-base-content"
        >
          <i class="ph-bold ph-arrows-clockwise"></i>
        </button>
      </div>

      {#if errorMessage}
        <div class="text-red-400 text-[11px] mb-3">{errorMessage}</div>
      {/if}

      <div class="max-h-[420px] overflow-y-auto space-y-2">
        {#if loading}
          <div class="text-base-content/50 text-[11px]">{$_('Loading shares...')}</div>
        {:else if filteredShares.length === 0}
          <div class="text-base-content/40 text-[11px]">{$_('No active shares yet.')}</div>
        {:else}
          {#each filteredShares as share (share.shareId)}
            <div class="bg-black/20 border border-white/5 rounded-lg p-3 flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2">
                <div>
                  <div class="text-base-content text-[12px] font-600">{share.name}</div>
                  <div class="text-base-content/40 text-[10px] truncate">{share.path}</div>
                </div>
                <div class="text-[9px] text-base-content/40 uppercase">
                  {share.public ? $_('Public') : $_('Restricted')}
                </div>
              </div>
              {#if share.analytics}
                <div class="grid grid-cols-4 gap-2 text-[10px] text-base-content/50">
                  <div>
                    <div class="text-base-content/70 font-600">{share.analytics.totalViews || 0}</div>
                    <div>{$_('Total views')}</div>
                  </div>
                  <div>
                    <div class="text-base-content/70 font-600">{share.analytics.last7Days || 0}</div>
                    <div>{$_('Last 7 days')}</div>
                  </div>
                  <div>
                    <div class="text-base-content/70 font-600">
                      {share.analytics.lastAccess?.OccurredAt
                        ? formatTime(share.analytics.lastAccess.OccurredAt)
                        : $_('Never')}
                    </div>
                    <div>{$_('Last access')}</div>
                  </div>
                  <div>
                    <div class="text-base-content/70 font-600 truncate">
                      {share.analytics.lastEditor?.userName ||
                      share.analytics.lastEditor?.userId ||
                      $_('—')}
                    </div>
                    <div>
                      {share.analytics.lastEdit?.OccurredAt
                        ? $_('Last editor') + ' · ' + formatTime(share.analytics.lastEdit.OccurredAt)
                        : $_('Last editor')}
                    </div>
                  </div>
                </div>
              {/if}
              {#if share.editLocked}
                <div class="text-[10px] text-amber-300">
                  {$_('Edit locked')}{share.editLockUntil ? ` · ${formatTime(share.editLockUntil)}` : ''}
                </div>
              {/if}
              <div class="text-[10px] text-base-content/60 truncate">{share.link}</div>
              <div class="flex flex-wrap items-center gap-2">
                <button onclick={() => handleCopy(share)} class="text-[11px] text-base-300">
                  {$_('Copy Link')}
                </button>
                <button onclick={() => handleOpen(share)} class="text-[11px] text-base-content/70">
                  {$_('Open')}
                </button>
                <button onclick={() => handleRotate(share)} class="text-[11px] text-base-content/70">
                  {$_('Rotate Link')}
                </button>
                <button onclick={() => handleEditLock(share)} class="text-[11px] text-base-content/70">
                  {share.editLocked ? $_('Unlock Edit') : $_('Lock Edit')}
                </button>
                <button onclick={() => handleEdit(share)} class="text-[11px] text-base-content/70">
                  {$_('Edit')}
                </button>
                <button onclick={() => toggleAudit(share.shareId)} class="text-[11px] text-base-content/70">
                  {expandedShareId === share.shareId ? $_('Hide Activity') : $_('View Activity')}
                </button>
                <button onclick={() => handleRevoke(share)} class="text-[11px] text-red-300">
                  {$_('Revoke')}
                </button>
              </div>
              {#if expandedShareId === share.shareId}
                <div class="mt-2 border-t border-white/5 pt-2 space-y-1 text-[10px] text-base-content/60">
                  {#if auditLogs[share.shareId]?.length}
                    {#each auditLogs[share.shareId] as log}
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-base-content/70 uppercase">{log.Action}</span>
                        <span class="truncate">{log.ActorType}{log.ActorID ? `:${log.ActorID}` : ''}</span>
                        <span>{formatTime(log.OccurredAt)}</span>
                      </div>
                    {/each}
                  {:else}
                    <div>{$_('No activity yet.')}</div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  @media (max-width: 768px) {
    .modal-shell {
      align-items: flex-end;
      padding-bottom: env(safe-area-inset-bottom);
    }
    .modal-card {
      max-width: 100%;
      width: 100%;
      border-radius: 16px 16px 0 0;
    }
  }
</style>
