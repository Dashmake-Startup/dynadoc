import Platform from '../libs/platform'
import { resolveApiBaseUrl } from '../lib/api/shared/baseUrl'
import { nodeApi } from './shims/node'
import {DocumentModel} from '../models/Document'
import Utils from './Utils'
import { generateUniqueNameAsync } from './documentFileUtils'
import { getUploadedFile, storeUploadedFile } from './uploadCache'
import { toLocalPath } from './assetUrl'

const BASE_URL = resolveApiBaseUrl()
const ACCESS_TOKEN_KEY = 'ddoc.access_token'

type AssetType = typeof DocumentModel.AssetType[keyof typeof DocumentModel.AssetType]

function getAccessToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

function normalizeSourcePath(input: string): string {
  const raw = String(input || '').trim()
  if (!raw) return ''
  return toLocalPath(raw)
}

function normalizeComparePath(input: string): string {
  return normalizeSourcePath(input).replace(/\\/g, '/')
}

function inferAssetType(sourcePath: string): AssetType {
  const ext = nodeApi.path.extname(normalizeSourcePath(sourcePath)).toLowerCase()
  if (Object.values(Utils.IMAGE_EXTENSIONS).includes(ext)) return DocumentModel.AssetType.IMG
  if (Object.values(Utils.VIDEO_EXTENSIONS).includes(ext)) return DocumentModel.AssetType.VIDEO
  if (Object.values(Utils.AUDIO_EXTENSIONS).includes(ext)) return DocumentModel.AssetType.AUDIO
  if (Object.values(Utils.PROGRAMMING_LANGUAGE_EXTENSIONS_LIST ?? {}).includes(ext)) {
    return DocumentModel.AssetType.CODE
  }
  return DocumentModel.AssetType.OTHER
}

async function uploadCachedFileToDestination(
  destinationPath: string,
  file: File
): Promise<string | null> {
  if (typeof window === 'undefined' || !destinationPath || !file) return null
  const destinationDir = nodeApi.path.dirname(destinationPath)
  const destinationName = nodeApi.path.basename(destinationPath) || file.name || 'upload'

  // 1) Prefer Drive multipart (handles large files well across web/mobile/desktop IPC)
  try {
    const driveUpload = (window as any)?.server?.drive?.uploadFiles
    if (typeof driveUpload === 'function') {
      const renamed =
        destinationName && destinationName !== file.name
          ? new File([file], destinationName, { type: file.type || 'application/octet-stream' })
          : file
      const result = await driveUpload({ file: renamed, path: destinationDir })
      const remotePath = result?.data?.path || result?.path || result?.data?.paths?.[0] || ''
      if (result?.ok && remotePath) {
        return remotePath
      }
    }
  } catch {
    // fallthrough to legacy upload
  }

  // 2) Fallback: legacy FS upload endpoints (kept for backwards compatibility / unauth flows)
  const token = getAccessToken()
  const url = token
    ? `${BASE_URL}/fs/upload?path=${encodeURIComponent(destinationPath)}`
    : `${BASE_URL}/fs/public/upload?path=${encodeURIComponent(destinationPath)}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': destinationName,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body:
      destinationName && destinationName !== file.name
        ? new File([file], destinationName, { type: file.type || 'application/octet-stream' })
        : file
  })

  if (!response.ok) return null
  const payload = await response.json().catch(() => ({}))
  return payload?.path || destinationPath
}

async function copySourceToDestination(sourcePath: string, destinationPath: string): Promise<boolean> {
  try {
    await nodeApi.fsPromises.copyFile(sourcePath, destinationPath)
    return true
  } catch {
    try {
      const data = await nodeApi.fsPromises.readFile(sourcePath)
      await nodeApi.fsPromises.writeFile(destinationPath, data)
      return true
    } catch {
      return false
    }
  }
}

export async function importFileIntoDocumentAssets(
  sourcePath: string,
  options?: {
    document?: DocumentModel | null
    preferredAssetType?: AssetType
  }
): Promise<string> {
  const normalizedSource = normalizeSourcePath(sourcePath)
  if (!normalizedSource) return sourcePath

  const document = options?.document || DocumentModel.getActiveDocument()
  if (!document?.cachePath) return normalizedSource

  const assetType = options?.preferredAssetType || inferAssetType(normalizedSource)
  const targetDir = document.getAsset(assetType)
  await nodeApi.fsPromises.mkdir(targetDir, { recursive: true })

  if (normalizeComparePath(normalizedSource).startsWith(normalizeComparePath(targetDir) + '/')) {
    return normalizedSource
  }

  const originalName = nodeApi.path.basename(normalizedSource) || `attachment-${Date.now()}`
  const ext = nodeApi.path.extname(originalName)
  const baseName = ext ? originalName.slice(0, -ext.length) : originalName
  const uniqueName = await generateUniqueNameAsync({
    baseName: baseName || 'attachment',
    parentDir: targetDir,
    extension: ext
  })
  const destinationPath = nodeApi.path.join(targetDir, uniqueName)

  if (normalizeComparePath(normalizedSource) === normalizeComparePath(destinationPath)) {
    return destinationPath
  }

  let copied = false
  const cachedFile = getUploadedFile(normalizedSource) || getUploadedFile(sourcePath)

  if (Platform.getPlatform() !== Platform.SUPPORTED_PLATFORMS.desktop && cachedFile) {
    const uploadedPath = await uploadCachedFileToDestination(destinationPath, cachedFile)
    if (uploadedPath) {
      copied = true
      storeUploadedFile(uploadedPath, cachedFile, [normalizedSource, sourcePath, destinationPath])
      return uploadedPath
    }
  }

  if (!copied) {
    copied = await copySourceToDestination(normalizedSource, destinationPath)
  }

  if (!copied) {
    throw new Error(`Unable to import file into document assets: ${originalName}`)
  }

  return destinationPath
}
