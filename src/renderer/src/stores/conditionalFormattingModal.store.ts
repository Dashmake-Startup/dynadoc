import { writable } from 'svelte/store'

export type ConditionalFormattingRuleType = 'greater' | 'less' | 'duplicates'

export interface ConditionalFormattingRule {
  id: string
  type: ConditionalFormattingRuleType
  threshold?: number
  color?: string
  range?: { sr: number; sc: number; er: number; ec: number }
  createdAt: number
}

export interface ConditionalFormattingModalOptions {
  title?: string
  rules?: ConditionalFormattingRule[]
  selectionRange?: { sr: number; sc: number; er: number; ec: number } | null
}

export interface ConditionalFormattingModalState extends ConditionalFormattingModalOptions {
  open: boolean
}

export interface ConditionalFormattingModalResult {
  action: 'apply' | 'clear'
  rules: ConditionalFormattingRule[]
  applyRule?: ConditionalFormattingRule | null
}

const INITIAL_STATE: ConditionalFormattingModalState = {
  open: false,
  title: '',
  rules: [],
  selectionRange: null
}

type ModalResolver = (value: ConditionalFormattingModalResult | null) => void

export const _$_conditionalFormattingModal = (() => {
  const store = writable<ConditionalFormattingModalState>(INITIAL_STATE)
  let resolver: ModalResolver | null = null

  function settle(value: ConditionalFormattingModalResult | null) {
    if (resolver) resolver(value)
    resolver = null
    store.set(INITIAL_STATE)
  }

  function open(options: ConditionalFormattingModalOptions = {}) {
    if (resolver) {
      resolver(null)
      resolver = null
    }

    store.set({
      ...INITIAL_STATE,
      ...options,
      open: true,
      rules: options.rules ? [...options.rules] : []
    })

    return new Promise<ConditionalFormattingModalResult | null>((resolve) => {
      resolver = resolve
    })
  }

  function confirm(result: ConditionalFormattingModalResult) {
    settle(result)
  }

  function cancel() {
    settle(null)
  }

  return {
    subscribe: store.subscribe,
    open,
    confirm,
    cancel
  }
})()

export function openConditionalFormattingModal(options: ConditionalFormattingModalOptions = {}) {
  return _$_conditionalFormattingModal.open(options)
}
