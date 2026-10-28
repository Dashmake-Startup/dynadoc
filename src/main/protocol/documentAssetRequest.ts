/**
 * Deciding what `ddoc://asset/...` may read.
 *
 * Deliberately free of Electron imports: the smoke gate compiles this one file
 * and imports it, the way tests/smoke/fs-path-policy.test.mjs does with the
 * path policy. The Electron wiring lives next door in documentAssets.ts.
 *
 * Shape
 *   ddoc://asset/<percent-encoded absolute path>
 *
 *   The whole path is percent-encoded into a single URL path segment, so `/`
 *   arrives as %2F. That is deliberate: a `standard` scheme has its pathname
 *   normalised by the URL parser, which collapses `..` segments before any of
 *   our code sees them. With one opaque segment there is nothing for the parser
 *   to normalise, and the path this module checks is the path it serves.
 *
 * What it serves is whatever FilesystemPathPolicy already allows -- the same
 * roots and the same user-granted paths the filesystem IPC channels use. A
 * second policy would drift from the first; there is one.
 */

export const ASSET_SCHEME = 'ddoc'
export const ASSET_HOST = 'asset'
/**
 * The renderer's own page and bundle. A separate host, so `ddoc://bundle` and
 * `ddoc://asset` are separate origins: a document's assets cannot be read by
 * script running in the app's page, and vice versa.
 */
export const BUNDLE_HOST = 'bundle'

/**
 * The URL a window loads to show the renderer. One source, so the three places
 * that used to build a `file://` path cannot drift apart.
 *
 * `suffix` carries a hash route or a query, e.g. `#presentation` or
 * `?overlay=1`.
 */
export function bundleUrl(suffix = ''): string {
  return `${ASSET_SCHEME}://${BUNDLE_HOST}/index.html${suffix}`
}

export type AssetResolution =
  | { allowed: true; filePath: string }
  | { allowed: false; status: number; reason: string }

/**
 * Decides what a request URL may read. Pure on purpose: no Electron, no disk,
 * so the smoke test can exercise the refusals without a running app.
 *
 * `isAllowed` is the policy check, injected rather than imported, for the same
 * reason.
 */
export function resolveAssetRequest(
  rawUrl: string,
  isAllowed: (candidate: string) => boolean
): AssetResolution {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { allowed: false, status: 400, reason: 'not a URL' }
  }
  if (url.protocol !== `${ASSET_SCHEME}:`) {
    return { allowed: false, status: 400, reason: `wrong scheme ${url.protocol}` }
  }
  if (url.host !== ASSET_HOST) {
    // Other hosts on this scheme are not ours to serve. `ddoc://bundle` has its
    // own resolver with its own rules, and reaching it through this one would
    // mean the app's files were being checked against the document policy.
    return { allowed: false, status: 404, reason: `unknown host ${url.host}` }
  }

  const segment = url.pathname.replace(/^\/+/, '')
  if (!segment) return { allowed: false, status: 400, reason: 'no path' }

  let filePath: string
  try {
    filePath = decodeURIComponent(segment)
  } catch {
    return { allowed: false, status: 400, reason: 'path is not valid percent-encoding' }
  }
  // A NUL truncates the name inside some system calls, so a path carrying one
  // cannot be compared meaningfully against anything. FilesystemPathPolicy
  // refuses these too; this is the cheaper check, before the policy call.
  if (filePath.includes('\0')) return { allowed: false, status: 400, reason: 'path contains NUL' }
  if (!filePath.startsWith('/') && !/^[a-zA-Z]:[\\/]/.test(filePath)) {
    return { allowed: false, status: 400, reason: 'path is not absolute' }
  }
  if (!isAllowed(filePath)) {
    return { allowed: false, status: 403, reason: 'outside the allowed paths' }
  }
  return { allowed: true, filePath }
}

/**
 * Resolves `ddoc://bundle/...` to a file inside the built renderer directory.
 *
 * Why this does not go through FilesystemPathPolicy
 *   The policy answers "may a document reach this path", in terms of roots the
 *   user's documents live under and paths the user has granted. The app's own
 *   HTML, JavaScript and fonts are not in any of those, and adding them as a
 *   root would widen what documents may read in order to let the app load
 *   itself. Two different questions, so two different answers -- but the
 *   containment check is the same primitive the policy uses (`isInside`),
 *   injected here rather than reimplemented.
 *
 * Unlike the asset host, the path here is an ordinary URL path: the parser
 * collapses `..` before we see it, which is what we want for a document root,
 * and `isInside` is the backstop for anything it does not collapse.
 */
export function resolveBundleRequest(
  rawUrl: string,
  rendererRoot: string,
  join: (root: string, relative: string) => string,
  isInside: (target: string, parent: string) => boolean
): AssetResolution {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { allowed: false, status: 400, reason: 'not a URL' }
  }
  if (url.protocol !== `${ASSET_SCHEME}:`) {
    return { allowed: false, status: 400, reason: `wrong scheme ${url.protocol}` }
  }
  if (url.host !== BUNDLE_HOST) {
    return { allowed: false, status: 404, reason: `unknown host ${url.host}` }
  }

  let relative: string
  try {
    relative = decodeURIComponent(url.pathname)
  } catch {
    return { allowed: false, status: 400, reason: 'path is not valid percent-encoding' }
  }
  if (relative.includes('\0')) return { allowed: false, status: 400, reason: 'path contains NUL' }

  relative = relative.replace(/^\/+/, '')
  // `ddoc://bundle/` is the page itself.
  if (relative === '') relative = 'index.html'

  const filePath = join(rendererRoot, relative)
  if (!isInside(filePath, rendererRoot)) {
    return { allowed: false, status: 403, reason: 'outside the renderer directory' }
  }
  return { allowed: true, filePath }
}
