export interface AppPlatformAPI {
  // Filesystem
  readFile: (path: string, encoding?: string) => Promise<string>
  readDir: (path: string) => Promise<any[]>

  // System
  getFonts: () => Promise<string[]>
  getStorageDir: () => Promise<string>
  openExternal: (url: string) => Promise<void>

  // UI
  showContextMenu: (template: any[]) => void
  showNotification: (title: string, body: string) => void
}
