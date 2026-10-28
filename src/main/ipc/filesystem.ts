import { ipcMain } from 'electron'
import fs from 'fs'
import fsp from 'fs/promises'
import { FS_CHANNELS, type FsDirEntry, type FsStat, type FsSyncResult } from './filesystemContract'
import { FsAccessError, requirePath } from './filesystemPolicyHost'
import type { FsError } from '../utils/FilesystemPathPolicy'

/**
 * The filesystem channels the renderer's nodeApi shim is routed at.
 *
 * Every handler calls requirePath first and then operates on what it returns,
 * never on the path that arrived: the two differ whenever a symlink is
 * involved, and acting on the original is how a check that passed becomes an
 * operation somewhere else.
 *
 * Shape follows filesystemContract.ts, which is where the reasoning lives.
 */

/** Turn any thrown error into the tagged shape the renderer can branch on. */
function toFsError(error: unknown, requestedPath?: string): FsError {
  if (error instanceof FsAccessError) {
    return { code: error.code, message: error.message, path: requestedPath }
  }
  const code = (error as { code?: string } | null)?.code
  if (code === 'ENOENT') {
    return { code: 'NOT_FOUND', message: 'No such file or directory.', path: requestedPath }
  }
  return {
    code: 'IO',
    message: error instanceof Error ? error.message : String(error),
    path: requestedPath
  }
}

function toStat(stats: fs.Stats): FsStat {
  return {
    size: stats.size,
    modifiedMs: stats.mtimeMs,
    isFile: stats.isFile(),
    isDirectory: stats.isDirectory()
  }
}

/**
 * Synchronous channels answer through event.returnValue, which cannot carry a
 * rejection, so they return a tagged union and the preload re-throws. That
 * keeps one behaviour for callers: every failure is an exception, whichever
 * transport it came over.
 */
function handleSync<T>(channel: string, run: (resolved: string) => T): void {
  ipcMain.on(channel, (event, requestedPath: string) => {
    try {
      const value = run(requirePath(requestedPath))
      event.returnValue = { ok: true, value } satisfies FsSyncResult<T>
    } catch (error) {
      event.returnValue = {
        ok: false,
        error: toFsError(error, requestedPath)
      } satisfies FsSyncResult<T>
    }
  })
}

export function registerFilesystemIpc(): void {
  // --- metadata, synchronous -------------------------------------------------
  // These two keep their synchronous signature so their callers, and their
  // callers' callers, do not have to change. A sendSync round trip costs
  // roughly 0.1-1ms against microseconds for a direct syscall: fine for a
  // scattered existence check, which is why loops are audited rather than
  // converted blindly.
  handleSync<boolean>(FS_CHANNELS.exists, (resolved) => fs.existsSync(resolved))
  handleSync<FsStat>(FS_CHANNELS.stat, (resolved) => toStat(fs.statSync(resolved)))

  // --- everything else, asynchronous ---------------------------------------
  ipcMain.handle(FS_CHANNELS.readFile, async (_event, filePath: string, encoding?: 'utf-8') => {
    const resolved = requirePath(filePath)
    return encoding === undefined
      ? new Uint8Array(await fsp.readFile(resolved))
      : await fsp.readFile(resolved, encoding)
  })

  ipcMain.handle(
    FS_CHANNELS.writeFile,
    async (_event, filePath: string, data: string | Uint8Array, encoding?: 'utf-8') => {
      const resolved = requirePath(filePath)
      // The parent has to exist for a write; creating it silently would make
      // mkdir meaningless and hide a wrong path.
      await fsp.writeFile(
        resolved,
        typeof data === 'string' ? data : Buffer.from(data),
        encoding ? { encoding } : undefined
      )
    }
  )

  ipcMain.handle(FS_CHANNELS.readDir, async (_event, dirPath: string): Promise<FsDirEntry[]> => {
    const resolved = requirePath(dirPath)
    const entries = await fsp.readdir(resolved, { withFileTypes: true })
    return entries.map((entry) => ({
      name: entry.name,
      isFile: entry.isFile(),
      isDirectory: entry.isDirectory()
    }))
  })

  ipcMain.handle(
    FS_CHANNELS.mkdir,
    async (_event, dirPath: string, options?: { recursive?: boolean }) => {
      await fsp.mkdir(requirePath(dirPath), { recursive: options?.recursive === true })
    }
  )

  ipcMain.handle(
    FS_CHANNELS.remove,
    async (_event, targetPath: string, options?: { recursive?: boolean }) => {
      const resolved = requirePath(targetPath)
      const stats = await fsp.stat(resolved)
      if (stats.isDirectory()) {
        // recursive is opt-in: an accidental directory path should fail rather
        // than take the subtree with it.
        await fsp.rm(resolved, { recursive: options?.recursive === true })
      } else {
        await fsp.unlink(resolved)
      }
    }
  )

  // Both ends of a two-path operation are checked. Allowing either end
  // unchecked allows the operation.
  ipcMain.handle(FS_CHANNELS.rename, async (_event, fromPath: string, toPath: string) => {
    await fsp.rename(requirePath(fromPath), requirePath(toPath))
  })

  ipcMain.handle(FS_CHANNELS.copyFile, async (_event, fromPath: string, toPath: string) => {
    await fsp.copyFile(requirePath(fromPath), requirePath(toPath))
  })

  console.log(`[fs-ipc] registered ${Object.keys(FS_CHANNELS).length} filesystem channels`)
}
