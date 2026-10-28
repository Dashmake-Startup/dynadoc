#!/usr/bin/env node
// Fails when the renderer *builds* a `file://` URL for a local file.
//
// Why this is a gate and not a report
//   Document assets are served over `ddoc://asset/...` against the filesystem
//   path policy (src/main/protocol/). A `file://` URL bypasses that policy, and
//   once `webSecurity: true` is on it does not load at all -- the element fires
//   `onerror` and the document shows an empty box. That failure is invisible in
//   the main process, so a new `file://` URL has to fail the build instead.
//
// Why this is not a grep
//   Five successive greps gave five different numbers during this spec. The
//   failures were structural, not patterns someone forgot:
//
//     1. comments        a `/* ... */` block hid the most alarming entry on one
//                        list; it did not exist. A `/*` inside a string breaks
//                        hand-rolled block tracking the other way, dropping
//                        live code silently.
//     2. template spans  `` `file://${path.resolve(x)}` `` is one node and any
//                        number of lines.
//     3. markup          an attribute value in a .svelte file is not JS, and
//                        `src={'file://' + p}` is both.
//     4. regex literals  /^file:\/\//i mentions the scheme with no string
//                        literal anywhere. The first version of this tool
//                        reported 0 while the helper it was checking still
//                        handled `file://`, and adding regexes turned up 12
//                        more sites a string search could never have found.
//
// Construction vs recognition
//   Those 12 turned out to be defensive strippers in the web and mobile code:
//   `if (platform === desktop) return raw` and then `.replace(/^file:\/\//i,
//   '')`, or the web/mobile drivers themselves, where paths are relative to a
//   remote drive. Stripping a prefix that may arrive cannot break a document's
//   display; only handing a `file://` URL to an <img>, a <video> or an <iframe>
//   can, because under `webSecurity: true` it does not load.
//
//   So the gate fails on construction -- a literal, a template or a markup
//   attribute that yields a `file://` URL -- and merely counts recognition, so
//   a reviewer can see it without the build turning red for code that is
//   correct where it stands.
//
// Usage
//   node scripts/find-file-url-sites.mjs           # exits 1 on any new site
//   node scripts/find-file-url-sites.mjs --json

/* eslint-disable @typescript-eslint/explicit-function-return-type --
   plain .mjs: there is no type annotation syntax to satisfy this rule here. */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { parse } from 'svelte/compiler'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const SRC = path.join(repoRoot, 'src/renderer/src')
const SCHEME = /file:\/\//i

/**
 * The only places allowed to name the scheme, each for a stated reason. An
 * entry here is a decision, not an exemption: anything else fails the build.
 */
const ALLOWED = new Map([
  [
    'src/renderer/src/utils/assetUrl.ts',
    'the one seam. It still reads `file://` because documents written by older ' +
      'versions store that form and must keep displaying.'
  ],
  [
    'src/renderer/src/lib/api/mobile/bridge.ts',
    "Capacitor on mobile, where `file://` is the platform's own scheme next to " +
      '`content://` and `_cap_file_`. There is no protocol handler there.'
  ]
])

const hits = []
const parseFailures = []

/**
 * Blanks out HTML comments, keeping every offset and line break, so a
 * commented-out <script> block cannot be mistaken for live code.
 *
 * This is here because it was not, and the cost was visible: PR #126 reported
 * migrating a `file://` URL in PdfViewer.svelte that sits inside a
 * commented-out <script> block at the top of that file. The edit was harmless;
 * the claim in the description was wrong. Comment boundaries, for the third
 * time on this spec, inside the tool written to get them right.
 */
function blankHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, (block) => block.replace(/[^\n]/g, ' '))
}

function walkTs(sf, relPath, lineOffset) {
  const at = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 + lineOffset
  const record = (node, kind) =>
    hits.push({
      file: relPath,
      line: at(node),
      kind,
      text: node.getText(sf).replace(/\s+/g, ' ').slice(0, 110)
    })
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (SCHEME.test(node.text)) record(node, 'literal')
    } else if (ts.isTemplateExpression(node)) {
      if (SCHEME.test(node.getText(sf))) record(node, 'template')
    } else if (ts.isRegularExpressionLiteral(node)) {
      // `file:\/\/` in a regex is the same scheme, escaped
      if (SCHEME.test(node.getText(sf).replace(/\\/g, ''))) record(node, 'regex')
    }
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(sf, visit)
}

function scanTs(abs, rel) {
  const text = fs.readFileSync(abs, 'utf-8')
  const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  walkTs(ts.createSourceFile(rel, text, ts.ScriptTarget.ESNext, true, kind), rel, 0)
}

function scanSvelte(abs, rel) {
  const text = fs.readFileSync(abs, 'utf-8')
  // Script blocks are located in a copy with HTML comments blanked, so a
  // commented-out <script> is not analysed as live code. Offsets are preserved,
  // so the line numbers still point at the real file.
  const scriptSource = blankHtmlComments(text)
  const re = /<script[^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(scriptSource)) !== null) {
    const lineOffset = text.slice(0, m.index + m[0].indexOf(m[1])).split('\n').length - 1
    walkTs(
      ts.createSourceFile(rel, m[1], ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS),
      rel,
      lineOffset
    )
  }
  let ast
  try {
    ast = parse(text, { filename: rel, modern: true })
  } catch (error) {
    // Reported, never skipped: a file this tool cannot read is a file where a
    // `file://` URL could hide.
    parseFailures.push({ file: rel, why: String(error && error.message).split('\n')[0] })
    return
  }
  const lineOf = (start) => text.slice(0, start).split('\n').length
  const seen = new Set()
  const note = (node, kind, value) => {
    const key = `${rel}:${node.start}`
    if (seen.has(key)) return
    seen.add(key)
    hits.push({
      file: rel,
      line: lineOf(node.start),
      kind,
      text: String(value).replace(/\s+/g, ' ').slice(0, 110)
    })
  }
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.type === 'Text' && typeof node.data === 'string' && SCHEME.test(node.data)) {
      note(node, 'markup-text', node.data)
    }
    if (
      (node.type === 'Literal' || node.type === 'StringLiteral') &&
      typeof node.value === 'string' &&
      SCHEME.test(node.value)
    ) {
      note(node, 'markup-expr', node.value)
    }
    for (const key of Object.keys(node)) if (key !== 'parent') walk(node[key])
  }
  walk(ast.fragment)
  if (ast.instance) walk(ast.instance)
  if (ast.module) walk(ast.module)
}

/**
 * Every file that calls a seam function must really import it.
 *
 * #126 inserted fifteen of those imports with a script anchored on the last
 * line matching an import pattern. In EditorHelpers.ts that line sits inside a
 * template literal of sample code, itself inside a comment, so the module ended
 * up calling `toAssetUrl` with no import of it at all --
 * `EditorHelpers.toFileUrl` threw a ReferenceError on every call, and four
 * green gates said nothing because the renderer's type check already carries
 * thousands of pre-existing errors.
 *
 * This asks the parser for a real ImportDeclaration, and reads every <script>
 * block with HTML comments blanked. Reading only the first block is what made
 * my throwaway audit report a false positive on PdfViewer.svelte, whose first
 * block is commented out.
 */
const SEAM_FUNCTIONS = ['toAssetUrl', 'toAssetUrlWithVersion', 'toLocalPath', 'isLocalAssetRef']

function seamImportMissing(abs, rel) {
  if (rel.endsWith(path.join('utils', 'assetUrl.ts'))) return false
  const raw = fs.readFileSync(abs, 'utf-8')
  if (!SEAM_FUNCTIONS.some((name) => raw.includes(name))) return false

  const regions = []
  if (/\.(ts|tsx)$/.test(rel)) regions.push(raw)
  else {
    const blanked = blankHtmlComments(raw)
    const re = /<script[^>]*>([\s\S]*?)<\/script>/gi
    let m
    while ((m = re.exec(blanked)) !== null) regions.push(m[1])
  }

  let calls = false
  let imported = false
  for (const region of regions) {
    const sf = ts.createSourceFile(rel, region, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)
    ts.forEachChild(sf, (node) => {
      if (ts.isImportDeclaration(node) && /assetUrl/.test(node.moduleSpecifier.getText(sf))) {
        imported = true
      }
    })
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const name = node.expression.getText(sf).split('.').pop() ?? ''
        if (SEAM_FUNCTIONS.includes(name)) calls = true
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(sf, visit)
  }
  return calls && !imported
}

const seamBreaks = []

const stack = [SRC]
let scanned = 0
while (stack.length) {
  const dir = stack.pop()
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') stack.push(abs)
      continue
    }
    const rel = path.relative(repoRoot, abs)
    if (/\.(ts|tsx)$/.test(entry.name)) {
      scanTs(abs, rel)
      scanned++
    } else if (/\.svelte$/.test(entry.name)) {
      scanSvelte(abs, rel)
      scanned++
    }
    if (/\.(ts|tsx|svelte)$/.test(entry.name) && seamImportMissing(abs, rel)) {
      seamBreaks.push(rel)
    }
  }
}

// A file the Svelte parser cannot read still gets a textual check, so a parse
// failure cannot become a hiding place. Those four files have pre-existing
// markup errors unrelated to this.
for (const failure of parseFailures) {
  const text = blankHtmlComments(fs.readFileSync(path.join(repoRoot, failure.file), 'utf-8'))
  if (SCHEME.test(text)) {
    hits.push({
      file: failure.file,
      line: 0,
      kind: 'unparseable-but-mentions-scheme',
      text: failure.why
    })
  }
}

// A regex can only recognise the scheme, never build a URL with it.
const RECOGNITION_ONLY = new Set(['regex'])
const recognition = hits.filter((hit) => RECOGNITION_ONLY.has(hit.kind) && !ALLOWED.has(hit.file))
const offending = hits.filter((hit) => !RECOGNITION_ONLY.has(hit.kind) && !ALLOWED.has(hit.file))
// A missing import is as fatal as a file:// URL, and quieter.
const offendingWithSeam = offending
for (const rel of seamBreaks) {
  offendingWithSeam.push({
    file: rel,
    line: 0,
    kind: 'calls-the-seam-without-importing-it',
    text: 'no ImportDeclaration for utils/assetUrl -- the call would throw at runtime'
  })
}
const allowedHits = hits.filter((hit) => ALLOWED.has(hit.file))

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify({ scanned, offending, recognition, allowedHits, parseFailures }, null, 2)
  )
} else {
  console.log(`[file-url-sites] scanned ${scanned} renderer files`)
  for (const [file, why] of ALLOWED) {
    const n = allowedHits.filter((hit) => hit.file === file).length
    console.log(
      `[file-url-sites]   allowed  ${file} (${n} mention${n === 1 ? '' : 's'})\n                     ${why}`
    )
  }
  if (parseFailures.length) {
    console.log(
      `[file-url-sites]   note     ${parseFailures.length} .svelte file(s) the markup parser refused; each was checked textually instead:`
    )
    for (const failure of parseFailures) console.log(`                     ${failure.file}`)
  }
  if (recognition.length) {
    console.log(
      `[file-url-sites]   counted  ${recognition.length} place(s) that only RECOGNISE the scheme in order to strip it,` +
        ` in the web and mobile remote-path code. These cannot break a document's display:`
    )
    for (const hit of recognition)
      console.log(`                     ${hit.file}:${hit.line}  ${hit.text}`)
  }
  if (offending.length === 0) {
    console.log(
      `\n[file-url-sites] OK — nothing in the renderer builds a file:// URL outside the seam`
    )
  } else {
    console.error(
      `\n[file-url-sites] FAILED — ${offending.length} problem(s): a file:// URL built for a local` +
        ` file, or a call to the seam from a file that never imports it`
    )
    for (const hit of offending)
      console.error(`  ${hit.file}:${hit.line}  [${hit.kind}]  ${hit.text}`)
    console.error(
      `\nBuild asset URLs with toAssetUrl()/toLocalPath() from` +
        ` src/renderer/src/utils/assetUrl.ts, and import them at the top level --` +
        ` an import inside a comment or a template literal is not an import.`
    )
  }
}
process.exit(offending.length === 0 ? 0 : 1)
