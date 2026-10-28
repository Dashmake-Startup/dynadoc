import { get } from 'svelte/store'
import { _ } from 'svelte-i18n'
import { authStore } from '../../../stores/auth.store'
import { openAuth, getSession } from '../../../services/auth/auth.service'
import { openAlertModal } from '../../../stores/alertModal.store'
import { openConfirmModal } from '../../../stores/confirmModal.store'
import { DriveActions } from '../../../utils/driveActions'
import EditorCommonUtils from '../../../utils/common.utils'
import { _$_documentEditorsList } from '../../../stores/editor.store'

export interface ShareOptions {
  deadline?: string
  password?: string
  role?: 'viewer' | 'editor'
}

export interface NodeSharingContext {
  nodeId: string
  assetPath: string
  assetName: string
  wysiwygId: string
}

export class NodeSharing {
  static async resolveCacheDir() {
    try {
      const dir = await window.api?.getCacheDir?.()
      return typeof dir === 'string' ? dir : ''
    } catch {
      return ''
    }
  }

  static normalizeSlashes(v: string) {
    return String(v || '').replace(/\\/g, '/')
  }

  static async mapLocalCachePathToDriveHome(localPath: string): Promise<string> {
    const p = String(localPath || '').trim()
    if (!p) return ''
    if (p.startsWith('home/') || p === 'home') return p
    if (p.startsWith('drive/home/')) return p.replace(/^drive\//, '')
    if (p.startsWith('drive/')) return p.replace(/^drive\//, '')

    const cacheDir = await this.resolveCacheDir()
    if (!cacheDir) return ''
    const abs = this.normalizeSlashes(p)
    const root = this.normalizeSlashes(cacheDir).replace(/\/+$/, '')
    if (!(abs === root || abs.startsWith(root + '/'))) return ''
    const rel = abs === root ? '' : abs.slice(root.length + 1)
    const cleaned = rel.replace(/^\/+/, '')
    return cleaned ? `home/${cleaned}` : 'home'
  }

  static async ensureAuthForDrive(): Promise<boolean> {
    const state = get(authStore)
    if (state?.authenticated) return true
    
    const $_ = get(_)
    const confirm = await openConfirmModal({
      title: $_('Sign in required'),
      message: $_('Publishing requires Drive access. Sign in to continue?'),
      confirmText: $_('Sign in'),
      cancelText: $_('Cancel')
    })
    if (!confirm) return false
    await openAuth('signin')
    const session = await getSession().catch(() => null)
    return Boolean(session?.authenticated)
  }

  static async syncDocumentToDriveIfNeeded(wysiwygId: string): Promise<boolean> {
    const editorEntry = wysiwygId
      ? get(_$_documentEditorsList.get(wysiwygId))
      : get(_$_documentEditorsList.getActive())
    const doc = editorEntry?.document as any
    const cachePath = String(doc?.cachePath || '').trim()
    if (!cachePath) return true

    const driveApi = (window as any)?.api?.drive
    if (!driveApi?.syncDoc) return true

    const $_ = get(_)
    const confirm = await openConfirmModal({
      title: $_('Sync to Drive'),
      message: $_('To publish, we need to sync this document to your Drive. Continue?'),
      confirmText: $_('Sync & publish'),
      cancelText: $_('Cancel')
    })
    if (!confirm) return false

    const res = await driveApi
      .syncDoc({ cachePath })
      .catch((e: any) => ({ ok: false, message: e?.message || String(e) }))
    if (res?.ok === false) {
      await openAlertModal({
        title: $_('Drive sync failed'),
        message: res?.message || $_('Unable to sync document to Drive.')
      })
      return false
    }
    return true
  }

  static withSharedNode(link: string, sharedNode: string) {
    const raw = String(link || '').trim()
    if (!raw || !sharedNode) return raw
    try {
      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        const url = new URL(raw)
        if (!url.searchParams.get('sharedNode')) url.searchParams.set('sharedNode', sharedNode)
        return url.toString()
      }
    } catch {
      // fall through
    }
    const joiner = raw.includes('?') ? '&' : '?'
    return `${raw}${joiner}sharedNode=${encodeURIComponent(sharedNode)}`
  }

  static async setPublished(
    published: boolean,
    context: NodeSharingContext,
    options?: ShareOptions
  ) {
    const $_ = get(_)
    if (!published) {
      return { isPublished: false }
    }

    const authed = await this.ensureAuthForDrive()
    if (!authed) return null

    const synced = await this.syncDocumentToDriveIfNeeded(context.wysiwygId)
    if (!synced) return null

    const editorEntry = context.wysiwygId
      ? get(_$_documentEditorsList.get(context.wysiwygId))
      : get(_$_documentEditorsList.getActive())
    const doc = editorEntry?.document as any
    const docUuid = String(doc?.uuid || doc?.info?.uuid || '').trim()
    const docDrivePath = doc?.remotePath
      ? String(doc.remotePath)
      : await this.mapLocalCachePathToDriveHome(String(doc?.cachePath || ''))

    if (!docDrivePath || !docUuid) {
      await openAlertModal({
        title: $_('Publish'),
        message: $_('Unable to resolve the Drive path for this document. Please ensure it is saved/synced to Drive first.')
      })
      return null
    }

    const shareResult = await DriveActions.shareItem({
      path: docDrivePath,
      source: 'drive',
      docUuid,
      name: context.assetName,
      targetType: 'document',
      public: true,
      publicRole: options?.role || 'viewer',
      sharedNode: context.nodeId,
      deadline: options?.deadline,
      password: options?.password
    }).catch((e: any) => ({ ok: false, message: e?.message || String(e) }))

    const link = (shareResult as any)?.link || (shareResult as any)?.result?.link || ''
    const shareId = (shareResult as any)?.shareId || (shareResult as any)?.result?.shareId || ''

    const finalLink = this.withSharedNode(link, context.nodeId)
    
    const publishInfo = {
      shareId: shareId || undefined,
      link: finalLink || undefined,
      docDrivePath: docDrivePath || undefined,
      publishedAt: new Date().toISOString(),
      deadline: options?.deadline,
      role: options?.role || 'viewer'
    }

    if (finalLink) {
      try {
        await EditorCommonUtils.copyToClipboard(finalLink)
        await openAlertModal({ title: $_('Published'), message: $_('Public link copied to clipboard.') })
      } catch {
        await openAlertModal({ title: $_('Published'), message: finalLink })
      }
    } else {
      await openAlertModal({ title: $_('Published'), message: $_('Content is published.') })
    }

    return { isPublished: true, publish: publishInfo }
  }
}
