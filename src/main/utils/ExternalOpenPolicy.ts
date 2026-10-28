import path from 'path'

/**
 * Policy for handing a URL or a file to the operating system.
 *
 * Document content reaches these decisions: a link inside a document can
 * trigger a window-open or a navigation, and a drive item can be opened by
 * a click in the file tree. Without a policy, a forged document can ask the
 * OS to start a local program, mount a remote share, or run a downloaded
 * script.
 *
 * Kept free of Electron imports so it can be exercised directly.
 */

/** Schemes the product actually uses for external links. */
export const ALLOWED_EXTERNAL_PROTOCOLS: ReadonlySet<string> = new Set([
  'https:',
  'http:',
  'mailto:',
  'tel:'
])

/**
 * Extensions the OS executes when a file is opened by the default handler.
 * Every platform's set is applied on every platform: a synced drive holds
 * files authored elsewhere, and the same item may be opened on any OS.
 *
 * This is a mitigation, not a boundary. The structural fix is to stop
 * handing drive content to the OS handler at all.
 */
export const EXECUTABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  // macOS
  '.app',
  '.command',
  '.tool',
  '.terminal',
  '.workflow',
  '.action',
  '.scpt',
  '.scptd',
  '.applescript',
  '.osascript',
  '.dmg',
  '.pkg',
  '.mpkg',
  // Windows
  '.exe',
  '.com',
  '.bat',
  '.cmd',
  '.msi',
  '.msp',
  '.msc',
  '.scr',
  '.cpl',
  '.hta',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.ps1',
  '.psm1',
  '.ps1xml',
  '.reg',
  '.lnk',
  '.pif',
  '.url',
  '.inf',
  '.ade',
  '.adp',
  // Linux
  '.desktop',
  '.run',
  '.appimage',
  '.sh',
  '.bash',
  '.zsh',
  '.ksh',
  '.csh',
  // Cross-platform runtimes
  '.jar',
  '.py',
  '.pyc',
  '.rb',
  '.pl',
  '.php',
  '.lua'
])

/** True when the URL may be handed to the OS as an external link. */
export function isAllowedExternalUrl(value: unknown): boolean {
  const parsed = parseUrl(value)
  return parsed !== null && ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)
}

/**
 * Parses a URL, returning null when it is malformed. Callers open
 * `parsed.href` rather than the raw input so that surrounding whitespace is
 * stripped and the scheme is lower-cased before the allowlist is consulted.
 */
export function parseUrl(value: unknown): URL | null {
  try {
    return new URL(String(value ?? ''))
  } catch {
    return null
  }
}

/**
 * True when `target` is the window's own page, so the navigation is the app
 * reloading or re-entering itself rather than leaving for a remote origin.
 *
 * `file:` URLs all report an origin of "null", so they are compared by
 * pathname instead. A query string or a fragment is allowed to differ: the
 * renderer routes on the hash, and that is not a navigation away.
 *
 * `ddoc:` needs the same treatment, and for a sharper reason: Node's URL
 * parser does not know the scheme is registered as standard in the renderer
 * process, so it reports `origin` as "null" for every `ddoc:` URL. Comparing
 * origins would therefore make `ddoc://anything/` count as the window's own
 * page. Host and pathname are compared instead.
 */
export function isAppOwnUrl(target: unknown, current: unknown): boolean {
  const t = parseUrl(target)
  const c = parseUrl(current)
  if (!t || !c || t.protocol !== c.protocol) return false
  if (t.protocol === 'file:') return t.pathname === c.pathname
  if (t.protocol === 'ddoc:') return t.host === c.host && t.pathname === c.pathname
  return t.origin === c.origin
}

/** True when opening this path would let the OS execute it. */
export function isExecutablePath(value: unknown): boolean {
  const name = String(value ?? '')
  if (!name) return false
  // A bundle is a directory: ".../Foo.app" has no trailing extension of its
  // own once a child path is appended, so test every segment.
  return name
    .split(/[\\/]+/)
    .some((segment) => EXECUTABLE_EXTENSIONS.has(path.extname(segment).toLowerCase()))
}
