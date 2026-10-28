<script lang="ts">
  // import { nodeApi } from '../../../utils/shims/node'
  import { _$_shareModal, type SharePermission } from '../../../stores/shareModal.store'
  import { authStore, initializeAuthStore, startAuth } from '../../../stores/auth.store'
  import EditorCommonUtils from '../../../utils/common.utils'
  import { _ } from 'svelte-i18n'
  import { setShareLinkContext } from '../../../stores/shareLink.store'
  import { _$_documentEditorsList } from '../../../stores/editor.store'
  import Utils from '../../../utils/Utils'
  import { openConfirmModal } from '../../../stores/confirmModal.store'
  import { openAlertModal } from '../../../stores/alertModal.store'
  import type { DocumentEditorModel } from '../../../models/Document'
  import { DriveActions } from '../../../utils/driveActions'

  const modal = _$_shareModal
  let permissions = $state<SharePermission[]>([])
  let inviteEmail = $state('')
  let inviteRole = $state<'viewer' | 'commenter' | 'editor'>('viewer')
  let isPublic = $state(false)
  let publicRole = $state<'viewer' | 'commenter' | 'editor'>('viewer')
  let password = $state('')
  let expiresAt = $state('')
  let deadlineAt = $state('')
  let maxViews = $state<number | ''>('')
  let disableDownload = $state(false)
  // Requires every recipient to pass an emailed verification before the server
  // serves any content. The backend anchors this to the DOCUMENT and only ever
  // raises it, so it cannot be downgraded by a later share.
  let require2FA = $state(false)
  // A sealed document is shared with people, not with a link. Its content is
  // released by the server to an identity it can name, which a public link has
  // none of: anyone holding it would get the clear document and the seal would
  // mean nothing. Resolved when the modal opens rather than derived, so the
  // sharing form never depends on an effect that could fail mid-render.
  let isSealedDocument = $state(false)
  let isSaving = $state(false)
  let errorMessage = $state('')
  // Stays on screen until the next save or the next time the modal opens. A
  // toast that fades is what left people thinking nothing had happened, so they
  // clicked again — and every click re-sends the invitations.
  let successMessage = $state('')
  // True once a save has been accepted for this modal session. Read together
  // with `isDirty` it answers "is there anything left to send?", which the
  // presence of a share link alone does not.
  let hasSavedShare = $state(false)
  let shareLink = $state('')
  let shareId = $state('')
  let shareToast = $state('')
  let shareToastTimer: ReturnType<typeof setTimeout> | null = null
  let targetType = $state<'document' | 'file' | 'folder'>('file')
  let docUuid = $state('')
  let authAttempted = $state(false)
  let syncInProgress = $state(false)
  let syncedToDrive = $state(false)
  let lastSyncAt = $state<string | null>(null)
  let initialSnapshot = $state('')
  let principalSuggestions = $state<any[]>([])
  let principalsOpen = $state(false)
  let principalsLoading = $state(false)
  let principalsError = $state('')
  let principalsTimer: ReturnType<typeof setTimeout> | null = null

  const showShareToast = (message: string) => {
    shareToast = message
    if (shareToastTimer) clearTimeout(shareToastTimer)
    shareToastTimer = setTimeout(() => {
      shareToast = ''
      shareToastTimer = null
    }, 2400)
  }

  // Every field a save would carry to the bridge, in a stable shape. "Is there
  // anything left to send?" is answered by comparing two of these, so a field
  // left out of it is a field whose change is silently dropped: the button
  // would read "Done" and close without ever sending it.
  //
  // It takes its values as an argument rather than reading the component state,
  // so the hydrating $effect can call it with its own locals without
  // subscribing to that state and re-running on every keystroke.
  type ShareSnapshotInput = {
    permissions: SharePermission[]
    isPublic: boolean
    publicRole: string
    password: string
    require2FA: boolean
    expiresAt: string
    deadlineAt: string
    maxViews: number | ''
    disableDownload: boolean
    targetType: string
  }

  function snapshotOf(values: ShareSnapshotInput): string {
    return JSON.stringify({
      permissions: values.permissions,
      isPublic: values.isPublic,
      publicRole: values.publicRole,
      password: values.password,
      require2FA: values.require2FA,
      expiresAt: values.expiresAt,
      deadlineAt: values.deadlineAt,
      maxViews: values.maxViews,
      disableDownload: values.disableDownload,
      targetType: values.targetType
    })
  }

  $effect(() => {
    if (!$modal.open) return

    // Important: avoid reading local $state values (like `permissions`) while hydrating,
    // otherwise this effect will subscribe to them and re-run on every edit, causing
    // `effect_update_depth_exceeded`.
    const nextPermissions = $modal.initialPermissions ? [...$modal.initialPermissions] : []
    const nextIsPublic = Boolean($modal.initialPublic)
    const nextPublicRole = ($modal.initialPublicRole || 'viewer') as any
    const nextExpiresAt = $modal.initialExpiresAt || ''
    const nextDeadlineAt = String($modal.initialMetadata?.deadlineAt || '')
    const nextMaxViews =
      typeof $modal.initialMetadata?.maxViews === 'number' ? $modal.initialMetadata.maxViews : ''
    const nextDisableDownload = Boolean($modal.initialMetadata?.disableDownload)
    const nextRequire2FA = Boolean($modal.initialMetadata?.require2FA)
    const nextShareLink = $modal.initialLink || ''
    const nextShareId = $modal.initialShareId || ''
    const nextTargetType = ($modal.targetType || 'file') as any
    const nextDocUuid = $modal.docUuid || extractDocUuid($modal.path)

    permissions = nextPermissions
    isPublic = nextIsPublic
    publicRole = nextPublicRole
    password = ''
    expiresAt = nextExpiresAt
    deadlineAt = nextDeadlineAt
    maxViews = nextMaxViews
    disableDownload = nextDisableDownload
    require2FA = nextRequire2FA
    isSealedDocument = resolveIsSealedDocument()
    if (isSealedDocument) {
      isPublic = false
    }
    isSaving = false
    syncedToDrive = false
    errorMessage = ''
    successMessage = ''
    hasSavedShare = Boolean(nextShareId)
    shareLink = nextShareLink
    shareId = nextShareId
    targetType = nextTargetType
    docUuid = nextDocUuid
    authAttempted = false
    initializeAuthStore()
    inviteEmail = ''
    inviteRole = 'viewer'
    principalSuggestions = []
    principalsOpen = false
    principalsLoading = false
    principalsError = ''
    if (principalsTimer) {
      clearTimeout(principalsTimer)
      principalsTimer = null
    }

    initialSnapshot = snapshotOf({
      permissions: nextPermissions,
      isPublic: nextIsPublic,
      publicRole: nextPublicRole,
      password: '',
      require2FA: nextRequire2FA,
      expiresAt: nextExpiresAt,
      deadlineAt: nextDeadlineAt,
      maxViews: nextMaxViews,
      disableDownload: nextDisableDownload,
      targetType: nextTargetType
    })

    if (nextDocUuid && nextShareId) {
      setShareLinkContext(nextDocUuid, {
        shareId: nextShareId,
        link: nextShareLink,
        docUuid: nextDocUuid,
        path: $modal.path,
        name: $modal.name
      })
    }
  })

  const canShare = $derived($authStore?.authenticated)

  $effect(() => {
    if (!$modal.open) return
    if (canShare || authAttempted) return
    authAttempted = true
    ;(async () => {
      await EditorCommonUtils.ensureAuthenticated()
    })()
  })

  function extractDocUuid(pathValue: string) {
    const match =
      pathValue?.match(
        /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-5][a-fA-F0-9]{3}-[89abAB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}/
      ) || []
    return match[0] || ''
  }

  function close() {
    _$_shareModal.cancel()
  }

  function addPermission() {
    permissions = [
      ...permissions,
      { subjectType: 'email', subjectId: '', role: 'viewer', email: '' }
    ]
  }

  function isValidEmail(value: string) {
    const v = String(value || '').trim()
    if (!v) return false
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  }

  function addInvite(emailRaw: string, role: 'viewer' | 'commenter' | 'editor') {
    const email = String(emailRaw || '')
      .trim()
      .toLowerCase()
    if (!isValidEmail(email)) {
      showShareToast($_('Enter a valid email address'))
      return
    }
    // Dedupe by email (in either `email` or `subjectId`) and then append.
    const next = permissions.filter((perm) => {
      if (perm.subjectType !== 'email') return true
      const existing = String(perm.email || perm.subjectId || '')
        .trim()
        .toLowerCase()
      return existing !== email
    })
    next.push({ subjectType: 'email', subjectId: email, email, role })
    permissions = next
    inviteEmail = ''
    inviteRole = 'viewer'
  }

  async function fetchPrincipals(query: string) {
    principalsError = ''
    const api = (window as any)?.server?.share?.principals
    if (!api) return []
    principalsLoading = true
    try {
      const res = await api({ q: query })
      const payload = res?.data || res?.result || res
      const items = payload?.items || payload?.data?.items || []
      return Array.isArray(items) ? items : []
    } catch (e) {
      principalsError = e instanceof Error ? e.message : String(e)
      return []
    } finally {
      principalsLoading = false
    }
  }

  function queuePrincipalSearch(value: string) {
    const q = String(value || '').trim()
    principalsError = ''
    if (principalsTimer) clearTimeout(principalsTimer)
    if (!q) {
      principalSuggestions = []
      principalsOpen = false
      return
    }
    principalsTimer = setTimeout(async () => {
      const items = await fetchPrincipals(q)
      principalSuggestions = items
      principalsOpen = true
    }, 220)
  }

  function applyPrincipalSuggestion(item: any) {
    const type = String(item?.type || '').trim()
    const id = String(item?.id || '').trim()
    const email = String(item?.email || '').trim()
    if (type === 'user' && id) {
      permissions = permissions
        .filter((p) => !(p.subjectType === 'user' && p.subjectId === id))
        .concat([{ subjectType: 'user', subjectId: id, role: inviteRole } as any])
      inviteEmail = ''
    } else if (type === 'org' && id) {
      permissions = permissions
        .filter((p) => !(p.subjectType === 'org' && p.subjectId === id))
        .concat([{ subjectType: 'org', subjectId: id, role: inviteRole } as any])
      inviteEmail = ''
    } else if (type === 'team' && id) {
      permissions = permissions
        .filter((p) => !(p.subjectType === 'team' && p.subjectId === id))
        .concat([{ subjectType: 'team', subjectId: id, role: inviteRole } as any])
      inviteEmail = ''
    } else if (email) {
      addInvite(email, inviteRole)
    } else if (id && type === 'email') {
      addInvite(id, inviteRole)
    } else {
      inviteEmail = email || id
    }
    principalsOpen = false
  }

  function removePermission(index: number) {
    permissions = permissions.filter((_, i) => i !== index)
  }

  function updatePermission(index: number, patch: Partial<SharePermission>) {
    permissions = permissions.map((perm, i) => (i === index ? { ...perm, ...patch } : perm))
  }

  async function handleSignIn() {
    await startAuth('signin')
  }

  // True when the document being shared is a sealed container. The share target
  // can be named by path, or only by the editor it belongs to, so both are read.
  function resolveIsSealedDocument(): boolean {
    const isSealedPath = (value?: string | null) =>
      String(value || '')
        .toLowerCase()
        .endsWith(Utils.DYNADOC_EXTENSIONS.secured)
    if (isSealedPath($modal?.path) || isSealedPath($modal?.name)) return true
    const editor = resolveEditorForShare()
    return Boolean(editor?.document?.isSecured) || isSealedPath(editor?.document?.path)
  }

  function resolveEditorForShare(): DocumentEditorModel | null {
    const list = _$_documentEditorsList.getList()
    if (!list?.length) return null
    if (docUuid) {
      const match = list.find((item) => item?.document?.uuid === docUuid)
      if (match) return match
    }
    if ($modal?.path) {
      const match = list.find((item) => item?.document?.path === $modal.path)
      if (match) return match
    }
    return list.find((item) => item?.isActive) || list[0] || null
  }

  async function syncNow(): Promise<boolean> {
    const editor = resolveEditorForShare()
    if (!editor) {
      await openAlertModal({
        title: $_('Sync to Cloud'),
        message: $_('No active document editor found to sync.')
      })
      return false
    }
    syncInProgress = true
    // Upload the document's folder to the drive so the server can find it when
    // creating the share (the server rejects sharing a never-synced doc). Works
    // on web and desktop; fall back to the legacy commit path if needed.
    let result = null
    const cachePath = editor?.document?.cachePath
    if (cachePath) {
      result = await DriveActions.syncDoc({ cachePath })
    }
    // Never fall back to syncDocumentEditorToCloud here: it reports through a
    // blocking alert modal, which renders *underneath* this modal's backdrop.
    // The alert is then invisible and unclickable, its promise never settles,
    // and the share hangs on "Syncing…" forever without ever calling the API.
    if (!result?.ok) {
      syncInProgress = false
      errorMessage = result?.message || $_('This document could not be synced to the drive.')
      return false
    }
    syncInProgress = false
    if (result?.ok) {
      lastSyncAt = new Date().toISOString()
      // The document now lives on the drive, so the follow-up share must use
      // the drive source (the disk-source path keeps rejecting a just-synced
      // doc). A direct source:"drive" share succeeds server-side.
      syncedToDrive = true
      return true
    }
    return false
  }

  async function ensureDriveSynced(): Promise<boolean> {
    const confirmed = await openConfirmModal({
      title: $_('Sync Required'),
      message: $_('This document must be synced to the drive before it can be shared. Sync now?'),
      confirmText: $_('Sync Now'),
      cancelText: $_('Cancel')
    })
    if (!confirmed) return false
    return await syncNow()
  }

  // The recipients a save actually writes to. `org` and `team` grant access to a
  // group that has no single address, and the owner is never written to, so
  // naming those would promise a mail that nobody is going to receive.
  function notifiableRecipients(perms: SharePermission[] | undefined | null): string[] {
    const names: string[] = []
    for (const perm of perms || []) {
      const type = String(perm?.subjectType || '').trim()
      if (type !== 'email' && type !== 'user') continue
      if (String(perm?.role || '').trim() === 'owner') continue
      const name = String(perm?.email || perm?.subjectId || '').trim()
      if (name && !names.includes(name)) names.push(name)
    }
    return names
  }

  // The permissions carried by the last accepted save, or null when the snapshot
  // cannot be read. Null means "unknown", not "none": a snapshot that fails to
  // parse must not make the confirmation claim that nobody new was added.
  function permissionsFromSnapshot(snapshot: string): SharePermission[] | null {
    if (!snapshot) return null
    try {
      const parsed = JSON.parse(snapshot)
      return Array.isArray(parsed?.permissions) ? parsed.permissions : null
    } catch {
      return null
    }
  }

  async function handleShare(retryAfterSync: boolean = false) {
    errorMessage = ''
    successMessage = ''
    if (!canShare) {
      await handleSignIn()
      errorMessage = $_('Please sign in to share.')
      return
    }
    if (!$modal.path) {
      errorMessage = $_('Missing target path.')
      return
    }
    if (!docUuid) {
      errorMessage = $_('Unable to resolve document UUID. Please sync the document first.')
      return
    }
    // Nothing has changed since the last accepted save, so there is nothing to
    // send. The bridge re-mails every recipient on every upsert, so going ahead
    // would deliver a second invitation to people who already have one. The
    // button normally offers "Done" in this state; this is the guard for when
    // it cannot tell, such as a save that came back without a link.
    if (!retryAfterSync && hasSavedShare && !isDirty) {
      successMessage = $_('Nothing has changed since the last save.')
      return
    }

    isSaving = true
    try {
      // Implicit upload before sharing: the server rejects sharing a doc that
      // was never synced to the drive ("drive sync is required"). Proactively
      // push the document's folder first, then share from source:"drive" — the
      // disk source keeps rejecting even a just-synced doc. This runs once per
      // modal session (syncedToDrive guards re-uploads on retries).
      if (!syncedToDrive) {
        await syncNow()
      }
      const payload = {
        path: (() => {
          let p = $modal.path
            ? String($modal.path)
                .replace(/\\/g, '/')
                .replace(/^drive\/+/, '')
                .replace(/^\/+/, '')
            : ''
          if (targetType === 'folder' || targetType === 'document') {
            p = p.replace(/\/index\.html?$/i, '')
          }
          return p
        })(),
        accountOrg: $modal.accountOrg,
        source: syncedToDrive ? 'drive' : $modal.source || 'drive',
        docUuid,
        name: $modal.name,
        targetType,
        public: isPublic && !require2FA && !isSealedDocument,
        publicRole,
        require2FA,
        password: password.trim(),
        expiresAt: expiresAt || '',
        metadata: {
          // Use null to explicitly clear previously-set rules on the backend.
          deadlineAt: deadlineAt ? deadlineAt : null,
          maxViews: typeof maxViews === 'number' ? maxViews : maxViews === '' ? null : null,
          disableDownload: disableDownload ? true : null
        },
        permissions: permissions
          .filter((perm) => perm.subjectId || perm.email)
          .map((perm) => ({
            ...perm,
            subjectId: perm.subjectId || perm.email || ''
          }))
      }

      // Who was already on the share before this save, so the confirmation can
      // name the people this click actually added rather than re-listing
      // everyone. Read before the call, because the snapshot is refreshed on
      // success.
      const previousSnapshotPermissions = permissionsFromSnapshot(initialSnapshot)
      const previousRecipients = notifiableRecipients(previousSnapshotPermissions)

      const result = await DriveActions.shareItem(payload)
      console.log('Share result raw:', { result })

      const resultPayload = result?.result?.result || result?.result || result || {}
      const resultOk = typeof result?.ok === 'boolean' ? result.ok : (result?.result?.ok ?? true)
      console.log('Share result 1 :', { resultPayload, resultOk, result })

      if (!resultOk) {
        const message =
          result?.message || resultPayload?.message || $_('Unable to create share link.')
        if (!retryAfterSync && /drive sync is required/i.test(message)) {
          const synced = await ensureDriveSynced()
          if (synced) {
            isSaving = false
            return await handleShare(true)
          }
        }
        // The server refuses to create a 2FA-gated share while it cannot send
        // verification codes — otherwise the share would be permanently
        // unopenable. Say that plainly instead of echoing the raw error code.
        if (/stepup_disabled/i.test(message)) {
          errorMessage = $_(
            'Verification by email is currently unavailable, so this document cannot require it. Share without the verification, or try again later.'
          )
          return
        }
        errorMessage = message
        return
      }
      shareLink = resultPayload?.link || ''
      shareId = resultPayload?.shareId || ''
      console.log('Share result 1 :', { resultPayload, shareId, shareLink })

      if (resultPayload?.publicRole && !publicRole) {
        publicRole = resultPayload.publicRole
      }
      if (docUuid && shareId) {
        setShareLinkContext(docUuid, {
          shareId,
          link: shareLink,
          password: password.trim() || undefined,
          docUuid,
          path: $modal.path,
          name: $modal.name,
          role: publicRole
        })
      }

      // The save was accepted. Record the state it carried so that clicking
      // again does not send it a second time: the bridge mails every recipient
      // on every upsert, and until now the snapshot was only ever taken when
      // the modal opened, which left the form permanently "dirty" and made the
      // second click re-invite everybody.
      hasSavedShare = true
      initialSnapshot = currentSnapshot()

      // Name the people this save added. The bridge posts the invitations
      // asynchronously and answers 200 before they are accepted by the mail
      // provider, so this says an invitation is on its way — it cannot claim
      // it was delivered.
      const addedRecipients = notifiableRecipients(payload.permissions as SharePermission[]).filter(
        (name) => !previousRecipients.includes(name)
      )
      successMessage = addedRecipients.length
        ? $_('Now shared with {names}. An invitation is on its way to them.', {
            values: { names: addedRecipients.join(', ') }
          })
        : $_('Sharing settings saved.')

      if (shareLink) {
        // The share is saved by this point, so a clipboard that refuses must
        // not be reported as a share that failed. `copyToClipboard` rejects
        // once every method has failed, and that rejection used to land in the
        // handler's own catch, where it would have contradicted the
        // confirmation above with a red error about the share.
        try {
          await EditorCommonUtils.copyToClipboard(shareLink)
          showShareToast($_('Share link copied to the clipboard'))
        } catch (copyError) {
          console.warn('Share link could not be copied to the clipboard', copyError)
          showShareToast($_('The share link could not be copied. Copy it from the field above.'))
        }
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error)
      console.error('Share error:', { error })
    } finally {
      isSaving = false
      console.log('Share result:', { shareLink, shareId, errorMessage })
    }
  }

  async function handleCopyLink() {
    if (!shareLink) return
    if (!canShare) {
      await handleSignIn()
      errorMessage = $_('Please sign in to copy the share link.')
      return
    }
    await EditorCommonUtils.copyToClipboard(shareLink)
  }

  async function handleOpenLink() {
    if (!shareLink) return
    const api = (window as any)?.api
    if (api?.openExternal) {
      await api.openExternal(shareLink)
      return
    }
    window.open(shareLink, '_blank', 'noopener')
  }

  function currentSnapshot(): string {
    return snapshotOf({
      permissions,
      isPublic,
      publicRole,
      password,
      require2FA,
      expiresAt,
      deadlineAt,
      maxViews,
      disableDownload,
      targetType
    })
  }

  const isDirty = $derived.by(() => {
    if (!$modal.open) return false
    if (!initialSnapshot) return false
    return currentSnapshot() !== initialSnapshot
  })
</script>

{#if $modal.open}
  <div
    class="modal-shell fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    role="dialog"
    aria-modal="true"
  >
    <div
      class="modal-card w-full max-w-[620px] bg-[#1e1e1e] border border-white/10 rounded-xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
    >
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 class="text-base-content text-lg font-700">{$_('Share')}</h3>
          <p class="text-base-content/50 text-[11px]">
            {$modal.name || $modal.path}
          </p>
        </div>
        <button onclick={close} class="text-base-content/50 hover:text-base-content text-sm">
          <i class="ph-bold ph-x"></i>
        </button>
      </div>

      {#if !canShare}
        <div
          class="bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] border border-white/10 rounded-lg p-4 mb-4"
        >
          <p class="text-base-content/70 text-[12px] mb-3">
            {$_('Sign in to share documents and manage access.')}
          </p>
          <button
            onclick={handleSignIn}
            class="px-4 py-2 bg-base-300 rounded-md text-[11px] text-base-content font-700 hover:bg-base-300/80"
          >
            {$_('Sign In')}
          </button>
        </div>
      {/if}

      <div class="grid grid-cols-1 gap-4">
        <div
          class="bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] border border-white/10 rounded-lg p-4"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-base-content/80 text-[12px] font-600">{$_('Share Scope')}</span>
          </div>
          <select
            bind:value={targetType}
            class="w-full bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 rounded-md py-2 px-3 text-base-content text-[12px]"
          >
            <option value="document">{$_('Entire Document')}</option>
            <option value="folder">{$_('Folder')}</option>
            <option value="file">{$_('File')}</option>
          </select>
        </div>
        {#if isSealedDocument}
          <div class="rounded-lg bg-white/[0.02] border border-white/5 p-3">
            <span class="text-base-content/80 text-[12px] font-600">
              {$_('This document is sealed')}
            </span>
            <span class="block text-[11px] text-base-content/50 mt-[2px]">
              {$_(
                'Share it with the people you invite below. A public link is not offered for a sealed document.'
              )}
            </span>
          </div>
        {:else}
          <div
            class="bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] border border-white/10 rounded-lg p-4"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-base-content/80 text-[12px] font-600">
                {$_('Public Link')}
                {#if require2FA}
                  <span class="ml-2 text-[10px] font-400 text-base-content/40">
                    {$_('unavailable while a verification is required')}
                  </span>
                {/if}
              </span>
              <label
                class="flex items-center gap-2 text-[11px] text-base-content/50 {require2FA
                  ? 'opacity-40'
                  : ''}"
              >
                <input type="checkbox" bind:checked={isPublic} disabled={require2FA} />
                {$_('Enable')}
              </label>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                bind:value={publicRole}
                disabled={!isPublic}
                class="w-full bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 rounded-md py-2 px-3 text-base-content text-[12px] focus:outline-none focus:border-base-300 disabled:opacity-50"
              >
                <option value="viewer">{$_('Anyone with link: View')}</option>
                <option value="commenter">{$_('Anyone with link: Comment')}</option>
                <option value="editor">{$_('Anyone with link: Edit')}</option>
              </select>
              <input
                type="password"
                bind:value={password}
                placeholder={$_('Optional password')}
                class="w-full bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 rounded-md py-2 px-3 text-base-content text-[12px] focus:outline-none focus:border-base-300"
              />
              <input
                type="datetime-local"
                bind:value={expiresAt}
                class="w-full bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 rounded-md py-2 px-3 text-base-content text-[12px] focus:outline-none focus:border-base-300"
              />
              <input
                type="datetime-local"
                bind:value={deadlineAt}
                placeholder={$_('Optional deadline')}
                class="w-full bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 rounded-md py-2 px-3 text-base-content text-[12px] focus:outline-none focus:border-base-300"
              />
              <input
                type="number"
                min="0"
                step="1"
                bind:value={maxViews}
                placeholder={$_('Max views (optional)')}
                class="w-full bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 rounded-md py-2 px-3 text-base-content text-[12px] focus:outline-none focus:border-base-300"
              />
              <label class="flex items-center gap-2 text-[11px] text-base-content/60">
                <input type="checkbox" bind:checked={disableDownload} />
                {$_('Disable downloads')}
              </label>
            </div>
          </div>
        {/if}

        <!-- Access is tied to an identity once verification is required, so a
             public link cannot coexist with it: the checkbox below disables it. -->
        <div class="rounded-lg bg-white/[0.02] border border-white/5 p-3">
          <label class="flex items-start gap-2 text-[12px] text-base-content/80">
            <input type="checkbox" bind:checked={require2FA} class="mt-[2px]" />
            <span>
              <span class="font-600">{$_('Require a verification to open')}</span>
              <span class="block text-[11px] text-base-content/50 mt-[2px]">
                {$_(
                  'Each recipient receives a code by email before the document is served. Turning this on disables the public link.'
                )}
              </span>
            </span>
          </label>
        </div>

        <div
          class="bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] border border-white/10 rounded-lg p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-base-content/80 text-[12px] font-600">{$_('Invite People')}</span>
          </div>

          <div class="flex flex-wrap gap-2 items-center mb-3">
            <input
              value={inviteEmail}
              placeholder={$_('Email address')}
              class="flex-1 min-w-[220px] bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 rounded-md py-2 px-3 text-base-content text-[12px] focus:outline-none focus:border-base-300"
              onfocus={() => {
                if (principalSuggestions.length) principalsOpen = true
              }}
              oninput={(e) => {
                inviteEmail = (e.target as HTMLInputElement).value
                queuePrincipalSearch(inviteEmail)
              }}
              onkeydown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addInvite(inviteEmail, inviteRole)
                }
              }}
            />
            <select
              bind:value={inviteRole}
              class="bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] border border-white/10 rounded-md px-3 py-2 text-[12px] text-base-content"
            >
              <option value="viewer">{$_('Viewer')}</option>
              <option value="commenter">{$_('Commenter')}</option>
              <option value="editor">{$_('Editor')}</option>
            </select>
            <button
              onclick={() => addInvite(inviteEmail, inviteRole)}
              class="px-3 py-2 bg-base-300 rounded-md text-[12px] text-base-content font-700 hover:bg-base-300/80"
            >
              {$_('Invite')}
            </button>
            <button
              onclick={addPermission}
              class="px-3 py-2 text-[12px] text-base-content/60 hover:text-base-content border border-white/10 rounded-md hover:bg-white/5"
              title={$_('Add advanced permission')}
            >
              {$_('Advanced')}
            </button>
          </div>

          {#if principalsOpen && (principalSuggestions.length || principalsLoading || principalsError)}
            <div class="relative">
              <div
                class="absolute z-30 mt-[-6px] w-full max-w-[520px] bg-base-200 border border-white/10 rounded-lg shadow-2xl overflow-hidden"
              >
                <div
                  class="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-base-content/40 flex items-center justify-between"
                >
                  <span>{$_('Suggestions')}</span>
                  <button
                    class="text-base-content/40 hover:text-base-content"
                    onclick={() => (principalsOpen = false)}
                  >
                    <i class="ph-bold ph-x"></i>
                  </button>
                </div>
                {#if principalsLoading}
                  <div class="px-3 py-2 text-[11px] text-base-content/50">{$_('Searching...')}</div>
                {:else if principalsError}
                  <div class="px-3 py-2 text-[11px] text-red-400">{principalsError}</div>
                {:else if principalSuggestions.length === 0}
                  <div class="px-3 py-2 text-[11px] text-base-content/50">{$_('No matches')}</div>
                {:else}
                  <div class="max-h-56 overflow-y-auto">
                    {#each principalSuggestions as item (item.key || `${item.type}:${item.id}:${item.email}`)}
                      <button
                        class="w-full text-left px-3 py-2 hover:bg-base-300/30 flex items-center justify-between gap-3"
                        onclick={() => applyPrincipalSuggestion(item)}
                      >
                        <div class="min-w-0">
                          <div class="text-[12px] text-base-content truncate">
                            {item.label || item.email || item.id}
                          </div>
                          <div class="text-[10px] text-base-content/40 uppercase tracking-[0.12em]">
                            {String(item.type || 'principal')}
                          </div>
                        </div>
                        <div class="text-[10px] text-base-content/50">{$_('Add')}</div>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          {#if permissions.length === 0}
            <p class="text-base-content/40 text-[11px]">
              {$_('Invite teammates, organizations, or teams to collaborate.')}
            </p>
          {/if}

          <div class="space-y-2">
            {#each permissions as perm, index (index)}
              <div
                class="flex flex-wrap items-center gap-2 bg-black/20 border border-white/5 rounded-md p-2"
              >
                <select
                  bind:value={perm.subjectType}
                  onchange={(e) =>
                    updatePermission(index, {
                      subjectType: (e.target as HTMLSelectElement).value as any
                    })}
                  class="bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] border border-white/10 rounded-md px-2 py-1 text-[11px] text-base-content"
                >
                  <option value="email">{$_('Email')}</option>
                  <option value="user">{$_('User ID')}</option>
                  <option value="org">{$_('Organization')}</option>
                  <option value="team">{$_('Team')}</option>
                </select>
                <input
                  bind:value={perm.subjectId}
                  placeholder={perm.subjectType === 'email'
                    ? $_('Email address')
                    : $_('Identifier')}
                  class="flex-1 min-w-[160px] bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 rounded-md py-1 px-2 text-base-content text-[11px]"
                />
                <select
                  bind:value={perm.role}
                  onchange={(e) =>
                    updatePermission(index, { role: (e.target as HTMLSelectElement).value as any })}
                  class="bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] border border-white/10 rounded-md px-2 py-1 text-[11px] text-base-content"
                >
                  <option value="viewer">{$_('Viewer')}</option>
                  <option value="commenter">{$_('Commenter')}</option>
                  <option value="editor">{$_('Editor')}</option>
                  <option value="owner">{$_('Owner')}</option>
                </select>
                <button
                  onclick={() => removePermission(index)}
                  class="text-base-content/40 hover:text-red-400 text-[12px]"
                >
                  <i class="ph-bold ph-x"></i>
                </button>
              </div>
            {/each}
          </div>
        </div>

        {#if errorMessage}
          <div class="text-red-400 text-[11px]">{errorMessage}</div>
        {/if}
        {#if successMessage}
          <div
            class="flex items-start gap-2 rounded-md border border-emerald-400/25 bg-emerald-400/10 py-2 px-2.5 text-emerald-200 text-[11px]"
            role="status"
            aria-live="polite"
          >
            <i class="ph-bold ph-check-circle mt-px shrink-0"></i>
            <span>{successMessage}</span>
          </div>
        {/if}
        {#if shareToast}
          <div class="text-emerald-300 text-[11px]">{shareToast}</div>
        {/if}

        {#if syncInProgress}
          <div class="text-base-content/60 text-[11px]">
            {$_('Syncing document to drive...')}
          </div>
        {:else if lastSyncAt}
          <div class="text-base-content/40 text-[10px]">
            {$_('Last synced')}
            {new Date(lastSyncAt).toLocaleString()}
          </div>
        {/if}

        {#if shareLink}
          <div
            class="bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] border border-white/10 rounded-lg p-3 text-[11px] text-base-content/70"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="text-[10px] uppercase tracking-[0.18em] text-base-content/40 mb-1">
                  {$_('Share link')}
                </div>
                <div
                  class="text-[11px] text-base-content/80 truncate bg-black/30 border border-white/10 rounded-md px-2 py-1"
                  title={shareLink}
                >
                  {shareLink}
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button
                  onclick={handleCopyLink}
                  class="flex items-center gap-1 text-base-300 hover:text-base-300/80"
                >
                  <i class="ph-bold ph-copy"></i>
                  {$_('Copy')}
                </button>
                <button
                  onclick={handleOpenLink}
                  class="flex items-center gap-1 text-base-content/70 hover:text-base-content"
                >
                  <i class="ph-bold ph-arrow-square-out"></i>
                  {$_('Open')}
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="flex justify-end gap-2 mt-5">
        <button
          onclick={close}
          class="px-4 py-2 text-[11px] text-base-content/70 hover:text-base-content transition-colors"
        >
          {$_('Cancel')}
        </button>
        <button
          disabled={isSaving}
          onclick={async () => {
            if (isSaving) return
            // Saving and closing are two deliberate clicks. A save used to close
            // the modal straight away, which is why nobody ever saw whether it
            // had worked; the confirmation naming the recipients has to stay
            // readable, and the next click is what dismisses it.
            if (isDirty || !hasSavedShare) {
              await handleShare()
              return
            }
            _$_shareModal.confirm({ link: shareLink, shareId })
          }}
          class="px-4 py-2 bg-base-300 rounded-md text-[11px] text-base-content font-700 hover:bg-base-300/80 disabled:opacity-40"
        >
          {isSaving
            ? $_('Saving...')
            : hasSavedShare
              ? isDirty
                ? $_('Save changes')
                : $_('Done')
              : $_('Create Share Link')}
        </button>
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
