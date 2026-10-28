#!/usr/bin/env node
// Opens a known document in the local web app and fails when its text is not
// visible in the DOM within a threshold.
//
// How it works
//   1. A small mock of the share API (/share/resolve, /share/download) serves
//      the fixture document under tests/e2e/fixtures/open-timing-doc, zipped
//      on the fly, on a port the page's Content-Security-Policy allows.
//   2. The Vite web dev server is started (or DDOC_WEB_URL is reused).
//   3. Headless Chrome opens the app on a share link with the API base pointed
//      at the mock. No account is involved and nothing leaves the machine:
//      every request to a non-local host is aborted and reported.
//   4. One warm-up open lets the dev server transform the editor's modules,
//      then a second open in a fresh browser context (empty IndexedDB) is
//      measured: the first .ProseMirror must show the fixture text within
//      OPEN_TIMING_THRESHOLD_MS of the app's own "open:start" mark.
//
// Usage
//   npm run test:e2e:open-timing
//   OPEN_TIMING_THRESHOLD_MS=3000 npm run test:e2e:open-timing
//   DDOC_WEB_URL=http://127.0.0.1:5173 npm run test:e2e:open-timing   # reuse a running server
//   OPEN_TIMING_WARMUP=0 npm run test:e2e:open-timing                 # skip the warm-up open
//
// The threshold covers the document open (open:start -> text visible), not the
// page load: in dev mode the first page load is dominated by on-demand module
// transforms, which say nothing about how fast a document opens. The time from
// navigation to text is reported alongside.

import http from 'node:http'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { zipSync } from 'fflate'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..')
const FIXTURE_DIR = path.join(here, 'fixtures', 'open-timing-doc')
const FIXTURE_FOLDER = 'open-timing-doc'
const FIXTURE_SENTINEL = 'Open timing fixture'
const SHARE_ID = 'open-timing-share'
const DOC_UUID = '7e1c2a40-5b3d-4c8e-9f21-0a6b4d8e2c13'

const THRESHOLD_MS = Number(process.env.OPEN_TIMING_THRESHOLD_MS || 5000)
// Upper bound for one open, warm-up included; the dev server's cold start is slow.
const DEADLINE_MS = Number(process.env.OPEN_TIMING_DEADLINE_MS || 180000)
const WARMUP = process.env.OPEN_TIMING_WARMUP !== '0'
// Ports the page's Content-Security-Policy (src/renderer/index.html) allows
// for a local API, in order of preference.
const CSP_API_PORTS = [8081, 5000, 3000, 7070]

const log = (...args) => console.log('[open-timing-test]', ...args)

// ---------------------------------------------------------------------------
// Fixture: the document folder, zipped the way /share/download serves it.

function zipFixture() {
  const files = {}
  const walk = (dir, rel) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      const relPath = rel ? `${rel}/${name}` : name
      if (statSync(full).isDirectory()) walk(full, relPath)
      else files[`${FIXTURE_FOLDER}/${relPath}`] = new Uint8Array(readFileSync(full))
    }
  }
  walk(FIXTURE_DIR, '')
  return zipSync(files, { level: 6 })
}

// ---------------------------------------------------------------------------
// Mock share API.

function startMockApi(zipBytes) {
  const unmocked = []
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    if (url.pathname === '/share/resolve') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          ok: true,
          data: {
            shareId: SHARE_ID,
            docUuid: DOC_UUID,
            name: FIXTURE_FOLDER,
            docFolder: FIXTURE_FOLDER,
            targetType: 'file',
            canView: true,
            canEdit: false,
            requiresAuth: false,
            role: 'viewer'
          }
        })
      )
      return
    }
    if (url.pathname === '/share/download') {
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': zipBytes.length })
      res.end(Buffer.from(zipBytes))
      return
    }
    unmocked.push(`${req.method} ${url.pathname}`)
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: `not mocked: ${url.pathname}` }))
  })

  const listenOn = (port) =>
    new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, () => {
        server.removeListener('error', reject)
        resolve(port)
      })
    })

  return (async () => {
    let port = null
    for (const candidate of CSP_API_PORTS) {
      try {
        port = await listenOn(candidate)
        break
      } catch (error) {
        if (error?.code !== 'EADDRINUSE') throw error
      }
    }
    if (port === null) {
      throw new Error(`no free port among ${CSP_API_PORTS.join(', ')} for the mock API`)
    }
    return {
      base: `http://localhost:${port}`,
      unmocked,
      close: () => new Promise((resolve) => server.close(() => resolve()))
    }
  })()
}

// ---------------------------------------------------------------------------
// Web app server.

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
      lastError = new Error(`HTTP ${res.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`${url} did not answer in ${timeoutMs} ms: ${lastError?.message || lastError}`)
}

async function startWebServer(apiBase) {
  const given = process.env.DDOC_WEB_URL
  if (given) return { url: given.replace(/\/$/, ''), stop: async () => {} }

  const port = await freePort()
  const viteBin = path.join(repoRoot, 'node_modules', '.bin', 'vite')
  const child = spawn(
    viteBin,
    [
      '--config',
      'web.vite.config.mts',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort'
    ],
    {
      cwd: repoRoot,
      env: { ...process.env, VITE_API_URL: apiBase },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )
  const tail = []
  const keep = (chunk) => {
    tail.push(String(chunk))
    if (tail.length > 40) tail.shift()
  }
  child.stdout.on('data', keep)
  child.stderr.on('data', keep)
  const exited = new Promise((resolve) => child.once('exit', resolve))

  const url = `http://127.0.0.1:${port}`
  try {
    await Promise.race([
      waitForHttp(`${url}/`, 120000),
      exited.then((code) => {
        throw new Error(`vite exited with code ${code}\n${tail.join('')}`)
      })
    ])
  } catch (error) {
    child.kill('SIGTERM')
    throw error
  }
  return {
    url,
    stop: async () => {
      child.kill('SIGTERM')
      await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))])
    }
  }
}

// ---------------------------------------------------------------------------
// One open of the shared document, in a fresh browser context.

const isLocalHost = (host) => host === '127.0.0.1' || host === 'localhost' || host === '::1'

async function openShare(browser, webUrl, apiBase) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  const external = []
  const timingLines = []
  const pageErrors = []

  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const url = request.url()
    let host = ''
    try {
      host = new URL(url).hostname
    } catch {
      // data: and blob: URLs
    }
    if (!host || isLocalHost(host)) {
      request.continue()
      return
    }
    external.push(url)
    request.abort()
  })
  page.on('console', (message) => {
    const text = message.text()
    if (text.startsWith('[open-timing]')) timingLines.push(text)
  })
  page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)))
  // First thing resolveApiBaseUrl() looks at.
  await page.evaluateOnNewDocument((base) => {
    window.__DYNADOC_API_BASE__ = base
  }, apiBase)

  const shareUrl = `${webUrl}/?shareId=${SHARE_ID}&docUuid=${DOC_UUID}`
  await page.goto(shareUrl, { waitUntil: 'domcontentloaded', timeout: DEADLINE_MS })

  // The clock is the app's own open:start mark; the check is DOM-only.
  const probe = (threshold, sentinel) => {
    const start = performance.getEntriesByName('open:start')[0]
    if (!start) return false
    const el = document.querySelector('.ProseMirror')
    const text = el ? (el.textContent || '').trim() : ''
    const shown =
      !!el &&
      text.includes(sentinel) &&
      (typeof el.checkVisibility !== 'function' ||
        el.checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
          checkOpacity: true,
          checkVisibilityCSS: true
        }))
    const elapsed = performance.now() - start.startTime
    if (shown) {
      return {
        ok: true,
        openToTextMs: Math.round(elapsed),
        navToTextMs: Math.round(performance.now())
      }
    }
    if (elapsed > threshold) {
      const loader = document.querySelector('.wysiwyg-loader')
      return {
        ok: false,
        openToTextMs: Math.round(elapsed),
        proseMirrorText: text.slice(0, 120),
        loaderText: loader
          ? (loader.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160)
          : ''
      }
    }
    return false
  }
  const handle = await page.waitForFunction(
    probe,
    { timeout: DEADLINE_MS, polling: 'raf' },
    THRESHOLD_MS,
    FIXTURE_SENTINEL
  )
  const result = await handle.jsonValue()

  if (!result.ok) {
    // Say whether the text arrives late or never.
    try {
      const late = await page.waitForFunction(
        (sentinel) => {
          const el = document.querySelector('.ProseMirror')
          const start = performance.getEntriesByName('open:start')[0]
          if (!el || !start || !(el.textContent || '').includes(sentinel)) return false
          return Math.round(performance.now() - start.startTime)
        },
        { timeout: 30000, polling: 'raf' },
        FIXTURE_SENTINEL
      )
      result.textArrivedAfterMs = await late.jsonValue()
    } catch {
      result.textArrivedAfterMs = null
    }
  }

  // The app's own report follows the text by a frame; give it a moment.
  const until = Date.now() + 3000
  while (!timingLines.length && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 50))
  }
  let timing = null
  if (timingLines.length) {
    try {
      timing = JSON.parse(timingLines[0].slice('[open-timing]'.length).trim())
    } catch {
      timing = timingLines[0]
    }
  }

  await context.close()
  return { ...result, timing, timingLine: timingLines[0] || null, external, pageErrors }
}

// ---------------------------------------------------------------------------

async function main() {
  const zipBytes = zipFixture()
  const api = await startMockApi(zipBytes)
  log(`mock share API on ${api.base}`)
  let web = null
  let browser = null
  try {
    web = await startWebServer(api.base)
    log(`web app on ${web.url}`)
    browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1280, height: 900 }
    })

    if (WARMUP) {
      const warm = await openShare(browser, web.url, api.base)
      log(
        `warm-up open: ${warm.ok ? 'text shown' : 'text not shown'} after ${warm.openToTextMs} ms`
      )
    }

    const run = await openShare(browser, web.url, api.base)
    const leakedToProd = run.external.filter((url) => /dashmake\.com/i.test(url))
    const ok = run.ok && leakedToProd.length === 0

    console.log(
      JSON.stringify(
        {
          ok,
          thresholdMs: THRESHOLD_MS,
          openToTextMs: run.openToTextMs,
          navToTextMs: run.navToTextMs ?? null,
          textArrivedAfterMs: run.textArrivedAfterMs,
          timing: run.timing,
          externalRequestsBlocked: run.external,
          unmockedApiCalls: api.unmocked,
          pageErrors: run.pageErrors,
          ...(run.ok ? {} : { proseMirrorText: run.proseMirrorText, loaderText: run.loaderText })
        },
        null,
        2
      )
    )
    if (!run.ok) {
      log(
        `FAIL: text not visible within ${THRESHOLD_MS} ms of open:start (${run.openToTextMs} ms elapsed)`
      )
    }
    if (leakedToProd.length) {
      log(
        `FAIL: ${leakedToProd.length} request(s) aimed at dashmake.com (blocked): ${leakedToProd.join(', ')}`
      )
    }
    if (ok)
      log(
        `PASS: text visible ${run.openToTextMs} ms after open:start (threshold ${THRESHOLD_MS} ms)`
      )
    process.exitCode = ok ? 0 : 1
  } finally {
    await browser?.close().catch(() => {})
    await web?.stop().catch(() => {})
    await api.close().catch(() => {})
  }
}

main().catch((error) => {
  console.error('[open-timing-test] error:', error?.stack || error)
  process.exitCode = 1
})
