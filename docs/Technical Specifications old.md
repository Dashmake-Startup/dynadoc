# ddoc Office — Technical Specifications (Desktop & Web via Electron)

## 1) Overview
- **Product**: ddoc Office — a unified document system with dual editors (WYSIWYG & CODE) and collaboration.
- **Targets**: Desktop (Electron for macOS/Windows/Linux) and Web (Electron-built web target + SPA).
- **File Types**:
  - **.xddoc** — container “document” (folders + files + metadata).
  - **.sddoc** — secure ddoc variant with encryption & granular protection.

## 2) Architecture
- **Frontend**: Electron (Chromium), SPA framework (Svelte), Tiptap WYSIWYG engine, Monaco-like CODE editor.
- **Backend (local-first)**:
  - Embedded Node services (Electron main) + local IndexedDB/SQLite (via WASM on Web).
  - Optional sync via realtime service (WebSocket/WebRTC).
- **Data Model**:
  - Internal **virtual FS** stored inside a single `.xddoc`/`.sddoc` archive (zip-like with manifest).
  - **Manifest** (JSON): tree, metadata, permissions, versions, references, layers, forms, templates.

## 3) Navigation & UI
- **Left Sidebar**: VSCode-like *Explorer*
  - Detect/list all folders & files; full tree navigation; drag & drop; context menu.
- **Bottom Bar**: *Translation Tabs*
  - Excel-like tabs per language file; quick add/rename/reorder; keyboard navigation.
- **Top Actions**: Page icons/shortcuts
  - Quick orientation (portrait/landscape), background toggle, page/section type switch.
- **View Modes**: *Edit* ↔ *View* instant toggle (e.g., Popline-style inline controls).
- **Terminal Panel**: Integrated shell (like VSCode) with task runner.

## 4) Document Semantics
- **Multi-Type Pages/Sections/Spans**:
  - Switch type: **document / presentation / image / text(code) / excel** (per page/section/word).
- **Layer System**:
  - Photoshop-like stacking (z-order), lock/visibility, grouping, blend modes (MVP: normal/opacity).
- **References Manager**:
  - Citations/refs for images/tables/figures; auto numbering, cross-links, bibliography export.
- **Form Elements**:
  - Place textfields, checkboxes, radios, buttons inline anywhere; validation & data binding.
  - **Send forms directly from within the .xddoc** (Forms can be submitted inside `.xddoc` without separate attachments).

## 5) Editors
- **WYSIWYG**: rich text, images, tables, comments, track changes, revision history (CKEditor-class).
- **CODE**: developer mode (Monaco-class) with syntax highlight, LSP hooks, diff/merge.
- **Two Synchronized Modes**:
  - Single source model; live round-trip mapping WYSIWYG ↔ CODE.
- **Shortcuts (customizable)**:
  - e.g., `Ctrl+Shift+I` → italic; profiles per user/workspace.

## 6) Collaboration
- **Realtime**: multi-user cursor, selection, comments, chat panel.
- **Version Control**:
  - Per-file and per-section history; snapshot & diff across versions; restore.
  - Git-bridge (optional) for external repos.
- **Presence & Chat**:
  - Real-time In-document chat channels with mentions, file/section threading.

## 7) Security & Protection
- **.sddoc** end-to-end encryption (AES-256-GCM; PBKDF2/Argon2 key derivation).
- **Granular Protection/Blur** scopes:
  - Whole document / folder / file / page / section / paragraph / word / character.
- **Access Controls**:
  - Password protection, 2FA (TOTP/WebAuthn), role-based permissions, share links with expiry.
- **Redaction/Blur**:
  - Render-time masking for protected scopes; no plaintext in export unless permitted.

## 8) Import/Export & Formats
- **Read/Embed (RO unless noted)**:
  - Word (.docx), Excel (.xlsx), PowerPoint (.pptx), PDF (RO), Images (PNG/JPG/SVG), PSD (RO), common 3D/Video/Binary (RO).
- **Exports**:
  - **PDF (non-editable)** via **JPG→PDF** rasterization method for copy-protection.
  - HTML bundle, DOCX/PPTX/XLSX (templated), Plain Text/Markdown (where applicable).
- **Templating**:
  - Word/PPT templates; mail-merge/data-binding; reusable style kits.

## 9) Translation & Localization
- **Bottom Translation Tabs** per locale; TM (translation memory) & glossary hooks.
- Inline side-by-side or tabbed editing; key-value and rich segment support.

## 10) Advanced Features
- **OCR**: Image→Text (on-device WASM + optional native engine); attach source image trace.
- **LaTeX**: inline/block rendering; math editor; export fidelity preserved.
- **Forms Workflow**: collect responses inside `.xddoc`; summary pages; CSV/JSON export.

## 11) Extensibility & Theming
- **Add-ons/Plugins**:
  - VSCode-like marketplace flow; permissions manifest; sandboxed execution.
- **Themes**:
  - Easy install; UX palettes (light/dark/high-contrast); per-project theme binding.

## 12) Performance & Offline
- **Local-first** with conflict-free merges (CRDT/OT).
- Incremental saving; background indexing; lazy-load large assets.
- Full offline editing; seamless sync on reconnect.

## 13) Non-Functional
- **Accessibility**: WCAG 2.2 AA; keyboard-first; screen reader support.
- **Internationalization**: full i18n & RTL; date/number locales.
- **Telemetry (opt-in)**: privacy-first metrics; no content logging.

## 14) Compliance & Governance
- Audit trails for revisions/access; exportable logs (JSON/CSV).
- Configurable data retention; per-space encryption policies.

## 15) Key Dependencies (indicative)
- Electron, Monaco-like editor, WYSIWYG engine (CKEditor-class), WebRTC/WebSocket, crypto libs, OCR (WASM native), ZIP/FS abstraction, PDF rasterizer, LaTeX renderer, LSP.

---
**MVP Priorities**: Navigation (left tree + translation tabs) • WYSIWYG/CODE sync • Versioning • Chat & comments • .ddoc container • PDF (JPG→PDF) export • OCR • Granular protection • Plugins • Themes.
