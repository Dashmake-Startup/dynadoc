# First ticket walkthrough

End-to-end example: **"Add a 'Duplicate document' action to the File menu."**

## 1. Read the ticket

A well-formed `good-first-issue` lists:

- Context — why the change matters
- Files to look at — entry points
- Suggested approach — implementation hint
- Acceptance criteria — definition of done

Read it fully before opening the editor.

## 2. Branch

```bash
git checkout main
git pull origin main
git checkout -b feat/duplicate-document
```

## 3. Find the code

```bash
grep -r "FileMenu" src/renderer/src/components --include="*.svelte" -l
# → src/renderer/src/components/titleBar/leftQuickAccess/FileMenu.svelte
```

Or `Cmd+P` in VS Code → type `FileMenu`.

Rule of thumb: find a similar existing feature first. Copy the pattern, adapt it.

## 4. Read before writing

Open `FileMenu.svelte`. Look at existing items ("Save", "Export"). Ask:

1. How do existing items trigger their action?
2. Does the action need IPC (main process), or stay in the renderer?
3. Is there already a utility function for what you need?

For "Duplicate", you'll likely need IPC. Channels live in `src/renderer/src/shared/ipc.ts`.

> The example below is hypothetical — `window.api.duplicateDocument` does not exist yet. The point is to show the *shape* of a typical change. Adapt names to the real channel you add.

## 5. Implement

Principles:

- Minimum code that solves the problem
- Match existing style (indentation, naming, structure)
- Don't touch adjacent code unrelated to the ticket

Sketch — add a menu item:

```svelte
<MenuItem on:click={handleDuplicate}>
  Duplicate document
</MenuItem>
```

```typescript
async function handleDuplicate() {
  await window.api.duplicateDocument(currentDocumentPath)
}
```

Since the IPC action does not exist yet, you'll add it in three steps:

1. Add the constant in `src/renderer/src/shared/ipc.ts`
2. Expose the API in `src/preload/index.ts`
3. Implement the handler in `src/main/index.ts`

## 6. Manual test

```bash
npm run dev
```

Test:

- Happy path — does it work as expected?
- Edge cases — unsaved document? name collision? read-only file?
- Regressions — do other menu items still work?

UI changes: state explicitly in the PR what you tested in the browser/Electron window.

## 7. Check quality

```bash
npm run lint
npm run typecheck
npm run ci:check
```

If `typecheck` errors come from **your** code (not the pre-existing ones in `src/main/index.ts`), fix them.

## 8. Commit

```bash
git add src/renderer/src/components/titleBar/leftQuickAccess/FileMenu.svelte
git add src/renderer/src/shared/ipc.ts
git commit -m "feat(file-menu): add duplicate document action"
```

Convention: `type(scope): description`. See [CONTRIBUTING.md](../CONTRIBUTING.md). No `Co-Authored-By`.

## 9. PR

```bash
git push -u origin feat/duplicate-document
```

On GitHub: **New Pull Request** → fill the template. Maintainers are auto-requested via `CODEOWNERS`. CI must be green before merge.

## Checklist

- [ ] Read the ticket fully
- [ ] Branched from `main`
- [ ] Searched for similar code before writing
- [ ] Minimal change (no extra features)
- [ ] Tested happy path and edge cases
- [ ] `npm run lint` and `npm run typecheck` pass
- [ ] Commit follows convention
- [ ] PR opened, CI green
