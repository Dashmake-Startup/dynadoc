/**
 * Binds an OAuth callback to the browser that started it.
 *
 * Without this, `captureAuthFromUrl` accepted any credential that appeared in
 * the query string, so a link of the form `https://app.../?session=<id>` sent
 * to someone signed them into the sender's account: everything they then wrote
 * landed in a drive they did not own. The credential being valid is precisely
 * the problem, which is why validating it server-side would not have helped.
 *
 * So the browser mints a nonce before leaving for the provider, keeps it in its
 * own storage, and carries a copy in `return_to`. Only a callback that comes
 * back holding the same nonce is accepted. An attacker can mint credentials,
 * but cannot write to the victim's storage, so the link they craft has nothing
 * to match.
 *
 * This is the browser's half. The other half is the API validating the OAuth
 * `state` it issued, which it does not do yet; the two are independent and
 * neither replaces the other.
 */

/** Query parameter carrying the nonce through the provider and back. */
export const CALLBACK_NONCE_PARAM = 'ddoc_cb'

const STORAGE_KEY = 'ddoc.auth.callback_nonce'

/**
 * `sessionStorage` first: it is per-tab, and the sign-in navigation stays in
 * the tab that started it, so that is the tightest binding available. A browser
 * that refuses it falls back to `localStorage`, which still binds to the
 * profile and is still unreachable from a crafted link. Both refusing means no
 * sign-in is possible anyway — tokens live in `localStorage` too.
 */
function stores(): Storage[] {
  const found: Storage[] = []
  for (const get of [() => sessionStorage, () => localStorage]) {
    try {
      const store = get()
      if (store) found.push(store)
    } catch {
      // Blocked by the browser; try the next one.
    }
  }
  return found
}

function randomNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Mints a nonce and remembers it. Returns null when nothing could be stored:
 * the caller then leaves the parameter off rather than sending a nonce it
 * cannot check, and `matchesStoredNonce` refuses the callback on the way back.
 */
export function issueCallbackNonce(): string | null {
  const available = stores()
  if (available.length === 0) return null

  const nonce = randomNonce()
  let stored = false
  for (const store of available) {
    try {
      store.setItem(STORAGE_KEY, nonce)
      stored = true
    } catch {
      // Quota or private mode; another store may still take it.
    }
  }
  return stored ? nonce : null
}

/** True when `value` is the nonce this browser issued. */
export function matchesStoredNonce(value: string): boolean {
  if (!value) return false
  for (const store of stores()) {
    try {
      if (store.getItem(STORAGE_KEY) === value) return true
    } catch {
      // Unreadable; the next store may answer.
    }
  }
  return false
}

/** Forgets the nonce, so one callback cannot be replayed. */
export function clearCallbackNonce(): void {
  for (const store of stores()) {
    try {
      store.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to do: a nonce we cannot remove is one we will not match.
    }
  }
}
