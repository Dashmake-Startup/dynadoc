# Security Model

## Document Protection Levels

Dynadoc supports granular content protection at multiple levels:

| Level | Scope | Example |
|---|---|---|
| Document | Entire file | Password-protected document |
| Page | Single page/tab | Locked spreadsheet page |
| Section | Block of content | Protected paragraph group |
| Paragraph | Single paragraph | Read-only paragraph |
| Character | Inline range | Blurred/redacted text span |

## Encrypted Documents (.sddoc)

The `.sddoc` format provides end-to-end encryption:

- **Content encryption**: AES-256-GCM
- **Key wrapping**: RSA-2048
- **Signing**: RSA-2048 (separate key pair)

The encryption algorithm is public. Security relies on:
1. Keys managed by the backend (never stored in client code)
2. License validation required to decrypt
3. Signed by the server to prevent tampering

## Offline Secure Mode

For users who need encrypted document access while offline:

1. While online, the client acquires an **offline lease** (RSA-2048 signed token)
2. The lease contains: plan, features, expiry, device binding
3. Offline, the client verifies the lease signature locally
4. After the grace period (default 7 days), encrypted features are disabled
5. Reconnecting extends the lease automatically

## Ephemeral Documents

Documents can be configured to self-destruct based on:
- **Date**: Expires after a specific date/time
- **Read count**: Expires after N reads
- **Write count**: Expires after N edits

## Access Control

| Method | Description |
|---|---|
| Password | Document-level password protection |
| 2FA | Two-factor authentication for sensitive docs |
| Role-based | Viewer, editor, admin roles per document |
| Invite-only | Access limited to invited users |

## Security Architecture (Client Side)

The Electron security model follows best practices:

```
Renderer (untrusted)
    │
    │ contextBridge (minimal API surface)
    │
Preload (security boundary)
    │
    │ IPC channels (validated)
    │
Main Process (trusted, Node.js access)
```

- `nodeIntegration: false` — renderer cannot access Node.js
- `contextIsolation: true` — preload runs in isolated context
- `sandbox: true` — renderer is sandboxed
- Only explicitly exposed APIs are available to the renderer

## What Is NOT in the Client Code

The following security components live exclusively in the backend (private repo):
- RSA private keys
- License signing logic
- Stripe payment processing
- User database and credentials
- Share access control enforcement
- Revocation list management
