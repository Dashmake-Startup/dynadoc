#!/usr/bin/env node
// Exercises the filesystem path policy against real directories, real
// symlinks and real traversal attempts.
//
// Why this exists
//   SPEC-001 Block A takes direct disk access away from the renderer. The
//   channel that replaces it is only an improvement if it is narrower, and the
//   whole of "narrower" lives in one class: FilesystemPathPolicy. An allowlist
//   nobody has tried to walk out of is not an allowlist.
//
//   So this walks out of it, the ways an attacker would: `..`, a symlink
//   planted inside an allowed root, a symlink planted there whose target does
//   not exist yet, a sibling directory whose name starts with an allowed one,
//   a NUL byte, and a path the user never chose.
//
// Usage
//   npm run test:smoke:fs-policy

/* eslint-disable @typescript-eslint/explicit-function-return-type --
   plain .mjs: there is no type annotation syntax to satisfy this rule here. */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const SOURCE = path.join(repoRoot, 'src', 'main', 'utils', 'FilesystemPathPolicy.ts')

const log = (...args) => console.log('[fs-policy]', ...args)
let failures = 0

function check(name, actual, expected) {
  if (actual === expected) {
    log(`  ok    ${name}`)
  } else {
    failures += 1
    console.error(`  FAIL  ${name}\n          expected ${expected}, got ${actual}`)
  }
}

// ---------------------------------------------------------------------------
// The policy is TypeScript in the main process and deliberately free of
// Electron imports, so esbuild can turn just that one file into something
// importable without building the whole app.

const work = mkdtempSync(path.join(tmpdir(), 'ddoc-fs-policy-'))
try {
  const compiled = path.join(work, 'policy.mjs')
  const esbuild = path.join(repoRoot, 'node_modules', '.bin', 'esbuild')
  const build = spawnSync(
    esbuild,
    [
      SOURCE,
      '--bundle',
      '--platform=node',
      '--format=esm',
      '--external:fs',
      '--external:path',
      `--outfile=${compiled}`
    ],
    { encoding: 'utf8' }
  )
  if (build.status !== 0) {
    console.error(`[fs-policy] FAIL: could not compile the policy\n${build.stdout}${build.stderr}`)
    process.exit(1)
  }

  const { FilesystemPathPolicy, isInside } = await import(`file://${compiled}`)

  // -------------------------------------------------------------------------
  // A layout that mirrors the real one: an owned root, a place outside it, and
  // a sibling whose name starts the same way.

  const root = path.join(work, 'storage')
  const outside = path.join(work, 'elsewhere')
  const sibling = path.join(work, 'storage-old')
  for (const d of [root, outside, sibling]) mkdirSync(d, { recursive: true })
  writeFileSync(path.join(root, 'doc.sddoc'), 'owned')
  writeFileSync(path.join(outside, 'secret.txt'), 'not yours')
  writeFileSync(path.join(sibling, 'doc.sddoc'), 'different folder')

  const policy = new FilesystemPathPolicy([root])

  const verdict = (p) => {
    const d = policy.check(p)
    return d.allowed ? 'allowed' : d.error.code
  }

  log('roots')
  check('a file inside the root', verdict(path.join(root, 'doc.sddoc')), 'allowed')
  check('the root itself', verdict(root), 'allowed')
  check(
    'a file that does not exist yet, inside the root',
    verdict(path.join(root, 'new', 'a.txt')),
    'allowed'
  )
  check('a file outside every root', verdict(path.join(outside, 'secret.txt')), 'DENIED')

  log('the sibling-prefix trap')
  check(
    'a sibling folder whose name starts with the root',
    verdict(path.join(sibling, 'doc.sddoc')),
    'DENIED'
  )

  log('traversal')
  check('climbing out with ..', verdict(path.join(root, '..', 'elsewhere', 'secret.txt')), 'DENIED')
  check(
    'climbing out through a path that does not exist',
    verdict(path.join(root, 'nope', '..', '..', 'elsewhere', 'x')),
    'DENIED'
  )

  log('symlinks')
  const link = path.join(root, 'escape')
  symlinkSync(outside, link, 'dir')
  check(
    'a symlink inside the root pointing out of it',
    verdict(path.join(link, 'secret.txt')),
    'DENIED'
  )
  check('the symlink itself', verdict(link), 'DENIED')

  // A link whose target is missing is the dangerous half: fs.existsSync
  // follows links, so it reads as absent, the climb walks past it and its name
  // comes back re-appended inside the root. A write to that "allowed" path
  // follows the link and creates the file outside. Hence the lstat-based
  // existence test in the policy.
  const dangling = path.join(root, 'dangling')
  symlinkSync(path.join(outside, 'planted.txt'), dangling, 'file')
  check(
    'a dangling symlink in the root is not a writable in-root path',
    verdict(dangling),
    'INVALID'
  )
  check(
    'nor is a path through a dangling directory symlink',
    verdict(path.join(root, 'dangling', 'child.txt')),
    'INVALID'
  )
  // And the write that the verdict is protecting really would escape.
  const d = policy.check(dangling)
  if (d.allowed) {
    writeFileSync(d.resolved, 'escaped')
    check('…and nothing was created outside', existsSync(path.join(outside, 'planted.txt')), false)
  }

  log('relative paths')
  check('a relative path', verdict('some/where.txt'), 'INVALID')
  check('a bare filename', verdict('where.txt'), 'INVALID')

  log('grants')
  const chosen = path.join(outside, 'chosen.docx')
  writeFileSync(chosen, 'the user picked this')
  check('a user-chosen file before the grant', verdict(chosen), 'DENIED')
  policy.grant({ path: chosen, directory: false })
  check('a user-chosen file after the grant', verdict(chosen), 'allowed')
  check('its neighbour, not granted', verdict(path.join(outside, 'secret.txt')), 'DENIED')

  log('grants refuse loudly instead of vanishing')
  const brokenChoice = path.join(root, 'broken-choice')
  symlinkSync(path.join(outside, 'gone.txt'), brokenChoice, 'file')
  const brokenGrant = policy.grant({ path: brokenChoice, directory: false })
  check('granting a broken link is refused, not silently dropped', brokenGrant.allowed, false)
  check('  and it says why', brokenGrant.error?.code, 'INVALID')
  check('a grant with no path', policy.grant({ path: '', directory: false }).allowed, false)

  log('a directory grant may not be everything')
  check(
    'the filesystem root',
    policy.grant({ path: path.parse(work).root, directory: true }).allowed,
    false
  )
  const home = process.env.HOME || process.env.USERPROFILE
  if (home) {
    check('the home directory', policy.grant({ path: home, directory: true }).allowed, false)
    check(
      '  but home as a single file grant is fine',
      policy.grant({ path: home, directory: false }).allowed,
      true
    )
  }

  log('a granted file is still the same file under another spelling')
  // macOS hands back NFD from the filesystem and NFC from a dialog for the
  // same accented name, and its filesystem is case-insensitive. A grant that
  // compared with === refused both.
  const accentNfc = path.join(outside, 'caf\u00e9.docx')
  writeFileSync(accentNfc, 'accented')
  policy.grant({ path: accentNfc, directory: false })
  const accentNfd = path.join(outside, 'cafe\u0301.docx')
  check('the same name in the other unicode form', policy.check(accentNfd).allowed, true)

  const mixedCase = path.join(outside, 'Chosen-Case.docx')
  writeFileSync(mixedCase, 'x')
  policy.grant({ path: mixedCase, directory: false })
  const lowered = path.join(outside, 'chosen-case.docx')
  if (process.platform === 'linux') {
    // Two genuinely different files on a case-sensitive filesystem.
    check('a different case is a different file on linux', policy.check(lowered).allowed, false)
  } else {
    check('a different case is the same file here', policy.check(lowered).allowed, true)
  }

  const chosenDir = path.join(work, 'picked-folder')
  mkdirSync(path.join(chosenDir, 'deep'), { recursive: true })
  writeFileSync(path.join(chosenDir, 'deep', 'f.txt'), 'x')
  policy.grant({ path: chosenDir, directory: true })
  check('inside a granted directory', verdict(path.join(chosenDir, 'deep', 'f.txt')), 'allowed')

  log('malformed input')
  check('empty string', verdict(''), 'INVALID')
  check('not a string', verdict(42), 'INVALID')
  check('null', verdict(null), 'INVALID')
  check('a NUL byte', verdict(`${path.join(root, 'doc.sddoc')}\0.png`), 'INVALID')

  log('isInside, on its own')
  check('identical paths', isInside('/a/b', '/a/b'), true)
  check('child', isInside('/a/b/c', '/a/b'), true)
  check('sibling sharing a prefix', isInside('/a/bb', '/a/b'), false)
  check('parent is not inside its child', isInside('/a', '/a/b'), false)

  log('grants survive an export, for reopening a recent file after a restart')
  const exported = policy.exportGrants()
  check('every accepted grant comes back', exported.length >= 2, true)
  const restored = new FilesystemPathPolicy([root])
  for (const g of exported) restored.grant(g)
  check('a restored grant still allows its file', restored.check(chosen).allowed, true)

  if (failures > 0) {
    console.error(`\n[fs-policy] FAIL: ${failures} check(s) failed\n`)
    process.exit(1)
  }
  log('OK — every escape attempt was refused and every legitimate path allowed')
} finally {
  if (existsSync(work)) rmSync(work, { recursive: true, force: true })
}
