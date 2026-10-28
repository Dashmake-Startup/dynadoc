import { resolveApiBaseUrl } from '../lib/api/shared/baseUrl'
import EditorCommonUtils from './common.utils'

const BASE_URL = resolveApiBaseUrl()
const ACCESS_TOKEN_KEY = 'ddoc.access_token'

function getAccessToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

async function resolveAccessToken(): Promise<string | null> {
  const token = getAccessToken()
  if (token) return token
  try {
    const authApi = (window as any)?.server?.auth
    if (authApi?.getSession) {
      const session = await authApi.getSession()
      return session?.accessToken || session?.session?.accessToken || null
    }
  } catch {
    // ignore
  }
  return getAccessToken()
}

async function downloadUrl(
  url: string,
  fileName?: string,
  options?: { onProgress?: (info: { received: number; total?: number }) => void; allowOpenFallback?: boolean }
) {
  if (typeof window === 'undefined' || !url) return false
  const safeUrl = url.includes(' ') ? encodeURI(url) : url
  const token = await resolveAccessToken()
  const allowOpenFallback = options?.allowOpenFallback !== false
  try {
    const res = await fetch(safeUrl, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error('unauthorized')
      }
      throw new Error(String(res.status))
    }
    const total = Number(res.headers.get('content-length') || 0) || undefined
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader()
      const chunks: Uint8Array[] = []
      let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          received += value.length
          options?.onProgress?.({ received, total })
        }
      }
      const blob = new Blob(chunks)
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fileName || ''
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
      return true
    }
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = fileName || ''
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
    return true
  } catch {
    if (!allowOpenFallback) return false
    const link = document.createElement('a')
    link.href = safeUrl
    if (fileName) link.download = fileName
    link.target = '_blank'
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    return true
  }
}

async function fetchJson(path: string, options: RequestInit = {}) {
  const token = getAccessToken()
  const url = `${BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  }
  const res = await fetch(url, { ...options, headers })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, ...(payload || {}), status: res.status }
  }
  return payload
}

function getDriveApi() {
  return (window as any)?.server?.drive
}

export const DriveActions = {
  async getRoot(payload?: any) {
    const drive = getDriveApi()
    if (drive?.getRoot) return drive.getRoot(payload)
    return '/'
  },

  async listDir(payload: any) {
    const drive = getDriveApi()
    if (drive?.listDir) return drive.listDir(payload)
    const query = new URLSearchParams()
    if (payload?.path) query.set('path', payload.path)
    if (payload?.accountOrg) query.set('accountOrg', payload.accountOrg)
    return fetchJson(`/drive/list?${query.toString()}`, { method: 'GET' })
  },

  async openItem(payload: any) {
    return EditorCommonUtils.openDriveItem(payload)
  },

  async mkdir(payload: any) {
    const drive = getDriveApi()
    if (drive?.mkdir) return drive.mkdir(payload)
    const result = await fetchJson('/drive/mkdir', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    })
    return result?.ok ? result : { ...result, ok: result?.status >= 200 && result?.status < 300 }
  },

  async uploadFiles(payload: any) {
    const drive = getDriveApi()
    if (drive?.uploadFiles) return drive.uploadFiles(payload)
    return { ok: false, message: 'Upload is not supported in this environment.' }
  },

  async downloadItem(payload: any) {
    return DriveActions.downloadItemWithProgress(payload)
  },

  async downloadItemWithProgress(
    payload: any,
    onProgress?: (info: { received: number; total?: number }) => void
  ) {
    const drive = getDriveApi()
    if (drive?.downloadItem) return drive.downloadItem(payload, { onProgress })
    const result = await fetchJson('/drive/download', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    })
    if (result?.ok && (result?.url || result?.data?.url)) {
      const url = result?.url || result?.data?.url
      const ok = await downloadUrl(url, payload?.name || payload?.fileName || '', {
        onProgress,
        allowOpenFallback: false
      })
      if (!ok) return { ok: false, message: 'Download failed' }
      return { ok: true, url, savePath: url }

    }
    return result?.ok ? result : { ok: false, message: result?.message || 'Download not supported.' }
  },

  async deleteItem(payload: any) {
    const drive = getDriveApi()
    if (drive?.deleteItem) return drive.deleteItem(payload)
    const query = new URLSearchParams()
    if (payload?.path) query.set('path', payload.path)
    if (payload?.accountOrg) query.set('accountOrg', payload.accountOrg)
    return fetchJson(`/drive/item?${query.toString()}`, { method: 'DELETE' })
  },

  async moveItem(payload: any) {
    const drive = getDriveApi()
    if (drive?.moveItem) return drive.moveItem(payload)
    return fetchJson('/drive/move', { method: 'POST', body: JSON.stringify(payload || {}) })
  },

  async copyItem(payload: any) {
    const drive = getDriveApi()
    if (drive?.copyItem) return drive.copyItem(payload)
    return fetchJson('/drive/copy', { method: 'POST', body: JSON.stringify(payload || {}) })
  },

  async resolvePath(payload: any) {
    const drive = getDriveApi()
    if (drive?.resolvePath) {
      const rawPath = payload?.path || ''
      const normalized =
        typeof rawPath === 'string' && (rawPath === 'drive' || rawPath.startsWith('drive/'))
          ? rawPath.replace(/^drive\/?/, '')
          : rawPath
      return drive.resolvePath({ ...payload, path: normalized })
    }
    return { path: payload?.path || '', remotePath: payload?.path || '', ok: true }
  },

  async shareItem(payload: any) {
    const drive = getDriveApi()
    if (drive?.shareItem) return drive.shareItem(payload)
    return fetchJson('/drive/share', { method: 'POST', body: JSON.stringify(payload || {}) })
  },

  async getShare(payload: any) {
    const drive = getDriveApi()
    if (drive?.getShare) return drive.getShare(payload)
    const query = new URLSearchParams()
    if (payload?.path) query.set('path', payload.path)
    if (payload?.accountOrg) query.set('accountOrg', payload.accountOrg)
    return fetchJson(`/drive/share?${query.toString()}`, { method: 'GET' })
  },

  async listShares(payload?: any) {
    const drive = getDriveApi()
    if (drive?.listShares) return drive.listShares(payload)
    const query = new URLSearchParams()
    if (payload?.accountOrg) query.set('accountOrg', payload.accountOrg)
    const qs = query.toString()
    return fetchJson(`/drive/shares${qs ? '?' + qs : ''}`, { method: 'GET' })
  },

  async revokeShare(payload: any) {
    const drive = getDriveApi()
    if (drive?.revokeShare) return drive.revokeShare(payload)
    const query = new URLSearchParams()
    if (payload?.shareId) query.set('shareId', payload.shareId)
    if (payload?.accountOrg) query.set('accountOrg', payload.accountOrg)
    return fetchJson(`/drive/share?${query.toString()}`, { method: 'DELETE' })
  },

  async syncDoc(payload: any) {
    const drive = getDriveApi()
    if (drive?.syncDoc) return drive.syncDoc(payload)
    return { ok: false, message: 'Drive sync is not supported.' }
  }
}
