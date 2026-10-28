import { get, writable } from 'svelte/store'
import { _$_documentEditorsList } from '../../../../stores/editor.store'
import { getCurrentUserIdentity } from '../../../../services/identity/identity.service'
import { nodeApi } from '../../../../utils/shims/node'
import { writeFileEnsuringDirAsync } from '../../../../utils/documentFileUtils'

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

type FieldValueMap = Record<string, Record<string, any>>

export const nodeFieldValues = writable<FieldValueMap>({})
export const nodeFieldMeta = writable<{ lastSavedAt?: number; lastUpdatedAt?: number }>({})

const RESPONSE_DIR = 'form-responses'
let _activeResponseFile: string | null = null
let _initialized = false

function getActiveDocumentUuid() {
  const active = _$_documentEditorsList.getActiveSync?.() ?? get(_$_documentEditorsList.getActive())
  return active?.document?.uuid || active?.uuid || active?.id || ''
}

async function resolveResponseFile(): Promise<string | null> {
  const active =
    _$_documentEditorsList.getActiveSync?.() ?? get(_$_documentEditorsList.getActive())
  const docUuid = active?.document?.uuid || active?.uuid || active?.id || ''
  if (!docUuid) return null
  const { userId, deviceId } = await getCurrentUserIdentity()
  const responderId = userId || deviceId
  if (!responderId) return null
  const docCachePath = active?.document?.cachePath
  if (!docCachePath) return null
  // const nodeApi =
  //   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
  // const fs = nodeApi?.fs
  // const path = nodeApi?.path
  const responseDir = nodeApi.path.join(docCachePath, 'assets', RESPONSE_DIR)
  return nodeApi.path.join(responseDir, `${responderId}.json`)
}

async function readFile(filePath: string): Promise<FieldValueMap> {
  try {
    const raw = await nodeApi.fsPromises.readFile(filePath, 'utf-8')
    return JSON.parse(raw || '{}')
  } catch {
    return {}
  }
}

async function ensureResponseFileLoaded() {
  const filePath = await resolveResponseFile()
  if (!filePath) return
  if (_activeResponseFile === filePath && _initialized) return
  _activeResponseFile = filePath
  const saved = await readFile(filePath)
  nodeFieldValues.set(saved || {})
}

export async function initNodeFieldValues() {
  await ensureResponseFileLoaded()
  if (_initialized) return
  _initialized = true
  nodeFieldValues.subscribe((store) => {
    if (!_activeResponseFile) return
    if (!store || Object.keys(store).length === 0) return
    void writeFileEnsuringDirAsync(
        _activeResponseFile,
        JSON.stringify(store, null, 2),
        'utf-8'
      )
      .then(() => {
        nodeFieldMeta.update((meta) => ({ ...meta, lastSavedAt: Date.now() }))
      })
      .catch((err) => {
        console.error('Failed to save form data:', err)
      })
  })
}

export async function refreshNodeFieldValues() {
  await ensureResponseFileLoaded()
}

export function updateNodeField(nodeId: string, attrName: string, value: any) {
  nodeFieldValues.update((store) => {
    if (!store[nodeId]) store[nodeId] = {}
    store[nodeId][attrName] = value
    return store
  })
  nodeFieldMeta.update((meta) => ({ ...meta, lastUpdatedAt: Date.now() }))
}

export function getNodeFieldSnapshot(): FieldValueMap {
  return get(nodeFieldValues)
}

export function clearNodeFieldValues() {
  nodeFieldValues.set({})
  nodeFieldMeta.update((meta) => ({ ...meta, lastUpdatedAt: Date.now() }))
}
