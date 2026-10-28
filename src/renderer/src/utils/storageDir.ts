let cachedStorageDir: Promise<string> | null = null

export async function getStorageDirCached(): Promise<string> {
  if (cachedStorageDir) return cachedStorageDir
  cachedStorageDir = (async () => {
    try {
      return await window.api.getStorageDir()
    } catch {
      return 'drive'
    }
  })()
  return cachedStorageDir
}

