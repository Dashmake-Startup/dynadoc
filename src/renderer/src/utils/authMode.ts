import { writable } from 'svelte/store'

const ACCESS_TOKEN_KEY = 'ddoc.access_token'
const GUEST_TOKEN_KEY = 'ddoc.guest_token'

export function hasAccessToken(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY))
  } catch {
    return false
  }
}

export function isGuestMode(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    // An authenticated session always wins. A guest marker left behind by a
    // public share opened earlier used to outrank a valid access token, which
    // demoted a signed-in user to guest: reads answered empty and writes were
    // discarded while still reporting success. Clear the stale marker so the
    // rest of the app sees one consistent state.
    if (localStorage.getItem(ACCESS_TOKEN_KEY)) {
      if (localStorage.getItem(GUEST_TOKEN_KEY)) {
        localStorage.removeItem(GUEST_TOKEN_KEY)
      }
      return false
    }
    return true
  } catch {
    return false
  }
}

// "Guest" in localStorage only means "no session": the RPC layer sets it
// whenever there is no access token. What the shell needs to know is
// narrower — is a public share being read without a session right now?
// That is the only case in which the shell may show without a sign-in.
export const publicShareGuest = writable<boolean>(false)

export function enterPublicShareGuestMode() {
  setGuestMode(true)
  if (!hasAccessToken()) publicShareGuest.set(true)
}

export function setGuestMode(enabled: boolean) {
  if (typeof localStorage === 'undefined') return
  try {
    if (enabled) {
      if (localStorage.getItem(ACCESS_TOKEN_KEY)) return
      localStorage.setItem(GUEST_TOKEN_KEY, '1')
    } else {
      localStorage.removeItem(GUEST_TOKEN_KEY)
      publicShareGuest.set(false)
    }
  } catch {
    // ignore
  }
}

export function clearGuestMode() {
  setGuestMode(false)
}
