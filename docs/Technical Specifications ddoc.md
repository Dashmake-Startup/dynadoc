# ddoc office - The secure, reusable, dynamic document editor — Technical Specifications (Desktop & Web via Electron)

## 1) Overview
- **Product**: ddoc office (Dynamic Document Office) — a unified dynamic document system with dual editors (WYSIWYG & CODE) and collaboration. “Dynamic documents where content is reusable, updatable, and secure.”
- **Targets**: Desktop (Electron for macOS/Windows/Linux) and Web (Electron-built SPA).
- **File Types**:
  - **.xddoc** — *XHTML Dynamic Document* (default, free, open format). Container “document” (folders + files + metadata).
  - **.sddoc** — *Secured XHTML Encrypted Dynamic Document* (paid subscription, encrypted). Secure xddoc variant with encryption & granular protection.
- **Open source** - ddoc-office desktop (and web) is free and open source. .xddoc is also fully open source. The only difference between .xddoc and .sddoc is the encryption of all files content and files name in an .sddoc. (Think later if the folder structure should be the same or not)
-  **Closed source** - All ddoc-office backend, api bridge, on-prem server.... are close source

## 2) Domains
- **Official (primary)**:
  - [ddoc-office.com](https://ddoc-office.com) — commercial official
  - [ddoc-office.org](https://ddoc-office.org) — non-profit official
- **Additional**:
  - [ddocoffice.com](https://ddocoffice.com)
  - [d-doc-office.com](https://d-doc-office.com)

## 3) Architecture
- **Frontend**: Electron (Chromium), SPA framework (Svelte), Tiptap WYSIWYG engine, Monaco CODE editor.
- **Backend (local-first)**:
  - Embedded Node services (Electron main) + local IndexedDB/SQLite (via WASM on Web).
  - Optional sync via realtime service (WebSocket/WebRTC).
- **File Container**:
  - `.xddoc` / `.sddoc` are **zip-like archives** with manifest (`meta.json`) + XHTML/html documents + assets.
- **Data Model**:
  - Internal **virtual FS** stored inside a single `.xddoc`/`.sddoc` archive (zip-like with manifest).
  - **Manifest** (JSON): tree, metadata, permissions, versions, references, layers, forms, templates.
  - **Structure** example:
    ```
Document structure
.xddoc
.sddoc

Advanced:

test.xddoc
  - assets/
    - img/
    - videos/
    - docs/
    - audios/
    - others/
  - custom-user-folder/
    - custom-user-child-folder/
      - user-child-test.html
      - user-child-test.fr.json // For translation
      - another-child-user-test.html
    - user-test.html
    - user-test.fr.json // For translation
    - another-user-test.html
  - custom-user-folder-2/
    - user-test-2.html
    - user-test-2.fr.json // For translation
    - another-user-test-2.html
  - test.html
  - test.fr.json // For translation
  - test.en-US.json // For translation
  - another-test.html
  - meta.json

Simple:

    test.xddoc
    ├── assets/
    │   ├── img/
    │   ├── videos/
    │   ├── docs/
    │   ├── audios/
    │   └── others/
    ├── test.html
    ├── another-test.html
    └── meta.json
    ```

## 4) Navigation & UI
- **Left Sidebar**: VSCode-like *Explorer*
  - Detect/list all folders & files; full tree navigation; drag & drop; context menu.
- **Bottom Bar**: *Translation Tabs*
  - Excel-like tabs per language file; quick add/rename/reorder; keyboard navigation.
- **Top Actions**: Page icons/shortcuts
  - Quick orientation (portrait/landscape), background toggle, page/section type switch.
- **View Modes**: *Edit* ↔ *View* instant toggle (e.g., Popline-style inline controls).
- **Terminal Panel**: Integrated shell (like VSCode) with task runner.

## 5) Document Semantics
- **Multi-Type Pages/Sections/Spans**:
  - Switch type: **document / presentation / image / text(code) / excel** (per page/section/word).
- **In-Document Variables**:
  - Create variables (placeholders) for words, phrases, sections.
  - Updating a variable auto-updates all instances in the document.
  - Variables can be scoped per document or per file.
- **In-Document File Includes**:
  - Reduces duplication by reusing shared files/sections across multiple `.xddoc` pages.
- **Layer System**:
  - Photoshop-like stacking (z-order), lock/visibility, grouping, blend modes (MVP: normal/opacity).
- **References Manager**:
  - Citations/refs for images/tables/figures; auto numbering, cross-links, bibliography export.
- **Form Elements**:
  - Place textfields, checkboxes, radios, buttons inline anywhere; validation & data binding.
  - **Send forms directly from within the .xddoc** (Forms can be submitted inside `.xddoc` without separate attachments).
  - **In-Document Variables**:
  - Create variables (placeholders) for words, phrases, sections.
  - Updating a variable auto-updates all instances in the document.
  - Variables can be scoped per document or per file.
- **In-Document File Includes**:
  - Allow inclusion/append of other file contents (HTML/Markdown/text) into the active document.
  - Reduces duplication by reusing shared files/sections across multiple `.xddoc` pages.



## 6) Editors
- **WYSIWYG**: rich text, images, tables, comments, track changes, revision history (yjs/CKEditor-class).
- **CODE**: developer mode (Monaco-class) with syntax highlight, LSP hooks, diff/merge.
- **Two Synchronized Modes**:
  - Single source model; live round-trip mapping WYSIWYG ↔ CODE.
- **Shortcuts (customizable)**:
  - e.g., `Ctrl+Shift+I` → italic; profiles per user/workspace.

## 7) Collaboration
- **Realtime Multi-user**: multi-user cursor, selection, comments, chat panel, mentions.
- **Version Control**:
  - Per-file and per-section history; snapshot & diff across versions; restore.
  - Git-bridge (optional) for external repos.
- **Chat & Presence**:
  - Real-time In-document chat channels with mentions, file/section threading.

## 8) Security & Protection
- **.sddoc Encryption**: end-to-end encryption (AES-256-GCM; PBKDF2/Argon2 key derivation).
- **Granular Protection/Blur** scopes:
  - Whole document / folder / file / page / section / paragraph / word / character.
- **Access Controls**:
  - Password protection, 2FA (TOTP/WebAuthn), role-based permissions, share links with expiry.
- **Redaction/Blur**:
  - Render-time masking for protected scopes; no plaintext in export unless permitted.

## 9) Import/Export & Formats
  - Word (.docx), Excel (.xlsx), PowerPoint (.pptx), PDF (RO), Images (PNG/JPG/SVG), PSD (RO), common 3D/Video/Binary (RO).
- **Exports**:
  - **PDF (non-editable)** via **JPG→PDF** rasterization method for copy-protection.
  - HTML bundle, DOCX/PPTX/XLSX (templated), Plain Text/Markdown (where applicable).
- **Templating**:
  - Word/PPT templates; mail-merge/data-binding; reusable style kits.

## 10) Translation & Localization
- **Bottom Translation Tabs** per locale; TM (translation memory) & glossary hooks.
- Inline side-by-side or tabbed editing; key-value and rich segment support.

## 11) Advanced Features
- **OCR**: Image→Text (on-device WASM + optional native engine); attach source image trace.
- **LaTeX**: inline/block rendering; math editor; export fidelity preserved.
- **Forms Workflow**: collect responses inside `.xddoc`; summary pages; CSV/JSON export.

## 12) Extensibility & Theming
- **Add-ons/Plugins**:
  - VSCode-like marketplace flow; permissions manifest; sandboxed execution.
- **Themes**:
  - Easy install; UX palettes (light/dark/high-contrast); per-project theme binding.

## 13) Performance & Offline
- **Local-first**: with conflict-free merges (CRDT/OT).
- **Offline Editing**: full offline editing; Auto-sync when reconnected.
- **Incremental Save**: incremental saving; background indexing; lazy-load large assets.

## 14) Non-Functional
- **Accessibility**: WCAG 2.2 AA; keyboard-first; screen reader support.
- **Internationalization**: full i18n & RTL; date/number locales.
- **Telemetry**: Opt-in, privacy-first (no content logging).

## 15) Compliance & Governance
- Audit trails for revisions/access; exportable logs (JSON/CSV).
- Configurable data retention; per-space encryption policies.

## 16) Key Dependencies & Packages
- **Frameworks**: Electron, Svelte (or React).
- **Editors**: CKEditor 5 (WYSIWYG), Monaco Editor (CODE).
- **Collaboration**: Yjs/Automerge (CRDT), WebRTC/WebSocket for sync.
- **Security**: Node crypto, WebCrypto API, Argon2id/PBKDF2 libs.
- **OCR**: Tesseract.js (WASM OCR).
- **PDF/Export**: pdf-lib, html-to-image, sharp (image rasterization).
- **Zip Container**: yauzl & yazl for `.xddoc` / `.sddoc`.
- **Terminal**: xterm.js.
- **Theming & Plugins**: VSCode-like plugin loader, postcss/tailwind for themes.

---
**MVP Priorities**:
- `.xddoc` container & file system
- **In-document variables & includes system**
- Navigation (left tree + translation tabs)
- WYSIWYG + CODE synchronized editors
- Version control & collaboration (chat/comments)
- PDF export (JPG→PDF secure method)
- Security with `.sddoc` encryption & granular protection
- OCR support (later)
- Plugins & themes (later)

---

**UX Design Frame**

***FULL***

```


+======================================================================================+======================+==============+
|                                                 🟦 Title Bar                                                                |
|                               (Window title, file/folder name, close/minimize/maximize buttons)                             |
+======================================================================================+======================+==============+
| 🟥 Activity Bar  | 🟩 Primary Side Bar            | 🟨 App Area                         | 🟪 Secondary Side Bar | 🟫 Action Bar |
|                 | (Explorer, Search, Git, etc.) |                                     |                      |              |
|                 | ----------------------------- | ---------------------------------- | -------------------- | ------------ |
|                 | 📁 Explorer                    | 🔼 Navigation Header               |                      |              |
|                 | 🔍 Search                      | ---------------------------------- |                      |              |
|                 | 🔃 Source Control (Git)        | 📝 Editor Area (Tabs + Content)    |                      |              |
|                 | 🐞 Run and Debug               |    - index.html                    |                      |              |
|                 | 🧩 Extensions                  |    - app.js                        |                      |              |
|                 | ▷ Other Extensions             |    - README.md                     |                      |              |
|                 |                               |                                    |                      |              |
|                 |                               | ---------------------------------- |                      |              |
|                 |                               | 📦 Panel (Terminal / Problems / ...) |                      |              |
|                 |                               |   - Terminal                        |                      |              |
|                 |                               |   - Output                          |                      |              |
|                 |                               |   - Debug Console                   |                      |              |
|                 |                               |   - Problems                        |                      |              |
+                 |                               |====================================+======================+==============+
|                 |                               |      Panel (Terminal / Problems / ...)                                   |
|                 |                               |   (Terminal | Output | Debug Console | Problems | )                      |
+======================================================================================+======================+==============+
|                                        🟦 Status Bar (Bottom)                                               |
|   (Git branch | Language | Encoding | EOL | Line/Column | Extensions | Live Server | Notifications...)       |
+======================================================================================+======================+==============+
```


***SIMPLE***

```
title Bar

Activity Bar| Primary Side Bar (Explorer, Git, Search, etc.)| App       | Secondary Side Bar| Action Bar
                                                            | Navigation|
                                                            | Editor    |
                                                            | Panel     |

Status Bar
```
