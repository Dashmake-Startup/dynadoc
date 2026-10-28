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

import {
  defaultDocumentRestrictionRules,
  type DocumentRestrictionRules
} from '../extensions/tiptap/CustomDocumentRestrictionExtension/utils/restriction.defaults'
import {
  defaultDesignPaginationOptions,
  defaultPaginationOptions,
  defaultSheetPaginationOptions,
  defaultSlidePaginationOptions,
  type PaginationPlusOptions
} from '../extensions/tiptap/utils/common.utils'
import { v4 as uuidv4 } from 'uuid'
import type { DocumentContentType } from './document.types'

export class DocumentInfo {
  uuid?: string // Unique document identity
  size?: number // Size in bytes
  mimeType?: string // e.g., 'application/pdf'
  createdAt?: Date
  updatedAt?: Date
  hash?: string // Optional: content hash like SHA256
  encoding?: string // Optional: text encoding (e.g., 'utf-8')
  createdBy?: string // Authenticated owner user id
  createdByTemp?: string // Stable device-level id for anonymous/bootstrapped docs
  author?: string
  systemInfo?: Record<string, any>
  contentType?: DocumentContentType // Native document kind (text/sheet/slide/design/form/meeting)

  constructor(params: {
    uuid?: string
    size?: number
    mimeType?: string
    createdAt?: Date
    updatedAt?: Date
    hash?: string
    encoding?: string
    createdBy?: string
    createdByTemp?: string
    author?: string
    systemInfo?: Record<string, any>
    contentType?: DocumentContentType
  }) {
    this.uuid = params.uuid
    this.size = params.size
    this.mimeType = params.mimeType
    this.createdAt = params.createdAt
    this.updatedAt = params.updatedAt
    this.hash = params.hash
    this.encoding = params.encoding
    this.createdBy = params.createdBy
    this.createdByTemp = params.createdByTemp
    this.author = params.author
    this.systemInfo = params.systemInfo
    this.contentType = params.contentType
  }
  /**
   * Returns a JSON representation of the DocumentInfo.
   * This is useful for serialization or sending over a network.
   */
  toJSON(): object {
    console.log('store. this.createdAt ', this.createdAt, this.updatedAt)
    return {
      uuid: this.uuid,
      size: this.size,
      mimeType: this.mimeType,
      createdAt: this.createdAt ? this.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: this.updatedAt ? this.updatedAt.toISOString() : new Date().toISOString(),
      hash: this.hash,
      encoding: this.encoding,
      createdBy: this.createdBy,
      createdByTemp: this.createdByTemp,
      author: this.author,
      systemInfo: this.systemInfo ?? null,
      contentType: this.contentType ?? null
    }
  }

  /**
   * Creates a DocumentInfo instance from a JSON object.
   * This is useful for deserializing data received from a network or storage.
   */
  static fromJSON(json: any): DocumentInfo {
    return new DocumentInfo({
      uuid: json.uuid,
      size: json.size,
      mimeType: json.mimeType,
      createdAt: json.createdAt ? new Date(json.createdAt) : new Date(),
      updatedAt: json.updatedAt ? new Date(json.updatedAt) : new Date(),
      hash: json.hash,
      encoding: json.encoding,
      createdBy: json.createdBy,
      createdByTemp: json.createdByTemp,
      author: json.author,
      systemInfo: json.systemInfo ?? null,
      contentType: json.contentType ?? undefined
    })
  }
}

export const defaultDocumentInfo: DocumentInfo = new DocumentInfo({
  //  size
})

export const createDefaultDocumentInfo = (): DocumentInfo =>
  new DocumentInfo({
    uuid: uuidv4()
  })

export class DocumentConfiguration {
  pagination: PaginationPlusOptions
  restrictionRules?: DocumentRestrictionRules | null
  reviewSettings?: {
    trackChangesEnabled?: boolean
    reviewerName?: string
    markupMode?: 'all' | 'simple' | 'none' | 'original'
    commentsVisible?: boolean
    grammarVisible?: boolean
    onlyShowMine?: boolean
    hideResolvedComments?: boolean
    commentsMarginOnly?: boolean
  } | null
  security?: DocumentSecurityConfiguration | null
  exports?: DocumentExportRecord[] | null
  form?: DocumentFormConfiguration | null

  // zoomLevel: number
  // activeRibbon?: keyof typeof RibbonType | null

  constructor(params: {
    pagination: PaginationPlusOptions
    restrictionRules?: DocumentRestrictionRules | null
    reviewSettings?: DocumentConfiguration['reviewSettings']
    security?: DocumentSecurityConfiguration | null
    exports?: DocumentExportRecord[] | null
    form?: DocumentFormConfiguration | null
  }) {
    this.pagination = params.pagination
    this.restrictionRules = params.restrictionRules ?? null
    this.reviewSettings = params.reviewSettings ?? null
    this.security = params.security ?? null
    this.exports = params.exports ?? null
    this.form = params.form ?? null
  }

  /**
   * Returns a JSON representation of the DocumentConfiguration.
   * Handles the Map-to-Array conversion for pagination.pagesToIgnore.
   */
  toJSON(): object {
    return {
      pagination: {
        ...this.pagination,
        // Convert Map to Array of entries for JSON safety
        pagesToIgnore: this.pagination.pagesToIgnore
          ? Array.from(this.pagination.pagesToIgnore.entries())
          : null,
        hiddenPages: this.pagination.hiddenPages ?? [],
        pageOrder: this.pagination.pageOrder ?? []
      },
      restrictionRules: this.restrictionRules,
      reviewSettings: this.reviewSettings,
      security: this.security,
      exports: this.exports ?? [],
      form: this.form ?? null
    }
  }

  /**
   * Creates a DocumentConfiguration instance from a JSON object.
   * Restores the Map for pagesToIgnore.
   */
  static fromJSON(json: any): DocumentConfiguration {
    if (!json || !json.pagination) {
      return new DocumentConfiguration({
        pagination: { ...defaultPaginationOptions },
        restrictionRules: defaultDocumentRestrictionRules,
        reviewSettings: null,
        security: null,
        exports: [],
        form: null
      })
    }
    const pagination = { ...json.pagination }

    // Restore the Map from the serialized Array entries
    if (Array.isArray(json.pagination?.pagesToIgnore)) {
      pagination.pagesToIgnore = new Map(json.pagination.pagesToIgnore)
    } else {
      pagination.pagesToIgnore = null
    }
    pagination.hiddenPages = Array.isArray(json.pagination?.hiddenPages)
      ? json.pagination.hiddenPages
      : []
    pagination.pageOrder = Array.isArray(json.pagination?.pageOrder)
      ? json.pagination.pageOrder
      : []

    return new DocumentConfiguration({
      pagination: pagination,
      restrictionRules: json.restrictionRules,
      reviewSettings: json.reviewSettings ?? null,
      security: json.security ?? null,
      exports: Array.isArray(json.exports) ? json.exports : [],
      form: json.form ?? null
    })
  }
}

export type DocumentExportRecord = {
  id: string
  format: string
  target: string
  outputPath: string
  exportedAt: string
  sourceUpdatedAt: string
  selectionOnly?: boolean
  scope?: string
}

export type EphemeralAccessLog = {
  firstReadAt?: string
  firstWriteAt?: string
  lastReadAt?: string
  lastWriteAt?: string
  readCount?: number
  writeCount?: number
}

export type EphemeralRule = {
  id: string
  enabled?: boolean
  mode: 'absolute' | 'afterCreated' | 'afterFirstRead' | 'afterFirstWrite'
  deadlineAt?: string
  durationMs?: number
  duration?: { value: number; unit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year' }
  maxReads?: number
  maxWrites?: number
  appliesTo?: { users?: string[]; groups?: string[] }
  exemptUsers?: string[]
  deleteForOwner?: boolean
  deleteOnExpire?: boolean
  ownerEmail?: string
  createdBy?: string
}

export type EphemeralAuditEntry = {
  id: string
  documentUuid?: string
  documentPath?: string
  ruleId?: string
  actor?: string
  reason?: string
  timestamp?: string
}

export type DocumentSecurityConfiguration = {
  ownerEmail?: string
  owners?: string[]
  ownerGroups?: string[]
  exemptUsers?: string[]
  auth?: {
    method?: 'none' | 'password' | '2fa' | 'biometric'
    passwordHint?: string
    require2fa?: boolean
  }
  permissions?: {
    readers?: string[]
    writers?: string[]
  }
  ephemeral?: {
    enabled?: boolean
    rules?: EphemeralRule[]
    accessLog?: Record<string, EphemeralAccessLog>
    auditLog?: EphemeralAuditEntry[]
  }
}

export type DocumentFormConfiguration = {
  requireAuth?: boolean
  deadlineAt?: string
  isOpen?: boolean
  allowAnonymous?: boolean
  oneResponsePerUser?: boolean
  maxResponses?: number
}

export const defaultDocumentConfiguration: DocumentConfiguration = new DocumentConfiguration({
  restrictionRules: defaultDocumentRestrictionRules,
  pagination: defaultPaginationOptions,
  reviewSettings: {
    trackChangesEnabled: false,
    reviewerName: 'Editor',
    markupMode: 'all',
    commentsVisible: true,
    grammarVisible: true,
    onlyShowMine: false,
    hideResolvedComments: false,
    commentsMarginOnly: false
  },
  security: {
    ownerEmail: '',
    owners: [],
    ownerGroups: [],
    exemptUsers: [],
    auth: { method: 'none', require2fa: false },
    permissions: { readers: [], writers: [] },
    ephemeral: {
      enabled: false,
      rules: [],
      accessLog: {},
      auditLog: []
    }
  },
  form: {
    requireAuth: false,
    deadlineAt: undefined,
    isOpen: true,
    allowAnonymous: true,
    oneResponsePerUser: false,
    maxResponses: undefined
  }
})

export const defaultDocumentConfigurationByType: Record<
  DocumentContentType,
  DocumentConfiguration
> = {
  text: new DocumentConfiguration({
    restrictionRules: defaultDocumentRestrictionRules,
    pagination: defaultPaginationOptions,
    reviewSettings: {
      trackChangesEnabled: false,
      reviewerName: 'Editor',
      markupMode: 'all',
      commentsVisible: true,
      grammarVisible: true,
      onlyShowMine: false,
      hideResolvedComments: false,
      commentsMarginOnly: false
    },
    security: defaultDocumentConfiguration.security,
    form: defaultDocumentConfiguration.form
  }),
  design: new DocumentConfiguration({
    restrictionRules: defaultDocumentRestrictionRules, // Designs usually don't have word counts
    pagination: defaultDesignPaginationOptions,
    reviewSettings: {
      trackChangesEnabled: false,
      reviewerName: 'Editor',
      markupMode: 'all',
      commentsVisible: true,
      grammarVisible: true,
      onlyShowMine: false,
      hideResolvedComments: false,
      commentsMarginOnly: false
    },
    security: defaultDocumentConfiguration.security,
    form: defaultDocumentConfiguration.form
    // { ...defaultPaginationOptions, enabled: false }, // Fixed single-page
  }),
  slide: new DocumentConfiguration({
    restrictionRules: defaultDocumentRestrictionRules,
    pagination: defaultSlidePaginationOptions,
    reviewSettings: {
      trackChangesEnabled: false,
      reviewerName: 'Editor',
      markupMode: 'all',
      commentsVisible: true,
      grammarVisible: true,
      onlyShowMine: false,
      hideResolvedComments: false,
      commentsMarginOnly: false
    },
    security: defaultDocumentConfiguration.security,
    form: defaultDocumentConfiguration.form
    /* { 
      ...defaultPaginationOptions, 
      pageWidth: 1920, 
      pageHeight: 1080, 
      enabled: true 
    }, */
  }),
  sheet: new DocumentConfiguration({
    restrictionRules: defaultDocumentRestrictionRules,
    pagination: defaultSheetPaginationOptions,
    reviewSettings: {
      trackChangesEnabled: false,
      reviewerName: 'Editor',
      markupMode: 'all',
      commentsVisible: true,
      grammarVisible: true,
      onlyShowMine: false,
      hideResolvedComments: false,
      commentsMarginOnly: false
    },
    security: defaultDocumentConfiguration.security,
    form: defaultDocumentConfiguration.form
    // { ...defaultPaginationOptions, enabled: false },
  }),
  form: new DocumentConfiguration({
    restrictionRules: defaultDocumentRestrictionRules,
    pagination: defaultSheetPaginationOptions,
    reviewSettings: {
      trackChangesEnabled: false,
      reviewerName: 'Editor',
      markupMode: 'all',
      commentsVisible: true,
      grammarVisible: true,
      onlyShowMine: false,
      hideResolvedComments: false,
      commentsMarginOnly: false
    },
    security: defaultDocumentConfiguration.security,
    form: defaultDocumentConfiguration.form
    // { ...defaultPaginationOptions, enabled: false },
  }),
  meeting: new DocumentConfiguration({
    restrictionRules: defaultDocumentRestrictionRules,
    pagination: defaultSheetPaginationOptions,
    reviewSettings: {
      trackChangesEnabled: false,
      reviewerName: 'Editor',
      markupMode: 'all',
      commentsVisible: true,
      grammarVisible: true,
      onlyShowMine: false,
      hideResolvedComments: false,
      commentsMarginOnly: false
    },
    security: defaultDocumentConfiguration.security,
    form: defaultDocumentConfiguration.form
    // { ...defaultPaginationOptions, enabled: false },
  })
}
