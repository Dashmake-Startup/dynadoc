/*
 *   Copyright (c) 2024
 *   All rights reserved.
 */
import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    // electron: ElectronAPI
    api: {
      mattermost?: {
        prepareSession: () => Promise<{ ok: boolean; baseUrl?: string; message?: string }>
      }
      jitsi?: {
        getJoinUrl: (payload: { room: string }) => Promise<{ ok: boolean; url?: string; jwt?: string; message?: string }>
      }
      dify?: {
        uploadDocuments: (payload: { localPaths: string[]; datasetId?: string; indexingTechnique?: string; processRule?: any; data?: any }) => Promise<any>
        listDatasets: (payload?: { page?: number; limit?: number; scope?: string }) => Promise<any>
        onUploadProgress: (callback: (payload: { file: string; index: number; total: number; percent: number; status: string }) => void) => () => void
      }
      [key: string]: any
      searchFiles: (payload: {
        rootPath: string
        query: string
        isRegex?: boolean
        caseSensitive?: boolean
        wholeWord?: boolean
        includePattern?: string
        excludePattern?: string
        maxResults?: number
        maxMatchesPerFile?: number
        restrictToPaths?: string[]
      }) => Promise<any>
      replaceInFiles: (payload: {
        rootPath: string
        query: string
        replaceText: string
        isRegex?: boolean
        caseSensitive?: boolean
        wholeWord?: boolean
        includePattern?: string
        excludePattern?: string
        restrictToPaths?: string[]
      }) => Promise<any>
      searchFileNames: (payload: {
        rootPath: string
        query: string
        includePattern?: string
        excludePattern?: string
        maxResults?: number
      }) => Promise<any>
      setUnsavedBadge?: (count: number) => Promise<void>
      onAppOpenFile?: (callback: (filePath: string) => void) => () => void
      onInvokeMenuAction?: (callback: (event: any, id: string) => void) => () => void
      onAppCloseRequested?: (
        callback: (payload: { reason: 'window-close' | 'app-quit' }) => void
      ) => () => void
      respondToAppClose?: (payload: { action: 'cancel' | 'quit' }) => Promise<void>
      getPreloadPath: (name: string) => Promise<string | null>
      browser?: {
        createTab: (url?: string) => Promise<any>
        closeTab: (id: string) => Promise<void>
        activateTab: (id: string) => Promise<void>
        navigate: (id: string, url: string) => Promise<void>
        reload: (id: string) => Promise<void>
        goBack: (id: string) => Promise<void>
        goForward: (id: string) => Promise<void>
        setBounds: (bounds: { x: number; y: number; width: number; height: number }) => Promise<void>
        setVisible: (visible: boolean) => Promise<void>
        listTabs: () => Promise<any[]>
        queryHistory: (query: string) => Promise<any[]>
        respondPermission: (requestId: string, allow: boolean) => Promise<void>
        onTabsChanged: (callback: (tabs: any[]) => void) => void
        onTabUpdated: (callback: (tab: any) => void) => void
        onTabRemoved: (callback: (tabId: string) => void) => void
        onDownloadUpdate: (callback: (payload: any) => void) => void
        onPermissionRequest: (callback: (payload: any) => void) => void
        onInsertText: (callback: (payload: { text: string }) => void) => void
        onVarInput: (callback: (payload: any) => void) => void
        onVarInputKey: (callback: (payload: { key: string; tabId: string }) => void) => void
        insertVarText: (payload: { tabId: string; text: string }) => void
      }
      embedded?: {
        create: (payload: { id: string; url: string; preloadPath?: string; partition?: string; userAgent?: string; permissions?: string[] }) => Promise<any>
        setBounds: (payload: { id: string; bounds: { x: number; y: number; width: number; height: number } }) => Promise<any>
        setVisible: (payload: { id: string; visible: boolean }) => Promise<any>
        destroy: (id: string) => Promise<any>
        navigate: (payload: { id: string; url: string }) => Promise<any>
        executeJavaScript: (payload: { id: string; script: string }) => Promise<any>
        insertCSS: (payload: { id: string; css: string }) => Promise<any>
        openDevTools: (id: string) => Promise<any>
        focus: (id: string) => Promise<any>
        setZ: (payload: { id: string; zIndex: number }) => Promise<any>
        onEvent: (callback: (payload: any) => void) => () => void
        onVarInput: (callback: (payload: any) => void) => void
        onVarInputKey: (callback: (payload: { key: string; id: string }) => void) => void
        insertVarText: (payload: { id: string; text: string }) => void
      }
      overlay?: {
        setVisible: (payload: { visible: boolean }) => Promise<any>
      }
      openDialogFile: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<string | null>
      openDialogFiles: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<string[]>
      saveDialogFile: (options?: {
        title?: string
        defaultPath?: string
        filters?: Array<{ name: string; extensions: string[] }>
      }) => Promise<string | null>
      openDialogDirectory: () => Promise<string | null>
      printFile: (filePath: string, options?: any) => Promise<boolean>
      clipboard: {
        readText: () => string
        readHTML: () => string
        readImageDataUrl: () => string | null
        readFilePaths: () => string[]
        write: (payload: { text?: string; html?: string; imageDataUrl?: string }) => boolean
      }
    }
    server: {
      auth?: {
        signIn: (payload?: { org?: string }) => Promise<any>
        signUp: (payload?: { org?: string }) => Promise<any>
        register: (payload?: { org?: string }) => Promise<any>
        joinInvite: (payload: { code: string }) => Promise<any>
        getSession: (payload?: { org?: string }) => Promise<any>
        forceRefresh?: (payload?: { org?: string }) => Promise<any>
        getDeviceId?: () => Promise<{ ok: boolean; deviceId?: string; message?: string }>
        listSessions: () => Promise<any>
        setActiveOrg: (payload: { org: string }) => Promise<any>
        logout: (payload?: { org?: string }) => Promise<any>
        onSessionChanged: (callback: (session: any) => void) => () => void
      }
      forms?: {
        submit: (payload: any) => Promise<any>
        list: (payload: { docUuid: string }) => Promise<any>
        get: (payload: { docUuid: string; submissionId: string }) => Promise<any>
        history?: (payload: { docUuid: string; responderId: string }) => Promise<any>
      }
      fonts?: {
        resolve: (payload: { fonts: string[]; platform?: string; locale?: string }) => Promise<any>
      }
      drive?: {
        getRoot: () => Promise<string>
        listDir: (payload: { rootPath?: string; path?: string; query?: string; sort?: boolean }) => Promise<any[]>
        openItem: (payload: { rootPath?: string; path: string }) => Promise<boolean>
        mkdir: (payload: { path: string }) => Promise<{ ok: boolean; message?: string }>
        uploadFiles: (payload: { path?: string; localPaths: string[] }) => Promise<{ ok: boolean; message?: string; uploaded?: string[] }>
        downloadItem: (payload: { path: string; saveTo?: string }) => Promise<{ ok: boolean; message?: string; savePath?: string }>
        deleteItem: (payload: { path: string }) => Promise<{ ok: boolean; message?: string }>
        moveItem: (payload: { from: string; to: string }) => Promise<{ ok: boolean; message?: string; path?: string }>
        copyItem: (payload: { from: string; to: string }) => Promise<{ ok: boolean; message?: string; path?: string }>
        shareItem: (payload: { path: string; publicRole?: 'viewer' | 'commenter' | 'editor' }) => Promise<{ ok: boolean; message?: string; code?: number }>
        syncDoc: (payload: { cachePath: string }) => Promise<{ ok: boolean; uploadedCount?: number; totalCount?: number; failed?: { path: string; error: string }[]; message?: string }>
      }
      share?: {
        resolve: (payload: { shareId?: string; docUuid?: string; name?: string; password?: string }) => Promise<any>
        download: (payload: { shareId?: string; docUuid?: string; name?: string; password?: string; path?: string; saveTo?: string }) => Promise<any>
        audit: (payload: { shareId: string; action?: string }) => Promise<any>
        auditList: (payload: { shareId: string; limit?: number }) => Promise<any>
        rotate: (payload: { shareId: string }) => Promise<any>
        editLock: (payload: {
          shareId: string
          enabled?: boolean
          lockMinutes?: number
          lockUntil?: string
          reason?: string
        }) => Promise<any>
      }
      sync?: {
        start: (payload: { cachePath: string }) => Promise<{ ok: boolean; message?: string }>
        stop: (payload: { cachePath: string }) => Promise<{ ok: boolean; message?: string }>
        open: (payload: { cachePath: string }) => Promise<any>
        commit: (payload: { cachePath: string }) => Promise<any>
        history: (payload: { uuid: string }) => Promise<any>
        rollback: (payload: { uuid: string; path: string; timestamp: string }) => Promise<any>
        rename: (payload: { from: string; to: string }) => Promise<any>
      }
      [key: string]: any
    }
    terminal: object
    presentationAPI: {
      getInitialData: () => Promise<any>
      sendData: (ipcKey: string, payload: any) => void
      onData: (cb: (payload: any) => void) => void
      onUpdate: (cb: (payload: any) => void) => void
      navigate: (index: number) => void
      focusOnPresentationWindow: () => void
      stop: (scope?: 'presenter' | 'all') => void
    }
    meetingAPI: object
    process: object
    node: {
      fs: {
        readFileSync: typeof import('fs').readFileSync
        readFile: typeof import('fs').readFile
        existsSync: typeof import('fs').existsSync
        writeFileSync: typeof import('fs').writeFileSync
        writeFile: typeof import('fs').writeFile
        mkdirSync: typeof import('fs').mkdirSync
        readdirSync: typeof import('fs').readdirSync
        readdir: typeof import('fs').readdir
        lstatSync: typeof import('fs').lstatSync
        statSync: typeof import('fs').statSync
      }
      fsPromises: {
        readFile: typeof import('fs/promises').readFile
        writeFile: typeof import('fs/promises').writeFile
        readdir: typeof import('fs/promises').readdir
        mkdir: typeof import('fs/promises').mkdir
        stat: typeof import('fs/promises').stat
        lstat: typeof import('fs/promises').lstat
        copyFile: typeof import('fs/promises').copyFile
        rename: typeof import('fs/promises').rename
        open: typeof import('fs/promises').open
        rm: typeof import('fs/promises').rm
        unlink: typeof import('fs/promises').unlink
        rmdir: typeof import('fs/promises').rmdir
        exists: (path: string) => Promise<boolean>
      }
      path: {
        join: typeof import('path').join
        basename: typeof import('path').basename
        extname: typeof import('path').extname
        dirname: typeof import('path').dirname
        resolve: typeof import('path').resolve
      }
      os: {
        homedir: typeof import('os').homedir
        tmpdir: typeof import('os').tmpdir
      }
    }
  }
}
