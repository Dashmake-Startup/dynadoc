import { writable } from 'svelte/store'

export type AIGenerationPhase = 'idle' | 'running' | 'repairing' | 'long-running' | 'error'

type AIGenerationState = {
  activeCount: number
  mode: string | null
  startedAt: number | null
  phase: AIGenerationPhase
  lastPrompt: string | null
  lastError: string | null
  preferVariables: boolean
}

const DEFAULT_STATE: AIGenerationState = {
  activeCount: 0,
  mode: null,
  startedAt: null,
  phase: 'idle',
  lastPrompt: null,
  lastError: null,
  preferVariables: true
}

const { subscribe, update, set } = writable<AIGenerationState>(DEFAULT_STATE)

let longRunTimer: ReturnType<typeof setTimeout> | null = null

const scheduleLongRunning = () => {
  if (longRunTimer) clearTimeout(longRunTimer)
  longRunTimer = setTimeout(() => {
    update((state) => {
      if (state.activeCount <= 0) return state
      return { ...state, phase: 'long-running' }
    })
  }, 8000)
}

export const aiGenerationStore = {
  subscribe,
  start: (mode: string, prompt: string) => {
    update((state) => {
      const next = {
        ...state,
        activeCount: state.activeCount + 1,
        mode,
        lastPrompt: prompt,
        phase: 'running',
        lastError: null,
        startedAt: state.startedAt ?? Date.now()
      }
      return next
    })
    scheduleLongRunning()
  },
  repairing: () => {
    update((state) => ({ ...state, phase: 'repairing' }))
  },
  finish: () => {
    update((state) => {
      const nextCount = Math.max(0, state.activeCount - 1)
      const shouldReset = nextCount === 0
      return shouldReset
        ? { ...DEFAULT_STATE }
        : { ...state, activeCount: nextCount, phase: 'running' }
    })
    if (longRunTimer) {
      clearTimeout(longRunTimer)
      longRunTimer = null
    }
  },
  error: (message: string) => {
    update((state) => ({
      ...state,
      phase: 'error',
      lastError: message || 'Unknown error'
    }))
  },
  setPreferVariables: (enabled: boolean) => {
    update((state) => ({ ...state, preferVariables: enabled }))
  },
  togglePreferVariables: () => {
    update((state) => ({ ...state, preferVariables: !state.preferVariables }))
  },
  reset: () => {
    if (longRunTimer) {
      clearTimeout(longRunTimer)
      longRunTimer = null
    }
    set(DEFAULT_STATE)
  }
}
