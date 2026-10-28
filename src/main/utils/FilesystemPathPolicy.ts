import fs from 'fs'
import path from 'path'

/**
 * Policy for which paths the renderer may read and write through IPC.
 *
 * SPEC-001 Block A takes direct disk access away from the renderer. That is
 * only worth doing if what replaces it is narrower: a channel that accepts any
 * absolute path is the same hole with more steps, reachable by any script that
 * a forged document manages to run.
 *
 * Two kinds of path are legitimate, and they need different treatment:
 *
 *   Roots    Directories the application owns -- its document store, its cache,
 *            its temp area. Known at startup, always allowed, subtree included.
 *
 *   Grants   Paths the user picked themselves, through an open/save dialog or
 *            by dropping a file on the window. A document editor cannot work
 *            without these and no static list can predict them, so they are
 *            recorded at the moment of the choice. A grant on a file allows
 *            that file; a grant on a directory allows its subtree, because the
 *            file tree browses folders.
 *
 * Grants are held here, in the main process, and never travel to the renderer:
 * a renderer that could mint its own grant would make the policy decorative.
 *
 * Kept free of Electron imports so it can be exercised directly, like
 * ExternalOpenPolicy next to it.
 */

/**
 * WHAT THIS POLICY DOES NOT STOP. Written down because each one is cheap to
 * rediscover expensively.
 *
 * Hardlinks. realpath resolves symlinks; it does not resolve a hardlink,
 * because a hardlink is not a reference to another path -- it is another name
 * for the same inode. A hardlink planted inside a root that points at
 * /outside/secret.txt is inside the root by every test here, and reading it
 * returns the other file's contents. This is the exact edge of what "resolve
 * before comparing" buys. It is survivable only because `link` is not on the
 * surface, so the renderer cannot create one; anything that extracts an
 * archive into a root must refuse hardlink entries, as it must refuse symlink
 * entries.
 *
 * Time-of-check to time-of-use. The decision and the operation are two
 * syscalls apart, so a path that passes can be replaced by a symlink before it
 * is opened. The window is small here because `symlink` is not on the surface
 * either, so the renderer has no way to plant one. It is not closed: the older
 * unvalidated handlers remain registered alongside this surface, and some of
 * them are worse than anything discussed here -- `delete-file` in
 * src/main/index.ts takes any path and removes it recursively, with no check
 * at all. That is a hole in what ships today, not a future one, and it is not
 * fixed by adding this policy next to it. Retiring those handlers is part of
 * the wiring step, and until it happens this surface narrows one road while
 * the old one stays open.
 *
 * Windows path syntax. \\?\ prefixes, alternate data streams (file.txt:hidden)
 * and 8.3 short names are not handled, and the CI gate runs on Linux only, so
 * neither they nor the case-folding branch below are exercised there. On a
 * Linux runner `canonicalKey` never folds case, so the macOS and Windows
 * behaviour of every grant comparison is untested by the gate that guards it.
 */

/** Why a path was refused. The renderer must be able to tell these apart. */
export type FsErrorCode = 'DENIED' | 'NOT_FOUND' | 'IO' | 'INVALID'

export interface FsError {
  code: FsErrorCode
  message: string
  /** The path as asked for, never the resolved one: that would leak layout. */
  path?: string
}

export type PathDecision = { allowed: true; resolved: string } | { allowed: false; error: FsError }

/**
 * A path the user chose. `directory` grants the subtree; otherwise only the
 * file itself.
 */
export interface PathGrant {
  path: string
  directory: boolean
}

export class FilesystemPathPolicy {
  private readonly roots: string[] = []
  private readonly grants = new Map<string, boolean>()

  /**
   * @param roots Directories the application owns. Passed in rather than read
   *   from Electron here, so this class stays testable and the caller decides
   *   what "ours" means.
   */
  constructor(roots: readonly string[] = []) {
    for (const root of roots) this.addRoot(root)
  }

  addRoot(root: string): void {
    const resolved = this.resolveExistingPrefix(root)
    if (resolved && !this.roots.includes(resolved)) this.roots.push(resolved)
  }

  /**
   * Records a path the user chose.
   *
   * HOW THIS MUST BE CALLED, because getting it wrong makes the whole policy
   * decorative and the wrong way is one line away:
   *
   *   There must be no IPC channel that takes a path and grants it. The
   *   renderer must never be able to say "grant me /etc". Every grant has to
   *   originate inside main, in the same function that learns the path from
   *   the user.
   *
   *   Dialogs: call this *inside* the showOpenDialog / showSaveDialog handlers
   *   (src/main/index.ts), on the result, before it is returned to the
   *   renderer. The path exists in main before the renderer ever sees it.
   *
   *   Drops: harder, because today the renderer holds the string. The preload
   *   exposes getFilePath(file) -> webUtils.getPathForFile (src/preload,
   *   called from TreeView.svelte and App.svelte), so a dropped file's path is
   *   already a bare string in renderer hands. A grant channel taking that
   *   string would let any renderer code mint grants.
   *
   *   The safe shape is a preload function that takes the File object, calls
   *   webUtils.getPathForFile and sends the result to main *in the same
   *   function* -- grantDroppedFile(file: File). The string is derived and
   *   consumed without ever being returned to the renderer, so it cannot be
   *   substituted. The renderer gets back only a boolean, or the path it is
   *   now allowed to open.
   *
   * Returns the decision rather than nothing. A path that cannot be resolved
   * is refused, and the caller is told: silently dropping it is how a user
   * ends up watching a file they just chose fail to open with no explanation.
   * A dangling symlink reaches here as INVALID, which is correct, and the
   * caller should surface it rather than swallow it.
   */
  grant(grant: PathGrant): PathDecision {
    if (typeof grant?.path !== 'string' || grant.path.trim() === '') {
      return {
        allowed: false,
        error: { code: 'INVALID', message: 'A grant needs a non-empty path.' }
      }
    }

    const resolved = this.resolveForComparison(grant.path)
    if (!resolved) {
      return {
        allowed: false,
        error: {
          code: 'INVALID',
          message:
            'That path could not be resolved, so it was not granted. A broken symlink reaches here.',
          path: grant.path
        }
      }
    }

    // A grant on the filesystem root, or on the user's home directory, is not
    // a choice -- it is everything. The dialog cannot produce them by accident
    // but a restored grants file can, so they are refused here rather than at
    // load time, where one caller would forget.
    if (grant.directory && isTooBroadToGrant(resolved)) {
      return {
        allowed: false,
        error: {
          code: 'DENIED',
          message: 'A directory grant may not be the filesystem root or the home directory.',
          path: grant.path
        }
      }
    }

    this.grants.set(canonicalKey(resolved), grant.directory)
    return { allowed: true, resolved }
  }

  /**
   * For persistence across restarts, so reopening a recent file still works.
   *
   * WHERE THIS MUST NOT BE WRITTEN: not under any root. userData/storage is a
   * root -- the renderer already writes its own JSON there. A grants file
   * inside a root would let a write that the policy permitted manufacture the
   * grants of the next launch, which is the policy forging its own successor.
   * It belongs beside the roots, in userData itself, with userData never being
   * a root.
   *
   * It must also not be derived from the renderer's recent-documents list
   * (src/renderer/src/stores/common.store.ts persists one). That list is the
   * renderer's own data, so deriving grants from it is the same forging
   * channel through a different door. Recents are for display; opening one
   * without a grant means a dialog, pre-filled with that path.
   */
  exportGrants(): PathGrant[] {
    return [...this.grants].map(([p, directory]) => ({ path: p, directory }))
  }

  /**
   * Decides whether `candidate` may be touched.
   *
   * Symlinks are the reason this resolves before comparing: a link inside the
   * document store pointing at /etc would otherwise pass a textual prefix test.
   * The target of a write often does not exist yet, so the nearest existing
   * ancestor is resolved and the remaining segments are appended. Nothing in
   * `pending` can be `..`: path.resolve collapsed those before the climb
   * started, and that -- not any later check -- is what stops textual
   * traversal.
   *
   * Callers must act on `resolved`, never on the path they were given. The two
   * can differ: `path.resolve` collapses `..` textually, while the kernel
   * resolves a symlink before applying the `..` that follows it. For a root
   * /R containing a link L -> /outside, "/R/L/../x" resolves textually to
   * "/R/x" -- inside the root, correctly allowed -- but opening the original
   * string lands on "/outside/../x". Using `resolved` is what makes the
   * decision and the operation agree.
   */
  check(candidate: unknown): PathDecision {
    if (typeof candidate !== 'string' || candidate.trim() === '') {
      return {
        allowed: false,
        error: { code: 'INVALID', message: 'A filesystem path must be a non-empty string.' }
      }
    }

    // A NUL byte truncates the path inside the C filesystem calls, so a value
    // that passes this check is not the value that gets opened.
    if (candidate.includes('\0')) {
      return {
        allowed: false,
        error: {
          code: 'INVALID',
          message: 'A filesystem path must not contain a NUL byte.',
          path: candidate
        }
      }
    }

    // A relative path would be resolved against the main process's working
    // directory, which makes the decision depend on where the app was started
    // from. No legitimate caller sends one to a filesystem IPC.
    if (!path.isAbsolute(candidate)) {
      return {
        allowed: false,
        error: {
          code: 'INVALID',
          message: 'A filesystem path must be absolute.',
          path: candidate
        }
      }
    }

    const resolved = this.resolveForComparison(candidate)
    if (!resolved) {
      return {
        allowed: false,
        error: { code: 'INVALID', message: 'Path could not be resolved.', path: candidate }
      }
    }

    for (const root of this.roots) {
      if (isInside(resolved, root)) return { allowed: true, resolved }
    }

    const key = canonicalKey(resolved)
    for (const [granted, directory] of this.grants) {
      // A file grant used to compare with ===, which refused the same file
      // under a different case or a different unicode form. isInside already
      // folds case off Linux, so === was also inconsistent with it. macOS
      // hands back NFD from the filesystem and NFC from a dialog for the same
      // name, so an accented filename -- "café.docx" -- was refused outright.
      if (directory ? isInside(resolved, granted) : key === granted) {
        return { allowed: true, resolved }
      }
    }

    return {
      allowed: false,
      error: {
        code: 'DENIED',
        message:
          'This path is outside the application’s own folders, and the user has not chosen it through a dialog or a drop.',
        path: candidate
      }
    }
  }

  /**
   * Resolves as far as the filesystem currently goes, then re-appends the parts
   * that do not exist yet. Returns null when a remaining segment is `..`,
   * which can only be an attempt to climb out of the resolved prefix.
   */
  private resolveForComparison(candidate: string): string | null {
    const absolute = path.resolve(candidate)
    let existing = absolute
    const pending: string[] = []

    while (!entryExists(existing)) {
      const parent = path.dirname(existing)
      if (parent === existing) return null
      pending.unshift(path.basename(existing))
      existing = parent
    }

    let base: string
    try {
      base = fs.realpathSync(existing)
    } catch {
      return null
    }

    return pending.length > 0 ? path.join(base, ...pending) : base
  }

  private resolveExistingPrefix(value: string): string | null {
    if (typeof value !== 'string' || value.trim() === '') return null
    return this.resolveForComparison(value)
  }
}

/**
 * Whether the entry itself is there, as opposed to whatever it points at.
 *
 * fs.existsSync follows symlinks, so a link whose target is missing reads as
 * absent. The climb above would then walk straight past it and re-append its
 * name as though it were a component that does not exist yet -- handing back a
 * resolved path inside the root. Writing to that path follows the link and
 * lands wherever it points: a dangling link planted in the document store is
 * a write anywhere on disk, through a decision that said "allowed".
 *
 * lstatSync stops at the link, so the climb halts on it and realpathSync then
 * fails on the broken target, which is the refusal we want. The same change
 * closes the other reasons existsSync answers false without the entry being
 * absent, such as EACCES on an ancestor.
 */
function entryExists(target: string): boolean {
  try {
    fs.lstatSync(target)
    return true
  } catch {
    return false
  }
}

/**
 * The form a path is stored and compared in.
 *
 * Case is folded off Linux, matching isInside and the comparison already used
 * in src/main/index.ts. Unicode is normalised to NFC because macOS returns NFD
 * for a name read from the filesystem and NFC for the same name chosen in a
 * dialog; without this, "café.docx" granted one way is refused the other.
 */
export function canonicalKey(value: string): string {
  const normalised = path.normalize(value).normalize('NFC')
  return process.platform === 'linux' ? normalised : normalised.toLowerCase()
}

/**
 * A directory grant that would cover essentially the whole machine. A dialog
 * cannot produce these by accident; a restored or tampered grants file can.
 */
export function isTooBroadToGrant(resolved: string): boolean {
  const normalised = path.normalize(resolved)
  if (normalised === path.parse(normalised).root) return true
  const home = process.env.HOME || process.env.USERPROFILE
  return typeof home === 'string' && home !== '' && canonicalKey(normalised) === canonicalKey(home)
}

/**
 * True when `target` is `parent` itself or sits beneath it.
 *
 * Compared with path.relative rather than a string prefix, so that a sibling
 * directory whose name merely starts with the parent's -- "/a/storage-old"
 * against "/a/storage" -- does not pass. Case-insensitive on platforms whose
 * filesystem is, matching the comparison already used in src/main/index.ts.
 */
export function isInside(target: string, parent: string): boolean {
  const t = canonicalKey(target)
  const p = canonicalKey(parent)
  if (t === p) return true

  const relative = path.relative(p, t)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}
