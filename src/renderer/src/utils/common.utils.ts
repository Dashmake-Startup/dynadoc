import {
  DocumentEditorModel,
  DocumentModel,
  type DocumentContentKindType,
  type DocumentContentType
} from '../models/Document'
import {
  _$_currentView,
  showOnly,
  switchView,
  _$_lastOpenError,
  _$_recentDocuments,
  type RecentDocumentEntry
} from '../stores/common.store'
import { openAlertModal } from '../stores/alertModal.store'
import { openFolderStructureModal } from '../stores/folderStructureModal.store'
import { _$_documentEditorsList } from '../stores/editor.store'
import EditorHelpers from './EditorHelpers'
import Utils from './Utils'
import { authStore, startAuth, refreshAuthSession } from '../stores/auth.store'
import { get } from 'svelte/store'
import Platform from '../libs/platform'
import { openConfirmModal } from '../stores/confirmModal.store'
import { saveSnapshot } from '../services/save/savePipeline.service'
import { openTextInputModal } from '../stores/textInputModal.store'
import toast from 'svelte-hot-french-toast'
import { resolveApiBaseUrl } from '../lib/api/shared/baseUrl'
import {
  mountShareFile,
  mountShareZip,
  shareCacheHas,
  shareCacheListDir,
  shareCacheStat
} from './shareCache'
import { enterPublicShareGuestMode, hasAccessToken } from './authMode'
import { getValidStepUpToken } from '../services/auth/stepup.service'
import { openStepUpModal } from '../stores/stepUpModal.store'
import { setShareLinkContext } from '../stores/shareLink.store'
import { nodeApi } from './shims/node'
import { openTiming } from './openTiming'
import { isLocalAssetRef } from './assetUrl'

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

export function goToHomeScreen() {
  // showOnly('homeScreen')
  // _$_currentView.set('home')
  switchView('home')
  _$_lastOpenError.set(null)

  _$_documentEditorsList.clearActive()
}
export function goToNewDocumentScreen() {
  // showOnly('newDocument')
  // _$_currentView.set('new-doc')
  switchView('new-doc')
  _$_lastOpenError.set(null)
  _$_documentEditorsList.clearActive()
}

export function cryptoRandomUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for non-secure contexts
  return ([1e7].toString() + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  )
}

export default class EditorCommonUtils {
  static pendingAuthKey = 'ddoc.auth.pendingAction'

  static setPendingAuthAction(action: { type: string; payload?: any }) {
    if (typeof window === 'undefined') return
    try {
      const enriched = { ...action, createdAt: new Date().toISOString() }
      window.localStorage.setItem(EditorCommonUtils.pendingAuthKey, JSON.stringify(enriched))
    } catch {
      // ignore
    }
  }

  static readPendingAuthAction(): { type: string; payload?: any } | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(EditorCommonUtils.pendingAuthKey)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }

  static clearPendingAuthAction() {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(EditorCommonUtils.pendingAuthKey)
    } catch {
      // ignore
    }
  }

  static async runPendingAuthAction() {
    const action = EditorCommonUtils.readPendingAuthAction()
    if (!action) return false
    EditorCommonUtils.clearPendingAuthAction()
    const payload = action.payload || {}
    try {
      if (action.type === 'create-doc') {
        await EditorCommonUtils.addNewDocumentEditor(
          null,
          payload?.parentPath || null,
          undefined,
          payload?.contentType,
          payload?.contentKind,
          payload?.content || '',
          payload?.associatedMeetingLinks || []
        )
        return true
      }
      if (action.type === 'open-doc') {
        await EditorCommonUtils.addNewDocumentEditor(
          payload?.path,
          payload?.parentPath || null,
          undefined,
          payload?.contentType,
          payload?.contentKind,
          payload?.content || '',
          payload?.associatedMeetingLinks || []
        )
        return true
      }
      if (action.type === 'open-share') {
        await EditorCommonUtils.openDocumentFromShareLink(payload?.link)
        return true
      }
    } catch {
      // ignore
    }
    return false
  }
  public static isLikelyShareLink(input: string) {
    const normalized = (input || '').trim()
    if (!normalized) return false
    if (
      normalized.startsWith('share:') ||
      normalized.startsWith('collab:') ||
      normalized.startsWith('yjs:')
    )
      return true
    if (normalized.includes('shareId=')) return true
    if (normalized.includes('#shareId=')) return true
    if (
      normalized.match(
        /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-5][a-fA-F0-9]{3}-[89abAB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}\/index\.html/i
      )
    )
      return true
    return false
  }

  public static isLikelyRemotePath(input: string) {
    const normalized = (input || '').trim().replace(/^\/+/, '')
    if (!normalized) return false
    if (
      normalized.startsWith('home/') ||
      normalized.startsWith('drive/') ||
      normalized.startsWith('public-temp/') ||
      normalized.startsWith('share-cache/') ||
      normalized.startsWith('cache/')
    ) {
      return true
    }
    return false
  }

  public static isLikelyLocalPath(input: string) {
    const raw = (input || '').trim()
    if (!raw) return false
    if (isLocalAssetRef(raw)) return true
    if (/^[a-zA-Z]:[\\/]/.test(raw)) return true
    if (raw.startsWith('~/')) return true
    if (raw.startsWith('/')) return true
    return false
  }

  public static isLikelyFileInput(input: string) {
    const normalized = (input || '').trim()
    if (!normalized) return false
    if (EditorCommonUtils.isLikelyShareLink(normalized)) return true
    if (EditorCommonUtils.isLikelyRemotePath(normalized)) return true
    if (EditorCommonUtils.isLikelyLocalPath(normalized)) return true
    return /\\.[a-zA-Z0-9]{1,10}$/.test(normalized)
  }

  static normalizeShareLink(input: string) {
    const normalized = (input || '').trim()
    if (!normalized) return ''
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized
    if (
      normalized.startsWith('share:') ||
      normalized.startsWith('collab:') ||
      normalized.startsWith('yjs:')
    ) {
      return normalized
    }
    return normalized
  }

  static parseShareLink(input: string) {
    const normalized = (input || '').trim()
    const parsed = {
      shareId: '',
      docUuid: '',
      name: '',
      password: '',
      path: ''
    }
    if (!normalized) return parsed

    const shareParamMatch = normalized.match(/[?&#]shareId=([^&#]+)/i)
    if (shareParamMatch?.[1]) parsed.shareId = decodeURIComponent(shareParamMatch[1])
    const passwordMatch = normalized.match(/[?&#](password|sharePassword)=([^&#]+)/i)
    if (passwordMatch?.[2]) parsed.password = decodeURIComponent(passwordMatch[2])

    if (
      normalized.startsWith('share:') ||
      normalized.startsWith('collab:') ||
      normalized.startsWith('yjs:')
    ) {
      const raw = normalized.replace(/^(share:|collab:|yjs:)/i, '')
      const [head, query] = raw.split('?')
      if (!parsed.shareId && head) parsed.shareId = head.replace(/^\/+/, '')
      if (query && !parsed.password) {
        const passMatch = query.match(/(?:^|&)password=([^&]+)/i)
        if (passMatch?.[1]) parsed.password = decodeURIComponent(passMatch[1])
      }
      return parsed
    }

    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      try {
        const url = new URL(normalized)
        if (!parsed.shareId) parsed.shareId = url.searchParams.get('shareId') || ''
        if (!parsed.password)
          parsed.password =
            url.searchParams.get('password') || url.searchParams.get('sharePassword') || ''
        const segments = url.pathname.split('/').filter(Boolean)
        if (segments.length >= 2) {
          const maybeUuid = segments[0]
          if (
            maybeUuid.match(
              /[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/i
            )
          ) {
            parsed.docUuid = maybeUuid
            const relParts = segments.slice(1)
            parsed.path = decodeURIComponent(relParts.join('/'))
          }
          parsed.name = decodeURIComponent(segments[segments.length - 1] || '')
        }
      } catch {
        // ignore URL parse
      }
    }

    if (!parsed.docUuid) {
      const uuidMatch = normalized.match(
        /[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/i
      )
      if (uuidMatch?.[0]) parsed.docUuid = uuidMatch[0]
    }
    return parsed
  }

  static getWebAccessToken() {
    if (typeof localStorage === 'undefined') return ''
    try {
      return localStorage.getItem('ddoc.access_token') || ''
    } catch {
      return ''
    }
  }

  public static async openDriveItem(payload: {
    path?: string
    rootPath?: string
    isFolder?: boolean
  }): Promise<{ ok: boolean; message?: string }> {
    const targetPath = payload?.path || ''
    if (!targetPath) return { ok: false, message: 'Path is required.' }
    if (payload?.isFolder || targetPath === '/' || targetPath.endsWith('/')) {
      return { ok: true }
    }

    const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
    if (isDesktopPlatform && window?.server?.drive?.openItem) {
      return window.server.drive.openItem(payload)
    }

    await EditorCommonUtils.addNewDocumentEditor(targetPath, payload?.rootPath || null)
    return { ok: true }
  }

  static async importSharedDocumentRemote(link: string) {
    const parsed = EditorCommonUtils.parseShareLink(link)
    EditorCommonUtils.setPendingAuthAction({ type: 'open-share', payload: { link } })
    const authed = await EditorCommonUtils.ensureAuthenticated()
    if (!authed) {
      throw new Error('Sign in required to open shared documents.')
    }

    const baseUrl = resolveApiBaseUrl()
    const token = EditorCommonUtils.getWebAccessToken()

    const callImport = async (stepUpToken: string) => {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/share/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          shareId: parsed.shareId || undefined,
          docUuid: parsed.docUuid || undefined,
          name: parsed.name || undefined,
          password: parsed.password || undefined,
          stepupToken: stepUpToken || undefined
        })
      })
      return { res, body: await res.json().catch(() => ({})) }
    }

    let { res: response, body: payload } = await callImport(getValidStepUpToken() || '')

    // The share is protected: the server wants a fresh emailed verification
    // before it serves anything (HTTP 428). Run the step-up modal — the code
    // goes to the recipient's own account email — then retry once.
    if (response.status === 428 || payload?.error === 'stepup_required') {
      const freshToken = await openStepUpModal()
      if (!freshToken) {
        throw new Error('Verification is required to open this document.')
      }
      ;({ res: response, body: payload } = await callImport(freshToken))
    }

    if (payload?.requiresSync) {
      const pathValue = payload?.path || ''
      throw new Error(`SYNC_REQUIRED::${pathValue}`)
    }
    if (!response.ok || payload?.ok === false) {
      const message = payload?.error || payload?.message || 'Unable to import shared document.'
      throw new Error(String(message))
    }
    return payload
  }

  static async openPublicShareInBrowser(link: string) {
    const parsed = EditorCommonUtils.parseShareLink(link)
    const baseUrl = resolveApiBaseUrl().replace(/\/$/, '')
    const params = new URLSearchParams()
    if (parsed.shareId) params.set('shareId', parsed.shareId)
    if (parsed.docUuid) params.set('docUuid', parsed.docUuid)
    if (parsed.name) params.set('name', parsed.name)
    if (parsed.password) params.set('password', parsed.password)

    // Send the session when we have one. A share restricted to named
    // recipients answers 401 to an anonymous caller, so resolving without the
    // token made a signed-in recipient look like a stranger — the link then
    // failed with a misleading error instead of simply opening.
    const callResolve = async () => {
      const sessionToken = EditorCommonUtils.getWebAccessToken()
      return fetch(`${baseUrl}/share/resolve?${params.toString()}`, {
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined
      })
    }
    let resolvedRes = await callResolve()
    // A stale access token is indistinguishable from no token at all to the
    // server, which answers 401 either way. Renew once and retry before
    // concluding the recipient has no right to this link: a signed-in reader
    // whose token had simply aged out was being told the document was missing.
    if (resolvedRes.status === 401 && EditorCommonUtils.getWebAccessToken()) {
      const { refreshAccessToken } = await import('../lib/api/web/rpc')
      if (await refreshAccessToken()) resolvedRes = await callResolve()
    }
    const resolvedPayload = await resolvedRes.json().catch(() => ({}))
    if (!resolvedRes.ok || resolvedPayload?.ok === false) {
      // 401 here means "this link is not open to everyone", not "broken link".
      // A reader who is not signed in has somewhere useful to go, so send them
      // there instead of ending on an error: the sign-in flow returns to this
      // same URL, share identifier included, and the link then opens by itself.
      // Without this the visitor was told the document could not be found,
      // which is both false and a dead end.
      if (resolvedRes.status === 401) {
        if (!Platform.isDesktopPlatform && !EditorCommonUtils.getWebAccessToken()) {
          void startAuth('signin')
        }
        throw new Error('Sign in required to open this share link.')
      }
      const message =
        resolvedPayload?.error || resolvedPayload?.message || 'Unable to resolve share link.'
      throw new Error(String(message))
    }
    openTiming.mark('share-resolved')
    const shareInfo = resolvedPayload?.data || resolvedPayload
    console.log('openPublicShareInBrowser resolved share info ', {
      params,
      resolvedPayload,
      shareInfo
    })
    // const shareInfo = resolvedPayload?.data || resolvedPayload
    if (!shareInfo?.canView) {
      throw new Error('This share link is not accessible.')
    }
    if (shareInfo?.requiresAuth) {
      throw new Error('Sign in required to open this share link.')
    }
    enterPublicShareGuestMode()

    const resolveShareRelativePath = (pathValue?: string, docUuid?: string) => {
      const cleaned = String(pathValue || '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
      if (!cleaned) return ''
      if (!docUuid) return cleaned
      const prefixes = [`home/${docUuid}/`, `drive/home/${docUuid}/`, `${docUuid}/`]
      for (const prefix of prefixes) {
        if (cleaned.startsWith(prefix)) {
          return cleaned.slice(prefix.length)
        }
      }
      return cleaned
    }

    const downloadParams = new URLSearchParams()
    if (parsed.shareId || shareInfo?.shareId)
      downloadParams.set('shareId', parsed.shareId || shareInfo.shareId)
    if (parsed.docUuid || shareInfo?.docUuid)
      downloadParams.set('docUuid', parsed.docUuid || shareInfo.docUuid)
    if (parsed.name || shareInfo?.name) downloadParams.set('name', parsed.name || shareInfo.name)
    if (parsed.password) downloadParams.set('password', parsed.password)

    // Resolving the link authenticates fine, but fetching the content is a
    // second request: sending it anonymously made the server answer 401 for any
    // share that is not fully public, so a legitimate recipient was stopped one
    // step short of the document. Carry the session here too, plus a step-up
    // token when we already hold one.
    const downloadFetch = async (stepUpToken: string) => {
      // Read the token here rather than reusing the one resolve captured: that
      // one lives inside callResolve and is not in scope, so every call to this
      // threw ReferenceError before reaching the network. Reading it again is
      // also the correct thing -- resolve may have renewed it in between.
      const sessionToken = EditorCommonUtils.getWebAccessToken()
      const p = new URLSearchParams(downloadParams)
      if (stepUpToken) p.set('stepupToken', stepUpToken)
      return fetch(`${baseUrl}/share/download?${p.toString()}`, {
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
        // The archive is rebuilt as the document changes; a copy the browser
        // kept from an earlier open must never stand in for it.
        cache: 'no-store'
      })
    }

    let downloadRes = await downloadFetch(getValidStepUpToken() || '')

    // The document is protected: verify, then retry once with the fresh token.
    if (downloadRes.status === 428) {
      const freshToken = await openStepUpModal()
      if (!freshToken) {
        throw new Error('Verification is required to open this document.')
      }
      downloadRes = await downloadFetch(freshToken)
    }
    console.log('openPublicShareInBrowser downloadRes ', { downloadRes, downloadParams })

    if (!downloadRes.ok) {
      if (downloadRes.status === 401) {
        throw new Error('Sign in required to open this share link.')
      }
      const text = await downloadRes.text().catch(() => '')
      throw new Error(text || 'Failed to download share content.')
    }
    const contentType = String(downloadRes.headers.get('content-type') || '')
    const blob = await downloadRes.blob()
    const buffer = await blob.arrayBuffer()
    if (contentType.includes('zip') || /\.zip$/i.test(shareInfo?.name || '')) {
      const normalizeDocFolder = (value?: string) =>
        String(value || '')
          .replace(/\\/g, '/')
          .replace(/\/index\.html?$/i, '')
          .replace(/\/index$/i, '')
          .replace(/\/+$/g, '')
      // const normalizeRootName = (value?: string) =>
      //   String(value || '')
      //     .replace(/\/index\.html?$/i, '')
      //     .replace(/\/index$/i, '')
      //     .replace(/\/+$/g, '')
      const mounted = mountShareZip(parsed.shareId || shareInfo?.shareId || 'share', buffer, {
        baseId:
          shareInfo?.docUuid || parsed.docUuid || parsed.shareId || shareInfo?.shareId || 'share',
        preferredRootName: shareInfo?.docFolder || shareInfo?.name || parsed.name || ''
        // preferredRootName: normalizeRootName(shareInfo?.docFolder || shareInfo?.name || parsed.name || '')
      })
      openTiming.mark('archive-mounted')
      const preferredMain = `${mounted.root}/${Utils.MAIN_DOCUMENT_FILE}`
      let resolvedPath = mounted.root
      let desiredRelative =
        resolveShareRelativePath(parsed.path, shareInfo?.docUuid || parsed.docUuid) ||
        resolveShareRelativePath(shareInfo?.path, shareInfo?.docUuid || parsed.docUuid)
      const joinSharePath = (root: string, rel: string) =>
        `${root}/${rel}`.replace(/\/{2,}/g, '/').replace(/^\/+/, '')
      if (desiredRelative) {
        const docFolder = normalizeDocFolder(shareInfo?.docFolder || shareInfo?.name || parsed.name)
        const rootSuffix = mounted.root.replace(/^share-cache\/[^/]+\//, '')
        if (docFolder && (rootSuffix === docFolder || rootSuffix.startsWith(`${docFolder}/`))) {
          if (desiredRelative.startsWith(`${docFolder}/`)) {
            desiredRelative = desiredRelative.slice(docFolder.length + 1)
          } else if (desiredRelative === docFolder) {
            desiredRelative = ''
          }
        }
        let candidate = joinSharePath(mounted.root, desiredRelative)
        if (shareCacheHas(candidate)) {
          if (shareCacheStat(candidate)?.isDirectory?.()) {
            const indexCandidate = joinSharePath(candidate, Utils.MAIN_DOCUMENT_FILE)
            if (shareCacheHas(indexCandidate)) {
              resolvedPath = indexCandidate
            } else {
              resolvedPath = candidate
            }
          } else {
            resolvedPath = candidate
          }
        } else {
          const withIndex = joinSharePath(candidate, Utils.MAIN_DOCUMENT_FILE)
          if (shareCacheHas(withIndex)) {
            resolvedPath = withIndex
          }
        }
      }
      if (shareCacheHas(preferredMain)) {
        resolvedPath = preferredMain
      } else {
        const children = shareCacheListDir(mounted.root)
        if (children.length === 1) {
          const onlyPath = `${mounted.root}/${children[0]}`
          if (shareCacheStat(onlyPath)?.isFile?.()) {
            resolvedPath = onlyPath
          }
        }
      }
      // Opening the mount root itself — a folder — produced a blank document
      // with no error. Say what was mounted and what was looked for instead.
      if (!shareCacheHas(resolvedPath) || shareCacheStat(resolvedPath)?.isDirectory?.()) {
        const mountedEntries = shareCacheListDir(mounted.root)
        console.error('openPublicShareInBrowser: no document file in the mounted archive', {
          root: mounted.root,
          resolvedPath,
          preferredMain,
          mountedEntries
        })
        throw new Error(
          `The shared archive has no document to open (looked for ${Utils.MAIN_DOCUMENT_FILE} under "${mounted.root}", found: ${mountedEntries.join(', ') || 'nothing'}).`
        )
      }
      const result = {
        filePath: resolvedPath,
        targetType: shareInfo?.targetType || 'file',
        openMode:
          shareInfo?.canEdit && !shareInfo?.editLocked
            ? DocumentModel.OpenMode.WRITE
            : DocumentModel.OpenMode.READ,
        shareId: parsed.shareId || shareInfo?.shareId,
        docUuid: shareInfo?.docUuid || parsed.docUuid,
        ownerId: shareInfo?.ownerId,
        role: shareInfo?.role,
        name: shareInfo?.name
      }

      console.log('openPublicShareInBrowser returnreturn ', { result })

      return result
    }
    console.log('openPublicShareInBrowser contentType ', { contentType, buffer, shareInfo })

    const data = new Uint8Array(buffer)
    const relativePath =
      resolveShareRelativePath(parsed.path, shareInfo?.docUuid || parsed.docUuid) ||
      resolveShareRelativePath(shareInfo?.path, shareInfo?.docUuid || parsed.docUuid)
    const mounted = mountShareFile(
      parsed.shareId || shareInfo?.shareId || 'share',
      relativePath || shareInfo?.name || 'shared-file',
      data,
      {
        baseId:
          shareInfo?.docUuid || parsed.docUuid || parsed.shareId || shareInfo?.shareId || 'share'
      }
    )
    openTiming.mark('archive-mounted')
    const result = {
      filePath: mounted.filePath,
      openMode:
        shareInfo?.canEdit && !shareInfo?.editLocked
          ? DocumentModel.OpenMode.WRITE
          : DocumentModel.OpenMode.READ,
      shareId: parsed.shareId || shareInfo?.shareId,
      docUuid: shareInfo?.docUuid || parsed.docUuid,
      ownerId: shareInfo?.ownerId,
      role: shareInfo?.role,
      name: shareInfo?.name
    }
    console.log('openPublicShareInBrowser returnreturn22 ', { result })
    return result
  }

  static async downloadSharedDocumentDesktop(link: string) {
    if (!window?.server?.share?.resolve || !window?.server?.share?.download) {
      throw new Error('Share downloads are unavailable on this platform.')
    }

    const parsed = EditorCommonUtils.parseShareLink(link)
    let password = parsed.password

    const attemptResolve = async () => {
      return window.server.share.resolve({
        shareId: parsed.shareId || undefined,
        docUuid: parsed.docUuid || undefined,
        name: parsed.name || undefined,
        password: password || undefined
      })
    }

    let resolved = await attemptResolve()
    if (!resolved?.ok) {
      const message = String(resolved?.message || '')
      if (!password && message.toLowerCase().includes('password')) {
        const input = await openTextInputModal({
          title: 'Password required',
          message: 'This share link is protected. Enter the password to continue.',
          placeholder: 'Password',
          confirmText: 'Unlock',
          cancelText: 'Cancel'
        })
        if (!input) return null
        password = input
        resolved = await attemptResolve()
      }
    }

    if (!resolved?.ok) {
      const message = resolved?.message || 'Unable to access shared document.'
      throw new Error(String(message))
    }

    const shareInfo = resolved?.data || {}
    // const shareInfo = resolved?.result || {}
    if (!shareInfo?.canView) {
      throw new Error('You do not have permission to view this document.')
    }

    const download = await window.server.share.download({
      shareId: parsed.shareId || shareInfo?.shareId,
      docUuid: parsed.docUuid || shareInfo?.docUuid,
      name: parsed.name || shareInfo?.name,
      password: password || undefined
    })

    if (!download?.ok) {
      const message = download?.message || 'Unable to download shared document.'
      throw new Error(String(message))
    }

    let filePath = String(download?.filePath || '')
    if (!filePath) {
      throw new Error('Downloaded file was not available.')
    }

    const isZip = /\.zip$/i.test(filePath) || String(download?.contentType || '').includes('zip')
    const cacheRoot = await window.api.getCacheDir()
    const docUuid = String(
      shareInfo?.docUuid || parsed.docUuid || shareInfo?.shareId || parsed.shareId || 'share'
    )
    const sharedPath = String(shareInfo?.path || '')
    const deriveDocFolderName = () => {
      const fromServer = String(shareInfo?.docFolder || '').trim()
      if (fromServer) return fromServer
      if (sharedPath) {
        const cleaned = sharedPath.replace(/\\/g, '/').replace(/\/+$/, '')
        const parts = cleaned.split('/').filter(Boolean)
        if (parts.length >= 2) return parts[parts.length - 2]
        if (parts.length === 1) return parts[0].replace(/\.[^/.]+$/, '')
      }
      const baseName = String(shareInfo?.name || parsed.name || 'shared-document')
      return baseName.replace(/\.[^/.]+$/, '') || 'shared-document'
    }
    const docFolder = deriveDocFolderName()
    const targetRoot = nodeApi.path.join(cacheRoot, 'shared', docUuid, docFolder)

    if (isZip && window?.api?.getCacheDir && window?.api?.unddocify) {
      let unzipDir = await window.api.unddocify(filePath, targetRoot, false)
      try {
        const entries = await nodeApi.fsPromises.readdir(unzipDir)
        if (entries?.length === 1) {
          const onlyEntry = nodeApi.path.join(unzipDir, entries[0])
          if (
            (await nodeApi.fsPromises.exists(onlyEntry)) &&
            (await nodeApi.fsPromises.stat(onlyEntry)).isDirectory()
          ) {
            unzipDir = onlyEntry
          }
        }
      } catch {
        // ignore folder normalization
      }
      const indexPath = nodeApi.path.join(unzipDir, Utils.MAIN_DOCUMENT_FILE)
      if (await nodeApi.fsPromises.exists(indexPath)) {
        filePath = indexPath
      } else {
        filePath = unzipDir
      }
      try {
        const metaPath = nodeApi.path.join(unzipDir, 'share.meta.json')
        const meta = {
          shareId: shareInfo?.shareId || parsed.shareId || '',
          docUuid: docUuid,
          name: shareInfo?.name || parsed.name || '',
          downloadedAt: new Date().toISOString(),
          contentType: download?.contentType || ''
        }
        await nodeApi.fsPromises.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
      } catch {
        // ignore meta write failures
      }
    } else if (cacheRoot) {
      try {
        await nodeApi.fsPromises.mkdir(targetRoot, { recursive: true })
        const targetFileName = nodeApi.path.basename(filePath)
        const destPath = nodeApi.path.join(targetRoot, targetFileName)
        if (filePath !== destPath) {
          try {
            await nodeApi.fsPromises.rename(filePath, destPath)
          } catch {
            await nodeApi.fsPromises.copyFile(filePath, destPath)
          }
        }
        filePath = destPath
        try {
          const metaPath = nodeApi.path.join(targetRoot, 'share.meta.json')
          const meta = {
            shareId: shareInfo?.shareId || parsed.shareId || '',
            docUuid: docUuid,
            name: shareInfo?.name || parsed.name || '',
            downloadedAt: new Date().toISOString(),
            contentType: download?.contentType || ''
          }
          await nodeApi.fsPromises.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
        } catch {
          // ignore meta write failures
        }
      } catch {
        // ignore move failures
      }
    }

    const openMode =
      shareInfo?.canEdit && !shareInfo?.editLocked
        ? DocumentModel.OpenMode.WRITE
        : DocumentModel.OpenMode.READ

    return {
      filePath,
      targetType: shareInfo?.targetType || 'file',
      openMode,
      shareInfo
    }
  }

  static getShareLinkFromLocation() {
    if (typeof window === 'undefined') return ''
    const href = window.location?.href || ''
    if (href && EditorCommonUtils.isLikelyShareLink(href)) return href
    try {
      const stored = window.sessionStorage?.getItem?.('ddoc.initial_url') || ''
      if (stored && EditorCommonUtils.isLikelyShareLink(stored)) return stored
    } catch {
      // ignore
    }
    return ''
  }

  static async openDocumentFromShareLink(link?: string | null) {
    const normalized = EditorCommonUtils.normalizeShareLink(link || '')
    if (!normalized || !EditorCommonUtils.isLikelyShareLink(normalized)) {
      await openAlertModal({
        title: 'Open shared link',
        message: 'Please paste a valid share link.'
      })
      return false
    }
    const toastId = toast.loading('Opening shared document...')
    // SET cursor to waiting
    document.body.style.cursor = 'wait'
    document.body.classList.add('is-loading')
    try {
      await EditorCommonUtils.addNewDocumentEditor(normalized, null)
      // toast.dismiss(toastId)
      // RESET cursor to default
      // document.body.style.cursor = 'default'
      return true
    } catch (error) {
      // toast.dismiss(toastId)
      // RESET cursor to default
      // document.body.style.cursor = 'default'
      const message = error instanceof Error ? error.message : String(error || '')
      console.error('Failed to open shared link:', error)
      await openAlertModal({
        title: 'Unable to open link',
        message:
          message || 'The shared link could not be opened. Please check the link and try again.'
      })
      return false
    } finally {
      // RESET cursor to default
      // document.body.style.cursor = 'default'
      // document.body.classList.remove('is-loading');
      EditorCommonUtils.toggleDocumentBodyLoading()
      toast.dismiss(toastId)
    }
  }

  static async openDocumentFromInput(
    input?: string | null,
    options?: { parentPath?: string | null }
  ) {
    const normalized = (input || '').trim()
    if (!normalized) return false

    if (EditorCommonUtils.isLikelyShareLink(normalized)) {
      return EditorCommonUtils.openDocumentFromShareLink(normalized)
    }

    const parentPath = options?.parentPath ?? null
    if (EditorCommonUtils.isLikelyRemotePath(normalized)) {
      await EditorCommonUtils.addNewDocumentEditor(normalized, parentPath)
      return true
    }

    const isDesktop = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
    if (EditorCommonUtils.isLikelyLocalPath(normalized)) {
      if (isDesktop) {
        await EditorCommonUtils.addNewDocumentEditor(normalized, parentPath)
        return true
      }
      const uploaded = await window.api?.openDialogFile?.()
      if (uploaded) {
        await EditorCommonUtils.addNewDocumentEditor(uploaded, parentPath)
        return true
      }
      await openAlertModal({
        title: 'Upload required',
        message: 'This device cannot open local paths directly. Please upload the file to open it.'
      })
      return false
    }

    if (/\\.[a-zA-Z0-9]{1,10}$/.test(normalized)) {
      await EditorCommonUtils.addNewDocumentEditor(normalized, parentPath)
      return true
    }

    await openAlertModal({
      title: 'Open file',
      message: 'Please paste a valid share link or file path.'
    })
    return false
  }

  static async openSharedLinkPrompt(defaultValue = '') {
    const input = await openTextInputModal({
      title: 'Open shared link',
      message: 'Paste a Dynadoc share link to open the document.',
      placeholder: 'https://app.dynadoc.../index.html?shareId=...',
      defaultValue: defaultValue || '',
      confirmText: 'Open',
      cancelText: 'Cancel'
    })
    if (!input) return false
    return EditorCommonUtils.openDocumentFromShareLink(input)
  }

  static async openSharedLinkFromLocationIfPresent() {
    const link = EditorCommonUtils.getShareLinkFromLocation()
    if (!link) return false
    return EditorCommonUtils.openDocumentFromShareLink(link)
  }

  public static async ensureAuthenticated() {
    if (get(authStore)?.authenticated) return true

    // The store starts as { initializing: true, authenticated: false } and only
    // settles once the session round-trip returns. Treating that as "signed
    // out" sent people with a perfectly valid token back to Casdoor — the
    // second sign-in prompt. Resolve the local session first, and only fall
    // back to a full round-trip when there genuinely is none.
    if (get(authStore)?.initializing || hasAccessToken()) {
      try {
        await refreshAuthSession({ setLoading: false })
      } catch {
        // fall through to the interactive path
      }
      if (get(authStore)?.authenticated) return true
    }

    try {
      await startAuth('signin')
      await refreshAuthSession({ setLoading: false })
    } catch {
      // ignore
    }
    return Boolean(get(authStore)?.authenticated)
  }

  static recordRecentDocument(document: DocumentModel | null | undefined) {
    if (!document) return
    const mainPath = document.getMainFilePath?.() || document.path || ''
    if (!mainPath) return
    const authState = get(authStore)
    const accountOrg =
      (document as any).remotePath || (document as any).remoteRef
        ? authState?.activeOrg || null
        : null

    const entry: RecentDocumentEntry = {
      id: document.uuid || mainPath,
      name: document.name || 'Untitled',
      path: mainPath,
      parentPath: document.parentPath ?? null,
      dirPath: document.dirPath ?? null,
      extension: document.extension ?? null,
      contentType: document.info?.contentType ?? null,
      updatedAt: document.info?.updatedAt ? new Date(document.info.updatedAt).toISOString() : null,
      openedAt: new Date().toISOString(),
      remotePath: (document as any).remotePath ?? null,
      remoteRef: (document as any).remoteRef ?? null,
      accountOrg
    }

    _$_recentDocuments.update((list) => {
      const next = Array.isArray(list) ? [...list] : []
      const existingIndex = next.findIndex(
        (item) => item.id === entry.id || item.path === entry.path
      )
      if (existingIndex >= 0) {
        next.splice(existingIndex, 1)
      }
      next.unshift(entry)
      return next.slice(0, 50)
    })
  }

  /* async function copyTextToClipboard(value: string) {
    if (!value) return
    if (window.api?.clipboard?.write) {
      window.api.clipboard.write({ text: value })
      return
    }
    await navigator.clipboard?.writeText(value).catch(() => {})
  } */

  public static async copyToClipboard(
    input: string | { text?: string; html?: string; imageDataUrl?: string }
  ): Promise<void> {
    const payload =
      typeof input === 'string'
        ? { text: input }
        : {
            text: input?.text || '',
            html: input?.html,
            imageDataUrl: input?.imageDataUrl
          }

    if (!payload.text && !payload.html && !payload.imageDataUrl) return

    if (window.api?.clipboard?.write) {
      try {
        await window.api.clipboard.write({
          text: payload.text,
          html: payload.html,
          imageDataUrl: payload.imageDataUrl
        })
        return
      } catch (e) {
        console.warn('Electron clipboard API failed, falling back...', e)
      }
    }

    if (navigator.clipboard && window.isSecureContext) {
      try {
        if (navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
          const items: Record<string, Blob> = {}
          if (payload.text) items['text/plain'] = new Blob([payload.text], { type: 'text/plain' })
          if (payload.html) items['text/html'] = new Blob([payload.html], { type: 'text/html' })
          if (payload.imageDataUrl) {
            const res = await fetch(payload.imageDataUrl)
            const blob = await res.blob()
            if (blob.type) items[blob.type] = blob
          }
          if (Object.keys(items).length) {
            await navigator.clipboard.write([new ClipboardItem(items)])
            return
          }
        }
        if (payload.text) {
          await navigator.clipboard.writeText(payload.text)
          return
        }
      } catch (e) {
        console.warn('navigator.clipboard failed, falling back to execCommand', e)
      }
    }

    if (!payload.text) return
    const textArea = document.createElement('textarea')
    textArea.value = payload.text

    Object.assign(textArea.style, {
      position: 'fixed',
      left: '-9999px',
      top: '0',
      opacity: '0'
    })

    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    return new Promise((resolve, reject) => {
      try {
        const successful = document.execCommand('copy')
        document.body.removeChild(textArea)
        successful ? resolve() : reject(new Error('execCommand copy unsuccessful'))
      } catch (err) {
        document.body.removeChild(textArea)
        reject(err)
      }
    })
  }

  public static async readFromClipboard(options: { mode?: 'text' | 'rich' } = {}): Promise<{
    text?: string
    html?: string
    imageDataUrl?: string
  }> {
    const mode = options.mode || 'text'
    if (window.api?.clipboard) {
      try {
        if (mode === 'rich') {
          const imageDataUrl = window.api.clipboard.readImageDataUrl?.() || ''
          const html = window.api.clipboard.readHTML?.() || ''
          const text = window.api.clipboard.readText?.() || ''
          return {
            text: text || '',
            html: html || '',
            imageDataUrl: imageDataUrl || ''
          }
        }
        const text = await window.api.clipboard.readText()
        return { text: text || '' }
      } catch (e) {
        console.warn('Electron clipboard read API failed, falling back...', e)
      }
    }

    if (navigator.clipboard && window.isSecureContext) {
      try {
        if (mode === 'rich' && navigator.clipboard.read) {
          const items = await navigator.clipboard.read()
          let text = ''
          let html = ''
          let imageDataUrl = ''

          for (const item of items) {
            const imageType = item.types.find((t) => t.startsWith('image/'))
            if (imageType && !imageDataUrl) {
              const blob = await item.getType(imageType)
              imageDataUrl = URL.createObjectURL(blob)
            }
            if (item.types.includes('text/html') && !html) {
              const blob = await item.getType('text/html')
              html = await blob.text()
            }
            if (item.types.includes('text/plain') && !text) {
              const blob = await item.getType('text/plain')
              text = await blob.text()
            }
          }

          return { text, html, imageDataUrl }
        }

        if (navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText()
          return { text: text || '' }
        }
      } catch (e) {
        console.warn('navigator.clipboard.readText failed, falling back to execCommand', e)
      }
    }

    if (mode !== 'text') return { text: '' }
    const textArea = document.createElement('textarea')
    Object.assign(textArea.style, {
      position: 'fixed',
      left: '-9999px',
      top: '0',
      opacity: '0'
    })
    document.body.appendChild(textArea)
    textArea.focus()

    return new Promise((resolve, reject) => {
      try {
        const successful = document.execCommand('paste')
        const value = textArea.value
        document.body.removeChild(textArea)

        if (successful) {
          resolve({ text: value || '' })
        } else {
          reject(new Error('execCommand paste unsuccessful or unauthorized'))
        }
      } catch (err) {
        document.body.removeChild(textArea)
        reject(err)
      }
    })
  }

  public static async addNewDocumentEditor(
    documentPath: string | undefined | null,
    documentParentPath: string | undefined | null,
    callback?: () => void,
    defaultContentType?: DocumentContentType,
    defaultContentKind?: DocumentContentKindType,
    defaultContent: string = '',
    associatedMeetingLinks: string[] = []
  ): Promise<DocumentEditorModel[]> {
    openTiming.begin()
    const toastId = toast.loading('Opening document...')
    // Change cursor to loading
    // document.body.style.cursor = 'wait !important'
    // document.body.classList.add('is-loading');
    EditorCommonUtils.toggleDocumentBodyLoading()

    try {
      // console.log('_documentEditors addNewDocumentEditor',)
      //  function addNewDocumentEditor(): void {
      var documentEditors = _$_documentEditorsList.getList()
      // const index = documentEditors.length
      // const id = documentEditors.length
      // _canRenderComponents = false

      console.log('_documentEditors addNewDocumentEditor', { documentEditors, documentPath })
      let documentToOpen: DocumentModel
      const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
      const authState = get(authStore)

      // if path is undefined or null, create new document
      if (!documentPath) {
        if (!isDesktopPlatform && !authState?.authenticated) {
          EditorCommonUtils.setPendingAuthAction({
            type: 'create-doc',
            payload: {
              parentPath: documentParentPath || null,
              contentType: defaultContentType,
              contentKind: defaultContentKind,
              content: defaultContent,
              associatedMeetingLinks
            }
          })
          const authed = await EditorCommonUtils.ensureAuthenticated()
          if (!authed) {
            // toast.dismiss(toastId)
            // RESET cursor to default
            // document.body.style.cursor = 'default'
            return documentEditors
          }
        }
        // defaultContent = DocumentModel.getDefaultDocumentContent(defaultContentType, defaultContentKind, defaultContent)
        documentToOpen = await DocumentModel.createNewDocument(
          defaultContentType,
          defaultContentKind,
          defaultContent,
          associatedMeetingLinks
        )
      } else {
        console.log('_documentEditors addNewDocumentEditor 2', { documentEditors })

        const normalizedPath = documentPath.trim()
        const openAsFile = await DocumentModel.shouldOpenAsFile(normalizedPath)
        const isShareLink =
          normalizedPath.startsWith('share:') ||
          normalizedPath.startsWith('collab:') ||
          normalizedPath.startsWith('yjs:') ||
          normalizedPath.includes('shareId=') ||
          normalizedPath.includes('#shareId=') ||
          normalizedPath.match(
            /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-5][a-fA-F0-9]{3}-[89abAB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}\/index\.html/i
            // /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-5][a-fA-F0-9]{3}-[89abAB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}(\/|$)/i
          )
        const isShareCache = normalizedPath.startsWith('share-cache/')
        if (!isDesktopPlatform && !authState?.authenticated && !isShareLink && !isShareCache) {
          EditorCommonUtils.setPendingAuthAction({
            type: 'open-doc',
            payload: {
              path: normalizedPath,
              parentPath: documentParentPath || null,
              contentType: defaultContentType,
              contentKind: defaultContentKind,
              content: defaultContent,
              associatedMeetingLinks
            }
          })
          const authed = await EditorCommonUtils.ensureAuthenticated()
          if (!authed) {
            // toast.dismiss(toastId)
            // RESET cursor to default
            // document.body.style.cursor = 'default'
            return documentEditors
          }
        }
        if (isShareCache) {
          if (!documentParentPath) {
            try {
              documentParentPath = nodeApi.path.dirname(normalizedPath)
            } catch {
              documentParentPath = normalizedPath
            }
          }
          documentToOpen = await DocumentModel.loadFrom(
            normalizedPath,
            documentParentPath,
            DocumentModel.OpenMode.READ,
            { openAsFile }
          )
          documentPath = normalizedPath
        } else if (isShareLink) {
          if (isDesktopPlatform) {
            const prepared = await EditorCommonUtils.downloadSharedDocumentDesktop(normalizedPath)
            if (!prepared?.filePath) {
              throw new Error('SHARE_DOWNLOAD_FAILED')
            }
            documentPath = prepared.filePath
            if (prepared.targetType === 'folder') {
              // toast.dismiss(toastId)
              // document.body.classList.remove('is-loading')
              openFolderStructureModal({
                path: documentPath,
                name: prepared.shareInfo?.name || parsedShare.name || 'Shared Folder',
                shareId: prepared.shareInfo?.shareId || parsedShare.shareId,
                docUuid: prepared.shareInfo?.docUuid || parsedShare.docUuid
              })
              return documentEditors
            }

            if (!documentParentPath) {
              documentParentPath = nodeApi.path.dirname(prepared.filePath)
            }
            documentToOpen = await DocumentModel.loadFrom(
              documentPath,
              documentParentPath,
              prepared.openMode || DocumentModel.OpenMode.READ,
              { openAsFile }
            )
          } else {
            let importedError: unknown = null
            const parsedShare = EditorCommonUtils.parseShareLink(normalizedPath)
            try {
              if (authState?.authenticated) {
                const imported = await EditorCommonUtils.importSharedDocumentRemote(normalizedPath)
                const importedPath = imported?.path || imported?.data?.path || ''
                if (!importedPath) {
                  throw new Error('Shared document import failed.')
                }
                // const looksLikeLocalDesktopPath =
                //   /Library[\\/]Application Support[\\/]dynadoc/i.test(importedPath) ||
                //   /(^|\\/|\\b)Users[\\/]/i.test(importedPath)
                // if (looksLikeLocalDesktopPath) {
                //   throw new Error('Shared document import resolved to a local desktop path.')
                // }
                documentPath = importedPath
                const targetType = imported?.targetType || imported?.data?.targetType || 'file'
                if (targetType === 'folder') {
                  // toast.dismiss(toastId)
                  // document.body.classList.remove('is-loading')
                  openFolderStructureModal({
                    path: importedPath,
                    name: imported?.name || parsedShare.name || 'Shared Folder',
                    shareId: imported?.shareId || parsedShare.shareId,
                    docUuid: imported?.docUuid || parsedShare.docUuid
                  })
                  return documentEditors
                }

                const openMode = imported?.canEdit
                  ? DocumentModel.OpenMode.WRITE
                  : DocumentModel.OpenMode.READ
                documentToOpen = await DocumentModel.loadFrom(
                  documentPath,
                  documentParentPath,
                  openMode,
                  { openAsFile }
                )
                if (!documentToOpen) {
                  // toast.dismiss(toastId)
                  // RESET cursor to default
                  // document.body.style.cursor = 'default'
                  throw new Error('Shared document import returned a missing path.')
                }
                // RESET cursor to default
                document.body.style.cursor = 'default'
                try {
                  const shareId = imported?.shareId || parsedShare.shareId || ''
                  const docUuid = imported?.docUuid || parsedShare.docUuid || ''
                  const docKey = documentToOpen?.uuid || documentToOpen?.id || ''
                  if (shareId && docUuid) {
                    const context = {
                      shareId,
                      docUuid,
                      name: imported?.shareName || parsedShare.name || documentToOpen?.name,
                      path: documentPath,
                      link: normalizedPath,
                      role: imported?.role
                    }
                    setShareLinkContext(docUuid, context)
                    if (docKey && docKey !== docUuid) {
                      setShareLinkContext(docKey, context)
                    }
                  }
                } catch {
                  // ignore share context errors
                }
              }
            } catch (error) {
              importedError = error
            }

            if (!documentToOpen) {
              const publicShare = await EditorCommonUtils.openPublicShareInBrowser(
                normalizedPath
              ).catch((error) => {
                if (importedError) throw importedError
                throw error
              })
              documentPath = publicShare.filePath
              if (publicShare.targetType === 'folder') {
                // toast.dismiss(toastId)
                // document.body.classList.remove('is-loading')
                openFolderStructureModal({
                  path: documentPath,
                  name: publicShare.name || parsedShare.name || 'Shared Folder',
                  shareId: publicShare.shareId || parsedShare.shareId,
                  docUuid: publicShare.docUuid || parsedShare.docUuid
                })
                return documentEditors
              }

              documentToOpen = await DocumentModel.loadFrom(
                documentPath,
                documentParentPath,
                publicShare.openMode || DocumentModel.OpenMode.READ,
                { openAsFile }
              )
              try {
                const shareId = publicShare?.shareId || parsedShare.shareId || ''
                const docUuid = publicShare?.docUuid || parsedShare.docUuid || ''
                const docKey = documentToOpen?.uuid || documentToOpen?.id || ''
                if (shareId && docUuid) {
                  const context = {
                    shareId,
                    docUuid,
                    name: publicShare?.name || parsedShare.name || documentToOpen?.name,
                    path: documentPath,
                    link: normalizedPath,
                    role: publicShare?.role
                  }
                  setShareLinkContext(docUuid, context)
                  if (docKey && docKey !== docUuid) {
                    setShareLinkContext(docKey, context)
                  }
                }
              } catch {
                // ignore share context errors
              }
            }
          }
        }
        console.log('_documentEditors addNewDocumentEditor 3', { documentEditors, openAsFile })

        /*  documentPath = documentPath ||
           // '/path/to/dynadoc/test/test.xddoc'
           '/path/to/dynadoc/test/test.xddoc'
  */
        // if documeent.path already exist, don't continue and load again, just update the editor list to active

        if (!documentPath) {
          console.warn('⚠️ No document path provided.')

          // toast.dismiss(toastId)
          // RESET cursor to default
          // document.body.style.cursor = 'default'
          return documentEditors
        }

        const ext = nodeApi.path.extname(documentPath).toLowerCase()

        if (!documentParentPath) {
          const activeEditor = _$_documentEditorsList.getActiveSync?.()
          const activeDoc = activeEditor?.document
          const activeCachePath = activeDoc?.cachePath
          if (activeCachePath && documentPath.startsWith(activeCachePath)) {
            documentParentPath = activeDoc.getMainFilePath?.() || activeDoc.path
          }
        }
        if ([Utils.OFFICE_EXTENSIONS.excel, '.csv', '.xls'].includes(ext)) {
          const confirmConvert = await openConfirmModal({
            title: 'Open spreadsheet',
            message:
              'Open this spreadsheet in a FortuneSheet editor. Choose Convert to create a Dynadoc document right away.',
            confirmText: 'Convert to Dynadoc',
            cancelText: 'Open in Spreadsheet'
          })

          if (confirmConvert) {
            const { importSpreadsheetFileIntoNewDocument } = await import(
              '../services/export/spreadsheetExchange.service'
            )
            await importSpreadsheetFileIntoNewDocument(documentPath)
            const active = _$_documentEditorsList.getActiveSync?.()
            if (active) {
              await EditorHelpers.saveDocumentEditor(active, { saveAs: true })
            }
            if (callback) callback()
            EditorCommonUtils.toggleDocumentBodyLoading()
            return documentEditors
          }

          documentToOpen = await DocumentModel.loadFrom(
            documentPath,
            documentParentPath,
            DocumentModel.OpenMode.WRITE,
            { openAsFile: true }
          )

          /* if (documentToOpen) {
            EditorCommonUtils.toggleDocumentBodyLoading()
            _$_documentEditorsList.add(documentToOpen, DocumentModel.OpenMode.WRITE)
            if (callback) callback()
            return documentEditors
          } */
        }

        // 🧠 1️⃣ Check if document with same path already exists
        // const existingEditor = documentEditors.find(
        //   (editor) => editor.document?.path === documentPath
        // )
        const assetToken = `${nodeApi.path.sep}assets${nodeApi.path.sep}`
        const isAssetPath = normalizedPath.includes(assetToken)
        const existingEditor = documentEditors.find((editor) => {
          if (!editor?.document) return false
          if (isAssetPath) {
            return editor.document?.path === documentPath
          }
          return (
            editor.document?.getMainFilePath?.() === documentPath ||
            editor.document?.path === documentPath
          )
        })

        if (existingEditor) {
          console.log('📄 Document already open, activating existing editor:', documentPath)

          // Set all inactive, then activate the existing one
          _$_documentEditorsList.setActive(
            existingEditor.uuid || existingEditor.document?.uuid || existingEditor.id!
          )
          // _$_documentEditorsList.setActive(existingEditor.index!)
          // _$_documentEditorsList.setActive(existingEditor.id!)
          /* documentEditors = documentEditors.map((editor) => ({
            ...editor,
            isActive: editor.id === existingEditor.id
          }))
         
          _$_documentEditorsList.set(documentEditors) */
          if (callback) callback()
          // toast.dismiss(toastId)
          // RESET cursor to default
          // document.body.style.cursor = 'default'

          return documentEditors
        }

        if (isDesktopPlatform && !isShareLink && !(await nodeApi.fsPromises.exists(documentPath))) {
          // Fallback: if index.html is missing, scan the folder for another .html
          // document file (e.g. legacy ked.html created before the folder convention)
          const resolved = await (async () => {
            const base = nodeApi.path.basename(documentPath)
            if (base.toLowerCase() !== Utils.MAIN_DOCUMENT_FILE.toLowerCase()) return null
            const dir = nodeApi.path.dirname(documentPath)
            const dirExists = await nodeApi.fsPromises.exists(dir).catch(() => false)
            if (!dirExists) return null
            const entries = await nodeApi.fsPromises.readdir(dir).catch(() => [] as string[])
            const candidate = entries.find(
              (e) =>
                e.toLowerCase().endsWith(Utils.MAIN_DOCUMENT_FILE_EXTENSION) &&
                e.toLowerCase() !== Utils.MAIN_DOCUMENT_FILE.toLowerCase()
            )
            if (!candidate) return null
            const candidatePath = nodeApi.path.join(dir, candidate)
            const exists = await nodeApi.fsPromises.exists(candidatePath).catch(() => false)
            return exists ? candidatePath : null
          })()

          if (resolved) {
            documentPath = resolved
          } else {
            throw new Error(`FILE_NOT_FOUND::${documentPath}`)
          }
        }

        // 🧩 2️⃣ Otherwise, load the document from disk
        if (!documentToOpen) {
          documentToOpen = await DocumentModel.loadFrom(
            // '/path/to/dynadoc/test/test.xddoc',
            documentPath,
            documentParentPath,
            // ||
            // '/path/to/dynadoc/test/test.xddoc',
            // '/path/to/dynadoc/test/test.xddoc',
            DocumentModel.OpenMode.WRITE,
            { openAsFile }
          ) // Load a document from a file path
        }

        if (!documentToOpen) {
          throw new Error(`FILE_NOT_SUPPORTED::${documentPath}`)
        }

        console.log('_documentEditors Loaded document:', { documentToOpen })
      }

      console.log('_documentEditors addNewDocumentEditor 44', { documentEditors, documentToOpen })
      openTiming.documentLoaded(
        documentToOpen?.uuid || documentToOpen?.path || '',
        documentToOpen?.uuid || '',
        !documentPath
          ? 'new'
          : DocumentModel.isShareCachePath(documentToOpen?.path)
            ? 'share'
            : 'file'
      )

      const editorAssetToken = `${nodeApi.path.sep}assets${nodeApi.path.sep}`
      const isAssetDocumentPath = Boolean(
        documentToOpen?.path && documentToOpen.path.includes(editorAssetToken)
      )
      const editorIdentity = isAssetDocumentPath
        ? documentToOpen.path || documentToOpen.uuid
        : documentToOpen.getMainFilePath?.() || documentToOpen.path || documentToOpen.uuid
      const existingByPath = documentEditors.find((editor) => {
        if (isAssetDocumentPath) {
          return editor?.document?.path === editorIdentity || editor?.id === editorIdentity
        }
        return (
          editor?.document?.getMainFilePath?.() === editorIdentity ||
          editor?.document?.path === editorIdentity ||
          editor?.id === editorIdentity ||
          editor?.uuid === editorIdentity
        )
      })
      if (existingByPath) {
        console.log('📄 Document already open (path match), activating:', editorIdentity)
        _$_documentEditorsList.setActive(existingByPath.uuid || existingByPath.id || editorIdentity)
        _$_lastOpenError.set(null)
        EditorCommonUtils.recordRecentDocument(documentToOpen)
        if (callback) callback()
        // toast.dismiss(toastId)
        // RESET cursor to default
        // document.body.style.cursor = 'default'

        return documentEditors
      }

      // console.log('_documentEditors Loaded documentToOpen.():',documentToOpen, documentToOpen.getMainFilePath())

      documentEditors = [
        // ..._documentEditors,
        ...documentEditors.map(
          (editor) => {
            return new DocumentEditorModel({ ...editor, isActive: false })
          }

          // ({
          // ...editor,
          //   isActive: false // set all other editors to inactive
          // })
        ),
        new DocumentEditorModel({
          // index: index,
          // index: id,
          id: editorIdentity, // use file path as the stable identity
          uuid: editorIdentity,
          // id: documentPath, // set the document path as the id
          // id: id.toString(),
          document:
            // null // Create a new Document instance
            // For testing
            // Document.loadFrom(
            //   '/path/to/dynadoc/test/test.xddoc',
            //   Document.OpenMode.WRITE
            // ) // Load a document from a file path
            documentToOpen,
          isActive: true
        })
        /* {
          index: id,
          id: id.toString(),
          document:
            // null // Create a new Document instance
            // For testing
            // Document.loadFrom(
            //   '/path/to/dynadoc/test/test.xddoc',
            //   Document.OpenMode.WRITE
            // ) // Load a document from a file path
            doc,
          isActive: true
        } */
      ]
      console.log('_documentEditors Loaded document: finally', { documentToOpen, documentEditors })

      // Set the editor list instance in the store
      console.log('__rootPath Set the editor list instance in the store ', { documentEditors })
      _$_documentEditorsList.set([...documentEditors])
      _$_currentView.set('editor')
      _$_lastOpenError.set(null)
      EditorCommonUtils.recordRecentDocument(documentToOpen)
      // _$_documentEditorsList.set(_documentEditors)
      console.log(
        '__rootPath Set the editor list instance in the store '
        // _$_documentEditorsList.get(id.toString())
      )

      // _documentEditors = [..._documentEditors, { id: id, document: null }]
      // _$_wysiwygEditorsList = [..._$_wysiwygEditorsList, { id: id, editor: null }]
      // _$_codeEditorsList = [..._$_codeEditorsList, { id: id, editor: null }]
      // _wysiwygEditorsSelectedTextList = [
      //   ..._wysiwygEditorsSelectedTextList,
      //   [new SelectedTextModel()]
      // ]
      // _canRenderComponents = true

      console.log('_documentEditors', documentEditors)

      if (callback) {
        callback()
      }

      // toast.dismiss(toastId)
      // RESET cursor to default
      // document.body.style.cursor = 'default'

      return _$_documentEditorsList.getList()
    } catch (error) {
      // console.error()
      // toast.dismiss(toastId)
      // RESET cursor to default
      // document.body.style.cursor = 'default'
      openTiming.abort()
      const message = error instanceof Error ? error.message : String(error)
      if (message.startsWith('FILE_NOT_FOUND::')) {
        const missingPath = message.replace('FILE_NOT_FOUND::', '')
        _$_lastOpenError.set({ type: 'not-found', path: missingPath })
        await openAlertModal({
          title: 'File not found',
          message: `This document could not be found on disk:\n${missingPath}`
        })
        return _$_documentEditorsList.getList()
      }

      if (
        message.startsWith('SYNC_REQUIRED::') ||
        message.toLowerCase().includes('drive sync is required before opening this share on web')
      ) {
        const syncPath = message.replace('SYNC_REQUIRED::', '').trim()
        _$_lastOpenError.set({ type: 'requires-sync', path: syncPath })
        await openAlertModal({
          title: 'Sync required to open this share',
          message:
            `This shared document was created from a local desktop path and is not yet synced to Drive.\n` +
            `Open it on desktop (or run a sync) to upload it to Drive, then try again.\n` +
            (syncPath ? `\nDrive path: ${syncPath}` : '')
        })
        return _$_documentEditorsList.getList()
      }

      if (message.startsWith('FILE_NOT_SUPPORTED::')) {
        const badPath = message.replace('FILE_NOT_SUPPORTED::', '')
        _$_lastOpenError.set({ type: 'unsupported', path: badPath })
        await openAlertModal({
          title: 'Unable to open document',
          message: `This file could not be opened by Dynadoc:\n${badPath}`
        })
        await window.api.openFile(badPath)
        return null
      }
      if (message.startsWith('EPHEMERAL_EXPIRED::')) {
        const expiredPath = message.replace('EPHEMERAL_EXPIRED::', '')
        _$_lastOpenError.set({ type: 'expired', path: expiredPath })
        await openAlertModal({
          title: 'Document expired',
          message: `This document has reached its expiration policy and was deleted automatically.\n${expiredPath}`
        })
        return _$_documentEditorsList.getList()
      }

      // Auth-gated docs: show a clear CTA instead of a generic error modal.
      // We keep the match intentionally broad because various layers may surface
      // auth failures with slightly different strings.
      if (
        message.toLowerCase().includes('authentication required') ||
        message.toLowerCase().includes('unauthorized') ||
        message.toLowerCase().includes('missing or invalid bearer token')
      ) {
        _$_lastOpenError.set({
          type: 'auth-required',
          path: documentPath || '',
          message
        } as any)

        const shouldSignIn = await openConfirmModal({
          title: 'Sign in required',
          message:
            'This document is protected and requires an authenticated account to access.\n\nSign in to continue.',
          confirmText: 'Sign in',
          cancelText: 'Cancel'
        })

        if (shouldSignIn) {
          try {
            const ok = await EditorCommonUtils.ensureAuthenticated()
            if (ok && documentPath) {
              // Best-effort retry for desktop flows where auth completes without a full reload.
              return await EditorCommonUtils.addNewDocumentEditor(
                documentPath,
                documentParentPath,
                callback,
                defaultContentType,
                defaultContentKind,
                defaultContent,
                associatedMeetingLinks
              )
            }
          } catch {
            // fall through to keep UX calm; generic handler will show if retry fails
          }
        }

        return _$_documentEditorsList.getList()
      }

      console.error('Failed to open document:', { error })
      _$_lastOpenError.set({
        type: 'error',
        path: documentPath || '',
        message
      })
      // On the web, a visitor without a session already sees the sign-in
      // page; a dialog saying the same thing on top of it helps nobody.
      const signInPageAlreadyShown =
        !Platform.isDesktopPlatform &&
        !hasAccessToken() &&
        /sign in required/i.test(String(message))
      if (!signInPageAlreadyShown) {
        await openAlertModal({
          title: 'Failed to open document',
          message: `An unexpected error occurred while opening the document.\n${message}`
        })
      }
      return _$_documentEditorsList.getList()
    } finally {
      // RESET cursor to default
      // document.body.style.cursor = 'default'
      // document.body.classList.remove('is-loading');
      EditorCommonUtils.toggleDocumentBodyLoading()
      toast.dismiss(toastId)
    }
  }

  static toggleDocumentBodyLoading() {
    if (!document.body.classList.contains('is-loading')) {
      document.body.classList.add('is-loading')
    } else {
      document.body.classList.remove('is-loading')
    }
  }
  static async confirmCloseIfUnsaved(documentEditor: DocumentEditorModel | null | undefined) {
    const document = documentEditor?.document
    if (!document) return true
    if (!document.isUnsavedDocument?.()) return true
    try {
      await saveSnapshot(documentEditor)
    } catch {
      // ignore snapshot failures
    }
    const name = document.name || 'Untitled'
    let handledBySave = false
    return await openConfirmModal({
      title: 'Close without saving?',
      message: `“${name}” has not been saved yet. Close it anyway?`,
      confirmText: 'Close without saving',
      cancelText: 'Cancel',
      destructive: true,
      extraActionText: 'Save & Close',
      onExtraAction: async () => {
        handledBySave = true
        const saved = await EditorHelpers.saveDocumentEditor(documentEditor, { saveAs: true })
        if (saved) {
          _$_documentEditorsList.closeTab(
            documentEditor.uuid || documentEditor.document?.uuid || documentEditor.id
          )
        }
      }
    }).then((ok) => (handledBySave ? false : ok))
  }

  static async confirmCloseManyIfUnsaved(documentEditors: DocumentEditorModel[]) {
    const unsaved = documentEditors.filter((editor) => editor?.document?.isUnsavedDocument?.())
    if (!unsaved.length) return true
    const count = unsaved.length
    return await openConfirmModal({
      title: 'Close without saving?',
      message:
        count === 1
          ? 'There is 1 unsaved document. Close it anyway?'
          : `There are ${count} unsaved documents. Close them anyway?`,
      confirmText: 'Close without saving',
      cancelText: 'Cancel',
      destructive: true
    })
  }

  static async saveAllUnsavedDocuments() {
    const list = _$_documentEditorsList.getList()
    const unsaved = list.filter((entry) => entry?.document?.isUnsavedDocument?.())
    let savedCount = 0
    let cancelledCount = 0
    let failedCount = 0
    for (const entry of unsaved) {
      try {
        const saved = await EditorHelpers.saveDocumentEditor(entry, { saveAs: true })
        if (saved) {
          savedCount += 1
        } else {
          cancelledCount += 1
        }
      } catch {
        failedCount += 1
      }
    }
    return {
      attemptedCount: unsaved.length,
      savedCount,
      cancelledCount,
      failedCount,
      allSaved: savedCount === unsaved.length
    }
  }

  static async openRepo(repoUrl: string | undefined = undefined) {
    const defaultRepoUrl = 'https://github.com/dashmake/dynadoc'
    repoUrl = repoUrl || (import.meta as any)?.env?.VITE_DYNADOC_REPO_URL || defaultRepoUrl

    try {
      await (window as any)?.api?.openExternal?.(repoUrl)
      return
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') window.open(repoUrl, '_blank', 'noopener')
  }
}
