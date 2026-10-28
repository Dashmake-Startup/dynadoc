/**
 * The `ddoc://asset/...` protocol: how a document's local assets reach the
 * renderer once the renderer is no longer allowed to name `file://` URLs.
 *
 * Why a protocol rather than `webSecurity: false`
 *   A page whose origin is `file://` is exempt from CORS, from canvas
 *   tainting, and -- measured on Electron 40.10.6 -- from any restriction on
 *   reading other local files: `fetch('file:///etc/hosts')` returns 9543 bytes
 *   from such a page whether `webSecurity` is true or false. The flag is inert
 *   there. Moving the renderer onto a scheme with a real origin is what closes
 *   that, and once it moves, `file://` subresources stop loading, so the assets
 *   a document displays need a scheme of their own.
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
 * What it serves
 *   Whatever FilesystemPathPolicy already allows -- the same roots and the same
 *   user-granted paths that the filesystem IPC channels use. A second policy
 *   would drift from the first; there is one.
 */

import { protocol } from 'electron'
import path from 'node:path'
import { filesystemPolicy } from '../ipc/filesystemPolicyHost'
import { isInside } from '../utils/FilesystemPathPolicy'
import {
  ASSET_SCHEME,
  BUNDLE_HOST,
  resolveAssetRequest,
  resolveBundleRequest
} from './documentAssetRequest'
import { buildAssetResponse } from './assetResponse'

/**
 * Where the built renderer sits relative to the compiled main process. The same
 * path the window loading used when it still called `loadFile`, so a packaged
 * app resolves it exactly as before -- including inside an asar, which
 * Electron's `fs` reads transparently.
 */
function rendererRoot(): string {
  return path.join(__dirname, '../renderer')
}

/**
 * Must be called before `app.whenReady()`. Electron ignores privileges
 * registered after that point, and the failure is quiet: the scheme still
 * works, but without `standard` it has no origin, without `supportFetchAPI`
 * `fetch` refuses it, and without `stream` ranged media requests break. So the
 * call site matters more than it looks.
 */
export function registerDocumentAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ASSET_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true
      }
    }
  ])
}

/**
 * Must be called after `app.whenReady()`.
 *
 * A refusal answers with a status, never with an empty 200: an `<img>` that
 * silently renders nothing is the failure mode this lot is trying to avoid, so
 * the console shows a 403 and the element fires `onerror`.
 *
 * The response itself is built in assetResponse.ts rather than forwarded to
 * `net.fetch`, because `net.fetch` answers a ranged request with 200 and no
 * Content-Range -- which plays media but cannot seek it.
 */
export function handleDocumentAssetProtocol(): void {
  protocol.handle(ASSET_SCHEME, async (request) => {
    // Which host decides which question is asked: `bundle` is "is this file
    // part of the app", `asset` is "may a document reach this path". They are
    // separate origins as well as separate rules.
    const isBundle = (() => {
      try {
        return new URL(request.url).host === BUNDLE_HOST
      } catch {
        return false
      }
    })()

    const resolved = isBundle
      ? resolveBundleRequest(request.url, rendererRoot(), path.join, isInside)
      : resolveAssetRequest(request.url, (candidate) => filesystemPolicy().check(candidate).allowed)
    if (!resolved.allowed) {
      console.warn(`[asset-protocol] ${resolved.status} ${resolved.reason}: ${request.url}`)
      return new Response(resolved.reason, {
        status: resolved.status,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
      })
    }
    return buildAssetResponse(resolved.filePath, request.headers.get('range'), request.method)
  })
}
