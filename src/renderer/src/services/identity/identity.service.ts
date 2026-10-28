import { get } from 'svelte/store'
import { v4 as uuidv4 } from 'uuid'
import { authStore } from '../../stores/auth.store'
import { getSession } from '../auth/auth.service'
import { nodeApi } from '../../utils/shims/node'

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

const DEVICE_ID_STORAGE_KEY = 'dynadoc:deviceId'
const DEVICE_ID_FILENAME = 'device.identity.json'

let cachedDeviceId: string | null = null

export function getDeviceIdSync(): string | null {
  if (cachedDeviceId) return cachedDeviceId
  try {
    const local =
      typeof localStorage !== 'undefined' ? localStorage.getItem(DEVICE_ID_STORAGE_KEY) : null
    if (local) {
      cachedDeviceId = local
      return local
    }
  } catch {
    // ignore
  }
  return null
}

export function getAuthUserIdSync(): string | null {
  const state = get(authStore)
  const candidate =
    state?.user?.id ||
    (state as any)?.user?.uuid ||
    (state as any)?.user?.uid ||
    (state as any)?.user?.userId
  return candidate ? String(candidate) : null
}

async function readDeviceIdFromStorage(): Promise<string | null> {
  try {
    const local = typeof localStorage !== 'undefined' ? localStorage.getItem(DEVICE_ID_STORAGE_KEY) : null
    if (local) return local
  } catch {
    // ignore
  }

  try {
    const storageDir = await window.api?.getStorageDir?.()
    // const nodeApi =
    //   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
    // const fs = nodeApi?.fs
    // const path = nodeApi?.path
    if (!storageDir || !nodeApi.fsPromises?.exists || !nodeApi.path?.join) return null
    const filePath = nodeApi.path.join(storageDir, DEVICE_ID_FILENAME)
    if (!(await nodeApi.fsPromises.exists(filePath))) return null
    const raw = await nodeApi.fsPromises.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw || '{}')
    const id = parsed?.id || parsed?.deviceId || parsed?.uuid
    return id ? String(id) : null
  } catch {
    return null
  }
}

async function persistDeviceId(id: string): Promise<void> {
  if (!id) return
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id)
    }
  } catch {
    // ignore
  }

  try {
    const storageDir = await window.api?.getStorageDir?.()
    if (!storageDir || !nodeApi.fsPromises?.mkdir || !nodeApi.path?.join) return
    const filePath = nodeApi.path.join(storageDir, DEVICE_ID_FILENAME)
    await nodeApi.fsPromises.mkdir(storageDir, { recursive: true })
    await nodeApi.fsPromises.writeFile(
      filePath,
      JSON.stringify({ id, createdAt: new Date().toISOString() }, null, 2),
      'utf-8'
    )
  } catch {
    // ignore
  }
}

async function requestDeviceIdFromServer(): Promise<string | null> {
  try {
    const serverApi = (window as any)?.server
    const result = await serverApi?.auth?.getDeviceId?.()
    const id =
      result?.id ||
      result?.deviceId ||
      result?.uuid ||
      result?.data?.id ||
      result?.data?.deviceId ||
      result?.data?.uuid
    return id ? String(id) : null
  } catch {
    return null
  }
}

export async function getOrCreateDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId
  const existing = await readDeviceIdFromStorage()
  if (existing) {
    cachedDeviceId = existing
    return existing
  }

  const fromServer = await requestDeviceIdFromServer()
  if (fromServer) {
    cachedDeviceId = fromServer
    await persistDeviceId(fromServer)
    return fromServer
  }

  const generated = uuidv4()
  cachedDeviceId = generated
  await persistDeviceId(generated)
  return generated
}

export async function getCurrentUserIdentity(): Promise<{ userId: string | null; deviceId: string }> {
  let userId = getAuthUserIdSync()
  if (!userId && get(authStore)?.authenticated) {
    try {
      const session = await getSession()
      userId = session?.user?.id ? String(session.user.id) : null
    } catch {
      // ignore
    }
  }
  const deviceId = await getOrCreateDeviceId()
  return { userId, deviceId }
}

export type OwnerCheckIdentity = {
  authenticated?: boolean
  userId?: string | null
  deviceId?: string | null
  userEmails?: string[]
  userGroups?: string[]
}

export type OwnerCheckDocument = {
  createdBy?: string | null
  createdByTemp?: string | null
  ownerIds?: Array<string | number>
  ownerGroups?: Array<string | number>
}

function normalizeStr(v: any): string {
  return String(v ?? '').trim()
}

function normalizeLower(v: any): string {
  return normalizeStr(v).toLowerCase()
}

export function isIdentityOwnerOfDocument(identity: OwnerCheckIdentity, doc: OwnerCheckDocument): boolean {
  const deviceId = normalizeStr(identity?.deviceId)
  const userId = normalizeStr(identity?.userId)

  const createdBy = normalizeStr(doc?.createdBy)
  const createdByTemp = normalizeStr(doc?.createdByTemp)

  // Offline-first: if the document was created on this device, treat it as owned even when logged out.
  if (deviceId && createdByTemp && deviceId === createdByTemp) return true

  const ownerIds = Array.isArray(doc?.ownerIds) ? doc.ownerIds.map((v) => normalizeStr(v)) : []
  const ownerGroups = Array.isArray(doc?.ownerGroups) ? doc.ownerGroups.map((v) => normalizeStr(v)) : []

  // Some docs may store the device id in the explicit owners list.
  if (deviceId && ownerIds.includes(deviceId)) return true

  // Authenticated / account-based checks.
  if (userId) {
    if (createdBy && createdBy === userId) return true
    if (ownerIds.includes(userId)) return true
  }

  const emails = Array.isArray(identity?.userEmails) ? identity.userEmails.map(normalizeLower) : []
  if (emails.length && ownerIds.length) {
    for (const id of ownerIds) {
      if (id && emails.includes(normalizeLower(id))) return true
    }
  }

  const groups = Array.isArray(identity?.userGroups) ? identity.userGroups.map(normalizeStr) : []
  if (groups.length && ownerGroups.length) {
    const groupSet = new Set(groups)
    for (const g of ownerGroups) {
      if (g && groupSet.has(g)) return true
    }
  }

  return false
}
