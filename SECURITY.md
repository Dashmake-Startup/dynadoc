# Security Policy

## Reporting a vulnerability

**Do not open a public issue, pull request or discussion for a security
vulnerability.**

Report it privately through
[GitHub Private Security Advisories](https://github.com/Dashmake-Startup/dynadoc/security/advisories/new).

Please include:

- a description of the issue;
- the steps to reproduce it, and the commit SHA you reproduced it on;
- the impact you believe it has;
- a suggested fix, if you have one.

### What to expect

| | |
|---|---|
| Acknowledgement | within 5 business days |
| Initial assessment | within 10 business days |
| Fix for a confirmed critical issue | we aim for 30 days, and will tell you if we cannot meet it |

We will keep you informed while the advisory is open, and credit you in it
unless you ask us not to.

Please give us a reasonable chance to ship a fix before disclosing publicly.

## Supported versions

Only the current `main` branch receives security fixes. This repository has no
tagged releases yet, so please report against a commit SHA rather than a
version number.

## Scope

In scope:

- Electron process configuration — `contextIsolation`, `nodeIntegration`,
  `sandbox`, `webSecurity`, the Content Security Policy, and anything reachable
  from document content.
- The preload surface and the IPC handlers it exposes.
- Authentication, session handling and token storage in the client.
- Sealed document (`.sddoc`) encryption and access control, as implemented in
  the client.
- Dependency vulnerabilities that are reachable from client code.

Out of scope:

- **The server side.** The API bridge is a separate, closed-source component.
  It is outside this repository's trust boundary; report issues you believe are
  server-side through the same advisory form and say so, and we will route them.
- Vulnerabilities in vendored third-party libraries that are unmodified here —
  report those upstream, and tell us so we can pick up the fix.
- Findings with no security impact: style, performance, or crashes that are not
  exploitable.
- Reports produced solely by an automated scanner, with no analysis of
  reachability in this codebase.

## Known posture

The Electron hardening work on this client is in progress and tracked
internally. If you are looking at the main process and preload configuration
and it surprises you, you are probably right; a report that explains a concrete
exploitation path is still useful to us and will be treated as in scope.
