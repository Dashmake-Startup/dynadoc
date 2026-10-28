import { get } from 'svelte/store'
import toast from 'svelte-hot-french-toast'
import { authStore } from '../../stores/auth.store'

type NoticeOptions = {
  source?: string
  force?: boolean
}

const STORAGE_KEY = 'dynadoc.ai.freePlan.noticeAt.v1'
const COOLDOWN_MS = 10 * 60 * 1000
let lastShownAt = 0

function now() {
  return Date.now()
}

function readLastShown(): number {
  if (lastShownAt) return lastShownAt
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? Number(raw) : 0
    if (Number.isFinite(parsed) && parsed > 0) {
      lastShownAt = parsed
      return parsed
    }
  } catch {
    // ignore
  }
  return 0
}

function writeLastShown(ts: number) {
  lastShownAt = ts
  try {
    localStorage.setItem(STORAGE_KEY, String(ts))
  } catch {
    // ignore
  }
}

function normalizePlan(value: any) {
  return String(value || '').trim().toLowerCase()
}

function isFreeAiTier() {
  const state = get(authStore)
  const plan = normalizePlan(state?.effectivePlanType || state?.planType)
  const active = Boolean(state?.effectiveSubscriptionActive ?? state?.subscriptionActive)
  const authenticated = Boolean(state?.authenticated)

  // Treat unauthenticated as free tier.
  if (!authenticated) return true

  // If we don't know, assume free to avoid surprise latency.
  if (!plan && !active) return true

  if (plan.includes('pro') || plan.includes('business') || plan.includes('enterprise') || plan.includes('corporate') || plan.includes('secure')) {
    return false
  }

  if (plan.includes('free') || plan.includes('standard')) return true

  // Active subscription without a known tier: assume paid.
  if (active) return false

  return true
}

function showNotice(message: string) {
  try {
    toast(message, {
      duration: 9000,
      style: 'max-width: 440px;'
    })
    return
  } catch {
    // ignore
  }

  try {
    ;(window as any)?.api?.showNotification?.('AI generation', message)
  } catch {
    // ignore
  }
}

export function notifyAiFreePlanNotice(options: NoticeOptions = {}) {
  if (!isFreeAiTier()) return

  const last = readLastShown()
  const ts = now()
  if (!options.force && last && ts-last < COOLDOWN_MS) return

  writeLastShown(ts)

  const sourceLabel = options.source ? ` (${options.source})` : ''
  showNotice(
    `You’re using the Free AI tier${sourceLabel}. Responses can be slower and may take a couple of minutes — sorry about that. Upgrade to Pro for faster, priority generation.`
  )
}

