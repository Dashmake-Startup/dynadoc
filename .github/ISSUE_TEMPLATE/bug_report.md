---
name: Bug report
about: Something is broken or behaves unexpectedly.
title: 'bug: '
labels: ['bug', 'needs-triage']
assignees: []
---

## What happened

<!-- Plain description. One paragraph. -->

## Steps to reproduce

1.
2.
3.

## Expected

<!-- What should have happened. -->

## Actual

<!-- What actually happened. Attach a screenshot or recording if it is visual. -->

## Environment

<!-- There are no tagged releases yet, so the commit SHA is what identifies
     your build. `git rev-parse --short HEAD` -->

- Commit SHA:
- Build: desktop (Electron) / web
- OS and version:
- Node and npm versions (`node -v && npm -v`):
- API instance you were pointing at (`VITE_API_URL`), or "not signed in":

## Logs

<!--
Renderer console: View → Toggle DevTools → Console
Main process: the terminal where `npm run dev` is running
Packaged builds: ~/Library/Logs/Dynadoc (macOS), %APPDATA%\Dynadoc\logs (Windows), ~/.config/Dynadoc/logs (Linux)

Redact tokens, document passwords and personal data before pasting.
-->

```
paste the relevant excerpts here
```

## Anything else

<!-- Recent changes on your side, related issues, hypotheses. -->
