# Architecture

> Dense reference document. New to the codebase? Start with [ONBOARDING.md](ONBOARDING.md), then come back here.

## System Overview

Dynadoc is a cross-platform document application built on Electron with three isolated processes communicating via IPC.

```
┌──────────────────────────────────────────────────────────────┐
│                     Dynadoc Desktop App                      │
│                                                              │
│  ┌──────────┐    ┌────────────┐    ┌───────────────────────┐ │
│  │   Main   │    │  Preload   │    │      Renderer         │ │
│  │ Process  │◄──►│   (IPC)    │◄──►│     (Svelte 5)        │ │
│  │          │    │            │    │                       │ │
│  │ Node.js  │    │ contextBr- │    │ Tiptap 3 (rich text)  │ │
│  │ FS, OS   │    │ idge API   │    │ Monaco (code editor)  │ │
│  │ spawn()  │    │ surface    │    │ Fortune-Sheet (calc)  │ │
│  │ node-pty │    │            │    │ Konva.js (design)     │ │
│  └────┬─────┘    └────────────┘    │ Slides (presentations)│ │
│       │                            │                       │ │
│       │ spawn (stdin/stdout JSON)  │ 51 Svelte stores      │ │
│       │                            │ 17+ Tiptap extensions │ │
│       ▼                            └───────────────────────┘ │
│  ┌─────────────────────┐                                     │
│  │ frontend-middleware  │  Go CLI binary                      │
│  │ (from api-bridge)   │  Bridges Electron ↔ Backend API     │
│  └──────────┬──────────┘                                     │
└─────────────┼────────────────────────────────────────────────┘
              │ HTTP REST + Bearer JWT
              ▼
┌──────────────────────────────────────────────────────────────┐
│  API bridge (separate, proprietary)                          │
│  Go + Echo + PostgreSQL                                      │
│  Auth, License, Billing, Sync, Versioning, Share, Chat,      │
│  Dify AI, Jitsi, Mattermost, Grammar, Sddoc, Forms          │
└──────────────────────────────────────────────────────────────┘
```

## Three Electron Processes

### Main Process (`src/main/index.ts`)

The main process has full Node.js access:
- **File system**: Read/write `.ddoc` and `.sddoc` files
- **Child processes**: Spawns the Go middleware binary
- **Terminal**: Integrated terminal via `node-pty`
- **IPC handlers**: Bridges renderer requests to system operations
- **App lifecycle**: Window management, auto-update, deep links (`dynadoc://`)

### Preload (`src/preload/index.ts`)

The preload script is the security boundary:
- Exposes a **minimal API surface** via `contextBridge.exposeInMainWorld()`
- The renderer can only call functions explicitly exposed here
- Handles: file operations, clipboard, terminal, auth, settings
- No direct `require()` or Node.js access leaks to the renderer

### Renderer (`src/renderer/`)

The renderer is a Svelte 5 application:
- **No direct system access** — everything goes through the preload bridge
- **51 Svelte stores** manage application state
- **17+ custom Tiptap extensions** power the rich text editor
- **Runes mode** (Svelte 5) for reactive state management

## Editor Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Main.svelte                          │
│                  App Shell (1,137 LOC)                  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Tab System                          │   │
│  │  Each tab is a container holding one or more:    │   │
│  │                                                  │   │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────────────┐  │   │
│  │  │  Rich   │ │  Spread- │ │  Slides /        │  │   │
│  │  │  Text   │ │  sheet   │ │  Presentations   │  │   │
│  │  │ (Tiptap)│ │(Fortune) │ │                  │  │   │
│  │  └─────────┘ └──────────┘ └──────────────────┘  │   │
│  │                                                  │   │
│  │  ┌─────────┐ ┌──────────┐                        │   │
│  │  │  Code   │ │  Design  │                        │   │
│  │  │(Monaco) │ │ (Konva)  │                        │   │
│  │  └─────────┘ └──────────┘                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Tiptap Extension System              │   │
│  │                                                  │   │
│  │  CustomAIExtension       — AI content generation │   │
│  │  CustomSlideExtension    — Slide management      │   │
│  │  CustomSpreadsheet       — Embedded spreadsheets │   │
│  │  CustomTranslation       — Side-by-side translate│   │
│  │  CustomVarExtension      — Dynamic variables     │   │
│  │  CustomFormField         — Interactive forms      │   │
│  │  CustomReviewExtension   — Track changes         │   │
│  │  + 10 more extensions                            │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## State Management

State is managed through **51 Svelte stores** in `src/renderer/src/stores/`:

Key stores include:
- `editor.store.ts` — Active editor instance, document state
- `tabs.store.ts` — Multi-tab management
- `theme.store.ts` — Dark/light/custom themes
- `collab.store.ts` — Real-time collaboration state
- `auth.store.ts` — Authentication and user session
- `license.store.ts` — License entitlement state
- `ai.store.ts` — AI integration state
- `upgradePlanModal.store.ts` — Plan upgrade flow

## Collaboration Architecture

```
User A (Electron)          User B (Electron)
       │                          │
       ▼                          ▼
  Yjs Document              Yjs Document
  (local CRDT)              (local CRDT)
       │                          │
       └─────────┐    ┌──────────┘
                 ▼    ▼
            ┌──────────────┐
            │  Hocuspocus   │
            │  WebSocket    │
            │  Server       │
            └──────────────┘
                   │
              y-indexeddb
           (offline persistence)
```

- **Yjs 13**: CRDT-based conflict-free real-time editing
- **Hocuspocus**: WebSocket server for Yjs sync
- **y-indexeddb**: Offline persistence, auto-syncs on reconnect
- **Auth**: Collaboration tokens issued by `POST /api/collab/token`

## File Format

### `.ddoc` (Standard Document)

A `.ddoc` file is a container format that can hold multiple content types:
- Rich text (Tiptap/ProseMirror JSON)
- Spreadsheet data (Fortune-Sheet format)
- Slide decks (custom slide format)
- Design canvas (Konva JSON)
- Embedded images, charts, and media

### `.sddoc` (Secure Document)

An encrypted variant using:
- AES-256-GCM for content encryption
- RSA-2048 for key wrapping
- Requires a valid Pro/Enterprise license

## Go Middleware Bridge

The Electron main process spawns a Go binary (`frontend-middleware`) that acts as a local proxy to the backend API:

```
Electron Main Process
       │
       │ spawn("./frontend-middleware")
       │
       ▼
  ┌──────────────────────┐
  │  Go CLI Binary       │
  │                      │
  │  stdin  ← JSON cmd   │
  │  stdout → JSON resp  │
  │                      │
  │  Handles:            │
  │  - Auth token mgmt   │
  │  - API calls          │
  │  - File sync          │
  │  - AI proxy           │
  │  - Encryption ops     │
  └──────────┬───────────┘
             │
        HTTP REST
             │
             ▼
     Backend API (:7070)
```

Communication is via JSON messages over stdin/stdout. The middleware handles authentication state, token refresh, and request routing.

## Platform Targets

| Platform | Technology | Entry Point |
|---|---|---|
| macOS | Electron 40 | `electron-builder.yml` (DMG) |
| Windows | Electron 40 | `electron-builder.yml` (NSIS) |
| Linux | Electron 40 | `electron-builder.yml` (AppImage, snap, deb) |
| iOS | Capacitor 8 | `ios/` + `capacitor.config.ts` |
| Android | Capacitor 8 | `android/` + `capacitor.config.ts` |
| Web | Vite SPA | `web/` target |
