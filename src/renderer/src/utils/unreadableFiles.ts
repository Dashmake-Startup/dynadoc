import Platform from '../libs/platform'

/**
 * Files whose content could not be read.
 *
 * A failed read used to be reported as an empty string. The editor then opened
 * on a blank document, and its first keystroke autosaved that blank over
 * content nobody had ever read — a silent data loss, and the whole reason this
 * module exists. A read failure now throws, and the path it failed on is
 * recorded here so that no write can reach that file while its content is
 * unknown, whichever code path the write comes from.
 *
 * Keyed by path rather than by document, because the write this guards
 * (`Utils.saveToFile`) only ever knows a path. A successful read clears the
 * entry: the failure is usually transient, and the same file opens normally a
 * moment later.
 *
 * In-memory and per-session on purpose. A read failure says nothing about the
 * file itself, so it must not outlive the session that observed it.
 */
const unreadablePaths = new Set<string>()

// The same normalization `Utils.saveToFile` applies before writing, so the key
// a failed read registers is the key a write looks up.
function normalize(filePath: string): string {
  const raw = typeof filePath === 'string' ? filePath : String(filePath ?? '')
  if (Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop) return raw
  return raw.replace(/^file:\/\//i, '').replace(/^\/+/, '')
}

export function markFileUnreadable(filePath: string): void {
  const key = normalize(filePath)
  if (key) unreadablePaths.add(key)
}

export function markFileReadable(filePath: string): void {
  const key = normalize(filePath)
  if (key) unreadablePaths.delete(key)
}

export function isFileUnreadable(filePath: string): boolean {
  const key = normalize(filePath)
  return Boolean(key) && unreadablePaths.has(key)
}
