#!/usr/bin/env node
/**
 * Dynadoc local stub bridge
 * ========================
 *
 * The Dynadoc client is open core: this repository holds the client, and the
 * middleware bridge it talks to is not published. Without a bridge the client
 * starts and then fails on its first call, so the repository can be read but
 * not run.
 *
 * This file closes that gap. It answers the same HTTP contract the real bridge
 * answers, on the channels a document editor genuinely needs, backed by one
 * directory on the contributor's own disk. No account, no cloud, no licence,
 * no sealing.
 *
 * The one rule it follows: it never pretends. A channel it does not implement
 * returns a named refusal, with HTTP 400 and the same `{ "error": ... }` shape
 * the bridge uses for an unsupported channel, so the client's existing error
 * path handles it unchanged. It never answers an empty list, a `false` or a
 * cheerful `true` in place of a feature it does not have: that would teach a
 * behaviour the product does not have and hide real bugs behind it.
 *
 * Where it mirrors a quirk of the real bridge, it mirrors it on purpose. Those
 * places are commented, because the point of the stub is that code written
 * against it also works against the bridge.
 *
 * It is a development tool. It verifies no token, enforces no permission and
 * listens on the loopback interface only. Do not put it on a network.
 *
 * Usage:
 *   node tools/stub-bridge/server.mjs
 *
 * Environment:
 *   DYNADOC_STUB_ROOT   directory that backs the virtual drive
 *                       (default: ~/.dynadoc-stub)
 *   DYNADOC_STUB_PORT   port to listen on (default: 7070)
 *   DYNADOC_STUB_FAIL   failure rules, separated by `;`, so a client change can
 *                       be shown to survive a bridge that refuses or that
 *                       answers a wrong negative. See "Failure injection".
 *   DYNADOC_STUB_FAIL_FILE
 *                       where the same rules are read from, re-read on every
 *                       call (default: <root>.failures)
 */

import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(process.env.DYNADOC_STUB_ROOT || path.join(os.homedir(), '.dynadoc-stub'))
const PORT = Number(process.env.DYNADOC_STUB_PORT || 7070)
// Bound to the loopback address, but always named as localhost. The client's
// Content Security Policy allowlists the localhost form and not the numeric
// one, which are different origins to CSP, so printing the number would hand
// the reader the one spelling the browser refuses.
const HOST = '127.0.0.1'
const DISPLAY_HOST = 'localhost'

/**
 * The client calls these but no bridge implements them: the production handler
 * has no case for either, so both fall through to "unsupported channel". They
 * get their own refusal so nobody reads the generic one as "the full bridge
 * would do this" and goes looking for a feature that does not exist.
 */
const UNIMPLEMENTED_EVERYWHERE = new Set(['fs:renameSync', 'fs:rmSync'])

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/**
 * The client normalizes a path before sending it: backslashes become slashes,
 * a `file://` prefix, a leading slash, a drive letter and a leading `drive/`
 * are stripped. The bridge strips the same prefixes again on arrival, so this
 * does too, and for the same reason: a path can also reach it from code that
 * skipped the client-side helper.
 */
function normalizeRemotePath(raw) {
  let value = String(raw ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^file:\/\//i, '')
  value = value.replace(/^\/+/, '')
  value = value.replace(/^drive\/+/, '')
  if (value === 'drive') value = ''
  return value.replace(/^\/+/, '').trim()
}

class StubError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

function refusal(message) {
  return `[dynadoc local stub] ${message}`
}

/** Resolve a client path inside ROOT, refusing anything that escapes it. */
function localPath(remotePath) {
  const normalized = normalizeRemotePath(remotePath)
  const resolved = path.resolve(ROOT, normalized)
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
    // Logged like every other refusal, and more loudly than most: this is the
    // one refusal that protects something, so it must not be the quiet one.
    console.error(`refused  path escape: ${remotePath}`)
    throw new StubError(
      refusal(`path "${remotePath}" escapes the stub root and was refused`),
      400
    )
  }
  return resolved
}

// Deliberately a sibling of the drive root rather than a file inside it: the
// drive root is listed to the user, and a store belonging to the stub has no
// business appearing in it as a document.
const SETTINGS_FILE = `${ROOT}.settings.json`

async function readSettings() {
  try {
    return JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf8'))
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// Failure injection
// ---------------------------------------------------------------------------

/**
 * Two shapes of bridge failure have cost real documents, and neither is
 * reachable by running the stub normally:
 *
 *   - a channel that refuses. HTTP 400 and the bridge's bare `{ error }`, for
 *     instance `open /data/.tmp/ddoc-asset-2968340161.bin: no such file or
 *     directory` on an `fs:readFile` of a file that is perfectly there.
 *   - a channel that answers a valid but wrong negative. `false` from
 *     `fs:existsSync` for a file that exists, which is what a drive answering
 *     late looks like from the client.
 *
 * The second is the dangerous one, because nothing in the client can tell it
 * from the truth: code that writes a default "if the file is not there" writes
 * it over a file that is.
 *
 * Both are injected here, by rule, so that a client change can be shown to
 * survive them rather than argued to. Nothing happens unless rules are given:
 * with none, every call takes exactly the path it took before.
 *
 * Rules come from DYNADOC_STUB_FAIL, separated by `;`, and from a rule file
 * that is re-read on every call -- so a rule can be turned on and off while
 * the stub runs and while a page stays open, which is what it takes to
 * reproduce a failure that is intermittent. That re-read costs one failed open
 * per call when there is no rule file, which is the normal case and cheap.
 *
 * One rule per line:
 *
 *     <channel> <path-suffix> [refuse|deny] [message]
 *
 *     fs:existsSync index.config.json deny
 *     fs:readFile index.html refuse open /data/.tmp/a.bin: no such file or directory
 *
 * `refuse` is the default and answers HTTP 400 with `message`, or with the
 * production message above when none is given. The message is passed through
 * unchanged, with none of the stub's own prefix: the point is to reproduce what
 * the bridge said, not to announce the stub.
 *
 * `deny` answers the negative that channel can legitimately return -- `false`,
 * `''`, `[]` or `null`. Those are the same answers the client's own guest-mode
 * and share-cache guards hand back, so they are shapes it already meets. A
 * rule naming a channel with no legitimate negative, or a mode that is neither
 * word, is reported by name and ignored: a rule that does not do what it says
 * would be worse than no rule at all.
 */
const FAILURE_FILE = process.env.DYNADOC_STUB_FAIL_FILE || `${ROOT}.failures`

/** What the bridge said in production, the day this was worth building. */
const DEFAULT_REFUSAL = 'open /data/.tmp/ddoc-asset-2968340161.bin: no such file or directory'

/** The negative each channel can answer without lying about its shape. */
const DENIABLE = {
  'fs:existsSync': false,
  'fs:readFile': '',
  'fs:readFileSync': '',
  'read-file': '',
  'read-file-content': '',
  'fs:readdir': [],
  'fs:readdirSync': [],
  'read-dir': [],
  'fs:statSync': null,
  'fs:lstatSync': null
}

const reportedRules = new Set()

function reportBadRule(line, origin, reason) {
  const key = `${origin}:${line}`
  if (reportedRules.has(key)) return
  reportedRules.add(key)
  console.error(`ignored  failure rule from ${origin}: ${line} -- ${reason}`)
}

function parseFailureRules(text, origin) {
  const rules = []
  for (const line of String(text || '').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [channel, suffix, mode, ...message] = trimmed.split(/\s+/)
    if (!suffix) {
      reportBadRule(trimmed, origin, 'expected "<channel> <path-suffix> [refuse|deny] [message]"')
      continue
    }
    if (mode !== undefined && mode !== 'refuse' && mode !== 'deny') {
      reportBadRule(trimmed, origin, `mode must be "refuse" or "deny", not "${mode}"`)
      continue
    }
    if (mode === 'deny' && !(channel in DENIABLE)) {
      reportBadRule(trimmed, origin, `${channel} has no negative it could answer; use refuse`)
      continue
    }
    rules.push({
      channel,
      suffix,
      kind: mode || 'refuse',
      message: message.join(' ')
    })
  }
  return rules
}

async function loadFailureRules() {
  const fromEnv = String(process.env.DYNADOC_STUB_FAIL || '')
    .split(';')
    .join('\n')
  const rules = parseFailureRules(fromEnv, 'DYNADOC_STUB_FAIL')
  try {
    rules.push(...parseFailureRules(await fs.readFile(FAILURE_FILE, 'utf8'), FAILURE_FILE))
  } catch {
    // No rule file. The normal case, and the reason this is not an error.
  }
  return rules
}

/**
 * Applies the first rule that matches this call, if any. Throws for `refuse`,
 * and returns `{ value }` for `deny` so the caller answers that instead of
 * running the channel. Returns null when no rule matches, which is when the
 * stub behaves exactly as it does without this file.
 */
async function injectedFailure(channel, args) {
  const rules = await loadFailureRules()
  if (rules.length === 0) return null
  const target = normalizeRemotePath(typeof args[0] === 'string' ? args[0] : '')
  for (const rule of rules) {
    if (rule.channel !== channel) continue
    if (rule.suffix !== '*' && !target.endsWith(rule.suffix)) continue
    console.error(`injected ${rule.kind} ${channel} ${target || '(no path)'}`)
    if (rule.kind === 'deny') return { value: DENIABLE[channel] }
    throw new StubError(rule.message || DEFAULT_REFUSAL, 400)
  }
  return null
}

function requireKey(args) {
  const key = args[0]
  if (typeof key !== 'string' || key.trim() === '') {
    throw new StubError('key is required', 400)
  }
  return key
}

function requirePath(args, index = 0) {
  const value = args[index]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new StubError('path is required', 400)
  }
  return value
}

// ---------------------------------------------------------------------------
// Payload decoding
// ---------------------------------------------------------------------------

/**
 * Decode the `data` argument of a write.
 *
 * The bridge accepts two shapes: a base64 string when the third argument says
 * `base64`, and any other JSON string as raw text. Anything else it coerces
 * with a generic stringify, which for a serialized Buffer writes the printed
 * form of the object into the file instead of the bytes. The stub refuses that
 * case rather than reproduce it: a refusal surfaces the problem, whereas a
 * corrupted file hides it in the one place a contributor would not look.
 */
function decodeWriteData(value, encoding) {
  if (String(encoding || '').toLowerCase() === 'base64') {
    if (typeof value !== 'string') {
      throw new StubError('encoding is base64 but the data is not a string', 400)
    }
    return Buffer.from(value, 'base64')
  }
  if (typeof value === 'string') return Buffer.from(value, 'utf8')
  throw new StubError(
    refusal(
      'a write payload that is not a string, and not declared as base64, was refused. ' +
        'The real bridge stringifies it, which writes the printed form of the object ' +
        'instead of its bytes. Send a string, or send base64 and pass "base64" as the encoding.'
    ),
    400
  )
}

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.gif': 'image/gif',
  '.htm': 'text/html; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip'
}

// ---------------------------------------------------------------------------
// Drive entries
// ---------------------------------------------------------------------------

/**
 * The shape the bridge returns from a stat and from every element of a
 * directory listing. The field names are the contract, snake_case included,
 * and the client reads `is_dir` through a tolerant accessor. Do not add
 * friendlier aliases here: code that relied on them would break against the
 * real bridge, which is the drift this stub exists to avoid.
 */
function driveEntry(remotePath, stats) {
  return {
    path: normalizeRemotePath(remotePath),
    name: path.posix.basename(normalizeRemotePath(remotePath)),
    size: stats.isDirectory() ? 0 : stats.size,
    mod_time: stats.mtime.toISOString(),
    is_dir: stats.isDirectory()
  }
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

/**
 * Each handler returns the value that goes into `data`, or a `{ raw: ... }`
 * envelope when it needs to shape the whole response itself.
 */
const channels = {
  // --- constants the client asks for at boot ---------------------------------
  // Values copied from no source: they are the paths the bridge reports, and
  // the client turns them straight back into channel arguments.
  'get-fonts': () => ['Inter', 'Source Sans Pro', 'Arial'],
  'get-cache-dir': () => 'cache',
  'get-temp-dir': () => 'tmp',
  'get-storage-dir': () => 'drive/home',
  'os:homedir': () => 'drive/home',
  'os:tmpdir': () => 'tmp',

  // --- session --------------------------------------------------------------
  /**
   * One honest local user.
   *
   * This is the stub's only answer that is not a filesystem operation, and it
   * is deliberate: with no access token the client switches itself into guest
   * mode, answers every `fs:*` call locally without ever sending it, and the
   * stub is never reached. So the stub has to say who is using it.
   *
   * It is not a pretend cloud account. There is one user, the person at the
   * keyboard, and the session says so by name. It carries no subscription, no
   * plan and no entitlement, because there is no licence here: features that
   * need one must behave exactly as they do for a user without one. It also
   * carries no regional endpoints, so the client stores none.
   */
  'auth:get-session': () => ({
    authenticated: true,
    accessToken: 'local-stub-session',
    user: {
      id: 'local-stub',
      name: 'local-stub',
      displayName: 'Local stub user',
      region: ''
    }
  }),

  // --- preferences ----------------------------------------------------------
  /**
   * A key to JSON value store, per user. The bridge keeps it in its database
   * and there is nothing cloud about it, so the stub keeps the same store in
   * one file next to the drive. Same semantics, including the one that
   * matters: a key that was never set reads back as null, not as an error.
   *
   * Without this the editor still works, but it forgets every piece of UI
   * state between reloads, including the fact that you have already seen the
   * welcome tour.
   */
  'settings:get': async (args) => {
    const key = requireKey(args)
    const all = await readSettings()
    return key in all ? all[key] : null
  },

  'settings:set': async (args) => {
    const key = requireKey(args)
    if (args.length < 2) throw new StubError('value is required', 400)
    const all = await readSettings()
    all[key] = args[1] === undefined ? null : args[1]
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(all, null, 2))
    return true
  },

  // --- filesystem -----------------------------------------------------------
  /**
   * Returns the file as a string, and ignores the encoding argument, because
   * that is what the bridge does. Binary content therefore comes back through
   * a lossy UTF-8 decode; the client reads binary through `fs:serveAsset` or
   * `/api/ipc/invoke-binary` instead, and so should new code.
   */
  'fs:readFile': async (args) => {
    const data = await fs.readFile(localPath(requirePath(args)))
    return data.toString('utf8')
  },

  'fs:writeFile': async (args) => {
    const target = localPath(requirePath(args))
    const bytes = decodeWriteData(args[1], args[2])
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, bytes)
    return true
  },

  'fs:existsSync': async (args) => {
    const requested = args[0]
    if (typeof requested !== 'string' || requested === '') return false
    try {
      await fs.stat(localPath(requested))
      return true
    } catch {
      return false
    }
  },

  'fs:statSync': async (args) => {
    const requested = requirePath(args)
    const stats = await fs.stat(localPath(requested))
    return driveEntry(requested, stats)
  },

  'fs:readdir': async (args) => {
    const requested = args[0]
    const dir = localPath(typeof requested === 'string' ? requested : '')
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const base = normalizeRemotePath(typeof requested === 'string' ? requested : '')
    const items = []
    for (const entry of entries) {
      const childRemote = base ? `${base}/${entry.name}` : entry.name
      const stats = await fs.stat(path.join(dir, entry.name)).catch(() => null)
      if (!stats) continue
      items.push(driveEntry(childRemote, stats))
    }
    return items
  },

  'fs:mkdirSync': async (args) => {
    await fs.mkdir(localPath(requirePath(args)), { recursive: true })
    return true
  },

  /**
   * The bridge echoes the path back and opens nothing: there is no file handle
   * to hand across HTTP. Same here.
   */
  'fs:open': (args) => ({ path: requirePath(args) }),

  // No `force`: deleting something that is not there is an error, and saying
  // so is the point. `force` would answer true and teach the opposite.
  'fs:unlinkSync': async (args) => {
    await fs.rm(localPath(requirePath(args)), { recursive: true })
    return true
  },

  /** The bridge answers a move with `from` and `to` at the top level, and no
   * `data` key. Mirrored, quirk included. */
  'fs:move': async (args) => {
    const from = requirePath(args, 0)
    const to = requirePath(args, 1)
    if (from === to) {
      throw new StubError('source and destination paths must be different', 400)
    }
    const target = localPath(to)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.rename(localPath(from), target)
    return { raw: { ok: true, from, to } }
  },

  'fs:copy': async (args) => {
    const from = localPath(requirePath(args, 0))
    const to = localPath(requirePath(args, 1))
    await fs.mkdir(path.dirname(to), { recursive: true })
    await fs.cp(from, to, { recursive: true })
    return true
  },

  // --- drive ----------------------------------------------------------------
  /**
   * Two of the drive channels are the filesystem under another name. In the
   * bridge, `drive:list` calls the same listing function as `fs:readdir` and
   * returns the same entries, and `drive:get-root` is a constant. Only the
   * argument shape differs: a `{ path }` map instead of a bare string.
   * Implementing them is therefore the same honest local answer the filesystem
   * channels already give, and refusing them while answering `fs:readdir`
   * would have been the arbitrary choice.
   *
   * The rest of the drive channels stay refused. `drive:resolve-path` in
   * particular answers with a reference to a remote store, and there is no
   * remote here to point at.
   */
  'drive:get-root': () => '/',

  'drive:list': (args) => {
    const payload = args[0] && typeof args[0] === 'object' ? args[0] : {}
    return channels['fs:readdir']([payload.path ?? ''])
  },

  /** Streams the file with a content type, for the client's asset loader. */
  'fs:serveAsset': async (args, { response }) => {
    const target = localPath(requirePath(args))
    const stats = await fs.stat(target)
    if (stats.isDirectory()) {
      throw new StubError(refusal('fs:serveAsset was given a directory'), 400)
    }
    const type = MIME_TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream'
    response.writeHead(200, {
      ...corsHeaders(),
      'Content-Type': type,
      'Content-Length': String(stats.size)
    })
    await new Promise((resolve, reject) => {
      const stream = createReadStream(target)
      stream.on('error', reject)
      stream.on('end', resolve)
      stream.pipe(response)
    })
    return { handled: true }
  }
}

// Aliases, exactly as the bridge groups them in one case each.
channels['read-file'] = channels['fs:readFile']
channels['read-file-content'] = channels['fs:readFile']
channels['fs:writeFileSync'] = channels['fs:writeFile']
channels['fs:lstatSync'] = channels['fs:statSync']
channels['fs:readdirSync'] = channels['fs:readdir']
channels['read-dir'] = channels['fs:readdir']
channels['move-file'] = channels['fs:move']

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  }
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    ...corsHeaders(),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload)
  })
  response.end(payload)
}

/** The bridge's shape for a refusal: HTTP 400 and a bare `error` string. */
function sendRefusal(response, message, status = 400) {
  sendJson(response, status, { error: message })
}

async function readBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 512 * 1024 * 1024) throw new StubError('request body too large', 413)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function unsupportedChannel(channel) {
  if (UNIMPLEMENTED_EVERYWHERE.has(channel)) {
    return refusal(
      `channel "${channel}" is called by the client and implemented nowhere. ` +
        'Neither this stub nor the full Dynadoc bridge has a handler for it, so it ' +
        'fails the same way in production. This is a known client bug, not a limit of the stub.'
    )
  }
  return refusal(
    `channel "${channel}" is not implemented. The stub answers the filesystem channels ` +
      `against ${ROOT}, the boot path constants, the preference store and the two drive ` +
      'channels that are the filesystem under another name. Everything else needs the ' +
      'full Dynadoc bridge, which is not part of the open core client. The stub refuses ' +
      'rather than return an empty or successful answer it cannot stand behind. ' +
      'See tools/stub-bridge/README.md.'
  )
}

async function handleInvoke(request, response) {
  const body = await readBody(request)
  const contentType = String(request.headers['content-type'] || '')

  if (contentType.startsWith('multipart/form-data')) {
    sendRefusal(
      response,
      refusal(
        'multipart uploads are not implemented. They carry the drive upload channels, ' +
          'which need the full Dynadoc bridge.'
      )
    )
    return
  }

  let payload
  try {
    payload = JSON.parse(body.toString('utf8') || '{}')
  } catch {
    sendRefusal(response, 'invalid payload')
    return
  }

  const channel = String(payload?.channel || '').trim()
  if (!channel) {
    sendRefusal(response, 'channel is required')
    return
  }

  const handler = channels[channel]
  if (!handler) {
    console.error(`refused  ${channel}`)
    sendRefusal(response, unsupportedChannel(channel))
    return
  }

  const args = Array.isArray(payload.args) ? payload.args : []
  const injected = await injectedFailure(channel, args)
  if (injected) {
    sendJson(response, 200, { ok: true, data: injected.value })
    return
  }
  const result = await handler(args, { response })
  if (result && result.handled) return
  if (result && typeof result === 'object' && result.raw) {
    sendJson(response, 200, result.raw)
    return
  }
  sendJson(response, 200, { ok: true, data: result })
}

/**
 * The binary read. The bridge serves exactly one channel here and refuses the
 * rest, so this does the same.
 */
async function handleInvokeBinary(request, response) {
  const body = await readBody(request)
  let payload
  try {
    payload = JSON.parse(body.toString('utf8') || '{}')
  } catch {
    sendRefusal(response, 'invalid payload')
    return
  }
  const channel = String(payload?.channel || '').trim()
  if (!['read-file', 'read-file-content', 'fs:readFile'].includes(channel)) {
    sendRefusal(response, refusal(`unsupported binary channel: ${channel}`))
    return
  }
  const args = Array.isArray(payload.args) ? payload.args : []
  // The asset read is the one that failed in production, so it is injectable
  // too. A `deny` here would have to answer an empty body, which is a document
  // the client cannot tell from a real one, so only `refuse` is honoured.
  const injected = await injectedFailure(channel, args)
  if (injected) {
    sendRefusal(response, refusal(`${channel} cannot answer a denial on the binary route`))
    return
  }
  const data = await fs.readFile(localPath(requirePath(args)))
  response.writeHead(200, {
    ...corsHeaders(),
    'Content-Type': 'application/octet-stream',
    'Content-Length': String(data.length)
  })
  response.end(data)
}

const routes = {
  'POST /api/ipc/invoke': handleInvoke,
  'POST /api/ipc/invoke-binary': handleInvokeBinary,
  /**
   * Fire and forget. The bridge accepts any channel here and does nothing with
   * it, so the stub does nothing too, and logs the channel so a contributor can
   * see what the client is sending.
   */
  'POST /api/ipc/send': async (request, response) => {
    const body = await readBody(request)
    let channel = ''
    try {
      channel = String(JSON.parse(body.toString('utf8') || '{}')?.channel || '')
    } catch {
      sendRefusal(response, 'invalid payload')
      return
    }
    if (channel) console.error(`send     ${channel} (no-op, as in the full bridge)`)
    sendJson(response, 200, { ok: true })
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${HOST}:${PORT}`)
  const key = `${request.method} ${url.pathname}`

  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders())
    response.end()
    return
  }

  const route = routes[key]
  if (!route) {
    console.error(`refused  ${key}`)
    sendRefusal(
      response,
      refusal(
        `${key} is not implemented. The stub serves /api/ipc/invoke, ` +
          '/api/ipc/invoke-binary and /api/ipc/send. Uploads, conversion, sharing, ' +
          'collaboration and file watching need the full Dynadoc bridge.'
      ),
      404
    )
    return
  }

  route(request, response).catch((error) => {
    if (error instanceof StubError) {
      sendRefusal(response, error.message, error.status)
      return
    }
    // A failing filesystem call is a real answer, not a stub limitation: pass
    // the reason through so the client can show it.
    const reason = error?.message || 'filesystem call failed'
    console.error(`failed   ${key} ${reason}`)
    sendRefusal(response, reason)
  })
})

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const WELCOME = `<h1>Welcome to the Dynadoc local stub</h1>
<p>This document lives on your own disk, under the stub root printed by the
stub bridge when it starts. Edit it, save it, and look at the file: the change
is there.</p>
<p>The stub answers the filesystem channels only. Anything that needs the full
Dynadoc bridge, such as sharing, collaboration, sealing or conversion, refuses
by name and says so in the stub's own log. That is on purpose: a stub that
pretended to seal a document would teach you a behaviour the product does not
have.</p>
`

async function seed() {
  for (const dir of ['home', 'tmp', 'cache', 'public-temp']) {
    await fs.mkdir(path.join(ROOT, dir), { recursive: true })
  }
  const welcome = path.join(ROOT, 'home', 'Welcome.html')
  try {
    await fs.access(welcome)
  } catch {
    await fs.writeFile(welcome, WELCOME)
  }
}

await seed()

server.listen(PORT, HOST, async () => {
  console.error(`Dynadoc local stub bridge`)
  console.error(`  listening on   http://${DISPLAY_HOST}:${PORT}`)
  console.error(`  drive root     ${ROOT}`)
  const rules = await loadFailureRules()
  console.error(
    `  failure rules  ${rules.length} active, from ${FAILURE_FILE} and DYNADOC_STUB_FAIL`
  )
  console.error(``)
  console.error(`  No token is verified and no permission is enforced. This is a`)
  console.error(`  development tool bound to the loopback interface. Do not expose it.`)
  console.error(``)
  console.error(`  Start the web client against it with:`)
  console.error(`    npm run dev:web:stub`)
  console.error(``)
  console.error(`  Refused channels are logged below, by name.`)
})
