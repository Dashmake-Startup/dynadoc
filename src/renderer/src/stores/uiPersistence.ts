import { writable, type Writable } from 'svelte/store'
import Platform from '../libs/platform'
import { persistStore } from '../utils/storePersistence'
import { getStorageDirCached } from '../utils/storageDir'
import { nodeApi } from '../utils/shims/node'

type PersistedStoreEntry<T> = {
  key: string
  store: Writable<T>
  defaultValue: T
  options?: {
    onLoad?: (data: any) => T
    beforeSave?: (data: T) => boolean
    onSave?: (data: T) => any
  }
}

const persistedEntries: PersistedStoreEntry<any>[] = []
let baseDir = ''
let isReady = false

export const UI_PERSISTENCE_MIRROR_PREFIX = 'ddoc.ui.pref:'

const isDesktopPlatform =
  Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop

const getMirrorKey = (key: string) => `${UI_PERSISTENCE_MIRROR_PREFIX}${key}`

function readMirrorValue<T>(key: string, defaultValue: T): T {
  if (typeof localStorage === 'undefined') return defaultValue
  try {
    const raw = localStorage.getItem(getMirrorKey(key))
    if (!raw) return defaultValue
    return JSON.parse(raw) as T
  } catch {
    return defaultValue
  }
}

function writeMirrorValue<T>(key: string, value: T) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(getMirrorKey(key), JSON.stringify(value))
  } catch {
    // ignore mirror write failures
  }
}

function attachPersistence<T>(entry: PersistedStoreEntry<T>) {
  if (!baseDir) return
  const safeKey = entry.key.replace(/[:\\/]/g, '__')
  const filePath = nodeApi.path.join(baseDir, `${safeKey}.json`)
  persistStore(filePath, entry.store, entry.defaultValue, entry.options)
}

export function createUiPersistedStore<T>(
  key: string,
  defaultValue: T,
  options?: PersistedStoreEntry<T>['options']
): Writable<T> {
  const initialValue = readMirrorValue(key, defaultValue)
  const store = writable<T>(initialValue)

  store.subscribe((value) => {
    writeMirrorValue(key, value)
  })

  const entry: PersistedStoreEntry<T> = {
    key,
    store,
    defaultValue,
    options
  }
  persistedEntries.push(entry)

  if (isReady) {
    attachPersistence(entry)
  }

  return store
}

export async function initializeUiPersistence() {
  if (isReady) return
  try {
    const storageDir = await getStorageDirCached()
    baseDir = nodeApi.path.join(storageDir, 'ui')

    const hydrate = () => {
      persistedEntries.forEach((entry) => attachPersistence(entry))
      isReady = true
      console.log('[boot] uiPersistenceHydrated')
    }

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(hydrate)
    } else {
      setTimeout(hydrate, 0)
    }
  } catch (error) {
    console.error('Failed to initialize UI persistence:', error)
    if (!isDesktopPlatform) {
      isReady = true
      persistedEntries.forEach((entry) => attachPersistence(entry))
    }
  }
}

export function getUiMirrorKey(key: string) {
  return getMirrorKey(key)
}
