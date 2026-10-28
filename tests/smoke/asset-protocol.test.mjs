/**
 * Gate: what the ddoc://asset protocol agrees to serve.
 *
 * The protocol decides, for every image, video, PDF and audio file a document
 * displays, whether the renderer may read it. Two failures matter and they
 * fail in opposite directions:
 *
 *   - too strict, and an existing document shows nothing. The element fires
 *     `onerror` and the page looks merely empty, so this is the failure that
 *     ships unnoticed.
 *   - too loose, and document content picks its own paths, which is the hole
 *     SPEC-001 exists to close.
 *
 * So the refusals are asserted as explicitly as the acceptances, and the
 * policy decision is injected: this file tests the URL contract, while
 * fs-path-policy.test.mjs tests the policy itself. Neither re-tests the other.
 */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')

let failures = 0
const ok = (what) => console.log(`[asset-protocol]   ok    ${what}`)
const fail = (what, detail) => {
  failures++
  console.error(`[asset-protocol]   FAIL  ${what}\n                     ${detail}`)
}

// documentAssetRequest.ts has no Electron imports on purpose, so esbuild can
// turn that one file into something importable without building the app.
const outDir = mkdtempSync(path.join(tmpdir(), 'asset-protocol-'))
const compiled = path.join(outDir, 'documentAssetRequest.mjs')
const esbuild = path.join(repoRoot, 'node_modules', '.bin', 'esbuild')
const build = spawnSync(
  esbuild,
  [
    path.join(repoRoot, 'src', 'main', 'protocol', 'documentAssetRequest.ts'),
    '--format=esm',
    `--outfile=${compiled}`
  ],
  { encoding: 'utf-8' }
)
if (build.status !== 0) {
  console.error(
    `[asset-protocol] FAIL: could not compile the resolver\n${build.stdout}${build.stderr}`
  )
  rmSync(outDir, { recursive: true, force: true })
  process.exit(1)
}

const { resolveAssetRequest, ASSET_SCHEME, ASSET_HOST } = await import(`file://${compiled}`)

// assetResponse.ts has no Electron imports either, so the range arithmetic can
// be exercised here instead of only through a running media element.
const compiledResponse = path.join(outDir, 'assetResponse.mjs')
const buildResponse = spawnSync(
  esbuild,
  [
    path.join(repoRoot, 'src', 'main', 'protocol', 'assetResponse.ts'),
    '--format=esm',
    '--platform=node',
    `--outfile=${compiledResponse}`
  ],
  { encoding: 'utf-8' }
)
if (buildResponse.status !== 0) {
  console.error(
    `[asset-protocol] FAIL: could not compile the response builder\n${buildResponse.stdout}${buildResponse.stderr}`
  )
  rmSync(outDir, { recursive: true, force: true })
  process.exit(1)
}
const { parseRange, contentTypeFor } = await import(`file://${compiledResponse}`)

const ALLOWED_ROOT = '/Users/someone/Library/Application Support/ddoc-office/assets'
// Stands in for FilesystemPathPolicy. Prefix matching is NOT good enough for a
// real policy -- that is exactly what fs-path-policy.test.mjs exists to prove --
// but here the point is which string the protocol hands the policy, not what
// the policy concludes.
const policyCalls = []
const stubPolicy = (candidate) => {
  policyCalls.push(candidate)
  return candidate.startsWith(ALLOWED_ROOT + '/')
}

const assetUrl = (absPath) => `${ASSET_SCHEME}://${ASSET_HOST}/${encodeURIComponent(absPath)}`

// --- it serves what the policy allows ------------------------------------
{
  const target = `${ALLOWED_ROOT}/img/photo.png`
  const r = resolveAssetRequest(assetUrl(target), stubPolicy)
  if (r.allowed && r.filePath === target) ok('an allowed asset resolves to its exact path')
  else fail('an allowed asset resolves to its exact path', JSON.stringify(r))
}
{
  // spaces and non-ASCII survive the round trip; macOS paths are full of both
  const target = `${ALLOWED_ROOT}/img/Été vacances #1.png`
  const r = resolveAssetRequest(assetUrl(target), stubPolicy)
  if (r.allowed && r.filePath === target) ok('spaces, accents and # survive encoding')
  else fail('spaces, accents and # survive encoding', JSON.stringify(r))
}
{
  const target = `${ALLOWED_ROOT}/img/a?b=1&c.png`
  const r = resolveAssetRequest(assetUrl(target), stubPolicy)
  if (r.allowed && r.filePath === target) ok('? and & in a filename are not read as a query')
  else fail('? and & in a filename are not read as a query', JSON.stringify(r))
}

// --- it refuses, with a status, never with a silent empty success --------
const refusals = [
  ['a path the policy rejects', assetUrl('/etc/hosts'), 403],
  ['another scheme', `file:///etc/hosts`, 400],
  ['an unknown host on our scheme', `${ASSET_SCHEME}://bundle/index.html`, 404],
  ['no path at all', `${ASSET_SCHEME}://${ASSET_HOST}/`, 400],
  [
    'a relative path',
    `${ASSET_SCHEME}://${ASSET_HOST}/${encodeURIComponent('img/photo.png')}`,
    400
  ],
  ['broken percent-encoding', `${ASSET_SCHEME}://${ASSET_HOST}/%ZZ`, 400],
  ['a NUL byte in the path', assetUrl(`${ALLOWED_ROOT}/img/photo.png\0.txt`), 400],
  ['gibberish instead of a URL', 'not a url at all', 400]
]
for (const [what, url, expected] of refusals) {
  const r = resolveAssetRequest(url, stubPolicy)
  if (r.allowed) fail(`refuses ${what}`, `it was ALLOWED: ${JSON.stringify(r)}`)
  else if (r.status !== expected)
    fail(`refuses ${what}`, `expected ${expected}, got ${r.status} (${r.reason})`)
  else ok(`refuses ${what} (${expected})`)
}

// --- traversal ------------------------------------------------------------
{
  // Unencoded dot-dot is collapsed by the URL parser before we see it, so what
  // reaches the policy is the normalised path -- which the policy then refuses.
  const r = resolveAssetRequest(`${ASSET_SCHEME}://${ASSET_HOST}/a/../../../etc/hosts`, stubPolicy)
  if (!r.allowed) ok('refuses unencoded ../ traversal')
  else fail('refuses unencoded ../ traversal', JSON.stringify(r))
}
{
  // Encoded dot-dot is NOT collapsed -- it is one opaque segment. It must reach
  // the policy intact, so the policy can resolve it and refuse. If this ever
  // arrives pre-collapsed, the policy is checking a different path than the one
  // that gets served, which is the whole bug class this shape avoids.
  const sneaky = `${ALLOWED_ROOT}/../../../../etc/hosts`
  policyCalls.length = 0
  resolveAssetRequest(assetUrl(sneaky), stubPolicy)
  if (policyCalls[0] === sneaky) ok('hands the policy the path verbatim, dot-dot included')
  else
    fail(
      'hands the policy the path verbatim, dot-dot included',
      `policy saw ${JSON.stringify(policyCalls[0])}`
    )
}
{
  // and the prefix-matching stub DOES accept it, which is the point: the URL
  // layer must not be the thing that stops traversal. The real policy resolves
  // before comparing (see fs-path-policy.test.mjs); this asserts the protocol
  // delegates rather than inventing a second, weaker check.
  const sneaky = `${ALLOWED_ROOT}/../../../../etc/hosts`
  const r = resolveAssetRequest(assetUrl(sneaky), stubPolicy)
  if (r.allowed) ok("traversal is the policy's call to make, not the URL layer's")
  else ok('traversal refused before the policy (acceptable, and stricter)')
}

// --- ranges, which is what seeking in media depends on ------------------
//
// With a 200-and-no-Content-Range answer a video still plays, reports
// `seekable = 0`, and ignores every seek while firing `onseeked` anyway. So
// these are asserted here rather than left to a human dragging a scrub bar.
{
  const SIZE = 1000
  const cases = [
    ['a normal range', 'bytes=100-199', { start: 100, end: 199 }],
    ['an open-ended range', 'bytes=500-', { start: 500, end: 999 }],
    ['the whole file, as media asks first', 'bytes=0-', { start: 0, end: 999 }],
    ['a suffix range', 'bytes=-200', { start: 800, end: 999 }],
    ['an end past the file', 'bytes=900-99999', { start: 900, end: 999 }],
    ['no header at all', null, null],
    ['a start past the file', 'bytes=1000-', 'unsatisfiable'],
    ['a backwards range', 'bytes=500-100', 'unsatisfiable'],
    ['multi-range, which we do not answer wrongly', 'bytes=0-9,20-29', 'unsatisfiable'],
    ['nonsense', 'bytes=abc', 'unsatisfiable'],
    ['a unit we do not speak', 'items=0-9', 'unsatisfiable'],
    ['an empty range', 'bytes=-', 'unsatisfiable']
  ]
  for (const [what, header, expected] of cases) {
    const got = parseRange(header, SIZE)
    const same = JSON.stringify(got) === JSON.stringify(expected)
    if (same) ok(`range: ${what}`)
    else fail(`range: ${what}`, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`)
  }
  // an empty file has no satisfiable range, and must not produce bytes 0--1
  const empty = parseRange('bytes=0-', 0)
  if (empty === 'unsatisfiable') ok('range: an empty file is unsatisfiable, not bytes 0--1')
  else fail('range: an empty file is unsatisfiable, not bytes 0--1', JSON.stringify(empty))
}
{
  const types = [
    ['photo.PNG', 'image/png'],
    ['clip.mp4', 'video/mp4'],
    ['clip.webm', 'video/webm'],
    ['song.mp3', 'audio/mpeg'],
    ['paper.pdf', 'application/pdf'],
    ['notes.md', 'text/markdown; charset=utf-8'],
    // A module served as octet-stream is refused by Chromium outright, and wasm
    // must be application/wasm. The app's own bundle is .js, so this only
    // surfaced when the vendored pdf.js viewer (all .mjs, plus a wasm decoder)
    // was first served over this protocol: the iframe fired `onload` and
    // rendered nothing.
    ['viewer.mjs', 'text/javascript; charset=utf-8'],
    ['pdf.worker.mjs', 'text/javascript; charset=utf-8'],
    ['openjpeg.wasm', 'application/wasm'],
    ['en-US.ftl', 'text/plain; charset=utf-8'],
    ['mystery.zzz', 'application/octet-stream'],
    ['no-extension', 'application/octet-stream']
  ]
  for (const [name, expected] of types) {
    const got = contentTypeFor('/tmp/' + name)
    if (got === expected) ok(`content type of ${name}`)
    else fail(`content type of ${name}`, `expected ${expected}, got ${got}`)
  }
}

// --- the renderer seam, both directions ----------------------------------
//
// Documents already on disk store `file://` URLs written by older versions. If
// the seam stops understanding that form, every image in every existing
// document shows an empty box -- and it shows it via `onerror`, so nothing in
// the logs says why. That promise is asserted here rather than trusted.
{
  const seamSrc = path.join(repoRoot, 'src', 'renderer', 'src', 'utils', 'assetUrl.ts')
  const seamOut = path.join(outDir, 'assetUrl.mjs')
  const seamBuild = spawnSync(
    esbuild,
    [seamSrc, '--bundle', '--format=esm', '--platform=neutral', `--outfile=${seamOut}`],
    { encoding: 'utf-8' }
  )
  if (seamBuild.status !== 0) {
    fail('compile the renderer seam', `${seamBuild.stdout}${seamBuild.stderr}`.slice(0, 300))
  } else {
    // The seam asks Platform whether this is desktop; `electronAPI` on window is
    // what Platform looks for first. Nothing else about a browser is needed.
    globalThis.window = { electronAPI: {} }
    const seam = await import(`file://${seamOut}`)
    const cases = [
      [
        'a legacy file:// URL becomes a path',
        () => seam.toLocalPath('file:///Users/x/a b.png'),
        '/Users/x/a b.png'
      ],
      [
        'a legacy URL missing a slash still becomes a path',
        () => seam.toLocalPath('file://Users/x/a.png'),
        '/Users/x/a.png'
      ],
      [
        'a ddoc URL becomes a path',
        () => seam.toLocalPath('ddoc://asset/%2FUsers%2Fx%2Fa%20b.png'),
        '/Users/x/a b.png'
      ],
      [
        'a cache-busting query is not part of the path',
        () => seam.toLocalPath('ddoc://asset/%2FUsers%2Fx%2Fa.png?v=3'),
        '/Users/x/a.png'
      ],
      ['a plain path passes through', () => seam.toLocalPath('/Users/x/a.png'), '/Users/x/a.png'],
      [
        'a path becomes one encoded segment',
        () => seam.toAssetUrl('/Users/x/a b.png'),
        'ddoc://asset/%2FUsers%2Fx%2Fa%20b.png'
      ],
      [
        'a legacy URL is upgraded',
        () => seam.toAssetUrl('file:///Users/x/a b.png'),
        'ddoc://asset/%2FUsers%2Fx%2Fa%20b.png'
      ],
      [
        'https is left alone',
        () => seam.toAssetUrl('https://example.com/a.png'),
        'https://example.com/a.png'
      ],
      ['blob is left alone', () => seam.toAssetUrl('blob:abc'), 'blob:abc'],
      [
        'data is left alone',
        () => seam.toAssetUrl('data:image/png;base64,AAA'),
        'data:image/png;base64,AAA'
      ],
      [
        'an existing ddoc URL is not double-wrapped',
        () => seam.toAssetUrl('ddoc://asset/%2FUsers%2Fx.png'),
        'ddoc://asset/%2FUsers%2Fx.png'
      ],
      [
        'the version token sits outside the encoded segment',
        () => seam.toAssetUrlWithVersion('/Users/x/a.png', 7),
        'ddoc://asset/%2FUsers%2Fx%2Fa.png?v=7'
      ],
      [
        'path -> url -> path round trips',
        () => seam.toLocalPath(seam.toAssetUrl('/Users/x/a b.png')),
        '/Users/x/a b.png'
      ],
      ['empty input stays empty', () => seam.toAssetUrl(''), ''],
      ['a non-string is not coerced into a URL', () => seam.toAssetUrl(null), ''],
      ['a legacy URL is recognised as local', () => seam.isLocalAssetRef('file:///x'), true],
      ['a ddoc URL is recognised as local', () => seam.isLocalAssetRef('ddoc://asset/%2Fx'), true],
      ['a remote URL is not', () => seam.isLocalAssetRef('https://example.com/x'), false]
    ]
    for (const [what, run, expected] of cases) {
      let got
      try {
        got = run()
      } catch (error) {
        got = `threw ${error && error.message}`
      }
      if (got === expected) ok(`seam: ${what}`)
      else fail(`seam: ${what}`, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`)
    }
  }
}

// --- the bundle host: the app's own files ---------------------------------
//
// ddoc://bundle serves the renderer itself. It answers a different question
// from ddoc://asset -- "is this file part of the app" rather than "may a
// document reach this path" -- so it has its own resolver. What it must not do
// is let a URL walk out of the renderer directory, which is why the real
// `isInside` from the path policy is used here rather than a replica.
{
  const policyOut = path.join(outDir, 'policy.mjs')
  const policyBuild = spawnSync(
    esbuild,
    [
      path.join(repoRoot, 'src', 'main', 'utils', 'FilesystemPathPolicy.ts'),
      '--format=esm',
      '--platform=node',
      `--outfile=${policyOut}`
    ],
    { encoding: 'utf-8' }
  )
  if (policyBuild.status !== 0) {
    fail(
      'compile the path policy for isInside',
      `${policyBuild.stdout}${policyBuild.stderr}`.slice(0, 300)
    )
  } else {
    const { isInside } = await import(`file://${policyOut}`)
    const { resolveBundleRequest, bundleUrl, BUNDLE_HOST } = await import(`file://${compiled}`)
    const ROOT = path.join(outDir, 'renderer')

    const resolve = (url) => resolveBundleRequest(url, ROOT, path.join, isInside)

    const served = [
      [
        'the page itself',
        `${ASSET_SCHEME}://${BUNDLE_HOST}/index.html`,
        path.join(ROOT, 'index.html')
      ],
      [
        'a bare host means the page',
        `${ASSET_SCHEME}://${BUNDLE_HOST}/`,
        path.join(ROOT, 'index.html')
      ],
      [
        'a bundled script',
        `${ASSET_SCHEME}://${BUNDLE_HOST}/assets/index-abc123.js`,
        path.join(ROOT, 'assets/index-abc123.js')
      ],
      [
        'a font with a space in its name',
        `${ASSET_SCHEME}://${BUNDLE_HOST}/fonts/My%20Font.woff2`,
        path.join(ROOT, 'fonts/My Font.woff2')
      ],
      [
        'a hash route is not part of the path',
        `${ASSET_SCHEME}://${BUNDLE_HOST}/index.html#presentation`,
        path.join(ROOT, 'index.html')
      ],
      [
        'a query is not part of the path',
        `${ASSET_SCHEME}://${BUNDLE_HOST}/index.html?overlay=1`,
        path.join(ROOT, 'index.html')
      ],
      [
        'unencoded dot-dot is collapsed by the parser, then stays inside',
        `${ASSET_SCHEME}://${BUNDLE_HOST}/a/../assets/x.js`,
        path.join(ROOT, 'assets/x.js')
      ]
    ]
    for (const [what, url, expected] of served) {
      const r = resolve(url)
      if (r.allowed && r.filePath === expected) ok(`bundle: ${what}`)
      else fail(`bundle: ${what}`, `expected ${expected}, got ${JSON.stringify(r)}`)
    }

    const refused = [
      // The one that matters: percent-encoded dot-dot survives the parser as an
      // opaque segment, so only isInside stops it.
      [
        'encoded dot-dot escaping the renderer directory',
        `${ASSET_SCHEME}://${BUNDLE_HOST}/%2e%2e%2f%2e%2e%2fetc%2fhosts`,
        403
      ],

      [
        "the asset host, which is not this resolver's to serve",
        `${ASSET_SCHEME}://${ASSET_HOST}/%2Ftmp%2Fx.png`,
        404
      ],
      ['an unknown host', `${ASSET_SCHEME}://elsewhere/index.html`, 404],
      ['another scheme', 'file:///etc/hosts', 400],
      ['broken percent-encoding', `${ASSET_SCHEME}://${BUNDLE_HOST}/%ZZ`, 400],
      ['a NUL byte', `${ASSET_SCHEME}://${BUNDLE_HOST}/index.html%00.txt`, 400]
    ]
    for (const [what, url, expected] of refused) {
      const r = resolve(url)
      if (r.allowed) fail(`bundle refuses ${what}`, `it was ALLOWED: ${JSON.stringify(r)}`)
      else if (r.status !== expected)
        fail(`bundle refuses ${what}`, `expected ${expected}, got ${r.status} (${r.reason})`)
      else ok(`bundle refuses ${what} (${expected})`)
    }

    // An absolute-looking path in encoded form is NOT an escape: the leading
    // slash is stripped and it resolves relative to the renderer directory,
    // exactly as a web server would treat `GET /etc/hosts`. What matters is
    // that it stays inside, and that the file it names does not exist there --
    // so the request 404s rather than reading anything.
    {
      const r = resolve(`${ASSET_SCHEME}://${BUNDLE_HOST}/%2Fetc%2Fhosts`)
      if (r.allowed && r.filePath === path.join(ROOT, 'etc/hosts') && isInside(r.filePath, ROOT)) {
        ok('bundle: an absolute path is read relative to the renderer directory, not the disk root')
      } else {
        fail(
          'bundle: an absolute path is read relative to the renderer directory, not the disk root',
          JSON.stringify(r)
        )
      }
    }

    const urls = [
      ['bundleUrl() is the page', bundleUrl(), `${ASSET_SCHEME}://${BUNDLE_HOST}/index.html`],
      [
        'bundleUrl carries a hash route',
        bundleUrl('#presentation'),
        `${ASSET_SCHEME}://${BUNDLE_HOST}/index.html#presentation`
      ],
      [
        'bundleUrl carries a query',
        bundleUrl('?overlay=1'),
        `${ASSET_SCHEME}://${BUNDLE_HOST}/index.html?overlay=1`
      ]
    ]
    for (const [what, got, expected] of urls) {
      if (got === expected) ok(`bundle: ${what}`)
      else fail(`bundle: ${what}`, `expected ${expected}, got ${got}`)
    }
    // and what the windows load must be what the resolver serves
    const roundTrip = resolve(bundleUrl('#presentation'))
    if (roundTrip.allowed && roundTrip.filePath === path.join(ROOT, 'index.html')) {
      ok('bundle: the URL the windows load resolves to the page')
    } else {
      fail('bundle: the URL the windows load resolves to the page', JSON.stringify(roundTrip))
    }
  }
}

rmSync(outDir, { recursive: true, force: true })

if (failures > 0) {
  console.error(`\n[asset-protocol] FAILED — ${failures} check(s) did not hold.`)
  process.exit(1)
}
console.log(
  '\n[asset-protocol] OK — every refusal carried a status and every legitimate asset resolved'
)
