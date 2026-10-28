import { nodeApi } from './shims/node'
import Utils from './Utils'
import { getShareLinkContext } from '../stores/shareLink.store'

export const hashString = (input: string) => {
  let h1 = 0xdeadbeef ^ input.length
  let h2 = 0x41c6ce57 ^ input.length
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

export const normalizeHashPath = (value?: string) => {
  const raw = String(value || '')
  if (!raw) return ''
  if (nodeApi.path) {
    try {
      const ext = nodeApi.path.extname(raw)
      if (!ext) {
        const trimmed = raw.replace(/\/+$/, '')
        return `${trimmed}/${Utils.MAIN_DOCUMENT_FILE}`.replace(/\/{2,}/g, '/')
      }
    } catch {
      // ignore
    }
  }
  return raw
}

export const parseShareInfo = (input?: string | null) => {
  if (!input) return { shareId: '', password: '', docUuid: '', name: '' }
  const shareMatch =
    input.match(/shareId=([^&]+)/i) ||
    input.match(/share:([^?]+)/i) ||
    input.match(/collab:([^?]+)/i) ||
    input.match(/yjs:([^?]+)/i)
  const pwdMatch = input.match(/password=([^&]+)/i) || input.match(/pwd=([^&]+)/i)
  const uuidMatch = input.match(
    /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-5][a-fA-F0-9]{3}-[89abAB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}/
  )
  const nameMatch =
    input.match(
      /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-5][a-fA-F0-9]{3}-[89abAB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}\/([^/?#]+)/i
    ) || []
  return {
    shareId: shareMatch ? decodeURIComponent(shareMatch[1]) : '',
    password: pwdMatch ? decodeURIComponent(pwdMatch[1]) : '',
    docUuid: uuidMatch ? uuidMatch[0] : '',
    name: nameMatch[1] ? decodeURIComponent(nameMatch[1]) : ''
  }
}

export const resolveShareContext = (doc: any) => {
  const docUuid = doc?.uuid || doc?.id || ''
  const stored = docUuid ? getShareLinkContext(docUuid) : null
  const pathCandidate = doc?.path || doc?.getMainFilePath?.() || ''
  const parsed = parseShareInfo(stored?.link || pathCandidate)
  const shareId = stored?.shareId || parsed.shareId || ''
  const parsedDocUuid = parsed.docUuid || ''
  const resolvedDocUuid = stored?.docUuid || parsedDocUuid || docUuid
  const looksShared =
    Boolean(stored) ||
    Boolean(shareId) ||
    (resolvedDocUuid &&
      typeof pathCandidate === 'string' &&
      pathCandidate.includes(resolvedDocUuid))
  if (!looksShared) return null
  return {
    shareId,
    docUuid: resolvedDocUuid,
    name: doc?.name || stored?.name || parsed.name,
    path: pathCandidate || stored?.path,
    password: stored?.password || parsed.password || ''
  }
}

export const resolveShareMetaForPath = async (doc: any, filePath: string) => {
  if (!nodeApi.fs || !nodeApi.path || !filePath) return null
  const normalized = String(filePath).replace(/\\/g, '/')
  let shareRoot = ''
  const parts = normalized.split('/').filter(Boolean)
  const sharedIndex = parts.indexOf('shared')
  if (sharedIndex >= 0 && parts.length >= sharedIndex + 3) {
    shareRoot = '/' + parts.slice(0, sharedIndex + 3).join('/')
  }
  const candidates = [
    doc?.cachePath,
    doc?.cacheDirPath,
    shareRoot || '',
    nodeApi.path.dirname(filePath)
  ].filter(Boolean)
  for (const candidate of candidates) {
    const metaPath = nodeApi.path.join(candidate, 'share.meta.json')
    if (!(await nodeApi.fsPromises?.exists(metaPath))) continue
    try {
      const raw = await nodeApi.fsPromises?.readFile(metaPath, 'utf-8')
      const parsed = JSON.parse(raw || '{}')
      return { meta: parsed, root: candidate }
    } catch {
      // ignore
    }
  }
  return null
}

export const buildCollabDocId = async (doc: any, filePath: string, fallbackId?: string) => {
  const shareMeta = await resolveShareMetaForPath(doc, filePath)
  const shareContext = resolveShareContext(doc)
  
  const normalizedFilePath = String(filePath || '').replace(/\\/g, '/')
  
  // 1. Resolve baseId (Project UUID)
  const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab0123][a-f0-9]{3}-[a-f0-9]{12}/i
  const uuidMatch = normalizedFilePath.match(uuidRegex)
  const detectedUuid = uuidMatch ? uuidMatch[0] : ''

  const baseId =
    shareContext?.docUuid || 
    shareMeta?.meta?.docUuid || 
    detectedUuid ||
    doc?.uuid || 
    doc?.id || 
    fallbackId || 
    'default'

  // 2. Resolve pathKey (Relative path within project)
  const pathKey = String(
    (() => {
      if (!normalizedFilePath) return ''
      
      // A. Try relative to share-cache
      if (shareContext?.docUuid && nodeApi.path) {
        const baseRoot = `share-cache/${shareContext.docUuid}`
        if (normalizedFilePath.startsWith(baseRoot)) {
          try {
            return normalizeHashPath(nodeApi.path.relative(baseRoot, normalizedFilePath))
          } catch { /* ignore */ }
        }
      }

      // B. Try relative to detected UUID root (highly robust)
      if (detectedUuid && nodeApi.path) {
        const idx = normalizedFilePath.indexOf(detectedUuid)
        const uuidRoot = normalizedFilePath.slice(0, idx + detectedUuid.length)
        try {
          const rel = nodeApi.path.relative(uuidRoot, normalizedFilePath)
          if (rel && !rel.startsWith('..') && !nodeApi.path.isAbsolute(rel)) {
            return normalizeHashPath(rel)
          }
        } catch { /* ignore */ }
      }

      // C. Try relative to cacheDirPath
      if (doc?.cacheDirPath && nodeApi.path) {
        try {
          const rel = nodeApi.path.relative(doc.cacheDirPath, normalizedFilePath)
          if (rel && !rel.startsWith('..') && !nodeApi.path.isAbsolute(rel)) {
            return normalizeHashPath(rel)
          }
        } catch { /* ignore */ }
      }

      // D. Try relative to cachePath
      if (doc?.cachePath && nodeApi.path) {
        try {
          const rel = nodeApi.path.relative(doc.cachePath, normalizedFilePath)
          if (rel && !rel.startsWith('..') && !nodeApi.path.isAbsolute(rel)) {
            return normalizeHashPath(rel)
          }
        } catch { /* ignore */ }
      }

      // E. Fallback to full normalized path
      return normalizeHashPath(
        normalizedFilePath || doc?.getMainFilePath?.() || doc?.path || fallbackId || ''
      )
    })()
  )

  if (!pathKey || pathKey === '.' || pathKey === '/') return String(baseId)
  
  // Combine baseId and hashed relative path for a globally unique room ID
  return `${baseId}:${hashString(pathKey)}`
}

