# Onboarding

A guided tour of the codebase. Read this before [`architecture.md`](architecture.md).

## Stack

Electron 40 + Svelte 5 (runes) + TypeScript + Tiptap 3 + Yjs.

Renderer also embeds React 19 for Fluent UI 9 and `@assistant-ui` chat. Spreadsheet uses Fortune-Sheet + HyperFormula. Design canvas uses Konva. Code editor is Monaco.

## Commands

```bash
npm run dev          # Electron + hot reload
npm run typecheck    # TS + Svelte
npm run lint         # ESLint --fix
npm run ci:check     # cycles + typecheck
pkill -f Electron; pkill -f vite; lsof -ti:8081 | xargs kill -9   # kill stale
```

`typecheck` reports pre-existing errors in `src/main/index.ts`. Ignore them unless your task touches that file — they're tracked separately.

## Boot trace

```
npm run dev
  → Electron spawn
    → src/main/index.ts             main process (Node, OS access)
      → src/preload/index.ts        contextBridge surface
        → src/renderer/index.html
          → src/renderer/src/main.ts
            → App.svelte
              → Main.svelte         shell, ~1200 LOC
                → DocumentEditor.svelte
```

**Main** — file system, windows, IPC handlers, spawns the Go middleware. Monolithic by design (~6000 LOC).

**Preload** — four scripts compiled separately (`index.ts`, `browser.ts`, `webview-var.ts`, `embedded-var.ts`). All use `contextBridge.exposeInMainWorld`. Only path for renderer → Node.

**Renderer** — Svelte 5 with runes (`$state`, `$derived`, `$effect`). Where you'll work most of the time.

## Renderer layout

| Path | Contents |
|------|----------|
| `components/app/ribbon/` | Top toolbar (Home, Insert, Review, …) |
| `components/app/editor/` | Editor wrappers (wysiwyg, code, slides, …) |
| `components/sideBar/` | Left sidebar (explorer, search, version control) |
| `components/titleBar/` | Title bar, command palette |
| `extensions/tiptap/` | 17+ custom editor extensions |
| `stores/` | 50+ Svelte stores (global state) |
| `services/` | API calls, export, collab |
| `lib/api/` | HTTP clients per domain |

## Editor

Tiptap 3 (ProseMirror). Each feature is an extension under `extensions/tiptap/`:

```
CustomVarExtension/          variables (@)
CustomDynamicReferenceNodeExtension/   refs (#)
CustomSpreadsheetExtension/  Fortune-Sheet
CustomSlideExtension/        slides
CustomAIExtension/           in-editor AI
CustomReviewExtension/       track changes
CustomTranslationExtension/  side-by-side translation
... 17+ total
```

Heavy extensions load via `EditorExtensionHelpers.getHeavyWysiwygExtensions()`.

## Feature flags

A feature-flag system is being reintroduced. Until it lands, the current pattern is to read `featuresStore` directly — see `components/titleBar/AuthMenu.svelte` for an example. Ask a maintainer before adding new flag-gated code.

## Stores

Live in `src/renderer/src/stores/`. Conventions:

- Shared reactive variables use `_$_` prefix (e.g. `_$_documentEditorsList`)
- Persist UI prefs via `createUiPersistedStore()` from `stores/uiPersistence.ts`
- Never use `svelte-persisted-store` directly

## Document format

Stored as `<workspace-uuid>/<name>/index.html`. Legacy flat `<name>.html` resolved by fallback scanner in `common.utils.ts`.

## IPC

Constants shared between main and renderer in `src/renderer/src/shared/ipc.ts`. Handlers in `src/main/index.ts` (`ipcMain.handle`).

## API calls

```typescript
import { resolveApiBaseUrl } from '$lib/api/shared/baseUrl'

const res = await fetch(`${resolveApiBaseUrl()}/endpoint`, {
  headers: { Authorization: `Bearer ${localStorage.getItem('ddoc.access_token')}` }
})
```

No centralized fetch wrapper. Services call `fetch()` directly with this pattern.

## Debugging

- **Renderer** — `Cmd+Option+I` / `Ctrl+Shift+I` opens DevTools.
- **Main** — logs print to the terminal running `npm run dev`.
- **IPC silent failure** — find the channel in `shared/ipc.ts`, then `ipcMain.handle('<channel>', ...)` in `src/main/index.ts`.

## Next

- [`FIRST_TICKET.md`](FIRST_TICKET.md) — end-to-end walkthrough of a typical task
- [`GLOSSARY.md`](GLOSSARY.md) — project-specific terms
- [`architecture.md`](architecture.md) — deeper system model
