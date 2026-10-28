import type { AuthUser } from '../types/auth'
import { cryptoRandomUUID } from './common.utils'

export type CollabPresenceUser = {
  id: string
  name: string
  color: string
  isAnonymous: boolean
}

const CLIENT_ID_KEY = 'dynadoc.clientId'

const ANON_LABELS = [
  'Giraffe',
  'Mango',
  'Tapir',
  'Koala',
  'Panda',
  'Falcon',
  'Dolphin',
  'Otter',
  'Cedar',
  'Orchid',
  'Saffron',
  'Coconut',
  'Papaya',
  'Pineapple',
  'Lychee',
  'Avocado',
  'Clementine',
  'Lion',
  'Jaguar',
  'Ibis',
  'Hedgehog',
  'Kestrel',
  'Toucan',
  'Walrus',
  'Okapi'
]

function safeTrim(value: any) {
  return String(value || '').trim()
}

function resolveClientId() {
  if (typeof localStorage === 'undefined') return `client-${Math.random().toString(16).slice(2)}`
  const existing = safeTrim(localStorage.getItem(CLIENT_ID_KEY))
  if (existing) return existing
  const next =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? cryptoRandomUUID()
      : `client-${Date.now()}-${Math.random().toString(16).slice(2)}`
  try {
    localStorage.setItem(CLIENT_ID_KEY, next)
  } catch {
    // ignore
  }
  return next
}

function hashToInt(input: string) {
  // FNV-1a-ish (fast + stable enough for UI identities)
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function hslToHex(h: number, s: number, l: number) {
  // h: 0..360, s/l: 0..100
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) {
    r = c
    g = x
  } else if (h < 120) {
    r = x
    g = c
  } else if (h < 180) {
    g = c
    b = x
  } else if (h < 240) {
    g = x
    b = c
  } else if (h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function resolveAuthDisplayName(user: AuthUser | null | undefined) {
  if (!user) return ''
  const displayName =
    safeTrim(user.displayName) ||
    safeTrim(user.name) ||
    safeTrim([user.firstName, user.lastName].filter(Boolean).join(' ')) ||
    safeTrim(user.username)
  if (displayName) return displayName
  const email = safeTrim(user.email)
  if (!email) return ''
  const local = email.split('@')[0] || ''
  return local
}

export function resolveLocalCollabPresence(input: {
  docId: string
  authUser?: AuthUser | null
  forceAnonymous?: boolean
}): CollabPresenceUser {
  const docId = safeTrim(input.docId) || 'doc'
  const forceAnonymous = Boolean(input.forceAnonymous)
  const authName = !forceAnonymous ? resolveAuthDisplayName(input.authUser) : ''
  const clientId = resolveClientId()

  const baseKey = `${clientId}:${docId}`
  const seed = hashToInt(baseKey)
  const hue = seed % 360
  const color = hslToHex(hue, 72, 55)
  const id = `u-${seed.toString(16)}`

  if (authName) {
    return { id, name: authName, color, isAnonymous: false }
  }

  const label = ANON_LABELS[seed % ANON_LABELS.length] || 'Anonymous'
  return { id, name: `Anonymous ${label}`, color, isAnonymous: true }
}

