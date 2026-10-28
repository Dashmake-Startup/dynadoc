# Glossary

Project-specific terms. For framework terminology (Electron, Svelte, TypeScript) see official docs.

## File formats

**`.ddoc`** — Dynadoc document. HTML-based, stored at `<workspace-uuid>/<name>/index.html`. Holds text, slides, spreadsheets, embedded files in a single file.

**`.sddoc`** — encrypted `.ddoc` (AES-256-GCM). For documents with access restrictions.

**workspace** — UUID directory containing one or more documents. Path: `<workspace-uuid>/<name>/index.html`. Legacy flat `<name>.html` is resolved by a fallback scanner in `common.utils.ts`.

## Editor

**extension** — custom Tiptap extension adding a node type or behavior. 17+ live in `src/renderer/src/extensions/tiptap/`. Each has its own folder.

**node** — Tiptap/ProseMirror primitive (paragraph, heading, spreadsheet, slide, variable…). Extensions define custom nodes.

**ribbon** — top toolbar with tabs (Home, Insert, Review…). Components in `src/renderer/src/components/app/ribbon/`.

**bubble menu** — floating context menu on text selection. `components/app/editor/components/formatting/BubbleMenu.svelte`.

## Features

**var / variable** — dynamic reusable content. Defined once, synced wherever referenced. Extension: `CustomVarExtension`. Inserted with `@`.

**ref / reference** — pointer to a document or to a variable in another document. Extension: `CustomDynamicReferenceNodeExtension`. Inserted with `#`.

**feature flag** — toggle for a feature. The flag system is being reintroduced. Until it lands, gate features by reading `featuresStore` directly (see `components/titleBar/AuthMenu.svelte` for the current pattern). Ask a maintainer before adding new flag-gated code.

## Architecture

**main process** — Electron's Node.js process. FS access, OS APIs, child process spawning. Code: `src/main/index.ts` (~6000 LOC, monolithic).

**renderer** — Electron's UI process (Chrome). Runs Svelte 5. No direct Node access — goes through preload.

**preload** — privileged script exposing a safe API to the renderer via `contextBridge`. Four files: `src/preload/index.ts`, `browser.ts`, `webview-var.ts`, `embedded-var.ts`.

**IPC** — Inter-Process Communication. Channel between renderer and main. Constants: `src/renderer/src/shared/ipc.ts`. Handlers: `ipcMain.handle` in `src/main/index.ts`.

**middleware** — Go binary (`frontend-middleware`) bridging Electron and the backend API. Spawned by the main process via stdin/stdout JSON.

**manager** — main process class encapsulating one responsibility: `TabManager`, `EmbeddedViewManager`, `SpreadsheetManager`.

## State

**`_$_`** — convention prefix for Svelte 5 shared reactive variables (e.g. `_$_documentEditorsList`). Not a Svelte standard — project-specific.

**`createUiPersistedStore()`** — helper to persist a UI preference across reloads. In `stores/uiPersistence.ts`. Don't use `svelte-persisted-store` directly.

## Collaboration

**Yjs** — CRDT library for realtime sync. Each document has a `Y.Doc`. Multi-user edits merge automatically.

**y-websocket / Hocuspocus** — embedded WebSocket server syncing `Y.Doc` instances between clients. The main process hosts this locally.

## Misc

**`resolveApiBaseUrl()`** — returns the backend base URL. Resolution order: runtime override (`window.__DYNADOC_API_BASE__`) → `VITE_API_URL` env var → `window.location.origin` (web target) → hardcoded prod fallback. Always use this. Never hardcode URLs.

**`ddoc.access_token`** — localStorage key for the JWT. Read with `localStorage.getItem('ddoc.access_token')`.
