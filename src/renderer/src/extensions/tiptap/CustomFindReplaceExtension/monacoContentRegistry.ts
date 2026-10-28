// Synchronous registry: Monaco block widgets register their loaded file content here.
// The FindReplace extension reads it during ProseMirror's synchronous apply().
// Key: absolute file path. Value: file content string.

const registry = new Map<string, string>()

export function registerMonacoContent(filePath: string, content: string): void {
  registry.set(filePath, content)
}

export function unregisterMonacoContent(filePath: string): void {
  registry.delete(filePath)
}

// Returns content for a node whose attrs.src is a relative path suffix of a registered path
export function getMonacoContentBySrc(src: string): string | undefined {
  if (!src) return undefined
  for (const [filePath, content] of registry) {
    if (filePath.endsWith(src)) return content
  }
  return undefined
}
