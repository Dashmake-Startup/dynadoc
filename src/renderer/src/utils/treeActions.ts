import { get } from 'svelte/store'
import { _ } from 'svelte-i18n'
import { nodeApi } from './shims/node'
import { DocumentModel } from '../models/Document'
import { DriveActions } from './driveActions'
import EditorCommonUtils from './common.utils'
import Utils from './Utils'
import { openAlertModal } from '../stores/alertModal.store'
import { openConfirmModal } from '../stores/confirmModal.store'
import { _$_recentDocuments } from '../stores/common.store'
import { _$_documentEditorsList } from '../stores/editor.store'
import { DocumentEditorModel } from '../models/Document'

export type TreeSourceType = 'local' | 'drive'

export interface TreeActionOptions {
  sourceType?: TreeSourceType
  accountOrg?: string
  rootPath?: string
  rootParentPath?: string
  onRefresh?: (pathToExpand?: string) => void
  onNotify?: (message: string) => void
  onSelect?: (path: string) => void
  onCompleted?: (path: string) => void
}

export interface FileNode {
  name: string
  path: string
  isFolder: boolean
  displayName?: string
  isMainFile?: boolean
  isAssetFile?: boolean
  isDocumentContent?: boolean
  isLocked?: boolean
}

const t = (key: string, values?: any) => get(_)(key, { values })

export class TreeActions {
  static validateFileName(name: string): { ok: boolean; error?: string } {
    if (!name || !name.trim()) return { ok: false, error: 'Name cannot be empty' }
    if (name.length > 255) return { ok: false, error: 'Name is too long (max 255 chars)' }
    if (name.startsWith('/') || name.startsWith('\\')) return { ok: false, error: 'Name cannot start with / or \\' }
    
    // Standard unauthorized characters: < > : " / \ | ? *
    // We allow / because Task 4 says test/doc is good behavior
    const unauthorized = /[<>:"\\|?*]/;
    if (unauthorized.test(name)) {
        return { ok: false, error: 'Name contains unauthorized characters' }
    }
    return { ok: true }
  }


  static normalizeDrivePath(value: string) {
    const raw = String(value || '').trim()
    if (!raw || raw === '/' || raw === '.') return ''
    return raw
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/{2,}/g, '/')
  }

  static driveJoin(...parts: string[]) {
    return this.normalizeDrivePath(parts.filter(Boolean).join('/'))
  }

  static driveBasename(targetPath: string) {
    const normalized = this.normalizeDrivePath(targetPath)
    if (!normalized) return ''
    const split = normalized.split('/').filter(Boolean)
    return split[split.length - 1] || ''
  }

  static driveDirname(targetPath: string) {
    const normalized = this.normalizeDrivePath(targetPath)
    if (!normalized) return ''
    const idx = normalized.lastIndexOf('/')
    if (idx < 0) return ''
    return normalized.slice(0, idx)
  }

  static pathExists(filePath: string) {
    try {
      return nodeApi.fs.existsSync(filePath)
    } catch {
      return false
    }
  }

  static ensureUniquePath(targetPath: string) {
    if (!this.pathExists(targetPath)) return targetPath

    const parsed = nodeApi.path.parse(targetPath)
    let index = 2
    let candidate = nodeApi.path.join(parsed.dir, `${parsed.name} ${index}${parsed.ext}`)
    while (this.pathExists(candidate)) {
      index += 1
      candidate = nodeApi.path.join(parsed.dir, `${parsed.name} ${index}${parsed.ext}`)
    }
    return candidate
  }

  static ensureDocumentExtension(fileName: string, enforce = true, defaultExt = '') {
    const normalized = fileName.trim()
    if (!normalized) return normalized
    if (!enforce) {
      if (defaultExt && !normalized.includes('.')) {
        return `${normalized}${defaultExt}`
      }
      return normalized
    }
    if (normalized.toLowerCase().endsWith(Utils.DOCUMENT_FILE_EXTENSION.toLowerCase()))
      return normalized
    return `${normalized}${Utils.DOCUMENT_FILE_EXTENSION}`
  }

  static async createFileAt(
    targetDir: string,
    fileName: string,
    initialContent = '',
    options: TreeActionOptions & { enforceDocumentExtension?: boolean; defaultFileExtension?: string } = {}
  ) {
    console.log('[createFileAt] Creating file at', { targetDir, fileName, options })
    const validation = this.validateFileName(fileName)
    if (!validation.ok) {
        await openAlertModal({ title: t('Create file'), message: validation.error || 'Invalid name' })
        return null
    }
    console.log('[createFileAt] Creating file at 22', { targetDir, fileName, options })

    const finalName = this.ensureDocumentExtension(
      fileName,
      options.enforceDocumentExtension ?? true,
      options.defaultFileExtension
    )

    const isDrive = options.sourceType === 'drive'
    let fullPath: string
    console.log('[createFileAt] Creating file at', { fullPath, finalName, options, isDrive })

    if (isDrive) {
      fullPath = this.driveJoin(targetDir, finalName)
      /* const encoder = new TextEncoder()
      const bytes = encoder.encode(initialContent || '')
      let binary = ''
      bytes.forEach((b) => { binary += String.fromCharCode(b) })
      const base64 = btoa(binary)
      const result = await DriveActions.uploadFiles(
        (options.accountOrg ? { accountOrg: options.accountOrg } : {}) as any,
        {
          path: fullPath,
          name: finalName,
          data: base64
        } as any
      )
      if (!result?.ok) {
        await openAlertModal({ title: t('Create file'), message: result?.message || 'Create file failed' })
        return null
      } */
    } else {
      fullPath = this.ensureUniquePath(nodeApi.path.join(targetDir, finalName))
    }
    const actualBaseDir = isDrive ? this.driveDirname(fullPath) : nodeApi.path.dirname(fullPath)
    await DocumentModel.createNewDocumentFile(actualBaseDir, options.rootPath || '', fullPath, null, null, initialContent)


    console.log('[createFileAt] Creating file at 22', { fullPath, finalName, options, isDrive })

    const isHtmlDoc = !isDrive && finalName.toLowerCase().endsWith(Utils.MAIN_DOCUMENT_FILE_EXTENSION)


    options.onRefresh?.(targetDir)
    options.onSelect?.(fullPath)
    options.onNotify?.(t('[createFileAt] Created file: {name}', { name: isDrive ? finalName : nodeApi.path.basename(fullPath) }))

    if (isHtmlDoc) {
      await EditorCommonUtils.addNewDocumentEditor(fullPath, options.rootParentPath || null)
    }

    options.onCompleted?.(fullPath)
    console.log('[createFileAt] Creating file at 33', { targetDir, fullPath, finalName, options, isDrive })

    // await scheduleDriveSyncForPath(fullPath)
    return fullPath


  }

  static async createFolderAt(targetDir: string, folderName: string, options: TreeActionOptions = {}) {
    const validation = this.validateFileName(folderName)
    if (!validation.ok) {
        await openAlertModal({ title: t('Create folder'), message: validation.error || 'Invalid name' })
        return null
    }

    const isDrive = options.sourceType === 'drive'
    let fullPath: string

    if (isDrive) {
      fullPath = this.driveJoin(targetDir, folderName)
      const result = await DriveActions.mkdir(
        (options.accountOrg ? { accountOrg: options.accountOrg, path: fullPath } : { path: fullPath })
      )
      if (!result?.ok) {
        await openAlertModal({ title: t('Create folder'), message: result?.message || 'Create folder failed' })
        return null
      }
    } else {
      fullPath = this.ensureUniquePath(nodeApi.path.join(targetDir, folderName))
      await nodeApi.fsPromises.mkdir(fullPath, { recursive: true })
    }

    options.onRefresh?.(targetDir)
    options.onSelect?.(fullPath)
    options.onNotify?.(t('Created folder: {name}', { name: isDrive ? folderName : nodeApi.path.basename(fullPath) }))

    return fullPath
  }

  static async renameItem(item: FileNode, newName: string, options: TreeActionOptions = {}) {
    if (newName === item.name) return null
    const validation = this.validateFileName(newName)
    if (!validation.ok || newName.includes('/')) {
        await openAlertModal({ title: t('Rename'), message: validation.error || (newName.includes('/') ? 'Rename cannot contain /' : 'Invalid name') })
        return null
    }
    if (item.isMainFile) {
      await openAlertModal({ title: t('Rename'), message: t('The main index.html file cannot be renamed.') })
      return null
    }

    const isDrive = options.sourceType === 'drive'
    let newPath: string | null = null

    if (isDrive) {
      const from = this.normalizeDrivePath(item.path)
      const to = this.driveJoin(this.driveDirname(from), newName)
      const result = await DriveActions.moveItem(
        (options.accountOrg ? { accountOrg: options.accountOrg, from, to } : { from, to })
      )
      if (!result?.ok) {
        await openAlertModal({ title: t('Rename'), message: result?.message || 'Rename failed' })
        return null
      }
      newPath = result.path || to
    } else {
      const finalName = item.isFolder ? newName : this.ensureDocumentExtension(newName)
      newPath = await (window as any).api.renameFile(item.path, finalName)
      if (!newPath) {
        await openAlertModal({ title: t('Rename'), message: t('Rename failed') })
        return null
      }
    }

    if (newPath) {
      this.updateEditorsAfterMove(item.path, newPath, isDrive)
      options.onRefresh?.(isDrive ? this.driveDirname(item.path) : nodeApi.path.dirname(item.path))
      options.onSelect?.(newPath)
    }

    return newPath
  }

  static updateEditorsAfterMove(oldPath: string, newPath: string, isDrive: boolean) {
    if (!oldPath || !newPath || oldPath === newPath) return

    const rewritePathPrefix = (value: string | null | undefined, fromPath: string, toPath: string) => {
      if (!value) return value || ''
      if (isDrive) {
        const normalizedValue = this.normalizeDrivePath(value)
        const from = this.normalizeDrivePath(fromPath)
        const to = this.normalizeDrivePath(toPath)
        if (normalizedValue === from) return to
        if (normalizedValue.startsWith(`${from}/`))
          return `${to}${normalizedValue.slice(from.length)}`
        return value
      }
      const normalizedValue = nodeApi.path.normalize(value)
      const from = nodeApi.path.normalize(fromPath)
      if (normalizedValue === from) return toPath
      if (normalizedValue.startsWith(`${from}${nodeApi.path.sep}`))
        return `${toPath}${value.slice(from.length)}`
      return value
    }

    const newDocName = isDrive ? this.driveBasename(newPath) : nodeApi.path.basename(newPath)

    _$_documentEditorsList.update((list) => {
      return (Array.isArray(list) ? list : []).map((editor) => {
        const doc = editor?.document
        if (!doc) return editor
        let changed = false

        const nextCachePath = rewritePathPrefix(doc.cachePath, oldPath, newPath)
        if (nextCachePath && nextCachePath !== doc.cachePath) {
          doc.cachePath = nextCachePath
          changed = true
        }

        const nextDirPath = rewritePathPrefix(doc.dirPath, oldPath, newPath)
        if (nextDirPath && nextDirPath !== doc.dirPath) {
          doc.dirPath = nextDirPath
          changed = true
        }

        const nextPath = rewritePathPrefix(doc.path, oldPath, newPath)
        if (nextPath && nextPath !== doc.path) {
          doc.path = nextPath
          changed = true
        }

        const nextParentPath = rewritePathPrefix(doc.parentPath, oldPath, newPath)
        if (nextParentPath && nextParentPath !== doc.parentPath) {
          doc.parentPath = nextParentPath
          changed = true
        }

        if (changed) {
          doc.documentMainFileTranslations = doc.getDocumentTranslations(
            doc.getMainFilePath() || doc.cachePath
          )
          doc.vars = doc.getVarsFilePath()
          doc.backgroundDesignFilePath = doc.getBgDesignFilePath()
          if (newDocName && (doc.path.endsWith(Utils.MAIN_DOCUMENT_FILE) || doc.cachePath === newPath)) {
            doc.name = newDocName
          }
          return new DocumentEditorModel({ ...editor, document: doc })
        }
        return editor
      })
    })

    _$_recentDocuments.update((list) => {
      const next = Array.isArray(list) ? [...list] : []
      return next.map((entry) => {
        const updatedPath = rewritePathPrefix(entry.path, oldPath, newPath)
        const updatedParent = rewritePathPrefix(entry.parentPath, oldPath, newPath)
        if (updatedPath === entry.path && updatedParent === entry.parentPath) return entry
        return {
          ...entry,
          path: updatedPath || entry.path,
          parentPath: updatedParent || entry.parentPath,
          name: newDocName || entry.name
        }
      })
    })
  }

  static async deleteItem(item: FileNode, options: TreeActionOptions = {}) {
    const isDrive = options.sourceType === 'drive'

    if (item.isMainFile) {
      const ok = await openConfirmModal({
        title: t('Delete document'),
        message: t('Delete the entire document "{name}"?', { name: item.displayName || item.name }),
        confirmText: t('Delete document'),
        destructive: true
      })
      if (!ok) return false
      const docRoot = isDrive ? this.driveDirname(item.path) : nodeApi.path.dirname(item.path)
      if (isDrive) {
        const deleted = await DriveActions.deleteItem(
          (options.accountOrg ? { accountOrg: options.accountOrg, path: this.normalizeDrivePath(docRoot) } : { path: this.normalizeDrivePath(docRoot) })
        )
        if (!deleted?.ok) {
          await openAlertModal({ title: t('Delete'), message: deleted?.message || t('Delete failed') })
          return false
        }
      } else {
        const deleted = await (window as any).api.deleteFile(docRoot)
        if (!deleted) {
          await openAlertModal({ title: t('Delete'), message: t('Delete failed') })
          return false
        }
      }
      options.onRefresh?.(isDrive ? this.driveDirname(docRoot) : nodeApi.path.dirname(docRoot))
      return true
    }

    const ok = await openConfirmModal({
      title: t('Delete item'),
      message: t('Delete "{name}"?', { name: item.name }),
      confirmText: t('Delete'),
      destructive: true
    })
    if (!ok) return false

    if (isDrive) {
      const deleted = await DriveActions.deleteItem(
        (options.accountOrg ? { accountOrg: options.accountOrg, path: this.normalizeDrivePath(item.path) } : { path: this.normalizeDrivePath(item.path) })
      )
      if (!deleted?.ok) {
        await openAlertModal({ title: t('Delete'), message: deleted?.message || t('Delete failed') })
        return false
      }
    } else {
      const deleted = await (window as any).api.deleteFile(item.path)
      if (!deleted) {
        await openAlertModal({ title: t('Delete'), message: t('Delete failed') })
        return false
      }
    }

    options.onRefresh?.(isDrive ? this.driveDirname(item.path) : nodeApi.path.dirname(item.path))
    return true
  }

  static async duplicateItem(item: FileNode, options: TreeActionOptions = {}) {
    const isDrive = options.sourceType === 'drive'
    let newPath: string | null = null

    if (isDrive) {
      const from = this.normalizeDrivePath(item.path)
      const parentDir = this.driveDirname(from)
      const base = this.driveBasename(from)
      const extIndex = item.isFolder ? -1 : base.lastIndexOf('.')
      const baseName = extIndex > 0 ? base.slice(0, extIndex) : base
      const ext = extIndex > 0 ? base.slice(extIndex) : ''
      const to = this.driveJoin(parentDir, `${baseName} copy${ext}`)
      const result = await DriveActions.copyItem(
        (options.accountOrg ? { accountOrg: options.accountOrg, from, to } : { from, to })
      )
      if (!result?.ok) {
        await openAlertModal({ title: t('Duplicate'), message: result?.message || 'Duplicate failed' })
        return null
      }
      newPath = result.path || to
      options.onRefresh?.(parentDir)
    } else {
      const parentDir = nodeApi.path.dirname(item.path)
      const parsed = nodeApi.path.parse(item.path)
      const initial = nodeApi.path.join(parentDir, `${parsed.name} copy${parsed.ext}`)
      newPath = initial
      if (this.pathExists(initial)) {
        let index = 2
        newPath = nodeApi.path.join(parentDir, `${parsed.name} copy ${index}${parsed.ext}`)
        while (this.pathExists(newPath)) {
          index += 1
          newPath = nodeApi.path.join(parentDir, `${parsed.name} copy ${index}${parsed.ext}`)
        }
      }
      await this.copyEntryRecursive(item.path, newPath)
      if (!item.isFolder) {
          await this.transferSidecars(item.path, newPath, true, false)
      }
      options.onRefresh?.(parentDir)
    }

    if (newPath) options.onSelect?.(newPath)
    return newPath
  }

  static async copyEntryRecursive(sourcePath: string, destinationPath: string) {
    const stats = await nodeApi.fsPromises.lstat(sourcePath)
    if (stats.isDirectory()) {
      await nodeApi.fsPromises.mkdir(destinationPath, { recursive: true })
      const children = await nodeApi.fsPromises.readdir(sourcePath)
      for (const child of children) {
        await this.copyEntryRecursive(
          nodeApi.path.join(sourcePath, child),
          nodeApi.path.join(destinationPath, child)
        )
      }
      return
    }

    await nodeApi.fsPromises.mkdir(nodeApi.path.dirname(destinationPath), { recursive: true })
    const content = await nodeApi.fsPromises.readFile(sourcePath)
    await nodeApi.fsPromises.writeFile(destinationPath, content)
  }


  static async transferSidecars(sourcePath: string, destinationPath: string, isCopy: boolean, isDrive: boolean, accountOrg?: string) {
    if (isDrive) return
    
    const sourceDir = nodeApi.path.dirname(sourcePath)
    const destDir = nodeApi.path.dirname(destinationPath)
    
    const oldName = nodeApi.path.basename(sourcePath)
    const oldBase = nodeApi.path.basename(oldName, nodeApi.path.extname(oldName))
    const newName = nodeApi.path.basename(destinationPath)
    const newBase = nodeApi.path.basename(newName, nodeApi.path.extname(newName))

    try {
      const entries = await nodeApi.fsPromises.readdir(sourceDir)
      const prefix = `${oldBase}.`
      
      for (const entry of entries) {
        if (entry !== oldName && entry.startsWith(prefix)) {
          const suffix = entry.slice(prefix.length)
          const targetName = `${newBase}.${suffix}`
          const from = nodeApi.path.join(sourceDir, entry)
          const to = nodeApi.path.join(destDir, targetName)
          
          try {
            if (isCopy) {
              await this.copyEntryRecursive(from, to)
            } else {
              await nodeApi.fsPromises.rename(from, to)
            }
          } catch (err) {
            console.error('Sidecar transfer error:', err)
          }
        }
      }
    } catch (err) {
      console.error('Failed to read directory for sidecar transfer:', err)
    }
  }

  static buildSidecarPaths(item: { path: string; isFolder: boolean }, isDrive: boolean) {
    if (item.isFolder) return []
    const baseDir = isDrive ? this.driveDirname(item.path) : nodeApi.path.dirname(item.path)
    const baseFile = isDrive ? this.driveBasename(item.path) : nodeApi.path.basename(item.path)
    const baseName = baseFile.replace(new RegExp(`${nodeApi.path.extname(baseFile)}$`), '')
    if (!baseDir || !baseName) return []
    const candidates = [
      `${baseName}.${Utils.DOCUMENT_INFO_FILE_NAME}${Utils.DOCUMENT_INFO_FILE_EXTENSION}`,
      `${baseName}.${Utils.DOCUMENT_CONFIG_FILE_NAME}${Utils.DOCUMENT_CONFIG_FILE_EXTENSION}`,
      `${baseName}.${Utils.DOCUMENT_SYSTEM_INFO_FILE_NAME}${Utils.DOCUMENT_SYSTEM_INFO_FILE_EXTENSION}`,
      `${baseName}.meta.json`
    ]
    if (isDrive) return candidates.map((name) => this.driveJoin(baseDir, name))
    return candidates.map((name) => nodeApi.path.join(baseDir, name))
  }

  static hasChangesSince(cachePath: string, sinceMs: number) {
    if (!nodeApi.fs || !nodeApi.path) return true
    if (!cachePath || !sinceMs) return true
    try {
      const shadowRoot = nodeApi.path.join(cachePath, '.dynadoc-shadow')
      const stack: string[] = [cachePath]
      while (stack.length) {
        const current = stack.pop()
        if (!current) continue
        if (current === shadowRoot) continue
        let entries: string[] = []
        try {
          entries = nodeApi.fs.readdirSync(current)
        } catch {
          continue
        }
        for (const entry of entries) {
          const full = nodeApi.path.join(current, entry)
          if (full.startsWith(shadowRoot + nodeApi.path.sep)) continue
          if (entry.startsWith('.') && entry.length > 1) {
            if (!entry.includes('.html') && !entry.includes('.json')) continue
          }
          let stat: any
          try {
            stat = nodeApi.fs.statSync(full)
          } catch {
            continue
          }
          if (stat.isDirectory()) {
            stack.push(full)
            continue
          }
          if (stat.mtimeMs > sinceMs) return true
        }
      }
    } catch {
      return true
    }
    return false
  }

  static async handleInternalTransfer(
    meta: { path: string; sourceType: TreeSourceType; accountOrg?: string; isFolder: boolean },
    destinationDir: string,
    isCopy: boolean,
    options: TreeActionOptions = {}
  ) {
    const sourcePath = meta.path
    const sourceType = meta.sourceType
    const sourceOrg = meta.accountOrg || ''
    const sourceIsFolder = Boolean(meta.isFolder)
    const destinationIsDrive = options.sourceType === 'drive'
    const driveAccountOrg = options.accountOrg || ''

    const destinationPath = destinationIsDrive
      ? this.driveJoin(destinationDir, this.driveBasename(sourcePath))
      : this.ensureUniquePath(nodeApi.path.join(destinationDir, nodeApi.path.basename(sourcePath)))

    if (sourceType === 'drive' && destinationIsDrive) {
      if (sourceOrg === driveAccountOrg) {
        if (isCopy) {
          const copied = await DriveActions.copyItem(
            (driveAccountOrg ? { accountOrg: driveAccountOrg, from: this.normalizeDrivePath(sourcePath), to: this.normalizeDrivePath(destinationPath) } : { from: this.normalizeDrivePath(sourcePath), to: this.normalizeDrivePath(destinationPath) })
          )
          if (!copied?.ok) throw new Error(copied?.message || 'Copy failed')
          return copied?.path || destinationPath
        } else {
          const moved = await DriveActions.moveItem(
            (driveAccountOrg ? { accountOrg: driveAccountOrg, from: this.normalizeDrivePath(sourcePath), to: this.normalizeDrivePath(destinationPath) } : { from: this.normalizeDrivePath(sourcePath), to: this.normalizeDrivePath(destinationPath) })
          )
          if (!moved?.ok) throw new Error(moved?.message || 'Move failed')
          const actualTo = moved.path || destinationPath
          this.updateEditorsAfterMove(sourcePath, actualTo, true)
          return actualTo
        }
      } else {
        if (sourceIsFolder) {
          throw new Error('Cross-account folder transfer is not supported yet.')
        }
        // Cross-account file transfer (Download then Upload)
        const downloadedResult = await DriveActions.downloadItem(
          (sourceOrg ? { accountOrg: sourceOrg, path: this.normalizeDrivePath(sourcePath) } : { path: this.normalizeDrivePath(sourcePath) })
        )
        if (!downloadedResult?.ok || !downloadedResult.savePath) throw new Error(downloadedResult?.message || 'Download failed')
        const downloadedPath = downloadedResult.savePath

        const upload = await DriveActions.uploadFiles(
          (driveAccountOrg ? { accountOrg: driveAccountOrg, path: this.normalizeDrivePath(destinationDir), localPaths: [downloadedPath] } : { path: this.normalizeDrivePath(destinationDir), localPaths: [downloadedPath] }) as any
        )
        if (!upload?.ok) throw new Error(upload?.message || 'Upload failed')
        if (!isCopy) {
          const deleted = await DriveActions.deleteItem(
            (sourceOrg ? { accountOrg: sourceOrg, path: this.normalizeDrivePath(sourcePath) } : { path: this.normalizeDrivePath(sourcePath) })
          )
          if (!deleted?.ok) console.error('Cleanup of source file failed', deleted?.message)
        }
        return destinationPath
      }
    }

    if (sourceType === 'local' && !destinationIsDrive) {
      // Local to Local
      if (isCopy) {
        await this.copyEntryRecursive(sourcePath, destinationPath)
        if (!sourceIsFolder) {
            await this.transferSidecars(sourcePath, destinationPath, true, false)
        }
      } else {
        await nodeApi.fsPromises.rename(sourcePath, destinationPath)
        if (!sourceIsFolder) {
            await this.transferSidecars(sourcePath, destinationPath, false, false)
        }
        this.updateEditorsAfterMove(sourcePath, destinationPath, false)
      }
      return destinationPath
    }

    if (sourceType === 'drive' && !destinationIsDrive) {
      // Drive to Local (Download)
      const result = await DriveActions.downloadItem(
        (sourceOrg ? { accountOrg: sourceOrg, path: this.normalizeDrivePath(sourcePath), savePath: destinationPath, archive: sourceIsFolder } : { path: this.normalizeDrivePath(sourcePath), savePath: destinationPath, archive: sourceIsFolder })
      )
      if (!result?.ok) throw new Error(result?.message || 'Download failed')
      return destinationPath
    }

    if (sourceType === 'local' && destinationIsDrive) {
      // Local to Drive (Upload)
      // Simplified for now (single file)
      const stats = await nodeApi.fsPromises.stat(sourcePath)
      if (stats.isDirectory()) {
        throw new Error('Local folder upload via transfer is not fully implemented in TreeActions yet')
      }
      const upload = await DriveActions.uploadFiles(
        (driveAccountOrg ? { accountOrg: driveAccountOrg, path: this.normalizeDrivePath(destinationDir), localPaths: [sourcePath] } : { path: this.normalizeDrivePath(destinationDir), localPaths: [sourcePath] }) as any
      )
      if (!upload?.ok) throw new Error(upload?.message || 'Upload failed')
      if (!isCopy) {
        await nodeApi.fsPromises.rm(sourcePath, { recursive: true })
      }
      return destinationPath
    }

    throw new Error('Unsupported transfer mode')
  }

  static async importExternalPath(sourcePath: string, destinationDir: string, options: TreeActionOptions = {}) {
    if (!nodeApi.fs || !nodeApi.path) return null
    const base = nodeApi.path.basename(sourcePath)

    if (options.sourceType === 'drive') {
      const to = this.driveJoin(destinationDir, base)
      // Implementation for importing to drive...
      return to
    } else {
      const to = this.ensureUniquePath(nodeApi.path.join(destinationDir, base))
      await this.copyEntryRecursive(sourcePath, to)
      return to
    }
  }
}
