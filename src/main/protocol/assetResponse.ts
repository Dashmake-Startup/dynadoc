/**
 * Turning an allowed file path into an HTTP response, with ranges.
 *
 * Why this exists rather than `net.fetch(file://…)`
 *   Step 1 forwarded the request to `net.fetch`, which returns the right bytes
 *   for a ranged request but answers **200 with no Content-Range**, and never
 *   advertises `Accept-Ranges`. Measured consequence on a real 1.1 MB webm:
 *
 *     passthrough   seekable = 0.00   el.currentTime = 52.59  ->  stays at 0.00
 *     real 206      seekable = 87.66  el.currentTime = 52.59  ->  moves to 52.59
 *
 *   Media plays either way, so the failure is invisible until someone drags the
 *   scrub bar. Worse, `onseeked` *fires* in the broken case with the position
 *   unchanged, so a test that only waits for the event passes.
 *
 * Content types are an explicit table rather than a dependency: `mime-types` is
 * only a transitive package here, and depending on something nothing declares
 * is how a build breaks later. Anything not in the table is served as
 * `application/octet-stream`, which is right for a download and parses fine via
 * `.text()`; a new media format that needs to render adds a line here.
 */

import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

const CONTENT_TYPES: Record<string, string> = {
  // images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.heic': 'image/heic',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  // video
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  // audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  // documents and text
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  // Chromium refuses to execute a module script served as octet-stream, and
  // refuses to instantiate wasm that is not application/wasm. The app's own
  // bundle is .js, so this only surfaced when the vendored pdf.js viewer --
  // which is all .mjs plus a wasm decoder -- was first served over this
  // protocol: the iframe fired `onload` and rendered nothing, with
  // "Expected a JavaScript-or-Wasm module script" in the console.
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.ftl': 'text/plain; charset=utf-8'
}

export function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

export type ParsedRange = { start: number; end: number } | 'unsatisfiable' | null

/**
 * Parses the one Range form browsers actually send for media: a single byte
 * range. Multi-range requests (`bytes=0-9,20-29`) would need a multipart
 * response; no media element or PDF viewer asks for one, so they are treated as
 * unsatisfiable rather than answered wrongly.
 */
export function parseRange(header: string | null, size: number): ParsedRange {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return 'unsatisfiable'
  const [, rawStart, rawEnd] = match
  if (rawStart === '' && rawEnd === '') return 'unsatisfiable'

  let start: number
  let end: number
  if (rawStart === '') {
    // `bytes=-500` means the last 500 bytes
    const suffix = Number(rawEnd)
    if (!Number.isInteger(suffix) || suffix <= 0) return 'unsatisfiable'
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(rawStart)
    end = rawEnd === '' ? size - 1 : Number(rawEnd)
    if (!Number.isInteger(start) || !Number.isInteger(end)) return 'unsatisfiable'
    if (end >= size) end = size - 1
  }
  // An empty file has no satisfiable range at all.
  if (size === 0 || start >= size || start > end) return 'unsatisfiable'
  return { start, end }
}

/**
 * `method` matters: Chromium sends HEAD to learn a file's size before deciding
 * how to fetch it, and a HEAD that answers with a body is a protocol error.
 */
export function buildAssetResponse(
  filePath: string,
  rangeHeader: string | null,
  method: string
): Response {
  let stat: fs.Stats
  try {
    stat = fs.statSync(filePath)
  } catch {
    return new Response('not found', { status: 404 })
  }
  if (!stat.isFile()) return new Response('not a file', { status: 404 })

  const type = contentTypeFor(filePath)
  const range = parseRange(rangeHeader, stat.size)

  if (range === 'unsatisfiable') {
    return new Response('range not satisfiable', {
      status: 416,
      headers: { 'content-range': `bytes */${stat.size}`, 'accept-ranges': 'bytes' }
    })
  }

  const isHead = method.toUpperCase() === 'HEAD'
  const from = range ? range.start : 0
  const to = range ? range.end : Math.max(0, stat.size - 1)
  const length = stat.size === 0 ? 0 : to - from + 1

  const headers: Record<string, string> = {
    'content-type': type,
    'content-length': String(length),
    // Without this the media stack reports seekable = 0 and silently refuses to
    // move, even though ranged requests would have worked.
    'accept-ranges': 'bytes'
  }
  if (range) headers['content-range'] = `bytes ${from}-${to}/${stat.size}`

  if (isHead || length === 0) {
    return new Response(null, { status: range ? 206 : 200, headers })
  }
  const stream = fs.createReadStream(filePath, { start: from, end: to })
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: range ? 206 : 200,
    headers
  })
}
