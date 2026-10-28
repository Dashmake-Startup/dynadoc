export type GrammarCheckMode = 'standard' | 'picky'

export type GrammarSettings = {
  mode: GrammarCheckMode
  docLang?: string
  preferredLanguages?: string
  ignoredMatchKeys: string[]
  disabledRules?: string[]
  enabledRules?: string[]
}

const SETTINGS_PREFIX = 'dynadoc.grammar.settings:'

const safeJsonParse = (raw: string | null) => {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function defaultGrammarSettings(): GrammarSettings {
  const userLang =
    (typeof navigator !== 'undefined' &&
      ((navigator.languages && navigator.languages[0]) || navigator.language)) ||
    'en-US'
  return {
    mode: 'picky',
    docLang: undefined,
    preferredLanguages: String(userLang || 'en-US')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((l) => l.split('-')[0])
      .slice(0, 2)
      .join(','),
    ignoredMatchKeys: [],
    disabledRules: [],
    enabledRules: []
  }
}

export function loadGrammarSettings(docKey: string): GrammarSettings {
  const base = defaultGrammarSettings()
  if (typeof localStorage === 'undefined') return base
  const raw = localStorage.getItem(`${SETTINGS_PREFIX}${docKey}`)
  const parsed = safeJsonParse(raw)
  if (!parsed || typeof parsed !== 'object') return base
  return {
    ...base,
    ...parsed,
    ignoredMatchKeys: Array.isArray((parsed as any).ignoredMatchKeys)
      ? (parsed as any).ignoredMatchKeys.map((x: any) => String(x))
      : base.ignoredMatchKeys,
    disabledRules: Array.isArray((parsed as any).disabledRules)
      ? (parsed as any).disabledRules.map((x: any) => String(x))
      : base.disabledRules,
    enabledRules: Array.isArray((parsed as any).enabledRules)
      ? (parsed as any).enabledRules.map((x: any) => String(x))
      : base.enabledRules
  }
}

export function persistGrammarSettings(docKey: string, settings: GrammarSettings) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(`${SETTINGS_PREFIX}${docKey}`, JSON.stringify(settings || {}))
  } catch {
    // ignore
  }
}

