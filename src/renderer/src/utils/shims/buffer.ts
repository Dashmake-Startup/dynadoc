// Installs the `Buffer` global on the desktop renderer, the way shims/process.ts
// installs `process`.
//
// Why it is needed: around eleven renderer modules call `Buffer.from`/`concat`/
// `alloc` at runtime, and so do several bundled dependencies. On the desktop
// that global comes from `nodeIntegration: true`. Under contextIsolation the
// renderer has no Node globals at all, and the first of those calls -- during
// store hydration, well before anything is on screen -- aborts the boot with
// `ReferenceError: Buffer is not defined`.
//
// This module is injected into the renderer entry by the desktop build alone
// (see the ddoc-desktop-buffer-global plugin in electron.vite.config.ts), so it
// never enters the web or mobile graphs. Those two already install the same
// global from lib/api/web/node.ts when their driver loads, and nothing here
// touches their configs, so what they ship does not move.
//
// The `!anyWindow.Buffer` check is what keeps today's desktop behaviour
// identical: with nodeIntegration the real Node `Buffer` is already present, so
// nothing is replaced. The polyfill only ever appears where there was none.
//
// It is not a drop-in equal of Node's Buffer. Every other encoding -- utf8,
// base64, hex, latin1, binary, ascii, ucs2, utf16le -- is byte-identical in
// both directions, and so is memory sharing: `from(arrayBuffer)` shares and
// `from(uint8Array)` copies on both. Two differences matter:
//   - `base64url` is unknown to buffer@6 and throws BOTH ways: on
//     `Buffer.from(s, 'base64url')` and on `buf.toString('base64url')`. Four
//     sites, all in SecurityHelpers: encryptName/decryptName (no callers) and
//     encryptNameToSafe/decryptNameFromSafe, which ARE called -- by
//     encrypt/decryptDirectoryRecursiveStream, whose `encryptNames` parameter
//     defaults to `true`, from Utils.saveEncryptedDdoc/loadEncryptedSddoc1.
//     `crypto` does not shield them: the base64url decode runs before the
//     first `crypto` call. What makes this latent rather than live is only
//     that those two Utils methods have no callers yet -- the encrypted
//     .sddoc path is not wired up. Wiring it up under contextIsolation
//     breaks encrypted save and load, so this is a prerequisite, not a note.
//   - `Buffer.isBuffer()` is false across realms, so a real Node Buffer handed
//     over by the preload is not recognised as one. This one is reachable:
//     `toBuffer` in ReactSpreadsheetFileViewer tests it, with no `crypto` in
//     sight. It is harmless only because the next branch catches the value as
//     a `Uint8Array` and copies it; reorder those branches and it bites.
// Both belong to SPEC-001 Block A, which is where `crypto` is dealt with.

import { Buffer } from 'buffer'

if (typeof window !== 'undefined') {
  const globals = window as unknown as { Buffer?: typeof Buffer }
  if (!globals.Buffer) {
    globals.Buffer = Buffer
  }
}
