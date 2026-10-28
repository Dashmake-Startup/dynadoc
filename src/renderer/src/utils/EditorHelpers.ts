// Copyright (C) 2024 Dashmake Inc.
//
// This file is part of DDoc Office.
//
// DDoc Office is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// DDoc Office is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.

// import SelectedTextModel, {
//   selectedTextModels
// } from '../components/app/editor/wysiwyg/models/SelectedTextModel'
// import { compile } from "svelte/compiler";
import { mount } from 'svelte'
import { derived, get } from 'svelte/store'
import { _ as base_ } from 'svelte-i18n'
import toast from 'svelte-hot-french-toast'
import { _$_documentEditorsList, _$_documentEditorStorePath } from '../stores/editor.store'
import { openAlertModal } from '../stores/alertModal.store'
import { isSecureLeaseAvailable, notifySecureLeaseRequired } from '../stores/secureLease.store'
import { _$_lastSaveDirectory } from '../stores/common.store'
// import { computedVars } from '../stores/vars'
import { EditorView } from '@tiptap/pm/view'

import * as Y from 'yjs'
import { DOMParser as ProseMirrorDOMParser } from 'prosemirror-model'
// import { prosemirrorJSONToYDoc } from 'y-prosemirror'
import { EditorState } from 'prosemirror-state'
import { Node as ProseMirrorNode, Schema, DOMParser as PMDOMParser } from 'prosemirror-model'
import { prosemirrorJSONToYDoc } from 'y-prosemirror'
import Platform from '../libs/platform'

// import * as monaco from 'monaco-editor'
import * as svelte from 'svelte/compiler'
import { Parser } from 'htmlparser2'

import { CustomUuidIdentificationExtension } from '../extensions/tiptap/CustomUuidIdentificationExtension'
import {
  DocumentEditorModel,
  DocumentModel,
  type DocumentContentKindType,
  type DocumentContentType
} from '../models/Document'
import Utils from './Utils'
import SecurityHelpers from './SecurityHelpers'
// import { CustomProgrammingStyleCommentExtension } from '../extensions/tiptap/CustomProgrammingStyleCommentExtension/CustomProgrammingStyleCommentExtension';
// import { CustomSecuredContentExtension } from '../extensions/tiptap/CustomSecuredContentExtension/CustomSecuredContentExtension';
import { CustomFormFieldExtensionUtils } from '../extensions/tiptap/CustomFormFieldExtension/utils/utils'
import { CustomVarExtensionProps } from '../extensions/tiptap/CustomVarExtension/utils/common.utils'
import {
  CustomFileExtensionProps,
  CustomFolderExtensionProps
} from '../extensions/tiptap/CustomFileFolderExtension/utils/common.utils'
import { CustomSecuredContentExtensionProps } from '../extensions/tiptap/CustomSecuredContentExtension/utils/common.utils'
import { CustomProgrammingStyleCommentExtensionProps } from '../extensions/tiptap/CustomProgrammingStyleCommentExtension/utils/common.utils'
import { nodeApi } from './shims/node'
import { isFileUnreadable } from './unreadableFiles'
import { CustomLatexProjectExtensionProps } from '../extensions/tiptap/CustomLatexProjectExtension/utils/common.utils'
import { CustomSpreadsheetExtensionProps } from '../extensions/tiptap/CustomSpreadsheetExtension/utils/common.utils'
import { CustomSlideExtensionProps } from '../extensions/tiptap/CustomSlideExtension/utils/common.utils'
import { CustomDesignExtensionProps } from '../extensions/tiptap/CustomDesignExtension/utils/common.utils'
import { CustomMermaidExtensionProps } from '../extensions/tiptap/CustomMermaidExtension/utils/common.utils'
import { CustomSurveyExtensionProps } from '../extensions/tiptap/CustomSurveyExtension/utils/common.utils'
import { CustomChartExtensionProps } from '../extensions/tiptap/CustomChartExtension/utils/common.utils'
import { CustomGalleryExtensionProps } from '../extensions/tiptap/CustomGalleryExtension/utils/common.utils'
import {
  convertDocxFileToHtml,
  convertHtmlFileToDocx
} from '../services/conversion/officeConversion.service'
import { readStoreValue, SAVE_FORMATS } from '../services/save/savePipeline.service'
import { toAssetUrl } from './assetUrl'
// import { _$_currentView } from '../stores/common.store';
// import { CustomFormFieldExtension } from '../extensions/tiptap/CustomFormFieldExtension/CustomFormFieldExtension.svelte';
// import { CustomFileTagExtension, CustomFolderTagExtension } from '../extensions/tiptap/CustomFileFolderExtension/CustomFileFolderExtension.svelte';
// import { CustomVarExtension } from '../extensions/tiptap/CustomVarExtension/CustomVarExtension.svelte';

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

const t = (key: string, options?: any) => get(base_)(key, options)

export type DocumentStats = {
  characters: number
  words: number
  paragraphs: number
  sentences: number
  headings: number
  lists: number
  codeBlocks: number
  tables: number
  images: number
  videos: number
  totalHeight: number
  pageHeight: number
  pageCount: number
  averageWordsPerPage: number
  averageCharsPerPage: number
  columns?: number
  lastComputedAt?: Date
}
export interface ComputeDocumentStatsOptions {
  pageHeight?: number
  columns?: number
  paragraphsPerPage?: number
}

export type UniqueNameOptions = {
  baseName: string
  parentDir: string
  extension?: string // ".txt", ".ddoc" (files only)
  separator?: string // " ", "-", "_"
  copyStyle?: string // "Copy of X", "Copy of X 2"
  sanitize?: boolean // remove invalid filename chars
}

export default class EditorHelpers {
  static safeCwd() {
    try {
      if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
        return process.cwd()
      }
    } catch {
      // ignore
    }
    try {
      const cwd = (window as any)?.api?.node?.process?.cwd
      if (typeof cwd === 'function') return cwd()
    } catch {
      // ignore
    }
    return '/'
  }

  public static uuidAttributeName = 'uuid'
  public static dataUuidAttributeName = `data-${EditorHelpers.uuidAttributeName}`
  public static varTagDataCodeAttributeName = 'data-code'
  public static varTagDataValueAttributeName = 'data-value'
  public static varTagName = 'var'
  // public static pageTagName = 'page'
  public static pdfTagName = Utils.FILE_TYPES.pdf
  public static psdTagName = 'psd'
  public static allowedCustomInlineTags = []
  // public static allowedCustomInlineTags = [EditorHelpers.pageTagName]
  // public static allowedCustomInlineTags = [EditorHelpers.varTagName, EditorHelpers.pageTagName]
  public static allowedCustomBlockTags = [
    // EditorHelpers.pageTagName,
    // EditorHelpers.pdfTagName,
    // EditorHelpers.psdTagName,
    'iframe',
    'canvas',
    'latex-project'
    // 'table',
    // 'tr',
    // 'td'
  ]
  public static bubbleNotAllowedTags = [
    'img',
    'image',
    CustomProgrammingStyleCommentExtensionProps.name,
    CustomSecuredContentExtensionProps.name,
    CustomFormFieldExtensionUtils.extensionName,
    CustomFolderExtensionProps.name,
    CustomFileExtensionProps.name,
    CustomVarExtensionProps.name,
    CustomLatexProjectExtensionProps.name,
    CustomLatexProjectExtensionProps.name,
    CustomSpreadsheetExtensionProps.name,
    CustomSlideExtensionProps.name,
    CustomDesignExtensionProps.name,
    CustomMermaidExtensionProps.name,
    CustomSurveyExtensionProps.name,
    CustomChartExtensionProps.name,
    CustomGalleryExtensionProps.name
    // 'latex-project'
  ]
  public static allowedCustomSelfClosingTags = []
  public static allowedEditableTags = [EditorHelpers.varTagName]
  public static allowedCustomTags = [
    ...EditorHelpers.allowedCustomInlineTags,
    ...EditorHelpers.allowedCustomBlockTags,
    ...EditorHelpers.allowedCustomSelfClosingTags
  ]
  public static allowedCustomTagAttributes = [
    EditorHelpers.varTagDataCodeAttributeName,
    EditorHelpers.varTagDataValueAttributeName
  ]

  private static normalizePathForPlatform(inputPath: string): string {
    const raw = typeof inputPath === 'string' ? inputPath : String(inputPath ?? '')
    if (Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop) return raw
    return raw.replace(/^file:\/\//i, '').replace(/^\/+/, '')
  }

  // DELETE later no needed again
  public static async ensureDocumentMarkerInCache(cachePath: string, uuid?: string): Promise<void> {
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

    const normalizedCachePath = EditorHelpers.normalizePathForPlatform(cachePath)
    const markerPath = nodeApi.path.join(normalizedCachePath, `.${markerId}`)
    if (!(await nodeApi.fsPromises.exists(markerPath))) {
      await EditorHelpers.writeFileEnsuringDirAsync(markerPath, markerId, 'utf-8')
    }
  }

  public static async syncDocumentEditorToCloud(editor: DocumentEditorModel | null | undefined) {
    if (!editor?.document?.cachePath) {
      await openAlertModal({
        title: 'Sync to Cloud',
        message: 'No active document cache path found.'
      })
      return { ok: false }
    }

    try {
      await EditorHelpers.ensureDocumentMarkerInCache(
        editor.document.cachePath,
        editor.document.uuid
      )

      let cacheRoot = ''
      try {
        cacheRoot = await window.api.getCacheDir()
      } catch {
        cacheRoot = ''
      }
      const result = await (window as any)?.server?.sync?.commit?.({
        cachePath: editor.document.cachePath,
        cacheRoot
      })

      if (!result?.ok) {
        await openAlertModal({
          title: 'Sync to Cloud',
          message: result?.message || 'Sync failed.'
        })
        return result
      }

      const synced = result?.data?.synced ?? result?.synced ?? 0
      const total = result?.data?.total ?? result?.total ?? 0
      const summary = `Synced ${synced}/${total} files.`
      await openAlertModal({
        title: 'Sync to Cloud',
        message: summary
      })

      return result
    } catch (error: any) {
      await openAlertModal({
        title: 'Sync to Cloud',
        message: error?.message || 'Sync failed.'
      })
      return { ok: false, message: error?.message || 'Sync failed.' }
    }
  }

  public static pathToDomId2(path: string, prefix = ''): string {
    // return path
    let hash = 0
    for (let i = 0; i < path.length; i++) {
      hash = (hash << 5) - hash + path.charCodeAt(i)
      hash |= 0
    }
    return `${prefix}${Math.abs(hash)}`
  }
  public static pathToDomId(path: string, prefix = ''): string {
    if (!path) return prefix

    // 1. Check if it's a "real path": contains slashes or dots.
    // If it doesn't have these, we treat it as a "non-real" path (likely already an ID).
    const isPath = /[\/\\.]/.test(path)

    if (!isPath) {
      // Return as-is, but replace non-ID-friendly characters (spaces, etc.) with underscores
      const sanitized = path.replace(/[^a-zA-Z0-9-_]/g, '_')
      return `${prefix}${sanitized}`
    }

    // 2. Fallback to hashing for actual file paths to ensure a valid, short DOM ID
    let hash = 0
    for (let i = 0; i < path.length; i++) {
      hash = (hash << 5) - hash + path.charCodeAt(i)
      hash |= 0 // Convert to 32bit integer
    }

    return `${prefix}${Math.abs(hash)}`
  }

  // generateUniqueName was here, and it is gone rather than converted.
  //
  // It read a directory synchronously to find a free name, which is one of
  // the calls SPEC-001 moves onto the IPC surface. Converting it would have
  // meant propagating async through its callers -- except it has none.
  // generateUniqueNameAsync below is the same function, already asynchronous,
  // and every live caller uses that one: three in extensions/tiptap/utils,
  // two in models/Document.ts, one in utils/documentAssetImport.ts. The
  // synchronous twin had no reference anywhere in the repository.

  public static async generateUniqueNameAsync({
    baseName,
    parentDir,
    extension = '',
    separator = ' ',
    copyStyle = null,
    sanitize = true
  }: UniqueNameOptions): Promise<string> {
    const rawBase = typeof baseName === 'string' ? baseName : String(baseName ?? '')
    let safeBase = sanitize ? rawBase.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim() : rawBase

    if (!safeBase) safeBase = 'Untitled'

    let existing: string[] = []
    try {
      const normalizedParent = EditorHelpers.normalizePathForPlatform(parentDir)
      existing = await nodeApi.fsPromises.readdir(normalizedParent)
    } catch {
      const normalizedParent = EditorHelpers.normalizePathForPlatform(parentDir)
      await nodeApi.fsPromises.mkdir(normalizedParent, { recursive: true })
    }

    const escaped = safeBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const numberRegex = copyStyle
      ? new RegExp(`^${copyStyle} ${escaped}(?:${separator}(\\d+))?${extension}$`)
      : new RegExp(`^${escaped}(?:${separator}(\\d+))?${extension}$`)

    let maxIndex = 0
    for (const name of existing) {
      const candidate = typeof name === 'string' ? name : String(name ?? '')
      const match = candidate.match(numberRegex)
      if (!match) continue
      const num = match[1] ? parseInt(match[1], 10) : 1
      if (num > maxIndex) maxIndex = num
    }

    if (maxIndex === 0) {
      return copyStyle ? `${copyStyle} ${safeBase}${extension}` : `${safeBase}${extension}`
    }

    return copyStyle
      ? `${copyStyle} ${safeBase}${separator}${maxIndex + 1}${extension}`
      : `${safeBase}${separator}${maxIndex + 1}${extension}`
  }

  public static startsWithOperator(str) {
    // Define a regular expression to match strings that start with an operator
    const operatorRegex = /^[+\-*/%]/

    // Test if the string matches the regular expression
    return operatorRegex.test(str)
  }

  public static removeOperators(str) {
    // Define the regular expression to match the operators
    const operatorRegex = /[+\-*/%]/g

    // Replace the operators with an empty string
    const result = str.replace(operatorRegex, '')

    return result
  }

  // Function to check if a string is an operator
  public static isOperator(char) {
    const operators = new Set(['+', '-', '*', '/', '%', '^', '(', ')'])
    return operators.has(char)
  }

  public static extractKeys(str) {
    // Regular expression to match keys within _var['key'] pattern
    const regex = /_var\['([^']+)'\]/g
    let match
    const keys = []

    // Use the regex to find all matches
    while ((match = regex.exec(str)) !== null) {
      keys.push(match[1])
    }

    return keys
  }

  public static transformExpression(expression) {
    // Regular expression to match _var['key'] or _var["key"] patterns
    const regex = /_var\['([^']*)'\]|_var\["([^"]*)"\]/g

    // Replace _var['key'] or _var["key"] with key
    return expression.replace(regex, (match, singleQuoteKey, doubleQuoteKey) => {
      // Return the captured key based on which group is not undefined
      return singleQuoteKey || doubleQuoteKey
    })
    // Replace _var['key'] with key
    // return expression.replace(regex, (_, key) => key)

    // Example usage
    // const example = "_var['key'] * _var['key2'] - _var['key3'] / _var['key4']"
    // const result = transformExpression(example)
    // console.log(result) // Output: "key * key2 - key3 / key4"
  }

  public static extractStylesAndBody(html: string) {
    let styles: string[] = []
    let externalStyles: string[] = []
    let bodyContent = ''
    let insideBody = false
    let insideStyle = false
    let currentStyle = ''

    const parser = new Parser(
      {
        onopentag(name, attribs) {
          if (name === 'style') {
            insideStyle = true
            currentStyle = ''
          } else if (
            name === 'link' &&
            attribs.rel?.toLowerCase() === 'stylesheet' &&
            attribs.href
          ) {
            externalStyles.push(attribs.href)
          } else if (name === 'body') {
            insideBody = true
          }
        },
        ontext(text) {
          if (insideStyle) {
            currentStyle += text
          } else if (insideBody) {
            bodyContent += text
          }
        },
        onclosetag(name) {
          if (name === 'style') {
            styles.push(currentStyle)
            insideStyle = false
          } else if (name === 'body') {
            insideBody = false
          }
        }
      },
      { decodeEntities: true }
    )

    parser.write(html)
    parser.end()

    return {
      inlineStyles: styles.join('\n'),
      externalStyles,
      bodyContent
    }
  }

  /* public static  SanitizeOptions {
  removeScriptTags?: boolean;               // Remove <script>...</script>
  removeInlineJS?: boolean;                 // Remove onclick="", onload="", etc.
  removeJSUrls?: boolean;                   // Remove href="javascript:..."
  allowedTags?: string[];                   // Whitelist (remove any tag not in this list)
}
 */

  /**
   * Sanitize HTML string:
   *  - Remove <script>...</script> blocks
   *  - Remove inline JS event handlers (onclick, onload, etc.)
   *  - Remove javascript: URLs
   *  - Optional: Remove any inline JS code inside elements
   */
  public static sanitizeHtml(
    html: string,
    options: {
      removeScriptTags?: boolean // Remove <script>...</script>
      removeInlineJS?: boolean // Remove onclick="", onload="", etc.
      removeJSUrls?: boolean // Remove href="javascript:..."
      allowedTags?: string[] // Whitelist (remove any tag not in this list)
    } = {}
  ): string {
    if (!html) {
      return ''
    }
    let result = html

    const {
      removeScriptTags = true,
      removeInlineJS = true,
      removeJSUrls = true,
      allowedTags = null
    } = options

    // 1️⃣ Remove <script>...</script>
    if (removeScriptTags) {
      result = result.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    }

    // 2️⃣ Remove inline JS/event handlers like onclick="...", onload='...', etc.
    if (removeInlineJS) {
      result = result.replace(/\s+on\w+="[^"]*"/gi, '')
      result = result.replace(/\s+on\w+='[^']*'/gi, '')
    }

    // 3️⃣ Remove javascript: URLs in href or src
    if (removeJSUrls) {
      result = result.replace(/\s+(href|src)\s*=\s*"(javascript:[^"]*)"/gi, `$1=""`)
      result = result.replace(/\s+(href|src)\s*=\s*'(javascript:[^']*)'/gi, `$1=''`)
    }

    // 4️⃣ Remove tags not in allowedTags whitelist
    if (allowedTags && allowedTags.length > 0) {
      const allowed = allowedTags.map((t) => t.toLowerCase())

      result = result.replace(/<\/?([a-zA-Z0-9-]+)(\s[^>]*)?>/g, (full, tagName) => {
        return allowed.includes(tagName.toLowerCase()) ? full : ''
      })
    }

    console.log('sanitizeHtml', { result, html })

    return result
  }

  /**
   * Compute detailed statistics about a Tiptap/ProseMirror document.
   * Works with both textual and rendered DOM metrics.
   */
  public static computeDocumentStats22(
    view: EditorView,
    options: ComputeDocumentStatsOptions = {}
  ): DocumentStats {
    const {
      pageHeight = 1123, // px (A4)
      columns = 1
    } = options

    const doc = view.state.doc
    const textContent = doc.textBetween(0, doc.content.size, ' ')
    const contentEl = view.dom as HTMLElement

    // ---- Textual stats ----
    const characters = textContent.length
    const words = (textContent.match(/\b\S+\b/g) || []).length

    // Count paragraphs as block nodes or text separated by double newlines
    const paragraphs =
      (doc.content.content as any[]).filter((n) => n.type.name === 'paragraph').length ||
      textContent.split(/\n{2,}/g).length

    // ---- Layout / Visual stats ----
    // const totalHeight =
    //   (contentEl.scrollHeight || contentEl.offsetHeight || 0)

    // ---- Layout / Visual stats ----
    let totalHeight = 0
    try {
      const rect = contentEl.getBoundingClientRect()
      totalHeight = rect.height
    } catch (e) {
      console.warn('Failed to compute layout height:', e)
      totalHeight = 0
    }

    const pageCount = Math.max(1, Math.ceil(totalHeight / pageHeight))

    // ---- Derived metrics ----
    const averageWordsPerPage = Math.round(words / pageCount)
    const averageCharsPerPage = Math.round(characters / pageCount)

    // ---- Return comprehensive stats ----
    const stats: DocumentStats = {
      characters,
      words,
      paragraphs,
      totalHeight,
      pageHeight,
      pageCount,
      averageWordsPerPage,
      averageCharsPerPage,
      columns,
      lastComputedAt: new Date()
    }

    return stats
  }

  /**
   * Compute detailed statistics about a Tiptap/ProseMirror document.
   * Includes textual counts, layout metrics, and node-specific stats.
   */
  public static computeDocumentStats(
    view: EditorView,
    options: ComputeDocumentStatsOptions = {}
  ): DocumentStats {
    const {
      pageHeight = 1123, // px (A4)
      columns = 1,
      paragraphsPerPage = 30 // fallback when visual layout not available
    } = options

    const doc = view.state.doc
    const contentEl = view.dom as HTMLElement

    // ---- Initialize stats ----
    const stats: any = {
      characters: 0,
      words: 0,
      sentences: 0,
      paragraphs: 0,
      headings: 0,
      lists: 0,
      codeBlocks: 0,
      tables: 0,
      images: 0,
      videos: 0,
      pages: 0
    }

    // ---- Node-based scan ----
    doc.descendants((node) => {
      if (node.isText) {
        const text = node.text || ''
        stats.characters += text.length
        stats.words += text.split(/\s+/).filter(Boolean).length
        stats.sentences += text.split(/[.!?]+/).filter(Boolean).length
      }

      switch (node.type.name) {
        case 'paragraph':
          stats.paragraphs++
          stats.pages = Math.ceil(stats.paragraphs / paragraphsPerPage)
          break
        case 'heading':
          stats.headings++
          break
        case 'bulletList':
        case 'orderedList':
          stats.lists++
          break
        case 'codeBlock':
          stats.codeBlocks++
          break
        case 'table':
        case 'image':
        case 'video':
          stats[`${node.type.name}s`] = (stats[`${node.type.name}s`] || 0) + 1
          break
      }
    })

    // ---- Layout / Visual stats ----
    let totalHeight = 0
    try {
      const rect = contentEl.getBoundingClientRect()
      totalHeight = rect.height
    } catch (e) {
      console.warn('Failed to compute layout height:', e)
    }

    const pageCount = totalHeight
      ? Math.max(1, Math.ceil(totalHeight / pageHeight))
      : Math.max(1, stats.pages)

    // ---- Derived metrics ----
    const averageWordsPerPage = Math.round(stats.words / pageCount)
    const averageCharsPerPage = Math.round(stats.characters / pageCount)

    // ---- Return stats ----
    const finalStats: DocumentStats = {
      characters: stats.characters,
      words: stats.words,
      sentences: stats.sentences,
      paragraphs: stats.paragraphs,
      headings: stats.headings,
      lists: stats.lists,
      codeBlocks: stats.codeBlocks,
      tables: stats.tables,
      images: stats.images,
      videos: stats.videos,
      totalHeight,
      pageHeight,
      pageCount,
      averageWordsPerPage,
      averageCharsPerPage,
      columns,
      lastComputedAt: new Date()
    }
    console.log('finalStats :', finalStats)
    return finalStats
  }

  public static getSafeCode(code: string) {
    // remove <!DOCTYPE html> if any
    // code = code.replace(/<!DOCTYPE[^>]*>/i, '').trim()
    return code
  }

  public static async bundleSvelteOutput(sourceCode) {
    // sourceCode = `import 'svelte/runtime';\n` + sourceCode;

    console.log('ESBUILD BUNDLING runtime:', sourceCode)
    try {
      const result = await window.api.rollupBundle(sourceCode)
      // const result = await window.api.esbuildBundle(sourceCode)

      /* await esbuild.build({
        // Use stdin to pass the source code string directly to esbuild
        stdin: {
          contents: sourceCode,
          resolveDir: EditorHelpers.safeCwd(), // Resolve modules relative to the current working directory
          loader: 'js',
        },
        bundle: true,        // CRITICAL: Tells esbuild to resolve and combine all imports
        format: 'esm',       // CRITICAL: Output as a standard ES Module (for browser dynamic import)
        platform: 'browser', // CRITICAL: Target browser runtime
        write: false,        // Don't write to disk, return the output object
        outdir: 'out',       // Required even with write: false
        logLevel: 'silent',  // Keep console clean
      }); */
      console.log('ESBUILD BUNDLING result:', result)
      // The bundled code is in the 'outputFiles' array
      if (result.outputFiles.length > 0) {
        return result.outputFiles[0].text
      }

      throw new Error('Esbuild bundling failed to produce output.')
    } catch (error) {
      console.error('ESBUILD BUNDLING ERROR:', error.message)
      return null
    }
  }

  /**
   * Bundles multiple JS/CSS entry points in memory using esbuild.
   *
   * @param {Object} entries - An object mapping entry names to code strings, e.g.
   *   { test: 'const a = 1;', internal: 'const b = 2;' }
   * @param {Object} options - Optional settings
   *   { minify: true, sourcemap: true, target: ['es2020'] }
   */
  /* public static async  bundleInMemory(entries, options = {}) {
    const outputFiles = [];
  
    for (const [entryName, code] of Object.entries(entries)) {
      const isCSS = entryName.endsWith('.css');
  
      const result = await esbuild.build({
        stdin: {
          contents: code,
          resolveDir: EditorHelpers.safeCwd(),
          sourcefile: entryName,
          loader: isCSS ? 'css' : 'js',
        },
        bundle: true,
        minify: options.minify ?? true,
        sourcemap: options.sourcemap ?? true,
        format: 'esm',
        target: options.target ?? ['es2020'],
        write: false, // important for in-memory
        splitting: true, // allow ESM splitting if multiple entry points
        outdir: '/',    // virtual, ignored with write: false
      });
  
      result.outputFiles.forEach(f => {
        outputFiles.push({
          path: f.path,
          contents: f.text,
        });
      });
    }
  
    return outputFiles;
  } */

  // --------------------- Example usage ---------------------
  /* (async () => {
    const compiledEntries = {
      'test.js': `
        import { add } from './internal.js';
        console.log(add(2,3));
      `,
      'internal.js': `
        export function add(a,b) { return a+b; }
      `,
      'style.css': `
        body { background: #f0f0f0; }
      `
    };
  
    const output = await bundleInMemory(compiledEntries, { minify: true });
  
    for (const file of output) {
      console.log('====', file.path, '====');
      console.log(file.contents);
    }
  })(); */

  public static async mountDynamicSvelteComponent(bundledCode: string, target: HTMLElement) {
    // Create a Blob URL for the compiled Svelte module
    // bundledCode = `import 'svelte/runtime';\n` + bundledCode;
    // ensure runtime is globally available
    // Ensure Svelte internals exist globally for the blob module
    // if (!globalThis.__svelte) {
    //   globalThis.__svelte = {  };
    // }
    console.log('Svelte runtime component loaded:', bundledCode)

    // Compile into an evaluable JS module
    // const module = svelte.compileModule(source, { css: 'injected' })

    // Run module (provides default export as the component)
    // const exports = run(module.js.code)
    // const Component = exports.default
    // return  Component

    const blob = new Blob([bundledCode], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)

    // try {
    // Dynamically import the compiled Svelte component
    const { default: NewComponent } = await import(/* @vite-ignore */ url)

    // const codeString = `export default class Test { /* compiled Svelte JS here */ }`;
    // mountSvelteComponent(codeString, document.getElementById('app'));

    // const module = await import(url);
    // const NewComponent = module.default;   // compiled Svelte component class

    // Dynamically import the module
    // const module = await import(url);
    // const NewComponent = module.default;

    // Get container element
    // const target = document.getElementById(`domCompiledSvelteCode-${parentContainerKey}`);
    if (!target) {
      console.error(`❌ Target element ${target} not found`)
      return
    }

    // Remove previous content if needed
    target.innerHTML = ''

    // Mount the Svelte 5 component
    /* const instance = mount(NewComponent, {
      target,
      // optional props or event handlers
      props: {},
      events: {
        click: (e) => console.log('Component clicked:', e),
      },
    }); */

    mount(NewComponent, { target })
    // const instance = mount(NewComponent, { target });
    console.log('✅ Mounted Svelte 5 component dynamically:')
    // console.log('✅ Mounted Svelte 5 component dynamically:', instance);

    // Revoke blob URL when unmounted
    // instance.$$.on_destroy.push(() => URL.revokeObjectURL(url));

    // console.log('✅ Mounted Svelte component dynamically:', instance);
    // return instance;

    /* } catch (error) {
      console.error('❌ Error mounting compiled Svelte component:', error);
    } finally {
      // Clean up blob URL
      URL.revokeObjectURL(url);
    } */
  }

  /**
   * Converts a plain object into JS statements that populate _var and window._var
   */
  public static generateVarAssignments(vars) {
    // Map keys to safe camelCase identifiers
    /*  const varMap: Record<string, string> = {};
     const safeVars: Record<string, any> = {};
   
     Object.keys(_var).forEach(key => {
       // Convert to camelCase / snake_case
       const safeKey = key
         .replace(/[^a-zA-Z0-9]/g, '_')       // replace invalid chars with _
         .replace(/_+/g, '_')                 // collapse multiple _
         .replace(/^_|_$/g, '')               // remove leading/trailing _
       varMap[key] = safeKey;
       safeVars[safeKey] = _var[key];         // assign value to safe key
     });
   
     // Expose globally if needed
     if (typeof window !== 'undefined') {
       window._var = _var;
       window.safeVars = safeVars;
       window.varMap = varMap;
     } */

    let code = 'let _var = {};\nwindow._var = _var;\n'
    for (const key in vars) {
      const value = vars[key]
      // If value is a string, wrap in quotes, else leave as-is
      const formattedValue = typeof value === 'string' ? JSON.stringify(value) : value
      code += `_var[${JSON.stringify(key)}] = ${formattedValue};\n`
    }
    return code
  }

  /**
   * Reactive compiled code store.
   * @param {string} templateCode - The Svelte template to compile dynamically.
   * @returns {import('svelte/store').Readable<{js: string, css: string}>}
   */
  public static createReactiveCompileStore(computedVars, templateCode) {
    console.log('createReactiveCompileStore Compiled JS updated:', templateCode)
    // return derived(computedVars, ($computedVars) => {
    // Inject current vars into code
    const varAssignments = EditorHelpers.generateVarAssignments(get(computedVars))
    // const varAssignments = EditorHelpers.generateVarAssignments($computedVars)

    /* const codeWithVars = `
      <script>
        ${varAssignments}
      </script>
      ${templateCode}` */

    /* const codeWithVars = `
    
    <script>
    import { writable } from "svelte/store";
  
  const count = writable(0);
  
  let name ="World";
  </script>
  
  <h1>Hello {name}!</h1>
  
  <lable>Your Name</lable>
  <input type="text" bind:value={name}>
  <br>
  <p>
  <button on:click={()=> $count+=1}>Add</button>
  <button on:click={()=> $count-=1}>Sub</button>
  </p>
  
    ` */
    const codeWithVars = `<h1>Hello World!</h1>`
    // const codeWithVars = templateCode

    /* const codeWithVars = `
      <script>
  
  let _var = {}
  window._var = _var 
   
  _var['cout_h_j'] = 1700
  _var['jour'] = 30
  _var["ceci,est Un TEST"] = _var['cout_h_j'] * _var['jour'] + 2
  
  
  
  const jour = 20;
    window.jour = jour 
  
  
  const ceci_est_un_TEST = _var["ceci, est Un TEST"];
  </script>
  
  <p>
  <var data-value="{jour}" data-code="jour" class="brackets"></var>
  <var data-value={jour} data-code="jour" class="brackets"></var>
  </p>
  
  ${templateCode}
  ` */
    /*  const codeWithVars = `
     <script>
   // Declare your variable
   const _var = {
     "cout_h_j": 1700,
     "jour": 30,
     "ceci est Un TEST": 51002
   }
   
   // Expose globally in a safe reactive block
   $: {
     if (typeof window !== 'undefined') {
       window._var = _var
     }
   }
  </script>
     ${templateCode}
   
     ` */

    /* const codeWithVars = `
    <script>
      const _var = ${JSON.stringify($computedVars)};
    </script>
    ${templateCode}
  ` */
    console.log('createReactiveCompileStore codeWithVars:', codeWithVars)

    // Compile Svelte code
    // const { js, css } = svelte.compile(templateCode, {})
    // const { js } = svelte.compile(svelteCode, { generate: 'ssr' });
    // const { js, css } = svelte.compile(codeWithVars, { generate: 'client' })
    // const { js, css } = svelte.compile(codeWithVars, { generate: 'server' })
    // const { js, css } = svelte.compile(codeWithVars, { generate: 'server' })
    const { js, css } = svelte.compile(codeWithVars, {})
    /* const { js, css } = svelte.compile(codeWithVars, {
      name: 'NewComponent', compatibility: {
        componentApi: 4,
      },
    }) */
    // const { js, css } = svelte.compileModule(codeWithVars, { generate: 'server' })
    // const { js, css } = svelte.compileModule(codeWithVars, {})
    // const { js, css } = svelte.compile(codeWithVars, {})

    return { js, css }
    // })
  }

  public static async compileSvelteCode(
    computedVars,
    code: string,
    parentContainerKey: string
  ): Promise<{ preProcessedCode: string; postProcessedCode: string }> {
    console.log('compilingSvelteCode ---')
    // console.log('svelte.compile getSafeCode ', code)
    code = this.getSafeCode(code)
    // var preProcessedCode = this.preProcessSvelteCodeToCompile(code, parentContainerKey)
    var preProcessedCode = (code = this.preProcessSvelteCodeToCompile(code, parentContainerKey))
    /* try {
      const sveltePath = require.resolve('svelte')
      console.log(`Svelte is located at: ${sveltePath}`)
    } catch (error) {
      console.error('Svelte is not installed.')
    } */
    // console.log('svelte.compile before ', preProcessedCode)

    // Silently Fix invalid DOM trees like tables without tbody...
    code = EditorHelpers.fixInvalidTables(code)

    // Compile the Svelte code
    // const { js, css } = compile(code, {}
    console.log('svelte.compile fixInvalidTables', code)

    // Create a reactive compiled store
    /* const compiledTemplate = EditorHelpers.createReactiveCompileStore(computedVars, code)

    // Subscribe to compiled code reactively
    compiledTemplate.subscribe(({ js, css }) => {
      console.log('Compiled JS updated:', js?.code ?? js)
      console.log('Compiled CSS:', css?.code ?? css)
      // You can now dynamically load JS in your Electron renderer
    }) */
    // const { js, css } = EditorHelpers.createReactiveCompileStore(computedVars, code)

    // const { js, css } = svelte.compile(code, {}
    /* {
    // sveltePath: nodeApi.path.resolve(__dirname, 'node_modules/svelte/src/runtime')
    sveltePath:
      // './test/svelte/src/runtime'
      'https://unpkg.com/svelte@4.2.18/src/runtime'
    // '/path/to/dynadoc/node_modules/svelte/src/runtime'
  } */
    // )
    // console.error('svelte.compile after', js, css)
    /* console.log('svelte.compile jus after', js.code)

    // Apply CSS if any
    if (css && css.code) {
      const style = document.createElement('style')
      style.textContent = css.code
      document.head.appendChild(style)
    } */

    // Replace local Svelte imports with URLs

    // console.log(js.code)
    // console.log(vars)

    // let modifiedCode = js.code.replace(/from 'svelte\//g, "from 'https://cdn.jsdelivr.net/npm/svelte@latest/");
    /* let modifiedCode = js.code.replace(
      /from 'svelte\//g,
      "from 'https://cdn.jsdelivr.net/npm/svelte@latest/"
    ) */

    console.log('svelte.compile --- Starting Svelte 5 Output Bundling ---')
    console.log(
      "svelte.compile Input code contains unresolved imports (e.g., 'svelte/internal/client')."
    )

    // const sourceWithRuntime = `import * as svelte from 'svelte/internal/client';\n${js.code}`;
    // const bundledCode = await EditorHelpers.bundleSvelteOutput(sourceWithRuntime);

    const bundledCode = await EditorHelpers.bundleSvelteOutput(code)

    // const bundledCode = await EditorHelpers.bundleSvelteOutput(js.code);
    // const bundledCode = await EditorHelpers.bundleSvelteOutput(js.code);

    console.log('svelte.compile after', bundledCode, code)
    // console.log('svelte.compile after', bundledCode, js.code)

    const compiledSvelteComponentContainer = document.getElementById(
      'domCompiledSvelteCode-' + parentContainerKey
    )
    // Dynamically load the compiled component
    EditorHelpers.mountDynamicSvelteComponent(bundledCode, compiledSvelteComponentContainer)
    /* const blob = new Blob([bundledCode], { type: 'application/javascript' })
    // const blob = new Blob([js.code], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    const { default: NewComponent } = await import(url)
    const compiledSvelteComponentContainer = document.getElementById(
      'domCompiledSvelteCode-' + parentContainerKey
    )
    URL.revokeObjectURL(url)

    // Remove the existing component if it exists
    // if (_component) {
    //   _component.$destroy()
    // }

    // document.getElementById('_domWysiwygEditor').innerHTML = ""

    // Create and mount the new component
    const component = new NewComponent({
      // _component = new NewComponent({
      target:
        // _domWysiwygEditor
        // document.getElementById('domCompiledSvelteCode-' + parentContainerKey)
        compiledSvelteComponentContainer
      // compiledSvelteComponentContainer
    }) */
    // console.log('domCompiledSvelteCode ---', compiledSvelteComponentContainer.innerHTML)

    // _editorContent = compiledSvelteComponentContainer.innerHTML

    var postProcessedCode = this.postProcessCompiledSvelteCode(parentContainerKey)

    return { preProcessedCode, postProcessedCode }
    // Create a new container element to hold the component
    /* const container = document.createElement('div')
  
    // Mount the new component inside the container
    const newComponent = new NewComponent({
      target: container
    })
  
    // _editorContent = container.innerHTML
  
    // Remove the existing content from the domCompiledSvelteCode element
    // const outputElement = document.getElementById('domCompiledSvelteCode')
    const outputElement = document.getElementById('domWysiwygEditor')
    outputElement.innerHTML = ''
  
    // Append the new component container to the domCompiledSvelteCode element
    // outputElement.innerHTML = container.innerHTML
    outputElement.appendChild(container) */

    // _editorContent = document.getElementById('domCompiledSvelteCode').innerHTML

    // Create a new component constructor function
    // const _componentConstructor = new Function(`${compiledCode}; return _component;`)()

    // errorMessage = ''
  }

  public static preProcessSvelteCodeToCompile(code: string, parentContainerKey: string): string {
    var preProcessedCode = EditorHelpers.replaceSvelteExpressionsByHtmlTags(code)
    // var preProcessedCode = EditorHelpers.replaceSvelteExpressionsByHtmlTags(code)

    // domWysiwygEditorCompiledCode = changed
    // document.getElementById('domWysiwygEditorCompiledCode').innerHTML = domWysiwygEditorCompiledCode
    document.getElementById('domWysiwygEditorCompiledCode-' + parentContainerKey).innerHTML =
      preProcessedCode
    return preProcessedCode

    // console.log(changed)

    // console.log('===========CHANGED=>>>>', changed)

    // compileSvelteCode(domWysiwygEditorCompiledCode)

    // document.getElementById('domWysiwygEditorCompiledCode').innerHTML =
    // document.getElementById('domCompiledSvelteCode').innerHTML
  }
  public static postProcessCompiledSvelteCode(parentContainerKey: string): string {
    // Get all var elements in domCompiledSvelteCode
    const preOutputVars = document.querySelectorAll(
      '#domCompiledSvelteCode-' + parentContainerKey + ' var'
    )
    const outputVars = document.querySelectorAll(
      '#domWysiwygEditorCompiledCode-' + parentContainerKey + ' var'
    )
    // const preOutputVars = document.querySelectorAll('#domCompiledSvelteCode var')
    // const outputVars = document.querySelectorAll('#domWysiwygEditorCompiledCode var')

    // Create a map to store values of domCompiledSvelteCode var elements by ID
    // const varMap = new Map()
    console.log('preOutputVars', preOutputVars)

    preOutputVars.forEach((varElement, index) => {
      console.log('preOutputVars varElement', varElement)
      // const id = varElement.id
      const value = varElement.getAttribute(EditorHelpers.varTagDataValueAttributeName)

      if (!outputVars[index]) {
        return
      }
      // document.getElementById(id).innerHTML = value
      outputVars[index].innerHTML = value
      outputVars[index].setAttribute(EditorHelpers.varTagDataValueAttributeName, value)
      // varMap.set(id, value)

      // if (varMap.has(id)) {
      // varElement.innerHTML = varMap.get(id)
      // }
    })

    // Update domCompiledSvelteCode var elements with matching IDs
    outputVars.forEach((varElement) => {
      console.log('outputVars varElement', varElement)
      /* const id = varElement.id
        if (varMap.has(id)) {
          varElement.innerHTML = varMap.get(id)
        } */
    })

    // setTimeout(() => {
    // _editorContent = document.getElementById(
    //   'domWysiwygEditorCompiledCode-' + parentContainerKey
    // ).innerHTML

    // console.log('after preOutputVars varElement', _editorContent)
    var postProcessedCode = document.getElementById(
      'domWysiwygEditorCompiledCode-' + parentContainerKey
    ).innerHTML
    console.log('after postProcessedCode ---', postProcessedCode)
    return postProcessedCode
  }

  /**
   * Fixes invalid table markup in an HTML string.
   * Specifically, wraps stray <tr> rows directly inside <table>
   * into a proper <tbody> element (if not already inside thead/tbody/tfoot).
   *
   * @param html - The raw HTML string
   * @returns A corrected HTML string
   */
  public static fixInvalidTables(html: string): string {
    return html.replace(/<table([^>]*)>(\s*<tr[\s\S]*?<\/tr>)+\s*<\/table>/gi, (match) => {
      return match.replace(/(<table[^>]*>)([\s\S]*?)(<\/table>)/i, (m, start, inner, end) => {
        if (!inner.includes('<tbody>')) {
          return `${start}<tbody>${inner}</tbody>${end}`
        }
        return m
      })
    })

    // Create a temporary DOM parser
    /* const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
  
    // Find all <table> elements
    const tables = doc.querySelectorAll('table');
  
    tables.forEach((table) => {
      // Collect all <tr> elements that are *direct children* of <table>
      const orphanRows = Array.from(table.children).filter(
        (el) => el.tagName.toLowerCase() === 'tr'
      );
  
      if (orphanRows.length > 0) {
        // Create a <tbody> and move the <tr> elements inside it
        const tbody = doc.createElement('tbody');
        orphanRows.forEach((tr) => tbody.appendChild(tr));
        table.appendChild(tbody);
      }
    });
  
    return doc.body.innerHTML;
    
    // Manually serialize children instead of using innerHTML
  // return Array.from(doc.body.childNodes)
  //   .map((node) => node instanceof HTMLElement ? node.outerHTML : node.textContent)
  //   .join('');
    
    */
  }

  public static restoreSvelteExpressionsFromHtmlTags(html: string): string {
    // Regular expression to match <var> tags and extract their code attribute
    const regex = /<var\s+[^>]*data-code="([^"]*)"[^>]*>(.*?)<\/var>/g

    // Function to handle the replacement
    function replacer(match, p1, p2): string {
      // Replace the <var> tag with the original expression wrapped in {}
      // return `${p1}`
      return `{${p1}}`
    }

    // Replace all <var> tags using the replacer function
    // return html.replace(regex, replacer)
    return html
      .replace(regex, replacer)
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
  }

  public static searchInObjectKeys(object: object, search: string): string[] {
    const keys = Object.keys(object)

    return keys.filter((key) => key.trim().toLowerCase().includes(search.trim().toLowerCase()))
  }

  /* public static generateSafeVarNames(object: object, search: string): string[] {
    // Map keys to safe camelCase identifiers
    const varMap: Record<string, string> = {};
    const safeVars: Record<string, any> = {};

    Object.keys(_var).forEach(key => {
      // Convert to camelCase / snake_case
      const safeKey = key
        .replace(/[^a-zA-Z0-9]/g, '_')       // replace invalid chars with _
        .replace(/_+/g, '_')                 // collapse multiple _
        .replace(/^_|_$/g, '')               // remove leading/trailing _
      varMap[key] = safeKey;
      safeVars[safeKey] = _var[key];         // assign value to safe key
    });


  } */

  public static replaceSvelteExpressionsByHtmlTags(html: string): string {
    return html

    // const id = uuidv4()

    // Regular expression to match expressions inside {}
    const regex = /{([^{}]+)}/g
    console.log('inside replacer bef ', html)

    // Function to handle the replacement
    function replacer(match, p1, offset, string) {
      // Check if the match is inside a tag's attribute
      const before = string.slice(0, offset)
      const insideTag = before.lastIndexOf('<') > before.lastIndexOf('>')

      /* if (insideTag) {
            return match; // Return the match unchanged if it's inside a tag's attribute
        } */

      // Check if the match is inside <script> or <style> tags
      const scriptIndex = before.lastIndexOf('<script')
      // const scriptEndIndex = before.lastIndexOf('<script>')
      const scriptEndIndex = before.lastIndexOf(`<\/script>`)
      const styleIndex = before.lastIndexOf('<style')
      // const styleIndex = before.lastIndexOf('<tyle')
      const styleEndIndex = before.lastIndexOf(`<\/style>`)
      // const styleEndIndex = before.lastIndexOf('</style>')
      // const styleEndIndex = before.lastIndexOf('<style>')
      // const styleEndIndex = before.lastIndexOf('<\/style>')

      //  const insideScript = scriptIndex > scriptEndIndex
      // const insideStyle = styleIndex > styleEndIndex

      // if (insideTag || insideScript || insideStyle) {
      // return match // Return the match unchanged if it's inside a tag's attribute, <script>, or <style>
      // }

      const insideScript = scriptIndex > scriptEndIndex
      const insideStyle = styleIndex > styleEndIndex

      if (insideTag || insideScript || insideStyle) {
        return match // Return the match unchanged if it's inside a tag's attribute, <script>, or <style>
      }

      // Replace the expression with <var data-value="..." data-code="..."></var>
      const code = p1.trim()
      const strippedCode = code.replace(/["']/g, "'") // Don't allow double/simple quotes in variable name
      // const strippedCode = code.replace(/["']/g, '&quot;')
      // return `<var value={${code}} code={${code}}></var>`
      // return `<var value={${code}} code={${code}} id="${id}"></var>`
      // return `<var ${EditorHelpers.varTagDataValueAttributeName}={${code}} ${EditorHelpers.varTagDataCodeAttributeName}="${code}" class="brackets"></var>`
      return `<var ${EditorHelpers.varTagDataValueAttributeName}={${code}} ${EditorHelpers.varTagDataCodeAttributeName}="${strippedCode}" class="brackets"></var>`
      // return `<var ${EditorHelpers.varTagDataValueAttributeName}={${code}} ${EditorHelpers.varTagDataCodeAttributeName}="${code.replace(/["']/g, '&quot;')}" class="brackets"></var>`

      // return `<var ${EditorHelpers.varTagDataValueAttributeName}={${code}} ${EditorHelpers.varTagDataCodeAttributeName}="${code.replace(/"/g, '&quot;')}" class="brackets"></var>`
      // return `<var value="{${code}}" code="${code.replace(/"/g, '&quot;')}"></var>`
    }
    var result = html.replace(regex, replacer)
    console.log('inside replacer ', result)
    // Replace all expressions using the replacer function
    return result
    // return html
    // return html.replace(regex, replacer)
  }

  /*  public static setCodeEditorValuePreserveStateOld(
     editor: monaco.editor.IStandaloneCodeEditor,
     newValue: string
   ): void {
     const model = editor.getModel()
     if (!model) return
 
     const currentValue = model.getValue()
     if (currentValue === newValue) return // no update needed
 
     // Save current state
     const viewState = editor.saveViewState()
 
     // Apply new value in a diff-friendly way (resets undo if not done carefully)
     model.pushEditOperations(
       [], // no selections
       [
         {
           range: model.getFullModelRange(),
           text: newValue
         }
       ],
       () => null
     )
     return
     // Restore cursor, scroll, and selections
     if (viewState) {
       editor.restoreViewState(viewState)
     }
 
     // editor.focus()
   } */

  /* public static setCodeEditorValuePreserveState(
    editor: monaco.editor.IStandaloneCodeEditor,
    newValue: string
  ): void {
    const model = editor.getModel()
    if (!model) return

    const currentValue = model.getValue()
    if (currentValue === newValue) return // no update needed

    // Save current cursor/scroll state
    const viewState = editor.saveViewState()

    // --- compute minimal diff ---
    const changes = monaco.editor.computeDiff(
      currentValue,
      newValue,
      true // ignore trim whitespace
    )

    const edits: monaco.editor.IIdentifiedSingleEditOperation[] = []

    for (const change of changes.changes) {
      if (change.originalLength === 0 && change.modifiedLength === 0) continue

      const startLine = model.getPositionAt(change.originalStart).lineNumber
      const startCol = model.getPositionAt(change.originalStart).column
      const endLine = model.getPositionAt(change.originalStart + change.originalLength).lineNumber
      const endCol = model.getPositionAt(change.originalStart + change.originalLength).column

      edits.push({
        range: new monaco.Range(startLine, startCol, endLine, endCol),
        text: newValue.substr(change.modifiedStart, change.modifiedLength)
      })
    }

    if (edits.length > 0) {
      model.pushEditOperations([], edits, () => null)
    }

    // Restore cursor + scroll
    if (viewState) {
      editor.restoreViewState(viewState)
    }
  } */

  /*  public static setCodeEditorValuePreserveState(
     editor: monaco.editor.IStandaloneCodeEditor,
     newValue: string
   ): void {
     const model = editor.getModel()
     if (!model) return
 
     const currentValue = model.getValue()
     if (currentValue === newValue) return // no update needed
 
     const viewState = editor.saveViewState()
 
     // --- find minimal diff (prefix/suffix method) ---
     let start = 0
     while (
       start < currentValue.length &&
       start < newValue.length &&
       currentValue[start] === newValue[start]
     ) {
       start++
     }
 
     let endCurrent = currentValue.length
     let endNew = newValue.length
     while (
       endCurrent > start &&
       endNew > start &&
       currentValue[endCurrent - 1] === newValue[endNew - 1]
     ) {
       endCurrent--
       endNew--
     }
 
     // Only update the changed part
     const startPos = model.getPositionAt(start)
     const endPos = model.getPositionAt(endCurrent)
     const changedText = newValue.slice(start, endNew)
 
     model.pushEditOperations(
       [],
       [
         {
           range: new monaco.Range(
             startPos.lineNumber,
             startPos.column,
             endPos.lineNumber,
             endPos.column
           ),
           text: changedText
         }
       ],
       () => null
     )
 
     if (viewState) {
       // editor.restoreViewState(viewState)
     }
   } */

  // Function to save the content of the editor to file
  public static saveToFile(filePath: string, content: string): boolean {
    return Utils.saveToFile(filePath, content)
    /* return nodeApi.fs.writeFile(filePath, content, 'utf-8', (err) => {
      if (err) {
        console.error('Error writing file:', err)
        return false
      } else {
        console.log('File saved successfully:', filePath)
        return true
      }
    }) */
  }

  public static deletePreviousCharacters(editableDiv: HTMLDivElement, count: number) {
    console.log('delete======', count)

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      return
    }

    const range = selection.getRangeAt(0)

    // Ensure the selection is within the editableDiv
    if (!editableDiv.contains(range.commonAncestorContainer)) {
      console.warn('Selection is not within the specified editable div.')
      return
    }

    const cursorPosition = range.startOffset

    // Check if there are enough characters before the cursor position
    if (cursorPosition < count || count < 0) {
      console.warn('Not enough characters before the cursor to delete.')
      return
    }

    // Set the start and end positions for the range to delete the previous characters
    range.setStart(range.startContainer, cursorPosition - count)
    range.setEnd(range.startContainer, cursorPosition)

    // Delete the contents within the range
    range.deleteContents()

    // Reset the cursor position
    const newRange = document.createRange()
    newRange.setStart(range.startContainer, cursorPosition - count)
    newRange.collapse(true)

    selection.removeAllRanges()
    selection.addRange(newRange)
  }

  /* public static getSelectedText(event: Event): SelectedTextModel {
    const target = event.target as HTMLElement
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const text = selection.toString()
      const start = range.startOffset
      const end = range.endOffset

      const selectedTextModel = new SelectedTextModel(text, range, selection, target)
      selectedTextModel.logSelection()
      return selectedTextModel
    }
  }

  public static handleMultipleTextSelection(
    event,
    previousSelection: SelectedTextModel[]
  ): SelectedTextModel[] {
    const selectedTextModel = this.getSelectedText(event)

    if (event.metaKey || event.ctrlKey) {
      console.log('event metakey------')
    }
    previousSelection.push(selectedTextModel)
    return previousSelection
    /*  if (event.metaKey || event.ctrlKey) {
        selectedTextModels.update((models) => {
          models.push(selectedTextModel)
          return models
        })
      } else {
        selectedTextModels.set([selectedTextModel])
      } //
    // }
  } */

  public static isCursorInsideAVarTag(): boolean {
    return this.isCursorInsideParentTag(EditorHelpers.varTagName)
  }

  public static isCursorInsideParentTag(
    tagName: string,
    cursorSelection?: Selection,
    cursorRange?: Range
  ): boolean {
    // Get the current selection
    const selection = cursorSelection ?? window.getSelection()
    if (selection.rangeCount > 0) {
      const range = cursorRange ?? selection.getRangeAt(0)
      // Check if the start or end container is a <var> element

      console.log('>>>>>>range', range.startContainer.parentElement.tagName)
      console.log('>>>>>>range', range.endContainer.parentElement.tagName)

      let expressionContainerTag = range.commonAncestorContainer.parentElement
      console.log('>>>>>>>>expressionContainerTag  ' + expressionContainerTag.tagName)

      if (
        range.startContainer.parentElement.tagName === tagName.toUpperCase() ||
        range.endContainer.parentElement.tagName === tagName.toUpperCase()
      ) {
        return true
      }
    }
    return false
  }

  public static isCursorInsideDirectTag(
    tagName: string,
    cursorSelection?: Selection,
    cursorRange?: Range
  ): boolean {
    // Get the current selection
    const selection = cursorSelection ?? window.getSelection()
    if (selection.rangeCount > 0) {
      const range = cursorRange ?? selection.getRangeAt(0)
      // Check if the start or end container is a <var> element

      // console.log('>>>>>>range', range.startContainer.parentElement.tagName)
      // console.log('>>>>>>range', range.endContainer.parentElement.tagName)

      // let expressionContainerTag = range.commonAncestorContainer.parentElement
      console.log('>>>>>>>>range.startContainer.nodeName  ' + range.startContainer.nodeName)

      if (
        range.startContainer.nodeName === tagName.toUpperCase() ||
        range.endContainer.nodeName === tagName.toUpperCase()
      ) {
        return true
      }
    }
    return false
  }

  // Function to trigger keydown event programmatically
  public static triggerKeyEvent(element: Element, eventName: string, key: string = ''): void {
    const event = new KeyboardEvent(eventName, {
      key: key,
      bubbles: true,
      cancelable: true
    })
    element.dispatchEvent(event)
  }

  // Function to trigger click event programmatically
  public static triggerClick(element: Element): void {
    this.triggerMouseEvent(element, 'click')
  }

  // Function to trigger click event programmatically
  public static triggerMouseEvent(element: Element, eventName: string): void {
    const event = new MouseEvent(eventName, {
      bubbles: true,
      cancelable: true
    })
    element.dispatchEvent(event)
  }

  /**
   * Converts a filesystem path into a valid `file://` URL.
   *
   * This function:
   * - Resolves relative paths to absolute paths
   * - Normalizes path separators across platforms (Windows / macOS / Linux)
   * - Properly encodes special characters (spaces, unicode, etc.)
   * - Produces a standards-compliant `file://` URL
   *
   * ⚠️ DO NOT manually concatenate `file://` with paths.
   * Always use this utility to avoid platform-specific bugs.
   *
   * @template T - A string representing a filesystem path
   *
   * @param {T} inputPath
   * The input filesystem path.
   * Can be:
   * - Absolute path (`/Users/...`)
   * - Relative path (`./dist/index.html`)
   *
   * @param {string} [baseDir=process.cwd()]
   * Optional base directory used when `inputPath` is relative.
   *
   * @returns {string}
   * A valid `file://` URL string.
   *
   * @example
   * ```ts
   * toFileUrl(__dirname)
   * // → file:///Users/me/project
   * ```
   *
   * @example
   * ```ts
   * toFileUrl('./index.html', __dirname)
   * // → file:///Users/me/project/index.html
   * ```
   *
   * @example
   * ```ts
   * mainWindow.loadURL(toFileUrl('dist/index.html'))
   * ```
   */
  public static toFileUrl<T extends string>(
    inputPath: T,
    baseDir: string = EditorHelpers.safeCwd()
  ): string {
    return toAssetUrl(nodeApi.path.resolve(inputPath))
    /* const resolvedPath = nodeApi.path.isAbsolute(inputPath)
      ? inputPath
      : nodeApi.path.resolve(baseDir, inputPath)

    return this.toFileUrlBrowser(resolvedPath) */
    // return pathToFileURL(resolvedPath).href
  }

  public static toFileUrlBrowser(relativePath: string): string {
    return new URL(relativePath, window.location.href).href
  }

  /**
   * Get the project folder from a file path.
   * Example:
   * base = /Users/.../ddoc-office/ddoc-office
   * file = /Users/.../ddoc-office/ddoc-office/test/assets/.../file.html
   * → returns: /Users/.../ddoc-office/ddoc-office/test/
   */
  public static getFileRootFromBaseDir(baseDir: string, filePath: string): string {
    const relative = nodeApi.path.relative(baseDir, filePath) // → test/.../file.html
    const parts = relative.split(nodeApi.path.sep) // → ["test", "...", "file.html"]

    if (parts.length === 0) return baseDir

    const looksLikeUuid = (value: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

    const projectName = parts[0] // uuid or legacy doc name
    const maybeDocName = parts[1]
    console.log('getFileRootFromBaseDir', {
      baseDir,
      filePath,
      relative,
      parts,
      projectName,
      maybeDocName
    })

    if (looksLikeUuid(projectName) && maybeDocName) {
      return nodeApi.path.join(baseDir, projectName, maybeDocName)
    }

    return nodeApi.path.join(baseDir, projectName) // legacy structure
    // return nodeApi.path.join(baseDir, projectName) + nodeApi.path.sep;  // keep trailing slash
  }

  /**
   * Get the internal sub-path relative to the project root.
   * Example:
   * projectRoot = /Users/.../ddoc-office/ddoc-office/test/
   * filePath    = /Users/.../ddoc-office/ddoc-office/test/assets/images/file.html
   * → returns: assets/images/file.html
   */
  /**
   * Get the internal sub-path relative to the project root.
   * If the file is outside the project, returns the full filePath.
   */
  public static getRelativePathFromProjectRoot(projectRoot: string, filePath: string): string {
    const relativePath = nodeApi.path.relative(projectRoot, filePath)

    // Check if the path "escapes" the project root
    // On Windows, it might start with ..\ and on Mac/Linux ../
    const isOutside = relativePath.startsWith('..') || nodeApi.path.isAbsolute(relativePath)

    if (isOutside) {
      console.log(
        'File is outside project root, returning full path.',
        nodeApi.path.join(projectRoot, filePath)
      )
      // return filePath;
      return nodeApi.path.join(projectRoot, filePath) // keep trailing slash
    }

    return relativePath
  }
  /* public static getRelativePathFromProjectRoot(projectRoot: string, filePath: string): string {
    // 1. Calculate the path relative to the specific project folder
    const relativePath = nodeApi.path.relative(projectRoot, filePath);

    // 2. Ensure we handle potential leading/trailing separator issues
    // Path.relative handles most of this, but we log for debugging
    console.log("getRelativePathFromProjectRoot", { projectRoot, filePath, relativePath });

    return relativePath;
  } */

  /**
   * Check if two file paths refer to the "same document"
   * Rules:
   *  - Same folder
   *  - Same base name (ignoring extension)
   */
  public static isSameDocument(docPath1: string, docPath2: string): boolean {
    const dir1 = nodeApi.path.dirname(docPath1)
    const dir2 = nodeApi.path.dirname(docPath2)

    const base1 = nodeApi.path.parse(docPath1).name
    const base2 = nodeApi.path.parse(docPath2).name

    console.log('isSameDocument, ', { dir1, dir2, base1, base2 })

    return dir1 === dir2 && base1 === base2
  }

  // public static async addNewDocumentEditor(
  //   documentPath: string | undefined | null,
  //   callback?: () => void,
  //   defaultContentType?: DocumentContentType,
  //   defaultContentKind?: DocumentContentKindType,
  //   defaultContent: string = ''
  // ): Promise<DocumentEditorModel[]> {
  //   // console.log('_documentEditors addNewDocumentEditor',)
  //   //  function addNewDocumentEditor(): void {
  //   var documentEditors = _$_documentEditorsList.getList()
  //   // const index = documentEditors.length
  //   // const id = documentEditors.length
  //   // _canRenderComponents = false

  //   console.log('_documentEditors addNewDocumentEditor', documentEditors)
  //   let documentToOpen
  //   // if path is undefined or null, create new document
  //   if (!documentPath) {
  //     // defaultContent = DocumentModel.getDefaultDocumentContent(defaultContentType, defaultContentKind, defaultContent)
  //     documentToOpen = await DocumentModel.createNewDocument(defaultContentType, defaultContentKind, defaultContent)
  //   } else {
  //     documentPath = documentPath ||
  //       // '/path/to/dynadoc/test/test.xddoc'
  //       '/path/to/dynadoc/test/test.xddoc'

  //     // if documeent.path already exist, don't continue and load again, just update the editor list to active

  //     if (!documentPath) {
  //       console.warn('⚠️ No document path provided.')
  //       return documentEditors
  //     }

  //     // 🧠 1️⃣ Check if document with same path already exists
  //     // const existingEditor = documentEditors.find(
  //     //   (editor) => editor.document?.path === documentPath
  //     // )
  //     const existingEditor = documentEditors.find(editor =>
  //       editor.document?.getMainFilePath() === documentPath ||
  //       (editor.document?.path && this.isSameDocument(editor.document.path, documentPath))
  //       // editor.document?.path && this.isSameDocument(editor.document.path, documentPath)
  //     )

  //     if (existingEditor) {
  //       console.log('📄 Document already open, activating existing editor:', documentPath)

  //       // Set all inactive, then activate the existing one
  //       _$_documentEditorsList.setActive(existingEditor.id!)
  //       // _$_documentEditorsList.setActive(existingEditor.index!)
  //       // _$_documentEditorsList.setActive(existingEditor.id!)
  //       /* documentEditors = documentEditors.map((editor) => ({
  //         ...editor,
  //         isActive: editor.id === existingEditor.id
  //       }))

  //       _$_documentEditorsList.set(documentEditors) */
  //       if (callback) callback()
  //       return documentEditors
  //     }

  //     // 🧩 2️⃣ Otherwise, load the document from disk
  //     documentToOpen = await DocumentModel.loadFrom(
  //       // '/path/to/dynadoc/test/test.xddoc',
  //       documentPath,
  //       // ||
  //       // '/path/to/dynadoc/test/test.xddoc',
  //       // '/path/to/dynadoc/test/test.xddoc',
  //       DocumentModel.OpenMode.WRITE
  //     ) // Load a document from a file path

  //     if (!documentToOpen) {
  //       // Open the file using the system
  //       await window.api.openFile(documentPath)
  //       return null // File not supported
  //     }

  //     console.log('_documentEditors Loaded document:', documentToOpen)
  //   }

  //   documentEditors = [
  //     // ..._documentEditors,
  //     ...documentEditors.map((editor) => {
  //       return new DocumentEditorModel({ ...editor, isActive: false })
  //     }

  //       // ({
  //       // ...editor,
  //       //   isActive: false // set all other editors to inactive
  //       // })
  //     ),
  //     new DocumentEditorModel({
  //       // index: index,
  //       // index: id,
  //       id: documentToOpen.getMainFilePath(), // set the document path as the id
  //       // id: documentPath, // set the document path as the id
  //       // id: id.toString(),
  //       document:
  //         // null // Create a new Document instance
  //         // For testing
  //         // Document.loadFrom(
  //         //   '/path/to/dynadoc/test/test.xddoc',
  //         //   Document.OpenMode.WRITE
  //         // ) // Load a document from a file path
  //         documentToOpen,
  //       isActive: true
  //     })
  //     /* {
  //       index: id,
  //       id: id.toString(),
  //       document:
  //         // null // Create a new Document instance
  //         // For testing
  //         // Document.loadFrom(
  //         //   '/path/to/dynadoc/test/test.xddoc',
  //         //   Document.OpenMode.WRITE
  //         // ) // Load a document from a file path
  //         doc,
  //       isActive: true
  //     } */
  //   ]

  //   // Set the editor list instance in the store
  //   console.log('__rootPath Set the editor list instance in the store ', documentEditors)
  //   _$_documentEditorsList.set([...documentEditors])
  //   _$_currentView.set('editor')
  //   // _$_documentEditorsList.set(_documentEditors)
  //   console.log(
  //     '__rootPath Set the editor list instance in the store ',
  //     // _$_documentEditorsList.get(id.toString())
  //   )

  //   // _documentEditors = [..._documentEditors, { id: id, document: null }]
  //   // _$_wysiwygEditorsList = [..._$_wysiwygEditorsList, { id: id, editor: null }]
  //   // _$_codeEditorsList = [..._$_codeEditorsList, { id: id, editor: null }]
  //   // _wysiwygEditorsSelectedTextList = [
  //   //   ..._wysiwygEditorsSelectedTextList,
  //   //   [new SelectedTextModel()]
  //   // ]
  //   // _canRenderComponents = true

  //   console.log('_documentEditors', documentEditors)

  //   if (callback) {
  //     callback()
  //   }

  //   return _$_documentEditorsList.getList()
  // }

  public static async saveDocumentPathPickerDialog(documentEditor: DocumentEditorModel) {
    if (!documentEditor?.document) return false
    const doc = documentEditor.document

    const lastDir = readStoreValue<string | null>(_$_lastSaveDirectory)
    const baseName = doc.name || 'Untitled'
    const rawExt = doc.extension || Utils.DYNADOC_EXTENSIONS.default
    const defaultExt =
      rawExt === Utils.MAIN_DOCUMENT_FILE_EXTENSION ? Utils.DYNADOC_EXTENSIONS.default : rawExt
    const defaultDir = lastDir || doc.dirPath || ''
    const defaultPath = defaultDir
      ? nodeApi.path.join(defaultDir, `${baseName}${defaultExt}`)
      : `${baseName}${defaultExt}`

    const formats = isSecureLeaseAvailable()
      ? SAVE_FORMATS
      : SAVE_FORMATS.filter((f) => f.format !== Utils.DYNADOC_EXTENSIONS_FORMAT.secured)

    const filters = formats.map((f) => ({
      name: `${f.label} (${f.ext})`,
      extensions: [f.ext.replace('.', '')]
    }))
    filters.push({ name: 'All Files', extensions: ['*'] })

    const outputPath = await window.api.saveDialogFile({
      title: 'Save As',
      defaultPath,
      filters
    })

    return outputPath || false
  }

  // public static async saveDocumentEditor(documentEditor: DocumentModel, saveAsSecured: boolean = false) {
  public static async saveDocumentEditor(
    documentEditor: DocumentEditorModel,
    options:
      | boolean
      | {
          saveAs?: boolean
          saveAsSecured?: boolean
          outputPath?: string
          skipExportPrompt?: boolean
          require2fa?: boolean
        } = false
  ) {
    if (!documentEditor?.document) return false

    // A document whose content could not be read holds nothing worth writing.
    // `Utils.saveToFile` already refuses the write itself, silently; an
    // explicit save (Ctrl+S, Save As, the autosave to drive) deserves to be
    // told why nothing was saved.
    const mainFilePath = documentEditor.document.getMainFilePath?.()
    if (mainFilePath && isFileUnreadable(mainFilePath)) {
      await openAlertModal({
        title: 'Nothing to save',
        message:
          'This document could not be read, so saving now would replace its content with an empty page. Reopen it and try again — nothing has been changed.'
      })
      return false
    }

    console.log('saveDocumentEditor savedDocPath original ', { options })

    const normalized = typeof options === 'boolean' ? { saveAsSecured: options } : { ...options }

    const saveAsSecured = Boolean(normalized.saveAsSecured)
    if (saveAsSecured && !isSecureLeaseAvailable()) {
      await notifySecureLeaseRequired(
        'Secure saving is currently unavailable. Please renew your secure writing license.'
      )
      return false
    }
    const skipExportPrompt = Boolean((normalized as any).skipExportPrompt)
    let outputPath = normalized.outputPath
    const document = documentEditor.document
    const rootPath = document.isFilePartOfAParentDocument() ? document.parentPath : document.path
    const cacheDir = await window.api.getCacheDir()
    const isCachePath = Boolean(rootPath && cacheDir && rootPath.startsWith(cacheDir))
    const shouldPromptForLocation = normalized.saveAs || !rootPath || isCachePath

    if (shouldPromptForLocation && !outputPath) {
      outputPath = await this.saveDocumentPathPickerDialog(documentEditor)
      if (!outputPath) return false
    }
    /* if (shouldPromptForLocation && !outputPath) {
      const existingPath = rootPath
      let baseDir =
        existingPath && !isCachePath ? nodeApi.path.dirname(existingPath) : document.dirPath || ''
      if (!baseDir) {
        try {
          let value: string | null = null
          const unsubscribe = _$_lastSaveDirectory.subscribe((v) => (value = v))
          unsubscribe?.()
          baseDir = value || ''
        } catch {
          baseDir = ''
        }
      }
      const baseNameSource = existingPath
        ? nodeApi.path.basename(existingPath, nodeApi.path.extname(existingPath))
        : document.name || 'Untitled'
      const suggestedExt = saveAsSecured
        ? Utils.DYNADOC_EXTENSIONS.secured
        : Utils.DYNADOC_EXTENSIONS.default
      // : document.extension || Utils.DDOC_EXTENSIONS.default
      const suggestedName = `${baseNameSource}${suggestedExt}`
      const defaultPath = baseDir ? nodeApi.path.join(baseDir, suggestedName) : suggestedName

      const extWithoutDot = suggestedExt.replace('.', '')
      const filters = [
        { name: 'DDoc', extensions: [Utils.DYNADOC_EXTENSIONS.default.replace('.', '')] }
      ]
      if (isSecureLeaseAvailable()) {
        filters.push({
          name: 'Secured DDoc',
          extensions: [Utils.DYNADOC_EXTENSIONS.secured.replace('.', '')]
        })
      }
      /+ if (extWithoutDot && !filters.some((f) => f.extensions.includes(extWithoutDot))) {
        filters.unshift({
          name: `${extWithoutDot.toUpperCase()} Files`,
          extensions: [extWithoutDot]
        })
      } +/
      filters.push({ name: 'All Files', extensions: ['*'] })

      outputPath = await window.api.saveDialogFile({
        title: saveAsSecured ? 'Save As Secured' : 'Save As',
        defaultPath,
        filters
      })

      if (!outputPath) return false
    } */

    if (!outputPath && !normalized.saveAs && !rootPath) {
      await openAlertModal({
        title: 'Save failed',
        message: 'This document has no file path yet. Use Save As to choose a location.'
      })
      return false
    }

    console.log('saveDocumentEditor Saving document editor ...', {
      documentEditor,
      outputPath,
      normalized,
      options,
      saveAsSecured
    })

    let savedDocPath: string | null = null
    try {
      savedDocPath = await document.saveTo(
        saveAsSecured,
        outputPath,
        undefined,
        Boolean((normalized as any).require2fa)
      )
    } catch (err: any) {
      console.error('Failed to save document', err)
      const message = err?.message || err?.toString?.() || 'Unknown save error'
      // The server cannot verify openers (step-up disabled): never seal anyway.
      if (typeof message === 'string' && message.includes('stepup_disabled')) {
        await openAlertModal({
          title: 'Save failed',
          message:
            'Verification on open is not available on this server. The document was not sealed.'
        })
        return false
      }
      const isLeaseError =
        typeof message === 'string' &&
        (message.toLowerCase().includes('lease') ||
          message.toLowerCase().includes('payment') ||
          message.toLowerCase().includes('subscription'))
      if (isLeaseError) {
        await notifySecureLeaseRequired(message)
        return false
      }
      await openAlertModal({ title: 'Save failed', message })
      return false
    }

    const isChildFile = document.isFilePartOfAParentDocument()
    if (savedDocPath && savedDocPath !== document.path) {
      const savedExt = nodeApi.path.extname(savedDocPath || '')
      const currentExt = nodeApi.path.extname(document.path || '')
      if (!savedExt && currentExt) {
        savedDocPath = document.path
      }
      const newDir = nodeApi.path.dirname(savedDocPath)
      const newBase = nodeApi.path.basename(savedDocPath)
      const newExt = nodeApi.path.extname(savedDocPath)

      if (!isChildFile) {
        document.path = savedDocPath
        document.parentPath = savedDocPath
        document.dirPath = newDir
        document.name = newBase.replace(newExt, '')
        document.extension = newExt || document.extension
        document.isSecured = newExt === Utils.DYNADOC_EXTENSIONS.secured
      } else {
        const parentPath = document.parentPath || savedDocPath
        const list = _$_documentEditorsList.getList()
        const parentEditor = list.find((entry) => {
          const entryDoc = entry?.document
          if (!entryDoc) return false
          if (entryDoc.path === parentPath || entryDoc.parentPath === parentPath) return true
          if (typeof entryDoc.getMainFilePath === 'function') {
            const mainPath = entryDoc.getMainFilePath(false)
            if (mainPath === parentPath) return true
          }
          return false
        })

        if (parentEditor?.document) {
          parentEditor.document.path = savedDocPath
          parentEditor.document.parentPath = savedDocPath
          parentEditor.document.dirPath = newDir
          parentEditor.document.name = newBase.replace(newExt, '')
          parentEditor.document.extension = newExt || parentEditor.document.extension
          parentEditor.document.isSecured = newExt === Utils.DYNADOC_EXTENSIONS.secured
          _$_documentEditorsList.register(
            parentEditor.uuid || parentEditor.document.uuid || parentEditor.id,
            parentEditor
          )
        } else {
          console.warn('Save path updated, but parent document editor not found.', {
            parentPath,
            savedDocPath
          })
        }
      }
    }

    if (savedDocPath) {
      try {
        _$_lastSaveDirectory.set(nodeApi.path.dirname(savedDocPath))
      } catch {
        // ignore
      }
    }

    console.log('Saving document editor register ...', { _$_documentEditorsList, documentEditor })

    _$_documentEditorsList.register(
      documentEditor.uuid || document.uuid || documentEditor.id,
      documentEditor
    )

    if (savedDocPath && !skipExportPrompt) {
      try {
        const { promptExportUpdatesIfNeeded } =
          await import('../services/export/exportTracking.service')
        await promptExportUpdatesIfNeeded(documentEditor)
      } catch (err) {
        console.warn('Failed to prompt export updates', err)
      }
    }

    if (savedDocPath) {
      const name = document?.name || 'Document'
      console.log(savedDocPath)
      console.log('createNewDocument savedDocPath ', { savedDocPath, outputPath, document })

      toast.success(t('Saved "{name}"', { values: { name } }))
    }

    return savedDocPath
  }

  public static async saveDocumentEditorAs(documentEditor: DocumentEditorModel) {
    return this.saveDocumentEditor(documentEditor, { saveAs: true })
  }

  /**
   * Restore previously opened documents on app launch
   */
  public static async restoreAllDocumentEditorsDDD(): Promise<void> {
    if (!(await nodeApi.fsPromises.exists(_$_documentEditorStorePath))) {
      console.log('🗃️ No previous session to restore.')
      return
    }

    try {
      const data = JSON.parse(await nodeApi.fsPromises.readFile(_$_documentEditorStorePath, 'utf8'))

      if (!Array.isArray(data)) return

      console.log(`_documentEditors 🔄 Restoring ${data.length} document editors...`)

      // Set the editor list instance in the store
      console.log(
        '_documentEditors __rootPath Set the editor list instance in the store ',
        DocumentEditorModel.fromJSONList(data)
      )
      // _$_documentEditorsList.set([...DocumentEditorModel.fromJSONList(data)])
      /* for (const [i, editor] of data.entries()) {
        if (!editor.document?.path) continue
    
        try {
          await this.addNewDocumentEditor(editor.document.path)
        } catch (err) {
          console.error(`Failed to restore document ${editor.document.path}:`, err)
        }
      }
    
      // Reactivate the last active one
      const activeEditor = data.find((e) => e.isActive)
      if (activeEditor) {
        _$_documentEditorsList.setActive(activeEditor.id!)
      } */

      console.log('✅ Session restored successfully.')
    } catch (err) {
      console.error('Failed to restore editors:', err)
    }
  }

  public static async convertDocxToHtml(
    filePath: string,
    outputPath: string,
    returnFilePath = true
  ): Promise<string> {
    try {
      return await convertDocxFileToHtml(filePath, outputPath, returnFilePath)
    } catch (e) {
      console.error('Conversion failed:', e)
      return ''
    }
  }
  public static writeFileEnsuringDir(
    filePath: string,
    content: string | Buffer | Uint8Array = '',
    encoding?: string
  ) {
    // public static writeFileEnsuringDir(filePath: string, content: string | Buffer | Uint8Array = "", encoding: string = "utf8") {
    const safePath = EditorHelpers.normalizePathForPlatform(filePath)
    if (!safePath) return
    const parentDir = nodeApi.path.dirname(safePath)
    void (async () => {
      if (parentDir && parentDir !== '.') {
        await nodeApi.fsPromises.mkdir(parentDir, { recursive: true })
      }
      if (encoding) {
        await nodeApi.fsPromises.writeFile(safePath, content, encoding)
      } else {
        await nodeApi.fsPromises.writeFile(safePath, content)
      }
    })().catch((error) => {
      console.error('writeFileEnsuringDir failed:', error)
    })
  }

  public static async writeFileEnsuringDirAsync(
    filePath: string,
    content: string | Buffer | Uint8Array = '',
    encoding?: string
  ) {
    const safePath = EditorHelpers.normalizePathForPlatform(filePath)
    if (!safePath) return
    const parentDir = nodeApi.path.dirname(safePath)
    if (parentDir && parentDir !== '.') {
      await nodeApi.fsPromises.mkdir(parentDir, { recursive: true })
    }
    if (encoding) {
      await nodeApi.fsPromises.writeFile(safePath, content, encoding)
      return
    }
    await nodeApi.fsPromises.writeFile(safePath, content)
  }

  public static async convertHtmlToDocx(
    filePath: string,
    outputPath: string,
    returnFilePath = true
  ): Promise<string> {
    try {
      const docxPath = await convertHtmlFileToDocx(filePath, outputPath)
      return returnFilePath ? docxPath : docxPath
    } catch (e) {
      console.error('Conversion failed:', e)
      return ''
    }
  }

  /**
   * Ensure an HTML fragment is a complete HTML document.
   * Adds only missing structural parts (doctype, html, head, body, meta, title, etc.)
   */

  public static toCompleteHTML(
    input: string,
    options: {
      title?: string
      lang?: string
      styles?: string[]
      scripts?: string[]
      meta?: { [name: string]: string }
    } = {}
  ): string {
    const {
      title = 'Document',
      lang = 'en',
      styles = [],
      scripts = [],
      meta = { charset: 'utf-8', viewport: 'width=device-width, initial-scale=1.0' }
    } = options

    let html = input.trim()

    // --- Remove existing DOCTYPE / html / body tags to avoid duplication ---
    html = html
      .replace(/<!doctype html[^>]*>/i, '')
      .replace(/<\/?html[^>]*>/gi, '')
      .replace(/<\/?body[^>]*>/gi, '')
      .trim()

    // --- Build head ---
    const metaTags = Object.entries(meta)
      .map(([name, content]) =>
        name === 'charset'
          ? `<meta charset="${content}"/>`
          : `<meta name="${name}" content="${content}"/>`
      )
      .join('\n    ')

    const styleTags = styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('\n    ')

    const head = `<head>
    ${metaTags}
    <title>${title}</title>
    ${styleTags}
  </head>`

    // --- Build body ---
    const body = `<body>
${html}
</body>`

    // --- Build final complete HTML ---
    let xhtml = `<!DOCTYPE html>
<html lang="${lang}">
${head}
${body}
</html>`

    // Normalize self-closing tags for XHTML compliance
    xhtml = xhtml
      .replace(/<br([^>]*)>/gi, '<br$1/>')
      .replace(/<hr([^>]*)>/gi, '<hr$1/>')
      .replace(/<img([^>]*)>/g, '<img$1/>')
      .replace(/<col(?!group)([^>]*)>/gi, '<col$1/>')
      // .replace(/<col([^>]*)>/g, "<col$1 />")
      .replace(/&nbsp;/g, '&#160;')

    return xhtml
  }

  public static toCompleteHTML2(
    input: string,
    options: {
      title?: string
      lang?: string
      styles?: string[]
      scripts?: string[]
      meta?: { [name: string]: string }
    } = {}
  ): string {
    const {
      title = 'Document',
      lang = 'en',
      styles = [],
      scripts = [],
      meta = {
        charset: 'utf-8',
        viewport: 'width=device-width, initial-scale=1.0'
      }
    } = options

    let html = input.trim()

    // --- DOCTYPE ---
    if (!/^<!doctype html>/i.test(html)) {
      html = '<!DOCTYPE html>\n' + html
    }

    // --- <html> tag ---
    if (!/<html[\s>]/i.test(html)) {
      html = `<html lang="${lang}">\n${html}\n</html>`
    }

    // --- <head> section ---
    if (!/<head[\s>]/i.test(html)) {
      const metaTags = Object.entries(meta)
        .map(([name, content]) => {
          if (name === 'charset') return `<meta charset="${content}">`
          return `<meta name="${name}" content="${content}">`
        })
        .join('\n    ')

      const styleTags = styles
        .map((href) => `<link rel="stylesheet" href="${href}">`)
        .join('\n    ')

      const head = `
  <head>
    ${metaTags}
    <title>${title}</title>
    ${styleTags}
  </head>`

      // insert <head> before <body> or at top of <html>
      html = html.replace(/<html[^>]*>/i, (m) => `${m}\n${head}`)
    } else if (!/<title>/i.test(html)) {
      // Add missing <title> if head exists but title doesn’t
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n<title>${title}</title>`)
    }

    // --- <body> section ---
    if (!/<body[\s>]/i.test(html)) {
      // Try to isolate the inner content (everything except <html>…<head>…)
      const bodyContent = html
        .replace(/.*<head[\s\S]*?<\/head>/i, '') // remove head
        .replace(/<\/?html[^>]*>/gi, '') // remove html tags
        .trim()

      html = html.replace(/<\/head>/i, `</head>\n<body>\n${bodyContent}\n</body>`)
    }

    // --- Scripts ---
    if (scripts.length > 0) {
      const scriptTags = scripts.map((src) => `<script src="${src}" defer></script>`).join('\n')
      if (/<\/body>/i.test(html)) {
        html = html.replace(/<\/body>/i, `${scriptTags}\n</body>`)
      } else {
        html += `\n${scriptTags}`
      }
    }

    return html
  }

  public static htmlToXhtml(inputHtml: string): string {
    // Ensure it has a root element
    const wrappedHtml = inputHtml.trim().startsWith('<!DOCTYPE')
      ? inputHtml
      : `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/></head><body>${inputHtml}</body></html>`

    // Parse HTML as DOM
    const parser = new DOMParser()
    const doc = parser.parseFromString(wrappedHtml, 'text/html')

    // Serialize as XML (XHTML)
    const serializer = new XMLSerializer()
    let xhtml = serializer.serializeToString(doc)

    // Normalize self-closing tags for XHTML compliance
    xhtml = xhtml
      .replace(/<br>/g, '<br />')
      .replace(/<hr>/g, '<hr />')
      .replace(/<img([^>]*)>/g, '<img$1 />')
      .replace(/&nbsp;/g, '&#160;')

    return xhtml
  }

  /**
   * Converts a file's content into TipTap JSON and saves it as a .json file.
   * Works headlessly, no visible editor needed.
   *
   * @param filePath Absolute path of the file to convert.
   * @param content Optional: If you already have the file content, pass it as a string.
   * @returns Path to the saved JSON file.
   */
  public static async convertFileToTipTapJson(filePath: string, content?: string) {
    // Read file if content not provided
    console.log('convertFileToTipTapJson', filePath)
    let fileContent = content
    if (!fileContent) {
      fileContent = await nodeApi.fsPromises?.readFile(filePath, 'utf-8')
      // fileContent = await window.api.node.nodeApi.fs.promises.readFile(filePath, 'utf-8');
    }
    console.log('fileContent', fileContent)

    // Create headless TipTap editor
    const editor = new Editor({
      extensions: [
        StarterKit,
        CustomUuidIdentificationExtension.configure({
          target: 'both',
          // ignoreInlineTypes: ['strong', 'em', 'link'],
          // ignoreChildren: true,
          regenerateOnPaste: true
        })
      ],
      content: fileContent
    })

    // Get TipTap JSON
    const jsonContent = editor.getJSON()

    // Build JSON file path
    const dir = nodeApi.path.dirname(filePath)
    const baseName = nodeApi.path.basename(filePath, nodeApi.path.extname(filePath))
    const jsonFilePath = nodeApi.path.join(dir, `${baseName}.json`)

    // Save JSON to disk
    await nodeApi.fsPromises?.writeFile(jsonFilePath, JSON.stringify(jsonContent, null, 2), 'utf-8')

    return jsonFilePath
  }

  public static async addNewDocumentTranslateEditor(
    document: DocumentModel,
    documentFileToTranslatePath: string,
    translateLocale: string
  ) {
    //if a translation file with the .translateLocale.json exists, load it
    // else create a new translation file with the content of the original document
    await this.convertFileToTipTapJson(file.path)
  }
}
