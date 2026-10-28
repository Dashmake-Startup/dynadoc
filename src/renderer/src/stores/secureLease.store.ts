import { writable, get } from 'svelte/store'
import { openConfirmModal } from './confirmModal.store'
import { openUpgradePlanModal } from './upgradePlanModal.store'
import EditorCommonUtils from '../utils/common.utils'

export type SecureLeaseState = {
  available: boolean
  reason?: string | null
  lastUpdated?: number
}

const INITIAL_STATE: SecureLeaseState = {
  available: true,
  reason: null,
  lastUpdated: 0
}

const store = writable<SecureLeaseState>({ ...INITIAL_STATE })

export const secureLeaseStore = {
  subscribe: store.subscribe,
  set: store.set,
  update: store.update
}

export const markSecureLeaseUnavailable = (reason?: string) => {
  store.set({
    available: false,
    reason: reason || 'Secure writing lease requires renewal.',
    lastUpdated: Date.now()
  })
}

export const markSecureLeaseAvailable = () => {
  store.set({ ...INITIAL_STATE, available: true, lastUpdated: Date.now() })
}

export const isSecureLeaseAvailable = () => get(store).available

export async function notifySecureLeaseRequired(reason?: string) {
  const message =
    reason ||
    'Your secure writing lease has expired or is unavailable. Please connect to the internet and sign in to renew.'

  await openConfirmModal({
    title: 'Renew Required',
    message,
    confirmText: 'OK',
    extraActionText: 'Renew License',
    onExtraAction: async () => {
      await EditorCommonUtils.ensureAuthenticated()
      await openUpgradePlanModal({ source: 'secure-save', highlight: 'pro' })
    }
  })
}
