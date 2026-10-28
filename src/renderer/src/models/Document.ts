/**
 * Copyright (C) 2025 Dashmake Inc.
 *
 * This file is part of DDoc Office.
 *
 * DDoc Office is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DDoc Office is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
 */

// const nodeApiWeb = (window as any)?.api?.node

/* export const nodeApiWW = new Proxy({} as any, {
  get(_, prop) {
    // const actualApi = (window as any)?.api?.node ;
    const actualApi = (window as any)?.api?.node || (window as any)?.node;
    if (!actualApi) {
      console.warn(`[Dynadoc] Attempted to access nodeApi.${String(prop)} before initialization.`);
      return undefined;
    }
    return actualApi[prop];
  }
}); */

/* const nodeApi =
  typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null

// const fs = nodeApi?.fs
// const path = nodeApi?.path
// const fsPromises = nodeApi?.fsPromises
 */

import {
  defaultDocumentConfiguration,
  defaultDocumentConfigurationByType,
  createDefaultDocumentInfo,
  DocumentConfiguration,
  DocumentInfo,
  type EphemeralRule,
  type DocumentSecurityConfiguration,
  type EphemeralAuditEntry,
  type EphemeralAccessLog
} from './DocumentInfo'
import { getCurrentUserIdentity } from '../services/identity/identity.service'
import type { DocumentContentType, DocumentContentKindType } from './document.types'

// import * as fs from 'nodeApi.fs'
// import path from 'nodeApi.path'
// import * as path from 'nodeApi.path'
import Utils from '../utils/Utils'
import {
  writeFileEnsuringDir,
  writeFileEnsuringDirAsync,
  generateUniqueNameAsync,
  getFileRootFromBaseDir,
  convertDocxToHtml,
  convertHtmlToDocx
} from '../utils/documentFileUtils'
import { NavigationTab } from './Tab'
import { type } from 'process'
import SecurityHelpers from '../utils/SecurityHelpers'
import { v4 as uuidv4 } from 'uuid'

import { _ as base_, isLoading } from 'svelte-i18n'
import { get } from 'svelte/store'
import { markSecureLeaseUnavailable, notifySecureLeaseRequired } from '../stores/secureLease.store'
import { openAlertModal } from '../stores/alertModal.store'
import { openStepUpModal } from '../stores/stepUpModal.store'
import { getValidStepUpToken, isStepUpRequiredError } from '../services/auth/stepup.service'
import { CustomSlideExtensionProps } from '../extensions/tiptap/CustomSlideExtension/utils/common.utils'
import { CustomSpreadsheetExtensionProps } from '../extensions/tiptap/CustomSpreadsheetExtension/utils/common.utils'
import { CustomDesignExtensionProps } from '../extensions/tiptap/CustomDesignExtension/utils/common.utils'
import { CustomAIExtensionProps } from '../extensions/tiptap/CustomAIExtension/utils/common.utils'
import { GenericCustomExtensionProps } from '../extensions/tiptap/utils/common.utils'
import { getThisBodyNodePosition } from '../extensions/tiptap/tiptap-extension-pagination/src/utils/nodes/body/bodyPosition'
import Platform from '../libs/platform'
import { authStore } from '../stores/auth.store'
import { DriveActions } from '../utils/driveActions'
import {
  shareCacheHas,
  shareCacheListDir,
  shareCacheResolvePath,
  shareCacheStat
} from '../utils/shareCache'
import { nodeApi } from '../utils/shims/node'
import { markFileReadable, markFileUnreadable } from '../utils/unreadableFiles'
import { awaitDriveReady } from '../utils/driveReady'
import { CustomSurveyExtensionProps } from '../extensions/tiptap/CustomSurveyExtension/utils/common.utils'
const t = (key: string) => get(base_)(key)

function normalizeRemotePath(value: string) {
  if (!value) return value
  const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop

  /* const isDesktopPlatform = (() => {
    if (typeof window === 'undefined') {
      return Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
    }
    const anyWindow = window as any
    if (anyWindow.__platform) return anyWindow.__platform === 'desktop'
    if (anyWindow.process?.versions?.electron) return true
    return Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
  })() */
  if (isDesktopPlatform) return value
  let normalized = value.replace(/^\/+/, '').replace(/^file:\/\//i, '')
  if (normalized === 'drive') return ''
  if (normalized.startsWith('drive/')) {
    normalized = normalized.slice('drive/'.length)
  }
  if (!normalized) return normalized
  if (normalized.startsWith('home/share-cache/')) {
    return normalized.slice('home/'.length)
  }
  if (normalized.startsWith('share-cache/')) {
    return normalized
  }
  if (normalized === 'home' || normalized.startsWith('home/') || normalized.startsWith('shared/')) {
    return normalized
  }
  if (normalized.startsWith('.history/')) {
    return `home/${normalized}`
  }
  return `home/${normalized}`
}

function toFiniteNumber(value: any, fallback?: number): number | undefined {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return num
}

function toPxFromCss(value: string): number | undefined {
  if (!value) return undefined
  const trimmed = value.trim().toLowerCase()
  const num = parseFloat(trimmed)
  if (!Number.isFinite(num)) return undefined
  if (trimmed.endsWith('px')) return num
  if (trimmed.endsWith('pt')) return (num * 96) / 72
  if (trimmed.endsWith('in')) return num * 96
  if (trimmed.endsWith('cm')) return num * 37.7952755906
  if (trimmed.endsWith('mm')) return num * 3.77952755906
  return undefined
}

function extractPageFormatFromHtml(html: string): {
  pageWidth?: number
  pageHeight?: number
  marginTop?: number
  marginBottom?: number
  marginLeft?: number
  marginRight?: number
} | null {
  if (!html) return null
  const pageBlockMatch = html.match(/@page\s*[^{]*\{[^}]*\}/i)
  const pageBlock = pageBlockMatch?.[0] || ''
  if (!pageBlock) return null

  const sizeMatch = pageBlock.match(/size\s*:\s*([^;}]*)/i)
  const sizeValue = sizeMatch?.[1]?.trim() || ''

  let pageWidth: number | undefined
  let pageHeight: number | undefined

  const namedSizes: Record<string, { width: number; height: number }> = {
    a4: { width: 8.27 * 96, height: 11.69 * 96 },
    letter: { width: 8.5 * 96, height: 11 * 96 },
    legal: { width: 8.5 * 96, height: 14 * 96 },
    a3: { width: 11.69 * 96, height: 16.54 * 96 },
    a5: { width: 5.83 * 96, height: 8.27 * 96 }
  }

  if (sizeValue) {
    const tokens = sizeValue.split(/\s+/).filter(Boolean)
    const nameToken = tokens.find((t) => /^[a-z]+$/i.test(t) && namedSizes[t.toLowerCase()])
    if (nameToken) {
      const base = namedSizes[nameToken.toLowerCase()]
      pageWidth = base.width
      pageHeight = base.height
    }
    if (tokens.length >= 2) {
      const w = toPxFromCss(tokens[0])
      const h = toPxFromCss(tokens[1])
      if (w && h) {
        pageWidth = w
        pageHeight = h
      }
    }
    if (tokens.includes('landscape') && pageWidth && pageHeight && pageHeight > pageWidth) {
      const temp = pageWidth
      pageWidth = pageHeight
      pageHeight = temp
    }
  }

  const marginMatch = pageBlock.match(/margin\s*:\s*([^;}]*)/i)
  const marginValue = marginMatch?.[1]?.trim() || ''
  let marginTop: number | undefined
  let marginBottom: number | undefined
  let marginLeft: number | undefined
  let marginRight: number | undefined

  if (marginValue) {
    const parts = marginValue.split(/\s+/).filter(Boolean)
    const values = parts
      .map((part) => toPxFromCss(part))
      .filter((v) => typeof v === 'number') as number[]
    if (values.length === 1) {
      marginTop = marginBottom = marginLeft = marginRight = values[0]
    } else if (values.length === 2) {
      marginTop = marginBottom = values[0]
      marginLeft = marginRight = values[1]
    } else if (values.length === 3) {
      marginTop = values[0]
      marginLeft = marginRight = values[1]
      marginBottom = values[2]
    } else if (values.length >= 4) {
      marginTop = values[0]
      marginRight = values[1]
      marginBottom = values[2]
      marginLeft = values[3]
    }
  }

  return {
    pageWidth,
    pageHeight,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight
  }
}

function applyInfoToConfig(configData: any, infoData: any): any {
  if (!infoData || typeof infoData !== 'object') return configData
  const meta =
    infoData.systemInfo && typeof infoData.systemInfo === 'object' ? infoData.systemInfo : infoData

  const pageWidth = toFiniteNumber(
    meta.pageWidth ?? meta.slideWidth ?? meta.pageSize?.width ?? meta.size?.width
  )
  const pageHeight = toFiniteNumber(
    meta.pageHeight ?? meta.slideHeight ?? meta.pageSize?.height ?? meta.size?.height
  )
  if (!pageWidth || !pageHeight) return configData

  const pagination = {
    ...(configData?.pagination || {})
  }
  pagination.pageWidth = pageWidth
  pagination.pageHeight = pageHeight

  const marginTop = toFiniteNumber(meta.marginTop ?? meta.pageMarginTop ?? meta.margins?.top)
  const marginBottom = toFiniteNumber(
    meta.marginBottom ?? meta.pageMarginBottom ?? meta.margins?.bottom
  )
  const marginLeft = toFiniteNumber(meta.marginLeft ?? meta.pageMarginLeft ?? meta.margins?.left)
  const marginRight = toFiniteNumber(
    meta.marginRight ?? meta.pageMarginRight ?? meta.margins?.right
  )
  if (marginTop != null) pagination.marginTop = marginTop
  if (marginBottom != null) pagination.marginBottom = marginBottom
  if (marginLeft != null) pagination.marginLeft = marginLeft
  if (marginRight != null) pagination.marginRight = marginRight

  if (meta.pageKind === 'slide' || meta.sourceType === Utils.OFFICE_EXTENSIONS_FORMAT.powerpoint) {
    pagination.pageGap = 0
    pagination.marginTop = 0
    pagination.marginBottom = 0
    pagination.marginLeft = 0
    pagination.marginRight = 0
    pagination.contentMarginTop = 0
    pagination.contentMarginBottom = 0
  }

  return {
    ...configData,
    pagination
  }
}

function isRenewRequiredError(err: any): boolean {
  if (!err) return false
  if (err?.code === 'PAYMENT_REQUIRED') return true
  if (err?.status === 402) return true
  if (typeof err?.message === 'string' && err.message.includes('402')) return true
  if (typeof err?.message === 'string' && err.message.toLowerCase().includes('lease')) return true
  return false
}

function notifyRenewRequired(): void {
  const title = 'Connect to Internet to Renew'
  const message =
    'Your secure writing lease has expired or is unavailable. Please connect to the internet and sign in to renew.'
  try {
    markSecureLeaseUnavailable(message)
    notifySecureLeaseRequired(message)
    if (typeof window !== 'undefined') {
      window.api?.showNotification?.(title, message)
    }
  } catch {
    // ignore
  }
}

async function ensureDocumentMarkerInCache(cachePath: string, uuid?: string): Promise<void> {
  if (!cachePath) return
  let markerId = uuid

  if (!markerId) {
    try {
      // Reads an existing document to recover its uuid, so it must not be
      // allowed to create or replace that document's info file on the way.
      const infoRaw = await DocumentModel._getInfoFileContentAsync(
        cachePath,
        false,
        Utils.MAIN_DOCUMENT_FILE_NAME
      )
      const info = JSON.parse(infoRaw || '{}')
      if (info?.uuid) markerId = String(info.uuid)
    } catch (error) {
      console.warn('Failed to load document info for marker file:', error)
    }
  }

  if (!markerId) return

  try {
    const markerPath = nodeApi.path.join(cachePath, `.${markerId}`)
    if (!(await nodeApi.fsPromises.exists(markerPath))) {
      await writeFileEnsuringDirAsync(markerPath, markerId, 'utf-8')
    }
  } catch (error) {
    console.warn('Failed to create marker file:', error)
  }
}

async function safeRemovePath(targetPath: string): Promise<void> {
  if (!targetPath) return
  try {
    if (!(await nodeApi.fsPromises.exists(targetPath))) return
    const stat = await nodeApi.fsPromises.lstat(targetPath)
    if (stat.isDirectory()) {
      await nodeApi.fsPromises.rm(targetPath, { recursive: true, force: true })
      return
    }
    await nodeApi.fsPromises.unlink(targetPath)
  } catch (error) {
    console.warn('Failed to remove temp path:', targetPath, error)
  }
}

async function cleanupConversionArtifacts(
  cacheDir: string,
  tempFilePath: string,
  keepPaths: string[] = []
): Promise<void> {
  if (!cacheDir || !tempFilePath) return
  if (!nodeApi.path?.dirname) return
  const normalizedCache = cacheDir
  if (!tempFilePath.startsWith(normalizedCache)) return

  const keepSet = new Set(keepPaths.map((p) => p && nodeApi.path.resolve(p)).filter(Boolean))
  const resolvedTemp = nodeApi.path.resolve(tempFilePath)

  if (keepSet.has(resolvedTemp)) return

  try {
    if (await nodeApi.fsPromises.exists(resolvedTemp)) {
      await safeRemovePath(resolvedTemp)
    }

    const base = resolvedTemp.replace(nodeApi.path.extname(resolvedTemp), '')
    const siblingCandidates = [
      `${base}_files`,
      `${base}-files`,
      `${base}.files`,
      `${base}_assets`,
      `${base}-assets`,
      `${base}.assets`,
      `${base}_media`,
      `${base}-media`,
      `${base}.media`
    ]
    await Promise.all(
      siblingCandidates.map(async (candidate) => {
        if (keepSet.has(nodeApi.path.resolve(candidate))) return
        await safeRemovePath(candidate)
      })
    )

    const entries = await nodeApi.fsPromises.readdir(normalizedCache)
    await Promise.all(
      entries.map(async (entry) => {
        const entryPath = nodeApi.path.join(normalizedCache, entry)
        if (keepSet.has(nodeApi.path.resolve(entryPath))) return
        if (entryPath === resolvedTemp) return
        if (entry.toLowerCase().endsWith('.html') && entryPath.startsWith(normalizedCache)) {
          await safeRemovePath(entryPath)
        }
        if (entry.toLowerCase().endsWith('.docbuilder')) {
          await safeRemovePath(entryPath)
        }
      })
    )
  } catch (error) {
    console.warn('Failed to cleanup conversion artifacts:', error)
  }
}

/*
Document structure OLD. TO DELETE
.xddoc
.sddoc

test.xddoc
  - assets/
    - img/
    - videos/
    - docs/
    - audios/
    - others/
  - custom-user-folder/
    - custom-user-child-folder/
      - user-child-test.html
      - user-child-test.fr.json // For translation
      - another-child-user-test.html
    - user-test.html
    - user-test.fr.json // For translation
    - another-user-test.html
  - custom-user-folder-2/
    - user-test-2.html
    - user-test-2.fr.json // For translation
    - another-user-test-2.html
  - index.html  <------ Main entry file (name cannot bbe changed)
  - test.html
  - test.fr.json // For translation
  - test.en-US.json // For translation
  - another-test.html
  - meta.json
*/

/* 
Document structure
.xddoc
.sddoc

test.xddoc
  - assets/
    - img/
    - videos/
    - docs/
    - audios/
    - others/
    - code/
      - js/
      - html/
      - ...
  - projects  <-- For all user custom document folders
    - custom-user-folder/
    - custom-user-child-folder/
      - user-child-test.html
      - user-child-test.fr.json <-- For translation
      - another-child-user-test.html
    - user-test.html
    - user-test.fr.json <-- For translation
    - another-user-test.html
    - custom-user-folder-2/
      - user-test-2.html
      - user-test-2.fr.json <-- For translation
      - another-user-test-2.html
  - index.html  <------ Main entry file (name cannot bbe changed)
  - test.html
  - test.bg.base.cbor  <-- For base background image editor data (all pages share this by default)
  - test.bg.1.cbor  <-- For custom page 1 background for image editor data (page specific data)
  - test.en.json  <-- For translation
  - test.fr.json  <-- For translation
  - another-test.html
  - another-test.en.json  <-- For translation
  - ...
  - vars.json <-- For variables
  - info.json
*/

/*

{
  "path": "/path/to/dynadoc/test/test.xddoc",
  "dirPath": "/path/to/dynadoc/test",
  "cachePath": "~/.config/ddoc-office/ddoc-office/test",
  "cacheDirPath": "~/.config/ddoc-office/ddoc-office",
  "name": "test.xddoc",
  "extension": Utils.DYNADOC_EXTENSIONS.default,
  "isSecured": false,
  "openMode": "write",
  "info": {
    "createdAt": "Invalid Date",
    "modifiedAt": "Invalid Date",
    "encoding": null,
    "hash": null,
    "mimeType": null
  },
  "documentMainFileTranslations": [
    {
      "path": "~/.config/ddoc-office/ddoc-office/test/test.fr.json",
      "dirPath": "~/.config/ddoc-office/ddoc-office/test",
      "name": "test.fr.json",
      "language": "fr",
      "region": ""
    }
  ]
}

*/

// const  fs = node.fs
// const  path = node.path

// const fs = nodeApi.fs
// const path = nodeApi.path

//  const _Utils.MAIN_DOCUMENT_FILE_NAME = "index"
//  const _Utils.MAIN_DOCUMENT_FILE_EXTENSION = ".html"

export type ExtractMode = 'last' | 'all' | 'full'
export type { DocumentContentType, DocumentContentKindType } from './document.types'

export type DocumentUIState = {
  scrollTop?: number
  selection?: { from: number; to: number } | Record<string, unknown> | null
  activeTab?: string
  updatedAt?: number
}

export class DocumentModel {
  // static nodeApi = (window as any)?.api?.node

  // const nodeApi =
  //   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null

  // static fs = DocumentModel.nodeApi?.fs
  // static pathN =  DocumentModel.nodeApi?.path
  // static fsPromises =  DocumentModel.nodeApi?.fsPromises

  // staticmainFileName = "index"
  // static Utils.MAIN_DOCUMENT_FILE_EXTENSION = ".html"
  static OpenMode = {
    READ: 'read',
    WRITE: 'write'
  } as const

  static AssetType = {
    IMG: 'img',
    VIDEO: 'video',
    DOC: 'doc',
    AUDIO: 'audio',
    CODE: 'code',
    SLIDE: 'slide',
    SHEET: 'sheet',
    CHART: 'chart',
    DESIGN: 'design',
    LATEX: 'latex',
    SURVEY: 'survey',
    OTHER: 'other'
  } as const

  uuid: string // unique id that will be used to identify the document. It is universally unique

  parentPath: string // Full file path of the parent if is part of a parent document
  path: string // Full file path
  dirPath: string // Parent directory path
  cachePath: string // Path to cached version (e.g., optimized or encrypted)
  cacheDirPath: string // Directory containing the cache
  info: DocumentInfo // Metadata info
  config: DocumentConfiguration // Configuration info
  vars?: string // Variables file path
  backgroundDesignFilePath?: string // JSON/CBOR background design file path
  remotePath?: string // Full remote path in user drive (e.g., users/<id>/...)
  remoteRef?: string // Remote ref (e.g., remoteName:users/<id>/...)
  // vars: object = {} // Metadata info

  name: string // Just the filename
  extension: string // e.g., Utils.PDF_EXTENSION
  isSecured: boolean = false // Optional: flag if encrypted or protected
  openMode: (typeof DocumentModel.OpenMode)[keyof typeof DocumentModel.OpenMode]

  // documentFilesInfoList: DocumentTranslation[] // Translations
  documentMainFileTranslations: DocumentTranslation[] // Translations

  associatedMeetingLinks: string[] // one documentt can be the note of many meeting. to improve organization
  private static _uiStateStore = new Map<string, DocumentUIState>()
  private static _hydrateUiState(documentId: string, state: DocumentUIState): void {
    if (!documentId || !state) return
    DocumentModel._uiStateStore.set(documentId, state)
  }
  private static _activeDocumentResolver: (() => DocumentModel | null) | null = null

  constructor(params: {
    uuid?: string
    path: string
    parentPath: string
    dirPath: string
    cachePath: string
    cacheDirPath: string
    info: DocumentInfo
    config: DocumentConfiguration
    vars?: string
    associatedMeetingLinks: string[]
    backgroundDesignFilePath?: string
    remotePath?: string
    remoteRef?: string
    // vars?: object
    isSecured?: boolean
    openMode: (typeof DocumentModel.OpenMode)[keyof typeof DocumentModel.OpenMode]
  }) {
    console.log('Document loadfrom createNewDocument init construct', { params })

    const requestedPath = params.path
    this.parentPath = params.parentPath
    this.path = params.path
    this.dirPath = params.dirPath
    this.cachePath = params.cachePath
    this.cacheDirPath = params.cacheDirPath
    this.info = params.info
    this.remotePath = params.remotePath
    this.remoteRef = params.remoteRef
    this.uuid = params.uuid ?? this.info?.uuid ?? uuidv4()
    console.log('Document loadfrom createNewDocument construct 1', { params, this: this })

    if (this.cachePath) {
      void ensureDocumentMarkerInCache(this.cachePath, this.uuid)
    }
    console.log('Document loadfrom createNewDocument construct 2', { params, this: this })

    try {
      if (this.cachePath) {
        void (window as any)?.server?.sync?.start?.({ cachePath: this.cachePath })
      }
    } catch (error) {
      console.warn('Failed to start sync watcher', error)
    }
    console.log('Document loadfrom createNewDocument construct 3', { params, this: this })

    if (this.info) {
      const hadUuid = !!this.info.uuid
      this.info.uuid = this.uuid
      if (!hadUuid && this.cachePath) {
        try {
          this.writeInfoFileContent()
        } catch (err) {
          console.warn('Failed to persist document uuid to info file:', err)
        }
      }
    }
    console.log('Document loadfrom createNewDocument construct 4', { params, this: this })

    this.config = params.config || defaultDocumentConfiguration
    this.associatedMeetingLinks = params.associatedMeetingLinks || []
    // Normalize cache root to support uuid-based document folders
    this.cachePath = Utils.resolveDocumentRoot(this.cachePath, this.path)
    if (this.cachePath && this.path && this.path.startsWith(this.cachePath)) {
      this.dirPath = this.cachePath
    }
    console.log('Document loadfrom createNewDocument construct 5', { params, this: this })

    this.vars = this.getVarsFilePath()
    this.backgroundDesignFilePath = this.getBgDesignFilePath()
    // this.vars = this.getVars()
    // this.isSecured = params.isSecured?? this.isSecuredFile() ?? false
    this.openMode = params.openMode
    this.name = this.extractName(this.cachePath || params.path)
    // this.name = this.extractName(params.path)
    this.extension = `.${this.extractExtension(params.path) as string}`
    this.isSecured = params.isSecured || this.isSecuredFile()
    this.documentMainFileTranslations = this.getDocumentTranslations(
      this.getMainFilePath() || this.cachePath
    )
    // this.documentMainFileTranslations = this.getDocumentTranslations(this.cachePath)

    if (requestedPath && this.path !== requestedPath) {
      const requestedExt = nodeApi.path.extname(requestedPath)
      if (requestedExt) {
        this.path = requestedPath
        if (!this.dirPath || this.dirPath === this.cacheDirPath) {
          this.dirPath = nodeApi.path.dirname(requestedPath)
        }
      }
    }
    console.log('Document loadfrom createNewDocument end construct', { params, this: this })
  }

  getUIState(): DocumentUIState | null {
    return DocumentModel._uiStateStore.get(this.uuid) ?? null
  }

  setUIState(update: Partial<DocumentUIState>): DocumentUIState {
    const current = DocumentModel._uiStateStore.get(this.uuid) ?? {}
    const next = {
      ...current,
      ...update,
      updatedAt: Date.now()
    }
    DocumentModel._uiStateStore.set(this.uuid, next)
    return next
  }

  private extractNameFromFileName(fullPath: string): string {
    return fullPath.split('/').pop() || ''
  }

  /* private extractName(fullPath: string): string {
    return fullPath.split('/').pop() || ''
  } */

  /* 
  extractName("/Users/user/.../New Document 10")  
// → "New Document 10"
extractName("/Users/user/.../New Document 10/")  
// → "New Document 10"

extractName("C:\\Users\\me\\Documents\\Project A")  
// → "Project A"

extractName("C:\\Users\\me\\Documents\\Project A\\")  
// → "Project A"
  */

  static setActiveDocumentResolver(resolver: (() => DocumentModel | null) | null): void {
    this._activeDocumentResolver = resolver
  }

  static getActiveDocument(): DocumentModel | null {
    return this._activeDocumentResolver?.() ?? null
  }

  private extractName2(fullPath: string): string {
    if (!fullPath) return ''
    // const isFile = EditorHelpers.getFileRootFromBaseDir(this.cacheDir, fullPath)

    if (
      fullPath.startsWith(this.cachePath) &&
      fullPath == nodeApi.path.join(this.cachePath, Utils.MAIN_DOCUMENT_FILE)
    ) {
      return this.extractNameFromFileName(fullPath)
    }

    // Remove any trailing slash ("/" or "\" for Windows)
    const normalized = fullPath.replace(/[\/\\]+$/, '')

    return nodeApi.path.basename(normalized)
  }

  private extractName(fullPath: string): string {
    if (!fullPath) return ''

    // 1. Remove trailing slashes
    const normalized = fullPath.replace(/[\/\\]+$/, '')
    const mainFileName = Utils.MAIN_DOCUMENT_FILE
    const baseName = nodeApi.path.basename(normalized)
    if (baseName === mainFileName || baseName === Utils.MAIN_DOCUMENT_FILE_NAME) {
      const parentName = nodeApi.path.basename(nodeApi.path.dirname(normalized))
      const parentExt = nodeApi.path.extname(parentName)
      return parentExt ? parentName.slice(0, -parentExt.length) : parentName
    }
    console.log(
      'extractNameextractName ',
      this.path,
      nodeApi.path.join(this.cachePath, Utils.MAIN_DOCUMENT_FILE),
      this.path.startsWith(this.cachePath),
      this.path != nodeApi.path.join(this.cachePath, Utils.MAIN_DOCUMENT_FILE),
      this
    )

    if (
      fullPath.startsWith(this.cachePath) &&
      this.path != nodeApi.path.join(this.cachePath, Utils.MAIN_DOCUMENT_FILE)
    ) {
      console.log('extractNameextractName in ', this.path, this)
      // return this.extractName(this.path)
      const normalized = this.path.replace(/[\/\\]+$/, '')
      const base = nodeApi.path.basename(normalized)

      // 3. If it has an extension → return name without extension
      const ext = nodeApi.path.extname(base)

      if (ext) {
        return base.slice(0, -ext.length) // remove extension
      }
    }
    // 2. Extract final segment (file or folder)
    const base = nodeApi.path.basename(normalized)

    // 3. If it has an extension → return name without extension
    const ext = nodeApi.path.extname(base)

    if (ext) {
      return base.slice(0, -ext.length) // remove extension
    }

    // 4. If it's a directory name → return it directly
    return base
  }

  private getFileBaseNameFromPath(filePath: string): string {
    if (!filePath) return ''
    return nodeApi.path.basename(filePath, nodeApi.path.extname(filePath))
  }

  public getConfigFileBaseName(filePath?: string): string {
    const resolvedPath = filePath || this.path
    if (Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST.includes(this.extension)) {
      return this.getFileBaseNameFromPath(resolvedPath)
    }
    // return this.getFileBaseNameFromPath(resolvedPath)

    if (this.isFileTheMainDocumentFile()) return Utils.MAIN_DOCUMENT_FILE_NAME

    if (this.isFilePartOfAParentDocument()) {
      return this.getFileBaseNameFromPath(resolvedPath)
    }

    return Utils.MAIN_DOCUMENT_FILE_NAME
  }

  private extractExtension(filePath: string, mode: ExtractMode = 'last'): string | string[] | null {
    if (!filePath) return null

    // Uses Node path correctly
    const base = nodeApi.path.basename(filePath) // removes directories safely

    // If file starts with "." and has no more dots → hidden file, no extension
    if (base.startsWith('.') && base.indexOf('.', 1) === -1) {
      return null
    }

    // Remove leading dot to avoid issues with hidden files
    const trimmed = base.startsWith('.') ? base.slice(1) : base

    const parts = trimmed.split('.')

    if (parts.length < 2) return null // no extension

    const exts = parts.slice(1) // everything after first segment

    switch (mode) {
      case 'last':
        return exts[exts.length - 1]
      case 'all':
        return exts
      case 'full':
        return exts.join('.')
      default:
        return exts[exts.length - 1]
    }
  }

  private extractExtension22(fullPath: string): string {
    return '.' + (this.name.split('.').pop() || '')
  }
  // private getDocumentTranslations(): DocumentTranslation[] {
  //   // this.dirPath
  //   // for each translation files in this.dirPath (*.fr.json, *.es.json, *.fr-FR.json, etc), create DocumentTranslation instances and add to this.documentTranslations
  // }

  private extractLocale1(fileName: string): string {
    // Eg:
    // test.fr.json    => "fr"
    // test.fr-FR.json => "fr-FR"
    const baseName = nodeApi.path.basename(fileName, nodeApi.path.extname(fileName)) // "test.fr" or "test.fr-FR"
    const parts = baseName.split('.')
    return parts.length > 1 ? parts[parts.length - 1] : ''
  }

  private extractLocale(fileName: string): string {
    // Use nodeApi.path.parse to get the name without the final .json extension
    // index.en-US.json -> index.en-US
    const nameWithoutExt = nodeApi.path.parse(fileName).name

    const parts = nameWithoutExt.split('.')
    // If we have index.en-US, the parts are ["index", "en-US"]
    // The last part is the locale.
    return parts.length > 1 ? parts[parts.length - 1] : ''
  }

  public static getAutoTranslationTabMatch1(allTabs: string[], mainFile: string): string {
    // 1. Get User Locale (e.g., 'fr-FR' or 'en-GB')
    const userLocale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase()
    const primaryLang = userLocale.split('-')[0] // 'fr'

    // 2. Score potential matches
    // We look for .fr-fr.json first, then .fr.json
    const scores = allTabs.map((path) => {
      if (path === mainFile) return -1
      const lowerPath = path.toLowerCase()
      if (lowerPath.includes(`.${userLocale}.json`)) return 100 // Perfect match
      if (lowerPath.includes(`.${primaryLang}.json`)) return 50 // Language match
      return 0
    })

    const topScore = Math.max(...scores)
    // if (topScore > 0) {
    //   return allTabs[scores.indexOf(topScore)];
    // }

    if (topScore > 0) {
      const index = scores.indexOf(topScore)
      return allTabs[index]
    }

    return mainFile // Fallback to source
  }

  public static getAutoTranslationTabMatch(allTabs: string[], mainFile: string): string {
    const userLocale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase() // e.g. "en-us"
    const primaryLang = userLocale.split('-')[0] // e.g. "en"

    const scores = allTabs.map((path) => {
      if (path === mainFile) return -1

      // Extract the ACTUAL locale from this specific tab path
      // index.en-US.json -> "en-us"
      const nameWithoutExt = nodeApi.path.parse(path).name
      const pathParts = nameWithoutExt.split('.')
      const tabLocale = (pathParts.length > 1 ? pathParts[pathParts.length - 1] : '').toLowerCase()

      if (tabLocale === userLocale) return 100 // EXACT: "en-us" === "en-us"
      if (tabLocale === primaryLang) return 50 // PRIMARY: "en" === "en"

      return 0
    })

    const topScore = Math.max(...scores)
    if (topScore > 0) {
      const index = scores.indexOf(topScore)
      return allTabs[index]
    }

    return mainFile
  }

  /**
   * Whether the document's own path is there.
   *
   * `'unknown'` is a third answer, and it is the point of this method. A probe
   * that could not be put to the filesystem was reported as `false`, and
   * `false` is rendered as "We couldn't find this document" — over a document
   * that is exactly where it has always been, with "Locate File" and "Search
   * Drive" sending the reader to look for it somewhere else. "I could not ask"
   * and "it is not there" are different statements and must not share a value.
   *
   * An answer that is neither `true` nor `false` is unknown too. A call that
   * came back without a verdict has not given one, and guessing which way it
   * leant is the same mistake one layer down.
   */
  public async locationExistAsync(): Promise<boolean | 'unknown'> {
    const normalized = normalizeRemotePath(this.path || '')
    try {
      const answer = await nodeApi.fsPromises.exists(normalized)
      if (answer === true || answer === false) return answer
      console.warn('locationExistAsync: probe gave no verdict', normalized, answer)
      return 'unknown'
    } catch (err) {
      console.warn('locationExistAsync: probe failed', normalized, err)
      return 'unknown'
    }
  }

  public async createTranslationFile1(
    filePath: string,
    languageCode: string,
    content: string
  ): Promise<string | null> {
    if (!filePath || !languageCode) {
      console.warn('createTranslationFile: filePath does not exist', filePath, languageCode)
      return null
    }

    const isDir = (await nodeApi.fsPromises.lstat(filePath)).isDirectory()
    const fileDir = isDir ? filePath : nodeApi.path.dirname(filePath)
    const baseName = isDir
      ? 'document'
      : nodeApi.path.basename(filePath, nodeApi.path.extname(filePath))

    // Target: e.g. "myDoc.fr.json"
    const newFileName = `${baseName}.${languageCode}.json`
    const newFilePath = nodeApi.path.join(fileDir, newFileName)

    // ✅ If already exists, just return path
    if (await nodeApi.fsPromises.exists(newFilePath)) {
      console.log('Translation file already exists:', newFilePath)
      return newFilePath
    }

    try {
      // ✅ Create empty file (or minimal default)
      await writeFileEnsuringDirAsync(newFilePath, content, 'utf-8')
      console.log('Created new empty translation file:', newFilePath)
      return newFilePath
    } catch (err) {
      console.error('createTranslationFile: failed to create', err)
      return null
    }
  }

  public async createTranslationFile(
    filePath: string,
    languageCode: string,
    content: string
  ): Promise<string | null> {
    if (!filePath || !languageCode) {
      console.warn('createTranslationFile: Invalid params', filePath, languageCode)
      return null
    }

    const isDir = (await nodeApi.fsPromises.lstat(filePath)).isDirectory()
    const fileDir = isDir ? filePath : nodeApi.path.dirname(filePath)
    const baseName = isDir
      ? 'document'
      : nodeApi.path.basename(filePath, nodeApi.path.extname(filePath))

    const newFileName = `${baseName}.${languageCode}.json`
    const newFilePath = nodeApi.path.join(fileDir, newFileName)

    if (await nodeApi.fsPromises.exists(newFilePath)) {
      return newFilePath
    }

    try {
      await writeFileEnsuringDirAsync(newFilePath, content, 'utf-8')

      // Immediately update the local instance list
      // This allows getDocumentTranslations to pick it up or we manually push it
      const newTranslation = new DocumentTranslation({
        path: newFilePath,
        dirPath: fileDir,
        openMode: this.openMode
      })

      this.documentMainFileTranslations = [...this.documentMainFileTranslations, newTranslation]

      return newFilePath
    } catch (err) {
      console.error('createTranslationFile: failed to create', err)
      return null
    }
  }

  public async deleteTranslationFile(filePath: string): Promise<boolean> {
    if (!filePath) {
      console.warn('deleteTranslationFile: No file path provided')
      return false
    }

    try {
      // 1. Check if the file exists before attempting deletion
      if (await nodeApi.fsPromises.exists(filePath)) {
        await nodeApi.fsPromises.unlink(filePath)
      } else {
        console.warn('deleteTranslationFile: File does not exist', filePath)
        // We continue to update state just in case of a mismatch
      }

      // 2. Immediately update the local instance list (Reactivity)
      // Filter out the deleted file from the internal array
      this.documentMainFileTranslations = this.documentMainFileTranslations.filter(
        (t) => t.path !== filePath
      )

      console.log('deleteTranslationFile: successfully removed', filePath)
      return true
    } catch (err) {
      console.error('deleteTranslationFile: failed to delete', err)
      return false
    }
  }

  getDocumentTranslationsFilePaths(): string[] | null {
    // No var file needed
    if (!this.documentMainFileTranslations) {
      return null
    }

    const translationFilePaths = []
    for (let index = 0; index < this.documentMainFileTranslations.length; index++) {
      const translationFilePath = this.documentMainFileTranslations[index].path
      translationFilePaths.push(translationFilePath)
    }

    return translationFilePaths
  }

  public getDocumentTranslations(filePath: string): DocumentTranslation[] {
    console.log('getDocumentTranslations filePath', filePath)
    const nodeFs = nodeApi.fs
    const nodePath = nodeApi.path
    if (!nodeFs?.existsSync || !nodeFs?.lstatSync || !nodePath) {
      return []
    }
    // if filePath does not exist, return empty array
    if (!filePath || !nodeFs.existsSync(filePath)) {
      return []
    }
    const translations: DocumentTranslation[] = []
    let stat: any = null
    try {
      stat = nodeFs.lstatSync(filePath)
    } catch {
      return []
    }
    const isDir =
      typeof stat?.isDirectory === 'function'
        ? stat.isDirectory()
        : Boolean(stat?.isDirectory || stat?.isDir)
    // if filePath is a directory set it to fileDir
    const fileDir = isDir ? filePath : nodePath.dirname(filePath)

    const baseName = isDir
      ? Utils.MAIN_DOCUMENT_FILE_NAME
      : nodePath.basename(filePath, nodePath.extname(filePath))
    const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const translationRegex = new RegExp(
      `^${escapedBase}\\.([a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})?)\\.json$`
    )

    const files = nodeFs.readdirSync(fileDir)
    console.log('getDocumentTranslations fileDir', fileDir, files)
    if (!Array.isArray(files)) {
      return []
    }

    for (const entry of files) {
      const fileName =
        typeof entry === 'string' ? entry : typeof entry?.name === 'string' ? entry.name : null
      if (!fileName) continue
      const match = fileName.match(translationRegex)
      if (!match) continue

      const fullPath = nodeApi.path.join(fileDir, fileName)
      const locale = match[1]
      console.log('getDocumentTranslations baseName', baseName, fullPath, locale)

      if (!locale) continue

      const translation = new DocumentTranslation({
        path: fullPath,
        dirPath: fileDir,
        openMode: this.openMode,
        language: locale
      })
      translations.push(translation)
    }

    // this.documentTranslations = translations
    return translations
  }

  // public async createNewDocument(isSecured?:boolean = false){
  public async createNewDocument22() {
    // in
    let cacheDir = await window.api.getCacheDir() // Exposed via preload script
    const tempDir = cacheDir
    let cachePath = ''
    if (!isDesktopPlatform && !isShareCachePath) {
      cachePath = cacheDir
    }

    //use the translated file name t('New Document')
    // Create temp dir in cacheDir
    // If dir already exists add "1" to the name like ->New Document 1'), if exist add "2" ... keep thee root namee translatablee
    // In the temp dir Create files: index.html,info.json
  }

  public static async getDefaultDocumentContent(
    mainFilePath: string,
    defaultContentType: DocumentContentType,
    defaultContentKind?: DocumentContentKindType,
    defaultContent: string = ''
  ) {
    // let defaultContent = ''
    switch (defaultContentType) {
      case 'text':
        if (defaultContentKind == 'generative') {
          defaultContent = `<${CustomAIExtensionProps.tagName} 
          ${GenericCustomExtensionProps.tagAttributeId}="${uuidv4()}"  
          ${CustomAIExtensionProps.tagAttributePrompt}="${defaultContent}"  
          ${CustomAIExtensionProps.tagAttributeDone}="false"></${CustomAIExtensionProps.tagName}>`
        }
        break
      case 'slide':
        if (defaultContentKind == 'generative') {
        } else {
          const slidePath = await DocumentModel.getAssetFilePathFromDocument(
            DocumentModel.AssetType.SLIDE,
            mainFilePath
          )
          const src = slidePath?.filePath

          defaultContent = `<${CustomSlideExtensionProps.tagName}
          ${GenericCustomExtensionProps.tagAttributeId}="${uuidv4()}"  
          ${CustomSlideExtensionProps.parentFilePath}="${mainFilePath}"  
          ${CustomSlideExtensionProps.tagAttributeSrc}="${src}">
          </${CustomSlideExtensionProps.tagName}>`
          // defaultContent = "<slide></slide>"
        }
        break
      case 'sheet':
        if (defaultContentKind == 'generative') {
        } else {
          const path = await DocumentModel.getAssetFilePathFromDocument(
            DocumentModel.AssetType.SHEET,
            mainFilePath
          )
          const src = path?.filePath
          defaultContent = `<${CustomSpreadsheetExtensionProps.tagName}
          ${CustomSpreadsheetExtensionProps.tagAttributeSrc}="${src}"  
          ${GenericCustomExtensionProps.tagAttributeId}="${uuidv4()}"></${CustomSpreadsheetExtensionProps.tagName}>`
        }
        break
      case 'design':
        if (defaultContentKind == 'generative') {
        } else {
          const path = await DocumentModel.getAssetFilePathFromDocument(
            DocumentModel.AssetType.DESIGN,
            mainFilePath
          )
          const src = path?.filePath
          defaultContent = `<${CustomDesignExtensionProps.tagName}
          ${CustomDesignExtensionProps.tagAttributeSrc}="${src}"  
          ${GenericCustomExtensionProps.tagAttributeId}="${uuidv4()}">
          </${CustomDesignExtensionProps.tagName}>`
        }
        break

      case 'form':
        if (defaultContentKind == 'generative') {
        } else {
          const path = await DocumentModel.getAssetFilePathFromDocument(
            DocumentModel.AssetType.SURVEY,
            mainFilePath
          )
          const src = path?.filePath
          defaultContent = `<${CustomSurveyExtensionProps.tagName}
          ${CustomSurveyExtensionProps.tagAttributeSrc}="${src}"  
          ${GenericCustomExtensionProps.tagAttributeId}="${uuidv4()}">
          </${CustomSurveyExtensionProps.tagName}>`
        }
        break

      default:
        break
        defaultContent = ''
    }
    return defaultContent
  }

  // public static async createNewDocument(defaultContent: string = '') {
  public static async createNewDocument(
    defaultContentType: DocumentContentType,
    defaultContentKind?: DocumentContentKindType,
    defaultContent: string = '',
    associatedMeetingLinks: string[] = []
  ) {
    const platform = Platform.getPlatform()
    const isDesktopPlatform = platform === Platform.SUPPORTED_PLATFORMS.desktop
    console.log('createNewDocument platform', { platform, 'win api': window.api, win: window })
    const baseDir = isDesktopPlatform
      ? // ? await nodeApi.getCacheDir()
        await window.api.getCacheDir()
      : await window.api.getStorageDir()
    const ddocCacheDir = normalizeRemotePath(baseDir || '')
    if (!ddocCacheDir && isDesktopPlatform) throw new Error('Storage directory not available')

    const docUuid = uuidv4()

    // Base translatable name
    const baseName = t('New Document')

    // Find unique directory name
    // const fsApi = window.api.node?.fs
    // const nodeApi = (window as any)?.api?.node
    // const fs = fs
    // const path = path
    // const fsW = nodeApiWeb.fs
    // const pathW = path
    //     console.log("writeFileSyncwriteFileSync path join before", { 'ok':fs,nodeApi, ddocCacheDir, baseDir })

    const uuidDir = nodeApi.path.join(ddocCacheDir || '', docUuid)
    const parentDir = isDesktopPlatform
      ? nodeApi.path.join(uuidDir)
      : nodeApi.path.join(ddocCacheDir || '')
    const folderName = await generateUniqueNameAsync({ baseName, parentDir })
    // Final temp directory
    const tempDir = nodeApi.path.join(uuidDir, folderName)

    // Create directory
    // const fsApi = window.api.node?.fs
    if (!nodeApi.fsPromises?.mkdir) {
      throw new Error('Filesystem API not available for document creation.')
    }
    await nodeApi.fsPromises.mkdir(tempDir, { recursive: true })
    console.log('writeFileSyncwriteFileSync createdoc', {
      uuidDir,
      ddocCacheDir,
      baseDir,
      parentDir,
      folderName,
      tempDir
    })

    // ----------------------
    // Create index.html
    // ----------------------
    let mainFilePath = nodeApi.path.join(tempDir, Utils.MAIN_DOCUMENT_FILE)
    // const htmlPath = nodeApi.path.join(tempDir, "index.html");
    /* const defaultHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${folderName}</title>
</head>
<body>
  <p></p>
</body>
</html>
`.trim(); */

    defaultContent = await DocumentModel.getDefaultDocumentContent(
      mainFilePath,
      defaultContentType,
      defaultContentKind,
      defaultContent
    )
    // defaultContent = defaultContent || DocumentModel.getDefaultDocumentContent(mainFilePath, defaultContentType, defaultContentKind, defaultContent)
    const defaultHtml = defaultContent

    // if (isDesktopPlatform) {
    await writeFileEnsuringDirAsync(mainFilePath, defaultHtml, 'utf8')
    // }

    // ----------------------
    // Create info.json
    // ----------------------
    // const infoFilePath = nodeApi.path.join(tempDir, Utils.DOCUMENT_INFO_FILE);
    // const infoPath = nodeApi.path.join(tempDir, "info.json");

    const seededInfo = createDefaultDocumentInfo()
    seededInfo.uuid = docUuid
    seededInfo.contentType = defaultContentType
    try {
      const identity = await getCurrentUserIdentity()
      seededInfo.createdBy = identity.userId || undefined
      seededInfo.createdByTemp = identity.deviceId || undefined
    } catch {
      // ignore identity failures during creation
    }
    let infoFileData: any
    // if (isDesktopPlatform) {
    const infoFileRaw = await this._getInfoFileContentAsync(
      tempDir,
      true,
      Utils.MAIN_DOCUMENT_FILE_NAME,
      JSON.stringify(seededInfo.toJSON())
    )
    infoFileData = DocumentModel._safeJsonParse(infoFileRaw, createDefaultDocumentInfo().toJSON())
    // } else {
    //   infoFileData = seededInfo.toJSON()
    // }
    // ----------------------
    // Create config.json
    // ----------------------
    let configFileData: any
    // if (isDesktopPlatform) {
    const configFileRaw = await this._getConfigurationFileContentAsync(
      tempDir,
      true,
      Utils.MAIN_DOCUMENT_FILE_NAME,
      JSON.stringify(defaultDocumentConfigurationByType[defaultContentType]?.toJSON())
    )
    configFileData = DocumentModel._safeJsonParse(
      configFileRaw,
      defaultDocumentConfigurationByType[defaultContentType]?.toJSON() ||
        defaultDocumentConfiguration.toJSON()
    )
    // } else {
    //   configFileData =
    //     defaultDocumentConfigurationByType[defaultContentType]?.toJSON() ||
    //     defaultDocumentConfiguration.toJSON()
    // }
    // const configFilePath = nodeApi.path.join(tempDir, Utils.DOCUMENT_CONFIG_FILE);
    // const infoPath = nodeApi.path.join(tempDir, "info.json");
    /* const configFileData: DocumentConfiguration = new DocumentConfiguration({
      restrictionRules: defaultDocumentRestrictionRules,
      pagination: EditorExtensionHelpers.defaultPaginationOptions,
    }); */

    console.log('createNewDocument infoFileData ', { infoFileData, configFileData })

    // EditorHelpers.writeFileEnsuringDir(configFilePath, JSON.stringify(defaultDocumentConfiguration.toJSON(), null, 2), "utf8");

    /* return {
      dir: tempDir,
      name: folderName,
      indexHtml: htmlPath,
      infoJson: infoPath,
    }; */

    let outputPath = mainFilePath
    let outputParentPath = tempDir
    let outputDir = tempDir
    let remotePath: string | undefined
    let remoteRef: string | undefined

    /*  if (!isDesktopPlatform) {
       try {
         const storageDirRaw = await window.api.getStorageDir().catch(() => 'drive/home')
         const storageDir = normalizeRemotePath(storageDirRaw || '')
         const normalizeDisplayDir = (value: string): string => {
           const cleaned = (value || '').replace(/\\/g, '/')
           if (!cleaned) return ''
           const trimmed = cleaned.replace(/^\/+/, '')
           if (trimmed === 'drive') return 'drive/home'
           if (trimmed.startsWith('drive/')) return trimmed
           if (trimmed === 'home' || trimmed.startsWith('home/')) return `drive/${trimmed}`
           if (trimmed.endsWith('/home') || trimmed.includes('/home/')) return `drive/${trimmed}`
           return trimmed
         }
         const displayDirRaw = storageDirRaw || storageDir || ''
         const displayDir = normalizeDisplayDir(displayDirRaw)
         // On web, the cache dir in drive is the source of truth (unpacked folder).
         outputDir = tempDir || displayDir || ''
         outputParentPath = outputDir
         const normalizedOutputDir = normalizeRemotePath(outputDir || '')
         if (normalizedOutputDir && normalizedOutputDir !== outputDir) {
           outputDir = normalizedOutputDir
           outputParentPath = outputDir
         }
         outputPath = nodeApi.path.join(outputDir, Utils.MAIN_DOCUMENT_FILE)
         outputPath = normalizeRemotePath(outputPath || '')
         mainFilePath = outputPath
         console.log("createNewDocument normalizeDisplayDir ", { displayDirRaw, displayDir, outputPath, outputParentPath, outputDir })
 
       } catch (e) {
         // ignore
         console.error("createNewDocument error in path ", { e })
 
       }
     } */

    if (!isDesktopPlatform) {
      try {
        const resolved = await DriveActions.resolvePath({ path: normalizeRemotePath(outputDir) })
        remotePath = resolved?.path || resolved?.remotePath || outputDir
        remoteRef = resolved?.remote || resolved?.remoteRef
        console.log('createNewDocument normalizeDisplayDir 2 ', {
          resolved,
          remotePath,
          remoteRef,
          outputPath,
          outputParentPath,
          outputDir
        })
      } catch (e) {
        remotePath = outputDir
        console.error('createNewDocument error in path 2 ', { e })
      }
    }
    /*  if (!isDesktopPlatform) {
       outputDir = normalizeRemotePath(outputDir || '')
       outputParentPath = normalizeRemotePath(outputParentPath || outputDir || '')
       outputPath = normalizeRemotePath(outputPath || '')
       mainFilePath = normalizeRemotePath(mainFilePath || outputPath || '')
       console.log('createNewDocument normalized paths', {
         outputDir,
         outputParentPath,
         outputPath,
         mainFilePath
       })
     }
     if (!isDesktopPlatform) {
       try {
         const ensureDir = async (dir: string) => {
           const normalized = normalizeRemotePath(dir || '')
           if (!normalized) return
           await DriveActions.mkdir({ path: normalized })
         }
         const ensureDirTree = async (dir: string) => {
           const normalized = normalizeRemotePath(dir || '')
           if (!normalized) return
           const parts = normalized.split('/').filter(Boolean)
           let current = ''
           for (const part of parts) {
             current = current ? `${current}/${part}` : part
             try {
               await DriveActions.mkdir({ path: current })
             } catch {
               // ignore mkdir failures (likely already exists)
             }
           }
         }
         await ensureDirTree(outputDir || ddocCacheDir || 'home')
 
         let infoPath = this._getInfoFilePath(outputDir, false, Utils.MAIN_DOCUMENT_FILE_NAME)
         const configPath = this._getConfigurationFilePath(
           outputDir,
           false,
           Utils.MAIN_DOCUMENT_FILE_NAME,
           JSON.stringify(defaultDocumentConfigurationByType[defaultContentType]?.toJSON())
         )
 
         infoPath = normalizeRemotePath(infoPath || '')
         const normalizedConfigPath = normalizeRemotePath(configPath || '')
         const normalizedMainPath = normalizeRemotePath(mainFilePath || '')
         if (!nodeApi.fsPromises?.writeFile) {
           console.warn('createNewDocument web write unavailable: nodeApi.fsPromises.writeFile missing')
         }
         console.log('createNewDocument web write paths', {
           outputDir,
           infoPath,
           normalizedConfigPath,
           normalizedMainPath
         })
         if (!infoPath || !normalizedConfigPath || !normalizedMainPath) {
           console.warn('createNewDocument web write skipped: empty path', {
             infoPath,
             normalizedConfigPath,
             normalizedMainPath
           })
         }
 
         try {
           console.log('createNewDocument writing info.json', infoPath)
           // await nodeApi.fsPromises.writeFile(infoPath, JSON.stringify(infoFileData, null, 2), 'utf-8')
           await nodeApi.fsPromises.writeFile(infoPath, JSON.stringify(infoFileData, null, 2), 'utf-8')
 
         } catch (writeErr) {
           console.warn('createNewDocument failed to write info.json', { infoPath, writeErr })
         }
         try {
           console.log('createNewDocument writing config.json', normalizedConfigPath)
           await nodeApi.fsPromises.writeFile(
             // await window.api.fsPromises.writeFile(
             normalizedConfigPath,
             JSON.stringify(configFileData, null, 2),
             'utf-8'
           )
         } catch (writeErr) {
           console.warn('createNewDocument failed to write config.json', { configPath: normalizedConfigPath, writeErr })
         }
         try {
           console.log('createNewDocument writing index.html', normalizedMainPath)
           await nodeApi.fsPromises.writeFile(normalizedMainPath, defaultHtml, 'utf-8')
         } catch (writeErr) {
           console.warn('createNewDocument failed to write index.html', { mainFilePath: normalizedMainPath, writeErr })
         }
 
         } catch (err) {
         console.warn('createNewDocument web write preparation failed', err)
       }
     }
     if (!isDesktopPlatform) {
       try {
         const ensureDir = async (dir: string) => {
           const normalized = normalizeRemotePath(dir || '')
           if (!normalized) return
           await DriveActions.mkdir({ path: normalized })
         }
         await ensureDir(outputDir || ddocCacheDir || 'home')
         await ensureDir(tempDir)
 
         const infoPath = this._getInfoFilePath(tempDir, false, Utils.MAIN_DOCUMENT_FILE_NAME)
         const configPath = this._getConfigurationFilePath(
           tempDir,
           false,
           Utils.MAIN_DOCUMENT_FILE_NAME,
           JSON.stringify(defaultDocumentConfigurationByType[defaultContentType]?.toJSON())
         )
         await nodeApi.fsPromises.writeFile(infoPath, JSON.stringify(infoFileData, null, 2), 'utf-8')
         await nodeApi.fsPromises.writeFile(
           configPath,
           JSON.stringify(configFileData, null, 2),
           'utf-8'
         )
         await nodeApi.fsPromises.writeFile(mainFilePath, defaultHtml, 'utf-8')
       } catch (err) {
         console.warn('createNewDocument web write preparation failed', err)
       }
     }
     console.log("createNewDocument finally ", { remotePath, remoteRef, outputPath, outputParentPath, outputDir })
 
     if (isDesktopPlatform) {
       writeFileEnsuringDir(outputPath, defaultHtml, "utf8");
     } 
       */

    var resultObject = {
      path: outputPath,
      parentPath: outputParentPath,
      dirPath: outputDir,
      cachePath: tempDir,
      cacheDirPath: uuidDir,
      associatedMeetingLinks: associatedMeetingLinks,
      info: DocumentInfo.fromJSON(infoFileData),
      config: DocumentConfiguration.fromJSON(configFileData),
      remotePath,
      remoteRef,
      // config: defaultDocumentConfiguration,
      openMode: DocumentModel.OpenMode.WRITE
    }

    var result = new DocumentModel(resultObject)

    console.log('createNewDocument finally 2 ', { resultObject, result })

    return result
  }

  public static async createNewDocumentFile(
    baseDirPath: string,
    parentDirPath: string,
    filePath: string,
    defaultContentType: DocumentContentType,
    defaultContentKind?: DocumentContentKindType,
    defaultContent: string = '',
    associatedMeetingLinks: string[] = []
  ) {
    if (!baseDirPath || !filePath || !parentDirPath) {
      throw new Error(
        'Base directory, parent directory, and filename are required to create a new document file.'
      )
    }
    const platform = Platform.getPlatform()
    const isDesktopPlatform = platform === Platform.SUPPORTED_PLATFORMS.desktop
    console.log('createNewDocument file platform', { platform, 'win api': window.api, win: window })

    const ddocCacheDir = normalizeRemotePath(baseDirPath || '')
    if (!ddocCacheDir && isDesktopPlatform) throw new Error('Storage directory not available')

    const docUuid = uuidv4()

    const uuidDir = nodeApi.path.join(ddocCacheDir || '', docUuid)
    // const parentDir = isDesktopPlatform ? nodeApi.path.join(uuidDir) : nodeApi.path.join(ddocCacheDir || '')
    // const baseDir = await generateUniqueNameAsync({ baseName: filename, parentDir })
    // Final temp directory
    // const baseDir = nodeApi.path.join(uuidDir, baseDir);

    // Create directory
    // const fsApi = window.api.node?.fs
    if (!nodeApi.fsPromises?.mkdir) {
      throw new Error('Filesystem API not available for document creation.')
    }
    await nodeApi.fsPromises.mkdir(baseDirPath, { recursive: true })
    console.log('writeFileSyncwriteFileSync createdoc', {
      uuidDir,
      ddocCacheDir,
      baseDir: baseDirPath,
      parentDir: parentDirPath,
      folderName: baseDirPath,
      tempDir: baseDirPath
    })

    // ----------------------
    // Create filename.html
    // ----------------------
    // let filename = nodeApi.path.join(baseDir, Utils.MAIN_DOCUMENT_FILE);

    defaultContent = await DocumentModel.getDefaultDocumentContent(
      filePath,
      defaultContentType,
      defaultContentKind,
      defaultContent
    )
    const defaultHtml = defaultContent

    await writeFileEnsuringDirAsync(filePath, defaultHtml, 'utf8')

    // ----------------------
    // Create info.json
    // ----------------------

    const filename = nodeApi.path.basename(filePath)
    const seededInfo = createDefaultDocumentInfo()
    seededInfo.uuid = docUuid
    seededInfo.contentType = defaultContentType
    try {
      const identity = await getCurrentUserIdentity()
      seededInfo.createdBy = identity.userId || undefined
      seededInfo.createdByTemp = identity.deviceId || undefined
    } catch {
      // ignore identity failures during creation
    }
    let infoFileData: any
    // if (isDesktopPlatform) {
    const infoFileRaw = await this._getInfoFileContentAsync(
      baseDirPath,
      true,
      filename,
      JSON.stringify(seededInfo.toJSON())
    )
    infoFileData = DocumentModel._safeJsonParse(infoFileRaw, createDefaultDocumentInfo().toJSON())
    // } else {
    //   infoFileData = seededInfo.toJSON()
    // }
    // ----------------------
    // Create config.json
    // ----------------------
    let configFileData: any
    // if (isDesktopPlatform) {
    const configFileRaw = await this._getConfigurationFileContentAsync(
      baseDirPath,
      true,
      filename,
      JSON.stringify(defaultDocumentConfigurationByType[defaultContentType]?.toJSON())
    )
    configFileData = DocumentModel._safeJsonParse(
      configFileRaw,
      defaultDocumentConfigurationByType[defaultContentType]?.toJSON() ||
        defaultDocumentConfiguration.toJSON()
    )

    console.log('createNewDocument infoFileData ', { infoFileData, configFileData })

    let outputPath = filePath
    let outputParentPath = baseDirPath
    let outputDir = baseDirPath
    let remotePath: string | undefined
    let remoteRef: string | undefined

    if (!isDesktopPlatform) {
      try {
        const resolved = await DriveActions.resolvePath({ path: normalizeRemotePath(outputDir) })
        remotePath = resolved?.path || resolved?.remotePath || outputDir
        remoteRef = resolved?.remote || resolved?.remoteRef
        console.log('createNewDocument normalizeDisplayDir 2 ', {
          resolved,
          remotePath,
          remoteRef,
          outputPath,
          outputParentPath,
          outputDir
        })
      } catch (e) {
        remotePath = outputDir
        console.error('createNewDocument error in path 2 ', { e })
      }
    }

    var resultObject = {
      path: outputPath,
      parentPath: outputParentPath,
      dirPath: outputDir,
      cachePath: baseDirPath,
      cacheDirPath: uuidDir,
      associatedMeetingLinks: associatedMeetingLinks,
      info: DocumentInfo.fromJSON(infoFileData),
      config: DocumentConfiguration.fromJSON(configFileData),
      remotePath,
      remoteRef,
      // config: defaultDocumentConfiguration,
      openMode: DocumentModel.OpenMode.WRITE
    }

    var result = new DocumentModel(resultObject)

    console.log('createNewDocument finally 2 ', { resultObject, result })

    return result
  }

  public static async createSharedDocument(
    defaultContentType: DocumentContentType,
    defaultContentKind?: DocumentContentKindType,
    defaultContent: string = '',
    sharedId: string = 'shared-doc'
  ) {
    const content = await DocumentModel.getDefaultDocumentContent(
      sharedId,
      defaultContentType,
      defaultContentKind,
      defaultContent
    )
    const info = DocumentInfo.fromJSON(createDefaultDocumentInfo().toJSON())
    info.contentType = defaultContentType
    const baseConfig =
      defaultDocumentConfigurationByType[defaultContentType] || defaultDocumentConfiguration
    const config = DocumentConfiguration.fromJSON(
      baseConfig?.toJSON ? baseConfig.toJSON() : baseConfig
    )

    return new DocumentModel({
      path: sharedId,
      parentPath: sharedId,
      dirPath: '',
      cachePath: '',
      cacheDirPath: '',
      info,
      config,
      openMode: DocumentModel.OpenMode.WRITE,
      associatedMeetingLinks: [],
      vars: {},
      backgroundDesignFilePath: null,
      documentTranslations: [],
      uiState: null
    })
  }

  /**
   * Returns a JSON representation of the DocumentInfo.
   * This is useful for serialization or sending over a network.
   */
  toJSON(): object {
    return {
      uuid: this.uuid,
      path: this.path,
      parentPath: this.parentPath,
      dirPath: this.dirPath,
      cachePath: this.cachePath,
      cacheDirPath: this.cacheDirPath,
      name: this.name,
      extension: this.extension,
      isSecured: this.isSecured,
      openMode: this.openMode,
      // info: this.info,
      info: this.info.toJSON(),
      config: this.config.toJSON(),
      remotePath: this.remotePath,
      remoteRef: this.remoteRef,
      vars: this.vars,
      associatedMeetingLinks: this.associatedMeetingLinks || [],
      backgroundDesignFilePath: this.backgroundDesignFilePath,
      documentTranslations: this.documentMainFileTranslations.map((dt) => dt.toJSON()),
      uiState: DocumentModel._uiStateStore.get(this.uuid) ?? null
    }
  }

  /**
   * Creates a DocumentInfo instance from a JSON object.
   * This is useful for deserializing data received from a network or storage.
   */
  static fromJSON(json: any): DocumentModel {
    let normalizedPath = json.path
    let normalizedParentPath = json.parentPath
    let normalizedDirPath = json.dirPath
    let normalizedCachePath = json.cachePath
    let normalizedCacheDirPath = json.cacheDirPath

    // Repair sessions persisted with an empty cache path. Restoring never
    // re-resolves the document, so such a session could never heal itself: it
    // reopened to "File missing" on every reload until the user went Home.
    // The document folder is simply the parent of its main file.
    if (!normalizedCachePath && typeof normalizedPath === 'string') {
      if (normalizedPath.endsWith(Utils.MAIN_DOCUMENT_FILE)) {
        normalizedCachePath = nodeApi.path.dirname(normalizedPath)
        console.warn('[Document] repaired an empty cachePath from', normalizedPath)
      }
    }

    const document = new DocumentModel({
      uuid: json.uuid,
      path: normalizedPath,
      parentPath: normalizedParentPath,
      dirPath: normalizedDirPath,
      cachePath: normalizedCachePath,
      cacheDirPath: normalizedCacheDirPath,
      info: DocumentInfo.fromJSON(json.info),
      config: DocumentConfiguration.fromJSON(json.config),
      remotePath: json.remotePath,
      remoteRef: json.remoteRef,
      vars: json.vars,
      associatedMeetingLinks: json.associatedMeetingLinks,
      backgroundDesignFilePath: json.backgroundDesignFilePath,
      isSecured: json.isSecured,
      openMode: json.openMode
      // documentTranslations: json.documentTranslations.map((dt: any) => DocumentTranslation.fromJSON(dt))
    })
    if (json?.uiState) {
      DocumentModel._hydrateUiState(document.uuid, json.uiState)
    }
    return document
  }
  // Convert Document to Tab object for navigation
  static toNavigationTab(documentEditor: DocumentEditorModel | null): NavigationTab | null {
    // static toNavigationTab(document: DocumentModel | null): NavigationTab | null {
    var document = documentEditor.document
    if (!document) return null
    const tabId =
      documentEditor.uuid || documentEditor.id || document.getMainFilePath?.() || document.path
    const isMainFile = document.isFileTheMainDocumentFile?.()
    let baseTitle = isMainFile
      ? document.name
      : nodeApi.path.basename(document.path, nodeApi.path.extname(document.path))
    const normalizedTitle = (baseTitle || '').toLowerCase()
    if (
      normalizedTitle === Utils.MAIN_DOCUMENT_FILE_NAME.toLowerCase() ||
      normalizedTitle === Utils.MAIN_DOCUMENT_FILE.toLowerCase()
    ) {
      const parentCandidate = document.parentPath || document.cachePath || document.path
      if (parentCandidate) {
        const normalizedParent = parentCandidate.replace(/[\/\\]+$/, '')
        const parentBase = nodeApi.path.basename(normalizedParent)
        const parentExt = nodeApi.path.extname(parentBase)
        baseTitle = parentExt ? parentBase.slice(0, -parentExt.length) : parentBase
      }
    }
    return NavigationTab.fromJSON({
      // id: uuidv4(),
      id: tabId,
      title: baseTitle,
      documentPath: document.path,
      documentExtension: document.extension,
      documentContentType: document.info?.contentType,
      isActive: documentEditor.isActive,
      isDirty: document.isUnsavedDocument(),
      isSecured: document.isSecured,
      isReadOnly: document.openMode === DocumentModel.OpenMode.READ,
      isLoading: false,
      lastAccessed: new Date()
    })
  }

  isSecuredFile(): boolean {
    console.log(
      'getFile isSecuredFile ',
      this.extension,
      Utils.DYNADOC_EXTENSIONS.secured,
      this.extension == Utils.DYNADOC_EXTENSIONS.secured
    )
    return this.extension == Utils.DYNADOC_EXTENSIONS.secured
  }

  isFilePartOfAParentDocument(): boolean {
    const result =
      this.cachePath &&
      this.path.startsWith(this.cachePath) &&
      this.path !== this.parentPath &&
      !this.isFileTheMainDocumentFile()
    // nodeApi.path.join(this.cacheDirPath, Utils.MAIN_DOCUMENT_FILE) !== this.path
    console.log('getFile isFilePartOfAParentDocument ', { this: this, result })

    return result
    // nodeApi.path.basename(this.path) !== Utils.MAIN_DOCUMENT_FILE
  }

  isUnsavedDocument(): boolean {
    const cacheRoot = this.cacheDirPath || ''
    if (!cacheRoot) return false
    const docPath = this.path || ''
    const parentPath = this.parentPath || ''

    console.log('isUnsavedDocument ', {
      path: this.path,
      cachePath: this.cachePath,
      parentPath: this.parentPath,
      cacheRoot: cacheRoot,
      this: this,
      isFileTheMainDocumentFile: this.isFileTheMainDocumentFile()
    })
    return (
      this.isFileTheMainDocumentFile() &&
      ((docPath && docPath.startsWith(cacheRoot)) ||
        (parentPath && parentPath.startsWith(cacheRoot)))
    )
  }

  isFileTheMainDocumentFile(): boolean {
    if (!this.path) return false
    if (
      Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST.filter((v) => {
        return Utils.MAIN_DOCUMENT_FILE_EXTENSION.toLowerCase() !== v.toLowerCase()
      }).includes(this.extension)
    ) {
      if (
        this.cachePath &&
        this.path.startsWith(this.cachePath) &&
        this.parentPath &&
        this.path !== this.parentPath
      ) {
        return false
      }
      return true
    }

    const mainFileName = Utils.MAIN_DOCUMENT_FILE
    const normalizedPath = nodeApi.path.normalize(this.path)
    const normalizedCachePath = this.cachePath ? nodeApi.path.normalize(this.cachePath) : ''
    const normalizedCacheDirPath = this.cacheDirPath
      ? nodeApi.path.normalize(this.cacheDirPath)
      : ''
    const normalizedParentPath = this.parentPath ? nodeApi.path.normalize(this.parentPath) : ''

    if (nodeApi.path.basename(normalizedPath) !== mainFileName) return false

    if (normalizedParentPath && normalizedPath === normalizedParentPath) return true
    if (normalizedCachePath && nodeApi.path.dirname(normalizedPath) === normalizedCachePath)
      return true

    const fromCachePath = normalizedCachePath
      ? nodeApi.path.join(normalizedCachePath, mainFileName)
      : ''
    const fromCacheDir = normalizedCacheDirPath
      ? nodeApi.path.join(normalizedCacheDirPath, mainFileName)
      : ''

    return normalizedPath === fromCachePath || normalizedPath === fromCacheDir
  }
  async getFileContent(filePath: string): Promise<string> {
    // getFileContent(filePath: string): string | null {
    // const filePath = nodeApi.path.join(this.cachePath, fileName)
    // const filePath = nodeApi.path.join(this.dirPath, fileName)
    // filePath = "~/Library/Application Support/ddoc-office/ddoc-office/test/byyFysaS76d46qhtjdq6QR1cttssPYdtUGGRY9HKjOdTGwG-ES8QQa-FEhoirdOmwE5dGp-MmjddYA.enc"

    console.log('------- getFile', filePath, this.isSecured)
    const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
    if (isDesktopPlatform && !(await nodeApi.fsPromises.exists(filePath))) return null
    let contentStr = ''
    let password = 'test'
    console.log('------- getFile yees', password)
    // The legacy password decrypt only applies to a file that is itself an
    // encrypted container. A sealed document's working copy is unpacked in
    // clear before it is opened, so its index.html must be read as text —
    // routing it through decryptFileToMemory failed (the bridge refuses that
    // channel on web) and left the editor on its preparing screen forever.
    const readsEncryptedContainer =
      nodeApi.path.extname(filePath || '') === Utils.DYNADOC_EXTENSIONS.secured
    if (this.isSecured && readsEncryptedContainer) {
      const contentBuffer = await window.api.decryptFileToMemory(filePath, password)
      // const contentBuffer = await SecurityHelpers.decryptFileToMemory(filePath, password)

      contentStr = Buffer.from(contentBuffer).toString('utf8')
      // contentStr = contentBuffer.toString('utf-8')
      console.log('------- getFile contentBuffer contentStr ', filePath, contentStr)
    } else {
      try {
        contentStr = await nodeApi.fsPromises.readFile(filePath, 'utf-8')
      } catch (err) {
        // A read that failed is not an empty document, and saying it was is how
        // content got lost: the editor opened blank over a document whose
        // content never arrived, and the first keystroke autosaved that blank
        // over it. An empty string can only mean a file that really is empty.
        // Record the path so no write reaches it until a read succeeds, and let
        // the failure surface.
        markFileUnreadable(filePath)
        console.error('getFileContent: read failed', filePath, err)
        throw err
      }
    }
    // The failure these guards cover is transient: the same document opens
    // normally on a second try, and a file that reads is writable again.
    markFileReadable(filePath)
    return contentStr
  }

  getFilePath(fileName: string): string | null {
    // Without a cache root, path.join() would yield the bare file name ("index.html"),
    // which silently resolves to the wrong place instead of failing. Say "unknown".
    if (!this.cachePath) return null
    return nodeApi.path.join(this.cachePath, fileName)
  }

  async getFilePathAsync(fileName: string): Promise<string | null> {
    const filePath = nodeApi.path.join(this.cachePath, fileName)
    const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
    if (!isDesktopPlatform) return filePath
    return (await nodeApi.fsPromises.exists(filePath)) ? filePath : null
  }

  getVarsFilePath(): string | null {
    // No var file needed
    if (!this.cachePath) {
      // if (Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST.includes(this.extension)) {
      // if (!this.cachePath || Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST.includes(this.extension)) {
      return null
    }
    /*  if (Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST.includes(this.extension)) {
       return this.path
     } */
    return nodeApi.path.join(this.cachePath, 'vars.json')
  }

  getBgDesignFilePath(filePath?: string, createIfNotExist: boolean = false): string | null {
    if (!this.cachePath || !filePath) return null
    const parsed = nodeApi.path.parse(filePath)
    const outName = `${parsed.name}.bg.design.json`
    if (createIfNotExist) {
      console.warn(
        'getBgDesignFilePath(createIfNotExist=true) is deprecated; use getBgDesignFilePathAsync instead.'
      )
    }
    return nodeApi.path.join(this.cachePath, outName)
  }

  async getBgDesignFilePathAsync(
    filePath?: string,
    createIfNotExist: boolean = false
  ): Promise<string | null> {
    if (!this.cachePath || !filePath) return null
    const parsed = nodeApi.path.parse(filePath)
    const outName = `${parsed.name}.bg.design.json`
    const fullPath = nodeApi.path.join(this.cachePath, outName)

    if (createIfNotExist && !(await nodeApi.fsPromises.exists(fullPath))) {
      await nodeApi.fsPromises.mkdir(this.cachePath, { recursive: true })
      await writeFileEnsuringDirAsync(fullPath, '{}', 'utf8')
    }

    return fullPath
  }

  /* 
    getBgDesignFilePath(filePath?: string): string | null {
      // No var file needed
      if (!this.cachePath) {
        return null
      }
      return nodeApi.path.join(this.cachePath, fileName.'bg.design.json')
    }
  
    getObjectLimitationFilePath(fileName?: string): string | null {
      return nodeApi.path.join(this.cachePath,  fileName.'.limitations.json')
    } */

  async getVars(): Promise<object> {
    const varsFileJsonPath = this.getVarsFilePath()
    // const varsFileJsonPath = nodeApi.path.join(this.cacheDirPath, 'vars.json')
    var data
    const exists = await (async () => {
      try {
        if (nodeApi.fsPromises?.exists)
          return Boolean(await nodeApi.fsPromises.exists(varsFileJsonPath))
      } catch {
        // ignore
      }
      try {
        if (nodeApi.fsPromises?.stat) {
          await nodeApi.fsPromises.stat(varsFileJsonPath)
          return true
        }
      } catch {
        // ignore
      }
      try {
        if (nodeApi.fs?.existsSync) return Boolean(nodeApi.fs.existsSync(varsFileJsonPath))
      } catch {
        // ignore
      }
      try {
        if (nodeApi.fs?.exists) {
          return await new Promise<boolean>((resolve) => {
            // Node-style callback fs.exists(path, cb)
            nodeApi.fs.exists(varsFileJsonPath, (value: boolean) => resolve(Boolean(value)))
          })
        }
      } catch {
        // ignore
      }
      return false
    })()

    if (!exists) {
      // throw new Error(`Missing vars.json in ${ddocCacheDir}`)
      data = '{}'
    } else {
      if (nodeApi.fsPromises?.readFile) {
        data = await nodeApi.fsPromises.readFile(varsFileJsonPath, 'utf-8')
      } else if (nodeApi.fs?.promises?.readFile) {
        data = await nodeApi.fs.promises.readFile(varsFileJsonPath, 'utf-8')
      } else if (nodeApi.fs?.readFile) {
        data = await new Promise<string>((resolve, reject) => {
          nodeApi.fs.readFile(varsFileJsonPath, 'utf-8', (err: any, value: any) => {
            if (err) {
              reject(err)
              return
            }
            resolve(String(value ?? ''))
          })
        })
      } else {
        data = '{}'
      }
    }
    data = JSON.parse(data || '{}')
    try {
      if (typeof window !== 'undefined' && (window as any).__DDOC_VARS_DEBUG__ === true) {
        console.log('Initializing vars data for:', data)
      } else if (
        typeof localStorage !== 'undefined' &&
        localStorage.getItem('ddoc.debug.vars') === 'true'
      ) {
        console.log('Initializing vars data for:', data)
      }
    } catch {
      // ignore
    }

    return data
  }

  getMainFilePath(loadDocumentIfNotExist: boolean = false): string | null {
    const shouldDebug = (() => {
      try {
        if (typeof window !== 'undefined' && (window as any).__DDOC_DOCUMENT_DEBUG__ === true)
          return true
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem('ddoc.debug.document') === 'true'
        }
      } catch {
        // ignore
      }
      return false
    })()

    if (shouldDebug) {
      console.log('_documentEditors Loaded documentToOpen.getMainFilePath():', { this: this })
      console.log('getMainFileContent', loadDocumentIfNotExist)
    }
    if (loadDocumentIfNotExist && this.cachePath) {
      void nodeApi.fsPromises.exists(this.cachePath).then((exists) => {
        if (!exists) {
          void DocumentModel.loadFrom(this.path, this.parentPath, this.openMode)
        }
      })
    }
    // if (this.path && this.cachePath && this.path === this.cachePath) {
    //   return this.path
    // }
    if (Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST.includes(this.extension)) {
      return this.path
    }
    const baseName = Utils.MAIN_DOCUMENT_FILE //  index.html file
    // const baseName = Utils.MAIN_DOCUMENT_FILE_NAME //  index file
    // const baseName = this.name.replace(this.extension, '') // e.g., test
    if (shouldDebug) {
      console.log('getMainFile', baseName)
      console.log('_documentEditors Loaded documentToOpen.getMainFilePath()2:', {
        getFilePath: this.getFilePath(baseName)
      })
    }

    return this.getFilePath(baseName)
    // return this.getFilePath(`${Utils.MAIN_DOCUMENT_FILE_NAME}${Utils.MAIN_DOCUMENT_FILE_EXTENSION}`)
    // return this.getFilePath(`${baseName}.html`)
  }

  async getMainFileContent(): Promise<string> {
    if (Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST.includes(this.extension)) {
      return this.getFileContent(this.path)
    }
    const baseName = Utils.MAIN_DOCUMENT_FILE //  index file
    // const baseName = Utils.MAIN_DOCUMENT_FILE_NAME //  index file

    // const baseName = this.name.replace(this.extension, '') // e.g., test
    console.log('getMainFileContent', baseName)
    const mainPath = await this.getFilePathAsync(baseName)
    if (!mainPath) return ''
    return this.getFileContent(mainPath)
    // return this.getFileContent(`${Utils.MAIN_DOCUMENT_FILE_NAME}${Utils.MAIN_DOCUMENT_FILE_EXTENSION}`)

    // return this.getFileContent(`${baseName}.html`)
  }

  /*
  Usage
    const doc = Document.loadFrom('/tmp/unzipped/test');
  
  const mainHtml = doc.getMainFile();             // reads "test.html"
  const anotherHtml = doc.getFile('another-test.html');
  
  const images = doc.listAssets(Document.AssetType.IMG);
  
  */
  listAssets(type: keyof typeof DocumentModel.AssetType): string[] {
    return []
  }

  async listAssetsAsync(type: keyof typeof DocumentModel.AssetType): Promise<string[]> {
    const assetDir = this.getAsset(DocumentModel.AssetType[type])
    if (!(await nodeApi.fsPromises.exists(assetDir))) return []
    return (await nodeApi.fsPromises.readdir(assetDir)).map((file) =>
      nodeApi.path.join(assetDir, file)
    )
  }

  getAsset(
    type: (typeof DocumentModel.AssetType)[keyof typeof DocumentModel.AssetType],
    fileName: string = ''
  ): string {
    // getAsset(type: keyof typeof DocumentModel.AssetType, fileName: string = ""): string {
    // getAsset(type: keyof typeof DocumentModel.AssetType, fileName: string = ""): string {
    // console.log("getAsset ", this.cachePath, 'assets', type, fileName)
    console.log(
      'getAsset ',
      this.cachePath,
      type,
      fileName,
      DocumentModel.getAssetRelativePath(type, fileName)
    )
    return nodeApi.path.join(this.cachePath, DocumentModel.getAssetRelativePath(type, fileName))
    // return nodeApi.path.join(this.cachePath, 'assets', type, fileName)
    // return nodeApi.path.join(this.cachePath, 'assets', DocumentModel.AssetType[type], fileName)
  }

  static getAssetRelativePath(
    type: (typeof DocumentModel.AssetType)[keyof typeof DocumentModel.AssetType],
    fileName: string = ''
  ): string {
    // console.log("getAssetPath ", this.cachePath, 'assets', type, fileName)
    return nodeApi.path.join('assets', type, fileName)
  }

  static getAssetFilePathFromDocument = async (
    assetType: (typeof DocumentModel.AssetType)[keyof typeof DocumentModel.AssetType],
    document?: DocumentModel | string,
    fileNameToCreate?: string,
    fileRelativePath: string = null
  ) => {
    console.log('ensureSlidePath getAssetFilePathFromDocument', {
      document,
      assetType,
      fileNameToCreate,
      fileRelativePath
    })

    // let fileName
    awaitDriveReady().catch(() => {
      // best-effort; callers may retry when drive is ready
    })
    const baseName = t(assetType)
    let dir = ''
    if (typeof document === 'string') {
      // if document param is a string: it is actually the main file path of the document
      fileRelativePath = DocumentModel.getAssetRelativePath(assetType)
      let cacheDir = await window.api.getCacheDir() // Exposed via preload script
      let rootDir = ''
      if (document.startsWith(cacheDir)) {
        try {
          const stat = await nodeApi.fsPromises.lstat(document)
          rootDir = stat?.isDirectory?.() ? document : nodeApi.path.dirname(document)
        } catch {
          rootDir = nodeApi.path.dirname(document)
        }
      } else {
        rootDir = getFileRootFromBaseDir(cacheDir, document)
      }
      dir = nodeApi.path.join(rootDir, fileRelativePath)
    } else {
      if (!document) {
        document = DocumentModel.getActiveDocument()
      }

      // const baseName = t('Slide')
      // const fileName = `${fileNameToCreate}${Utils.SERIALIZATION_FILE_EXTENSION}`
      // const fileNameWithParentFolder = nodeApi.path.join(getExtension(_language), fileName)
      dir = document?.getAsset(assetType)
      // const dir = activeEditor?.document?.getAsset(DocumentModel.AssetType.SLIDES)
      // if (!fileNameToCreate) {
      //     }else{
      // fileName
      //     }

      if (!dir) return null
    }
    const fileName = fileNameToCreate
      ? fileNameToCreate
      : await generateUniqueNameAsync({
          baseName,
          parentDir: dir,
          extension: Utils.SERIALIZATION_FILE_EXTENSION
        })

    // const dir = nodeApi.path.join(
    //   activeEditor?.document?.getAsset(DocumentModel.AssetType.CODE),
    //   getExtension(_language)
    // )
    // activeEditor?.document?.cachePath || nodeApi.path.join(process.cwd(), 'assets/code', language)
    // const dir = nodeApi.path.join(process.cwd(), `assets/code/${language}`)
    await nodeApi.fsPromises.mkdir(dir, { recursive: true })
    // Relative file name
    // const
    fileRelativePath =
      fileRelativePath ||
      DocumentModel.getAssetRelativePath(
        // document?.getAssetRelativePath(
        assetType
        // DocumentModel.AssetType.SLIDE
        // fileNameWithParentFolder
        // fileName
        // `${_fileNameToCreate}.${getExtension(_language)}`
      )
    // Absolute path
    // const filePath = nodeApi.path.join(dir, fileNameWithParentFolder)
    const filePath = nodeApi.path.join(dir, fileName)
    // const filePath = nodeApi.path.join(dir, fileRelativePath)

    console.log('getAssetFilePathFromDocument ', { dir, fileName, filePath, fileRelativePath })
    if (!(await nodeApi.fsPromises.exists(filePath))) {
      console.log('getAssetFilePathFromDocument pending create', {
        dir,
        fileName,
        filePath,
        fileRelativePath
      })
    }

    return { filePath, fileRelativePath }
  }
  static _getInfoFilePath(
    baseDir: string,
    ensurePathExist = false,
    fileBaseName: string = '',
    defaultContent?: string
  ): string {
    const resolvedBaseDir = this._normalizeBaseDir(baseDir)
    const baseName = fileBaseName
      ? nodeApi.path.basename(
          fileBaseName.toString(),
          nodeApi.path.extname(fileBaseName.toString())
        )
      : Utils.MAIN_DOCUMENT_FILE_NAME
    const fileName = `${baseName}.${Utils.DOCUMENT_INFO_FILE_NAME}${Utils.DOCUMENT_INFO_FILE_EXTENSION}`
    if (ensurePathExist) {
      console.warn(
        '_getInfoFilePath(ensurePathExist=true) is deprecated; use _getInfoFilePathAsync instead.'
      )
    }
    return nodeApi.path.join(resolvedBaseDir, fileName)
  }
  static _getInfoFileContent(
    baseDir: string,
    ensurePathExist = true,
    fileBaseName: string = '',
    defaultContent?: string
  ): string {
    return defaultContent || JSON.stringify(createDefaultDocumentInfo().toJSON())
  }
  /**
   * Whether a file is, beyond doubt, not there.
   *
   * Only an `exists` that answered `false` counts. A probe that threw, or that
   * came back with anything else, has not answered — and the two callers of
   * this method are about to replace a document's metadata with defaults if the
   * answer is "absent", so "nobody answered" must never reach them as `false`.
   */
  private static async _isDefinitelyAbsent(filePath: string): Promise<boolean> {
    const answer = await nodeApi.fsPromises.exists(filePath)
    if (answer === true) return false
    if (answer === false) return true
    throw new Error(`Existence of ${filePath} could not be determined`)
  }

  static async _getInfoFileContentAsync(
    baseDir: string,
    ensurePathExist = true,
    fileBaseName: string = '',
    defaultContent?: string
  ): Promise<string> {
    // Resolved without the write. Whether the default has to be created is
    // decided below, by a read that failed, and not by a probe that answered.
    const filePath = await this._getInfoFilePathAsync(baseDir, false, fileBaseName)
    const fallback = defaultContent || JSON.stringify(createDefaultDocumentInfo().toJSON())
    // The read comes first and the probe second, on purpose. `exists` answering
    // `false` for a file that is there is a shape the drive really produces, so
    // an absence is only believed once a read has failed as well.
    let infoData: string
    try {
      infoData = await nodeApi.fsPromises.readFile(filePath, 'utf-8')
    } catch (err) {
      if (!(await this._isDefinitelyAbsent(filePath))) throw err
      if (ensurePathExist) await writeFileEnsuringDirAsync(filePath, fallback, 'utf-8')
      return fallback
    }
    if (!infoData || !infoData.trim()) return fallback
    return infoData
  }

  getConfiguration(ensurePathExist = true): DocumentConfiguration {
    return this.config || defaultDocumentConfiguration
  }

  getConfigurationFilePath(ensurePathExist = false): string {
    if (!this.cachePath) return ''
    const fileBaseName = this.getConfigFileBaseName()
    return DocumentModel._getConfigurationFilePath(this.cachePath, ensurePathExist, fileBaseName)
    // return DocumentModel._getConfigurationFilePath(this.cachePath, ensurePathExist, this.name != this.getMainFilePath() ? this.name : '')
  }

  getInfoFilePath(ensurePathExist = false): string {
    if (!this.cachePath) return ''
    const fileBaseName = this.getConfigFileBaseName()
    return DocumentModel._getInfoFilePath(this.cachePath, ensurePathExist, fileBaseName)
  }

  private static _normalizeBaseDir(baseDir: string): string {
    if (!baseDir) return baseDir
    const extension = nodeApi.path.extname(baseDir)
    return extension ? nodeApi.path.dirname(baseDir) : baseDir
  }

  private static async _normalizeBaseDirAsync(baseDir: string): Promise<string> {
    if (!baseDir) return baseDir
    try {
      if (await nodeApi.fsPromises.exists(baseDir)) {
        const stat = await nodeApi.fsPromises.stat(baseDir)
        if (stat && !stat.isDirectory()) {
          return nodeApi.path.dirname(baseDir)
        }
      }
    } catch {
      // ignore and fall back to the original path
    }
    return baseDir
  }

  /**
   * The path of the document's info file. Same rule as for the configuration
   * file: `ensurePathExist` writes defaults over an absent file, so only a
   * caller that created `baseDir` in the same call may ask for it.
   */
  static async _getInfoFilePathAsync(
    baseDir: string,
    ensurePathExist = false,
    fileBaseName: string = '',
    defaultContent?: string
  ): Promise<string> {
    const resolvedBaseDir = await this._normalizeBaseDirAsync(baseDir)
    const baseName = fileBaseName
      ? nodeApi.path.basename(
          fileBaseName.toString(),
          nodeApi.path.extname(fileBaseName.toString())
        )
      : Utils.MAIN_DOCUMENT_FILE_NAME
    const fileName = `${baseName}.${Utils.DOCUMENT_INFO_FILE_NAME}${Utils.DOCUMENT_INFO_FILE_EXTENSION}`
    const infoJsonPath = nodeApi.path.join(resolvedBaseDir, fileName)

    if (baseName === Utils.MAIN_DOCUMENT_FILE_NAME) {
      const legacyPath = nodeApi.path.join(resolvedBaseDir, Utils.DOCUMENT_INFO_FILE)
      if (
        (await this._isDefinitelyAbsent(infoJsonPath)) &&
        (await nodeApi.fsPromises.exists(legacyPath))
      ) {
        try {
          await nodeApi.fsPromises.rename(legacyPath, infoJsonPath)
        } catch (err) {
          console.warn('Failed to migrate legacy info.json:', err)
        }
      }
    }
    if (ensurePathExist && (await this._isDefinitelyAbsent(infoJsonPath))) {
      const fallbackContent = defaultContent || JSON.stringify(createDefaultDocumentInfo().toJSON())
      await writeFileEnsuringDirAsync(infoJsonPath, fallbackContent, 'utf-8')
    }
    return infoJsonPath
  }

  static _getConfigurationFilePath(
    baseDir: string,
    ensurePathExist = false,
    fileBaseName: string = '',
    defaultContent?: string
  ): string {
    const resolvedBaseDir = this._normalizeBaseDir(baseDir)
    const baseName = fileBaseName
      ? nodeApi.path.basename(
          fileBaseName.toString(),
          nodeApi.path.extname(fileBaseName.toString())
        )
      : Utils.MAIN_DOCUMENT_FILE_NAME
    const fileName = `${baseName}.${Utils.DOCUMENT_CONFIG_FILE_NAME}${Utils.DOCUMENT_CONFIG_FILE_EXTENSION}`
    if (ensurePathExist) {
      console.warn(
        '_getConfigurationFilePath(ensurePathExist=true) is deprecated; use _getConfigurationFilePathAsync instead.'
      )
    }
    return nodeApi.path.join(resolvedBaseDir, fileName)
  }
  static _getConfigurationFileContent(
    baseDir: string,
    ensurePathExist = true,
    fileBaseName: string = '',
    defaultContent?: string
  ): string {
    return defaultContent || JSON.stringify(defaultDocumentConfiguration.toJSON())
  }
  static async _getConfigurationFileContentAsync(
    baseDir: string,
    ensurePathExist = true,
    fileBaseName: string = '',
    defaultContent?: string
  ): Promise<string> {
    // Resolved without the write. Whether the default has to be created is
    // decided below, by a read that failed, and not by a probe that answered.
    const filePath = await this._getConfigurationFilePathAsync(baseDir, false, fileBaseName)
    const fallback = defaultContent || JSON.stringify(defaultDocumentConfiguration.toJSON())
    // This file carries the document's owner, its reader and writer lists, its
    // auth method and its ephemeral policy. Handing back the defaults because a
    // read failed would answer "no protections" to a question about a protected
    // document, so the read decides and the probe only confirms an absence.
    let configurationData: string
    try {
      configurationData = await nodeApi.fsPromises.readFile(filePath, 'utf-8')
    } catch (err) {
      if (!(await this._isDefinitelyAbsent(filePath))) throw err
      if (ensurePathExist) await writeFileEnsuringDirAsync(filePath, fallback, 'utf-8')
      return fallback
    }
    if (!configurationData || !configurationData.trim()) return fallback
    return configurationData
  }

  /**
   * The path of the document's configuration file.
   *
   * `ensurePathExist` writes the default configuration there when the file is
   * absent, which is how a new document gets one — and it may only be passed by
   * a caller that created `baseDir` in the same call, where absence is a fact
   * and not a verdict. Everywhere else it must be left off: this file holds the
   * owner, the reader and writer lists, the auth method and the ephemeral
   * policy, and writing defaults over it on the strength of one `false` would
   * drop every protection the document has.
   */
  static async _getConfigurationFilePathAsync(
    baseDir: string,
    ensurePathExist = false,
    fileBaseName: string = '',
    defaultContent?: string
  ): Promise<string> {
    const resolvedBaseDir = await this._normalizeBaseDirAsync(baseDir)
    const baseName = fileBaseName
      ? nodeApi.path.basename(
          fileBaseName.toString(),
          nodeApi.path.extname(fileBaseName.toString())
        )
      : Utils.MAIN_DOCUMENT_FILE_NAME
    const fileName = `${baseName}.${Utils.DOCUMENT_CONFIG_FILE_NAME}${Utils.DOCUMENT_CONFIG_FILE_EXTENSION}`
    const configurationJsonPath = nodeApi.path.join(resolvedBaseDir, fileName)

    if (baseName === Utils.MAIN_DOCUMENT_FILE_NAME) {
      const legacyPath = nodeApi.path.join(resolvedBaseDir, Utils.DOCUMENT_CONFIG_FILE)
      if (
        (await this._isDefinitelyAbsent(configurationJsonPath)) &&
        (await nodeApi.fsPromises.exists(legacyPath))
      ) {
        try {
          await nodeApi.fsPromises.rename(legacyPath, configurationJsonPath)
        } catch (err) {
          console.warn('Failed to migrate legacy config.json:', err)
        }
      }
    }
    if (ensurePathExist && (await this._isDefinitelyAbsent(configurationJsonPath))) {
      await writeFileEnsuringDirAsync(
        configurationJsonPath,
        defaultContent || JSON.stringify(defaultDocumentConfiguration.toJSON()),
        'utf-8'
      )
    }
    return configurationJsonPath
  }

  private static _safeJsonParse<T = any>(raw: string, fallback: T): T {
    try {
      if (!raw || !raw.trim()) return fallback
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }
  writeConfigurationFileContent(
    path?: string,
    documentConfiguration?: DocumentConfiguration
  ): void {
    console.log('updatePaginationupdatePagination  ', {
      documentConfiguration,
      'this.config': this.config
    })

    writeFileEnsuringDir(
      path || this.getConfigurationFilePath(false),
      // EditorHelpers.writeFileEnsuringDir(path || DocumentModel._getConfigurationFilePath(this.cachePath),
      JSON.stringify((documentConfiguration || this.config).toJSON(), null, 2),
      'utf-8'
    )
  }

  writeInfoFileContent(path?: string, documentInfo?: DocumentInfo): void {
    writeFileEnsuringDir(
      path || this.getInfoFilePath(false),
      JSON.stringify((documentInfo || this.info).toJSON(), null, 2),
      'utf-8'
    )
  }

  /*
  Usage
    const doc = DocumentModel.loadFrom('/tmp/unzipped/test');

  const mainHtml = doc.getMainFile();             // reads "test.html"
  const anotherHtml = doc.getFile('another-test.html');

  const images = doc.listAssets(DocumentModel.AssetType.IMG);

  */

  isDocumentLikeNonWysiwyg(): boolean {
    return (
      Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST.includes(this.extension) &&
      this.extension != Utils.DOCUMENT_FILE_EXTENSION
    )
  }
  isDocumentLoadedFromAssets(): boolean {
    const assetsRoot = this.cachePath ? nodeApi.path.join(this.cachePath, 'assets') : ''
    const pathSep = nodeApi.path.sep
    const pathValue = this.path || ''
    const cacheDirPath = this.cacheDirPath || ''
    const hasAssetsSegment = pathValue.includes(`${pathSep}assets${pathSep}`)
    const inCacheDir = cacheDirPath ? pathValue.startsWith(cacheDirPath) : false
    console.log('isDocumentLoadedFromAssets ', { this: this, ' f': assetsRoot })
    return (
      (Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST.includes(this.extension) && !this.cachePath) ||
      (assetsRoot && pathValue.startsWith(assetsRoot)) ||
      hasAssetsSegment ||
      (inCacheDir && hasAssetsSegment)
    )
  }

  static isShareCachePath(documentPath: string): boolean {
    const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
    return !isDesktopPlatform && documentPath?.startsWith('share-cache/')
  }
  static isSharedDrivePath(documentPath: string): boolean {
    const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
    return !isDesktopPlatform && documentPath?.startsWith('shared/')
  }
  static async getAppCacheDir(documentPath: string): Promise<string> {
    const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
    const isShareCachePath = DocumentModel.isShareCachePath(documentPath)

    let appCacheDir = await window.api.getCacheDir() // Exposed via preload script
    if (!isDesktopPlatform) {
      // On web/mobile the drive folder itself is the cache root
      appCacheDir = ''
    } else {
      appCacheDir = normalizeRemotePath(appCacheDir || '')
    }
    if (isShareCachePath) appCacheDir = ''
    return appCacheDir
  }

  async isNonWysiwygFile(): Promise<boolean> {
    const appCacheDir = await DocumentModel.getAppCacheDir(this.path)
    const isChildOfDocument =
      Boolean(this.parentPath) && this.parentPath !== this.path && this.path.startsWith(appCacheDir)
    const parentCacheRoot = isChildOfDocument
      ? getFileRootFromBaseDir(appCacheDir, this.parentPath)
      : ''
    const assetsRoot = parentCacheRoot ? nodeApi.path.join(parentCacheRoot, 'assets') : ''
    const isAssetFile = assetsRoot ? this.path.startsWith(assetsRoot) : false
    const isNonWysiwygFile = isAssetFile
      ? true
      : Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST.includes(this.extension) ||
        (isChildOfDocument && !isAssetFile)

    return isNonWysiwygFile
  }
  static async shouldOpenAsFile(documentPath: string): Promise<boolean> {
    return !(await DocumentModel.hasConfigFile(documentPath))
  }
  async shouldPreviewDocument(): Promise<boolean> {
    return this.isDocumentLoadedFromAssets() && (await this.isNonWysiwygFile())
  }

  static async hasConfigFile(documentPath: string): Promise<boolean> {
    if (!documentPath) return false
    console.log('hasConfigFilehasConfigFile', { documentPath })
    try {
      // 1. Get the directory and the filename separately
      const dirName = nodeApi.path.dirname(documentPath)
      const fileName = nodeApi.path.basename(documentPath)
      const pathInfo = nodeApi.path.parse(documentPath)
      const fileNameNoExt = pathInfo.name

      // console.log(fileNameNoExt);

      // 2. Construct the config path within that directory
      // Result: /home/user/docs/my-file.html.config.json
      const configPath = nodeApi.path.join(
        dirName,
        `${fileNameNoExt}.${Utils.DOCUMENT_CONFIG_FILE}`
      )

      // 3. Check for existence. Use the same fs surface as the rest of the open
      // path: the browser fallback shim exposes existsSync but no exists, so
      // nodeApi.fs.exists could throw here while nodeApi.fsPromises works.
      const hasConfig = await nodeApi.fsPromises.exists(configPath)
      console.log('hasConfigFilehasConfigFile 2', {
        documentPath,
        hasConfig,
        fileNameNoExt,
        dirName,
        fileName,
        configPath
      })

      return hasConfig === true
    } catch (err) {
      // A failed probe is not a negative answer. Reporting "no config" here
      // makes the caller treat a document folder as a standalone file, which
      // blanks its cachePath (see loadFrom) and turns every later lookup into a
      // bare "index.html". That breaks the document permanently, including
      // across reloads, because the broken object is persisted as-is. Assume
      // the document folder is intact and let the real read fail loudly.
      console.error('[Document] config probe failed, assuming document folder:', err)
      return true
    }
  }

  isDdocDocument() {
    return (
      this.extension === Utils.DYNADOC_EXTENSIONS.default ||
      this.extension === Utils.DYNADOC_EXTENSIONS.secured
    )
  }

  private static _getCurrentUserEmail(): string {
    try {
      const state = get(authStore)
      const email = state?.user?.email || state?.user?.name || ''
      return (email || '').toString().trim().toLowerCase()
    } catch {
      return ''
    }
  }

  private static _parseDurationMs(rule: EphemeralRule | null | undefined): number | null {
    if (!rule) return null
    if (typeof rule.durationMs === 'number' && Number.isFinite(rule.durationMs)) {
      return Math.max(0, rule.durationMs)
    }
    const duration = rule.duration
    if (duration && typeof duration.value === 'number') {
      const unit = duration.unit || 'day'
      const value = duration.value
      const msPerUnit: Record<string, number> = {
        minute: 60_000,
        hour: 3_600_000,
        day: 86_400_000,
        week: 604_800_000,
        month: 2_592_000_000,
        year: 31_536_000_000
      }
      const factor = msPerUnit[unit] ?? msPerUnit.day
      return Math.max(0, value * factor)
    }
    return null
  }

  private static _parseDurationText(text?: string | null): number | null {
    if (!text) return null
    const match = String(text)
      .trim()
      .match(/(\d+(?:\.\d+)?)\s*(minute|hour|day|week|month|year)s?/i)
    if (!match) return null
    const value = Number(match[1])
    if (!Number.isFinite(value)) return null
    const unit = match[2].toLowerCase()
    const msPerUnit: Record<string, number> = {
      minute: 60_000,
      hour: 3_600_000,
      day: 86_400_000,
      week: 604_800_000,
      month: 2_592_000_000,
      year: 31_536_000_000
    }
    return Math.max(0, value * (msPerUnit[unit] ?? msPerUnit.day))
  }

  private static _resolveEphemeralDeadline(
    rule: EphemeralRule,
    createdAt: Date,
    accessLog: EphemeralAccessLog | undefined,
    openMode: (typeof DocumentModel.OpenMode)[keyof typeof DocumentModel.OpenMode]
  ): Date | null {
    if (!rule) return null
    if (rule.mode === 'absolute') {
      if (!rule.deadlineAt) return null
      const when = new Date(rule.deadlineAt)
      return Number.isNaN(when.getTime()) ? null : when
    }

    const duration =
      DocumentModel._parseDurationMs(rule) ??
      DocumentModel._parseDurationText((rule as any).durationText)
    if (!duration) return null

    if (rule.mode === 'afterCreated') {
      return new Date(createdAt.getTime() + duration)
    }

    if (rule.mode === 'afterFirstRead') {
      const firstRead = accessLog?.firstReadAt ? new Date(accessLog.firstReadAt) : null
      if (!firstRead || Number.isNaN(firstRead.getTime())) return null
      return new Date(firstRead.getTime() + duration)
    }

    if (rule.mode === 'afterFirstWrite') {
      const firstWrite = accessLog?.firstWriteAt ? new Date(accessLog.firstWriteAt) : null
      if (!firstWrite || Number.isNaN(firstWrite.getTime())) return null
      return new Date(firstWrite.getTime() + duration)
    }

    return null
  }

  private static _isRuleApplicable(
    rule: EphemeralRule,
    userEmail: string,
    isOwner: boolean
  ): boolean {
    if (rule?.enabled === false) return false
    if (rule.exemptUsers?.some((u) => u?.toLowerCase?.() === userEmail)) return false
    if (isOwner && rule.deleteForOwner === false) return false
    const appliesToUsers = rule.appliesTo?.users
    if (Array.isArray(appliesToUsers) && appliesToUsers.length) {
      return appliesToUsers.some((u) => u?.toLowerCase?.() === userEmail)
    }
    return true
  }

  private static async _appendEphemeralAuditLog(entry: EphemeralAuditEntry) {
    try {
      const cacheDir = await window.api.getCacheDir()
      if (!cacheDir) return
      const logPath = nodeApi.path.join(cacheDir, 'ephemeral-audit.jsonl')
      const payload = JSON.stringify(entry)
      const existing = await nodeApi.fsPromises.readFile(logPath, 'utf-8').catch(() => '')
      await nodeApi.fsPromises.writeFile(logPath, `${existing}${payload}\n`, 'utf-8')
    } catch (err) {
      console.warn('Failed to append ephemeral audit log', err)
    }
  }

  private static async _deletePathSafe(targetPath?: string | null) {
    if (!targetPath) return
    try {
      if (!(await nodeApi.fsPromises.exists(targetPath))) return
      await nodeApi.fsPromises.rm(targetPath, { recursive: true, force: true })
    } catch (err) {
      console.warn('Failed to delete path', targetPath, err)
    }
  }

  private async _applyEphemeralPolicy(
    openMode: (typeof DocumentModel.OpenMode)[keyof typeof DocumentModel.OpenMode]
  ) {
    const security: DocumentSecurityConfiguration | null = this.config?.security ?? null
    const ephemeral = security?.ephemeral
    if (!ephemeral?.enabled) return

    const userEmail = DocumentModel._getCurrentUserEmail()
    const ownerEmail = (security?.ownerEmail || '').toString().trim().toLowerCase()
    const isOwner = Boolean(userEmail && ownerEmail && userEmail === ownerEmail)
    const rules = Array.isArray(ephemeral.rules) ? ephemeral.rules : []
    const accessLogMap = (ephemeral.accessLog = ephemeral.accessLog || {})
    const userLog = (accessLogMap[userEmail] = accessLogMap[userEmail] || {})

    const now = new Date()

    const isReadOpen =
      openMode === DocumentModel.OpenMode.READ || openMode === DocumentModel.OpenMode.WRITE
    const isWriteOpen = openMode === DocumentModel.OpenMode.WRITE

    const currentReadCount = Number(userLog.readCount || 0)
    const currentWriteCount = Number(userLog.writeCount || 0)
    const nextReadCount = currentReadCount + (isReadOpen ? 1 : 0)
    const nextWriteCount = currentWriteCount + (isWriteOpen ? 1 : 0)

    if (isReadOpen) {
      if (!userLog.firstReadAt) userLog.firstReadAt = now.toISOString()
      userLog.lastReadAt = now.toISOString()
    }
    if (isWriteOpen) {
      if (!userLog.firstWriteAt) userLog.firstWriteAt = now.toISOString()
      userLog.lastWriteAt = now.toISOString()
    }

    let earliestDeadline: Date | null = null
    let matchedRule: EphemeralRule | null = null
    let expiredByCount = false

    for (const rule of rules) {
      if (!DocumentModel._isRuleApplicable(rule, userEmail, isOwner)) continue
      if (rule.maxReads && nextReadCount > rule.maxReads) {
        earliestDeadline = now
        matchedRule = rule
        expiredByCount = true
        break
      }
      if (rule.maxWrites && nextWriteCount > rule.maxWrites) {
        earliestDeadline = now
        matchedRule = rule
        expiredByCount = true
        break
      }
      const deadline = DocumentModel._resolveEphemeralDeadline(
        rule,
        this.info?.createdAt || new Date(),
        userLog,
        openMode
      )
      if (!deadline) continue
      if (!earliestDeadline || deadline.getTime() < earliestDeadline.getTime()) {
        earliestDeadline = deadline
        matchedRule = rule
      }
    }

    if (!expiredByCount) {
      if (isReadOpen) userLog.readCount = nextReadCount
      if (isWriteOpen) userLog.writeCount = nextWriteCount
    }

    this.writeConfigurationFileContent()

    if (!earliestDeadline) return
    if (now.getTime() < earliestDeadline.getTime()) return

    const audit: EphemeralAuditEntry = {
      id: uuidv4(),
      documentUuid: this.uuid,
      documentPath: this.path,
      ruleId: matchedRule?.id,
      actor: userEmail || 'unknown',
      reason: expiredByCount ? 'count-limit' : matchedRule?.mode || 'expired',
      timestamp: now.toISOString()
    }

    await DocumentModel._appendEphemeralAuditLog(audit)

    const shouldDeleteOnExpire = matchedRule?.deleteOnExpire !== false
    if (shouldDeleteOnExpire) {
      await DocumentModel._deletePathSafe(this.path)
      await DocumentModel._deletePathSafe(this.cachePath)
      await DocumentModel._deletePathSafe(this.cacheDirPath)
    }

    throw new Error(`EPHEMERAL_EXPIRED::${this.path}`)
  }

  public getEphemeralTimeRemaining(): {
    remainingMs: number
    deadlineAt: string
    ruleId?: string
    readsLeft?: number | null
    writesLeft?: number | null
  } | null {
    const security: DocumentSecurityConfiguration | null = this.config?.security ?? null
    const ephemeral = security?.ephemeral
    if (!ephemeral?.enabled) return null

    const userEmail = DocumentModel._getCurrentUserEmail()
    const ownerEmail = (security?.ownerEmail || '').toString().trim().toLowerCase()
    const isOwner = Boolean(userEmail && ownerEmail && userEmail === ownerEmail)
    const rules = Array.isArray(ephemeral.rules) ? ephemeral.rules : []
    const accessLogMap = ephemeral.accessLog || {}
    const userLog = accessLogMap[userEmail] || {}
    const createdAt = this.info?.createdAt ? new Date(this.info.createdAt) : new Date()
    const now = new Date()
    const currentReadCount = Number(userLog.readCount || 0)
    const currentWriteCount = Number(userLog.writeCount || 0)

    let earliestDeadline: Date | null = null
    let matchedRule: EphemeralRule | null = null
    let readsLeft: number | null = null
    let writesLeft: number | null = null

    for (const rule of rules) {
      if (!DocumentModel._isRuleApplicable(rule, userEmail, isOwner)) continue
      if (typeof rule.maxReads === 'number') {
        const left = rule.maxReads - currentReadCount
        readsLeft = readsLeft === null ? left : Math.min(readsLeft, left)
      }
      if (typeof rule.maxWrites === 'number') {
        const left = rule.maxWrites - currentWriteCount
        writesLeft = writesLeft === null ? left : Math.min(writesLeft, left)
      }
      const deadline = DocumentModel._resolveEphemeralDeadline(
        rule,
        createdAt,
        userLog,
        DocumentModel.OpenMode.READ
      )
      if (!deadline) continue
      if (!earliestDeadline || deadline.getTime() < earliestDeadline.getTime()) {
        earliestDeadline = deadline
        matchedRule = rule
      }
    }

    if (!earliestDeadline) return null

    return {
      remainingMs: earliestDeadline.getTime() - now.getTime(),
      deadlineAt: earliestDeadline.toISOString(),
      ruleId: matchedRule?.id || matchedRule?.name,
      readsLeft,
      writesLeft
    }
  }

  public static async getEphemeralStatusForPath(documentPath: string): Promise<{
    deadlineAt: string
    remainingMs: number
    readsLeft?: number | null
    writesLeft?: number | null
  } | null> {
    if (!documentPath) return null
    try {
      const cacheDir = await window.api.getCacheDir()
      if (!cacheDir) return null
      const cachePath = getFileRootFromBaseDir(cacheDir, documentPath)
      if (!cachePath || !(await nodeApi.fsPromises.exists(cachePath))) return null
      const baseName = nodeApi.path.basename(documentPath, nodeApi.path.extname(documentPath))
      const configRaw = await DocumentModel._getConfigurationFileContentAsync(
        cachePath,
        false,
        baseName
      )
      const infoRaw = await DocumentModel._getInfoFileContentAsync(cachePath, false, baseName)
      if (!configRaw || !infoRaw) return null
      const config = DocumentConfiguration.fromJSON(JSON.parse(configRaw))
      const info = DocumentInfo.fromJSON(JSON.parse(infoRaw))
      const security = config?.security ?? null
      const ephemeral = security?.ephemeral
      if (!ephemeral?.enabled) return null

      const userEmail = DocumentModel._getCurrentUserEmail()
      const ownerEmail = (security?.ownerEmail || '').toString().trim().toLowerCase()
      const isOwner = Boolean(userEmail && ownerEmail && userEmail === ownerEmail)
      const rules = Array.isArray(ephemeral.rules) ? ephemeral.rules : []
      const accessLogMap = ephemeral.accessLog || {}
      const userLog = accessLogMap[userEmail] || {}
      const createdAt = info?.createdAt ? new Date(info.createdAt) : new Date()
      const now = new Date()
      const currentReadCount = Number(userLog.readCount || 0)
      const currentWriteCount = Number(userLog.writeCount || 0)

      let earliestDeadline: Date | null = null
      let readsLeft: number | null = null
      let writesLeft: number | null = null

      for (const rule of rules) {
        if (!DocumentModel._isRuleApplicable(rule, userEmail, isOwner)) continue
        if (typeof rule.maxReads === 'number') {
          const left = rule.maxReads - currentReadCount
          readsLeft = readsLeft === null ? left : Math.min(readsLeft, left)
        }
        if (typeof rule.maxWrites === 'number') {
          const left = rule.maxWrites - currentWriteCount
          writesLeft = writesLeft === null ? left : Math.min(writesLeft, left)
        }
        const deadline = DocumentModel._resolveEphemeralDeadline(
          rule,
          createdAt,
          userLog,
          DocumentModel.OpenMode.READ
        )
        if (!deadline) continue
        if (!earliestDeadline || deadline.getTime() < earliestDeadline.getTime()) {
          earliestDeadline = deadline
        }
      }

      if (!earliestDeadline) return null

      return {
        deadlineAt: earliestDeadline.toISOString(),
        remainingMs: earliestDeadline.getTime() - now.getTime(),
        readsLeft,
        writesLeft
      }
    } catch (err) {
      console.warn('Failed to resolve ephemeral status', err)
      return null
    }
  }
  static async loadFrom(
    documentPath: string,
    documentParentPath: string | undefined | null,
    openMode: (typeof DocumentModel.OpenMode)[keyof typeof DocumentModel.OpenMode],
    options: { openAsFile?: boolean } = {}
  ): Promise<DocumentModel> {
    console.log('Document.loadFrom enter', { documentPath, documentParentPath })

    if (!documentPath) return null
    const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
    if (isDesktopPlatform && !(await nodeApi.fsPromises.exists(documentPath))) {
      return null
    }
    if (!isDesktopPlatform) {
      documentPath = normalizeRemotePath(documentPath)
      documentParentPath = documentParentPath
        ? normalizeRemotePath(documentParentPath)
        : documentParentPath
      if (documentPath.startsWith('share-cache/')) {
        documentPath = shareCacheResolvePath(documentPath)
        /*  const fixDuplicatedTail = (value: string) => {
           if (!value) return value
           const parts = value.split('/').filter(Boolean)
           if (parts.length < 3) return value
           const last = parts[parts.length - 1]
           const prev = parts[parts.length - 2]
           if (!last || !prev) return value
           const lastName = last.replace(/\.[^/.]+$/i, '')
           if (!lastName) return value
           if (prev.toLowerCase() !== lastName.toLowerCase()) return value
           const fixed = parts.slice(0, -2).concat([last]).join('/')
           return fixed ? fixed : value
         } */
        // documentPath = fixDuplicatedTail(documentPath)
      }
      if (documentParentPath && documentParentPath.startsWith('share-cache/')) {
        documentParentPath = shareCacheResolvePath(documentParentPath)
        // documentParentPath = fixDuplicatedTail(documentParentPath)
      }
      if (!documentParentPath || documentParentPath === '/') {
        try {
          documentParentPath = nodeApi.path.dirname(documentPath)
        } catch {
          documentParentPath = ''
        }
      }
    }
    const isShareCachePath = DocumentModel.isShareCachePath(documentPath)
    // const isShareCachePath = !isDesktopPlatform && documentPath?.startsWith('share-cache/')

    const isSharedDrivePath = DocumentModel.isSharedDrivePath(documentPath)
    // const isSharedDrivePath = !isDesktopPlatform && documentPath?.startsWith('shared/')
    let baseDocDir = ''
    if (isDesktopPlatform) {
      try {
        const stat = await nodeApi.fsPromises.lstat(documentPath).catch(() => null)
        if (stat?.isDirectory?.()) {
          baseDocDir = documentPath
          const indexPath = nodeApi.path.join(documentPath, Utils.MAIN_DOCUMENT_FILE)
          if (await nodeApi.fsPromises.exists(indexPath)) {
            documentPath = indexPath
            if (!documentParentPath) documentParentPath = baseDocDir
          }
        }
      } catch {
        // ignore lstat failures
      }
    }
    if (!isDesktopPlatform && isShareCachePath) {
      console.log('Document.loadFrom isDesktopPlatform', { documentPath, documentParentPath })

      try {
        const stat = await nodeApi.fsPromises.lstat(documentPath).catch(() => null)
        if (stat?.isDirectory?.()) {
          baseDocDir = documentPath
          const indexPath = nodeApi.path.join(documentPath, Utils.MAIN_DOCUMENT_FILE)
          if (await nodeApi.fsPromises.exists(indexPath)) {
            documentPath = indexPath
            if (!documentParentPath) documentParentPath = baseDocDir
          }
        }
      } catch {
        // ignore share cache stat failures
      }
      const dirStat = shareCacheStat(documentPath)
      if (dirStat?.isDirectory?.()) {
        const children = shareCacheListDir(documentPath)
        const directIndex = children.find(
          (child) =>
            child.toLowerCase() === Utils.MAIN_DOCUMENT_FILE.toLowerCase() ||
            child.toLowerCase() === 'index.htm'
        )
        if (directIndex) {
          documentParentPath = documentPath
          documentPath = nodeApi.path.join(documentPath, directIndex)
          baseDocDir = documentParentPath
        }
      }
      const extensionHint = nodeApi.path.extname(documentPath)
      if (!extensionHint) {
        const indexCandidates = [Utils.MAIN_DOCUMENT_FILE, 'index.htm']
        for (const candidate of indexCandidates) {
          const fullPath = nodeApi.path.join(documentPath, candidate)
          if (shareCacheHas(fullPath)) {
            documentParentPath = documentPath
            documentPath = fullPath
            break
          }
        }
        if (
          !extensionHint &&
          shareCacheHas(documentPath) &&
          shareCacheStat(documentPath)?.isDirectory?.()
        ) {
          const children = shareCacheListDir(documentPath)
          if (children.length === 1) {
            const onlyPath = nodeApi.path.join(documentPath, children[0])
            if (shareCacheStat(onlyPath)?.isFile?.()) {
              documentParentPath = documentPath
              documentPath = onlyPath
            }
          }
        }
      }
    }
    if (!isDesktopPlatform && isSharedDrivePath) {
      try {
        if (documentPath.endsWith(`/${Utils.MAIN_DOCUMENT_FILE}`)) {
          baseDocDir = nodeApi.path.dirname(documentPath)
          if (!documentParentPath) documentParentPath = baseDocDir
        } else {
          const stat = await nodeApi.fsPromises.lstat(documentPath).catch(() => null)
          if (stat?.isDirectory?.()) {
            baseDocDir = documentPath
            const indexPath = nodeApi.path.join(documentPath, Utils.MAIN_DOCUMENT_FILE)
            if (await nodeApi.fsPromises.exists(indexPath)) {
              documentPath = indexPath
              if (!documentParentPath) documentParentPath = baseDocDir
            }
          }
        }
      } catch {
        // ignore shared drive stat failures
      }
    }
    // console.log('Document.loadFrom enter after', { documentPath, documentParentPath })

    let appCacheDir = await DocumentModel.getAppCacheDir(documentPath) // Exposed via preload script
    console.log('Document.loadFrom enter after', { documentPath, documentParentPath, appCacheDir })

    // let appCacheDir = await window.api.getCacheDir() // Exposed via preload script
    if (!isDesktopPlatform) {
      // On web/mobile the drive folder itself is the cache root
      appCacheDir = ''
    } else {
      appCacheDir = normalizeRemotePath(appCacheDir || '')
    }
    if (isShareCachePath) appCacheDir = ''
    // let cacheDir = EditorHelpers.getRelativePathFromProjectRoot(appCacheDir, documentPath)
    const normalizedDocPath = (() => {
      if (!documentPath) return ''
      if (appCacheDir && documentPath.startsWith(appCacheDir)) {
        return nodeApi.path.relative(appCacheDir, documentPath)
      }
      // Avoid appCacheDir + absolute path duplication
      if (documentPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(documentPath)) {
        const root = nodeApi.path.parse(documentPath).root || '/'
        return documentPath.replace(root, '')
      }
      return documentPath
    })()
    const normalizedBasePath = (() => {
      if (!baseDocDir) return normalizedDocPath
      if (appCacheDir && baseDocDir.startsWith(appCacheDir)) {
        return nodeApi.path.relative(appCacheDir, baseDocDir)
      }
      if (baseDocDir.startsWith('/') || /^[A-Za-z]:[\\/]/.test(baseDocDir)) {
        const root = nodeApi.path.parse(baseDocDir).root || '/'
        return baseDocDir.replace(root, '')
      }
      return baseDocDir
    })()
    const documentExtension = nodeApi.path.extname(documentPath)
    const openAsFile = options?.openAsFile === true
    // const sharedBaseOverride =
    //   isSharedDrivePath && normalizedDocPath?.endsWith(`/${Utils.MAIN_DOCUMENT_FILE}`)
    //     ? nodeApi.path.dirname(normalizedDocPath)
    //     : ''
    const isDocumentMainFile =
      Boolean(documentParentPath) && documentPath.endsWith(Utils.MAIN_DOCUMENT_FILE)
    const isChildOfDocument =
      Boolean(documentParentPath) &&
      documentParentPath !== documentPath &&
      documentPath.startsWith(appCacheDir)
    const parentCacheRoot = isChildOfDocument
      ? getFileRootFromBaseDir(appCacheDir, documentParentPath)
      : ''
    const assetsRoot = parentCacheRoot ? nodeApi.path.join(parentCacheRoot, 'assets') : ''
    const isAssetFile = assetsRoot ? documentPath.startsWith(assetsRoot) : false
    const isNonWysiwygFile = isAssetFile
      ? true
      : Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST.includes(documentExtension) ||
        openAsFile ||
        (isChildOfDocument && !isAssetFile) ||
        (isDocumentMainFile && !isAssetFile)
    // const isNonWysiwygFile = await isNonWysiwygFile() ||
    // openAsFile
    const isSecured = documentExtension === Utils.DYNADOC_EXTENSIONS.secured
    const cacheKeyPath = (() => {
      // if (sharedBaseOverride) return sharedBaseOverride
      if (baseDocDir) return normalizedBasePath
      if (
        documentExtension === Utils.OFFICE_EXTENSIONS.word ||
        documentExtension === Utils.OFFICE_EXTENSIONS.excel ||
        documentExtension === Utils.OFFICE_EXTENSIONS.powerpoint
      ) {
        const lowered = documentExtension.toLowerCase()
        return normalizedDocPath.replace(new RegExp(`${lowered}$`, 'i'), '')
      }
      if (
        documentExtension === Utils.DYNADOC_EXTENSIONS.default ||
        documentExtension === Utils.DYNADOC_EXTENSIONS.secured
      ) {
        return normalizedDocPath.replace(new RegExp(`${documentExtension}$`, 'i'), '')
      }
      return normalizedDocPath
    })()
    let cacheDir = isShareCachePath
      ? nodeApi.path.dirname(documentPath)
      : nodeApi.path.join(appCacheDir, cacheKeyPath)
    // A packed container (.xddoc/.sddoc) is never a loose file: it is unpacked
    // into the folder that sits next to it under the same name, and that
    // folder is where the bridge must write (`unddocify` refuses an empty
    // output directory). On web the generic rules below pointed cacheDir at
    // the parent folder, then blanked it because no `.config.json` sits next
    // to a sealed file — so a sealed document opened by path never unpacked.
    const isPackedDynadoc =
      documentExtension === Utils.DYNADOC_EXTENSIONS.default ||
      documentExtension === Utils.DYNADOC_EXTENSIONS.secured
    if (!isDesktopPlatform && !isShareCachePath) {
      cacheDir = isPackedDynadoc
        ? documentPath.replace(new RegExp(`${documentExtension}$`, 'i'), '')
        : baseDocDir || nodeApi.path.dirname(documentPath)
    }
    if (!isDesktopPlatform && openAsFile && !isPackedDynadoc) {
      cacheDir = ''
      baseDocDir = ''
    }
    const tempDir = cacheDir
    let cachePath = ''
    let packedDocPath = ''
    let shouldDeletePackedDoc = false
    const documentName = nodeApi.path.basename(documentPath, nodeApi.path.extname(documentPath))
    const isOfficeDoc =
      documentExtension === Utils.OFFICE_EXTENSIONS.word ||
      documentExtension === Utils.OFFICE_EXTENSIONS.excel ||
      documentExtension === Utils.OFFICE_EXTENSIONS.powerpoint
    const tempDocumentFilePath = nodeApi.path.join(
      nodeApi.path.dirname(tempDir),
      `${isOfficeDoc ? Utils.MAIN_DOCUMENT_FILE_NAME : documentName}_${uuidv4()}_temp_pack`
    )
    if (!isNonWysiwygFile && !isShareCachePath) {
      try {
        await nodeApi.fsPromises.mkdir(cacheDir, { recursive: true })
      } catch {
        // ignore
      }
    }

    // const documentName = nodeApi.path.basename(documentPath, nodeApi.path.extname(documentPath))
    let documentDir = nodeApi.path.dirname(documentPath)
    if (isShareCachePath) {
      documentDir = documentDir.replace(/^\/+/, '')
    }
    console.log('Document.loadFrom 1', {
      documentPath,
      cacheDir,
      documentExtension,
      tempFilePath,
      documentParentPath
    })

    if (
      documentExtension !== Utils.DYNADOC_EXTENSIONS.default &&
      documentExtension !== Utils.DYNADOC_EXTENSIONS.secured
    ) {
      var tempFilePath = documentPath
      switch (documentExtension) {
        case Utils.OFFICE_EXTENSIONS.word:
          // Convert to HTML first, then ddocify
          // const tempFilePath = nodeApi.path.join(cacheDir, `${documentName}.html`)
          console.log('Converting to HTML first...', documentPath)
          tempFilePath = await convertDocxToHtml(documentPath, tempDir)
          // Conversion is centralized through documentFileUtils/officeConversion.service.
          break
        case Utils.OFFICE_EXTENSIONS.powerpoint:
          console.log('Converting PowerPoint to slides...', documentPath)
          {
            const { convertPptxToSlidesHtml } =
              await import('../extensions/tiptap/CustomSlideExtension/utils/pptxImport')
            tempFilePath = await convertPptxToSlidesHtml(
              documentPath,
              tempDir,
              // tempDir,
              tempDocumentFilePath,
              DocumentModel.getAssetFilePathFromDocument,
              DocumentModel.AssetType.SLIDE
            )
            console.log('presentationJsonPathpresentationJsonPath tempFilePath:', { tempFilePath })
          }
          break

        default:
          if (isNonWysiwygFile) {
            // console.log('Non-WYSIWYG file')
            tempFilePath = null
            // if file is in the app cached dir, that means it is part of a document
            // Never blank the cache path for a document's own main file: the
            // document folder is its cache root, and an empty cachePath makes
            // getFilePath() return a bare "index.html" that resolves nowhere.
            if (
              !isDesktopPlatform &&
              openAsFile &&
              !documentPath.endsWith(Utils.MAIN_DOCUMENT_FILE)
            ) {
              // if (!isDesktopPlatform && isNonWysiwygFile) {
              cacheDir = ''
              cachePath = ''
            } else if (documentPath.startsWith(appCacheDir)) {
              // if (documentPath.startsWith(cacheDir)) {
              // cachePath = EditorHelpers.getFileRootFromBaseDir(appCacheDir, documentPath)
              // Normalize removes trailing slashes which can confuse some path logic
              const normalizedParent = documentParentPath || ''
              let normalized = normalizedParent
              if (normalizedParent && normalizedParent.startsWith(appCacheDir)) {
                normalized = nodeApi.path.relative(appCacheDir, normalizedParent)
              } else if (nodeApi.path.isAbsolute(normalizedParent)) {
                normalized = nodeApi.path.relative(
                  nodeApi.path.parse(normalizedParent).root || '/',
                  normalizedParent
                )
              }
              cacheDir = nodeApi.path.join(appCacheDir, nodeApi.path.dirname(normalized))
              cachePath = getFileRootFromBaseDir(cacheDir, documentPath)
              //  cacheDir = nodeApi.path.join(appCacheDir, documentPath)
            } else if (
              nodeApi.path.basename(documentPath).toLowerCase() ===
              Utils.MAIN_DOCUMENT_FILE.toLowerCase()
            ) {
              // <folder>/index.html outside app cache: folder IS the cache root.
              // Without this cachePath stays '' and getMainFilePath() returns "index.html" for every open doc.
              cachePath = documentDir
              cacheDir = documentDir
            } else {
              cacheDir = ''
            }
          } else {
            // console.log('Other file type that is not supported')
            return null
          }
          break
      }
      console.log('Document.loadFrom 222', {
        documentPath,
        cacheDir,
        documentExtension,
        tempFilePath,
        documentParentPath
      })

      if (tempFilePath) {
        if (documentExtension === Utils.OFFICE_EXTENSIONS.powerpoint) {
          try {
            await Utils.waitForStableDirectory(tempDir)
          } catch {
            // ignore stability wait errors
          }
        }
        try {
          const isHtmlTemp =
            nodeApi.path.extname(tempFilePath).toLowerCase() === '.html' &&
            nodeApi.path.basename(tempFilePath, '.html') === Utils.MAIN_DOCUMENT_FILE_NAME &&
            nodeApi.path.dirname(tempFilePath) === tempDir
          const packSource = isHtmlTemp ? tempDir : tempFilePath
          if (isOfficeDoc) {
            // await DocumentModel._organizeOfficeAssets(cacheDir, tempFilePath)
            // documentPath = tempFilePath
            documentPath = cacheDir
            documentDir = cacheDir
            cachePath = cacheDir
            // Cleanup temp ddoc and lock files if they exist
            /* if (tempDocumentFilePath) {
              const xddocPath = tempDocumentFilePath.endsWith('.xddoc') ? tempDocumentFilePath : `${tempDocumentFilePath}.xddoc`
              const lockPath = `${xddocPath}${Utils.LOCK_FILE_EXTENSION}`
              await nodeApi.fsPromises.rm(xddocPath, { force: true }).catch(() => {})
              await nodeApi.fsPromises.rm(lockPath, { force: true }).catch(() => {})
            } */
            if (tempDocumentFilePath) {
              let baseFilePath = tempDocumentFilePath
              for (const ext of Object.values(Utils.DYNADOC_EXTENSIONS)) {
                if (baseFilePath.toLowerCase().endsWith(ext.toLowerCase())) {
                  baseFilePath = baseFilePath.slice(0, -ext.length)
                }
              }
              // Sequentially or concurrently await deletions safely
              for (const ext of Object.values(Utils.DYNADOC_EXTENSIONS)) {
                const filePath = `${baseFilePath}${ext}`
                await nodeApi.fsPromises.rm(filePath, { force: true }).catch(() => {})
                await nodeApi.fsPromises
                  .rm(`${filePath}${Utils.LOCK_FILE_EXTENSION}`, { force: true })
                  .catch(() => {})
              }
            }
          } else {
            documentPath = await window.api.ddocify(packSource, tempDocumentFilePath)
            packedDocPath = documentPath
            shouldDeletePackedDoc = true
          }
          await cleanupConversionArtifacts(cacheDir, tempFilePath, [documentPath, tempFilePath])
        } catch (err) {
          if (isRenewRequiredError(err)) {
            notifyRenewRequired()
          }
          throw err
        }
      }
      // if (tempFilePath) documentPath = await window.api.ddocify(tempFilePath, documentName)
      // }

      /* console.log('Document.loadFrom', { documentPath, tempFilePath, documentParentPath },


        {
          parentPath: documentParentPath || documentPath,
          path: documentPath,
          dirPath: documentDir,
          cachePath: cachePath,
          cacheDirPath: cacheDir,
          info: DocumentInfo.fromJSON(docInfo),
          // info: DocumentInfo.fromJSON(defaultDocumentInfo),
          config: DocumentConfiguration.fromJSON(docConfig),
          // config: DocumentConfiguration.fromJSON(defaultDocumentConfiguration),
          openMode: openMode
        }
      ) */
      console.log('Document.loadFrom 333', {
        documentPath,
        cacheDir,
        documentExtension,
        tempFilePath,
        documentParentPath
      })

      if (!tempFilePath) {
        const defaultInfo = createDefaultDocumentInfo().toJSON()
        const defaultConfig = defaultDocumentConfiguration.toJSON()
        const shouldPersistMeta = !isNonWysiwygFile
        const metaBaseName =
          isChildOfDocument || isOfficeDoc ? Utils.MAIN_DOCUMENT_FILE_NAME : documentName
        // Optional means "the document may not have this file", not "any
        // failure here is the same as not having it". The fallback for the
        // configuration file is the default security -- no owner, empty reader
        // and writer lists, no ephemeral policy -- so returning it because a
        // read broke answers "unprotected" about a document whose protections
        // were simply not readable. Absence is accepted as a fact; a failure
        // that is not an absence is raised.
        const readOptional = async <T = any>(filePath: string, fallback: T): Promise<T> => {
          if (!filePath) return fallback
          let raw: string
          try {
            raw = await nodeApi.fsPromises.readFile(filePath, 'utf-8')
          } catch (err) {
            if (await DocumentModel._isDefinitelyAbsent(filePath)) return fallback
            throw err
          }
          return this._safeJsonParse(raw, fallback)
        }

        const shareBase = isShareCachePath
          ? baseDocDir || nodeApi.path.dirname(documentPath)
          : cachePath
        const allowPersistMeta = shouldPersistMeta && !isShareCachePath
        const infoData =
          shareBase && allowPersistMeta
            ? JSON.parse(await this._getInfoFileContentAsync(shareBase, false, metaBaseName))
            : await readOptional(
                shareBase ? await this._getInfoFilePathAsync(shareBase, false, metaBaseName) : '',
                defaultInfo
              )
        const configData =
          shareBase && allowPersistMeta
            ? JSON.parse(
                await this._getConfigurationFileContentAsync(shareBase, false, metaBaseName)
              )
            : await readOptional(
                shareBase
                  ? await this._getConfigurationFilePathAsync(shareBase, false, metaBaseName)
                  : '',
                defaultConfig
              )
        console.log('paginationpaginationpagination Document.loadFrom config source', {
          cachePath,
          metaBaseName,
          configPath: cachePath
            ? await this._getConfigurationFilePathAsync(cachePath, false, metaBaseName)
            : ''
        })
        console.log('paginationpaginationpagination Document.loadFrom ', {
          documentPath,
          cacheDir,
          documentExtension,
          tempFilePath,
          documentParentPath
        })

        if (cachePath && shouldPersistMeta && !isShareCachePath) {
          const hasPageSize = !!infoData?.pageWidth && !!infoData?.pageHeight
          if (!hasPageSize) {
            const htmlPath = nodeApi.path.join(
              cachePath,
              `${metaBaseName}${Utils.MAIN_DOCUMENT_FILE_EXTENSION}`
            )
            if (await nodeApi.fsPromises.exists(htmlPath)) {
              try {
                const htmlRaw = await nodeApi.fsPromises.readFile(htmlPath, 'utf-8')
                const format = extractPageFormatFromHtml(htmlRaw)
                if (format?.pageWidth && format?.pageHeight) {
                  infoData.pageWidth = format.pageWidth
                  infoData.pageHeight = format.pageHeight
                  if (format.marginTop != null) infoData.marginTop = format.marginTop
                  if (format.marginBottom != null) infoData.marginBottom = format.marginBottom
                  if (format.marginLeft != null) infoData.marginLeft = format.marginLeft
                  if (format.marginRight != null) infoData.marginRight = format.marginRight
                  try {
                    const infoPath = await this._getInfoFilePathAsync(
                      cachePath,
                      false,
                      metaBaseName
                    )
                    await writeFileEnsuringDirAsync(
                      infoPath,
                      JSON.stringify(infoData, null, 2),
                      'utf-8'
                    )
                  } catch {
                    // ignore
                  }
                }
              } catch {
                // ignore
              }
            }
          }
        }
        console.log('paginationpaginationpagination Document.loadFrom w2', {
          documentPath,
          cacheDir,
          documentExtension,
          tempFilePath,
          documentParentPath
        })

        const mergedInfoData = {
          ...(infoData || {})
        }
        const mergedConfigData = applyInfoToConfig(configData, mergedInfoData)
        if (cachePath && shouldPersistMeta && !isShareCachePath) {
          const configPath = await this._getConfigurationFilePathAsync(
            cachePath,
            false,
            metaBaseName
          )
          const needsPagination =
            !mergedConfigData?.pagination ||
            !mergedConfigData.pagination.pageWidth ||
            !mergedConfigData.pagination.pageHeight
          if (needsPagination) {
            try {
              await writeFileEnsuringDirAsync(
                configPath,
                JSON.stringify(mergedConfigData, null, 2),
                'utf-8'
              )
            } catch {
              // ignore config write failures
            }
          }
        }

        const newDocumentObject = {
          parentPath: documentParentPath || documentPath,
          path: documentPath,
          dirPath: documentDir,
          cachePath: cachePath,
          cacheDirPath: cacheDir,
          info: DocumentInfo.fromJSON(mergedInfoData),
          config: DocumentConfiguration.fromJSON(mergedConfigData),
          // info: DocumentInfo.fromJSON(mergedInfoData),
          // config: DocumentConfiguration.fromJSON(mergedConfigData),
          openMode: openMode,
          associatedMeetingLinks: []
        }
        const newDocument = new DocumentModel(newDocumentObject)

        console.log('Document.loadFrom createed', { newDocument, newDocumentObject })
        await newDocument._applyEphemeralPolicy(openMode)
        return newDocument
      }
    }
    console.log('Document.loadFrom afteer', { documentPath, tempFilePath, documentParentPath })
    if (
      !isDesktopPlatform &&
      (documentExtension === Utils.DYNADOC_EXTENSIONS.default ||
        documentExtension === Utils.DYNADOC_EXTENSIONS.secured)
    ) {
      try {
        const stat = await nodeApi.fsPromises.lstat(documentPath).catch(() => null)
        const isDir =
          !!(await nodeApi.fsPromises.exists(documentPath)) &&
          (typeof stat?.isDirectory === 'function'
            ? stat.isDirectory()
            : Boolean(stat?.isDirectory || stat?.isDir))
        if (isDir) {
          const ddocCacheDir = documentPath
          const infoData = JSON.parse(
            await this._getInfoFileContentAsync(ddocCacheDir, false, Utils.MAIN_DOCUMENT_FILE_NAME)
          )
          const configData = JSON.parse(
            await this._getConfigurationFileContentAsync(
              ddocCacheDir,
              false,
              Utils.MAIN_DOCUMENT_FILE_NAME
            )
          )
          const hasPageSize = !!infoData?.pageWidth && !!infoData?.pageHeight
          if (!hasPageSize) {
            const htmlPath = nodeApi.path.join(ddocCacheDir, Utils.MAIN_DOCUMENT_FILE)
            if (await nodeApi.fsPromises.exists(htmlPath)) {
              try {
                const htmlRaw = await nodeApi.fsPromises.readFile(htmlPath, 'utf-8')
                const format = extractPageFormatFromHtml(htmlRaw)
                if (format?.pageWidth && format?.pageHeight) {
                  infoData.pageWidth = format.pageWidth
                  infoData.pageHeight = format.pageHeight
                  if (format.marginTop != null) infoData.marginTop = format.marginTop
                  if (format.marginBottom != null) infoData.marginBottom = format.marginBottom
                  if (format.marginLeft != null) infoData.marginLeft = format.marginLeft
                  if (format.marginRight != null) infoData.marginRight = format.marginRight
                  try {
                    const infoPath = await this._getInfoFilePathAsync(
                      ddocCacheDir,
                      false,
                      Utils.MAIN_DOCUMENT_FILE_NAME
                    )
                    await writeFileEnsuringDirAsync(
                      infoPath,
                      JSON.stringify(infoData, null, 2),
                      'utf-8'
                    )
                  } catch {
                    // ignore
                  }
                }
              } catch {
                // ignore
              }
            }
          }
          const mergedInfoData = {
            ...(infoData || {})
          }
          const mergedConfigData = applyInfoToConfig(configData, mergedInfoData)
          const docInfo = DocumentInfo.fromJSON(mergedInfoData)
          const docConfig = DocumentConfiguration.fromJSON(mergedConfigData)

          const openedDocument = new DocumentModel({
            parentPath: documentParentPath || documentPath,
            path: documentPath,
            dirPath: documentDir,
            cachePath: ddocCacheDir,
            cacheDirPath: ddocCacheDir,
            info: docInfo,
            config: docConfig,
            openMode: openMode,
            associatedMeetingLinks: []
          })
          await openedDocument._applyEphemeralPolicy(openMode)
          return openedDocument
        }
      } catch (err) {
        console.warn('Failed to open unpacked web document directory', err)
      }
    }
    let ddocCacheDir: string
    const statForUnddoc = await nodeApi.fsPromises.lstat(documentPath).catch(() => null)
    // On web, lstat resolves to the bridge's plain JSON entry: it carries
    // `isDir`, not Node's `isDirectory()`. Calling the method first threw
    // "isDirectory is not a function" for every document opened by path on
    // web — a sealed document from the drive tree never reached unddocify.
    // Same guard as the directory check in saveTo.
    const isDirForUnddoc =
      !!statForUnddoc &&
      (typeof statForUnddoc.isDirectory === 'function'
        ? statForUnddoc.isDirectory()
        : Boolean((statForUnddoc as any).isDirectory || (statForUnddoc as any).isDir))
    if (isDirForUnddoc) {
      ddocCacheDir = documentPath
    } else {
      try {
        ddocCacheDir = await window.api.unddocify(
          documentPath,
          cacheDir,
          isSecured,
          getValidStepUpToken() || ''
        )
      } catch (err: any) {
        // The sealed file demands a fresh verification (HTTP 428): run the
        // step-up modal, then retry once with the freshly minted token.
        if (isStepUpRequiredError(err)) {
          const stepUpToken = await openStepUpModal()
          if (!stepUpToken) throw err
          ddocCacheDir = await window.api.unddocify(documentPath, cacheDir, isSecured, stepUpToken)
        } else {
          const message = err?.message || err?.toString?.() || 'Secure open failed'
          if (typeof message === 'string' && message.toLowerCase().includes('invalid key slot')) {
            await openAlertModal({
              title: 'Secure document',
              message:
                'Unable to open this secure document. The security key slot is invalid or expired. Please sign in and renew your secure license.'
            })
            notifyRenewRequired()
          }
          throw err
        }
      }
    }
    console.log('Document.loadFrom unddocify', {
      documentPath,
      ddocCacheDir,
      cacheDir,
      tempFilePath,
      documentParentPath
    })

    console.log('Document.unddocify', ddocCacheDir, cacheDir)
    if (shouldDeletePackedDoc && packedDocPath && packedDocPath.startsWith(cacheDir)) {
      await safeRemovePath(packedDocPath)
      packedDocPath = ''
      documentPath = ddocCacheDir
      documentDir = ddocCacheDir
    }

    // const ddocCacheDir = await Utils.unddocify(documentPath, cacheDir)

    // const infoJsonPath = nodeApi.path.join(ddocCacheDir, 'info.json')
    let infoData = JSON.parse(
      await this._getInfoFileContentAsync(ddocCacheDir, false, Utils.MAIN_DOCUMENT_FILE_NAME)
    )
    let configData = JSON.parse(
      await this._getConfigurationFileContentAsync(
        ddocCacheDir,
        false,
        Utils.MAIN_DOCUMENT_FILE_NAME
      )
    )
    const hasPageSize = !!infoData?.pageWidth && !!infoData?.pageHeight
    if (!hasPageSize) {
      const htmlPath = nodeApi.path.join(ddocCacheDir, Utils.MAIN_DOCUMENT_FILE)
      if (await nodeApi.fsPromises.exists(htmlPath)) {
        try {
          const htmlRaw = await nodeApi.fsPromises.readFile(htmlPath, 'utf-8')
          const format = extractPageFormatFromHtml(htmlRaw)
          if (format?.pageWidth && format?.pageHeight) {
            infoData.pageWidth = format.pageWidth
            infoData.pageHeight = format.pageHeight
            if (format.marginTop != null) infoData.marginTop = format.marginTop
            if (format.marginBottom != null) infoData.marginBottom = format.marginBottom
            if (format.marginLeft != null) infoData.marginLeft = format.marginLeft
            if (format.marginRight != null) infoData.marginRight = format.marginRight
            try {
              const infoPath = await this._getInfoFilePathAsync(
                ddocCacheDir,
                false,
                Utils.MAIN_DOCUMENT_FILE_NAME
              )
              await writeFileEnsuringDirAsync(infoPath, JSON.stringify(infoData, null, 2), 'utf-8')
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }
      }
    }
    const mergedInfoData = {
      ...(infoData || {})
    }
    const mergedConfigData = applyInfoToConfig(configData, mergedInfoData)
    const docInfo = DocumentInfo.fromJSON(mergedInfoData)
    const docConfig = DocumentConfiguration.fromJSON(mergedConfigData)
    console.log(
      'Document.loadFrom afteer  2',
      { documentPath, tempFilePath },
      {
        // parentPath: documentPath,
        parentPath: documentParentPath || documentPath,
        path: documentPath,
        dirPath: documentDir,
        cachePath: ddocCacheDir,
        cacheDirPath: cacheDir,
        info: docInfo,
        config: docConfig,
        openMode: openMode
      }
    )

    const openedDocument = new DocumentModel({
      // parentPath: documentPath,
      parentPath: documentParentPath || documentPath,
      path: documentPath,
      dirPath: documentDir,
      cachePath: ddocCacheDir,
      cacheDirPath: cacheDir,
      info: docInfo,
      config: docConfig,
      openMode: openMode,
      associatedMeetingLinks: []
    })
    await openedDocument._applyEphemeralPolicy(openMode)
    return openedDocument
  }

  /**
   * Save the current DDOC document back to a given output window.api.node.path.
   * - Repackages cache directory into a .ddoc or .sddoc file
   * - Optionally exports to original Office format (docx, xlsx, pptx)
   */
  async saveTo(
    // static async saveTo(
    // document:DocumentModel,
    saveAsSecured: boolean = false,
    outputPath?: string,
    saveMode?: (typeof DocumentModel.OpenMode)[keyof typeof DocumentModel.OpenMode],
    require2fa: boolean = false
  ): Promise<string> {
    if (!outputPath) outputPath = this.isFilePartOfAParentDocument() ? this.parentPath : this.path
    console.log('Saving document editor saveTo outputPath ...', outputPath, saveAsSecured, {
      this: this
    })

    this.info.updatedAt = new Date()
    this.writeInfoFileContent()

    const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
    const isWeb = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.web
    // A secured save must reach the server-side `ddocify` branch below. The
    // non-desktop short-circuit treats `.xddoc` and `.sddoc` alike and returns
    // early, which makes sealing on WEB a silent no-op (no `.sddoc` produced, no
    // error). Skip the short-circuit only for web secured saves; mobile keeps its
    // existing behavior (its secured path is not validated for ddocify) and a
    // normal (`.xddoc`) web save still short-circuits to the cache folder.
    const isSecuredSave =
      saveAsSecured || nodeApi.path.extname(outputPath || '') === Utils.DYNADOC_EXTENSIONS.secured
    if (!isDesktopPlatform && !(isWeb && isSecuredSave)) {
      try {
        const outputStat = outputPath
          ? await nodeApi.fsPromises.lstat(outputPath).catch(() => null)
          : null
        const outputIsDir =
          !!outputPath &&
          !!(await nodeApi.fsPromises.exists(outputPath)) &&
          (typeof outputStat?.isDirectory === 'function'
            ? outputStat.isDirectory()
            : Boolean(outputStat?.isDirectory || outputStat?.isDir))
        const isCachePath = !!this.cachePath && outputPath === this.cachePath
        if (outputIsDir || isCachePath) {
          return outputPath
        }
        const ext = outputPath ? nodeApi.path.extname(outputPath) : ''
        if (ext === Utils.DYNADOC_EXTENSIONS.default || ext === Utils.DYNADOC_EXTENSIONS.secured) {
          const targetDir = this.cachePath || outputPath
          if (targetDir) {
            try {
              await nodeApi.fsPromises.mkdir(targetDir, { recursive: true })
            } catch {
              // ignore
            }
            return targetDir
          }
        }
      } catch {
        // ignore web/mobile directory checks
      }
    }

    // WEB-ONLY: the web "Save As" dialog has no real directory chooser; the
    // server echoes a drive-root path (e.g. `drive/<name>.sddoc`) that is
    // disconnected from the document's actual drive folder
    // (`this.cachePath` = `.../<name>/`). Re-root the sealed output so the
    // `.sddoc` lands as a SIBLING of the document's own folder (inside its
    // parent), matching where the document really lives and where desktop writes
    // its seal. Deriving from `this.cachePath` also guarantees the input dir and
    // the output file share the same drive namespace on the server, since
    // SddocService.Pack normalizes both by stripping a leading `drive/`.
    if (isWeb && isSecuredSave && this.cachePath) {
      const parentDir = nodeApi.path.dirname(this.cachePath)
      const docName = nodeApi.path.basename(this.cachePath)
      outputPath = nodeApi.path.join(parentDir, `${docName}${Utils.DYNADOC_EXTENSIONS.secured}`)
    }

    // return
    //  if (
    //   !this.isFilePartOfAParentDocument()
    // )
    if (saveAsSecured) {
      // Change extension to .sddoc
      const dir = nodeApi.path.dirname(outputPath)
      const baseName = nodeApi.path.basename(outputPath, nodeApi.path.extname(outputPath))
      outputPath = nodeApi.path.join(dir, `${baseName}${Utils.DYNADOC_EXTENSIONS.secured}`)
    }
    const documentExtension = nodeApi.path.extname(outputPath)
    // const cacheDir = this.cacheDirPath
    const cacheDir = this.cachePath
    const documentName = nodeApi.path.basename(outputPath, documentExtension)

    // --------------------------------------------
    // 1. Save info.json back into cache
    // --------------------------------------------
    // const infoJsonPath = ___path.join(cacheDir, "info.json")
    // ___EditorHelpers.writeFileEnsuringDir(infoJsonPath, JSON.stringify(this.info.toJSON(), null, 2))

    // --------------------------------------------
    // 2. Re-package the DDOC cache directory
    // --------------------------------------------
    let finalDdocPath: string = outputPath

    if (
      documentExtension === Utils.DYNADOC_EXTENSIONS.default ||
      documentExtension === Utils.DYNADOC_EXTENSIONS.secured
    ) {
      // Pack DDOC (reverse of unddocify)
      const shouldSecured = saveAsSecured || documentExtension === Utils.DYNADOC_EXTENSIONS.secured

      console.log('Saving document editor saveTo ddocify ...', {
        shouldSecured,
        documentExtension,
        cacheDir,
        outputPath
      })

      try {
        // Secure sealing runs server-side (ddocify reads the document FROM the
        // drive), so the cache folder must be on the drive first. A freshly
        // created web doc lives only in the virtual FS until now.
        if (shouldSecured) {
          const syncResult = await window.server?.drive?.syncDoc?.({ cachePath: cacheDir })
          if (syncResult && syncResult.ok === false) {
            throw new Error(syncResult.message || 'Unable to sync the document before sealing.')
          }
        }
        const parsed = nodeApi.path.parse(outputPath)
        const tempPath = nodeApi.path.join(
          parsed.dir,
          `${parsed.name}.tmp${parsed.ext || Utils.DYNADOC_EXTENSIONS.default}`
        )
        finalDdocPath = await window.api.ddocify(cacheDir, tempPath, shouldSecured, require2fa)
        if (await nodeApi.fsPromises.exists(outputPath)) {
          if (window.api?.deleteFile) {
            await window.api.deleteFile(outputPath)
          } else {
            await nodeApi.fsPromises.rm(outputPath, { force: true })
          }
        }
        const tempCandidates = [
          tempPath,
          `${tempPath}${parsed.ext || Utils.DYNADOC_EXTENSIONS.default}`
        ]
        const existingTemp = (
          await Promise.all(
            tempCandidates.map(async (candidate) =>
              (await nodeApi.fsPromises.exists(candidate)) ? candidate : ''
            )
          )
        ).find(Boolean)
        if (existingTemp) {
          if (window.api?.renameFile) {
            const newName = nodeApi.path.basename(outputPath)
            await window.api.renameFile(existingTemp, newName)
          } else {
            await nodeApi.fsPromises.rename(existingTemp, outputPath).catch(async () => {
              await nodeApi.fsPromises.copyFile(existingTemp, outputPath)
              await nodeApi.fsPromises.rm(existingTemp, { force: true })
            })
          }
        }
        finalDdocPath = outputPath
      } catch (err) {
        if (isRenewRequiredError(err)) {
          notifyRenewRequired()
        }
        throw err
      }
      console.log('Saving document editor saveTo finalDdocPath ...', {
        shouldSecured,
        documentExtension,
        cacheDir,
        finalDdocPath
      })

      console.log('Document.saveTo → redocify:', finalDdocPath)
      return finalDdocPath
    }

    // ---------------------------------------------------------
    // 3. If saving as a non-DDOC format → convert backwards
    // Example: user edits a docx → becomes DDOC → wants to save back as DOCX
    // ---------------------------------------------------------
    switch (documentExtension) {
      case Utils.OFFICE_EXTENSIONS.word:
      case Utils.OFFICE_EXTENSIONS.excel:
      case Utils.OFFICE_EXTENSIONS.powerpoint: {
        // Export DDOC → HTML → Word (or Excel, PowerPoint)
        console.log('Exporting DDOC back to Office format...', outputPath)

        // Step 1: Convert DDOC → HTML
        const htmlTempPath = nodeApi.path.join(cacheDir, `${documentName}.html`)
        const exportedHtml = await window.api.exportDdocToHtml(cacheDir, htmlTempPath)

        // Step 2: Convert HTML → Office document
        finalDdocPath = await convertHtmlToDocx(exportedHtml, outputPath)

        console.log('Document.saveTo → HtmlToDocx:', finalDdocPath)
        return finalDdocPath
      }

      default:
        // -------------------------------------------------------
        // 4. Non-WYSIWYG formats — Save raw or skip conversion
        // -------------------------------------------------------
        if (Utils.NON_WYSIWYG_FILE_EXTENSIONS_LIST.includes(documentExtension)) {
          console.log('Saving non-WYSIWYG file type → copying only.')
          return outputPath
        }

        console.warn('Unknown extension for saveTo(). Saving DDOC instead.')
        try {
          finalDdocPath = await window.api.ddocify(cacheDir, outputPath)
        } catch (err) {
          if (isRenewRequiredError(err)) {
            notifyRenewRequired()
          }
          throw err
        }
        return finalDdocPath
    }
  }

  /* private static async _organizeOfficeAssets(cacheDir: string, htmlFilePath: string): Promise<void> {
    const assetsImgDir = nodeApi.path.join(cacheDir, 'assets', 'img')
    await nodeApi.fsPromises.mkdir(assetsImgDir, { recursive: true })

    const baseName = nodeApi.path.basename(htmlFilePath, nodeApi.path.extname(htmlFilePath))
    const htmlDir = nodeApi.path.dirname(htmlFilePath)
    const officeFilesDir = nodeApi.path.join(htmlDir, `${baseName}_files`)

    if (await nodeApi.fsPromises.exists(officeFilesDir)) {
      const files = await nodeApi.fsPromises.readdir(officeFilesDir)
      for (const file of files) {
        const srcPath = nodeApi.path.join(officeFilesDir, file)
        const destPath = nodeApi.path.join(assetsImgDir, file)
        await nodeApi.fsPromises.rename(srcPath, destPath)
      }
      await nodeApi.fsPromises.rm(officeFilesDir, { recursive: true, force: true }).catch(() => { })
    }

    if (await nodeApi.fsPromises.exists(htmlFilePath)) {
      let html = await nodeApi.fsPromises.readFile(htmlFilePath, 'utf-8')
      const officeFilesDirName = `${baseName}_files`
      const regex = new RegExp(`src="([^"]*)${officeFilesDirName}/([^"]+)"`, 'g')
      html = html.replace(regex, 'src="assets/img/$2"')
      await nodeApi.fsPromises.writeFile(htmlFilePath, html, 'utf-8')
    }
  } */
}
export class DocumentTranslation {
  static OpenMode = {
    READ: 'read',
    WRITE: 'write'
  } as const

  // static AssetType = {
  //   IMG: 'img',
  //   VIDEOS: 'videos',
  //   DOCS: 'docs',
  //   AUDIOS: 'audios',
  //   OTHERS: 'others'
  // } as const

  path: string // Full file path
  dirPath: string // Parent directory path

  name: string // Just the filename, Eg test.html
  language: string // language code, e.g., 'fr', 'es'
  region: string // language region, e.g., 'FR', 'US'
  extension: string // e.g., '.json'
  isActive: boolean = false
  // isSecured: boolean = false // Optional: flag if encrypted or protected
  openMode: (typeof DocumentTranslation.OpenMode)[keyof typeof DocumentTranslation.OpenMode]

  constructor(params: {
    path: string
    dirPath: string
    // locale: string
    // country: string
    // info: DocumentInfo
    // isSecured?: boolean
    isActive?: boolean
    openMode: (typeof DocumentTranslation.OpenMode)[keyof typeof DocumentTranslation.OpenMode]
  }) {
    this.path = params.path
    this.dirPath = params.dirPath
    this.name = this.extractName(params.path)
    this.extension = this.extractExtension(params.path)
    this.language = this.extractLanguage(params.path)
    this.region = this.extractRegion(params.path)
    // this.info = params.info
    // this.isSecured = params.isSecured ?? false
    this.isActive = params.isActive ?? false
    this.openMode = params.openMode
  }

  private extractName(fullPath: string): string {
    return fullPath.split('/').pop() || ''
  }

  private extractExtension(fullPath: string): string {
    return '.' + (this.name.split('.').pop() || '')
  }

  private extractLanguage1(fullPath: string): string {
    // test.fr.json     => "fr"
    // test.fr-FR.json  => "fr"
    const baseName = this.name.replace(this.extension, '')
    // const baseName = this.name.replace(this.extension, '')
    const lastPart = baseName.split('.').pop() ?? ''
    return lastPart.split('-')[0] || ''
  }

  private extractLanguage(fullPath: string): string {
    const baseName = this.name.replace(this.extension, '')
    const localePart = baseName.split('.').pop() ?? ''
    // Return the WHOLE part (e.g., "en-US" or "en")
    // so that "en" and "en-US" are unique values.
    return localePart
  }

  // Keep this if you need to know just the region separately
  private extractRegion(fullPath: string): string {
    const baseName = this.name.replace(this.extension, '')
    const localePart = baseName.split('.').pop() ?? ''
    return localePart.includes('-') ? localePart.split('-')[1] : ''
  }
  private extractRegion1(fullPath: string): string {
    // test.fr.json     => ""
    // test.fr-FR.json  => "FR"
    const baseName = this.name.replace(this.extension, '')
    const lastPart = baseName.split('.').pop() ?? ''
    return lastPart.split('-')[1] || ''
  }

  /**
   * Returns a JSON representation of the DocumentInfo.
   * This is useful for serialization or sending over a network.
   */
  toJSON(): object {
    return {
      path: this.path,
      dirPath: this.dirPath,
      language: this.language,
      region: this.region,
      name: this.name,
      extension: this.extension,
      openMode: this.openMode
    }
  }

  /**
   * Creates a DocumentInfo instance from a JSON object.
   * This is useful for deserializing data received from a network or storage.
   */
  static fromJSON(json: any): DocumentTranslation {
    return new DocumentTranslation({
      path: json.path,
      dirPath: json.dirPath,
      // language: json.language,
      // region: json.region,
      openMode: json.openMode
    })
  }
  // Convert Document to Tab object for navigation
  static toNavigationTab(document: DocumentTranslation | null): NavigationTab | null {
    return !document
      ? null
      : NavigationTab.fromJSON({
          // id: documentEditor.id,
          // id: uuidv4(),
          id: document.path,
          title: document.name,
          documentPath: document.path,
          documentExtension: document.extension,
          isActive: false,
          isDirty: false,
          // isSecured: document.isSecured,
          // isActive: document.isActive,
          isReadOnly: document.openMode === DocumentTranslation.OpenMode.READ,
          isLoading: false,
          lastAccessed: new Date()
        })
  }

  async getFileContent(filePath: string): Promise<string | null> {
    // const filePath = window.api.node.path.join(this.cachePath, fileName)
    // const filePath = window.api.node.path.join(this.dirPath, fileName)
    // console.log('getFile', filePath)

    if (!(await nodeApi.fsPromises.exists(filePath))) return null
    return nodeApi.fsPromises.readFile(filePath, 'utf-8')
  }

  static async loadFrom(
    translationFilePath: string,
    document: DocumentModel,
    openMode: (typeof DocumentTranslation.OpenMode)[keyof typeof DocumentTranslation.OpenMode]
  ): Promise<DocumentTranslation> {
    // ...

    return new DocumentTranslation({
      path: translationFilePath,
      dirPath: document.dirPath,
      openMode: openMode || document.openMode
    })
  }
}

// export type DocumentEditorModel = {
//   index: number
//   id: string | null | undefined
//   document: DocumentModel | null | undefined
//   isActive: boolean | null | undefined
// }

export class DocumentEditorModel {
  uuid: string // internal permanent identity
  // index: number
  id?: string | null
  document?: DocumentModel | null
  isActive?: boolean | null

  constructor(data: Partial<DocumentEditorModel> = {}) {
    // this.index = data.index ?? 0
    const documentUuid = data.document?.uuid
    this.uuid = data.uuid ?? documentUuid ?? uuidv4() // keep identity across updates
    // this.id = data.id ?? null
    this.id = documentUuid ?? data.id ?? null
    this.document = data.document ?? null
    this.isActive = data.isActive ?? null
  }

  /** 🧾 Convert instance to plain JSON object */
  toJSON(): object {
    return {
      // index: this.index,
      uuid: this.uuid,
      id: this.id,
      document: this.document.toJSON(),
      isActive: this.isActive
    }
  }

  /** 🏗️ Create an instance from a JSON object */
  static fromJSON(json: any): DocumentEditorModel {
    if (json instanceof DocumentEditorModel) return json
    const document = DocumentModel.fromJSON(json.document)
    return new DocumentEditorModel({
      // index: json.index,
      uuid: json.uuid ?? document?.uuid,
      id: document?.uuid ?? json.id,
      document,
      isActive: json.isActive
    })
  }

  /** 📜 Convert a list of DocumentEditorModel instances to a plain array of JSON objects */
  static toJSONList(list: DocumentEditorModel[]): object[] {
    return list.map((item) => item.toJSON())
  }

  /** 🏗️ Create a list of DocumentEditorModel instances from a plain array of JSON objects */
  static fromJSONList(list: any[]): DocumentEditorModel[] {
    if (!Array.isArray(list)) return []
    return list.map((json) => DocumentEditorModel.fromJSON(json))
  }

  // toJSONList

  // fromJSONList
  // }
}
