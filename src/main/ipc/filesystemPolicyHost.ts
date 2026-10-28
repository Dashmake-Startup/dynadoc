import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { FilesystemPathPolicy, type FsError, type PathGrant } from '../utils/FilesystemPathPolicy'

/**
 * Holds the one FilesystemPathPolicy the main process uses, and the grants
 * store behind it.
 *
 * This is the Electron half of what FilesystemPathPolicy deliberately leaves
 * out: the policy itself takes no Electron import so it can be tested
 * directly, so something has to decide what "ours" means and where grants
 * live. That is here.
 */

/** Keep a tampered or runaway store from becoming an allowlist of everything. */
const MAX_GRANTS = 200

let policy: FilesystemPathPolicy | null = null

/**
 * The directories the application owns.
 *
 * userData/storage is where the renderer already keeps documents and UI state;
 * the cache and temp folders are the same two getCacheDirPath/getTempDirPath
 * produce in index.ts. userData *itself* is deliberately not a root -- see
 * grantsFilePath below.
 */
function ownedRoots(): string[] {
  const userData = app.getPath('userData')
  return [
    path.join(userData, 'storage'),
    path.join(userData, app.getName()),
    path.join(app.getPath('temp'), app.getName())
  ]
}

/**
 * The grants file sits in userData itself, which is not a root.
 *
 * If it lived under one, a write the policy had just permitted could rewrite
 * it, and the next launch would start with grants the renderer chose. The
 * policy would be manufacturing its own successor. Keeping the file one level
 * above every root makes that write unreachable through the surface.
 */
function grantsFilePath(): string {
  return path.join(app.getPath('userData'), 'filesystem-grants.json')
}

function loadGrants(into: FilesystemPathPolicy): void {
  let raw: string
  try {
    raw = fs.readFileSync(grantsFilePath(), 'utf-8')
  } catch {
    return // no file yet is the normal first-run case
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    console.error('[fs-policy] grants file is not valid JSON, ignoring it:', error)
    return
  }

  if (!Array.isArray(parsed)) return

  let accepted = 0
  for (const entry of parsed.slice(0, MAX_GRANTS)) {
    if (typeof entry?.path !== 'string') continue
    // Back through grant(), so a restored entry faces the same refusals as a
    // fresh one: the filesystem root and the home directory are rejected here
    // too, and a path that has since been deleted simply does not come back.
    const decision = into.grant({ path: entry.path, directory: entry.directory === true })
    if (decision.allowed) accepted += 1
  }
  console.log(`[fs-policy] restored ${accepted} grant(s)`)
}

function saveGrants(): void {
  if (!policy) return
  try {
    const grants = policy.exportGrants().slice(0, MAX_GRANTS)
    fs.writeFileSync(grantsFilePath(), JSON.stringify(grants, null, 2), 'utf-8')
  } catch (error) {
    // Loud, because the user silently re-prompted for every file after a
    // restart is the kind of fault nobody reports and everybody resents.
    console.error('[fs-policy] could not persist grants:', error)
  }
}

export function filesystemPolicy(): FilesystemPathPolicy {
  if (!policy) {
    policy = new FilesystemPathPolicy(ownedRoots())
    loadGrants(policy)
  }
  return policy
}

/**
 * Records a path the user chose, and persists it.
 *
 * Call this from inside the handler that learned the path -- a dialog handler,
 * or the drop handler -- never from a channel that accepts a path as an
 * argument from the renderer. See the note on FilesystemPathPolicy.grant.
 */
export function grantUserChosenPath(grant: PathGrant): boolean {
  const decision = filesystemPolicy().grant(grant)
  if (!decision.allowed) {
    console.error(
      `[fs-policy] refused to grant ${grant.path}: ${decision.error.code} ${decision.error.message}`
    )
    return false
  }
  saveGrants()
  return true
}

/** Convenience for the dialog handlers: grant every path a dialog returned. */
export function grantDialogResult(paths: readonly string[], directory: boolean): void {
  for (const p of paths) grantUserChosenPath({ path: p, directory })
}

/**
 * Thrown by requirePath so that a refusal reaches the renderer as a rejected
 * invoke rather than as a value. The code travels in the message because that
 * is what survives Electron's IPC error serialisation; callers match on the
 * prefix.
 */
export class FsAccessError extends Error {
  readonly code: FsError['code']

  constructor(error: FsError) {
    // The path belongs in the message, not only in the field: this error is
    // read in the main process log, and a refusal nobody can attribute to a
    // path is a refusal nobody can fix. It is the application's own log, so
    // the path is not leaking anywhere the renderer could not already name.
    super(
      error.path
        ? `${error.code}: ${error.message} (${error.path})`
        : `${error.code}: ${error.message}`
    )
    this.name = 'FsAccessError'
    this.code = error.code
  }
}

/**
 * The guard every filesystem handler calls first.
 *
 * Returns the *resolved* path, and handlers must operate on that rather than on
 * what the renderer sent: the two differ whenever a symlink is involved, and
 * acting on the original is how a check that passed becomes an operation
 * somewhere else.
 */
export function requirePath(candidate: unknown): string {
  const decision = filesystemPolicy().check(candidate)
  if (!decision.allowed) throw new FsAccessError(decision.error)
  return decision.resolved
}
