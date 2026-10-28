import type { FsError } from '../utils/FilesystemPathPolicy'

/**
 * The filesystem surface the renderer will be given in place of `window.node`.
 *
 * Declared here, on its own, before anything is wired: the shape is the part
 * worth arguing about, and it is easier to argue about on one page than spread
 * across a migration. Nothing in this file is registered or called yet -- that
 * is the next step of the Block A plan.
 *
 * Three decisions are encoded here.
 *
 * 1. Which calls are synchronous.
 *
 *    Metadata reads are synchronous, everything else is not. `existsSync` and
 *    `statSync` are cheap and fixed-cost, and keeping their signature means
 *    their callers -- and their callers' callers -- do not have to change.
 *    ipcRenderer.sendSync carries them and stays synchronous across
 *    contextBridge; that was verified in a real isolated window before this
 *    shape was chosen.
 *
 *    Measured on src/renderer, excluding the web and mobile drivers, the
 *    nodeApi shim and the build scripts, counting invocations rather than
 *    touch points and skipping commented-out lines:
 *
 *      git grep -nE '\.[a-zA-Z]*Sync\s*\(' -- src/renderer
 *
 *      existsSync     33  ) keep their signature
 *      statSync        2  )
 *      readFileSync   12
 *      readdirSync     9
 *      writeFileSync   8
 *      mkdirSync       6
 *      lstatSync       2
 *      unlinkSync      2
 *      rmdirSync       2
 *      copyFileSync    1
 *
 *    So 35 of 77 keep their shape and 42 change -- a little under half, not
 *    the three quarters an earlier draft of this file claimed. The figure is
 *    written with its command so the next person can re-derive it instead of
 *    trusting it; it moves every time dead code is deleted, and #101 moved it
 *    already.
 *
 *    The cost is real and bounded: a sendSync round trip is roughly 0.1-1ms
 *    against microseconds for a direct syscall. Fine for a scattered existence
 *    check, not fine inside a loop, which is why the migration audits loops
 *    rather than converting everything blindly.
 *
 * 2. Everything except exists and stat loses its synchronous form.
 *
 *    Named in full, because an earlier draft listed only the first two and the
 *    rest would have been discovered during the migration instead of before
 *    it: readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync,
 *    rmdirSync, copyFileSync and lstatSync all become asynchronous. The
 *    surface below offers no synchronous twin for any of them.
 *
 *    readFileSync and writeFileSync are the clearest case -- their duration
 *    scales with the file, so a synchronous version would block the renderer
 *    for as long as the disk takes. The directory and unlink calls follow for
 *    consistency rather than cost: one synchronous exception would invite the
 *    next.
 *
 *    The migration is smaller than the raw count suggests. Of the 42 calls
 *    that change, spread over 27 files, roughly a third already sit inside an
 *    `async` function and need only an `await`. The remainder are the real
 *    work, and they cluster: pptxImport.ts alone holds six, and
 *    EditorHelpers.ts, documentFileUtils.ts, ChartNodeView.svelte and
 *    GenericFormatingEditorCommands.svelte.ts hold two each. This is tens of
 *    sites in a handful of files, not the hundred-odd the first survey of the
 *    filesystem surface suggested.
 *
 * 3. Failure is never a value.
 *
 *    Every call either returns its result or fails with an FsError carrying a
 *    code. The renderer must be able to tell "refused" from "absent" from
 *    "broken", because the three call for different handling, and today it
 *    cannot: `read-file` returns the string `Error reading file: ...` in place
 *    of the file's contents, and `move-file` returns null. Both are
 *    success-shaped, and a caller that forgets to look cannot tell.
 *
 *    Asynchronous channels reject, so `await` throws. Synchronous channels
 *    cannot throw across sendSync, so they return a tagged union and the
 *    preload re-throws on the renderer side, giving callers one behaviour.
 */

/** Channel names. Prefixed so they cannot collide with the existing handlers. */
export const FS_CHANNELS = {
  // Metadata, synchronous (ipcMain.on + event.returnValue).
  exists: 'fs:exists.sync',
  stat: 'fs:stat.sync',

  // Everything else, asynchronous (ipcMain.handle).
  readFile: 'fs:readFile',
  writeFile: 'fs:writeFile',
  readDir: 'fs:readDir',
  mkdir: 'fs:mkdir',
  remove: 'fs:remove',
  rename: 'fs:rename',
  copyFile: 'fs:copyFile'
} as const

export type FsChannel = (typeof FS_CHANNELS)[keyof typeof FS_CHANNELS]

/** What a synchronous channel puts in `event.returnValue`. */
export type FsSyncResult<T> = { ok: true; value: T } | { ok: false; error: FsError }

export interface FsStat {
  size: number
  /** Epoch milliseconds, so the value survives structured cloning unchanged. */
  modifiedMs: number
  isFile: boolean
  isDirectory: boolean
}

export interface FsDirEntry {
  name: string
  isFile: boolean
  isDirectory: boolean
}

/**
 * The surface, as the renderer will see it once the preload wraps these
 * channels. Written as an interface so the wiring step has something to
 * implement against rather than invent.
 */
export interface FilesystemApi {
  /** Synchronous. False for a path that does not exist; throws when refused. */
  existsSync(filePath: string): boolean
  /** Synchronous. Throws NOT_FOUND rather than returning a null-ish stat. */
  statSync(filePath: string): FsStat

  readFile(filePath: string, encoding?: 'utf-8'): Promise<string>
  readFileBytes(filePath: string): Promise<Uint8Array>
  writeFile(filePath: string, data: string | Uint8Array, encoding?: 'utf-8'): Promise<void>
  readDir(dirPath: string): Promise<FsDirEntry[]>
  mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void>
  remove(targetPath: string, options?: { recursive?: boolean }): Promise<void>
  rename(fromPath: string, toPath: string): Promise<void>
  copyFile(fromPath: string, toPath: string): Promise<void>
}

/**
 * Deliberately absent, and each for a reason:
 *
 *   createReadStream / createWriteStream
 *     A stream cannot cross contextBridge. The renderer's twelve uses are two
 *     problems rather than twelve: six feed yazl/yauzl archives, which the web
 *     build already solves with shims at src/renderer/src/utils/shims/, and six
 *     are chunked encryption in SecurityHelpers, which also needs Node's
 *     `crypto` and so belongs to that decision.
 *
 *   watch / watchFile
 *     No renderer call site. Adding it would widen the surface for nothing.
 *
 *   chmod / chown / symlink / realpath
 *     No renderer call site, and each is a way to reach outside the policy or
 *     to change what a later check would resolve to.
 *
 *   readFileSync / writeFileSync
 *     See decision 2 above.
 */
export const DELIBERATELY_ABSENT = [
  'createReadStream',
  'createWriteStream',
  'watch',
  'watchFile',
  'chmod',
  'chown',
  'symlink',
  'realpath',
  'readFileSync',
  'writeFileSync'
] as const
