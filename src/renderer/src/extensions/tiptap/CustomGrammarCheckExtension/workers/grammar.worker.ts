import { franc } from 'franc-min'
import { resolveApiBaseUrl } from '../../../../lib/api/shared/baseUrl'
import Platform from '../../../../libs/platform'
import { invokeWithToken } from '../../../../lib/api/web/rpc'

type ParagraphPayload = {
  id: string
  text: string
  active?: boolean
}

type WorkerOptions = {
  requestId?: string
  docLang?: string
  userLang?: string
  preferredLanguages?: string
  mode?: 'standard' | 'picky'
  level?: 'default' | 'picky'
  disabledRules?: string[]
  enabledRules?: string[]
  ignoredMatchKeys?: string[]
}

const BASE = Platform.isDesktopPlatform ? '' : resolveApiBaseUrl()
const RAW_LT_URL = (import.meta as any)?.env?.VITE_LT_URL || ''

// For production web/mobile we should go through the Go proxy (`grammar:check`) to guarantee auth.
// Only desktop/dev uses direct LanguageTool.
const LT_ENDPOINTS = Array.from(
  new Set(
    [RAW_LT_URL, Platform.isDesktopPlatform ? 'http://localhost:8081/v2/check' : '']
      .filter(Boolean)
      .map((url) => String(url).replace(/\/+$/, ''))
  )
)
let ACTIVE_LT_URL = ''

const CACHE_LIMIT = 500
const CACHE = new Map<string, { hash: number; matches: any[] }>() // LRU-ish: delete+set on get
let ACCESS_TOKEN = ''

const LANG_MAP: Record<string, string> = {
  fra: 'fr',
  eng: 'en-US',
  deu: 'de-DE',
  spa: 'es'
}

const langCounts = new Map<string, number>()

self.onmessage = async (e) => {
  const { paragraphs, accessToken, token, options } = e.data || {}
  const nextToken =
    typeof accessToken === 'string' ? accessToken : typeof token === 'string' ? token : ''
  if (nextToken && nextToken.trim()) ACCESS_TOKEN = nextToken.trim()
  if (!Array.isArray(paragraphs) || !paragraphs.length) return

  const opts: WorkerOptions = options && typeof options === 'object' ? options : {}
  const requestId = String(opts?.requestId || e.data?.requestId || Date.now())

  // LRU sets for ignores
  const ignored = new Set(
    Array.isArray(opts?.ignoredMatchKeys) ? opts.ignoredMatchKeys.map((v) => String(v)) : []
  )

  // Prioritize active paragraphs and longer content (better detection, better perceived perf)
  const list: ParagraphPayload[] = paragraphs
    .map((p: any) => ({
      id: String(p?.id || ''),
      text: String(p?.text || ''),
      active: Boolean(p?.active)
    }))
    .filter((p) => p.id && p.text.trim())
    .sort((a, b) => {
      const pa = a.active ? 1 : 0
      const pb = b.active ? 1 : 0
      if (pa !== pb) return pb - pa
      return b.text.length - a.text.length
    })

  const CONCURRENCY = 4
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const chunk = list.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      chunk.map(async (pg) => {
        const hash = hashString(pg.text)

        const cached = CACHE.get(pg.id)
        if (cached && cached.hash === hash) {
          // touch LRU
          CACHE.delete(pg.id)
          CACHE.set(pg.id, cached)
          return { id: pg.id, matches: cached.matches, status: 'cached' }
        }

        const detected = detectFranc(pg.text)
        const lang = getBestLanguage(pg.text, detected, opts)
        bumpLang(lang)

        try {
          const data = await postToLanguageTool(pg.text, lang, opts)
          const matches = Array.isArray(data?.matches) ? data.matches : []
          const enriched = matches
            .map((m: any) => {
              const matchKey = computeMatchKey(pg.id, pg.text, m)
              return {
                ...m,
                matchKey,
                langDetected: lang
              }
            })
            .filter((m: any) => !ignored.has(String(m.matchKey || '')))

          lruSet(pg.id, { hash, matches: enriched })
          return { id: pg.id, matches: enriched, status: 'new' }
        } catch (err: any) {
          const message = String(err?.message || err || '')
          const status = message.toLowerCase().includes('bearer token') ? 'auth' : 'error'
          return { id: pg.id, matches: [], status }
        }
      })
    )

    self.postMessage({
      requestId,
      results,
      progress: list.length ? Math.min(1, (i + chunk.length) / list.length) : 1
    })
  }
}

function lruSet(key: string, value: { hash: number; matches: any[] }) {
  if (!key) return
  if (CACHE.has(key)) CACHE.delete(key)
  CACHE.set(key, value)
  if (CACHE.size <= CACHE_LIMIT) return
  const first = CACHE.keys().next().value
  if (first) CACHE.delete(first)
}

function bumpLang(lang: string) {
  const key = String(lang || '').trim() || 'und'
  langCounts.set(key, (langCounts.get(key) || 0) + 1)
}

function dominantLang(): string {
  let best = ''
  let bestCount = 0
  for (const [k, v] of langCounts.entries()) {
    if (v > bestCount) {
      best = k
      bestCount = v
    }
  }
  return best
}

function detectFranc(text: string): string {
  const cleaned = String(text || '').trim()
  const minLength = cleaned.length >= 40 ? 10 : 3
  return franc(cleaned, { only: ['fra', 'eng', 'deu', 'spa'], minLength })
}

function normalizeLang(input: any): string {
  const raw = String(input || '').trim()
  if (!raw) return ''
  // Accept both `fr` and `fr-FR` for LT. Keep region if present.
  if (raw.includes('-')) return raw
  return raw
}

function getBestLanguage(text: string, detected: string, opts: WorkerOptions): string {
  const mapped = detected !== 'und' ? LANG_MAP[detected] : ''
  if (mapped) return mapped

  const docDefault = normalizeLang(opts?.docLang)
  if (docDefault) return docDefault

  // Adaptive learning: if most paragraphs are the same language, use it for short/undetermined snippets.
  const dom = dominantLang()
  if (dom && (langCounts.get(dom) || 0) / Math.max(1, totalCount()) >= 0.8) {
    return dom
  }

  const user = normalizeLang(opts?.userLang)
  if (user) return user

  // Fallback for short pieces (e.g. headings)
  const pref = normalizeLang(opts?.preferredLanguages?.split(',')[0])
  if (pref) return pref

  return 'en-US'
}

function totalCount() {
  let sum = 0
  for (const v of langCounts.values()) sum += v
  return sum
}

function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

function computeMatchKey(paragraphId: string, text: string, m: any) {
  const ruleId = String(m?.rule?.id || m?.ruleId || 'rule')
  const offset = Number(m?.offset || 0)
  const length = Number(m?.length || 0)
  const ctx = String(m?.context?.text || '')
  return `${paragraphId}:${ruleId}:${offset}:${length}:${hashString(ctx || text.slice(offset, offset + length) || '')}`
}

async function postToLanguageTool(text: string, lang: string, opts: WorkerOptions) {
  const preferredLanguages = String(opts?.preferredLanguages || 'fr,en')
  const level = opts?.mode === 'standard' ? 'default' : String(opts?.level || 'picky')
  const disabledRules = Array.isArray(opts?.disabledRules) ? opts.disabledRules : []
  const enabledRules = Array.isArray(opts?.enabledRules) ? opts.enabledRules : []

  // 1) Web/Mobile: call via IPC invoke so auth works like other `invoke()` calls.
  if (BASE) {
    const payload: any = {
      text,
      language: lang,
      preferredLanguages,
      level
    }
    if (disabledRules.length) payload.disabledRules = disabledRules.join(',')
    if (enabledRules.length) payload.enabledRules = enabledRules.join(',')
    return await invokeWithToken(ACCESS_TOKEN, 'grammar:check', payload)
  }

  // 2) Direct LanguageTool fallback (desktop or dev server)
  const body = new URLSearchParams({
    text,
    language: lang,
    preferredLanguages,
    level,
    ...(disabledRules.length ? { disabledRules: disabledRules.join(',') } : {}),
    ...(enabledRules.length ? { enabledRules: enabledRules.join(',') } : {})
  })

  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' }

  if (ACTIVE_LT_URL) {
    const response = await fetch(ACTIVE_LT_URL, { method: 'POST', headers, body })
    if (!response.ok) throw new Error(`LT Server error: ${response.status}`)
    return await response.json()
  }

  let lastError: any = null
  for (const url of LT_ENDPOINTS) {
    try {
      const response = await fetch(url, { method: 'POST', headers, body })
      if (response.ok) {
        ACTIVE_LT_URL = url
        return await response.json()
      }
      lastError = new Error(`LT Server error: ${response.status}`)
    } catch (err) {
      lastError = err
    }
  }

  if (lastError) throw lastError
  throw new Error('LT Server error: no endpoints available')
}

