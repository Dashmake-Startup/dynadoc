import { get } from 'svelte/store'
import { _ } from 'svelte-i18n'
import { DriveActions } from './driveActions'
import { openAlertModal } from '../stores/alertModal.store'
import { openConfirmModal } from '../stores/confirmModal.store'
import { openShareModal } from '../stores/shareModal.store'
import { openShareManagerModal } from '../stores/shareManagerModal.store'
import { nodeApi } from './shims/node'
import Utils from './Utils'
import EditorCommonUtils from './common.utils'

const t = (key: string, values?: any) => get(_)(key, { values })

export interface ShareInfo {
  shareId?: string
  link?: string
  role?: string
  publicRole?: string
  checked?: boolean
}

export interface ShareTarget {
  path: string
  name: string
  isFolder: boolean
  isMainFile?: boolean
}

export class ShareUtils {
  static normalizeDrivePath(value: string) {
    const raw = String(value || '').trim()
    if (!raw || raw === '/' || raw === '.') return ''
    return raw
      .replace(/\\/g, '/')
      .replace(/^file:\/\//i, '')
      .replace(/^\/+/, '')
      .replace(/^drive\/+/, '')
      .replace(/\/{2,}/g, '/')
  }

  static extractDocUuid(pathValue: string) {
    const match =
      pathValue?.match(
        /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-5][a-fA-F0-9]{3}-[89abAB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}/
      ) || []
    return match[0] || ''
  }

  static async fetchShareForPath(pathValue: string, isDriveSource: boolean, accountOrg?: string) {
    if (!isDriveSource) {
      const drivePath = this.normalizeDrivePath(pathValue)
      const result = await DriveActions.getShare(
        accountOrg ? { accountOrg, path: drivePath, source: 'drive' } : { path: drivePath, source: 'drive' }
      )
      if (!result?.ok) return null
      return result?.result || result?.share || result
    }
    const payload = {
      path: this.normalizeDrivePath(pathValue),
      source: 'drive'
    }
    const finalPayload = accountOrg ? { ...payload, accountOrg } : payload
    const result = await DriveActions.getShare(finalPayload)
    if (!result?.ok) return null
    return result?.result || result?.share || result
  }

  static async openShareLink(link: string) {
    const api = (window as any).api
    if (api?.openExternal) {
      await api.openExternal(link)
      return
    }
    window.open(link, '_blank', 'noopener')
  }

  static async ensureDriveShareForDisk(
    item: { path: string; isFolder: boolean; isMainFile?: boolean },
    options: {
      accountOrg?: string
      ensureSync: boolean
      onSyncStart?: () => void
      onSyncEnd?: () => void
      resolveRootDocument: () => any
    }
  ) {
    const drivePath = this.normalizeDrivePath(item.path)
    const payload = options.accountOrg
      ? { accountOrg: options.accountOrg, path: drivePath, source: 'drive' }
      : { path: drivePath, source: 'drive' }

    const initial = await DriveActions.getShare(payload)
    const initialShare = initial?.result || initial?.share || initial
    if (initial?.ok && initialShare?.link) {
      return { share: initialShare, drivePath }
    }
    if (!options.ensureSync) return { share: initialShare?.link ? initialShare : null, drivePath }

    const cachePath = this.resolveCachePathForDiskItem(item, options.resolveRootDocument)
    if (!cachePath) {
      await openAlertModal({
        title: t('Share'),
        message: t('Sync requires an opened document. Open it once, then try sharing again.')
      })
      return { share: null, drivePath }
    }

    options.onSyncStart?.()
    let syncResult: any = null
    try {
      syncResult = await DriveActions.syncDoc({ cachePath })
    } finally {
      options.onSyncEnd?.()
    }

    if (!syncResult?.ok) {
      await openAlertModal({
        title: t('Share'),
        message: syncResult?.message || t('Drive sync is required before sharing.')
      })
      return { share: null, drivePath }
    }

    const retry = await DriveActions.getShare(payload)
    const retryShare = retry?.result || retry?.share || retry
    return { share: retryShare?.link ? retryShare : null, drivePath }
  }

  private static resolveCachePathForDiskItem(
    item: { path: string; isFolder: boolean; isMainFile?: boolean },
    resolveRootDocument: () => any
  ) {
    if (!nodeApi.fs || !nodeApi.path) return ''
    const rootDocument = resolveRootDocument()
    if (rootDocument?.cachePath || rootDocument?.cacheDirPath) {
      return rootDocument.cachePath || rootDocument.cacheDirPath || ''
    }
    if (item.isFolder) {
      const mainFile = nodeApi.path.join(item.path, Utils.MAIN_DOCUMENT_FILE)
      if (nodeApi.fs.existsSync(mainFile)) return item.path
    }
    if (item.isMainFile) return nodeApi.path.dirname(item.path)
    const parentDir = nodeApi.path.dirname(item.path)
    const parentMain = nodeApi.path.join(parentDir, Utils.MAIN_DOCUMENT_FILE)
    if (nodeApi.fs.existsSync(parentMain)) return parentDir
    return ''
  }
}

export class ShareActions {
  static async share(
    item: ShareTarget,
    options: {
      isDriveSource: boolean
      accountOrg?: string
      resolveRootDocument: () => any
      onNotify?: (message: string) => void
      onSyncStart?: () => void
      onSyncEnd?: () => void
    }
  ) {
    const docUuid = ShareUtils.extractDocUuid(item.path)
    let path: string
    let initialLink = ''
    let initialShareId = ''
    let initialPublic = false
    let initialPublicRole: any = 'viewer'
    let initialExpiresAt = ''
    let initialPermissions: any[] = []
    let initialMetadata: Record<string, any> = {}

    if (options.isDriveSource) {
      path = ShareUtils.normalizeDrivePath(item.path)
    } else {
      const ensured = await ShareUtils.ensureDriveShareForDisk(item, {
        ensureSync: true,
        accountOrg: options.accountOrg,
        onSyncStart: options.onSyncStart,
        onSyncEnd: options.onSyncEnd,
        resolveRootDocument: options.resolveRootDocument
      })
      if (!ensured.drivePath) return
      path = ensured.drivePath
      initialLink = ensured.share?.link || ''
      initialShareId = ensured.share?.shareId || ensured.share?.id || ''
    }

    // Hydrate existing share settings from backend so the modal is always editing the true persisted state.
    const existing = await ShareUtils.fetchShareForPath(path, true, options.accountOrg)
    if (existing?.link) {
      initialLink = existing.link || initialLink
      initialShareId = existing.shareId || existing.id || initialShareId
      initialPublic = Boolean(existing.public)
      initialPublicRole = (existing.publicRole || existing.role || existing.publicRole) as any
      initialExpiresAt = existing.expiresAt || ''
      initialPermissions = Array.isArray(existing.permissions) ? existing.permissions : []
      initialMetadata = existing.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}
    }

    const result = await openShareModal({
      path,
      name: item.name,
      source: 'drive',
      targetType: item.isFolder ? 'folder' : 'file',
      docUuid,
      accountOrg: options.accountOrg,
      initialLink,
      initialShareId,
      initialPublic,
      initialPublicRole,
      initialExpiresAt,
      initialPermissions,
      ...(Object.keys(initialMetadata || {}).length ? { initialMetadata } : {})
    })

    if (result?.link) options.onNotify?.(t('Share link created'))
    return result
  }

  static async copyShareLink(
    item: ShareTarget,
    options: {
      isDriveSource: boolean
      accountOrg?: string
      resolveRootDocument: () => any
      onNotify?: (message: string) => void
      onSyncStart?: () => void
      onSyncEnd?: () => void
    }
  ) {
    let share = await ShareUtils.fetchShareForPath(item.path, options.isDriveSource, options.accountOrg)
    if (!share?.link) {
      const result = await this.share(item, options)
      if (result?.link) {
        await EditorCommonUtils.copyToClipboard(result.link)
        options.onNotify?.(t('Share link copied'))
      }
      return
    }
    await EditorCommonUtils.copyToClipboard(share.link)
    options.onNotify?.(t('Share link copied'))
  }

  static async openShareLink(
    item: ShareTarget,
    options: {
      isDriveSource: boolean
      accountOrg?: string
      resolveRootDocument: () => any
      onNotify?: (message: string) => void
      onSyncStart?: () => void
      onSyncEnd?: () => void
    }
  ) {
    let share = await ShareUtils.fetchShareForPath(item.path, options.isDriveSource, options.accountOrg)
    if (!share?.link) {
      const result = await this.share(item, options)
      if (result?.link) {
        await ShareUtils.openShareLink(result.link)
      }
      return
    }
    await ShareUtils.openShareLink(share.link)
  }

  static async revokeShare(
    item: ShareTarget,
    options: {
      isDriveSource: boolean
      accountOrg?: string
      onNotify?: (message: string) => void
    }
  ) {
    const share = await ShareUtils.fetchShareForPath(item.path, options.isDriveSource, options.accountOrg)
    if (!share?.shareId && !share?.id) {
      await openAlertModal({ title: t('Share'), message: t('No active share found for this item.') })
      return
    }
    const ok = await openConfirmModal({
      title: t('Revoke share?'),
      message: t('This link will stop working immediately.')
    })
    if (!ok) return

    const shareId = share.shareId || share.id
    const revokePayload = options.isDriveSource
      ? (options.accountOrg ? { accountOrg: options.accountOrg, shareId, source: 'drive' } : { shareId, source: 'drive' })
      : { shareId, source: 'disk' }

    const result = await DriveActions.revokeShare(revokePayload)
    if (!result?.ok) {
      await openAlertModal({ title: t('Share'), message: result?.message || t('Unable to revoke share.') })
      return
    }
    options.onNotify?.(t('Share revoked'))
  }

  static async manageShares(options: { accountOrg?: string }) {
    await openShareManagerModal(options.accountOrg ? { accountOrg: options.accountOrg } : undefined)
  }
}
