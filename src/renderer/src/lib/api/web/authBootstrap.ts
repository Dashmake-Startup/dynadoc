import { persistRegionalEndpoints, resolveApiBaseUrl } from '../shared/baseUrl'
import { setTokens } from './rpc'
import { CALLBACK_NONCE_PARAM, clearCallbackNonce, matchesStoredNonce } from './authCallbackNonce'

const AUTH_URL_PARAMS = ['session', 'token', 'refresh_token', CALLBACK_NONCE_PARAM]

/**
 * Captures OAuth callback credentials from the URL on web builds.
 *
 * After the Casdoor callback, the API redirects to `return_to` with
 * `?session=<id>`, a one-shot id exchanged here for the real tokens. Nothing
 * else consumed it, so the login flow silently dropped the credentials. This
 * must run BEFORE the first `auth:get-session` call: `invoke()` wipes stored
 * tokens when a response says `authenticated: false`.
 *
 * A credential in the query string is accepted only when the URL also carries
 * the nonce this browser issued when it started the sign-in. See
 * `authCallbackNonce.ts` for why: the attacker's session id is a *valid* one,
 * so nothing about the id itself can tell the two apart.
 *
 * `?token=&refresh_token=` used to be accepted here as a fallback. The API only
 * ever emits those for a non-http target — the desktop deep link, which this
 * file does not serve — because a web client over http always takes the session
 * exchange (`auth_handler.go`: `isHTTPRedirect(...) && (UseSessionExchange() ||
 * isWebClient)`, and `SaveExchange` falls back to memory rather than returning
 * empty). Accepting them here bought nothing and put bearer tokens in browser
 * history, Referer headers and any proxy log on the way.
 */
export async function captureAuthFromUrl(): Promise<boolean> {
  if (typeof window === 'undefined') return false

  let params: URLSearchParams
  try {
    params = new URLSearchParams(window.location.search)
  } catch {
    return false
  }

  const sessionId = (params.get('session') || '').trim()
  const legacyToken = (params.get('token') || '').trim()
  if (!sessionId && !legacyToken) return false

  // Refuse before touching the credential, so a crafted link cannot even reach
  // the exchange call. The URL is cleaned either way: leaving someone else's
  // session id in the address bar invites a reload into the same attempt.
  const nonce = (params.get(CALLBACK_NONCE_PARAM) || '').trim()
  if (!matchesStoredNonce(nonce)) {
    console.warn('[auth] callback does not match a sign-in started in this browser; ignored')
    stripAuthParamsFromUrl()
    return false
  }
  // One sign-in, one callback.
  clearCallbackNonce()

  if (legacyToken && !sessionId) {
    console.warn('[auth] a bare token in the URL is no longer accepted; sign in again')
    stripAuthParamsFromUrl()
    return false
  }

  let captured = false

  for (const base of candidateApiBases()) {
    try {
      const res = await fetch(`${base}/auth/exchange?session=${encodeURIComponent(sessionId)}`, {
        headers: { Accept: 'application/json' }
      })
      if (!res.ok) {
        console.warn('[auth] session exchange rejected', { base, status: res.status })
        continue
      }
      const result = await res.json().catch(() => null)
      // /auth/exchange returns the backend CallbackResult (snake_case).
      const accessToken = String(result?.access_token || '').trim()
      if (!accessToken) {
        console.warn('[auth] session exchange response missing access_token', { base })
        continue
      }
      setTokens(accessToken, String(result?.refresh_token || '').trim() || null)
      persistRegionalEndpoints(result)
      captured = true
      console.info('[auth] session exchanged, tokens stored')
      break
    } catch (err) {
      console.warn('[auth] session exchange failed on', base, err)
    }
  }

  // The exchange id is one-shot and its nonce has just been spent, so there is
  // nothing left for a reload to retry: clear the URL whatever happened. This
  // used to be kept on failure so a reload could recover, which no longer holds
  // now that a second attempt would be refused for want of a nonce.
  stripAuthParamsFromUrl()
  if (!captured) {
    console.warn('[auth] could not exchange the session; sign in again')
  }
  return captured
}

/**
 * Exchange targets: the resolved API base first, then the host-derived one
 * (`app.X` -> `api.X`) in case a stale regional URL is still in storage.
 * The exchange session lives in memory on the API host that served the
 * OAuth callback, so a stale regional base would 404.
 */
function candidateApiBases(): string[] {
  const bases: string[] = []
  const push = (value: string) => {
    const base = String(value || '')
      .trim()
      .replace(/\/$/, '')
    if (base && !bases.includes(base)) bases.push(base)
  }
  push(resolveApiBaseUrl())
  const host = String(window.location.host || '')
  if (host.startsWith('app.') && String(window.location.protocol || '').startsWith('http')) {
    push(`${window.location.protocol}//${host.replace(/^app\./, 'api.')}`)
  }
  return bases
}

function stripAuthParamsFromUrl() {
  try {
    const url = new URL(window.location.href)
    let changed = false
    for (const key of AUTH_URL_PARAMS) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key)
        changed = true
      }
    }
    if (changed) window.history.replaceState(window.history.state, '', url.toString())
  } catch {
    // ignore — worst case the params stay visible in the URL
  }
}
