import { getCurrentUserIdentity } from '../../../../services/identity/identity.service'
import { nodeApi } from '../../../../utils/shims/node'
import { writeFileEnsuringDirAsync } from '../../../../utils/documentFileUtils'

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

const HISTORY_DIR = 'form-submissions'

async function resolveHistoryFile(docUuid: string, responderId?: string | null) {
  if (!docUuid) return null
  const { userId, deviceId } = await getCurrentUserIdentity()
  const responder = responderId || userId || deviceId
  if (!responder) return null
  const cacheDir = await window.api?.getCacheDir?.()
  if (!cacheDir) return null
  // const nodeApi =
  //   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
  // const fs = nodeApi?.fs
  // const path = nodeApi?.path
  // if (!nodeApi.fs || !nodeApi.path) return null
  const docDir = nodeApi.path.join(cacheDir, docUuid)
  const historyDir = nodeApi.path.join(docDir, HISTORY_DIR)
  await nodeApi.fsPromises.mkdir(historyDir, { recursive: true })
  return nodeApi.path.join(historyDir, `${responder}.json`)
}

export async function loadSubmissionHistory(docUuid: string) {
  const filePath = await resolveHistoryFile(docUuid)
  if (!filePath) return []
  try {
    const raw = await nodeApi.fsPromises.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function appendSubmissionHistory(docUuid: string, submission: any) {
  const filePath = await resolveHistoryFile(docUuid)
  if (!filePath) return
  const existing = await loadSubmissionHistory(docUuid)
  existing.unshift(submission)
  try {
    await writeFileEnsuringDirAsync(filePath, JSON.stringify(existing.slice(0, 250), null, 2), 'utf-8')
  } catch (err) {
    console.error('Failed to save submission history', err)
  }
}
