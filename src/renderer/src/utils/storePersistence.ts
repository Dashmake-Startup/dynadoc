import { writable } from 'svelte/store'
import { debounce } from 'lodash'
import { invoke } from '../lib/api/web/rpc'
import { nodeApi } from './shims/node'
import Platform from '../libs/platform'
// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fsPromises = nodeApi?.fsPromises
// const fs = nodeApi?.fs
// const path = nodeApi?.path

// NOTE: keep this module free of editor/common store imports to avoid circular deps.

// const filePath = window.api.node.path.join(app.getPath('userData'), 'documentEditors.json')
// var fs = nodeApi.fs
// var path = nodeApi.path
/* export function persistStore<T>(filePath: string, store: writable<T>, defaultValue: T, onSuccess: Function) {
  // export function persistStore<T>(filePath: string, store: writable<T>, defaultValue: T) {
  // Load stored value on startup
  if (window.api.node.nodeApi.fs.existsSync(filePath)) {
    try {
      const data = window.api.node.nodeApi.fs.readFileSync(filePath, 'utf8')
      // console.log('store.  load persisted store:', JSON.parse(data), DocumentEditorModel.fromJSONList(JSON.parse(data)))
      if (onSuccess) store.set(onSuccess(data))

      // store.set(DocumentEditorModel.fromJSONList(JSON.parse(data)))
      // store.set(JSON.parse(data))
    } catch (err) {
      console.error('store. Failed to load persisted store:', err)
      store.set(defaultValue)
    }
  } else {
    store.set(defaultValue)
  }

  const saveToDisk = debounce((data) => {
    var dataToSave = JSON.stringify(data)
    // var dataToSave = JSON.stringify(DocumentEditorModel.
    //   toJSONList(DocumentEditorModel.fromJSONList(data)) || data, null, 2)
    // console.log('store.subscribe saveToDisk:', data, dataToSave, JSON.stringify(DocumentEditorModel.
    // toJSONList(DocumentEditorModel.fromJSONList(data)) || data, null, 2))
    EditorHelpers.writeFileEnsuringDir(filePath, dataToSave, 'utf8')
  }, 500)

  // Save on every change
  store.subscribe((value) => {
    try {
      console.log('store.subscribe:', value)
      saveToDisk(value)
      // EditorHelpers.writeFileEnsuringDir(filePath, JSON.stringify(value, null, 2), 'utf8')
    } catch (err) {
      console.error('Failed to persist store:', err)
    }
  })
}
 */

/**
 * Persist any writable store to a JSON file.
 *
 * @param fileName - Name of the JSON file (relative to src/stores/vars)
 * @param store - Svelte writable store
 * @param defaultValue - Default value when file doesn’t exist or parse fails
 * @param options - Optional handlers for load/save transformations
 */
export function persistStore<T>(
  fileName: string,
  store: writable<T>,
  defaultValue?: T,
  options?: {
    onLoad?: (data: any) => T
    beforeSave?: (data: T) => boolean
    onSave?: (data: T) => any
  },
  setStoreValue: boolean = true
) {
  console.log(`persistStore enter 1:`, { fileName, defaultValue })

  let hasLoaded = !setStoreValue
  // Through the shared helper, not a raw read of `window.__platform`. The
  // preload still exposes that name, so a raw read happens to be right today,
  // but it is right by accident: the day SPEC-001 stops exposing it, this line
  // would quietly answer "not desktop" and every UI store would start writing
  // to localStorage instead of the filesystem. Nothing would throw, and
  // nothing in CI would notice.
  const isDesktop = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop

  // Which backend holds this store depends on whether anyone is signed in, and
  // that is not known once and for all: the access token is written by the auth
  // bootstrap, which may land after this module runs. Deciding here and freezing
  // the answer is what let a signed-out session's documents end up inside a
  // freshly created account — the store loaded from localStorage while no token
  // was present, then a later save carried that value into the account's
  // server-side preferences, which are user-scoped.
  //
  // So resolve the backend per operation, and remember which one the current
  // value came from.
  type Backend = 'fs' | 'settings' | 'local'
  const currentBackend = (): Backend => {
    if (isDesktop) return 'fs'
    let signedIn = false
    try {
      signedIn = Boolean(localStorage.getItem('ddoc.access_token'))
    } catch {
      signedIn = false
    }
    return signedIn ? 'settings' : 'local'
  }
  let loadedFrom: Backend | null = null
  const storageKey = `ddoc.store:${fileName}`
  const settingsKey = `ui:${fileName}`
  // const dirPath = window.api.node.path.resolve('src/stores/vars')
  // const filePath = window.api.node.path.join(dirPath, fileName)

  // Resolve full path
  const filePath = isDesktop ? nodeApi.path.resolve(fileName) : fileName.replace(/^\/+/, '')
  const dirPath = nodeApi.path.dirname(filePath)

  if (isDesktop) {
    void nodeApi.fsPromises.mkdir(dirPath, { recursive: true }).catch(() => {
      // ignore eager mkdir failures; load/save paths handle their own errors
    })
  }

  const load = async (backend: Backend): Promise<void> => {
    try {
      if (backend === 'local') {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null
        if (raw) {
          const json = JSON.parse(raw)
          const value = options?.onLoad ? options.onLoad(json) : json
          store.set(value)
          return
        }
        if (defaultValue) store.set(defaultValue)
        return
      }

      if (backend === 'settings') {
        let value: any = null
        try {
          value = await invoke<any>('settings:get', { asResponse: false }, settingsKey)
        } catch {
          // fall through to the default below
        }
        if (value != null) {
          store.set(options?.onLoad ? options.onLoad(value) : (value as T))
          return
        }
        // An account with nothing stored starts empty. Leaving the previous
        // value in place is what made a new account appear to own documents
        // it had never seen.
        store.set((defaultValue ?? ([] as unknown)) as T)
        return
      }

      const raw = await nodeApi.fsPromises.readFile(filePath, 'utf8')
      const json = JSON.parse(raw)
      store.set(options?.onLoad ? options.onLoad(json) : json)
    } catch (err) {
      if (defaultValue) store.set(defaultValue)
      console.error(`Failed to load ${fileName}:`, err)
    }
  }

  // Load data on startup (async to avoid sync reads on web/mobile)
  if (setStoreValue) {
    void (async () => {
      const backend = currentBackend()
      await load(backend)
      loadedFrom = backend
      hasLoaded = true
    })()
  }

  // Add a simple lock/promise chain to ensure sequential execution
  let pendingSave: Promise<void> = Promise.resolve()

  // Debounced saving
  const saveToDisk = debounce(async (value: T) => {
    if (!hasLoaded) return

    // Wait for any previous save to finish completely before starting this one
    await pendingSave

    // Create the new save promise
    pendingSave = (async () => {
      try {
        const backend = currentBackend()

        // Never write a value into a backend it did not come from. Signing in
        // switches 'local' to 'settings', and without this the signed-out
        // session's value would be written straight into the account's
        // server-side, user-scoped preferences. Re-read instead: the account's
        // own state is the truth, and the signed-out value stays in
        // localStorage where it was, rather than being destroyed.
        if (loadedFrom !== null && backend !== loadedFrom) {
          await load(backend)
          loadedFrom = backend
          return
        }

        if (options?.beforeSave && !options?.beforeSave(value)) return

        const dataToSave = options?.onSave ? options.onSave(value) : value

        if (backend === 'local') {
          localStorage.setItem(storageKey, JSON.stringify(dataToSave))
        } else if (backend === 'settings') {
          await invoke('settings:set', { asResponse: false }, settingsKey, dataToSave)
        } else {
          await nodeApi.fsPromises.mkdir(nodeApi.path.dirname(filePath), { recursive: true })
          await nodeApi.fsPromises.writeFile(filePath, JSON.stringify(dataToSave, null, 2), 'utf8')
        }
      } catch (err) {
        console.error(`Failed to save ${fileName}:`, err)
      }
    })()

    await pendingSave
  }, 500)

  /* const saveToDisk = debounce(async (value: T) => {
    if (!hasLoaded) return
    if (options?.beforeSave && !options?.beforeSave(value)) {
      return
    }
    // console.error(`persistStore saveToDisk:`, { value })

    console.log(`saveToDisk to save ${fileName}:`, value)
    try {
      const dataToSave = options?.onSave ? options.onSave(value) : value
      if (useLocalStorage) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(storageKey, JSON.stringify(dataToSave))
        }
        return
      }
      if (useSettingsStore) {
        void invoke('settings:set', { asResponse: false }, settingsKey, dataToSave).catch((err) => {
          console.warn('Failed to persist settings:', err)
        })
        return
      }
      try {
        const dir = nodeApi.path.dirname(filePath)
        await nodeApi.fsPromises.mkdir(dir, { recursive: true })
        await nodeApi.fsPromises.writeFile(filePath, JSON.stringify(dataToSave, null, 2), 'utf8')
      } catch (writeErr) {
        console.error(`Failed to write ${fileName}:`, writeErr)
      }
    } catch (err) {
      console.error(`Failed to save ${fileName}:`, err)
    }
  }, 500) */

  // Subscribe and persist
  store.subscribe((value) => saveToDisk(value))
}
