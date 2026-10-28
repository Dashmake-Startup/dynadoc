/**
 * The one place the renderer turns a local path into a URL, and back.
 *
 * Document assets used to be addressed as `file://<path>`, which only worked
 * because every window ran with `webSecurity: false`. A page with a `file://`
 * origin is exempt from CORS, from canvas tainting, and from any restriction on
 * reading other local files -- so that flag was not protecting anything, and
 * the laxity came from the scheme. Assets now go through `ddoc://asset/...`,
 * served by src/main/protocol/documentAssets.ts against the same
 * FilesystemPathPolicy the filesystem IPC channels use.
 *
 * Two directions, because the renderer needs both:
 *
 *   toAssetUrl   a path (or a legacy file:// URL) -> something an <img>, a
 *                <video> or pdf.js can load
 *   toLocalPath  anything stored in a document -> a plain filesystem path, for
 *                the fs calls that ask whether the file exists
 *
 * Documents already on disk contain `file://` URLs written by older versions.
 * Both functions accept them, which is why the `file://` prefix is still named
 * in this file and nowhere else in the renderer.
 */

import Platform from '../libs/platform'

const ASSET_PREFIX = 'ddoc://asset/'
const LEGACY_PREFIX = /^file:\/\//i
/**
 * Schemes that are already loadable and must be left exactly as they are.
 * `blob:` and `data:` carry their own bytes; http(s) is the web driver's normal
 * case; `ddoc:` is already us. Mobile adds its own (`capacitor://`, `content://`)
 * and never produced `file://` paths through this helper.
 */
const PASS_THROUGH = /^(blob:|data:|https?:|ddoc:|capacitor:|content:|_cap_file_)/i

/** True for anything this helper would turn into, or take apart. */
export function isLocalAssetRef(value: unknown): boolean {
  if (typeof value !== 'string' || value === '') return false
  return LEGACY_PREFIX.test(value) || value.toLowerCase().startsWith(ASSET_PREFIX)
}

/**
 * Strips whatever wrapper a stored reference has and returns a plain path.
 *
 * Returns the input unchanged when it is not a local reference, so callers can
 * pass a remote URL through without a separate branch -- which is how most of
 * them were already written.
 */
export function toLocalPath(value: unknown): string {
  if (typeof value !== 'string' || value === '') return ''
  if (value.toLowerCase().startsWith(ASSET_PREFIX)) {
    const encoded = value.slice(ASSET_PREFIX.length).split('?')[0].split('#')[0]
    try {
      return decodeURIComponent(encoded)
    } catch {
      // Malformed encoding: returning the raw segment would hand a half-decoded
      // path to an fs call. An empty string makes the caller's existence check
      // fail, which is the honest outcome.
      return ''
    }
  }
  if (LEGACY_PREFIX.test(value)) {
    const withoutScheme = value.replace(LEGACY_PREFIX, '').split('?')[0].split('#')[0]
    // `file:///Users/x` and `file://Users/x` both appear in older documents.
    const path = withoutScheme.startsWith('/') ? withoutScheme : `/${withoutScheme}`
    try {
      return decodeURIComponent(path)
    } catch {
      return path
    }
  }
  return value
}

/**
 * Builds a URL the renderer can load for a local file.
 *
 * The whole path becomes one percent-encoded segment: the main-process handler
 * relies on that, because a `standard` scheme has its pathname normalised by
 * the URL parser, and a path split across segments would be checked in one form
 * and served in another.
 *
 * Off desktop this returns the value untouched. There is no protocol handler on
 * web or mobile, and those drivers never address local files this way, so
 * rewriting would break what currently works.
 */
export function toAssetUrl(value: unknown): string {
  if (typeof value !== 'string' || value === '') return ''
  if (PASS_THROUGH.test(value)) return value
  if (!Platform.isDesktopPlatform) return value
  const absolute = toLocalPath(value)
  if (!absolute) return ''
  return ASSET_PREFIX + encodeURIComponent(absolute)
}

/** `toAssetUrl` with a cache-busting query, for the callers that reload in place. */
export function toAssetUrlWithVersion(value: unknown, version: unknown): string {
  const url = toAssetUrl(value)
  if (!url || !url.startsWith(ASSET_PREFIX)) return url
  return `${url}?v=${encodeURIComponent(String(version ?? ''))}`
}
