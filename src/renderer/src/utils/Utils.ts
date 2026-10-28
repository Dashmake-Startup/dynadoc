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

// import esbuild from 'esbuild';
// import sveltePlugin from 'esbuild-svelte';
// import esbuildSvelte from "esbuild-svelte";

// import { rollup } from 'rollup';
// import svelte from 'rollup-plugin-svelte';
// import resolve from '@rollup/plugin-node-resolve';
// import commonjs from '@rollup/plugin-commonjs';
// import css from 'rollup-plugin-css-only';
// import { app, } from 'electron'

import { ZipFile } from 'yazl'
import * as yauzl from 'yauzl'
import SecurityHelpers from './SecurityHelpers'
import Platform from '../libs/platform'
import { onMount } from 'svelte'
import { debounce } from 'lodash'
import { nodeApi } from './shims/node'
import { isFileUnreadable } from './unreadableFiles'
// import { _$_translationPairsMap } from '../extensions/tiptap/CustomTranslationExtension/stores/translationSync.store'
// import { get } from 'svelte/store'
// import { pathToFileURL } from 'url'

// import { DocumentModel } from '../models/Document'
// import { _mainFileName } from '../models/Document'
// import { pipeline } from 'stream'
// import { promisify } from 'util'

// let _mainFileName = "ss"
// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path
// const fsPromises = nodeApi?.fsPromises

/* const isBrowser = typeof window !== 'undefined'
// Use Electron preload in renderer, Node core modules in main/SSR
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = (isBrowser ? (window as any).node?.fs : require('fs')) as any
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fsPromises = (isBrowser ? (window as any).node?.fsPromises : require('fs').promises) as any
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = (isBrowser ? (window as any).node?.path : require('path')) as any */

function requireNodeFs() {
  if (!nodeApi.fs || !nodeApi.path) {
    throw new Error('Node filesystem is not available in this environment.')
  }
}

function normalizePathForPlatform(inputPath: string): string {
  const raw = typeof inputPath === 'string' ? inputPath : String(inputPath ?? '')
  if (Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop) return raw
  return raw.replace(/^file:\/\//i, '').replace(/^\/+/, '')
}

// const pipelineAsync = promisify(pipeline)
export default class Utils {
  static MAIN_DOCUMENT_FILE_NAME = 'index'
  static DOCUMENT_INFO_FILE_NAME = 'info'
  static DOCUMENT_CONFIG_FILE_NAME = 'config'
  static DOCUMENT_SYSTEM_INFO_FILE_NAME = 'systeminfo'
  static DOCUMENT_FILE_EXTENSION = '.html'
  static MAIN_DOCUMENT_FILE_EXTENSION = '.html'
  static DOCUMENT_INFO_FILE_EXTENSION = '.json'
  static DOCUMENT_CONFIG_FILE_EXTENSION = '.json'
  static DOCUMENT_SYSTEM_INFO_FILE_EXTENSION = '.json'
  static SERIALIZATION_FILE_EXTENSION = '.json'
  static SERIALIZATION_BINARY_FILE_EXTENSION = '.cbor'
  static MAIN_DOCUMENT_FILE = `${Utils.MAIN_DOCUMENT_FILE_NAME}${Utils.MAIN_DOCUMENT_FILE_EXTENSION}`
  static DOCUMENT_INFO_FILE = `${Utils.DOCUMENT_INFO_FILE_NAME}${Utils.DOCUMENT_INFO_FILE_EXTENSION}`
  static DOCUMENT_CONFIG_FILE = `${Utils.DOCUMENT_CONFIG_FILE_NAME}${Utils.DOCUMENT_CONFIG_FILE_EXTENSION}`
  static DOCUMENT_SYSTEM_INFO_FILE = `${Utils.DOCUMENT_SYSTEM_INFO_FILE_NAME}${Utils.DOCUMENT_SYSTEM_INFO_FILE_EXTENSION}`
  static DYNADOC_EXTENSIONS_FORMAT = {
    name: 'ddoc',
    default: 'xddoc',
    secured: 'sddoc'
  }
  static DYNADOC_EXTENSIONS = {
    default: `.${Utils.DYNADOC_EXTENSIONS_FORMAT.default}`,
    secured: `.${Utils.DYNADOC_EXTENSIONS_FORMAT.secured}`
  }
  static ZIP_STABLE_INTERVAL_MS = 200
  static ZIP_STABLE_REQUIRED_MS = 800
  static ZIP_STABLE_TIMEOUT_MS = 15000
  // All common image extensions
  static IMAGE_EXTENSIONS = {
    jpg: '.jpg',
    jpeg: '.jpeg',
    png: '.png',
    gif: '.gif',
    bmp: '.bmp',
    webp: '.webp',
    tiff: '.tiff',
    tif: '.tif',
    svg: '.svg',
    ico: '.ico'
  }
  // All common video extensions
  static VIDEO_EXTENSIONS = {
    avi: '.avi',
    mp4: '.mp4',
    m4v: '.m4v',
    mov: '.mov',
    wmv: '.wmv',
    mpg: '.mpg',
    mpeg: '.mpeg',
    mkv: '.mkv',
    flv: '.flv',
    f4v: '.f4v',
    webm: '.webm',
    _3gp: '.3gp',
    ogv: '.ogv'
  }

  // All common audio extensions supported by Howler.js
  static AUDIO_EXTENSIONS = {
    mp3: '.mp3',
    wav: '.wav',
    ogg: '.ogg',
    oga: '.oga',
    opus: '.opus',
    webm: '.webm',
    m4a: '.m4a',
    aac: '.aac',
    caf: '.caf',
    flac: '.flac'
  }

  // static PROGRAMMING_LANGUAGE_EXTENSIONS_LIST = ['.html', '.css', '.txt', '.js', '.py'/* Add more later */]

  static PROGRAMMING_LANGUAGE_EXTENSIONS_LIST = [
    // Web
    '.html',
    '.htm',
    '.css',
    '.scss',
    '.sass',
    '.less',
    '.js',
    '.mjs',
    '.mts',
    '.cjs',
    '.cts',
    '.ts',
    '.tsx',
    '.jsx',

    // Programming Languages
    '.py',
    '.rb',
    '.php',
    '.java',
    '.c',
    '.h',
    '.cpp',
    '.cc',
    '.hpp',
    '.cs',
    '.go',
    '.rs',
    '.swift',
    '.kt',
    '.kts',
    '.dart',

    // Scripting / Shell
    '.sh',
    '.bash',
    '.zsh',
    '.fish',
    '.ps1',

    // Data / Markup
    '.json',
    '.jsonc',
    '.yaml',
    '.yml',
    '.xml',
    '.toml',
    '.ini',

    // Config files
    '.env',
    '.cfg',
    '.conf',
    '.properties',

    // Documentation / Plain text
    '.txt',
    '.md',
    '.markdown',
    '.rst',
    '.csv',
    '.xlsx',
    '.xls',

    // Query languages
    '.sql',
    '.graphql',
    '.gql',

    // DevOps / Infrastructure
    '.dockerfile',
    '.docker',
    '.tf',
    '.tfvars',

    // Misc
    '.lua',
    '.r',
    '.make',
    '.mak',
    'Makefile',
    // TeX / LaTeX
    '.tex',
    '.bib',
    '.sty',
    '.cls'
  ]
  // File types
  static FILE_TYPES = {
    img: 'img',
    video: 'video',
    audio: 'audio',
    pdf: 'pdf',
    code: 'code'
    //...
  }

  // File extensions that can be previewed
  static PREVIEWABLE_FILE_EXTENSIONS = {
    pdf: `${Utils.FILE_TYPES.pdf}`,
    ...Utils.IMAGE_EXTENSIONS,
    ...Utils.VIDEO_EXTENSIONS,
    ...Utils.AUDIO_EXTENSIONS
    // you can add more previewable types here if needed
    // e.g., txt: '.txt', md: '.md'
  }

  static OFFICE_EXTENSIONS_FORMAT = {
    word: 'docx',
    excel: 'xlsx',
    powerpoint: 'pptx'
  }
  static OFFICE_EXTENSIONS = {
    word: `.${Utils.OFFICE_EXTENSIONS_FORMAT.word}`,
    excel: `.${Utils.OFFICE_EXTENSIONS_FORMAT.excel}`,
    powerpoint: `.${Utils.OFFICE_EXTENSIONS_FORMAT.powerpoint}`
  }
  static LOCK_FILE_EXTENSION = '.lock'
  static PDF_EXTENSION = '.pdf'

  static CONVERTIBLE_HTML_LIKE_EXTENSIONS = ['.html', '.htm']

  static CONVERTIBLE_TEXT_LIKE_EXTENSIONS = ['.txt', '.md', '.rtf', '.csv', '.xls']

  static CONVERTIBLE_EXTENSIONS = [
    ...Object.values(Utils.OFFICE_EXTENSIONS),
    ...Utils.CONVERTIBLE_TEXT_LIKE_EXTENSIONS,
    ...Utils.CONVERTIBLE_HTML_LIKE_EXTENSIONS
  ]
  static WYSIWYG_FILE_EXTENSIONS_LIST = [
    ...Object.values(Utils.DYNADOC_EXTENSIONS),
    ...Object.values(Utils.OFFICE_EXTENSIONS)
  ]
  static NON_WYSIWYG_FILE_EXTENSIONS_LIST = [
    ...Utils.PROGRAMMING_LANGUAGE_EXTENSIONS_LIST /* Add more later */,
    ...Object.values(Utils.PREVIEWABLE_FILE_EXTENSIONS)
  ]
  // Non-editable media previews (PDF, image, video, audio). Unlike
  // NON_WYSIWYG_FILE_EXTENSIONS_LIST, this does NOT include code/text/.html, so
  // it can be used to decide things that should still apply to editor documents
  // (e.g. keeping the ribbon deployed).
  static MEDIA_PREVIEW_EXTENSIONS_LIST = [
    Utils.PDF_EXTENSION,
    ...Object.values(Utils.IMAGE_EXTENSIONS),
    ...Object.values(Utils.VIDEO_EXTENSIONS),
    ...Object.values(Utils.AUDIO_EXTENSIONS)
  ]
  /**
   * Returns an array of numbers from start (inclusive) to end (exclusive).
   * Equivalent to Python's range(start, end).
   *
   *
   *  Usage:
   *  range(0, 10, 2); // [0, 2, 4, 6, 8]
   *
   *  range(5, 0, -1); // [5, 4, 3, 2, 1]
   *
   * @param start - The starting number (inclusive).
   * @param end - The ending number (exclusive).
   * @param step - The step size (default is 1).
   * @returns number[]
   */
  public static range(start: number, end: number, step: number = 1): number[] {
    const length = Math.max(Math.ceil((end - start) / step), 0)
    return Array.from({ length }, (_, i) => start + i * step)
  }

  /**
   * Utility class for compressing and extracting `.xddoc` and `.sddoc` (custom zip-based) files.
   */
  // export class XddocUtils {
  /**
   * Compresses a folder into a `.xddoc` or `.sddoc` file (zip format with custom extension).
   *
   * @param folderPath - Path to the folder to compress.
   * @param outputFile - Destination file path (should not contain any extension like `.xddoc` or `.sddoc`).
   * @param shouldSecured - Set to true to create a `.sddoc` file (secured), false for `.xddoc` (default).
   *
   * @example
   * ```ts
   * await Utils.ddocify('./my-folder', './my-folder', true); // Creates my-folder.sddoc
   * await Utils.ddocify('./my-folder', './my-folder.xddoc'); // Creates my-folder.xddoc
   * ```
   */
  /*   static getCacheDirPath(file: string = '') {
      return nodeApi.path.join(app.getPath('userData'), app.getName(), file || '')
    }
    static getTempDirPath(file: string = '') {
      return nodeApi.path.join(app.getPath('temp'), app.getName(), file || '')
    } */

  static escapeStringOld(str: string) {
    return (
      str
        .replace(/\\/g, '\\\\') // Escape backslashes first
        .replace(/"/g, '\\"') // Escape double quotes
        .replace(/'/g, "\\'") // Escape single quotes (optional)
        .replace(/\n/g, '\\n') // Escape newlines
        .replace(/\r/g, '\\r') // Escape carriage returns
        .replace(/\t/g, '\\t') // Escape tabs
        // HTML escaping (so < and > don’t render tags),
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    )
  }

  // 1️⃣ Define the escape mapping
  static ESCAPE_MAP: Record<string, string> = {
    '\\': '\\\\',
    '"': '\\"',
    "'": "\\'",
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
    '<': '&lt;',
    '>': '&gt;'
  }

  // 2️⃣ Build reverse map for unescaping
  static UNESCAPE_MAP: Record<string, string> = Object.fromEntries(
    Object.entries(Utils.ESCAPE_MAP).map(([k, v]) => [v, k])
  )

  // 3️⃣ Escape function
  static escapeString(str: string) {
    let escaped = str
    for (const [char, replacement] of Object.entries(Utils.ESCAPE_MAP)) {
      escaped = escaped.split(char).join(replacement)
    }
    return escaped
  }

  // 4️⃣ Unescape function
  static unescapeString(str: string) {
    let unescaped = str
    // Sort by length descending to handle multi-char escapes like \\ first
    const entries = Object.entries(Utils.UNESCAPE_MAP).sort((a, b) => b[0].length - a[0].length)
    for (const [escapedChar, originalChar] of entries) {
      unescaped = unescaped.split(escapedChar).join(originalChar)
    }
    return unescaped
  }
  static getVariableType(value: any): 'string' | 'number' | 'boolean' | 'error' | 'object' {
    if (value === null || value === undefined) return 'error'
    if (typeof value === 'number' || !isNaN(Number(value))) return 'number'
    if (typeof value === 'boolean') return 'boolean'
    if (typeof value === 'string') return 'string'
    if (typeof value === 'object') return 'object'
    return 'error'
  }

  static resolveDocumentRoot(cachePath: string, documentPath?: string | null): string {
    if (!cachePath) return cachePath
    try {
      const mainFileName = Utils.MAIN_DOCUMENT_FILE
      if (documentPath && documentPath.startsWith(cachePath)) {
        const relative = nodeApi.path.relative(cachePath, documentPath)
        const parts = relative.split(nodeApi.path.sep).filter(Boolean)
        if (parts.length === 1 && parts[0] === mainFileName) {
          return cachePath
        }
        if (parts.length >= 2 && parts[1] === mainFileName) {
          return nodeApi.path.join(cachePath, parts[0])
        }
        if (parts.length >= 3 && parts[2] === mainFileName) {
          return nodeApi.path.join(cachePath, parts[0], parts[1])
        }
      }
    } catch (error) {
      console.warn('resolveDocumentRoot failed:', error)
    }
    return cachePath
  }

  // Function to save the content of the editor to file
  public static saveToFile(filePath: string, content: string): boolean {
    try {
      const safePath = normalizePathForPlatform(filePath)
      if (!safePath) {
        console.warn('saveToFile: empty path, skipping write.')
        return false
      }
      // Never write over a file whose own content could not be read. Whatever
      // the editor holds for a document it failed to load is not that
      // document, and writing it destroys content nobody has seen. The entry
      // is cleared by the next successful read of the same path.
      if (isFileUnreadable(safePath)) {
        console.error(
          'saveToFile: refusing to write over a file whose content could not be read.',
          safePath
        )
        return false
      }
      if (nodeApi.fsPromises?.writeFile) {
        void nodeApi.fsPromises.writeFile(safePath, content, 'utf-8').catch((err: any) => {
          console.error('Error writing file:', err)
        })
        return true
      }
      console.warn('saveToFile: filesystem not available.')
      return false
    } catch (err) {
      console.error('Error writing file:', err)
      return false
    }
  }

  public static saveToFileDebounced = debounce(
    async (filePath: string, content: string, onSave?: Function) => {
      console.log('debounce fileContentToSave ok', { filePath, content })
      const saved = this.saveToFile(filePath, content) // Save the content to the file
      if (saved) {
        onSave?.()
      }
    },
    1000
  )

  /* public static async saveAllTranslationsFor(originalPath: string, translatedPath: string) {
    const map = get(_$_translationPairsMap)
    const fileMap = map.get(originalPath)
    // const fileMap = map.get(__translatedPath)
    console.log('TranslationSyncControllerImpl handle saveAllTranslationsFor enter ', { map, fileMap })

    if (!fileMap) return

    const content = Array.from(fileMap.values())
      .map((p) => p.translated.get(translatedPath))
      // .map((p) => p.json)
      .filter(Boolean)

    // if (content.length<=0) return

    let updatedJson = {
      type: 'doc',
      content
    }

    // if (content.length <= 0) {
    //   updatedJson = null
    // }


    console.log('TranslationSyncControllerImpl handle saveAllTranslationsFor enter2 ', { content, updatedJson })


    if (translatedPath) {
      Utils.saveToFileDebounced(translatedPath, JSON.stringify(updatedJson, null, 2))
      return
    }
    const translatedFileIds = _$_documentEditorsList.getItem(originalPath).document?.getDocumentTranslationsFilePaths()
    // console.log('TranslationSyncControllerImpl existingTranslations y1  ', { originalPath, fileMap, map, translatedFileIds })

    // translatedFileIds
    for (let index = 0; index < translatedFileIds.length; index++) {
      const translatedFileId = translatedFileIds[index];
      // Utils.saveToFileDebounced(translatedFileId, JSON.stringify(updatedJson, null, 2))

    }

    /* await nodeApi.fsPromises.writeFile(
      translatedPath,
      JSON.stringify(updatedJson, null, 2),
      'utf-8'
    ) 
      +/

    // alert('Translations saved!')
  } */
  /**
   * Compresses a folder into a `.xddoc` or `.sddoc` file (zip format with custom extension).
   *
   * @param folderPath - Path to the folder to compress.
   * @param outputFile - Destination file path **without extension**, or with `.xddoc` or `.sddoc` extension.
   * @param shouldSecured - Set to `true` to enforce `.sddoc` extension (secured); if `false`, uses `.xddoc`. If extension is already provided, this is ignored.
   *
   * @example
   * ```ts
   * await Utils.ddocify('./my-folder', './my-folder', true); // → my-folder.sddoc
   * await Utils.ddocify('./my-folder', './my-folder.xddoc'); // → my-folder.xddoc
   * await Utils.ddocify('./my-folder', './my-folder'); // → my-folder.xddoc (default)
   * ```
   */
  static async ddocifyCorr(
    folderPath: string,
    outputFile: string,
    shouldSecured?: boolean
  ): Promise<void> {
    let finalOutput = outputFile
    // const baseName = nodeApi.path.basename(inputFile, nodeApi.path.extname(inputFile))

    // Determine extension based on inputs
    const ext = nodeApi.path.extname(outputFile).toLowerCase()
    if (ext !== this.DYNADOC_EXTENSIONS.default && ext !== this.DYNADOC_EXTENSIONS.secured) {
      const suffix = shouldSecured
        ? this.DYNADOC_EXTENSIONS.secured
        : this.DYNADOC_EXTENSIONS.default
      finalOutput = outputFile + suffix
    }

    const zipfile = new ZipFile()
    const output = nodeApi.fs.createWriteStream(finalOutput)

    zipfile.outputStream.pipe(output).on('close', () => {
      console.log('✅ Compressed to:', finalOutput)
    })

    const resolvedOutputFile = nodeApi.path.resolve(finalOutput)
    async function addFolder(currentPath: string, basePath: string = ''): Promise<void> {
      const items = await nodeApi.fsPromises.readdir(currentPath)
      for (const item of items) {
        const fullPath = nodeApi.path.join(currentPath, item)
        const relPath = nodeApi.path.join(basePath, item)

        // Skip the output file if it's inside the source directory
        if (nodeApi.path.resolve(fullPath) === resolvedOutputFile) {
          continue
        }

        const stats = await nodeApi.fsPromises.stat(fullPath)
        if (stats.isDirectory()) {
          await addFolder(fullPath, relPath)
        } else {
          zipfile.addFile(fullPath, relPath)
        }
      }
    }

    await addFolder(folderPath)
    zipfile.end()
  }

  /**
   * Compresses a folder (or file wrapped into a folder) into a `.xddoc` or `.sddoc` file.
   *
   * @param folderPath - Path to the folder or file to compress.
   * @param outputFile - Destination file path **without extension**, or with `.xddoc`/`.sddoc` extension.
   * @param shouldSecured - If true, enforce `.sddoc`. If false, `.xddoc`. If extension is provided, this is ignored.
   * @returns The full path to the created `.xddoc` or `.sddoc` file.
   *
   * @example
   * ```ts
   * await Utils.ddocify('./my-folder', './my-folder', true);  // → my-folder.sddoc
   * await Utils.ddocify('./my-folder', './my-folder.xddoc');  // → my-folder.xddoc
   * await Utils.ddocify('./my-file.txt', './archive');        // wraps into ./archive.xddoc
   * ```
   */
  static async ddocifyok(
    folderPath: string,
    outputFile: string,
    shouldSecured?: boolean
  ): Promise<string> {
    let finalOutput = outputFile

    // Ensure correct extension
    const ext = nodeApi.path.extname(outputFile).toLowerCase()
    if (ext !== this.DYNADOC_EXTENSIONS.default && ext !== this.DYNADOC_EXTENSIONS.secured) {
      const suffix = shouldSecured
        ? this.DYNADOC_EXTENSIONS.secured
        : this.DYNADOC_EXTENSIONS.default
      finalOutput = outputFile + suffix
    }

    console.log('Final output will be:', finalOutput)
    console.log('folderPath:', folderPath)
    // Handle case where input is a file (wrap in a folder)
    let sourcePath = folderPath
    const stats = await nodeApi.fsPromises.stat(folderPath)
    if (stats.isFile()) {
      const baseName = nodeApi.path.basename(folderPath, nodeApi.path.extname(folderPath))
      const parentDir = nodeApi.path.dirname(folderPath)
      const tempDir = nodeApi.path.join(parentDir, baseName, baseName)

      await nodeApi.fsPromises.mkdir(tempDir, { recursive: true })

      const destFile = nodeApi.path.join(tempDir, nodeApi.path.basename(folderPath))
      if (!(await nodeApi.fsPromises.exists(destFile))) {
        await nodeApi.fsPromises.copyFile(folderPath, destFile)
      }

      // sourcePath = destFile
      // sourcePath = nodeApi.path.join(tempDir, baseName)
      sourcePath = tempDir

      console.log('sourcePath:', sourcePath)
      console.log('destFile:', destFile)
      console.log('baseName:', baseName)
    }

    return new Promise<string>((resolve, reject) => {
      const zipfile = new ZipFile()
      const output = nodeApi.fs.createWriteStream(finalOutput)

      zipfile.outputStream.pipe(output).on('close', () => {
        console.log('✅ Compressed to:', finalOutput)
        resolve(finalOutput)
      })

      const resolvedOutputFile = nodeApi.path.resolve(finalOutput)
      async function addFolder(currentPath: string, basePath: string = ''): Promise<void> {
        const items = await nodeApi.fsPromises.readdir(currentPath)
        for (const item of items) {
          const fullPath = nodeApi.path.join(currentPath, item)
          const relPath = nodeApi.path.join(basePath, item)

          // Skip the output file if it's inside the source directory
          if (nodeApi.path.resolve(fullPath) === resolvedOutputFile) {
            continue
          }

          const stats = await nodeApi.fsPromises.stat(fullPath)
          if (stats.isDirectory()) {
            await addFolder(fullPath, relPath)
          } else {
            zipfile.addFile(fullPath, relPath)
          }
        }
      }

      try {
        addFolder(sourcePath)
          .then(() => zipfile.end())
          .catch(reject)
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Compresses a folder (or file wrapped into a folder) into a `.xddoc` or `.sddoc` file.
   *
   * @param folderPath - Path to the folder or file to compress.
   * @param outputFile - Destination file path **without extension**, or with `.xddoc`/`.sddoc` extension.
   * @param shouldSecured - If true, enforce `.sddoc`. If false, `.xddoc`. If extension is provided, this is ignored.
   * @returns The full path to the created `.xddoc` or `.sddoc` file.
   *
   * @example
   * ```ts
   * await Utils.ddocify('./my-folder', './my-folder', true);  // → my-folder.sddoc
   * await Utils.ddocify('./my-folder', './my-folder.xddoc');  // → my-folder.xddoc
   * await Utils.ddocify('./my-file.txt', './archive');        // wraps into ./archive.xddoc
   * ```
   */
  static async ddocify(
    pipelineStream,
    folderPath: string,
    outputFile: string,
    shouldSecured?: boolean
  ): Promise<string> {
    let finalOutput = outputFile

    // Ensure correct extension
    const ext = nodeApi.path.extname(outputFile).toLowerCase()
    if (ext !== this.DYNADOC_EXTENSIONS.default && ext !== this.DYNADOC_EXTENSIONS.secured) {
      const suffix = shouldSecured
        ? this.DYNADOC_EXTENSIONS.secured
        : this.DYNADOC_EXTENSIONS.default
      finalOutput = outputFile + suffix
    }

    // Handle case where input is a file (wrap it in a folder)
    let sourcePath = folderPath
    let topFolderName = ''
    // let topFolderName = nodeApi.path.basename(folderPath)
    const stats = await nodeApi.fsPromises.stat(folderPath)

    if (stats.isFile()) {
      const baseName = nodeApi.path.basename(folderPath, nodeApi.path.extname(folderPath))
      const parentDir = nodeApi.path.dirname(folderPath)
      const tempDir = nodeApi.path.join(parentDir, baseName)

      await nodeApi.fsPromises.mkdir(tempDir, { recursive: true })

      const destFile = nodeApi.path.join(tempDir, this.MAIN_DOCUMENT_FILE) //
      // const destFile = nodeApi.path.join(tempDir, nodeApi.path.basename(folderPath))
      if (!(await nodeApi.fsPromises.exists(destFile))) {
        await nodeApi.fsPromises.copyFile(folderPath, destFile)
      }

      sourcePath = tempDir
      // topFolderName = baseName
    }

    /* if (shouldSecured) {
      if (typeof window !== 'undefined' && (window as any)?.api?.ddocify) {
        return (window as any).api.ddocify(sourcePath, finalOutput, true)
      }
      throw new Error('Secure .sddoc packaging must be handled by the middleware (sddoc:pack).')
    } */
    return this.zipDirectory(sourcePath, finalOutput, topFolderName)
  }

  /**
   * Extracts a `.xddoc` or `.sddoc` file (zip format) into a subfolder inside outputDir
   * using the base name of the archive as subfolder name.
   *
   * @param inputFile - Path to the `.xddoc` or `.sddoc` file.
   * @param outputDir - Directory to extract contents into.
   * @returns The full path to the extracted folder.
   *
   * @example
   * ```ts
   * await Utils.unddocify('./my-folder.sddoc', './extracted');
   * ```
   */
  static async unddocify(
    pipelineStream,
    inputFile: string,
    outputDir: string,
    isSecured: boolean = false
  ): Promise<string> {
    let destDir = nodeApi.path.join(outputDir)
    // const destDir = nodeApi.path.join(outputDir)
    // const destDir = nodeApi.path.join(outputDir, baseName)

    console.log('Unddocifying', inputFile, 'to', destDir, 'baseName', baseName, isSecured)

    await nodeApi.fsPromises.mkdir(destDir, { recursive: true })

    /* if (isSecured) {
      if (typeof window !== 'undefined' && (window as any)?.api?.unddocify) {
        return (window as any).api.unddocify(inputFile, destDir, true)
      }
      throw new Error('Secure .sddoc unpack must be handled by the middleware (sddoc:unpack).')
    } */
    return this.unzipFile(pipelineStream, inputFile, destDir)

    /* return new Promise<string>((resolve, reject) => {
      yauzl.open(inputFile, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) return reject(err)

        zipfile.readEntry()

        zipfile.on('entry', (entry) => {
          // const destPath = nodeApi.path.join(destDir)
          const destPath = nodeApi.path.join(destDir, entry.fileName)

          if (/\/$/.test(entry.fileName)) {
            await nodeApi.fsPromises.mkdir(destPath, { recursive: true })
            zipfile.readEntry()
          } else {
            zipfile.openReadStream(entry, async (err, readStream) => {
              if (err || !readStream) return reject(err)

              const dir = nodeApi.path.dirname(destPath)
              await nodeApi.fsPromises.mkdir(dir, { recursive: true })

              const writeStream = nodeApi.fs.createWriteStream(destPath)
              await pipelineStream(readStream, writeStream)
              zipfile.readEntry()
            })
          }
        })

        zipfile.on('end', () => {
          destDir = nodeApi.path.join(outputDir, baseName)
          console.log('✅ Extracted to:', destDir)
          resolve(destDir)
        })

        zipfile.on('error', reject)
      })
    }) */
  }

  // const pipelineStream = promisify(pipeline)

  /**
   * Zip a directory into a .zip file.
   * @param sourcePath - folder to zip
   * @param outputFile - destination zip file
   * @param topFolderName - name of the top folder inside zip
   */
  static zipDirectory(
    sourcePath: string,
    outputFile: string,
    topFolderName?: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const zipfile = new ZipFile()
      const output = nodeApi.fs.createWriteStream(outputFile)

      zipfile.outputStream.pipe(output).on('close', () => {
        console.log('✅ Compressed to:', outputFile)
        resolve(outputFile)
      })

      const MAX_BUFFER_BYTES = 32 * 1024 * 1024
      const resolvedOutputFile = nodeApi.path.resolve(outputFile)
      const addFolder = async (currentPath: string, basePath: string = ''): Promise<void> => {
        const items = await nodeApi.fsPromises.readdir(currentPath)
        for (const item of items) {
          const fullPath = nodeApi.path.join(currentPath, item)
          const relPath = nodeApi.path.join(basePath, item)

          // Skip the output file if it's inside the source directory
          if (nodeApi.path.resolve(fullPath) === resolvedOutputFile) {
            continue
          }

          const stats = await nodeApi.fsPromises.stat(fullPath)
          if (stats.isDirectory()) {
            await addFolder(fullPath, relPath)
          } else {
            if (stats.size <= MAX_BUFFER_BYTES) {
              const buf = await nodeApi.fsPromises.readFile(fullPath)
              zipfile.addBuffer(buf, relPath, { mtime: stats.mtime, mode: stats.mode })
            } else {
              zipfile.addFile(fullPath, relPath)
            }
          }
        }
      }

      try {
        addFolder(sourcePath, topFolderName ?? nodeApi.path.basename(sourcePath))
          .then(() => zipfile.end())
          .catch(reject)
      } catch (err) {
        reject(err)
      }
    })
  }

  static async waitForStableDirectory(
    dirPath: string,
    options: { stableMs?: number; timeoutMs?: number; intervalMs?: number } = {}
  ): Promise<void> {
    const stableMs = options.stableMs ?? Utils.ZIP_STABLE_REQUIRED_MS
    const timeoutMs = options.timeoutMs ?? Utils.ZIP_STABLE_TIMEOUT_MS
    const intervalMs = options.intervalMs ?? Utils.ZIP_STABLE_INTERVAL_MS

    const scan = async (root: string, out: Map<string, number>) => {
      const entries = await nodeApi.fsPromises.readdir(root, { withFileTypes: true })
      for (const entry of entries) {
        const full = nodeApi.path.join(root, entry.name)
        if (entry.isDirectory()) {
          await scan(full, out)
        } else if (entry.isFile()) {
          const stat = await nodeApi.fsPromises.stat(full)
          out.set(full, stat.size)
        }
      }
    }

    const start = Date.now()
    let lastSnapshot: Map<string, number> | null = null
    let stableFor = 0

    while (Date.now() - start < timeoutMs) {
      const snapshot = new Map<string, number>()
      await scan(dirPath, snapshot)
      if (lastSnapshot && Utils.mapsEqual(lastSnapshot, snapshot)) {
        stableFor += intervalMs
        if (stableFor >= stableMs) return
      } else {
        stableFor = 0
      }
      lastSnapshot = snapshot
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  /**
   * Unzip a zip file into a target directory.
   * @param inputFile - zip file to extract
   * @param outputDir - target directory
   */
  /*  static unzipFile11(pipelineStream, inputFile: string, outputDir: string): Promise<string> {
    return new Promise((resolve, reject) => {
      yauzl.open(inputFile, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) return reject(err)

        zipfile.readEntry()

        zipfile.on('entry', async (entry) => {
          const destPath = nodeApi.path.join(outputDir, entry.fileName)

          if (/\/$/.test(entry.fileName)) {
            // directory
            await nodeApi.fsPromises.mkdir(destPath, { recursive: true })
            zipfile.readEntry()
          } else {
            // file
            zipfile.openReadStream(entry, async (err, readStream) => {
              if (err || !readStream) return reject(err)

              const dir = nodeApi.path.dirname(destPath)
              await nodeApi.fsPromises.mkdir(dir, { recursive: true })

              const writeStream = nodeApi.fs.createWriteStream(destPath)
              await pipelineStream(readStream, writeStream)
              zipfile.readEntry()
            })
          }
        })

        zipfile.on('end', () => {
          console.log('✅ Extracted to:', outputDir)
          resolve(outputDir)
        })

        zipfile.on('error', reject)
      })
    })
  } */

  static unzipFile(pipelineStream, inputFile: string, outputDir: string): Promise<string> {
    return new Promise((resolve, reject) => {
      yauzl.open(inputFile, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) return reject(err)

        const topLevelEntries = new Set<string>()
        const topLevelFiles = new Set<string>()

        zipfile.readEntry()

        zipfile.on('entry', (entry) => {
          const normalizedName = entry.fileName.replace(/\\/g, '/').replace(/^\/+/, '')
          const [firstSegment] = normalizedName.split('/').filter(Boolean)
          if (firstSegment) {
            topLevelEntries.add(firstSegment)
            if (!normalizedName.includes('/')) {
              topLevelFiles.add(firstSegment)
            }
          }
          const destPath = nodeApi.path.join(outputDir, entry.fileName)
          const isDirectory = /\/$/.test(entry.fileName)

          // Wrap the processing in a self-contained async logic
          ;(async () => {
            try {
              if (isDirectory) {
                await nodeApi.fsPromises.mkdir(destPath, { recursive: true })
              } else {
                const dir = nodeApi.path.dirname(destPath)
                await nodeApi.fsPromises.mkdir(dir, { recursive: true })

                // Use a helper to promisify the openReadStream
                await new Promise((resStream, rejStream) => {
                  zipfile.openReadStream(entry, async (err, readStream) => {
                    if (err || !readStream) return rejStream(err)

                    const writeStream = nodeApi.fs.createWriteStream(destPath)
                    try {
                      await pipelineStream(readStream, writeStream)
                      resStream(true)
                    } catch (e) {
                      rejStream(e)
                    }
                  })
                })
              }
              // ONLY call readEntry after the previous file is 100% written
              zipfile.readEntry()
            } catch (e) {
              zipfile.close()
              reject(e)
            }
          })()
        })

        zipfile.on('end', () => {
          if (topLevelEntries.size === 1 && topLevelFiles.size === 0) {
            resolve(nodeApi.path.join(outputDir, Array.from(topLevelEntries)[0]))
            return
          }
          resolve(outputDir)
        })
        zipfile.on('error', (err) => {
          zipfile.close()
          reject(err)
        })
      })
    })
  }

  public static async saveEncryptedDdoc(pipelineStream, cacheDir, outputPath, password) {
    console.log('outputPath saveEncryptedDdoc ', cacheDir, outputPath, password)
    //  let topFolderName = nodeApi.path.basename(folderPath)
    // const tempEncryptedDir = nodeApi.path.join("enc_tmp", window.getTempDir());
    const tempEncryptedDir = nodeApi.path.join(
      nodeApi.path.parse(cacheDir).dir,
      'enc_tmp',
      nodeApi.path.parse(cacheDir).name
    )
    // const tempEncryptedDir = nodeApi.path.join("enc_tmp", nodeApi.path.parse(cacheDir).name);
    // const tempEncryptedDir = nodeApi.path.parse(outputPath).name;
    // const tempEncryptedDir = outputPath + "_enc_tmp"

    await SecurityHelpers.encryptDirectoryRecursiveStream(
      pipelineStream,
      cacheDir,
      tempEncryptedDir,
      password
    )
    // await SecurityHelpers.encryptDirectoryRecursive(pipelineStream,cacheDir, tempEncryptedDir, password)

    await Utils.zipDirectory(tempEncryptedDir, outputPath) // uses archiver or AdmZip

    await nodeApi.fsPromises.rm(tempEncryptedDir, { recursive: true, force: true })

    console.log('outputPath end saveEncryptedDdoc ', outputPath, tempEncryptedDir)
    return outputPath
  }

  public static async loadEncryptedSddoc(pipelineAsync, sddocPath, outputCacheDir, password) {
    // const tempUnzip = outputCacheDir
    const tempUnzip = nodeApi.path.join(outputCacheDir, '..')
    // const tempUnzip = outputCacheDir
    // const tempUnzip = nodeApi.path.join(outputCacheDir,"..", "enc_unzip_tmp");
    // const tempUnzip = nodeApi.path.join(outputCacheDir, "enc_unzip_tmp");
    await nodeApi.fsPromises.mkdir(tempUnzip, { recursive: true })
    console.log('outputPath loadEncryptedSddoc ', sddocPath, outputCacheDir, password)
    // const tempUnzip = outputCacheDir + "_unzip_tmp"

    // const pipelineAsync = promisify(pipeline)

    let unzipDir = await Utils.unzipFile(pipelineAsync, sddocPath, tempUnzip) // unzip first

    // unzipDir = nodeApi.path.join(unzipDir, nodeApi.path.parse(sddocPath).name);

    // await SecurityHelpers.decryptDirectoryRecursiveStream(pipelineAsync, unzipDir, outputCacheDir, password)

    // await SecurityHelpers.decryptDirectoryRecursive(unzipDir, outputCacheDir, password)

    // await nodeApi.fsPromises.rm(tempUnzip, { recursive: true, force: true })
    console.log('outputPath end loadEncryptedSddoc ', unzipDir, tempUnzip, password)

    // return unzipDir
    return outputCacheDir
  }

  public static async loadEncryptedSddoc1(pipelineAsync, sddocPath, outputCacheDir, password) {
    // const tempUnzip = outputCacheDir
    const tempUnzip = nodeApi.path.join(outputCacheDir, '..', 'enc_unzip_tmp')
    // const tempUnzip = nodeApi.path.join(outputCacheDir, "enc_unzip_tmp");
    await nodeApi.fsPromises.mkdir(tempUnzip, { recursive: true })
    console.log('outputPath loadEncryptedSddoc ', sddocPath, outputCacheDir, password)
    // const tempUnzip = outputCacheDir + "_unzip_tmp"

    // const pipelineAsync = promisify(pipeline)

    let unzipDir = await Utils.unzipFile(pipelineAsync, sddocPath, tempUnzip) // unzip first

    unzipDir = nodeApi.path.join(unzipDir, nodeApi.path.parse(sddocPath).name)

    await SecurityHelpers.decryptDirectoryRecursiveStream(
      pipelineAsync,
      unzipDir,
      outputCacheDir,
      password
    )

    // await SecurityHelpers.decryptDirectoryRecursive(unzipDir, outputCacheDir, password)

    // await nodeApi.fsPromises.rm(tempUnzip, { recursive: true, force: true })
    console.log('outputPath end loadEncryptedSddoc ', unzipDir, tempUnzip, password)

    // return unzipDir
    return outputCacheDir
  }
  /**
   * Deletes old files/folders from a directory based on age.
   *
   * @param dir - The cache directory to clean.
   * @param maxAgeMs - Max age in milliseconds. Default: 1 hour.
   * @param extensions - File extensions to match (e.g., ['.xddoc', '.sddoc']). If empty, all files are considered.
   * Usage
   * import { app } from 'electron';
    import path from 'path';
    import { Utils } from './utils/ddoc-utils';

    app.whenReady().then(async () => {
      const cacheDir = nodeApi.path.join(app.getPath('cache'), 'xddoc-cache');
      await Utils.cleanOldCache(cacheDir, 6 * 60 * 60 * 1000, ['.xddoc', '.sddoc']); // 6 hours
    });

   */

  // public static async rollupBundle(sourceCode) {
  //   try {

  //     console.log("sourceCode ", sourceCode)

  //     const svelteFile = nodeApi.path.join(process.cwd(), 'test', 'test.svelte'); // adjust if needed
  //     const appFile = nodeApi.path.join(process.cwd(), 'test', 'app.js'); // adjust if needed

  //     const bundle = await rollup(

  //       {
  //         input: {
  //           app: appFile,
  //           // index2:'./src/index2.js',
  //         },
  //         preserveEntrySignatures: 'strict',
  //         external: [
  //           'svelte',
  //           'svelte/animate',
  //           'svelte/easing',
  //           'svelte/motion',
  //           'svelte/store',
  //           'svelte/transition',
  //           'svelte/internal',
  //           'svelte/internal/client',
  //           // 'svelte/internal/client/reactivity',
  //           // 'svelte/internal/shared/attributes',
  //           // 'svelte/internal/shared/clone',
  //           // 'svelte/internal/shared/errors',
  //           // 'svelte/internal/shared/validate',
  //           // 'svelte/internal/shared/warnings'
  //         ],
  //         output: {
  //           sourcemap: process.env.NODE_ENV != "production",
  //           format: 'es',
  //           name: 'app',
  //           dir: 'build',
  //           manualChunks: undefined
  //         },
  //         plugins: [
  //           svelte({ emitCss: true }),
  //           css({ minify: true, output: 'index.css' }),
  //           resolve(),
  //           // terser()
  //         ]
  //       }
  //       /* {
  //       input: appFile,
  //       plugins: [
  //         svelte({
  //           compilerOptions: {
  //             dev: false
  //           }
  //         }),
  //         css({ output: 'bundle.css' }),
  //         resolve({
  //           browser: true,
  //           dedupe: ['svelte']
  //         }),
  //         commonjs(),
  //         // terser()
  //       ]
  //     } */
  //     );

  //     await bundle.write({
  //       file: 'out/bundle.js',
  //       format: 'es', // ready for <script type="module">
  //       sourcemap: true,
  //     });

  //     await bundle.close();
  //     console.log('✅ Build complete! Output in ./out');

  //   } catch (error) {
  //     console.error("ESBUILD BUNDLING ERROR:", error.message);
  //     return null;
  //   }
  // }

  //   public static async esbuildBundle(sourceCode): Promise<esbuild.BuildResult> {
  //     try {

  //       console.log("sourceCode ", sourceCode)

  //       // const result = await esbuild.build({
  //       //   /* stdin: {
  //       //     contents: sourceCode,
  //       //     resolveDir: '.', // optional, for relative imports
  //       //     sourcefile: 'App.svelte',
  //       //     loader: 'js'
  //       //   },
  //       //   bundle: true,
  //       //   write: false, // important: keep it in memory
  //       //   plugins: [sveltePlugin()],
  //       // } */
  //       //   stdin: {
  //       //     contents: sourceCode,
  //       //     resolveDir: process.cwd(), // Resolve modules relative to the current working directory
  //       //     loader: 'js',
  //       //     sourcefile: 'App.svelte', // Important: .svelte extension triggers the plugin
  //       //     // loader: 'jsx',
  //       //   },
  //       //   bundle: true,        // CRITICAL: Tells esbuild to resolve and combine all imports
  //       //   format: 'esm',       // CRITICAL: Output as a standard ES Module (for browser dynamic import)
  //       //   platform: 'browser', // CRITICAL: Target browser runtime
  //       //   write: false,        // Don't write to disk, return the output object
  //       //   outdir: 'out',       // Required even with write: false
  //       //   logLevel: 'silent',  // Keep console clean
  //       //   plugins: [sveltePlugin()],
  //       // }
  //       // );

  //       const svelteFile = nodeApi.path.join(process.cwd(), 'test', 'test.svelte'); // adjust if needed
  //       // const appFile = nodeApi.path.join(process.cwd(), 'test', 'app.js'); // adjust if needed
  //       const result = await esbuild
  //         .build({
  //           entryPoints: [svelteFile],
  //           mainFields: ["svelte", "browser", "module", "main"],
  //           conditions: ["svelte", "browser"],
  //           outdir: "out",
  //           format: "esm",
  //           logLevel: "info",
  //           minify: false, //so the resulting code is easier to understand
  //           bundle: true,
  //           splitting: true,
  //           sourcemap: "inline",
  //           plugins: [
  //             /* esbuildSvelte({
  //               preprocess: sveltePreprocess(),
  //             }), */
  //             sveltePlugin()
  //           ],
  //         })

  //         /* const bundle = await rollup({
  //     input: appFile,
  //     plugins: [
  //       svelte({
  //         compilerOptions: {
  //           dev: false
  //         }
  //       }),
  //       css({ output: 'bundle.css' }),
  //       resolve({
  //         browser: true,
  //         dedupe: ['svelte']
  //       }),
  //       commonjs(),
  //       // terser()
  //     ]
  //   });

  //   await bundle.write({
  //     file: 'out/bundle.js',
  //     format: 'es', // ready for <script type="module">
  //     sourcemap: true,
  //   });

  //   await bundle.close();
  //   console.log('✅ Build complete! Output in ./out');
  //  */
  //       /* const result = await esbuild.build({
  //         entryPoints: [svelteFile], // path to your Svelte file
  //         // stdin: {
  //         //   contents: sourceCode,
  //         //   resolveDir: process.cwd(),       // Resolve modules relative to current working directory
  //         //   sourcefile: 'App.svelte',        // Important: .svelte extension triggers the plugin
  //         //   loader: 'js',                     // Let the plugin handle Svelte compilation
  //         // },
  //         mainFields: ["svelte", "browser", "module", "main"],
  //         conditions: ["svelte", "browser"],

  //         bundle: true,                       // Resolve and combine all imports
  //         format: 'esm',                      // Output as standard ES Module
  //         platform: 'browser',                // Target browser runtime
  //         // write: false,                        // <-- now writes files to disk
  //         write: true,                        // <-- now writes files to disk
  //         outdir: 'out',                      // Directory where files will be written
  //         logLevel: 'info',                   // Show build messages
  //         plugins: [sveltePlugin()],
  //       }); */

  //       /* const result = await esbuild.build({
  //         // Use stdin to pass the source code string directly to esbuild
  //         stdin: {
  //           contents: sourceCode,
  //           resolveDir: process.cwd(), // Resolve modules relative to the current working directory
  //           loader: 'js',
  //         },
  //         bundle: true,        // CRITICAL: Tells esbuild to resolve and combine all imports
  //         format: 'esm',       // CRITICAL: Output as a standard ES Module (for browser dynamic import)
  //         platform: 'browser', // CRITICAL: Target browser runtime
  //         write: false,        // Don't write to disk, return the output object
  //         outdir: 'out',       // Required even with write: false
  //         logLevel: 'silent',  // Keep console clean
  //       }); */
  //       /* console.log("ESBUILD BUNDLING ERROR:", result);

  //       // The bundled code is in the 'outputFiles' array
  //       if (result.outputFiles.length > 0) {
  //         return result
  //         // return result.outputFiles[0].text;
  //       } */

  //       throw new Error("Esbuild bundling failed to produce output.");

  //     } catch (error) {
  //       console.error("ESBUILD BUNDLING ERROR:", error.message);
  //       return null;
  //     }
  //   }
  static measureRender(autoName?: string) {
    const name = autoName || import.meta.url.split('/').pop()?.replace('.svelte', '') || 'Unknown'

    const start = performance.now()

    onMount(() => {
      const end = performance.now()
      console.log(`⏱ ${name} rendered in ${(end - start).toFixed(2)} ms`)
    })
  }

  static async cleanOldCache(
    dir: string,
    maxAgeMs: number = 60 * 60 * 1000,
    extensions: string[] = []
  ): Promise<void> {
    if (!(await nodeApi.fsPromises.exists(dir))) return

    const now = Date.now()

    for (const file of await nodeApi.fsPromises.readdir(dir)) {
      const filePath = nodeApi.path.join(dir, file)
      const stat = await nodeApi.fsPromises.stat(filePath)

      const isTooOld = now - stat.mtimeMs > maxAgeMs

      const isMatchingExt =
        extensions.length === 0 ||
        extensions.some((ext) => file.toLowerCase().endsWith(ext.toLowerCase()))

      if (isTooOld && isMatchingExt) {
        await nodeApi.fsPromises.rm(filePath, { recursive: true, force: true })
        console.log(`🗑️ Deleted: ${filePath}`)
      }
    }
  }

  static mapsEqual(a: Map<string, number>, b: Map<string, number>): boolean {
    if (a.size !== b.size) return false
    for (const [key, value] of a.entries()) {
      if (b.get(key) !== value) return false
    }
    return true
  }
}
