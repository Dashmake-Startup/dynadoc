import { writable } from 'svelte/store'

export type UpgradePlanTier = 'pro' | 'corporate' | 'onprem'

export interface UpgradePlanModalOptions {
  source?: string
  highlight?: UpgradePlanTier
}

export interface UpgradePlanModalState extends UpgradePlanModalOptions {
  open: boolean
}

const INITIAL_STATE: UpgradePlanModalState = {
  open: false,
  source: undefined,
  highlight: 'pro'
}

type UpgradeResolver = (value: UpgradePlanTier | null) => void

export const _$_upgradePlanModal = (() => {
  const store = writable<UpgradePlanModalState>(INITIAL_STATE)
  let resolver: UpgradeResolver | null = null

  function settle(value: UpgradePlanTier | null) {
    if (resolver) resolver(value)
    resolver = null
    store.set(INITIAL_STATE)
  }

  function open(options: UpgradePlanModalOptions = {}): Promise<UpgradePlanTier | null> {
    if (resolver) {
      resolver(null)
      resolver = null
    }

    store.set({
      ...INITIAL_STATE,
      ...options,
      open: true
    })

    return new Promise<UpgradePlanTier | null>((resolve) => {
      resolver = resolve
    })
  }

  function choose(plan: UpgradePlanTier) {
    settle(plan)
  }

  function cancel() {
    settle(null)
  }

  return {
    subscribe: store.subscribe,
    open,
    choose,
    cancel,
    setExternalState: (state: UpgradePlanModalState) => store.set(state)
  }
})()

export function openUpgradePlanModal(options: UpgradePlanModalOptions = {}) {
  return _$_upgradePlanModal.open(options)
}
