#!/usr/bin/env node
// Fails when the built preload does not deliver its API surface to the renderer.
//
// Why this exists
//   The preload is the only thing standing between the renderer and the main
//   process. When it throws while loading, Electron logs the error to the
//   renderer console and starts the window anyway — with no bridge at all:
//   window.api, window.server and everything else are simply undefined, and the
//   application is dead on arrival.
//
//   Nothing in the toolchain catches that. A preload that fails to load still
//   passes `typecheck:node`, `eslint`, `build:web` and a full `electron-vite
//   build`, because the fault is in what the bundle *does* when it is executed,
//   not in what it looks like. This test executes it.
//
//   The real case that motivated it: referencing a namespace import of Node's
//   `process` module kept it in the bundle, and the interop helper rollup emits
//   for such an import throws on that module — `TypeError: Cannot read
//   properties of undefined (reading 'get')` — before a single name is exposed.
//
// How it works
//   1. Builds just the preload, with the `preload` section of the real
//      electron.vite.config.ts (see preload-only.vite.config.ts), into a
//      throwaway directory outside the repository.
//   2. Executes the built bundle in this process, with a stub `electron` module
//      resolvable from that directory and a plain object standing in for
//      `window`.
//   3. Does that once per exposure route. The preload picks its route from
//      `process.contextIsolated`, so both are exercised: the DOM globals used
//      today, and the contextBridge that SPEC-001 switches to. Each must deliver
//      every name in REQUIRED_GLOBALS. Keeping both green is what makes the
//      contextIsolation flip a one-line change rather than a leap.
//
// Usage
//   npm run test:smoke:preload
//
// Scope
//   This runs in Node, not in Electron: it proves the bundle executes and
//   exposes its surface by both routes, not that Electron's contextBridge
//   serialises every value (verified separately, by hand, on PR #95). It needs
//   no Electron binary and no display, so it runs anywhere CI can run `npm ci`.

/* eslint-disable @typescript-eslint/explicit-function-return-type --
   plain .mjs: there is no type annotation syntax to satisfy this rule here. */

import Module from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const PRELOAD_CONFIG = path.join(here, 'preload-only.vite.config.ts')

// Every name the renderer is entitled to find, whichever route the preload
// took. `node` is on the list because it is exposed today; SPEC-001 removes it,
// and this list is then the tripwire that says so out loud, rather than letting
// the set of names crossing the security boundary change in silence.
const REQUIRED_GLOBALS = [
  '__platform',
  'api',
  'electronAPI',
  'meetingAPI',
  'node',
  'presentationAPI',
  'server',
  'terminal'
]

// The preload reads `process.contextIsolated` to choose a route. Electron sets
// it; in Node it is undefined, so it has to be set here to reach the second.
const MODES = [
  { name: 'contextIsolation off — DOM globals (what ships today)', contextIsolated: false },
  { name: 'contextIsolation on — contextBridge (SPEC-001 target)', contextIsolated: true }
]

const log = (...args) => console.log('[preload-smoke]', ...args)

function fail(message) {
  console.error(`\n[preload-smoke] FAIL: ${message}\n`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// 1. Build the preload on its own.

function buildPreload(outDir) {
  const bin = path.join(repoRoot, 'node_modules', '.bin', 'electron-vite')
  const result = spawnSync(
    bin,
    ['build', '-c', PRELOAD_CONFIG, '--outDir', outDir, '--logLevel', 'warn'],
    { cwd: repoRoot, encoding: 'utf8' }
  )
  if (result.error) fail(`could not run electron-vite: ${result.error.message}`)
  if (result.status !== 0) {
    fail(
      `the preload did not build (electron-vite exited ${result.status})\n` +
        `${result.stdout || ''}${result.stderr || ''}`
    )
  }
  return path.join(outDir, 'preload', 'index.js')
}

// ---------------------------------------------------------------------------
// 2. A stub `electron`, resolvable from the build output.

// Only the members the preload touches. Calls happen inside the exposed
// functions, not while the module loads, so these never need to do anything —
// but they must exist, or a module-scope call would fail for the wrong reason.
function makeElectronStub(exposed) {
  const noop = () => {}
  return {
    contextBridge: {
      exposeInMainWorld: (name, value) => {
        exposed[name] = value
      }
    },
    ipcRenderer: {
      on: noop,
      off: noop,
      once: noop,
      send: noop,
      sendSync: noop,
      invoke: async () => undefined,
      removeListener: noop,
      removeAllListeners: noop
    },
    clipboard: {
      availableFormats: () => [],
      readBuffer: () => Buffer.alloc(0),
      readText: () => '',
      readHTML: () => '',
      readImage: () => null,
      writeText: noop,
      write: noop
    },
    nativeImage: { createFromDataURL: () => null, createEmpty: () => null },
    webUtils: { getPathForFile: () => '' },
    shell: { openExternal: async () => undefined, showItemInFolder: noop }
  }
}

function installElectronStub(dir) {
  const pkgDir = path.join(dir, 'node_modules', 'electron')
  mkdirSync(pkgDir, { recursive: true })
  writeFileSync(
    path.join(pkgDir, 'package.json'),
    JSON.stringify({ name: 'electron', version: '0.0.0-stub', main: 'index.cjs' })
  )
  // Every access reaches back for the live object, so the test sees what the
  // preload exposed on the route being run. Resolved on access rather than at
  // load, because Node caches this module across routes. Same process, so
  // globalThis is shared.
  writeFileSync(
    path.join(pkgDir, 'index.cjs'),
    'module.exports = new Proxy(\n' +
      '  {},\n' +
      '  { get: (_target, key) => globalThis.__PRELOAD_SMOKE_ELECTRON__[key] }\n' +
      ')\n'
  )
}

// ---------------------------------------------------------------------------
// 3. Execute the bundle once for one route, and collect what it delivered.

function runMode(bundlePath, mode) {
  const require = Module.createRequire(import.meta.url)
  // Drop the bundle so the next route re-executes it rather than returning the
  // first route's exports. require.resolve, not path.resolve: on macOS the
  // cache is keyed by the realpath of the temporary directory, which differs.
  delete require.cache[require.resolve(bundlePath)]

  const exposed = {}
  const windowStub = { addEventListener: () => {}, removeEventListener: () => {} }
  const previousWindow = globalThis.window
  const previousIsolated = process.contextIsolated

  globalThis.window = windowStub
  globalThis.__PRELOAD_SMOKE_ELECTRON__ = makeElectronStub(exposed)
  process.contextIsolated = mode.contextIsolated

  try {
    require(bundlePath)
  } catch (error) {
    // The full stack matters: it separates "the preload is broken" from "this
    // test's electron stub is missing a member the preload now calls at load".
    fail(
      `with ${mode.name}, the built preload threw while loading, so the ` +
        `renderer would get no bridge at all:\n\n${error?.stack || error}`
    )
  } finally {
    globalThis.window = previousWindow
    delete globalThis.__PRELOAD_SMOKE_ELECTRON__
    process.contextIsolated = previousIsolated
  }

  const onWindow = Object.keys(windowStub).filter(
    (k) => k !== 'addEventListener' && k !== 'removeEventListener'
  )
  return { onWindow, onBridge: Object.keys(exposed) }
}

// ---------------------------------------------------------------------------

const outDir = mkdtempSync(path.join(tmpdir(), 'ddoc-preload-smoke-'))
try {
  log('building the preload…')
  const bundlePath = buildPreload(outDir)
  installElectronStub(outDir)

  for (const mode of MODES) {
    log(`— ${mode.name}`)
    const { onWindow, onBridge } = runMode(bundlePath, mode)
    const delivered = new Set([...onWindow, ...onBridge])

    log(`    window.*      : ${onWindow.sort().join(', ') || '(none)'}`)
    log(`    contextBridge : ${onBridge.sort().join(', ') || '(none)'}`)

    const missing = REQUIRED_GLOBALS.filter((name) => !delivered.has(name))
    if (missing.length > 0) {
      fail(
        `with ${mode.name}, the renderer would not receive ${missing.length} of ` +
          `${REQUIRED_GLOBALS.length} required name(s): ${missing.join(', ')}\n` +
          `  delivered: ${[...delivered].sort().join(', ') || '(none)'}`
      )
    }

    const extra = [...delivered].filter((name) => !REQUIRED_GLOBALS.includes(name))
    if (extra.length > 0) {
      log(`    also exposed, not required: ${extra.sort().join(', ')}`)
    }
  }

  log(`OK — all ${REQUIRED_GLOBALS.length} required names reach the renderer by both routes`)
} finally {
  rmSync(outDir, { recursive: true, force: true })
}
