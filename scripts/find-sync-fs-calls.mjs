#!/usr/bin/env node
// Lists the renderer's live synchronous filesystem calls, with file and line.
//
// Why this is not a grep
//   This one question defeated four successive greps during SPEC-001 Block A,
//   and two of the four failures are not expressible as a pattern at all:
//
//     1. touch points vs invocations   `fs?.writeFileSync` in a guard is not a
//                                      call, but matches any pattern for one.
//     2. optional call syntax          `fs?.writeFileSync?.(…)` was missed by a
//                                      pattern anchored on `Sync(`.
//     3. nested synchronous scopes     a call inside `items.map(item => …)`
//                                      within an async function is not awaitable,
//                                      and nothing textual says so.
//     4. comment boundaries            a `/* … */` block hid the single most
//                                      alarming entry on the list; it did not
//                                      exist. A `/*` inside a string defeats
//                                      hand-rolled block tracking in the other
//                                      direction, dropping live calls silently.
//
//   A parser answers all four structurally. Comments and strings are gone
//   before analysis begins, a call is a CallExpression whichever syntax spells
//   it, and the enclosing function is a parent link rather than a guess.
//
// Usage
//   node scripts/find-sync-fs-calls.mjs            # the report
//   node scripts/find-sync-fs-calls.mjs --json     # machine-readable
//
// It is a report, not a gate. It could fail CI when a new synchronous call
// appears; that belongs in its own change, once the count has been trusted
// for a while.

/* eslint-disable @typescript-eslint/explicit-function-return-type --
   plain .mjs: there is no type annotation syntax to satisfy this rule here.
   Scoped to this file rather than loosened in eslint.config.mjs. */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as svelte from 'svelte/compiler'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const ROOT = path.join(repoRoot, 'src', 'renderer')
const JSON_OUT = process.argv.includes('--json')

/** Synchronous filesystem methods. The only list in this tool; everything else is structure. */
const KEEPS_SIGNATURE = new Set(['existsSync', 'statSync'])
const NEEDS_CONVERSION = new Set([
  'readFileSync',
  'writeFileSync',
  'appendFileSync',
  'mkdirSync',
  'readdirSync',
  'unlinkSync',
  'rmSync',
  'rmdirSync',
  'copyFileSync',
  'renameSync',
  'lstatSync',
  'accessSync',
  'realpathSync',
  'openSync',
  'closeSync',
  'truncateSync'
])

/**
 * Paths outside the question. Printed with the report, because a silent
 * exclusion is how a count starts drifting.
 */
const EXCLUDED = [
  ['src/renderer/src/lib/api/drivers/web.ts', 'web driver: HTTP to the bridge, not the local disk'],
  ['src/renderer/src/lib/api/drivers/mobile.ts', 'mobile driver: same'],
  ['src/renderer/src/lib/api/web/', 'web driver internals'],
  ['src/renderer/src/lib/api/mobile/', 'mobile driver internals'],
  ['src/renderer/src/utils/shims/', 'the shim itself: it defines these methods'],
  ['src/renderer/src/components/common/web-component/', 'vendored component library'],
  ['build-fluent.mjs', 'build script, runs under node'],
  ['.min.', 'minified vendor bundles']
]

const isExcluded = (rel) => EXCLUDED.find(([frag]) => rel.includes(frag))

/** The receiver must itself be filesystem-like, which is what keeps store
 *  methods such as `_$_documentEditorsList.getActiveSync?.()` out. */
const FS_RECEIVERS = new Set(['fs', 'fsPromises', 'fsApi', 'fsp', 'fsSync'])

function receiverIsFilesystem(expr) {
  // The last property segment of the receiver: nodeApi.fs -> "fs".
  let node = expr
  while (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) node = node.expression
  if (ts.isPropertyAccessExpression(node)) return FS_RECEIVERS.has(node.name.text)
  if (ts.isIdentifier(node)) return FS_RECEIVERS.has(node.text)
  return false
}

/** The nearest enclosing function, and whether it can hold an await. */
function enclosingFunction(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (
      ts.isFunctionDeclaration(p) ||
      ts.isFunctionExpression(p) ||
      ts.isArrowFunction(p) ||
      ts.isMethodDeclaration(p) ||
      ts.isConstructorDeclaration(p) ||
      ts.isGetAccessor(p) ||
      ts.isSetAccessor(p)
    ) {
      const isAsync = (ts.getCombinedModifierFlags(p) & ts.ModifierFlags.Async) !== 0
      const kind = ts.isArrowFunction(p)
        ? 'arrow'
        : ts.isMethodDeclaration(p)
          ? 'method'
          : ts.isFunctionDeclaration(p)
            ? 'function'
            : ts.isFunctionExpression(p)
              ? 'function expression'
              : 'accessor'
      return { isAsync, kind, line: lineOf(p) }
    }
  }
  return { isAsync: false, kind: 'module top level', line: 0 }
}

let currentSource = null
let currentRel = ''
const fellBack = []
const lineOf = (node) =>
  currentSource.getLineAndCharacterOfPosition(node.getStart(currentSource)).line + 1

/**
 * Svelte files: keep only the <script> contents, with every other character
 * replaced by whitespace so offsets -- and therefore line numbers -- survive.
 * The region comes from svelte's own parser, not a pattern.
 */
function svelteScriptOnly(text) {
  let ranges = []
  try {
    const ast = svelte.parse(text, { modern: true })
    for (const key of ['instance', 'module']) {
      const block = ast[key]
      if (block?.content) ranges.push([block.content.start, block.content.end])
    }
  } catch {
    // Four files use TypeScript in markup that svelte.parse rejects without the
    // repo's preprocessor. Locating the <script> region textually is a fallback,
    // not an analysis: the code inside still goes to the TypeScript parser, so
    // comments and strings remain handled structurally. Reported, because a
    // fallback nobody sees is a silent gap.
    ranges = []
    const open = /<script\b[^>]*>/gi
    let m
    while ((m = open.exec(text))) {
      const start = m.index + m[0].length
      const close = text.toLowerCase().indexOf('</script>', start)
      if (close === -1) break
      ranges.push([start, close])
      open.lastIndex = close
    }
    if (ranges.length === 0) return null
    fellBack.push(currentRel)
  }
  const out = new Array(text.length).fill(' ')
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') out[i] = '\n'
  for (const [s, e] of ranges) for (let i = s; i < e; i++) out[i] = text[i]
  return out.join('')
}

function walk(files) {
  const found = []
  // files whose <script> region came from the textual fallback
  const unparseable = []
  for (const file of files) {
    const rel = path.relative(repoRoot, file)
    currentRel = rel
    const raw = fs.readFileSync(file, 'utf8')
    let code = raw
    if (file.endsWith('.svelte')) {
      code = svelteScriptOnly(raw)
      if (code === null) {
        unparseable.push(rel)
        continue
      }
    }
    /**
     * True when the enclosing function also calls the asynchronous filesystem
     * primitive, which makes this synchronous call a deliberate fallback rather
     * than work left to do. Two shapes in the renderer today:
     *
     *   if (fsPromises.writeFile) { await fsPromises.writeFile(...); return }
     *   if (fs.writeFileSync) { fs.writeFileSync(...) }            <- fallback
     *
     *   raw = await fsPromises?.readFile?.(p) || fs?.readFileSync?.(p)
     *                                            ^-- fallback
     *
     * This is a structural signal, not a proof of unreachability: it says the
     * async path exists beside this one. Reported separately so that "4 sites
     * remain" cannot be read as "4 sites of work remain", which is what the
     * single number used to imply.
     */
    const isDeliberateFallback = (node, source) => {
      let scope = node.parent
      while (
        scope &&
        !ts.isFunctionDeclaration(scope) &&
        !ts.isFunctionExpression(scope) &&
        !ts.isArrowFunction(scope) &&
        !ts.isMethodDeclaration(scope)
      ) {
        scope = scope.parent
      }
      if (!scope) return false
      let found = false
      const scan = (n) => {
        if (found) return
        if (ts.isCallExpression(n) && /\bfsPromises\b/.test(n.expression.getText(source))) {
          found = true
          return
        }
        ts.forEachChild(n, scan)
      }
      scan(scope)
      return found
    }

    const source = ts.createSourceFile(
      file.endsWith('.svelte') ? `${file}.ts` : file,
      code,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )
    currentSource = source
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression
        if (ts.isPropertyAccessExpression(callee)) {
          const method = callee.name.text
          if (KEEPS_SIGNATURE.has(method) || NEEDS_CONVERSION.has(method)) {
            if (receiverIsFilesystem(callee.expression)) {
              const scope = enclosingFunction(node)
              found.push({
                file: rel,
                line: lineOf(node),
                method,
                receiver: callee.expression.getText(source).slice(0, 40),
                keepsSignature: KEEPS_SIGNATURE.has(method),
                awaitable: scope.isAsync,
                deliberateFallback: isDeliberateFallback(node, source),
                scope: `${scope.kind}${scope.line ? ` @${scope.line}` : ''}`
              })
            }
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return { found, unparseable }
}

function collect(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collect(full))
      continue
    }
    if (!/\.(ts|tsx|mts|js|mjs|svelte)$/.test(entry.name)) continue
    if (isExcluded(path.relative(repoRoot, full))) continue
    out.push(full)
  }
  return out
}

const files = collect(ROOT)
const { found, unparseable } = walk(files)
const convert = found.filter((f) => !f.keepsSignature)

if (JSON_OUT) {
  console.log(JSON.stringify({ found, unparseable, fellBack, scanned: files.length }, null, 2))
  process.exit(0)
}

console.log(`Scanned ${files.length} renderer files with the TypeScript parser.\n`)
console.log('Excluded, deliberately:')
for (const [frag, why] of EXCLUDED) console.log(`  ${frag.padEnd(48)} ${why}`)

// Split before printing: a call that sits beside the async primitive it falls
// back to is not work left to do, and lumping the two together is how "4 sites
// remain" gets read as "4 sites of work remain".
const fallbacks = convert.filter((f) => f.deliberateFallback)
const outstanding = convert.filter((f) => !f.deliberateFallback)
console.log(`\nSynchronous filesystem calls that need converting: ${outstanding.length}`)
const byFile = new Map()
for (const f of outstanding) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f])
for (const [file, list] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  ${file.replace('src/renderer/src/', '')}  (${list.length})`)
  for (const f of list) {
    console.log(
      `     :${String(f.line).padEnd(5)} ${f.method.padEnd(14)} ${f.awaitable ? 'await here' : 'PROPAGATES'}  ${f.scope}`
    )
  }
}

if (fallbacks.length) {
  console.log(`\nDeliberate synchronous fallbacks, to leave alone: ${fallbacks.length}`)
  console.log(
    '  Each sits in a function that also calls the asynchronous primitive, as the\n' +
      '  branch taken when that primitive is absent. Converting one would delete the\n' +
      '  fallback, not improve it. A structural signal, not a proof of unreachability.'
  )
  const fallbackByFile = new Map()
  for (const f of fallbacks) fallbackByFile.set(f.file, [...(fallbackByFile.get(f.file) ?? []), f])
  for (const [file, list] of [...fallbackByFile].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  ${file.replace('src/renderer/src/', '')}  (${list.length})`)
    for (const f of list) {
      console.log(`     :${String(f.line).padEnd(5)} ${f.method.padEnd(14)} FALLBACK    ${f.scope}`)
    }
  }
}

const keep = found.filter((f) => f.keepsSignature)
console.log(`\nKeep their signature (exists/stat, served synchronously over IPC): ${keep.length}`)
console.log(`  Still to convert       : ${outstanding.length}`)
console.log(`    of those, awaitable  : ${outstanding.filter((f) => f.awaitable).length}`)
console.log(`    of those, propagating: ${outstanding.filter((f) => !f.awaitable).length}`)
console.log(`  Deliberate fallbacks   : ${fallbacks.length}`)
// Witnesses. The point of naming them is that a reader can see the tool
// distinguishing live code from dead, rather than taking the count on trust.
// Two of these were on an earlier hand-made list of "live" sites; both are
// inside /* ... */ blocks, which is what defeated every grep attempt.
const WITNESSES = [
  {
    kind: 'dead',
    file: 'utils/storePersistence.ts',
    method: 'readFileSync',
    why: 'inside the /* ... */ block spanning lines 17-56; the live persistStore below it is already fsPromises-only'
  },
  {
    kind: 'dead',
    file: 'CustomDocumentRestrictionExtension/stores/restriction.store.ts',
    method: 'readFileSync',
    why: 'inside a /* ... */ block; a grep reported it as live'
  },
  {
    kind: 'dead',
    file: 'CustomMonacoCodeBlockExtension/components/CustomMonacoCodeBlockExtensionWidget.svelte',
    method: 'readFileSync',
    why: 'inside a /* ... */ block opened a few lines above'
  },
  {
    kind: 'live',
    file: 'CustomSlideExtension/utils/pptxImport.ts',
    method: 'existsSync',
    why: 'a real call, and one that stays: existsSync keeps its signature on the IPC surface, so no migration will remove it. The first live witness here was an unlinkSync in the same file, which broke the moment that file was converted -- a witness has to point at something the work will not take away.'
  }
]

console.log('\nWitnesses -- so the report can be checked rather than believed:')
let witnessFailures = 0
for (const w of WITNESSES) {
  const hit = found.some((f) => f.file.includes(w.file) && f.method === w.method)
  const ok = w.kind === 'live' ? hit : !hit
  if (!ok) witnessFailures += 1
  const verdict =
    w.kind === 'live'
      ? hit
        ? 'found, as it should be'
        : 'MISSING'
      : hit
        ? 'REPORTED, but it is dead'
        : 'absent, as it should be'
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${w.kind.padEnd(4)} ${w.method.padEnd(13)} ${verdict}`)
  console.log(`         ${w.file}`)
  console.log(`         ${w.why}`)
}
if (witnessFailures > 0) {
  console.error(`\n${witnessFailures} witness(es) failed: the report cannot be trusted.`)
  process.exitCode = 1
}

if (fellBack.length)
  console.log(
    `\n<script> region located textually (svelte.parse needs the repo preprocessor for these), code still parsed by TypeScript:\n  ${fellBack.join('\n  ')}`
  )
if (unparseable.length)
  console.log(`\nCould not parse (reported, not skipped silently): ${unparseable.join(', ')}`)
