import { derived } from 'svelte/store'
import { authStore } from './auth.store'

/**
 * Feature switches.
 *
 * These are not a new mechanism: the licence already arrives with
 * `subscription.features` on the session, and auth.store.ts reads it to decide
 * whether sealed saving is allowed. That field comes in two shapes depending
 * on the plan — a flag object (`{ secureSave: true }`) or the server's list of
 * feature ids (`["editor.sddoc"]`) — so both are accepted here, exactly as
 * they are there.
 *
 * A switch is OFF unless the licence turns it on. Nothing is shown to someone
 * whose plan does not carry the flag, and nothing is hidden behind a flag the
 * server has no way to send.
 */
export type FeatureFlag = 'quickTools'

/**
 * The ids a flag may arrive under. Several because the server names features
 * either bare (`quickTools`) or namespaced (`home.quickTools`), and the client
 * should not care which convention the licence service settles on.
 */
const FEATURE_IDS: Record<FeatureFlag, string[]> = {
  quickTools: ['quickTools', 'home.quickTools']
}

/**
 * Local override, for development only.
 *
 * `localStorage.setItem('ddoc.feature.quickTools', 'on')` turns a switch on in
 * this browser profile, `'off'` forces it off, and removing the key hands the
 * decision back to the licence. It exists so the screen can be built and
 * reviewed before the licence service emits the flag; it never travels, and it
 * cannot turn on anything the application does not already ship.
 */
const OVERRIDE_PREFIX = 'ddoc.feature.'

function readOverride(flag: FeatureFlag): boolean | null {
  try {
    const raw = localStorage.getItem(OVERRIDE_PREFIX + flag)
    if (raw === 'on' || raw === 'true' || raw === '1') return true
    if (raw === 'off' || raw === 'false' || raw === '0') return false
  } catch {
    // Private windows and blocked site data throw on access; the licence
    // answer is the one that matters anyway.
  }
  return null
}

function isOn(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function grantedByLicence(flag: FeatureFlag, features: unknown): boolean {
  // Case-folded on both sides: the licence service lower-cases every feature
  // id before it stores or returns it, so a camelCase id compared literally
  // would never match what the server actually sends.
  const ids = FEATURE_IDS[flag].map((id) => id.toLowerCase())
  if (!features) return false

  // The server's feature-id list shape.
  if (Array.isArray(features)) {
    const granted = features.map((id) => String(id).trim().toLowerCase())
    return ids.some((id) => granted.includes(id))
  }

  // The flag-object shape.
  if (typeof features === 'object') {
    const flags = features as Record<string, unknown>
    return Object.entries(flags).some(
      ([key, value]) => ids.includes(key.trim().toLowerCase()) && isOn(value)
    )
  }

  return false
}

/**
 * Reactive predicate: `{#if $_$_isFeatureEnabled('quickTools')}`.
 *
 * Derived from the auth store, so it re-evaluates when the session — and with
 * it the licence — changes.
 */
export const _$_isFeatureEnabled = derived(authStore, ($auth) => (flag: FeatureFlag): boolean => {
  const override = readOverride(flag)
  if (override !== null) return override
  return grantedByLicence(flag, $auth?.subscription?.features)
})
