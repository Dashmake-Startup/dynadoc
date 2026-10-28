<!--
PR title: Conventional Commits — feat | fix | docs | chore | refactor | perf | build | ci(scope): subject
Keep the title under 70 characters. Put the detail in the body.
-->

## Summary

<!-- One paragraph: what changes, and why now. Link the issue. -->

Closes #

## Type

- [ ] feat — new user-visible behaviour
- [ ] fix — bug fix
- [ ] refactor — internal restructuring, no behaviour change
- [ ] docs — documentation only
- [ ] chore — tooling, dependencies, CI, governance
- [ ] perf — measurable performance change

## How was this tested?

<!-- There is no automated test suite. Concrete, reproducible steps are the
     only evidence a reviewer has. "Tested locally" is not enough. -->

- [ ] `npm run check:cycles` passes — this is the hard CI gate
- [ ] `npm run typecheck:node` shows no *new* errors compared with `main`
- [ ] `npm run lint` shows no *new* errors compared with `main`
- [ ] Build exercised: desktop (`npm run dev`) / web (`npm run dev:web`)
- Manual steps I ran:

## Screenshots or recording

<!-- Required for any user-visible change. Before and after, if it is visual. -->

## Risk

- Surface area affected:
- What could break:
- How to roll back:

## Checklist

- [ ] Branch named `feat/`, `fix/`, `docs/`, `chore/`, `refactor/` or `perf/`
- [ ] Commits follow Conventional Commits, with no `Co-Authored-By` trailers
- [ ] No secrets, credentials, keys or `.env*` files committed
- [ ] No compiled binaries, archives or build output committed
- [ ] No hardcoded hostnames, IP addresses or ports — read them from `import.meta.env` and add the variable to `.env.example`
- [ ] No debug logging left behind
- [ ] Unrelated formatting changes, if any, are called out above (the `lint-staged` hook reformats staged files)
