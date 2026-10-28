# Contributing to Dynadoc

Thanks for taking the time. This document is the short version of everything
you need to open a pull request that can be merged.

## Setup

```bash
git clone https://github.com/Dashmake-Startup/dynadoc.git
cd dynadoc
cp .env.example .env.local
npm ci
npm run dev        # or: npm run dev:web
```

Node **20** and npm **10** exactly. [README.md](README.md) lists the
per-platform system packages and the two native modules worth checking after
install.

Use `.env.local`, never `.env`. `.env` is ignored and must stay that way.

The bridge the client talks to is not published, so a fresh clone has nothing
to call. `tools/stub-bridge/` is the stand-in that makes this repository
runnable without it — the normal way to develop here:

```bash
npm run stub-bridge     # terminal 1
npm run dev:web:stub    # terminal 2, then open the URL Vite prints
```

Read [tools/stub-bridge/README.md](tools/stub-bridge/README.md) before you
trust a result you got through it. It is explicit about which channels it
answers, which it refuses by name, and which parts have not been verified end
to end — and if you hit one of those, that is worth an issue.

If `npm run dev` leaves stale processes behind:

```bash
pkill -f Electron; pkill -f vite; lsof -ti:8081 | xargs kill -9 2>/dev/null
```

## Checks — what works, and what does not

Be aware of the real state of the tooling before you trust a green terminal.

**One hard gate. This is the check CI fails on:**

```bash
npm run check:cycles     # no new circular imports above the recorded baseline
```

**Advisory, run them and read the diff, not the total:**

```bash
npm run typecheck:node   # TypeScript on main + preload. ~23 pre-existing errors.
npm run lint             # ESLint. Large pre-existing debt.
```

Both run in CI with `continue-on-error: true`. Your job is not to reach zero;
it is to not add to the count. Compare against `main` before and after.

**Do not rely on these:**

- `npm run svelte-check` and therefore `npm run typecheck` and `npm run ci:check`
  report thousands of pre-existing diagnostics on the renderer. They cannot
  gate anything today and a clean run is not achievable in a single PR. CI does
  not run them.
- **There is no test suite.** No vitest, no jest, no playwright, no `test`
  script. Verification is manual. Say in your pull request what you exercised
  and how.

If you want to change that, a first `vitest` setup on the pure modules under
`src/renderer/src/lib/` would be welcome and is a good standalone contribution.

### Compiling a single Svelte component

Useful when you have touched one component and want to know it still compiles
without waiting for a full build:

```bash
npx svelte-check --tsconfig ./tsconfig.json --output human 2>&1 | grep '<your-file>'
```

## Branches

Branch from `main`. Never push to `main` directly.

```
feat/<slug>      new user-visible behaviour
fix/<slug>       bug fix
docs/<slug>      documentation only
chore/<slug>     tooling, dependencies, CI, governance
refactor/<slug>  internal restructuring, no behaviour change
perf/<slug>      measurable performance change
```

## Commits

[Conventional Commits](https://www.conventionalcommits.org), as used throughout
the history. Subject in lower case, no trailing period, 72 characters or fewer.

```
feat(spreadsheet): add formula autocomplete
fix(export): handle a missing path in the DOCX exporter
chore(deps): bump tiptap to 3.1.0
```

Reference issues in the body: `Fixes #123`.

Do **not** add `Co-Authored-By` trailers.

A `husky` + `lint-staged` hook runs `prettier --write` on staged files. If a
file was not previously formatted, your commit will carry unrelated formatting
changes. That is expected; mention it in the pull request so a reviewer does
not look for substance in those lines.

## Code style

- Surgical edits. Every changed line should trace back to the stated purpose of
  the pull request.
- Match the surrounding style, even where you would write it differently.
- No speculative abstractions, no configurability nobody asked for, no error
  handling for cases that cannot occur.
- Remove imports and variables your change made dead. Leave pre-existing dead
  code alone unless removing it is the point of the pull request.

## Never commit

- **Secrets of any kind** — API keys, tokens, passwords, private keys,
  certificates, keystores. Not in source, not in configuration, not in a
  comment, not "temporarily".
- **`.env` files.** `.env.example` is the only one that belongs in git, and it
  holds names and empty values, never values.
- **Compiled binaries and archives** — executables, `.dll`, `.so`, `.dylib`,
  `.node`, `.jar`, `.zip`. Third-party runtimes are fetched, not committed.
- **Build output** — `node_modules/`, `dist/`, `out/`, `web/dist/`.
- **Large fixtures.** If a test file is over a megabyte, it probably belongs
  somewhere else. Say what you need and we will find a place for it.
- **Real customer or third-party documents**, even as test material.

Hardcoded hostnames, IP addresses and ports count as configuration, not as
code. Read them from `import.meta.env` and add the variable to `.env.example`.

## Pull requests

1. Open the pull request against `main` with the template filled in.
2. CI must be green on the hard gate.
3. One approving review from a code owner. Reviewers are requested
   automatically through `CODEOWNERS`; no need to ping anyone.
4. Squash-merge from the GitHub interface.

For any user-visible change, attach a screenshot or a short recording, and
state which build you tested — desktop or web.

## Security

Never open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).
