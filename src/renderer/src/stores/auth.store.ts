import { get, writable } from 'svelte/store'
import {
  getSession,
  logout,
  onSessionChanged,
  openAuth,
  listSessions,
  setActiveOrg,
  joinInvite,
  getProvisioningStatus,
  completeProvisioning,
  requestRegionMigration,
  forceRefresh
} from '../services/auth/auth.service'
import type { AuthIntent, AuthSession, WorkspaceSessions, SubscriptionInfo } from '../types/auth'
import { persistRegionalEndpoints } from '../lib/api/shared/baseUrl'
import { markSecureLeaseAvailable, markSecureLeaseUnavailable } from './secureLease.store'

export type AuthStoreState = {
  initializing: boolean
  loading: boolean
  authenticated: boolean
  user: AuthSession['user']
  expiresAt?: string
  issuedAt?: string
  updatedAt?: string
  subscriptionActive?: boolean
  planType?: string
  subscription?: SubscriptionInfo
  effectivePlanType?: string
  effectiveSubscriptionActive?: boolean
  effectiveSubscription?: SubscriptionInfo
  offlineDeadline?: string
  lastServerCheck?: string
  accessStatus?: string
  activeOrg?: string
  workspaces?: WorkspaceSessions
  error: string | null
  provisioning?: any
}

const initialState: AuthStoreState = {
  initializing: true,
  loading: false,
  authenticated: false,
  user: null,
  expiresAt: undefined,
  issuedAt: undefined,
  updatedAt: undefined,
  subscriptionActive: undefined,
  planType: undefined,
  subscription: undefined,
  effectivePlanType: undefined,
  effectiveSubscriptionActive: undefined,
  effectiveSubscription: undefined,
  offlineDeadline: undefined,
  lastServerCheck: undefined,
  accessStatus: undefined,
  error: null,
  provisioning: undefined
}

export const authStore = writable<AuthStoreState>({ ...initialState })

const AUTH_REQUEST_TIMEOUT_MS = 10000

let _authInitialized = false
let _unsubscribe: (() => void) | null = null
let _initializePromise: Promise<void> | null = null
let _unsubscribeAutoRefresh: (() => void) | null = null
let _autoRefreshPromise: Promise<void> | null = null
let _lastAutoRefreshAt = 0

const DEFAULT_ORG_KEYS = new Set(['dynadoc-org', 'default-org', 'default', 'dynadoc', 'public'])
const isDefaultOrg = (value: string | null | undefined) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  if (!normalized) return false
  return DEFAULT_ORG_KEYS.has(normalized)
}

const filterWorkspaceSessions = (sessions: WorkspaceSessions | Record<string, AuthSession>) => {
  const entries = Object.entries(sessions || {})
  const filtered = entries.filter(([key, session]) => {
    if (isDefaultOrg(key)) return false
    const orgLabel = session?.user?.organization || ''
    if (isDefaultOrg(orgLabel)) return false
    return true
  })
  return Object.fromEntries(filtered) as WorkspaceSessions
}

type AuthOpOptions = {
  setLoading?: boolean
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutRef: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutRef = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutRef) clearTimeout(timeoutRef)
  }) as Promise<T>
}

function syncFromSession(session: AuthSession) {
  console.log('authath syncFromSession', { session })
  const normalizedSession =
    (session as any)?.session && typeof (session as any).session === 'object'
      ? ((session as any).session as AuthSession)
      : session

  // Redirect to regional spoke domain if authenticated on central web app
  if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'app.dynadoc.dashmake.com' &&
    normalizedSession?.authenticated
  ) {
    const apiUrl = String(
      normalizedSession?.api_url || normalizedSession?.apiUrl || normalizedSession?.APIURL || ''
    ).trim()

    if (apiUrl) {
      try {
        const parsed = new URL(apiUrl)
        const parts = parsed.hostname.split('.')
        let subdomain = 'ch'
        if (parts.length >= 4 && parts[0] === 'api') {
          subdomain = parts[1]
        }
        const targetDomain = `app.${subdomain}.dynadoc.dashmake.com`
        if (window.location.hostname !== targetDomain) {
          const targetUrl = new URL(window.location.href)
          targetUrl.hostname = targetDomain

          // Pass token and refresh token in URL query params to preserve the session
          const token = normalizedSession?.accessToken || ''
          const refresh = normalizedSession?.refreshToken || ''
          if (token) targetUrl.searchParams.set('token', token)
          if (refresh) targetUrl.searchParams.set('refresh_token', refresh)

          console.log(`Redirecting from central to regional spoke: ${targetUrl.toString()}`)
          window.location.assign(targetUrl.toString())
          return
        }
      } catch (err) {
        console.error('Failed to redirect to regional spoke:', err)
      }
    }
  }

  persistRegionalEndpoints(normalizedSession)

  const normalizedSubscription =
    normalizedSession?.subscription ||
    normalizedSession?.raw?.subscription ||
    normalizedSession?.raw?.billing?.subscription ||
    normalizedSession?.raw?.billing ||
    undefined

  authStore.update((state) => ({
    ...state,
    initializing: false,
    authenticated: Boolean(normalizedSession?.authenticated),
    user: normalizedSession?.user || null,
    expiresAt: normalizedSession?.expiresAt,
    issuedAt: normalizedSession?.issuedAt,
    updatedAt: normalizedSession?.updatedAt,
    subscriptionActive: normalizedSession?.subscriptionActive,
    planType: normalizedSession?.planType,
    subscription: normalizedSubscription,
    offlineDeadline: normalizedSession?.offlineDeadline,
    lastServerCheck: normalizedSession?.lastServerCheck,
    accessStatus: normalizedSession?.accessStatus,
    activeOrg:
      normalizedSession?.activeOrg || normalizedSession?.user?.organization || state.activeOrg,
    workspaces: state.workspaces || {},
    error: null
  }))
  console.log('authath syncFromSession normalizedSession', { normalizedSession })
  syncEffectiveEntitlements({
    ...get(authStore),
    planType: normalizedSession?.planType,
    subscriptionActive: normalizedSession?.subscriptionActive,
    subscription: normalizedSubscription
  } as AuthStoreState)
}

function isTruthy(value: any) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function normalizePlanLabel(value: any) {
  return String(value || '').toLowerCase()
}

function planRank(label: string) {
  const normalized = normalizePlanLabel(label)
  if (
    normalized.includes('enterprise') ||
    normalized.includes('corporate') ||
    normalized.includes('onprem')
  ) {
    return 5
  }
  if (normalized.includes('business')) return 4
  // "pilot" is the free MVP plan that still grants SDDoc (editor.sddoc),
  // so it ranks alongside pro for secure-writing purposes.
  if (normalized.includes('pro') || normalized.includes('secure') || normalized.includes('pilot'))
    return 3
  if (normalized.includes('standard')) return 2
  return 1
}

function resolveEffectiveEntitlements(state: AuthStoreState) {
  const candidates: Array<{
    planType?: string
    subscriptionActive?: boolean
    subscription?: SubscriptionInfo
  }> = []

  if (state.planType || state.subscription || state.subscriptionActive) {
    candidates.push({
      planType: state.planType,
      subscriptionActive: state.subscriptionActive,
      subscription: state.subscription
    })
  }

  const sessions = Object.values(state.workspaces || {})
  sessions.forEach((session) => {
    candidates.push({
      planType: session?.planType,
      subscriptionActive: session?.subscriptionActive,
      subscription: session?.subscription
    })
  })

  let bestRank = -1
  let bestActive = false
  let bestPlan: string | undefined
  let bestSubscription: SubscriptionInfo | undefined

  for (const candidate of candidates) {
    const subscription = candidate.subscription
    const active =
      isTruthy(subscription?.active) ||
      isTruthy(candidate.subscriptionActive) ||
      ['active', 'trialing'].includes(normalizePlanLabel(subscription?.status))
    const label = normalizePlanLabel(subscription?.plan || subscription?.tier || candidate.planType)
    const rank = planRank(label)

    if (rank > bestRank || (rank === bestRank && active && !bestActive)) {
      bestRank = rank
      bestActive = active
      bestPlan = candidate.planType || subscription?.plan || subscription?.tier
      bestSubscription = subscription
    }
  }

  return {
    effectivePlanType: bestPlan,
    effectiveSubscriptionActive: bestActive,
    effectiveSubscription: bestSubscription
  }
}

function resolveSecureEntitlement(
  session: AuthSession,
  subscription?: SubscriptionInfo
): { allowed: boolean; reason?: string } {
  const subscriptionActive =
    isTruthy(subscription?.active) ||
    isTruthy(session?.subscriptionActive) ||
    ['active', 'trialing'].includes(normalizePlanLabel(subscription?.status))

  const planLabel = normalizePlanLabel(
    subscription?.plan || subscription?.tier || session?.planType
  )
  const featureFlags = subscription?.features || {}
  // Accept the entitlement feature both as a flag object and as the server's
  // feature-id list (e.g. ["editor.sddoc"]) that the pilot plan returns.
  const featureList = Array.isArray(featureFlags) ? (featureFlags as string[]) : []
  const featureAllowed =
    isTruthy(featureFlags?.secureSave) ||
    isTruthy(featureFlags?.secureWriting) ||
    isTruthy(featureFlags?.sddoc) ||
    isTruthy(featureFlags?.secureDocs) ||
    featureList.includes('editor.sddoc')

  const planAllowed = [
    'pilot',
    'pro',
    'business',
    'enterprise',
    'corporate',
    'onprem',
    'secure'
  ].some((tier) => planLabel.includes(tier))

  const allowed = Boolean(subscriptionActive && (featureAllowed || planAllowed))

  if (allowed) return { allowed: true }
  return {
    allowed: false,
    reason:
      (subscription?.status &&
        `Secure saving requires an active subscription (${subscription.status}).`) ||
      'Secure saving requires an active subscription.'
  }
}

function syncSecureLease(session: AuthSession, subscription?: SubscriptionInfo) {
  const entitlement = resolveSecureEntitlement(session, subscription)
  if (entitlement.allowed) {
    markSecureLeaseAvailable()
  } else {
    markSecureLeaseUnavailable(entitlement.reason)
  }
}

function syncEffectiveEntitlements(stateOverride?: AuthStoreState) {
  const state = stateOverride || get(authStore)
  const effective = resolveEffectiveEntitlements(state)
  authStore.update((current) => {
    if (
      current.effectivePlanType === effective.effectivePlanType &&
      current.effectiveSubscriptionActive === effective.effectiveSubscriptionActive &&
      current.effectiveSubscription === effective.effectiveSubscription
    ) {
      return current
    }
    return {
      ...current,
      effectivePlanType: effective.effectivePlanType,
      effectiveSubscriptionActive: effective.effectiveSubscriptionActive,
      effectiveSubscription: effective.effectiveSubscription
    }
  })

  const effectiveSession: AuthSession = {
    authenticated: Boolean(state.authenticated),
    user: state.user || null,
    planType: effective.effectivePlanType,
    subscriptionActive: effective.effectiveSubscriptionActive
  }
  console.log('authath syncFromSession normalizedSession', {
    effectiveSession,
    state,
    stateOverride,
    authstore: get(authStore)
  })

  syncSecureLease(effectiveSession, effective.effectiveSubscription)
}

function setError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Authentication failed')
  authStore.update((state) => ({
    ...state,
    initializing: false,
    loading: false,
    error: message
  }))
}

async function runAuthOperation(
  operation: () => Promise<void>,
  options: AuthOpOptions = { setLoading: true }
) {
  const setLoading = options.setLoading ?? true

  authStore.update((state) => ({
    ...state,
    loading: setLoading ? true : state.loading,
    error: null
  }))

  try {
    await operation()
  } catch (error) {
    setError(error)
  } finally {
    if (setLoading) {
      authStore.update((state) => ({ ...state, loading: false }))
    }
  }
}

export async function initializeAuthStore() {
  if (_authInitialized) return
  if (_initializePromise) return _initializePromise

  _initializePromise = (async () => {
    _unsubscribe = onSessionChanged((session) => {
      syncFromSession(session)
    })

    if (!_unsubscribeAutoRefresh && typeof window !== 'undefined') {
      const maybeRefresh = async () => {
        const state = get(authStore)
        if (!state.authenticated) return

        const now = Date.now()
        if (now - _lastAutoRefreshAt < 30_000) return
        _lastAutoRefreshAt = now

        if (_autoRefreshPromise) return
        _autoRefreshPromise = (async () => {
          await refreshAuthSession({ setLoading: false })
          await refreshWorkspaceSessions()
        })().finally(() => {
          _autoRefreshPromise = null
        })
        await _autoRefreshPromise
      }

      const onFocus = () => {
        void maybeRefresh()
      }
      const onVisibility = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          void maybeRefresh()
        }
      }

      window.addEventListener('focus', onFocus)
      document?.addEventListener?.('visibilitychange', onVisibility)
      _unsubscribeAutoRefresh = () => {
        window.removeEventListener('focus', onFocus)
        document?.removeEventListener?.('visibilitychange', onVisibility)
      }
    }

    // Bootstrapping should not lock auth buttons across the UI.
    await refreshAuthSession({ setLoading: false })
    await refreshWorkspaceSessions()
    _authInitialized = true
  })()

  try {
    await _initializePromise
  } finally {
    _initializePromise = null
  }
}

export async function refreshWorkspaceSessions() {
  try {
    const payload = await withTimeout(listSessions(), AUTH_REQUEST_TIMEOUT_MS, 'listSessions')
    const rawPayload = (payload as any)?.raw || payload || {}
    const sessions = (rawPayload as any)?.sessions || (payload as any)?.sessions || rawPayload || {}
    const activeOrg =
      (rawPayload as any)?.activeOrg ||
      (rawPayload as any)?.active_org ||
      (payload as any)?.activeOrg ||
      (payload as any)?.active_org
    authStore.update((state) => ({
      ...state,
      workspaces: filterWorkspaceSessions(sessions as WorkspaceSessions),
      activeOrg: activeOrg || state.activeOrg
    }))
    syncEffectiveEntitlements()
  } catch (error) {
    // keep silent; workspace list is optional for UI
  }
}

export async function switchWorkspace(org: string) {
  await runAuthOperation(async () => {
    const session = await withTimeout(setActiveOrg(org), AUTH_REQUEST_TIMEOUT_MS, 'setActiveOrg')
    syncFromSession(session)
  })
}

export async function joinWorkspace(org: string) {
  await startAuth('signin', org)
  await refreshAuthSession({ setLoading: false })
  await refreshWorkspaceSessions()
}

export async function joinWorkspaceByInvite(code: string) {
  await initializeAuthStore()
  await runAuthOperation(async () => {
    const result = await withTimeout(joinInvite(code), AUTH_REQUEST_TIMEOUT_MS, 'joinInvite')
    if (!result?.ok) {
      throw new Error(result?.message || 'Failed to open invite link.')
    }
  })
  await refreshAuthSession({ setLoading: false })
  await refreshWorkspaceSessions()
}

export async function createWorkspace(org: string) {
  await startAuth('register', org)
  await refreshAuthSession({ setLoading: false })
  await refreshWorkspaceSessions()
}

export async function usePersonalWorkspace() {
  const state = get(authStore)
  const personal = state.user?.organization || state.activeOrg
  if (!personal) return
  await switchWorkspace(personal)
}

export async function refreshAuthSession(options: AuthOpOptions = { setLoading: true }) {
  await runAuthOperation(async () => {
    const session = await withTimeout(getSession(), AUTH_REQUEST_TIMEOUT_MS, 'getSession')
    syncFromSession(session)
    await refreshProvisioningStatus()
  }, options)
}

export async function refreshProvisioningStatus() {
  const state = get(authStore)
  if (!state.authenticated) return
  const provisioning = await getProvisioningStatus()
  if (!provisioning) return
  authStore.update((current) => ({ ...current, provisioning }))
}

export async function finishProvisioning(payload: Parameters<typeof completeProvisioning>[0]) {
  await runAuthOperation(async () => {
    const provisioning = await withTimeout(
      completeProvisioning(payload),
      AUTH_REQUEST_TIMEOUT_MS,
      'completeProvisioning'
    )
    authStore.update((current) => ({ ...current, provisioning }))
    await withTimeout(forceRefresh(), AUTH_REQUEST_TIMEOUT_MS, 'forceRefresh')
    await refreshAuthSession({ setLoading: false })
  })
}

export async function migrateWorkspaceRegion(destinationRegion: string, tenantId?: string) {
  await runAuthOperation(async () => {
    const migration = await withTimeout(
      requestRegionMigration(destinationRegion, tenantId),
      AUTH_REQUEST_TIMEOUT_MS,
      'requestRegionMigration'
    )
    authStore.update((current) => ({
      ...current,
      provisioning: {
        ...(current.provisioning || {}),
        migration
      }
    }))
  })
}

export async function startAuth(intent: AuthIntent = 'signin', org?: string) {
  await initializeAuthStore()
  await runAuthOperation(async () => {
    const result = await withTimeout(openAuth(intent, org), AUTH_REQUEST_TIMEOUT_MS, 'openAuth')
    if (!result?.ok) {
      throw new Error(result?.message || 'Failed to open authentication flow.')
    }
  })

  // Ensure subscription/session data refreshes after auth flow completes.
  const startTime = Date.now()
  const maxWaitMs = 60_000
  const pollIntervalMs = 2_000
  const poll = async () => {
    await refreshAuthSession({ setLoading: false })
    const state = get(authStore)
    if (state.authenticated || Date.now() - startTime > maxWaitMs) return
    setTimeout(poll, pollIntervalMs)
  }
  setTimeout(poll, pollIntervalMs)
}

export async function logoutAuth(org?: string) {
  await initializeAuthStore()
  await runAuthOperation(async () => {
    const session = await withTimeout(logout(org), AUTH_REQUEST_TIMEOUT_MS, 'logout')
    if (org) {
      await refreshAuthSession({ setLoading: false })
      return
    }
    syncFromSession(session)
  })
}

export async function toggleAuth(signInIntent: AuthIntent = 'signin', org?: string) {
  const state = get(authStore)
  if (state.authenticated) {
    await logoutAuth()
    return
  }
  await startAuth(signInIntent, org)
}

export function destroyAuthStore() {
  if (_unsubscribe) {
    _unsubscribe()
    _unsubscribe = null
  }
  _authInitialized = false
  _initializePromise = null
  authStore.set({ ...initialState })
}
