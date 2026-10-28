export type AuthIntent = 'signin' | 'signup' | 'register'

export type AuthUser = {
  id?: string
  name?: string
  displayName?: string
  firstName?: string
  lastName?: string
  username?: string
  email?: string
  phone?: string
  avatar?: string
  organization?: string
  organizations?: string[]
  roles?: string[]
  groups?: string[]
  permissions?: string[]
  isAdmin?: boolean
  lastLoginAt?: string
}

export type AuthSession = {
  authenticated: boolean
  user: AuthUser | null
  accessToken?: string
  refreshToken?: string
  expiresAt?: string
  issuedAt?: string
  updatedAt?: string
  subscriptionActive?: boolean
  planType?: string
  subscription?: SubscriptionInfo
  offlineDeadline?: string
  lastServerCheck?: string
  accessStatus?: string
  activeOrg?: string
  region?: string
  apiUrl?: string
  collabWsUrl?: string
  raw?: any
}

export type SubscriptionInfo = {
  id?: string
  status?: string
  active?: boolean
  plan?: string
  planId?: string
  tier?: string
  currentPeriodEnd?: string
  expiresAt?: string
  cancelAt?: string
  cancelAtPeriodEnd?: boolean
  seats?: {
    total?: number
    used?: number
  }
  features?: Record<string, any>
}

export type AuthOpenResult = {
  ok: boolean
  url?: string
  message?: string
}

export type WorkspaceSessions = Record<string, AuthSession>
